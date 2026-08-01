---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/create.ts
---

# New cards in place

Every surveyed board creates in place — GitHub Projects pre-fills the column's field,
Linear creates in the column's status — and two prior Obsidian boards taught the
failure mode from the other side: a new card that lands in the wrong folder, or outside
the base's filter, is a note the board writes and then cannot show.

## Acceptance criteria

- Each column offers creation. The new note goes through the existing gated flow with
  the column's state preset, so everything that governs creation today still governs
  it: type folders, folder mode, the config-problems gate.
- Folder rules cannot rescue a note from a *state* filter: a base can exclude a state
  the workflow still names — `status != Done` beside a Done column — and a filter is
  opaque to the view, so compatibility is detected by outcome, not predicted. When the
  next result set does not contain the note just created, the view says so and offers
  to open it, rather than letting the card silently vanish.
- The no-state column creates without writing a state at all.
- With lanes on, the lane provides the parent and the offered types narrow to what
  that parent may hold; a lane whose parent is outside the filter takes the child by
  explicit link with folder inference skipped, exactly as the tree's context rows do.
- Creation writes the new note only — never the lane's parent, never a sibling.
