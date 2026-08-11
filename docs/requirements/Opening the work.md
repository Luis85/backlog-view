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
- **1e — the toolbar's toggle is set to fold** (`host.clickFolds`). The row's body then
  means what its chevron means, and the note is reached from the row menu, from `Enter`,
  or with the modifier above. A row with nothing under it folds nothing and does not open
  either: one gesture cannot mean "fold" on a parent and "open" on a leaf without being
  unpredictable on both. A filtered tree refuses the flip exactly as the chevron does.
  **This is the ROW-shaped projections' option and the option says so** — the tree and the
  dated axis, whose timeline rows carry the same chevron over the same collapse call. A
  CARD is not a row with a fold: a board card's disclosure lists children on its own face
  and a card with nothing under it draws no disclosure at all, so the option would be inert
  on the commonest card on a board. Card activation keeps opening the note, which is what a
  card is for.

  It stopped being a view OPTION on 2026-08-11 and is now working position, held per
  saved view and per device in the collapse store under ADR 0011's rule — the toolbar
  toggle is the only surface for it, and the **Handling items** group holds `openIn`
  alone. What decided it is that this is flipped while reading rather than while setting
  a view up, and a `.base` is shared: one person's habit of clicking to fold does not
  belong to everyone the base syncs to. A `clickAction` key in a base written before the
  move is inert, exactly as `focusLevel` is.

  Until 2026-08-11 this said **the TREE's option** and named extending it a product
  decision nobody had taken, needing an answer for the childless card first. The decision
  was taken (the human's own request) and the answer is the tree's, unchanged: a row with
  no rows under it spends the click and opens nothing. What it needed was not a new rule
  but the right question — `timelineRows` decides which bars keep a disclosure, so
  `item.children` would have offered a fold on a bar whose children are not rows on that
  grid. The card half of the old paragraph still stands and is why this stops at two
  projections rather than four.
- **1h — the timeline row folds, and the whole projection is redrawn** (`renderTimelineRow`
  passing `foldOnClick` to `wireCardActivation`). The fold call itself is one shared
  function so the gesture cannot come to mean different things on two screens that both
  draw rows; what each caller supplies is the two things it alone knows — what counts as
  having children, and what a fold has to redraw. On the tree that is one subtree; on the
  dated axis it is everything, since the window, the gridlines and every full-height mark
  are derived from the row set the fold changes. Which collapse BIT is written follows
  `collapseKey` as it already did: the dated axis folds a plan under `TIMELINE_SCOPE`, the
  tree opens a node in the backlog, and neither reaches a card's own `CARD_SCOPE`.
- **1g — the toggle is where it is flipped, and the only place** (`renderClickActionToggle`).
  A toggle beside the completed-items eye, writing through `host.setClickFolds` to the
  collapse store: this is the thing a reader changes while working rather than while
  setting the view up, and the view options panel is four clicks away. One surface over one
  value — there is no dropdown left for it to agree with, which is what removed the whole
  question of two surfaces drifting apart. Nothing is written to the `.base`, so no Bases
  refresh follows and the view re-renders itself, the same rule the projection and the
  focus level already keep.

  It follows the option's own scoping — `clickActionApplies`, the tree and the dated axis
  and no card — since a control that changes nothing on the screen in front of you is worse
  than an absent one. That predicate has to agree with which renderers pass a fold, and
  nothing checks that mechanically: the two call sites are `wireRowEvents` and
  `renderTimelineRow`, a third would have to be added to it in the same change, and what
  IS checked is the pairing on the projections that exist — the tests drive a click on each
  and assert the button is present exactly where the click folds. Its name is the
  setting rather than the next action, with `aria-pressed` carrying the value, which is the
  density toggle's rule for the density toggle's reason. The fit ladder sheds it at step 3
  with the bulk collapse controls and it is in the `⋯` from there, so the row's floor is
  unchanged by it — see `A toolbar that fits one row.md`, extension 4b, which measures what
  a control with no rung costs.
- **2b — the note is configured to open in a new tab or to the side** (`openIn`). To the
  side additionally **pins the backlog's own leaf**: the default target replaces the
  current tab, and a view whose point is to stay put while notes come and go must not be
  what a note lands on. The side pane is made once and reused while it is open —
  `getLeaf('split')` splits whatever is active, and the backlog is active on every click,
  so a split per click would fill the window by the fourth item.
- **1f — the menu's Open to the right, and the middle click.** A target the user NAMED
  once, and it behaves as it did before this option existed: a **fresh** pane every
  time, pinning **nothing**. Both halves are the same distinction. The pin belongs to
  the setting, because that is the target which would otherwise replace the base on
  every click; one deliberate menu action has to leave the workspace's pins as it found
  them, or it would silently change what an ordinary click does afterwards —
  `getLeaf(false)` cannot replace a pinned leaf, so the default target would stop
  opening in the tab it names. And the reuse belongs to the setting for the mirror
  reason: two Open to the right picks are two **placements**, so sharing the configured
  target's pane would make the second replace the note the user had just put on screen.
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
- With the toggle set to fold, a click folds the row and opens nothing — and the
  modifier, `Enter` and the menu still open the note. On the tree and on the dated axis
  alike, from one shared decision, so the gesture cannot mean different things on two
  screens that both draw rows; on a board, bucket or shelf CARD it opens the note as it
  always did.
- The toolbar's toggle is drawn exactly where it has an effect: on the two row-shaped
  projections and on no card.
- The fold state survives closing and reopening the view, per saved view and per device,
  and is never written to the `.base`; a `clickAction` key left in a base written before
  the move changes nothing.
- With `openIn` set to the side, the backlog's own leaf is pinned and a second open
  reuses the pane the first one made; the menu's **Open to the right** pins nothing and
  splits afresh, so two deliberately placed notes both stay on screen.
- An `openIn` value no version of this plugin declared falls back to the default rather
  than reaching a branch that has no arm for it.

## Where it lives

`src/view/openTarget.ts` (which leaf a note opens in: `open` for the configured target,
which pins and reuses one side pane, and `openIn` for a target the caller named, which
does neither) · `src/view/backlogView.ts` (`openItem` and `openItemIn`, each delegating
to it) · `src/view/render/rows.ts` (the tree's click and
auxclick handlers, and `foldOnClick` — the one decision both row-shaped projections
make) · `src/view/render/board.ts` (`wireCardActivation`, which every card and the
timeline's rows share, and whose optional fold is what keeps a card opening its note) ·
`src/view/render/timeline.ts` (`renderTimelineRow`, the one caller that passes one) ·
`src/view/render/toolbarControls.ts` (`clickActionApplies` and `clickActionToggle`: where
the option applies, and what its toolbar toggle says) ·
`src/view/render/toolbar.ts` (`renderClickActionToggle`) ·
`src/view/interactions/keyboard.ts` (`Enter`) ·
`src/view/interactions/menu.ts` · `src/domain/itemHandling.ts` (`openIn`: its offered
vocabulary and the defensive read of a hand-edited value) ·
`src/domain/viewOptions.ts` (the **Handling items** group, which is `openIn` alone) ·
`src/storage/collapseStore.ts` and `src/view/collapseState.ts` (`clickFolds`, stored
beside the collapse sets) · `src/view/uiState.ts` (the pick, and the render it asks for).
Tests: `test/view/rendering.test.ts`, `test/view/keyboard.test.ts`,
`test/view/menu.test.ts`, `test/view/opening.test.ts` — asserted through `vault.opened`,
and where a stale `clickAction` key is shown to change nothing — `test/view/toolbarClickAction.test.ts`
for the toggle and the dated axis's fold, and `test/view/persistence.test.ts` for the
reopen.
