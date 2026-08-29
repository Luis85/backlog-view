---
type: Feature
parent: "[[Backlog Health]]"
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
priority: ""
iteration: ""
---

# The health dashboard

The rule results grouped into the few things a maintainer actually asks — structural
integrity, estimation coverage, strategic alignment, evidence coverage, freshness — each a
proportion of a population the view names, so a percentage always says what it is a
percentage of.

**A group is a set of rules, and its figure counts items, not findings**: the share of the
population with **no finding from any rule in that group**, so an item breaking two of a
group's rules costs the group one item and not two. The alternative — averaging the per-rule
pass rates — reports a group as 90% healthy when the same tenth of the backlog fails every
rule in it, which is the number a maintainer would act on and the wrong one. Every group is
worded that way, so `structural integrity 84%` reads as "84 of every 100 items have nothing
structurally wrong with them".

Which rules make up a group is configuration like everything else here, defaulted rather than
fixed: a rule belongs to exactly one group, a rule in no group counts towards no percentage
and still appears in the findings, and a group whose rules are all unconfigured shows no
figure instead of 100%.

**Outcome** — The shape of the problem is visible before any individual finding is read.
