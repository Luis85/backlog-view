---
type: PBI
parent: "[[The test catalog projection]]"
order: 20
status: Done
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
   it.* Which list is the thing to get right, and not by counting them: an earlier draft of
   this step named two, which is how a `QA` horizon carried only by a test would still have
   reached a plan row's Set horizon menu, and the number it was corrected to (four) went
   stale the same week when `observedAssignees` arrived on `main` — the same defect one
   level up, and the reason the criteria below state the rule rather than a total.
   `grep observed[A-Z]` over `src/domain/model.ts` is what enumerates them; naming the ones
   a paragraph happens to be thinking about is what misses the next.
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
  two: a `Task` takes the projection of its parent **when that parent is in the model**,
  and every other type — and every `Task` whose parent is not — takes the projection of its
  own type.
  **Its own type as the view shows it**, which is the `type` frontmatter only when there is
  one. A child of a `Test suite` with no `type` at all *is* a `Test case`
  ([[Test suite and test case as a ladder of their own]] 4c): `typeName` is null, the
  effective type is not, and a predicate reading the raw field puts a note that draws as a
  test case into the plan and leaves it out of the catalog until ✨ happens to run. The
  membership predicate asks the effective type — the same identity
  [[Coverage as a property]]'s reader asks, for the same reason, since the two must agree
  about every row or a test can declare coverage from a projection that does not contain it. That is not an exception carved out for this note — it is
  what a `Task` already is here, the one type that means nothing on its own and everything
  by what it hangs from. Written as a single "work items go to the plan" rule it
  contradicts itself the moment a task hangs from a test, which is the legal, expected
  shape rather than a mis-drag.
- **2e — the `Task`'s `Test case` parent is excluded and "Show outside parents" is off.**
  The Task is a **plan** item, drawn in the plan as the orphan root it already is. There is
  no parent in the model to take a projection from: `createItems` skips
  `loadOutsideParents` when the option is off, so `linkAll` finds nothing at that path,
  marks the item `orphan` and roots it. What the model holds is that the parent is
  **absent** — never its type.
  **Nothing is loaded to find out.** That is the rule [[Dependencies as a property]] argued
  at length for prerequisites, and it applies here for an extra reason: the read it would
  take is precisely the one the user turned off. A membership question answered by a vault
  read per orphan would reinstate `loadOutsideParents` under another name, for a note the
  Base did not return.
  So this is a narrowing of 2b's promise rather than a hole in it, and it is worth being
  exact about which direction it fails: a task of a test appears on the plan, where the plan
  already draws it as an orphan and says so. It never goes the other way — no plan item is
  swept into the catalog by an absent parent — because the fallback is the item's own type
  and a `Task` is a plan type. The user's own repair is the one that already exists: turn
  the option on, and the parent loads as a context row with the membership rule reading it
  again.
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
  the state that case is IN and nothing else. (It later gained a workflow of its own to
  answer that with, [[A workflow for the tests]]; the cost priced here is a ROLLUP, and a
  per-item state is not one.) If a run ever becomes an item, that increment can revisit
  this; naming the cost here is what keeps it from being rediscovered as a bug.
  **A rollup is therefore a PLAN number, and the walk asks that of both ends.** Written as
  "stop at a test" it read as one question about the child and shipped as one: a `PBI`
  mis-dragged under a `Test case` was still counted INTO that case, which the catalog then
  drew as a rollup for a descendant it hides and promotes to a plan root — a bar with
  nothing to expand to. Found by review. The correction is not "skip a child on the other
  ladder", which is the symmetric shape that reads right and would hand the catalog exactly
  the rollups this extension declines, since a suite and its cases agree. It is: count a
  child only when the child and the PARENT are both plan rows.
- **2d — the base returns catalog members and nothing else.** The plan shows its ordinary
  **empty** state, not its all-done one. Both decisions are keyed to the plan's population,
  and neither is today: `renderTree` tests `model.items.length` for empty and then hands
  `model.results.length` to `renderAllDoneState` when no root renders, and
  `renderRoadmapAdvisory` branches on `model.results.length` the same way. Both arrays hold
  the excluded tests, so a vault whose base returns twelve test notes and no plan work would
  be told *"All 12 items are done and hidden"* — with a **Show completed items** button that
  reveals nothing, because nothing is completed and nothing is hidden by completion.
  That is the third appearance of one shape on this PR: **a control offering to reveal what
  it cannot show.** The completed toggle's count was the first, the catalog's own empty
  state the second, and this is the same defect in the plan, arrived at from the other side.
  The catalog's empty state was written carefully against its population
  ([[A projection for the tests]] 2a) and the plan's was left reading a shared array — the
  symmetry this note exists to keep, missed in the direction that had no new code in it.
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
  already is on the Deliverables board. Tests have a workflow of their own now
  ([[A workflow for the tests]]), and the withholding survives that on a reason it never
  needed before: the thing the toggle hides is `subtreeDone`, which is the REQUIREMENTS
  rollup — an item's own `done` read through the plan's state key, and a descendant count
  the catalog never accumulates (3c). Neither half is the test workflow's, so hiding by it
  would take a catalog row off the screen for a flag the catalog neither reads nor shows.
