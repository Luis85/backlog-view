import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layerMatrix } from '../../scripts/health-charts.mjs';
import { architecture, worklist } from '../../scripts/health-sections.mjs';
import { churnScatter } from '../../scripts/health-scatter.mjs';
import { capFor, coverageRatios, layerOf, rank, toRepoPath } from '../../scripts/health-collect.mjs';

/**
 * The pure half of `npm run health`, asked directly.
 *
 * `test/docs/checkerAccepts.test.ts` drives its script as a SUBPROCESS over a planted
 * tree, because the docs checker is a walk over a repository and cannot be asked
 * anything smaller. Nothing here needs that: these five functions take a value and
 * return one, so the test that would have cost a spawn costs a call.
 *
 * The collectors around them are deliberately not tested. They read a file or run a
 * tool and hand the result to a function here; a test of `execFile` would be a test of
 * Node.
 */

describe('toRepoPath', () => {
	/**
	 * The separator is the HOST's, both in and out: every path here comes from a tool
	 * this machine just ran, so a Windows path on a POSIX runner is a shape that cannot
	 * arrive — and `path.relative` cannot read one anyway. `path.join` builds the input
	 * CI actually holds on each platform; the claim under test is the forward slash on
	 * the way out.
	 */
	it('makes an absolute path repo-relative and forward-slashed', () => {
		const root = path.resolve('repo');
		expect(toRepoPath(path.join(root, 'src', 'commands', 'readme.ts'), root))
			.toBe('src/commands/readme.ts');
	});
});

describe('layerOf', () => {
	it('names each layer of the architecture', () => {
		expect(layerOf('src/domain/model.ts')).toBe('domain');
		expect(layerOf('src/storage/frontmatter.ts')).toBe('storage');
		expect(layerOf('src/view/backlogView.ts')).toBe('view');
		expect(layerOf('src/commands/readme.ts')).toBe('commands');
	});

	it('names the two leaves, which are layers in the guide but not in the ladder', () => {
		expect(layerOf('src/ui/prompts.ts')).toBe('ui');
		expect(layerOf('src/i18n/en.ts')).toBe('i18n');
	});

	it('gives main.ts its own name rather than folding it into a layer', () => {
		// It is the only place anything is registered with Obsidian, and it is excluded
		// from coverage — a rollup that hid it inside `view` would misreport both.
		expect(layerOf('src/main.ts')).toBe('main');
	});

	it('answers null outside src/, so a script never lands in a layer rollup', () => {
		expect(layerOf('scripts/docs-check.mjs')).toBeNull();
		expect(layerOf('test/view/rendering.test.ts')).toBeNull();
	});
});

describe('capFor', () => {
	it('gives each tree the cap eslint.config.mjs actually sets for it', () => {
		expect(capFor('src/view/backlogView.ts')).toBe(400);
		expect(capFor('test/view/rendering.test.ts')).toBe(450);
		expect(capFor('styles/badges.css')).toBe(400);
	});

	it('answers null where no cap exists, rather than guessing one', () => {
		// .mjs is uncapped: max-lines is scoped to **/*.ts.
		expect(capFor('scripts/health-collect.mjs')).toBeNull();
		expect(capFor('docs/README.md')).toBeNull();
	});
});

describe('coverageRatios', () => {
	it('turns an istanbul entry into three percentages', () => {
		const entry = {
			s: { 0: 1, 1: 1, 2: 0, 3: 1 },
			f: { 0: 1, 1: 0 },
			b: { 0: [1, 0], 1: [1, 1] },
		};
		expect(coverageRatios(entry)).toEqual({ statements: 75, branches: 75, functions: 50 });
	});

	it('reports a file with nothing to cover as fully covered, not as NaN', () => {
		// 0/0 is the empty-module case, and a NaN reaches the page as "NaN%".
		expect(coverageRatios({ s: {}, f: {}, b: {} })).toEqual({ statements: 100, branches: 100, functions: 100 });
	});
});

