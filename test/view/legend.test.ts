// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { STATE_COLOR_SLOTS } from '../../src/domain/settings';
import { readDate, todayStamp } from '../../src/domain/noteFields';
import { addDays, formatCivil, MAX_TIMELINE_DAYS } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };
const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

/**
 * Dates picked from `MAX_TIMELINE_DAYS` rather than guessed, and offset from the
 * REAL clock so the test cannot drift: a hardcoded far-future date reads as safely
 * outside the window today and stops being so once the clock reaches it.
 */
const TODAY = readDate(todayStamp()).value;
if (TODAY === null) throw new Error('todayStamp() did not parse as a date');
const OUTSIDE_WINDOW_DUE = formatCivil(addDays(TODAY, MAX_TIMELINE_DAYS));
const INSIDE_WINDOW_DUE = formatCivil(addDays(TODAY, 10));

function datedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'New' } });
	return vault;
}

function legendEl(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-legend');
}

function swatchLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item')).map(
		(item) => item.querySelector('.pbl-legend-label')?.textContent ?? '',
	);
}

describe('the roadmap legend', () => {
	it('renders only on the dated axis — the same gate the zoom controls use', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW, horizonProperty: 'note.horizon' }, { collapsed: true });
		expect(legendEl(containerEl)).toBeNull(); // tree
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(legendEl(containerEl)).toBeNull(); // roadmap, horizon axis
		view.setAxisPick('dates');
		expect(legendEl(containerEl)).not.toBeNull(); // roadmap, dated axis
		view.setProjection('board');
		expect(legendEl(containerEl)).toBeNull(); // board
	});

	it('takes its aria-hidden off with its class, rather than leaving a hidden empty box', () => {
		// The element itself is the view's and outlives every axis change; only the class
		// and the attribute are `renderLegend`'s. The test above asks what the class does,
		// which is what makes the legend absent rather than merely invisible — this asks
		// the other half, since an `aria-hidden` left behind marks an ordinary empty div
		// as decoration for every projection that follows.
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');
		const el = legendEl(containerEl);
		if (!el) throw new Error('no legend on the dated axis');
		expect(el.getAttribute('aria-hidden')).toBe('true');

		view.setProjection('tree');
		expect(el.classList.contains('pbl-legend')).toBe(false);
		expect(el.hasAttribute('aria-hidden')).toBe(false);
	});

	it('shows Today but no state or milestone swatch when no workflow property is configured', () => {
		// `stateMenuValues` still returns a done value even with `stateKey === ''` (it
		// falls back to `observedStates` plus a done default), but `domain/model.ts` sets
		// every `stateValue` to null in that configuration, so no bar can carry a state
		// colour — the legend must not key one nothing on the grid draws. `datedVault`'s
		// one item has a due date and no start, so it draws an ordinary open-ended bar,
		// never the milestone diamond — the milestone swatch is conditional now (defect 2
		// of this pass) and this fixture draws none.
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS }, { collapsed: true });
		view.setProjection('roadmap');

		expect(legendEl(containerEl)).not.toBeNull();
		expect(swatchLabels(containerEl)).toEqual(['Today']);
	});

	it('keys one swatch per vocabulary state, in the same slot classes the bars carry, then today', () => {
		// `datedVault`'s item has a due date and no start, so it draws an ordinary bar —
		// the milestone swatch is conditional now, and nothing here draws that diamond.
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(swatchLabels(containerEl)).toEqual(['New', 'Active', 'Done', 'Today']);
		const items = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item'));
		const swatchClasses = (i: number) => [...(items[i].querySelector('.pbl-legend-swatch')?.classList ?? [])];
		expect(swatchClasses(0)).toContain('pbl-state-0');
		expect(swatchClasses(1)).toContain('pbl-state-1');
		// Slot 2 is where `Done` sits in the vocabulary, and it is NOT what its bar draws:
		// the done override wins over the slot, so the swatch keys the override. The test
		// below states that rule on its own; here it is the exception to "the same slot
		// classes the bars carry", which holds for every state whose bar does carry it.
		expect(swatchClasses(2)).toContain('pbl-legend-done');
	});

	it('is presentational: aria-hidden, and nothing inside it is a tab stop', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const legend = legendEl(containerEl);
		expect(legend?.getAttribute('aria-hidden')).toBe('true');
		expect(legend?.querySelector('button, [tabindex]')).toBeNull();
	});

	it('keys a done state green, the colour its bars actually draw', () => {
		// The legend exists to be read against the bars, so it may not key a colour the
		// bars do not use. A done state still occupies a slot — it is in the vocabulary —
		// but `.pbl-timeline-row.pbl-done .pbl-bar` overrides that slot with green, so a
		// swatch wearing the slot class would key its slot colour for a bar that draws
		// green — whichever colour that slot happens to be, which the rotation changes.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'Done' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const items = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item'));
		const done = items.find((i) => i.querySelector('.pbl-legend-label')?.textContent === 'Done');
		const swatch = done?.querySelector('.pbl-legend-swatch');
		if (!swatch) throw new Error('no Done swatch in the legend');
		expect(swatch.classList.contains('pbl-legend-done')).toBe(true);
		expect(Array.from(swatch.classList).some((c) => /^pbl-state-\d+$/.test(c))).toBe(false);
		// And the bar it keys really is the done one, so the two are about the same thing.
		expect(containerEl.querySelector('.pbl-timeline-row.pbl-done .pbl-bar')).not.toBeNull();
	});

	it('stays under the toolbar and outside the timeline scroller, so it never scrolls away', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const legend = legendEl(containerEl);
		const scroller = containerEl.querySelector('.pbl-timeline');
		expect(legend?.contains(scroller)).toBe(false);
		expect(scroller?.contains(legend ?? null)).toBe(false);
	});
});

