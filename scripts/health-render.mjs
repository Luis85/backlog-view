import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { capDistribution, coverageDistribution, layerMatrix, riskScatter } from "./health-charts.mjs";
import { architecture, debt, escape, findings, layerStrip, modules, riskBar, vitalSigns, worklist } from "./health-sections.mjs";

/**
 * `.health/report.json` → `.health/report.html`. The shell, the two views and the
 * behaviour; every block inside them is `health-sections.mjs`.
 *
 * **This page has its own visual world, and that is a reversal.** It inlined Obsidian's
 * vendored app.css for most of its life, on the plugin's rule that nothing here owns a
 * palette. That rule is right for the plugin and wrong for this: the report is a
 * standalone document opened in a browser, never a surface inside Obsidian, so borrowing
 * an application shell bought colours at the price of its behaviour — a body that could
 * not scroll, could not be selected, and was size-contained, each found the hard way.
 *
 * The palette is the validated data-viz reference instance, and its most useful verdict
 * was that this page needs NO categorical palette at all: every figure is one series plus
 * status, so there is no series ramp, no legend and no hue cycling anywhere.
 *
 * **Health is still the absence of colour.** A clean codebase renders grey, and every
 * spot of colour marks something to act on. Green is absent on purpose: nothing here is
 * congratulated for being fine.
 *
 * **The page has no subresources of any kind** — no link, no url(), no font, no image —
 * so it is one file that can be moved, copied or attached. That is not only tidiness. A
 * linked sibling stylesheet failed outright in a headed browser, with "file: URLs are
 * treated as unique security origins", after three headless runs had cleared it: with
 * the file-access flag, without it, and under --headless=new. Headless cannot see that
 * class of defect at any flag, so the verification for this page is "open it".
 */

