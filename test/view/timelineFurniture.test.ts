// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';
import { weekendOffsetDays } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

function furnishedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-20' } });
	vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-10', due: '2026-09-01' } });
	// A Milestone, which is the TYPE `renderMilestoneLines` gates on — a PBI with equal
	// dates draws the diamond but no line and no header label, so the type is what this
	// fixture needs and the equal pair is what makes it a point rather than a span.
	vault.addFile('Gamma.md', { frontmatter: { type: 'Milestone', order: 30, start: '2026-09-15', due: '2026-09-15' } });
	return vault;
}

function datedRoadmap(vault: FakeVault) {
	const harness = makeView(vault, { ...DATE_AXIS }, { collapsed: true });
	harness.view.setProjection('roadmap');
	return harness;
}

function superLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell-super')).map((c) => c.textContent ?? '');
}

function bottomCells(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell:not(.pbl-timeline-cell-super)'));
}

describe('the two-tier header', () => {
	it('draws the coarser tier above the cells, and the year lives up there', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		// Month zoom, the default: years above months.
		expect(superLabels(containerEl).length).toBeGreaterThan(0);
		expect(superLabels(containerEl).every((l) => /^\d{4}$/.test(l))).toBe(true);
		view.setZoom('week');
		// Week zoom: months above weeks, carrying the year the weeks do not.
		expect(superLabels(containerEl).some((l) => /^[A-Z][a-z]{2} \d{4}$/.test(l))).toBe(true);
	});

	it('sizes both tiers to the same total width, so the columns cannot shear', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const sum = (cells: HTMLElement[]) =>
			cells.reduce((n, c) => n + parseFloat(c.style.getPropertyValue('--pbl-cell-w')), 0);
		const supers = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell-super'));
		expect(sum(supers)).toBe(sum(bottomCells(containerEl)));
	});
});

describe('grid rhythm', () => {
	it('extends every interior cell boundary down the grid body', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const cells = bottomCells(containerEl);
		const lines = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-grid-line'));
		// One line per boundary BETWEEN cells: the day-0 boundary is the lead column's border.
		expect(lines.length).toBe(cells.length - 1);
		const firstWidth = parseFloat(cells[0].style.getPropertyValue('--pbl-cell-w'));
		expect(parseFloat(lines[0].style.getPropertyValue('--pbl-grid-left'))).toBe(TIMELINE_LEAD_PX + firstWidth);
	});

	it('shades weekends at week zoom alone, phased to the first Saturday', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		expect(containerEl.querySelector('.pbl-weekend-layer')).toBeNull(); // month, the default
		view.setZoom('week');
		const layer = containerEl.querySelector<HTMLElement>('.pbl-weekend-layer');
		if (!layer) throw new Error('no weekend layer at week zoom');
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window on the snapshot');
		expect(layer.style.getPropertyValue('--pbl-weekend-offset')).toBe(`${weekendOffsetDays(window) * 16}px`);
		view.setZoom('quarter');
		expect(containerEl.querySelector('.pbl-weekend-layer')).toBeNull();
	});

	it('names the today line in the header, at the line’s own offset', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		const label = containerEl.querySelector<HTMLElement>('.pbl-today-label');
		if (!label) throw new Error('no today label');
		expect(label.textContent).toBe('Today');
		const trackLeft = parseFloat(label.style.getPropertyValue('--pbl-today-left'));
		expect(TIMELINE_LEAD_PX + trackLeft).toBe(view.roadmap?.todayLeft ?? -1);
	});

	it('gives the today pill a strip nothing else draws in', () => {
		// The pill is opaque and placed by a day offset, so anything else it shares a
		// strip with can end up underneath it: a milestone dated today in the cell
		// tier, or — since the bottom tier drops the year — the super tier's `2026`
		// when today falls near a super cell's start. Its own band is the whole rule.
		const { containerEl } = datedRoadmap(furnishedVault());
		const band = containerEl.querySelector<HTMLElement>('.pbl-timeline-band');
		if (!band) throw new Error('no today band');
		expect(band.children).toHaveLength(1);
		expect(band.firstElementChild?.classList.contains('pbl-today-label')).toBe(true);
		const milestone = containerEl.querySelector<HTMLElement>('.pbl-milestone-label');
		expect(milestone?.parentElement?.classList.contains('pbl-timeline-band')).toBe(false);
	});
});

describe('row tracking', () => {
	it('stripes alternate rows from the render pass', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.classList.contains('pbl-row-even'))).toEqual([false, true, false]);
	});

	it('marks the grid once it is scrolled, so the lead column can carry its edge', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('no timeline scroller');
		scroller.scrollLeft = 120;
		scroller.dispatchEvent(new Event('scroll'));
		expect(scroller.classList.contains('pbl-scrolled-x')).toBe(true);
		scroller.scrollLeft = 0;
		scroller.dispatchEvent(new Event('scroll'));
		expect(scroller.classList.contains('pbl-scrolled-x')).toBe(false);
	});
});
