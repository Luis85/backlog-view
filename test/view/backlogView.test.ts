// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { FileView, Menu, Modal, Notice } from '../helpers/obsidian-mock';

installObsidianDom();

interface Harness {
	view: ProductBacklogView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * The tree opens collapsed, which would hide the rows most tests are about, so the
 * harness expands it through the real toolbar control. Pass `collapsed` to assert on
 * the opening state itself.
 */
function makeView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ collapsed = false, base, viewName }: { collapsed?: boolean; base?: string; viewName?: string } = {},
): Harness {
	// Bases mounts the view inside the leaf showing the .base file; that leaf is how
	// the view identifies which base it is, so persistence tests need the real nesting.
	const leafEl = document.body.createDiv();
	const containerEl = leafEl.createDiv();
	if (base) vault.leaves.push({ view: new FileView(vault.addFile(base), leafEl) });
	const view = new ProductBacklogView({} as never, containerEl);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	if (!collapsed) expandAll(containerEl);
	return { view, config, containerEl };
}

function expandAll(containerEl: HTMLElement): void {
	const btn = containerEl.querySelector<HTMLElement>('.pbl-collapse-ctl[aria-label="Expand all"]');
	if (!btn) throw new Error('expand all button not rendered');
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** Hand the view a fresh result set, the way Bases does after a vault change. */
function refresh(view: ProductBacklogView, vault: FakeVault): void {
	(view as unknown as Record<string, unknown>).data = { data: vault.entries() };
	view.onDataUpdated();
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
	Menu.lastPosition = null;
	Modal.lastOpened = null;
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Fill the currently open prompt and submit it. */
function submitPrompt(fields: { title: string; folder?: string }): void {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	inputs[0].value = fields.title;
	inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
	if (fields.folder !== undefined) {
		inputs[1].value = fields.folder;
		inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
	}
	modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('rendering', () => {
	it('renders the hierarchy with badges, depths and tree semantics', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(treeOf(containerEl).getAttribute('role')).toBe('tree');

		const epicRow = rowByTitle(containerEl, 'Epic A');
		expect(epicRow.getAttribute('aria-level')).toBe('1');
		expect(epicRow.getAttribute('aria-posinset')).toBe('1');
		expect(epicRow.getAttribute('aria-setsize')).toBe('2');
		expect(epicRow.style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(epicRow.querySelector('.pbl-badge')?.textContent).toBe('Epic');
		expect(epicRow.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('crown');
		// The grip is a pointer affordance only — the row itself is draggable
		expect(epicRow.querySelector('.pbl-grip')?.getAttribute('aria-hidden')).toBe('true');

		const featureRow = rowByTitle(containerEl, 'Feature B1');
		expect(featureRow.getAttribute('aria-level')).toBe('2');
		expect(featureRow.getAttribute('aria-posinset')).toBe('1');
		expect(featureRow.getAttribute('aria-setsize')).toBe('2');
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
		expect(epicRow.querySelector('.pbl-progress')?.classList.contains('pbl-complete')).toBe(false);
		expect(rowByTitle(containerEl, 'F1').classList.contains('pbl-done')).toBe(true);
		expect(rowByTitle(containerEl, 'F2').classList.contains('pbl-done')).toBe(false);
	});

	it('marks a fully done rollup as complete', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const progress = rowByTitle(containerEl, 'Epic').querySelector('.pbl-progress');
		expect(progress?.classList.contains('pbl-complete')).toBe(true);
	});

	it('re-roots on the focus level and labels the New button accordingly', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });

		expect(titlesOf(containerEl)).toEqual(['Feature B1', 'Feature B2']);
		expect(rowByTitle(containerEl, 'Feature B1').style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(containerEl.querySelector('.pbl-new-btn')?.textContent).toContain('New Feature');
	});

	it('picks the focus level from the toolbar', () => {
		const { containerEl, config } = makeView(fixture());

		const btn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('All levels');
		// Nothing is focused, so there is nothing to clear
		expect(containerEl.querySelector('.pbl-focus-clear')).toBeNull();

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['All levels', 'Epic', 'Feature', 'PBI', 'Task']);
		expect(Menu.lastShown?.item('All levels')?.checked).toBe(true);
		Menu.lastShown?.item('Feature')?.click();
		expect(config.setCalls.some((c) => c.key === 'focusLevel' && c.value === 'Feature')).toBe(true);
	});

	it('shows the active focus level with a one-click way back to all levels', () => {
		const { containerEl, config } = makeView(fixture(), { focusLevel: 'Feature' });

		const focusEl = containerEl.querySelector<HTMLElement>('.pbl-focus');
		expect(focusEl?.classList.contains('pbl-focus-active')).toBe(true);
		expect(focusEl?.querySelector('.pbl-focus-btn')?.textContent).toContain('Feature');
		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.item('Feature')?.checked).toBe(true);

		containerEl
			.querySelector<HTMLElement>('.pbl-focus-clear')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.some((c) => c.key === 'focusLevel' && c.value === '')).toBe(true);
	});

	it('marks child groups with their parent depth for indent guides', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const group = rowByTitle(containerEl, 'Feature B1').parentElement;
		expect(group?.classList.contains('pbl-children')).toBe(true);
		expect(group?.style.getPropertyValue('--pbl-depth')).toBe('0');
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
	it('collapses a subtree via the chevron, without touching the base file', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('false');
		// Collapse state is session-only: the .base file must not grow a path per row.
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
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

	it('jumps to the first and last visible item with Home and End', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'End');
		expect(rowByTitle(containerEl, 'Feature B2').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Home');
		expect(rowByTitle(containerEl, 'Epic A').classList.contains('pbl-selected')).toBe(true);
	});

	it('clears the selection with Escape', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
	});

	it('points aria-activedescendant at the selected row across renders', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		const tree = treeOf(containerEl);

		expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
		key(tree, 'ArrowDown');
		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.id).not.toBe('');
		expect(tree.getAttribute('aria-activedescendant')).toBe(row.id);

		// A re-render rebuilds the rows; the reference must follow the new element.
		view.onDataUpdated();
		const rerendered = rowByTitle(containerEl, 'Epic A');
		expect(rerendered.classList.contains('pbl-selected')).toBe(true);
		expect(tree.getAttribute('aria-activedescendant')).toBe(rerendered.id);
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

	it('marks the moved row pending until the data refreshes', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-pending')).toBe(true);

		await flush();
		view.onDataUpdated(); // the Bases refresh re-renders the tree
		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
	});

	it('clears the pending mark when the write is rejected', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
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
		// The prompt says where the item will land before anything is written
		expect(modal.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe(
			'Under "Epic A" · in folder "Backlog"',
		);

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		const createBtn = modal.contentEl.querySelector('button');
		expect(createBtn?.disabled).toBe(true);
		input.value = 'Login flow';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(createBtn?.disabled).toBe(false);
		createBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

describe('property columns', () => {
	it('renders visible properties as fixed cells with the toString fallback', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		const cell = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop');
		expect(cell?.querySelector('.pbl-prop-value')?.textContent).toBe('5');
		// The label is not repeated per row — it is in the header and the tooltip
		expect(cell?.querySelector<HTMLElement>('.pbl-prop-value')?.dataset.tooltip).toBe('points: 5');
		// A row without a value keeps the empty cell, or the columns after it would shift
		const empty = rowByTitle(containerEl, 'Epic B').querySelector('.pbl-prop');
		expect(empty).not.toBeNull();
		expect(empty?.querySelector('.pbl-prop-value')).toBeNull();
	});

	it('names the columns once, in a header above the rows', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault, { stateProperty: 'note.status' });
		config.order = ['note.points'];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		expect(header?.getAttribute('aria-hidden')).toBe('true');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'points',
			'status',
			'Progress',
		]);
		// Same column widths as the rows, so the labels sit above their values
		expect(header?.querySelector('.pbl-props')?.childElementCount).toBe(1);
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-count')).toBe('1');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-col')).toBe('132px');
	});

	it('drops the columns a pane cannot hold, measuring what they actually need', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 280, stateProperty: 'note.status' });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};

		// Wider than any fixed breakpoint would be, yet two 280px columns do not fit
		paneWidth(700);
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(true);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		paneWidth(1400);
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(false);

		// Narrow enough that even the rollup has to go
		paneWidth(300);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(true);
	});

	it('counts the indent of the deepest rendered row', () => {
		// A chain deep enough that its indent alone eats a column's worth of room.
		const vault = new FakeVault();
		vault.addFile('L0.md', { frontmatter: { type: 'Epic', order: 10 } });
		for (let i = 1; i <= 8; i++) {
			vault.addFile(`L${i}.md`, { frontmatter: { type: 'Task', order: 10 }, parentLink: `L${i - 1}` });
		}
		const { containerEl, config, view } = makeView(vault, {}, { collapsed: true });
		config.order = ['note.points'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 480, configurable: true });
		view.onDataUpdated();
		const viewEl = containerEl.querySelector('.pbl-view');

		// Collapsed, only the root renders: one 132px column fits beside it
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(false);

		// Expanding the chain puts a row eight levels in — 192px of indent — on screen
		containerEl
			.querySelector<HTMLElement>('.pbl-collapse-ctl[aria-label="Expand all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(true);
	});

	it('has no header when no properties are shown', () => {
		const { containerEl } = makeView(fixture(), { stateProperty: 'note.status' });
		expect(containerEl.querySelector('.pbl-cols')).toBeNull();
	});

	it('sizes the columns from the view option', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 200 });
		config.order = ['note.points'];
		view.onDataUpdated();

		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-col')).toBe('200px');
	});

	it('keeps the empty space around the columns part of the row click target', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		// A click on the value itself must not open the note (it may hold links)…
		const value = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-prop-value');
		value?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([]);

		// …but the flexible area before the columns is still the row.
		const spacer = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-row-spacer');
		spacer?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: false }]);
	});
});

