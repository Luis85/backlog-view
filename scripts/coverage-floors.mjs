import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * The rule `vitest.config.mts` states in prose and nothing checked: **a floor is set below
 * the ONE-FEWER figure, not to the measurement.**
 *
 * Coverage here moves by one covered unit between runs on an unchanged tree — reproduced
 * four times and recorded in
 * `docs/issues/The coverage figure is not reproducible to a hundredth.md` — so a floor
 * pinned to what a run measured is a gate that fails on the next run with nothing to fix.
 * That has happened: a branches floor of 94.93, one unit below a 4792 measurement, failed
 * on the 4791 run. The config comment has since restated the arithmetic seven times, by
 * hand, on every raise. Restating a rule is not checking it, and the register has the
 * defect class open under exactly that name.
 *
 * So this runs the arithmetic instead of narrating it, right after the coverage run that
 * produced the figure. It answers one question per metric: **how many covered units can
 * this tree lose before the floor fails?** Under one, and the floor is pinned to a sample.
 *
 * What it deliberately does NOT do is re-check the floors themselves — vitest already
 * fails the run for that, and a second opinion on the same comparison would only be a
 * place for the two to disagree. The totals below are computed the same way vitest's v8
 * reporter computes them, verified against a full run: 10137/10232 statements,
 * 6353/6634 branches, 2598/2600 functions and 8429/8445 lines on 2026-08-29.
 *
 * **It does not see the failure that prompted it, and saying so is the point.** `main`
 * went red on 2026-08-29 because one branch raised a floor against a tree that a second
 * branch's code was not yet in. Every floor there held a covered unit of headroom on the
 * branch that set it. No check that runs on a tree can see a merge that has not happened
 * yet — that one is GitHub's "Require branches to be up to date before merging", a
 * repository setting, and `docs/issues/Two spec branches predate the use-case gate.md`
 * carries it.
 */

/**
 * The metrics knowingly pinned with no headroom, and why each one is.
 *
 * A name here is a decision to keep a fragile floor rather than an exemption to forget:
 * the alternative for `functions` is a DECREASE — one fewer is 99.8846 against the 99.92
 * standing — and a floor may not fall. So it is named and watched instead of quietly
 * lowered, which is the same ruling the config comment made when it first arrived at this
 * case. If functions ever flakes the way branches has, this is the entry to revisit.
 */
const KNOWINGLY_TIGHT = new Set(["functions"]);

/**
 * Covered and total for each metric, from a v8 `coverage-final.json`. Three are stored
 * outright; lines are derived — see `lineHits`.
 */
export function totals(coverage) {
	const sum = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
	for (const file of Object.values(coverage)) {
		tally(sum.statements, Object.values(file.s ?? {}));
		tally(sum.functions, Object.values(file.f ?? {}));
		tally(sum.branches, Object.values(file.b ?? {}).flat());
		tally(sum.lines, lineHits(file));
	}
	return sum;
}

/** One metric's `[covered, total]`, advanced by a run of hit counts. */
function tally(pair, hits) {
	for (const hit of hits) {
		pair[1] += 1;
		if (hit > 0) pair[0] += 1;
	}
}

/**
 * A hit count per LINE. v8 stores statements, and `a && b()` on one line is two of them,
 * so a line is covered when any statement starting on it is — counting statements instead
 * would answer a different number from the reporter the floors are set from.
 */
function lineHits(file) {
	const lines = new Map();
	for (const [id, loc] of Object.entries(file.statementMap ?? {})) {
		const line = loc.start.line;
		lines.set(line, Math.max(lines.get(line) ?? 0, file.s[id]));
	}
	return lines.values();
}

/**
 * One row per metric: what it measures, what it must clear, and how many covered units it
 * may lose while still clearing it.
 *
 * `headroom` counts UNITS rather than percentage points on purpose. A hundredth of a
 * percent means nothing without the denominator — it is 0.66 of a branch here and was 2.2
 * of one when this suite was a third of its size — and the flake this guards against moves
 * in units, not in points.
 */
export function floorReport(measured, floors) {
	return Object.entries(floors).map(([metric, floor]) => {
		const [covered, total] = measured[metric];
		let headroom = 0;
		while (covered - headroom - 1 >= 0 && ((covered - headroom - 1) / total) * 100 >= floor) headroom += 1;
		return {
			metric,
			covered,
			total,
			percent: (covered / total) * 100,
			floor,
			headroom,
			tight: headroom < 1 && !KNOWINGLY_TIGHT.has(metric),
		};
	});
}

/** The four numbers in the `thresholds` block, read from the config rather than repeated. */
export function readFloors(configSource) {
	const block = /thresholds:\s*\{([^}]*)\}/.exec(configSource);
	if (!block) throw new Error("vitest.config.mts has no thresholds block");
	const floors = {};
	for (const [, metric, value] of block[1].matchAll(/(\w+)\s*:\s*([\d.]+)/g)) floors[metric] = Number(value);
	const missing = ["statements", "branches", "functions", "lines"].filter((m) => !(m in floors));
	if (missing.length > 0) throw new Error(`thresholds block names no ${missing.join(", ")}`);
	return floors;
}

async function main() {
	const measured = totals(JSON.parse(await readFile("coverage/coverage-final.json", "utf8")));
	const rows = floorReport(measured, readFloors(await readFile("vitest.config.mts", "utf8")));

	for (const row of rows) {
		const note = KNOWINGLY_TIGHT.has(row.metric) && row.headroom < 1 ? " (knowingly tight)" : "";
		const units = `${row.headroom} unit${row.headroom === 1 ? "" : "s"} of headroom`;
		console.log(`  ${row.metric.padEnd(11)} ${row.covered}/${row.total} = ${row.percent.toFixed(4)}% over a ${row.floor} floor — ${units}${note}`);
	}

	const tight = rows.filter((row) => row.tight);
	if (tight.length === 0) {
		console.log("✓ every coverage floor holds a covered unit of headroom");
		return;
	}

	console.error("\nA coverage floor is pinned to a sample:\n");
	for (const row of tight) {
		const oneFewer = ((row.covered - 1) / row.total) * 100;
		console.error(`  ${row.metric}: losing one covered unit gives ${oneFewer.toFixed(4)}%, under the ${row.floor} floor.`);
		console.error(`    Cover one more, or — if the floor was raised against a tree this one is not — say so here.`);
	}
	console.error("\nThis suite moves by one covered unit between runs on an unchanged tree, so a floor");
	console.error("with no unit of headroom fails on a green tree. See the comment in vitest.config.mts.");
	process.exitCode = 1;
}

// CLI entry only, so `test/verification/coverageFloors.test.ts` can import the three pure
// functions above without reading `coverage/` — which on a `vitest run` with no
// `--coverage` is a file that may not be there at all. Guarded on the real path rather
// than by comparing `import.meta.url`, which breaks on Windows; same shape as
// `scripts/health-collect.mjs`.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
