// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountHarness } from './mount';
import { PERF_DATA_ID, reportPerf } from './perf';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();

/**
 * `?perf`'s own honesty, which is the only thing about it that CAN be checked here.
 *
 * Nothing below times anything, and nothing here may: a timing assertion is refused by
 * [[The render path states its costs as checks]] and by ADR 0020's fourth refusal, and
 * one written in jsdom would measure jsdom. What is checkable is the same thing the size
 * knob's own tests check one file over — that the instrument reports the sample it
 * actually took. It was doing the opposite until 2026-08-14: the shelf opens collapsed,
 * so every roadmap number this panel ever printed was of a roadmap with no shelf in it,
 * under a heading that mentioned neither.
 */
describe('the perf panel reports the sample it took', () => {
	beforeEach(() => {
		document.body.empty();
	});

	function mount(extra = 0) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root, 'demo', extra);
	}

	/** What the page published for the runner, which is what `scripts/perf.mjs` parses. */
	function published(): {
		samples: number;
		treeRows: number;
		ran: { fixture: string; projection: string; axis: string | null; grid: string | null };
		rows: { op: string; drew: number; median: number }[];
	} {
		const el = document.getElementById(PERF_DATA_ID);
		if (el === null) throw new Error('the panel published no data');
		return JSON.parse(el.textContent ?? '');
	}

	/**
	 * One `reportPerf` is five samples of seven ops, which is seconds in jsdom under
	 * coverage — so each case below drives exactly one, and the explicit timeout is what
	 * the default 5s costs when the whole suite is running in parallel.
	 */
	const RUN_MS = 30_000;

	// Both ways round, because "restores what it found" and "collapses it afterwards" agree
	// on one of the two — and a measurement mode that rearranged the reader's own view
	// would be a knob with a side effect, the shelf being stored UI state.
	it.each([true, false])(
		'opens the shelf for the run and puts it back (collapsed: %s)',
		(collapsed) => {
			const { view, containerEl, mount: first, results, contents } = mount();
			view.setShelfCollapsed(collapsed);

			reportPerf(view, containerEl, first, { fixture: 'demo', results, contents });

			expect(view.shelfCollapsed).toBe(collapsed);
			// Asked of the ROADMAP row's own count rather than of the DOM afterwards: the run
			// restores the collapse it found, so the screen at the end says nothing about what
			// was measured. What the shelf HOLDS is then read by opening it here.
			const roadmap = published().rows.find((row) => row.op === 'switch to roadmap');
			view.setProjection('roadmap');
			view.setShelfCollapsed(false);
			const shelved = containerEl.querySelectorAll('.pbl-shelf .pbl-card').length;
			expect(shelved).toBeGreaterThan(0);
			expect(roadmap?.drew).toBeGreaterThanOrEqual(shelved);
		},
		RUN_MS,
	);

	/**
	 * The grid is published because the axis alone does not pin the workload: both grid
	 * axes derive their span from the reader's own calendar date, so one build measured on
	 * two dates draws two different windows with every other field equal. Asserted as a
	 * SHAPE rather than a value — the value moves every day, which is the whole point.
	 */
	it(
		'publishes the grid a dated axis drew, where the horizon axis has none',
		() => {
			const { view, containerEl, mount: first, results, contents } = mount();
			view.setAxisPick('dates');

			reportPerf(view, containerEl, first, { fixture: 'demo', results, contents });

			expect(published().ran.grid).toMatch(/^\d{4}-\d{1,2}-\d{1,2}\+\d+d$/);
		},
		RUN_MS,
	);

	it(
		'gives every row its own sample size, and publishes exactly what the panel shows',
		() => {
			const { view, containerEl, mount: first, results, contents } = mount();

			const rows = reportPerf(view, containerEl, first, { fixture: 'demo', results, contents });

			// The runner does one `JSON.parse` and no scraping, so what it gets has to BE the
			// table: a column added for a human to read must not change what a script reads.
			const data = published();
			expect(data.rows.map((row) => row.op)).toEqual(rows.map((row) => row.op));
			expect(data.rows.map((row) => row.drew)).toEqual(rows.map((row) => row.drew));
			expect(data.treeRows).toBe(containerEl.querySelectorAll('.pbl-row').length);
			expect(data.samples).toBeGreaterThan(0);
			// What the page MOUNTED, which is what the runner's heading states: a query
			// string echoed back would have labelled the table with a typo the page had
			// silently absorbed (`?fixture=edegs` mounts the demo).
			// The axis the ROADMAP drew, not `view.axisPick`, which is null until someone picks
			// and would have compared two differently-configured builds as equal.
			view.setProjection('roadmap');
			// The POPULATION the view was handed, not the `?notes=` request: the edge-case
			// fixture ignores that request and the demo's curated notes are in every number.
			expect(results).toBeGreaterThan(0);
			// `toEqual` on the WHOLE object, not per field: a published key the runner
			// compares is worth nothing if the publisher silently drops it, which is exactly
			// what happened to `grid` — added to the type, assigned in the run, and left out
			// of this literal by a patch that matched no line.
			expect(data.ran).toEqual({
				fixture: 'demo',
				results,
				contents,
				projection: 'tree',
				axis: view.roadmap?.roadmap.axis ?? null,
				// The demo opens on horizons, which draws no grid. The dated axis's own value
				// is the next case.
				grid: null,
			});
			expect(data.ran.axis).not.toBeNull();

			const drew = (op: string) => data.rows.find((row) => row.op === op)?.drew ?? 0;
			// One heading cannot state this: the board excludes Deliverables and the
			// Deliverables board draws only those, so the two counts are of different
			// populations and neither is the expanded tree's.
			expect(drew('switch to board')).toBeGreaterThan(drew('switch to deliverables'));
			// The mount row is the collapsed first draw, which is why it is labelled apart
			// from the rows below it — fewer rows than the expanded tree, and it says so.
			expect(drew('mount (collapsed, as it opens)')).toBeLessThan(drew('switch to tree'));
		},
		RUN_MS,
	);
});

/**
 * The two URL knobs that reach state a headless page cannot click its way to. Driven
 * through the real entry module, because the knob IS the entry's own reading of the
 * query string — a test that re-implemented that reading would check its own copy.
 */
describe('the page opens where the URL asks', () => {
	beforeEach(() => {
		document.body.empty();
	});

	async function open(search: string): Promise<void> {
		window.history.replaceState({}, '', `/${search}`);
		// The entry does its work AT import, once — so each case needs the module registry
		// cleared or the second URL would be asserting on the first one's page.
		vi.resetModules();
		await import('./page');
	}

	it('opens into the projection `?view=` names', async () => {
		await open('?view=board');

		expect(document.querySelector('.pbl-board-cols')).not.toBeNull();
	});

	it('opens the roadmap on the axis `?axis=` names, which no other URL reaches', async () => {
		// The axis is a toolbar MENU, so the dated grid had no way into a headless page at
		// all before this knob — neither for a screenshot nor for `scripts/perf.mjs`.
		await open('?view=roadmap&axis=dates');

		expect(document.querySelector('.pbl-timeline')).not.toBeNull();
	});

	it('leaves the axis alone when the URL names none, and refuses one it does not know', async () => {
		await open('?view=roadmap&axis=sideways');

		// The horizon buckets, which is what an unpicked axis draws in this fixture: a knob
		// that fell through to some default on a typo would answer a question nobody asked.
		expect(document.querySelector('.pbl-bucket')).not.toBeNull();
		expect(document.querySelector('.pbl-timeline')).toBeNull();
	});
});
