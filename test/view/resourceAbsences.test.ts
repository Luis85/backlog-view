// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Harness, makeView, useViewHarness } from '../helpers/view';
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
