import { Notice, setIcon } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { BasesViewConfig } from 'obsidian';
import { declaredPropertyKeys, ReleaseSettings } from '../../domain/releaseOptions';
import { createRelease } from '../../storage/createNote';
import { NewReleaseResult, openNewReleaseDialog, ReleaseFieldId } from '../../ui/newReleaseDialog';
import { runReleaseInit } from './init';

/**
 * The `New release` control, and the one function behind it.
 *
 * Drawn at the head of the index and again on the no-releases empty state
 * (`releaseView.draw`), which is where "one move, N inputs" lands here: both presses call
 * {@link newRelease}, the only place a release note is planned, so a second entry point
 * cannot grow a second idea of what creating one means.
 *
 * **A real `<button>` and an ordinary tab stop, decided from where it is DRAWN** rather
 * than from what it does (`src/view/CLAUDE.md`, Controls). Both positions are outside any
 * composite widget: this view runs no roving selection at all — every index row is itself
 * a plain tab stop, and the empty state is prose — so the tree's `tabindex="-1"` answer
 * would take the control off the keyboard and hand it no menu to be its keyboard path.
 *
 * It is offered only where a type key is bound, and that is not a check here: both callers
 * are past `draw`'s own `typeKey` guard, which is what withholds the press on the one
 * configuration {@link createRelease} refuses.
 */