/**
 * The rule behind every state-colour defect this branch has had, checked as a rule.
 * Four so far, each a different point in the same two-dimensional space — vocabulary by
 * configuration — and each one passed the tests that existed, because those name cases:
 * the done swatch keying its slot instead of the green its bars draw, the milestone
 * swatch keying cyan while the diamond drew its state slot, state swatches rendered with
 * no workflow configured at all, and a state outside the configured list drawing the
 * plain accent that nothing keyed.
 *
 * THE RULE, both ways round: every colour a mark on the grid can draw is keyed by
 * exactly one swatch, and no swatch keys a colour nothing can draw. A legend that fails
 * either direction is worse than none — it is a key that lies about the thing it keys.
 */
describe('the legend keys exactly the colours the grid draws', () => {
	/** What a row's classes say its bar draws, in the stylesheet's own order of precedence. */
	function barColourKey(row: HTMLElement): string {
		if (row.classList.contains('pbl-done')) return 'pbl-legend-done';
		if (row.querySelector('.pbl-bar-milestone')) return 'pbl-legend-milestone';
		const slot = Array.from(row.classList).find((c) => /^pbl-state-\d+$/.test(c));
		return slot ?? 'pbl-legend-other';
	}

	function swatchKeys(containerEl: HTMLElement): string[] {
		return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-swatch')).map(
			(el) => Array.from(el.classList).find((c) => c !== 'pbl-legend-swatch') ?? '',
		);
	}

	const CASES: Array<{
		name: string;
		options: Record<string, string>;
		states: Array<string | null>;
		/** An extra, stateless Milestone note, its date picked to land on one side of the window. */
		marker?: 'outside' | 'inside';
	}> = [
		{ name: 'a declared vocabulary, nothing done', options: { stateValues: 'New, Active' }, states: ['New', 'Active'] },
		{ name: 'a declared vocabulary including a done value', options: { stateValues: 'New, Active, Done' }, states: ['New', 'Done'] },
		{ name: 'no declared list — the vocabulary is what the notes observed', options: { stateValues: '' }, states: ['Alpha', 'Beta'] },
		{
			name: 'a vocabulary longer than the palette, so slots wrap',
			options: { stateValues: 'S1, S2, S3, S4, S5, S6, S7' },
			states: ['S1', 'S6', 'S7'],
		},
		{ name: 'a state the declared vocabulary does not list', options: { stateValues: 'New, Active' }, states: ['New', 'Blocked'] },
		{ name: 'some items carrying no state at all', options: { stateValues: 'New, Active' }, states: ['New', null] },
		// The vocabulary is the CONFIGURED list, but `done` is decided by `doneValues`
		// independently of it — so an item can be done while its value is not in the menu,
		// and its bar goes green with nothing keying green.
		{ name: 'a done value the configured vocabulary omits', options: { stateValues: 'New, Active' }, states: ['New', 'Done'] },
		{ name: 'only done items, none of them listed', options: { stateValues: 'New, Active' }, states: ['Done', 'Done'] },
		// `barClasses` returns EARLY for `geometry.outside`, before it ever adds
		// `pbl-bar-milestone` — so a marker dated past the capped window draws
		// `.pbl-bar-outside`, which paints the plain accent for a stateless item just
		// like an ordinary bar would. A predicate over `results` that excludes every
		// marker unconditionally misses exactly this case.
		{ name: 'a stateless marker dated outside the window draws the plain accent', options: { stateValues: 'New, Active' }, states: ['New'], marker: 'outside' },
		// The same marker, dated inside the window, draws the cyan diamond instead —
		// the same rule failing the other way: keying the accent for THIS bar would be
		// a swatch naming a colour nothing on the grid draws.
		{ name: 'a stateless marker dated inside the window draws its own cyan, not the accent', options: { stateValues: 'New, Active' }, states: ['New'], marker: 'inside' },
	];

	it.each(CASES)('$name', ({ options, states, marker }) => {
		const vault = new FakeVault();
		states.forEach((state, i) => {
			const fm: Record<string, unknown> = { type: 'PBI', order: (i + 1) * 10, due: `2026-08-0${i + 1}` };
			if (state !== null) fm.status = state;
			vault.addFile(`Item ${i}.md`, { frontmatter: fm });
		});
		if (marker) {
			const due = marker === 'outside' ? OUTSIDE_WINDOW_DUE : INSIDE_WINDOW_DUE;
			vault.addFile('Marker.md', { frontmatter: { type: 'Milestone', order: 999, due } });
		}
		const workflow = 'stateValues' in options ? { stateProperty: 'note.status', ...options } : {};
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...workflow }, { collapsed: true });
		view.setProjection('roadmap');

		const keyed = new Set(swatchKeys(containerEl));
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBeGreaterThan(0);

		// Every colour drawn is keyed.
		for (const row of rows) {
			const title = row.querySelector('.pbl-card-title')?.textContent;
			expect(keyed, `${title} draws ${barColourKey(row)}, which the legend does not key`).toContain(barColourKey(row));
		}
		// Two swatches may share a colour ONLY where the vocabulary outruns the palette,
		// which `STATE_COLOR_SLOTS` documents as its accepted limit. Anywhere else a colour
		// with two names is a key that cannot be read.
		const stateSwatches = swatchKeys(containerEl).filter((k) => /^pbl-state-\d+$/.test(k));
		if (stateSwatches.length <= STATE_COLOR_SLOTS) {
			expect(swatchKeys(containerEl)).toHaveLength(keyed.size);
		}
		// Today is always drawn, so it is always keyed.
		expect(keyed).toContain('pbl-legend-today');
		// Milestone is NOT: most of these cases carry no marker at all, so nothing draws
		// the cyan diamond and the swatch must not claim a colour absent from every row —
		// defect 2 of this pass, keyed unconditionally before this fix. Asked of the rows
		// rather than of the case's own `marker` field, so this states the rule rather
		// than restating the fixture.
		const milestoneDrawn = rows.some((row) => barColourKey(row) === 'pbl-legend-milestone');
		expect(keyed.has('pbl-legend-milestone')).toBe(milestoneDrawn);
		// The accent, both ways round for the same reason — the loop above only ever
		// asks "is what this row draws keyed", so a swatch keying a colour NO row draws
		// passed it. `renderBarRow` reports the accent only where no other override
		// won, the milestone diamond included: drop that term and an in-window marker
		// reports its own cyan AND the accent, and `Other` appears for a colour nothing
		// on this grid paints.
		const accentDrawn = rows.some((row) => barColourKey(row) === 'pbl-legend-other');
		expect(keyed.has('pbl-legend-other')).toBe(accentDrawn);
	});
});

