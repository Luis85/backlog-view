---
type: Issue
parent: "[[Property columns]]"
order: 20
status: Open
priority: P3
area: design
created: 2026-08-09
source: implementation of ADR 0023; noticed while making the header ask the fit rather than the configuration
files:
  - src/view/render/columns.ts
  - styles/propertyColumns.css
---

# The rollup is hidden by class and headed by verdict

A decision taken.

## The decision

[ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md) replaced the
`pbl-hide-*` ladder with a count, so a column the pane cannot hold is not rendered at
all. The rollup did not follow, and the two halves of it now answer different questions:

- **The rows** draw it from the CONFIGURATION. `renderRollup` creates `.pbl-meta-col`
  whenever `settings.stateKey` or `settings.showCounts` is set, and `syncColumnFit`
  toggles `pbl-hide-meta` on the view element to take it away again.
- **The header** asks the VERDICT. `renderColumnHeader` gates its rollup label on
  `ctx.host.columnFit?.rollupDropped`, and draws no header bar at all when there are
  neither columns nor a rollup left to name.

Both are in `src/view/render/columns.ts`. The asymmetry was left in place rather than
resolved, and this note is here so the next reader finds a decision instead of deriving
one.

## Why

Because it cannot disagree visibly, and the mechanism it keeps is not the one the ADR
argued against.

`columnFit` returns `rollupDropped` only when `shown` is 0, so a hidden rollup implies an
empty column slice, and an empty slice with no rollup is exactly the case the header
returns early on. There is no width at which the bar names a rollup the rows are hiding.
And the reason the ADR gives for not clipping does not apply here: `pbl-hide-meta` is
`display: none` (`styles/propertyColumns.css`), which takes the box out of the
accessibility tree, and the rollup contains no control in the first place — it is a
progress bar or a count.

What is left is one concept with two mechanisms behind it, which is the shape a later
change gets wrong. It is a cost, not a defect.

## What a real fix would look like

Two candidates, and choosing between them is the work this note is asking for:

- **Push the rollup into the count.** Make it the last entry of the resolved list with a
  kind of its own, so one number decides every trailing cell and `pbl-hide-meta` goes
  with the other four. It is the tidiest end state and the largest change: the rollup is
  not a Bases property, so it has no id, no display name and no place in `getOrder()` —
  the list would stop being "what the properties menu declares" and become "that, plus
  one".
- **Give the rows the verdict too.** Have `renderRollup` take the same
  `columnFit.rollupDropped` the header reads and render nothing rather than a hidden box,
  deleting the class. Small, and it makes the rule uniform.
  **It is cheaper than this note first priced it.** The cost claimed here was that a card
  projection would lose its way of turning the rollup back on — clearing a class rather
  than carrying a tree verdict onto a frame that has none. That does not hold:
  `src/view/backlogView.ts` already calls `setColumnFit(null)` on entering any non-tree
  projection, and it does so BEFORE the content renders, so a card frame reads
  `host.columnFit?.rollupDropped` as `undefined` and a verdict-reading `renderRollup`
  draws. The card side needs nothing added; what the change actually costs is the
  `pbl-hide-meta` line in `styles/propertyColumns.css` and the `removeClass` beside that
  reset. Which of the two candidates to take is still open — this corrects the price, not
  the choice.

## Acceptance criteria

- One of the two above is chosen, or the asymmetry is re-affirmed with the reason stated
  here still holding.
- Whichever is chosen, the rows and the header keep reading ONE stored verdict
  (`host.columnFit`), so they cannot describe different frames.
