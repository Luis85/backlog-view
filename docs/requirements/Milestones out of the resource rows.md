---
type: PBI
parent: "[[The resource timeline]]"
order: 60
status: Active
created: 2026-08-15
source: user request
files:
  - src/domain/roadmap.ts
  - src/view/interactions/linkDrag.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
  - styles/lanes.css
  - styles/timeline.css
  - styles/timelineFurniture.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
- **1b — that resource's band is folded.** The milestones' row stays open. A band's fold is
  keyed by the NAME and case-insensitively (`laneKey`), so the roster row's bit answered for
  this row as well: it took the collapsed class and drew the folded-work rails under
  diamonds that never left the screen, and with no disclosure of its own nothing could undo
  it. Found in review (2026-08-15). The refusal is asked once, where the entries are built,
  rather than at each surface that reads the bit — the head's class, its rails and the rows
  below it are three readers of one answer, and this row is the only lane that can never be
  folded whatever the store holds.
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
- **2d — a dependency drawn from a diamond.** The mark carries the connector every bar on
  the grid carries, and the drag from it is the dated axis's, unchanged. This is not one
  input of three here: `addDependencyItems` refuses both menu entries for a marker — a
  point in time waits for nothing — so the connector is the ONLY route by which anything
  comes to wait on a date, and the row that used to draw it was the bar row this axis no
  longer gives a marker. It shipped missing for that reason (2026-08-15, caught in review),
  which made the one axis that draws a calendar per person the one where a date could not
  be depended on. The handle is drawn by the same function that wires it now, so a mark
  that is a drag SOURCE cannot again be one without it. Two things are the diamond's rather
  than a row's, both because the row is shared and neither is a fact about the next marker:
  what wears `pbl-link-source` while a drag is held, and what wears `pbl-link-illegal` while
  one is refused — unmarked, every date on the plan read as a legal target and the drop was
  refused after release, which [[Draw a dependency between bars]] 2a says a held gesture
  must not do. The mark becoming a control's parent is what makes the click on it ask
  `fromRowControl`, the guard every other row on the grid already has.
- **2e — two markers on the same day.** They stack, one per sub-lane, and the row grows by
  the pitch a packed absence grows a band by ([[Resource absences]]) — the same two custom
  properties, since the milestones' row is a header track like any other. One row for all
  of them is what makes this a case at all: `barGeometry` gives both the same position and a
  diamond is 12px of opaque mark, so the later one covered the earlier outright and took its
  tooltip, its click and its drag with it. A row apiece could not produce it, so it arrived
  with the shared row (2026-08-15, caught in review). Counted by drawn POSITION rather than
  by date, so two dates that resolve to one pixel column stack too. What it does **not**
  answer is marks a day or two apart at a coarse zoom: those overlap partially and stay the
  "spacing of marks that fall close together" this note already owes a live vault an opinion
  on. **A dependency arrow anchors on the DIAMOND once they can stack**, not on the row: the
  arrow layer reads a Y off the element the item occupies, and the shared track's is the
  header's centre — between two stacked marks and on neither, with two edges to two markers
  on one day landing exactly on top of each other. Found in review the pass after 2e landed,
  which is the shape of it: the stack is what made "they genuinely share the row" stop being
  true of everything.
- **2f — the row's own name offered as somebody to assign work to.** Never, by any input.
  The caption is not a resource, so a value written from it names nobody — and
  `deriveLanes` builds its roster index from the resources alone, so the write then mints a
  SECOND row of that name beside the synthetic one. The drop already refused it (2b); the
  Alt+arrow ladder and Set assignee both offered it until 2026-08-15, which is "one move,
  three inputs" failing by omission rather than by disagreement — no input wrote a
  different thing, two just offered a target the third would not take. Both read one list
  now, and it is asked of the row's `markers` flag rather than of its name: a resource
  genuinely called Milestones (1a) is a resource, and comparing against the constant would
  take a legitimate roster entry off the ladder. This is not 2b read wider — a note may
  still record who owns a date, and Set assignee still writes one; what is refused is the
  synthetic row's caption becoming a value.
- **3a — the row's absence control.** Absent. The row stands for nobody, so there is
  nobody to be away, and [[Resource absences]]' Add button is withheld rather than opening
  a form whose resource would be a caption.
