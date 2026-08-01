---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 30
status: Done
---

# Sibling ranking

`order` is a fractional rank within a sibling group: dropping between two items takes the
midpoint, and when the gap closes the whole group renumbers.

## Acceptance criteria

- A drop writes as few notes as possible — usually one.
- Renumbering is refused when the group holds a row the Base excluded, since its real
  siblings were never loaded; the item is appended instead.
- Ranking always runs over the real roots, never the rendered ones — enforced by lint,
  because focus mode makes rendered roots a synthetic group.
