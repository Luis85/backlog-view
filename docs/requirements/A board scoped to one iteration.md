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

This is the board [[Columns from the workflow]] already describes, projected a third time
— but **not** over a second property. It reads the product board's own state key and
narrows that one workflow into three columns: **Open**, the iteration backlog;
**In Progress**; and **Resolved**. Which product states fall in the two outer buckets is
configured; everything else is In Progress. The population is narrowed by a link rather
than by a type.

**That reverses what this note said until 2026-08-16**, and the reversal is kept rather
than overwritten. An iteration workflow with its own state property, its own ordered
states, its own done values and a field-by-field fallback was specified here in full, on
[[A Deliverables board]]'s argument: what "in progress" means inside a two-week box is
not what it means across a release. The user refused it before it was built — *"I don't
want to add another workflow… the same workflow as the product just narrower"* — and the
refusal is the better reading. Two properties for one question is two places a state can
be wrong, and a fallback is machinery whose only job is reconciling them. Two boards over
one backlog differ by which **states** matter, not by which property holds them.

**`Resolved`, not `Done`, and the difference is the feature.** A product workflow can hold
states downstream of the moment a sprint is finished with an item — `In review`,
`Released`, `Verified` — so this board's terminal column claims the weaker verdict. The
column is styled as finished; the cards in it usually are not, because a card's finished
styling follows its own workflow (3g) and `In review` is in nobody's done values. A
column's verdict and a card's are different questions asked of different vocabularies.

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
| **Preconditions** | Board mode is on, the iteration property is configured, and at least one `Iteration` note is in the model. A resolved state key is **not** a precondition: it is what the columns need, not what entering the scope needs, and 4a is the guidance shown when there is none |
| **Guarantee** | One model, one write gate, one undo history, exactly as [[Product Kanban]]'s own guarantee states. Switching scope re-runs no query and writes nothing; a move writes the product state key alone, and a move onto the bucket a card already sits in writes nothing at all. |

**Main flow**

1. In board mode the toolbar draws a scope picker beside the projection toggle, naming
   `Product` and every `Iteration` note in the model.
2. Choosing an iteration stores the chosen note's path — the same per-view collapse-store
   entry the roadmap axis uses, vault-scoped localStorage, per device, never the `.base` —
   and re-renders from the model already in hand. The stored MODE does not distinguish the
   two boards; the scope does, and choosing `Product` clears it. So the two values cannot
   contradict each other rather than being kept in step by a guard.
3. The cards are the results whose iteration link resolves to that note, and no others:
   carriers only, never a descendant that did not say so itself — whatever their type,
   `Deliverable` included (3e).
4. The columns are always three, in this order, over `settings.stateKey` — the product
   board's own key, read **directly** and never through the type-dispatching selector
   every other board reaches for (3f):

   | Column | Holds | A drop writes |
   | --- | --- | --- |
   | **Open** — the iteration backlog | no state at all, plus any state named in `iterationOpenStates` | the first value in `iterationOpenStates` **that reads back into Open**, or **removes the key** when there is none |
   | **In Progress** | every state neither outer bucket claims | the first `stateValues` entry in no bucket |
   | **Resolved** | any state in `iterationResolvedStates`, **plus** every product done value | the first value in `iterationResolvedStates`, or the first done value when that list is empty |

   Each of those three is one rule rather than three: **a bucket's representative is the
   first state the bucket rule itself places in that bucket** (4g).

5. If the chosen iteration carries a goal, one line of it draws above the columns.
6. A drag, an Alt+Left/Right or the card menu's `Set state` all write the **product**
   state key, through the gate every other move goes through, and announce themselves in
   the same words from the same live region ([[Keyboard and menu moves]]). Moving a card
   here therefore moves it on the product board too: that is what one workflow at two
   granularities means, not a side effect to design away.

**Extensions**

- **1e — two `Iteration` notes share a basename.** The picker names them apart, using
  enough of each path to separate them, and only where they collide — qualifying every
  entry would make the ordinary case unreadable to fix a rare one. The value behind each
  entry is the note, never its label. `Set iteration` shows the same list and does the
  same. Anything less asks the reader to choose between two identical words while the
  write underneath goes to real trouble to keep them distinct
  ([[An iteration is a note of its own]] extension 4b).
