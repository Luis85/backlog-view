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

**"Editable" does not yet mean editable from this view's own options menu, and that stays
refused rather than fixed with a smaller control.** `estimationOptions.ts` offers 47 boxes
— the model's own properties, each dimension's five, the three scale properties — and the
rubric sentences get none: today they are stored keys hand-edited in the `.base`. Making
that absence legible where the boxes are not was considered (2026-08-21) and refused, for a
mechanical reason: `BasesOption` is `{ type, displayName, shouldHide? }`, so a menu built
from it has no way to say anything that is not itself a control. A disabled box reading
"edit this in the `.base`" would be a new control with its own strings and its own styling,
and a worse version of the surface [[Editing a dimension's scale]] already specifies. So the
absence is reported where it already is: at refusal time, by `dimensionProblems`'s
`8 points need 8 rubric sentences, found 5`, naming its dimension by label the same way
every other refusal there now does.

**Outcome** — A score is chosen against a definition rather than against a feeling.

## Where it lives

`src/view/estimation/panel.ts` (`renderPanel`) draws one row per dimension and per bound
scale: the label and the range as buttons on one line, and the held point's own rubric
sentence kept on its own line beneath it — every OTHER point's sentence reachable the same
way, on hover and on focus, through each button's own `aria-label`/`title`. The points are a
`role="radiogroup"` with a roving `tabindex`, exactly one member a tab stop at a time — the
held point where there is one, the first point where there is not — so the group costs one
stop on the keyboard rather than one per point. A clear control sits on the row's head,
outside the radiogroup, and stays invisible until the row is hovered or the control itself
holds focus, the same reveal rule the shelf's own controls follow. The sentences themselves
are never here: they reach the DOM straight from the saved `ScoringModel`
(`domain/scoringModel.ts`'s `ScoringDimension.rubric` / `ScaleConfig.rubric`), never through
the i18n catalog — this note's own "the default sentences ship with the model and are
editable" is a fact about DATA, and a translated catalog entry could not be edited from the
view options the way a rubric sentence is.

**A row with an answer is never silent about it, and that takes three answers rather than
one.** A stored value inside the range and ON a point shows that point's sentence; one
outside the range shows the clamp (`estimation.clamped`); and one BETWEEN points — `2.5`,
which is in range and counted as it stands — shows that instead (`estimation.betweenPoints`),
because it names no point and so has no sentence to show. Both notes hold for the three
fixed scales exactly as for a dimension: nothing computes a total off confidence, effort or
complexity, but a note can still hold `9` on a five-point scale, and reading the first fact
as the second drew that row with no active point, no sentence and no note at all.

Moving the sentence to hover was considered and refused — every point's sentence is already
on hover through `aria-label`/`title`, and the resting sentence is the one thing that says
what the HELD value means.

Tests: `test/view/estimation/panel.test.ts` (what a row DRAWS for a stored value) and
`test/view/estimation/scoring.test.ts` (what a pick WRITES).
