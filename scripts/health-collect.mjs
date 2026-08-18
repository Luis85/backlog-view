import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";

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
export function rank({ hotspots = [], topCount = 0, caps = [], coverage = [], debt = [] }) {
	const rows = [];
	// Fallow's `hotspots` array is every file it ranked, not every file that IS one:
	// this repository's `hotspot_count` is 0 across 104 entries. `hotspot_top_pct_count`
	// is fallow's own answer to how many of them qualify, so that is what is read.
	for (const h of [...hotspots].sort((a, b) => b.score - a.score).slice(0, topCount)) {
		rows.push({
			band: h.trend === "accelerating" ? "high" : "medium",
			title: h.actions?.[0]?.description ?? `Review ${h.path}`,
			where: h.path,
			// The trend is a FIELD on the row now, set for every source below that can know
			// it — so saying it here too would be the page saying one thing twice.
			why: `hotspot score ${h.score}`,
			source: "fallow",
			sort: h.score,
		});
	}
	for (const c of caps) {
		const left = c.cap - c.counted;
		// A file at half its cap is not a thing to act on, and a row for every capped
		// file buries the eight that are close in three hundred that are not.
		if (c.counted / c.cap < 0.9) continue;
		rows.push({
			band: left <= 20 ? "high" : "medium",
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
	// Bugs only. An open ISSUE in this register is frequently a recorded decision or a
	// limitation waiting on evidence — the `Codebase health` Epic says so of its own —
	// so the 46 of them are a section to read, not 46 things to do next.
	for (const d of debt.filter((x) => x.kind === "bug")) {
		rows.push({
			band: "high",
			title: d.title,
			where: d.path,
			why: `open ${d.kind}`,
			source: "docs",
			sort: 0,
		});
	}
	// Fallow's direction, on every row it can be known for. The word, never a slope: it is
	// computed from the commit history, so it is not the trend line a one-snapshot axis
	// cannot honestly draw.
	const trendOf = new Map(hotspots.map((h) => [h.path, h.trend]));
	return rows
		.map((r) => (trendOf.has(r.where) ? { ...r, trend: trendOf.get(r.where) } : r))
		.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band) || b.sort - a.sort);
}

// ------------------------------------------------------------------- the collectors

const run = promisify(execFile);
const ROOT = process.cwd();

const COVERAGE_FILE = "coverage/coverage-final.json";
const FALLOW = path.join("node_modules", "fallow", "bin", "fallow");

/**
 * Everything fallow emits, in one pass. Its non-zero exit is this script's failure.
 *
 * The `--coverage` override is what keeps "coverage absent" a reported state rather
 * than a dead report. `.fallowrc.json` points fallow's health analysis at
 * `coverage/coverage-final.json`, and with that file missing fallow exits 2 —
 * "failed to read coverage file" — so the vital signs, the hotspots and every finding
 * would be lost to a missing file none of them need. There is no `--no-coverage`, so
 * the substitute is an empty istanbul map: CRAP scores degrade, and nothing else does.
 */
async function collectFallow(coveragePresent) {
	const args = ["--format", "json", "--quiet"];
	if (!coveragePresent) {
		await mkdir(".health", { recursive: true });
		await writeFile(".health/empty-coverage.json", "{}");
		args.push("--coverage", ".health/empty-coverage.json");
	}
	// Fallow's own Node shim, run by the node already running this — not `npx`, and not
	// the platform binary. Both alternatives were tried and both are Windows traps:
	// `npx` resolves to `npx.cmd`, which Node 24 refuses to spawn without a shell
	// (EINVAL) and deprecates spawning WITH one, and `@fallow-cli/win32-x64-msvc` is one
	// platform's package name out of however many CI runs. The shim picks the binary.
	const { stdout } = await run(process.execPath, [FALLOW, ...args], {
		cwd: ROOT,
		maxBuffer: 32 * 1024 * 1024,
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
		overrideConfig: [
			{
				files: ["**/*.ts"],
				languageOptions: { parser: tsParser },
				rules: { "max-lines": ["error", { max: 0, skipBlankLines: true, skipComments: true }] },
			},
		],
	});
	const results = await eslint.lintFiles(["src/**/*.ts", "test/**/*.ts"]);
	const caps = [];
	for (const result of results) {
		const message = result.messages.find((m) => m.ruleId === "max-lines");
		const counted = message && /\((\d+)\)/.exec(message.message)?.[1];
		if (!counted) continue;
		const repoPath = toRepoPath(result.filePath, ROOT);
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
		raw = JSON.parse(await readFile(COVERAGE_FILE, "utf8"));
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

/**
 * The layer-to-layer import graph, which is the one thing the combined JSON cannot say.
 *
 * `fan_in` and `fan_out` are COUNTS: they answer how many edges touch a file and never
 * which files are at the other end, so no arrangement of them can show whether `domain`
 * imports `view`. `fallow viz --viz-format dot` emits the real graph — 1549 edges here —
 * as node declarations carrying the path and plain `nA -> nB` lines, which is cheap to
 * read and stable enough to depend on.
 *
 * It costs a second fallow run. That is the price of the only picture in this report that
 * can falsify an architectural claim, and `npm run health` is not in the gate.
 */
async function collectGraph() {
	const out = path.join(".health", "graph.dot");
	await mkdir(".health", { recursive: true });
	await run(process.execPath, [FALLOW, "viz", "--viz-format", "dot", "--no-open", "--out", out, "--quiet"], {
		cwd: ROOT,
		maxBuffer: 32 * 1024 * 1024,
	});
	const dot = await readFile(out, "utf8");
	const layerByNode = new Map();
	for (const [, node, label] of dot.matchAll(/(n\d+) \[label="([^"]+)"/g)) {
		const layer = layerOf(label.split("\\").join("/"));
		if (layer) layerByNode.set(node, layer);
	}
	const edges = new Map();
	for (const [, from, to] of dot.matchAll(/(n\d+) -> (n\d+)/g)) {
		const a = layerByNode.get(from);
		const b = layerByNode.get(to);
		if (!a || !b) continue;
		const key = `${a}\u0000${b}`;
		edges.set(key, (edges.get(key) ?? 0) + 1);
	}
	return [...edges].map(([key, count]) => {
		const [from, to] = key.split("\u0000");
		return { from, to, count };
	});
}

/**
 * The commit this report describes, so a reader can tell what it is a report OF.
 *
 * A static page cannot know whether the tree moved after it was written, so it must not
 * claim to. What it can do is name the commit and whether the tree was dirty at the time,
 * and let the reader compare. Failing softly is right: a report is still useful outside a
 * git checkout.
 */
async function collectCommit() {
	try {
		const { stdout: head } = await run("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT });
		const { stdout: status } = await run("git", ["status", "--porcelain"], { cwd: ROOT });
		return { head: head.trim(), dirty: status.trim().length > 0 };
	} catch {
		return { head: null, dirty: null };
	}
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
	// Coverage is resolved first: whether its file exists decides how fallow is invoked.
	const coverage = await collectCoverage();
	const [fallow, caps, debt, graph, commit] = await Promise.all([
		collectFallow(coverage.present),
		collectCaps(),
		collectDebt(),
		collectGraph(),
		collectCommit(),
	]);
	const thin = coverage.present ? coverage.files.filter((f) => layerOf(f.path) && f.statements < 90) : [];
	const report = {
		generated: new Date().toISOString(),
		root: ROOT,
		commit,
		graph,
		fallow,
		coverage,
		caps,
		debt,
		layers: rollup(fallow.fileScores, coverage),
		actions: rank({
			hotspots: fallow.hotspots,
			topCount: fallow.vitalSigns.hotspot_top_pct_count,
			caps,
			coverage: thin,
			debt,
		}),
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
