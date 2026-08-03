---
type: Issue
parent: "[[Codebase health]]"
order: 160
status: Done
area: verification
priority: P2
created: 2026-08-03
closed: 2026-08-03
source: Review of 0.4.0, finding 7 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 7 — the live-vault verifications have no cadence

## The finding

The checks this repository cannot run accumulated in `docs/issues/` with no point at which anyone runs them. "We have never checked that" was a thing discovered by reading the folder.

## Why it matters

The sweep derives its set by query rather than by list, so a verification added tomorrow is in it without anyone editing a checklist.

## Where it is tracked

[[A cadence for the checks CI cannot run]], `Done`. Its parent [[Verifications a device has to answer]] stays `Open` on finding 2's child.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
