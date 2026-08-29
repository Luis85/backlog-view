import { TFile } from 'obsidian';
import { t } from '../i18n/t';
import { Absence } from './absences';
import { firstPlacedIndex } from './board';
import { deriveBars, placeItem, ShelfCard, statedEnds, TimelineBar } from './bars';
import { isIterationType, isMarkerType, isReleaseType } from './itemTypes';
import { ITERATION_TYPE, MILESTONE_TYPE } from './typeVocabulary';
import { BacklogItem, BacklogModel } from './model';
import { FieldReading, LinkEntry, sameValue } from './noteFields';
import { ResourceNote } from './readItems';
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
 * mistake [[The resource timeline]] names as the one to not make. Whether the base
 * RETURNS any `Resource` notes is deliberately absent from this test too: the axis is
 * CONFIGURED the moment these two properties are, whether the roster it will draw turns
 * out to hold anybody or not — an empty roster is the "no resources" advisory's question
 * to answer, not a reason to call the axis unconfigured.
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
 * A row of the resources axis: one `Resource` note, and everything drawn against it. One
 * row per note the model keeps (`BacklogModel.resources`), in the model's own order,
 * whether or not anything is assigned to it — a roster is exactly this, a resource who
 * exists whether or not work has reached them. Nothing mints a row any more: a result or
 * an absence naming somebody with no `Resource` note behind them places nowhere, on the
 * shelf or drawn nowhere at all rather than inventing a row for a name.
 *
 * A row draws from a list per SOURCE and the renderer walks each. [[Resource absences]]
 * needed that seam and this comment used to promise it in the wrong shape — that a
 * second source would append to `bars`. It cannot: `TimelineBar.item` is a `BacklogItem`
 * and an absence is deliberately never one, so the second list is `absences`.
 */
/**
 * What the milestones' own row is CALLED — the header, and (since it has no note of its
 * own to be keyed by) its fold key too, `laneIdentity`'s fallback below. A resource
 * genuinely named this would share that one word and draw a second row beside it;
 * recorded rather than guarded, because every guard costs a rule about names the roster is
 * otherwise free to choose.
 */
const MILESTONE_LANE = 'Milestones';

/**
 * A lane's identity — what a fold key and a keyboard stop have to agree it IS, not what its
 * header happens to say. Every lane but the milestones' one is a `Resource` note now, so
 * its own path is that identity; the marker row has no note behind it, so it keeps the
 * constant caption as its key, which is safe for the reason above — the one caption a
 * resource sharing it would collide with is a word the roster is free not to pick.
 *
 * Never `lane.name`: two resources sharing a basename draw ONE disambiguated label right up
 * until they collide, and a rename changes the label without the note itself changing — a
 * key built from either would fold the wrong row, or reopen a fold the rename never asked
 * for. `viewState.ts`'s own `laneKey` is this identity's STORAGE form; this is what supplies
 * it, so the two files cannot come to disagree about what identifies a row.
 */
export function laneIdentity(lane: ResourceLane): string {
	return lane.file?.path ?? MILESTONE_LANE;
}

/**
 * The milestones' own row, holding the bars handed to it. **BOTH grid axes draw one**, which
 * is why it is a function here rather than an object literal inside `deriveLanes`: the name
 * and the three empty fields are the same statement on either, and a second literal spelt in
 * `view/render/lanes.ts` is a caption free to drift from the one `laneIdentity` and
 * `assignableLanes` both read.
 *
 * A row is still minted by the bar that LANDS in it: the caller decides whether an empty one
 * is drawn at all, and neither axis draws it empty.
 */
export function markerLane(bars: TimelineBar[]): ResourceLane {
	return { name: MILESTONE_LANE, markers: true, bars, absences: [], context: [], file: null };
}

