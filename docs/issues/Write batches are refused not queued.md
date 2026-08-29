---
type: Issue
order: 10
parent: "[[The write gate]]"
status: Open
priority: P3
area: design
created: 2026-07-31
source: PR
files:
  - src/view/backlogView.ts
  - src/domain/writePlan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Concurrent write batches are refused rather than queued

## The decision

While a batch is applying, a second write is **refused** with a notice rather than
queued behind the first. `applySafely` guards on an `applying` flag.

## Why

A drop plan is computed against the model as it stands. Queuing would apply a plan built
from *pre-write* state after the writes had landed, so the sibling `order` values in it
would be wrong — the second operation would rank against positions that no longer exist.
Fractional ranking makes this concrete: `computeInsertOrder` picks a value between two
neighbours, and those neighbours may have been renumbered by the batch it queued behind.

Refusing is correct. It is only the *presentation* that was ever the problem.

## What PR #14 changed

Nothing about the rule — it made it visible rather than surprising:

- The toolbar shows batch progress (`Updating N of M…`), so a user can see why.
- The backfill command goes `disabled` during a batch, so the one operation most likely
  to collide is not offered and then refused.

## What a real fix would look like

Recompute the plan at apply time rather than at interaction time: capture the *intent*
("place X after Y under Z") instead of the resolved orders, and resolve it against the
current model when the queue drains. That is a genuine improvement and a genuine
redesign of the drop pipeline — `DropTarget` would carry references rather than an
`insertIndex` into a snapshot.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. Raise
the priority if users actually hit the notice — the batches it guards are usually short
enough that nobody does.
