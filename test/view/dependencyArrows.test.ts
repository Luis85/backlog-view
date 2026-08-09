// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { roadmapView, rowFor, shelfOf, shelfTitles, timelineRows } from '../helpers/roadmap';

/**
 * The arrow layer on the dated axis — `renderDependencyArrows` in
 * `src/view/render/timeline.ts`, drawing exactly the edges `dependencyArrows`
 * (`src/domain/dependencies.ts`, Task 1) hands it. Which pairs have an edge at all is
 * that module's own suite (`test/domain/dependencyArrows.test.ts`); this asks only
 * whether the layer draws one element per edge, marks a conflict on both ends, adds
 * nothing focusable, and writes nothing — `docs/requirements/Arrows between bars.md`.
 *
 * The row's own STATEMENT of a dependency (main flow step 3, Task 3) is a separate
 * concern from the picture: it must hold whether or not an arrow drew, so several
 * suites below deliberately construct an edge the arrow layer draws NOTHING for
 * (1a's no-bar prerequisite, an edge wholly outside the drawn window) and assert the
 * row states it anyway.
 */

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due', dependsOnProperty: 'note.dependsOn' };

/**
 * One entry per drawn EDGE — and the selector is the whole check on 4a, so it has to be
 * the ELEMENT the layer costs per edge rather than some feature of one. It briefly was
 * not: an intermediate version drew each route as four to six positioned divs and this
 * helper was narrowed to count arrowheads, which kept every test passing while the bound
 * the note states had stopped being true. The route is one `<path>` again, so counting
 * paths is counting edges, and a version that goes back to several nodes per edge fails
 * here rather than reading as a pass.
 */
function arrows(containerEl: HTMLElement): SVGElement[] {
	return Array.from(containerEl.querySelectorAll<SVGElement>('.pbl-dep-edge'));
}

/** What a row's accessible name says it waits for, or null where it says nothing. */
function waitsFor(row: HTMLElement): string | null {
	return row.querySelector<HTMLElement>('.pbl-dependency-note')?.textContent ?? null;
}

/** The shelved card for a given title, or null when it is not on the shelf at all. */
function shelfCardFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	const cards = Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-card') ?? []);
	return cards.find((c) => c.querySelector('.pbl-card-title')?.textContent === title) ?? null;
}

/** What a shelved card visibly states it waits for, or null where it says nothing. */
function shelfWaitsFor(containerEl: HTMLElement, title: string): string | null {
	return shelfCardFor(containerEl, title)?.querySelector<HTMLElement>('.pbl-shelf-dependency')?.textContent ?? null;
}


/**
 * Give every timeline row a real, distinct rect, in DOM order — jsdom measures nothing,
 * so without this every row shares y=0 and the routing branch that depends on where the
 * two rows actually landed is never taken. Installed on the PROTOTYPE before the view is
 * built, because the arrow layer reads these during the render it is filled by.
 */
function stackRows(height = 30): void {
	const real = Element.prototype.getBoundingClientRect;
	Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
		if (!this.classList.contains('pbl-timeline-row')) return real.call(this);
		const rows = Array.from(this.parentElement?.querySelectorAll('.pbl-timeline-row') ?? []);
		const top = rows.indexOf(this) * height;
		return { top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
	};
}

describe('one element per edge', () => {
	it('draws exactly the edges dependencyArrows returns, not one per pair of rows', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-09-01', due: '2026-09-05' } });
		vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40, start: '2026-09-10', due: '2026-09-20' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(4);
		expect(arrows(containerEl)).toHaveLength(1);
	});

	it('draws nothing when dependencyArrows returns no edge at all — a shelved prerequisite has no bar', () => {
		// Which pairs have an edge is Task 1's own rule (`dependencyArrows`, covering the
		// Base filter, broken edges and no-bar ends alike) and this suite does not
		// re-test it — only that an empty edge list costs the layer nothing to draw.
		const vault = new FakeVault();
		vault.addFile('Undated.md', { frontmatter: { type: 'PBI', order: 10 } }); // shelved: no bar
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Undated', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(1);
		expect(arrows(containerEl)).toHaveLength(0);
	});

	it('draws nothing for an edge whose dependent lies wholly outside the drawn window', () => {
		// The window clamps around today once the plan spans more than MAX_TIMELINE_DAYS
		// (`timelineWindow`); a bar centuries out still renders (as an outside mark) but
		// `dependencyAnchor` reports it has nothing of itself in view — the render-time
		// half of 1a no domain edge list can see.
		const vault = new FakeVault();
		vault.addFile('Anchor.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('Far.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Anchor', start: '2200-01-01', due: '2200-01-05' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(2);
		expect(arrows(containerEl)).toHaveLength(0);
	});
});

