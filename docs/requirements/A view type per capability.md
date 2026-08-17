---
type: PBI
parent: "[[A view per capability]]"
order: 10
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

# A view type per capability

Each capability registers its own Bases view type, with its own name and icon in Obsidian's
picker, its own options schema and its own view-state entry. The plugin's entry point
composes — it builds the shared services once and hands them to one registration per view —
and each view owns the registration of itself, so adding a capability adds a file rather
than a branch in a growing function. The views themselves know nothing of each other.

**Outcome** — A vault adds a capability by adding a view to a base, and removes it by
removing the view.
