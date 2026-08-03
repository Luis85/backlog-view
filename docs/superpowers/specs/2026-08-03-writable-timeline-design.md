# A writable timeline — the roadmap's next increment

**Date** 2026-08-03
**Delivers** [[Zoom and the today marker]], [[Drag from the shelf to schedule]] and
[[Move and resize a bar]] — the first under `The timeline`, the other two under
`Scheduling work`
**Closes on the way** [[The unplaced shelf]] and [[Roadmap empty states]], both of
which stay Open only on the dated half of the drag and on the drop targets
**Answers to** the milestone [[Ship the roadmap epic]], due 2026-09-30

## Why this increment, and why now

The horizon axis is finished — buckets, moves, keyboard, menu, chip. The dated axis
draws bars, rolled-up spans, milestone diamonds and a today line, and **no gesture on it
writes anything**. `renderRoadmap` passes the drag controller on only where a drop has a
write behind it, so the timeline currently offers nothing it cannot keep. That is the
epic's largest honest gap, and three notes are held open by it.

The last two increments were codebase-health sweeps. This is the return to product work,
and it is the slice with the most notes closing per file touched: the writes reuse a
planner, a geometry function and a store that all already exist.

## Scope

**In:** the three PBIs named above, plus one defect they expose — a datetime's time and
offset are erased by the existing schedule path (below, under *The domain*).

**Out**, each with a stated owner:

- The keyboard lift, and bucket stops ([[Keyboard and menu on the roadmap]], which stays
  `Active`). `Schedule` and `Unschedule` already give every date write a non-pointer
  path, so WCAG 2.2 SC 2.5.7 is satisfied the day the drags land; the lift is the
  combined-move and ergonomic path, not the compliance one.
- Lanes and the combined lane-plus-axis batch ([[Lanes on the roadmap]]). Extension
  `2d` of the shelf drag and `1d` of the bar drag both defer to it by name.
- Progress fills on bars ([[Progress on the bar]]) and the roadmap's focus fills
  ([[Focus level picks the rows]]).
- The outcome report — announcing that a write took its own note out of the base. See
  *What is deliberately not built*, below.

## The decisions this increment makes

Four questions were open in the register and are settled here. Each contradicts a
sentence someone wrote before the code existed, so each comes with the note it corrects.

### 1. Snapping is by the day, at every zoom

[[Zoom and the today marker]] says each zoom "declares the grid cell that drags snap
to", and the epic quotes ProductPlan's precision-decays-with-distance rule. Taken
literally, the same gesture would write different dates depending on zoom, and a user
who zoomed out for context and nudged a bar would silently coarsen a date they had set
precisely.

**Decided:** zoom changes pixel density and header granularity only. A drop writes the
day under the pointer at every zoom — the day being the finest unit the data model has,
and the only one a date property can hold. The ISO week then governs header cell
boundaries and the shelf drop's default length, not the write's granularity.

### 2. A shelf drop anchors on the day and takes its length from the zoom

[[Drag from the shelf to schedule]] step 2 writes "start and target spanning that one
cell — its first day and its last". Under day snapping, one cell is one day, so that
wording writes `start === target` — which [[Bars from two dates]] step 4 renders as a
**milestone diamond**. A dropped PBI would arrive looking like a deadline.

**Decided:** start is the day under the pointer; target is start plus the current zoom's
cell, minus a day. Week zoom gives seven days, month zoom the dropped month's own
length, quarter zoom the quarter's. Day-exact anchoring, and a default duration that
still decays with distance.

**`cellSpan` is a duration, not a cell**, and the distinction carries the anchoring rule
the register states twice — "a start takes the cell's first day, a target its last"
(`2c`, and step 2 of the bar drag). Decision 1 made the cell a **day**, so both halves of
that rule collapse to the same thing: the day under the pointer. It reads as a narrowing
of the rule and is in fact its unchanged application to a one-day cell.

The case that shows the two apart is a marker, which takes a target and no span
([[Drag from the shelf to schedule]] extension `2e`). Having no duration, it has nothing
for `cellSpan` to default, so it lands on **the drop day** — not on the drop day plus a
span it does not have. Offsetting it by a week because the reader happened to be zoomed
out would be exactly the silent coarsening decision 1 exists to refuse: a deadline is the
one date on this screen a gesture must never move on its own.

### 3. Whole-day steps, so the month-end clamp stops being reachable

[[Move and resize a bar]] step 1 slides "by whole-cell steps" and extension `1f` states
a calendar step landing on the same day of the target unit, clamped to the last day
where that day does not exist. With day snapping there is no unit larger than a day to
step by, so the overflow the clamp guards against cannot occur.

**Decided:** slides and resizes step whole days. `1f` is deleted rather than left as a
rule about a case no code can reach — an unreachable rule is a claim with nothing under
it, and this repository already has a note about what those cost.

### 4. The outcome report is not built

Both drag notes carry a case where a date write takes its own note out of the Base's
filter and say it is "announced with an open path". `CLAUDE.md` and
[[The outcome report was built from one sentence]] record that this mechanism was built
once, removed, and cost eleven review findings across seven rounds without reaching a
correct rule — the blocker being that nothing correlates a Bases pass with a write.