describe('tag editing', () => {
	/** Two epics carrying tags, with the tags property among the visible ones. */
	function tagged(configValues: Record<string, unknown> = {}): Harness & { vault: FakeVault } {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha', 'beta'] } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, tags: 'gamma' } });
		const harness = makeView(vault, configValues);
		harness.config.order = ['note.tags'];
		harness.view.onDataUpdated();
		return { ...harness, vault };
	}

	function tagsOf(containerEl: HTMLElement, title: string): string[] {
		return Array.from(rowByTitle(containerEl, title).querySelectorAll('.pbl-tag-text')).map(
			(el) => el.textContent ?? '',
		);
	}

	/** Click the row's add-tag button and return the menu it opened. */
	function openTagMenu(containerEl: HTMLElement, title: string): Menu {
		rowByTitle(containerEl, title)
			.querySelector<HTMLElement>('.pbl-tag-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('tag menu not shown');
		return menu;
	}

	it('renders each tag as a removable pill with a way to add one', () => {
		const { containerEl } = tagged();

		expect(tagsOf(containerEl, 'Epic A')).toEqual(['#alpha', '#beta']);
		// A string value holding tags is read the same as a list
		expect(tagsOf(containerEl, 'Epic B')).toEqual(['#gamma']);

		const pill = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-tag');
		const remove = pill?.querySelector('.pbl-tag-remove');
		expect(remove?.tagName).toBe('BUTTON');
		// No Tab stop — the tree keeps its single-tab-stop model
		expect(remove?.getAttribute('tabindex')).toBe('-1');
		expect(remove?.getAttribute('aria-label')).toBe('Remove tag alpha');
		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-tag-add')).not.toBeNull();
	});

	it('keeps the add button beside the pills, not behind them', () => {
		const vault = new FakeVault();
		// More tags than a column can show: the pills clip, the control must not
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, tags: ['one', 'two', 'three', 'four', 'five', 'six'] },
		});
		const harness = makeView(vault);
		harness.config.order = ['note.tags'];
		harness.view.onDataUpdated();

		const cell = rowByTitle(harness.containerEl, 'Epic A').querySelector('.pbl-prop-tags');
		const list = cell?.querySelector('.pbl-tag-list');
		expect(list?.querySelectorAll('.pbl-tag')).toHaveLength(6);
		// A sibling of the clipped pill box, and the last thing in the cell
		expect(cell?.querySelector('.pbl-tag-add')?.parentElement).toBe(cell);
		expect(list?.querySelector('.pbl-tag-add')).toBeNull();
		expect(cell?.lastElementChild?.classList.contains('pbl-tag-add')).toBe(true);
	});

	it('removes a tag without touching the others', async () => {
		const { containerEl, vault } = tagged();

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-tag-remove')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Epic A.md').tags).toEqual(['beta']);
		// The click stays on the pill — it must not also open the note
		expect(vault.opened).toEqual([]);
	});

	it('removes two tags in a row without the second undoing the first', async () => {
		// Both clicks come from the same rendered row, whose tags are a snapshot from
		// before either write — the second must not put the first tag back.
		const { containerEl, vault } = tagged();
		const row = rowByTitle(containerEl, 'Epic A');
		const [first, second] = Array.from(row.querySelectorAll<HTMLElement>('.pbl-tag-remove'));

		first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		second.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('tags' in vault.fm('Epic A.md')).toBe(false);
	});

	it('keeps the hyphens a user typed while cleaning up the rest', async () => {
		const { containerEl, vault } = tagged();
		const typeTag = async (text: string) => {
			openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
			const modal = Modal.lastOpened;
			const input = modal?.contentEl.querySelector('input');
			if (!modal || !input) throw new Error('tag prompt not opened');
			input.value = text;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await flush();
		};

		// A leading or trailing hyphen is a legal tag character and the user's choice;
		// a slash there would be an empty nesting segment, and punctuation is noise.
		await typeTag('-urgent');
		await typeTag('/release/1-0/');
		await typeTag('Sprint 12!');

		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', '-urgent', 'release/1-0', 'Sprint-12']);
	});

	it('accepts a tag whose only non-numeric character is a separator', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
		const modal = Modal.lastOpened;
		const input = modal?.contentEl.querySelector('input');
		if (!modal || !input) throw new Error('tag prompt not opened');
		input.value = '2026-07';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', '2026-07']);
	});

	it('removes the key when the last tag goes', async () => {
		const { containerEl, vault } = tagged();

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-tag-remove')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('tags' in vault.fm('Epic B.md')).toBe(false);
	});

	it('offers the tags in use, checked where the item already carries them', async () => {
		const { containerEl, vault } = tagged();
		const menu = openTagMenu(containerEl, 'Epic B');

		expect(menu.items.map((i) => i.titleText)).toEqual(['#alpha', '#beta', '#gamma', 'New tag...']);
		expect(menu.item('#gamma')?.checked).toBe(true);
		expect(menu.item('#alpha')?.checked).toBe(false);

		menu.item('#alpha')?.click();
		await flush();
		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', 'alpha']);
	});

	it('toggles an assigned tag back off from the menu', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('#gamma')?.click();
		await flush();

		expect('tags' in vault.fm('Epic B.md')).toBe(false);
	});

	it('adds a typed tag, normalized to a usable frontmatter tag', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('tag prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('tag input not rendered');
		input.value = '#Sprint 12!';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', 'Sprint-12']);
	});

	it('refuses a tag Obsidian would not recognize, and says why', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
		const modal = Modal.lastOpened;
		const input = modal?.contentEl.querySelector('input');
		if (!modal || !input) throw new Error('tag prompt not opened');
		// Digits alone are not a tag — writing it would look like it worked
		input.value = '123';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Epic B.md').tags).toBe('gamma');
		expect(Notice.messages.some((m) => m.includes('at least one non-numeric character'))).toBe(true);
	});

	it('stops offering tag editing when the tags property is cleared', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		const { containerEl } = makeView(vault, { tagsProperty: '' });

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('reaches the same choices from the context menu', () => {
		const { containerEl } = tagged();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const submenu = Menu.lastShown?.item('Edit tags')?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(['#alpha', '#beta', '#gamma', 'New tag...']);
	});

	it('leaves the property read-only when it is not the configured tags property', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		vault.entryValues.set('Epic A.md', { 'note.tags': { toString: () => 'alpha' } });
		const { containerEl, config, view } = makeView(vault, { tagsProperty: 'note.labels' });
		config.order = ['note.tags'];
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		expect(containerEl.querySelector('.pbl-prop-value')?.textContent).toBe('alpha');
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('offers no tag editing while the column is hidden', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		const { containerEl } = makeView(vault);

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('shows a context row’s tags without offering to change them', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, tags: ['outside'] } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, tags: ['alpha'] }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig({});
		config.order = ['note.tags'];
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);

		const epic = rowByTitle(containerEl, 'Epic');
		expect(tagsOf(containerEl, 'Epic')).toEqual(['#outside']);
		expect(epic.querySelector('.pbl-tag-remove')).toBeNull();
		expect(epic.querySelector('.pbl-tag-add')).toBeNull();
		epic.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();

		// An excluded note's tags are not this base's vocabulary either
		expect(openTagMenu(containerEl, 'PBI').items.map((i) => i.titleText)).toEqual(['#alpha', 'New tag...']);
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

	it('opens the item in a new tab or split from the menu', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Open in new tab')?.click();
		Menu.lastShown?.item('Open to the right')?.click();

		expect(vault.opened).toEqual([
			{ path: 'Epic A.md', mode: 'tab' },
			{ path: 'Epic A.md', mode: 'split' },
		]);
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

	it('indents under the previous sibling and moves to the bottom', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Feature B2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Indent under "Feature B1"')?.click();
		await flush();
		expect(vault.fm('Feature B2.md')['parent']).toBe('[[Feature B1]]');
		expect(vault.fm('Feature B2.md')['type']).toBe('PBI');

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Move to bottom')?.click();
		await flush();
		expect(vault.fm('Feature B1.md')['order']).toBe(30);
	});

	it('clears a stale parent link through the menu', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Clear parent link')?.click();
		await flush();

		expect('parent' in vault.fm('Orphan.md')).toBe(false);
	});

	it('offers "Use folder position" for overridden items in folder mode only', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Beta/Beta.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Alpha/Feat/Feat.md', { frontmatter: { type: 'Feature' }, parentLink: 'Beta' });
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Feat').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Use folder position')?.click();
		await flush();
		expect('parent' in vault.fm('Epics/Alpha/Feat/Feat.md')).toBe(false);

		// Outside folder mode the action does not exist
		const flat = makeView(fixture());
		rowByTitle(flat.containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Use folder position')).toBeUndefined();
	});

	it('retypes items handed back to the folder hierarchy', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Epics/Alpha/Login/Login.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Epics/Alpha/Login/Fast path/Fast path.md', {
			frontmatter: { type: 'Feature' },
			parentLink: 'Alpha',
		});
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Fast path').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Use folder position')?.click();
		await flush();

		// The folder parent is the Feature "Login", so the item becomes a PBI
		const fm = vault.fm('Epics/Alpha/Login/Fast path/Fast path.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('PBI');
	});

	it('retypes an orphan cleared to the top level', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Clear parent link')?.click();
		await flush();

		const fm = vault.fm('Orphan.md');
		expect('parent' in fm).toBe(false);
		expect(fm['type']).toBe('Epic');
	});

	it('opens the context menu from the keyboard', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');

		Menu.lastShown = null;
		key(tree, 'ContextMenu');
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		Menu.lastShown = null;
		key(tree, 'F10', { shiftKey: true });
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();

		// Plain F10 is not a menu shortcut
		Menu.lastShown = null;
		key(tree, 'F10');
		expect(Menu.lastShown).toBeNull();
	});

});

