---
type: Bug
parent: "[[Invariants as checks, not conventions]]"
order: 285
status: Done
area: verification
priority: P2
created: 2026-09-02
closed: 2026-09-02
source: "Raised by a review bot against the ported clock helper on PR #237, reproduced
  against `src/domain/noteFields.ts` before it was taken"
files:
  - test/helpers/clock.ts
  - test/verification/frozenClock.test.ts
  - test/domain/stamps.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The frozen day is not frozen east of UTC+12

## What happened

`test/helpers/clock.ts` freezes `Date` at `2026-08-31T12:00:00.000Z` so the suite reads one
day whatever day it runs on. It does not: it freezes the **instant**, and the four tests it
was written for read the **civil date**.

```console
$ TZ=Pacific/Kiritimati node -e "const d=new Date('2026-08-31T12:00:00.000Z');
  console.log(d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate())"
2026-9-1
```

So in UTC+13 and UTC+14 — Pacific/Auckland during daylight saving, Pacific/Kiritimati —
the frozen instant is already 1 September locally, and a contributor there met the same
`npm run check` failure the freeze exists to remove.

## Why

`dateStamp` (`src/domain/noteFields.ts`) builds its stamp from `getFullYear()`,
`getMonth()` and `getDate()`, which are LOCAL. `todayStamp()` and `todayCivil()` go through
it, and every dated projection draws its window around what they return. Faking the clock
pins what `new Date()` IS; it says nothing about which day the host calls that instant.

**CI runs UTC, so nothing was ever red there.** That is what kept it invisible, and it is
the same shape as the defect this repository has already shipped once along a different
axis — one that only one PLATFORM could see. Here it is one ZONE.

## The fix

`process.env.TZ = 'UTC'`, assigned in the setup file **before** the freeze and before
anything constructs a `Date`. Node re-reads the variable on the next `Date` operation, so
the order is what makes it hold. One line: the zone is half of what "one frozen day" means,
and the instant was already the other half.

## The check

`test/verification/frozenClock.test.ts` gains an assertion on the CIVIL date, read through
`todayStamp()` and `todayCivil()` rather than a hand-rolled getter — the readers the plugin
itself uses, so the check is on the path that broke. Watched failing under
`TZ=Pacific/Kiritimati` (`expected '2026-09-01' to be '2026-08-31'`) and passing with the
line restored; the four protected suites were then run green at both extremes,
`Pacific/Kiritimati` and `Pacific/Niue`.

The existing instant assertion stays. It is a different claim and both are load-bearing:
one pins when the suite thinks it is, the other pins what it calls that.

## What pinning UTC would have cost, if it were left alone

**A zone pinned for the whole suite silences the one test that asks whether `dateStamp`
reads a LOCAL date at all.** `test/domain/stamps.test.ts`'s "is the local date, not the UTC
one" builds `new Date(2026, 7, 2, 23, 30)` from local components and expects `2026-08-02`.
Under UTC that instant IS 23:30Z, so `toISOString().slice(0, 10)` returns the same string
the local getters do: the swap the test exists to catch would pass it.

Raised by a review bot against the first version of this fix, and the finding is wider than
it was stated. **CI has always run UTC, so that test has never discriminated there** — it
only had teeth on a contributor's machine west of Greenwich, by luck of where they live.
Pinning the suite to UTC would have removed that last accidental coverage.

The answer is not to leave the suite unpinned. It is to let that one test name its own
zone: it sets `process.env.TZ` to `America/Los_Angeles`, asserts, and restores in a
`finally`, so it discriminates on **every** machine rather than on some. Verified by
mutation — `dateStamp` swapped to `toISOString().slice(0, 10)` fails it
(`expected '2026-08-03' to be '2026-08-02'`), and passes again when restored.

The general rule this is an instance of: **a test that depends on ambient environment is
checking whatever the environment happens to be, which is not the same as checking the
invariant.** Pinning the ambient value is right; the tests that are ABOUT that value have to
set it themselves.
