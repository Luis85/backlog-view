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
mobile HTML5 drag events never fire. The menu is all of those answers at once.

## Acceptance criteria

- The board is one tab stop, like the tree: arrows move the selection across cards and
  columns, Home and End reach the edges, Enter opens the note, `/` reaches the quick
  filter, Ctrl/Cmd+Z undoes.
- Alt+Left and Alt+Right move the selected card one column, writing the same batch a
  drop writes. There is deliberately no Alt+Up/Down rank — within-column order is
  derived ([[Board order is derived not stored]]).
- Set state in the context menu is the equivalent non-drag path on every platform, and
  the required one on touch; it offers the same vocabulary in both projections — which
  includes clearing: a no-state entry writing the same remove-state write the no-state
  column's drop writes, or the menu could not reach every column a drag can.
- Every move — drag, key or menu — is announced to assistive technology from a polite
  live region, naming the card and its old and new column; hidden instructions on the
  board describe the shortcuts and the menu path.
