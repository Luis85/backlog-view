---
type: Issue
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
priority: ""
iteration: ""
---

# A shared kernel behind the views

Hierarchy traversal, property resolution, workflow, progress, scoring, relationships,
mutation and undo are implemented **once**, below every view, and a view that needs one
calls it rather than growing its own. A second view that reimplements how a parent link
resolves is the point at which the two views start disagreeing about what the vault says.

**Two halves, and conflating them is how an extraction turns into a rewrite.** Hierarchy,
properties, workflow, progress, mutation and undo already exist, pure and tested: that half
is extraction, verified by the existing tests passing untouched, and nothing in it may change
behaviour. Scoring, health rules, readiness and the dependency analyser exist nowhere — that
half is **new code**, written with the view that needs it first, and it belongs in the kernel
from its first line rather than being written inside a view and pulled out later. New logic
brings its own tests; it cannot borrow the extraction's proof.

**Outcome** — Two views reading the same note agree about what it means, because there is
one implementation of what it means.
