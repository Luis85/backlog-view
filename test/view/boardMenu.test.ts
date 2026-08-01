// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, treeOf, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';
import { announced, boardVault, cardByTitle, columnByName, columnNames, makeBoard } from '../helpers/board';

useViewHarness();

/** Open a card's context menu the way a pointer does, and hand back what it built. */
function cardMenu(containerEl: HTMLElement, title: string): Menu {
	cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no menu shown for card: ${title}`);
	return menu;
}

/** The Set state submenu of a card's context menu. */
function setStateMenu(containerEl: HTMLElement, title: string): Menu {
	const submenu = cardMenu(containerEl, title).item('Set state')?.submenu;
	if (!submenu) throw new Error(`no Set state submenu for card: ${title}`);
	return submenu;
}

/** Select a card by clicking it, so the keyboard has something to move. */
function select(containerEl: HTMLElement, title: string): void {
	cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('moving a card without a drag', () => {
	it('Alt+Right advances the selected card one column, writing the drop’s own value', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		select(containerEl, 'Epic A');

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();

		// "New" is column 1, so one to the right is "Active" — the configured string,
		// byte for byte, exactly as a drop writes it.
		expect(vault.fm('Epic A.md')['status']).toBe('Active');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('Alt+Left into the no-state column removes the key, and undo puts it back', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const tree = treeOf(containerEl);
		select(containerEl, 'Epic A');

		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect('status' in vault.fm('Epic A.md')).toBe(false);

		// It rode the gate like every other write, so it can be taken back.
		key(tree, 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('New');
	});

	it('the edges hold rather than wrap', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const tree = treeOf(containerEl);

		// Feature B2 has no state: it sits in the leading column, with nothing to its left.
		select(containerEl, 'Feature B2');
		key(tree, 'ArrowLeft', { altKey: true });
		// Feature B1 is Done: the last column, with nothing to its right. Wrapping here
		// would send finished work back to the start of the workflow unasked.
		select(containerEl, 'Feature B1');
		key(tree, 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('has no Alt+Up or Alt+Down — within-column order is derived, not stored', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		select(containerEl, 'Epic A');

		key(treeOf(containerEl), 'ArrowUp', { altKey: true });
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		// A rank shortcut would promise a position the board does not keep, and the
		// pair stays free for lanes.
		expect(vault.writeLog).toEqual([]);
	});

	it('does nothing on a column stop — a column is not a thing that moves', async () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowRight'); // into the board
		key(tree, 'ArrowUp'); // up off the first card, onto the column itself
		expect(view.selectedBoardColumn).not.toBeNull();
		key(tree, 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('config problems block a keyboard move, exactly as every other write', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault, { orderProperty: 'note.parent' });
		select(containerEl, 'Epic A');

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.fm('Epic A.md')['status']).toBe('New');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});

describe('the board’s card menu', () => {
	it('Set state offers exactly the board’s columns — no state and strays included', () => {
		const vault = boardVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 30, status: 'Blocked' } });
		const { containerEl } = makeBoard(vault);

		// The equivalence this PBI exists for: every target a drag can reach, the menu
		// offers, and the other way round. Read off the columns, so it cannot drift.
		expect(setStateMenu(containerEl, 'Epic A').items.map((i) => i.titleText)).toEqual(columnNames(containerEl));
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done', 'Blocked']);
	});

	it('checks the column the card is in, no state included', () => {
		const { containerEl } = makeBoard(boardVault());

		expect(setStateMenu(containerEl, 'Epic A').item('New')?.checked).toBe(true);
		// Feature B2 has no state property at all: the no-state entry is its column.
		expect(setStateMenu(containerEl, 'Feature B2').item('No state')?.checked).toBe(true);
		expect(setStateMenu(containerEl, 'Feature B2').item('New')?.checked).toBe(false);
	});

	it('writes what the matching column’s drop writes, no state included', async () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);

		setStateMenu(containerEl, 'Epic A').item('Done')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('Done');

		// The no-state entry removes the key, as the no-state column's drop does —
		// not an empty string, which would be a state value nobody configured.
		setStateMenu(containerEl, 'Epic B').item('No state')?.click();
		await flush();
		expect('status' in vault.fm('Epic B.md')).toBe(false);
	});

	it('withholds the tree’s move section — a card has no visible neighbours', () => {
		const { containerEl } = makeBoard(boardVault());
		const menu = cardMenu(containerEl, 'Feature B1');

		// Every entry in that section is defined by the row above or below, and on a
		// board there is none: within-column order is derived, so there is no rank to
		// move within and no sibling to indent under.
		for (const gone of ['Move up', 'Move down', 'Move to top', 'Move to bottom', 'Outdent']) {
			expect(menu.item(gone)).toBeUndefined();
		}
		// What is left is what still means something on a card.
		expect(menu.item('Set state')).toBeDefined();
		expect(menu.item('Set type')).toBeDefined();
		// Creating a child still means something on a card: it writes a DIFFERENT note.
		expect(menu.item('New PBI')).toBeDefined();
		expect(menu.item('Open in new tab')).toBeDefined();
	});

	it('is reachable from the keyboard, the path a touch device takes by menu', () => {
		const { containerEl } = makeBoard(boardVault());
		select(containerEl, 'Epic A');

		key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown?.item('Set state')).toBeDefined();

		Menu.lastShown = null;
		key(treeOf(containerEl), 'F10', { shiftKey: true });
		expect(Menu.lastShown?.item('Set state')).toBeDefined();
	});
});

describe('the board’s hidden instructions', () => {
	it('describe the shortcuts and the menu path, and go with the board', () => {
		const { containerEl, view } = makeBoard(boardVault());
		const tree = treeOf(containerEl);

		const help = document.getElementById(tree.getAttribute('aria-describedby') ?? '');
		// Told, not left to be discovered: a drag a screen-reader user cannot make is
		// not an alternative they should have to guess at.
		expect(help?.textContent).toContain('Alt with left or right arrow');
		expect(help?.textContent).toContain('menu key');
		expect(help?.hasClass('pbl-sr-only')).toBe(true);
		// Hidden as an element, still read as a description: the board is a listbox
		// and a stray div among its options is content a reader may announce alone.
		expect(help?.getAttribute('aria-hidden')).toBe('true');

		// The description belongs to the board; in the tree it would describe an
		// element that no longer exists, which reads as no description at all.
		view.setBoardMode(false);
		expect(tree.getAttribute('aria-describedby')).toBeNull();
	});

	it('is minted per board, so two in split panes describe their own', () => {
		const first = makeBoard(boardVault());
		const second = makeBoard(boardVault());

		const a = treeOf(first.containerEl).getAttribute('aria-describedby');
		const b = treeOf(second.containerEl).getAttribute('aria-describedby');
		expect(a).not.toBe(b);
		// And each id resolves — `aria-describedby` is looked up across the whole
		// document, so a shared id would point one board at the other's element.
		expect(first.containerEl.querySelector(`#${a}`)).not.toBeNull();
		expect(second.containerEl.querySelector(`#${b}`)).not.toBeNull();
	});
});

