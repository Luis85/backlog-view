/**
 * A stopwatch on the harness page — `?perf`, alongside `?notes=800`.
 *
 * It REPORTS. Nothing here asserts, and nothing here enters `npm run check`: a timing
 * check was refused twice in this register, on the ground that a benchmark in jsdom
 * measures jsdom and a threshold on a loaded CI runner is deleted rather than
 * investigated ([[The render path states its costs as checks]], [[The model build states
 * its cost as a check]]). This is the other instrument — a browser, a real layout, and a
 * human reading numbers off a page. ADR 0020 keeps all four of its refusals.
 *
 * What it CANNOT see is on the panel itself, because a number lifted off a screenshot
 * would otherwise be quoted as what the plugin costs in a vault: there is no Bases query
 * pass here, no `metadataCache` behind the fake, no vault I/O and no theme.
 */
import { ProductBacklogView } from '../../src/view/backlogView';
import type { Projection } from '../../src/view/viewStateController';
import { drawnHeight, type Mount } from './mount';

/** Samples per row. Enough that one GC pause moves the worst column and not the median. */
const SAMPLES = 5;

/**
 * Every projection, once — the run times a switch to each in turn, and `?view=` picks
 * one to open on. Exported because `page.ts` had its own copy: the two came apart, this
 * one missing `catalog`, so the table said "every projection" over four of five while
 * the URL knob offered the fifth. One list, or the claim goes stale on the next
 * projection too.
 */
export const PROJECTIONS: Projection[] = ['tree', 'board', 'roadmap', 'deliverables', 'catalog'];

interface Row {
	op: string;
	median: number;
	worst: number;
	/** Rendered height after the op — the layout read that forces the browser to do the work. */
	px: number;
	/**
	 * Rows and cards on screen after the op — every row's OWN sample size.
	 *
	 * One heading cannot state it for the whole table: the tree draws `.pbl-row`, the four
	 * card projections draw `.pbl-card`, and they are not the same population — the board
	 * excludes Deliverables, the Deliverables board draws only those, and the roadmap's
	 * count moves with whether the shelf is open. A table under "832 rows expanded" invited
	 * exactly the reading that every row measured 832 of something.
	 *
	 * Counted after the clock stops, so the query is not in the measurement.
	 */
	drew: number;
}

/**
 * Time `run` `SAMPLES` times and report the median and the worst.
 *
 * `prepare` runs OUTSIDE the clock, for an op that only does something from the other
 * state: `setProjection` returns early when the mode is already current, so timing it
 * five times in a row would time four no-ops and read as a very fast projection switch.
 *
 * The layout read is inside the sample on purpose. The browser would otherwise defer it
 * past the last `performance.now()`, and the number would be the cost of building the
 * DOM with the cost of laying it out left out — which at eight hundred rows is most of
 * the question.
 */
function sample(el: HTMLElement, op: string, run: () => void, prepare?: () => void): Row {
	const times: number[] = [];
	let px = 0;
	for (let i = 0; i < SAMPLES; i++) {
		prepare?.();
		const started = performance.now();
		run();
		px = drawnHeight(el);
		times.push(performance.now() - started);
	}
	const drew = el.querySelectorAll('.pbl-row, .pbl-card').length;
	times.sort((a, b) => a - b);
	return { op, median: times[times.length >> 1] ?? 0, worst: times[times.length - 1] ?? 0, px, drew };
}

/**
 * The four rows, given what the mount cost.
 *
 * `render` is timed beside `update` because `onDataUpdated` builds and renders while
 * `render` only renders, so the pair BOUNDS what the non-render half of a data update can
 * cost. It does not MEASURE it, and the difference is not the model build — a claim this
 * file made until 2026-08-10 and which was wrong by two orders of magnitude.
 *
 * The two medians are sampled at different points in the run and each swings by a
 * hundred milliseconds or more; subtracting them yields anything from ~30 ms to ~700 ms
 * across runs, for a quantity that direct instrumentation puts at ~10 ms. A difference
 * smaller than the noise of its own terms is not a measurement, and reading one off this
 * panel is how the build got blamed for the render's cost — see
 * [[The render is the whole cost of a data update]]. Time the phase itself if you want
 * the phase.
 */
