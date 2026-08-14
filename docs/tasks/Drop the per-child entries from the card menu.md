---
type: Task
order: 50
parent: "[[Children on the card]]"
status: Done
priority: P2
area: usability
created: 2026-08-14
closed: 2026-08-14
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

**The dedup is per SURFACE now, which is what it always meant.** `childrenList.ts` keeps
`undisclosedMatches` for the card FACE — there the disclosure's list and the match links
sit inches apart, and naming an item in both is a repetition — and adds
`matchesUnderCard`, the same walk without that subtraction, for the menu, where nothing
else names the children at all. `carded` is still subtracted in both: an item with a card
of its own is reachable at that card.

## How it is checked

- `test/view/cardChildren.test.ts` — the toggle is still offered on a right-click, on the
  menu key, and on a shelf card; a card with no disclosure offers neither `Show children`
  nor `Hide children`; and the face-versus-menu pair, which asserts the two subtractions
  disagree on purpose.
- `test/view/menu.test.ts` — a filtered match under a Deliverable card is still reachable
  from the menu.

Both of the last two were watched failing with the menu pointed back at
`undisclosedMatches`.
