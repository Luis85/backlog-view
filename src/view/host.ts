import { App, BasesPropertyId, BasesViewConfig } from 'obsidian';
import { BoardModel, StatePalette } from '../domain/board';
import { BacklogItem, BacklogModel } from '../domain/model';
import { DropTarget } from '../domain/dropTargets';
import { RoadmapAxis, RoadmapModel } from '../domain/roadmap';
import { ShelfSort } from '../domain/shelf';
import { PlacementEnd } from '../domain/itemTypes';
import { ScaleId, TimelineScale, TimelineWindow } from '../domain/timeline';
import { ItemWrite, SchedulePlan } from '../domain/writePlan';
import { BacklogSettings, OptionalProperty } from '../domain/settings';
import { OpenTarget } from '../domain/itemHandling';
import { WriteOutcome } from '../storage/frontmatter';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

/**
 * The four readings of one backlog. UI state, not a base setting: the choice
 * lives beside the collapse state in vault-scoped localStorage — per saved view,
 * per device — and never in the `.base`.
 */
export type Projection = 'tree' | 'board' | 'roadmap' | 'deliverables';

/**
 * A column of the trailing strip: the property id to read, the label the header shows,
 * and WHICH RENDERING it gets. Membership and order belong to the Bases properties
 * menu alone — a kind never decides whether a column exists, only what is drawn inside
 * it. Declared here with the other view state the host exposes, so the interface every
 * module depends on depends on nothing itself.
 */
export type ColumnKind = 'value' | 'tags' | 'state' | 'horizon' | 'risk';

export interface Column {
	prop: BasesPropertyId;
	label: string;
	kind: ColumnKind;
}

/** Progress of the write batch in flight, for the toolbar's busy indicator. */
export interface BusyState {
	done: number;
	total: number;
}

/**
 * The board as last rendered: the derived columns and their elements, in column
 * order. The keyboard needs both — the columns to know where a selection can go,
 * the elements to put the focus outline and `aria-activedescendant` there.
 */
export interface BoardSnapshot {
	board: BoardModel;
	colEls: HTMLElement[];
}

/** One scroll box the frame owns, keyed by WHICH BAND IT IS rather than by position. */
export interface ScrollBox {
	key: string;
	el: HTMLElement;
}

/**
 * Which override colours the dated axis actually drew this pass — see
 * `TimelineRender.drawn` (`render/timeline.ts`) for where each is decided. Declared
 * here, beside `RoadmapSnapshot`, rather than imported from `render/timeline.ts`: that
 * module reaches `host.ts` (through `RowContext`), so the other direction would cycle.
 */
export interface DrawnColors {
	/** A bar overridden green by `.pbl-timeline-row.pbl-done .pbl-bar` — wins outright. */
	done: boolean;
	/** A bar drawing the cyan diamond (`.pbl-bar-milestone`) — beats a state slot too. */
	milestone: boolean;
	/** A bar with none of the above: no slot, no done override, no milestone cyan. */
	accent: boolean;
}

/**
 * The roadmap as last rendered: the derived model, and the rendered cards in
 * reading order — axis first, then the shelf, then the context strip — which is
 * the order the keyboard walks.
 */
