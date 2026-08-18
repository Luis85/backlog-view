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
