---
type: PBI
parent: "[[The map draws]]"
order: 20
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Activities in narrative order

**As** someone telling the story of the product, **I want** the activities to read left to
right in the order they happen, **so that** the map is a narrative rather than an alphabetised
list.

The order is `order`, compared across parents. That is the decision [[Storymaps]] records and
the reason this is its own use case: `order` ranks siblings today, and reading it across
Features widens what the number means — with a consequence on the tree that has to be visible
rather than discovered.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | The map drawing its activities row |
| **Preconditions** | The base returned at least two use cases on the same map |
| **Guarantee** | The left-to-right order is total and stable: the same results in the same state always draw in the same order, whatever their parents, and drawing it writes nothing. |

**Main flow**

1. The view collects the use cases on the map.
2. It sorts them by `order`, ascending, regardless of which Feature each one hangs from.
3. It draws one column per use case, in that order.

**Extensions**

- **2a — two activities share an `order`.** The tie is broken by a stable second key, so the
  order does not change between two renders of the same results.
- **2b — an activity has no `order`.** It sorts after everything that has one rather than
  being treated as zero, and the map says the value is missing rather than inventing a
  position.
- **3a — the reader wants to rearrange the journey.** Dragging an activity writes a new
  `order`, which re-ranks it among its own Feature's siblings as well. That effect on the tree
  is announced with the move, not left to be found.

## Acceptance criteria

- Sorting is total and stable: a fixture whose activities span three Features with duplicate
  and missing `order` values draws the same sequence on repeated renders.
- A missing `order` sorts last, and a test distinguishes that from sorting as zero.
- Rearranging an activity on the map produces exactly the batch a tree re-rank would, and its
  effect on the sibling set is stated in the announcement the move makes.
- Nothing about this sort reads the tree's depth or level, so an activity's parent has no
  effect on its position.

## Where it lives

The sort belongs to this epic's projection module in `src/domain/`, and nothing about it may be
re-derived: `src/domain/model.ts` is the one statement of what `order` means, and the
cross-parent comparison is a widening of that reading rather than a second copy of it. The
re-rank a drag produces is `src/view/interactions/structure.ts`, unchanged — which is the point
of the announcement this use case owes.
