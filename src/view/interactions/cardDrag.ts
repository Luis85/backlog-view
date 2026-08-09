import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { DragLocationHistory } from '@atlaskit/pragmatic-drag-and-drop/types';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { announce, cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { BacklogViewHost } from '../host';
import { BoardModel, columnLabelFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';
import { HorizonSource, placementLabel, RoadmapModel, targetLabel } from '../../domain/roadmap';
import { BarHold, Placement, StatedEnds, UNSCHEDULED_LABEL } from '../../domain/bars';
import { PlacementEnd, placementEnds } from '../../domain/itemTypes';
import { DateSpan, daysBetween, formatCivil } from '../../domain/timeline';
import { DateChange } from '../../storage/frontmatter';

/**
 * The class every card drop target wears while a card hovers it. One name for the
 * board's columns, the roadmap's buckets and the shelf: the highlight is the only
 * drop signal any of them gives, so it is one decision rather than three.
 */
const DROP_OVER = 'pbl-drop-over';

/**
 * What a payload IS, so a target can refuse a gesture that means something else.
 *
 * There are two kinds and they are not interchangeable: a card MOVE asks a region to
 * write a placement, a LINK drag asks a bar to record an ordering. Every target that
 * means "move this" must refuse a link, and the check is here rather than at each of
 * them — the timeline grid would otherwise take a link drop and write a DATE, and the
 * dated shelf would unschedule. A guard per call site holds only for the call sites
 * somebody thought of; this one holds for targets not yet written.
 */
const LINK_KIND = 'link';
type DragKind = 'move' | 'link';

function kindOf(data: Record<string, unknown>): DragKind {
	return data.kind === LINK_KIND ? 'link' : 'move';
}

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
 * A resolved drag source: the card's item, which hold was taken, and where it began.
 */
export interface CardSource {
	item: BacklogItem;
	/** Null for an ordinary card — a bucket's, the shelf's, the board's. */
	hold: BarHold | null;
	/**
	 * The scroller's offset when this drag STARTED, for the delta a positional gesture
	 * measures. On the payload rather than latched by the target, because the baseline
	 * belongs to the GESTURE: a hold that auto-scrolls, leaves the overlay over the
	 * sticky lead column or the shelf, and comes back would re-latch on re-entry and
	 * lose every pixel of pan accumulated before it — moving the bar by fewer days than
	 * the pointer asked for. Minted where the token is, so it cannot outlive its drag
	 * or be cleared at the wrong moment. Null for a card wired without a scroller.
	 */
	scrollLeft: number | null;
	/**
	 * The dates and the placement shape a hold measures against — what the note stated
	 * when the drag began, read ONCE by `getInitialData` and never again. A relative
	 * gesture's baseline is what the reader was looking at when they picked the bar up
	 * and what every preview frame has been drawing against since; re-reading it from a
	 * refreshed model mid-drag would make `staleBase` compare a value against itself and
	 * never fire. Meaningless for an ordinary card (`hold === null`), which reads the
	 * pointer's position instead and has no baseline to carry.
	 */
	span: DateSpan;
	ends: PlacementEnd[];
}

/** The dates a hold's baseline is captured from — the note's own, never the drawn bar. */
function statedSpan(item: BacklogItem): DateSpan {
	return { start: item.plannedStart.value, target: item.plannedTarget.value };
}

/**
 * What a region does beyond taking the drop. All optional: a bucket needs none of them,
 * while the dated shelf needs both — it honours one hold and previews what its removal
 * would leave. The hooks carry the RESOLVED source, which the highlight-only contract
 * never had to expose and a hover preview cannot do without.
 */
export interface DropHooks {
	/** Which sources this region honours. Refusing withholds the highlight too. */
	accepts?: (source: CardSource) => boolean;
	onEnter?: (source: CardSource) => void;
	onLeave?: () => void;
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

	/** This view's drag, and this KIND of it. Every `canDrop` here goes through it. */
	private mine(data: Record<string, unknown>, kind: DragKind): boolean {
		return data.view === this.token && kindOf(data) === kind;
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
	 *
	 * `hold` and `originScroll` ride the payload rather than being read at drop time:
	 * `getInitialData` runs at drag START, which is exactly when a hold and a scroll
	 * baseline mean something — see `CardSource`.
	 */
	wireCard(cardEl: HTMLElement, item: BacklogItem, hold: BarHold | null = null, originScroll?: () => number): void {
		if (item.outsideFilter) return;
		this.cleanups.push(
			draggable({
				element: cardEl,
				getInitialData: () => ({
					path: item.file.path,
					hold,
					scrollLeft: originScroll?.() ?? null,
					span: statedSpan(item),
					ends: placementEnds(item.typeName),
					view: this.token,
				}),
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
	 * The item a payload names, resolved at DROP time — the dragged path outlives the
	 * model it was taken from, because a refresh mid-drag can drop the note.
	 *
	 * The `typeof` is the TYPE system's, not a runtime case: pragmatic hands
	 * `source.data` back as `Record<string, unknown>`, while `canDrop` admits only a
	 * source carrying this controller's private token and the one place minting that
	 * token pairs it with `item.file.path`, a string, always. Its false arm is
	 * therefore unreachable by construction and undeletable by typing, so it is left
	 * uncovered on purpose and the reason is written here — the same reasoning
	 * `.fallowrc.json` uses for a member only a framework calls, though that file is
	 * read by a tool and this paragraph by a person. Reaching the branch would take a
	 * faked adapter payload.
	 */
	private resolve(data: Record<string, unknown>): CardSource | null {
		const path = data.path;
		const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
		if (!item) return null;
		return {
			item,
			hold: (data.hold as BarHold | null | undefined) ?? null,
			scrollLeft: typeof data.scrollLeft === 'number' ? data.scrollLeft : null,
			// The payload's own span and ends, minted at drag start — never recomputed from
			// `item` here. `item` is the file the path still resolves to, which is what THIS
			// rule is for; it says nothing about what the gesture is relative to.
			span: (data.span as DateSpan | undefined) ?? { start: null, target: null },
			ends: Array.isArray(data.ends) ? (data.ends as PlacementEnd[]) : [],
		};
	}

	/**
	 * A region a card can be dropped on, for as long as it renders — an empty column
	 * and an empty shelf included. `plan` is what the drop MEANS, and it belongs to
	 * the caller: this module knows how to resolve a dragged card, never what moving
	 * it should write. `hooks` is optional and unused by a plain region — the dated
	 * shelf is the first caller that needs it, to preview what its removal would leave.
	 *
	 * `plan` takes the RESOLVED source, not just its item — the same shape `accepts`
	 * and `onEnter` already carry. A caller that only needs the item can still ask for
	 * one; a caller planning a relative gesture's removal (the dated shelf) needs the
	 * shape it was captured under too, and a narrower signature would have hidden that
	 * on the one region that turned out to need it.
	 */
	wireDropTarget(el: HTMLElement, plan: (source: CardSource) => void, hooks: DropHooks = {}): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				// Only this view's own drags, and — where the caller asks — only the
				// sources this region actually honours. REFUSED rather than ignored, so
				// the strip never highlights for a drag it would not act on, the same
				// reason a foreign view's card is refused instead of dropped silently.
				canDrop: ({ source }) => {
					if (!this.mine(source.data, 'move')) return false;
					const resolved = this.resolve(source.data);
					return resolved !== null && (!hooks.accepts || hooks.accepts(resolved));
				},
				onDragEnter: ({ source }) => {
					el.addClass(DROP_OVER);
					const resolved = this.resolve(source.data);
					if (resolved) hooks.onEnter?.(resolved);
				},
				onDragLeave: () => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
				},
				onDrop: ({ source }) => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
					// The host owns the write AND the announcement: a drop is one of three
					// inputs to the same move, and three callers announcing separately is
					// how they come to say different things about the same change.
					const resolved = this.resolve(source.data);
					if (resolved) plan(resolved);
				},
			}),
		);
	}

	/**
	 * A region where the POSITION of the pointer is the message, not merely the region
	 * — the timeline's grid. Registered through this controller like every other
	 * target, so it gates on the same private token and keeps the same
	 * resolve-at-drop-time rule: the stakes here are the RECEIVING view's date keys, so
	 * a card crossing between two split panes would write a different property than the
	 * gesture showed.
	 *
	 * What a position MEANS is the caller's, exactly as `plan` is for a region target.
	 */
	wirePositionalTarget(
		el: HTMLElement,
		handlers: {
			onDrag: (source: CardSource, clientX: number, originX: number) => void;
			onDrop: (source: CardSource, clientX: number, originX: number) => void;
			onLeave: () => void;
		},
	): void {
		const report = ({ source, location }: { source: { data: Record<string, unknown> }; location: DragLocationHistory }) => {
			const resolved = this.resolve(source.data);
			// Both coordinates, always: `initial` is where the drag STARTED, which a
			// delta read needs and no handler should have to capture for itself.
			if (resolved) handlers.onDrag(resolved, location.current.input.clientX, location.initial.input.clientX);
		};
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				canDrop: ({ source }) => this.mine(source.data, 'move'),
				// `onDragEnter` fires SYNCHRONOUSLY (a hierarchy change), so the preview
				// paints on the very first frame a drag crosses onto the overlay — the
				// adapter's own `onDrag` is throttled to one animation frame, which would
				// otherwise leave the pointer's first position unshown until the next one.
				onDragEnter: report,
				onDrag: report,
				onDragLeave: () => handlers.onLeave(),
				onDrop: ({ source, location }) => {
					handlers.onLeave();
					const resolved = this.resolve(source.data);
					if (resolved) handlers.onDrop(resolved, location.current.input.clientX, location.initial.input.clientX);
				},
			}),
		);
	}

	/**
	 * A bar's connector as a drag source. Carries no hold, no span and no ends: a link
	 * claims no date, so there is nothing for a relative gesture to measure against.
	 *
	 * `onStart` is where the legal-target sweep happens — once, at drag start — and it is
	 * wired to `onGenerateDragPreview`, not `onDragStart`. The library dispatches the two
	 * differently: `onGenerateDragPreview` fires SYNCHRONOUSLY as part of `dispatch.start`,
	 * while `onDragStart` is scheduled a frame later and only flushed early by a drop
	 * target's OWN hierarchy change — which cannot happen here, because every target's
	 * `canDrop` reads the very state `onStart` is about to set. Waiting for `onDragStart`
	 * therefore deadlocks: no target ever looks legal, so the hierarchy never changes, so
	 * the frame that would have set legality never flushes early, and the sweep runs only
	 * at the drop that already missed it. `onEnd` fires from `onDrop`, however the drag
	 * ends, dropped or cancelled, so the marking it put on the grid can never outlive the
	 * gesture.
	 *
	 * No `outsideFilter` guard, unlike {@link wireCard}: `renderConnector`'s own comment
	 * states why one is unneeded there, and it is this function's caller — `deriveBars`
	 * routes a context row away before a bar ever exists to hang a connector on, so this
	 * is never reached with one.
	 */
	wireLinkSource(el: HTMLElement, item: BacklogItem, hooks: { onStart: () => void; onEnd: () => void }): void {
		this.cleanups.push(
			draggable({
				element: el,
				getInitialData: () => ({ path: item.file.path, kind: LINK_KIND, view: this.token }),
				onGenerateDragPreview: () => {
					el.addClass('is-active');
					hooks.onStart();
				},
				onDrop: () => {
					el.removeClass('is-active');
					hooks.onEnd();
				},
			}),
		);
	}

	/**
	 * A bar as the target of a link. `accepts` refuses rather than ignores, so an illegal
	 * bar never highlights for a drop it would not take — the same contract every region
	 * target keeps, and what makes "refused before release" true rather than a promise.
	 */
	wireLinkTarget(el: HTMLElement, plan: (source: CardSource) => void, hooks: DropHooks = {}): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				canDrop: ({ source }) => {
					if (!this.mine(source.data, 'link')) return false;
					const resolved = this.resolve(source.data);
					return resolved !== null && (!hooks.accepts || hooks.accepts(resolved));
				},
				onDragEnter: ({ source }) => {
					el.addClass(DROP_OVER);
					const resolved = this.resolve(source.data);
					if (resolved) hooks.onEnter?.(resolved);
				},
				onDragLeave: () => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
				},
				onDrop: ({ source }) => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
					const resolved = this.resolve(source.data);
					if (resolved) plan(resolved);
				},
			}),
		);
	}

	/**
	 * Where the pointer IS during a link drag, wherever it is — the gap between two bars
	 * included, which is most of the grid and exactly where a preview line has to keep
	 * drawing. A monitor rather than a target: there is no region here whose meaning is
	 * being asked about, only a coordinate. Gated on the same private token, so a drag in
	 * a split pane over the same notes never draws a line in this one.
	 */
	wireLinkPointer(handlers: { onDrag: (clientX: number, clientY: number) => void; onEnd: () => void }): void {
		this.cleanups.push(
			monitorForElements({
				canMonitor: ({ source }) => this.mine(source.data, 'link'),
				onDrag: ({ location }) => handlers.onDrag(location.current.input.clientX, location.current.input.clientY),
				onDrop: () => handlers.onEnd(),
			}),
		);
	}
}

