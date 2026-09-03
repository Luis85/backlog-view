---
adr: 34
title: Order is a global rank
status: Accepted
date: 2026-08-30
area: domain
---

# 0034 — Order is a global rank

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

**`order` is one fractional rank over the whole of what the Base returns**, read
by every projection as a slice of a single ordering rather than as several independent
ones. "Global" is bounded by the Base and not by the vault — see the last Consequence
below, which states what that costs.
`src/domain/rankOrder.ts` holds the comparator — `order` ascending,
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

**That reason has since taken two more modules out of `writePlan.ts`, which strengthens it
rather than qualifying it.** The ✨ backfill is a whole-tree pass by the same test, so
`computeInitWrites` and everything under it is `src/domain/rankBackfill.ts`; and the
arithmetic all three kinds of plan share — `ORDER_SPACING`, `rankBetween` over `midpoint`
and `edgeRank`, `roundOrder`'s six-decimal grid, `placeRun`, and the `RankResult` /
`refusalKey` pair that names a refusal — is `src/domain/rankArithmetic.ts`. That last one
is the point rather than a line-count dodge: a one-row placement, a whole-population
rewrite and a blank being filled must land on ONE grid, and a second definition of it
would be a second answer to what a rank may be. `ItemWrite` stays in `writePlan.ts`,
because a type belongs with the code that produces it.

`src/commands/rank.ts` is how a user reaches them: two palette commands rather than one
that guesses, because the two look alike and mean very different things to a backlog
somebody has ordered by hand. Each confirms with the count it would write, recomputes that
batch when the answer arrives rather than applying the previewed one, and writes through
the active view's own `applySafely` — which is why `LiveBacklogView` in
`src/view/registry.ts` publishes it.

The placement math that reads that population is `anchoredOrder`, `orderForTarget` and
`dropPlacement` in `src/domain/writePlan.ts` — over `src/domain/rankArithmetic.ts`, which
is where the number itself comes from — and **every path that produces a rank goes
through it** — a drop, an indent, an outdent, an Alt+arrow, a menu move, `New <child>`,
the release scope screen's own creation, and the ✨ backfill filling a blank. That is the
rule and not an observation: `newItemOrder` once called `orderForTarget` directly, missed
the fallback below, and made a legacy vault one a user could drag around and not add to.
A caller that wants to know WHY a placement produced nothing asks `dropPlacement` rather
than re-deriving the answer beside it, since the two would disagree about the dragged
row's own exclusion.

## Consequences

- `BacklogModel.ranked` costs one more `O(n log n)` sort per build, beside
  `sortSiblingsDeep`'s sibling-group sort and the resource roster's — `src/domain/CLAUDE.md`'s
  Cost section names it as the build's THIRD deliberately superlinear step, bounded the same
  way: run once per build over the item count, not per row, so three passes leave the build
  at O(n log n).
- The comparator restates ADR 0008's own tie-break (missing `order` sorts last, ties go
  to the Bases result order) rather than inventing a new rule, because a global rank and a
  sibling rank agree about what an absent or tied number means; only the SCOPE they compare
  within differs.
- Context rows join the population deliberately: their `order` is already read for
  placement (the bounds the backfill fits a blank between, and `anchoredOrder`'s own
  neighbour walk),
  and including them here can only reduce collisions, never manufacture one — they stay
  unwritable through `applySafely` regardless of which array names their rank.
