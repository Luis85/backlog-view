---
type: Bug
parent: "[[The render path states its costs as checks]]"
order: 35
status: Done
area: performance
priority: P1
created: 2026-08-14
closed: 2026-08-14
source: Reported against the kanban board and views showing the shelf; reproduced and measured in the browser harness
files:
  - styles/cards.css
  - src/view/CLAUDE.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Every card renders, on screen or not

## What happened

The board is sluggish, and so is a roadmap whose shelf holds the bulk of the backlog.
[[The render is the whole cost of a data update]] took the tree's half of this — a row
carries `content-visibility: auto` and the browser skips layout and paint for the rows
below the fold — and the CARDS never got it. A board column shows perhaps eight of its
cards; it laid out and painted all of them, and so did every horizon bucket and the
shelf.

## Measured

The browser harness, `?notes=800&perf`, ~800 generated notes over the demo fixture.
**Interleaved A/B**, the same bundle against two stylesheets alternated within one loop,
medians of three runs each — the method [[The render is the whole cost of a data update]]
records, and for its reason: this environment's run-to-run swing is larger than several
of the numbers below.

| op | before | after | delta |
| --- | --- | --- | --- |
| switch to board | 368 ms | **138 ms** | −63% |
| switch to roadmap (buckets + shelf) | 418 ms | **154 ms** | −63% |
| switch to deliverables board | 35 ms | **27 ms** | −24% |

The tree's own rows already had the property, so its `update`, `render only` and
`switch to tree` rows moved by ±10% and read as this instrument's noise, which is what
they are.

**Still linear, still every card built.** This removes the LAYOUT and PAINT half for a
card nobody can see and none of the DOM-building half; the board at ~800 cards still
spends ~0.17 ms per card constructing them. The class of the cost is unchanged and
[[The render is the whole cost of a data update]] stays open for it.

## Fix

Three container selectors in `styles/cards.css`, and no code at all.

**The containers, not `.pbl-card`.** The timeline's lead rows are cards too, and
`render/timelineArrows.ts` calls `getBoundingClientRect()` on them while it draws an
arrow between two bars. A layout read on a SKIPPED element lays that element out by
itself, which is the 5320ms-against-12ms trap `styles/tree.css` records at its own
declaration — so a blanket rule would have made the dated axis worse to make the board
better. The board's columns, the horizon buckets and the shelf measure nothing.

`contain-intrinsic-size: auto 110px`: `auto` so the first draw records the card's real
height and the placeholder uses it afterwards, 110px because that is the median drawn
card height at ~800 notes — the fallback for a card nobody has scrolled to yet.

## What is checked, and what is not

Nothing asserts a timing here, and nothing may: ADR 0020 keeps that refusal and this
change does not reopen it. What the suite does hold is the reason the rule is scoped the
way it is — `test/view/renderCost.test.ts` already spies the layout-read getters over a
row's whole subtree, and the timeline's reads are named there and in `src/view/CLAUDE.md`
as the ones that are staying.

**Not checked: the property's effect.** jsdom does not implement `content-visibility`,
so the suite cannot see that a card is skipped, and the harness asserts nothing. The
measurement above is a human reading a panel in Chromium.

## The scroll position after a rebuild, asked and answered

Review (Codex) put the sharpest question at this: a data update captures a band's pixel
`scrollTop`, destroys every card with `treeEl.empty()`, and rebuilds — and the new cards
have lost `auto`'s remembered heights, so the cards above the fold are 110px placeholders
and the same offset restored could land the reader somewhere else.

**The mechanism is real and its reach is one band.** `scrollBoxes`
(`render/projections.ts`) captures the pane and the roadmap's own boxes — the timeline,
the shelf, the context strip, the advisory. A board column and a horizon bucket are
scrollers that nothing captures, so their offset already returns to zero on every data
update, with or without this rule. The shelf is the one card container that is restored,
and it only SCROLLS on the dated axis, where the band rule caps it at 30% of the frame.

**Measured, and it does not move.** The harness with a throwaway probe: expand the shelf,
scroll it to 30%, 60% and 90% of its range, note the card at the top, `onDataUpdated()`,
restore, and ask which card is at the top now. Over a 134-card scrolling shelf, twice per
stylesheet, the reader lands on the SAME card at all three depths, before and after. The
placeholders do shrink the band — 5055px of scroll range becomes 4829px, ~1.7px per card
— and that was not enough to cost a card at any depth tried.

Two stand-ins in that probe, and neither is hidden: the harness pane has no height cap, so
the horizon shelf was given the dated axis's own `max-height`/`overflow-y` to make it
scroll at all, and the dated shelf this fixture really draws holds 20 cards rather than
134. So what is measured is a 134-card scrolling shelf, not this vault's dated one.

The same trade is what the tree has shipped since `content-visibility` arrived there: rows
are rebuilt on every update under `contain-intrinsic-size: auto 30px`, restored by the same
pixel offset, through the same function. Fixing it for cards alone would have left the
projection with the most rows still doing it.

## Live-vault checks owed

The row's list, asked again of a card — none of it can be answered here.

- **A skipped card is still in the accessibility tree.** This is `auto`, not `hidden`, so
  `aria-activedescendant` still resolves to a card below the fold; what Obsidian's own
  Chromium reports to a screen reader for a skipped subtree is unverified.
- **Keyboard and Alt+arrow moves scroll to the right card.** The placeholder is 110px
  until a card has been drawn once, so a jump into never-rendered territory could land
  slightly off before settling.
- **A deeply scrolled DATED shelf keeps its place across a write batch.** Measured above
  and unmoved, but over a shelf made to scroll by a probe rather than by this fixture —
  scroll a real one to its end, drop a card, and see whether it stays put.
- **A drop still highlights the whole column, bucket or shelf.** The target is the
  container, which takes no containment, and the selected card's ring is the element's
  own `box-shadow` — which paint containment does not clip, verified in Chromium against
  a plain box. Both were reasoned about before they were measured; look at a real drag.

## How to check

```
npm run harness
```

then open the printed URL with `?notes=800&perf`, and read the board and roadmap switch
rows. `?view=board` and `?view=roadmap` open into a projection to scroll by hand.

## Lesson

**A rule fixed at one of its instances is fixed at one of its instances.** The tree got
`content-visibility` the day the cost was measured, and the note that recorded it is
written entirely about rows — so the four other places this codebase draws a scrolling
list of items kept paying, for four days, with the fix already in the stylesheet a few
lines above them. That is the same shape as [[The drag cleanup scans the whole tree]] and
[[Hovering a row measured its own width]], both of which were a category rule checked
where its author was standing. Here nothing was even checked wrongly: the second half was
never asked for.
