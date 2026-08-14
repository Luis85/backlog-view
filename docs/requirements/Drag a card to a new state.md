---
type: PBI
parent: "[[Moving cards]]"
order: 10
status: Done
priority: P1
created: 2026-08-01
closed: 2026-08-02
files:
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/view/writeGate.ts
  - src/view/interactions/cardDrag.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Drag a card to a new state

**As** someone moving work along, **I want** to drag a card into the next column,
**so that** advancing an item is the gesture I already know rather than an edit to a
note's frontmatter.

Drop a card on a column and the state property is written — the whole interaction is
one `ItemWrite.state` batch through `applySafely`. The value written is the configured
string, exactly: one community Bases board writes a slugified column name into
frontmatter, which is the vocabulary-corrupting class of bug the single write boundary
exists to make impossible. The drag engine is decided:
[[Pragmatic drag and drop for the board]].

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a card and dropping it on a column |
| **Preconditions** | Board mode is on; the dragged card is one of the Base's own results |
| **Guarantee** | The value written is the configured string, byte for byte, and it rides the one write gate — so a board move is exactly as safe, and exactly as undoable, as the state chip's write. |

**Main flow**

1. The user picks up a card.
2. The column under the pointer highlights: the whole column is the target, so the signal
   is the highlight and there is no between-cards indicator.
3. The user drops.
4. The view plans one `ItemWrite.state` batch and applies it through `applySafely` —
   config problems block it, and the inverse is captured as it lands.
5. The board refreshes with the card in its new column, and undo restores the previous
   state.

**Extensions**

- **2a — the target is the no-state column.** The drop removes the key rather than writing
  an empty string — a remove-state write mirroring `removeParentKey` — and undo puts the
  value back. Absence is already first-class in the restore machinery.
- **2b — there is no between to indicate.** Within-column order is derived, not stored, so
  a between-cards indicator would promise a rank the board does not keep. See
  [[Board order is derived not stored]].
- **3a — the drop is on the card's own column.** No write at all, and the undo slot keeps
  the batch it had. A batch that writes nothing must not cost the user their undo of the
  change before it.
- **3b — the target column is over its WIP limit.** The drop is accepted and the column
  signals. Limits are signals, never refusals ([[WIP limits]]).
- **4a — the config has problems.** The gate blocks the batch, as it blocks every other
  write. A board move is not a new write path and gets no exception.
- **4b — the card is a context card.** It is never draggable, so this never arises from the
  UI — and the invariant test that drives every entry point against context rows covers
  the board's paths too, so it cannot arise from a new one either.

## Acceptance criteria

- Dropping on a column writes that state's canonical value; nothing transforms it on
  the way to disk.
- The write rides the gate: config problems block it, the inverse is captured, and
  undo restores the previous state. Cards are results by construction, so the
  outside-filter refusal never fires — and the invariant test that drives every entry
  point against context rows covers the board's too.
- Dropping a card on its own column is a no-op: no write, and the undo slot keeps the
  batch it had.
- Dropping on the no-state column removes the key — a remove-state write mirroring
  `removeParentKey` — and undo puts the value back; absence is already first-class in
  the restore machinery.
- The drop signal is the column highlight. There is no between-cards indicator,
  because there is no between: see [[Board order is derived not stored]].
- An over-limit column accepts the drop and signals.

## Where it lives

The plan is `computeStateWrites` in `src/domain/writePlan.ts`, beside the drop plans
it already builds — renamed from `computeStateDropWrites` once the date stamps made it
the one planner every state-changing input uses ([[Stamp when work starts and finishes]]); the remove-state write (`removeStateKey`) joined
`removeParentKey` in `src/storage/frontmatter.ts`, the only module that may write; the
batch goes through the same `applySafely` — reached via `performBoardMove` in
`src/view/cardMoves.ts` (`CardMoveController`, the card-move plumbing extracted from
`src/view/backlogView.ts` when it hit its line cap a second time; `src/view/writeGate.ts`
was the first such extraction, [[Split the view dispatch hub]]) — which is now the one
method all three inputs land on
([[Keyboard, menu and touch]]), so a drop cannot plan a different write than the key
or the menu that mean the same thing, and it is where the move announces itself; and
the gesture itself is `src/view/interactions/cardDrag.ts`, wiring the Pragmatic
element adapter with edge auto-scroll and owning the live region the announcement
speaks through. Driven by synthetic drag events in
`test/view/boardMoves.test.ts` (helpers in `test/helpers/dnd.ts`), the storage
round-trip in `test/storage/frontmatter.test.ts`, and the context-row invariant across
the board's entry points in `test/view/contextCardWrites.test.ts`.

The drag layer is shared with the roadmap since [[Moving between horizons]] — a card
is the same card in both projections and so is the gesture, so what a drop MEANS is
the caller's callback and everything else is one controller
([[Share the card drag between projections]]). Nothing about a board move changed:
`performBoardMove` still plans the same batch, and the drop-over class it highlights
with is now the one every card target wears.

That technicality is gone: [[WIP limits]] ships the limits, and
`test/view/columnAgreements.test.ts` drives the drop, the Alt+arrow and the menu each
into a column already over one, then checks the column still says it is over — the
move happening and the board reporting it are one criterion, not two.
