---
type: Issue
parent: "[[Codebase health]]"
order: 120
status: Done
area: docs
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 3 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 3 — delete the module table rather than gate it

## The finding

The root guide held a table enumerating one module per concern. A table that enumerates code is wrong the moment a file moves; a table that states a rule cannot be falsified by a code change.

## Why it matters

Deleting it was safe only because rule 7 keeps the guarantee that every module is described somewhere — which is why finding 10 had to land first, in that order.

## Where it is tracked

[[A guide is prose, not an inventory]], `Done`, under [[Guides that describe rather than enumerate]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
