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
the class it lands on but never that the header actually lines up with the cells below
it, or that the drop reads as graceful rather than jarring.

## How to check

- With the pane at its default width, confirm the column header sits directly above the
  property, rollup, horizon and state cells it names — no drift row to row.
- Narrow the pane slowly and watch the columns drop in order of usefulness: properties
  first (`pbl-hide-props`), then the rollup (`pbl-hide-meta`), then the horizon chip
  (`pbl-hide-horizon`), then the state chip (`pbl-hide-state`) — title and structure stay
  to the end.
- Widen back out and confirm every column returns in the same order it left.

## Acceptance criteria

- Header alignment confirmed at default width.
- The four-step drop confirmed in that order, both narrowing and widening.
