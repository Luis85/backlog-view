---
type: PBI
parent: "[[The scoring model is configuration]]"
order: 10
status: Done
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

# Configuring the estimation model

**As** the person who owns a backlog, **I want** to declare which dimensions this view
scores and what each one reads, **so that** the number it computes is a model my team
chose rather than one the plugin assumed.

The dimensions are a list of ids in the view options; each id gets its own group — a
property, a weight, a range, a direction and its rubric sentences. The model's own output
range and the two properties that hold the total and its stamp sit above them. A saved
model that cannot be trusted to compute says so and computes nothing, which is this
plugin's existing configuration-warning shape applied to a second view.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the estimation view's options menu |
| **Preconditions** | A saved view using the `product-estimation` type |
| **Guarantee** | A model that would compute an untrustworthy number computes nothing instead, and names what is wrong with it. No configuration state produces a total the reader cannot account for. |

**Main flow**

1. The user opens the view options and reads the `Model` group: the dimension ids in
   order, the output range, and the properties for the business value and its model stamp.
2. The user edits the dimension list. The options rebuild config-aware, one group per id
   actually configured — never only the shipped eight.
3. The user names a property for a dimension, sets its weight, its range and whether more
   is better.
4. The view resolves the model and finds no problems.
5. The table draws, and scoring is offered.

**Extensions**

- **2a — an id outside the shipped eight.** There is no shipped default to fall back to,
  so it gets weight 0 and its own id as its label. Weight 0 is refused at step 4, which is
  how a custom dimension announces that it still needs a weight.
- **2b — the dimension list is emptied.** That is a declaration, not an omission: no
  dimensions at all, rather than a silent fall back to the shipped eight. A model that
  binds nothing is unconfigured, and unconfigured is the guided empty state
  ([[Binding the estimation properties]]), not a warning.
- **3a — the weight is zero or negative.** Refused, naming the dimension. Zero divides by
  zero once a partial profile renormalizes, and a negative weight pushes the proportion
  outside 0–1 while the others still sum to 100. A dimension nobody wants counted is
  removed from the list, which says it properly.
- **3b — the weights do not total 100.** Refused. The weights are percentages and the sum
  is divided by 100 to reach the proportion the output range is mapped from.
- **3c — the range is not increasing whole integers.** Refused, naming the dimension.
  `min == max` divides by zero, `min > max` makes the clamp and the direction mean two
  things at once, and fractional bounds cannot say how many points exist — so the
  selector, the rubric and the fingerprint would each guess, and would guess differently.
- **3d — the range is widened past the rubric.** The points with no stated meaning are
  reported rather than invented. [[Editing a dimension's scale]] is the surface that
  fixes it; until then the model is incomplete.
- **3e — a value typed as an unquoted number.** A weight, a label or a rubric sentence is
  read as the `.base` spells it, resolving to its own digits rather than falling back to
  the shipped value behind the user's back.
- **4a — the total and its stamp are not both bound.** Refused, naming whichever of the
  two is missing. They are one key pair: a total with no stamp is an unattributed number,
  and a stamp with no total describes a model that wrote nothing.
- **4b — one property is bound to two slots.** Refused, naming both. The two writes land
  in one batch, so the second value would silently overwrite the first and one key would
  carry two inverses.
- **4c — the output range is not increasing whole integers.** Refused on its own terms.
  It is declared rather than inferred from the dimensions, because dimensions may disagree
  about theirs and a total silently taking the widest one is a number nobody chose.

## Acceptance criteria

- The dimension groups follow the configured id list, not the shipped eight.
- Each refusal above names the dimension or the property it is about, and the view
  computes nothing while any of them stands.
- A weighted sum reaches the output range as `min + proportion × (max − min)`, where the
  proportion is the weighted sum divided by 100 — the shipped model's worked example
  computes 3.55.
- A less-is-better dimension is inverted on its own declared range.
- An out-of-range stored value is clamped to the range and the dimension is reported; a
  non-numeric one is a missing score, not an arithmetic error.
- A total is rounded to two decimals once, at the point of writing, and every later
  comparison is made against that rounded number.
- A model that binds nothing is unconfigured; a model that binds only a scale is
  configured with problems. Those are one definition, not two.

## Where it lives

`src/domain/scoringModel.ts` (`ScoringDimension`, `ScaleConfig`, `ScoringModel`,
`modelProblems`, `boundKeys` — the refusals above as the config-warning shape) ·
`src/domain/defaultModel.ts` (the shipped eight and their rubric sentences, as data
rather than catalog text — two locales must not write two models, and `SUGGESTED_KEYS`
is the list [[Binding the estimation properties]] binds) ·
`src/domain/estimationSettings.ts` (`resolveEstimationSettings`, `dimOption`,
`DEFAULT_POINT_RANGE` — reading a dimension off the `.base` the way `settingsResolve.ts`
reads the backlog's) · `src/domain/estimationOptions.ts`
(`getEstimationViewOptions` — the config-aware groups, on the WIP-boxes precedent) ·
`src/view/estimation/estimationView.ts` (the warning block that draws instead of the
table).

Tests: `test/domain/scoringModel.test.ts`, `test/domain/estimationOptions.test.ts`,
`test/view/estimation/states.test.ts`.
