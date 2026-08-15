---
type: PBI
parent: "[[The resource timeline]]"
order: 60
status: Active
created: 2026-08-15
source: user request
files:
  - src/domain/roadmap.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
  - styles/timeline.css
---

# Milestones out of the resource rows

**As** someone reading a plan by person, **I want** every milestone as a diamond in one row
at the top of the roster rather than inside whoever happens to be named on it, **so that**
the dates the whole plan is measured against are read once, above the work, and never
disappear with a band somebody folded.

A milestone is a fact about the PLAN and not about a person's week. The axis until now
asked it the same question it asks work — whose row is this — and got two answers, both
wrong: a milestone naming an assignee sat inside that resource's band, where folding the
band took it off screen and the reader lost a date nothing else on the axis states; and a
milestone naming nobody shelved, because "a row is who, not when" ([[Showing a resources
axis on the roadmap]]) has no row to offer an item with no assignee. So the one axis that
draws a calendar per person was also the one where a release date could be invisible.

And a row apiece was the wrong shape for the answer. A point in time has no duration to
read along, no subtree to fold and no second fact a lead column could carry, so a column of
one-diamond rows spent a row each saying what one row says — pushing the work this axis
exists to show further down the pane the more dates the plan commits to.

**Outcome** — Opening the roadmap on the resources axis puts every placed milestone as a
diamond in a single row above the first resource, whatever any of them says about an
assignee — so the dates are read across every band beneath them, in one line, and nothing
can fold them away.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap is drawn on the resources axis and at least one marker places |
| **Preconditions** | The resources axis is configured — the assignee property and a date property, [[The resource timeline]]'s own precondition; nothing here adds one |
| **Guarantee** | A marker is in no resource's row on this axis, whatever its assignee property says, and its assignee is never read to position it nor written by any gesture on the grid. It is placed by exactly the rules the dated axis places it by — the same call, the same target-point reduction, the same shelving reasons — so nothing about which date it draws at is this axis's doing. It is counted as placed like any other bar, it crosses the same full-height line, and it stays subject to every reader control that already narrows a row. |

**Main flow**

1. The resources axis mints one row that is not a resource, drawn **first**, ahead of the
   declared roster. It is the only row on the axis whose name is not an assignee value.
2. Every marker among the results draws as a **diamond in that one row's own track** — one
   row for all of them, never a row apiece. Placement itself is unchanged: the same call
   the dated axis makes, so a marker's date, its shelving reasons and its diamond are
   [[Milestones as their own type]]'s rules read from one row over.
3. Markers are placed there by the assignee they carry, by the assignee they do not carry,
   and by nothing about either. A marker with no assignee **draws** rather than shelving:
   the rule it used to fail — an unassigned result has no row and therefore shelves — is a
   statement about somebody's work, and there is now a row that is nobody's.
4. The row draws **no disclosure**. There is nothing under it to fold, since it produces no
   bar rows; and a fold bit able to take these dates off screen is the very thing the row
   exists to prevent.
5. Each diamond carries its own title and exact date in its tooltip and accessible name,
   and a click on it opens its note. The full-height line each marker already draws
   ([[A milestone line across the plan]]) still carries the title in the header tier above
   the grid, which is what makes a row of bare diamonds legible: the mark says where, the
   line says what.
6. The row is minted by its first placed marker and is absent otherwise, exactly as an
   undeclared assignee's row is: a header standing for nothing on every base is a row that
   says nothing. A marker that shelves mints no row, since nothing landed in it.

**Extensions**

- **1a — a resource is genuinely called `Milestones`.** Two rows are drawn with that name.
  Accepted rather than guarded: every guard against it costs a rule about names the roster
  is otherwise free to choose, and the milestones' row is not in the roster's own name
  index, so no work is ever misfiled into it. It carries no fold bit of its own either
  (step 4), so the two cannot share one.
- **2a — a diamond is dragged along the grid.** It slides, writing the **target alone**,
  exactly as it does on the plain dated axis — the body hold is the diamond itself, and a
  point has no end to resize. Nothing about the row it is released in is written.
