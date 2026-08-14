---
type: PBI
parent: "[[The resource timeline]]"
order: 40
status: Active
created: 2026-08-14
source: user request
files:
  - src/domain/bars.ts
  - src/domain/writePlan.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/view/host.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/timelineDrag.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/shelf.ts
  - src/view/render/timeline.ts
---

# Scheduling inside a resource's row

**As** someone reading a plan by person rather than by note, **I want** a bar in a
resource's row to move, place and resize on the calendar exactly as it does on the plain
dated axis, **so that** the axis that answers *who* stops being the one axis where *when*
cannot be changed.

[[Showing a resources axis on the roadmap]] drew the rows and
[[Assigning items to a resource]] made them writable, but both writes answer one
question — the assignee. The grid under them is the same grid [[The timeline]] draws, at
the same dates, and it is the only place in this plugin where a bar sits on a calendar
and cannot be dragged along it. What this PBI adds is the second dimension: the row a
release lands in still says WHO, and the pointer's X now says WHEN, in one gesture and
one write.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a bar, an end grip, or a shelf card on the resources axis |
| **Preconditions** | Roadmap mode is on with the resources axis |
| **Guarantee** | A gesture on this grid writes at most one batch to the dragged note's own properties — the assignee the released row names, the dates the pointer named, or both — through the same gate as every write, undoable as one batch and announced once. A grip never changes the row. A refused batch changes nothing anywhere, and no gesture ever writes to a note the Base excluded. |

**Main flow**

1. The user takes a bar by its body and drags it across the grid.
2. The ghost previews the dates the release would write, drawn from the very plan the
   release will submit.
3. The release plans one write: the released row's resource into the assignee property
   where that changed, and the slid dates into the date properties where those changed.
4. The gate applies it, and the bar redraws in its row at its dates on the write's own
   refresh.
5. Undo takes the whole move back as one batch.

**Extensions**

- **1a — the gesture expressed no change.** A drag that wanders and returns writes
  nothing and does not consume the undo slot, exactly as `holdPlan` already refuses a
  zero delta on the dated axis. A body drag that changed neither row nor day is that
  case reached in two dimensions rather than one.
- **1b — only the row changed.** The batch is [[Assigning items to a resource]]'s own
  single write, unchanged. A vertical drag is not a new gesture, it is this one with a
  zero horizontal delta.
- **1c — only the day changed.** The batch is [[Scheduling work]]'s own single write,
  unchanged, with no assignee named — a bar slid inside its own row is a reschedule and
  says nothing about who is doing it.
- **1d — the user takes an END GRIP rather than the body.** The grip resizes one end,
  and **the row it is released over is ignored**: a resize is not a reassignment, the
  same distinction the dated axis's shelf already makes when it refuses a grip as an
  unschedule. A grip dragged into a neighbour's band still writes only the date.
- **1e — the bar is INFERRED, so it offers no hold at all.** `barHolds` withholds every
  hold — grips and body alike — unless at least one end is the note's OWN stated value, and
  that refusal is not narrowed here just because a row means something: **a bar behaves the
  same on both grids.** A span [[Spans roll up the tree]] filled from below has no baseline
  anywhere on it for a gesture to move from, and carrying it somewhere is a gesture. What
  still moves such an item between bands is Set assignee and Alt+Up/Down, which name a
  value rather than displacing one.
- **1f — the drag starts on the shelf.** The release writes both: the row's resource,
  and the day under the pointer as the placement, with the zoom's cell as its duration
  where a span is being written — `shelfPlan`'s existing rule, unchanged. This is the
  gesture that most needed the second dimension: before it, a shelf card dropped into a
  row was assigned and then stayed shelved for want of a date
  ([[Assigning items to a resource]] extension 3c).
- **3a — the shelf card has no writable end at all** — a marker whose target key is
  unconfigured. `shelfPlan` answers null, so the batch is the assignee alone, and the
  card stays shelved with the Notice extension 3c already gives it. The date half being
  impossible must not withhold the half that is not.
