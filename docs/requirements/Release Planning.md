---
type: Epic
order: 140
status: Open
area: product
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

# Release Planning

**A release is a decision about scope, and the decision needs numbers.** This view composes
one: what is in it, how big it is, how much of it is done, what is blocking it, and what has
not been estimated at all — with a way to try a change before committing to it.

**Outcome** — Someone deciding what ships can see the scope, its size against whatever
capacity was declared, and every unresolved thing in it, without assembling that by hand.

## Why it is its own view

A release is not a rung on the backlog ladder and not a milestone: it holds work of every
level, its membership is a property on the item, and it has facts of its own — a version, a
target date, a capacity. The backlog view has no business carrying capacity units, and the
roadmap draws time rather than scope.

The scenario is the part that decides the design: trying a scope change must not write
anything until it is committed, which means the view holds a proposed membership beside the
real one and says clearly which is on screen.

## Definition of done, for anything under this epic

- Membership is one property naming a release note. Nothing is duplicated into the release.
- Every number states its unit and where it came from; unestimated work is reported, never
  treated as zero.
- A scenario writes nothing until it is applied, and applying it is one gated, undoable
  batch.
- Readiness is a checklist a vault configures, and it refuses nothing.

## What this epic will not do

- **Schedule.** No critical path, no resource leveling, no calendar arithmetic beyond the
  dates the notes already carry.
- **Estimate.** It reports the estimates the items hold and names the ones that hold none.
