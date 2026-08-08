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
otherwise. This note is the other half of that bargain: the backlog tree, both boards and
both roadmap axes exclude test items — from their rows, their cards, their counts, their
rollups and their vocabularies.

The precedent is exact. [[A Deliverables board]] already scopes one projection away from a
type and gives that type a projection of its own, and the case it had to get right is the
case here: a `Deliverable` excluded from the requirements board still surfaces there as a
context row when a visible descendant needs a parent to hang from.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The backlog tree, either board or the roadmap renders a result set that contains test items |
| **Preconditions** | None |
| **Guarantee** | A vault with no tests renders identically before and after this feature. A test item is never a row, a card, a bar, a shelf entry or a counted item in the plan's projections, never contributes its own state, tags or dates to any vocabulary those projections derive from the results, and **contributes nothing to any ancestor's rollup** — not its own count, not its dates, and not its subtree's. |

**Main flow**

1. The model is built over everything the base returned, tests included — one model, so
   the edges [[Coverage as a property]] resolves are available to every projection.
2. The backlog tree, the boards and the roadmap draw work items and skip test items.
3. Counts, rollups and the level breakdown report the plan's population only, so the
   numbers a reader has been watching do not jump on the day the first suite is written.
   The **rollup walk stops at a test**: `assignAll` counts it as nothing and takes no
   evidence from below it, so no ancestor's descendant count, done count, completion or
   inferred span moves because a test exists. That half is a **model** rule rather than a
   projection one, and it has to be — the counts are computed while the tree is built, so a
   predicate applied at draw time would hide the row and leave the number it changed. The
   toolbar's **advisory** is the deliberate exception and keeps counting the base's raw
   results (3a).
4. The state and tag vocabularies those projections derive from the results skip tests
   too, so a test's own `status` never becomes a column or an assignable value in the plan.
5. The test catalog draws the other population ([[A projection for the tests]]), from the
   same model.

**Extensions**

- **2a — a work item's parent chain runs through a test.** Only possible via the advisory
  drag, and the answer is the plain one: the work item is drawn where the exclusion leaves
  it — as a root — and the test does **not** appear as a context row. A context row exists
  because the *Base* excluded a parent; this exclusion is the view's own, so borrowing the
  mechanism would put test items on the plan through the door this note is closing.
- **2b — the item is a `Task` under a `Test case`.** It is part of the test catalog, not of
  the plan: a task belongs to the item it hangs from. Drawn in the catalog under its case,
  and excluded from the plan's projections with the rest of that subtree. Counting it in
  the plan's totals while its parent is invisible there is the shape that would make a
  rollup unreadable.
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
- **3a — the toolbar's advisory counts notes the tree did not draw.** It keeps counting the
  base's own results honestly, tests included, exactly as it already counts the ADRs that
  are not work items. That advisory is a statement about the *base*, not about the plan, and
  narrowing it would make the one number that reports the raw result set stop doing so. So
  the advisory and the counts in step 3 report **different populations on purpose**, and a
  reader comparing them will see them disagree the day the first suite is written — which is
  the advisory working, since that gap is exactly what it exists to show.
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
- No test item is counted by the plan's counts, rollups or level breakdown, and none
  contributes state, tags or dates to a vocabulary derived from the results.
- A `Test case` parented to a `PBI` changes none of that PBI's rollup numbers — descendant
  count, done count, `subtreeDone`, `descendantStart`, `descendantTarget` — nor those of
  anything above it, and neither do its own `Task`s. Asserted on the **model**, over a tree
  built with the mis-dragged case in it, rather than on what a projection drew: the whole
  point of this criterion is a number that moves while nothing visible does.
- A test is never drawn as a context row in the plan's projections — the distinction
  between "the Base excluded it" and "this projection excludes it" is asserted, since
  reusing the context-row mechanism is the plausible implementation that breaks this note.
- A `Task` under a `Test case` follows its parent into the catalog and out of the plan.
- The toolbar's advisory still reports the base's raw results, tests included, while the
  counts, rollups and level breakdown report the plan's population — the two are asserted
  together, on one result set holding both families, because the pair is a deliberate
  disagreement and a reader who found only one of these assertions would be right to
  call the other a bug.
- One predicate decides membership, read from both directions, so the catalog and the plan
  cannot both claim an item or both disown one.

## Where it lives

**Nothing yet — this note is design.** The predicate belongs in
`src/domain/itemTypes.ts` beside the vocabulary, and it is asked in **two** places, which
is the correction this note needed most.

**In the projections**, for what is drawn: the tree in `src/view/rowVisibility.ts`, the
boards in `src/domain/board.ts`, the roadmap in `src/domain/roadmap.ts` and
`src/domain/shelf.ts`, with the derived vocabularies in `src/domain/vocabulary.ts`.

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
