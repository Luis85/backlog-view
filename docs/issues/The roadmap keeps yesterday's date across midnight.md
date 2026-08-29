---
type: Issue
parent: "[[Reading the grid]]"
order: 30
status: Open
priority: P3
area: limitation
created: 2026-08-14
source: Codex review of PR
files:
  - src/view/render/projections.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The roadmap keeps yesterday's date across midnight

## The limitation

The reader's own calendar date is read **once per render**, by `todayCivil()` in
`src/view/render/projections.ts` — the single call site, and deliberately so, since
nothing under `domain/` may read a clock and every window and geometry test depends on
`today` being a parameter. Nothing invalidates it. There is no interval anywhere in
`src/`: the three `setTimeout` calls are the collapse-store's save debounce, a drag
cleanup and the prompt's autofocus, none of them a clock.

So a roadmap left open across local midnight goes on drawing yesterday's date until
something unrelated triggers a render — a vault change, a configuration edit, a
projection switch, a fold. **Four things derived from that one value are wrong until
then**, and they are not equally visible:

- **the today line's position** (`todayLeft`, then `.pbl-today`'s left offset) — a
  full-height red line sitting on the wrong day, which is the worst of the four because
  the line's whole job is to say which day is now;
- **the drawn window itself** (`timelineWindow(spans, today)`), which centres and clamps
  around today, so a plan long enough to hit `MAX_TIMELINE_DAYS` clamps around the wrong
  centre;
- **the milestone lines' coincidence nudge**, which steps a milestone aside inside the
  day cell it shares with today;
- **the band header's weeks-away pill** (`awayWeeks(lane.absences, ruler.today)`), which
  asks `today` twice — whether a stretch has ended, and how much of a running one is left —
  so a stretch that ended overnight is still counted, and every running one reports a day
  more than it has. The symbol this bullet named when it was raised (`pendingAbsences`, a
  COUNT of stretches) never shipped: the same commit that added this note replaced the
  header's count with the pill. The staleness is unchanged and reaches the header by the
  same one line.

## Why it is deliberate

**It is not, and that is the honest answer** — it was never decided, only never noticed.
It has been true of the today line since the timeline shipped, and nothing in this
register recorded it until the count made a reviewer look. Recorded now rather than
called deliberate, so the trade-off below is re-decided knowingly rather than
rediscovered by whoever next asks why the line is on the wrong day.

What IS deliberate is the shape that makes it cheap to fix: one call site, injected
downward. The staleness is a property of when that one line runs, never of anything the
domain computes from it.

## What would lift it

A re-render scheduled at the next local midnight, and it belongs **at the call site**
rather than beside any one consumer — all four route through that line, so a fix aimed at
the count alone would leave the today line wrong and read as though the question had been
answered.

Three things make it more than a `setTimeout`, which is why it is not a one-liner:

- the delay has to be computed to the next local midnight and **recomputed each time**,
  never `24 * 60 * 60 * 1000` from a fixed origin: a DST transition moves the boundary by
  an hour, and a fixed period drifts past it.
- it needs the view's own lifecycle. A timer outliving `onunload` re-renders a view that
  is gone, and one base open in two split panes is two views.
- the re-render must not fight the write path. While `applying`, `onDataUpdated` only
  records the update and the gate flushes it in `runExclusively`'s `finally`; a midnight
  render arriving mid-batch would draw a half-applied tree.

Deferring instead — recomputing `today` only when a render is already happening, which is
what the code does now — costs nothing and is what makes this a limitation rather than a
bug.

## Impact

Cosmetic, and cleared by any interaction. A reader who touches the view at all — scrolls,
folds a band, switches a projection, edits a note — gets a correct date immediately, and
a backlog nobody has touched since before midnight is one nobody is reading. The pill's own
error is bounded at one day per band, and shows only where that day crosses a whole week.

The case that would make it matter is a wall display: a roadmap left open unattended, which
is exactly where a today line on the wrong day misleads and where nothing will arrive to
correct it.

**Acceptance criteria:** none; recorded so the trade-off is re-decided knowingly rather
than rediscovered.