- **1a — no `Iteration` note is in the model.** The picker does not render at all. With
  nothing to choose between there is no choice to offer — the refusal the axis picker
  already makes with a single configured axis, and the reason board mode is unchanged for
  a vault that never adopted iterations.
- **1b — the iteration property is unconfigured** ([[An iteration is a note of its own]]
  extension 2b). No item can name an iteration, so the picker offers nothing but
  `Product` and is not drawn.
- **2a — the stored scope names a note that is gone, or is no longer an `Iteration`.**
  The view reads as the **ordinary product board everywhere** — its cards, its count, its
  completed toggle, its offered types, its filter index — and the stored value is
  **retained, not rewritten**, so restoring the note restores the saved scope. Stored
  state is user data, dropped rather than guessed at: the rule [[Horizons or dates]]
  extension 3a already states for the axis pick.

  Everywhere, not just in the cards. The staleness is resolved **once**, upstream of every
  question, into the projection the whole view then reads; resolving it only where the
  content is drawn would leave every other gate still answering as an iteration board, and
  the reader would get product cards under a zero-item iteration count with no completed
  toggle — each gate consistent with itself and the screen incoherent. Two values,
  deliberately: the raw stored path, which is user data, and the effective projection,
  which is derived. Nothing downstream asks the question a second time.
- **2g — the iteration property is cleared while a scope is chosen.** The view falls back
  to the product board, and the stored path is **retained** so re-configuring the property
  restores the scope. The configured key is therefore part of resolving the effective
  scope, not only the stored path: with no key every item reads a null iteration, so the
  path still names a real note that nothing can match, the picker is gone (1b) and the
  pressed `Board` position is a deliberate no-op (1d) — leaving the reader stranded on a
  permanently empty board with no control to leave it.
- **2h — a column is folded on an iteration board.** It folds **on that iteration only**.
  The fold identity carries the chosen iteration, not merely the fact that this is an
  iteration board: a scope shared by all of them would leave `Done` folded on Sprint 13
  because the reader folded it on Sprint 12, which is the product board's own collision
  one level in. `Done` on the product board is untouched either way.

  Putting a path inside a key has a price, and it is paid at the rename: a folded column
  **moves with its iteration** (2e), or the board reopens columns the reader closed and the
  store keeps entries nothing will ever match. Half of that price is not an option.
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
  indexed over the whole tree here, not the focused forest, with the index REBUILT as the
  scope changes.** Carrying the filter over is not enough on its own: the index is built
  for one forest, and a switch that changes which forest applies leaves a running filter
  answering for the previous one. So the scope setter rebuilds before it renders, the way
  the projection setter already does.** `filterScopeFor` answers
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
- **1f — the reader leaves for the tree or the roadmap and comes back to `Board`.** They
  return to **the iteration they left**, exactly as the roadmap returns them to the axis
  they left. The scope is retained state, and retained state that is not restored is a
  choice quietly discarded.

  This is why the stored mode does not name which board it is. Storing the two
  independently needs a guard on every way IN to `Board` to keep them in step, and one
  guard was written for the already-pressed click and did nothing for this route —
  `Sprint 12 → Tree → Board` would have rendered the product board under a picker still
  naming Sprint 12. Values that cannot disagree need no guard on any route.
- **1d — the `Board` toggle position is clicked while it is already pressed and an
  iteration is chosen.** Nothing happens. It looks like a no-op and is not one unless the
  click asks the same question the pressed state does: the position is `Board` while the
  projection is the iteration's, so a handler comparing the projection would set the
  ordinary board **without** clearing the scope, leaving the stored projection and the
  stored scope disagreeing — exactly what choosing `Product` exists to keep in step. Both
  the pressed state and the click ask the position; leaving a scope is always the scope
  picker's own action, never a bare projection change.
