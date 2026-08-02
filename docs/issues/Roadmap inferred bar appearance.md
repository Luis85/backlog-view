---
type: Issue
order: 30
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P2
area: verification
created: 2026-08-02
source: Feature Test epic; still owed from the previous roadmap increment
---

# Roadmap inferred bar appearance

A verification to run.

## Why this exists

**This has never been looked at.** [[Spans roll up the tree]] shipped the
`pbl-bar-inferred` class (outlined rather than filled) on jsdom structure tests alone —
the class reaching the DOM is checked, the pixel it produces is not — and it has stayed
unrun through every roadmap increment since. `docs/Product Backlog.base` now gives
`Scheduling work` (a Feature with dated descendants but no dates of its own) a real
inferred bar to look at, next to ordinary stated bars on the same grid, which is the
first chance to run this check at all.

## How to check

Switch to the roadmap's dated axis.

- Find `Scheduling work`'s bar (inferred, spanning its dated descendants) beside an
  ordinary stated bar. Confirm the inferred one reads as a **dashed outline**, not
  filled, in both light and dark themes — and that the two are told apart at a glance,
  not only on close inspection.
- Compare the same outline against `.pbl-timeline-row.pbl-done .pbl-bar`'s green
  override, on a done item's bar if one is dated. Confirm the outline still reads as
  outline-not-filled against the green, in both themes.
- Look specifically at a dashed bar whose end is open (no date on that side, filled from
  a child): does the unclosed dashed edge read as **"this continues, unknown"**, or does
  it read as a rendering glitch — a line that just stops? This is a judgement call, not a
  class assertion, and it is the reason this note exists.

## Acceptance criteria

- All three points checked in both themes, with the open-edge judgement written down
  either way — "reads as open" or "reads as broken" — not left implicit.
