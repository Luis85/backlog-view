import { escape } from "./health-sections.mjs";

/**
 * The report's drawn figures.
 *
 * **Three of the four are HTML, not SVG.** They were SVG with `inline-size: 100%`, which
 * stretched a 620-unit viewBox across an 1100px container and scaled every 11px label to
 * about 20px along with the stroke widths — the reason they read as crude. Bars and cells
 * are rectangles with text in them, which is what HTML is, so they are HTML: the type
 * renders at its real size and hairlines stay hairlines. Only the scatter stays SVG,
 * because a hundred positioned marks is what SVG is for, and it is given a natural size
 * it may shrink from and never grow past.
 *
 * **Every figure here is ONE series plus status.** That is not a limitation, it is the
 * page's rule made structural: colour marks a problem and nothing else. So there is no
 * categorical palette, no legend, and no hue cycling anywhere — a validator run over the
 * marks that co-occur here confirms the set is a neutral plus two status colours rather
 * than a series ramp.
 *
 * Each figure earns its place against a table of the same numbers only if the SHAPE says
 * something the rows cannot. No trends: the report has no history, and an axis with one
 * point is a lie.
 */

const figure = (title, note, body, extra = "") =>
	`<section class="figure${extra}">
		<h3>${escape(title)}<span class="count">${escape(note)}</span></h3>
		${body}
	</section>`;

// ----------------------------------------------------------- the layer dependency matrix

/**
 * The architecture in the order the guide states it, with the two leaves last.
 *
 * `src/CLAUDE.md`: main → commands → view → storage → domain, each layer reaching anything
 * below it and nothing above. `ui/` and `i18n/` are leaves rather than rungs — `ui/` knows
 * about none of them and `i18n/` sits below every layer — so they sit outside the ladder
 * and any layer may reach them.
 */
const LADDER = ["main", "commands", "view", "storage", "domain"];
const LEAVES = ["ui", "i18n"];
const ORDER = [...LADDER, ...LEAVES];

/**
 * ONE spelling of the key, because there were two.
 *
 * The map was written with a NUL separator and read back with a space, so every lookup
 * missed and every cell rendered empty — while the caption above it, counted from the
 * array rather than the map, still read "15 edges, none in the shaded region". An empty
 * matrix is what a clean result looks like, so the figure was wrong in the direction
 * that reassures. Both sides now call this.
 */
const edgeKey = (from, to) => from + String.fromCharCode(0) + to;

const rank = (layer) => ORDER.indexOf(layer);
const isLegal = (from, to) => LEAVES.includes(to) || rank(from) < rank(to);

/**
 * A matrix, not an arc diagram.
 *
 * The arcs were unreadable at seven nodes and fifteen edges — every arc crossed every
 * other, and thickness was the only channel left. A from × to matrix gives each edge its
 * own cell, so the count is a number rather than a width, and it makes the architectural
 * rule GEOMETRIC: with the layers in ladder order, every legal edge lands above the
 * diagonal or in a leaf column. The shaded region is where a violation would appear, and
 * it is empty. That is a claim the reader can check by looking, which is the whole reason
 * to draw this rather than tabulate it.
 */
/** The cells carrying no count: the diagonal, and any pair that never imports. */
function emptyCell(from, to) {
	if (from === to) return `<div class="mx-cell mx-self" aria-hidden="true"></div>`;
	const shade = isLegal(from, to) ? "" : " mx-forbidden";
	return `<div class="mx-cell${shade}"><span class="mx-none">·</span></div>`;
}

const cellClass = (legal, step) => (legal ? `mx-on mx-s${step}` : "mx-violation");

function matrixCell(from, to, counts, widest) {
	const count = counts.get(edgeKey(from, to)) ?? 0;
	if (count === 0 || from === to) return emptyCell(from, to);
	const legal = isLegal(from, to);
	// Sequential: one hue in seven real steps, light to dark, on a log scale so 1 and 223
	// both read. Not alpha over the surface, which is what this was — a single mid-blue
	// faded by opacity. That looked like a ramp and behaved like one until the top of it,
	// where full-strength blue under pale text measured 4.42:1, and it left the ink
	// undecidable in CSS because only this side knows the step. Each step now owns its
	// own ink, chosen against that step and measured, not guessed.
	const weight = Math.log(count + 1) / Math.log(widest + 1);
	const step = Math.min(6, Math.floor(weight * 7));
	const state = cellClass(legal, step);
	return `<div class="mx-cell ${state}"
		title="${escape(from)} imports ${escape(to)}: ${escape(count)} edges">${escape(count)}</div>`;
}

