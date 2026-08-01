---
type: Bug
order: 10
parent: "[[Sibling ranking]]"
status: Open
priority: P3
area: limitation
created: 2026-07-31
source: CLAUDE.md, pre-existing
files:
  - src/domain/dropTargets.ts
  - src/domain/writePlan.ts
---

# A partially filtered sibling group can produce duplicate orders

## The limitation

In a filtered base, a parent whose children are only partly returned by the query has an
incomplete `children` list. `insidePosition` and `computeInsertOrder` work from that
list, so they can compute an `order` value that duplicates one already held by an
excluded sibling.

This predates PR #14 and is recorded in `CLAUDE.md` as a known limitation. It is not
specific to context rows, though a filtered base is the usual way to meet it.

## Impact

Mild and self-correcting. Equal orders fall back to `entryIndex` — the Bases result
order, which honours the user's configured sort — so the tree still renders in a stable,
sensible sequence. The group renumbers itself on the next renumbering drop.

The user-visible symptom is an item occasionally sorting next to, rather than exactly
at, the position it was dropped, and only in a base whose filter splits a sibling group.

## Why it has not been fixed

A correct fix needs the *complete* child set for the target parent — backlinks plus a
folder scan — which `computeDropWrites` cannot reach without giving up its purity. That
purity is what makes the ranking rules testable without a vault, and it is load-bearing
for the whole `domain/` layer.

Trading it away to fix a self-correcting cosmetic issue is a bad exchange, which is why
this is recorded rather than scheduled.

## If it is ever worth fixing

The shape would be to resolve the full sibling set *before* planning, in the view where
vault access is legitimate, and pass the complete list into the existing pure functions —
so `writePlan.ts` stays pure and simply receives better input.

## Acceptance criteria

None; this is a recorded decision. Re-open with a real user report if the symptom turns
out to be more visible than expected.
