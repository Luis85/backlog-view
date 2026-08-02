// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { flush, key, refresh, treeOf, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
import {
	boardVault,
	cardByTitle,
	cardTitles,
	columnByName,
	columnsOf,
	countOf,
	makeBoard as board,
} from '../helpers/board';

useViewHarness();

describe('dragging a card to a new state', () => {
	it('dropping on a column writes that state’s canonical value', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);

		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Done'));
		await flush();

		expect(vault.fm('Epic A.md')['status']).toBe('Done');
		// Only the state key: a board move never touches parent, order or type.
		expect(vault.fm('Epic A.md')['order']).toBe(10);
		expect(vault.fm('Epic A.md')['type']).toBe('Epic');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('the column under the drag highlights — the only drop signal', () => {
		const { containerEl } = board(boardVault());
		const done = columnByName(containerEl, 'Done');

		const card = cardByTitle(containerEl, 'Epic A');
		card.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		// No dataTransfer on this event: pragmatic ignores it, and no drag starts.
		expect(done.hasClass('pbl-drop-over')).toBe(false);

		cardDrag(card, done);
		// The gesture ended; the highlight must not survive it.
		expect(done.hasClass('pbl-drop-over')).toBe(false);
	});

	it('dropping on the no-state column removes the key, and undo puts it back', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);

		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'No state'));
		await flush();
		expect('status' in vault.fm('Epic A.md')).toBe(false);

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('New');
	});

	it('dropping a card on its own column writes nothing and keeps the undo slot', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);

		// A real change first, so there is an undo slot to protect.
		cardDrag(cardByTitle(containerEl, 'Epic B'), columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.fm('Epic B.md')['status']).toBe('Done');
		expect(vault.writeLog).toHaveLength(1);

		// Same column, case-insensitively: Epic A's "New" is the New column.
		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'New'));
		await flush();
		expect(vault.writeLog).toHaveLength(1);

		// The slot still holds the first move, not the no-op.
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Epic B.md')['status']).toBe('Active');
	});

	it('an out-of-workflow column is a drop target like any other, writing the observed value', async () => {
		const vault = boardVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 30, status: 'Blocked' } });
		const { containerEl } = board(vault);

		// The board's targets are the configured states, the observed out-of-workflow
		// values, and no-state ([[Keyboard, menu and touch]]): "Blocked" is observed,
		// so consolidating another card into it is a legitimate, reversible write —
		// the value written is the observed string, exactly.
		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Blocked'));
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('Blocked');
	});

	it('never accepts another board’s drag, even over the same note', async () => {
		const vaultA = boardVault();
		const a = board(vaultA);
		// A second saved board in a split pane — the register's own advertised setup.
		const vaultB = boardVault();
		const b = board(vaultB);

		// The adapter's registry is document-global; without the instance token this
		// drop would write B's state key for a gesture made on A's board.
		cardDrag(cardByTitle(a.containerEl, 'Epic A'), columnByName(b.containerEl, 'Done'));
		await flush();

		expect(vaultA.fm('Epic A.md')['status']).toBe('New');
		expect(vaultB.fm('Epic A.md')['status']).toBe('New');
		expect(vaultA.writeLog).toHaveLength(0);
		expect(vaultB.writeLog).toHaveLength(0);
		// And the foreign target never even highlighted.
		expect(columnByName(b.containerEl, 'Done').hasClass('pbl-drop-over')).toBe(false);
	});

	it('config problems block a board move, exactly as every other write', async () => {
		const vault = boardVault();
		// Parent and order share a key: the gate must refuse everything.
		const { containerEl } = board(vault, { orderProperty: 'note.parent' });

		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Done'));
		await flush();

		expect(vault.fm('Epic A.md')['status']).toBe('New');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});