describe('announcing every board move', () => {
	it('names the card, the column it left and the column it reached', async () => {
		vi.useFakeTimers();
		const { containerEl } = makeBoard(boardVault());

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Done'));

		// Old column and new: "moved" alone leaves a screen-reader user knowing
		// something happened and not what.
		expect(await announced()).toBe('Moved "Epic A" from New to Done');
	});

	it('says the same thing for a keyboard move and a menu move', async () => {
		vi.useFakeTimers();
		const { containerEl } = makeBoard(boardVault());
		select(containerEl, 'Epic A');

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		expect(await announced()).toBe('Moved "Epic A" from New to Active');

		setStateMenu(containerEl, 'Epic B').item('Done')?.click();
		expect(await announced()).toBe('Moved "Epic B" from Active to Done');
	});

	it('names the no-state COLUMN rather than a silence, in both directions', async () => {
		vi.useFakeTimers();
		const { containerEl } = makeBoard(boardVault());

		// A card leaving no-state, and one arriving in it: the label is what the user
		// can see on screen, never the empty value underneath it.
		boardDrag(cardByTitle(containerEl, 'Feature B2'), columnByName(containerEl, 'Active'));
		expect(await announced()).toBe('Moved "Feature B2" from No state to Active');

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'No state'));
		expect(await announced()).toBe('Moved "Epic A" from New to No state');
	});

	it('announces nothing for a move that writes nothing', async () => {
		vi.useFakeTimers();
		const { containerEl } = makeBoard(boardVault());

		// Onto its own column: no write, so nothing changed and nothing is reported.
		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'New'));

		expect(await announced()).toBe('');
	});
});
