---
type: Task
order: 50
parent: "[[Children on the card]]"
status: Done
priority: P2
area: usability
created: 2026-08-14
closed: 2026-08-15
source: Asked for directly, alongside dropping the shelf's collapse option
files:
  - src/view/interactions/menu.ts
  - src/view/childrenList.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Drop the per-child entries from the card menu

## Evidence

Asked for directly. The card menu's children section carried a `Show/Hide children`
toggle and then one `Open child "…"` entry per child. The entries grow with the item:
the cards with the most children — the ones whose menu is longest already — are exactly
where a row per child pushes everything below it off the bottom.

The **toggle stays**. It was offered as a choice and the narrower one was taken: on the
dated axis that chevron is the whole feature, since it hides ROWS rather than a list on a
card's face, and its on-card button is `tabindex="-1"`, so the menu is its only keyboard
path.

## Removed unconditionally, then narrowed to what a card already reaches

The first pass took every entry, on the reasoning that the children are already on the
card and each already opens on a click. That reasoning holds **only where the child has a
card of its own**, and review pointed at the case where it does not
(Codex, PR #137, arriving at it through the roadmap).

Unfocused, both card projections give every result a card — `requirementsWorkflow`'s own
comment says so of the board, and `roadmapRows` is `model.results` — so a child listed on
its parent's face is also a card, reachable by the roving selection. **Under a FOCUS the
cards are the focus level's alone.** A child then appears in exactly one place, its
parent's `tabindex="-1"` list, and the removed entries were the whole keyboard path to it.
That is not a filter question: it holds with no quick filter running, so no amount of
match-section work reaches it.

So the entries came back subtracted by `carded`, the same "already on screen" set the
match walk uses — `unreachableChildren` in `childrenList.ts`, answered per
projection by `cardedPaths` in `menu.ts` (the board's columns, or the roadmap snapshot its
own keyboard walk is built from). The clutter this task was raised for was an unfocused
board with fat cards, and there the list is empty.

**What that does not fix**, and it is older than this task: the roadmap draws no match
links on a card face at all — `renderCardMatches` is the board's. So a focused roadmap
card's deep matches (a grandchild, not a listed child) are named nowhere and reachable by
nothing. Filed as [[The roadmap names no matches under a card]].

## The consequence that needed fixing with it

A match under a card was reachable from the menu in one of two ways: as
`Open match "…"`, or — when the card's own disclosure already listed it — as
`Open child "…"`. `undisclosedMatches` subtracts the disclosed ones precisely because
one menu must not name an item twice.

Removing the child entries removed the second way, so a filtered match that happened to
be a direct child became reachable by pointer only: listed on the card face, in a list
whose entries are `tabindex="-1"`, and named nowhere in the menu. That is the failure
`src/view/CLAUDE.md` records for the board's hidden-match links, arrived at from the
other direction.

That was fixed by splitting the dedup per SURFACE: `undisclosedMatches` for the card
FACE, and `matchesUnderCard` — the same walk without that subtraction — for the menu,
where nothing else named the children any more.

**The split lasted a day and is gone.** Once `Open child "…"` came back for the
unreachable children, the unsubtracted walk offered every matched one TWICE, which is the
list this task exists to shorten (Codex again, on the fixing commit). Both surfaces read
`undisclosedMatches`; the menu's child entries own a listed child, the match section owns
everything deeper. `carded` is still subtracted inside the walk, so an item with a card of
its own is offered by neither.

## How it is checked

- `test/view/cardChildren.test.ts` — the toggle is still offered on a right-click, on the
  menu key, and on a shelf card; and a card with no disclosure offers neither
  `Show children` nor `Hide children`.
- `test/view/cardChildren.test.ts` again, over four mounts in one case: board and roadmap,
  each focused and unfocused. Focused offers one entry per child and opening one opens
  **that note** (asked of the vault, since a wrong item would still carry a plausible
  name); unfocused offers none. Both directions were watched failing — the entries deleted
  for the first pair, the `carded` subtraction dropped for the second.
- The no-duplicate rule is asserted as a COUNT rather than as a name, in both suites: on a
  focused board and on the Deliverables board, exactly one menu entry ends in the matched
  child's title. Which section owns it has now moved three times, and the count is the part
  that has to hold across the next move. Watched failing with the subtraction dropped.
