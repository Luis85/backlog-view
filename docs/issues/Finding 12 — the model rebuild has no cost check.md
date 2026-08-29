---
type: Issue
parent: "[[Codebase health]]"
order: 210
status: Done
area: testing
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 12 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Finding 12 — the model rebuild has no cost check

## The finding

`buildModel` runs on every data update, including the refresh ending every write batch, and made a fixed list of passes over every item with nothing stating the bound. Finding 4 quoted its admission without acting on it.

## Why it matters

Two properties are observable from outside it and both are now counted at two fixture sizes. Neither measures elapsed time, which in a node test would measure the runner.

## Where it is tracked

[[The model build states its cost as a check]] and [[One vault read per note, one sort per item]], both `Done`.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
