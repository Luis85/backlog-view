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
	/* app.css is an APPLICATION SHELL, and inlining it brings the shell's behaviour along
	   with its colours. Obsidian's body deliberately does not scroll, deliberately cannot
	   be selected, and is deliberately size-contained — all correct for a window and all
	   wrong for a document. Four declarations have to be taken back, and this rule wins
	   because it is equal specificity and later.

	   contain: strict is the one that is not guessable from the symptom. Size containment
	   makes the body's height independent of its contents, so the page collapsed to its
	   padding — 64px holding 25 rows — and reported itself as not scrollable rather than
	   as clipped. app.css undoes these same four in its own @media print block, which is
	   the confirmation that this is the document-shaped set rather than a hunch.

	   The set is bounded and was counted rather than guessed: of app.css's rules, exactly
	   eleven have a bare-element selector able to match a page carrying no Obsidian
	   classes — ten on the body element, one on the a element, which .act a outranks. */
	body { background: var(--background-primary); color: var(--text-normal);
	       font-size: var(--font-ui-small); line-height: 1.4; margin: 0;
	       padding: var(--size-4-8) var(--size-4-4);
	       overflow: visible; height: auto; width: auto; contain: none;
	       user-select: text; -webkit-user-select: text; }
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
	.risk { margin-bottom: var(--size-4-8); }
	.risk-label, .risk-legend { color: var(--text-muted); font-size: var(--font-ui-smaller); }
	.risk-label { font-weight: var(--font-medium); margin-bottom: var(--size-2-2); }
	.risk-legend { font-variant-numeric: tabular-nums; margin-top: var(--size-2-2); }
	.bar { display: flex; gap: 2px; height: 14px; }
	.seg { border-radius: var(--radius-s); }
	/* Low risk is NOT green. Green means done in this system, never good. */
	.seg-low { background: var(--background-modifier-border); }
	.seg-medium { background: var(--text-faint); }
	.seg-high { background: rgb(var(--color-orange-rgb)); }
	.seg-very_high { background: var(--text-error); }
	/* The two views. Only one is in the document flow at a time; the switch is a class on
	   body rather than per-element hidden attributes, so nothing has to be kept in step. */
	nav { display: flex; gap: var(--size-2-2); margin-bottom: var(--size-4-8); }
	nav button { background: var(--background-secondary); color: var(--text-muted);
	             border: 1px solid var(--background-modifier-border);
	             border-radius: var(--radius-s); cursor: pointer;
	             font-family: inherit; font-size: var(--font-ui-smaller);
	             font-weight: var(--font-medium);
	             padding: var(--size-2-1) var(--size-4-2); }
	nav button:hover { border-color: var(--background-modifier-border-hover);
	                   color: var(--text-normal); }
	nav button[aria-pressed="true"] { background: var(--background-primary);
	                                  color: var(--text-normal);
	                                  border-color: var(--text-muted); }
	body.show-dashboard #tables, body.show-tables #dashboard { display: none; }
	.filter { display: block; width: 100%; box-sizing: border-box;
	          background: var(--background-primary); color: var(--text-normal);
	          border: 1px solid var(--background-modifier-border);
	          border-radius: var(--radius-s); font-family: inherit;
	          font-size: var(--font-ui-small); margin-bottom: var(--size-4-4);
	          padding: var(--size-2-2) var(--size-4-2); }
	.filter:focus { outline: none; border-color: var(--text-muted); }
	.group { margin-bottom: var(--size-4-8); }
	.group > h2 { border-bottom: 1px solid var(--background-modifier-border);
	              font-size: var(--font-ui-medium); font-weight: var(--font-medium);
	              margin: 0 0 var(--size-4-2); padding-bottom: var(--size-2-2); }
	.group[data-matches="0"] { display: none; }
	.count { color: var(--text-muted); font-weight: normal; }
	tr[hidden] { display: none; }
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

/**
 * The unit-size risk profile, and the only bar on the page.
 *
 * Four proportions are a shape rather than a number, and the shape is the point: what
 * matters is how much of the tree sits in the two right-hand bands, which a reader sees
 * at a glance and could not get from four percentages in the strip above. Everything
 * else in the vital signs is one figure and stays one figure.
 *
 * It obeys the same colour rule as the rest of the page. Low risk is not green, because
 * green means done here; it is the muted neutral, and only the two risky bands spend a
 * colour at all.
 */
function riskBar(report) {
	const p = report.fallow.vitalSigns.unit_size_profile;
	const bands = [
		{ key: "low_risk", label: "low" },
		{ key: "medium_risk", label: "medium" },
		{ key: "high_risk", label: "high" },
		{ key: "very_high_risk", label: "very high" },
	];
	const parts = bands
		.filter((b) => p[b.key] > 0)
		.map(
			(b) =>
				`<span class="seg seg-${b.key.replace("_risk", "")}" style="flex: ${p[b.key]}"
				  title="${escape(b.label)} risk: ${escape(p[b.key])}%"></span>`,
		);
	const legend = bands.map((b) => `${escape(b.label)} ${escape(p[b.key])}%`).join(" · ");
	return `<div class="risk"><div class="risk-label">unit size, by risk</div>
		<div class="bar">${parts.join("")}</div>
		<div class="risk-legend">${legend}</div></div>`;
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

/**
 * One titled group in the tables view.
 *
 * `data-matches` is what the filter writes and the stylesheet reads, so a section whose
 * every row is filtered out removes itself rather than leaving a heading over nothing.
 * It starts at the unfiltered count so the page is correct before any script runs.
 */
const group = (title, count, body, rows) =>
	`<section class="group" data-matches="${rows}"><h2>${escape(title)} <span class="count">${escape(count)}</span></h2>${body}</section>`;

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
	return group("Architecture", `${report.layers.length} layers`, table(headings, rows), rows.length);
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
	return group("Modules", `${rows.length} files`, table(headings, rows), rows.length);
}

