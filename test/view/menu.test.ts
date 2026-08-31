// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { fakeController, FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { clickExpandAll, fixture, flush, key, makeView, refresh, rowByTitle, treeOf, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';

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

	/**
	 * The two entries between `Move to top` and `Move to bottom`, which the suite asserted
	 * the PRESENCE of and never the effect: a swap with the neighbour, not a jump to the
	 * end. Both directions, because the entry is offered per direction — `Move up` only
	 * with a rendered sibling above, `Move down` only with one below — and a single-sided
	 * test would pass against a menu that wired both to the same handler.
	 *
	 * **THREE siblings, not the fixture's two.** With two, a swap and a jump to the edge
	 * land on the same order, so `fixture()` alone cannot tell the two apart — pointing
	 * both handlers at `moveToEdge` left the earlier version of this test green. So the
	 * item moved is an END one and the assertion is that it lands in the MIDDLE, which is
	 * the one position the edge move can never produce.
	 */
	it('swaps an item with its neighbour rather than sending it to the edge', async () => {
		const vault = fixture();
		vault.addFile('Feature B3.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic B' });
		const { view, containerEl } = makeView(vault);
		const order = (title: string): number => vault.fm(`${title}.md`)['order'] as number;

		// Last of three, one step UP: the middle, never the top.
		rowByTitle(containerEl, 'Feature B3').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move up')?.click();
		await flush();
		expect(order('Feature B1')).toBeLessThan(order('Feature B3'));
		expect(order('Feature B3')).toBeLessThan(order('Feature B2'));

		// Nothing refreshes on its own here, and the entry is gated on the RENDERED
		// neighbours: without this the model still holds the old order, so the menu is
		// built from it and the optional chain below would assert against a click that
		// never happened.
		refresh(view, vault);

		// First of three, one step DOWN: the middle again, never the bottom.
		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move down')?.click();
		await flush();
		expect(order('Feature B3')).toBeLessThan(order('Feature B1'));
		expect(order('Feature B1')).toBeLessThan(order('Feature B2'));
	});

	it('sets the type through the submenu', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set type')?.submenu;
		if (!submenu) throw new Error('submenu missing');

		// Every type a user may assign by hand HERE: the ladder, the extra types, then the one
		// marker this view still draws. `Iteration` and — since 2026-08-24 — `Release` are
		// withheld from every offering surface, each having a view or a control of its own
		// that makes them; retyping a row to one would move it off the screen it was acted
		// on, which is what `byProjectionType` exists to prevent.
		expect(submenu.items.map((i) => i.titleText)).toEqual([
			'Epic',
			'Feature',
			'PBI',
			'Task',
			'Issue',
			'Bug',
			'Idea',
			'Deliverable',
			'Improvement',
			'Milestone',
		]);
		expect(submenu.item('Epic')?.checked).toBe(true);
		submenu.item('Task')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['type']).toBe('Task');
	});

	it('writes the type and nothing else, even for a marker on a nested row', async () => {
		// The INVERSE of "a move never writes a type", and the half that had no check: a
		// type write never moves the note. Asked with a MARKER — one hangs from nothing, so
		// surely picking one re-roots the row? No: that is what is OFFERED, never what is
		// refused or corrected behind the user's back, and joining the two rules is what
		// the deleted re-typing cascade did.
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set type')?.submenu?.item('Milestone')?.click();
		await flush();

		expect(vault.fm('Feature B1.md')['type']).toBe('Milestone');
		expect(vault.fm('Feature B1.md')['parent']).toBe('[[Epic B]]');
	});

	it('indents under the previous sibling and moves to the bottom', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Indent under "Feature B1"')?.click();
		await flush();
		expect(vault.fm('Feature B2.md')['parent']).toBe('[[Feature B1]]');
		// Indenting is a move, so the type it declared is the type it keeps.
		expect(vault.fm('Feature B2.md')['type']).toBe('Feature');

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

	it('leaves the type alone on an item handed back to the folder hierarchy', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Alpha/Login/Login.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Epics/Alpha/Login/Fast path/Fast path.md', {
			frontmatter: { type: 'Feature' },
			parentLink: 'Alpha',
		});
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Fast path').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Use folder position')?.click();
		await flush();

		// The folder parent is the Feature "Login", so the item now READS as a PBI — and
		// that reading is derived. Deleting the key is the whole write.
		const fm = vault.fm('Epics/Alpha/Login/Fast path/Fast path.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('Feature');
	});

	it('leaves the type alone on an orphan cleared to the top level', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Clear parent link')?.click();
		await flush();

		const fm = vault.fm('Orphan.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('Feature');
	});

	it('opens the context menu from the keyboard', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');

		Menu.forget();
		key(tree, 'ContextMenu');
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		Menu.forget();
		key(tree, 'F10', { shiftKey: true });
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		// Plain F10 is not a menu shortcut
		Menu.forget();
		key(tree, 'F10');
		expect(Menu.lastShown).toBeNull();
	});

});

describe('placement actions on a marker', () => {
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
		const view = new ProductBacklogView(fakeController(), containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => ['Feature B.md', 'PBI.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		clickExpandAll(containerEl);
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

describe('the Deliverables board’s card menu', () => {
	it('offers Set state on a Deliverables-board card when only the Deliverable key is configured', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, {
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const setState = Menu.lastShown?.item('Set state');
		expect(setState).toBeDefined();
		const submenu = setState?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toContain('Review');
	});

	it('checks the entry against deliverableStateValue, and writing it touches only that key', async () => {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Untouched', deliverableStatus: 'Draft' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		expect(submenu?.item('Draft')?.checked).toBe(true);

		submenu?.item('Review')?.click();
		await flush();
		expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
		expect(vault.fm('D.md')['status']).toBe('Untouched');
	});

	it('gates the tree’s Set state on each item’s OWN workflow key', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 20 } });
		// deliverableStateKey configured, requirements stateKey left unset. Which key a
		// menu promises to write is the ITEM's question, not the projection's: the
		// Deliverable's resolves to a real key, so Set state is offered and a pick lands
		// bytes; the PBI's resolves to '', so it must not appear promising a write to an
		// empty key that `applyWrites` would silently drop.
		const { containerEl } = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Set state')).toBeDefined();

		rowByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Set state')).toBeUndefined();
	});

	it('offers Set state on a Deliverables-board card when only the shared (requirements) key is configured', () => {
		// Deliverables don't need their own dedicated status property — with no
		// Deliverable state property configured, the board falls back to the shared one.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Draft' } });
		const harness = makeView(vault, { stateProperty: 'note.status', stateValues: 'Draft, Review' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const setState = Menu.lastShown?.item('Set state');
		expect(setState).toBeDefined();
		const submenu = setState?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toContain('Review');
	});

	it('checks the fallback entry against the shared key, and writing it touches only that key', async () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Draft' } });
		const harness = makeView(vault, { stateProperty: 'note.status', stateValues: 'Draft, Review' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		expect(submenu?.item('Draft')?.checked).toBe(true);

		submenu?.item('Review')?.click();
		await flush();
		expect(vault.fm('D.md')['status']).toBe('Review');
	});
});