/**
 * Say what a date move changed. Old span and new, in the same live region and the same
 * words as a board or a horizon move — a drag, a grip, the row's entry and the menu's
 * Unschedule are one move said once.
 *
 * "Unscheduled" is only true where the item actually LEAVES the axis. A parent whose
 * descendants still carry dates keeps a bar: `inferSpan` refills an end the note no
 * longer states, so announcing a removal as "Unscheduled" would describe something
 * other than what renders. The placement is asked of `placeItem` — the function that
 * decides what draws — never of a comparison written beside it.
 *
 * A null placement means the rebuilt model has no row for this item at all: the write
 * took its own note out of the base. Then the dates it wrote are the whole of what can
 * honestly be said. This does NOT announce that the card left the view — that is the
 * outcome report, which needs a note's disappearance correlated with the write that
 * caused it, and `docs/issues/The outcome report was built from one sentence.md`
 * records that as unsolved here.
 */
export function announceScheduleMove(
	title: string,
	change: DateChange,
	placement: Placement | null,
	ends: PlacementEnd[],
): void {
	announceMove(title, statedSpanWords(change.before, ends), destinationWords(change.after, placement, ends));
}

/**
 * The destination side. Checked on `after` — the writer's own tri-state — BEFORE
 * `placement` is asked about anything: a one-ended write (`computeScheduleWrites`
 * permits naming only `start` or only `target`) can leave the untouched end exactly as
 * unreadable as it found it, and `placeItem` reports that faithfully as a shelf with a
 * reason. Deciding from `placement.reason`'s TEXT instead would make this module agree
 * with `bars.ts` about a string neither owns a shared type for — the same mistake
 * matching on `placementLabel`'s wording would be. The tri-state is the one fact both
 * sides of the sentence already share.
 */