describe('keyboard structure shortcuts', () => {
	it('moves up, outdents and indents with Alt+arrows', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Epic B
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.fm('Epic B.md')['order']).toBe(0);

		key(tree, 'ArrowRight', { altKey: true }); // indent under Epic A (previous sibling)
		await flush();
		expect(vault.fm('Epic B.md')['parent']).toBe('[[Epic A]]');
		// The explicitly typed subtree follows the ladder
		expect(vault.fm('Feature B1.md')['type']).toBe('PBI');
	});

	it('outdents to the top level with Alt+ArrowLeft', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Feature B1
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		const fm = vault.fm('Feature B1.md');
		expect('parent' in fm).toBe(false);
		expect(fm['order']).toBe(30);
	});
});

describe('drag state details', () => {
	it('expands a collapsed row after hovering over it during a drag', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		// The pending expansion is signaled on the row while the timer runs
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);
		vi.advanceTimersByTime(700);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('drops the hover-expand cue when the drag moves off the row', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(false);
		vi.advanceTimersByTime(700);
		// The cancelled timer must not expand the row anyway
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('clears the indicator when the drag leaves the row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(to.classList.contains('pbl-drop-before')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-drop-before')).toBe(false);
	});

	it('drops on the tree background to move an item to the top level', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		const fm = vault.fm('Feature B1.md');
		expect('parent' in fm).toBe(false);
		expect(fm['order']).toBe(30);
	});

	it('clears all drag state on dragend', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const row = rowByTitle(containerEl, 'Epic A');
		row.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
		expect(row.classList.contains('pbl-drag-source')).toBe(true);

		row.dispatchEvent(new MouseEvent('dragend', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(false);
		expect(row.classList.contains('pbl-drag-source')).toBe(false);
	});
});

describe('toolbar controls', () => {
	it('offers every level in the New picker and opens the right prompt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const picker = Menu.lastShown;
		expect(picker?.items.map((i) => i.titleText)).toEqual(['New Epic', 'New Feature', 'New PBI', 'New Task']);

		picker?.item('New PBI')?.click();
		expect(Modal.lastOpened?.titleEl.textContent).toBe('New PBI');
	});

	it('collapses and expands everything from the toolbar', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		containerEl
			.querySelector<HTMLElement>('[aria-label="Collapse all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		containerEl
			.querySelector<HTMLElement>('[aria-label="Expand all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// Neither control writes to the base file.
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
	});
});

describe('toolbar controls are reachable without a mouse', () => {
	/** Every control the toolbar renders, by the label a user would hear. */
	function controlsByLabel(containerEl: HTMLElement): Map<string, HTMLElement> {
		const toolbar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
		if (!toolbar) throw new Error('toolbar not rendered');
		const found = new Map<string, HTMLElement>();
		for (const el of Array.from(toolbar.querySelectorAll<HTMLElement>('[aria-label]'))) {
			found.set(el.getAttribute('aria-label') ?? '', el);
		}
		return found;
	}

	it('renders every activatable toolbar control as a real button', () => {
		const vault = fixture();
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 30, status: 'Done' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status', focusLevel: 'Feature' });
		const controls = controlsByLabel(containerEl);

		// The full set a keyboard user has to be able to reach. Anything that only
		// responds to a click is invisible to Tab, so a div here is a real defect.
		for (const label of [
			'New item of another type',
			'Assign missing type and order properties',
			'Expand all',
			'Collapse all',
			'Hide completed items',
			'Filter items',
			'Show all levels',
		]) {
			const el = controls.get(label);
			expect(el, `no toolbar control labelled "${label}"`).toBeDefined();
			expect(el?.tagName, `"${label}" is not keyboard-activatable`).toMatch(/^(BUTTON|INPUT)$/);
		}
	});

	it('activates a toolbar button from the keyboard', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const collapse = controlsByLabel(containerEl).get('Collapse all');

		// What Enter or Space on a focused <button> does: a plain click, no pointer.
		collapse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('really disables the collapse controls while a filter overrides them', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const collapseCtl = () =>
			Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl'));

		expect(collapseCtl()).toHaveLength(2);
		expect(collapseCtl().every((b) => b.disabled)).toBe(false);

		// Dimming them with CSS was enough while they were unreachable divs; a
		// focusable button has to refuse the press itself.
		view.setFilter('Feature');
		expect(collapseCtl().every((b) => b.disabled)).toBe(true);

		view.setFilter('');
		expect(collapseCtl().some((b) => b.disabled)).toBe(false);
	});

	it('keeps the clear buttons out of the tab order until they apply', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const clear = () => containerEl.querySelector<HTMLElement>('.pbl-filter-clear');

		// Hidden by `display: none` until the filter is active — which removes it
		// from the tab order too, so Tab does not stop on a control that does nothing.
		expect(clear()?.tagName).toBe('BUTTON');
		expect(containerEl.querySelector('.pbl-filter')?.classList.contains('pbl-filter-active')).toBe(false);

		view.setFilter('Feature');
		expect(containerEl.querySelector('.pbl-filter')?.classList.contains('pbl-filter-active')).toBe(true);
	});

	it('gives each row an add button assistive tech can activate, off the tab order', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const add = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-add');

		// Same bargain as the state chip: a real button, but the tree keeps its
		// single tab stop — one stop per row would bury the tree itself.
		expect(add?.tagName).toBe('BUTTON');
		expect(add?.getAttribute('tabindex')).toBe('-1');
		expect(add?.getAttribute('aria-label')).toBe('New Feature');
	});
});

