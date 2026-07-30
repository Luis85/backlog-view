import { BasesView, Keymap, Notice, QueryController, setIcon } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from './host';
import { DragDropController } from './interactions/dragDrop';
import { handleTreeKeydown } from './interactions/keyboard';
import { BacklogItem, BacklogModel, buildModel } from './model';
import { applyWrites, computeDropWrites, DropTarget, ItemWrite } from './ops';
import { renderToolbar } from './render/toolbar';
import { renderTree } from './render/rows';
import { BacklogSettings, configProblems, defaultSettings, resolveSettings } from './settings';

export { PRODUCT_BACKLOG_VIEW_TYPE } from './host';

const COLLAPSED_CONFIG_KEY = 'collapsedItems';

/**
 * The Bases view: owns the durable state (settings, model, collapse set,
 * selection) and the write path. Rendering and interactions live in the
 * render/ and interactions/ modules, wired through the BacklogViewHost
 * interface this class implements.
 */
export class ProductBacklogView extends BasesView implements BacklogViewHost {
	type = PRODUCT_BACKLOG_VIEW_TYPE;

	private viewEl: HTMLElement;
	private toolbarEl: HTMLElement;
	private treeEl: HTMLElement;
	private rootDropEl: HTMLElement;
	private dnd: DragDropController;

	settings: BacklogSettings = defaultSettings();
	model: BacklogModel | null = null;
	selectedPath: string | null = null;
	private collapsedPaths = new Set<string>();
	private applying = false;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view' });
		this.toolbarEl = this.viewEl.createDiv({ cls: 'pbl-toolbar' });
		this.treeEl = this.viewEl.createDiv({
			cls: 'pbl-tree',
			attr: { role: 'tree', tabindex: '0', 'aria-label': 'Product backlog' },
		});
		this.rootDropEl = this.viewEl.createDiv({ cls: 'pbl-root-drop' });
		setIcon(this.rootDropEl.createSpan({ cls: 'pbl-root-drop-icon' }), 'corner-left-up');
		this.rootDropEl.createSpan({ text: 'Move to top level' });

		this.dnd = new DragDropController(this, {
			viewEl: this.viewEl,
			treeEl: this.treeEl,
			rootDropEl: this.rootDropEl,
		});
		this.dnd.setupRootDropZone();
		this.treeEl.addEventListener('keydown', (evt) => handleTreeKeydown(this, evt));
		this.registerDomEvent(document, 'dragend', () => this.dnd.clearDragState());
	}

	onunload(): void {
		this.dnd.dispose();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.settings = resolveSettings(this.config);
		this.model = buildModel(this.app, this.data?.data ?? [], this.settings);
		this.restoreCollapsedState();
		this.render();
	}

	// ----------------------------------------------------------- collapse state

	isCollapsed(path: string): boolean {
		return this.collapsedPaths.has(path);
	}

	setCollapsed(path: string, collapsed: boolean): boolean {
		const changed = collapsed ? !this.collapsedPaths.has(path) : this.collapsedPaths.delete(path);
		if (collapsed) this.collapsedPaths.add(path);
		return changed;
	}

	persistCollapsedState(): void {
		const model = this.model;
		if (!model) return;
		// Prune paths that no longer exist so renames and deletions don't accumulate.
		const paths = [...this.collapsedPaths].filter((p) => model.byPath.has(p)).sort();
		try {
			this.config.set(COLLAPSED_CONFIG_KEY, paths);
		} catch {
			// Persistence is best-effort; the in-memory state still applies.
		}
	}

	/** Adopt the collapsed-item list persisted in the view config (survives reopening the Base). */
	private restoreCollapsedState(): void {
		try {
			const stored = this.config.get(COLLAPSED_CONFIG_KEY);
			if (!Array.isArray(stored)) return;
			const paths = stored.filter((p): p is string => typeof p === 'string');
			const next = new Set(paths);
			if (next.size !== this.collapsedPaths.size || paths.some((p) => !this.collapsedPaths.has(p))) {
				this.collapsedPaths = next;
			}
		} catch {
			// Older Bases versions without config storage — keep the in-memory state.
		}
	}

	// -------------------------------------------------------- selection, opening

	selectItem(item: BacklogItem, scroll = true): void {
		this.selectedPath = item.file.path;
		this.treeEl.querySelectorAll('.pbl-selected').forEach((el) => {
			el.classList.remove('pbl-selected');
			el.setAttribute('aria-selected', 'false');
		});
		const row = this.rowElFor(item);
		if (row) {
			row.classList.add('pbl-selected');
			row.setAttribute('aria-selected', 'true');
			if (scroll) row.scrollIntoView({ block: 'nearest' });
		}
	}

	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void {
		void this.app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(item.file);
	}

	openItemInNewTab(item: BacklogItem): void {
		void this.app.workspace.getLeaf('tab').openFile(item.file);
	}

	private rowElFor(item: BacklogItem): HTMLElement | null {
		const rows = this.treeEl.querySelectorAll<HTMLElement>('.pbl-row');
		for (const row of Array.from(rows)) {
			if (row.dataset.path === item.file.path) return row;
		}
		return null;
	}

	// ------------------------------------------------------------------- render

	render(): void {
		const model = this.model;
		if (!model) return;
		this.dnd.onRenderStart();
		this.viewEl.toggleClass('pbl-focused', model.focused);

		renderToolbar(this, this.toolbarEl);

		const scrollTop = this.treeEl.scrollTop;
		this.treeEl.empty();
		renderTree(this, this.dnd, this.treeEl);
		this.treeEl.scrollTop = scrollTop;
	}

	// -------------------------------------------------------------------- writes

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		if (target.parent && this.setCollapsed(target.parent.file.path, false)) {
			this.persistCollapsedState();
		}
		const writes = computeDropWrites(dragged, target, this.settings);
		await this.applySafely(writes);
	}

	async applySafely(writes: ItemWrite[]): Promise<boolean> {
		if (writes.length === 0) return false;
		const problems = configProblems(this.settings);
		if (problems.length > 0) {
			// Writing with e.g. parent and order on the same key would corrupt notes.
			new Notice(`Fix the view options first: ${problems[0]}`);
			return false;
		}
		if (this.applying) {
			new Notice('Still applying the previous change — try again in a moment.');
			return false;
		}
		this.applying = true;
		try {
			await applyWrites(this.app, this.settings, writes);
			return true;
		} catch (e) {
			console.error('Product Backlog: failed to update items', e);
			new Notice('Failed to update backlog items. See the developer console for details.');
			return false;
		} finally {
			this.applying = false;
		}
	}
}
