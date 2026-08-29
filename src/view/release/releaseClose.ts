import { Notice } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { BacklogSettings } from '../../domain/settings';
import { t } from '../../i18n/t';
import {
	CloseOffer,
	CloseOption,
	closeOffer,
	closingFieldsMoved,
	ReleaseRow,
	ReleaseScope,
	ScopeRow,
} from '../../domain/releases';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { releaseClosureWrites } from '../../domain/releaseWritePlan';
import { ownWorkflowReading } from '../../domain/board';
import { ownValue, todayCivil } from '../../domain/noteFields';
import { openConfirm } from '../../ui/confirmDialog';
import { configProblems, membershipCollision, releaseNoteProblems } from '../../domain/settingsConsistency';
import { releaseNotesContent } from '../../domain/releaseNotesText';
import { joinSource } from '../../domain/readmeMarker';
import { GeneratedWriteResult } from '../../storage/readmeFile';
import { releaseNotesPath, writeReleaseNotes } from '../../storage/releaseNotesFile';
import { resolveViewIdentity } from '../../storage/viewIdentity';

/**
 * The release screen's closing actions. Drawn ABOVE `renderScope`'s two early returns,
 * because the empty-scope screen is the only place extension 1a can be exercised at all
 * and the unconfigured-membership screen withholds nothing that marking reads.
 *
 * Each action keeps its OWN gate: marking reads the release note alone, so membership is
 * none of its business.
 */
export function drawReleaseActions(
	view: ReleaseView,
	parentEl: HTMLElement,
	release: ReleaseRow,
	scope: ReleaseScope,
	planSettings: BacklogSettings,
): void {
	const areaEl = parentEl.createDiv({ cls: 'pbl-rel-actions' });
	drawClose(view, areaEl, release, scope);
	drawGenerate(view, areaEl, release, scope, planSettings);
}

function drawGenerate(
	view: ReleaseView,
	areaEl: HTMLElement,
	release: ReleaseRow,
	scope: ReleaseScope,
	planSettings: BacklogSettings,
): void {
	const blocked = generationBlocked(view, planSettings);
	if (blocked !== null) {
		areaEl.createDiv({ cls: 'pbl-rel-actions-note', text: blocked });
		return;
	}
	const btn = areaEl.createEl('button', {
		cls: 'pbl-rel-notes',
		text: t('release.notes.action'),
		attr: { type: 'button' },
	});
	btn.disabled = view.gate.writing;
	btn.addEventListener('click', () => void generate(view, release, scope));
}

/**
 * Why generation may not run, or null. THREE reports and two bindings.
 *
 * `configProblems` is over the PLAN's settings rather than this view's, and it belongs
 * here for a reason that is easy to miss: `stateProperty` pointed at the order key makes
 * the model read workflow strings as ranks, and this file would then list a release's
 * members in a sequence nothing can defend. `releaseNoteProblems` is the release-note
 * roles. Removing either fails exactly one row of the gate suite and no other, so both
 * are load-bearing here.
 *
 * `membershipCollision` is the domain's own rule and is kept, but the claim that "none of
 * the three subsumes another" is NOT true from this view and is not made here: the plan's
 * release key and this view's membership key are resolved from ONE option, so every
 * collision on it is visible to `configProblems` as well, and removing this call fails no
 * test. It is the check on the write rather than a check the suite can isolate — where it
 * IS isolated is `test/domain/releaseOptions.test.ts`, against settings that separate the
 * two keys.
 */
function generationBlocked(view: ReleaseView, planSettings: BacklogSettings): string | null {
	if (view.settings.notesFolder === '') return t('release.notes.bindFolder');
	// Bound is not the same as READABLE, and this one is not a collision: with the key
	// unbound every scope reads empty, and a file saying the release contained nothing
	// would replace one saying what shipped. Empty and unreadable are different answers.
	if (view.settings.membershipKey === '') return t('release.notes.bindMembership');
	const problems = [...configProblems(planSettings), ...releaseNoteProblems(view.settings)];
	const collision = membershipCollision(view.settings, planSettings);
	if (collision !== null) problems.push(collision);
	return problems.length === 0 ? null : t('config.fixFirst', { problem: problems[0] });
}