describe('rank', () => {
	/**
	 * **Every value here was sampled from a real `fallow --format json` run**, not
	 * invented. The first version of this fixture guessed `trend: 'heating'`, which
	 * fallow never emits — the real vocabulary is `accelerating` / `stable` / `cooling` —
	 * so the test passed while the rule it was checking could not fire on real data.
	 * That is the failure `CLAUDE.md` describes as measuring a set with an instrument
	 * that cannot see all of it.
	 */
	const sources = {
		topCount: 2,
		hotspots: [
			{ path: 'src/view/hot.ts', score: 45.5, trend: 'accelerating', actions: [{ description: 'Refactor `src/view/hot.ts`' }] },
			{ path: 'src/view/cool.ts', score: 37.8, trend: 'cooling', actions: [{ description: 'Add tests' }] },
			{ path: 'src/view/quiet.ts', score: 3.5, trend: 'stable', actions: [{ description: 'Ignore me' }] },
		],
		caps: [
			{ path: 'src/view/nearly.ts', counted: 385, cap: 400 },
			{ path: 'src/view/close.ts', counted: 370, cap: 400 },
			{ path: 'src/view/roomy.ts', counted: 200, cap: 400 },
		],
		coverage: [{ path: 'src/view/thin.ts', statements: 71.2 }],
		debt: [
			{ path: 'docs/bugs/A real bug.md', title: 'A real bug', kind: 'bug' },
			{ path: 'docs/issues/An open question.md', title: 'An open question', kind: 'issue' },
		],
	};

	it('puts a bug, a file within 20 lines of its cap and an accelerating hotspot in the high band', () => {
		const high = rank(sources).filter((r) => r.band === 'high').map((r) => r.where);
		expect(high).toContain('docs/bugs/A real bug.md');
		expect(high).toContain('src/view/nearly.ts');
		expect(high).toContain('src/view/hot.ts');
	});

	it('puts a cooling hotspot, a file within a tenth of its cap and a thin module in the medium band', () => {
		const medium = rank(sources).filter((r) => r.band === 'medium').map((r) => r.where);
		expect(medium).toEqual(expect.arrayContaining(['src/view/cool.ts', 'src/view/close.ts', 'src/view/thin.ts']));
	});

	/**
	 * **A row exists only where a rule fires.** This is the invariant that makes the
	 * section a worklist rather than an inventory, and the first implementation broke it
	 * in three separate ways at once: a row per file with a cap (311 of them), a row per
	 * entry in fallow's hotspot array (104, on a repository whose `hotspot_count` is 0),
	 * and a row per open issue (46). 464 rows, on a page whose first job is to answer
	 * "what do I do next".
	 */
	it('gives a file with room left no row at all', () => {
		expect(rank(sources).map((r) => r.where)).not.toContain('src/view/roomy.ts');
	});

	it('takes only the top hotspots fallow itself counts, not every file it ranked', () => {
		// `vital_signs.hotspot_top_pct_count` is fallow's own answer to "how many of these
		// are actually hotspots". Reading past it turns a ranking into 104 findings.
		expect(rank(sources).map((r) => r.where)).not.toContain('src/view/quiet.ts');
	});

	it('leaves open issues to the debt section and puts only bugs in the list', () => {
		// The `Codebase health` Epic says its remaining issues are "recorded decisions and
		// limitations waiting on evidence rather than on effort". 46 of those are a
		// register to read, not 46 things to do next.
		expect(rank(sources).map((r) => r.where)).not.toContain('docs/issues/An open question.md');
	});

	it('sorts high before medium, whatever order the sources arrive in', () => {
		const bands = rank(sources).map((r) => r.band);
		expect(bands).toEqual([...bands].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)));
	});

	it('names the tool behind every row, because no number here is comparable to another', () => {
		// The whole point of the band rule is that it can be taken apart. A row whose
		// source is unnamed is the opaque score the register refuses.
		for (const row of rank(sources)) expect(row.source).toBeTruthy();
	});

	it('returns nothing at all when there is nothing to act on', () => {
		expect(rank({ topCount: 2, hotspots: [], caps: [], coverage: [], debt: [] })).toEqual([]);
	});
});

