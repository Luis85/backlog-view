---
type: PBI
parent: "[[A catalog of tests]]"
order: 40
status: Done
priority: P2
created: 2026-08-10
source: user request
---

# A workflow for the tests

**As** someone walking a suite before a release, **I want** a test case to carry a state
of its own, **so that** I can say which cases are drafted, ready or approved without
that answer being the same field the plan uses to say whether work is finished.

The catalog shipped as a family of items with no state of their own and no place in the
view options to configure one. This is the **third** workflow, and it is the plan's own
per-item state mechanism a third time rather than a new idea: a property, an ordered list
of values, a done list, a chip, a `Set state`, one gated write, one undo slot.

Two things it deliberately is not. It is **not a result** — pass, fail, run history —
which [[Test Management]] refuses and this changes nothing about: a state is what a case
IS, not how it last ran. And it is **not a board**: the workflow gives the catalog columns
it could have, and nothing here draws them.

What selects it is the **ladder**, not a list of test type names. That is the reason the
whole catalog rests on: a typeless child of a `Test suite` and a `Task` under a
`Test case` are both catalog members
([[Test suite and test case as a ladder of their own]] 4c, [[Tests stay out of the plan]]
2b), and a predicate written as `isTestType(item.typeName)` gets both wrong while passing
every other fixture.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A catalog row's state chip or its `Set state` is opened, or the view options' `Test management` group is edited |
| **Preconditions** | None. With nothing in the group configured the workflow falls back to the requirements one, field by field |
| **Guarantee** | Which workflow an item reads and writes is decided by that item — its type, else its ladder — and never by the projection it is being looked at in. The three workflows keep independent vocabularies whether or not they share a property, so no menu offers a value from a workflow the row is not on. |

**Main flow**

1. The view options carry a **Test management** group: a test state property, the test
   workflow's states in order, and which of those count as done. None of the three is
   required, and the group holds no per-state colour boxes (1b).
2. Each resolves against the requirements workflow as its fallback, and the KEY's own
   fallback decides what the two lists fall back to: an unbound key resolves to the
   requirements state key, and only while it is unbound do the lists take the requirements
   workflow's declared states and its EFFECTIVE done values. An own, distinct key with no
   lists of its own is a genuinely separate workflow and takes the shipped defaults.
3. The model reads every note's test state through the resolved key and marks it done
   against the test workflow's own done values, alongside — never instead of — the
   requirements pair it already read.
4. A catalog row's state chip and its `Set state` read the test workflow's value and done
   flag and offer the states the **catalog's own population** carries; a plan row's read
   the requirements workflow, and a `Deliverable`'s the Deliverable one.
5. A pick plans one write to the resolved test key and nothing else, through the same gate
   and into the same undo slot as every other write in this view.

**Extensions**

- **1a — nothing in the group is configured.** The shipped default, and the one this PBI
  is judged on: the key falls back to the requirements state key, so a fresh vault's tests
  read and write `status` by sharing the plan's property rather than through a second
  option nobody named. That outcome is delivered by a mechanism that already existed —
  `adoptableProperties` refuses a suggestion whose key another property has claimed, and
  `state` is declared first — so on the toolbar's ✨ `state` takes `status` and the test
  property is left unbound. Declaring `testState` after `state` in the property table is
  therefore load-bearing rather than formatting.
- **1b — a per-state colour box is proposed for the group.** Refused, and the consequence
  is recorded rather than discovered. `stateColors` is keyed by the state VALUE, so a test
  state spelled like a requirements or Deliverable state already picks up that state's
  colour with no second control. What a test-ONLY state gives up is more than an override:
  the state colours are painted on the dated axis's bars and its legend and nowhere else,
  and that axis draws no test at all ([[Tests stay out of the plan]]), so a colour keyed to
  a test-only state would be a key for something no screen can draw — the defect
  [[State colour and a legend]] already names. The schema's allowed colour keys therefore
  stay the requirements and Deliverable vocabularies.
- **2a — the key is bound to a property of its own.** Independent from that point on: its
  done values fall to the SHIPPED defaults rather than to a customization made for a
  different property, and its states, left empty, fall through to its own observed values
  the way every other workflow's do.
- **2b — all three workflows resolve to one key.** Which is the shipped default, and it is
  the case that fails closed rather than open. `configProblems` let exactly one PAIR share
  a key; a third user made the length test fail, and a reported collision **blocks every
  write in the view**. The exemption is a SET question now: a key is exempt when every
  label using it is a workflow-state label. One more label of any other kind — order, tags,
  an axis key — reports as a collision again, these named in it like any other clash.
  Sharing by FALLBACK never reaches that map at all, since the collision report reads the
  RAW keys and an unbound one is `''`.
