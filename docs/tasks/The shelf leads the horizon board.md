---
type: Task
order: 10
parent: "[[The unplaced shelf]]"
status: Done
priority: P2
area: usability
created: 2026-08-17
closed: 2026-08-17
source: Asked for directly, alongside dropping the children section from this board's menus
files:
  - src/view/render/roadmap.ts
  - test/view/roadmap.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The shelf leads the horizon board

## Evidence

Asked for directly: the shelf shall be the first band on the horizon board, so the
untriaged rest sits above the columns it feeds and a drag into a bucket starts from the
top of the pane instead of after the tallest column. The board's own no-state strip
already leads its columns for the same reason, and the Alt+arrow ladder has led with the
shelf since it existed — the frame now says what the ladder already did.

## What moved, and what only looks like it did

`renderRoadmap` renders the shelf before the buckets on the horizon axis — into the frame
and into `roadmap.cards`, so the keyboard walk matches the frame: shelf first, then the
buckets as they render, then context. The grid axes keep their order (their conflicts are
computed by the timeline render, so their shelf cannot be hoisted above it, and nothing
was asked of them). The Alt+arrow placement ladder is UNCHANGED — it was already
shelf-first — and so are the scroll boxes, which are keyed by band, not by position.

## Checks

The walk order is pinned in `test/view/roadmap.test.ts` (`walks the cards with arrows…`,
now shelf-first with `Home` landing on the shelf) and the two-step selection in
`test/view/roadmapMoves.test.ts` documents the same fact from the move side.

Looking at it is what earned the band its second declaration: at the top of the frame the
shelf came out 109px of its 225px allowance, showing a sliver of a card rather than a card
to pick up, because a `max-height` says nothing about `flex-shrink`. That is recorded with
the rest of the band rule in
[[The horizon board sized itself from whichever cards had rendered]]; measured after, the
shelf takes 223px above 507px of buckets at a 766px pane. A themed vault's spacing is
still the release sweep's (ADR 0020).
