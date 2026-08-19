import { t } from '../i18n/t';
import { Absence } from './absences';
import { firstPlacedIndex } from './board';
import { deriveBars, placeItem, ShelfCard, statedEnds, TimelineBar } from './bars';
import { isIterationType, isMarkerType } from './itemTypes';
import { ITERATION_TYPE, MILESTONE_TYPE } from './typeVocabulary';
import { BacklogItem, BacklogModel } from './model';
import { FieldReading, sameValue } from './noteFields';
import { BacklogSettings } from './settings';

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

export type RoadmapAxis = 'horizons' | 'dates' | 'resources';

/**
 * Which axes the options declare, the default first. Horizons lead deliberately:
 * with both configured and no pick yet, the axis that cannot over-promise is the
 * one the format's own literature argues for.
 */
export function configuredAxes(settings: BacklogSettings): RoadmapAxis[] {
	const axes: RoadmapAxis[] = [];
	if (hasHorizonAxis(settings)) axes.push('horizons');
	if (hasDateAxis(settings)) axes.push('dates');
	// LAST, and this list's order is priority. Resources is a further grouping ON TOP
	// of dates — one step more specific still — so it takes the end rather than
	// displacing either: a vault that newly names an assignee property does not have
	// its roadmap change under it, the same way dates has to be picked over a
	// configured horizon axis.
	if (hasResourceAxis(settings)) axes.push('resources');
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
 * The resources axis is DERIVATIVE: a row groups items, and the same start-or-target
 * property the dated axis reads is what positions them inside it. So it needs both, and
 * it can never be configured where the dated axis is not — there is no parallel pair of
 * "resource dates" to name, and gating this on the assignee property alone is the one
 * mistake [[The resource timeline]] names as the one to not make. The ROSTER is
 * deliberately absent from this test: nobody declares who exists, so a row list is
 * optional and observed assignees supply the rest.
 */
export function hasResourceAxis(settings: BacklogSettings): boolean {
	return settings.assigneeKey !== '' && hasDateAxis(settings);
}

/**
 * Whether this axis draws the dated GRID — the day header, the gridlines, the today
 * line and bars — rather than a bucket board. Asked rather than compared, because "the
 * dated grid is on screen" and "the plain dated axis is on screen" stopped being one
 * question when the resources axis arrived: what belongs to the GRID (the zoom, the
 * density, jump-to-today, the state-colour legend) belongs to both, while what belongs
 * to a FOLD (the click-action toggle, the timeline collapse scope) belongs to the plain
 * dated axis alone, since resource rows are flat.
 */
export function drawsGrid(axis: RoadmapAxis): boolean {
	return axis === 'dates' || axis === 'resources';
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

/**
 * A row of the resources axis: one resource, and everything drawn against it. Declared
 * rows render in declared order, empty or not; a result whose assignee is undeclared
 * mints a trailing row named by itself, the same rule an undeclared horizon mints a
 * bucket by. Context rows never mint one — an absence MAY, which is the one place this
 * axis has a third source rather than two.
 *
 * A row draws from a list per SOURCE and the renderer walks each. [[Resource absences]]
 * needed that seam and this comment used to promise it in the wrong shape — that a
 * second source would append to `bars`. It cannot: `TimelineBar.item` is a `BacklogItem`
 * and an absence is deliberately never one, so the second list is `absences`.
 */
/**
 * What the milestones' own row is CALLED — the header, and the key its fold is stored
 * under, since a band is collapsed by its name. A resource genuinely named this would share
 * that one bit and draw a second row beside it; recorded rather than guarded, because every
 * guard costs a rule about names the roster is otherwise free to choose.
 */
const MILESTONE_LANE = 'Milestones';

/**
 * The milestones' own row, holding the bars handed to it. **BOTH grid axes draw one**, which
 * is why it is a function here rather than an object literal inside `deriveLanes`: the name
 * and the three empty fields are the same statement on either, and a second literal spelt in
 * `view/render/lanes.ts` is a caption free to drift from the one the fold key, the roster
 * refusals and `assignableLanes` all read.
 *
 * A row is still minted by the bar that LANDS in it: the caller decides whether an empty one
 * is drawn at all, and neither axis draws it empty.
 */
export function markerLane(bars: TimelineBar[]): ResourceLane {
	return { name: MILESTONE_LANE, declared: true, markers: true, bars, absences: [], context: [] };
}

/**
 * What the marker row's header SAYS — presentation derived from what the row holds,
 * never the lane's identity: `name` stays the constant the fold key and the roster
 * refusal read, and a caption that named a type the row is not drawing would be the
 * legend's own lie one element over. Decided by the user 2026-08-16 (content-aware over
 * a fixed word), spec `2026-08-16-finish-iterations-board-design.md`.
 */
export function markerLaneCaption(bars: TimelineBar[]): string {
	const iterations = bars.some((bar) => isIterationType(bar.item.typeName));
	const milestones = bars.some((bar) => !isIterationType(bar.item.typeName));
	// Built from the vocabulary, not spelled here: a type name is data, and the legend's
	// swatch one element over builds its own caption from the same two constants — so
	// renaming either would have desynced a row header from the swatch that explains it
	// while both looked right in isolation. The trailing `s` is the known ceiling
	// `count.childrenOfType` and the manual's `{deepest}s` already carry: it pluralizes a
	// word this plugin did not write, which is `Type names are data`'s to answer.
	if (milestones && iterations) return t('lane.markersHeaderBoth', { first: MILESTONE_TYPE, second: ITERATION_TYPE });
	return t('lane.markersHeader', { markers: iterations ? ITERATION_TYPE : MILESTONE_TYPE });
}

export interface ResourceLane {
	/** The assignee value this row stands for, in its first-seen casing. */
	name: string;
	/** False for a row minted by a result's undeclared assignee. */
	declared: boolean;
	/**
	 * True for the ONE row that is not a resource at all — the milestones' own, drawn first.
	 * A marker is a point in the plan rather than somebody's work, so it belongs to no
	 * resource and must not be hidden inside one's folded band; it is placed here whatever
	 * its assignee says, and its assignee is never read to position it.
	 *
	 * A boolean rather than a name test, because everything downstream asks a different
	 * question of it: no absence control, no roster declaration, and a drop that writes the
	 * day and never a resource. Comparing `name` against a constant in each of those places
	 * is how a row named by a user comes to be treated as this one.
	 */
	markers: boolean;
	/** Result bars, in tree order, positioned exactly as the dated axis positions one. */
	bars: TimelineBar[];
	/**
	 * This resource's own unavailable stretches — the row's second source, drawn beside
	 * its bars and counted with neither. Never a work item, so never in `bars`, never on
	 * the shelf and never in `placedCount`.
	 */
	absences: Absence[];
	/**
	 * Context rows whose assignee names this row. Drawn here so the row says whose work
	 * they place — never as a positioned bar, never counted, never shelved.
	 */
	context: BacklogItem[];
}

export interface RoadmapModel {
	axis: RoadmapAxis;
	/** The horizon axis; empty on the dated axis. */
	buckets: HorizonBucket[];
	/**
	 * Every bar the drawn axis has, in row order; empty on the horizon axis. Filled on
	 * the resources axis too — flattened in row order — because two readers ask this
	 * list whether a path is drawn as a BAR rather than as a card (the card menu's
	 * children section, the toolbar's collapse gate), and an axis that draws bars while
	 * reporting none makes both answer "card".
	 */
	bars: TimelineBar[];
	/** The resources axis, in row order; empty on the other two. */
	lanes: ResourceLane[];
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
/**
 * What the shelf is called. A FUNCTION and not a `const`, which is load order rather
 * than style: `initLocale()` runs in `onload`, and a module constant is evaluated when
 * the module is first imported — earlier — so a `const` here would freeze English
 * before Obsidian's language was read.
 */
export function shelfLabel(): string {
	return t('placement.unplaced');
}
/** A key holding something this axis refuses to read. */

/** A key that is there and says nothing — the stub the backfill leaves. */


/** The drawn bucket a value belongs to, matched as the cards were placed. */
function bucketFor(roadmap: RoadmapModel, value: string): string | null {
	return roadmap.buckets.find((bucket) => sameValue(bucket.value, value))?.value ?? null;
}

/**
 * Naming a move's two ends. They are DIFFERENT questions and had one answer, which
 * is what made both of them wrong in their own way:
 *
 * - the source asks *what did this note say*, and the shelf is one of three ways to
 *   say nothing — no key, an empty key, a key the axis refuses — of which only the
 *   first is a no-op to clear;
 * - the target asks *where did the user send it*, and that is the value they picked,
 *   whether or not a bucket for it happens to be on screen.
 *
 * Sharing one function let the target inherit the source's shelf fallback, so a pick
 * whose bucket was not drawn — hiding can remove a value's only carrier while the
 * menu still offers it, which `horizonChoices` does on purpose — announced a move to
 * "Unplaced" for a note that went to Someday.
 */

/**
 * Where a pick sends a card. A drawn bucket names it in the casing on screen; with
 * none drawn the value itself is the honest answer, never the shelf — the user named
 * a place, and the write puts the note there whether or not the frame shows it yet.
 */
export function targetLabel(roadmap: RoadmapModel, value: string | null): string {
	if (value === null) return shelfLabel();
	return bucketFor(roadmap, value) ?? value;
}

/**
 * What a card's placement WAS, taken from what the note said rather than from where
 * the card sat. All three of these shelve a card and only the first is nothing to
 * take away, so naming them alike would report a real, undo-consuming cleanup as a
 * move that did not happen — "from Unplaced to Unplaced".
 *
 * The key's presence is the fact `reading` cannot carry: an empty value reads as
 * absence, while `computeHorizonWrites` clears on presence. That divergence is the
 * whole reason this takes a `HorizonSource` and not a `FieldReading`.
 */
export function placementLabel(roadmap: RoadmapModel, source: HorizonSource): string {
	const { reading, keyPresent } = source;
	if (reading.invalid) return t('placement.unreadableHorizon');
	if (reading.value !== null) return bucketFor(roadmap, reading.value) ?? shelfLabel();
	return keyPresent ? t('placement.emptyHorizon') : shelfLabel();
}

/** What a note's horizon key said, and whether it was there at all. */
export interface HorizonSource {
	reading: FieldReading<string>;
	keyPresent: boolean;
}

/**
 * Both pre-write facts about a card's placement, taken together — so a caller
 * capturing "where it came from" before an await cannot capture half of it.
 */
export function horizonSource(item: BacklogItem): HorizonSource {
	return { reading: item.horizon, keyPresent: item.ownKeys.horizon };
}

/** A key that is there and names nobody — the stub the backfill leaves. */


/**
 * The drawn rows whose name is a RESOURCE — every one but the milestones', which is a fact
 * about the plan and not somebody a note can be assigned to.
 *
 * One list, read by every input that turns a drawn row into an assignee value: the Alt+arrow
 * ladder (`resourceStops`) and Set assignee's own choices (`assigneeChoices`). Both mapped
 * `roadmap.lanes` straight through until 2026-08-15, so Alt+Up off the first resource, and
 * a pick in the menu, wrote `Milestones` onto ordinary work — which then minted a SECOND row
 * of that name beside the synthetic one, since `deriveLanes` builds its lookup from the
 * resources alone. The drop already refused it (`band.lane.markers`, in `render/roadmap.ts`),
 * which is what makes this the "one move, three inputs" rule failing by omission: no input
 * disagreed about the write, two just offered a target the third would not.
 *
 * Asked of `markers` rather than of the NAME, and that is the whole reason it is a field:
 * a resource genuinely called Milestones is a resource, and comparing against the constant
 * would take a legitimate roster entry off the ladder.
 *
 * Takes the model as optional because one caller has a roadmap that may not be drawn at all
 * — a row menu opens in every projection — and an empty list is the right answer there.
 */
export function assignableLanes(roadmap: RoadmapModel | undefined): ResourceLane[] {
	return (roadmap?.lanes ?? []).filter((lane) => !lane.markers);
}

/**
 * What the axis HOLDS — every card it placed, whether or not a row was drawn for one.
 *
 * The question behind "does this roadmap have anything to show", and it is the model's
 * rather than the render's because what draws is no longer what is there: a folded bucket,
 * a folded band and the milestones' shared header all put cards on screen that produce no
 * selectable row, and counting rows told a reader with work in front of them that every
 * item was done and hidden. The buckets' count is the one that had to be asked of the model
 * first, when a bucket learnt to fold; the two grid axes reached the same shape later, from
 * bands that fold and from a diamond that is never an `option`.
 *
 * Context rows are counted with the results, and only where the axis PLACED one: a card on
 * screen is a card on screen, and the context the axis could not place is counted by its own
 * strip beside the shelf's.
 */
export function axisPopulation(roadmap: RoadmapModel): number {
	if (roadmap.axis === 'horizons') return roadmap.buckets.reduce((n, bucket) => n + bucket.cards.length, 0);
	// `bars` is flattened across the rows on the resources axis and is the whole grid on the
	// dated one, where no lane draws and the sum below is zero.
	return roadmap.bars.length + roadmap.lanes.reduce((n, lane) => n + lane.context.length, 0);
}

/** The drawn row a name belongs to, matched as the bars were placed. */
function laneFor(roadmap: RoadmapModel, value: string): string | null {
	return roadmap.lanes.find((lane) => sameValue(lane.name, value))?.name ?? null;
}

/**
 * A name in the casing the row on screen carries, or the name itself where no row draws
 * it. Both ends of a resource move's sentence share this half, unlike the horizon axis's
 * pair above — and the reason is this axis's own minting rule rather than a shortcut.
 * `placementLabel` falls back to the SHELF for a value no bucket carries, which is right
 * on an axis where every result's value mints a bucket; here a row exists only where a
 * BAR lands, so a note naming a resource it has no date to sit beside names a resource
 * with no row — and reading that as the shelf would report "from Unplaced" about a note
 * that plainly says Alice. What the two ends do NOT share is the null case, which is the
 * whole of what `targetLabel` and `placementLabel` were split over.
 */
function resourceLabel(roadmap: RoadmapModel, value: string): string {
	return laneFor(roadmap, value) ?? value;
}

/** Where a pick sends a card. Nobody named is the shelf, under the name the frame gives it. */
export function resourceTargetLabel(roadmap: RoadmapModel, name: string | null): string {
	return name === null ? shelfLabel() : resourceLabel(roadmap, name);
}

/** What a note's assignee key said, and whether it was there at all. */
export interface ResourceSource {
	value: string | null;
	keyPresent: boolean;
}

/**
 * Both pre-write facts about who a card names, taken together — so a caller capturing
 * "where it came from" before an await cannot capture half of it. `horizonSource`'s
 * shape, for `horizonSource`'s reason: an empty key reads as absence while
 * `computeAssigneeWrites` clears on PRESENCE, so a real, undo-consuming cleanup would
 * otherwise be announced as a move that did not happen.
 */
export function resourceSource(item: BacklogItem): ResourceSource {
	return { value: item.assigneeValue, keyPresent: item.ownKeys.assignee };
}

/**
 * What a card's assignee WAS. Two ways to say nobody, and only one of them is nothing to
 * take away. There is no third: `readString` refuses nothing here, so an assignee is a
 * string or it is absent, and this axis has no unreadable case for the horizon's third
 * label to answer.
 */
export function resourcePlacementLabel(roadmap: RoadmapModel, source: ResourceSource): string {
	if (source.value !== null) return resourceLabel(roadmap, source.value);
	return source.keyPresent ? t('placement.emptyAssignee') : shelfLabel();
}

/**
 * The row set, the board's own rule: focused, the rendered roots — results as
 * live rows and a focus-level item outside the filter as inert context — else
 * every result. `visible` is the view's one row-visibility predicate (membership in
 * this projection, hidden completed subtrees), passed in whole so the roadmap, the
 * board and the tree cannot disagree about what is hidden. Both sources are already in
 * tree order, which is what the shelf's sibling order rests on.
 *
 * A GRID axis appends `model.iterations` — the parallel population `projectionForest`'s
 * plan forest still excludes (see `BacklogModel.iterations`) — through the SAME `visible`
 * predicate, so whatever narrows the rest of this axis narrows an admitted iteration
 * exactly as well. The horizons axis asks for
 * none of it, placed or shelved, since `drawsGrid('horizons')` is false — the one place
 * this function's own axis argument decides the answer rather than only picking a source.
 */
function roadmapRows(model: BacklogModel, visible: (item: BacklogItem) => boolean, axis: RoadmapAxis): BacklogItem[] {
	const rows = (model.focused ? model.roots : model.results).filter(visible);
	return drawsGrid(axis) ? [...rows, ...model.iterations.filter(visible)] : rows;
}

/** Project the model onto the given axis. */
export function buildRoadmap(
	model: BacklogModel,
	settings: BacklogSettings,
	visible: (item: BacklogItem) => boolean,
	axis: RoadmapAxis,
): RoadmapModel {
	const rows = roadmapRows(model, visible, axis);
	const roadmap: RoadmapModel = { axis, buckets: [], bars: [], lanes: [], shelf: [], context: [], placedCount: 0 };
	if (axis === 'horizons') deriveBuckets(rows, settings, roadmap, visible);
	else if (axis === 'resources') deriveLanes(rows, settings, roadmap, model.absences);
	else {
		const dated = deriveBars(rows, settings.iterationBars);
		roadmap.bars = dated.bars;
		roadmap.shelf = dated.shelf;
		roadmap.context = dated.context;
	}
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
 * The resources axis. Two passes for `deriveBuckets`' own reason — only a result may
 * mint a row, so a context row joins one that already exists — with one difference that
 * follows from the axis being derivative: a result mints its row only where a BAR lands.
 * An assignee with no date to position has nothing to draw, so it would otherwise mint a
 * row whose only member is on the shelf.
 *
 * Every placement question is `placeItem`'s, asked unchanged: the marker reduction, the
 * unreadable and reversed refusals and the rollup inference are the dated axis's rules,
 * and this axis groups their answers rather than restating one of them.
 *
 * A MARKER is the exception to the grouping, not to the placement: it is placed by exactly
 * the same call and then put in a row of its own at the head of the roster, because a
 * milestone is a fact about the plan rather than about a person. Two consequences follow
 * and both are the point — an unassigned milestone draws instead of shelving, since there
 * is no assignee left to be missing, and no fold of anybody's band can take it off screen.
 * The row is minted by its first placed marker, exactly as an undeclared assignee's is: a
 * roster with an empty Milestones header on every base would say nothing.
 */
function deriveLanes(
	rows: BacklogItem[],
	settings: BacklogSettings,
	roadmap: RoadmapModel,
	absences: Absence[],
): void {
	const markers = markerLane([]);
	const lanes = settings.resourceNames.map(
		(name): ResourceLane => ({ name, declared: true, markers: false, bars: [], absences: [], context: [] }),
	);
	const byName = new Map<string, ResourceLane>(lanes.map((lane) => [lane.name.toLowerCase(), lane]));
	for (const item of rows) {
		if (item.outsideFilter) continue;
		if (isMarkerType(item.typeName)) placeBar(item, () => markers, roadmap, settings);
		else placeAssigned(item, lanes, byName, roadmap, settings);
	}
	// Second, so a resource a result already named keeps the casing that result gave its
	// row — and third-source minting: unlike a context row, an absence MAY create one,
	// because it is a statement this base's own notes make about a resource rather than a
	// value borrowed from a note the filter excluded.
	for (const absence of absences) laneNamed(absence.resource, lanes, byName).absences.push(absence);
	for (const item of rows) {
		if (item.outsideFilter) placeContextLane(item, byName, roadmap);
	}
	roadmap.lanes = markers.bars.length > 0 ? [markers, ...lanes] : lanes;
	// Flattened in row order — see `RoadmapModel.bars` for who asks and why.
	roadmap.bars = roadmap.lanes.flatMap((lane) => lane.bars);
}

/**
 * A result joins its resource's row, or shelves. The assignee is asked FIRST and the
 * dates second, and that order is the rule rather than a convenience: a row is who and
 * not when, so an unassigned result shelves whatever its dates say — there is no row to
 * place it into.
 */
function placeAssigned(
	item: BacklogItem,
	lanes: ResourceLane[],
	byName: Map<string, ResourceLane>,
	roadmap: RoadmapModel,
	settings: BacklogSettings,
): void {
	const name = item.assigneeValue;
	if (name === null) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	placeBar(item, () => laneNamed(name, lanes, byName), roadmap, settings);
}

/**
 * One result on the grid, or on the shelf with its reason. The row is a THUNK because a row
 * is minted by the bar that lands in it and never by one that shelves — the rule the roster
 * has always kept for an undeclared assignee, and the same reason the milestones' row is
 * absent from a base whose only marker has no readable date.
 */
function placeBar(item: BacklogItem, lane: () => ResourceLane, roadmap: RoadmapModel, settings: BacklogSettings): void {
	const placement = placeItem(item, statedEnds(item), settings.iterationBars);
	if (placement.kind === 'shelf') {
		roadmap.shelf.push({ item, reason: placement.reason });
		return;
	}
	lane().bars.push(placement.bar);
}

/**
 * The row this name belongs to, minting a trailing one where nothing has yet. Matching is
 * case-insensitive, exactly as the buckets match horizons, and the rule is stated once
 * because two sources may now mint: a result's own assignee, and an absence's.
 *
 * Not to be confused with `laneFor` above, which answers what a DRAWN row is called for
 * the sentence a move is announced in and mints nothing.
 */
function laneNamed(name: string, lanes: ResourceLane[], byName: Map<string, ResourceLane>): ResourceLane {
	const existing = byName.get(name.toLowerCase());
	if (existing) return existing;
	const lane: ResourceLane = { name, declared: false, markers: false, bars: [], absences: [], context: [] };
	byName.set(name.toLowerCase(), lane);
	lanes.push(lane);
	return lane;
}

/**
 * A context row joins a row that already exists, or the axis's undifferentiated context. A
 * marker joins the second whatever it names: "a milestone is in no resource's row" is a
 * rule about the row and not about the bar, so an excluded one must not reach a band by the
 * one path that positions nothing.
 */
function placeContextLane(item: BacklogItem, byName: Map<string, ResourceLane>, roadmap: RoadmapModel): void {
	if (isMarkerType(item.typeName)) {
		roadmap.context.push(item);
		return;
	}
	const name = item.assigneeValue;
	const lane = name === null ? undefined : byName.get(name.toLowerCase());
	if (lane) lane.context.push(item);
	else roadmap.context.push(item);
}