- **1c — an iteration is chosen and the toolbar rebuilds.** The scope picker is **still
  there**, naming `Product` and every iteration, and the `Board` position still renders
  pressed. Neither is automatic: internally this is its own projection, so a control
  comparing the projection to a toolbar POSITION would drop the picker the instant it was
  used — the control disappearing precisely because it worked — and leave the switcher
  showing nothing selected. Which position a projection lights up is therefore its own
  question, asked in the module that owns projection questions, and the answer for an
  iteration board is `Board`. Driven through the interaction rather than the end state: a
  test that renders the chosen scope directly passes while the round trip is broken.
- **2f — a question is asked that depends on WHICH board this is** — what the quick
  filter indexes, what the toolbar counts, whether the completed toggle applies, which
  types `Set type` offers, whether a card is a member at all. Every one is answered from
  the projection, in the one module that owns the question, never by a comparison written
  beside the caller. An iteration board is therefore **its own projection value**
  internally, even though the toolbar reaches it through a scope picker rather than a
  toggle position. The control shape and the internal identity are different decisions,
  and only the first was a preference. Made the other way — a scope flag consulted at call
  sites — seven separate functions answered for the product board instead, and each was
  found on its own, one at a time. `projection.ts` says why in the file itself: a
  projection added *beside* the others rather than *as* one fails each gate silently and
  differently.
- **3a — a card is outside the Base's filter.** The context-row rule holds here exactly
  as on the product board: it renders as a breadcrumb, a lane header or an inert context
  card, and that is all — never a card to drag, never a write target, never counted,
  never a source of this board's column vocabulary.

  So the board's CANDIDATES are not its population. An in-scope carrier hanging from an
  excluded ancestor needs that ancestor drawn to be placed at all, and a candidate list
  built from the carriers alone deletes it before the board can draw it. The carriers plus
  their excluded ancestors are what the board is built from; the carriers alone are what
  is counted, what supplies the vocabulary, and what may be written to.

  And a context row is drawn because it **parents something on this board** — never
  because something anywhere below it is visible. That rule has to live in the projection's
  own membership question, which is asked first and **inside the recursion**, rather than
  in a filter wrapped around the result: an excluded ancestor can parent work in several
  iterations, and so can a carrier, so a rule applied only at the outside still lets a
  match in Sprint 13 keep a card on Sprint 12 and swallow its "nothing matches" advisory.
  Scoping the membership scopes the walk; scoping the walk's output does not. An excluded ancestor can parent work in
  several iterations at once, so asking the tree whether it has a visible descendant would
  draw it on Sprint 12 for a match that only exists in Sprint 13, and would suppress
  Sprint 12's own "nothing matches" advisory while none of its carriers match. What is on
  screen is this board's population, so that is the set the question has to be asked of.
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
  **product** state key decides, exactly as it does for every other card here — and so do
  its `Set state` entries and its checkmark. Every routing question on this board is
  answered by the PROJECTION before it is answered by the item's type; asking the type
  first would give a Deliverable card another board's states while it sits in this board's
  column. Every input, not just the menu: the keyboard's own move handler tests the type
  first today, so a Deliverable moved with Alt+arrow here would write the Deliverables key.
  A PBI takes the right path under either order, which is why the rule has to be checked
  with a Deliverable on each input rather than once. One board
  has one column list; a board that columned some cards by one vocabulary and some by
  another would not be a board.

  **The key is read directly, and the function that looks right is the wrong one.**
  `stateKeyFor` is how every other board reads the product key, and it **dispatches on the
  item** — the Deliverable key for a `Deliverable`, the test key for a catalog member.
  Reaching for it here would column and move a Deliverable card by the Deliverables
  workflow while it sits in this board's bucket, which is the very thing this extension
  refuses, and would do it while looking like the conventional call. So this board asks
  `settings.stateKey` and never asks the card what it is.

  **The price is named rather than paid quietly.** A vault that configured a separate
  `deliverableStateProperty` has Deliverables carrying no value under that key, so every
  one of them sits in **Open** here — permanently, whatever the Deliverable workflow says.
  That is accepted, not corrected: the escape a vault already has is the shared key, since
  leaving `deliverableStateProperty` unset falls back to `stateKey`, which is the
  arrangement the codebase's own suggestion machinery steers a first-run setup into
  anyway.
