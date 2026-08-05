// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, treeOf, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { bucketNames, rowFor, shelfTitles } from '../helpers/roadmap';

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