- **A drop's rank is now planned from this population.** `dropPlacement` and
  `computeDropWrites` in `src/domain/writePlan.ts` take a midpoint (`rankBetween` in
  `src/domain/rankArithmetic.ts`) between the anchor's
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
  reordering. `Seed ranks from the hierarchy` now exists to end that state, and the
  fallback still stands: a command a user has not run yet changes nothing about the vault
  they are dragging in today.
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
  `distinctlyRanked` stays in `src/domain/rankOrder.ts` for the question that genuinely is
  about a whole list: sorting is all-or-nothing, so one missing rank leaves the list with no
  defined order. **That is the read side, and it is the ONLY side** — the whole-population
  question a write-side caller was allowed here was itself wrong, and not for the reason the
  ban above gives. `Respace ranks` asked `distinctlyRanked(model.ranked)` to decide whether
  its confirmation may promise to keep the order on screen. Sound one way — every rendered
  list is a subset of the population, so distinct here means none of them falls back — and
  false the other, which is what the sentence actually asserts: ranks that collide ACROSS
  focus levels while staying distinct WITHIN each one make the population non-distinct with
  no list falling back at all, and unfocused there is no `inRankOrder` call to fall back in.
  The caveat reads `model.focusInTreeOrder` instead — this same predicate, asked of the ONE
  list `inRankOrder` is called for. A PLACEMENT still may not ask it, for the reason above.
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
  and so is the READ side's matching concession, `inRankOrder` reverting a focused list to
  tree order whenever its rows' ranks are not all distinct. Recorded rather than closed, in
  `docs/issues/The unseeded fallback is silent.md`, which also carries the other half:
  distinctness is only a PROXY for a seeded vault, and a legacy vault whose sibling ranks
  happen not to collide across parents is reordered anyway.
- **A focus-level rank moves the item among its own siblings too**, and that is the price
  of one rank rather than a defect. There is a single `order`, so ordering the PBI backlog
  at a focus level also decides where each of those PBIs sits inside its own Feature. The
  alternative is a second number, refused below. It is stated in
  `docs/requirements/Ranking at the focused level.md` as an acceptance criterion so a
  reader meets it as a designed consequence rather than as a surprise.
- **The backfill fills a blank in the place the row is drawn**, using this same arithmetic
  bounded by what is drawn above and below it, and leaves the blank alone where no such
  number exists — reporting that rather than claiming there was nothing to do. What it
  cannot promise is that a projection looks the same afterwards: a focused list draws in
  tree order while any of its rows is unranked and in rank order once none is, so two
  EXISTING ranks that already contradict the drawn order flip when the list becomes
  sortable. No pass that only fills blanks can prevent that; Seed rewrites every rank and
  can.

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

- **A second property — a `rank` beside `order`, global while `order` stayed
  sibling-scoped.** Rejected, and it is the alternative with a worked example in the wild:
  the community Kanban board invented `kanban_order` beside the tree's own rank and now has
  two numbers that can disagree about the same note, with nothing able to say which is
  right. Every dual-surface tracker that got this right keeps ONE rank shared between its
  backlog and its board — Jira's LexoRank, Azure DevOps' stack rank, Linear's manual
  order. A second property also costs a second view option to bind, a second backfill and
  a second thing for a user to understand, and buys only the consequence recorded above:
  that a focus-level rank does not disturb sibling order. That consequence is a price
  worth paying once; it is not worth a second source of truth in the frontmatter.
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

- **The peer fallback stops being reached.** Once seeding has run over the vaults that
  need it, the fallback is dead weight rather than a bridge. Deleting it is not free — it
  is what keeps an unmigrated vault draggable — so the trigger is evidence that unmigrated
  vaults are gone, not the mere existence of the command. The silence it switches in is
  its own record now (`docs/issues/The unseeded fallback is silent.md`); a post-Seed tie
  reported there is the same evidence read from the other end.
- **ADR 0008 stops being partly in force.** That trigger has HALF fired and the supersede
  was deliberately not taken: `Seed ranks from the hierarchy` does renumber across the
  whole backlog, but ADR 0008's arithmetic is still live code — the peer fallback above is
  it, exactly as written there. Marking 0008 `Superseded` while the plugin still runs its
  rule would make the register say something false in order to look tidy. The day the
  fallback goes, so does the last of 0008, and the frontmatter link is the change to make
  in the same commit.
