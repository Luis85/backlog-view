---
type: PBI
parent: "[[The timeline]]"
order: 60
status: Done
priority: P2
created: 2026-08-07
files:
  - src/view/render/timeline.ts
  - src/view/interactions/timelineLeadResize.ts
  - src/view/interactions/timelineDrag.ts
  - src/view/render/roadmap.ts
  - src/view/render/projections.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/collapseState.ts
  - src/storage/collapseStore.ts
  - styles/timeline.css
---

# A resizable lead column

**As** someone reading the dated axis, **I want** to resize the title column myself,
**so that** a real title has room to read instead of the roughly 68px a fixed 220px
column leaves it once the type badge, its padding and the gap between them take their
share — a gap this plugin measured and a user asked to fix with a drag rather than a
bigger constant, since no single number fits every vault's titles.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The reader drags the grip at the lead column's right edge, or focuses it and presses an arrow key or Home |
| **Preconditions** | Roadmap mode is on, the dated axis is drawn |
| **Guarantee** | The width is UI state — per saved view, per device, beside the zoom and density picks — never the `.base` and never a frontmatter write. It is resolved once per render, clamped to what the pane can actually give, and used for both the CSS column and every mark placed against it, so a resize can never leave the grid and its marks disagreeing and a stored width wider than the pane can never cover the whole grid. |

**Main flow**

1. The timeline header carries a resize grip pinned to the lead column's right edge:
   `role="separator"`, a real tab stop, `aria-orientation="vertical"`, and
   `aria-valuenow`/`aria-valuemin`/`aria-valuemax` stating the current width and its
   bounds.
2. Dragging it resizes the column live — the CSS custom property alone, so nothing
   re-renders mid-gesture — and releasing persists the settled width once.
3. Focused, ArrowLeft/ArrowRight step the width by a fixed increment and persist each
   step immediately; Home returns it to the default width.
4. The persisted width is resolved once per render and threaded through every place
   that used to read the fixed default directly: the CSS variable, the today line, the
   milestone lines, the gridlines, the scroll-centring math, and the drag-and-drop
   grid's own lead-column hit test.
5. The pick comes back across a reopen, per saved view per device, exactly like the
   zoom and density beside it.

**Extensions**

- **2a — dragged past either bound.** Clamped to `MIN_TIMELINE_LEAD_PX` /
  `MAX_TIMELINE_LEAD_PX` rather than accepting whatever the pointer names.
- **3a — a step (or a drag) lands back on the default width.** Stores null, not the
  default number — the same "absence is the default" rule `density` already follows,
  so the entry needs no field for the common case of never having resized at all.
- **2b — the platform cancels the gesture.** Palm rejection, an orientation change, or
  another gesture taking over ends the drag with `pointercancel`, and the width it had
  reached is one nobody chose: the column goes back to where the gesture found it and
  nothing is stored. Only a release commits.
- **5a — a stored width this plugin never wrote, or one outside the clamp range.** Read
  defensively and dropped, like every stored pick: the view opens at the default width
  rather than trusting a corrupt-but-plausible number into the layout.
- **4a — the pane is narrower than the stored pick.** Picking 480px in a wide split and
  then narrowing it (or rotating a phone) used to draw the full stored width regardless,
  covering the whole grid with an opaque column and pinning the grip off-screen where
  nothing could reach it. The width actually DRAWN now clamps to what the pane can give,
  reserving a minimum for the day track so the grid never disappears entirely; the
  STORED pick is untouched, so it returns in full the moment the pane widens again — the
  same rule `density` and the axis pick already keep. A measurement of 0 or less
  (unmeasured: jsdom, or Obsidian rendering before layout settles) reads as "not
  measured", never "clamp to the minimum", and falls through to the stored width. The
  pane's own `ResizeObserver` re-renders the dated axis when, and only when, this
  effective width actually changes, so narrowing a live split recovers reachability
  without a reader having to trigger a render some other way.

- **1a — two contacts on the grip at once.** A column boundary is dragged by ONE
  pointer: a second `pointerdown` while a gesture is in flight is refused outright, and
  every move, release and cancel answers only to the contact that started it. Otherwise
  a second finger's release commits a width the first was not aiming at.
- **4b — a pane too narrow to give the storable minimum AND a day track.** Both ends of
  the announced range come from the pane, not just the ceiling: below
  `MIN_TIMELINE_LEAD_PX + MIN_DAY_TRACK_PX` a fixed `aria-valuemin` would sit above
  `aria-valuemax`, handing assistive tech a backwards range in exactly the narrow case
  the clamp exists for. Narrower still, the column takes half the pane rather than the
  pane minus a whole day track, which reached zero — no titles at all, a worse answer
  than a cramped column.

