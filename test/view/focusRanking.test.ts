// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import {
	drag,
	flush,
	key,
	makeView,
	refresh,
	rowByTitle,
	rows,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

/**
 * A focus level re-roots the tree at one rung, and Task 5 makes those promoted rows a
 * legal rank destination: `siblingPosition` now answers for two active focus rows
 * rather than refusing on `item.focusRoot`. Two epics, so the two PBIs it ranks against
 * each other have different REAL parents — the case the brief resolves explicitly: the
 * rank writes `order` and never touches `parent`.
 */
function focusedFixture() {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
	vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
	vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
	return vault;
}

describe('focus rows accept a rank', () => {
	it('ranks a focused PBI above one with a different parent, writing order only', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });
		// Captured before the drop: `parentLink` seeds a real `parent: [[Epic B]]` key
		// (Obsidian indexes a resolved bracketed link), so the write's whole frontmatter
		// object is compared rather than probing for one key's absence — an implementation
		// that reparented onto the hovered row's own parent would still leave a `parent`
		// key on the note, just holding `[[Epic A]]` instead.
		const before = { ...vault.fm('PBI B1.md') };

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['PBI B1.md']);
		// Every other key, `parent` included, is exactly what it was — only `order` moved.
		expect(vault.fm('PBI B1.md')).toEqual({ ...before, order: 1500 });
	});

	it('drops a focused row back onto its own position and writes nothing', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		// PBI B1 is already second; dropping it right after PBI A1 asks for the slot
		// it already occupies. `peers` reproduces `model.roots` when the row is
		// spliced back in, so this must read as no move at all rather than a rank
		// that spends the undo slot with nothing changed on screen.
		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * The same fixture with `PBI B1`'s parent link pointing at a note that does not exist —
 * the raw bracketed spelling a vault produces for an unresolved link, so no
 * `frontmatterLinks` entry (see `test/CLAUDE.md`). `parent === null` and
 * `hasParentValue` is true, which is exactly the pair an EXPLICIT top-level drop shows,
 * and the only thing that tells them apart is `DropTarget.parentUnchanged`.
 */
function orphanedFixture() {
	const vault = focusedFixture();
	vault.addFile('PBI B1.md', {
		frontmatter: { type: 'PBI', order: 4000, parent: '[[No Such Note]]' },
	});
	return vault;
}

/** Select a row through the tree's own keyboard, so Alt+arrow acts on it. */
function selectRow(containerEl: HTMLElement, title: string): HTMLElement {
	const tree = treeOf(containerEl);
	for (const row of rows(containerEl)) {
		key(tree, 'ArrowDown');
		if (row.querySelector('.pbl-title')?.textContent === title) return tree;
	}
	throw new Error(`row not selectable: ${title}`);
}

/** Open the row's context menu and return the titles it offered. */
function menuTitles(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error('menu not shown');
	return menu.items.map((i) => i.titleText);
}

describe('one rank, three inputs', () => {
	/**
	 * The contract Task 6 exists for: a focus row is a ranking destination for the drag,
	 * the keyboard and the menu alike, and the three land the SAME number. Three views
	 * over three fresh vaults rather than one view undone twice — an undo that restored a
	 * DIFFERENT number would still leave the comparison green.
	 */
	it('lands the same rank from the drag, Alt+arrow and the menu', async () => {
		const dragVault = focusedFixture();
		const dragView = makeView(dragVault, {}, { focus: 'PBI' });
		drag(rowByTitle(dragView.containerEl, 'PBI B1'), rowByTitle(dragView.containerEl, 'PBI A1'), 'before');
		await flush();

		const keyVault = focusedFixture();
		const keyView = makeView(keyVault, {}, { focus: 'PBI' });
		key(selectRow(keyView.containerEl, 'PBI B1'), 'ArrowUp', { altKey: true });
		await flush();

		const menuVault = focusedFixture();
		const menuView = makeView(menuVault, {}, { focus: 'PBI' });
		menuTitles(menuView.containerEl, 'PBI B1');
		Menu.lastShown?.item('Move up')?.click();
		await flush();

		const byDrag = dragVault.fm('PBI B1.md')['order'];
		// Stated as well as compared: three inputs agreeing on nothing written is the way
		// this comparison passes while the feature is missing.
		expect(byDrag).toBe(1500);
		expect(keyVault.fm('PBI B1.md')['order']).toBe(byDrag);
		expect(menuVault.fm('PBI B1.md')['order']).toBe(byDrag);
	});

	it('still refuses indent and outdent across the focus row', () => {
		const { containerEl } = makeView(focusedFixture(), {}, { focus: 'PBI' });

		const titles = menuTitles(containerEl, 'PBI B1');
		expect(titles).toContain('Move up');
		expect(titles.some((title) => title.startsWith('Indent'))).toBe(false);
		expect(titles).not.toContain('Outdent');
	});

	/**
	 * `focusRoot` is set on any promoted root, focus or no focus — a catalog `Test suite`
	 * under an `Epic` carries it while its real siblings are off screen. Membership in an
	 * ACTIVE focus forest is the test, so this one keeps the refusal. Non-vacuous by
	 * construction: `Suite 0` is a real previous sibling, so a `siblingContext` that fell
	 * through to the parent's children would offer `Move up` here.
	 */
	it('refuses to rank a promoted root that is not an active focus row', () => {
		const vault = focusedFixture();
		vault.addFile('Suite 0.md', { frontmatter: { type: 'Test suite', order: 5000 }, parentLink: 'Epic A' });
		vault.addFile('Suite 1.md', { frontmatter: { type: 'Test suite', order: 6000 }, parentLink: 'Epic A' });
		const { view, containerEl } = makeView(vault, {}, {});
		view.setProjection('catalog');

		const titles = menuTitles(containerEl, 'Suite 1');
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Move to top');
	});
});

describe('a focus rank never touches the parent key', () => {
	/**
	 * The trap this task carries: `DropTarget.parent` for a focus rank RESTATES the moved
	 * row's own parent, and for an unresolved link that value is `null` — indistinguishable
	 * from an explicit top-level drop, which must clear the stale key. Without
	 * `parentUnchanged` the keyboard deletes the property on every focused move.
	 *
	 * The whole frontmatter object is compared, so a DELETED key fails: asserting the
	 * parent is merely "not Epic A" passes on the very bug this pins. `order` is asserted
	 * changed in the same object, so the test cannot pass by refusing the move.
	 */
	it('leaves an unresolved parent link alone when the keyboard ranks a focus row', async () => {
		const vault = orphanedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		key(selectRow(containerEl, 'PBI B1'), 'ArrowUp', { altKey: true });
		await flush();

		expect(vault.fm('PBI B1.md')).toEqual({ type: 'PBI', order: 1500, parent: '[[No Such Note]]' });
	});

	it('leaves it alone when the MENU ranks the same row', async () => {
		const vault = orphanedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		menuTitles(containerEl, 'PBI B1');
		Menu.lastShown?.item('Move up')?.click();
		await flush();

		expect(vault.fm('PBI B1.md')).toEqual({ type: 'PBI', order: 1500, parent: '[[No Such Note]]' });
	});
});

describe('a menu outlives the model it was built from', () => {
	/**
	 * A context menu captures its item when it opens; a Bases refresh while it is open
	 * rebuilds every item as a NEW object, and every lookup on the way to a rank compares
	 * objects (`model.roots.includes`, `children.indexOf`, `ranked.indexOf`). The captured
	 * row is then in none of them and the move does nothing at all, silently. jsdom never
	 * refreshes on its own, so the rebuild here is deliberate.
	 */
	it('ranks the row the menu names after the model was rebuilt under it', async () => {
		const vault = focusedFixture();
		const { view, containerEl } = makeView(vault, {}, { focus: 'PBI' });

		menuTitles(containerEl, 'PBI B1');
		const captured = Menu.lastShown?.item('Move up');
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('PBI B1.md')['order']).toBe(1500);
	});

	/**
	 * The other half of that re-resolution, and the half it broke: re-resolving the
	 * SUBJECT without re-resolving the TARGET makes the label and the write disagree.
	 * `Indent under "X"` is the one entry in this menu whose title names the note it
	 * reparents onto, and the click recomputed that destination from the row's previous
	 * visible neighbour AT CLICK TIME. Before the by-path lookup the stale item simply
	 * failed every lookup and the move refused — silently, but harmlessly; afterwards the
	 * subject resolves, the write lands, and it lands on the wrong parent.
	 *
	 * Both tests rebuild the model deliberately between opening the menu and clicking.
	 * jsdom refreshes on nothing of its own, so a test without that rebuild proves nothing.
	 */
	function indentFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic A' });
		return vault;
	}

	it('indents under the note the title named, not the neighbour the refresh produced', async () => {
		const vault = indentFixture();
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// A new sibling lands between the two, so F2's previous visible neighbour is no
		// longer the row the open menu is naming.
		vault.addFile('F15.md', { frontmatter: { type: 'Feature', order: 2500 }, parentLink: 'Epic A' });
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[F1]]');
	});

	it('refuses when the named note has become the item\'s own descendant', async () => {
		const vault = indentFixture();
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// The named row is still THERE, and still resolves by path — it has just been moved
		// under the very item the menu is about. A previous visible sibling can never be a
		// descendant, so the recomputed destination never had to ask; a re-resolved one is
		// wherever the vault has since put it, and writing this one makes a cycle.
		vault.files.delete('F1.md');
		vault.caches.delete('F1.md');
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'F2' });
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[Epic A]]');
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses when the named note is no longer a destination at all', async () => {
		const vault = indentFixture();
		vault.addFile('F0.md', { frontmatter: { type: 'Feature', order: 1500 }, parentLink: 'Epic A' });
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// The named row leaves the vault. F0 is what a recomputed neighbour would find,
		// and the write must not go there — a command that cannot do what its title says
		// does nothing, the refusal this path had before the subject was re-resolved.
		vault.files.delete('F1.md');
		vault.caches.delete('F1.md');
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[Epic A]]');
		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * A refused placement is the one drop outcome nothing used to report. The indicator
 * accepts the drop — `dropTargets.ts` decides where a row may LAND, and the rank is an
 * arithmetic question asked afterwards — so silence reads as a broken gesture rather than
 * as a full range, and the remedy each refusal names is the whole value of saying it.
 */
