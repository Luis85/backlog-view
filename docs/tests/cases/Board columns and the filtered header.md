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
---

# Board columns and the filtered header

A verification to run.

## Why this exists

`domain/board.ts` derives the columns and jsdom checks their DOM shape; whether they
actually read as a workflow at a glance, and whether the filtered count reads as
information rather than clutter, is a look-and-feel question.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- Switch to the board. One column per configured `stateValues` entry, in that order,
  plus a trailing no-state column for anything unset.
- Type into the quick filter until it narrows the results. The header of an affected
  column should read like "3 of 12" — confirm it reads clearly at the toolbar's default
  size and doesn't crowd the column title.

## Acceptance criteria

- Column order matches `stateValues`, no-state column present and last.
- The filtered header format confirmed legible.
