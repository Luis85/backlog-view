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
			// Measured 97.82/93.56/99.08/99.12 — thresholds sit just below to catch
			// regressions without being brittle, each keeping the margin it had when the
			// figure above it last moved. Raise them as coverage grows, never lower:
			// statements and branches moved with the card-drag increment and their
			// thresholds moved with them, while lines did not move, so its threshold
			// stayed rather than being re-cut to a margin no work had earned.
			// Functions dipped from a prior 99.2: the per-column-agreements increment's
			// `wipLimits`/`columnPolicies` defaults call `nameTable` with an empty
			// vocabulary, so its `() => null` reader is never invoked — dead by construction,
			// not a gap this suite left. Its threshold stays put rather than chasing a
			// figure the increment itself moved down.
			//
			// Those numbers replace an earlier 98.9/94.3/99.5/98.9, and NO test was lost
			// between them: vitest 4 remaps v8's byte ranges onto AST nodes by default —
			// v3's opt-in `experimentalAstAwareRemapping` — so a partially covered line
			// now reports as partial instead of whole. The suite did not get worse; the
			// old figure was flattering. Statements has the least room of the four, so
			// that is the one a thin change will trip first.
			thresholds: {
				statements: 97.55,
				branches: 93.1,
				functions: 98,
				lines: 97,
			},
		},
	},
});
