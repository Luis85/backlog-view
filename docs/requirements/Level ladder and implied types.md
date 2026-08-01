---
type: PBI
parent: "[[Work item hierarchy]]"
order: 20
status: Done
---

# Level ladder and implied types

`type` names a rung on a fixed ladder — `Epic → Feature → PBI → Task`. A child's level
is one rung below its parent's, clamped at the deepest.

An item with no `type` shows the level its position implies, so a folder of untyped notes
reads as a hierarchy before anyone has typed a single one.

## Acceptance criteria

- Level maths chains down the parent levels, never down visual depth (focus mode re-roots
  depth) — enforced by lint.
- An unknown custom type keeps its name, occupies its parent's next slot, and is never
  rewritten.
- The ladder is **not configurable**, on purpose: every rule here would otherwise have
  to hold for any list a user could type, and the reward was a rename.
