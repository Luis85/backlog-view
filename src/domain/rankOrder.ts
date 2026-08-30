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
	// **An unseeded vault keeps tree order.** Legacy ranks are sibling-scoped, so every
	// first child holds 10 and every second holds 20 — sorting those globally does not
	// reveal a priority, it interleaves the parents: A1, A2, B1, B2 becomes A1, B1, A2,
	// B2. Measured, not supposed. `Seed ranks from the hierarchy` is the remedy, and it
	// arrives in a later task than this ordering does, so without this guard an upgrade
	// scrambles the visible priority of every focused view and leaves the user no clue
	// that a command would fix it.
	//
	// Distinctness is the test because it is exactly what makes a global rank a global
	// ORDER. Ties (and absent ranks) mean the number is not yet answering the question,
	// so the tree's own order is the better answer. Self-healing: the moment Seed gives
	// the rows distinct ranks, this returns rank order with nothing to switch on.
	const orders = rows.map((item) => item.order);
	if (orders.some((o) => o === null) || new Set(orders).size !== orders.length) return rows;
	const members = new Set(rows);
	return ranked.filter((item) => members.has(item));
}
