---
type: Issue
parent: "[[Reading the grid]]"
order: 20
status: Open
priority: P3
area: limitation
created: 2026-08-14
source: Vault screenshot at 385 results, 2026-08-14 — a red today tick and two weekend bands visible in the names column below the last row
files:
  - styles/timeline.css
  - src/view/render/timeline.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The grid furniture runs under the lead column below the last row

## The limitation

The dated grid's full-height marks — the today line, the milestone lines, the gridlines and
the weekend layer — are absolutely positioned in `.pbl-timeline-content` at `top: 0;
bottom: 0`, so they span the whole scrolled height. Across the ROWS that is invisible,
because every row's own `.pbl-timeline-lead` is sticky, opaque and `z-index: 2`, and covers
whatever passes beneath it — the fix
[[Full-height marks struck through the sticky lead column]] records.

Below the last row there is no row, so nothing covers them. `.pbl-timeline-content` carries
`min-height: 100%` on purpose (the blank grid below the last row has to be a drop target,
which [[Roadmap empty states]] requires), so that strip always exists, and with the grid
scrolled right the marks sitting at content offsets inside the sticky column's own width are
visible there and nowhere else. Seen in a vault at Months zoom: a red today tick and two
weekend bands standing in the names column, below the last band of the resources axis.

It is cosmetic. Nothing is mispositioned — every mark is at its correct date, and the strip
it shows through carries no content to obscure.

## Why it is not fixed

**The covering element cannot be expressed in CSS as the layout stands, and the two ways to
get it are both worse than the defect.**

What is needed is one element that is (a) as tall as the scrolled content and (b) stuck to
the scrollport's left edge — the lead column's own two properties, for the full height rather
than one row. Those two do not compose here:

- `position: absolute` with `top: 0; bottom: 0` gives the height (this is exactly how
  `.pbl-timeline-drop` spans the content), but an absolute box sits at a CONTENT offset and
  scrolls away from the sticky column.
- `position: sticky` gives the horizontal stick, but a sticky box is in flow, so it cannot be
  stretched by `top: 0; bottom: 0`, and `height: 100%` does not resolve — the parent's height
  is `max-content` with `min-height: 100%`, neither of which is a definite length.

So the candidates are:

1. **`display: flex; flex-direction: column` on `.pbl-timeline-content`, plus a
   `flex: 1 1 auto; position: sticky; left: 0` tail.** This is the correct fix and it is
   about six lines. It also changes the layout mode of the grid's most load-bearing
   container, and **jsdom lays nothing out**, so no check in this repository can see whether
   it moved anything: the rows and the sticky header become flex items, and where a block
   overflows a constrained parent a flex item shrinks. That is precisely the shape of
   [[An absence drew on the line below its own name]] — a layout change the whole suite was
   blind to, shipped and reported from a vault. It should be taken with a browser open, not
   without one.
2. **Translate a gutter by `scrollLeft` on every scroll event.** Rejected outright: a scroll
   handler that reads and writes layout per frame is the cost `src/view/CLAUDE.md` forbids,
   for a strip of decoration nobody is looking at.
3. **Stop the marks at the last row** (wrap the rows and the marks in one box, leaving the
   drop overlay on the content). Removes the leak by removing the furniture from the blank
   strip — which is also where a drop into empty space is aimed, so it takes the date
   reference away from the one gesture that region exists for.

Candidate 1 is the one to take. It is left undone rather than done blind, which is the whole
of this note: the fix is known, cheap and unverifiable here, and the defect it fixes is a few
pixels of decoration in a strip with nothing else in it.

## Where it lives

`.pbl-timeline-content` and `.pbl-timeline-drop` in `styles/timeline.css` hold the two halves
of the geometry — the `min-height: 100%` that creates the strip, and the worked example of an
absolutely positioned box spanning the content's full height. `renderTimeline` in
`src/view/render/timeline.ts` is where a tail element would be appended.
