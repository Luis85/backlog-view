// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { fixture, flush, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('write robustness', () => {
	it('rejects overlapping writes with a notice', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const fileManager = vault.app.fileManager as {
			processFrontMatter: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>;
		};
		const original = fileManager.processFrontMatter.bind(fileManager);
		fileManager.processFrontMatter = async (file, fn) => {
			await gate;
			return original(file, fn);
		};

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true }); // starts a write held by the gate
		key(tree, 'ArrowDown', { altKey: true }); // second attempt while busy
		expect(Notice.messages).toContain('Still applying the previous change — try again in a moment.');

		release();
		await flush();
		expect(vault.fm('Epic A.md')['order']).toBe(30);
	});

	it('reports write failures without leaving the gate stuck', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const vault = fixture();
		const { containerEl } = makeView(vault);
		(vault.app.fileManager as { processFrontMatter: unknown }).processFrontMatter = async () => {
			throw new Error('vault locked');
		};

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Failed to update backlog items'))).toBe(true);
	});
});

describe('view state details', () => {
	it('opens collapsed, so the base file needs no stored UI state', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault, {}, { collapsed: true });

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('false');
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
	});


	it('keeps a leaf that just gained its first child expanded', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { collapsed: true });

		// What a drop into, or a create under, a childless row does before it writes.
		view.setCollapsed('Epic A.md', false);
		// The write lands and Bases refreshes with the child present.
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic A' });
		(view as unknown as Record<string, unknown>).data = { data: vault.entries() };
		view.onDataUpdated();

		// The initial collapse must not apply here and hide what was just put there.
		expect(titlesOf(containerEl)).toContain('PBI A1');
	});

	it('keeps what the user expanded across a data update', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { collapsed: true });
		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);

		view.onDataUpdated(); // a vault edit refreshes the Bases query

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('opens in a new tab on middle click', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: 'tab' }]);
	});

	it('drops chips whose value renders empty', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-chip')).toBeNull();
	});

	it('tolerates filter calls before the first data render', () => {
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);

		// No model and no rendered toolbar yet — nothing to sync, nothing to focus.
		view.setFilter('x');
		view.focusFilter();

		expect(view.filterText).toBe('x');
	});

	it('surfaces the full text of truncated titles as a tooltip', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const truncated = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-title');
		if (!truncated) throw new Error('title missing');
		Object.defineProperty(truncated, 'scrollWidth', { value: 300 });
		Object.defineProperty(truncated, 'clientWidth', { value: 100 });
		truncated.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(truncated.dataset.tooltip).toBe('Epic A');

		// Titles that fit stay tooltip-free (jsdom reports zero widths for both)
		const fitting = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-title');
		fitting?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(fitting?.dataset.tooltip).toBeUndefined();
	});
});

describe('state editing', () => {
	/** Mixed states: an open epic, an active epic with one done feature. */
	function stateFixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
		vault.addFile('Feature B1.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic B',
		});
		return vault;
	}

	it('renders an interactive state chip instead of a read-only property chip', () => {
		const vault = stateFixture();
		vault.entryValues.set('Epic B.md', { 'note.status': 'Active' });
		const { view, containerEl, config } = makeView(vault, { stateProperty: 'note.status' });
		// The state property is among the visible properties — the chip replaces it.
		config.order = ['note.status'];
		view.onDataUpdated();
		const epicB = rowByTitle(containerEl, 'Epic B');
		const chip = epicB.querySelector('.pbl-state-chip');
		expect(chip?.querySelector('.pbl-state-text')?.textContent).toBe('Active');
		expect(epicB.querySelector('.pbl-chip')).toBeNull();
		// A native button assistive tech can activate — without joining the tab order.
		expect(chip?.tagName).toBe('BUTTON');
		expect(chip?.getAttribute('tabindex')).toBe('-1');

		const unset = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-state-chip');
		expect(unset?.classList.contains('pbl-state-unset')).toBe(true);
		expect(unset?.querySelector('.pbl-state-text')?.textContent).toBe('State');

		const done = rowByTitle(containerEl, 'Feature B1').querySelector('.pbl-state-chip');
		expect(done?.classList.contains('pbl-state-done')).toBe(true);
		expect(done?.querySelector<HTMLElement>('.pbl-state-icon')?.dataset.icon).toBe('circle-check');
	});

	it('omits the state chip when no state property is configured', () => {
		const { containerEl } = makeView(fixture());
		expect(containerEl.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('writes the state picked from the chip menu without opening the note', async () => {
		const vault = stateFixture();
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const chip = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-state-chip');
		chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('state menu not shown');

		// Observed states: open ones first, done ones after; the current one checked.
		expect(menu.items.map((i) => i.titleText)).toEqual(['Active', 'Done']);
		expect(menu.item('Active')?.checked).toBe(true);

		menu.item('Done')?.click();
		await flush();
		expect(vault.fm('Epic B.md').status).toBe('Done');
		expect(vault.opened).toHaveLength(0);
	});

	it('offers the configured states plus the item’s unlisted current state', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Blocked' } });
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			stateValues: 'New, Active, Done',
		});

		rowByTitle(containerEl, 'Epic').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		if (!submenu) throw new Error('submenu missing');

		expect(submenu.items.map((i) => i.titleText)).toEqual(['New', 'Active', 'Done', 'Blocked']);
		expect(submenu.item('Blocked')?.checked).toBe(true);
		submenu.item('Active')?.click();
		await flush();
		expect(vault.fm('Epic.md').status).toBe('Active');
	});

	it('keeps chip keystrokes out of the tree keyboard handling', () => {
		const vault = stateFixture();
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		// Enter on the focused chip activates the chip, not the selected row.
		expect(vault.opened).toHaveLength(0);

		key(tree, 'Enter');
		expect(vault.opened).toHaveLength(1);
	});

	it('routes state writes through the config gate', async () => {
		const vault = stateFixture();
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			orderProperty: 'note.parent',
		});

		rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Done')?.click();
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});
