# Enforce the Deliverables invariants at the call

## Context

The Deliverables branch produced the same defect shape three times, across ten review
rounds: **a correct rule applied at one of its surfaces.** Type offers took three rounds
(the chevron picker, then the primary New button, then every card's `New <child>`, then
the focus picker); the toolbar's two readouts took two (the count label was scoped, the
completed toggle beside it was not); the filter's scoping took four before it was
restructured.

Every one was fixed by making the rule one function. None of them is *enforced*: nothing
stops the next surface from reading the raw thing again, which is exactly how each of
these arrived. The root `CLAUDE.md` already names the remedy:

> **A category invariant is checked at the forbidden thing, not by listing the places.**
> "Nothing does X" cannot be verified by driving the paths someone thought of; the next
> path is exactly the one that breaks it. Put the check on the call — a lint rule, or a
> spy on the call itself — so it holds for code not yet written.

This plan does that for the three rules this branch established.

## Global Constraints

- `npm run check` must pass — build, lint, coverage-thresholded tests, fallow, docs
  register. All five, on every task.
- New lint entries follow the existing house style in `eslint.config.mjs`: a named
  `const` with a doc comment saying WHY the raw thing is forbidden and WHAT to call
  instead, added to the per-directory `syntaxRules([...])` list. Match `MENU_ANCHOR`,
  `RENDERED_ROOTS` and `VISUAL_DEPTH` — read them first.
- Every lint rule added must be **demonstrated to fire**: temporarily introduce the
  forbidden spelling, run `npm run lint`, see the error, revert. Report the message.
  A rule that cannot be shown failing is not a check.
- An allowlist of files is acceptable only where the repo already does it
  (`MENU_ANCHOR` exempts `interactions/menu.ts`). Keep it to the files that ask a
  genuinely different question, and say in the comment which question that is.
- Do not weaken or delete an existing test to make a rule pass.
- Sentence-case UI text; no new dependencies.

## Task 1 — Ban `ALL_TYPES` in the view outside `offerableTypes`

**The rule:** a projection offers only the types it can show. `offerableTypes`
(`src/view/interactions/menu.ts`) is the one statement of it, and all five type-offering
surfaces call it. Nothing stops a sixth from importing `ALL_TYPES` and iterating it —
which is how the first four arrived.

**Verified precondition:** `ALL_TYPES` is currently read in `src/view/` only by
`interactions/menu.ts`, as `offerableTypes`' default parameter. `toolbar.ts` mentions it
in a comment only. The invariant holds today; this makes it stay true.

**Do:**
- Add a named rule to `eslint.config.mjs` banning the `ALL_TYPES` import in `src/view/**`,
  exempting `src/view/interactions/menu.ts`. Prefer a selector on the import specifier
  (`ImportSpecifier[imported.name='ALL_TYPES']`) so it is caught where it enters the file
  rather than at each use.
- The message must name `offerableTypes` and the reason: the whole vocabulary is not what
  a given projection can show.
- Demonstrate it fires (add an import to `src/view/render/toolbar.ts`, lint, revert).

**Do not:** change any `src/` behaviour. This task is the lint entry and nothing else.

## Task 2 — One population per toolbar readout, checked

**The rule:** every toolbar readout answers for the projection's own population
(`countedPopulation` in `src/view/render/toolbar.ts`).

**The gap:** `renderToolbar` still computes its own count and level breakdown from
`model.results` directly (around lines 106 and 112), while `syncCountLabel` and
`renderCompletedToggle` both use `countedPopulation`. Two sources of truth in one file:
the first render paints an unscoped number that a later pass corrects.

**Do:**
- Make `renderToolbar`'s count text and its `levelBreakdown` tooltip read
  `countedPopulation(host, model)`, so the file has one population.
- Add a test to `test/view/deliverableWorkflowByType.test.ts` asserting the count the
  FIRST render paints already equals what `syncCountLabel` would paint — drive it on the
  requirements board with a Deliverable present, where the two differ if this regresses.
  Assert the level-breakdown tooltip too, since it was the half that had no check.
- Watch the test fail with the source change reverted, and report the failure output.

**Do not:** add a lint rule here — `no-restricted-syntax` cannot express "not inside
`countedPopulation`", and a rule that bans `model.results` in this file outright would
have to exempt the function that legitimately reads it. The test is the check.

## Task 3 — One type-dispatched state accessor, and a ban on the raw fields

**The rule:** which workflow tracks an item is a property of its TYPE. `stateKeyFor`
(`src/domain/board.ts`) already states that for the KEY. The VALUE and the DONE flag have
no such function, so the `isDeliverableType(item) ? deliverable : requirements` ternary is
hand-written twice — `renderStateChip` (`src/view/render/columns.ts`, around lines
414-415) and `stateChoices` (`src/view/interactions/menu.ts`, around line 376). Two
copies of a rule is how the chip and the menu came to disagree in the first place.

**Do:**
- Add to `src/domain/board.ts`, beside `stateKeyFor` and following its comment style, one
  accessor returning the item's own workflow reading — its state value and its done flag
  together, so a caller cannot take half of the pair (the same argument
  `HorizonSource` in `domain/roadmap.ts` already makes; read it).
- Route both call sites through it. Behaviour must not change: the existing tests in
  `test/view/deliverableWorkflowByType.test.ts` cover the chip's value, the chip's done
  styling and the menu's offered values, and must pass untouched.
- Add a lint rule banning `deliverableStateValue` and `deliverableDone` member reads in
  `src/view/**`, exempting the two files that ask a genuinely different question —
  `src/view/cardMoves.ts` (which reads one workflow per move method by design, not by
  type) and `src/view/render/board.ts` (whose `doneOf` is the board's own workflow, also
  by design). Say which question those two ask, in the comment.
- Demonstrate the rule fires, and revert the demonstration.

**Do not:** change `cardMoves.ts` or `render/board.ts` behaviour — their per-board reads
are correct and are the reason the allowlist exists.

## Verification

After all three: `npm run check` green, and each lint rule shown firing on a temporary
violation. The register note `docs/requirements/A board scoped to Deliverables.md` gains
one short paragraph recording that these three rules are enforced at the call rather than
by review — placed with the existing rules it describes, not as a new section.
