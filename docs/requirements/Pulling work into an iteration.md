---
type: PBI
parent: "[[An Iterations board]]"
order: 40
status: Done
priority: P2
created: 2026-08-21
source: user request
started: ""
finished: 2026-08-21
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Pulling work into an iteration

**As** someone planning a sprint, **I want** the uncommitted work on a shelf above the
iteration board, **so that** filling the fortnight is a drag from the backlog into a
column rather than a trip to another projection and back.

The board this describes already draws what is IN the sprint ([[A board scoped to one
iteration]]). What it could not do is put anything there: joining an iteration was
`Set iteration` on a tree row, one item at a time, on a screen that shows none of this
board's own columns. The shelf is the missing half of that board, and it is the roadmap's
own shelf reused rather than a second component — the band that holds what an axis could
not place, over a population that is a LINK rather than an axis.

**The shelf holds the work in NO iteration, not "the work not in this one".** Work
committed to another fortnight is committed; drawing it here would make a pull from the
shelf a silent removal from somebody else's sprint, which is a decision a drag onto a
column does not announce and nobody asked for. Moving work between sprints stays what it
already is: `Set iteration` on the item, which names both ends.

**And it leaves finished work out.** A closed backlog item is not a candidate for the
next fortnight, and a shelf that listed every finished note in the vault would bury the
work that is. Read from the item's OWN workflow, never `item.done`, so a `Deliverable`
finished under its own state property is finished here too.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a card between the shelf and a column on an iteration board |
| **Preconditions** | An iteration scope is chosen and the iteration property is configured. A resolved state key is **not** one: with no workflow the board draws guidance and no columns, so there is nothing to pull into |
| **Guarantee** | One model, one write gate, one undo history. A pull writes the link and the landing state as **one** record on one note; a drop on the shelf writes the link removal and nothing else; a gesture that changes nothing writes nothing. |

**Main flow**

1. On an iteration board the shelf draws above the columns — the horizon board's
   arrangement and for its reason: a card travels from the shelf INTO a column, so its
   source sits above what it feeds.
2. It holds every result that names no iteration, is not finished in its own workflow, and
   is work at all — no marker, no catalog member, no `Iteration` note, no context row.
   They are grouped by type and counted exactly as the roadmap's shelf groups and counts
   its own cards, and each group folds.
