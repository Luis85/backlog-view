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
- With no results but a configured workflow, the columns still render — every stage a
  creation target — and the tree's empty-state honesty (the ignored-notes count, the
  create path) renders as an advisory beside them, not as their replacement: an empty
  board is empty stages, never no stages.
- A configured state with no cards still renders its column. Boards that derive
  columns from observed values lose exactly this — an empty stage vanishing is the
  most repeated complaint against them — and a workflow stage exists whether or not
  anything currently sits in it.
- An empty column is a drop target and visibly says so while a drag is over it.
