---
type: Feature
parent: "[[Backlog Health]]"
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

# A health score that can be argued with

An optional aggregate over the rules that fired, always decomposable into them: every point
lost names the rule and the items that lost it. A score that cannot be taken apart is the
single opaque number this register keeps refusing.

**The arithmetic is stated here, because a decomposition only holds if the sum is one
number.** The score runs 0–100 and starts at 100. Each enabled rule declares a weight, and
deducts `weight × (items it fired on ÷ items examined)`; the deductions are subtracted and
the result is floored at 0. So a rule that hits everything costs its whole weight, a rule
that hits one item in fifty costs a fiftieth of it, and the decomposition is one row per
rule: weight, hits, share, points.

Two consequences worth stating rather than discovering. **A rule fires on an item once**, so
a finding cannot be counted twice and no cap is needed — the pair `(rule, item)` is the
finding, and an item breaking three rules loses points three times because three problems
are three problems. And **the denominator is the population the base returned**, the same
one the item count reports, so two bases over the same vault can score it differently and
each score says what it examined.

Weights do not have to total 100 and are not renormalized — that is what lets a rule be
switched off without moving everybody else's contribution. Where they total more, the floor
is what a very unhealthy backlog reaches; where they total less, so does the worst possible
score. Both are visible in the decomposition rather than hidden by a rescale.

**Outcome** — One number for the state of the backlog, and the list behind it one click
away.