describe('collapse state persistence', () => {
	interface StoredEntry {
		collapsed: string[];
		expanded: string[];
	}

	function stored(vault: FakeVault): Record<string, StoredEntry> {
		return (vault.localStorage.get('product-backlog:collapse') ?? {}) as Record<string, StoredEntry>;
	}

	const expandedTitles = ['Epic A', 'Epic B', 'Feature B1', 'Feature B2'];

	it('reopens a base where the last session left it', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(first.containerEl)).toEqual(expandedTitles);
		first.view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].expanded).toContain('Epic B.md');

		// `collapsed: true` skips the harness's expand-all, so an expanded tree here
		// is the restore doing it — not the test.
		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(second.containerEl)).toEqual(expandedTitles);
	});

	it('still opens collapsed with nothing stored', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('remembers a row that was shut, not just ones that were opened', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		rowByTitle(first.containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(first.containerEl)).toEqual(['Epic A', 'Epic B']);
		first.view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].collapsed).toContain('Epic B.md');
		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(second.containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('keeps two bases out of one another’s state', () => {
		const vault = fixture();
		const a = makeView(vault, {}, { base: 'A.base' });
		a.view.onunload();

		const b = makeView(vault, {}, { base: 'B.base', collapsed: true });
		// A's expanded rows must not open B, which nobody has touched.
		expect(titlesOf(b.containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(Object.keys(stored(vault))).toEqual(['A.base#Backlog']);
	});

	it('separates two views of one base by name', () => {
		const vault = fixture();
		const a = makeView(vault, {}, { base: 'Shared.base', viewName: 'Planning' });
		a.view.onunload();
		expect(Object.keys(stored(vault))).toEqual(['Shared.base#Planning']);

		const b = makeView(vault, {}, { base: 'Shared.base', viewName: 'Triage', collapsed: true });
		expect(titlesOf(b.containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('keeps an expanded parent open when the note is renamed', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(containerEl)).toEqual(expandedTitles);

		// Renaming is an edit to the same row. The refresh that follows must not treat
		// the new path as a parent nobody has ruled on and shut it.
		vault.renameFile('Epic B.md', 'Epic B renamed.md');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B renamed', 'Feature B1', 'Feature B2']);
	});

	it('keeps rows open when the folder above them is moved', () => {
		const vault = new FakeVault();
		vault.folders.add('Work');
		vault.addFile('Work/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Work/Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);

		// Obsidian reports the folder, not each note inside it, so matching on the
		// renamed path alone would leave every row behind under the old prefix.
		vault.renameFolder('Work', 'Archive/Work');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);
	});

	it('carries a collapsed row to its new path too', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		vault.renameFile('Epic B.md', 'Epic B renamed.md');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B renamed']);
	});

	it('migrates the stored entry when the view itself is renamed', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Backlog' });
		first.view.onunload();
		expect(Object.keys(stored(vault))).toHaveLength(1);

		// Reopen, rename the view, and close without touching a row — the state is
		// unchanged but belongs under a different key now.
		const second = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Backlog', collapsed: true });
		second.config.name = 'Planning';
		second.view.onunload();

		const keys = Object.keys(stored(vault));
		expect(keys).toHaveLength(1);
		expect(decodeURIComponent(keys[0].split('#')[1])).toBe('Planning');

		// And the renamed view reopens where it was left, rather than at its defaults.
		const third = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Planning', collapsed: true });
		expect(titlesOf(third.containerEl)).toEqual(expandedTitles);
	});

	it('follows the base when it is renamed under an open view', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });

		// The file explorer moves the base while the view is open. The view resolves
		// its identity again when it saves, so the state lands under the new path
		// rather than under a key nothing will look up again.
		const leaf = vault.leaves[0].view as { file: { path: string; extension: string } };
		vault.files.delete('Backlog.base');
		vault.addFile('Archive/Backlog.base');
		leaf.file = { path: 'Archive/Backlog.base', extension: 'base' };
		first.view.onunload();

		const keys = Object.keys(stored(vault));
		expect(keys).toHaveLength(1);
		expect(decodeURIComponent(keys[0].split('#')[0])).toBe('Archive/Backlog.base');
	});

	it('stays session-only for a base embedded in a note', () => {
		const vault = fixture();
		// An embedded base is drawn inside the host note's leaf, so the only file on
		// offer is the note. Two embeds in one note would then share a key and
		// overwrite each other — worse than forgetting, so it forgets.
		const { view, containerEl } = makeView(vault, {}, { base: 'Notes/Plan.md' });

		expect(titlesOf(containerEl)).toEqual(expandedTitles);
		view.onunload();
		expect(vault.localStorage.size).toBe(0);
	});

	it('stays session-only when the base cannot be identified', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		// No leaf owns this element, so there is no key. Sharing one would be worse
		// than not persisting: bases would inherit each other's rows.
		expect(titlesOf(containerEl)).toEqual(expandedTitles);
		view.onunload();
		expect(vault.localStorage.size).toBe(0);
	});

	it('survives a view name containing the key separator', () => {
		const vault = fixture();
		// "Sprint #3" is an ordinary view name. The base path is carried in the entry
		// rather than parsed back out of the key, so a `#` in either half cannot make
		// one view's save mistake another's entry for a base that no longer exists.
		const first = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Sprint #3' });
		first.view.onunload();

		// Saving from any other view is when stale entries get pruned — the moment a
		// misparsed base path turns a live entry into one whose base "no longer exists".
		const other = makeView(vault, {}, { base: 'Other.base' });
		other.view.onunload();

		const reopened = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Sprint #3', collapsed: true });
		expect(titlesOf(reopened.containerEl)).toEqual(expandedTitles);
	});

	it('forgets paths whose note is gone, and entries whose base is gone', () => {
		const vault = fixture();
		vault.localStorage.set('product-backlog:collapse', {
			'Deleted.base#Backlog': { base: 'Deleted.base', collapsed: ['Whatever.md'], expanded: [] },
		});
		const { view } = makeView(vault, {}, { base: 'Backlog.base' });
		vault.files.delete('Epic B.md');
		view.onunload();

		const entry = stored(vault)['Backlog.base#Backlog'];
		expect([...entry.collapsed, ...entry.expanded]).not.toContain('Epic B.md');
		// Nothing else will ever enumerate the base that wrote this.
		expect(stored(vault)['Deleted.base#Backlog']).toBeUndefined();
	});

	it('ignores stored state it cannot read rather than failing to render', () => {
		const vault = fixture();
		vault.localStorage.set('product-backlog:collapse', 'not an object');
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('coalesces the writes instead of saving once per row', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base' });
		const save = vi.spyOn(vault.app, 'saveLocalStorage');

		containerEl
			.querySelector<HTMLElement>('[aria-label="Collapse all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Settling every parent is one loop; serializing the whole list per row
		// would be quadratic on a real backlog.
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(400);
		expect(save).toHaveBeenCalledTimes(1);
	});
});

