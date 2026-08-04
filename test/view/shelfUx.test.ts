// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfCountOf, shelfGroupHeaders, shelfOf, shelfTitles } from '../helpers/roadmap';
import { flush, key, useViewHarness } from '../helpers/view';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { syncShelfControls } from '../../src/view/render/shelfControls';
import { ProductBacklogView } from '../../src/view/backlogView';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';

useViewHarness();

function shelfControlsOf(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-shelf-controls');
}

function toolbarOf(containerEl: HTMLElement): HTMLElement {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
}

describe('the shelf toolbar controls', () => {
	it('exist in the toolbar, not inside the roadmap listbox, on the very first render', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const controls = shelfControlsOf(containerEl);
		expect(controls).not.toBeNull();
		expect(containerEl.querySelector('.pbl-toolbar')?.contains(controls)).toBe(true);
		expect(containerEl.querySelector('[role="listbox"]')?.contains(controls)).toBe(false);
	});

	it('renders nothing in the toolbar outside roadmap mode', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		expect(shelfControlsOf(containerEl)).toBeNull();
	});

	it('hides the cluster once a filter empties the shelf, without a full toolbar rebuild', () => {
		const vault = horizonVault();
		const { containerEl, view } = makeRoadmap(vault);
		expect(shelfControlsOf(containerEl)).not.toBeNull();
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);

		// "Untriaged" is the shelf's only card; filter it out entirely.
		view.setFilter('nonexistent-search-term');
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(true);

		view.setFilter('');
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);
	});

	it('shows the real shelf count once content has rendered', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(shelfCountOf(containerEl)).toBe('1');
	});

	it('marks the collapse toggle accessibly, and flips it when toggled', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const collapseBtn = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Expand');

		// A real click, not a direct setShelfCollapsed call: this is the one test that
		// exercises renderShelfControls' own click listener, so a dropped or miswired
		// listener fails here rather than passing every test that bypasses it.
		collapseBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Collapse');
	});

	it('never rebuilds the rest of the toolbar when a shelf control changes', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);
		const modeBtn = containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]');
		expect(modeBtn).not.toBeNull();

		// A full render() would tear down and rebuild the whole toolbar, replacing
		// this element — the same DOM node before and after is the proof it didn't.
		// Real gestures on all three controls, not direct setter calls: the same
		// listeners exercised above and below, driven together here.
		containerEl
			.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const sortSelect = containerEl.querySelector<HTMLSelectElement>('.pbl-shelf-sort');
		if (sortSelect) sortSelect.value = 'title';
		sortSelect?.dispatchEvent(new Event('change', { bubbles: true }));
		const taskCheckbox = containerEl.querySelector<HTMLInputElement>(
			'.pbl-shelf-type-chip[data-shelf-type="Task"] input',
		);
		if (taskCheckbox) taskCheckbox.checked = false;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]')).toBe(modeBtn);
	});

	it('keeps focus on the type-filter checkbox that was just toggled, not merely the rest of the toolbar', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);
		const taskCheckbox = containerEl.querySelector<HTMLInputElement>(
			'.pbl-shelf-type-chip[data-shelf-type="Task"] input',
		);
		expect(taskCheckbox).not.toBeNull();
		taskCheckbox?.focus();

		// The `change` handler calls setShelfHiddenTypes, which re-renders the content
		// pane and rebuilds every chip from scratch — the very node holding focus
		// right now does not survive that. What must survive is focus landing on
		// WHATEVER checkbox now represents "Task", even though it is a new DOM node.
		taskCheckbox!.checked = false;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));

		const rebuiltCheckbox = containerEl.querySelector<HTMLInputElement>(
			'.pbl-shelf-type-chip[data-shelf-type="Task"] input',
		);
		expect(rebuiltCheckbox).not.toBeNull();
		expect(rebuiltCheckbox).not.toBe(taskCheckbox);
		expect(document.activeElement).toBe(rebuiltCheckbox);
	});
});

