import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { capHistogram, coverageHistogram, layerMap, riskScatter } from "./health-charts.mjs";
import { architecture, debt, escape, findings, layerStrip, modules, riskBar, vitalSigns, worklist } from "./health-sections.mjs";

/**
 * `.health/report.json` → `.health/report.html`. The shell, the two views and the
 * behaviour; every block inside them is `health-sections.mjs`.
 *
 * **The page owns its layout and borrows only its colours.** It carries
 * `test/harness/obsidian.css` — Obsidian's real app.css, already vendored for the
 * harness — so every colour, size step and radius is the product's own token in the
 * reader's own scheme, and this file introduces no palette. But that stylesheet is
 * REDUCED to the rules the harness exercises, so an element the plugin's markup never
 * uses may have nothing at all: a disclosure control shipped looking right in the
 * harness and wrong in a vault on 2026-08-08 for exactly that reason. Every box, table
 * and control here writes its own layout.
 *
 * **Health is the absence of colour.** DESIGN.md: "A screen with no problems on it is
 * monochrome apart from its badges." There are no green figures here, because green
 * means done in this system and never "good". A clean codebase renders grey, and every
 * spot of colour is a thing to act on.
 */

/**
 * Obsidian's vendored app.css, INLINED rather than linked.
 *
 * The reason is the plain one: a link to a sibling stylesheet makes the report two files
 * that must keep their relative positions, so it renders unstyled the moment anyone moves
 * it, copies it out or attaches it. Inlined, the page has no subresources at all.
 *
 * **And it is what fixed a real defect that no check here could see.** Opened in a headed
 * Edge on 2026-08-18, the linked version failed with "file: URLs are treated as unique
 * security origins" and rendered with no tokens at all. Three headless instruments had
 * already cleared it — with the file-access flag, without it, and under --headless=new,
 * which is meant to enforce closest to a headed profile. All three loaded the stylesheet
 * happily. So headless cannot see this class of defect at any flag, and the verification
 * for this page is "open it" rather than "probe it".
 */
const tokens = () => readFile(path.join("test", "harness", "obsidian.css"), "utf8");

