// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Modal, Notice } from '../helpers/obsidian-mock';
import { flush, refresh, submitButton, useViewHarness } from '../helpers/view';
import { laneRoadmap, lanesOf } from '../helpers/roadmap';
import { ALICE_AWAY_PATH, absenceVault } from '../helpers/resources';

useViewHarness();

/**
 * Adding, editing and deleting an absence — the prompt, the menu and what each writes.
 *
 * Split from `resourceAbsences.test.ts` on 2026-08-15, at the line the budget forced and
 * along the seam that was already there: that file is about what a stretch LOOKS like in a
 * band, and everything here is about the three flows that produce and change one. The two
 * shared helpers below came with the flows and are used by nothing over there.
 */
/** The header's own Add button for a row, or null where the control is withheld. */
function addButton(containerEl: HTMLElement, name: string): HTMLButtonElement | null {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	return head?.querySelector<HTMLButtonElement>('.pbl-lane-absence-add') ?? null;
}

/**
 * Fill the open absence prompt and submit it — `submitPrompt`'s shape over this form's own
 * three fields, in DOM order. Returns whether the prompt CLOSED: a refusal keeps it open
 * with the values in place, which is the whole of what 2a and 2b promise, so a test
 * asserting the refusal has to be able to see it rather than only the absence of a write.
 *
 * There is no title among them: the note's name is derived from these three facts
 * (`absenceTitle`), so a caller that could pass one would be describing a form that does
 * not exist.
 */
