import { OptionalField } from './optionalProperties';
import { BacklogSettings } from './settings';
import {
	ABSENCE_TYPE,
	ALL_TYPES,
	byName,
	DELIVERABLE_TYPE,
	EXTRA_TYPES,
	ITERATION_TYPE,
	LEVELS,
	MARKER_TYPES,
	RELEASE_TYPE,
	TEST_LEVELS,
} from './typeVocabulary';

/**
 * The type vocabulary: the level ladders, and the types that sit beside them.
 *
 * **There are TWO ladders** — `LEVELS` (Epic → Feature → PBI → Task) is the plan's and
 * `TEST_LEVELS` (Test suite → Test case → Task) is the test catalog's — so every rule
 * that reads a rung asks {@link ladderFor} which ladder first. They share their deepest
 * rung and touch nowhere else: no drop, indent or retype moves an item between them,
 * because the cascade only ever assigns the child of the rung an item landed under and a
 * name that belongs to one ladder alone decides its own.
 *
 * Every level rule is still "one rung below the parent". **Extra types are the exception
 * that a ladder cannot express**: a Bug holds Tasks whether it hangs from an Epic, a
 * Feature or a PBI, so its rung is a property of the type rather than of where it sits.
 * Two consequences follow, and both are why this is a type rather than a fifth level:
 *
 * - it ranks at `EXTRA_TYPE_RANK` no matter its parent, so its children always imply the
 *   deepest level;
 * - it has no `levelIndex`, so nothing re-types it by position — dropping a Bug under an
 *   Epic leaves a Bug.
 *
 * A leaf module by design: it knows the settings and nothing about the tree, so
 * `model.ts` can import it while it builds one.
 *
 * A **marker** is the third category and the inverse of all three: no rung, no children,
 * no parent. It has no `levelIndex` either, so `computeLevel` treats it exactly as it
 * treats an unrecognised name — the difference is that it is *declared*, which is what
 * earns it a folder, a badge, admission to `hierarchyOnly` and acceptance as a focus.
 */

/** Where an item sits on the ladder — all these functions need of a parent. */
export interface LadderPosition {
	/** Index into {@link LadderPosition.ladder}; -1 for an extra type, a marker, or a type off it. */
	levelIndex: number;
	/** The rung the item occupies, chained down the parent levels. */
	effectiveLevelIndex: number;
	/**
	 * WHICH ladder those two index — `LEVELS` or `TEST_LEVELS`. There are two now, and
	 * every rule that used to read `LEVELS` as *the* ladder has to ask this first.
	 * Assigned by `computeLevel` in the same pre-order walk that resolves the parent's
	 * rung before the child's, so a chained answer is always available by the time it
	 * is needed.
	 */
	ladder: string[];
	/**
	 * The name on the note. A marker has no rung and therefore no position that could
	 * distinguish it, so the only thing that tells one from the ordinary item sitting at
	 * the same effective level is what it calls itself.
	 */
	typeName: string | null;
}

/**
 * Which ladder a note is on, given what it calls itself and what its parent is on.
 *
 * A name that names a rung of exactly ONE ladder decides by itself: that is what keeps a
 * `Test suite` dragged under an `Epic` a catalog item and a `Bug` under a `Test case` a
 * plan one — neither ladder is entered or left by position, which is the whole of "the
 * two ladders never merge".
 *
 * Exactly two cases chain from the parent instead, and they are the same case: the name
 * says nothing that distinguishes the ladders. `Task` is a rung of BOTH, and a note with
 * no `type` at all names no rung — so each takes the ladder it hangs from, and the plan's
 * when it hangs from nothing.
 *
 * Everything else is the plan's, INCLUDING a name neither ladder holds. That last clause
 * is load-bearing and the easy one to lose by writing this as "fall through to the
 * parent": an extra type, a marker or an unknown custom type beneath a `Test case` would
 * then be swept into the catalog, where the register says it is plan work in the wrong
 * place and must stay visible in the plan. `Task` is the one type that means nothing on
 * its own, and it is the only one that may be answered by what it hangs from.
 */