export function layerMatrix(report) {
	const cross = report.graph.filter((e) => e.from !== e.to);
	if (cross.length === 0) return "";
	const counts = new Map(cross.map((e) => [edgeKey(e.from, e.to), e.count]));
	const widest = Math.max(...cross.map((e) => e.count));
	const violations = cross.filter((e) => !isLegal(e.from, e.to));
	const head = ORDER.map((to) => `<div class="mx-head mx-col">${escape(to)}</div>`).join("");
	const body = ORDER.map(
		(from) =>
			`<div class="mx-head mx-row">${escape(from)}</div>` +
			ORDER.map((to) => matrixCell(from, to, counts, widest)).join(""),
	).join("");
	const verdict =
		violations.length === 0
			? `${cross.length} edges, none in the shaded region`
			: `${violations.length} edge(s) break the layer rule`;
	const status = violations.length === 0 ? "" : " is-critical";
	return figure(
		"Imports between layers",
		verdict,
		`<div class="mx" style="--n:${ORDER.length}">
			<div class="mx-corner"><span>from ↓</span><span>to →</span></div>${head}${body}
		</div>
		<p class="fig-note${status}">Reading down then across: a cell is one layer importing another.
		The shaded cells are the imports the layer rule forbids — a layer reaching upward.</p>`,
		" figure-wide",
	);
}

// ------------------------------------------------------------------------- distributions

const bucketRow = (b, widest) => {
	const share = b.count === 0 ? 0 : Math.max(1.5, (b.count / widest) * 100);
	return `<div class="dist-row">
		<div class="dist-label">${escape(b.label)}</div>
		<div class="dist-track"><div class="dist-bar dist-${b.state}" style="inline-size:${share.toFixed(1)}%"></div></div>
		<div class="dist-count">${escape(b.count)}</div>
	</div>`;
};

const distribution = (title, note, buckets) =>
	figure(title, note, `<div class="dist">${buckets.map((b) => bucketRow(b, Math.max(...buckets.map((x) => x.count), 1))).join("")}</div>`);

const into = (values, edges) =>
	edges.map(({ label, test, state }) => ({ label, state, count: values.filter(test).length }));

/** Where the thin coverage actually is, without sorting a hundred rows to find out. */
export function coverageDistribution(report) {
	if (!report.coverage.present) return "";
	const values = report.coverage.files.filter((f) => f.path.startsWith("src/")).map((f) => f.statements);
	const buckets = into(values, [
		{ label: "100%", test: (v) => v === 100, state: "calm" },
		{ label: "99–100%", test: (v) => v >= 99 && v < 100, state: "calm" },
		{ label: "95–99%", test: (v) => v >= 95 && v < 99, state: "calm" },
		{ label: "90–95%", test: (v) => v >= 90 && v < 95, state: "calm" },
		{ label: "under 90%", test: (v) => v < 90, state: "attention" },
	]);
	return distribution("Coverage by module", `${values.length} modules, statements`, buckets);
}

/** Whether the near-cap files are outliers or the leading edge of a trend. */
export function capDistribution(report) {
	const values = report.caps.map((c) => c.counted / c.cap);
	const buckets = into(values, [
		{ label: "95% of cap +", test: (v) => v >= 0.95, state: "critical" },
		{ label: "90–95%", test: (v) => v >= 0.9 && v < 0.95, state: "attention" },
		{ label: "75–90%", test: (v) => v >= 0.75 && v < 0.9, state: "calm" },
		{ label: "50–75%", test: (v) => v >= 0.5 && v < 0.75, state: "calm" },
		{ label: "under half", test: (v) => v < 0.5, state: "calm" },
	]);
	return distribution("Line-cap headroom", `${values.length} capped files`, buckets);
}

