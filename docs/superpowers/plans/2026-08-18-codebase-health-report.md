# Codebase health report — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run health` writes `.health/report.json` and `.health/report.html` — one page that aggregates fallow, coverage, this repository's line caps and its `docs/` debt register, and ranks what to act on.

**Architecture:** Two scripts, mirroring the existing `docs-check.mjs` / `docs-markdown.mjs` split. `scripts/health-collect.mjs` runs four collectors and writes the JSON; `scripts/health-render.mjs` reads that JSON and writes the HTML. The JSON is a boundary, not a by-product: an agent reads it, and only the renderer knows HTML exists. Pure functions live in the collector and are exported for the test — verified safe against fallow, which counts a test file as a consumer (`fallow dead-code --trace scripts/changelog-notes.mjs:changelogNotes` reports `test\release\changelogNotes.test.ts` as a direct reference).

**Tech Stack:** Node ESM (`.mjs`), no new dependencies. Reads `fallow` via `execFile`, ESLint via its Node API, `vitest.config.mts` via native type stripping. Tests are vitest, importing the `.mjs` directly — the pattern `test/docs/markdown.test.ts` already uses.

The full design, with the evidence behind each decision, is
`docs/superpowers/specs/2026-08-18-codebase-health-report-design.md`. Read it before Task 1.

## Global Constraints

- **No new dependencies.** Everything used is already installed: `eslint`, `@typescript-eslint/parser`, `fallow`, `vitest`.
- **Node ≥ 22.18** for `await import('./vitest.config.mts')`. It fails loudly on older 22.x; no fallback.
- **Never added to `npm run check`.** It is a report, not a gate.
- **All five `npm run check` steps must still pass** after every task: `npm run build && npm run lint && npm run test:coverage && npm run analyze && npm run docs`.
- **Coverage thresholds only ever go up**, and never move in this work: `scripts/` is outside `vitest.config.mts`'s `coverage.include: ['src/**/*.ts']`, so nothing here changes a coverage figure. If a threshold moves, something is wrong.
- **`docs-check.mjs` rule 7 covers `src/` only**, so no register note is required for these scripts; Task 5 adds one anyway because this repository tracks its work in its own schema.
- **Sentence-case UI text** everywhere on the page — marketplace rule, and the register's voice.
- **Colour comes only from Obsidian tokens.** No hex, `rgb()`, `hsl()` or named colour literal in the page's CSS. Green is never "good".
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Another session shares this checkout.** Stage explicit paths; never `git add docs/` or `git add -A`.

---

## File structure

| File | Responsibility |
| --- | --- |
| Create `scripts/health-collect.mjs` | Four collectors → one JSON object → `.health/report.json`. Exports the pure functions the test drives. |
| Create `scripts/health-render.mjs` | `.health/report.json` → `.health/report.html`. Knows about markup and nothing about tools. |
| Create `test/health/healthCollect.test.ts` | Drives the pure functions against fixture payloads. New directory, matching `test/docs/` and `test/release/`. |
| Modify `package.json` | `"health"` script naming both files, which also makes both fallow entry points. |
| Modify `.gitignore` | `.health/`, beside the existing `.harness/`. |
| Create `docs/requirements/One page for what the tools already know.md` | The register note: a PBI under the `Codebase health` Epic. |

---

## Task 1: The pure core

Everything that turns a tool's output into a report row, with no I/O. This is the only
part with non-trivial logic, so it is the only part with a test.

**Files:**
- Create: `scripts/health-collect.mjs`
- Create: `test/health/healthCollect.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all named exports of `scripts/health-collect.mjs`:
  - `toRepoPath(absolute: string, root: string) → string` — forward-slashed, repo-relative.
  - `layerOf(repoPath: string) → string | null` — one of `domain`, `storage`, `view`, `commands`, `ui`, `i18n`, `main`, or `null`.
  - `capFor(repoPath: string) → number | null` — 400, 450, 400, or `null`.
  - `coverageRatios(entry: object) → {statements: number, branches: number, functions: number}` — percentages, 0–100, one decimal.
  - `rank(sources: {hotspots, caps, coverage, debt}) → Array<{band, title, where, why, source, sort}>` — the ranked list.

- [ ] **Step 1: Write the failing test**

Create `test/health/healthCollect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { capFor, coverageRatios, layerOf, rank, toRepoPath } from '../../scripts/health-collect.mjs';

describe('toRepoPath', () => {
	it('makes a Windows absolute path repo-relative and forward-slashed', () => {
		// The shape coverage-final.json actually holds on Windows, measured 2026-08-18.
		expect(toRepoPath('C:\\Projects\\backlog-view\\src\\commands\\readme.ts', 'C:\\Projects\\backlog-view'))
			.toBe('src/commands/readme.ts');
	});

	it('does the same on a POSIX path, because CI runs both', () => {
		expect(toRepoPath('/home/runner/work/bv/src/domain/model.ts', '/home/runner/work/bv'))
			.toBe('src/domain/model.ts');
	});
});

