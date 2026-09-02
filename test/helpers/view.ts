import { readFileSync } from 'node:fs';
import type { Plugin } from 'obsidian';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { ProductBacklogView } from '../../src/view/backlogView';
import { BacklogItem } from '../../src/domain/model';
import { WriteLock } from '../../src/view/writeLock';
import { OPTIONAL_PROPERTIES } from '../../src/domain/optionalProperties';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf, mountView, setResults } from './vault';
import { Menu, Modal, Notice } from './obsidian-mock';
import { fakeController } from '../helpers/vault';
import { resetLocale } from './locale';

installObsidianDom();

export interface Harness {
	view: ProductBacklogView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * A `registerBasesView`-compatible plugin double that records every registration by
 * type — `registerBacklogView.test.ts`'s and the estimation view's own register test's
 * identical three lines, generic over each suite's own `BasesViewRegistration`-shaped
 * spec so neither loses its typing to a shared `unknown`.
 *
 * The double is widened to `Plugin` HERE, once, rather than cast at each `register…View`
 * call: the registration functions take the real type, and a cast at the call site is a
 * hole in the typecheck at every one of them.
 */
export function captureRegistrations<Spec>(): {
	plugin: Plugin & { registerBasesView: (type: string, spec: Spec) => void };
	specs: Map<string, Spec>;
} {
	const specs = new Map<string, Spec>();
	const plugin = { registerBasesView: (type: string, spec: Spec) => specs.set(type, spec) };
	return { plugin: plugin as typeof plugin & Plugin, specs };
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
		// Explicitly, never inherited: locale resolution is module state, so a test that
		// drove `setLocale` itself would otherwise leave the next one reading its catalog.
		resetLocale();
		Notice.reset();
		Menu.forget();
		Modal.forget();
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
 * `focus`, `folds`, `hideCompleted` and `widths` are options rather than config values
 * because none of them is one: all four are working position, set through the view and
 * stored in the view state.
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
		hideCompleted,
		widths,
		only,
		except,
		order,
		lock,
	}: {
		collapsed?: boolean;
		base?: string;
		viewName?: string;
		focus?: string;
		folds?: boolean;
		/** Turn the toolbar's completed-items eye off — view state now, never a config value. */
		hideCompleted?: boolean;
		/** Property-column widths in pixels, by Bases property id — one `setColWidth` each. */
		widths?: Record<string, number>;
		only?: string[];
		/**
		 * The other way to say which notes the Base returned: everything in the vault
		 * except these. A context-row fixture is nearly always written this way — one
		 * ancestor is cut and the rest are results — and spelling that as `only` means
		 * re-listing every note, which is a list that goes stale the next time the
		 * fixture gains one.
		 */
		except?: string[];
		order?: string[];
		/** The plugin-wide write lock to share with another view; a fresh one by default. */
		lock?: WriteLock;
	} = {},
): Harness {
	// Bases mounts the view inside the leaf showing the .base file; that leaf is how
	// the view identifies which base it is, so persistence tests need the real nesting.
	const containerEl = mountLeaf(vault, base);
	const view = new ProductBacklogView(fakeController(), containerEl, lock);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	// The Bases properties menu decides which properties are columns, chips included, so
	// a suite about a chip has to make its property visible. Set before the first data
	// update, which is where the columns are resolved; a test about the RESOLUTION itself
	// assigns `config.order` afterwards and renders again instead.
	if (order) config.order = order;
	// `only` and `except` narrow what the BASE returns, so everything else in the vault
	// loads as a context row — the shape a filtered base has, without hand-building a
	// view for it.
	mountView(
		view,
		vault,
		config,
		vault
			.entries()
			.filter((e) => (!only || only.includes(e.file.path)) && !except?.includes(e.file.path)),
	);
	if (focus) view.setFocusLevel(focus);
	if (folds) view.setClickFolds(true);
	if (hideCompleted) view.setShowCompleted(false);
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

/** Hand the view everything the vault now holds, the way Bases does after a change. */
export function refresh(view: ProductBacklogView, vault: FakeVault): void {
	setResults(view, vault.entries());
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

export function toolbarOf(containerEl: HTMLElement): HTMLElement {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
}

/**
 * The SHIPPED rules, in the document, so a question about what a fit step hides is asked
 * of the stylesheet rather than of a copy of it. jsdom applies no stylesheet of its own
 * but it does parse one it is given — `:not()` chains included — so
 * `getComputedStyle(el).display` becomes a real answer, which is what `refocusShedControl`
 * reads.
 *
 * EVERY partial that writes a rule those questions read, in the order `styles/index.css`
 * declares them, and that is not tidiness. The `⋯` is `display: none` by DEFAULT — that
 * rule is in `toolbar.css` — and `toolbarFit.css` only turns it ON from step 2. Loading
 * the fit partial alone left it reading as visible at step 0, which is precisely the state
 * the relaxing-direction test is about, so the test would have asked its question of a
 * document where the answer could not be wrong.
 *
 * `busy.css` is here for the same reason, found the same way: `.pbl-busy` is
 * `display: none` until a batch runs, that rule lives in the partial the indicator moved
 * to at the 400-line cap, and without it the indicator read as VISIBLE at every rung — so
 * the assertion that a rung sheds it was passing against a document where it had never
 * been hidden by anything.
 *
 * **One list rather than a copy per file**, and that is the whole reason it is here: a
 * short list is what both defects above look like, and a second copy is a second chance to
 * be short in. Call it in `head` at module scope, once — `useViewHarness` empties the BODY
 * between tests, never the head.
 */
export function loadToolbarStyles(): void {
	for (const partial of ['styles/toolbar.css', 'styles/toolbarFit.css', 'styles/busy.css']) {
		document.head.createEl('style', { text: readFileSync(partial, 'utf8') });
	}
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
		({ top: 0, bottom: 30, height: 30, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) });
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
 * value, the shape `renderAllDoneState` needs — pair it with `hideCompleted` in the view
 * OPTIONS, since the toggle defaults to showing and nothing would be hidden otherwise.
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

/** The model's item at that path — the lookup every release suite starts from. */
export function itemAt(view: ProductBacklogView, path: string): BacklogItem {
	const item = view.model?.byPath.get(path);
	if (!item) throw new Error(`no item loaded: ${path}`);
	return item;
}

/**
 * A PBI (`F.md`), the releases it may be put in, and one note of every kind that may NOT
 * hold a release: the two other markers and a catalog pair.
 *
 * Shared by `releaseMove.test.ts` (the host method) and `releaseMenu.test.ts` (its two
 * inputs) rather than copied into each — the menu suite needs exactly the vault the move
 * suite already built, and two copies of a fixture are one edit from being two fixtures.
 *
 * `exclude` loads that note as a CONTEXT row rather than a result: a child names it as a
 * parent, so `loadOutsideParents` keeps it in the model while the base has cut it — the
 * shape `contextCardWrites.test.ts`'s own fixtures use.
 */
export function makeViewWithReleases({
	exclude,
	memberOf = {},
	releaseProperty = 'note.release',
	releases = ['2.4.md', '2.5.md'],
}: {
	exclude?: string;
	/**
	 * Note path → the release note it already names, written as the link a vault holds.
	 * An empty string is the BLANK stub ✨ Assign missing properties leaves behind: the
	 * key is present and names nothing, which is a different note from one with no key.
	 * A LIST is the hand-edited multi-valued membership: legal YAML, refused as a
	 * membership by `membershipTarget`, and the shape no menu could repair until the
	 * planner learned to ask cardinality. Its entries are `unknown` because the SLOTS are
	 * what that question counts — an empty string and a number are entries `readLinkList`
	 * parses away, and a fixture that could not spell one could not reach the shape where
	 * the two readers disagreed.
	 */
	memberOf?: Record<string, string | unknown[]>;
	releaseProperty?: string;
	releases?: string[];
} = {}): { view: ProductBacklogView; vault: FakeVault; containerEl: HTMLElement } {
	const vault = new FakeVault();
	vault.addFile('F.md', { frontmatter: { type: 'PBI', order: 10 } });
	for (const path of releases) vault.addFile(path, { frontmatter: { type: 'Release' } });
	vault.addFile('Sprint 1.md', { frontmatter: { type: 'Iteration' } });
	vault.addFile('M1.md', { frontmatter: { type: 'Milestone' } });
	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
	for (const [path, release] of Object.entries(memberOf)) {
		vault.setFrontmatter(path, { ...vault.fm(path), release: releaseValue(release) });
	}
	let only: string[] | undefined;
	if (exclude) {
		vault.addFile('Child.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: basename(exclude) });
		only = [...vault.files.keys()].filter((path) => path !== exclude);
	}
	const harness = makeView(vault, { releaseProperty }, { collapsed: true, only });
	return { view: harness.view, vault, containerEl: harness.containerEl };
}

const basename = (path: string): string => path.replace(/\.md$/, '');

/**
 * One `memberOf` entry as the frontmatter holds it: a blank, a link, or a list of slots.
 *
 * A list entry that is not a string is written through untouched — that is the malformed
 * slot itself, and turning it into a link would be the fixture repairing the very shape
 * the test is about.
 */
const releaseValue = (release: string | unknown[]): unknown =>
	Array.isArray(release) ? release.map(oneValue) : oneValue(release);

const oneValue = (one: unknown): unknown =>
	typeof one === 'string' ? (one === '' ? '' : `[[${basename(one)}]]`) : one;
