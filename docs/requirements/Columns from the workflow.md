---
type: Feature
parent: "[[Product Kanban]]"
order: 20
status: Open
created: 2026-08-01
---

# Columns from the workflow

The board's columns are the workflow the view options already define: `stateValues` in
order, `doneValues` marking the finish. Defining the workflow and configuring the board
are the same act — there is no second column configuration to maintain, and options
that only concern the board hide while the view is a tree (`shouldHide` reads the
persisted mode).

**Outcome** — Defining the workflow *is* configuring the board, so the two can never
disagree, and no result is ever dropped for holding a state the workflow did not
anticipate.

## Use cases

- [[A column per state]] — the configured states, in their order.
- [[Every card has a column]] — nothing is lost for holding an unexpected value.
- [[WIP limits]] — the count against the agreement, as a signal.
- [[Done columns stay lean]] — finished work out of the way, never out of the vault.
- [[Explicit policies on the column]] — the working agreement on the column it governs.
