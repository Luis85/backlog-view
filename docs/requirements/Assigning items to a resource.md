---
type: PBI
parent: "[[The resource timeline]]"
order: 20
status: Open
created: 2026-08-13
source: user request
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
  Alt+Left/Right, both write the identical batch.
- **1c — the drag starts on the shelf.** The same single write: entering a row is the
  same triage gesture the shelf already exists for.
- **1d — the drop lands on the shelf.** The assignee key is removed, not blanked — the
  item returns to unassigned, rather than rendering in a row named nothing.
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

## Acceptance criteria

- A resource move is one write to the assignee property, through the gate, one undo.
- A drop that lands in the bar's own row writes nothing and keeps the previous undo.
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

## Where it lives

Unbuilt. The write is already planned — `computeAssigneeWrites` in
`src/domain/writePlan.ts`, built for [[Setting the assignee on an item]], needs no
change. What this PBI would add is the orchestration around it: a `performResourceMove`
beside `performHorizonMove` in `src/view/cardMoves.ts` (`CardMoveController`), a resource
ladder for Alt+arrow in `src/view/interactions/keyboard.ts` mirroring `horizonStops`, a
`CreatePlacement.assignee` field threaded through `src/view/interactions/create.ts` the
way `horizon` already is, and routing the row menu's Set assignee
(`src/view/interactions/labels.ts`) through `performResourceMove` while this axis is
active — the way `chooseHorizon` in `src/view/interactions/plan.ts` already branches by
mode.
