---
type: PBI
parent: "[[Columns from the workflow]]"
order: 20
status: Done
priority: P1
created: 2026-08-01
files:
  - src/domain/board.ts
---

# Every card has a column

**As** someone whose notes carry states nobody standardised, **I want** every result to
land in some column, **so that** switching to the board is never a way to lose work I
can see in the tree.

The board never loses a result. Jira and Azure DevOps hide statuses that are not
mapped to a column, and both document the resulting disappearance as a routine support
question; GitHub Projects gathers no-value items into a "No Status" column instead.
Gathering is right: in this view the Base decides what is in the backlog, and the board
has no authority to show less.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board places the results into columns |
| **Preconditions** | Board mode is on and the workflow has columns |
| **Guarantee** | Every result gets exactly one column, and the column counts sum to the number of results the model holds. The board narrows nothing on its own authority. |

**Main flow**

1. For each result, the board reads the state property.
2. It matches the value against the workflow's states, case-insensitively — the same
   matching `doneValues` already uses.
3. The card renders in that state's column.
4. Each column header shows its count, and the counts sum to the results the model holds.

**Extensions**

- **1a — the item has no state property at all.** It gathers in a leading no-state column,
  before the workflow rather than outside the board. The column renders while it holds
  cards; empty, it shrinks to a leading drop strip — the board's answer to the tree's
  root strip — so clearing a state by drag stays possible without a permanently empty
  column.
- **2a — the value is not one the configured workflow names.** It still gets a column,
  appended after the configured ones and visibly outside the defined workflow. That is a
  nudge to adopt the state or re-state the items, never a dropped card.
- **3a — the item is rendered only for context.** It is in no count, and its value never
  mints a column. An excluded note's state is not this board's vocabulary, exactly as it
  is not the state menu's.
- **4a — a focus level or "Show completed items" is narrowing the board.** The counts
  narrow with it, together and visibly ([[Focus level picks the cards]],
  [[Done columns stay lean]]). Those are the only two narrowings the epic allows, and
  restoring them restores every result to a column.

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

## Where it lives

Assignment lives with the column derivation in `src/domain/board.ts`: the model already
reads the state tolerantly, and `boardColumns` matches it against the workflow with the
same lowercased comparison `doneValues` uses, gathers the stateless into the leading
no-state column, and mints the appended stray columns. Counts are result cards only.
Asserted in `test/domain/board.test.ts` and driven through the view in
`test/view/board.test.ts`.