const CSS = `
	/* app.css is an APPLICATION SHELL, and inlining it brings the shell's behaviour along
	   with its colours. Obsidian's body deliberately does not scroll, deliberately cannot
	   be selected, and is deliberately size-contained — correct for a window, wrong for a
	   document. Four declarations are taken back here, and this rule wins because it is
	   equal specificity and later.

	   contain: strict is the one no symptom names. Size containment makes the body's
	   height independent of its contents, so the page collapsed to its padding — 64px
	   holding 25 rows — and reported itself as not scrollable rather than as clipped.
	   app.css undoes these same four in its own @media print block, which is what confirms
	   the set is document-shaped rather than guessed. Of app.css's rules, exactly eleven
	   have a bare-element selector able to match a page carrying no Obsidian classes. */
	body { background: var(--background-primary); color: var(--text-normal);
	       font-size: var(--font-ui-small); line-height: 1.5; margin: 0;
	       padding: var(--size-4-8) var(--size-4-4) var(--size-4-18);
	       overflow: visible; height: auto; width: auto; contain: none;
	       user-select: text; -webkit-user-select: text; }
	main { max-width: 1180px; margin-inline: auto; }
	:focus-visible { outline: 2px solid var(--text-normal); outline-offset: 2px;
	                 border-radius: var(--radius-s); }

	/* --text-faint is for GRAPHICAL fills only — meter bars, swatches, the dashed
	   underline. Measured 2026-08-18 it is rgb(171,171,171) on white, a contrast ratio of
	   2.35:1, so any TEXT wearing it fails the 4.5:1 floor. Secondary text uses
	   --text-muted, which measures 6.49:1. The product uses --text-faint for text in
	   places; a document read at arm's length is not an app panel, and the floor binds. */

	/* Type scale. Four steps, all Obsidian's own, so the page has an obvious hierarchy
	   rather than one size doing every job. */
	h1 { font-size: var(--font-ui-large); font-weight: var(--font-medium);
	     letter-spacing: -0.01em; margin: 0; }
	h2 { font-size: var(--font-ui-medium); font-weight: var(--font-medium); margin: 0; }
	h3 { font-size: var(--font-ui-smaller); font-weight: var(--font-medium);
	     letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted);
	     margin: 0 0 var(--size-4-2); }
	.count { color: var(--text-muted); font-weight: normal; letter-spacing: 0;
	         text-transform: none; }

	/* Header. The answer is the largest thing on the page, and its measure is held to
	   reading width rather than the full 1180. */
	header { border-bottom: 1px solid var(--background-modifier-border);
	         margin-bottom: var(--size-4-6); padding-bottom: var(--size-4-4); }
	.answer { font-size: var(--font-ui-medium); margin: var(--size-4-2) 0 0;
	          max-width: 68ch; }
	.answer b { font-weight: var(--font-medium); }
	.provenance .is-old, .is-old { color: rgb(var(--color-orange-rgb)); }
	.provenance { color: var(--text-muted); font-size: var(--font-ui-smaller);
	              margin: var(--size-2-2) 0 0; }

	/* Tablist. Two views, switched by a class on body, so exactly one is in the flow. */
	[role="tablist"] { display: flex; gap: var(--size-2-1); margin-bottom: var(--size-4-6); }
	[role="tab"] { background: none; border: none; border-radius: var(--radius-s);
	               color: var(--text-muted); cursor: pointer; font-family: inherit;
	               font-size: var(--font-ui-small); font-weight: var(--font-medium);
	               padding: var(--size-2-2) var(--size-4-2); }
	[role="tab"]:hover { background: var(--background-modifier-hover);
	                     color: var(--text-normal); }
	[role="tab"][aria-selected="true"] { background: var(--background-secondary);
	                                     color: var(--text-normal); }
	body.show-dashboard #tables, body.show-tables #dashboard { display: none; }

	/* Clusters. Related figures tight, unrelated groups generous. */
	.clusters { display: grid; gap: var(--size-4-4);
	            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
	            margin-bottom: var(--size-4-6); }
	.cluster { background: var(--background-secondary); border-radius: var(--radius-m);
	           padding: var(--size-4-3); }
	.wide-cluster { grid-column: 1 / -1; margin-bottom: var(--size-4-6); }
	.cluster dl { display: grid; gap: var(--size-2-2); margin: 0; }
	.fig { align-items: baseline; display: flex; gap: var(--size-4-2);
	       justify-content: space-between; }
	.fig dt { color: var(--text-muted); }
	.fig dd { font-variant-numeric: tabular-nums; margin: 0; text-align: right;
	          white-space: nowrap; }
	.fig-limit { color: var(--text-muted); font-size: var(--font-ui-smaller);
	             margin-inline-start: var(--size-2-2); }
	.fig-over dd { color: var(--text-error); font-weight: var(--font-medium); }
	.fig-stale dd { border-bottom: 1px dashed var(--text-faint); color: var(--text-muted); }

	/* Bars. Two on the page, both showing a real proportion of real data. */
	.bar { display: flex; gap: 2px; height: 10px; }
	.seg { border-radius: 2px; }
	.keys { color: var(--text-muted); display: flex; flex-wrap: wrap;
	        font-size: var(--font-ui-smaller); font-variant-numeric: tabular-nums;
	        gap: var(--size-4-3); margin-top: var(--size-4-2); }
	.key { align-items: center; display: inline-flex; gap: var(--size-2-2); }
	.swatch { block-size: 8px; border-radius: 2px; display: inline-block; inline-size: 8px; }
	/* Low risk is NOT green: green means done in this system, never good. */
	.seg-low { background: var(--background-modifier-border); }
	.seg-medium { background: var(--text-faint); }
	.seg-high { background: rgb(var(--color-orange-rgb)); }
	.seg-very_high { background: var(--text-error); }

	/* A proportion drawn behind a figure, so a column of numbers is also a column of
	   lengths and the eye can scan it without reading. */
	.meter { background: var(--background-modifier-border); block-size: 4px;
	         border-radius: 2px; display: block; inline-size: 100%;
	         margin-block-end: 2px; overflow: hidden; }
	.meter i { background: var(--text-faint); display: block; block-size: 100%; }
	.meter-warn i { background: rgb(var(--color-orange-rgb)); }
	.has-meter { min-inline-size: 84px; }
	.has-meter b { font-weight: normal; }

	/* Layers. */
	.layers { display: grid; gap: var(--size-2-2); list-style: none; margin: 0; padding: 0; }
	.layers li { align-items: center; display: grid; gap: var(--size-4-3);
	             grid-template-columns: 6.5rem 4.5rem 1fr 3.5rem 3rem; }
	.layer-name { font-weight: var(--font-medium); }
	.layer-files, .layer-mi { color: var(--text-muted); font-variant-numeric: tabular-nums; }
	.layer-lines { align-items: center; display: grid; gap: var(--size-4-2);
	               grid-template-columns: 1fr 3.5rem; }
	.layer-lines b { color: var(--text-muted); font-variant-numeric: tabular-nums;
	                 font-weight: normal; text-align: right; }
	.layer-cov { font-variant-numeric: tabular-nums; text-align: right; }
	.layer-cov.is-thin { color: rgb(var(--color-orange-rgb)); }
	.layer-mi { text-align: right; }

	/* The worklist, banded. Colour appears once per band, on the heading that names the
	   rule — never as a stripe on every row. */
	.band { margin-bottom: var(--size-4-6); }
	.band h3 { align-items: center; display: flex; gap: var(--size-2-2); }
	.band-high .swatch { background: var(--text-error); }
	.band-medium .swatch { background: rgb(var(--color-orange-rgb)); }
	.band-low .swatch { background: var(--text-faint); }
	.act { list-style: none; margin: 0; padding: 0; }
	.act li { align-items: baseline; border-bottom: 1px solid var(--background-modifier-border);
	          display: grid; gap: var(--size-2-2) var(--size-4-3);
	          grid-template-columns: 1fr auto auto; padding: var(--size-4-2) 0; }
	.act li:hover { background: var(--background-modifier-hover); }
	.row-title { color: var(--text-normal); grid-column: 1; text-decoration: none; }
	.row-title:hover { text-decoration: underline; }
	.row-where { color: var(--text-muted); font-size: var(--font-ui-smaller);
	             grid-column: 1; grid-row: 2; }
	.row-why { color: var(--text-muted); font-size: var(--font-ui-smaller);
	           font-variant-numeric: tabular-nums; grid-row: 2; }
	.chip { background: var(--background-secondary); border-radius: var(--radius-s);
	        color: var(--text-muted); font-size: var(--font-ui-smaller);
	        grid-row: 1 / span 2; padding: 0 var(--size-4-1); }

	/* Filter. */
	.filter-bar { background: var(--background-primary); margin-bottom: var(--size-4-4);
	              padding-block: var(--size-2-2); position: sticky; top: 0; z-index: 2; }
	.filter { background: var(--background-primary); border-radius: var(--radius-s);
	          border: 1px solid var(--background-modifier-border); box-sizing: border-box;
	          color: var(--text-normal); display: block; font-family: inherit;
	          font-size: var(--font-ui-small); inline-size: 100%;
	          padding: var(--size-2-2) var(--size-4-2); }
	.filter:focus { border-color: var(--text-muted); outline: none; }
	.filter-hint { color: var(--text-muted); font-size: var(--font-ui-smaller);
	               margin: var(--size-2-2) 0 0; }
	kbd { background: var(--background-secondary); border-radius: var(--radius-s);
	      font-family: var(--font-monospace); font-size: 0.9em; padding: 0 4px; }

	/* Tables. */
	.group { margin-bottom: var(--size-4-8); }
	.group[data-matches="0"] { display: none; }
	.group > h2 { border-bottom: 1px solid var(--background-modifier-border);
	              margin-bottom: var(--size-4-2); padding-bottom: var(--size-2-2); }
	.group h3 { margin-top: var(--size-4-4); }
	table { border-collapse: collapse; inline-size: 100%; }
	th, td { padding: var(--size-2-2) var(--size-4-1); text-align: left;
	         vertical-align: baseline; }
	thead th { background: var(--background-primary); color: var(--text-muted);
	           cursor: pointer; font-size: var(--font-ui-smaller);
	           font-weight: var(--font-medium); position: sticky; top: 0;
	           user-select: none; white-space: nowrap; z-index: 1; }
	thead th::after { border: 3px solid transparent; content: ""; display: inline-block;
	                  margin-inline-start: 6px; opacity: 0; vertical-align: middle; }
	thead th[aria-sort="ascending"]::after { border-block-end-color: var(--text-muted);
	                                         margin-block-end: 3px; opacity: 1; }
	thead th[aria-sort="descending"]::after { border-block-start-color: var(--text-muted);
	                                          margin-block-start: 3px; opacity: 1; }
	tbody tr { border-top: 1px solid var(--background-modifier-border); }
	tbody tr:hover { background: var(--background-modifier-hover); }
	td.num, th.num { font-variant-numeric: tabular-nums; text-align: right; }
	.wide { overflow-x: auto; }
	.empty { color: var(--text-muted); margin: var(--size-4-2) 0; max-width: 68ch; }
	.warn-text { color: rgb(var(--color-orange-rgb)); }

	/* Charts. Everything is drawn in tokens, so a theme change repaints them with the
	   page and no SVG carries a colour of its own. */
	.chart { block-size: auto; display: block; inline-size: 100%; margin-top: var(--size-4-2); }
	.chart text { fill: var(--text-muted); font-family: inherit; font-size: 11px; }
	.lm-box rect { fill: var(--background-primary);
	               stroke: var(--background-modifier-border); }
	.lm-name { fill: var(--text-normal) !important; font-weight: var(--font-medium); }
	.lm-files { fill: var(--text-muted) !important; font-variant-numeric: tabular-nums; }
	.lm-edge { fill: none; stroke: var(--text-faint); opacity: 0.75; }
	.lm-violation { stroke: var(--text-error); opacity: 1; }
	.lm-divider { stroke: var(--background-modifier-border); stroke-dasharray: 3 3; }
	.lm-note { fill: var(--text-muted) !important; }
	.hg-label { fill: var(--text-muted) !important; }
	.hg-count { fill: var(--text-muted) !important; font-variant-numeric: tabular-nums; }
	.hg-bar { fill: var(--text-faint); }
	.hg-warn { fill: rgb(var(--color-orange-rgb)); }
	.sc-axis { stroke: var(--background-modifier-border); }
	.sc-zone { fill: rgb(var(--color-orange-rgb)); opacity: 0.07; }
	.sc-dot { fill: var(--text-faint); }
	.sc-risky { fill: rgb(var(--color-orange-rgb)); }

	/* Group-by. */
	.group-by { display: flex; gap: var(--size-2-1); margin-bottom: var(--size-4-2); }
	.gb { background: none; border: 1px solid var(--background-modifier-border);
	      border-radius: var(--radius-s); color: var(--text-muted); cursor: pointer;
	      font-family: inherit; font-size: var(--font-ui-smaller);
	      padding: var(--size-2-1) var(--size-4-1); }
	.gb[aria-pressed="true"] { background: var(--background-secondary);
	                           border-color: var(--text-muted); color: var(--text-normal); }
	tr.group-head td { background: var(--background-secondary);
	                   color: var(--text-normal); font-weight: var(--font-medium);
	                   position: sticky; top: 30px; }
	tr.group-head .g-count { color: var(--text-muted); font-weight: normal; }

	@media (prefers-reduced-motion: no-preference) {
		#dashboard, #tables { animation: rise 160ms cubic-bezier(0.2, 0, 0, 1); }
		@keyframes rise { from { opacity: 0; transform: translateY(4px); } }
	}
`;

