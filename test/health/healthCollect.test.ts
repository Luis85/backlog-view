import { describe, expect, it } from 'vitest';
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
	it('makes a Windows absolute path repo-relative and forward-slashed', () => {
		// The shape coverage-final.json actually holds on Windows, measured 2026-08-18.
		expect(toRepoPath('C:\\Projects\\backlog-view\\src\\commands\\readme.ts', 'C:\\Projects\\backlog-view'))
			.toBe('src/commands/readme.ts');
	});

	it('does the same on a POSIX path, because CI runs both', () => {
		expect(toRepoPath('/home/runner/work/bv/src/domain/model.ts', '/home/runner/work/bv'))
			.toBe('src/domain/model.ts');
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