function submitAbsence(fields: { resource?: string; start: string; target: string }): boolean {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	const values = [fields.resource, fields.start, fields.target];
	inputs.forEach((input, i) => {
		if (values[i] === undefined) return;
		input.value = values[i] as string;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return modal.contentEl.childElementCount === 0;
}

describe('adding an absence', () => {
	it('offers itself on a row header, tabindex -1 like every other per-row control', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const add = addButton(containerEl, 'Alice');

		expect(add).not.toBeNull();
		expect(add?.getAttribute('tabindex')).toBe('-1');
		expect(add?.getAttribute('aria-label')).toBe('Add absence for Alice');
	});

	it('is withheld with only one date property configured', () => {
		// 1a: sharper than the axis's own gate, which accepts either date alone. An
		// absence's range needs both ends written and has nothing beneath it to infer from,
		// so the control is absent rather than opening onto a form that cannot be satisfied.
		const { containerEl } = laneRoadmap(absenceVault(), { targetProperty: null });

		expect(addButton(containerEl, 'Alice')).toBeNull();
	});

	it('writes one note with exactly four facts, and no hierarchy at all', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { 'typeFolder.absence': 'docs/absences' });

		addButton(containerEl, 'Bob')?.click();
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		// The name is derived from the three facts, so the path is a check on the derivation
		// as well as on the folder — and on every character of it surviving `sanitizeTitle`.
		const fm = vault.fm('docs/absences/Bob away 2026-09-01 → 2026-09-04.md');
		expect(fm['type']).toBe('Absence');
		expect(fm['assignee']).toBe('Bob');
		expect(fm['start']).toBe('2026-09-01');
		expect(fm['due']).toBe('2026-09-04');
		// No parent, no order: it is not in the hierarchy and has no rank among anything.
		expect('parent' in fm).toBe(false);
		expect('order' in fm).toBe(false);
	});

	it('takes the resource typed into the prompt, which the row only prefills', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: 'docs' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ resource: 'Quinn', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('docs/Quinn away 2026-09-01 → 2026-09-04.md')['assignee']).toBe('Quinn');
	});

	it('files it where the config says at SUBMIT, not where it said when the form opened', async () => {
		// The same window `refusedByConfig` is re-asked in: Obsidian's options pane stays
		// reachable while a modal is up, and a folder changed there is the reader's newest
		// statement of where absences live. `promptCreateItem` resolves at submit for this
		// reason; the description above the fields is the older answer and says so.
		const vault = absenceVault();
		const harness = laneRoadmap(vault, { 'typeFolder.absence': 'docs/absences' });

		addButton(harness.containerEl, 'Bob')?.click();
		harness.config.values['typeFolder.absence'] = 'docs/away';
		refresh(harness.view, vault);
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.files.has('docs/away/Bob away 2026-09-01 → 2026-09-04.md')).toBe(true);
		expect(vault.files.has('docs/absences/Bob away 2026-09-01 → 2026-09-04.md')).toBe(false);
	});

	it('files it in the home folder when it has no folder of its own', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: 'notes' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('notes/Bob away 2026-09-01 → 2026-09-04.md')['type']).toBe('Absence');
	});

	it('is blocked by the config gate, exactly as every other write', () => {
		const { containerEl } = laneRoadmap(absenceVault(), { orderProperty: 'note.parent' });

		addButton(containerEl, 'Alice')?.click();

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('writes nothing for a blank field or a reversed range', async () => {
		// **The ORDER of these three submissions is load-bearing.** A refusal leaves the form
		// open with what was typed still in it, so each attempt starts from the last one's
		// values — which is why the blank RESOURCE goes last: move it up and the attempts
		// after it inherit an empty resource, so 2a and 2b are refused for the missing name
		// rather than for the reason they claim, and the file check below still passes. Found
		// by coverage rather than by reading, and the class of loss is
		// `docs/issues/A comment that states a rule is not a check.md`.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		const before = vault.files.size;

		addButton(containerEl, 'Alice')?.click();
		// 2b: caught at the prompt, which stays open — there is no shelf for a written
		// absence to land on, so there would be no surface to show the mistake afterwards.
		expect(submitAbsence({ start: '2026-09-04', target: '2026-09-01' })).toBe(false);
		// 2a: a range needs both ends stated.
		expect(submitAbsence({ start: '2026-09-04', target: '' })).toBe(false);
		// And a resource: a stretch nobody is away for has no row to draw in, and it is now
		// also half of what names the note.
		expect(submitAbsence({ resource: '', start: '2026-09-04', target: '2026-09-05' })).toBe(false);
		await flush();

		expect(vault.files.size).toBe(before);
	});

	it('files it in the vault root when no folder is configured at all', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: '' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('Bob away 2026-09-01 → 2026-09-04.md')['type']).toBe('Absence');
	});

	it('reports a write it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vi.spyOn(vault.app.vault, 'create').mockRejectedValue(new Error('disk full'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		addButton(containerEl, 'Alice')?.click();
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not create the absence'))).toBe(true);
	});

	it('re-asks the gate at submit, so a config narrowed under the open form writes nothing', async () => {
		// The render gate withholds the button, but the form outlives the config it opened
		// under: Obsidian's options pane stays reachable while a modal is up. Without the
		// re-check the write below reaches `setOwn(fm, '', ...)` — a key nobody configured.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);
		const before = vault.files.size;

		addButton(harness.containerEl, 'Alice')?.click();
		harness.config.values['targetProperty'] = undefined;
		refresh(harness.view, vault);
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.files.size).toBe(before);
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});
});

