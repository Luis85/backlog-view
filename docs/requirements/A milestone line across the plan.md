---
type: PBI
parent: "[[Milestones]]"
order: 20
status: Open
priority: P3
created: 2026-08-02
source: user request
files:
  - src/domain/timeline.ts
  - src/view/render/timeline.ts
  - styles.css
---

# A milestone line across the plan

**As** someone reading a dated plan, **I want** each milestone drawn as a line down the
whole timeline, **so that** I can see which work falls before and after a fixed date
without tracing across from one row to another.

A diamond on its own row says *when*; a line says *what is on either side of it*, which is
the question a deadline is actually asked. The surveyed trackers draw release markers this
way for that reason, and this view already has the seam: the today line is exactly this
shape, drawn once across the grid from a single date, so the marker is a second instance of
a thing that works rather than a new drawing layer.

The rule that keeps it honest is that the line is never the only place a milestone exists.
It is decoration of a row — [[Milestones as their own type]] renders that row — so
everything reachable by hovering a line is reachable from the row it belongs to, and
nothing about the line is ever written anywhere.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The dated timeline renders with at least one readable milestone inside the drawn window |
| **Preconditions** | Roadmap mode is on with the dated axis active ([[Horizons or dates]]) |
| **Guarantee** | The line is drawing only: it writes nothing, moves nothing, and never carries information its milestone's own row does not. Every line has a row; no milestone is visible only as a line. |

**Main flow**

1. Every milestone whose date falls inside the drawn month window contributes a
   full-height line at that date, behind the bars.
2. The line is labelled with the milestone's name, at the head of the grid where the month
   header already sits.
3. The milestone's own row still renders, with its diamond at the same date — the line is
   a second view of a row that exists, never a replacement for one.
4. Hovering or focusing the diamond names the milestone and its exact date, the way a
   bar's tooltip already does.

**Extensions**

- **1a — the milestone's date falls outside the window.** No line. A bar that runs past the
  edge clips to it, because part of it is still in view; a point outside the window has no
  cell to clip to ([[Zoom and the today marker]] owns what the window is).
- **1b — two milestones share a date.** One line, labelled with both. Two lines a pixel
  apart read as one and quietly misreport the count.
- **1c — the milestone is outside the Base's filter.** It draws no line. A line across
  every result is a thing derived from the results, and a context row is never a source of
  one — it stays context beside the shelf, as the epic's rule requires.
- **2a — the pane is too narrow for the label.** The label truncates and the full name
  stays in the tooltip. Horizontal space is the scarce resource in an Obsidian pane — the
  first-hand lesson the ecosystem's timeline beta reports — so the line survives the
  narrowing and the text is what gives way.
- **3a — "Show completed items" is off and the milestone is done.** The row hides and the
  line hides with it: the visibility rule travels with the item, not with the projection,
  exactly as it does on the shelf. This is the reader's own control and not a rollup —
  [[Milestones as their own type]] keeps a milestone out of every *aggregate*, which is a
  rule about what its status does to other rows and never a claim that its own row
  outlives a filter.
- **4a — the reader cannot use a pointer.** The diamond is the tab stop and the line is
  decoration of it, so no fact about a milestone exists only under a hover. The
  keyboard obligation the epic carries is met by the row, not by the line.

## Acceptance criteria

- Every readable milestone inside the window draws exactly one line, behind the bars, and
  every line drawn has a row rendering the same milestone.
- Two milestones on one date draw one line naming both.
- A milestone outside the Base's filter draws no line and is never counted by one.
- A line hides exactly when its row hides, under the same visibility controls.
- Nothing about the line is written to any note, and no information is available only by
  hovering it.

## Where it lives

Not built. The month window and the day-to-pixel geometry are `src/domain/timeline.ts`;
the grid, and the `pbl-today` line this extends, are `src/view/render/timeline.ts`, with
the styling in `styles.css` beside it. Driven in `test/domain/timeline.test.ts` and
`test/view/roadmapFrame.test.ts`. It waits on [[Milestones as their own type]], which is
what supplies a milestone to draw.
