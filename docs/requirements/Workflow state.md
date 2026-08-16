---
type: PBI
parent: "[[Progress tracking]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# Workflow state

**As** someone working a backlog rather than only planning one, **I want** to move an item
to In progress or Done from the row itself, **so that** keeping the board honest costs one
click instead of opening the note.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking the state chip on a row, or **Set state** in the context menu |
| **Preconditions** | A state property is configured in the view options |
| **Guarantee** | Nothing state-related exists — chip, menu item or write — unless a state property is configured. The view never writes to an empty key. |

**Main flow**

1. Each row renders a chip showing its own state value.
2. The user clicks it; a menu offers the states this base uses, the current one checked.
3. The user picks one and the value is written to the note.
4. The row re-renders, and any rollup above it follows ([[Rollups and hiding finished work]]).

**Extensions**

- **1a — the item has no state at all.** No chip: an empty chip would read as a state.
- **1b — the row came from outside the Base's filter.** Its state renders as static text —
  never a button — and **Set state** is absent from its menu. It can be seen, not changed.
- **1c — the pane is too narrow for the state column.** The column drops whole, and
  **Set state** in the context menu is the way to edit it. No command is withheld for
  lack of space.
- **2a — states are configured in the view options.** Those are the menu, in that order.
- **2b — they are not.** The menu offers the values **observed among the base's results**,
  plus a done value so an item can always be finished. Only results contribute: an excluded
  note's state is not this base's vocabulary.
- **2c — the item holds a value that is on neither list.** It is added, so the current
  state always renders checked. A menu that cannot show what the item *is* is a menu that
  loses it on the next pick.

## Acceptance criteria

- With no state property configured, nothing state-related renders and no state is written.
- The menu offers the configured states, else the ones observed in the base, always
  including a done value.
- The item's own unlisted value still renders as checked.
- A row the Base excluded shows its state but cannot have it changed.

## Where it lives

`src/domain/viewOptions.ts` (`stateProperty`, `stateValues`, `doneValues`) ·
`src/domain/model.ts` (`collectObservedStates` — result-only vocabulary) ·
`src/domain/settings.ts` (`stateMenuValues`: the configured list, else observed ∪ a done
value) · `src/view/render/columns.ts` (the chip) ·
`src/view/interactions/menu.ts` (`showStateMenu`, which composes those two) ·
`src/storage/frontmatter.ts` (the write, dropped without a `stateKey`).
Tests: `test/view/state.test.ts`, `test/view/menu.test.ts`,
`test/view/contextRowWrites.test.ts`.
