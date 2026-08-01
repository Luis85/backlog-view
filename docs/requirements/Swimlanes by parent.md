---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/writePlan.ts
  - src/domain/dropTargets.ts
---

# Swimlanes by parent

One level of ancestry, without pretending the board is a tree: optional lanes group
cards under their parent, the way Jira lanes a board by epic and Linear sub-groups by
parent issue. Lanes also give the board its second write axis — a lane is a parent, so
crossing lanes is the drop-onto-a-row the tree already plans.

## Acceptance criteria

- Lanes are optional; off means flat columns. On, each parent's card-children group
  under a lane header naming it, and parentless cards gather in a trailing lane —
  Jira keeps an undeletable "Everything Else" lane for the same reason.
- A lane header opens its parent. A header whose parent is outside the Base's filter
  renders as context and obeys the context-row rule: never a card, never counted,
  never written.
- Lane collapse is remembered per device, like columns and rows.
- Dragging a card into another lane writes the reparent the tree's drop-onto would
  plan — appended order, the autoType cascade only as configured — and, when the
  column differs too, the state change in the same batch: one gate, one undo. A drop
  that would make an item its own ancestor is refused, as in the tree.
