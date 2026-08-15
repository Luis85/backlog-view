---
type: PBI
parent: "[[An Iterations board]]"
order: 20
status: Open
priority: P2
created: 2026-08-15
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A board scoped to one iteration

**As** someone working a sprint, **I want** a board showing only this iteration's work in
a workflow of its own, **so that** what is in flight for the next two weeks is not read
off a board holding everything the product will ever do.

This is the board [[Columns from the workflow]] already describes, projected a third
time: the same rule — the workflow the view options define **is** the column
configuration — over a second independent property, with a population narrowed by a
link rather than by a type.

It is reached differently from [[A Deliverables board]], on purpose, and the reason is
**arithmetic, not scope**. That board took a toggle position because there is exactly one
of it: its population is a type, the vocabulary is fixed, and the position is as
permanent as the name. Iterations are unbounded and only ever accumulate — a vault three
years in has seventy of them. A toggle with seventy positions is not a toggle. So `Board`
stays one toggle position and grows a **scope**, the shape [[Horizons or dates]] already
uses to offer the roadmap's two axes from one control.

That is the whole argument, and it deliberately no longer rests on the two boards holding
the same kind of work. An earlier draft of this note claimed every card here is also a
card on the product board, and used that as the reason a scope was safe where a toggle
position was not. It was a false claim and a bad argument. False, because this board
holds Deliverables and the product board excludes them (3e). Bad, because a control is
chosen by how many things it has to offer, not by whether two populations happen to
coincide — and tying the argument to a coincidence would have made the picker look wrong
the moment the populations diverged, which is exactly what happened.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing an iteration from the board's scope picker |
| **Preconditions** | Board mode is on, the iteration property is configured, and at least one `Iteration` note is in the model. A resolved workflow is **not** a precondition: it is what the columns need, not what entering the scope needs, and 4a is the guidance shown when there is none |
| **Guarantee** | One model, one write gate, one undo history, exactly as [[Product Kanban]]'s own guarantee states. Switching scope re-runs no query and writes nothing; a move writes the *resolved* iteration state key alone. |

**Main flow**

1. In board mode the toolbar draws a scope picker beside the projection toggle, naming
   `Product` and every `Iteration` note in the model.
2. Choosing an iteration stores the scope — the same per-view collapse-store entry the
   projection mode and the roadmap axis use, vault-scoped localStorage, per device, never
   the `.base` — and re-renders from the model already in hand.
3. The cards are the results whose iteration link resolves to that note, and no others:
   carriers only, never a descendant that did not say so itself — whatever their type,
   `Deliverable` included (3e).
4. The columns are the workflow the `Iterations` options group defines — its own state
   property when one is configured, or the product workflow's resolved key when it is
   not. Either way the columns run: no-state first, the configured states in order, then
   any observed value the configuration does not name.
5. A drag, an Alt+Left/Right or the card menu's `Set state` all write the resolved
   iteration state key alone, through the gate every other move goes through, and
   announce themselves in the same words from the same live region
   ([[Keyboard and menu moves]]).

**Extensions**

- **1a — no `Iteration` note is in the model.** The picker does not render at all. With
  nothing to choose between there is no choice to offer — the refusal the axis picker
  already makes with a single configured axis, and the reason board mode is unchanged for
  a vault that never adopted iterations.
- **1b — the iteration property is unconfigured** ([[An iteration is a note of its own]]
  extension 2b). No item can name an iteration, so the picker offers nothing but
  `Product` and is not drawn.
- **2a — the stored scope names a note that is gone, or is no longer an `Iteration`.**
  The board renders `Product` and the stored value is **retained, not rewritten**, so
  restoring the note restores the saved scope. Stored state is user data, dropped rather
  than guessed at — the rule [[Horizons or dates]] extension 3a already states for the
  axis pick.
- **2e — the chosen `Iteration` note, or a folder above it, is renamed.** The stored scope
  **follows it**, and the board keeps showing the same iteration. This is the first UI
  state whose value is a PATH, so it is the first that has to be migrated on a rename;
  without it the stored path would go stale on a rename and drop the reader to `Product`
  — a choice silently undone, which is the opposite of what 2a's "retained, not rewritten"
  rule exists to protect. A folder rename counts, so the migration matches the path or its
  `oldPath/` prefix rather than the renamed path alone.
- **2b — the base holds several saved views.** The store keys by base plus view name, so
  one base can hold a product board beside an iteration board over the same notes. That
  is why the scope is per saved view rather than per base.
