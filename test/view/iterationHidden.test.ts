// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, Harness, makeView, useViewHarness } from '../helpers/view';
import { shelfOf } from '../helpers/roadmap';
import type { Projection } from '../../src/view/host';

useViewHarness();

/**
 * **An `Iteration` note draws only where the roadmap's GRID axes do.** It is the
 * container its board's data hangs off — a name, two dates and a goal — and not work the
 * backlog holds, so the tree, both boards, the catalog, its own iteration board and the
 * horizons axis (buckets and shelf alike) still refuse it. The dated and resources axes
 * are the one admission ([[An iteration draws as a bar or a line]]): drawn in the shared
 * marker row when it carries a target date, or shelved — unplaced, the same as any other
 * card the axis could not place — when it carries none (extension 3b).
 *
 * One test over every projection rather than a case per screen, because that is the shape
 * of the claim: "nowhere but these two" cannot be checked by driving the screens somebody
 * thought of, and the next projection is exactly the one that would draw it wrongly. The
 * list is maintained by hand, and an assertion verifies it covers every projection plus
 * the three roadmap axes, so a new projection added tomorrow is a failing test rather than
 * a gap.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationGoalProperty: 'note.goal',
	startProperty: 'note.start',
	targetProperty: 'note.due',
	horizonProperty: 'note.horizon',
	horizonValues: 'Now, Next, Later',
	assigneeProperty: 'note.assignee',
	deliverableStateProperty: 'note.deliverableStatus',
};

/**
 * An iteration configured every way a projection could catch it: dated (so the timeline
 * would draw a bar and the marker lane a line), with a horizon (so a bucket would hold
 * it), with an assignee (so a resource row would), stated and goal-bearing — beside one
 * item of every kind that SHOULD draw.
 */
function everythingVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', {
		frontmatter: {
			type: 'Iteration',
			order: 10,
			status: 'Doing',
			start: '2026-09-07',
			due: '2026-09-20',
			horizon: 'Now',
			assignee: 'Dana',
			goal: 'Ship it',
		},
	});
	vault.addFile('A milestone.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-09-30' } });
	vault.addFile('An epic.md', { frontmatter: { type: 'Epic', order: 30, status: 'New', horizon: 'Now' } });
	vault.addFile('In sprint.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		parentLink: 'An epic',
	});
	vault.addFile('A deliverable.md', {
		frontmatter: { type: 'Deliverable', order: 40, deliverableStatus: 'Draft' },
	});
	vault.addFile('A suite.md', { frontmatter: { type: 'Test suite', order: 50 } });
	return vault;
}

/**
 * `everythingVault`, with Sprint 12's two dates removed — extension 3b's case: a point
 * with no target date is nothing to draw, so a grid axis that admits it can only shelve
 * it, unplaced like any other card the axis could not place.
 */
function undatedSprintVault(): FakeVault {
	const vault = everythingVault();
	const fm = { ...vault.fm('Sprint 12.md') };
	delete fm.start;
	delete fm.due;
	vault.setFrontmatter('Sprint 12.md', fm);
	return vault;
}

/**
 * Every name on screen, whatever a projection calls the thing that carries it — a row, a
 * card, a bar, or a milestone LABEL over its own line.
 *
 * The last two are why this is a function rather than a row query. Measured with rows and
 * cards alone (2026-08-16), the dated and resources axes reported nothing even with the
 * exclusion turned OFF: a marker draws as a line with a label above it and as a bar in
 * the milestone lane, and neither is a card. An instrument blind to the two screens most
 * likely to draw a dated note would have called them covered.
 */
function shown(containerEl: HTMLElement): string[] {
	const selector = '.pbl-row, .pbl-card, .pbl-bar, .pbl-milestone-label';
	return Array.from(containerEl.querySelectorAll<HTMLElement>(selector)).map(
		(el) => el.querySelector('.pbl-title, .pbl-card-title')?.textContent ?? el.getAttribute('aria-label') ?? el.textContent ?? '',
	);
}

/**
 * Drive every screen a sweep case checks, collecting which ones drew "Sprint 12" and
 * which drew nothing at all. Shared by both sweep cases below, which differ only in the
 * vault behind `harness` and in where "Sprint 12" is therefore expected to surface.
 */
