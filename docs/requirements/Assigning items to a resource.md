---
type: PBI
parent: "[[The resource timeline]]"
order: 20
status: Active
created: 2026-08-13
source: user request
files:
  - src/domain/roadmap.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/view/host.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/labels.ts
  - src/view/render/barLabel.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/shelf.ts
  - src/view/render/timeline.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Assigning items to a resource

**As** someone whose plan just changed hands, **I want** to drag an item into a
resource's row, **so that** who is doing it stays as current as when it will happen, in
one gesture instead of two.

The write already exists: `computeAssigneeWrites` was built for
[[Setting the assignee on an item]] and plans exactly the value this move needs. What
this PBI adds is the orchestration around it — the same shape
[[Moving between horizons]] already gives the horizon axis, over the assignee property
instead.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dropping a card in another resource's row |
| **Preconditions** | Roadmap mode is on with the resources axis |
| **Guarantee** | A resource move writes exactly one value to the note's own assignee property, through the same gate as every write, undoable as one batch; a refused batch changes nothing anywhere. Dragging between rows changes only who the item is assigned to — its own dates are unchanged, the same separation moving a bar and re-triaging a card already keep elsewhere on this roadmap. |

**Main flow**

1. The user drags a bar into another resource's row, or onto the shelf.
2. The view plans the one write: the target resource's name into the assignee property,
   or its removal on the shelf.
3. The gate applies it, and the bar renders in its new row, at its own dates, on the
   write's own refresh.
4. Undo takes it back as one batch.

**Extensions**

- **1a — the drop lands in the row the bar is already in.** No write is planned, and the
  undo slot is not consumed.
- **1b — the user cannot drag.** The row menu's Set assignee, and a resource ladder for
  Alt+Up/Down, both write the identical batch — Up/Down because resources are ROWS,
  stacked vertically on the same calendar grid the dated axis draws, and Alt+Left/Right
  on that grid is already reserved: `horizonStops` in `src/view/interactions/keyboard.ts`
  answers null on the dated axis today specifically so a future scheduling gesture can
  claim Left/Right there without a stray shortcut already meaning something else.
  Resources sit ON that grid, so this is the axis where both a row change and a date
  change could plausibly want the same keys, and only one dimension can have them.
- **1c — the drag starts on the shelf.** The same single write: this is the same triage
  gesture the shelf already exists for, entering a row whenever the card also has a date
  to place it at — 3c below is the exception, where it does not.
- **1d — the drop lands on the shelf.** The assignee key is removed, not blanked — the
  item returns to unassigned, rather than rendering in a row named nothing.
- **1e — the drop lands on the resource the shelved card's assignee already names.**
  `computeAssigneeWrites` plans nothing, since the value would not change — the same
  test that makes 1a a no-op for an already-placed bar dropped on its own row. Reached
  from the shelf, though, 1a's own silence does not carry over: a bar that stays exactly
  where the cursor found it already answers the question, but a shelved card that stays
  shelved after a drop does not — nothing about the card told the user its assignee
  already matched the row. Announced anyway, the same way 3c announces a write that DOES
  land with no visible effect, even though here none lands at all: naming the resource
  already on the note and that a date is what is still missing. No undo slot is spent —
  there is nothing to take back.
- **2a — the target row is one named by an observed, undeclared resource.** The move
  writes that value: observed vocabulary is writable vocabulary, the same rule the
  horizon axis and the board already keep.
- **2b — the card is outside the Base's filter.** There is no such card: context rows
  are never draggable and never write targets, and any batch naming one is refused
  whole by the gate.
- **2c — the target row is named only by a logged absence, nobody assigned to it yet.**
  The move writes that value too: an absence puts a resource on screen the same as a
  declared or observed one does ([[Resource absences]] extension 4b), and nothing about
  how the row came to exist changes what dropping into it means.
- **3a — the write is refused** (configuration problems, or a batch naming an excluded
  note). Refused whole and loudly; nothing half-moves.
- **3b — the new value takes the note outside the Base's filter.** The write stands, the
  card leaves the view on the refresh, announced with a notice naming what happened and
  offering to open the note. Undo still takes it back.
