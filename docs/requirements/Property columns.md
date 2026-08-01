---
type: PBI
parent: "[[View state]]"
order: 20
status: Done
---

# Property columns

The Base's visible properties render as aligned columns, with tags editable inline.

## Acceptance criteria

- Columns are fixed-width so values line up across rows regardless of title length.
- A pane too narrow drops whole columns rather than shrinking them out of alignment.
- Tag edits are written as a delta, never as a computed list, so two quick edits cannot
  undo each other.