- **3a — the test key and the requirements key are the same property.** A catalog row then
  has one value read twice, once into each workflow's pair, and that is correct rather
  than redundant: which pair a surface reads is still the item's own question, so the two
  agree here and diverge the moment somebody binds a separate property, with no surface
  changed.
- **4a — the catalog's vocabulary is collected before the walk, not after.** The collector
  filters to catalog members FIRST, exactly as the Deliverable's filters by type first, and
  it matters more here because the key is shared by default: without the filter every plan
  row's ordinary status would join the catalog's offered states. It is redundant for the
  one caller this adds, whose population is catalog members and context rows and nothing
  else, and it is still where the correctness lives — a collector is correct over the list
  it is handed, or it is correct by luck.
- **4b — a `Task` under a `Test case`.** Its state is the test workflow's, because
  membership is asked of the ladder and a `Task` takes the ladder it hangs from. A rule
  written over type names would read this row as a plan item and offer it the plan's states
  in a projection that draws it under a case.
- **5a — the backfill is asked to assign missing properties.** With `testStateProperty`
  keyed distinctly from the other two (the ordinary case), it stubs the test state key
  onto catalog members and onto nothing else, the same gate the Deliverable state stub
  already has and for the same reason: a test's state describes a test. Without it, binding
  the property and pressing the button writes an empty test-state key onto every plan item
  in the base — which is what exposing the picker makes reachable, so the gate ships with
  the picker rather than after it. **That is narrowed by the KEY, not by category, though**
  — pointed at the same explicit key `state` or `deliverableState` already use
  (`configProblems` allows exactly that pairing), `testState` is stubbed onto every item
  whose OWN workflow reads that key, which need not be a catalog member. Which items those
  are depends on which key is shared: sharing with `state` reaches plan items too, because
  the two then name the very same property, while sharing with `deliverableState` alone
  reaches Deliverables and leaves plan items on `state` ([[Backfill missing properties]] 3b).
- **5b — a test's state counts as done.** Its row is styled done, by the test workflow's
  own done values and against whatever the requirements key on the same note says. Nothing
  is HIDDEN by it: the catalog withholds the completed toggle and opts out of the
  computation behind it, which having a workflow does not change — see
  [[A projection for the tests]] 3 and [[Tests stay out of the plan]] 3c.
- **5c — a state is picked and then needs taking off again.** The `Set state` list is
  strings on every catalog row, so the removal `computeTestStateWrites(item, null)` plans
  had nothing offering it: the no-state COLUMN is what reaches that target in the other two
  workflows, and the catalog is tree-shaped with no board — this PBI's own second paragraph
  refuses one. It is a **Clear test state** foot instead — the shape this menu already uses for a
  removal — drawn at the end of `addStateItems` (`src/view/interactions/menu.ts`) and so on
  both surfaces at once, since that is the one builder behind the chip and the
  submenu. It is offered exactly when picking it would WRITE something, asked of that same
  planner: the neighbouring Clears gate on `item.ownKeys` presence and that spelling is
  unavailable here, because `readOwnKeys` resolves a field through `optionalKeyFor` — the
  RAW `testStateKey` — while the workflow reads the resolved one, so under 1a's shipped
  default the presence flag is false on every note that carries a state.
- **5d — the residue that gate leaves, which the plugin creates itself.** Asking the plan
  costs everything presence and value disagree about: a key holding any value `readString`
  refuses — blank, whitespace, YAML null, an empty list, a mapping — reads as no value, is
  offered no clear, and comes off only by editing the note. That is **not** a state a user
  has to construct. `applyInto` (`src/storage/frontmatter.ts`) stubs a missing optional key
  as `''`, and 5a has `missingKeyStubs` stub the test state onto every catalog member
  whenever `testStateProperty` is keyed distinctly — so pressing ✨ **Assign missing
  properties** leaves each catalog row a test state key this menu cannot take off again. It
  is recorded rather than fixed here, and it is still not an argument for the `ownKeys` gate:
  that gate is invisible on 1a's shipped default, where nothing is stubbed because the key
  falls back. Closing it needs either a presence signal read through the RESOLVED key or a
  presence-gated `computeTestStateWrites`, and `ownKeys` is also the backfill's own
  complement, so both are changes with a blast radius past this menu.

## Acceptance criteria

