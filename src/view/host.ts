import { App, BasesPropertyId, BasesViewConfig } from 'obsidian';
import { BoardModel, IterationBucket, StatePalette } from '../domain/board';
import { BacklogItem, BacklogModel } from '../domain/model';
import { DropTarget } from '../domain/dropTargets';
import { RoadmapAxis, RoadmapModel } from '../domain/roadmap';
import { ShelfSort } from '../domain/shelf';
import { PlacementEnd } from '../domain/itemTypes';
import { ScaleId, TimelineScale, TimelineWindow } from '../domain/timeline';
import { ItemWrite, ScheduleGesture, SchedulePlan } from '../domain/writePlan';
import { BacklogSettings } from '../domain/settings';
import { OptionalField, OptionalProperty } from '../domain/optionalProperties';
import { OpenTarget } from '../domain/itemHandling';
import { WriteOutcome } from '../storage/frontmatter';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

/**
 * The six readings of one backlog. UI state, not a base setting: the choice
 * lives in the view-state store's vault-scoped localStorage — per saved view,
 * per device — and never in the `.base`.
 */
export type Projection = 'tree' | 'board' | 'roadmap' | 'deliverables' | 'catalog' | 'iteration';

/**
 * Which screen a folded column was folded on. Four words that are almost the projection
 * and deliberately not it: the horizon buckets are one AXIS of the roadmap, the shelf's
 * type groups are a BAND of it drawn on every axis, and the two grid axes have rows and
 * bands rather than columns. Nothing here folds by projection, so a union of the screens
 * that actually draw a foldable stack of cards is the honest spelling — and it is what
 * keeps a requirements `Done`, a Deliverables `Done` and a horizon called `Done` three
 * separate folds. See `columnKey` in `view/viewState.ts`.
 *
 * `shelf` is keyed by a TYPE name rather than a state value, which changes nothing about
 * the mechanism: the key space is "a word on one screen", and a type is a word the same
 * way a column's state is. `backlog` is the iteration board's shelf ITSELF — one band
 * rather than a set, so its value is null, and it is here rather than in a view-state
 * value of its own because a shelf is a foldable band exactly as a column is. Not keyed
 * per iteration: the work in no iteration is the same population on every sprint.
 */
export type ColumnScope = 'board' | 'deliverables' | 'horizons' | 'shelf' | 'iteration' | 'backlog';

/**
 * A column of the trailing strip: the property id to read, the label the header shows,
 * and WHICH RENDERING it gets. Membership and order belong to the Bases properties
 * menu alone — a kind never decides whether a column exists, only what is drawn inside
 * it. Declared here with the other view state the host exposes, so the interface every
 * module depends on depends on nothing itself.
 */
export type ColumnKind = 'value' | 'tags' | 'state' | 'horizon' | 'risk' | 'priority' | 'assignee' | 'start' | 'target';

export interface Column {
	prop: BasesPropertyId;
	label: string;
	kind: ColumnKind;
}

/**
 * What the last measurement said the pane can hold: how many of the {@link Column}s fit,
 * and whether the rollup pinned past their end fits too. ONE object rather than two
 * members, because the rows, the header and the stylesheet all read this verdict and a
 * header that disagreed with the rows about whether the rollup is on screen is exactly
 * the defect this replaced. `rollupDropped` is only ever true with `shown` at 0 — the
 * rollup goes after every column.
 */
