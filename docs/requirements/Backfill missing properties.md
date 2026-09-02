---
type: PBI
parent: "[[Creating items]]"
order: 0
status: Open
started: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
finished: ""
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
   ([[Level ladder and implied types]]) for `type`, and for `order` a rank that keeps the
   row exactly where it is drawn — above every rank drawn over it and below every rank
   drawn under it that the row could ever be ordered against. One walk in draw order
   hands those out, so two blanks cannot invert each other and no value lands on a rank
   the vault already holds.
5. A missing optional key is created **empty**. The property becomes visible and
   editable in Obsidian's own editor while the item keeps the state and the placement it
   had — none — so neither the board nor the roadmap moves. A horizon, a date or a state
   nobody chose would be the view inventing a plan, which on a roadmap reads as a
   decision.
6. The batch is written, progress ticking in the toolbar as each file lands.
7. One refresh follows — not one per file — the whole batch is a single undo, and the
   notice names both halves: what was set up, and how many items were updated. Where a
   rank could not be placed the notice says the rank was skipped rather than claiming
   there was nothing to do.

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
  *read*, as one of the ranks bounding each blank, because it is on screen: a backfill
  that fills in blanks must not reorder the tree by placing an item above a row the user
  can see.
- **3b — a configured property's key is not the one this item's own workflow reads.**
  There are three state workflows now (requirements, Deliverable, test), each keyed by
  its own optional property, and a note follows exactly one — its type, or its ladder
  ([[A workflow for the tests]]). `state`, `deliverableState` and `testState` are each
  stubbed only when their own resolved key IS the key `stateKeyFor` reads for THIS item —
  asked by key, not by re-deriving the item's category, which the configurations below
  tell apart (measured against one Epic, one `Test case`, one `Deliverable`):
  - **Each workflow keyed distinctly.** Exactly one field lands per item: the Epic gets
    `state`, the `Test case` gets `testState` and not `state`, the `Deliverable` gets
    `deliverableState` and not `state`.
  - **A secondary key left unset, falling back to the requirements one (the shipped
    default).** `state` lands on all three, `Test case` and `Deliverable` included —
    because a falling-back secondary key's own resolved key IS `settings.stateKey`, so
    `stateKeyFor` answers exactly that for those items too. `testState` and
    `deliverableState` themselves stay empty here, but by 5b's rule below, not this
    one: nothing names a property of their own for `optionalKeyFor` to find.
  - **Two or three properties pointed at the SAME explicit key on purpose**
    (`configProblems` allows exactly this pairing). The gate is still per field and still
    the same question, so every field resolving to that key is stubbed together — and
    WHICH rows they land on follows from which key is shared, not from how many fields
    share it. All three pointed at `status`: the Epic, the `Test case` and the
    `Deliverable` each get `state`, `deliverableState` AND `testState`. Only the two
    secondaries pointed at a key of their own: the Epic keeps `state` alone, while the
    `Test case` and the `Deliverable` get `deliverableState` and `testState` together and
    neither gets `state` — because `stateKeyFor` reads the shared key for them and
    `settings.stateKey` for the Epic. A field left unconfigured contributes nothing to
    either shape, by 5b rather than by this gate — `state` and `testState` both on
    `status` with the Deliverable option untouched stubs those two on every row and
    `deliverableState` on none. Every shape is correct rather than narrowed
    further: the fields name one property, and creating it once is what a shared key
    means. Two mechanisms deliver that once, neither of them `stubKeys` (which names one
    raw key per field, duplicates included) — `applyInto` creates a key only while the
    live note lacks it, and `touchedKeys` dedupes the key list the inverse is captured
    from, so the undo cannot read the second copy as a restore conflict.

  So pressing ✨ leaves no empty, unreadable property beside the one a row actually shows
  in the distinct configuration — but in the fallback one it stubs `state` onto a
  `Test case` or a `Deliverable` on purpose, because that IS the only property those rows
  have to gain while sharing the requirements key. (`stateKeyFor` in
  `src/domain/board.ts` is the one place that decides which key an item's workflow uses;
  `missingKeyStubs` asks it rather than re-deriving the answer.)

  **The generated README's property table is a separate reading of the same keys, and this
  gate does not make it true.** `src/domain/backlogReadme.ts` prints "the Deliverable
  workflow's own state on a Deliverable" whenever the requirements key is BOUND and the
  resolved Deliverable key equals it — which is the fallback configuration, where no
  `deliverableState` stub is planned at all, and the shared one, where it is planned on the
  Epic as much as on the
  `Deliverable`. The only configuration whose `deliverableState` stub reaches Deliverables
  and nothing else is the distinct one, and that is exactly the configuration where the
  clause is not printed. "A stub that reaches every Deliverable and never a PBI or a Task"
  was the rationale of the CATEGORY gate this key-equality gate REPLACED; it is recorded
  here as history so it is not restored as a fact. The README row describes what the
  property carries, not what the backfill creates.
