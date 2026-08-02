---
type: PBI
parent: "[[A third projection]]"
order: 10
status: Done
priority: P1
created: 2026-08-01
files:
  - src/storage/collapseStore.ts
  - src/view/backlogView.ts
  - src/view/render/toolbar.ts
---

# Three projections, one toggle

**As** someone working a backlog, **I want** the projection toggle to offer the roadmap
beside the tree and the board, **so that** "what exists", "where is it in the flow" and
"what comes next" are three readings of one set of notes rather than three tools.

The mode is the persisted choice [[Switching projections]] specifies, one value wider,
and everything that PBI guarantees holds unchanged: set from the toolbar, working
position rather than configuration — the collapse store's vault-scoped localStorage,
per saved view, per device, never the `.base` — and a render decision that re-runs no
query and writes no note. The precedent is the same one: GitHub Projects and Linear
treat table, board and roadmap as layouts of one saved view, and no surveyed tool makes
the third layout a separate product.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing the roadmap from the projection toggle in the toolbar |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Switching is a render decision: no query is re-run, nothing is written to any note or to the `.base`, and no projection can hold items another does not. |

**Main flow**

1. The user picks the roadmap from the toggle, which now names three projections.
2. The view stores the new mode — the same per-view collapse-store entry the board
   uses, one value wider — and re-renders.
3. The roadmap renders from the model already in hand: same results, same undo slot,
   same quick filter, no re-query.
4. The choice survives a restart on this device, and belongs to that saved view alone.

**Extensions**

- **2a — the entry was saved before the roadmap existed.** A stored board or tree
  choice keeps its meaning, and an unrecognized value falls back to the tree — stored
  state is user data, dropped rather than guessed at, and nothing rewrites it until
  the user chooses.
- **2b — the base holds several saved views.** The store keys by base plus view name,
  so one base can keep a backlog view, a board view and a roadmap view over the same
  notes side by side — the reason the mode is per saved view, not per base.
- **3a — no axis is configured.** Roadmap mode shows guidance naming the options to set
  and where ([[Roadmap empty states]]), never a blank pane — the board's own rule about a
  workflow that does not exist, applied to an axis that does not exist.
- **3b — a quick filter is active.** It carries over rather than clearing: the filter is
  session state in all three projections, and dropping it on a switch would make the
  toggle destructive.

## Acceptance criteria

- The toggle offers all three projections; the mode persists per saved view in the
  collapse store and survives a restart on this device; an absent or unrecognized
  stored value renders the tree and rewrites nothing.
- Switching is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- With no horizon or date property configured, roadmap mode shows guidance instead of a
  roadmap — never a blank pane.
- One base can hold saved backlog, board and roadmap views over the same notes.

## Where it lives

The mode is the collapse-store entry's `mode` field grown a roadmap value
(`src/storage/collapseStore.ts`), restored and debounce-saved by
`src/view/collapseState.ts` with the collapse sets it lives beside. The toggle is a
three-position group (`renderModeToggle` in `src/view/render/toolbar.ts`) driving
`setProjection`; `src/view/backlogView.ts` dispatches the keyboard on the projection
it reads and applies the content fork in `src/view/render/projections.ts` — which
projection draws the pane, and what the pane claims to be while it does. Driven in
`test/view/roadmap.test.ts`, the store round-trip in
`test/storage/collapseStore.test.ts`.
