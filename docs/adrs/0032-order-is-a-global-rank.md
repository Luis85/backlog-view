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

Nothing reads `BacklogModel.ranked` yet. This record is the decision to build ranking on
top of a single sorted population instead of a per-projection one; the placement math that
reads it — a focus level's reorder, a drop, an indent — is later work this ADR expects to
gain a Consequences entry for as each piece lands, rather than a record written once
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
  placement inside a sibling group (`afterHighestKnown`, the backfill's max-order scan), and
  including them here can only reduce collisions, never manufacture one — they stay
  unwritable through `applySafely` regardless of which array names their rank.
- ADR 0008's scoping is not reversed by this alone. `order` is still *written*
  sibling-scoped today; only the *read* side has a global population to draw from. A
  sibling group's own reorder is unaffected until a later piece plans a write against
  `BacklogModel.ranked` instead.

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

- **A write path plans against `BacklogModel.ranked`.** The day a drop, an indent or a
  focus-level reorder computes its target order from this population instead of from a
  sibling group, this record gains the Consequences entry that says so, and the sentence
  above about `order` still being written sibling-scoped stops being true.
- **`order` stops being sibling-scoped in the note itself.** If a later piece renumbers
  across the whole backlog rather than within a group, ADR 0008 is superseded outright
  rather than extended, and this record should say so in its frontmatter.
