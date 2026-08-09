---
type: PBI
parent: "[[The test catalog projection]]"
order: 20
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Tests stay out of the plan

**As** a backlog owner who has just started writing tests, **I want** my tree, board and
roadmap to look exactly as they did before, **so that** adding a test catalog to the vault
does not cost me the plan I was already reading.

Both families arrive in one result set, because [[Untested work names itself]] cannot exist
otherwise. This note is the other half of that bargain: the backlog tree, the requirements
board and both roadmap axes exclude test items — from their rows, their cards, their
counts, their rollups and their vocabularies. The **Deliverables board** is the fourth
existing projection and needs nothing: it draws `model.deliverableResults`, filtered to
`Deliverable`s, so a test has never been able to reach it. Named rather than left out,
because a projection absent from this list is one nobody checks, and not given a rule,
because a filter for it would be a second name for one that already exists.

The precedent is exact. [[A Deliverables board]] already scopes one projection away from a
type and gives that type a projection of its own, and the case it had to get right is the
case here: a `Deliverable` excluded from the requirements board still surfaces there as a
context row when a visible descendant needs a parent to hang from.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The backlog tree, the requirements board or the roadmap renders a result set that contains test items |
| **Preconditions** | None |
| **Guarantee** | A vault with no tests renders identically before and after this feature. Nothing outside the plan's population — which is the membership rule's answer, not the list of test type names — is ever a row, a card, a bar, a shelf entry or a counted item in the plan's projections, or a source of any vocabulary those projections derive from the results — states, tags and horizons alike; and a test **contributes nothing to any ancestor's rollup**, not its own count, not its dates, and not its subtree's. |

**Main flow**

1. The model is built over everything the base returned, tests included — one model, so
   the edges [[Coverage as a property]] resolves are available to every projection.
2. The backlog tree, the requirements board and the roadmap draw work items and skip test
   items; the Deliverables board is unchanged, drawing what it always drew.
3. Counts, rollups and the level breakdown report the plan's population only, so the
   numbers a reader has been watching do not jump on the day the first suite is written.
   The **rollup walk stops at a test**: `assignAll` counts it as nothing and takes no
   evidence from below it, so no ancestor's descendant count, done count, completion or
   inferred span moves because a test exists. That half is a **model** rule rather than a
   projection one, and it has to be — the counts are computed while the tree is built, so a
   predicate applied at draw time would hide the row and leave the number it changed. The
   toolbar's count label and its completed toggle read the projection's own population and
   subtract tests with everything else; its ignored-notes advisory is about a different
   question and is untouched (3a, 3d).
4. The observed vocabularies are derived **per population**, and the rule is one sentence
   applied to each: *a vocabulary is scoped to the population of the projection that offers
   it.* The count is the thing to get right — the model publishes **four**
   (`observedStates`, `observedTags`, `observedHorizons`, `observedDeliverableStates`), and
   an earlier draft of this step named two, which is how a `QA` horizon carried only by a
   test would still have reached a plan row's Set horizon menu. `grep observed[A-Z]` is
   what enumerates them; naming the ones a paragraph happens to be thinking about is what
   misses the third.
   What the plan **draws and offers** — its board columns, and the values a plan row's Set
   state, Set horizon or tag picker offers — comes from the plan's population. The
   population, not the type list: `firstSeen` (`src/domain/vocabulary.ts`) skips a context
   row and reads every other result, so a rule spelled "skip test items" leaves a `Task`
   beneath a `Test case` — a catalog member by 2b — free to mint a board column out of a
   status nothing on the plan carries.
   What a **catalog** row's menus offer comes from the catalog's population, and this is
   the half a single shared vocabulary gets wrong in the other direction: `stateChoices`,
   `horizonChoices` and the tag picker all read the shared lists from any row, so scoping
   them to the plan alone would stop a test being given a value another test already
   carries. One test on `Ready` with no plan row on `Ready` would put `Ready` out of reach
   everywhere.
   `observedDeliverableStates` needs nothing: it feeds one board, that board draws
   `Deliverable`s alone, and a test is not one — the same free answer the Deliverables
   board gets everywhere else here. Named because a vocabulary absent from this list is one
   nobody checks, not because it has work to do.
   The generated README keeps the **whole** vocabulary, unchanged: it describes the vault
   rather than a projection, the same reason the ✨ backfill walks the whole tree.
5. The test catalog draws the other population ([[A projection for the tests]]), from the
   same model.

**Extensions**

