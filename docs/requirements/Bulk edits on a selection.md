---
type: Feature
parent: "[[Product Backlog]]"
order: 80
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
priority: ""
iteration: ""
---

# Bulk edits on a selection

Several rows selected at once, and one action applied to all of them — set a state, set a
type, set any configured property, add a tag, move them — planned as one batch, refused as
one batch if any target is outside the base, and undone as one batch.

**The set is whatever the vault has configured, and nothing more.** "Assign a milestone" is
not in it and cannot be: a `Milestone` here holds nothing and is placed by its own date, so
there is no item-side property such an action could write. A release assignment joins the
list when [[Release Management]] gives an item a release property to hold — which is the rule
generally, not an exception: a bulk action exists for a property that exists.

The rules that govern a single write govern all of them: nothing is applied that would leave
the tree in a shape the model cannot represent, and a selection spanning a context row is
refused rather than partly applied.

**Outcome** — A change that belongs to twenty items takes one action and one undo, instead
of twenty of each.
