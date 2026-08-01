import { BasesView, Keymap, Notice, QueryController, setIcon } from 'obsidian';
import { CollapseState } from './collapseState';
import { BacklogViewHost, BusyState, ChipProp, PRODUCT_BACKLOG_VIEW_TYPE } from './host';
import { DragDropController } from './interactions/dragDrop';
import { handleTreeKeydown } from './interactions/keyboard';
import { buildItemMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel, childLevelIndex } from '../domain/model';
import { DropTarget } from '../domain/dropTargets';
import { computeDropWrites, ItemWrite } from '../domain/writePlan';
import { applyWrites, RestoreWrite } from '../storage/frontmatter';
import { ReplayTracker, replayRun, UndoRecovery } from './interactions/undo';
import { renderToolbar, syncBusy } from './render/toolbar';
import { chipProps, columnFit, rowContext, RowContext } from './render/columns';
import { refreshRowChildren, renderLoadingState, renderTree } from './render/rows';
import { BacklogSettings, configProblems, defaultSettings, resolveSettings } from '../domain/settings';

export { PRODUCT_BACKLOG_VIEW_TYPE } from './host';

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
	private readonly collapse: CollapseState;
	/** Paths visible under the active filter; null when no filter is set. */
	private filterVisible: Set<string> | null = null;
	private applying = false;
	/**
	 * Inverses of the most recent effective batch, in write order — the single-level,
	 * session-only undo. Replaced only by a batch that actually changed something.
	 */
	private lastUndo: RestoreWrite[] | null = null;
	/** Keeps undo and redo coherent when a replay fails partway — see UndoRecovery. */
	private readonly recovery = new UndoRecovery();
	/** A data update that arrived mid-batch and is waiting for it to finish. */
	private pendingDataUpdate = false;
	/** Progress of the batch in flight; null when idle. Drives the toolbar indicator. */
	private busy: BusyState | null = null;
	private watchingRenames = false;
	/**
	 * Rendered rows by path. Scanning the tree for a row is fine at ten items and
	 * wasteful at six hundred — every selection change would walk the whole DOM.
	 */
	private rowEls = new Map<string, HTMLElement>();
	private selectedRowEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	/** The Base's visible properties as columns, resolved once per data update. */
	chips: ChipProp[] = [];

	/** Guards the one re-render a changed fit may ask for, so it cannot recurse. */
	private refitting = false;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view' });
		this.toolbarEl = this.viewEl.createDiv({ cls: 'pbl-toolbar' });
		this.treeEl = this.viewEl.createDiv({
			cls: 'pbl-tree',
			attr: { role: 'tree', tabindex: '0', 'aria-label': 'Product backlog' },
		});
		// Nothing to render until Bases delivers the first result set — say what is
		// happening instead of showing an empty pane.
		renderLoadingState(this.treeEl);
		this.rootDropEl = this.viewEl.createDiv({ cls: 'pbl-root-drop' });
		setIcon(this.rootDropEl.createSpan({ cls: 'pbl-root-drop-icon' }), 'corner-left-up');
		this.rootDropEl.createSpan({ text: 'Move to top level' });

		this.collapse = new CollapseState(this);
		this.dnd = new DragDropController(this, {
			viewEl: this.viewEl,
			treeEl: this.treeEl,
			rootDropEl: this.rootDropEl,
		});
		this.dnd.setupRootDropZone();
		this.treeEl.addEventListener('keydown', (evt) => handleTreeKeydown(this, evt));
		this.registerDomEvent(document, 'dragend', () => this.dnd.clearDragState());
		// Which columns fit depends on the pane, which changes without a data update.
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => this.onResize());
			// The tree, not the view: its content box is what the rows get, and it also
			// changes when the vertical scrollbar appears, which the view's box does not.
			this.resizeObserver.observe(this.treeEl);
		}
	}

	onunload(): void {
		this.resizeObserver?.disconnect();
		this.collapse.dispose();
		this.dnd.dispose();
		this.viewEl.detach();
	}

	/**
	 * Drop the columns a pane this narrow cannot hold. They never shrink — that is
	 * what keeps them aligned across rows — so the alternative to hiding them is
	 * clipping whatever sits at the row's end, which is the state and the rollup.
	 * Measured after the rows are in place: an empty tree has no scrollbar, and its
	 * width is not the width the columns will actually get. Returns true when the
	 * decision changed, which is when what was rendered no longer matches it.
	 */
	private syncColumnFit(): boolean {
		const width = this.treeEl.clientWidth;
		// Zero while detached or before the first layout: keep the last decision.
		if (width === 0) return false;
		// Indent is part of what a row needs, so expanding a deep branch can be what
		// makes the columns stop fitting.
		const fit = columnFit(this.settings, this.chips.length, this.renderedDepth(), width);
		const changed =
			fit.hideProps !== this.viewEl.hasClass('pbl-hide-props') ||
			fit.hideMeta !== this.viewEl.hasClass('pbl-hide-meta') ||
			fit.hideState !== this.viewEl.hasClass('pbl-hide-state');
		this.viewEl.toggleClass('pbl-hide-props', fit.hideProps);
		this.viewEl.toggleClass('pbl-hide-meta', fit.hideMeta);
		this.viewEl.toggleClass('pbl-hide-state', fit.hideState);
		return changed;
	}

	/**
	 * Deepest row on screen, read off the row index rather than walked out of the
	 * model: `rowEls` holds exactly what was rendered, so this cannot disagree with
	 * the tree the user is looking at, and a collapse shrinks it the same pass it
	 * happens in.
	 */
	private renderedDepth(): number {
		let max = 0;
		for (const path of this.rowEls.keys()) {
			const depth = this.model?.byPath.get(path)?.depth ?? 0;
			if (depth > max) max = depth;
		}
		return max;
	}

	/** Re-measure after a resize, and rebuild only if a column came or went. */
	private onResize(): void {
		if (this.syncColumnFit()) this.renderTreeContent();
	}

	onDataUpdated(): void {
		// Every file a batch touches comes back here as its own data update, and
		// rebuilding the model and every row for each one is the one thing that
		// genuinely stalls this view — a backfill over a large backlog would do it
		// hundreds of times, each render showing a half-applied tree. The refresh
		// waits for the batch and then runs once, against the final state.
		if (this.applying) {
			this.pendingDataUpdate = true;
			return;
		}
		this.refreshFromData();
	}

	private refreshFromData(): void {
		this.watchRenames();
		this.settings = resolveSettings(this.config);
		this.model = buildModel(this.app, this.data?.data ?? [], this.settings);
		// Which properties become columns is a config question, so it is answered once
		// here rather than per render — and once, so the rows and the tag menu cannot
		// disagree about what is on screen.
		this.chips = chipProps(this);
		this.groupingIgnored = this.detectIgnoredGrouping();
		// Restore before the defaults are applied, or a restored session would be
		// overwritten by the very pass that is meant to honor it.
		this.collapse.restore(this.viewEl);
		this.collapse.collapseNewParents(this.model.items);
		this.recomputeFilter();
		this.render();
	}

	/**
	 * A renamed note is the same row; without this its state is left behind under the
	 * old path and the next refresh shuts it as a parent nobody has ruled on. Wired on
	 * the first data update rather than in the constructor — a Bases view is handed its
	 * `app` afterwards, so there is nothing to subscribe to yet when it is built.
	 */
	private watchRenames(): void {
		if (this.watchingRenames) return;
		this.watchingRenames = true;
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => this.collapse.renamePath(oldPath, file.path)),
		);
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
		// A filter change re-renders only the tree, so the toolbar's collapse controls
		// are updated here. They are focusable buttons: while collapse state is
		// overridden, they have to actually refuse the press, not just look dimmed.
		const filtering = this.isFiltering();
		this.toolbarEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl').forEach((btn) => {
			btn.disabled = filtering;
		});
	}

	isRowHidden(item: BacklogItem): boolean {
		// While filtering, the filter alone decides — a match must be findable even
		// when completed items are hidden, so hiding is suspended.
		if (this.filterVisible !== null) {
			if (!this.filterVisible.has(item.file.path)) return true;
		} else if (this.hidingCompleted() && item.subtreeDone) {
			return true;
		}
		// A context row is here only to place a result. Once nothing below it is
		// visible it is an empty scaffold, so it goes with them — whatever hid them.
		// One visible child is enough: a context child is itself subject to this rule.
		if (item.outsideFilter) return !item.children.some((child) => !this.isRowHidden(child));
		return false;
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
		return this.filterVisible === null && this.collapse.isCollapsed(path);
	}

	setCollapsed(path: string, collapsed: boolean): boolean {
		return this.collapse.set(path, collapsed);
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

	/**
	 * Focus stays on the tree element; this tells assistive tech which row is active.
	 * The class says the same thing to CSS, which needs it to decide whether the tree
	 * or the selected row carries the focus ring — a `:has()` selector would answer
	 * that too, at the price of invalidating on every subtree change.
	 */
	private syncActiveDescendant(row: HTMLElement | null): void {
		this.treeEl.toggleClass('pbl-has-selection', row !== null);
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
		// Expanding or collapsing changes the deepest rendered row, and with it the
		// room the columns have left — in both directions.
		if (this.syncColumnFit()) this.renderTreeContent();
		// The selection may have been inside the subtree that just collapsed.
		this.selectedRowEl = this.selectedPath ? this.rowEls.get(this.selectedPath) ?? null : null;
		this.syncActiveDescendant(this.selectedRowEl);
	}

	// ------------------------------------------------------------------- render

	render(): void {
		if (!this.model) return;
		renderToolbar(this, this.toolbarEl);
		// The toolbar was just rebuilt; a batch may still be running behind it.
		syncBusy(this.toolbarEl, this.busy, this.canUndo());
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
		// Measured against the tree that now exists, scrollbar and all. A changed
		// verdict means a column came or went, which only the rows can show — one
		// more pass, guarded, since the second pass measures the same tree.
		if (this.syncColumnFit() && !this.refitting) {
			this.refitting = true;
			this.renderTreeContent();
			this.refitting = false;
		}
	}

	/** The per-pass render state: the row index plus the hoisted config lookups. */
	private rowCtx(): RowContext {
		return rowContext(this, this.dnd, this.rowEls);
	}

	/** The toolbar survives filter renders; keep its count in sync imperatively. */
	private updateCountLabel(model: BacklogModel): void {
		const label = this.toolbarEl.querySelector<HTMLElement>('.pbl-count-label');
		if (!label) return;
		// The Base's own results: ancestors loaded for context are not items of this
		// base and must not inflate its count. Collapsed rows still count as shown —
		// only filtering and hiding narrow the number, which isRowHidden covers both of.
		const total = model.results.length;
		const shown = model.results.filter((item) => !this.isRowHidden(item)).length;
		if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
		else label.setText(`${shown} of ${total}`);
	}

	// -------------------------------------------------------------------- writes

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		// Dropping into a collapsed parent reveals where the item landed.
		if (target.parent) this.setCollapsed(target.parent.file.path, false);
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
		return this.runExclusively(writes.length, (onProgress, onInverse) =>
			applyWrites(this.app, this.settings, writes, onProgress, onInverse),
		);
	}

	canUndo(): boolean {
		return this.lastUndo !== null && this.lastUndo.length > 0;
	}

	async undoLast(): Promise<boolean> {
		const restores = this.lastUndo;
		if (!restores || restores.length === 0) {
			new Notice('Nothing to undo.');
			return false;
		}
		// No context-row check here, deliberately: authorization came at capture time.
		// This batch can only name files its forward batch wrote while they were
		// results — and the write being undone may itself have moved one out of the
		// filter, which is exactly the change the user is taking back. The current
		// model's verdict on those files answers a different question.
		const batch = [...restores].reverse();
		const tracker: ReplayTracker = { finished: 0 };
		const ok = await this.runExclusively(batch.length, replayRun(this.app, batch, tracker), restores);
		if (ok) {
			// Rejoin any redo stranded by the failure this replay just recovered
			// from, so the next undo re-applies the WHOLE batch, not only the tail.
			this.lastUndo = this.recovery.completed(restores, this.lastUndo);
		} else if (tracker.finished > 0 && tracker.finished < batch.length) {
			// A replay that failed partway holds its place: the slot gets the
			// unfinished remainder, so the next undo finishes taking the change back
			// rather than redoing the restored prefix — whose redo waits in the
			// stash. A throw on the FIRST file installed nothing, so the original
			// slot (and any stash pointed at it) simply stays for the retry.
			this.lastUndo = this.recovery.failed(restores, batch, tracker.finished, this.lastUndo);
		}
		return ok;
	}

	/**
	 * The write gate every batch passes: config validation, one batch at a time,
	 * progress publication, and the single-level undo slot. Inverses install on the
	 * first EFFECTIVE write — a batch that changes nothing (a state re-set to
	 * itself) emits none and leaves the previous undo in place, while a batch that
	 * fails partway has already installed the applied prefix, which is exactly the
	 * part that still needs to be undoable.
	 */
	private async runExclusively(
		total: number,
		run: (
			onProgress: (done: number, total: number) => void,
			onInverse: (inverse: RestoreWrite) => void,
		) => Promise<void>,
		replaying?: RestoreWrite[],
	): Promise<boolean> {
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
		this.setBusy({ done: 0, total });
		const inverses: RestoreWrite[] = [];
		let installed = false;
		let completed = false;
		const onInverse = (inverse: RestoreWrite) => {
			if (!installed) {
				installed = true;
				this.lastUndo = inverses;
			}
			inverses.push(inverse);
		};
		try {
			await run((done, tot) => this.setBusy({ done, total: tot }), onInverse);
			completed = true;
			return true;
		} catch (e) {
			console.error('Product Backlog: failed to update items', e);
			new Notice('Failed to update backlog items. See the developer console for details.');
			return false;
		} finally {
			// A replay that completed but restored nothing is SPENT, not retryable:
			// its conflicts stay conflicted and its missing notes stay missing, so
			// re-offering the same dead batch would make the undo button lie forever.
			// A forward batch that changed nothing keeps the slot (the whole point of
			// effective-only inverses), and so does a replay that FAILED — a
			// transient write error deserves its retry.
			if (replaying && completed && !installed && this.lastUndo === replaying) {
				this.lastUndo = null;
			}
			this.applying = false;
			this.setBusy(null);
			// Whatever landed while the batch ran gets one rebuild, now, against the
			// finished state. A failed batch takes this path too: the writes before the
			// failure are applied, and the tree has to show what is actually on disk.
			if (this.pendingDataUpdate) {
				this.pendingDataUpdate = false;
				this.refreshFromData();
			}
		}
	}

	/** Publish batch progress to the toolbar without re-rendering anything. */
	private setBusy(state: BusyState | null): void {
		this.busy = state;
		syncBusy(this.toolbarEl, state, this.canUndo());
		// The tree's content is mid-change; say so once, rather than per row.
		if (state) this.treeEl.setAttribute('aria-busy', 'true');
		else this.treeEl.removeAttribute('aria-busy');
	}
}