**Decided:** not built. The write stands, the card leaves on the refresh, and undo still
takes it back across the boundary. The acceptance criteria that promise the announcement
are narrowed to what actually ships, and the question stays owned by its issue. Writing
the guarantee to the check rather than ahead of it.

## Architecture

Four layers, in the order the change moves through them. Nothing reaches upward, and
nothing below `view/` learns what a gesture is.

### The domain — `src/domain/timeline.ts`

The scale is a record, not a mode:

```
TimelineScale { id: 'week' | 'month' | 'quarter'; dayPx: number; unit: ... }
```

| Scale | `dayPx` | A day is | A year is |
| --- | --- | --- | --- |
| `week` | 16 | a comfortable pointer target | ~5,840px |
| `month` | 4 | today's density, unchanged | ~1,460px |
| `quarter` | 2 | as wide as the two marks it must hold | ~730px |

Strictly decreasing, each a clean multiple of the next, and `month` is exactly what
ships today so the default view does not move under anyone. Without stated values the
three "discrete scales" would either render identically or be invented at
implementation time, which is how a zoom control becomes three buttons that do nothing
visible.

**A sparser scale needs a minimum bar width that is not `dayPx`.** `renderBarRow` clamps
a bar to `Math.max(spanDays * DAY_PX, DAY_PX)`, which at quarter zoom is one pixel — a
stated plan rendered as an invisible one. The floor becomes its own constant, which is
what [[Zoom and the today marker]] extension `2a` already means by "the minimum drawable
width": the dates are the fact and the pixels are the zoom's, but a fact drawn at zero
width has stopped being reported.

**Every other fixed pixel count on the grid has the same problem.** `TODAY_NUDGE_PX = 2`
steps a milestone line aside from today's where they share a date; at one pixel per day
that is a two-day displacement, putting the line and its label in the wrong day. A nudge
is a *sub-day* offset, so it becomes a fraction of `dayPx` and can never leave the day it
belongs to. The floor and the nudge are the two constants this increment converts, under
one rule: **a length in days is scaled and a length in pixels is not**, and mixing them
is what a zoom control turns into a bug.

**And the nudge puts a relation on the scale, which is the thing to state rather than
another number.** [[A milestone line across the plan]] extension `1d` requires today's
line and a milestone dated today to both draw and **not** merge, and
`.pbl-milestone-line` sits at `z-index: 0` beneath `.pbl-today`'s `1` — so a coincident
line is not a merged mark, it is an erased one. Two marks side by side inside one day
therefore need the day to be at least as wide as both of them:

> **`dayPx ≥ 2 × lineWidth`**, for every scale in the table.

Both lines are `width: 2px` today, so the two together want four pixels of day — which
`quarter` at 2 does not have, and cannot get by nudging. The line width becomes a
scale-derived custom property rather than a constant: 2px at `week` and `month`, where
there is room, and 1px at `quarter`, where there is not. Nothing changes at the two
densities most reading happens in, and the sparse scale narrows the marks instead of
losing one.

Stating the relation is the point. This is the third revision of the same constraint —
first the nudge, then the floor, now the widths — and each earlier one fixed the
instance while leaving the rule unwritten, so the next scale would have broken it again
in silence. As a relation it is checkable over the scale table itself, which is a test
that fails for a scale nobody has added yet. Whether 1px at 0.55 opacity *reads* as a
line is not something jsdom can answer, so that joins the smoke list.

Today's fixed rendering becomes the `month` scale at `dayPx: 4`, so zoom adds a
parameter to functions that already exist rather than a second drawing path.
`timelineWindow` aligns its bounds to the scale's unit.

**The backstop stays a time budget.** `MAX_TIMELINE_MONTHS` becomes `MAX_TIMELINE_DAYS`
— the same span it already means, rounded out to whole cells of the active scale — and
**not** a cell count. A cell count would make the reachable calendar depend on the zoom
(sixty weeks is fourteen months; sixty quarters is fifteen years), so a two-year plan
visible at month zoom would clip to edge indicators at week zoom. That contradicts the
guarantee [[Zoom and the today marker]] states outright: at every zoom the same results
place and only the granularity changes. A day budget also bounds the header better than
a cell budget did — the cell count it implies is largest at the finest scale, and there
it is a few hundred, nowhere near the tens of thousands the backstop exists to refuse.
What varies with zoom is the drawn width, which is what a scroll container is for and
what choosing a zoom is choosing.

Three new pure functions:

| | |
| --- | --- |
| `dayAt(window, scale, x)` | Pixel offset → `CivilDate`, clamped into the window. The exact inverse of the `daysBetween(window.start, date)` that `barGeometry` already computes, so px↔date is one rule stated in two directions rather than two rules that can drift apart. |
| `addDays(date, n)` | The whole-day step every slide and resize is made of. Civil arithmetic beside `daysBetween`, consulting no clock and no zone. |
| `cellSpan(scale, day)` | The shelf drop's default duration — 7, the month's own length, or the quarter's. Used by that one gesture and by nothing else; it is not a snapping unit. |