export function ladderFor(typeName: string | null, parentLadder: string[] | null): string[] {
	if (typeName === null) return parentLadder ?? LEVELS;
	const name = typeName.toLowerCase();
	const onTest = TEST_LEVELS.some((t) => t.toLowerCase() === name);
	const onPlan = LEVELS.some((t) => t.toLowerCase() === name);
	if (onTest && onPlan) return parentLadder ?? LEVELS;
	return onTest ? TEST_LEVELS : LEVELS;
}

/**
 * Whether this item belongs to the TEST CATALOG rather than to the plan — the one
 * membership predicate, read from both directions so the two projections cannot both
 * claim an item or both disown one.
 *
 * It asks the ladder, which means it asks the EFFECTIVE type: a child of a `Test suite`
 * with no `type` at all chains onto the test ladder and is a catalog member, where a
 * predicate reading the raw field would put a note that draws as a test case into the
 * plan and leave it out of the catalog until the backfill happened to run. It also means
 * `Task` is answered by what it hangs from and every other type by its own name, which is
 * the membership rule stated in full — not an exception carved out for one type, but what
 * a chained ladder already does.
 */
export function inCatalog(item: { ladder: string[] }): boolean {
	return item.ladder === TEST_LEVELS;
}

/**
 * Whether placing `item` under `parent` leaves it on the ladder it is already on — so
 * whether the projection drawing it now would still draw it after the move. `null` is
 * the top level, which is a prospective parent like any other.
 *
 * **Every move that changes a row's parent asks this, and none of them decides it for
 * itself.** `ladderFor` chains from the parent for exactly two inputs — a `Task` and a
 * note with no `type` — so a reparent can re-answer membership for those two and for
 * nothing else: a row that vanishes from the screen it was acted on. Extension 1c of
 * `docs/requirements/Test suite and test case as a ladder of their own.md` decided that
 * for the top-level CREATOR — a `Task` is offered under a test and withheld at the top,
 * "the same type, answered differently by whether a parent is in hand". The rule was then
 * found missing at the top-level DROP, and an automated reviewer found it missing at
 * OUTDENT while that first patch was still the newest commit; a sibling drop beside a
 * real root and the parent-link actions turned out to reach it as well. Three gates ask
 * it today — `dropTargetFor`, `outdentTarget` and the menu's parent-link section — and
 * enumerating them is what found the last two, which is why this is a function every
 * reparenting target asks rather than a check each one restates. It was four until the
 * drop on the tree background was deleted (2026-08-11); a gate leaving the set costs the
 * rule nothing, which is the point of stating it here rather than at each call. The
 * creator is a further surface of the same rule and answers it in `offerableTypes`, since
 * it has no row on screen to keep there.
 *
 * Asked of the LADDER and never of a type NAME: every other type answers from its own
 * name and is unaffected, so this narrows exactly the rows a move would move between
 * projections. A guard spelled `typeName === 'Task'` passes every `Task` fixture and
 * misses the typeless note entirely.
 *
 * It does NOT cover a move that changes the row's TYPE rather than its parent — `Set
 * type` asks the same question with the other variable moving, and answers it in
 * `retypeChoices` (extension 1d).
 */
export function keepsProjection(
	item: { typeName: string | null; ladder: string[] },
	parent: { ladder: string[] } | null,
): boolean {
	return ladderFor(item.typeName, parent?.ladder ?? null) === item.ladder;
}

/**
 * Level index a child of `parent` should get: one below the parent's effective
 * level, clamped to the deepest level of the ladder the CHILD will be on. Top-level
 * items get level 0.
 *
 * The child's ladder, not the parent's, because they can differ: a `Test suite` created
 * under nothing is rung 0 of the test ladder, and clamping it against the plan's four
 * rungs would be arithmetic about a ladder it is not on.
 */
export function childLevelIndex(parent: LadderPosition | null, ladder: string[] = parent?.ladder ?? LEVELS): number {
	if (!parent) return 0;
	return nextLevelIndex(parent.effectiveLevelIndex, ladder);
}

