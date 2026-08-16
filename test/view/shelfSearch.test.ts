// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu, Modal } from 'obsidian';
import { horizonVault, makeRoadmap, shelfCountOf, shelfGroupHeaders, shelfTitles } from '../helpers/roadmap';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';

useViewHarness();

/** The shelf's search box, which the pane rebuilds under every keystroke. */
function searchBox(containerEl: HTMLElement): HTMLInputElement {
	const input = containerEl.querySelector<HTMLInputElement>('.pbl-shelf-search-input');
	if (!input) throw new Error('shelf search box not rendered');
	return input;
}

/** Type into the box the way a keyboard does: the value, then the event it fires. */
function typeSearch(containerEl: HTMLElement, text: string): void {
	const input = searchBox(containerEl);
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function openTypeMenu(containerEl: HTMLElement): Menu {
	Menu.lastShown = null;
	containerEl
		.querySelector<HTMLButtonElement>('.pbl-shelf-filter')
		?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
	if (!Menu.lastShown) throw new Error('no type menu opened');
	return Menu.lastShown;
}

function cardMenu(containerEl: HTMLElement, title: string): Menu {
	Menu.lastShown = null;
	cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	if (!Menu.lastShown) throw new Error('no card menu opened');
	return Menu.lastShown;
}

/** Three shelved epics with distinguishable titles, plus a task to group beside them. */
function searchVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Login screen.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Login audit.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Billing export.md', { frontmatter: { type: 'Epic', order: 30 } });
	vault.addFile('Login task.md', { frontmatter: { type: 'Task', order: 40 } });
	return vault;
}

describe("the shelf's own search", () => {
	it('narrows the shelf to matching titles while the count keeps the true total', () => {
		const { containerEl } = makeRoadmap(searchVault());
		expect(shelfTitles(containerEl)).toHaveLength(4);

		typeSearch(containerEl, 'login');

		// Case-insensitive, and the groups it empties go with the cards: the search is a
		// narrowing over the same grouping the type filter narrows.
		expect(shelfTitles(containerEl)).toEqual(['Login screen', 'Login audit', 'Login task']);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		// The count is the shelf's statement about the results, never about what is on
		// screen — the same rule the type filter is held to.
		expect(shelfCountOf(containerEl)).toBe('4');
	});

	it('drops a group whole when nothing in it matches', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'billing');
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
	});

	it('keeps the caret in the box across the rebuild each keystroke causes', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const before = searchBox(containerEl);
		before.focus();
		before.value = 'login';
		before.setSelectionRange(3, 3);

		before.dispatchEvent(new Event('input', { bubbles: true }));

		// The pane rebuilds under the typing and takes this very input with it, so the
		// replacement has to take the focus AND the caret: focus on the pane (what every
		// other shelf control gets) would end the search at its first keystroke, and a
		// caret reset to the end would scramble any edit made mid-word.
		const after = searchBox(containerEl);
		expect(after).not.toBe(before);
		expect(document.activeElement).toBe(after);
		expect(after.value).toBe('login');
		expect(after.selectionStart).toBe(3);
	});

	it('waits for an IME to finish composing before it rebuilds the pane', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const input = searchBox(containerEl);
		input.value = 'bil';

		// A composing keystroke: narrowing here would destroy the field being composed
		// into and commit a half-typed word.
		input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
		expect(shelfTitles(containerEl)).toHaveLength(4);
		expect(searchBox(containerEl)).toBe(input);

		input.value = 'billing';
		input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
	});

	it('clears on Escape and puts every card back', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'billing');
		expect(shelfTitles(containerEl)).toHaveLength(1);

		searchBox(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(searchBox(containerEl).value).toBe('');
		expect(shelfTitles(containerEl)).toHaveLength(4);
	});

	it('goes back into the tab order when the search itself empties the pane', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		typeSearch(containerEl, 'nothing matches this');

		// Nothing is left to arrow through, so the composite is gone — and the control
		// that caused it is the only way back, exactly as a filter hiding the last type is.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		expect(searchBox(containerEl).getAttribute('tabindex')).toBe('0');
		expect(containerEl.querySelector('.pbl-shelf-filter')?.getAttribute('tabindex')).toBe('0');
	});

	it('is offered to the keyboard through the card menu, with a clear only while it runs', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		const titles = () => cardMenu(containerEl, 'Login screen').items.map((i) => i.titleText);
		// The box is `tabindex="-1"` inside the composite, so the menu is its keyboard path.
		expect(titles()).toContain('Search unplaced...');
		// Nothing to clear yet: an entry that would write nothing is not offered.
		expect(titles()).not.toContain('Clear unplaced search');

		view.setShelfSearch('login');
		expect(titles()).toContain('Clear unplaced search');
	});

	it('narrows from the prompt that menu entry opens', () => {
		const { containerEl } = makeRoadmap(searchVault());
		cardMenu(containerEl, 'Login screen').items.find((i) => i.titleText === 'Search unplaced...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('search prompt not opened');
		const input = modal.contentEl.querySelector('input');
		const submit = modal.contentEl.querySelector('button');
		if (!input || !submit) throw new Error('search prompt incomplete');

		input.value = 'billing';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The pointer's live box and the keyboard's prompt are one narrowing: the box
		// comes back carrying what the prompt submitted.
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
		expect(searchBox(containerEl).value).toBe('billing');
	});

	it('clears from that menu entry', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'login');
		expect(shelfTitles(containerEl)).toHaveLength(3);

		cardMenu(containerEl, 'Login screen').items.find((i) => i.titleText === 'Clear unplaced search')?.click();

		expect(shelfTitles(containerEl)).toHaveLength(4);
	});
});