describe('layerOf', () => {
	it('names each layer of the architecture', () => {
		expect(layerOf('src/domain/model.ts')).toBe('domain');
		expect(layerOf('src/storage/frontmatter.ts')).toBe('storage');
		expect(layerOf('src/view/backlogView.ts')).toBe('view');
		expect(layerOf('src/commands/readme.ts')).toBe('commands');
	});

	it('names the two leaves, which are layers in the guide but not in the ladder', () => {
		expect(layerOf('src/ui/prompts.ts')).toBe('ui');
		expect(layerOf('src/i18n/en.ts')).toBe('i18n');
	});

	it('gives main.ts its own name rather than folding it into a layer', () => {
		// It is the only place anything is registered with Obsidian, and it is excluded
		// from coverage — a rollup that hid it inside `view` would misreport both.
		expect(layerOf('src/main.ts')).toBe('main');
	});

	it('answers null outside src/, so a script never lands in a layer rollup', () => {
		expect(layerOf('scripts/docs-check.mjs')).toBeNull();
		expect(layerOf('test/view/rendering.test.ts')).toBeNull();
	});
});

describe('capFor', () => {
	it('gives each tree the cap eslint.config.mjs actually sets for it', () => {
		expect(capFor('src/view/backlogView.ts')).toBe(400);
		expect(capFor('test/view/rendering.test.ts')).toBe(450);
		expect(capFor('styles/badges.css')).toBe(400);
	});

	it('answers null where no cap exists, rather than guessing one', () => {
		// .mjs is uncapped: max-lines is scoped to **/*.ts.
		expect(capFor('scripts/health-collect.mjs')).toBeNull();
		expect(capFor('docs/README.md')).toBeNull();
	});
});

describe('coverageRatios', () => {
	it('turns an istanbul entry into three percentages', () => {
		const entry = {
			s: { 0: 1, 1: 1, 2: 0, 3: 1 },
			f: { 0: 1, 1: 0 },
			b: { 0: [1, 0], 1: [1, 1] },
		};
		expect(coverageRatios(entry)).toEqual({ statements: 75, branches: 75, functions: 50 });
	});

	it('reports a file with nothing to cover as fully covered, not as NaN', () => {
		// 0/0 is the empty-module case, and a NaN reaches the page as "NaN%".
		expect(coverageRatios({ s: {}, f: {}, b: {} })).toEqual({ statements: 100, branches: 100, functions: 100 });
	});
});

