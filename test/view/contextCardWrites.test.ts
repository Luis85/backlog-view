// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, treeOf, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
import { bucketNames } from '../helpers/roadmap';

/**
 * The context-row rule, driven against every entry point the CARD projections have.
 * Split from `test/view/contextRowWrites.test.ts` — which drives the tree's — when
 * the roadmap's write paths arrived: the two halves share a rule and share nothing
 * else, and one file holding both was the shape a suite takes just before it
 * becomes the place tests hide.
 *
 * A board column and a horizon bucket are the same gesture over different
 * properties, so the two blocks below deliberately read alike: the same three
 * questions — the drag, the paths a keyboard and a menu can reach that a drag
 * cannot, and the structural refusal behind both — asked of each projection.
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
			focusLevel: 'PBI',
		});
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
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
		anyView.config = new FakeViewConfig({ horizonProperty: 'note.horizon', focusLevel: 'PBI' });
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
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
