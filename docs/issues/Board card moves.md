---
type: Issue
order: 30
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Board card moves

A verification to run.

## Why this exists

`performBoardMove` is the one host method all three inputs share; jsdom drives each
input and asserts the write, never the drag feel or the menu's rendered submenu.

## How to check

- **Drag** — pick up a card and drop it on another column; the column highlights as the
  drop target, and the card lands there with its state written.
- **Alt+Left / Alt+Right** — with a card selected, move it one column either direction;
  selection follows the card.
- **Card menu → Set state** — opens listing exactly the board's own rendered columns, in
  the same order, with the current one checked; picking a different one moves the card.

All three should announce the same way (one live region, per the project's card-drag
design) — confirm the announcement names the card and both column names.

## Acceptance criteria

- All three inputs confirmed to move the same card the same way, each announced.
