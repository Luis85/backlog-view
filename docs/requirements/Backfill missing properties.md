---
type: PBI
parent: "[[Creating items]]"
order: 30
status: Done
---

# Backfill missing properties

One toolbar button writes `type` and `order` for every note that lacks them, so a folder of
plain notes becomes a backlog without hand-editing.

## Acceptance criteria

- Existing values are never overwritten.
- No type is guessed for an item whose parent is outside the view.
- The whole batch is one refresh and one undo, with progress shown while it runs.
