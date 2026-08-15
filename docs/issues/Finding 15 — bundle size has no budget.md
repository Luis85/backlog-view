---
type: Issue
parent: "[[Codebase health]]"
order: 119.6875
status: Open
area: tooling
priority: P3
created: 2026-08-03
source: Review of 0.4.0, finding 15 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Finding 15 — bundle size has no budget

## The finding

`npm run build` produces `main.js` and a minified `styles.css` with nothing asserting either stays within a size. The stylesheet gained a 400-line-per-partial gate; the bundle has no equivalent.

## Why it matters

The same shape as the CSS gate and about as small. What it needs first is a number, and setting one just above the current size is the honest default.

## Where it is tracked

No note yet. Small enough to ride along with any build change rather than be scheduled.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
