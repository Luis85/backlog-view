import { describe, expect, it } from 'vitest';
import { exactDifference, exactSum } from '../../src/domain/decimal';

/**
 * The exact arithmetic behind the capacity comparison. Every case here is one the plain
 * float operators get wrong, so each assertion is written against the operator it replaced
 * as well as against the right answer — a test that only stated the answer would still pass
 * against `a + b` for half of them.
 */
describe('exact decimal sums', () => {
	it('adds what the notes say rather than what a double can hold', () => {
		expect(0.1 + 0.2).not.toBe(0.3);
		expect(exactSum([0.1, 0.2])).toBe(0.3);
	});

	it('sums nothing to zero and one value to itself', () => {
		expect(exactSum([])).toBe(0);
		expect(exactSum([52.1])).toBe(52.1);
	});

	it('carries a value the naive decimal method loses, because it scales in BigInt', () => {
		// The trap this module's header names. Scaling both terms by `1e16` to clear their
		// fractions is exact for each of them separately, and their SUM needs a seventeenth
		// digit no double has — so a decimal method built on doubles answers `1` where the
		// true total is `0.9999999999999999`, reporting a release that is short as exactly
		// full. Stated as the arithmetic rather than as a screen.
		expect((0.5 * 1e16 + 0.4999999999999999 * 1e16) / 1e16).toBe(1);
		expect(exactSum([0.5, 0.4999999999999999])).toBe(0.9999999999999999);
	});

	it('reads a value in exponent form rather than refusing it', () => {
		// `String(1e21)` is `"1e+21"` and `String(5e-324)` is `"5e-324"` — digits at neither
		// end, which is why the parser reads an exponent instead of assuming plain notation.
		expect(String(1e21)).toBe('1e+21');
		expect(exactSum([1e21, 1])).toBe(1e21 + 1);
		expect(exactSum([5e-324, 5e-324])).toBe(1e-323);
		expect(exactDifference(1e21, 1e20)).toBe(9e20);
	});

	it('still overflows to an unreadable total rather than hiding one', () => {
		// The guard in `effortFigures` reads `Number.isFinite`, so exactness must not turn a
		// sum past `Number.MAX_VALUE` into a finite-looking figure.
		expect(Number.isFinite(exactSum([1e308, 1e308]))).toBe(false);
	});

	it('falls back to plain addition for a non-finite value rather than refusing to answer', () => {
		expect(exactSum([1, Infinity])).toBe(Infinity);
		expect(Number.isNaN(exactSum([1, NaN]))).toBe(true);
	});

	it('keeps the sign of a negative term', () => {
		expect(exactSum([-0.3, 0.1])).toBe(-0.2);
	});
});

describe('exact decimal differences', () => {
	it('subtracts without the operator own float garbage', () => {
		expect(52.1 - 40).toBe(12.100000000000001);
		expect(exactDifference(52.1, 40)).toBe(12.1);
	});

	it('reports a real difference of two at the top of the range', () => {
		expect(exactDifference(10000000000000002, 10000000000000000)).toBe(2);
	});

	it('reports a real difference no rounding to twelve significant digits survives', () => {
		// The second heuristic this module replaced: `Number((1000000000001).toPrecision(12))`
		// is `1000000000000`, an answer off by one on a difference a double represents exactly.
		expect(Number((1000000000001).toPrecision(12))).toBe(1000000000000);
		expect(exactDifference(1000000000002, 1)).toBe(1000000000001);
	});

	it('reports a shortfall no additions tolerance survives', () => {
		// The first heuristic: a difference this small was zeroed as summation noise, which is
		// exactly the size of a real shortfall at a capacity of one.
		expect(exactDifference(0.9999999999999999, 1)).toBe(-1e-16);
	});

	it('reads an exactly filled release as exactly zero', () => {
		expect(exactSum([0.1, 0.2]) - 0.3).toBe(0);
		expect(exactDifference(exactSum([0.1, 0.2]), 0.3)).toBe(0);
		// Never `-0`: the renderer branches on `over >= 0`, which is true for both, but a
		// formatted `-0` would draw a minus sign on a release that is exactly full.
		expect(Object.is(exactDifference(0.3, 0.3), 0)).toBe(true);
	});

	it('falls back to plain subtraction for a non-finite operand', () => {
		expect(exactDifference(Infinity, 40)).toBe(Infinity);
		expect(Number.isNaN(exactDifference(NaN, 40))).toBe(true);
	});
});
