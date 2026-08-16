---
type: Feature
parent: "[[A view per capability]]"
order: 5
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

# A shared kernel behind the views

Hierarchy traversal, property resolution, workflow, progress, scoring, relationships,
mutation and undo are implemented **once**, below every view, and a view that needs one
calls it rather than growing its own. A second view that reimplements how a parent link
resolves is the point at which the two views start disagreeing about what the vault says.

This is extraction, not invention: the logic exists and is already pure and tested. The work
is making it reachable by a view that is not the backlog view, without changing what any
of it does — which is also the only honest way to verify the extraction, since the existing
tests must pass untouched.

**Outcome** — Two views reading the same note agree about what it means, because there is
one implementation of what it means.
