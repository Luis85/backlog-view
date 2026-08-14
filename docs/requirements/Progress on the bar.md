---
type: PBI
parent: "[[Hierarchy on the roadmap]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/model.ts
  - src/view/render/columns.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
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
because that row draws no bar at all; all three still render their count. No context
item is banded on any axis, because `deriveBars` routes one to `context` before a
placement is computed for it. The count is also announced once on the row itself, as a
`.pbl-sr-only` fact, because both bar rows and the context row already tooltip the lead
cell with the item's own title — a tooltip that, in the real app, may become an
`aria-label` replacing the cell's text and taking the count with it. jsdom's `setTooltip`
mock cannot show that either way, so whether the real app actually does this is a
live-vault question this suite cannot answer.

Driven in `test/view/barProgress.test.ts`. **Neither the inset nor the contrast is
checked there** — jsdom computes no layout and resolves no custom property to a colour,
so a full-height band in the bar's own colour passes every assertion in that file. Both
are on the live-vault list in the spec, with the compact density's band height.
