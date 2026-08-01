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

One column per workflow state, in the workflow's order. Linear derives its columns from
the ordered status list the same way, and Azure DevOps' rule that completed states map
to the last column is already expressed here by whichever `doneValues` the user put at
the end of the list. One state, one column — Jira's many-statuses-per-column mapping is
a deliberate non-goal, because this vocabulary is the user's own: merging two states
belongs in the vocabulary, not in a board-side mapping of it.

## Acceptance criteria

- Columns follow `stateValues` in the configured order; each header carries the state
  name and its card count.
- With no configured list, columns fall back to the states observed in the results
  plus a done value — the same fallback the state menus use (`stateMenuValues`), so
  the menu and the board can never offer different vocabularies.
- A done value's column is styled as finished, wherever in the order the user put it.
- A configured state's column exists while the state is configured, cards or none.