describe('rank', () => {
	const sources = {
		hotspots: [
			{ path: 'src/view/hot.ts', score: 45.5, trend: 'heating', actions: [{ description: 'Refactor `src/view/hot.ts`' }] },
			{ path: 'src/view/cool.ts', score: 12.0, trend: 'cooling', actions: [{ description: 'Add tests' }] },
		],
		caps: [{ path: 'src/view/big.ts', counted: 385, cap: 400 }],
		coverage: [{ path: 'src/view/thin.ts', statements: 71.2 }],
		debt: [
			{ path: 'docs/bugs/A real bug.md', title: 'A real bug', kind: 'bug' },
			{ path: 'docs/issues/An open question.md', title: 'An open question', kind: 'issue' },
		],
	};

	it('puts a bug, a near-cap file and a heating hotspot in the high band', () => {
		const high = rank(sources).filter((r) => r.band === 'high').map((r) => r.where);
		expect(high).toContain('docs/bugs/A real bug.md');
		expect(high).toContain('src/view/big.ts');
		expect(high).toContain('src/view/hot.ts');
	});

	it('puts a cooling hotspot, a thin module and an open issue in the medium band', () => {
		const medium = rank(sources).filter((r) => r.band === 'medium').map((r) => r.where);
		expect(medium).toEqual(expect.arrayContaining(['src/view/cool.ts', 'src/view/thin.ts', 'docs/issues/An open question.md']));
	});

	it('sorts high before medium, whatever order the sources arrive in', () => {
		const bands = rank(sources).map((r) => r.band);
		expect(bands).toEqual([...bands].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)));
	});

	it('names the tool behind every row, because no number here is comparable to another', () => {
		// The whole point of the band rule is that it can be taken apart. A row whose
		// source is unnamed is the opaque score the register refuses.
		for (const row of rank(sources)) expect(row.source).toBeTruthy();
	});

	it('returns nothing at all when there is nothing to act on', () => {
		expect(rank({ hotspots: [], caps: [], coverage: [], debt: [] })).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and watch every case fail**

```bash
npx vitest run test/health/healthCollect.test.ts
```

Expected: FAIL — `Failed to load ../../scripts/health-collect.mjs`, because the file does not exist yet.

- [ ] **Step 3: Write the pure core**

Create `scripts/health-collect.mjs` with exactly this much for now:

```js
import path from "node:path";

/**
 * The pure half of `npm run health` — everything that turns a tool's output into a
 * report row, with no I/O, so `test/health/healthCollect.test.ts` can ask it directly
 * rather than driving a subprocess the way the docs checker's tests must.
 *
 * The collectors below it are deliberately thin: each one reads a file or runs a tool
 * and hands the result to a function here.
 */

/** Repo-relative and forward-slashed, from either platform's absolute path. */
export function toRepoPath(absolute, root) {
	return path.relative(root, absolute).split(path.sep).join("/");
}

/**
 * `main.ts` is its own answer rather than part of `view`: it is the only place anything
 * is registered with Obsidian, and it is the one file `vitest.config.mts` excludes from
 * coverage, so folding it into a layer would misreport that layer twice over.
 */
export function layerOf(repoPath) {
	if (repoPath === "src/main.ts") return "main";
	const match = /^src\/([^/]+)\//.exec(repoPath);
	if (!match) return null;
	const layers = ["domain", "storage", "view", "commands", "ui", "i18n"];
	return layers.includes(match[1]) ? match[1] : null;
}

/** The caps `eslint.config.mjs` sets. `.mjs` and everything else is uncapped. */
export function capFor(repoPath) {
	if (/^src\/.+\.ts$/.test(repoPath)) return 400;
	if (/^test\/.+\.ts$/.test(repoPath)) return 450;
	if (/^styles\/.+\.css$/.test(repoPath)) return 400;
	return null;
}

const ratio = (covered, total) => (total === 0 ? 100 : Math.round((covered / total) * 1000) / 10);

/** One istanbul entry to three percentages. A file with nothing to cover is covered. */
export function coverageRatios(entry) {
	const statements = Object.values(entry.s ?? {});
	const functions = Object.values(entry.f ?? {});
	const branches = Object.values(entry.b ?? {}).flat();
	return {
		statements: ratio(statements.filter((n) => n > 0).length, statements.length),
		branches: ratio(branches.filter((n) => n > 0).length, branches.length),
		functions: ratio(functions.filter((n) => n > 0).length, functions.length),
	};
}

const BANDS = ["high", "medium", "low"];

/**
 * One ranked list out of four incomparable sources.
 *
 * Each row carries its band, the rule that assigned it and the number behind it, so the
 * reader can disagree with the RULE rather than with a total. That is the whole reason
 * there is no score here: `docs/requirements/A health score that can be argued with`
 * states the register's position — a score that cannot be taken apart is the single
 * opaque number it keeps refusing — and adding numbers from four tools together would
 * be exactly that number.
 *
 * Sorting is by band, then by each source's OWN figure descending. Figures from
 * different sources are never added, and never compared across a band boundary.
 */
export function rank({ hotspots = [], caps = [], coverage = [], debt = [] }) {
	const rows = [];
	for (const h of hotspots) {
		rows.push({
			band: h.trend === "heating" ? "high" : "medium",
			title: h.actions?.[0]?.description ?? `Review ${h.path}`,
			where: h.path,
			why: `hotspot score ${h.score}, ${h.trend}`,
			source: "fallow",
			sort: h.score,
		});
	}
	for (const c of caps) {
		const left = c.cap - c.counted;
		rows.push({
			band: left <= 20 ? "high" : "low",
			title: `${c.path} is ${left} lines from its ${c.cap}-line cap`,
			where: c.path,
			why: `${c.counted} counted lines`,
			source: "eslint",
			sort: c.counted,
		});
	}
	for (const m of coverage) {
		rows.push({
			band: m.statements < 90 ? "medium" : "low",
			title: `${m.path} is thinly covered`,
			where: m.path,
			why: `${m.statements}% of statements`,
			source: "vitest",
			sort: 100 - m.statements,
		});
	}
	for (const d of debt) {
		rows.push({
			band: d.kind === "bug" ? "high" : "medium",
			title: d.title,
			where: d.path,
			why: `open ${d.kind}`,
			source: "docs",
			sort: 0,
		});
	}
	return rows.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band) || b.sort - a.sort);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run test/health/healthCollect.test.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Prove the tests can fail**

The repository's rule is that an asserted invariant is watched failing, not assumed to
hold. Break each of these three, run the test, see red, restore:

1. In `layerOf`, delete the `main.ts` line → the `main.ts` case fails.
2. In `ratio`, change `total === 0 ? 100` to `covered / total` → the empty-module case fails with `NaN`.
3. In `rank`, drop the `|| b.sort - a.sort` tiebreak → the band-ordering case still passes, which tells you it does not cover ordering *within* a band. That is a real limit of the test and it is deliberate: within-band order is a presentation choice, not an invariant.

- [ ] **Step 6: Confirm the gate is unmoved**

```bash
npm run lint && npm run analyze
```

Expected: both clean. `analyze` in particular must still report `unused_exports: 0` — the five exports are consumed by the test, which fallow counts as a consumer.

- [ ] **Step 7: Commit**

```bash
git add scripts/health-collect.mjs test/health/healthCollect.test.ts
git commit -m "Add the pure core of the health report

Five functions with no I/O: repo-relative paths, the layer map, the line
caps, istanbul ratios, and the ranked list. The list carries its band, its
rule and its number on every row, because a total nobody can take apart is
the opaque score the register refuses.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The four collectors and the JSON

**Files:**
- Modify: `scripts/health-collect.mjs` (append the collectors and a `main()`)
- Modify: `package.json` (add the `health` script)
- Modify: `.gitignore` (add `.health/`)

**Interfaces:**
- Consumes: every export from Task 1.
- Produces: `.health/report.json`, with exactly this top-level shape, which Task 3 and Task 4 read:

```
{
  generated: string,          // ISO timestamp
  root: string,               // absolute repo root
  fallow: { schemaVersion, version, vitalSigns, fileScores, hotspots, dupes, findings },
  coverage: { present: boolean, thresholds, totals, files } | { present: false, reason },
  caps: [{ path, counted, cap }],
  debt: [{ path, title, kind, status }],
  layers: [{ layer, files, lines, statements, avgMaintainability, fanIn, fanOut }],
  actions: [ ...rank() rows ]
}
```

- [ ] **Step 1: Append the collectors**

Add to `scripts/health-collect.mjs`:

```js
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";

const run = promisify(execFile);
const ROOT = process.cwd();

/** Everything fallow emits, in one pass. Its non-zero exit is this script's failure. */
async function collectFallow() {
	const { stdout } = await run("npx", ["fallow", "--format", "json", "--quiet"], {
		cwd: ROOT,
		maxBuffer: 32 * 1024 * 1024,
		shell: process.platform === "win32",
	});
	const j = JSON.parse(stdout);
	const findings = Object.entries(j.check.summary)
		.filter(([key]) => key !== "total_issues")
		.map(([key, count]) => ({ key, count, items: Array.isArray(j.check[key]) ? j.check[key] : [] }));
	return {
		schemaVersion: j.schema_version,
		version: j.version,
		vitalSigns: j.health.vital_signs,
		fileScores: j.health.file_scores,
		hotspots: j.health.hotspots,
		dupes: j.dupes.stats,
		findings,
	};
}

/**
 * ESLint's OWN counter, never a raw line count.
 *
 * `max-lines` is configured with `skipBlankLines` and `skipComments`, and this
 * repository comments heavily: `src/view/backlogView.ts` is 569 raw lines and lint
 * counts 310 of them against the 400 cap. Fallow's `file_scores[].lines` is a raw count
 * too. Reporting either as headroom would put a false alarm on the hero section.
 *
 * The throwaway config is deliberate — `overrideConfigFile: true` ignores the project's
 * own, which is type-aware and slow, and `max: 0` makes every file report so the count
 * can be read out of the message. Because it is lint's counter, this number cannot
 * drift from the number the gate enforces.
 */
async function collectCaps() {
	const eslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [{
			files: ["**/*.ts"],
			languageOptions: { parser: tsParser },
			rules: { "max-lines": ["error", { max: 0, skipBlankLines: true, skipComments: true }] },
		}],
	});
	const results = await eslint.lintFiles(["src/**/*.ts", "test/**/*.ts"]);
	const caps = [];
	for (const r of results) {
		const message = r.messages.find((m) => m.ruleId === "max-lines");
		const counted = message && /\((\d+)\)/.exec(message.message)?.[1];
		if (!counted) continue;
		const repoPath = toRepoPath(r.filePath, ROOT);
		const cap = capFor(repoPath);
		if (cap) caps.push({ path: repoPath, counted: Number(counted), cap });
	}
	return caps.sort((a, b) => b.counted / b.cap - a.counted / a.cap);
}

/**
 * Coverage is optional. Its absence is a reported state, never a guess and never a crash.
 *
 * `lines` is deliberately absent from the totals. `coverage-final.json` carries statement,
 * function and branch maps and no line map, and deriving lines from `statementMap` would
 * be an approximation of istanbul's own definition rather than the figure the threshold
 * gates. The page shows the floor and says the file cannot answer it — a narrowed sentence
 * beats a number that looks measured.
 */
async function collectCoverage() {
	let raw;
	try {
		raw = JSON.parse(await readFile("coverage/coverage-final.json", "utf8"));
	} catch {
		return { present: false, reason: "No coverage/coverage-final.json. Run `npm run test:coverage`." };
	}
	// Resolved from the WORKING DIRECTORY, which is the rule every script here follows —
	// a bare relative specifier would resolve against this file instead.
	const { default: config } = await import(pathToFileURL(path.resolve("vitest.config.mts")).href);
	const files = Object.entries(raw).map(([absolute, entry]) => ({
		path: toRepoPath(absolute, ROOT),
		...coverageRatios(entry),
	}));
	const pool = { s: {}, f: {}, b: {} };
	let n = 0;
	for (const entry of Object.values(raw)) {
		for (const key of ["s", "f", "b"]) {
			for (const value of Object.values(entry[key] ?? {})) pool[key][n++] = value;
		}
	}
	return { present: true, thresholds: config.test.coverage.thresholds, totals: coverageRatios(pool), files };
}

/** The human-written debt: what is open in the register's own two folders. */
async function collectDebt() {
	const debt = [];
	for (const kind of ["bug", "issue"]) {
		const dir = `docs/${kind}s`;
		for (const name of await readdir(dir)) {
			if (!name.endsWith(".md") || name === "README.md") continue;
			const text = await readFile(`${dir}/${name}`, "utf8");
			const status = /^status:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "";
			if (status !== "Open") continue;
			debt.push({ path: `${dir}/${name}`, title: name.replace(/\.md$/, ""), kind, status });
		}
	}
	return debt;
}

/** The per-layer rollup, which is the one view of this data nothing else offers. */
function rollup(fileScores, coverage) {
	const byLayer = new Map();
	for (const score of fileScores) {
		const layer = layerOf(score.path);
		if (!layer) continue;
		const acc = byLayer.get(layer) ?? { layer, files: 0, lines: 0, fanIn: 0, fanOut: 0, mi: [], statements: [] };
		acc.files += 1;
		acc.lines += score.lines;
		acc.fanIn += score.fan_in;
		acc.fanOut += score.fan_out;
		acc.mi.push(score.maintainability_index);
		const covered = coverage.present && coverage.files.find((f) => f.path === score.path);
		if (covered) acc.statements.push(covered.statements);
		byLayer.set(layer, acc);
	}
	const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
	return [...byLayer.values()].map(({ mi, statements, ...rest }) => ({
		...rest,
		avgMaintainability: mean(mi),
		statements: mean(statements),
	}));
}

async function main() {
	const [fallow, caps, coverage, debt] = await Promise.all([
		collectFallow(), collectCaps(), collectCoverage(), collectDebt(),
	]);
	const thin = coverage.present
		? coverage.files.filter((f) => layerOf(f.path) && f.statements < 90)
		: [];
	const report = {
		generated: new Date().toISOString(),
		root: ROOT,
		fallow,
		coverage,
		caps,
		debt,
		layers: rollup(fallow.fileScores, coverage),
		actions: rank({ hotspots: fallow.hotspots, caps, coverage: thin, debt }),
	};
	await mkdir(".health", { recursive: true });
	await writeFile(".health/report.json", JSON.stringify(report, null, "\t"));
	console.log(`✓ .health/report.json — ${report.actions.length} thing(s) to act on`);
}

// CLI entry only. `test/health/healthCollect.test.ts` imports this module for its pure
// exports, and without this guard that import would shell fallow, run ESLint and write
// `.health/` on every test run. Guarded on the real path rather than by comparing
// `import.meta.url` directly, which breaks on Windows — `file:///C:/...` never equals
// argv's `C:\...`. Same shape as `scripts/changelog-notes.mjs`.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
```

- [ ] **Step 2: Wire the script and the gitignore**

In `package.json`, add after the `"docs"` line:

```json
    "health": "node scripts/health-collect.mjs && node scripts/health-render.mjs",
```

In `.gitignore`, add under the `.harness/` entry:

```
# the report `npm run health` writes
.health/
```

- [ ] **Step 3: Run the collector on its own**

`health-render.mjs` does not exist yet, so run only the first half:

```bash
node scripts/health-collect.mjs
```

Expected: `✓ .health/report.json — N thing(s) to act on`.

- [ ] **Step 4: Check the JSON against what the tools actually said**

```bash
node -e "const r=require('./.health/report.json'); console.log('schema', r.fallow.schemaVersion, '| layers', r.layers.map(l=>l.layer).join(','), '| caps', r.caps.length, '| debt', r.debt.length, '| coverage', r.coverage.present, '| actions', r.actions.length)"
```

Expected: `schema 7`, all seven layer names present (`main` included), a non-empty `caps`, `coverage true` if you have run the suite, and `actions` matching the line the script printed.

Then confirm the caps number is lint's and not a raw count:

```bash
node -e "const r=require('./.health/report.json'); const f=r.caps.find(c=>c.path==='src/view/backlogView.ts'); console.log(f)" && wc -l src/view/backlogView.ts
```

Expected: `counted` around 310 with `cap: 400`, against a raw count around 569. If `counted` is the raw number, the throwaway ESLint config is not being used.

- [ ] **Step 5: Confirm the gate is unmoved**

```bash
npm run check
```

Expected: all five steps pass. `analyze` must still show `unused_files: 0` — `package.json` naming both scripts is what keeps them entry points, so a typo in the `health` script shows up here as a dead file.

- [ ] **Step 6: Commit**

```bash
git add scripts/health-collect.mjs package.json .gitignore
git commit -m "Collect the health report's four sources into one JSON

fallow in one pass, coverage where the suite left it, the docs register's
open notes, and the line caps read from ESLint's own counter rather than
from a raw line count -- backlogView.ts is 569 raw lines and 310 counted
ones against a 400 cap, so a raw count would put a false alarm on the hero.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The page above the fold

The header, the vital-signs strip and the ranked list — everything the first viewport
must answer. The disclosure sections are Task 4.

**Files:**
- Create: `scripts/health-render.mjs`

**Interfaces:**
- Consumes: `.health/report.json` as written by Task 2.
- Produces: `.health/report.html`, and the named exports `page(report) → string` and `escape(text) → string`, which Task 4 extends.

- [ ] **Step 1: Write the renderer**

Create `scripts/health-render.mjs`:

```js
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { layerOf } from "./health-collect.mjs";

/**
 * `.health/report.json` → `.health/report.html`. This file knows about markup and
 * nothing about tools; everything it renders was decided by `health-collect.mjs`.
 *
 * **The page owns its layout and borrows only its colours.** It links
 * `test/harness/obsidian.css` — Obsidian's real app.css, already vendored for the
 * harness — so every colour, size step and radius is the product's own token in the
 * reader's own scheme, and this file introduces no palette. But that stylesheet is
 * REDUCED to the rules the harness exercises, so an element the plugin's markup never
 * uses may have nothing at all: a disclosure control shipped looking right in the
 * harness and wrong in a vault on 2026-08-08 for exactly that reason. Every box, table
 * and disclosure here writes its own layout.
 *
 * **Health is the absence of colour.** DESIGN.md: "A screen with no problems on it is
 * monochrome apart from its badges." There are no green gauges here, because green
 * means done in this system and never "good". A clean codebase renders grey, and every
 * spot of colour is a thing to act on.
 */

export const escape = (text) =>
	String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CSS = `
	body { background: var(--background-primary); color: var(--text-normal);
	       font-size: var(--font-ui-small); line-height: 1.4; margin: 0;
	       padding: var(--size-4-8) var(--size-4-4); }
	main { max-width: 1100px; margin-inline: auto; }
	h1 { font-size: var(--font-ui-large); font-weight: var(--font-medium); margin: 0 0 var(--size-2-2); }
	.answer { color: var(--text-muted); margin: 0 0 var(--size-4-8); }
	.signs { display: flex; flex-wrap: wrap; gap: var(--size-4-4);
	         border-block: 1px solid var(--background-modifier-border);
	         padding-block: var(--size-4-2); margin-bottom: var(--size-4-8); }
	.sign { display: flex; flex-direction: column; gap: var(--size-2-1); }
	.sign dt { color: var(--text-muted); font-size: var(--font-ui-smaller); font-weight: var(--font-medium); }
	.sign dd { margin: 0; font-variant-numeric: tabular-nums; }
	.stale { border-bottom: 1px dashed var(--text-faint); color: var(--text-muted); }
	.act { list-style: none; margin: 0; padding: 0; }
	.act li { display: grid; grid-template-columns: 4px 1fr auto; gap: var(--size-4-2);
	          align-items: baseline; padding: var(--size-4-1) 0;
	          border-bottom: 1px solid var(--background-modifier-border); }
	.act .rail { align-self: stretch; border-radius: var(--radius-s); background: var(--text-faint); }
	.act .high .rail { background: var(--text-error); }
	.act .medium .rail { background: rgb(var(--color-orange-rgb)); }
	.act .where { color: var(--text-muted); font-size: var(--font-ui-smaller); }
	.act a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--background-modifier-border); }
	.act a:hover { color: var(--text-accent); }
	.chip { background: var(--background-secondary); color: var(--text-muted);
	        font-size: var(--font-ui-smaller); font-weight: var(--font-medium);
	        border-radius: var(--radius-s); padding: 0 var(--size-4-1); }
	.clear { color: var(--text-muted); padding: var(--size-4-4) 0; }