export interface ColumnFit {
	shown: number;
	rollupDropped: boolean;
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
	/**
	 * What was DRAWN, which since a column can be folded is no longer the whole model: a
	 * folded column's `cards` list is empty here, and that is what stops the keyboard
	 * selecting a card no longer on screen — `boardPosition`, `nextBoardPosition` and
	 * Alt+arrow all walk this. Every count on a column is still the real one.
	 */
	board: BoardModel;
	colEls: HTMLElement[];
	/**
	 * The shelf's own element for THIS render — `RoadmapSnapshot.shelfEl`'s reason
	 * exactly: a header control that rebuilt the pane has to find its replacement, and
	 * the pressed button is gone by then. Absent on the two boards that draw no shelf.
	 */
	shelfEl?: HTMLElement | null;
	/**
	 * Which board this is, carried so nothing downstream has to re-derive it from the
	 * projection. The column menu needs it to key a fold, and the render that produced
	 * these columns is the one thing that cannot be wrong about which board they are.
	 */
	scope: ColumnScope;
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
 * Measured rather than assumed, on the type that tried it the other way first: a `render/`
 * type imported back into `host.ts` turned the `columns.ts` ↔ `menu.ts` ↔ `host.ts` web
 * into **sixteen** cycles `npm run analyze` refuses.
 */
export interface DrawnColors {
	/** A bar overridden green by `.pbl-timeline-row.pbl-done .pbl-bar` — wins outright. */
	done: boolean;
	/** A bar drawing the cyan diamond (`.pbl-bar-milestone`) — beats a state slot too. */
	milestone: boolean;
	/** An `Iteration` drawing the cyan point diamond — same hue, its own name in the key. */
	iteration: boolean;
	/** A bar with none of the above: no slot, no done override, no milestone or iteration cyan. */
	accent: boolean;
	/**
	 * An unavailable stretch drew somewhere on this grid (`.pbl-absence`) — the resources
	 * axis only, since a stretch draws in a resource's header and the dated axis has none.
	 *
	 * Not a colour override like the three above, and the interface is wider than its name
	 * because of it: what this reports is which MARKS a pass drew that the key has to
	 * explain, and a hatch is one. Reported from the render for the same reason the others
	 * are, but the shape of the risk differs: a bar's own colours are reported from the
	 * render because a fold hides a bar the model still lists, where `roadmap.lanes` is
	 * empty by construction on any axis that draws no bands at all (`RoadmapModel.lanes`) —
	 * so there is no STALE model data for a predicate to see wrongly here. What there is
	 * instead is a DRIFT risk: `entry.lane.absences.length > 0` would be a second statement
	 * of the exact condition `renderLaneAbsences`' own early return already decides, kept in
	 * step by hand rather than read off what it actually drew. Asking the header's own DOM
	 * after `renderLaneHead` returns (`drawEntries`) removes the second copy instead of
	 * trusting it to agree.
	 *
	 * The three above are a BAR's own report, which is why `reportColors` and `renderBarRow`
	 * take the narrower `BarColors`: a bar row draws no hatch and has nothing to say here.
	 */
	absence: boolean;
	/**
	 * A bar drew its VISIBLE days-lost token (`.pbl-days-lost`) somewhere on this grid — the
	 * resources axis only, since it is the only one whose rows belong to a resource. Asked
	 * of whether `drawBandCollision` actually appended that token (`render/timeline.ts`),
	 * never of a crossing alone: a bar can cross a stretch and still draw no token at all
	 * where `renderBarLabel` dropped its title label (no room for it against the window's
	 * edge or a track too short for the reserve on either side) — the lead's hatched swatch
	 * still draws either way, which is a DIFFERENT fact this field does not key. Reported
	 * from the RENDER like `absence` beside it, and for the same reason: a collapsed band
	 * draws no clash, so a predicate over `roadmap.lanes` would key a mark nothing on screen
	 * makes — and a crossing with a dropped label is the same mistake reached the other way,
	 * which is what this field existed to fix once already.
	 */
	daysLost: boolean;
}

/**
 * What one BAR reports about its own colour — `DrawnColors` minus the marks a bar cannot
 * draw. Narrower rather than a second vocabulary, the same relation `AxisField` has to the
 * optional-property keys: `reportColors` ORs these three into the pass's own report, and a
 * row literal that had to state `absence: false` would be claiming something about a mark
 * drawn nowhere near it. `daysLost` is excluded for the same reason, joining it on
 * 2026-08-14: a bar row draws neither the hatch nor the clash mark, because both are the
 * band's business rather than the bar's own colour.
 */
export type BarColors = Omit<DrawnColors, 'absence' | 'daysLost'>;

/**
 * The roadmap as last rendered: the derived model, and the rendered cards in the
 * order the frame drew them, which is the order the keyboard walks. {@link
 * RoadmapSnapshot.cards} is where that order is stated.
 */
export interface RoadmapSnapshot {
	roadmap: RoadmapModel;
	/**
	 * The NAVIGABLE cards, in reading order, and this field is the ONE statement of what
	 * that order is: the render pushes onto it in draw order and nothing sorts it
	 * afterwards, so the two cannot disagree. It differs by axis — the shelf leads on the
	 * HORIZON axis (2026-08-17, [[The shelf leads the horizon board]]), the grid axes stay
	 * axis-then-shelf because their shelf reads conflicts the grid render produces — and
	 * the context strip is last on all three. The Alt+arrow ladder is NOT derived from it
	 * and leads with the shelf everywhere; see `horizonStops` for why that is its own rule.
	 *
	 * A collapsed shelf contributes none, exactly as an empty one does, so
	 * the keyboard walk and `aria-activedescendant` never reach past what is on screen.
	 */
	cards: BacklogItem[];
	/**
	 * Which paths this pass put on screen — a card, a timeline row or a marker's diamond.
	 * `cardedPaths` reads exactly this, so `Open child "…"` names only a child no surface
	 * has already drawn.
	 *
	 * Paths and nothing else. It was a map to the item and the ELEMENT it was drawn on
	 * until 2026-08-17, which nothing ever read: a snapshot outlives its frame on the
	 * host, so that retained a detached subtree per drawn row for a value only
	 * `.keys()` was ever asked for.
	 */
	placed: ReadonlySet<string>;
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
	 * The last measurement's verdict on {@link columns} — null before anything has been
	 * measured, and on every card projection, where the ladder does not apply. Two writers
	 * and no more: `syncColumnFit` stores what it measured, and the view clears it when a
	 * card projection renders. Read by `rowContext`, which slices the list the renderers
	 * draw, and by the header, which draws nothing at all when neither a column nor the
	 * rollup is left to name.
	 */
	readonly columnFit: ColumnFit | null;
	setColumnFit(fit: ColumnFit | null): void;
	readonly selectedPath: string | null;
	/** True when the Base has a group-by configured, which this view does not apply. */
	readonly groupingIgnored: boolean;

