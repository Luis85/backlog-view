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

An absence is deliberately never a work item — no parent, no rank, no ladder rung — but it
is not typeless either: it carries its own declared type, one `pruneOutsideHierarchy`
never gets asked about because the exclusion happens earlier and UNCONDITIONALLY, where
`src/domain/readItems.ts` reads each note, before a `RawItem` is ever built and whether or
not `hierarchyOnly` is on. That is the opposite polarity from a marker
([[Milestones as their own type]]): a marker is recognized and KEPT, ranked out of the
ladder but still a `BacklogItem`; an absence is recognized and DROPPED, so a vault with
`hierarchyOnly` off — where every note a folder-scoped Base returns becomes an item —
excludes it the same way a stricter vault already would. It is a note with four facts now,
not three: which resource, a date range, read through the same assignee and date
properties [[Assignment]] and [[The timeline]] already configure, and its own type name —
the one property here that IS a second vocabulary, of exactly one value. It renders once,
in the row its own resource names, and it is never offered anywhere else this backlog
already looks.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Adding an absence from a resource's row header |
| **Preconditions** | Roadmap mode is on with the resources axis, and BOTH date properties are configured — sharper than the axis's own gate (`hasDateAxis` accepts either alone), because an absence has no descendant to infer a missing end from the way a work item does |
| **Guarantee** | An absence names exactly one resource and one date range, is never added to the tree, the board, the horizon axis or the plain dated axis regardless of the `hierarchyOnly` setting, and is never a write target for anything else this backlog already does to a work item. |

**Main flow**

1. The user opens Add absence from a resource's row header.
2. The prompt asks for the resource, pre-filled from the row, a title, a start date and
   an end date.
3. Submitting writes a new note carrying the resource's name in the assignee property,
   the two dates in the start and target properties, its own declared type, and the
   title as its own — nothing else.
4. The row draws it as a blocked stretch, positioned exactly as a bar would be, in that
   resource's row only.

**Extensions**

- **1a — only one of the two date properties is configured.** Add absence does not
  offer itself: the resources axis's own gate (`hasDateAxis`) accepts either property
  alone, but an absence's range needs both ends WRITTEN, and there is nothing beneath
  an absence to infer a missing one from — so this trigger needs the sharper
  precondition above, not the axis's.
- **2a — the prompt is submitted with no resource, no start or no end.** Nothing is
  written. An absence's range needs both ends stated; unlike a work item's, there is
  nothing beneath it to infer a missing one from.
- **2b — the end is before the start.** Nothing is written either, and for the same
  reason as 2a: a written absence has no shelf of its own to fall back to the way a
  work item's reversed pair does ([[Bars from two dates]]), so there is no visible
  surface for a reversed range to land on once the note exists. The prompt is where
  this is caught, not the render.
- **3a — the folder configured for absences is not yet set.** Falls back to the
  backlog's own home folder, the same default a type with no folder of its own already
  resolves to — safe to share with every other type's notes, because what keeps an
  absence out of the tree and the other axes is its type, never its folder.
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

- Add absence offers itself only when both date properties are configured — the
  resources axis's own precondition (either property alone) is not enough, since an
  absence cannot infer a missing end.
- Submitting the prompt with a resource, a title and both dates writes one new note
  carrying exactly those facts — no parent, no order, and its own declared type rather
  than one from the ladder.
- That type is recognized and the note excluded from the model unconditionally — before
  `RawItem` is built, whether or not `hierarchyOnly` is on — never relying on lacking a
  parent or a supported type the way an ordinary untyped note is excluded.
- A blank resource, start or end writes nothing; an end before the start writes nothing
  either, caught at the prompt rather than left to a render with nowhere to show it.
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
`BacklogItem`: `src/domain/readItems.ts` (`createItems`/`addItem`) would recognize its
declared type and skip the note before a `RawItem` is built from it, unconditionally,
never reaching `pruneOutsideHierarchy` — which runs only when `settings.hierarchyOnly`
is true (`buildModel` in `src/domain/model.ts`) and would therefore be the wrong gate
for an exclusion that has to hold either way. The type name itself would join
`src/domain/typeVocabulary.ts` as its own fourth category, opposite `MARKER_TYPES` in
polarity: a marker is recognized and kept, ranked out of the ladder but still read; this
is recognized and dropped, never read at all. Creating and deleting one would still go
through `src/storage/frontmatter.ts`, the only module allowed to touch the vault, behind
the same `configProblems` gate every other write here answers to — a narrow function
beside `createBacklogItem` rather than a call to it, since an absence has no parent and
no rank for that function's `NewItemSpec` to carry, and its type is a fixed constant
rather than one `NewItemSpec` chooses from the ladder. The prompt itself would sit
beside `ValuePromptModal` in `src/ui/prompts.ts` — one more small form asking for values
this plugin does not own.
