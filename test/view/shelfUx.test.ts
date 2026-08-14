// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfCountOf, shelfGroupHeaders, shelfOf, shelfTitles } from '../helpers/roadmap';
import { flush, key, useViewHarness } from '../helpers/view';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, MenuItem } from 'obsidian';
import { ProductBacklogView } from '../../src/view/backlogView';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';

useViewHarness();

/** Click a header picker and hand back the menu it opened. */
function openMenu(containerEl: HTMLElement, selector: string): Menu {
	const btn = containerEl.querySelector<HTMLButtonElement>(selector);
	if (!btn) throw new Error(`shelf control not rendered: ${selector}`);
	Menu.lastShown = null;
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
	if (!Menu.lastShown) throw new Error(`no menu opened from ${selector}`);
	return Menu.lastShown;
}

function headerMenuTitles(containerEl: HTMLElement, selector: string): string[] {
	return openMenu(containerEl, selector).items.map((i) => i.titleText);
}

function itemNamed(menu: Menu, title: string): MenuItem {
	const item = menu.items.find((i) => i.titleText === title);
	if (!item) throw new Error(`menu entry not found: ${title}`);
	return item;
}

function toolbarOf(containerEl: HTMLElement): HTMLElement {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
}

describe('the shelf\'s own header controls', () => {
	it('live in the shelf itself, not in the view toolbar', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const sort = containerEl.querySelector<HTMLElement>('.pbl-shelf-sort');
		expect(sort).not.toBeNull();
		expect(shelfOf(containerEl)?.contains(sort)).toBe(true);
		expect(toolbarOf(containerEl).contains(sort)).toBe(false);
		// Nothing shelf-shaped is left in the toolbar at all — the cluster that used to
		// live there is gone, not merely duplicated.
		expect(toolbarOf(containerEl).querySelector('.pbl-shelf-controls')).toBeNull();
		expect(toolbarOf(containerEl).querySelector('.pbl-shelf-toggle')).toBeNull();
	});

	it('are reachable by pointer but never a second tab stop in the listbox', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		// The pane is one tab stop and the shelf sits inside it, so every control it
		// carries has to be `tabindex="-1"` — a focusable form control here would be a
		// second stop in a composite that has exactly one.
		for (const sel of ['.pbl-shelf-sort', '.pbl-shelf-filter']) {
			const btn = containerEl.querySelector<HTMLElement>(sel);
			expect(btn, sel).not.toBeNull();
			expect(btn?.getAttribute('tabindex'), sel).toBe('-1');
		}
		expect(containerEl.querySelector('.pbl-shelf-header select')).toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-header input')).toBeNull();
	});

	it('keeps every header control tabbable when hiding the last type empties the pane', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl, view } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		view.setShelfHiddenTypes(new Set(['Epic']));
		// Nothing renders now — no placed card, and the shelf's only group hidden — so the
		// pane is a region and no card menu can open. The filter that produced this state
		// is the only way out of it, which makes reaching it the whole question.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		expect(containerEl.querySelector('.pbl-shelf-filter')?.getAttribute('tabindex')).toBe('0');
		expect(containerEl.querySelector('.pbl-shelf-sort')?.getAttribute('tabindex')).toBe('0');
	});

	it('gives the control the focus when nothing is left to arrow through', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault);
		const before = containerEl.querySelector<HTMLElement>('.pbl-shelf-filter');
		before?.focus();

		// Hiding the only type empties the pane — the one way left to reach that state
		// now that the shelf cannot be shut, and the same branch the disclosure used to
		// drive: no composite owns the keyboard, so the control that did this is the one
		// thing to be on, and it is the only way back. Dropping to the body strands a
		// keyboard user here.
		itemNamed(openMenu(containerEl, '.pbl-shelf-filter'), 'Epic (1)').click();

		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		const after = containerEl.querySelector<HTMLElement>('.pbl-shelf-filter');
		expect(after).not.toBe(before);
		expect(document.activeElement).toBe(after);
	});

	it('hands focus back to the header picker whose own menu rebuilt the pane', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);

		for (const [selector, entry] of [
			['.pbl-shelf-filter', 'Task (1)'],
			['.pbl-shelf-sort', 'Title (A to Z)'],
		] as const) {
			const before = containerEl.querySelector<HTMLElement>(selector);
			before?.focus();
			itemNamed(openMenu(containerEl, selector), entry).click();

			// The pick rebuilds the pane, taking the button the menu was opened from with
			// it. This fixture keeps cards on screen, so the pane is still a composite
			// and the focus belongs to IT — the replacement control is `tabindex="-1"`
			// there, and focusing it would silence the arrows.
			expect(containerEl.querySelector<HTMLElement>(selector), selector).not.toBe(before);
			expect(document.activeElement, selector).toBe(containerEl.querySelector('.pbl-tree'));
		}
	});

	it('leaves the tab order again as soon as the pane has cards to arrow through', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {});
		// Two placed epics still render, so the pane IS a composite and its one stop is
		// the pane itself — the disclosure goes back to being reachable by arrow and by
		// assistive tech, never by Tab.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		expect(containerEl.querySelector('.pbl-shelf-sort')?.getAttribute('tabindex')).toBe('-1');
	});

	it('takes the pickers out of the tab order too, wherever the pane is a composite', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		for (const sel of ['.pbl-shelf-sort', '.pbl-shelf-filter']) {
			expect(containerEl.querySelector(sel)?.getAttribute('tabindex'), sel).toBe('-1');
		}
	});

	it('shows the shelf\'s true total in the header', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(shelfCountOf(containerEl)).toBe('1');
	});

	it('offers a bare label and no controls when the shelf is empty', () => {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault);
		// The empty shelf still renders — a drag needs somewhere to land — but a count of
		// nothing beside two pickers with nothing to pick is chrome over an absence.
		expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-name')?.textContent).toBe('Unplaced');
		expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-count')).toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-sort')).toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-filter')).toBeNull();
	});

	it('checks the sort pick the shelf is actually using, and reorders when another is chosen', () => {
		const vault = new FakeVault();
		vault.addFile('Zed Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('Ann Task.md', { frontmatter: { type: 'Task', order: 20 } });
		const { containerEl } = makeRoadmap(vault);
		expect(shelfTitles(containerEl)).toEqual(['Zed Task', 'Ann Task']);

		const menu = openMenu(containerEl, '.pbl-shelf-sort');
		expect(menu.items.map((i) => i.titleText)).toEqual(['Sibling order', 'Title (A to Z)', 'Last modified']);
		// The checkmark is asked of the pick in force, never written beside it.
		expect(menu.items.filter((i) => i.checked).map((i) => i.titleText)).toEqual(['Sibling order']);

		itemNamed(menu, 'Title (A to Z)').click();
		expect(shelfTitles(containerEl)).toEqual(['Ann Task', 'Zed Task']);
	});

	it('lists every type on the shelf, checked unless hidden, and toggles one on a pick', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);

		const menu = openMenu(containerEl, '.pbl-shelf-filter');
		expect(menu.items.map((i) => i.titleText)).toEqual(['Epic (1)', 'Task (1)']);
		expect(menu.items.every((i) => i.checked)).toBe(true);

		itemNamed(menu, 'Task (1)').click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
	});

	it('keeps a hidden type listed, so the last one hidden is never the one nobody can restore', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfHiddenTypes(new Set(['Task']));
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);

		// Built from the UNFILTERED shelf: hiding a type must not remove its own way back.
		const menu = openMenu(containerEl, '.pbl-shelf-filter');
		expect(menu.items.map((i) => i.titleText)).toEqual(['Epic (1)', 'Task (1)']);
		expect(itemNamed(menu, 'Task (1)').checked).toBe(false);

		itemNamed(menu, 'Task (1)').click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('puts its actions on the card menu, the keyboard path its tabindex="-1" owes', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault, {});
		// A composite pane, so the header's controls are correctly out of the tab order —
		// which is exactly the state that owes a keyboard path. Without this section the
		// shelf would be pointer-only here, the failure `src/view/CLAUDE.md` names for
		// the board's own hidden-match links.
		expect(containerEl.querySelector('.pbl-shelf-sort')?.getAttribute('tabindex')).toBe('-1');

		Menu.lastShown = null;
		cardByTitle(containerEl, 'Now item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('no card menu opened');

		expect(menu.items.map((i) => i.titleText)).toEqual(
			expect.arrayContaining(['Sort unplaced', 'Filter unplaced by type']),
		);
	});

	it('offers the same sort and filter choices to the keyboard as to the pointer', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);

		Menu.lastShown = null;
		cardByTitle(containerEl, 'Now item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('no card menu opened');

		// One builder feeds both surfaces, so the menu's entries are the header's own —
		// a second builder is what would let the two drift apart about what is offered.
		const sortEntries = itemNamed(menu, 'Sort unplaced').submenu?.items ?? [];
		expect(sortEntries.map((i) => i.titleText)).toEqual(headerMenuTitles(containerEl, '.pbl-shelf-sort'));
		const typeEntries = itemNamed(menu, 'Filter unplaced by type').submenu?.items ?? [];
		expect(typeEntries.map((i) => i.titleText)).toEqual(headerMenuTitles(containerEl, '.pbl-shelf-filter'));

		itemNamed(menu, 'Filter unplaced by type').submenu!.items[1].click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
	});

	it('never rebuilds the view toolbar when a shelf control changes', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);
		const modeBtn = containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]');
		expect(modeBtn).not.toBeNull();

		// A full render() would tear down and rebuild the whole toolbar, replacing this
		// element — the same DOM node before and after is the proof it did not.
		itemNamed(openMenu(containerEl, '.pbl-shelf-sort'), 'Title (A to Z)').click();
		expect(containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]')).toBe(modeBtn);
	});
});

