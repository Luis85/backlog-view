---
type: Epic
order: 240
status: Open
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

# Product Operations

**When something is on fire, the plan says nothing about it.** Operational work — an
incident, a support escalation, the unplanned thing somebody is doing right now — reaches
the vault folded into an ordinary `PBI`, `Bug` or `Task`, and nothing marks it as
operational once it is in. The rest of it never reaches the vault at all, because it lives
in a ticket tool. Either way the plan draws feature work competing for rank with work
nobody labelled, so the live question — what did this displace, and who was pulled off
what — has no answer on screen.

This epic makes operational work **a declared class of work**, and draws it beside the
plan it is displacing. The product owner and the ops team read the same view: the ops team
for what is running now, the product owner for what it is costing.

**Outcome** — Operational work is visible as operational work, and what it displaced is
visible beside it.

## What it does not own

One person's work list is [[My work]]. This epic owns the **team** picture: what is running,
what it displaced, and how much of the plan operations is consuming.

## Definition of done, for anything under this epic

- **Operational is a configured property, not a type.** No `Incident`, no new badge: the
  vocabulary argument is open at P1 in [[Ten capabilities want seventeen new types]] and
  seventeen names against eleven is not a debt this epic adds to. The property is named in
  the view options like every other optional key, and it gates its own projection — no key
  named, no lane, the same rule the board keeps for its state key and the roadmap for its
  axis.
- **The lane is a projection over that property.** It draws where the existing projections
  draw, and a move into or out of it is a write like any other move: planned once, announced
  once, refused for a row the Base excluded.
- **Displacement is inferred from people.** An operational item names an assignee, and that
  person's other in-flight **plan** work is what it displaced. Operational work is never
  displaced work: two incidents on one person displace each other under any rule that reads
  "everything else in flight", which would draw operations as the plan it is costing.
  Nothing new is linked and nothing is remembered over time — the claim is exactly as strong as what the vault holds today, and a
  child that wants a stronger one declares it rather than guessing harder.
- **Capacity is claimed, and it is reporting.** How much of a period operational work
  consumed, and what a team can therefore commit to, is answerable here. That needs no
  exception: capacity against a declared number is already the register's business
  ([[Capacity against commitment]]), and what the received requirements document refuses is
  the next step and not this one — leveling, critical path, automatic scheduling, person-hour
  allocation, timesheets, calendar scheduling. Those stay out, and an item under this epic
  that needs one of them is out of scope rather than a case for widening it.
- **What is outside the vault stays outside.** Operational work living only in a ticket tool
  is invisible to every item under this epic. Nothing here promises an import.
