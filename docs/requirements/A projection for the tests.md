---
type: PBI
parent: "[[The test catalog projection]]"
order: 10
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# A projection for the tests

**As** someone who maintains tests and a plan in one vault, **I want** a toggle that shows
the test catalog, **so that** I can walk a suite from the top without the plan in the way
and without a second base to keep in step with the first.

A **fifth** toolbar position, drawing the test ladder as a tree: suites in their order,
cases in theirs, `Task`s under a case. Fifth and not fourth — the toggle already carries
four, `Projection` being `tree | board | roadmap | deliverables` since
[[A Deliverables board]] shipped, and a note that counted the three it had heard of would
have specified a control that replaces the Deliverables board rather than joining it.

It is a tree and not a board or a roadmap because this epic records no results and writes
no dates, so there is nothing to put in a column and nothing to draw on an axis.

The position is **UI state** — vault-scoped localStorage beside the collapse state — never
a `.base` setting, exactly as the mode, the roadmap axis and the focus level already are:
base settings are saved on the view, working position on the device.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user picks the test catalog on the projection toggle |
| **Preconditions** | None. The projection exists whether or not the base returns any tests |
| **Guarantee** | Switching projection writes nothing to any note and changes no `.base` setting. The tests drawn here are the same items, from the same model, that the other projections are excluding — one model, one write gate, one undo history. |

**Main flow**

1. The user picks the test catalog on the toggle.
2. The view draws the test items from the model it already built, as a tree rooted at the
   suites. **The roots are computed for the projection**, not taken from `model.roots` and
   filtered: `renderTree` starts at the model's own roots and `renderForest` drops a hidden
   sibling *without descending through it*, so a filtered parent takes its whole subtree
   off the screen with it. A projection's roots are therefore **the items it draws whose
   parent it does not draw** — asked of whatever each projection's membership rule already
   answers ([[Tests stay out of the plan]] 2b), so the catalog roots at every item it draws
   whose parent it does not, and the plan does the same. Stated that way rather than as
   "every test whose parent is not a test", which would be a second membership rule written
   beside the first and would disagree with it about a `Task`. The operation is not new:
   `collectFocusRoots` already re-roots the rendered tree at the topmost items of a level,
   and this is the same re-rooting under a different predicate.
3. Collapse, the quick filter and every write path behave as they do in the backlog tree,
   over this population — including the toolbar's count label, which counts tests here and
   only tests. Its **completed toggle** is withheld, as it already is on the Deliverables
   board: this epic gives tests no workflow, so there is no completion to hide.
4. Switching back restores the plan, and the catalog's own collapse state is remembered
   separately, keyed as the other projections' are.

**Extensions**

- **2a — the base returned no test items.** The projection draws its empty state, and the
  empty state's job is to say what a test catalog is and offer to create the first suite —
  the shape [[Board empty states]] established for a projection nobody has data for yet. It
  does **not** offer to configure anything: unlike the board and the roadmap, this
  projection needs no key bound to exist, so there is nothing for a ✨ to do here.
- **2b — a `Test case` has no suite**, whether created that way or dropped there. It is
  drawn as a root of its own, beside the suites. That is the honest picture and it is the
  same answer the backlog tree gives a parentless item.
- **2c — a test's parent is a work item** (the advisory drag of
  [[Test suite and test case as a ladder of their own]] 4a). It is drawn as a root here, by
  step 2's rule and only by it: its parent is not drawn in this projection, so the test is
  one of the items this projection roots at. Filtering alone would have lost it — the walk
  never reaches a hidden parent's children — and that is the case that makes the roots a
  computation rather than a filter.
  The work item does **not** appear as a context row: a context row exists because the Base
  excluded a parent, and this parent was excluded by the projection, which is this view's
  own doing and not the user's filter. Conflating the two would put half the plan in the
  catalog the moment somebody mis-dragged one case.
- **3a — the focus level is set.** It does nothing here. The levels it names are the
  `Epic → Task` ladder's, and a two-rung ladder has no rung called `PBI`; a control that
  narrowed this projection by matching level indices across two ladders would hide suites
  for a reason the user never asked for. The control is **ignored**, not cleared — the
  reversal [[A Deliverables board]] already made once, for the same reason: a focus set for
  the plan should still be there when the user goes back to it.
  The button follows that board's shape too: a **static label and no menu**, rather than a
  menu offering choices that would do nothing. The plan's own focus picker gains the other
  half — it never offers a test type, since focusing one there narrows the plan to roots it
  excludes and leaves it empty, which is the reason its own code already gives for
  withholding `Deliverable`.
- **4a — the user has never opened this projection.** No stored position, so nothing
  changes: the view opens where it always did. A new projection must not move anyone's
  default.

## Acceptance criteria

- The toggle has a fifth position, the four it already has are all still reachable, and
  picking the new one draws the test ladder from the same model, with no note written and
  no `.base` setting changed.
- The projection is reachable whether or not the base returns tests, and its empty state
  offers creation rather than configuration.
- Collapse state is stored per projection, so collapsing a suite does not collapse an Epic.
- The catalog's count label counts test items only, and its completed toggle is not
  rendered — the toolbar reads this projection's population like every other, and both
  consumers of that population are asserted, not just the visible one.
- The top-level creator offers the test types here and no plan type
  ([[Test suite and test case as a ladder of their own]] 1b), so nothing created from this
  toolbar lands outside the projection that created it.
- The focus level is ignored here and is left intact for the projections that use it —
  both halves asserted, since the second is the part [[A Deliverables board]] had to
  correct after shipping. The focus button offers no menu in the catalog, and offers no
  test type in the plan.
- A parentless case, and a case parented to a work item, both render as roots; no work item
  appears in this projection, as a row or as a context row. The second half of that is the
  one a filter-only implementation fails, so it is asserted on a model where the test's
  parent is a `PBI` **that is itself a descendant of an Epic** — a shallow fixture would
  pass by accident, since a top-level hidden parent and a nested one are the same bug at
  different depths and only the nested one is reached through a walk.
- The plan's projections root the same way: a work item whose parent is a test is drawn in
  the plan, as a root. Symmetry is the criterion, not a courtesy — one rule computed both
  ways is what stops the next exclusion from needing its own re-rooting argument.
- The stored position is vault-scoped UI state, and a vault that has never opened the
  catalog opens exactly as before.

## Where it lives

**Nothing yet — this note is design.** The toggle's positions are
`src/view/render/toolbar.ts` and `src/view/render/projections.ts`, the stored position
`src/view/uiState.ts` over `src/storage/collapseStore.ts`, the empty state
`src/view/render/emptyStates.ts`, and the rows themselves `src/view/render/rows.ts` — the
same tree renderer over a different population, which is what makes this projection cheap
and is the reason it is a tree rather than a third kind of drawing.

**The roots are the one thing the renderer cannot be handed unchanged.** `renderTree` takes
`model.roots` and `renderForest` filters siblings without descending through the ones it
drops, so a projection that only hides rows loses everything under a hidden parent. What
this projection needs is a root set of its own, computed by the rule in step 2 — which
belongs beside `collectFocusRoots` in `src/domain/model.ts`, the function that already
answers "what does the rendered tree root at when it is not the model's own roots", rather
than as a second re-rooting written inside the renderer.

Which items belong to this population is a domain question and lives with the type
vocabulary in `src/domain/itemTypes.ts`, beside the answer [[Tests stay out of the plan]]
needs, so the two are one predicate read from both directions rather than two lists that
can disagree.
