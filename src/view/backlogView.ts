import { QueryController } from 'obsidian';
import { CARD_SCOPE, TIMELINE_SCOPE, ViewState } from './viewState';
import { FilterState } from './filterState';
import { BacklogViewHost, BoardSnapshot, Column, ColumnFit, PRODUCT_BACKLOG_VIEW_TYPE, RoadmapSnapshot } from './host';
import { OpenController } from './openTarget';
import { WriteGate } from './writeGate';
import { CardMoveController } from './cardMoves';
import { CardDragController } from './interactions/cardDrag';
import { DragDropController } from './interactions/dragDrop';
import { handleProjectionKeydown } from './interactions/keyboard';
import { showColumnMenuForIndex } from './interactions/columnMenu';
import { showContextMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel } from '../domain/model';
import { PlacementEnd } from '../domain/itemTypes';
import { DropTarget } from '../domain/dropTargets';
import { activeAxis, drawsGrid } from '../domain/roadmap';
import { ItemWrite, ScheduleGesture, SchedulePlan } from '../domain/writePlan';
import { forgetBacklogView, rememberBacklogView } from './registry';
import { renderPass } from './renderPass';
import { ResizePolicy } from './resize';
import { filterScopeFor, hidesCompleted, projectionMember } from './projection';
import { rowHidden, VisibilityRule } from './rowVisibility';
import { SelectionController } from './selection';
import { ViewStateController } from './viewStateController';
import { ViewStateSurface } from './viewStateSurface';
import { detectIgnoredGrouping, renderToolbar, revealFilter, syncBusy, syncFilterUi } from './render/toolbar';
import { resolveColumns, rowContext, RowContext } from './render/columns';
import { renderLoadingState } from './render/emptyStates';
import { syncToolbarFit } from './render/toolbarFit';
import { ScrollAnchor, scrollToToday } from './render/projections';
import { refreshRowChildren, wireRowEvents } from './render/rows';
import { BacklogSettings, defaultSettings } from '../domain/settings';
import { adoptableProperties, notePropertyId, OptionalField, OptionalProperty } from '../domain/optionalProperties';
import { resolveSettings } from '../domain/settingsResolve';
import { OpenTarget } from '../domain/itemHandling';
import { WriteOutcome } from '../storage/frontmatter';

export { PRODUCT_BACKLOG_VIEW_TYPE } from './host';

/**
 * The Bases view: owns the durable state (settings, model, collapse set,
 * selection) and the write path. Rendering and interactions live in the
 * render/ and interactions/ modules, wired through the BacklogViewHost
 * interface this class implements — still one class, and still the only one:
 * `ViewStateSurface` is this file's own view-state half, extended rather than
 * held so those twenty-five members are on the object the modules are handed.
 */
export class ProductBacklogView extends ViewStateSurface implements BacklogViewHost {
	type = PRODUCT_BACKLOG_VIEW_TYPE;

	/**
	 * The view's own element. Public because it is this view's only identity: the
	 * registry finds the leaf drawing it, which is how a palette command reaches the
	 * view the user is looking at (`view/registry.ts`).
	 */
	readonly viewEl: HTMLElement;
	private toolbarEl: HTMLElement;
	private legendEl: HTMLElement;
	private treeEl: HTMLElement;
	private dnd: DragDropController;
	private cardDnd: CardDragController;
	/** The board of the last render; null while the view is not a board. */
	board: BoardSnapshot | null = null;
	/** The roadmap of the last render; null while the view is not a roadmap. */
	roadmap: RoadmapSnapshot | null = null;
	/**
	 * Paths whose card drew a child disclosure this render pass, filled through
	 * `RowContext.cardKids` and cleared beside `rowEls`. Exposed read-only as
	 * `cardChildrenShown` — the card menu's `addChildrenSection` is its first reader.
	 */
	private readonly cardKids = new Set<string>();
	get cardChildrenShown(): ReadonlySet<string> {
		return this.cardKids;
	}
	/** What the scroller last drew and where today sat — see `restoreScroll`. */
	private scroll: ScrollAnchor = { content: '', todayTrackLeft: null, scale: null, offsets: {}, leadingDate: null };
	/** Selection state and its DOM bookkeeping, for both projections. */
	private readonly selection: SelectionController;
	/** Where a note opens, and the side pane it reuses (`view/openTarget.ts`). */
	private readonly opens = new OpenController();

