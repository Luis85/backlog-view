---
type: Issue
order: 40
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P2
area: verification
created: 2026-08-02
source: Feature Test epic; new this increment, never looked at
---

# Roadmap milestone appearance

A verification to run.

## Why this exists

The whole milestone feature — the diamond, the full-height line, the label and its
truncation, the collision with today — shipped on jsdom class assertions alone.
**Nothing below has ever been looked at.** [[Ship the roadmap epic]] is the first real
milestone in the register, so it is the first chance to look at any of it.

## How to check

Switch to the roadmap's dated axis.

- **The cyan badge and diamond** — `Ship the roadmap epic`'s row carries the cyan
  `diamond` badge ([[Tree badges and icons]] checks the same badge in the tree; confirm
  it also reads correctly here), and its bar is a diamond mark rather than a rectangle.
- **The full-height line and its label** — a line runs the whole grid at the milestone's
  date, behind the bars, with a label in the header band naming it. Confirm the line
  does not visually compete with the bars it crosses, and the label sits legibly above
  the grid rather than colliding with the month header.
- **Two milestones, one date, one line** — temporarily date a second milestone note (or
  add one, then discard the change) to the same day as `Ship the roadmap epic`. Confirm
  exactly one line is drawn, and its label names both, joined — not two overlapping
  lines misreporting the count.
- **A milestone dated today** — temporarily set (or add) a milestone dated today.
  Confirm it draws beside the today line, nudged into the same day cell rather than
  overlapping it, that today's own mark stays on top, and that the two remain
  distinguishable rather than reading as one thick line.
- **Label truncation and the tooltip** — narrow the pane until the milestone's label
  would collide with a neighbour. Confirm it truncates rather than overlapping the grid,
  and that hovering shows the full name in a tooltip.
- **Past the window edge** — a milestone dated outside the roughly 60-month drawn window
  should show a direction mark (open-start or open-end, the same vocabulary a clipped
  bar uses) and **no diamond** — a diamond at the clamped edge would claim a date the
  note does not have.

## Acceptance criteria

- Every point above checked, each written down as pass or fail rather than assumed —
  this note stays open until it has actually been run.
