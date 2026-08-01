---
type: PBI
parent: "[[Work item hierarchy]]"
order: 10
status: Done
---

# Parent, order and type properties

**As** someone whose planning already lives in notes, **I want** the hierarchy to be three
ordinary frontmatter properties, **so that** my backlog stays searchable, linkable and
editable as notes rather than becoming a database I can only reach through one view.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The view loads a Base's results |
| **Preconditions** | None — notes with none of the three properties still load |
| **Guarantee** | Reading never writes. A note the view cannot place is shown as unplaced, never hidden and never silently repaired. |

**Main flow**

1. For each result the view reads three keys, each pointing at a configurable property:
   **`parent`** (a wikilink to the parent note; absent means top level), **`order`** (a
   number ranking the item among its siblings) and **`type`** (the level name).
2. `parent` is resolved through Obsidian's own link resolution, so wikilinks, bare names
   and aliases all work and a rename keeps the link.
3. `order` is read tolerantly — a number written as a string still ranks — and a missing
   one sorts last, in the Base's own result order.
4. The three values become the item's place in the tree.

**Extensions**

- **1a — two of the three keys point at the same property.** Every write is blocked and
  the toolbar says why. Guessing which key was meant would corrupt notes.
- **2a — the parent value resolves to nothing.** The item is an **orphan**: it renders at
  top level carrying a marker that says its link is dangling. A typo must not make a note
  disappear from the view that exists to help fix it.
- **2b — the parent value is a list.** The first entry that resolves wins, so a note using
  `parent` for more than this view is still placed.

## Acceptance criteria

- Parent links resolve through wikilinks, bare names and aliases, and survive a rename.
- A missing `order` sorts last, in the Base's own result order.
- A parent value that resolves to nothing marks the item an **orphan** rather than hiding it.
- Property keys are configurable; a collision between two of them blocks writes loudly
  rather than corrupting notes.
- The *keys* are configurable; the type *vocabulary* is not — see
  [[Level ladder and implied types]].

## Where it lives

`src/domain/noteFields.ts` reads the fields · `src/domain/model.ts` links them ·
`src/domain/settings.ts` resolves the keys and reports collisions.
Tests: `test/domain/noteFields.test.ts`, `test/domain/model.test.ts`,
`test/domain/settings.test.ts`.