describe('layerMatrix', () => {
	const report = {
		graph: [
			{ from: 'view', to: 'domain', count: 223 },
			{ from: 'storage', to: 'domain', count: 23 },
			{ from: 'view', to: 'view', count: 40 },
			{ from: 'domain', to: 'view', count: 2 },
		],
		layers: [{ layer: 'view', files: 64 }, { layer: 'domain', files: 28 }],
	};

	/**
	 * **The figure has to agree with its own caption.**
	 *
	 * It did not. The counts were written into a map keyed with a NUL separator and read
	 * back with a space, so every lookup missed and every cell rendered empty — while the
	 * caption, counted from the array rather than the map, still said fifteen edges. An
	 * empty matrix is what a CLEAN result looks like, so the drawing was wrong in the
	 * direction that reassures, which is the direction nobody checks.
	 */
	it('draws one filled cell per cross-layer edge', () => {
		const html = layerMatrix(report);
		// A filled cell is one carrying a COUNT, which is either a legal edge or a
		// violation — the first version of this assertion counted only the legal class and
		// so quietly expected the violation to vanish.
		const filled = html.match(/class="mx-cell (mx-on|mx-violation)/g) ?? [];
		expect(filled).toHaveLength(3);
	});

	it('marks an upward import as a violation and says so', () => {
		// domain -> view points up the ladder, which lint forbids and this must not hide.
		const html = layerMatrix(report);
		expect(html).toContain('mx-violation');
		expect(html).toContain('1 edge(s) break the layer rule');
	});

	it('says nothing is wrong only when nothing is', () => {
		const clean = { ...report, graph: report.graph.filter((e) => e.from !== 'domain') };
		const html = layerMatrix(clean);
		expect(html).not.toContain('mx-violation');
		expect(html).toContain('none in the shaded region');
	});
});

describe('worklist', () => {
	const report = {
		root: 'C:/repo',
		actions: [
			{ band: 'high', title: 'a is over its cap', where: 'src/view/a.ts', why: '401 lines', source: 'eslint' },
			{ band: 'high', title: 'b is thinly covered', where: 'src/domain/b.ts', why: '78%', source: 'vitest' },
			{ band: 'medium', title: 'c is near its cap', where: 'src/view/c.ts', why: '380 lines', source: 'eslint' },
		],
	};

	/**
	 * **The markup IS the wiring.** The tabs and the grouping are driven by the inline
	 * script, which nothing here can run — so what this file can check is the contract the
	 * script reads: an `aria-controls` that resolves, exactly one visible panel, and the
	 * two grouping keys plus the rank on every row. Break any of those and the control
	 * silently does nothing in a browser. The INTERACTION still needs the page opened.
	 */
	it('gives every present band a tab that names a panel, and shows exactly one', () => {
		const html = worklist(report);
		const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
		expect(controls).toEqual(['band-high', 'band-medium']);
		for (const id of controls) expect(html).toContain(`id="${id}"`);
		expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
		// Every panel but the first carries `hidden`, so the page opens on one band.
		expect(html.match(/ hidden>/g)).toHaveLength(1);
	});

	it('omits a band with no rows rather than showing an empty tab', () => {
		// `low` has no rows in the fixture, so nothing may offer to show it.
		expect(worklist(report)).not.toContain('wt-low');
	});

	/**
	 * The rank is what makes "Flat" a restoration. Without it the only order the list can
	 * return to is whatever the last grouping sorted it into — the hole the tables view
	 * still has.
	 */
	it('carries the rank and both grouping keys on every row', () => {
		const html = worklist(report);
		const rows = [...html.matchAll(/<li data-rank="(\d+)" data-tool="([^"]+)" data-dir="([^"]+)"/g)];
		expect(rows.map((m) => [m[1], m[2], m[3]])).toEqual([
			['0', 'eslint', 'src/view'],
			['1', 'vitest', 'src/domain'],
			['2', 'eslint', 'src/view'],
		]);
	});

	it('says so when there is nothing to act on', () => {
		const html = worklist({ ...report, actions: [] });
		expect(html).toContain('Nothing to act on');
		expect(html).not.toContain('role="tab"');
	});
});

describe('architecture table', () => {
	const report = {
		layers: [
			{ layer: 'view', files: 64, lines: 19554, statements: 98.2, avgMaintainability: 87.7, fanIn: 255, fanOut: 532 },
			{ layer: 'domain', files: 28, lines: 9249, statements: 99.7, avgMaintainability: 89.6, fanIn: 552, fanOut: 112 },
		],
	};

	/**
	 * **Every row knows the order the report put it in.** Without it, the grouping
	 * control's "Flat" has nothing to return to: it used to only delete the headings and
	 * leave the rows in whatever order grouping had sorted them into, so the third state
	 * of a three-state control was a fourth arbitrary order.
	 */
	it('ranks every row in the order the report emitted it', () => {
		const ranks = [...architecture(report).matchAll(/<tr data-rank="(\d+)"/g)].map((m) => m[1]);
		expect(ranks).toEqual(['0', '1']);
	});

	/**
	 * A layer name is a word. `td:first-child` monospaced it because it happened to be
	 * first, and left the debt table's note PATH in the body face for the same reason —
	 * a position is not a description. See CLAUDE.md, address code by name.
	 */
	it('leaves a layer name in the body face', () => {
		expect(architecture(report)).not.toContain('<td class="mono">view</td>');
		expect(architecture(report)).toContain('<td class="">view</td>');
	});
});

describe('churnScatter', () => {
	const report = {
		fallow: {
			vitalSigns: { hotspot_top_pct_count: 1, hotspot_count: 0 },
			hotspots: [
				{ path: 'src/a.ts', score: 40, weighted_commits: 100, complexity_density: 0.3, commits: 120, lines_added: 9, lines_deleted: 8, trend: 'accelerating' },
				{ path: 'src/b.ts', score: 10, weighted_commits: 10, complexity_density: 0.05, commits: 12, lines_added: 3, lines_deleted: 1, trend: 'cooling' },
			],
		},
	};

	/**
	 * **Colour marks what the worklist already carries, and nothing else.** The list takes
	 * fallow's top `hotspot_top_pct_count` by score; if the figure coloured a different set
	 * — its own idea of "busy", say — the page would hold two definitions of a hotspot and
	 * the reader would have no way to tell which one the row in front of them used.
	 */
	it('colours exactly the files fallow puts in its top percentile', () => {
		const html = churnScatter(report);
		expect(html.match(/sc-dot sc-attention/g)).toHaveLength(1);
		expect(html.match(/sc-dot sc-plain/g)).toHaveLength(1);
	});

	/**
	 * **No boundary, and the caption says why.** The risk scatter's filled quadrant was
	 * removed because its edge was an arbitrary half-of-maximum. Fallow's own hotspot
	 * threshold is the only one in evidence here, and it is met by nothing — so a box would
	 * be an invention, and the figure has to admit that rather than draw one.
	 */
	it('shades no region, and reports the direction as counts rather than a slope', () => {
		const html = churnScatter(report);
		expect(html).not.toContain('sc-band');
		expect(html).toContain('1 accelerating, 0 stable, 1 cooling');
	});

	it('draws nothing at all when there is no history to draw', () => {
		expect(churnScatter({ fallow: { vitalSigns: {}, hotspots: [] } })).toBe('');
	});
});

describe('rank, with fallow direction', () => {
	const hotspots = [
		{ path: 'src/a.ts', score: 40, trend: 'accelerating', actions: [{ description: 'Refactor a' }] },
		{ path: 'src/b.ts', score: 10, trend: 'cooling', actions: [{ description: 'Refactor b' }] },
	];

	/**
	 * The direction reaches every source that can know it, not only the rows fallow itself
	 * contributed: "20 lines from its cap" and "and still accelerating" are one decision,
	 * and on two different pages they are two facts nobody holds at once.
	 */
	it('carries the trend onto a row a different tool reported', () => {
		const rows = rank({ hotspots, topCount: 0, caps: [{ path: 'src/a.ts', counted: 395, cap: 400 }] });
		expect(rows).toHaveLength(1);
		expect(rows[0].source).toBe('eslint');
		expect(rows[0].trend).toBe('accelerating');
	});

	/** A file fallow has no history for carries no trend, rather than a guessed one. */
	it('leaves the trend absent where it cannot be known', () => {
		const rows = rank({ hotspots, caps: [{ path: 'test/x.test.ts', counted: 445, cap: 450 }] });
		expect(rows[0].trend).toBeUndefined();
	});

	/** The hotspot row's own `why` stops repeating what the row now carries as a field. */
	it('does not say the direction twice on a hotspot row', () => {
		const rows = rank({ hotspots, topCount: 1 });
		expect(rows[0].why).toBe('hotspot score 40');
		expect(rows[0].trend).toBe('accelerating');
	});
});
