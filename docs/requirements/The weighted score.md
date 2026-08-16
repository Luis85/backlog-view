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
assignee: ""
---

# The weighted score

The sum of score times weight, normalized to the scale's own range, recomputed the instant
any input changes and written back to the note with its model stamp. Weights must total 100.

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