- With nothing in the `Test management` group configured, a catalog row's chip and its
  `Set state` read and write the requirements state property, and a first-run ✨ leaves the
  test property unbound rather than binding a second option to the same key.
  **Checked by** `test/domain/settings.test.ts` — "leaves the test key unbound on a first-run setup, so it shares status"
- The fallback ladder is asserted in both directions: an unbound key takes the requirements
  key, the requirements declared states and the requirements EFFECTIVE done values; an own
  distinct key with no lists of its own takes the shipped defaults and never a customization
  made for another property.
  **Checked by** `test/domain/settings.test.ts` — "takes the shipped defaults, never the requirements customization, on its OWN key"
- Three workflow-state labels on one key report no collision, and one label of any other
  kind on that key still does. Both, since an exemption widened far enough to pass the
  first would stop reporting the second.
  **Checked by** `test/domain/settings.test.ts` — "reports no collision when every user of the key is a workflow state"
- Which workflow an item reads is asked of the LADDER, so a `Task` under a `Test case` and
  a typeless child of a `Test suite` both read the test key, while a `Deliverable` and every
  plan row are untouched in both directions.
  **Checked by** `test/domain/testLadder.test.ts` — "reads a catalog member through the test key, whatever its own type name says"
- A pick on a catalog row lands in the test key and leaves the plan's key alone, and
  removing the test state deletes the key rather than blanking it, with undo putting the
  value back.
  **Checked by** `test/storage/testFrontmatter.test.ts` — "removes the test state key, and undo puts it back"
- The vocabularies are split BOTH ways in one fixture: a state only a test carries is
  offered to another test and to no plan row, and a state only a plan row carries is
  offered in the plan and not in the catalog. One shared list satisfies either half alone,
  which is why neither is asserted on its own.
  **Checked by** `test/view/testCatalog.test.ts` — "offers the TEST workflow’s observed states in the catalog and the plan’s in the plan"
- A test whose test state is done wears `pbl-done` while its requirements state says
  otherwise, and it is still drawn — the catalog hides nothing by completion.
  **Checked by** `test/view/testCatalogState.test.ts` — "draws a catalog row’s chip from the test workflow, and marks it done by ITS done values"
- `Assign missing properties` stubs the test state key on a catalog member and on no plan
  item, asserted on both so a gate that stubbed everything and a gate that stubbed nothing
  fail differently.
  **Checked by** `test/domain/writePlanProperties.test.ts` — "stubs the test state on a catalog member and on nothing else"
- The removal reaches BOTH surfaces — the row menu's `Set state` and the state chip — because
  one builder draws them; a fix that reached only one is the failure this repository names.
  **Checked by** `test/view/testCatalogState.test.ts` — "offers the removal on both surfaces"
- Picking it deletes the test key rather than blanking it, and leaves the requirements key
  and its finished-date stamp alone — the difference between the test planner and the
  requirements one, asserted rather than reasoned from which function was called.
  **Checked by** `test/view/testCatalogState.test.ts` — "deletes the key rather than blanking it, and stamps no date doing it"
- It is withheld from a catalog row carrying no test state, so no offered action writes
  nothing. Asserted beside the offer above, since an entry offered always and an entry
  offered never each satisfy one of the two halves.
  **Checked by** `test/view/testCatalogState.test.ts` — "withholds the removal from a catalog row carrying no test state"
- The other two workflows are untouched on every surface: this is the catalog's gap, and a
  second way to say "no state" beside their board columns would be the drift 5c avoids.
  **Checked by** `test/view/testCatalogState.test.ts` — "leaves the plan’s and the Deliverable’s Set state exactly as they were"
- The group exists in the schema with its three controls, and the schema keys no colour box
  to a state only the test workflow declares.
  **Checked by** `test/domain/viewOptions.test.ts` — "never keys a colour box to a state only the test workflow declares"
- Not verifiable here, as ever: whether the group reads correctly in Obsidian's own options
  pane. jsdom asserts the schema this view publishes, never what Bases renders from it, so
  that belongs on [[Smoke test the visual changes]] beside the existing
  `typeFolder.test suite` question.

## Where it lives

**The selection is two functions in `src/domain/board.ts`** — `stateKeyFor` for the KEY
and `ownWorkflowReading` for the value-and-done pair. Each gained one branch, and the two
secondary selectors are **disjoint by construction** rather than ordered: `isDeliverableType`
asks a type NAME, `inCatalog` asks the ladder, and `ladderFor` answers `LEVELS` for
`Deliverable` whatever it hangs under, so no item can satisfy both and the branch needs no
argument about which is tested first. Two surfaces then took the third workflow with **no
edit at all** — `pbl-done` on a tree row (`src/view/render/rows.ts`) and the state chip's
own reading of value and done flag — which is the whole reason the rule lives in two places.
Two did not, and the difference is worth stating rather than rounding off: `Set state`'s
OFFERS and its CHECKMARKS each needed a branch of their own, because reading a workflow and
planning a write to it are different questions and each workflow's write goes through a
different planner (below).

