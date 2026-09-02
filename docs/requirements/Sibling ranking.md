---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 30
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Sibling ranking

**As** someone moving one item, **I want** one note to change, **so that** my vault's
history stays readable and a reordering session does not show up as hundreds of edits
across notes I never touched.

## Use case

| | |
| --- | --- |
| **Actor** | The view, planning a move |
| **Trigger** | Any move that changes an item's position among its siblings |
| **Preconditions** | The destination is known, and the item being moved is a result |
| **Guarantee** | **Either the rendered order after the write is the order the user saw indicated, or nothing is written at all and the view says why.** One note is written on the first path and none on the second; no other note is ever renumbered to make room. |

**Main flow**

1. `order` is a **fractional rank**, not an index — and since
   [ADR 0032](../adrs/0033-order-is-a-global-rank.md) it is one rank over everything the
   Base returns rather than a number scoped to a sibling group.
2. A drop between two items takes the **midpoint** of the two ranks that neighbour that
   position in the ranked population. Where the user aimed decides the anchor; the
   population decides the number.
3. That is one number, on one note: a single write, whatever the group's size.

**Extensions**

- **1a — an excluded row is *visible* among the rows being ranked.** Its `order` is still
  **read** — by `anchoredOrder`'s neighbour walk, by `rankTaken`'s occupancy check, by the
  backfill's own floor and ceiling — so the item does not land above something the user
  can see, and no placement takes a number one of them already holds. Read, never written.
  An UNRANKED excluded row is skipped instead of refused: it can never be GIVEN a rank, so
  it constrains nothing and refusing beside one would be permanent.
- **2a — the two neighbours have no gap left between them.** The move is **refused**:
  nothing is written, and the notice names **Respace ranks**, which rewrites every rank
  with even spacing and keeps the order on screen. Making room by renumbering the group is
  what this used to do and no longer exists — one move writes one note, or none.
- **2b — the item is dropped at the start or the end of the population.** It takes one
  spacing clear of the outermost rank; no midpoint is needed. That, too, refuses rather
  than approximating when the arithmetic cannot get clear of its neighbour, which is
  reachable at magnitudes a hand-edited `order` can hold.

**Guarantees**

- The rank arithmetic never reads the **rendered** roots. Focus mode makes the top row a
  synthetic group whose members are not siblings, and a number taken from one projection's
  slice of a group can collide with a hidden root's. This is a lint rule (`RENDERED_ROOTS`)
  and not a convention — and the sentence is narrowed to what the rule reaches: it bans
  `model.roots` in the three domain files that rank (`writePlan.ts`, `rankArithmetic.ts`
  and `rankBackfill.ts`) and in `interactions/create.ts`. `dropTargets.ts` and `interactions/structure.ts` read it deliberately, to answer
  a different question — which rows a focus-level move is aimed among
  ([[Ranking at the focused level]]) — and take the NUMBER from `model.ranked` like
  everything else.

## Acceptance criteria

- A drop writes exactly one note, or none.
- A placement with no room left refuses and names a remedy; nothing is renumbered to make
  room for it.
- No rank is produced from the rendered roots — enforced by lint in every file that
  produces one.
- An excluded row's `order` is read for placement and never written, and the number it
  holds is treated as taken.

## Where it lives

`src/domain/writePlan.ts` (`anchoredOrder`, `orderForTarget`, `dropPlacement`,
`computeDropWrites`) · `src/domain/rankArithmetic.ts` (the one arithmetic under them —
`rankBetween` over `midpoint` and `edgeRank`, on `roundOrder`'s grid) ·
`src/domain/dropTargets.ts` (`dropTargetFor`, and `DropTarget.peers` as intent rather
than arithmetic).
Tests: `test/domain/writePlan.test.ts`, `test/domain/writePlanContextRows.test.ts`,
`test/domain/rankedPlacement.test.ts`, `test/view/contextRowWrites.test.ts`.

The two rewrites that restate EVERY rank at once are the counterpart to this note rather
than part of it — one move writes one note, and those two write all of them. They belong
to [[Ranking at the focused level]], which owns the commands, the population they rewrite
and the refusal they share.