- **2c — a quick filter is active.** It carries over rather than clearing, in every scope
  alike, because dropping it on a switch would make the picker destructive — **and it is
  indexed over the whole tree here, not the focused forest.** `filterScopeFor` answers
  `'whole'` for the Deliverables board and `'focused'` for everything else, and it takes
  the **projection** alone, which a board scope does not change. So it has to learn about
  the scope, or an inherited focus would hide a matching card through the filter that 3c
  just promised no focus could hide. The two answers must agree: a board whose population
  ignores the focus needs a match index that ignores it too, or the promise holds for the
  cards and breaks for the search.
- **2d — the toolbar's item count, with an iteration chosen.** It counts **this scope's**
  carriers. `countedPopulation` reads the projection and answers `model.results` minus
  Deliverables for every `board`, which is wrong here twice over: it counts product work
  this board never shows, and it drops the Deliverables this board deliberately includes.
  It is one function precisely so the count label and the completed toggle's "(N hidden)"
  cannot disagree, so the scope belongs inside it rather than beside it.
- **3a — a card is outside the Base's filter.** The context-row rule holds here exactly
  as on the product board: it renders as a breadcrumb, a lane header or an inert context
  card, and that is all — never a card to drag, never a write target, never counted,
  never a source of this board's column vocabulary.
- **3b — the iteration holds no items.** Every column renders empty and the board says
  **"No items in this iteration yet"** — never the product board's "All N items are done
  and hidden", which cannot tell an empty base from an empty scope. The same distinction
  [[A board scoped to Deliverables]] extension 1b had to draw, met a second time
  ([[Board empty states]]).
- **3c — a focus level is active** (set from another projection and carried over).
  **No focus level narrows this board, at any level, ever.** The cards are read off the
  whole, unfocused tree, the way `model.deliverableResults` already is and for the same
  reason: a control left set on another projection must not make this board's work
  disappear.

  An earlier draft of this note said the opposite — that a focus narrows this board
  "exactly as it narrows the product board" — and it was incoherent twice over. A focus
  level is a **ladder** control: it picks which rung becomes a card and rolls the rest up.
  This board's population is defined by an explicit **link**, which the ladder knows
  nothing about, so there is no rung for a focus to pick. And the product board does not
  narrow the way that draft assumed: under a focus it cards
  `requirementsFocusRoots(model.roots)`, not the results, so copying it would card a
  focused Feature *and* its matching descendants at once. Following it properly is worse
  still — a PBI in Sprint 12 whose Feature is in Sprint 13 would vanish from Sprint 12's
  board, which is the sprint's own content hidden by a setting made somewhere else.

  This is the ruling the human already made for the sibling board, in these words: *"when
  a type level is set and the user goes to the deliverables board, the type level shall
  not affect this board… there are only the deliverables to display."* There are only this
  iteration's items to display.
- **3i — a `Test suite`, a `Test case`, or a `Task` beneath one carries the iteration
  link.** It is **not** a card here, and this is not an exception to "whatever their
  type": catalog membership is not a type filter. `projectionMember` returns `!inCatalog`
  for every projection but the catalog's own, and `inProjection` is asked FIRST and
  unconditionally in the one `VisibilityRule` — *no needle makes a `Test case` a row of
  the plan*. The iteration board is a board in the plan projection, so it inherits that
  answer the way the tree, the product board and the roadmap already do. The catalog has
  a projection of its own; a time box over it would be a second feature, and nothing has
  asked for one.

  `Set iteration` follows the same line and is offered on **plan rows only**, so the
  property cannot be written where no card could ever appear. Accepting a link that
  silently never draws is the failure mode this closes; the alternative — a third mixed
  population spanning two ladders — is a bigger change than this feature, and the
  register would have to argue it rather than let a criterion imply it.
- **3h — the toolbar's focus picker, while an iteration scope is chosen.** It offers no
  menu and renders no "Focused: <level>" label and no clear button, exactly as it does on
  the Deliverables board: whatever the inherited focus, it does not narrow this board, so
  there is nothing for a label to name and nothing for a clear button to undo.
- **3d — an item's own iteration differs from its parent's.** Its own value decides, and
  the parent's is not consulted. Nothing is inherited down the tree.
- **3e — a `Deliverable` carries the chosen iteration link.** It **is** a card here, and
  this is the one board where the two kinds of work sit together. That is the point of a
  time box rather than an exception to a rule: a sprint is a commitment to finish some
  work, and a concept or a design is part of what a sprint commits to. The product board
  is scoped to a kind of work and the Deliverables board to another; this board is scoped
  to a *fortnight*, and a fortnight does not care what kind of note a piece of work is.
  So the population is a plain question about one link, asked of every result whatever
  its type — no type filter, and none of the product board's `!isDeliverableType`.
