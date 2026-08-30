import { describe, expect, it } from 'vitest';
import { anchoredOrder, dropPlacement, ORDER_SPACING, orderForTarget } from '../../src/domain/writePlan';
import { BacklogItem } from '../../src/domain/model';

/** The only fields `anchoredOrder` reads. */
function ranked(...orders: (number | null)[]): BacklogItem[] {
	return orders.map((order, i) => ({ order, entryIndex: i }) as BacklogItem);
}

describe('anchoredOrder', () => {
	it('takes the midpoint between the anchor and its global neighbour', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ order: 2000 });
		expect(anchoredOrder(list, list[1], 'before')).toEqual({ order: 2000 });
	});

	it('places before the global first', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[0], 'before')).toEqual({ order: 0 });
	});

	it('places after the global last', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[1], 'after')).toEqual({ order: 4000 });
	});

	it('ranks the first item in an empty population', () => {
		expect(anchoredOrder([], null, 'after')).toEqual({ order: ORDER_SPACING });
	});

	it('refuses a spent gap', () => {
		const list = ranked(1000, 1000.000001);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'gapSpent' });
	});

	it('refuses an unranked neighbour', () => {
		const list = ranked(1000, null);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'unranked' });
	});

	it('refuses an anchor that is not in the population', () => {
		expect(anchoredOrder(ranked(1000), ranked(5000)[0], 'after')).toEqual({ refusal: 'unranked' });
	});

	it('refuses an append whose spacing cannot clear the row it appends after', () => {
		// Above about 1e19 the IEEE-754 unit exceeds ORDER_SPACING, so
		// `Math.floor(prev) + 1000` IS `prev` — the append writes the anchor's own rank.
		// The identical defect `midpoint` already refuses, in the branch that never went
		// through it. Reachable only by a hand-edited rank, but the rule has to be uniform.
		const list = ranked(1e20);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'gapSpent' });
	});

	it('refuses a prepend whose spacing cannot clear the row it prepends before', () => {
		// The mirror, at large negative magnitude: `Math.floor(next) - 1000` is `next`.
		const list = ranked(-1e20);
		expect(anchoredOrder(list, list[0], 'before')).toEqual({ refusal: 'gapSpent' });
	});

	it('refuses a wide gap whose midpoint still rounds onto its own neighbour', () => {
		// At 1e12 the IEEE-754 spacing (about 0.00012) is wider than the six-decimal
		// rounding grid, so a gap of 0.0001 clears any fixed minimum and STILL rounds the
		// midpoint back onto `prev` — a duplicate rank, which then fails `inRankOrder`'s
		// distinctness test and silently drops the whole focused view back to tree order.
		// `order` is hand-editable frontmatter, so a rank this large is reachable. The
		// guard has to ask about the ROUNDED value, not about the width of the gap.
		const list = ranked(1e12, 1e12 + 0.0001);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'gapSpent' });
	});

	it('keeps a midpoint distinct from both neighbours past four decimals', () => {
		// A gap of 0.00003 leaves room on the six-decimal grid, so this subdivides. The true
		// midpoint (1000.000015) needs six decimals to survive rounding — at four
		// it collapses onto `prev`, a silent duplicate rather than a new rank.
		const list = ranked(1000, 1000.00003);
		const result = anchoredOrder(list, list[0], 'after');
		expect(result).toEqual({ order: 1000.000015 });
	});
});

/**
 * `orderForTarget` turns a landing place into an anchor and a side. Three branches, and
 * the one that is easy to get wrong is the empty peer group: the anchor is then the
 * DESTINATION row, not a peer, which is what makes "first child of a parent" and "drop
 * inside a leaf" — the commonest placements there are — rank after the parent instead of
 * refusing for want of a peer to aim at.
 */