**The configuration is four modules and the dependencies run one way** (ADR 0026), so the
workflow arrives as a row in each. `src/domain/optionalProperties.ts` gains the `testState`
row — declared AFTER `state`, which is what makes 1a's fallback the default — and
`resolvedTestStateKey` beside `resolvedDeliverableStateKey`; `src/domain/settings.ts` gains
`testStateKey`, `testStates` and `testDoneValues` with their defaults;
`src/domain/viewOptions.ts` gains `testManagementGroup`, the Deliverables group's mirror
minus its colour section (1b); and `src/domain/settingsConsistency.ts` holds both halves of
2b — `secondaryWorkflowProblem`, which asks the resolver's two guarantees of each secondary
workflow rather than repeating four inline branches, and `WORKFLOW_STATE_LABELS`, the
exemption that became a set.

**`resolveDeliverableWorkflow` was generalised rather than copied**
(`src/domain/settingsResolve.ts`). Every argument in that function's forty lines of
fallback is true of the test workflow word for word with `test` substituted, so it is
`resolveSecondaryWorkflow(inputs, names)` now, called twice against two module-level name
rows. That is the case the root `CLAUDE.md` names under **absence is a value**, where
`applyLabels` was extracted when the assignee arrived rather than copied. What is NOT
generalised is the pair of one-line resolved-key readers: they are read by name at a dozen
call sites, and a `resolvedSecondaryKey(settings, 'test')` would make every one of them
worse.

**The reading is `src/domain/readItems.ts`** — `testStateValue` and `testDone` on
`RawItem`, read through the resolved key on EVERY item rather than only on catalog members,
exactly as the Deliverable's is. It cannot be otherwise here: a `RawItem` has no `ladder`
yet, since `assignAll` is what puts one on it. The membership question belongs where the
workflow is chosen, not where the key is read.

**The vocabulary is `collectObservedTestStates` (`src/domain/vocabulary.ts`)**, the
Deliverable collector's mirror including its one non-obvious decision — scope before the
walk (4a). `src/domain/model.ts` supplies which workflow a population's states come from,
at the three call sites that already know which projection they are computing; the plan's
population keeps `collectObservedStates`, so nothing about the plan's vocabulary moved.

**The write path is one planner and two boundary modules.**
`computeTestStateWrites` (`src/domain/writePlan.ts`) plans the value or the key removal and
nothing else — no date stamps, since this epic records no results and a started or finished
date would be a claim about a run — and `missingKeyStubs` beside it carries 5a's gate.
`src/storage/frontmatter.ts` writes it in `applySecondaryStates`, which is the requirements
state key's rule stated twice and lifted out of `applyInto` to keep that function under the
complexity cap; `src/storage/writeKeys.ts` captures the same RESOLVED key it wrote, in the
list `touchedKeys` already keeps a row per property in — apply and capture must read the
same fallback, or a key written under it would have no inverse to undo it with.

**In the view it is two files and no new surface.**
`src/view/interactions/menu.ts` gains `deliverableOrTestValues` — a secondary workflow's own
offered values, or null for a row on neither — and the two branches that route a catalog
pick: `chooseState` plans through `computeTestStateWrites` (a catalog row has no board to
move on, so neither board-move method fits), and `addStateItems` asks its checkmark of that
same PLAN rather than of a comparison written beside it — through `stateWrites`, which is
that per-row planner selection stated once rather than as a ternary inside the checkmark.
The foot beside it is the same question asked once more (5c): it is drawn exactly when
`computeTestStateWrites(item, null)` plans a write — that planner by name, since `inCatalog`
has already answered which workflow this is — and it routes its pick back through
`chooseState` rather than reaching the gate itself. `src/view/render/columns.ts`'s
`columnKind` maps the third resolved state key to the `state` column kind, so a row draws
its chip into whichever column names the key its own workflow writes and leaves the others
empty. `src/view/manual/setupSection.ts` gains the entry describing the group, which is what
puts the three option keys in the user manual.

Nothing in `src/view/projection.ts` changed: the catalog still opts out of completed-item
filtering, and 5b is why that stayed true rather than why it was left alone.
