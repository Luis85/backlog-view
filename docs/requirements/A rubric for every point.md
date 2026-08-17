---
type: Feature
parent: "[[Business value estimation]]"
order: 20
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

# A rubric for every point

Every point on a dimension's scale carries a stated meaning, shown where the score is
chosen — selecting or hovering a value says what that value means, for the value dimensions,
for confidence, and for effort and complexity alike. The default sentences ship with the
model and are editable.

**The rubric follows the range, not the other way round.** A dimension declared 1–5 needs
five sentences; one declared 0–10 needs eleven, and the default set covers only the default
range. So a range is not editable in isolation: widening it leaves points with no meaning and
the model is incomplete until they are written, narrowing it strands sentences for values
nobody can pick, and the view says which in both directions rather than dropping or inventing
one. Stranded sentences are kept until the range is settled — a rubric someone wrote is not
the plugin's to delete.

Nothing under this epic is buildable before this exists: a selector without a rubric is the
arbitrary number the whole epic was opened against.

**Outcome** — A score is chosen against a definition rather than against a feeling.

## Where it lives

`src/view/estimation/panel.ts` (`renderPanel`) draws one row per dimension and per bound
scale: the range as buttons, and the held point's own rubric sentence shown beside it —
every OTHER point's sentence reachable the same way, on hover and on focus, through each
button's own `aria-label`/`title`. The sentences themselves are never here: they reach
the DOM straight from the saved `ScoringModel` (`domain/scoringModel.ts`'s
`ScoringDimension.rubric` / `ScaleConfig.rubric`), never through the i18n catalog — this
note's own "the default sentences ship with the model and are editable" is a fact about
DATA, and a translated catalog entry could not be edited from the view options the way a
rubric sentence is.

**A row with an answer is never silent about it, and that takes three answers rather than
one.** A stored value inside the range and ON a point shows that point's sentence; one
outside the range shows the clamp (`estimation.clamped`); and one BETWEEN points — `2.5`,
which is in range and counted as it stands — shows that instead (`estimation.betweenPoints`),
because it names no point and so has no sentence to show. Both notes hold for the three
fixed scales exactly as for a dimension: nothing computes a total off confidence, effort or
complexity, but a note can still hold `9` on a five-point scale, and reading the first fact
as the second drew that row with no active point, no sentence and no note at all.

Tests: `test/view/estimation/panel.test.ts` (what a row DRAWS for a stored value) and
`test/view/estimation/scoring.test.ts` (what a pick WRITES).
