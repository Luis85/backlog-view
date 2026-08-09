// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, makeView, treeOf, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { bucketNames, rowFor, shelfTitles } from '../helpers/roadmap';
import { legalTargetPaths } from '../../src/view/interactions/dependencies';

/**
 * The context-row rule, driven against every entry point the CARD projections have.
 * Split from `test/view/contextRowWrites.test.ts` — which drives the tree's — when
 * the roadmap's write paths arrived: the two halves share a rule and share nothing
 * else, and one file holding both was the shape a suite takes just before it
 * becomes the place tests hide.
 *
 * Three blocks, one per projection. A board column and a horizon bucket are the same
 * gesture over different properties, so the first two deliberately read alike: the
 * same three questions — the drag, the paths a keyboard and a menu can reach that a
 * drag cannot, and the structural refusal behind both — asked of each. The third
 * asks the same three of the dated axis, but its gestures (a shelf drop, a body
 * slide, either grip, the row's Schedule entry, the menu's Unschedule) all reach the
 * gate through one host method, `performScheduleMove` — so its structural-refusal
 * case drives that method directly rather than any one gesture, the shape that
 * holds for a gesture not yet written.
 */
useViewHarness();

describe('write safety with context rows, across the board’s entry points', () => {
	/**
	 * The stress fixture projected as a board, focused where its context rows sit on
	 * the focus level — so the context PBI renders as an inert context card among
	 * live cards, and every board gesture can be aimed at it.
	 */
	function boardStressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20, status: 'New' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 5, status: 'New' }, parentLink: 'Feature B' });
		// Context, between results: its parent and the Task below it are both results.
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({
			stateProperty: 'note.status',
			stateValues: 'New, Active, Done',
		});
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('PBI');
		view.setProjection('board');
		return { view, containerEl, vault };
	}

	it('never writes to a context card, whatever is dropped wherever', async () => {
		const { containerEl, vault } = boardStressView();
		const cards = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card'));
		const columns = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-board-col'));
		expect(cards.length).toBeGreaterThan(1);

		// Every card dragged onto every column — the context card is not draggable
		// (never wired), so its gestures fall on the floor rather than into a plan.
		for (const card of cards) {
			for (const column of columns) {
				cardDrag(card, column);
				await flush();
			}
		}
		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched).not.toContain('Mid.md');
		// Not vacuous: the live cards really were written along the way.
		expect(touched).toContain('PBI.md');
	});

	it('never writes to a context card from the keyboard or the menu either', async () => {
		const { view, containerEl, vault } = boardStressView();
		const mid = view.model?.byPath.get('Mid.md');
		expect(mid?.outsideFilter).toBe(true);
		const tree = treeOf(containerEl);

		// Selected as a card and moved with the shortcut: the path a drag cannot take
		// (a context card is never wired as a draggable) and a keyboard can.
		view.selectItem(mid as never);
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		// And the menu, the one path that works everywhere: it withholds every entry
		// that would edit this note — Set state included, which on the board is the
		// drag's equal and so must be withheld exactly as the drag is.
		view.showContextMenuFor(mid as never);
		expect(Menu.lastShown?.item('Set state')).toBeUndefined();
		expect(Menu.lastShown?.item('Set type')).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses the whole batch if a board write ever names a context item', async () => {
		const { view, vault } = boardStressView();
		const mid = view.model?.byPath.get('Mid.md');
		expect(mid?.outsideFilter).toBe(true);

		// No UI produces this — that is the point: the last line of defence is
		// structural, so a future entry point cannot reopen the hole by omission.
		const applied = await view.performBoardMove(mid as never, 'New');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});

	// The disclosure is a READ affordance, which is the whole reason a context card may
	// have one: the feature has no drag source, no drop target and no writing menu
	// entry, so the context-row rule holds by there being no write rather than by a
	// check. Driven anyway — a future edit that gives the list a write is caught here,
	// in the suite that exists for exactly that.
	it('gives a context card a disclosure that lists, opens and writes nothing', () => {
		const { containerEl, vault } = boardStressView();
		const card = cardByTitle(containerEl, 'Mid');
		const toggle = card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
		expect(toggle).not.toBeNull();

		toggle?.click();

		expect(
			Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent),
		).toEqual(['Task']);

		card.querySelectorAll<HTMLElement>('.pbl-card-kid')[0].click();

		// It opened the child, and the whole interaction wrote nothing.
		expect(vault.opened.map((o) => o.path)).toEqual(['Task.md']);
		expect(vault.writeLog).toEqual([]);
	});
});