**`barHolds(item, settings, bar)`** answers where a gesture may take hold — body, start
grip, end grip — as one predicate the renderer and the drag both ask. A marker offers no
end grips (a point has no duration to resize); an inferred end withholds the body hold
too, not only its own; an unconfigured key offers no grip at all. Asking it once is what
keeps what is drawn as grabbable and what can actually be written from disagreeing.

**The datetime defect.** [[Move and resize a bar]]'s acceptance criteria require that a
datetime keep its time of day and its shape on disk. `computeScheduleWrites` → `planDate`
writes a plain `formatCivil` string, so a note carrying `2026-08-01T09:00+02:00` loses
its time — and this is live today on the shipped menu path, since `SchedulePromptModal`
uses native `type="date"` fields.

**The shape is preserved by the writer, not by the plan.** The obvious fix — carry the
old raw value on `BacklogItem` and have `planDate` re-emit the civil date with its
suffix — is wrong here, and `storage/frontmatter.ts` says why in three places already:
*the model's idea of a value can be a refresh behind* — an external edit, or a batch
still settling. A suffix taken from the model and written back would overwrite a time or
offset changed since the model was built, which is the one thing this fix exists to stop
happening.

So `AxisWrite` carries the requested **civil date alone**, and the merge happens inside
`processFrontMatter`, against the live value, in the only module allowed to read and
write it: the date is replaced, whatever time and offset the note currently holds ride
along. `planDate` keeps its *comparison* against `plannedStart` / `plannedTarget` — a
stale civil date can only cost a redundant write, never a wrong one — and
`BacklogItem` gains nothing. `CivilDate` stays what the placement rules are stated in:
no time, no zone, the same cell on every device.

### The plan — `src/domain/writePlan.ts`

**Nothing new.** `computeScheduleWrites` is already the batch these gestures want: both
ends on one `ItemWrite` so a span is one undo rather than two halves that can be taken
back separately; `null` removing a key only where the note carries it; an end that would
change nothing dropped from the batch. The gestures build a `SchedulePlan` of civil-date
strings and hand it over.

It stays type-agnostic, deliberately: **which** ends a plan may name is `placementEnds`
in `interactions/plan.ts`, where the type rules already live and where `unschedule`
already asks. Pushing the marker narrowing down into the planner would put a type rule
in two places, and the one that got updated would be whichever the next gesture
remembered.

### The write path — `src/view/host.ts`, `src/view/interactions/plan.ts`

One new host method, `performScheduleMove(item, plan)` — the only place a date batch is
planned and the only place it is announced, which is the epic's "one move, three inputs"
rule reaching a third projection. It shares `applyCardMove`, and therefore its capture
rule: the dates that will *name* the move are read before the await, because the batch's
own refresh rebuilds the timeline and the window may have moved under it.

The menu's `promptSchedule` and `unschedule` are routed through it. They call
`host.applySafely` directly today; leaving them there would make the drag a second idea
of what scheduling is, which is exactly the drift the rule exists to prevent.

`announceScheduleMove` joins `announceBoardMove` and `announceHorizonMove` in
`cardDrag.ts`, so a menu move and a gesture are told to a screen-reader user in the same
words. It says old span and new — and **"Unscheduled" is only true where the item
actually leaves the axis**. A parent whose descendants still carry dates keeps a bar:
`inferSpan` refills an end the note no longer states, so announcing a removal as
"Unscheduled" would describe something other than what renders. The announcement names
the inferred span instead. This is `announceHorizonMove`'s own lesson — its preamble
records reporting a cleanup as "from Unplaced to Unplaced" — reached by the other axis,
and it is fixed in the one host method so the menu's `Unschedule` inherits it rather
than being a second place that can get it wrong.

### The gestures — `src/view/interactions/timelineDrag.ts` (new)

The geometry, the grips and the preview are a new file — `cardDrag.ts` is explicitly
*the whole region is the target and the highlight is the only drop signal*, and a
positional drag is a second concern that would push it past its stated job as well as
its budget.

**The registration is not new, and must not be.** `CardDragController` holds a private
`token` whose comment states the hazard exactly: the adapter's registry is
document-global, two saved views can sit in split panes over the same notes, and a card
that crosses between them resolves its path against the receiving view's model and
writes *its* keys — a different property changed than the gesture showed. On the
timeline the stakes are the receiving view's `startKey` / `targetKey`. So every timeline
source and target registers **through the controller**: `wireCard` mints the token for
the bar holds as it already does for cards (carrying which hold was taken), and a
positional sibling of `wireDropTarget` gates on the same token and keeps the same
resolve-at-drop-time rule, since a refresh mid-drag can drop the note. One place mints
the identity; `timelineDrag.ts` decides what a position means.

