import { describe, expect, it } from 'vitest';
import { anchoredOrder, ORDER_SPACING } from '../../src/domain/writePlan';
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

	it('keeps a midpoint distinct from both neighbours past four decimals', () => {
		// Gap 0.00003 clears MIN_GAP (0.000002), so this subdivides. The true
		// midpoint (1000.000015) needs six decimals to survive rounding — at four
		// it collapses onto `prev`, a silent duplicate rather than a new rank.
		const list = ranked(1000, 1000.00003);
		const result = anchoredOrder(list, list[0], 'after');
		expect(result).toEqual({ order: 1000.000015 });
	});
});