	settings: BacklogSettings = defaultSettings();
	model: BacklogModel | null = null;
	private readonly filter = new FilterState();
	groupingIgnored = false;
	private readonly state: ViewState;
	/** The write path: validation, serialization, progress and the undo slot. */
	private readonly gate: WriteGate;
	/** Card-move write orchestration: plans, applies and announces board/horizon/schedule moves. */
	private readonly cardMoves: CardMoveController;
	/** The view-state-backed UI state — projection, axis pick, focus, shelf, zoom,
	 * density, lead width, column widths. Built here and read by `ViewStateSurface`,
	 * which carries this view's one-line forwards to it. */
	protected readonly ui: ViewStateController;
	/** When to re-measure the pane and re-run the column-fit ladder — see `resize.ts`. */
	private readonly resize: ResizePolicy;
	/** Whether `watchApp` has run — its subscriptions are once per view, not per update. */
	private watchedApp = false;
	/**
	 * Rendered rows by path. Scanning the tree for a row is fine at ten items and
	 * wasteful at six hundred — every selection change would walk the whole DOM.
	 */
	private rowEls = new Map<string, HTMLElement>();
	private resizeObserver: ResizeObserver | null = null;
	/** The Base's visible properties as columns, resolved once per data update. */
	columns: Column[] = [];
	/** What the pane held at the last measurement — see `BacklogViewHost`. */
	columnFit: ColumnFit | null = null;

	setColumnFit(fit: ColumnFit | null): void {
		this.columnFit = fit;
	}

	/**
	 * Guards the one re-render a changed column verdict may ask for, so it cannot
	 * recurse. The TREE's alone, and set around a synchronous call only — restored in a
	 * `finally`, because a render that throws while it is set would otherwise leave the
	 * ladder's second pass switched off for the life of the view.
	 */
	private refitting = false;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view' });
		this.toolbarEl = this.viewEl.createDiv({ cls: 'pbl-toolbar' });
		// Below the toolbar, above the tree, so a legend rendered into it never scrolls
		// away with the timeline it keys — the class it draws under is toggled by
		// `renderLegend` itself, which is also what makes it absent (not merely hidden)
		// off the dated axis.
		this.legendEl = this.viewEl.createDiv();
		this.treeEl = this.viewEl.createDiv({ cls: 'pbl-tree', attr: { role: 'tree', tabindex: '0' } });
		// Nothing to render until Bases delivers the first result set — say what is
		// happening instead of showing an empty pane.
		renderLoadingState(this.treeEl);

		this.selection = new SelectionController(this.treeEl, this.rowEls, () => this.board?.colEls ?? []);
		this.state = new ViewState(this);
		this.gate = new WriteGate(this, {
			syncBusy: () => this.syncBusyUi(),
			flushDataUpdate: () => this.refreshFromData(),
		});
		this.cardMoves = new CardMoveController(this, this.rowEls);
		this.ui = new ViewStateController(this.state, {
			render: () => this.render(),
			renderTreeContent: () => this.renderTreeContent(),
			refreshFromData: () => this.refreshFromData(),
			recomputeFilter: () => this.filter.recompute(this.model, this.projection),
		});
		this.dnd = new DragDropController(this, {
			viewEl: this.viewEl,
			treeEl: this.treeEl,
		});
		this.resize = new ResizePolicy(this, this.viewEl, this.treeEl, this.toolbarEl, () => this.rowCtx());
		this.cardDnd = new CardDragController(this, this.viewEl, () => this.refreshFromData());
		this.treeEl.addEventListener('keydown', (evt) => handleProjectionKeydown(this, evt));
		// The tree's row activation, once for the pane — rows are resolved per event, so
		// nothing about them is captured at render (`wireRowEvents` in `render/rows.ts`).
		wireRowEvents(this, this.treeEl);
		this.registerDomEvent(document, 'dragend', () => this.dnd.clearDragState());
		// Which columns fit depends on the pane, which changes without a data update.
		if (typeof ResizeObserver !== 'undefined') {
			// Both ladders answer to this one notification — `ResizePolicy` re-measures the
			// toolbar's before deciding about the tree's, since the observer watches the
			// TREE, whose box tracks the pane's and also narrows when the vertical
			// scrollbar appears, which the toolbar's does not.
			this.resizeObserver = new ResizeObserver(() => {
				if (this.resize.shouldRebuildOnResize()) this.renderTreeContent();
			});
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
		this.state.dispose();
		this.dnd.dispose();
		this.cardDnd.dispose();
		this.viewEl.detach();
	}

