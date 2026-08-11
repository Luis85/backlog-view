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
2. The view draws this projection's members from the model it already built — the tests,
   and the `Task`s hanging from them — as a tree rooted at the suites. **The roots are computed for the projection**, not taken from `model.roots` and
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
   Those roots are **not the renderer's private input**. Every consumer that walks the tree
   from its roots to decide what the user sees or acts on takes them: the quick filter's
   match index, the keyboard's visible-row walk, the drop targets, the indent/outdent
   sibling lists, and the rank a new root is given. A consumer left on `model.roots` does
   not fail visibly — it disagrees with the screen, which is the failure this whole rule
   exists to prevent, arriving one surface at a time.
3. Collapse, the quick filter and every write path behave as they do in the backlog tree,
   over this population — including the toolbar's count label, which counts this
   projection's **results**: the members the Base returned, `Task`s beneath a test included
   by the membership rule ([[Tests stay out of the plan]] 2b), and **no context row**. Not
   "tests and only tests", which is a re-listed population that disagrees with the
   membership rule about a `Task`; and not "what it draws" either, which sweeps in a
   `Test case` present only as an excluded ancestor (2a). An `outsideFilter` row is never a
   source of anything derived from the results, and a count is exactly that — the rule
   `countedPopulation` already keeps by reading `model.results`, which is the answer this
   projection needs rather than a new one.
   "Behave as they do in the backlog tree" is not free, and this is the sentence that has
   to be paid for: **the catalog is tree-shaped, and "tree-shaped" is spelled
   `projection === 'tree'` in six places today.** Every one of them is a gate this
   projection must pass — the fitted-column ladder and its resize refit, the second
   measuring pass, the class-clearing that undoes the ladder for card projections,
   Expand/Collapse all, and the context menu's move section. A projection added beside
   `'tree'` rather than *as* a tree fails each of them silently and differently: no column
   fitting, two dead toolbar buttons, and a menu with no Move up, indent or outdent on a
   tree whose whole point is an order somebody chose.
   Its **completed toggle** is withheld, as it already is on the Deliverables board — this
   epic gives tests no workflow, so there is no completion to hide — and withholding the
   button is only half. `hideCompleted` is on for every projection except `deliverables`,
   so the catalog joins that exception too. A toggle withheld while its filtering stays on
   is the worst of both: a done test disappears and nothing on screen offers to bring it
   back.
4. Switching back restores the plan **as it was left**. Collapse needs no new key space to
   manage that: the store holds one bit per note path, shared by every projection except
   the dated axis — which has `TIMELINE_SCOPE` because its chevron and the tree's are *two
   questions about one item*. The catalog asks no second question about anything, since its
   population and the plan's are disjoint: a test's bit is only ever read here, an Epic's
   only there. So one bit is right, and an earlier draft of this step claiming the catalog
   keeps collapse state "separately, keyed as the other projections' are" was wrong twice —
   the other projections do not keep separate state either.
   What the shared set does require is that **Expand all and Collapse all touch this
   projection's population and no other**. `collapsiblePopulation` answers `model.items` for
   every projection but Deliverables, so left alone those two buttons would fold the plan
   from the catalog — and, the bits being shared, the plan would still be folded on the way
   back. It takes the catalog's forest, for the reason its own comment already gives about
   the Deliverables board: the buttons act on what the screen has.

**Extensions**

- **4b — a quick filter is active when the user switches projection.** The index is
  recomputed on the switch. `FilterState.recompute` runs on a data change and on a filter
  edit, and `setProjection` does neither — it stores the mode and renders — so an index
  built from one projection's forest would answer for the other until something unrelated
  refreshed the view. That is a stale filter showing wrong rows with the right text still
  in the box, which is the failure mode nobody reports as a bug because it looks like the
  filter simply not matching.
- **2e — the quick filter matches a row this projection does not draw.** `FilterState`
  indexes `model.roots` and `model.realRoots`, so a needle matching a hidden `PBI` marks
  its whole subtree as matching, and a `Test case` beneath it stays on screen while nothing
  in the catalog matched at all. The inverse happens in the plan. The index is built from
  the **same forest the projection draws**, which is the roots rule reaching one more
  consumer rather than a rule of its own — and it is the consumer where being wrong looks
  most like a working feature, since rows do appear and one of them did match something.
