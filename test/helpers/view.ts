import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { ProductBacklogView } from '../../src/view/backlogView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig } from './vault';
import { FileView, Menu, Modal, Notice } from './obsidian-mock';

installObsidianDom();

export interface Harness {
	view: ProductBacklogView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * Register the per-test reset every view suite needs. Called once at the top of each
 * file rather than run from this module's body, so a suite that imports a helper is
 * never surprised by a hook it did not ask for.
 */
export function useViewHarness(): void {
	beforeEach(() => {
		document.body.empty();
		// The board's live region is a module-level singleton in the drag library, so
		// emptying the body detaches it without the library knowing: it would keep
		// writing announcements into a node no test can find, and the first one to
		// look would read the previous test's move. Dropping it makes the next
		// announcement build a fresh one.
		liveRegionCleanup();
		Notice.reset();
		Menu.lastShown = null;
		Menu.lastPosition = null;
		Modal.lastOpened = null;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});
}

/**
 * The tree opens collapsed, which would hide the rows most tests are about, so the
 * harness expands it through the real toolbar control. Pass `collapsed` to assert on
 * the opening state itself.
 */
export function makeView(
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

export function expandAll(containerEl: HTMLElement): void {
	const btn = containerEl.querySelector<HTMLElement>('.pbl-collapse-ctl[aria-label="Expand all"]');
	if (!btn) throw new Error('expand all button not rendered');
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** Hand the view a fresh result set, the way Bases does after a vault change. */
export function refresh(view: ProductBacklogView, vault: FakeVault): void {
	(view as unknown as Record<string, unknown>).data = { data: vault.entries() };
	view.onDataUpdated();
}

export function rows(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row'));
}

export function titlesOf(containerEl: HTMLElement): string[] {
	return rows(containerEl).map((r) => r.querySelector('.pbl-title')?.textContent ?? '');
}

export function rowByTitle(containerEl: HTMLElement, title: string): HTMLElement {
	const row = rows(containerEl).find((r) => r.querySelector('.pbl-title')?.textContent === title);
	if (!row) throw new Error(`row not found: ${title}`);
	return row;
}

export function treeOf(containerEl: HTMLElement): HTMLElement {
	const tree = containerEl.querySelector<HTMLElement>('.pbl-tree');
	if (!tree) throw new Error('tree not rendered');
	return tree;
}

/** One position of the toolbar's projection toggle, found by its accessible name. */
export function projectionButton(containerEl: HTMLElement, label: string): HTMLButtonElement {
	const btn = containerEl.querySelector<HTMLButtonElement>(`.pbl-mode-btn[aria-label="${label}"]`);
	if (!btn) throw new Error(`projection button not found: ${label}`);
	return btn;
}

/** Wait for the async frontmatter writes queued by an interaction. */
export function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export function stubRect(row: HTMLElement): void {
	row.getBoundingClientRect = () =>
		({ top: 0, bottom: 30, height: 30, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

export function drag(from: HTMLElement, to: HTMLElement, zone: 'before' | 'after' | 'inside'): void {
	stubRect(to);
	from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
	const clientY = zone === 'before' ? 3 : zone === 'after' ? 28 : 15;
	to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY }));
	to.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY }));
}

export function key(tree: HTMLElement, keyName: string, modifiers: Partial<KeyboardEventInit> = {}): void {
	tree.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, ...modifiers }));
}

/** Two epics; the second has two features. */
export function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

/** Fill the currently open prompt and submit it. */
export function submitPrompt(fields: { title: string; folder?: string }): void {
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
