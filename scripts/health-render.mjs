import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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
	/* `--text-accent` is NOT in the vendored app.css -- DESIGN.md declares it, the
	   reduced stub does not define it, and a hover that reads it changes nothing.
	   Measured 2026-08-18: it is the ONLY token this page names that fails to
	   resolve. The affordance is the underline instead, which needs no new token. */
	.act a:hover { border-bottom-color: var(--text-normal); }
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
