import { readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

/**
 * Every harness entry must BUNDLE. The suite runs each mount under vitest, where `node:fs`
 * and vitest itself resolve fine — so a helper that reaches for either passes every test and
 * still makes the page unbuildable, which is what happened to `release.ts` and left the
 * release view unlookable outside Obsidian for the one class of question jsdom cannot answer.
 *
 * Asked of the GRAPH rather than of a list of banned imports in named files: the next entry
 * is exactly the one nobody would have listed.
 */
describe('the harness entries bundle for a browser', () => {
	/**
	 * **Discovered, never listed.** A frozen list of today's entries passes the day somebody
	 * adds a fifth with the same defect — which is the regression this gate exists to catch,
	 * so a list would state the rule and check something narrower.
	 *
	 * Every non-test module under `test/harness/` is bundled, not only the four files
	 * `scripts/harness.mjs` documents as entries: they are all browser modules, an entry is
	 * only a module nothing imports, and a superset needs no registry to be kept in step.
	 */
	const ENTRIES = readdirSync('test/harness')
		.filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
		.map((name) => `test/harness/${name}`)
		.sort();

	it('finds the entries rather than naming them', () => {
		// The discovery is the gate's load-bearing half, so it is asserted rather than
		// assumed: a glob that silently matched nothing would make every case below vacuous.
		expect(ENTRIES).toContain('test/harness/release.ts');
		expect(ENTRIES.length).toBeGreaterThanOrEqual(4);
	});

	it.each(ENTRIES)('%s resolves to browser-safe modules only', async (entry) => {
		const result = await build({
			entryPoints: [entry],
			bundle: true,
			write: false,
			format: 'iife',
			target: 'es2020',
			alias: { obsidian: './test/helpers/obsidian-mock.ts' },
			define: { 'process.env.NODE_ENV': '"development"' },
			metafile: true,
			logLevel: 'silent',
		});
		const reached = Object.keys(result.metafile.inputs);
		expect(reached.filter((path) => path.startsWith('node:') || /node_modules\/vitest\//.test(path))).toEqual([]);
	});
});
