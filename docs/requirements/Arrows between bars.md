---
type: PBI
parent: "[[Dependencies]]"
order: 20
status: Done
priority: P2
created: 2026-08-08
closed: 2026-08-08
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
   The two dates compared are **the ones the projection derived for those two ends**, never
   a fresh read of the frontmatter beside it. That one sentence is what keeps the mark and
   the picture agreeing, and it is where three extensions below get their answers instead of
   each carrying a guard: a marker is its target at both ends (1e), an end the projection
   inferred is not compared at all (2a), and an end no projection derived — because the row
   never reached the axis — is nothing to compare (1c).
3. Every dependent row's accessible name names what it waits for, and marks the conflict
   **on the prerequisite it belongs to** — so the ordering is available to a reader who
   never sees a pixel of the arrow layer, at the same resolution the picture has. A row
   waiting on four things with one contradiction says *which* one, because that is what the
   marked arrow says: a single "in conflict" appended to a list of four names would be the
   picture's information rounded down to a quarter of itself.
4. The arrows redraw with the bars, one element per edge, and nothing about them is
   written anywhere.

**Extensions**

- **1a — the prerequisite has no bar.** Shelved for want of readable dates
  ([[The unplaced shelf]]), hidden by the reader's own controls, collapsed into a lane
  ([[Lanes on the roadmap]]), or lying wholly outside the drawn window
  ([[Zoom and the today marker]]). No arrow: an arrow needs two ends and the view has one.
  Where a control did the hiding — "Show completed items" narrowing the rows the dated axis
  even builds bars from — **no conflict either**, 1c's own suppression for the same reason:
  a prerequisite with no bar was never derived, so there is nothing left of it to compare
  against, and toggling the control back in restores the mark along with the arrow. The
  dependency is still stated by the dependent's row, per step 3, which is the whole
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
- **1c — either end is outside the Base's filter.** No arrow, **and no conflict**. An arrow
  across the results is a thing derived from the results, and a context row is never a
  source of one — the same rule that keeps a context milestone from drawing a line. The
  conflict half needs saying because suppressing only the arrow would leave the verdict
  computed from the excluded note's own dates and painted on a result, which is exactly what
  the context-row rule forbids: it renders, it parents, and that is all. Nothing special is
  needed to get this right — `deriveBars` routes an `outsideFilter` row to
  `RoadmapModel.context` before any span is computed for it, so the projection never derived
  an end there and step 2 has nothing to compare. The dependent's row still states the
  dependency, because that is what its own note says.
- **1d — the edge is marked broken.** Unresolvable, self-referential or part of a cycle
  ([[Dependencies as a property]], where a cycle marks **every** entry in it rather than
  picking one): no arrow, and the dependent's row carries the broken
  marker. An arrow drawn from a name that resolves to nothing would be a claim about a note
  that does not exist.
- **1e — one end is a milestone.** The arrow meets the diamond at its date. A marker is a
  point, so both of its ends are the same day; nothing else about the drawing changes — and
  nothing about the **conflict** changes either, which is the half worth stating, because a
  marker note may still carry a start. `placeMarker` reduces it to `{start: target, target:
  target}` before any span rule runs ([[Milestones as their own type]] 2c: the type ignores
  a stray start, in derivation and not in drawing), so step 2's "the ones the projection
  derived" already compares the target at both ends. A milestone targeting the 10th is not
  late against a prerequisite ending the 5th on the strength of a stale start dated August —
  a date its own type refuses to draw must not be a date it can be marked by.
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
  target before the start ([[Bars from two dates]]) — neither of them reachable by a
  **marker**, whose start is not a date this projection uses at all (1e), so a shelved
  milestone contributes no start here however its frontmatter is spelled. That start is as persisted as any date
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
  drawn, and a conflict is stated there **against the prerequisite it concerns** — so a row
  waiting on several things names which of them contradicts the dates, not merely that one
  does. No fact about an ordering is available only by looking at, or hovering, the arrow
  layer, and none is available at a coarser resolution there than in the picture. A
  dependent the reader's controls have hidden is outside this criterion: it has no row, and
  restoring the control restores both.
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
- A conflict is judged on the dates the projection derived for the two ends, never on a
  re-read of the frontmatter: a milestone is its target at both ends, so a stale start on a
  marker note can neither draw nor mark; an end that crosses the Base's filter was never
  derived, so an excluded note's dates mark nothing on a result — the arrow and the verdict
  are suppressed together, not one without the other.
