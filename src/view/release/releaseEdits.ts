import { Menu } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseIndex, releaseStatusChoices, ReleaseRow } from '../../domain/releases';
import {
	releaseDescriptionWrites,
	releaseReleasedWrites,
	releaseStatusWrites,
	ReleaseWrite,
} from '../../domain/releaseWritePlan';
import { formatCivil } from '../../domain/timeline';
import { SchedulePromptModal, ValuePromptModal } from '../../ui/prompts';
import { showMenuForClick } from '../interactions/menu';
import { openTextPrompt } from '../../ui/textPrompt';

/**
 * The two edits this view offers on a release's own screen
 * ([[Editing a release from its own screen]]): pick its status, and write what it is for.
 *
 * Its own module for `renderScope.ts`'s sake — that file draws the header and its two
 * empty states and is already at four reasons to change — and because these two belong
 * together: they are the whole of what this view may write to a note that already exists,
 * and a third field would join them here rather than beside whichever control drew it.
 *
 * **Both land on `ReleaseView.applyRelease`**, which is the only place a release edit
 * reaches the gate. That is the root guide's "one move, N inputs" for this view: a pick,
 * its Clear entry and the description's own dialog are three inputs and one write path.
 * What each of them PLANS is `domain/releaseWritePlan.ts`'s, so the "writes nothing when
 * nothing changed" rule is asked once rather than at each control.
 *
 * **Nothing here reaches a member.** Every write below names `release.item.file` — the
 * release note itself — and the gate refuses a batch naming anything this base did not
 * return. A member is work, and work is edited on the backlog view.
 */

/**
 * The status menu: what this vault declares, what its releases carry, and this release's
 * own value — `releaseStatusChoices` unions the three, so a status somebody hand-wrote is
 * offered beside the ones the options panel names.
 *
 * **The checkmark is asked of the PLAN**, never of a comparison written beside it: an
 * entry is checked exactly when picking it would write nothing. That is the rule the root
 * guide states after the two drifted apart on the horizon menu — a reader that refuses a
 * value reads it as absent, so comparing values ticked an entry whose key still held
 * something and offered as current an action that removes a key.
 *
 * `Clear` is offered only where the note CARRIES a readable value, the same presence gate
 * every removal in this plugin uses: an entry that would write nothing is not an action.
 * An UNREADABLE status (a key holding a list, or the empty string 3b names) reads as no
 * value here, so no clear is offered for it and the reader repairs it in the note — which
 * the header's own Open release note control is one press away from.
 */
/** The chip's own selector, spelled once: three entries in the menu below write, and all
 *  three put focus back on it. */
const STATUS_CHIP = '.pbl-rel-status';
/** The other two controls that open a dialog, spelled once for the same two reasons the
 *  chip's is above: the write's own refocus after the await, and the CANCEL's before it. */
const DESCRIPTION_LINE = '.pbl-rel-desc';
const RELEASED_BUTTON = '.pbl-rel-released';
/** `drawReleased`'s own replacement for the case that made this the one control of the
 *  three that can be gone after the write it caused: clearing the date can make `Mark as
 *  released` offered again, and `renderScope.ts` withholds the button on exactly that
 *  condition — see `focusControl`'s own note on why this is the fallback rather than the
 *  body. */
const CLOSE_BUTTON = '.pbl-rel-close';

