---
type: PBI
parent: "[[Scheduling work]]"
order: 20
status: Done
priority: P2
created: 2026-08-01
start: 2026-08-10
due: 2026-09-25
files:
  - src/view/interactions/timelineDrag.ts
  - src/domain/bars.ts
  - src/storage/frontmatter.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
---

# Move and resize a bar

**As** someone whose plan slipped, **I want** to slide a bar and drag its ends, **so
that** re-planning is a gesture on the thing that shows the plan.

The convention is universal — Asana, GitHub and the Obsidian Gantt prior art all agree:
the bar's body shifts both dates together, an end moves that date alone, and every
drag means a whole day, at every zoom — zoom changes pixel density and header
granularity only, never the write's own grid. What is distinctive here is what
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

1. Dragging the body slides the bar by whole-day steps, previewed live: the start
   takes that day delta and the target follows at the bar's own day count, so a
   slide never changes duration.
2. Dragging an end moves that date alone by whole days from the date it had, previewed
   live, at every zoom — a delta, not the pointer's absolute position, because a
   rendered edge is not always its date: a span shorter than the minimum drawable width
   draws wider than it is, so the smallest twitch after grabbing the grip would
   otherwise write a date the grip was never actually on.
3. Both previews draw **in the dragged item's own row**, beside the bar they propose to
   replace, so the before and the after read as one sentence. A preview drawn anywhere
   else is a claim about a note the reader has to work out — first reported from a live
   vault as a ghost that looked unrelated to anything, having been drawn at the vertical
   middle of the whole grid.
4. Release writes what the preview showed, one batch through the gate.
5. Undo restores both prior values together.

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
  all — and neither does a bar with no inferred end at all where the note itself
  states NEITHER date: a start that is simply absent, with no evidence from a child
  either, is not an inferred start, so a bar drawn wholly from a child's target still
  offered a start grip with no baseline anywhere on the note to drag from. A grip
  needs at least one end that is the note's own — stated, or open because the note's
  OTHER end is stated — never a bar that is entirely someone else's evidence.
- **1d — the drag crosses a lane as well as time.** The gesture leaves this PBI:
  reparent and dates travel as the one combined batch [[Lanes on the roadmap]]
  specifies — previewed together, applied together, undone together — so the two notes
  cannot disagree about whose write it is.
- **1e — the value is a datetime.** The delta is whole days, as at every zoom; the time
  of day rides along untouched, and the write keeps the shape the note had — a drag
  re-plans a date, it does not re-format a value. Which DAY a gesture lands on is the
  only thing it decides, never that precision the note chose to keep is erased.
- **1g — the bar is a marker's.** A diamond offers **no end grips**: a point has no
  duration to resize, and an end handle on it could only invent one. Its body slide moves
  the **target alone** by the same whole-day delta, and a stale start the type ignores is not
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
  and the bar leaves the view on the refresh, undo still takes it back across the
  boundary — but the departure is not announced: that mechanism needs a Bases pass
  correlated with the write that caused it, which nothing here does, and building it
  from one sentence cost eleven review findings across seven rounds without reaching a
  correct rule. The question stays owned by
  [[The outcome report was built from one sentence]].

## Acceptance criteria

- Body drags slide the bar by whole-day steps — the start takes the step and the target
  follows at the bar's own day count, so a slide never changes duration; end drags move
  one date by whole days from the date it had, a delta rather than the pointer's
  absolute position — a rendered edge is not always its date. Both at every zoom: zoom
  changes pixel density and header granularity only, never the write's own grid.
  Release writes exactly the preview. Deltas preserve the value's own precision: a
  datetime keeps its time of day and its shape on disk.
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
  parent. A bar with no end the note itself states takes no gesture either, even where
  a child's evidence fills it and even where the flags alone would allow one — a grip
  needs at least one end that is genuinely the note's own.
- One batch, one undo; a refusal is whole, loud, and leaves the notes' own dates
  rendering.

## Where it lives

Built. The delta read that turns a body slide or an end drag into a day count, the
clamp that stops an end crossing the other, and the open-end baseline an unconfigured
grip borrows its date from are all `src/view/interactions/timelineDrag.ts`. Where a
gesture may take hold at all — body, start grip, end grip, narrowed by what the bar
actually renders — is `barHolds` in `src/domain/bars.ts`, asked once rather than
answered twice between what is drawn as grabbable and what can be written. The
datetime merge that keeps a note's own time, offset and shape while its civil date
moves, the live-value decision that replaces the no-op check `writePlan.ts` used to
make against a model that can be a refresh behind, and both refusals — a reversed pair,
and a plan whose shape no longer matches what the note has become — live in
`src/storage/frontmatter.ts`, the one module allowed to read and write the note.
`performScheduleMove`, declared on `BacklogViewHost` in `src/view/host.ts` and
implemented in `src/view/cardMoves.ts` (`CardMoveController`; `src/view/backlogView.ts`
keeps a one-line delegate, the same shape `applySafely`/`canUndo`/`undoLast` already use
for the write gate — [[Split the view dispatch hub]]), is the single place a date batch
is planned
and announced, shared by the drag, the menu's Schedule and Unschedule, and reporting
whether anything actually changed rather than whether the call returned.