`;

const sign = (label, value, stale) =>
	`<div class="sign"><dt>${escape(label)}</dt><dd${stale ? ' class="stale"' : ""}>${escape(value)}</dd></div>`;

function signs(report) {
	const v = report.fallow.vitalSigns;
	const c = report.coverage;
	const out = [
		sign("maintainability", v.maintainability_avg),
		sign("cyclomatic, mean", v.avg_cyclomatic),
		sign("cyclomatic, p90", v.p90_cyclomatic),
		sign("dead code", `${v.dead_file_pct}%`),
		sign("duplication", `${report.fallow.dupes.duplication_percentage.toFixed(2)}%`),
		sign("fan-in, p95", v.p95_fan_in),
	];
	// Dashed means present but not asserted -- the idiom this product already uses in
	// eight places. Absent coverage is shown, not hidden and not zeroed. `lines` is
	// always dashed: coverage-final.json carries no line map, so only its floor is known.
	for (const key of ["statements", "branches", "functions"]) {
		const measured = c.present ? `${c.totals[key]}% / ${c.thresholds[key]}` : "not measured";
		out.push(sign(key, measured, !c.present));
	}
	out.push(sign("lines", c.present ? `floor ${c.thresholds.lines}` : "not measured", true));
	return `<dl class="signs">${out.join("")}</dl>`;
}

function actions(report) {
	if (report.actions.length === 0) {
		return `<p class="clear">Nothing to act on. Every tool ran and found no work.</p>`;
	}
	const rows = report.actions.map((row) => {
		const target = path.join(report.root, row.where).split(path.sep).join("/");
		return `<li class="${escape(row.band)}"><span class="rail"></span>
			<span><a href="vscode://file/${escape(target)}">${escape(row.title)}</a>
			<br><span class="where">${escape(row.where)} — ${escape(row.why)}</span></span>
			<span class="chip">${escape(row.source)}</span></li>`;
	});
	return `<ul class="act">${rows.join("")}</ul>`;
}

export function page(report) {
	const clean = report.fallow.fileScores.length - report.actions.length;
	return `<!doctype html>
