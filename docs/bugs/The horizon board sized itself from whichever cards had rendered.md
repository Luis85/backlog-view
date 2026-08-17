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
`overflow-y` — while keeping the sticky pinning the dated axis resets.

After, same harness: the frame is 900px in every rendering state — as loaded, planted,
all-rendered, restored — buckets 284px each at that pane, 517px each at 1600px in both
layouts, the floor case (620px pane) scrolls a stable 888px to a reachable end, the shelf
is on screen at the foot, and every bucket scrolls internally. A folded bucket still takes
its 44px strip, and the dated axis still draws its shelf `static` and un-capped-sideways.

## What is checked, and what is not

`test/view/roadmapBoxing.test.ts` pins the five declarations as text over the stylesheet,
`timelineBoxing.test.ts`'s shape and its honesty: it fails when one is dropped, and it
cannot see a later override or tell you what the pane looks like. jsdom computes no
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
