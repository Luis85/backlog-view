import { escape } from "./health-sections.mjs";

/**
 * The report's drawn figures.
 *
 * **Three of the four are HTML, not SVG.** They were SVG with `inline-size: 100%`, which
 * stretched a 620-unit viewBox across an 1100px container and scaled every 11px label to
 * about 20px along with the stroke widths — the reason they read as crude. Bars and cells
 * are rectangles with text in them, which is what HTML is, so they are HTML: the type
 * renders at its real size and hairlines stay hairlines. The two SVG figures live in
 * `health-scatter.mjs`, because a hundred positioned marks is the one thing here that HTML
 * cannot draw.
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

/** One figure card. Exported for `health-scatter.mjs`, the only other module that draws one. */
export const figure = (title, note, body, extra = "") =>
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
	return `<div class="mx-cell${shade}"><span class="mx-none" aria-hidden="true">·</span></div>`;
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


/**
 * What is missing, and the one command that brings it back.
 *
 * Without `coverage/coverage-final.json` this page loses two figures and four vital signs
 * — and used to lose them in silence, leaving the reader to conclude the report was
 * thinner than it is. A fresh clone is in this state, so it is a first-run state and not
 * an error.
 */
const missingCoverage = (coverage) =>
	figure(
		"Complexity against coverage",
		"not measured",
		`<p class="empty">${escape(coverage.reason).replace(/`([^`]+)`/g, "<code>$1</code>")}
		Coverage by module and the four coverage vital signs come from that file; nothing
		else on this page needs it.</p>`,
		" figure-wide",
	);
