---
type: Feature
parent: "[[Business value estimation]]"
order: 30
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: "[[Bodger]]"
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# The weighted score

The sum of score times weight, normalized to the scale's own range, recomputed the instant
any input changes and written back to the note with its model stamp.

**Every enabled dimension carries a positive weight, and they total 100.** Totalling 100 is
not enough on its own: a zero weight makes an answered set that renormalizes by dividing by
zero, and a negative one pushes the proportion outside 0–1 while the other weights still sum
correctly. A weight of zero is a dimension nobody wants counted, which is what disabling it
says properly; both are refused where the model is configured, and a saved model holding one
computes nothing and names the dimension.

**A partial profile renormalizes, and says so.** Most items will have some dimensions
answered and some not, so the rule is chosen here rather than left to the implementation: the
weights of the **answered** dimensions are renormalized to total 100 and the total is
computed from those alone, with the **coverage** — how many of the enabled dimensions were
answered — shown wherever the total is. The two alternatives are refused for stated reasons:
suppressing the total hides the normal case, and scoring an unanswered dimension at its
lowest point asserts something nobody said, which is the arbitrary number this epic exists to
replace.

An item with **no** answered dimension has no total: nothing is computed and nothing is
written, because renormalizing over an empty set is not a value, it is a zero pretending to
be one.

**Outcome** — One comparable number per item, derived the same way for every item, and never
readable without knowing how much of the model it rests on.

## Where it lives

`src/domain/weightedScore.ts` (`computeTotal`, `round2`, `modelFingerprint`, `stampValue`,
`parseStamp`, `currencyOf`) — this note's rules as arithmetic, independent of any note or
vault: given a model and an answer for each dimension, one total, its coverage and the
per-dimension terms it summed — reported rather than left to be re-derived, so a
decomposition beside the total cannot describe arithmetic the total did not do
([[Taking a total apart]]); given a
model alone, a fingerprint that moves with everything the total's arithmetic depends on, so
a stored total can be judged current, stale, foreign, hand-written or orphaned against it.
Confidence, effort and complexity never reach this module — they play no part in the total,
so they play no part in the fingerprint either.

`src/domain/estimationWritePlan.ts` is where a change to any of it is PLANNED —
`planScoreWrite`, `planScaleWrite`, `planOrphanCleanup` — pure functions over an
`EstimationItem` and its `ScoringModel`, each returning the batch a pick would write or
`null` when it would write nothing (the checkmark question). A score change plans the
score, the recomputed total and its stamp as one batch, or their removal together once
nothing is left answered — never the total alone, never the stamp alone, since a total
with no stamp is an unattributed number and a stamp with no total describes a model that
wrote nothing. `src/storage/propertyWrite.ts` (`applyPropertyWrites`) is what actually
writes such a batch: plain key/value sets, `null` removing a key, applied inside one
`processFrontMatter` call per note so the three keys land — or fail to land — together,
and never under a key no property names.

**A clear asks the KEY; only a re-pick asks the value.** A value is what a reader made of
the note, and the guided setup action's own `''` stub — like a hand-typed word — reads as
no answer at all, so a clear planned against the VALUE wrote nothing on exactly the notes
that action had just prepared. Presence (`EstimationItem.ownKeys`) is what the panel draws
the control on, so presence is what the plan has to answer, which keeps "an offered action
always writes something" true in both directions.

**The prioritization indicator needs a POSITIVE effort.** Value-to-effort divides by the
effort, so a stored `0` has no ratio (it divides to infinity) and a negative one has a
nonsense one; the line is omitted for both rather than printed, and the effort row's own
out-of-range note is where the reader is told why.

Tests: **`test/domain/weightedScore.test.ts`**, **`test/storage/propertyWrite.test.ts`**,
**`test/view/estimation/scoring.test.ts`**.