- **3d — a milestone's own workflow state.** Said in words on the mark since 2026-08-16,
  which this row shipped WITHOUT: `pbl-done` repaints the diamond green and nothing said so,
  which is state in colour alone. `stateNote` is read by a bar row and a diamond alike now —
  see [[Milestones in one row on the dated axis]] 3c, which is where the fix came from.
- **3b — a milestone dated on its own assignee's away day.** Nothing is said about it, and
  this is a **loss** rather than an omission — it was reported until 2026-08-15, as the
  `· away` token and the sentence beside it. What that mark means is that a bar and a
  stretch collide IN ONE ROW ([[Resource absences]]); with the marker drawn out of the band
  there is no stretch beside it, and computing one from a row the reader is not looking at
  would be a mark whose evidence is off screen. The assignee is still on the note and the
  absence is still in its own band; what is gone is the plugin drawing the line between
  them.
- **3c — the keyboard walk.** A marker is not one of this axis's card stops, and that is
  the second stated cost. It is the reason 2d's connector is not merely a convenience:
  a marker's menu refuses both dependency entries by design, so nothing else on this axis
  can say that one item waits for a date. A diamond in a shared header is not an `option` and has no
  element the roving selection could point `aria-activedescendant` at, so listing one would
  put the walk on a stop that does not exist. Its name and date are still announced on the
  mark itself, and a POINTER reaches the mark's own menu (2026-08-16) — the whole of what
  is lost is the KEYBOARD route, since a menu on the grid is opened from a stop and there is
  none. That narrowing does not reopen 2d: `addDependencyItems` refuses both entries for a
  marker whatever surface asks, so the connector is still the only route by which anything
  comes to wait on a date. This paragraph used to end with a fallback — "the plain dated axis still
  draws every marker as its own selectable row, which is the projection to use when a
  milestone has to be reached without a pointer" — and [[Milestones in one row on the dated
  axis]] SPENT it on 2026-08-16 by taking this row to that axis too. What is left is the
  tree and the board, where a milestone is an ordinary card with an ordinary row menu; the
  gap on the grid is [[Keyboard and menu on the roadmap]]'s to close, on both axes at once.
- **4a — a marker the Base excluded.** It joins the axis's undifferentiated context beside
  the shelf, never a band, and never the milestones' row either: a context row is placement
  and this row places by a bar. "A milestone is in no resource's row" is a rule about the
  row rather than about the bar, so the one path that positions nothing must keep it too.
- **5a — the bucket axis is the active one.** Nothing here applies: a marker is an ordinary
  card there. The plain DATED axis was named in this extension until 2026-08-16 for the same
  reason — a marker was one line among its bars — and [[Milestones in one row on the dated
  axis]] moved it to this row as well, from `markerLane` rather than from a second literal.
  So what is stated here is now true of that axis too, with the two differences that note
  owns: the split happens where its entry list is built, and a release on its grid names a
  day and never a row.
- **6a — a milestone is marked done.** The diamond draws green, like every other done bar.
  The class is on the **mark** and not on the row, which is the one place this row departs
  from the grid's own rule: the row is shared by every marker, and one of them being
  finished says nothing about the next.
- **6b — a milestone beyond the drawn window.** The legend keys `Other`, not `Milestone`.
  A mark with nothing of itself in view draws no cyan diamond — it is an edge indicator in
  the plain accent, `barClasses`' own rule — so keying the diamond's colour would name one
  the grid is not painting and leave the one it is unexplained. This row's report was
  written fresh beside the dated axis's and repeated the exact defect that one was fixed
  for; found in review (2026-08-15). It is reported from what the render DREW, never
  recomputed from the results, which is the rule [[A colour per state]]'s legend keeps.

- **6c — a milestone is the only thing the base puts on screen.** The frame draws it and no
  advisory renders. 3c's cost is that a diamond is no card stop, and the roadmap's advisory
  counted the card stops — so a plan whose one visible note was a release date announced
  that every item was done and hidden, beside the date it was drawing. Found in review
  (2026-08-15). Fixed where the count is, not here: the advisory asks what the axis HOLDS,
  which is the model's question and no longer the render's — [[Roadmap empty states]] 3b,
  where the folded band reaches the same defect by the other road.

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
- Every diamond is reachable: two markers on one day never draw on top of one another, and
  no mark's tooltip, click or drag is behind another's.
- A dependency can be drawn FROM a milestone on this axis, since nothing else here can say
  it — the same handle, the same refusals marked while the drag is held, and a click on that
  handle opens no note.
