import { EXTRA_TYPE_RANK, isExtraType } from './itemTypes';
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
	if (!distinctlyRanked(rows)) return rows;
	const members = new Set(rows);
	return ranked.filter((item) => members.has(item));
}

/**
 * Whether these rows' ranks answer the question a global order asks — every writable one
 * present, and no two the same. **A question about the WHOLE list, and only the read side
 * may ask it.** Sorting is all-or-nothing: one row without a rank leaves the list with no
 * defined order, so the whole list falls back to tree order and that is right.
 *
 * The write side must not reuse it, and tried twice. Whether a PLACEMENT may fall back to
 * sibling-scoped arithmetic is a fact about the two rows it landed between, not about the
 * vault: one stray unranked note, or one legacy tie in an unrelated corner, makes this
 * false for a subtree that is perfectly seeded, and the fallback then writes a rank
 * another row holds. `dropPlacement` reads the tie at the drop site instead.
 *
 * Distinctness is the test because it is exactly what makes a global rank a global ORDER.
 * Ties (and absent ranks) mean the number is not yet answering the question. Self-healing:
 * the moment Seed gives the rows distinct ranks, this turns true with nothing to switch on.
 *
 * Read only off the WRITABLE rows — the same reasoning `anchoredOrder` already uses to skip
 * an unranked context row when picking a neighbour. Seed and Respace never write a context
 * note, so counting one here would be a permanent veto: a row nothing can ever migrate
 * would keep this view in tree order forever, even once every writable note has a distinct
 * rank.
 */
function distinctlyRanked(rows: BacklogItem[]): boolean {
	const orders = rows.filter((item) => !item.outsideFilter).map((item) => item.order);
	return !orders.some((o) => o === null) && new Set(orders).size === orders.length;
}

/**
 * The rows that could stand beside this one in a single `inRankOrder` list — equal keys
 * mean a shared list is possible, and only then does one row's rank constrain another's.
 * Beside the mechanism it has to agree with rather than beside the one caller
 * (`computeInitWrites`, which bounds a backfilled rank against exactly these rows).
 *
 * `collectFocusRoots` takes a level by `levelIndex` and an extra type — which has none —
 * by the rung it is pinned to, so those two answer one key and every other item answers
 * its own level. Conservative where it cannot be exact: a catalog row is never a focus
 * root at all, and an unknown custom type matches no focus level, yet both keep an
 * ordinary key here rather than an exemption. Over-constraining a caller is a rank not
 * handed out; under-constraining one is a row that moves.
 */
export function focusKey(item: BacklogItem): number {
	return isExtraType(item.typeName) ? EXTRA_TYPE_RANK : item.levelIndex;
}
