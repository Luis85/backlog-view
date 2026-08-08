# Gantt reading polish on the dated axis — design

Spec for the first of four increments toward "a top-notch, user-friendly gantt chart"
on the roadmap's dated axis. Date: 2026-08-05.

## The decomposition this spec sits in

The whole ask spans four sub-projects, sequenced so each draws on a settled grid:

1. **Visual & reading polish** — this spec. New design; render + CSS + one store field.
2. **Lanes** — specified in the register as [[Lanes on the roadmap]] (and
   [[Swimlanes by parent]] for the board), implemented next.
3. **Hierarchy & interaction** — [[Progress on the bar]], [[Focus level picks the rows]]
   and the keyboard lift in [[Keyboard and menu on the roadmap]] are specified in the
   register and need implementation plans, not design.
4. **Dependencies between bars** — not in the register at all; needs its own
   brainstorming session (schema, write rules, rendering) once the grid it draws on is
   settled. Deliberately last.

Nothing in this increment touches a write path, the drag geometry, or the projection
model, which is what keeps it safely ahead of the lanes implementation instead of
colliding with it.

## What ships

Five bundles, each independently shippable:

- **Grid rhythm** — vertical cell-boundary lines in the grid body, weekend shading at
  week zoom, a labeled Today marker in the header (superseded 2026-08-07 by
  [[State colour and a legend]] — the marker is unlabeled again, named by the legend
  strip instead).
- **Two-tier header** — months above weeks, years above months, years above quarters.
- **Row tracking** — row hover highlight, subtle zebra striping (the shadow on the sticky
  lead column once scrolled shipped and was removed on 2026-08-08: a reader found it
  noise rather than a hint, and a stripe already says where the column ends).
- **Bar labels** — the item's title beside its bar, side picked from geometry.
- **Row density toggle** — compact/comfortable timeline rows, stored as UI state.

## What does not ship, and why

- **Dependencies, progress fill, lanes, the lift** — other increments, per the
  decomposition above.
- **Dates in the lead column** — offered, declined. Addable later without rework.
- ~~**Resizable lead column** — offered, declined.~~ Out of date: it shipped —
  [[A resizable lead column]] — once the fixed 220px was measured against a real
  vault and left a title only ~68px to itself. This line is kept struck through
  rather than deleted so the spec does not silently start contradicting what ships.
- **Weekend shading at month and quarter zoom** — at 4px/day and 2px/day the stripes
  are noise; the surveyed tools stop shading around the same density.

## Approach

Every new mark is what the milestone line already is: an absolute, `aria-hidden`,
`pointer-events: none` element positioned in days × `scale.dayPx`, emitted from the
same `timelineCells` loop the header already runs. Two alternatives were considered
and rejected:

- **One SVG/canvas background layer.** Fewer DOM nodes at week zoom, but a foreign
  mechanism this codebase and its tests don't have, saving nodes nothing needs saved —
  the header already draws ~260 cell divs at week zoom without trouble.
- **Real per-cell row elements** so borders and shading come free from CSS. Multiplies
  DOM by the cell count per row — the render-cost rule in `src/view/CLAUDE.md` failing
  by design.

## Design

### 1. Grid rhythm

**Body gridlines.** `renderTimeline` already computes `timelineCells(window, scale)`
for the header; the same list also emits one `.pbl-grid-line` div per cell *boundary* —
every cell start except day 0, which coincides with the lead column's border. Drawn
before the milestone lines so they stay visually behind everything. Faint dashed
border color: the header's own rhythm extended down the grid.

**Weekend shading.** One `.pbl-weekend-layer` div, not one per weekend: weekends repeat
every 7 days exactly, so the layer is a single gradient tiled to exactly seven days —
`background-size: calc(var(--pbl-day-px) * 7)` — and phase-shifted by a published
`--pbl-weekend-offset`: days from the window start to the first Saturday, computed by
a new pure `weekendOffsetDays(window)` in `src/domain/timeline.ts` on the ISO weekday
rule the module already uses. The tile size is what makes the shift correct rather than
decorative: a gradient left at its default size tiles at the layer's own width, so
shifting it exposes a repeat whose phase is that width's, not the week's, and any window
that is not a whole number of weeks gains a stray band at its left edge. Rendered at
week zoom only (see above).

**Today label — superseded 2026-08-07.** The pill this section designs shipped and was
later removed once a legend existed to name the today line's colour instead; see
[[State colour and a legend]] in the register. Kept below as the record of why it was
built the way it was; the header band it describes no longer exists.

The today line keeps its tooltip and gains a small "Today" pill,
red-tinted to match the line — the milestone label's existing pattern with a different
color. It gets a **strip of its own** above both header tiers, because it is opaque and
placed by a day offset, and in either tier it would eventually land on top of something
that matters: a milestone label dated today, whose hover reveals a name nothing else
states, or the super tier's `2026` — the only place the year appears once the cells drop
it. The two full-height LINES dodge each other inside one day by a 1px nudge; two labels
are wide enough to overlap for days either side of the date, so nothing short of separate
strips settles it. The strip costs one empty div and no reserved-height constant: the
pill stays in flow and is nudged sideways with `position: relative`, so the band is
exactly as tall as the pill turns out to be. The exact date stays in the tooltip.

### 2. Two-tier header

A coarser orientation band above the cells: months above weeks, years above months,
years above quarters. One new pure function in `src/domain/timeline.ts` —
`superCells(window, scale)` — reusing the existing unit walk with the mapped coarser
unit; `year` becomes a fourth internal unit that only `superCells` can produce. Both
tiers clip at the window edges by the existing rule.

