import { BasesView, Keymap, Notice, QueryController, setIcon } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from './host';
import { DragDropController } from './interactions/dragDrop';
import { handleTreeKeydown } from './interactions/keyboard';
import { buildItemMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel, childLevelIndex } from './model';
import { applyWrites, computeDropWrites, DropTarget, ItemWrite } from './ops';
import { renderToolbar } from './render/toolbar';
import { refreshRowChildren, renderTree, rowContext, RowContext } from './render/rows';
import { BacklogSettings, configProblems, defaultSettings, resolveSettings } from './settings';

export { PRODUCT_BACKLOG_VIEW_TYPE } from './host';

const COLLAPSED_CONFIG_KEY = 'collapsedItems';

/** Source of unique row ids for aria-activedescendant, shared across view instances. */
let rowIdCounter = 0;

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
	filterText = '';
	groupingIgnored = false;
	private collapsedPaths = new Set<string>();
	/** Paths visible under the active filter; null when no filter is set. */
	private filterVisible: Set<string> | null = null;
	private applying = false;
	/**
	 * Rendered rows by path. Scanning the tree for a row is fine at ten items and
	 * wasteful at six hundred — every selection change would walk the whole DOM.
	 */
	private rowEls = new Map<string, HTMLElement>();
	private selectedRowEl: HTMLElement | null = null;

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
		this.groupingIgnored = this.detectIgnoredGrouping();
		this.restoreCollapsedState();
		this.recomputeFilter();
		this.render();
	}

	/** The hierarchy is this view's grouping; surface that a configured group-by has no effect. */
	private detectIgnoredGrouping(): boolean {
		try {
			const groups = this.data?.groupedData;
			if (!groups || groups.length === 0) return false;
			return groups.length > 1 || groups[0].hasKey();
		} catch {
			return false;
		}
	}

	// ------------------------------------------------------------- quick filter

	setFilter(text: string): void {
		this.filterText = text;
		this.recomputeFilter();
		this.renderTreeContent();
	}

	focusFilter(): void {
		this.toolbarEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.focus();
	}

	/**
	 * The filter can be cleared from outside the toolbar (Escape in the tree, the
	 * no-match state); keep the input and its clear affordance in sync.
	 */
	private syncFilterUi(): void {
		const input = this.toolbarEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		if (input && input.value !== this.filterText) input.value = this.filterText;
		input?.closest('.pbl-filter')?.classList.toggle('pbl-filter-active', this.filterText !== '');
	}

	isRowHidden(item: BacklogItem): boolean {
		// While filtering, the filter alone decides — a match must be findable even
		// when completed items are hidden, so hiding is suspended.
		if (this.filterVisible !== null) return !this.filterVisible.has(item.file.path);
		return this.hidingCompleted() && item.subtreeDone;
	}

	/** True when the completed-items toggle is actively hiding fully-done subtrees. */
	private hidingCompleted(): boolean {
		return !this.settings.showCompleted && this.settings.stateKey !== '' && this.filterVisible === null;
	}

	isFiltering(): boolean {
		return this.filterVisible !== null;
	}

	/** Matches stay visible together with all their ancestors and descendants. */
	private recomputeFilter(): void {
		const model = this.model;
		const needle = this.filterText.trim().toLowerCase();
		if (!model || needle === '') {
			this.filterVisible = null;
			return;
		}
		const visible = new Set<string>();
		const markSubtree = (item: BacklogItem) => {
			visible.add(item.file.path);
			for (const child of item.children) markSubtree(child);
		};
		const visit = (item: BacklogItem): boolean => {
			const selfMatch = item.title.toLowerCase().includes(needle);
			if (selfMatch) markSubtree(item);
			let anyMatch = selfMatch;
			for (const child of item.children) anyMatch = visit(child) || anyMatch;
			if (anyMatch) visible.add(item.file.path);
			return anyMatch;
		};
		for (const root of model.roots) visit(root);
		this.filterVisible = visible;
	}

	// ----------------------------------------------------------- collapse state

	isCollapsed(path: string): boolean {
		// While filtering, everything on a path to a match renders expanded.
		return this.filterVisible === null && this.collapsedPaths.has(path);
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
		this.deselectRows();
		const row = this.rowElFor(item);
		this.selectedRowEl = row;
		this.syncActiveDescendant(row);
		if (row) {
			row.classList.add('pbl-selected');
			row.setAttribute('aria-selected', 'true');
			if (scroll) row.scrollIntoView({ block: 'nearest' });
		}
	}

	clearSelection(): void {
		this.selectedPath = null;
		this.deselectRows();
		this.syncActiveDescendant(null);
	}

	/** Only one row is ever selected, so the tracked element is the whole search. */
	private deselectRows(): void {
		const row = this.selectedRowEl;
		this.selectedRowEl = null;
		if (!row) return;
		row.classList.remove('pbl-selected');
		row.setAttribute('aria-selected', 'false');
	}

	/** Focus stays on the tree element; this tells assistive tech which row is active. */
	private syncActiveDescendant(row: HTMLElement | null): void {
		if (!row) {
			this.treeEl.removeAttribute('aria-activedescendant');
			return;
		}
		if (!row.id) row.id = `pbl-row-${++rowIdCounter}`;
		this.treeEl.setAttribute('aria-activedescendant', row.id);
	}

	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void {
		void this.app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(item.file);
	}

	openItemInNewTab(item: BacklogItem): void {
		void this.app.workspace.getLeaf('tab').openFile(item.file);
	}

	openItemToSide(item: BacklogItem): void {
		void this.app.workspace.getLeaf('split').openFile(item.file);
	}

	showContextMenuFor(item: BacklogItem): void {
		const childLevel = this.settings.levels[childLevelIndex(item, this.settings.levels)];
		const menu = buildItemMenu(this, item, childLevel);
		if (!menu) return;
		const rect = this.rowElFor(item)?.getBoundingClientRect();
		menu.showAtPosition(rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
	}

	private rowElFor(item: BacklogItem): HTMLElement | null {
		return this.rowEls.get(item.file.path) ?? null;
	}

	/**
	 * Re-render one row's children after an expand or collapse. Rebuilding the whole
	 * tree for it is the difference between instant and visibly slow once a backlog
	 * has a few hundred rows.
	 */
	refreshSubtree(item: BacklogItem): void {
		const row = this.rowElFor(item);
		if (!row) {
			this.render();
			return;
		}
		refreshRowChildren(this.rowCtx(), item, row);
		// The selection may have been inside the subtree that just collapsed.
		this.selectedRowEl = this.selectedPath ? this.rowEls.get(this.selectedPath) ?? null : null;
		this.syncActiveDescendant(this.selectedRowEl);
	}

	// ------------------------------------------------------------------- render

	render(): void {
		if (!this.model) return;
		renderToolbar(this, this.toolbarEl);
		this.renderTreeContent();
	}

	/** Re-render only the tree — used by the filter so the toolbar input keeps focus. */
	private renderTreeContent(): void {
		this.syncFilterUi();
		const model = this.model;
		if (!model) return;
		this.dnd.onRenderStart();
		this.viewEl.toggleClass('pbl-focused', model.focused);
		// Collapse controls and drag grips are inert while a filter is active.
		this.viewEl.toggleClass('pbl-filtering', this.isFiltering());

		const scrollTop = this.treeEl.scrollTop;
		this.treeEl.empty();
		this.rowEls.clear();
		renderTree(this.rowCtx(), this.treeEl);
		this.treeEl.scrollTop = scrollTop;
		this.selectedRowEl = this.selectedPath ? this.rowEls.get(this.selectedPath) ?? null : null;
		this.syncActiveDescendant(this.selectedRowEl);
		this.updateCountLabel(model);
	}

	/** The per-pass render state: the row index plus the hoisted config lookups. */
	private rowCtx(): RowContext {
		return rowContext(this, this.dnd, this.rowEls);
	}

	/** The toolbar survives filter renders; keep its count in sync imperatively. */
	private updateCountLabel(model: BacklogModel): void {
		const label = this.toolbarEl.querySelector<HTMLElement>('.pbl-count-label');
		if (!label) return;
		const total = model.items.length;
		// Collapsed rows still count as shown — only filtering and hiding narrow the number.
		const hidden = this.hidingCompleted() ? model.items.filter((i) => i.subtreeDone).length : 0;
		if (this.isFiltering()) {
			const visible = this.treeEl.querySelectorAll('.pbl-row').length;
			label.setText(`${visible} of ${total}`);
		} else if (hidden > 0) {
			label.setText(`${total - hidden} of ${total}`);
		} else {
			label.setText(`${total} item${total === 1 ? '' : 's'}`);
		}
	}

	// -------------------------------------------------------------------- writes

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		if (target.parent && this.setCollapsed(target.parent.file.path, false)) {
			this.persistCollapsedState();
		}
		const writes = computeDropWrites(dragged, target, this.settings);
		// Mark the moved row until the Bases refresh re-renders it in place.
		const row = this.rowElFor(dragged);
		row?.classList.add('pbl-pending');
		const applied = await this.applySafely(writes);
		if (!applied) row?.classList.remove('pbl-pending');
	}

	async applySafely(writes: ItemWrite[]): Promise<boolean> {
		if (writes.length === 0) return false;
		// Notes the Base excluded are context, and nothing may write to them: the
		// controls that could are withheld and the auto-type cascade stops at them.
		// If one still arrives, the batch is refused whole — dropping just that write
		// would apply the rest and leave the hierarchy half-updated.
		if (writes.some((w) => this.model?.byPath.get(w.file.path)?.outsideFilter === true)) {
			console.error('Product Backlog: refused a batch writing to a note outside the filter', writes);
			new Notice('That change would edit a note outside this base’s filter, so nothing was written.');
			return false;
		}
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
