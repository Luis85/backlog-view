---
type: PBI
parent: "[[Columns from the workflow]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
---

# A column per state

**As** someone who has already told the view what their workflow states are, **I want**
the board's columns to be exactly those states in that order, **so that** defining the
workflow and configuring the board are one act rather than two that can disagree.

One column per workflow state, in the workflow's order. Linear derives its columns from
the ordered status list the same way, and Azure DevOps' rule that completed states map
to the last column is already expressed here by whichever `doneValues` the user put at
the end of the list. One state, one column — Jira's many-statuses-per-column mapping is
a deliberate non-goal, because this vocabulary is the user's own: merging two states
belongs in the vocabulary, not in a board-side mapping of it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board renders |
| **Preconditions** | A state property is configured — without one there is no workflow, and board mode is guidance instead ([[Board empty states]]) |
| **Guarantee** | There is no second column configuration. The columns are the workflow the view options define, so the board can never offer a vocabulary the state menus do not. |

**Main flow**

1. The board reads the configured `stateValues`.
2. It renders one column per value, in the configured order.
3. Each header carries the state name and the count of cards in it.
4. The order is the workflow's order, so whichever values the user marked done sit where
   the user put them.

**Extensions**

- **1a — no state list is configured.** Columns fall back to the states observed in the
  results plus a done value — the same fallback the state menus already use
  (`stateMenuValues`), so a board and a menu can never offer different vocabularies.
- **2a — a state is configured but nothing holds it.** Its column renders regardless: a
  stage exists because the workflow names it, not because something is sitting in it
  ([[Board empty states]]).
- **2b — the user wants two states in one column.** Not offered. Merging belongs in the
  vocabulary, where it changes what is written and what the menus offer; a board-side
  mapping would make the board disagree with every other surface reading the same
  property.
- **3a — a column's state is a done value.** It is styled as finished wherever in the
  order the user put it. Done is a property of the value, not of the last position.

## Acceptance criteria

- Columns follow `stateValues` in the configured order; each header carries the state
  name and its card count.
- With no configured list, columns fall back to the states observed in the results
  plus a done value — the same fallback the state menus use (`stateMenuValues`), so
  the menu and the board can never offer different vocabularies.
- A done value's column is styled as finished, wherever in the order the user put it.
- A configured state's column exists while the state is configured, cards or none.

## Where it lives

**Nothing yet — this note is design.** The vocabulary and its done-matching already live
in `src/domain/settings.ts`, and the options that hold them in
`src/domain/viewOptions.ts`; deriving columns from them is pure domain work, so it can be
tested without a board existing.
