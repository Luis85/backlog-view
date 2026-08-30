import type { BacklogItem } from './model';

/**
 * Global rank order: the `order` property ascending, ties broken by the Bases result
 * order. Unranked items sort last — absence is not a low rank, and `compareSiblings`
 * already keeps that rule for a sibling group.
 */
function compareRank(a: BacklogItem, b: BacklogItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	return ao - bo || a.entryIndex - b.entryIndex;
}

/**
 * Every loaded item in global rank order — the build's second object sort, declared in
 * `src/domain/CLAUDE.md`'s Cost section: bounded by the item count, run once per build
 * rather than per row, so the build's bound stays O(n log n).
 */
export function rankedItems(items: BacklogItem[]): BacklogItem[] {
	return [...items].sort(compareRank);
}

/**
 * The given rows, in global rank order. A focus level is a FILTER over the ranked
 * array, never a sort of its own: filtering a sorted array preserves order, so this
 * costs one pass and no comparison. `collectFocusRoots` decides MEMBERSHIP — which
 * rungs and which extra types — and `ranked` decides SEQUENCE.
 */
export function inRankOrder(rows: BacklogItem[], ranked: BacklogItem[]): BacklogItem[] {
	const members = new Set(rows);
	return ranked.filter((item) => members.has(item));
}
