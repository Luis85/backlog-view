---
type: PBI
parent: "[[Scheduling work]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
start: 2026-08-10
due: 2026-09-25
files:
  - src/domain/writePlan.ts
  - src/view/interactions/dragDrop.ts
---

# Move and resize a bar

**As** someone whose plan slipped, **I want** to slide a bar and drag its ends, **so
that** re-planning is a gesture on the thing that shows the plan.

The convention is universal — Asana, GitHub and the Obsidian Gantt prior art all agree:
the bar's body shifts both dates together, an end moves that date alone, and everything
snaps to the zoom's grid so a drag means whole units. What is distinctive here is what
the gesture does *not* do: a date write has no peers. Within its lane it renumbers no
siblings, cascades to no children, and touches exactly one note — which is what makes
its preview an honest contract. Crossing a lane is a different gesture with a stated
owner: the combined batch [[Lanes on the roadmap]] specifies.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a bar's body, or one of its ends |
| **Preconditions** | Roadmap mode is on with the timeline axis |
| **Guarantee** | The preview is the contract: release writes exactly the dates it showed, one batch, one undo — and a gesture that stays in its lane writes only the dragged note's own date properties, with no other note renumbered, retyped or touched. |

**Main flow**

1. Dragging the body slides the bar by whole-cell steps, previewed live: the start
   takes the calendar step and the target follows at the bar's own day count, so a
   slide never changes duration.
2. Dragging an end moves that date alone, previewed live, landing on the anchor its
   kind means in the cell it is dropped in — a start takes the cell's first day, a
   target its last, the shelf drop's own rule ([[Drag from the shelf to schedule]]).
3. Release writes what the preview showed, one batch through the gate.
4. Undo restores both prior values together.

**Extensions**

- **1a — the bar has one date.** The body drag moves the date it has and the open end
  stays open: shifting an absence would invent a date the note never stated. Dragging
  the open end is exactly how the missing date gets written — where its property is
  configured: with only one date property named ([[Horizons or dates]]), the other end
  has no key to receive a write, so it offers no grip to pointer and lift alike.
  Nothing is ever written to an unconfigured key.
- **1b — the bar is a parent's own.** Only the parent's dates move; its children state
  their own plans and stay put. A bar is a note's plan, never a group handle — the same
  restraint that keeps retyping a subtree opt-in elsewhere in this plugin.
- **1c — the bar, or one of its ends, is inferred.** No gesture holds there: an
  inferred span is display ([[Spans roll up the tree]]), and dragging it would write an
  inference. The path to a real plan on a parent is stating real dates — the menu
  offers it on any row ([[Keyboard and menu on the roadmap]]). A grip exists exactly
  where a write can land on the note's own configured key, and never on display. The
  body hold follows the same rule: it exists while every end the bar renders is the
  note's own — stated, or open — and moves exactly the dates it states. An end
  inferred from children withholds the body hold too, not just its own grip: sliding
  a bar half-anchored to its children is a resize wearing a slide's cursor, and the
  stated end's own grip is the honest handle. A fully inferred bar takes no hold at
  all.
- **1d — the drag crosses a lane as well as time.** The gesture leaves this PBI:
  reparent and dates travel as the one combined batch [[Lanes on the roadmap]]
  specifies — previewed together, applied together, undone together — so the two notes
  cannot disagree about whose write it is.
- **1e — the value is a datetime.** The delta is whole calendar units; the time of day
  rides along untouched, and the write keeps the shape the note had — a drag re-plans
  a date, it does not re-format a value. Snapping decides where the bar lands on the
  grid, never that precision the note chose to keep is erased.
- **1f — the step crosses a month end.** A calendar step lands on the same day of the
  target unit, clamped to its last day when that day does not exist — January 31 moved
  a month is the end of February, never an overflow into March — and a body drag keeps
  the bar's duration: the start takes the step, the target follows at the bar's own
  day count. Re-planning when is not re-planning how long; only an end drag changes
  duration, because that is what a resize is.
- **1g — the bar is a marker's.** A diamond offers **no end grips**: a point has no
  duration to resize, and an end handle on it could only invent one. Its body slide moves
  the **target alone** by the calendar step, and a stale start the type ignores is not
  carried along — sliding a date the projection never drew would write a plan the reader
  was never shown ([[Milestones as their own type]]). This is 1a's rule reached by the
  type rather than by a missing value: what a gesture may move is what the item's own
  projection says it has.
- **2a — an end is dragged past the other.** It clamps at equal — the diamond a coincident
  pair draws ([[Bars from two dates]]), which is the shape and not the type — and never
  crosses: a reversed span is unreadable, so no gesture may write one.
- **3a — the write is refused.** Refused whole and loudly; indicators clear, the bar
  renders where the note still says, nothing half-slides.
- **3b — the written dates take the note outside the Base's filter.** The write stands
  and the bar leaves the view on the refresh, announced with an open path — the filter
  speaking, not the write failing — and undo still takes it back across the boundary,
  the epic's rule for every write ([[Moving between horizons]] states the same for the
  horizon axis).

## Acceptance criteria

- Body drags slide the bar by whole-cell steps — the start takes the calendar step,
  clamped at month end rather than overflowing, and the target follows at the bar's
  own day count, so a slide never changes duration; end drags move one date, landing
  on the anchor its kind means — the cell's first day for a start, its last for a
  target, the shelf drop's rule; everything snaps to the zoom's grid, and release
  writes exactly the preview. Deltas
  preserve the value's own precision: a datetime keeps its time of day and its shape
  on disk.
- A marker's diamond takes no end grip at all, and its body slide writes the target alone —
  never a start, neither one it lacks nor a stale one the type ignores
  ([[Milestones as their own type]]).
- Within its lane, a bar gesture is a single-note write: no sibling renumbering, no
  cascade to children, nothing else touched. A drag that also crosses a lane is the
  combined batch [[Lanes on the roadmap]] specifies, never a second write path.
- One-dated bars keep their open end on body drags, and dragging the open end writes
  the missing date where its property is configured — an unconfigured end offers no
  grip, and nothing is ever written to an unconfigured key; ends clamp at equal and
  never cross.
- Inferred bars and inferred ends take no gesture; a dated parent's bar moves only the
  parent.
- One batch, one undo; a refusal is whole, loud, and leaves the notes' own dates
  rendering.

## Where it lives

**Nothing yet — this note is design.** The shift and resize plans are date writes
beside the drop plans in `src/domain/writePlan.ts`; the gestures, previews and
snapping extend `src/view/interactions/dragDrop.ts`, which already owns transient drag
state and indicators.
