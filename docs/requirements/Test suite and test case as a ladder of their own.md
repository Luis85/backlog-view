---
type: PBI
parent: "[[A catalog of tests]]"
order: 10
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Test suite and test case as a ladder of their own

**As** someone who tests a product by walking it, **I want** a test suite that holds test
cases and hangs from nothing, **so that** my tests are a catalog with an order I chose
rather than leaves scattered through a plan that is ordered for a different reason.

Two declared types, and the pair is a **ladder**, not two more extra types. `Test suite`
is a root by nature — like [[Milestones as their own type]]'s marker and unlike an `Epic`,
which is a root by *position* — and its children are `Test case`s. A `Test case` takes
`Task`s, so the fix a failing test provokes can hang where the failure was found.

Neither type is ever a child of `Epic`, `Feature` or `PBI`, and that refusal is the whole
design: the relationship between a test and the work it checks is
[[Coverage as a property]], and a schema offering two ways to say it would get both.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever maintains the test catalog |
| **Trigger** | Creating an item from the toolbar with no row selected, or from a row's own **+**, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | The two ladders never merge. No drag, drop, indent or outdent re-types a work item into a test type or a test into a work type, and no test ever acquires a level in the `Epic → Task` ladder. |

**Main flow**

1. The user opens the toolbar's "pick another type" menu with no row selected and picks
   `Test suite`. That menu iterates the vocabulary `offerableTypes` hands it, which is
   **scoped by projection** — the requirements board drops `Deliverable`, the Deliverables
   board offers nothing else — so the catalog needs a branch of its own there: test types
   in the catalog, and no test type in the plan's projections. Without it the picker would
   offer an `Epic` from the catalog and file a note that vanishes from the screen that
   created it, which is the failure `offerableTypes` exists to prevent.
2. The view writes `type` and `order` — and no `parent`, a suite being a root — filing the
   note in the `Test suite` folder ([[Where new items are filed]]).
3. The user opens the **+** on that suite. `childTypeChoices` answers `Test case` alone,
   so nothing is asked.
4. The case is named and written with `type`, `parent` and `order`, filed in the
   `Test case` folder, and rendered at the rung below its suite.
5. Opening **+** on the case offers `Task` alone, and asks nothing.

**Extensions**

- **1b — the user is in the backlog tree, the board or the roadmap.** Neither test type is
  offered by the top-level creator there, for the same reason the catalog offers no `Epic`:
  a creator that files a note the current projection cannot show is a button that makes
  work disappear. The types are still creatable — from the catalog, which is where they
  are visible.
- **1a — the user picks `Test case` at the top level instead.** It is created with no
  `parent`, exactly as the toolbar's root creator does for every declared type, and it
  stays in the model: a recognised type is enough to belong
  ([[Parentless extra type dropped from the model]]). It renders as a root with no suite
  above it, which is the honest picture of a case nobody has filed yet.
- **2a — a per-type folder is not configured.** Folder inference and the folder prompt
  run, as they do for any type whose folder option is cleared. The shipped defaults are
  `tests/suites` and `tests/cases` under the home folder, one picker each, from the same
  generated per-type options every other type gets — this PBI adds two names to that
  mapping and no machinery.
- **3a — the row is a `Test case`.** Its only child is `Task`, so the modal is skipped.
- **3b — the row is an `Epic`, `Feature` or `PBI`.** Neither test type is offered. The
  choices there stay `[ladderChild, ...EXTRA_TYPES]`, unchanged by this PBI — a test is
  not an extra type and must not be creatable inside the plan by a control that reads as
  "what can go here".