- **4a — no rank fits where the row is drawn.** The blank keeps none, and the rest of
  that note's write still lands: the type and the stubs do not depend on how big somebody
  else's `order` is, and withholding them would be a second failure caused by the first.
  It is ordinary rather than exotic — a row drawn later under a different parent can hold
  a LOWER rank than the row drawn before this one, and then no number is both above the
  first and below the second. The count comes out with the writes so the notice can say
  it, and the remedy it names is **Seed ranks from the hierarchy**, the one pass not
  bounded by what is drawn around the row. An unranked CONTEXT row is the second cause and
  the permanent one: it can never be given a rank at all, so a blank that would be ranked
  past one is left blank too rather than sorting a visible row behind itself.
  **Checked by** `test/view/backfillFocusOrder.test.ts` — "says the rank was skipped rather than claiming there was nothing to do", "leaves a blank alone when an unranked context row is drawn above it in the focus list"
- **4b — the item is an orphan**, its parent link resolving to nothing. `order` is written;
  `type` is not. Its real level is unknowable, so an implied one would be derived from the
  provisional top-level position the broken link put it in — a guess about a guess.
- **4c — the item's parent is a context row.** `type` **is** written, from that parent's
  own level. The parent was loaded from the vault, so its level is known and is the one
  already rendering; the value written is the badge the user is looking at. What the rule
  forbids is *writing to* an excluded note, not *reading* one.
- **4d — the item already has the property.** Skipped. This is the rule the whole feature
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
  already on, and an empty state is the no-state column it was already in. **Filling a
  blank rank never moves the row it filled** — and that guarantee stops exactly there, at
  the blank. Two rows whose EXISTING ranks already contradict the drawn order still swap
  when a focused list becomes sortable, because a focused list draws in tree order while
  any of its rows is unranked and in rank order once none is: the SWITCH is what reorders
  it, and no pass that only fills blanks can prevent that. **Seed ranks from the
  hierarchy** rewrites every rank and can.
  **Checked by** `test/view/backfillFocusOrder.test.ts` — "still flips a pair whose EXISTING ranks contradict the drawn order"
- Only configured keys are created — a horizon property with no declared values is not
  one — and only on notes that do not carry them.

## Where it lives

`src/domain/optionalProperties.ts` (`OPTIONAL_PROPERTIES`, the one table of what each
optional
property is called and suggests, and `adoptableProperties`) ·
`src/domain/rankBackfill.ts` (`computeInitWrites`, over `initWriteFor` and
`missingKeyStubs` — the whole-tree pass, beside `writePlan.ts` rather than in it for the
rule ADR 0034 already states about `rankSpread.ts`) ·
`src/domain/rankArithmetic.ts` (`rankBetween`, the arithmetic every placement shares, and
the `roundOrder` grid it lands on) · `src/domain/writePlan.ts` (`ItemWrite`, the record
every plan here produces) ·
`src/domain/rankOrder.ts` (`focusKey`, which decides whether a row drawn later can
constrain a blank at all) · `src/domain/model.ts` (`ownKeys`, which key a note carries) ·
`src/view/interactions/structure.ts` (`runInit`, the action both entry points call) ·
`src/view/backlogView.ts` (`adoptDefaultProperties`, the one write to the `.base` that
is not a user turning an option) · `src/storage/frontmatter.ts` (`applyInto`, where a
stub becomes a key on the note, and only while the live note still lacks it) ·
`src/storage/writeKeys.ts` (`stubKeys`, which resolves a stub field to the raw key both
that write and its captured inverse are named by).
Tests: `test/view/backfillFocusOrder.test.ts`, `test/domain/settings.test.ts`,
`test/domain/writePlan.test.ts`,
`test/domain/writePlanAxis.test.ts`, `test/storage/frontmatter.test.ts`,
`test/view/toolbar.test.ts`, `test/view/contextRowWrites.test.ts`.