describe('menus opened without a pointer', () => {
	/** Enter or Space on a focused button: a click carrying no coordinates. */
	function pressButton(el: HTMLElement, rect: { left: number; bottom: number }): void {
		el.getBoundingClientRect = () =>
			({ ...rect, top: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
		el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	it('anchors the type picker to its button, not the viewport corner', () => {
		const { containerEl } = makeView(fixture());
		const pick = containerEl.querySelector<HTMLElement>('.pbl-new-pick');
		if (!pick) throw new Error('type picker not rendered');

		pressButton(pick, { left: 40, bottom: 24 });
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('New Epic');
		expect(Menu.lastPosition).toEqual({ x: 40, y: 24 });
	});

	it('anchors the focus-level picker to its button', () => {
		const { containerEl } = makeView(fixture());
		const btn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		if (!btn) throw new Error('focus picker not rendered');

		pressButton(btn, { left: 12, bottom: 30 });
		expect(Menu.lastPosition).toEqual({ x: 12, y: 30 });
	});

	it('still follows the pointer when there is one', () => {
		const { containerEl } = makeView(fixture());
		containerEl
			.querySelector<HTMLElement>('.pbl-new-pick')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 80 }));

		// A real pointer position beats the button's box.
		expect(Menu.lastShown).not.toBeNull();
		expect(Menu.lastPosition).toBeNull();
	});
});

describe('long operations stay legible and non-blocking', () => {
	/** Four items with no order or type — enough writes for a batch to be visible. */
	function backfillFixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F1.md', { parentLink: 'Epic' });
		vault.addFile('F2.md', { parentLink: 'Epic' });
		vault.addFile('F3.md', { parentLink: 'Epic' });
		return vault;
	}

	function runBackfill(containerEl: HTMLElement): void {
		containerEl
			.querySelector<HTMLElement>('[aria-label="Assign missing type and order properties"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	/** Run `probe` after each file the next batch writes. */
	function onEachWrite(vault: FakeVault, probe: () => void): void {
		const original = vault.app.fileManager.processFrontMatter;
		vault.app.fileManager.processFrontMatter = async (file, fn) => {
			await original(file, fn);
			probe();
		};
	}

	function busyLabel(containerEl: HTMLElement): string | null {
		const el = containerEl.querySelector<HTMLElement>('.pbl-busy');
		return el?.classList.contains('pbl-busy-on') ? (el.querySelector('.pbl-busy-label')?.textContent ?? '') : null;
	}

	it('shows a loading state until the first result set arrives', () => {
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);

		// Bases constructs the view and delivers data separately; the gap must not
		// look like a broken view.
		expect(containerEl.querySelector('.pbl-loading')?.textContent).toContain('Loading backlog');

		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = fixture().app;
		anyView.config = new FakeViewConfig({});
		anyView.data = { data: [] };
		view.onDataUpdated();
		expect(containerEl.querySelector('.pbl-loading')).toBeNull();
	});

	it('counts a batch off file by file, then clears', async () => {
		const vault = backfillFixture();
		const { containerEl } = makeView(vault);
		const seen: (string | null)[] = [];
		onEachWrite(vault, () => seen.push(busyLabel(containerEl)));

		expect(busyLabel(containerEl)).toBeNull();
		runBackfill(containerEl);
		await flush();

		// The probe runs as each file lands, just before that file's progress tick,
		// so it reads one behind: the point is that it counts up per file and that
		// the total is known from the start.
		expect(seen).toEqual(['Updating 0 of 4…', 'Updating 1 of 4…', 'Updating 2 of 4…', 'Updating 3 of 4…']);
		// The indicator belongs to the batch, not to the view.
		expect(busyLabel(containerEl)).toBeNull();
	});

	it('does not put a count on a single-file write', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		const seen: (string | null)[] = [];
		onEachWrite(vault, () => seen.push(busyLabel(containerEl)));

		const tree = treeOf(containerEl);
		view.selectItem(view.model!.byPath.get('Feature B2.md')!);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();

		expect(seen).toEqual(['Updating…']);
	});

	it('rebuilds once after a batch, not once per file it writes', async () => {
		const vault = backfillFixture();
		const { containerEl, view } = makeView(vault);
		let renders = 0;
		const real = view.render.bind(view);
		(view as unknown as { render: () => void }).render = () => {
			renders++;
			real();
		};
		// Every file a batch touches comes back as its own data update. Rebuilding
		// the model and every row for each one is the thing that actually stalls.
		onEachWrite(vault, () => view.onDataUpdated());

		runBackfill(containerEl);
		await flush();

		expect(vault.writeLog).toHaveLength(4);
		expect(renders).toBe(1);
		// Deferred, not dropped: the tree ends up showing what landed on disk.
		expect(titlesOf(containerEl)).toEqual(['Epic', 'F1', 'F2', 'F3']);
	});

	it('withholds the backfill command while a batch is already running', async () => {
		const vault = backfillFixture();
		const { containerEl } = makeView(vault);
		const initBtn = containerEl.querySelector<HTMLButtonElement>('.pbl-write-ctl');
		const seen: boolean[] = [];
		onEachWrite(vault, () => seen.push(initBtn?.disabled ?? false));

		expect(initBtn?.disabled).toBe(false);
		runBackfill(containerEl);
		await flush();

		// Disabled for the whole batch, released at the end — a control that would be
		// refused should not be offered in the first place.
		expect(seen.every(Boolean)).toBe(true);
		expect(containerEl.querySelector<HTMLButtonElement>('.pbl-write-ctl')?.disabled).toBe(false);
	});

	it('keeps the tree interactive while a batch is in flight', async () => {
		const vault = backfillFixture();
		const { containerEl, view } = makeView(vault);
		let collapsedMidBatch: string[] | null = null;
		onEachWrite(vault, () => {
			if (collapsedMidBatch) return;
			// Reading and navigating the tree must keep working during the writes.
			view.setFilter('F');
			collapsedMidBatch = titlesOf(containerEl);
			view.setFilter('');
		});

		runBackfill(containerEl);
		await flush();

		expect(collapsedMidBatch).toEqual(['Epic', 'F1', 'F2', 'F3']);
		expect(treeOf(containerEl).getAttribute('aria-busy')).toBeNull();
	});
});

describe('creation flows', () => {
	it('asks for a folder on an empty view and persists the choice', async () => {
		const vault = new FakeVault();
		const { containerEl, config } = makeView(vault);

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// With the folder still a user choice there is no landing spot to announce
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')).toBeNull();
		submitPrompt({ title: 'First Epic', folder: 'Backlog' });
		await flush();

		expect(config.values['newItemFolder']).toBe('Backlog');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.fm('Backlog/First Epic.md')['type']).toBe('Epic');
	});

	it('describes the vault root as the landing spot for rootless backlogs', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe('In the vault root');
	});

	it('ranks top-level creations against the real roots in focus mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic 1.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Epic 2.md', { frontmatter: { type: 'Epic', order: 200 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic 1' });
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		// After the real epics (order 200), not squeezed between the focus rows
		expect(vault.fm('Fresh Feature.md')['order']).toBe(210);
	});

	it('infers the folder from hidden items when a focused view is empty', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// Focused on Feature, nothing matches — but the full tree knows the folder
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// No folder question: the location is known
		expect(modal.contentEl.querySelectorAll('input')).toHaveLength(1);
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		expect(vault.fm('Backlog/Fresh Feature.md')['type']).toBe('Feature');
	});

	it('creates children beside the parent folder note in folder mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic X/Epic X.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Epic X')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fast checkout' });
		await flush();

		const fm = vault.fm('Backlog/Epic X/Fast checkout.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic X]]');
	});

	it('surfaces creation failures as a notice', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const vault = fixture();
		const { containerEl } = makeView(vault);
		(vault.app.vault as { create: unknown }).create = async () => {
			throw new Error('disk full');
		};

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Doomed' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not create the item'))).toBe(true);
	});
});

describe('focused structure operations', () => {
	it('outdents a child of a rootless focus row against the real top level', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Loose Feature.md', { frontmatter: { type: 'Feature', order: 5 } });
		vault.addFile('Story.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Loose Feature' });
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });

		rowByTitle(containerEl, 'Story').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Outdent')?.click();
		await flush();

		const fm = vault.fm('Story.md');
		expect('parent' in fm).toBe(false);
		// Midpoint between the REAL roots Loose Feature (5) and Epic (100)
		expect(fm['order']).toBe(52.5);
	});
});

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