function sweep(harness: Harness): { drew: string[]; empty: string[] } {
	const screens: { label: string; open: () => void }[] = [
		{ label: 'tree', open: () => harness.view.setProjection('tree') },
		{ label: 'board', open: () => harness.view.setProjection('board') },
		{ label: 'deliverables', open: () => harness.view.setProjection('deliverables') },
		{ label: 'catalog', open: () => harness.view.setProjection('catalog') },
		{ label: 'iteration board', open: () => harness.view.setBoardScope('Sprint 12.md') },
		{
			label: 'roadmap — horizons',
			open: () => {
				harness.view.setProjection('roadmap');
				harness.view.setAxisPick('horizons');
			},
		},
		{
			label: 'roadmap — dates',
			open: () => {
				harness.view.setProjection('roadmap');
				harness.view.setAxisPick('dates');
			},
		},
		{
			label: 'roadmap — resources',
			open: () => {
				harness.view.setProjection('roadmap');
				harness.view.setAxisPick('resources');
			},
		},
	];

	// Every projection is either a base screen or a roadmap axis. The screen list must
	// cover them all, so a new projection added to the source is caught by test failure.
	const baseProjections: Projection[] = ['tree', 'board', 'roadmap', 'deliverables', 'catalog', 'iteration'];
	const roadmapAxes = ['horizons', 'dates', 'resources'];

	// Extract unique projections and axes from screen labels.
	const allScreenLabels = screens.map((s) => s.label);
	// Map labels to projections: base cases are 1:1, except 'iteration board' → 'iteration'
	const projectionLabelMap: Record<string, string> = {
		tree: 'tree',
		board: 'board',
		deliverables: 'deliverables',
		catalog: 'catalog',
		'iteration board': 'iteration',
	};
	const foundProjections = new Set<string>();
	const foundAxes = new Set<string>();

	for (const label of allScreenLabels) {
		if (label in projectionLabelMap) {
			foundProjections.add(projectionLabelMap[label]);
		} else if (label.startsWith('roadmap — ')) {
			foundProjections.add('roadmap');
			const axis = label.split(' — ')[1];
			if (axis) foundAxes.add(axis);
		}
	}

	expect(Array.from(foundProjections).sort()).toEqual([...baseProjections].sort());
	expect(Array.from(foundAxes).sort()).toEqual([...roadmapAxes].sort());

	// Collected and asserted ONCE rather than per screen, so a failure names every
	// projection that draws it rather than only the first — an instrument that stops
	// at the first hit cannot say which of the others it actually covered.
	const drew: string[] = [];
	const empty: string[] = [];
	for (const screen of screens) {
		screen.open();
		// The shelf holds what a roadmap could not place, and it is where an
		// undated or unplaced note would surface if the axis refused it.
		harness.view.setShelfCollapsed(false);
		clickExpandAll(harness.containerEl);
		const titles = shown(harness.containerEl);
		if (titles.some((title) => title.includes('Sprint 12'))) drew.push(screen.label);
		// Not vacuous: each screen really did draw something of its own.
		if (titles.length === 0) empty.push(screen.label);
	}
	return { drew, empty };
}

describe('an Iteration note draws only where a grid axis does', () => {
	it("draws in the grid axes' shared marker row, and nowhere else", () => {
		const vault = everythingVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		// It IS in the model — the picker and `Set iteration` read it from there, which is
		// what makes this a rendering claim rather than a claim about the vault.
		expect(harness.view.model?.byPath.get('Sprint 12.md')).toBeDefined();

		const { drew, empty } = sweep(harness);
		expect(empty, 'screens that drew nothing at all, so proved nothing').toEqual([]);
		// The grid axes draw it in the shared marker row — the one admission
		// ([[An iteration draws as a bar or a line]]). Everything else still refuses,
		// the horizons axis with its buckets AND its shelf.
		expect(drew.sort(), 'screens that drew the iteration').toEqual(['roadmap — dates', 'roadmap — resources']);

		// **What this rule actually carries, measured rather than assumed.** The admission
		// is `projectionMember`'s alone, and it is narrow: `inPlan` still refuses an
		// `Iteration` everywhere, so only a roadmap on a GRID axis ever asks the wider
		// predicate (`inPlan(item) || isIterationType(item.typeName)`) — exactly two of
		// these eight, and the horizons axis reaches that same `if` and still answers
		// `inPlan` alone, because `drawsGrid('horizons')` is false. The other five were
		// never touched by it: `inPlan` refuses the tree and the product board outright,
		// the catalog refuses it on its own ladder rule (a marker's ladder is never the
		// test one), the Deliverables board takes only Deliverable-typed items, and the
		// iteration board cards an iteration's MEMBERS rather than the iteration. They are
		// swept here so that stays true, not because this admission is what keeps them clear.
	});

	it('shelves the same note, unplaced, where it has no date to draw at', () => {
		const vault = undatedSprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });

		const { drew, empty } = sweep(harness);
		expect(empty, 'screens that drew nothing at all, so proved nothing').toEqual([]);
		// Extension 3b: a point with no target is nothing to draw, so admission on the grid
		// axes can only land it on the shelf — the same "Unplaced" strip any other card
		// without a placement lands on.
		expect(drew.sort(), 'screens that drew the iteration').toEqual(['roadmap — dates', 'roadmap — resources']);
		// The iteration appears in the shelf specifically, confirming it is shelved.
		harness.view.setProjection('roadmap');
		harness.view.setAxisPick('dates');
		harness.view.setShelfCollapsed(false);
		clickExpandAll(harness.containerEl);
		const shelf = shelfOf(harness.containerEl);
		expect(shelf?.textContent?.includes('Sprint 12'), 'undated iteration in shelf').toBe(true);
	});

	it('is in no count, on any projection', () => {
		// The toolbar's figures answer for the base, and an iteration is not work in it.
		const vault = everythingVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		for (const projection of ['tree', 'board', 'roadmap'] as const) {
			harness.view.setProjection(projection);
			const label = harness.containerEl.querySelector('.pbl-count-label')?.textContent ?? '';
			expect(label, projection).not.toContain('5');
		}
	});
});

// The quick filter's own half of iteration admission was asserted here until the filter was
// withdrawn (2026-08-17, [[Remove the quick filter, now that Bases has its own search]]).
// What it covered — a needle reaching an `Iteration` that `model.roots` never contains, and
// not reaching it as a side effect of another note's match — has no subject now. The
// admission itself is untouched and still asserted above: `projectionMember` widens for the
// grid axes, which is what draws the sprint in the marker row at all.
