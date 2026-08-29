---
type: PBI
parent: "[[Backlog and board]]"
order: 10
status: Done
priority: P1
created: 2026-08-01
files:
  - src/storage/viewStateStore.ts
  - src/view/backlogView.ts
  - src/view/render/toolbar.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-09
risk: ""
assignee: ""
iteration: ""
---

# Switching projections

**As** someone working a backlog, **I want** to flip the same view between a tree and a
board, **so that** I can ask "what exists, under what" and "where is everything in the
flow" of one set of notes without maintaining two of anything.

A toolbar toggle switches the view between backlog and board. The mode is working
position, not configuration — the rule that splits the two: base settings are saved on
the view (the options in the `.base`), UI state in vault-scoped localStorage. So the
choice persists in the view-state store, keyed per saved view and held per device,
and never touches the `.base` (ADR 0011's reasoning, applied again: the `.base` is
shared configuration, and which projection I am looking at is mine).

The precedent is uniform on the granularity: Linear toggles list and board on the same
view and keeps the choice per view, GitHub Projects and Notion make layout a property
of each saved view. The store's key is the base plus the view name, so that per-view
granularity holds here too — what this plugin deliberately gives up is syncing the
choice across devices, which is the price of keeping one person's working position out
of a shared file.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking the projection toggle in the toolbar |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Switching is a render decision: no query is re-run, nothing is written to a note, and neither projection can hold items the other does not. |

**Main flow**

1. The user clicks the toggle.
2. The view stores the new mode in the view-state store — vault-scoped localStorage,
   under the same per-view identity the folds use — and re-renders.
3. The board renders from the model already in hand: same results, same undo slot, same
   quick filter, no re-query.
4. The choice survives a restart on this device, and belongs to that saved view alone.

**Extensions**

- **1a — no state property is configured.** Board mode shows guidance naming the option
  to set and where, never a blank pane. A board is the projection of a workflow, and
  without a state property there is no workflow to project.
- **2a — the base holds a second saved view.** The store keys by base plus view name,
  so one base can carry a backlog view beside a board view over the same notes. That is
  why the mode is keyed per saved view, not per base.
- **2b — the view has no resolvable identity** (an embedded base, or no leaf). The mode
  is session-only, exactly as the collapse state is: falling back to a shared key would
  make two bases inherit each other's projection.
- **3a — a quick filter is active.** It carries over rather than clearing: the filter is
  session state in both projections, and dropping it on a switch would make the toggle
  destructive.
- **3b — the Base declares a grouping.** It stays ignored, as it already is in the tree,
  and the toolbar says so: the hierarchy is the tree's grouping and the workflow is the
  board's. Honouring it would give the view a third source of structure.

## Acceptance criteria

- The toggle persists per saved view in the view-state store's vault-scoped
  localStorage and survives a restart on the same device. Nothing about the mode is
  ever written to the `.base`: base settings are saved on the view, UI state in
  localStorage.
- Switching is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- With no state property configured, board mode shows guidance instead of a board —
  never a blank pane.
- Bases grouping stays ignored in both modes, and the toolbar note says so: the
  hierarchy is the tree's grouping and the workflow is the board's.

## Where it lives

The mode is the `mode` pref of the view-state store's per-view entry
(`src/storage/viewStateStore.ts`), restored and debounce-saved by
`src/view/viewState.ts` with the collapse sets it lives beside — so base renames
and view renames migrate it for free. The toolbar toggle (`renderModeToggle` in
`src/view/render/toolbar.ts` — three positions since the roadmap joined,
[[Three projections, one toggle]]) sets it through `setProjection` on the host, which
`src/view/viewStateController.ts`'s `ViewStateController` implements — the read/write against the
view-state store plus the render-depth choice, the same shape for the seven sibling
accessors it also holds (the roadmap-axis pick, focus, the shelf's own
collapse/sort/type-filter, and the dated axis's zoom, density and lead width; each is
UI state by the same rule this PBI states). `src/view/backlogView.ts` still declares
every one of them on `BacklogViewHost` and forwards to the controller in one line, and
dispatches the render on the projection, swapping the scroller between tree and
listbox roles over the same model, undo slot and filter state. Driven in
`test/view/board.test.ts` (the store round-trip in
`test/storage/viewStateStore.test.ts`).
