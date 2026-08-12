---
type: PBI
parent: "[[Backlog and board]]"
order: 20
status: Done
priority: P1
created: 2026-08-01
files:
  - src/view/render/board.ts
  - src/view/render/columns.ts
---

# What a card shows

**As** someone reading a board, **I want** a card to carry what its row carries plus
where it sits in the tree, **so that** switching projections costs me no information
about an item I was already looking at.

A card is a result row wearing a different layout: the same name, type badge, plain
property cells and tag pills, plus its place in the tree. Azure DevOps cards carry child
checklists and GitHub Projects cards a sub-issue progress pill for the same reason —
on a board, the hierarchy has to travel on the card.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board renders a result |
| **Preconditions** | Board mode is on, and the workflow has columns to render into |
| **Guarantee** | What the BASE hides, the card hides — both read one resolved column list, so a property invisible in the properties menu is invisible in both. A card draws that list's plain cells; the chip kinds are the tree's, so a card can carry less, never something different. Not what the PANE hides: the fit is the tree's alone. |

**Main flow**

1. The board places the item in its column.
2. The card renders the item's name and its type badge.
3. It renders the plain property cells and the tag pills — filtered from the same
   resolved column list the tree reads (`host.columns`), never resolved a second time, so
   the two cannot disagree about what the base shows.
4. It renders the item's parent as context, so the card says where in the tree it sits.
5. Activating the card opens the note, exactly as activating a row does.

**Extensions**

- **3a — a property is hidden in the BASE.** It is hidden on the card too. One resolved
  list drives both, which is the reason for reading it rather than re-deriving it. Hidden
  by the PANE is the other question and has the other answer: a narrow tree drops columns
  from its rows and a card keeps every one of them, because a card is never indented and
  never competes for the row's width.
- **3b — the property is one the tree draws as a chip.** State and horizon draw no cell
  on the card: a board card's column already IS its state and a bucket already IS its
  horizon, so a chip inside one would repeat what its position says
  ([ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md)). Risk is in the
  identical position and stays absent too — unasked, not for the same reason. The
  assignee is the one chip kind that DOES draw on a card (2026-08-12): nothing about a
  card's position, on any projection, says who is on it, so it keeps the row's own chip
  rather than becoming a plain, read-only value or a gap indistinguishable from an empty
  property ([ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md)).
- **3c — a plain-value or tags cell has nothing to show.** No cell renders at all, rather
  than an empty one holding a place no header aligns it under. The tree keeps its empty
  cell — its columns are fixed-width and share a header, so a column drawn has to hold
  its place on every row or the ones after it shift — but a card has neither, so an empty
  cell there is only a chip-shaped gap (`padding-inline-end` with nothing beside it). A
  context card with nothing to show on any of its cells now carries none of them, rather
  than one visible chip among several empty ones. The assignee's own UNSET state is not
  this case: its dashed "Assignee" invitation is a value ("nobody yet"), not an absence,
  so it draws exactly as the row's chip does (ADR 0027). Zero tags IS this case, an
  editable item included: the add button that would otherwise be the only content is
  `opacity: 0` until hovered or focused, so a reader sees nothing until they already
  know to look — a card that dropped every other kind of empty cell but kept this one
  would be the one place the fix stopped short (Codex, PR #132). Nothing is lost by
  dropping it: **Edit tags** in the card's own menu is gated on the property being a
  visible column, never on this one item's cell.
- **3d — every cell on the card was 3c.** The wrapper around them (`.pbl-props`) goes
  too — it is itself a flex child of the card's own column layout and gap, so an empty
  one left standing is 3c's gap moved up one level rather than a case it missed. The
  common trigger is a card with exactly one configured plain column and no value for it,
  or a context card with nothing on any cell at all.
- **4a — the parent is outside the Base's filter.** It still labels the card. Reading an
  excluded note to say where something sits is the reading the tree already does; what
  the rule forbids is writing to one. Excluded items appear on the board themselves only
  in the context forms the epic names.
- **4b — the item has children the board is not showing.** Its card carries its rollup, so
  descendants surface as progress rather than disappearing — the answer the tree already
  gives a collapsed parent. A rollup is a number, though, and [[Children on the card]] names
  its *visible direct* children, one level, on the card, expandable — a child hidden by
  "show completed items" is still counted in the rollup and not itself listed; the two
  numbers differ on purpose.
- **5a — the item is done.** The card is styled done and stays a card. Styling is not
  hiding; what hides finished work is the option that says so
  ([[Done columns stay lean]]).

## Acceptance criteria

- A card renders the item's name, its type badge, the plain property cells the row would
  render, its tag pills and its assignee chip. Both projections read the same resolved
  column list (`host.columns`), so a property the properties menu hides is hidden on
  both — while a column the narrow PANE drops off the tree's rows still draws on a card.
  **Checked by** `test/view/columns.test.ts` — "draws no state, horizon or risk chip on a card, but does draw the assignee chip"
- A plain-value or tags cell with nothing to show renders no cell at all on a card —
  the whole `.pbl-props` wrapper too, when every cell inside it was empty — where the
  tree keeps the empty one to hold its column's place. Zero tags counts as nothing to
  show even when editable: the add button that would otherwise be the only content is
  invisible until hover. The assignee's own UNSET chip is not this case — it is a
  deliberate invitation and draws exactly as the row's does.
  **Checked by** `test/view/columns.test.ts` — "drops an empty property cell from a card instead of leaving a gap with nothing in it" (now also asserting the wrapper), "drops a tags cell from a card when there are no tags, add button included", and "keeps the assignee's own dashed invitation chip on a card — unset is not empty"
- The parent renders on the card as context — including a parent outside the Base's
  filter, which labels the card; outside-filter items themselves render on the board
  only in the context forms the epic names.
- A parent item's card carries its rollup, so descendants the board is not showing
  surface as progress rather than disappearing.
- A done card is styled done. Activating a card opens its note, exactly as activating
  a row does.

## Where it lives

`renderCard` in `src/view/render/board.ts` — a renderer, not a second answer to what an
item contains: the badge and highlighted title come from `src/view/render/rows.ts`
(`renderBadge`, `renderTitleText`), the property cells and the rollup from
`src/view/render/columns.ts` (`renderPropCells`, `renderRollup`), all reading the same
resolved `host.columns` — `renderCardBody` filters it to the `value`, `tags` and
`assignee` kinds before handing it on, and passes `{ dropEmpty: true }` so a cell with
nothing to show is not rendered at all — see
[ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md)
for why those two travel together and why state and horizon stay out. `renderCardBody`
is shared by the board, the roadmap's buckets and its shelf (`src/view/render/roadmap.ts`,
`src/view/render/shelf.ts`), so a change here is a change to all three at once. The state
chip control is deliberately absent — the card's own column already says the state, and
its write affordance is the card menu's Set state.
Driven in `test/view/board.test.ts` through the accessors in `test/helpers/board.ts`, and
the card-vs-row kind filter and the empty-cell rule in `test/view/columns.test.ts`, beside
`resolveColumns`'s own suite.
