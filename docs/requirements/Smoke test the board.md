---
type: Feature
parent: "[[Feature Test]]"
order: 20
status: Open
created: 2026-08-02
source: user request
---

# Smoke test the board

The board projection over the same backlog: columns, cards, and state writes gated the
same way the tree's are, checked once against a real vault.

**Outcome** — Every case below has been looked at, with the result written into its own
`Issue`'s Runs table, so a stale check is visible rather than assumed.

## Use cases

- [[Board columns and the filtered header]] — a column per configured state plus the
  no-state column, and a filtered header reading "3 of 12".
- [[Board card carrying hidden matches]] — a card showing that a match is hidden beneath
  it under a narrowed filter.
- [[Board card moves]] — dragging a card between columns, Alt+Left/Right, and the card
  menu's Set state offering the rendered columns.