describe('write safety with context rows, across the Deliverables board’s entry points', () => {
	/**
	 * A context Deliverable — `outsideFilter`, and, under PBI focus, an `extraFocused`
	 * root (`collectFocusRoots`) exactly as the context PBI above is on the requirements
	 * board: `EXTRA_TYPE_RANK === focusIdx` at PBI admits every extra type as a focus
	 * root regardless of subtree position. It needs a child in the filter (Task.md) to
	 * be loaded as an ANCESTOR at all — `RawItem.outsideFilter`'s own doc says such a
	 * row exists only "to keep the hierarchy above a match intact," so a context row
	 * with nothing beneath it in the filter is never loaded, not merely hidden.
	 *
	 * `renderDeliverablesBoard` (`board.ts`) reads `model.results` UNCONDITIONALLY,
	 * never `model.roots` — unlike the requirements board above, which switches to
	 * `model.roots` under focus. `model.results` already drops every `outsideFilter`
	 * item (`model.ts`'s `shown()`), so this context Deliverable cannot become a card
	 * on this board at all, regardless of focus. D1 is a genuine, in-filter Deliverable
	 * sibling so the board draws real columns instead of "no deliverables yet" guidance
	 * — without it, "no card renders for Ctx" would be true for the wrong reason.
	 */
	function deliverablesStressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D1.md', {
			frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' },
			parentLink: 'Epic',
		});
		// Context: excluded from the Base's own results, loaded only because Task.md
		// below it is a result and needs its ancestor.
		vault.addFile('Ctx.md', {
			frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' },
			parentLink: 'Epic',
		});
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Ctx' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ deliverableStateProperty: 'note.deliverableStatus' });
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Ctx.md') };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('PBI');
		view.setProjection('deliverables');
		return { view, containerEl, vault };
	}

	it('never draws a card for the context row, whatever candidates the board considers', () => {
		const { view, containerEl } = deliverablesStressView();
		const ctx = view.model?.byPath.get('Ctx.md');
		expect(ctx?.outsideFilter).toBe(true);
		// It IS a focus root here — a board that read `model.roots` (the requirements
		// board's own shape) would draw it as a context card, exactly like the PBI
		// context card in the block above.
		expect(view.model?.roots.some((i) => i.file.path === 'Ctx.md')).toBe(true);
		// This board never reads `roots`, so no card for it exists — not merely one
		// that refuses to be dragged, but one that was never rendered to drag.
		expect(cardByTitle(containerEl, 'D1')).not.toBeNull();
		expect(containerEl.querySelectorAll('.pbl-card').length).toBe(1);
	});

	it('never writes to a context card from the keyboard or the menu either', async () => {
		const { view, containerEl, vault } = deliverablesStressView();
		const ctx = view.model?.byPath.get('Ctx.md');
		expect(ctx?.outsideFilter).toBe(true);
		const tree = treeOf(containerEl);
		// `applySafely`'s own structural refusal would catch a stray write regardless, so
		// a spy on the host method is what actually proves the keyboard path never even
		// ATTEMPTS one — confirmed by deliberately breaking both the render exclusion and
		// `handleBoardMoveKey`'s `outsideFilter` guard and watching this spy get called.
		const spy = vi.spyOn(view, 'performDeliverablesBoardMove');

		// Selected at the MODEL level — `selectItem` sets `selectedPath` unconditionally,
		// with no card of its own to check against. What keeps Alt+arrow from reaching it
		// is `boardPosition` (`interactions/keyboard.ts`): it resolves a position only by
		// finding the path among `snapshot.board.columns[*].cards`, and the test above
		// already established Ctx is never among them — there is no fallback to the
		// model that a keyboard-only path could exploit to reach what the drag cannot.
		view.selectItem(ctx as never);
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		expect(spy).not.toHaveBeenCalled();

		// And the menu, the one path that works everywhere: it withholds every entry
		// that would edit this note — Set state included, which on the Deliverables
		// board is the drag's equal and so must be withheld exactly as the drag is. Not
		// vacuous: `deliverableStateProperty` is configured, D1 is a real result and
		// gets a Set state entry of its own (asserted in test/view/menu.test.ts, 'offers
		// Set state on a Deliverables-board card when only the Deliverable key is
		// configured') — the withholding here is `editable`'s (`!item.outsideFilter`),
		// not the key being unconfigured.
		view.showContextMenuFor(ctx as never);
		expect(Menu.lastShown?.item('Set state')).toBeUndefined();
		expect(Menu.lastShown?.item('Set type')).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses the whole batch if a Deliverables board write ever names a context item', async () => {
		const { view, vault } = deliverablesStressView();
		const ctx = view.model?.byPath.get('Ctx.md');
		expect(ctx?.outsideFilter).toBe(true);

		// No UI produces this — that is the point: the last line of defence is
		// structural, so a future entry point cannot reopen the hole by omission. No
		// card exists to drag or to land the keyboard's board position on, and the menu
		// withholds Set state outright (the two tests above); the structural backstop is
		// exercised directly, exactly as the board and roadmap blocks above exercise
		// `performBoardMove`/`performHorizonMove`.
		const applied = await view.performDeliverablesBoardMove(ctx as never, 'Review');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});
});

