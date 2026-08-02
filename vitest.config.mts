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
			// Measured 97.5/92.9/99.1/99.1 — thresholds sit just below to catch regressions
			// without being brittle. Raise them as coverage grows, never lower.
			//
			// Those numbers replace an earlier 98.9/94.3/99.5/98.9, and NO test was lost
			// between them: vitest 4 remaps v8's byte ranges onto AST nodes by default —
			// v3's opt-in `experimentalAstAwareRemapping` — so a partially covered line
			// now reports as partial instead of whole. The suite did not get worse; the
			// old figure was flattering. Statements has the least room of the four, so
			// that is the one a thin change will trip first.
			thresholds: {
				statements: 97,
				branches: 92,
				functions: 98,
				lines: 97,
			},
		},
	},
});
