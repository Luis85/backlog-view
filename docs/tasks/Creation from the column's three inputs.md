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
2. The type is `newItemType(host.settings, model)`, resolved as the roadmap's bucket
   `+` resolves it, not a per-column picker.
3. **Configured columns only.** A stray column — `outsideWorkflow` — offers no creation:
   it exists because a note was *observed* holding a value the workflow does not
   declare, and minting a new note into that value is manufacturing it rather than
   observing it. Drops still land there, so nothing already in that state is stranded.
4. `styles/board.css` gains the header button, mirroring `.pbl-bucket-add` in
   `roadmap.css`; the new class joins the hit-target list `touch.css` already keeps.
   No new partial, so no `index.css` ordering question.
5. Two new catalog keys, mirroring `roadmap.newInBucket` and its tooltip. The frame is
   text; the column's own label is the configured state string, which is **data** and
   stays out of the catalog.

## Acceptance criteria

- A `+` on the column header, an entry in the column's context menu, and Enter on the
  empty-column stop each open the same creation flow, in that column's state.
- A stray (out-of-workflow) column offers none of the three, while still taking a drop.
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
