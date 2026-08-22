import { BacklogItem } from '../domain/model';
import { RoadmapAxis } from '../domain/roadmap';
import { BacklogSettings } from '../domain/settings';
import { Projection } from './host';
import { drawsForest, hidesCompleted, projectionMember } from './projection';

/**
 * Row visibility: whether this projection draws the item at all, and whether the
 * completed-items toggle is hiding it. One predicate answers for the screen and for
 * every population a count is measured against, so the two cannot disagree about what
 * "in this column" means. See [[Rollups and hiding finished work]].
 *
 * It used to take a third question — the quick filter, liftable — and a `scope` to ask it
 * in. Both went with the filter itself (2026-08-17): Bases has its own search, so the
 * plugin no longer runs one, and with nothing to lift there is one population rather than
 * two. `BacklogViewHost.isRowHidden` is now the only reading, where `isRowHiddenUnfiltered`
 * stood beside it.
 *
 * `hideCompleted` is the other answer that lives HERE rather than at the call sites: the
 * Deliverables board has no completion concept of its own (Scope), so the toggle — which
 * describes the REQUIREMENTS rollup, `item.subtreeDone` — must not reach it. It was a
 * per-caller choice for three surfaces and the fourth forgot, emptying a Deliverable card's
 * child disclosure from a setting flipped on another projection and offering no toggle to
 * put it back. Inside the recursion too, so a context row is judged by the same rule as the
 * results it is placing.
 */
export interface VisibilityRule {
	/**
	 * True only while the toggle is ACTIVELY hiding: the projection has a completion
	 * concept to hide by AND this reader has finished work turned off AND there is a state
	 * property to have finished anything in. One boolean rather than a flag beside the
	 * settings it had to be read against, which is the shape the header argues away from —
	 * `hideCompleted: true` could sit beside settings that hide nothing, and every reader
	 * had to remember to ask both.
	 */
	hideCompleted: boolean;
	/**
	 * Whether this projection draws the item at all — `projectionMember`, which asks the
	 * one catalog-membership rule. It is FIRST below and unconditional: no toggle makes a
	 * `Test case` a row of the plan.
	 *
	 * This is where the exclusion lives for the same reason the completed toggle's does —
	 * one predicate, so the screen and the population its counts are measured against
	 * cannot disagree. Everything downstream inherits it: the tree's rows, the board's
	 * cards, the roadmap's rows and shelf, the keyboard's move targets, and every count
	 * taken over the same walk.
	 */
	inProjection: (item: BacklogItem) => boolean;
	/**
	 * Whether a `focusRoot` stamp on a row this projection draws is this projection's OWN
	 * re-rooting — `drawsForest`, which is where the two that answer false are named. Read
	 * only by `drawnDescent` below, and carried on the rule for the reason every other term
	 * here is: one assembly point, so no caller can ask membership against one projection
	 * and the promotion against another.
	 */
	drawsForest: boolean;
}

/**
 * The rule assembled for one projection. Here rather than in the view for the reason the
 * rule itself is here: the projection-derived answers are read from `projection.ts` in one
 * place, so a caller cannot assemble a rule that asks one of them a different way.
 *
 * `member` bundles `projectionMember`'s own two narrowings — the iteration board's scope
 * and the roadmap's axis — into one parameter rather than two positional ones. It was
 * introduced (main, 2026-08-17) while a third argument still lifted the quick filter, which
 * is what made the bundling a lint-budget necessity; the filter is gone and the budget is no
 * longer tight, but one parameter naming the two narrowings still reads better than two
 * positional ones that are only ever passed together. It is required: the one caller has
 * both in hand, and a default standing for "ask the plan's answer" is a second way to
 * spell what `projectionMember`'s own defaults already mean.
 */
export function visibilityRule(
	settings: BacklogSettings,
	projection: Projection,
	member: { scope: string | null; axis: RoadmapAxis | null },
): VisibilityRule {
	return {
		// Resolved HERE, not carried as settings for `rowHidden` to re-read: the toggle's
		// settings terms are as fixed at build time as the projection's own answer, and one
		// boolean cannot disagree with itself the way a flag and the settings beside it
		// could. `hidesCompleted(projection)` is the term with a check under it — dropping
		// it fails five tests across `deliverablesBoard`, `deliverablesToolbar`,
		// `iterationBoardCards` and `testCatalog`, which is the THREE projections that opt
		// out of the toggle, held from four directions. Not one rule wearing three names:
		// the Deliverables board and the catalog opt out because completion there is another
		// workflow's question, the iteration board because its Resolved column IS what the
		// sprint finished — a reason of its own rather than theirs, as `hidesCompleted`'s own
		// body says.
		//
		// `stateKey !== ''` has none, and cannot: `readItems` already reads `stateValue` as
		// null without a configured key, so `done` and `subtreeDone` are false throughout
		// and this term can change no answer. It is kept as the statement of what
		// `hideCompleted` MEANS — the toggle actively hiding, not merely switched on — and
		// measured rather than assumed: removing it leaves the whole suite green. No count
		// is quoted, because a total here goes stale on the next unrelated test anywhere in
		// the repository and the load-bearing claim is only that nothing fails.
		//
		// **What would make it load-bearing**: a source of `item.done` that does not go
		// through a configured state key. The term stops being redundant the moment one
		// exists and silently becomes the guard — and no test will say so either way, which
		// is the reason to keep it rather than the reason it is here.
		hideCompleted: hidesCompleted(projection) && !settings.showCompleted && settings.stateKey !== '',
		// `iterationsOnTimeline` is taken away HERE rather than inside `projectionMember`,
		// which has no settings in hand — and an axis this reader has turned iterations off
		// for admits exactly what a non-grid axis admits, which is what a null axis already
		// means to that predicate. One place, because everything downstream reads this same
		// predicate: `roadmapRows` appends `model.iterations` through it, so an iteration
		// the option refuses reaches neither a bar, nor a line, nor the shelf that counts
		// what could not be placed.
		inProjection: projectionMember(projection, member.scope, settings.iterationsOnTimeline ? member.axis : null),
		drawsForest: drawsForest(projection),
	};
}