describe('a conflict is marked on the arrow and the dependent row, and only those', () => {
	it('marks exactly the conflicting edge and its dependent, leaving the other pair unmarked', () => {
		const vault = new FakeVault();
		vault.addFile('Prereq1.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('Clear.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Prereq1', start: '2026-08-15', due: '2026-08-20' },
		});
		vault.addFile('Prereq2.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('Overlap.md', {
			frontmatter: { type: 'PBI', order: 40, dependsOn: 'Prereq2', start: '2026-08-05', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(2);
		expect(arrows(containerEl).filter((a) => a.classList.contains('pbl-dep-conflict'))).toHaveLength(1);
		expect(rowFor(containerEl, 'Clear')?.hasClass('pbl-row-conflict')).toBe(false);
		expect(rowFor(containerEl, 'Overlap')?.hasClass('pbl-row-conflict')).toBe(true);
	});
});

/**
 * Main flow step 3: every dependent row's accessible name states what it waits for,
 * marking the conflict on the specific prerequisite it concerns — not a blanket "in
 * conflict" that rounds a multi-prerequisite row down to the picture's coarsest bit.
 */
describe("the row's accessible name states what it waits for", () => {
	it('names a single prerequisite with no conflict', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(waitsFor(rowFor(containerEl, 'B')!)).toBe('Waits for A');
	});

	it('names both prerequisites of a row waiting on two, marking only the one that conflicts', () => {
		const vault = new FakeVault();
		vault.addFile('Clear.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01', due: '2026-07-05' } });
		vault.addFile('Late.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 30, dependsOn: ['Clear', 'Late'], start: '2026-08-10', due: '2026-08-25' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const row = rowFor(containerEl, 'Waiter')!;
		expect(waitsFor(row)).toBe('Waits for Clear, Late (conflict)');
		expect(row.hasClass('pbl-row-conflict')).toBe(true);
	});

	it('names the PATH where two prerequisites share a title, so the conflict says which note', () => {
		const vault = new FakeVault();
		vault.addFile('Work/A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01', due: '2026-07-05' } });
		vault.addFile('Play/A.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Waiter.md', {
			frontmatter: {
				type: 'PBI',
				order: 30,
				dependsOn: ['Work/A', 'Play/A'],
				start: '2026-08-10',
				due: '2026-08-25',
			},
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		// A title is a basename. "Waits for A (conflict), A" names the sentence and not
		// the note, so the row cannot say which of the two contradicts its dates — the
		// pickers answer the same ambiguity with the path, and so does this.
		expect(waitsFor(rowFor(containerEl, 'Waiter')!)).toBe('Waits for Work/A.md, Play/A.md (conflict)');
	});

	it('still states the dependency when the prerequisite has no bar at all (1a) — no arrow, no comparison, just the name', () => {
		const vault = new FakeVault();
		vault.addFile('Undated.md', { frontmatter: { type: 'PBI', order: 10 } }); // shelved: no bar
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Undated', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(0);
		const row = rowFor(containerEl, 'Waiter')!;
		expect(waitsFor(row)).toBe('Waits for Undated');
		expect(row.hasClass('pbl-row-conflict')).toBe(false);
	});

	it('says nothing about dependencies on a marker row, because a milestone declares none', () => {
		// A deliberate REVERSAL. This test asserted the opposite until 2026-08-09 — a
		// marker's row folding "Waits for A (conflict)" into its explicit label — and the
		// product rule changed under it: a milestone is a point in time, so it waits for
		// nothing. The frontmatter here is exactly what the old test used, kept so the
		// case being reversed is the case being read: a marker whose note still SAYS
		// `dependsOn: A`, and a prerequisite whose span would have conflicted with it.
		//
		// Nothing about the label's mechanism changed; there is simply nothing to fold in
		// now, because `readItems` gives a marker no entries to derive from.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, dependsOn: 'A', due: '2026-08-05' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(rowFor(containerEl, 'Ship')?.getAttribute('aria-label')).toBe('Ship — Milestone 2026-08-05');
		expect(rowFor(containerEl, 'Ship')?.hasClass('pbl-row-conflict')).toBe(false);
		// And no arrow, from either end: the declaration is gone, not merely unspoken.
		expect(arrows(containerEl)).toHaveLength(0);
	});

	it('says nothing where the row waits for nothing', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(waitsFor(rowFor(containerEl, 'A')!)).toBeNull();
	});
});

