---
type: Issue
order: 70
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Tree undo

A verification to run.

## Why this exists

`view/interactions/undo.ts` is driven against a fixture in jsdom; what is unverified
here is the felt result — the toolbar's undo control, and that the notes on disk really
came back, not just the model held in memory.

## How to check

- Make a multi-note move (drag a parent with children onto a new parent, so the batch
  writes more than one file), then press undo.
- Confirm every note the batch touched is back to its prior frontmatter — open one in
  the editor and check `parent`/`order` by eye, don't trust the tree alone.
- Confirm a second undo press either takes back the next batch or is disabled if there
  is none, and that undo is announced (the toolbar or a live region names what came
  back).

## Acceptance criteria

- A multi-note batch confirmed fully reverted on disk, not just on screen.
