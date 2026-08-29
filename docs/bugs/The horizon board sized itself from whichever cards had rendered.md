---
type: Bug
parent: "[[The horizon board]]"
order: 70
status: Done
area: view
priority: P1
created: 2026-08-17
closed: 2026-08-17
source: Reported from a vault with five horizons and ~100 placed items; reproduced and measured in the browser harness
files:
  - styles/roadmap.css
  - test/view/roadmapBoxing.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The horizon board sized itself from whichever cards had rendered

## What happened

Three symptoms, reported together after [[Every card renders, on screen or not]] landed:
in grid mode the pane jumps around near its right edge and the end cannot be reached; with
the grid off ([[Turning the bucket grid off]]) every bucket is far wider than its share;
and with a bucket a hundred cards tall the shelf sits below all of them, out of the
viewport.

All three are one cause with a second one under the third. The frame is
`min-width: max-content` so the pinned strips can follow a sideways pan, which makes a
bucket's intrinsic width its widest card's UNWRAPPED content — the guarantee of
[[Buckets that use the room they have]], "share the full width equally, down to a 280px
floor", quietly stopped being true the day that arrived, visibly so in list mode where
`1fr` hands the whole answer to one card per row. `content-visibility: auto` then made the
answer UNSTABLE: a skipped card contributes its placeholder, a rendered one its real
width, so the frame resizes as cards render under a scroll and the right edge recedes from
the reader chasing it. And the buckets band had no height cap at all — the frame grows to
the tallest bucket (by design, until now), `.pbl-bucket-cards`' own `overflow-y: auto`
never engages, and the shelf renders thousands of pixels down.

## Measured

Browser harness, `?notes=800&view=roadmap&axis=horizons`, 900×700 window, long titles
planted on every 15th card as a stand-in for a real vault's. One page, three widths for
the same content: **1746px** as loaded with most cards skipped, **2165px** with every card
forced to render, **1817px** with containment restored — the width was a function of
rendering history, which on screen is the jumping. The frame stood 16258px tall against a
553px pane, the shelf at the very bottom; no bucket scrolled.

## Fix

`styles/roadmap.css` only. `contain: inline-size` on `.pbl-bucket` takes card content out
of the width question entirely — a bucket's intrinsic contribution is its 280px floor, so
the frame is `max(pane, floors)` and nothing that renders can move it. For the height, the
horizon axis takes the board's own shape: the frame owns the pane
(`.pbl-roadmap-mode:not(.pbl-roadmap-dates)`, `height: 100%`), the buckets band flexes,
`max-height: 100%` on the bucket lets its cards box finally scroll, and the shelf, the
context strip and the advisory join the dated axis's band rule — a maximum plus their own
`overflow-y` — while keeping the sticky pinning the dated axis resets. The advisory has
since been taken off the maximum: it draws only when the axis, the shelf and the context
strip are all empty, so a cap on it could only ever clip the one thing on screen, and did.
It keeps the `overflow-y`; the two halves are separate declarations for exactly that
reason.

After, same harness: the frame is 900px in every rendering state — as loaded, planted,
all-rendered, restored — buckets 284px each at that pane, 517px each at 1600px in both
layouts, the floor case (620px pane) scrolls a stable 888px to a reachable end, the shelf
is on screen at the foot, and every bucket scrolls internally. A folded bucket still takes
its 44px strip, and the dated axis still draws its shelf `static` and un-capped-sideways.

## A cap is not a size, found by looking at the fix

The band rule above shipped as `max-height` plus `overflow-y`, the dated axis's pair — and
the picture showed a **109px** shelf where its own allowance was 225px: the header plus a
35px sliver of a 139px card, in a 766px pane at ~800 notes. A maximum bounds a band; it
does not stop the buckets asking for the room inside it, and `flex-shrink` defaults to 1,
so the band with `flex: 1 1 auto` beside it won. `flex: 0 0 auto` on the three horizon
bands is the missing half — 223px shelf, 507px buckets, a whole card row to drag from —
and it is deliberately not the dated axis's `0 1 auto`, which was copied without asking
what shrink meant next to a cap. A pane too short for both still overflows and scrolls: at
a 273px pane the shelf takes 75px and the buckets hold their 220px floor.

That mattered here rather than being cosmetic, because the shelf is what a card is dragged
FROM on this axis, and [[The shelf leads the horizon board]] had just put it at the top for
exactly that reason. Nothing in the suite could see it — jsdom computes no layout — and no
assertion was wrong; the declaration that states the invariant is pinned beside the others.

## What is checked, and what is not

`test/view/roadmapBoxing.test.ts` pins **seven** declarations as text over two stylesheets
— six of `roadmap.css`'s own and the bucket's `max-height: 100%`, which is declared in
`board.css` beside the column's — plus an eighth case that asks the whole of `roadmap.css`
for a cap on the advisory rather than only the rule anyone thought of. That is
`timelineBoxing.test.ts`'s shape and its honesty: it fails when one is dropped, and it
cannot see a later override or tell you what the pane looks like. The count is written here
rather than in the test file, and it will go stale the next time a declaration joins — what
does not is that each of them is one a render does not fail without. jsdom computes no
layout, so every number above is Chromium's through the harness, and appearance in a
themed vault stays the release sweep's (ADR 0020).

## Live-vault checks owed

- Five real horizons at a laptop pane: the row scrolls sideways at a constant width, the
  scrollbar thumb holds still while cards render, and the end is reachable.
- The shelf expanded over a real backlog: it scrolls within its 30% band and a drop on it
  still un-places.
- A bucket mid-scroll across a write batch: the board columns already live with the
  offset returning to zero on a data update; a bucket now scrolls, so it inherits that.

## Lesson

**A guarantee written before a frame changed under it is not a guarantee.** "Share the
room equally" was measured true in a frame whose width was the pane's, and nobody
re-asked it when `min-width: max-content` arrived for the strips — it took the width
becoming VISIBLY unstable, one feature later, for anyone to notice it had been
content-driven the whole time. The declaration that states the invariant now sits on the
rule the guarantee is about, with a check that fails without it.
