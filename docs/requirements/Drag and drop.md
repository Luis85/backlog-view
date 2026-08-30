---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Drag and drop

**As** someone reprioritising a backlog, **I want** to pick a row up and put it where it
belongs, **so that** reordering is the gesture I already know from every other backlog
tool rather than an editing session across several notes' frontmatter.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a row by its grip |
| **Preconditions** | The quick filter is off; the dragged row is one of the Base's own results |
| **Guarantee** | The tree is never left in a shape the model cannot represent. An illegal drop is refused before it writes, not repaired afterwards. |

**Main flow**

1. The user starts dragging a row.
2. As the pointer moves over the tree, the view resolves the position under it into one of
   three zones and shows an indicator for it: **between** two rows (rank it there),
   **onto** a row (make it that row's child), or the **bottom strip** (make it top level).
3. The user drops.
4. The view plans the change — a new `parent` where the parent changed, a new `order`
   for the rank — and writes as few notes as it can, usually one
   ([[Sibling ranking]]).
5. The tree refreshes once, with the row in its new place.

**Extensions**

- **1a — the quick filter is active.** Rows are not draggable at all. Under a filter,
  visual neighbours are not siblings, and a drop "between" two of them would mean
  something the user did not see.
- **1b — the row came from outside the Base's filter.** It is context only: never
  draggable, never a drop's ranking peer, never written to.
- **2a — the pointer is over a collapsed row.** Hovering long enough expands it, so a drop
  deep in the tree is reachable without giving up the drag.
- **3a — the drop is onto the row itself, or onto one of its own descendants.** Refused: it
  would make a cycle. The indicator says so before the drop rather than the write failing
  after it.
- **3b — the drop changes nothing** (same parent, same position). No write at all: a batch
  that writes nothing must not cost the user their undo of the change before it.
- **3c — the target group holds a row the Base excluded.** Nothing is appended and nothing
  is renumbered. A ranked excluded row is read as a placement constraint like any other —
  it is in the population `anchoredOrder` walks — so the drop takes a number between the
  neighbours it landed among and writes the dragged note alone; an unranked one constrains
  nothing and is skipped. Where no number fits between those neighbours the drop is refused
  and the message names the remedy — see [[Sibling ranking]].

## Acceptance criteria

- Drop targets are indicated before the drop, and an illegal drop (onto a descendant, or
  onto itself) is refused rather than corrupting the tree.
- Hovering a collapsed row long enough expands it, so a drop deep in the tree is reachable.
- Dragging is disabled while the quick filter is active: visual neighbours are not siblings.
- A row from outside the Base's filter is never draggable and never a ranking peer.
- A drop that changes nothing writes nothing.

## Where it lives

`src/domain/dropTargets.ts` (the zone maths and the legality rules) ·
`src/view/interactions/dragDrop.ts` (drag state, indicators, hover-expand) ·
`src/domain/writePlan.ts` (what the drop would write).
Tests: `test/domain/dropTargets.test.ts`, `test/view/dragDrop.test.ts`,
`test/domain/writePlan.test.ts`.