- No conflict verdict depends on the window. The comparison is between stated dates, not
  between the clamped coordinates a clipped bar draws at, so zooming or panning never
  creates a conflict and never clears one.
- No arrow moves a bar, writes a date, or changes what any note says — rendering the
  roadmap with the dependency key bound writes nothing at all.
- Neither an arrow nor its head is focusable: the timeline keeps one selection stop per
  row.
- The layer is one element per edge.

## Where it lives

**Built.** Which pairs have an edge worth drawing, and which of those contradict their
own dates, is `dependencyArrows` in `src/domain/dependencies.ts` — added beside
`resolveDependencies` rather than in a new module, since that function already answers
1d there ([[Dependencies as a property]]) and the new question is a second pass over the
same item set. Membership in the passed bar list is the whole answer to 1a/1b/1c: an end
that is shelved, hidden, collapsed or outside the filter simply has no bar, so nothing
here re-derives placement.

The conflict rule (main flow step 2, extensions 2a and 2b) is judged per **end**, on a
date the note states — and getting that right the first time did not happen, which is
worth recording plainly rather than folding into "built." 2a already said the rule this
way: an end that is rolled up or absent suppresses the comparison on that side alone. A
plan built from this note read 2b as a *different* rule — "a shelved dependent is never
in conflict" — which is 2a's rule collapsed from "judged per end" down to "judged by
whether the item shelved," and a test was written to that reading and passed review.
Nothing in this note changed: 2b was always 2a's rule asked of the dependent's stated
start instead of its bar, and the code was corrected to what the note already said, not
to a new one. `shelvedConflicts` is that correction — the shelf's own half of the
question, since a shelved dependent has no bar to carry it, read off
`card.item.plannedStart` directly rather than through `bars.ts`, which would close an
import cycle back through `model.ts`.

The row's own marker (1d, and 4d's "visible in one surface") is two things rather than
one, and the split is the point. A conflict tints the lead cell — an accent, the same
red the arrow takes. A BROKEN entry draws no arrow at all, so an accent would be the
whole of it; it gets a glyph in the lead instead, with the row's sentence on its
tooltip, and the conflict raises that same glyph to red rather than adding a second
one. Built as a screen-reader span alone first, which passed every test written for it
and satisfied nothing 4d says: a fact only assistive tech can reach is *reachable*, and
1d asks for the marker to be *carried*. The glyph is also what keeps the fact off
colour alone, which the accent on its own could not.

An edge is routed the way a Gantt chart routes one — **axis-aligned elbows, never a
diagonal** — and which of the two routes applies is a fact about the dates rather than a
style choice. With room between the prerequisite's finish and the dependent's start there
is one turn: out along the finish's row, across at a column just short of the start, then
in. Without it — the overlap that IS the conflict, and the only reason a backward link
exists — the run doubles back, crossing a row BOUNDARY rather than a row — the edge of the
prerequisite's own row, never a midpoint between the two centres, because with one row
between the ends an average lands on THAT row's centre and the run disappears under its
bar. Drawing behind the bars is what makes the lane load-bearing rather than cosmetic:
anything this layer puts under a bar is simply not there.

Every coordinate a route names is held inside the GRID, and the arrival is held a head's
reach inside it. A dependent whose bar begins before the window anchors at day 0, which
is the grid's left edge exactly — and an arrowhead reaches BACK along the run it
terminates, so a tip placed there puts both its strokes under the sticky, opaque lead
column and the clipped edge shows a line with no direction on it. A few pixels in is what
the clipped BAR already does.

