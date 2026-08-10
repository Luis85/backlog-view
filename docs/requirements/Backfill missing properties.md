---
type: PBI
parent: "[[Creating items]]"
order: 30
status: Done
---

# Backfill missing properties

**As** someone with a folder of notes that is *already* a backlog in everything but its
frontmatter, **I want** one button that sets the properties up and writes them for me,
**so that** adopting this view costs a click rather than an afternoon of hand-editing.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner adopting the view on existing notes |
| **Trigger** | The ✨ **Assign missing properties** button in the toolbar, or the same action offered by the board's and the roadmap's unconfigured empty states |
| **Preconditions** | The view options are valid; the tree has loaded |
| **Guarantee** | **Existing values are never overwritten, and no option already set is changed.** The button fills gaps; it does not normalise, tidy or re-type anything already set. |

**Main flow**

1. The user presses ✨.
2. Every optional property the view options do not name yet — the state, the two date
   stamps, the roadmap's horizon and dates ([[Horizons or dates]]), the risk level
   ([[Setting the risk on an item]]) and the assignee
   ([[Setting the assignee on an item]]) — is bound to the key this view suggests, which is
   the key its picker already shows as a placeholder. The list is stated once, in the
   optional-property table, so a property added there joins this button without anything
   here changing but this sentence. Without this the features that need a property cannot be reached at
   all: Obsidian's own property picker offers the properties a vault HAS, so a
   property no note carries cannot be picked, and a property nothing names cannot be
   written to a note.
3. The view walks the tree and collects every result note missing one of the properties
   this view writes: `type`, `order`, and every optional property that is configured —
   the ones just bound included.
4. For each, it plans the value already being *shown*: the implied level
   ([[Level ladder and implied types]]) for `type`, and a place at the end of its sibling
   group for `order`.
5. A missing optional key is created **empty**. The property becomes visible and
   editable in Obsidian's own editor while the item keeps the state and the placement it
   had — none — so neither the board nor the roadmap moves. A horizon, a date or a state
   nobody chose would be the view inventing a plan, which on a roadmap reads as a
   decision.
6. The batch is written, progress ticking in the toolbar as each file lands.
7. One refresh follows — not one per file — the whole batch is a single undo, and the
   notice names both halves: what was set up, and how many items were updated.

**Extensions**

- **2a — the option is already set.** Left exactly as it is: this binds what nothing
  names, and a property the user picked is an answer, not a gap.
- **2b — the option was CLEARED.** Also left alone, and it is the case that makes this
  ask the view config rather than the resolved settings, which report cleared and never
  set alike. Turning the state property off is a decision; an action that quietly turned
  it back on would be overruling the user rather than helping.
- **2c — the suggested key is already spoken for.** Skipped. Binding a second property
  onto a key another one owns would be reported as a collision and would block every
  write in the view — a worse state than the unconfigured feature it was meant to
  enable.
- **2d — the view options already collide.** Nothing is bound and nothing is written:
  the same gate the write path applies, applied to the options this action writes, so
  the configuration is never changed by an action that then refuses every write.
- **3a — the note came from outside the Base's filter.** Never written to — but the walk
  descends **through** it, so results below one are still backfilled. Its `order` is still
  *read* for the sibling maximum, because it is on screen: a backfill that fills in blanks
  must not reorder the tree by placing an item above a row the user can see.
- **3b — a configured property belongs to a workflow this item does not follow.** There
  are three state workflows now (requirements, Deliverable, test), each keyed by its own
  optional property, and a note follows exactly one — its type, or its ladder
  ([[A workflow for the tests]]). The state property this item's own workflow does not
  read is never stubbed onto it, even when it is configured: a `Test case` gets a
  `testState` stub and not a `state` one, and a `Deliverable` gets a `deliverableState`
  stub and not a `state` one, so pressing ✨ never leaves an empty, unreadable property
  beside the one the row actually shows. Shared keys are unaffected — when a secondary
  workflow's key falls back to the requirements one, both name the same property and the
  gate does nothing (`stateKeyFor` in `src/domain/board.ts` is the one place that decides
  which key an item's workflow uses; `missingKeyStubs` asks it rather than re-deriving the
  answer).
- **4a — the item is an orphan**, its parent link resolving to nothing. `order` is written;
  `type` is not. Its real level is unknowable, so an implied one would be derived from the
  provisional top-level position the broken link put it in — a guess about a guess.
- **4b — the item's parent is a context row.** `type` **is** written, from that parent's
  own level. The parent was loaded from the vault, so its level is known and is the one
  already rendering; the value written is the badge the user is looking at. What the rule
  forbids is *writing to* an excluded note, not *reading* one.
- **4c — the item already has the property.** Skipped. This is the rule the whole feature
  turns on.
- **5a — the note carries the key with an empty value.** Skipped: presence is the
  question here, and an empty horizon is a key the note has. The *reading* of it says
  untriaged either way, which is why the two are asked separately.
- **5b — the property is unconfigured and was not adopted.** No key is created for it —
  never a key no property names, the state write's own rule. A horizon property whose
  values list is cleared counts as unconfigured here too ([[Horizons or dates]]), by the
  same predicate the roadmap and the row menu use: creating a key for an axis nothing
  draws and no action can set would be the only write left acknowledging it.
- **5c — a value arrived after the plan was made.** The key is left as it is. Presence
  is asked of the live note at the write boundary, not trusted from a row that can be a
  refresh behind it — the rule the tag delta and the start stamp already keep.
- **6a — a write fails partway.** The prefix that landed stays applied and stays undoable,
  and the view still refreshes — the notes already written are on disk and the tree has to
  show them. The notice claims nothing the batch did not do.

## Acceptance criteria

- Existing values are never overwritten, and no option the user has set or cleared is
  changed.
- Every optional property nobody has named is bound to the key its picker suggests, and
  pressing the button a second time binds nothing.
- No type is guessed for an **orphan** — an item whose parent link resolves to nothing.
- A note the Base excluded is never written to, and a result below one is still backfilled.
- The whole batch is one refresh and one undo, with progress shown while it runs.
- The values written are the ones that were already on screen, so nothing moves when the
  button is pressed: a created key is empty, an empty placement is the shelf the item was
  already on, and an empty state is the no-state column it was already in.
- Only configured keys are created — a horizon property with no declared values is not
  one — and only on notes that do not carry them.

## Where it lives

`src/domain/optionalProperties.ts` (`OPTIONAL_PROPERTIES`, the one table of what each
optional
property is called and suggests, and `adoptableProperties`) ·
`src/domain/writePlan.ts` (`computeInitWrites`, over `initWriteFor` and
`missingKeyStubs`) · `src/domain/model.ts` (`ownKeys`, which key a note carries) ·
`src/view/interactions/structure.ts` (`runInit`, the action both entry points call) ·
`src/view/backlogView.ts` (`adoptDefaultProperties`, the one write to the `.base` that
is not a user turning an option) · `src/storage/frontmatter.ts` (`applyWrites`, whose
`stubKeys` is where a stub becomes a key).
Tests: `test/domain/settings.test.ts`, `test/domain/writePlan.test.ts`,
`test/domain/writePlanAxis.test.ts`, `test/storage/frontmatter.test.ts`,
`test/view/toolbar.test.ts`, `test/view/contextRowWrites.test.ts`.
