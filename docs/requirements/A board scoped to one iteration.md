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

It is reached differently from [[A Deliverables board]], on purpose. That board took a
toggle position because its population is a type, so the two boards partition the work
and both stay meaningful forever. Iterations partition nothing — every card here is also
a card on the product board — and their number grows without bound. So `Board` stays one
toggle position and grows a **scope**, the shape [[Horizons or dates]] already uses to
offer the roadmap's two axes from one control.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing an iteration from the board's scope picker |
| **Preconditions** | Board mode is on, at least one `Iteration` note is in the model, and an iteration workflow resolves to some key — its own when `iterationStateProperty` is configured, or (falling back) the product board's `stateKey` when it is not |
| **Guarantee** | One model, one write gate, one undo history, exactly as [[Product Kanban]]'s own guarantee states. Switching scope re-runs no query and writes nothing; a move writes the *resolved* iteration state key alone. |

**Main flow**

1. In board mode the toolbar draws a scope picker beside the projection toggle, naming
   `Product` and every `Iteration` note in the model.
2. Choosing an iteration stores the scope — the same per-view collapse-store entry the
   projection mode and the roadmap axis use, vault-scoped localStorage, per device, never
   the `.base` — and re-renders from the model already in hand.
3. The cards are the results whose iteration link resolves to that note, and no others:
   carriers only, never a descendant that did not say so itself, and never a
   `Deliverable` (3e).
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
- **2b — the base holds several saved views.** The store keys by base plus view name, so
  one base can hold a product board beside an iteration board over the same notes. That
  is why the scope is per saved view rather than per base.
- **2c — a quick filter is active.** It carries over rather than clearing, in every scope
  alike, because dropping it on a switch would make the picker destructive.
- **3a — a card is outside the Base's filter.** The context-row rule holds here exactly
  as on the product board: it renders as a breadcrumb, a lane header or an inert context
  card, and that is all — never a card to drag, never a write target, never counted,
  never a source of this board's column vocabulary.
- **3b — the iteration holds no items.** Every column renders empty and the board says
  **"No items in this iteration yet"** — never the product board's "All N items are done
  and hidden", which cannot tell an empty base from an empty scope. The same distinction
  [[A board scoped to Deliverables]] extension 1b had to draw, met a second time
  ([[Board empty states]]).
- **3c — a focus level is active.** It narrows this board exactly as it narrows the
  product board, and that is a consequence rather than a decision: the cards come from
  the focused results, which is what a focus narrows. This board does **not** copy the
  Deliverables board's immunity, which exists because that board reads the whole
  unfocused tree for a population defined by type.
- **3d — an item's own iteration differs from its parent's.** Its own value decides, and
  the parent's is not consulted. Nothing is inherited down the tree.
- **3e — a `Deliverable` carries the chosen iteration link.** It is **not** a card here,
  exactly as it is not one on the product board, which excludes every `Deliverable` from
  its cards, its count and its stray columns. Two reasons, and the second is the load-
  bearing one. The stated invariant above — every card on an iteration board is also a
  card on the product board, which is the whole argument for a scope rather than a toggle
  position — is false the moment this board admits an item that board refuses. And a
  Deliverable already has a workflow of its own ([[A Deliverables board]]); admitting it
  here would put one note under a *third* column vocabulary and let a move write a third
  state property onto it. A Deliverable is still perfectly free to name an iteration, and
  the value is still read, written and undone like any other — it simply does not draw a
  card on this board, the same way it draws none on the product board. It reaches this
  board only in the one form any excluded item does: as a context row for a visible
  descendant (3a).
- **4a — neither the iteration state property nor the product one is configured.** Only
  then does the board show the unconfigured empty state, naming the option to set and
  where. A workflow is this board's prerequisite here too, and the fallback means an
  unconfigured iteration property alone is not enough to trigger it.
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
- **5b — "Show completed items" is off and a card's iteration state reads as done.** The
  control is not implemented for this board in this increment, following the Deliverables
  board's own deferral for the same reason: answering it needs a rollup over the
  iteration workflow, not the product one.

## Acceptance criteria

- In board mode the toolbar offers a scope picker naming `Product` and every `Iteration`
  note, and does not render it when there is no iteration to choose.
- The scope persists per saved view in the collapse store's vault-scoped localStorage,
  survives a restart on that device, and never touches the `.base`. A stale stored scope
  renders `Product` and is retained rather than rewritten.
- Switching scope is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- Cards are exactly the non-`Deliverable` results whose iteration link resolves to the
  chosen note. No descendant appears by inheritance, no `Deliverable` appears at all, and
  no other result the link names is missing: the column counts sum to that population.
- Every card on an iteration board is also a card on the product board. That is the
  invariant the scope picker rests on, and the `Deliverable` exclusion is what keeps it
  true rather than a claim the population quietly breaks.
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
