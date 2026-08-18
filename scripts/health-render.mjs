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
	.act { list-style: none; margin: 0 0 var(--size-4-8); padding: 0; }
	.act li { display: grid; grid-template-columns: 3px 1fr auto; gap: var(--size-4-2);
	          align-items: baseline; padding: var(--size-4-1) 0;
	          border-bottom: 1px solid var(--background-modifier-border); }
	.act .rail { align-self: stretch; border-radius: var(--radius-s); background: var(--text-faint); }
	.act .high .rail { background: var(--text-error); }
	.act .medium .rail { background: rgb(var(--color-orange-rgb)); }
	.act .where { color: var(--text-muted); font-size: var(--font-ui-smaller); }
	.act a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--background-modifier-border); }
	/* The --text-accent token is NOT in the vendored app.css -- DESIGN.md declares it, the
	   reduced stub does not define it, and a hover that reads it changes nothing.
	   Measured 2026-08-18: it is the ONLY token this page names that fails to
	   resolve. The affordance is the underline instead, which needs no new token. */
	.act a:hover { border-bottom-color: var(--text-normal); }
	.chip { background: var(--background-secondary); color: var(--text-muted);
	        font-size: var(--font-ui-smaller); font-weight: var(--font-medium);
	        border-radius: var(--radius-s); padding: 0 var(--size-4-1); }
	.clear { color: var(--text-muted); padding: var(--size-4-4) 0; }
	details { border-top: 1px solid var(--background-modifier-border); padding: var(--size-4-2) 0; }
	summary { cursor: pointer; font-weight: var(--font-medium); color: var(--text-normal); }
	summary .count { color: var(--text-muted); font-weight: normal; }
	h3 { font-size: var(--font-ui-small); font-weight: var(--font-medium);
	     margin: var(--size-4-4) 0 0; }
	table { border-collapse: collapse; width: 100%; margin-top: var(--size-4-2); }
	th, td { text-align: left; padding: var(--size-2-1) var(--size-4-1);
	         border-bottom: 1px solid var(--background-modifier-border); }
	th { color: var(--text-muted); font-size: var(--font-ui-smaller);
	     font-weight: var(--font-medium); cursor: pointer; user-select: none; }
	td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
	.wide { overflow-x: auto; }
	.empty { color: var(--text-muted); padding: var(--size-4-2) 0; }
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

/**
 * The first value that is actually there, or the em dash.
 *
 * Extracted because a chain of `??` fallbacks is a branch each, and nothing in
 * `scripts/` carries coverage: `vitest.config.mts` includes only `src/**`, so fallow
 * estimates these functions at its lowest coverage tier and CRAP is then
 * `cyclomatic² + cyclomatic`. That crosses the configured threshold of 30 at a
 * cyclomatic of 5 — which is low, and is the budget every function in this directory
 * is working inside. Written inline, this one scored 42.
 */
const firstOf = (...values) => values.find((v) => v !== null && v !== undefined) ?? "—";

const cell = (value, numeric) =>
	`<td${numeric ? ' class="num"' : ""}>${value === null || value === undefined ? "—" : escape(value)}</td>`;

const table = (headings, rows) => `<div class="wide"><table>
	<thead><tr>${headings.map((h) => `<th class="${h.num ? "num" : ""}">${escape(h.label)}</th>`).join("")}</tr></thead>
	<tbody>${rows.map((r) => `<tr>${r.map((v, i) => cell(v, headings[i].num)).join("")}</tr>`).join("")}</tbody>
</table></div>`;

const section = (title, count, body) =>
	`<details><summary>${escape(title)} <span class="count">${escape(count)}</span></summary>${body}</details>`;

function architecture(report) {
	const headings = [
		{ label: "layer" },
		{ label: "files", num: true },
		{ label: "lines", num: true },
		{ label: "statements %", num: true },
		{ label: "maintainability", num: true },
		{ label: "fan-in", num: true },
		{ label: "fan-out", num: true },
	];
	const rows = report.layers.map((l) => [l.layer, l.files, l.lines, l.statements, l.avgMaintainability, l.fanIn, l.fanOut]);
	return section("Architecture", `${report.layers.length} layers`, table(headings, rows));
}

function modules(report) {
	const cap = new Map(report.caps.map((c) => [c.path, c]));
	const cov = new Map((report.coverage.files ?? []).map((f) => [f.path, f]));
	const headings = [
		{ label: "module" },
		{ label: "layer" },
		{ label: "lines / cap", num: true },
		{ label: "statements %", num: true },
		{ label: "maintainability", num: true },
		{ label: "cyclomatic", num: true },
		{ label: "fan-in", num: true },
		{ label: "fan-out", num: true },
	];
	// `layerOf` is imported from the collector rather than restated here. Two spellings
	// of the layer map is how the modules table and the architecture rollup start
	// disagreeing about which layer a file is in.
	const rows = report.fallow.fileScores
		.filter((s) => layerOf(s.path))
		.map((s) => {
			const c = cap.get(s.path);
			return [
				s.path,
				layerOf(s.path),
				c ? `${c.counted} / ${c.cap}` : "—",
				cov.get(s.path)?.statements ?? null,
				s.maintainability_index,
				s.total_cyclomatic,
				s.fan_in,
				s.fan_out,
			];
		});
	return section("Modules", `${rows.length} files`, table(headings, rows));
}

function debt(report) {
	if (report.debt.length === 0) {
		return section("Debt", "0 open", `<p class="empty">Nothing open in docs/bugs or docs/issues.</p>`);
	}
	const rows = report.debt.map((d) => [d.kind, d.title, d.path]);
	return section(
		"Debt",
		`${report.debt.length} open`,
		table([{ label: "kind" }, { label: "title" }, { label: "note" }], rows),
	);
}

function findings(report) {
	const nonZero = report.fallow.findings.filter((f) => f.count > 0);
	const zero = report.fallow.findings.filter((f) => f.count === 0);
	const detail = nonZero.map((f) => {
		const rows = f.items.map((i) => [firstOf(i.path, i.package_name), i.line, firstOf(i.actions?.[0]?.description)]);
		return (
			`<h3>${escape(f.key)} <span class="count">${escape(f.count)}</span></h3>` +
			table([{ label: "where" }, { label: "line", num: true }, { label: "suggested action" }], rows)
		);
	});
	// The zero counters collapse rather than disappear: it must stay visible that they
	// ran, or a check quietly dropped from fallow reads the same as a check that passed.
	const allClear = `<p class="empty">${zero.length} other check(s) reported nothing: ${escape(zero.map((f) => f.key).join(", "))}.</p>`;
	const schema =
		report.fallow.schemaVersion === 7
			? ""
			: `<p class="empty">Fallow's schema is version ${escape(report.fallow.schemaVersion)}, not the 7 this report was written against. Its shape may have changed.</p>`;
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
				.sort((a, b) => numeric
					? dir * ((parseFloat(value(a)) || 0) - (parseFloat(value(b)) || 0))
					: dir * value(a).localeCompare(value(b)))
				.forEach((row) => body.appendChild(row));
		}));
	});
`;

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
${architecture(report)}
${modules(report)}
${debt(report)}
${findings(report)}
</main>
<script>${SORT_SCRIPT}</script>
</body>
</html>`;
}

// CLI entry only, for the same reason and in the same shape as the collector's guard.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = JSON.parse(await readFile(".health/report.json", "utf8"));
	await writeFile(".health/report.html", page(report));
	console.log(`✓ .health/report.html — open it at ${path.resolve(".health/report.html")}`);
}