async function generate(view: ReleaseView, release: ReleaseRow, scope: ReleaseScope): Promise<void> {
	// The same identity `commands/readme.ts` builds for the backlog README, plus the
	// release — `resolveViewIdentity` returns null for an embedded base, where the view
	// name stands alone, which is the fallback that file already states.
	const identity = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	// `release.path`, never `release.name`. The name is `file.basename`, and the whole
	// reason this marker gained a third part is that two releases in different folders may
	// share a basename — and therefore share this file's OUTPUT path, since that is built
	// from the basename too. A marker naming the basename is identical for both, so the
	// refusing writer would read `b/0.9.md`'s generation as `a/0.9.md`'s regeneration and
	// overwrite the notes it exists to protect. The path is what tells them apart.
	const source = identity
		? joinSource(identity.base, identity.view, release.path)
		: joinSource(view.config.name ?? '', release.path);
	const content = releaseNotesContent(release, scope.rows, source);
	// Through the gate, so `applying` is held for the whole write rather than sampled
	// before it. A sibling batch cannot start underneath this one, and this one is
	// refused (loudly, by the gate) if a sibling got there first.
	//
	// The write's OWN failure is caught INSIDE the callback, not around this call:
	// `runExclusively` catches whatever the callback throws, logs it and shows the generic
	// apply-failed notice, then returns null — so a `catch` out here never runs, and
	// extension 4e's "reports the path it tried" would be lost to a message about backlog
	// items. The gate's null then means only one thing: it refused.
	const result = await view.gate.runFileWrite(async () => {
		try {
			return await writeReleaseNotes(view.app, view.settings.notesFolder, release.name, content);
		} catch (err) {
			console.error('Product Backlog: release notes write failed', err);
			new Notice(t('release.notes.failed', { path: releaseNotesPath(view.settings.notesFolder, release.name) }));
			return null;
		}
	});
	if (result === null || result === undefined) return; // Refused by the gate, or failed and already reported.
	new Notice(noticeFor(result));
	// Opening is a convenience, not part of the guarantee (5a).
	if (result.outcome !== 'foreign') {
		const file = view.app.vault.getFileByPath(result.path);
		if (file !== null) view.opener.openIn(view.openContext(), { file }, 'tab');
	}
}

/**
 * Which of the five outcomes happened, in the reader's terms. `foreign` and `replaced`
 * are one sentence because they are one fact for the reader: the file that is there was
 * not written for this release, and nothing was written over it.
 */
function noticeFor(result: GeneratedWriteResult): string {
	switch (result.outcome) {
		case 'foreign':
		case 'replaced':
			return t('release.notes.refused', { path: result.path });
		case 'unchanged':
			return t('release.notes.unchanged', { path: result.path });
		default:
			return t('release.notes.written', { path: result.path });
	}
}

/**
 * Every option this action refuses to run without, by the name the options panel gives it.
 * Keyed by `CloseOption`, so an option added to `closeOffer` and forgotten here is a
 * compile error rather than an `undefined` drawn into the sentence below.
 *
 * Thunks rather than keys: a bare `MessageKey` is the union of EVERY key, parameterised
 * ones included, so `t()` would demand arguments this map cannot supply. Each entry calls
 * `t` with its own literal, which is also the spelling the catalog's own type checks.
 */
const OPTION_LABEL: Record<CloseOption, () => string> = {
	releaseStatusProperty: () => t('release.option.status'),
	releasedStatusValues: () => t('release.option.releasedValues'),
	releasedTransitionValue: () => t('release.option.transitionValue'),
	releasedDateProperty: () => t('release.option.releasedDate'),
};

/** The same shape for the two NOTE problems — a map rather than a ternary, which is a
 *  sentence picked between two literals and is banned for the reason the ban states even
 *  when the literals are keys. */
const UNREADABLE_NOTE: Record<'status' | 'released', () => string> = {
	status: () => t('release.close.unreadableStatus'),
	released: () => t('release.close.unreadableDate'),
};

function drawClose(view: ReleaseView, areaEl: HTMLElement, release: ReleaseRow, scope: ReleaseScope): void {
	const offer = closeOffer(release, view.settings);
	if (!offer.offered) {
		nameWhatIsMissing(areaEl, offer);
		return;
	}
	const btn = areaEl.createEl('button', {
		cls: 'pbl-rel-close',
		text: t('release.close.action'),
		attr: { type: 'button' },
	});
	btn.disabled = view.gate.writing;
	btn.addEventListener('click', () => askThenClose(view, btn, release, scope));
}

/**
 * Why the button is not there — and only where the reader can act on the answer. A
 * release that is simply already out, or already carries a date, draws NOTHING: there is
 * nothing to repair and nothing to bind, so a sentence there would explain an absence the
 * screen's own facts already state.
 *
 * The two kinds are not one message. An unbound option is fixed in the options panel and
 * is named there; an unreadable field is fixed in the NOTE and names no option at all.
 */
function nameWhatIsMissing(areaEl: HTMLElement, offer: CloseOffer): void {
	if (offer.unreadable !== null) {
		areaEl.createDiv({ cls: 'pbl-rel-actions-note', text: UNREADABLE_NOTE[offer.unreadable]() });
		return;
	}
	if (offer.missing.length === 0) return;
	areaEl.createDiv({
		cls: 'pbl-rel-actions-note',
		text: t('release.close.bind', { options: offer.missing.map((option) => OPTION_LABEL[option]()) }),
	});
}