- **4a — the user drags a `Test case` onto a `PBI`.** Nothing refuses the drop, because
  nothing here refuses any drop ([[Types beside the ladder]]'s advisory rule). The case's
  `parent` becomes the PBI and its **type is left alone**: the auto-type cascade assigns
  the child type of the rung an item landed under, and a `Test case` is not a rung of that
  ladder, so the same branch that protects a dragged `Bug` protects it. What the user gets
  is a case parented to a PBI, and it stays **visible in the catalog as a root**
  ([[A projection for the tests]] 2c): its parent is not in that projection, so it is drawn
  where a parentless case is drawn. That is the cost of an advisory rule and it is a
  visible cost, which is the point — a note that vanished from every ordinary row until
  someone repaired its frontmatter would be the view punishing a legal drag.
- **4b — the user drags a `Test suite` under an `Epic`.** Same answer, same reason, same
  visibility. A suite is a root by nature and nothing enforces that; it keeps its type,
  acquires a parent it should not have, and still draws as a catalog root with its cases
  under it. **No legal item is ever invisible in every projection** — that is the rule 4a
  and this extension both keep, and the one to check against any future exclusion.
- **5a — the `Test case` is deleted while its `Task`s remain.** Untouched here. A child
  whose `parent` names a note that is gone is [[Broken links still render]]'s question,
  and a test's children answer it by exactly the rule every other type's do.

## Acceptance criteria

- `Test suite` and `Test case` are declared types with their own rungs: a suite's children
  are cases, a case's children are `Task`s, and a suite is a root type beside `Epic` and
  `Milestone`.
- Neither type is offered by `childTypeChoices` under an `Epic`, `Feature` or `PBI`, and
  the extra types are not offered under a suite or a case. Both directions are asserted;
  the second is the one an implementation that "adds a rung" gets wrong for free.
- Both are offered by the toolbar's top-level creator **in the catalog and nowhere else**,
  and no plan type is offered in the catalog — `offerableTypes` gains the branch, and both
  directions are asserted. An earlier draft of this note claimed that creator needed no
  change because it iterates the whole vocabulary; it iterates whatever `offerableTypes`
  scopes for the projection, which is the function that already stops the requirements
  board offering a `Deliverable`.
- No move re-types either, at the root of a moved subtree or nested inside one — the rule
  [[Types beside the ladder]] learned twice, asked of these types at both depths.
- A `Test case` that lands under a `PBI` keeps its type, and a `PBI` that lands under a
  suite keeps its. The type cascade crosses neither way.
- Each files into its own folder from the generated per-type options, with the folder
  prompt reachable when the option is cleared.
- A parentless suite or case stays in the model and is not pruned by `hierarchyOnly`.
- A test dragged under a work item is still drawn — as a catalog root — so no legal item is
  invisible in every projection. Asserted from the rule rather than from the drag, since
  the next exclusion added anywhere is what would break it.
- The generated README's hierarchy table states both rungs and the suite's root
  capability, and `docs-check.mjs`'s own `LEGAL_CHILDREN` table gains the same pair — the
  register is written in this schema, so a type the plugin ships that the register cannot
  hold is a gate that fails on the first test note.

## Where it lives

**Nothing yet — this note is design.** The names join `ALL_TYPES` in
`src/domain/settings.ts`, with two entries in `DEFAULT_TYPE_SUBFOLDERS`; the per-type
folder options in `src/domain/viewOptions.ts` are already generic over the vocabulary.

The rungs are `src/domain/itemTypes.ts`' work and the only genuinely new shape in this
PBI: `LEVELS` is one ladder today and `childLevelIndex`/`nextLevelIndex` read it as *the*
ladder, so a second one means those functions ask which ladder an item is on before they
ask which rung. `childTypeChoices` gains the two branches above, and its top-level branch
already answers `ALL_TYPES` in full, which is correct for a suite and wrong for nothing.

`src/view/interactions/menu.ts` — `offerableTypes` gains the catalog branch, beside the two
projection branches it already carries. That is where "a projection offers only what it can
show" is stated once for both toolbar creators, so the rule is kept by extending it rather
than by a second test written beside it.

`src/domain/model.ts` — `computeLevel` and `pruneOutsideHierarchy` read type membership
rather than the four levels already, so a test belongs by being declared;
`collectFocusRoots` is where a second ladder's levels have to mean something or be
excluded, and [[A projection for the tests]] is what decides which.
`src/domain/writePlan.ts` — `computeTypeChanges` must not cascade across ladders, which is
the criterion above rather than a new mechanism.
`src/domain/backlogReadme.ts` and `scripts/docs-check.mjs` — the two hierarchy tables that
have to learn the pair, for the reason the last criterion gives.
