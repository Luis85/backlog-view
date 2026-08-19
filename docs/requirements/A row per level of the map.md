---
type: PBI
parent: "[[The map draws]]"
order: 10
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A row per level of the map

**As** someone showing the product to a stakeholder, **I want** the map to draw as bands of
users, activities and steps, **so that** the shape of the journey is visible before anybody
reads a single card.

Three rows, three different questions asked of the same notes: a property for the users, the
use cases themselves for the activities, and each use case's step children for the steps. The
rows look alike on purpose and are derived differently, which is the trap this use case owns.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | Opening a base with the storymap view type |
| **Preconditions** | The view's map property is configured and the base returns at least one use case naming a storymap |
| **Guarantee** | The map is read-only to draw: opening, scrolling and folding it write nothing. Every row is derived from what the base returned, and a row with nothing in it is absent rather than empty. |

**Main flow**

1. The user opens the view.
2. It groups the returned use cases by the storymap they name and draws the map in view.
3. It draws the activities row from those use cases, the steps row from each one's step
   children, and the users row above both.
4. Each row's cells align in one column per activity, so a step sits under the activity it
   belongs to.

**Extensions**

- **1a — the base returns no use case naming a map.** The guided empty state draws instead,
  offering what to configure — the mechanism [[A guided empty state per view]] owns, not a
  second one here.
- **2a — the base returns use cases from more than one map.** The view draws one map, named in
  its options, and says how many results it set aside rather than mixing them.
- **3a — an activity has no steps.** Its column draws with an empty steps cell, so the
  activity is still visible and the gap is the information.
- **3b — a step is outside the base's filter.** It draws as context and parents its cards, and
  it is never counted in a rollup or offered as a write target.
- **4a — the map is wider than the viewport.** The backbone scrolls horizontally inside its
  own container, and the row labels stay in view.

## Acceptance criteria

- Rendering the view runs no write path at all, asserted by a spy on the write gate rather
  than by inspecting the vault afterwards.
- An activity with no steps draws its column; a map with no activities draws the empty state
  and not an empty grid.
- Step cells align to their activity's column at every width the view offers, checked in the
  browser harness against the real stylesheet.
- Results belonging to another map are excluded and counted, and the count is shown.
- A context-row step parents its cards and appears in no count the view reports.

## Where it lives

A new projection module in `src/domain/`, beside `src/domain/board.ts` and
`src/domain/roadmap.ts` and shaped like them: it derives the map from the model and touches no
DOM. A new render module in `src/view/render/`, beside `src/view/render/board.ts`, draws it,
reached through `src/view/projection.ts` and `src/view/render/projections.ts`. The view type is
registered in `src/view/registry.ts`, its settings in `src/domain/viewOptions.ts`, its empty
state in `src/view/render/emptyStates.ts`, and its layout in a new partial that
`styles/index.css` imports.
