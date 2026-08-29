---
type: PBI
parent: "[[Milestones]]"
order: 30
status: Active
created: 2026-08-16
source: user request
files:
  - src/domain/roadmap.ts
  - src/view/render/barProgress.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Milestones in one row on the dated axis

**As** someone reading a dated plan, **I want** every milestone as a diamond in one row at
the top of the grid rather than a row apiece among the bars, **so that** the dates the whole
plan is measured against are read once, above the work, and the work is not pushed down the
pane by every date the plan commits to.

[[Milestones out of the resource rows]] made this row for the resources axis and stated the
argument there in full: a point in time has no duration to read along, no subtree to fold
and no second fact a lead column could carry, so a column of one-diamond rows spends a row
each saying what one row says. Every word of that is true of the plain dated axis as well —
it was only ever built for one of the two, and this is the same shape read on the axis a
milestone was invented for. The line down the grid ([[A milestone line across the plan]])
already carries the name in the header tier, so what a row was adding was a lead column
repeating it.

**Outcome** — Opening the roadmap on the dated axis puts every placed milestone as a diamond
in a single row ahead of the first bar, so the dates read across every bar beneath them, in
one line, and the work starts at the top of the grid.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap is drawn on the plain dated axis and at least one marker places |
| **Preconditions** | The dated axis is configured — either date property, [[Bars from two dates]]' own precondition; nothing here adds one |
| **Guarantee** | A marker draws in no bar row on this axis. It is placed by exactly the rules that placed it before — the same call, the same reduction to its target point, the same shelving reasons, the same diamond — so nothing about which date it draws at is this row's doing. It is counted as placed like any other bar, it still crosses the grid with its own full-height line, and it stays subject to every reader control that already narrows a result. |

**Main flow**

1. The dated axis mints one row that is not a bar row, drawn **first**, ahead of every bar.
   It is the same row the resources axis draws and is built by the same call
   (`markerLane`), so the two axes cannot disagree about its caption.
2. Every marker among the placed bars draws as a **diamond in that one row's own track** —
   one row for all of them, never a row apiece. Placement is unchanged, and so is
   everything derived from it: the line, the arrows, the shelf and the placed count all
   read the marker exactly as before.
3. The row draws **no disclosure**, since it produces no bar rows to fold.
4. Each diamond carries its own title, exact date and workflow state as visually hidden
   CONTENT and in its tooltip, and a click on it opens its note. The full-height line still
   carries the title in the coarse header tier, which is what makes a row of bare diamonds
   legible.
5. The row is minted by its first placed marker and is absent otherwise, exactly as it is on
   the resources axis. A marker that shelves mints no row.
6. A diamond is still a drag source and still a dependency source: the body hold slides it,
   writing the target alone, and the connector is where an arrow to a date begins.
7. Every gesture a bar ROW answered, the mark answers: a click opens the note, a middle
   click opens it in a tab, and a right click opens its menu — which on this grid is the
   only pointer route to Schedule, Unschedule and Set state for a date.

**Extensions**

- **1a — the split happens before the fold walk, not after.** `timelineRows` decides a
  chevron from the bars it is HANDED, so a marker left in that list goes on standing between
  a work bar and its drawn ancestor. It is filtered out first, which is the same argument
  that makes a fold safe per band on the resources axis.
