import { CardDragController, CardSource } from './cardDrag';
import { RowContext } from '../render/columns';
import { spanText } from '../render/timeline';
import { BacklogViewHost } from '../host';
import { placeItem, statedEnds, StatedEnds } from '../../domain/bars';
import { PlacementEnd, placementEnds } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';
import { absentReading, CivilDate, FieldReading, readDate } from '../../domain/noteFields';
import { BacklogSettings, optionalKeyFor } from '../../domain/settings';
import { addDays, barGeometry, cellSpan, dayAt, formatCivil, MIN_BAR_PX, TimelineScale, TimelineWindow } from '../../domain/timeline';
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
 * This increment is PLACING only — a shelf card dropped at a position. Moving a bar
 * already on the grid (a hold on its body or an end grip) reads a DELTA rather than a
 * position, and is the next increment's; `CardSource.hold` is already on the payload
 * for it to dispatch on.
 */

/** Everything a gesture on the grid measures against. */
export interface TimelineParts {
	overlay: HTMLElement;
	scroller: HTMLElement;
	window: TimelineWindow;
	scale: TimelineScale;
}

export function wireTimelineDrag(ctx: RowContext, dnd: CardDragController, parts: TimelineParts): void {
	// Annotated rather than inferred from `ctx.host` — fallow resolves interface
	// members through an explicit type, not a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	dnd.wirePositionalTarget(parts.overlay, {
		onDrag: (source, clientX) => preview(host, parts, source, clientX),
		onLeave: () => clearPreview(parts),
		onDrop: (source, clientX) => {
			clearPreview(parts);
			// A drag ending nowhere meaningful writes nothing and does not consume the
			// undo slot: `shelfPlan` returns null wherever the item has no writable end
			// at all, which `renderShelf`'s own `canSchedule` gate keeps this gesture
			// from starting in the first place — this is the same refusal restated for
			// any entry point that reaches the overlay some other way.
			const plan = shelfPlan(host, parts, source.item, clientX);
			if (plan) void host.performScheduleMove(source.item, plan.plan, plan.from);
		},
	});
	// Auto-scroll is opt-in per element, and the element to register is the one that
	// actually scrolls: here the timeline's own scroller, because
	// [[Zoom and the today marker]] requires the scrolling to stay inside the view and
	// the pane never to scroll sideways. Without this a drag could reach no date that
	// is not already on screen, and the grid is thousands of pixels wide by design.
	dnd.wireScroller(parts.scroller);
}

/**
 * The day under the pointer. `dayAt` takes an offset from the window's first day while
 * the adapter reports a VIEWPORT `clientX`, so the overlay's own bounding rect is
 * subtracted — the rect starts past the sticky lead column, which is why that exclusion
 * needs no constant.
 *
 * One subtraction and NO scroll term: a bounding rect already moves with the scroll, and
 * adding `scrollLeft` would double-count the pan. Untranslated, a drop over one day would
 * schedule another.
 */
function dropDay(parts: TimelineParts): (clientX: number) => CivilDate {
	return (clientX) => dayAt(parts.window, parts.scale, clientX - parts.overlay.getBoundingClientRect().left);
}

/** What a plan asks for, plus the baseline a relative gesture measured against — absent here. */
interface GesturePlan {
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
	return placementEnds(item.typeName).filter((end) => optionalKeyFor(settings, end) !== '');
}

/**
 * The ghost is drawn from the SAME plan the drop will submit, so the preview and the
 * write cannot disagree about what a position means. Built from `placeItem`, not from
 * the ends a plan would leave stated — those are half a placement: move a parent's
 * stated start while its children supply the other end, and the note states one date
 * while the axis draws the inferred span. Every rule that turns ends into a placement —
 * the marker reduction, the unreadable and reversed refusals, the rollup inference — is
 * behind that one call precisely so no second answer gets written beside it.
 */
function preview(host: BacklogViewHost, parts: TimelineParts, source: CardSource, clientX: number): void {
	clearPreview(parts);
	const plan = shelfPlan(host, parts, source.item, clientX);
	if (!plan) return;
	const placement = placeItem(source.item, plannedEnds(source.item, plan.plan));
	// A drop that shelves draws no ghost on the grid; the shelf's own indicator says so.
	if (placement.kind !== 'bar') return;
	const bar = placement.bar;
	const geometry = barGeometry(parts.window, bar.span);
	const ghost = parts.overlay.createDiv({ cls: 'pbl-drop-ghost' });
	ghost.setCssProps({
		'--pbl-ghost-left': `${geometry.startDay * parts.scale.dayPx}px`,
		'--pbl-ghost-width': `${Math.max(geometry.spanDays * parts.scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = parts.overlay.createDiv({ cls: 'pbl-drop-ghost-dates', text: spanText(bar) });
	dates.setCssProps({ '--pbl-ghost-left': `${geometry.startDay * parts.scale.dayPx}px` });
}

function clearPreview(parts: TimelineParts): void {
	parts.overlay.empty();
}

/**
 * The ends a plan WOULD leave stated on this item: the ones it names, over the ones the
 * note already states. This is only half of a placement, which is why nothing draws
 * from it directly — `preview` hands it straight to `placeItem`, the same call
 * `deriveBars` makes.
 */
function plannedEnds(item: BacklogItem, plan: SchedulePlan): StatedEnds {
	const stated = statedEnds(item);
	const end = (field: PlacementEnd): FieldReading<CivilDate> => {
		const requested = plan[field];
		if (requested === undefined) return stated[field];
		return requested === null ? absentReading() : readDate(requested);
	};
	return { start: end('start'), target: end('target') };
}
