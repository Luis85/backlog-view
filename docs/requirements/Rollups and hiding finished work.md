---
type: PBI
parent: "[[Progress tracking]]"
order: 20
status: Done
---

# Rollups and hiding finished work

Each parent counts its descendants and how many are done, and can hide subtrees that are
entirely finished.

## Acceptance criteria

- Rollups describe what the Base returned: a row loaded only for context is traversed
  *through* but never counted.
- Hiding is a render decision only — ranking still uses full sibling lists.
- A parent whose children are all hidden renders as a leaf, not as an empty expander.