- **2a — a marker hangs under a bar the reader folds.** It stays on screen, line and all.
  This **reverses** [[Collapsing a bar's subtree]]'s old answer, and the reversal is the
  point rather than a side effect: the row exists so that no fold anywhere can remove a date
  the whole plan is measured against, which is [[Milestones out of the resource rows]] step
  4 read on this axis. What a fold still takes is ordinary work under the same parent.
- **2b — a marker is dropped, or something else is dropped in the milestones' row.** The
  dated axis positions by one grid-wide overlay rather than by rows, so a release anywhere on
  the day area means the day it named and nothing else. That is unchanged and needed no rule:
  there is no row on this axis for a drop to write.
- **3a — the keyboard walk.** A marker is no longer one of this axis's stops, and that is the
  cost this note pays. It is the same cost [[Milestones out of the resource rows]] 3c states —
  a diamond in a shared header is not an `option` and has no element the roving selection
  could point `aria-activedescendant` at — and this change **spends the fallback that note
  named**: the plain dated axis WAS "the projection to use when a milestone has to be reached
  without a pointer", and no projection is now. What is left is the tree and the board, where
  a milestone is an ordinary card with an ordinary row menu, and the row menu's Schedule and
  Unschedule reach its date from there. Closing it properly is
  [[Keyboard and menu on the roadmap]]'s work, whose main flow already has arrows moving
  across the roadmap's regions; a stop for this row belongs in that increment rather than
  beside it.
- **3b — a marker with descendants.** Its rollup is announced by nobody. It was folded into
  the row's explicit `aria-label` until this change, and that label was a property of having a
  row; `progressNote` stopped being exported with it rather than being kept as an export with
  no consumer. A **loss**, stated rather than smoothed over, and the same one the resources
  axis already carried. The case is reachable but odd — `childTypeChoices` offers a marker no
  children and refuses no deliberate move.
- **3c — a marker's workflow state.** Said in words on the mark, and this axis GAINED that
  rather than losing it: `stateNote` moved into `render/lanes.ts` and both a bar row and a
  diamond now read it, so a done marker is no longer a green diamond and nothing else on
  either axis. That is the one thing the resources axis's own row shipped without.
- **3d — a match found BELOW a milestone, or the milestone itself matching.** The diamond IS
  registered as drawn (`ctx.placed`, with `face: 'none'`), and that half is not optional:
  `nameMatches` reads its "already on screen" set from that register, so a marker drawn and
  not registered reads as one that did not draw — the bar ABOVE it then counted a match the
  reader is looking at in the row overhead, and offered an `Open match` entry in its menu for
  the same note. Found in review (2026-08-16), on both grid axes at once, since the row is
  one row. What the diamond cannot do is carry an affordance of its OWN: it is 12px of
  rotated mark with no lead, no count slot and no room for a chip, so a match beneath a
  milestone is named nowhere on the grid. A loss, stated rather than drawn badly — and the
  distinction it rests on is that registering is about what is ON SCREEN while `face` is
  about what can be written there.
- **3e — a gesture the mark inherited and did not get.** A mark that takes over a row's job
  takes ALL of it. This shipped with the primary click alone: a middle click fires no
  `click` at all, so opening in a tab did nothing, and a right click reached no handler, so
  the menu — the only pointer route to Schedule, Unschedule and Set state here — was gone
  from the grid. Both found in review (2026-08-16), on both axes, and both fixed at the
  mark. What the diamond deliberately does NOT inherit is `selectItem`: it is no `option`
  and has no element `aria-activedescendant` could point at, so selecting one would leave
  the roving walk on a path with no stop. `wireCardActivation` is therefore two halves —
  `wireOpenGestures` and `wireItemMenu` — and a card still takes both through it.
- **3f — where those words are put.** In the mark's own `.pbl-sr-only` CONTENT, never in an
  `aria-label`. `.pbl-bar` is a plain div, so its implicit role is `generic`, and ARIA
  PROHIBITS an accessible name on one — a label there may be announced by nobody, which for
  a mark that no longer has a row would mean the words were LOST when the row went rather
  than moved. Text is in the accessibility tree whatever the element's role is. The rule is
  not new: `stateNote`'s own comment states it for this exact element, and this row broke it
  on the resources axis in 2026-08-15 and here on 2026-08-16 until review caught it. What it
  does not buy is an ACTIONABLE milestone — the diamond is still no stop, which is 3a — so
  the honest claim is that the words are readable, not that the mark is reachable.
- **4a — the bucket axis.** Nothing here applies: a marker is an ordinary card there.
- **5a — a marker the Base excluded.** Unchanged. `deriveBars` routes a context row to
  `RoadmapModel.context` before any span is computed, so it never reaches this row — the
  same rule [[Milestones out of the resource rows]] 4a keeps one axis over.

## Acceptance criteria

- On the dated axis no marker draws a bar row of its own, and every placed marker is a
  diamond in one row drawn ahead of the first bar.
- That row is minted by the first marker that places, is absent when none does, and draws no
  disclosure.
- No fold anywhere on the axis can take a marker off the screen, while a fold still hides
  ordinary work under the same parent.
- A marker's placement is unchanged: the same reduction to its target point, the same
  shelving reasons, the same diamond and the same outside-the-window marking.
- Each diamond names itself in content a screen reader reads — its title, its exact date and
  its state, never through a label a `generic` role forbids — with a click that opens its
  note; its full-height line still crosses the grid and still carries the title.
- The colour a marker actually draws is the colour the legend keys, the wholly-outside case
  and the done case included.
- A milestone's own state is legible without colour on BOTH grid axes.

## Where it lives

`markerLane` in `src/domain/roadmap.ts` is the row itself — a function rather than the object
literal `deriveLanes` used to spell inline, because both grid axes build one now and a caption
spelt twice is a caption free to drift from the fold key and the roster refusals that read it.

`datedEntries` in `src/view/render/lanes.ts` is this axis's entry list, replacing `barEntries`:
it partitions the bars, emits the one `lane` entry, and hands `timelineRows` the WORK alone.
Everything downstream was already written for a markers row by the resources axis —
`drawnSpans` widens the window for it, `renderTimeline`'s `bars` list picks its bars up for
the lines and the arrows, `drawnCards` leaves it off the keyboard walk, `renderLaneHead`
withholds the chevron and the absence control, and `drawMarkerDiamonds` draws the marks — so
what this cost the view was one entry list and no second idea of what a marker is.

`drawEntries` in `src/view/render/timeline.ts` is where the two axes' one difference is kept:
a lane header is reported to `laneElement` as its OWN row, while the milestones' row opens no
BAND for the rows after it. Both halves matter and they failed in opposite directions during
this change — reported through `laneElement?.(drawBand(…))`, an optional call whose callee is
null on this axis skipped its ARGUMENTS too and the row silently never drew; and left opening
a band, every work row on this axis was described as "Assigned to Milestones" and washed with
absences it cannot have.

`PlacedMount.face` gained `'none'` in `src/view/host.ts` for 3d — a surface
that drew an item and can write nothing on it — and `renderCardMatches` returns on it before
the match walk. Registering is about what is ON SCREEN; `face` is about what can be written
there, and conflating the two is what made the parent over-report.

`renderRowFacts` in the same file **lost its marker branch**, which is 3b as code: it wrote a
marker's explicit label, and `renderBarRow` can no longer be handed one. `stateNote` moved
from there into `render/lanes.ts` so the diamond can read it too (3c) — `edgeClasses`' own
reason, since the grid imports that module and never the other way.

`wireOpenGestures` and `wireItemMenu` in `src/view/render/board.ts` are 3e: the two halves
of `wireCardActivation` a mark can take without a selection. The open pair is wired together
because a browser splits one affordance in two — a middle click never fires `click` — so a
surface that wires the primary one alone loses the tab silently.

3d's registration was driven by the quick filter's own suite, deleted with the filter on
2026-08-17 ([[Remove the quick filter, now that Bases has its own search]]) — the register
entry still matters, since `cardedPaths` reads it to decide which children a card menu may
offer, but nothing now drives it through a match. `test/view/milestonesRow.test.ts` and `test/view/roadmapMarkers.test.ts` drive 3f from both
directions (the words present as content, and no `aria-label` on the mark at all); and
`test/view/roadmapMarkers.test.ts` drives 3e — all three gestures on the mark, and the
connector inside it refused by `fromRowControl` on both halves of the pair.

Driven in `test/view/roadmapMarkers.test.ts` (one row of diamonds ahead of the bars, the
minting rule, no disclosure, the two outside-window cases and the mark's own name),
`test/view/timelineCollapse.test.ts` (2a, both directions in one fixture),
`test/view/timelineFurniture.test.ts` (the stripe parity, and 3c's state in words),
`test/view/legend.test.ts` (the colour report now read off the marks as well as the rows) and
`test/view/barProgress.test.ts` and `test/view/dependencyArrows.test.ts`, whose marker cases
moved from the row to the mark. Every one of them was watched failing with the split disabled.
`markFor` and `markersLane` in `test/helpers/roadmap.ts` are how a diamond is reached, and
`gripOf` now answers for a marker's body hold as well as a bar's.

**Not checked here**: how a row of diamonds reads in a live vault — the spacing of marks that
fall close together most of all, which jsdom cannot see, and which the sub-lane stack narrows
without closing. That is the standing limit on every appearance claim; see
`docs/tests/suites/Smoke test the roadmap.md`.
