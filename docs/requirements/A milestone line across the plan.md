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
4. The milestone's **row** carries the name and the exact date in its accessible name, the
   way a bar already carries its span — so selecting the row states everything the line
   and the diamond show.

**Extensions**

- **1a — the milestone's date falls outside the window.** No line, and **no diamond
  either**. A bar that runs past the edge clips to it, because part of it is still in view
  and the clipped end says "this continues beyond what is drawn" — which is true of a span
  and can never be true of a point ([[Zoom and the today marker]] owns what the window is).
  Clamping the point to the edge instead would draw a diamond at a date the milestone does
  not have, and a diamond *is* the claim that this is the date; the row keeps the edge mark
  that states a **direction** — the same open-end vocabulary a clipped bar uses, on the
  side the milestone lies past — and its exact date stays in the tooltip and the row's
  accessible name, where 4a already puts it. Shelving it instead is not available and the
  reason is worth stating: the shelf partition is decided in derivation, and the window is
  computed *from* what derivation placed, so a rule that shelved by window would need the
  window before it exists.
- **1b — two milestones share a date.** One line, labelled with both. Two lines a pixel
  apart read as one and quietly misreport the count.
- **1c — the milestone is outside the Base's filter.** It draws no line. A line across
  every result is a thing derived from the results, and a context row is never a source of
  one — it stays context beside the shelf, as the epic's rule requires.
- **1d — the milestone's date is today.** Both lines draw, and they do **not** merge: 1b
  coalesces like with like, and today is not a commitment — a label reading "Today · Ship
  1.0" would say the reader's own clock is something somebody promised. The today line
  keeps its position and its place on top, because it is the one mark on this grid that is
  the reader's own and no plan may hide *now*; the milestone's line is what gives way,
  drawn beside it inside the same day cell, which is room the grid has — a day is wider
  than either mark. Suppressing one instead is what the finding rules out in both
  directions: painted under, the milestone's line is invisible at exactly the date it
  exists to call out, and painted over, today is.
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
- **4a — the reader cannot use a pointer.** Neither the line nor the diamond becomes
  focusable. The timeline's selectable unit is the **row** — one stop, moved by arrow keys
  and pointed at by the scroller's `aria-activedescendant` — and giving the marker its own
  stop would break that single-stop model to carry information the row can carry itself.
  So the row's accessible name is where the milestone's name and date live, and the line
  is decoration marked as such: no fact about a milestone exists only under a hover.

## Acceptance criteria

- Every readable milestone inside the window draws exactly one line, behind the bars, and
  every line drawn has a row rendering the same milestone.
- Two milestones on one date draw one line naming both.
- A milestone outside the Base's filter draws no line and is never counted by one.
- A milestone whose date lies outside the window draws neither a line nor a diamond: its
  row carries the edge mark for the side it lies past and the exact date in its tooltip,
  and no marker is ever placed at a date the milestone does not have.
- A milestone dated today draws its own line beside the today line, both visible and
  neither label merged into the other — the today line keeps its position and stays on top.
- A line hides exactly when its row hides, under the same visibility controls.
- Nothing about the line is written to any note, and no information is available only by
  hovering it: the milestone's name and exact date are in its row's accessible name.
- Neither the line nor the diamond is independently focusable — the timeline keeps its one
  selection stop per row, and the marker adds no second one.

## Where it lives

Not built. The month window and the day-to-pixel geometry are `src/domain/timeline.ts`,
where `barGeometry` clamps both ends into the window and reports `milestone` from the
stated pair alone — so a point beyond the edge currently arrives at the renderer as a
one-day milestone at day 0 or at the last day, which is the shape 1a refuses. The geometry
has to answer "wholly outside" rather than clamping to it: `endDay < 0` or
`startDay > lastDay`, which for a point is exactly "its date is not in the window".
The grid, and the `pbl-today` line this extends, are `src/view/render/timeline.ts`, with
the styling in `styles.css` beside it — where the collision of 1d is a matter of two 2px
marks in a 4px day cell, so the room to draw both is already there and the rule is which
one keeps the pixel. Driven in `test/domain/timeline.test.ts` and
`test/view/roadmapFrame.test.ts`. It waits on [[Milestones as their own type]], which is
what supplies a milestone to draw.
