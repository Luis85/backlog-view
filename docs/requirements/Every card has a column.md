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
  before the workflow, not outside the board.
- An observed value the configured workflow does not name still gets a column,
  appended after the configured ones and visibly outside the defined workflow — a
  nudge to adopt the state or re-state the items, never a dropped card.
- State-to-column matching is case-insensitive, exactly as `doneValues` matching
  already is.
- Column counts sum to the cards on the board — at full scope, exactly the result
  count; only the two narrowings the epic names move the two together
  ([[Focus level picks the cards]], [[Done columns stay lean]]). A row loaded only
  for context is not a card and is in no count.