- **3g — the same card's FINISHED STYLING is asked for.** It comes from the item's **own**
  workflow, not from the column it sits in — a Deliverable's from the Deliverable workflow,
  a PBI's from the product one — so **no** card's `pbl-done` on this board is decided by
  which bucket holds it, and a card can sit in `Resolved` while not being styled as done.

  Since the revision that is the **ordinary** case rather than an oddity, and it is what
  the rename buys: `Resolved` means the sprint is finished with the item, `done` means the
  product is, and a workflow with `In review` between them makes the two verdicts differ
  on purpose. The column is still `done: true` — it is this board's terminal stage, so it
  takes the finished column styling, the settled-fold default and the no-WIP-limit rule.
  A column's verdict and a card's are different questions.

  The underlying rule is older than this board and is kept where it is decided.
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
- **3j — a card carries a state neither list names.** It lands in **In Progress**, with
  everything else the two lists do not claim, and mints no column of its own. The
  `outsideWorkflow` stray column the product board grows has **no counterpart here**, and
  that is a deletion rather than an omission: with a fixed three, every value has a home
  by construction, so there is nothing for a stray column to rescue. The two extensions
  that stood here — one about a value only a Deliverable carries minting a column, one
  about another iteration's vocabulary leaking in — are answered by there being no
  observed vocabulary on this board at all.
- **3k — the counts, then, are what the population still decides.** Each column's
  `count`, `fullCount`, `held` and `openWork` are measured over **this scope's carriers**,
  never the model: a Sprint 13 card counted on Sprint 12's Open column is the same defect
  a model-wide observed list would have been one level up, and handing the builder the
  population rather than the model retires both at once.
- **3l — an `Iteration` note itself carries an iteration link**, written by hand rather
  than through a menu that refuses to offer it. It is not a card. An iteration is the
  scope a board is chosen by, and the population refuses one rather than trusting the
  menu to have prevented it — a rule the population keeps holds against a note nobody
  edited through the UI.
- **4a — no state property is configured at all.** The scope is still **enterable** and
  the board shows the unconfigured empty state, naming the option to set and where. A
  resolved key is what the COLUMNS need, never what the scope needs: gating scope
  selection on it would make this very guidance unreachable, since the only way to see it
  is to be on the board that has none.

  Since the revision the key in question is the **product** `stateProperty`, so this state
  and the product board's own are one condition seen from two screens rather than two
  conditions to configure. A vault with a working product board can never reach it here.
- **4b — neither `iterationOpenStates` nor `iterationResolvedStates` is set.** The board
  still draws three working columns: Open holds the state-less cards alone, Resolved holds
  the product done values, and In Progress holds the rest. **That is what replaces the
  field-by-field fallback** the withdrawn workflow needed. A fallback exists to reconcile
  two sources of truth; one source needs none, and the defaults are a reading of the
  product workflow rather than a borrowing from it.

  What a list DOES do when set is claim states for its bucket, and nothing else — there is
  no all-or-nothing, no key to share, and no direction for the two to disagree in.
- **4c — a state is named in both lists.** It counts as **Resolved**: the rightmost bucket
  wins. Stated once and implemented once, because a value read by two membership tests is
  a value two call sites will eventually disagree about. The product's own done values are
  folded into Resolved by the same rule — an item the product calls finished can never be
  drawn as still in progress — which also spares every user from restating their done
  values in a second list.
- **4d — a state named in a list is carried by no card in this iteration.** Its column
  still draws, empty. The three are structural, not observed: a stage of the workflow with
  nothing in it is a stage with nothing in it, which is exactly what the product board's
  own empty columns already say.
- **4e — a bucket has no state to write.** It **takes no drop**: the column draws, it
  holds whatever reads into it, and it offers no `Set state` entry and refuses a drag and
  an Alt+arrow. A column that accepted a drop it could not express would write nothing and
  announce a move, which is worse than one that declines.

  Four configurations produce it, and one rule covers all four rather than four guards
  written where each was noticed: `iterationOpenStates` unset; every one of its entries
  claimed by Resolved (4g); every declared state claimed by the two lists, so In Progress
  has none; and `iterationResolvedStates` unset with no done values either. The bucket's
  write target is a **lookup**, and a lookup can come back empty.
