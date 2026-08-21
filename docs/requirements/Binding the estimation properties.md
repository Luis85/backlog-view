---
type: PBI
parent: "[[The scoring model is configuration]]"
order: 20
status: Open
created: 2026-08-17
source: written after the first increment shipped, to describe what was built
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Binding the estimation properties

**As** someone opening the estimation view on a vault that has never used it, **I want**
one action that names every property the model needs and puts them on the notes, **so
that** I can start scoring instead of typing thirteen property names into an options
menu.

Obsidian's picker offers the properties a vault *has*, so a property no note carries
cannot be picked, and a property nothing names cannot be written to a note. Neither half
works alone, so the guided empty state does both in one gated batch — the backlog view's
✨ ([[Backfill missing properties]]), narrowed to this view's own key list and its own
gate.

The same two halves are what a *configured* view needs when it gains a dimension, and that
is the same action rather than a second one: the new dimension's key is bound to nothing,
which the model reports as a problem, and a key no note carries cannot be picked out of
that problem by hand. So the action is offered wherever the view cannot score — the guided
empty state, the toolbar, and the config warning.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Pressing the setup action — on the guided empty state, the toolbar, or the config warning |
| **Preconditions** | The view cannot score yet — the model binds nothing, or binds something and reports a problem |
| **Guarantee** | Either every suggested key is bound *and* stubbed onto the results, or nothing is changed at all. A run that would leave the model broken changes neither the configuration nor a note. |

**Main flow**

1. The view is unconfigured, so it draws the guided empty state rather than a table.
2. The user presses the setup action.
3. The action resolves the model the bindings *would* produce, without setting any of
   them, and runs the same `modelProblems` gate the options menu runs.
4. Every suggested key nobody has touched is bound: the eight dimensions, confidence,
   effort, complexity, the business value and its model stamp.
5. The bound keys are stubbed onto every result, as one gated batch.
6. The table draws, and `canUndo` follows the batch — undoing removes the stubs, keys
   deleted rather than blanked.

**Extensions**

- **1a — the view is configured but cannot score.** A dimension added since setup binds
  no property, so the view draws the config warning rather than the guided empty state or
  the table. The action is on that block too, and it is the same action: the warning names
  the unbound dimension, pressing it binds and backfills that dimension's key, and the
  table draws. Without it that state is a dead end — the toolbar carrying the action is
  exactly what a model problem replaces, and the picker cannot offer a property no note
  carries.
- **2a — the action is a real button.** It is Tab-reachable and pressed like any other,
  never a click handler on a div. The guided empty state is often the first thing a
  keyboard user meets in this view. The config warning's own button is the same button on
  the same terms, sharing the class that takes both quiet while a batch is in flight.
- **3a — the bindings would leave the model broken.** Nothing is bound and nothing is
  written, and the view says why. An action that changed the configuration and then had
  every write refused would leave the view worse than it found it.
- **4a — a key is already bound.** It is left alone. Pressing the action a second time
  binds nothing, which is what makes it safe to press when you are not sure.
- **5a — a note already holds a value under a bound key.** It is left alone. The stub is
  for a note with nothing there, and it is an empty stub rather than a score: the guided
  setup asserts no answer on anybody's behalf.
- **5b — the base returned no results.** The keys are bound and there is nothing to stub.
  The view moves to its own no-results state rather than reporting a failure.
- **5c — a note the base excluded.** It is never written to. This view's gate answers
  `outsideFilter` from the built model itself, which holds one item per *result*, so a
  path that is not a result is refused with the whole batch. There is no context row in
  this model to make an exception for.

## Acceptance criteria

- One press binds all thirteen suggested keys and stubs them onto every result, leaving
  an existing value alone, and lands in the table.
- A second press binds nothing.
- It is one gated batch: `canUndo` follows it, and undo removes the stubs by deleting the
  keys rather than blanking them.
- A run whose bindings would leave the model broken binds nothing, writes nothing, and
  names the problem.
- A configured view whose model reports a problem still offers the action, and a run from
  there that binds the missing key clears the warning and lands in the table.
- The action is a real, Tab-reachable button.
- **Not met yet** — no check drives this batch at a path the base excluded. The refusal
  is implemented (`EstimationView`'s `outsideFilter`) and untested, so the category
  invariant the backlog view holds in `test/view/contextRowWrites.test.ts` has no
  counterpart here.

## Where it lives

`src/view/estimation/estimationView.ts` (`renderUnconfigured` and `renderProblems` — the
two states that draw the action themselves, which is why neither draws a toolbar) ·
`src/view/estimation/toolbar.ts` (`renderEstimationToolbar`, `syncEstimationToolbar` — the
third surface, and the one query that takes all three quiet mid-batch) ·
`src/view/estimation/init.ts` (`runEstimationInit`, and `withPending` — the model the
bindings would produce, resolved before any of them is set, so the gate runs before the
configuration is touched) · `src/domain/optionalProperties.ts` (`adoptCandidates`,
`notePropertyId` — reused rather than copied, over this view's own key list) ·
`src/domain/defaultModel.ts` (`SUGGESTED_KEYS`) · `src/domain/scoringModel.ts`
(`boundKeys`, the same list `estimationItems.ts` computes as `ownKeys` — one function
rather than two, which `npm run analyze` caught the day the second was written) ·
`src/storage/propertyWrite.ts` (`applyPropertyWrites`, the plain key/value batch inside
one `processFrontMatter` call per note) · `src/view/writeGate.ts` (the gate the batch
rides, plugin-wide since ADR 0030).

Tests: `test/view/estimation/init.test.ts`, `test/view/estimation/states.test.ts`.
