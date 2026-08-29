---
type: PBI
parent: "[[Moving cards]]"
order: 47.5
status: Dropped
priority: P3
created: 2026-08-01
closed: 2026-08-17
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-02
risk: ""
assignee: ""
iteration: ""
---

# The quick filter on the board

**Withdrawn on 2026-08-17 with the filter itself — see [[Quick filter]] for why.**
Everything below is what it WAS; only this paragraph and `## Where it lives` are new, and
the shape is unchanged so the register can still read it.

**As** someone looking for one item on a full board, **I want** typing to narrow the
cards without rearranging the workflow, **so that** what I find is where it actually is.

The filter narrows cards, not workflow: columns are the shape of the board, matches
are its contents.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Typing in the quick filter while the board is showing |
| **Preconditions** | Board mode is on |
| **Guarantee** | The filter changes what is shown and nothing else. It writes nowhere, it never removes a column, and switching projections mid-filter never changes what is found. |

**Main flow**

1. The user types.
2. Cards narrow to the tree's match-path contract: a card stays while it, an ancestor, or
   anything in the subtree it represents matches.
3. Every column still renders, its header showing matches against the full count.
4. Clearing the filter restores the board exactly, including whatever was collapsed
   before.

**Extensions**

- **2a — a card hides a descendant's match.** It names those matching descendants on
  its face while the filter is active, each opening its note. A rollup number alone
  would leave the search's own result unreachable — found, counted, and impossible to
  get to. Whether the card ITSELF matched changes nothing: a match below a matching
  card is a second, distinct result, and one card cannot stand for two. A match that
  has a card of its own is left to that card, so no match is named twice.
- **2b — a collapsed column holds a match.** Collapse is ignored while filtering,
  exactly as the tree ignores it: the header opens for the filter's duration and returns
  to its saved state after. A match locked behind a closed header is a match lost.
- **3a — a column is over its WIP limit.** The signal keeps reading the full population,
  not the matches: a filter must never make an over-limit column look under its limit
  ([[WIP limits]]).
- **3b — the user drags while filtering.** Dragging stays enabled, unlike in the tree. A
  state write does not depend on visual neighbours, and that is exactly why the tree must
  disable it and the board need not: ranking reads siblings, a column does not.
- **4a — the user switches projections mid-filter.** The filter carries over rather than
  clearing. It is session state in both projections, written nowhere
  ([[Switching projections]]).

## Acceptance criteria

- Filtering shows the cards the tree would show: a card stays while it, an ancestor,
  or anything in the subtree it represents matches — the tree's match-path contract,
  so switching projections mid-filter never changes what is found. A card hiding a
  descendant's match names those matching descendants on its face while the filter is
  active, each opening its note — a rollup number alone would leave the search's own
  result unreachable — whether or not the card itself matched, and never naming one
  that has a card of its own. Every column still
  renders, its header showing matches against the full count while the filter is
  active. The WIP signal keeps reading the full population — a filter must never make
  an over-limit column look under its limit.
- Collapse is ignored while filtering, exactly as the tree ignores it: a collapsed
  column holding a match opens for the filter's duration and returns to its
  saved state after — a match locked behind a closed header is a match lost.
- Dragging stays enabled while filtering. A state write does not depend on visual
  neighbours — which is exactly why the tree must disable dragging under the filter
  and the board need not: ranking reads siblings, a column does not.
- The filter is session state in both projections: never written anywhere, and
  switching projections carries it rather than clearing it.

## Where it lives

**Nowhere — the board's half went with the filter**, and a living note may only cite source
that exists, so it no longer names the modules it used to. The removal is recorded path by
path in [[Remove the quick filter, now that Bases has its own search]].

The rule this PBI established is the part that OUTLIVES it, and it is worth keeping in view:
**a column is a stage of the workflow, not a search result.** It is why the done column's
fold default still measures its open work over the column's population rather than off the
cards on screen, and why what a stage HOLDS is counted through a predicate that carries
neither the completed toggle nor anything else that hides — see [[Done columns stay lean]],
which owns those terms now.
