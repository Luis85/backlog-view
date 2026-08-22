import { CardDragController, CardSource, PointerAt } from './cardDrag';
import { RowContext } from '../render/columns';
import { spanText } from '../render/lanes';
import { BacklogViewHost } from '../host';
import { BarHold, placeItem, plannedEnds } from '../../domain/bars';
import { PlacementEnd, placementEnds } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';
import { CivilDate } from '../../domain/noteFields';
import { BacklogSettings } from '../../domain/settings';
import { optionalKeyFor } from '../../domain/optionalProperties';
import {
	addDays,
	barGeometry,
	cellSpan,
	dayAt,
	DateSpan,
	daysBetween,
	formatCivil,
	MIN_BAR_PX,
	TimelineScale,
	TimelineWindow,
} from '../../domain/timeline';
import { SchedulePlan } from '../../domain/writePlan';

/**
 * What a pointer position on the dated grid MEANS. The geometry, the grips and the
 * preview are their own module: `cardDrag.ts` is explicitly *the whole region is the
 * target and the highlight is the only drop signal*, and a positional drag is a second
 * concern that would push it past its stated job as well as its budget.
 *
 * Nothing here registers with the adapter directly — every source and target goes
 * through `CardDragController`, which mints the token that keeps a drag on the view it
 * started from. This module decides what a position means and hands the plan to
 * `host.performScheduleMove`, which is the only place a date batch is planned and the
 * only place it is announced.
 *
 * **Both grid axes ask it, and only one of them registers here.** `wireTimelineDrag` is
 * the dated axis's own wiring, over its one grid-wide overlay. The resources axis wires a
 * target per band element instead — which row a release lands in is half of its message —
 * so `render/roadmap.ts` does that registration and asks THIS module the other half,
 * through `gestureAt` and `previewer`. What a position means is stated once either way;
 * what differs is what the caller combines the answer with.
 *
 * Two gestures, two rules: a shelf card has no origin to move from, so `shelfPlan`
 * reads the pointer's POSITION. A hold on a bar already placed reads a DELTA instead —
 * `holdPlan` — because a rendered edge is not always its date (a span shorter than
 * `MIN_BAR_PX` draws wider than it is), so reading the pointer absolutely would mean
 * the smallest twitch after grabbing a grip already writes a date the grip was never
 * actually on. `planFor` is the one dispatch between them, on `CardSource.hold`.
 */

/** Everything a gesture on the grid measures against. */
export interface TimelineParts {
	/**
	 * The element whose left edge IS day 0 — what every pointer X is measured from. The
	 * dated axis hands over its one grid-wide overlay; the resources axis hands over the
	 * `.pbl-timeline-track` of the band element being wired, because there the target is
	 * a row rather than the grid and each row already draws a track at exactly that
	 * offset. Naming the origin rather than the overlay is what lets both read days from
	 * one function without either assuming where the lead column ends.
	 */
	dayOrigin: HTMLElement;
	scroller: HTMLElement;
	window: TimelineWindow;
	scale: TimelineScale;
	/** Where a PLACEMENT previews — the strip that means "when", for a card with no row. */
	headerTrack: HTMLElement;
	/** Where a MOVE previews — the dragged item's own row. See `previewMount`. */
	tracks: Map<string, HTMLElement>;
	/** The lead width THIS render actually drew — see `overLeadColumn`. */
	leadWidth: number;
}

/**
 * What a gesture on this grid resolved to, or null where it expressed nothing. One
 * function so the dated axis's overlay and a resource row's band cannot disagree about
 * what a release at a coordinate means — they differ only in what they do with the
 * answer, which is the row half neither the date math nor the preview has an opinion
 * about.
 *
 * Null where the reader pointed at nothing: the sticky lead column (whose day is not the
 * one they are looking at), or a hold that wandered back to where it started. Both write
 * nothing and neither consumes the undo slot.
 */
