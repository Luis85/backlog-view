---
type: Task
order: 300
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: the whole suite re-run against a shifted Date, at seven distances
files:
  - test/helpers/window.ts
  - test/helpers/shiftClock.ts
  - scripts/vitest.clock.mts
  - test/helpers/fixtures.ts
  - test/view/timelineFurniture.test.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A fixture dated in the calendar cannot state a position around today

## Evidence

[[One copy of the i18n sweep, not three]] left eight failures at +1095 days and said to
re-measure rather than trust its list. Re-measured: **eight tests in six files**, and the
six were the six it named.

They are all one defect. `timelineWindow` grows to hold every span it draws until the total
exceeds `MAX_TIMELINE_DAYS`, and then clamps to exactly that many days **centred on today** —
`today - 915` to `today + 914`. So "outside the drawn window" is not a date, it is a
position; and a fixture that spells it as `2031-01-04` is true on the day it is typed and
false once the clock arrives. Two OTHER tests had already failed this way on 2026-09-01,
which is what prompted the probe.

`legend.test.ts` had stated the rule in its own header since before any of this —
*"a hardcoded far-future date reads as safely outside the window today and stops being so
once the clock reaches it"* — and derived its two constants correctly. Four other files
did not, and one of them, `edgeCaseVault()`, carried the opposite claim in a comment:
*"Clipped at BOTH edges regardless of what today is … an eight-year span always exceeds
the 1830-day budget."* The budget is what makes the window **clamp**; being **clipped**
needs the span to outreach the clamped window on each side. 2022-01-01 → 2030-12-31 was
clipped at both ends in 2026 and open-start only by 2029. A comment stating a rule is not
a check, again.

## Approach

`test/helpers/window.ts` is the rule with one implementation: `fromToday`, and on top of it
`clampingSpan`, `pastWindow`, `beforeWindow` and `beyondPlan`. A LEAF that imports
`src/domain/` and nothing else in `test/`, because `test/helpers/fixtures.ts` needs it and
the browser harness bundles that file — `roadmap.ts`, where these first went, reaches
vitest through `./view`.

**`beyondPlan` is not `pastWindow`, and that was measured rather than assumed.** A mark past
the window's edge but still inside the long plan's own span draws as an ordinary marker;
only clearing the PLAN gets the beyond-the-grid rendering. Probed at four distances to find
which side of the line each falls on, after the obvious `pastWindow(365)` produced a
milestone that was outside the window and still drew as inside it.

Two cases in `timelineFurniture.test.ts` are PINNED instead (`vi.setSystemTime`), not
derived: the quantity they need is a whole padding month of free room, and a date derived
from today lands on an arbitrary day of an arbitrary-length month. `legend.test.ts` and
`absenceCollision.test.ts` already pin for the same reason.

**The pin has to be reversible, and the first version of it was not.** A bare
`vi.setSystemTime` is not undone by the harness's `vi.useRealTimers()`, so the pin leaked
into a later test in the same file and put a note dated off the real clock back inside the
window — a failure that appeared only at +1460, behind the two it was fixing.
`vi.useFakeTimers({ toFake: ['Date'] })` before it is reversed, and `Date` alone keeps the
view's own timers running.

## The instrument is committed now

`npm run clock` — `PBL_SHIFT_DAYS=1460 npm run clock` — runs the whole suite with `Date`
shifted. Second time it has been needed, and `npm run perf` is the precedent for a
committed tool that reports rather than gates: it is not part of `npm run check`, and both
its files are named in `.fallowrc.json` so `npm run analyze` does not call them dead.

Only `Date`'s no-argument construction and `now()` move. A fixture naming an explicit date
still gets exactly that date, which is the point: the fixture stays put while today moves
under it.

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved.
- The suite passes at **+0, +180, +1095 and +1460 days**: 4554 tests, all four.
- No test loses a question: every change is a fixture's spelling, not an assertion.

## Outcome

Headroom measured, not asserted:

| shift | before | after |
| --- | --- | --- |
| +180 | pass | pass |
| +1095 | 8 failed | pass |
| +1460 | 2 failed | pass |
| +1825 | — | 69 failed, 19 files |

Roughly four years of headroom where there was under three.

## What is left

**The +1825 wall is a different and much larger population**, and this note claims nothing
about it: 69 tests across 19 files, including six this change already touched. They are the
roadmap suites' everyday `2026-08-…` fixtures and `absenceVault()`'s own dates — spans that
sit near today rather than at the window's edges, and that the window happily grows to fit
until today is five years past them. Fixing that is not this shape repeated; it is a
decision about whether those fixtures should be derived at all, or whether the roadmap
suites should pin the clock wholesale. Re-measure with `npm run clock` before starting: the
table above is dated the moment it is written.
