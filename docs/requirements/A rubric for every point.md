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
rubric sentence is. A stored answer outside its own range shows the clamp instead of a
sentence, never silently — `estimation.clamped` in `src/i18n/en.ts`.

Tests: `test/view/estimation/scoring.test.ts` ("scoring a dimension" and "the confidence,
effort and complexity rows").