describe('the legend keys a done bar only where one is actually on the grid', () => {
	// Both use a vocabulary that OMITS `Done`, so the swatch comes from the fallback
	// branch (`drawn.done` in `renderLegend`), never the vocabulary loop above — that
	// loop's own case is `keys a done state green` and is untouched by this rule.
	const OMITS_DONE = { stateProperty: 'note.status', stateValues: 'New, Active' };

	it('keys no green for a done item shelved with no date at all', () => {
		// No start, no due: `deriveBars` shelves it before any bar exists. `model.results`
		// still calls it done — that predicate was defect 1 of this pass.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...OMITS_DONE }, { collapsed: true });
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-timeline-row')).toBeNull(); // on the shelf, not the grid
		expect(swatchLabels(containerEl)).not.toContain('Done');
	});

	it('keys green once that same done item actually lands on the grid', () => {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', due: '2026-08-05' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...OMITS_DONE }, { collapsed: true });
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-timeline-row')).not.toBeNull();
		expect(swatchLabels(containerEl)).toContain('Done');
	});

	it('keys no green for a done item with a bar, hidden by "Show completed items"', () => {
		// This one WOULD draw a bar (it has a due date) — it is hidden, not shelved.
		// `buildRoadmap` filters rows through `host.isRowHidden` before `deriveBars` ever
		// runs, so a completed leaf hidden this way never reaches the grid either, and
		// the green swatch has to follow it off screen the same way.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', due: '2026-08-05' } });
		const { view, containerEl } = makeView(
			vault,
			{ ...DATE_AXIS, ...OMITS_DONE, showCompleted: false },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-timeline-row')).toBeNull();
		expect(swatchLabels(containerEl)).not.toContain('Done');
	});
});

describe('the legend keys a milestone only where the grid draws its cyan', () => {
	it('keys no milestone swatch when no item on the grid is a milestone', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-bar-milestone')).toBeNull();
		expect(swatchLabels(containerEl)).not.toContain('Milestone');
	});
});