function measure(
	view: ProductBacklogView,
	el: HTMLElement,
	mount: Mount,
): { rows: Row[]; treeRows: number; axis: string | null; grid: string | null } {
	// Restored at the end rather than reset to the tree: the run drives all four, and a
	// `?perf&view=board` page has to be left showing the board it was asked for.
	const opened = view.projection;
	// The shelf opens COLLAPSED, and a collapsed shelf renders its header and returns — so
	// every roadmap number this panel printed before 2026-08-14 was of a roadmap with no
	// shelf in it, under a heading that named neither the omission nor the shelf. Opened for
	// the run and put back exactly as found, the way the projection already is: a
	// measurement mode must not leave the reader's own view rearranged.
	const openedShelf = view.shelfCollapsed;
	view.setShelfCollapsed(false);
	// Switched to the tree BEFORE expanding, because `?perf` composes with `?view=board`
	// and the expand control is disabled on a projection that drew no disclosure. Expanding
	// there did nothing, counted zero rows, and left every later sample rendering a
	// collapsed tree under a heading claiming an expanded one. (Codex, PR #128.)
	view.setProjection('tree');
	expandAll(el);
	// Counted HERE rather than at the end, where the restored projection may be the board
	// and the tree's row count would read as zero — the panel's own sample size, wrong.
	const treeRows = el.querySelectorAll('.pbl-row').length;
	const rows: Row[] = [
		// Both numbers are taken inside `mountHarness`, around the view's first draw and
		// before `?view=` or the expansion — see `Mount` in `mount.ts`.
		// Labelled so it cannot be read as a row of the same sample as the four below it.
		{ op: 'mount (collapsed, as it opens)', median: mount.ms, worst: mount.ms, px: mount.px, drew: mount.drew },
		sample(el, 'update (build + render)', () => view.onDataUpdated()),
		sample(el, 'render only', () => view.render()),
	];
	// The axis and the window are read HERE, in the one moment the roadmap is the projection
	// on screen: the snapshot is what the render produced, and it is null everywhere else.
	let axis: string | null = null;
	let grid: string | null = null;
	for (const projection of PROJECTIONS) {
		rows.push(
			sample(
				el,
				`switch to ${projection}`,
				() => view.setProjection(projection),
				() => view.setProjection(projection === 'tree' ? 'board' : 'tree'),
			),
		);
		if (projection === 'roadmap') {
			axis = view.roadmap?.roadmap.axis ?? null;
			const drawn = view.roadmap?.window ?? null;
			grid = drawn && `${drawn.start.year}-${drawn.start.month}-${drawn.start.day}+${drawn.days}d`;
		}
	}
	view.setShelfCollapsed(openedShelf);
	view.setProjection(opened);
	return { rows, treeRows, axis, grid };
}

/**
 * Open every subtree through the toolbar's own control, before anything is timed.
 *
 * Without it the tree measured at `?notes=800` is the thirty-odd rows a collapsed tree
 * draws, while the board and the roadmap draw all eight hundred — so three of the rows
 * below would be describing different sample sizes under one heading, and the tree would
 * read as the cheap projection when what it was doing was rendering almost nothing.
 *
 * Inlined rather than taken from `test/helpers/view.ts`, which imports vitest and so
 * cannot be bundled into a page. It is the same click on the same real control.
 */
function expandAll(el: HTMLElement): void {
	el.querySelector<HTMLElement>('.pbl-collapse-ctl[aria-label="Expand all"]')?.dispatchEvent(
		new MouseEvent('click', { bubbles: true }),
	);
}

/**
 * What the page actually MOUNTED, beside what it cost.
 *
 * The runner used to print the query string it had built and call that the heading, so a
 * typo the page silently absorbed — `?fixture=edegs` mounts the demo, `?axis=date` picks
 * no axis at all — labelled the table with a workload nobody ran. Three flags had that
 * shape, and the answer is not three vocabularies copied into the runner, which is a list
 * that goes stale: the page is the only thing that knows what it resolved, so it says.
 * (Codex, PR #137.)
 */
