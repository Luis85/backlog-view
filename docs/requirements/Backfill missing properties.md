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
| **Trigger** | The ✨ **Assign missing properties** button in the toolbar |
| **Preconditions** | The view options are valid; the tree has loaded |
| **Guarantee** | **Existing values are never overwritten.** The button fills gaps; it does not normalise, tidy or re-type anything already set. |

**Main flow**

1. The user presses ✨.
2. The view walks the tree and collects every result note missing one of the properties
   this view writes: `type`, `order`, and — where an axis is configured — the roadmap's
   placement keys ([[Horizons or dates]]).
3. For each, it plans the value already being *shown*: the implied level
   ([[Level ladder and implied types]]) for `type`, and a place at the end of its sibling
   group for `order`.
4. A missing placement key is created **empty**. The property becomes visible and
   editable in Obsidian's own editor while the item keeps the placement it had — none —
   so the roadmap does not move either. A horizon or a date nobody chose would be the
   view inventing a plan, which on a roadmap reads as a decision.
5. The batch is written, progress ticking in the toolbar as each file lands.
6. One refresh follows — not one per file — and the whole batch is a single undo.

**Extensions**

- **2a — nothing is missing.** No writes at all, and the existing undo slot is kept.
- **2b — the note came from outside the Base's filter.** Never written to — but the walk
  descends **through** it, so results below one are still backfilled. Its `order` is still
  *read* for the sibling maximum, because it is on screen: a backfill that fills in blanks
  must not reorder the tree by placing an item above a row the user can see.
- **3a — the item is an orphan**, its parent link resolving to nothing. `order` is written;
  `type` is not. Its real level is unknowable, so an implied one would be derived from the
  provisional top-level position the broken link put it in — a guess about a guess.
- **3b — the item's parent is a context row.** `type` **is** written, from that parent's
  own level. The parent was loaded from the vault, so its level is known and is the one
  already rendering; the value written is the badge the user is looking at. What the rule
  forbids is *writing to* an excluded note, not *reading* one.
- **3c — the item already has the property.** Skipped. This is the rule the whole feature
  turns on.
- **4a — the note carries the key with an empty value.** Skipped: presence is the
  question here, and an empty horizon is a key the note has. The *reading* of it says
  untriaged either way, which is why the two are asked separately.
- **4b — the axis is not configured.** No placement key is written for it — never a key
  no property names, the state write's own rule. A horizon property whose values list is
  cleared counts as unconfigured here too ([[Horizons or dates]]), by the same predicate
  the roadmap and the row menu use: creating a key for an axis nothing draws and no
  action can set would be the only write left acknowledging it.
- **5a — a write fails partway.** The prefix that landed stays applied and stays undoable,
  and the view still refreshes — the notes already written are on disk and the tree has to
  show them.

## Acceptance criteria

- Existing values are never overwritten.
- No type is guessed for an **orphan** — an item whose parent link resolves to nothing.
- A note the Base excluded is never written to, and a result below one is still backfilled.
- The whole batch is one refresh and one undo, with progress shown while it runs.
- The values written are the ones that were already on screen, so neither the tree nor
  the roadmap moves when the button is pressed: a created placement key is empty, and an
  empty placement is the shelf the item was already on.
- Only configured placement keys are created — a horizon property with no declared
  values is not one — and only on notes that do not carry them.

## Where it lives

`src/domain/writePlan.ts` (`computeInitWrites`, over `initWriteFor` and
`missingAxisWrite`) · `src/domain/model.ts` (`axisKeys`, which key a note carries) ·
`src/view/interactions/structure.ts` (the toolbar action) ·
`src/storage/frontmatter.ts` (`applyWrites`).
Tests: `test/domain/writePlan.test.ts`, `test/domain/writePlanAxis.test.ts`,
`test/view/toolbar.test.ts`, `test/view/contextRowWrites.test.ts`.
