---
type: Feature
parent: "[[Decision Management]]"
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

# Why the plan changed

A reordering that surprises somebody a quarter later can be traced to the reasoning rather
than to a commit — and the trace is read **backward from the decision**, which is the only
side this epic stores. Opening an item shows the decisions naming it, exactly as the
evidence and objective reads work.

The requirements document suggests a `decision:` property on the item as well. It is refused
here for the reason this register keeps refusing second copies: the same relationship written
on both sides is two facts that can disagree, and nothing would say which one is wrong. What
the item gains instead is the backward read, which cannot drift because there is nothing for
it to drift from.

**Outcome** — A surprising priority can be traced to the decision that set it, from one
relationship stored once.
