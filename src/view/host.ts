import { App, BasesPropertyId, BasesViewConfig } from 'obsidian';
import { BoardModel } from '../domain/board';
import { BacklogItem, BacklogModel } from '../domain/model';
import { DropTarget } from '../domain/dropTargets';
import { RoadmapAxis, RoadmapModel } from '../domain/roadmap';
import { ItemWrite } from '../domain/writePlan';
import { BacklogSettings, OptionalProperty } from '../domain/settings';
import { WriteOutcome } from '../storage/frontmatter';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

/**
 * The three readings of one backlog. UI state, not a base setting: the choice
 * lives beside the collapse state in vault-scoped localStorage — per saved view,
 * per device — and never in the `.base`.
 */
export type Projection = 'tree' | 'board' | 'roadmap';

/**
 * A visible property resolved into a column: the id to read, the label the header
 * shows, and whether it is the tags column. Declared here with the other view state
 * the host exposes — the renderer that builds these imports the type from here, so
 * the interface every module depends on depends on nothing itself.
 */
export interface ChipProp {
	prop: BasesPropertyId;
	label: string;
	/** Render as editable tag pills instead of a plain value. */
	tags: boolean;
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

/**
 * The roadmap as last rendered: the derived model, and the rendered cards in
 * reading order — axis first, then the shelf, then the context strip — which is
 * the order the keyboard walks.
 */
export interface RoadmapSnapshot {
	roadmap: RoadmapModel;
	cards: BacklogItem[];
	/** Pixel offset of the today line inside the grid, or null on the horizon axis. */
	todayLeft: number | null;
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
	readonly chips: ChipProp[];
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

	isCollapsed(path: string): boolean;
	/** Returns true when the state actually changed. */
	setCollapsed(path: string, collapsed: boolean): boolean;

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
	 * The retained roadmap-axis pick for this saved view, or null before the user
	 * ever picks. Retained even while its axis is unconfigured — restoring the
	 * configuration restores the choice — so read the axis to draw through
	 * `activeAxis`, never from this directly.
	 */
	readonly axisPick: string | null;
	/** Pick which axis this saved view shows; the collapse store persists it. */
	setAxisPick(axis: RoadmapAxis): void;
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
	 * Plan and apply the horizon write a roadmap move means — the target bucket's
	 * value, or key removal for the shelf. The board's rule on the roadmap's
	 * property: one path for all three inputs (a drop, an Alt+arrow, the card menu),
	 * so no input can reach a bucket another cannot, and every move that lands
	 * announces itself once. A move onto the card's own bucket plans nothing and
	 * resolves false, leaving the undo slot untouched.
	 */
	performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean>;

	selectItem(item: BacklogItem, scroll?: boolean): void;
	clearSelection(): void;
	/** Open the item's note, honoring the mod key of the triggering event. */
	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void;
	openItemInNewTab(item: BacklogItem): void;
	/** Open the item's note in a split pane next to the current one. */
	openItemToSide(item: BacklogItem): void;
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
