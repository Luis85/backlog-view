---
type: PBI
parent: "[[A catalog of tests]]"
order: 10
status: Done
priority: P2
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
   board offers nothing else — so the catalog needs a branch of its own: **the test types
   at the top level, and no test type at the plan's top level**. Without it the picker
   would offer an `Epic` from the catalog and file a note that vanishes from the screen
   that created it, which is the failure `offerableTypes` exists to prevent.
   The restriction reaches **every caller that asks `offerableTypes` for the whole
   vocabulary**, and there are four of them — this is not the top-level creator's rule
   alone, as an earlier draft of this note said:

   | Caller | What the catalog offers | What the plan offers |
   | --- | --- | --- |
   | Top-level "pick another type" | the test types | no test type |
   | The primary **New** button's default (`primaryNewType`) | `Test suite` | unchanged |
   | **Set type** on a row | *(per row — 1d)* | *(per row — 1d)* |
   | The focus picker | no menu at all | no test type |

   **Set type** is the one this use case names in its own Trigger, and the only one whose
   answer is not a projection-wide list — it is **per row**, because the question is where
   the row ends up and that depends on the row's parent as well as its new type (1d). Left
   unfiltered it lets a `PBI` be retyped into a `Test case` and vanish into the catalog
   from the plan the user was reading — the same disappearing note the creator rule exists
   to prevent, reached by the other verb. The primary button needs no rule of its own:
   `primaryNewType` already falls back to the first type the projection offers when the
   configured one is not offered.

   The **child** path is the exception, and `Task` is the whole reason it is one.
   `offerableTypes` also filters a row's own **+**, where the vocabulary is
   `childTypeChoices(item)` rather than `ALL_TYPES`, and that list is already right in both
   directions: a test's legal children are catalog members by the membership rule
   ([[Tests stay out of the plan]] 2b), and a plan row is never offered a test type at all
   (3b). A branch written as a plain type filter over every path would empty the **+** on a
   `Test case`, whose one choice is `Task` — so it has to know whether a parent is in hand,
   which `offerableTypes` does not ask today.
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
- **1c — a `Task` at the catalog's top level.** Not offered, and this is the case that
  proves the restriction belongs to the top-level creator rather than to a type list. A
  `Task` takes its parent's projection, so one created *under* a test is a catalog item and
  one created with **no parent** is not — it falls back to its own type and lands in the
  plan. Offered contextually (step 5), withheld at the top: the same type, answered
  differently by whether a parent is in hand, which a filter over type names alone cannot
  say.
- **1a — the user picks `Test case` at the top level instead.** It is created with no
  `parent`, exactly as the toolbar's root creator does for every declared type, and it
  stays in the model: a recognised type is enough to belong
  ([[Parentless extra type dropped from the model]]). It renders as a root with no suite
  above it, which is the honest picture of a case nobody has filed yet.
- **2a — a per-type folder is not configured.** Folder inference and the folder prompt
  run, as they do for any type whose folder option is cleared. The shipped defaults are
  `tests/suites` and `tests/cases` under the home folder, one picker each, from the same
  generated per-type options every other type gets — `typeFolder.test suite` and
  `typeFolder.test case`, since `typeFolderKey` lowercases the name and keeps the space.
  This PBI adds two names to that mapping and no machinery.
- **3a — the row is a `Test case`.** Its only child is `Task`, so the modal is skipped.
- **3b — the row is an `Epic`, `Feature` or `PBI`.** Neither test type is offered. The
  choices there stay `[ladderChild, ...EXTRA_TYPES]`, unchanged by this PBI — a test is
  not an extra type and must not be creatable inside the plan by a control that reads as
  "what can go here".
