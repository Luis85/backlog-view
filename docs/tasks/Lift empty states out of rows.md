---
type: Task
order: 10
parent: "[[Module structure]]"
status: Done
priority: P3
area: refactor
closed: 2026-08-01
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/view/render/rows.ts
---

# Lift the empty states out of `rows.ts`

## Evidence

`src/view/render/rows.ts` is **392 counted lines against the 400-line `max-lines` cap**
enforced by lint. It is the file closest to failing that budget, so the next feature
that touches row rendering has nowhere to put itself.

## Why it matters

Two subjects share the file. Row rendering is the hot path — it runs per row, and
`RowContext` exists precisely to keep per-row work proportional. The *empty* states run
at most once per render and share no state with it:

- `renderLoadingState` — before the first result set arrives
- `renderEmptyState` + `emptyHint` — nothing in the base
- `renderFilterEmptyState` — filter matched nothing
- `renderAllDoneState` — everything done and hidden

Roughly 70 lines with no coupling to `RowContext`, the row index or the drag controller.

## Approach

Move them to `src/view/render/emptyStates.ts`. `renderTree` keeps deciding *which* state
applies — that decision reads the model and belongs with the tree — and calls into the
new module to draw it.

Takes `rows.ts` to roughly 320 lines and gives both files a single subject.

## Acceptance criteria

- Pure motion: no behaviour change, tests pass with import paths as the only edit.
- `renderTree`'s branching over which empty state to show stays where it is.

## Note

This is a genuine seam, unlike the splits fallow proposes for `create.ts`,
`structure.ts` and `dropTargets.ts` — those are 115–140 line modules that each do one
thing, and were deliberately left alone.

---

## Outcome

Done as pure motion. `src/view/render/emptyStates.ts` now holds `renderLoadingState`,
`renderEmptyState`, `emptyHint`, `renderFilterEmptyState` and `renderAllDoneState`;
`renderTree` still decides *which* state applies, because that decision reads the model.
`rows.ts` went 325 raw lines to 263, and the whole edit outside the move was three import
lines — `rows.ts` dropped `newItemLevel`, `backlogView.ts` takes `renderLoadingState`
from the new module. All 210 view tests passed untouched, which is the evidence that
nothing but the address changed.
