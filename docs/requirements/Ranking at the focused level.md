---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 50
status: Done
started: ""
finished: ""
closed: 2026-08-30
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Ranking at the focused level

**As** someone planning at one altitude, **I want** to drag the rows of a focused backlog
into the order I want them in, **so that** the Features backlog or the PBI backlog is a
priority list I made rather than an accident of which parent each item happens to hang
from.

## Use case

| | |
| --- | --- |
| **Actor** | Someone working in a focused backlog ([[Focus level]]) |
| **Trigger** | Dragging a focus row above or below another, Alt+↑/↓, or **Move up / down / to top / to bottom** from a focus row's menu |
| **Preconditions** | A focus level is active, and both rows are rows of it |
| **Guarantee** | **One note is written and it is the dragged one: its `order` and nothing else.** No parent changes, no other note is renumbered, and where no rank fits between the neighbours nothing is written at all and the view says why. |

**Main flow**

1. The user drags a focus row between two others.
2. The rank is the midpoint between the neighbours of that position in `model.ranked` —
   the one ordering every loaded item shares, so two rows from different parents can be
   compared at all.
3. One `order` is written, on the dragged note. The parent key is not touched.
4. The focused list redraws in the new order.

**Extensions**

- **1a — the same move by keyboard or menu.** Alt+↑/↓ and the four **Move** entries plan
  the identical write through the identical target: `siblingContext` answers `rankOnly`
  for an active focus row, `withinSiblingsTarget` and `edgeTarget` build the target from
  it, and `performDrop` applies it. One move, three inputs — a fourth input calls that
  method rather than planning a write beside it.
  **Checked by** `test/view/focusRanking.test.ts` — "lands the same rank from the drag, Alt+arrow and the menu"
- **1b — the row is a promoted root that is not an active focus row.** Refused. A
  projection promotes a root (a catalog `Test suite`, say) without any focus level being
  on, and its real siblings are off screen — so the rendered row above it is not something
  it can be ranked against. Membership in `model.roots` under `model.focused` is the test,
  never the `focusRoot` flag, which both cases carry.
  **Checked by** `test/view/focusRanking.test.ts` — "refuses to rank a promoted root that is not an active focus row"
- **1c — the user tries to indent or outdent across the focus row.** Still refused, as
  [[Focus level]] has always said. Ranking those rows is this use case; reparenting them
  is a question about parentage that nothing here answers, and the synthetic row is not a
  parent. `indentTarget` and `outdentTarget` each refuse a `focusRoot` row at the target,
  so the menu withholds the entry rather than offering one that does nothing.
  **Checked by** `test/view/focusRanking.test.ts` — "still refuses indent and outdent across the focus row"
- **1d — a `drag` INSIDE another focus row is not refused.** Dropping one focus row onto
  the middle of another still reparents it, because `insidePosition` asks nothing about
  focus. That is the one place the three inputs disagree, and it is recorded rather than
  settled: [[A focus row is reparented by drag and not by menu]].
- **2a — an unranked context row sits among the focus rows.** Skipped as a neighbour. It
  can never be given a rank — no write path may touch a note the base excluded — so a
  refusal beside one would be permanent, behind advice that cannot work. A *ranked*
  context row stays: its number is a real constraint, and a swap past it would put the
  moved row above something on screen.
  **Checked by** `test/view/focusedUnrankedContext.test.ts` — "does not offer Move down past a context row with nothing to rank from"
- **2b — the two neighbours have no room between them.** Nothing is written and a notice
  names the remedy: **Respace ranks** for a spent gap, the toolbar's set-up button for a
  neighbour with no rank at all, **Seed ranks from the hierarchy** for two neighbours
  holding the same number. The affordance and the refusal ask the same question — the
  drag path reads `dropPlacement`'s own answer rather than a similar one computed beside
  it — so a drop that looks legal and does nothing is a defect and not a state.
  **Checked by** `test/view/focusRanking.test.ts` — "names Respace when the gap between the two neighbours is spent"
- **2c — the view options are the reason nothing can be written.** The configuration is
  reported instead. Every remedy above is a write, and the write gate refuses all of them
  while `configProblems` is non-empty, so naming one would send the user in a circle.
  **Checked by** `test/view/focusRanking.test.ts` — "reports the CONFIGURATION instead, because every remedy above is blocked by it"
