---
type: PBI
parent: "[[Backlog and board]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/render/emptyStates.ts
---

# Board empty states

**As** someone who has just pointed a board at a base and seen nothing, **I want** the
board to say which of the several possible reasons applies, **so that** I fix the one
thing that is actually wrong instead of guessing among a blank pane's explanations.

The board tells the truth about why it is empty, the way the tree's empty states
already do: a base full of plain notes is a different problem than a base with nothing
in it, and both are different from a workflow with no states.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board renders and has no cards to place |
| **Preconditions** | Board mode is on |
| **Guarantee** | The board never renders a blank pane. Whatever is missing, what renders names it and says where it is set. |

**Main flow**

1. The board resolves its columns from the configured workflow.
2. With no results to place, every configured stage still renders as a column — each one
   a creation target and a drop target.
3. The tree's empty-state honesty renders as an advisory beside the columns: how many
   notes the Base returned that are not work items, and the path to creating one.
4. The user acts on the named thing — configuring a property, creating an item — and the
   next render places cards.

**Extensions**

- **1a — no state property is configured.** There is no workflow to draw, so the board
  names the option to set and where. This is the one case with no columns, and it is
  guidance rather than a board precisely because a board would be a lie about a workflow
  that does not exist.
- **2a — a configured state holds no cards.** Its column renders anyway. Boards that
  derive columns from observed values lose exactly this, and an empty stage vanishing is
  the most repeated complaint against them: a workflow stage exists whether or not
  anything currently sits in it.
- **2b — a drag is over an empty column.** It is a drop target like any other and visibly
  says so. An empty stage that cannot be dropped into is an empty stage nothing can ever
  enter.
- **3a — the base returned notes that are not work items.** They are counted in the
  advisory rather than shown, the same report the tree makes — and it renders *beside*
  the columns, not instead of them. An empty board is empty stages, never no stages.

## Acceptance criteria

- With no state property configured, the board names the option to set and where,
  instead of rendering nothing.
- With no results but a configured workflow, the columns still render — every stage a
  creation target — and the tree's empty-state honesty (the ignored-notes count, the
  create path) renders as an advisory beside them, not as their replacement: an empty
  board is empty stages, never no stages.
- A configured state with no cards still renders its column. Boards that derive
  columns from observed values lose exactly this — an empty stage vanishing is the
  most repeated complaint against them — and a workflow stage exists whether or not
  anything currently sits in it.
- An empty column is a drop target and visibly says so while a drag is over it.

## Where it lives

**Nothing yet — this note is design.** `src/view/render/emptyStates.ts` already holds the
tree's four answers and the reasoning behind separating them; the board's cases join it
there rather than growing a second vocabulary of explanations somewhere else.
