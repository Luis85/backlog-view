---
type: Issue
order: 30
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Tree drag between siblings, into a parent and onto the root strip

A verification to run.

## Why this exists

`view/interactions/dragDrop.ts` computes drop zones and indicators; jsdom drives the
events but renders no indicator, no hover-expand animation and no cursor.

## How to check

- **Between siblings** — drag a row and drop it between two others under the same
  parent; the indicator line should land exactly between them, and the drop should
  reorder without changing `parent`.
- **Into a parent** — drag a row onto another row's body; the target should highlight
  as a container, and the drop should set `parent` to it, placed after its existing
  children.
- **Onto the root strip** — drag a nested row to the strip at the top of the tree; it
  should become a root note (parent key removed).
- Hovering a collapsed row mid-drag should expand it after a short delay, without
  requiring the drag to pause.

## Acceptance criteria

- All three drop shapes checked, each landing the write the indicator promised.
- Hover-expand confirmed on a collapsed row.
