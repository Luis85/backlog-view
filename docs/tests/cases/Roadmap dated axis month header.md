---
type: Test case
order: 20
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Roadmap dated axis month header

A verification to run.

## Why this exists

`domain/timeline.ts` computes each month's true day count; jsdom can assert the pixel
width it produces but not that the grid actually reads as a calendar to a person looking
at it.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Switch to the dated axis. Scroll across a few months and confirm a 31-day month is
visibly wider than a 30-day one, and February wider still than either — the grid should
not look evenly spaced. Confirm the header stays aligned with the bars beneath it the
whole way across, and that entering the view lands scrolled to today.

## Acceptance criteria

- Unequal month widths confirmed by eye against the true calendar.
- Header-to-bar alignment confirmed while panning.
