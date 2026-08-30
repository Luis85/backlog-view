---
adr: 32
title: Order is a global rank
status: Accepted
date: 2026-08-30
area: domain
---

# 0032 — Order is a global rank

## Context

[ADR 0008](0008-rank-siblings-with-fractional-orders.md) scoped `order` to a sibling
group: two items under different parents may hold the same number and it means nothing,
because nothing before now ever compared them. That scoping is exactly what stands in the
way of a focus level — [[Focus level]]'s per-level backlog is a *filter* over the tree, not
a subtree, so its rows can come from many different sibling groups at once (an `Epic` and
a `Test suite` share the null parent, for one), and a filtered list has no rank space of
its own to reorder within unless every item it could ever contain already shares one.

A focus-level list can only be ranked, dragged and reordered if `order` already means the
same thing for every item in the backlog, not just for items that happen to share a
parent.

## Decision

**`order` is becoming one fractional rank over the whole backlog**, read by every
projection as a slice of a single ordering rather than as several independent ones.
`src/domain/rankOrder.ts` is the first piece: it holds the comparator — `order` ascending,
`null` sorting last, ties broken by the Bases result position (`entryIndex`) — and builds
`BacklogModel.ranked`, one sort over every loaded item (results and `outsideFilter`
context rows alike). That population is declared as **the only array any ranking
arithmetic may read**, in `src/domain/model.ts`'s own field comment, because a `Test
suite` and an `Epic` sharing the null parent means a rank taken against one projection's
slice of the tree can collide with a hidden root's.

This record is the decision to build ranking on top of a single sorted population instead
of a per-projection one. The placement math that reads it — `anchoredOrder`,
`orderForTarget` and `dropPlacement` in `src/domain/writePlan.ts` — lands piece by piece
and each is recorded below as it arrives, rather than the record being written once
`order`'s write path has already changed underneath it.

## Consequences

- `BacklogModel.ranked` costs one more `O(n log n)` sort per build, beside
  `sortSiblingsDeep`'s sibling-group sort — `src/domain/CLAUDE.md`'s Cost section names it
  as the build's second deliberately superlinear step, bounded the same way: run once per
  build over the item count, not per row.
- The comparator restates ADR 0008's own tie-break (missing `order` sorts last, ties go
  to the Bases result order) rather than inventing a new rule, because a global rank and a
  sibling rank agree about what an absent or tied number means; only the SCOPE they compare
  within differs.
- Context rows join the population deliberately: their `order` is already read for
  placement (the backfill's max-order scan, and now `anchoredOrder`'s own neighbour walk),
  and including them here can only reduce collisions, never manufacture one — they stay
  unwritable through `applySafely` regardless of which array names their rank.
- **A drop's rank is now planned from this population.** `dropPlacement` and
  `computeDropWrites` in `src/domain/writePlan.ts` take a midpoint between the anchor's
  neighbours in `ranked`, so a drop, an indent, an outdent and a keyboard reorder all
  write ONE note and no group is ever renumbered — `renumberWrites`, `afterHighestKnown`
  and `dropTargets.ts`'s `reorderableGroup` are deleted with the sibling-scoped arithmetic
  they served. When there is no room between the two neighbours the placement refuses
  rather than making room by rewriting the group.
- **ADR 0008's scoping survives as the fallback, not as the rule.** On a vault whose ranks
  were never seeded, sibling-scoped numbers collide across parents — every first child
  holds the same value as its parent — so the global placement refuses for a gap of zero
  and `dropPlacement` re-asks the same question against the destination's peers alone.
  That is ADR 0008's arithmetic, kept so that an unmigrated vault does not lose ordinary
  reordering before a seeding command exists.
- **The fallback is gated on the POPULATION, not on the refusal**, and the distinction is
  load-bearing rather than a detail of the implementation. A refusal is not evidence of a
  legacy vault: `gapSpent` is the correct answer on a fully seeded one, where the remedy is
  Respace. Gated on the refusal, the fallback answers from the peer bounds alone — and any
  non-peer row ranked between those bounds already sits there, so it can write a rank
  another row holds. Being between the peer bounds is what makes that collision possible,
  not what prevents it, and the duplicate then fails the very distinctness test that decides
  whether a focused view may be sorted by rank at all. So the gate is that test:
  `distinctlyRanked` in `src/domain/rankOrder.ts`, exported and asked by both sides rather
  than restated on each, because two questions that should be one is exactly how the
  collision above got written. It is therefore self-limiting: once every writable row has a
  distinct rank the branch is unreachable and a refusal is reported as a refusal.
- The fallback is **silent** — nothing tells the user which of the two regimes answered —
  which is a known gap recorded rather than closed.

## Alternatives

- **Rank each focus-level list independently, scoped to what is currently visible.**
  Rejected: the rank would depend on which items happen to be on screen, so the same drag
  could mean a different write depending on which projection was open when it landed — the
  exact inconsistency ADR 0008's sibling scoping never has to answer for, because a
  sibling group is not a *view* of the tree, it is a fixed set.
- **Give every projection its own comparator over `model.items`, computed where it is
  used.** Rejected before it was built: a comparator run at each call site is a rule
  restated at every reader instead of stated once, and `src/domain/CLAUDE.md`'s
  `model.realRoots` precedent already names the failure mode — a projection's slice taking
  a midpoint a hidden root already holds.

## Revisit when

- **The peer fallback stops being reached.** Once a seeding command has run over the
  vaults that need it, the fallback is dead weight rather than a bridge — and while it
  stands, a silent switch between two rank scopes is a thing the register says nothing
  about at the moment it happens.
- **`order` stops being sibling-scoped in the note itself.** If a later piece renumbers
  across the whole backlog rather than within a group, ADR 0008 is superseded outright
  rather than extended, and this record should say so in its frontmatter.
