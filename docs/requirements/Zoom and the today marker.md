---
type: PBI
parent: "[[The timeline]]"
order: 30
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/timeline.ts
  - src/view/render/toolbar.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/render/projections.ts
  - styles/roadmap.css
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-09
risk: ""
assignee: ""
---

# Zoom and the today marker

**As** someone orienting on a timeline, **I want** discrete zoom levels, a today line
and a one-action way back to it, **so that** I always know where in time I am looking —
even in a narrow split.

The conventions are settled: GitHub Projects zooms between discrete scales rather than
continuously, Asana anchors the view with a today line and a jump-to-today affordance,
and both scroll time horizontally inside the widget. The Obsidian-specific lesson comes
from the Time & Line beta: horizontal space is the scarce resource in a pane, embedded
and split views are routinely narrow, and a timeline that only works maximized does not
work. Discrete zoom also does quiet load-bearing work for the writes: a snapping grid
is what makes a drag mean whole units ([[Move and resize a bar]]).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Zooming, panning, or opening the timeline |
| **Preconditions** | Roadmap mode is on with the timeline axis |
| **Guarantee** | Zoom and scroll are render decisions that write nothing to any note or to the `.base`; at every zoom the same results place, only the granularity changes. |

**Main flow**

1. The timeline opens scrolled so today is in view, marked by a line.
2. The toolbar offers week, month and quarter zoom — discrete scales that change pixel
   density and header granularity only. A drop writes the day under the pointer at
   every zoom; the day is the finest unit a date property can hold, and no scale writes
   a coarser one. The ISO week governs header cell boundaries and the shelf drop's
   default length ([[Drag from the shelf to schedule]]), never the write's own
   granularity — one boundary on every device, never a locale guess that would let the
   same drop write different plans.
3. Panning scrolls the timeline horizontally inside the view; the pane itself never
   scrolls sideways.
4. Jump-to-today returns in one action, and the zoom choice is remembered per device —
   like collapse state, and for the same reason: pane width is a property of the screen
   in front of you, not of the base.

**Extensions**

- **1a — today falls outside every span.** The marker and the opening scroll still
  anchor on today: the roadmap orients on the reader's now, not the plan's bounds, and
  jump-to-today plus one pan reaches everything else.
- **2a — the pane is narrower than the frame is useful.** Labels yield before the grid
  does, and the shelf shows its labelled count rather than vanishing: it opens shut on
  both axes and is one action from open in its own header ("The shelf, organized"), so
  an unplaced result may lose its card but never its existence. No width threshold
  decides this — a stored pick does. Nothing clips under a header — the tree's rule of dropping
  whole regions applies to decoration, not to results — embedded bases included.
- **4a — a second device.** Its own zoom. Per-screen working positions never travel
  through the vault — the view-state store's rule, which this state joins.

## Acceptance criteria

- The timeline opens with today visible and marked; jump-to-today is one action and
  works from any scroll position.
- Zoom offers exactly the discrete scales, and changes pixel density and header
  granularity only: a drop writes the day under the pointer at every zoom, and the ISO
  week (Monday through Sunday, ISO 8601) governs header cell boundaries and the shelf
  drop's default length, on every device, never the write's granularity.
- Horizontal scrolling is contained inside the view; the pane never scrolls sideways,
  and a narrow or embedded pane degrades by yielding decoration, not by clipping — the
  shelf shows its labelled count, one action from open in its own header, and never
  disappears.
- The zoom choice persists per device in the view-state store — never in the `.base` —
  and zooming, panning and opening write nothing to any note or to the `.base`: the
  one thing written is that per-device memory, where collapse state already lives.

## Where it lives

Built. The scale table and the day budget — the three discrete `dayPx` densities, the
unit-aligned window, and the backstop expressed as a day count rather than a cell count
so the same dates reach at every zoom — are `src/domain/timeline.ts`. The zoom picker and
jump-to-today are `src/view/render/toolbar.ts`, beside the focus level; the shelf's own
disclosure is its header's (`src/view/render/shelfControls.ts`), the toolbar toggle and
its `syncShelfToggle` having been retired with the width-measured compaction they served. The per-device zoom memory is
kept in both halves of the same store, under the view state's own identity and
pruning rules and its own session-only exception for an embedded base:
`src/storage/viewStateStore.ts` validates the persisted value, and
`src/view/viewState.ts` is what actually holds it as a private field, reads it on
restore and writes it into the snapshot that gets saved. The date anchor carried across
a scale change — the civil date at the viewport's leading edge, not the pixel offset a
zoom redefines — and the per-band scroll offsets keyed by identity rather than position
are `src/view/render/projections.ts`. The band rule (the timeline takes what is left;
every other band declares a maximum and scrolls itself) is `styles/roadmap.css`.
