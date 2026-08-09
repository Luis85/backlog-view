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
			// The card-children-expansion increment measured 97.9951/93.6722/99.2285/99.2227
			// once its closing task (context cards, the register's cross-links, this floor)
			// landed — all four above the 97.66/93.25/98.19/97.06 this file had. Every branch
			// the increment added got a test: the disclosure and its toggle, the card menu's
			// children section on both the pointer and the keyboard path, the quick-filter
			// dedup between the disclosure and the match list, the toolbar's bulk controls
			// reaching cards and going disabled where no disclosure was drawn, and the
			// context-card case this task adds, which is a read-only path and so proves the
			// context-row rule holds by there being no write rather than by a check. Functions
			// and lines happen to round to the same 99.22 here — 1029/1037 and 3702/3731 are
			// not the same fraction, the display width is just too short to show it.
			//
			// Aligning `childrenLabel` with `displayType` (task 14, so the disclosure's count
			// agrees with the badges beside it for untyped children) measured
			// 97.9969/93.6807/99.2285/99.2231 (4403/4493, 2787/2975, 1029/1037, 3704/3733) —
			// a real but sub-0.01 move on three of the four, indistinguishable from the figure
			// above at the thresholds' own precision, so they stay rather than chasing noise.
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
			//
			// The drawn-colours increment (the done and milestone swatches gated on
			// `DrawnColors`, the same reported-by-the-render shape `hasUnkeyedAccent` used,
			// plus the sweep's new rows for a done bar off the grid and a base with no
			// milestone at all) measured 98.11/93.87/99.43/99.30 — all four round down to
			// the figures already recorded above, so none of the four move.
			//
			// The a11y fix wave (the toolbar's focus identity moved from `aria-label` to a
			// per-control key, the lead grip refocusing only what actually held focus, and
			// each timeline row saying its state in words) measured 98.11/93.87/99.43/99.30
			// — the same four figures again: the increment is small and all of it is
			// driven, so none of the four move.
			//
			// The stale-comment-and-deletion pass (three unreachable or duplicated pieces
			// cut — the gesture's second copy of the effective-width clamp, `jumpToToday`'s
			// dead lead-width fallback, the mock observer's uncalled `unobserve` — plus one
			// watched-failing test for the second-pass guard's `finally`) measured
			// 98.13/93.93/99.43/99.30 against a 98.11/93.87/99.43/99.30 baseline at the
			// commit before it. Cutting code nothing drove is what moves branches, and it
			// rounds down to a new decimal (93.9, up from 93.8); the other three round down
			// to the figures already recorded above and stay put.
			//
			// The final-review fix pass (one watched-failing test for the roadmap keydown
			// guard the lead grip's whole tab-stop deviation rests on, plus comment, doc
			// and test-instrument corrections) measured 98.13/93.97/99.43/99.30. Only
			// branches moved at all, and it rounds down to the 93.9 already recorded, so
			// none of the four move.
			//
			// The timeline-disclosure increment (`timelineRows` in the domain, the row's
			// chevron and its menu path, and the two dated-axis stylesheet fixes) measured
			// 98.21/93.99/99.46/99.37. Only statements rounds down to a new decimal (98.2);
			// the other three round down to the figures already recorded above and stay put.
			// Branches is worth a note: mid-increment it measured 94.0038, and taking the
			// 94.0 that rounds down from would have failed the very next run — sharing the
			// tree's chevron with the new timeline row deleted six branches along with the
			// duplicate, which is a smaller denominator and a better codebase. The figure to
			// record is the one the finished increment measures.
			//
			// The risk-management increment (the risk row in the optional-property table,
			// its plan, its writer, and the Set risk menu) measured 98.22/94.05/99.47/99.38
			// against a 98.21/94.00/99.46/99.37 baseline at the commit before it. Three of
			// the four round down to figures already recorded above; branches rounds down to
			// a new decimal (94.0, up from 93.9). Two things are worth knowing about that
			// one. The BASELINE was already 94.0000 exactly — the increment before this left
			// its threshold at 93.9 — so what this move records is a floor that had already
			// been earned, plus 0.05 of genuinely new margin. And 0.05 of 3180 branches is
			// under two branches, which is the thinnest margin this file has taken since the
			// 94.0038 the note above refuses; it is taken because the rule here is that
			// thresholds only ever go up, and left at 93.9 the floor would go on describing
			// a tree two increments behind. The next increment to add an undriven branch
			// will fail on it, which is what a floor is for.
			//
			// It did, immediately, and the record is worth keeping because the floor worked
			// exactly as that paragraph said it would. The `Idea` increment measured
			// 98.23/93.99/99.47/99.38 on merging the branch above: 93.99 against a 94.0
			// floor, failing in CI while passing locally, because the branch had been cut
			// before the floor moved. The two branches responsible were both DEAD, and both
			// were this increment's own — `andList`'s short-list arm, whose only callers
			// passed a three-name list, and `parentsOf`'s "not a root" arm, which became
			// unreachable the moment `childTypeChoices(null)` started returning the whole
			// vocabulary. Neither was covered by a test; both were removed, one by giving
			// the arm a real caller (`MARKER_TYPES`, one name) and one by deleting a
			// condition that could no longer be false. That is 94.05 on a denominator two
			// smaller, and every threshold stays: all four round down to the figures already
			// recorded. The point for whoever reads this next is the shape, not the numbers
			// — a coverage failure on this repository is first a question about which branch
			// nothing can take, and only then a question about a missing test.
			//
			// The toolbar-overflow-menu increment (task 3 of the toolbar-zones plan: the
			// `⋯` menu mirroring density, jump-to-today, the ✨ backfill and the two bulk
			// collapse commands, with a watched-failing test for the disabled mirror)
			// measured 98.24/94.34/99.51/99.41. Statements rounds down to the figure
			// already recorded above and stays; branches, functions and lines round down
			// to new decimals (94.3, 99.5, 99.4) and move.
			//
			// The fit-ladder increment (task 4 of the same plan: `toolbarFit.ts`, the
			// filter's reveal and its blur, the busy indicator's measured width
			// reservation, plus the review round's two lower rungs, the padding-corrected
			// pane, the `css-change` refit and the clip container) measured
			// 98.26/94.41/99.52/99.42. Only branches rounds down to a new decimal and
			// moves; the other three repeat the figures above. The branches gained are the
			// ladder's own — the zero-width refusal, the reveal versus the rebuild, the
			// blur's two answers and the theme change — each driven rather than
			// accommodated.
			thresholds: {
				statements: 98.2,
				branches: 94.4,
				functions: 99.5,
				lines: 99.4,
			},
		},
	},
});
