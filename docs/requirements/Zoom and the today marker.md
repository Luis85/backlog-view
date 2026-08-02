---
type: PBI
parent: "[[The timeline]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/storage/collapseStore.ts
  - src/view/render/toolbar.ts
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
2. The toolbar offers week, month and quarter zoom — discrete scales, each with the
   grid cell drags will snap to. A week cell runs Monday through Sunday, ISO 8601's
   week — the standard the register's own date format already follows — one boundary
   on every device, never a locale guess that would let the same drop write different
   plans.
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
  does, and the shelf compacts, never vanishes: in a narrow pane it collapses to its
  labelled count, one action from open, because an unplaced result may lose its card
  but never its existence. Nothing clips under a header — the tree's rule of dropping
  whole regions applies to decoration, not to results — embedded bases included.
- **4a — a second device.** Its own zoom. Per-screen working positions never travel
  through the vault — the collapse store's rule, which this state joins.

## Acceptance criteria

- The timeline opens with today visible and marked; jump-to-today is one action and
  works from any scroll position.
- Zoom offers exactly the discrete scales, and each declares the grid cell that drags
  snap to; a week cell runs Monday through Sunday (ISO 8601) on every device.
- Horizontal scrolling is contained inside the view; the pane never scrolls sideways,
  and a narrow or embedded pane degrades by yielding decoration, not by clipping — the
  shelf compacts to its labelled count, one action from open, and never disappears.
- The zoom choice persists per device in the collapse store — never in the `.base` —
  and zooming, panning and opening write nothing to any note or to the `.base`: the
  one thing written is that per-device memory, where collapse state already lives.

## Where it lives

**Mostly design still.** The first increment ships the fixed month scale, the today
line and the opening scroll to it (`src/domain/timeline.ts`,
`src/view/render/timeline.ts`); the discrete zooms and their snapping cells, the
jump-to-today control, the per-device zoom memory and the narrow-pane shelf compaction
remain this note's work — the zoom control joining `src/view/render/toolbar.ts` beside
the focus level, the memory joining the per-screen state
`src/storage/collapseStore.ts` already keeps, under the same identity and pruning
rules.