describe('the board keyboard', () => {
	it('arrows drive cards and columns in one tab stop, and Enter opens', () => {
		const vault = boardVault();
		const { containerEl } = board(vault);
		const tree = treeOf(containerEl);
		expect(tree.getAttribute('tabindex')).toBe('0');

		// Entering the board lands on the leading column's card.
		key(tree, 'ArrowRight');
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);
		// Across columns, the selection follows.
		key(tree, 'ArrowRight');
		expect(cardByTitle(containerEl, 'Epic A').hasClass('pbl-selected')).toBe(true);
		key(tree, 'End');
		expect(cardByTitle(containerEl, 'Feature B1').hasClass('pbl-selected')).toBe(true);
		key(tree, 'Home');
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);

		key(tree, 'ArrowRight');
		key(tree, 'Enter');
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md']);
	});

	it('a column with no cards is still a stop', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl, view } = board(vault);
		const tree = treeOf(containerEl);

		// Entering lands on the empty no-state strip: a stop, not a skip.
		key(tree, 'ArrowRight');
		expect(view.selectedBoardColumn).toBe(0);
		// Sideways keeps the level: column stop to column stop; Down enters the cards.
		key(tree, 'ArrowRight');
		expect(columnByName(containerEl, 'New').hasClass('pbl-col-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(cardByTitle(containerEl, 'A').hasClass('pbl-selected')).toBe(true);
		expect(view.selectedBoardColumn).toBeNull();
		// From a card into an empty column: the column itself is what is left to hold.
		key(tree, 'ArrowRight');
		const active = columnByName(containerEl, 'Active');
		expect(active.hasClass('pbl-col-selected')).toBe(true);
		expect(view.selectedBoardColumn).toBe(2);
		// Escape releases the stop the tree does not have.
		key(tree, 'Escape');
		expect(active.hasClass('pbl-col-selected')).toBe(false);
		expect(view.selectedBoardColumn).toBeNull();
	});

	it('End and reverse entry reach the LAST card of the last column', () => {
		const vault = boardVault();
		// Two cards in the final column, so the far edge is not also the near one.
		vault.addFile('Feature B3.md', { frontmatter: { type: 'Feature', order: 30, status: 'Done' }, parentLink: 'Epic B' });
		const { containerEl } = board(vault);
		const tree = treeOf(containerEl);

		key(tree, 'End');
		expect(cardByTitle(containerEl, 'Feature B3').hasClass('pbl-selected')).toBe(true);

		key(tree, 'Escape'); // back to no selection
		key(tree, 'ArrowUp'); // reverse entry from nothing is the same far edge
		expect(cardByTitle(containerEl, 'Feature B3').hasClass('pbl-selected')).toBe(true);
	});

	it('ArrowUp from a first card rests on the column, ArrowDown returns', () => {
		const { containerEl } = board(boardVault());
		const tree = treeOf(containerEl);

		key(tree, 'ArrowRight');
		key(tree, 'ArrowUp');
		expect(columnsOf(containerEl)[0].hasClass('pbl-col-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);
	});

	it('never navigates on a modified arrow — Alt moves the card, Shift is not ours', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowRight');
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);

		// Alt+arrow moves the CARD (see test/view/boardMenu.test.ts), so the selection
		// stays put; navigating on it instead would teach exactly the wrong reflex.
		key(tree, 'ArrowRight', { altKey: true });
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);
		await flush();
		expect(vault.fm('Feature B2.md')['status']).toBe('New');

		// Shift+arrow is neither: other chords are not this handler's to swallow.
		key(tree, 'ArrowRight', { shiftKey: true });
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);
		expect(vault.writeLog).toHaveLength(1);
	});

	it('slash reaches the quick filter', () => {
		const { containerEl } = board(boardVault());

		key(treeOf(containerEl), '/');
		expect(document.activeElement?.classList.contains('pbl-filter-input')).toBe(true);
	});

	it('a held column stop survives a rerender, for assistive tech too', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl, view } = board(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowRight'); // the empty no-state strip is the first stop
		expect(view.selectedBoardColumn).toBe(0);

		// A data update rebuilds every column element; the stop must follow — the
		// class on the new element AND the active descendant, or the column stays
		// visually marked while assistive tech loses the board position.
		refresh(view, vault);
		const strip = columnsOf(containerEl)[0];
		expect(view.selectedBoardColumn).toBe(0);
		expect(strip.hasClass('pbl-col-selected')).toBe(true);
		expect(tree.hasClass('pbl-has-selection')).toBe(true);
		// The active descendant is the option-like stop in the header, never the
		// column container — a group is not a valid active item for a listbox.
		const stop = strip.querySelector<HTMLElement>('.pbl-board-col-stop');
		expect(stop?.getAttribute('role')).toBe('option');
		expect(stop?.getAttribute('aria-selected')).toBe('true');
		expect(stop?.id).not.toBe('');
		expect(tree.getAttribute('aria-activedescendant')).toBe(stop?.id);
	});

	it('losing the workflow releases the column stop with the board it belonged to', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl, view, config } = board(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowRight');
		expect(view.selectedBoardColumn).toBe(0);

		// Clearing the state property turns board mode into guidance — no columns
		// exist for a stop to rest on, and none may linger for assistive tech.
		delete config.values['stateProperty'];
		refresh(view, vault);

		expect(columnsOf(containerEl)).toHaveLength(0);
		expect(view.selectedBoardColumn).toBeNull();
		expect(tree.getAttribute('aria-activedescendant')).toBeNull();
		expect(tree.hasClass('pbl-has-selection')).toBe(false);
	});

	it('switching back to the tree releases the column stop', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl, view } = board(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowRight');
		expect(view.selectedBoardColumn).toBe(0);

		view.setProjection('tree');

		// Board state must not point at a projection no longer on screen.
		expect(view.selectedBoardColumn).toBeNull();
		expect(tree.getAttribute('aria-activedescendant')).toBeNull();
		expect(tree.hasClass('pbl-has-selection')).toBe(false);
	});
});

describe('hiding finished work on the board', () => {
	it('hides fully-done subtrees with the tree’s own predicate, columns intact', () => {
		const { containerEl } = board(boardVault(), { showCompleted: false });

		// Feature B1 is done and childless — hidden. Epic B has open work below: it stays.
		expect(cardTitles(containerEl).sort()).toEqual(['Epic A', 'Epic B', 'Feature B2']);
		const done = columnByName(containerEl, 'Done');
		expect(countOf(done)).toBe('0');
		expect(cardTitles(done)).toEqual([]);
	});

	it('the quick filter overrides hiding, as it does in the tree', () => {
		const { containerEl, view } = board(boardVault(), { showCompleted: false });

		view.setFilter('B1');
		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual(['Feature B1']);
	});
});