Both routes end with a short horizontal run into the start carrying the head, so
an arrow always ARRIVES pointing right whichever direction it travelled, and the head
needs no rotation to say so. One edge is one `<path>` — route and head in a single `d`,
the head two stroked strokes back along the run rather than a shape of its own — which is
what keeps 4a a literal count. It was not, for a day: the elbows shipped as four to six
positioned divs and the test that holds 4a had been narrowed, in the same commit, to
count arrowheads instead of elements. Everything passed and the bound the note states had
stopped being true, which is why the selector that test uses is now the element the layer
costs per edge rather than a feature of one. The layer is created BEFORE the rows and filled after them,
which is what puts every arrow behind the bars: a bar is positioned with no z-index of
its own, so document order decides, and the first version — appended after the rows —
drew a line across every bar it crossed. That is the milestone line's own answer to the
same question, arrived at the same way (by looking).

The layer that DRAWS them is `renderDependencyArrows` in
`src/view/render/timelineArrows.ts` — beside `render/timeline.ts` rather than inside it,
because that file reached its 400-line budget and this is the seam that costs nothing to
cross: everything in the new module is about ONE edge, where it lands and how it reads,
while everything left behind is about the grid the edges are drawn over. `dependencyNote`
travels with them for the reason it exists at all — it is shared verbatim with the shelf
card, which draws no grid, so it never belonged to the grid's module in the first place.

The geometry of one edge is `dependencyAnchor`, beside `barGeometry` in
`src/domain/timeline.ts`: the prerequisite's end day and the dependent's start day, both
read off `barGeometry`'s own clamping rather than restated, so a clipped, open or
milestone anchor (1e, 1g, 1h) is `barGeometry`'s own rule seen from the far side and not
a second case written here. It returns null exactly when neither end has anything of its
own bar inside the drawn window — 1a's other half, a render-time fact no domain edge list
can see.

The drawing is `renderDependencyArrows` in `src/view/render/timeline.ts`, one
`aria-hidden`, pointer-transparent element per edge, in the same absolute idiom the
milestone lines already use — positioned by the day axis on X and by the two rows' own
rects on Y, because two different items' rows have no day-based answer and a guessed row
height is exactly the baseline this repository already learned not to trust; it draws
only after every row exists. What a row **says** is `dependencyNote`, read from a
window-independent `conflicts` map `dependencyArrows` returns rather than from anything
the arrow layer drew — which is what makes "stated whether or not an arrow was drawn"
true for an edge off-window, shelved or filtered, not merely for one on screen. The same
function is called, unchanged, from `renderRowFacts` for a dated row and from
`src/view/render/shelf.ts`'s `renderShelfCard` for a shelved one (1b) — one function
rather than two phrasings of the same fact drifting apart.

The shelf card's own block is gated on the dated axis, not merely on whether it
conflicts (`wiring.axis === 'dates'` in `render/shelf.ts`): it leaked onto the horizon
axis once, where an empty conflicts map suppressed only the red styling and left the
plain "Waits for …" text showing regardless — exactly the promise this note's
Preconditions and [[Dependencies]]'s "It marks damage in one place" both refuse.

The row's conflict mark is an inset shadow in `styles/dependencyArrows.css`, and it sits
on `.pbl-timeline-lead`, never on the row — worth recording because the tree's own
`.pbl-row.pbl-selected` inset idiom does not transfer here unchanged. The lead cell is
`position: sticky; left: 0` with its own opaque background, which paints directly over a
shadow drawn on the row beneath it; a tree row has no sticky opaque child at its edge, so
the idiom that works there renders nowhere on this axis until the shadow moves onto the
one cell that is actually on top.

**Nothing about the drawing has been seen.** jsdom reports every `getBoundingClientRect`
here as zeros, so arrow routing, the arrowhead's direction, whether the conflict red
reads as distinct, how the shelf's dependency block sits beside its shelving reason, and
text wrapping in a narrow card are all unchecked by the suite. `npm run harness` bundles
the real view and the real stylesheet, but its demo fixture carries no `dependsOn` data,
so it draws no arrow out of the box. All of that is now a live-vault item in
[[Smoke test the roadmap]].

Driven in `test/domain/dependencyArrows.test.ts` (which edges draw, which conflict, one
case per extension this note names), `test/domain/timeline.test.ts` (`dependencyAnchor`),
and `test/view/dependencyArrows.test.ts` (the drawn layer, the row's and the shelf's own
statement, and the axis gate).
