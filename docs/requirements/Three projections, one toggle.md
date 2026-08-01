---
type: PBI
parent: "[[A third projection]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/view/backlogView.ts
  - src/view/render/toolbar.ts
---

# Three projections, one toggle

**As** someone working a backlog, **I want** the projection toggle to offer the roadmap
beside the tree and the board, **so that** "what exists", "where is it in the flow" and
"what comes next" are three readings of one set of notes rather than three tools.

The mode is the persisted view option [[Switching projections]] specifies, one value
wider, and everything that PBI guarantees holds unchanged: set from the toolbar, stored
in the `.base` per saved view, a render decision that re-runs no query and writes no
note. The precedent is the same one: GitHub Projects and Linear treat table, board and
roadmap as layouts of one saved view, and no surveyed tool makes the third layout a
separate product.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing the roadmap from the projection toggle in the toolbar |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Switching is a render decision: no query is re-run, nothing is written to any note, and no projection can hold items another does not. |

**Main flow**

1. The user picks the roadmap from the toggle, which now names three projections.
2. The view stores the new mode — the same persisted option, one value wider — and
   re-renders.
3. The roadmap renders from the model already in hand: same results, same undo slot,
   same quick filter, no re-query.
4. The choice survives a restart, and belongs to that saved view alone.

**Extensions**

- **2a — the `.base` was saved before the roadmap existed.** A stored two-projection value
  keeps its meaning, and an absent or unrecognized one falls back to the tree; nothing
  rewrites the file until the user chooses. A persisted key is user data, and upgrading
  the plugin must not edit it.
- **2b — the base holds several saved views.** The mode is per saved view, so one base can
  keep a backlog view, a board view and a roadmap view over the same notes side by side —
  the reason it is not stored per base.
- **3a — no axis is configured.** Roadmap mode shows guidance naming the options to set
  and where ([[Roadmap empty states]]), never a blank pane — the board's own rule about a
  workflow that does not exist, applied to an axis that does not exist.
- **3b — a quick filter is active.** It carries over rather than clearing: the filter is
  session state in all three projections, and dropping it on a switch would make the
  toggle destructive.

## Acceptance criteria

- The toggle offers all three projections; the mode persists in the `.base` per saved
  view and survives a restart; an absent or unrecognized stored value renders the tree
  and rewrites nothing.
- Switching is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- With no horizon or date property configured, roadmap mode shows guidance instead of a
  roadmap — never a blank pane.
- One base can hold saved backlog, board and roadmap views over the same notes.

## Where it lives

**Nothing yet — this note is design.** The mode is the option [[Switching projections]]
already places in `src/domain/settings.ts`, widened by one value; the control is the
toggle in `src/view/render/toolbar.ts`; the render fork is `src/view/backlogView.ts`
choosing what to draw from the mode it reads, beside the fork the board adds.
