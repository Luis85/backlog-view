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
| **Guarantee** | A vault with no tests renders identically before and after this feature. A test item is never a row, a card, a bar, a shelf entry or a counted item in the plan's projections, and never contributes its own state, tags or dates to any vocabulary those projections derive from the results. |

**Main flow**

1. The model is built over everything the base returned, tests included — one model, so
   the edges [[Coverage as a property]] resolves are available to every projection.
2. The backlog tree, the boards and the roadmap draw work items and skip test items.
3. Counts, rollups, the level breakdown and the toolbar's advisory report the plan's
   population only, so the numbers a reader has been watching do not jump on the day the
   first suite is written.
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
- **3a — the toolbar's advisory counts notes the tree did not draw.** It keeps counting the
  base's own results honestly, tests included, exactly as it already counts the ADRs that
  are not work items. That advisory is a statement about the *base*, and narrowing it would
  make the one number that reports the raw result set stop doing so.
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
- A test is never drawn as a context row in the plan's projections — the distinction
  between "the Base excluded it" and "this projection excludes it" is asserted, since
  reusing the context-row mechanism is the plausible implementation that breaks this note.
- A `Task` under a `Test case` follows its parent into the catalog and out of the plan.
- The toolbar's advisory still reports the base's raw results.
- One predicate decides membership, read from both directions, so the catalog and the plan
  cannot both claim an item or both disown one.

## Where it lives

**Nothing yet — this note is design.** The predicate belongs in
`src/domain/itemTypes.ts` beside the vocabulary, and every projection asks it: the tree in
`src/view/rowVisibility.ts`, the boards in `src/domain/board.ts`, the roadmap in
`src/domain/roadmap.ts` and `src/domain/shelf.ts`, with the derived vocabularies in
`src/domain/vocabulary.ts`.

Asking it in the *projections* rather than pruning the model is the load-bearing choice,
and it is the one [[A Deliverables board]] made: a pruned model would take the coverage
edges with it, and [[Untested work names itself]] needs them on the very rows the prune
would have left behind.
