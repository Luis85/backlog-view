---
type: PBI
parent: "[[Moving cards]]"
order: 20
status: Active
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
  - src/view/interactions/cardDrag.ts
  - src/view/render/board.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/view/selection.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Keyboard, menu and touch

**As** someone who cannot drag — no pointer, a screen reader, or a phone — **I want**
every move the board offers to be reachable another way, **so that** the board is a way
of working rather than a picture of other people's work.

The board moves cards without a mouse the way the tree already moves rows, and the
context menu is the one path that works everywhere. The evidence stacks up on the same
answer: Trello moves a card between lists with a keystroke rather than a pick-up mode,
Atlassian's accessibility guidance recommends menu alternatives over draggable focus
modes, WCAG 2.2 requires a single-pointer alternative to any drag, there is no ARIA
board pattern (`aria-grabbed` is deprecated with no replacement), and on Obsidian
mobile native drag from touch has historically not fired — the chosen engine claims
otherwise, a verdict the smoke test owns ([[Pragmatic drag and drop for the board]]).
The menu is the answer on every platform either way.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone driving the board without a drag — by keyboard, screen reader or touch |
| **Trigger** | Tabbing into the board, or opening a card's context menu |
| **Preconditions** | Board mode is on |
| **Guarantee** | Every target a drag can reach, the keyboard and the menu can reach, and the other way round. No move exists that only a pointer can make. |

**Main flow**

1. The user tabs into the board — one tab stop, like the tree.
2. Arrows move the selection across cards and columns; Home and End reach the edges.
3. Alt+Left and Alt+Right move the selected card one column, writing the same batch a
   drop writes.
4. The move is announced from a polite live region naming the card and what changed —
   old and new column for a state move.
5. Enter opens the note; `/` reaches the quick filter; Ctrl/Cmd+Z undoes.

**Extensions**

- **1a — the user is on touch.** The card's context menu is the required path, and the
  same one. Whether native drag fires from touch on Obsidian mobile is a claim the engine
  makes and the smoke test settles; the menu does not depend on the answer.
- **2a — the selection lands on a column with no cards.** The column itself is the stop,
  and its context menu opens today — carrying the column's agreed policy when one is
  set, nothing when none is. Creation from that stop is not built: it waits on
  [[New cards in place]], scoped in "Where it lives" below. An empty board is fully
  drivable by keyboard for what exists today, or it is a board that cannot be started
  from once creation lands.
- **3a — there is no Alt+Up/Down for rank.** Deliberately: within-column order is derived,
  not stored ([[Board order is derived not stored]]), so a rank shortcut would promise
  something the board does not keep.
- **3b — the user takes the menu instead.** Set state offers exactly the board's targets:
  the configured states, the observed out-of-workflow values, and a no-state entry writing
  the same remove-state write the no-state column's drop writes. `stateMenuValues` alone
  cannot supply that list — it returns only the configured states when a list is set — and
  closing that gap for board mode is this PBI's own work.
- **5a — the user needs to know the shortcuts exist.** Hidden instructions on the board
  describe them and the menu path, so a screen-reader user is told rather than left to
  discover.

## Acceptance criteria

- The board is one tab stop, like the tree: arrows move the selection across cards and
  columns, Home and End reach the edges, Enter opens the note, `/` reaches the quick
  filter, Ctrl/Cmd+Z undoes. A column with no card to select is still a stop — the
  selection rests on the column itself, and its context menu opens there carrying the
  column's policy — so an empty board is drivable by keyboard for what exists today;
  creation from that stop still waits on [[New cards in place]].
- Alt+Left and Alt+Right move the selected card one column, writing the same batch a
  drop writes. There is deliberately no Alt+Up/Down *rank* — within-column order is
  derived ([[Board order is derived not stored]]).
- Set state in the context menu is the equivalent non-drag path on every platform, and
  the required one on touch. On the board its vocabulary is exactly the board's
  targets — configured states, observed out-of-workflow values, and a no-state entry
  writing the same remove-state write the no-state target's drop writes — so every
  target a drag can reach, the menu can too, and the other way round.
  `stateMenuValues` alone cannot supply that list (it returns only the configured
  states when a list is set); closing that gap for board mode is this PBI's own work.
- Every move — drag, key or menu — is announced to assistive technology from a polite
  live region naming the card and what changed: old and new column for a state move.
  Hidden instructions on the board describe the shortcuts and the menu path.

## Where it lives

**Partly built — everything except the parts that wait on a use case of their own.**

`handleBoardKeydown` in `src/view/interactions/keyboard.ts` is the one tab stop: arrows
across cards and columns, Home/End, Enter, `/`, undo, the empty column as a stop, and
the menu keys, over the selection state in `src/view/selection.ts`. Beside it,
`handleBoardMoveKey` turns Alt+Left and Alt+Right into a card move, and nothing into
Alt+Up/Down.

All three inputs land on **one** method — `performBoardMove`, implemented in
`src/view/cardMoves.ts` (`CardMoveController`; `src/view/backlogView.ts` keeps a
one-line delegate so `BacklogViewHost` still resolves to one class —
[[Split the view dispatch hub]]) — so a key, a menu pick and a drop cannot plan
different writes, and a fourth input cannot arrive with its own idea of what a move is. It is
also where the move is announced, through `announceBoardMove` in
`src/view/interactions/cardDrag.ts`: the announcement lives with the drag because
that module owns the live region, but nothing about it is the drag's. The message
names the columns, resolved by `columnLabelFor` in `src/domain/board.ts` — so what is
read out is what is on screen, the no-state column's label included.

The board's Set state is `stateChoices` in `src/view/interactions/menu.ts`, which reads
the **rendered columns** instead of rebuilding the list. That is what makes the menu's
targets and the drag's the same set by construction, no-state entry included, rather
than two lists kept in step by hand. The same builder withholds the tree's move
section, whose every entry is defined by a row's visible neighbours. The card's
`contextmenu` wiring and the hidden `aria-describedby` instructions are in
`src/view/render/board.ts`, clipped by `.pbl-sr-only` in `styles.css`.

Driven in `test/view/boardMenu.test.ts` (fixtures and the live-region reader in
`test/helpers/board.ts`), with the navigation half in `test/view/boardMoves.test.ts`
and both new entry points aimed at a context card in
`test/view/contextCardWrites.test.ts` — a keyboard can select what a drag was never
wired to pick up, so the rule needed testing where the drag could not reach.

Still open, each waiting on a use case of its own: the column stop's **creation** —
Enter and the menu on an empty column — needs [[New cards in place]]; and the **touch
verdict** belongs to [[Smoke test the board in a live vault]], which is
where a device can answer it. The menu path it would fall back to is built either way,
which was the point of not waiting for the answer.
