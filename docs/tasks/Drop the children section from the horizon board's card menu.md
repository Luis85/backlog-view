---
type: Task
order: 70
parent: "[[Children on the card]]"
status: Done
priority: P2
area: usability
created: 2026-08-17
closed: 2026-08-17
source: Asked for directly, alongside putting the shelf first on the horizon board
files:
  - src/view/childrenList.ts
  - src/view/interactions/menu.ts
  - test/view/horizonMenu.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Drop the children section from the horizon board's card menu

## Evidence

Asked for directly: the horizon board's right-click menus were still carrying the
`Show/Hide children` toggle and the `Open child "…"` entries, and none of them are wanted
there. The card's own face disclosure stays — what goes is the menu's copy of it, on this
one board: bucket cards, shelf cards and context cards alike. The board and the dated
axis keep the section [[Drop the per-child entries from the card menu]] already narrowed,
and the dated axis's toggle is untouchable anyway — its chevron folds ROWS, which is the
whole feature there.

## Where the gate lives, and why it is two gates

`horizonBoardShowing` in `src/view/childrenList.ts` — `interactions/plan.ts`'s own
spelling of "the horizon board is on screen", the projection AND the drawn axis, since
neither alone can answer it. `addChildrenSection` returns on it before the separator,
which removes the toggle and the entries from every menu the board builds.

`menuChildren` carries the same gate itself rather than trusting the section's, because
`matchesFor` subtracts exactly that list from the match walk: gated in one place only, a
matched uncarded child would be ceded to entries no menu draws and named nowhere. With
the list empty, ownership moves — such a child is offered as `Open match "…"` now — and
the count invariant ("exactly one menu entry ends in a matched child's title") holds
through the move, which is the drift it was written to allow. The face's links are
untouched either way: they subtract `listedChildren`, never `menuChildren`.

## What this withholds, stated rather than smoothed over

- **The face disclosure has no keyboard path on this board.** Its toggle is a
  `tabindex="-1"` button and the menu entry was that path; on the horizon board the
  disclosure is pointer-only now. The tree and the other card projections still carry
  both.
- **Under a focus, an unmatched child with no card of its own is unreachable from this
  board.** The narrowing that brought the entries back on 2026-08-15 existed for exactly
  that child; here the reader reaches it through the tree, the board, or the quick
  filter's match entries.

## Checks

`test/view/horizonMenu.test.ts`: no toggle on a bucket card that drew a disclosure, no
`Open child` under a focus, no toggle on a shelf card — and the dated axis's shelf card
keeps its toggle, the boundary that stops the exemption spreading. The ownership move is
pinned where the old claim was: the bucket-card case in `test/view/roadmapMatches.test.ts`
now expects `Open match`, absent `Open child`, count exactly one.
