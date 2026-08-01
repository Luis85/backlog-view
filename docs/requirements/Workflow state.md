---
type: PBI
parent: "[[Progress tracking]]"
order: 10
status: Done
---

# Workflow state

An optional state property (`status`) with configurable values, editable from a chip on the
row or from the context menu.

## Acceptance criteria

- With no state property configured, nothing state-related renders and no state is written.
- The menu offers the configured states, else the ones observed in the base, always
  including a done value.
- The item's own unlisted value still renders as checked.
- A row the Base excluded shows its state but cannot have it changed.