describe('orderForTarget', () => {
	it('anchors on the last peer before the insertion point', () => {
		const list = ranked(1000, 3000, 5000);
		expect(orderForTarget(list, { parent: null, peers: [list[0], list[2]], insertIndex: 1 })).toEqual({
			order: 2000,
		});
	});

	it('anchors before the first peer when the item lands at the top', () => {
		const list = ranked(1000, 3000);
		expect(orderForTarget(list, { parent: null, peers: [list[1]], insertIndex: 0 })).toEqual({ order: 2000 });
	});

	it('anchors on the destination itself when there are no peers', () => {
		const list = ranked(1000, 3000);
		expect(orderForTarget(list, { parent: list[0], peers: [], insertIndex: 0 })).toEqual({ order: 2000 });
	});

	it('ranks at the end of the whole population when there is no destination either', () => {
		const list = ranked(1000, 3000);
		expect(orderForTarget(list, { parent: null, peers: [], insertIndex: 0 })).toEqual({
			order: 3000 + ORDER_SPACING,
		});
	});

	it('passes a refusal through rather than inventing a number', () => {
		const list = ranked(1000, 1000.000001);
		expect(orderForTarget(list, { parent: null, peers: [list[0], list[1]], insertIndex: 1 })).toEqual({
			refusal: 'gapSpent',
		});
	});
});

/**
 * `dropPlacement`'s peer fallback exists for ONE population — a vault whose ranks were
 * never seeded, where sibling-scoped numbers collide across parents and the global
 * placement refuses for a gap of zero. It must not be reachable on a seeded one, where a
 * refusal is the designed answer and Respace is the remedy.
 */
describe('dropPlacement', () => {
	it('lets a spent gap refuse on a seeded vault rather than falling back over it', () => {
		// A(1000) and B(3000) are the peers; X(1000.000001) and Y(2000) are ranked between
		// them but are not peers. Dropping C after A is a genuinely spent gap — the
		// midpoint of A and its global neighbour X rounds onto X. Ranking among the peers
		// alone would answer 2000, which is Y's rank: a DUPLICATE, and a duplicate is what
		// `inRankOrder`'s distinctness test reads as "not seeded", so one bad write would
		// drop every focused view back to tree order. The refusal is the right answer here
		// and the user's remedy is Respace.
		const list = ranked(1000, 1000.000001, 2000, 3000, 4000);
		const [a, x, y, b, c] = list;
		expect(x.order).toBe(1000.000001);
		expect(y.order).toBe(2000);
		expect(dropPlacement(c, { parent: null, peers: [a, b], insertIndex: 1 }, list)).toEqual({
			refusal: 'gapSpent',
		});
	});

	it('is not opened by one unranked row: a null is not evidence of a legacy vault', () => {
		// The case above plus U, a writable row with no rank at all — a note created a
		// moment ago and not yet backfilled, which is the ORDINARY state of a working
		// vault rather than an edge case. A gate that asks "are these ranks perfect"
		// answers no here and lets the fallback write Y's 2000 all over again. The
		// fallback needs evidence of the sibling-scoped SCHEME, and only a repeated rank
		// is that. A null means "not backfilled yet", whose own remedy is the `unranked`
		// refusal telling the user to run the backfill.
		const list = ranked(1000, 1000.000001, 2000, 3000, 4000, null);
		const [a, , , b, c, u] = list;
		expect(u.order).toBeNull();
		expect(dropPlacement(c, { parent: null, peers: [a, b], insertIndex: 1 }, list)).toEqual({
			refusal: 'gapSpent',
		});
	});

	it('is not opened by a legacy tie somewhere else in the vault', () => {
		// L1 and L2 hold the same rank — a genuine legacy pair, and nowhere near the drop.
		// The rows the placement lands between, A and X, are distinct, so the gap really is
		// spent and the answer is the refusal. Asking "is this vault migrated" of the whole
		// population answers no here and lets the fallback duplicate Y's 2000 again; asking
		// the two neighbours does not.
		const list = ranked(500, 500, 1000, 1000.000001, 2000, 3000, 4000);
		const [, , a, , , b, c] = list;
		expect(dropPlacement(c, { parent: null, peers: [a, b], insertIndex: 1 }, list)).toEqual({
			refusal: 'gapSpent',
		});
	});

	it('falls back on a tie at the drop site, which is the sibling-scoped signature', () => {
		// The positive case, stated on its own rather than only through the vault fixture
		// in `writePlan.test.ts`: two neighbours holding the SAME number is what a
		// sibling-scoped vault produces, and it is the one condition that opens the
		// fallback. Peers [P(10)] alone, so the answer is one spacing below P.
		const list = ranked(10, 10, 20);
		const [, p, c] = list;
		expect(dropPlacement(c, { parent: null, peers: [p], insertIndex: 0 }, list)).toEqual({
			order: 10 - ORDER_SPACING,
		});
	});

	it('refuses a wholly unranked vault as unranked, never with a fallback number', () => {
		// No rank anywhere, so there is no sibling-scoped scheme to fall back ONTO — and
		// the refusal is the actionable one: `rank.unranked` sends the user to the
		// backfill, which is exactly what this vault needs. A fallback here would invent
		// a number and hide the one piece of advice that works.
		const list = ranked(null, null, null);
		const [p, q, r] = list;
		expect(dropPlacement(r, { parent: null, peers: [p, q], insertIndex: 1 }, list)).toEqual({
			refusal: 'unranked',
		});
	});
});

