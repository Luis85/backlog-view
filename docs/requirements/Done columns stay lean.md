---
type: PBI
parent: "[[Columns from the workflow]]"
order: 40
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/board.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/viewStateController.ts
  - src/view/render/board.ts
  - src/view/interactions/columnMenu.ts
  - styles/board.css
started: "2026-08-14"
finished: "2026-08-14"
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Done columns stay lean

**As** someone whose done column has a year of finished work in it, **I want** it out of
my way without being out of my vault, **so that** the board stays about the work in
flight while the record of what was finished stays exactly where I put it.

Every surveyed tool bounds its done column — Jira hides completed items older than a
chosen number of weeks, GitHub Projects and Linear auto-archive — and every one of
those rules reads a completion date. Notes have none until the transition stamps land,
so what a note-backed board can do honestly today is collapse, and this register keeps
its closed notes for a reason: an archive here is a state value plus the Base's own
filter, not a place cards are moved to.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The board renders a done column, or the user collapses one |
| **Preconditions** | Board mode is on and a done value has a column |
| **Guarantee** | Nothing is archived, moved or deleted. Every card the Base returned is still on the board, and hiding is something the user can see the state of and undo by expanding. |

**Main flow**

1. The board renders the done column.
2. The first time it does, a column holding nothing but finished subtrees starts
   collapsed — the once-only default the tree already applies to a parent nobody has
   ruled on.
3. Collapsed, the column keeps its name and its count visible and stays a drop target,
   as Trello's collapsed lists and Linear's hidden columns both do.
4. An explicit expand or collapse is remembered per device in the view-state store, never
   in the `.base`.

**Extensions**

- **2a — the done column still carries open work.** It starts expanded. The collapse
  default exists for noise, and a retained card's rollup is not noise.
- **3a — "Show completed items" is off.** Cards whose whole subtree is done
  (`subtreeDone`) are hidden — never a card still carrying open work, so a Done item with
  an Active task below the focus line keeps its card and its rollup keeps that work on
  screen. This is one of the two narrowings the epic's invariant allows, beside the focus
  level.
- **3b — everything in the column is hidden by that option.** The column still renders,
  collapsed at most. A configured stage stays a drop target and a creation point whatever
  is hidden inside it: completing work *into* a done state has to keep working precisely
  while completed work is hidden.
- **3c — a quick filter is active.** It overrides hiding, as it does in the tree: a search
  that could not find finished work would be a search with a silent exception in it.
- **4a — the user wants age-based hiding** ("done more than two weeks ago"). Out of scope
  until [[Stamp when work starts and finishes]] gives it a date to read. Every tool that
  does this reads a completion date, and inventing one from a file's mtime would be a
  guess presented as history.

## Acceptance criteria

- A done column holding nothing but finished subtrees starts collapsed the first time
  a board renders it — the same once-only default the tree applies to a parent nobody
  has ruled on. One still carrying open work starts expanded: the collapse default
  exists for noise, and a retained card's rollup is not noise. An explicit expand or
  collapse is remembered per device in the view-state store, never in the `.base`.
- A collapsed column keeps its name and count visible and stays a drop target, as
  Trello's collapsed lists and Linear's hidden columns both do.
- "Show completed items" off hides what it hides in the tree: cards whose whole
  subtree is done (`subtreeDone`), never a card still carrying open work — a Done item
  with an Active task below the focus line keeps its card, so its rollup keeps that
  open work on screen. The column itself always renders — collapsed at most — because
  a configured stage stays a drop target and a creation point whatever is hidden
  inside it: completing work into a done state has to keep working precisely while
  completed work is hidden. One of the two deliberate narrowings the epic's invariant
  names, beside the focus level; the quick filter overrides hiding, as it does in the
  tree.
- Age-based hiding stays out of scope until [[Stamp when work starts and finishes]]
  gives it a date to read.

## Where it lives

**Built, 2026-08-14.** The hiding slice shipped with the board: "Show completed items"
off hides `subtreeDone` cards through the same row-visibility rule the tree uses, the
column always renders, and the quick filter overrides — driven in
`test/view/boardMoves.test.ts`. The collapse itself is now beside it, and it reaches the
horizon buckets too ([[Folding a horizon bucket]]).

**The state.** `collapsedColumns` and `expandedColumns` in
`src/storage/viewStateStore.ts` (in its `folds`, which is what a fold is), held by
`src/view/viewState.ts` and reached through `src/view/viewStateController.ts` like every
other UI-state pick — vault-scoped, per device, and
explicitly not in the `.base`, for the reason ADR 0011 gives. A PAIR rather than one
list, exactly as the row sets are: unlike a resource band, a column has a DEFAULT worth
suppressing, so the two together say what the reader has ruled on. They are lists of their
own and not keys in the collapsed-path list, the argument `folds.lanes` already made — the
flush drops any key the vault has no file for, and a state value is not a file. The key is
scoped and lower-cased (`columnKey`), because both boards and the horizon axis can hold a
`Done` and each identifies its columns case-insensitively.

**The default.** `col.done && col.held > 0 && !col.openWork`, taken once, in `renderBoard`.
The two terms beside `done` ask different questions and are measured differently — every
review finding against this default was one of them measured the other's way.