const CSS = `
	/* ------------------------------------------------------------------ the palette

	   This page has its OWN world, decided 2026-08-18. It used to inline Obsidian's
	   app.css and borrow every colour from it, on the rule that the plugin owns no
	   palette — correct for the plugin, wrong here: this is a standalone document opened
	   in a browser, not a surface inside Obsidian, and borrowing an application shell
	   brought its behaviour with it (a body that could not scroll, could not be selected
	   and was size-contained) for colours a report does not need.

	   Values are the validated reference instance from the data-viz palette. What the
	   validator actually decided: this page needs NO categorical palette, because every
	   figure on it is one series plus status. So there is no series ramp, no legend and
	   no hue cycling — colour marks a problem and nothing else, which is the same rule
	   the page always had, now with contrast behind it.

	   warning (#fab219) is deliberately unused: at 1.79:1 on this surface a bar filled
	   with it is a washed-out mark. serious (#ec835a, 2.57:1) carries attention and
	   critical (#d03b3b, 4.68:1) carries danger, and every mark in either colour also
	   carries a label, which is the documented mitigation for a sub-3:1 status fill. */
	:root {
		color-scheme: light;
		--plane: #f9f9f7;
		--surface: #fcfcfb;
		--sunken: #f2f1ed;
		--ink: #0b0b0b;
		--ink-2: #52514e;
		--ink-3: #6f6e6a;
		--rule: #e1e0d9;
		--rule-2: #c3c2b7;
		--accent: #2a78d6;
		--critical: #d03b3b;
		--attention: #ec835a;
		--seq: 42 120 214;
		--shadow: 0 1px 2px rgba(11, 11, 11, 0.05), 0 4px 12px rgba(11, 11, 11, 0.04);
	}
	/* Dark is SELECTED, not an inversion: its own steps, each measured against the dark
	   surface rather than flipped from the light ones. */
	@media (prefers-color-scheme: dark) {
		:root:not([data-theme="light"]) {
			color-scheme: dark;
			--plane: #0d0d0d;
			--surface: #1a1a19;
			--sunken: #222220;
			--ink: #ffffff;
			--ink-2: #c3c2b7;
			--ink-3: #928f87;
			--rule: #2c2c2a;
			--rule-2: #383835;
			--accent: #3987e5;
			--critical: #e66767;
			--attention: #ec835a;
			--seq: 57 135 229;
			--shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
		}
	}
	:root[data-theme="dark"] {
		color-scheme: dark;
		--plane: #0d0d0d;
		--surface: #1a1a19;
		--sunken: #222220;
		--ink: #ffffff;
		--ink-2: #c3c2b7;
		--ink-3: #928f87;
		--rule: #2c2c2a;
		--rule-2: #383835;
		--accent: #3987e5;
		--critical: #e66767;
		--attention: #ec835a;
		--seq: 57 135 229;
		--shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	*, *::before, *::after { box-sizing: border-box; }
	body { background: var(--plane); color: var(--ink);
	       font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
	       font-size: 14px; line-height: 1.5; margin: 0; padding: 40px 24px 96px;
	       -webkit-font-smoothing: antialiased; }
	main { margin-inline: auto; max-width: 1120px; }
	:focus-visible { border-radius: 4px; outline: 2px solid var(--accent); outline-offset: 2px; }

	/* Type. Four steps and two weights; no display face, per the palette's own rule that
	   everything including the largest figure stays in the system sans. */
	h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; margin: 0; }
	h2 { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
	h3 { align-items: baseline; display: flex; font-size: 11px; font-weight: 600;
	     gap: 8px; justify-content: space-between; letter-spacing: 0.08em; margin: 0 0 14px;
	     text-transform: uppercase; color: var(--ink-3); }
	.count { color: var(--ink-3); font-size: 11px; font-weight: 400; letter-spacing: 0;
	         text-transform: none; }

	header { display: flex; align-items: flex-start; gap: 24px;
	         justify-content: space-between; margin-bottom: 28px; }
	.answer { font-size: 16px; margin: 8px 0 0; max-width: 62ch; }
	.answer b { font-weight: 600; }
	.provenance { color: var(--ink-3); font-size: 12px; margin: 8px 0 0;
	              font-variant-numeric: tabular-nums; }
	.is-old { color: var(--attention); }

	/* Controls. */
	.controls { align-items: center; display: flex; gap: 8px; }
	.tabs { background: var(--sunken); border-radius: 8px; display: flex; gap: 2px; padding: 3px; }
	[role="tab"] { background: none; border: none; border-radius: 6px; color: var(--ink-2);
	               cursor: pointer; font: inherit; font-size: 13px; font-weight: 500;
	               padding: 6px 14px; transition: background 120ms, color 120ms; }
	[role="tab"]:hover { color: var(--ink); }
	[role="tab"][aria-selected="true"] { background: var(--surface); box-shadow: var(--shadow);
	                                     color: var(--ink); }
	.icon-button { background: var(--surface); border: 1px solid var(--rule);
	               border-radius: 8px; color: var(--ink-2); cursor: pointer; font: inherit;
	               font-size: 13px; padding: 7px 12px; }
	.icon-button:hover { border-color: var(--rule-2); color: var(--ink); }
	body.show-dashboard #tables, body.show-tables #dashboard { display: none; }

	/* Cards. One surface, one hairline, one soft shadow — no nested cards. */
	.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	        margin-bottom: 16px; }
	.cluster, .figure { background: var(--surface); border: 1px solid var(--rule);
	                    border-radius: 12px; box-shadow: var(--shadow); padding: 18px 20px; }
	.figure { margin-bottom: 16px; }
	.figure-wide, .wide-cluster { grid-column: 1 / -1; }
	.fig-note { color: var(--ink-3); font-size: 12px; margin: 14px 0 0; max-width: 74ch; }
	.fig-note.is-critical { color: var(--critical); }

	.cluster dl { display: grid; gap: 10px; margin: 0; }
	.fig { align-items: baseline; display: flex; gap: 12px; justify-content: space-between; }
	.fig dt { color: var(--ink-2); }
	.fig dd { font-variant-numeric: tabular-nums; margin: 0; white-space: nowrap; }
	.fig-limit { color: var(--ink-3); font-size: 11px; margin-inline-start: 6px; }
	.fig-over dd { color: var(--critical); font-weight: 600; }
	.fig-stale dd { border-bottom: 1px dashed var(--rule-2); color: var(--ink-3); }

	/* The unit-size bar. A 2px surface gap between segments, per the mark spec. */
	.bar { display: flex; gap: 2px; height: 12px; }
	.seg { border-radius: 3px; }
	.keys { color: var(--ink-2); display: flex; flex-wrap: wrap; font-size: 12px;
	        font-variant-numeric: tabular-nums; gap: 16px; margin-top: 12px; }
	.key { align-items: center; display: inline-flex; gap: 7px; }
	.swatch { block-size: 9px; border-radius: 2px; display: inline-block; inline-size: 9px; }
	.seg-low { background: var(--rule); }
	.seg-medium { background: var(--rule-2); }
	.seg-high { background: var(--attention); }
	.seg-very_high { background: var(--critical); }

	.meter { background: var(--rule); block-size: 4px; border-radius: 2px; display: block;
	         inline-size: 100%; margin-block-end: 3px; overflow: hidden; }
	.meter i { background: var(--ink-3); block-size: 100%; display: block; }
	.meter-warn i { background: var(--attention); }
	.has-meter { min-inline-size: 88px; }
	.has-meter b { font-weight: 400; }

	/* Layers. */
	.layers { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
	.layers li { align-items: center; display: grid; gap: 16px;
	             grid-template-columns: 6.5rem 4.5rem 1fr 4rem 3rem; }
	.layer-name { font-weight: 600; }
	.layer-files, .layer-mi { color: var(--ink-2); font-variant-numeric: tabular-nums; }
	.layer-lines { align-items: center; display: grid; gap: 10px; grid-template-columns: 1fr 3.5rem; }
	.layer-lines b { color: var(--ink-2); font-variant-numeric: tabular-nums; font-weight: 400;
	                 text-align: right; }
	.layer-cov { font-variant-numeric: tabular-nums; text-align: right; }
	.layer-cov.is-thin { color: var(--attention); font-weight: 600; }
	.layer-mi { text-align: right; }

	/* The dependency matrix. HTML, so the counts render at their real size. */
	.mx { display: grid; font-variant-numeric: tabular-nums;
	      grid-template-columns: 5.5rem repeat(var(--n), minmax(0, 1fr)); gap: 2px; }
	.mx-corner { color: var(--ink-3); display: flex; flex-direction: column;
	             font-size: 10px; justify-content: space-between; padding: 2px 6px 2px 0;
	             text-align: right; }
	.mx-head { color: var(--ink-2); font-size: 11px; font-weight: 500; }
	.mx-col { padding-bottom: 4px; text-align: center; }
	.mx-row { align-items: center; display: flex; justify-content: flex-end;
	          padding-inline-end: 8px; }
	.mx-cell { align-items: center; background: var(--sunken); border-radius: 3px;
	           color: var(--ink-3); display: flex; font-size: 12px; justify-content: center;
	           min-block-size: 30px; }
	.mx-self { background: none; }
	.mx-none { color: var(--rule-2); }
	.mx-forbidden { background: repeating-linear-gradient(135deg, transparent, transparent 3px,
	                var(--rule) 3px, var(--rule) 4px); }
	/* Sequential: one hue, light to dark, opacity carrying magnitude. */
	/* The sequential ramp: one hue, seven real steps, each with the ink measured against
	   it. Dark mode runs the SAME ramp in the other direction, so in both modes the step
	   nearest zero is the step nearest the surface. */
	.mx-on { font-weight: 600; }
	.mx-s0 { background: #cde2fb; color: #0b0b0b; }
	.mx-s1 { background: #9ec5f4; color: #0b0b0b; }
	.mx-s2 { background: #6da7ec; color: #0b0b0b; }
	.mx-s3 { background: #3987e5; color: #0b0b0b; }
	.mx-s4 { background: #256abf; color: #ffffff; }
	.mx-s5 { background: #184f95; color: #ffffff; }
	.mx-s6 { background: #0d366b; color: #ffffff; }
	:root[data-theme="dark"] .mx-s0, :root[data-theme="dark"] .mx-s1,
	:root[data-theme="dark"] .mx-s2, :root[data-theme="dark"] .mx-s3,
	:root[data-theme="dark"] .mx-s4, :root[data-theme="dark"] .mx-s5,
	:root[data-theme="dark"] .mx-s6 { color: #ffffff; }
	:root[data-theme="dark"] .mx-s0 { background: #0d366b; }
	:root[data-theme="dark"] .mx-s1 { background: #104281; }
	:root[data-theme="dark"] .mx-s2 { background: #1c5cab; }
	:root[data-theme="dark"] .mx-s3 { background: #256abf; }
	:root[data-theme="dark"] .mx-s4 { background: #3987e5; color: #0b0b0b; }
	:root[data-theme="dark"] .mx-s5 { background: #6da7ec; color: #0b0b0b; }
	:root[data-theme="dark"] .mx-s6 { background: #86b6ef; color: #0b0b0b; }
	@media (prefers-color-scheme: dark) {
		:root:not([data-theme="light"]) .mx-s0, :root:not([data-theme="light"]) .mx-s1,
		:root:not([data-theme="light"]) .mx-s2, :root:not([data-theme="light"]) .mx-s3 { color: #ffffff; }
		:root:not([data-theme="light"]) .mx-s0 { background: #0d366b; }
		:root:not([data-theme="light"]) .mx-s1 { background: #104281; }
		:root:not([data-theme="light"]) .mx-s2 { background: #1c5cab; }
		:root:not([data-theme="light"]) .mx-s3 { background: #256abf; }
		:root:not([data-theme="light"]) .mx-s4 { background: #3987e5; color: #0b0b0b; }
		:root:not([data-theme="light"]) .mx-s5 { background: #6da7ec; color: #0b0b0b; }
		:root:not([data-theme="light"]) .mx-s6 { background: #86b6ef; color: #0b0b0b; }
	}
	.mx-violation { background: var(--critical); color: #fff; font-weight: 600; }

	/* Distributions. */
	.dist { display: grid; gap: 8px; }
	.dist-row { align-items: center; display: grid; gap: 12px;
	            grid-template-columns: 6.5rem 1fr 2.5rem; }
	.dist-label { color: var(--ink-2); font-size: 12px; }
	.dist-track { background: var(--sunken); border-radius: 4px; block-size: 18px; }
	.dist-bar { block-size: 100%; border-radius: 4px; background: var(--ink-3); }
	.dist-calm { background: var(--rule-2); }
	.dist-attention { background: var(--attention); }
	.dist-critical { background: var(--critical); }
	.dist-count { color: var(--ink-2); font-size: 12px; font-variant-numeric: tabular-nums;
	              text-align: right; }

	/* Scatter. Natural size; it may shrink and may never grow. */
	.scatter { block-size: auto; display: block; inline-size: 100%; max-inline-size: 680px; }
	.scatter text { fill: var(--ink-3); font-family: inherit; font-size: 11px; }
	.sc-grid { stroke: var(--rule); }
	.sc-axis { stroke: var(--rule-2); }
	.sc-band { fill: var(--critical); opacity: 0.08; }
	.sc-band-label { fill: var(--ink-3) !important; font-size: 11px; }
	.sc-dot { fill: var(--ink-3); fill-opacity: 0.55; }
	.sc-risky { fill: var(--critical); fill-opacity: 1; stroke: var(--surface); stroke-width: 2; }

	/* The worklist. Colour once per band, on the heading that names the rule. */
	.band { margin-bottom: 20px; }
	.band h3 { justify-content: flex-start; }
	.band .swatch { block-size: 8px; inline-size: 8px; }
	.band-high .swatch { background: var(--critical); }
	.band-medium .swatch { background: var(--attention); }
	.band-low .swatch { background: var(--rule-2); }
	.act { background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
	       box-shadow: var(--shadow); list-style: none; margin: 0; overflow: hidden; padding: 0; }
	.act li { align-items: baseline; display: grid; gap: 4px 14px;
	          grid-template-columns: 1fr auto auto; padding: 12px 18px; }
	.act li + li { border-top: 1px solid var(--rule); }
	.act li:hover { background: var(--sunken); }
	.row-title { color: var(--ink); font-weight: 500; grid-column: 1; text-decoration: none; }
	.row-title:hover { color: var(--accent); text-decoration: underline; }
	.row-where { color: var(--ink-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	             font-size: 11px; grid-column: 1; grid-row: 2; }
	.row-why { color: var(--ink-3); font-size: 12px; font-variant-numeric: tabular-nums; grid-row: 2; }
	.chip { background: var(--sunken); border-radius: 5px; color: var(--ink-2); font-size: 11px;
	        grid-row: 1 / span 2; padding: 2px 8px; }

	/* Filter and tables. */
	.filter-bar { background: var(--plane); margin-bottom: 16px; padding-block: 10px;
	              position: sticky; top: 0; z-index: 3; }
	.filter { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px;
	          color: var(--ink); display: block; font: inherit; inline-size: 100%;
	          padding: 10px 14px; }
	.filter:focus { border-color: var(--accent); outline: none; }
	.filter-hint { color: var(--ink-3); font-size: 12px; margin: 8px 0 0; }
	kbd { background: var(--sunken); border: 1px solid var(--rule); border-radius: 4px;
	      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
	      padding: 1px 5px; }

	.group { margin-bottom: 32px; }
	.group[data-matches="0"] { display: none; }
	.group > h2 { border-bottom: 1px solid var(--rule); margin-bottom: 14px;
	              padding-bottom: 10px; }
	.group h3 { margin: 20px 0 8px; }
	.wide { background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
	        box-shadow: var(--shadow); overflow-x: auto; }
	table { border-collapse: collapse; inline-size: 100%; }
	th, td { padding: 9px 14px; text-align: left; vertical-align: baseline; }
	thead th { background: var(--surface); border-bottom: 1px solid var(--rule);
	           color: var(--ink-3); cursor: pointer; font-size: 11px; font-weight: 600;
	           letter-spacing: 0.04em; position: sticky; text-transform: uppercase; top: 0;
	           user-select: none; white-space: nowrap; z-index: 1; }
	thead th:hover { color: var(--ink); }
	thead th::after { border: 3px solid transparent; content: ""; display: inline-block;
	                  margin-inline-start: 6px; opacity: 0; vertical-align: middle; }
	thead th[aria-sort="ascending"]::after { border-block-end-color: var(--accent);
	                                         margin-block-end: 3px; opacity: 1; }
	thead th[aria-sort="descending"]::after { border-block-start-color: var(--accent);
	                                          margin-block-start: 3px; opacity: 1; }
	tbody tr + tr { border-top: 1px solid var(--rule); }
	tbody tr:hover { background: var(--sunken); }
	td.num, th.num { font-variant-numeric: tabular-nums; text-align: right; }
	td:first-child { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
	.empty { color: var(--ink-2); margin: 12px 0; max-width: 68ch; }
	.warn-text { color: var(--attention); }

	.group-by { display: flex; gap: 4px; margin-bottom: 12px; }
	.gb { background: var(--surface); border: 1px solid var(--rule); border-radius: 6px;
	      color: var(--ink-2); cursor: pointer; font: inherit; font-size: 12px; padding: 5px 10px; }
	.gb:hover { border-color: var(--rule-2); color: var(--ink); }
	.gb[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
	tr.group-head td { background: var(--sunken); color: var(--ink); font-weight: 600;
	                   font-size: 12px; letter-spacing: 0.02em; position: sticky; top: 33px; }
	tr.group-head td:first-child { font-family: inherit; }
	tr.group-head .g-count { color: var(--ink-3); font-weight: 400; }

	@media (max-width: 720px) {
		header { flex-direction: column; gap: 16px; }
		.layers li { grid-template-columns: 5rem 1fr 3.5rem; }
		.layer-lines, .layer-mi { display: none; }
	}
	@media (prefers-reduced-motion: no-preference) {
		#dashboard, #tables { animation: rise 180ms cubic-bezier(0.2, 0, 0, 1); }
		@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
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

	// The theme follows the reader's system until they say otherwise, and then it is
	// their choice that wins in both directions — light over an OS-dark preference too,
	// which is why the stylesheet guards the media block rather than relying on order.
	const themed = document.documentElement;
	document.getElementById('theme').addEventListener('click', () => {
		const dark = matchMedia('(prefers-color-scheme: dark)').matches;
		const current = themed.dataset.theme || (dark ? 'dark' : 'light');
		themed.dataset.theme = current === 'dark' ? 'light' : 'dark';
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

export function page(report) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codebase health</title>
<style>${CSS}</style>
</head>
<body class="show-dashboard">
<main>
<header>
<h1>Codebase health</h1>
<p class="answer">${answer(report)}</p>
<p class="provenance"><span id="age" data-generated="${escape(report.generated)}">${escape(report.generated)}</span>${commitNote(report)} · fallow ${escape(report.fallow.version)} · schema ${escape(report.fallow.schemaVersion)}</p>
<div class="controls">
<div class="tabs" role="tablist" aria-label="Report views">
${tab("dashboard", "Dashboard", true)}
${tab("tables", "Tables", false)}
</div>
<button type="button" class="icon-button" id="theme" aria-label="Switch between light and dark">Theme</button>
</div>
</header>
<div id="dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
${vitalSigns(report)}
${layerStrip(report)}
${layerMatrix(report)}
${riskScatter(report)}
<div class="grid">
${coverageDistribution(report)}
${capDistribution(report)}
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
	await writeFile(".health/report.html", page(report));
	console.log(`✓ .health/report.html — open it at ${path.resolve(".health/report.html")}`);
}