<html lang="en" class="theme-light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codebase health</title>
<link rel="stylesheet" href="../test/harness/obsidian.css">
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Codebase health</h1>
<p class="answer">${report.actions.length} thing(s) to act on, ${clean} module(s) clean.
Generated ${escape(report.generated)} from fallow ${escape(report.fallow.version)}.</p>
${signs(report)}
${actions(report)}
</main>
</body>
</html>`;
}

// CLI entry only, for the same reason and in the same shape as the collector's guard.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = JSON.parse(await readFile(".health/report.json", "utf8"));
	await writeFile(".health/report.html", page(report));
	console.log(`✓ .health/report.html — open it at ${path.resolve(".health/report.html")}`);
}
```

- [ ] **Step 2: Generate and look at it**

```bash
npm run health
```

Expected: both lines print. Open `.health/report.html` in a browser.

- [ ] **Step 3: Check the four things a screenshot cannot**

1. **No literal colour.** `grep -nE "#[0-9a-fA-F]{3,8}|rgb\(|hsl\(" scripts/health-render.mjs` must return nothing but the `rgb(var(--color-orange-rgb))` line, which is a token read, not a literal.
2. **Tokens resolve.** In the browser console: `getComputedStyle(document.body).backgroundColor` must not be `rgba(0, 0, 0, 0)`. If it is, the relative path to `obsidian.css` is wrong.
3. **Dark scheme.** Change `class="theme-light"` to `class="theme-dark"` in the generated file and reload. Everything must stay legible. Restore afterwards.
4. **The hero fits.** At 1440×900 the ranked list's first rows must be visible without scrolling.