/**
 * What the marker row's header SAYS — presentation derived from what the row holds,
 * never the lane's identity: `name` stays the constant `laneIdentity`'s fallback reads,
 * and a caption that named a type the row is not drawing would be the legend's own lie
 * one element over. Decided by the user 2026-08-16 (content-aware over a fixed word),
 * spec `2026-08-16-finish-iterations-board-design.md`.
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
	/**
	 * The name this row draws — the collision-aware label {@link resourceLabelsOf} gives
	 * the note (`domain/readItems.ts`'s `namedTargets`, run once per model and read here
	 * through `BacklogModel.resourceLabels`), never a second disambiguation of its own.
	 * Every row is a note now, so this is that note's own name, not a value a result or an
	 * absence happened to spell first.
	 */
	name: string;
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
	/**
	 * The `Resource` note this row IS — its own identity, not a lookup against one. Null
	 * for the one row that is not a resource at all: the milestones' own, which stands for
	 * no note and is never written to. Every other lane's file is this row's note, in tree
	 * order off `BacklogModel.resources`, so a write aimed at a lane can never land on the
	 * wrong person's note the way naming a lane by a STRING and searching for its first
	 * same-named note once could (`AssignableLane` below is the narrowed type for exactly
	 * that write).
	 */
	file: TFile | null;
}

/** A row that IS a resource — every lane but the milestones' one. */
export interface AssignableLane extends ResourceLane {
	file: TFile;
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
	/**
	 * The Base's own results this roadmap could draw — every result minus the types no axis
	 * of it places (`onThisRoadmap`). NOT narrowed by `visible`, unlike every other count
	 * here, because the question it answers is about the BASE and not about the screen: is
	 * there nothing here at all, or is everything here hidden?
	 *
	 * It exists because `roadmapRows` filters and `model.results` does not, and a reader
	 * that took the second while the frame was drawn from the first told a user "All 1
	 * items are done and hidden" about a release that is neither — and offered Show
	 * completed items, which would not have brought it back. One statement of the
	 * population, two readers; the alternative is two readers deriving eligibility
	 * separately and drifting, which is exactly how that happened.
	 */
	eligibleResults: number;
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
 * The Alt+arrow ladder's (`resourceStops`) own list — Set assignee no longer reads it at
 * all (Task 4: it offers `Resource` notes, not drawn rows) — mapped from `roadmap.lanes`
 * straight through until 2026-08-15, when Alt+Up off the first resource wrote
 * `Milestones` onto ordinary work, which then minted a SECOND row of that name beside the
 * synthetic one, since `deriveLanes` builds its lookup from the resources alone. The drop
 * already refused it (`band.lane.markers`, in `render/roadmap.ts`), which is what made
 * that the "one move, three inputs" rule failing by omission: no input disagreed about
 * the write, the ladder just offered a target the drop would not.
 *
 * Asked of `markers` rather than of the NAME, and that is the whole reason it is a field:
 * a resource genuinely called Milestones is a resource, and comparing against the constant
 * would take a legitimate roster entry off the ladder.
 *
 * Takes the model as optional so a caller with no roadmap drawn at all gets an empty list
 * rather than a null check of its own.
 *
 * Narrows to `AssignableLane` by asking `file !== null` alone, never `!lane.markers` beside
 * it: every lane but the milestones' carries a `file` by construction (`deriveLanes` builds
 * one lane per resource note, and only `markerLane` ever sets `file: null`), so the two
 * conditions are one fact asked twice. A compound `!lane.markers && lane.file !== null`
 * stood here until the coverage floor caught it: with the invariant holding, the second
 * half is never false, which means a lint-clean `&&` and a permanently dead branch is
 * exactly what a covered `!lane.markers` check beside it produces. Still never `lane.name`
 * — the rule this filter has always kept — because a resource genuinely called Milestones
 * is a resource, and comparing against the constant would take a legitimate roster entry
 * off the ladder.
 */
