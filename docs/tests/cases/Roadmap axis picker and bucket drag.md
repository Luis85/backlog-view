---
type: Test case
order: 10
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Roadmap axis picker and bucket drag

A verification to run.

## Why this exists

The axis picker's appearance rule and the shelf's drag-target behaviour are both
conditional on configuration and on a live drag — neither is something jsdom renders.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- **The axis picker** — with only one axis configured (only `horizonProperty`, or only
  the date properties), the picker beside the roadmap toggle should not appear at all.
  With both configured (as `docs/Product Backlog.base` now has), it should appear and
  switch between horizon buckets and the dated grid.
- **Bucket drag and drop** — on the horizon axis, drag a card between buckets; the target
  bucket highlights, and dropping writes the horizon value. Drag a card onto the shelf;
  the horizon key is removed rather than blanked (the card becomes unplaced).
- **The empty shelf appearing mid-drag** — with every card placed, the shelf should be
  absent. Pick a card up: the shelf should appear as a real, dashed drop target, and
  disappear again once the drag ends without a drop there.

## Acceptance criteria

- The picker's appear/disappear rule confirmed against both single-axis configurations.
- Bucket drag, the shelf drop, and the empty shelf's mid-drag appearance all confirmed.