const SCRIPT = `
	const body = document.body;
	const tabs = [...document.querySelectorAll('[role="tab"]')];
	const select = (tab) => {
		body.className = 'show-' + tab.dataset.view;
		tabs.forEach((t) => {
			t.setAttribute('aria-selected', String(t === tab));
			t.tabIndex = t === tab ? 0 : -1;
		});
		tab.focus();
	};
	tabs.forEach((tab, i) => {
		tab.addEventListener('click', () => select(tab));
		// Arrow keys are what a tablist is expected to answer; without them the control
		// looks like tabs and behaves like two unrelated buttons.
		tab.addEventListener('keydown', (e) => {
			const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
			if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length]); }
		});
	});

	const filter = document.querySelector('.filter');
	const nothing = document.getElementById('nomatch');
	const groups = [...document.querySelectorAll('.group')];
	groups.forEach((g) => { g.querySelector('h2 .count').dataset.all = g.querySelector('h2 .count').textContent; });
	filter.addEventListener('input', () => {
		const q = filter.value.trim().toLowerCase();
		let total = 0;
		groups.forEach((g) => {
			let matches = 0;
			g.querySelectorAll('tbody tr:not(.group-head)').forEach((row) => {
				const hit = q === '' || row.textContent.toLowerCase().includes(q);
				row.hidden = !hit;
				if (hit) matches++;
			});
			g.dataset.matches = String(matches);
			total += matches;
			const count = g.querySelector('h2 .count');
			count.textContent = q === '' ? count.dataset.all : matches + ' matching';
		});
		// A filter box over nothing at all reads as a broken page, so say what happened.
		regroupAll();
		nothing.hidden = total > 0;
		nothing.textContent = 'Nothing matches ' + JSON.stringify(filter.value) + '.';
	});

	document.addEventListener('keydown', (e) => {
		if (e.key !== '/' || e.target.tagName === 'INPUT') return;
		e.preventDefault();
		select(tabs[1]);
		filter.focus();
	});

	// Age is computed when the page is OPENED, not when it was written — a static page
	// that says "just now" forever is worse than one that says nothing.
	const age = document.getElementById('age');
	const ms = Date.now() - Date.parse(age.dataset.generated);
	const hours = ms / 3600000;
	const plural = (n, unit) => n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
	const say = hours < 1 ? plural(Math.max(1, Math.round(ms / 60000)), 'minute')
		: hours < 24 ? plural(Math.round(hours), 'hour')
		: plural(Math.round(hours / 24), 'day');
	age.textContent = 'generated ' + say;
	age.title = age.dataset.generated;
	if (hours >= 24) age.classList.add('is-old');

	// Grouping is applied AFTER filtering and after sorting, never instead of them: the
	// headings are inserted from whatever rows are currently visible and in whatever
	// order they currently sit, so the three controls compose.
	const regroup = (t) => {
		t.querySelectorAll('tr.group-head').forEach((r) => r.remove());
		const on = t.dataset.groupOn;
		if (!on) return;
		const tbody = t.tBodies[0];
		const width = t.tHead.rows[0].cells.length;
		let last = null;
		[...tbody.rows].filter((r) => !r.hidden).forEach((row) => {
			const key = row.dataset.group;
			if (key === last) return;
			last = key;
			const head = tbody.insertRow(row.rowIndex - 1);
			head.className = 'group-head';
			const count = [...tbody.rows].filter((r) => !r.hidden && r.dataset.group === key).length;
			head.innerHTML = '<td colspan="' + width + '">' + key +
				' <span class="g-count">' + count + '</span></td>';
		});
	};
	const regroupAll = () => document.querySelectorAll('table[data-groupable]').forEach(regroup);

	document.querySelectorAll('.gb').forEach((b) => b.addEventListener('click', () => {
		const t = b.closest('.group').querySelector('table[data-groupable]');
		const column = b.dataset.groupBy;
		b.parentElement.querySelectorAll('.gb').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
		if (column === 'off') delete t.dataset.groupOn;
		else {
			t.dataset.groupOn = column;
			// Grouping only reads if like sits with like, so it sorts by the key first.
			const tbody = t.tBodies[0];
			[...tbody.rows]
				.sort((x, y) => (x.dataset.group || '').localeCompare(y.dataset.group || ''))
				.forEach((r) => tbody.appendChild(r));
		}
		regroup(t);
	}));

	document.querySelectorAll('table').forEach((t) => {
		t.querySelectorAll('th').forEach((th, i) => {
			const sort = () => {
				const tbody = t.tBodies[0];
				const dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
				t.querySelectorAll('th').forEach((o) => o.setAttribute('aria-sort', 'none'));
				th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
				const value = (row) => row.cells[i].textContent.trim();
				const numeric = th.classList.contains('num');
				[...tbody.rows]
					.sort((a, b) => numeric
						? dir * ((parseFloat(value(a)) || 0) - (parseFloat(value(b)) || 0))
						: dir * value(a).localeCompare(value(b)))
					.forEach((row) => tbody.appendChild(row));
				regroup(t);
			};
			th.addEventListener('click', sort);
			th.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
			});
		});
	});
`;

