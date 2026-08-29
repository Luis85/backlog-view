---
type: Feature
parent: "[[Product Kanban]]"
order: 66.25
status: Done
created: 2026-08-06
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# A Deliverables board

A second board, reserved for `Deliverable` items alone: its own entry in the board scope
picker (a toolbar toggle position of its own until 2026-08-16 — see
[[An Iterations board]], "Why a scope", for the user request that moved it under
`Product`), and its own workflow — its own state property, ordered states and done values, overridable
independently of the requirements board's — or, left unconfigured, falling back to the
requirements board's own `stateKey`/`states`/`doneValues` field by field, so a vault that
never bothered to name a separate property still gets a working Deliverables board
rather than an inert one. Field by field rather than as a unit: a list you fill in is this
workflow's list whatever the property does, and only an empty one follows the key. A Deliverable still shows up everywhere else exactly like any
other item — the tree and both roadmap axes — but never on the board above: that board
is scoped to everything else, whatever either workflow's state says, though a
Deliverable acting purely as an excluded ancestor still surfaces there as a context row
for a matching visible descendant, the same as any other excluded parent.

**Outcome** — Concepts, designs and other deliverables get a kanban process of their
own, without the requirements board's workflow having to describe two different kinds of
work through one column list.

## Use cases

- [[A board scoped to Deliverables]] — the way in (the scope picker's entry), the
  columns, and the cards moving through a workflow of their own.
- [[A Deliverable is coloured by its own workflow]] — the same type-dispatch rule reaching
  the roadmap's dated axis, and a legend that names both vocabularies.
