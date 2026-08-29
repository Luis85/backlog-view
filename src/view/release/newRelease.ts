import { Notice, setIcon } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseSettings, resolveReleaseSettings } from '../../domain/releaseOptions';
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
	// A FRESH resolve of the live config, never `view.settings`: that field is a snapshot
	// from the last data update, so an option bound since then reads as unset here and the
	// press reports a configuration change it did not make — `init.ts`'s own documented trap,
	// met on the reading side rather than the binding one.
	const before = boundKeys(resolveReleaseSettings(view.config));
	// Run unconditionally rather than asking first which options are unset. `runReleaseInit`
	// already puts that question to the live config (`adoptCandidates`), binds only what
	// nobody has touched, leaves a cleared option alone and does nothing at all when
	// everything is bound — a second reading of the same question here could only ever come
	// to disagree with it.
	await runReleaseInit(view);
	return boundKeys(view.settings) !== before;
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
	openNewReleaseDialog(
		view.app,
		releaseFields(view.settings),
		(result) => void writeRelease(view, result),
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

/** The four keys this press can bind, as one value, so "did it bind anything" is one
 *  comparison rather than four. A joined KEY LIST, never a sentence. */
function boundKeys(settings: ReleaseSettings): string {
	return [settings.membershipKey, settings.versionKey, settings.targetDateKey, settings.statusKey].join('\n');
}

/**
 * Which of a release's own fields this vault has a property bound for, in the order the
 * dialog draws them. An unconfigured key is never written to, so a field whose value could
 * only land nowhere is never asked for — which after the bind above means one the reader
 * deliberately cleared.
 */
function releaseFields(settings: ReleaseSettings): ReleaseFieldId[] {
	const fields: ReleaseFieldId[] = [];
	if (settings.versionKey) fields.push('version');
	if (settings.targetDateKey) fields.push('targetDate');
	if (settings.statusKey) fields.push('status');
	return fields;
}

/**
 * What confirming does. A box the reader left blank is written NOWHERE — `createRelease`
 * keeps that rule for every caller, so nothing here strips a value on the way past.
 *
 * It was the opposite until this round, on the ground that a key nothing carries cannot be
 * offered by Obsidian's property picker (`init.ts` records the same cost). That traded one
 * problem for a worse one: `readLabel` and `readTarget` (`domain/releases.ts`) read a
 * present-but-blank key as UNREADABLE rather than absent — [[Releases as their own type]]
 * 3b names the empty string explicitly — so the release this press had just made drew
 * `Unreadable` in three columns of the index and again on its own screen. The picker cost
 * is unchanged in kind and only in WHEN: it is now the first release that CARRIES a
 * version, a date or a status that makes that one pickable.
 *
 * `createRelease` THROWS without a type key rather than refusing quietly — a state its
 * caller is supposed to have ruled out, and `draw` has. Reported rather than left to the
 * console for the reason `writeResource` (`view/interactions/resourceNotes.ts`) reports
 * its own: a press that produced no note and said nothing looks like a dead button.
 */
async function writeRelease(view: ReleaseView, result: NewReleaseResult): Promise<void> {
	try {
		const file = await createRelease(view.app, view.settings, result);
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
