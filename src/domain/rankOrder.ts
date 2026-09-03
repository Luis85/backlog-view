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
 * **Nothing on the write side asks it, and the one thing that did was wrong to.**
 * `Respace ranks` (`commands/rank.ts`) rewrites the whole population and its confirmation
 * promises to keep the order on screen; it asked this of `model.ranked` and read the
 * answer as "some drawn list is falling back". That direction is sound — every drawn list
 * is a SUBSET of the population, so distinct here means none of them is falling back — but
 * the converse is not, and the sentence asserts present fact: ranks that collide ACROSS
 * focus levels while staying distinct WITHIN each one make the population non-distinct
 * with no list falling back at all. The confirmation reads `model.focusInTreeOrder`
 * instead, which is this predicate asked of the ONE list `inRankOrder` is called for.
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
export function distinctlyRanked(rows: BacklogItem[]): boolean {
	const orders = rows.filter((item) => !item.outsideFilter).map((item) => item.order);
	return !orders.some((o) => o === null) && new Set(orders).size === orders.length;
}

/**
 * Whether these rows, in the order given, ALREADY stand in their own rank order.
 *
 * **Distinctness is not enough to know that lifting the fallback keeps the screen still**,
 * and that is the difference this predicate exists for. `inRankOrder` draws a focused list
 * in tree order while its rows are not distinctly ranked; the write that makes them
 * distinct switches the whole list to the RANK order, which is a different sequence unless
 * the ranks already agreed with the tree. Drawn `A(30), B(10), C(10)`, a drop of C at the
 * top gives C a rank between them and the list comes back `B, C, A` — C is not where it was
 * dropped, and B, which nobody touched, has moved. Measured, not supposed.
 *
 * Asked of the same rows `distinctlyRanked` reads — the writable ones — for the same reason
 * it gives: a context row is one no pass can ever migrate, so counting it would be a
 * permanent veto rather than a condition Seed can clear.
 *
 * Strictly ascending, so this implies `distinctlyRanked` of the same rows and is the
 * stronger question: not "is there an order" but "is the order the one on screen".
 */
export function drawnInRankOrder(rows: BacklogItem[]): boolean {
	const orders = rows.filter((item) => !item.outsideFilter).map((item) => item.order);
	if (orders.some((o) => o === null)) return false;
	return orders.every((order, i) => i === 0 || (orders[i - 1] as number) < (order as number));
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