describe('the legend follows a filter, which redraws content without a full render', () => {
	it('drops the Other swatch when a filter hides the last bar drawing the accent', () => {
		// `hasUnkeyedAccent` is reported by the render, so the legend is only as fresh as
		// the pass that produced it — and `setFilter` re-renders CONTENT alone. Rendered
		// from `render()` only, the swatch outlived the bar it keyed.
		const vault = new FakeVault();
		// Names that do not contain one another: `setFilter` matches on substring, so
		// filtering for `Listed` would keep `Unlisted` too and test nothing.
		vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'New' } });
		vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, due: '2026-08-07', status: 'Blocked' } });
		const { view, containerEl } = makeView(
			vault,
			{ ...DATE_AXIS, stateProperty: 'note.status', stateValues: 'New, Active' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');
		expect(swatchLabels(containerEl)).toContain('Other');

		// A filter that keeps only the listed item takes the accent bar off the grid.
		view.setFilter('Alpha');
		expect(swatchLabels(containerEl)).not.toContain('Other');

		// And clearing it brings both back — the swatch has to follow in both directions.
		view.setFilter('');
		expect(swatchLabels(containerEl)).toContain('Other');
	});
});

describe('a milestone line is cyan whatever its own bar draws', () => {
	it('keys the milestone when the only marker on the grid is done', () => {
		// `renderMilestoneLines` draws its full-height cyan line for every in-window
		// marker and never asks whether the item is done — only the DIAMOND is repainted
		// green by the done override. So a grid whose only marker is done still has cyan
		// on it, and asking the bars alone reported `milestone: false` and left it unkeyed.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', {
			frontmatter: { type: 'Milestone', order: 10, start: INSIDE_WINDOW_DUE, due: INSIDE_WINDOW_DUE, status: 'Done' },
		});
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		// The cyan line really is on the grid, and its bar really did go green.
		expect(containerEl.querySelector('.pbl-milestone-line')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-row.pbl-done .pbl-bar')).not.toBeNull();
		expect(swatchLabels(containerEl)).toContain('Milestone');
	});

	it('still keys no milestone where the grid draws no marker at all', () => {
		// The other direction, so the fix above cannot become "always key it again".
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-milestone-line')).toBeNull();
		expect(swatchLabels(containerEl)).not.toContain('Milestone');
	});
});

