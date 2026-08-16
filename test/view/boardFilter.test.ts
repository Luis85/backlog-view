// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
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

/** The card's own context menu, which is the keyboard path to those same links. */
function cardMenu(containerEl: HTMLElement, title: string): Menu {
	cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no menu shown for card: ${title}`);
	return menu;
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
		cardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Active'));
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
		const { containerEl, view } = board(deepVault(), {}, { focus: 'Epic' });

		view.setFilter('Log');

		// Focused on Epic, the only card is the epic — the two matching PBIs have no
		// card of their own, so a rollup number alone would leave the search's own
		// result found, counted and impossible to get to.
		expect(cardTitles(containerEl)).toEqual(['Epic A']);
		expect(matchesOn(containerEl, 'Epic A').sort()).toEqual(['PBI Login', 'PBI Logout']);
	});

	it('opens the match rather than the card it hangs under', () => {
		const vault = deepVault();
		const { containerEl, view } = board(vault, {}, { focus: 'Epic' });
		view.setFilter('Login');

		const link = containerEl.querySelector<HTMLElement>('.pbl-card-match');
		link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The card's own click handler must not also fire and open the epic — the one
		// note the user demonstrably did not click.
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('says nothing when nothing below it matched', () => {
		const { containerEl, view } = board(deepVault(), {}, { focus: 'Epic' });

		// The card is the only result here, so there is nothing to name.
		view.setFilter('Epic A');
		expect(matchesOn(containerEl, 'Epic A')).toEqual([]);
	});

	it('names them even when the card matched too', () => {
		// Both the epic and a PBI below it match "Login", and the PBI has no card of its
		// own. A match below a matching card is a SECOND result, and one card cannot
		// stand for two — suppressing the link because the card matched would leave the
		// deeper one exactly as unreachable as having no link at all.
		const vault = new FakeVault();
		vault.addFile('Login epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Login epic' });
		vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
		const { containerEl, view } = board(vault, {}, { focus: 'Epic' });

		view.setFilter('Login');

		expect(matchesOn(containerEl, 'Login epic')).toEqual(['PBI Login']);
		// And the keyboard path agrees with the face, as it must.
		cardByTitle(containerEl, 'Login epic').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Open match "PBI Login"');
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
		const { containerEl } = board(deepVault(), {}, { focus: 'Epic' });
		expect(matchesOn(containerEl, 'Epic A')).toEqual([]);
	});
});

describe('reaching a hidden match without a pointer', () => {
	it('the card menu offers every match, which is the keyboard path', () => {
		const { containerEl, view } = board(deepVault(), {}, { focus: 'Epic' });
		view.setFilter('Log');

		// The links on the card face are tabindex="-1" like every other per-row control,
		// so the menu is how a keyboard reaches them — the same answer the tree gives.
		const titles = cardMenu(containerEl, 'Epic A').items.map((i) => i.titleText);
		expect(titles).toContain('Open match "PBI Login"');
		expect(titles).toContain('Open match "PBI Logout"');
	});

	it('opens the match, not the card it hangs under', () => {
		const vault = deepVault();
		const { containerEl, view } = board(vault, {}, { focus: 'Epic' });
		view.setFilter('Login');

		cardMenu(containerEl, 'Epic A').item('Open match "PBI Login"')?.click();

		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('offers nothing when no filter is running, or when the card matched itself', () => {
		const { containerEl, view } = board(deepVault(), {}, { focus: 'Epic' });
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
		const { containerEl, view } = board(vault, {}, { focus: 'Epic' });
		view.setFilter('Login');

		// A middle click never fires `click`, so the card's own auxclick handler would
		// otherwise take it and open the epic.
		const link = containerEl.querySelector<HTMLElement>('.pbl-card-match');
		link?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));

		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});
});

describe('a card names only what this projection draws beneath it', () => {
	/**
	 * `Release → Smoke case (Test case) → Release follow-up (PBI)`. The PBI is a plan
	 * member and a legitimate match, but every edge from the card down to it runs through
	 * a catalog row the Deliverables board draws nowhere. The intervening test is named so
	 * that it cannot match the needle itself — the boundary has to be the only thing in
	 * question.
	 */
	function acrossTheLadder(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Release.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Draft' } });
		vault.addFile('Smoke case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Release' });
		vault.addFile('Release follow-up.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Smoke case' });
		return vault;
	}

	/** The same three notes with a `Feature` where the test was: no boundary to cross. */
	function alongOneLadder(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Release.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Draft' } });
		vault.addFile('Plumbing.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Release' });
		vault.addFile('Release follow-up.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Plumbing' });
		return vault;
	}

	/** The Deliverables board, already narrowing. */
	function deliverables(vault: FakeVault, needle: string) {
		const harness = makeView(vault, { deliverableStateProperty: 'note.docStatus' });
		harness.view.setProjection('deliverables');
		harness.view.setFilter(needle);
		return harness;
	}

	it('withholds a match reached only through a row of the other ladder', () => {
		// The needle matches the Deliverable itself, so the card is on screen for its own
		// reason; `Release follow-up` sits two rows below it, behind a `Test case`.
		const { containerEl } = deliverables(acrossTheLadder(), 'Release');

		expect(cardTitles(containerEl)).toEqual(['Release']);
		expect(matchesOn(containerEl, 'Release')).toEqual([]);
	});

	it('says the same in the menu, since one walk feeds both surfaces', () => {
		const { containerEl } = deliverables(acrossTheLadder(), 'Release');

		const entries = cardMenu(containerEl, 'Release')
			.items.map((i) => i.titleText)
			.filter((t) => t.startsWith('Open match'));
		expect(entries).toEqual([]);
	});

	it('agrees with the index, which already refuses to keep a card for that match', () => {
		// The other half of the measured pair, and what makes the first a defect rather
		// than a preference: with only the deep PBI matching, the card does not survive at
		// all. Printing that same match under a needle the card happened to match too was
		// the face disagreeing with the index about what is beneath it.
		const { containerEl } = deliverables(acrossTheLadder(), 'follow-up');

		expect(cardTitles(containerEl)).toEqual([]);
	});

	it('still names one reached along drawn edges only', () => {
		// The direct mirror: one type changed, no boundary, and the deep-match feature
		// works — the card survives on its descendant's match, names it, and rolls it up.
		const { containerEl, view } = deliverables(alongOneLadder(), 'follow-up');

		expect(cardTitles(containerEl)).toEqual(['Release']);
		expect(matchesOn(containerEl, 'Release')).toEqual(['Release follow-up']);
		expect(view.model?.byPath.get('Release.md')?.descendantCount).toBe(2);
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