/**
 * One rung below `levelIndex`, clamped at the deepest rung of `ladder` — the
 * single statement of "what a child's level is", which `childLevelIndex` is this
 * applied to an item. It takes a LEVEL rather than an item so the rule stays
 * arithmetic about the ladder rather than something re-derived from tree depth.
 */
function nextLevelIndex(levelIndex: number, ladder: string[] = LEVELS): number {
	return Math.min(levelIndex + 1, ladder.length - 1);
}

/**
 * The rung every extra type occupies: the one whose children are the deepest level.
 * Fixed rather than inherited — that pinning is the whole point of the concept, and it
 * is what makes "a Bug's children are Tasks" true under an Epic as well as under a PBI.
 */
export const EXTRA_TYPE_RANK = Math.max(LEVELS.length - 2, 0);

/** True when `typeName` is one of the configured extra types (case-insensitive). */
export function isExtraType(typeName: string | null): boolean {
	if (typeName === null) return false;
	const name = typeName.toLowerCase();
	return EXTRA_TYPES.some((t) => t.toLowerCase() === name);
}

/**
 * True when `typeName` is a declared MARKER (case-insensitive): a name that occupies no
 * rung, holds nothing and hangs from nothing. Deliberately a second predicate rather than
 * a widened `isExtraType` — the two answer opposite questions about rank, children and
 * parents, and the four sites that ask `isExtraType` mean the pinned-rank container.
 */
export function isMarkerType(typeName: string | null): boolean {
	if (typeName === null) return false;
	const name = typeName.toLowerCase();
	return MARKER_TYPES.some((t) => t.toLowerCase() === name);
}

/**
 * One marker BY NAME. Asked only where a rule is about ITERATIONS specifically — the
 * menu picking out which notes an item may be put in. Every STRUCTURAL question is
 * {@link isMarkerType}, which both markers answer alike, and the difference is
 * destructive rather than tidy: a rule about *not work* written as this predicate offers
 * `Set iteration` on a `Milestone`, whose own target date a pick would then overwrite.
 */
export function isIterationType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === ITERATION_TYPE.toLowerCase();
}

/**
 * One marker BY NAME, the shape `isIterationType` already has. Asked where a rule is
 * about RELEASES specifically — which notes the release view lists — rather than the
 * structural question `isMarkerType` answers for all three alike.
 */
export function isReleaseType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === RELEASE_TYPE.toLowerCase();
}

/**
 * True when this type is DRAWN at one date rather than across two, and holdable at
 * neither end. A milestone is a point because a milestone IS a point; an iteration has
 * two ends and the reader decides which reading they want (`iterationBars`). Its own
 * predicate rather than a widened `isMarkerType`, for the reason recorded at
 * `isExtraType`: widening a predicate makes it mean two things at every call site.
 * `isMarkerType` keeps the structural question — no rung, no children, no prerequisites.
 */
export function drawsAsPoint(typeName: string | null, iterationBars: boolean): boolean {
	if (!isMarkerType(typeName)) return false;
	// A `Release` is a marker STRUCTURALLY — no rung, no children, no prerequisites — and
	// draws no point on this roadmap. [[A release on the dated axis]] is where a release
	// gets a position, from the ROADMAP's own release-date key; until then the backlog's
	// target key is the wrong mapping to read and a far worse one to write, since
	// `bars.ts`'s holdable body would let a timeline drag edit a release through it.
	if (isReleaseType(typeName)) return false;
	return isIterationType(typeName) ? !iterationBars : true;
}

/**
 * A note this backlog recognizes in order to refuse it — see `ABSENCE_TYPE`. Its own
 * predicate rather than a widened `isMarkerType`, for that predicate's own reason: the
 * two answer opposite questions, and the one call site here decides whether a note
 * becomes an item at all rather than where it ranks once it is one.
 */
export function isAbsenceType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === ABSENCE_TYPE.toLowerCase();
}

/**
 * True when `typeName` is the Deliverable workflow's own type (case-insensitive). One
 * statement of the match that used to be a bare string literal at five call sites — the
 * board's population, the toolbar's count and the backfill among them — so a rename of
 * the type can no longer make any of them disagree with `EXTRA_TYPES`.
 */
