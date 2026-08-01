---
type: PBI
parent: "[[Moving cards]]"
order: 30
status: Open
priority: P3
created: 2026-08-01
files:
  - src/view/backlogView.ts
---

# The quick filter on the board

The filter narrows cards, not workflow: columns are the shape of the board, matches
are its contents.

## Acceptance criteria

- Filtering hides non-matching cards; every column still renders, its header showing
  matches against the full count while the filter is active. The WIP signal keeps
  reading the full population — a filter must never make an over-limit column look
  under its limit.
- Dragging stays enabled while filtering. A state write does not depend on visual
  neighbours — which is exactly why the tree must disable dragging under the filter
  and the board need not: ranking reads siblings, a column does not.
- The filter is session state in both projections: never written anywhere, and
  switching projections carries it rather than clearing it.
