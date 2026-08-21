---
type: Feature
parent: "[[Release Management]]"
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

# What is in a release

Items name their release in one property, and the view shows the membership as the tree it
already is — epics, features and bugs together, each where the hierarchy puts it, rather
than as a flat list that loses the shape of the work.

**Membership is the property and nothing else — it never cascades in either direction.** A
Feature in the release whose Epic is not is the ordinary case, not a broken tree: the Epic is
drawn above it so the Feature keeps its place, and that is all it does. It is not a member,
it is not counted, and it is not written to when the scope changes. Inheriting membership
down a subtree would put in the release work nobody named; inferring it up from a child would
put in the release an Epic whose other children ship later. This is the register's existing
[context-row rule](../../CLAUDE.md) — a row that renders and parents but is never a counting
source or a write target — applied to a second view, and the ancestor is marked as context
on screen so its number-free row is not read as a zero.

Every count in [[The release summary]] therefore has one denominator: the notes whose own
property names this release.

**Outcome** — The scope of a release is legible as work, not as a bag of rows, and no item
is in a release because of where it sits.