export function gestureAt(
	host: BacklogViewHost,
	parts: TimelineParts,
	source: CardSource,
	pointer: PointerAt,
): GesturePlan | null {
	// Refused before any date math: the origin's own rect drifts left of the STICKY lead
	// column once panned (see `overLeadColumn`), so a release physically over a row's
	// title would otherwise resolve to whatever day that drifted geometry names — a
	// coordinate the reader never pointed at the grid to choose.
	if (overLeadColumn(parts, pointer.clientX)) return null;
	return planFor(host, parts, source, pointer.clientX, pointer.originX);
}

/**
 * A ghost that follows the pointer, and the handle that takes it away again. Shared by
 * both grid axes for the same reason `gestureAt` is: the preview must be drawn from the
 * plan the release will submit, and a second drawing beside it is exactly how a preview
 * comes to promise a write nobody makes.
 *
 * Where it draws is `previewMount`'s, on both axes: the dragged item's own row, or the
 * header's track for a card that has none. A resources-axis band could name the row a
 * release would LAND in instead, and deliberately does not — the band's own drop highlight
 * already says which row that is, and the ghost's job is the dates.
 */
export function previewer(
	host: BacklogViewHost,
	parts: TimelineParts,
): { clear: () => void; draw: (source: CardSource, pointer: PointerAt) => void } {
	// What the last frame drew, held here rather than searched for: the preview mounts
	// into a row that is full of other elements, so clearing it is a removal of known
	// nodes and never a query over the grid on every frame of a drag.
	let drawn: HTMLElement[] = [];
	const clear = (): void => {
		clearPreview(drawn);
		drawn = [];
	};
	return {
		clear,
		draw: (source: CardSource, pointer: PointerAt): void => {
			clear();
			// A pointer over the sticky lead column previews nothing, the same refusal
			// `gestureAt` makes of the release itself.
			if (!overLeadColumn(parts, pointer.clientX)) drawn = preview(host, parts, source, pointer);
		},
	};
}

/**
 * Submit a date gesture — the ONE call either grid axis makes when a release means a date
 * and nothing else. The dated axis's every release is this; the resources axis's END GRIPS
 * are, since a grip states a date and nothing about who is doing the work.
 *
 * `ends` rides along only for a RELATIVE gesture (`from` set): the shape the hold was
 * planned under, which may disagree with the item's CURRENT type by the time the writer
 * sees it. A shelf drop is absolute and states no baseline, so it states no shape either —
 * the writer falls back to the item's own, which is exactly right for a plan made against
 * it a moment ago. That conditional is the reason this is a function rather than a line
 * copied twice: written out at a second call site it came back without the condition, which
 * is a plan submitted under a shape it was not made with.
 */
export function submitGesture(host: BacklogViewHost, source: CardSource, gesture: GesturePlan | null): void {
	if (!gesture) return;
	void host.performScheduleMove(source.item, gesture.plan, gesture.from, gesture.from ? source.ends : undefined);
}

export function wireTimelineDrag(ctx: RowContext, dnd: CardDragController, parts: TimelineParts): void {
	// Annotated rather than inferred from `ctx.host` — fallow resolves interface
	// members through an explicit type, not a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const ghost = previewer(host, parts);
	dnd.wireDropTarget(
		parts.dayOrigin,
		(source, pointer) => {
			ghost.clear();
			submitGesture(host, source, gestureAt(host, parts, source, pointer));
		},
		{
			// The pointer's X is the whole message here, so a highlight over the entire day
			// area would say nothing about where the release lands — see `DropHooks.highlight`.
			highlight: false,
			onDrag: (source, pointer) => ghost.draw(source, pointer),
			onLeave: () => ghost.clear(),
		},
	);
	// Auto-scroll is opt-in per element, and the element to register is the one that
	// actually scrolls: here the timeline's own scroller, because
	// [[Zoom and the today marker]] requires the scrolling to stay inside the view and
	// the pane never to scroll sideways. Without this a drag could reach no date that
	// is not already on screen, and the grid is thousands of pixels wide by design.
	dnd.wireScroller(parts.scroller);
}

