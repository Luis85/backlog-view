---
type: Bug
parent: "[[Resource absences]]"
order: 20
status: Done
area: roadmap
priority: P1
created: 2026-08-14
closed: 2026-08-14
source: Review of the resource timeline, 2026-08-14 — found by reading, confirmed by measuring the drawn geometry
files:
  - src/view/render/lanes.ts
  - src/view/render/timeline.ts
  - test/view/resourceAbsences.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An absence drew at the edge of a window it never widened

## What happened

An absence outside the drawn window is painted **at the window's edge, on a date it does
not cover**, and nothing about the mark says so. Measured on the real render: one bar on
2026-08-01 → 2026-08-10 and one absence on 2029-01-04 → 2029-01-20 in the same row draws
the absence at `--pbl-bar-left: 364px` with `--pbl-bar-width: 4px` — a **one-day stripe on
the last day of the window**, roughly 2026-09-30, visually indistinguishable from a real
one-day absence two and a half years early. The row's accessible name still reads
`unavailable 2029-01-04 → 2029-01-20`, so the two surfaces state different facts.

The worst case is the row an absence **mints** ([[Resource absences]] extension 4b): a
resource nobody has assigned work to has no bars at all, so nothing that row exists to
draw influences the window it is drawn against, and every absence in it is at the mercy of
whatever the *other* rows happened to span.

## Why

Two halves, and each is harmless without the other.

**The window never sees an absence.** `renderTimeline` computes it from the row entries
alone — `entries.flatMap(entry => entry.kind === 'row' ? [entry.row.bar] : [])`, then
`timelineWindow(bars.map(bar => bar.span), today)`. An `absence` entry is not a `row`
entry, so an absence has never been able to widen the grid it is drawn on, however far out
it sits.

**The mark reads none of the geometry it computes.** `renderLaneAbsence` calls
`barGeometry` — correctly, so a stretch and the work it crosses cannot disagree about
which day is which — and then reads `startDay` and `spanDays` and stops. Those two are
already **clamped** into the window; the three fields that say the clamping happened —
`outside`, `clippedStart`, `clippedEnd` — are what `barClasses` exists to read, and the
absence copied the arithmetic without the reading. So the clamp does what it is designed
to do and nobody asks.

`barClasses` states the rule this violates, for bars, in its own comment: *"Drawing the
clamp would put a diamond at a date the item does not have, and a diamond IS the claim
that this is the date."* A filled stripe on a calendar is the same claim.

## The fix

Both halves, because either alone leaves a wrong drawing. The window is computed from every
DRAWN span rather than from the bars — one list built in `renderTimeline` over the entries,
so an absence widens the grid the same way a bar does — and `absenceClasses` in
`src/view/render/lanes.ts` reads the geometry the mark already computes, wearing
`barClasses`' own open-end and outside vocabulary.

The second half stays even though the first makes it nearly unreachable, and that is the
decision rather than belt-and-braces: `MAX_TIMELINE_DAYS` still clamps a window no grid
would draw whole, so the case is rarer and not gone — and a mark drawn on the wrong day was
never detectable from the mark itself, which is what made this ship.

The check is the case with no other surface: the row a lone absence mints, whose window has
nothing else in it. It asserts the true 17-day width AND that the mark wears no
"beyond what is drawn" class, so a fix that clamped more politely instead of widening the
window would fail it.
