---
type: Bug
parent: "[[Types beside the ladder]]"
order: 20
status: Done
closed: 2026-08-01
source: automated review of PR #22
---

# Nested extra type lost its pinned rank

## What happened

Moving a subtree that *contained* an extra type rewrote that type's children. The dragged
root carried its pinned rank, but the recursive walk descended into a Bug below it using the
positional level — so moving a Feature containing a Bug retyped the Bug's Tasks to PBIs.

The worst shape a bug can have: the Bug itself was skipped and looked untouched, while its
children were silently corrupted.

## Fix

The root case and the nested case are one rule (`rankOf`), applied at the root and at every
step of the walk. A test moves a Feature-with-Bug subtree to the top level and asserts the
Bug's Task is not written; it fails against the previous commit.

## Lesson

**A rule that pins a rank has to hold wherever that type appears** — at the root of a move,
inside a moved subtree, and in the scope test — not only where it was first noticed.
