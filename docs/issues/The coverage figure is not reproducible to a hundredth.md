---
type: Issue
parent: "[[Coverage as a property]]"
order: 10
status: Open
priority: P2
area: verification
created: 2026-08-14
source: Two runs of `npm run check` on an unchanged tree, 2026-08-14, measuring different coverage
files:
  - vitest.config.mts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The coverage figure is not reproducible to a hundredth

`vitest.config.mts` says the thresholds are raised to "what an increment measures", which
presumes an increment measures one thing. It does not.

Three runs of `npm run check`, on a tree where **no file changed between them** (only
`vitest.config.mts`'s own threshold numbers, which coverage does not measure), reported:

| | statements | branches |
| --- | --- | --- |
| run 1 | 98.54% (6687/6786) | 94.87% (4169/4394) |
| run 2 | 98.52% (6686/6786) | 94.85% (4168/4394) |
| run 3 | 98.54% (6687/6786) | 94.87% (4169/4394) |

The denominators are identical, so nothing about the code moved. One covered statement and
one covered branch differ — consistent with a single `if` whose body is one statement being
reached on two runs in three. Two samples would not have bounded the distribution; three do
not either, which is the point: the figure has to be reproducible before it can be a floor.

## Why it matters

The floor is a ratchet with a hundredth-of-a-percent grain, and the instrument feeding it has
a coarser grain than that. Pinning the higher figure makes the gate fail on a green tree,
which is exactly what happened: 94.88 was recorded from run 1 and run 2 failed against it
with nothing to fix. So the ratchet is currently the thing that breaks, not the thing that
catches — and a floor nobody trusts gets lowered by whoever is unblocking CI, which is how a
coverage gate stops meaning anything.

It also makes one class of real regression invisible: a change that genuinely loses one
covered branch is indistinguishable from this.

## What has been ruled out

- **The clock.** Nothing under `src/` reads a time finer than a calendar date
  (`todayStamp`, `todayCivil`), and the two runs were minutes apart on one day. The two
  tests that build dates from `new Date()` (`test/view/timelineFurniture.test.ts`'s
  today-plus-three fixture, `test/domain/stamps.test.ts`) would need a day boundary to move.
- **A concurrent edit.** Another session shares this checkout, so this was the first
  suspicion; `find src test -newermt` showed nothing touched between the runs, and an edit
  to `src/` would have moved the denominators anyway.

## The open candidate

An async race in a view test — a branch that lands inside `await flush()` on some runs and
after it on others. The view has a deferred-update path, a busy indicator with an animation
delay, and a `ResizeObserver` the tests stub, all of which have branches whose arrival is a
question of ordering rather than of input.

## How to find it

Run the suite twice with the `json` coverage reporter (already configured) and diff
`coverage/coverage-final.json` per file: the one statement and one branch will name their own
file and line, and the file will name the test. Nothing here needs to be guessed from the
percentages, which is what makes this cheap and worth doing before the next ratchet — the
"measure a set with an instrument that can see all of it" rule in the root guide, applied to
the instrument the gate itself trusts.

Until then the two figures stay at the floor this branch started from — 98.52 and 94.83 —
which both samples clear. That is not a lowered floor; it is a declined rise.
