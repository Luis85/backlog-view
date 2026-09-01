import { App, Notice } from 'obsidian';
import { t } from '../i18n/t';
import { BacklogModel } from '../domain/model';
import { computeRespaceWrites, computeSeedWrites, SpreadResult } from '../domain/rankSpread';
import { ItemWrite } from '../domain/writePlan';
import { distinctlyRanked } from '../domain/rankOrder';
import { configProblems } from '../domain/settingsConsistency';
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

/**
 * The plan, or null with the reason already said out loud.
 *
 * **Every way out of these two commands speaks**, which the first version did not: a
 * wedged population, an empty one, and (in `applyRank` below) a dialog answered after the
 * view it counted went away. Fail-closed is right and silence is not — a command the user
 * invoked and confirmed must never do nothing and say nothing, which is the same defect
 * this whole task exists to fix on the drop path.
 *
 * The empty plan needs its own sentence because nothing else has one: `applySafely`
 * returns null on an empty batch before any refusal it could report, so a base with
 * nothing to rank would otherwise offer "Rank 0 notes", be confirmed, and answer nothing.
 */
function plannedWrites(model: BacklogModel, plan: Spread): ItemWrite[] | null {
	const planned = plan(model);
	if ('wedged' in planned) {
		// Named notes, because "somewhere in your backlog" is not actionable.
		new Notice(t('rank.wedged', { titles: planned.wedged.map((item) => item.title), count: planned.wedged.length }));
		return null;
	}
	if (planned.writes.length === 0) {
		new Notice(t('rank.nothing'));
		return null;
	}
	return planned.writes;
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
 *
 * **And the recomputed batch is checked against the sentence that was agreed to.** A
 * refreshed model can need a caveat the dialog never showed, and applying then keeps a
 * promise the data no longer supports — see the recheck below.
 */
async function applyRank(
	app: App,
	opened: LiveBacklogView,
	plan: Spread,
	confirmation: Confirmation,
	shownNote: string | undefined,
): Promise<void> {
	const live: LiveBacklogView | null = activeBacklogView(app);
	if (live === null || live !== opened || live.model === null) {
		new Notice(t('rank.viewGone'));
		return;
	}
	const planned = plannedWrites(live.model, plan);
	if (planned === null) return;
	// **The caveat is recomputed beside the batch**, because the dialog said what this
	// would DO and the model it said it of is the one that may have moved. A population
	// that was distinctly ranked when the dialog opened and is not now would be respaced
	// under a promise to keep the order on screen, and respacing is exactly what breaks
	// that promise on such a population. Asked one way only: a caveat that has STOPPED
	// applying makes the sentence stricter than the truth, which is safe to keep, so
	// nothing is refused for it.
	const note = confirmation(planned.length, live.model).note;
	if (note !== undefined && note !== shownNote) {
		new Notice(t('rank.caveatChanged'));
		return;
	}
	const outcome = await live.applySafely(planned);
	// **What landed, never what was planned.** `applyWrites` stops at the first note that
	// no longer fits the plan and returns the prefix it got through, so the planned length
	// is a false success beside the refusal notice that batch has already fired — over a
	// rank population that is now half the old scheme and half the new. Nothing at all
	// written is that refusal's own sentence to say, not a second one here.
	//
	// **And what CHANGED decides which sentence it is.** `written` counts every note the
	// batch opened, a note already holding its planned number included — so respace run
	// twice reported a rewrite over a vault it left alone, with no undo behind the claim.
	//
	// **And "nothing changed" is a claim about the WHOLE batch**, so only a batch that ran
	// whole may make it. The two conditions meet: a refused batch can be idempotent as far
	// as it got, and `{ changed: false, written: 1 }` is what that returns — over a
	// population whose notes after the refusal were never opened. Said there, the sentence
	// is false of them and contradicts the refusal notice it follows.
	if (outcome === null || outcome.written === 0) return;
	if (outcome.changed) new Notice(t('rank.done', { count: outcome.written }));
	else if (outcome.written === planned.length) new Notice(t('rank.unchanged'));
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
	// **The configuration is asked BEFORE the plan, for the reason `reportRefusal` gives on
	// the drag path** ([[Ranking at the focused level]] extension 2c): while
	// `configProblems` is non-empty the gate refuses every rank write, so any other advice
	// sends the user in a circle. It matters here only where the plan answers nothing —
	// a wedged plan tells them to run this on an unfiltered base, which is a real remedy
	// for a different problem and will not work while the options collide. A plan with
	// writes in it reaches the gate and is reported correctly already; asking here as well
	// costs nothing and means the two paths cannot come to disagree.
	//
	// REPORTED, never withheld: the command stays offered, because a user whose view is
	// misconfigured needs to be told which property to fix rather than to find the entry
	// missing. That is the same choice `reportRefusal` made and the opposite of the menu's,
	// where an entry that does nothing is the thing being avoided.
	const problems = configProblems(view.settings);
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return true;
	}
	// A wedged or empty preview opens no dialog: there is nothing to confirm, and
	// `plannedWrites` has already said which of the two it was.
	const preview = plannedWrites(view.model, plan);
	if (preview !== null) {
		const said = confirmation(preview.length, view.model);
		openConfirm(app, {
			title,
			...said,
			cta: title,
			// The note that was SHOWN travels with the confirmation, so `applyRank` can ask
			// whether the model still says the same thing rather than trusting that it does.
			onConfirm: () => void applyRank(app, view, plan, confirmation, said.note),
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
