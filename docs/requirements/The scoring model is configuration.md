---
type: Feature
parent: "[[Business value estimation]]"
order: 10
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

# The scoring model is configuration

The dimensions themselves are declared on the view: which are enabled, what property holds
each, its range, its weight, whether more is better, and the sentence describing it. The
eight in this epic's default model are a starting set, not a fixed vocabulary.

**How a configured dimension reaches the sum is stated, not left to the implementation**,
because two reasonable readings give the same model two different totals. A raw value is
placed on its declared range as a proportion — `(value − min) / (max − min)` — inverted to
`1 −` that when the dimension declares less is better, multiplied by the weight, and the
weighted sum **divided by 100** — the weights are percentages, so their sum runs to 100 and
the proportion that the output mapping needs runs to 1 — is presented on **the model's own
declared output range**, one pair of numbers beside the weights, mapped linearly:
`min + proportion × (max − min)`. Skipping that division is not a rounding difference: top
scores everywhere would map a 1–5 model's total to 401. The default is 1–5, which is what the epic's
examples show, and a model whose dimensions run 0–10 can declare 0–10 for its total too. The
range is declared rather than inferred from the dimensions, because dimensions may disagree
about theirs and a total silently taking the widest one is a number nobody chose. A value outside the declared range is
clamped to it and reported rather than silently extending the scale; a value that is not a
number is a missing score, which is the partial-profile rule and not an arithmetic
question.

**The written total is rounded to two decimals, and every comparison is made against that
rounded number.** A renormalized partial profile divides by weights that do not divide
evenly, so the exact value repeats, and a total stored at full precision would be a long
number nobody chose in a note somebody reads. So: compute at full precision, round once at
the point of writing, and when [[Business value estimation]] asks whether a stored total
still equals what the model computes, round the recomputation the same way before comparing
it. Comparing a rounded stored value against an unrounded fresh one marks every partial
profile stale the moment it is written, which is the failure this sentence exists to prevent.
Two decimals because the default range is 1–5 and `4.27` is already finer than any answer
behind it.

**A range must increase and it must be whole**: `min < max`, both integers, one point per
step. `min == max` divides by zero and `min > max` makes the clamp and the direction mean
two things at once; fractional bounds are refused for a different reason — a range of 0–1.5
cannot say how many scores exist, so the selector, the rubric's one-sentence-per-point rule
([[A rubric for every point]]) and the fingerprint would each have to guess, and would guess
differently. Whole bounds make the count arithmetic: `max − min + 1`. A saved model holding a
range that breaks either rule computes nothing and says which dimension is wrong — the same
shape as this plugin's existing configuration warnings, where a view that cannot be trusted
to write says so instead of writing.

A finer scale is a wider range, not a fractional step: a team wanting halves between 1 and 5
declares 2–10. Steps of their own are refused for the reason the whole register refuses
options — nothing needs one that a range cannot already express.

**Outcome** — A team scores what it actually cares about, under the property names its
vault already uses, and any two implementations of the model agree on the number.

## Where it lives

`src/domain/scoringModel.ts` (the model's own shape — `ScoringDimension`, `ScaleConfig`,
`ScoringModel` — and `modelProblems`, which turns this note's arithmetic rules into the
config-warning shape a saved model that cannot be trusted to score reports instead of
computing) · `src/domain/defaultModel.ts` (the shipped eight dimensions and their rubric
sentences, transcribed from this epic's PRD as data rather than catalog text — two
locales must not write two models) · `src/domain/estimationSettings.ts`
(`resolveEstimationSettings`, reading a dimension's range, weight, property and rubric
off the `.base` the way `settingsResolve.ts` reads the backlog's) ·
`src/domain/estimationOptions.ts` (the options menu those dimensions and the model's
value/stamp properties are configured through).

Rubric sentences are stored per point in the `.base` and edited there this round — the
options menu offers no box for one; the editing surface is [[A rubric for every point]]'s
open half.

Tests: **`test/domain/scoringModel.test.ts`**.
