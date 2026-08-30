// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { todayStamp } from '../../src/domain/noteFields';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { clickExpandAll, refresh, useViewHarness } from '../helpers/view';
import {
	barFor,
	barOf,
	bucketByName,
	bucketCountOf,
	bucketNames,
	cellLabels,
	roadmapView,
	rowFor,
	shelfCountOf,
	shelfHeavyVault,
	shelfIsEmptyStrip,
	shelfOf,
	shelfTitles,
	timelineRows,
} from '../helpers/roadmap';
import { daysBetween, scaleFor } from '../../src/domain/timeline';

useViewHarness();

const HORIZONS = { horizonProperty: 'note.horizon' };
const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
/** `todayCivil()` reads the same live clock, so this always names its date. */
const TODAY_ISO = todayStamp();

/** The dated axis alone, at its default zoom — the fixture the density tests share. */
function datedRoadmap(vault: FakeVault) {
	return roadmapView(vault, { ...DATES });
}

/**
 * Both axes configured, opened on dates explicitly — the fixture for a genuine axis
 * switch. `datedRoadmap` alone cannot exercise one: with only the dated axis
 * configured, picking 'horizons' resolves back to 'dates' (`activeAxis`'s "a
 * configured axis always beats guidance"), so nothing about the drawn content
 * actually changes.
 */
function datedAndHorizonRoadmap(vault: FakeVault) {
	const harness = roadmapView(vault, { ...DATES, horizonProperty: 'note.horizon' });
	harness.view.setAxisPick('dates');
	return harness;
}

describe('the horizon frame', () => {
	it('renders declared buckets in order, empty or not, and strays after them', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Someday' } });
		const { containerEl } = roadmapView(vault, { ...HORIZONS });

		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later', 'Someday']);
		// Later holds nothing and renders anyway — a horizon exists either way.
		expect(bucketCountOf(bucketByName(containerEl, 'Later'))).toBe('0');
		expect(bucketByName(containerEl, 'Someday').hasClass('pbl-bucket-undeclared')).toBe(true);
		expect(bucketCountOf(bucketByName(containerEl, 'Now'))).toBe('1');
	});

	it('a bucket card is the board’s card: badge, parent line, rollup', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now', status: 'Active' } });
		vault.addFile('F.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...HORIZONS, stateProperty: 'note.status' });

		const card = bucketByName(containerEl, 'Now').querySelector('.pbl-card');
		expect(card?.querySelector('.pbl-badge-text')?.textContent).toBe('Epic');
		expect(card?.querySelector('.pbl-progress-label')?.textContent).toBe('1/1');
	});
});

