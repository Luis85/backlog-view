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
		// The band also has to be the FIRST strip, not merely an exclusive one: moving its
		// creation below the two tier tracks would leave it holding only the pill and still
		// stack it under the cells, which is what "own strip" is for.
		const tiers = band.parentElement;
		if (!tiers) throw new Error('no tiers wrapper');
		expect(tiers.firstElementChild).toBe(band);
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

describe('bar labels', () => {
	it('labels the bar where the eye is, flipping sides at the window edge', () => {
		const vault = new FakeVault();
		// Far enough out that the real clock cannot move the window edge: the free
		// room right of the bar is 46 days (Jun 15 → Jul 31 2030, the padding month).
		vault.addFile('Far off.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-01', due: '2030-06-15' } });
		const { view, containerEl } = datedRoadmap(vault);

		// Month zoom: 46 days × 4px = 184px ≥ the 160px reserve — label after the bar.
		const label = () => containerEl.querySelector<HTMLElement>('.pbl-bar-label');
		expect(label()?.textContent).toBe('Far off');
		expect(label()?.getAttribute('aria-hidden')).toBe('true');
		expect(label()?.classList.contains('pbl-bar-label-after')).toBe(true);

		// Quarter zoom: 46 × 2px = 92px < 160 — the label flips before the bar.
		view.setZoom('quarter');
		expect(label()?.classList.contains('pbl-bar-label-before')).toBe(true);
	});

	it('clears the mark the stylesheet draws, not the one the span implies', () => {
		const vault = new FakeVault();
		// A milestone: one day of span, so 4px of --pbl-bar-width — and a 12px diamond
		// on screen. Measuring the span would start the title inside the mark. Both
		// ends stated, because that is what `barGeometry` requires of a milestone: an
		// end borrowed from a lone `due` is a one-day BAR and never reaches this branch.
		vault.addFile('Ship it.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-15', due: '2030-06-15' } });
		const { containerEl } = datedRoadmap(vault);
		const bar = containerEl.querySelector<HTMLElement>('.pbl-bar-milestone');
		const label = containerEl.querySelector<HTMLElement>('.pbl-bar-label-after');
		if (!bar || !label) throw new Error('no milestone diamond, or no after-label');
		const gap =
			parseFloat(label.style.getPropertyValue('--pbl-label-left')) -
			parseFloat(bar.style.getPropertyValue('--pbl-bar-left'));
		expect(gap).toBe(12);
	});

	it('drops the label rather than placing it off the track', () => {
		const vault = new FakeVault();
		// Clipped at both window edges: no room after, and flipping it before a bar
		// starting at day 0 would set --pbl-label-right to the whole track width and
		// park the label behind the sticky lead. The lead already shows the title.
		vault.addFile('Whole plan.md', { frontmatter: { type: 'PBI', order: 10, start: '2020-01-01', due: '2040-01-01' } });
		const { containerEl } = datedRoadmap(vault);
		expect(containerEl.querySelector('.pbl-bar')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-bar-label')).toBeNull();
	});
});
