import { figure } from "./health-charts.mjs";
import { escape } from "./health-sections.mjs";

/**
 * The two scatters, and the geometry both stand on.
 *
 * Split from `health-charts.mjs` when the second one arrived: the matrix and the
 * distributions are HTML, these are SVG, and the placing, the label de-collision and the
 * tick drawing are shared between them and nothing else. A hundred positioned marks is
 * what SVG is for; a bar with a number in it is what HTML is, which is why the split falls
 * here rather than by figure count.
 *
 * **Neither draws a filled quadrant, and that is a decision, not an omission.** The risk
 * scatter had one: it covered three fifths of the plot to contain a single dot and its
 * boundary was an arbitrary half-of-maximum. A line at a rule that exists — the coverage
 * floor — is arguable; a box at half of whatever the worst file happens to be is not. The
 * churn figure has no such rule available, so it draws no boundary at all and names the
 * corner instead.
 */

/**
 * The plot fills its card. The gutter on the right was 160 units of label lane, and with
 * the 1040-unit cap on the element it left a fifth of the card empty — so the figure read
 * as a chart standing in a box rather than as the box. The names go leftward from the
 * midpoint instead (the flip below), which needs a pad and not a lane.
 */
const PLOT = { w: 1040, h: 400, left: 58, bottom: 46, top: 18, right: 30 };
const inner = { w: PLOT.w - PLOT.left - PLOT.right, h: PLOT.h - PLOT.top - PLOT.bottom };
const BASE = PLOT.top + inner.h;
const RIGHT = PLOT.left + inner.w;

/**
 * **The coverage axis starts at 75%, not at zero, and the chart says so.**
 *
 * Two thirds of this repository's modules sit at exactly 100% and 104 of 111 are at 95%
 * or better, so a full axis spent nine tenths of its height on empty space and stacked
 * most of the data on one row of pixels. Truncating is the right move for a scatter — the
 * zero rule belongs to bars, whose LENGTH is the value — but a truncated axis that does
 * not admit it is a lie, so the note under the figure states the floor. The CHURN figure
 * takes the other decision for the same reason: both its axes start at zero, because a
 * file with no commits and a file with no branching are both real and both belong on it.
 */
const Y_FLOOR = 75;
const THIN = 90;

const xAt = (value, max) => PLOT.left + (value / max) * inner.w;
const yAt = (value, max) => PLOT.top + (1 - value / max) * inner.h;
const yCoverage = (coverage) => PLOT.top + (1 - (coverage - Y_FLOOR) / (100 - Y_FLOOR)) * inner.h;

/**
 * A dot, from coordinates the caller has already placed.
 *
 * The hit target is a generous transparent circle over the mark: a 3.5px dot you must hit
 * dead centre is not a hover affordance, and both of these scatters are dense along one
 * edge.
 */
const dot = ({ x, y, kind, hover }) =>
	`<circle class="sc-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13"><title>${escape(hover)}</title></circle>
		<circle class="sc-dot sc-${kind}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${kind === "plain" ? 3.5 : 5.5}"></circle>`;

const LABEL_GAP = 17;

/**
 * The named points, pushed apart so the names stay readable.
 *
 * Two modules with the same value on the horizontal axis put their labels on the same
 * line, which is how six labels still managed one collision. This walks them in vertical
 * order and moves any that lands within a line-height of the previous one; the mark stays
 * where the data puts it, only the text moves, so nothing is misplaced by the tidy-up.
 */
function labelsFor(points) {
	const placed = [...points].sort((a, b) => a.y - b.y);
	let lowest = -Infinity;
	for (const label of placed) {
		label.y = Math.max(label.y, lowest + LABEL_GAP);
		lowest = label.y;
	}
	return placed
		.map(({ name, x, y }) => {
			// The right gutter is a pad, not a label lane: the plot runs to the edge of the
			// card, so anything past the midpoint names itself leftward instead of into
			// space that is not there.
			const flip = x > PLOT.left + inner.w * 0.5;
			return `<text class="sc-label" x="${(x + (flip ? -11 : 11)).toFixed(1)}" y="${(y + 4).toFixed(1)}"
				text-anchor="${flip ? "end" : "start"}">${escape(name.replace(/^src\//, ""))}</text>`;
		})
		.join("");
}

/** A horizontal gridline with its value in the margin. */
const yTick = (label, y) =>
	`<line class="sc-grid" x1="${PLOT.left}" y1="${y.toFixed(1)}" x2="${RIGHT}" y2="${y.toFixed(1)}"></line>
		<text class="sc-tick" x="${PLOT.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${escape(label)}</text>`;

