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
2. The note opens where the view is configured to put it — the current tab by default.
3. `Enter` on the keyboard selection does the same, so the tree's navigation ends where it
   should.

**Extensions**

- **1a — the click carries the platform's modifier** (`Ctrl`/`Cmd`, per Obsidian's own
  rule). It opens in a new tab, exactly as a link in a note would. Following the platform
  convention rather than reimplementing it is the point — which is also why the modifier
  outranks the configured target rather than being redirected by it.
- **1e — clicking an item is configured to fold it** (`clickAction`). The row's body then
  means what its chevron means, and the note is reached from the row menu, from `Enter`,
  or with the modifier above. A row with nothing under it folds nothing and does not open
  either: one gesture cannot mean "fold" on a parent and "open" on a leaf without being
  unpredictable on both. A filtered tree refuses the flip exactly as the chevron does.
- **2b — the note is configured to open in a new tab or to the side** (`openIn`). To the
  side additionally **pins the backlog's own leaf**: the default target replaces the
  current tab, and a view whose point is to stay put while notes come and go must not be
  what a note lands on. The side pane is made once and reused while it is open —
  `getLeaf('split')` splits whatever is active, and the backlog is active on every click,
  so a split per click would fill the window by the fourth item.
- **1f — the menu's Open to the right, while the target is not the side.** It opens
  beside the backlog and pins **nothing**. The pin belongs to the setting, because that
  is the target which would otherwise replace the base on every click; one deliberate
  menu action has to leave the workspace's pins as it found them, or it would silently
  change what an ordinary click does afterwards — `getLeaf(false)` cannot replace a
  pinned leaf, so the default target would stop opening in the tab it names.
  Nothing ever un-pins, either: this cannot tell its own pin from the user's, so undoing
  one when the target changes back would be as likely to take away a pin they set
  deliberately.
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
- With `clickAction` set to fold, a click folds the row and opens nothing — and the
  modifier, `Enter` and the menu still open the note.
- With `openIn` set to the side, the backlog's own leaf is pinned and a second open
  reuses the pane the first one made; the menu's **Open to the right** pins nothing under
  any other target.
- A `clickAction` or `openIn` value no version of this plugin declared falls back to the
  default rather than reaching a branch that has no arm for it.

## Where it lives

`src/view/openTarget.ts` (which leaf a note opens in, the pin, and the side pane made
once and reused) · `src/view/backlogView.ts` (`openItem`, `openItemInNewTab`,
`openItemToSide`, each delegating to it) · `src/view/render/rows.ts` (the click and
auxclick handlers, and `foldOnClick`) · `src/view/interactions/keyboard.ts` (`Enter`) ·
`src/view/interactions/menu.ts` · `src/domain/itemHandling.ts` (the two settings, their
offered vocabulary and the defensive read of a hand-edited value) ·
`src/domain/viewOptions.ts` (the **Handling items** group: `clickAction`, `openIn`).
Tests: `test/view/rendering.test.ts`, `test/view/keyboard.test.ts`,
`test/view/menu.test.ts`, `test/view/opening.test.ts` — asserted through `vault.opened`.
