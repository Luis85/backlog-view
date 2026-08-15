---
type: PBI
parent: "[[Moving cards]]"
order: 30
status: Done
priority: P3
created: 2026-08-01
closed: 2026-08-02
files:
  - src/view/filterState.ts
  - src/view/interactions/menu.ts
  - src/view/backlogView.ts
  - src/domain/board.ts
  - src/view/render/board.ts
  - test/view/boardFilter.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The quick filter on the board

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
- **2b — a collapsed column or lane holds a match.** Collapse is ignored while filtering,
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
  column or lane holding a match opens for the filter's duration and returns to its
  saved state after — a match locked behind a closed header is a match lost.
- Dragging stays enabled while filtering. A state write does not depend on visual
  neighbours — which is exactly why the tree must disable dragging under the filter
  and the board need not: ranking reads siblings, a column does not.
- The filter is session state in both projections: never written anywhere, and
  switching projections carries it rather than clearing it.

## Where it lives

**Built.** The filter's session state and match-path contract moved out of
`src/view/backlogView.ts` into `src/view/filterState.ts` when the view hit its
400-line cap — the same shape `viewState.ts` already has, and the extraction the
cap exists to force. It keeps TWO sets: `visible` (a match plus its ancestors and its
whole subtree) decides what renders, and `matches` (the matches themselves) answers
which of the things under a card the search actually found. One set cannot do both —
everything in a match's subtree is visible and almost none of it matched.

Counts: `BoardColumn.fullCount` in `src/domain/board.ts` is filled from a second
predicate the view passes in, and `isRowHiddenUnfiltered` in `backlogView.ts` supplies
it by lifting the filter alone. Lifting the filter is NOT the same as having no
filter — a running filter suspends the completed-items toggle, and the population has
to keep that suspension, or a matched-but-otherwise-hidden card reads as "1 of 0":
each number defensible on its own, the pair nonsense. Both predicates are the one
`hidden` method with a flag, so the narrowed board and the population it is measured
against cannot disagree about what is in a column.

Reachability: `hiddenMatches` in `src/domain/board.ts` walks a card's subtree for
matches that have no card of their own, stopping at anything already rendered so one
match is never named by two cards; `src/view/render/board.ts` renders them as
`tabindex="-1"` buttons, the same rule the tree's per-row controls follow, and
`addMatchSection` in `src/view/interactions/menu.ts` puts the same matches in the card
menu — the keyboard path those controls always take here, since the board is one tab
stop. Each link stops its click and its `auxclick` from reaching the card beneath: a
middle click never fires `click`, so stopping the primary one alone still opened the
parent in a new tab. It matters most under focus,
where the only cards are the focus level's and a match three levels down would
otherwise be found, counted in the rollup, and impossible to get to.

Driven by `test/view/boardFilter.test.ts`, split out of `test/view/boardMoves.test.ts`
once the filter became a subject of its own.
