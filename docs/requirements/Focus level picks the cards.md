---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 10
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/itemTypes.ts
---

# Focus level picks the cards

Azure DevOps keeps a separate board per backlog level behind one selector — Epics,
Features, Stories. The focus level is already that selector here: in the tree it
re-roots, on the board it decides which rung becomes cards.

## Acceptance criteria

- With a focus level set, the cards are that level's items — plus the extra types that
  rank beside it, exactly as focus mode already surfaces them in the tree, so a Bug
  ranks with the level it sits level with rather than vanishing.
- With no focus level, every result is a card, and each card's type badge carries the
  difference.
- Changing focus is a render decision and writes nothing.
- Focus narrows the board and its counts together, and nothing falls silently: results
  below the focused level surface in card rollups, ancestors as context. The epic's
  every-result-has-a-column invariant is stated at full scope, and clearing focus
  restores it.
- The same toolbar control drives both projections and persists the same way it does
  today.
