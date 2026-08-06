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
3. Its cards are every result item typed `Deliverable`, case-insensitively — the same
   match `isExtraType` already recognises — regardless of what any other property
   holds.
4. A drag, an Alt+Left/Right, or the card menu's Set state all write the Deliverable
   state property alone, through the same gate every other move goes through, and
   announce themselves the same way board moves already do.

**Extensions**

- **1a — no Deliverable state property is configured.** The board shows the same
  unconfigured empty state the requirements board shows without a `stateKey` — a
  workflow is this mode's prerequisite here too.
- **3a — a Deliverable also carries the requirements board's own state property.** It
  is an ordinary card on the requirements board too, unaffected: the two properties are
  independent, and neither board's move touches the other's key.
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
- No result is lost: every Deliverable result renders in exactly one column, and column
  counts sum to the Deliverable card count — the same guarantee [[Product Kanban]]
  states for the requirements board, including a stray column for an observed value the
  configured workflow does not name.
- Picking the Deliverables board survives closing and reopening the view, the same way
  Board and Roadmap already do — not merely reverting to the tree because the stored
  value went unrecognised.

## Where it lives

`src/domain/settings.ts` — a `deliverableState` field joins `OptionalField` and
`PROPERTY_TABLE` (so it gets collision-checking, adoption and backfill for free, the way
every optional property already does), plus `deliverableStates` and
`deliverableDoneValues` beside `states`/`doneValues`.
`src/domain/viewOptions.ts` — a new "Deliverables" group: the state property picker,
the ordered workflow states, the done values.
`src/domain/model.ts` — `BacklogItem.deliverableStateValue` and
`BacklogModel.observedDeliverableStates`, built the same way `stateValue` and
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
`src/view/backlogView.ts`, `src/view/render/board.ts`, `src/view/render/toolbar.ts` —
the fourth toggle and its rendering, reusing the card shell `render/board.ts` already
shares across projections.
`src/view/interactions/cardDrag.ts`, `keyboard.ts`, `menu.ts` — wiring the new board's
drop targets, its Alt-arrow ladder, and its card menu's Set state.
`src/storage/collapseStore.ts` — a `DELIVERABLES_MODE` constant beside
`BOARD_MODE`/`ROADMAP_MODE`, added to `readEntry`'s stored-mode allowlist, or the
projection is silently dropped on read like any unrecognised value.
`src/view/collapseState.ts` — `CollapseState.projection()` and its write-back
counterpart map `'deliverables'` to and from `DELIVERABLES_MODE`, the same round trip
`board`/`roadmap` already get.
