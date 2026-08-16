// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { demoOptions, demoResults } from '../helpers/fixtures';
import { Harness, useViewHarness } from '../helpers/view';
import { barFor, laneRoadmap, markersLane, markFor, roadmapView, rowFor } from '../helpers/roadmap';
import { MIN_BAR_PX } from '../../src/domain/timeline';

/**
 * The dated axis's own rollup — the band inside a bar and the count in the lead cell —
 * covered in `src/view/render/barProgress.ts`. Each case is asserted from the rule
 * `docs/requirements/Progress on the bar.md` states, not from the implementation:
 * `rollupReport` is shared with the tree's own column (`test/view/rendering.test.ts`,
 * `columns.test.ts`), so this file's job is the two DOM shapes a timeline row draws it
 * into, not the numbers themselves.
 */

useViewHarness();

/** A roadmap already on the DATED axis — `demoOptions()` configures every axis at once,
 *  so the pick has to be made explicit rather than left to fall to the horizon axis. */
function datedRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = roadmapView(vault, { ...demoOptions(), ...extra });
	harness.view.setAxisPick('dates');
	return harness;
}

/** A Feature with 4 PBIs beneath it, 1 of them done, and both of the Feature's own dates set. */
function fourPbiFeature(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Feature.md', {
		frontmatter: { type: 'Feature', order: 10, status: 'Active', start: '2026-08-01', due: '2026-09-01' },
	});
	vault.addFile('PBI 1.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Feature' });
	vault.addFile('PBI 2.md', { frontmatter: { type: 'PBI', order: 20, status: 'Active' }, parentLink: 'Feature' });
	vault.addFile('PBI 3.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' }, parentLink: 'Feature' });
	vault.addFile('PBI 4.md', { frontmatter: { type: 'PBI', order: 40, status: 'New' }, parentLink: 'Feature' });
	return vault;
}

/**
 * `fourPbiFeature`'s own span, narrowed to one day apart — the geometry that hits
 * `MIN_BAR_PX` at quarter zoom (2px/day: 2 days of span × 2px = 4px) without being a
 * milestone (start and due are not the same day, so `geometry.milestone` stays false).
 */
function oneDayFeature(): FakeVault {
	const vault = fourPbiFeature();
	vault.setFrontmatter('Feature.md', {
		type: 'Feature',
		order: 10,
		status: 'Active',
		start: '2026-08-01',
		due: '2026-08-02',
	});
	return vault;
}

