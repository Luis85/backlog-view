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

	// Both tiers get the same total from TS. That is NOT the same claim as the drawn
	// columns lining up, and for a while it was true while they sheared by 102px: jsdom
	// computes no layout, so this reads the `--pbl-cell-w` values written to the elements
	// and never the widths they render at. What turns equal numbers into equal columns is
	// `box-sizing: border-box` — `test/view/timelineBoxing.test.ts` refuses its deletion,
	// and only a browser can confirm the result.
	it('gives both tiers the same total width in the values it writes', () => {
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

	it('still draws the today line itself, unlabeled — the legend names its colour now', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		expect(containerEl.querySelector('.pbl-today')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-today-label')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-band')).toBeNull();
	});
});

describe('row tracking', () => {
	it('stripes alternate rows from the render pass', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.classList.contains('pbl-row-even'))).toEqual([false, true, false]);
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
		// SIX, not twelve: `.pbl-bar.pbl-bar-milestone` carries `translateX(-50%)`, so the
		// 12px diamond drawn at `--pbl-bar-left` occupies [left − 6, left + 6] and its
		// right edge — the thing a label has to clear — is 6px past that number, not 12.
		// Placing from `--pbl-bar-left` plus the full width left the label a diamond's
		// width further out than the reserve intends.
		const gap =
			parseFloat(label.style.getPropertyValue('--pbl-label-left')) -
			parseFloat(bar.style.getPropertyValue('--pbl-bar-left'));
		expect(gap).toBe(6);
	});

	it('flips a milestone label to the diamond\'s own left edge, not across its left half', () => {
		const vault = new FakeVault();
		// Dated late enough in the window that no reserve fits after it, so the label
		// flips — and far enough from the left edge that it is not dropped instead.
		// `--pbl-label-right` is measured from the track's right edge, so the label's
		// right edge lands at trackWidth − right: taking `--pbl-bar-left` there put it
		// at the diamond's CENTRE, i.e. across the left half of the mark it labels.
		vault.addFile('Cutover.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-15', due: '2030-06-15' } });
		const { view, containerEl } = datedRoadmap(vault);
		view.setZoom('quarter');
		const bar = containerEl.querySelector<HTMLElement>('.pbl-bar-milestone');
		const label = containerEl.querySelector<HTMLElement>('.pbl-bar-label-before');
		if (!bar || !label) throw new Error('no milestone diamond, or no before-label');
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window on the snapshot');
		const labelRightEdge = window.days * 2 - parseFloat(label.style.getPropertyValue('--pbl-label-right'));
		expect(labelRightEdge).toBe(parseFloat(bar.style.getPropertyValue('--pbl-bar-left')) - 6);
	});

	it('draws no bar label at all on a track shorter than twice the reserve', () => {
		// The case `renderBarLabel`'s comment used to omit, and the one that needs no
		// clipping and no `MAX_TIMELINE_DAYS` clamp to reach: `LABEL_RESERVE_PX` is a
		// PIXEL budget and the track is days × dayPx. A backlog spanning days around
		// today pads to ~3 months, which at quarter zoom (2px/day) is under 200px wide —
		// narrower than the 160px reserve on either side — so every bar in it fails both
		// halves of the test and the feature is simply absent at that zoom.
		const vault = new FakeVault();
		const soon = new Date();
		soon.setDate(soon.getDate() + 3);
		const due = soon.toISOString().slice(0, 10);
		vault.addFile('Near term.md', { frontmatter: { type: 'PBI', order: 10, due } });
		const { view, containerEl } = datedRoadmap(vault);
		// The same bar in the same window DOES get its label at month zoom, so what the
		// quarter case loses is the zoom and not the fixture.
		expect(containerEl.querySelector('.pbl-bar-label')).not.toBeNull();
		view.setZoom('quarter');
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window on the snapshot');
		expect(window.days * 2).toBeLessThan(320); // 2 × LABEL_RESERVE_PX
		expect(containerEl.querySelector('.pbl-bar-label')).toBeNull();
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

/**
 * A bar states its workflow state as a COLOUR: `pbl-state-N`, or green for done. No chip
 * is rendered on this projection (`renderStateChip`'s only call site is the tree, and
 * `chipProps` skips the state property), so before `stateNote` the colour was the whole
 * of it — nothing at all for a screen reader, and colour alone for a reader who cannot
 * separate the slots (WCAG 1.4.1). The words are hidden text in the row's own content,
 * because the row's accessible name is content-derived and an `aria-label` would replace
 * the badge and title rather than add to them.
 */
describe('workflow state on the dated axis', () => {
	function statefulVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Rollout.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'Active', start: '2026-08-04', due: '2026-08-20' },
		});
		vault.addFile('Shipped.md', {
			frontmatter: { type: 'PBI', order: 20, status: 'Done', start: '2026-08-10', due: '2026-09-01' },
		});
		vault.addFile('Cutover.md', {
			frontmatter: { type: 'Milestone', order: 30, status: 'Active', start: '2026-09-15', due: '2026-09-15' },
		});
		return vault;
	}

	function statefulRoadmap() {
		const harness = makeView(statefulVault(), { ...DATE_AXIS, stateProperty: 'note.status' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		return harness.containerEl;
	}

	function timelineRow(containerEl: HTMLElement, title: string): HTMLElement {
		const row = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row')).find(
			(r) => r.querySelector('.pbl-card-title')?.textContent === title,
		);
		if (!row) throw new Error(`no timeline row for ${title}`);
		return row;
	}

	const words = (row: HTMLElement) => row.querySelector<HTMLElement>('.pbl-sr-only')?.textContent ?? null;

	it('puts the state in each row, in words as well as in the bar colour', () => {
		const containerEl = statefulRoadmap();
		const row = timelineRow(containerEl, 'Rollout');

		// The colour is still drawn — this adds a carrier, it does not replace one.
		expect(row.className).toMatch(/pbl-state-\d/);
		expect(words(row)).toBe('Active');
		// And not as a visible chip: the row is a lead column and a track, deliberately.
		expect(row.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('says done in words too, which is otherwise a class and a green bar', () => {
		const containerEl = statefulRoadmap();
		const row = timelineRow(containerEl, 'Shipped');

		expect(row.classList.contains('pbl-done')).toBe(true);
		expect(words(row)).toBe('Done — done');
	});

	it('folds the state into a marker row, whose explicit label replaces its content', () => {
		const containerEl = statefulRoadmap();

		// The name is the whole of what a marker row announces, so hidden text inside it
		// would be dropped: the words have to be in the label itself.
		expect(timelineRow(containerEl, 'Cutover').getAttribute('aria-label')).toBe(
			'Cutover — Milestone 2026-09-15 — Active',
		);
	});

	it('says nothing where there is no workflow property to say anything about', () => {
		const { view, containerEl } = makeView(statefulVault(), DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		// No `stateKey`: every `stateValue` is null and no bar carries a state colour, so
		// there is no fact here that colour alone is carrying.
		expect(words(timelineRow(containerEl, 'Rollout'))).toBeNull();
	});
});
