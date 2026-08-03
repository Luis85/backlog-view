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
2. `src/view/interactions/tags.ts` follows at 71% — the other module both projections
   share, since a card body renders the same tag pills a row does.
3. Each increment raises the matching threshold in `vitest.config.mts`.
4. `npm run check` passes on the new floor.

**This PBI is those two modules and no more.** `undo.ts` (80%) and `backlogView.ts`
(80.5%) are the next-lowest figures and are deliberately **not** promised here: neither is
code the projections share, which is what this note is about, and listing them in a flow
with no acceptance criterion behind them is a scope that can be silently dropped at
closure. They get their own note when someone has the evidence to write one.

**Extensions**

- **1a — the uncovered ranges are not arbitrary.** Read in the source, and stated as the
  behaviour the branch produces rather than as the line it sits on:
  - `cardDrag.ts:40` and `:57` — `announceBoardMove` and `announceHorizonMove` **return
    without announcing** when their projection snapshot is absent. The branch is the
    **silence**, so the test asserts that nothing was announced. A test written from a
    looser description could assert an announcement here and pin the opposite of what the
    code deliberately does.
  - `cardDrag.ts:157-161` — the drop-time payload check, and the item resolution that
    **can miss because a refresh mid-drag dropped the note**, which the code says in as
    many words. The branch is the drop that resolves to nothing and writes nothing.
  - `tags.ts:20-22` — `tagChoices` folding the item's own tags into the offered
    vocabulary, so a tag the base has never seen elsewhere is still offered on its own item.
  - `tags.ts:36-39` — the normalization refusal, and the Notice that says so rather than
    closing the prompt as if the tag had been added.

  Every one needs a race, an absence or a refusal constructed to reach it, which is why
  they are the ones left — and why they are worth reaching.
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

- `cardDrag.ts` branch coverage is no longer the lowest figure in `src/`, and each of its
  named branches above has a test: the two silent-announcement guards assert that
  **nothing** was announced, and the missed drop asserts that nothing was written.
- `tags.ts` branch coverage covers both named branches — the own-tag fold and the
  normalization refusal with its Notice.
- No criterion here mentions `undo.ts` or `backlogView.ts`, and neither does the flow.
  Scope promised is scope checked.
- Every new test names the branch it covers, and is watched failing without the code it
  exercises.
- Thresholds in `vitest.config.mts` are raised to the new measured floor, and none is
  lowered.
- No test in this work asserts on a coverage number.

## Where it lives

`src/view/interactions/cardDrag.ts` · `src/view/interactions/tags.ts` ·
`src/view/interactions/undo.ts` · `src/view/backlogView.ts` · `vitest.config.mts` ·
`test/view/board.test.ts` · `test/view/tags.test.ts` · `test/view/undo.test.ts`