interface Ran {
	fixture: string;
	/** Results the view was handed — the population these numbers are of. */
	results: number;
	/** What those results WERE — see `MountedHarness.contents`. */
	contents: string;
	projection: string;
	/**
	 * The axis the roadmap DREW, captured while it was on screen — never `view.axisPick`,
	 * which is the retained pick and stays null until someone chooses. `activeAxis` falls
	 * back to the first configured axis, so two builds configured differently both reported
	 * a null pick and compared as if they had drawn the same thing. (Codex, PR #137.)
	 */
	axis: string | null;
	/**
	 * The GRID the roadmap drew, as `start+days` — null off a dated grid, where there is
	 * none to draw.
	 *
	 * The axis alone does not pin the workload on the two grid axes: the window is derived
	 * from `todayCivil()`, so the same build measured on two calendar dates — or one A/B
	 * run spanning midnight — draws a different span and clamps differently, and every
	 * other field compares equal. Published rather than FROZEN, of the two fixes: the
	 * reader's own date is an input to the view (`render/projections.ts` injects it and
	 * nothing in `domain/` reads a clock), so pinning it here would measure a thing the
	 * plugin does not do. And it is the WINDOW rather than the date, because the window is
	 * what the render produced and what actually varies — a zoom, a lead width or one
	 * note's dates move it too, and the date is only the commonest reason. (Codex, PR #137.)
	 *
	 * Named `grid` and not `window`: the runner already has a `--window`, which is the
	 * VIEWPORT, and a mismatch warning naming both would be unreadable.
	 */
	grid: string | null;
}

/** The id `scripts/perf.mjs` looks the numbers up by — a contract, so keep it stable. */
export const PERF_DATA_ID = 'pbl-perf-data';

/**
 * The same numbers again, as JSON, so a headless browser can be ASKED rather than scraped.
 *
 * `scripts/perf.mjs` runs this page with `--dump-dom` and reads this one element; without
 * it the runner would have to parse the table above, and a column added for a human to
 * read would silently change what a script measured. The panel is for eyes, this is for
 * the runner, and both come from the same `rows`.
 *
 * A `<script type="application/json">` rather than an attribute: its content is serialized
 * as raw text, so nothing here depends on how quotes in an op name would be escaped.
 */
function publish(panel: HTMLElement, data: { samples: number; treeRows: number; ran: Ran; rows: Row[] }): void {
	panel.createEl('script', { attr: { type: 'application/json', id: PERF_DATA_ID }, text: JSON.stringify(data) });
}

/** `?perf` — whether the page should time itself at all. */
export function perfWanted(search: string): boolean {
	return new URLSearchParams(search).has('perf');
}

/** `?notes=800` — how many generated notes to add to the fixture. Absent or junk means none. */
export function wantedNotes(search: string): number {
	const asked = Number(new URLSearchParams(search).get('notes'));
	return Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 0;
}

/**
 * Run the measurements and report them twice: a panel, so nothing has to be opened to
 * read them, and `console.table`, so they can be pasted into a note. `.pbl-harness-*` is
 * the namespace the harness owns for its own furniture — see `test/harness/theme.css`.
 */
export function reportPerf(
	view: ProductBacklogView,
	containerEl: HTMLElement,
	mount: Mount,
	mounted: { fixture: string; results: number; contents: string },
): Row[] {
	const { rows, treeRows, axis, grid } = measure(view, containerEl, mount);
	console.table(rows.map((r) => ({ ...r, median: +r.median.toFixed(1), worst: +r.worst.toFixed(1) })));

	const panel = document.body.createDiv('pbl-harness-perf');
	panel.createEl('h2', { text: `${treeRows} rows expanded, median of ${SAMPLES}` });
	const table = panel.createEl('table');
	for (const row of rows) {
		const tr = table.createEl('tr');
		tr.createEl('td', { text: row.op });
		tr.createEl('td', { text: `${row.median.toFixed(1)} ms` });
		tr.createEl('td', { text: `${row.worst.toFixed(1)} ms`, cls: 'pbl-harness-perf-worst' });
		tr.createEl('td', { text: `${row.drew} drawn`, cls: 'pbl-harness-perf-drew' });
	}
	// Read AFTER the run, which restores the projection and touches no axis: these are what
	// the page is showing, which is what the numbers are of.
	publish(panel, {
		samples: SAMPLES,
		treeRows,
		ran: {
			fixture: mounted.fixture,
			results: mounted.results,
			contents: mounted.contents,
			projection: view.projection,
			axis,
			grid,
		},
		rows,
	});
	panel.createEl('p', {
		text: 'No Bases pass, no metadata cache, no vault I/O, no theme. Not what the plugin costs in a vault.',
	});
	return rows;
}
