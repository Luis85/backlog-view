import { BacklogItem } from '../domain/model';
import { RoadmapAxis } from '../domain/roadmap';
import { BacklogSettings } from '../domain/settings';
import { Projection } from './host';
import { hidesCompleted, projectionMember } from './projection';

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
		// `iterationBoardCards` and `testCatalog`, which is the Deliverables rule the header
		// states, held from three directions.
		//
		// `stateKey !== ''` has none, and cannot: `readItems` already reads `stateValue` as
		// null without a configured key, so `done` and `subtreeDone` are false throughout
		// and this term can change no answer. It is kept as the statement of what
		// `hideCompleted` MEANS — the toggle actively hiding, not merely switched on — and
		// measured rather than assumed: removing it leaves all 2904 tests green.
		hideCompleted: hidesCompleted(projection) && !settings.showCompleted && settings.stateKey !== '',
		// `iterationsOnTimeline` is taken away HERE rather than inside `projectionMember`,
		// which has no settings in hand — and an axis this reader has turned iterations off
		// for admits exactly what a non-grid axis admits, which is what a null axis already
		// means to that predicate. One place, because everything downstream reads this same
		// predicate: `roadmapRows` appends `model.iterations` through it, so an iteration
		// the option refuses reaches neither a bar, nor a line, nor the shelf that counts
		// what could not be placed.
		inProjection: projectionMember(projection, member.scope, settings.iterationsOnTimeline ? member.axis : null),
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
	if (item.outsideFilter) return !item.children.some((child) => !rowHidden(child, rule));
	return false;
}
