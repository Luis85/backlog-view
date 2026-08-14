// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Modal, Notice } from '../helpers/obsidian-mock';
import { flush, refresh, submitButton, useViewHarness } from '../helpers/view';
import { barFor, laneCountOf, laneNames, laneRoadmap, lanesOf } from '../helpers/roadmap';
import { absenceVault } from '../helpers/resources';
import { cardDrag } from '../helpers/dnd';

useViewHarness();

/**
 * An absence on screen: a blocked stretch in one resource's row and nowhere else.
 *
 * Its own file rather than a block in `resourceLanes.test.ts`, whose subject is the row
 * over the grid it derives from. What is different here is the second SOURCE a row draws
 * from — a thing that is not a work item at all, so nothing in that file's vocabulary
 * (a bar, a card, a count) describes one.
 */

/**
 * Every drawn line of the band, in order — `laneOrder`'s shape with the one distinction
 * that helper cannot make, since an absence row is not a bar row and its title is not a
 * card's.
 */
function bandOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row');
	return Array.from(rows).map((el) => {
		const title = el.querySelector('.pbl-card-title')?.textContent ?? '';
		if (el.classList.contains('pbl-lane-head')) return `lane:${el.querySelector('.pbl-lane-name')?.textContent}`;
		return el.classList.contains('pbl-absence-row') ? `away:${title}` : title;
	});
}

