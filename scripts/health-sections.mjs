import { layerOf } from "./health-collect.mjs";

/**
 * Every block the health report draws, and nothing about the page that holds them.
 *
 * Split from `health-render.mjs` when the design pass roughly doubled this content: that
 * file is now the shell, the two views and the behaviour, and this one is the sections.
 * The split follows `docs-check.mjs` / `docs-markdown.mjs` — a composer and the layer it
 * composes — rather than being a line-count response.
 */

export const escape = (text) =>
	String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const pct = (n) => (n === null || n === undefined ? null : `${n}%`);

/**
 * A figure, its limit, and whether it is inside it.
 *
 * `state` is the whole point and is the page's colour rule in one place: `over` spends a
 * colour, `stale` is dashed for "present but not asserted", and everything else is grey.
 * A figure that is fine must look like every other figure that is fine, or the eye stops
 * being able to find the one that is not.
 */
function figure({ label, value, limit, state = "ok" }) {
	const detail = limit ? `<span class="fig-limit">${escape(limit)}</span>` : "";
	return `<div class="fig fig-${state}">
		<dt>${escape(label)}</dt>
		<dd>${escape(value)}${detail}</dd>
	</div>`;
}

const cluster = (title, figures) =>
	`<section class="cluster"><h3>${escape(title)}</h3><dl>${figures.join("")}</dl></section>`;

/** Coverage against the four floors, or four dashes and the reason it cannot say. */
function coverageFigures(coverage) {
	if (!coverage.present) {
		return ["statements", "branches", "functions", "lines"].map((key) =>
			figure({ label: key, value: "not measured", state: "stale" }),
		);
	}
	const measured = ["statements", "branches", "functions"].map((key) => {
		const value = coverage.totals[key];
		const floor = coverage.thresholds[key];
		return figure({
			label: key,
			value: pct(value),
			limit: `floor ${floor}`,
			state: value < floor ? "over" : "ok",
		});
	});
	// `lines` has no line map in coverage-final.json, so only its floor is knowable.
	measured.push(figure({ label: "lines", value: `floor ${coverage.thresholds.lines}`, state: "stale" }));
	return measured;
}

function complexityFigures(v) {
	return [
		figure({ label: "maintainability", value: v.maintainability_avg, limit: "of 100" }),
		figure({ label: "cyclomatic, mean", value: v.avg_cyclomatic }),
		figure({ label: "cyclomatic, p90", value: v.p90_cyclomatic }),
		figure({ label: "fan-in, p95", value: v.p95_fan_in }),
	];
}

function wasteFigures(report) {
	const v = report.fallow.vitalSigns;
	return [
		figure({ label: "dead files", value: pct(v.dead_file_pct) }),
		figure({ label: "dead exports", value: pct(v.dead_export_pct) }),
		figure({ label: "duplication", value: `${report.fallow.dupes.duplication_percentage.toFixed(2)}%` }),
		figure({ label: "circular deps", value: v.circular_dep_count }),
	];
}

/** The three clusters, grouped because ten equal figures in a row are a wall, not a strip. */
export function vitalSigns(report) {
	return `<div class="grid">
		${cluster("Coverage", coverageFigures(report.coverage))}
		${cluster("Complexity", complexityFigures(report.fallow.vitalSigns))}
		${cluster("Waste", wasteFigures(report))}
	</div>`;
}

const RISK_BANDS = [
	{ key: "low_risk", label: "low" },
	{ key: "medium_risk", label: "medium" },
	{ key: "high_risk", label: "high" },
	{ key: "very_high_risk", label: "very high" },
];

/**
 * The unit-size risk profile, and one of only two bars on the page.
 *
 * Four proportions are a shape rather than a number: what matters is how much of the tree
 * sits in the two right-hand bands, which is legible at a glance and is not legible as
 * four percentages in a list. Low risk is NOT green — green means done in this system,
 * never good — so only the two risky bands spend a colour at all.
 */
export function riskBar(report) {
	const p = report.fallow.vitalSigns.unit_size_profile;
	const segments = RISK_BANDS.filter((b) => p[b.key] > 0).map(
		(b) => `<span class="seg seg-${b.key.replace("_risk", "")}" style="flex:${p[b.key]}"></span>`,
	);
	const keys = RISK_BANDS.map(
		(b) => `<span class="key"><i class="swatch seg-${b.key.replace("_risk", "")}"></i>${escape(b.label)} ${escape(p[b.key])}%</span>`,
	);
	return `<section class="cluster wide-cluster">
		<h3>Unit size, by risk</h3>
		<div class="bar">${segments.join("")}</div>
		<div class="keys">${keys.join("")}</div>
	</section>`;
}

