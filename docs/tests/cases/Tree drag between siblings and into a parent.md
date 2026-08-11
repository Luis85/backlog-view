---
type: Test case
order: 30
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Tree drag between siblings and into a parent

A verification to run.

## Why this exists

`view/interactions/dragDrop.ts` computes drop zones and indicators; jsdom drives the
events but renders no indicator, no hover-expand animation and no cursor.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- **Between siblings** — drag a row and drop it between two others under the same
  parent; the indicator line should land exactly between them, and the drop should
  reorder without changing `parent`.
- **Into a parent** — drag a row onto another row's body; the target should highlight
  as a container, and the drop should set `parent` to it, placed after its existing
  children.
- **Onto the tree background** — drag a nested row over the empty area below the last
  row. Nothing should happen: the cursor should say the drop is refused rather than
  offering a move, and releasing there should write nothing. The gesture was deleted on
  2026-08-11 — making a row top-level is Outdent, from the row menu or Alt+Left — so what
  is being judged is that the background is genuinely inert and not merely silent.
- Hovering a collapsed row mid-drag should expand it after a short delay, without
  requiring the drag to pause.

## Acceptance criteria

- Both drop shapes checked, each landing the write the indicator promised, and the
  background confirmed inert.
- Hover-expand confirmed on a collapsed row.
