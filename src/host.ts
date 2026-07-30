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

	/** True when the quick filter hides this item; always false without a filter. */
	isFilteredOut(item: BacklogItem): boolean;
	/** Update the quick filter and re-render the tree (the toolbar keeps its state). */
	setFilter(text: string): void;

	isCollapsed(path: string): boolean;
	/** Returns true when the state actually changed. */
	setCollapsed(path: string, collapsed: boolean): boolean;
	persistCollapsedState(): void;

	selectItem(item: BacklogItem, scroll?: boolean): void;
	/** Open the item's note, honoring the mod key of the triggering event. */
	openItem(item: BacklogItem, evt: MouseEvent | KeyboardEvent): void;
	openItemInNewTab(item: BacklogItem): void;

	render(): void;
	/**
	 * Serialized, validated frontmatter writes — the only mutation path.
	 * Resolves true only when every write in the batch was applied.
	 */
	applySafely(writes: ItemWrite[]): Promise<boolean>;
	performDrop(dragged: BacklogItem, target: DropTarget): Promise<void>;
}