- **1d — the user retypes a row rather than creating one**, this use case's other Trigger.
  **Set type** offers the types that leave the row where it is. Ordinarily that reads as
  "the projection's own types": a `PBI` in the plan is never offered `Test case`, and a
  `Test suite` in the catalog is never offered `Epic`, either being a row that leaves the
  screen it was acted on.
  The question is **membership after the write**, though, not the type's name, and it is
  answered per row rather than per projection — two rows show why, in opposite directions.
  A `PBI` dragged under a test is drawn in the plan as a promoted root
  ([[Tests stay out of the plan]] 2c). `Task` is a plan type, so a projection-wide list
  offers it — and a `Task` takes its parent's projection (2b), so the retype moves that row
  into the catalog and off the screen the user was looking at. **Withheld.**
  A `Test case` under a `Test suite` is the mirror. `Task` is not a test type, so a
  catalog-wide list of "the test types" would withhold it — and retyping that row to `Task`
  leaves it in the catalog, under the same suite, by the same membership rule.
  **Offered.** A projection-wide list is wrong at both rows, in opposite directions, which
  is what makes per-row the rule rather than a refinement of it.
  `addSetTypeMenu`
  already withholds the whole submenu when every offer would write nothing — *a menu whose
  every option is a no-op is not a menu* — so a projection whose vocabulary collapses to
  the row's own type shows nothing rather than an inert entry, which is the behaviour a
  catalog holding one `Test suite` and no cases will actually produce.
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
- **4c — a child of a `Test suite` carries no `type` at all.** It is a `Test case`, shown
  and written as one. This is the second ladder reaching the **implied** type, and it is
  not one rule but every place that indexes `LEVELS` by a computed level — five of them,
  each answering for whichever ladder the item is on: `childTypeChoices`'s `ladderChild`
  and `displayType` (`src/domain/itemTypes.ts`), the two branches of the move cascade, and
  `initWriteFor` (`src/domain/writePlan.ts`), which is what ✨ eventually puts on disk.
  Left alone, a typeless child of a suite takes the first ladder's rung at the same index:
  it **draws** as a `Feature`, and the backfill then **writes** `Feature` to it, which
  moves the note into the plan. The display half is a wrong badge; the write half is the
  one that matters, because it is permanent and nobody asked for it.
  A typeless child of a `Test case` is `Task` by the same rule, which is the answer both
  ladders already give at their deepest rung.
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
- Every caller asking `offerableTypes` for the **whole vocabulary** takes the projection's
  restriction — the top-level creator, the primary **New** button's default, **Set type**,
  and the focus picker. Asserted per caller, not once: they share a function and answer
  four different questions, so one assertion covering "the vocabulary is filtered" would
  pass while three surfaces stayed wrong. An earlier draft of this note claimed the
  creator needed no change at all, then claimed the restriction was the creator's alone;
  both were the same mistake at different sizes — reasoning about a function's purpose
  instead of reading its call sites.
- **Set type** offers exactly the types that leave the row **where it is** — asked of the
  membership the write would produce, never of the type's name. That covers the ordinary
  case (no test type in the plan, no plan type in the catalog) and the one a name-based
  rule misses in **both** directions. A `PBI` dragged under a test is drawn in the plan as
  a promoted root, and `Task` is a plan type by name, but retyping it makes the row inherit
  its test parent's membership and vanish into the catalog — withheld. A `Test case` under
  a suite retyped to `Task` stays in the catalog under that suite — offered, though no
  catalog-wide list of test types would offer it. Asserted on both rows, since a criterion
  proving only the withholding is satisfied by a rule that withholds too much.
- **A row's own + is unaffected**, and this is asserted separately rather than assumed from
  the criterion above: opening **+** on a `Test case` in the catalog still offers `Task`,
  and on a `Test suite` still offers `Test case`. `offerableTypes` filters that path too,
  so a catalog branch written as a type filter passes the first criterion and empties this
  menu — the two have to be checked apart, because one change satisfies one and breaks the
  other.
- No move re-types either, at the root of a moved subtree or nested inside one — the rule
  [[Types beside the ladder]] learned twice, asked of these types at both depths.
- A `Test case` that lands under a `PBI` keeps its type, and a `PBI` that lands under a
  suite keeps its. The type cascade crosses neither way.
- Each files into its own folder from the generated per-type options, with the folder
  prompt reachable when the option is cleared.
- A parentless suite or case stays in the model and is not pruned by `hierarchyOnly`.
- A typeless child of a `Test suite` draws as a `Test case` and is backfilled as one, never
  as a `Feature`. Asserted at the badge **and** at the write, since they are different
  functions reading the same wrong index and the write is the half that cannot be undone by
  looking away.
- A test dragged under a work item is still drawn — as a catalog root — so no legal item is
  invisible in every projection. Asserted from the rule rather than from the drag, since
  the next exclusion added anywhere is what would break it.
- `docs-check.mjs` can hold the register's own first test notes, which takes **two** of its
  tables and not one: `LEGAL_CHILDREN` gains the pair, and `ROOT_TYPES` gains `Test suite`
  — a separate set listing `Epic` and `Milestone` alone, so a parentless suite is rejected
  by a gate that never consulted the first table. Its comment distinguishes a root by
  *position* from a root by *nature*; a suite is the second kind, and the first of that kind
  with children. Covered by a fixture holding a root suite, not by the pair appearing in
  `LEGAL_CHILDREN`.
- The generated README states the new rungs in its **hierarchy table** and what a move
  does to a type in its **move-rule prose**, which are two different statements and only
  the first is a table. The prose used to carry an exception — with re-typing on, a move
  into a new parent rewrote the type — and then named `EXTRA_TYPES` as the types that kept
  theirs, telling a reader the opposite of what this PBI guarantees, since the test types
  keep their type and are deliberately not extra types. It was fixed by DERIVING the
  exempt list from the same predicate the cascade asked, rather than by adding two names.
  The whole exception went on 2026-08-11 ([[Assigning type on a move]]), so the prose now
  says *moving a note never rewrites its type* unconditionally and there is no list to get
  wrong. The lesson outlives it: a generated document may not name a set the code
  computes differently, whatever the set is.

