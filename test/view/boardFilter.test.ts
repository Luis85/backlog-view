// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';
import {
	BOARD_WORKFLOW,
	boardVault,
	cardByTitle,
	cardTitles,
	columnByName,
	columnsOf,
	countOf,
	makeBoard as board,
} from '../helpers/board';

useViewHarness();

/** The match links a card names on its face while the filter is narrowing. */
function matchesOn(containerEl: HTMLElement, title: string): string[] {
	return Array.from(cardByTitle(containerEl, title).querySelectorAll<HTMLElement>('.pbl-card-match')).map(
		(el) => el.textContent ?? '',
	);
}

/** An epic whose matching work sits two levels down, below the focus line. */
function deepVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
	vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
	vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
	vault.addFile('PBI Logout.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Feature A1' });
	return vault;
}

describe('the quick filter on the board', () => {
	it('narrows the cards, keeps every column, and clears back exactly', () => {
		const { containerEl, view } = board(boardVault());

		view.setFilter('Epic A');
		expect(cardTitles(containerEl)).toEqual(['Epic A']);
		// Columns are the shape of the board; matches are its contents.
		expect(columnsOf(containerEl)).toHaveLength(4);

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
		const treeSide = makeView(vault, { ...BOARD_WORKFLOW });
		treeSide.view.setFilter('Epic A');

		// The toggle switches in place — the filter is session state in both projections.
		treeSide.view.setProjection('board');

		expect(cardTitles(treeSide.containerEl)).toEqual(['Epic A']);
		const input = treeSide.containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		expect(input?.value).toBe('Epic A');
	});
});

describe('what a filtered column header counts', () => {
	it('shows the matches against the full population', () => {
		const { containerEl, view } = board(boardVault());

		expect(countOf(columnByName(containerEl, 'Active'))).toBe('1');
		view.setFilter('Epic A');

		// Epic B is Active and does not match: the stage still holds one card, and a
		// header reading "0" would say the column had emptied.
		expect(countOf(columnByName(containerEl, 'Active'))).toBe('0 of 1');
		expect(countOf(columnByName(containerEl, 'New'))).toBe('1 of 1');
	});

	it('says the pair to assistive technology too', () => {
		const { containerEl, view } = board(boardVault());

		view.setFilter('Epic A');

		const active = columnByName(containerEl, 'Active');
		expect(active.getAttribute('aria-label')).toBe('Active, 0 of 1 cards match');
		// And back to the plain count when the filter clears.
		view.setFilter('');
		expect(columnByName(containerEl, 'Active').getAttribute('aria-label')).toBe('Active, 1 card');
	});

	it('measures against what the filter is choosing among, not the cleared board', () => {
		// Finished work is hidden — until a filter runs, which suspends that hiding so a
		// match stays findable. Feature B1 is therefore in the Done column AND in the
		// population it is counted against. Measuring against the cleared board would
		// report "1 of 0": each number defensible alone, the pair nonsense.
		const { containerEl, view } = board(boardVault(), { showCompleted: false });
		expect(countOf(columnByName(containerEl, 'Done'))).toBe('0');

		view.setFilter('Epic');
		expect(countOf(columnByName(containerEl, 'Done'))).toBe('1 of 1');
	});
});

