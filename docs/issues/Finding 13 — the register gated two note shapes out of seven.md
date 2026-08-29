---
type: Issue
parent: "[[Codebase health]]"
order: 220
status: Done
area: docs
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 13 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Finding 13 — the register gated two note shapes out of seven

## The finding

`docs-check.mjs` gated the use-case and ADR shapes; the other five rested on convention. That was tolerable until the release sweep began querying an `Issue`'s shape.

## Why it matters

Scoped smaller than the finding proposed. Enforcing the three documented `Issue` shapes cannot land — most of the folder does not match the shape its own opening heading implies, and requiring `## Outcome` of an unrun verification contradicts the README.

## Where it is tracked

[[The sweep query rests on a checked convention]], `Done`, with the unresolved half recorded as [[The documented Issue shapes are not the ones in the folder]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