3. Dragging a card from the shelf onto a column **joins the iteration and lands in that
   bucket**, in one write on one note: the link (with the iteration's timeframe, as
   [[An iteration's timeframe schedules its items]] already specifies for every join) and
   the bucket's representative state.
4. Dragging a card from a column onto the shelf **takes it out of the iteration**. The
   link is removed and nothing else changes — leaving a sprint is not a state change and
   not a reschedule.
5. The shelf folds from its own disclosure, and opens by default: a shelf a reader has to
   find before they can pull from it answers nothing.

**Extensions**

- **2a — the shelf is empty.** It draws as the bare strip the roadmap's own empty shelf
  draws, revealed while a drag is live so a card taken off the board still has somewhere
  to land.
- **2b — a candidate is hidden by "Show completed items".** It cannot be: that toggle does
  not reach this board (extension 5b of [[A board scoped to one iteration]]), and the
  shelf's own population already excludes finished work — one rule rather than two
  answering for the same card.
- **2d — an item's `iteration` link resolves to a note that is not an `Iteration`.** It
  is on the shelf, exactly as an item whose link resolves to nothing already is. Such an
  item is a card on no board — membership matches the scope's path and a scope may only
  be an `Iteration` — so reading a malformed link as a commitment would hide it from the
  one surface that could reassign it, leaving the note itself as the only way to find it.
  A pull then overwrites the bad link, which is the cleanup.

  **A link to a note the model does not hold stays a commitment**, and the asymmetry is
  deliberate: nothing can say what type an unloaded note is, and calling every unreadable
  target malformed would put a whole vault's committed work on the shelf of any base whose
  filter leaves the other sprints out.

  What this does **not** do is say so on the card. A malformed link draws as ordinary
  untriaged work, where the roadmap's shelf would carry a reason beside it. Recorded as
  the cost rather than fixed: the reason is a second vocabulary — what makes a link
  malformed — and nothing has asked to see it yet.
- **2c — the Base's own search or filter narrows the results.** The shelf narrows with
  them: it is built from `model.results`, so what the base excludes is not offered here.
  That is the search story for a long backlog, distinct from the shelf's OWN search and
  type filter — see 5a for those, present here since 2026-08-21.
- **3a — the card dropped on a column already carries the target bucket's reading.** It
  still joins: the "already here" guard is about a card ALREADY on this board, and a shelf
  card holding `New` dropped on Open changes no state and has every reason to be
  committed.
- **3b — the card dropped on a column is already in this iteration.** The bucket guard
  answers, exactly as it did before this feature: a move onto the bucket the card sits in
  writes nothing.
- **4a — a card already on the shelf is dropped back on it.** Nothing is written. The
  drop is accepted rather than refused, the horizon axis's own rule: such a card may still
  carry an `iteration` key nothing resolves, which is a real thing to clear, and a re-drop
  with nothing to clear plans no write.
- **4b — a bucket has no state to write** (extension 4e of [[A board scoped to one
  iteration]]). It takes no drop, from the shelf or from another column: a column that
  accepted a gesture it cannot express would announce a move it did not make.
- **5a — the shelf's sort, type filter and search.** Present here since 2026-08-21,
  applying the same shared search and hidden-type set the roadmap's own shelf does —
  narrowed off one stored value for both bands, since the box and the filter button are
  on screen here now and a narrowing belongs to the control that shows it. Absent until
  then, and the reason was the keyboard rather than the layout: those three controls are
  `tabindex="-1"` in a one-tab-stop pane and their keyboard path is the card menu's shelf
  section, which was the roadmap's alone.

  **What 5b keeps true regardless is what makes the fix incomplete rather than free.** The
  card menu's shelf section is reachable only from a card ALREADY on this board's keyboard
  walk — a column card — because a shelf card is on no column and the walk never rests a
  selection on one. So an iteration with nothing committed leaves these controls with no
  reachable menu even while the shelf itself still draws cards, and the tab-stop lift
  (`syncShelfTabStops`, `activeShelf`'s `paneHasCards`) counts column cards ALONE for
  exactly that reason: a shelf card keeping the pane "a composite" would leave the reader
  at a `-1` control with nothing on the board that can open the menu to reach it. See 5b.
- **5b — the shelf is reached by keyboard.** It is not. The board's roving selection walks
  its columns, and a shelf card is on no column — so a pull is a pointer gesture, and the
  keyboard path to the same write is `Set iteration` on the item, which every plan row
  already offers in the tree. Recorded as the gap it is rather than described as a
  design: see [[The iteration shelf is out of the keyboard's walk]].
- **1a — the shelf on the product or the Deliverables board.** There is none. Those boards
  are scoped to a kind of work rather than to a time box, so there is nothing for a card
  to be pulled INTO.

## Acceptance criteria

- An iteration board draws a shelf above its columns, holding exactly the results that
  name no iteration, are unfinished in their own workflow, and are neither a marker, a
  catalog member, an `Iteration` note nor a context row.
- Work committed to another iteration is never on the shelf. A link that resolves to a
  note the model holds which is **not** an `Iteration` is not a commitment and the item is
  on the shelf; a link to a note the model does not hold is.
- The roadmap shelf's search and its hidden types narrow this shelf too, since 2026-08-21
  — one stored value for each, shared across both bands rather than the roadmap's own,
  because the search box and the type filter are on screen here now as well and a
  narrowing belongs to the control that shows it. Before then this board carried no such
  control, so applying either here would have hidden work with nothing on screen to say
  why and nothing to clear it with; that reason is gone with the controls themselves.
- Dragging a shelf card onto a bucket writes the iteration link and that bucket's state as
  **one** record on the note, and one undo takes both back.
- A pull whose state already reads into the target bucket still joins the iteration.
- Dropping a board card on the shelf removes the iteration key and leaves the state alone.
- The shelf folds and unfolds from its own disclosure, per saved view and per device, and
  is open until a reader shuts it.
- The product and Deliverables boards draw no shelf.

## Where it lives

The population is `iterationCandidates` in `src/domain/board.ts`, beside the
`iterationBuckets` it is the complement of — in that module rather than
`src/domain/model.ts` because it reads a workflow, and `src/domain/board.ts` is where a
workflow reading is decided. The shelf itself is `renderShelf` in
`src/view/render/shelf.ts` with its header in `src/view/render/shelfControls.ts`, both
reused unchanged in everything but two inputs the caller now supplies: which axis is
drawing (null on a board, which states nothing about dependencies) and what the header
calls this shelf. A third, whether the header carried the picks, existed until
2026-08-21 and is gone with `ShelfInput.picks`: this board's shelf withheld the sort,
type filter and search only because their keyboard path — the card menu's shelf section
— was the roadmap's alone, and once `addShelfSection` served both surfaces no caller
could still pass `false`, so the field had nothing left to distinguish
(`docs/requirements/Cards or a list on the shelf.md` extension 1b). Its fold is a COLUMN fold —
`ColumnScope` `'backlog'` in `src/view/host.ts`, stored by
`src/storage/viewStateStore.ts` through `src/view/viewState.ts` like every other fold —
rather than a view-state value of its own, because a shelf is a foldable band exactly as
a column is; it is not keyed per iteration, since the work in no iteration is the same
population on every sprint. The board draws it in
`src/view/render/iterationBoard.ts`, which also states what a drop on it means. Both
gestures reach the two host methods in `src/view/cardMoves.ts` —
`performIterationBoardMove`, which now carries the join, and `performIterationRemove` —
planning through `computeIterationWrites` and `computeStateWrites` in
`src/domain/writePlan.ts` and applying through `src/view/writeGate.ts` and
`src/storage/frontmatter.ts`. The band's own layout is in `styles/board.css`. Driven in
`test/view/iterationShelf.test.ts`, with the population in
`test/domain/iterationModel.test.ts` and the join planner's four refusals in
`test/domain/iterationDates.test.ts`.

**What the checks above cannot say is what it LOOKS like.** The band was looked at in
`npm run harness` — a temporary fixture with an `Iteration` note, since the demo vault has
none — at 1400x900 in Obsidian's default dark colours: the goal line, the shelf and its
type groups above three columns that still fill the pane. That is the layout answered and
no more. A themed vault's colours, a narrow pane, and the empty shelf revealed under a live
drag are the live-vault check this still owes.
