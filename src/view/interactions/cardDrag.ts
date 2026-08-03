import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { announce, cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { BacklogViewHost } from '../host';
import { BoardModel, columnLabelFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';
import { HorizonSource, placementLabel, RoadmapModel, targetLabel } from '../../domain/roadmap';

/**
 * The class every card drop target wears while a card hovers it. One name for the
 * board's columns, the roadmap's buckets and the shelf: the highlight is the only
 * drop signal any of them gives, so it is one decision rather than three.
 */
const DROP_OVER = 'pbl-drop-over';

/**
 * Say what a move changed, to assistive technology, from the polite live region
 * (`role="status"`) the drag library owns. It lives with the drag because this
 * module creates and cleans that region up — but every card move announces through
 * it, drag or not, so a keyboard move and a menu move are told in the same words as
 * the gesture they replace. Old place and new: "moved" alone leaves a screen-reader
 * user knowing something happened and not what.
 *
 * The places are named by what RENDERS them — the board's columns, the roadmap's
 * buckets — so what is announced is what is on screen: the no-state column's label
 * rather than a silence, the yielded "Unset" rather than a name a real state has
 * taken, the shelf rather than a horizon nothing shows. No projection on screen, no
 * announcement: there is no vocabulary to say it in.
 */
function announceMove(title: string, from: string, to: string): void {
	announce(`Moved "${title}" from ${from} to ${to}`);
}

export function announceBoardMove(
	board: BoardModel | null | undefined,
	title: string,
	from: string | null,
	to: string | null,
): void {
	if (!board) return;
	announceMove(title, columnLabelFor(board, from), columnLabelFor(board, to));
}

/**
 * The two ends are named by two different functions on purpose — `placementLabel`
 * asks what the note SAID and `targetLabel` where the user SENT it. See their
 * shared preamble in `domain/roadmap.ts`: one answer for both questions reported a
 * cleanup as "from Unplaced to Unplaced", and a move to an undrawn bucket as a move
 * to the shelf.
 */
export function announceHorizonMove(
	roadmap: RoadmapModel | null | undefined,
	title: string,
	from: HorizonSource,
	to: string | null,
): void {
	if (!roadmap) return;
	announceMove(title, placementLabel(roadmap, from), targetLabel(roadmap, to));
}

/**
 * The drag layer both card projections share — Pragmatic drag and drop, the
 * plugin's first bundled runtime library (ADR 0018). A card is the same card on
 * the board and on the roadmap, and so is the gesture: pick one up, drop it on a
 * region, one planned write lands. What a region MEANS is the caller's — a column
 * writes a state, a bucket writes a horizon, the shelf removes one — so a drop
 * target takes the plan rather than the vocabulary.
 *
 * The whole region is the target, so the only drop signal is its highlight:
 * within-region order is derived, never stored, and a between-cards indicator
 * would promise a rank neither projection keeps.
 *
 * Every registration returns its cleanup, collected per render pass: the
 * projection is rebuilt wholesale on each pass, and adapter listeners left behind
 * on detached elements would fire against a projection that no longer exists.
 */
export class CardDragController {
	private readonly host: BacklogViewHost;
	private readonly viewEl: HTMLElement;
	private cleanups: (() => void)[] = [];
	/**
	 * Marks this view's drags. The adapter's registry is document-global and two
	 * saved views can sit in split panes over the same notes — without this, a card
	 * dragged out of one would land on the other, which resolves the path against
	 * ITS model and writes ITS keys: a different property changed than the gesture
	 * showed. A token comparison in `canDrop` keeps every drop on the view it
	 * started from.
	 */
	private readonly token = Symbol('pbl-card-drag');

	constructor(host: BacklogViewHost, viewEl: HTMLElement) {
		this.host = host;
		this.viewEl = viewEl;
	}

	/** The projection is about to be rebuilt; unhook everything wired to the old DOM. */
	onRenderStart(): void {
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups = [];
	}

	dispose(): void {
		this.onRenderStart();
		// The live region is a shared singleton element on document.body.
		liveRegionCleanup();
	}

	/** Auto-scroll a scroller under the drag — engages only toward an edge, per the spec. */
	wireScroller(scroller: HTMLElement): void {
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
				getInitialData: () => ({ path: item.file.path, view: this.token }),
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

	/**
	 * A region a card can be dropped on, for as long as it renders — an empty column
	 * and an empty shelf included. `plan` is what the drop MEANS, and it belongs to
	 * the caller: this module knows how to resolve a dragged card, never what moving
	 * it should write.
	 */
	wireDropTarget(el: HTMLElement, plan: (item: BacklogItem) => void): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				// Only this view's own drags: a foreign card must not even highlight,
				// or the signal would promise a drop the write path should never make.
				canDrop: ({ source }) => source.data.view === this.token,
				onDragEnter: () => el.addClass(DROP_OVER),
				onDragLeave: () => el.removeClass(DROP_OVER),
				onDrop: ({ source }) => {
					el.removeClass(DROP_OVER);
					const path = source.data.path;
					// The dragged path outlives the model it was taken from — a refresh
					// mid-drag can drop the note — so the item is resolved at drop time.
					//
					// The `typeof` is the TYPE system's, not a runtime case: pragmatic
					// hands `source.data` back as `Record<string, unknown>`, so the
					// narrowing cannot be deleted — while `canDrop` above admits only a
					// source carrying this controller's private token, and the one place
					// minting that token (`wireCard`) pairs it with `item.file.path`, a
					// string, always. Its false arm is therefore unreachable by
					// construction and undeletable by typing: declared here rather than
					// covered, the way `.fallowrc.json` declares a member only a
					// framework calls. Reaching it would take a faked adapter payload.
					const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
					// The host owns the write AND the announcement: a drop is one of three
					// inputs to the same move, and three callers announcing separately is
					// how they come to say different things about the same change.
					if (item) plan(item);
				},
			}),
		);
	}
}