- **4a — a test carries a state the plan's workflow also uses.** Which is the shipped
  default rather than a corner case: with no test state property named, all three workflows
  resolve to one key. Still irrelevant, and the reason is now that the workflows are
  SEPARATE rather than that there is only one. A test is not in the plan's population, and
  every plan surface derives from that population rather than from a list of type names —
  the requirements board's columns come from `model.results`, which is the plan's forest;
  a plan row's Set state offers `model.observedStates`, which is the whole tree minus the
  catalog. So a test cannot create a plan column, cannot fill one, and cannot appear in a
  plan row's Set state menu, whatever key its state happens to live under. The mirror holds
  for the same reason and is the half a shared vocabulary would break: a plan row's state
  never reaches a catalog row's menu either.
- **5a — the user has no test items at all.** Every exclusion is a no-op and every
  projection renders exactly as it did. That is the criterion below, and it is the one
  worth asserting first because it is what almost every vault will experience.

## Acceptance criteria

- A result set with no test items renders identically in every projection, before and
  after this feature.
- A **typeless** child of a `Test suite` is a catalog member: drawn in the catalog, absent
  from the plan, counted by neither the plan's numbers nor its vocabularies. Asserted in
  **both** projections on a note with no `type` in its frontmatter — the row where the raw
  field and the effective type disagree, and the one a predicate written as
  `isTestType(item.typeName)` gets backwards while passing every other fixture.
- A result set of **only** test items shows the plan's ordinary empty state in the tree and
  on the roadmap — not "All N items are done and hidden", and no button offering to reveal
  them. Asserted on that result set specifically: it is the one where the two arrays those
  decisions read disagree with the population the projection draws, and every other result
  set makes them agree.
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
- **Every** observed vocabulary is accounted for — states, tags, horizons, Deliverable
  states and the assignee — and each is asserted rather than assumed from the one beside
  it: they are separate lists read by separate menus, and the state was already right in a
  draft where the horizon was not. Written as *all four* this criterion was a COUNT, and a
  count goes stale the way a table enumerating code does: the assignee property arrived on
  `main` while this feature was in review, `ProjectionPopulation` gained the list, and
  `assigneeChoices` went on reading `model.observedAssignees` — offering a test-only name
  on every plan row and refusing a catalog row a name another test carries. Found by
  review. The criterion is the RULE now, so the next list is covered by it rather than
  requiring the number be edited: a vocabulary is scoped to the population of the
  projection that offers it, and every menu reaches it through `rowVocabulary`.
- A `Test case` parented to a `PBI` changes none of that PBI's rollup numbers — descendant
  count, done count, `subtreeDone`, `descendantStart`, `descendantTarget` — nor those of
  anything above it, and neither do its own `Task`s. Asserted on the **model**, over a tree
  built with the mis-dragged case in it, rather than on what a projection drew: the whole
  point of this criterion is a number that moves while nothing visible does.
- A test is never drawn as a context row in the plan's projections — the distinction
  between "the Base excluded it" and "this projection excludes it" is asserted, since
  reusing the context-row mechanism is the plausible implementation that breaks this note.
- A `Task` whose `Test case` parent is **not in the model** is a plan item, and no vault
  read is made to decide otherwise. Asserted with "Show outside parents" off — the one
  configuration where the parent exists on disk and not in the model, and the only one where
  the rule's two clauses disagree about the same note.
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

The predicate is `inCatalog` (`src/domain/itemTypes.ts`), asked of the item's LADDER, which
is what makes it the effective type: a child of a `Test suite` with no `type` at all chains
onto the test ladder and is a catalog member, where a predicate reading the raw field would
have put a note that draws as a test case into the plan.

**In the projections**, it is asked exactly once — in `rowHidden`
(`src/view/rowVisibility.ts`), beside the quick filter and the completed toggle. Everything
downstream inherits it, because everything downstream already consults that one predicate:
the tree's rows, the requirements board's cards, the roadmap's rows and shelf, the
keyboard's move targets. `src/domain/board.ts`, `src/domain/roadmap.ts` and
`src/domain/shelf.ts` needed no edit at all — they read `model.results` and `model.roots`,
which are the PLAN's now.

**In the empty states**, likewise for nothing: `renderTree` reads
`projectionPopulation(...)` on all three of its decisions, so a base returning twelve test
notes and no plan work shows the plan's ordinary empty state rather than *"All 12 items are
done and hidden"* with a button that reveals nothing.

**In `assignAll` (`src/domain/model.ts`)**, for what is COUNTED, and this one had to be
written: the rollup is not a projection. A test is the third exception in that walk and a
stronger one than the two beside it — nothing from it AND nothing from beneath it, since a
`Task` under a `Test case` is test work. Stated at the walk so it holds for every quantity
the walk gathers. The subtree is still traversed; its rollup is discarded. The accepted
cost is 3c: a suite shows no "3 of 5 cases done".

**The vocabularies are per population**, and that is a shape rather than four edits:
`ProjectionPopulation` carries `observedStates`, `observedHorizons` and `observedTags`, so
`model` and `model.catalog` answer the same three names and `rowVocabulary`
(`src/view/projection.ts`) is one ternary. The plan's are collected from the whole
unfocused tree minus the catalog — unfocused, so what a menu offers never narrows with what
is on screen. `observedDeliverableStates` needed nothing, being already scoped to
`Deliverable`s.

`countedPopulation` (`src/view/render/toolbarStatus.ts`) answers from the projection's own
population, which its two readers — the count label and the completed toggle's *"N hidden"*
— share, so neither can offer to reveal what the other is not counting. The ignored-notes
advisory is untouched, and the reason is that a test is a work item: it was never in that
number.