function destinationWords(after: StatedEnds, placement: Placement | null, ends: PlacementEnd[]): string {
	const unreadable = unreadableEndWords(after);
	if (unreadable) return unreadable;
	if (placement === null) return spanWords({ start: after.start.value, target: after.target.value }, ends);
	return placementWords(placement, ends);
}

/** A placement that answered neither `invalid` check above: a bar, or a plain shelf. */
function placementWords(placement: Placement, ends: PlacementEnd[]): string {
	return placement.kind === 'shelf' ? UNSCHEDULED_LABEL : spanWords(placement.bar.span, ends);
}

/**
 * What the note itself stated, an end at a time — tri-state, the same collapse
 * `placementLabel` already stopped making on the horizon axis. A `DateSpan` cannot
 * tell a value this axis REFUSES to read from a key the note never set; both flatten
 * to null, so a note holding `start: soon` cleared to nothing would announce "from
 * Unscheduled to Unscheduled" for a cleanup that plainly happened.
 */
function statedSpanWords(stated: StatedEnds, ends: PlacementEnd[]): string {
	return unreadableEndWords(stated) ?? spanWords({ start: stated.start.value, target: stated.target.value }, ends);
}

/**
 * The one place either side of the sentence names an unreadable end — checked start
 * then target, the same order `placeItem` checks a stated pair, so the source and the
 * destination cannot land on different words for the same fact. Null when neither end
 * is unreadable, so a caller can fall through to what the value or the placement says.
 */
