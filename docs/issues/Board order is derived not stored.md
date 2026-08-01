---
type: Issue
order: 50
parent: "[[Moving cards]]"
status: Open
priority: P3
area: design
created: 2026-08-01
source: Product Kanban epic design
files:
  - src/domain/writePlan.ts
---

# Within a column, cards rank by the base's sort, not by hand

## The decision

A column renders its cards exactly in the order the Base's own sort delivers —
`entryIndex`, since `data.data` arrives presorted — for every result card, whether or
not it carries an `order`. A sibling-scoped `order` is not comparable across parents,
so the board never consults the property itself; it reaches a column only when the
user has put it in the Base's sort. The one card without an index of its own is the
focused context card (`entry: null`): it takes the earliest `entryIndex` among the
visible results it places, sorting where its first result would — the only ordering
consistent with existing only to place them. Dragging within a column is not offered,
and no property records a board position.

## Why

`order` is a sibling-scoped fractional rank — the whole ranking model renumbers one
sibling group at a time. A column mixes items from different parents, so a hand-placed
position inside it has no property to live in without inventing a board-only one, and
the community board that did invent one (`kanban_order`) now has two ranks that can
disagree about the same notes. Every dual-surface tool keeps one rank shared between
backlog and board — Jira's LexoRank, Azure DevOps' stack rank, Linear's manual order —
and the two tools that support sorted boards state the same rule this decision adopts,
nearly verbatim: when a sort applies, in-column reordering is off and cross-column
moves keep working (GitHub Projects, Linear).

The base's sort config is the user's own answer to column order, and `order` may be
part of it — the shipped register sorts by status, then priority, then area.

## What a real change would look like

If evidence arrives that derived order is not enough, the honest path is ranking among
*same-parent* peers through the shared `order` — a drop between two cards writes only
when the neighbours are siblings, exactly as the tree would rank them — never a
board-only property. That keeps one source of truth at the cost of drops that
sometimes cannot land where aimed, which is the trade to re-decide knowingly.

## Acceptance criteria

None; recorded so the trade-off is re-decided with this reasoning in hand rather than
rediscovered. Raise the priority if within-column placement is requested with a use
the base's sort cannot express.
