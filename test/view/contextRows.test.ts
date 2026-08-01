// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { expandAll, flush, key, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('parents outside the filter', () => {
	/** The Base returns only the PBI; its Feature and Epic live outside the filter. */
	function filteredView(configValues: Record<string, unknown> = {}) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const config = new FakeViewConfig(configValues);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, config, containerEl, vault };
	}

	it('renders the match inside its full hierarchy', () => {
		const { containerEl } = filteredView();

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature', 'PBI']);
		expect(rowByTitle(containerEl, 'PBI').getAttribute('aria-level')).toBe('3');
	});

	it('marks the context rows and keeps them out of drag and drop', () => {
		const { containerEl } = filteredView();
		const epic = rowByTitle(containerEl, 'Epic');
		const pbi = rowByTitle(containerEl, 'PBI');

		expect(epic.classList.contains('pbl-outside')).toBe(true);
		expect(epic.draggable).toBe(false);
		expect(epic.querySelector('.pbl-outside-marker')).not.toBeNull();
		// The match itself is an ordinary, fully interactive row
		expect(pbi.classList.contains('pbl-outside')).toBe(false);
		expect(pbi.draggable).toBe(true);
		expect(pbi.querySelector('.pbl-outside-marker')).toBeNull();
	});

	it('offers no move commands on a context row', () => {
		const { containerEl } = filteredView();

		rowByTitle(containerEl, 'Feature').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Move down');
		expect(titles).not.toContain('Outdent');
		// Creating a child under it is still the natural thing to do
		expect(titles).toContain('New PBI');
	});

	it('ignores Alt+arrow on a context row', async () => {
		const { view, containerEl, vault } = filteredView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Epic.md') as never);

		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		expect(vault.writeLog).toEqual([]);
	});

	it('drops the context rows when the option is off', () => {
		const { containerEl } = filteredView({ showOutsideParents: false });

		expect(titlesOf(containerEl)).toEqual(['PBI']);
		// Without its parent in the view, the match reads as a broken link again
		expect(rowByTitle(containerEl, 'PBI').querySelector('.pbl-orphan')).not.toBeNull();
	});
})

describe('context rows are read-only', () => {
	/** Filter returns only the PBI; its Feature and Epic load as context. */
	function readOnlyView(configValues: Record<string, unknown> = { stateProperty: 'note.status' }) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Active' },
			parentLink: 'Epic',
		});
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Feature' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig(configValues);
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('shows the state of a context row without making it a write surface', () => {
		const { containerEl } = readOnlyView();
		const epicChip = rowByTitle(containerEl, 'Epic').querySelector('.pbl-state-chip');
		const pbiChip = rowByTitle(containerEl, 'PBI').querySelector('.pbl-state-chip');

		// Still legible, but a div rather than a button, and with no menu behind it
		expect(epicChip?.textContent).toContain('Active');
		expect(epicChip?.tagName).toBe('DIV');
		expect(epicChip?.classList.contains('pbl-state-static')).toBe(true);
		expect(pbiChip?.tagName).toBe('BUTTON');
	});

	it('opens no state menu when a context chip is clicked', () => {
		const { containerEl, vault } = readOnlyView();
		Menu.lastShown = null;

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(Menu.lastShown).toBeNull();
		expect(vault.writeLog).toEqual([]);
	});

	it('withholds every frontmatter command from the context menu', () => {
		const { containerEl } = readOnlyView();

		rowByTitle(containerEl, 'Epic').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Set type');
		expect(titles).not.toContain('Set state');
		expect(titles).not.toContain('Clear parent link');
		// Creating a child writes a new note, not this one — still offered
		expect(titles).toContain('New Feature');
		// A context row can still take a new child of any type its rung allows.
		expect(titles).toContain('New Issue');
		expect(titles).toContain('Open in new tab');
	});

	it('refuses a write aimed at a context note even if one gets through', async () => {
		const { view, vault } = readOnlyView();
		const epic = view.model?.byPath.get('Epic.md');

		const applied = await view.applySafely([{ file: epic?.file as never, state: 'Done' }]);

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
	});

	it('keeps writes to real results working', async () => {
		const { view, vault } = readOnlyView();
		const pbi = view.model?.byPath.get('PBI.md');

		const applied = await view.applySafely([{ file: pbi?.file as never, state: 'Done' }]);

		expect(applied).toBe(true);
		expect(vault.fm('PBI.md').status).toBe('Done');
	});
});

describe('context rows follow the results they place', () => {
	/** Epic (context, open) over a single done PBI, with completed items hidden. */
	function doneUnderContext() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status', showCompleted: false });
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('hides a context row once nothing below it is visible', () => {
		const { view, containerEl } = doneUnderContext();

		// The Epic is open, so its own subtreeDone is false — it must still go
		expect(view.model?.byPath.get('Epic.md')?.subtreeDone).toBe(false);
		expect(titlesOf(containerEl)).toEqual([]);
		expect(containerEl.querySelector('.pbl-empty-filter')?.textContent).toContain('All 1 item is done and hidden');
	});

	it('counts the results, not the scaffolding', () => {
		const { containerEl } = doneUnderContext();
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('0 of 1');
	});

	it('brings the context row back with its result', () => {
		const { view, containerEl } = doneUnderContext();
		(view as unknown as { settings: { showCompleted: boolean } }).settings.showCompleted = true;
		view.render();

		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI']);
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('keeps a context row whose other branch still has a visible result', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 20, status: 'New' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status', showCompleted: false });
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		expandAll(containerEl);

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Open']);
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 of 2');
	});
});
