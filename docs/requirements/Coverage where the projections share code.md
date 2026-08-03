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
2. Each increment raises the matching threshold in `vitest.config.mts`.
3. `npm run check` passes on the new floor.

**This PBI is one module.** `tags.ts` was in an earlier draft and came out: a review
showed that its refusal branch is **already tested** (`test/view/tags.test.ts` submits
`123` and asserts the Notice), and that the own-tag fold may not be reachable in
production at all — `collectObservedTags` already carries every editable result's tags,
and a context row is not offered tag editing. Writing to that draft would have produced a
duplicate test and a contrived host state, which extension 1c refuses.

**Nothing replaces it here.** `tags.ts`, `undo.ts` (80%) and `backlogView.ts` (80.5%) each
need someone to read the branch before promising it — the same reading that corrected this
note twice. They get their own note when that reading has been done.

**Extensions**

- **1a — the uncovered ranges are not arbitrary.** Read in the source, and stated as the
  behaviour the branch produces rather than as the line it sits on:
  - `cardDrag.ts:40` and `:57` — `announceBoardMove` and `announceHorizonMove` **return
    without announcing** when their projection snapshot is absent. The branch is the
    **silence**, so the test asserts that nothing was announced. A test written from a
    looser description could assert an announcement here and pin the opposite of what the
    code deliberately does.
  - `cardDrag.ts` — the drop whose **item resolves to nothing** because a refresh mid-drag
    dropped the note, which the code says in as many words. That is the reachable branch
    and the one to test: the drop lands, `byPath` misses, nothing is written.

    **The `typeof path === 'string'` guard beside it is not a second target.** `canDrop`
    admits only a source carrying this controller's private `token`, and the one place
    minting that token pairs it with `item.file.path` — a string, always. So the guard can
    never be false at runtime. It also cannot be deleted: Pragmatic hands `source.data`
    back as `unknown`, so the narrowing is what the *type system* requires, not a runtime
    case. A branch that is uncoverable by construction and undeletable by typing is
    **declared, not covered** — the reasoning `.fallowrc.json` uses for framework-invoked
    members. Promising a test for it would produce the contrived adapter state extension
    1c refuses.
  Both need an absence constructed to reach them, which is why they are the ones left.

  **A coverage line number is not a branch description.** Both `tags.ts` entries in an
  earlier draft were wrong — one already covered, one possibly unreachable — because they
  were written from the report's ranges rather than from the source. Read the branch, say
  what it does, then decide whether it is worth a test.
- **1b — the number is chased rather than the branch.** Refused. A test written to move a
  percentage asserts whatever is cheapest to assert. Each increment names the branch it
  covers and what would break if that branch were wrong; a threshold moves because a
  behaviour got checked, never the other way round.
- **1c — a branch turns out unreachable.** It is deleted, or declared the way
  `.fallowrc.json` declares framework-invoked members. An unreachable branch covered by a
  contrived test is worse than no test: it pins code nothing can execute.
- **2a — a threshold would have to go down.** It does not go down. `vitest.config.mts`
  says so already, and the one time a figure moved down it was because vitest 4 remapped
  v8's byte ranges onto AST nodes — a measurement change with no test lost, recorded in
  that file rather than absorbed.

## Acceptance criteria

- `cardDrag.ts` branch coverage is no longer the lowest figure in `src/`, and each
  **reachable** branch named above has a test: the two silent-announcement guards assert
  that **nothing** was announced, and the missed drop asserts that nothing was written.
- The unreachable `typeof path === 'string'` narrowing is declared rather than tested, with
  the reason beside it — the token makes it always true, the `unknown` payload makes it
  necessary. A test that reached it would have had to fake the adapter.
- No criterion here mentions `tags.ts`, `undo.ts` or `backlogView.ts`, and neither does
  the flow. Scope promised is scope checked.
- Every new test names the branch it covers, and is watched failing without the code it
  exercises.
- Thresholds in `vitest.config.mts` are raised to the new measured floor, and none is
  lowered.
- No test in this work asserts on a coverage number.

## Where it lives

`src/view/interactions/cardDrag.ts` · `vitest.config.mts` · `test/view/board.test.ts` ·
`test/view/cardDrag.test.ts`

Only what this note owns — the excluded modules are named in the flow above and
deliberately nowhere in this section. Once [[A module is named where it is specified]]
lands, a path here is a claim that this use case specifies that module, so even a sentence
*explaining* an exclusion must not spell one out: the first draft of this paragraph did,
and reintroduced the ownership it was written to disclaim.
