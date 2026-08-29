import { Menu } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseIndex, releaseStatusChoices, ReleaseRow } from '../../domain/releases';
import { PropertyWrite } from '../../domain/estimationWritePlan';
import { releaseDescriptionWrites, releaseReleasedWrites, releaseStatusWrites } from '../../domain/releaseWritePlan';
import { formatCivil } from '../../domain/timeline';
import { SchedulePromptModal } from '../../ui/prompts';
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
export function showReleaseStatusMenu(view: ReleaseView, evt: MouseEvent, release: ReleaseRow, index: ReleaseIndex): void {
	const key = view.settings.statusKey;
	const current = release.status.value;
	const menu = new Menu();
	for (const choice of releaseStatusChoices(view.settings, index, current)) {
		const writes = releaseStatusWrites(release.item.file, key, current, choice);
		menu.addItem((mi) =>
			mi
				.setTitle(choice)
				.setChecked(writes.length === 0)
				.onClick(() => void view.applyRelease(writes)),
		);
	}
	if (current !== null) {
		menu.addSeparator();
		menu.addItem((mi) =>
			mi
				.setTitle(t('release.scope.clearStatus'))
				.setIcon('eraser')
				.onClick(() => void view.applyRelease(releaseStatusWrites(release.item.file, key, current, null))),
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
		onSubmit: (text) =>
			void save(view, releaseDescriptionWrites(release.item.file, key, current, text), '.pbl-rel-desc'),
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
		onSubmit: (values) =>
			// `values.released` and not `?? ''`: the modal submits the fields it was GIVEN, and
			// this one gave it exactly one — a fallback here is a branch nothing can take.
			void save(view, releaseReleasedWrites(release.item.file, key, current, values.released), '.pbl-rel-released'),
	}).open();
}

/**
 * Apply a dialog's batch and put focus back on the control that opened it — the
 * description's line, or the released date's own button.
 *
 * A dialog is why this exists rather than `FOCUS_HANDLE_CLASSES` covering it like the
 * status chip: `TextPromptModal` CLOSES before it submits, so by the time the write's own
 * redraw runs, focus is already off this view entirely and `focusedHandle` correctly
 * answers null. `focusNewRelease` (`newRelease.ts`) has the identical shape for the
 * identical reason — looked up FRESH after the await, never captured, because the redraw
 * replaced the element the press was on.
 *
 * What it cannot promise is the same as there: it wins the refresh that lands inside the
 * await, and a vault refreshing on its own schedule afterwards takes focus to the body
 * again. A batch that wrote NOTHING redraws nothing, so the line the reader pressed is
 * still on screen and still focused — this call finds that same element and no-ops.
 */
async function save(view: ReleaseView, writes: PropertyWrite[], control: string): Promise<void> {
	await view.applyRelease(writes);
	view.viewEl.querySelector<HTMLElement>(control)?.focus({ preventScroll: true });
}
