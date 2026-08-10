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

		const cell = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop');
		expect(cell).not.toBeNull();
		expect(cell?.querySelector('.pbl-prop-value')).toBeNull();
	});

	it('tolerates filter calls before the first data render', () => {
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);

		// No model and no rendered toolbar yet — nothing to sync, nothing to focus.
		view.setFilter('x');
		view.focusFilter();

		expect(view.filterText).toBe('x');
	});

	it('re-measures the titles when the app says its CSS changed', () => {
		// A theme, a snippet or a late-loading font changes rendered text without moving
		// the tree's box, so no ResizeObserver fires and no render follows. The hover-time
		// check this replaced could not suffer that — it re-read the dimensions every
		// time — so the pass has to be told. (Codex, PR #128.)
		let truncated = false;
		const realScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')?.get;
		const realClient = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')?.get;
		const isTitle = (el: Element): boolean => el.classList.contains('pbl-title');
		const scrollWidth = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
			if (!isTitle(this)) return Number(realScroll?.call(this) ?? 0);
			return truncated && this.textContent === 'Epic A' ? 300 : 80;
		});
		const clientWidth = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
			return isTitle(this) ? 100 : Number(realClient?.call(this) ?? 0);
		});
		try {
			const vault = fixture();
			const { containerEl } = makeView(vault);
			const tooltip = (): string | undefined =>
				rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-title')?.dataset.tooltip;
			// Never truncated, so never tooltipped at all: the pass writes only on a CHANGE,
			// because `setTooltip` attaches hover handling on every call.
			expect(tooltip()).toBeUndefined();

			// A bigger interface font: the same box, wider text in it.
			truncated = true;
			vault.changeCss();
			expect(tooltip()).toBe('Epic A');

			// And back: the tooltip is CLEARED rather than left saying what the row now shows
			// in full. This is the path the write guard has to keep working, not bypass.
			truncated = false;
			vault.changeCss();
			expect(tooltip()).toBe('');
		} finally {
			scrollWidth.mockRestore();
			clientWidth.mockRestore();
		}
	});

	it('surfaces the full text of truncated titles as a tooltip', () => {
		// The guarantee, not the mechanism. Until 2026-08-10 this tooltip was set by the
		// title's own `mouseover`, which read layout inside a pointer event and cost 65.7ms
		// per hover at 832 rows; it is now one batched pass at the end of the render. What a
		// reader is owed is unchanged — a clipped title says what it says in full — so this
		// test moved to the new path rather than going with the old one. That the hover
		// reads no layout any more is its own check, in `renderCost.test.ts`.
		//
		// Stubbed on the PROTOTYPE because the render the pass runs at the end of rebuilds
		// every row: a stub put on an element is on a node that is gone before anything
		// measures it. Everything that is not a title delegates, so the column fit still
		// measures the real (zero) pane.
		const realScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')?.get;
		const realClient = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')?.get;
		const isTitle = (el: Element): boolean => el.classList.contains('pbl-title');
		const scrollWidth = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
			if (!isTitle(this)) return Number(realScroll?.call(this) ?? 0);
			return this.textContent === 'Epic A' ? 300 : 80;
		});
		const clientWidth = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
			return isTitle(this) ? 100 : Number(realClient?.call(this) ?? 0);
		});
		try {
			const vault = fixture();
			const { containerEl, view } = makeView(vault);
			view.onDataUpdated();
			const tooltipOn = (title: string): string | undefined =>
				rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-title')?.dataset.tooltip;

			expect(tooltipOn('Epic A')).toBe('Epic A');
			// A title that fits carries no tooltip: its full text is already on screen, and
			// the pass writes nothing rather than writing an empty one.
			expect(tooltipOn('Epic B')).toBeUndefined();

			// Run again over the SAME elements with nothing changed. `setTooltip` attaches
			// Obsidian's hover handling on every call, so a pass that rewrote an unchanged
			// value would stack a listener per row on every resize and every theme change,
			// rebuilding the cost this pass exists to remove. Driven through `css-change`
			// rather than a data update, because a rebuild replaces the elements and writing
			// to a fresh one is not the case being guarded. The stand-in for "was it called"
			// is the value the last call left, overwritten here by hand.
			const title = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-title');
			if (title) title.dataset.tooltip = 'untouched';
			vault.changeCss();
			expect(title?.dataset.tooltip).toBe('untouched');
		} finally {
			scrollWidth.mockRestore();
			clientWidth.mockRestore();
		}
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
		// The chip is what the column draws — the value is never also shown plainly.
		expect(chip?.parentElement?.classList.contains('pbl-prop-state')).toBe(true);
		expect(epicB.querySelector('.pbl-prop-value')).toBeNull();
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
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' }, { order: ['note.status'] });

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
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' }, { order: ['note.status'] });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		const chip = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-state-chip');
		// A missing chip would make every assertion below pass having driven nothing.
		if (!chip) throw new Error('state chip not rendered');
		chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		// Enter on the focused chip activates the chip, not the selected row.
		expect(vault.opened).toHaveLength(0);

		key(tree, 'Enter');
		expect(vault.opened).toHaveLength(1);
	});

	it('routes state writes through the config gate', async () => {
		const vault = stateFixture();
		const { containerEl } = makeView(
			vault,
			{ stateProperty: 'note.status', orderProperty: 'note.parent' },
			{ order: ['note.status'] },
		);

		rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Done')?.click();
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});
