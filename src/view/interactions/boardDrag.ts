import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { announce, cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { BacklogViewHost } from '../host';
import { BoardColumn } from '../../domain/board';
import { BacklogItem } from '../../domain/model';

/**
 * The board's drag layer — Pragmatic drag and drop, the plugin's first bundled
 * runtime library (ADR 0018). The whole column is the target, so the only drop
 * signal is the column highlight: within-column order is derived, never stored,
 * and a between-cards indicator would promise a rank the board does not keep.
 *
 * Every registration returns its cleanup, collected per render pass: the board is
 * rebuilt wholesale on each pass, and adapter listeners left behind on detached
 * elements would fire against a board that no longer exists.
 */
export class BoardDragController {
	private readonly host: BacklogViewHost;
	private readonly viewEl: HTMLElement;
	private cleanups: (() => void)[] = [];

	constructor(host: BacklogViewHost, viewEl: HTMLElement) {
		this.host = host;
		this.viewEl = viewEl;
	}

	/** The board is about to be rebuilt; unhook everything wired to the old DOM. */
	onRenderStart(): void {
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups = [];
	}

	dispose(): void {
		this.onRenderStart();
		// The live region is a shared singleton element on document.body.
		liveRegionCleanup();
	}

	/** Auto-scroll the board's scroller — engages only toward an edge, per the spec. */
	wireBoard(scroller: HTMLElement): void {
		this.cleanups.push(autoScrollForElements({ element: scroller }));
	}

	/**
	 * A result card is a drag source. A context card never is — it is placement,
	 * not population, and the write a drag plans is exactly what the context-row
	 * rule forbids for it.
	 */
	wireCard(cardEl: HTMLElement, item: BacklogItem): void {
		if (item.outsideFilter) return;
		this.cleanups.push(
			draggable({
				element: cardEl,
				getInitialData: () => ({ path: item.file.path }),
				onDragStart: () => {
					this.viewEl.addClass('pbl-dragging');
					cardEl.addClass('pbl-drag-source');
				},
				// Fires when the drag ends however it ends — dropped or cancelled.
				onDrop: () => {
					this.viewEl.removeClass('pbl-dragging');
					cardEl.removeClass('pbl-drag-source');
				},
			}),
		);
	}

	/** Every column is a drop target while it exists — an empty one included. */
	wireColumn(colEl: HTMLElement, column: BoardColumn): void {
		this.cleanups.push(
			dropTargetForElements({
				element: colEl,
				onDragEnter: () => colEl.addClass('pbl-col-drop-over'),
				onDragLeave: () => colEl.removeClass('pbl-col-drop-over'),
				onDrop: ({ source }) => {
					colEl.removeClass('pbl-col-drop-over');
					const path = source.data.path;
					// The dragged path outlives the model it was taken from — a refresh
					// mid-drag can drop the note — so the item is resolved at drop time.
					const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
					if (item) void this.dropOnColumn(item, column);
				},
			}),
		);
	}

	private async dropOnColumn(item: BacklogItem, column: BoardColumn): Promise<void> {
		const applied = await this.host.performBoardDrop(item, column.state);
		// A move that wrote nothing (own column, refused batch) announces nothing.
		if (applied) {
			announce(
				column.state === null
					? `Cleared the state of "${item.title}"`
					: `Moved "${item.title}" to ${column.state}`,
			);
		}
	}
}
