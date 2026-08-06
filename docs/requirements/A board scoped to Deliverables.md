---
type: PBI
parent: "[[A Deliverables board]]"
order: 10
status: Open
priority: P2
created: 2026-08-06
source: user request
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/model.ts
  - src/domain/board.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/render/board.ts
  - src/view/render/toolbar.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
  - src/storage/collapseStore.ts
  - src/view/collapseState.ts
  - src/view/render/projections.ts
---

# A board scoped to Deliverables

**As** someone producing concepts, designs and other deliverables, **I want** a kanban
board that shows only Deliverables moving through a process of their own, **so that** a
document's review status doesn't have to share a column list with a PBI's implementation
status.

This is the board [[Columns from the workflow]] already describes, projected a second
time: the same rule — the workflow the view options define **is** the column
configuration — applied to a second, independent property and a card population
narrowed to one type.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Toggling the toolbar to the Deliverables board |
| **Preconditions** | The Deliverable state property is configured (the "Deliverables" view-options group) |
| **Guarantee** | One model, one write gate, one undo history, exactly as [[Product Kanban]]'s own guarantee states — and a move here writes only the Deliverable state property, never the requirements board's. |

**Main flow**

1. The toolbar toggle grows a fourth position: Tree, Board, Roadmap, Deliverables.
2. Choosing it shows a board whose columns are the workflow the new "Deliverables"
   settings group defines — no-state first, then its configured states in order, then
   any observed value the configuration does not name.
3. Its cards are every `Deliverable`-typed item in `model.results`, case-insensitively —
   the same match `isExtraType` already recognises — regardless of the *requirements*
   workflow's state, and regardless of "Show completed items" (which this board does
   not honor; see 3c).
4. A drag, an Alt+Left/Right, or the card menu's Set state all write the Deliverable
   state property alone, through the same gate every other move goes through, and
   announce themselves the same way board moves already do.

**Extensions**

- **1a — no Deliverable state property is configured.** The board shows the same
  unconfigured empty state the requirements board shows without a `stateKey` — a
  workflow is this mode's prerequisite here too.
- **1b — the Deliverable workflow is configured, but the base holds no `Deliverable`
  results at all.** Every column renders empty, and the board shows "No deliverables
  yet" — never "All N items are done and hidden," which is what the requirements
  board's own empty-column advisory would say if reused unmodified: it cannot tell "the
  base is empty" from "nothing here matches this board's type," and this board's
  population is a type filter, not a completion state.
- **1c — the requirements `stateKey` is also configured.** The toolbar's "Show completed
  items" toggle does not appear while viewing the Deliverables board, even though it
  would appear on the requirements board with the same settings — the control has no
  effect here (3c), so it is absent rather than present and inert.
- **3a — a Deliverable also carries the requirements board's own state property.** It
  is an ordinary card on the requirements board too, unaffected: the two properties are
  independent, and neither board's move touches the other's key.
- **3b — a hierarchy focus level is active (the toolbar's focus picker, shared by every
  projection).** Cards are drawn from `model.results` rather than `model.roots`, so a
  Deliverable nested inside the focused subtree still renders — but `model.results`
  itself narrows to that subtree while a focus is active, exactly as it already does for
  the tree and the requirements board. This board makes no exception to that: a
  Deliverable entirely outside the focused subtree is out of scope until focus clears,
  the same rule every other projection already lives with.
- **3c — a Deliverable's requirements-board state reads as done.** Its card still
  renders here. This board does not implement "Show completed items" in this increment
  (Scope, in the design spec) — building it would need its own rollup over the
  Deliverable workflow, not the requirements one, and nothing has asked for it yet.
- **3d — a Deliverable's two workflow states disagree on completion** (e.g. `Done` on
  the requirements board, `Draft` here, or the reverse). Its card's finished styling
  (`pbl-done`) here reflects the **Deliverable** workflow's own done values, never the
  requirements board's — the shared card shell takes completion as an input rather than
  reading `item.done` itself, so the two boards can disagree about one card without
  either one lying about it.
- **4a — the card is a context row (`outsideFilter`).** Never a card to drag, never a
  write target, never counted — the context-row rule applies here exactly as it does on
  the requirements board.

## Acceptance criteria

- The toolbar offers exactly Tree, Board, Roadmap, Deliverables, and the fourth shows
  cards only for items typed `Deliverable`.
- Its columns come from a workflow (state property, ordered states, done values)
  configured independently from the requirements board's `stateValues`/`doneValues`.
- A move — drag, Alt+arrow, or menu — writes only the Deliverable state property; the
  requirements board's state is untouched by it, and vice versa.
- Undo takes back a Deliverables-board move through the same one slot every other move
  in the view uses.
- No non-Deliverable item ever appears as a card here, whatever its own state.
- No result is lost: every Deliverable item in `model.results` renders in exactly one
  column, and column counts sum to the Deliverable card count — the same guarantee
  [[Product Kanban]] states for the requirements board, including a stray column for an
  observed value the configured workflow does not name, and including a Deliverable
  nested inside a currently-focused subtree (never only the synthetic focus-level roots).
- Neither the requirements workflow's completion state nor "Show completed items" hides
  a card here; only the quick filter narrows this board's population.
- A card's finished styling here follows the Deliverable workflow's own done values,
  never the requirements board's — the two can disagree about one card and each board
  shows its own answer.
- On a Deliverable card viewed from this board: the card menu's Set state section
  appears whenever `deliverableStateKey` is configured, even if the requirements
  `stateKey` is not; its checked entry reflects `item.deliverableStateValue`, never
  `item.stateValue`; and picking one writes `deliverableState` alone — never the
  requirements key, whichever key happens to also be configured.
