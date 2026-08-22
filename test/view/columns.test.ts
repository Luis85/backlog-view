// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { BOARD_WORKFLOW, boardVault, cardByTitle } from '../helpers/board';
import { clickExpandAll, fixture, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';
import { rowContext, syncColumnFit } from '../../src/view/render/columns';

useViewHarness();

/**
 * How many `setCssProps` calls `renderTree` makes on the tree scroller per content
 * render, since Task 4 of [[Cards or a list on the shelf]]'s follow-up split the
 * per-column loop into `publishColumnWidths` (`render/columns.ts`): one call for
 * `--pbl-meta-col`/`--pbl-indent`/`--pbl-rollup-label`, which stay `renderTree`'s own
 * geometry, and one for the shared publisher, which `renderShelf` now calls too. The two
 * pass-counting tests below spy on that method to count passes rather than re-derive one;
 * a third caller of the split changes this number, not the tests' own logic.
 */
const CALLS_PER_PASS = 2;

describe('property columns', () => {
	it('renders visible properties as fixed cells with the toString fallback', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		const cell = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop');
		expect(cell?.querySelector('.pbl-prop-value')?.textContent).toBe('5');
		// The label is not repeated per row — it is in the header and the tooltip
		expect(cell?.querySelector<HTMLElement>('.pbl-prop-value')?.dataset.tooltip).toBe('points: 5');
		// A row without a value keeps the empty cell, or the columns after it would shift
		const empty = rowByTitle(containerEl, 'Epic B').querySelector('.pbl-prop');
		expect(empty).not.toBeNull();
		expect(empty?.querySelector('.pbl-prop-value')).toBeNull();
	});

	it('keeps a value that renders as pure visuals, with no text of its own', () => {
		const vault = fixture();
		// A checkbox or an icon: renderTo builds DOM, textContent stays empty, and the
		// cell is still showing something — emptiness is a question about the value.
		vault.entryValues.set('Epic A.md', {
			'note.done': {
				toString: () => 'true',
				renderTo: (el: HTMLElement) => {
					el.createEl('input', { attr: { type: 'checkbox', checked: 'true' } });
				},
			},
		});
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.done'];
		view.onDataUpdated();

		const value = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-prop-value');
		expect(value?.querySelector('input')).not.toBeNull();
		// The accessible name is all a screen reader has for a cell drawn as a picture
		expect(value?.dataset.tooltip).toBe('done: true');
	});

	it('names the columns once, in a header above the rows', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault, { stateProperty: 'note.status' });
		// The state property is a column because the menu shows it, and it is named after
		// itself: nothing is pinned past the properties any more except the rollup.
		config.order = ['note.points', 'note.status'];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		// The strip is not hidden — it carries the resize grips — but every label in it is:
		// each cell's value already names its own property, and the header repeating that
		// name is what a screen reader does not need twice.
		expect(header?.getAttribute('aria-hidden')).toBeNull();
		expect(header?.querySelector('.pbl-col-name')?.getAttribute('aria-hidden')).toBe('true');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'points',
			'status',
			'Progress',
		]);
		// Same column widths as the rows, so the labels sit above their values
		expect(header?.querySelector('.pbl-props')?.childElementCount).toBe(2);
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-w-0')).toBe('132px');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-w-1')).toBe('132px');
	});

	it('drops columns from the end of the order, keeping the rollup to the last', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, {}, { widths: { 'note.points': 280, 'note.owner': 280 } });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};
		const drawn = () => rowByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop').length;

		// Wider than any fixed breakpoint would be, and two 280px columns still do not
		// fit: the threshold is the configured width, not a guess.
		paneWidth(1400);
		expect(drawn()).toBe(2);
		// The rollup column is on the row, so the class below has something to drop —
		// without this the `pbl-hide-meta` assertions would hold over an absent column.
		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-meta-col')).not.toBeNull();

		paneWidth(900);
		expect(drawn()).toBe(1);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		// No column fits, and the rollup is still worth its 84px.
		paneWidth(500);
		expect(drawn()).toBe(0);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		// Narrower than the row's own lead plus the rollup: nothing left to give.
		paneWidth(300);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(true);

		// And every column comes back in the order it left. This is the case a fit that
		// measured the DRAWN columns rather than the resolved ones would fail: it would
		// ratchet down to zero and stay there.
		paneWidth(1400);
		expect(drawn()).toBe(2);
	});

	it('gives the columns the rollup’s width back when there is no rollup', () => {
		// The budget subtracts the rollup's 84px only when something is going to draw one.
		// With no state property and no counts there is no `.pbl-meta-col` at all, so a
		// pane that holds one 280px column beside a rollup holds two without it.
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { showCounts: false }, { widths: { 'note.points': 280, 'note.owner': 280 } });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 950, configurable: true });
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.querySelector('.pbl-meta-col')).toBeNull();
		expect(row.querySelectorAll('.pbl-prop').length).toBe(2);
	});

	it('does not reserve the rollup’s width on the catalog, which draws no rollup at all', () => {
		// The catalog opts out of the rollup column entirely (`hasRollup`, `view/projection.ts`)
		// — absent regardless of width, not narrowed by it — so the budget must not subtract
		// the rollup's 84px for it even with a state property configured. Called directly, the
		// way the Deliverables-board depth test above is, to assert `columnFit`'s own verdict
		// rather than a rendered cell: a reverted gate here still renders no `.pbl-meta-col` on
		// the catalog (the OTHER two gates hold it back), so a DOM assertion would stay green
		// while the budget quietly starved every property column of the width it never spent.
		const vault = fixture();
		const { containerEl, view } = makeView(
			vault,
			{ stateProperty: 'note.status' },
			{ order: ['note.points'], widths: { 'note.points': 200 } },
		);
		view.setProjection('catalog');
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		Object.defineProperty(tree, 'clientWidth', { value: 550, configurable: true });

		const ctx = rowContext(view, new Map(), new Set());
		syncColumnFit(ctx, viewEl as HTMLElement, tree);

		// 550px holds the one 200px column only when the rollup's 84px is not subtracted from
		// the budget. With the same state property configured, the PLAN drops this same column
		// at this same width — `columnFit`'s width tests above establish the arithmetic; this is
		// the catalog's own case of it.
		expect(view.columnFit?.shown).toBe(1);
	});

	it('leaves nothing of a dropped column for a keyboard or a screen reader to find', () => {
		// Clipping would hide the cell and keep it focusable — a control inside a column
		// the view says it dropped, and focusing it scrolls the strip out from under its
		// header. The cell is not rendered at all.
		const vault = fixture();
		vault.entryValues.set('Epic A.md', {
			'note.done': {
				toString: () => 'true',
				renderTo: (el: HTMLElement) => {
					el.createEl('input', { attr: { type: 'checkbox' } });
				},
			},
		});
		const { containerEl, config, view } = makeView(
			vault,
			{ stateProperty: 'note.status' },
			{ widths: { 'note.points': 280, 'note.done': 280, 'note.status': 280 } },
		);
		config.order = ['note.points', 'note.done', 'note.status'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 900, configurable: true });
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.querySelectorAll('.pbl-prop').length).toBe(1);
		expect(row.querySelector('input')).toBeNull();
		expect(row.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('draws no header bar at a width where the columns and the rollup have both gone', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, {}, { widths: { 'note.points': 280, 'note.owner': 280 } });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};
		const header = () => treeOf(containerEl).querySelector('.pbl-cols');
		const labels = () => Array.from(header()?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent);

		// No column fits, but the rollup does: the bar stays and names it. "No columns" is
		// not the same question as "nothing to head".
		paneWidth(500);
		expect(labels()).toEqual(['Items']);

		// Both gone. A bar holding a spacer, an empty box and a label CSS hides is an
		// empty sticky stripe above the rows.
		paneWidth(300);
		expect(header()).toBeNull();

		// And it stays gone: the pass the changed verdict bought got there, and another
		// update at the same width buys nothing beyond its own render.
		let passes = 0;
		// Counted at the widths `renderTree` publishes onto the scroller, per tree content
		// render. It used to count `treeEl.empty()`, which stopped being one call per pass
		// when a pass began KEEPING the rows it drew last time (ADR 0029) — the quantity
		// this test is about did not move, the instrument that could see it did.
		//
		// TWO calls per pass since Task 4 of [[Cards or a list on the shelf]]'s follow-up:
		// `renderTree` still writes `--pbl-meta-col`/`--pbl-indent`/`--pbl-rollup-label`
		// itself, and then calls the extracted `publishColumnWidths` (`render/columns.ts`)
		// for the per-column widths — the same publisher `renderShelf` now calls too, so a
		// column resized in tree mode reads the same width on the shelf. `CALLS_PER_PASS`
		// is what a third caller of that split would have to update, not this count.
		const realProps = HTMLElement.prototype.setCssProps;
		Object.defineProperty(tree, 'setCssProps', {
			configurable: true,
			value: function (this: HTMLElement, props: Record<string, string>): void {
				passes += 1;
				realProps.call(this, props);
			},
		});
		view.onDataUpdated();
		expect(passes).toBe(CALLS_PER_PASS);
		expect(header()).toBeNull();

		// It comes back with every label once the pane can hold them again.
		paneWidth(1400);
		expect(labels()).toEqual(['points', 'owner', 'Items']);
	});

	it('hands a card projection the whole column list, whatever the tree last measured', () => {
		// The count is the TREE's. A card is never indented and never drops a column for
		// room, so a verdict carried out of a narrow tree would strip cells off cards —
		// and the rollup class beside it would hide theirs.
		const vault = fixture();
		// Both properties carry a value: this test is about the COUNT the narrow tree
		// verdict must not strip off a card, not about the separate rule that an empty
		// cell renders no `.pbl-prop` on a card at all (see the `dropEmpty` tests below).
		vault.entryValues.set('Epic A.md', {
			'note.points': { toString: () => '5' },
			'note.owner': { toString: () => 'Sam' },
		});
		const { containerEl, config, view } = makeView(
			vault,
			{ stateProperty: 'note.status', stateValues: 'New, Active, Done' },
			{ widths: { 'note.points': 280, 'note.owner': 280 } },
		);
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		Object.defineProperty(tree, 'clientWidth', { value: 300, configurable: true });
		view.onDataUpdated();

		// The narrowest verdict there is: no column fits and the rollup has gone too.
		expect(view.columnFit?.shown).toBe(0);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(true);

		view.setProjection('board');
		expect(view.columnFit).toBeNull();
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);
		// Both plain properties, so the card draws every column that exists.
		expect(cardByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop').length).toBe(view.columns.length);
	});

	it('draws no state, horizon or risk chip on a card, but does draw the assignee chip', () => {
		// A board card's column IS its state and a bucket IS its horizon, so a chip inside
		// one repeats what the card's own position already says; the assignee has no such
		// equivalent on any projection (ADR 0027). Asserted as a DIFFERENCE rather than as
		// an absence: the same item's tree row draws all four, so an empty fixture or an
		// unconfigured axis cannot pass this for the filter.
		const vault = boardVault();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		vault.setFrontmatter('Epic A.md', { type: 'Epic', order: 10, status: 'New', assignee: 'Sam' });
		const { containerEl, view } = makeView(
			vault,
			{ ...BOARD_WORKFLOW, horizonProperty: 'note.horizon', riskProperty: 'note.risk', assigneeProperty: 'note.assignee' },
			{ order: ['note.points', 'note.status', 'note.horizon', 'note.risk', 'note.assignee'] },
		);

		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.querySelectorAll('.pbl-prop').length).toBe(5);
		expect(row.querySelector('.pbl-state-chip')).not.toBeNull();
		expect(row.querySelector('.pbl-horizon-chip')).not.toBeNull();
		expect(row.querySelector('.pbl-risk-chip')).not.toBeNull();
		expect(row.querySelector('.pbl-assignee-chip')?.textContent).toContain('Sam');

		view.setProjection('board');

		// The plain column and the assignee chip still draw, so this is a filter on the
		// kind and not a card that stopped reading the list.
		const card = cardByTitle(containerEl, 'Epic A');
		expect(card.querySelectorAll('.pbl-prop').length).toBe(2);
		expect(card.querySelector('.pbl-prop-value')?.textContent).toBe('5');
		expect(card.querySelector('.pbl-state-chip')).toBeNull();
		expect(card.querySelector('.pbl-horizon-chip')).toBeNull();
		expect(card.querySelector('.pbl-risk-chip')).toBeNull();
		expect(card.querySelector('.pbl-assignee-chip')?.textContent).toContain('Sam');
	});

	it('drops an empty property cell from a card instead of leaving a gap with nothing in it', () => {
		// The tree keeps the cell (previous test, and the suite above it): its columns are
		// fixed-width and share a header, so an absent one shifts every column after it. A
		// card has neither, so the same empty cell is only `padding-inline-end` with no
		// content — a gap the user reported as broken spacing (ADR 0027).
		const vault = boardVault();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		// Epic B gets no 'note.points' entry at all — the empty case.
		const { containerEl, view } = makeView(vault, BOARD_WORKFLOW, { order: ['note.points'] });
		view.setProjection('board');

		const withValue = cardByTitle(containerEl, 'Epic A');
		expect(withValue.querySelectorAll('.pbl-prop').length).toBe(1);

		const withoutValue = cardByTitle(containerEl, 'Epic B');
		expect(withoutValue.querySelectorAll('.pbl-prop').length).toBe(0);
		// The WRAPPER too: `.pbl-props` is itself a flex child of `.pbl-card`'s own `gap`,
		// so an empty one left behind is the identical bug moved up one level — a card
		// whose only configured column is empty is exactly this case, not an edge of it.
		// (Found by review, Codex, PR #132.)
		expect(withoutValue.querySelector('.pbl-props')).toBeNull();
	});

	it('drops a tags cell from a card when there are no tags, add button included', () => {
		// The add button is a real affordance but `opacity: 0` until hover or focus
		// (styles/tags.css) — at rest it draws nothing a reader can see, so it must not
		// keep an otherwise-empty cell alive on a card. The tree keeps it regardless
		// (dropEmpty is never on there), which the first assertion pins.
		const vault = boardVault(); // neither epic carries tags.
		const { containerEl, view } = makeView(vault, BOARD_WORKFLOW, { order: ['note.tags'] });

		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-tag-add')).not.toBeNull();

		view.setProjection('board');
		const card = cardByTitle(containerEl, 'Epic A');
		expect(card.querySelector('.pbl-prop-tags')).toBeNull();
		expect(card.querySelector('.pbl-tag-add')).toBeNull();
	});

	it('keeps the assignee\'s own dashed invitation chip on a card — unset is not empty', () => {
		// The assignee's unset state is a deliberate "nobody yet" affordance, the same
		// chip the row draws, and dropEmpty must not confuse it with a cell that drew
		// nothing: `renderLabelChip` always returns true for an editable row, exactly
		// because pressing it does something.
		const vault = boardVault(); // Epic A carries no assignee.
		const { containerEl, view } = makeView(vault, { ...BOARD_WORKFLOW, assigneeProperty: 'note.assignee' }, { order: ['note.assignee'] });
		view.setProjection('board');

		const chip = cardByTitle(containerEl, 'Epic A').querySelector('.pbl-assignee-chip');
		expect(chip).not.toBeNull();
		expect(chip?.classList.contains('pbl-assignee-unset')).toBe(true);
		expect(chip?.textContent).toContain('Assignee');
	});

	it('does not buy a second render pass on a pane whose verdict has not moved', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, {}, { widths: { 'note.points': 280, 'note.owner': 280 } });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 900, configurable: true });

		let passes = 0;
		// Counted at the widths `renderTree` publishes onto the scroller, per tree content
		// render — `CALLS_PER_PASS` per pass since Task 4's `publishColumnWidths` split;
		// see the identical comment on the test above for why.
		const realProps = HTMLElement.prototype.setCssProps;
		Object.defineProperty(tree, 'setCssProps', {
			configurable: true,
			value: function (this: HTMLElement, props: Record<string, string>): void {
				passes += 1;
				realProps.call(this, props);
			},
		});

		view.onDataUpdated();
		const settled = passes;
		view.onDataUpdated();
		// One pass for the refresh and no refit pass: the pane did not change, so the
		// verdict did not either.
		expect(passes - settled).toBe(CALLS_PER_PASS);
	});

	it('keeps the second pass alive after a render throws inside it', () => {
		// The ladder's second pass runs with `refitting` set, and every later pass CHECKS
		// that flag without ever resetting it. Cleared outside a `finally`, one thrown
		// render strands it true for the life of the view and the second pass is silently
		// gone from then on — a column that came or went never reaching the rows.
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { stateProperty: 'note.status' }, { widths: { 'note.points': 280, 'note.owner': 280 } });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const paneWidth = (px: number) => Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });

		// The widths `renderTree` publishes onto the scroller, once per tree content render —
		// the same instrument the two tests above count with, and for the same reason: a pass
		// no longer empties the tree when it may KEEP the rows it drew last time. It happens
		// to empty on every pass HERE (each step changes the pane width, so the fit verdict
		// and the fingerprint move with it), and an instrument that is right by accident is
		// what makes the `throwAt` arithmetic below silently retarget when that stops holding.
		let passes = 0;
		let throwAt = 0;
		const realProps = HTMLElement.prototype.setCssProps;
		Object.defineProperty(tree, 'setCssProps', {
			configurable: true,
			value: function (this: HTMLElement, props: Record<string, string>): void {
				passes += 1;
				if (passes === throwAt) throw new Error('render blew up');
				realProps.call(this, props);
			},
		});

		paneWidth(1400);
		view.onDataUpdated();

		// Narrow enough that the property columns have to go: the tail refit changes its
		// verdict and asks for a second pass — which is the pass made to throw.
		paneWidth(700);
		throwAt = passes + 2;
		expect(() => view.onDataUpdated()).toThrow('render blew up');
		throwAt = 0;

		// Widen again: the verdict changes back, so a second pass is owed once more.
		paneWidth(1400);
		const before = passes;
		view.onDataUpdated();
		expect(passes - before).toBe(2);
	});

	it('counts the indent of the deepest rendered row', () => {
		// A chain deep enough that its indent alone eats a column's worth of room.
		const vault = new FakeVault();
		vault.addFile('L0.md', { frontmatter: { type: 'Epic', order: 10 } });
		for (let i = 1; i <= 8; i++) {
			vault.addFile(`L${i}.md`, { frontmatter: { type: 'Task', order: 10 }, parentLink: `L${i - 1}` });
		}
		const { containerEl, config, view } = makeView(vault, {}, { collapsed: true });
		config.order = ['note.points'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 560, configurable: true });
		view.onDataUpdated();
		const drawn = () => rowByTitle(containerEl, 'L0').querySelectorAll('.pbl-prop').length;

		// Collapsed, only the root renders: one 132px column fits beside it
		expect(drawn()).toBe(1);

		// Expanding the chain puts a row eight levels in — 192px of indent — on screen
		clickExpandAll(containerEl);
		expect(drawn()).toBe(0);
	});

	it('never lets a Deliverable narrow columns on the Deliverables board via a stale real-hierarchy depth', () => {
		// Same eight-level chain as the test above, but ending in a Deliverable, under a
		// focus on a level nothing in this chain is typed — `collectFocusRoots` never
		// reaches this branch, so `assignVisualDepth` never re-roots it: `D.depth` stays
		// its REAL hierarchy depth (8) rather than a focused-visual one. That is exactly
		// the depth-scale drift `BacklogModel.deliverableResults` can carry: it is built
		// from the whole, unfocused tree, so an item inside the focused subtree gets a
		// focused-visual depth while one outside it (like this D) keeps its real one —
		// two scales in one array. `renderedDepth` must not read either scale for a card.
		const vault = new FakeVault();
		vault.addFile('L0.md', { frontmatter: { type: 'Epic', order: 10 } });
		for (let i = 1; i <= 7; i++) {
			vault.addFile(`L${i}.md`, { frontmatter: { type: 'Task', order: 10 }, parentLink: `L${i - 1}` });
		}
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 }, parentLink: 'L7' });
		const { containerEl, view } = makeView(
			vault,
			{},
			{ collapsed: true, focus: 'Feature', order: ['note.points'] },
		);
		view.setProjection('deliverables');
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		Object.defineProperty(tree, 'clientWidth', { value: 560, configurable: true });

		const d = view.model?.byPath.get('D.md');
		if (!d) throw new Error('missing D');
		// Sanity: the focus above truly left this item on the real-hierarchy scale —
		// otherwise this test would not be exercising the drift it claims to.
		expect(d.depth).toBe(8);

		// Built the way a Deliverables-board render pass would: one rendered card,
		// pointing at this Deliverable. Called directly, bypassing the app's own
		// tree-only gating on `refit()`, so this asserts `syncColumnFit`'s own contract
		// rather than relying on that gating to keep the two from ever meeting.
		const rows = new Map<string, HTMLElement>([[d.file.path, document.createElement('div')]]);
		const ctx = rowContext(view, rows, new Set());
		syncColumnFit(ctx, viewEl as HTMLElement, tree);

		// The one column fits beside a card's zero indent, and would not beside eight
		// levels of a depth this projection does not have.
		expect(view.columnFit?.shown).toBe(1);
	});

	it('draws the horizon chip in the column the properties menu gives it', () => {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.entryValues.set('Placed.md', {
			'note.horizon': { toString: () => 'Now' },
			'note.points': { toString: () => '5' },
		});
		const { containerEl, config, view } = makeView(vault, {
			horizonProperty: 'note.horizon',
			stateProperty: 'note.status',
		});
		// The horizon property is one of the visible ones — the chip is what its cell
		// draws, so the value is never shown twice, and it sits where the user put it
		// rather than in a position pinned past the properties.
		config.order = ['note.horizon', 'note.points', 'note.status'];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'horizon',
			'points',
			'status',
			'Progress',
		]);
		const row = rowByTitle(containerEl, 'Placed');
		expect(Array.from(row.querySelectorAll('.pbl-prop-value')).map((el) => el.textContent)).toEqual(['5']);
		expect(row.querySelector('.pbl-prop-horizon .pbl-state-text')?.textContent).toBe('Now');
	});

	it('budgets a chip column exactly like the ordinary column it now is', () => {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const { containerEl, view } = makeView(
			vault,
			{ horizonProperty: 'note.horizon', stateProperty: 'note.status' },
			{ order: ['note.horizon'] },
		);
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};
		const drawn = () => rowByTitle(containerEl, 'Placed').querySelectorAll('.pbl-prop').length;

		paneWidth(700);
		expect(drawn()).toBe(1);

		// A column the budget did not account for would overflow instead of dropping,
		// and this pane is only too narrow once the chip's own column is counted: the
		// lead and the rollup alone fit inside it with room to spare.
		paneWidth(500);
		expect(drawn()).toBe(0);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);
	});

	it('has no horizon column while the bucket axis is unconfigured', () => {
		// A horizon property with no declared values is the axis the roadmap declines
		// to draw — and a chip whose menu could set nothing is the same lie.
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.entryValues.set('Placed.md', { 'note.horizon': { toString: () => 'Now' } });
		const { containerEl, config, view } = makeView(vault, { horizonProperty: 'note.horizon', horizonValues: '' });
		config.order = ['note.horizon'];
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-horizon-chip')).toBeNull();
		// And the property goes back to being an ordinary column, since nothing else
		// is showing it now.
		expect(rowByTitle(containerEl, 'Placed').querySelector('.pbl-prop-value')?.textContent).toBe('Now');
	});

	it('sizes each column from its own stored width', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, {}, { widths: { 'note.owner': 200 } });
		config.order = ['note.points', 'note.owner'];
		view.onDataUpdated();

		// Its own width, and the unresized one beside it still at the default: one number
		// for every column is exactly what a per-column pick stopped being.
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-w-0')).toBe('132px');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-w-1')).toBe('200px');
		// And each cell reads the one published for ITS column, so a row's second cell is
		// the one that follows the second grip.
		const cells = rowByTitle(containerEl, 'Epic A').querySelectorAll<HTMLElement>('.pbl-prop');
		expect(cells[0].style.getPropertyValue('--pbl-prop-w')).toBe('var(--pbl-prop-w-0, 132px)');
		expect(cells[1].style.getPropertyValue('--pbl-prop-w')).toBe('var(--pbl-prop-w-1, 132px)');
	});

	it('keeps the empty space around the columns part of the row click target', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		// A click on the value itself must not open the note (it may hold links)…
		const value = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-prop-value');
		value?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([]);

		// …but the flexible area before the columns is still the row.
		const spacer = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-row-spacer');
		spacer?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: false }]);
	});
});

describe('badges', () => {
	it('puts the full level name in the tooltip, capped or not', () => {
		// The name is capped in CSS so the row's lead stays bounded; the tooltip carries it
		// in full without anyone measuring whether the cap is biting — see the title's own
		// test in `state.test.ts` for why that question is not worth its layout read.
		const vault = new FakeVault();
		// No type property: the level is implied, and the badge explains that as well.
		vault.addFile('Epic.md', { frontmatter: { order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'Programme Increment', order: 10 }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { levels: 'Programme Increment, Epic' });

		const badge = rowByTitle(containerEl, 'Epic').querySelector<HTMLElement>('.pbl-badge');
		expect(badge?.classList.contains('pbl-implied')).toBe(true);
		expect(badge?.dataset.tooltip).toContain('Epic');
		expect(badge?.dataset.tooltip).toContain('Type property not set');

		// A declared type says its name and nothing else: there is nothing to explain.
		const child = rowByTitle(containerEl, 'Child').querySelector<HTMLElement>('.pbl-badge');
		expect(child?.classList.contains('pbl-implied')).toBe(false);
		expect(child?.dataset.tooltip).toBe('Programme Increment');
	});
});