`BoardColumn.openWork` (`src/domain/board.ts`) asks whether anything in the stage is
unfinished, computed in the same population pass `fullCount` is, with the quick filter
lifted. That is the load-bearing half of it: measured over the drawn cards instead, a
search that hid every open card in Done would report the stage finished and fold a column
holding retained work.

`BoardColumn.held` asks whether the stage holds anything at all, and is deliberately NOT
population-based — it is counted through `owned`, a predicate carrying neither the filter
nor the completed-items toggle. No count can serve, because the toggle lives in the
population predicate: with finished work hidden, a done column full of finished work
reports `fullCount === 0`, reads as empty, and refuses the fold in exactly the
configuration extension 3b is about. The term is needed all the same, because settling is
permanent and a default taken while the column holds NOTHING is a default taken on no
evidence — a board drawn before its results arrive, or a filter narrowed to nothing, has
an empty Done like every other column, and without the term it shut Done for good and
handed the work back folded when it turned up. That is `collapseNewParents`' own "a model
that has not loaded is not a vault with no notes", one projection over. It also states
this note honestly: it is about finished work taking a stage's room, and no work takes
none.

Finished is asked of the COLUMN, never of `item.subtreeDone`. That field is built on
`item.done`, the requirements reading, so on the Deliverables board a Deliverable finished
in its own workflow reported open work unless its `status` happened to agree, and this
default never fired there at all — the third appearance of the trap `ownWorkflowReading`
exists for, found by review (Codex, PR #140). `col.done` is the same answer arrived at
more cheaply and it cannot drift: `workflow.stateOf` is what put the card in the column.

**The empty no-state strip is offered no fold, by either surface.** It is already a 44px
box with nothing in it, so a fold would swap its dashed frame for a solid one, persist a
choice nobody could watch themselves make, and shut out the first stateless card to arrive.
`emptyNoState` (`src/domain/board.ts`) is the one test, asked by the header and by the
menu. Found by review (Codex, PR #140), and the second time these two surfaces disagreed
about availability — which is what turned the shared condition into a shared predicate.

**The two surfaces go dark together.** The disclosure disables itself while a filter runs
(`renderChevron`), and so does the menu entry. They shared a builder and still came apart
on this, because the filter override makes `columnCollapsed` answer false: a folded column
offered an enabled Collapse that wrote a fold nothing on screen could show, discovered only
when the search was cleared. Same review.

**What a fold removes.** A folded column contributes no cards to the `BoardSnapshot`, and
that one line is what keeps the keyboard honest — `boardPosition`, `nextBoardPosition` and
Alt+arrow all walk that snapshot, so nothing selects a card the fold took off screen. Both
advisories keep asking the unfolded population, or a fully folded board would be told its
work was all done.

**The surfaces.** The header's disclosure is `renderChevron`, the control every other fold
in the plugin draws, so the filter override, the real `disabled` flag and the focus report
arrive with it. Its keyboard path is the column's own menu, which moved to
`src/view/interactions/columnMenu.ts` when the fold joined it: the menu used to be
withheld from a column with nothing agreed, and every column has a fold now, so it is
unconditional and `menu.ts` — which is about an ITEM — stopped being its home.

**A context card speaks for the results below it and for nothing else.** It joins no
count, and its own state is no part of this board's verdict — the context-row rule — but
its result descendants are the Base's own rows, and under a focus that card can be the
only thing standing for them. It is asked BEFORE the population predicate, which is the
second half of the same report: that predicate is about RESULTS and rejects a context card
for reasons that have nothing to do with the rows below it — this board rejects every
Deliverable, including the context ones its own `visible` deliberately admits. Folding a Done column on its silence took those results off
the board with it, and left no advisory, since the board did hold a card. So the rollup
answers here and the card does not (found by review, Codex, PR #140).

**A selection inside a folded column goes dormant** rather than being cleared — the tree's
own behaviour when a parent above the selected row is collapsed, reached more easily here.
Recorded, not fixed: [[A selection the frame did not draw]].

**Appearance.** `.pbl-board-collapsed` shares `.pbl-board-strip`'s rules in
`styles/board.css`, so a fold and the empty no-state column cannot drift to different
widths.

Measured in the browser harness (`npm run harness`, Chromium, both schemes) rather than
guessed from the markup, and it found a defect reading alone had missed. The folded column
is 44px against the open 260px, the rotated name and the upright count are legible in dark
and light, six folded strips sit side by side with no advisory, and the done column of the
demo backlog folds itself on first render. But a LONG state value overflowed: rotated, the
name grows along the column's height, and a flex item will not shrink below its content —
so at a 220px pane `Waiting on the external review board to sign it off` ran 145px past the
column's bottom and pushed the count outside the box, breaking this note's own "keeps its
name and count visible". `min-height: 0` plus `overflow: hidden` on the folded header is
the fix: the count declares `flex: 0 0 auto`, so the name absorbs the shrink and
ellipsises. `test/view/boardColumnWidth.test.ts` pins the pair as rule TEXT, which is all
a jsdom suite can reach — the layout itself was checked by measuring the rendered page.

What the harness still cannot answer is a themed vault: a community theme replaces these
colours and its own spacing tokens move the geometry. That check is `npm run test-build`
and remains owed (ADR 0020).

Age-based hiding stays out of scope until [[Stamp when work starts and finishes]] gives it
a date to read.
