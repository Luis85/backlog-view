# Iterations — design

Date: 2026-08-15
Status: approved, not built

## The ask

An `Iteration` concept for the backlog: work items say which iteration they belong to,
and a second kanban board shows one iteration at a time, with a workflow based on the
product board's. The two boards are reached from one switcher, the way the roadmap's two
axes are.

## Decisions taken during design

Four questions were put to the user. The answers below are the constraints, not
proposals.

1. **An iteration is a note of its own**, typed `Iteration` — not a property value and
   not an observed vocabulary. It can therefore carry dates, a goal and a body.
2. **The switcher chooses the board's scope** — the CONTROL is one `Board` toggle position
   plus a picker naming `Product` or an Iteration note, never a fifth toggle position. The
   Deliverables board keeps its own position, unchanged. *(This was originally written as
   "not a new projection", conflating the control with the internal identity. Only the
   control was ever the user's decision; §3 records why the internal identity had to
   become a projection anyway, and what that cost.)*
3. **Only items that carry the iteration land on its board.** No inheritance down the
   tree. A Task in Sprint 12 says so itself, whatever its parent says.
4. **An iteration draws as a bar or as a line, and that is a toggle**, not a fixed
   consequence of the type.

## What this is not

Deliberately out of scope, so a reader does not look for them:

- No burndown, no velocity, no capacity.
- No swimlanes and no all-iterations board.
- No "Show completed items" on an iteration board, following the Deliverables board's
  own deferral of the same control for the same reason: completion there is a question
  the iteration workflow answers, not the requirements one.
- No inheritance of an iteration from a parent item (decision 3).
- No automatic roll-over of unfinished work into the next iteration.

## 1 — `Iteration` joins the type vocabulary

A twelfth declared name, in `MARKER_TYPES` beside `Milestone`
(`src/domain/typeVocabulary.ts`). Twelfth, not eighth: earlier revisions of this spec said
eighth, taken from ADR 0013's title rather than from `ALL_TYPES`, which has held eleven
names since the two test types joined. The register's own rule covers it — measure a set
with an instrument that can see all of it — and a decision record's title is not that
instrument.

A marker occupies no rung, holds nothing and hangs from nothing, which is what an
iteration is: items *link* to it, they are never its children. Every structural rule
that follows is therefore inherited rather than written — no rung in the ladder, no `+`
offering to create a child under it, no **outgoing** dependency edge, ranked out of the
ladder by `itemTypes.ts`.

