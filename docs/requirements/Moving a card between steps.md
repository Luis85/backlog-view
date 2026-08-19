---
type: PBI
parent: "[[Moving a card on the map]]"
order: 10
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Moving a card between steps

**As** someone who has just understood the journey better, **I want** to move a card to another
step, **so that** the map and the tree agree without me editing a note by hand.

A horizontal move is a re-parent: the card's `parent` becomes the target step. One host method
plans it, and the drag, the keyboard and the menu all call that method — the register's rule
for a card move, not a new arrangement for this projection.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dropping a card in another step's column, or picking the step from the keyboard or the context menu |
| **Preconditions** | The storymap view is open and both the card and the target step are results |
| **Guarantee** | A step move writes exactly one parent and one order to the card's own frontmatter, through the same gate as every write, undoable as one batch. A refused batch changes nothing anywhere, and the card's other properties — its release above all — are untouched. |

**Main flow**

1. The user drops a card in another step's column.
2. The one host method plans the batch: the new `parent` link, and one `order` among the target
   step's cards.
3. The gate applies it, and the card renders in its new column on the write's own refresh.
4. The move is announced once, from that method.
5. Undo takes it back as one batch.

**Extensions**

- **1a — the drop lands in the column the card is already in.** No write is planned and the
  undo slot is not consumed. A no-op must not cost the one change that can be taken back.
- **1b — the user cannot drag.** The keyboard offers lift and move, and the context menu offers
  the steps as a set-action; both call the same method and write the identical batch.
- **1c — the target step is outside the base's filter.** The move is withheld and the control
  is not offered, because a context row parents what is drawn beneath it and is never a write
  target.
- **1d — the card itself is outside the filter.** No move is offered at all, and a batch that
  named it would be refused whole rather than filtered down to the rest.
- **2a — the vocabulary that names the move disappears with the refresh.** The step's name is
  read before the await, because the batch's own refresh rebuilds the map before it resolves
  and the column just vacated may be gone with its last card.
- **2b — the target step has no cards yet.** The card takes the first order in an empty sibling
  set.
- **3a — the configuration gate refuses.** Nothing is written and the reason is shown.

## Acceptance criteria

- The drag, the keyboard and the menu produce byte-identical batches, asserted against each
  other rather than each against an expectation.
- The batch names `parent` and `order` and nothing else — the card's release, state, type and
  every other property are unchanged, checked field by field.
- A move onto a context-row step is not offered, and a batch constructed to target one is
  refused whole.
- A drop in the card's current column plans nothing and leaves the undo slot untouched.
- The announcement names the step the card moved to even when that step's previous column
  became empty in the same refresh.

## Where it lives

`applyCardMove` in `src/view/cardMoves.ts` is the shared half, including the rule that the
naming vocabulary is captured before the await. The one host method is declared in
`src/view/host.ts` and delegated in `src/view/backlogView.ts`; its three inputs are
`src/view/interactions/cardDrag.ts`, `src/view/interactions/keyboard.ts` and
`src/view/interactions/menu.ts`. Targets come from `src/domain/dropTargets.ts`, the batch from
`src/domain/writePlan.ts` and `src/view/interactions/structure.ts`, and the gate from
`src/view/writeGate.ts`.
