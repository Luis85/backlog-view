import { Menu } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseIndex, releaseStatusChoices, ReleaseRow } from '../../domain/releases';
import { releaseDescriptionWrites, releaseStatusWrites } from '../../domain/releaseWritePlan';
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
	openTextPrompt(view.app, {
		title: t('release.scope.descriptionTitle', { name: release.name }),
		fieldName: t('release.option.description'),
		placeholder: t('release.scope.descriptionPlaceholder'),
		ctaLabel: t('release.scope.descriptionSave'),
		initial: current ?? '',
		onSubmit: (text) => void view.applyRelease(releaseDescriptionWrites(release.item.file, view.settings.descriptionKey, current, text)),
	});
}