/**
 * `syncShelfControls`'s call site (a render-loop hook, alongside `syncCountLabel`) is
 * Task 5's job, not this one — see `shelfControls.ts`'s own doc comment. These tests
 * drive the function directly against the toolbar `renderShelfControls` already built,
 * the same way a domain function is unit-tested ahead of the caller that will invoke it
 * in production: the point is coverage of the function's own branches, not the
 * render-lifecycle wiring, which is out of scope here.
 */
describe('syncing the shelf controls directly (call site arrives in a later task)', () => {
	it('fills the real shelf count and the accessible collapse-toggle name', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const collapseBtn = bar.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
		expect(collapseBtn?.querySelector('.pbl-shelf-count')?.textContent).toBe('1');
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Expand');

		view.setShelfCollapsed(false);
		syncShelfControls(view, bar);
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Collapse');
	});

	it('marks the cluster empty once nothing is left to show, and clears the mark once something is', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);

		view.setFilter('nonexistent-search-term');
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(true);

		view.setFilter('');
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);
	});

	it("reflects the host's current sort pick onto the select", () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const bar = toolbarOf(containerEl);
		const sortSelect = bar.querySelector<HTMLSelectElement>('.pbl-shelf-sort');

		syncShelfControls(view, bar);
		expect(sortSelect?.value).toBe('tree');

		view.setShelfSort('modified');
		syncShelfControls(view, bar);
		expect(sortSelect?.value).toBe('modified');
	});

	it('builds one type-filter chip per group present on the shelf, checked unless the host hides that type', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const chips = Array.from(bar.querySelectorAll<HTMLElement>('.pbl-shelf-type-chip'));
		expect(chips.map((c) => c.dataset.shelfType)).toEqual(['Epic', 'Task']);
		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(taskCheckbox?.checked).toBe(true);

		// Hiding a type unchecks its own chip; the chip itself must stay put, or a
		// hidden type could never be turned back on through this control.
		view.setShelfHiddenTypes(new Set(['Task']));
		syncShelfControls(view, bar);
		const stillThere = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(stillThere).not.toBeNull();
		expect(stillThere?.checked).toBe(false);
	});

	it("toggling a chip's checkbox hides that type through the host setter", () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(taskCheckbox).not.toBeNull();
		taskCheckbox!.checked = false;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
		expect(view.shelfHiddenTypes.has('Task')).toBe(true);

		taskCheckbox!.checked = true;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
		expect(view.shelfHiddenTypes.has('Task')).toBe(false);
	});

	it('hands focus to whichever chip now represents the type that held it before the rebuild', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		taskCheckbox?.focus();
		expect(document.activeElement).toBe(taskCheckbox);

		// A second sync rebuilds every chip from scratch; the one for "Task" is a new
		// node, and focus has to land on it rather than nowhere.
		syncShelfControls(view, bar);
		const rebuilt = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(rebuilt).not.toBeNull();
		expect(rebuilt).not.toBe(taskCheckbox);
		expect(document.activeElement).toBe(rebuilt);
	});

	it('does nothing when the toolbar carries no shelf-controls cluster at all', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		// Off the roadmap `renderShelfControls` built nothing; syncing must be a no-op
		// rather than throwing on a missing `.pbl-shelf-controls`.
		expect(() => syncShelfControls(view, toolbarOf(containerEl))).not.toThrow();
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

	it('changes display order within a group via the sort control, without touching group order', () => {
		const vault = new FakeVault();
		vault.addFile('Zed Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('Ann Task.md', { frontmatter: { type: 'Task', order: 20 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		// Tree/sibling order is the default: the order the notes were declared in.
		expect(shelfTitles(containerEl)).toEqual(['Zed Task', 'Ann Task']);

		// A real change on the actual <select>, not a direct setShelfSort call: this
		// is what exercises the select's own change listener and proves it produces
		// the right resulting order, not just that the render logic sorts correctly
		// when told to.
		const sortSelect = containerEl.querySelector<HTMLSelectElement>('.pbl-shelf-sort');
		if (sortSelect) sortSelect.value = 'title';
		sortSelect?.dispatchEvent(new Event('change', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Ann Task', 'Zed Task']);
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
