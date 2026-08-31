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
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Within a column, cards rank by the base's sort, not by hand

## The decision

A column renders its cards exactly in the order the Base's own sort delivers —
`entryIndex`, since `data.data` arrives presorted — for every result card, whether or
not it carries an `order`. The board never consults the property itself; it reaches a
column only when the user has put it in the Base's sort. The one card without an index of its own is the
focused context card (`entry: null`): it takes the earliest `entryIndex` among the
visible results it places, sorting where its first result would — the only ordering
consistent with existing only to place them. Dragging within a column is not offered,
and no property records a board position.

## Why

**The original reason expired on 2026-08-30 and the decision did not.** It was that
`order` is a sibling-scoped fractional rank: a column mixes items from different parents,
so a hand-placed position inside it had no property to live in without inventing a
board-only one. [ADR 0032](../adrs/0033-order-is-a-global-rank.md) made `order` one rank
over everything the Base returns, which is exactly the shared rank that argument said was
missing — every card in a column is now comparable to every other one, and the write that
would place a card between two others is the same `anchoredOrder` midpoint the tree takes.
**So in-column ranking became possible, and is deliberately not taken.**

What survives the change is the rest of the argument, which was never about the property:

- The board renders in the Base's sort, and the Base's sort is the user's own answer to
  column order — `order` may be part of it, and the shipped register sorts by status, then
  priority, then area. Offering a drag that fights a sort the user configured is the case
  the two tools that support sorted boards decided the same way this note does: when a
  sort applies, in-column reordering is off and cross-column moves keep working (GitHub
  Projects, Linear).
- A board rank that is the SAME rank as the tree's is not free either — it means dragging
  a card up its column reorders the backlog tree, which is a consequence a user cannot see
  from the board. That is the price [[Ranking at the focused level]] accepted knowingly for
  the focused list, where the rows and the rank are the same list. A column is not.
- The community board that invented a second property (`kanban_order`) now has two ranks
  that can disagree about the same notes, and every dual-surface tool that got it right
  keeps one — Jira's LexoRank, Azure DevOps' stack rank, Linear's manual order. That
  argument is now an argument FOR using `order` if this is ever built, not against.

## What a real change would look like

If evidence arrives that derived order is not enough, the honest path is a drop that
writes the shared `order` — a midpoint between the two cards' ranks, through the same
`performBoardMove` every other card move already goes through — never a board-only
property. It is a smaller change than it was when this note was written, and the trade it
must be re-decided against is no longer "can this be expressed" but two things it costs:
the drag has to be withheld or explained while a Base sort is in force, and reordering a
column silently reorders the tree.

## Acceptance criteria

None; recorded so the trade-off is re-decided with this reasoning in hand rather than
rediscovered. Raise the priority if within-column placement is requested with a use
the base's sort cannot express. The premise was corrected on 2026-08-30 without the
decision changing — an issue whose reason has expired is one somebody will otherwise
"fix" by re-deriving the obvious.
