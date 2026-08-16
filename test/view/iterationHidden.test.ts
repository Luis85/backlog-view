// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * **An `Iteration` note appears in NO projection.** It is the container its board's data
 * hangs off — a name, two dates and a goal — and not work the backlog holds.
 *
 * One test over every projection rather than a case per screen, because that is the shape
 * of the claim: "nowhere" cannot be checked by driving the screens somebody thought of,
 * and the next projection is exactly the one that would draw it. The list is read from
 * the toolbar's own switcher, so a sixth position added tomorrow is a failing test rather
 * than a gap.
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

describe('an Iteration note is in no projection', () => {
	it('draws nowhere: not a row, not a card, not a bar, on any projection or axis', () => {
		const vault = everythingVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		// It IS in the model — the picker and `Set iteration` read it from there, which is
		// what makes this a rendering claim rather than a claim about the vault.
		expect(harness.view.model?.byPath.get('Sprint 12.md')).toBeDefined();

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
		expect(empty, 'screens that drew nothing at all, so proved nothing').toEqual([]);
		expect(drew, 'screens that drew the iteration').toEqual([]);

		// **What this rule actually carries, measured rather than assumed.** Turning
		// `inPlan`'s iteration refusal off (2026-08-16) makes exactly five of these eight
		// draw it: the tree, the product board, and all three roadmap axes. The other
		// three never did, each for a reason of its own — the Deliverables board takes
		// only Deliverable-typed items, the catalog only the other ladder, and the
		// iteration board cards an iteration's MEMBERS rather than the iteration. They are
		// swept here so that stays true, not because this rule is what keeps them clear.
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
