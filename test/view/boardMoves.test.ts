// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { flush, key, makeView, treeOf, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';
import { cardByTitle, cardTitles, columnByName, columnsOf, countOf } from '../helpers/board';

useViewHarness();

const BOARD = { viewMode: 'board', stateProperty: 'note.status', stateValues: 'New, Active, Done' };

function boardVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

function board(vault: FakeVault, extra: Record<string, unknown> = {}) {
	return makeView(vault, { ...BOARD, ...extra }, { collapsed: true });
}

describe('dragging a card to a new state', () => {
	it('dropping on a column writes that state’s canonical value', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Done'));
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
		expect(done.hasClass('pbl-col-drop-over')).toBe(false);

		boardDrag(card, done);
		// The gesture ended; the highlight must not survive it.
		expect(done.hasClass('pbl-col-drop-over')).toBe(false);
	});

	it('dropping on the no-state column removes the key, and undo puts it back', async () => {
		const vault = boardVault();
		const { containerEl } = board(vault);

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'No state'));
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
		boardDrag(cardByTitle(containerEl, 'Epic B'), columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.fm('Epic B.md')['status']).toBe('Done');
		expect(vault.writeLog).toHaveLength(1);

		// Same column, case-insensitively: Epic A's "New" is the New column.
		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'New'));
		await flush();
		expect(vault.writeLog).toHaveLength(1);

		// The slot still holds the first move, not the no-op.
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Epic B.md')['status']).toBe('Active');
	});

	it('config problems block a board move, exactly as every other write', async () => {
		const vault = boardVault();
		// Parent and order share a key: the gate must refuse everything.
		const { containerEl } = board(vault, { orderProperty: 'note.parent' });

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Done'));
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

	it('ArrowUp from a first card rests on the column, ArrowDown returns', () => {
		const { containerEl } = board(boardVault());
		const tree = treeOf(containerEl);

		key(tree, 'ArrowRight');
		key(tree, 'ArrowUp');
		expect(columnsOf(containerEl)[0].hasClass('pbl-col-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(cardByTitle(containerEl, 'Feature B2').hasClass('pbl-selected')).toBe(true);
	});

	it('slash reaches the quick filter', () => {
		const { containerEl } = board(boardVault());

		key(treeOf(containerEl), '/');
		expect(document.activeElement?.classList.contains('pbl-filter-input')).toBe(true);
	});
});

describe('the quick filter on the board', () => {
	it('narrows the cards, keeps every column, and clears back exactly', () => {
		const { containerEl, view } = board(boardVault());

		view.setFilter('Epic A');
		expect(cardTitles(containerEl)).toEqual(['Epic A']);
		// Columns are the shape of the board; matches are its contents.
		expect(columnsOf(containerEl)).toHaveLength(4);
		expect(countOf(columnByName(containerEl, 'Active'))).toBe('0');

		view.setFilter('');
		expect(cardTitles(containerEl)).toHaveLength(4);
	});

	it('keeps a card whose ancestor or descendant matches — the tree’s match path', () => {
		const { containerEl, view } = board(boardVault());

		// "B1" matches Feature B1; Epic B stays as its ancestor.
		view.setFilter('B1');
		expect(cardTitles(containerEl).sort()).toEqual(['Epic B', 'Feature B1']);
	});

	it('dragging stays enabled while filtering — a state write reads no siblings', async () => {
		const vault = boardVault();
		const { containerEl, view } = board(vault);

		view.setFilter('Epic A');
		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Active'));
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('Active');
	});

	it('carries over a projection switch instead of clearing', () => {
		const vault = boardVault();
		const treeSide = makeView(vault, { stateProperty: 'note.status', stateValues: 'New, Active, Done' });
		treeSide.view.setFilter('Epic A');

		// The toggle persists the mode; Bases hands the view a refresh.
		treeSide.config.values['viewMode'] = 'board';
		treeSide.view.onDataUpdated();

		expect(cardTitles(treeSide.containerEl)).toEqual(['Epic A']);
		const input = treeSide.containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		expect(input?.value).toBe('Epic A');
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
