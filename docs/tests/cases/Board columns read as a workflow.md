---
type: Test case
order: 10
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Board columns read as a workflow

A verification to run.

## Why this exists

`domain/board.ts` derives the columns and jsdom checks their DOM shape; whether they
actually read as a workflow at a glance is a look-and-feel question.

It was called `Board columns and the filtered header` until 2026-08-17, and its second
half — whether a "3 of 12" header reads as information rather than clutter — went with the
quick filter ([[Remove the quick filter, now that Bases has its own search]]). A column
header says one number now, so there is no paired reading left to judge.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- Switch to the board. One column per configured `stateValues` entry, in that order,
  plus a trailing no-state column for anything unset.
- The count on each header should read clearly at the toolbar's default size and not
  crowd the column title, at the longest state name the workflow has.
- A column with a WIP limit should show the count against the limit in the same place,
  and an over-limit column should signal in more than colour alone.

## Acceptance criteria

- Column order matches `stateValues`, no-state column present and last.
- The count confirmed legible beside the longest column title, limit included.