- [ ] **Step 4: Confirm the gate is unmoved**

```bash
npm run check
```

Expected: all five pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/health-render.mjs
git commit -m "Render the health report's first viewport

Header, vital-signs strip and the ranked list. Colour comes from the
vendored Obsidian app.css and the page writes its own layout on top,
because that stylesheet is reduced and leaning on it for layout is the
2026-08-08 defect. Absent coverage renders dashed rather than zeroed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The disclosure sections

Architecture, modules, debt and all findings — closed by default, so 157 module rows
never compete with the three rows that matter.

**Files:**
- Modify: `scripts/health-render.mjs`

**Interfaces:**
- Consumes: `page(report)` and `escape(text)` from Task 3.
- Produces: nothing new; extends the page.

- [ ] **Step 1: Add the sections**

Append to `CSS` in `scripts/health-render.mjs`:

```js
const CSS_SECTIONS = `
	details { border-top: 1px solid var(--background-modifier-border); padding: var(--size-4-2) 0; }
	summary { cursor: pointer; font-weight: var(--font-medium); color: var(--text-normal); }
	summary .count { color: var(--text-muted); font-weight: normal; }
	table { border-collapse: collapse; width: 100%; margin-top: var(--size-4-2); }
	th, td { text-align: left; padding: var(--size-2-1) var(--size-4-1);
	         border-bottom: 1px solid var(--background-modifier-border); }
	th { color: var(--text-muted); font-size: var(--font-ui-smaller); font-weight: var(--font-medium);
	     cursor: pointer; user-select: none; }
	td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
	.wide { overflow-x: auto; }
	.empty { color: var(--text-muted); padding: var(--size-4-2) 0; }
