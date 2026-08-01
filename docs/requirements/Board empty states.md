---
type: PBI
parent: "[[Backlog and board]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/render/emptyStates.ts
---

# Board empty states

The board tells the truth about why it is empty, the way the tree's empty states
already do: a base full of plain notes is a different problem than a base with nothing
in it, and both are different from a workflow with no states.

## Acceptance criteria

- With no state property configured, the board names the option to set and where,
  instead of rendering nothing.
- With no results, the tree's own empty state renders unchanged — including its
  ignored-notes honesty and its create button.
- A configured state with no cards still renders its column. Boards that derive
  columns from observed values lose exactly this — an empty stage vanishing is the
  most repeated complaint against them — and a workflow stage exists whether or not
  anything currently sits in it.
- An empty column is a drop target and visibly says so while a drag is over it.