export interface RoadmapSnapshot {
	roadmap: RoadmapModel;
	/**
	 * The NAVIGABLE cards, in reading order — axis first, then the shelf, then
	 * context. A collapsed shelf contributes none, exactly as an empty one does, so
	 * the keyboard walk and `aria-activedescendant` never reach past what is on screen.
	 */
	cards: BacklogItem[];
	/**
	 * The shelf's own element for THIS render. Carried so a control that rebuilt the
	 * pane can find its own replacement afterwards — the pressed button is gone by
	 * then, and focus has to follow the part it played rather than the node. Null only
	 * where no frame was drawn at all, which is also where there is nothing to refocus.
	 */
	shelfEl: HTMLElement | null;
	/** Pixel offset of the today line inside the grid, or null on the horizon axis. */
	todayLeft: number | null;
	/**
	 * The element that scrolls the timeline — both axes on the dated one. Null off it,
	 * where the pane is still the scroll box, which is every other projection.
	 */
	scroller: HTMLElement | null;
	/**
	 * Every scroll box in the frame, the pane excluded (the view adds that). Bounding
	 * the bands turned each of them into a scroll box of its own, and a rebuild empties
	 * the whole pane: the shelf is the one that bites, because scheduling a card IS a
	 * rebuild, so a reader working down a long shelf would be thrown back to its top on
	 * every drop.
	 */
	boxes: ScrollBox[];
	/** The window the grid drew, for the drag's px↔date and for the zoom anchor. */
	window: TimelineWindow | null;
	/** The density the grid drew at; null on the horizon axis. */
	scale: TimelineScale | null;
	/**
	 * The lead-column width this render actually drew, resolved once from the user's
	 * pick or `TIMELINE_LEAD_PX` and then clamped to what the pane can actually give
	 * (`effectiveLeadWidth`); null on the horizon axis. Everything downstream that used
	 * to read `TIMELINE_LEAD_PX` directly — the scroll-centring math, the drag's
	 * lead-column hit test — reads this instead, so a resize cannot leave one of them
	 * disagreeing with what is actually drawn, and a pane too narrow for the stored pick
	 * cannot leave one of them assuming room that is not there.
	 */
	leadWidth: number | null;
	/**
	 * Which override colours were actually drawn on the dated axis this pass — see
	 * `TimelineRender.drawn`, which this carries out unchanged. All `false` on the
	 * horizon axis, where nothing draws a bar at all. The legend reads this instead of
	 * re-deciding a bar's colour from `results`, which is the copy of `barClasses`'s
	 * precedence that missed the outside-window case.
	 */
	drawn: DrawnColors;
	/**
	 * The state vocabularies the bars were keyed into this pass, in slot order — empty on
	 * the horizon axis, where nothing draws a bar. Carried out of the render rather than
	 * rebuilt by the legend for the same reason `drawn` is: the legend exists only to
	 * explain the colours on the grid, so it has to key the very list the grid used. Two
	 * calls to `statePalettes` would agree today and are two places to change tomorrow.
	 */
	palettes: StatePalette[];
}

/**
 * The surface ProductBacklogView exposes to its render and interaction modules.
 * Everything DOM-independent goes through this interface so the modules stay
 * small, cycle-free and testable.
 */
export interface BacklogViewHost {
	readonly app: App;
	readonly config: BasesViewConfig;
	readonly settings: BacklogSettings;
	readonly model: BacklogModel | null;
	/**
	 * The Base's visible properties resolved into the columns the rows render, once
	 * per data update. Anything asking "is this property on screen" reads this rather
	 * than re-deriving it from the config — that is what keeps the tag column and the
	 * tag menu from disagreeing about what the row shows.
	 */
	readonly columns: readonly Column[];
	/**
	 * How many of {@link columns} the last measurement said this pane can hold — null
	 * before anything has been measured, and on every card projection, where the ladder
	 * does not apply. Written by `syncColumnFit` alone and read by `rowContext`, which
	 * slices the list the renderers draw.
	 */
	readonly columnsShown: number | null;
	setColumnsShown(shown: number | null): void;
	readonly selectedPath: string | null;
	/** Current quick-filter text ('' when inactive). Dragging is disabled while filtering. */
	readonly filterText: string;
	/** True when the Base has a group-by configured, which this view does not apply. */
	readonly groupingIgnored: boolean;

