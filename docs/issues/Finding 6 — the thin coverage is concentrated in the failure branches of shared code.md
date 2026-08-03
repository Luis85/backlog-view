---
type: Issue
parent: "[[Codebase health]]"
order: 150
status: Done
area: testing
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 6 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 6 — the thin coverage is concentrated in the failure branches of shared code

## The finding

Coverage was high in aggregate and thin in exactly the places a defect hides — the failure branches of code the projections share.

## Why it matters

Filed under the existing feature rather than a new one: a second feature saying what the first already says is the duplication [[Check that a feature lists its use cases]] retired.

## Where it is tracked

[[Coverage where the projections share code]], `Done`, under [[Test harness and coverage]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
