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
  - src/view/projection.ts
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

## Where the gate lives, and why it is one gate

`menusListChildren` in `src/view/projection.ts` — the projection AND the drawn axis,
since neither alone can answer it. `addChildrenSection` returns on it before the
separator, which removes the toggle and the entries from every menu the board builds.
That return is the whole of the exemption.

It shipped as TWO gates, and the second was already dead when it was written. This note
said `menuChildren` had to carry the same gate itself because `matchesFor` subtracted that
list from the quick filter's match walk — so a matched uncarded child, gated in one place
only, would be ceded to entries no menu draws and named nowhere. `matchesFor` had been
deleted before this task started (88e03e8, with the quick filter itself), so the copy was
never reachable: `addChildrenSection` returns above every caller of it on this board. It
went on 2026-08-17, and `menuChildren` now records what it is NOT doing, so the copy is
not re-added for a reason that no longer exists. The face's links are untouched either
way: they subtract `listedChildren`, never `menuChildren`.

The predicate moved out of `src/view/childrenList.ts` with the second gate. That file is
pure and DOM-free so the disclosure and its keyboard path can share one answer, and with
`menuChildren` no longer asking, this answer was the menu's alone — a projection identity
test, which `src/view/projection.ts` is where this repository already keeps.

## What this withholds, stated rather than smoothed over

- **The face disclosure has no keyboard path on this board.** Its toggle is a
  `tabindex="-1"` button and the menu entry was that path; on the horizon board the
  disclosure is pointer-only now. The tree and the other card projections still carry
  both.
- **Under a focus, a child with no card of its own is unreachable from this board.** The
  narrowing that brought the entries back on 2026-08-15 existed for exactly that child;
  here the reader reaches it through the tree or the kanban board. There is no third route:
  the quick filter's `Open match` entries were the other one, and they went the same day.

## Checks

`test/view/horizonMenu.test.ts`: no toggle on a bucket card that drew a disclosure, no
`Open child` under a focus, no toggle on a shelf card — and the dated axis's shelf card
keeps its toggle, the boundary that stops the exemption spreading.