describe('an absence on the resources axis', () => {
	it('draws in its own resource’s band, above that row’s work', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// Absences lead the band: an unavailable stretch is a fact about the ROW, and the
		// work in it reads against that rather than the other way round.
		expect(bandOrder(containerEl)).toEqual(['lane:Alice', 'away:Alice away', 'Work', 'lane:Bob']);
	});

	it('is positioned by the same date math a bar is', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const bar = containerEl.querySelector<HTMLElement>('.pbl-timeline-row .pbl-bar');
		const away = containerEl.querySelector<HTMLElement>('.pbl-absence');

		// Both offsets are days×dayPx from the same window origin, so a stretch that starts
		// three days after the bar sits three days to its right — asserted as the CSS
		// custom properties, since jsdom lays nothing out.
		const barLeft = Number.parseFloat(bar?.style.getPropertyValue('--pbl-bar-left') ?? '');
		const awayLeft = Number.parseFloat(away?.style.getPropertyValue('--pbl-bar-left') ?? '');
		expect(Number.isFinite(awayLeft)).toBe(true);
		// The absence starts three days after the work does, at the scale's own day width.
		expect(awayLeft - barLeft).toBe(3 * 4);
		// Three days inclusive, the same span arithmetic a bar's own width uses.
		expect(away?.style.getPropertyValue('--pbl-bar-width')).toBe(`${3 * 4}px`);
	});

	it('says whose row it is in and which days it covers', () => {
		// The mark is a plain div, where ARIA prohibits a name, so the ROW carries it — and
		// a reader who cannot see the stretch has nothing else on the line that says either.
		const { containerEl } = laneRoadmap(absenceVault());
		const row = containerEl.querySelector<HTMLElement>('.pbl-absence-row');

		expect(row?.getAttribute('aria-label')).toBe('Alice away — unavailable 2026-08-04 → 2026-08-06');
		expect(row?.getAttribute('aria-description')).toBe('Assigned to Alice');
	});

	it('gives a resource nothing else names a row of its own', () => {
		const vault = absenceVault();
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-02', due: '2026-08-03' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(laneNames(containerEl)).toEqual(['Alice', 'Bob', 'Quinn']);
	});

	it('stacks rather than packing: one line each, and the band grows', () => {
		// 4a. Two overlapping absences in one row draw as two lines — no lane-packing, no
		// second column, nothing moved aside to avoid the other.
		const vault = absenceVault();
		vault.addFile('Also away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-05', due: '2026-08-08' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(bandOrder(containerEl)).toEqual([
			'lane:Alice',
			'away:Alice away',
			'away:Also away',
			'Work',
			'lane:Bob',
		]);
	});

	it('counts for nothing on the header, and takes no stripe', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// Result bars only, the rule a context row already keeps.
		expect(laneCountOf(lanesOf(containerEl)[0])).toBe('1');
		// The stripe alternates over WORK rows: an absence is furniture of the row, so the
		// one work row beneath it is still the first of its band.
		expect(containerEl.querySelector('.pbl-absence-row')?.classList.contains('pbl-row-even')).toBe(false);
		expect(containerEl.querySelectorAll('.pbl-row-even')).toHaveLength(0);
	});

	it('is one element of its band like every other line, and takes the drop as one', async () => {
		// Stated from the RULE rather than from the list of element kinds that existed when
		// it was written, which is exactly how this broke: the band has no container to
		// wire, so it is a list of siblings, and an absence stretch joined the list by
		// drawing and not by belonging. Every line of Bob's band is driven, so a fifth kind
		// fails this rather than joining quietly.
		const vault = absenceVault();
		vault.addFile('Bob away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: '2026-08-04', due: '2026-08-06' },
		});
		vault.addFile('Bob work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Bob', start: '2026-08-02', due: '2026-08-03' },
		});
		const { containerEl } = laneRoadmap(vault);
		const band = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row')).filter(
			(el) => el.getAttribute('aria-description') === 'Assigned to Bob' || el.querySelector('.pbl-lane-name')?.textContent === 'Bob',
		);
		// The header, the absence stretch and Bob's own work row — three lines, no fewer.
		expect(band).toHaveLength(3);

		for (const line of band) {
			vault.fm('Work.md')['assignee'] = 'Alice';
			cardDrag(barFor(containerEl, 'Work'), line);
			await flush();
			expect(vault.fm('Work.md')['assignee']).toBe('Bob');
		}
	});

	it('grows the window to hold itself, in a row nothing else draws in', () => {
		// The window was every drawn BAR and an absence is not one, so a stretch beyond the
		// bars' reach was clamped to the edge and painted on a day it does not cover. Worst
		// exactly here — a row minted BY an absence holds no bar, so nothing it exists to
		// draw had any say in the window it is drawn against.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-11-04', due: '2026-11-20' },
		});
		const { containerEl } = laneRoadmap(vault);
		const away = containerEl.querySelector<HTMLElement>('.pbl-absence');

		// 17 days inclusive, at the scale's own day width — the true span, not the one-day
		// stripe a clamp leaves. And nothing about it says "beyond what is drawn", because
		// the window now reaches it.
		expect(away?.style.getPropertyValue('--pbl-bar-width')).toBe(`${17 * 4}px`);
		expect(away?.className).toBe('pbl-absence');
	});

	it('says "beyond what is drawn" where the grid refuses to reach it', () => {
		// The window grows to hold an absence now, so the only thing that can still put one
		// outside it is `MAX_TIMELINE_DAYS` — a plan too long to draw whole, clamped around
		// today. That case is rarer than it was and not gone, which is why the mark reads
		// its own geometry rather than resting on the window fix: a filled stripe on a
		// calendar claims THESE are the days, exactly as a bar does.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
		});
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2031-01-04', due: '2031-01-20' },
		});
		vault.addFile('Early away.md', {
			frontmatter: { type: 'Absence', assignee: 'Early', start: '2020-02-01', due: '2020-02-10' },
		});
		const { containerEl } = laneRoadmap(vault);
		const marks = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-absence'));

		// Past the far edge and past the near one — the same open-end vocabulary a bar wears,
		// so the direction it lies in is still readable.
		expect(marks.map((el) => el.className)).toEqual([
			'pbl-absence pbl-bar-outside pbl-bar-open-end',
			'pbl-absence pbl-bar-outside pbl-bar-open-start',
		]);
	});

	it('marks a stretch the window cuts through as running past whichever edge it crosses', () => {
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
		});
		// One straddling the clamped window's far end, one its near end — each has an end
		// inside the grid and an end past it, in opposite directions.
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-01', due: '2031-01-20' },
		});
		vault.addFile('Early away.md', {
			frontmatter: { type: 'Absence', assignee: 'Early', start: '2020-02-01', due: '2026-08-20' },
		});
		const { containerEl } = laneRoadmap(vault);
		const marks = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-absence'));

		expect(marks.map((el) => el.className)).toEqual([
			'pbl-absence pbl-bar-open-end pbl-bar-clipped-end',
			'pbl-absence pbl-bar-open-start',
		]);
	});

	it('draws nothing at all with one date property configured', () => {
		// 4d, at the surface: not a one-ended bar from the key that survives.
		const { containerEl } = laneRoadmap(absenceVault(), { targetProperty: null });

		expect(containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-absence-row')).toHaveLength(0);
	});

	it('never draws on the other two axes', () => {
		const harness = laneRoadmap(absenceVault(), { horizonProperty: 'note.horizon' });

		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		harness.view.setAxisPick('horizons');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
	});
});

/** The header's own Add button for a row, or null where the control is withheld. */
function addButton(containerEl: HTMLElement, name: string): HTMLButtonElement | null {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	return head?.querySelector<HTMLButtonElement>('.pbl-lane-absence-add') ?? null;
}

/**
 * Fill the open absence prompt and submit it — `submitPrompt`'s shape over this form's
 * own four fields. Returns whether the prompt CLOSED: a refusal keeps it open with the
 * values in place, which is the whole of what 2a and 2b promise, so a test asserting the
 * refusal has to be able to see it rather than only the absence of a write.
 */
