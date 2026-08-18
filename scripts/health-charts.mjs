import { escape } from "./health-sections.mjs";

/**
 * The report's drawn figures. SVG only, no library, no canvas.
 *
 * Each one has to earn its place against a table of the same numbers, and the test is
 * whether the SHAPE says something the rows cannot. A bar chart of four buckets does; a
 * sparkline of one snapshot does not, which is why there are no trends here — the report
 * has no history and an axis with one point is a lie.
 *
 * Everything is drawn in Obsidian tokens through `currentColor` and CSS classes rather
 * than SVG fill attributes, so a theme change repaints the diagrams with the page.
 */

const svg = (w, h, body, label) =>
	`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(label)}"
		preserveAspectRatio="xMidYMid meet">${body}</svg>`;

// --------------------------------------------------------------- the layer dependency map

/**
 * The architecture, in the order the guide states it, with the two leaves apart.
 *
 * `src/CLAUDE.md`: main → commands → view → storage → domain, each layer reaching
 * anything below it and nothing above. `ui/` and `i18n/` are leaves rather than rungs —
 * `ui/` knows about none of them and `i18n/` sits below every layer — so they are drawn
 * outside the ladder. Putting them in it would invent an ordering the code does not have.
 */
const LADDER = ["main", "commands", "view", "storage", "domain"];
const LEAVES = ["ui", "i18n"];
const ORDER = [...LADDER, ...LEAVES];

const rank = (layer) => ORDER.indexOf(layer);

/** Downward or sideways-into-a-leaf is the rule; anything else is a violation to see. */
const isLegal = (edge) => LEAVES.includes(edge.to) || rank(edge.from) < rank(edge.to);

const ROW = 40;
const BOX_W = 176;
const TOP = 26;

function layerBox(layer, index, counts) {
	const y = TOP + index * ROW;
	const files = counts.get(layer) ?? 0;
	return `<g class="lm-box">
		<rect x="0" y="${y}" width="${BOX_W}" height="28" rx="4"></rect>
		<text x="12" y="${y + 18}" class="lm-name">${escape(layer)}</text>
		<text x="${BOX_W - 12}" y="${y + 18}" class="lm-files" text-anchor="end">${escape(files)}</text>
	</g>`;
}

function edgeArc(edge, widest) {
	const y1 = TOP + rank(edge.from) * ROW + 14;
	const y2 = TOP + rank(edge.to) * ROW + 14;
	const bulge = 30 + Math.abs(rank(edge.from) - rank(edge.to)) * 26;
	const width = 1 + Math.round((edge.count / widest) * 5);
	const legal = isLegal(edge) ? "legal" : "violation";
	return `<path class="lm-edge lm-${legal}" stroke-width="${width}"
		d="M ${BOX_W},${y1} C ${BOX_W + bulge},${y1} ${BOX_W + bulge},${y2} ${BOX_W},${y2}"></path>
		<title>${escape(edge.from)} imports ${escape(edge.to)} — ${escape(edge.count)} edges</title>`;
}

/**
 * Layer-to-layer imports, and the only picture here that can FALSIFY a claim.
 *
 * The repository states an architectural rule and enforces it with per-directory
 * `no-restricted-imports`, so a violation fails lint rather than reaching this page. That
 * is exactly why the drawing is worth having: it shows the shape the rule produces, makes
 * the traffic between layers legible, and would render an upward arc in the error colour
 * the moment one existed. Counts come from fallow's real import graph, not from fan-in.
 */
export function layerMap(report) {
	const cross = report.graph.filter((e) => e.from !== e.to);
	if (cross.length === 0) return "";
	const counts = new Map(report.layers.map((l) => [l.layer, l.files]));
	const widest = Math.max(...cross.map((e) => e.count));
	const height = TOP + ORDER.length * ROW + 8;
	const boxes = ORDER.map((layer, i) => layerBox(layer, i, counts));
	const arcs = cross.map((e) => edgeArc(e, widest));
	const divider = `<line class="lm-divider" x1="0" y1="${TOP + LADDER.length * ROW - 6}"
		x2="${BOX_W}" y2="${TOP + LADDER.length * ROW - 6}"></line>
		<text x="${BOX_W + 8}" y="${TOP + LADDER.length * ROW + 8}" class="lm-note">leaves</text>`;
	const violations = cross.filter((e) => !isLegal(e)).length;
	const verdict = violations === 0
		? `${cross.length} cross-layer edges, all of them downward.`
		: `${violations} edge(s) point upward, against the layer rule.`;
	return `<section class="cluster wide-cluster">
		<h3>Layer dependencies <span class="count">${escape(verdict)}</span></h3>
		${svg(BOX_W + 260, height, boxes.join("") + divider + arcs.join(""), "Imports between layers")}
	</section>`;
}

// --------------------------------------------------------------------------- histograms

const BAR_W = 420;

function bucketRow(bucket, index, widest) {
	const y = index * 26;
	const width = bucket.count === 0 ? 0 : Math.max(2, Math.round((bucket.count / widest) * BAR_W));
	return `<g>
		<text x="0" y="${y + 13}" class="hg-label">${escape(bucket.label)}</text>
		<rect class="hg-bar hg-${bucket.state}" x="140" y="${y + 3}" width="${width}" height="13" rx="2"></rect>
		<text x="${140 + width + 8}" y="${y + 13}" class="hg-count">${escape(bucket.count)}</text>
	</g>`;
}