- **2f — the user arrows or tabs to a promoted row.** `visibleItems` walks from
  `model.roots` and stops at hidden parents, so a row promoted to a catalog root is drawn
  and unreachable by keyboard. It walks the projection's roots for the same reason the
  renderer does. This is an accessibility floor, not a nicety: a row that exists only to
  the mouse is a row half this plugin's users cannot act on.
  **`handleTreeKeydown`'s own guard runs before that walk** and asks
  `model.items.length === 0`, which a stored plan focus can empty while this projection has
  rows (3b) — so the traversal fix alone leaves every key inert on a full screen. Both, or
  neither is worth having.
- **2a — this projection draws nothing.** The projection shows its empty state, and the
  test is the **population**, not whether a test type appeared among the raw results. A
  base returning a `Task` whose `Test case` parent was excluded still has a catalog to
  draw: the case comes in as a context row, the Task is a catalog member under it, and an
  empty state there would be the view claiming there are no tests on a screen that has one
  on it. Keyed to what the projection draws, like every other population statement here.
  The empty state's job is to say what a test catalog is and offer to create the first suite —
  the shape [[Board empty states]] established for a projection nobody has data for yet. It
  does **not** offer to configure anything: unlike the board and the roadmap, this
  projection needs no key bound to exist, so there is nothing for a ✨ to do here.
- **2b — a `Test case` has no suite**, whether created that way or dropped there. It is
  drawn as a root of its own, beside the suites. That is the honest picture and it is the
  same answer the backlog tree gives a parentless item.
