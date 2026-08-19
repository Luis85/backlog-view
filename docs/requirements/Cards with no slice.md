---
type: PBI
parent: "[[Slices across the map]]"
order: 20
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Cards with no slice

**As** someone deciding what ships, **I want** to see the cards that belong to no release,
**so that** unassigned work is a visible number instead of a card that quietly is not on the
map.

The roadmap already answers this shape with a counted shelf that is also the target which
un-places an item. The same answer applies here, and the reason is the same: work with no
value in the axis property must not vanish, and it must be possible to put it back.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | The map drawing, with at least one card whose release property is absent |
| **Preconditions** | The release-membership property is configured |
| **Guarantee** | Every card the base returned is on screen exactly once: in a slice row, or in the unsliced row. No card is ever silently dropped, and the unsliced count is the number of results, never of anything the base excluded. |

**Main flow**

1. The view finds the cards on the map whose release property holds nothing.
2. It draws them in one unsliced row, labelled with its count.
3. Dropping a card from a slice row onto the unsliced row removes its release property.
4. Dropping a card from the unsliced row into a slice row writes that release.

**Extensions**

- **1a — every card has a release.** The unsliced row is absent rather than drawn empty at
  zero.
- **1b — a card's release property names a note that does not exist.** The card is unsliced and
  the broken link is shown on it, rather than being treated as a release of its own.
- **2a — a card in the unsliced row is outside the base's filter.** It draws, it is not counted,
  and it accepts no drop — an excluded row is never a write target and never a source of a
  number the map reports.
- **3a — the card already has no release.** No write is planned and the undo slot is not
  consumed.
- **3b — removing the release takes the card out of the base.** A filter may name the very
  property the move writes. The card leaves in silence, which is the known open question in
  [[The outcome report was built from one sentence]] and is not solved here.

## Acceptance criteria

- The sum of every slice row's cards and the unsliced row's cards equals the cards the base
  returned, asserted as one invariant rather than per row.
- With no unsliced card, the row is not rendered at all.
- The unsliced count excludes context rows while still drawing them, stated from the rule and
  tested from it.
- Dropping onto the unsliced row deletes the key rather than writing an empty value, verified
  by reading the frontmatter.
- A card already unsliced plans an empty batch and leaves the undo slot untouched.

## Where it lives

`src/domain/shelf.ts` is the counted-shelf rule this use case follows rather than reinvents,
and `src/view/render/shelf.ts` with `src/view/interactions/shelfMenu.ts` is how that shelf is
drawn and how a drop onto it un-places an item. The row itself comes from this epic's
projection module in `src/domain/`, and the key removal is `applyLabels` in
`src/storage/frontmatter.ts`, where a `null` planned value already means delete.
