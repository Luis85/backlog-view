---
type: Issue
order: 10
parent: "[[Move and resize a bar]]"
status: Done
priority: P2
area: design
created: 2026-08-04
closed: 2026-08-04
source: PR #64 — the same alternative proposed three times by review, refused three times, with the reasoning nowhere in the register
files:
  - docs/requirements/Move and resize a bar.md
  - docs/requirements/Drag from the shelf to schedule.md
  - src/domain/timeline.ts
  - src/view/interactions/timelineDrag.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Calendar-cell snapping is refused, and keeps being proposed

## The decision

A gesture on the dated axis writes **whole days, at every zoom**. Zoom changes pixel
density and header granularity only. The one place the zoom's cell supplies anything is
the shelf drop's default *duration* (`cellSpan`), which is a length nobody stated, not an
overwrite of a date somebody did.

The refused alternative is snapping the WRITE to the cell under the pointer: a month-zoom
drop on 20 August writing 1–31 August, a body drag stepping a whole month, an end grip
anchoring to the cell's first or last day.

## Why it keeps coming back

It reads as obvious from the source. `cellSpan`, `timelineCells` and `TimelineScale.unit`
are all right there, the header already draws the cells, and snapping to a grid you are
already drawing looks like the thing the code was reaching for. Three separate review
passes on PR #64 proposed it — as three findings that looked independent (anchor a lone
target at the cell end; snap a new span to the containing cell; step bar gestures by
cells) but are one question with one answer.

This note exists because the answer was recorded only in a scratch ledger. The register
said what the code does and not what was rejected, which is the gap the root guide names:
*a proposal that reads as obvious from the source alone is the one most likely to have
been considered and rejected already.*

## Why days, and not cells

- **Cell snapping makes the write's granularity a property of the VIEWPORT.** The zoom is
  UI state in vault-scoped localStorage — per person, per device, per screen. Two people
  looking at the same base at different zooms would produce different frontmatter from the
  identical gesture, and a note would carry a date that depends on how wide someone's
  split pane happened to be. Nothing about a date property knows what a quarter is.
- **Days are reversible and monotone.** Zoom out, nudge, zoom back, and the date is where
  you put it. A cell step moves a carefully-set date by about ninety days for one nudge at
  quarter zoom, and the way back is not the same gesture reversed.
- **It would restore a deleted rule.** Extension `1f` — the month-end clamp — was removed
  as unreachable precisely BECAUSE steps are days: with no unit larger than a day there is
  no overflow to clamp. Cell stepping brings back a rule the register has already retired,
  and [[A comment that states a rule is not a check]] is what unreachable claims cost.
- **The precision intuition is already honoured, in the right place.** A zoomed-out drop
  does get a coarser answer — `cellSpan` gives it a longer default DURATION. That is a
  value the user never stated. Their stated dates are not rounded to match the zoom they
  happened to be at.

## What is genuinely unanswered

At quarter zoom a day is two pixels, so `Math.round(px / dayPx)` turns ordinary pointer
jitter into half a day, and a reader cannot express "one week" by pointer at that density.
That is real, and it is what the three findings were circling.

It is a **pointer precision** problem, and cell snapping answers it by changing what gets
written — the wrong lever. The honest answers, in order of cheapness:

1. accept that fine adjustment is a week-zoom or month-zoom activity;
2. make the previewed dates legible enough to nudge against, which is what the ghost
   label in [[Smoke test the writable timeline]] is being looked at for;
3. if a live vault says quarter zoom is unusable for gestures, withhold or coarsen **the
   gesture** at that density, or make `quarter` denser.

Never redefine the day.

## Outcome

The decision stands and is now stated where someone proposing the alternative will meet
it. If cells are ever wanted instead, they are a coherent design — but choosing them
reverses three settled decisions and restores a deleted extension, so it must be a
decision taken deliberately, not drifted into one review finding at a time.
