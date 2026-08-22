import { t } from '../i18n/t';
import { drawsAsPoint, PlacementEnd, placementEnds } from './itemTypes';
import { BacklogItem } from './model';
import { absentReading, CivilDate, FieldReading, readDate } from './noteFields';
import { BacklogSettings } from './settings';
import { optionalKeyFor } from './optionalProperties';
import { DateSpan, daysBetween, reversedSpan } from './timeline';

/**
 * What the DATED axis makes of an item: the bar it draws, the shelf card it becomes,
 * and what a gesture may take hold of. Pure, like everything under `domain/` — the
 * grid is `view/render/timeline.ts`'s and the gestures are
 * `view/interactions/timelineDrag.ts`'s; this module only answers questions.
 *
 * It is a module rather than half of `roadmap.ts` because it is the layer's one place
 * that both DERIVES a placement and is asked to predict one: the drop indicator calls
 * `placeItem` with the ends a removal would leave, and `deriveBars` calls it with the
 * ends the note states. A comparison written beside the placement rules and expected
 * to agree with them is exactly what drifted when the second axis arrived.
 */

/** A bar of the dated axis: the span as the note states it, or fills from its subtree. */
export interface TimelineBar {
	item: BacklogItem;
	span: DateSpan;
	/**
	 * True when that end came from the subtree rather than from the note. Display
	 * only — an inferred date is never written anywhere, and recomputes each pass.
	 */
	inferredStart: boolean;
	inferredEnd: boolean;
}

/** An unplaced result, with the reason when the axis refused a value it found. */
export interface ShelfCard {
	item: BacklogItem;
	/** Why the axis could not place it; null for plain absence — work not yet triaged. */
	reason: string | null;
}

/** What the item states about its plan, tri-state per end, as the readers give it. */
export interface StatedEnds {
	start: FieldReading<CivilDate>;
	target: FieldReading<CivilDate>;
}

export function statedEnds(item: BacklogItem): StatedEnds {
	return { start: item.plannedStart, target: item.plannedTarget };
}

/** The same ends with the named ones removed — what a shelf drop would leave behind. */
export function withoutEnds(stated: StatedEnds, ends: PlacementEnd[]): StatedEnds {
	return {
		start: ends.includes('start') ? absentReading() : stated.start,
		target: ends.includes('target') ? absentReading() : stated.target,
	};
}

/**
 * The ends a plan WOULD leave stated on this item: the ones it names, over the ones the
 * note already states. This is only HALF of a placement, which is why nothing draws from
 * it directly — every caller hands it straight to `placeItem`, the same call `deriveBars`
 * makes, so the marker reduction, the unreadable and reversed refusals and the rollup
 * inference all stay behind one function.
 *
 * It sits beside `withoutEnds` because they are the same question asked two ways: what a
 * gesture would leave. The plan is typed as a bare per-end record rather than
 * `SchedulePlan` so this module never has to import the planner — `domain/writePlan.ts`
 * reads this layer, and an import back the other way is a cycle `npm run analyze` refuses.
 */
export function plannedEnds(item: BacklogItem, plan: Partial<Record<PlacementEnd, string | null>>): StatedEnds {
	const stated = statedEnds(item);
	const end = (field: PlacementEnd): FieldReading<CivilDate> => {
		const requested = plan[field];
		if (requested === undefined) return stated[field];
		return requested === null ? absentReading() : readDate(requested);
	};
	return { start: end('start'), target: end('target') };
}

/** Where one item lands on this axis. */
/**
 * What the dated axis calls an item with no placement, wherever one is named out loud.
 * The shelf's own word is `shelfLabel()` ("Unplaced") and this is deliberately not it:
 * a horizon is triage and a date is a plan, so an item with neither is unplaced on one
 * axis and unscheduled on the other.
 */
/** See `shelfLabel` in `./roadmap` for why this is a function and not a `const`. */
export function unscheduledLabel(): string {
	return t('placement.unscheduled');
}

export type Placement = { kind: 'bar'; bar: TimelineBar } | { kind: 'shelf'; reason: string | null };

/**
 * Bar or shelf, for ONE item, from the ends it is given. Every rule the axis has lives
 * behind this one call — the marker reduction, the unreadable and reversed refusals,
 * the rollup inference — because they do not compose into a single condition anyone
 * could restate correctly beside them.
 */