- **3f — a `Deliverable` card is on this board and its column is asked for.** The
  **iteration** workflow decides, exactly as it does for every other card here. One board
  has one column list; a board that columned some cards by one vocabulary and some by
  another would not be a board.
- **3g — the same card's FINISHED STYLING is asked for.** It comes from the item's **own**
  workflow, not from this board's — a Deliverable's from the Deliverable workflow, a PBI's
  from the product one — so on an iteration board **no** card's `pbl-done` is decided by
  the iteration workflow, and a card can sit in a column this board calls done while not
  being styled as done.

  That reads like an inconsistency and is a deliberate rule kept where it is decided.
  `createCard` asks `ownWorkflowReading(item)` and takes **no** completion parameter, and
  its comment records why: it *was* a parameter with an `item.done` default and a
  per-board override, which is a category invariant asked at the places someone thought
  of. The Deliverables board and the timeline passed their own; the horizon buckets, the
  shelf and the context strip took the default and styled a Deliverable by a workflow
  that does not track it, in both directions. Restoring an override for this board would
  re-open that hole for the sake of one screen.

  An earlier draft of this note said the opposite — that the shell "takes completion as an
  input rather than reading `item.done`" — and cited
  [[A Deliverable is coloured by its own workflow]] for it. That note states the
  **type-dispatch** rule; the parameter it describes had already been removed. A sentence
  about code, written from another note rather than from the code, and wrong in the one
  direction that would have shipped.
- **3j — a value under the iteration state key is carried only by a `Deliverable`.** It
  mints a column here like any other observed value, because a Deliverable card can land
  in it. This is the mirror image of the product board's rule, and the same rule
  underneath: a board's stray columns come from **its own** population, so a column
  nothing on this board could reach is never drawn, and a column something on it holds is
  never withheld.
- **3k — a value under the iteration state key is carried only by ANOTHER iteration's
  work.** It mints no column here. "Its own population" means **this scope's carriers**,
  not every carrier in the base: a `Deferred` used only in Sprint 13 must not open an
  empty `Deferred` column on Sprint 12, nor offer it as a Set-state target there. So the
  observed vocabulary is collected from the population the board is drawing, the way
  `requirementsWorkflow` collects from the results rather than reading
  `model.observedStates` — and never from a model-wide list that no scope could narrow.
- **3l — an `Iteration` note itself carries an iteration link**, written by hand rather
  than through a menu that refuses to offer it. It is not a card. An iteration is the
  scope a board is chosen by, and the population refuses one rather than trusting the
  menu to have prevented it — a rule the population keeps holds against a note nobody
  edited through the UI.
- **4a — neither the iteration state property nor the product one is configured.** The
  scope is still **enterable** and the board shows the unconfigured empty state, naming
  the option to set and where. A workflow is what the COLUMNS need, never what the scope
  needs: gating scope selection on a resolved workflow would make this very guidance
  unreachable, since the only way to see it is to be on the board that has none. The
  fallback means an unconfigured iteration state property alone is not enough to trigger
  it — the product `stateKey` has to be missing too.
- **4b — the iteration state property is configured on its own key, but its states or
  done values are not.** They fall through to **this** workflow's own observed values or
  the shipped default, never to the product workflow's declared states or customized done
  values. What the key decides is which fallback an **empty** list takes — never whether
  a list the user populated is used. **A list you set always wins**, shared key or not:
  the all-or-nothing rule is about borrowing, not overriding. This is the sentence
  [[A board scoped to Deliverables]] got wrong the same day a check asserting the
  opposite landed, so it is stated in the direction the check reads.
- **4c — a value under the configured iteration state key sits on a note in no
  iteration.** It never mints a stray column here and is never offered on a Set-state
  menu: a column no card on this board could land in is not a target this board offers.
- **5a — the move takes the card out of this scope**, because the base's filter names the
  state property. The card leaves in silence, as it already does on every other board:
  nothing correlates a Bases pass with a write, so no outcome report is attempted here
  either. The open question is recorded, not reopened.
- **5b — "Show completed items" is off.** It does not reach this board, and that is one
  field rather than a per-caller choice: `hideCompleted` is false in this projection's
  `VisibilityRule`, exactly as it is for the Deliverables board. The toggle describes the
  **requirements** rollup (`item.subtreeDone`), and this board's completion is a question
  the iteration workflow answers, so letting it through would hide a card by a verdict
  from a workflow this board does not draw. A card whose *product* state reads as done
  therefore still renders here, and the control is absent from the toolbar rather than
  present and inert. Answering completion properly needs a rollup over the iteration
  workflow, which nothing has asked for yet.

  The rule is set in the one predicate rather than at the call sites for the reason that
  predicate's own comment records: it was a per-caller choice for three surfaces and the
  fourth forgot, emptying a card's child disclosure from a setting flipped on another
  projection.

