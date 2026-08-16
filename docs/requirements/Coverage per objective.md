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

The denominator is the population the base returned, and the work aligned to nothing is
reported as its own figure rather than left out of the arithmetic: an objective with 20% of
the plan means something different when half the plan is aligned to no objective at all.

**Outcome** — The distribution of effort across objectives is visible, and its unit is
never in doubt.
