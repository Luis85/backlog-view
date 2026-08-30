---
type: Task
order: 20
parent: "[[New cards in place]]"
status: Open
priority: P2
area: view
created: 2026-08-30
source: Decomposition of [[New cards in place]]
files:
  - src/view/render/board.ts
  - src/view/projection.ts
  - src/view/interactions/columnMenu.ts
  - src/view/interactions/keyboard.ts
  - src/i18n/en.ts
  - styles/board.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Creation from the column's three inputs

## Evidence

[[New cards in place]]'s trigger — *"choosing to create from a column, by pointer, menu
or Enter on a selected column"* — and main flow step 1, plus the acceptance criterion
that each column offers creation.

Two of the three shells already exist and are waiting for this.
[[Keyboard, menu and touch]] built the column stop — the selection rests on a column
with no cards and its context menu opens there — and says in its own `## Where it lives`
that *"the column stop's **creation** — Enter and the menu on an empty column — needs
[[New cards in place]]"*. Its acceptance criteria repeat it: an empty board is drivable
by keyboard *"for what exists today; creation from that stop still waits on
[[New cards in place]]"*. So this task finishes a sentence another use case left open,
rather than opening one.

The pointer half has an exact precedent one projection over: `renderBucketHeader` in
`view/render/roadmap.ts` draws a `.pbl-bucket-add` `+` and calls
`promptCreateItem(host, [type], null, { horizon: bucket.value })`.

## Why it matters

The register's rule is one method for one action, however many inputs reach it: a card
move is *"a drop, an Alt+arrow and a menu pick landing on ONE host method, which is the
only place its batch is planned"*. Creation is not a move, but the same rule decides
whether this ages well — three inputs each planning their own creation is three places
for the state preset to drift out of step.

## Approach

1. All three inputs call `promptCreateItem(host, [type], null, { state })` — the method
   [[Creating a card in a column's state]] extends. None of them plans a write beside
   it.
2. **The requirements board only** — [[New cards in place]]'s own precondition since the
   same review. `renderBoard` is one frame with three callers —
   `board.ts` twice, for the requirements and Deliverables boards, and
   `iterationBoard.ts` — so an affordance added to the shared column header appears on
   all three. Neither of the other two is this Task's, and each is wrong for a different
   reason:

   - The **Deliverables** board creates a `Deliverable`, never a focus-dependent type;
     `toolbar.ts` already branches this way (`onDeliverables ? DELIVERABLE_TYPE : …`).
   - The **iteration** board's columns are *buckets*, not states. `BoardColumn.bucket`
     exists precisely because *"a bucket is not its state"*, and two of its buckets hold
     `state: null` while meaning different things — so a state preset read off the column
     would write the wrong thing, or nothing, on two of three columns.

   The affordance is therefore gated on the board's scope, not drawn by `renderColumn`
   unconditionally. Creation on the other two boards is a use case each, and neither has
   been written.
3. The type is the **projection-filtered** one — `newItemType` put through
   `offerableTypes`, which is what `primaryNewType` in `toolbar.ts` already does — and not
   a per-column picker.

   The raw helper is the trap, and copying the roadmap's bucket `+` is how it is reached:
   `newItemType` returns the focus target unfiltered, so a `Deliverable` focus retained on
   the requirements board makes it answer `Deliverable` — a type that board excludes. The
   roadmap's `+` may use it because the roadmap draws every type; this board may not. The
   comment above `offerableTypes` in `toolbar.ts` names this exact case: *"focusing
   `Deliverable` on the requirements board narrows it to roots that board excludes,
   leaving it empty"*, and `offerableTypes` itself says an `Epic` card offering
   `New Deliverable` is *"the same broken creation this function exists to close"*.

   **`offerableTypes` does not close it for `Iteration` today, and the rule to build
   against is the sentence rather than the helper.** `byProjectionType`'s `board` branch
   returns after filtering `isDeliverableType` alone, so the `Iteration`/`Release` filter
   in its final return is never reached on this board; `honouredFocusLevel` rejects only
   `isReleaseType`, so an `Iteration` focus is honoured and reachable. `inPlan` then
   refuses to draw the created note. The requirement here is **a type the board can
   actually draw**, and it is met by fixing that helper rather than by adding a second
   filter beside it — its own comment already states the rule the gap breaks: *"a
   projection offers only the types it can show"*.

   This is not a defect this Task introduces: the toolbar's own `New` button reaches it
   the same way today, through `primaryNewType`. It is
   [[An Iteration focus offers a type the board cannot draw]], which owns the fix and is
   this step's **prerequisite** — not a change this Task carries, and not an untracked
   one either. Both halves found by review (Codex, PR #225).
4. **Configured columns only.** A stray column — `outsideWorkflow` — offers no creation
   while still taking a drop. This is [[New cards in place]] extension 1b, and the
   reasoning lives there rather than here.

   It was briefly this Task's own rule, which was the defect: a decomposition may not
   narrow the acceptance criterion of the use case it came from, and the PBI said *"each
   column offers creation"* with no exception. The exception went onto the use case
   through `adding-backlog-items`, and the criterion now reads *"each **configured**
   column"*. Found by review (Codex, PR #225).
5. `styles/board.css` gains the header button, mirroring `.pbl-bucket-add` in
   `roadmap.css`; the new class joins the hit-target list `touch.css` already keeps.
   No new partial, so no `index.css` ordering question.
6. Two new catalog keys, mirroring `roadmap.newInBucket` and its tooltip. The frame is
   text; the column's own label is the configured state string, which is **data** and
   stays out of the catalog.

## Acceptance criteria

- A `+` on the column header, an entry in the column's context menu, and Enter on the
  empty-column stop each open the same creation flow, in that column's state.
- None of the three appears on the Deliverables board or the iteration board, which share
  the same column frame and would each need a different type or a different placement.
- With a `Deliverable` **or an `Iteration`** focus retained on the requirements board, the
  three offer a type that board can display — never one `inPlan` will refuse to draw. The
  `Deliverable` half holds through `offerableTypes` today; the `Iteration` half does not
  until [[An Iteration focus offers a type the board cannot draw]] is fixed, which this
  Task depends on rather than performs.
- A stray (out-of-workflow) column offers none of the three, while still taking a drop —
  [[New cards in place]] extension 1b.
- The no-state column offers all three, and the note it creates carries no state key.
- The context-row rule holds by construction **and is asserted**: the entry points pass
  `parentItem: null`, so the `outsideFilter` folder trap in `promptCreateItem` is
  unreachable from a column — a claim that gets a test rather than a comment, in
  `test/view/contextCardWrites.test.ts` where the other card entry points are already
  driven.
- Coverage thresholds move up, never down.

## Risks

The keyboard path is the one a drag cannot reach, and the register already learned that
here: `contextCardWrites.test.ts` exists because *"a keyboard can select what a drag was
never wired to pick up"*. A test that drives only the `+` would pass while Enter writes
to something the drag was never allowed to touch.

## Outcome
