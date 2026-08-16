---
type: PBI
parent: "[[Hierarchy on the roadmap]]"
order: 30
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/model.ts
  - src/view/render/columns.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-15
risk: ""
assignee: ""
---

# Progress on the bar

**As** someone reading a roadmap bar, **I want** its fill to show how much beneath it
is done, **so that** "how far along" travels with "when" instead of living in another
view.

Fill-equals-completion is the one rendering every surveyed tool shares — Linear's bars
fill by issue completion, Aha! colors progress onto releases, Jira draws progress per
epic — and the number here is already computed: the done-over-total rollup the tree
shows ([[Rollups and hiding finished work]]). The count is honest about being a count:
Jira's own community documents how one done story of two reads as half even when it was
the small one, and the trackers' answer is an estimate field this schema does not have.
Counting what exists beats estimating what does not, and a stored percentage is the
thing that drifts.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A roadmap bar or card renders for an item with descendants |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | Progress is derived at render from the same rollups the tree shows — never stored, never counting a context row — so every projection reports the same number for the same item. |

**Main flow**

1. A parent's bar or card fills by the done share of its counted descendants, and
   carries the same done-over-total the tree's rollup column shows.
2. A done item styles done, and a fully done subtree follows "Show completed items"
   exactly as it does everywhere else.
3. Context rows pass through uncounted — the rollup walk's own rule, which the register
   already drives with an invariant test.
4. Health, where a team wants it, is a hand-set property rendered as a chip like any
   other property — the surveyed trackers treat health as a judgement, and nothing here
   computes one.

**Extensions**

- **1a — the item is a leaf.** No fill and no counts render — the tree's rule for the
  rollup column, unchanged: an empty measure is not a zero.
- **1b — the user expects story points.** Counts are what exist: the schema has no
  estimate field, and the fill says what it counts. If estimates ever arrive, the
  fill's source is one derivation to widen — the reason the trackers make the
  calculation configurable — but a measure must never imply data nobody recorded.
- **1c — no state property is configured.** There is no done to count, so no fill
  renders and no percentage is implied: the bar carries the descendant count the
  tree's rollup column shows in exactly this configuration. A fill without a workflow
  would report every subtree as unstarted, which is a claim nobody made.
- **2a — "Show completed items" is off and the subtree is done.** Bar, card and any
  context row that stood only for it hide together; restoring the option restores
  them — the two narrowings rule the board states.
- **3a — a context parent's own fill.** It describes its visible results only — stated
  once in the model's walk and inherited by every projection that reads it.

## Acceptance criteria

- A parent's fill and counts equal the tree's rollup for the same item — derived at
  render, stored nowhere, identical across projections; with no state property
  configured, no fill renders and the descendant count is the whole report, as in
  the tree.
- Leaves render no fill and no counts.
- Progress is count-based and says so; no estimate machinery is invented, and no
  percentage is ever written to a note.
- Context rows are never counted, and a context parent's fill describes its visible
  results only.
- Done styling and completed-hiding follow the same rules as the tree and board;
  health is a hand-set property chip, never computed and never required.

## Where it lives

**Built.** `renderBarProgress` in `src/view/render/barProgress.ts` draws both halves —
the band inside the bar and the count in the lead cell — from the rollup fields
`src/domain/model.ts` already assigns, in the words `renderRollup` already uses. Its
own module because `src/view/render/timeline.ts` sits at its 400-line budget, the same
reason `barLabel.ts` and `lanes.ts` left that file before it.

The band is inset inside the bar rather than washed over it, because a bar's
background already says whether its span is inferred (`background: none` plus a dashed
border) and whether either end is unstated (a gradient fading to transparent) — claims
a full-height child would paint over. It is a track and a fill in the tree's own two
progress colours rather than the bar's, since `.pbl-bar` is painted in that colour and a
band wearing it would be invisible on every ordinary span. `renderBarRow` in
`timeline.ts` passes a null bar for a milestone and for an outside-window arrow, which
are marks rather than spans, and `renderLaneContextRow` in `lanes.ts` passes null
because that row draws no bar at all; all three still render their count. A fourth
case joined 2026-08-15: `bandMount` in `barProgress.ts` also nulls the bar drawn at
`MIN_BAR_PX`, read from the same width `--pbl-bar-width` sets rather than recomputed —
the two 2px insets consume a floor-width bar whole, which is the whole rule: the guard
is `<= MIN_BAR_PX`, so a bar one pixel wider bands like any other; the count still
renders. No context item is banded on any axis, because
`deriveBars` routes one to `context` before a placement is computed for it. The count is also announced once on the row itself, as a
`.pbl-sr-only` fact, because both bar rows and the context row already tooltip the lead
cell with the item's own title — a tooltip that, in the real app, may become an
`aria-label` replacing the cell's text and taking the count with it. jsdom's `setTooltip`
mock cannot show that either way, so whether the real app actually does this is a
live-vault question this suite cannot answer.