describe('write safety with context rows, across the roadmap’s entry points', () => {
	/**
	 * The stress fixture projected as a roadmap, focused where its context rows sit —
	 * so the context PBI renders as an inert context card among live cards, and every
	 * roadmap gesture can be aimed at it.
	 */
	function roadmapStressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 5, horizon: 'Now' }, parentLink: 'Feature B' });
		// Context, between results: its parent and the Task below it are both results.
		// Its horizon is on NO declared list and on no result, so anything that reaches
		// the buckets or the menu can only have come from the context row itself.
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, horizon: 'Ancient' }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ horizonProperty: 'note.horizon' });
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('PBI');
		view.setProjection('roadmap');
		return { view, containerEl, vault };
	}

	it('never writes to a context card, whatever is dropped wherever', async () => {
		const { view, containerEl, vault } = roadmapStressView();
		expect(view.model?.byPath.get('Mid.md')?.outsideFilter).toBe(true);
		const cards = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card'));
		const targets = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-bucket, .pbl-shelf'));
		expect(cards.length).toBeGreaterThan(1);

		// Every card dragged onto every bucket and the shelf — the context card is not
		// draggable (never wired), so its gestures fall on the floor, not into a plan.
		for (const card of cards) {
			for (const target of targets) {
				cardDrag(card, target);
				await flush();
			}
		}
		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched).not.toContain('Mid.md');
		// Not vacuous: the live cards really were written along the way.
		expect(touched).toContain('PBI.md');
	});

	it('never writes to a context card from the keyboard or the menu either', async () => {
		const { view, containerEl, vault } = roadmapStressView();
		const mid = view.model?.byPath.get('Mid.md');
		const tree = treeOf(containerEl);

		// Selected as a card and moved with the shortcut: the path a drag cannot take
		// (a context card is never wired as a draggable) and a keyboard can.
		view.selectItem(mid as never);
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		// And the menu, the one path that works everywhere: it withholds every entry
		// that would edit this note — Set horizon included, which on the roadmap is
		// the drag's equal and so must be withheld exactly as the drag is.
		view.showContextMenuFor(mid as never);
		expect(Menu.lastShown?.item('Set horizon')).toBeUndefined();
		expect(Menu.lastShown?.item('Set type')).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses the whole batch if a horizon write ever names a context item', async () => {
		const { view, vault } = roadmapStressView();
		const mid = view.model?.byPath.get('Mid.md');

		// No UI produces this — that is the point: the last line of defence is
		// structural, so a future entry point cannot reopen the hole by omission.
		const applied = await view.performHorizonMove(mid as never, 'Now');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});

	it('never lets a context value mint a bucket the menu would then offer', () => {
		const { view, containerEl } = roadmapStressView();

		// A context row's value is not this base's vocabulary: it mints no bucket, so
		// nothing on screen offers to file a result under it, and the menu — which
		// leads with the drawn buckets and then names what the RESULTS carry — cannot
		// offer it either. Both halves, because either one alone would let it back in.
		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later']);
		view.showContextMenuFor(view.model?.byPath.get('PBI.md') as never);
		const offered = Menu.lastShown?.item('Set horizon')?.submenu?.items.map((i) => i.titleText);
		expect(offered).toEqual(['Now', 'Next', 'Later', 'Clear horizon']);
	});
});