export function renderNewRelease(view: ReleaseView, parentEl: HTMLElement): void {
	const btn = parentEl.createEl('button', { cls: 'pbl-rel-new mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: t('release.new.cta') });
	btn.addEventListener('click', () => void newRelease(view));
}

/**
 * Bind whatever this vault has never touched, and answer WHETHER anything was bound.
 *
 * Extracted so the ✨ control and the `New release` press cannot come to disagree about
 * what a bind is — the root guide's "one move, N inputs": the binding and the reading
 * that reports it live together, never beside each caller. The two callers differ only
 * in what they SAY about a press that bound nothing, which is why this answers a boolean
 * rather than showing a message of its own: `New release` stays quiet and opens its
 * dialog (the requirement's "stays quiet when it did not"), while a standalone control
 * with nothing after it would otherwise look dead.
 */
export async function bindAndReport(view: ReleaseView): Promise<boolean> {
	// Read from the LIVE config, never from `view.settings`: that field is a snapshot from
	// the last data update, so an option bound since then reads as unset here and the press
	// reports a configuration change it did not make — `init.ts`'s own documented trap, met
	// on the reading side rather than the binding one. Both ends of the comparison ask the
	// same config, so the difference can only be what {@link runReleaseInit} set.
	const before = boundKeys(view.config);
	// Run unconditionally rather than asking first which options are unset. `runReleaseInit`
	// already puts that question to the live config (`adoptCandidates`), binds only what
	// nobody has touched, leaves a cleared option alone and does nothing at all when
	// everything is bound — a second reading of the same question here could only ever come
	// to disagree with it.
	await runReleaseInit(view);
	return boundKeys(view.config) !== before;
}

/**
 * Bind, then ask, then create — the order the design turns on. On a fresh view every
 * option is unset, so the fields the dialog offers are decided AFTER the bind or a first
 * release could never carry a version, a date or a status.
 */
async function newRelease(view: ReleaseView): Promise<void> {
	// Said rather than silent: the press changed the saved view's own configuration, which
	// nothing else on this screen reports. Quiet when it bound nothing is this caller's own
	// half of the rule — the dialog opens either way, so a silent press is not a dead one.
	if (await bindAndReport(view)) new Notice(t('release.new.bound'));
	// **The bindings are CAPTURED with the field list**, the root guide's capture-before-the-
	// await asked of a creation: the dialog offers the fields these keys make writable, and a
	// `.base` re-pointed while it is open would otherwise have the submit read the settings
	// again — so a cleared `descriptionProperty` drops the text the reader typed while the
	// notice still says the release was created, and a re-pointed one files it under a
	// property the dialog was never opened against (found by review, PR #211). One snapshot
	// answers both, because `resolveReleaseSettings` builds a new object per data update.
	// Nothing existing is overwritten either way: this is a note that does not exist yet, so
	// the captured keys are refused nowhere — unlike an EDIT, where `reconfiguredKey` refuses
	// a captured key that is no longer its own field's.
	const settings = view.settings;
	openNewReleaseDialog(
		view.app,
		releaseFields(settings),
		(result) => void writeRelease(view, dialogBindings(settings), result),
		() => focusNewRelease(view),
	);
}

/**
 * Where focus goes, looked up FRESH on every call rather than captured: the press may have
 * called `config.set`, and the create certainly changes the data — and the refresh behind
 * either one redraws the screen the opening button was in. Both screens that offer the
 * gesture draw the control, so the current one is the destination; with none drawn, focus
 * is left where it is rather than sent somewhere the reader did not come from.
 *
 * The root guide's "capture before the await" rule cuts the other way here. What that rule
 * protects is a VALUE an awaited write will name — a column, a bucket — which the refresh
 * may take away; this is the ELEMENT the refresh REPLACES, so capturing it is exactly how
 * focus lands on a detached node.
 *
 * One statement of the destination, two callers, because `NewReleaseDialog.submit` closes
 * before it submits: `onClosed` fires first and `writeRelease` runs after it, so the close
 * alone puts focus on a button the create's own refresh then replaces. What the second call
 * CANNOT promise is that focus stays. It only wins the refreshes that land INSIDE the
 * await, which is the case `test/view/release/newRelease.test.ts` stages by driving
 * `onDataUpdated()` there; a vault refreshes on its own schedule, so one landing after the
 * await takes focus to the body again and nothing here — or in that test — can say
 * otherwise.
 */
function focusNewRelease(view: ReleaseView): void {
	view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-new')?.focus({ preventScroll: true });
}

/**
 * Every key this press can bind, as one value, so "did it bind anything" is one comparison
 * rather than one per candidate. A joined KEY LIST, never a sentence.
 *
 * Read off the DECLARATION (`declaredPropertyKeys`) rather than off `ReleaseSettings`'
 * own fields, and that is the same correction `declaredPropertyKeys`
 * itself records: `stateProperty` is declared by this view and resolves onto
 * `BacklogSettings.stateKey`, so it is on no field of `ReleaseSettings` and a sweep over
 * that object cannot see it. With the hand-written four, a press whose only work was
 * binding the state key — the whole progress half of this view — compared equal and
 * reported that it had bound nothing, then skipped the redraw that would have shown the
 * bars it had just switched on.
 */
function boundKeys(config: BasesViewConfig): string {
	return declaredPropertyKeys(config).join('\n');
}

/**
 * The four bindings the dialog DRAWS a field for, paired with the field each one draws, in
 * the order they are drawn. One table because two readers need the same list and a second
 * copy is one edit from disagreeing: which fields to ask for, and which keys to capture.
 *
 * `description` is LAST, and it is the only one of the four whose position is an argument
 * rather than an order somebody picked: the other three are one line each and this one is a
 * box, so a dialog that put it in the middle would push the short fields below the fold of
 * a box the reader has not typed in yet.
 */
const DIALOG_BINDINGS: [keyof ReleaseSettings, ReleaseFieldId][] = [
	['versionKey', 'version'],
	['targetDateKey', 'targetDate'],
	['statusKey', 'status'],
	['descriptionKey', 'description'],
];

/**
 * Which of a release's own fields this vault has a property bound for, in the order the
 * dialog draws them. An unconfigured key is never written to, so a field whose value could
 * only land nowhere is never asked for — which after the bind above means one the reader
 * deliberately cleared.
 */
function releaseFields(settings: ReleaseSettings): ReleaseFieldId[] {
	return DIALOG_BINDINGS.filter(([key]) => settings[key] !== '').map(([, field]) => field);
}

/**
 * The keys behind those fields, captured when the dialog opens — and NOTHING else.
 *
 * That is the whole rule, and it took three review rounds to say in one sentence: **what
 * the dialog DREW is captured, and everything else is read at the submit.** A field's key
 * is a promise to the reader — the box they typed in was labelled by this property and
 * their text belongs on it — while `typeKey` and `releaseFolder` are never shown, never
 * collected, and are simply how the plugin files the note. Captured, those two do harm and
 * no good: a re-pointed type key files `Release` under a property the view has stopped
 * reading, so the note is created, reported as created, and in no reader at all, and a
 * changed folder puts it somewhere the reader has just said releases do not go (both found
 * by review, PR #211).
 *
 * Read live, both land the note where the vault is configured NOW, which is the only place
 * it is usable. That is why this replaced a REFUSAL on the type key one commit later: the
 * refusal was correct about the hazard and threw away the reader's typed values to avoid
 * it, when reading the key loses nothing at all.
 */
function dialogBindings(settings: ReleaseSettings): Partial<ReleaseSettings> {
	return Object.fromEntries(DIALOG_BINDINGS.map(([key]) => [key, settings[key]]));
}

/**
 * What confirming does. A box the reader left blank is written NOWHERE — `createRelease`
 * keeps that rule for every caller, so nothing here strips a value on the way past.
 *
 * It was the opposite until this round, on the ground that a key nothing carries cannot be
 * offered by Obsidian's property picker (`init.ts` records the same cost). That traded one
 * problem for a worse one: `readLabel` (`domain/releases.ts`) and `readSoleDate` (`domain/noteFields.ts`) read a
 * present-but-blank key as UNREADABLE rather than absent — [[Releases as their own type]]
 * 3b names the empty string explicitly — so the release this press had just made drew
 * `Unreadable` in three columns of the index and again on its own screen. The picker cost
 * is unchanged in kind and only in WHEN: it is now the first release that CARRIES a
 * version, a date or a status that makes that one pickable.
 *
 * `settings` is the snapshot the dialog was OPENED against, never `view.settings` — see
 * {@link newRelease} for what a re-pointed option does to a submit that reads them again.
 *
 * `createRelease` THROWS without a type key rather than refusing quietly — a state its
 * caller is supposed to have ruled out, and `draw` has. Reported rather than left to the
 * console for the reason `writeResource` (`view/interactions/resourceNotes.ts`) reports
 * its own: a press that produced no note and said nothing looks like a dead button.
 */
async function writeRelease(view: ReleaseView, bindings: Partial<ReleaseSettings>, result: NewReleaseResult): Promise<void> {
	// The captured field keys over today's everything-else — see `dialogBindings` for why
	// that split is the whole rule rather than a list of exceptions.
	const settings: ReleaseSettings = { ...view.settings, ...bindings };
	try {
		const file = await createRelease(view.app, settings, result);
		// The note's own name, never the requested one — `uniqueNotePath` may have suffixed
		// it. `writeResource` reports the same way for the same reason.
		new Notice(t('release.new.created', { name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create the release', e);
		new Notice(t('release.new.failed'));
	}
	// After the await, and on both endings: a refusal leaves the button the close already
	// focused, and a creation is what replaces it. See `focusNewRelease` for what this can
	// and cannot promise.
	focusNewRelease(view);
}
