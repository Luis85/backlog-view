---
type: Bug
parent: "[[Folding a resource's band]]"
order: 10
status: Done
area: roadmap
priority: P2
created: 2026-08-14
closed: 2026-08-14
source: Building the resource band's load rail, 2026-08-14 — the fix for one hazard regressed a case it had not been tested against, found the same session
files:
  - src/view/render/lanes.ts
  - src/view/render/timeline.ts
  - test/view/resourceLanes.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The load rail drew nothing for a folded band's own far-off work

## What happened

Folding a resource's band draws a load rail — a thin strip per continuous run of days —
showing where the hidden work still lies (`renderLaneRail`). For a band whose only bar ran
far from today, the rail drew nothing at all: the one control the fold exists to leave
behind, missing exactly where a reader relied on it.

## Why

`timelineWindow` is computed once, over whatever a render actually draws. `laneEntries`
drops a collapsed lane's bar rows from the entries list entirely — the fold's whole
mechanism — and at the time the rail was built, the window was computed from that entries
list alone. A bar far outside the span every other row drew was clamped out of the window
before the rail's own `barGeometry` call ever saw it, and `geometry.outside` skipped the run
in silence.

## The fix

Two increments, and the second narrowed the first rather than confirming it.

**First, `drawnSpans` was widened to pull a lane's own bars in too** — mirroring the
absence-stretch treatment already there, since a stretch has the identical problem and was
already read from the lanes directly rather than from the entries list.

**That fix reached too far.** Reading every lane's bars unconditionally widened the window
for an OPEN band's row-collapsed subtree as well — a bar that draws nowhere at all, not a
row and not a rail, since the band itself is open and only one bar's own subtree is folded
within it. A reader who folded one bar away inside an otherwise-open band could still be
made to scroll past months of empty gridlines for a bar nothing on screen draws.

The narrowed fix reads a lane's bars from the entries list itself, gated on the LANE entry's
own `collapsed` flag: only a band that is actually shut — and therefore actually drawing a
rail — widens the window for its bars; an open band's row-collapsed subtree does not, because
`timelineRows`' own fold already keeps that bar off the entries list for a reason the window
must agree with. The invariant this leaves behind is stated in `renderTimeline`'s own comment
(`src/view/render/timeline.ts`): a folded band's bars are in the drawn spans "even though
none of its rows are in `entries`, because the rail draws them where the entries list draws
nothing," while "a row-collapsed SUBTREE inside an open band draws nothing either way and is
correctly absent from both lists."

The check is two tests rather than one, because the fix has two halves that could each break
the other silently: `test/view/resourceLanes.test.ts` widens the grid for a genuinely folded
band's far bar, and does NOT widen it for the identical far bar sitting under a
row-collapsed (not band-collapsed) parent inside an open band — the same fixture, expanded
and then folded one way or the other, against a baseline with no far bar at all.

## Lesson

A window-widening fix stated as "the same hazard, the same fix" for a new source is only
safe once the new source's OWN fold granularity is checked against the old one's. An absence
has one fold state (the band's); a bar has two (the band's and its own subtree's), and a fix
that widens for "the lane's bars" without asking which of the two hid a given bar will
over-widen for the one the fold was never asked to reveal.
