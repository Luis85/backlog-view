---
type: PBI
parent: "[[Milestones]]"
order: 20
status: Done
priority: P3
created: 2026-08-02
closed: 2026-08-02
source: user request
files:
  - src/domain/timeline.ts
  - src/view/render/milestoneLines.ts
  - src/view/render/timeline.ts
  - styles/milestoneLines.css
  - styles/timeline.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
It is decoration of a MARK — [[Milestones as their own type]] renders that mark — so
everything reachable by hovering a line is reachable from the mark it belongs to, and
nothing about the line is ever written anywhere. That mark was a row of its own until
2026-08-16 and is a diamond in the milestones' shared row since
([[Milestones in one row on the dated axis]]); the rule is unchanged and only the element
carrying it moved.

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

The window edge is answered in `src/domain/timeline.ts`: `BarGeometry` gained an `outside`
field — `endDay < 0 || startDay > lastDay` — true exactly when nothing of the span is
inside the window, which for a point is exactly "its date is not in the window" (1a).
`barGeometry` still clamps `startDay`/`spanDays` the way a clipped bar needs, but a reader
now has to check `outside` before trusting them for a point. `src/view/render/timeline.ts`
reads it in `barClasses`: an outside bar carries `pbl-bar-outside` plus the open-end class
for the side it lies past, in the same open-end vocabulary a clipped bar already used,
instead of drawing the clamped diamond the old code produced.

The line itself is `renderMilestoneLines` in `src/view/render/milestoneLines.ts`, called
once per render before the bar rows so the bars paint over it. Its own module since
2026-08-14 — it lived in `src/view/render/timeline.ts` until the resources axis's second
dimension pushed that file past its 400-line budget, and this is the piece with the least
to do with the rest of it: the grid draws rows, and this draws one mark ACROSS all of them
from a list of dates. The same move `src/view/render/barLabel.ts` and
`src/view/render/lanes.ts` already made, for the same reason and with no change to what it
does, and its rules moved to `styles/milestoneLines.css` beside it — imported directly
after `timeline.css`, which is where they used to sit, so the cascade is preserved by
position rather than by a comment asking a reader to remember. It groups bars by `geometry.startDay` (1b — two milestones on one
date collect into one entry) after skipping every non-marker bar and every `outside` one,
then draws one full-height `.pbl-milestone-line` per day and one truncating label in the
header, both positioned from the same `--pbl-milestone-left`
custom property so the line and its label never drift apart. **The label goes in the COARSE
tier — the month and year names — and not the day-and-week tier below it**, which is a choice
made on 2026-08-14 from a vault look rather than the arrangement it inherited: the label is an
opaque 140px box reading rightward from its own date, so it covers whatever its tier carries to
the right, and the cell tier carries one heading per week — meaning it covered the heading of
the milestone's own date every time (`28 Sep` reading `28 S`). The coarse tier carries one label
per month, so the same box usually covers nothing. `renderCellHeader` returns both tracks for
that reason, since the drop ghost wants the opposite neighbourhood — beside the dates it is
read against. What this did NOT fix is
[[Nearby milestone labels cover each other]], which is label versus label and stays open.
1d's collision is one LINE WIDTH of the active scale — not a constant, since two fixed pixels
at two pixels per day is a whole day's displacement: a milestone sharing today's day steps its
line aside by that amount rather than
either mark being suppressed, and the day cell is wide enough to hold both — the styling is
in `styles.css`, beside `.pbl-today`, with a comment naming the badge's cyan
(`--color-cyan-rgb`) rather than the purple that is already `.pbl-lvl-1` (Feature). The row's
own accessible name — `${title} — ${dates}` — carries the name and dates together, which is
where 4a's "no fact only under a hover" and the outside row's edge mark both resolve: nothing
about a milestone exists only on the line.

Driven in `test/domain/timeline.test.ts` (the `outside` geometry) and
`test/view/roadmapFrame.test.ts` (the line, the label, the today collision, and the
outside row's edge mark), with `test/helpers/roadmap.ts` carrying `rowFor`, `barFor` and
`labelTexts` for the fixture support the new cases share. [[Milestones as their own type]]
supplies the milestone the line draws.
