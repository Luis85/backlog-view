---
type: Feature
parent: "[[Product Dependencies]]"
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

# Finding a dependency cycle

A chain that returns to where it started is detected and reported with every item on it
named, so the person who has to break it can see the whole loop rather than one edge of it.
Nothing is broken automatically, and the cycle is not treated as an error in the vault.

**Outcome** — An impossible sequence is discovered by the view rather than by whoever
tries to work it.
