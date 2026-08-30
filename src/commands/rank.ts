import { App, Notice } from 'obsidian';
import { t } from '../i18n/t';
import { BacklogItem, BacklogModel } from '../domain/model';
import { computeRespaceWrites, computeSeedWrites, SpreadResult } from '../domain/rankSpread';
import { distinctlyRanked } from '../domain/rankOrder';
import { openConfirm } from '../ui/confirmDialog';
import { activeBacklogView, LiveBacklogView } from '../view/registry';

/**
 * The two whole-population rank rewrites, as palette commands.
 *
 * **They look alike and must never be confused.** *Seed* writes the hierarchy into
 * numbers and is correct exactly once — run a second time it discards every order set by
 * hand at a focus level. *Respace* keeps the order already on screen and is correct any
 * number of times. Neither can be derived from the other, and a single command guessing
 * between them by inspecting the data would decide, silently, which of a user's two very
 * different intentions they meant.
 *
 * Ids beside the flows they run: they are persisted in the user's hotkeys, so renaming
 * one unbinds whatever they had.
 */
export const SEED_RANKS_COMMAND_ID = 'seed-ranks';
export const RESPACE_RANKS_COMMAND_ID = 'respace-ranks';

/** Which rewrite this is — the only thing the two commands differ in. */
type Spread = (model: BacklogModel) => SpreadResult;

/** What the dialog reads: the sentence, and a second one where the command has a caveat
 *  to state. Both are the CONFIRMATION's, so the two arrive together rather than as two
 *  parameters that could be given for different populations. */
type Confirmation = (count: number, model: BacklogModel) => { message: string; note?: string };

/** The refusal both share: writable rows squeezed against a rank this base may not
 *  write. Named notes, because "somewhere in your backlog" is not actionable. */
function wedgedNotice(wedged: BacklogItem[]): void {
	new Notice(t('rank.wedged', { titles: wedged.map((item) => item.title) }));
}

/**
 * Apply what the command plans, once the user has said yes.
 *
 * **The view is re-resolved AND identity-checked.** Two different failures, and fixing
 * only one causes the other. `onunload` calls `forgetBacklogView` and disposes the write
 * gate but leaves `model` non-null, so the captured view still answers with a snapshot
 * that stopped refreshing — only the registry can tell a live view from a disposed one.
 * And `activeBacklogView` answers for whatever is active NOW, so re-resolving alone would
 * rewrite base B's ranks under a dialog that counted base A's. Ask the registry, and
 * require the same object back.
 *
 * **The batch is recomputed, never the previewed one.** These commands rewrite the rank
 * of every note, and the dialog can stay open across a vault sync, a write from another
 * view or another plugin. Applying the captured batch would overwrite every ranking
 * change made in between: `applySafely` serializes and gates, but it does not compare a
 * planned value against what the note now holds. The count may therefore differ from the
 * one the dialog showed, and the notice reports what was actually written — `written` off
 * the outcome, which is the only number that knows whether the batch finished.
 */
async function applyRank(app: App, opened: LiveBacklogView, plan: Spread): Promise<void> {
	const live: LiveBacklogView | null = activeBacklogView(app);
	if (live === null || live !== opened || live.model === null) return;
	const planned = plan(live.model);
	if ('wedged' in planned) {
		wedgedNotice(planned.wedged);
		return;
	}
	const outcome = await live.applySafely(planned.writes);
	// **What landed, never what was planned.** `applyWrites` stops at the first note that
	// no longer fits the plan and returns the prefix it got through, so the planned length
	// is a false success beside the refusal notice that batch has already fired — over a
	// rank population that is now half the old scheme and half the new. Nothing at all
	// written is that refusal's own sentence to say, not a second one here.
	if (outcome !== null && outcome.written > 0) new Notice(t('rank.done', { count: outcome.written }));
}

/**
 * One command body in `checkCallback` shape, so the palette offers it only while a
 * backlog view is showing results — the rank space is that view's population, and a
 * command run against no view has nothing to rewrite.
 *
 * The count in the confirmation is the model's as it stands NOW, because the dialog has
 * to say a number before the user can answer. `applyRank` above is what keeps that from
 * becoming the number written.
 */
function rankCommand(
	app: App,
	checking: boolean,
	plan: Spread,
	title: string,
	confirmation: Confirmation,
): boolean {
	const view = activeBacklogView(app);
	if (view === null || view.model === null) return false;
	if (checking) return true;
	const preview = plan(view.model);
	// A wedged preview opens no dialog: there is nothing to confirm.
	if ('wedged' in preview) wedgedNotice(preview.wedged);
	else {
		openConfirm(app, {
			title,
			...confirmation(preview.writes.length, view.model),
			cta: title,
			onConfirm: () => void applyRank(app, view, plan),
		});
	}
	return true;
}

/**
 * Respace's second sentence, or nothing at all.
 *
 * Its first one promises to keep "the order they are in now", and that is a promise about
 * what is DRAWN: a list whose rows are not distinctly ranked is drawn in tree order
 * (`inRankOrder`), while the sequence Respace writes is the global rank sort. So on such a
 * population the command silently redraws the backlog in an order nobody chose, and the
 * confirmation has to say so.
 *
 * **Narrowing the promise rather than refusing**, which was decided rather than defaulted:
 * refusing whenever the population holds a tie bounces the user to Seed, and Seed discards
 * hand-set focus ranks that may be perfectly distinct in their own list. Deriving a
 * sequence that preserves the rendered order is not available either — `distinctlyRanked`
 * is asked per RENDERED list and this is a whole-population rewrite, so there is no single
 * rendered order to preserve. Told, the user decides; that is the one thing neither of the
 * other two answers allows.
 *
 * Asked of the whole population, which is the only place this predicate is sound on the
 * write side: every rendered list is a subset of it, so distinct here means none of them
 * is falling back. See `distinctlyRanked`'s own note on why a PLACEMENT may not ask it.
 */
function respaceCaveat(model: BacklogModel): string | undefined {
	return distinctlyRanked(model.ranked) ? undefined : t('rank.respaceReorders');
}

export function seedRanksCommand(app: App, checking: boolean): boolean {
	return rankCommand(app, checking, computeSeedWrites, t('command.seedRanks'), (count) => ({
		message: t('rank.seedConfirm', { count }),
	}));
}

export function respaceRanksCommand(app: App, checking: boolean): boolean {
	return rankCommand(app, checking, computeRespaceWrites, t('command.respaceRanks'), (count, model) => ({
		message: t('rank.respaceConfirm', { count }),
		note: respaceCaveat(model),
	}));
}
