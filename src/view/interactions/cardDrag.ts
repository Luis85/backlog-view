import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { DragLocationHistory } from '@atlaskit/pragmatic-drag-and-drop/types';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { announce, cleanup as liveRegionCleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import { TFile } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BoardModel, columnLabelFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';
import {
	HorizonSource,
	placementLabel,
	resourcePlacementLabel,
	ResourceSource,
	resourceTargetLabel,
	RoadmapModel,
	targetLabel,
} from '../../domain/roadmap';
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
export type DragKind = 'move' | 'link';

function kindOf(data: Record<string, unknown>): DragKind {
	return data.kind === LINK_KIND ? 'link' : 'move';
}

/**
 * The adapter's own location, reduced to the two coordinates a positional gesture reads.
 * One place, so a target that measures a delta and one that reads a position cannot end
 * up taking their baseline from different fields of the same event.
 */
function at(location: DragLocationHistory): PointerAt {
	return { clientX: location.current.input.clientX, originX: location.initial.input.clientX };
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
function announceMove(title: string, from: string, to: string, also = ''): void {
	announce(`Moved "${title}" from ${from} to ${to}${also}`);
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
 * The resources axis's own pair, asked of two functions for the same reason the horizon
 * axis has two — what the note SAID and where the user SENT it are different questions,
 * and answering them once cost a cleanup being reported as no change.
 *
 * `landed` is the axis's second dimension, and it is optional because it is genuinely
 * absent from most moves here: a pick from the menu, an Alt+arrow and a purely vertical
 * drag all answer WHO and say nothing about when. Where a gesture answered both, both are
 * in ONE sentence rather than two announcements — a live region is read in order, and two
 * messages about one gesture are two events to a screen-reader user, who then has to
 * decide whether their single drag did two things.
 *
 * The date half is the DESTINATION alone, not a second "from … to …": the frame is
 * already spent on the row, and `destinationWords` is the same answer
 * `announceScheduleMove` gives, from the writer's own tri-state and the placement that
 * actually drew — so the two axes cannot describe one landing differently.
 */
export function announceResourceMove(
	roadmap: RoadmapModel | null | undefined,
	title: string,
	from: ResourceSource,
	to: string | null,
	landed?: { change: DateChange; placement: Placement | null; ends: PlacementEnd[] },
): void {
	if (!roadmap) return;
	const also = landed ? `, ${destinationWords(landed.change.after, landed.placement, landed.ends)}` : '';
	announceMove(title, resourcePlacementLabel(roadmap, from), resourceTargetLabel(roadmap, to), also);
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
 * Where the pointer is, for a target whose POSITION is part of the message. Both
 * coordinates always, because they answer different questions and no handler should have
 * to capture one for itself: `clientX` is where the pointer IS, which a placing gesture
 * reads absolutely, and `originX` is where the drag STARTED, which a relative gesture
 * measures its delta from.
 */
export interface PointerAt {
	clientX: number;
	originX: number;
}

/**
 * What a region does beyond taking the drop. All optional: a bucket needs none of them,
 * while the dated shelf needs two — it honours one hold and previews what its removal
 * would leave — and the grid axes need `onDrag`, since a ghost that follows the pointer
 * cannot be drawn from an enter event alone. The hooks carry the RESOLVED source, which
 * the highlight-only contract never had to expose and a hover preview cannot do without.
 */
export interface DropHooks {
	/** Which sources this region honours. Refusing withholds the highlight too. */
	accepts?: (source: CardSource) => boolean;
	onEnter?: (source: CardSource) => void;
	/**
	 * Every frame the pointer is over this region, and once SYNCHRONOUSLY on entry — the
	 * adapter's own `onDrag` is throttled to an animation frame, so without the entry call
	 * the pointer's first position goes unshown until the next one. Registered only where
	 * a caller asks for it: a region target would otherwise resolve its source out of the
	 * model on every frame of every drag to hand it to nobody.
	 */
	onDrag?: (source: CardSource, at: PointerAt) => void;
	onLeave?: () => void;
	/**
	 * False for a target that is a COORDINATE rather than a place — the dated axis's
	 * grid-wide overlay, where the pointer's X is the whole message and a highlight over
	 * the entire day area would say nothing about where the release lands. Everything
	 * else highlights, because the highlight is its only drop signal.
	 */
	highlight?: boolean;
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
	private readonly unmarkView: () => void;
	private readonly flushUpdate: () => void;
	/** A gesture of this view's is in flight — the monitor's, so it outlives a render. */
	private dragging = false;
	private pendingUpdate = false;

	constructor(host: BacklogViewHost, viewEl: HTMLElement, flushUpdate: () => void) {
		this.host = host;
		this.viewEl = viewEl;
		this.flushUpdate = flushUpdate;
		this.unmarkView = this.markViewWhileDragging();
	}

	/**
	 * Record a data update, answering whether it has to wait — the write gate's
	 * `deferUpdate`, for the other thing a render pass destroys.
	 *
	 * `onRenderStart` unhooks every registration this controller made, and pragmatic
	 * resolves a DROP TARGET out of its registry at dispatch time exactly as it does a
	 * source (`notifyCurrent` in `make-drop-target.js`). So a release whose recorded
	 * target was torn down mid-flight reaches no `onDrop` at all: the gesture writes
	 * nothing, says nothing, and looks like a drag the user misaimed. The browser hides it
	 * further — with no registered target under the pointer the adapter stops calling
	 * `preventDefault` on `dragover`, so no `drop` event fires in the first place. It
	 * recovers on the next `dragover` over a re-registered element, which is why it is
	 * intermittent rather than permanent, and why it bites hardest just after a view opens,
	 * when the query is still settling and updates arrive unprompted.
	 *
	 * Waiting costs nothing the payload was not already built for: a `CardSource` captures
	 * its span and shape at drag start on purpose, `resolve` re-reads the note at drop
	 * time, and the writer checks every stated baseline against the live frontmatter. The
	 * flush runs from the monitor's `onDrop`, which fires AFTER the drop targets' — so the
	 * batch the release planned is already in flight when the rebuild happens — and which
	 * is told however the drag ends, a drop, a cancel or the library's broken-drag
	 * fallback, so a deferred update can never be stranded.
	 */
	deferUpdate(): boolean {
		if (!this.dragging) return false;
		this.pendingUpdate = true;
		return true;
	}

	/**
	 * `pbl-dragging`, for as long as one of this view's card moves is in flight.
	 *
	 * A MONITOR, registered for this controller's whole life and cleaned up only by
	 * `dispose` — deliberately not among the per-render registrations, and not on the
	 * `draggable` whose card the gesture picked up. The class rides `viewEl`, which is
	 * built once and outlives every render, so the hook that takes it off has to outlive
	 * every render too. A `draggable`'s does not: `onRenderStart` unhooks all of them at
	 * the top of each pass, and pragmatic resolves a source's own callbacks out of its
	 * registry AT DISPATCH TIME — "a draggable can be … removed completely" is the
	 * library's own comment on the lookup — so a gesture that crossed a render never gets
	 * its `onDrop`. A monitor is looked up in a registry of its own, kept in the drag's
	 * active set from the moment it starts, and so is told however the drag ends: a drop,
	 * a cancel, or the library's broken-drag fallback for a source removed mid-flight.
	 *
	 * The failure this fixes is silent and permanent. Nothing looks
	 * wrong until the pane stops responding: a stale class leaves
	 * `.pbl-dragging .pbl-timeline-drop { pointer-events: auto }` standing, and that
	 * full-grid overlay then swallows every pointer event for the life of the view. No
	 * row hover, no connector, no way to start another drag.
	 *
	 * The monitor watches EVERY drag of this view — both kinds — because `dragging` is
	 * what `deferUpdate` reads, and a render mid-flight destroys a link gesture exactly
	 * as it does a move's: the targets, the preview monitor and the legality marks are
	 * all per-render registrations. The CLASS stays gated to `'move'`, which is what a
	 * link drag is NOT: it means a card move is in flight, and `.pbl-linking` is the
	 * link's own — `test/view/linkDrag.test.ts` asserts that absence mid-gesture.
	 */
	private markViewWhileDragging(): () => void {
		return monitorForElements({
			canMonitor: ({ source }) => source.data.view === this.token,
			onDragStart: ({ source }) => {
				this.dragging = true;
				if (kindOf(source.data) === 'move') this.viewEl.addClass('pbl-dragging');
			},
			onDrop: () => {
				this.dragging = false;
				this.viewEl.removeClass('pbl-dragging');
				if (!this.pendingUpdate) return;
				this.pendingUpdate = false;
				this.flushUpdate();
			},
		});
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
		this.unmarkView();
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
					// The file alone: its `path` is the lookup key AND the file is the
					// confirmation, because a rename mutates this object in place. A path
					// captured here beside it would be the one that goes stale. See `resolve`.
					file: item.file,
					hold,
					scrollLeft: originScroll?.() ?? null,
					span: statedSpan(item),
					ends: placementEnds(item.typeName),
					view: this.token,
				}),
				// The card's OWN mark only. What the drag puts on the view is the monitor's
				// (`markViewWhileDragging`), because this hook is skipped entirely for a
				// gesture that crossed a render — and unlike `viewEl`, this element does not
				// survive one, so a mark stranded here dies with it.
				onDragStart: () => cardEl.addClass('pbl-drag-source'),
				// Fires when the drag ends however it ends — dropped or cancelled.
				onDrop: () => cardEl.removeClass('pbl-drag-source'),
			}),
		);
	}

	/**
	 * The item a payload names, resolved at DROP time — the payload outlives the model it
	 * was taken from, because a refresh mid-drag can drop the note, move it, or replace it.
	 *
	 * **The payload carries the FILE, and the file answers both questions.** Its `.path`
	 * is the lookup key and the file itself is the confirmation, and one fact makes that
	 * one field enough: Obsidian renames by mutating the one `TFile` in place, so
	 * `file.path` is always the note's CURRENT path, while a deletion leaves the object
	 * detached and mints a different one for anything created at the same name. The same
	 * fact `src/storage/CLAUDE.md` leans on for the dependency undo, used here for the
	 * other direction.
	 *
	 * Both halves are needed and they fail oppositely, which is why neither alone was
	 * right. A path captured at drag START goes stale the moment the note is renamed —
	 * the lookup then finds nothing and cancels a drop that was entirely valid. A path
	 * trusted without the identity check accepts a delete-and-recreate under the same
	 * name — the lookup succeeds and hands the caller somebody else's note. Reading the
	 * path OFF the captured file gets the rename for free and leaves the comparison to
	 * catch the replacement.
	 *
	 * This is the rule `drop` in `linkDrag.ts` already keeps for the TARGET
	 * (`liveTarget?.file !== target.file`), asked of the source, and it is asked HERE
	 * rather than there because every drag this view has — a board move, a bucket, the
	 * shelf, a link — comes through this one method, so a guard in any single caller
	 * would leave the others open.
	 *
	 * The `typeof` is the TYPE system's, not a runtime case: pragmatic hands
	 * `source.data` back as `Record<string, unknown>`, while `canDrop` admits only a
	 * source carrying this controller's private token and both places minting that
	 * token pair it with `item.file`, whose `path` is a string, always. Its false arm
	 * is therefore unreachable by construction and undeletable by typing, so it is left
	 * uncovered on purpose and the reason is written here — the same reasoning
	 * `.fallowrc.json` uses for a member only a framework calls, though that file is
	 * read by a tool and this paragraph by a person. Reaching the branch would take a
	 * faked adapter payload.
	 */
	private resolve(data: Record<string, unknown>): CardSource | null {
		const file = data.file as TFile | undefined;
		const path = file?.path;
		const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
		if (!item || item.file !== file) return null;
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
	 * A region a card OR a link can be dropped on, for as long as it renders — an empty
	 * column and an empty shelf included, and a bar wherever another bar's link may point
	 * at it. `plan` is what the drop MEANS, and it belongs to the caller: this module
	 * knows how to resolve a dragged source, never what landing on it should write.
	 * `hooks` is optional and unused by a plain region — the dated shelf is the first
	 * caller that needed it, to preview what its removal would leave.
	 *
	 * `plan` takes the RESOLVED source, not just its item — the same shape `accepts`
	 * and `onEnter` already carry. A caller that only needs the item can still ask for
	 * one; a caller planning a relative gesture's removal (the dated shelf) needs the
	 * shape it was captured under too, and a narrower signature would have hidden that
	 * on the one region that turned out to need it.
	 *
	 * `kind` defaults to `'move'` — the shape every ordinary region target already has —
	 * so refusing a link is what registering a target the everyday way already does,
	 * never something a caller has to remember to ask for. This used to be a second
	 * method, `wireLinkTarget`, identical but for the literal it passed `mine`; fallow
	 * flagged the clone, and the duplication was the tell that the guard was a
	 * convention rather than a structure — a target written the ordinary way inherited
	 * nothing from it. One method with a defaulted parameter is what makes "call this
	 * the usual way and a link is refused" true by construction rather than by a second
	 * method somebody has to know to reach for.
	 * `test/view/cardDrag.test.ts`'s "a link-kind payload is refused by an ordinary drop
	 * target" drives exactly the default path, undefended by any `accepts` of its own.
	 *
	 * **A POSITION on the region is part of what a drop can mean**, and that is why there
	 * is no second method for it. `plan` and `hooks.onDrag` carry the pointer, so a target
	 * whose meaning is "this region" ignores the second argument exactly as every existing
	 * caller does, and one whose meaning is "this region, at this day" reads it. This was
	 * `wirePositionalTarget`, identical but for the highlight and the coordinates — the
	 * same clone `wireLinkTarget` was, folded in for the same reason: a target written the
	 * ordinary way must INHERIT the behaviour rather than remember to reach for a second
	 * method. It is what lets a resources-axis band be one target that answers both
	 * questions instead of two that each answer half.
	 */
	wireDropTarget(
		el: HTMLElement,
		plan: (source: CardSource, at: PointerAt) => void,
		hooks: DropHooks = {},
		kind: DragKind = 'move',
	): void {
		// ONE function object, handed to the adapter's `onDrag` and called from
		// `onDragEnter` — the shape `wirePositionalTarget` had, kept for its reason: the
		// enter must report SYNCHRONOUSLY (see `DropHooks.onDrag`) and a second closure
		// beside it would be a second place the source is resolved.
		const report = hooks.onDrag
			? ({ source, location }: { source: { data: Record<string, unknown> }; location: DragLocationHistory }): void => {
					const resolved = this.resolve(source.data);
					if (resolved) hooks.onDrag?.(resolved, at(location));
				}
			: undefined;
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				// Only this view's own drags of THIS kind, and — where the caller asks —
				// only the sources this region actually honours. REFUSED rather than
				// ignored, so the strip never highlights for a drag it would not act on,
				// the same reason a foreign view's card is refused instead of dropped
				// silently.
				canDrop: ({ source }) => {
					if (!this.mine(source.data, kind)) return false;
					const resolved = this.resolve(source.data);
					return resolved !== null && (!hooks.accepts || hooks.accepts(resolved));
				},
				onDragEnter: (event) => {
					if (hooks.highlight !== false) el.addClass(DROP_OVER);
					const resolved = this.resolve(event.source.data);
					if (resolved) hooks.onEnter?.(resolved);
					// SYNCHRONOUS, unlike the adapter's own throttled `onDrag` below.
					report?.(event);
				},
				// Registered only where a caller asked for it: resolving the source out of
				// the model on every frame is work a region target has no use for.
				onDrag: report,
				onDragLeave: () => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
				},
				onDrop: ({ source, location }) => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
					// The host owns the write AND the announcement: a drop is one of three
					// inputs to the same move, and three callers announcing separately is
					// how they come to say different things about the same change.
					const resolved = this.resolve(source.data);
					if (resolved) plan(resolved, at(location));
				},
			}),
		);
	}

	/**
	 * A bar's connector as a drag source. Carries no hold, no span and no ends: a link
	 * claims no date, so there is nothing for a relative gesture to measure against.
	 * The target half of a link is the ordinary `wireDropTarget`, called with
	 * `kind: 'link'` — see that method.
	 *
	 * `onStart` is where the legal-target sweep happens — once, at drag start — and it is
	 * wired to `onGenerateDragPreview`, not `onDragStart`. `onGenerateDragPreview` fires
	 * SYNCHRONOUSLY as part of `dispatch.start`; `onDragStart` is scheduled a frame later
	 * (`dragStart.schedule`, a plain `requestAnimationFrame` under the library's own
	 * `raf-schd`) and is flushed early only by a drop target's OWN hierarchy change. That
	 * distinction matters here only because THIS TEST HARNESS dispatches a whole gesture —
	 * start, enter, over, drop — synchronously, in one tick with no frame in between:
	 * every target's `canDrop` reads the state `onStart` is about to set, so under
	 * `onDragStart` the sweep would run a frame after a synchronous test has already
	 * asserted, never before it. In a live browser the deferred frame still fires on its
	 * own a few milliseconds later regardless of what the pointer does next — there is no
	 * deadlock in the library, only an ordering this harness's synchronous dispatch cannot
	 * observe under the later hook.
	 *
	 * `el.addClass('is-active')` here is the library's own documented use of
	 * `onGenerateDragPreview` — styling the element BECOMING the preview, before the
	 * browser captures it. `hooks.onStart` (the legality sweep, `begin` in
	 * `linkDrag.ts`) additionally mutates OTHER elements — the content box, other rows —
	 * which is the case pragmatic's own docs caution against inside this specific hook,
	 * since the browser may snapshot the native drag preview at the end of it and nothing
	 * else is guaranteed to have painted first. Whether that snapshot actually looks wrong
	 * in Obsidian is unverifiable here: jsdom renders nothing and generates no preview
	 * image at all. That is a live-vault check this repository owes
	 * (`docs/tests/suites/Smoke test the roadmap.md`), not one this suite can discharge —
	 * say so rather than assert it is fine.
	 *
	 * `onEnd` fires from `onDrop`, however the drag ends, dropped or cancelled, so the
	 * marking it put on the grid can never outlive the gesture.
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
				getInitialData: () => ({ file: item.file, kind: LINK_KIND, view: this.token }),
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
