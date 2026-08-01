---
type: PBI
parent: "[[The timeline]]"
order: 10
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/noteFields.ts
  - src/domain/settings.ts
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
   convention — because a point in time is not a span, and no sixth-plus-one type or
   extra field is needed to say so.

**Extensions**

- **1a — a value is unreadable as a date.** The item shelves ([[The unplaced shelf]]) and
  its card says why. A guessed date would be the view inventing a plan.
- **1b — the target precedes the start.** Unreadable as a span: shelved with the reason,
  never silently swapped — swapped ends would draw a plan the note does not state.
- **2a — the span is narrower than a grid cell at this zoom.** It renders at the minimum
  drawable width; the dates are the fact and the pixels are the zoom's
  ([[Zoom and the today marker]]).
- **2b — the user expects dependency arrows between bars.** None ship: the schema has no
  dependency field, and drawing one would need the new data model this epic deliberately
  is not. Recorded so it is re-decided knowingly rather than rediscovered.

## Acceptance criteria

- Both dates make a bar; one date makes an open-ended, cell-wide bar at that date;
  equal dates make a milestone diamond; absent, unreadable or reversed dates shelve
  the item with the reason visible.
- Reads are tolerant of frontmatter's shapes; nothing is invented, swapped or written
  by rendering.
- The properties are user-named with placeholders matching the Tasks plugin's
  vocabulary; nothing is ever picked by name-matching ([[Horizons or dates]]).
- No dependency arrows: no field exists, and this epic adds no data model.

## Where it lives

**Nothing yet — this note is design.** A tolerant date read joins the field readers in
`src/domain/noteFields.ts` beside the tolerant number the orders already use; the
property names resolve in `src/domain/settings.ts` beside the state property they
mirror.
