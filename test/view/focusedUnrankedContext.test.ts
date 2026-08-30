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
