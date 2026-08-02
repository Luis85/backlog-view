---
type: PBI
parent: "[[Scheduling work]]"
order: 10
status: Open
priority: P2
created: 2026-08-01
due: 2026-09-10
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
| **Guarantee** | What a drop writes is exactly what its target means: the configured date properties, within the item's own lane — plus the reparent, in the same one batch, when the drop lands in another lane — one undo either way, and a drop nowhere meaningful writes nothing. |

**Main flow**

1. The user drags a shelf card over the grid; the cell under the pointer highlights and
   shows the dates it means.
2. The drop writes start and target spanning that one cell — its first day and its
   last, the zoom's unit read as whole days, the default-length rule — in one batch.
3. The item leaves the shelf and renders as a bar on the write's own refresh.
4. Dragging a bar onto the shelf removes the configured date keys in one batch:
   unscheduled is a state a note returns to, not a pair of blank strings. Where the
   item renders next follows the placement rules — the shelf for a wholly dateless
   subtree, an inferred bar where descendants still supply dates — and the indicator
   says which before the release: clearing a parent's own dates hands its span back
   to the rollup, the date-side mirror of clearing a parent link to hand structure
   back to folder inference.

**Extensions**

- **1a — the pointer leaves both grid and shelf.** The drag ends nowhere: no write,
  indicators clear — the tree's own no-op rule, and the undo slot is not consumed.
- **2a — the drop would write to a note the Base excluded.** It cannot begin: a context
  row is never on the shelf and never draggable, and the gate refuses whole any batch
  naming one — the axis's writes state this once, here.
- **2b — a configured date property collides with a key the plugin owns.** The collision
  is a configuration problem and the gate blocks writes until it is fixed — the stamps'
  rule ([[Stamp when work starts and finishes]]), which these properties join.
- **2c — only one date property is configured.** The drop writes the one it has,
  anchored at the end its kind means — a start takes the cell's first day, a target its
  last, the deadline reading the ecosystem's vocabulary already gives those names — a
  point placement rendered as the open-ended bar a single date makes
  ([[Bars from two dates]]). Nothing is ever written to an unconfigured key — the state
  write's rule, which the date writes join.
- **2d — lanes are on and the drop lands in another lane's row.** The reparent rides the
  same batch as the dates — the combined write [[Lanes on the roadmap]] specifies — one
  gate, one undo, and one notice if the destination leaves the filter.
- **2e — the dragged item is a marker.** A milestone takes the **target alone**, anchored
  where a target's kind already anchors it — the cell's last day — and no start is written
  however many date properties are configured; a milestone dropped back on the shelf loses
  that key alone, leaving any stale start it carries untouched. The same narrowing as 2c,
  chosen by the type rather than by the configuration, because the type states *point* as
  strongly as a missing key does ([[Milestones as their own type]]). Writing the pair here
  would hand a deadline a duration by gesture that the row's own entry refuses to give it.
  Where 2c's one configured key is the **start**, the two rules meet on nothing: the target
  has no key to receive the write and the start is one this type may not touch, so a marker
  offers no grip at all there — absent, not offered and then refused, since a gesture whose
  only possible batch is empty must not begin. Its card stays on the shelf until a target
  property is configured.
- **4a — the note carries transition stamps.** Untouched. Plan and record are different
  keys, deliberately: unscheduling a note does not unhappen its history, and no
  scheduling write may ever reach the stamped keys.
- **4b — undo after an unschedule.** The inverse restores the removed keys with their
  values — key removal is a first-class restorable write, exactly as the parent key's
  removal already is.

## Acceptance criteria

- Shelf to grid writes exactly the configured date properties — both, spanning the
  drop cell from its first day to its last, or the single one configured anchored at
  the end its kind means: first day for a start, last day for a target — one batch,
  one undo; the highlight states the dates before the drop commits them, and nothing
  is ever written to an unconfigured key. A drop into another lane's row carries the
  reparent in the same batch ([[Lanes on the roadmap]]).
- A marker is target-only on both gestures: dropped on the grid it takes the target
  anchored at the cell's last day and gains no start, and dropped back on the shelf it
  loses the target key alone, whatever else the note carries
  ([[Milestones as their own type]]). With no target property configured it offers no grip
  at all — the drop that could only write nothing is never begun.
- Grid to shelf removes the configured date keys — never blanks them — and undo
  restores them. Where the item renders next follows the placement rules — the shelf
  only when its whole subtree is dateless, an inferred bar otherwise — and the drop
  indicator says which before release; the write is real either way, so it rightly
  takes the undo slot.
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