const tab = (view, label, selected) =>
	`<button type="button" role="tab" id="tab-${view}" data-view="${view}"
		aria-controls="${view}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${escape(label)}</button>`;

/**
 * What the report is a report OF.
 *
 * A static page cannot know whether the tree moved after it was written, so it does not
 * claim to. It names the commit and whether that tree was already dirty, and lets the
 * reader compare — which is the honest version of "is this still true".
 */
function commitNote(report) {
	if (!report.commit?.head) return "";
	const dirty = report.commit.dirty ? ", working tree dirty" : "";
	return ` · ${escape(report.commit.head)}${dirty}`;
}

/** The one sentence the page exists to say, before anything has to be read. */
function answer(report) {
	const high = report.actions.filter((a) => a.band === "high").length;
	const clean = report.fallow.fileScores.length - report.actions.length;
	if (report.actions.length === 0) return `<b>Nothing to act on.</b> All ${escape(clean)} modules are inside every limit.`;
	const urgent = high > 0 ? `<b>${escape(high)} need attention now</b>, ` : "";
	return `${urgent}${escape(report.actions.length)} thing(s) worth doing across ${escape(clean)} clean modules.`;
}

export function page(report, obsidianCss) {
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
<header>
<h1>Codebase health</h1>
<p class="answer">${answer(report)}</p>
<p class="provenance"><span id="age" data-generated="${escape(report.generated)}">${escape(report.generated)}</span>${commitNote(report)} · fallow ${escape(report.fallow.version)} · schema ${escape(report.fallow.schemaVersion)}</p>
</header>
<div role="tablist" aria-label="Report views">
${tab("dashboard", "Dashboard", true)}
${tab("tables", "Tables", false)}
</div>
<div id="dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
${vitalSigns(report)}
${layerStrip(report)}
${layerMap(report)}
${riskScatter(report)}
<div class="clusters">
${coverageHistogram(report)}
${capHistogram(report)}
</div>
${riskBar(report)}
${worklist(report)}
</div>
<div id="tables" role="tabpanel" aria-labelledby="tab-tables">
<div class="filter-bar">
<input class="filter" type="search" aria-label="Filter every table" placeholder="Filter every table — a path, a layer, a rule name">
<p class="filter-hint">Press <kbd>/</kbd> from anywhere to search. Click a column to sort.</p>
</div>
<p class="empty" id="nomatch" hidden></p>
${architecture(report)}
${modules(report)}
${debt(report)}
${findings(report)}
</div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}

// CLI entry only, in the same shape as the collector's guard.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = JSON.parse(await readFile(".health/report.json", "utf8"));
	await writeFile(".health/report.html", page(report, await tokens()));
	console.log(`✓ .health/report.html — open it at ${path.resolve(".health/report.html")}`);
}
