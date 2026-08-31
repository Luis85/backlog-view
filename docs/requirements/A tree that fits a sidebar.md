---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 30
status: Open
created: 2026-08-31
source: user request, 2026-08-31
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# A tree that fits a sidebar

**As** a contributor looking at my own work in this view, **I want** to set a row's state
from its own context menu, through the same gate and the same context-row refusals every
other projection's Set state goes through, **so that** the sidebar is a place to work
rather than only a place to look — without becoming a second editing surface for
everything else a note carries.

## Use case

| | |
| --- | --- |
| **Actor** | A contributor with a person picked in the my-work view |
| **Trigger** | A right-click (or the keyboard's Menu key) on a row in that person's tree |
| **Preconditions** | A person is picked; the view has a model |
| **Guarantee** | Every row offers Open and Open in a new tab. A MEMBER row (never a context row) whose own workflow's state key is bound also offers Set state, dispatched by that row's own type — the requirements, Deliverable or test workflow, exactly as the backlog view's identical menu dispatches — with a submenu naming that workflow's declared-or-observed vocabulary. Each entry is checked exactly when picking it would write nothing, asked of the same planner the pick itself runs. Picking an entry plans through that planner and applies through the view's own `WriteGate`: refused whole if any write in the batch targets a note the base excluded, refused entirely while `configProblems` reports anything, and otherwise applied with the same started/finished stamps a backlog-view write would carry. |

**Main flow**

1. The reader opens a row's context menu.
2. The view builds it fresh: Open, Open in a new tab, and — on a member row whose own
   workflow's key is bound — Set state.
3. Set state opens a submenu of that workflow's states, the current one checked.
4. The reader picks a state.
5. The pick is planned by that workflow's own function (`computeStateWrites` for the
   requirements workflow, with the started/finished stamps; `computeDeliverableStateWrites`
   or `computeTestStateWrites` for the other two, with none) and applied through
   `view.gate.applySafely`.
6. The batch lands, the model rebuilds, and the row's chip reflects the new state.

**Extensions**

- **2a — the row is a context ancestor.** Set state is never offered: a context row
  renders, it parents, and that is all. Opening it still offers Open and Open in a new
  tab — reading a note is not a write.
- **2b — the row's own workflow has no state key bound.** Set state is withheld,
  asked of that ROW's own effective key (`stateKeyFor`), never of the view's single
  `stateKey` — a Deliverable with its own configured state property still gets a menu
  when the requirements property is the one left unbound.
- **5a — the batch names an excluded note.** `applySafely` refuses the whole batch,
  loudly, rather than applying the rest and dropping the one write that could not land —
  the same refusal every other projection's writes go through. This surface's own menu
  can never construct such a batch (extension 2a withholds the control), so the case is
  reachable only by a caller that builds a batch directly, the way a drag or a keyboard
  move could reach it on another projection.
- **5b — `configProblems` reports something.** The gate refuses before anything is
  touched, with a notice naming the first problem, exactly as every other write path in
  this plugin does.
- **5c — the pick is the state the row already holds.** The plan is empty, nothing is
  applied, and the entry was already drawn checked — there is nothing for the batch to
  do and no undo slot is spent.

## Acceptance criteria

- `showMyWorkRowMenu(view, row, evt)` always offers Open and Open in a new tab.
- Set state is offered exactly when `!row.context && stateKeyFor(view.planSettings,
  row.item) !== ''` — never on `view.settings.stateKey` alone, and never on a context row
  regardless of that key.
- Set state's vocabulary and its planner both dispatch on the row's own workflow — a
  Deliverable reads and writes `deliverableStateKey`/`computeDeliverableStateWrites`, a
  test-catalog member reads and writes `testStateKey`/`computeTestStateWrites`, and
  everything else reads and writes the requirements workflow, stamps included.
- Every entry's checkmark is asked of that workflow's own planner — an entry is checked
  exactly when picking it would write nothing — never of a value comparison written
  beside it.
- A batch this menu builds, replayed directly against `view.gate.applySafely` with an
  `outsideFilter` note named in it, is refused whole: neither note in the batch is
  written.
- A batch is refused whole while `configProblems(view.planSettings)` is non-empty.
- The my-work options bag (`domain/myWorkOptions.ts`) offers a declared state vocabulary
  for all three workflows — `stateValues`, `deliverableStateValues`, `testStateValues` —
  each resolved through the identical reader the backlog view's own options use, so the
  Set state menu can offer a value no row currently carries.
- A my-work configuration that declares only the requirements vocabulary, with neither
  secondary workflow configured, never trips `secondaryWorkflowProblem` — the
  copy-fallback rule `resolveSecondaryWorkflow` already gives every secondary workflow
  (an unbound one copies the requirements list rather than staying empty) keeps that
  guard unreachable for any configuration this view's own options screen can produce.

## Where it lives

`src/view/mywork/rowMenu.ts` — `showMyWorkRowMenu`, the whole of this surface's one
write: the context-row guard, the per-row workflow dispatch (vocabulary and planner
alike), and the checkmark asked of the plan. Reads `stateKeyFor`/`ownWorkflowReading`/
`deliverablesWorkflow` from `src/domain/board.ts`, `computeStateWrites`/
`computeDeliverableStateWrites`/`computeTestStateWrites` from `src/domain/writePlan.ts`,
`stateMenuValues`/`menuValues` from `src/domain/settings.ts`, `rowVocabulary` from
`src/view/projection.ts`, and `showMenuForClick` from `src/view/interactions/menu.ts`.

`src/view/mywork/renderTree.ts` — wires one delegated `contextmenu` listener on the
tree, the release scope's own `wireScopeCreate` shape: resolve the row from the event's
target against the draw's own `rowEls` index, then build the menu through
`showMyWorkRowMenu`.

`src/view/mywork/toolbar.ts`, `src/view/scopeFolds.ts` and `src/view/scopeKeys.ts` carry
no change for this task; they are named here because they are this view's other
`view/mywork/` neighbours and this note is where the narrow-pane behaviour and the one
write both live, per the epic's own file table. `styles/mywork.css` carries whatever
this surface needs beyond the menu's own default chrome — today, nothing new: a context
menu is Obsidian's own widget.

`src/domain/myWorkOptions.ts` — the three added vocabulary options (`stateValues`,
`deliverableStateValues`, `testStateValues`) and the three `MyWorkSettings` fields they
resolve into (`states`, `deliverableStates`, `testStates`), over the identical option
keys and the identical `resolveSecondaryWorkflow` reader `viewOptions.ts` and
`resolveSettings` already use for the backlog view.
