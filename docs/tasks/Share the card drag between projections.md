---
type: Task
order: 30
parent: "[[One file per concern]]"
status: Done
priority: P3
area: refactor
closed: 2026-08-02
created: 2026-08-02
source: building [[Moving between horizons]]
files:
  - src/view/interactions/cardDrag.ts
  - src/view/render/roadmap.ts
  - test/helpers/dnd.ts
  - test/view/contextCardWrites.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Share the card drag between the board and the roadmap

## Evidence

The roadmap's first write feature needs a drag, and `boardDrag.ts` already had every
piece of it: the instance token that keeps two split-pane views from stealing each
other's drops, the per-render cleanup list, the draggable wiring that skips context
cards, the edge auto-scroll, and the live region announcements speak through. A
`RoadmapDragController` beside it would have copied about sixty lines of that
verbatim — the shape fallow's duplication check exists to catch, and the shape that
gets fixed in one place and not the other six months later.

What was NOT shared is the one line that mattered: `wireColumn(colEl, column)` reached
into a `BoardColumn` for the value a drop writes.

## Why it matters

A card is the same card in both projections — `createCard` and `renderCardBody` are
already shared — and the gesture is the same gesture. The only thing that differs is
what a region MEANS: a column writes a state, a bucket writes a horizon, the shelf
removes one. That is a difference in the caller, not in the drag.

## Approach

1. `wireColumn(el, column)` becomes `wireDropTarget(el, plan)`, taking what the drop
   means as a callback. The controller resolves the dragged card at drop time — the
   path outlives the model it came from — and hands it over; it never decides a write.
2. `boardDrag.ts` becomes `cardDrag.ts` and `BoardDragController` becomes
   `CardDragController`, because a module named for one projection that wires two is a
   name a reader has to work around.
3. One drop-over class (`pbl-drop-over`) for every card target, replacing
   `pbl-col-drop-over`: the highlight is one decision, not one per projection.
4. `announceHorizonMove` joins `announceBoardMove` there, both over one
   `announceMove` — the live region is a single shared node, and a move should not
   read differently depending on which projection made it.
5. `test/helpers/dnd.ts`'s `boardDrag` becomes `cardDrag` for the same reason, and
   `announced()` moves into it from `test/helpers/board.ts`: it reads the drag
   library's shared region, which both projections speak through.

## Acceptance criteria

- One controller, one live region, one drop-over class; no drag logic duplicated.
- Every existing board test passes with no assertion changed beyond the class rename.
- `npm run check` green.

## Outcome

Done, and it cost one thing the task did not anticipate: the context-row invariant
suite went over its 450-line budget the moment the roadmap's entry points joined the
board's. Splitting it was the right answer rather than the forced one —
`contextRowWrites.test.ts` drives the tree's rows and `contextCardWrites.test.ts`
drives both card projections, which is the same subject seam the source already has.
The two card blocks read alike on purpose: the same three questions — the drag, the
paths a keyboard and a menu reach that a drag cannot, and the structural refusal
behind both — asked once per projection.

`src/view/backlogView.ts` also went over ITS budget, twice, which turned out to be the
useful part of the exercise: three extractions came out of it that were overdue anyway.
`restoreScroll` moved beside `anchorScrollLeft` in `render/projections.ts`, where the
policy it applies already lived; `UndoRecovery.settle` took the "completed or failed
partway" branch out of the view and put it with the recovery bookkeeping it belongs to;
and `matchingPaths` — the quick filter's match-path walk — moved to `domain/model.ts`,
because which rows a needle admits is a question about the tree, leaving the view only
the policy that an empty needle is no filter rather than an empty one. None was on this
task's list; the cap found all three, one per round of review that added a line.
