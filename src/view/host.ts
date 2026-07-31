import { App, BasesPropertyId, BasesViewConfig } from 'obsidian';
import { BacklogItem, BacklogModel } from '../domain/model';
import { DropTarget } from '../domain/dropTargets';
import { ItemWrite } from '../domain/writePlan';
import { BacklogSettings } from '../domain/settings';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

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

	selectItem(item: BacklogItem, scroll?: boolean): void;
	clearSelection(): void;
	/** Open the item's note, honoring the mod key of the triggering event. */
	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void;
	openItemInNewTab(item: BacklogItem): void;
	/** Open the item's note in a split pane next to the current one. */
	openItemToSide(item: BacklogItem): void;
	/** Open the row context menu at the item's row — the keyboard path (Menu key / Shift+F10). */
	showContextMenuFor(item: BacklogItem): void;

	render(): void;
	/**
	 * Re-render one row's children in place after an expand or collapse — the
	 * targeted alternative to `render()`, which rebuilds every row in the tree.
	 */
	refreshSubtree(item: BacklogItem): void;
	/**
	 * Serialized, validated frontmatter writes — the only mutation path.
	 * Resolves true only when every write in the batch was applied.
	 */
	applySafely(writes: ItemWrite[]): Promise<boolean>;
	performDrop(dragged: BacklogItem, target: DropTarget): Promise<void>;
}
