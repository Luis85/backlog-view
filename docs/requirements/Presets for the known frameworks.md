---
type: Feature
parent: "[[Business value estimation]]"
order: 15
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: "[[Evan]]"
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Presets for the known frameworks

Optional starting configurations for the models teams already know, each of which only sets
dimensions, weights and a formula, and each editable afterwards. A preset changes nothing
outside this view.

**They come in two kinds, and conflating them would break the epic's central rule.** A
*value* preset configures the weighted value model only — the plain weighted score is one.
An *indicator* preset — RICE, ICE, WSJF, value over effort — divides by effort or job size
or multiplies by confidence, so it is by construction one of the labelled indicators that
sit **beside** the business value, never the value itself. Picking one configures the
indicator and leaves the value model alone; the number written back to the note stays the
value-only total, because a stored figure that has absorbed effort is exactly the composite
this epic exists to refuse.

**An indicator is a shape with named operands, not an expression somebody types.** The value
model's arithmetic is already fully stated — [[The scoring model is configuration]] for the
mapping and [[The weighted score]] for the sum — and nothing here adds a second way to compute
it: a *value* preset only picks dimensions and weights. An *indicator* is one form and one
only: **a product of named operands, divided by one named operand**. Each operand is a
configured dimension, or the value model's own output, or the confidence-adjusted value; the
divisor may be omitted. That covers all four by choosing operands rather than by parsing
anything — RICE is reach × impact × confidence over effort, ICE is impact × confidence × ease
with no divisor, WSJF is cost of delay over job size, value over effort is what it says — and
"editable afterwards" means swapping an operand or dropping the divisor, never typing
arithmetic. So there is no operator precedence to define, no expression language to validate,
and no way for two implementations to disagree about a preset. A form somebody can write that
this shape cannot express is a reason to reconsider the shape, not to grow a parser inside a
view whose whole argument is that a derived number must be explainable.

**Two inputs have no answer, and an indicator that cannot be computed is absent rather than
zero.** An operand whose dimension is unanswered on the item, and a divisor of zero or below,
each produce **no figure for that item** — reported as not computable, with the operand
named — and the item keeps its place in any list, sorted with the unmeasured rather than at
one end. Zero is refused as a divisor because it is not a large indicator, and a negative one
because it inverts the ranking silently; both are the same failure as scoring an unanswered
dimension at its lowest point, which [[The weighted score]] already refuses. An indicator
persists nothing, so none of this writes or invalidates anything.

**Only the value model's formula is stamped**, because only it decides the number that gets
written: editing it makes every total the old one produced stale, whether or not the new one
happens to agree about a particular item. An indicator's formula is stamped nowhere and
invalidates nothing — it persists no figure, so there is nothing for a stale mark to be about,
and marking every stored value stale because somebody edited a RICE denominator would be the
same false alarm in the opposite direction.

**Outcome** — A team that already works one of these ways can start in a minute.