export function isDeliverableType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === DELIVERABLE_TYPE.toLowerCase();
}

/**
 * The types that may be created under `parent`, the ladder's own child first.
 *
 * Extra types are offered under a real rung above the deepest one — under an Epic, a
 * Feature or a PBI, but not under a Task, which has nothing below it, and not under
 * another extra type, whose only children are the deepest level. An item with an
 * implied type counts as its implied rung, since that is the level it reads as.
 *
 * Nothing here is enforced against a drag: the ladder has always guided what the view
 * offers and writes without refusing a move the user makes deliberately, and extra types
 * follow the same rule. This decides what the + button and the menu put in front of you.
 */
export function childTypeChoices(parent: LadderPosition | null): string[] {
	// A marker holds nothing — no rung below it and no extra type beside it. The empty
	// list is the answer, and every affordance built from it has to be ABSENT rather than
	// empty (the add button, `New <child>`); see `renderRowTrailing`.
	if (parent !== null && isMarkerType(parent.typeName)) return [];
	// The top level is the WHOLE vocabulary, because that is what the toolbar does:
	// `renderToolbar` iterates `ALL_TYPES` unconditionally and writes a note with no
	// `parent` for whichever is picked. This branch used to answer `Epic` and the markers
	// — an opinion ("a Bug hangs from something") that nothing enforced and nothing acted
	// on, since no `+` button exists without a row. Its one reader is the generated
	// README's root marker (`parentsOf`), which was therefore publishing, into the user's
	// own vault, that an Issue must hang from a rung while the toolbar was making
	// parentless ones. A branch describing a creation path that does not exist is worth
	// less than one describing the path that does. It is also already right for a
	// `Test suite`, which is a root by nature; WHICH of those types a given projection
	// may offer is `offerableTypes`' question, not this one's.
	if (!parent) return ALL_TYPES;
	const ladder = parent.ladder;
	const ladderChild = ladder[childLevelIndex(parent, ladder)];
	const onLadder = parent.levelIndex >= 0 && parent.levelIndex < ladder.length - 1;
	// The extra types belong to the plan's ladder and to nothing else: they are declared
	// as things that hang from an Epic, a Feature or a PBI (`EXTRA_TYPE_RANK` is an index
	// into `LEVELS`), so a rung of the test ladder offers its own child alone. Without
	// this an implementation that merely "adds a rung" offers `New Bug` inside a test
	// suite for free — the direction the acceptance criteria call out as the one such an
	// implementation gets wrong without noticing.
	if (inCatalog(parent)) return [ladderChild];
	return onLadder ? [ladderChild, ...EXTRA_TYPES] : [ladderChild];
}



/**
 * Where a new item of this type is filed, or null when the type has no folder of its
 * own and the caller should fall through to its usual resolution. Type-first filing:
 * a Bug goes to the bug folder wherever in the tree it hangs.
 *
 * Each type's folder is picked whole in the view options, so what is stored is what
 * applies — no joining, no relative-path rule to remember. `homeFolder` is what a type
 * without one falls back to.
 */
export function folderForType(typeName: string, settings: BacklogSettings): string | null {
	return byName(settings.typeFolders, typeName) || null;
}

/**
 * The type a focused view is showing at its top: a level, or an extra type
 * named directly. Extra types are focusable because they are types a user files work
 * under — "show me the bugs" is the same question as "show me the PBIs".
 */
export function focusTarget(settings: BacklogSettings): string {
	const focus = settings.focusLevel.trim().toLowerCase();
	if (!focus) return '';
	return ALL_TYPES.find((t) => t.toLowerCase() === focus) ?? '';
}

/**
 * The level name to show on an item's badge — read off the item's OWN ladder, which is
 * the difference a second one makes here. A `Task` beneath a `Test case` is rung 2 of the
 * test ladder and rung 3 of the plan's; indexing `LEVELS` with the first would badge it
 * `PBI`.
 */
export function displayType(item: { levelIndex: number; ladder: string[]; typeName: string | null }): string {
	if (item.levelIndex >= 0) return item.ladder[item.levelIndex];
	return item.typeName ?? '';
}

