---
type: PBI
parent: "[[Columns from the workflow]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/storage/viewStateStore.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Done columns stay lean

**As** someone whose done column has a year of finished work in it, **I want** it out of
my way without being out of my vault, **so that** the board stays about the work in
flight while the record of what was finished stays exactly where I put it.

Every surveyed tool bounds its done column — Jira hides completed items older than a
chosen number of weeks, GitHub Projects and Linear auto-archive — and every one of
those rules reads a completion date. Notes have none until the transition stamps land,
so what a note-backed board can do honestly today is collapse, and this register keeps
its closed notes for a reason: an archive here is a state value plus the Base's own
filter, not a place cards are moved to.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board renders a done column, or the user collapses one |
| **Preconditions** | Board mode is on and a done value has a column |
| **Guarantee** | Nothing is archived, moved or deleted. Every card the Base returned is still on the board, and hiding is something the user can see the state of and undo by expanding. |

**Main flow**

1. The board renders the done column.
2. The first time it does, a column holding nothing but finished subtrees starts
   collapsed — the once-only default the tree already applies to a parent nobody has
   ruled on.
3. Collapsed, the column keeps its name and its count visible and stays a drop target,
   as Trello's collapsed lists and Linear's hidden columns both do.
4. An explicit expand or collapse is remembered per device in the collapse store, never
   in the `.base`.

**Extensions**

- **2a — the done column still carries open work.** It starts expanded. The collapse
  default exists for noise, and a retained card's rollup is not noise.
- **3a — "Show completed items" is off.** Cards whose whole subtree is done
  (`subtreeDone`) are hidden — never a card still carrying open work, so a Done item with
  an Active task below the focus line keeps its card and its rollup keeps that work on
  screen. This is one of the two narrowings the epic's invariant allows, beside the focus
  level.
- **3b — everything in the column is hidden by that option.** The column still renders,
  collapsed at most. A configured stage stays a drop target and a creation point whatever
  is hidden inside it: completing work *into* a done state has to keep working precisely
  while completed work is hidden.
- **3c — a quick filter is active.** It overrides hiding, as it does in the tree: a search
  that could not find finished work would be a search with a silent exception in it.
- **4a — the user wants age-based hiding** ("done more than two weeks ago"). Out of scope
  until [[Stamp when work starts and finishes]] gives it a date to read. Every tool that
  does this reads a completion date, and inventing one from a file's mtime would be a
  guess presented as history.

## Acceptance criteria

- A done column holding nothing but finished subtrees starts collapsed the first time
  a board renders it — the same once-only default the tree applies to a parent nobody
  has ruled on. One still carrying open work starts expanded: the collapse default
  exists for noise, and a retained card's rollup is not noise. An explicit expand or
  collapse is remembered per device in the collapse store, never in the `.base`.
- A collapsed column keeps its name and count visible and stays a drop target, as
  Trello's collapsed lists and Linear's hidden columns both do.
- "Show completed items" off hides what it hides in the tree: cards whose whole
  subtree is done (`subtreeDone`), never a card still carrying open work — a Done item
  with an Active task below the focus line keeps its card, so its rollup keeps that
  open work on screen. The column itself always renders — collapsed at most — because
  a configured stage stays a drop target and a creation point whatever is hidden
  inside it: completing work into a done state has to keep working precisely while
  completed work is hidden. One of the two deliberate narrowings the epic's invariant
  names, beside the focus level; the quick filter overrides hiding, as it does in the
  tree.
- Age-based hiding stays out of scope until [[Stamp when work starts and finishes]]
  gives it a date to read.

## Where it lives

**Partly built.** The hiding slice shipped with the board: "Show completed items" off
hides `subtreeDone` cards through the same row-visibility rule the tree uses, the
column always renders, and the quick filter overrides — driven in
`test/view/boardMoves.test.ts`. Still design: column collapse itself, which belongs in
`src/storage/viewStateStore.ts` with the tree's row collapse — vault-scoped, per
device, pruned — and explicitly not in the `.base`, for the reason ADR 0011 gives.
