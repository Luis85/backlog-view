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
priority: ""
iteration: ""
---

# Rolling a portfolio up

Progress, item count, value, effort, release distribution and risk aggregated per
portfolio level, each from the property that holds it, each naming its unit, and each
reporting how much of the population could not be measured.

Every **property-backed** one of those is a key this view names — value, the **model stamp**
beside it, effort, release, risk — on the terms [[Settings scoped to their view]]
states, and an aggregate whose key is unconfigured is absent from the rollup rather than
counted as zero.

**The value average is gated on the stamp**, for the reason
[[Comparing across products]] already gives: a 4 from a 1–5 model and an 8 from a 0–10 model
are not two numbers to add up, and an average across them is a figure describing no model at
all. So the fingerprints are compared with each other — this view never asks what any of them
means, only whether they agree — and one average is reported per fingerprint, each with its
count, rather than one
number across all of them. Unstamped scores are counted and reported as unattributed, never
folded into a fingerprint's average. With no stamp key configured there is no average: the
value column shows the population and says it cannot tell which models produced it.

**Each one names its operator too, because "aggregated" is not an instruction.** Effort is
**summed** — it is a quantity, and two items cost what they cost — with the same rule
[[Capacity against commitment]] states for a release: each item's **own** estimate counted
once, nothing derived from anybody's children, and members whose estimate may already cover
a descendant in the same grouping counted and named beside the figure rather than resolved.
Only the vault knows whether its parent estimates are aggregates. Value is **averaged**, and
never summed: a score on a 1–5 scale is a position on a scale, so adding two of them says
nothing, and the average is reported beside the count it came from. Release is a
**distribution** — how many items per release, unreleased included — not a single value.
Risk is a **distribution as well, and is never mapped to a number**: it is
categorical, and an average of low, medium and high is a number no one can act on. Where a
single figure is wanted from it, it is the **worst** category present and the count at
it, which is a statement anybody can check against the list.

**"Worst" needs an order, and this view declares its own** — one ordered list of labels per
categorical key, beside the key itself, worst first. A property key says where the values
live and nothing about what they mean, and the ordering the backlog view uses for risk
belongs to that view's settings, which [[Settings scoped to their view]] forbids reading. So
an unordered key gets its **distribution and no single figure**: the counts are still true,
and a worst-of picked from an order nobody declared is the arbitrary answer this whole note
is written against. A value outside the declared order is counted, shown, and named as
unranked rather than sorted to one end.

The denominator is the same for all of them: the items in the grouping, which
[[Levels above the epic]] defines as the ones whose nearest grouping statement is this one
or something under it. Each aggregate reports how much of that population it could not
measure, and the unmeasured are never zeros in the numerator.

**There is no health aggregate here, and that is a removal rather than an omission.** The
only health number this plugin produces is [[A health score that can be argued with]], which
computes from the rules that fired against one base and **persists nothing** — so a rollup of
it would have to recompute it from another view's rule configuration, which
[[Settings scoped to their view]] refuses, or read a property no capability writes, which is
an aggregate that can only ever be empty. Risk covers the recorded judgement and the health
view covers the derived one; a portfolio wanting the second opens it over the population it
cares about.

**Two of them are not property-backed and must not be treated as if they were.** The item
count is the population the base returned, counted. **Progress** is derived the way the
backlog already derives it — from a state property and the values that count as done, over
the descendants — so what this view names for it is that state key and that done list, not a
`progress` key.

**"Over the descendants" is three different sums, so the arithmetic is stated here.** The
denominator is the grouping's population, the same one every other aggregate uses. The
numerator is the members of that population whose **own** state value is in the done list.
Every member counts once at every depth: a parent inside the grouping is counted **beside**
its children rather than instead of them, and no per-parent percentage is computed and then
averaged — that would weight a ten-item feature the same as a one-item one and give two
portfolios holding the same work different progress. This is also the one aggregate with no
unmeasured share, and that is the exception to the denominator paragraph above rather than a
gap in it: a
state that is absent, empty or holds a value outside the done list is **not done**, which is
an answer, and it is the same reading the backlog's own rollup makes. What the state key can
be is unconfigured, and then there is no progress figure at all, like any other key nobody
named. Nothing in this plugin persists a progress figure, and requiring a mapping
for one would make both rollups disappear behind settings for properties that do not exist —
or worse, invite a vault to maintain a second copy of a number the tree already answers.

**Outcome** — Two products can be compared on the same numbers, with the gaps in those
numbers visible.
