---
type: PBI
parent: "[[Creating items]]"
order: 30
status: Done
---

# Backfill missing properties

**As** someone with a folder of notes that is *already* a backlog in everything but its
frontmatter, **I want** one button that writes the properties for me, **so that** adopting
this view costs a click rather than an afternoon of hand-editing.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner adopting the view on existing notes |
| **Trigger** | The ✨ **Assign missing type and order properties** button in the toolbar |
| **Preconditions** | The view options are valid; the tree has loaded |
| **Guarantee** | **Existing values are never overwritten.** The button fills gaps; it does not normalise, tidy or re-type anything already set. |

**Main flow**

1. The user presses ✨.
2. The view walks the tree and collects every result note missing `type`, `order`, or both.
3. For each, it plans the value already being *shown*: the implied level
   ([[Level ladder and implied types]]) for `type`, and a place at the end of its sibling
   group for `order`.
4. The batch is written, progress ticking in the toolbar as each file lands.
5. One refresh follows — not one per file — and the whole batch is a single undo.

**Extensions**

- **2a — nothing is missing.** No writes at all, and the existing undo slot is kept.
- **3a — the item's parent is outside the Base's filter.** No type is guessed for it. The
  parent's own level is not this base's to know, so the implied level would be a guess
  about a guess.
- **3b — the item already has the property.** Skipped. This is the rule the whole feature
  turns on.
- **4a — a write fails partway.** The prefix that landed stays applied and stays undoable,
  and the view still refreshes — the notes already written are on disk and the tree has to
  show them.

## Acceptance criteria

- Existing values are never overwritten.
- No type is guessed for an item whose parent is outside the view.
- The whole batch is one refresh and one undo, with progress shown while it runs.
- The values written are the ones that were already on screen, so the tree does not move
  when the button is pressed.

## Where it lives

`src/domain/writePlan.ts` (`computeInitWrites`) ·
`src/view/interactions/structure.ts` (the toolbar action) ·
`src/storage/frontmatter.ts` (`applyWrites`).
Tests: `test/domain/writePlan.test.ts`, `test/view/toolbar.test.ts`,
`test/view/contextRowWrites.test.ts`.
