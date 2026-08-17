---
type: Bug
parent: "[[Showing a resources axis on the roadmap]]"
order: 20
status: Done
area: keyboard
priority: P2
created: 2026-08-15
closed: 2026-08-15
source: Review of the plan for the roadmap's match links, 2026-08-15 — found by reading, confirmed by driving a click and the arrow walk
files:
  - src/view/render/lanes.ts
  - src/view/render/timeline.ts
  - test/view/roadmapMatches.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A lane context row could not be reached

## What happened

On the resources axis, a note the Base excluded draws inside the band of the resource it
is assigned to (`renderLaneContextRow`). It looks like every other row of that band and it
claims to be one: `createCard` gives it `role="option"` and a place in `ctx.rows`. It was
neither.

- A click on it did nothing.
- The arrow walk never stopped on it, and Enter therefore never opened it.
- It had no context menu, so no keyboard route to anything at all.

[[Opening the work]] says Enter opens the note in every projection, **context rows
included**, and [[Keyboard and menu on the roadmap]] extension 2a says the same. A row
that draws an `option` a reader cannot select is worse than an absent one: assistive tech
counts it in the list and cannot land on it.

## Why

Two call sites, each missing one half, and each one plausible on its own.

`renderLaneContextRow` in `src/view/render/lanes.ts` drew the row and never called
`wireCardActivation` — the one function that gives a card its click, its middle click and
its context menu. Every other card surface calls it directly after `renderCardBody`; this
row draws no card body, so the line it would have followed was not there to be noticed.
The row menu was the keyboard path behind every `tabindex="-1"` control this row carried,
which at the time included the quick filter's match links; those went on 2026-08-17 and
the menu is still the path for everything else.

`renderTimeline` in `src/view/render/timeline.ts` published its result as
`cards: bars.map((bar) => bar.item)`. That was written when a grid held nothing but bars.
`RoadmapSnapshot.cards` is the pane's reading order, so a kind of row with no bar could
not join it — and `lane.context` is exactly that kind.

Found by reading the plan for the roadmap's match links rather than by a report. It is
pre-existing and it is what that increment would have made bite: match links were
`tabindex="-1"` and the row menu is their only keyboard route, so putting them on a row
nobody can select would have been the exact failure the feature exists to prevent.

## The fix

`renderLaneContextRow` calls `wireCardActivation`, beside the register it now fills.

The reading order is `drawnCards` in `src/view/render/lanes.ts`, beside `drawnSpans` and
for its reason: the entry vocabulary is that module's, so a `TimelineEntry` kind that puts
a note on screen is answered by editing one function next to the type, rather than by
remembering a second walk in the renderer. It flattens the entries in DRAW order, so a
kind lands where the reader's eye finds it instead of being appended at the end.

Two cases hold it, one per half: the arrow walk onto the row with Enter pressed, and a
click. Both name the note the row stands for, so a regression in either half fails. They
were written in `test/view/roadmapMatches.test.ts` — deleted with the quick filter on
2026-08-17, which is why the `files:` entry above names a path that is gone: that entry is
a record of the moment and this is not.

**Checked by** `test/view/resourceLanes.test.ts` — "stops where it DRAWS, above the next band’s bar, and Enter opens its note"

**Checked by** `test/view/resourceLanes.test.ts` — "opens its note on a click, like every other card on this grid"

## Lesson

`bars.map(...)` was a correct expression of "every row" for exactly as long as every row
had a bar. What made it survive the two kinds added after it is that it names a COLLECTION
rather than asking a question — nothing about `bars` says it is meant to be the reading
order, so nothing about adding an absence or a context row pointed at it. The named
function beside the entry type is where that question can be asked and answered once.
