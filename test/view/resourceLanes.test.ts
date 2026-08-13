// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { laneCountOf, laneNames, laneOrder, lanesOf, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/**
 * The resources axis on screen: one row per resource over the dated grid it derives from.
 *
 * What it does NOT drive is any move — nothing on this axis is a drag source or a drop
 * target yet, which is [[Assigning items to a resource]]'s work — so the two assertions
 * about that are here as the statement of a deliberate narrowing rather than as coverage
 * of a feature.
 */

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/**
 * A roadmap opened on the resources axis, with Alice and Bob declared. `only` narrows
 * what the Base returns, so everything else in the vault loads as context; `focus` is UI
 * state and never a config key (ADR 0011), which is why it goes to the harness rather
 * than into the view options beside the roster.
 */
function laneRoadmap(vault: FakeVault, { only, focus }: { only?: string[]; focus?: string } = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob' }, {
		collapsed: true,
		only,
		focus,
	});
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	return harness;
}

describe('the resources axis on screen', () => {
	it('draws a row per declared resource, empty or not, then the minted ones', () => {
		const harness = laneRoadmap(resourceVault());
		expect(laneNames(harness.containerEl)).toEqual(['Alice', 'Bob', 'Zoe']);
	});

	it('draws each resource’s bars under that resource’s own header', () => {
		const harness = laneRoadmap(resourceVault());
		// Bob is declared and empty, so his header is followed straight by Zoe's; the
		// undated and unassigned results are on the shelf rather than in any row.
		expect(laneOrder(harness.containerEl)).toEqual([
			'lane:Alice',
			'Alice dated',
			'Cased',
			'lane:Bob',
			'lane:Zoe',
			'Stray',
		]);
	});

	it('marks a minted row as outside the declared roster', () => {
		const harness = laneRoadmap(resourceVault());
		const [alice, bob, zoe] = lanesOf(harness.containerEl);
		expect(alice.classList.contains('pbl-lane-undeclared')).toBe(false);
		expect(bob.classList.contains('pbl-lane-undeclared')).toBe(false);
		expect(zoe.classList.contains('pbl-lane-undeclared')).toBe(true);
		expect(zoe.querySelector('.pbl-lane-stray')).not.toBeNull();
	});

	it('counts result bars on the header, and shelves what has no row to sit in', () => {
		const harness = laneRoadmap(resourceVault());
		const [alice, bob] = lanesOf(harness.containerEl);
		expect(laneCountOf(alice)).toBe('2');
		expect(laneCountOf(bob)).toBe('0');
		// `Nobody` names no resource; `Undated` names one and has no date to be placed at.
		expect(shelfTitles(harness.containerEl).sort()).toEqual(['Nobody', 'Undated']);
	});

	it('names the resource on each of its rows, since the header cannot label them', () => {
		// The header is a sibling div, not a container — every row is positioned against
		// one shared day grid — and no chip on a bar row says who it belongs to. Without
		// this the axis is unreadable without sight.
		const harness = laneRoadmap(resourceVault());
		const rows = harness.containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row');
		expect(rows[0].getAttribute('aria-description')).toBe('Assigned to Alice');
		expect(rows[1].getAttribute('aria-description')).toBe('Assigned to Alice');
		expect(rows[2].getAttribute('aria-description')).toBe('Assigned to Zoe');
	});

	it('offers no grip on a bar, because nothing on this axis accepts a drop yet', () => {
		// A move here writes an assignee, not dates, so the grid wires no drop target —
		// and a grip advertised over a grid with nothing to land on is the failure this
		// withholding exists to prevent.
		const harness = laneRoadmap(resourceVault());
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
		expect(harness.containerEl.querySelectorAll('.pbl-bar')).not.toHaveLength(0);
	});

	it('keeps the dated axis’s own grips, which this axis only withholds for itself', () => {
		// The control beside the case above: the withholding is per axis, not a deletion.
		const harness = laneRoadmap(resourceVault());
		// `setAxisPick` re-renders itself — no config was set, so no Bases refresh follows.
		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
	});
});

describe('a context row inside a resource row', () => {
	/**
	 * The Base returns only the Feature; its Epic loads as context. A FOCUS level is what
	 * puts that Epic in the roadmap's row set at all — unfocused, the row set is
	 * `model.results`, which holds no context rows — exactly as the horizon axis's own
	 * context tests set up.
	 */
	function contextVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Outside epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Outside epic',
		});
		return vault;
	}

	it('draws in the row that places it, with no bar of its own', () => {
		const harness = laneRoadmap(contextVault(), { only: ['Result.md'], focus: 'Epic' });

		expect(laneOrder(harness.containerEl)).toEqual(['lane:Alice', 'Outside epic', 'lane:Bob']);
		const context = harness.containerEl.querySelector<HTMLElement>('.pbl-lane-context');
		expect(context).not.toBeNull();
		// Never a positioned bar, dated or not: the dated axis this one derives from never
		// draws a context row's dates either.
		expect(context?.querySelector('.pbl-bar')).toBeNull();
	});

	it('is never counted, and never shelved', () => {
		const harness = laneRoadmap(contextVault(), { only: ['Result.md'], focus: 'Epic' });

		// Placement, not population — the bucket axis's rule over a different property.
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('0');
		expect(shelfTitles(harness.containerEl)).toEqual([]);
	});
});
