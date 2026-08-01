---
type: PBI
parent: "[[Columns from the workflow]]"
order: 20
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/noteFields.ts
---

# Every card has a column

The board never loses a result. Jira and Azure DevOps hide statuses that are not
mapped to a column, and both document the resulting disappearance as a routine support
question; GitHub Projects gathers no-value items into a "No Status" column instead.
Gathering is right: in this view the Base decides what is in the backlog, and the board
has no authority to show less.

## Acceptance criteria

- Items without the state property gather in a leading no-state column — they sit
  before the workflow, not outside the board. The column renders while it has cards;
  empty, it shrinks to a leading drop strip, the board's answer to the tree's root
  strip, so clearing a state by drag stays possible without a permanent empty column.
- An observed value the configured workflow does not name still gets a column,
  appended after the configured ones and visibly outside the defined workflow — a
  nudge to adopt the state or re-state the items, never a dropped card.
- State-to-column matching is case-insensitive, exactly as `doneValues` matching
  already is.
- Column counts sum to the result cards on the board — at full scope, exactly the
  count of results the model holds, the hierarchy scope having pruned ahead of both
  projections; only the two narrowings the epic names move the two together
  ([[Focus level picks the cards]], [[Done columns stay lean]]). A row rendered only
  for context is in no count, and its value never mints a column.
