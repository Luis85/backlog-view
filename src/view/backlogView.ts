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
import {
	announceBoardMove,
	announceHorizonMove,
	announceScheduleMove,
	CardDragController,
} from './interactions/cardDrag';
import { DragDropController } from './interactions/dragDrop';
import { handleProjectionKeydown } from './interactions/keyboard';
import { buildColumnMenu, buildItemMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel } from '../domain/model';
import { childTypeChoices, placementEnds, PlacementEnd } from '../domain/itemTypes';
import { placeItem } from '../domain/bars';
import { DropTarget } from '../domain/dropTargets';
import { activeAxis, horizonSource, RoadmapAxis } from '../domain/roadmap';
import {
	computeDropWrites,
	computeHorizonWrites,
	computeScheduleWrites,
	computeStateWrites,
	ItemWrite,
	SchedulePlan,
} from '../domain/writePlan';
import { todayStamp } from '../domain/noteFields';
import { ScaleId, scaleFor } from '../domain/timeline';
import { forgetBacklogView, rememberBacklogView } from './registry';
import { SelectionController } from './selection';
import { detectIgnoredGrouping, renderToolbar, syncBusy, syncCountLabel, syncFilterUi, syncShelfToggle } from './render/toolbar';
import { chipProps, rowContext, RowContext, syncColumnFit } from './render/columns';
import { renderLoadingState } from './render/emptyStates';
import { captureScroll, renderProjectionContent, restoreScroll, ScrollAnchor } from './render/projections';
import { refreshRowChildren } from './render/rows';
import { syncShelfFit } from './render/roadmap';
import { TIMELINE_LEAD_PX } from './render/timeline';
import { uniqueElementId } from './selection';
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
	/** Null until the reader presses: the pane's width decides until then. */
	private shelfOpenFlag: boolean | null = null;
	/** Fixed for the life of this view — see `BacklogViewHost.shelfId`. */
	readonly shelfId = uniqueElementId('pbl-shelf');

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

	get shelfOpen(): boolean | null {
		return this.shelfOpenFlag;
	}

	setShelfOpen(open: boolean): void {
		this.shelfOpenFlag = open;
		// No render: the cards are already in the DOM and a class decides whether they
		// show, which is the whole reason this measure needs no second pass.
		syncShelfFit(this, this.treeEl);
		syncShelfToggle(this, this.toolbarEl);
	}

	/** Re-measure after a resize, and rebuild only if a column came or went. */
	private onResize(): void {
		// The COLUMN ladder is the tree's — board columns and the timeline scroll
		// rather than dropping columns — and that reason stays true. What is new is
		// that the roadmap has a measured question of its own: the shelf's fit, which
		// needs no second render pass because its cards are already in the DOM.
		if (this.projection === 'roadmap') {
			syncShelfFit(this, this.treeEl);
			syncShelfToggle(this, this.toolbarEl);
			return;
		}
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
		// The roadmap's own measured question, gated inside `syncShelfFit` to the dated
		// axis with a live shelf — harmless to call for the tree and the board, which
		// carry no roadmap snapshot for it to act on. Run before the resync below: a
		// compaction that just clamped the selection must land before the selection is
		// re-applied to the DOM, or a released path would still point `aria-activedescendant`
		// at a card the class-only collapse just hid.
		syncShelfFit(this, this.treeEl);
		syncShelfToggle(this, this.toolbarEl);
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
	 * The shape both card moves share: a planned batch, applied, then announced once
	 * — whichever of the three inputs made it, a drag, an Alt+arrow or the card menu.
	 * An empty batch resolves false and says nothing: a move onto the card's own
	 * column or bucket must cost neither the undo slot it had nor a sentence about a
	 * change that did not happen.
	 *
	 * `say` is a closure over vocabulary captured BEFORE the write, because a Bases
	 * update arriving mid-batch is rebuilt into `this.board` / `this.roadmap` the
	 * instant the batch ends — which is before the await below resolves. By then the
	 * column or bucket just vacated may be gone with its last card, and naming the
	 * move from the new render would report a place the user never touched.
	 */
	private async applyCardMove(item: BacklogItem, writes: ItemWrite[], say: () => void): Promise<boolean> {
		if (writes.length === 0) return false;
		const outcome = await this.applyMove(item, writes);
		if (outcome === null || !outcome.changed) return false;
		say();
		return true;
	}

	async performBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		const from = item.stateValue;
		const columns = this.board?.board;
		return this.applyCardMove(item, computeStateWrites(item, state, this.settings, todayStamp()), () =>
			announceBoardMove(columns, item.title, from, state),
		);
	}

	async performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean> {
		// Both facts about where it came from, taken together: the reading alone cannot
		// say whether the key was there, and an empty key is a real thing to clear.
		const from = horizonSource(item);
		const buckets = this.roadmap?.roadmap;
		return this.applyCardMove(item, computeHorizonWrites(item, horizon), () =>
			announceHorizonMove(buckets, item.title, from, horizon),
		);
	}

	async performScheduleMove(
		item: BacklogItem,
		plan: SchedulePlan,
		from?: Partial<Record<PlacementEnd, string | null>>,
		ends?: PlacementEnd[],
	): Promise<boolean> {
		// Both expectations ride through untouched: what a relative gesture measured
		// against, and the placement shape it was planned under. Neither can be recomputed
		// here — deriving `ends` from the item this method was handed asks the CURRENT
		// type, which is the very thing the writer is meant to catch having changed. A
		// PBI that became a Milestone mid-hold would narrow a two-ended slide to a
		// target-only write and apply it; the reverse would make a marker's slide arrive
		// looking like an ordinary end-grip write. The caller that has no captured shape —
		// the modal, the menu — passes none and gets the item's own, which is right for a
		// gesture that was planned against it a moment ago.
		const writes = computeScheduleWrites(item, plan, ends ?? placementEnds(item.typeName), from);
		if (writes.length === 0) return false;
		const outcome = await this.applyMove(item, writes);
		// Not "did the call return" but "did the note change": the planner now hands the
		// gate a non-empty batch for a re-confirmed date, and `runExclusively` reports
		// success for anything that completed. Announcing on that would tell a
		// screen-reader user about a move that did not happen.
		if (outcome === null || !outcome.changed || outcome.dates === null) return false;
		// The placement is asked of `placeItem` — the function that decides what draws —
		// with the ends the WRITER saw rather than the ones the model holds. Reading a
		// rebuilt model here would be a race: the refresh is Obsidian re-running the
		// query, not something this await orders, so the row could be either side of the
		// write depending on timing.
		//
		// What that buys is exact for the note's OWN ends, and only those. A span
		// `inferSpan` fills from descendants still rests on `item.descendantStart` /
		// `descendantTarget`, which are model-time: a child whose dates another editor
		// changed since this model was built would be announced at its old span while the
		// next render draws the new one. That is not fixable here — re-resolving from the
		// model is the race above, and the writer opens only the files in its own batch,
		// so no fresher descendant evidence exists at this point. The narrow claim is
		// therefore what is stated: the dates this write landed are the writer's, and an
		// inherited end is as current as the last refresh.
		const spoken = placementEnds(item.typeName);
		// `outcome.dates.after` is already the tri-state the writer read back — passing
		// it straight through is what lets an untouched end's own invalid value survive
		// into the placement, rather than a wrapper laundering it into absence.
		announceScheduleMove(item.title, outcome.dates, placeItem(item, outcome.dates.after), spoken);
		return true;
	}

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		// Dropping into a collapsed parent reveals where the item landed.
		if (target.parent) this.setCollapsed(target.parent.file.path, false);
		await this.applyMove(dragged, computeDropWrites(dragged, target, this.settings));
	}

	/**
	 * Apply a move and mark its row pending until the Bases refresh re-renders it in
	 * place. Both projections move items, so both need the same holding signal —
	 * cleared on refusal AND on a batch that changed nothing, because only a real
	 * change brings the refresh that would replace the row: a stale Unschedule of
	 * dates another editor already removed, or a batch the shape or baseline check
	 * refuses, would otherwise leave the card looking permanently in flight.
	 */
	private async applyMove(item: BacklogItem, writes: ItemWrite[]): Promise<WriteOutcome | null> {
		const row = this.rowElFor(item);
		row?.classList.add('pbl-pending');
		const applied = await this.applySafely(writes);
		if (applied === null || !applied.changed) row?.classList.remove('pbl-pending');
		return applied;
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

/**
 * The scroll offset that puts today in the middle of the band the reader can actually
 * SEE — the scroller's width minus the sticky lead column, which covers the same
 * pixels at every scroll position and is never part of the band being centred.
 */
function centreOnToday(todayLeft: number, clientWidth: number): number {
	return Math.max(todayLeft - (TIMELINE_LEAD_PX + clientWidth) / 2, 0);
}
