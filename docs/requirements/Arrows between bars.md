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
| **Trigger** | The dated timeline renders with the dependency key configured and at least one edge whose dependent renders — with two bars it draws, with one it is still stated on the dependent's row |
| **Preconditions** | Roadmap mode is on with the dated axis ([[Horizons or dates]]), and the dependency property is bound ([[Dependencies as a property]]) |
| **Guarantee** | Every arrow drawn has two bars on screen, and every dependency of a **rendered** dependent is stated by its own row whether or not an arrow is drawn. A dependent the reader's own controls removed from the roadmap has no row, and nothing is promised on its behalf. Nothing about an arrow is written, inferred onto a note, or reachable only under a pointer, and no arrow adds a place the keyboard has to stop. |

**Main flow**

1. Each readable edge whose prerequisite and dependent each have **some part of a bar** in
   the drawn window draws one arrow, from the prerequisite's end to the dependent's start.
   Some part, not the whole: a span crossing the window's edge is drawn clipped, and 1h is
   what its arrow anchors to.
2. An edge whose dependent starts **on or before** the day its prerequisite ends draws as
   a **conflict** — the arrow marked, and the dependent's row marked with it, so the
   contradiction is visible without hunting for the arrow that caused it. On or before,
   not before: an end is inclusive here, which is what makes a one-day span one day wide,
   so a dependent starting the same day occupies a day its prerequisite is still running.
3. Every dependent row's accessible name names what it waits for, and says when one of
   those is in conflict — so the ordering is available to a reader who never sees a pixel
   of the arrow layer.
4. The arrows redraw with the bars, one element per edge, and nothing about them is
   written anywhere.

**Extensions**

- **1a — the prerequisite has no bar.** Shelved for want of readable dates
  ([[The unplaced shelf]]), hidden by the reader's own controls, collapsed into a lane
  ([[Lanes on the roadmap]]), or lying wholly outside the drawn window
  ([[Zoom and the today marker]]). No arrow: an arrow needs two ends and the view has one.
  The dependency is still stated by the dependent's row, per step 3, which is the whole
  reason step 3 is not a nicety. Re-aiming the arrow at a visible ancestor instead would
  draw an ordering no note states.
- **1b — the *dependent* is the end with no bar.** No arrow either, and — where it was the
  reader's own narrowing that removed it, the quick filter or "Show completed items" — no
  row to carry the dependency on, since a hidden item is filtered out before anything is
  projected. So this branch promises nothing and the guarantee says so: restoring the
  control restores the row and its statement with it, which is the same bargain every other
  fact about a hidden row already strikes. The case where the dependent *does* render but
  its bar does not — shelved for want of dates — is 1a's answer, from the other side: the
  shelf card is its row.
- **1c — either end is outside the Base's filter.** No arrow. An arrow across the results
  is a thing derived from the results, and a context row is never a source of one — the
  same rule that keeps a context milestone from drawing a line. The dependent's row still
  states it, because that is what its own note says.
- **1d — the edge is marked broken.** Unresolvable, self-referential or part of a cycle
  ([[Dependencies as a property]], where a cycle marks **every** entry in it rather than
  picking one): no arrow, and the dependent's row carries the broken
  marker. An arrow drawn from a name that resolves to nothing would be a claim about a note
  that does not exist.
- **1e — one end is a milestone.** The arrow meets the diamond at its date. A marker is a
  point, so both of its ends are the same day; nothing else about the drawing changes.
- **1f — the two bars are on the same row, or so close the arrow has no room to route.**
  The arrow still draws, at the minimum geometry the grid allows — the dates are the fact
  and the pixels are the zoom's, the rule [[Bars from two dates]] already applies to a
  narrow span.
- **1g — the end the arrow leaves from, or arrives at, is open.** An item with one date
  renders one cell wide with its dateless end styled open ([[Bars from two dates]]), so a
  prerequisite with only a start has no stated finish and a dependent with only a target has
  no stated beginning. The arrow still draws — the ordering is a fact somebody wrote, and
  suppressing it would hide a stated dependency to protect an unstated date — and it
  anchors **at the open end itself**, which already carries the vocabulary that says *no
  date here*. Nothing about the anchor claims a coordinate: the open end is the one place on
  a bar that is already drawn as a gap. What such an edge never does is produce a conflict,
  which is 2a's rule and the reason 2a is written about **stated** dates rather than about
  rollups.