	/**
	 * True when this item's row is not rendered: not drawn by this projection at all or,
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
	 * in the view-state store's vault-scoped localStorage — per saved view,
	 * per device — and never in the `.base`.
	 */
	readonly projection: Projection;
	/**
	 * Move a card between the iteration board's three buckets — the one method its drop,
	 * its Alt+arrow and its `Set state` all land on, taking the BUCKET rather than a
	 * state. Two things break if a state is passed instead, and they break differently:
	 * `computeStateWrites` compares the exact value, so a card in `Ready` dropped on an
	 * Open bucket whose representative is `New` is a change by that test and gets
	 * rewritten; and the announcement matches a column by exact state, so a correct move
	 * is announced from a column the board does not name.
	 */
	performIterationBoardMove(item: BacklogItem, bucket: IterationBucket): Promise<boolean>;
	/** The iteration board's shelf drop: the card leaves the chosen iteration. */
	performIterationRemove(item: BacklogItem): Promise<boolean>;
	/** Switch the projection and re-render; the view-state store persists the choice. */
	setProjection(mode: Projection): void;
	/**
	 * The `Iteration` note a board is scoped to, as the reader LEFT it — retained through
	 * a note that has gone and through the property being cleared, so restoring either
	 * restores the choice. Never the scope to DRAW: ask {@link effectiveScope}, which is
	 * the same rule `axisPick` and `activeAxis` already keep one projection over.
	 */
	readonly boardScope: string | null;
	/** Scope the board to an iteration by path, or to the product with null. */
	setBoardScope(path: string | null): void;
	/**
	 * The iteration this view is actually SHOWING: the stored path when it names a live
	 * `Iteration` and an iteration property is configured, null otherwise. Resolved once,
	 * upstream of every gate — a view that resolved it only where content is drawn would
	 * count, offer types and index the filter as an iteration board while drawing the
	 * product one.
	 */
	readonly effectiveScope: string | null;
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
	/** Pick which axis this saved view shows; the view-state store persists it. */
	setAxisPick(axis: RoadmapAxis): void;
	/**
	 * Focus the tree on one type — '' for the whole tree. UI state like the mode: the
	 * view-state store persists it, never the `.base`. Rebuilds the model, since focus is
	 * what it is re-rooted on; read the current focus off `settings.focusLevel`.
	 */
	setFocusLevel(level: string): void;
	/**
	 * Whether a plain click on a row's body folds it rather than opening the note —
	 * false, opening it, is the default. UI state like the mode and the focus level: the
	 * view-state store persists it per saved view and per device, never the `.base`,
	 * because it is flipped while working and a `.base` is shared. Only the two
	 * ROW-shaped projections read it (`clickActionApplies`).
	 */
	readonly clickFolds: boolean;
	/** Flip what a click does and re-render; the view-state store persists the pick. */
	setClickFolds(value: boolean): void;
	/**
	 * Whether a horizon bucket lays its cards out as a responsive grid — the default —
	 * rather than one card per row. UI state exactly like the density beside it: how wide
	 * the pane in front of you is, per saved view and per device, never the `.base`.
	 */
	readonly bucketGrid: boolean;
	/** Flip the bucket layout and re-render; the view-state store persists the pick. */
	setBucketGrid(grid: boolean): void;
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
	 * The shelf's own title search — a second narrowing beside the type filter, scoped to
	 * the shelf rather than to the view, so a reader can dig through untriaged work without
	 * a narrowing of the plan beside it.
	 *
	 * SESSION state, and the one shelf pick the view-state store does not hold: a search is
	 * something someone is doing right now, not a property of the view. Persisting it would
	 * open a saved view onto a shelf silently narrowed by a search nobody remembers typing —
	 * the rule the toolbar's own quick filter kept until it was withdrawn (2026-08-17), and
	 * the one part of it this box inherits.
	 */
	readonly shelfSearch: string;
	/** Narrow the shelf by title and re-render the content pane; '' clears it. */
	setShelfSearch(text: string): void;
	/**
	 * Whether one resource's whole BAND is folded shut on the resources axis — its bars and
	 * the notes it places, leaving the header. Not its absences: those draw in the header's
	 * own track since 2026-08-14, so a fold leaves them exactly where they were.
	 *
	 * A third collapse question beside {@link isCollapsed} and {@link isCardCollapsed}, and
	 * a third because it is asked of a NAME: a resource is not a note, so it has no path to
	 * key a bit under and none of the machinery that key space carries (the vault-existence
	 * prune, the rename migration, the collapse-new-parents pass) applies to it. A band a
	 * reader has not ruled on is OPEN, unlike a tree parent — a row that hid its own work
	 * until asked would answer the question this axis exists for with nothing.
	 */
	isLaneCollapsed(name: string): boolean;
	setLaneCollapsed(name: string, collapsed: boolean): void;
	/**
	 * Whether one board column or horizon bucket is folded to its strip, asked of the
	 * screen it is drawn on and its own value.
	 *
	 * A fourth collapse question, and a fourth for {@link isLaneCollapsed}'s reason: a
	 * column is a VALUE, not a note, so it keys nothing in the path space. What is new here
	 * is `autoCollapse` — the answer a column nobody has ruled on gets, which is `false`
	 * everywhere except a done board column holding no open work. Passing it in keeps the
	 * default a fact about the screen drawing the column, and `columnCollapsed` in
	 * `view/viewState.ts` is what makes taking it a once-only event.
	 */
	columnCollapsed(scope: ColumnScope, value: string | null, autoCollapse: boolean): boolean;
	setColumnCollapsed(scope: ColumnScope, value: string | null, collapsed: boolean): void;
	/**
	 * Which density the dated axis draws at. UI state like the mode and the axis pick:
	 * per saved view, per device, in the view-state store — never in the `.base`, because
	 * pane width is a property of the screen in front of you and not of the base.
	 */
	readonly zoom: ScaleId;
	/** Pick a density and re-render; the view-state store persists it. */
	setZoom(id: ScaleId): void;
	/**
	 * The retained row density for the dated axis — 'compact', or null for
	 * comfortable, the default. UI state exactly like the zoom beside it.
	 */
	readonly density: string | null;
	/** Toggle compact rows and re-render; the view-state store persists the pick. */
	setDensity(value: string | null): void;
	/**
	 * The retained timeline lead-column width in pixels, or null for
	 * `TIMELINE_LEAD_PX`, the default. UI state exactly like the density beside it.
	 */
	readonly leadWidth: number | null;
	/** Resize the lead column and re-render; the view-state store persists the pick. */
	setLeadWidth(value: number | null): void;
	/**
	 * The tree's resized property columns in pixels, by Bases property id. A column with
	 * no entry draws at `DEFAULT_PROP_COLUMN_WIDTH` — UI state exactly like the lead
	 * width above, and per column rather than one number for all of them because each is
	 * dragged on its own.
	 */
	readonly colWidths: Readonly<Record<string, number>>;
	/** Resize one property column and re-render; null restores it to the default. */
	setColWidth(prop: string, value: number | null): void;
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
	 * Plan and apply the assignee write a resource move means — the target row's own
	 * name, or key removal for the shelf. The horizon axis's rule on this axis's
	 * property: one path for all three inputs (a drop, an Alt+Up/Down, the row menu's
	 * Set assignee), so no input can reach a row another cannot, and every move that
	 * lands announces itself once. A move onto the row the card is already in plans
	 * nothing and resolves false, leaving the undo slot untouched — but a card with no
	 * date to be placed at still says so out loud, since nothing on screen would
	 * otherwise tell the reader the drop landed at all.
	 *
	 * `when` is this axis's SECOND dimension, and it is what makes this one method rather
	 * than two: a release on a band answers who by the row it landed in and when by the
	 * pointer's X, and both halves ride one `ItemWrite` so the pair is one batch, one undo
	 * and one sentence. Absent from every input that answers only who — Set assignee,
	 * Alt+Up/Down, the shelf's removal — and absent from a vertical drag too, which plans
	 * no dates because it displaced none.
	 */
	performResourceMove(item: BacklogItem, name: string | null, when?: ScheduleGesture): Promise<boolean>;

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
	 * there was nothing to open, so the keyboard path can leave the key to whoever else
	 * wants it rather than swallowing it on a stop where nothing happens; the pointer
	 * path already worked that way.
	 *
	 * That case is now only an index naming no column. It used to be the ordinary state of
	 * a column with no working agreement, and stopped being one when the fold joined the
	 * menu: every column can be folded, so every column has something to offer.
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
	 *
	 * `only` narrows it to one field, which is how a feature binds its own key at the
	 * moment it is first used instead of waiting for ✨ ([[Bind a property by using it]]).
	 * One method rather than a second one beside it, so the sentence above stays true:
	 * there is exactly one place this plugin writes an option the user did not turn.
	 * The caller still owes the `configProblems` gate BEFORE calling — binding into a
	 * view whose keys already collide would change the configuration and then have every
	 * write refused, which is `runInit`'s own rule and not a new one.
	 */
	adoptDefaultProperties(only?: OptionalField): OptionalProperty[];

	render(): void;
	/**
	 * Forget everything the last render pass indexed: the row elements, their signatures
	 * and the card disclosures. Three collections with ONE lifetime, cleared from one place
	 * rather than from the call sites that would each have to remember all three — an index
	 * that outlived its rows would hand back elements that are gone, and a signature index
	 * that did would claim them.
	 *
	 * Called by the pass that empties the tree (`renderPass`) and by each of the tree's
	 * empty states, which render no rows and so prune none.
	 */
	clearRowIndex(): void;
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
