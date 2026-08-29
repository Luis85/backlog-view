---
type: Feature
parent: "[[Product Kanban]]"
order: 20
status: Active
created: 2026-08-01
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Columns from the workflow

The board's columns are the workflow the view options already define: `stateValues` in
order, `doneValues` marking the finish. Defining the workflow and configuring the board
are the same act — there is no second column configuration to maintain, and options
that only concern the board should hide while the view is a tree (the mechanism is
those options' own design question, since the mode lives in local UI state rather
than the config a `shouldHide` callback reads).

**Outcome** — Defining the workflow *is* configuring the board, so the two can never
disagree, and no result is ever dropped for holding a state the workflow did not
anticipate.
