import { BasesView, Keymap, Menu, QueryController, setIcon } from 'obsidian';
import { CollapseState } from './collapseState';
import { FilterState } from './filterState';
import {
	BacklogViewHost,
	BoardSnapshot,
	ChipProp,
	PRODUCT_BACKLOG_VIEW_TYPE,
	Projection,
	RoadmapSnapshot,
} from './host';
import { WriteGate } from './writeGate';
import { CardMoveController } from './cardMoves';
import { CardDragController } from './interactions/cardDrag';
import { DragDropController } from './interactions/dragDrop';
import { handleProjectionKeydown } from './interactions/keyboard';
import { buildColumnMenu, buildItemMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel } from '../domain/model';
import { childTypeChoices, PlacementEnd } from '../domain/itemTypes';
import { DropTarget } from '../domain/dropTargets';
import { activeAxis, RoadmapAxis } from '../domain/roadmap';
import { ShelfSort } from '../domain/shelf';
import { ItemWrite, SchedulePlan } from '../domain/writePlan';
import { ScaleId, scaleFor } from '../domain/timeline';
import { forgetBacklogView, rememberBacklogView } from './registry';
import { SelectionController } from './selection';
import { detectIgnoredGrouping, renderToolbar, syncBusy, syncCountLabel, syncFilterUi } from './render/toolbar';
import { chipProps, rowContext, RowContext, syncColumnFit } from './render/columns';
import { renderLoadingState } from './render/emptyStates';
import { captureScroll, centreOnToday, renderProjectionContent, restoreScroll, ScrollAnchor } from './render/projections';
import { refreshRowChildren } from './render/rows';
import { adoptableProperties, BacklogSettings, defaultSettings, notePropertyId, OptionalProperty, resolveSettings } from '../domain/settings';
import { WriteOutcome } from '../storage/frontmatter';

export { PRODUCT_BACKLOG_VIEW_TYPE } from './host';

/**
 * The Bases view: owns the durable state (settings, model, collapse set,
 * selection) and the write path. Rendering and interactions live in the
 * render/ and interactions/ modules, wired through the BacklogViewHost
 * interface this class implements.
 */
export class ProductBacklogView extends BasesView implements BacklogViewHost {
	type = PRODUCT_BACKLOG_VIEW_TYPE;

	/**
	 * The view's own element. Public because it is this view's only identity: the
	 * registry finds the leaf drawing it, which is how a palette command reaches the
	 * view the user is looking at (`view/registry.ts`).
	 */
	readonly viewEl: HTMLElement;
	private toolbarEl: HTMLElement;
	private treeEl: HTMLElement;
	private rootDropEl: HTMLElement;
	private dnd: DragDropController;
	private cardDnd: CardDragController;
	/** The board of the last render; null while the view is not a board. */
	board: BoardSnapshot | null = null;
	/** The roadmap of the last render; null while the view is not a roadmap. */
	roadmap: RoadmapSnapshot | null = null;
	/** What the scroller last drew and where today sat — see `restoreScroll`. */
	private scroll: ScrollAnchor = { content: '', todayLeft: null, scale: null, offsets: {}, leadingDate: null };
	/** Selection state and its DOM bookkeeping, for both projections. */
	private readonly selection: SelectionController;

