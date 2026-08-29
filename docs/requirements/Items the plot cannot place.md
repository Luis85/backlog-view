---
type: PBI
parent: "[[The value against effort matrix]]"
order: 20
status: Open
created: 2026-08-17
source: interview, 2026-08-17
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Items the plot cannot place

**As** someone reading the matrix, **I want** the items that have no position to be
counted beside it, **so that** what still needs estimating is visible instead of being
silently absent from the screen I am deciding on.

A point needs two coordinates. An item with a value and no effort has one, and an item
with nothing answered has none — both are ordinary partial profiles, not broken data, and
a plot that dropped them would hide exactly the items somebody still has to estimate.
They sit on a counted shelf beside the plot, the way the roadmap already holds what it
cannot place.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is prioritizing |
| **Trigger** | Opening the matrix on a base whose results are not all fully estimated |
| **Preconditions** | The model resolves without problems |
| **Guarantee** | Every result is on screen. An item is a point or it is on the shelf — never neither — so the count of points plus the count on the shelf equals the number of results, always. |

**Main flow**

1. The matrix draws its points ([[Plotting value against effort]]).
2. The shelf draws beside the plot, carrying every item with no position.
3. Its header says how many, and says which kind each is — missing one axis value, or
   having no total at all.
4. The user opens an item from the shelf, exactly as a point opens one.

**Extensions**

- **2a — the shelf is empty.** It stays on screen and says so. A shelf that exists only
  when occupied is one nothing can reach, and the roadmap already learned that.
- **2b — every item is on the shelf.** The plot draws its axes and its lines with no
  points, and the shelf holds the lot. An empty plot is a true statement about an
  unestimated backlog, not an error.
- **3a — an item is missing one axis value.** It is on the shelf and the shelf says which
  axis it lacks, because that is the one thing somebody has to do to place it.
- **3b — an item has no total at all.** It is on the shelf too, said differently: nothing
  is answered, so no axis is missing in particular.
- **3c — an item's stored total is not current.** That is not a placement question. It is
  plotted or shelved on what the model computes from the scores on the note now, and the
  currency word stays the table's business.
- **4a — the shelf holds more than the space beside the plot.** It scrolls inside itself
  rather than pushing the plot off screen. The plot is what the reader came for and the
  shelf is what they leave with.

## Acceptance criteria

- Points plus shelf equals results, on every fixture — driven as one assertion rather than
  as two counts a reader compares.
- The shelf renders and is reachable when empty, and says it is empty.
- A base with nothing estimated draws the axes and the lines with no points, and every
  item on the shelf.
- The shelf says which axis an item lacks, and says an item with nothing answered
  differently from one missing a single axis.
- The shelf's header carries the count.
- An item opens from the shelf the same way it opens from a point, by pointer and by
  keyboard.
- Nothing on the shelf is written to. It is a reading surface, like the plot beside it.

## Where it lives

The same renderer as the plot, under `src/view/estimation/` — the shelf is the other half
of one drawing, and splitting them across two modules would put the "every item is one or
the other" rule in neither. The classification is a question about an item and not about a
screen, so it is asked in `src/domain/estimationItems.ts` beside the rest of what an
`EstimationItem` already knows about itself, and `src/domain/weightedScore.ts` is what
answers whether there is a total at all.

The precedent is the roadmap's own shelf, which is where "counted, reachable while empty,
and the target that un-places" was settled — here it un-places nothing, because this
projection writes nothing at all.

Tests: a view test for the shelf, and the counting assertion above driven over the
estimation fixtures in `test/helpers/fixtures.ts`.
