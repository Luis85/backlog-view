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
	const sources = {
		hotspots: [
			{ path: 'src/view/hot.ts', score: 45.5, trend: 'heating', actions: [{ description: 'Refactor `src/view/hot.ts`' }] },
			{ path: 'src/view/cool.ts', score: 12.0, trend: 'cooling', actions: [{ description: 'Add tests' }] },
		],
		caps: [{ path: 'src/view/big.ts', counted: 385, cap: 400 }],
		coverage: [{ path: 'src/view/thin.ts', statements: 71.2 }],
		debt: [
			{ path: 'docs/bugs/A real bug.md', title: 'A real bug', kind: 'bug' },
			{ path: 'docs/issues/An open question.md', title: 'An open question', kind: 'issue' },
		],
	};

	it('puts a bug, a near-cap file and a heating hotspot in the high band', () => {
		const high = rank(sources).filter((r) => r.band === 'high').map((r) => r.where);
		expect(high).toContain('docs/bugs/A real bug.md');
		expect(high).toContain('src/view/big.ts');
		expect(high).toContain('src/view/hot.ts');
	});

	it('puts a cooling hotspot, a thin module and an open issue in the medium band', () => {
		const medium = rank(sources).filter((r) => r.band === 'medium').map((r) => r.where);
		expect(medium).toEqual(expect.arrayContaining(['src/view/cool.ts', 'src/view/thin.ts', 'docs/issues/An open question.md']));
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
		expect(rank({ hotspots: [], caps: [], coverage: [], debt: [] })).toEqual([]);
	});
});
