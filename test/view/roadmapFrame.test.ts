// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import {
	barOf,
	bucketByName,
	bucketCountOf,
	bucketNames,
	bucketsOf,
	shelfCountOf,
	shelfIsEmptyStrip,
	shelfOf,
	shelfTitles,
	timelineRows,
} from '../helpers/roadmap';

useViewHarness();

const HORIZONS = { horizonProperty: 'note.horizon' };
const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };

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