Outgoing only. A marker declares no prerequisites (`candidates` returns none for one) but
can still be **waited for**: `candidates` draws from `model.byPath` and excludes only
context rows, loops and what is already named. So any item may name an iteration as its
prerequisite, exactly as it may name a milestone — coherent ("this cannot start until
Sprint 12 closes"), already true of the other marker, and refusing it for one name would
be a rule about that name rather than about markers.

It owes the three shipped opinions ADR 0013 requires of a declared name: a default
subfolder (`iterations`, in `DEFAULT_TYPE_SUBFOLDERS`), an icon, and a badge colour.
This amends ADR 0013 exactly as the Milestone addition did on 2026-08-02.

Consequences that follow for free and are wanted: the type appears in the creator menus,
is accepted as a focus root, groups on the shelf, and is documented by the generated
README and the in-app manual, because all of those read `ALL_TYPES`.

## 2 — `iteration` joins the optional properties

One row in `PROPERTY_TABLE` (`src/domain/optionalProperties.ts`):

| | |
| --- | --- |
| field | `iteration` |
| option key | `iterationProperty` |
| suggested key | `iteration` |
| label | `iteration` |
| settings key | `iterationKey` |

That single row buys the view option, the ✨ setup binding, the backfill stub, the
key-collision gate and the `ownedProperties` listing. No new machinery.

**Reading it.** The value is a wikilink to the Iteration note. `src/domain/noteFields.ts`
already resolves a link property through the metadata cache — handling wikilinks,
aliases, bare names and lists — which is how `parent` and `dependsOn` are read.

**Writing it.** Beside the **parent link's** own write in `src/storage/frontmatter.ts`,
not in `applyLabels`. An earlier draft of this spec said the label list, reaching for the
cheapest reuse; that list is for plain LABEL strings — the risk and the assignee — and it
carries neither the app nor the source path, which `wikilinkTo` needs. Two Iteration notes
sharing a basename in different folders would then get one ambiguous `[[Sprint 12]]` that
resolves to whichever Obsidian picks, while the menu looked right. Reuse is judged by what
the value IS, and this one is a link. The plan therefore carries the target **file**, never
a serialized string. The three rules the label list keeps are kept here too: an
unconfigured key is never written, `null` deletes, `undefined` leaves the key alone.

**Never put in one.** An `Iteration` is not offered `Set iteration`, and the board
population refuses one as a card rather than trusting the menu to have prevented it — a
key written by hand would otherwise make one iteration a card on another's board, which
the badge decision leans on being impossible.

**Setting it.** A `Set iteration` submenu on the row and card context menus, offering
every Iteration note plus `None`. Its checkmark is asked of the **plan** — an entry is
checked exactly when picking it would write nothing — never by a comparison written
beside the plan.

## 3 — The board grows a scope

`Board` stays one position on the projection toggle. `renderProjectionZone`
(`src/view/render/toolbarControls.ts`) switches on the toolbar POSITION rather than the
projection, and its `'board'` case draws a scope picker — the axis picker's twin, in the
same zone, built the same way. (Switching on the projection would delete the picker the
moment it was used; see the price below.)

```
[ Tree | Board | Roadmap | Deliverables ]
[ Scope: Product ▾ ]  →  Product · Sprint 11 · Sprint 12
```

Offered only when the iteration property is configured **and** at least one Iteration
note is in the model. Both halves: with no notes there is nothing to choose between —
the refusal `renderAxisPicker` already makes for a single configured axis — and with no
configured property nothing can join a scope, so every entry the picker offered would
draw an empty board.

**Internally it is a projection, not a flag.** `Projection` gains `'iteration'`, and the
chosen note's path is stored beside it as a parameter. The *control* is unchanged — one
`Board` position plus a picker, which is what was asked for — but "am I an iteration
board" becomes a question `src/view/projection.ts` answers rather than a comparison
repeated at call sites.

That reverses an earlier revision of this spec, and the reversal was expensive enough to
record. As a scope FIELD, seven separate functions answered for the product board while
an iteration was chosen: `filterScopeFor`, `countedPopulation`, `hideCompleted`, the
columns dispatch, the `Set state` gate, its checkmark planner, and `byProjectionType`.
They were found one review round at a time, each fix correct and one case short of the
next. `projection.ts` states the rule in the file itself — *"a projection added beside
`'tree'` rather than **as** a tree fails each of those gates silently and differently"* —
and `filterScopeFor`'s comment records the identical history for the Deliverables board:
three fixes, each one case short, because one set was being asked two questions.

As a projection, `Record<Projection, …>` in `src/view/collapseState.ts` fails to compile
until every question has an answer. That is an instrument that can see the whole set,
which is what the register asks for wherever a category invariant is at stake.

**The split has a price, and it falls on the toolbar.** Two controls compare the
projection to a *position* directly: `renderProjectionZone`'s switch, and the toggle's
`is-active` / `aria-pressed`. Once the internal identity and the control identity stop
being the same value, both are wrong — the scope picker would delete itself on first use,
leaving no way back to `Product`, and no toggle position would render pressed. So
`projection.ts` gains a `toolbarPosition` question answering `'board'` for `'iteration'`,
and both controls ask it. One extra question is the whole cost, and it is worth the
compile-checked gates; it is named here rather than discovered, because a split that
keeps the control shape must be checked *at the control*.

**Both values are UI state.** The projection and the scope path live in the collapse
store's per-view entry (`src/storage/collapseStore.ts`) — vault-scoped localStorage, per
saved view, per device, never the `.base`. ADR 0011's rule, applied again.

Read defensively, as every stored value there is: a stored path that no longer names an
Iteration falls back to `Product` and is **retained rather than rewritten**, so restoring
the note restores the saved choice. That is the axis pick's own rule
([[Horizons or dates]] extension 3a), and it is what makes a stored value user data
rather than a cache.

A host accessor pair `boardScope` / `setBoardScope` joins the siblings in
`src/view/uiState.ts`.

## 4 — Population and columns

| Scope | Cards | Columns |
| --- | --- | --- |
| `Product` | unchanged | `requirementsWorkflow` |
| An iteration | the plan results whose `iteration` link resolves to that note, **whatever their work-item type** | `iterationWorkflow` |

**Catalog members are excluded, and that is not a type filter.** `projectionMember`
returns `!inCatalog` for every projection but the catalog's own, and `inProjection` is
asked first and unconditionally in the single `VisibilityRule` — *no needle makes a
`Test case` a row of the plan*. The iteration board is a board in the plan projection and
inherits that answer, as the tree, the product board and the roadmap already do. So
"whatever their type" means every **work-item** type, `Deliverable` included; the two
ladders stay apart. `Set iteration` is therefore offered on plan rows only, so the
property is never written where no card could draw.

**A workflow gates the columns, never the scope.** An iteration scope must be enterable
with no workflow resolved — otherwise the unconfigured empty state below is unreachable,
since the only way to see it is to be on the board that has none.

**Deliverables are included** — decided by the user on 2026-08-15, after a review round
had argued them out. No type filter at all: not the product board's `!isDeliverableType`,
and not its mirror. A sprint is a commitment to finish some work, and a concept or a
design is part of what a sprint commits to, so this is the one board where the two kinds
sit together. The product board is scoped to a kind of work and the Deliverables board to
another; this one is scoped to a fortnight, which does not care what kind of note a piece
of work is.

Three consequences follow. A `Deliverable` card is **columned** by the iteration workflow
like every other card here — one board has one column list. The board's observed
vocabulary is collected from **its own** population, so a value only a Deliverable carries
mints a column here, the mirror of the rule `requirementsWorkflow` keeps for the same
reason.

The third is a correction. An earlier draft said a card's finished styling would come from
the iteration workflow, "through the shared card shell, which already takes completion as
an input rather than reading `item.done`". **That is false about this codebase.**
`createCard` asks `ownWorkflowReading(item)` and takes **no** completion parameter; its
comment records that the parameter was removed precisely because a per-board override is a
category invariant asked at the places someone thought of — the Deliverables board and the
timeline passed their own while the horizon buckets, the shelf and the context strip
styled a Deliverable by a workflow that does not track it. So on an iteration board **no**
card's `pbl-done` follows the iteration workflow: each follows its own type's. A card can
sit in a column this board calls done and not be styled done. That is the honest outcome
and the cheap one; restoring the override would re-open a hole for one screen.

What this costs is a claim the design cannot make: *every card on an iteration board is
also a card on the product board* is false, and an earlier draft used it as the argument
for a scope picker over a toggle position. The argument is replaced rather than patched.
A control is chosen by **how many things it has to offer** — iterations are unbounded,
Deliverables are one — never by whether two populations coincide.

`iterationWorkflow(population, settings)` sits in `src/domain/board.ts` beside
`deliverablesWorkflow` — a third instance of the `Workflow` interface, stated as a factory
so the domain tests exercise the workflow the view builds.

It takes the **population**, not the model, and that is load-bearing. Its observed
vocabulary is collected from the cards this board actually holds, the way
`requirementsWorkflow` uses `collectObservedStates` rather than reading
`model.observedStates`. A model-wide `observedIterationStates` — which an earlier draft
proposed — merges every iteration's vocabulary, so a `Deferred` used only in Sprint 13
would open an empty `Deferred` column on Sprint 12 and offer it as a Set-state target
there. Handing the workflow the population removes the model-wide list a scope could
disagree with, rather than adding a scope argument to correct it.

The context-row rule applies unchanged: an `outsideFilter` item renders, it parents, and
that is all — never a card to drag, never a write target, never counted, never a source
of this board's column vocabulary.

**Neither of the two narrowing controls reaches this board**, which is the Deliverables
board's arrangement adopted wholesale rather than an exception argued case by case.

*No focus level narrows it, at any level.* The cards are read off the whole, unfocused
tree, the way `model.deliverableResults` already is. An earlier draft of this spec said
the opposite and was wrong twice. A focus level is a **ladder** control — it picks which
rung becomes a card — and this population is defined by a **link**, which the ladder knows
nothing about, so there is no rung to pick. And the product board does not narrow the way
that draft assumed: under a focus it cards `requirementsFocusRoots(model.roots)`, not the
results, so "narrows exactly as the product board does" named no behaviour that exists.
Implementing it faithfully would be worse than incoherent — a PBI in Sprint 12 whose
Feature sits in Sprint 13 would disappear from Sprint 12's board because of a control set
on another projection. The human already ruled this way for the sibling board: *"there are
only the deliverables to display."* There are only this iteration's items to display.

*"Show completed items" does not reach it either*, as one field — `hideCompleted: false`
in this projection's `VisibilityRule` — never a per-caller choice. That predicate's own
comment records why: it was a per-caller choice for three surfaces and the fourth forgot.
The toggle describes the **requirements** rollup (`item.subtreeDone`), and completion here
is the iteration workflow's question, so a card whose product state reads as done still
renders. Answering completion properly needs a rollup over the iteration workflow, which
nothing has asked for.

The toolbar follows: on an iteration scope the focus picker renders no menu, no
"Focused: <level>" label and no clear button, and "Show completed items" is absent rather
than present and inert.

## 5 — Its own workflow, based on the product one

An `Iterations` view-options group mirroring `deliverablesGroup()`
(`src/domain/viewOptions.ts`):

| Option key | What it is |
| --- | --- |
| `iterationStateProperty` | the iteration workflow's own state property |
| `iterationStateValues` | its ordered states |
| `iterationDoneValues` | its states that count as done |

Resolved by `resolvedIterationStateKey` in `src/domain/optionalProperties.ts`, beside
the two resolvers already there.

**The fallback is field by field**, which is the Deliverables board's hard-won rule and
the exact sentence a register note once got wrong: the *key* falls back to the product
board's resolved `stateKey` when no iteration state property is set; each *list* falls
back only while it is itself empty. **A list you set always wins**, shared key or not.
The all-or-nothing part is about borrowing, never about overriding.

## 6 — Moves

A column move on an iteration board writes the resolved iteration state key alone,
through **`performIterationBoardMove`** — a third host method beside `performBoardMove`
and `performDeliverablesBoardMove`, over the shared `applyCardMove`. One method, three
inputs (drag, Alt+arrow, card menu), one place the batch is planned and one place it is
announced. Same `applySafely` gate, same single undo slot.

An earlier revision of this spec said the move would go through `performBoardMove`
itself, "taking the scope's workflow as an input rather than growing a twin beside it".
That was wrong about the code: `performBoardMove` takes no workflow input and always
calls `computeStateWrites`, so following it would write the **product** key while the card
sat in an iteration column. The rule this codebase actually states is *"adding a
projection means adding one such method, not a second idea of what a move is"* — a third
method sharing `applyCardMove` **is** that rule, not a violation of it. The economy was
imagined; the planner it would have needed does not exist, which is why Task 11 adds
`computeIterationStateWrites` before it routes anything.

`applyCardMove`'s capture rule holds here too: the vocabulary that names the move is
read before the await, because the batch's own refresh rebuilds the board before it
resolves and the column just vacated may be gone with its last card.

## 7 — Empty states

Two, in `src/view/render/emptyStates.ts`:

- **No workflow resolves** — the Deliverables board's unconfigured twin, naming the
  option to set and where.
- **The iteration holds no items** — "No items in this iteration yet". Never the product
  board's "All N items are done and hidden", which cannot tell an empty base from an
  empty scope. That is [[A board scoped to Deliverables]] extension 1b, met a second
  time.

## 8 — A bar or a line

`isMarkerType` today answers two different questions, and only `Milestone` needs them
fused. Adding `Iteration` to the same list without splitting them would make
`isMarkerType` mean two things at eight call sites — the exact defect
`src/domain/typeVocabulary.ts` records for `isExtraType`.

The split:

| Predicate | Means | Asked by |
| --- | --- | --- |
| `isMarkerType` | no rung, no children, no dependencies | `childTypeChoices`, `src/domain/dependencies.ts` and `src/view/interactions/dependencies.ts` — unchanged |
| `drawsAsPoint(typeName, settings)` | drawn at one date, and holdable at neither end | `placementEnds`, `placeItem` **and `barHolds`** in `src/domain/bars.ts`, `src/view/render/timeline.ts`, `src/view/render/milestoneLines.ts` |

`drawsAsPoint` is `isMarkerType(t) && !(isIterationType(t) && settings.iterationBars)`.
Toggle off, an iteration draws a boundary line exactly as a Milestone does. Toggle on,
it draws a bar from the dates it has and no line — closed with both, open-ended with one,
exactly as `inferSpan` already places every other item.

`barHolds` is the call site to name rather than leave to a rule. It asks **both**
predicates inside one function — `placementEnds` for which ends are writable, then
`isMarkerType` on a line of its own to return a body hold and nothing else. Widening
`placementEnds` alone leaves that branch meaning what it meant before: `iterationBars`
on, the bar drawn, and neither grip there. It is the third question the single predicate
answers today — what a *gesture* may take hold of — and finding it is what turned a
two-way split into a three-way one.

**A grip needs two independent yeses, and this option buys only one.** The *type* decides
which ends are drawable (`drawsAsPoint`); the *configuration* decides which are writable
(`optionalKeyFor`, which `barHolds` already checks). A base with a target property and no
start property gets no start grip on an iteration bar, exactly as it gets none on any
other bar, because a grip whose drag writes an unconfigured key is the safe-write rule
broken. Widening the first question must never be read as widening the second.

**The toggle is a `.base` view option** (`iterationBars`, in the Iterations group), not
UI state. That is not a preference call: `placementEnds` is read by the **writer** in
`src/storage/frontmatter.ts` to decide which date keys a drag may touch, and `storage/`
cannot reach localStorage-backed UI state without breaking the layer rule. It governs
writes, so it is configuration.

**Cost, stated plainly.** `placementEnds` grows a `settings` argument, so every caller is
touched: the row's Schedule and Unschedule, the shelf drop, the body slide, both grips,
and the writer. Mechanical, but it is the widest diff in the feature, and it is why this
ships as its own PBI that the board work does not depend on.

## Testing

`domain/` gets node tests, `view/` gets the jsdom harness, as ever.

- `test/domain/iterationSettings.test.ts` — the field-by-field fallback, in both
  directions, with the two claims the Deliverables note got wrong asserted explicitly.
- `test/domain/iterationModel.test.ts` — population is carriers only; a descendant
  without its own iteration is absent.
- `test/view/iterationBoard.test.ts` — the scope picker, its persistence, the fallback
  of a stale stored scope, and the two empty states.
- `test/view/contextCardWrites.test.ts` — extended, since a card projection's three
  entry points are what that file exists to ask about.
- `test/domain/bars.test.ts` — `drawsAsPoint` both ways, and that `isMarkerType`'s
  structural callers did not change meaning.

Obsidian cannot run here. A live-vault smoke test is still owed for: the type's badge
colour and icon, the scope picker's fit in the toolbar row, and the bar/line toggle's
appearance on a themed vault. `npm run harness` can answer layout and hierarchy for the
scope picker before any of it is built, by adding an `Iteration` type and a scope to
`demoOptions()` / `demoResults()` in `test/helpers/fixtures.ts`.

## Register work this implies

- `docs/requirements/An Iterations board.md` — the Feature, under [[Product Kanban]].
- Three PBIs under it, in the order the work should land.
- An amendment to ADR 0013 for the twelfth name.
- `docs/README.md`'s folder table gains an `iterations/` row, and its hierarchy table
  gains `Iteration` — both are gated by `docs-check.mjs` against `LEGAL_CHILDREN` and by
  `test/docs/surfaces.test.ts` against the real option keys, so neither can be skipped.
- Every new option key (`iterationProperty`, `iterationStateProperty`,
  `iterationStateValues`, `iterationDoneValues`, `iterationBars`, and the generated
  `typeFolder.iteration`) must be named in `docs/requirements/`, or
  `test/docs/surfaces.test.ts` fails.
- `CHANGELOG.md` gains an `[Unreleased]` entry in the pull request that earns it.
