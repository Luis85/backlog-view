// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { shelfRemoval } from '../../src/view/render/shelf';
import { clickExpandAll, Harness, makeView, useViewHarness } from '../helpers/view';
import { gripNames, laneCountOf, laneNames, laneOrder, lanesOf, rowFor, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';
import { addDays, formatCivil } from '../../src/domain/timeline';
import { readDate, todayStamp } from '../../src/domain/noteFields';

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
 * `todayCivil()` reads the live clock and no test fakes it, so a fixture that has to be
 * "before today" or "after today" is built from the same clock — the pattern
 * `test/view/timelineLeadGeometry.test.ts` uses for the today line.
 */
const TODAY = readDate(todayStamp()).value ?? { year: 2026, month: 1, day: 1 };
const dayFromToday = (offset: number): string => formatCivil(addDays(TODAY, offset));

/** One resource with one bar, plus whichever stretches a test wants to count. */
function countingVault(stretches: Array<{ title: string; start: string; target: string }>): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	for (const one of stretches) {
		vault.addFile(`${one.title}.md`, {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: one.start, due: one.target },
		});
	}
	return vault;
}

/**
 * A roadmap opened on the resources axis, with Alice and Bob declared. `only` narrows
 * what the Base returns, so everything else in the vault loads as context; `focus` is UI
 * state and never a config key (ADR 0011), which is why it goes to the harness rather
 * than into the view options beside the roster.
 */
function laneRoadmap(
	vault: FakeVault,
	{ only, focus, expanded }: { only?: string[]; focus?: string; expanded?: boolean } = {},
): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob' }, {
		collapsed: !expanded,
		only,
		focus,
	});
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	// AFTER the axis is picked, never in `makeView`: a bar's fold is its own scope, and an
	// expand-all run while the tree is on screen settles the tree's bits and not this
	// grid's.
	if (expanded) clickExpandAll(harness.containerEl);
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
		expect(laneCountOf(alice)).toBe('2 items');
		expect(laneCountOf(bob)).toBe('0 items');
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

	it('offers the dated axis’s own grips, because a release here also says when', () => {
		// A bar sits on the same calendar this grid draws for the dated axis, so it takes the
		// same holds: `barHolds` decides them, and nothing about a row grouping bars by WHO
		// narrows what may be said about WHEN. What a release then does with the two answers
		// is `test/view/resourceMoves.test.ts`'s.
		const harness = laneRoadmap(resourceVault());
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(gripNames(harness.containerEl, 'Alice dated')).toEqual(['body', 'start', 'end']);
	});

	it('offers no way to create work from a row, and no control but Add absence', () => {
		// A resource's row is where work is SEEN, never where it is made: creation supplies
		// no date, so a note created here was assigned and then immediately shelved for want
		// of one — a click on a specific row producing a card somewhere else entirely.
		// Removed rather than announced better (2026-08-14).
		const harness = laneRoadmap(resourceVault());
		const lead = lanesOf(harness.containerEl)[0];
		const controls = Array.from(lead.querySelectorAll<HTMLElement>('.pbl-lane-ctl'));

		expect(controls.map((el) => el.getAttribute('aria-label'))).toEqual(['Add absence for Alice']);
	});

	it('offers a shelf that un-assigns, and takes any shelved card as a source', () => {
		// Asked at the object as well as through a gesture: the strip must not highlight
		// for a drag it would not honour, and a shelved card that could not be picked up
		// would leave triage a one-way street.
		const harness = laneRoadmap(resourceVault());
		const removal = shelfRemoval(harness.view, 'resources');
		const item = harness.view.model?.byPath.get('Undated.md');

		// A grip released here is not an un-assignment — that is a resize that overshot. A
		// bar arriving by either body hold is, and so is a shelf card.
		expect(removal.accepts({ item, hold: 'start' } as never)).toBe(false);
		expect(removal.accepts({ item, hold: 'end' } as never)).toBe(false);
		expect(removal.accepts({ item, hold: 'body' } as never)).toBe(true);
		expect(removal.accepts({ item, hold: null } as never)).toBe(true);
		expect(removal.canDrag(item as never)).toBe(true);
		// Nothing to distinguish before the release: a drop here always un-assigns.
		expect(removal.outcome).toBeNull();
	});

	it('withholds every hold from an inferred bar, exactly as the dated axis does', () => {
		// A bar behaves the same on both grids. `barHolds` withholds every hold from a span
		// the note does not state — sliding one is a resize wearing a slide's cursor — and
		// that refusal is not narrowed here just because a row means something: an inferred
		// bar is not a drag source on either axis. What still moves it between bands is Set
		// assignee and Alt+Up/Down, which name a value rather than displacing one.
		const vault = resourceVault();
		vault.addFile('Rollup.md', { frontmatter: { type: 'Epic', order: 40, assignee: 'Alice' } });
		vault.addFile('Rollup child.md', {
			frontmatter: { type: 'Feature', parent: 'Rollup', order: 10, assignee: 'Bob', start: '2026-08-02', due: '2026-08-09' },
		});
		const harness = laneRoadmap(vault);

		expect(gripNames(harness.containerEl, 'Rollup')).toEqual([]);
		// `setAxisPick` re-renders itself — no config was set, so no Bases refresh follows.
		harness.view.setAxisPick('dates');
		expect(gripNames(harness.containerEl, 'Rollup')).toEqual([]);
	});
});

