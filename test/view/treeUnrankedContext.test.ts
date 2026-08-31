// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, key, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('the plain tree drops an unranked context row from its ranking population', () => {
	/**
	 * `Epic A(1000)`, `Epic B(2000)`, `Epic C` (context, no `order`), with `Feature C1`
	 * (3000) nested under it — the brief's own reproduction. Epic C draws LAST regardless
	 * of the fix (`compareSiblings` always sorts an unranked context row last), so the
	 * TREE never redraws differently; what changes is the NUMBER `Move to bottom` writes
	 * for `Epic A`, and whether `Move down` on `Epic B` is offered at all. Unfixed,
	 * `siblingContext`'s tree branch read `model.realRoots` unfiltered, so Epic C — on
	 * screen and not row-hidden, since Feature C1 keeps it visible — was a real neighbour
	 * to `visibleNeighbor` and the last PEER `edgeTarget` could land beside, and
	 * `anchoredOrder` (`writePlan.ts`) skips it as an anchor and reads that as "append past
	 * the end of the whole population": 4000, past Feature C1, rather than a slot between
	 * Epic B and Feature C1.
	 */
	function unrankedTreeView() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature C1.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic C' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic C.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('draws Epic C last regardless, since compareSiblings never reorders it', () => {
		const { view, containerEl } = unrankedTreeView();
		const epicC = view.model?.byPath.get('Epic C.md');
		expect(epicC?.outsideFilter).toBe(true);
		expect(epicC?.order).toBeNull();
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Epic C', 'Feature C1']);
	});

	it('writes the midpoint beside Epic B for Move to bottom on Epic A, never past Feature C1', async () => {
		const { containerEl, vault } = unrankedTreeView();

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.items.find((i) => i.titleText === 'Move to bottom')?.clickHandler?.();
		await flush();

		const write = vault.writeLog.find((w) => w.path === 'Epic A.md');
		expect(write).toBeDefined();
		// Between Epic B (2000) and Feature C1 (3000) — the global neighbours once the
		// context row is out of the population — not 4000, a spacing clear of Feature C1
		// itself: unfixed, the anchor was Epic C, which `anchoredOrder` reads as no
		// position at all and appends past the whole population instead.
		expect(write?.fm.order).toBe(2500);
	});

	it('does not offer Move down on Epic B, the last writable root, past its unranked context neighbour', () => {
		const { containerEl } = unrankedTreeView();

		rowByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move down');
	});

	it('writes nothing when Alt+ArrowDown is pressed on Epic B anyway', async () => {
		const { view, containerEl, vault } = unrankedTreeView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Epic B.md') as never);

		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog.length).toBe(0);
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Epic C', 'Feature C1']);
	});
});
