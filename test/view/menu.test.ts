// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { expandAll, fixture, flush, key, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('context menu', () => {
	it('offers structural actions and performs outdent', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');

		expect(menu.item('New PBI')).toBeDefined();
		expect(menu.item('Set type')).toBeDefined();
		expect(menu.item('Move down')).toBeDefined();
		expect(menu.item('Outdent')).toBeDefined();
		// Standard file menu appended for the note
		expect(vault.triggers.some((t) => t[0] === 'file-menu')).toBe(true);

		menu.item('Outdent')?.click();
		await flush();
		expect('parent' in vault.fm('Feature B1.md')).toBe(false);
	});

	it('opens the item in a new tab or split from the menu', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Open in new tab')?.click();
		Menu.lastShown?.item('Open to the right')?.click();

		expect(vault.opened).toEqual([
			{ path: 'Epic A.md', mode: 'tab' },
			{ path: 'Epic A.md', mode: 'split' },
		]);
	});

	it('moves an item to the top of its siblings', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move to top')?.click();
		await flush();

		expect(vault.fm('Feature B2.md')['order']).toBe(0);
	});

	it('sets the type through the submenu', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set type')?.submenu;
		if (!submenu) throw new Error('submenu missing');

		// Every type a user may assign by hand: the ladder, the extra types, then the markers.
		expect(submenu.items.map((i) => i.titleText)).toEqual([
			'Epic',
			'Feature',
			'PBI',
			'Task',
			'Issue',
			'Bug',
			'Idea',
			'Milestone',
		]);
		expect(submenu.item('Epic')?.checked).toBe(true);
		submenu.item('Task')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['type']).toBe('Task');
	});

	it('indents under the previous sibling and moves to the bottom', async () => {
		const vault = fixture();
		// Indenting re-types only when re-typing on move is asked for.
		const { containerEl } = makeView(vault, { autoAssignType: true });

		rowByTitle(containerEl, 'Feature B2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Indent under "Feature B1"')?.click();
		await flush();
		expect(vault.fm('Feature B2.md')['parent']).toBe('[[Feature B1]]');
		expect(vault.fm('Feature B2.md')['type']).toBe('PBI');

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move to bottom')?.click();
		await flush();
		expect(vault.fm('Feature B1.md')['order']).toBe(30);
	});

	it('clears a stale parent link through the menu', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Clear parent link')?.click();
		await flush();

		expect('parent' in vault.fm('Orphan.md')).toBe(false);
	});

	it('offers "Use folder position" for overridden items in folder mode only', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Beta/Beta.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Alpha/Feat/Feat.md', { frontmatter: { type: 'Feature' }, parentLink: 'Beta' });
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Feat').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Use folder position')?.click();
		await flush();
		expect('parent' in vault.fm('Epics/Alpha/Feat/Feat.md')).toBe(false);

		// Outside folder mode the action does not exist
		const flat = makeView(fixture());
		rowByTitle(flat.containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Use folder position')).toBeUndefined();
	});

	it('retypes items handed back to the folder hierarchy', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Alpha/Login/Login.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Epics/Alpha/Login/Fast path/Fast path.md', {
			frontmatter: { type: 'Feature' },
			parentLink: 'Alpha',
		});
		const { containerEl } = makeView(vault, { autoAssignType: true, inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Fast path').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Use folder position')?.click();
		await flush();

		// The folder parent is the Feature "Login", so the item becomes a PBI
		const fm = vault.fm('Epics/Alpha/Login/Fast path/Fast path.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('PBI');
	});

	it('retypes an orphan cleared to the top level', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault, { autoAssignType: true });

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Clear parent link')?.click();
		await flush();

		const fm = vault.fm('Orphan.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('Epic');
	});

	it('opens the context menu from the keyboard', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');

		Menu.lastShown = null;
		key(tree, 'ContextMenu');
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		Menu.lastShown = null;
		key(tree, 'F10', { shiftKey: true });
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		// Plain F10 is not a menu shortcut
		Menu.lastShown = null;
		key(tree, 'F10');
		expect(Menu.lastShown).toBeNull();
	});

});

describe('placement actions on a milestone', () => {
	it('withholds Schedule from a milestone on a start-only vault, and keeps it for work', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10 } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 20 } });
		const { containerEl } = makeView(vault, { startProperty: 'note.start' });

		rowByTitle(containerEl, 'Ship 1.0').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).not.toContain('Schedule');

		rowByTitle(containerEl, 'A story').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Schedule');
	});
});

describe('focused structure operations', () => {
	it('outdents a child of a rootless focus row against the real top level', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Loose Feature.md', { frontmatter: { type: 'Feature', order: 5 } });
		vault.addFile('Story.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Loose Feature' });
		const { containerEl } = makeView(vault, {}, { focus: 'Feature' });

		rowByTitle(containerEl, 'Story').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Outdent')?.click();
		await flush();

		const fm = vault.fm('Story.md');
		expect('parent' in fm).toBe(false);
		// Midpoint between the REAL roots Loose Feature (5) and Epic (100)
		expect(fm['order']).toBe(52.5);
	});
});

describe('move commands that do not rank', () => {
	/** Epic over Feature A (context, its PBI matched) and Feature B (a result). */
	function mixedSiblings() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => ['Feature B.md', 'PBI.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('still offers indent, which appends instead of ranking', () => {
		const { containerEl } = mixedSiblings();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		// Reordering stays out, but indenting under the previous sibling is safe
		expect(titles).not.toContain('Move up');
		expect(titles).toContain('Indent under "Feature A"');
	});

	it('indents into a mixed group without writing to the context row', async () => {
		const { containerEl, vault } = mixedSiblings();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.items.find((i) => i.titleText.startsWith('Indent'))?.clickHandler?.();
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['Feature B.md']);
		expect(vault.fm('Feature B.md').parent).toBe('[[Feature A]]');
	});
});