describe('the shelf, always drawn', () => {
	it('renders its cards on the first draw, with no control to open first', () => {
		// It opened SHUT until 2026-08-14, so the band that says how much of the backlog
		// is unplanned answered that only after a click. There is no such state now.
		const { containerEl } = makeRoadmap(horizonVault());
		expect(shelfOf(containerEl)).not.toBeNull();
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
	});

	it('keeps a visible label on the drop target — a user mid-drag is looking at it, not the toolbar', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const shelf = shelfOf(containerEl);
		expect(shelf?.querySelector('.pbl-shelf-name')?.textContent).toBe('Unplaced');
	});

	it('groups the shelf by type, in a fixed order', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('hides a whole type group via the type filter, while the shelf count stays the true total', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfCountOf(containerEl)).toBe('2');

		view.setShelfHiddenTypes(new Set(['Task']));
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
		// Both shelved items still count — the filter only changes what is displayed.
		expect(shelfCountOf(containerEl)).toBe('2');
	});

	it('walks onto the shelf’s own cards, which are always drawn now', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const tree = containerEl.querySelector<HTMLElement>('.pbl-tree');
		expect(tree?.getAttribute('role')).toBe('listbox');
		expect(view.selectedPath).toBeNull();

		key(tree as HTMLElement, 'End');
		// The shelf's one card sits after the axis's, and the walk reaches it — the
		// collapsed shelf used to be excluded from this array, and there is no such
		// state to exclude any more.
		expect(view.selectedPath).toBe('Untriaged.md');
	});

	it('renders no advisory when everything is shelved, and the shelf is the content', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
		// The shelf's card IS on screen and arrow-reachable, so the pane is a composite —
		// this used to be a `region`, because a shut shelf left nothing to walk.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
	});

	it('renders no advisory when the only visible card is a context row already placed in a bucket', () => {
		// Mirrors test/domain/roadmap.test.ts's "an excluded focus-level item sits in a
		// bucket that already exists, uncounted": placedCount, shelf and context are ALL
		// zero here, yet a card IS on screen (the Epic, as a context row inside 'Now') —
		// exactly the case the axisCardCount term exists to catch, since none of
		// placedCount/shelf.length/context.length would count it.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'now' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ horizonProperty: 'note.horizon' });
		// The Base returns only the feature; the Epic surfaces purely as context, the
		// same shape the domain fixture's own vault.entries().filter(...) sets up.
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		// Focus is working position, not a base setting: set through the view.
		view.setFocusLevel('Epic');
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});
});

describe('the shelf as a drop target', () => {
	it('un-places a card dropped on it', async () => {
		const vault = horizonVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 5, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault);

		cardDrag(cardByTitle(containerEl, 'Placed'), shelfOf(containerEl) as HTMLElement);
		await flush();

		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});
});