export function showReleaseStatusMenu(view: ReleaseView, evt: MouseEvent, release: ReleaseRow, index: ReleaseIndex): void {
	const key = view.settings.statusKey;
	const current = release.status.value;
	const menu = new Menu();
	const choices = releaseStatusChoices(view.settings, index, current);
	for (const choice of choices) {
		const writes = releaseStatusWrites(release.item.file, key, current, choice);
		menu.addItem((mi) =>
			mi
				.setTitle(choice)
				.setChecked(writes.length === 0)
				// Through `save` rather than `applyRelease` directly, for the reason the
				// description's dialog needs it: an Obsidian `Menu` is mounted on the BODY, so
				// while it is open the view contains no focused element and `focusedHandle`
				// correctly answers null — the write's own redraw then leaves a keyboard reader
				// on `document.body`, having paid a lost place for every status they set
				// (found by review, PR #211). `FOCUS_HANDLE_CLASSES` cannot reach a menu pick;
				// only an explicit refocus after the await can.
				.onClick(() => void save(view, writes, STATUS_CHIP)),
		);
	}
	// **A menu that can set nothing is a control that lies.** With no declared values, no
	// other release carrying one and nothing on this note, the loop above adds no entry and
	// the Clear foot below is withheld too — so the unset chip opened an empty box and the
	// vault had no way to write its FIRST status from this view at all (found by review, PR
	// #211). The prompt is that route, and it is offered only here: once a status exists it
	// is in the vocabulary, and a free-text entry standing beside a list invites two
	// spellings of one status. `known: []` deliberately — there is nothing to suggest, which
	// is the whole condition.
	if (choices.length === 0) {
		menu.addItem((mi) =>
			mi
				.setTitle(t('release.scope.newStatus'))
				.setIcon('plus')
				.onClick(() =>
					new ValuePromptModal(view.app, {
						title: t('release.scope.newStatusTitle', { name: release.name }),
						fieldName: t('release.index.column.status'),
						placeholder: t('release.scope.newStatusPlaceholder'),
						ctaLabel: t('release.scope.newStatusCta'),
						known: [],
						onClosed: () => focusControl(view, STATUS_CHIP),
						onSubmit: (value) => void save(view, releaseStatusWrites(release.item.file, key, current, value), STATUS_CHIP),
					}).open(),
				),
		);
	}
	if (current !== null) {
		menu.addSeparator();
		menu.addItem((mi) =>
			mi
				.setTitle(t('release.scope.clearStatus'))
				.setIcon('eraser')
				// The Clear foot writes, so it takes the same route: it lands on the chip in its
				// UNSET form, the same element by class and a different one by content.
				.onClick(() => void save(view, releaseStatusWrites(release.item.file, key, current, null), STATUS_CHIP)),
		);
	}
	showMenuForClick(menu, evt);
}

/**
 * The description dialog: a paragraph, prefilled with what the note holds.
 *
 * An emptied box CLEARS the key rather than writing `''` — the planner's own rule, and the
 * one this view's reader forces: an empty string is UNREADABLE to `readLabel`, so a
 * description cleared by blanking would come back drawn as somebody's mistake.
 *
 * `release.description.value` is the prefill, so an UNREADABLE description opens the box
 * empty rather than showing whatever the key holds — this dialog writes a string, and
 * putting a list or an object in it as text would turn a reading problem into a data one
 * the moment the reader pressed Save.
 */
export function editReleaseDescription(view: ReleaseView, release: ReleaseRow): void {
	const current = release.description.value;
	// The KEY is captured with the value it belongs to, never read again at submit — the
	// root guide's "capture before the await", and the status menu's own shape. A `.base`
	// re-pointed while this dialog is open would otherwise leave the box holding the OLD
	// property's text and write it to the NEW one, overwriting data the reader never saw
	// (found by review, PR #211).
	const key = view.settings.descriptionKey;
	openTextPrompt(view.app, {
		title: t('release.scope.descriptionTitle', { name: release.name }),
		// The FIELD's own name, not the option's: a dialog editing one release's description
		// labelling its box "Release description property" is a settings label in a note's
		// editor. `release.option.description` stays what the options panel draws.
		fieldName: t('release.scope.descriptionLabel'),
		placeholder: t('release.scope.descriptionPlaceholder'),
		ctaLabel: t('release.scope.descriptionSave'),
		initial: current ?? '',
		onClosed: () => focusControl(view, DESCRIPTION_LINE),
		onSubmit: (text) =>
			void save(view, releaseDescriptionWrites(release.item.file, key, current, text), DESCRIPTION_LINE),
	});
}

/**
 * The released date: the day this release actually shipped, picked in the same dialog the
 * roadmap's own Schedule uses (`SchedulePromptModal`) with one field in it.
 *
 * **This is not [[Marking a release as released]]**, and the difference is worth stating
 * because that note is still Open. That one is a transition: it writes a configured status
 * value AND the date in one batch, states what is outstanding first and asks for
 * confirmation. This writes the date and nothing else, from a reader who already knows
 * they shipped — which is what makes the key exist at all, and so what makes the index's
 * Shipped group and its slip figure reachable without hand-editing a note.
 *
 * The field is prefilled with what the note STATES and never with today: a dialog that
 * opened holding a date the note does not have would write one on a confirm nobody meant
 * as an entry. `DateFieldSpec.value`'s own contract, kept rather than improved on.
 *
 * `validate` refuses nothing, deliberately. A native date input hands back `YYYY-MM-DD` or
 * `''` and nothing else, so there is no malformed entry to catch — and a date in the
 * future is odd rather than wrong (a release recorded ahead of its own announcement), which
 * is not this dialog's to arbitrate: `ValuePromptModal`'s own "guides rather than
 * arbitrates" applies to every prompt in that file.
 */
