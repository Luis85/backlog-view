---
type: PBI
parent: "[[The value against effort matrix]]"
order: 10
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

# Plotting value against effort

**As** someone deciding what to do next, **I want** the items as points on two axes with
the quadrants named, **so that** cheap high-value work and expensive low-value work are
positions I can see rather than arithmetic I have to do.

Two configurable axes, two dividing lines, four named regions — quick wins, strategic
bets, fill-ins, reconsider. **Each line is a number defaulting to the midpoint of its
axis's declared range**, settable per axis, and explicitly not the median of what is
plotted: a line that follows the population moves when somebody adds an item, so an item
nobody touched changes quadrant because of a neighbour, and two bases over the same notes
cut the same vault in two different places.

A quadrant is a label on a region of the plot. It is never a property written to a note.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is prioritizing |
| **Trigger** | Switching the estimation view to the matrix |
| **Preconditions** | The model resolves without problems, and both axes name a bound property |
| **Guarantee** | A point's position is a statement about the scales, not about its neighbours. Adding, removing or rescoring one item never moves another item's point or changes its quadrant. |

**Main flow**

1. The user switches to the matrix.
2. Both axes draw over their declared ranges, with a dividing line on each at the
   configured threshold — the midpoint of that axis's range until somebody moves it.
3. Every item carrying both axis values draws as a point, carrying its coverage — how much
   of the model the position rests on.
4. The four regions are named where the lines cross them.
5. The user clicks a point and the item's note opens.

**Extensions**

- **2a — no threshold is configured.** The midpoint of the declared range is used and the
  plot shows where the lines are, so a reader can tell a chosen line from a default one.
- **2b — a threshold is outside its axis's range.** Refused where the model is configured,
  in the same shape as every other configuration warning — a line nothing can fall on
  either side of names no quadrant.
- **3a — the item's estimate is thin.** It is plotted anyway, with its coverage on the
  point. There is no threshold below which a point is dropped: hiding an item because its
  estimate is thin is the suppression [[The weighted score]] refused, and it is worse on a
  plot, where absence reads as "nothing there" rather than as "not estimated".
- **3b — the item carries only one axis value, or none.** It is not plotted. A point needs
  two coordinates. It goes to the shelf ([[Items the plot cannot place]]).
- **3c — two items share a position.** Both stay reachable — neither is dropped and neither
  is merged into a count, since a point that swallowed another is a plot that lies about
  how much work sits in a quadrant.
- **4a — a point sits exactly on a line.** Which side it falls is decided once, stated, and
  the same for both axes, so an item never changes quadrant by being redrawn.
- **5a — the plot is reached by keyboard.** Points are reachable in a stated order and open
  the same way, because this is the surface that answers "what should we do next" and it
  cannot be pointer-only.

## Acceptance criteria

- Each axis draws over its declared range with its dividing line at the configured
  threshold, defaulting to the midpoint of that range.
- The thresholds are view options of this view, one per axis; nothing derives them from the
  population.
- Adding or removing an item moves no other item's point and changes no other item's
  quadrant — driven by a test that plots a set, adds one, and compares every prior
  position.
- Every item with both axis values is plotted, whatever its coverage, and its point carries
  that coverage.
- The four quadrants are named on the plot, and no quadrant name is ever written to a note.
- A point on a line falls on a stated side, the same side on every redraw.
- A point opens its item, by pointer and by keyboard.

## Where it lives

A renderer of its own under `src/view/estimation/`, beside
`src/view/estimation/renderTable.ts` rather than inside it — the table and the plot are two
drawings of the same items, and `src/domain/estimationItems.ts`
(`buildEstimationModel`) already supplies both with an item's total, its coverage and its
scales, so nothing new reads the vault.

The axes and their thresholds are declared in `src/domain/estimationOptions.ts` with the
rest of this view's configuration, and the threshold rules join `modelProblems` in
`src/domain/scoringModel.ts` so an unusable line is refused where every other unusable
setting already is. Which projection is on screen is UI state, not a `.base` setting, so it
belongs in `src/storage/viewStateStore.ts` beside the sort pick — ADR 0011.

Tests: a view test for the plot, `test/domain/scoringModel.test.ts` for the threshold
rules, and the independence check above, which is the one criterion here that a reader
cannot verify by looking.
