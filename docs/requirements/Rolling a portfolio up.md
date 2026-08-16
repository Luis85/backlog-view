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

**Two of them are not property-backed and must not be treated as if they were.** The item
count is the population the base returned, counted. **Progress** is derived the way the
backlog already derives it — from a state property and the values that count as done, over
the descendants — so what this view names for it is that state key and that done list, not a
`progress` key. Nothing in this plugin persists a progress figure, and requiring a mapping
for one would make both rollups disappear behind settings for properties that do not exist —
or worse, invite a vault to maintain a second copy of a number the tree already answers.

**Outcome** — Two products can be compared on the same numbers, with the gaps in those
numbers visible.
