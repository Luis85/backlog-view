---
type: Issue
order: 40
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic; first looked at in the 2026-08-02 pre-release run
---

# Roadmap milestone appearance

A verification to run.

## Why this exists

The whole milestone feature — the diamond, the full-height line, the label and its
truncation, the collision with today — shipped on jsdom class assertions alone.
**Looked at once**, in the maintainer's 2026-08-02 pre-release run, which reported no
problems. That is not the per-point record this note asks for, so it stays open — and the
point that matters most is the two-milestones-a-few-weeks-apart case, whose outcome is what
decides between the three candidate fixes in [[Nearby milestone labels cover each other]].
No such decision has been recorded, so that question is still entirely open. [[Ship the roadmap epic]] is the first real
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
- **Label truncation and the tooltip** — date a milestone with a long title, and confirm
  its label truncates rather than overrunning the grid, and that hovering shows the full
  name in a tooltip. Narrowing the pane cannot produce this case: the grid is
  `width: max-content` at a fixed 4px/day with no zoom, so a narrow pane scrolls rather
  than compresses and label spacing never changes.
- **Two milestones a few weeks apart** — the real collision case. At `DAY_PX = 4` and
  `max-width: 140px` a label spans roughly 35 days of grid, and labels are opaque and
  painted in row order rather than date order, so a later-drawn label can cover an
  earlier one. Date two milestones a few weeks apart and confirm whether the earlier
  one's name is still readable, or silently covered. What you see decides between the
  three candidate fixes in [[Nearby milestone labels cover each other]], which is why
  that note is open rather than already committed to one of them.
- **Past the window edge** — a milestone dated outside the roughly 60-month drawn window
  should show a direction mark (open-start or open-end, the same vocabulary a clipped
  bar uses) and **no diamond** — a diamond at the clamped edge would claim a date the
  note does not have. Confirm the mark itself is legible at normal zoom, in both light
  and dark themes — it is a 10×8 shape with `border-top: 2px` and `opacity: .7`, small
  and faint enough that "present in the DOM" is not the same question as "reads as a
  direction".

## Acceptance criteria

- Every point above checked, each written down as pass or fail rather than assumed —
  this note stays open until it has actually been run.