describe('folding on the resources axis', () => {
	/** A band whose parent and child are on ONE resource, and a child on another. */
	function nestedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-20' },
		});
		vault.addFile('Same band.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-02', due: '2026-08-05' },
			parentLink: 'Epic',
		});
		vault.addFile('Other band.md', {
			frontmatter: { type: 'Feature', order: 20, assignee: 'Bob', start: '2026-08-06', due: '2026-08-09' },
			parentLink: 'Epic',
		});
		return vault;
	}

	/** A BAR row's own disclosure — null where it drew the leaf placeholder instead. */
	function rowChevron(containerEl: HTMLElement, title: string): HTMLElement | null {
		return rowFor(containerEl, title)?.querySelector<HTMLElement>('.pbl-chevron:not(.pbl-leaf)') ?? null;
	}

	function bandChevron(containerEl: HTMLElement, name: string): HTMLButtonElement | null {
		const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
		return head?.querySelector<HTMLButtonElement>('.pbl-chevron') ?? null;
	}

	it('folds a whole band from its header, and says so where a header can', () => {
		const { containerEl } = laneRoadmap(nestedVault(), { expanded: true });
		const chevron = bandChevron(containerEl, 'Alice');

		expect(chevron?.getAttribute('aria-expanded')).toBe('true');
		expect(chevron?.getAttribute('aria-label')).toBe("Hide Alice's work");
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The header stays — a folded band is a row you can reopen, not a row that went.
		expect(laneNames(containerEl)).toEqual(['Alice', 'Bob']);
		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'lane:Bob', 'Other band']);
		expect(bandChevron(containerEl, 'Alice')?.getAttribute('aria-label')).toBe("Show Alice's work");
	});

	it('puts focus on the pane when the disclosure that held it is folded away', () => {
		// Folding a band redraws the whole projection, so the button pressed is gone — and a
		// browser drops focus to the body, where the pane's arrows and menu keys do nothing.
		// The PANE, never the replacement chevron: `handleRoadmapKeydown` returns on any
		// event whose target is not the pane itself, so focusing a `tabindex="-1"` control
		// inside the composite would look right and silently kill the arrow keys.
		const { containerEl } = laneRoadmap(nestedVault(), { expanded: true });
		const chevron = bandChevron(containerEl, 'Alice');
		chevron?.focus();

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-tree'));
	});

	it('draws a disclosure on an empty band too, so a long roster still folds away', () => {
		// A declared resource with nothing on it is exactly the row a roster exists to put on
		// screen; a control that appeared only once work arrived would move under the reader.
		const { containerEl } = laneRoadmap(resourceVault());

		expect(bandChevron(containerEl, 'Bob')).not.toBeNull();
	});

	it('folds a bar’s subtree only as far as its OWN band reaches', () => {
		// The refusal this axis carried until 2026-08-14, answered rather than kept: a
		// chevron here is computed per lane, so it can only reach bars drawn in its own row.
		//
		// Opened EXPANDED, because this axis now shares the dated one's fold bit and
		// therefore its default: a parent nobody has ruled on starts shut
		// (`collapseNewParents`), so the collapsed harness would have nothing left to fold.
		const { containerEl } = laneRoadmap(nestedVault(), { expanded: true });

		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Epic', 'Same band', 'lane:Bob', 'Other band']);
		rowChevron(containerEl, 'Epic')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Its child in Alice's band goes; the one in Bob's stays, because Bob's row is not
		// something Alice's chevron has any business hiding.
		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Epic', 'lane:Bob', 'Other band']);
	});

	it('draws no disclosure on a bar whose only children are in another band', () => {
		const vault = nestedVault();
		vault.fm('Same band.md')['assignee'] = 'Bob';
		const { containerEl } = laneRoadmap(vault, { expanded: true });

		// Holding nothing back from where it sits, so it says so: a leaf, not a shut row.
		expect(rowChevron(containerEl, 'Epic')).toBeNull();
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
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('0 items');
		expect(shelfTitles(harness.containerEl)).toEqual([]);
	});
});

describe('the band header’s readout', () => {
	it('names the pending absences beside the items, and only the pending ones', () => {
		// The filter on today is the whole reason this readout exists: the rows below draw
		// every stretch a resource ever had, so a finished one is exactly what the reader
		// does not want counted.
		const vault = countingVault([
			{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) },
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) },
		]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item / 1 absence');
	});

	it('pluralizes each half on its own count', () => {
		const vault = countingVault([
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) },
			{ title: 'Later', start: dayFromToday(20), target: dayFromToday(24) },
		]);
		vault.addFile('More work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-02', due: '2026-08-04' },
		});
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('2 items / 2 absences');
	});

	it('drops the absence half entirely with nothing pending', () => {
		// `0 absences` reports nothing the reader needed and would sit on nearly every band.
		const vault = countingVault([{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) }]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item');
	});

	it('keeps the readout on a COLLAPSED band, where no stretch is drawn at all', () => {
		// The one case the header is the only surface for, and the reason this ships at all:
		// `laneEntries` skips the whole band, so a folded roster shows no hatch anywhere.
		// Deliberately the opposite of the legend's rule, which keys what the pass PAINTED.
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		const harness = laneRoadmap(vault);

		harness.view.setLaneCollapsed('Alice', true);

		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item / 1 absence');
	});
});