describe('the band inside a bar', () => {
	it('fills by the done share and states the same count the tree’s rollup does', () => {
		const { containerEl } = datedRoadmap(fourPbiFeature());

		const bar = barFor(containerEl, 'Feature');
		const track = bar.querySelector<HTMLElement>('.pbl-bar-progress');
		const fill = track?.querySelector<HTMLElement>('.pbl-bar-progress-fill');
		if (!track || !fill) throw new Error('no progress band on the bar');
		// A track and a fill, not one element wearing two jobs — see the module comment.
		expect(track).not.toBe(fill);
		expect(fill.style.getPropertyValue('--pbl-progress')).toBe('25%');

		const row = rowFor(containerEl, 'Feature');
		expect(row?.querySelector('.pbl-bar-count')?.textContent).toBe('1/4');
	});

	it('draws neither for a leaf — an empty measure is not a zero', () => {
		const vault = new FakeVault();
		vault.addFile('Leaf.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'Active', start: '2026-08-01', due: '2026-08-10' },
		});
		const { containerEl } = datedRoadmap(vault);

		const row = rowFor(containerEl, 'Leaf');
		expect(row?.querySelector('.pbl-bar-progress')).toBeNull();
		expect(row?.querySelector('.pbl-bar-count')).toBeNull();
	});

	it('draws no band with no state property configured, and the count is the descendant total', () => {
		const { containerEl } = datedRoadmap(fourPbiFeature(), { stateProperty: '' });

		const row = rowFor(containerEl, 'Feature');
		expect(row?.querySelector('.pbl-bar-progress')).toBeNull();
		expect(row?.querySelector('.pbl-bar-count')?.textContent).toBe('4');
	});

	it('draws no band for a milestone, even with descendants — its mark is a point, not a span', () => {
		// A marker has no ROW to carry a band or a count since 2026-08-16: it is a diamond in
		// the milestones' shared row, and the band is a fill inside a bar's own span. What is
		// asserted is the diamond, and the absence of any progress furniture in the row that
		// holds it — the rollup a marker's row used to announce is a stated loss, recorded in
		// [[Milestones out of the resource rows]].
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-09-30' } });
		vault.addFile('Prep.md', { frontmatter: { type: 'Task', order: 10, status: 'Done' }, parentLink: 'Ship' });
		const { containerEl } = datedRoadmap(vault);

		const mark = markFor(containerEl, 'Ship');
		expect(mark.classList.contains('pbl-bar-milestone')).toBe(true);
		expect(markersLane(containerEl)?.querySelector('.pbl-bar-progress')).toBeNull();
		expect(markersLane(containerEl)?.querySelector('.pbl-bar-count')).toBeNull();
	});

	it('draws no band for an outside-window arrow, even with descendants', () => {
		const vault = new FakeVault();
		// Far enough out that the window clamps around today and leaves this wholly
		// outside it — `roadmapMarkers.test.ts`'s own way of reaching `geometry.outside`.
		vault.addFile('Far off.md', { frontmatter: { type: 'PBI', order: 10, status: 'Active', due: '2200-01-01' } });
		vault.addFile('Prep.md', { frontmatter: { type: 'Task', order: 10, status: 'Done' }, parentLink: 'Far off' });
		const { containerEl } = datedRoadmap(vault);

		const bar = barFor(containerEl, 'Far off');
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		const row = rowFor(containerEl, 'Far off');
		expect(row?.querySelector('.pbl-bar-progress')).toBeNull();
		expect(row?.querySelector('.pbl-bar-count')?.textContent).toBe('1/1');
	});

	it('bands an INFERRED bar at 100% done without replacing its own geometry', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, status: 'Active' } });
		vault.addFile('Child A.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'Done', start: '2026-08-01', due: '2026-08-10' },
			parentLink: 'Parent',
		});
		vault.addFile('Child B.md', {
			frontmatter: { type: 'PBI', order: 20, status: 'Done', start: '2026-08-05', due: '2026-08-15' },
			parentLink: 'Parent',
		});
		const { containerEl } = datedRoadmap(vault);

		const bar = barFor(containerEl, 'Parent');
		expect(bar.classList.contains('pbl-bar-inferred')).toBe(true);
		const fill = bar.querySelector<HTMLElement>('.pbl-bar-progress-fill');
		expect(fill).not.toBeNull();
		expect(fill?.style.getPropertyValue('--pbl-progress')).toBe('100%');
	});

	it('draws no band on a bar too narrow to hold one, and still states the count', () => {
		// Zoomed out rather than faked: at quarter zoom (2px/day) a span one day apart
		// draws at exactly MIN_BAR_PX, the same floor `--pbl-bar-width` reads — the case
		// an ordinary coarse-zoom roadmap of epics hits routinely, not a contrived width.
		const { view, containerEl } = datedRoadmap(oneDayFeature());
		view.setZoom('quarter');

		const bar = barFor(containerEl, 'Feature');
		expect(parseFloat(bar.style.getPropertyValue('--pbl-bar-width'))).toBe(MIN_BAR_PX);
		expect(bar.querySelector('.pbl-bar-progress')).toBeNull();

		const row = rowFor(containerEl, 'Feature');
		expect(row?.querySelector('.pbl-bar-count')?.textContent).toBe('1/4');
	});

	it('bands an OPEN-ENDED bar at 100% done without replacing its own geometry', () => {
		const vault = new FakeVault();
		vault.addFile('OpenParent.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Active', start: '2026-08-01' },
		});
		vault.addFile('OpenChild.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'OpenParent' });
		const { view, containerEl } = datedRoadmap(vault);
		// An open end borrows the OTHER end, so this bar is always exactly one day wide —
		// at the default month zoom that is MIN_BAR_PX itself, drawing no band regardless
		// of geometry. Week zoom (16px/day) widens that one day past the floor, which is
		// what this case is actually testing.
		view.setZoom('week');

		const bar = barFor(containerEl, 'OpenParent');
		expect(bar.classList.contains('pbl-bar-open-end')).toBe(true);
		expect(bar.querySelector('.pbl-bar-progress')).not.toBeNull();
	});
});

