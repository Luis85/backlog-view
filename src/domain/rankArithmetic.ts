/**
 * What a rank may BE: the numbers a placement is allowed to produce, and the grid they
 * land on.
 *
 * Here rather than in `writePlan.ts` for the reason `rankSpread.ts` is beside it — every
 * plan there places ONE row against its neighbours — read the other way round: this is
 * the arithmetic all three of them share. `roundOrder`'s own note below already made the
 * argument: a second definition of the grid is a second answer to what a rank may be, and
 * the one-row placement, the whole-population rewrites and the backfill each need it.
 */

/** Spacing between freshly assigned order values, leaving room to drop items in between. */
export const ORDER_SPACING = 1000;

/**
 * Why a placement produced no number. Each names its own remedy at the notice, and the
 * three are genuinely different advice: `gapSpent` sends the user to Respace, `unranked`
 * to the backfill, and `tied` to Seed — a tie is the sibling-scoped scheme showing through,
 * the backfill only fills blanks, and respacing a range that holds two equal numbers cannot
 * separate them. `tied` reaches a notice only when the peer fallback fails to answer —
 * refusing itself, or producing a number another row already holds; when it answers a free
 * one, `dropPlacement` returns that rank and nothing is said.
 *
 * **One case where no remedy named here can work**: when the row holding the number is one
 * the Base EXCLUDED, no write path may ever move it, so nothing changes at that site. The
 * refusal is still right — see `rankTaken` for why the alternative is worse — and this
 * refusal cannot tell the two apart from here, because it carries a reason and never a row.
 * What keeps the sentence honest is that the command it names reports its own dead end:
 * Seed and Respace both answer `rank.wedged` over exactly the rows squeezed against a rank
 * this base cannot write, so the user is sent one step further rather than in a circle.
 *
 * `parentGone` is the odd one: no function in this module produces it. A creation's
 * destination is re-resolved by PATH under a modal prompt (`view/interactions/create.ts`),
 * and a parent that has been deleted meanwhile is a placement that refuses for a reason
 * the arithmetic never sees. It is a member here rather than a fourth thing beside
 * `RankResult` so that every caller keeps ONE shape to test and `refusalKey` stays the
 * single place a refusal becomes a sentence.
 */
export type RankRefusal = 'gapSpent' | 'parentGone' | 'tied' | 'unranked' | 'unseededList';
export type RankResult = { order: number } | { refusal: RankRefusal };

/**
 * The catalog key that names each refusal's remedy. A `switch` and not a ternary, so
 * adding a fifth refusal is a compile error rather than a wrong message: a two-way
 * ternary was still routing everything that was not `gapSpent` to the backfill advice
 * when the third member landed, which would tell a user whose parent had been deleted
 * to initialize their ranks.
 *
 * Keys and not sentences, which is also what keeps this out of `TEXT_TERNARY`'s way:
 * only `t()` reaches the catalog.
 */
export function refusalKey(
	refusal: RankRefusal,
): 'rank.gapSpent' | 'rank.parentGone' | 'rank.tied' | 'rank.unranked' | 'rank.unseededList' {
	switch (refusal) {
		case 'gapSpent':
			return 'rank.gapSpent';
		case 'parentGone':
			return 'rank.parentGone';
		case 'tied':
			return 'rank.tied';
		case 'unranked':
			return 'rank.unranked';
		case 'unseededList':
			return 'rank.unseededList';
	}
}

/**
 * The rank between two numbers, either of which may be absent — **the one arithmetic**, so
 * that the placement a drop takes and the rank the backfill fills a blank with cannot
 * disagree. `anchoredOrder` reaches it with the neighbours it found by identity in the
 * ranked population; `computeInitWrites` reaches it with the bounds it is walking between.
 *
 * Null means "no neighbour that side", which is why both-null answers `ORDER_SPACING`:
 * the first rank in an empty population has nothing to be between.
 */
export function rankBetween(prev: number | null, next: number | null): RankResult {
	if (prev === null) return next === null ? { order: ORDER_SPACING } : edgeRank(next, 'before');
	if (next === null) return edgeRank(prev, 'after');
	return midpoint(prev, next);
}

/**
 * The rank between two neighbours, or `gapSpent` when there is no room left for one.
 *
 * The question is asked of the ROUNDED value and of nothing else: "is the gap wide
 * enough" is a different question, and at large magnitudes the two disagree. IEEE-754
 * spacing near 1e12 is about 0.00012, wider than the six decimals `roundOrder` keeps, so
 * a gap of 0.0001 clears any fixed minimum and still rounds the midpoint back onto
 * `prev`. That writes a DUPLICATE rank, and two equal ranks fail `inRankOrder`'s
 * distinctness test — the whole focused view drops back to tree order for a reason the
 * user is never shown. A hand-edited `order` that large is reachable frontmatter, not a
 * hypothetical.
 *
 * One rule rather than a minimum gap beside it: a second test can only ever disagree
 * with this one, and a magnitude-dependent epsilon is that second test wearing a
 * formula. Strictly between both ends is exactly what the caller needs and all it needs.
 */
