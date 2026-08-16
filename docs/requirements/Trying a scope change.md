---
type: Feature
parent: "[[Release Planning]]"
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

**Outcome** — "What if we cut this" can be answered without changing anything.