describe('the dated frame', () => {
	it('draws a bar per placed result and the today line on a month grid', () => {
		const vault = new FakeVault();
		vault.addFile('Span.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-15' } });
		vault.addFile('Point.md', { frontmatter: { type: 'Epic', order: 20, start: '2026-08-05' } });
		vault.addFile('Mile.md', { frontmatter: { type: 'Epic', order: 30, start: '2026-08-10', due: '2026-08-10' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const rows = timelineRows(containerEl);
		expect(rows).toHaveLength(3);
		// A bar states what the note states: a full span, an open end, a milestone.
		expect(barOf(rows[0]).getAttribute('aria-label')).toBe('2026-08-01 → 2026-09-15');
		expect(barOf(rows[1]).hasClass('pbl-bar-open-end')).toBe(true);
		expect(barOf(rows[1]).getAttribute('aria-label')).toBe('Starts 2026-08-05, target not set');
		expect(barOf(rows[2]).hasClass('pbl-bar-milestone')).toBe(true);
		expect(containerEl.querySelector('.pbl-today')).not.toBeNull();
		expect(containerEl.querySelectorAll('.pbl-timeline-cell').length).toBeGreaterThan(0);
	});

	it('leaves an ordinary row’s accessible name to its content — badge and title, not overridden', () => {
		// The row-level `aria-label` override is a milestone's own affordance (criterion
		// 4a of "A milestone line across the plan": neither its line nor its diamond is
		// focusable, so its ROW is where the facts have to live). An ordinary dated row
		// has no such gap — the bar beside it already carries the dates in its own
		// `aria-label`, which the accessible-name computation folds into the row's
		// content-derived name — so overriding it here would cost every dated row its
		// type word for a fact the bar already states, the same reasoning `createCard`
		// already applies (`aria-description`, never `aria-label`, for the outside marker).
		const vault = new FakeVault();
		vault.addFile('Span.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-15' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(rowFor(containerEl, 'Span')?.hasAttribute('aria-label')).toBe(false);
	});

	it('shelves the unreadable and the reversed with the reason on the card', () => {
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 10, start: 'soon' } });
		vault.addFile('Reversed.md', {
			frontmatter: { type: 'Epic', order: 20, start: '2026-09-01', due: '2026-08-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(0);
		expect(shelfTitles(containerEl)).toEqual(['Garbled', 'Reversed']);
		const reasons = Array.from(containerEl.querySelectorAll('.pbl-shelf-reason')).map((r) => r.textContent);
		expect(reasons).toEqual(['Unreadable start date', 'Target date precedes the start date']);
	});

	it('renders the empty frame around today when nothing is placed — never no frame', () => {
		const vault = new FakeVault();
		vault.addFile('Bare.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		// The grid and the today line render beside a full shelf; the count speaks
		// and no advisory suggests dates the user has not chosen.
		expect(containerEl.querySelector('.pbl-timeline')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-today')).not.toBeNull();
		expect(shelfTitles(containerEl)).toEqual(['Bare']);
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});

	it('draws an inferred bar as an outline and says so in its label', () => {
		const vault = new FakeVault();
		// The epic states nothing; its two children bracket it.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', due: '2026-08-20' },
			parentLink: 'Epic',
		});
		vault.addFile('B.md', {
			frontmatter: { type: 'Feature', order: 20, start: '2026-09-01', due: '2026-09-30' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });
		// The grid honours the tree's collapse state, and a parent nobody has ruled on
		// opens shut — so the children this test is about are behind the epic's own
		// disclosure until something opens it.
		clickExpandAll(containerEl);

		const rows = timelineRows(containerEl);
		// The epic is on the grid now, not the shelf, and it leads its children.
		expect(rows).toHaveLength(3);
		expect(shelfTitles(containerEl)).toEqual([]);

		const epic = barOf(rows[0]);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		expect(epic.getAttribute('aria-label')).toBe('2026-08-01 → 2026-09-30 — inferred from children');

		// A stated bar is never marked: the two must not read alike.
		const stated = barOf(rows[1]);
		expect(stated.hasClass('pbl-bar-inferred')).toBe(false);
		expect(stated.getAttribute('aria-label')).toBe('2026-08-01 → 2026-08-20');
	});

	it('marks a half-inferred bar too — one stated end does not make it a statement', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01' } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, due: '2026-09-30' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const epic = barOf(timelineRows(containerEl)[0]);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		expect(epic.getAttribute('aria-label')).toBe('2026-08-01 → 2026-09-30 — inferred from children');
	});

	it('an inferred bar with no evidence of one kind is marked inferred AND open there', () => {
		// The ordinary shape of a backlog that states target dates and no start
		// dates: nothing below supplies a start, so the epic's own start has no
		// evidence of its kind and stays open while its end is inferred. Both cues
		// have to survive together — the styles carry a rule for exactly this pair.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, due: '2026-09-30' }, parentLink: 'Epic' });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const epic = barOf(timelineRows(containerEl)[0]);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		expect(epic.hasClass('pbl-bar-open-start')).toBe(true);
		expect(epic.getAttribute('aria-label')).toBe('Target 2026-09-30, start not set — inferred from children');
	});

	it('keeps the inferred class on a bar that lands wholly outside the window', () => {
		// Provenance must not be silently upgraded: an inferred span that clamps at the
		// edge is still inferred, not a date the note stated, even though `barClasses`
		// takes the `outside` branch rather than the ordinary one. Reachable without any
		// milestone — an epic whose only dated descendant carries a typo'd far-future date
		// gets an inferred span that lands wholly past the edge, and without the class it
		// would draw as a *stated* direction mark instead.
		const vault = new FakeVault();
		vault.addFile('Near.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Far child.md', {
			frontmatter: { type: 'Feature', order: 10, due: '2200-01-01' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const bar = barFor(containerEl, 'Epic');
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.classList.contains('pbl-bar-inferred')).toBe(true);
	});

	it('an inferred equal pair renders as the milestone diamond too, not just a stated one', () => {
		const vault = new FakeVault();
		// The epic states nothing; its only child states an equal start and due.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-10', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const epic = barOf(timelineRows(containerEl)[0]);
		expect(epic.hasClass('pbl-bar-milestone')).toBe(true);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		// The epic is an Epic, not a Milestone — an inferred equal pair still draws the
		// diamond, but the sentence now names the item's own type rather than the fixed
		// word every coincident point used to announce.
		expect(epic.getAttribute('aria-label')).toBe('Epic 2026-08-10 — inferred from children');
	});
});

describe('the unplaced shelf', () => {
	it('keeps sibling order and names its count', () => {
		const vault = new FakeVault();
		vault.addFile('Second.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('First.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = roadmapView(vault, { ...HORIZONS });

		expect(shelfTitles(containerEl)).toEqual(['First', 'Second']);
		expect(shelfCountOf(containerEl)).toBe('2');
	});

	it('holds nothing when everything places, and is still the target that un-places', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const { containerEl } = roadmapView(vault, { ...HORIZONS });

		// On the horizon axis the empty shelf stays in the DOM and out of the layout:
		// it is where a card goes to be un-placed, and a target that exists only
		// while it is occupied is one nothing can ever reach.
		expect(shelfTitles(containerEl)).toEqual([]);
		expect(shelfIsEmptyStrip(containerEl)).toBe(true);
	});

	it('stays in the DOM on the dated axis too, empty or not — a held bar can un-place onto it', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		// Nothing is shelved, but the strip is still the target a held bar's body drop
		// reaches to un-place its dates — out of the layout until a drag is live, the
		// same rule the horizon axis's empty shelf already followed.
		expect(shelfIsEmptyStrip(containerEl)).toBe(true);
	});

	it('narrows with "Show completed items" exactly as the rest of the view does', () => {
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { containerEl } = roadmapView(
			vault,
			{ ...HORIZONS, stateProperty: 'note.status' },
			{ hideCompleted: true },
		);

		expect(shelfTitles(containerEl)).toEqual(['Open']);
		// The toolbar count agrees: the projections and their numbers never disagree.
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 of 2');
	});
});

describe('the advisory beside the frame', () => {
	it('says an empty base is empty beside the declared buckets, never instead of them', () => {
		const { containerEl } = roadmapView(new FakeVault(), { ...HORIZONS });

		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later']);
		const advisory = containerEl.querySelector('.pbl-board-advisory');
		expect(advisory?.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
	});

	it('counts what this roadmap could draw, never what the base returned', () => {
		// A release is on no axis here, so the frame draws no card for one — and the
		// advisory used to read `model.results`, which still counts it. Two readers of "what
		// is on this roadmap" that could disagree, and they did: with a release the only
		// result, the roadmap announced "All 1 item is done and hidden" about a note that is
		// neither, over a Show completed items button that would not have brought it back.
		const only = new FakeVault();
		only.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 } });
		const releaseOnly = roadmapView(only, { ...HORIZONS });
		expect(releaseOnly.containerEl.querySelector('.pbl-board-advisory .pbl-empty-title')?.textContent).toBe(
			'No backlog items',
		);

		// And the other half: where rows genuinely ARE hidden, the number must not be
		// inflated by the releases beside them. One done epic, one release, one item hidden.
		const mixed = new FakeVault();
		mixed.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		mixed.addFile('1.0.md', { frontmatter: { type: 'Release', order: 20 } });
		const hidden = roadmapView(mixed, { ...HORIZONS, stateProperty: 'note.status' }, { hideCompleted: true });
		expect(hidden.containerEl.querySelector('.pbl-board-advisory')?.textContent).toContain(
			'All 1 item is done and hidden.',
		);
	});
});

describe('context rows on the roadmap', () => {
	/** The Base returns only the feature; its epic is context at the focus level. */
	function focusedRoadmap(epicFm: Record<string, unknown>, cfg: Record<string, unknown>) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, ...epicFm } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const config = new FakeViewConfig(cfg);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('Epic');
		view.setProjection('roadmap');
		return { view, containerEl, vault };
	}

	it('sits inert in a bucket its value names, styled and announced as context, uncounted', () => {
		const { containerEl } = focusedRoadmap({ horizon: 'Now' }, { ...HORIZONS });

		const card = bucketByName(containerEl, 'Now').querySelector('.pbl-card');
		expect(card?.hasClass('pbl-card-context')).toBe(true);
		expect(card?.getAttribute('aria-description')).toContain('shown for context');
		expect(bucketCountOf(bucketByName(containerEl, 'Now'))).toBe('0');
		// Never shelved: the shelf is a statement about the results.
		expect(shelfTitles(containerEl)).toEqual([]);
	});

	it('stands beside the shelf when its value would mint a bucket — and never shelves', () => {
		const { containerEl } = focusedRoadmap({ horizon: 'Someday' }, { ...HORIZONS });

		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later']);
		const strip = containerEl.querySelector('.pbl-roadmap-context');
		expect(strip?.querySelector('.pbl-card-title')?.textContent).toBe('Epic');
		expect(shelfTitles(containerEl)).toEqual([]);
	});

	it('is never placed by its own dates on the timeline', () => {
		const { containerEl } = focusedRoadmap({ start: '2026-08-01', due: '2026-09-01' }, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-roadmap-context .pbl-card-title')?.textContent).toBe('Epic');
		// Nothing else on this row set is a result, so the shelf renders empty rather
		// than absent — the dated axis's shelf is a real target regardless.
		expect(shelfIsEmptyStrip(containerEl)).toBe(true);
	});
});