describe('a card kept only by a match below it', () => {
	it('names the matches on its face, each opening its own note', () => {
		const { containerEl, view } = board(deepVault(), { focusLevel: 'Epic' });

		view.setFilter('Log');

		// Focused on Epic, the only card is the epic — the two matching PBIs have no
		// card of their own, so a rollup number alone would leave the search's own
		// result found, counted and impossible to get to.
		expect(cardTitles(containerEl)).toEqual(['Epic A']);
		expect(matchesOn(containerEl, 'Epic A').sort()).toEqual(['PBI Login', 'PBI Logout']);
	});

	it('opens the match rather than the card it hangs under', () => {
		const vault = deepVault();
		const { containerEl, view } = board(vault, { focusLevel: 'Epic' });
		view.setFilter('Login');

		const link = containerEl.querySelector<HTMLElement>('.pbl-card-match');
		link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The card's own click handler must not also fire and open the epic — the one
		// note the user demonstrably did not click.
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('says nothing on a card that matched itself', () => {
		const { containerEl, view } = board(deepVault(), { focusLevel: 'Epic' });

		// The card IS the result; listing its children under it would bury it.
		view.setFilter('Epic A');
		expect(matchesOn(containerEl, 'Epic A')).toEqual([]);
	});

	it('leaves a match that has a card of its own to that card', () => {
		const { containerEl, view } = board(boardVault());

		// Unfocused, every result is a card: Feature B1 is on screen in the Done
		// column, so naming it on Epic B as well would count one match twice.
		view.setFilter('B1');
		expect(cardTitles(containerEl).sort()).toEqual(['Epic B', 'Feature B1']);
		expect(matchesOn(containerEl, 'Epic B')).toEqual([]);
	});

	it('names nothing at all when no filter is running', () => {
		const { containerEl } = board(deepVault(), { focusLevel: 'Epic' });
		expect(matchesOn(containerEl, 'Epic A')).toEqual([]);
	});
});

describe('reaching a hidden match without a pointer', () => {
	function cardMenu(containerEl: HTMLElement, title: string): Menu {
		cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error(`no menu shown for card: ${title}`);
		return menu;
	}

	it('the card menu offers every match, which is the keyboard path', () => {
		const { containerEl, view } = board(deepVault(), { focusLevel: 'Epic' });
		view.setFilter('Log');

		// The links on the card face are tabindex="-1" like every other per-row control,
		// so the menu is how a keyboard reaches them — the same answer the tree gives.
		const titles = cardMenu(containerEl, 'Epic A').items.map((i) => i.titleText);
		expect(titles).toContain('Open match "PBI Login"');
		expect(titles).toContain('Open match "PBI Logout"');
	});

	it('opens the match, not the card it hangs under', () => {
		const vault = deepVault();
		const { containerEl, view } = board(vault, { focusLevel: 'Epic' });
		view.setFilter('Login');

		cardMenu(containerEl, 'Epic A').item('Open match "PBI Login"')?.click();

		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('offers nothing when no filter is running, or when the card matched itself', () => {
		const { containerEl, view } = board(deepVault(), { focusLevel: 'Epic' });
		const matchEntries = (): string[] =>
			cardMenu(containerEl, 'Epic A')
				.items.map((i) => i.titleText)
				.filter((t) => t.startsWith('Open match'));

		expect(matchEntries()).toEqual([]);
		view.setFilter('Epic A');
		expect(matchEntries()).toEqual([]);
	});

	it('a middle click on a match opens the match in a new tab, not the parent', () => {
		const vault = deepVault();
		const { containerEl, view } = board(vault, { focusLevel: 'Epic' });
		view.setFilter('Login');

		// A middle click never fires `click`, so the card's own auxclick handler would
		// otherwise take it and open the epic.
		const link = containerEl.querySelector<HTMLElement>('.pbl-card-match');
		link?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));

		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});
});

describe('the no-state column while filtering', () => {
	it('keeps its header and its pair when the filter matches none of its cards', () => {
		// Feature B2 has no state. Filtering to "Epic A" matches none of the stateless
		// cards, but the stage still holds one: collapsing it to a drop strip would say
		// the work is gone, which is a stronger lie than the "0" the pair prevents.
		const { containerEl, view } = board(boardVault());
		view.setFilter('Epic A');

		const noState = columnByName(containerEl, 'No state');
		expect(noState.hasClass('pbl-board-strip')).toBe(false);
		expect(countOf(noState)).toBe('0 of 1');
	});

	it('still shrinks to a strip when there are no stateless cards at all', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl, view } = board(vault);

		expect(columnsOf(containerEl)[0].hasClass('pbl-board-strip')).toBe(true);
		// And a filter that matches nothing does not conjure a column back.
		view.setFilter('Epic A');
		expect(columnsOf(containerEl)[0].hasClass('pbl-board-strip')).toBe(true);
	});
});
