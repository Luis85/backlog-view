---
type: Issue
parent: "[[Codebase health]]"
order: 230
status: Open
area: ux
priority: P2
created: 2026-08-03
source: Review of 0.4.0, finding 14 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 14 — accessibility is implemented and asserted, and specified nowhere

## The finding

`aria-*` and `role` assertions are spread across the view suite and the layer guide covers tab stops and live regions, so this is not neglected work. What is missing is a contract.

## Why it matters

Nothing says what a screen-reader user is promised, so a11y is checked per feature by whoever wrote it and a new projection has nothing to check against. The board and the roadmap each rediscovered the same questions.

## Where it is tracked

[[What a screen-reader user is promised]], `Open`. It needs brainstorming before a note is drafted — the contract is a product decision, not a refactor.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