- **3c — the card has an assignee but no date, so it stays shelved whichever resource it
  is dropped onto.** *(Reached by a DRAG only where the release could name no day —
  [[Scheduling inside a resource's row]] gives the same drop a date, so this is now the
  menu's, the keyboard's, and the case where the item's type has no writable end at all.)* ([[Showing a resources axis on the roadmap]] extension 3c — a row is
  who, a date is when, and this write only ever answers who). The write still lands —
  the assignee changes — but nothing visibly enters a row, so it is announced the same
  way 3b announces a write whose visible effect is not the obvious one: naming the
  resource now on the note and that a date is what is still missing to place it. Undo
  still takes the assignee back as one batch.

## Acceptance criteria

- A resource move is one write to the assignee property, through the gate, one undo.
- A drop that lands in the bar's own row writes nothing and keeps the previous undo.
- A drop from the shelf onto the resource the card's assignee already names also writes
  nothing and keeps the previous undo, but — unlike the bar case — is announced anyway,
  naming the resource and that a date is still missing, since a shelved card that stays
  shelved gives the user no other way to tell the drop landed on an unchanged value.
- Dragging between rows changes only the assignee; the bar's own dates never change as a
  side effect of which row it lands in.
- Shelf to row writes the resource's name; row to shelf removes the key rather than
  blanking it, and undo restores it.
- Writable vocabulary is the declared roster, observed-on-results, and any resource
  named only by a logged absence — every source that can put a row on screen; context
  rows contribute nothing to it and can never be moved or written.
- Menu and keyboard produce the identical batch the drag produces.
- A refused batch is refused whole, loudly, changing nothing.
- A move whose value takes the note outside the Base's filter applies, is announced with
  an open path, and stays undoable.
- A move onto a dateless card writes the assignee and stays shelved rather than silently
  claiming to enter a row; it is announced the same way an out-of-filter move is, and
  stays undoable.

## Where it lives

Built, apart from extension 3b (below). The plan needed no change at all —
`computeAssigneeWrites` in `src/domain/writePlan.ts` was built for
[[Setting the assignee on an item]] and already plans exactly this value, with the two
rules a move needs: nothing for a re-pick of the name the note holds, and a removal only
where there is a key to take away. What this PBI added is the orchestration.

`performResourceMove` in `src/view/cardMoves.ts` (`CardMoveController`) is the one method
every input lands on, so a drop cannot plan a different write than the key or the menu
that mean the same thing, and it is the one place a move is announced. It captures both
pre-write facts before the batch, which is not optional here: the batch's own refresh
rebuilds `host.roadmap` before the await resolves, so the row just vacated may be gone
with its last bar. Naming the two ends is `src/domain/roadmap.ts`'s `resourceSource` /
`resourcePlacementLabel` / `resourceTargetLabel`, the shape `horizonSource` /
`placementLabel` / `targetLabel` already has — with one deliberate difference stated at
`resourceLabel`: this axis mints a row only where a BAR lands, so a name no row draws is
still a name the note states, and reading it as the shelf (which the horizon axis is
right to do, since every result's value mints a bucket there) would report "from
Unplaced" about a note that plainly says Alice. `announceResourceMove` in
`src/view/interactions/cardDrag.ts` says it, in the live region every card move already
shares.

The gesture is the drag layer both card projections share. A resource's band is wired
**element by element** — the header, each bar row, each absence stretch, each excluded
note's row — because there is no container to wire: every line is a flat sibling
positioned against one shared day grid. The grid REPORTS which element belongs to which
row (`TimelineDrawing.laneElement`) and `renderGridAxis` in `src/view/render/roadmap.ts`
does the wiring after the pass, since a drop needs geometry the pass has not finished
producing. The cost is that the highlight is the element under the pointer rather than the
whole band. A wrapper per row would fix that and would put a box between every row and the
sticky lead column the geometry rests on; either way the highlight is a live-vault check.

**A bar carried no date hold when this PBI shipped, and does now** — a release on a band
answers both questions since [[Scheduling inside a resource's row]], and the paragraph
above said the opposite until 2026-08-14. What is unchanged is this note's own guarantee:
dragging between rows changes only who the item is assigned to. It survives because the
row half and the date half are planned from different facts — the row from where the
release landed, the dates from how far the pointer travelled — so a purely vertical drag
still displaces nothing and still writes one value. What changed is that a drag which
*also* moves sideways is no longer silently discarding the sideways part.

**One thing had to be un-drawn for any of it to work**, and it is the finding worth
keeping — and still true now that the rows read a position too, because each row reads it
for ITSELF. `.pbl-timeline-drop` — the dated axis's one positional target — takes pointer
events across the whole day area while a drag is live, so left in place it would swallow
every drop the rows are the target for. It is therefore drawn only where a POSITION on it
means something. That exposed the one decoration it used to cover: `.pbl-today` is the
only absolutely positioned mark in the content layer without `pointer-events: none`,
because its tooltip is the only place its date is written, so `.pbl-timeline-flat` (on the
content element) turns that off for this axis alone. Every other layer already opted out,
for the reason `.pbl-milestone-line`'s own comment in `styles/timeline.css` records: a 2px
dead strip through every row. What jsdom can check is that the overlay is absent and the
class is present; that its presence would have swallowed the drop is a live-vault check,
since nothing here hit-tests.

The shelf is `shelfRemoval`'s `'resources'` branch in `src/view/render/shelf.ts`, which
went from accepting nothing to the horizon axis's own removal over a different key —
including its re-drop rule, since a card already drawn there can still carry a name with
no date to sit beside. It accepts everything but a GRIP now
([[Scheduling inside a resource's row]] extension 3c): a bar arriving by either body hold
un-assigns and keeps its dates, while an end dragged onto the strip is a resize that
overshot and is refused, the dated axis's own rule. The keyboard is `handleResourceMoveKey` in
`src/view/interactions/keyboard.ts`, on **Alt+Up/Down**: resources are rows, and
Left/Right on this grid is reserved for a future scheduling gesture, which is what
`horizonStops` answering null on the dated axis has been holding open. The two ladders
share `ladderStep` — the edges hold rather than wrap, and the `offLadder` case both need —
and nothing else, because the direction is exactly what has to differ; `offLadder` is
reached differently here, by a card naming a resource no row draws rather than by an empty
key. `Set assignee` in `src/view/interactions/labels.ts` leads with the DRAWN rows and
routes its pick through `chooseAssignee`, the way `chooseHorizon` in
`src/view/interactions/plan.ts` already branches by mode. Leading with the rows is not
tidiness: a declared-and-empty row has a drop target and appears on no result, so a list
built from the observed names alone would leave the menu the one input to this move that
goes quiet.

`CreatePlacement.assignee` was already built — threaded through
`src/view/interactions/create.ts` and `createBacklogItem` by
[[Showing a resources axis on the roadmap]], whose row New button writes it. This note
claimed otherwise until 2026-08-13; the claim is corrected rather than kept, because a
specification promising an implementer a call they will not find is the same defect the
root `CLAUDE.md` records a guide making once already.

`src/view/render/barLabel.ts` is not this PBI's feature. It is the bar's title and the
mark width it clears, moved out of `src/view/render/timeline.ts` when that file hit its
400-line budget and this increment needed eight lines in it — the same move `laneEntries`
made into `src/view/render/lanes.ts`, for the same reason.

Driven by synthetic drags, keys and menus in `test/view/resourceMoves.test.ts` (the vault
is `test/helpers/resources.ts`, shared with the axis's own suite so the two cannot
describe different axes), by `test/view/resourceLanes.test.ts` for what the axis draws,
and by the resources block of `test/view/contextCardWrites.test.ts`, which now asks this
axis the same three context-row questions as the board's and the horizon axis's.

**Extension 3b is NOT built**, exactly as it is not for [[Moving between horizons]]: a
move whose new value takes the note out of the Base's own results applies, and the card
leaves on the refresh in silence. The mechanism belongs to [[New cards in place]], it was
built once from one sentence and taken back out, and
[[The outcome report was built from one sentence]] records the open question — nothing
correlates a Bases pass with a write — that has to be answered before it is built again.
That is why this note is Active rather than Done.

**Extension 2c is specified and unexercisable.** A row named only by a logged absence
needs [[Resource absences]], which is unbuilt, so nothing can put such a row on screen for
a drop to land in. It needs no case of its own when that lands: `laneDrop` writes
`lane.name` whatever minted the row, so how a row came to exist has never been a question
the drop asks. Recorded rather than tested against a fixture that cannot exist.

What a live vault still owes: the band highlight under a dragged bar (per element, not per
band), that the absent overlay really does let a drop through where it used to sit, whether
a screen reader announces a move whose card visibly does not move, and how a row being
dropped into reads beside its neighbours. jsdom dispatches the events and paints nothing.