/**
 * The day under the pointer. `dayAt` takes an offset from the window's first day while
 * the adapter reports a VIEWPORT `clientX`, so the day origin's own bounding rect is
 * subtracted — the origin is positioned in CONTENT coordinates, so its rect scrolls
 * with the grid and this subtraction stays correct at any pan. It is NOT past the
 * sticky lead column at every scroll position, only unscrolled — see `overLeadColumn`,
 * which every caller here checks first, for the column that guards instead.
 *
 * One subtraction and NO scroll term: a bounding rect already moves with the scroll, and
 * adding `scrollLeft` would double-count the pan. Untranslated, a drop over one day would
 * schedule another.
 */
function dropDay(parts: TimelineParts): (clientX: number) => CivilDate {
	return (clientX) => dayAt(parts.window, parts.scale, clientX - parts.dayOrigin.getBoundingClientRect().left);
}

/**
 * True when a viewport `clientX` sits under the STICKY lead column rather than the grid.
 * Both day origins are positioned in CONTENT coordinates — `.pbl-timeline-drop` at
 * `left: var(--pbl-tl-lead)`, a row's `.pbl-timeline-track` after its own lead cell,
 * both inside the scrolling `.pbl-timeline-content` — so their rects drift left with the
 * pan; `.pbl-timeline-lead` is `position: sticky; left: 0` against the SCROLLER and never
 * moves. Past `parts.leadWidth` of scroll the origin's rect has drifted under the lead
 * column, and — later in the row's markup, same z-index — it wins hit-testing there: a
 * release physically over a row's title would otherwise resolve through `dropDay` to
 * whatever day that drifted geometry names, a coordinate the reader never
 * pointed at the grid to choose. Checked against the SCROLLER's own rect, which — unlike
 * the origin's — does not move with its own internal scroll, exactly as a sticky
 * sibling's position does not.
 *
 * `parts.leadWidth` — the width THIS render actually drew, resized or not — never
 * `TIMELINE_LEAD_PX` directly: a reader who has widened the column would otherwise have
 * every drop between the old boundary and the new one silently refused.
 */
function overLeadColumn(parts: TimelineParts, clientX: number): boolean {
	return clientX < parts.scroller.getBoundingClientRect().left + parts.leadWidth;
}

/**
 * What a plan asks for, plus the baseline a RELATIVE gesture measured against — a
 * hold's, set by `holdPlan`. Absent on a shelf drop, which is absolute and states no
 * baseline because it measured against nothing.
 */
export interface GesturePlan {
	plan: SchedulePlan;
	from?: Partial<Record<PlacementEnd, string | null>>;
}

/**
 * What a SHELF drop means: the day under the pointer, and — only where a span is being
 * written — the zoom's cell as its duration.
 *
 * `cellSpan` supplies a duration ONLY where a span is written; a one-ended plan takes
 * the drop day. Both ways of arriving at one end obey that — a marker, which takes a
 * target and no span whatever is configured (extension 2e), and an ordinary item on an
 * axis where only one date property is named (2c). Neither has a duration to default,
 * so neither is offset from the day the pointer named: computing the span and then
 * narrowing it would put a target-only drop on 3 August at week zoom onto 9 August,
 * which is the silent coarsening decision 1 exists to refuse.
 *
 * Null where the item has no writable end at all — a marker whose target key is
 * unconfigured — so a gesture whose only possible batch is empty never reaches the
 * writer; `renderShelf` keeps the same item from becoming a drag source in the first
 * place, through the same `canSchedule` this narrows.
 */