## Where it lives

`src/domain/typeVocabulary.ts` — `TEST_LEVELS`, and two entries in
`DEFAULT_TYPE_SUBFOLDERS`. `ALL_TYPES` filters the shared rung out rather than
concatenating, so `Task` appears exactly once: two entries would give it a second folder
option under the same key, a duplicate in every creator menu and two shelf groups. The
per-type folder options in `src/domain/viewOptions.ts` were already generic over the
vocabulary and needed nothing.

`src/domain/itemTypes.ts` holds the rungs and the genuinely new shape: `ladderFor`, which
answers WHICH ladder before anything asks which rung, and `inCatalog`, the membership
predicate over its result. `childLevelIndex` and `nextLevelIndex` take the ladder they
clamp against, and every `LEVELS[…]` index became `ladder[…]` — the five a `grep 'LEVELS\['`
enumerates, including `initWriteFor` in `src/domain/writePlan.ts`, the one that writes.
A `keepsTypeOnMove` predicate sat beside them so the generated README could derive which
types a move left alone rather than naming `EXTRA_TYPES` and being wrong about a marker;
it went with the cascade on 2026-08-11, since a move now leaves every type alone.

**The shared deepest rung is what made this small.** `TEST_LEVELS` ends on `Task`, so 4c
is `childLevelIndex` clamping on the right ladder and needs no rule; so is the membership
of a `Task` under a test; so is 2e's absent parent, which chains from nothing and lands on
the plan with no vault read. What is left to state is the one thing a chain cannot say:
`ladderFor` returns the PLAN's ladder for a name neither ladder holds, so an extra type, a
marker or a custom type beneath a `Test case` stays plan work rather than being swept in.

`src/view/projection.ts` — `offerableTypes`, moved here from `interactions/menu.ts` with
the lint rule that guards it, because "which types may this projection offer" is a fact
about the projection rather than about a menu. Its catalog branch is the first that is not
a filter over type NAMES: it asks membership AFTER THE WRITE, of the row's own parent, so
one rule answers the top-level creator, the primary button's default, the focus picker and
**Set type** — a null parent ladder being exactly what "at the top level" means.
`retypeChoices` beside it is that function with the row in hand, which is what keeps
`interactions/menu.ts` from re-importing the vocabulary to hand it back.

What keeps a `Test case` dropped on a `PBI` a `Test case` is that nothing rewrites a type
on a move at all. The re-typing cascade in `src/domain/writePlan.ts` had to state the rule
a second time — it computed the ladder the DESTINATION handed out and refused to descend
any other, at the root of a moved subtree and nested inside one — and the nested half of
that guard turned out to have nothing checking it, which is why the whole feature was
removed on 2026-08-11 ([[Assigning type on a move]]). The rule itself is `keepsProjection`,
which withholds the move rather than correcting it afterwards.

The one thing that function cannot answer as it stands is **which caller is asking**. Six
call sites go through it, in two groups: four ask for the whole vocabulary
(`toolbar.ts` — the top-level creator, `primaryNewType`, the focus picker — and
`addSetTypeMenu` in `menu.ts`), and two hand it `childTypeChoices(item)` (`rows.ts` and
`buildItemMenu`). The catalog needs opposite answers for `Task` across that line (1c).
Whether the distinction becomes a parameter, a second function, or a branch that inspects
the list it was handed is an implementation question; what this note fixes is that a pure
filter over type names cannot express it, so an implementation that edits only the existing
branch will pass the top-level criterion and empty a `Test case`'s menu.

`src/view/render/toolbar.ts` — the focus control's catalog case is the Deliverables board's
shape exactly: a static label and no menu, not a menu with nothing in it
([[A projection for the tests]] 3a).

`src/domain/model.ts` — `computeLevel` and `pruneOutsideHierarchy` read type membership
rather than the four levels already, so a test belongs by being declared;
`collectFocusRoots` is where a second ladder's levels have to mean something or be
excluded, and [[A projection for the tests]] is what decides which.
`src/domain/backlogReadme.ts` and `scripts/docs-check.mjs` — and **two statements each**,
which is the part a "the tables learn the pair" sentence hides. The checker has
`LEGAL_CHILDREN` *and* `ROOT_TYPES`, and only the second decides whether a parentless suite
is legal. The README has its hierarchy table *and* its move-rule prose; the second used to
tell a user which types survive a drag, by naming `EXTRA_TYPES`, which the test types are
not. It now tells them no type is rewritten by one, which is the same statement with
nothing left to get wrong.
