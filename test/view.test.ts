// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../src/view';
import { installObsidianDom } from './dom-helpers';
import { FakeVault, FakeViewConfig } from './helpers';
import { Menu, Modal, Notice } from './obsidian-mock';

installObsidianDom();

interface Harness {
	view: ProductBacklogView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

function makeView(vault: FakeVault, configValues: Record<string, unknown> = {}): Harness {
	const containerEl = document.body.createDiv();
	const view = new ProductBacklogView({} as never, containerEl);
	const config = new FakeViewConfig(configValues);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	return { view, config, containerEl };
}

function rows(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row'));
}

function titlesOf(containerEl: HTMLElement): string[] {
	return rows(containerEl).map((r) => r.querySelector('.pbl-title')?.textContent ?? '');
}

function rowByTitle(containerEl: HTMLElement, title: string): HTMLElement {
	const row = rows(containerEl).find((r) => r.querySelector('.pbl-title')?.textContent === title);
	if (!row) throw new Error(`row not found: ${title}`);
	return row;
}

function treeOf(containerEl: HTMLElement): HTMLElement {
	const tree = containerEl.querySelector<HTMLElement>('.pbl-tree');
	if (!tree) throw new Error('tree not rendered');
	return tree;
}

/** Wait for the async frontmatter writes queued by an interaction. */
function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function stubRect(row: HTMLElement): void {
	row.getBoundingClientRect = () =>
		({ top: 0, bottom: 30, height: 30, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

function drag(from: HTMLElement, to: HTMLElement, zone: 'before' | 'after' | 'inside'): void {
	stubRect(to);
	from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
	const clientY = zone === 'before' ? 3 : zone === 'after' ? 28 : 15;
	to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY }));
	to.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY }));
}

function key(tree: HTMLElement, keyName: string, modifiers: Partial<KeyboardEventInit> = {}): void {
	tree.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, ...modifiers }));
}

/** Two epics; the second has two features. */
function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

beforeEach(() => {
	document.body.empty();
	Notice.reset();
	Menu.lastShown = null;
	Modal.lastOpened = null;
});

describe('rendering', () => {
	it('renders the hierarchy with badges, depths and tree semantics', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(treeOf(containerEl).getAttribute('role')).toBe('tree');

		const epicRow = rowByTitle(containerEl, 'Epic A');
		expect(epicRow.getAttribute('aria-level')).toBe('1');
		expect(epicRow.style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(epicRow.querySelector('.pbl-badge')?.textContent).toBe('Epic');
		expect(epicRow.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('crown');

		const featureRow = rowByTitle(containerEl, 'Feature B1');
		expect(featureRow.getAttribute('aria-level')).toBe('2');
		expect(featureRow.style.getPropertyValue('--pbl-depth')).toBe('1');
		expect(featureRow.querySelector('.pbl-badge')?.textContent).toBe('Feature');

		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('true');
	});

	it('shows the empty state with a create button when nothing matches', () => {
		const { containerEl } = makeView(new FakeVault());
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty button')?.textContent).toContain('New Epic');
	});

	it('renders progress rollups and done styling when a state property is set', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, status: 'Open' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const epicRow = rowByTitle(containerEl, 'Epic');
		expect(epicRow.querySelector('.pbl-progress-label')?.textContent).toBe('1/2');
		expect(epicRow.querySelector<HTMLElement>('.pbl-progress-fill')?.style.getPropertyValue('--pbl-progress')).toBe('50%');
		expect(rowByTitle(containerEl, 'F1').classList.contains('pbl-done')).toBe(true);
		expect(rowByTitle(containerEl, 'F2').classList.contains('pbl-done')).toBe(false);
	});

	it('re-roots on the focus level and labels the New button accordingly', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });

		expect(titlesOf(containerEl)).toEqual(['Feature B1', 'Feature B2']);
		expect(rowByTitle(containerEl, 'Feature B1').style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(containerEl.querySelector('.pbl-new-btn')?.textContent).toContain('New Feature');
	});

	it('warns about corrupt configuration and blocks writes', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });

		expect(containerEl.querySelector('.pbl-config-warning')).not.toBeNull();

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('blocks item creation while the configuration is corrupt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const fileCount = vault.files.size;

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
		expect(vault.files.size).toBe(fileCount);
		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('collapsing', () => {
	it('collapses a subtree via the chevron and persists the state', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('false');
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(true);
		expect(config.values['collapsedItems']).toEqual(['Epic B.md']);
		// The chevron click must not open the note
		expect(vault.opened).toHaveLength(0);
	});
});

