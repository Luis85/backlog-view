---
type: Issue
order: 110
parent: "[[Product Backlog]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-04
files:
  - src/domain/timeline.ts
  - src/domain/bars.ts
  - src/view/interactions/timelineDrag.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbar.ts
  - src/view/render/projections.ts
  - src/storage/collapseStore.ts
  - src/view/collapseState.ts
  - styles/roadmap.css
  - styles/timeline.css
---

# Smoke test the writable timeline

## Why this exists

The jsdom harness drives real DOM events against the real view, so it covers structure
and behaviour well. It computes no layout, so it cannot see a nested scroller, a sticky
containing block, a pointer engaging auto-scroll toward a pane edge, or whether a
one-pixel line at 0.55 opacity actually reads as a mark. The writable-timeline increment
restructured the dated axis onto two scroll boxes and put five gestures behind a
pointer, which is a larger surface only a live vault can answer for than this register
has carried at once on the roadmap.

## Getting a vault to look in

`npm run test-build` bundles the plugin into `.obsidian/plugins/product-backlog-view/`
in this repository and adds it to the enabled list, so the repository root opens as a
vault with the plugin installed. `docs/Product Backlog.base` is a real backlog with a
real milestone on it — open it and switch to the roadmap's timeline axis: the plugin
displaying its own register is the smoke test.

## How to check

**Exactly one thing scrolls.** Pan the timeline sideways and scroll it down: the pane
itself must never move, the header must stay pinned to the top of what does scroll, and
the sticky lead column must stay pinned to its left. jsdom can assert which element
carries which class and never that the pane actually stopped overflowing or that the
month labels held their place while the rows moved under them, so this is the two-axis
restructure's own claim and the part most worth looking at first.

**The preview reads as a contract.** Drag a shelf card over the grid, and drag a bar's
body and each of its end grips: the ghost bar and the dates it means should be legible
while the pointer is still moving, not only after release.

**An end grip is reachable at four pixels per day.** At month zoom (the default), grab
the end of a short bar and confirm the grip is a comfortable target rather than a sliver.
Then check whether all three densities — week at 16px, month at 4px, quarter at 2px —
are three *usable* scales rather than three numbers: 16, 4 and 2 are reasoned, not
measured, and the width of a real pane is the only thing that can say whether quarter
zoom shows enough plan to be worth having.

**Dragging toward the pane edge pans the grid.** Pick up a bar and hold the pointer near
the right edge of the timeline: the grid should auto-scroll, and at a usable rate.
Registering the scroller is checkable in tests; that it engages toward an edge at all is
a pointer-position behaviour of the drag library, which jsdom does not run.

**Today's line and a milestone dated today read as two marks at quarter zoom.** Create
or find a milestone dated today, zoom to quarter, and confirm two one-pixel lines are
visible rather than one. If a one-pixel line cannot be seen at all, the answer is a
denser `quarter`, not a thinner mark.

**The narrow-pane shelf compaction, and clipping under the header.** Narrow the pane (or
open the base embedded in a note) until the shelf toggle appears: press it and confirm
the shelf opens and closes, and that nothing clips under the sticky header in the
embedded case.

**The today line and jump-to-today from a scrolled position.** Pan away from today,
then press jump-to-today: confirm it returns in one action and the line is where it
lands.

## Acceptance criteria

- Checked in both light and dark themes.
- Anything adjusted is adjusted in a `styles/` partial only — none of this should
  require a behaviour change.

## Outcome

Not yet run.
