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
   suites.
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
  [[Test suite and test case as a ladder of their own]] 4a). It is drawn as a root here,
  since its parent is not in this projection, and the work item does **not** appear as a
  context row: a context row exists because the Base excluded a parent, and this parent was
  excluded by the projection, which is this view's own doing and not the user's filter.
  Conflating the two would put half the plan in the catalog the moment somebody mis-dragged
  one case.
- **3a — the focus level is set.** It does nothing here. The levels it names are the
  `Epic → Task` ladder's, and a two-rung ladder has no rung called `PBI`; a control that
  narrowed this projection by matching level indices across two ladders would hide suites
  for a reason the user never asked for. The control is **ignored**, not cleared — the
  reversal [[A Deliverables board]] already made once, for the same reason: a focus set for
  the plan should still be there when the user goes back to it.
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
  correct after shipping.
- A parentless case, and a case parented to a work item, both render as roots; no work item
  appears in this projection, as a row or as a context row.
- The stored position is vault-scoped UI state, and a vault that has never opened the
  catalog opens exactly as before.

## Where it lives

**Nothing yet — this note is design.** The toggle's positions are
`src/view/render/toolbar.ts` and `src/view/render/projections.ts`, the stored position
`src/view/uiState.ts` over `src/storage/collapseStore.ts`, the empty state
`src/view/render/emptyStates.ts`, and the rows themselves `src/view/render/rows.ts` — the
same tree renderer over a different population, which is what makes this projection cheap
and is the reason it is a tree rather than a third kind of drawing.

Which items belong to this population is a domain question and lives with the type
vocabulary in `src/domain/itemTypes.ts`, beside the answer [[Tests stay out of the plan]]
needs, so the two are one predicate read from both directions rather than two lists that
can disagree.