function midpoint(prev: number, next: number): RankResult {
	// **An exact tie is a different refusal from a spent gap**, and the difference is the
	// only reliable signal that a vault's ranks are still sibling-scoped. Two rows holding
	// the SAME number is what that scheme produces — every first child carries its
	// parent's value — and it is visible right here, at the drop site, without asking
	// anything about the rest of the vault. Every whole-population test of "is this vault
	// migrated" has the same hole: one stray null or one unrelated tie, anywhere, flips it
	// for a subtree that is perfectly seeded. A neighbourhood question has no such hole.
	if (prev === next) return { refusal: 'tied' };
	// The subtraction overflows across the full float range (`-1e308` to `1e308`), and a
	// non-finite midpoint fails the test below — reporting `gapSpent` over a gap that holds
	// every number there is. Halving each end first cannot overflow, but it is NOT
	// bit-identical to the subtraction, so it is reached only where the ordinary form has
	// already given up its answer. `roundOrder` returns a value it cannot round unchanged,
	// so the test below is still asked of a real number.
	const mid = roundOrder(Number.isFinite(next - prev) ? prev + (next - prev) / 2 : prev / 2 + next / 2);
	return mid > prev && mid < next ? { order: mid } : { refusal: 'gapSpent' };
}

/**
 * One spacing clear of the population's own first or last row, or `gapSpent` when the
 * arithmetic cannot get clear of it.
 *
 * The check is the same one `midpoint` makes, for the same reason and in the one other
 * place a rank is computed: above about 1e19 the IEEE-754 unit exceeds `ORDER_SPACING`,
 * so `Math.floor(order) + 1000` IS `order` and the append writes the anchor's own rank —
 * a duplicate, which then fails the distinctness test that decides whether a focused view
 * may be sorted by rank at all. The prepend has the mirror problem at large negative
 * magnitudes. Both branches call this rather than spelling the expression, so the two
 * places that produce a rank both refuse an unusable one and a third cannot appear
 * without the check.
 */
export function edgeRank(neighbour: number, side: 'before' | 'after'): RankResult {
	const order = Math.floor(neighbour) + (side === 'after' ? ORDER_SPACING : -ORDER_SPACING);
	const clear = side === 'after' ? order > neighbour : order < neighbour;
	return clear ? { order } : { refusal: 'gapSpent' };
}

/** Orders are fractional ranks, kept to six decimals — the grid `midpoint` refuses against.
 *  Exported: every producer of a rank in this module lands on the same grid, and a second
 *  definition of it is a second answer to what a rank may be.
 *
 *  **A value the grid cannot hold comes back unrounded, and that is not a fudge.**
 *  `Math.round(value * 1e6)` overflows above about 1.8e302, so rounding a legal
 *  hand-edited `order` of 1e308 returned Infinity — and every guard downstream reads the
 *  ROUNDED value, by design (see `midpoint`), so `placeRun` asked `Infinity <= 1e308`,
 *  accepted, and planned a rank YAML cannot hold; `readNumber` then rejects it on the next
 *  build and a note that HAD a rank silently loses it. Above that threshold the float
 *  spacing is about 1e286, so six decimals are already meaningless there and `value` IS
 *  what rounding would give if it could. Fixed here rather than at the two callers because
 *  both then refuse on the guards they already have — `placeRun`'s `order <= previous` and
 *  `midpoint`'s strictly-between test — and nothing below the threshold changes. */
export function roundOrder(value: number): number {
	const rounded = Math.round(value * 1000000) / 1000000;
	return Number.isFinite(rounded) ? rounded : value;
}

/**
 * `count` ranks evenly spread in the open interval, or null when they will not fit.
 *
 * **Fails closed, like every other place a rank is produced.** The question is asked of
 * the ROUNDED values, because at large magnitudes "the gap is wide enough" and "the
 * value is clear of its neighbour" disagree — see `midpoint` above. Two
 * context rows a hair apart cannot hold three distinct six-decimal ranks between them,
 * and neither can an unbounded run whose spacing rounds back onto the rank below it.
 */
export function placeRun(count: number, floor: number | null, ceiling: number | null): number[] | null {
	if (count === 0) return [];
	const step = floor !== null && ceiling !== null ? (ceiling - floor) / (count + 1) : ORDER_SPACING;
	// The leading run hangs BELOW its ceiling rather than counting up from a synthetic
	// zero: the population may already start well below it.
	const base = floor ?? (ceiling === null ? 0 : ceiling - (count + 1) * ORDER_SPACING);
	const placed = Array.from({ length: count }, (_, k) => roundOrder(base + step * (k + 1)));
	let previous = floor;
	for (const order of placed) {
		if (previous !== null && order <= previous) return null;
		previous = order;
	}
	return ceiling !== null && placed[count - 1] >= ceiling ? null : placed;
}