describe('how the count is announced', () => {
	it('carries the count on the ROW as a screen-reader fact, and leaves the bar’s own label to the dates', () => {
		const { containerEl } = datedRoadmap(fourPbiFeature());

		const row = rowFor(containerEl, 'Feature');
		const facts = Array.from(row?.querySelectorAll('.pbl-sr-only') ?? []).map((el) => el.textContent);
		// Not `row.textContent`: in the real app a tooltip on the lead may become an
		// `aria-label`, which REPLACES the cell's own text — the jsdom mock cannot see
		// that, so the row's own sr-only fact is what a test here can actually check.
		expect(facts).toContain('1 of 4 items done');

		const bar = barFor(containerEl, 'Feature');
		expect(bar.getAttribute('aria-label')).not.toContain('done');
	});
});

/** The lane context row for one title — a fixture may put more than one on the grid. */
function laneContextFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-lane-context'));
	return rows.find((row) => row.querySelector('.pbl-card-title')?.textContent === title) ?? null;
}

describe('a context row on the resources axis', () => {
	// Named for what the fixture can prove. "Whatever its OWN state is" was the name until
	// review: `assignAll` computes `self` per CHILD, so a context row's own status can
	// never enter its own count by construction and no fixture can make it fail — a name
	// promising it reads as a check that is not there.
	it('counts the results beneath it and never an excluded note on the way', () => {
		const vault = new FakeVault();
		// Named to match `demoResults`' own excluded note, so the helper's filter is a
		// real filter here rather than a no-op.
		vault.addFile('Retired platform.md', {
			frontmatter: { type: 'Epic', order: 10, status: 'Done', assignee: 'Dana' },
		});
		vault.addFile('Result A.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Dana', status: 'Done', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Retired platform',
		});
		// The excluded CHILD — the only excluded note a count can actually be wrong about.
		// It is `Done` too, so counting it would read `2/3`. It exists in the model at all
		// because it is `Result B`'s parent: `loadOutsideParents`
		// pulls in ancestors of results and nothing else, so an excluded LEAF child could
		// not be built at all.
		vault.addFile('Excluded branch.md', {
			frontmatter: { type: 'Feature', order: 20, status: 'Done' },
			parentLink: 'Retired platform',
		});
		vault.addFile('Result B.md', {
			frontmatter: { type: 'PBI', order: 10, assignee: 'Dana', status: 'Active', start: '2026-08-03', due: '2026-08-04' },
			parentLink: 'Excluded branch',
		});
		// `demoResults` knows the one excluded name, so the branch is dropped here.
		const only = demoResults(vault)
			.map((entry) => entry.file.path)
			.filter((path) => path !== 'Excluded branch.md');
		// `Dana` has to be a DECLARED resource: with focus at Epic level neither result is
		// itself a root, so no result ever mints her lane the way a card would —
		// only a declared name pre-exists for the context row to join.
		const harness = laneRoadmap(
			vault,
			{ stateProperty: 'note.status', doneValues: 'Done', resourceNames: 'Dana' },
			{ only, focus: 'Epic' },
		);

		const context = laneContextFor(harness.containerEl, 'Retired platform');
		expect(context?.querySelector('.pbl-bar-progress')).toBeNull();
		expect(context?.querySelector('.pbl-bar-count')?.textContent).toBe('1/2');
	});
});