The two elements are styled in `styles/barProgress.css`, a partial of its own for the
module's own reason: `styles/timeline.css` was one line under its 400-line cap with them
in it. Position in `styles/index.css` is not load-bearing — both selectors are new and
neither overrides a rule that file makes.

Driven in `test/view/barProgress.test.ts`. **Neither the inset nor the contrast is
checked there** — jsdom computes no layout and resolves no custom property to a colour,
so a full-height band in the bar's own colour passes every assertion in that file. Both
are on the live-vault list in the spec. The **compact density** was on that list too and
comes off it: nothing about the band changes with density, because nothing about the bar
does — `.pbl-density-compact` sets a track `min-height` and drops the lead's padding, and
`.pbl-bar` is 14px in both. What stays a vault question is narrower and is the same one
the default density already asks: whether a 4px band is legible at all.

**The band carries a 1px hairline** (`outline: 1px solid var(--background-primary)`,
`outline-offset: 0`, on `.pbl-bar-progress`) because a done row's own override
(`--color-green`) and the fill's own paint (`rgb(var(--color-green-rgb))`) resolve to the
SAME colour — measured `#44cf6e`, contrast 1.00, in a `npm run harness` pass 2026-08-15,
and still 1.00 with the hairline in place, because the hairline does not change what
colour the fill paints. **What it fixes is the band's EXTENT, not its colour
collision.** Before the hairline, a done bar's band had no visible edge at all: the fill
and the bar underneath were indistinguishable, so only the unfilled remainder showed,
reading as a gap rather than as progress, and at 100% (no remainder left) the band
vanished outright. With the hairline, the band's own boundary is drawn in a third colour
no bar is ever painted in, so the band's SHAPE is always visible — **on a done bar, the
ratio is recoverable by reading the dark (unfilled) remainder and inverting it**, and at
100% the ring reads as a full rectangle rather than as nothing. That is weaker than
"fixed": **a ring around a solid, same-coloured fill is still ambiguous** — it looks
exactly like a ring around an EMPTY capsule as much as a full one, since colour alone
does not distinguish the two once the interior offers no cue. The count in the lead cell
is the one place that distinction still lands unambiguously; the band's own contribution
on a done row is "there is a band here, of some extent" rather than "here is the exact
ratio." **And the done case has no configuration escape**, as of `1728b67` on main: the
state-colour dialog now lists open states only, because a finished bar is drawn green
whatever is stored against it. So a reader cannot recolour their way out of this
collision on a done row — it is structural, not an unlucky default, and any real fix has
to be in the band rather than in the palette. An open state a reader paints green is the
other half, and that one they can undo.

Not scoped to `.pbl-done`: a workflow state a reader has painted green through
`stateColorPaint` hits the identical collision on a row that carries no done state at
all, and a rule keyed to the class would miss it — the hairline separates the band from
ANY bar colour instead. `outline`, not an inset `box-shadow`: the shadow paints in the
background/border step, before the fill CHILD renders, so at 100% fill — the case a
bar-coloured fill needed the hairline for most — a shadow would sit invisibly under the
fill; an outline paints over an element's own descendants, so it stays visible whatever
the fill's width. `outline-offset: 0` (drawn OUTWARD from the track's own border-box),
not the inward negative offset first shipped: an inward ring eats the band's own 4px
interior from both sides — measured 2px of 4px, HALF the band, on EVERY bar this rule
touches, not only a done one, which cost more legibility than the colour collision it
was fixing. Outward is safe because the band is already inset from the bar's own edges:
for an ordinary or open-ended bar (no border) the ring's outer edge lands exactly ON the
bar's own edge — harmless, since nothing else is painted there — and for an INFERRED
bar, whose 1px dashed border shrinks the CONTAINING BLOCK the track is positioned
against (an absolutely positioned child's containing block is its parent's PADDING box,
inside any border), the track sits a full 2px inside the bar's true edge rather than 1px,
so the ring's outward 1px still leaves a clear 1px gap before the dashed border — measured
geometrically (`getComputedStyle`, not guessed) and cross-checked with a pixel scan, both
in `.superpowers/harness-band-fix.md`. Measured in Chromium: the two independent
guarantees hold — hairline against fill and against the bar itself both read at
4.75–8.44:1 across a done row at 100%, a done row at a partial ratio, the ordinary
control case and the state-slot colours — while the band's own 4px interior is fully
readable at every one of them, which the inward offset had quietly halved. jsdom resolves
no colour either, so `test/view/timelineBoxing.test.ts` pins the rule's TEXT only — the
outline declaration, the outward (non-negative) offset, and that the colour is neither
progress token — refusing the deletion rather than the appearance; the harness pass is
what looked. **What remains a live-vault question, not a solved one**, is listed in
`docs/tests/cases/Roadmap inferred bar appearance.md`: a done bar's ratio is read by
inversion rather than directly, and a 100%-done band is ambiguous against an empty one.