describe('quick filter', () => {
	function filterInput(containerEl: HTMLElement): HTMLInputElement {
		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		if (!input) throw new Error('filter input missing');
		return input;
	}
	function setFilterText(containerEl: HTMLElement, text: string): void {
		const input = filterInput(containerEl);
		input.value = text;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	it('shows matches with their ancestors and subtrees', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'B1');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1']);
		// aria positions describe the rendered set, not the full sibling group
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-posinset')).toBe('1');
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-setsize')).toBe('1');

		setFilterText(containerEl, 'Epic B');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1', 'Feature B2']);

		setFilterText(containerEl, '');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('overrides collapsed state while active and restores it after', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		setFilterText(containerEl, 'B1');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1']);

		setFilterText(containerEl, '');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('disables dragging while filtering', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'Epic');
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(false);
		setFilterText(containerEl, '');
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(true);
	});

	it('treats a whitespace-only filter as no filter', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		setFilterText(containerEl, '   ');
		// Nothing is narrowed, so nothing pauses: full tree, dragging, collapsing
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(false);
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(true);
		expect(containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent).toBe('4 items');

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
	});

	it('keeps keyboard navigation within the filtered rows', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B1');
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: false }]);
	});

	it('shows a no-match message and clears with Escape', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'zzz');
		expect(containerEl.querySelector('.pbl-empty-filter')?.textContent).toContain('No items match "zzz"');
		expect(titlesOf(containerEl)).toEqual([]);

		filterInput(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(filterInput(containerEl).value).toBe('');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('clears the filter from the no-match state button and refocuses the input', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'zzz');
		containerEl
			.querySelector<HTMLElement>('.pbl-empty-filter button')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// The toolbar input is synced and refocused for the next search
		expect(filterInput(containerEl).value).toBe('');
		expect(document.activeElement).toBe(filterInput(containerEl));
	});

	it('clears the filter with Escape from the tree, then the selection', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B1');
		key(tree, 'ArrowDown'); // select Epic B within the filtered rows
		key(tree, 'Escape');
		expect(filterInput(containerEl).value).toBe('');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// The selection survives the filter clear; a second Escape drops it
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		// With nothing left to back out of, Escape is inert
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
	});

	it('focuses the filter input from the tree with "/"', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		// A modified "/" may belong to an app hotkey — leave it alone
		key(treeOf(containerEl), '/', { ctrlKey: true });
		expect(document.activeElement).not.toBe(filterInput(containerEl));

		key(treeOf(containerEl), '/');
		expect(document.activeElement).toBe(filterInput(containerEl));
	});

	it('keeps the input focused while filtering re-renders the tree', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const input = filterInput(containerEl);

		input.focus();
		setFilterText(containerEl, 'B');
		expect(document.activeElement).toBe(input);
	});

	it('highlights the matching part of titles', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'b1');
		expect(rowByTitle(containerEl, 'Feature B1').querySelector('.pbl-match')?.textContent).toBe('B1');
		// Ancestors shown for context only are not falsely highlighted
		expect(rowByTitle(containerEl, 'Epic B').querySelector('.pbl-match')).toBeNull();

		setFilterText(containerEl, '');
		expect(rowByTitle(containerEl, 'Feature B1').querySelector('.pbl-match')).toBeNull();
	});

	it('pauses collapse controls and drag affordances while filtering', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);
		// The CSS hooks that gray out the collapse controls and hide the grips
		expect(containerEl.querySelectorAll('.pbl-collapse-ctl')).toHaveLength(2);

		setFilterText(containerEl, 'B');
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(true);
		const writesBefore = config.setCalls.length;
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.length).toBe(writesBefore);

		setFilterText(containerEl, '');
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(false);
	});

	it('jumps to the first visible child when expanding under a filter', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B2'); // Epic B visible via Feature B2; Feature B1 hidden
		key(tree, 'ArrowDown'); // Epic B
		key(tree, 'ArrowRight');

		expect(rowByTitle(containerEl, 'Feature B2').classList.contains('pbl-selected')).toBe(true);
	});

	it('shows a clear button while active and clears on click', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const box = containerEl.querySelector<HTMLElement>('.pbl-filter');

		expect(box?.classList.contains('pbl-filter-active')).toBe(false);
		setFilterText(containerEl, 'B1');
		expect(box?.classList.contains('pbl-filter-active')).toBe(true);

		containerEl.querySelector<HTMLElement>('.pbl-filter-clear')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(filterInput(containerEl).value).toBe('');
		expect(box?.classList.contains('pbl-filter-active')).toBe(false);
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('shows filtered counts as "x of N"', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const label = () => containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent;

		expect(label()).toBe('4 items');
		setFilterText(containerEl, 'B1');
		expect(label()).toBe('2 of 4');
		setFilterText(containerEl, '');
		expect(label()).toBe('4 items');
	});
});

describe('grouping advisory', () => {
	it('flags a configured group-by as having no effect', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();

		(view as unknown as { data: unknown }).data = {
			data: vault.entries(),
			groupedData: [{ hasKey: () => true, entries: [] }],
		};
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-grouping-note')?.textContent).toBe('Grouping ignored');
	});

	it('stays quiet for the implicit single ungrouped group', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		(view as unknown as { data: unknown }).data = {
			data: vault.entries(),
			groupedData: [{ hasKey: () => false, entries: [] }],
		};
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();
	});
});