- **4f — Open has no usable state, and a card is dropped on it.** Its state key is
  **removed**. That is not an exception to 4e but the leading column's own long-standing
  semantics: Open is the bucket that holds the state-less cards, so "put this card in
  Open" already means something exact without any list being set, and the removal lands
  the card in Open by the **reading** rather than by a lookup. In Progress and Resolved
  have no such natural reading, which is why they decline instead.
- **4g — the first state in `iterationOpenStates` is also a done value, or is named in
  `iterationResolvedStates`.** It is **not** Open's representative. 4c routes it to
  Resolved, so writing it on a drop would land the card in a column it was not dropped on
  — visibly worse than either a refusal or a no-op, because the board would appear to
  disobey the gesture.

  The fix is a rule and not a guard, because the guard would be on the one cell someone
  noticed: **a bucket's representative is the first state the bucket rule itself places in
  that bucket.** Asked of the reading, never of the list. Only Open can break it today —
  a state in no list *is* In Progress, and anything in `iterationResolvedStates` or the
  done values *is* Resolved, whatever else names it — but a lookup and a reading that
  disagree is the drift the checkmark rule exists to prevent, and the next configuration
  to expose it is the one nobody thought of. With no entry surviving the test, Open falls
  to 4f and the other two to 4e.
- **5a — the move takes the card out of this scope**, because the base's filter names the
  state property. The card leaves in silence, as it already does on every other board:
  nothing correlates a Bases pass with a write, so no outcome report is attempted here
  either. The open question is recorded, not reopened.
