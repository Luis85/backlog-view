import { BasesView, Keymap, Notice, QueryController, setIcon } from 'obsidian';
import { CollapseState } from './collapseState';
import { FilterState } from './filterState';
import {
	BacklogViewHost,
	BoardSnapshot,
	BusyState,
	ChipProp,
	PRODUCT_BACKLOG_VIEW_TYPE,
	Projection,
	RoadmapSnapshot,
} from './host';
import { announceBoardMove, announceHorizonMove, CardDragController } from './interactions/cardDrag';
import { DragDropController } from './interactions/dragDrop';
import { handleProjectionKeydown } from './interactions/keyboard';
import { buildItemMenu } from './interactions/menu';
import { BacklogItem, BacklogModel, buildModel } from '../domain/model';
import { childTypeChoices } from '../domain/itemTypes';
import { DropTarget } from '../domain/dropTargets';
import { horizonSource, RoadmapAxis } from '../domain/roadmap';
import { computeDropWrites, computeHorizonWrites, computeStateWrites, ItemWrite } from '../domain/writePlan';
import { todayStamp } from '../domain/noteFields';
import { applyWrites, RestoreWrite } from '../storage/frontmatter';
import { ReplayTracker, replayRun, UndoRecovery } from './interactions/undo';
import { forgetBacklogView, rememberBacklogView } from './registry';
import { SelectionController } from './selection';
import { detectIgnoredGrouping, renderToolbar, syncBusy, syncCountLabel, syncFilterUi } from './render/toolbar';
import { chipProps, rowContext, RowContext, syncColumnFit } from './render/columns';
import { renderLoadingState } from './render/emptyStates';
import { renderProjectionContent, restoreScroll, ScrollAnchor } from './render/projections';
import { refreshRowChildren } from './render/rows';
import { BacklogSettings, configProblems, defaultSettings, resolveSettings } from '../domain/settings';

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
	private scroll: ScrollAnchor = { content: '', todayLeft: null };
	/** Selection state and its DOM bookkeeping, for both projections. */
	private readonly selection: SelectionController;

	settings: BacklogSettings = defaultSettings();
	model: BacklogModel | null = null;
	private readonly filter = new FilterState();
	groupingIgnored = false;
	private readonly collapse: CollapseState;
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

		this.selection = new SelectionController(this.treeEl, this.rowEls, () => this.board?.colEls ?? []);
		this.collapse = new CollapseState(this);
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

	/** Re-measure after a resize, and rebuild only if a column came or went. */
	private onResize(): void {
		// Board columns and the timeline scroll horizontally instead of dropping
		// columns; the fit ladder is the tree's.
		if (this.projection !== 'tree') return;
		if (this.refit()) this.renderTreeContent();
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
		const childTypes = childTypeChoices(item);
		const menu = buildItemMenu(this, item, childTypes);
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
		if (this.refit()) this.renderTreeContent();
		// The selection may have been inside the subtree that just collapsed.
		this.selection.resyncAfterRender();
	}

	// ------------------------------------------------------------------- render

	render(): void {
		if (!this.model) return;
		renderToolbar(this, this.toolbarEl);
		// The toolbar was just rebuilt; a batch may still be running behind it.
		syncBusy(this.toolbarEl, this.busy, this.canUndo());
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
		// The keyboard instructions belong to the board and are rebuilt with it below;
		// dropped here so the attribute never outlives the element it points at — a
		// dangling `aria-describedby` is read as no description at all.
		this.treeEl.removeAttribute('aria-describedby');
		this.dnd.onRenderStart();
		this.cardDnd.onRenderStart();
		this.viewEl.toggleClass('pbl-focused', model.focused);
		// Collapse controls and drag grips are inert while a filter is active.
		this.viewEl.toggleClass('pbl-filtering', this.isFiltering());

		const scrollTop = this.treeEl.scrollTop;
		const scrollLeft = this.treeEl.scrollLeft;
		this.treeEl.empty();
		this.rowEls.clear();
		if (projection !== 'tree') {
			// The column-fit ladder is the tree's; its stale verdicts must not hide card cells.
			this.viewEl.removeClass('pbl-hide-props', 'pbl-hide-meta', 'pbl-hide-state');
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
		this.scroll = restoreScroll(this.treeEl, this.scroll, this.roadmap, projection, { top: scrollTop, left: scrollLeft });
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
		if (!(await this.applyMove(item, writes))) return false;
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

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		// Dropping into a collapsed parent reveals where the item landed.
		if (target.parent) this.setCollapsed(target.parent.file.path, false);
		await this.applyMove(dragged, computeDropWrites(dragged, target, this.settings));
	}

	/**
	 * Apply a move and mark its row pending until the Bases refresh re-renders it in
	 * place. Both projections move items, so both need the same holding signal —
	 * cleared only on failure, because success is followed by the row's replacement.
	 */
	private async applyMove(item: BacklogItem, writes: ItemWrite[]): Promise<boolean> {
		const row = this.rowElFor(item);
		row?.classList.add('pbl-pending');
		const applied = await this.applySafely(writes);
		if (!applied) row?.classList.remove('pbl-pending');
		return applied;
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
		// What the slot becomes is the recovery's question, not the gate's: a
		// completed replay rejoins any redo stranded by the failure it recovered
		// from, and one that failed partway holds its place with the unfinished
		// remainder, so the next undo finishes taking the change back.
		this.lastUndo = this.recovery.settle(ok, restores, batch, tracker, this.lastUndo);
		// The gate's closing sync ran before this bookkeeping settled the slot — a
		// consumed retry re-arms the carried redo AFTER setBusy(null) disabled the
		// button — so publish the settled answer.
		syncBusy(this.toolbarEl, this.busy, this.canUndo());
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