describe('the grid at each density', () => {
	it('draws a stated plan at least MIN_BAR_PX wide, even at the sparsest zoom', () => {
		// A one-day bar at quarter zoom is one pixel: a stated plan rendered as an
		// invisible one. The floor is its own constant precisely because it is a length
		// in PIXELS and must not scale with the zoom.
		const vault = new FakeVault();
		vault.addFile('One day.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-04' } });
		const { view, containerEl } = datedRoadmap(vault);
		view.setZoom('quarter');

		const bar = barFor(containerEl, 'One day');
		expect(parseFloat(bar.style.getPropertyValue('--pbl-bar-width'))).toBeGreaterThanOrEqual(4);
	});

	it('keeps a milestone’s line inside its own day at every zoom', () => {
		// The nudge is a sub-day offset. At quarter zoom a fixed two pixels is a two-day
		// displacement, putting the line and its label in the wrong day — and the day
		// is exactly wide enough for both marks because `dayPx >= 2 * lineWidth`.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, due: TODAY_ISO } });
		const { view, containerEl } = datedRoadmap(vault);

		for (const zoom of ['week', 'month', 'quarter'] as const) {
			view.setZoom(zoom);
			const line = containerEl.querySelector<HTMLElement>('.pbl-milestone-line');
			const today = containerEl.querySelector<HTMLElement>('.pbl-today');
			const nudged = parseFloat(line?.style.getPropertyValue('--pbl-milestone-left') ?? '0');
			const todayLeft = parseFloat(today?.style.getPropertyValue('--pbl-today-left') ?? '0');
			const dayPx = scaleFor(zoom).dayPx;
			expect(nudged - todayLeft, `${zoom} nudge`).toBeGreaterThan(0);
			expect(nudged - todayLeft, `${zoom} nudge`).toBeLessThan(dayPx);
		}
	});

	it('names its header cells by the active scale’s unit', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-20' } });
		const { view, containerEl } = datedRoadmap(vault);

		view.setZoom('quarter');
		expect(cellLabels(containerEl).some((label) => /^Q[1-4]$/.test(label))).toBe(true);
		view.setZoom('month');
		expect(cellLabels(containerEl)).toContain('Aug');
	});
});