## Acceptance criteria

- In board mode the toolbar offers a scope picker naming `Product` and every `Iteration`
  note **while the iteration property is configured and at least one `Iteration` note is
  in the model**, and does not render it otherwise. Both halves: with no configured
  property nothing can join a scope, so a picker offering scopes would be a control whose
  every entry draws an empty board (1b).
- The scope is enterable with no workflow resolved, which is the only way extension 4a's
  guidance can be reached. A resolved workflow gates the columns, never the scope.
- The scope persists per saved view in the collapse store's vault-scoped localStorage,
  survives a restart on that device, and never touches the `.base`. A stale stored scope
  renders `Product` and is retained rather than rewritten.
- Renaming the chosen `Iteration` note — or a folder above it — carries the stored scope
  with it, so the board keeps showing the same iteration.
- Switching scope is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- Cards are exactly the results whose iteration link resolves to the chosen note,
  **whatever their work-item type** — no *type* is filtered out, `Deliverable` included.
  Catalog members are a different question and are excluded by `inProjection`, which is
  not a type filter (3i). No descendant appears by inheritance, and no result the link
  names is missing: the column counts sum to that population.
- **No focus level narrows this board**, checked over every level `ALL_TYPES` names plus
  no focus at all, because the population is read off the whole unfocused tree. The
  toolbar's focus picker renders no menu, no label and no clear button here.
- "Show completed items" does not reach this board: `hideCompleted` is false in its
  `VisibilityRule`, so a card whose product state reads as done still renders, and the
  toolbar omits the control rather than showing an inert one.
- A `Deliverable` naming the iteration draws a card here and is columned by the iteration
  workflow. Its **finished styling** comes from its own workflow, as every card's does in
  every projection — `createCard` asks `ownWorkflowReading(item)` and takes no completion
  parameter — so no card's `pbl-done` on this board is decided by the iteration workflow,
  and a card may sit in a done column without being styled done. Restoring a per-board
  completion override is explicitly refused: it is the category invariant `createCard`'s
  own comment records removing.
- The quick filter is indexed over the whole tree in an iteration scope, so an inherited
  focus cannot hide a matching card through the filter that the population ignores.
- The toolbar's item count and the completed toggle's "(N hidden)" both describe this
  scope's carriers — one function, so they cannot disagree.
- The board's observed vocabulary is collected from **this scope's carriers**, so a value
  only a `Deliverable` carries mints a column here, while a value carried only by items in
  no iteration — or in a DIFFERENT iteration — mints none.
- No `Iteration` note is ever a card on an iteration board, whatever its own frontmatter
  says.
- Columns come from the `iterationStateProperty` / `iterationStateValues` /
  `iterationDoneValues` group, falling back to the product workflow field by field — the
  key when no iteration state property is set, each list only while it is itself empty.
- A move — drag, Alt+arrow or menu — writes the resolved iteration state key alone,
  through the same gate, and is taken back by the one undo slot.
- A context row is never a card, a write target, a count or a source of columns.
- An iteration holding no items says so in its own words, not the product board's.

## Where it lives

The workflow is a third `Workflow` factory in `src/domain/board.ts`, beside
`requirementsWorkflow` and `deliverablesWorkflow`, over a settings group added to
`src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`, whose key resolver
joins `resolvedDeliverableStateKey` in `src/domain/optionalProperties.ts`. The population
is derived in `src/domain/model.ts`. The scope is a field beside `axis` in the per-view
entry of `src/storage/collapseStore.ts`, restored and debounce-saved by
`src/view/collapseState.ts`, read and written through `src/view/uiState.ts` and declared
on the host in `src/view/host.ts`. The picker is a `board` case in `renderProjectionZone`
in `src/view/render/toolbarControls.ts`, built the way `renderAxisPicker` beside it is;
the board itself is `src/view/render/board.ts` under the fork in
`src/view/render/projections.ts`, with its empty states in
`src/view/render/emptyStates.ts`. Moves reach the one host method in
`src/view/cardMoves.ts` from `src/view/interactions/cardDrag.ts`,
`src/view/interactions/keyboard.ts` and `src/view/interactions/menu.ts`, planned by
`src/domain/writePlan.ts` and applied by `src/storage/frontmatter.ts` through
`src/view/writeGate.ts`. Driven in `test/view/board.test.ts` and
`test/view/contextCardWrites.test.ts`, with the store round-trip in
`test/storage/collapseStore.test.ts`.