export function placeItem(item: BacklogItem, stated: StatedEnds, iterationBars: boolean): Placement {
	// A type that DRAWS AS A POINT is reduced to it before any span rule is asked about
	// it. A stale start later than the target would otherwise read as a reversed pair
	// and shelve. The start is ignored, never rewritten — ignoring a value and deleting
	// it are different acts, and only the first was specified.
	if (drawsAsPoint(item.typeName, iterationBars)) return placeMarker(item, stated.target);
	if (stated.start.invalid) return { kind: 'shelf', reason: t('placement.reasonUnreadableStart') };
	if (stated.target.invalid) return { kind: 'shelf', reason: t('placement.reasonUnreadableTarget') };
	if (reversedSpan(stated.start.value, stated.target.value)) {
		return { kind: 'shelf', reason: t('placement.reasonReversedSpan') };
	}
	const bar = inferSpan(item, stated.start.value, stated.target.value);
	return bar === null ? { kind: 'shelf', reason: null } : { kind: 'bar', bar };
}

/** The rows of the dated axis, split as `buildRoadmap` needs them. */
export interface DatedAxis {
	bars: TimelineBar[];
	shelf: ShelfCard[];
	context: BacklogItem[];
}

export function deriveBars(rows: BacklogItem[], iterationBars: boolean): DatedAxis {
	const axis: DatedAxis = { bars: [], shelf: [], context: [] };
	for (const item of rows) {
		// A context row is never placed by its own dates and gets no inferred span
		// either: it routes straight to `context` before a span is ever computed for it.
		if (item.outsideFilter) {
			axis.context.push(item);
			continue;
		}
		const placement = placeItem(item, statedEnds(item), iterationBars);
		if (placement.kind === 'bar') axis.bars.push(placement.bar);
		else axis.shelf.push({ item, reason: placement.reason });
	}
	return axis;
}

/** One drawn row of the dated axis: a bar, and what it says about the bars below it. */
export interface TimelineRow {
	bar: TimelineBar;
	/**
	 * True when another bar of this axis hangs below this one — the chevron's whole
	 * condition, asked of the DESCENDANTS rather than the children: a dateless Feature
	 * between an Epic and its dated PBIs is on the shelf, not on the grid, and the Epic
	 * still has something down there to hide.
	 */
	hasChildren: boolean;
	collapsed: boolean;
}

/**
 * The rows the grid actually draws, and the state of each one's disclosure. A bar under
 * a collapsed bar does not draw; the collapsed bar keeps its chevron, because
 * `hasChildren` is asked of the bars derived BEFORE any of them were hidden — the
 * alternative is a chevron that vanishes the moment it is used.
 *
 * The bit is reached through the predicate rather than read here, which is what keeps
 * this pure — and what lets the view answer from the dated axis's OWN fold state rather
 * than the tree's.
 */
export function timelineRows(bars: TimelineBar[], collapsed: (path: string) => boolean): TimelineRow[] {
	const drawn = new Set(bars.map((bar) => bar.item.file.path));
	const parents = new Set<string>();
	for (const bar of bars) {
		for (const path of barAncestors(bar.item, drawn)) parents.add(path);
	}
	return bars
		.filter((bar) => !barAncestors(bar.item, drawn).some(collapsed))
		.map((bar) => ({
			bar,
			hasChildren: parents.has(bar.item.file.path),
			collapsed: collapsed(bar.item.file.path),
		}));
}

/**
 * The item's ancestors that are themselves drawn as bars. A context row or a shelved
 * parent is stepped THROUGH rather than stopped at — it draws no bar, so it has no
 * chevron to answer for, and the hierarchy it stands in is still the hierarchy.
 */
function barAncestors(item: BacklogItem, drawn: ReadonlySet<string>): string[] {
	const found: string[] = [];
	for (let at = item.parent; at !== null; at = at.parent) {
		if (drawn.has(at.file.path)) found.push(at.file.path);
	}
	return found;
}

function placeMarker(item: BacklogItem, target: FieldReading<CivilDate>): Placement {
	if (target.invalid) return { kind: 'shelf', reason: t('placement.reasonUnreadableTarget') };
	if (target.value === null) return { kind: 'shelf', reason: null };
	// Equal ends are what `barGeometry` already reports as a milestone, so the diamond
	// the timeline draws for a stated pair is the same diamond, reached by the type.
	return {
		kind: 'bar',
		bar: { item, span: { start: target.value, target: target.value }, inferredStart: false, inferredEnd: false },
	};
}

/** True when `a` does not fall after `b`. A missing end bounds nothing. */
function keepsOrder(a: CivilDate | null, b: CivilDate | null): boolean {
	return a === null || b === null || daysBetween(a, b) >= 0;
}

