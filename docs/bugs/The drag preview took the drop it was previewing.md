---
type: Bug
parent: "[[Assigning items to a resource]]"
order: 20
status: Done
area: drag and drop
priority: P1
created: 2026-08-15
closed: 2026-08-15
source: Reported from a vault on the resource timeline — "dragging and dropping a whole bar still does not register every time, the start and end handlers look good"
files:
  - styles/timeline.css
  - test/view/timelineBoxing.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The drag preview took the drop it was previewing

## What happens

On the resources axis, dragging a bar by its BODY into another person's row does not always
land there. The ghost follows the pointer and states the dates, the band under the pointer
does not highlight, and the release leaves the bar where it was. The **end grips are
unaffected**, which is what identified it: they resize correctly every time.

Not the same defect as [[A release that crossed a render wrote nothing]], which was fixed
first and left this one standing — that one lost the release entirely, this one delivers it
to the wrong row.

## Why

`.pbl-drop-ghost` and `.pbl-drop-ghost-dates` were the only absolutely positioned
decorations on this grid without `pointer-events: none`. Both are drawn into the **dragged
bar's own row track** (`previewMount` in `src/view/interactions/timelineDrag.ts`) while the
drop target is a different element — each band element on the resources axis, the grid-wide
overlay on the dated one. So the preview sits between the pointer and the thing the release
has to reach, and `getActualDropTargets` walks up from whatever the pointer is over: from
the ghost that is the **source** row, every time.

Nothing then fails. `canDrop` passes, `onDrop` fires, and `wireLaneDrop` reads its own
`band.lane` — which is the row the bar started in. The assignee half of
`computeResourceMoveWrites` plans nothing because the name did not change, and the bar
shifts by the days the gesture asked for and stays with the same person. The drop target
set never changes either, so the destination band is never entered and never highlights.

**The grips are indifferent to all of it, structurally.** `wireLaneDrop` routes
`hold === 'start' | 'end'` straight to `submitGesture` — the dated axis's own gesture, which
states a date and nothing about who is doing the work — so which band a grip release
resolved to is a question its path never asks. That is why one half of the feature looked
correct while the other did not, and it is the discriminator that found the cause.

The geometry is why it bites rather than nearly missing. The ghost is the dragged bar
REDRAWN at the delta, so a body slide holds the pointer inside it at exactly the offset the
bar was grabbed at. And `.pbl-drop-ghost-dates` sits at `calc(50% + 14px)` of its own row
with a `nowrap` background box, so it hangs over the band directly beneath — the one a drag
down one row is aimed at.

This is the third instance of one rule on this grid, after
[[An absence stretch is a dead spot in its own band]] and the today line
([[The today line swallows a row's clicks]]). `styles/lanes.css` already states it for the
marks inside a band; what was missing was reading it onto the one element that MOVES under
the pointer, which is also the one no static reading of a band's contents would list.

## The fix

`pointer-events: none` on both, with the reason stated at the declarations. The preview is
decoration: nothing about it is focusable, clickable or hoverable, and the dates it carries
are also on the bar's own tooltip.

## The test

`test/view/timelineBoxing.test.ts`, "lets the pointer through %s, the one decoration that
MOVES under it" — a text check over the rule, the same instrument and the same stated reach
as the absence wash's own check beneath it. Watched failing with each declaration removed.

That instrument is what this suite has, and it is worth saying what it cannot do: jsdom
hit-tests nothing, so every drop test here stayed green throughout — the drag helpers
dispatch at the element the test names, and no preview can be in the way of that. Only a
browser can confirm the drop now reaches the band, and that is a live-vault item in
`docs/tests/suites/Smoke test the roadmap.md`.
