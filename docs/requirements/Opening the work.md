---
type: PBI
parent: "[[Finding work]]"
order: 40
status: Done
---

# Opening the work

**As** someone who found the item, **I want** to open the note, **so that** the backlog
stays a way into my writing rather than a place I have to leave to do anything with what I
found. Every row is a real note; the view is a lens on it, not a replacement for it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking a row, pressing `Enter` on the selection, or a menu item |
| **Preconditions** | A row is present or selected |
| **Guarantee** | Opening never writes. Reaching the note costs nothing and changes nothing. |

**Main flow**

1. The user clicks a row.
2. The note opens in the current tab.
3. `Enter` on the keyboard selection does the same, so the tree's navigation ends where it
   should.

**Extensions**

- **1a — the click carries the platform's modifier** (`Ctrl`/`Cmd`, per Obsidian's own
  rule). It opens in a new tab, exactly as a link in a note would. Following the platform
  convention rather than reimplementing it is the point.
- **1b — the middle mouse button.** Also a new tab, the browser habit.
- **1c — the click landed on a control** — the chevron, the **+**, the state chip, a tag
  pill. That control acts and the note does not open: each stops the click from reaching
  the row. A row is several things at once, and only its own body means "open this".
- **1d — the menu is used instead.** **Open in new tab** and **Open to the right** are
  there for the keyboard and for deliberate placement — the second splits the pane, which
  no click gesture offers.
- **2a — the row is a context row from outside the Base's filter.** It opens like any
  other. Reading is never restricted; only writing is.
- **3a — `Enter` while a row control has focus** (the state chip, reachable by assistive
  tech). The control acts alone; the key does not also open the selected item.

## Acceptance criteria

- A click on a row's body opens its note in the current tab; a modifier or middle click
  opens a new one.
- `Enter` opens the keyboard selection, and does not when a row control has focus.
- Clicking a control acts on that control and does not also open the note.
- **Open in new tab** and **Open to the right** are in the context menu, so both are
  reachable without a pointer.
- Opening a note writes nothing.

## Where it lives

`src/view/backlogView.ts` (`openItem`, `openItemInNewTab`, `openItemToSide`) ·
`src/view/render/rows.ts` (the click and auxclick handlers) ·
`src/view/interactions/keyboard.ts` (`Enter`) · `src/view/interactions/menu.ts`.
Tests: `test/view/rendering.test.ts`, `test/view/keyboard.test.ts`,
`test/view/menu.test.ts` — asserted through `vault.opened`.
