import { isMarkerType, PlacementEnd, placementEnds } from './itemTypes';
import { BacklogItem } from './model';
import { absentReading, CivilDate, FieldReading } from './noteFields';
import { BacklogSettings, optionalKeyFor } from './settings';
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

/** Where one item lands on this axis. */
export type Placement = { kind: 'bar'; bar: TimelineBar } | { kind: 'shelf'; reason: string | null };

/**
 * Bar or shelf, for ONE item, from the ends it is given. Every rule the axis has lives
 * behind this one call — the marker reduction, the unreadable and reversed refusals,
 * the rollup inference — because they do not compose into a single condition anyone
 * could restate correctly beside them.
 */
export function placeItem(item: BacklogItem, stated: StatedEnds): Placement {
	// A MARKER is reduced to its point before any span rule is asked about it. A stale
	// start later than the target would otherwise read as a reversed pair and shelve.
	// The start is ignored, never rewritten — ignoring a value and deleting it are
	// different acts, and only the first was specified.
	if (isMarkerType(item.typeName)) return placeMarker(item, stated.target);
	if (stated.start.invalid) return { kind: 'shelf', reason: 'Unreadable start date' };
	if (stated.target.invalid) return { kind: 'shelf', reason: 'Unreadable target date' };
	if (reversedSpan(stated.start.value, stated.target.value)) {
		return { kind: 'shelf', reason: 'Target date precedes the start date' };
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

export function deriveBars(rows: BacklogItem[]): DatedAxis {
	const axis: DatedAxis = { bars: [], shelf: [], context: [] };
	for (const item of rows) {
		// A context row is never placed by its own dates and gets no inferred span
		// either: it routes straight to `context` before a span is ever computed for it.
		if (item.outsideFilter) {
			axis.context.push(item);
			continue;
		}
		const placement = placeItem(item, statedEnds(item));
		if (placement.kind === 'bar') axis.bars.push(placement.bar);
		else axis.shelf.push({ item, reason: placement.reason });
	}
	return axis;
}

function placeMarker(item: BacklogItem, target: FieldReading<CivilDate>): Placement {
	if (target.invalid) return { kind: 'shelf', reason: 'Unreadable target date' };
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

/** What a gesture may take hold of on a drawn bar. */
export type BarHold = 'body' | 'start' | 'end';

/**
 * Where a gesture may take hold — asked ONCE, by the renderer that draws the grips and
 * by the drag that honours them, so what looks grabbable and what can actually be
 * written cannot disagree.
 *
 * Three rules, each from [[Move and resize a bar]]:
 * - a marker offers no end grips (1g): a point has no duration to resize, and its body
 *   slide moves the target alone;
 * - an INFERRED end withholds the body hold too, not only its own grip (1c) — sliding a
 *   bar half-anchored to its children is a resize wearing a slide's cursor;
 * - an unconfigured key offers no grip at all (1a), because nothing is ever written to
 *   one.
 *
 * An OPEN end is not an inferred end: it is absent, its property is configured, and its
 * grip is exactly how the missing date gets written.
 */
export function barHolds(item: BacklogItem, settings: BacklogSettings, bar: TimelineBar): BarHold[] {
	const ends = placementEnds(item.typeName);
	const writable = (end: PlacementEnd): boolean => ends.includes(end) && optionalKeyFor(settings, end) !== '';
	if (isMarkerType(item.typeName)) return writable('target') ? ['body'] : [];
	const holds: BarHold[] = [];
	if (!bar.inferredStart && writable('start')) holds.push('start');
	if (!bar.inferredEnd && writable('target')) holds.push('end');
	if (!bar.inferredStart && !bar.inferredEnd && holds.length > 0) holds.push('body');
	return holds;
}
