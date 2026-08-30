---
type: Test case
order: 50
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-30
source: Decomposition of [[New cards in place]]
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Creating a card in a column

A verification to run.

## Why this exists

[[New cards in place]] main flow step 4 — *"the next render places its card in that
column"* — is the one step of that use case jsdom cannot answer. The harness has no
Bases, so nothing there can say whether a real query returns the new note, whether it
returns it in time to be the next render, or where folder mode actually put it. jsdom
asserts the write; only a vault asserts the placement.

The touch half is the same shape as the verdict [[Keyboard, menu and touch]] left to a
device: whether the column header's `+` is reachable by thumb is not a claim the
stylesheet can settle here.

**Preconditions** — `npm run test-build` has installed the plugin into this repository,
this repository is open as a vault, `docs/Product Backlog.base` is open in board mode,
and a state property is configured.

## How to check

1. Press the `+` on a column whose state holds cards already. Give the note a title.
   Watch the next render.
2. Repeat on a column whose state holds **no** cards.
3. Repeat on the leading no-state column, then open the created note and read its
   frontmatter.
4. Open the created notes and confirm where they landed, with folder mode on and off.
5. Repeat step 1 from the column's context menu, then again with the keyboard: select an
   empty column and press Enter.
6. On a phone or tablet, try the `+` and the menu entry.

## Acceptance criteria

- Each created note appears as a card in the column it was created from, on the next
  render rather than after a manual refresh.
- The note created from the no-state column carries no state key at all — not an empty
  value.
- In folder mode the note lands where the tree's own creation puts it; the column it was
  created from changes its state and nothing else about its placement.
- The menu and keyboard paths create the same note the `+` does, in the same column.
- The `+` and the menu entry are usable on touch, or the failure is recorded here.

## Outcome
