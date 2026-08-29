---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
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
- **2c — the user wants out of the selection.** `Escape` clears it, and so does a click on
  the pane's **background**. The pointer answer lives beside the keyboard one because the
  key alone was not one: `Escape` only reaches the view while the pane has focus, and the
  commonest way to select a row is a click that opens its note, which hands focus to the
  editor. So the selection a pointer made had no way back out except selecting something
  else.
  **Background is defined by what it is not** — an item (a row or a card) or a control
  that acts on its own — and it has to be, because the scroller's own blank strip is the
  area under the last row and almost nothing else: every projection fills the pane with
  containers, and the blank space a user can actually hit belongs to one of those. A rule
  written as "the pane element itself" describes a target that is rarely reachable.
  **Both halves are categories rather than lists**, and each was a list first that shipped
  a hole. An item is anything the selection can rest on (`aria-selected`) — a row, a card,
  and the board column's own header, which is a stop precisely so an empty column stays
  reachable; a rule naming rows and cards covered two of the three and threw away a held
  column position when its header was clicked. A control is a tab stop, which is what a
  pane control is by construction; a rule naming items and buttons missed the timeline's
  lead-resize grip, a `role="separator"` div, and cleared the selection under the user's
  hand mid-resize. The pane is a tab stop too, and is ruled back in as the background it
  is.
  Both routes clear the WHOLE selection, the board's column stop included: a pane that
  reads as holding nothing must not still answer `Alt`+arrow with a move.
  The click opens nothing and writes nothing. It does **take focus** — the pane is a tab
  stop, and a browser focuses one on a pointer press before any handler runs — and that
  is the wanted direction rather than a cost tolerated: the gesture's whole reason is that
  focus was in the editor, so leaving it there would clear the selection and still leave
  `Escape` and the arrows out of reach.
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
  does a click on the pane's background — which is what a pointer has after opening a note
  has taken focus to the editor. Background means anything that is not an item or a
  control, in every projection, rather than the pane element alone — with "an item" read
  as "anything carrying `aria-selected`" and "a control" as "a tab stop", so neither a
  fourth selectable thing nor a new control is background to anybody.

## Where it lives

`src/view/interactions/keyboard.ts` (navigation and shortcuts) ·
`src/view/interactions/menu.ts` (the context menu) ·
`src/view/interactions/structure.ts` (move, indent, outdent) ·
`src/view/selection.ts` (what a selection IS, and both ways out of one: `clearSelection`,
which releases the card and the board's column stop together, and the background-click
listener wired where the scroller is known, over `NOT_BACKGROUND` — the one statement of
what a click inside the pane can land on and still mean something).
Tests: `test/view/keyboard.test.ts`, `test/view/menu.test.ts`,
`test/view/visibility.test.ts`, `test/view/boardMoves.test.ts`.
