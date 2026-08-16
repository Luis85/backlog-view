---
type: Feature
parent: "[[Business value estimation]]"
order: 60
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The value against effort matrix

Items plotted on two configurable axes, with the four quadrants named — quick wins,
strategic bets, fill-ins, reconsider — and a point that opens its item. The quadrant is a
label on a region of the plot, never a property written to a note.

**Each dividing line is a number, defaulting to the midpoint of its axis's declared range**
and settable per axis — two thresholds, one per axis, in this view's own options. Explicitly
**not the median of what is plotted**: a line that follows the population moves when
somebody adds an item, so an item nobody touched changes quadrant because of a neighbour,
and two bases over the same notes cut the same vault in two different places. A midpoint of a
declared range is a statement about the scale, which is what a quadrant name is claiming to
be. A team that means "expensive starts at 4 of 5" says so by moving the line, and the plot
shows where the lines are.

**A thinly estimated item is plotted and marked, never hidden.** The epic leaves the
treatment to this feature and it is chosen here: every item **carrying both axis values**
appears — a point needs two coordinates, and an item with a value and no effort has one — and
its point carries its **coverage** — how much of the model the position rests on — so a point
derived from two dimensions reads differently from one derived from eight without being
argued away. There is **no threshold below which a point is dropped**: hiding an item because
its estimate is thin is the suppression [[The weighted score]] already refused, and it is
worse on a plot, where absence reads as "nothing there" rather than as "not estimated". **An item with no position sits on a shelf beside the plot**, counted and reachable, the way
the roadmap already holds what it cannot place. That is not an exception for broken data: the
effort score is optional like every other, so an item with a value and no effort is an
ordinary partial profile, and a plot that silently dropped it would hide exactly the items
somebody still has to estimate. The shelf holds those and the ones with no total at all, says
which is which, and opens an item like any point does.

**Outcome** — Cheap high-value work and expensive low-value work are visible as positions
rather than as arithmetic, and a position nobody should trust yet says so where it sits.
