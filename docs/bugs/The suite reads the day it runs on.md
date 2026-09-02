---
type: Bug
parent: "[[Invariants as checks, not conventions]]"
order: 320
status: Done
area: verification
priority: P1
created: 2026-09-01
closed: 2026-09-01
source: "Found while acting on a code review of PR #223 — two named failures reported as
  pre-existing turned out to have passed CI the day before, on the same commit"
files:
  - test/helpers/clock.ts
  - test/verification/frozenClock.test.ts
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

# The suite reads the day it runs on

## What happened

`npm run check` fails on a tree nobody changed. On 2026-09-01 two tests were red —
`test/view/legend.test.ts` and `test/view/absenceCollision.test.ts`, one assertion each —
on `main` and on every branch off it. The same commit (`2235c8e`) passed CI in full on
2026-08-31, run 33433103929, with nothing between the two runs but the date.

That is the whole gate, not one step: `vitest run --coverage` writes no coverage file when
a test fails, so `npm run analyze` cannot run either. Six of the seven steps were reachable
and the seventh was not.

Two more tests have the same defect pointing the other way — `roadmapFrame.test.ts`'s
"keeps a milestone's line inside its own day at every zoom" and `roadmapMarkers.test.ts`'s
"draws a milestone dated today beside the today line" both pass on 2026-09-01 and fail on
2026-08-31. So no day makes all four pass by itself, which is what rules out waiting.

## Why

`todayCivil()` is read in the view — `renderRoadmap`'s call in
`src/view/render/projections.ts` — and injected into the domain, so every dated projection
draws its window around the real clock. `timelineWindow` starts that window at today and
stretches it to cover every placed date, padded a month each side.

A fixture with FIXED dates therefore draws a different window on every day it is run. The
August 2026 dates in the two absence fixtures sat inside the window when they were
written; by 2026-09-01 today had moved past them, the window had grown to the right, and
the bar label that had no room to draw suddenly had room. The assertion said the label is
dropped, and the drawing was correct.

The other two are the same fact from the other side. Both build their fixture from
`todayStamp()`, so they follow the clock rather than fighting it — but they assert pixels,
and where today falls inside the window decides them.

## The fix

One frozen day for the whole suite: `test/helpers/clock.ts`, wired as vitest's
`setupFiles`, fakes `Date` alone at 2026-08-31T12:00:00Z. Only `Date` — nothing in `src/`
reads a time finer than a date, and faking the timers wholesale would strand every test
that awaits a real one.

Frozen at the file's TOP LEVEL, not only in a `beforeEach`. A setup file runs before the
test module is imported, and the two roadmap suites compute their `TODAY_ISO` at module
scope; deferred to a hook, the fixture would name the real day while the render drew the
frozen one — the same defect wearing different clothes. The hook is the second half,
because several suites call `vi.useRealTimers()` of their own and the test after one of
those must not inherit the real clock.

Built in LOCAL time, not from a UTC instant — the correction of the first round, raised by
Codex on the pull request. `dateStamp` reads `getFullYear`, `getMonth` and `getDate`, so
what the view calls today is a civil date in the runner's zone, and `2026-08-31T12:00:00Z`
is already 1 September in UTC+12 and east of it. Pinned as an instant, the suite went on
failing for a contributor in Auckland by the very mechanism the freeze was added to remove.
Verified under `TZ=UTC`, `Pacific/Auckland`, `Pacific/Kiritimati` (UTC+14) and
`America/Los_Angeles`.

The day is arbitrary beyond being the last one this suite passed CI on. Moving it means
re-deriving those four assertions, which is the cost that made it worth pinning.

## The check

`test/verification/frozenClock.test.ts` asks the CLOCK, not the four tests. Dropping the
`setupFiles` entry would fail none of them today — it would fail some of them on a day
nobody has reached yet, which is exactly what shipped. Asked at the clock instead, it holds
for tests not yet written, and it also pins the reachable half: an `await` on a real
`setTimeout` still resolves.

It asks for a CIVIL date rather than an instant, and that is the same correction again: the
first version compared `toISOString()`, which passed under `TZ=Pacific/Auckland` while the
two tests it stands for failed. A check that agrees with the defect is not a check.