- **2b — a milestone is dragged into a resource's band, or something else is dragged into
  the milestones' row.** Both write the DAY and never an assignee, and the test is asked of
  both ends of the release. The row's caption is not a resource, so writing it into an
  assignee property would invent one out of a header; and a marker released in somebody's
  band still draws in the milestones' row afterwards, so a row write there would be a
  change the reader is never shown, spent from the one undo slot. `Set assignee` still
  writes one — a note may record who owns a date — because what is refused is a
  **positional** gesture writing a value this axis does not read.
- **2c — a work item is dropped on the milestones' row.** It takes the date and is not
  retyped: a move never writes a type, at any level, and the row a bar is released in has
  never been a claim about what that bar IS. On the next render it is back in its own
  resource's band, which is where its assignee puts it.
- **3a — the row's absence control.** Absent. The row stands for nobody, so there is
  nobody to be away, and [[Resource absences]]' Add button is withheld rather than opening
  a form whose resource would be a caption.
- **3b — a milestone dated on its own assignee's away day.** Nothing is said about it, and
  this is a **loss** rather than an omission — it was reported until 2026-08-15, as the
  `· away` token and the sentence beside it. What that mark means is that a bar and a
  stretch collide IN ONE ROW ([[Resource absences]]); with the marker drawn out of the band
  there is no stretch beside it, and computing one from a row the reader is not looking at
  would be a mark whose evidence is off screen. The assignee is still on the note and the
  absence is still in its own band; what is gone is the plugin drawing the line between
  them.
- **3c — the keyboard walk.** A marker is not one of this axis's card stops, and that is
  the second stated cost. A diamond in a shared header is not an `option` and has no
  element the roving selection could point `aria-activedescendant` at, so listing one would
  put the walk on a stop that does not exist. Its name and date are still announced on the
  mark itself, and the plain dated axis still draws every marker as its own selectable row
  — which is the projection to use when a milestone has to be reached without a pointer.
- **4a — a marker the Base excluded.** It joins the axis's undifferentiated context beside
  the shelf, never a band, and never the milestones' row either: a context row is placement
  and this row places by a bar. "A milestone is in no resource's row" is a rule about the
  row rather than about the bar, so the one path that positions nothing must keep it too.
- **5a — the bucket axis or the plain dated axis is the active one.** Nothing here applies.
  This row exists only where rows do, and on the dated axis a marker is already one line
  among the bars.
- **6a — a milestone is marked done.** The diamond draws green, like every other done bar.
  The class is on the **mark** and not on the row, which is the one place this row departs
  from the grid's own rule: the row is shared by every marker, and one of them being
  finished says nothing about the next.

## Acceptance criteria

- On the resources axis, no marker is ever in a resource's row — not by its assignee, not
  by a drop, and not as a context row — and its assignee value is read for nothing that
  places it and written by no gesture on the grid.
- Every placed marker is a diamond in one row drawn ahead of the first declared resource,
  minted by the first marker that places and absent when none does. No marker draws a row
  of its own on this axis.
- That row draws no disclosure, and no fold anywhere on the axis can remove a marker from
  the screen.
- A marker with no assignee draws instead of shelving; a marker with no readable date still
  shelves, with the reason [[Milestones as their own type]] already gives it.
- A marker's placement is the dated axis's, unchanged: the same reduction to its target
  point, the same span, the same shelving reasons, and the same diamond — and a slide on
  the grid writes the target alone.
- Each diamond names itself: its title and its exact date on the mark, with a click that
  opens its note. Its full-height line still crosses the grid and still carries the title
  above it.
- A marker is counted as placed and reported among the axis's drawn bars in row order, so
  the axis's own "placed plus shelved equals the visible result rows" still holds, and a
  dependency arrow drawn to a milestone still anchors on the row it is drawn in.
- The row draws no absence control and adds nothing to the declared roster.
- No mark on the axis claims a collision whose evidence is not in the same row.

## Where it lives