function debt(report) {
	if (report.debt.length === 0) {
		return group("Debt", "0 open", `<p class="empty">Nothing open in docs/bugs or docs/issues.</p>`, 0);
	}
	const rows = report.debt.map((d) => [d.kind, d.title, d.path]);
	return group(
		"Debt",
		`${report.debt.length} open`,
		table([{ label: "kind" }, { label: "title" }, { label: "note" }], rows),
		rows.length,
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
	const rowCount = nonZero.reduce((n, f) => n + f.items.length, 0);
	return group("All findings", `${nonZero.length} non-zero`, schema + detail.join("") + allClear, rowCount);
}

const VIEW_SCRIPT = `
	const body = document.body;
	document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
		body.className = 'show-' + b.dataset.view;
		document.querySelectorAll('nav button').forEach((o) =>
			o.setAttribute('aria-pressed', String(o === b)));
		if (b.dataset.view === 'tables') document.querySelector('.filter').focus();
	}));

	const filter = document.querySelector('.filter');
	const nothing = document.getElementById('nomatch');
	filter.addEventListener('input', () => {
		const q = filter.value.trim().toLowerCase();
		let total = 0;
		document.querySelectorAll('.group').forEach((g) => {
			let matches = 0;
			g.querySelectorAll('tbody tr').forEach((row) => {
				const hit = q === '' || row.textContent.toLowerCase().includes(q);
				row.hidden = !hit;
				if (hit) matches++;
			});
			g.dataset.matches = String(matches);
			total += matches;
			const shown = g.querySelector('h2 .count');
			if (shown) shown.textContent = q === '' ? shown.dataset.all : matches + ' matching';
		});
		// A filter box over nothing at all reads as a broken page, so say what happened.
		nothing.hidden = total > 0;
		nothing.textContent = 'Nothing matches ' + JSON.stringify(filter.value) + '.';
	});
	document.querySelectorAll('.group h2 .count').forEach((c) => { c.dataset.all = c.textContent; });
`;

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

/**
 * Obsidian's vendored app.css, INLINED rather than linked.
 *
 * The reason is the plain one: a `<link href="../test/harness/obsidian.css">` makes the
 * report two files that must keep their relative positions, so it renders unstyled the
 * moment anyone moves it, copies it out, or attaches it to anything. Inlined, the page
 * is one file with no subresources at all — no `url()`, no `@import`, nothing to fetch —
 * which is what "self-contained" was supposed to mean and did not.
 *
 * **And it is what fixed a real defect, which no check here could see.** Opened in a
 * headed Edge on 2026-08-18, the linked version failed with `'file:' URLs are treated
 * as unique security origins` and rendered with no tokens at all. Three headless
 * instruments had already cleared it: Edge headless with
 * `--allow-file-access-from-files`, headless without it, and `--headless=new`, which is
 * supposed to enforce closest to a headed profile. All three loaded the stylesheet
 * happily, `--text-normal` resolving to `#222222` every time.
 *
 * **So headless is not an instrument that can see this class of defect, at any flag.**
 * A `file://` page's access to a sibling `file://` resource is the specific thing to
 * check in a real browser window, and the report of it was right while three
 * measurements were wrong. That is the standing lesson here, and it is why the
 * verification for this page is "open it" rather than "probe it".
 *
 * 142 KB of duplication into a gitignored artifact buys the first reason on its own.
 */
async function tokens() {
	return readFile(path.join("test", "harness", "obsidian.css"), "utf8");
}

export function page(report, obsidianCss) {
	const clean = report.fallow.fileScores.length - report.actions.length;
	return `<!doctype html>
<html lang="en" class="theme-light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codebase health</title>
<style>${obsidianCss}</style>
<style>${CSS}</style>
</head>
<body class="show-dashboard">
<main>
<h1>Codebase health</h1>
<p class="answer">${report.actions.length} thing(s) to act on, ${clean} module(s) clean.
Generated ${escape(report.generated)} from fallow ${escape(report.fallow.version)}.</p>
<nav>
<button type="button" data-view="dashboard" aria-pressed="true">Dashboard</button>
<button type="button" data-view="tables" aria-pressed="false">Tables</button>
</nav>
<div id="dashboard">
${signs(report)}
${riskBar(report)}
${actions(report)}
</div>
<div id="tables">
<input class="filter" type="search" placeholder="Filter every table — a path, a layer, a rule name">
<p class="empty" id="nomatch" hidden></p>
${architecture(report)}
${modules(report)}
${debt(report)}
${findings(report)}
</div>
</main>
<script>${VIEW_SCRIPT}${SORT_SCRIPT}</script>
</body>
</html>`;
}

// CLI entry only, for the same reason and in the same shape as the collector's guard.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = JSON.parse(await readFile(".health/report.json", "utf8"));
	await writeFile(".health/report.html", page(report, await tokens()));
	console.log(`✓ .health/report.html — open it at ${path.resolve(".health/report.html")}`);
}
