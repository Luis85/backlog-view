// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { gridDrag, overlayOf } from '../helpers/dnd';
import { gripOf, markFor, rowFor } from '../helpers/roadmap';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';
import { readDate, todayStamp } from '../../src/domain/noteFields';
import { addDays, formatCivil, MAX_TIMELINE_DAYS, MIN_BAR_PX, weekendOffsetDays } from '../../src/domain/timeline';

useViewHarness();

/** Offset from the REAL clock, so a fixture cannot drift out of the case it states. */
const TODAY = readDate(todayStamp()).value;
if (TODAY === null) throw new Error('todayStamp() did not parse as a date');

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

	it('hides the tiers from assistive tech without hiding the control beside them', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const grip = containerEl.querySelector<HTMLElement>('.pbl-timeline-lead-grip');
		if (!grip) throw new Error('no lead resize grip in the header');
		// The cell tiers are decoration and say so; the header around them is not, since
		// the lead cell carries the resize grip. `aria-hidden` on the header would take
		// the grip's role, its labels and its tab stop out of the accessibility tree with
		// the decoration — an aria-hidden ANCESTOR removes every focusable descendant, and
		// nothing the grip states about itself can undo it. So this is asked of the
		// ancestors, which is the relationship that does the damage; the grip's own
		// attributes are `timelineLeadResize.test.ts`'s subject and pass either way.
		expect(grip.closest('[aria-hidden="true"]')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-tiers')?.getAttribute('aria-hidden')).toBe('true');
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
	it('stripes alternate rows from the render pass, counting the milestones’ header as none', () => {
		// Three results and two rows: the marker among them draws in the milestones' shared
		// header instead. The header is chrome and never reaches the counter — counting it
		// would flip the parity of every work row beneath it.
		const { containerEl } = datedRoadmap(furnishedVault());
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBe(2);
		expect(rows.map((r) => r.classList.contains('pbl-row-even'))).toEqual([false, true]);
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

	it('gives the title its own child span, not text on the label div directly', () => {
		// `label()?.textContent` above passes whether the title is a bare text node, a
		// span, or a span three levels deep — reverting `renderBarLabel` to
		// `createDiv({ cls: 'pbl-bar-label', text: bar.item.title })` turns nothing red
		// there. This is the structural check that would: `.pbl-bar-label` became a flex
		// row so `.pbl-days-lost` (`drawBandCollision`) could be appended as a SECOND
		// child beside the title without the two running together or one evicting the
		// other, and that only works if the title is its own element in the first place.
		const vault = new FakeVault();
		vault.addFile('Far off.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-01', due: '2030-06-15' } });
		const { containerEl } = datedRoadmap(vault);

		const title = containerEl.querySelector<HTMLElement>('.pbl-bar-label-title');
		expect(title, 'no .pbl-bar-label-title element at all').not.toBeNull();
		expect(title?.textContent).toBe('Far off');
		expect(title?.parentElement?.classList.contains('pbl-bar-label')).toBe(true);
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

	/**
	 * The same arithmetic the milestone case above does, asked of a named row: how far
	 * an after-label starts from its bar's own `--pbl-bar-left`, which is the mark's
	 * drawn width (plus the diamond's half-width correction, where one is drawn).
	 */
	function labelGap(containerEl: HTMLElement, title: string): number {
		const row = rowFor(containerEl, title);
		const bar = row?.querySelector<HTMLElement>('.pbl-bar');
		const label = row?.querySelector<HTMLElement>('.pbl-bar-label-after');
		if (!bar || !label) throw new Error(`no bar, or no after-label, on the row for ${title}`);
		return (
			parseFloat(label.style.getPropertyValue('--pbl-label-left')) -
			parseFloat(bar.style.getPropertyValue('--pbl-bar-left'))
		);
	}

	it('clears the 10px arrow an outside bar draws, not the day it was clamped to', () => {
		// The second of the three shapes: nothing of this span is in the window, so
		// `barClasses` returns early with `.pbl-bar-outside` — a fixed 10px arrow at the
		// edge, whatever `--pbl-bar-width` says. Measuring the clamped span instead would
		// start the title 4px along, inside the arrow it is naming.
		//
		// Dated off the REAL clock, at exactly the cap: `timelineWindow` clamps to
		// `MAX_TIMELINE_DAYS` around today, so a note that far back lies wholly before
		// the window's start and cannot drift back into view as the clock moves.
		const vault = new FakeVault();
		vault.addFile('Long gone.md', { frontmatter: { type: 'PBI', order: 10, due: formatCivil(addDays(TODAY, -MAX_TIMELINE_DAYS)) } });
		const { containerEl } = datedRoadmap(vault);

		expect(containerEl.querySelector('.pbl-bar-outside')).not.toBeNull();
		expect(labelGap(containerEl, 'Long gone')).toBe(10); // OUTSIDE_MARK_PX
	});

	it('clears the floor a hairline bar is drawn at, not the pixels its one day buys', () => {
		// The third shape, and the floor rather than the shape: an ordinary one-day bar
		// at quarter zoom is 2px of span and draws at `MIN_BAR_PX`, so a label placed
		// from the product lands 2px inside the bar it labels.
		//
		// Two notes, both offset from the real clock: the far one only stretches the
		// window, so that at 2px/day there is still a reserve's worth of track after the
		// near one — on a short track `renderBarLabel` draws no label at all, which is
		// the sibling case below.
		const vault = new FakeVault();
		vault.addFile('One day.md', { frontmatter: { type: 'PBI', order: 10, due: formatCivil(addDays(TODAY, 10)) } });
		vault.addFile('Far anchor.md', { frontmatter: { type: 'PBI', order: 20, due: formatCivil(addDays(TODAY, 200)) } });
		const { view, containerEl } = datedRoadmap(vault);
		view.setZoom('quarter');

		const bar = rowFor(containerEl, 'One day')?.querySelector('.pbl-bar-milestone');
		expect(bar, 'a borrowed end is a one-day BAR, never the diamond').toBeNull();
		expect(labelGap(containerEl, 'One day')).toBe(MIN_BAR_PX);
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

	it('declutters the grid exactly while a drop is being aimed', () => {
		// `.pbl-dragging .pbl-bar-label { visibility: hidden }` is the other half, and
		// `timelineBoxing.test.ts` refuses its deletion — a rule keyed on a class nothing
		// sets, and a class set with no rule behind it, both read as working here. What
		// this half states is the class going ON for a live drag and coming back OFF when
		// the gesture ends however it ends, with a label actually on the grid to hide.
		const vault = new FakeVault();
		vault.addFile('Far off.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-01', due: '2030-06-15' } });
		const { containerEl } = datedRoadmap(vault);
		const viewEl = containerEl.querySelector<HTMLElement>('.pbl-view');
		if (!viewEl) throw new Error('no view element');
		expect(containerEl.querySelector('.pbl-bar-label')).not.toBeNull();
		expect(viewEl.classList.contains('pbl-dragging')).toBe(false);

		// The gesture has to reach a TARGET, not merely leave the grip: the drag library
		// confirms a drag on the first `dragover` over something registered, which is also
		// exactly the moment the claim is about — the labels go while a drop is being
		// aimed, not while a pointer is still on the bar it came from.
		const gesture = gridDrag.start(gripOf(containerEl, 'Far off', 'body'));
		gesture.over(overlayOf(containerEl), { clientX: 300 });
		expect(viewEl.classList.contains('pbl-dragging')).toBe(true);
		// Hidden, never removed: the label is the stylesheet's to take off screen, and a
		// render that dropped it would move the whole grid under the pointer mid-drag.
		expect(containerEl.querySelector('.pbl-bar-label')).not.toBeNull();

		gesture.cancel();
		expect(viewEl.classList.contains('pbl-dragging')).toBe(false);
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
 * is rendered on this projection (`renderStateChip`'s only call site is a tree row's own
 * column, and a timeline row draws no columns), so before `stateNote` the colour was the
 * whole of it — nothing at all for a screen reader, and colour alone for a reader who cannot
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
		// The state property is VISIBLE, so a state column resolves and a chip is something
		// this frame could draw — without that, the chip assertion below is a question
		// nobody asked.
		const harness = makeView(
			statefulVault(),
			{ ...DATE_AXIS, stateProperty: 'note.status' },
			{ collapsed: true, order: ['note.status'] },
		);
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
		// And not as a visible chip, though the column now exists: a timeline row is a lead
		// column and a track, so it draws no property strip at all — the words above are
		// the whole of what it says about state.
		expect(row.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('says done in words too, which is otherwise a class and a green bar', () => {
		const containerEl = statefulRoadmap();
		const row = timelineRow(containerEl, 'Shipped');

		expect(row.classList.contains('pbl-done')).toBe(true);
		expect(words(row)).toBe('Done — done');
	});

	it('folds the state into a marker’s own label, which is all a diamond has', () => {
		const containerEl = statefulRoadmap();

		// A marker draws in the milestones' shared row since 2026-08-16, so there is no row
		// to hold a `.pbl-sr-only` span and the mark's own label is the whole of what it
		// announces. Without these words `pbl-done` is a green diamond and nothing else —
		// state in colour alone, which is exactly what `stateNote` exists to prevent.
		expect(markFor(containerEl, 'Cutover').getAttribute('aria-label')).toBe(
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