export function assignableLanes(roadmap: RoadmapModel | undefined): AssignableLane[] {
	return (roadmap?.lanes ?? []).filter((lane): lane is AssignableLane => lane.file !== null);
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

/**
 * A resource named in the casing the row on screen carries, or the note's own title where
 * no row draws it, or the raw text for a value that resolves to nothing. Three fallbacks
 * and not two, because a link is a third value shape: unresolved is a fact the reader can
 * see on the note, and reporting it as the shelf would say "from Unplaced" about a note
 * that plainly says Sarah.
 */
function resourceLabel(roadmap: RoadmapModel, entry: LinkEntry): string {
	const lane = entry.file ? roadmap.lanes.find((l) => l.file?.path === entry.file?.path) : undefined;
	return lane?.name ?? entry.file?.basename ?? entry.raw;
}

/** Where a pick sends a card. Nobody named is the shelf, under the name the frame gives it. */
export function resourceTargetLabel(roadmap: RoadmapModel, target: TFile | null): string {
	if (target === null) return shelfLabel();
	return roadmap.lanes.find((l) => l.file?.path === target.path)?.name ?? target.basename;
}

/** What a note's assignee key said, and whether it was there at all. */
export interface ResourceSource {
	entry: LinkEntry | null;
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
	return { entry: item.assigneeEntry, keyPresent: item.ownKeys.assignee };
}

/**
 * What a card's assignee WAS. Two ways to say nobody, and only one of them is nothing to
 * take away.
 */
export function resourcePlacementLabel(roadmap: RoadmapModel, source: ResourceSource): string {
	if (source.entry !== null) return resourceLabel(roadmap, source.entry);
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
 *
 * A `RELEASE` is dropped here rather than at any one axis, because this is the single
 * funnel all three take: `buildRoadmap` calls this once and then branches to buckets,
 * lanes or bars, so the guard at `placeItem` — which the bucket axis never consults —
 * left a release sitting in a horizon BUCKET, or on the counted, drop-targetable shelf
 * when it held no horizon. This is also what keeps `placedCount` honest: a release is not
 * an unplaced result, it is not a result of this projection at all. Nothing is orphaned by
 * the drop — this list is flat, and a marker holds no children to strand. An
 * `outsideFilter` release goes with it, which `Releases as their own type` 4a asks for by
 * name — though nothing on the roadmap depends on that any more: `inPlan` refuses an
 * excluded release in every projection now, so one never reaches this list at all.
 * [[A release on the dated axis]] is where a release gets a position of its own.
 *
 * **The two branches are not the same shape, and the filter cannot be read as one rule
 * over both.** `model.results` is a flat walk, so dropping a row drops a row;
 * `model.roots` is a FOREST, so dropping one takes its whole subtree off the screen with
 * it — a `PBI` somebody hand-nested under a release was drawn nowhere while
 * `eligibleResults` went on counting it, and the roadmap said all the work was done and
 * hidden. What closes that is upstream and not here: `honouredFocusLevel`
 * (`view/projection.ts`) refuses a focus this roadmap could not draw BEFORE the model is
 * built, so a release is never a focus root of a model the roadmap is looking at. The
 * guarantee is the view's — a model built here with a `Release` focus still loses the
 * subtree, and the check under this sentence is `test/view/releaseRows.test.ts`, which
 * drives the real view rather than this function.
 */
function roadmapRows(model: BacklogModel, visible: (item: BacklogItem) => boolean, axis: RoadmapAxis): BacklogItem[] {
	const source = (model.focused ? model.roots : model.results).filter(visible);
	const rows = source.filter(onThisRoadmap);
	return drawsGrid(axis) ? [...rows, ...model.iterations.filter(visible)] : rows;
}

/**
 * Whether any axis of this roadmap places this row at all — **the one statement of the
 * roadmap's population**, and everything that answers "is this on the roadmap" asks it
 * rather than restating it.
 *
 * It was extracted after the second reader was reported and reached only two; four more
 * findings arrived afterwards, every one of them a reader that had never been told the
 * population changed — an inflated toolbar count beside an advisory saying the roadmap
 * was empty, a focus root dropped with its whole subtree, and an empty state offering to
 * create the very type the frame refuses. So the readers are named here, once, and there
 * are four: `roadmapRows` and `RoadmapModel.eligibleResults` in this file,
 * `projectionMember` (`view/projection.ts`) — through which the rows, the shelf, the
 * keyboard and every drop target inherit it — and `countedPopulation`
 * (`view/render/toolbarStatus.ts`).
 *
 * It was five until 2026-08-24. `honouredFocusLevel` (beside `projectionMember`) asked this
 * while the roadmap was the only projection that refused a release; `inPlan` refuses one
 * everywhere now, so that guard asks the TYPE directly and holds for the tree as well.
 * Nothing checks a caller list, so this one goes stale silently — count them before
 * trusting the number.
 *
 * A TYPE NAME is all it reads, which is what lets the focus ask it with no row in hand.
 * The backfill is deliberately NOT a sixth reader: `missingKeyStubs` (`domain/writePlan.ts`)
 * asks whether a TYPE may hold a planning key, which is `placementEnds`-shaped and has a
 * note of its own — `docs/issues/Creation seeds a placement the type may not hold.md`.
 * Two rules, and collapsing them would put a question about a note's keys behind a
 * question about a screen.
 */
export function onThisRoadmap(item: { typeName: string | null }): boolean {
	return !isReleaseType(item.typeName);
}

/** Project the model onto the given axis. */
export function buildRoadmap(
	model: BacklogModel,
	settings: BacklogSettings,
	visible: (item: BacklogItem) => boolean,
	axis: RoadmapAxis,
): RoadmapModel {
	const rows = roadmapRows(model, visible, axis);
	const roadmap: RoadmapModel = {
		axis,
		buckets: [],
		bars: [],
		lanes: [],
		shelf: [],
		context: [],
		placedCount: 0,
		eligibleResults: model.results.filter(onThisRoadmap).length,
	};
	if (axis === 'horizons') deriveBuckets(rows, settings, roadmap, visible);
	else if (axis === 'resources') deriveLanes(rows, settings, roadmap, model);
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
		roadmap.shelf.push({ item, reason: t('placement.reasonUnreadableHorizon') });
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
 * The resources axis. Two passes for `deriveBuckets`' own reason — a context row joins a
 * row that already exists — but nothing here MINTS one any more: every row is a note, so
 * the row LIST is built once, up front, from `resources` itself, and both passes only ever
 * place into a row that is already there or fail to place at all.
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
 * The row is minted by its first placed marker, since the roster proper is never empty on
 * its account: a base with no milestone in it draws no `Milestones` header at all.
 */

/**
 * A resource's own label, read off the model's index rather than recomputed — the "every
 * surface names a resource through `namedTargets`" rule applied to this row's own header.
 * An absence's own match is by PATH now (Task 6) and never reaches this at all. Asserted
 * rather than guarded with a fallback:
 * `resourceLabels` is built from this SAME `resources` array one call up, in `buildModel`
 * (`model.ts`), so every entry's path is a key in it by construction for any model this
 * function is actually handed. A `?? resource.title` stood here until the coverage floor
 * caught it — no vault can produce the model needed to take that branch, only a test that
 * cast the map back to mutable and deleted a key from it, which is a fact about the TEST
 * rather than about a real gap in the function.
 */
function labelOf(resource: ResourceNote, labels: ReadonlyMap<string, string>): string {
	return labels.get(resource.file.path) as string;
}

function deriveLanes(rows: BacklogItem[], settings: BacklogSettings, roadmap: RoadmapModel, model: BacklogModel): void {
	const { absences, resources, resourceLabels } = model;
	const markers = markerLane([]);
	// One row per resource note, in the model's own order — every one, whether or not
	// anything names them, which is what the removed `resourceNames` option existed for.
	// Named through the model's own label index rather than a second `namedTargets` call
	// here: that map is built ONCE per model (`BacklogModel.resourceLabels`), and every
	// surface that names a resource to the reader reads it rather than disambiguating
	// again on its own — the row header is one such surface, and re-deriving its label
	// here is exactly the per-row scan that rule exists to keep out of a render path.
	const lanes = resources.map(
		(resource): ResourceLane => ({
			file: resource.file,
			name: labelOf(resource, resourceLabels),
			markers: false,
			bars: [],
			absences: [],
			context: [],
		}),
	);
	// By PATH, never by a folded name: a link resolves or it does not, and there is no
	// middle answer for a case-insensitive comparison to keep. Built from `resources`
	// rather than from `lanes` (same length, same order), so the key comes from a `TFile`
	// the type already guarantees instead of a non-null assertion on the lane's own.
	const byPath = new Map<string, ResourceLane>(resources.map((resource, i) => [resource.file.path, lanes[i]]));
	for (const item of rows) {
		if (item.outsideFilter) continue;
		if (isMarkerType(item.typeName)) placeBar(item, () => markers, roadmap, settings);
		else placeAssigned(item, byPath, roadmap, settings);
	}
	// An absence names its resource by a LINK now (Task 6), read exactly as an item's own
	// assignee is, so this is `placeAssigned`'s own one-answer-three-cases rule read again:
	// nobody named, a link that resolves to nothing, and a link that resolves to a note
	// this base does not carry as a `Resource` row all draw nowhere, alike, on a single
	// `byPath.get` miss rather than three tests. Reusing `byPath` — the SAME map
	// `placeAssigned` looks up into two lines up, not a second index or a `resources.find`
	// scan — is what keeps this loop O(1) per absence rather than O(absences × resources):
	// a real roster and a year of absence history pay that cost on every model rebuild,
	// which is every write and every full render. It can no longer MINT a row either: a row
	// is a note, and an absence is a statement about a resource rather than a declaration
	// of one, so one naming nobody on the roster draws nowhere.
	for (const absence of absences) {
		const lane = absence.resource.file ? byPath.get(absence.resource.file.path) : undefined;
		lane?.absences.push(absence);
	}
	for (const item of rows) {
		if (item.outsideFilter) placeContextLane(item, byPath, roadmap);
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
 *
 * Resolved through the item's own LINK (`assigneeEntry.file`), never through the raw name
 * a `.find`/`sameValue` scan would have to guess between two notes sharing one — the
 * defect that shape carried until this function stopped minting rows to look one up in.
 * One answer for three cases, and deliberately: nobody named, a link that resolves to
 * nothing, and a link that resolves to a note this base holds but which is not a
 * `Resource` (so it is not in `byPath` at all). A link is not a declaration and the type
 * is, so all three shelve — visible, counted, and one drop away from being placed.
 */
function placeAssigned(
	item: BacklogItem,
	byPath: Map<string, ResourceLane>,
	roadmap: RoadmapModel,
	settings: BacklogSettings,
): void {
	const lane = item.assigneeEntry?.file ? byPath.get(item.assigneeEntry.file.path) : undefined;
	if (!lane) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	placeBar(item, () => lane, roadmap, settings);
}

/**
 * One result on the grid, or on the shelf with its reason. The row is a THUNK for
 * `placeAssigned`'s own shape — a shelved result must not push a bar into a row it never
 * reached — even though every row now exists up front and nothing here mints on demand.
 */
function placeBar(item: BacklogItem, lane: () => ResourceLane, roadmap: RoadmapModel, settings: BacklogSettings): void {
	const placement = placeItem(item, statedEnds(item), settings.iterationBars);
	// Not on this axis at all — no row minted, nothing shelved. `deriveBars`' own skip,
	// reached by the path that never calls it.
	if (placement === null) return;
	if (placement.kind === 'shelf') {
		roadmap.shelf.push({ item, reason: placement.reason });
		return;
	}
	lane().bars.push(placement.bar);
}

/**
 * A context row joins a row that already exists, or the axis's undifferentiated context. A
 * marker joins the second whatever it names: "a milestone is in no resource's row" is a
 * rule about the row and not about the bar, so an excluded one must not reach a band by the
 * one path that positions nothing. Resolved through the LINK, `placeAssigned`'s own rule:
 * a context row is never a source of vocabulary, so it must not join a row by a name match
 * a result would refuse.
 */
function placeContextLane(item: BacklogItem, byPath: Map<string, ResourceLane>, roadmap: RoadmapModel): void {
	if (isMarkerType(item.typeName)) {
		roadmap.context.push(item);
		return;
	}
	const lane = item.assigneeEntry?.file ? byPath.get(item.assigneeEntry.file.path) : undefined;
	if (lane) lane.context.push(item);
	else roadmap.context.push(item);
}

