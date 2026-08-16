---
type: Feature
parent: "[[Release Planning]]"
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
---

# The release summary

The numbers a release decision needs, in one place: item count, estimated and completed
effort, progress, open blockers, risks, and how much of the scope carries no estimate at
all. The last one is stated rather than folded into the others — an unestimated item is not
a small one.

**Progress is derived, so this view names what derives it**: the state property, the values
that count as done, and **which denominator the figure uses** — items, or estimate. Nothing
in this plugin persists a progress figure, and the two denominators give different answers
for the same release, so the choice is configuration rather than an implementer's guess. The
figure says which one it used, and completed effort is the estimate denominator's numerator
rather than a second idea of the same thing.

**Outcome** — The state of a release can be read in a few seconds and none of it is a
guess.
