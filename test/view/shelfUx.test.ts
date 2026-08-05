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

function disclosureOf(containerEl: HTMLElement): HTMLButtonElement | null {
	return containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-disclosure');
}

/** Click a header picker and hand back the menu it opened. */
function openMenu(containerEl: HTMLElement, selector: string): Menu {
	const btn = containerEl.querySelector<HTMLButtonElement>(selector);
	if (!btn) throw new Error(`shelf control not rendered: ${selector}`);
	Menu.lastShown = null;
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
	if (!Menu.lastShown) throw new Error(`no menu opened from ${selector}`);
	return Menu.lastShown;
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

	it('are reachable by pointer but never a second tab stop in the listbox', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		// The pane is one tab stop and the shelf sits inside it, so every control it
		// carries has to be `tabindex="-1"` — a focusable form control here would be a
		// second stop in a composite that has exactly one.
		for (const sel of ['.pbl-shelf-disclosure', '.pbl-shelf-sort', '.pbl-shelf-filter']) {
			const btn = containerEl.querySelector<HTMLElement>(sel);
			expect(btn, sel).not.toBeNull();
			expect(btn?.getAttribute('tabindex'), sel).toBe('-1');
		}
		expect(containerEl.querySelector('.pbl-shelf-header select')).toBeNull();
		expect(containerEl.querySelector('.pbl-shelf-header input')).toBeNull();
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
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ horizonProperty: 'note.horizon', focusLevel: 'Epic' });
		// The Base returns only the feature; the Epic surfaces purely as context, the
		// same shape the domain fixture's own vault.entries().filter(...) sets up.
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
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