- **2d — a promoted root is asked any question about its parent**: reordered, outdented,
  dropped onto, Left-arrowed, or simply drawn at a depth. **A promoted root is a
  `focusRoot`** — not "like" one, the same category — and saying so is the whole answer
  rather than a rule per command.
  `focusRoot` already means *a root of the rendered forest that is not a root of the model*,
  and four call sites already ask it: `siblingContext` and `outdentTarget`
  (`src/view/interactions/structure.ts`), `handleExpandCollapseKey`
  (`src/view/interactions/keyboard.ts`), and the drop-target lookup
  (`src/domain/dropTargets.ts`). Each returns null or stops, on the stated grounds that an
  item whose real siblings and parent are not on screen cannot be ordered, reparented or
  navigated against the ones that are. A promoted root is that item exactly. Mark it, and
  Move up/down/top/bottom go inert, **outdent** goes inert — otherwise it reparents the
  test beside the hidden `PBI` under an `Epic`, writing a real move while the row does not
  budge — and **Left Arrow** stops at it rather than selecting a parent that is not on
  screen and leaving the keyboard with no visible current row.
  **Drops are refused by position, not wholesale.** `dropTargetFor` splits them already:
  `insidePosition` never consults a parent, and only the before/after path reaches the
  `focusRoot` rejection in `siblingPosition`. So dropping a case **into** a promoted suite
  stays legal — it is nesting, which asks nothing about where the suite hangs — while
  dropping one **beside** it is refused, because that is the ranking question with no
  answer. Saying "no drop target" would have forbidden the legitimate half and contradicted
  this extension's own repair-by-drag, so the inert rule is the sibling positions only.
  **Depth** is the same story: `renderItem` reads `item.depth` for `--pbl-depth` and for
  `aria-level`, so a test promoted from under a nested `PBI` would draw indented three
  levels with `aria-level="4"` and no levels above it — a lie to the eye and a worse one to
  a screen reader. Focus already solves it: `assignVisualDepth` re-derives depth from a
  rendered-root list, and the projection's forest goes through it for the same reason.
  An earlier draft answered only the ranking half, with a bespoke "promoted roots share no
  ranking" rule. Right outcome, wrong shape: a rule written for one command family leaves
  the other five call sites to be found one at a time, which is exactly what then happened.
  What survives from it is that a **promoted** root ranks nowhere. What does **not** survive
  is the other half — "a genuine catalog root ranks among this projection's roots" — which
  was wrong, and wrong in the one way this plugin must not be.
  **Every parentless item is one real sibling group**, plan and catalog alike: `order` is a
  number scoped to the notes sharing a parent, and a `Test suite` and an `Epic` share the
  null one. Rank a suite against suites alone and `computeInsertOrder` takes a midpoint that
  a hidden `Epic` may already hold — a **duplicate order in one sibling group**, which is
  the single ranking limitation the register forbids itself from demonstrating. The
  renumber path is worse: it rewrites *the supplied list*, so renumbering the catalog's
  roots leaves every plan root's number untouched and manufactures the collisions it exists
  to resolve.
  So the two questions separate. **Where** an item goes comes from the visible neighbours in
  this projection; **what number it gets** comes from the whole real sibling group, bracketed
  by whatever real siblings actually sit at that position — hidden ones included. Both
  projections work this way, not just the catalog: the plan's root ranking has the same
  shared group and the same exposure the day a suite exists.
  **Creating** a root is the same rule with easier arithmetic, and it is easy to leave
  behind because it goes through a different helper. `endOfSiblingsOrder` answers *the
  supplied list's maximum plus a spacing*, so handed the catalog's roots alone it gives a
  new suite the number of the first hidden plan root above them. Handed the whole group it
  cannot collide, and it still lands the suite last in the catalog — a maximum over a
  superset clears the last visible root as well. Child creation was never exposed:
  `createFromPrompt` already passes `parentItem.children`, which is the real group already.
  **A promoted root is also not in the projection's rankable roots**, which is a second
  list rather than a second reading of the first. The `focusRoot` flag protects a promoted
  row when something acts *on* it; the root drop never targets it — `rootDropTarget` takes
  the root list wholesale and computes an order against it — so a promoted row sitting in
  that list makes a drop rank against a note whose real siblings are elsewhere, and a
  renumbering pass with no gap available would rewrite that note's own `order`.
  Focus never had to say this because `rootDropTarget` returns null the moment
  `model.focused` is true; the catalog is deliberately **not** focused (3b), so the guard
  that covers the one case does not cover the other. **Three** lists, then, and conflating
  any two of them breaks something: the **rendered** roots, genuine and promoted, which the
  renderer, the keyboard, the filter index and the collapse seed walk; the **positionable**
  roots, this projection's genuine roots, which say where a drop lands; and the **ranking**
  group, every parentless item **the model holds**, which says what number it gets. The
  third is not a projection's list at all — it is what the data means, as far as this view
  can see it — and no projection may narrow it without inventing duplicate orders. It is
  already narrower than the vault, since the Base decides what loads; that is a limit this
  feature inherits rather than one it may widen.
  It is not stuck either way. Dragging it onto a suite reparents it, which is the actual
  repair for a mis-parented test and the gesture a user reaches for anyway.
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
- **3b — a plan focus is stored when the catalog opens.** The catalog is built from the
  **unfocused** tree, and ignoring the control is not enough to get that. `buildModel`
  replaces `roots`, `items` **and** `results` with the focus subtree and sets
  `focused: true`, so a stored focus of `PBI` would leave the catalog showing only the
  tests inside that subtree — usually none — with a count to match, and
  `rootDropTarget` refusing every drop because `model.focused` is still true.
  The precedent is exact and one projection over: `deliverableResults` is read off the
  whole tree *before either branch narrows anything*, precisely so a focus set elsewhere
  can never hide a Deliverable. The catalog's forest and results come off the same
  unfocused tree, and its effective focused state is false, while the stored plan focus is
  untouched and waiting for the switch back (3a).
  This is the third time on this note that **withholding a control has not disabled its
  behaviour** — the completed toggle, the focus button, and now the model narrowing behind
  it. The rule to carry into any fourth: a projection opting out of a feature opts out of
  the computation, not just the button.
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
  offers creation rather than configuration. It is keyed to what the projection draws: a
  base whose only catalog member is a `Task` under an excluded `Test case` draws that Task,
  not the empty state.
- A **promoted** root behaves as a `focusRoot` at every call site that asks: no order
  written by Move up/down/top/bottom, no reparent by outdent, no **before/after** drop, and
  Left Arrow stops there rather than selecting a row the projection does not draw. Asserted
  per call site, since each is a separate function returning its own null and four of the
  five were found one round at a time.
- Dropping a `Test case` **inside** a promoted `Test suite` still works. Asserted beside the
  refusal above, because the two differ by drop zone rather than by row, and a rule that
  refused both would break the repair this note offers for a mis-parented test.
- A genuine catalog root lands **where** the visible neighbours say and takes a number the
  **loaded** real root group admits: no drop or creation in either projection produces two
  parentless notes sharing an `order` **among the notes the model holds**, and no renumber
  rewrites one projection's roots while leaving the other's. Asserted on a model holding
  suites and Epics interleaved by order — the arrangement where ranking against the visible
  list alone collides on the first drop, and where a projection-scoped renumber collides on
  every one after it.
  **Loaded, not every parentless note in the vault**, and the limit is not this feature's to
  remove. `createItems` loads the Base's results and the ancestors those results name; an
  unrelated parentless `Epic` the Base excludes entirely is in neither, so its `order` cannot
  be seen and can be reused. Making the wider promise true would take a vault-wide read,
  which every other reader here refuses for the same reason
  ([[Dependencies as a property]] 3b). That collision is **already possible today** between
  two filtered-apart Epics; what this PBI must not do is widen it, and ranking against the
  whole loaded group rather than one projection's slice is exactly what keeps it from
  widening.
