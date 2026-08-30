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
2. **The requirements board only.** `renderBoard` is one frame with three callers —
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
   been written. Found by review (Codex, PR #225).
3. The type is `newItemType(host.settings, model)`, resolved as the roadmap's bucket
   `+` resolves it, not a per-column picker. That helper is correct **because** of step 2:
   it is the requirements board's own resolution, and the board this Task draws on is the
   one it is right for.
4. **Configured columns only — and this contradicts the use case as written.**
   [[New cards in place]] says *"Each column offers creation"* and names no exception; a
   stray column — `outsideWorkflow` — is a column. The decision taken during the
   decomposition was to withhold creation there: a stray column exists because a note was
   *observed* holding a value the workflow does not declare, and minting a new note into
   that value is manufacturing it rather than observing it, which the epic's
   *"no state string written that the user did not configure or observe"* reads against.
   Drops still land there, so nothing already in that state is stranded.

   **That decision is not this Task's to hold.** A decomposition may not narrow a use
   case's acceptance criterion — the exception belongs on [[New cards in place]] as an
   extension, written through `adding-backlog-items`, before this Task ships. Until it is
   there, the PBI's criterion is the one that governs and this step is blocked rather
   than merely undecided. Found by review (Codex, PR #225).
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
- A stray (out-of-workflow) column offers none of the three, while still taking a drop —
  **conditional on [[New cards in place]] carrying that exception as an extension.**
  Without it this criterion and the PBI's *"each column offers creation"* cannot both
  hold, and the PBI wins.
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
