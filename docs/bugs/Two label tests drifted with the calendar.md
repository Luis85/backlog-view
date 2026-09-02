---
type: Bug
parent: "[[Resource absences]]"
order: 50
status: Done
area: view
priority: P2
created: 2026-09-01
closed: 2026-09-01
source: "Found while running `npm run check` for the my-work UX pass, 2026-09-01 — two
  tests failed on a tree neither the pass nor the branch had touched, and failed the same
  way on `origin/main`"
files:
  - test/view/legend.test.ts
  - test/view/absenceCollision.test.ts
  - src/view/render/barLabel.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Two label tests drifted with the calendar

## What happened

`test/view/legend.test.ts`'s "keys no days lost for a crossing whose own sentence never
drew" and `test/view/absenceCollision.test.ts`'s "keeps the sentence reachable even where
the visible label is dropped" both failed on 2026-09-01, on a tree whose last change to
either file, to `render/barLabel.ts` or to anything they render was weeks earlier. Nothing
had been edited; the date had moved.

Both assert that a bar's title label is **dropped** — the state `renderBarLabel` reaches
when there is no room after the mark and the mark begins within `LABEL_RESERVE_PX` of the
track's left edge. Both reach it by the same construction, which that module's own comment
states: *a near-term backlog at quarter zoom*, where the window pads out to ~92 days and
the track to ~184px, under one reserve plus the other.

## Why

"Near-term" was written as fixed dates — 2026-08-01 → 2026-08-10, with the absence at
2026-08-04 → 2026-08-06 — while the window is derived from the bars **and today**
(`todayCivil()`, injected at the view). A month after those days, the window has to hold
both the work and today, the track clears twice the reserve, and the label is drawn. The
assertion is still correct about the behaviour; the fixture had stopped producing the case.

`legend.test.ts` already states the rule the fixtures broke, two constants above the
failing test: dates are *"offset from the REAL clock so the test cannot drift: a hardcoded
far-future date reads as safely outside the window today and stops being so once the clock
reaches it"*. This is that sentence arriving from the other direction — a hardcoded NEAR
date that reads as inside the window today and stops being so once the clock leaves it.

## The fix

Both tests PIN THE CLOCK — `vi.setSystemTime(new Date('2026-08-05T12:00:00Z'))`, and
`setSystemTime` alone so only `Date` is mocked and the view's own timers still run — which
puts today back beside the fixed dates the fixtures already name.

**Fixed twice, independently, and the merge is why this paragraph reads as it does.** The
my-work branch found it first and planted the dates as offsets from `TODAY` instead;
`main` reached it separately (`39b1035`) and pinned the clock. Both close the defect and
the two collided on merge. `main`'s won, on the ground that it is merged and shipped, that
a test whose subject is a WIDTH is better off deterministic than merely relative, and that
one idiom for one problem is worth more than whichever idiom is marginally better — a
suite carrying both would leave the next reader guessing which is the rule here. The
offsets are gone; only this record of them remains.

`absenceVault()` (`test/helpers/resources.ts`) keeps its fixed dates under either fix:
other tests assert those exact days, and only these two have the window's own width as
their subject.

## What it says about the suite

A test whose subject is the WINDOW may not name a date the window is derived from. The
window holds today by construction, so any fixed date is a countdown — and the failure is
silent until it arrives, on a tree nobody touched, in a run somebody else is being asked
to explain. `test/view/roadmapFrame.test.ts`, `roadmapMarkers.test.ts`,
`timelineLeadGeometry.test.ts` and `resourceLanes.test.ts` each say in their own headers
that they read the live clock deliberately; these two read it accidentally.
