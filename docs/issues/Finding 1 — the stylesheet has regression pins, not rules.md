---
type: Issue
parent: "[[Codebase health]]"
order: 100
status: Open
area: styling
priority: P2
created: 2026-08-03
source: Review of 0.4.0, finding 1 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: Igmar
---

# Finding 1 — the stylesheet has regression pins, not rules

## The finding

`styles/` carried assertions pinned to specific regressions rather than rules that state what must hold. A pin catches the bug it was written for and nothing adjacent.

## Why it matters

The split into one partial per concern landed with a 400-line gate in `styles-assemble.mjs`, so the size rule is now enforced by the build. What the pins were standing in for is still open.

## Where it is tracked

[[Styling rules are checks]] carries the remainder, under [[Theming and styling]]. Both `Open`.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
