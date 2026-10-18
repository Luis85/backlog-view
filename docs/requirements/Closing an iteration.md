---
type: PBI
parent: "[[An Iterations board]]"
order: 50
status: Active
priority: ""
created: 2026-10-18
source: user request
started: 2026-10-18
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# Closing an iteration

**As** someone running sprints, **I want** to close an iteration from that iteration's own
board, and carry what is not finished into the next one, **so that** ending a sprint is
one decision rather than a state edit on the iteration note and one `Set iteration` per
leftover card.

"Closed" is the iteration's **own state**: the first of the product's done values, written
through the state property the board's columns already read. There is no second property
and no new vocabulary — an iteration is a marker, and a marker's workflow is the product's
([[An iteration is a note of its own]]). That also gives the iteration a `finished` stamp,
because a state change into a done value carries one.

The carry is the same plan `Set iteration` makes: the link and the next iteration's two
dates, per item ([[An iteration's timeframe schedules its items]]). The close and every
carry ride **one batch**, so the one undo slot takes the whole close back.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, at the end of a sprint |
| **Trigger** | `Close iteration` in the iteration board's header |
| **Preconditions** | The board is scoped to an iteration. The state property is configured and at least one done value is declared — without them there is no state to close with, and the control is not drawn |
| **Guarantee** | One batch through `applySafely`: the iteration's state, and — when the reader picks the carry — the link and dates of each unfinished member. Nothing outside the base's results is written. One undo takes all of it back. |

**Main flow**

1. The header draws `Close iteration` beside the Daily/Planning switch.
2. Pressing it opens a confirmation. It names the iteration, counts the members that are
   not Resolved, and lists each one as a button that opens the note, so a reader can check
   them before answering.
3. With a later iteration to carry into, the confirmation offers two answers: `Close and
   move to <next>`, and `Close only`.
4. Confirming writes the batch, and a notice says what was closed and how many items moved
   where.
5. The header now draws a static `Closed` mark where the button stood.

**Extensions**

- **2a — every member is Resolved.** The confirmation says so and offers `Close iteration`
  alone: there is nothing to carry.
- **3a — there is no later iteration.** The confirmation says the work stays in this one
  and offers `Close iteration` alone. Creating the next sprint first is
  [[Creating an iteration from the board]].
- **3b — which iteration is "next".** The earliest dated, open iteration that sorts after
  this one — by target, then start, then path, the order `previousIteration` already
  keeps — so the create dialog and the close never disagree about which sprint follows
  which. A closed iteration is never offered: carrying work into a sprint that is already
  over hides it again. An iteration with no target date has no successor, because nothing
  says when it ends.
- **4a — "unfinished".** A RESULT the board does not draw in its Resolved column — the
  board's own bucket reading, so what moves is exactly what the reader sees as open or in
  progress. A context row is never written, whatever it holds.
- **4b — Cancel, Escape or the close box.** Nothing is written.

## Acceptance criteria

- The header draws `Close iteration` on an open iteration, a static `Closed` mark on a
  closed one, and nothing with no state property or no done value.
- The confirmation lists the unfinished members and only those.
- `Close and move to <next>` writes the iteration's done state and moves each unfinished
  member to the next iteration with its dates, in one batch that one undo takes back.
- `Close only` writes the iteration's state and nothing else.
- With no later iteration, the confirmation says the work stays and offers no carry.
- The next iteration skips a closed one and is null after an undated one.

## Where it lives

The rules are in `src/domain/iterations.ts` beside the create dialog's own derivation:
`isIterationClosed`, `followingIteration`, `unfinishedMembers` and
`iterationCloseWrites`, which composes `computeStateWrites` and `computeIterationWrites`
rather than planning a write of its own. The control and its confirmation are
`src/view/render/iterationClose.ts`, drawn by `renderIterationHeader` in
`src/view/render/iterationHeader.ts`. The two-answer confirmation is the `alternative`
option of `openConfirm` in `src/ui/confirmDialog.ts`.

Not built: the scope picker still lists a closed iteration, and the shelf and `Set
iteration` still offer one. Hiding closed sprints is its own decision, and nobody has
asked for it yet.

Still owed: a live-vault look at the header with the button in a narrow pane, and a
screen reader on the two-answer confirmation.