describe('two workflows, two keyed vocabularies', () => {
	const DELIVERABLE_WORKFLOW = {
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Published',
		deliverableDoneValues: 'Published',
	};

	/** A PBI and a Deliverable, each dated and each holding its own workflow's state. */
	function twoWorkflowVault(deliverableState = 'Draft'): FakeVault {
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, due: INSIDE_WINDOW_DUE, status: 'Active' } });
		vault.addFile('D.md', {
			frontmatter: {
				type: 'Deliverable',
				order: 20,
				due: INSIDE_WINDOW_DUE,
				status: 'New',
				deliverableStatus: deliverableState,
			},
		});
		return vault;
	}

	function groupLabels(containerEl: HTMLElement): string[] {
		return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-group')).map(
			(el) => el.textContent ?? '',
		);
	}

	function rowClasses(containerEl: HTMLElement, path: string): DOMTokenList {
		const row = containerEl.querySelector<HTMLElement>(`.pbl-timeline-row[data-path="${path}"]`);
		if (!row) throw new Error(`no timeline row for ${path}`);
		return row.classList;
	}

	it('names each workflow and keys both vocabularies, in slot order', () => {
		const { view, containerEl } = makeView(
			twoWorkflowVault(),
			{ ...DATE_AXIS, ...WORKFLOW, ...DELIVERABLE_WORKFLOW },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(groupLabels(containerEl)).toEqual(['Work', 'Deliverables']);
		// Both lists, in the order the slots run — `Published` is the Deliverable
		// workflow's own done value and keys green rather than its slot.
		expect(swatchLabels(containerEl)).toEqual(['New', 'Active', 'Done', 'Draft', 'Published', 'Today']);
	});

	it('names nothing where one workflow tracks everything', () => {
		// The single-workflow base draws exactly the strip it drew before a second one
		// existed — a group label with nothing to tell it apart from is furniture.
		const { view, containerEl } = makeView(twoWorkflowVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(groupLabels(containerEl)).toEqual([]);
		expect(swatchLabels(containerEl)).toEqual(['New', 'Active', 'Done', 'Today']);
	});

	it('leaves a LONE Deliverable workflow unlabelled and at slot 0', () => {
		// Only the Deliverable workflow has a key, so it is the only vocabulary that can
		// key anything — `stateKey` is '' and `domain/model.ts` sets every `stateValue` to
		// null, so no requirements bar carries a colour at all. Naming this section
		// "Deliverables" tells it apart from nothing, and offsetting its slots past a
		// vocabulary no bar can use starts the only palette on the grid at slot 1.
		const { view, containerEl } = makeView(
			twoWorkflowVault(),
			{ ...DATE_AXIS, ...DELIVERABLE_WORKFLOW },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		expect(groupLabels(containerEl)).toEqual([]);
		// `Other` because the PBI's own workflow has no key, so its bar takes no slot and
		// draws the plain accent — a colour on the grid, and the key has to explain it.
		expect(swatchLabels(containerEl)).toEqual(['Draft', 'Published', 'Other', 'Today']);
		expect(rowClasses(containerEl, 'D.md')).toContain('pbl-state-0');
		expect(rowClasses(containerEl, 'P.md').toString()).not.toContain('pbl-state-');
	});

	it('keys a Deliverable’s bar by its OWN state, in its own palette’s slot', () => {
		const { view, containerEl } = makeView(
			twoWorkflowVault(),
			{ ...DATE_AXIS, ...WORKFLOW, ...DELIVERABLE_WORKFLOW },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		// `Active` is slot 1 of the requirements vocabulary; `Draft` is the fourth value
		// overall, so slot 3. The Deliverable's own `status: New` — slot 0 — is what the
		// bar drew before, a colour naming a state its workflow does not track.
		expect(rowClasses(containerEl, 'P.md')).toContain('pbl-state-1');
		expect(rowClasses(containerEl, 'D.md')).toContain('pbl-state-3');
		expect(rowClasses(containerEl, 'D.md')).not.toContain('pbl-state-0');
	});

	it('takes the green done override from the Deliverable workflow’s own done list', () => {
		const { view, containerEl } = makeView(
			twoWorkflowVault('Published'),
			{ ...DATE_AXIS, ...WORKFLOW, ...DELIVERABLE_WORKFLOW },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		// `Published` is done for a Deliverable and nothing at all for a PBI, whose own
		// `status: New` leaves this row unfinished. Asking `item.done` here drew a slot
		// colour under a legend keying green — the two disagreeing about one bar.
		expect(rowClasses(containerEl, 'D.md')).toContain('pbl-done');
		expect(rowClasses(containerEl, 'P.md')).not.toContain('pbl-done');
	});

	it('says a Deliverable’s own state in words, not the requirements one', () => {
		const { view, containerEl } = makeView(
			twoWorkflowVault(),
			{ ...DATE_AXIS, ...WORKFLOW, ...DELIVERABLE_WORKFLOW },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		// The hidden words are what make the colour reachable without seeing it, so they
		// have to name the same state the colour keys — `New` here is the requirements
		// value sitting unused on the same note.
		const note = containerEl.querySelector<HTMLElement>('.pbl-timeline-row[data-path="D.md"] .pbl-sr-only');
		expect(note?.textContent).toBe('Draft');
	});
});