- A marker is counted as placed and reported among the axis's drawn bars in row order, so
  the axis's own "placed plus shelved equals the visible result rows" still holds, and a
  dependency arrow drawn to a milestone anchors on that milestone's own diamond — two
  markers on one day take two arrows to two marks, never one line between them.
- The colour a marker actually draws is the colour the legend keys, the wholly-outside
  case included.
- The row draws no absence control, adds nothing to the declared roster, and its name is
  offered by no input as a value to assign work to.
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
branch is carried for it.

**A marker registers TWO mounts against that track, and they are different elements.**
`tracks` takes the shared track, which is where a move's drag preview belongs — the
positioned box every `--pbl-bar-left` on the row is measured from. `anchors` takes the
DIAMOND, which is what `renderDependencyArrows` reads a Y off. Both were the track until
2026-08-15 and the arrow layer took its parent, which is the row for a bar and the shared
header here: right while markers could not stack, wrong the moment 2e let them. The X is
`dependencyAnchor`'s either way, so two markers on one day differ in nothing BUT that Y.
`BarRowMounts.anchors` in `src/view/render/timeline.ts` is where the pair is named, and a
bar row fills it with its row — the element the arrow layer used to reach through the
track, said directly now that one caller needs a different answer. `drawnSpans`
widens the window from the lane for the marker row exactly as it does for a folded band —
see [[Folding a resource's band]], which states that gate.

**Everything a bar ROW carried has to be asked of the mark instead, and two of them were
missed** — 2d and 2e, both found in review the day the row landed. The pattern is one
sentence: the row was the element that was ONE bar's, and the track is not. So the
diamond takes `data-pbl-path`, the `pbl-link-source` and `pbl-link-illegal` classes
(`begin` in `src/view/interactions/linkDrag.ts` sweeps `.pbl-timeline-row` and the marks
beside it), the `fromRowControl` filter on its click, and a `--pbl-sublane` index; the
header takes `--pbl-lane-sublanes`, which is why `renderLaneHead`'s `head` is handed to
`drawMarkerDiamonds` beside its track. `wireBarLink` DRAWS the connector now rather than
being handed one — `renderConnector` moved out of `src/view/render/timeline.ts` into it,
because a handle drawn in the row renderer is a handle no other projection can have, and
this axis is the projection that proved it. `styles/lanes.css` places the stacked mark
(one rule, `top` only, so the diamond's own rotation is untouched) and
`styles/timelineFurniture.css` reveals the connector off the MARK's hover, since every
existing reveal is triggered by a row this mark does not have.

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
context rule, the minting rule and the placed count), `test/view/milestonesRow.test.ts` (one
row of diamonds and no rows of their own, no disclosure where a band has one, each diamond
named, no absence control, plus 2d's handle, its click guard and its held-drag marking,
2e's stack and its arrow anchor, and 6b's swatch), `test/view/resourceMoves.test.ts` (2f, at
both inputs that offered it), `test/view/resourceScheduling.test.ts` (the slide, both
directions of 2b, the click, and done on the mark) and `test/view/absenceCollision.test.ts`,
where the away-day case now asserts 3b from the rule rather than the old mark. The domain
cases, the two structural view cases and every one of 2d, 2e, 2f and 6b's were watched
failing with the change disabled. That first view file is its own suite as of 2026-08-15,
split out of `test/view/resourceLanes.test.ts` when the row's cases took it past the
`test/**` line budget: one file is about a row per RESOURCE and this row stands for nobody.
2e's arrow case stubs the diamonds' boxes from the stylesheet's own rule, since jsdom
measures nothing — what it asserts is which ELEMENT the layer reads, never the arithmetic.
`test/view/rendering.test.ts` asks the STYLESHEET whether the mark's reveal exists at all,
which is the half no view test can see: the dot was drawn, wired and asserted present while
computing `opacity: 0` on every device with a pointer.

**Not checked here**: how the row of diamonds reads in a live vault — the spacing of marks
that fall close together most of all, which jsdom cannot see, and which 2e narrows without
closing (it separates marks on ONE day; two days apart at a coarse zoom still overlap).
Whether the connector clears the rotated diamond it hangs off is the same kind of claim.
That is the standing limit on every appearance claim; see
`docs/tests/suites/Smoke test the roadmap.md`.