/**
 * Absence, in one place.
 *
 * `blank` and `orDash` exist because every `??` and every `=== null` is a branch, and
 * nothing in `scripts/` carries coverage — so fallow scores these at its lowest tier,
 * where CRAP is cyclomatic squared plus cyclomatic and the threshold of 30 is crossed at
 * a cyclomatic of 5. The budget in this directory is 4. Three functions in this file went
 * over it the moment the design pass added a second conditional apiece; the branches are
 * not gone, they are named and shared.
 */
const blank = (value) => value === null || value === undefined;
const orDash = (value) => (blank(value) ? "—" : value);

/** Coverage for one layer, and whether it is thin enough to say so. */
const coverageCell = (statements) =>
	blank(statements)
		? `<span class="layer-cov">—</span>`
		: `<span class="layer-cov ${statements < 90 ? "is-thin" : ""}">${escape(statements)}%</span>`;

/** A proportion drawn behind a figure, so a column of numbers is also a column of lengths. */
const meter = (value, max, state) =>
	`<span class="meter meter-${state}"><i style="inline-size:${Math.min(100, Math.round((value / max) * 100))}%"></i></span>`;

/**
 * The layer rollup, on the dashboard rather than buried in a table.
 *
 * This is the one view of the architecture nothing else in the repository offers, and as
 * seven table rows it read as reference data. As a row of layers with their coverage and
 * their share of the code drawn, it answers "which layer is thin" without being read.
 */
export function layerStrip(report) {
	const widest = Math.max(...report.layers.map((l) => l.lines), 1);
	const rows = report.layers.map(
		(l) => `<li>
			<span class="layer-name">${escape(l.layer)}</span>
			<span class="layer-files">${escape(l.files)} files</span>
			<span class="layer-lines">${meter(l.lines, widest, "neutral")}<b>${escape(l.lines)}</b></span>
			${coverageCell(l.statements)}
			<span class="layer-mi">${escape(orDash(l.avgMaintainability))}</span>
		</li>`,
	);
	return `<section class="cluster wide-cluster">
		<h3>Layers <span class="count">lines, coverage, maintainability</span></h3>
		<ul class="layers">${rows.join("")}</ul>
	</section>`;
}

const BAND_TITLES = {
	high: { title: "Act now", why: "over a limit, or a filed bug" },
	medium: { title: "Worth doing", why: "close to a limit, or thinly covered" },
	low: { title: "Noted", why: "reported, not urgent" },
};

/** The directory a row is about, which is the second thing a reader groups by. */
const dirOf = (where) => {
	const parts = where.replace(/\\/g, "/").split("/");
	return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
};

/**
 * One row, carrying the two grouping keys and its RANK.
 *
 * `data-rank` is the position the report ranked it at, and it is what makes "Flat" a
 * restoration rather than a third arbitrary order: the tables view sorts its rows to group
 * them and cannot get the original order back, and a list that loses the ranking has lost
 * the one thing the worklist is for.
 */
function worklistRow(row, root, rank) {
	const target = `${root}/${row.where}`.replace(/\\/g, "/");
	return `<li data-rank="${rank}" data-tool="${escape(row.source)}" data-dir="${escape(dirOf(row.where))}">
		<a class="row-title" href="vscode://file/${escape(target)}">${escape(row.title)}</a>
		<span class="row-where">${escape(row.where)}</span>
		<span class="row-why">${escape(row.why)}${row.trend ? ` · ${escape(row.trend)}` : ""}</span>
		<span class="chip">${escape(row.source)}</span>
	</li>`;
}

const bandTab = (band, rows, first) =>
	`<button type="button" role="tab" id="wt-${band}" aria-controls="band-${band}"
		aria-selected="${first}" tabindex="${first ? 0 : -1}"><i class="swatch"></i>${escape(BAND_TITLES[band].title)}
		<span class="count">${rows.length}</span></button>`;

const bandPanel = (band, rows, root, first) =>
	`<div class="band band-${band}" id="band-${band}" role="tabpanel"
		aria-labelledby="wt-${band}"${first ? "" : " hidden"}>
		<p class="wl-why">${escape(BAND_TITLES[band].why)}</p>
		<ul class="act">${rows.map((r) => worklistRow(r, root, r.rank)).join("")}</ul>
	</div>`;

/**
 * The worklist: one band at a time, groupable by the tool that reported it or the
 * directory it is in.
 *
 * It was twenty-five flat rows behind a three-pixel coloured rail — the coloured left
 * border the craft floor refuses, and which made every row look equally urgent. Banding
 * put the colour once, on a heading that names the rule. Tabbing goes one step further for
 * the same reason: three stacked lists make the reader scroll past nine urgent rows to
 * learn there are four unurgent ones, and the count belongs on the control rather than in
 * the thing being counted. The band's rule stays visible inside the panel, because a tab
 * label short enough to read is too short to explain itself.
 */
