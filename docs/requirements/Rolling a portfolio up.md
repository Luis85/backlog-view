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

Every **property-backed** one of those is a key this view names — progress, value, effort,
release, health, risk — on the terms [[Settings scoped to their view]] states, and an
aggregate whose key is unconfigured is absent from the rollup rather than counted as zero.

**The item count is not one of them.** It is the population the base returned, counted, so
there is no key to configure and nothing to omit: it is the one figure a portfolio always
has, and requiring a mapping for it would make the most basic rollup disappear behind a
setting for a property that does not exist.

**Outcome** — Two products can be compared on the same numbers, with the gaps in those
numbers visible.
