---
type: Issue
order: 10
parent: "[[A milestone line across the plan]]"
status: Open
priority: P3
area: limitation
created: 2026-08-02
source: 2026-08-02 Codex review of PR #56; independently confirmed a known follow-up
files:
  - src/view/render/timeline.ts
  - styles/timeline.css
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

## What it is not

Not an accessibility failure. The header band is `aria-hidden="true"`, so no assistive
technology ever reads these labels — a milestone's name reaches a screen reader through
its own row's accessible name, which is unaffected. The line and the diamond still draw
at the correct dates whatever the labels do; what degrades is one visual affordance, and
only when two milestones with long titles fall inside about five weeks of each other.

## Where it lives

`renderMilestoneLines` in `src/view/render/timeline.ts` builds the by-day map and appends
each label; the geometry is `.pbl-milestone-label` in `styles.css`. The header band it
crowds is the same one [[The today line swallows a row's clicks]] proposes adding a label
to, which is why those two want deciding together.