- **Creation** is asserted separately from the drop, on a last suite at 10 with a hidden
  plan root at 20: it is a different helper (`endOfSiblingsOrder`, a maximum rather than a
  midpoint), it fails on a different arrangement, and a criterion written about drops alone
  passed this PBI for two rounds while creation still handed the new suite the Epic's own
  number.
- A promoted root is absent from the **positionable** roots: a root drop, and
  a new root's `endOfSiblingsOrder`, both position against the genuine roots alone, and no
  renumbering pass rewrites a promoted note's `order`. Asserted with a promoted row present
  and no order gap available — the arrangement where the wrong list does not merely
  mis-rank the dropped item but writes to a note nobody touched.
- Every drawn row's depth is **projection-relative**: a promoted root draws at depth 0 with
  `aria-level="1"`, whatever its depth in the model. Asserted on a test promoted from
  beneath a nested `PBI`, since a shallow fixture cannot tell a re-derived depth from an
  inherited one — and asserted on `aria-level` as well as the indent, because the visual
  half can be right while the announced one is wrong.
- The quick filter and the keyboard walk the same forest the renderer draws. Both are
  asserted on a promoted row — a test under a `PBI` — because both are wrong in the
  direction that still looks like a working screen: the filter leaves a non-matching row
  visible, and the keyboard leaves a visible row unreachable.
- Collapsing a suite does not collapse an Epic, and **Collapse all** in the catalog leaves
  every plan row as it found it — asserted by switching back, since the collapse bits are
  shared by path and a bulk button that overreached would show its damage only there.
- A quick filter surviving a projection switch answers for the projection now on screen.
  Asserted by switching with a needle in the box, not by re-typing it — re-typing is the
  path that already recomputes, so a test that types again would pass over the defect.
- The catalog announces itself as the **test catalog**, not as the product backlog.
  `renderProjectionContent` returns `label: 'Product backlog'` from its tree fallback, so a
  projection that becomes tree-shaped by falling through inherits the tree's *identity*
  along with its behaviour — and a screen-reader user who switched projections would be
  told they are still in the backlog. The label is the one thing the fallthrough must not
  give away, and it is asserted, because nothing on screen shows it and no other criterion
  here would fail if it were wrong.
- Keyboard commands work whenever this projection has rows, including when a **stored plan
  focus** matches nothing. `handleTreeKeydown` bails on `model.items.length === 0` before
  it walks any roots, and with such a focus that list is empty while the catalog draws
  suites off the unfocused tree — so every key would be inert on a screen full of rows. The
  guard asks this projection's visible population instead. (Deleting it outright also works,
  since `visible.length === 0` two lines later answers the same question correctly for every
  projection; the one consequence is that filter keys would then be handled on an empty
  model, which is a change worth making deliberately rather than as a side effect.)
- The catalog is **tree-shaped** at every gate that asks: columns fit and refit on resize,
  the fit classes survive its render, Expand/Collapse all are live when there is something
  to collapse, and a row's menu carries Move up/down/top/bottom and indent/outdent. Each is
  asserted, because each fails on its own and none of them fails loudly.
- Completed-item filtering is **off** here, not merely untoggleable: a test the state key
  calls done is still drawn. Asserted with `Show completed items` off and a done test in
  the results — the configuration where withholding the button and leaving the filter on
  produces a row that is gone with no way back.
- The catalog's count label counts this projection's own **results** — the tests and the
  `Task`s beneath them, no context row — and its completed toggle is not rendered. Both
  consumers of that population are asserted, not just the visible one. Two rows carry the
  whole rule between them: a `Task` under a test, which a criterion written as "counts
  tests" leaves visible and uncounted, and a context `Test case`, which one written as
  "counts what it draws" counts while the results never held it. On the base of 2a — one
  returned `Task`, its `Test case` parent excluded — the count is **1**.
- The top-level creator offers the test types here and no plan type
  ([[Test suite and test case as a ladder of their own]] 1b), so nothing created from this
  toolbar lands outside the projection that created it.
- The focus level is ignored here and is left intact for the projections that use it —
  both halves asserted, since the second is the part [[A Deliverables board]] had to
  correct after shipping. The focus button offers no menu in the catalog, and offers no
  test type in the plan.
