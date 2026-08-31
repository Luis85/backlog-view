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

- **1a — the trigger is the keyboard (ContextMenu, or Shift+F10) rather than a
  right-click.** The tree is one tab stop and a row is reached through
  `aria-activedescendant` (`src/view/CLAUDE.md`), so DOM focus never leaves the tree
  itself — a keyboard-fired `contextmenu` event would target the tree, not the row, and
  a listener that read the event's target would always miss. The menu is instead
  resolved from `view.activeRowFile` (written by the shared roving keyboard on every
  move, `view/scopeKeys.ts`) and anchored at that row's own element with
  `showMenuAtElement` — the same split `view/release/scopeCreate.ts`'s own two listeners
  keep, over the identical reason.
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

**No Clear state entry, and no undo control, on this view — both deliberate, and named
here rather than left implied.** There is no way to remove a state once set (only to set
a different one), and nothing in `view/mywork/` wires `undoLast`: each view owns its own
`WriteGate`, so a batch this menu applies could not be taken back from the backlog
view's own undo button even if one were drawn here. A note that carried an unconfigured
value (one absent from the declared vocabulary) before this menu touched it — the
`Blocked` example the vocabulary widening above exists for — cannot be put back to that
value from this surface either: `addStateEntries` (`rowMenu.ts`) appends only the item's
own CURRENT value to the offered list, not every value the vault might have held before.
**The recovery path for all three is the same one every other unconfigured control on
this view already relies on: open the note and edit its frontmatter directly** — Open
and Open in a new tab are offered on every row for exactly this reason, context rows
included. Both omissions are the scope this task and its plan are explicit about
(anything wider is its own PBI), not a gap nobody noticed.

## Acceptance criteria

- `showMyWorkRowMenu(view, row, evt)` (pointer) and `showMyWorkRowMenuAt(view, row, el)`
  (keyboard) build and show the IDENTICAL menu — the same `buildRowMenu`, shown at the
  click for one and anchored at the row's own element for the other — so the two inputs
  can never drift into offering different actions.
- The keyboard (ContextMenu, or Shift+F10) opens the same menu as a right-click, resolved
  from `view.activeRowFile` rather than the event's target — the tree is one tab stop, so
  a keyboard-fired `contextmenu` targets the tree itself, never a row.
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

`src/view/mywork/rowMenu.ts` — `buildRowMenu` (private), the whole of this surface's one
write: the context-row guard, the per-row workflow dispatch (vocabulary and planner
alike), and the checkmark asked of the plan. `showMyWorkRowMenu(view, row, evt)` shows it
at a pointer click (`showMenuForClick`); `showMyWorkRowMenuAt(view, row, el)` shows the
IDENTICAL menu anchored at a row element (`showMenuAtElement`) for the keyboard path —
one builder, two entry points, so neither input can offer an action the other does not.
Reads `stateKeyFor`/`ownWorkflowReading`/`deliverablesWorkflow` from
`src/domain/board.ts`, `computeStateWrites`/`computeDeliverableStateWrites`/
`computeTestStateWrites` from `src/domain/writePlan.ts`, `stateMenuValues`/`menuValues`
from `src/domain/settings.ts`, `rowVocabulary` from `src/view/projection.ts`, and
`showMenuForClick`/`showMenuAtElement` from `src/view/interactions/menu.ts`.

`src/view/mywork/renderTree.ts` — wires TWO delegated listeners on the tree, the release
scope's own `wireScopeCreate` shape (`src/view/release/scopeCreate.ts:51-91`): a
`contextmenu` listener resolving the row from the event's target against the draw's own
`rowEls` index, and a `keydown` listener (ContextMenu / Shift+F10) resolving the row from
`view.activeRowFile` — the field the shared roving keyboard (`view/scopeKeys.ts`) writes
on every move — because a keyboard-fired `contextmenu` targets the TREE, never a row,
once focus is managed through `aria-activedescendant` rather than real DOM focus. The
first calls `showMyWorkRowMenu`, the second `showMyWorkRowMenuAt`.

`src/view/mywork/toolbar.ts`, `src/view/scopeFolds.ts` and `src/view/scopeKeys.ts` carry
no change for this task beyond `scopeKeys.ts`'s own pre-existing `activeRowFile` write;
they are named here because they are this view's other `view/mywork/` neighbours and
this note is where the narrow-pane behaviour and the one write both live, per the epic's
own file table. `styles/mywork.css` carries whatever this surface needs beyond the
menu's own default chrome — today, nothing new: a context menu is Obsidian's own widget.

`src/domain/myWorkOptions.ts` — the three added vocabulary options (`stateValues`,
`deliverableStateValues`, `testStateValues`) — Bases can only store a box the options
schema draws, so all three are required regardless of what reads them back — and one new
`MyWorkSettings` field, `states`, resolved the same way `resolveSettings` resolves it
(`dedupe(list('stateValues'))`). `deliverableStates` and `testStates` are NOT fields on
this interface: nothing in `src/` ever read them back off `MyWorkSettings` (the menu
reads `view.planSettings.deliverableStates`/`.testStates` — `BacklogSettings`, resolved
independently by `resolveSettings(this.config)` off the identical option keys) — only
`states` earns a place, and only because `resolveMyWorkSettings`'s own local copy feeds
`resolveSecondaryWorkflow`'s copy-fallback for the other two.
