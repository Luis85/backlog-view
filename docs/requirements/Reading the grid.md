---
type: PBI
parent: "[[The timeline]]"
order: 40
status: Done
priority: P2
created: 2026-08-05
files:
  - src/domain/timeline.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbar.ts
  - src/storage/collapseStore.ts
  - src/view/collapseState.ts
  - styles/timelineFurniture.css
---

# Reading the grid

**As** someone reading the dated axis, **I want** the grid furnished the way the
surveyed gantt tools converge on — oriented, tracked and labeled — **so that** finding
a bar, its date and its neighbours needs no hovering and no horizontal guesswork.

Every mark here is decoration over facts other elements already carry accessibly: the
row's name, the bar's dated aria-label, the today line's tooltip. Nothing is focusable,
nothing is written, and no rendering decision changes what places or what shelves.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The dated axis renders, or the density toggle is pressed |
| **Preconditions** | Roadmap mode is on, the dated axis is drawn |
| **Guarantee** | Furniture is derived at render from the window and scale alone — never stored on a note, never a write target, and absent furniture never removes a fact: everything a mark shows is also in a row's accessible name or tooltip. |

**Main flow**

1. The header draws two tiers — months above weeks, years above months and quarters —
   both clipped to the window, the bottom tier dropping the year the top tier carries.
2. Each interior cell boundary extends down the grid body; at week zoom, weekends
   shade as a single repeating band phased to the window's first Saturday.
3. The today line's date names itself with a Today label in a header strip of its own,
   above both tiers, so it can bury neither a milestone's name nor the year.
4. Alternate rows stripe, the hovered row highlights across lead and track, and the
   sticky lead column carries a shadow once the grid is scrolled.
5. Each bar carries its title beside it in the track, flipping to the bar's other
   side where the window's edge leaves no room; a bar clipped at both edges drops the
   label entirely, since the row's own lead column already carries the title. All
   labels hide while a drag is live.
6. A toolbar toggle compacts the row height, stored per saved view per device beside
   the zoom pick — UI state, never the `.base`. Its accessible name is fixed at
   'Compact rows'; `aria-pressed` carries the state.

**Extensions**

- **2a — month or quarter zoom.** No weekend band renders: at 4px and 2px per day the
  stripes are noise, which is where the surveyed tools stop shading too.
- **5a — the item is a milestone.** The diamond takes the same label through the same
  code path.
- **6a — a stored density this plugin never wrote.** Read defensively and dropped, like
  every stored pick: the view opens comfortable.

## Acceptance criteria

- Both header tiers cover exactly the window at every zoom, and the two tiers' day
  totals agree; the bottom tier is year-free where the top tier carries the year, the
  week cells keeping their month.
- Gridlines are one per interior cell boundary — none at day 0, where the lead
  column's border already is.
- Weekend banding renders at week zoom only, phased by `weekendOffsetDays`.
- The Today label mounts in a header strip of its own, above both tiers, never beside
  a milestone label.
- Bar labels are aria-hidden, take no pointer events, flip sides against
  `LABEL_RESERVE_PX`, are dropped entirely when a bar is clipped at both window edges,
  and hide while a drag is live.
- The density pick round-trips through the collapse store, renders only on the dated
  axis, and an unrecognized stored value reads as comfortable. The toggle's accessible
  name never changes; `aria-pressed` is what carries the state.
- No mark is focusable and nothing here writes: the furniture is derived at render
  and derived only.

## Where it lives

`superCells`, `weekendOffsetDays` and the year-free `cellLabel` in
`src/domain/timeline.ts`; the tiers, the today band, gridlines, weekend layer, stripes,
scroll shadow and bar labels — dropped when neither side has room — in
`src/view/render/timeline.ts`; the density toggle in `src/view/render/toolbar.ts` over
a `density` field beside `zoom` in `src/storage/collapseStore.ts`, held in
`src/view/collapseState.ts` exactly like the zoom beside it; the rules in
`styles/timelineFurniture.css`. Driven in `test/domain/timeline.test.ts`,
`test/view/timelineFurniture.test.ts` and `test/view/timelineZoom.test.ts`.
