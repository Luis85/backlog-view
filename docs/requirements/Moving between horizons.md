---
type: PBI
parent: "[[The horizon board]]"
order: 20
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
---

# Moving between horizons

**As** someone whose confidence just changed, **I want** to drag an item into another
bucket, **so that** the plan keeps up with what I now know at the cost of one gesture.

Items move between horizons as discovery raises or lowers confidence — that movement is
the format's whole point, and it is exactly the write shape the board already
specifies for states ([[Drag a card to a new state]]): one declared value, into one
user-named property, on the note's own frontmatter, through the one gate, taken back by
one undo.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dropping a card in another bucket |
| **Preconditions** | Roadmap mode is on with the horizon axis |
| **Guarantee** | A bucket move writes exactly one value to the note's own horizon property, through the same gate as every write, undoable as one batch; a refused batch changes nothing anywhere. |

**Main flow**

1. The user drags a card to another bucket.
2. The view plans the one write: the target bucket's value into the horizon property.
3. The gate applies it, and the card renders in its new bucket on the write's own
   refresh.
4. Undo takes it back as one batch.

**Extensions**

- **1a — the drop lands on the bucket the card is already in.** No write is planned, and
  the undo slot is not consumed — a no-op must not cost the one change that can be taken
  back.
- **1b — the user cannot drag.** The context menu offers the horizons as a set-action and
  the keyboard offers pick-up and move ([[Keyboard and menu on the roadmap]]); both write
  the identical batch.
- **1c — the drag starts on the shelf.** The same single write: entering the vocabulary
  is the triage gesture, and the shelf is where untriaged items wait for exactly it.
- **1d — the drop lands on the shelf.** The horizon key is removed, not blanked: the item
  returns to "not yet triaged", whereas an empty value would render as an unexpected
  bucket named nothing. Removal is a first-class write with a first-class inverse, as the
  parent key's removal already is.
- **2a — the target bucket is one named by an observed, undeclared value.** The move
  writes that value: observed vocabulary is writable vocabulary, the board's own rule for
  states — and, as with states, context rows never contribute to what counts as observed.
- **2b — the card is outside the Base's filter.** There is no such card: context rows are
  never draggable and never write targets, and any batch naming one is refused whole by
  the gate.
- **3a — the write is refused** (configuration problems, or a batch naming an excluded
  note). Refused whole and loudly; nothing half-moves, and the board renders what the
  notes still say.

## Acceptance criteria

- A bucket move is one write to the horizon property, through the gate, one undo.
- A same-bucket drop writes nothing and keeps the previous undo.
- Shelf to bucket writes the value; bucket to shelf removes the key rather than
  blanking it, and undo restores it.
- Writable vocabulary is declared plus observed-on-results; context rows contribute
  nothing to it and can never be moved or written.
- Menu and keyboard produce the identical batch the drag produces.
- A refused batch is refused whole, loudly, changing nothing.

## Where it lives

**Nothing yet — this note is design.** The plan is a value write beside the state write
in `src/domain/writePlan.ts`; the application, the key removal and its captured inverse
are `src/storage/frontmatter.ts`; the gate it all runs through is the one in
`src/view/backlogView.ts`.
