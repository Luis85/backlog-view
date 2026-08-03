---
type: PBI
parent: "[[Test harness and coverage]]"
order: 20
status: Open
area: testing
priority: P2
created: 2026-08-03
---

# Coverage where the projections share code

**As** someone changing the card projections, **I want** the branches they *share* covered
before the ones they do not, **so that** a gap cannot fail silently in two projections at
once.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the board or the roadmap |
| **Trigger** | `npm run check` and its coverage thresholds |
| **Preconditions** | None |
| **Guarantee** | The thinnest branch coverage in `src/` is no longer in the code most projections depend on. Thresholds move up with the work and never down to fit it. |

**Main flow**

1. `src/view/interactions/cardDrag.ts` is covered first — **60% branches, the lowest figure
   in `src/`**, in the one controller both card projections ride.
2. `src/view/interactions/tags.ts` follows at 71%, then `undo.ts` at 80% and
   `backlogView.ts` at 80.5%.
3. Each increment raises the matching threshold in `vitest.config.mts`.
4. `npm run check` passes on the new floor.

**Extensions**

- **1a — the uncovered ranges are not arbitrary.** Read in the source rather than inferred
  from their line numbers: `cardDrag.ts:40-57` is the pair of null guards on
  `announceBoardMove` / `announceHorizonMove` — a move announced when the projection
  snapshot is absent; `:157-161` is the drop-time payload check and the item resolution
  that **can miss because a refresh mid-drag dropped the note**, which the code says in as
  many words; `tags.ts:20-22` is `tagChoices` folding the item's own tags into the offered
  vocabulary; `tags.ts:36-39` is the normalization refusal; `undo.ts:102,118` the recovery
  path. Every one is a branch a test has to construct a race or an absence to reach, which
  is why they are the ones left — and why they are worth reaching.
- **1b — the number is chased rather than the branch.** Refused. A test written to move a
  percentage asserts whatever is cheapest to assert. Each increment names the branch it
  covers and what would break if that branch were wrong; a threshold moves because a
  behaviour got checked, never the other way round.
- **3a — a threshold would have to go down.** It does not go down. `vitest.config.mts`
  says so already, and the one time a figure moved down it was because vitest 4 remapped
  v8's byte ranges onto AST nodes — a measurement change with no test lost, recorded in
  that file rather than absorbed.
- **4a — a branch turns out unreachable.** It is deleted, or declared the way
  `.fallowrc.json` declares framework-invoked members. An unreachable branch covered by a
  contrived test is worse than no test: it pins code nothing can execute.

## Acceptance criteria

- `cardDrag.ts` branch coverage is no longer the lowest figure in `src/`.
- Every new test names the branch it covers, and is watched failing without the code it
  exercises.
- Thresholds in `vitest.config.mts` are raised to the new measured floor, and none is
  lowered.
- No test in this work asserts on a coverage number.

## Where it lives

`src/view/interactions/cardDrag.ts` · `src/view/interactions/tags.ts` ·
`src/view/interactions/undo.ts` · `src/view/backlogView.ts` · `vitest.config.mts` ·
`test/view/board.test.ts` · `test/view/tags.test.ts` · `test/view/undo.test.ts`
