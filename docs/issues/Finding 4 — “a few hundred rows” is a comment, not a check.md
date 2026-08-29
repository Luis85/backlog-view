---
type: Issue
parent: "[[Codebase health]]"
order: 130
status: Done
area: testing
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 4 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: Ben
iteration: ""
---

# Finding 4 — “a few hundred rows” is a comment, not a check

## The finding

`src/view/CLAUDE.md` made four claims about what keeps rendering cheap. Two were checks. One of the remaining two was not merely unchecked but false.

## Why it matters

`DragDropController.clearDragState` ran a full-tree `querySelectorAll` on every `dragend`, under a guide saying no interaction scans the DOM — and two registrations reached it, so a tree-row drag paid it twice.

## Where it is tracked

[[The render path states its costs as checks]], `Done`, with the defect it uncovered filed as [[The drag cleanup scans the whole tree]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
