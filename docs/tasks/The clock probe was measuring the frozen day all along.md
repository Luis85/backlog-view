---
type: Task
order: 360
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-09-02
closed: 2026-09-02
source: the +1825 wall, re-measured — and the instrument read before the number
files:
  - test/helpers/frozenDay.ts
  - test/helpers/clock.ts
  - test/verification/frozenClock.test.ts
  - package.json
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The clock probe was measuring the frozen day all along

## Evidence

[[A fixture dated in the calendar cannot state a position around today]] left a wall at
+1825 days and said to re-measure before starting. Re-measured on 2026-09-02: **69 tests
across 18 files**, not the 67/17 that note recorded and not the 69/19 `test/CLAUDE.md`
quoted. Three different numbers, which is what that note predicted of its own.

Reading the instrument before acting on the number changed the whole shape of the item.
Three of the sixty-nine were **`test/verification/frozenClock.test.ts` failing at the
shift** — the check that the suite runs on one frozen day. Which raises the question the
open item had never asked: *the suite is already frozen.* `test/helpers/clock.ts` has
pinned `Date` to `2026-08-31T12:00:00.000Z`, for every test file, since 2026-09-01.

So the defect class `npm run clock` was built to hunt — *a test that passes today and
fails on a date nobody chose* — **cannot occur in `npm run check`**, because today does not
arrive. The wall is not latent breakage. It is the price of `clock.ts`'s own closing
sentence: *"Move it and the four tests above must be re-derived, which is the cost that
made it worth pinning rather than following the clock."* Sixty-six tests, not four.

## The instrument was right for a reason nobody had written down

`scripts/vitest.clock.mts` read as REPLACING `setupFiles`:

```ts
export default mergeConfig(base, {
    test: { setupFiles: ['./test/helpers/locale.ts', './test/helpers/shiftClock.ts'] },
});
```

`mergeConfig` **appends** arrays. So the freeze was installed first, `locale.ts` twice, and
`shiftClock.ts` captured the already-faked `Date` as its own `REAL` — meaning
`REAL.now() + DELTA` was the FROZEN instant plus the shift, never the real clock. Measured
rather than reasoned, by asserting the date under each config: `PBL_SHIFT_DAYS=1825` reads
`2031-08-30T12:00:00.000Z` exactly, `PBL_SHIFT_DAYS=0` reads `2026-08-31T12:00:00.000Z`,
and the plain suite reads the same.

The probe was therefore already deterministic — and every artifact describing it said
otherwise. `shiftClock.ts`'s own docstring says it shifts the real clock; so does the
config above it; so did the register. A mechanism whose correctness depends on an
undocumented merge order is one edit from silently becoming a probe that drifts by a day
every day, and the edit that would do it — deleting the duplicated `locale.ts` entry —
reads like tidying.

## Approach

One constant, where two mechanisms were. `PBL_SHIFT_DAYS` moves the frozen day at the
point the day is defined; `test/helpers/shiftClock.ts` and `scripts/vitest.clock.mts` are
deleted, `npm run clock` is `vitest run`, and `.fallowrc.json` loses the two entry points
that existed to stop `npm run analyze` calling those files dead.

**The constant is in a file of its own (`frozenDay.ts`) and that was forced by watching the
check fail.** Deriving `frozenClock.test.ts`'s expectation from `clock.ts` left it GREEN
with the `setupFiles` entry deleted: `clock.ts` freezes at MODULE scope, so importing the
constant installed the freeze, and the check brought its own subject. That test's entire
job is to go red in exactly that case. `frozenDay.ts` imports nothing and does nothing;
`clock.ts` applies it, the check reads it. Watched failing after the split — three
assertions red against the real `2026-09-02`, green again restored, green at +1825.

## Outcome

| | before | after |
| --- | --- | --- |
| failures at +1825 | 69 in 18 files | 66 in 17 files |
| mechanisms | 2 (freeze, shifter) | 1 (freeze) |
| files | `clock.ts`, `shiftClock.ts`, `vitest.clock.mts` | `clock.ts`, `frozenDay.ts` |

The three that left are this suite's own freeze check objecting to the shift it exists to
make possible. Clean at +0.

## What is left, and why it is not work

The sixty-six are the roadmap suites' everyday `2026-08-…` fixtures — spans near the frozen
today, which the drawn window grows to fit until today is five years past them. **They are
not a defect and sweeping them buys nothing**, which is the answer this note gives to the
three options the item offered (derive through `window.ts`, pin the suites wholesale, or
split by what each test is about):

- *Pin wholesale* is already true, one level up, for every test file. There is nothing to
  add.
- *Derive through `window.ts`* is right for a fixture whose premise IS a position — those
  were done in [[A fixture dated in the calendar cannot state a position around today]] and
  are why +1460 is clean. A fixture that merely sits near a frozen today states its position
  by being dated near it, which is already true and already reproducible.
- *Split by what the test is about* has no second half to split off: under a frozen clock
  every one of them is about a fixed calendar month.

So the wall is priced, not paid. It becomes work the day somebody moves the pin, and the
number above is what that would cost. Re-measure before believing it: this figure has now
been wrong three times, each time for a different reason.