function unreadableEndWords(stated: StatedEnds): string | null {
	if (stated.start.invalid) return 'an unreadable start date';
	if (stated.target.invalid) return 'an unreadable target date';
	return null;
}

/**
 * A span in the register's own date format; the shelf's word when there is none.
 *
 * `ends` is what the placement HAS, not what the note happens to carry — the same
 * narrowing the writer applies to the verdict. A one-ended placement is a POINT and is
 * named by its date alone; a two-ended one with a single date stated is an OPEN bar and
 * says which end it is open at. Both sides of the announcement go through here, so the
 * source and the destination cannot be described in different vocabularies — the
 * mistake `placementLabel` and `targetLabel` were split to stop making.
 */
function spanWords(span: DateSpan, ends: PlacementEnd[]): string {
	if (span.start !== null && span.target !== null) {
		return daysBetween(span.start, span.target) === 0
			? formatCivil(span.start)
			: `${formatCivil(span.start)} to ${formatCivil(span.target)}`;
	}
	const only = span.start ?? span.target;
	if (only === null) return UNSCHEDULED_LABEL;
	if (ends.length < 2) return formatCivil(only);
	// Neither phrase may begin with `from` or `to`: `announceMove` already wraps both
	// sides in "from … to …", and an open end that spelled itself that way would say
	// "from from 2026-08-01 to Unscheduled".
	return span.start !== null ? `${formatCivil(only)} onwards` : `up to ${formatCivil(only)}`;
}
