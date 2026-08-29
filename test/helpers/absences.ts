import { Menu, Modal } from './obsidian-mock';
import { lanesOf } from './roadmap';
import { submitButton } from './view';

/**
 * Driving the absence form — the three gestures every absence suite makes.
 *
 * Here rather than in one suite because there are two: `absenceEditing.test.ts` covers the
 * three flows that produce and change an absence, and `absenceRaces.test.ts` covers what
 * each of them REFUSES when the world moves under an open form. That split came at the test
 * budget (450 lines), and copying these three into the second file would be two spellings of
 * one form free to drift while both claim to drive it — the same argument `resources.ts`
 * makes about its vault fixture one directory up.
 */

/** The header's own Add button for a row, or null where the control is withheld. */
export function absenceAddButton(containerEl: HTMLElement, name: string): HTMLButtonElement | null {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	return head?.querySelector<HTMLButtonElement>('.pbl-lane-absence-add') ?? null;
}

/** Open the edit form off a stretch's own context menu. */
export function openAbsenceEdit(containerEl: HTMLElement): void {
	// The mark, not a row — there is no row any more, and the mark is the only place the
	// context menu is wired (`renderLaneAbsences`).
	containerEl.querySelector<HTMLElement>('.pbl-absence')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	Menu.lastShown?.item('Edit absence')?.click();
}

/**
 * Fill the open absence prompt and submit it. Returns whether the prompt CLOSED: a
 * refusal keeps it open with the values in place, which is the whole of what 2a and 2b
 * promise, so a test asserting the refusal has to be able to see it rather than only the
 * absence of a write.
 *
 * `resource` is the offered ID — a note's own path, e.g. `'Bob.md'` — set on the
 * `<select>` with a `change` event, since Task 6 turned this field from typed text into a
 * choice off a closed list; the two date fields stay plain `<input>`s. Omitting `resource`
 * leaves whichever choice the form opened with in place, exactly as leaving a date field
 * untouched does.
 *
 * There is no title among them: the note's name is derived from these three facts
 * (`absenceTitle`), so a caller that could pass one would be describing a form that does
 * not exist.
 */
export function submitAbsence(fields: { resource?: string; start: string; target: string }): boolean {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	if (fields.resource !== undefined) {
		const select = modal.contentEl.querySelector('select') as HTMLSelectElement | null;
		if (select) {
			select.value = fields.resource;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	const values = [fields.start, fields.target];
	inputs.forEach((input, i) => {
		if (values[i] === undefined) return;
		input.value = values[i] as string;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return modal.contentEl.childElementCount === 0;
}
