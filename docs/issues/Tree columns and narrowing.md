---
type: Issue
order: 20
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Tree columns and narrowing

A verification to run.

## Why this exists

`columnFit` computes a threshold from the configured width and count; jsdom can assert
how many cells it renders but never that the header actually lines up with the cells below
it, or that the drop reads as graceful rather than jarring.

## How to check

- With the pane at its default width, confirm the column header sits directly above the
  cells it names — no drift row to row.
- Narrow the pane slowly and watch the columns drop from the END of the properties menu's
  order, one at a time, the rollup surviving them all and going last (`pbl-hide-meta`,
  the one class left). Title and structure stay to the end.
- Widen back out and confirm every column returns in the same order it left.
- A dropped column is not rendered at all, so Tab and the screen reader should find
  nothing where it was — check with a checkbox-rendering property in the last column.

## Acceptance criteria

- Header alignment confirmed at default width.
- The drop confirmed to follow the menu's order from its end, both narrowing and widening,
  with the rollup last.
