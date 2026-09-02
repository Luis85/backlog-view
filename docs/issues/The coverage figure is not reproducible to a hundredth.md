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
iteration: ""
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

**The 2026-09-02 sample does not support it** — see below. What varies there is hot
counters in the view-state path, and every cold unit in those same files was exact. An
async race would show as a COLD unit changing, which is the one thing that did not happen.
Left standing rather than ruled out: three runs cannot rule a candidate out any more than
they could rule one in, which is this note's own first sentence about samples.

## The recipe run — 2026-09-02, and what it found

The "How to find it" section below was executed on the merged tree at `b2907c3`: three
`npx vitest run --coverage` runs, sequential, in the foreground, nothing else against the
checkout, `coverage/coverage-final.json` kept from each.

**All four totals were identical to the unit on all three runs** — statements
10933/11030, branches 6841/7140, functions 2834/2836, lines 9078/9095. So the recipe could
not fire: it diffs two runs that disagree, and these agreed. The flip this note is about
did not reproduce in three attempts, which is neither a fix nor evidence of one.

The per-file diff was run anyway, at the level the percentage is actually computed from —
each statement, branch arm and function reduced to covered-or-not, compared across all
three runs:

**Zero covered/uncovered flips, across 176 files and 21,006 units.**

What did differ is HIT COUNTS, in five files:

| | drift across the three runs |
| --- | --- |
| `src/storage/viewStateStore.ts` | e.g. `L388` 21196 / 21182 / 21112 |
| `src/storage/foldKeys.ts` | e.g. `L84` 14029 / 13946 / 13915 |
| `src/view/viewState.ts` | e.g. `L827` 13877 / 13794 / 13763 |
| `src/storage/viewIdentity.ts` | e.g. `L22` 1949 / 1948 / 1937 |
| `src/ui/prompts.ts` | `L18` 299 / 292 / 299 |

**A hit count is not a coverage figure** — the gate reads covered-or-not — so none of this
can move a percentage, and the drift is invisible to `npm run check` by construction. It
is worth recording for what it excludes: every drifting unit is a HOT one (hundreds to
hundreds of thousands of hits), and every unit in those same five files with a count of
1–5 was byte-identical on all three runs. So the instrument is not deterministic, and its
nondeterminism is concentrated exactly where it cannot matter.

Not diagnosed, and deliberately not guessed at: hot-only drift is consistent with several
things (v8 losing increments once a counter's function is optimized, among them) and this
sample distinguishes none of them.

### The instrument, and its test

```js
// Reduce each unit to covered-or-not and compare the three runs — the level the
// percentage is computed at, which raw hit counts are not.
const binar = (cov) => Object.fromEntries(Object.entries(cov).map(([file, d]) => [file, {
  s: Object.entries(d.s ?? {}).map(([k, v]) => `${k}:${v > 0 ? 1 : 0}`).join(','),
  b: Object.entries(d.b ?? {}).map(([k, v]) => `${k}:${v.map((x) => (x > 0 ? 1 : 0)).join('')}`).join(','),
  f: Object.entries(d.f ?? {}).map(([k, v]) => `${k}:${v > 0 ? 1 : 0}`).join(','),
}]));
```

Tested on a known input before its zero was believed, per the root guide's rule: one
statement, one branch arm and one function in `src/storage/viewIdentity.ts` were set to 0
in a copy of run 1's file, and all three were reported as flips. A comparison that saw
only statements would have reported one of the three, which is the shape that has produced
a wrong count here before.

**Not committed.** It runs when two figures disagree, which is a hand operation on a
diagnosis, not a gate — a script in `scripts/` that nothing invokes is dead code, and a
test that reruns the suite under coverage to compare itself is absurd. The block above is
the artifact.

## A different mechanism, observed rather than ruled in

During the absence-counts-and-derived-names plan (2026-08-14), an implementer ran
`npm run check` while a second `npm run check` was already running against the same
checkout, and watched the coverage figure **collapse** — not a hundredth-of-a-percent
swing like the samples above, a much larger drop, consistent with two `v8` processes
writing the coverage output at once. That is neither the clock, a concurrent EDIT, nor the
async-race candidate above: nothing in `src/` moved between the two runs, and what varied
was which process happened to write last, not which branch a test happened to take.

Recorded as an observation, not a diagnosis: nobody has traced which write actually
collided, or checked the mechanism against whatever locking (or lack of it) the coverage
tool holds. It does not rule the open candidate above in or out — a corrupted merge from
two overlapping runs and a single-run async race are compatible failure modes at different
scales, and this note's own standing advice going forward is to run the gate in the
foreground, alone.

## How to find it

Run the suite twice with the `json` coverage reporter (already configured) and diff
`coverage/coverage-final.json` per file: the one statement and one branch will name their own
file and line, and the file will name the test. Nothing here needs to be guessed from the
percentages, which is what makes this cheap and worth doing before the next ratchet — the
"measure a set with an instrument that can see all of it" rule in the root guide, applied to
the instrument the gate itself trusts.

Until then the two figures stay at the floor this branch started from — 98.52 and 94.83 —
which both samples clear. That is not a lowered floor; it is a declined rise.

## What runs now, and what it does not fix

`scripts/coverage-floors.mjs`, since 2026-08-29, as the second half of
`npm run test:coverage`. It reads the coverage file the run just wrote and asks one
question per metric: **how many covered units can this tree lose before the floor
fails?** Under one and it fails the run, naming the metric.

That is this note's own standing advice turned into a gate rather than a paragraph. The
rule was already written down — `vitest.config.mts` states it and had restated it seven
times, by hand, on every raise — and stating a rule is not checking it, which the
register has open under exactly that name. The arithmetic was also wrong once in a way
that mattered: on the day it was added the gate found `lines` pinned at 99.78 with zero
headroom on the merged tree, a red waiting for the next legitimate change.

**It does not diagnose the flake and it is not meant to.** The one-covered-unit swing
this note is about is still undiagnosed, and the recipe above — two runs with the `json`
reporter, diffed per file — is still the way to find it. (It said "below" until 2026-09-02,
when it was run; `How to find it` is above this section, not under it.) What the gate does
is make the flake survivable: a floor with a unit of headroom absorbs the swing, and the
gate is what notices when a floor stops having one.

**And that is why this stays open rather than becoming a code change.** Three runs at
2026-09-02 agreed to the unit, so there is nothing to fix and nothing to name — the flip
is a rare event that a run has to catch in the act. The headroom gate already absorbs it,
which is the whole of what a code change here could do. What is left is to run the diff at
the moment two figures disagree, not to build anything.

It also cannot see a floor raised against a tree that a merge has not produced yet. That
is the other failure mode, it took `main` down on the same day, and
[[Two spec branches predate the use-case gate]] is where it lives.
