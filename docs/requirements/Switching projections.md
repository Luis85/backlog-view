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

A toolbar toggle switches the view between backlog and board. The mode is a persisted
view option the way the focus level already is: set from the toolbar, stored in the
`.base` per saved view, absent from the options menu because it lives where its effect
is.

The precedent is uniform: Linear toggles list and board on the same view and keeps the
choice per view, GitHub Projects and Notion make layout a property of each saved view,
and no surveyed tool treats layout as transient state. Persisting per view also means
one base can keep a saved backlog view beside a saved board view of the same notes.

## Acceptance criteria

- The toggle persists in the `.base` per saved view and survives a restart; nothing
  else about the mode is stored anywhere.
- Switching is a render decision: same model, same results, same undo slot, no
  re-query. The quick filter carries over.
- With no state property configured, board mode shows guidance instead of a board —
  never a blank pane.
- Bases grouping stays ignored in both modes, and the toolbar note says so: the
  hierarchy is the tree's grouping and the workflow is the board's.