describe('write safety with context rows, across the timeline’s entry points', () => {
	/**
	 * The stress fixture projected onto the DATED axis, focused where its context row
	 * sits — a context row only reaches `roadmap.context` at all through a focus level
	 * (`roadmapRows` reads `model.results`, which drops every `outsideFilter` row,
	 * unless focused), so Mid has to sit on the same PBI rung PBI.md does. Same shape
	 * as the roadmap block above, aimed at the schedule gestures instead: Mid carries
	 * dates of its own, which would place it on the grid as an ordinary bar were the
	 * context-row rule not holding.
	 */
	function timelineStressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', {
			frontmatter: { type: 'PBI', order: 5, start: '2026-08-05', target: '2026-08-15' },
			parentLink: 'Feature B',
		});
		// Context, between results: its parent (Feature B) and its child (Task) are both
		// results, and its own dates would otherwise place it on the grid as a bar.
		vault.addFile('Mid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-31' },
			parentLink: 'Feature B',
		});
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({
			startProperty: 'note.start',
			targetProperty: 'note.target',
		});
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('PBI');
		view.setProjection('roadmap');
		return { view, containerEl, vault };
	}

	it('never draws a context row as a bar, and never wires it as a source', () => {
		const { view, containerEl } = timelineStressView();
		expect(view.model?.byPath.get('Mid.md')?.outsideFilter).toBe(true);

		// Not on the grid at all — `deriveBars` routes it to `context` before a span is
		// ever computed — and, where it DOES render (the context strip beside the
		// shelf), never wired as a drag source: no shelf-card drop, no body slide, no
		// end grip, because none of `CardDragController.wireCard`'s three call sites
		// ever reach an `outsideFilter` item.
		expect(rowFor(containerEl, 'Mid')).toBeNull();
		const card = cardByTitle(containerEl, 'Mid');
		expect(card.getAttribute('draggable')).not.toBe('true');
		expect(card.querySelector('[data-pbl-hold]')).toBeNull();
	});

	it('refuses the whole batch if a date write names one anyway', async () => {
		// No UI produces this — that is the point: the last line of defence is
		// structural, so a future entry point (a fifth gesture nobody has written yet)
		// cannot reopen the hole by omission. `applySafely` refuses the WHOLE batch
		// rather than filtering, because dropping the offending write alone would apply
		// the rest and leave the hierarchy half-updated.
		const { view, vault } = timelineStressView();
		const mid = view.model?.byPath.get('Mid.md');

		const moved = await view.performScheduleMove(mid as never, { start: '2026-09-01' });

		expect(moved).toBe(false);
		expect(vault.fm('Mid.md').start).toBe('2026-08-01');
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});

	it('keeps a context row out of every derived number the dated axis reports', () => {
		const { view, containerEl } = timelineStressView();

		// Never counted, never shelved: the shelf is a statement about the RESULTS, and
		// the placed count plus the shelved count is the visible result rows (PBI.md
		// alone — Task.md sits below the focus level and is not itself a roadmap row).
		expect(shelfTitles(containerEl)).not.toContain('Mid');
		expect(view.roadmap?.roadmap.placedCount).toBe(1);
		expect(view.roadmap?.roadmap.context.map((i) => i.title)).toEqual(['Mid']);
	});

	it('offers no Schedule or Unschedule on a context row’s menu', () => {
		const { view } = timelineStressView();
		const mid = view.model?.byPath.get('Mid.md');

		view.showContextMenuFor(mid as never);

		expect(Menu.lastShown?.item('Schedule')).toBeUndefined();
		expect(Menu.lastShown?.item('Unschedule')).toBeUndefined();
	});
});