- The catalog is built from the **unfocused** tree: with a plan focus of `PBI` stored, every
  suite is still drawn, the count is complete, a drop at the root level is not refused, and
  a newly loaded suite outside the focused subtree gets its default collapse state like any
  other new parent.
  Asserted with the focus stored rather than cleared — a fixture that clears it first tests
  nothing, since the defect is precisely what a *surviving* focus does to a projection that
  claims to ignore it.
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
- Picking the catalog **activates it**, and it **survives a reload**. Two assertions, not
  one, because they fail at different places: the toggle does nothing at all if
  `projection()` cannot map the stored constant back, and it works-then-forgets if
  `readEntry` discards the value on the way in. Neither is caught by setting the projection
  and asking the view what it is — that path can pass while both halves are wrong, since
  the setter and the getter are separate manual translations of one mapping.

## Where it lives

**Nothing yet — this note is design.** The toggle's positions are
`src/view/render/toolbar.ts` and `src/view/render/projections.ts`, the stored position
`src/view/uiState.ts` over `src/storage/collapseStore.ts`, the empty state
`src/view/render/emptyStates.ts`, and the rows themselves `src/view/render/rows.ts` — the
same tree renderer over a different population, which is what makes this projection cheap
and is the reason it is a tree rather than a third kind of drawing.

**`renderProjectionContent` needs a branch, not a fallthrough.** Its last line renders the
tree and returns `role: 'tree', label: 'Product backlog'`, so every projection that is not
board, roadmap or Deliverables gets the backlog's accessible name for free. The catalog
wants the renderer and not the name, which is one line and the sort of line a fallthrough
is designed to make invisible.

**The roots are the one thing no consumer can be handed unchanged.** `renderTree` takes
`model.roots` and `renderForest` filters siblings without descending through the ones it
drops, so a projection that only hides rows loses everything under a hidden parent. What
this projection needs is a root set of its own, computed by the rule in step 2 — which
belongs beside `collectFocusRoots` in `src/domain/model.ts`, the function that already
answers "what does the rendered tree root at when it is not the model's own roots", rather
than as a second re-rooting written inside the renderer.

**Which consumers take it is a category question, and `grep model.roots` answers it.**
Eight call sites outside the model read those roots, and they divide cleanly by what they
are asking:

| Takes the projection's roots — asks what is on screen | Keeps the whole tree — asks about the vault, or about what a stored number means |
| --- | --- |
| `src/view/render/rows.ts` (the forest, and the "any row at all" check) | `src/view/interactions/create.ts` — `hasItems` and `inferFolder`, which say so in a comment: *judge existence and infer folders from the FULL tree* |
| `src/view/filterState.ts` — the match index | `src/domain/writePlan.ts` — the ✨ backfill, which writes to every note |
| `src/view/interactions/keyboard.ts` — `visibleItems` | |
| `src/domain/dropTargets.ts` — where a root-level drop lands: the **positionable** list, this projection's genuine roots (2d) | `src/domain/writePlan.ts` — the **ranking group** the order is computed and renumbered against: every parentless item, which is what the number means on disk (2d) |
| `src/view/interactions/structure.ts` — indent and outdent's root list, likewise positionable | |
| `src/view/interactions/create.ts` — which roots a new one is created *among* | `src/view/interactions/create.ts` — `endOfSiblingsOrder` for a new root takes the **ranking group**: it answers the supplied list's maximum plus a spacing, so a last suite at 10 with a hidden Epic at 20 hands the next suite the Epic's own number. Appending against the whole group is also the position the catalog wants — a maximum over a superset always clears the last visible root too |

The line is *what is this asking about* — the screen, or the vault — and both sides already
have their reasons written down beside them. The left column's mistake is invisible (a
number or a target that disagrees with the rows); the right column's would be loud (a
backfill that skipped notes).

**This is a category invariant, so it wants a check at the forbidden thing rather than six
tests.** `no-restricted-syntax` already forbids `processFrontMatter` outside `storage/`;
the same shape — `model.roots` and `model.realRoots` readable only inside the module that
computes projection roots, with the two vault-wide consumers exempted by name — would hold
for a seventh consumer nobody has written yet. Six tests hold for the six that exist, which
is exactly the guarantee this PBI has now had to widen three times.

