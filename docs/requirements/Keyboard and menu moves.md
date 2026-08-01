---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 20
status: Done
---

# Keyboard and menu moves

Everything drag-and-drop does, without a mouse: `Alt`+arrows move, indent and outdent; the
context menu offers the same plus move-to-top and move-to-bottom.

## Acceptance criteria

- The tree is a single tab stop; arrows move the selection, as a tree widget should.
- A command that cannot apply is disabled rather than silently doing nothing.
- Commands target the nearest *visible* neighbour, so none is visually inert when finished
  work is hidden.
