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
			// Measured 97.91/93.68/99.27/99.18 — thresholds sit just below to catch
			// regressions without being brittle, each keeping the margin it had when the
			// figure above it last moved. Raise them as coverage grows, never lower:
			// all four moved with the writable-timeline increment, so all four thresholds
			// moved by the same delta the figure above them did. Branches is the one worth
			// knowing about: mid-increment it measured 93.29, BELOW the 93.56 the previous
			// increment had earned, and the drop was treated as a finding rather than a
			// number to accommodate. Driving the undriven branches took it to 93.81 and
			// found a real bug on the way (a grip offered on a note stating no date, whose
			// gesture anchored to the window edge); withholding that grip removed the
			// branch again, which is why the figure settles at 93.68 rather than 93.81.
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
			//
			// The browser harness increment measured 97.97/93.66/99.30/99.21 with its own
			// suite, against 97.95/93.63/99.30/99.21 without it — so statements and branches
			// moved by 0.02 and 0.03 and their thresholds move by the same, and the other two
			// stay. The 97.91/93.68 recorded above is a PRE-MERGE figure: re-measuring the
			// same tree with the harness tests excluded gives 97.95/93.63, which is where the
			// deltas here are taken from. Nothing regressed; the older pair was simply taken
			// at a different commit, and quoting it as this increment's baseline would have
			// invented a branches drop that never happened.
			//
			// The gantt-reading-polish increment (grid furniture: header tiers, gridlines,
			// weekend banding, the today label, row tracking, bar labels, the density
			// toggle) measured 98.00/93.79/99.22/99.22, all four above their thresholds, so
			// all four move to the actual rounded down to one decimal.
			//
			// The whole-branch review's fix wave (toolbar refocus-after-rebuild, the two
			// new watched-failing tests it required) measured 98.01/93.81/99.23/99.23.
			// Only branches rounds down to a new decimal (93.8, up from 93.7); the other
			// three round down to the figure already recorded above and stay put.
			//
			// The per-state bar colour and legend increment (a domain slot function, the
			// legend's own render module, the Today pill's removal) measured
			// 98.01/93.82/99.23/99.23 — statements, functions and lines exactly repeat the
			// figure above and branches ticks up 0.01, which still rounds down to the same
			// 93.8, so none of the four move.
			//
			// The resizable-lead-column increment (the drag grip and its keyboard path, the
			// `leadWidth` collapse-store pick, the resolved-width threading through the
			// today/milestone/gridline math and the drag's own lead-column hit test)
			// measured 98.04/93.81/99.24/99.24 — all four round down to the figures already
			// recorded above, so none of the four move.
			//
			// The lead-resize fix pass (the scroll-anchor's today term made track-relative
			// so a resize stops panning the grid, and the grip moved from mouse to pointer
			// events for touch) measured 98.04/93.82/99.24/99.24 — the same figures again,
			// so none of the four move.
			//
			// The pane-clamp review pass (the legend gated on a configured workflow, the
			// lead column's effective width clamped against the pane it is actually drawn
			// in, and the mock `ResizeObserver` that made the resize-driven re-render
			// testable at all) measured 98.12/93.84/99.43/99.29 — statements and functions
			// round up to new decimals (98.1 and 99.4), branches and lines round down to the
			// figures already recorded above (93.8, 99.2), so only two of the four move.
			//
			// The accent-report fix (the timeline's bar render reporting its own colour
			// fact instead of the legend rebuilding it from `results`, plus the sweep's two
			// new rows for a marker outside the capped window) measured
			// 98.11/93.83/99.43/99.30 — statements, branches and functions round down to the
			// figures already recorded above, lines rounds down to a new decimal (99.3, up
			// from 99.2), so only lines moves.
			thresholds: {
				statements: 98.1,
				branches: 93.8,
				functions: 99.4,
				lines: 99.3,
			},
		},
	},
});