	settings: BacklogSettings = defaultSettings();
	model: BacklogModel | null = null;
	private readonly filter = new FilterState();
	groupingIgnored = false;
	private readonly collapse: CollapseState;
	/** The write path: validation, serialization, progress and the undo slot. */
	private readonly gate: WriteGate;
	/** Card-move write orchestration: plans, applies and announces board/horizon/schedule moves. */
	private readonly cardMoves: CardMoveController;
	private watchingRenames = false;
	/**
	 * Rendered rows by path. Scanning the tree for a row is fine at ten items and
	 * wasteful at six hundred — every selection change would walk the whole DOM.
	 */
	private rowEls = new Map<string, HTMLElement>();
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
			attr: { role: 'tree', tabindex: '0' },
		});
		// Nothing to render until Bases delivers the first result set — say what is
		// happening instead of showing an empty pane.
		renderLoadingState(this.treeEl);
		this.rootDropEl = this.viewEl.createDiv({ cls: 'pbl-root-drop' });
		setIcon(this.rootDropEl.createSpan({ cls: 'pbl-root-drop-icon' }), 'corner-left-up');
		this.rootDropEl.createSpan({ text: 'Move to top level' });

		this.selection = new SelectionController(this.treeEl, this.rowEls, () => this.board?.colEls ?? []);
		this.collapse = new CollapseState(this);
		this.gate = new WriteGate(this, {
			syncBusy: () => this.syncBusyUi(),
			flushDataUpdate: () => this.refreshFromData(),
		});
		this.cardMoves = new CardMoveController(this, this.rowEls);
		this.dnd = new DragDropController(this, {
			viewEl: this.viewEl,
			treeEl: this.treeEl,
			rootDropEl: this.rootDropEl,
		});
		this.dnd.setupRootDropZone();
		this.cardDnd = new CardDragController(this, this.viewEl);
		this.treeEl.addEventListener('keydown', (evt) => handleProjectionKeydown(this, evt));
		this.registerDomEvent(document, 'dragend', () => this.dnd.clearDragState());
		// Which columns fit depends on the pane, which changes without a data update.
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => this.onResize());
			// The tree, not the view: its content box is what the rows get, and it also
			// changes when the vertical scrollbar appears, which the view's box does not.
			this.resizeObserver.observe(this.treeEl);
		}
		// Announced, not read: `this.app` is assigned after construction, so the registry
		// only holds the reference and asks the workspace about it later.
		rememberBacklogView(this);
	}

	onunload(): void {
		forgetBacklogView(this);
		this.resizeObserver?.disconnect();
		this.collapse.dispose();
		this.dnd.dispose();
		this.cardDnd.dispose();
		this.viewEl.detach();
	}

	/** Re-measure the pane and apply the column ladder to what is currently rendered. */
	private refit(): boolean {
		return syncColumnFit(this.rowCtx(), this.viewEl, this.treeEl);
	}

	/**
	 * Which projection this view shows. UI state, not a base setting: it lives
	 * beside the collapse state — per saved view, per device — never in the `.base`.
	 */
	get projection(): Projection {
		return this.collapse.projection();
	}

	setProjection(mode: Projection): void {
		if (mode === this.projection) return;
		this.collapse.setProjection(mode);
		// No config was set, so no Bases refresh is coming: this render is the switch.
		this.render();
	}

	/** The retained roadmap-axis pick for this saved view; null before the user picks. */
	get axisPick(): string | null {
		return this.collapse.axisPick();
	}

	setAxisPick(axis: RoadmapAxis): void {
		if (axis === this.axisPick) return;
		this.collapse.setAxisPick(axis);
		// The pick is UI state like the mode: no Bases refresh is coming.
		this.render();
	}

	get shelfCollapsed(): boolean {
		return this.collapse.shelfCollapsed();
	}

	setShelfCollapsed(collapsed: boolean): void {
		if (collapsed === this.shelfCollapsed) return;
		this.collapse.setShelfCollapsed(collapsed);
		// Content only, like setFilter: the toolbar keeps its own focus and its own DOM.
		// This does NOT spare the control that asked for it — the shelf's disclosure
		// lives in the content pane and is rebuilt by this very call, which is why it
		// hands focus to its replacement itself (`renderShelfControls`).
		this.renderTreeContent();
	}

	get shelfSort(): ShelfSort {
		return this.collapse.shelfSort();
	}

	setShelfSort(sort: ShelfSort): void {
		if (sort === this.shelfSort) return;
		this.collapse.setShelfSort(sort);
		this.renderTreeContent();
	}

	get shelfHiddenTypes(): ReadonlySet<string> {
		return this.collapse.shelfHiddenTypes();
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.collapse.setShelfHiddenTypes(types);
		this.renderTreeContent();
	}

	get zoom(): ScaleId {
		return scaleFor(this.collapse.zoomPick()).id;
	}

	setZoom(id: ScaleId): void {
		if (id === this.zoom) return;
		this.collapse.setZoom(id);
		// UI state like the mode and the axis pick: no config was set, so no Bases
		// refresh is coming and this render is the change.
		this.render();
	}

	jumpToToday(): void {
		const roadmap = this.roadmap;
		if (!roadmap?.scroller || roadmap.todayLeft === null) return;
		roadmap.scroller.scrollLeft = centreOnToday(roadmap.todayLeft, roadmap.scroller.clientWidth);
	}

	/** Re-measure after a resize, and rebuild only if a column came or went. */
	private onResize(): void {
		// The COLUMN ladder is the tree's alone — board columns and the timeline scroll
		// rather than dropping columns, and the shelf answers to a stored pick rather
		// than to a width.
		if (this.projection !== 'tree') return;
		if (this.refit()) this.renderTreeContent();
	}

	onDataUpdated(): void {
		// A batch in flight defers this and flushes it once at the end — see the gate.
		if (this.gate.deferUpdate()) return;
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
		this.groupingIgnored = detectIgnoredGrouping(this.data);
		// Restore before the defaults are applied, or a restored session would be
		// overwritten by the very pass that is meant to honor it.
		this.collapse.restore(this.viewEl);
		this.collapse.collapseNewParents(this.model.items);
		this.filter.recompute(this.model);
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

	adoptDefaultProperties(): OptionalProperty[] {
		const adopting = adoptableProperties(this.config, this.settings);
		for (const property of adopting) this.config.set(property.option, notePropertyId(property.suggested));
		// Rebuilt now rather than left to the refresh a config change brings: the batch
		// that follows is planned from this model, and one built before the binding reads
		// every note as already carrying the keys just adopted — an unconfigured field
		// carries no key at all.
		if (adopting.length > 0) this.refreshFromData();
		return adopting;
	}

	// ------------------------------------------------------------- quick filter

	get filterText(): string {
		return this.filter.text;
	}

	setFilter(text: string): void {
		this.filter.text = text;
		this.filter.recompute(this.model);
		this.renderTreeContent();
	}

	focusFilter(): void {
		this.toolbarEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.focus();
	}

	isRowHidden(item: BacklogItem): boolean {
		return this.hidden(item, true);
	}

	isRowHiddenUnfiltered(item: BacklogItem): boolean {
		return this.hidden(item, false);
	}

	isFilterMatch(item: BacklogItem): boolean {
		return this.filter.matched(item.file.path);
	}

	/**
	 * Row visibility, with the filter itself optionally lifted. One predicate answers
	 * for the narrowed board and for the population its counts are measured against,
	 * so the two cannot disagree about what "in this column" means.
	 *
	 * Lifting the filter is NOT the same as having no filter: while one is running it
	 * suspends the completed-items toggle, and the population a count is "of" has to
	 * keep that suspension. Measuring against the cleared board instead would count a
	 * matched-but-otherwise-hidden card as "1 of 0" — each number defensible on its
	 * own and the pair nonsense. What "of" means is what this filter is choosing among.
	 */
	private hidden(item: BacklogItem, applyFilter: boolean): boolean {
		// While filtering, the filter alone decides — a match must be findable even
		// when completed items are hidden, so hiding is suspended.
		if (this.filter.active) {
			if (applyFilter && !this.filter.keeps(item.file.path)) return true;
		} else if (this.hidingCompleted() && item.subtreeDone) {
			return true;
		}
		// A context row is here only to place a result. Once nothing below it is
		// visible it is an empty scaffold, so it goes with them — whatever hid them.
		// One visible child is enough: a context child is itself subject to this rule.
		if (item.outsideFilter) return !item.children.some((child) => !this.hidden(child, applyFilter));
		return false;
	}

	/**
	 * True when the completed-items toggle is actively hiding fully-done subtrees.
	 * The filter's own suspension of it is structural — `hidden` only consults this
	 * on the branch where no filter is in play.
	 */
	private hidingCompleted(): boolean {
		return !this.settings.showCompleted && this.settings.stateKey !== '';
	}

	isFiltering(): boolean {
		return this.filter.active;
	}

	// ----------------------------------------------------------- collapse state

	isCollapsed(path: string): boolean {
		// While filtering, everything on a path to a match renders expanded.
		return !this.filter.active && this.collapse.isCollapsed(path);
	}

	setCollapsed(path: string, collapsed: boolean): boolean {
		return this.collapse.set(path, collapsed);
	}


	// -------------------------------------------------------- selection, opening

	get selectedPath(): string | null {
		return this.selection.selectedPath;
	}

	get selectedBoardColumn(): number | null {
		return this.selection.selectedBoardColumn;
	}

	selectItem(item: BacklogItem, scroll = true): void {
		this.selection.selectItem(item, scroll);
	}

	clearSelection(): void {
		this.selection.clearSelection();
	}

	selectBoardColumn(index: number | null): void {
		this.selection.selectBoardColumn(index);
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
		this.showMenuBelow(buildItemMenu(this, item, childTypeChoices(item)), this.rowElFor(item));
	}

	showColumnMenuFor(index: number): boolean {
		return this.showMenuBelow(buildColumnMenu(this.board?.board.columns[index]?.policy ?? ''), this.board?.colEls[index] ?? null);
	}

	/**
	 * Anchor a menu under its own element's rect — the keyboard path for a row or a
	 * column stop, neither of which has a pointer to sit under. Falls back to the
	 * viewport corner when there is no element to anchor to, and reports false when
	 * there was no menu to open, so a caller that swallowed the key can give it back.
	 * The fallback is a row's, not deliberately a column's too: `colEls` and
	 * `board.columns` are built by the same `.map()` over the same array
	 * (`renderBoard`), so an index that resolves a column always resolves an element,
	 * and this branch stays unreachable from `showColumnMenuFor`.
	 */
	private showMenuBelow(menu: Menu | null, el: HTMLElement | null): boolean {
		if (!menu) return false;
		const rect = el?.getBoundingClientRect();
		menu.showAtPosition(rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
		return true;
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
		if (this.refit()) this.renderTreeContent();
		// The selection may have been inside the subtree that just collapsed.
		this.selection.resyncAfterRender();
	}

	// ------------------------------------------------------------------- render

	render(): void {
		if (!this.model) return;
		renderToolbar(this, this.toolbarEl);
		// The toolbar was just rebuilt; a batch may still be running behind it.
		this.syncBusyUi();
		this.renderTreeContent();
	}

	/** Re-render only the content pane — used by the filter so the toolbar input keeps focus. */
	private renderTreeContent(): void {
		syncFilterUi(this, this.toolbarEl);
		const model = this.model;
		if (!model) return;
		const projection = this.projection;
		this.viewEl.toggleClass('pbl-board-mode', projection === 'board');
		this.viewEl.toggleClass('pbl-roadmap-mode', projection === 'roadmap');
		this.viewEl.toggleClass(
			'pbl-roadmap-dates',
			projection === 'roadmap' && activeAxis(this.settings, this.axisPick) === 'dates',
		);
		// The keyboard instructions belong to the board and are rebuilt with it below;
		// dropped here so the attribute never outlives the element it points at — a
		// dangling `aria-describedby` is read as no description at all.
		this.treeEl.removeAttribute('aria-describedby');
		this.dnd.onRenderStart();
		this.cardDnd.onRenderStart();
		this.viewEl.toggleClass('pbl-focused', model.focused);
		// Collapse controls and drag grips are inert while a filter is active.
		this.viewEl.toggleClass('pbl-filtering', this.isFiltering());

		// Captured from the OLD frame, before its DOM goes: on the dated axis the pane
		// is not the scroll box, and reading it here would capture zeros.
		this.scroll = captureScroll(this.treeEl, this.roadmap, this.scroll);
		this.treeEl.empty();
		this.rowEls.clear();
		if (projection !== 'tree') {
			// The column-fit ladder is the tree's; its stale verdicts must not hide card cells.
			this.viewEl.removeClass('pbl-hide-props', 'pbl-hide-meta', 'pbl-hide-horizon', 'pbl-hide-state');
		}
		const content = renderProjectionContent(projection, this.rowCtx(), this.treeEl, this.cardDnd);
		this.board = content.board;
		this.roadmap = content.roadmap;
		this.treeEl.setAttribute('role', content.role);
		this.treeEl.setAttribute('aria-label', content.label);
		// Column stops are board state: without a board on screen a held stop would
		// point at a projection that no longer exists, so it is released; with one,
		// it is clamped to the columns left, the way the card selection is carried.
		if (content.board === null) this.selectBoardColumn(null);
		else if (this.selectedBoardColumn !== null) {
			this.selectBoardColumn(Math.min(this.selectedBoardColumn, content.board.colEls.length - 1));
		}
		// Both offsets belong to the content that made them — restored, corrected,
		// reset or replaced by the anchor policy `restoreScroll` states beside the
		// fork that decides what was drawn.
		this.scroll = restoreScroll(this.treeEl, this.scroll, this.roadmap, projection);
		this.selection.resyncAfterRender();
		syncCountLabel(this, this.toolbarEl);
		if (projection !== 'tree') return;
		// Measured against the tree that now exists, scrollbar and all. A changed
		// verdict means a column came or went, which only the rows can show — one
		// more pass, guarded, since the second pass measures the same tree.
		if (this.refit() && !this.refitting) {
			this.refitting = true;
			this.renderTreeContent();
			this.refitting = false;
		}
	}

	/** The per-pass render state: the row index plus the hoisted config lookups. */
	private rowCtx(): RowContext {
		return rowContext(this, this.dnd, this.rowEls);
	}

	// -------------------------------------------------------------------- writes

	/**
	 * The card-move plumbing (planning, applying and announcing a board, horizon or
	 * schedule move) lives in `CardMoveController` — see `src/view/cardMoves.ts` for
	 * why. These four stay here as one-line delegations, the same shape `applySafely`
	 * /`canUndo`/`undoLast` already use for the write gate, so `BacklogViewHost` still
	 * resolves to this one class and nothing that calls them has to change.
	 */
	performBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		return this.cardMoves.performBoardMove(item, state);
	}

	performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean> {
		return this.cardMoves.performHorizonMove(item, horizon);
	}

	performScheduleMove(
		item: BacklogItem,
		plan: SchedulePlan,
		from?: Partial<Record<PlacementEnd, string | null>>,
		ends?: PlacementEnd[],
	): Promise<boolean> {
		return this.cardMoves.performScheduleMove(item, plan, from, ends);
	}

	performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		return this.cardMoves.performDrop(dragged, target);
	}

	applySafely(writes: ItemWrite[]): Promise<WriteOutcome | null> {
		return this.gate.applySafely(writes);
	}

	canUndo(): boolean {
		return this.gate.canUndo();
	}

	undoLast(): Promise<boolean> {
		return this.gate.undoLast();
	}

	/** Publish the gate's progress to the toolbar and the tree, re-rendering nothing. */
	private syncBusyUi(): void {
		const busy = this.gate.busy;
		syncBusy(this.toolbarEl, busy, this.canUndo());
		// The tree's content is mid-change; say so once, rather than per row.
		if (busy) this.treeEl.setAttribute('aria-busy', 'true');
		else this.treeEl.removeAttribute('aria-busy');
	}
}
