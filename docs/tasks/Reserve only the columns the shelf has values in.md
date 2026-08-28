---
type: Task
order: 10
parent: "[[Cards or a list on the shelf]]"
status: Done
priority: P2
area: ux
created: 2026-08-28
closed: 2026-08-28
source: Found while looking at the shelf in the browser harness after the type-header fix —
  measured before it was described
files:
  - src/view/render/columns.ts
  - src/view/render/board.ts
  - src/view/render/shelf.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Reserve only the columns the shelf has values in

## Evidence

Measured in the browser harness at a 1280px pane over the demo backlog's twenty unplaced
items, in the compact-row layout:

| column | rows that drew it |
| --- | --- |
| assignee | 20 |
| start | 0 |
| target | 0 |
| a plain property | 0 |
| tags | 20 |

Three of the five reserved columns drew on **no row at all** — 384px of every row — while
every title in the band sat at its own 16ch floor (132px) and truncated: `Cut the release
br…` with 384px of nothing to its right.

That is the shelf's own population showing through the tree's column set: the shelf holds
what the axis could not place, so on a dated roadmap the start and target columns are
empty by definition on every card in it, and a plain property nobody has filled in is
empty everywhere.

## What changed

`columnsWithContent` (`src/view/render/columns.ts`) answers which columns a POPULATION has
anything to show in, and `renderShelf` asks it once per render for the compact layout,
handing the answer to every row through `ShelfWiring`. `renderCardBody` takes the list as
an option (`columns`) and filters its own card kinds out of that instead of the whole
resolved set.

Three things make it safe rather than a narrowing that hides work:

- **Only the three kinds that can be blank are asked.** Every chip kind draws its own
  invitation for an unset note — a dashed `Assignee`, a `State` — so a chip column is never
  empty and asking would always answer yes.
- **The question is `drawsSomething`**, the same one `renderValue` asks, so a column kept
  here and a cell drawn there cannot disagree about what an empty value is.
- **It is per BAND, never per row.** `holdEmpty` is unchanged: a row still holds a cell
  open for a column its own note has no value for, because a row that dropped one would
  move every cell after it and the column would stop being a column.

Read from the GROUPS, like the rollup reservation beside it: the type filter is applied in
`organizeShelf`, and a folded group still counts, so opening one cannot move the columns.

## What it bought

Same pane, same twenty items: five reserved columns became two, and the title went from
132px — its floor — to 377px. No card lost a value, because the columns that went drew
none.

## Why the tree does not do this

The tree has a column HEADER. An empty column under a header is a column a reader can see
is empty, which is information; the same width on a headerless band is a stretch of
nothing. The tree also measures a different question in `columnFit` — how many columns the
PANE can hold — which drops from the end of the properties menu's order and is about space
rather than about content.

## What it does not fix

At a 560px pane the row's cells still shrink to slivers rather than dropping: the assignee
chip clipped to its icon, the state chip to a half-circle, the breadcrumb to `↳ Retir…`.
Fewer columns move that onset down but do not change the rule, and the tree's own answer —
a column that does not fit is not rendered — needs the band to measure itself the way
`columnFit` measures the pane. Recorded here rather than attempted:
[[Cards or a list on the shelf]] extension 3a already states the shrink-rather-than-drop
trade and what it costs the state cell.
