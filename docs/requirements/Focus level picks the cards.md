---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 10
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/board.ts
  - src/domain/itemTypes.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-09
risk: ""
assignee: ""
---

# Focus level picks the cards

**As** someone whose backlog is four levels deep, **I want** to say which rung the board
is about, **so that** I get a board of features or a board of tasks instead of one board
holding both and meaning neither.

Azure DevOps keeps a separate board per backlog level behind one selector — Epics,
Features, Stories. The focus level is already that selector here: in the tree it
re-roots, on the board it decides which rung becomes cards.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Setting the focus level from the toolbar while the board is showing |
| **Preconditions** | Board mode is on |
| **Guarantee** | Focus is a render decision that writes nothing, and nothing it narrows falls silently: what is not a card surfaces as a rollup or as context, and clearing focus restores every result to a column. |

**Main flow**

1. The user picks a level from the toolbar control — the same control the tree uses, and
   it persists the same way.
2. The board renders that level's items as cards.
3. Results below the focused level surface in those cards' rollups; ancestors above it
   render as context.
4. Column counts narrow with the cards, so the counts and the board agree.
5. Clearing focus restores every result to a column.

**Extensions**

- **2a — an extra type ranks beside the focused level.** It is a card too, exactly as focus
  mode already surfaces it in the tree, so a Bug ranks with the level it sits level with
  rather than vanishing.
- **2b — no focus level is set.** Every result is a card, and each card's type badge
  carries the difference.
- **2c — a focused-level item is itself outside the filter.** It still places its results,
  as the tree's context rows do: an inert context card — visible, carrying its rollup of
  visible results, never draggable, never counted, never written — under its own state's
  column when one exists, else in the no-state column, styled and announced as context.
  A base returning only Tasks beneath excluded parents therefore still shows a board
  under that parent level's focus.
- **2d — "Show parents outside the filter" is off.** The model holds no such parent to
  render, so the focused empty state answers honestly, as the tree's does. The option
  that loads those ancestors is what makes the case above possible at all.
- **2e — hiding finished work hides everything a context card stood for.** The card goes
  too. It renders only while it places a visible result; its own state is never the thing
  keeping it on screen. The tree's visibility rule travels with it.
- **4a — the epic's every-result-has-a-column invariant.** It is stated at full scope, and
  this is one of the two narrowings that move the board and its counts together — the
  other being [[Done columns stay lean]].

## Acceptance criteria

- With a focus level set, the cards are that level's items — plus the extra types that
  rank beside it, exactly as focus mode already surfaces them in the tree, so a Bug
  ranks with the level it sits level with rather than vanishing.
- With no focus level, every result is a card, and each card's type badge carries the
  difference.
- A focused-level item that is itself outside the filter still places its results, as
  the tree's context rows do: an inert context card — visible, carrying its rollup of
  visible results, never draggable, never counted, never written — under its own
  state's column when one exists, else in the no-state column, styled and announced
  as context. A base returning only Tasks beneath excluded parents therefore still
  shows a board under that parent level's focus — while "Show parents outside the
  filter" is on, the option that loads those ancestors at all; with it off the model
  holds no such parent to render, and the focused empty state answers honestly, as
  the tree's does. And the tree's visibility rule
  travels with it: a context card renders only while it places a visible result —
  when hiding finished work hides everything it stood for, the card goes too, its own
  state never the thing keeping it on screen.
- Changing focus is a render decision and writes nothing.
- Focus narrows the board and its counts together, and nothing falls silently: results
  below the focused level surface in card rollups, ancestors as context. The epic's
  every-result-has-a-column invariant is stated at full scope, and clearing focus
  restores it.
- The same toolbar control drives both projections and persists the same way it does
  today.

## Where it lives

`boardColumns` in `src/domain/board.ts` asks the model's own focus roots — which types
rank beside a level stays `src/domain/itemTypes.ts`, and the re-rooting stays the
model's — and answers with a card set rather than a new root: results as cards, an
excluded focus-level item as an inert context card sorted where its first placed
result would sort, in no count. The view's row-visibility rule is passed in whole, so
the two projections cannot disagree about what is hidden. Asserted in
`test/domain/board.test.ts`; the inert card is driven end to end in
`test/view/board.test.ts`.