- **The drop target is one overlay over the day area, not "the track".** There is no
  single track to register: `.pbl-timeline-track` is created once inside the header and
  again inside every row, so registering any one of them would take drops over that row
  alone and none over the gaps or the empty space below the last row — most of the grid
  a user would aim at. Instead the day area gains one element spanning the full height,
  positioned past the sticky lead column, which is both the drop target and the surface
  the pointer is measured against. It takes pointer events **only while a drag is live**,
  so it never sits between the reader and a bar's grips — the empty shelf's existing
  trick (in the DOM so a drop has somewhere to land, out of the way until a drag needs
  it), reached by a second surface. `onDrag` paints the preview — a ghost bar and the
  dates it means — through CSS props; `onDrop` builds the plan and calls
  `performScheduleMove`. A drag ending off both grid and shelf writes nothing and does
  not consume the undo slot.

  One overlay rather than a target per row because, without lanes, **the row a drop
  lands on carries no meaning**: the dragged item is the subject and only the X says
  anything. When [[Lanes on the roadmap]] makes the Y meaningful it will be reworking
  this area regardless, and it is the note that owns the combined batch.
- **Placing reads the pointer; moving reads the delta.** Two gestures, two rules, and
  conflating them is a bug at the sparse scales.

  A **shelf drop** has no origin to move from, so it reads the pointer's position:
  `dayAt` takes an offset from the window's first day while the drag adapter reports a
  **viewport** `clientX`, so the view subtracts the overlay's own bounding rect — which
  starts past the sticky lead column, so that exclusion is structural rather than a
  constant kept in step with the CSS. One subtraction and no scroll term: a bounding
  rect already moves with the scroll, and adding `scrollLeft` would double-count the
  pan. Untranslated, preview and write are both off by the pane's position plus the
  scroll — a drop over one day scheduling another.

  A **hold on an existing bar** must not, because a rendered edge is not always its
  date. A span shorter than the minimum drawable width is drawn wider than it is, so at
  quarter zoom the end grip of a one-day bar sits days past its target: reading the
  pointer absolutely would mean *grabbing* the grip already previews a later date, and
  the smallest twitch writes it. So a hold captures the endpoint's own date and the
  pointer's start, and each frame moves that date by
  `round(((x - x₀) + (scrollLeft - scrollLeft₀)) / dayPx)` days. Zero movement is zero
  days at every zoom, which is the property that matters and the one an absolute read
  cannot promise. The body slide was always a delta; this makes the grips agree with it.

  The scroll term is **not** the double-count the placing rule refuses, and the two
  paragraphs have to be read together or someone will "fix" one into the other. A
  placing read measures against the overlay's bounding rect, which already moves with
  the pan, so adding `scrollLeft` would count it twice. A moving read measures against
  a pointer position captured in viewport space, which does *not* move with the pan —
  so while auto-scroll pans the grid under a held pointer, `x - x₀` stays zero while
  later dates slide beneath it, and without the term the preview freezes exactly when
  the scroller is doing its job. Rect-relative reads exclude the scroll; viewport-relative
  deltas include it.

  **An open end has no date to capture, so it borrows the stated one.** `barHolds`
  exposes a grip on an absent end wherever its property is configured — that grip is
  how the missing date gets written ([[Move and resize a bar]] extension `1a`) — and a
  one-dated bar renders one cell wide *at the date it has*, so the open end is drawn
  against the stated one and takes it as its baseline: a missing target counts days
  from the start, a missing start counts back from the target. Each is clamped at equal
  with the end it borrowed from, the same refusal to write a reversed span.

  Its zero case is the one that differs, and it is a write rule rather than a
  geometric one: an open-end hold released where it began **writes nothing**. Zero days
  from the baseline would be a date equal to the stated end — a milestone diamond — and
  a plan that stated no end still states none. Absent is a value here, and a gesture
  that did not move must not be what turns it into one.

  Both are driven against a **panned grid at a nonzero viewport offset** — a fixture at
  the origin with no scroll cannot fail the conversion — and the grips additionally
  against a **one-day bar at quarter zoom**, the case where the drawn edge and the date
  are furthest apart, and against **both open-end cases**, a missing start and a missing
  target, each released without movement to prove it writes nothing.
- **The timeline registers its scroller.** Auto-scroll is opt-in per element and
  `renderRoadmap` calls `wireScroller` only in the horizon branch, so without this a
  drag could reach no date that is not already on screen — and the grid is thousands of
  pixels wide by design. The element to register is the one that actually scrolls, which
  is the horizon branch's own recorded lesson ("the frame is `max-content` wide and
  scrolls nothing") reaching the other axis with a different answer: here it is the
  timeline's own horizontal scroller, not the pane, because
  [[Zoom and the today marker]] requires the scrolling to stay inside the view and the
  pane never to scroll sideways.

  **That inner scroller moves the today anchoring with it.** `restoreScroll` sets
  `treeEl.scrollLeft` and centres `todayLeft` on the pane, which works today only
  because the pane *is* the horizontal scroller; introducing an inner one would leave
  that assignment inert and today off-screen on any window wider than the view. So
  `RoadmapSnapshot` returns the scroller element and `restoreScroll` takes it as the box
  it operates on, falling back to the pane where there is no inner scroller — which is
  every other projection. Opening, the preserved offset across a zoom change, and
  jump-to-today all address that one element. Both axes stay one element's job, because
  the timeline scrolls in both (see *Zoom and today*); what changes is *which* element,
  not how many.

  **Across a zoom change, what is preserved is a date, not a pixel count.** `scrollLeft`
  measures pixels and a zoom redefines what a pixel is worth: a day a hundred days out
  sits 400px away at month zoom and 200px at quarter, so carrying the number across
  would reopen the view about twice as far into the plan as the reader left it — and
  `restoreScroll`'s existing `saved + (newTodayLeft - oldTodayLeft)` correction cannot
  see it, because it corrects for the window moving and not for the ruler changing. The
  anchor across a scale change is therefore the civil date at the viewport's leading
  edge, captured before and turned back into an offset against the new `dayPx`.
  Same-scale re-renders keep the pixel carry, which is exact for them. The test changes
  zoom **while panned away from today**, since at today the two rules agree and the bug
  is invisible.

  **And the offsets are captured from the OLD scroller, before the DOM goes.**
  `renderTreeContent` reads `treeEl.scrollTop` / `scrollLeft` just before `treeEl.empty()`,
  which is the pane — on the dated axis those are the offsets of a box that no longer
  scrolls, so restoring them would silently discard the reader's pan and jump back to
  today on every refresh and every zoom change. The previous snapshot is already held on
  the view as `this.roadmap`, so the capture reads its scroller where it reads the pane
  today. Capture and restore are one decision about which element is the scroll box, and
  they have to name the same one — a half-applied version of this change is worse than
  none, because it restores a real offset onto the wrong box.