**"Tree-shaped" has the same problem and the same answer.** `projection === 'tree'` appears
in six gates — `src/view/render/columns.ts` (the fitted column count),
`src/view/resize.ts` (refit on resize), `src/view/backlogView.ts` twice (clearing the fit
classes for card projections, and the second measuring pass),
`src/view/render/toolbar.ts` (Expand/Collapse all), and `src/view/interactions/menu.ts`
(the move section) — plus `hideCompleted`, which is written as `!== 'deliverables'` and
needs the catalog beside it. A **predicate** the gates ask, rather than seven edited
equality checks, is what makes the seventh gate correct when someone writes it; and a lint
rule forbidding a bare `projection === 'tree'` outside that predicate is what makes the
predicate hold rather than merely exist.

**The forest is read off the unfocused tree**, which is a `src/domain/model.ts` question
rather than a view one: `buildModel`'s focus branch replaces `roots`, `items` and `results`
together, so anything computed after it inherits the narrowing. `deliverableResults` is
already computed *before* that branch for exactly this reason, and the catalog's forest
belongs beside it — not in a later pass that would have to undo the focus.

**The promoted root wants a flag, not five edits.** `focusRoot` is a field on the item,
set by `collectFocusRoots` and read at four call sites; a projection root is the same
category, so either it sets that flag too or the flag is renamed to what it has always
meant — a root of the **rendered forest**. The second is tempting and is a rename of shipped
code this PBI does not otherwise touch; the first is smaller and leaves a field called
`focusRoot` true for an item no focus produced, which is a comment's job to explain. Either
way the depth comes from `assignVisualDepth`, which focus already uses for exactly this.

**The stored mode is a round trip through three places, and exactly one is
compiler-checked.**

| | | |
| --- | --- | --- |
| `PROJECTION_MODE` (`view/collapseState.ts`) | projection → constant | `Record<Projection, …>`, so a new projection cannot be added without a case |
| `projection()` (`view/collapseState.ts`) | constant → projection | a manual `if` chain ending in an unguarded `return 'tree'` |
| `readEntry` (`storage/collapseStore.ts`) | what a stored value may be | a hand-written array literal; anything else is discarded on read |

Only the first refuses to compile. The second and third accept a new projection silently and
answer `tree`, so the catalog would be **written correctly and never activate** — and not
merely after a reload: `setProjection` stores the constant and then renders, and the render
asks `projection()`, so the toggle does nothing the moment it is clicked.

`PROJECTION_MODE`'s own comment is the argument for fixing this by derivation rather than by
three edits. It records that the chain it replaced *"stayed green after a new projection was
added and silently persisted its bare name"* — the write direction was hardened after
exactly this miss, and **the reverse direction is still that chain**, a few lines below the
map that replaced it. One mapping should answer both directions, so the getter cannot drift
from the setter.

The storage half cannot join that mapping: `storage/` may not import `view/`, and lint fails
the build on it. What it can do is run the other way, since the mode constants already live
in `storage/` — one exported list of them there, consumed by `readEntry`, leaving
`PROJECTION_MODE` its exhaustiveness over `Projection`. Then all three agree by
construction and the next projection inherits every one.

**Three lifecycle seams sit beside those gates and are not gates at all.**
`refreshFromData` seeds default collapse state by handing `collapseNewParents` its
populations — `model.items` **plus** `deliverableResults`, the second passed explicitly
because the first is narrowed by a focus. The catalog's population joins it for exactly
that reason: with a plan focus stored, a newly loaded suite outside the focused subtree is
never offered to that call and opens expanded, against the promise that collapse here
behaves as it does in the backlog tree. That the existing call already carries a second
list is the evidence this is the established shape rather than a new one.
`collapsiblePopulation` (`src/view/render/toolbar.ts`) decides what a bulk collapse
*touches* rather than whether a button is *enabled*, so the tree-shaped predicate does not
reach it — it needs the catalog's forest by name. And `UiStateController.setProjection`
(`src/view/uiState.ts`) stores the mode and renders without recomputing the filter index,
which no gate anywhere would have caught: the index is correct when built and wrong when
the thing it was built for changes underneath it.

`src/view/interactions/keyboard.ts` is the one gate needing nothing, and it is worth
naming so nobody edits it: it dispatches to the **board** keyboard for `board` and
`deliverables`, so a new projection falls to the tree's own handler by default. It is
correct here by construction, which is what a projection-shaped gate looks like when it is
written the right way round.

Which items belong to this population is a domain question and lives with the type
vocabulary in `src/domain/itemTypes.ts`, beside the answer [[Tests stay out of the plan]]
needs, so the two are one predicate read from both directions rather than two lists that
can disagree.
