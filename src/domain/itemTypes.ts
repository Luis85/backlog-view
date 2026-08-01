import { BacklogSettings } from './settings';

/**
 * The type vocabulary: the level ladder, and the types that sit beside it.
 *
 * `settings.levels` is a ladder — Epic → Feature → PBI → Task — and every level rule is
 * "one rung below the parent". **Extra types are the exception that the ladder cannot
 * express**: a Bug holds Tasks whether it hangs from an Epic, a Feature or a PBI, so its
 * rung is a property of the type rather than of where it sits. Two consequences follow,
 * and both are why this is a type rather than a fifth level:
 *
 * - it ranks at `extraTypeRank` no matter its parent, so its children always imply the
 *   deepest level;
 * - it has no `levelIndex`, so nothing re-types it by position — dropping a Bug under an
 *   Epic leaves a Bug.
 *
 * A leaf module by design: it knows the settings and nothing about the tree, so
 * `model.ts` can import it while it builds one.
 */

/** Where an item sits on the ladder — all these functions need of a parent. */
export interface LadderPosition {
	/** Index into `settings.levels`; -1 for an extra type or a type off the ladder. */
	levelIndex: number;
	/** The rung the item occupies, chained down the parent levels. */
	effectiveLevelIndex: number;
}

/**
 * Level index a child of `parent` should get: one below the parent's effective
 * level, clamped to the deepest configured level. Top-level items get level 0.
 */
export function childLevelIndex(parent: LadderPosition | null, levels: string[]): number {
	if (!parent) return 0;
	return nextLevelIndex(parent.effectiveLevelIndex, levels);
}

/**
 * One rung below `levelIndex`, clamped at the deepest configured level — the
 * single statement of "what a child's level is". Exported so a walk that has a
 * level in hand rather than an item (the autoType cascade, planning types for a
 * subtree that has not been written yet) descends by the same rule the model
 * will apply afterwards, instead of re-deriving it from tree depth.
 */
export function nextLevelIndex(levelIndex: number, levels: string[]): number {
	return Math.min(levelIndex + 1, levels.length - 1);
}

/**
 * The rung every extra type occupies: the one whose children are the deepest level.
 * Fixed rather than inherited — that pinning is the whole point of the concept, and it
 * is what makes "a Bug's children are Tasks" true under an Epic as well as under a PBI.
 */
export function extraTypeRank(levels: string[]): number {
	return Math.max(levels.length - 2, 0);
}

/** True when `typeName` is one of the configured extra types (case-insensitive). */
export function isExtraType(typeName: string | null, settings: BacklogSettings): boolean {
	if (typeName === null) return false;
	const name = typeName.toLowerCase();
	return settings.extraTypes.some((t) => t.toLowerCase() === name);
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
export function childTypeChoices(parent: LadderPosition | null, settings: BacklogSettings): string[] {
	const ladderChild = settings.levels[childLevelIndex(parent, settings.levels)];
	// Top level is the ladder's top: a Bug hangs from something, and creating one with
	// no parent would make an item whose own rule says it should have had one.
	if (!parent) return [ladderChild];
	const onLadder = parent.levelIndex >= 0 && parent.levelIndex < settings.levels.length - 1;
	return onLadder ? [ladderChild, ...settings.extraTypes] : [ladderChild];
}

/** Every type a user may assign by hand: the ladder, then the extras. */
export function allTypeChoices(settings: BacklogSettings): string[] {
	return [...settings.levels, ...settings.extraTypes];
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
	const configured = settings.typeFolders[typeName.toLowerCase()];
	// A folder is a non-empty STRING; anything else means unmapped. That type test is
	// what makes this total for any record a caller hands over — a level named
	// `constructor` or `toString` otherwise reads an inherited function off a plain
	// object, and the creation flow would take it for a path and fail on `.trim()`.
	return typeof configured === 'string' && configured ? configured : null;
}

/**
 * The type a focused view is showing at its top: a configured level, or an extra type
 * named directly. Extra types are focusable because they are types a user files work
 * under — "show me the bugs" is the same question as "show me the PBIs".
 */
export function focusTarget(settings: BacklogSettings): string {
	const focus = settings.focusLevel.trim().toLowerCase();
	if (!focus) return '';
	return allTypeChoices(settings).find((t) => t.toLowerCase() === focus) ?? '';
}

/** The level name to show on an item's badge. */
export function displayType(item: { levelIndex: number; typeName: string | null }, settings: BacklogSettings): string {
	if (item.levelIndex >= 0) return settings.levels[item.levelIndex];
	return item.typeName ?? '';
}