- Three sources, and **two different gates**, because they are asked different
  questions. The bar body and the two end grips are gated by `barHolds`, which is about
  a rendered bar. A shelf card has no bar, so it is gated by `canSchedule` — the
  existing `placementEnds`-based predicate that already answers the case the register
  names: a marker on a start-only axis has no key it may write, so its card offers no
  grip at all and stays on the shelf until a target property is configured
  ([[Drag from the shelf to schedule]] extension `2e`).
- **Every date plan is built from `placementEnds`, not from what the bar draws.** The
  narrowing is one rule and it reaches every gesture: `computeScheduleWrites` is
  deliberately type-agnostic, so a plan assembled from the rendered span would write a
  marker's start on the shelf drop ([[Drag from the shelf to schedule]] extension `2e` —
  target alone, however many properties are configured) and carry its stale start along
  on a slide ([[Move and resize a bar]] extension `1g`). Stating it per gesture is how
  the third one gets missed; the ends a gesture may touch are asked once, from the same
  predicate that already decides what is draggable and what an unschedule removes.
- A shelf drop writes decision 2's span — for a marker, its target alone at the drop
  day. A body slide steps whole days, moving **only the ends the note actually states**
  (and may touch) — both, so a two-ended slide never changes duration; the stated one
  alone where the bar has one, its open end staying open. The
  bar's rendered width is not a duration to preserve when half of it is an absence:
  filling it in would close a one-ended plan by a gesture that promised to move it, and
  equal ends would draw a milestone the note never claimed
  ([[Move and resize a bar]] extension `1a`). An end drag moves one date and clamps at
  equal rather than crossing — but **only against an end the note itself states**. A
  reversed span is a property of a note's own pair, which is the only pair
  `reversedSpan` is ever asked about; where the opposite end is inferred there is no
  span to reverse, and clamping would write a bound taken from the children's dates —
  the inference `1c` forbids writing. Dragged past inferred evidence, the gesture writes
  the day the pointer names and `inferSpan` places the result: `keepsOrder` already
  drops evidence falling on the wrong side of a stated end and leaves that end open.
  Again the existing rule, asked rather than restated.
- **The shelf accepts the body hold and refuses the grips.** `wireDropTarget` admits any
  source carrying the view's token and hands its callback the resolved item alone, so
  with the bar holds wired as sources it cannot tell a resize from a body drag: a start
  grip released over the shelf would fire the full unschedule and delete both keys
  instead of moving one end. The hold the payload already carries is therefore read by
  the shelf's own `canDrop`, which admits the body and the shelf card and refuses the
  grips — refused rather than ignored, so the strip never highlights for a drag it would
  not honour, the same reason `canDrop` refuses a foreign view's card instead of
  dropping it silently. A grip released there is a drag that ended nowhere: no write,
  indicators clear, undo slot untouched.
- **The shelf takes its removal from the axis, not from a truthy controller.**
  `renderShelf` currently reads `dnd` as "the horizon axis" — it hardcodes
  `performHorizonMove(item, null)` as the drop and words its tooltip "removes its
  horizon". Both are correct today only because the dated axis passes `null`, which is
  the withholding this increment removes. Handed a controller unchanged, a bar dropped
  on the timeline's shelf would clear its **horizon** while the tooltip promised exactly
  that — consistent wording for the wrong write, which is worse than either alone. So
  the shelf is given the removal to plan and the words to say it in, and the axis
  chooses both; `dnd` goes back to meaning only "drops are live here".
- A bar dropped on the shelf removes keys rather than blanking them, and undo restores
  them with their values. **Which** keys is `placementEnds` in `interactions/plan.ts`,
  not "the configured ones": it already narrows a marker to its target alone, which is
  the rule [[Drag from the shelf to schedule]] extension `2e` states — a stale start the
  type ignores stays on the note, because a gesture may only take back what the
  projection actually drew. `unschedule` loops it today, so the gesture inherits the
  narrowing by routing through the same plan rather than restating it.
