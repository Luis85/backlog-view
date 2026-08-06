---
type: PBI
parent: "[[Work item hierarchy]]"
order: 70
status: Open
priority: P2
created: 2026-08-06
source: user request
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/view/render/rows.ts
  - styles/badges.css
---

# Deliverables as a rootable extra type

**As** someone tracking concepts, designs and other things the team must produce, **I
want** to type an item as `Deliverable` and create it with or without a parent, **so
that** a design doc isn't forced to invent a parent it doesn't have, while a deliverable
that genuinely belongs to a Feature or a PBI can still hang from it.

`Issue` and `Bug` already sit beside the ladder ([[Types beside the ladder]]), pinned at
`EXTRA_TYPE_RANK` and holding Tasks wherever they hang. `Deliverable` is the same shape
with one addition neither of them has: it is also offered at the **top level**, with no
parent at all — the one thing today's extra types are never *offered*, even though
nothing stops a user producing one by hand
([[Parentless extra type dropped from the model]]).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, or at the top level, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | A `Deliverable`'s rank is a property of the type, fixed at `EXTRA_TYPE_RANK` wherever it sits, exactly as an `Issue`'s or a `Bug`'s is — no drag or reparent ever changes it, whether or not it has a parent. |

**Main flow**

1. The user opens the **+** on an `Epic`, `Feature` or `PBI` row, or the top-level **+**
   with no row selected.
2. The modal offers `Deliverable` alongside the ladder's own child — under a real
   parent, beside `Issue` and `Bug`; at the top level, beside the ladder's top and the
   markers.
3. The user names it; the view writes `type` and `order` (and `parent`, when there is
   one), filing the note in the `Deliverable` folder ([[Where new items are filed]]).
4. The Deliverable renders with its own icon and colour, ranked as though it were a PBI
   wherever it hangs.
5. Opening **+** on that Deliverable offers `Task` alone.

**Extensions**

- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped.
- **2b — the row is itself an `Issue`, `Bug` or `Deliverable`.** Its only children are
  Tasks, so again nothing is asked.
- **3a — the user drags an existing Deliverable to a different parent, or to the top
  level.** Its type is left alone — `levelIndex === -1` means "not a rung", exactly as
  it already does for `Issue` and `Bug`.
- **4a — the Deliverable has no parent at all**, whether created that way or dropped
  there. It stays in the model: a recognised type is enough to belong
  ([[Parentless extra type dropped from the model]]), and this is the first extra type
  the creation flow itself offers that way rather than only tolerating it after a drag.

## Acceptance criteria

- `Deliverable` joins the fixed vocabulary, pinned at `EXTRA_TYPE_RANK`; its children
  are `Task`s under an Epic exactly as under a PBI or at the top level.
- It is offered by the **+** modal both under an `Epic`, `Feature` or `PBI` (beside
  `Issue` and `Bug`) and at the top level with no parent (beside the ladder's top and
  the markers) — the one type offered in both places.
- It is never re-typed by a move, whichever parent it lands under or whether it lands
  with none.
- It files into its own folder (`typeFolder.deliverable`, shipped default
  `deliverables` under the home folder), like every other declared type.
- It renders with its own icon and badge colour, and the test asserting the badge table
  covers the whole vocabulary covers it too.
- A parentless Deliverable is never pruned by `hierarchyOnly`.

## Where it lives

`src/domain/settings.ts` — `Deliverable` joins `EXTRA_TYPES`, and
`DEFAULT_TYPE_SUBFOLDERS` gains `deliverable: 'deliverables'`; `ALL_TYPES` and the
per-type folder options in `viewOptions.ts` are already generic over the vocabulary and
need no change of their own.
`src/domain/itemTypes.ts` — `childTypeChoices`' top-level branch (`!parent`) offers
`Deliverable` alongside the ladder's top and `MARKER_TYPES`, the one addition this PBI
makes to a function that otherwise treats `Deliverable` exactly as it already treats
`Issue` and `Bug`.
`src/view/render/rows.ts` — the badge table gains a `deliverable` entry (icon and badge
class); `styles/badges.css` gains the colour.
