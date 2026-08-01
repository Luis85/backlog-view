---
type: Feature
parent: "[[Product Backlog]]"
order: 60
status: Done
---

# Safe writes

The view writes to the user's notes. Everything under this feature exists so that it never
writes something the user did not ask for, and so that what it does write can be undone.

**Outcome** — Nothing is written that the user did not ask for, and everything written can
be taken back.

## Use cases

- [[Undo and redo]] — step back through the last few batches, and forward again. **Open**:
  a bounded history and a dedicated redo, replacing the single slot that shipped in 0.3.0.
- [[The write gate]] — one serialized checkpoint every change passes.
