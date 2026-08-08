---
type: PBI
parent: "[[Dependencies]]"
order: 20
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Arrows between bars

**As** someone reading a dated plan, **I want** an arrow from a prerequisite's bar to the
bar that waits on it, **so that** the ordering and the dates are readable in one picture
instead of one of them living in frontmatter nobody opens.

An arrow is drawing, in exactly the sense [[A milestone line across the plan]] settled for
the milestone line: it writes nothing, it moves nothing, and it never carries a fact its
own rows do not. That rule is what makes the second half of this note possible. A plan can
say two contradictory things — *B waits for A* and *B starts on Monday while A runs to
Friday* — and the surveyed trackers answer this by rescheduling B. Here nothing is
rescheduled: the contradiction is **drawn as a contradiction** and left for the person
whose plan it is, because moving B would write a date to a note the user did not touch, on
the strength of a picture.

What is flagged is only what the notes state. A parent's span inferred from its children
([[Spans roll up the tree]]) exists on screen and nowhere else, so a conflict measured
against one would report a date no note carries — a red mark on a fact that does not exist.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The dated timeline renders with the dependency key configured and at least one edge whose ends both have bars |
| **Preconditions** | Roadmap mode is on with the dated axis ([[Horizons or dates]]), and the dependency property is bound ([[Dependencies as a property]]) |
| **Guarantee** | Every arrow drawn has two bars on screen, and every dependency the view knows about is stated by its dependent's row whether or not an arrow is drawn. Nothing about an arrow is written, inferred onto a note, or reachable only under a pointer, and no arrow adds a place the keyboard has to stop. |

**Main flow**

1. Each readable edge whose prerequisite and dependent both render bars inside the drawn
   window draws one arrow, from the prerequisite's end to the dependent's start.
2. An edge whose dependent starts before its prerequisite ends draws as a **conflict** —
   the arrow marked, and the dependent's row marked with it, so the contradiction is
   visible without hunting for the arrow that caused it.
3. Every dependent row's accessible name names what it waits for, and says when one of
   those is in conflict — so the ordering is available to a reader who never sees a pixel
   of the arrow layer.
4. The arrows redraw with the bars, one element per edge, and nothing about them is
   written anywhere.

**Extensions**

- **1a — one end has no bar.** Shelved for want of readable dates ([[The unplaced shelf]]),
  hidden by the reader's own controls, collapsed into a lane ([[Lanes on the roadmap]]), or
  lying wholly outside the drawn window ([[Zoom and the today marker]]). No arrow: an arrow
  needs two ends and the view has one. The dependency is still stated by the dependent's
  row, per step 3, which is the whole reason step 3 is not a nicety. Re-aiming the arrow at
  a visible ancestor instead would draw an ordering no note states.
- **1b — either end is outside the Base's filter.** No arrow. An arrow across the results
  is a thing derived from the results, and a context row is never a source of one — the
  same rule that keeps a context milestone from drawing a line. The dependent's row still
  states it, because that is what its own note says.
- **1c — the edge is marked broken.** Unresolvable, self-referential or loop-closing
  ([[Dependencies as a property]]): no arrow, and the dependent's row carries the broken
  marker. An arrow drawn from a name that resolves to nothing would be a claim about a note
  that does not exist.
- **1d — one end is a milestone.** The arrow meets the diamond at its date. A marker is a
  point, so both of its ends are the same day; nothing else about the drawing changes.
- **1e — the two bars are on the same row, or so close the arrow has no room to route.**
  The arrow still draws, at the minimum geometry the grid allows — the dates are the fact
  and the pixels are the zoom's, the rule [[Bars from two dates]] already applies to a
  narrow span.
- **2a — the conflict is against an inferred span.** Not flagged. The parent's dates are a
  rollup drawn on screen and stated on no note, so the conflict would be between a real
  date and a drawing. Two items that both state their own dates are the case this feature
  is about.
- **2b — the dependent is shelved and the prerequisite is dated.** No conflict either: with
  no start there is nothing to compare, and "unplanned" is not "late".
- **3a — the reader cannot use a pointer.** Neither an arrow nor its head is focusable. The
  timeline's selectable unit is the row, and the milestone line already settled why: adding
  a stop to carry information the row can carry itself breaks the single-stop model for
  nothing. So the ordering lives in the row's accessible name, and nothing about a
  dependency exists only under a hover.
- **4a — the window holds many edges.** The layer costs one element per **edge**, never one
  per pair of rows, so a dense plan pays for the dependencies someone declared and not for
  the rows that happen to be on screen — the render-cost rule `src/view/CLAUDE.md` states.

## Acceptance criteria

- Every arrow drawn has a prerequisite bar and a dependent bar on screen; an edge missing
  either end, or crossing the filter, or marked broken, draws none.
- Every dependency the view read is stated by its dependent's row whether or not an arrow
  was drawn, and a conflict is stated there too — no fact about an ordering is available
  only by looking at, or hovering, the arrow layer.
- A dependent starting before its prerequisite ends is marked as a conflict; a conflict is
  never computed against an inferred span, and a shelved dependent is never in conflict.
- No arrow moves a bar, writes a date, or changes what any note says — rendering the
  roadmap with the dependency key bound writes nothing at all.
- Neither an arrow nor its head is focusable: the timeline keeps one selection stop per
  row.
- The layer is one element per edge.

## Where it lives

**Nothing yet — this note is design.** Which pairs have an edge worth drawing is a
question for `src/domain/bars.ts`, which already answers bar-or-shelf for both what renders
and what a drop predicts, so it is the module that knows which items ended up with bars;
the geometry of the route between two of them belongs beside `barGeometry` in
`src/domain/timeline.ts`, where the window and the day scale already live. The drawing is
`src/view/render/timeline.ts`, in the same absolute, `aria-hidden`, pointer-transparent
idiom the milestone lines and grid rhythm already use, with the conflict styling in
`styles/timeline.css`.