/**
 * @param {{ root: string, actions: { band: string, title: string, where: string, why: string, source: string, trend?: string }[] }} report
 * @returns {string} the worklist as HTML, or its own empty state.
 */
export function worklist(report) {
	if (report.actions.length === 0) {
		return `<section class="cluster wide-cluster"><h3>Nothing to act on</h3>
			<p class="empty">Every tool ran and found no work. The vital signs above are all inside their limits.</p>
		</section>`;
	}
	const ranked = report.actions.map((a, rank) => ({ ...a, rank }));
	const present = ["high", "medium", "low"]
		.map((band) => ({ band, rows: ranked.filter((a) => a.band === band) }))
		.filter((b) => b.rows.length > 0);
	const tabs = present.map((b, i) => bandTab(b.band, b.rows, i === 0)).join("");
	const panels = present.map((b, i) => bandPanel(b.band, b.rows, report.root, i === 0)).join("");
	return `<section class="cluster wide-cluster worklist">
		<h3>What to work on <span class="count">${ranked.length} ranked</span></h3>
		<div class="wl-bar">
			<div class="tabs" id="band-tabs" role="tablist" aria-label="Worklist bands">${tabs}</div>
			<div class="group-by" id="wl-group">
				<button type="button" class="gb" data-group-by="off" aria-pressed="true">Flat</button>
				<button type="button" class="gb" data-group-by="tool" aria-pressed="false">By tool</button>
				<button type="button" class="gb" data-group-by="dir" aria-pressed="false">By directory</button>
			</div>
		</div>${panels}
	</section>`;
}

// ------------------------------------------------------------------ the tables view

const classOf = (column) => `${column.num ? "num " : ""}${column.mono ? "mono" : ""}`.trim();

const cell = (value, column) => {
	if (blank(value)) return `<td class="${classOf(column)}">—</td>`;
	if (!column.meter) return `<td class="${classOf(column)}">${escape(value)}</td>`;
	const { amount, max, state } = column.meter(value);
	return `<td class="num has-meter">${meter(amount, max, state)}<b>${escape(value)}</b></td>`;
};

const head = (c) =>
	`<th class="${c.num ? "num" : ""}" scope="col" aria-sort="none" tabindex="0">${escape(c.label)}</th>`;

/**
 * A table, and the only place a row is written.
 *
 * `scope`, `aria-sort` and `tabindex` are on the header because sorting is a real control
 * and a control a keyboard cannot reach is a control half the readers do not have.
 */
const bodyRow = (r, columns, groupBy, rank) => {
	const key = groupBy === undefined ? "" : ` data-group="${escape(r[groupBy])}"`;
	return `<tr data-rank="${rank}"${key}>${r.map((v, i) => cell(v, columns[i])).join("")}</tr>`;
};

/**
 * A table. `groupBy` names the column whose value each row carries as `data-group`, which
 * is all the markup a grouped view needs — the headings themselves are inserted by script
 * so grouping composes with filtering and sorting instead of fighting them.
 */
const table = (columns, rows, groupBy) => `<div class="wide"><table${groupBy === undefined ? "" : ' data-groupable="1"'}>
	<thead><tr>${columns.map(head).join("")}</tr></thead>
	<tbody>${rows.map((r, i) => bodyRow(r, columns, groupBy, i)).join("")}</tbody>
</table></div>`;

const group = (id, title, count, body, rows) =>
	`<section class="group" id="g-${id}" data-matches="${rows}">
		<h2>${escape(title)} <span class="count">${escape(count)}</span></h2>${body}</section>`;

/**
 * `layers` and nothing else — `caps`, `coverage` and `fallow` belong to `modules` below,
 * and naming them here would make this function refuse a fixture it reads nothing from.
 *
 * @param {{ layers: { layer: string, files: number, lines: number, statements: number, avgMaintainability: number, fanIn: number, fanOut: number }[] }} report
 * @returns {string} the architecture table as HTML.
 */
export function architecture(report) {
	const columns = [
		{ label: "layer" },
		{ label: "files", num: true },
		{ label: "lines", num: true },
		{ label: "statements %", num: true, meter: (v) => ({ amount: v, max: 100, state: v < 90 ? "warn" : "neutral" }) },
		{ label: "maintainability", num: true, meter: (v) => ({ amount: v, max: 100, state: "neutral" }) },
		{ label: "fan-in", num: true },
		{ label: "fan-out", num: true },
	];
	const rows = report.layers.map((l) => [l.layer, l.files, l.lines, l.statements, l.avgMaintainability, l.fanIn, l.fanOut]);
	return group("architecture", "Architecture", `${report.layers.length} layers`, table(columns, rows), rows.length);
}

