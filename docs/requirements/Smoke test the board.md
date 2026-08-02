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

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release: nothing on the list needed adjusting. That is a run of the
whole list and not a per-case record — each `Issue` below still asks for its own points
written down as pass or fail, and each stays open until they are, so a stale check is
visible rather than assumed.

## Use cases

- [[Board columns and the filtered header]] — a column per configured state plus the
  no-state column, and a filtered header reading "3 of 12".
- [[Board card carrying hidden matches]] — a card showing that a match is hidden beneath
  it under a narrowed filter.
- [[Board card moves]] — dragging a card between columns, Alt+Left/Right, and the card
  menu's Set state offering the rendered columns.
