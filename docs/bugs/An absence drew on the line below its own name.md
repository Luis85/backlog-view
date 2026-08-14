---
type: Bug
parent: "[[Resource absences]]"
order: 30
status: Done
area: styling
priority: P1
created: 2026-08-14
closed: 2026-08-14
source: User report with a screenshot — "the absences should go in their named row"
files:
  - styles/timeline.css
  - test/view/timelineBoxing.test.ts
---

# An absence drew on the line below its own name

## What happened

In a vault, every absence stretch drew one line BELOW the row naming it: the lead column
showed the icon and the title, and the hatched band sat in the empty line underneath,
against nothing. Two absences in one band produced four lines where the feature draws two,
and neither stripe was beside the name of the person it belongs to — which on an axis whose
whole subject is *whose row is this* is the one thing it had to get right.

## Why

A row of this grid is a sticky lead column beside a day track, side by side. That layout
was declared as:

```css
.pbl-card.pbl-timeline-row { flex-direction: row; align-items: stretch; ... }
```

Two classes, and `display: flex` inherited from `.pbl-card`. Every row that is also a CARD
matched it — a bar row and a context row both go through `createCard` — and an absence row
is deliberately neither: `renderLaneAbsence` builds a plain `.pbl-timeline-row` because an
absence is not a `BacklogItem`, has no selection, no activation and no place in the pane's
roving walk. So it matched neither half of the geometry, fell back to `display: block`, and
its two children stacked.

**The layout every row needs was attached to a class only some rows carry.** Nothing about
that was visible at the call site: `renderLaneAbsence` sets `pbl-timeline-row` and reads as
though it has therefore asked for the row layout.

Two reasons it reached a vault. jsdom computes no layout, so the whole suite could see the
markup was right and never that it drew wrong. And the harness — the tool that exists for
exactly this question — could not draw the resources axis at all: `demoOptions()` declared
no roster and `demoVault()` held no absence, so `npm run harness` showed the feature to
nobody. Both halves are fixed with the rule.

## The fix

`.pbl-timeline-row` carries `display: flex` and the direction itself; `.pbl-card.pbl-timeline-row`
keeps only the card CHROME it has to take back off (padding, border, background). A row is
laid out from being a row.

`test/view/timelineBoxing.test.ts` refuses the shape rather than the symptom: the layout
declaration must be on the single-class rule, and the card rule must state no `display` at
all. Its reach is a text check over the stylesheet, exactly like the `box-sizing` pair
beside it — it cannot tell you the row came out on one line, and says so. The demo fixture
now carries the axis, a declared-and-empty row and two absences (one of them minting a row
of its own), so the next question of this kind can be answered by looking.
