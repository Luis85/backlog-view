import { ALL_TYPES, BacklogSettings, byName, DELIVERABLE_TYPE, EXTRA_TYPES, LEVELS, MARKER_TYPES } from './settings';

/**
 * The type vocabulary: the level ladder, and the types that sit beside it.
 *
 * `LEVELS` is a ladder — Epic → Feature → PBI → Task — and every level rule is
 * "one rung below the parent". **Extra types are the exception that the ladder cannot
 * express**: a Bug holds Tasks whether it hangs from an Epic, a Feature or a PBI, so its
 * rung is a property of the type rather than of where it sits. Two consequences follow,
 * and both are why this is a type rather than a fifth level:
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
	/** Index into `LEVELS`; -1 for an extra type, a marker, or a type off the ladder. */
	levelIndex: number;
	/** The rung the item occupies, chained down the parent levels. */
	effectiveLevelIndex: number;
	/**
	 * The name on the note. A marker has no rung and therefore no position that could
	 * distinguish it, so the only thing that tells one from the ordinary item sitting at
	 * the same effective level is what it calls itself.
	 */
	typeName: string | null;
}

/**
 * Level index a child of `parent` should get: one below the parent's effective
 * level, clamped to the deepest level. Top-level items get level 0.
 */
export function childLevelIndex(parent: LadderPosition | null): number {
	if (!parent) return 0;
	return nextLevelIndex(parent.effectiveLevelIndex);
}

/**
 * One rung below `levelIndex`, clamped at the deepest level — the
 * single statement of "what a child's level is". Exported so a walk that has a
 * level in hand rather than an item (the autoType cascade, planning types for a
 * subtree that has not been written yet) descends by the same rule the model
 * will apply afterwards, instead of re-deriving it from tree depth.
 */
export function nextLevelIndex(levelIndex: number): number {
	return Math.min(levelIndex + 1, LEVELS.length - 1);
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
	// The toolbar's top-level creator has always offered every declared type
	// unconditionally, with no parent (`renderToolbar`'s "pick another type" menu
	// iterates ALL_TYPES) — this has to agree with that standing behavior rather than
	// invent a narrower "which types make sense as roots" question nothing else in
	// the view asks.
	if (!parent) return ALL_TYPES;
	const ladderChild = LEVELS[childLevelIndex(parent)];
	// The top level is the WHOLE vocabulary, because that is what the toolbar does:
	// `renderToolbar` iterates `ALL_TYPES` unconditionally and writes a note with no
	// `parent` for whichever is picked. This branch used to answer `Epic` and the markers
	// — an opinion ("a Bug hangs from something") that nothing enforced and nothing acted
	// on, since no `+` button exists without a row. Its one reader is the generated
	// README's root marker (`parentsOf`), which was therefore publishing, into the user's
	// own vault, that an Issue must hang from a rung while the toolbar was making
	// parentless ones. A branch describing a creation path that does not exist is worth
	// less than one describing the path that does.
	if (!parent) return [...ALL_TYPES];
	const onLadder = parent.levelIndex >= 0 && parent.levelIndex < LEVELS.length - 1;
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

/** The level name to show on an item's badge. */
export function displayType(item: { levelIndex: number; typeName: string | null }): string {
	if (item.levelIndex >= 0) return LEVELS[item.levelIndex];
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
 */
export function placementEnds(typeName: string | null): PlacementEnd[] {
	return isMarkerType(typeName) ? ['target'] : [...BOTH_ENDS];
}