- **The shelf drop's indicator says which outcome it is, before release.** Removing a
  parent's own dates does not always shelve it: where descendants still supply dates the
  bar stays, inferred, and step 4 of [[Drag from the shelf to schedule]] requires the
  indicator to distinguish that from actually shelving.

  **The outcome is asked of the function that places, never derived beside it.**
  `deriveBars` decides bar-or-shelf per item over several rules that do not compose into
  one — a marker goes through `placeMarker`, which ignores the start entirely and shelves
  whenever the target is absent, so a marker that keeps a stale start still shelves and
  never reaches `inferSpan` at all; an unreadable or reversed pair shelves with its
  reason before any inference is asked. So the per-item decision comes out of
  `deriveBars` as a pure function taking the item's *effective* stated ends, `deriveBars`
  calls it for what renders, and the preview calls it with the ends the removal would
  leave. That is the register's own "the checkmark is asked of the plan" rule reaching a
  third surface: a comparison written beside a placement rule and expected to agree with
  it is exactly what drifted when the second axis arrived. It costs nothing extra —
  `descendantStart` and `descendantTarget` are already gathered from children alone,
  never from the item's own dates. The same call names the announcement above, so the
  preview and what the screen reader hears cannot disagree either.
- `renderRoadmap` passes `dnd: null` on the dated axis today as the deliberate
  withholding. Flipping that on is what this increment is.

### Zoom and today — `render/toolbar.ts`, `storage/collapseStore.ts`, `styles/timeline.css`

A zoom picker and a jump-to-today button beside the focus picker, both rendered only on
the dated axis. The zoom is a per-screen working position, kept where collapse state
already lives and never in the `.base` — which means **two** places, not one.
`CollapseSnapshot` gains `zoom` and `collapseStore.ts` validates it against the three
scale ids exactly as `axis` is validated against `AXIS_VALUES`; but `CollapseState` in
`src/view/collapseState.ts` is what actually holds `mode` and `axis` as private fields,
reads them on restore and constructs the snapshot it saves. A store-only change would
give a picker that works all session and reverts the moment the view is reopened — the
worst shape of this bug, because nothing fails until someone comes back the next day.
So `zoom` joins those fields with its accessor, its restore and its flush, and the test
is a **round trip**: pick, save, reload, and find the same scale. The narrow-pane rule
needs **a real control**, and therefore **one decider** — and the control goes in the
**toolbar**, not on the shelf header. Hiding the cards in CSS alone would strand every
unplaced card until the pane was widened, the opposite of "may lose its card, never its
existence"; but making the header itself a button puts a focusable non-option child
inside the `role="listbox"` that `renderRoadmapContent` gives the pane whenever cards
render, which is a second tab stop in a composite that has exactly one. Reaching it
properly would need the region stops [[Keyboard and menu on the roadmap]] owns and this
increment defers. So the toggle joins the zoom picker and jump-to-today in the toolbar —
already outside the composite, already real buttons — carrying `aria-expanded` and
naming the shelf with `aria-controls`. The header keeps its icon, label and count and
stays a `div`.

But a container query plus a button is **two** deciders, and they desynchronise: at a
wide pane the query shows the cards while the flag still says closed, so the control
would announce "collapsed" over visible content. CSS cannot write an ARIA attribute, so
the attribute has to be the one that cannot be wrong. The compaction is therefore
**measured in code and applied as a class**, the same shape as `pbl-hide-props` and its
siblings, rather than a query the DOM cannot see. One decision: the width sets the
default, a press overrides it, and `aria-expanded` states whatever that resolved to.

**It needs its own measuring pass, because the tree's does not run here.** Both the
post-render refit and `onResize` return early for every non-tree projection — with a
stated reason, that board columns and the timeline scroll rather than dropping columns,
so the *column* ladder is the tree's. That reason stays true and the comment narrows
rather than goes: what changes is that the roadmap now has a measured question of its
own. The shelf measure runs after render and on resize, gated to the dated axis.

It also needs no second render pass, which the column ladder does need: a column coming
or going can only be shown by rebuilding the rows, while the shelf's cards are already
in the DOM and a class decides whether they show. So the shelf measure toggles a class
and stops — no `refitting` re-entry guard, because there is no re-entry. The test moves
a pane across the threshold *after* the first render, since a fixture that is only ever
measured once cannot fail this.

**But hidden cards leave the navigable set, and a selection on one is reconciled.** The
roadmap's arrow handler walks `snapshot.cards` unconditionally, and `renderShelf` puts
every shelf item in it, so a class-only collapse would let Arrow and End select a card
nobody can see and point `aria-activedescendant` at hidden content — a keyboard user
with no visible position, which is the worse half of "hidden versus absent". So the
resolved compaction narrows what is navigable, and a resize that collapses the strip
clamps a selection already sitting in it, the way a vanished board column already
clamps `selectedBoardColumn`. Reachability is not lost, and that is the second reason
the toggle sits in the toolbar: it is a real focusable control outside the composite
that `aria-controls` the shelf, so the way back to those cards is a press rather than an
arrow into the dark.

