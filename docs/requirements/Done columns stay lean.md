---
type: PBI
parent: "[[Columns from the workflow]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/storage/collapseStore.ts
---

# Done columns stay lean

Every surveyed tool bounds its done column — Jira hides completed items older than a
chosen number of weeks, GitHub Projects and Linear auto-archive — and every one of
those rules reads a completion date. Notes have none until the transition stamps land,
so what a note-backed board can do honestly today is collapse, and this register keeps
its closed notes for a reason: an archive here is a state value plus the Base's own
filter, not a place cards are moved to.

## Acceptance criteria

- A done column starts collapsed the first time a board renders it — the same
  once-only default the tree applies to a parent nobody has ruled on — and an explicit
  expand or collapse is remembered per device in the collapse store, never in the
  `.base`.
- A collapsed column keeps its name and count visible and stays a drop target, as
  Trello's collapsed lists and Linear's hidden columns both do.
- "Show completed items" off hides what it hides in the tree: cards whose whole
  subtree is done (`subtreeDone`), never a card still carrying open work — a Done item
  with an Active task below the focus line keeps its card, so its rollup keeps that
  open work on screen. A done column empties rather than being amputated, and hides
  whole only when nothing in it is left visible. One of the two deliberate narrowings
  the epic's invariant names, beside the focus level; the quick filter overrides
  hiding, as it does in the tree.
- Age-based hiding stays out of scope until [[Stamp when work starts and finishes]]
  gives it a date to read.