- **2a — a work item's parent chain runs through a test.** Only possible via the advisory
  drag, and the work item is drawn as a **root of the plan** — by the same computed-roots
  rule the catalog uses ([[A projection for the tests]] 2), read the other way round: a
  projection roots at the items it draws whose parent it does not draw. Hiding the test
  row without that rule would take the work item off the screen with it, since the tree
  walk never reaches a dropped parent's children.
  The test does **not** appear as a context row. A context row exists because the *Base*
  excluded a parent; this exclusion is the view's own, so borrowing the mechanism would
  put test items on the plan through the door this note is closing.
- **2b — the item is a `Task` under a `Test case`.** It is part of the test catalog, not of
  the plan: a task belongs to the item it hangs from. Drawn in the catalog under its case,
  and excluded from the plan's projections with the rest of that subtree. Counting it in
  the plan's totals while its parent is invisible there is the shape that would make a
  rollup unreadable.
  So membership is **one rule with two clauses**, and `Task` is the whole reason it needs
  two: a `Task` takes the projection of its parent, and every other type takes the
  projection of its own type. That is not an exception carved out for this note — it is
  what a `Task` already is here, the one type that means nothing on its own and everything
  by what it hangs from. Written as a single "work items go to the plan" rule it
  contradicts itself the moment a task hangs from a test, which is the legal, expected
  shape rather than a mis-drag.
- **2c — a `PBI`, `Feature` or `Epic` sits under a test**, which only an advisory drag can
  produce. It is drawn in the plan, as a root, by 2a. The contrast with 2b is the rule
  above working rather than a line drawn twice: a `Task` under a test is test work by
  design, and a `PBI` under a test is plan work in the wrong place. Hiding the second
  would lose a note the user still has to manage, and the projection they would look for
  it in is the plan.
- **3b — a `Test case` sits under a `PBI`** (the advisory drag of
  [[Test suite and test case as a ladder of their own]] 4a), and that PBI is on the plan.
  The PBI's progress bar, completion and inferred span are exactly what they were before
  the drag. This is the case that makes step 3 a model rule rather than a projection one:
  `assignAll` counts every child that is neither a context row nor a marker, so without a
  third exception the test would be hidden from the tree and still be moving the bar above
  it — the failure mode that is hardest to notice, because the evidence for the wrong
  number is not on screen.
  A test is a **stronger** exception than the two that exist. A context row and a marker
  each contribute nothing themselves while their subtrees still reach their ancestors, and
  that is right for both: a result under an excluded parent is still this base's work. A
  `Task` under a `Test case` is not — it is test work, by 2b — so the walk takes nothing
  from below a test either.
- **3c — the same rule costs the catalog its own rollups.** A suite shows no "3 of 5 cases
  done", because the one walk that computes rollups is the one told to stop at a test.
  Accepted rather than solved: a second projection-specific pass over the tree is a real
  cost for a number this epic never promised — it records no results, so a case's `done` is
  its `status` and nothing else. If a run ever becomes an item, that increment can revisit
  this; naming the cost here is what keeps it from being rediscovered as a bug.
- **3a — the toolbar's two numbers.** They answer different questions and only one of them
  moves, which an earlier draft of this note got wrong in both directions by treating them
  as one "advisory".
  The **count label** ("*12 of 30 items*", with the level breakdown behind it) reports
  `countedPopulation` — already projection-scoped, since the requirements board subtracts
  `Deliverable`s from it — so the plan's projections subtract tests there too, and the
  catalog's own label counts the catalog's own members, `Task`s beneath a test included
  (2b). Every statement of a population here says *what the projection draws* rather than
  naming types, because the two only agree until a `Task` is involved.
  The **ignored-notes advisory** (`model.ignoredCount`) counts what the Base returned that
  is *not a work item*. A test **is** a work item, so it was never in that number and
  nothing about it changes. The earlier draft's "keeps counting raw results, tests
  included" was describing the ignored advisory while pointing at the label, and it was
  false of both.
- **3d — "Show completed items" advertises hidden work.** `renderCompletedToggle` derives
  its "*N hidden*" from the same `countedPopulation`, so a test whose state reads done
  would be offered for revealing on a screen that cannot draw it. Subtracting tests from
  that population is the whole fix, and it is the same fix for the same reason the code
  already gives one projection over: *on the requirements board a done Deliverable is not
  a hidden card, it is not a card at all, so counting it offered to reveal something
  pressing the button cannot show.* In the catalog the toggle is withheld entirely, as it
  already is on the Deliverables board — this epic gives tests no workflow, so there is no
  completion for it to hide.
- **4a — a test carries a state the plan's workflow also uses.** Irrelevant: its state is
  never read by a projection it is excluded from, so it cannot create a column, cannot fill
  one, and cannot appear in a Set state menu.
