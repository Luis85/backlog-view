---
type: Issue
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
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A filtered base can produce a duplicate order, and the rank space is why

## The limitation

**The rank space is the BASE's population, not the vault.** `createItems` walks the Base's
own entries and pulls in nothing else except ancestors, and only while
`showOutsideParents` is on. A note the filter excludes and no result claims as a parent is
never loaded, so it is not in `model.ranked` and no placement can see the rank it holds. A
midpoint may therefore be handed a number that note already carries.

Nothing is visibly wrong while that note stays filtered out. The day it re-enters the
results the pair is a duplicate: the two fall back to the Base's own sort, and a focused
list holding both drops back to tree order without saying why.

**This got WIDER on 2026-08-30, and the widening is the point worth carrying.** Under
ADR 0008 an `order` was scoped to a sibling group, so only a hidden SIBLING could collide
with a placement. Under [ADR 0032](../adrs/0032-order-is-a-global-rank.md) it is one rank
over everything the Base returns, so any hidden note in the vault can. The mechanism the
first version of this note described — a partial `children` list feeding
`computeInsertOrder` — is gone with those symbols; the shape of the problem outlived them
because it was never really about the child list. It was always about what the view can
see.

## Why it is deliberate

Two alternatives were weighed and both refused. **Reading every rank-bearing note from the
metadata cache** would make `domain/` read the vault rather than what Bases hands it —
that purity is what makes the ranking rules testable without a vault, and it is
load-bearing for the whole layer. **Refusing every write on a filtered base** would
disable ranking for most real bases, since most of them filter something.

So the view ranks against what it can see, and says so here rather than pretending the
number is free everywhere.

## What would lift it

Nothing cheap. A rank space that covered the vault needs a reader outside the Base's
results, which is the first alternative above under another name. What is affordable is
repair rather than prevention, and it exists: **Respace ranks** rewrites every rank the
base returns with even spacing, keeping the order on screen, so a duplicate that surfaces
is one command away from being separated again.

Note that **Seed** is *not* the remedy here. It rewrites ranks from the tree order and
would discard any order set by hand at a focus level — the right tool for a vault that was
never ranked this way, and too blunt for one collision.

## Impact

Mild while it stays hidden and visible only afterwards. Equal orders fall back to
`entryIndex` — the Bases result order, which honours the user's configured sort — so the
tree still renders in a stable, sensible sequence, and a focused list holding the pair
reverts to tree order ([[The unseeded fallback is silent]] records that this revert is
silent).

The user-visible symptom is an item sorting next to, rather than exactly at, the position
it was dropped — and now, since the collision can be with any hidden note rather than a
hidden sibling, in any filtered base rather than only one whose filter splits a group.

## Acceptance criteria

None; this is a recorded decision. Re-open with a real user report if the symptom turns
out to be more visible than expected.
