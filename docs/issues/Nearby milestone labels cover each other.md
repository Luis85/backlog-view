---
type: Issue
order: 10
parent: "[[A milestone line across the plan]]"
status: Open
priority: P3
area: limitation
created: 2026-08-02
source: 2026-08-02 Codex review of PR
files:
  - src/view/render/milestoneLines.ts
  - src/view/render/timeline.ts
  - styles/milestoneLines.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Nearby milestone labels cover each other

## The limitation

Each milestone's line carries a label in the header band, positioned at its own date.
`.pbl-milestone-label` is `position: absolute` with `max-width: 140px`, an opaque
`background-color`, and `text-overflow: ellipsis`. At `DAY_PX = 4`, 140px of label spans
**about 35 days of grid**.

`renderMilestoneLines` appends labels while iterating its by-day map, which is built in
bar order — that is, row order, not date order. Nothing measures a label against its
neighbour. So two milestones with long titles less than roughly 35 days apart overlap,
and the later-appended one paints over the earlier, which may be the one with the earlier
date. The covered label's own hover target shrinks to whatever few pixels stick out, so
the tooltip that would have rescued the name is hard to reach too.

Extension 1b settles the case where two milestones share a **date** — one line, labelled
with both, joined. Nothing settles *near*.

## How it was found

Named as a known follow-up when the feature shipped, then raised independently by Codex
reading the diff of PR #56 — same 35 days, same `DAY_PX`, same row-order painting. That
it is derivable from the code without the note is worth recording: the limitation is
legible in the source, not only in someone's memory of writing it.

## Why it is not fixed yet

**Nobody has looked at it.** Obsidian does not run in CI and jsdom performs no layout, so
every claim about which failure reads worse is currently unmeasured. That matters here
because the candidate fixes fail in different directions:

1. **Clamp each label to the gap.** `renderMilestoneLines` already iterates a map keyed
   by grid offset, so the distance to the next milestone is known at render time:
   `max-width: min(140px, gap)`. Three lines, no change to the header's height, no effect
   on the sticky offset or on `.pbl-today`'s `top: 0`. Trades "covered" for "truncated" —
   and a label truncated to eight pixels is not obviously better than a hidden one.
2. **Pack colliding labels into extra header rows.** What Codex suggested. Reads best
   when it fits, and grows the sticky header band — in a pane where the timeline's own
   guidance is that horizontal space is the scarce resource and the header is already
   competing with the month cells.
3. **Paint in date order and let the earlier win.** Cheapest of all, and merely makes the
   covering deterministic rather than incidental. Possibly enough: "the leftmost label
   always survives" is a rule a reader can learn.

Choosing between these from a static reading of the CSS is how a fix trades a visible
problem for an invisible one. [[Roadmap milestone appearance]] carries the smoke-test
item that asks for the look, with this exact mechanism written into it.

## What changed on 2026-08-14, and what did not

A LOOK finally happened — a vault at 385 results, Months zoom — and it found the adjacent
defect rather than this one: with a single milestone on the grid, the label covered the day
heading of its own date (`28 Sep` reading as `28 S` beneath `Ship the roadmap epic`). Label
versus DATE, not label versus label, and certain rather than occasional: the cell tier carries
one heading per week, so an opaque 140px box reading rightward from a date always lands on one.

That is fixed by moving the label's mount to the COARSE tier — the month and year headings —
where the same box usually covers nothing, since that tier carries one label per month. One
mount point, no extra header row, and `renderCellHeader` now returns both tracks because two
things want opposite neighbourhoods: the drop ghost belongs beside the dates it is read
against, the label belongs where there is room. `roadmapMarkers.test.ts` pins the tier, which
is all jsdom can see — it lays nothing out, so which pixels a 140px box covers stays a
live-vault question either way.

**None of the three candidates above was taken, and this issue stays open.** Two milestones
with long titles inside about five weeks of each other still overlap, in row order, and the
move makes that no better: the coarse tier is emptier but a label is the same width, and two
labels at the same date-ish position collide there exactly as they did below. What the move
did change is the DENOMINATOR — the common case (one milestone, covering a date heading) is
gone, and what is left is the case this note was always about. Candidate 2 (extra header rows)
is still the one that reads best and still crowds the sticky band; candidate 1 (clamp to the
gap) and candidate 3 (paint in date order) are still cheaper and still unmeasured.

## What it is not

Not an accessibility failure. The header band is `aria-hidden="true"`, so no assistive
technology ever reads these labels — a milestone's name reaches a screen reader through
its own row's accessible name, which is unaffected. The line and the diamond still draw
at the correct dates whatever the labels do; what degrades is one visual affordance, and
only when two milestones with long titles fall inside about five weeks of each other.

## Where it lives

`renderMilestoneLines` in `src/view/render/milestoneLines.ts` builds the by-day map and appends
each label into the track `renderTimeline` hands it — the coarse tier since 2026-08-14, for the
reason above; the geometry is `.pbl-milestone-label` in `styles/milestoneLines.css`. (This note
said `src/view/render/timeline.ts` and `styles.css` until then: both were true when it was
written, and both are what the "address code by name, not by position" rule is about — the
module was split out and the stylesheet became partials, and a path outlives neither.) The
header band it crowds is the same one [[The today line swallows a row's clicks]] proposes adding
a label to, which is why those two want deciding together.
