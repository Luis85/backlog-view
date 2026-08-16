---
type: Feature
parent: "[[Product Strategy]]"
order: 50
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

# Coverage per objective

How much of the plan each objective is getting, as a share of whatever the vault can
measure — item count by default, an estimate or a value score where those properties are
configured — with the measure named on screen, because a percentage whose unit is unstated
is a number pretending to be a fact.

**Coverage rolls up the strategy tree.** Work names one strategic note — the innermost it
serves — and an objective's coverage counts the work aligned to it *and* to everything
beneath it in that tree, which is how an objective whose initiatives carry all the work
avoids reporting nothing at all. That is the same shape as
[[Levels above the epic]]: one link per item, counted once at each ancestor above it, so
nothing is double counted no matter how deep the tree runs. Alignment through the work
hierarchy is not inherited here — an item aligns because it says so, not because its parent
did — and the count is of items, never of links, so an item is one item wherever it appears.

**Numerator and denominator are the same measure**, which is the only arithmetic that gives
a share: with item count both are counts; with an estimate or a value score both are sums of
that property, aligned over total, never points over items. An item carrying no value where
the measure looks is **measurable by neither**, so it leaves both sides and is reported as
its own number — a percentage of a plan half of which has no estimate is a fact about the
estimates, and hiding that in the denominator makes every objective look small for a reason
nobody can see.

The denominator is that measure over the population the base returned **minus the strategic
notes in it**, told apart by the type key and value list
[[Work with no strategy behind it]] declares — the same discriminator, because this is the
same population seen from the other side. The base has to return the strategy to draw the
tree, and counting it here would let an isolated objective lower every objective's coverage
without adding a day of work to the plan.

The work aligned
to nothing is reported as its own figure rather than left out: an objective with 20% of the
plan means something different when half the plan is aligned to no objective at all.

**Outcome** — The distribution of effort across objectives is visible, and its unit is
never in doubt.
