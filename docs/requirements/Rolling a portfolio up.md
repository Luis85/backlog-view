---
type: Feature
parent: "[[Product Portfolio]]"
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

# Rolling a portfolio up

Progress, item count, value, effort, release distribution, health and risk aggregated per
portfolio level, each from the property that holds it, each naming its unit, and each
reporting how much of the population could not be measured.

Every **property-backed** one of those is a key this view names — value, effort, release,
health, risk — on the terms [[Settings scoped to their view]] states, and an aggregate whose
key is unconfigured is absent from the rollup rather than counted as zero.

**Each one names its operator too, because "aggregated" is not an instruction.** Effort is
**summed** — it is a quantity, and two items cost what they cost. Value is **averaged**, and
never summed: a score on a 1–5 scale is a position on a scale, so adding two of them says
nothing, and the average is reported beside the count it came from. Release is a
**distribution** — how many items per release, unreleased included — not a single value.
Health and risk are **distributions as well, and are never mapped to numbers**: they are
categorical, and an average of low, medium and high is a number no one can act on. Where a
single figure is wanted from either, it is the **worst** category present and the count at
it, which is a statement anybody can check against the list.

The denominator is the same for all of them: the items in the grouping, which
[[Levels above the epic]] defines as the ones whose nearest grouping statement is this one
or something under it. Each aggregate reports how much of that population it could not
measure, and the unmeasured are never zeros in the numerator.

**The health here is a recorded property, not the derived score.**
[[A health score that can be argued with]] computes its number from the rules that fired
against one base, persists nothing, and is therefore not an input to anything: the two are not a pipeline, and a vault
where nothing writes a health property gets no health rollup, exactly as an unconfigured key
gets none. Reading another view's rule configuration to recompute it here is what
[[Settings scoped to their view]] refuses.

**Two of them are not property-backed and must not be treated as if they were.** The item
count is the population the base returned, counted. **Progress** is derived the way the
backlog already derives it — from a state property and the values that count as done, over
the descendants — so what this view names for it is that state key and that done list, not a
`progress` key. Nothing in this plugin persists a progress figure, and requiring a mapping
for one would make both rollups disappear behind settings for properties that do not exist —
or worse, invite a vault to maintain a second copy of a number the tree already answers.

**Outcome** — Two products can be compared on the same numbers, with the gaps in those
numbers visible.
