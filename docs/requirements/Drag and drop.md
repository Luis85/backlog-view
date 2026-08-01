---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 10
status: Done
---

# Drag and drop

Drag a row and drop it **between** two rows to rank it there, **onto** a row to make it a
child, or onto the bottom strip to make it top level.

## Acceptance criteria

- Drop targets are indicated before the drop, and an illegal drop (onto a descendant, or
  onto itself) is refused rather than corrupting the tree.
- Hovering a collapsed row long enough expands it, so a drop deep in the tree is reachable.
- Dragging is disabled while the quick filter is active: visual neighbours are not siblings.
- A row from outside the Base's filter is never draggable and never a ranking peer.
