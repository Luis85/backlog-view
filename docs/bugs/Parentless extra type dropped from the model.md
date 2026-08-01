---
type: Bug
parent: "[[Types beside the ladder]]"
order: 30
status: Done
closed: 2026-08-01
source: automated review of PR #22
---

# Parentless extra type dropped from the model

## What happened

`pruneOutsideHierarchy` asked whether a note's type was one of the configured *levels*, so a
parentless note typed `Bug` or `Issue` belonged to nothing and left the model — the note
vanishing from the view moments after being typed.

Both routes were reachable, and precisely because the type rules are advisory rather than
enforced: `Set type` offers the extra types on any row, and dragging one to the top level is
deliberately not refused.

## Fix

Hierarchy membership now reads every **declared** type, levels and extra types alike — an
extra type is a work item by the same argument a level is. A type the view knows nothing
about is still pruned, which is what the scope is for.
