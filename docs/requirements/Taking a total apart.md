---
type: PBI
parent: "[[Why this item scored what it scored]]"
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
---

# Taking a total apart

**As** someone being asked to accept a score, **I want** to see which dimensions produced
it and how much each one contributed, **so that** I can disagree with a term rather than
with a number.

The panel shows one term per answered dimension — its label, its score, its weight —
followed by the total and the coverage it rests on, then the two labelled derived numbers
beside it. Each derived number carries its own name and sits beside its inputs, never
instead of them.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a score, including the person who has to be convinced by it |
| **Trigger** | Selecting a row in the table |
| **Preconditions** | The model resolves without problems |
| **Guarantee** | No figure on this panel stands alone. Every number shown is either an input the reader can trace, or a labelled derivation drawn beside the inputs it came from — there is no composite that has quietly absorbed value, confidence or cost. |

**Main flow**

1. The user selects a row and the panel opens on that item.
2. The scoring rows draw ([[Scoring an item against its rubric]]).
3. Below them, one term per answered dimension: label, score, weight — the score the
   total COUNTED, which is not the answer on the note wherever the value was clamped into
   range or the dimension counts down.
4. The summary line follows the terms: the total, and the coverage it rests on.
5. The confidence-adjusted value draws once confidence is answered, under its own label,
   beside the value it adjusts rather than in place of it.
6. The value-to-effort indicator draws once effort is answered too, under its own label.
7. The user opens the item's note to read the reasoning behind the numbers, which is prose
   where its author wrote it — this view parses no note bodies and declares no rationale
   property.

**Extensions**

- **1a — nothing is selected.** The panel column collapses to one track, and the second
  track is restored once a row is picked.
- **3a — no dimension is answered.** There is no decomposition, because there is no total
  to decompose.
- **5a — confidence is not answered.** The line is absent rather than drawn at a default.
  Each derived line appears only once its own inputs exist.
- **6a — effort is zero or below.** The indicator is omitted and no ratio is printed; the
  effort row's own out-of-range note says why.
- **7a — the total is not current.** The currency word in the table already says which
  failure it is, and the decomposition beside it is computed from the scores on the note
  as they are now — so the panel shows what the model *says*, against a stored total that
  says what it *said*.

## Acceptance criteria

- One term per answered dimension, each its own element, with the coverage wrapped
  together with the total as the summary line that follows them.
- **Every term is a value `computeTotal` used**, asked of it rather than derived a second
  time beside it: a clamped answer reports as the value in range, and a `lessIsBetter`
  dimension as the value its direction gives the sum. A term computed independently of the
  total is how the two came to describe different arithmetic about one note.
- The confidence-adjusted value and the value-to-effort indicator each render only once
  their own inputs exist, each under its own label — and the adjustment divides by the
  confidence scale's own maximum, over the confidence AS THE ROW ABOVE READS IT, so a
  stored value the scale cannot hold cannot print a derived number above the model's own
  output range.
- The value-to-effort line is omitted for an effort of zero or below, with no ratio
  printed.
- A dimension with no answer contributes no term.
- The panel column collapses while nothing is selected and restores once a row is picked.
- The panel's scroll position is READ before the rebuild tears the old panel down, starts
  at the top for a different item, and is clamped when the rebuilt panel is shorter.
  **Only the order and the clamp are checkable here**: `scrollTop` is a layout question, a
  detached element has no box, and jsdom answers with whatever was last assigned — so the
  suite asserts that the read happens while the element is still in the document
  (`test/view/estimation/panel.test.ts`, `table.test.ts`), and that the position really
  survives against real layout is owed a live-vault check.
- **Not met yet** — the panel offers no way to reach the note. The feature's "the prose
  behind them is one click away where its author wrote it" is served only from the table,
  by `Enter` on the selected row; the panel draws the item's title as plain text.

## Where it lives

`src/view/estimation/panel.ts` (`renderDecomposition` — one term per answered dimension
and the summary line — and `renderDerived`, the two labelled derived numbers, each drawn
only once its own inputs exist, with `readAs` the one clamp on that panel, shared with the
row note that reports it) · `src/domain/weightedScore.ts` (`computeTotal`, whose result,
coverage and `Term` list the block reports, and `round2`) ·
`src/domain/estimationItems.ts` (`EstimationItem`, which carries that result per note).

Tests: `test/view/estimation/panel.test.ts`.
