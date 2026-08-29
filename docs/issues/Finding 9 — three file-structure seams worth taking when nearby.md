---
type: Issue
parent: "[[Codebase health]]"
order: 118.75
status: Open
area: architecture
priority: P3
created: 2026-08-03
source: Review of 0.4.0, finding 9 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Finding 9 — three file-structure seams worth taking when nearby

## The finding

Nothing in the tree is forced, but three seams are worth cutting when work is already in that file — not as a scheduled refactor.

## Why it matters

One of them is a new instance of an existing PBI's subject rather than a new question, which is why it hangs there rather than under a fresh feature.

## Where it is tracked

[[Give the type vocabulary its own leaf]], `Open`, under [[One file per concern]] and [[Module structure]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
