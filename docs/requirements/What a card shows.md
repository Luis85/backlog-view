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
| **Guarantee** | What the tree hides, the card hides — both read one resolved column list, so a property invisible in the base is invisible in both. A card draws that list's plain cells; the chip kinds are the tree's, so a card can carry less, never something different. |

**Main flow**

1. The board places the item in its column.
2. The card renders the item's name and its type badge.
3. It renders the plain property cells and the tag pills — filtered from the same
   resolved column list the tree reads (`host.columns`), never resolved a second time, so
   the two cannot disagree about what the base shows.
4. It renders the item's parent as context, so the card says where in the tree it sits.
5. Activating the card opens the note, exactly as activating a row does.

**Extensions**

- **3a — a property is hidden in the tree.** It is hidden on the card. One resolved list
  drives both, which is the reason for reading it rather than re-deriving it.
- **3b — the property is one the tree draws as a chip** (state, horizon or risk). The
  card draws no cell for it. A board card's column already IS its state and a bucket
  already IS its horizon, so a chip inside one would repeat what its position says; risk
  has no such equivalent and is simply absent, which is a card carrying less than its row
  ([ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md) records the
  alternatives — a per-projection skip list, or every chip on every card).
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
  render, and its tag pills. Both projections read the same resolved column list
  (`host.columns`), so a property hidden in the tree is hidden on the card. **Not checked
  in the suite:** that a chip-kind column draws nothing on a card. `test/view/columns.test.ts`
  drives a card against two plain properties and asserts it gets every column that exists,
  which is the reset rule rather than this one.
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
resolved `host.columns` — `renderCardBody` filters it to the `value` and `tags` kinds
before handing it on. The state chip control is deliberately absent — the card's own
column already says the state, and its write affordance is the card menu's Set state.
Driven in `test/view/board.test.ts` through the accessors in `test/helpers/board.ts`.
