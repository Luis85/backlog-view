import { BacklogItem, BacklogModel } from './model';
import { ItemWrite, ORDER_SPACING, roundOrder } from './writePlan';

/**
 * The two whole-population rank rewrites, worked out without touching anything.
 *
 * They live beside `writePlan.ts` rather than in it because they answer a different
 * question: every other plan here places ONE row against its neighbours, and these two
 * restate the rank of every row at once.
 */

/** A plan, or the rows that could not be given distinct ranks. Never a bare `[]` for
 *  a refusal: an empty plan and a wedged one are different answers and the command
 *  says different things about them. */
export type SpreadResult = { writes: ItemWrite[] } | { wedged: BacklogItem[] };

/**
 * The migration, correct exactly ONCE: the hierarchy written into numbers. Run a second
 * time it discards every rank set by hand at a focus level, which is why the command
 * confirms first.
 *
 * It is also the only thing that can repair a vault whose existing ranks contradict the
 * drawn order — `computeInitWrites` fills blanks and may not touch a rank that is
 * already there.
 */
export function computeSeedWrites(model: BacklogModel): SpreadResult {
	const sequence: BacklogItem[] = [];
	const visit = (items: BacklogItem[]) => {
		for (const item of items) {
			sequence.push(item);
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return spreadAround(sequence);
}

/**
 * The repair, correct any number of times: the RANK order, respaced. It preserves every
 * ranking decision, which is what makes it the answer to a spent gap and to a tie — and
 * what makes it, not the seed, the one an implementer reaches for.
 *
 * **"The order already on screen" only while the population is distinctly ranked**, and
 * that is why the confirmation asks (`distinctlyRanked`, `rankOrder.ts`). A list whose own
 * rows are not distinctly ranked is DRAWN in tree order — `inRankOrder`'s guard against
 * scrambling an unmigrated vault — and `model.ranked` is the global rank sort, a different
 * sequence: focus rows drawn `A1(10), A2(20), B1(10)` respace to `A1, B1, A2`, distinctly
 * ranked from then on, so the guard disengages and the view redraws in an order nobody
 * chose. The command narrows what it promises rather than refusing (which would send the
 * user to Seed, and Seed discards hand-set focus ranks) — there is no single rendered
 * order for a whole-population rewrite to preserve.
 *
 * Over the WHOLE loaded population, never the focused slice.
 */
export function computeRespaceWrites(model: BacklogModel): SpreadResult {
	return spreadAround(model.ranked);
}

/**
 * Give every writable row in `sequence` a new rank that keeps the sequence, leaving
 * `outsideFilter` rows exactly where they are.
 *
 * **Both commands share this**, and that is the point rather than a convenience: they
 * differ only in the sequence they hand it — Seed passes DFS preorder, Respace passes
 * the ranked population — and the immovable-context rule is identical for both.
 *
 * **Immovability and rank availability are two different facts, and conflating them
 * writes to a context row.** `outsideFilter` alone decides who may be written; the rank
 * only decides whether that row also constrains its neighbours. An unranked context row
 * constrains nothing, so it must not split the allocation either: making every context
 * row a boundary leaves the runs on each side restarting at `ORDER_SPACING` — a
 * collision manufactured by the migration itself.
 *
 * **What it guarantees, written to what the tests check and no wider.** The WRITABLE rows
 * come out in the sequence's own order, distinctly ranked, and none of them takes a rank a
 * context row already holds. It cannot promise the same of the context rows themselves: one
 * ranked out of the order it is drawn in stays that way, because the base excludes it and
 * the view may not write to it. Where writable rows are squeezed against such a rank the
 * plan wedges rather than writing a value that would break the order it kept elsewhere.
 *
 * **The floor is the highest context rank passed, not the last one** — the correction
 * `computeInitWrites` already made for the same reason. A context ancestor ranked above
 * its own context child is ordinary on a legacy vault, and following it down would let a
 * later run reuse an interval an earlier one was placed in.
 */
function spreadAround(sequence: BacklogItem[]): SpreadResult {
	// Every rank the plan may not move, ascending. `above` reads it rather than the next
	// boundary in the sequence, so a run is never placed across a fixed rank that happens
	// to be drawn later.
	const fixed = sequence
		.filter((item) => item.outsideFilter && item.order !== null)
		.map((item) => item.order as number)
		.sort((a, b) => a - b);
	const above = (floor: number | null): number | null =>
		fixed.find((order) => floor === null || order > floor) ?? null;
	const writes: ItemWrite[] = [];
	let run: BacklogItem[] = [];
	let floor: number | null = null;
	/** Place what has gathered, or answer false to say the interval cannot hold it. */
	const flush = (): boolean => {
		const placed = placeRun(run.length, floor, above(floor));
		if (placed === null) return false;
		run.forEach((item, k) => writes.push({ file: item.file, order: placed[k] }));
		run = [];
		return true;
	};
	for (const item of sequence) {
		if (!item.outsideFilter) {
			run.push(item);
			continue;
		}
		if (item.order === null || (floor !== null && item.order <= floor)) continue;
		if (!flush()) return { wedged: run };
		floor = item.order;
	}
	return flush() ? { writes } : { wedged: run };
}

/**
 * `count` ranks evenly spread in the open interval, or null when they will not fit.
 *
 * **Fails closed, like every other place a rank is produced.** The question is asked of
 * the ROUNDED values, because at large magnitudes "the gap is wide enough" and "the
 * value is clear of its neighbour" disagree — see `midpoint` in `writePlan.ts`. Two
 * context rows a hair apart cannot hold three distinct six-decimal ranks between them,
 * and neither can an unbounded run whose spacing rounds back onto the rank below it.
 */
function placeRun(count: number, floor: number | null, ceiling: number | null): number[] | null {
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
