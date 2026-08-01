---
type: PBI
parent: "[[Work item hierarchy]]"
order: 50
status: Done
---

# What counts as a work item

**As** someone whose backlog folder also holds meeting notes, references and a README,
**I want** the view to show the work and leave the rest alone, **so that** pointing a base
at a folder does not turn every note in it into an untyped top-level item — and does not
let one button write `type` and `order` into a document that is not a task.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner with a folder-scoped base |
| **Trigger** | Building the model, after parent links are resolved |
| **Preconditions** | "Ignore notes outside the hierarchy" is on — the default |
| **Guarantee** | A pruned note leaves the model **entirely**. Nothing downstream — backfill, rollups, ranking, the item count — can see it, so no later feature has to remember the exclusion. |

**Main flow**

1. A base filtered with `file.inFolder(…)` returns every note living there.
2. A note **belongs** to the backlog if it declares one of the six types, or has a parent
   in any form: an explicit link, an empty root marker, a folder-inferred one, or a link
   that resolves to nothing.
3. The test runs per **root subtree**, not per note: one participant keeps the whole
   component.
4. Everything else is dropped, and the toolbar says how many.

**Extensions**

- **1a — the option is turned off.** Every note in the base is an item again, which is
  what someone organising an untyped folder wants before the backfill runs.
- **2a — the note declares `Issue` or `Bug`.** It belongs. An extra type is a work item by
  exactly the argument a level is; counting only the ladder once dropped a parentless Bug
  out of the model, the note vanishing moments after it was typed
  ([[Parentless extra type dropped from the model]]).
- **2b — the note's parent link is dangling.** It belongs. Someone meant it to be in the
  hierarchy, and a typo must not delete it from the view that could fix it.
- **2c — the note's anchor is a folder note the filter excluded.** It belongs, because it
  is anchored whether or not this base loaded the anchor.
- **3a — an untyped note has typed children.** The whole subtree stays: an untyped
  container of work items is a container of work items.
- **3b — a typed note has untyped children.** They stay too, for the same reason from the
  other direction.
- **4a — the base is empty because everything was pruned.** The empty state says exactly
  that — how many notes have no supported type and no parent — and offers the way out
  rather than looking broken. A base full of plain notes is a different problem from a
  base with nothing in it, and it must not read as the same one.

## Acceptance criteria

- A note with no supported type and no parent, in any form, is not a backlog item.
- Belonging is decided per subtree, so one typed note keeps its untyped relatives.
- Pruned notes leave `items` and `byPath`, so backfill can never write to one and rollups
  can never count one.
- The number dropped is reported in the toolbar, and named in the empty state with the
  option that changes it.
- Turning the option off restores "every note is an item".

## Where it lives

`src/domain/viewOptions.ts` (`hierarchyOnly` — "Ignore notes outside the hierarchy") ·
`src/domain/model.ts` (`pruneOutsideHierarchy`, `ignoredCount`) ·
`src/view/render/toolbar.ts` (`renderIgnoredNote`) ·
`src/view/render/emptyStates.ts` (`emptyHint`).
Tests: `test/domain/model.test.ts`, `test/domain/itemTypes.test.ts`,
`test/view/toolbar.test.ts`.