`MILESTONE_LANE` and `ResourceLane.markers` in `src/domain/roadmap.ts`. A boolean on the
row rather than a name comparison at each reader, because four of them ask a different
question of it — no absence control, no disclosure, no roster write, and a drop that writes
no assignee — and a name compared in four places is how a row a user named comes to be
treated as this one. `deriveLanes` routes a marker to `placeBar` with that row and every
other result to `placeAssigned`, which now calls the same `placeBar`: the row is a thunk
there, because a row is minted by the bar that lands in it and never by one that shelves —
the rule the roster already kept for an undeclared assignee, reused rather than restated.
`placeContextLane` keeps 4a, one condition ahead of the assignee lookup.

`src/view/render/lanes.ts` owns the row on screen. `laneEntries` emits the header and no
rows for it, which is what makes step 4 structural rather than a withheld control:
`renderLaneHead` has no chevron to draw because there is nothing under it. `drawMarkerDiamonds`
draws each mark into the track that header hands back — `renderLaneHead` returns
`{ head, track }` now, so nothing has to find the element again and no unreachable null
branch is carried for it — and registers every marker path against that one shared track,
which is what keeps a dependency arrow anchored (`renderDependencyArrows` reads the track's
parent for the Y and takes the X from `dependencyAnchor`, so several markers sharing a track
is the right answer rather than a compromise: they genuinely share the row). `drawnSpans`
widens the window from the lane for the marker row exactly as it does for a folded band —
see [[Folding a resource's band]], which states that gate.

**Four functions moved into that file with it**, and the move is the point rather than
housekeeping: `barClasses` and `spanText` (a mark's classes and the sentence about its
span), and `absenceCost` and `drawBandCollision` (what a band's own row owes a stretch it
crosses). `edgeClasses` was already there, with a comment saying it sat "here rather than in
`./timeline.ts` beside `barClasses`" — this is that sentence resolved the other way.
`render/timeline.ts` was at its 400-line budget, and what left it is what belongs to a
BAND; what stayed is the grid. `MarkerMounts` names the three fields of `BarRowMounts` a
diamond uses, structurally rather than by import, so the dependency still runs one way.
`drawBand` in `render/timeline.ts` is the header's own branch lifted out of `drawEntries`,
which is at the cognitive budget `npm run analyze` enforces just telling the three entry
kinds apart.

`render/timeline.ts` keeps the two lists apart, which is the whole of 3c and of step 5:
`bars` gains the marker row's bars (the lines and the arrows are computed from it, and both
are exactly what a marker contributes to a grid), while `cards` is read from the `'row'`
entries alone.

`wireLaneDrop` in `src/view/render/roadmap.ts` sends a marker's release — and any release
in the markers row — to `submitGesture`, the call an end grip already takes, so 2a and 2b
cost no second idea of what a drop means.

`.pbl-bar.pbl-done` in `styles/timeline.css` is 6a, placed AFTER `.pbl-bar.pbl-bar-milestone`
because it matches two classes against that rule's two and needs source order to win — which
is why it is not written beside the row-level override it copies.

`absenceCost` **lost** its marker branch, which is 3b as code: `drawBandCollision` runs only
for a row in a band, and no band holds a marker any more, so the branch was unreachable and
a branch nothing can reach is a claim nothing keeps.

Driven in `test/domain/resources.test.ts` (the row's position, the two assignee cases, the
context rule, the minting rule and the placed count), `test/view/resourceLanes.test.ts` (one
row of diamonds and no rows of their own, no disclosure where a band has one, each diamond
named, no absence control), `test/view/resourceScheduling.test.ts` (the slide, both
directions of 2b, the click, and done on the mark) and `test/view/absenceCollision.test.ts`,
where the away-day case now asserts 3b from the rule rather than the old mark. The domain
cases and the two structural view cases were watched failing with the change disabled.

**Not checked here**: how the row of diamonds reads in a live vault — the spacing of marks
that fall close together most of all, which jsdom cannot see. That is the standing limit on
every appearance claim; see `docs/tests/suites/Smoke test the roadmap.md`.
