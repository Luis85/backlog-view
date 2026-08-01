---
type: PBI
parent: "[[Moving cards]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
---

# Keyboard, menu and touch

The board moves cards without a mouse the way the tree already moves rows, and the
context menu is the one path that works everywhere. The evidence stacks up on the same
answer: Trello moves a card between lists with a keystroke rather than a pick-up mode,
Atlassian's accessibility guidance recommends menu alternatives over draggable focus
modes, WCAG 2.2 requires a single-pointer alternative to any drag, there is no ARIA
board pattern (`aria-grabbed` is deprecated with no replacement), and on Obsidian
mobile native drag from touch has historically not fired — the chosen engine claims
otherwise, a verdict the smoke test owns ([[Pragmatic drag and drop for the board]]).
The menu is the answer on every platform either way.

## Acceptance criteria

- The board is one tab stop, like the tree: arrows move the selection across cards and
  columns, Home and End reach the edges, Enter opens the note, `/` reaches the quick
  filter, Ctrl/Cmd+Z undoes. A column with no card to select is still a stop — the
  selection rests on the column itself, where Enter and the context menu offer that
  column's creation — so an empty board is fully drivable by keyboard.
- Alt+Left and Alt+Right move the selected card one column, writing the same batch a
  drop writes. There is deliberately no Alt+Up/Down *rank* — within-column order is
  derived ([[Board order is derived not stored]]) — which leaves the pair free for
  lanes ([[Swimlanes by parent]]).
- Set state in the context menu is the equivalent non-drag path on every platform, and
  the required one on touch. On the board its vocabulary is exactly the board's
  targets — configured states, observed out-of-workflow values, and a no-state entry
  writing the same remove-state write the no-state target's drop writes — so every
  target a drag can reach, the menu can too, and the other way round.
  `stateMenuValues` alone cannot supply that list (it returns only the configured
  states when a list is set); closing that gap for board mode is this PBI's own work.
- Every move — drag, key or menu — is announced to assistive technology from a polite
  live region naming the card and what changed: old and new column for a state move,
  old and new lane for a reparent, both for a drop that does both. Hidden
  instructions on the board describe the shortcuts and the menu path.
