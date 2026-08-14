---
type: Task
order: 20
parent: "[[A test suite that can be navigated]]"
status: Done
priority: P3
area: testing
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/view/interactions/dragDrop.ts
  - test/view/dragDrop.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Close the drag-and-drop coverage gap

## Evidence

Uncovered branches by file, from `coverage/coverage-final.json`:

| File | Uncovered branches |
| --- | --- |
| `src/view/interactions/dragDrop.ts` | **21** |
| `src/view/render/rows.ts` | 15 |
| `src/view/backlogView.ts` | 11 |
| `src/storage/collapseStore.ts` | 8 |

Overall branch coverage is 92.3%, so this is not a thin suite — the gap is concentrated.

## Why it matters

`dragDrop.ts` has more than double the uncovered branches of any other file, and it is
the most interaction-heavy code in the plugin: transient drag state, drop indicators, a
600 ms hover-expand timer, the root strip, and the tree-background drop path. It is
under-covered *because* it is awkward to drive — jsdom returns zero-sized rects, so
every drop-zone test has to stub `getBoundingClientRect`, and the timer needs fake
timers.

Awkward-to-test and least-covered are the same fact here, and that combination is where
a regression will hide.

## Approach

The uncovered branches cluster in paths the current tests skip:

- `dragleave` where `relatedTarget` is inside the row (should not clear the indicator).
- Hover-expand: the timer firing, being cancelled by leaving, and the re-entry guard
  when the same row is hovered twice.
- The tree-background drop path (`evt.target !== treeEl` early returns).
- `dataTransfer` being absent, which every branch guards for but nothing exercises.

Doing this after [split-the-view-test-suite](Split%20the%20view%20test%20suite.md) is easier —
drag/drop gets its own file to grow in, and the rect/timer helpers live in the shared
harness rather than being copied.

## Acceptance criteria

- Uncovered branches in `dragDrop.ts` materially reduced.
- Branch threshold in `vitest.config.mts` raised to match, per the project rule that
  thresholds only ever go up.

## Note on the tooling

Fallow's per-file CRAP "risk" column matched only **226 of 1,063 functions**, so its
ranking is partial — it currently rates `noteFields.ts`, a 69-line pure module, as
highest risk. Treat that column as a hint; the coverage JSON above is the real signal.

## Outcome

Done: **21 uncovered branches to 0**, and overall branch coverage 92.3% to 94.1%. The
`vitest.config.mts` branch threshold went 89 to 92.

Four of the twenty-one could not be reached by any test, and no test pretends otherwise.
`getDraggedItem()` already returned null when `host.model` was null, but each call site
re-checked `host.model` anyway to narrow the type — branches that only the type checker
could take. `dragContext()` now returns the dragged item *and* the model it was found
in, so the check happens once and the call sites have nothing left to guard.

The rest were reachable and are now driven:

- `dataTransfer`, absent from every jsdom drag event, supplied by a `transferEvent`
  helper — so `setData`, `effectAllowed` and the three `dropEffect` assignments run.
- `dragleave` with `relatedTarget` inside the row: the indicator stays.
- Hover-expand's re-entry guard (a second `dragover` must not restart the 600 ms wait)
  and its cancel path (the pointer moving to the row's edge).
- The tree background: a drop landing on a row group, and a drag over an item already
  last at the top level, which is offered no drop.
- A drag with nothing in flight — a file dragged in from outside Obsidian.
- A drag whose note is deleted mid-gesture, so the path outlives the item.
- A row the browser has not measured, where the zero-height rect falls back to the
  middle of the row rather than dividing by zero.

`rows.ts` (15) and `backlogView.ts` (11) are now the largest remaining gaps.
