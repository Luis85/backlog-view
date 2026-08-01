---
type: PBI
parent: "[[Scheduling work]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
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
the gesture does *not* do: a date write has no peers. Unlike a tree drop, it renumbers
no siblings, cascades to no children, and touches exactly one note — which is what
makes its preview an honest contract.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a bar's body, or one of its ends |
| **Preconditions** | Roadmap mode is on with the timeline axis |
| **Guarantee** | A bar gesture writes only the dragged note's own date properties, exactly the dates the preview showed — one batch, one undo — and no other note is renumbered, retyped or touched. |

**Main flow**

1. Dragging the body shifts both dates by the same whole-cell delta, previewed live.
2. Dragging an end moves that date alone, previewed live.
3. Release writes what the preview showed, one batch through the gate.
4. Undo restores both prior values together.

**Extensions**

- **1a — the bar has one date.** The body drag moves the date it has and the open end
  stays open: shifting an absence would invent a date the note never stated. Dragging
  the open end is exactly how the missing date gets written — where its property is
  configured: with only one date property named ([[Horizons or dates]]), the other end
  has no key to receive a write, so it offers no grip to pointer and pick-up alike.
  Nothing is ever written to an unconfigured key.
- **1b — the bar is a parent's own.** Only the parent's dates move; its children state
  their own plans and stay put. A bar is a note's plan, never a group handle — the same
  restraint that keeps retyping a subtree opt-in elsewhere in this plugin.
- **1c — the bar, or one of its ends, is inferred.** No gesture holds there: an
  inferred span is display ([[Spans roll up the tree]]), and dragging it would write an
  inference. The path to a real plan on a parent is stating real dates — the menu
  offers it on any row ([[Keyboard and menu on the roadmap]]). A grip exists exactly
  where a write can land on the note's own configured key, and never on display.
- **2a — an end is dragged past the other.** It clamps at equal — a milestone — and never
  crosses: a reversed span is unreadable ([[Bars from two dates]]), so no gesture may
  write one.
- **3a — the write is refused.** Refused whole and loudly; indicators clear, the bar
  renders where the note still says, nothing half-slides.

## Acceptance criteria

- Body drags shift both dates by one whole-cell delta; end drags move one date;
  everything snaps to the zoom's grid, and release writes exactly the preview.
- A bar gesture is a single-note write: no sibling renumbering, no cascade to
  children, nothing else touched.
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