/**
 * Concern 2 of Task 3: the guarantee is window-independent. The visual mark used to
 * be applied only where `renderDependencyArrows`' own anchor+row lookups survived —
 * which the drawn WINDOW filters — so an edge clear outside it went unmarked despite
 * being a real, domain-computed conflict. Both the class and the name have to come
 * from the same source an arrow's presence does not gate.
 */
describe('the conflict mark is independent of the drawn window', () => {
	it('marks the row even when the edge lies wholly outside the window and no arrow draws', () => {
		const vault = new FakeVault();
		// Both centuries out, so `timelineWindow` clamps around today and neither bar
		// has any part of itself in the drawn range — `dependencyAnchor` returns null
		// and `renderDependencyArrows` draws nothing, exactly as the 1a/1b window test
		// above already establishes for a NON-conflicting edge.
		vault.addFile('Anchor.md', { frontmatter: { type: 'PBI', order: 10, start: '2200-01-01', due: '2200-01-10' } });
		vault.addFile('Far.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Anchor', start: '2200-01-05', due: '2200-01-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(0);
		const row = rowFor(containerEl, 'Far')!;
		expect(row.hasClass('pbl-row-conflict')).toBe(true);
		expect(waitsFor(row)).toBe('Waits for Anchor (conflict)');
	});
});

/**
 * Concern 3 of Task 3: `dependencyArrows`' `shelfConflicts` (2b) is computed by the
 * domain and, until now, rendered nowhere — the shelf card is that dependent's row
 * (1b), and no arrow ever reaches it, so the card itself is the only place left to
 * state the contradiction.
 */
describe('the shelf card states a 2b conflict the domain computed, with no arrow drawn', () => {
	it('marks the shelf card when its own stated start conflicts with a dated prerequisite', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('B.md', {
			// A stated, readable start, shelved for an unreadable target — 2b.
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', due: 'not-a-date' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(0);
		expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-conflict')).not.toBeNull();
	});

	it('marks nothing once the same stated start no longer conflicts', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-11', due: 'not-a-date' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-conflict')).toBeNull();
	});

	it('marks nothing on the horizon axis, even with the same dates that conflict on the dated axis', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {
			frontmatter: { type: 'PBI', order: 10, horizon: 'Now', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('B.md', {
			// No horizon: shelved on this axis, regardless of what its dates say.
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', due: 'not-a-date' },
		});
		const harness = roadmapView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
			dependsOnProperty: 'note.dependsOn',
		});

		expect(shelfTitles(harness.containerEl)).toContain('B');
		expect(harness.containerEl.querySelector('.pbl-shelf-conflict')).toBeNull();
	});

	/**
	 * `Arrows between bars`' Preconditions scope the whole feature — the statement
	 * included, not only the conflict mark — to "Roadmap mode is on with the dated
	 * axis". A prior round gated only the conflict class on the map being non-empty
	 * (always true on the horizon axis) and left `dependencyNote`'s plain "Waits for
	 * X" text unconditional, so it leaked onto the horizon axis's shelf despite there
	 * being no conflict to show. Same vault, same `dependsOn`, both prerequisites
	 * real and readable: only the axis differs.
	 */
	it('states nothing on a horizon-axis shelf card even with a real, readable prerequisite — but does on the dated axis', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {
			frontmatter: { type: 'PBI', order: 10, horizon: 'Now', start: '2026-08-01', due: '2026-08-10' },
		});
		// Shelved on every axis: no horizon, no dates.
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } });

		const horizon = roadmapView(vault, {
			horizonProperty: 'note.horizon',
			dependsOnProperty: 'note.dependsOn',
		});
		expect(shelfTitles(horizon.containerEl)).toContain('B');
		expect(shelfWaitsFor(horizon.containerEl, 'B')).toBeNull();

		const dated = roadmapView(vault, { ...DATES });
		expect(shelfTitles(dated.containerEl)).toContain('B');
		expect(shelfWaitsFor(dated.containerEl, 'B')).toBe('Waits for A');
	});
});

/**
 * Fix round, item 1 (Critical): a shelf card is that dependent's row under 1b, and
 * step 3 requires every rendered dependent's row to state what it waits for whether
 * or not it is in conflict — not only when 2b happens to flag one.
 */
