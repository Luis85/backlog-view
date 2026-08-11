---
type: Test case
order: 10
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Tree badges and icons

A verification to run.

## Why this exists

`NON_RUNG_STYLE` in `src/view/render/rows.ts` is asserted by class in jsdom, never by
pixel. The milestone diamond is new this increment and has never been looked at.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Point `docs/Product Backlog.base` at the tree and find one row of each type:

- `Epic`, `Feature`, `PBI`, `Task` — the four level badges, coloured by level.
- `Issue` — `circle-alert`, pink.
- `Bug` — `bug`, red.
- `Milestone` — `diamond`, cyan (`--color-cyan-rgb`).

All seven should read as peers — same size, same weight — never as an error state. Pink
and red must be distinguishable from each other and from the four level colours, in both
light and dark themes. The milestone's diamond and cyan must likewise read as its own
mark, not a fifth level.

## Acceptance criteria

- Every one of the seven badges checked in both themes.
- Nothing yet checked; this is the first look at the milestone badge.