describe('the dated frame’s scroll boxes', () => {
	it('keeps each band’s place by WHICH BAND IT IS, never by its position', () => {
		// The bands are conditional — the context strip renders only with context rows,
		// the advisory only when no cards do — so a filter can change which bands exist
		// between two renders, and a positional pairing would restore the context
		// strip's offset onto the advisory and open it scrolled past its own heading.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const shelfEl = shelfOf(containerEl);
		if (!shelfEl) throw new Error('no shelf');
		shelfEl.scrollTop = 120;

		refresh(view, vault);

		expect(shelfOf(containerEl)?.scrollTop).toBe(120);
	});

	it('starts a band that has just appeared at the top', () => {
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedAndHorizonRoadmap(vault);
		shelfOf(containerEl)!.scrollTop = 120;
		view.setAxisPick('horizons');
		view.setAxisPick('dates');
		// Different drawn content — the roadmap's two axes are different content on one
		// frame — so every band starts at the top rather than inheriting the other
		// axis's shelf offset.
		expect(shelfOf(containerEl)?.scrollTop).toBe(0);
	});

	it('captures the offsets from the OLD scroller, before the DOM goes', () => {
		// `renderTreeContent` reads `treeEl.scrollTop/scrollLeft` just before
		// `treeEl.empty()` — the PANE, which on this axis no longer scrolls. Restoring
		// those would silently discard the reader's pan and jump back to today on every
		// refresh. Capture and restore are one decision about which element the scroll
		// box is, and they have to name the same one.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		scroller!.scrollLeft = 900;

		refresh(view, vault);

		expect(containerEl.querySelector<HTMLElement>('.pbl-timeline')?.scrollLeft).toBe(900);
	});
});