/** A value under the baseline. No vertical gridlines: the horizontal ones carry the read. */
const xTick = (label, x) =>
	`<text class="sc-tick" x="${x.toFixed(1)}" y="${BASE + 22}" text-anchor="middle">${escape(label)}</text>`;

/** The baseline and the two axis names, which every scatter here has and nothing else does. */
const frame = (xLabel, yLabel) =>
	`<line class="sc-axis" x1="${PLOT.left}" y1="${BASE}" x2="${RIGHT}" y2="${BASE}"></line>
		<text class="sc-axis-label" x="${PLOT.left + inner.w / 2}" y="${PLOT.h - 8}" text-anchor="middle">${escape(xLabel)}</text>
		<text class="sc-axis-label" transform="translate(15,${PLOT.top + inner.h / 2}) rotate(-90)" text-anchor="middle">${escape(yLabel)}</text>`;

const plot = (label, body) =>
	`<svg class="scatter" viewBox="0 0 ${PLOT.w} ${PLOT.h}" role="img" aria-label="${escape(label)}">${body}</svg>`;

// --------------------------------------------------------- complexity against coverage

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

/** Thin, complex, or ordinary — and only the first two earn a colour and a name. */
function classify(file, denseFrom) {
	if (file.coverage < THIN) return "critical";
	if (file.density >= denseFrom && file.coverage < 100) return "attention";
	return "plain";
}

const riskPoint = (file, maxDensity, kind) => ({
	kind,
	name: file.path,
	x: xAt(file.density, maxDensity),
	y: yCoverage(Math.max(file.coverage, Y_FLOOR)),
	hover: `${file.path} — ${file.coverage}% covered, ${file.density} cyclomatic per line`,
});

/**
 * Complexity against coverage, which is CRAP as a picture.
 *
 * A module is risky when it is both complex and untested; neither number alone says so,
 * and a table sorted by either one hides the pairing. What the shape says here is that
 * there is no systemic problem — the mass sits along the top — so the figure's real job
 * is the handful of points that leave it, and those are NAMED rather than left for the
 * reader to hunt for with a pointer.
 */
export function riskScatter(report) {
	if (!report.coverage.present) return missingCoverage(report.coverage);
	const coverageBy = new Map(report.coverage.files.map((f) => [f.path, f.statements]));
	const files = report.fallow.fileScores
		.filter((s) => coverageBy.has(s.path))
		.map((s) => ({ path: s.path, density: s.complexity_density, coverage: coverageBy.get(s.path) }));
	if (files.length === 0) return "";
	const maxDensity = Math.max(...files.map((f) => f.density), 0.01);
	const descending = files.map((f) => f.density).sort((a, b) => b - a);
	const denseFrom = descending[Math.floor(descending.length * 0.1)] ?? maxDensity;
	const points = files.map((f) => riskPoint(f, maxDensity, classify(f, denseFrom)));
	const marked = points.filter((p) => p.kind !== "plain");
	// Ten labels collided eight times and read as a smudge. Labelling is the EXTREMES on
	// each axis rather than every classified point — the three thinnest and the three
	// densest — which is a stated rule, fits without overlap, and leaves the rest to the
	// hover. Colour still marks the whole classified set, so nothing is hidden by this.
	const thinnest = [...files].sort((a, b) => a.coverage - b.coverage).slice(0, 3);
	const densest = [...files].sort((a, b) => b.density - a.density).slice(0, 3);
	const named = [...new Set([...thinnest, ...densest])].map((f) => riskPoint(f, maxDensity, "named"));
	const thin = yCoverage(THIN);
	const rule = `<line class="sc-threshold" x1="${PLOT.left}" y1="${thin.toFixed(1)}" x2="${RIGHT}" y2="${thin.toFixed(1)}"></line>
		<text class="sc-threshold-label" x="${RIGHT}" y="${(thin - 8).toFixed(1)}" text-anchor="end">under ${THIN}% counts as thin</text>`;
	const ticks =
		[100, 95, 90, 85, 80].map((v) => yTick(`${v}%`, yCoverage(v))).join("") +
		[0, 0.1, 0.2, 0.3].filter((v) => v <= maxDensity).map((v) => xTick(v, xAt(v, maxDensity))).join("");
	return figure(
		"Complexity against coverage",
		`${points.length - marked.length} of ${points.length} unremarkable`,
		plot(
			"Every module plotted by complexity density and statement coverage",
			ticks + frame("cyclomatic per line →", "statements covered") + rule +
				points.map(dot).join("") + labelsFor(named),
		) +
			`<p class="fig-note">The vertical axis starts at ${Y_FLOOR}%, not zero: two thirds of these
		modules sit at exactly 100%, and a full axis stacks them on one line. The named points are
		the ones under the coverage rule, or in the densest tenth and not fully covered.</p>`,
		" figure-wide",
	);
}