export function editReleaseReleased(view: ReleaseView, release: ReleaseRow): void {
	const key = view.settings.releasedDateKey;
	const current = release.released.value;
	new SchedulePromptModal(view.app, {
		heading: t('release.scope.releasedTitle', { name: release.name }),
		description: t('release.scope.releasedHint'),
		// One field, named by the KEY it writes — `scheduleFields`' own choice
		// (`interactions/plan.ts`), and what `prompt.clearDate` names in its tooltip.
		fields: [{ field: 'released', name: key, value: current === null ? '' : formatCivil(current) }],
		validate: () => null,
		// `CLOSE_BUTTON` here too, and not only on the submitting exit below: the control this
		// dialog was opened from can be gone by the time it CLOSES without writing anything.
		// An external edit clearing the date mid-dialog makes `Mark as released` offered, and
		// `drawReleased` then draws nothing — so a cancel found no `.pbl-rel-released` and put
		// the reader on the body, which is the same defect the write path was fixed for and
		// the same neighbour repairs it (found by review, Codex, PR #221). The general
		// focus-handle restore cannot cover it: the modal held focus across that redraw, so
		// `focusedHandle` correctly answered null.
		onClosed: () => focusControl(view, RELEASED_BUTTON, CLOSE_BUTTON),
		onSubmit: (values) =>
			// `values.released` and not `?? ''`: the modal submits the fields it was GIVEN, and
			// this one gave it exactly one — a fallback here is a branch nothing can take.
			void save(view, releaseReleasedWrites(release.item.file, key, current, values.released), RELEASED_BUTTON, CLOSE_BUTTON),
	}).open();
}

/**
 * Apply a batch and put focus back on the control that opened it — its three callers'
 * controls are the status chip, the description's line and the released date's own button,
 * which is why `control` is a parameter rather than a constant here.
 *
 * `FOCUS_HANDLE_CLASSES` covers neither of the two shapes that reach this: a MENU pick
 * (the comment at the Set-status entries above), and a DIALOG — `TextPromptModal` CLOSES
 * before it submits, so by the time the write's own
 * redraw runs, focus is already off this view entirely and `focusedHandle` correctly
 * answers null. `focusNewRelease` (`newRelease.ts`) has the identical shape for the
 * identical reason — looked up FRESH after the await, never captured, because the redraw
 * replaced the element the press was on.
 *
 * What it cannot promise is the same as there: it wins the refresh that lands inside the
 * await, and a vault refreshing on its own schedule afterwards takes focus to the body
 * again. A batch that wrote NOTHING redraws nothing, so the line the reader pressed is
 * still on screen and still focused — this call finds that same element and no-ops.
 *
 * `fallback` is `focusControl`'s own — passed through rather than decided here, since this
 * function does not know which of its three callers' controls can vanish with the write it
 * just caused.
 */
async function save(view: ReleaseView, writes: ReleaseWrite[], control: string, fallback?: string): Promise<void> {
	await view.applyRelease(writes);
	focusControl(view, control, fallback);
}

/**
 * The destination, looked up FRESH on every call — `focusNewRelease`'s own rule and for the
 * same reason: what a write's refresh replaces is the ELEMENT, so a captured one is a
 * detached node by the time focus reaches it.
 *
 * Two callers, and the second is what review found (Codex, PR #211): `save` covers the exits
 * that WRITE, and each of these three dialogs has a second exit that does not. Escape and
 * the close control never reach `onSubmit`, so a cancelled prompt left focus on
 * `document.body` — worst on the status prompt, whose opening control is a menu item that no
 * longer exists by then, but true of all three. `onClosed` is that exit. It fires on the
 * submitting one too, BEFORE `onSubmit`, so on that path this call is the one that loses:
 * the redraw inside the await replaces the element it found, and `save`'s own refocus after
 * the await is what holds.
 *
 * `fallback` is `render/rows.ts`'s own class of defect, on this screen rather than a fold:
 * clearing the released date can make `Mark as released` offered again, and
 * `renderScope.ts`'s `drawReleased` withholds `RELEASED_BUTTON` on exactly that condition
 * — the control the reader just pressed is gone with the frame, same as `renderChevron`'s
 * button, and `refocus` (`shelfControls.ts`) is the shape this follows rather than a
 * general mechanism: a stable neighbour, never the body. Unlike a fold's pane, this
 * header has no single composite to fall back to, so the neighbour is the specific control
 * that now covers the field — `Mark as released` — passed in by the one caller whose
 * control can vanish, rather than guessed at here for controls that never do.
 */
function focusControl(view: ReleaseView, control: string, fallback?: string): void {
	const target = view.viewEl.querySelector<HTMLElement>(control) ?? (fallback ? view.viewEl.querySelector<HTMLElement>(fallback) : null);
	target?.focus({ preventScroll: true });
}
