import { BasesView, Keymap, Menu, QueryController, setIcon } from 'obsidian';
import { CollapseState, TIMELINE_SCOPE } from './collapseState';
import { FilterScope, FilterState } from './filterState';
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
import { ScaleId } from '../domain/timeline';
import { forgetBacklogView, rememberBacklogView } from './registry';
import { ResizePolicy } from './resize';
import { rowHidden, VisibilityRule } from './rowVisibility';
import { SelectionController } from './selection';
import { UiStateController } from './uiState';
import { detectIgnoredGrouping, renderToolbar, revealFilter, syncBusy, syncCollapseCtls, syncCountLabel, syncFilterUi } from './render/toolbar';
import { chipProps, rowContext, RowContext } from './render/columns';
import { renderLoadingState } from './render/emptyStates';
import { renderLegend } from './render/legend';
import { syncToolbarFit } from './render/toolbarFit';
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
	private legendEl: HTMLElement;
	private treeEl: HTMLElement;
	private rootDropEl: HTMLElement;
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

	settings: BacklogSettings = defaultSettings();
	model: BacklogModel | null = null;
	private readonly filter = new FilterState();
	groupingIgnored = false;
	private readonly collapse: CollapseState;
	/** The write path: validation, serialization, progress and the undo slot. */
	private readonly gate: WriteGate;
	/** Card-move write orchestration: plans, applies and announces board/horizon/schedule moves. */
	private readonly cardMoves: CardMoveController;
	/** The collapse-store-backed UI state — projection, axis pick, focus, shelf, zoom,
	 * density, lead width — see `uiState.ts`. */
	private readonly ui: UiStateController;
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
	chips: ChipProp[] = [];

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
		this.ui = new UiStateController(this.collapse, {
			render: () => this.render(),
			renderTreeContent: () => this.renderTreeContent(),
			refreshFromData: () => this.refreshFromData(),
		});
		this.dnd = new DragDropController(this, {
			viewEl: this.viewEl,
			treeEl: this.treeEl,
			rootDropEl: this.rootDropEl,
		});
		this.resize = new ResizePolicy(this, this.viewEl, this.treeEl, this.toolbarEl, () => this.rowCtx());
		this.dnd.setupRootDropZone();
		this.cardDnd = new CardDragController(this, this.viewEl);
		this.treeEl.addEventListener('keydown', (evt) => handleProjectionKeydown(this, evt));
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
		this.collapse.dispose();
		this.dnd.dispose();
		this.cardDnd.dispose();
		this.viewEl.detach();
	}

	/**
	 * Which projection this view shows. UI state, not a base setting: it lives
	 * beside the collapse state — per saved view, per device — never in the `.base`.
	 * This and the seven accessors below are one-line delegations to `UiStateController`
	 * (`uiState.ts`), which holds the read/write and the render-depth choice; kept here
	 * because `BacklogViewHost` has to resolve to this one class.
	 */
	get projection(): Projection {
		return this.ui.projection;
	}

	setProjection(mode: Projection): void {
		this.ui.setProjection(mode);
	}

	/** The retained roadmap-axis pick for this saved view; null before the user picks. */
	get axisPick(): string | null {
		return this.ui.axisPick;
	}

	setAxisPick(axis: RoadmapAxis): void {
		this.ui.setAxisPick(axis);
	}

	setFocusLevel(level: string): void {
		this.ui.setFocusLevel(level);
	}

	get shelfCollapsed(): boolean {
		return this.ui.shelfCollapsed;
	}

	setShelfCollapsed(collapsed: boolean): void {
		this.ui.setShelfCollapsed(collapsed);
	}

	get shelfSort(): ShelfSort {
		return this.ui.shelfSort;
	}

	setShelfSort(sort: ShelfSort): void {
		this.ui.setShelfSort(sort);
	}

	get shelfHiddenTypes(): ReadonlySet<string> {
		return this.ui.shelfHiddenTypes;
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.ui.setShelfHiddenTypes(types);
	}

	get zoom(): ScaleId {
		return this.ui.zoom;
	}

	setZoom(id: ScaleId): void {
		this.ui.setZoom(id);
	}

	get density(): string | null {
		return this.ui.density;
	}

	setDensity(value: string | null): void {
		this.ui.setDensity(value);
	}

	get leadWidth(): number | null {
		return this.ui.leadWidth;
	}

	setLeadWidth(value: number | null): void {
		this.ui.setLeadWidth(value);
	}

	jumpToToday(): void {
		const roadmap = this.roadmap;
		// `leadWidth` is in the guard beside `todayLeft` rather than defaulted below it:
		// `renderRoadmap` sets both in the dated branch and neither anywhere else, so the
		// term costs nothing and it is what narrows `leadWidth` to a number.
		if (!roadmap?.scroller || roadmap.todayLeft === null || roadmap.leadWidth === null) return;
		roadmap.scroller.scrollLeft = centreOnToday(roadmap.todayLeft, roadmap.scroller.clientWidth, roadmap.leadWidth);
	}

	onDataUpdated(): void {
		// A batch in flight defers this and flushes it once at the end — see the gate.
		if (this.gate.deferUpdate()) return;
		this.refreshFromData();
	}

	private refreshFromData(): void {
		this.watchApp();
		// Restored FIRST, not just before the collapse defaults it must not be undone by:
		// the focus level is stored here too, and it re-roots the model built below — a
		// restore after the build would show the whole tree until something else refreshed.
		this.collapse.restore(this.viewEl);
		// Focus is working position rather than configuration, so it comes from the store
		// and not from the `.base`; everything downstream reads it off the settings.
		this.settings = { ...resolveSettings(this.config), focusLevel: this.collapse.focusLevel() };
		this.model = buildModel(this.app, this.data?.data ?? [], this.settings);
		// Which properties become columns is a config question, so it is answered once
		// here rather than per render — and once, so the rows and the tag menu cannot
		// disagree about what is on screen.
		this.chips = chipProps(this);
		this.groupingIgnored = detectIgnoredGrouping(this.data);
		// Both populations, never `items` alone: `deliverableResults` is read off the WHOLE
		// unfocused tree so a focus set elsewhere can never hide a Deliverable, which makes
		// it the one set a focus cannot narrow — and a Deliverable arriving outside the
		// active focus subtree was therefore never ruled on, its card opening expanded
		// against the collapsed-by-default rule every other projection keeps. The same
		// split `collapsiblePopulation` states for the buttons, at the other end of it.
		this.collapse.collapseNewParents([...this.model.items, ...this.model.deliverableResults]);
		this.filter.recompute(this.model);
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
			this.app.vault.on('rename', (file, oldPath) => this.collapse.renamePath(oldPath, file.path)),
		);
		this.registerEvent(this.app.workspace.on('css-change', () => syncToolbarFit(this.toolbarEl)));
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
			scope: this.filterScope,
			hideCompleted: this.projection !== 'deliverables',
		};
	}

	isFilterMatch(item: BacklogItem): boolean {
		return this.filter.matched(item.file.path, this.filterScope);
	}

	/**
	 * Which of the filter's indexes this projection's questions are answered from —
	 * decided ONCE here rather than at each of the three call sites, because getting it
	 * wrong at one of them is invisible until someone types into the box on that exact
	 * projection. The Deliverables board renders `model.deliverableResults`, built from
	 * the whole unfocused tree; every other projection renders out of `model.roots`,
	 * which a focus narrows. See `FilterScope`, which states why one index cannot serve
	 * both and what it cost to learn that.
	 */
	private get filterScope(): FilterScope {
		return this.projection === 'deliverables' ? 'whole' : 'focused';
	}

	isFiltering(): boolean {
		return this.filter.active;
	}

	// ----------------------------------------------------------- collapse state

	isCollapsed(path: string): boolean {
		// While filtering, everything on a path to a match renders expanded.
		return !this.filter.active && this.collapse.isCollapsed(this.collapseKey(path));
	}

	setCollapsed(path: string, collapsed: boolean): boolean {
		return this.collapse.set(this.collapseKey(path), collapsed);
	}

	/**
	 * Which scope a collapse question is asked in: the dated axis is reading a PLAN, and
	 * every other projection is reading the backlog, so the two keep separate bits
	 * ({@link TIMELINE_SCOPE}). Every collapse call in the view routes through the two
	 * methods above and therefore through here, so the chevron, the row menu, the keyboard
	 * and the toolbar's bulk controls all follow the projection without any of them asking
	 * what they are looking at.
	 *
	 * The PROJECTION and not the control, which is a decision and not an oversight: the
	 * shelf and context cards drawn beside the grid take the axis's scope too, because
	 * they are on that screen and the working position being kept is the screen's. Scoping
	 * the row chevron alone would leave a card beside it writing the tree's bit, and then
	 * the toolbar's Collapse all — which settles items no surface drew — would have no
	 * single answer for the ones it cannot see.
	 */
	private collapseKey(path: string): string {
		const dated = this.projection === 'roadmap' && activeAxis(this.settings, this.axisPick) === 'dates';
		return dated ? TIMELINE_SCOPE + path : path;
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
		const model = this.model;
		if (!model) return;
		const projection = this.projection;
		this.viewEl.toggleClass('pbl-board-mode', projection === 'board' || projection === 'deliverables');
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
		// Same lifetime as the row index: a set that outlived its render would claim
		// disclosures for a screen that is gone.
		this.cardKids.clear();
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
		// Beside `syncCountLabel` for the same reason: both read what the content render
		// just produced, so both have to run after it rather than in the toolbar pass.
		syncCollapseCtls(this, this.toolbarEl);
		// Rendered HERE rather than in `render()`: the legend keys what the grid just drew,
		// and `drawn` comes off the snapshot this pass produced. Every path that redraws
		// content has to refresh it, not only a full render — a filter re-renders content
		// ALONE, and it can hide the last bar drawing a colour (or reveal the first), which
		// changes what the key must say. Above the early return below, because that return
		// is the tree's and this is the roadmap's.
		const drawn = this.roadmap?.drawn ?? { done: false, milestone: false, accent: false };
		renderLegend(this, this.legendEl, this.roadmap?.palettes ?? [], drawn);
		// Every render that reaches here can have changed the row's width: the toolbar
		// was rebuilt with a different projection zone, or the count label went from
		// "18 items" to "3 of 18", or the primary button is naming a different type.
		// After the content, because the count is one of the things being measured.
		syncToolbarFit(this.toolbarEl);
		if (projection !== 'tree') return;
		// Measured against the tree that now exists, scrollbar and all. A changed
		// verdict means a column came or went, which only the rows can show — one
		// more pass, guarded, since the second pass measures the same tree.
		if (this.resize.refit() && !this.refitting) {
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
		return rowContext(this, this.dnd, this.rowEls, this.cardKids);
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