function shelfPlan(host: BacklogViewHost, parts: TimelineParts, item: BacklogItem, clientX: number): GesturePlan | null {
	// Read here, not captured: a shelf drop is ABSOLUTE. It means "this date", so it
	// answers to the item as it now is, and it states no baseline for the writer to
	// check because it measured against nothing.
	const ends = writableEnds(host.settings, item);
	if (ends.length === 0) return null;
	const day = dropDay(parts)(clientX);
	if (ends.length === 1) {
		const plan: SchedulePlan = {};
		plan[ends[0]] = formatCivil(day);
		return { plan };
	}
	return {
		plan: { start: formatCivil(day), target: formatCivil(addDays(day, cellSpan(parts.scale, day) - 1)) },
	};
}

/** The ends this item's TYPE answers for, narrowed to the keys the view options name. */
function writableEnds(settings: BacklogSettings, item: BacklogItem): PlacementEnd[] {
	return placementEnds(item.typeName, settings.iterationBars).filter((end) => optionalKeyFor(settings, end) !== '');
}

/**
 * What a gesture on the grid asks for, dispatched on `CardSource.hold` — a shelf card
 * has no origin to move from and reads the pointer's position, a hold on a bar already
 * placed reads the delta of the gesture instead. One function so no third caller has to
 * make this choice a second time.
 */
function planFor(
	host: BacklogViewHost,
	parts: TimelineParts,
	source: CardSource,
	clientX: number,
	originX: number,
): GesturePlan | null {
	if (source.hold === null) return shelfPlan(host, parts, source.item, clientX);
	return holdPlan(parts, source, source.hold, clientX, originX);
}

/**
 * The plan a hold means, or null where the gesture expressed no change.
 *
 * **A zero final delta plans nothing, on every hold.** A drag that wanders and comes
 * back to where it started has expressed no change, so it produces no batch at all —
 * not a batch the writer then decides about. If it submitted the model's own endpoints,
 * a note another editor had changed meanwhile would look like a real request and the
 * writer would quietly revert their work.
 */
function holdPlan(parts: TimelineParts, source: CardSource, hold: BarHold, clientX: number, originX: number): GesturePlan | null {
	const span = source.span;
	const ends = source.ends;
	// Viewport-relative, so the pan is INCLUDED: while auto-scroll moves the grid under
	// a held pointer, `clientX - originX` alone stays zero while later dates slide
	// beneath it. The placing read (`dropDay`) subtracts a bounding rect, which already
	// moves with the scroll, and adds no such term — the two rules are opposites for the
	// same reason and must not be unified. `originX` is the adapter's own
	// `location.initial.input.clientX`, carried on every frame rather than latched from
	// one: a baseline read off the first frame the overlay sees discards every pixel of
	// movement before it, and in a synthetic gesture it equals the drop coordinate,
	// which would make this whole expression zero.
	const days = Math.round(
		(clientX - originX + (parts.scroller.scrollLeft - (source.scrollLeft ?? parts.scroller.scrollLeft))) / parts.scale.dayPx,
	);
	if (days === 0) return null;
	if (hold === 'body') return bodySlide(span, ends, days);
	const end: PlacementEnd = hold === 'start' ? 'start' : 'target';
	if (!ends.includes(end)) return null;
	return gripMove(parts, source, end, days);
}

/**
 * Moves only the ends the note actually STATES — both, so a two-ended slide never
 * changes duration; the stated one alone where the bar has one, its open end staying
 * open. The bar's rendered width is not a duration to preserve when half of it is an
 * absence: filling it in would close a one-ended plan by a gesture that promised to
 * move it.
 */
