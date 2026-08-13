// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { flush, Harness, makeView, submitButton, useViewHarness } from '../helpers/view';
import { laneCountOf, laneNames, lanesOf } from '../helpers/roadmap';

useViewHarness();

/**
 * An absence on screen: a blocked stretch in one resource's row and nowhere else.
 *
 * Its own file rather than a block in `resourceLanes.test.ts`, whose subject is the row
 * over the grid it derives from. What is different here is the second SOURCE a row draws
 * from — a thing that is not a work item at all, so nothing in that file's vocabulary
 * (a bar, a card, a count) describes one.
 */

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Alice away.md', {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}

function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	return harness;
}

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
		await flush();

		expect(vault.files.size).toBe(before);
	});
});
