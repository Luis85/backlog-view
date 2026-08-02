import { firstPlacedIndex } from './board';
import { BacklogItem, BacklogModel } from './model';
import { FieldReading, sameValue } from './noteFields';
import { BacklogSettings } from './settings';
import { DateSpan, daysBetween } from './timeline';

/**
 * Deriving the roadmap from the model and the settings: which axis is configured,
 * which items become rows, which bucket or span each row occupies, and what
 * gathers on the shelf. Pure — the DOM lives in `view/render/`, and nothing here
 * writes; this module only answers questions, exactly as `board.ts` does for the
 * workflow columns.
 *
 * The axis is declaration, never detection: a horizon property with ordered
 * values makes the bucket axis, a date property makes the timeline, and no
 * property is ever picked by name-matching — the guess the closest prior art
 * makes, whose first drag writes that guess into frontmatter the user never
 * chose. No date is ever read as a horizon, in either direction.
 */

export type RoadmapAxis = 'horizons' | 'dates';

/**
 * Which axes the options declare, the default first. Horizons lead deliberately:
 * with both configured and no pick yet, the axis that cannot over-promise is the
 * one the format's own literature argues for.
 */
export function configuredAxes(settings: BacklogSettings): RoadmapAxis[] {
	const axes: RoadmapAxis[] = [];
	if (hasHorizonAxis(settings)) axes.push('horizons');
	if (hasDateAxis(settings)) axes.push('dates');
	return axes;
}

/**
 * A horizon property without values is a board without stages — unconfigured. This
 * is the ONE definition of a configured bucket axis: the row menu's set and clear
 * actions gate on it too, so "the axis is configured" cannot mean one thing to the
 * projection that draws it and another to the menu that writes it.
 */
export function hasHorizonAxis(settings: BacklogSettings): boolean {
	return settings.horizonKey !== '' && settings.horizonValues.length > 0;
}

/** One date property is enough: a milestone-only roadmap is perfectly coherent. */
export function hasDateAxis(settings: BacklogSettings): boolean {
	return settings.startKey !== '' || settings.targetKey !== '';
}

/**
 * The axis to draw: the retained pick where its axis is configured, else the
 * axis that remains — a configured axis always beats guidance, and the stored
 * pick is user state the caller keeps, never rewrites, so restoring the cleared
 * configuration restores the choice with it. Null means guidance, not a blank pane.
 */
export function activeAxis(settings: BacklogSettings, pick: string | null): RoadmapAxis | null {
	const axes = configuredAxes(settings);
	if (pick !== null && (axes as string[]).includes(pick)) return pick as RoadmapAxis;
	return axes[0] ?? null;
}

/**
 * A bucket of the horizon axis. Declared buckets render in declared order, empty
 * or not; a result carrying an undeclared value mints a trailing bucket named by
 * itself — the vocabulary guides, it never loses a result. Context rows never
 * mint one: an excluded note's value is not this base's vocabulary.
 */
export interface HorizonBucket {
	/** The placement string this bucket stands for, in its first-seen casing. */
	value: string;
	/** False for a bucket minted by a result's undeclared value. */
	declared: boolean;
	/** Cards in the Base's own sort order; context cards are placement, not population. */
	cards: BacklogItem[];
	/** Result cards only. */
	count: number;
}

/** A bar of the dated axis: the span exactly as the note states it. */
export interface TimelineBar {
	item: BacklogItem;
	span: DateSpan;
}

/** An unplaced result, with the reason when the axis refused a value it found. */
export interface ShelfCard {
	item: BacklogItem;
	/** Why the axis could not place it; null for plain absence — work not yet triaged. */
	reason: string | null;
}

export interface RoadmapModel {
	axis: RoadmapAxis;
	/** The horizon axis; empty on the dated axis. */
	buckets: HorizonBucket[];
	/** The dated axis, in row order; empty on the horizon axis. */
	bars: TimelineBar[];
	/** Unplaced results in sibling order — the tree's own rank, not arrival order. */
	shelf: ShelfCard[];
	/**
	 * Context rows with no place on the axis: rendered beside the shelf as
	 * context, apart from the shelf's count — never shelved, never counted.
	 */
	context: BacklogItem[];
	/** Results placed on the axis; placed plus shelved equals the visible row set. */
	placedCount: number;
}

/** What the shelf is called wherever a placement is named out loud. */
export const SHELF_LABEL = 'Unplaced';
/** And what a key holding something this axis refuses to read is called. */
const UNREADABLE_LABEL = 'an unreadable horizon';

/**
 * What to call the place a horizon value sits in — found by the same
 * case-insensitive match that placed the cards, with the shelf as the answer for
 * absence and for a value naming no bucket: a result the axis did not place is on
 * the shelf, which is the only other place it can be. Anything naming a placement
 * out loud (a move announcement, a menu entry) reads it from here rather than from
 * the raw string, exactly as the board's `columnLabelFor` does — or it would name
 * a bucket the user cannot see.
 */
export function bucketLabelFor(roadmap: RoadmapModel, value: string | null): string {
	if (value === null) return SHELF_LABEL;
	return roadmap.buckets.find((bucket) => sameValue(bucket.value, value))?.value ?? SHELF_LABEL;
}

/**
 * What a card's CURRENT placement is called, taken from the whole reading rather
 * than from its value. Absence and refusal both shelve the card, so `value` alone
 * cannot tell them apart — and the difference is the whole account of a cleanup:
 * removing a value the axis could not read is a real, undoable change, and naming
 * both ends "Unplaced" would report it as a move that did not happen.
 */
