import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			// The real 'obsidian' package is types-only; tests run against a small mock.
			obsidian: fileURLToPath(new URL('./test/helpers/obsidian-mock.ts', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			// Registration glue that needs the real Obsidian Plugin runtime.
			exclude: ['src/main.ts'],
			reporter: ['text-summary', 'json', 'lcov'],
			// Thresholds only ever go up. Raise them to what an increment measures,
			// rounded down to one decimal; never lower one to accommodate a change.
			//
			// Two episodes worth keeping, because both change what you do on a failure:
			//
			// A mid-increment figure is not the increment's figure. Branches once measured
			// 94.0038 mid-flight; taking the 94.0 it rounds down from would have failed the
			// very next run, because sharing a chevron between two renderers deleted six
			// branches along with the duplicate. Record what the FINISHED increment measures.
			//
			// A coverage failure here is first a question about which branch nothing can
			// take, and only then about a missing test. A 93.99 against a 94.0 floor turned
			// out to be two DEAD branches — one arm whose only callers passed a three-name
			// list, one that became unreachable when a neighbouring function started
			// returning the whole vocabulary. Deleting them raised the figure on a smaller
			// denominator. Look for the dead branch before writing the test.
			//
			// The history of which decimal moved in which increment is in git.
			//
			// Merged with main after main re-accumulated ledger entries this branch had
			// removed. The entries are not restored — git holds them — but main's
			// THRESHOLDS are taken whole, because they are higher and a floor only rises.
			thresholds: {
				statements: 98.48,
				branches: 94.81,
				functions: 99.81,
				lines: 99.59,
			},
		},
	},
});