	/**
	 * True when this item's row is not rendered: excluded by the quick filter or,
	 * while completed items are hidden, part of a fully-done subtree. Rendering,
	 * keyboard navigation and menus consult this; data operations never do —
	 * order math always runs over the full sibling lists.
	 *
	 * ONE method, for every projection. The Deliverables board's exception — no
	 * completion concept of its own, so the toggle cannot reach it — is inside this
	 * answer (`VisibilityRule.hideCompleted`), never a second method a caller picks
	 * between: three surfaces picked the narrower one and the fourth did not, which
	 * emptied a Deliverable card's child disclosure from a setting flipped elsewhere.
	 */
	isRowHidden(item: BacklogItem): boolean;
	/**
	 * The same rule with the quick filter suspended: the population a filtered count
	 * is "of". Everything else that hides rows still applies — a stage's full count
	 * is the work in it, not the work in it plus what another setting is hiding.
	 */
	isRowHiddenUnfiltered(item: BacklogItem): boolean;
	/**
	 * True when the quick filter matched this item ITSELF, rather than keeping it on
	 * screen for a relative that matched. The distinction is what lets a card say
	 * which of the things below it the search actually found.
	 */
	isFilterMatch(item: BacklogItem): boolean;
	/**
	 * True while the quick filter is narrowing the tree. Collapse state, dragging
	 * and their affordances pause on exactly this condition — not on the raw input
	 * text, which may be whitespace that filters nothing.
	 */
	isFiltering(): boolean;
	/** Update the quick filter, sync the toolbar input, and re-render the tree. */
	setFilter(text: string): void;
	/** Move keyboard focus into the toolbar filter input. */
	focusFilter(): void;

	/**
	 * Whether this item's ROW is folded — a tree row, or a dated-axis timeline bar. A
	 * caller passes a path and never a scope: the dated axis folds grid rows and every
	 * other surface opens a tree node, so the two keep separate bits and the view picks
	 * between them (`collapseKey`). Never a card's own disclosure — that is
	 * {@link isCardCollapsed}, a genuinely different question asked of the same note, and
	 * calling this one for it would reopen exactly the surprise the split exists to end:
	 * a bulk tree action reaching into a card nobody asked it to touch.
	 */
	isCollapsed(path: string): boolean;
	/** Returns true when the state actually changed. Scoped exactly as `isCollapsed` is. */
	setCollapsed(path: string, collapsed: boolean): boolean;

	/**
	 * Whether this item's CARD disclosure is folded — board cards, either roadmap axis's
	 * bucket/shelf/context cards, Deliverables cards. One scope regardless of which of
	 * those drew it (`CARD_SCOPE`), and never the tree row's own bit or the dated axis's:
	 * a card's own toggle is the only thing that may open or close it, so nothing that
	 * shares a scope with a tree row or a bar can be trusted to leave it alone. Renderers
	 * choose between this and {@link isCollapsed} by what they are drawing — a disclosure
	 * on a card's face calls this one, a row's own chevron (tree or timeline) never does.
	 */
	isCardCollapsed(path: string): boolean;
	/** Returns true when the state actually changed. Scoped exactly as `isCardCollapsed` is. */
	setCardCollapsed(path: string, collapsed: boolean): boolean;