function histogram(title, note, buckets, label) {
	const widest = Math.max(...buckets.map((b) => b.count), 1);
	const body = buckets.map((b, i) => bucketRow(b, i, widest)).join("");
	return `<section class="cluster">
		<h3>${escape(title)} <span class="count">${escape(note)}</span></h3>
		${svg(620, buckets.length * 26, body, label)}
	</section>`;
}

const into = (values, edges) =>
	edges.map(({ label, test, state }) => ({ label, state, count: values.filter(test).length }));

/** Where the thin coverage actually is, without sorting a hundred rows to find out. */
export function coverageHistogram(report) {
	if (!report.coverage.present) return "";
	const values = report.coverage.files.filter((f) => f.path.startsWith("src/")).map((f) => f.statements);
	const buckets = into(values, [
		{ label: "100%", test: (v) => v === 100, state: "calm" },
		{ label: "99 – 100%", test: (v) => v >= 99 && v < 100, state: "calm" },
		{ label: "95 – 99%", test: (v) => v >= 95 && v < 99, state: "calm" },
		{ label: "90 – 95%", test: (v) => v >= 90 && v < 95, state: "calm" },
		{ label: "under 90%", test: (v) => v < 90, state: "warn" },
	]);
	return histogram("Coverage, by module", "statements", buckets, "Modules by statement coverage");
}

/** Whether the near-cap files are outliers or the leading edge of a trend. */
export function capHistogram(report) {
	const values = report.caps.map((c) => c.counted / c.cap);
	const buckets = into(values, [
		{ label: "95% of cap +", test: (v) => v >= 0.95, state: "warn" },
		{ label: "90 – 95%", test: (v) => v >= 0.9 && v < 0.95, state: "warn" },
		{ label: "75 – 90%", test: (v) => v >= 0.75 && v < 0.9, state: "calm" },
		{ label: "50 – 75%", test: (v) => v >= 0.5 && v < 0.75, state: "calm" },
		{ label: "under half", test: (v) => v < 0.5, state: "calm" },
	]);
	return histogram("Line caps, headroom", "counted lines against each cap", buckets, "Files by share of their line cap");
}

// ------------------------------------------------------------------------- risk scatter

const PLOT = { w: 620, h: 300, left: 46, bottom: 34, top: 10, right: 12 };

function point(file, maxDensity) {
	const x = PLOT.left + (file.density / maxDensity) * (PLOT.w - PLOT.left - PLOT.right);
	const y = PLOT.top + (1 - file.coverage / 100) * (PLOT.h - PLOT.top - PLOT.bottom);
	const risky = file.coverage < 90 && file.density > maxDensity / 2;
	return `<circle class="sc-dot ${risky ? "sc-risky" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3">
		<title>${escape(file.path)} — ${escape(file.coverage)}% covered, density ${escape(file.density)}</title>
	</circle>`;
}

/**
 * Complexity against coverage, which is CRAP as a picture.
 *
 * A module is risky when it is both complex and untested; neither number alone says so,
 * and a table sorted by either one hides the pairing. The quadrant is shaded rather than
 * outlined because the boundary is a heuristic, not a threshold anything enforces.
 */
export function riskScatter(report) {
	if (!report.coverage.present) return "";
	const coverageBy = new Map(report.coverage.files.map((f) => [f.path, f.statements]));
	const files = report.fallow.fileScores
		.filter((s) => coverageBy.has(s.path))
		.map((s) => ({ path: s.path, density: s.complexity_density, coverage: coverageBy.get(s.path) }));
	if (files.length === 0) return "";
	const maxDensity = Math.max(...files.map((f) => f.density), 0.01);
	const plotW = PLOT.w - PLOT.left - PLOT.right;
	const plotH = PLOT.h - PLOT.top - PLOT.bottom;
	const zone = `<rect class="sc-zone" x="${PLOT.left + plotW / 2}" y="${PLOT.top + plotH * 0.1}"
		width="${plotW / 2}" height="${plotH * 0.9}"></rect>`;
	const axes = `<line class="sc-axis" x1="${PLOT.left}" y1="${PLOT.top}" x2="${PLOT.left}" y2="${PLOT.top + plotH}"></line>
		<line class="sc-axis" x1="${PLOT.left}" y1="${PLOT.top + plotH}" x2="${PLOT.left + plotW}" y2="${PLOT.top + plotH}"></line>
		<text class="sc-tick" x="${PLOT.left - 8}" y="${PLOT.top + 10}" text-anchor="end">100%</text>
		<text class="sc-tick" x="${PLOT.left - 8}" y="${PLOT.top + plotH}" text-anchor="end">0%</text>
		<text class="sc-tick" x="${PLOT.left}" y="${PLOT.h - 8}">low complexity</text>
		<text class="sc-tick" x="${PLOT.left + plotW}" y="${PLOT.h - 8}" text-anchor="end">high complexity</text>`;
	const dots = files.map((f) => point(f, maxDensity)).join("");
	const risky = files.filter((f) => f.coverage < 90 && f.density > maxDensity / 2).length;
	const note = risky === 0 ? "nothing in the risky quadrant" : `${risky} in the risky quadrant`;
	return `<section class="cluster wide-cluster">
		<h3>Complexity against coverage <span class="count">${escape(note)}</span></h3>
		${svg(PLOT.w, PLOT.h, zone + axes + dots, "Every module plotted by complexity and coverage")}
	</section>`;
}
