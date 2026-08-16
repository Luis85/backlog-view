---
type: Feature
parent: "[[Business value estimation]]"
order: 40
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

**Only the value model's formula is stamped**, because only it decides the number that gets
written: editing it makes every total the old one produced stale, whether or not the new one
happens to agree about a particular item. An indicator's formula is stamped nowhere and
invalidates nothing — it persists no figure, so there is nothing for a stale mark to be about,
and marking every stored value stale because somebody edited a RICE denominator would be the
same false alarm in the opposite direction.

**Outcome** — A team that already works one of these ways can start in a minute.
