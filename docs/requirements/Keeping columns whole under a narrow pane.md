---
type: PBI
parent: "[[The prioritized list]]"
order: 30
status: Open
created: 2026-08-21
source: design pass, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Keeping columns whole under a narrow pane

**As** someone reading the prioritized list on a narrow pane, **I want** a column that no
longer fits to disappear whole rather than run off the edge, **so that** a squeezed row
never leaves a column half-drawn with no sign that anything is missing.

Measured 2026-08-21, headless Chromium over the real view and the real stylesheet at window
widths from 1200px down to 380px (`?measure`, `test/harness/estimation.ts`). The row's six
columns are all fixed width — four numeric columns at 72px, the title, and a 140px currency
column — and only the title gives up width as the pane narrows, down to its own 96px floor.
The row's minimum is therefore **588px**: the 96px title floor, four 72px columns, the
140px currency column, five 8px gaps between them and 24px of padding. The panel beside the
table keeps its own 320px floor, so the view needs about **940px** before the track can
hold all six columns without shrinking further.

Below that width the row does not shrink further — it overflows. `.pbl-est-table` declares
`overflow-y: auto` and no `overflow-x`, and CSS computes a `visible` overflow on one axis to
`auto` the moment the other axis is not `visible` — so the table gained a horizontal
scroller nobody wrote. Screenshotted at 900px: the `Currency` header and every chip on
every row sit past the right edge, and the only trace on screen is a 2px sliver of an
orange chip against the table's own border — the scroll edge, not a partial draw. So the
end column is not clipped and not half-drawn; it is scrolled, and reachable only by
scrolling to it.

**This is opened rather than built, and the previously recorded reason for deferring it was
false.** The prior design pass deferred a fix with "a real breakpoint wants a live vault's
actual pane widths rather than a threshold guessed in a harness" — as though the tree's own
mechanism, `columnFit`/`syncColumnFit` (`src/view/render/columns.ts`), picks a fixed CSS
breakpoint and this table merely lacks the equivalent guess. It does not: `columnFit`
guesses no threshold at all. It SUMS the drawn columns' own widths against the measured pane
width, for the explicit reason recorded beside it that a fixed CSS breakpoint would clip two
280px columns in a 700px pane. No breakpoint is wanted anywhere in that mechanism and none
is being guessed, so that is not why this table still lacks it. Recorded here so the next
reader does not defer this again for a reason already known to be false.

The honest reason to defer is size. `columnFit`/`syncColumnFit`'s shape is a
measure-then-re-render pass: the pane is measured, a column count is decided, and
`syncColumnFit` reports whether that verdict CHANGED so the caller knows it owes another
render. Bringing that shape to this table means a header that must describe the exact same
frame the rows do — today the two are one static markup pass apiece — and, with no
counterpart anywhere else in the tree, a **persisted sort pick that can name a column this
pane does not draw**: `estimationSort` survives a rebuild and a reopen
([[Ranking the items by value]]), and a pane narrow enough to drop the sorted column would
have to say what the sort now means, which nothing in the tree has ever had to answer.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is reading the prioritized list on a pane narrower than about 940px |
| **Trigger** | The pane narrows past the point where all six columns fit at their fixed widths |
| **Preconditions** | The model resolves without problems and the table is drawing rows |
| **Guarantee** | A column that does not fit is either drawn in full or not drawn at all — never partially occluded, and never reachable only by a scroller nobody intended |

**Main flow**

1. The pane narrows below about 940px. The title has already given up width down to its
   96px floor, and the row as a whole no longer fits.
2. A measure-then-render pass, the same shape `columnFit`/`syncColumnFit` already gives the
   tree's own property columns, decides how many of the fixed-width columns the pane can
   still hold at full width.
3. The header redraws to describe the same frame the rows now do: a dropped column's header
   is absent too, not clipped beside the ones that remain.
4. If the dropped column is the one the persisted sort pick names, the view says the sort no
   longer applies to what is on screen, rather than silently sorting by a column nobody can
   see.
5. Widening the pane back past the threshold restores the column and, if the sort had been
   suspended by step 4, resumes it.

**Extensions**

- **1a — measured today, before this is built.** The table has no such mechanism: below
  588px the row stops shrinking and CSS's own `overflow-y: auto` / `overflow-x: visible`
  combination silently computes a horizontal scroller, so the currency column is reachable
  only by scrolling to it and the only on-screen trace at 900px is a 2px sliver of a chip
  against the table's border.
- **2a — the pane is too narrow for even the smallest useful set.** Which column drops
  first, and how few columns this table can still usefully show, is not decided here —
  recorded as the open question this PBI exists to carry, not as a design already chosen.
- **4a — no column is currently sorted, or the sorted column is not the one dropped.**
  Nothing changes; the suspension in step 4 only ever applies to the one column actually
  named by `estimationSort`.

## Acceptance criteria

- Below the width where all six columns fit, a column is either drawn at its full declared
  width or not drawn at all — never clipped, never scrolled past silently.
- The header and the rows agree on which columns are drawn, at every width.
- A persisted sort naming a column the pane currently drops is not silently applied to a
  frame that no longer shows it.
- `.pbl-est-table` no longer grows a horizontal scroller as a side effect of the vertical
  one.

## Where it lives

Nothing yet — this PBI is opened, not built. `src/view/estimation/renderTable.ts` and
`styles/estimation.css` are where the table's header and rows are drawn today, and
`src/view/render/columns.ts` (`columnFit`, `syncColumnFit`) is the tree's own instance of
the measure-then-re-render shape this table would need to borrow rather than reinvent.
`src/storage/viewStateStore.ts`'s `estimationSort` is the persisted pick a narrower pane
would have to reconcile against whatever it can still draw.
