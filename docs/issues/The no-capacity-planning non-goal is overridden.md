---
type: Issue
order: 10
parent: "[[Product Operations]]"
status: Open
priority: P2
area: product
created: 2026-08-21
source: user request, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The no-capacity-planning non-goal is overridden

## The decision

The received requirements document refuses capacity work outright — `prds/2026-08-16 A
modular product management toolkit.md`, section 26.2, names resource leveling,
critical-path scheduling, automatic task scheduling, detailed person-hour allocation and
timesheets as things this plugin should not attempt.

[[Product Operations]] claims part of that ground anyway: how much of a period operations
consumed, and what a team can therefore commit to, is answerable under that epic.

The PRD itself is **not edited**. `prds/` holds requirements documents as received, and a
document rewritten after the fact records what somebody wished had been asked for. The
override lives here instead, where anything bound by 26.2 can link it.

## Why

The non-goal and the capability were argued on the same day, and the capability won on one
point: the pain that opened [[Product Operations]] is that the live moment is blind, and
"what did this displace" is a capacity question wearing a different word. A view that
reports displacement and then refuses to add it up is drawing the number and hiding the
total.

What 26.2 is right about is the rest of its list. Nothing here asks for scheduling, leveling,
person-hours or timesheets, and the distance between "how much did operations cost" and
"schedule the team" is the whole of the non-goal's value.

## What the override covers, and what it does not

- **Covered** — reporting how much of a period operational work consumed, and reading a
  team's remaining commitment from it.
- **Not covered** — everything else 26.2 names. No leveling, no critical path, no automatic
  scheduling, no person-hour allocation, no timesheets, no calendar scheduling.

## Acceptance criteria

- Every other epic derived from the same requirements document still reads 26.2 as binding;
  this override names [[Product Operations]] and nothing else.
- Any item that would schedule, level or allocate is refused against 26.2, and this note is
  not the reason it was allowed.
- A reader who arrives at 26.2 from the PRD can reach this note, and a reader who arrives
  here can see which sentence of 26.2 still stands.
