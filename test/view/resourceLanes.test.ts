// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { shelfRemoval } from '../../src/view/render/shelf';
import { clickExpandAll, Harness, key, makeView, treeOf, useViewHarness } from '../helpers/view';
import { gripNames, laneAwayOf, laneCountOf, laneNames, laneOrder, lanesOf, rowFor, shelfTitles } from '../helpers/roadmap';
import { countingVault, resourceVault } from '../helpers/resources';
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

/**
 * A roadmap opened on the resources axis, with Alice and Bob declared. `only` narrows
 * what the Base returns, so everything else in the vault loads as context; `focus` is UI
 * state and never a config key (ADR 0011), which is why it goes to the harness rather
 * than into the view options beside the roster.
 */
function laneRoadmap(
	vault: FakeVault,
	{ only, focus, expanded, config }: { only?: string[]; focus?: string; expanded?: boolean; config?: Record<string, unknown> } = {},
): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...config }, {
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
		expect(laneCountOf(bob)).toBe('');
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

	/** Alice's own near-dated parent, alone — the window this fixture would draw with no far bar at all. */
	function nearOnlyVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: dayFromToday(0), due: dayFromToday(5) },
		});
		return vault;
	}

	/** The same parent, plus a child a year out — far enough to widen the grid if anything draws it. */
	function nearAndFarVault(): FakeVault {
		const vault = nearOnlyVault();
		vault.addFile('Far child.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: dayFromToday(400), due: dayFromToday(405) },
			parentLink: 'Epic',
		});
		return vault;
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

	it('does not report the plan empty when every band that holds work is folded', () => {
		// A folded band draws its header, its count and its rail, and produces no `'row'`
		// entry at all — so the advisory's population, read off what the axis DREW, went
		// to zero and told the reader every item was done and hidden while their work sat
		// on screen behind a chevron they could reopen. The horizons axis was given the
		// model's own count for exactly this reason when a bucket learnt to fold; this
		// axis kept the drawn one after its bands learnt the same trick.
		const { containerEl } = laneRoadmap(nestedVault(), { expanded: true });
		for (const name of ['Alice', 'Bob'])
			bandChevron(containerEl, name)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The premise beside the conclusion: nothing on the grid is a row any more.
		expect(rowFor(containerEl, 'Epic')).toBeNull();
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
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

	it('does not widen the grid for a row-collapsed subtree whose child is far future', () => {
		// The narrower half of `drawnSpans`' fix: it reads a folded BAND's bars from the
		// LANE ENTRY's own `collapsed`, never from `lane.bars` unconditionally. An open
		// band's row-collapsed subtree draws nothing at all — not a row, not a rail — so it
		// must not widen the window either, or eleven months of empty gridlines is exactly
		// what a reader who folded that one bar away would still have to scroll past.
		const harness = laneRoadmap(nearAndFarVault(), { expanded: true });
		rowChevron(harness.containerEl, 'Epic')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const baseline = laneRoadmap(nearOnlyVault());
		// The direct reading `test/view/timelineFurniture.test.ts` and `timelineDrag.test.ts`
		// already use, rather than a proxy over how many header cells happened to render —
		// and pinned with a concrete floor rather than compared bare, since an unconfigured
		// window on both sides (`undefined`) would satisfy an equality just as loudly as an
		// actual match and say nothing at all. A month padded either side of a five-day span
		// is comfortably past 30 days on any calendar.
		const baselineDays = baseline.view.roadmap?.window?.days;
		expect(baselineDays, 'the baseline drew no window at all').toBeGreaterThan(30);
		expect(harness.view.roadmap?.window?.days).toBe(baselineDays);
	});

	it('widens the grid for a folded band whose own bar is far future', () => {
		// The other half of the same fix: a folded BAND draws no rows either, but it does
		// draw a rail — so unlike the row-collapsed case above, its bars must still reach
		// the window or the rail it needs them for has nothing to draw into.
		const harness = laneRoadmap(nearAndFarVault(), { expanded: true });
		harness.view.setLaneCollapsed('Alice', true);

		const baseline = laneRoadmap(nearOnlyVault());
		// The direct reading, not the header-cell proxy — see the sibling test above. Pinned
		// the same way: `?? 0` here would let an unconfigured baseline (`undefined`) satisfy
		// the comparison as soon as the harness drew ANY window at all, which is the carried
		// fix the sibling test above got and this one did not.
		const baselineDays = baseline.view.roadmap?.window?.days;
		expect(baselineDays, 'the baseline drew no window at all').toBeGreaterThan(30);
		expect(harness.view.roadmap?.window?.days).toBeGreaterThan(baselineDays as number);
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
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('');
		expect(shelfTitles(harness.containerEl)).toEqual([]);
	});

	/**
	 * It claims to be a card — `createCard` gives it `role="option"` — so it has to be one:
	 * assistive tech counts an `option` a reader cannot land on, which is worse than a row
	 * that never drew. Two halves, each of which failed on its own, and each of which the
	 * two cases above pass right through: `drawnCards` is the pane's reading order and used
	 * to be a bars-only walk, and `renderLaneContextRow` used to draw the row without
	 * `wireCardActivation`. See [[A lane context row could not be reached]]; this replaces
	 * the check that went with `roadmapMatches.test.ts`.
	 *
	 * **The WHERE is a third thing, and it needs a second band to be asked at all.**
	 * `drawnCards` promises DRAW order — "a kind is inserted where it draws and never
	 * appended at the end" — and a walk that ends `[...bars, ...contexts]` keeps every
	 * reachability claim above while sending a reader who arrows down off the row they can
	 * see into another person's band. With one drawn row in the fixture, "first stop" is
	 * the only stop and says nothing; Bob's own dated Epic is what makes it an ordering.
	 * The screen order is asserted first, because "the walk matches the screen" is not a
	 * claim a walk can make on its own.
	 */
	it('stops where it DRAWS, above the next band’s bar, and Enter opens its note', () => {
		const vault = contextVault();
		// A RESULT of Bob's, so it draws a bar row in the band below Alice's — the row the
		// appended walk would visit first.
		vault.addFile('Bob epic.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Bob', start: '2026-08-01', due: '2026-08-02' },
		});
		const { containerEl } = laneRoadmap(vault, { only: ['Result.md', 'Bob epic.md'], focus: 'Epic' });
		const tree = treeOf(containerEl);
		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Outside epic', 'lane:Bob', 'Bob epic']);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')?.classList.contains('pbl-lane-context')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened.map((o) => o.path)).toEqual(['Outside epic.md']);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected .pbl-card-title')?.textContent).toBe('Bob epic');
	});

	it('opens its note on a click, like every other card on this grid', () => {
		const vault = contextVault();
		const { containerEl } = laneRoadmap(vault, { only: ['Result.md'], focus: 'Epic' });

		containerEl
			.querySelector<HTMLElement>('.pbl-lane-context')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(vault.opened.map((o) => o.path)).toEqual(['Outside epic.md']);
	});
});