describe('a drop that cannot be ranked says why', () => {
	/** Two ranks a rounding step apart, so no six-decimal number fits between them. */
	function squeezedFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2.000001 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
		return vault;
	}

	it('names Respace when the gap between the two neighbours is spent', async () => {
		const vault = squeezedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'No room left between those two items. Run "Respace ranks" from the command palette.',
		]);
	});

	it('names the set-up button when a neighbour has no rank at all', async () => {
		const vault = squeezedFixture();
		// A blank rank is a different fact from a full range, and it takes the other
		// remedy: the backfill can fill this one in, and Respace cannot invent a position.
		vault.addFile('PBI A2.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic A' });
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		// Landing after the blank makes the blank the anchor, and an anchor with no number
		// is the one thing no arithmetic can place against.
		drag(rowByTitle(containerEl, 'PBI A1'), rowByTitle(containerEl, 'PBI A2'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'That item has no rank yet. Use the toolbar’s set-up button to fill in the missing ones.',
		]);
	});

	it('reports the CONFIGURATION instead, because every remedy above is blocked by it', async () => {
		// Both roles on one key: no note has a readable rank, so the placement refuses
		// `unranked` — and the button that sentence names refuses at the same gate. The
		// advice would be a dead end, so the gate's own refusal is what is said.
		const vault = squeezedFixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' }, { focus: 'PBI' });

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'Fix the view options first: the parent and order properties share the key "parent".',
		]);
	});
});