- Picking the Deliverables board survives closing and reopening the view, the same way
  Board and Roadmap already do — not merely reverting to the tree because the stored
  value went unrecognised.
- Selecting the fourth toggle actually renders the Deliverables board's columns and
  cards into the pane — asserted directly, not inferred from the board model existing.
- A drop on a Deliverables-board column writes `deliverableState` alone — the drag input
  gets the same wrong-property regression coverage the menu input does, since the two
  reach the write through separate code paths that must not disagree.
- The pane carries the same board-shaped styling (columns readable, no clipped overflow,
  no leftover tree-only root drop zone) in Deliverables mode as in Board mode.
- A configured-but-empty Deliverables board (no `Deliverable` results in the base) shows
  "No deliverables yet," never a message claiming items are done and hidden.
- "Show completed items" does not appear in the toolbar while viewing the Deliverables
  board, whatever the requirements `stateKey` holds.

## Where it lives

`src/domain/settings.ts` — a `deliverableState` field joins `OptionalField` and
`PROPERTY_TABLE` (so it gets collision-checking, adoption and backfill for free, the way
every optional property already does), plus `deliverableStates` and
`deliverableDoneValues` beside `states`/`doneValues`.
`src/domain/viewOptions.ts` — a new "Deliverables" group: the state property picker,
the ordered workflow states, the done values.
`src/domain/model.ts` — `BacklogItem.deliverableStateValue`, `deliverableDone` and
`BacklogModel.observedDeliverableStates`, built the same way `stateValue`, `done` and
`observedStates` already are.
`src/domain/board.ts` — `boardColumns` takes the workflow (state reader, states, done
values) as a parameter instead of reading `settings.stateKey`/`states`/`doneValues`
directly, so the requirements board and this one share one implementation.
`src/domain/writePlan.ts` — `ItemWrite.deliverableState` / `removeDeliverableStateKey`
(the `state`/`removeStateKey` shape, not `AxisWrite`'s — no span semantics here) and
`computeDeliverableStateWrites`, deliberately with no stamp logic.
`src/storage/frontmatter.ts` — applying and capturing the new fields through
`optionalKeyFor(settings, 'deliverableState')`.
`src/view/host.ts` — `projection` gains `'deliverables'`, and
`performDeliverablesBoardMove` is the one path for the drop/Alt-arrow/menu trio.
`src/view/render/projections.ts` — `renderProjectionContent` gains an explicit
`renderDeliverablesBoardContent` branch beside `renderBoardContent`/
`renderRoadmapContent`, gated on `settings.deliverableStateKey`; without it the fourth
toggle falls through to `renderTree`, whatever `host.deliverablesBoard` holds.
`src/view/backlogView.ts` — the fourth toggle, and `renderTreeContent`'s
`pbl-board-mode` class condition widens to `projection === 'board' || projection ===
'deliverables'` (`backlogView.ts:468`) — the two are shaped alike and share the class,
rather than the Deliverables board inheriting the tree's overflow and root drop zone by
omission.
`src/view/render/toolbar.ts` — the fourth toggle, and `renderCompletedToggle`'s gate
(`toolbar.ts:210`) adds `&& host.projection !== 'deliverables'`.
`src/view/render/board.ts` — three changes, not one: `createCard` takes its completion
flag as a parameter (defaulted to `item.done`, so the requirements board and the roadmap
need no change) instead of reading `item.done` itself, so the Deliverables board's call
site can pass `item.deliverableDone`; `renderBoard`/`renderColumn` (`:19-42`, `:94-126`)
take the resolved `BoardModel` and a `move` callback as parameters instead of deriving
`boardColumns(...)` and `host.performBoardMove` internally, so `renderColumn`'s drop
wiring (`:123`) calls whichever `move` its caller gave it rather than hardcoding
`performBoardMove` — the drag counterpart of the menu fix above, since an unparametrized
`renderColumn` would let a drop write the wrong property exactly as an unparametrized
menu would; and `renderBoardAdvisory` (`:84-91`) gains a Deliverables-scoped sibling that
asks whether `model.results` contains any `Deliverable` rather than whether it is empty,
so a base full of other work is never reported as "done and hidden" on this board.
`src/view/interactions/cardDrag.ts`, `keyboard.ts` — wiring the new board's drop
targets (through the parameterized `renderColumn` above) and its Alt-arrow ladder.
`src/view/interactions/menu.ts` — three changes, not one: the Set-state section's
visibility gate (`menu.ts:70`) checks whichever key is active for `host.projection`,
not only the requirements `stateKey`; `stateChoices` (`menu.ts:289`) sources
`host.deliverablesBoard?.board` on that projection, mirroring how it already sources
`host.board?.board` for `'board'`; and both `chooseState` (`menu.ts:305`, the write)
and `addStateItems` (`menu.ts:323`, the checked entry) route to
`performDeliverablesBoardMove` / `computeDeliverableStateWrites` rather than falling
through to the requirements-keyed `computeStateWrites` — the gap that would otherwise
have this board's menu write to the wrong property, not just display it wrong.
`src/storage/collapseStore.ts` — a `DELIVERABLES_MODE` constant beside
`BOARD_MODE`/`ROADMAP_MODE`, added to `readEntry`'s stored-mode allowlist, or the
projection is silently dropped on read like any unrecognised value.
`src/view/collapseState.ts` — `CollapseState.projection()` and its write-back
counterpart map `'deliverables'` to and from `DELIVERABLES_MODE`, the same round trip
`board`/`roadmap` already get.
