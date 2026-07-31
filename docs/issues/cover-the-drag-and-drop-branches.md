---
type: PBI
parent: "[[codebase-health]]"
order: 70
status: Open
priority: P3
area: testing
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/view/interactions/dragDrop.ts
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

Doing this after [split-the-view-test-suite](split-the-view-test-suite.md) is easier —
drag/drop gets its own file to grow in, and the rect/timer helpers live in the shared
harness rather than being copied.

## Acceptance criteria

- Uncovered branches in `dragDrop.ts` materially reduced.
- Branch threshold in `vitest.config.ts` raised to match, per the project rule that
  thresholds only ever go up.

## Note on the tooling

Fallow's per-file CRAP "risk" column matched only **226 of 1,063 functions**, so its
ranking is partial — it currently rates `noteFields.ts`, a 69-line pure module, as
highest risk. Treat that column as a hint; the coverage JSON above is the real signal.