export function rowHidden(item: BacklogItem, rule: VisibilityRule): boolean {
	// A row this projection does not draw is not hidden BY anything — it is not on this
	// screen at all.
	if (!rule.inProjection(item)) return true;
	if (rule.hideCompleted && item.subtreeDone) return true;
	// A context row is here only to place a result. Once nothing below it is
	// visible it is an empty scaffold, so it goes with them — whatever hid them.
	// One visible child is enough: a context child is itself subject to this rule.
	//
	// Asked of the DRAWN DESCENT and never of `item.children`, which is the same
	// distinction `drawnChildren` was written for one function down: a row this
	// projection does not draw hides nothing — the results BELOW it are what this
	// scaffold is still placing. Reading the raw children instead, a context `Epic`
	// over a `Release` the roadmap draws no axis for saw no visible child, called
	// itself empty, and took an eligible `PBI` off a focused roadmap with it — while
	// `eligibleResults` went on counting that `PBI` and the advisory said all the work
	// was done and hidden.
	//
	// **What it COSTS is unmeasured, and cannot be measured with what is here.** This
	// replaced an allocation-free `.some` over `item.children`, and it is neither: the
	// descent materialises the whole drawn list before `.some` gets to short-circuit over
	// it, allocating one array per undrawn level. `isRowHidden` is asked per row per render,
	// per count and per drop target, which is the scaling limit `src/view/CLAUDE.md` names —
	// but only an `outsideFilter` row reaches this line at all, and the harness fixture
	// (`test/helpers/fixtures.ts`) carries none, so `npm run perf` would time a branch
	// nothing enters. The number is owed to a fixture with context rows in it, not to a run
	// of the tool as it stands. Nothing is optimised on the strength of the shape alone.
	if (item.outsideFilter) {
		return !drawnDescent(item, (row) => !rule.inProjection(row), rule.drawsForest).some(
			(child) => !rowHidden(child, rule),
		);
	}
	return false;
}

/**
 * The rows a projection DRAWS beneath an item — one level of `item.children` only where
 * this projection draws every link in it.
 *
 * **A row this projection does not draw is traversed THROUGH, never dropped**, and that
 * is the whole of the descent: a `Release` hand-hung between a `Feature` and its `PBI`s
 * is drawn by no axis of the roadmap (`onThisRoadmap`), so on a focused roadmap the PBIs
 * below it were on no card at all — while their dates went on reaching the Feature's own
 * bar, which walks the MODEL. A bar drawn from work the card said was not there. The
 * descent terminates because `children` is acyclic — `buildModel` runs `breakCycles`
 * before `assignAll`, and it is the only producer of a model.
 *
 * `undrawn` is MEMBERSHIP alone, never the whole of `rowHidden`, and the difference is
 * the trap: `rowHidden` is true for three different reasons and a caller holding the
 * boolean cannot tell them apart. Descending through a child the COMPLETED TOGGLE hid
 * would put a done subtree back on every card face, the board's included.
 *
 * **It stops where THIS projection has already re-rooted the subtree.** A promoted root
 * carries `focusRoot` — *a root of the rendered forest that is not a root of the model* —
 * so it is drawn in its own right at the top of the forest and is nobody's listed child.
 * That is what keeps the requirements board still: its membership IS the forest's
 * (`inPlan`), so every row it refuses promotes what is under it, and this walk finds
 * nothing to carry up. The rows that strand are the ones only a projection's own narrowing
 * refuses — the roadmap's release, and the iteration board's out-of-sprint link — which the
 * forest drew and nothing promoted.
 *
 * `drawsForest` is what makes the stamp readable at all, and reading it alone was the
 * defect: `focusRoot` is set once per model build by `collectFocusRoots` and
 * `projectionForest` together, so a projection drawing a population of its own meets it on
 * rows nothing here promoted. On the iteration board that took an in-sprint `PBI` off its
 * carrier's face while it went on drawing its own board card — a card's list disagreeing
 * with the board it is drawn on. Which projections answer which way, and why, is in
 * `drawsForest` (`projection.ts`); nothing about it is decided here.
 *
 * Here rather than in `childrenList.ts`, where it was written, because `rowHidden` above
 * needs the same descent for the same reason and a scaffold judged by a second reading of
 * "what is below this" is exactly the disagreement this file exists to prevent. Two
 * callers, one membership predicate each: the host's `isRowUndrawn` for a card's face,
 * this rule's own `inProjection` for the row.
 */
export function drawnDescent(
	item: BacklogItem,
	undrawn: (row: BacklogItem) => boolean,
	drawsForest: boolean,
): BacklogItem[] {
	return item.children.flatMap((child) =>
		undrawn(child) ? drawnDescent(child, undrawn, drawsForest)
		: drawsForest && child.focusRoot ? []
		: [child],
	);
}
