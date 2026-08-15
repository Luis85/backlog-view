---
type: PBI
parent: "[[Hierarchy on the roadmap]]"
order: 10
status: Dropped
priority: P2
created: 2026-08-01
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Lanes on the roadmap

**As** someone reading a roadmap of several parents' work, **I want** rows grouped into
lanes by parent, **so that** the roadmap answers "how is that epic tracking" without me
reading every row's breadcrumb.

Linear lanes its roadmap by initiative and Azure DevOps gives each team its own row for
the same reason: on a wide axis, ancestry has to be a region, not a caption. The design
is the board's ([[Swimlanes by parent]]), adopted whole: a lane is a parent, so
crossing one is the reparent the tree already plans — and a gesture that crosses a lane
and the axis at once carries both changes in one batch, exactly as a board drop that
crosses a lane and a column does.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Turning lanes on, or a move that crosses lanes |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | A lane is a parent: crossing one is the reparent the tree already plans — same gate, same undo, same refusal of a drop that would make an item its own ancestor — and a move that also changes bucket or dates is one batch. |

**Main flow**

1. The user turns lanes on; rows group under lane headers naming each parent, on either
   axis.
2. The user moves an item into another lane — by drag, menu or lift
   ([[Keyboard and menu on the roadmap]]).
3. The view plans the reparent the tree's drop-onto would plan — an appended order and no
   type write — plus the horizon or date write when the gesture crossed the axis too, in
   one batch.
4. Undo takes the whole batch back.

**Extensions**

- **1a — lanes are off.** Flat rows, the default. Lanes are one level of ancestry
  offered, not the tree redrawn sideways.
- **1b — a lane's parent is outside the Base's filter.** The header renders as context
  and obeys the context-row rule: never counted, never written, never draggable. A lane
  header otherwise opens its parent.
- **1c — an item has no parent.** Parentless rows gather in a trailing lane — the
  board's rule, and Jira's undeletable catch-all lane before it: a row with nowhere to
  go is a row that disappears.
- **1d — the user collapses a lane.** Remembered per device in the view-state store, like
  board lanes and tree rows, and for the same reason: a per-screen preference, not a
  property of the base.
- **2a — the move would make the item its own ancestor.** Refused, exactly as in the
  tree and on the board. The cycle rule is a property of the hierarchy, not of the
  projection showing it.
- **3a — the reparent takes the note outside the Base's filter.** The write stands and
  the row leaves the view on the refresh, announced with a notice and an open path —
  the rule every roadmap write shares ([[Moving between horizons]] states it for
  horizons, [[Move and resize a bar]] for dates) — and undo still takes the whole
  batch back across the boundary. A combined lane-plus-axis move carries one notice,
  because it was one batch.

## Acceptance criteria

- Lanes are optional; off means flat rows. On, rows group under lane headers on either
  axis, and parentless rows gather in a trailing lane.
- A lane header opens its parent; a context parent's header is never counted, written
  or draggable.
- Lane collapse is remembered per device.
- Crossing lanes writes the reparent the tree's drop-onto would plan, plus the axis
  write when the gesture crossed both — one batch, one gate, one undo; cycle-making
  moves are refused.
- Menu and keyboard cross lanes with the same batch the drag writes.
- A reparent whose destination the Base excludes applies, is announced with an open
  path, and stays undoable — for lane-only and combined moves alike.

## Where it lives

**Why it was dropped.** Built, tried and refused on 2026-08-14. Lanes BY PARENT are not
coming back to the board or the roadmap, so this note is kept as the record of a design
already considered rather than as work waiting to be done. It stays in the tree so every
`[[wikilink]]` to it still resolves and nobody proposes grouping by parent again from the
code alone.

**This retires no band that ships.** The roadmap draws bands on its resources axis —
[[Showing a resources axis on the roadmap]], which `src/view/render/lanes.ts` serves —
and that axis groups by the assignee property, never by parent. Nothing here applies to
it.
