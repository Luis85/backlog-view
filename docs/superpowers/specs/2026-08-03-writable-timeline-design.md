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

The fix belongs in `planDate`, where both the menu and the new gestures route through —
one guard in the shared function, not one per caller — but it cannot live *only* there.
`readDate` matches the `([Tt\s].*)?` suffix and then throws it away, and
`FieldReading<CivilDate>` carries the year/month/day triple alone, so `plannedStart` and
`plannedTarget` have nothing for `planDate` to re-emit. **`BacklogItem` gains
`rawStart` / `rawTarget`** — the frontmatter values `buildModel` already reads through
`ownValue` on the way to `readGated`, kept as read — and `planDate` re-emits the new
civil date carrying the carried value's time and offset when it had one.

The raw value is kept beside the parsed reading rather than folded into it: making
`readDate` return a `{ date, suffix }` pair would change the type every roadmap and
timeline reader destructures, to serve one writer. `CivilDate` stays what the placement
rules are stated in — no time, no zone, the same cell on every device.

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
- **The pointer is converted before `dayAt` sees it.** `dayAt` takes an offset from the
  window's first day; the drag adapter reports a **viewport** `clientX`. The view
  subtracts the *track's* bounding rect — the days area, so the sticky lead column is
  excluded by construction rather than by a constant that has to stay in step with the
  CSS. One subtraction and no scroll term: a bounding rect already moves with the
  scroll, and adding `scrollLeft` on top would double-count the pan. Untranslated, the
  preview and the write would both be off by the pane's position plus the scroll — a
  drop over one day scheduling another, which is a correctness bug wearing a rendering
  bug's clothes. The test drives a panned grid at a nonzero viewport offset, since a
  fixture at origin with no scroll cannot fail this.
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
  `RoadmapSnapshot` returns the scroller element, `restoreScroll` takes its horizontal
  target separately from its vertical one — falling back to the pane where there is no
  inner scroller, which is every other projection — and the opening centre, the
  preserved offset across a zoom change, and jump-to-today all address that one
  element. Horizontal and vertical stop being the same element here, and the
  signature says so rather than each caller remembering.
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
the dated axis. `CollapseSnapshot` gains `zoom`, validated against the three scale ids
exactly as `axis` is validated against `AXIS_VALUES` — a per-screen working position, in
the store where collapse state already lives, never in the `.base`. The narrow-pane rule
is a container query in `styles/timeline.css` collapsing the shelf to its labelled count,
its header becoming the control that reopens it: an unplaced result may lose its card,
never its existence.

**Moving the scroller inward is a stylesheet change, not only a code one.** The pane is
the horizontal scroller today because `styles/roadmap.css` puts `overflow-x: auto` on
`.pbl-roadmap-mode .pbl-tree` while `.pbl-roadmap` is `min-width: max-content` and
`.pbl-timeline` is `width: max-content`. Adding an inner scroller without touching those
gives **two** horizontal scrollers nested — the containment guarantee broken by the change
meant to keep it. So the dated axis stops the pane overflowing sideways and stops the
frame demanding `max-content`, while the timeline itself takes `overflow-x`. The rules
have to be axis-specific and the only class today is `pbl-roadmap-mode`, which both axes
wear: an axis class is toggled beside it in `backlogView.ts`, where the mode class already
is and where the axis is already known. A `:has()` selector would need no new state and is
the reason to mention it — but it is the clever answer to a question the boring one
already closes, and it raises specificity in a stylesheet whose ordering is documented as
load-bearing.

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

The datetime shape preservation gets a test in `test/domain/writePlanAxis.test.ts` that
is **watched failing first**: it is a live defect on the shipped menu path, and watching
it fail is the evidence the test asserts what it reads as. `test/domain/model.test.ts`
covers `rawStart` / `rawTarget` surviving the read the parsed triple discards.

A new `test/view/timelineDrag.test.ts` drives the gestures — the shelf drop, the body
slide, both end grips, the clamp at equal, the bar-to-shelf removal, the drag that ends
nowhere, the marker on a start-only axis offering no grip, and the one-ended bar whose
body slide leaves its open end open — every pointer case driven against a **panned grid
at a nonzero viewport offset**, because a fixture at the origin with no scroll passes
whether or not the pointer is converted at all. The clamp gets both sides of its condition: two
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
- **That exactly one thing scrolls sideways.** jsdom computes no layout, so nested
  scrollers are invisible to it: a test can assert which element carries the class and
  never that the pane stopped overflowing. This is the one place in the increment where
  the check genuinely stops short of the claim, so the claim is the smoke note's.
- The narrow-pane shelf compaction, and whether anything clips under the header in an
  embedded base.
- The today line and jump-to-today from a scrolled position.

`npm run test-build` bundles into this repository's own `.obsidian/plugins/`, and
`docs/Product Backlog.base` is a real backlog with a real milestone on it — the plugin
displaying its own register is the smoke test.
