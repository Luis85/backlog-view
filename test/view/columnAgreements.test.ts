// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';
import { flush, key, refresh, treeOf, useViewHarness } from '../helpers/view';
import { boardVault, cardByTitle, columnByName, columnNames, makeBoard } from '../helpers/board';

useViewHarness();

/** The board's workflow with a policy written on one column. */
const POLICY = {
	stateProperty: 'note.status',
	stateValues: 'New, Active, Done',
	'columnPolicy.active': 'Someone is actually on it',
};

/** A column's header element, which is where every agreement is drawn. */
function headerOf(containerEl: HTMLElement, name: string): HTMLElement {
	const header = columnByName(containerEl, name).querySelector<HTMLElement>('.pbl-board-col-header');
	if (!header) throw new Error(`no header for column: ${name}`);
	return header;
}

describe('a column carries its policy', () => {
	it('shows an affordance and describes the column with the policy', () => {
		const { containerEl } = makeBoard(boardVault(), POLICY);
		const header = headerOf(containerEl, 'Active');
		expect(header.querySelector('.pbl-board-col-policy')).not.toBeNull();
		const describedBy = header.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(containerEl.querySelector(`#${describedBy ?? ''}`)?.textContent).toBe('Someone is actually on it');
		// Described, not NAMED: the policy says what the column is for, and folding it
		// into the accessible name would make speech input target a column by a
		// paragraph. The label is exactly what it was before the policy existed.
		expect(columnByName(containerEl, 'Active').getAttribute('aria-label')).toBe('Active, 1 card');
	});

	it('leaves a column with no policy completely unchanged', () => {
		// Extension 1a: no empty affordances, and nothing suggesting a feature the user
		// has not asked for.
		const header = headerOf(makeBoard(boardVault(), POLICY).containerEl, 'New');
		expect(header.querySelector('.pbl-board-col-policy')).toBeNull();
		expect(header.hasAttribute('aria-describedby')).toBe(false);
	});

	it('opens the policy from the header context menu, under the fold every column has', () => {
		const { containerEl } = makeBoard(boardVault(), POLICY);
		headerOf(containerEl, 'Active').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Collapse Active', 'Someone is actually on it']);
	});

	it('offers the fold alone on a column with no policy', () => {
		// This menu used to be withheld entirely here, and that was right while the policy
		// was all it held. The fold is an action every column has, so the menu is now
		// unconditional — and it is the KEYBOARD path to the fold, since the header's own
		// disclosure is a `tabindex="-1"` button like every other per-row control.
		const { containerEl } = makeBoard(boardVault(), POLICY);
		headerOf(containerEl, 'New').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Collapse New']);
	});
});

describe('the keyboard reaches the column menu', () => {
	it('opens the policy from the selected column stop', () => {
		// The board is one tab stop by design, so a per-column control would multiply
		// stops by columns (extension 3a). The menu is the keyboard path instead.
		const { containerEl, view } = makeBoard(boardVault(), POLICY);
		view.selectBoardColumn(columnNames(containerEl).indexOf('Active'));
		const evt = key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Collapse Active', 'Someone is actually on it']);
		expect(evt.defaultPrevented).toBe(true);
	});

	it('folds the column from the stop, which is the fold’s whole keyboard path', () => {
		// The board is one tab stop, so the header disclosure is `tabindex="-1"` and Tab
		// never reaches it. Without this entry the fold would be pointer-only.
		const { containerEl, view } = makeBoard(boardVault(), POLICY);
		view.selectBoardColumn(columnNames(containerEl).indexOf('Active'));
		key(treeOf(containerEl), 'ContextMenu');
		Menu.lastShown?.item('Collapse Active')?.click();
		expect(columnByName(containerEl, 'Active').classList.contains('pbl-board-collapsed')).toBe(true);
		// And the entry names the way back, off the same builder rather than a second
		// reading of the state.
		headerOf(containerEl, 'Active').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Expand Active', 'Someone is actually on it']);
	});

	it('still leaves the key alone when the stop names no column at all', () => {
		// The keyboard path used to consume the event unconditionally, so ContextMenu on a
		// column with nothing agreed was a dead end — no menu of ours and none of
		// Obsidian's. Every column has a fold now, so the surviving case is an index past
		// the end; the claim is the same one, twice: nothing opens, nothing was swallowed.
		const { containerEl, view } = makeBoard(boardVault(), POLICY);
		view.selectBoardColumn(columnNames(containerEl).length);
		const evt = key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown).toBeNull();
		expect(evt.defaultPrevented).toBe(false);
	});

	it('still opens the CARD menu when a card is selected, not the column one', () => {
		// The two menus share a key. A branch that read the column first would take the
		// card's menu away on every board, and no test above would notice.
		const { containerEl } = makeBoard(boardVault(), POLICY);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown?.item('Set state')).toBeDefined();
	});
});

describe('a WIP limit never refuses a write', () => {
	/** Active is limited to one and already holds two — every move below overfills it. */
	const OVERFULL = { stateProperty: 'note.status', stateValues: 'New, Active, Done', 'wipLimit.active': '1' };

	function overfullVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
		vault.addFile('C.md', { frontmatter: { type: 'Epic', order: 30, status: 'Active' } });
		return vault;
	}

	it('applies a drop into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		cardDrag(cardByTitle(containerEl, 'A'), columnByName(containerEl, 'Active'));
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('applies an Alt+arrow move into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		// "A" is in New, which is column 1; one to the right is Active.
		cardByTitle(containerEl, 'A').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('applies a menu Set state into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		cardByTitle(containerEl, 'A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Active')?.click();
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('says the column is over afterwards, rather than having stopped the move', async () => {
		// The guarantee is not "nothing happens" but "the move happens and the board
		// says so", so this has to survive a write rather than assert on a fresh render.
		// Asserting the signal on an untouched board would restate the header test in
		// `test/view/board.test.ts` and prove nothing about a move at all.
		//
		// Nothing re-renders on its own in this harness (see `test/CLAUDE.md`), so the
		// refresh is what makes "afterwards" mean anything.
		const vault = overfullVault();
		const { containerEl, view } = makeBoard(vault, OVERFULL);
		cardDrag(cardByTitle(containerEl, 'A'), columnByName(containerEl, 'Active'));
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
		refresh(view, vault);
		expect(headerOf(containerEl, 'Active').classList.contains('pbl-board-col-over')).toBe(true);
	});
});