- **2c — a gesture aimed past what the pane can draw.** Pointer and keyboard updates
  clamp to `leadBoundsFor(available)`, the same range the separator announces — not to
  the storable bounds. Otherwise a drag put a width on screen and into `aria-valuenow`
  that exceeded `aria-valuemax`, covered the reserved day track, persisted, and was
  thrown away by the very next render. It does not narrow a pick already stored from a
  wider pane: that one is clamped for display and returns in full.
- **2d — a gesture that changes nothing.** A tap, a drag ending where it began, or a
  drag or ArrowRight pushing further into a ceiling the column already sits at: all
  commit nothing. The test is the resulting WIDTH, not the pointer's delta — at the
  pane's ceiling a real gesture produces a real delta whose clamped target is the width
  already drawn, and committing it would write the clamp back over a wider stored pick
  and lose it for good. Home is the exception by design: it is an explicit reset and
  clears the pick whatever is on screen.

## Acceptance criteria

- The grip carries `role="separator"`, `aria-orientation="vertical"`, a real
  `tabindex="0"`, and `aria-valuenow`/`aria-valuemin`/`aria-valuemax` matching the
  resolved width and the clamp bounds.
- Dragging updates only the CSS custom property until release: `config.setCalls` and
  the vault's write log stay empty through the whole gesture, and exactly one width is
  persisted, at its end — never one per `pointermove`.
- ArrowLeft/ArrowRight on the focused grip step the width and persist each step
  immediately; Home returns it to the default and clears the stored pick; neither
  touches a note or the `.base`.
- A stored width outside `MIN_TIMELINE_LEAD_PX..MAX_TIMELINE_LEAD_PX`, or one that is
  not a finite number, reads back as absent rather than trusted into the layout.
- The today line, the milestone lines, the gridlines and the drag-and-drop grid's own
  lead-column hit test all use the SAME resolved width the CSS column draws at, at
  every width a reader has picked — never the fixed default once the column has been
  resized.
- Focus returns to the grip's own replacement after a rebuild the grip's own drag
  release or keypress caused, so a keyboard user resizing by repeated presses is never
  dropped back to the document body after the first one.
- Never written to the `.base`: UI state per saved view per device, beside the density
  and zoom picks it is validated and restored exactly like.
- A stored width wider than the pane it is drawn in renders CLAMPED: the CSS column, the
  today/milestone/gridline math and the grip's own `aria-valuenow` all agree on the
  clamped number, `aria-valuemax` states the widest the pane can currently give rather
  than the storable maximum, and `host.leadWidth` keeps reporting the full stored pick.
  An unmeasured pane (`clientWidth` 0 or less) never clamps. Narrowing the pane after the
  fact re-renders the dated axis to the newly effective width, and only when that width
  actually changed.

## Where it lives

The grip's markup and its drag/keyboard wiring are `src/view/interactions/timelineLeadResize.ts`,
mounted from `renderCellHeader` in `src/view/render/timeline.ts` — which is also where
the effective width is resolved once per render: the stored pick (or `TIMELINE_LEAD_PX`)
clamped against the pane by `effectiveLeadWidth`, also in `timelineLeadResize.ts` beside
`clampLeadWidth` — a pure function of the stored width and the measured available pixels,
reserving `MIN_DAY_TRACK_PX` for the day track and treating 0-or-less as "not measured"
rather than clamping to nothing. The one resolved value is threaded through the CSS
custom property and the today-line/milestone-line/gridline math that used to read
`TIMELINE_LEAD_PX` directly, the bug commit 791e1da already fixed once at a fixed width.
The resolved width rides on `RoadmapSnapshot.leadWidth` (`src/view/host.ts`), populated in
`src/view/render/roadmap.ts` from the pane's own `treeEl.clientWidth` — the same element
`src/view/backlogView.ts`'s `ResizeObserver` watches — so `centreOnToday` in
`src/view/render/projections.ts` and the drag-and-drop grid's own `overLeadColumn` hit
test in `src/view/interactions/timelineDrag.ts` read the same number the column is
actually drawn at rather than the constant, and so the ResizeObserver-driven `onResize`
in `backlogView.ts` (extended here to cover the dated axis, guarded by the same
`refitting` flag the tree's column ladder already uses against recursion) can compare a
fresh measurement against exactly what was last drawn. The pick is stored exactly like
`density`'s own shape — a `leadWidth` field in `src/storage/collapseStore.ts`, validated as
a finite number inside `MIN_TIMELINE_LEAD_PX..MAX_TIMELINE_LEAD_PX` rather than checked
against an enum, since it is the first stored pick that is a number rather than a name —
held in `src/view/collapseState.ts` and exposed through
`BacklogViewHost.leadWidth`/`setLeadWidth` in `src/view/host.ts` and
`src/view/backlogView.ts`. The grip's own styling, beside the lead column's, is
`styles/timeline.css`. Driven in `test/view/timelineLeadResize.test.ts` and
`test/storage/collapseStore.test.ts` — the pane-resize path through a minimal
`ResizeObserver` double, `test/helpers/dom.ts`'s `fireResize`, since jsdom implements
none.
