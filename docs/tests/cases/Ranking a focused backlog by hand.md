---
type: Test case
order: 130
parent: "[[Smoke test the tree]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-31
source: the global-rank epic — the feature it exists for, driven only in jsdom
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Ranking a focused backlog by hand

A verification to run.

## Why this exists

This is the feature the global rank was built for: with a focus level on, the rows come
from many different parents and can be dragged into a priority order that is the user's
rather than an accident of the hierarchy. jsdom drives the drag as synthetic
`dragstart`/`drop` events against a fake data source, so what is unchecked is everything
a pointer does — whether the drop indicator lands where the eye expects between two rows
that are siblings on screen and strangers in the tree, and whether the list settles in
the new order rather than jumping.

**Run [[Seeding and respacing a vault's ranks]] first.** On an unmigrated vault a focused
list draws in tree order on purpose, and nothing below is visible.

**Preconditions** — the plugin is installed by `npm run test-build`, this repository is
open as a vault with `docs/Product Backlog.base` showing the tree, and its ranks have
been seeded.

## How to check

Set the focus level to **PBI** from the toolbar. The rows are now PBIs from several
different Epics, in one flat list.

- **Drag** a PBI from near the bottom to the top of the list. The drop indicator sits
  between two rows the whole way; on release the row lands where indicated and stays
  there.
- **Exactly one note is written.** Check the moved note's frontmatter: `order` changed
  and `parent` did not. Check one of its new neighbours: unchanged. This is the whole
  claim of the epic and the one a vault can falsify.
- **Clear the focus level.** The moved item is still under its own Epic, in the tree,
  where it always was — a focus rank moves nothing in the hierarchy.
- **Alt+Up / Alt+Down** on a focus row moves it the same way, and the row stays selected.
- **The menu's Move up / Move down / Move to top / Move to bottom** do the same. All
  three inputs plan the identical write, so a rank taken by drag and the same rank taken
  by menu should be indistinguishable afterwards.
- **Indent and Outdent are absent** from a focus row's menu, and Alt+Left / Alt+Right do
  nothing there: ranking those rows is this feature, reparenting them is a question the
  synthetic top row cannot answer.
- Reload the vault. The order is still the one that was dragged.

## Acceptance criteria

- A cross-parent drag lands where indicated and survives a reload.
- One note written per move, `order` only, verified in frontmatter.
- Drag, Alt+arrow and menu agree; indent and outdent stay refused.