describe('opening and keyboard', () => {
	it('opens an item on click and marks it selected', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const row = rowByTitle(containerEl, 'Epic A');
		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: false }]);
		expect(row.classList.contains('pbl-selected')).toBe(true);
	});

	it('navigates with arrows and opens with Enter', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic A').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Epic B.md', mode: false }]);
	});

	it('reorders siblings with Alt+ArrowDown', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown'); // select Epic A
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Epic A.md')['order']).toBe(30);
	});
});

describe('drag and drop', () => {
	it('re-ranks when dropping before a sibling', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		await flush();

		expect(vault.fm('Epic B.md')['order']).toBe(0);
		expect(vault.fm('Epic B.md')['parent']).toBeUndefined();
	});

	it('re-parents and re-types when dropping into a row', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Feature B2'), 'inside');
		await flush();

		const fm = vault.fm('Epic A.md');
		expect(fm['parent']).toBe('[[Feature B2]]');
		expect(fm['type']).toBe('PBI');
		expect(fm['order']).toBe(10);
	});

	it('refuses to drop an ancestor into its own subtree', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Feature B1'), 'inside');
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('shows the drop indicator on the hovered row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));

		expect(to.classList.contains('pbl-drop-before')).toBe(true);
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
	});

	it('clears a stale parent link when the last orphaned root is dropped on the top-level strip', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Epic', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		expect(vault.fm('Orphan.md')['parent']).toBe('[[Missing]]');
		const strip = containerEl.querySelector<HTMLElement>('.pbl-root-drop');
		if (!strip) throw new Error('root drop strip missing');

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		strip.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		strip.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		expect('parent' in vault.fm('Orphan.md')).toBe(false);
	});
});

describe('keyboard expand and collapse', () => {
	it('collapses, expands and traverses with left and right arrows', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Epic B, expanded
		key(tree, 'ArrowRight'); // already expanded: jump to first child
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowLeft'); // leaf-ish: jump back to the parent
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowLeft'); // collapse the subtree
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowRight'); // expand it again
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('ignores keyboard actions on a selection hidden by collapsing', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Feature B1
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		// Collapse the parent — the selected row is no longer visible
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		key(tree, 'Enter');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.opened).toHaveLength(0);
		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('item creation', () => {
	it('creates a child via the add button with prompt, inferred folder and properties', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		expect(modal.titleEl.textContent).toBe('New Feature');

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		input.value = 'Login flow';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Created in the folder most items live in, ranked after its sibling
		const fm = vault.fm('Backlog/Login flow.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic A]]');
		expect(fm['order']).toBe(20);
		expect(Notice.messages.some((m) => m.startsWith('Created'))).toBe(true);
	});
});

describe('toolbar backfill', () => {
	const initButton = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('[aria-label="Assign missing type and order properties"]');

	it('backfills missing properties and reports the count', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped.md', { parentLink: 'Epic' });
		const { containerEl } = makeView(vault);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Untyped.md')['type']).toBe('Feature');
		expect(Notice.messages.some((m) => m.includes('updated 1 item'))).toBe(true);
	});

	it('does not claim success when the backfill is blocked', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped.md', { parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.includes('updated'))).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});

describe('property chips', () => {
	it('renders visible properties as chips with the toString fallback', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		const chip = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-chip');
		expect(chip?.querySelector('.pbl-chip-label')?.textContent).toBe('points');
		expect(chip?.querySelector('.pbl-chip-value')?.textContent).toBe('5');
		// Rows without a value for the property get no chip
		expect(rowByTitle(containerEl, 'Epic B').querySelector('.pbl-chip')).toBeNull();
	});
});

describe('context menu', () => {
	it('offers structural actions and performs outdent', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');

		expect(menu.item('New PBI')).toBeDefined();
		expect(menu.item('Set type')).toBeDefined();
		expect(menu.item('Move down')).toBeDefined();
		expect(menu.item('Outdent')).toBeDefined();
		// Standard file menu appended for the note
		expect(vault.triggers.some((t) => t[0] === 'file-menu')).toBe(true);

		menu.item('Outdent')?.click();
		await flush();
		expect('parent' in vault.fm('Feature B1.md')).toBe(false);
	});

	it('moves an item to the top of its siblings', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move to top')?.click();
		await flush();

		expect(vault.fm('Feature B2.md')['order']).toBe(0);
	});

	it('sets the type through the submenu', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set type')?.submenu;
		if (!submenu) throw new Error('submenu missing');

		expect(submenu.items.map((i) => i.titleText)).toEqual(['Epic', 'Feature', 'PBI', 'Task']);
		expect(submenu.item('Epic')?.checked).toBe(true);
		submenu.item('Task')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['type']).toBe('Task');
	});
});