describe('the shelf card states what it waits for even with no conflict at all', () => {
	it('names a prerequisite on a shelved card that has nothing to conflict with', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		// No dates at all: shelved with no stated start, so 2b's own rule exempts it —
		// "unplanned is not late" — and no conflict is possible, only the plain fact.
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(shelfCardFor(containerEl, 'B')?.querySelector('.pbl-shelf-conflict')).toBeNull();
		expect(shelfWaitsFor(containerEl, 'B')).toBe('Waits for A');
	});

	it('names which of two prerequisites conflicts, on the card itself', () => {
		const vault = new FakeVault();
		vault.addFile('Clear.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01', due: '2026-07-05' } });
		vault.addFile('Late.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 30, dependsOn: ['Clear', 'Late'], start: '2026-08-10', due: 'not-a-date' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(shelfCardFor(containerEl, 'B')?.querySelector('.pbl-shelf-conflict')).not.toBeNull();
		expect(shelfWaitsFor(containerEl, 'B')).toBe('Waits for Clear, Late (conflict)');
	});
});

/**
 * Fix round, item 3 (extension 1d, never built): a broken edge resolves to no
 * prerequisite at all, so `item.prerequisites` never carries it — nothing about it
 * was stated anywhere. `item.brokenPrerequisites` is the raw text `Remove
 * dependency…` matches on, and it belongs on the row for the same reason main flow
 * step 3 belongs there: no arrow reaches a broken edge by design (1d), so the row is
 * the only place left.
 */
describe('a broken dependency (1d) is stated on the row, dated or shelved', () => {
	it('states an unresolvable entry on a dated row, with no arrow drawn for it', () => {
		const vault = new FakeVault();
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 10, dependsOn: 'Ghost', start: '2026-08-01', due: '2026-08-05' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(0);
		expect(waitsFor(rowFor(containerEl, 'Waiter')!)).toBe('Waits for Ghost (broken)');
	});

	it('carries a VISIBLE marker for a broken entry, not only a screen-reader one', () => {
		const vault = new FakeVault();
		vault.addFile('Clean.md', {
			frontmatter: { type: 'PBI', order: 5, start: '2026-08-01', due: '2026-08-05' },
		});
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 10, dependsOn: 'Ghost', start: '2026-08-01', due: '2026-08-05' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		// 1d asks the ROW to carry the marker and 4d makes this the one surface where the
		// fact is visible rather than merely reachable. A broken entry draws no arrow, so
		// the sr-only sentence alone would leave a sighted reader nothing at all.
		expect(rowFor(containerEl, 'Waiter')!.querySelector('.pbl-timeline-dependency-flag')).not.toBeNull();
		expect(rowFor(containerEl, 'Clean')!.querySelector('.pbl-timeline-dependency-flag')).toBeNull();
	});

	it('states an unresolvable entry on a shelved card, the same row under 1b', () => {
		const vault = new FakeVault();
		vault.addFile('Waiter.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'Ghost' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(shelfWaitsFor(containerEl, 'Waiter')).toBe('Waits for Ghost (broken)');
	});

	it('names a real prerequisite, a conflicting one, and a broken entry together, in that order', () => {
		const vault = new FakeVault();
		vault.addFile('Clear.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01', due: '2026-07-05' } });
		vault.addFile('Late.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Waiter.md', {
			frontmatter: {
				type: 'PBI',
				order: 30,
				dependsOn: ['Clear', 'Late', 'Ghost'],
				start: '2026-08-10',
				due: '2026-08-25',
			},
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(waitsFor(rowFor(containerEl, 'Waiter')!)).toBe('Waits for Clear, Late (conflict), Ghost (broken)');
	});
});

describe('nothing about the layer is focusable or written', () => {
	it('adds no tabindex and leaves the pane at one selection stop per row', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(1);
		// Asked of the LAYER and of everything in it. `aria-hidden` moved to the container
		// when the route became several elements — one attribute hides the whole subtree,
		// and repeating it per segment would be the same claim stated N times and true
		// only while someone remembers to add it to the N+1st.
		const layer = containerEl.querySelector<HTMLElement>('.pbl-dependency-layer');
		expect(layer?.getAttribute('aria-hidden')).toBe('true');
		expect(Array.from(layer?.querySelectorAll('*') ?? []).every((el) => !el.hasAttribute('tabindex'))).toBe(true);
		expect(layer?.querySelectorAll('[role]')).toHaveLength(0);
		// One selection stop per row, unchanged by the arrow layer: still one id'd row
		// per bar, nothing else added to the roving-selection surface.
		expect(containerEl.querySelectorAll('[role="option"]')).toHaveLength(timelineRows(containerEl).length);
	});

	it('writes nothing at all while rendering with the dependency key bound', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		roadmapView(vault, { ...DATES });

		expect(vault.writeLog).toEqual([]);
	});
});

