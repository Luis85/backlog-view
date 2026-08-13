// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { shelfRemoval } from '../../src/view/render/shelf';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { laneCountOf, laneNames, laneOrder, lanesOf, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/**
 * The resources axis on screen: one row per resource over the dated grid it derives from.
 *
 * What a move DOES is `test/view/resourceMoves.test.ts`'s subject and is not repeated
 * here. What stays is the one half of it this file is about: a bar on this axis offers no
 * date grip, because a move here writes an assignee and the grid registers no target a
 * date gesture could land on.
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

	it('offers no date grip on a bar, because a move here writes an assignee', () => {
		// The bar IS a drag source now, wired as an ordinary card — but a grip writes a
		// DATE, and this grid registers no positional target for one. What the drag does
		// instead is `test/view/resourceMoves.test.ts`'s.
		const harness = laneRoadmap(resourceVault());
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
		expect(harness.containerEl.querySelectorAll('.pbl-bar')).not.toHaveLength(0);
	});

	it('offers a New button per row, naming the resource it creates for', () => {
		const harness = laneRoadmap(resourceVault());
		const add = lanesOf(harness.containerEl)[0].querySelector<HTMLButtonElement>('.pbl-lane-add');
		expect(add).not.toBeNull();
		// `tabindex="-1"` like the bucket's and the tree's: the pane is one tab stop, and a
		// row is not a keyboard stop of its own yet.
		expect(add?.getAttribute('tabindex')).toBe('-1');
		expect(add?.getAttribute('aria-label')).toBe('New Epic for Alice');
	});

	it('opens the ordinary New flow from a row, for that row’s own resource', () => {
		const harness = laneRoadmap(resourceVault());
		lanesOf(harness.containerEl)[0].querySelector<HTMLButtonElement>('.pbl-lane-add')?.click();

		// The same gated prompt the toolbar's New opens — this button adds a placement to
		// it and changes nothing else about where the note lands.
		expect(Modal.lastOpened).not.toBeNull();
	});

	it('offers a shelf that un-assigns, and takes any shelved card as a source', () => {
		// Asked at the object as well as through a gesture: the strip must not highlight
		// for a drag it would not honour, and a shelved card that could not be picked up
		// would leave triage a one-way street.
		const harness = laneRoadmap(resourceVault());
		const removal = shelfRemoval(harness.view, 'resources');
		const item = harness.view.model?.byPath.get('Undated.md');

		// A grip released here is not an un-assignment; an ordinary card is.
		expect(removal.accepts({ item, hold: 'body' } as never)).toBe(false);
		expect(removal.accepts({ item, hold: null } as never)).toBe(true);
		expect(removal.canDrag(item as never)).toBe(true);
		// Nothing to distinguish before the release: a drop here always un-assigns.
		expect(removal.outcome).toBeNull();
	});

	it('keeps the dated axis’s own grips, which this axis only withholds for itself', () => {
		// The control beside the case above: the withholding is per axis, not a deletion.
		const harness = laneRoadmap(resourceVault());
		// `setAxisPick` re-renders itself — no config was set, so no Bases refresh follows.
		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
	});
});

describe('the assignee chip on this axis', () => {
	/** The roster, with the assignee property ALSO drawn as a column — what draws a chip. */
	function chipRoadmap() {
		const harness = laneRoadmap(resourceVault());
		harness.config.order = ['note.assignee'];
		harness.view.onDataUpdated();
		harness.view.setShelfCollapsed(false);
		return harness;
	}

	it('does not draw on a bar row — the row it sits in already says whose it is', () => {
		// True by construction today: a bar row wears the card SHELL and never goes
		// through `renderCardBody`, which is what draws the chips. This is the check under
		// that sentence rather than a second mechanism enforcing it.
		const harness = chipRoadmap();
		const rows = harness.containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row');
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) expect(row.querySelector('.pbl-assignee-chip')).toBeNull();
	});

	it('still draws on a shelf card, where no row says it', () => {
		// The other direction, and the reason the rule is about POSITION rather than about
		// the axis: `Undated` names a resource and sits on the shelf, so nothing on screen
		// would say who it belongs to if the chip were withheld here too.
		const harness = chipRoadmap();
		const shelf = harness.containerEl.querySelector<HTMLElement>('.pbl-shelf');
		const chips = Array.from(shelf?.querySelectorAll<HTMLElement>('.pbl-assignee-chip') ?? []);
		expect(chips.map((chip) => chip.textContent)).toContain('Alice');
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
