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
import type { Projection } from '../../src/view/uiState';
import { drawnHeight, type Mount } from './mount';

/** Samples per row. Enough that one GC pause moves the worst column and not the median. */
const SAMPLES = 5;

const PROJECTIONS: Projection[] = ['tree', 'board', 'roadmap', 'deliverables'];

interface Row {
	op: string;
	median: number;
	worst: number;
	/** Rendered height after the op — the layout read that forces the browser to do the work. */
	px: number;
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
	times.sort((a, b) => a - b);
	return { op, median: times[times.length >> 1] ?? 0, worst: times[times.length - 1] ?? 0, px };
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
function measure(view: ProductBacklogView, el: HTMLElement, mount: Mount): { rows: Row[]; treeRows: number } {
	// Restored at the end rather than reset to the tree: the run drives all four, and a
	// `?perf&view=board` page has to be left showing the board it was asked for.
	const opened = view.projection;
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
		{ op: 'mount (collapsed, as it opens)', median: mount.ms, worst: mount.ms, px: mount.px },
		sample(el, 'update (build + render)', () => view.onDataUpdated()),
		sample(el, 'render only', () => view.render()),
	];
	for (const projection of PROJECTIONS) {
		rows.push(
			sample(
				el,
				`switch to ${projection}`,
				() => view.setProjection(projection),
				() => view.setProjection(projection === 'tree' ? 'board' : 'tree'),
			),
		);
	}
	view.setProjection(opened);
	return { rows, treeRows };
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
export function reportPerf(view: ProductBacklogView, containerEl: HTMLElement, mount: Mount): Row[] {
	const { rows, treeRows } = measure(view, containerEl, mount);
	console.table(rows.map((r) => ({ ...r, median: +r.median.toFixed(1), worst: +r.worst.toFixed(1) })));

	const panel = document.body.createDiv('pbl-harness-perf');
	panel.createEl('h2', { text: `${treeRows} rows expanded, median of ${SAMPLES}` });
	const table = panel.createEl('table');
	for (const row of rows) {
		const tr = table.createEl('tr');
		tr.createEl('td', { text: row.op });
		tr.createEl('td', { text: `${row.median.toFixed(1)} ms` });
		tr.createEl('td', { text: `${row.worst.toFixed(1)} ms`, cls: 'pbl-harness-perf-worst' });
	}
	panel.createEl('p', {
		text: 'No Bases pass, no metadata cache, no vault I/O, no theme. Not what the plugin costs in a vault.',
	});
	return rows;
}
