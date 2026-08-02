import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { announce, cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { BacklogViewHost } from '../host';
import { BoardColumn, BoardModel, columnLabelFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';

/**
 * Say what a move changed, to assistive technology, from the polite live region
 * (`role="status"`) the drag library owns. It lives with the drag because this
 * module creates and cleans that region up — but every board move announces
 * through it, drag or not, so a keyboard move and a menu move are told in the same
 * words as the gesture they replace. Old column and new: "moved" alone leaves a
 * screen-reader user knowing something happened and not what.
 *
 * The states are named by their COLUMNS, so what is announced is what is on
 * screen — the no-state column's label rather than a silence, and the yielded
 * "Unset" rather than a name a real state has taken. No board, no announcement:
 * there is no column vocabulary to say it in.
 */
export function announceBoardMove(
	board: BoardModel | null | undefined,
	title: string,
	from: string | null,
	to: string | null,
): void {
	if (!board) return;
	announce(`Moved "${title}" from ${columnLabelFor(board, from)} to ${columnLabelFor(board, to)}`);
}

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
	/**
	 * Marks this board's drags. The adapter's registry is document-global and two
	 * saved boards can sit in split panes over the same notes — without this, a
	 * card dragged out of one board would land on the other, which resolves the
	 * path against ITS model and writes ITS state key: a different property
	 * changed than the gesture showed. A token comparison in `canDrop` keeps every
	 * drop on the board it started from.
	 */
	private readonly token = Symbol('pbl-board-drag');

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
				getInitialData: () => ({ path: item.file.path, board: this.token }),
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
				// Only this board's own drags: a foreign card must not even highlight,
				// or the signal would promise a drop the write path should never make.
				canDrop: ({ source }) => source.data.board === this.token,
				onDragEnter: () => colEl.addClass('pbl-col-drop-over'),
				onDragLeave: () => colEl.removeClass('pbl-col-drop-over'),
				onDrop: ({ source }) => {
					colEl.removeClass('pbl-col-drop-over');
					const path = source.data.path;
					// The dragged path outlives the model it was taken from — a refresh
					// mid-drag can drop the note — so the item is resolved at drop time.
					const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
					// The host owns the write AND the announcement: a drop is one of three
					// inputs to the same move, and three callers announcing separately is
					// how they come to say different things about the same change.
					if (item) void this.host.performBoardMove(item, column.state);
				},
			}),
		);
	}
}
