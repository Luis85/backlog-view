---
type: Issue
parent: "[[Cross-cutting concerns]]"
order: 30
status: Open
area: ux
priority: P2
created: 2026-08-03
source: Review of 0.4.0, finding 14 — the perspective the review under-covered
---

# What a screen-reader user is promised

## Why this exists

Accessibility here is implemented and asserted, and specified nowhere. `role` and `aria-*`
assertions are spread across the view suite, and `src/view/CLAUDE.md` already governs the
two tab-stop zones, the live region's ownership, the choice of a class over `:has()` for
selection state, and the roadmap's *"roles are earned, not assumed"* rule. None of that is
neglected work — it is careful work with no contract above it.

The consequence is that a11y is decided per feature by whoever built that feature. The
board and the roadmap each rediscovered the same questions — what does an empty column
need to stay reachable, what does a card's accessible name have to carry, what does a move
announce — and answered them separately and compatibly. A **fourth** projection would
rediscover them a third time, with nothing to check its answers against, and the first
divergence would be found by a user rather than by a review.

This is the perspective the `0.4.0` review under-covered, and the reason is worth
recording: the review followed the register, and the register has no accessibility note to
follow.

## What is missing

A contract, not a refactor. Nothing here says which roles a projection earns and when,
what an accessible name must contain for each kind of thing on screen, what the live
region announces and — the half that is always left out — what it must **not**, so a
batch of writes does not narrate itself a row at a time.

## What the brainstorm has to settle first

This note is deliberately not a specification, and drafting one cold would be the defect
this round is named after: a guarantee written ahead of anything that checks it. The
open questions are product decisions before they are technical ones.

- **What is promised, and to whom.** "Usable with a screen reader" is not a criterion.
  Whether the tree is navigable, whether every write is announced, whether the roadmap's
  geometry is conveyed at all or only its placements — each is a different product.
- **What a projection has to earn before it ships.** If the answer is a checklist, it
  belongs beside the layer guides; if it is a set of assertions, it belongs in the harness
  as something a new projection's tests are written against.
- **How much of it a check can reach.** jsdom can assert roles, names and live-region
  content; it cannot answer whether a real screen reader reads the result usefully. That
  boundary decides which half of the contract is a gate and which half joins the
  live-vault sweep [[A cadence for the checks CI cannot run]] governs.
- **Where the sentences live.** An accessible name built by concatenation is a sentence,
  and a sentence is a string [[Multilang]] owns. Settling the contract before that layer
  lands means writing names twice; settling it after means a projection ships under no
  contract in the meantime. Which way round is a sequencing call, not a technical one.

## What this is not

Not a defect report. Nothing here is known to be broken — this note exists because
nothing would notice if it were, which is the same shape as every other finding in this
round and the reason it is recorded rather than fixed in passing.
