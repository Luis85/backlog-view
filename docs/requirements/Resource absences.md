---
type: PBI
parent: "[[The resource timeline]]"
order: 30
status: Open
created: 2026-08-13
source: user request
---

# Resource absences

**As** someone planning who is free, **I want** to mark a resource's own unavailable
stretch, **so that** a row I am about to drop work into already shows the days nobody
should be scheduled across.

An absence is deliberately never a work item — no parent, no rank, no place in the fixed
type vocabulary — the same way an ADR opts out of the backlog it documents rather than
joining it under a type nobody asked it to carry. It is a note with three facts: which
resource, and a date range, read through the same assignee and date properties
[[Assignment]] and [[The timeline]] already configure, so nothing here is a second
vocabulary. It renders once, in the row its own resource names, and it is never offered
anywhere else this backlog already looks.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Adding an absence from a resource's row header |
| **Preconditions** | Roadmap mode is on with the resources axis |
| **Guarantee** | An absence names exactly one resource and one date range, is never added to the tree, the board, the horizon axis or the plain dated axis, and is never a write target for anything else this backlog already does to a work item. |

**Main flow**

1. The user opens Add absence from a resource's row header.
2. The prompt asks for the resource, pre-filled from the row, a title, a start date and
   an end date.
3. Submitting writes a new note carrying the resource's name in the assignee property,
   the two dates in the start and target properties, and the title as its own — nothing
   else.
4. The row draws it as a blocked stretch, positioned exactly as a bar would be, in that
   resource's row only.

**Extensions**

- **2a — the prompt is submitted with no resource, no start or no end.** Nothing is
  written. An absence's range needs both ends stated; unlike a work item's, there is
  nothing beneath it to infer a missing one from.
- **3a — the folder configured for absences is not yet set.** Falls back to the
  backlog's own home folder, the same default a type with no folder of its own already
  resolves to.
- **4a — an absence overlaps another absence, or an item's own bar, in the same row.**
  Both draw, stacked; the row's own height grows rather than either one moving to avoid
  the other.
- **4b — the resource an absence names is not on the declared roster and has nothing
  assigned to it.** It still gets a row — an absence can be the first reason a
  resource's row exists, extending
  [[Showing a resources axis on the roadmap]]'s declared-or-observed row list with a
  third source.
- **4c — deleting an absence.** From its bar's own context menu, through Obsidian's
  ordinary file delete rather than this backlog's undo — the note was never one of this
  backlog's write targets to begin with, so there is no batch for the gate to have
  captured an inverse of.

## Acceptance criteria

- Submitting the prompt with a resource, a title and both dates writes one new note
  carrying exactly those facts — no parent, no order, and no type from the fixed
  vocabulary.
- A blank resource, start or end writes nothing.
- The note lives in its own configured folder, falling back to the backlog's home
  folder when unset.
- The absence renders as a blocked stretch in its own resource's row, positioned by the
  same date math a bar uses, and nowhere else.
- A resource named only by an absence still gets a row.
- Overlapping bars and absences in one row stack, with no lane-packing.
- Deleting an absence removes the note through Obsidian's own delete.

## Where it lives

Unbuilt, and the one PBI in this feature that is not an extension of an existing write
path. Reading and placing an absence would be new, small code beside
`src/domain/roadmap.ts` rather than inside it — an absence is deliberately never a
`BacklogItem`, so it cannot be read by `src/domain/readItems.ts` or ranked by anything
`src/domain/model.ts` already walks. Creating and deleting one would still go through
`src/storage/frontmatter.ts`, the only module allowed to touch the vault, behind the
same `configProblems` gate every other write here answers to — a narrow function beside
`createBacklogItem` rather than a call to it, since an absence has no type, no parent
and no rank for that function's `NewItemSpec` to carry. The prompt itself would sit
beside `ValuePromptModal` in `src/ui/prompts.ts` — one more small form asking for values
this plugin does not own.