The bottom tier drops the year the top tier now carries: month cells label `Aug`
instead of `Aug 2026`, quarter cells `Q3` instead of `Q3 2026`. Week cells keep
`4 Aug` — a week can straddle two months, so its own label stays self-sufficient.

Structurally the header becomes lead + a stack of three strips: an empty band, the super
tier, the cells. `TimelineRender.headerTrack` keeps pointing at the *cell* track, so
milestone labels and the drop ghost's date preview keep their mount unchanged; the today
pill takes the band for the reason above. Cell widths don't change, so
`jumpToToday`'s centring math is untouched.

### 3. Row tracking

- **Hover:** `.pbl-timeline-row:hover` gets `--background-modifier-hover` across lead
  and track. The row is one element, but that is not enough on its own: the sticky
  lead paints an opaque `--background-primary` so the track can scroll under it, and
  an opaque child never lets its parent's background through. The lead therefore
  composes the same tint over `--background-primary` itself, in its own rule.
- **Zebra:** alternate rows get a `pbl-row-even` class from the render loop (CSS has no
  nth-of-class), tinted via `color-mix(… 50%, transparent)` so weekend stripes still
  read through it and hover stays clearly stronger.
- **Lead shadow — shipped, then removed 2026-08-08.** A reader found it noise rather
  than a hint; the stripe and the column's own border already say where the track
  begins, and nothing replaced it. The design as built is kept below rather than
  deleted, so this spec records what happened rather than only what survived. A passive
  scroll listener on the scroller toggled `pbl-scrolled-x`
  when `scrollLeft > 0`; CSS put a shadow on the sticky lead column only then. The
  scroller is rebuilt every render pass, so the listener cannot leak.

### 4. Bar labels

Each row's track gets one `.pbl-bar-label` div with the item's title — decoration only
(`aria-hidden`; the row's accessible name already carries title and dates). The side is
picked in TS from geometry: right of the bar when `barEnd + LABEL_RESERVE_PX` fits in
the track, else left of it — and no label at all when neither side has the room, which a
bar clipped at both window edges is the case of. Dropping it loses nothing: the row's
lead column carries the same title, which is the whole reason this is decoration. `barEnd`
is the width the STYLESHEET draws, not the span's: a milestone is a 12px diamond and an
out-of-window marker a 10px arrow however few days they cover, so measuring from
`--pbl-bar-width` would start the label inside the mark it names. Max-width plus ellipsis, muted, smaller font,
`pointer-events: none` so grips and the drop overlay never lose a hit. All labels hide
via CSS while `.pbl-dragging` — the grid declutters exactly when the user is aiming a
drop. Milestone diamonds get the same treatment through the same code path.

### 5. Row density toggle

`density?: string` on the collapse store's per-view entry, exactly the `zoom` field's
shape: enum-validated (`['compact']`), absent meaning comfortable, counted by
`entryHasContent`, retained like every persisted pick. `host.density` plus
`setDensity` re-renders only — UI state, never the `.base`, the store's own rule.

A toolbar icon button with `aria-pressed`, rendered only in roadmap mode on the dated
axis. CSS: a `pbl-density-compact` class on the timeline drops row min-height 34px →
24px and tightens lead padding; the 14px bar still fits. Horizon buckets are
untouched — this is the gantt's row height, not the card's.

## Checks

- **Node** (`test/domain/timeline.test.ts`): `superCells` unit mapping, labels and edge
  clipping; the two tiers' day totals agree with the window; `weekendOffsetDays`; the
  bottom-tier label change.
- **jsdom** (`test/view/roadmap.test.ts` or a split-off `timelineFurniture` suite if
  the file nears its 450-line budget): gridline count equals cells − 1; the weekend
  layer present at week zoom only, offset var published; two header tiers rendered;
  today label at the today offset; zebra alternation; the scroll listener toggling
  `pbl-scrolled-x`; the bar label flipping sides near the window's right edge; the
  density button rendered only on the dated axis, `aria-pressed` tracking the store,
  the pick round-tripping through save/load.
- **Stylesheet:** new rules go in `styles/timeline.css` (296/400 lines today); if the
  budget breaks, the furniture rules split into their own partial with its position in
  `styles/index.css` stated. The harness theme-stub test already gates any new Obsidian
  variable the rules read.
- **Harness:** `npm run harness` at `?view=roadmap` answers layout and interaction in
  both schemes; `npm run test-build` for eyes on a live vault.
- Coverage thresholds go up, never sideways.

`npm run check` — build, lint, coverage-thresholded tests, fallow, docs register — must
pass before committing.

## Register edits

- One new PBI, **Reading the grid**, under [[The timeline]] — landing as Done within
  the increment, so the feature stays Done; the one open remainder is the smoke-test
  line below. In the use-case shape, its `## Where it lives` naming `src/domain/timeline.ts`,
  `src/view/render/timeline.ts`, `src/view/render/toolbar.ts`,
  `src/storage/collapseStore.ts` and `styles/timeline.css`. The density pick is
  documented there beside the zoom pick it copies.
- A line on [[Smoke test the roadmap]] for the one thing only a themed vault can
  answer: whether the furniture stays furniture — visibly quieter than the bars —
  under a real theme.
- No new `src/` module, so docs rule 7 needs nothing beyond the notes above.