export function placementLabel(roadmap: RoadmapModel, reading: FieldReading<string>): string {
	return reading.invalid ? UNREADABLE_LABEL : bucketLabelFor(roadmap, reading.value);
}

/**
 * The row set, the board's own rule: focused, the rendered roots — results as
 * live rows and a focus-level item outside the filter as inert context — else
 * every result. `visible` is the view's one row-visibility predicate (quick
 * filter, hidden completed subtrees), passed in whole so the roadmap, the board
 * and the tree cannot disagree about what is hidden. Both sources are already in
 * tree order, which is what the shelf's sibling order rests on.
 */
function roadmapRows(model: BacklogModel, visible: (item: BacklogItem) => boolean): BacklogItem[] {
	return (model.focused ? model.roots : model.results).filter(visible);
}

/** Project the model onto the given axis. */
export function buildRoadmap(
	model: BacklogModel,
	settings: BacklogSettings,
	visible: (item: BacklogItem) => boolean,
	axis: RoadmapAxis,
): RoadmapModel {
	const rows = roadmapRows(model, visible);
	const roadmap: RoadmapModel = { axis, buckets: [], bars: [], shelf: [], context: [], placedCount: 0 };
	if (axis === 'horizons') deriveBuckets(rows, settings, roadmap, visible);
	else deriveBars(rows, roadmap);
	const results = rows.filter((item) => !item.outsideFilter).length;
	roadmap.placedCount = results - roadmap.shelf.length;
	return roadmap;
}

/**
 * The bucket axis. Two passes on purpose: results place first, because only they
 * may mint a bucket, and context rows then sit in a bucket that already exists —
 * a context value never adds one, and a context row never shelves, because the
 * shelf is a statement about the results.
 */
function deriveBuckets(
	rows: BacklogItem[],
	settings: BacklogSettings,
	roadmap: RoadmapModel,
	visible: (item: BacklogItem) => boolean,
): void {
	const buckets = settings.horizonValues.map(
		(value): HorizonBucket => ({ value, declared: true, cards: [], count: 0 }),
	);
	const byValue = new Map<string, HorizonBucket>(buckets.map((b) => [b.value.toLowerCase(), b]));
	for (const item of rows) {
		if (!item.outsideFilter) placeResult(item, buckets, byValue, roadmap);
	}
	for (const item of rows) {
		if (item.outsideFilter) placeContext(item, byValue, roadmap);
	}
	// Within a bucket, order is the Base's own sort — never a stored bucket rank —
	// with a context card interleaved where its first visible result would sort,
	// the board's own rule: its raw entryIndex is a load position, and sorting by
	// it would sink every context card to the bottom of its bucket.
	const sortIndex = new Map<BacklogItem, number>();
	for (const bucket of buckets) {
		for (const card of bucket.cards) {
			sortIndex.set(card, card.outsideFilter ? firstPlacedIndex(card, visible) : card.entryIndex);
		}
	}
	for (const bucket of buckets) {
		bucket.cards.sort((a, b) => (sortIndex.get(a) ?? 0) - (sortIndex.get(b) ?? 0) || a.entryIndex - b.entryIndex);
	}
	roadmap.buckets = buckets;
}

/** A result places by its own value — minting a trailing bucket if needed — or shelves. */
function placeResult(
	item: BacklogItem,
	buckets: HorizonBucket[],
	byValue: Map<string, HorizonBucket>,
	roadmap: RoadmapModel,
): void {
	const reading = item.horizon;
	if (reading.invalid) {
		roadmap.shelf.push({ item, reason: 'Unreadable horizon value' });
		return;
	}
	if (reading.value === null) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	// Matching is case-insensitive, exactly as the board matches states.
	let bucket = byValue.get(reading.value.toLowerCase());
	if (!bucket) {
		bucket = { value: reading.value, declared: false, cards: [], count: 0 };
		byValue.set(reading.value.toLowerCase(), bucket);
		buckets.push(bucket);
	}
	bucket.cards.push(item);
	bucket.count++;
}

/** A context row sits in a bucket that already exists, or beside the shelf — never in it. */
function placeContext(item: BacklogItem, byValue: Map<string, HorizonBucket>, roadmap: RoadmapModel): void {
	const value = item.horizon.value;
	const bucket = value !== null ? byValue.get(value.toLowerCase()) : undefined;
	if (bucket) bucket.cards.push(item);
	else roadmap.context.push(item);
}

/**
 * The dated axis. A bar states exactly what the note states: one date is enough
 * to place, a reversed span is unreadable rather than silently swapped, and a
 * context row is never placed by its own dates — its span, once spans roll up,
 * is the one its visible results give it, so until then it stands beside the
 * shelf as context.
 */
function deriveBars(rows: BacklogItem[], roadmap: RoadmapModel): void {
	for (const item of rows) {
		if (item.outsideFilter) {
			roadmap.context.push(item);
			continue;
		}
		const start = item.plannedStart;
		const target = item.plannedTarget;
		if (start.invalid) roadmap.shelf.push({ item, reason: 'Unreadable start date' });
		else if (target.invalid) roadmap.shelf.push({ item, reason: 'Unreadable target date' });
		else if (start.value === null && target.value === null) roadmap.shelf.push({ item, reason: null });
		else if (start.value !== null && target.value !== null && daysBetween(start.value, target.value) < 0) {
			roadmap.shelf.push({ item, reason: 'Target date precedes the start date' });
		} else {
			roadmap.bars.push({ item, span: { start: start.value, target: target.value } });
		}
	}
}
