---
type: PBI
parent: "[[Scheduling work]]"
order: 10
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/writePlan.ts
  - src/view/interactions/dragDrop.ts
  - src/storage/frontmatter.ts
---

# Drag from the shelf to schedule

**As** someone turning backlog into plan, **I want** to drag an item from the shelf
onto the timeline, **so that** scheduling is the same gesture as planning anywhere else
in this view — and just as take-backable.

Dragging is the universal scheduling gesture — GitHub's roadmap sets dates by it, and
Aha!'s parking lot becomes a scheduled release the same way — and the drop writes a
span of one grid cell at the drop point, the trackers' default-length rule for items
that arrive with no duration of their own. That default is refined a second later by a
resize; what it never is, is silent: the cell under the pointer shows the dates before
the drop commits them. Dragging a bar back to the shelf is the inverse, and it removes
the keys rather than blanking them.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dropping a shelf item onto the timeline grid, or a bar onto the shelf |
| **Preconditions** | Roadmap mode is on with the timeline axis |
| **Guarantee** | The drop writes only the configured date properties of the dropped note — one batch, one undo — and a drop nowhere meaningful writes nothing. |

**Main flow**

1. The user drags a shelf card over the grid; the cell under the pointer highlights and
   shows the dates it means.
2. The drop writes start and target spanning that one cell — the zoom's unit, the
   default-length rule — in one batch.
3. The item leaves the shelf and renders as a bar on the write's own refresh.
4. Dragging a bar onto the shelf removes both date keys in one batch: unscheduled is a
   state a note returns to, not a pair of blank strings.

**Extensions**

- **1a — the pointer leaves both grid and shelf.** The drag ends nowhere: no write,
  indicators clear — the tree's own no-op rule, and the undo slot is not consumed.
- **2a — the drop would write to a note the Base excluded.** It cannot begin: a context
  row is never on the shelf and never draggable, and the gate refuses whole any batch
  naming one — the axis's writes state this once, here.
- **2b — a configured date property collides with a key the plugin owns.** The collision
  is a configuration problem and the gate blocks writes until it is fixed — the stamps'
  rule ([[Stamp when work starts and finishes]]), which these properties join.
- **2c — only one date property is configured.** The drop writes the one it has: a point
  placement at the cell, rendered as the open-ended bar a single date makes
  ([[Bars from two dates]]). Nothing is ever written to an unconfigured key — the state
  write's rule, which the date writes join.
- **4a — the note carries transition stamps.** Untouched. Plan and record are different
  keys, deliberately: unscheduling a note does not unhappen its history, and no
  scheduling write may ever reach the stamped keys.
- **4b — undo after an unschedule.** The inverse restores the removed keys with their
  values — key removal is a first-class restorable write, exactly as the parent key's
  removal already is.

## Acceptance criteria

- Shelf to grid writes exactly the configured date properties — both, spanning the
  drop cell at the current zoom, or the single one configured as a point placement —
  one batch, one undo; the highlight states the dates before the drop commits them,
  and nothing is ever written to an unconfigured key.
- Grid to shelf removes the configured date keys — never blanks them — and undo
  restores them.
- A drop nowhere meaningful writes nothing and keeps the previous undo.
- Context rows can never be scheduled or unscheduled: never shelved, never draggable,
  and any batch naming one is refused whole.
- Transition stamps and every other key the plugin owns stay untouched; a colliding
  date property gates writes like every other collision.

## Where it lives

**Nothing yet — this note is design.** The span-at-a-cell plan is a date write beside
the drop plans in `src/domain/writePlan.ts`; the gesture and its indicators extend
`src/view/interactions/dragDrop.ts`; the write, the key removal and their inverses are
`src/storage/frontmatter.ts`.