- **5a — the user has no test items at all.** Every exclusion is a no-op and every
  projection renders exactly as it did. That is the criterion below, and it is the one
  worth asserting first because it is what almost every vault will experience.

## Acceptance criteria

- A result set with no test items renders identically in every projection, before and
  after this feature.
- No test item appears as a row, a card, a bar or a shelf entry in the backlog tree, either
  board, or either roadmap axis.
- Nothing outside the plan's population is counted by the plan's counts, rollups or level
  breakdown, or contributes state, tags, horizons or dates to what the **plan** draws and
  offers.
  Asserted with a `Task` under a `Test case` carrying a status and a tag no plan item has:
  it is the row that satisfies a criterion written about *test types* while still adding a
  column to the board.
- A **catalog** row's Set state, Set horizon and tag picker still offer the values the
  catalog's own population carries. Asserted with the same fixture read the other way — one
  test on a state no plan row has, offered to another test — because the two criteria are
  each other's failure mode: one shared vocabulary satisfies this one and breaks the one
  above, and one plan-scoped vocabulary does the reverse.
- **All four** observed vocabularies are accounted for, states, tags, horizons and
  Deliverable states, and the horizon is asserted rather than assumed from the state: they
  are separate lists read by separate menus, and the state was already right in a draft
  where the horizon was not.
- A `Test case` parented to a `PBI` changes none of that PBI's rollup numbers — descendant
  count, done count, `subtreeDone`, `descendantStart`, `descendantTarget` — nor those of
  anything above it, and neither do its own `Task`s. Asserted on the **model**, over a tree
  built with the mis-dragged case in it, rather than on what a projection drew: the whole
  point of this criterion is a number that moves while nothing visible does.
- A test is never drawn as a context row in the plan's projections — the distinction
  between "the Base excluded it" and "this projection excludes it" is asserted, since
  reusing the context-row mechanism is the plausible implementation that breaks this note.
- A `Task` under a `Test case` follows its parent into the catalog and out of the plan; a
  `PBI`, `Feature` or `Epic` under a test does not — it is drawn in the plan, as a root.
  Both are the same rule (2b): a `Task` takes its parent's projection, every other type
  takes its own. Asserted as the pair, because a criterion naming only one of them reads as
  "work items go to the plan" and that sentence is false of exactly one type.
- That root behaviour is the symmetric half of [[A projection for the tests]]' rule,
  asserted here too so that neither note owns only its own direction of it.
- The toolbar's count label, its level breakdown and its "*N hidden*" completed toggle all
  read the projection's population, so none of them counts a test in the plan and the
  catalog's label counts nothing else. The completed toggle is asserted specifically, with
  a test whose state reads done: it is the number that offers to *reveal* something, so it
  is the one where a wrong population becomes a button that does nothing.
- The ignored-notes advisory is unchanged, and the reason is asserted rather than assumed:
  a test is a work item, so it never entered that count.
- One predicate decides membership, read from both directions, so the catalog and the plan
  cannot both claim an item or both disown one.

## Where it lives

**Nothing yet — this note is design.** The predicate belongs in
`src/domain/itemTypes.ts` beside the vocabulary, and it is asked in **two** places, which
is the correction this note needed most.

**In the projections**, for what is drawn: the tree in `src/view/rowVisibility.ts`, the
boards in `src/domain/board.ts`, the roadmap in `src/domain/roadmap.ts` and
`src/domain/shelf.ts`, with the derived vocabularies in `src/domain/vocabulary.ts` — and in
`countedPopulation` (`src/view/render/toolbar.ts`), which is a projection question wearing
a toolbar's clothes: it already branches per projection, two consumers read it (the count
label and the completed toggle), and both are wrong together or right together.

**In `assignAll` (`src/domain/model.ts`)**, for what is counted — because the rollup is not
a projection. That walk gathers descendant counts, done counts and date evidence while the
tree is built, and it already carries the shape this needs: a context row contributes
nothing itself, and a marker contributes nothing *and* is stated at the walk rather than at
a call site "precisely so it holds for every quantity this walk gathers". A test is the
third such exception and a stronger one — nothing from it and nothing from beneath it, per
3b — and it belongs in the same place for the same reason.

Not pruning the model is still the load-bearing choice, and still [[A Deliverables board]]'s:
a pruned model would take the coverage edges with it, and [[Untested work names itself]]
needs them on the very rows the prune would have left behind. What was wrong was the
sentence that followed from it — that the projections are therefore the *only* place to
ask. Keeping an item in the model does not keep it out of the arithmetic the model does on
the way past.