	/**
	 * Which projection this view shows. UI state, not a base setting: it lives
	 * beside the collapse state in vault-scoped localStorage — per saved view,
	 * per device — and never in the `.base`.
	 */
	readonly projection: Projection;
	/** Switch the projection and re-render; the collapse store persists the choice. */
	setProjection(mode: Projection): void;
	/** The board of the last render, or null while the view is not a board (or has no workflow). */
	readonly board: BoardSnapshot | null;
	/** The roadmap of the last render, or null while the view is not a roadmap (or has no axis). */
	readonly roadmap: RoadmapSnapshot | null;
	/**
	 * Paths whose card drew a child disclosure in the last render pass — rebuilt per
	 * pass exactly as `board` and `roadmap` are. The menu offers children where the
	 * screen shows them; a surface that drew no body (a timeline row, a tree row) is
	 * absent, so the discriminator is what happened rather than which projection it is.
	 *
	 * Readonly, and not the write path: the render fills the view's own set through
	 * `RowContext.cardKids`. A renderer adding through this member would need a cast,
	 * which is how a readonly boundary becomes decorative.
	 */
	readonly cardChildrenShown: ReadonlySet<string>;
	/**
	 * The retained roadmap-axis pick for this saved view, or null before the user
	 * ever picks. Retained even while its axis is unconfigured — restoring the
	 * configuration restores the choice — so read the axis to draw through
	 * `activeAxis`, never from this directly.
	 */
	readonly axisPick: string | null;
	/** Pick which axis this saved view shows; the collapse store persists it. */
	setAxisPick(axis: RoadmapAxis): void;
	/**
	 * Focus the tree on one type — '' for the whole tree. UI state like the mode: the
	 * collapse store persists it, never the `.base`. Rebuilds the model, since focus is
	 * what it is re-rooted on; read the current focus off `settings.focusLevel`.
	 */
	setFocusLevel(level: string): void;
	/** Whether the shelf is collapsed for this saved view; collapsed is the default. */
	readonly shelfCollapsed: boolean;
	/** Toggle the shelf's collapse state and re-render the content pane. */
	setShelfCollapsed(collapsed: boolean): void;
	/** The shelf's display-only sort pick; 'tree' (sibling order) is the default. */
	readonly shelfSort: ShelfSort;
	setShelfSort(sort: ShelfSort): void;
	/** Types currently hidden from the shelf by its own type filter. */
	readonly shelfHiddenTypes: ReadonlySet<string>;
	setShelfHiddenTypes(types: ReadonlySet<string>): void;
	/**
	 * Which density the dated axis draws at. UI state like the mode and the axis pick:
	 * per saved view, per device, in the collapse store — never in the `.base`, because
	 * pane width is a property of the screen in front of you and not of the base.
	 */
	readonly zoom: ScaleId;
	/** Pick a density and re-render; the collapse store persists it. */
	setZoom(id: ScaleId): void;
	/**
	 * The retained row density for the dated axis — 'compact', or null for
	 * comfortable, the default. UI state exactly like the zoom beside it.
	 */
	readonly density: string | null;
	/** Toggle compact rows and re-render; the collapse store persists the pick. */
	setDensity(value: string | null): void;
	/**
	 * The retained timeline lead-column width in pixels, or null for
	 * `TIMELINE_LEAD_PX`, the default. UI state exactly like the density beside it.
	 */
	readonly leadWidth: number | null;
	/** Resize the lead column and re-render; the collapse store persists the pick. */
	setLeadWidth(value: number | null): void;
	/** Put today back in the middle of the timeline's scroller, from any position. */
	jumpToToday(): void;
	/**
	 * The column the board selection rests on when no card is selected — an empty
	 * column is still a keyboard stop, or an empty board could not be driven at all.
	 * Null whenever a card (or nothing) is selected instead.
	 */
	readonly selectedBoardColumn: number | null;
	selectBoardColumn(index: number | null): void;
	/**
	 * Plan and apply the state write a board move means — the canonical value, or key
	 * removal for the no-state column. One path for all three inputs (a drop, an
	 * Alt+arrow, the card menu), so no input can reach a target another cannot, and
	 * every move that lands announces itself once. A move onto the card's own column
	 * plans nothing and resolves false, leaving the undo slot untouched.
	 */
	performBoardMove(item: BacklogItem, state: string | null): Promise<boolean>;
	/**
	 * Plan and apply the Deliverable workflow's state write — the canonical value, or
	 * key removal for the no-state column. The board's rule, on the Deliverable
	 * workflow's own property: one path for all three inputs (a drop, an Alt+arrow,
	 * the card menu), so no input can write the requirements state key by mistake.
	 */
	performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean>;
	/**
	 * Plan and apply the horizon write a roadmap move means — the target bucket's
	 * value, or key removal for the shelf. The board's rule on the roadmap's
	 * property: one path for all three inputs (a drop, an Alt+arrow, the card menu),
	 * so no input can reach a bucket another cannot, and every move that lands
	 * announces itself once. A move onto the card's own bucket plans nothing and
	 * resolves false, leaving the undo slot untouched.
	 */
	performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean>;

