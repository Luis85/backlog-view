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
iteration: ""
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

**The claim has one stated exception, added the same day.** An EMPTY shelf is out of the
layout until a drag makes it a target, and revealed in place it inserted a band above the
buckets and dropped the whole board 41px under the pointer at dragstart (measured in the
browser harness at 1200x800 with everything placed: the buckets' top went 53px to 94px the
instant `.pbl-dragging` landed). It takes `order: 1` and is revealed at the FOOT instead —
the frame is `height: 100%`, so the buckets band gives that room up from its own bottom
edge and nothing on screen moves. The reason it costs nothing is the reason the shelf leads
at all: it leads because it is what a card is dragged FROM, and with nothing on it there is
nothing to drag. The argument lives on the declaration in `styles/shelf.css`, where a
contributor about to give the empty shelf a focusable control would be standing — that is
the one thing the exception rests on, since a reordered element out of its reading order is
a fact about the ELEMENT rather than about drag timing.

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