function bodySlide(span: DateSpan, ends: PlacementEnd[], days: number): GesturePlan | null {
	const plan: SchedulePlan = {};
	// The base each end was displaced FROM travels with the plan, so the writer can see
	// that the note moved under the gesture and refuse rather than walk a concurrent
	// edit backwards. A slide means "one day further than THIS", and this is the only
	// place that still knows what "this" was.
	const from: Partial<Record<PlacementEnd, string | null>> = {};
	for (const end of ends) {
		const date = span[end];
		if (date !== null) {
			plan[end] = formatCivil(addDays(date, days));
			from[end] = formatCivil(date);
		} else {
			// An end this gesture does NOT move still states an expectation: it was open
			// when the bar was picked up, and the slide's whole promise is that it stays
			// open. Leaving it out of `from` lets an editor who fills it mid-drag keep that
			// value while the stated end moves under it, so a previewed open-bar slide
			// commits as a closed two-ended span — which is the write the preview said it
			// would not make.
			from[end] = null;
		}
	}
	return Object.keys(plan).length > 0 ? { plan, from } : null;
}

/**
 * One end, dragged by a grip. The date it moves is what the NOTE stated — from the span
 * captured at drag start, never read again — and an open end borrows the other stated
 * end as its baseline: a missing target counts days from the start, a missing start
 * counts back from the target, the same reason a one-dated bar renders one cell wide at
 * the date it has.
 */
function gripMove(parts: TimelineParts, source: CardSource, end: PlacementEnd, days: number): GesturePlan {
	const span = source.span;
	const held = heldDate(span, end, parts);
	const moved = addDays(held, days);
	const opposite = end === 'start' ? span.target : span.start;
	// Clamped at equal rather than crossing — but ONLY against an end the note itself
	// states. A reversed span is a property of a note's OWN pair, which is the only pair
	// `reversedSpan` is ever asked about; where the opposite end is null it is either
	// genuinely absent or inferred — `source.span` is the note's OWN readings, never the
	// subtree's — and either way there is no stated span to reverse, so clamping against
	// it would write a bound this gesture has no evidence for. Extension 1c forbids
	// writing an inferred bound; an absent one has nothing to clamp against either.
	// Dragged past it the gesture writes the day the pointer names, and `inferSpan`
	// places the result.
	const clamped = opposite === null ? moved : clampAtEqual(end, moved, opposite);
	// The grip is relative too, so it states its base for the same reason the body does —
	// but it states the base it ACTUALLY had. An open end borrowed its baseline from the
	// stated opposite end, so recording that borrowed date under the missing end would
	// expect a value the note does not have, and every attempt to fill an open end would
	// be refused. What the gesture assumed is two things and both are recorded: this end
	// was absent, and the end it borrowed from was where it was.
	const own = span[end];
	const from: Partial<Record<PlacementEnd, string | null>> =
		own === null
			? { [end]: null, [other(end)]: opposite === null ? null : formatCivil(opposite) }
			: { [end]: formatCivil(own) };
	return { plan: { [end]: formatCivil(clamped) }, from };
}

/**
 * The date a grip moves — what the note states for that end, drawn at drag start. An
 * open end has no date of its own, so it borrows the stated one: a one-dated bar
 * renders one cell wide at the date it has, and the open end's grip sits there too.
 *
 * The `?? parts.window.start` arm is unreachable through `barHolds`, which withholds
 * every grip unless at least one end is the note's OWN stated value (`domain/bars.ts`):
 * a grip on the stated end always finds its own date, and a grip on the open end always
 * finds the *other* end stated instead — the precondition that makes it "open" rather
 * than "nothing to hold" guarantees the opposite end it borrows from is never itself
 * null. It stands only as a defensive fallback for a `CardSource` built some other way.
 */
function heldDate(span: DateSpan, end: PlacementEnd, parts: TimelineParts): CivilDate {
	const date = end === 'target' ? (span.target ?? span.start) : (span.start ?? span.target);
	return date ?? parts.window.start;
}

/** The other end of a pair — one name for a flip that reads wrong as a ternary. */
function other(end: PlacementEnd): PlacementEnd {
	return end === 'start' ? 'target' : 'start';
}

function clampAtEqual(end: PlacementEnd, moved: CivilDate, opposite: CivilDate): CivilDate {
	const crosses = end === 'start' ? daysBetween(moved, opposite) < 0 : daysBetween(opposite, moved) < 0;
	return crosses ? opposite : moved;
}

