---
type: PBI
parent: "[[The timeline]]"
order: 10
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/noteFields.ts
  - src/domain/timeline.ts
  - src/view/render/timeline.ts
---

# Bars from two dates

**As** someone reading a dated plan, **I want** an item with a start and a target to
render as a bar from one to the other, **so that** the note itself is the single place
the plan is stated.

Two user-named date properties drive placement — the shape GitHub Projects and Azure
DevOps converge on — with placeholders matching the ecosystem's own vocabulary (the
Tasks plugin's `start` and `due`) so existing vaults fit without renaming anything.
Values are read tolerantly the way every field here is read, and what cannot be read is
never guessed at: the closest prior art invents a missing end date, and an invented
date on a roadmap is indistinguishable from a decision.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The timeline renders a result carrying dates |
| **Preconditions** | Roadmap mode is on with the timeline axis, and at least one date property is configured |
| **Guarantee** | A bar states exactly what the note states: its ends are the note's own dates, a missing or unreadable date never becomes an invented one, and rendering writes nothing. |

**Main flow**

1. The item's start and target are read from the configured properties, tolerant of the
   shapes frontmatter takes — a date, a datetime, a quoted string.
2. A result with both dates renders as a bar spanning them.
3. A result with one date renders at the date it has: one grid cell wide, its dateless
   end styled open, so the plan's gap stays visible instead of being filled in.
4. A result whose start equals its target renders as a milestone diamond — the Gantt
   convention — because a point in time is not a span, and no extra field is needed to say
   so: two dates that agree already say it. What that does *not* cover is a deadline
   stated once, which step 3 draws open-ended because for work with duration a missing end
   is a real gap; [[Milestones as their own type]] is that case, and the diamond it draws
   is this one reached by a second route.

**Extensions**

- **1a — a value is unreadable as a date.** The item shelves ([[The unplaced shelf]]) and
  its card says why. A guessed date would be the view inventing a plan.
- **1b — the target precedes the start.** Unreadable as a span: shelved with the reason,
  never silently swapped — swapped ends would draw a plan the note does not state.
- **1c — a value carries a time and an offset.** The civil date it spells is what
  places it — no conversion to the viewer's zone, so the same note occupies the same
  cell on every device, and a calendar step moves that civil date while the time,
  offset and shape ride along unchanged ([[Move and resize a bar]]). Only the today
  marker is the reader's own: a plan states its dates, a clock states the reader's.
- **2a — the span is narrower than a grid cell at this zoom.** It renders at the minimum
  drawable width; the dates are the fact and the pixels are the zoom's
  ([[Zoom and the today marker]]).
- **2b — the user expects dependency arrows between bars.** None ship: the schema has no
  dependency field, and drawing one would need the new data model this epic deliberately
  is not. Recorded so it is re-decided knowingly rather than rediscovered.

## Acceptance criteria

- Both dates make a bar; one date makes an open-ended, cell-wide bar at that date;
  equal dates make a milestone diamond; unreadable or reversed dates shelve the item
  with the reason visible. Absence alone does not shelve a parent: one whose subtree
  supplies dates renders the inferred span ([[Spans roll up the tree]]), and only a
  wholly dateless subtree shelves.
- Reads are tolerant of frontmatter's shapes; nothing is invented, swapped or written
  by rendering. A datetime places by the civil date it spells, never converted to the
  viewer's zone — the same note occupies the same cell on every device — while its
  time, offset and shape survive on disk.
- The properties are user-named with placeholders matching the Tasks plugin's
  vocabulary; nothing is ever picked by name-matching ([[Horizons or dates]]).
- No dependency arrows: no field exists, and this epic adds no data model.

## Where it lives

The stated-dates half shipped with [[A third projection]]: the tolerant civil-date read
is `readDate` in `src/domain/noteFields.ts` beside the tolerant number the orders use;
spans, the bounded month window and the bar geometry are `src/domain/timeline.ts`,
drawn — milestones, open ends, the exact-dates tooltips — by
`src/view/render/timeline.ts`. Driven in `test/domain/timeline.test.ts`,
`test/domain/noteFields.test.ts` and `test/view/roadmapFrame.test.ts`. The inferred
parent spans wait for [[Spans roll up the tree]] — until they exist a dateless parent
shelves like any other dateless result — which is why this note stays open.