describe("the shelf's type picker", () => {
	it('comes straight back open after a pick, showing the state that pick produced', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const first = openTypeMenu(containerEl);

		Menu.lastShown = null;
		first.items.find((i) => i.titleText === 'Task (1)')?.click();

		// A pick rebuilds the pane and Obsidian's menu closes itself, so "stays open" is a
		// fresh menu at the same control — carrying the checkmark the pick just wrote.
		const second = Menu.lastShown;
		expect(second).not.toBeNull();
		expect(second).not.toBe(first);
		expect(second?.items.find((i) => i.titleText === 'Task (1)')?.checked).toBe(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
	});

	it('hides every type at once, and shows every one back', () => {
		const { containerEl } = makeRoadmap(searchVault());

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Hide all types')?.click();
		expect(shelfGroupHeaders(containerEl)).toEqual([]);
		// The count is untouched by any of this — the shelf still holds four cards.
		expect(shelfCountOf(containerEl)).toBe('4');

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Show all types')?.click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('leaves a remembered type hidden when hiding all', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		// A type hidden while its last card was shelved stays in the store, unused until
		// one comes back — nothing on this shelf is a Bug.
		view.setShelfHiddenTypes(new Set(['Bug']));

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Hide all types')?.click();

		// Everything on screen is hidden AND the remembered one still is: a set rebuilt
		// from the groups in front of us would silently un-hide it, and nobody would find
		// out until the day a Bug was shelved again.
		expect(view.shelfHiddenTypes.has('Bug')).toBe(true);
		expect(shelfGroupHeaders(containerEl)).toEqual([]);
	});

	it('withholds each bulk entry exactly where it would change nothing', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		const entry = (title: string) => openTypeMenu(containerEl).items.find((i) => i.titleText === title);
		// Nothing hidden: there is nothing to show back.
		expect(entry('Show all types')?.disabled).toBe(true);
		expect(entry('Hide all types')?.disabled).toBe(false);

		view.setShelfHiddenTypes(new Set(['Epic', 'Task']));
		expect(entry('Show all types')?.disabled).toBe(false);
		expect(entry('Hide all types')?.disabled).toBe(true);
	});

	it('offers the same bulk entries to the keyboard as to the pointer', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const submenu = cardMenu(containerEl, 'Now item').items.find((i) => i.titleText === 'Filter unplaced by type')
			?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(
			openTypeMenu(containerEl).items.map((i) => i.titleText),
		);
	});
});