describe('preserving a place across a zoom change', () => {
	it('reopens at the same DATE, not the same pixel count', () => {
		// A zoom redefines what a pixel is worth: a day a hundred days out sits 400px
		// away at month zoom and 200px at quarter. `restoreScroll`'s existing
		// `saved + (newTodayLeft - oldTodayLeft)` correction cannot see it — it corrects
		// for the window moving, not for the ruler changing. Driven while PANNED AWAY
		// from today, since at today the two rules agree and the bug is invisible.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const scroller = () => containerEl.querySelector<HTMLElement>('.pbl-timeline')!;
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window');
		const monthPx = scaleFor('month').dayPx;
		// Day 100 of the window at the scrollport's edge. `scrollLeft` is the day-track
		// offset of the first VISIBLE day: the lead is sticky, so it covers the track
		// rather than displacing it. Asserted against a pixel offset computed here from
		// first principles rather than by calling the production conversion on both
		// sides — a test that reuses the instrument passes whatever the instrument does.
		scroller().scrollLeft = 100 * monthPx;

		view.setZoom('quarter');

		const after = view.roadmap?.window;
		const day = daysBetween(after!.start, window.start) + 100;
		expect(scroller().scrollLeft).toBe(day * scaleFor('quarter').dayPx);
	});
});
