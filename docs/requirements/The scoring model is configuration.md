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
weighted sum — a proportion between 0 and 1, since the weights total 100 — is presented on
**the model's own declared output range**, one pair of numbers beside the weights, mapped
linearly: `min + proportion × (max − min)`. The default is 1–5, which is what the epic's
examples show, and a model whose dimensions run 0–10 can declare 0–10 for its total too. The
range is declared rather than inferred from the dimensions, because dimensions may disagree
about theirs and a total silently taking the widest one is a number nobody chose. A value outside the declared range is
clamped to it and reported rather than silently extending the scale; a value that is not a
number is a missing score, which is the partial-profile rule and not an arithmetic
question.

**A range must increase**: `min < max`, refused at the point it is configured, because
`min == max` divides by zero and `min > max` makes the clamp and the direction mean two
things at once. A saved model that already holds an invalid range computes nothing and says
which dimension is wrong — the same shape as this plugin's existing configuration warnings,
where a view that cannot be trusted to write says so instead of writing.

**Outcome** — A team scores what it actually cares about, under the property names its
vault already uses, and any two implementations of the model agree on the number.
