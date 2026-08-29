---
type: Epic
order: -10
status: Active
area: product
started: ""
finished: ""
risk: ""
start: ""
due: ""
horizon: ""
priority: ""
iteration: ""
assignee: "[[Sabrina]]"
release: "[[Eratic Skunk]]"
---

# Product Backlog

A drag-and-drop work-item tree over ordinary Obsidian notes, registered as a custom
**Bases view**. The hierarchy lives in frontmatter — `parent`, `order`, `type` — not in
folders, so the same notes stay searchable, linkable and editable as notes.

This epic is the product. Its features are what the view does; `Codebase health` holds the
engineering work that keeps it maintainable.

## Why it exists

Obsidian has no backlog. Bases gave it queryable tables, but a backlog is a *tree* with a
*rank*, and neither survives a flat table. The gap this fills is Azure DevOps' backlog
view: nested work items you reorder by dragging, over notes you already own.

## Definition of done, for anything under this epic

- The view never writes to a note the Base excluded.
- Every property change it makes can be taken back.
- Nothing needs maintaining by hand: the view assigns `parent`, `order` and `type`.
