---
type: PBI
parent: "[[The horizon board]]"
order: 20
status: Active
priority: P1
created: 2026-08-01
files:
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/outcome.ts
  - src/view/render/roadmap.ts
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

- **1a — the drop lands where the card already is.** Same bucket, same lane: no write is
  planned, and the undo slot is not consumed — a no-op must not cost the one change that
  can be taken back. A same-bucket drop across lanes is not a no-op: the reparent is
  planned alone ([[Lanes on the roadmap]]), with no redundant horizon write riding
  along.
- **1b — the user cannot drag.** The context menu offers the horizons as a set-action and
  the keyboard offers lift and move ([[Keyboard and menu on the roadmap]]); both write
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
- **3b — the new value takes the note outside the Base's filter.** The write stands —
  it is exactly what the user asked — and the card leaves the view on the refresh,
  announced with a notice naming what happened and offering to open the note: the
  answer [[New cards in place]] already gives a card created into a state the base
  excludes. Undo still takes it back, the boundary rule the epic states for every
  write.

## Acceptance criteria

- A bucket move is one write to the horizon property, through the gate, one undo.
- A drop that changes neither bucket nor lane writes nothing and keeps the previous
  undo; a same-bucket drop across lanes plans the reparent alone, with no redundant
  horizon write.
- Shelf to bucket writes the value; bucket to shelf removes the key rather than
  blanking it, and undo restores it.
- Writable vocabulary is declared plus observed-on-results; context rows contribute
  nothing to it and can never be moved or written.
- Menu and keyboard produce the identical batch the drag produces.
- A refused batch is refused whole, loudly, changing nothing.
- A move whose value takes the note outside the Base's filter applies, is announced
  with an open path, and stays undoable — the card leaving the view is the filter
  speaking, not the write failing.

## Where it lives

Built. The plan is `computeHorizonDropWrites` in `src/domain/writePlan.ts`, written
beside `computeStateDropWrites` and shaped like it — one declared value, or
`removeHorizonKey` for the shelf, which joined `removeStateKey` and `removeParentKey`
in `src/storage/frontmatter.ts`, the only module that may write and the one that
captures the removal's inverse as it lands. The batch goes through the same
`applySafely` in `src/view/backlogView.ts`, reached via `performHorizonMove` — the one
method all three inputs land on, so a drop cannot plan a different write than the key
or the menu that mean the same thing, and the one place a move announces itself. The
gesture is `src/view/interactions/cardDrag.ts`, the drag layer both card projections
now share ([[Share the card drag between projections]]); the buckets and the shelf that
receive it are `src/view/render/roadmap.ts`; `bucketLabelFor` in `src/domain/roadmap.ts`
is what names a placement out loud, so an announcement can only say what is on screen.

The two non-pointer paths are the board's, carried over: Alt+Left/Right in
`src/view/interactions/keyboard.ts` steps one placement along a ladder that leads with
the shelf — the roadmap's no-state column, which is also where the specified lift
enters the axis from — and `Set horizon` in `src/view/interactions/menu.ts` offers the
rendered buckets plus the shelf, read off the render exactly as the board's `Set state`
reads its columns. Driven by synthetic drag events, keys and menus in
`test/view/roadmapMoves.test.ts` (fixtures in `test/helpers/roadmap.ts`, the gesture in
`test/helpers/dnd.ts`), the plan in `test/domain/roadmap.test.ts`, the storage
round-trip in `test/storage/frontmatter.test.ts`, and the context-row invariant across
every roadmap entry point in `test/view/contextCardWrites.test.ts`.

Extension 3b — a move whose new value takes the note out of the Base's own results —
is `src/view/interactions/outcome.ts`. It is detected by OUTCOME rather than
predicted, because a Bases filter is opaque to this view: the move registers the note,
and the data pass that write triggers answers for whether it still shows, reporting
with a notice that carries the way back to it. Deliberately answered from the data pass
and not from every render, or a quick filter the user typed would be blamed on the
write. It sits on `applyCardMove`, so a board move that writes a state its own base
excludes is reported by the same code — the hazard is one hazard, and a rule that held
for one projection and not the other is the asymmetry this register keeps finding.

Five rules govern it, none of them stated in this note, all five found by review rather
than by design: the watch is armed BEFORE the write (the answering pass can land inside
the write's own await), resolved by handle so a failed second move cannot drop an
outstanding first, answered from the data pass alone and with the quick filter out of
the verdict, held as a list whose oldest entry is the only one a pass may retire on
"still there", and reported with the cause the view supplies rather than a guess.

**One known limit remains, and is deliberate**: that last rule assumes every data pass
belongs to a queued write, and passes also arrive from an edit in another pane. One of
those between a move and its own response retires the watch early, and the move then
leaves the base silently. Nothing in a result set says which write it was computed
after, so closing it is a design decision rather than a narrowing. That, and the choice
between writing these rules down and moving the mechanism to the note that owns it, are
[[The outcome report was built from one sentence]].

Still Active, not Done, on two honest counts. The lift — Space, arrows, Space, Escape —
is [[Keyboard and menu on the roadmap]]'s, and this note's 1b is met by the shortcut and
the menu until it lands. And 1a's lane clause cannot be exercised at all: with
[[Lanes on the roadmap]] unbuilt there is no second dimension for a same-bucket drop to
cross, so "the reparent is planned alone" is specified and untested. What a live vault
still has to confirm is the drag itself — jsdom dispatches the events but paints
nothing, so the bucket highlight, the empty shelf appearing mid-drag and the drop
feeling like a drop are [[Smoke test the visual changes]]'s to check.
