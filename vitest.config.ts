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
			// Measured 99.0/94.8/99.5/99.0 — thresholds sit just below to catch regressions
			// without being brittle. Raise them as coverage grows, never lower.
			thresholds: {
				statements: 97,
				branches: 92,
				functions: 98,
				lines: 97,
			},
		},
	},
});