describe('write safety with context rows, at the dependency connector', () => {
	/** A dated axis where the excluded parent would draw a bar if it were a result. */
	function linkStressVault() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-30' } });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		vault.addFile('Other.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-20', due: '2026-08-28' } });
		return vault;
	}

	function linkStressView(vault: FakeVault) {
		const harness = makeView(
			vault,
			{ startProperty: 'note.start', targetProperty: 'note.due', dependsOnProperty: 'note.dependsOn' },
			// A context row only reaches the dated axis at all through a focus level whose
			// rung IT sits on (`roadmapRows` reads `model.results`, dropping every
			// `outsideFilter` row, unless focused) — the same reason `timelineStressView`
			// above focuses on Mid's own rung. Epic is the excluded PARENT here, so the
			// rung to focus is Epic's own, not Kid and Other's.
			{ collapsed: true, only: ['Kid.md', 'Other.md'], focus: 'Epic' },
		);
		harness.view.setProjection('roadmap');
		harness.view.setAxisPick('dates');
		return harness;
	}

	it('draws no connector on a context row, which has no bar to hang one on', () => {
		const { containerEl } = linkStressView(linkStressVault());
		// A context row draws no bar at all — `deriveBars` routes it to
		// `RoadmapModel.context` before a span is ever computed, and `renderContextStrip`
		// draws that list as ordinary cards beside the shelf, not as `.pbl-timeline-row`s
		// (`rowFor` finds nothing here, the same absence the timeline block above asserts
		// of Mid via `cardByTitle` rather than `rowFor`). `createCard` marks the card
		// `pbl-card-context pbl-outside`.
		const context = cardByTitle(containerEl, 'Epic');
		expect(context.classList.contains('pbl-outside')).toBe(true);
		expect(context.querySelector('.pbl-bar-connector')).toBeNull();
	});

	it('never offers a context row as a legal TARGET, which a drag could otherwise reach', () => {
		// The half a drag cannot demonstrate: the row draws no bar, so nothing could be
		// dropped on it — but `legalTargetPaths` is what the drop re-asks, and it is the
		// answer that has to exclude it.
		const vault = linkStressVault();
		const { view } = linkStressView(vault);
		const model = view.model;
		if (!model) throw new Error('no model');
		const source = model.byPath.get('Kid.md');
		if (!source) throw new Error('no source');
		// Not vacuous: Epic is a genuine ancestor context row (`outsideFilter: true`),
		// not simply absent from the model — a note excluded from `only` with nothing
		// loading it as someone's ancestor would pass this same assertion for the wrong
		// reason, by never being a candidate `legalTargetPaths` walks at all.
		expect(model.byPath.get('Epic.md')?.outsideFilter).toBe(true);
		expect([...legalTargetPaths(view.app, model, source)]).not.toContain('Epic.md');
	});

	it('refuses the whole batch structurally if a write for one ever reaches the gate', async () => {
		// The backstop the two above stand in front of, driven where a gesture cannot
		// reach — the shape that holds for an entry point not yet written.
		const vault = linkStressVault();
		const { view } = linkStressView(vault);
		const context = view.model?.byPath.get('Epic.md');
		const other = view.model?.byPath.get('Other.md');
		if (!context || !other) throw new Error('fixture not as expected');
		expect(context.outsideFilter).toBe(true);
		await view.applySafely([{ file: context.file, dependsOn: { add: other.file } }]);

		expect(vault.fm('Epic.md')['dependsOn']).toBeUndefined();
		// The exact wording `writeGate.ts` uses — note the curly apostrophe, which every
		// other block in this file already matches on.
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});
});
