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

**`order` is becoming one fractional rank over the whole of what the Base returns**, read
by every projection as a slice of a single ordering rather than as several independent
ones. "Global" is bounded by the Base and not by the vault — see the last Consequence
below, which states what that costs.
`src/domain/rankOrder.ts` is the first piece: it holds the comparator — `order` ascending,
`null` sorting last, ties broken by the Bases result position (`entryIndex`) — and builds
`BacklogModel.ranked`, one sort over every loaded item (results and `outsideFilter`
context rows alike). That population is declared as **the only array any ranking
arithmetic may read**, in `src/domain/model.ts`'s own field comment, because a `Test
suite` and an `Epic` sharing the null parent means a rank taken against one projection's
slice of the tree can collide with a hidden root's.

`src/domain/rankSpread.ts` is the pair of whole-population rewrites that arithmetic needs
behind it: **Seed** (`computeSeedWrites`) writes the hierarchy into numbers, and
**Respace** (`computeRespaceWrites`) restates the order already on screen with room
between each pair again. Both are pure plans over one shared spread, so the two differ
only in the sequence they hand it — DFS preorder against `realRoots`, or `ranked` — and
both leave every `outsideFilter` rank exactly where it is. They live beside
`src/domain/writePlan.ts` rather than in it because every other plan there places ONE row
against its neighbours.

`src/commands/rank.ts` is how a user reaches them: two palette commands rather than one
that guesses, because the two look alike and mean very different things to a backlog
somebody has ordered by hand. Each confirms with the count it would write, recomputes that
batch when the answer arrives rather than applying the previewed one, and writes through
the active view's own `applySafely` — which is why `LiveBacklogView` in
`src/view/registry.ts` publishes it.

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
- **The fallback is gated on a TIE between the two neighbours the placement landed
  between** — a fact about the drop site, not about the vault. Two rows holding the same
  number is what the sibling-scoped scheme produces and what nothing else does, so
  `midpoint` reports it as its own refusal (`tied`, beside `gapSpent` and `unranked`) and
  that refusal alone opens the fallback. A `tied` that reaches a notice takes Seed as its
  remedy rather than Respace or the backfill: the backfill only fills blanks, and respacing
  a range holding two equal numbers cannot separate them.
- **Two wider gates were built here first and both were wrong**, which is why the narrow
  one is worth a record of its own. Gated on *any* refusal, the fallback answers over a
  `gapSpent` that is correct on a seeded vault, taking a number from the peer bounds alone
  — where any non-peer row between those bounds already sits, so being between them is what
  makes the collision possible rather than what prevents it. Gated on *the population being
  distinctly ranked*, one unrelated row defeats it from either direction: a single freshly
  created note with no `order` yet, or one legacy tie in another corner of the vault,
  re-opens the fallback for a subtree that is perfectly seeded. Every whole-population
  predicate has that shape of hole, so narrowing it was abandoned rather than repaired.
  `distinctlyRanked` stays in `src/domain/rankOrder.ts` for the READ side only, where the
  question genuinely is about the whole list: sorting is all-or-nothing, so one missing
  rank leaves the list with no defined order.
- **A gate on the fallback's ENTRY cannot vouch for its ANSWER, so the answer is checked
  too.** Both numbers the fallback can produce — a midpoint between two peers, an edge rank
  one spacing past the outermost one — are functions of the peer values alone, while the
  rows sitting between or beside those peers are by definition not peers. So a non-peer
  already ranked between the peer bounds is exactly where a peer midpoint lands, and on a
  legacy vault, where every group is anchored on the same small numbers, a drop in one
  group and a drop in another compute the same edge rank. `dropPlacement` therefore asks
  whether any other writable row already holds the number, and returns the `tied` refusal
  when one does — rather than searching for a free value, which would invent an arithmetic
  ADR 0008 does not specify. It costs nothing on the case the fallback exists for: the
  first drop in each group answers a number nobody holds, and the remedy `tied` names is
  Seed, which is what a vault dense enough to collide here needs. The question is
  asked of the population WITHOUT the dragged row — a drop landing where the item already
  is would otherwise refuse for a collision with itself — and of every other row, context
  rows included.
- **A context row occupies its rank, and that is a different question from the one the read
  side asks.** `distinctlyRanked` skips `outsideFilter` rows because one can never be GIVEN
  a rank — a fact about the backfill's reach. Occupancy is a fact about the NUMBER: it is
  taken whoever is allowed to write it, so the write side is deliberately stricter than the
  read side's definition. Both answers are a dead end and the question is which: accepting
  WRITES the collision, after which every later placement at that site refuses forever and
  the duplicate is latent — if the excluded note's filter membership flips (a `hide done`
  filter switched off, the note edited back into the results) two writable rows hold the
  number and the focused view drops to tree order with nothing said, and it is this code
  that wrote it. Refusing merely declines one gesture, which the user recovers from by
  dropping elsewhere. Bounded honestly: a writable/context tie does not break focused
  ordering today, since `inRankOrder` reads distinctness off the writable rows alone. One
  consequence recorded and now bounded rather than fixed — when the row holding the number
  is an excluded one, no remedy the notice can name moves it. What the notice does instead
  is send the user one step further rather than in a circle: `rank.tied` names Seed, and
  Seed reports `rank.wedged` over exactly the rows squeezed against a rank this base cannot
  write. The refusal itself still cannot tell the two cases apart, because `RankRefusal`
  carries a reason and never a row.
- Self-limiting: once the rows around a drop hold distinct ranks there is no tie to switch
  on, and the refusal the fallback used to swallow is reported instead.
- The fallback is **silent** — nothing tells the user which of the two regimes answered —
  which is a known gap recorded rather than closed.

- **The rank space is the BASE's population, not the vault, and that is a real limitation
  rather than a wording quibble.** `createItems` walks the Base's own entries and pulls in
  nothing else except ancestors, through `loadOutsideParents`, and only when
  `showOutsideParents` is on. A note the filter excludes and no result claims as a parent is
  never loaded, so it is not in `model.ranked` and no placement can see the rank it holds. A
  midpoint may therefore be handed a number that note already carries. Nothing is visibly
  wrong while it stays filtered out; the day it re-enters the results the pair is a
  duplicate, `distinctlyRanked` goes false, and the focused view drops back to tree order
  without saying why.
  **This is wider than the sibling-scoped rank it replaces**, and the widening is the point
  worth carrying: before, only a hidden SIBLING could collide with a placement; now any
  hidden note in the vault can. The two alternatives were weighed and refused — reading
  every rank-bearing note from the metadata cache would make `domain/` read the vault rather
  than what Bases hands it, and refusing every write on a filtered Base would disable
  ranking for most real bases, since most of them filter something. `Respace ranks` is the
  repair once a collision surfaces.

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