- **2d — the ranks of the focused rows are not all distinct.** The list draws in TREE
  order instead, which is what an unmigrated vault looks like: a sibling-scoped `order`
  gives every first child its parent's number, and sorting on ties would scramble the
  screen for no reason. The placement arithmetic makes the matching concession — a tie
  between the two neighbours falls back to ranking among the destination's peers alone
  (ADR 0008's own arithmetic) so an existing vault does not lose reordering before it is
  seeded. Neither the switch nor the fallback says anything to the user:
  [[The unseeded fallback is silent]].
  **Checked by** `test/domain/modelRanking.test.ts` — "falls back to tree order when the focused rows' ranks are not globally distinct"
- **2e — the vault's ranks were never spread for this.** Two palette commands rewrite
  them all: **Seed ranks from the hierarchy** (`seed-ranks`) numbers every note in the
  order the tree draws it, and **Respace ranks** (`respace-ranks`) keeps the order already
  on screen and puts room between each pair again. Each confirms with the count it would
  write, recomputes the batch when the answer arrives, and writes through the active
  view's own gate as one undoable batch. Two commands rather than one that guesses: they
  look alike and mean very different things to a backlog somebody has ordered by hand.
  **Checked by** `test/commands/rank.test.ts` — "ranks the model as it is on confirm, not as it was when the dialog opened"
- **2f — the notes a rewrite would rank are wedged against ones the base excluded.**
  Nothing is written and the notice names them. Both commands leave every excluded rank
  exactly where it is and fit the writable rows into the gaps between them, so a run of
  rows squeezed against a number no write path may move has nowhere to go. The advice is
  to run the command on an unfiltered base, which is the one thing that changes the answer.
  **Checked by** `test/domain/rankCommands.test.ts` — "answers with the wedged rows rather than an empty plan"
- **3a — the model was rebuilt between opening the menu and clicking it.** The row the
  menu named is re-resolved by path against the live model, and the peers and the
  population are read off that model too. A `DropTarget` finds its anchor by identity, so
  a captured row scores `-1` after a Bases pass and a fully ranked vault would refuse
  `unranked` — a notice sending the reader to a backfill with nothing to fill.
  **Checked by** `test/view/focusRanking.test.ts` — "ranks the row the menu names after the model was rebuilt under it"
- **3b — the note's parent link does not resolve.** Left exactly as it is. A focus rank
  restates the dragged row's own parent rather than deciding one (`parentUnchanged`), and
  only an explicit placement may clear a stale link. The two reach the writer looking
  identical, which is why the flag is carried rather than re-derived.
  **Checked by** `test/view/focusRanking.test.ts` — "leaves an unresolved parent link alone when the keyboard ranks a focus row"

## Acceptance criteria

- A focus-level move writes one note — the dragged one's `order` — and never a `parent`.
- The drag, Alt+arrow and the menu land the same rank on the same row.
- Indent and outdent stay refused across the synthetic focus row.
- A move that cannot be ranked writes nothing and names a remedy that is reachable: a
  command in the palette, the toolbar's set-up button, or the view options.
- Seeding and respacing are separate commands, each confirming with its count and each
  recomputing its batch at the moment the answer arrives.
- A note the base excluded is never written by either command, and a plan that cannot
  place a row around one changes nothing and says which rows.
- **A focus-level rank is also a rank among the item's own siblings.** There is one
  `order`, so ordering the PBI backlog reorders each PBI inside its own Feature as well.
  That is the price of a single rank and it is not a defect (ADR 0032).

## Where it lives

`src/domain/rankOrder.ts` (`rankedItems` and the comparator, `inRankOrder`,
`distinctlyRanked`, `focusKey`) ·
`src/domain/writePlan.ts` (`anchoredOrder`, `orderForTarget`, `dropPlacement`,
`computeDropWrites`, `refusalKey`) ·
`src/domain/rankSpread.ts` (`computeSeedWrites`, `computeRespaceWrites`, and the one
spread they share) ·
`src/commands/rank.ts` (the `seed-ranks` and `respace-ranks` palette commands) ·
`src/domain/dropTargets.ts` (`siblingPosition`'s focus branch, and `DropTarget.peers` as
intent rather than arithmetic) ·
`src/view/interactions/structure.ts` (`siblingContext`'s `rankOnly`, `withinSiblingsTarget`,
`edgeTarget`, and `plans`, the preflight every structural command is offered through) ·
`src/view/cardMoves.ts` (`performDrop`, which reports the refusal the planner returned).
Tests: `test/domain/rankedPlacement.test.ts`, `test/domain/modelRanking.test.ts`,
`test/domain/rankCommands.test.ts`, `test/commands/rank.test.ts`,
`test/view/focusRanking.test.ts`, `test/view/focusedUnrankedContext.test.ts`,
`test/view/backfillFocusOrder.test.ts`.

What `order` now MEANS — one rank over everything the Base returns, rather than a number
scoped to a sibling group — is [ADR 0032](../adrs/0032-order-is-a-global-rank.md), which
also records the two limitations this use case inherits: the rank space is the Base's
population and not the vault, and the peer fallback that keeps an unseeded vault working
is silent about which of the two regimes answered.
