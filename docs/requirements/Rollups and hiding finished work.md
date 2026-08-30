---
type: PBI
parent: "[[Progress tracking]]"
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

# Rollups and hiding finished work

**As** someone reporting on a backlog, **I want** each parent to say how much of it is
done and finished branches to get out of the way, **so that** a large tree shows me what is
left rather than everything that ever was.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Any refresh (rollups), or the eye button in the toolbar (hiding) |
| **Preconditions** | A state property is configured, so "done" means something |
| **Guarantee** | A rollup reports the **work** the Base returned — nothing else can change the number, in either direction. The Base's results are the outer bound and a row that is not work is the one thing inside it that does not count. |

**Main flow**

1. On each pass the view walks the tree and counts, for every parent, the descendants that
   are work and how many of them are done. Two kinds of row are walked *through* without
   being counted: one the Base did not return (1a), and one that is not work (1b).
2. Each parent renders that count and its progress.
3. The user presses the eye button to hide completed work.
4. Every subtree that is **entirely** finished stops rendering.
5. Pressing it again brings them back.

**Extensions**

- **1a — the walk reaches a context row** (loaded only to place a result). It is traversed
  **through**, so the results below it are still counted — and never counted **itself**.
  An excluded note's own state can neither skew a progress bar nor keep a finished subtree
  on screen.
- **1b — the walk reaches a marker** (a declared type that is not work — today, a
  milestone). Traversed **through** in exactly the same way and counted no more than 1a is,
  for the opposite reason: the row *is* one of the Base's results, and still is not a unit
  of progress. A date passing must not advance a bar over work that has not moved, nor a
  finished marker make an unfinished subtree read as done ([[Milestones as their own type]]).
  The two exclusions look alike here and must not be collapsed into one predicate — one
  asks whether the row is this base's data, the other whether it is work at all.
- **3a — the quick filter is active.** Hiding is suspended, so a search can find finished
  work.
- **4a — a parent's children all hide but the parent is not done.** It renders as a
  **leaf** — no chevron, no `aria-expanded` — rather than as an expander with nothing
  inside it.
- **4b — a context row's children have all hidden.** The context row hides too: it exists
  only to place a visible result, so it must not leave an empty scaffold behind.
- **4c — the whole tree is done.** An "all done" state renders, saying so and how many
  items it is talking about — not an empty pane.

**Guarantees**

- Hiding is a **render** decision only. The model, the rollups and all order maths keep
  using the full lists, so a hidden row is still a ranking **neighbour**: `model.ranked`
  holds every loaded item whether or not it is drawn, and a placement takes its number
  between the neighbours it finds there. Ranking does not silently change meaning when the
  eye is pressed.

## Acceptance criteria

- Rollups describe what the Base returned, **as work**: a row loaded only for context is
  traversed *through* but never counted. A marker is the second exception and holds for a
  different reason — it is not a row from outside the results but a row that is not work at
  all, so counting it would let a date passing advance a bar over work that has not moved
  ([[Milestones as their own type]]).
- Hiding is a render decision only — ranking still reads the full loaded population.
- A parent whose children are all hidden renders as a leaf, not as an empty expander.
- Structure commands target the nearest *visible* neighbour while hiding is on, so none is
  visually inert.

## Where it lives

`src/domain/viewOptions.ts` (`showCounts`) ·
`src/storage/viewStateStore.ts` (`hideCompleted`) and `src/view/viewState.ts`
(`showCompleted`/`setShowCompleted`) — the eye is working position in the view-state
store, per saved view and per device, never a `.base` setting (ADR 0011, 2026-08-30) ·
`src/domain/model.ts` (`assignAll`, `subtreeDone`) ·
`src/view/rowVisibility.ts` (`rowHidden` — the predicate; `src/view/backlogView.ts`'s
`isRowHidden`/`isRowHiddenUnfiltered` are the `applyFilter` true/false calls into it) ·
`src/view/render/columns.ts` (the rollup cell) ·
`src/view/render/emptyStates.ts` (the all-done state).
Tests: `test/view/visibility.test.ts`, `test/domain/modelContextRows.test.ts`,
`test/view/contextRowWrites.test.ts` (the rollup invariant).

**The release scope hides by its own rule, not by reusing any of the above** (Task 5).
`src/view/release/scopeToolbar.ts` draws the toggle, gated on `release.done.unconfigured` so
it can never hide rows the summary strip refuses to count; `src/view/release/scopeTree.ts`
(`rowsAfterHideDone`, `hideDoneOn`/`setHideDone`) drops each finished subtree. The
predicate it drops by is `ScopeRow.subtreeDone` (`src/domain/releases.ts`), deliberately
NOT `item.subtreeDone` from `src/domain/model.ts`: that field counts every non-marker
descendant the BASE returned, consulting no membership at all, so a done member whose only
unfinished child belongs to another release (or to none) would never hide by it.
`ScopeRow.subtreeDone` asks the same question of THIS release's own population — the same
one every other figure on this screen is measured over — computed in the same walk that
already fills `memberTotal`/`memberDone`, never a second traversal.

- **4d — the stored preference is on and `release.done.unconfigured` on the OPEN
  release.** The toolbar withholds the toggle (its own gate, above), but the reader's
  preference is a single flag for the whole view and outlives any one release — turned on
  while looking at a release where progress works, it is still on when a different release,
  where it does not, is opened next. Applying it there would hide rows with no control left
  on screen to bring them back, so `effectiveHideDone(view, release)` in
  `src/view/release/scopeTree.ts` gates the stored flag on the same figure the toolbar's own
  button is gated on — one function, read by both `drawScopeTree`'s hiding and
  `renderScope.ts`'s all-done check, so the two cannot disagree about the same release. The
  preference itself is never cleared: only its effect is suppressed, and it resumes on the
  next release whose progress is configured.
