import { describe, expect, it } from 'vitest';
import { floorReport, readFloors, totals } from '../../scripts/coverage-floors.mjs';

/**
 * The pure half of `npm run test:coverage`'s second step, asked directly — the same
 * shape `test/health/healthCollect.test.ts` uses for `npm run health`, and for the same
 * reason: these three functions take a value and return one, so the test that would have
 * cost a subprocess costs a call.
 *
 * The CLI half is not tested. It reads two files and prints what these three answer; a
 * test of `readFile` would be a test of Node.
 */

describe('totals', () => {
	/**
	 * A v8 `coverage-final.json` in miniature. Two statements on ONE line is the shape the
	 * line count exists for — `a && b()` on one line is two statements — and the whole
	 * reason lines cannot be counted as statements are.
	 */
	const coverage = {
		'/repo/src/one.ts': {
			statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 1 } }, 2: { start: { line: 4 } } },
			s: { 0: 3, 1: 0, 2: 0 },
			fnMap: { 0: {} },
			f: { 0: 7 },
			branchMap: { 0: {} },
			b: { 0: [2, 0] },
		},
	};

	it('counts each metric as v8 reports it, and a line as covered when any statement on it is', () => {
		expect(totals(coverage)).toEqual({
			statements: [1, 3],
			branches: [1, 2],
			functions: [1, 1],
			// Line 1 carries a covered statement and an uncovered one, and is covered; line 4
			// carries one uncovered statement and is not. Counting statements would answer
			// 1/3 here and disagree with the reporter the floor is set from.
			lines: [1, 2],
		});
	});

	it('reads a file that carries no map for a metric as contributing nothing to it', () => {
		// Not defensiveness: v8 emits no `branchMap` for a module with no branch in it, and a
		// crash on the first such file would make this gate the flakiest thing in the run.
		expect(totals({ '/repo/src/flat.ts': { statementMap: {}, s: {} } })).toEqual({
			statements: [0, 0],
			branches: [0, 0],
			functions: [0, 0],
			lines: [0, 0],
		});
	});
});

describe('floorReport', () => {
	/** One metric's measurement, so each case below states only what it is about. */
	const measured = (covered: number, total: number) => ({
		statements: [covered, total],
		branches: [0, 0],
		functions: [0, 0],
		lines: [0, 0],
	});

	it('counts headroom in covered UNITS, not in percentage points', () => {
		// 99/100 is 99%, and losing one gives 98% — one unit of headroom against a 98 floor
		// and none against 98.5. A hundredth of a percent says nothing without the
		// denominator, which is the whole reason this gate counts units.
		const [loose] = floorReport(measured(99, 100), { statements: 98 });
		expect(loose.headroom).toBe(1);
		expect(loose.tight).toBe(false);

		const [tight] = floorReport(measured(99, 100), { statements: 98.5 });
		expect(tight.headroom).toBe(0);
		expect(tight.tight).toBe(true);
	});

	it('reports the headroom a floor actually has, not merely whether it has any', () => {
		// Two units: 97/100 clears a 97 floor and 96/100 does not. The figure is what tells
		// a floor set with room from one that happens to clear by a rounding accident.
		expect(floorReport(measured(99, 100), { statements: 97 })[0].headroom).toBe(2);
	});

	it('does not call a knowingly tight floor a failure, while still reporting it as tight', () => {
		// `functions` is pinned with no headroom on purpose — the alternative is a DECREASE,
		// and a floor may not fall. The gate has to say so rather than either failing every
		// run or hiding the fragility.
		const [row] = floorReport({ ...measured(0, 0), functions: [99, 100] }, { functions: 98.5 });
		expect(row.headroom).toBe(0);
		expect(row.tight).toBe(false);
	});

	it('is not fooled by a floor a fully covered tree still clears', () => {
		// Everything covered, and the floor still has to survive losing one: 100/100 against
		// a 99.5 floor is tight, because 99/100 fails it. A gate that read "100%" as safe
		// would pass exactly the floor that breaks on the next run.
		expect(floorReport(measured(100, 100), { statements: 99.5 })[0].tight).toBe(true);
		expect(floorReport(measured(100, 100), { statements: 98 })[0].tight).toBe(false);
	});
});

describe('readFloors', () => {
	it('reads the four numbers out of the config rather than repeating them here', () => {
		// A second copy of the floors in this file is a fifth place for them to drift, which
		// is the defect the whole gate exists about.
		const source = `
			coverage: {
				thresholds: {
					statements: 99.04,
					branches: 95.72,
					functions: 99.92,
					lines: 99.78,
				},
			},
		`;
		expect(readFloors(source)).toEqual({ statements: 99.04, branches: 95.72, functions: 99.92, lines: 99.78 });
	});

	it('refuses a config it could not read rather than reporting floors of zero', () => {
		// The failure this prevents: a thresholds block moved or renamed, read as "no floors
		// at all", and every metric passing a gate that is measuring nothing.
		expect(() => readFloors('export default {}')).toThrow(/no thresholds block/);
		expect(() => readFloors('thresholds: { statements: 99.04 }')).toThrow(/branches, functions, lines/);
	});
});