- **1h — the anchor is clipped by the window rather than absent.** The arrow still draws,
  anchored at the clipped edge. `barGeometry` clamps an end that runs past the window and
  reports `clippedStart`/`clippedEnd`; only `outside` — nothing of the span in view at all —
  means no bar, and that is 1a's case, not this one. Anchoring at the clamp invents no
  coordinate for 1g's reason exactly: the clipped edge already carries the vocabulary that
  says *this continues beyond what is drawn*, which is the distinction
  [[A milestone line across the plan]] settled when it gave a clipped end a **direction** to
  claim and refused a point beyond the edge a **date**. Suppressing instead would delete a
  stated ordering at some zoom levels and restore it at others, the same trade 1g refused.
  What the window must never reach is the **conflict**: that comparison is between the two
  notes' own dates, never between the coordinates the drawing clamped them to, so a
  prerequisite finishing past the right edge is late against a dependent inside the window
  exactly as it would be with both on screen. Zooming changes what can be seen and never
  what is true.
- **2a — one of the two dates being compared is not one its note states.** Not flagged. A
  conflict is a contradiction between two things somebody wrote, so both dates it rests on
  have to be written down, and an endpoint can fail that in two different ways: **rolled up**
  from a subtree ([[Spans roll up the tree]]), which exists on screen and on no note, or
  **absent**, which is the open end 1g draws. Neither is a date to be late against — one is
  a drawing and the other is a gap.
  The suppression is **per end, not per item**. Only two dates take part — the
  prerequisite's end and the dependent's start — and a bar carries `inferredStart` and
  `inferredEnd` independently of each other and independently of whether the opposite end is
  open at all, so a parent with a stated target and a rolled-up start has a perfectly real
  end to be late against. Judging the item rather than the two ends would hide a
  contradiction between two persisted dates on the strength of a third nobody compared.
- **2b — the dependent is shelved and the prerequisite is dated.** Decided at the start it
  states, not at the fact that it shelved — saying "shelved" here would undo 2a one
  extension after writing it, because *shelved* is a verdict on the whole span and a
  conflict rests on one end of it. Where the shelf came with no start to compare — no dates
  at all, or a start the reader refuses — there is no conflict, and that is the true reason:
  "unplanned" is not "late". The two remaining ways to shelve leave a **stated, readable
  start** on the note and shelve for what the *other* end says: an unreadable target, or a
  target before the start ([[Bars from two dates]]). That start is as persisted as any date
  on any bar, so a dated prerequisite running past it is the same contradiction between two
  written dates 2a is about, and it is stated — on the shelf card, which 1b already
  establishes is the dependent's row, and with no arrow, because there is still no bar for
  one to reach. Suppressing it would hide a contradiction on the strength of the very date
  the card is already complaining about, and would hide it exactly when the user is looking
  at those two dates to fix them.
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
- Every dependency of a rendered dependent is stated by its row whether or not an arrow was
  drawn, and a conflict is stated there too — no fact about an ordering is available only by
  looking at, or hovering, the arrow layer. A dependent the reader's controls have hidden is
  outside this criterion: it has no row, and restoring the control restores both.
- A dependent starting on or before the day its prerequisite ends is marked as a conflict —
  on or before, because an end is inclusive. A conflict rests only on dates the two notes
  state: an end that is rolled up, and an end that is absent, both suppress it, judged at
  each of the two ends the comparison uses rather than at the whole span. A shelved
  dependent is judged by that same rule and not by having shelved: exempt when it has no
  readable stated start, in conflict when it has one and its prerequisite runs past it,
  stated on the shelf card with no arrow drawn.
- An arrow whose anchor is an open end still draws, anchored at that open end; no arrow
  anchor implies a date, and an unstated endpoint never becomes a stated one by being
  pointed at. A clipped end is the same: some part of a bar in the window is enough to
  anchor one, and only a span with nothing in view suppresses an arrow.
- No conflict verdict depends on the window. The comparison is between stated dates, not
  between the clamped coordinates a clipped bar draws at, so zooming or panning never
  creates a conflict and never clears one.
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