	/**
	 * Plan and apply the date batch a schedule move means — the ends the item's own
	 * type answers for, or their removal. The board's and the horizon axis's rule on
	 * the dated one: one path for every input (a drag, a grip, the row's entry, the
	 * menu's Unschedule), so no input can reach a date another cannot, and every move
	 * that lands announces itself once. A batch the WRITER decides changed nothing
	 * resolves false, leaving the undo slot untouched and saying nothing.
	 *
	 * `from` is the base a RELATIVE gesture measured against and `ends` the placement
	 * shape it was planned under. Both ride through to the writer, which is the only
	 * place they can be checked against the live note; both are absent from the modal
	 * and the menu, which state a date rather than a displacement and were planned
	 * against the item in hand.
	 */
	performScheduleMove(
		item: BacklogItem,
		plan: SchedulePlan,
		from?: Partial<Record<PlacementEnd, string | null>>,
		ends?: PlacementEnd[],
	): Promise<boolean>;

	selectItem(item: BacklogItem, scroll?: boolean): void;
	clearSelection(): void;
	/** Open the item's note where the view is configured to, honoring the event's mod key. */
	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void;
	/**
	 * Open it in a NAMED target instead — a middle click, and the menu's two entries,
	 * each of which means one placement absolutely and is not redirected by the setting.
	 * One method taking the target rather than one per target: the vocabulary is already
	 * `OpenTarget`, and a third entry would otherwise be a third host method.
	 */
	openItemIn(item: BacklogItem, target: OpenTarget): void;
	/** Open the row context menu at the item's row — the keyboard path (Menu key / Shift+F10). */
	showContextMenuFor(item: BacklogItem): void;
	/**
	 * Open the column's own menu, anchored to the column that index names. False when
	 * there was nothing to open — a column with nothing agreed offers no menu — so the
	 * keyboard path can leave the key to whoever else wants it rather than swallowing
	 * it on a stop where nothing happens. The pointer path already worked that way.
	 */
	showColumnMenuFor(index: number): boolean;

	/**
	 * Bind this view's suggested key for every optional property nobody has named yet
	 * — the state, the stamps and the roadmap's placement keys — and rebuild against
	 * them. The one write to the `.base` that is not a user turning an option: it is
	 * what makes the features that need a property usable without hand-editing a note
	 * first, since an unnamed property is one Obsidian's own picker cannot offer.
	 *
	 * Returns what it bound, so the caller can say so. Nothing already set is touched
	 * and nothing CLEARED is revived (see `adoptableProperties`), so pressing it twice
	 * binds nothing the second time.
	 */
	adoptDefaultProperties(): OptionalProperty[];

	render(): void;
	/**
	 * Re-render one row's children in place after an expand or collapse — the
	 * targeted alternative to `render()`, which rebuilds every row in the tree.
	 */
	refreshSubtree(item: BacklogItem): void;
	/**
	 * Serialized, validated frontmatter writes — the only mutation path.
	 * Resolves null when the batch was refused or failed; otherwise the outcome the
	 * writer itself observed, which a truthy check treats exactly as the old boolean.
	 */
	applySafely(writes: ItemWrite[]): Promise<WriteOutcome | null>;
	performDrop(dragged: BacklogItem, target: DropTarget): Promise<void>;
	/** True when a batch has landed this session and its inverses are held. */
	canUndo(): boolean;
	/**
	 * Replay the last batch's inverses through the same gate. Authorized at capture
	 * time: the batch can only name files its forward batch wrote as results.
	 */
	undoLast(): Promise<boolean>;
}
