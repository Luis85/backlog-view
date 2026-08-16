---
type: Feature
parent: "[[Product Dependencies]]"
order: 10
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

# One canonical direction for a dependency

**This is already settled, and this note exists to say so rather than to decide it again.**
[[Dependencies as a property]] stores the edge on one side — the item that depends — under a
property the vault names, and reads the other direction backward, so `blocks` needs no second
property to fall out of step with the first. Nothing in this epic revisits that.

What this epic adds is the surfaces over it: a graph, a table, a blocked rule and cycle
detection, none of which the roadmap's own dependency drawing was ever going to hold.

**Outcome** — A dependency is stated once, as it already is, and this view is where the
consequences of all of them can be read together.