- **3b — a bar is released on the SHELF.** It loses its assignee, unchanged from
  [[Assigning items to a resource]] extension 1d: this axis's shelf means "no row to sit
  in", and a row is who. Its dates are untouched. A grip released there is refused, the
  dated axis's own rule.
- **3c — the release lands on an ABSENCE stretch inside a band.** It means that band,
  exactly as its header and its bar rows do. An absence is furniture of the row, never a
  target of its own and never something a work item can be dropped ONTO — nothing about
  a resource being away changes what dropping into their row means. See
  [[An absence stretch is a dead spot in its own band]], which is this rule missing.
- **3d — the release lands on a CONTEXT row inside a band.** It means that band too, and
  writes to the note being CARRIED, never the one being landed on — the context-row rule,
  unchanged. A context row is never a drag source, so it can never be the note carried.
- **3e — the pointer is over the sticky lead column at release.** The row is written and
  **no day is guessed**. The DATE half is refused before any date math, `overLeadColumn`'s
  existing rule: the day under a column that drifts across the grid as it pans is not a day
  the reader pointed at. The ROW half is not refused with it, and that asymmetry is the
  rule rather than an omission — a row's lead column is its TITLE, and aiming at a row by
  its name is how a row is aimed at. Refusing the whole release would break the gesture
  this axis has had since [[Assigning items to a resource]], where every drop lands there.
- **4a — the write is refused** (configuration problems, or a batch naming an excluded
  note). Refused whole and loudly; nothing half-moves. One batch is what makes "the row
  moved but the dates did not" unreachable.
- **4b — the new values take the note outside the Base's filter.** The write stands and
  the card leaves on the refresh, in silence — [[Moving between horizons]] extension 3b's
  own unbuilt case, for [[The outcome report was built from one sentence]]'s reason.
  Named here rather than promised, since this move can now trip it on two properties
  instead of one.

## Acceptance criteria

- A body drag on this axis plans ONE batch carrying whichever of the assignee and the
  dates actually changed, applied through the gate, taken back by one undo.
- A drag that changes neither writes nothing and keeps the previous undo.
- An end grip resizes one end and never writes an assignee, whatever row it is released
  over.
- A bar with no stated end of its own offers no hold at all, on either grid axis, and is
  moved between rows by the menu and the keyboard instead.
- A shelf card dropped in a row is assigned AND placed by one write; one whose type has
  no writable end is assigned alone and says why it stayed shelved.
- A drop on the shelf removes the assignee and leaves the dates alone; a grip released
  there writes nothing.
- Every element of a band takes the drop — its header, its bars, its context rows and its
  absence stretches — and each resolves to the same row.
- A release over the sticky lead column names the row and guesses no day.
- The preview states the dates the release will write, from the same plan — never a second
  answer beside it. WHERE it draws is the dated axis's own answer (the dragged item's own
  row, or the header's track for a card that has none): the band's drop highlight is what
  says which row a release lands in, so the ghost is left to say the dates.
- A move is announced once, naming both halves where both moved.
- No gesture writes to a note the Base excluded, on any of these paths.

## Where it lives

Built.

**One method stays the one method.** `performResourceMove` in `src/view/cardMoves.ts`
takes an optional gesture beside the name, so a drop, an Alt+arrow and Set assignee still
land on one place and no input plans beside another. The batch is
`computeResourceMoveWrites` in `src/domain/writePlan.ts`, which merges what
`computeAssigneeWrites` and `computeScheduleWrites` each plan onto ONE `ItemWrite` — the
record already carries `assignee` and `axis` together, so "who and when" is one batch and
one undo with nothing new in `storage/`. The view never splices an `ItemWrite` itself.