/**
 * The fallback's ANSWER, which no gate on its entry can vouch for. Both numbers it can
 * produce — a midpoint between two peers, an edge rank one spacing past the outermost one
 * — are functions of the peer values alone, and the rows between or beside those peers are
 * not peers. So the tie that opens the fallback says the arithmetic is the right KIND for
 * this vault, and says nothing about whether the number is free.
 */
describe('the peer fallback checks its own result', () => {
	/** A row the Base excluded: ranked, on screen, and unwritable by anything. */
	function contextRow(order: number): BacklogItem {
		return { order, entryIndex: 99, outsideFilter: true } as BacklogItem;
	}

	it('refuses a peer midpoint a non-peer between the peers already holds', () => {
		// A(1000) and X(1000) tie at the drop site, so the fallback opens — correctly, this
		// is the sibling-scoped signature. Among the peers A(1000) and B(3000) alone it
		// answers 2000, and 2000 is Y: a duplicate, which fails `inRankOrder`'s distinctness
		// test and drops every focused view back to tree order with nothing said. Being
		// between the peer bounds is exactly where a non-peer row is reachable.
		const list = ranked(1000, 1000, 2000, 3000, 4000);
		const [a, , y, b, c] = list;
		expect(y.order).toBe(2000);
		expect(dropPlacement(c, { parent: null, peers: [a, b], insertIndex: 1 }, list)).toEqual({
			refusal: 'tied',
		});
	});

	it('refuses an edge rank a drop in another group already took', () => {
		// The second half of the case the first half passes: on a legacy vault every group
		// is anchored on the same small numbers, so two groups compute the SAME edge rank.
		// Epic B(10) > B1(10), and X(-990) is where an earlier drop under Epic A landed.
		// Dropping Z before B1 ties at the site, falls back, and answers -990 again.
		const list = ranked(-990, 10, 10, 20);
		const [x, , b1, z] = list;
		expect(x.order).toBe(-990);
		expect(dropPlacement(z, { parent: null, peers: [b1], insertIndex: 0 }, list)).toEqual({
			refusal: 'tied',
		});
	});

	it('asks the population WITHOUT the dragged row, so a re-drop where it already is holds', () => {
		// Z is itself at -990 — dropped there a moment ago and dragged to the same place
		// again. Counting its own rank as occupied would make the second gesture refuse for
		// a collision with nobody, which is the shape this check is most likely to get wrong.
		const list = ranked(-990, 10, 10);
		const [z, , b1] = list;
		expect(dropPlacement(z, { parent: null, peers: [b1], insertIndex: 0 }, list)).toEqual({
			order: -990,
		});
	});

	it('counts a context row: a rank is taken whoever is allowed to write it', () => {
		// C(-990) is a row the Base excluded — ranked, on screen, unwritable. A'(10) and
		// A(10) tie at the drop site, so the fallback opens and prepends one spacing below
		// the first peer: -990, which is C's.
		//
		// Both answers describe a dead end, so the question is which. ACCEPTING writes the
		// collision: every later placement at this site then refuses `tied` forever, and the
		// duplicate is latent — if C's filter membership flips (a `hide done` filter
		// switched off, the note edited back into the results) two WRITABLE rows hold -990
		// and the focused view silently drops to tree order. REFUSING merely declines one
		// gesture, which the user recovers from by dropping elsewhere.
		//
		// Stated no wider than measured: a writable/context tie does not break focused
		// ordering TODAY, because `inRankOrder` reads distinctness off the writable rows
		// alone. The harm is the permanent local refusal and the latent duplicate, not an
		// immediate drop to tree order.
		const list = [contextRow(-990), ...ranked(10, 10, 20, 30)];
		const [, , a, b, z] = list;
		expect(dropPlacement(z, { parent: null, peers: [a, b], insertIndex: 0 }, list)).toEqual({
			refusal: 'tied',
		});
	});
});