/**
 * The ghost is drawn from the SAME plan the drop will submit, so the preview and the
 * write cannot disagree about what a gesture means — a hold's live-updating grip
 * included, through the one dispatch (`planFor`) both the drag and the drop resolve.
 * Built from `placeItem`, not from the ends a plan would leave stated — those are half a
 * placement: move a parent's stated start while its children supply the other end, and
 * the note states one date while the axis draws the inferred span. Every rule that turns
 * ends into a placement — the marker reduction, the unreadable and reversed refusals,
 * the rollup inference — is behind that one call precisely so no second answer gets
 * written beside it.
 */
function preview(
	host: BacklogViewHost,
	parts: TimelineParts,
	source: CardSource,
	pointer: PointerAt,
): HTMLElement[] {
	const plan = planFor(host, parts, source, pointer.clientX, pointer.originX);
	if (!plan) return [];
	const placement = placeItem(source.item, plannedEnds(source.item, plan.plan), host.settings.iterationBars);
	// A drop that shelves draws no ghost on the grid; the shelf's own indicator says so —
	// and neither does one the axis does not place at all (`null`).
	if (placement?.kind !== 'bar') return [];
	const bar = placement.bar;
	const geometry = barGeometry(parts.window, bar.span);
	const mount = previewMount(parts, source);
	const left = `${geometry.startDay * parts.scale.dayPx}px`;
	const ghost = mount.createDiv({ cls: 'pbl-drop-ghost' });
	ghost.setCssProps({
		'--pbl-ghost-left': left,
		'--pbl-ghost-width': `${Math.max(geometry.spanDays * parts.scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = mount.createDiv({ cls: 'pbl-drop-ghost-dates', text: spanText(bar) });
	dates.setCssProps({ '--pbl-ghost-left': left });
	return [ghost, dates];
}

/**
 * WHERE a preview is drawn, which is what makes it read as being about something.
 *
 * A day track — a row's or the header's — is `position: relative` and starts past the
 * lead column, and `.pbl-bar` and `.pbl-drop-ghost` carry the same geometry, so a ghost
 * mounted in one lands exactly where a real bar would with no arithmetic of its own.
 * That is the whole reason the mount is the answer here rather than a computed offset:
 * this module's coordinate rules are the thing it most often gets wrong, and a ghost
 * that inherits a track's box has none to get wrong.
 *
 * - A MOVE draws in the dragged item's OWN row, beside the bar it is proposing to
 *   replace, so the before and the after read as one sentence.
 * - A PLACEMENT has no row — the card is still on the shelf — so it draws in the
 *   header's track, the strip that means "when". Inventing a row for it would claim a
 *   position in an order the drop does not decide.
 *
 * **This is the DATED axis's answer, not the shared one** — see `previewer`, which takes
 * the mount from its caller. It is the best answer available to a target that spans the
 * whole grid: the release names a day and nothing about a row, so the source's own row is
 * the only honest place for it. A resources-axis band knows the destination and says so
 * instead.
 *
 * Drawn into the overlay instead, as it was, the ghost took that layer's full-grid box
 * and `top: 50%` put it at the vertical middle of the WHOLE timeline: never in the
 * dragged row, never anywhere meaningful, and reported from a live vault as a preview
 * that looked unrelated to anything.
 */
function previewMount(parts: TimelineParts, source: CardSource): HTMLElement {
	if (source.hold === null) return parts.headerTrack;
	return parts.tracks.get(source.item.file.path) ?? parts.headerTrack;
}

/**
 * Removes exactly what the last frame drew. It cannot empty the mount any more: a row's
 * track holds the real bar and its grips, and the header's holds every month cell.
 */
function clearPreview(drawn: HTMLElement[]): void {
	for (const el of drawn) el.remove();
}
