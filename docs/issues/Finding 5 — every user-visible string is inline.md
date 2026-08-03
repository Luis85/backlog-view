---
type: Issue
parent: "[[Codebase health]]"
order: 140
status: Open
area: i18n
priority: P2
created: 2026-08-03
source: Review of 0.4.0, finding 5 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 5 — every user-visible string is inline

## The finding

User-visible strings are spelled at their use sites rather than owned by a catalog. The count was measured with an instrument that could only see part of the set, which is its own lesson.

## Why it matters

It is larger than it looks: an accessible name built by concatenation is a sentence, so this crosses accessibility as well as translation.

## Where it is tracked

Under [[Multilang]], which predates this review and already owns the question.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
