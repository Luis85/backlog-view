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
