// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { clickExpandAll, drag, flush, key, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('an unranked context row among focused peers', () => {
	/**
	 * A focus rank whose context row was never ranked at all — `PBI Ctx` carries no
	 * `order` frontmatter, unlike `test/view/contextRowWrites.test.ts`'s own
	 * `focusedStressView`. The writable row (`PBI A`, 1000) draws before it, since a
	 * null order sorts last, and that draw order is the whole reason `Move down` used
	 * to be offered here: the unranked peer read as a neighbour to swap past, the write
	 * landed (a real order, 2000), the undo slot was spent, and the draw came out
	 * identical because a null order still sorts last at any magnitude. `siblingContext`
	 * must exclude a context row with nothing to rank from (the same test
	 * `anchoredOrder`'s own `isUnrankedContext` already applies) from the focused peers,
	 * so the command is refused rather than offered and spent.
	 */
	function unrankedContextView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI Ctx.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		vault.addFile('Task Ctx.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI Ctx' });
		vault.addFile('PBI A.md', { frontmatter: { type: 'PBI', order: 1000 }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => !['Epic.md', 'PBI Ctx.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		view.setFocusLevel('PBI');
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('draws the writable row before its unranked context peer, not vacuously', () => {
		const { view, containerEl } = unrankedContextView();
		const ctx = view.model?.byPath.get('PBI Ctx.md');
		expect(ctx?.outsideFilter).toBe(true);
		expect(ctx?.order).toBeNull();
		expect(ctx?.focusRoot).toBe(true);
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI Ctx', 'Task Ctx']);
	});

	it('does not offer Move down past a context row with nothing to rank from', () => {
		const { containerEl } = unrankedContextView();

		rowByTitle(containerEl, 'PBI A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move down');
	});

	it('writes nothing when the row is DRAGGED onto that context peer either', async () => {
		// The drag reaches the same focus branch Alt+arrow does, and must refuse the same
		// anchor: `anchoredOrder` would read a rankless row as no position at all and send
		// the card to the end of the whole population, which is not where it was dropped.
		const { containerEl, vault } = unrankedContextView();

		drag(rowByTitle(containerEl, 'PBI A'), rowByTitle(containerEl, 'PBI Ctx'), 'after');
		await flush();

		expect(vault.writeLog.length).toBe(0);
	});

	it('writes nothing and moves nothing when Alt+ArrowDown is pressed anyway', async () => {
		const { view, containerEl, vault } = unrankedContextView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('PBI A.md') as never);

		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog.length).toBe(0);
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI Ctx', 'Task Ctx']);
	});
});

describe('ranking PAST an unranked context row', () => {
	/**
	 * The row is not the ANCHOR here — it merely sits among the focus rows, above the one
	 * the gesture aims at. `siblingPosition`'s focus branch built its peers unfiltered, so
	 * `orderForTarget` picked the rankless row as the anchor and `anchoredOrder` read that
	 * as "no position at all" — appending to the END of the whole population, which is the
	 * opposite end of the backlog from where the user aimed. `siblingContext` filtered the
	 * same list and the keyboard landed where it was aimed, so the drag and the two other
	 * inputs disagreed about one gesture.
	 *
	 * The writable rows are TIED deliberately: an unranked context row sorts last in rank
	 * order, so the only way one is drawn ABOVE a writable row is the tree-order fallback
	 * `inRankOrder` keeps for a population that is not distinctly ranked.
	 */
	function focusedView(sequence: ('Ctx' | 'A' | 'B')[]) {
		const vault = new FakeVault();
		const excluded = ['PBI Ctx.md'];
		sequence.forEach((name, i) => {
			const epic = `Epic ${i + 1}`;
			vault.addFile(`${epic}.md`, { frontmatter: { type: 'Epic', order: (i + 1) * 10 } });
			excluded.push(`${epic}.md`);
			if (name === 'Ctx') {
				vault.addFile('PBI Ctx.md', { frontmatter: { type: 'PBI' }, parentLink: epic });
				vault.addFile('Task Ctx.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI Ctx' });
			} else {
				vault.addFile(`PBI ${name}.md`, { frontmatter: { type: 'PBI', order: 5000 }, parentLink: epic });
			}
		});
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = { data: vault.entries().filter((e) => !excluded.includes(e.file.path)) };
		view.onDataUpdated();
		view.setFocusLevel('PBI');
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	/** The order this gesture wrote to `PBI B`, or null when it wrote nothing. */
	function rankOf(vault: FakeVault, path: string): number | null {
		const last = vault.writeLog.filter((w) => w.path === path).pop();
		return last === undefined ? null : (last.fm.order as number);
	}

	it('draws the unranked context row first, above both tied writable rows', () => {
		const { containerEl } = focusedView(['Ctx', 'A', 'B']);
		expect(titlesOf(containerEl)).toEqual(['PBI Ctx', 'Task Ctx', 'PBI A', 'PBI B']);
	});

	it('lands the drag, Alt+ArrowUp and the move menu on the SAME rank above PBI A', async () => {
		const dragged = focusedView(['Ctx', 'A', 'B']);
		drag(rowByTitle(dragged.containerEl, 'PBI B'), rowByTitle(dragged.containerEl, 'PBI A'), 'before');
		await flush();

		const keyed = focusedView(['Ctx', 'A', 'B']);
		keyed.view.selectItem(keyed.view.model?.byPath.get('PBI B.md') as never);
		key(treeOf(keyed.containerEl), 'ArrowUp', { altKey: true });
		await flush();

		const menued = focusedView(['Ctx', 'A', 'B']);
		rowByTitle(menued.containerEl, 'PBI B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.items.find((i) => i.titleText === 'Move up')?.clickHandler?.();
		await flush();

		const dragRank = rankOf(dragged.vault, 'PBI B.md');
		expect(dragRank).not.toBeNull();
		// Above `PBI A`, never past the end of the population — 6000 is what the unfiltered
		// peer list produced, and it is the bottom of the backlog rather than the aimed slot.
		expect(dragRank as number).toBeLessThan(5000);
		expect(rankOf(keyed.vault, 'PBI B.md')).toBe(dragRank);
		expect(rankOf(menued.vault, 'PBI B.md')).toBe(dragRank);
	});

	it('still reads the no-op index off the SAME filtered list', async () => {
		// `PBI A` is already before `PBI B`, so this drop moves the row past nothing. Read
		// against the unfiltered `model.roots`, the row's own index is one too high — the
		// no-op is missed, the placement anchors on the context row and the drop writes
		// 6000 to a row that did not move.
		const { containerEl, vault } = focusedView(['A', 'Ctx', 'B']);
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI Ctx', 'Task Ctx', 'PBI B']);

		drag(rowByTitle(containerEl, 'PBI A'), rowByTitle(containerEl, 'PBI B'), 'before');
		await flush();

		expect(vault.writeLog.length).toBe(0);
	});
});