export function modules(report) {
	const cap = new Map(report.caps.map((c) => [c.path, c]));
	const cov = new Map((report.coverage.files ?? []).map((f) => [f.path, f]));
	const trend = new Map(report.fallow.hotspots.map((h) => [h.path, h.trend]));
	const columns = [
		{ label: "module", mono: true },
		{ label: "layer" },
		{ label: "lines", num: true, meter: (v) => ({ amount: v, max: 400, state: v > 360 ? "warn" : "neutral" }) },
		{ label: "cap", num: true },
		{ label: "statements %", num: true, meter: (v) => ({ amount: v, max: 100, state: v < 90 ? "warn" : "neutral" }) },
		{ label: "maintainability", num: true, meter: (v) => ({ amount: v, max: 100, state: "neutral" }) },
		{ label: "cyclomatic", num: true },
		{ label: "fan-in", num: true },
		{ label: "fan-out", num: true },
		{ label: "churn" },
	];
	// `layerOf` is imported rather than restated: two spellings of the layer map is how
	// this table and the rollup above start disagreeing about where a file lives.
	const capPair = (c) => (c ? [c.counted, c.cap] : [null, null]);
	const rows = report.fallow.fileScores
		.filter((s) => layerOf(s.path))
		.map((s) => [
			s.path,
			layerOf(s.path),
			...capPair(cap.get(s.path)),
			cov.get(s.path)?.statements,
			s.maintainability_index,
			s.total_cyclomatic,
			s.fan_in,
			s.fan_out,
			trend.get(s.path),
		]);
	// Column 1 is the layer, so grouping by it needs no second source of truth.
	const control = `<div class="group-by">
		<button type="button" class="gb" data-group-by="off" aria-pressed="true">Flat</button>
		<button type="button" class="gb" data-group-by="1" aria-pressed="false">By layer</button>
	</div>`;
	return group("modules", "Modules", `${rows.length} files`, control + table(columns, rows, 1), rows.length);
}

export function debt(report) {
	if (report.debt.length === 0) {
		return group("debt", "Debt", "0 open", `<p class="empty">Nothing open in docs/bugs or docs/issues.</p>`, 0);
	}
	const rows = report.debt.map((d) => [d.kind, d.title, d.path]);
	const columns = [{ label: "kind" }, { label: "title" }, { label: "note", mono: true }];
	return group("debt", "Debt", `${report.debt.length} open`, table(columns, rows), rows.length);
}

const findingRows = (items) =>
	items.map((i) => [
		firstOf(i.path, i.package_name),
		i.line,
		firstOf(i.actions?.[0]?.description),
	]);

/**
 * The first value that is actually there, or the em dash.
 *
 * Extracted because a chain of `??` fallbacks is a branch each, and nothing in `scripts/`
 * carries coverage: `vitest.config.mts` includes only src, so fallow estimates these at
 * its lowest coverage tier and CRAP becomes cyclomatic squared plus cyclomatic. That
 * crosses the threshold of 30 at a cyclomatic of 5, so the budget in this directory is 4.
 * Written inline, this one scored 42.
 */
const firstOf = (...values) => values.find((v) => v !== null && v !== undefined) ?? "—";

export function findings(report) {
	const nonZero = report.fallow.findings.filter((f) => f.count > 0);
	const zero = report.fallow.findings.filter((f) => f.count === 0);
	const columns = [{ label: "where", mono: true }, { label: "line", num: true }, { label: "suggested action" }];
	const detail = nonZero.map(
		(f) =>
			`<h3>${escape(f.key)} <span class="count">${escape(f.count)}</span></h3>` +
			table(columns, findingRows(f.items)),
	);
	// The zero counters collapse rather than disappear: a check quietly dropped from
	// fallow must not read the same as a check that passed.
	const allClear = `<p class="empty">${zero.length} other check(s) reported nothing: ${escape(zero.map((f) => f.key).join(", "))}.</p>`;
	const schema =
		report.fallow.schemaVersion === 7
			? ""
			: `<p class="empty warn-text">Fallow's schema is version ${escape(report.fallow.schemaVersion)}, not the 7 this report was written against. Its shape may have changed.</p>`;
	const rowCount = nonZero.reduce((n, f) => n + f.items.length, 0);
	return group("findings", "All findings", `${nonZero.length} non-zero`, schema + detail.join("") + allClear, rowCount);
}
