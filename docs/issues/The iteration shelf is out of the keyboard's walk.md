---
type: Issue
parent: "[[Cross-cutting concerns]]"
order: 70
status: Open
area: ux
priority: P3
created: 2026-08-21
source: Named while building [[Pulling work into an iteration]], rather than found afterwards
files:
  - src/view/render/iterationBoard.ts
  - src/view/interactions/keyboard.ts
---

# The iteration shelf is out of the keyboard's walk

## Why this exists

The iteration board's shelf draws cards a pointer can pick up and a keyboard cannot
reach. The board's roving selection is a walk of `snapshot.board.columns[col].cards[card]`
(`boardPosition` / `nextBoardPosition` in `src/view/interactions/keyboard.ts`), and a
shelf card is in no column — so Arrow, Home and End step past the shelf entirely, no
shelf card can hold the selection, and Alt+Left/Right therefore cannot pull one in.

The roadmap does not have this gap, because its keyboard is a linear walk of
`roadmap.cards` and the shelf's cards are in it. The board's walk is two-dimensional, and
a band ABOVE the columns is a third thing it has no coordinate for.

What the pointer-only shelf costs, exactly: **the shortcut, not the capability.** Joining
an iteration from the keyboard is `Set iteration` on the item, offered on every plan row
in the tree (`canSetIteration`, `src/view/interactions/labels.ts`), and taking one out is
that menu's `None`. Both write through the same planner this shelf's gestures use. So no
write is unreachable — what is unreachable is doing it on the board where the reader can
see the sprint filling up.

## What would close it

Two shapes, neither costed:

- **A row above the columns in the board's walk.** `BoardPosition` grows a band, or the
  shelf becomes a column-shaped stop of its own with Up from a column's first card
  landing on it. Every rule that reads a position — the fold, `resyncAfterRender`, the
  `listbox` role, Alt+arrow's edge holding — has to answer for the new coordinate.
- **A pull entry on the card menu.** `Add to <iteration>` on a shelf card, and
  `Take out of <iteration>` on a board card, both landing on the two host methods the
  drags already use. Cheaper, and it is the answer the shelf's own pickers took on the
  roadmap — but it puts a third input on a move rather than a keyboard on a band, so the
  selection still cannot rest on a shelf card and the reader still cannot tell which card
  they are acting on without a pointer.

Neither is started. The second is the smaller and probably the right first step.