describe('editing a placed absence', () => {
	function openEdit(containerEl: HTMLElement): void {
		// The mark, not a row — there is no row any more, and the mark is the only place the
		// context menu is wired (`renderLaneAbsences`).
		containerEl
			.querySelector<HTMLElement>('.pbl-absence')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Edit absence')?.click();
	}

	it('opens the SAME form the add flow does, filled with what the stretch says', () => {
		// One form for both acts, so they cannot come to disagree about what an absence is —
		// same fields, same validator, same refusals. Three fields now: the note's name is
		// derived from them rather than typed beside them.
		const { containerEl } = laneRoadmap(absenceVault());

		openEdit(containerEl);

		const inputs = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []);
		expect(inputs.map((i) => i.value)).toEqual(['Alice', '2026-08-04', '2026-08-06']);
	});

	it('rewrites the days it covers and who it is for, and takes the derived name with it', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		expect(submitAbsence({ resource: 'Bob', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		// The same note, edited and renamed — never a second one written beside the first.
		const fm = vault.fm('Bob away 2026-08-05 → 2026-08-09.md');
		expect(fm['assignee']).toBe('Bob');
		expect(fm['start']).toBe('2026-08-05');
		expect(fm['due']).toBe('2026-08-09');
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(false);
	});

	it('renames the note when the FACTS change, since the facts are what name it', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Alice away 2026-08-05 → 2026-08-09.md')).toBe(true);
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(false);
		// Through Obsidian's own rename, so the frontmatter travels with the note.
		expect(vault.fm('Alice away 2026-08-05 → 2026-08-09.md')['assignee']).toBe('Alice');
	});

	it('names the note the rename actually produced, not the name that was asked for', async () => {
		// `uniqueNotePath` appends a number where the name is taken, so the note the reader is
		// told to look for has to be the one that exists. Rare now that both dates are in the
		// name — which is why the collision is planted rather than waited for, at the name the
		// EDIT will derive rather than at the one the fixture already occupies.
		const vault = absenceVault();
		vault.addFile('Alice away 2026-08-05 → 2026-08-09.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Alice away 2026-08-05 → 2026-08-09 1.md')).toBe(true);
		expect(Notice.messages).toContain('Updated "Alice away 2026-08-05 → 2026-08-09 1".');
	});

	it('leaves a note that already landed on a collided name where it is, edit after edit', async () => {
		// The number is appended ONCE, by the collision. A later edit derives the same name
		// again, so the note's own occupied path must not be read as taken — or every edit
		// after the first ratchets the suffix (`… 1` → `… 2` → `… 3`), rewrites every link
		// naming the note and reports a name the reader did not ask for. The note starts where
		// the first collision already left it, which is the state the ratchet acts on.
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Alice away 2026-08-04 → 2026-08-06.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Alice away 2026-08-04 → 2026-08-06 1.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		// Nothing changed — the same three facts, re-confirmed.
		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.has('Alice away 2026-08-04 → 2026-08-06 1.md')).toBe(true);
		expect(vault.files.has('Alice away 2026-08-04 → 2026-08-06 2.md')).toBe(false);
		expect(Notice.messages).toContain('Updated "Alice away 2026-08-04 → 2026-08-06 1".');
	});

	it('leaves a name that only differs by a character the disk cannot take', async () => {
		// The derived name can still hold one, through the resource: `A:B` sanitizes to `A-B`
		// (`:`, not `/` — a `Resource` is a note now, Task 5, and a literal `/` in its title
		// would be a folder rather than a character to sanitize). Compared raw it reads as a
		// new name, and `uniqueNotePath` then finds the note's own path occupied — renaming
		// it for a character the disk was always going to drop.
		const vault = new FakeVault();
		vault.addFile('A:B.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('A-B away 2026-08-04 → 2026-08-06.md', {
			frontmatter: { type: 'Absence', assignee: 'A:B', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'A:B', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.has('A-B away 2026-08-04 → 2026-08-06.md')).toBe(true);
		expect(vault.files.has('A-B away 2026-08-04 → 2026-08-06 1.md')).toBe(false);
	});

	it('leaves the note where it is when the facts have not changed', async () => {
		// A rename to the name a note already has is a needless write, and one Obsidian would
		// answer by appending a number. The fixture is already at its derived name — which is
		// what a note created by this flow looks like, and is now the only shape it has.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		const before = vault.files.size;

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.size).toBe(before);
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(true);
	});

	it('refuses a broken range at the form, exactly as adding one does', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		// The prompt stays open with the values in place: a written absence has no shelf to
		// land on, so there would be no surface left to show the mistake on.
		expect(submitAbsence({ start: '2026-08-09', target: '2026-08-04' })).toBe(false);
		await flush();

		expect(vault.fm(ALICE_AWAY_PATH)['start']).toBe('2026-08-04');
	});

	it('reports a save it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add(ALICE_AWAY_PATH);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not save the absence'))).toBe(true);
	});

	it('writes the frontmatter BEFORE the rename, so a refused write leaves the name alone', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add(ALICE_AWAY_PATH);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		// Both halves follow from one edit now — new dates mean new frontmatter AND a new
		// name — and the first one is refused. Renaming first would move the note and every
		// link naming it, and then fail, leaving a note whose name describes a stretch it does
		// not hold. This way the worst outcome is the one the reader can see and fix.
		openEdit(containerEl);
		submitAbsence({ resource: 'Bob', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Bob away 2026-08-05 → 2026-08-09.md')).toBe(false);
		expect(vault.files.has(ALICE_AWAY_PATH)).toBe(true);
		expect(vault.fm(ALICE_AWAY_PATH)['start']).toBe('2026-08-04');
	});

	it('refuses an edit whose note was retyped to Resource while the modal was open, and does not rename it', async () => {
		// The race `applyWrites` and `applyPropertyWrites` both close and this writer shares
		// none of their path: the modal opened against Alice's absence, and the note itself
		// is retyped between that open and this submit — exactly what an external edit or
		// another view's own write could do while the form sits open. `updateAbsenceNote`
		// must refuse rather than silently write the assignee and both dates onto a resource,
		// and `editAbsence` must not then rename it — half of what the refusal protects.
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		vault.fm(ALICE_AWAY_PATH)['type'] = 'Resource';
		expect(submitAbsence({ resource: 'Bob', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		// Neither half landed: the frontmatter is exactly what it was retyped to (assignee
		// and dates untouched), and the note kept its old name.
		expect(vault.fm(ALICE_AWAY_PATH)).toEqual({
			type: 'Resource',
			assignee: 'Alice',
			start: '2026-08-04',
			due: '2026-08-06',
		});
		expect(vault.files.has('Bob away 2026-08-05 → 2026-08-09.md')).toBe(false);
		expect(Notice.messages).toContain('That note became a resource while the edit was in flight, so nothing was changed.');
	});

	it('re-asks the gate at submit, exactly as the add flow does', async () => {
		// The edit form outlives the config it opened under for the same reason the add form
		// does — Obsidian's options pane stays reachable while a modal is up — and the write
		// after a narrowing would reach `setOwn(fm, '', ...)`, a key nobody configured.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		openEdit(harness.containerEl);
		harness.config.values['targetProperty'] = undefined;
		refresh(harness.view, vault);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.fm(ALICE_AWAY_PATH)['start']).toBe('2026-08-04');
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});

	it('is blocked by the config gate before it takes any typing', () => {
		const { containerEl } = laneRoadmap(absenceVault(), { orderProperty: 'note.parent' });

		openEdit(containerEl);

		// The gate runs BEFORE the form for `promptAddAbsence`'s reason: taking the reader's
		// typing and then refusing the write leaves them worse off than never opening.
		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});

describe('deleting an absence', () => {
	function openAbsenceMenu(containerEl: HTMLElement): void {
		// The mark, not a row — see `openEdit`'s own comment above.
		containerEl
			.querySelector<HTMLElement>('.pbl-absence')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	}

	it('offers an edit and a delete on the stretch’s own context menu, and nothing else', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		openAbsenceMenu(containerEl);

		// Not `buildItemMenu`: every entry in that menu is about a work item — a type, a
		// state, a parent link, a rank — and an absence has none of them. What it has is the
		// two acts a whole note gets: change it, or take it away.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Edit absence', 'Delete absence']);
	});

	it('removes the note through Obsidian’s own delete, not through the gate', async () => {
		const vault = absenceVault();
		const { view, containerEl } = laneRoadmap(vault);

		openAbsenceMenu(containerEl);
		Menu.lastShown?.item('Delete absence')?.click();
		await flush();

		expect(vault.trashed).toEqual([ALICE_AWAY_PATH]);
		// No batch was captured, so there is nothing for undo to take back — the note was
		// never one of this backlog's write targets.
		expect(vault.writeLog).toEqual([]);
		expect(view.canUndo()).toBe(false);
	});

	it('reports a delete it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vi.spyOn(vault.app.fileManager, 'trashFile').mockRejectedValue(new Error('locked'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		openAbsenceMenu(containerEl);
		Menu.lastShown?.item('Delete absence')?.click();
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not delete the absence'))).toBe(true);
	});
});
