---
type: Bug
parent: "[[Showing a resources axis on the roadmap]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-14
closed: 2026-08-14
source: User report with a screenshot — "the things underneath the resources columns are shining through"
files:
  - styles/lanes.css
  - test/view/timelineBoxing.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The grid showed through the resource rows

## What happened

On a scrolled resources axis, the today line and the day-column shading were visible
**through the sticky lead column** — the strip that holds the names. Worst on the absence
rows, where the red today line ran straight through "Away", "gjk" and "dooo"; and a red
tick showed at the foot of every band header, in the middle of the resource's own name
column.

The lead column is the one part of this grid that has to stay opaque at every scroll
position. Everything else scrolls; it does not, so anything drawn in content coordinates
slides underneath it and must not be seen doing so.

## Why

Two causes, one symptom.

**A row carrying `opacity`.** `.pbl-absence-row` had `opacity: 0.8` and `.pbl-lane-context`
`0.65`, both meaning "mute this row" — and `opacity` below 1 does two things to a row here,
neither of them muting:

- it makes every descendant translucent, the row's own `.pbl-timeline-lead` included, so
  the `--background-primary` that hides the grid stops hiding it; and
- it creates a **stacking context**, which takes that lead's `z-index: 2` out of the grid's
  layer order and drops the whole row below the `z-index: 1` today line.

So the two rows drawn dimmed were exactly the two the grid showed through, and both halves
of the mechanism point the same way: a rule that dims a row is one declaration away from
making it a window.

**A border outside the box its children fill.** `.pbl-lane-head` drew the band separator as
its own `border-bottom`. A border sits outside the content box, and `align-items: stretch`
stretches the lead to that box — so the separator's 1px was the one strip of the lead column
the lead itself did not cover, and the today line painted through it on every band.

## The fix

Both rules moved to the element that can hold them. The muting is applied to a row's
CONTENT (`.pbl-absence-row .pbl-timeline-lead > *`, and the mark), so the lead keeps its own
background and its own place in the layer order. The separator is drawn by the header's
CHILDREN, so the lead paints its own segment of it and can sit over the marks there.

The check refuses the SHAPE rather than the symptom: `test/view/timelineBoxing.test.ts`
reads `styles/lanes.css` and fails on any rule that dims a selector naming a row class and
nothing beneath it — and asserts the content rule is still there, so a fix that deleted the
muting instead of moving it fails too. Its reach is a text check over the stylesheet, like
the `box-sizing` pair beside it: it cannot tell you what the pane looks like, and it can
refuse the declaration that made it look wrong. Whether the lead now reads as solid at every
scroll position is a live-vault check, since jsdom paints nothing.