describe('toolbar count breakdown', () => {
	it('summarizes items per level in the count tooltip', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');

		expect(count?.textContent).toBe('4 items');
		expect(count?.dataset.tooltip).toBe('2 Epic · 2 Feature');
		// Filter changes to the count are announced to assistive tech
		expect(count?.getAttribute('aria-live')).toBe('polite');
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

	it('drops values that render empty, keeping the column', () => {
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
		expect(epicB.querySelector('.pbl-prop')).toBeNull();
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

describe('completed items', () => {
	/** Three top-level branches: done-with-open-child, fully done, open — plus a done leaf. */
	function completedFixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic X.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('F open.md', { frontmatter: { order: 10, status: 'Open' }, parentLink: 'Epic X' });
		vault.addFile('Epic Y.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('F done.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic Y' });
		vault.addFile('Epic Z.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		vault.addFile('Leaf D.md', { frontmatter: { type: 'Epic', order: 40, status: 'Done' } });
		return vault;
	}

	// A factory: config.set() mutates the values object it was handed, so a
	// shared literal would leak one test's toggle into the next.
	const hiddenConfig = () => ({ stateProperty: 'note.status', showCompleted: false });

	it('hides fully done subtrees but keeps done parents with open children', () => {
		const { containerEl } = makeView(completedFixture(), hiddenConfig());

		expect(titlesOf(containerEl)).toEqual(['Epic X', 'F open', 'Epic Z']);
		// Visible siblings renumber the accessible positions.
		expect(rowByTitle(containerEl, 'Epic X').getAttribute('aria-setsize')).toBe('2');
		expect(rowByTitle(containerEl, 'Epic Z').getAttribute('aria-posinset')).toBe('2');
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('3 of 6');

		const toggle = containerEl.querySelector<HTMLElement>('.pbl-completed-toggle');
		expect(toggle?.classList.contains('is-active')).toBe(true);
		expect(toggle?.getAttribute('aria-label')).toBe('Show completed items (3 hidden)');
	});

	it('renders a parent whose children are all hidden as a leaf with its rollup', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('F1.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { order: 20, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, hiddenConfig());

		const epic = rowByTitle(containerEl, 'Epic');
		expect(titlesOf(containerEl)).toEqual(['Epic']);
		expect(epic.getAttribute('aria-expanded')).toBeNull();
		expect(epic.querySelector('.pbl-chevron')?.classList.contains('pbl-leaf')).toBe(true);
		// The rollup still counts the hidden children.
		expect(epic.querySelector('.pbl-progress-label')?.textContent).toBe('2/2');
	});

	it('suspends hiding while the quick filter is active', () => {
		const { view, containerEl } = makeView(completedFixture(), hiddenConfig());

		view.setFilter('F done');
		expect(titlesOf(containerEl)).toEqual(['Epic Y', 'F done']);
		view.setFilter('');
		expect(titlesOf(containerEl)).toEqual(['Epic X', 'F open', 'Epic Z']);
	});

	it('toggles the option from the toolbar eye button', () => {
		const shown = makeView(completedFixture(), { stateProperty: 'note.status' });
		shown.containerEl.querySelector<HTMLElement>('.pbl-completed-toggle')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shown.config.setCalls).toContainEqual({ key: 'showCompleted', value: false });

		const hidden = makeView(completedFixture(), hiddenConfig());
		hidden.containerEl.querySelector<HTMLElement>('.pbl-completed-toggle')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(hidden.config.setCalls).toContainEqual({ key: 'showCompleted', value: true });
	});

	it('moves and navigates across hidden siblings to the next visible one', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('H.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		const { containerEl } = makeView(vault, hiddenConfig());

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'A').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		// A lands after B, the next visible sibling — past the hidden H.
		expect(vault.fm('A.md').order).toBe(40);
	});

	it('omits move commands that could only swap with hidden rows', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('H.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		const { containerEl } = makeView(vault, hiddenConfig());

		rowByTitle(containerEl, 'B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		expect(menu?.item('Move down')).toBeUndefined();
		expect(menu?.item('Move to bottom')).toBeUndefined();
		// The visible predecessor is A — the hidden H is never named.
		expect(menu?.item('Indent under "A"')).toBeDefined();
	});

	it('treats a parent with only hidden children as a leaf for keyboard expansion', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('F1.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl, config } = makeView(vault, hiddenConfig());

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowLeft');
		key(tree, 'ArrowRight');

		// No invisible collapse state is written or persisted for the apparent leaf.
		expect(config.setCalls.filter((c) => c.key === 'collapsedItems')).toHaveLength(0);
		expect(rowByTitle(containerEl, 'Epic').classList.contains('pbl-selected')).toBe(true);
	});

	it('shows the all-done state with a way back when everything hides', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Closed' } });
		const { containerEl, config } = makeView(vault, hiddenConfig());

		const empty = containerEl.querySelector('.pbl-empty-filter');
		expect(empty?.textContent).toContain('All 2 items are done and hidden.');
		empty?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls).toContainEqual({ key: 'showCompleted', value: true });
	});
});

describe('hierarchy scope', () => {
	/** A backlog folder that also holds ordinary notes, as `file.inFolder()` returns it. */
	function mixedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Sprint notes.md');
		vault.addFile('Backlog/README.md');
		return vault;
	}

	it('renders only the work items and says how many notes it skipped', () => {
		const { containerEl } = makeView(mixedVault());

		expect(titlesOf(containerEl)).toEqual(['Epic A']);
		const note = containerEl.querySelector('.pbl-ignored-note');
		expect(note?.textContent).toBe('2 notes ignored');
		// The tooltip has to name the option that brings them back
		expect((note as HTMLElement).dataset.tooltip).toContain('Ignore notes outside the hierarchy');
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('renders every note and no advisory when the option is off', () => {
		const { containerEl } = makeView(mixedVault(), { hierarchyOnly: false });

		expect(titlesOf(containerEl).sort()).toEqual(['Epic A', 'README', 'Sprint notes']);
		expect(containerEl.querySelector('.pbl-ignored-note')).toBeNull();
	});

	it('explains an empty view caused by the scope', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Sprint notes.md');
		const { containerEl } = makeView(vault);

		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('1 note in this base has no supported type and no parent');
		expect(hint).toContain('Ignore notes outside the hierarchy');
	});

	it('keeps the generic hint when the base is simply empty', () => {
		const { containerEl } = makeView(new FakeVault());
		expect(containerEl.querySelector('.pbl-empty-hint')?.textContent).toContain("Point this base's filter");
	});
});

describe('row columns', () => {
	function statedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('A very long feature title indeed.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic',
		});
		vault.addFile('Short.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		return vault;
	}

	it('puts the state chip in a column of its own, after the flexible spacer', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' });

		for (const row of rows(containerEl)) {
			const col = row.querySelector('.pbl-state-col');
			expect(col).not.toBeNull();
			expect(col?.querySelector('.pbl-state-chip')).not.toBeNull();
			// The spacer absorbs the free space, so the column lands at a fixed offset
			expect(col?.previousElementSibling?.classList.contains('pbl-row-spacer')).toBe(true);
		}
	});

	it('gives every row a rollup column, even leaves, so the columns line up', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' });

		const epic = rowByTitle(containerEl, 'Epic');
		const leaf = rowByTitle(containerEl, 'Short');
		expect(epic.querySelector('.pbl-meta-col .pbl-progress-label')?.textContent).toBe('1/2');
		expect(leaf.querySelector('.pbl-meta-col')).not.toBeNull();
		expect(leaf.querySelector('.pbl-progress')).toBeNull();
		expect(epic.querySelector('.pbl-state-col')?.nextElementSibling).toBe(epic.querySelector('.pbl-meta-col'));
	});

	it('drops both columns when neither states nor counts are configured', () => {
		const { containerEl } = makeView(statedVault(), { showCounts: false });
		const epic = rowByTitle(containerEl, 'Epic');
		expect(epic.querySelector('.pbl-state-col')).toBeNull();
		expect(epic.querySelector('.pbl-meta-col')).toBeNull();
	});
});

describe('targeted subtree rendering', () => {
	it('collapses and expands without rebuilding the rest of the tree', () => {
		const { containerEl } = makeView(fixture());
		const epicA = rowByTitle(containerEl, 'Epic A');
		const epicB = rowByTitle(containerEl, 'Epic B');
		const chevron = epicB.querySelector<HTMLElement>('.pbl-chevron');

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(epicB.getAttribute('aria-expanded')).toBe('false');
		expect(chevron?.classList.contains('pbl-expanded')).toBe(false);
		// Untouched rows keep their identity — the tree was not rebuilt
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
		expect(rowByTitle(containerEl, 'Epic B')).toBe(epicB);

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(epicB.getAttribute('aria-expanded')).toBe('true');
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
	});

	it('keeps re-expanded children fully interactive', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// A rebuilt child row must still open, drag and rank like any other
		const b2 = rowByTitle(containerEl, 'Feature B2');
		b2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B2.md']);

		drag(b2, rowByTitle(containerEl, 'Feature B1'), 'before');
		await flush();
		// Ranked ahead of Feature B1 (order 10), a full spacing below it
		expect(vault.fm('Feature B2.md').order).toBe(0);
	});

	it('drops the collapsed subtree from the selection index', () => {
		const { view, containerEl } = makeView(fixture());
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Feature B1.md') as never);
		expect(tree.getAttribute('aria-activedescendant')).not.toBeNull();

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The selected row is gone; nothing may point at a detached element
		expect(tree.getAttribute('aria-activedescendant')).toBeNull();
	});
});

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

