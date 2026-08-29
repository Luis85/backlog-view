---
type: PBI
parent: "[[The map draws]]"
order: 40
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
priority: ""
iteration: ""
---

# Cards under a step

**As** someone reading the map, **I want** each step's tasks drawn as cards beneath it, **so
that** I can see the work without leaving the picture.

The cards are the tasks a step already holds, drawn with the chips the tree already draws for
them. Nothing new is stored to make a card; a card that needed its own record would be the
second copy this epic exists to remove.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | The map drawing a step's column |
| **Preconditions** | The step has at least one task in the base's results |
| **Guarantee** | A card is a note. It shows what that note carries and asserts nothing else, opens the note when activated, and costs its own content rather than the size of the map. |

**Main flow**

1. The view collects each step's task children from the results.
2. It draws one card per task in the step's column, in the tasks' own `order`.
3. Each card shows the task's title, its type badge, and whichever of its estimate, tags,
   state and assignee the note carries.
4. Activating a card opens the note.

**Extensions**

- **2a — a step has no tasks.** Its column draws an empty cell, and the step is still visible.
- **2b — a task is outside the base's filter.** It draws as context: visible, never a write
  target, never a ranking peer, and counted in nothing the map reports.
- **3a — a task carries none of the optional properties.** The chips are absent rather than
  drawn empty, and the card is shorter. Absence is a value here too.
- **3b — a task has children of its own.** The card says how many rather than nesting a second
  tree inside a cell.
- **4a — the note cannot be opened.** The failure is reported and the map is unchanged.

## Acceptance criteria

- A card with no optional properties renders no chip elements at all, checked by querying for
  them rather than by looking.
- Card count per step matches the step's task children in the results, and excludes tasks the
  base filtered out from every count while still drawing them as context.
- Render cost is proportional to the cards drawn, pinned by the same kind of cost test the
  tree rows already have.
- A card's appearance is verified in the browser harness against the real stylesheet, and the
  live-vault check is still recorded as owed.

## Where it lives

The card is drawn by this epic's render module in `src/view/render/`, reusing
`src/view/render/chips.ts` for the estimate and tags, `src/view/render/badges.ts` for the type,
and `src/view/render/cardChildren.ts` for the child count rather than restating any of them.
Activation goes through `src/view/openTarget.ts`. The cost claim is pinned the way
`src/view/rowSignature.ts` pins a row's.
