// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfCountOf, shelfGroupHeaders, shelfOf, shelfTitles } from '../helpers/roadmap';
import { flush, key, makeView, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { Menu, MenuItem } from '../helpers/obsidian-mock';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';

useViewHarness();

function disclosureOf(containerEl: HTMLElement): HTMLButtonElement | null {
	return containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-disclosure');
}

/** Click a header picker and hand back the menu it opened. */
function openMenu(containerEl: HTMLElement, selector: string): Menu {
	const btn = containerEl.querySelector<HTMLButtonElement>(selector);
	if (!btn) throw new Error(`shelf control not rendered: ${selector}`);
	Menu.forget();
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
		const disclosure = disclosureOf(containerEl);
		expect(disclosure).not.toBeNull();
		expect(shelfOf(containerEl)?.contains(disclosure)).toBe(true);
		expect(toolbarOf(containerEl).contains(disclosure)).toBe(false);
		// Nothing shelf-shaped is left in the toolbar at all — the cluster that used to
		// live there is gone, not merely duplicated.
		expect(toolbarOf(containerEl).querySelector('.pbl-shelf-controls')).toBeNull();
		expect(toolbarOf(containerEl).querySelector('.pbl-shelf-toggle')).toBeNull();
	});

	it('keeps every header control out of the listbox tab order, form control or not', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		// The pane is one tab stop and the shelf sits inside it, so nothing it carries may
		// be a second one. The pickers answer that by being buttons that open a menu; the
		// search box cannot — a menu cannot be typed into — so it keeps the half of the
		// rule that is about Tab. The disclosure is the documented exception and is
		// asserted on its own below.
		for (const sel of ['.pbl-shelf-sort', '.pbl-shelf-filter', '.pbl-shelf-search-input']) {
			const el = containerEl.querySelector<HTMLElement>(sel);
			expect(el, sel).not.toBeNull();
			expect(el?.getAttribute('tabindex'), sel).toBe('-1');
		}
		expect(containerEl.querySelector('.pbl-shelf-header select')).toBeNull();
		// The one form control the header may hold, and only that one.
		expect(containerEl.querySelectorAll('.pbl-shelf-header input')).toHaveLength(1);
	});

	it('stays in the tab order when the shut shelf is the only thing in the pane', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		// Nothing placed and the shelf shut: the pane renders no card, so it is a plain
		// region rather than a one-tab-stop composite. The rule that puts the shelf's
		// controls outside the tab order is the composite's, and with no composite there
		// is nothing else to reach — a `-1` here would leave an all-shelved roadmap with
		// no keyboard way to open itself at all.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		expect(disclosureOf(containerEl)?.getAttribute('tabindex')).toBe('0');
	});

	it('keeps every header control tabbable when hiding the last type empties the pane', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl, view } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		view.setShelfHiddenTypes(new Set(['Epic']));
		// Nothing renders now — no placed card, and the shelf's only group hidden — so the
		// pane is a region and no card menu can open. The filter that produced this state
		// is the only way out of it, which makes reaching it the whole question: rescuing
		// the disclosure alone would leave a keyboard user able to shut and reopen an
		// empty shelf forever and never unhide anything.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		expect(containerEl.querySelector('.pbl-shelf-filter')?.getAttribute('tabindex')).toBe('0');
		expect(containerEl.querySelector('.pbl-shelf-sort')?.getAttribute('tabindex')).toBe('0');
		expect(disclosureOf(containerEl)?.getAttribute('tabindex')).toBe('0');
	});

	it('keeps the disclosure the focus even when opening the shelf makes the pane a composite', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl, view } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		const before = disclosureOf(containerEl);
		before?.focus();

		before?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The press rebuilt the pane and destroyed the button, so focus has to go
		// SOMEWHERE. The two pickers hand it to the pane here, because they are
		// `tabindex="-1"` inside a composite; the disclosure is a real tab stop in both
		// states, so it keeps its own focus — and with the card menu no longer carrying
		// this toggle, a hand-off to the pane would leave a keyboard user a Shift+Tab away
		// from the only control that shuts the shelf again.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		const after = disclosureOf(containerEl);
		expect(after).not.toBe(before);
		expect(document.activeElement).toBe(after);
		// The consequence, not just the mechanism: the toggle works twice running, without
		// a pointer and without Tabbing back.
		after?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.shelfCollapsed).toBe(true);
		expect(document.activeElement).toBe(disclosureOf(containerEl));
	});

	it('gives the control the focus when nothing is left to arrow through', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault);
		const before = disclosureOf(containerEl);
		before?.focus();

		before?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Shutting the only content leaves a plain region: no composite owns the
		// keyboard, so the control that did this is the one thing to be on — and it is
		// the only way back. Dropping to the body strands a keyboard user here.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		const after = disclosureOf(containerEl);
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

	it('keeps the disclosure a tab stop even where the pane is a composite', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		// Two placed epics still render, so the pane IS a composite and everything else it
		// carries leaves the tab order. The disclosure does not: the card menu stopped
		// carrying this toggle on 2026-08-15, and a collapsed shelf draws no card of its
		// own to open a menu from, so a `-1` here is a shelf no keyboard can reopen.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		expect(disclosureOf(containerEl)?.getAttribute('tabindex')).toBe('0');
	});

	it('takes the pickers out of the tab order wherever the pane is a composite', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		for (const sel of ['.pbl-shelf-sort', '.pbl-shelf-filter']) {
			expect(containerEl.querySelector(sel)?.getAttribute('tabindex'), sel).toBe('-1');
		}
	});

	it('marks the disclosure accessibly, and flips it when clicked', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		expect(disclosureOf(containerEl)?.getAttribute('aria-expanded')).toBe('false');
		expect(disclosureOf(containerEl)?.getAttribute('aria-label')).toContain('Expand');

		// A real click, not a direct setShelfCollapsed call: this is what exercises the
		// disclosure's own listener, so a dropped or miswired one fails here rather than
		// passing every test that bypasses it.
		disclosureOf(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(disclosureOf(containerEl)?.getAttribute('aria-expanded')).toBe('true');
		expect(disclosureOf(containerEl)?.getAttribute('aria-label')).toContain('Collapse');
	});

	it('shows the shelf\'s true total on the disclosure', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(shelfCountOf(containerEl)).toBe('1');
	});

	it('offers a bare label and no disclosure when the shelf is empty', () => {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault);
		// The empty shelf still renders — a drag needs somewhere to land — but there is
		// nothing to disclose, so it carries the label alone.
		expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-name')?.textContent).toBe('Unplaced');
		expect(disclosureOf(containerEl)).toBeNull();
	});

	it('withholds the sort and filter pickers while the shelf is shut', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		expect(containerEl.querySelector('.pbl-shelf-sort')).toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-filter')).toBeNull();

		view.setShelfCollapsed(false);
		expect(containerEl.querySelector('.pbl-shelf-sort')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-filter')).not.toBeNull();
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
		expect(menu.items.map((i) => i.titleText)).toEqual(['Show all types', 'Hide all types', 'Epic (1)', 'Task (1)']);
		expect(menu.items.filter((i) => i.checked).map((i) => i.titleText)).toEqual(['Epic (1)', 'Task (1)']);

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
		expect(menu.items.map((i) => i.titleText)).toEqual(['Show all types', 'Hide all types', 'Epic (1)', 'Task (1)']);
		expect(itemNamed(menu, 'Task (1)').checked).toBe(false);

		itemNamed(menu, 'Task (1)').click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('offers no shelf section at all while the shelf is shut', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });

		Menu.forget();
		cardByTitle(containerEl, 'Now item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('no card menu opened');

		// Nothing to order or narrow while the cards are shut away — the header withholds
		// the same two pickers for the same reason, and an entry that visibly does nothing
		// is worse than none. The toggle that WOULD open it is deliberately not here
		// either: the disclosure is its keyboard path, and it is a real tab stop for that.
		const titles = menu.items.map((i) => i.titleText);
		expect(titles).not.toContain('Sort the shelf');
		expect(titles).not.toContain('Filter the shelf by type');
		expect(titles.filter((t) => t.includes('the shelf'))).toEqual([]);
		expect(disclosureOf(containerEl)?.getAttribute('tabindex')).toBe('0');
	});

	it('offers the same sort and filter choices to the keyboard as to the pointer', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);

		Menu.forget();
		cardByTitle(containerEl, 'Now item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('no card menu opened');

		// One builder feeds both surfaces, so the menu's entries are the header's own —
		// a second builder is what would let the two drift apart about what is offered.
		const sortEntries = itemNamed(menu, 'Sort the shelf').submenu?.items ?? [];
		expect(sortEntries.map((i) => i.titleText)).toEqual(headerMenuTitles(containerEl, '.pbl-shelf-sort'));
		const typeEntries = itemNamed(menu, 'Filter the shelf by type').submenu?.items ?? [];
		expect(typeEntries.map((i) => i.titleText)).toEqual(headerMenuTitles(containerEl, '.pbl-shelf-filter'));

		itemNamed(itemNamed(menu, 'Filter the shelf by type').submenu!, 'Task (1)').click();
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
		disclosureOf(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]')).toBe(modeBtn);
	});
});