function askThenClose(view: ReleaseView, btn: HTMLElement, release: ReleaseRow, scope: ReleaseScope): void {
	// The ROW may already be behind the note. Obsidian's metadata cache advances before
	// Bases hands this view fresh results, so an external edit between the last render and
	// this press leaves the screen saying one thing and the note holding another — and the
	// raw value captured below would then be the EDIT, handed to the write as the value it
	// expects to find. Refused here rather than blessed there: what the reader is about to
	// confirm is what the screen showed them.
	if (closingFieldsMoved(view.app, release, view.settings)) {
		new Notice(t('release.close.changed'));
		return;
	}
	// Captured BEFORE the await, the rule the root guide states: the batch's own refresh
	// rebuilds `scope` before it resolves.
	const outstanding = unfinishedMembers(release, scope);
	// The SETTINGS the reader is about to agree to — the whole object, not just the
	// transition value. `releaseView.ts` reassigns `this.settings` to a fresh object on
	// every config refresh, so this reference is the configuration as the screen showed
	// it, frozen for the life of the dialog.
	//
	// The whole object rather than the value, because the KEYS move across this await too.
	// A date key remapped from one empty property to another leaves `closeOffer` valid and
	// the row unchanged, and planning against the LIVE settings would then write the date
	// into a property nobody confirmed — with `reconfiguredKey` waving it through, since
	// the planned key would equal the new role key it is compared against. Planning
	// against the CAPTURED keys turns that same check into the refusal it exists to be.
	const confirmed = view.settings;
	// And the RAW frontmatter, which is what the write's own expectations compare against.
	const raw = rawFields(view, release);
	openConfirm(view.app, {
		title: t('release.close.title', { name: release.name }),
		message: outstandingMessage(release, scope, outstanding),
		links: outstanding.map((row) => ({
			label: row.item.title,
			open: () => view.opener.openIn(view.openContext(), row.item, 'tab'),
		})),
		cta: t('release.close.action'),
		// Focus back on the control that opened this, on EVERY way out — and before the
		// write, so the redraw it triggers finds the button under `document.activeElement`
		// and `FOCUS_HANDLE_CLASSES` can put the reader back on it.
		onClosed: () => btn.focus(),
		onConfirm: () => void submitClose(view, release, confirmed, raw),
	});
}

/**
 * The members this release is still waiting on — TWO questions of the scope rows.
 * `context` false is the population (an excluded note naming this release is neither
 * listed nor counted), and each remaining row is then asked whether it is done through
 * `ownWorkflowReading`, never `item.done`: the requirements reading alone gets a
 * `Deliverable` or a test-catalog member backwards.
 */
function unfinishedMembers(release: ReleaseRow, scope: ReleaseScope): ScopeRow[] {
	if (release.done.unconfigured) return [];
	return scope.rows.filter((row) => !row.context && !ownWorkflowReading(row.item).done);
}

/**
 * What the confirmation says above the list. Three answers rather than two, the same
 * separation every figure on this screen keeps: progress nobody can read is not the same
 * claim as progress that is complete, and extension 2b asks for a sentence rather than an
 * empty list.
 */
function outstandingMessage(release: ReleaseRow, scope: ReleaseScope, outstanding: ScopeRow[]): string {
	if (release.done.unconfigured) return t('release.close.progressUnreadable');
	if (outstanding.length === 0) return t('release.close.allDone');
	return t('release.close.outstanding', {
		count: outstanding.length,
		total: scope.rows.filter((row) => !row.context).length,
	});
}

async function submitClose(
	view: ReleaseView,
	release: ReleaseRow,
	confirmed: ReleaseSettings,
	raw: { status: unknown; released: unknown },
): Promise<void> {
	// The CONFIGURATION moves across an await as well as the note. `reconfiguredKey`
	// compares keys, and this action's two options are VALUES, so it cannot see a
	// transition value edited while the dialog was open. Re-asked, and REFUSED rather
	// than substituted: the reader agreed to what the screen showed them.
	const offer = closeOffer(release, view.settings);
	// TWO questions, and the second is not implied by the first: `closeOffer` says the
	// configuration is still usable, and this says it is still the SAME. A transition
	// changed from one valid released value to another passes the first and fails here,
	// which is the case that would otherwise write a status nobody agreed to.
	if (!offer.offered || view.settings.releasedTransition !== confirmed.releasedTransition) {
		new Notice(t('release.close.changed'));
		return;
	}
	await view.applyRelease(
		releaseClosureWrites(
			release.item.file,
			// The CAPTURED settings, so the keys planned against are the keys confirmed
			// against. A remap since then makes `reconfiguredKey` refuse the batch at the
			// gate — which is the answer wanted here, and the one planning against the
			// live settings quietly loses.
			confirmed,
			{ status: release.status.value, released: release.released.value },
			raw,
			todayCivil(),
		),
	);
}

/** What the note's two closing fields LITERALLY hold right now, for the write's own
 *  expectations. Read from the metadata cache rather than from `ReleaseRow`, whose values
 *  are normalised — the distinction `releaseClosureWrites`' own header states. */
function rawFields(view: ReleaseView, release: ReleaseRow): { status: unknown; released: unknown } {
	const fm = view.app.metadataCache.getFileCache(release.item.file)?.frontmatter;
	return {
		status: ownValue(fm, view.settings.statusKey),
		released: ownValue(fm, view.settings.releasedDateKey),
	};
}
