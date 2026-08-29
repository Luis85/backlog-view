---
type: Test case
order: 50
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Tree context menu

A verification to run.

## Why this exists

`view/interactions/menu.ts` is asserted by which items it builds, never by how the
Obsidian `Menu` actually renders — submenus in particular, since `setSubmenu` is a
typings gap the code casts around (`src/view/CLAUDE.md`).

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- **Set type** — opens a submenu of the legal types for this row's parent; picking one
  writes it and the row's badge updates immediately.
- **Set state** — opens a submenu of the configured state values, with the current one
  checked; picking one writes it.
- **Edit tags** — opens the tag prompt with the row's current tags pre-filled and the
  vocabulary suggested; adding and removing round-trips correctly.
- Confirm neither Set type nor Set state nor the parent-link actions appear on a
  context row (one rendered only because a result beneath it needed a parent).

## Acceptance criteria

- All three actions checked end to end, including the submenu rendering.
- Context-row exclusion confirmed on at least one context row.