// ------------------------------------------------------------------------- risk scatter

/**
 * Natural size, never stretched.
 *
 * The chart may shrink on a narrow window and may never grow past these numbers, which is
 * what keeps the labels at their real size. The previous version set `inline-size: 100%`
 * and scaled everything on the page's own width.
 */
const PLOT = { w: 680, h: 340, left: 52, bottom: 40, top: 16, right: 16 };
const inner = { w: PLOT.w - PLOT.left - PLOT.right, h: PLOT.h - PLOT.top - PLOT.bottom };

const RISKY_COVERAGE = 90;

const dot = (file, maxDensity) => {
	const x = PLOT.left + (file.density / maxDensity) * inner.w;
	const y = PLOT.top + (1 - file.coverage / 100) * inner.h;
	const risky = file.coverage < RISKY_COVERAGE && file.density > maxDensity / 2;
	return `<circle class="sc-dot${risky ? " sc-risky" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${risky ? 5 : 3.5}">
		<title>${escape(file.path)} — ${escape(file.coverage)}% covered, complexity density ${escape(file.density)}</title>
	</circle>`;
};

const gridline = (share) => {
	const y = PLOT.top + (1 - share / 100) * inner.h;
	return `<line class="sc-grid" x1="${PLOT.left}" y1="${y}" x2="${PLOT.left + inner.w}" y2="${y}"></line>
		<text class="sc-tick" x="${PLOT.left - 10}" y="${y + 4}" text-anchor="end">${share}%</text>`;
};

/**
 * Complexity against coverage, which is CRAP as a picture.
 *
 * A module is risky when it is both complex and untested; neither number alone says so,
 * and a table sorted by either one hides the pairing. The band is drawn rather than
 * outlined because its edge is a heuristic, not a threshold anything enforces — and the
 * few marks inside it are enlarged and coloured, so the answer survives being read at a
 * glance or in greyscale.
 */
export function riskScatter(report) {
	if (!report.coverage.present) return "";
	const coverageBy = new Map(report.coverage.files.map((f) => [f.path, f.statements]));
	const files = report.fallow.fileScores
		.filter((s) => coverageBy.has(s.path))
		.map((s) => ({ path: s.path, density: s.complexity_density, coverage: coverageBy.get(s.path) }));
	if (files.length === 0) return "";
	const maxDensity = Math.max(...files.map((f) => f.density), 0.01);
	const risky = files.filter((f) => f.coverage < RISKY_COVERAGE && f.density > maxDensity / 2);
	const bandX = PLOT.left + inner.w / 2;
	const bandY = PLOT.top + (1 - RISKY_COVERAGE / 100) * inner.h;
	const band = `<rect class="sc-band" x="${bandX}" y="${bandY}" width="${inner.w / 2}" height="${PLOT.top + inner.h - bandY}"></rect>
		<text class="sc-band-label" x="${bandX + 10}" y="${bandY + 18}">complex and thinly covered</text>`;
	const axes = `<line class="sc-axis" x1="${PLOT.left}" y1="${PLOT.top + inner.h}" x2="${PLOT.left + inner.w}" y2="${PLOT.top + inner.h}"></line>
		<text class="sc-axis-label" x="${PLOT.left}" y="${PLOT.h - 8}">← simpler</text>
		<text class="sc-axis-label" x="${PLOT.left + inner.w}" y="${PLOT.h - 8}" text-anchor="end">more complex →</text>
		<text class="sc-axis-label sc-vertical" transform="translate(14,${PLOT.top + inner.h / 2}) rotate(-90)" text-anchor="middle">statements covered</text>`;
	const note = risky.length === 0 ? "nothing in the band" : `${risky.length} in the band`;
	return figure(
		"Complexity against coverage",
		note,
		`<svg class="scatter" viewBox="0 0 ${PLOT.w} ${PLOT.h}" role="img"
			aria-label="Every module plotted by complexity density and statement coverage">
			${[100, 90, 50, 0].map(gridline).join("")}${band}${axes}
			${files.map((f) => dot(f, maxDensity)).join("")}
		</svg>`,
		" figure-wide",
	);
}
