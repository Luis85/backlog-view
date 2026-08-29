---
type: Feature
parent: "[[Release Management]]"
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
priority: ""
iteration: ""
---

# Trying a scope change

Items can be added to or removed from a release *in the view only*, showing what that would
do to capacity, value, risk and dependencies before anything is written. The screen says
plainly that a scenario is on it, and committing it is one gated, undoable batch.

**The value impact obeys the same rule as every other view reading a score**
([[Rolling a portfolio up]]): a value is a position on a scale, so it is **averaged, never
summed**, and the average is reported **per model fingerprint** — this view names the stamp
key beside the value key for that. A 4 from a 1–5 model and an 8 from a 0–10 model have no
sum and no average between them, and a scenario that showed one would answer "what if we cut
this" with a number about nothing. Unstamped values are reported as unattributed, and with no
stamp key configured the value impact is not shown at all: capacity, risk and dependencies
still answer, and the missing one is named. Capacity is the opposite case and sums, because
effort is a quantity.

**The risk and dependency impacts are the release summary's own figures, recomputed over the
proposed scope** — [[The release summary]] defines both, so a scenario that counted them
differently would report a change that vanishes the moment it is committed. Blocked items and
critical unaddressed risks, each counted once per item, each shown as the pair *now → if
applied*, using the predicates [[Release readiness]] declares. A scenario's whole claim is
that the numbers it shows are the numbers it will produce; anything computed a second way
here breaks that.

**Outcome** — "What if we cut this" can be answered without changing anything.