`;
```

Then add these functions above `page`:

```js
const cell = (value, numeric) =>
	`<td${numeric ? ' class="num"' : ""}>${value === null || value === undefined ? "—" : escape(value)}</td>`;

const table = (headings, rows) => `<div class="wide"><table>
	<thead><tr>${headings.map((h) => `<th class="${h.num ? "num" : ""}">${escape(h.label)}</th>`).join("")}</tr></thead>
	<tbody>${rows.map((r) => `<tr>${r.map((v, i) => cell(v, headings[i].num)).join("")}</tr>`).join("")}</tbody>
</table></div>`;

const section = (title, count, body) =>
	`<details><summary>${escape(title)} <span class="count">${count}</span></summary>${body}</details>`;

function architecture(report) {
	const headings = [
		{ label: "layer" }, { label: "files", num: true }, { label: "lines", num: true },
		{ label: "statements %", num: true }, { label: "maintainability", num: true },
		{ label: "fan-in", num: true }, { label: "fan-out", num: true },
	];
	const rows = report.layers.map((l) => [l.layer, l.files, l.lines, l.statements, l.avgMaintainability, l.fanIn, l.fanOut]);
	return section("Architecture", `${report.layers.length} layers`, table(headings, rows));
}

function modules(report) {
	const cap = new Map(report.caps.map((c) => [c.path, c]));
	const cov = new Map((report.coverage.files ?? []).map((f) => [f.path, f]));
	const headings = [
		{ label: "module" }, { label: "layer" }, { label: "lines / cap", num: true },
		{ label: "statements %", num: true }, { label: "maintainability", num: true },
		{ label: "cyclomatic", num: true }, { label: "fan-in", num: true }, { label: "fan-out", num: true },
	];
	// `layerOf` is imported from the collector rather than restated here. Two spellings of
	// the layer map is how the modules table and the architecture rollup start disagreeing
	// about which layer a file is in.
	const rows = report.fallow.fileScores
		.filter((s) => layerOf(s.path))
		.map((s) => {
			const c = cap.get(s.path);
			return [
				s.path, layerOf(s.path), c ? `${c.counted} / ${c.cap}` : "—",
				cov.get(s.path)?.statements ?? null, s.maintainability_index,
				s.total_cyclomatic, s.fan_in, s.fan_out,
			];
		});
	return section("Modules", `${rows.length} files`, table(headings, rows));
}

function debt(report) {
	if (report.debt.length === 0) return section("Debt", "0 open", `<p class="empty">Nothing open in docs/bugs or docs/issues.</p>`);
	const rows = report.debt.map((d) => [d.kind, d.title, d.path]);
	return section("Debt", `${report.debt.length} open`,
		table([{ label: "kind" }, { label: "title" }, { label: "note" }], rows));
}

function findings(report) {
	const nonZero = report.fallow.findings.filter((f) => f.count > 0);
	const zero = report.fallow.findings.filter((f) => f.count === 0);
	const detail = nonZero.map((f) => {
		const rows = f.items.map((i) => [i.path ?? i.package_name ?? "—", i.line ?? null, i.actions?.[0]?.description ?? "—"]);
		return `<h3>${escape(f.key)} <span class="count">${f.count}</span></h3>` +
			table([{ label: "where" }, { label: "line", num: true }, { label: "suggested action" }], rows);
	});
	const allClear = `<p class="empty">${zero.length} other check(s) reported nothing: ${escape(zero.map((f) => f.key).join(", "))}.</p>`;
	const schema = report.fallow.schemaVersion === 7 ? "" :
		`<p class="empty">Fallow's schema is version ${escape(report.fallow.schemaVersion)}, not the 7 this report was written against. Its shape may have changed.</p>`;
	return section("All findings", `${nonZero.length} non-zero`, schema + detail.join("") + allClear);
}