	jumpToToday(): void {
		scrollToToday(this.roadmap);
	}

	onDataUpdated(): void {
		// A batch in flight defers this and flushes it once at the end — see the gate.
		if (this.gate.deferUpdate()) return;
		// So does a card gesture, for a different reason and the same shape: a render
		// unhooks the drop target the release is aimed at, and pragmatic then finds
		// nothing to dispatch to — see `CardDragController.deferUpdate`.
		if (this.cardDnd.deferUpdate()) return;
		this.refreshFromData();
	}

	private refreshFromData(): void {
		this.watchApp();
		// Restored FIRST, not just before the collapse defaults it must not be undone by:
		// the focus level is stored here too, and it re-roots the model built below — a
		// restore after the build would show the whole tree until something else refreshed.
		this.state.restore(this.viewEl);
		// Focus is working position rather than configuration, so it comes from the store
		// and not from the `.base`; everything downstream reads it off the settings.
		this.settings = { ...resolveSettings(this.config), focusLevel: this.state.focusLevel() };
		this.model = buildModel(this.app, this.data?.data ?? [], this.settings);
		// Which properties become columns is a config question, so it is answered once
		// here rather than per render — and once, so the rows and the tag menu cannot
		// disagree about what is on screen.
		this.columns = resolveColumns(this);
		this.groupingIgnored = detectIgnoredGrouping(this.data);
		// Both populations, never `items` alone: `deliverableResults` is read off the WHOLE
		// unfocused tree so a focus set elsewhere can never hide a Deliverable, which makes
		// it the one set a focus cannot narrow — and a Deliverable arriving outside the
		// active focus subtree was therefore never ruled on, its card opening expanded
		// against the collapsed-by-default rule every other projection keeps. The same
		// split `collapsiblePopulation` states for the buttons, at the other end of it.
		this.state.collapseNewParents([...this.model.items, ...this.model.deliverableResults, ...this.model.catalog.items]);
		this.filter.recompute(this.model, this.projection);
		this.render();
	}

