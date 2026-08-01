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

## Where it lives

`src/view/interactions/keyboard.ts` (navigation and shortcuts) ·
`src/view/interactions/menu.ts` (the context menu) ·
`src/view/interactions/structure.ts` (move, indent, outdent).
Tests: `test/view/keyboard.test.ts`, `test/view/menu.test.ts`,
`test/view/visibility.test.ts`.