/** The two ends a dated placement can act on, in the order every entry asks for them. */
export type PlacementEnd = 'start' | 'target';

const BOTH_ENDS: PlacementEnd[] = ['start', 'target'];

/**
 * Which ends a placement acts on for this TYPE. A milestone answers for its target
 * alone — the type states *point* as strongly as a missing key does, and a start it
 * merely ignores is not a date any hand may write or delete.
 *
 * Stated per type rather than per control, so every path inherits the narrowing by
 * asking rather than by restating it: the row's Schedule and Unschedule, the shelf
 * drop, the body slide, both grips, and — since this takes a type name and not an item
 * — the WRITER, which has to decide against what the note currently says. It lives
 * here rather than in `view/` for exactly that last reason: `storage/` may not reach
 * upward, and a second copy is the one that would drift.
 *
 * `iterationBars` is REQUIRED, with no default: a defaulted flag would silently keep
 * every caller on the old meaning the day the option ships, which is the exact defect
 * this parameter exists to make impossible to ignore.
 */
export function placementEnds(typeName: string | null, iterationBars: boolean): PlacementEnd[] {
	// A `Release` speaks NO end here — not one, not two. `drawsAsPoint` refuses it (see
	// there), and the ternary below reads that refusal as "therefore a span", which would
	// hand the WRITER both backlog date keys and the menu a Schedule action. The gate has
	// to be stated at every consumer that reads the predicate through a ternary, or it
	// makes the very surface it was closing more permissive than before.
	if (isReleaseType(typeName)) return [];
	return drawsAsPoint(typeName, iterationBars) ? ['target'] : [...BOTH_ENDS];
}

/**
 * Whether a note of this type may HOLD this optional property — one question, asked of
 * the type a note states at the moment it is opened, and the only statement of it.
 *
 * Every planning key this plugin writes reaches a note through one of two doors: a
 * gesture that names it, or the backfill that stubs it. Both used to answer this for
 * themselves, and a rule answered twice is a rule with a hole in it — the horizon's
 * live-type check sat inside `refusesAxis` (`storage/frontmatter.ts`), which returns at
 * its first clause for a write carrying no `axis`, so the iteration assignment and the ✨
 * backfill both reached a `Release` ungated. What each door DOES about a refusal still
 * differs, and rightly: a gesture in flight refuses its batch loudly, a backfill stub is
 * dropped and the rest of the batch goes on. What may not differ is the answer.
 *
 * **Name-shaped by ruling, not by oversight.** Only a `Release` is asked, so no shipped
 * type's write behaviour changes here; the dated ends are already asked of the rule
 * (`placementEnds`, which answers a release NO end), and the three link-shaped fields are
 * what the name still decides. Widening it to every type — a `Milestone`'s `start` is the
 * known case — is an edit to this body and to no call site, which is the whole reason the
 * settings are a parameter rather than a lookup at each call site. It is NOT the one-liner
 * "drop the `isReleaseType` line" looks like: an `Iteration`'s own two dates ARE that
 * note's definition rather than a placement in somebody's plan, and `placementEnds`
 * answers `['target']` for one whose bars are off — so the widened body has to EXCLUDE an
 * iteration before it asks the placement rule, or it refuses the iteration dialog's own
 * save (`axisFrom` in `view/interactions/create.ts` states no `ends`, so this function is
 * exactly what would see it). See
 * `docs/issues/Creation seeds a placement the type may not hold.md`, which carries the
 * corrected body and what it costs.
 */
export function mayHoldField(typeName: string | null, field: OptionalField, settings: BacklogSettings): boolean {
	if (!isReleaseType(typeName)) return true;
	if (field === 'start' || field === 'target') return placementEnds(typeName, settings.iterationBars).includes(field);
	// The goal joins the link for its own reason and not by being near it: `saveIteration`
	// re-reads the MODEL rather than the note, so a goal-only save after a mid-flight
	// retype puts a `goal` on a `Release` that no dialog will ever offer to clear — the
	// same unclearable shape as the sprint link, reached through the other field.
	return field !== 'horizon' && field !== 'iteration' && field !== 'iterationGoal';
}
