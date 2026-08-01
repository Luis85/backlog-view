---
type: PBI
parent: "[[Backlog and board]]"
order: 20
status: Open
priority: P1
created: 2026-08-01
files:
  - src/view/render/columns.ts
---

# What a card shows

A card is a result row wearing a different layout: the same name, type badge, property
chips and tag pills, plus its place in the tree. Azure DevOps cards carry child
checklists and GitHub Projects cards a sub-issue progress pill for the same reason —
on a board, the hierarchy has to travel on the card.

## Acceptance criteria

- A card renders the item's name, its type badge, the visible property chips the row
  would render, and its tag pills. Both projections read the same resolved column list
  (`host.chips`), so a property hidden in the tree is hidden on the card.
- The parent renders on the card as context — including a parent outside the Base's
  filter, which labels the card and is never itself one.
- A parent item's card carries its rollup, so descendants the board is not showing
  surface as progress rather than disappearing.
- A done card is styled done. Activating a card opens its note, exactly as activating
  a row does.
