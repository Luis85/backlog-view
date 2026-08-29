---
type: PBI
parent: "[[A rubric for every point]]"
order: 10
status: Open
created: 2026-08-17
source: written after the first increment shipped, to describe what was built
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

# Scoring an item against its rubric

**As** someone estimating an item, **I want** each point on a scale to say what it means
before I pick it, **so that** I am choosing a definition rather than a number that feels
about right.

One row per dimension and per bound scale, the range drawn as buttons. The point the note
holds shows its own sentence beside the row; every other point's sentence is on the button
itself, reachable by pointer and by keyboard. The sentences reach the DOM from the saved
model, never through the i18n catalog — an editable sentence is data, and a translated
catalog entry could not be edited from the view options.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is estimating |
| **Trigger** | Selecting a row in the table, then pressing a point on a row of the panel |
| **Preconditions** | The model resolves without problems, and the dimension or scale has a bound property |
| **Guarantee** | A row that holds an answer is never silent about it. Whatever the note carries — a point, a value outside the range, a value between points — the row says which it is, and no picked number ever lacks a stated meaning. |

**Main flow**

1. The user selects an item and the panel draws one row per dimension, then confidence,
   effort and complexity.
2. Each row shows its range as buttons, the held point active, and that point's rubric
   sentence beside it.
3. The user hovers or focuses another point and reads what that point would mean.
4. The user presses it. The score is written ([[Writing the total back with its stamp]]).
5. The panel rebuilds with the new point active and its sentence beside it, and focus
   returns to the point now held.

**Extensions**

- **1a — the scale is unbound.** The row draws a bare label with no points and no clear
  control. There is nothing to answer and nothing to clear.
- **2a — the stored value is outside the range.** No point is active, and the row says
  what the value is read as after clamping. A note can hold `9` on a five-point scale, and
  this holds for confidence, effort and complexity exactly as for a dimension — reading
  the first fact as the second once drew a row with no active point, no sentence and no
  note at all.
- **2b — the stored value is between points.** `2.5` is in range and counted as it
  stands, but it names no point and so has no sentence to show. The row says it is between
  points and what it counts as.
- **2c — there is no answer.** The row says nothing rather than inventing an active point.
- **2d — the point has no rubric sentence.** The range was widened past the rubric. The
  model is incomplete and reports it ([[Configuring the estimation model]] 3d).
- **4a — the point already held is pressed.** Nothing is planned and nothing is written,
  so the undo slot keeps the batch it had.
- **4b — the row is cleared.** The clear control is offered while the note carries the
  key, not while it holds a readable value — a clear planned against the value wrote
  nothing on exactly the notes the guided setup had just stubbed. An offered action always
  writes something, in both directions.
- **5a — the dimension id needs escaping.** Focus is restored by matching option text
  rather than by building a selector literal, and a dimension and a scale that share an id
  still refocus the row that was picked.

## Acceptance criteria

- A row draws its range as buttons with the held point active and that point's sentence
  beside it.
- A clamped value reports what it is read as and holds no point active — for a dimension,
  and for confidence, effort and complexity.
- A fractional value is named as between points, with what it counts as.
- A dimension with no answer says nothing at all.
- An unbound scale draws a bare label, no points, no clear control.
- The clear control follows the presence of the key, so it clears a stub and a hand-typed
  word as readily as a number.
- Focus lands on the row that was picked, including where a dimension id would break a
  selector and where a dimension and a scale share an id.
- **Not met yet** — no check asserts that every *other* point's sentence is reachable.
  `panel.ts` sets it on each button's `aria-label` and `title`; nothing in
  `test/view/estimation/panel.test.ts` reads either, so the sentence a reader consults
  before picking is the one part of this row that is unchecked.

## Where it lives

`src/view/estimation/panel.ts` (`renderPanel`, `dimSpec`, `scaleSpec`, `renderScoreRow`,
`rubricNote`, `renderClearButton`, `refocusPick` — the rows, the three answers a stored
value can get, and where focus lands after a rebuild) ·
`src/domain/scoringModel.ts` (`ScoringDimension.rubric`, `ScaleConfig.rubric` — the
sentences themselves) · `src/domain/estimationItems.ts` (`EstimationItem.ownKeys`, the
presence the clear control is drawn on).

Tests: `test/view/estimation/panel.test.ts` (what a row draws for a stored value) and
`test/view/estimation/scoring.test.ts` (what a pick writes).
