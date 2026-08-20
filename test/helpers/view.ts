import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { ProductBacklogView } from '../../src/view/backlogView';
import { OPTIONAL_PROPERTIES } from '../../src/domain/optionalProperties';
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
 *
 * `focus`, `folds` and `widths` are options rather than config values because none of
 * them is one: all three are working position, set through the view and stored in the
 * view state.
 */
export function makeView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{
		collapsed = false,
		base,
		viewName,
		focus,
		folds,
		widths,
		only,
		order,
	}: {
		collapsed?: boolean;
		base?: string;
		viewName?: string;
		focus?: string;
		folds?: boolean;
		/** Property-column widths in pixels, by Bases property id — one `setColWidth` each. */
		widths?: Record<string, number>;
		only?: string[];
		order?: string[];
	} = {},
): Harness {
	// Bases mounts the view inside the leaf showing the .base file; that leaf is how
	// the view identifies which base it is, so persistence tests need the real nesting.
	const leafEl = document.body.createDiv();
	const containerEl = leafEl.createDiv();
	if (base) vault.addLeaf(new FileView(vault.addFile(base), leafEl));
	const view = new ProductBacklogView({} as never, containerEl);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	// The Bases properties menu decides which properties are columns, chips included, so
	// a suite about a chip has to make its property visible. Set before the first data
	// update, which is where the columns are resolved; a test about the RESOLUTION itself
	// assigns `config.order` afterwards and renders again instead.
	if (order) config.order = order;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	// `only` narrows what the BASE returns, so everything else in the vault loads as a
	// context row — the shape a filtered base has, without hand-building a view for it.
	anyView.data = { data: only ? vault.entries().filter((e) => only.includes(e.file.path)) : vault.entries() };
	view.onDataUpdated();
	if (focus) view.setFocusLevel(focus);
	if (folds) view.setClickFolds(true);
	for (const [prop, px] of Object.entries(widths ?? {})) view.setColWidth(prop, px);
	if (!collapsed) clickExpandAll(containerEl);
	return { view, config, containerEl };
}

/**
 * View options with every optional property explicitly CLEARED, merged over whatever
 * the test sets itself. A view built from `{}` has none of them named, so the backfill
 * would bind every one of them and stub a key on every note — which is the point of that action
 * and pure noise in a test about anything else. Clearing is how a user says "not this
 * one", so a suite that says it here is describing a settled view, not disabling a rule.
 */
export function noOptionalProperties(values: Record<string, unknown> = {}): Record<string, unknown> {
	const cleared: Record<string, unknown> = {};
	for (const property of OPTIONAL_PROPERTIES) cleared[property.option] = '';
	return { ...cleared, ...values };
}

export function clickExpandAll(containerEl: HTMLElement): void {
	// By CLASS, never by the label: the label comes from the catalog now, so a suite
	// driving the toolbar under a fixture catalog would find nothing here.
	const btn = containerEl.querySelector<HTMLElement>('.pbl-expand-ctl');
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

/**
 * Drive a keyed toolbar menu button the way a user does: open it, then run the entry
 * with that title. The projection zone's pickers are menus rather than segmented
 * positions, so a suite that used to click one button now takes two steps.
 */
export function pickFromToolbarMenu(containerEl: HTMLElement, key: string, title: string): void {
	const btn = containerEl.querySelector<HTMLButtonElement>(`[data-pbl-key="${key}"]`);
	if (!btn) throw new Error(`no toolbar control keyed ${key}`);
	btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	const item = Menu.lastShown?.item(title);
	if (!item) throw new Error(`no entry titled ${title} in the ${key} menu`);
	item.click();
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

/** Dispatch a keydown, returning the event so a test can ask whether it was consumed. */
export function key(tree: HTMLElement, keyName: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
	const evt = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...modifiers });
	tree.dispatchEvent(evt);
	return evt;
}

/**
 * Two epics; the second has two features. `empty` returns a vault with nothing in it —
 * `renderEmptyState`'s own case. `allDone` returns two epics already at a shipped done
 * value, the shape `renderAllDoneState` needs — pair it with `showCompleted: false` in
 * the view options, since the default is `true` and nothing would be hidden otherwise.
 */
export function fixture(opts: { empty?: boolean; allDone?: boolean } = {}): FakeVault {
	const vault = new FakeVault();
	if (opts.empty) return vault;
	if (opts.allDone) {
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Closed' } });
		return vault;
	}
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

/**
 * The button that submits the currently open prompt — never the first `<button>` in it,
 * since the manual's point-of-need door (`.pbl-help-link`) now renders ahead of it on
 * the new-item prompt.
 */
export function submitButton(modal: Modal): HTMLButtonElement | undefined {
	return Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>('button')).find(
		(btn) => !btn.hasClass('pbl-help-link'),
	);
}

/** The date fields of the open schedule prompt, in the order it asks for them. */
export function scheduleInputs(): HTMLInputElement[] {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('schedule prompt not opened');
	return Array.from(modal.contentEl.querySelectorAll('input'));
}

/** A button of the open prompt, by its label — the clear buttons sit beside the fields. */
export function promptButton(label: string): HTMLElement {
	const modal = Modal.lastOpened;
	const found = Array.from(modal?.contentEl.querySelectorAll('button') ?? []).find(
		(btn) => btn.textContent === label || btn.getAttribute('aria-label') === label,
	);
	if (!found) throw new Error(`no prompt button ${label}`);
	return found;
}

/** Fill the open schedule prompt (start, then target) and press Save. */
export function submitSchedule(values: string[]): void {
	const inputs = scheduleInputs();
	values.forEach((value, i) => {
		inputs[i].value = value;
		inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
	});
	promptButton('Save').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}
