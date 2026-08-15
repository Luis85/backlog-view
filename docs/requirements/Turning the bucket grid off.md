---
type: PBI
parent: "[[The horizon board]]"
order: 60
status: Done
priority: P3
created: 2026-08-15
files:
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/viewStateController.ts
  - src/view/render/roadmap.ts
  - src/view/render/toolbarControls.ts
  - styles/roadmap.css
  - styles/toolbarFit.css
started: "2026-08-15"
finished: "2026-08-15"
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Turning the bucket grid off

**As** someone reading a horizon a card at a time, **I want** to turn the bucket's card
grid off, **so that** a wide bucket lists its cards one per row instead of reflowing them
into columns I have to read across.

[[Buckets that use the room they have]] made a bucket's cards a responsive grid, which is
what a wide pane wants when a horizon is a backlog slice — and not what it wants when the
horizon is a short, ordered list somebody is reading down. Which one it is changes by the
day and by the reader, not by the base, so this is working position rather than a view
option ([ADR 0011](../adrs/0011-keep-collapse-state-out-of-the-base-file.md)): the grid
stays the default and the
pick is stored per saved view and per device.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user presses the bucket-layout toggle in the toolbar |
| **Preconditions** | Roadmap mode is on, the horizon axis is active |
| **Guarantee** | Every bucket lays its cards out in the picked layout — the responsive grid, or one card per row — and the pick is remembered for this saved view on this device, without anything being written to the `.base`. |

**Main flow**

1. The toolbar draws a toggle while the horizon axis is showing, pressed, because the
   grid is the default.
2. The user presses it. Every bucket redraws with one card per row; the button reports
   itself unpressed under the same name.
3. The pick goes to the view-state store. Reopening the view draws the buckets the same
   way.
4. Pressing it again restores the grid, and stores nothing — a default is an absent
   value.

**Extensions**

- **1a — another axis or another projection is showing.** No toggle is drawn: buckets are
  the horizon axis's alone, and a control that changes nothing on the screen in front of
  you is worse than one that is not there.
- **2a — the pane is too narrow for the toolbar row.** The toggle is shed with the density
  toggle at the same rung and carried by the `⋯`, checked exactly when the button was.

## Acceptance criteria

- The toggle draws in roadmap mode on the horizon axis and on no other screen.
- Pressing it flips what the buckets draw and what the button reports, under one fixed
  name with `aria-pressed` carrying the value.
- The pick survives closing and reopening the view, and nothing reaches the `.base`.
- The grid remains the default: turning it back on leaves no stored field behind.
- No change to the shelf's own grid, the context strip, the dated axis or either board.

## Where it lives

`bucketList` joins `ViewPrefs` and `PREF_READERS` in `src/storage/viewStateStore.ts` as an
`onlyTrue` pick — the OFF state for the grid, because the store writes nothing for a
default. `bucketGrid` / `setBucketGrid` in `src/view/viewState.ts` is the only place that
inversion is spelled; everything above it asks about the grid, which is what the toggle is
named for. `viewStateController.ts` renders on the flip like the density toggle beside it,
since no Bases refresh follows a change the base was not told about.

`renderBucketGridToggle` in `src/view/render/toolbarControls.ts` draws it in the projection
zone, gated on the active axis, with `bucketGridToggle` stating its icon, its value and
what pressing it does once — for the button and its `⋯` entry both. `renderRoadmap`
(`src/view/render/roadmap.ts`) puts `pbl-buckets-list` on the bucket ROW, and
`styles/roadmap.css` narrows `.pbl-bucket-cards` to a single track under it; the rung in
`styles/toolbarFit.css` sheds it with the density toggle.

Layout is jsdom's blind spot, so the suite asserts the CLASS and the pick
(`test/view/bucketGrid.test.ts`, `test/view/viewStatePersistence.test.ts`); that a single
track actually draws one card per row is `npm run harness`'s to show and a live vault's to
confirm.
