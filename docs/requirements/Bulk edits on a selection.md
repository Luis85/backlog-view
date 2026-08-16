---
type: Feature
parent: "[[Product Backlog]]"
order: 60
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Bulk edits on a selection

Several rows selected at once, and one action applied to all of them — set a state, set a
property, assign a milestone or a release, add a tag, change a type, move them — planned as
one batch, refused as one batch if any target is outside the base, and undone as one batch.

The rules that govern a single write govern all of them: nothing is applied that would leave
the tree in a shape the model cannot represent, and a selection spanning a context row is
refused rather than partly applied.

**Outcome** — A change that belongs to twenty items takes one action and one undo, instead
of twenty of each.