// -------------------------------------------------------------- churn against complexity

const TREND_ORDER = ["accelerating", "stable", "cooling"];

const churnPoint = (h, maxChurn, maxDensity, kind) => ({
	kind,
	name: h.path,
	x: xAt(h.weighted_commits, maxChurn),
	y: yAt(h.complexity_density, maxDensity),
	hover: `${h.path} — ${h.commits} commits, +${h.lines_added}/-${h.lines_deleted} lines, ${h.trend}`,
});

/** How many files are moving which way, which is the one thing a single snapshot can say. */
const trendNote = (hot) =>
	TREND_ORDER.map((t) => `${hot.filter((h) => h.trend === t).length} ${t}`).join(", ");

/**
 * Churn against complexity — the third tool's number, and the pairing this page exists for.
 *
 * Fallow computes a per-file history from git and the report has always read it: the
 * worklist's top rows come from it. The page never DREW it, so the one figure the register
 * says the report is for — relating churn, complexity and coverage rather than reading
 * three terminal outputs — was two thirds built. A file that is complex and never touched
 * is stable code; the same file rewritten every week is where the next defect will be, and
 * only the pair says which one you are looking at.
 *
 * **This is not a trend line, and the axis is not time.** `docs/requirements/One page for
 * what the tools already know` and the note in `health-charts.mjs` both refuse a trend
 * drawn from one snapshot — an axis with one point is a lie. What fallow supplies is a
 * per-file DIRECTION it computed from the commit history itself, so the direction is
 * reported as a count under the figure and as a word on the rows, never as a slope.
 *
 * Colour marks the files fallow puts in its top percentile, which are exactly the rows the
 * worklist already carries — so the figure and the list cannot disagree about what a
 * hotspot is. There is deliberately no boundary drawn: fallow's own `hotspot_count` is the
 * only threshold in evidence, and where it is zero, a box would be an invention.
 */
export function churnScatter(report) {
	const hot = report.fallow.hotspots ?? [];
	if (hot.length === 0) return "";
	const ranked = [...hot].sort((a, b) => b.score - a.score);
	const top = new Set(ranked.slice(0, report.fallow.vitalSigns.hotspot_top_pct_count).map((h) => h.path));
	const maxChurn = Math.max(...hot.map((h) => h.weighted_commits), 1);
	const maxDensity = Math.max(...hot.map((h) => h.complexity_density), 0.01);
	const points = hot.map((h) => churnPoint(h, maxChurn, maxDensity, top.has(h.path) ? "attention" : "plain"));
	// The named points are the busiest-and-most-complex by fallow's own score, and never
	// more than five: this figure's job is the corner, and the corner is where the labels
	// would otherwise pile up.
	const named = ranked.slice(0, 5).map((h) => churnPoint(h, maxChurn, maxDensity, "named"));
	const ticks =
		[0, 0.1, 0.2, 0.3].filter((v) => v <= maxDensity).map((v) => yTick(v, yAt(v, maxDensity))).join("") +
		[0, 25, 50, 75, 100].filter((v) => v <= maxChurn).map((v) => xTick(v, xAt(v, maxChurn))).join("");
	return figure(
		"Churn against complexity",
		`${top.size} of ${hot.length} in fallow's top percentile`,
		plot(
			"Every module with commit history plotted by weighted commits and complexity density",
			ticks + frame("weighted commits →", "cyclomatic per line") +
				points.map(dot).join("") + labelsFor(named),
		) +
			`<p class="fig-note">Commits are weighted by age, so a file rewritten last month counts for
		more than one rewritten last year. The top-right corner is where change meets complexity;
		nothing is shaded, because fallow's own hotspot threshold is met by
		${report.fallow.vitalSigns.hotspot_count} of these files and a boundary drawn anywhere else
		would be invented. Direction, from the same history: ${trendNote(hot)}.</p>`,
		" figure-wide",
	);
}