describe('the shelf, collapsed by default', () => {
	it('renders nothing inside the tree until expanded, but stays a drop target', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		expect(shelfTitles(containerEl)).toEqual([]);
		expect(shelfOf(containerEl)).not.toBeNull();

		view.setShelfCollapsed(false);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
	});

	it('keeps a visible label on the collapsed drop target — a user mid-drag is looking at it, not the toolbar', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const shelf = shelfOf(containerEl);
		expect(shelf?.querySelector('.pbl-shelf-name')?.textContent).toBe('Unplaced');
	});

	it('groups the expanded shelf by type, in a fixed order', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('hides a whole type group via the type filter, while the shelf count stays the true total', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfCountOf(containerEl)).toBe('2');

		view.setShelfHiddenTypes(new Set(['Task']));
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
		// Both shelved items still count — the filter only changes what is displayed.
		expect(shelfCountOf(containerEl)).toBe('2');
	});

	it('excludes collapsed shelf cards from Arrow/End keyboard navigation', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const tree = containerEl.querySelector<HTMLElement>('.pbl-tree');
		expect(tree?.getAttribute('role')).toBe('listbox'); // Now/Later buckets still have cards
		expect(view.selectedPath).toBeNull();

		key(tree as HTMLElement, 'End');
		// The shelf's one card ("Untriaged") is collapsed and must never be reachable —
		// the walk lands on the last AXIS card instead.
		expect(view.selectedPath).toBe('Later item.md');
		expect(view.selectedPath).not.toBe('Untriaged.md');
	});

	it('renders no advisory when everything is shelved and collapsed', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
		// The design's own requirement, not just "no advisory": a pane with nothing
		// keyboard-reachable must not keep announcing itself as a listbox with options.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
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
		// The Base returns only the feature; the Epic surfaces purely as context, the
		// same shape the domain fixture's own excluded-path filter sets up. Focus is
		// working position, not a base setting: set through the view.
		const { view, containerEl } = makeView(
			vault,
			{ horizonProperty: 'note.horizon' },
			{ collapsed: true, except: ['Epic.md'], focus: 'Epic' },
		);
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});
});

describe('the shelf as a drop target while collapsed', () => {
	it('still un-places a card dropped on it', async () => {
		const vault = horizonVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 5, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		// Default collapsed — confirm the premise before testing the drop.
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-collapsed')).toBe(true);

		cardDrag(cardByTitle(containerEl, 'Placed'), shelfOf(containerEl) as HTMLElement);
		await flush();

		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});
});
