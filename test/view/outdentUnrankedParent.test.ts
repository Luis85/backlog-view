// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, key, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

/**
 * Clear every configured folder, so folder INFERENCE is what runs rather than a typed
 * folder answering the parent link question this file never asks.
 */
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};

useViewHarness();

/**
 * Task 7: an outdent lands right after its PARENT among the grandparent's children — the
 * parent IS the anchor, never a peer skipped past on the way to one. When that parent is
 * a context row with no rank, `compareRank` sorts it last and no finite number sorts
 * after it, so the placement this command names cannot be expressed.
 */
describe('outdenting past a context parent with no rank', () => {
	/** `Epic` → `Parent` (context; `parentOrder` says whether it carries a rank) → `Item`. */
	function unrankedParentView(parentOrder: number | null) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Parent.md', {
			frontmatter: parentOrder === null ? { type: 'Feature' } : { type: 'Feature', order: parentOrder },
			parentLink: 'Epic',
		});
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Parent' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig(NO_TYPE_FOLDERS);
		// Only Item matches the base; Parent and Epic are pulled in as context.
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'Item.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('withholds Outdent from the menu when the parent has no rank', () => {
		const { containerEl } = unrankedParentView(null);

		rowByTitle(containerEl, 'Item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Outdent')).toBeUndefined();
	});

	it('reports the refusal on Alt+ArrowLeft rather than going quiet, and writes nothing', async () => {
		const { view, containerEl, vault } = unrankedParentView(null);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Item.md') as never);

		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('Item.md').parent).toBe('[[Parent]]');
		expect(Notice.messages).toEqual(['Its parent has no rank of its own, so nothing can be placed next to it.']);
	});

	/** The control: a RANKED context parent is an ordinary anchor and still works. */
	it('outdents past a RANKED context parent and writes the number it used to', async () => {
		const { view, containerEl, vault } = unrankedParentView(15);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Item.md') as never);

		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['Item.md']);
		expect(vault.fm('Item.md').parent).toBe('[[Epic]]');
		// One spacing clear of Parent's own rank (15): Parent has no NEXT neighbour in
		// the ranked population once Item is filtered out of it — Epic(10) is in that
		// population too, just not adjacent on this side.
		expect(vault.fm('Item.md')['order']).toBe(1015);
		expect(Notice.messages).toEqual([]);
	});
});
