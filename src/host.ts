import { App, BasesViewConfig } from 'obsidian';
import { BacklogItem, BacklogModel } from './model';
import { DropTarget, ItemWrite } from './ops';
import { BacklogSettings } from './settings';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

export type DropZone = 'before' | 'after' | 'inside';

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
	persistCollapsedState(): void;

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
	 * Serialized, validated frontmatter writes — the only mutation path.
	 * Resolves true only when every write in the batch was applied.
	 */
	applySafely(writes: ItemWrite[]): Promise<boolean>;
	performDrop(dragged: BacklogItem, target: DropTarget): Promise<void>;
}
