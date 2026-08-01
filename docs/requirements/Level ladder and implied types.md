---
type: PBI
parent: "[[Work item hierarchy]]"
order: 20
status: Done
---

# Level ladder and implied types

`type` names a rung on a configurable ladder (`Epic, Feature, PBI, Task`). A child's level
is one rung below its parent's, clamped at the deepest.

An item with no `type` shows the level its position implies, so a folder of untyped notes
reads as a hierarchy before anyone has typed a single one.

## Acceptance criteria

- Level maths chains down the parent levels, never down visual depth (focus mode re-roots
  depth) — enforced by lint.
- An unknown custom type keeps its name, occupies its parent's next slot, and is never
  rewritten.
- Renaming the levels re-levels the whole tree without touching a note.