**A band element becomes a positional target.** Each already draws its own
`.pbl-timeline-track`, whose left edge IS day 0, so each supplies its own origin for
`dropDay` and nothing here has to assume where the lead column ends. That needs the drop
target's hooks to carry the pointer, at which point `wireDropTarget` and
`wirePositionalTarget` in `src/view/interactions/cardDrag.ts` differ only in whether the
region highlights — so they fold into one, the dated axis's overlay opting out. That is
this repository's own precedent rather than a new preference: the same duplication is
what folded `wireLinkTarget` in, and the argument there holds here — a target written the
ordinary way must inherit the behaviour rather than remember to ask for it.

**The bar was a dated source already, and stays one.** `barHolds` in `src/domain/bars.ts`
decides which holds a bar offers — one register, asked by the renderer that draws the
grips and by the drag that honours them — and a band's rows draw their bars through the
same timeline pass the dated axis uses, so no axis mints or withholds a hold of its own.
`planFor` in `src/view/interactions/timelineDrag.ts` already dispatches the three
gestures — a body hold reads a delta, a grip reads a delta and moves one end, a shelf
card reads the pointer's position. No date arithmetic is added anywhere; what is added is
which row the answer is combined with.

**What the two grid axes SHARE is stated once each, and the sharing is the design rather
than a tidy-up.** `gestureAt` says what a pointer position means, `previewer` draws the
ghost from the plan the release will submit, `submitGesture` hands a date gesture to the
one method that writes dates, `edgeClasses` says what a mark's clipping means, and
`timelineRows` decides which rows a fold leaves standing. Each was written twice at some
point in this increment and each copy was taken back out: the second copy of `submitGesture`
had already lost the conditional that decides whether a plan states its shape, which is a
write submitted under a shape it was not made with.

**A grip goes to `performScheduleMove`, not to the resource move.** It states a date and
nothing about who is doing the work, so it lands on the method that writes dates and never
names a row at all — routing it through the resource move to re-state the row the note
already holds would be the same value written twice, with a key removal one `null` away.

**The `.pbl-timeline-drop` overlay stays undrawn on this axis**, and the reason is
unchanged from [[Assigning items to a resource]]: it would take pointer events for the
whole day area and swallow every drop the rows are the target for. Positions are read off
the row that was actually released on, which is what lets one gesture answer both
questions.

**A bar that cannot be slid is not a handle for its row either.** `barHolds` withholds
every hold from a span the note does not state — an inferred bar, whose slide would be a
resize wearing a slide's cursor — and on this axis that refusal stands whole. A fourth
hold meaning "the whole bar, for its row alone" existed for a day (2026-08-14) and was
taken back out: a bar behaves the same on both grids, so a span the note does not state
is not something a gesture picks up ANYWHERE. What carries such an item between rows is
Set assignee and Alt+Up/Down, which name a value rather than displacing one. The decision
is stated at `BarHold`'s own declaration in `src/domain/bars.ts`, and
`test/view/resourceLanes.test.ts` pins the refusal from the rule's side.

Driven by synthetic gestures in `test/view/resourceMoves.test.ts` — every one through
`pannedGrid`, which is not optional: jsdom lays nothing out, so an unstubbed release reads
every rect as zero, lands inside the sticky lead column and plans no dates at all, and a
date test that forgot the stub would pass while asserting nothing. The plan's own half is
`test/domain/writePlanProperties.test.ts`, the holds are `test/view/resourceLanes.test.ts`,
and the resources block of `test/view/contextCardWrites.test.ts` now asks the refusal of a
batch carrying dates as well as a row.

**Not in scope, and owed rather than silent:** there is no keyboard route to the DATE
half of this move. Alt+Up/Down steps the resource ladder and Alt+Left/Right stays
reserved on this grid, so the new dimension has one input where the rule this epic keeps
is three. [[Keyboard and menu on the roadmap]] is where that lands, and until it does,
scheduling on this axis is pointer-only — which SC 2.5.7 makes a real gap and not a
preference, exactly as the row's New button and the absence controls already record.

What a live vault still owes: whether the ghost reads as belonging to the row under the
pointer rather than to the band above it, whether a band highlights coherently when the
element under the cursor is the one that lights, and how a resize inside a crowded band
reads beside its neighbours. jsdom dispatches the events and paints nothing.