/**
 * Stated dates win endpoint by endpoint; an empty end fills from the subtree's
 * evidence of its OWN kind — starts only ever stand for starts. An inference may
 * extend a statement and never contradict it, so evidence falling on the wrong
 * side of a stated end is dropped and that end stays open. Null when neither the
 * note nor its results supply anything: the shelf's case, unchanged.
 */
function inferSpan(
	item: BacklogItem,
	statedStart: CivilDate | null,
	statedTarget: CivilDate | null,
): TimelineBar | null {
	const evidenceStart = statedStart === null ? item.descendantStart : null;
	const evidenceTarget = statedTarget === null ? item.descendantTarget : null;
	// Both ends inferred and crossing, from single-ended children: neither bounds
	// the other. Cover what is known with both ends open rather than draw a
	// reversed span — evidence bracketing activity without claiming to bound it.
	if (evidenceStart !== null && evidenceTarget !== null && daysBetween(evidenceStart, evidenceTarget) < 0) {
		return { item, span: { start: evidenceTarget, target: evidenceStart }, inferredStart: true, inferredEnd: true };
	}
	const start = statedStart ?? (keepsOrder(evidenceStart, statedTarget) ? evidenceStart : null);
	const target = statedTarget ?? (keepsOrder(statedStart, evidenceTarget) ? evidenceTarget : null);
	if (start === null && target === null) return null;
	return {
		item,
		span: { start, target },
		inferredStart: statedStart === null && start !== null,
		inferredEnd: statedTarget === null && target !== null,
	};
}

/**
 * What a gesture may take hold of on a drawn bar — decided by `barHolds` below, and by
 * nothing else. Every one of them writes a DATE, so every one needs a baseline the note
 * itself states.
 *
 * There is deliberately no hold meaning "the whole bar, for its row alone". One existed
 * for a day (2026-08-14) so a bar with no baseline could still be carried between the
 * resources axis's bands, and it was taken back out: a bar behaves the same on both grids,
 * so a span the note does not state is not something a gesture picks up ANYWHERE. What
 * moves such an item between rows is Set assignee and Alt+Up/Down, which need no baseline
 * because they name a value rather than displacing one.
 */
export type BarHold = 'body' | 'start' | 'end';

/**
 * Where a gesture may take hold — asked ONCE, by the renderer that draws the grips and
 * by the drag that honours them, so what looks grabbable and what can actually be
 * written cannot disagree.
 *
 * Four rules, each from [[Move and resize a bar]]:
 * - a marker offers no end grips (1g): a point has no duration to resize, and its body
 *   slide moves the target alone;
 * - an INFERRED end withholds the body hold too, not only its own grip (1c) — sliding a
 *   bar half-anchored to its children is a resize wearing a slide's cursor;
 * - an unconfigured key offers no grip at all (1a), because nothing is ever written to
 *   one;
 * - **neither end genuinely the note's own withholds every grip**, even one whose
 *   `inferredStart`/`inferredEnd` flag reads false. That flag is set only where
 *   inference actually PRODUCED a date — an end that is simply absent, with no
 *   descendant evidence either, reads as "not inferred" by the same test a stated end
 *   does, so the flags alone cannot tell "open" from "nothing to hold at all". A bar
 *   whose whole span is display — inferred from below, or empty — has no baseline
 *   anywhere on it for a gesture to move from.
 *
 * An OPEN end is not an inferred end: it is absent, its property is configured, and its
 * grip is exactly how the missing date gets written — but only where the OTHER end is
 * the note's own, which is the baseline the open end's grip borrows (`heldDate`).
 */
export function barHolds(item: BacklogItem, settings: BacklogSettings, bar: TimelineBar): BarHold[] {
	const ends = placementEnds(item.typeName, settings.iterationBars);
	const writable = (end: PlacementEnd): boolean => ends.includes(end) && optionalKeyFor(settings, end) !== '';
	if (drawsAsPoint(item.typeName, settings.iterationBars)) return writable('target') ? ['body'] : [];
	const stated = statedEnds(item);
	if (stated.start.value === null && stated.target.value === null) return [];
	const holds: BarHold[] = [];
	if (!bar.inferredStart && writable('start')) holds.push('start');
	if (!bar.inferredEnd && writable('target')) holds.push('end');
	if (!bar.inferredStart && !bar.inferredEnd && holds.length > 0) holds.push('body');
	return holds;
}
