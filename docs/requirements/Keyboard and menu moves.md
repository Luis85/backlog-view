---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 20
status: Done
---

# Keyboard and menu moves

**As** someone who works from the keyboard, or who cannot use a pointer at all, **I want**
every move drag-and-drop can make available without one, **so that** the backlog is
usable rather than merely viewable when dragging is not an option.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, keyboard or assistive-tech user |
| **Trigger** | `Tab` into the tree, or right-click / context-menu key on a row |
| **Preconditions** | The tree has at least one row |
| **Guarantee** | Every move reachable by dragging is reachable here, and produces the identical write. |

**Main flow**

1. `Tab` moves into the tree, which is a **single** tab stop — the whole widget, not one
   stop per row.
2. Arrows move the selection: up and down through visible rows, right to expand or
   descend, left to collapse or go to the parent.
3. `Alt`+`↑`/`↓` moves the selected row among its siblings; `Alt`+`→`/`←` indents and
   outdents it.
4. The context menu offers the same four, plus move-to-top and move-to-bottom of the
   sibling group.
5. Each runs the same plan-and-write path a drop does.

**Extensions**

- **2a — the user presses `/`.** Focus jumps to the quick filter ([[Quick filter]]).
- **2c — the user wants out of the selection.** `Escape` clears it, and a click on the
  **pane itself** — the empty space below or beside the rows, never a row and never a
  control — does the same. The pointer answer lives beside the keyboard one because the
  key alone was not one: `Escape` only reaches the view while the pane has focus, and the
  commonest way to select a row is a click that opens its note, which hands focus to the
  editor. So the selection a pointer made had no way back out except selecting something
  else. Both clear the WHOLE selection, the board's column stop included: a pane that
  reads as holding nothing must not still answer `Alt`+arrow with a move. Clearing is
  the only thing this click means — it opens nothing, writes nothing and moves no focus.
- **2b — the user presses `Ctrl`/`Cmd`+`Z`.** The last batch is taken back
  ([[Undo and redo]]) — handled before the empty-tree return, because the change being
  undone may be what emptied it.
- **3a — the move cannot apply** (outdent at top level, move up from first position). The
  command is **disabled**, in the menu and as a key, rather than accepted and silently
  doing nothing.
- **3b — finished work is hidden and the neighbour is a hidden row.** The move targets the
  nearest *visible* neighbour instead. A command whose effect is invisible reads as broken.
- **3c — the row came from outside the Base's filter.** The move commands are withheld
  from its menu entirely.

## Acceptance criteria

- The tree is a single tab stop; arrows move the selection, as a tree widget should.
- A command that cannot apply is disabled rather than silently doing nothing.
- Commands target the nearest *visible* neighbour, so none is visually inert when finished
  work is hidden.
- Per-row controls inside the tree (**+**, the state chip) are real buttons with
  `tabindex="-1"`: reachable by assistive tech, never a `Tab` stop of their own.
- A selection can be left without selecting something else: `Escape` clears it, and so
  does a click on the pane's own background — which is what a pointer has after opening a
  note has taken focus to the editor.

## Where it lives

`src/view/interactions/keyboard.ts` (navigation and shortcuts) ·
`src/view/interactions/menu.ts` (the context menu) ·
`src/view/interactions/structure.ts` (move, indent, outdent) ·
`src/view/selection.ts` (what a selection IS, and both ways out of one: `clearSelection`,
which releases the card and the board's column stop together, and the background-click
listener wired where the scroller is known — `evt.target === treeEl` is the whole
condition, so a click on anything inside it stays that thing's).
Tests: `test/view/keyboard.test.ts`, `test/view/menu.test.ts`,
`test/view/visibility.test.ts`, `test/view/boardMoves.test.ts`.
