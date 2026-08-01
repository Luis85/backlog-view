---
type: PBI
parent: "[[Work item hierarchy]]"
order: 40
status: Done
---

# Folder note hierarchy

Optional mode for backlogs organised as folders: a note with no explicit `parent` hangs
from the nearest ancestor **folder note** (`Checkout/Checkout.md`).

## Acceptance criteria

- An explicit `parent` link always beats the folder structure.
- Container folders with no note of their own pass through.
- Files are never moved on disk; re-parenting writes a link.
- Clearing a parent writes an empty marker rather than deleting the key, or inference
  would immediately undo it.