describe('a doubling-back route crosses a row boundary, never a row', () => {
	it('puts the lane on an edge between rows even with one row in between', () => {
		stackRows();
		const vault = new FakeVault();
		// A ends 08-15; C starts 08-10, so the link is backward and takes the doubling
		// route. B sits between them and is what an averaged lane would run through.
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-15' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('C.md', {
			frontmatter: { type: 'PBI', order: 30, dependsOn: 'A', start: '2026-08-10', due: '2026-08-25' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const d = arrows(containerEl)[0]?.getAttribute('d') ?? '';
		const verticals = [...d.matchAll(/V (-?\d+)/g)].map((m) => Number(m[1]));
		const centres = timelineRows(containerEl).map((_row, i) => i * 30 + 15);
		// Two of them, and they are different claims. The FIRST is the lane the run
		// doubles back along, and a row's own centre is exactly what it must not be: the
		// layer paints behind the bars, so a run there is hidden by the very bar it was
		// routed around. The LAST is the arrival, which must be the dependent's centre —
		// that is where its bar is, and an arrow that stopped short of it would point at
		// nothing.
		expect(verticals).toHaveLength(2);
		expect(centres).not.toContain(verticals[0]);
		expect(verticals[1]).toBe(centres[centres.length - 1]);
	});
});

describe('a route clipped at the left edge keeps itself out of the lead column', () => {
	it('holds every coordinate inside the grid, head included', () => {
		// A dependent starting long before the window: `timelineWindow` clamps around
		// today past MAX_TIMELINE_DAYS, `barGeometry` reports day 0 for its start, and
		// the anchor lands exactly on the grid's left edge. Everything drawn to the left
		// of that is under `.pbl-timeline-lead`, which is sticky and OPAQUE — so a head,
		// which reaches BACK along the run it terminates, would be invisible there and
		// the clipped edge would show a line with no direction on it.
		const vault = new FakeVault();
		vault.addFile('Anchor.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('Long.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Anchor', start: '2020-01-01', due: '2026-09-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
		const lead = Number((content?.style.getPropertyValue('--pbl-tl-lead') ?? '0px').replace('px', ''));
		expect(lead).toBeGreaterThan(0);
		const d = arrows(containerEl)[0]?.getAttribute('d') ?? '';
		expect(d).not.toBe('');
		// Every horizontal coordinate the route names, absolute ones only — the head's
		// own `l` strokes are relative and are checked through the tip below.
		const xs = [...d.matchAll(/[MH] (-?\d+)/g)].map((m) => Number(m[1]));
		expect(xs.length).toBeGreaterThan(0);
		for (const x of xs) expect(x).toBeGreaterThanOrEqual(lead);
		// And the head is either drawn with room for itself or not drawn at all — never
		// drawn into six pixels it cannot be seen in. Here the arrival IS the grid's edge:
		// the lead sits on one side of that line and the dependent's own clipped bar
		// starts on the other, and this layer paints behind the bars, so there is nowhere
		// a head could go. The route says the edge exists; the row says what it means.
		const tip = xs[xs.length - 1];
		// The arrival is the dependent's own bar edge — never nudged inward to make room,
		// which would point the arrow at a day the bar does not start on AND put the head
		// under the bar, since this layer paints behind them.
		const barLeft = lead + Number(
			(rowFor(containerEl, 'Long')?.querySelector<HTMLElement>('.pbl-bar')?.style.getPropertyValue('--pbl-bar-left') ??
				'0px'
			).replace('px', ''),
		);
		expect(tip).toBe(barLeft);
		// So the head is drawn only where it has room to be seen: between the grid's edge
		// and the bar it points at. Here there is none — the bar starts at the edge — and
		// the route is drawn without one rather than with one nothing can see.
		const head = [...d.matchAll(/l -(\d+)/g)].map((m) => Number(m[1]));
		if (head.length > 0) expect(tip - head[0]).toBeGreaterThanOrEqual(lead);
		else expect(tip - lead).toBeLessThan(6);
	});
});