**And the pane's role is resolved after that, not before.**
`renderRoadmapContent` picks `listbox` or `region` from `roadmap.cards.length`, decided
at render and never revisited by a measuring pass that deliberately does not re-render.
On a narrow pane whose only cards are shelved, every option would then leave the
navigable set and the pane would stay an empty `listbox` — a composite promising options
it no longer has, which is the state that role exists to avoid. The role is therefore
set from the **navigable** cards once compaction has resolved, which is a single
attribute the measure already has cause to touch. The open flag is view state that
survives a render, the way the selected board column already is — a rebuild must not
re-collapse a strip the reader just opened — and it stays out of the collapse store,
which keys on paths and has nothing to key this on.

**Moving the scroller inward is a stylesheet change, not only a code one — and it is a
two-axis move, not a horizontal one.** The pane is the scroll box today because
`styles/roadmap.css` puts `overflow-x: auto` on `.pbl-roadmap-mode .pbl-tree` while
`.pbl-roadmap` is `min-width: max-content` and `.pbl-timeline` is `width: max-content`.
Adding an inner horizontal scroller without touching those nests two of them — the
containment guarantee broken by the change meant to keep it.

It cannot be horizontal alone, either. `.pbl-timeline-header` is `sticky; top: 0` and
`.pbl-timeline-lead` is `sticky; left: 0`, and both pin against the pane precisely
because the pane is the one scroll box for both axes. Give `.pbl-timeline` an
`overflow-x` and it becomes a scroll box on both axes, so the header would pin to the top
of a full-height element and scroll away with the pane — the month labels leaving the
screen while the grid they name stays.

**So the timeline becomes the scroll box for both axes on the dated axis**: it takes a
bounded height, its rows scroll vertically inside it, the header pins to its top and the
lead column to its left, and the pane scrolls neither way. That is the structure a grid
with a frozen header and a frozen first column has to have, and taking it deliberately
also *simplifies* what the earlier finding forced: `restoreScroll` does not need a
horizontal target apart from a vertical one, because on this axis **one element carries
both** — the snapshot returns it, and opening, zoom preservation and jump-to-today all
address it. Everywhere else the pane stays what it is.

**The shelf is not inside that box, so the frame has to give it room.** `renderRoadmap`
appends the shelf and the advisory as siblings after the timeline, so a pane that no
longer scrolls vertically would clip a long shelf below the grid with nothing to scroll
— unreachable cards, which is the failure [[The unplaced shelf]] exists to prevent, and
worse than the compaction it sits beside because nothing would say they were there. The
dated frame is therefore a column under one rule, stated as a rule because the frame has
more bands than the two that prompted it:

> The timeline takes what is left; **every other band declares a maximum and scrolls
> itself**.

Saying a band "scrolls itself" creates no scrollport: cards and rows wrap to an
intrinsic height, so an unbounded band in a short pane grows until it squeezes the
timeline out or is clipped below it. The timeline is `flex: 1 1 auto` over
`min-height: 0` — without which a scroll box refuses to shrink — with a floor beneath
which it stops yielding. The shelf is `flex: 0 1 auto` with a maximum share and its own
`overflow-y`. **So is the context strip**, which is a third band between them and can
run to several rows on a focused filtered base; it was not bounded by the first version
of this paragraph, which is exactly the recurrence a rule prevents and a list of two
does not. The advisory keeps its intrinsic height, being one line. Regions yield space
before results are hidden — the tree's rule, applied to a frame that now owns its own
height — and no band can starve another, because each states what it may take.

The rules are axis-specific and the only class today is `pbl-roadmap-mode`, which both
axes wear: an axis class is toggled beside it in `backlogView.ts`, where the mode class
already is and where the axis is already known. A `:has()` selector would need no new
state and is the reason to mention it — but it is the clever answer to a question the
boring one already closes, and it raises specificity in a stylesheet whose ordering is
documented as load-bearing.

## The context-row rule, asked of a third set of gestures

Every new entry point is a write path, so each is subject to the same rule: an
`outsideFilter` row is never a write target, never a ranking peer, never a source of
anything derived. Context rows are never shelved and never draggable; `applySafely`
refuses whole any batch naming one. This is not re-derived for the timeline — the check
is added to `test/view/contextCardWrites.test.ts`, which already asks the three questions
of each card projection, so the new gestures fail it without anyone having predicted the
surface.

## The register corrections this increment owes

1. [[Zoom and the today marker]] — decision 1: the zoom's cell is the shelf drop's
   default length, not the write's granularity.
2. [[Drag from the shelf to schedule]] — decision 2: anchored on the drop day,
   `cellSpan` long.
3. [[Move and resize a bar]] — decision 3 (whole days; `1f` deleted) and decision 4
   (`3b` and its criterion narrowed to what ships).
4. [[Keyboard and menu on the roadmap]] — delete "the roadmap's dated axis has no
   non-pointer moves *and no pointer ones either*". `Schedule` and `Unschedule` write
   today, and after this increment the pointer paths do too. The sentence is already
   false and would be doubly so on merge.