function submitAbsence(fields: { resource?: string; title: string; start: string; target: string }): boolean {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	const values = [fields.resource, fields.title, fields.start, fields.target];
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
		expect(submitAbsence({ title: 'Conference', start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		const fm = vault.fm('docs/absences/Conference.md');
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
		submitAbsence({ resource: 'Quinn', title: 'Conference', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('docs/Conference.md')['assignee']).toBe('Quinn');
	});

	it('files it in the home folder when it has no folder of its own', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: 'notes' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ title: 'Conference', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('notes/Conference.md')['type']).toBe('Absence');
	});

	it('is blocked by the config gate, exactly as every other write', () => {
		const { containerEl } = laneRoadmap(absenceVault(), { orderProperty: 'note.parent' });

		addButton(containerEl, 'Alice')?.click();

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('writes nothing for a blank field or a reversed range', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		const before = vault.files.size;

		addButton(containerEl, 'Alice')?.click();
		// 2b: caught at the prompt, which stays open — there is no shelf for a written
		// absence to land on, so there would be no surface to show the mistake afterwards.
		expect(submitAbsence({ title: 'Away', start: '2026-09-04', target: '2026-09-01' })).toBe(false);
		// 2a: a range needs both ends stated.
		expect(submitAbsence({ title: 'Away', start: '2026-09-04', target: '' })).toBe(false);
		// And a resource: a stretch nobody is away for has no row to draw in.
		expect(submitAbsence({ resource: '', title: 'Away', start: '2026-09-04', target: '2026-09-05' })).toBe(false);
		// And a title: it is the note's own name, so there is nothing to file without one.
		// The resource is restated because the form KEEPS what the last attempt left in it —
		// without it this line re-refuses the blank resource above and says nothing about the
		// title at all, which is what it did until the missing statement showed up in coverage.
		expect(submitAbsence({ resource: 'Alice', title: '', start: '2026-09-04', target: '2026-09-05' })).toBe(false);
		await flush();

		expect(vault.files.size).toBe(before);
	});

	it('files it in the vault root when no folder is configured at all', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: '' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ title: 'Conference', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('Conference.md')['type']).toBe('Absence');
	});

	it('reports a write it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vi.spyOn(vault.app.vault, 'create').mockRejectedValue(new Error('disk full'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		addButton(containerEl, 'Alice')?.click();
		submitAbsence({ title: 'Away', start: '2026-09-01', target: '2026-09-04' });
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
		submitAbsence({ title: 'Away', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.files.size).toBe(before);
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});
});

describe('editing a placed absence', () => {
	function openEdit(containerEl: HTMLElement): void {
		containerEl
			.querySelector<HTMLElement>('.pbl-absence-row')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Edit absence')?.click();
	}

	it('opens the SAME form the add flow does, filled with what the stretch says', () => {
		// One form for both acts, so they cannot come to disagree about what an absence is —
		// same fields, same validator, same refusals.
		const { containerEl } = laneRoadmap(absenceVault());

		openEdit(containerEl);

		const inputs = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []);
		expect(inputs.map((i) => i.value)).toEqual(['Alice', 'Alice away', '2026-08-04', '2026-08-06']);
	});

	it('rewrites the days it covers and who it is for, in place', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		expect(submitAbsence({ resource: 'Bob', title: 'Alice away', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		const fm = vault.fm('Alice away.md');
		expect(fm['assignee']).toBe('Bob');
		expect(fm['start']).toBe('2026-08-05');
		expect(fm['due']).toBe('2026-08-09');
		// The same note, edited — not a second one written beside the first.
		expect(vault.files.has('Alice away.md')).toBe(true);
	});

	it('renames the note when the title changes, since the title IS its name', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', title: 'Alice at the offsite', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.has('Alice at the offsite.md')).toBe(true);
		expect(vault.files.has('Alice away.md')).toBe(false);
		// Through Obsidian's own rename, so the frontmatter travels with the note.
		expect(vault.fm('Alice at the offsite.md')['assignee']).toBe('Alice');
	});

	it('refuses a broken range at the form, exactly as adding one does', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		// The prompt stays open with the values in place: a written absence has no shelf to
		// land on, so there would be no surface left to show the mistake on.
		expect(submitAbsence({ title: 'Alice away', start: '2026-08-09', target: '2026-08-04' })).toBe(false);
		await flush();

		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
	});

	it('reports a save it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add('Alice away.md');

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', title: 'Alice away', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not save the absence'))).toBe(true);
	});

	it('writes the frontmatter BEFORE the rename, so a refused write leaves the name alone', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add('Alice away.md');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		// Both halves asked for at once, and the first one refused. Renaming first would move
		// the note and every link naming it, and then fail — leaving a note whose name
		// describes a stretch it does not hold. This way the worst outcome is the one the
		// reader can see and fix: the old name, still saying what the note still says.
		openEdit(containerEl);
		submitAbsence({ resource: 'Bob', title: 'Alice at the offsite', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Alice at the offsite.md')).toBe(false);
		expect(vault.files.has('Alice away.md')).toBe(true);
		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
	});

	it('leaves the note where it is when the title has not changed', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', title: 'Alice away', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		// A rename to the name a note already has is a needless write, and one Obsidian
		// would answer by appending a number.
		expect(vault.files.has('Alice away.md')).toBe(true);
		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-05');
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
		submitAbsence({ resource: 'Alice', title: 'Alice away', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
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
		containerEl
			.querySelector<HTMLElement>('.pbl-absence-row')
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

		expect(vault.trashed).toEqual(['Alice away.md']);
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
