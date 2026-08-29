---
type: PBI
parent: "[[Work item hierarchy]]"
order: 40
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

# Folder note hierarchy

**As** someone whose vault already nests work in folders with folder notes, **I want** that
structure read as the hierarchy, **so that** I get a backlog out of the organisation I
already have instead of adding a `parent` link to every note to say what the folder
already said.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner using a folder-organised vault |
| **Trigger** | "Infer parents from folder notes" is turned on in the view options |
| **Preconditions** | Work lives in folders, each with a folder note named for it (`Checkout/Checkout.md`) |
| **Guarantee** | **Files are never moved on disk.** Re-parenting in this mode writes a link, exactly as it does everywhere else. |

**Main flow**

1. The view reads an item's explicit `parent`. If there is one, it wins — always.
2. With no explicit parent, the view walks up the item's folder path looking for a folder
   note: a note whose name matches its own folder.
3. The nearest one found becomes the item's parent.
4. The row renders in that place, indistinguishable from an explicitly linked one.

**Extensions**

- **2a — a folder on the way up has no note of its own.** It is a container, not a work
  item: the walk passes straight through it and keeps climbing.
- **2b — the walk reaches the vault root with nothing found.** The item is top level.
- **3a — the folder note is not among the Base's results.** It is loaded from the vault as
  a context row, so the hierarchy still renders — see [[Filtered bases keep their tree]].
- **4a — the user drags the item somewhere else.** A `parent` link is written, and from
  then on rule 1 applies: the explicit link beats the folder it still sits in.
- **4b — the user clears the parent link.** An **empty marker** is written rather than the
  key being deleted, because deleting it would put the item straight back under its folder
  note — inference would undo the user's own instruction on the next render.

## Acceptance criteria

- An explicit `parent` link always beats the folder structure.
- Container folders with no note of their own pass through.
- Files are never moved on disk; re-parenting writes a link.
- Clearing a parent writes an empty marker rather than deleting the key, or inference
  would immediately undo it.
- The same ancestor walk runs over loaded items and over the vault, so a folder note that
  is not a result places its children identically.

## Where it lives

`src/domain/viewOptions.ts` (`inferFolderHierarchy`, off by default) ·
`src/domain/folderNotes.ts` · `src/domain/writePlan.ts` (the `explicitRoot` marker) ·
`src/view/interactions/create.ts` (children land beside the parent's folder note).
Tests: `test/domain/model.test.ts`, `test/view/creation.test.ts`,
`test/domain/writePlan.test.ts`.