const SORT_SCRIPT = `
	document.querySelectorAll('table').forEach((t) => {
		t.querySelectorAll('th').forEach((th, i) => th.addEventListener('click', () => {
			const body = t.tBodies[0];
			const dir = th.dataset.dir === 'asc' ? -1 : 1;
			t.querySelectorAll('th').forEach((o) => delete o.dataset.dir);
			th.dataset.dir = dir === 1 ? 'asc' : 'desc';
			const value = (row) => row.cells[i].textContent.trim();
			const numeric = th.classList.contains('num');
			[...body.rows]
				.sort((a, b) => numeric ? dir * (parseFloat(value(a)) - parseFloat(value(b))) : dir * value(a).localeCompare(value(b)))
				.forEach((row) => body.appendChild(row));
		}));
	});
`;
```

- [ ] **Step 2: Wire them into `page`**

Set the layer lookup before rendering, and add the sections and the script. Replace the
`page` function's body so it reads:

```js
export function page(report) {
	const clean = report.fallow.fileScores.length - report.actions.length;
	return `<!doctype html>
<html lang="en" class="theme-light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codebase health</title>
<link rel="stylesheet" href="../test/harness/obsidian.css">
<style>${CSS}${CSS_SECTIONS}</style>
</head>
<body>
<main>
<h1>Codebase health</h1>
<p class="answer">${report.actions.length} thing(s) to act on, ${clean} module(s) clean.
Generated ${escape(report.generated)} from fallow ${escape(report.fallow.version)}.</p>
${signs(report)}
${actions(report)}
${architecture(report)}
${modules(report)}
${debt(report)}
${findings(report)}
</main>
<script>${SORT_SCRIPT}</script>
</body>
</html>`;
}
```

- [ ] **Step 3: Generate and check the four states**

```bash
npm run health
```

Then confirm each state reads well:

1. **Normal.** All four sections closed. Click each open; the modules table sorts on a header click, numerically on the right-aligned columns.
2. **Coverage absent.** `mv coverage coverage.bak && npm run health` — the coverage figures render dashed and say "not measured", the modules table shows `—` in its statements column, and nothing shows `NaN`. Restore with `mv coverage.bak coverage`.
3. **Nothing to act on.** Temporarily add `report.actions = []` before the `page` call, regenerate, and confirm the "Nothing to act on" line reads as deliberate rather than broken. Remove it.
4. **Schema drift.** Temporarily set `report.fallow.schemaVersion = 8`, regenerate, and confirm the warning appears in "All findings". Remove it.

- [ ] **Step 4: Confirm the gate is unmoved**

```bash
npm run check
```

Expected: all five pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/health-render.mjs
git commit -m "Add the health report's four disclosure sections

Architecture, modules, debt and findings, closed by default so 157 module
rows never compete with the three rows that matter. Native details, so the
only script on the page is the table sort. Fallow's zero counters collapse
to one line rather than disappearing, and a schema other than 7 says so.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: The register note

**Files:**
- Create: `docs/requirements/One page for what the tools already know.md`

- [ ] **Step 1: Read the Epic and its children**

```bash
cat "docs/requirements/Codebase health.md"
grep -l 'parent: "\[\[Codebase health\]\]"' docs/requirements/*.md | xargs grep -H "^order:"
```

Note the highest sibling `order` — the new note takes the next step above it.

- [ ] **Step 2: Write the note with the skill that knows the schema**

Invoke `adding-backlog-items`. It owns the frontmatter vocabulary, the hierarchy rules
and the sibling ordering that `docs-check.mjs` enforces; hand-writing the frontmatter is
how a note ends up failing `npm run docs`.

The note is a **PBI** under `Codebase health`, and its content is the outcome, not the
implementation: what a person can now see that they could not before, and the four
sources it puts on one page. It must name `scripts/health-collect.mjs` and
`scripts/health-render.mjs` in a `## Where it lives` section.

- [ ] **Step 3: Run the register gate**

```bash
npm run docs
```

Expected: `✓ register and ADRs consistent`. A failure here names the exact rule; fix the
note, not the checker.

- [ ] **Step 4: Commit**

```bash
git add "docs/requirements/One page for what the tools already know.md"
git commit -m "Record the health report in the register

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Closing check

```bash
npm run check && npm run health
```

All five gate steps pass, and the report generates. Then open `.health/report.html` once
more and confirm the first viewport still answers "what do I do next?" — that was the
whole point, and it is the thing four tasks of detail can quietly erode.

**Owed and not closeable here:** the page has never been opened next to a real Obsidian
vault. `test/harness/obsidian.css` is Obsidian's default palette, so a themed vault's
colours are unanswerable in this repository — as they are for the harness. Say so rather
than calling the appearance verified.