5. [[The unplaced shelf]] and [[Roadmap empty states]] — both close: the dated half of
   the shelf drag lands, and every grid region becomes a drop target.
6. [[Bars from two dates]] — close it. Its stated reason for staying open was inferred
   parent spans waiting on [[Spans roll up the tree]]; that PBI is Done and `deriveBars`
   in `src/domain/roadmap.ts` sets `inferredStart` / `inferredEnd` today, so the note is
   held open by a sentence rather than by a gap.

## Testing

Node tests in `test/domain/timeline.test.ts` for the scale, the unit-aligned window,
`addDays`, `cellSpan` and `barHolds`. The backstop is tested as the guarantee rather
than as a number: **the same spans place at all three zooms** — one assertion that fails
if the cap is ever expressed per-cell again, which a test naming sixty of anything would
not. `dayAt` is tested **as
`barGeometry`'s inverse** — a date placed and read back is the same date — rather than
against hand-computed pixels, since the round trip is the property that matters.

The datetime shape preservation is **watched failing first**: it is a live defect on the
shipped menu path, and watching it fail is the evidence the test asserts what it reads
as. It is tested where the merge happens, in `test/storage/frontmatter.test.ts` rather
than against the planner — a note whose live value carries a time and offset keeps both
when a gesture moves its date, **and keeps them when the value on disk changed after the
model was built**, which is the case a model-carried suffix would silently overwrite and
a planner-level test could not see.

A new `test/view/timelineDrag.test.ts` drives the gestures — the shelf drop, the body
slide, both end grips, the clamp at equal, the bar-to-shelf removal, the drag that ends
nowhere, the marker on a start-only axis offering no grip, the one-ended bar whose body
slide leaves its open end open, and a grip released over the shelf writing nothing —
every pointer case driven against a **panned grid at a nonzero viewport offset**, because
a fixture at the origin with no scroll passes whether or not the pointer is converted at
all. The shelf's toggle is asserted as a control, not as a class: it carries
`aria-expanded`, it responds to a keyboard activation, and pressing it while the
container query would compact the strip leaves the cards rendered. The clamp gets both sides of its condition: two
stated ends clamp at equal, while a stated end dragged past an inferred one writes the
day the pointer named and re-places with that end open. A marker with both properties configured is driven
through **every** gesture — shelf drop, body slide, bar-to-shelf — asserting the same
thing each time: the target moves and the start is never written. One case per gesture,
because "the plan is narrowed by type" is a category claim and the next gesture is
exactly the one that would break it. Three further cases are about what a removal
*leaves*, not what it takes: a parent with dated descendants previews and announces the
inferred span it keeps, one with a wholly dateless subtree previews and announces the
shelf, and a marker carrying a stale start previews the shelf — the trio being the check
that the outcome comes from the placement rule rather than from a comparison beside it. Split-pane isolation is asserted where the token is minted:
a source wired by one controller must not be droppable on another's target, which is the
`canDrop` contract stated as a test rather than as the comment it is today.
`test/view/contextCardWrites.test.ts` gains the timeline's entry points. Coverage
thresholds in `vitest.config.mts` only ever go up.

`npm run check` — build, lint, coverage-thresholded tests, fallow, docs register — is
the gate, on Ubuntu and Windows both.

## What jsdom cannot answer

Named honestly rather than claimed, and filed as a smoke note under `Feature Test`:

- Whether the preview reads as a contract — that the ghost bar and its dates are
  legible while the pointer is moving.
- Whether an end grip is reachable at four pixels per day, and whether the three zooms
  are three *usable* scales rather than three numbers.
- Whether a drag toward the pane edge actually pans the grid, and at a usable rate.
  Registering the scroller is checkable here; that it *engages toward an edge* is a
  pointer-position behaviour of the drag library, which jsdom does not run.
- **That exactly one thing scrolls, and that the header and lead column stay pinned to
  it.** jsdom computes no layout, so nested scrollers and sticky containing blocks are
  both invisible to it: a test can assert which element carries the class and never that
  the pane stopped overflowing or that the month labels held their place while the rows
  moved under them. This is the one part of the increment where the checks genuinely
  stop short of the claims, so the claims are the smoke note's — and the two-axis
  restructure makes it the part most worth looking at first.
- Whether the three densities are three *usable* scales — 16, 4 and 2 pixels per day are
  reasoned, not measured, and the width of a real pane is the only thing that can say
  whether quarter zoom shows enough plan to be worth having.
- Whether today's line and a milestone dated today read as **two** marks at quarter
  zoom, where each is one pixel at 0.55 opacity. `dayPx ≥ 2 × lineWidth` is satisfiable
  there only by narrowing the lines, so this is the check on that trade: if a one-pixel
  line cannot be seen, the answer is a denser `quarter`, not a thinner mark.
- The narrow-pane shelf compaction, and whether anything clips under the header in an
  embedded base.
- The today line and jump-to-today from a scrolled position.

`npm run test-build` bundles into this repository's own `.obsidian/plugins/`, and
`docs/Product Backlog.base` is a real backlog with a real milestone on it — the plugin
displaying its own register is the smoke test.
