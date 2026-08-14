---
type: Test case
order: 40
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
---

# Tree keyboard moves

A verification to run.

## Why this exists

`view/interactions/keyboard.ts` is exercised in jsdom by synthetic `keydown` events; the
sighted question — does the moved row stay visibly selected and legible in place — is
not.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Select a row with the keyboard, then:

- Alt+Up / Alt+Down — the row moves among its siblings, selection follows it, and the
  tree scrolls to keep it in view.
- Alt+Right — the row indents under its previous sibling.
- Alt+Left — the row outdents to its grandparent's level.

Each move should read as instant, with no flash or scroll jump that loses the selected
row off-screen.

## Acceptance criteria

- All four moves checked, selection following the row each time.
