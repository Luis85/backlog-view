// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { todayStamp } from '../../src/domain/noteFields';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import {
	barFor,
	barOf,
	bucketByName,
	bucketCountOf,
	bucketNames,
	bucketsOf,
	labelTexts,
	rowFor,
	shelfCountOf,
	shelfIsEmptyStrip,
	shelfOf,
	shelfTitles,
	timelineRows,
} from '../helpers/roadmap';

useViewHarness();

const HORIZONS = { horizonProperty: 'note.horizon' };
const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
/** `todayCivil()` reads the same live clock, so this always names its date. */
const TODAY_ISO = todayStamp();

function roadmapView(vault: FakeVault, cfg: Record<string, unknown>, opts: { base?: string } = {}) {
	const harness = makeView(vault, cfg, { collapsed: true, ...opts });
	harness.view.setProjection('roadmap');
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
		expect(containerEl.querySelectorAll('.pbl-timeline-month').length).toBeGreaterThan(0);
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
		expect(epic.getAttribute('aria-label')).toBe('Milestone 2026-08-10 — inferred from children');
	});
});

describe('a marker on the dated axis', () => {
	it('draws no diamond for a milestone past the window edge, only the direction it lies past', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2200-01-01' } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 20, due: '2026-09-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const bar = barFor(containerEl, 'Ship 1.0');
		expect(bar.classList.contains('pbl-bar-milestone')).toBe(false);
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.classList.contains('pbl-bar-open-end')).toBe(true);
		// The exact date is never lost — it stays where the row's accessible name puts it.
		expect(rowFor(containerEl, 'Ship 1.0')?.getAttribute('aria-label')).toContain('2200-01-01');
	});

	it('puts the milestone’s name and exact date in its row’s accessible name', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(rowFor(containerEl, 'Ship 1.0')?.getAttribute('aria-label')).toBe('Ship 1.0 — Milestone 2026-12-01');
	});
});

describe('milestone lines', () => {
	it('draws one line per readable milestone inside the window, each with a row of its own', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		vault.addFile('A story.md', {
			frontmatter: { type: 'PBI', order: 20, start: '2026-09-01', due: '2026-10-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		// Every line has a row: no milestone is visible only as a line.
		expect(rowFor(containerEl, 'Ship 1.0')).not.toBeNull();
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0']);
	});

	it('carries the full name in the label’s tooltip — the truncated label can be hovered', () => {
		// The label is CSS-truncated (`max-width: 140px`) and the full name is promised
		// "one hover away", which only means something if the label can actually receive
		// a hover — `pointer-events: none` would make it a dead spot no pointer ever
		// reaches. jsdom does not run layout or hit-testing, so this checks the one thing
		// it can: the tooltip data the hover is meant to surface is really there.
		const vault = new FakeVault();
		vault.addFile('Ship a very long milestone title that will not fit.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const label = containerEl.querySelector<HTMLElement>('.pbl-milestone-label');
		expect(label?.dataset.tooltip).toBe('Ship a very long milestone title that will not fit');
	});

	it('draws one line naming both when two milestones share a date', () => {
		// Two lines a pixel apart read as one and quietly misreport the count.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		vault.addFile('Contract ends.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0 · Contract ends']);
	});

	it('draws no line for a milestone outside the window, and none for a context row', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2200-01-01' } });
		vault.addFile('Excluded.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-12-01' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Epic', order: 30, due: '2026-09-01' },
			parentLink: 'Excluded',
		});
		const { view, containerEl } = roadmapView(vault, { ...DATES });

		// A line across every result is derived FROM the results, and a context row is
		// never a source of one: exclude 'Excluded' from the base's own results — its
		// explicit parent link on Result pulls it back in as context, not a result.
		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== 'Excluded.md'),
		};
		view.onDataUpdated();

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
	});

	it('draws a milestone dated today beside the today line, with today keeping its pixel', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: TODAY_ISO } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const px = (sel: string, prop: string) =>
			Number.parseFloat(containerEl.querySelector<HTMLElement>(sel)?.style.getPropertyValue(prop) ?? '');
		expect(px('.pbl-milestone-line', '--pbl-milestone-left')).toBe(px('.pbl-today', '--pbl-today-left') + 2);
		expect(containerEl.querySelectorAll('.pbl-today')).toHaveLength(1);
	});

	it('hides a line exactly when its row hides', () => {
		// The visibility rule travels with the item, not with the projection.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01', status: 'Done' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', showCompleted: false });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
		expect(rowFor(containerEl, 'Ship 1.0')).toBeNull();
	});

	it('makes neither the line nor its label a second selection stop', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const line = containerEl.querySelector<HTMLElement>('.pbl-milestone-line');
		expect(line?.getAttribute('aria-hidden')).toBe('true');
		expect(line?.hasAttribute('tabindex')).toBe(false);
		expect(containerEl.querySelector('.pbl-milestone-label')?.closest('[role="option"]')).toBeNull();
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

	it('is absent on the dated axis until something shelves — no write means no target', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		// Scheduling by drag is its own feature; an empty strip promising a drop the
		// timeline cannot write would be the projection making an offer it cannot keep.
		expect(shelfOf(containerEl)).toBeNull();
	});

	it('narrows with "Show completed items" exactly as the rest of the view does', () => {
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { containerEl } = roadmapView(vault, {
			...HORIZONS,
			stateProperty: 'note.status',
			showCompleted: false,
		});

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

	it('says nothing matches while the quick filter empties the roadmap', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const harness = roadmapView(vault, { ...HORIZONS });
		harness.view.setFilter('zzz');

		expect(harness.containerEl.querySelector('.pbl-board-advisory')?.textContent).toContain('No items match');
		// The frame stays: an empty roadmap is an empty frame.
		expect(bucketsOf(harness.containerEl).length).toBeGreaterThan(0);
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
		const config = new FakeViewConfig({ ...cfg, focusLevel: 'Epic' });
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
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
		expect(shelfOf(containerEl)).toBeNull();
	});
});
