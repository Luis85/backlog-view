import { describe, expect, it } from 'vitest';
import { anchoredOrder, ORDER_SPACING, orderForTarget } from '../../src/domain/writePlan';
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
