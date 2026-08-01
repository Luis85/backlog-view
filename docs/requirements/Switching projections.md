---
type: PBI
parent: "[[Backlog and board]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/view/backlogView.ts
  - src/view/render/toolbar.ts
---

# Switching projections

**As** someone working a backlog, **I want** to flip the same view between a tree and a
board, **so that** I can ask "what exists, under what" and "where is everything in the
flow" of one set of notes without maintaining two of anything.

A toolbar toggle switches the view between backlog and board. The mode is a persisted
view option the way the focus level already is: set from the toolbar, stored in the
`.base` per saved view, absent from the options menu because it lives where its effect
is.

The precedent is uniform: Linear toggles list and board on the same view and keeps the
choice per view, GitHub Projects and Notion make layout a property of each saved view,
and no surveyed tool treats layout as transient state. Persisting per view also means
one base can keep a saved backlog view beside a saved board view of the same notes.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking the projection toggle in the toolbar |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Switching is a render decision: no query is re-run, nothing is written to a note, and neither projection can hold items the other does not. |

**Main flow**

1. The user clicks the toggle.
2. The view stores the new mode as a view option — the same mechanism the focus level
   uses — and re-renders.
3. The board renders from the model already in hand: same results, same undo slot, same
   quick filter, no re-query.
4. The choice survives a restart, and belongs to that saved view alone.

**Extensions**

- **1a — no state property is configured.** Board mode shows guidance naming the option
  to set and where, never a blank pane. A board is the projection of a workflow, and
  without a state property there is no workflow to project.
- **2a — the base holds a second saved view.** The mode is stored per saved view, so one
  base can carry a backlog view beside a board view over the same notes. That is why it
  is not stored per base.
- **3a — a quick filter is active.** It carries over rather than clearing: the filter is
  session state in both projections, and dropping it on a switch would make the toggle
  destructive.
- **3b — the Base declares a grouping.** It stays ignored, as it already is in the tree,
  and the toolbar says so: the hierarchy is the tree's grouping and the workflow is the
  board's. Honouring it would give the view a third source of structure.

## Acceptance criteria

- The toggle persists in the `.base` per saved view and survives a restart; nothing
  else about the mode is stored anywhere.
- Switching is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- With no state property configured, board mode shows guidance instead of a board —
  never a blank pane.
- Bases grouping stays ignored in both modes, and the toolbar note says so: the
  hierarchy is the tree's grouping and the workflow is the board's.

## Where it lives

**Nothing yet — this note is design.** The mode will be one more option in
`src/domain/settings.ts` and its schema entry, toggled from `src/view/render/toolbar.ts`
and read by `src/view/backlogView.ts` at render time, beside the focus level it copies.