- **5c — a new item is created from this board's toolbar or a card's child menu.** It is
  created **into this iteration**: the scope's link is written in the same create as the
  type and the parent — and since the revision, so are the iteration's two dates
  ([[An iteration's timeframe schedules its items]] extension 5a) — never as a second write
  afterwards. Otherwise the new card is
  missing this board's own property and vanishes on the next refresh — the same failure
  the offered-types rule prevents, arriving through the other door. The precedent is the
  horizon's: a note created from a bucket claims that bucket in the SAME write, so it is
  never momentarily a note sitting somewhere its own frontmatter does not name. With the
  iteration property unconfigured nothing is written, as everywhere else. Creation stays
  outside the undo history, since undo never deletes a note.
- **5d — a card is dropped on, moved into, or Set-state'd to the bucket it is already
  in.** **Nothing is written.** Three product states can map to one column, so "the card is
  already here" and "the write is a no-op" stop being the same sentence, and the board has
  to ask the first.

  It cannot be got for free from the planner this board otherwise reuses.
  `computeStateWrites` asks `sameValue(item.stateValue, state)` — the **exact** state — so
  a card in `Ready` dropped on an Open bucket whose first value is `Todo` reads as a change
  and is rewritten, restating the user's own state and spending the undo slot to do it.
  The announcement has the same gap from the same cause: `columnLabelFor` is handed
  `Ready` and a bucket carrying only `Todo` does not answer to it, so a correct move would
  be announced from a column the board does not name.

  One missing question — **which bucket holds this state** — asked twice, so this board
  keeps a host move method of its own after all. Not for a second key, which it does not
  have, but because a bucket is not a state. It holds for the drag, the keyboard and the
  menu alike, since all three land on that one method
  ([[Keyboard and menu moves]]).
- **5b — "Show completed items" is off.** It does not reach this board, and that is one
  field rather than a per-caller choice: `hideCompleted` is false in this projection's
  `VisibilityRule`, exactly as it is for the Deliverables board. The toggle describes the
  **requirements** rollup (`item.subtreeDone`) — a verdict about a whole subtree — while
  this board draws individual cards in a `Resolved` column, so letting it through would
  empty the column that exists to show them. A card whose product state reads as done
  therefore still renders here, and the control is absent from the toolbar rather than
  present and inert.

  The revision makes this cheaper to state, not harder. The board and the toggle now read
  the same key, and they still ask different questions of it: one about a card, one about
  everything under a card.

  The rule is set in the one predicate rather than at the call sites for the reason that
  predicate's own comment records: it was a per-caller choice for three surfaces and the
  fourth forgot, emptying a card's child disclosure from a setting flipped on another
  projection.
- **6a — the chosen iteration carries a goal.** One line of it draws above the columns.
  Three refusals keep it from becoming furniture: no goal, no line — never an empty one,
  and never a placeholder inviting a value; on `Product` scope no line at all, since there
  is no iteration to have one; and the line is **text, not a control**, set from the dialog
  in [[Creating an iteration from the board]] and by editing the note, so nothing about
  this board's write surface changes to carry it.

## Acceptance criteria

- In board mode the toolbar offers a scope picker naming `Product` and every `Iteration`
  note **while the iteration property is configured and at least one `Iteration` note is
  in the model**, and does not render it otherwise. Both halves: with no configured
  property nothing can join a scope, so a picker offering scopes would be a control whose
  every entry draws an empty board (1b).
- The scope is enterable with no state key resolved, which is the only way extension 4a's
  guidance can be reached. A resolved key gates the columns, never the scope.
- The scope persists per saved view in the collapse store's vault-scoped localStorage,
  survives a restart on that device, and never touches the `.base`. A stale stored scope
  makes the WHOLE view read as `Product` — cards, count, completed toggle, offered types
  and filter index alike, resolved once rather than at the render — and is retained rather
  than rewritten.
- Renaming the chosen `Iteration` note — or a folder above it — carries the stored scope
  **and that iteration's folded columns** with it, so the board keeps showing the same
  iteration in the same shape.
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
- A `Deliverable` naming the iteration draws a card here and is bucketed by the **product**
  state key, like every other card. Its **finished styling** comes from its own workflow,
  as every card's does in every projection — `createCard` asks `ownWorkflowReading(item)`
  and takes no completion parameter — so no card's `pbl-done` on this board is decided by
  the bucket holding it, and a card may sit in `Resolved` without being styled done.
  Restoring a per-board completion override is explicitly refused: it is the category
  invariant `createCard`'s own comment records removing.
- The quick filter is indexed over the whole tree in an iteration scope, so an inherited
  focus cannot hide a matching card through the filter that the population ignores.
- The toolbar's item count and the completed toggle's "(N hidden)" both describe this
  scope's carriers — one function, so they cannot disagree.
- Every projection-shaped question — filter index, count, completed toggle, offered types,
  membership, **and which toolbar position is pressed** — is answered from the projection
  value in `projection.ts`, so a new one cannot be added without the compiler asking for
  it.
- Choosing a scope leaves the picker on screen and the `Board` position pressed, checked
  by picking one and inspecting the rebuilt toolbar.
- Leaving `Board` and returning restores the iteration that was showing, and the stored
  mode and scope cannot describe different boards.
- An item created from this board carries the iteration it was created on **and that
  iteration's two dates**, written in the same create as its type and parent — the link
  spelled from the NEW note's own path, so two iterations sharing a basename still get
  distinct links — and so it appears as a card immediately rather than vanishing on
  refresh.
- Column folding is scoped to this board: folding a column here folds it nowhere else.
- Clearing the iteration property falls back to the product board and retains the stored
  scope.
- `Set type` and the creation menus offer exactly what this board can show: `Deliverable`
  **yes**, because it draws them; `Iteration` **no**, because it never draws one. Offering
  a type the board cannot show lets a reader create an item and watch it vanish from the
  board it was created on, which is the same defect as withholding one it does show.
- With cards present but no state property configured at all, the board shows the
  unconfigured guidance rather than putting every card in the Open column.
- Every column's `count`, `fullCount`, `held` and `openWork` are measured over **this
  scope's carriers**, so a card in another iteration is never counted here.
- No `Iteration` note is ever a card on an iteration board, whatever its own frontmatter
  says.
- The columns are exactly three — **Open**, **In Progress**, **Resolved** — over the
  resolved **product** state key. `iterationOpenStates` and `iterationResolvedStates` name
  which product states fall in the outer two; every other state, and only those, land in
  In Progress. Checked by asserting that every value in `stateValues` plus the no-state
  case lands in exactly one bucket, so a state cannot be dropped or double-counted by a
  rule written for the buckets one at a time.
- Both lists may be empty and the board still reads correctly: Open holds the state-less
  cards, Resolved holds the product done values. A state named in both lists counts as
  Resolved, and every product done value counts as Resolved whether or not the list names
  it.
- The `Resolved` column is `done: true` — the finished column styling, the settled-fold
  default, no WIP limit — while the cards in it keep their own workflow's `pbl-done`. Both
  halves checked, because they look like a contradiction and are the point of the name.
- No stray `outsideWorkflow` column is ever drawn on this board.
- A move — drag, Alt+arrow or menu — writes the **product** state key through the same
  gate and is taken back by the one undo slot, writing the first state in the bucket it
  lands on; and a move onto the bucket the card is already in writes **nothing**, checked
  on all three inputs.
- Each bucket's representative is the first state **the bucket rule itself places in that
  bucket** — checked with an `iterationOpenStates` whose first entry is also a done value,
  asserting the drop does not write it and the card does not land in Resolved.
- A bucket with no state to write takes no drop, offers no `Set state` entry and refuses
  the keyboard — checked in all four configurations that produce one. The single exception
  is Open, where a drop **removes** the key.
- A context row is never a card, a write target or a count.
- An iteration holding no items says so in its own words, not the product board's.
- The chosen iteration's goal draws as one line above the columns when it has one, and
  nothing draws when it has none or when the scope is `Product`.

## Where it lives

The three buckets are built in `src/domain/board.ts` beside `requirementsWorkflow` and
`deliverablesWorkflow`, and deliberately **not** as a third `Workflow` instance: that
interface exists to say which property a board reads and what its vocabulary is, and this
board answers neither question for itself — it reads the product key through the resolver
`src/domain/settings.ts` already exposes. The two list options are declared in
`src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`. The population
is derived in `src/domain/model.ts`. The scope is a `prefs` value beside `axis` in the
per-view entry of `src/storage/viewStateStore.ts`, and it is a **PATH**.

That sentence said the opposite until 2026-08-16 — *"a name rather than a path, so neither
the prune nor the rename touches it"* — and contradicted extension 2e three screens above
it, which argues at length that the scope follows a rename and calls this the first UI
state whose value is a path. A basename cannot be the value: two iterations sharing one is
the case 1e makes the picker qualify labels for, and storing the name would reunite what
the picker went to trouble to keep apart.

So the path is the value, and it costs two things that a `prefs` field does not normally
cost. `ViewPrefs`' own comment — *"keyed by nothing the vault owns, so never pruned and
never renamed"* — stops being true of the whole shape and must be amended to name this
field as the exception. And the rename walk has to reach `prefs`, matching the path or its
`oldPath/` prefix so a folder rename counts. Half that price is not an option: without the
migration the stored path goes stale on a rename and drops the reader to `Product`, which
is a choice silently undone — the opposite of what 2a's "retained, not rewritten" rule
exists to protect. The entry is restored and debounce-saved by
`src/view/viewState.ts`, read and written through `src/view/viewStateController.ts` and declared
on the host in `src/view/host.ts`. The picker is a `board` case in `renderProjectionZone`
in `src/view/render/toolbarControls.ts`, built the way `renderAxisPicker` beside it is;
the board itself is `src/view/render/board.ts` under the fork in
`src/view/render/projections.ts`, with its empty states in
`src/view/render/emptyStates.ts`, and the goal line drawn from the chosen iteration's
item. Moves reach one host method of this board's own in `src/view/cardMoves.ts` from
`src/view/interactions/cardDrag.ts`, `src/view/interactions/keyboard.ts` and
`src/view/interactions/menu.ts` — it asks `src/domain/board.ts`' bucket question, returns
having written nothing when the card is already there, and otherwise delegates to the
product board's own move, which plans through `src/domain/writePlan.ts` and applies
through `src/storage/frontmatter.ts` and `src/view/writeGate.ts`. The announcement in
`src/view/interactions/cardDrag.ts` asks the same bucket question rather than matching a
column by its exact state. Driven in `test/view/board.test.ts` and
`test/view/contextCardWrites.test.ts`, with the store round-trip in
`test/storage/viewStateStore.test.ts`.
