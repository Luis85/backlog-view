---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 20
status: Dropped
priority: P2
created: 2026-08-01
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-14
risk: ""
assignee: ""
---

# Swimlanes by parent

**As** someone reading a board of tasks from several features, **I want** the cards
grouped under the thing they belong to, **so that** the board answers "how is that
feature going" without me reading every card's parent line.

One level of ancestry, without pretending the board is a tree: optional lanes group
cards under their parent, the way Jira lanes a board by epic and Linear sub-groups by
parent issue. Lanes also give the board its second write axis — a lane is a parent, so
crossing lanes is the drop-onto-a-row the tree already plans.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Turning lanes on, or moving a card across lanes |
| **Preconditions** | Board mode is on |
| **Guarantee** | A lane is a parent, so crossing one is a reparent the tree already knows how to plan — same gate, same undo, same refusal of a drop that would make an item its own ancestor. |

**Main flow**

1. The user turns lanes on.
2. Each parent's card-children group under a lane header naming it.
3. The user drags a card into another lane.
4. The view plans the reparent the tree's drop-onto would plan — an appended order and no
   type write — and applies it through the one gate.
5. Undo takes it back as one batch.

**Extensions**

- **1a — lanes are off.** Flat columns, which is the default. Lanes are one level of
  ancestry offered, not the tree redrawn sideways.
- **2a — a card has no parent.** Parentless cards gather in a trailing lane. Jira keeps an
  undeletable "Everything Else" lane for the same reason: a card with nowhere to go is a
  card that disappears.
- **2b — a lane's parent is outside the Base's filter.** The header renders as context and
  obeys the context-row rule: never counted, never written, never draggable. A lane header
  otherwise opens its parent.
- **2c — the user collapses a lane.** Remembered per device, like columns and rows, and
  for the same reason: it is a per-screen preference, not a property of the base.
- **3a — the drop crosses a column as well as a lane.** Both changes go in one batch — the
  reparent and the state — so one gate runs and one undo takes both back.
- **3b — the drop would make the item its own ancestor.** Refused, exactly as in the tree.
  The cycle rule is a property of the hierarchy, not of the projection showing it.
- **3c — the user cannot drag.** The card menu gains a move-to-lane action offering every
  legal lane under the drag's own cycle rules, and Alt+Up and Alt+Down — which a flat
  board leaves unused — move the selected card one lane. Both write the batch the drag
  writes, so touch and keyboard lose nothing
  ([[Keyboard, menu and touch]]).

## Acceptance criteria

- Lanes are optional; off means flat columns. On, each parent's card-children group
  under a lane header naming it, and parentless cards gather in a trailing lane —
  Jira keeps an undeletable "Everything Else" lane for the same reason.
- A lane header opens its parent. A header whose parent is outside the Base's filter
  renders as context and obeys the context-row rule: never counted, never written,
  never draggable.
- Lane collapse is remembered per device, like columns and rows.
- Dragging a card into another lane writes the reparent the tree's drop-onto would
  plan — an appended order and no type write — and, when the
  column differs too, the state change in the same batch: one gate, one undo. A drop
  that would make an item its own ancestor is refused, as in the tree.
- The drag is never the only path across lanes: the card menu gains a move-to-lane
  action offering every legal lane under the drag's own cycle rules, and Alt+Up and
  Alt+Down — which a flat board leaves unused — move the selected card one lane. Both
  write the reparent batch the drag writes, so touch and keyboard lose nothing.

## Where it lives

**Why it was dropped.** Built, tried and refused on 2026-08-14. Lanes BY PARENT are not
coming back to the board or the roadmap, so this note is kept as the record of a design
already considered rather than as work waiting to be done. It stays in the tree so every
`[[wikilink]]` to it still resolves and nobody proposes grouping by parent again from the
code alone.

**This retires no band that ships.** The roadmap draws bands on its resources axis —
[[Showing a resources axis on the roadmap]], which `src/view/render/lanes.ts` serves —
and that axis groups by the assignee property, never by parent. Nothing here applies to
it.
