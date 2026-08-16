---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 30
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# Sibling ranking

**As** someone moving one item, **I want** one note to change, **so that** my vault's
history stays readable and a reordering session does not show up as hundreds of edits
across notes I never touched.

## Use case

| | |
| --- | --- |
| **Actor** | The view, planning a move |
| **Trigger** | Any move that changes an item's position among its siblings |
| **Preconditions** | The destination sibling group is known and its members are all results |
| **Guarantee** | The rendered order after the write is the order the user saw indicated before it — whichever branch below was taken. |

**Main flow**

1. `order` is a **fractional rank** within a sibling group, not an index.
2. A drop between two items takes the **midpoint** of their two orders.
3. That is one number, on one note: a single write, whatever the group's size.

**Extensions**

- **1a — the group holds a row the Base excluded.** Renumbering is **refused** and the item
  is appended instead. The excluded row's real siblings were never loaded, so a renumber
  would be assigning ranks in a group the view cannot see the whole of.
- **1b — an excluded row is *visible* in the group.** Its `order` is still **read** — by
  `afterHighestKnown`, by the end-of-siblings maths, by the backfill's max-order scan — so
  the item does not land above something the user can see. Read, never written.
- **2a — the two neighbours have no gap left between them.** The whole group renumbers to
  spaced values, and the item takes its place among them. This is the expensive branch, and
  it is why the orders are spaced rather than consecutive in the first place.
- **2b — the item is dropped at the start or the end of the group.** It takes a value
  before the first or after the last; no midpoint is needed.

**Guarantees**

- Ranking always runs over the **real** roots, never the rendered ones. Focus mode makes
  the rendered top row a synthetic group whose members are not siblings at all, and
  ranking against it would write nonsense. This is a lint rule, not a convention.

## Acceptance criteria

- A drop writes as few notes as possible — usually one.
- Renumbering is refused when the group holds a row the Base excluded, since its real
  siblings were never loaded; the item is appended instead.
- Ranking always runs over the real roots, never the rendered ones — enforced by lint,
  because focus mode makes rendered roots a synthetic group.
- An excluded row's `order` is read for placement and never written.

## Where it lives

`src/domain/writePlan.ts` (`orderBetween`, `computeInsertOrder`, `renumberWrites`,
`afterHighestKnown`) ·
`src/domain/dropTargets.ts` (`reorderableGroup`).
Tests: `test/domain/writePlan.test.ts`, `test/domain/writePlanContextRows.test.ts`,
`test/view/contextRowWrites.test.ts`.