	/**
	 * Everything this view subscribes to on the APP, wired on the first data update
	 * rather than in the constructor — a Bases view is handed its `app` afterwards, so
	 * there is nothing to subscribe to yet when it is built. Both go through
	 * `registerEvent`, so they come off with the view.
	 *
	 * A renamed note is the same row; without that listener its state is left behind
	 * under the old path and the next refresh shuts it as a parent nobody has ruled on.
	 *
	 * `css-change` is the toolbar's: the fit ladder measures RENDERED text, so a theme or
	 * a font-size change invalidates its verdict — and nothing else notices one. The only
	 * `ResizeObserver` here watches the tree, whose box need not move when the app's font
	 * does, and no render follows a theme switch, so the row would keep a step chosen for
	 * the old metrics until the pane happened to be resized. Observing `toolbarEl` too
	 * would look like a fix and miss it: that catches only a font change that alters the
	 * row's HEIGHT, and a width-only change at the same height is exactly the case.
	 */
	private watchApp(): void {
		if (this.watchedApp) return;
		this.watchedApp = true;
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => this.state.renamePath(oldPath, file.path)),
		);
		this.registerEvent(this.app.workspace.on('css-change', () => syncToolbarFit(this.toolbarEl)));
	}

	adoptDefaultProperties(only?: OptionalField): OptionalProperty[] {
		// The narrowing belongs to the collector, never beside it: the one-field path
		// cannot then disagree with ✨ about what may be adopted (see `host.ts`).
		// Both halves resolved from the live config. `this.settings` is the last refresh's
		// snapshot, and `adoptableProperties` asks the config which options are SET while
		// asking the settings which keys are TAKEN — so mixing the two lets a property
		// pointed at a suggestion since the last refresh be skipped without its key joining
		// `taken`, and the suggestion is then bound onto it. (Codex, PR #128.)
		const adopting = adoptableProperties(this.config, resolveSettings(this.config), only);
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
		this.filter.recompute(this.model, this.projection);
		this.renderTreeContent();
	}

	focusFilter(): void {
		revealFilter(this.toolbarEl);
	}

	isRowHidden(item: BacklogItem): boolean {
		return rowHidden(item, this.visibility(true));
	}

	isRowHiddenUnfiltered(item: BacklogItem): boolean {
		return rowHidden(item, this.visibility(false));
	}

	/**
	 * The one visibility rule, assembled once. `hideCompleted` is where the Deliverables
	 * board's exception lives — that board has no completion concept of its own, so the
	 * toggle describing the requirements rollup must not reach it. Stated here rather than
	 * offered as a second method for call sites to remember: three surfaces asked the
	 * narrower question and the fourth asked the ordinary one, which is how a Deliverable
	 * card's child list came to be emptied by a setting from another projection.
	 */
	private visibility(applyFilter: boolean): VisibilityRule {
		return {
			filter: this.filter,
			settings: this.settings,
			applyFilter,
			scope: filterScopeFor(this.projection),
			hideCompleted: hidesCompleted(this.projection),
			inProjection: projectionMember(this.projection),
		};
	}

	isFilterMatch(item: BacklogItem): boolean {
		return this.filter.matched(item.file.path, filterScopeFor(this.projection));
	}

	isFiltering(): boolean {
		return this.filter.active;
	}

	// ----------------------------------------------------------- collapse state

	isCollapsed(path: string): boolean {
		// While filtering, everything on a path to a match renders expanded.
		return !this.filter.active && this.state.isCollapsed(this.collapseKey(path));
	}

	setCollapsed(path: string, collapsed: boolean): boolean {
		return this.state.set(this.collapseKey(path), collapsed);
	}

	/**
	 * Which scope a ROW's collapse question is asked in: the dated axis folds a PLAN, and
	 * every other row opens a node in the backlog, so the two keep separate bits
	 * ({@link TIMELINE_SCOPE}). Every row-shaped collapse call in the view — the tree's own
	 * chevron and the dated axis's — routes through the two methods above and therefore
	 * through here, so the row menu, the keyboard and the toolbar's bulk controls all follow
	 * the projection without any of them asking what they are looking at. A CARD's own
	 * disclosure never routes through here at all: {@link isCardCollapsed} is fixed to
	 * `CARD_SCOPE` regardless of projection or axis, because a card is the same question
	 * about the same note wherever it happens to be drawn.
	 */
	private collapseKey(path: string): string {
		// `drawsGrid`, not `=== 'dates'`: a bar's fold is one fact about the dated GRID, and
		// both axes that draw one ask it of the same bars. The resources axis groups those
		// bars by who is on them and scopes the fold to a single band (`laneEntries`), which
		// changes which rows a chevron reaches and not what the bit means — so a subtree a
		// reader shut on one of the two comes back shut on the other, which is the answer a
		// second bit could not give without the two grids disagreeing about one plan.
		const grid = this.projection === 'roadmap' && drawsGrid(activeAxis(this.settings, this.axisPick) ?? 'horizons');
		return grid ? TIMELINE_SCOPE + path : path;
	}

	isCardCollapsed(path: string): boolean {
		// While filtering, everything on a path to a match renders expanded — the same
		// override `isCollapsed` gives a row, asked of the card's own scope.
		return !this.filter.active && this.state.isCollapsed(CARD_SCOPE + path);
	}

	setCardCollapsed(path: string, collapsed: boolean): boolean {
		return this.state.set(CARD_SCOPE + path, collapsed);
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
		this.opens.open(this, item, evt);
	}

	openItemIn(item: BacklogItem, target: OpenTarget): void {
		this.opens.openIn(this, item, target);
	}

	showContextMenuFor(item: BacklogItem): void {
		showContextMenu(this, item, this.rowEls.get(item.file.path) ?? null);
	}

	showColumnMenuFor(index: number): boolean {
		return showColumnMenuForIndex(this, this.board, index);
	}

	/**
	 * Re-render one row's children after an expand or collapse. Rebuilding the whole
	 * tree for it is the difference between instant and visibly slow once a backlog
	 * has a few hundred rows.
	 */
	refreshSubtree(item: BacklogItem): void {
		// Straight off the index rather than through a helper: this and the context menu
		// were its only two callers, and the lookup says what it does.
		const row = this.rowEls.get(item.file.path);
		if (!row) {
			this.render();
			return;
		}
		refreshRowChildren(this.rowCtx(), item, row);
		// Expanding or collapsing changes the deepest rendered row, and with it the
		// room the columns have left — in both directions.
		if (this.resize.refit()) this.renderTreeContent();
		// The selection may have been inside the subtree that just collapsed.
		this.selection.resyncAfterRender();
	}

	// ------------------------------------------------------------------- render

	render(): void {
		const model = this.model;
		if (!model) return;
		renderToolbar(this, this.toolbarEl);
		// The toolbar was just rebuilt; a batch may still be running behind it.
		this.syncBusyUi();
		this.renderTreeContent();
	}

	/** Re-render only the content pane — used by the filter so the toolbar input keeps focus. */
	private renderTreeContent(): void {
		syncFilterUi(this, this.toolbarEl);
		if (!this.model) return;
		const result = renderPass(
			this,
			{ viewEl: this.viewEl, treeEl: this.treeEl, toolbarEl: this.toolbarEl, legendEl: this.legendEl },
			{
				selection: this.selection,
				resize: this.resize,
				dnd: this.dnd,
				cardDnd: this.cardDnd,
				rowCtx: () => this.rowCtx(),
				scroll: this.scroll,
				// The one thing the pass cannot do itself — `BacklogViewHost` exposes both
				// snapshots as readonly — called at the point these two lines used to sit,
				// which is what keeps the pass's own later readers off a stale frame.
				publish: (board, roadmap) => {
					this.board = board;
					this.roadmap = roadmap;
				},
			},
		);
		this.scroll = result.scroll;
		// Measured against the tree that now exists, scrollbar and all. A changed
		// verdict means a column came or went, which only the rows can show — one
		// more pass, guarded, since the second pass measures the same tree.
		if (result.refitNeeded && !this.refitting) {
			this.refitting = true;
			try {
				this.renderTreeContent();
			} finally {
				this.refitting = false;
			}
		}
	}

	/** The per-pass render state: the row index plus the hoisted config lookups. */
	private rowCtx(): RowContext {
		return rowContext(this, this.rowEls, this.cardKids);
	}

	// -------------------------------------------------------------------- writes

	/**
	 * The card-move plumbing (planning, applying and announcing a board, horizon or
	 * schedule move) lives in `CardMoveController` — see `src/view/cardMoves.ts` for
	 * why. These stay here as one-line delegations, the same shape `applySafely`
	 * /`canUndo`/`undoLast` already use for the write gate, so `BacklogViewHost` still
	 * resolves to this one class and nothing that calls them has to change.
	 */
	performBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		return this.cardMoves.performBoardMove(item, state);
	}

	performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		return this.cardMoves.performDeliverablesBoardMove(item, state);
	}

	performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean> {
		return this.cardMoves.performHorizonMove(item, horizon);
	}

	performResourceMove(item: BacklogItem, name: string | null, when?: ScheduleGesture): Promise<boolean> {
		return this.cardMoves.performResourceMove(item, name, when);
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
