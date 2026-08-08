---
type: Bug
parent: "[[Reading the grid]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-08
closed: 2026-08-08
source: Reported from a live vault; reproduced and fixed in the browser harness at
  700px wide with the grid scrolled so the today line passes under the lead column
files:
  - styles/timelineFurniture.css
---

# Full-height marks struck through the sticky lead column

## What happened

Two symptoms, one cause.

The today line and the milestone lines run the full height of the grid, absolutely
positioned with `z-index: 1` and `0`. The lead column is `position: sticky; z-index: 2`
and paints an opaque background over them, so the sticky column reads as solid while the
day track scrolls beneath it. It reads as solid **where its own background paints** —
and between one row's lead and the next there was a 1px band that belonged to neither.
That band was `.pbl-card.pbl-timeline-row`'s own `border-bottom`, and a timeline row sets
no `position`, so its border paints in the non-positioned layers, *below* both marks. The
result was a red dash through the title column at every row boundary, and a cyan one per
milestone beside it — visible only once the grid is scrolled far enough for a mark to
pass under the column, which is why it survived the harness screenshots taken at full
width.

The selection ring is the same geometry from the other side.
`.pbl-card.pbl-selected` draws a `box-shadow: 0 0 0 1px` — a ring OUTSIDE the row's
border box, painted in that same non-positioned layer. Its bottom edge therefore falls
inside the NEXT row's band, where that row's sticky lead paints over it: the ring lost
exactly the part of its bottom edge that crossed the title column, and a selected row
read as one whose focus outline had been clipped.

## Fix

Both marks moved into the boxes that were doing the covering, in
`styles/timelineFurniture.css` beside the zebra and hover rules that already tint the
lead separately for the same reason:

- the row separator is drawn by `.pbl-timeline-row > .pbl-timeline-lead` and
  `> .pbl-timeline-track` rather than by the row, so the lead's own border is covered by
  the lead exactly like everything else under the sticky column. Row height is unchanged
  — a stretched flex item fills the line with its outer size, so the border moves from
  around the cells to inside them;
- selection is those same two borders turning `--interactive-accent` plus an inset top
  shadow, with the card's ring suppressed on this row shape by a three-class selector
  that outranks it wherever either sits.

Raising the row instead — `position: relative; z-index: 3` on the selected row — was
tried on paper and refused: it would need the sticky header raised above it in turn, and
it would put the selected row above `.pbl-timeline-drop` (`z-index: 2`), whose whole job
is to take the pointer over the day area while a drag is live. A fix that quietly makes
one row of the grid refuse drops is worse than the ring it repairs.

## Lesson

**A sticky element hides what is behind it only where it actually paints.** The mental
model that broke here was "the lead column covers the grid" — it covers the grid minus
its own borders, minus its margins, minus every gap between it and its neighbours, and
those gaps belong to whichever box does own them. When something must be hidden by a
sticky layer, the thing that hides it has to be *in* that layer: a border on the parent
of a sticky child is not.

The corollary is the second symptom: **an outline drawn outside an element's border box
is drawn in a band the next element owns**, so on any list of sticky-celled rows a
1px ring is a ring the next row can paint over. Both were invisible at full width, and
both took a browser at a narrow viewport with the grid scrolled — the harness's own
purpose, and a reminder that a screenshot proves what it happens to frame.