describe('the band header’s readout', () => {
	it('reports the items and the weeks away as two separate things', () => {
		const vault = countingVault([
			{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) },
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(11) },
		]);
		const harness = laneRoadmap(vault);
		const alice = lanesOf(harness.containerEl)[0];

		expect(laneCountOf(alice)).toBe('1 item');
		// The ended stretch is not counted — the filter is the whole reason the pill exists.
		expect(laneAwayOf(alice)).toBe('1 wk away');
	});

	it('drops the item count entirely at zero rather than reading a zero', () => {
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: dayFromToday(5), due: dayFromToday(9) },
		});
		const harness = laneRoadmap(vault);
		const bob = lanesOf(harness.containerEl)[1];

		expect(laneCountOf(bob)).toBe('');
		expect(laneAwayOf(bob)).toBe('1 wk away');
	});

	it('drops the pill when nothing is still to come', () => {
		const vault = countingVault([{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) }]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item');
		expect(laneAwayOf(lanesOf(harness.containerEl)[0])).toBe('');
	});

	it('weights the pill up where the resource also holds work', () => {
		// A busy-and-away row is the loudest thing in the column, because it is the one a
		// planner has to do something about.
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: dayFromToday(5), due: dayFromToday(9) },
		});
		const harness = laneRoadmap(vault);

		expect(lanesOf(harness.containerEl)[0].querySelector('.pbl-lane-away')?.className).toContain('pbl-lane-away-busy');
		expect(lanesOf(harness.containerEl)[1].querySelector('.pbl-lane-away')?.className).not.toContain(
			'pbl-lane-away-busy',
		);
	});

	it('keeps both the readout and the mark on a COLLAPSED band', () => {
		// `laneEntries` skips a collapsed band's WORK rows, never its header — and since
		// 2026-08-14 the stretch is drawn in the header's own track, not in a row `laneEntries`
		// could skip. So folding takes the work rows off screen and leaves both the readout and
		// the mark exactly as they were, which is what "one row per person whatever they have"
		// means for a folded band: the header is never itself hidden.
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		const harness = laneRoadmap(vault);

		harness.view.setLaneCollapsed('Alice', true);

		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(1);
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item');
		expect(laneAwayOf(lanesOf(harness.containerEl)[0])).toBe('1 wk away');
	});

	it('draws a lane with nothing at all as a quiet row', () => {
		const harness = laneRoadmap(countingVault([]));
		const bob = lanesOf(harness.containerEl)[1];

		// Contrast, not opacity: a row-level `opacity` would dim the sticky lead column with
		// it, which is the trap `styles/lanes.css` records at the context row's own muting.
		expect(bob.classList.contains('pbl-lane-quiet')).toBe(true);
		expect(lanesOf(harness.containerEl)[0].classList.contains('pbl-lane-quiet')).toBe(false);
	});

	it('is not quiet when the only thing it holds is a stretch', () => {
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		const harness = laneRoadmap(vault);

		expect(lanesOf(harness.containerEl)[0].classList.contains('pbl-lane-quiet')).toBe(false);
	});

	it('draws a load rail for a band folded over work, and none for an open one', () => {
		const harness = laneRoadmap(countingVault([]));

		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(0);
		harness.view.setLaneCollapsed('Alice', true);
		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(1);
	});

	it('draws one rail per continuous run, not one per bar', () => {
		const vault = countingVault([]);
		// Two bars that share days, and one far away: two runs, three bars.
		vault.addFile('Overlapping.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-05', due: '2026-08-15' },
		});
		vault.addFile('Later.md', {
			frontmatter: { type: 'Epic', order: 30, assignee: 'Alice', start: '2026-10-01', due: '2026-10-10' },
		});
		const harness = laneRoadmap(vault);
		harness.view.setLaneCollapsed('Alice', true);

		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(2);
	});

	it('renders the same rows folded and open when a lane holds no work', () => {
		// The check under a REFUSAL: "no work → folded by default" was asked for and declined
		// as inert, because a lane with no bars has nothing beneath its header either way.
		// If that stops being true this fails, and the refusal gets re-decided rather than
		// quietly outliving its reason.
		const harness = laneRoadmap(countingVault([]));
		const rowsWhenOpen = harness.containerEl.querySelectorAll('.pbl-lane-head, .pbl-timeline-row').length;
		// Pinned rather than left to `rowsWhenOpen` alone: a fixture that stopped rendering
		// anything would pass this at 0 === 0 and the refusal would go unchecked in silence.
		// lane:Alice, Work's own row, lane:Bob.
		expect(rowsWhenOpen).toBe(3);

		harness.view.setLaneCollapsed('Bob', true);

		expect(harness.containerEl.querySelectorAll('.pbl-lane-head, .pbl-timeline-row')).toHaveLength(rowsWhenOpen);
	});
});