describe('moves in a group that holds an outside-filter row', () => {
	/** Epic E over Feature A (context, because its PBI matched) and Feature B (a result). */
	function mixedView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => ['Feature B.md', 'PBI.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('offers no move commands on a result whose siblings include a context row', () => {
		const { containerEl } = mixedView();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Move down');
		expect(titles).not.toContain('Move to top');
	});

	it('offers no outdent when it would rank against a context parent', () => {
		const { containerEl } = mixedView();

		rowByTitle(containerEl, 'PBI').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		// Its parent Feature A is context, so outdenting would renumber that group
		expect(titles).not.toContain('Outdent');
	});

	it('writes nothing when Alt+arrow targets such a group', async () => {
		const { view, containerEl, vault } = mixedView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Feature B.md') as never);

		key(tree, 'ArrowUp', { altKey: true });
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});

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

describe('new-item folder inference with context rows', () => {
	it('ignores ancestors that live outside the filtered folder', () => {
		const vault = new FakeVault();
		// A deep chain of ancestors elsewhere would outvote the two real results
		vault.addFile('Elsewhere/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Elsewhere/Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Elsewhere/Sub.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		vault.addFile('Backlog/A.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		vault.addFile('Backlog/B.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => e.file.path.startsWith('Backlog/')),
		};
		view.onDataUpdated();

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Three context ancestors in Elsewhere/ must not outvote two results in Backlog/
		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Elsewhere');
	});
});

describe('creating a child under a context parent', () => {
	/** Folder mode, a base scoped to Backlog/, and a parent living outside it. */
	function outsideParentView() {
		const vault = new FakeVault();
		vault.addFile('Projects/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Backlog/PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true });
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'Backlog/PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('keeps the new note in the results folder, not beside the excluded parent', () => {
		const { containerEl } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('Under "Epic"');
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Projects');
	});

	it('still writes the parent link, so the hierarchy survives the different folder', async () => {
		const { containerEl, vault } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'New work' });
		await flush();

		expect(vault.fm('Backlog/New work.md')['parent']).toBe('[[Epic]]');
	});

	it('still puts children beside a parent that is a real result', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true });
		anyView.data = { data: vault.entries() };
		view.onDataUpdated();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog/Epic"');
	});
});

describe('move commands that do not rank', () => {
	/** Epic over Feature A (context, its PBI matched) and Feature B (a result). */
	function mixedSiblings() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => ['Feature B.md', 'PBI.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('still offers indent, which appends instead of ranking', () => {
		const { containerEl } = mixedSiblings();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		// Reordering stays out, but indenting under the previous sibling is safe
		expect(titles).not.toContain('Move up');
		expect(titles).toContain('Indent under "Feature A"');
	});

	it('indents into a mixed group without writing to the context row', async () => {
		const { containerEl, vault } = mixedSiblings();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.items.find((i) => i.titleText.startsWith('Indent'))?.clickHandler?.();
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['Feature B.md']);
		expect(vault.fm('Feature B.md').parent).toBe('[[Feature A]]');
	});
});

describe('write safety with context rows, across every entry point', () => {
	/**
	 * Context rows in all three structural positions: above a result (Epic), beside
	 * one (Feature A next to Feature B), and between two (Mid, whose parent Feature B
	 * and child Task are both results). Nine review findings were each one surface of
	 * "a context note got written to"; this asserts the rule itself rather than a
	 * surface, so a new write path fails here without anyone having predicted it.
	 */
	const CONTEXT_PATHS = ['Epic.md', 'Feature A.md', 'Mid.md'];

	function stressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active', tags: ['ctx'] } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10, tags: ['ctx'] }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20, tags: ['a'] }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'New' }, parentLink: 'Feature A' });
		// The context row in the middle is done and the result below it is not, so
		// counting either one in a rollup would show up as a wrong number.
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', tags: ['ctx'] }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });

		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig({ stateProperty: 'note.status' });
		// The tag column is a write surface too — drive it like every other one.
		config.order = ['note.tags'];
		anyView.config = config;
		anyView.data = {
			data: vault.entries().filter((e) => !CONTEXT_PATHS.includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	/** Fire every menu command on a row, including the ones nested in submenus. */
	async function triggerEveryCommand(row: HTMLElement): Promise<void> {
		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		for (const item of Menu.lastShown?.items ?? []) {
			item.clickHandler?.();
			await flush();
			for (const sub of item.submenu?.items ?? []) {
				sub.clickHandler?.();
				await flush();
			}
		}
	}

	it('puts context rows in all three structural positions', () => {
		const { view } = stressView();
		const at = (p: string) => view.model?.byPath.get(p);
		expect(at('Epic.md')?.outsideFilter).toBe(true);
		// Beside a result
		expect(at('Feature A.md')?.outsideFilter).toBe(true);
		expect(at('Feature B.md')?.outsideFilter).toBe(false);
		// Between two results
		expect(at('Mid.md')?.outsideFilter).toBe(true);
		expect(at('Mid.md')?.parent?.file.path).toBe('Feature B.md');
		expect(at('Task.md')?.outsideFilter).toBe(false);
	});

	it('never writes to one, whatever is done to any row', async () => {
		const { containerEl, vault } = stressView();
		const allRows = rows(containerEl);
		expect(allRows).toHaveLength(6);

		// Every drag of every row onto every other row, in all three zones
		for (const from of allRows) {
			for (const to of allRows) {
				if (from === to) continue;
				for (const zone of ['before', 'after', 'inside'] as const) {
					drag(from, to, zone);
					await flush();
				}
			}
		}
		// The "move to top level" strip
		for (const from of allRows) {
			from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
			const strip = containerEl.querySelector<HTMLElement>('.pbl-root-drop');
			strip?.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
			strip?.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
			await flush();
		}
		// Every context-menu command, every state chip, every structural shortcut
		const tree = treeOf(containerEl);
		for (const row of allRows) {
			await triggerEveryCommand(row);
			row.querySelector<HTMLElement>('.pbl-state-chip')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const state of Menu.lastShown?.items ?? []) {
				state.clickHandler?.();
				await flush();
			}
			// Every tag control on the row: the add menu and each remove button
			row.querySelector<HTMLElement>('.pbl-tag-add')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const tag of Menu.lastShown?.items ?? []) {
				tag.clickHandler?.();
				await flush();
			}
			for (const remove of row.querySelectorAll<HTMLElement>('.pbl-tag-remove')) {
				remove.dispatchEvent(new MouseEvent('click', { bubbles: true }));
				await flush();
			}
			row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const key_ of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
				key(tree, key_, { altKey: true });
				await flush();
			}
		}
		// And the backfill, which walks the whole real tree
		containerEl
			.querySelectorAll<HTMLElement>('.pbl-icon-btn')[0]
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched.filter((p) => CONTEXT_PATHS.includes(p))).toEqual([]);
		// Not vacuous: the result rows really were written to along the way
		expect(touched.length).toBeGreaterThan(0);
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

describe('toolbar figures describe the Base results', () => {
	function filteredWithState(showCompleted = true) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 20, status: 'New' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status', showCompleted });
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl };
	}

	it('breaks down levels without the context ancestor', () => {
		const { containerEl } = filteredWithState();
		const tooltip = containerEl.querySelector<HTMLElement>('.pbl-count-label')?.dataset.tooltip;

		// The Epic is scaffolding, not one of this base's two PBIs
		expect(tooltip).toBe('2 PBI');
	});

	it('counts only results as hidden in the completed toggle', () => {
		const { containerEl } = filteredWithState(false);
		const label = containerEl.querySelector('.pbl-completed-toggle')?.getAttribute('aria-label');

		expect(label).toBe('Show completed items (1 hidden)');
	});
});

describe('rollups describe the Base results only', () => {
	/** Reuses the stress fixture: context rows above, beside and between results. */
	interface Node {
		children: Node[];
		outsideFilter: boolean;
		done: boolean;
		descendantCount: number;
		doneDescendants: number;
	}

	it('never counts a context row, anywhere in the tree', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'New' }, parentLink: 'Feature A' });
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status' });
		anyView.data = {
			data: vault.entries().filter((e) => !['Epic.md', 'Feature A.md', 'Mid.md'].includes(e.file.path)),
		};
		view.onDataUpdated();

		// Stated from the rule, not from the implementation: a rollup counts the
		// results below an item, and nothing else.
		const results = (item: Node): number =>
			item.children.reduce((n, c) => n + (c.outsideFilter ? 0 : 1) + results(c), 0);
		const doneResults = (item: Node): number =>
			item.children.reduce((n, c) => n + (!c.outsideFilter && c.done ? 1 : 0) + doneResults(c), 0);

		const items = (view.model?.items ?? []) as unknown as Node[];
		expect(items.length).toBe(6);
		for (const item of items) {
			expect(item.descendantCount).toBe(results(item));
			expect(item.doneDescendants).toBe(doneResults(item));
		}
		// Not vacuous: the done context row and the open result under it are both there
		const featureB = view.model?.byPath.get('Feature B.md');
		expect(featureB?.descendantCount).toBe(1);
		expect(featureB?.doneDescendants).toBe(0);
	});
});
