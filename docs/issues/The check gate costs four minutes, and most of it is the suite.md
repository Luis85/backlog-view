---
type: Issue
parent: "[[Codebase health]]"
order: 320
status: Open
priority: P3
area: verification
created: 2026-09-03
source: Timed run of every `npm run check` step on a 4-core Linux container, 2026-09-03
files:
  - package.json
  - vitest.config.mts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The check gate costs four minutes, and most of it is the suite

Timed on a 4-core Linux container, 2026-09-03, one step at a time from a cold cache:

| Step | Cold | Warm |
| --- | --- | --- |
| `build` | 3.7 s | 1.2 s |
| `typecheck:test` | 11.1 s | 2.4–5.5 s |
| `lint` | 22–27 s | 20.9 s (uncached, below) |
| `lint:md` | 4.8 s | 4.8 s |
| `test:coverage` | 198 s | 198 s |
| `analyze` | ~1 s | ~1 s |
| `docs` | 11.2 s | 11.2 s |

So the gate is ~4.4 minutes and **the suite is 75% of it**. Both `tsc` invocations now
run `--incremental` against `node_modules/.cache/`, which takes the three static steps from
~37 s to ~28 s on a second run — most of it the test typecheck, 11 s down to 2–5 s. The
cache location is deliberate: `npm ci` replaces `node_modules`, so every CI run is cold.

`tsc` is sound warm, and this was checked rather than assumed: giving
`rememberBacklogView` a second parameter and re-running the warm typecheck reported
`backlogView.ts(206,3): error TS2554` and two test files besides. An incremental `tsc`
re-checks every file that depends on a changed one.

## What was measured and refused

**`eslint --cache` is not sound here, and the difference from `tsc` is the whole point.**
It was in this change first — it takes lint from 22 s to 1.7 s, which is the largest single
saving on offer — and the review that caught it was right. The cache is keyed per file and
invalidates on that file's own content, so a **type-aware** rule never re-runs on an
unchanged caller. Reproduced on the same function: making `rememberBacklogView` `async`
leaves the warm cached run green while a cold run reports
`@typescript-eslint/no-floating-promises` on `backlogView.ts:206` — the rule this repository
added because an un-awaited frontmatter write reorders the vault. CI being cold does not
rescue it: it moves the discovery to after the push, which is the cycle this whole issue is
about saving. A cached lint would have to invalidate every TypeScript entry on any source
change, which is a cold run wearing a cache.

**Dropping isolation halves the suite, and the suite cannot take it yet.**
`vitest run --no-isolate` measures 80 s against 158 s, and 107 s against 198 s with
coverage. Five consecutive full runs under the default fork pool were green — and that
is not the whole picture: `--pool=threads --no-isolate` failed
`test/view/toolbarFocus.test.ts` in one run and `test/view/icons.test.ts` in another,
and a coverage run failed two tests then passed on a rerun with nothing changed. Both
named tests pass alone. What leaks is module-level state across the file boundary —
`icons.test.ts` asserts *"builds a name once and clones it after — the cache is the
mechanism"*, which is exactly a module singleton that a fresh file is entitled to
assume is empty. The 2× is real and is waiting for the day the suite is
order-independent; a fast run that fails one file in ten is worth less than the minute
it saves.

**Test selection buys nothing here.** `vitest related --run src/domain/board.ts` runs
3391 of 4724 tests, and `vitest run --changed` ran all 306 files. The view tests reach
most of `src/` through the fixtures, so the import graph has no small cut in it. An
inner loop is therefore `npm test` (158 s) — the whole suite without coverage — and not
a subset of it.

**What is left, in the order the numbers suggest.** 128 s of the suite's own accounting
is `environment`: 185 of the 306 files build a jsdom, ~0.7 s each. Nothing here has
measured a cheaper substitute, and swapping the DOM implementation under a harness this
repository's checks depend on is a change to what the tests *mean*, not a speed-up.
