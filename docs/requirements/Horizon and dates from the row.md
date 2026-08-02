---
type: PBI
parent: "[[Scheduling work]]"
order: 40
status: Open
priority: P2
created: 2026-08-02
source: user request
files:
  - src/domain/settings.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/menu.ts
  - src/view/render/columns.ts
  - src/ui/prompts.ts
---

# Horizon and dates from the row

**As** someone who plans while working the tree, **I want** to set an item's horizon and
its planned dates from the row itself, **so that** a plan can be changed where the
decision is made instead of only in the projection that draws it.

[[Workflow state]] settled this shape once already, for the one property the tree can
edit today: a value the note carries, offered as the vocabulary the view options declare,
written as one gated batch, taken back by one undo. The roadmap's properties are the same
shape — the horizon is a declared property with declared ordered values, exactly as the
workflow states are ([[Horizons or dates]]), and the planned dates are the same write with
a different entry. What is missing is only the surface: today those values can be set by
roadmap gestures ([[Moving between horizons]], [[Drag from the shelf to schedule]]) and
their menu equivalents ([[Keyboard and menu on the roadmap]]), all of them behind roadmap
mode. The epic's own rule is that the projections never disagree — one model, one result
set, one write gate, one undo history — and a property that can only be set in one
projection is a projection disagreeing about what the backlog can do. So the actions
belong to the **item**, not to the mode, and this note is where the tree gets them.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | **Set horizon**, **Clear horizon**, **Schedule** or **Unschedule** in a row's context menu, in backlog mode |
| **Preconditions** | A horizon property, or a date property, is configured in the view options |
| **Guarantee** | Nothing horizon- or date-related is offered unless that axis is configured, and nothing is ever written to an unconfigured key. Each action is one batch through the same gate every write goes through, undoable as one, writing exactly what the roadmap's own gesture writes for the same change — and never touching a transition stamp. |

**Main flow**

1. The user opens the context menu on a row.
2. **Set horizon** offers this base's horizon vocabulary — the declared values, else the
   ones observed among the base's results — with the item's own checked, beside **Set
   state**.
3. Picking one writes that value to the note's horizon property: one batch, through the
   gate, one undo.
4. **Schedule** opens a date entry prefilled with the dates the note itself states;
   confirming writes the configured date properties as one batch.
5. The row re-renders what its note now says, and the roadmap places the item from the
   same frontmatter the next time it draws — one model, one gate, one undo history across
   the three projections.

**Extensions**

- **1a — the row came from outside the Base's filter.** None of these actions is offered,
  and whatever the note carries renders as static text: the context-row rule the state
  chip already keeps ([[Workflow state]]). It can be seen, not changed.
- **1b — an axis is not configured.** Its actions are **absent, not inert** — set and
  clear horizon only while a horizon property is configured, schedule and unschedule only
  while a date property is: the state chip's render-only-when-configured rule, applied per
  axis, so no offered action can write to a key nobody named.
- **2a — the horizon property is named but has no vocabulary.** No declared values and
  none observed among results: there is nothing to offer, so **Set horizon** is absent
  rather than empty, and declaring the values in the view options is the way in — the same
  answer the bucket axis gives when its values list is cleared ([[Horizons or dates]]).
  Observed values come from results alone; a context row's horizon is not this base's
  vocabulary and can never become assignable to a result.
- **2b — the horizon property is one of the Base's visible columns.** Its cell offers the
  same menu, editable in place: editing follows the **column**, the rule the tags column
  already keeps ([[Property columns]]). When the column drops for width the menu is the
  way left, and on a context row the cell is static text, never a control. The date
  properties stay read-only cells wherever they render — a date is not a vocabulary, and
  its editing surface is the entry the menu opens.
- **2c — the item holds a horizon value on neither list.** It is added, so the current
  value always renders checked. A menu that cannot show what the item *is* loses it on the
  next pick.
- **2d — the note already carries a horizon.** **Clear horizon** appears — only then, so
  no offered action writes nothing — and it **removes the key** rather than blanking it:
  untriaged is a state a note returns to, whereas an empty value would place the item in a
  bucket named nothing ([[Moving between horizons]]). Undo restores the value.
- **3a — the write is refused** (configuration problems, or a batch naming a note the Base
  excluded). Refused whole and loudly; nothing half-applies, and the row keeps rendering
  what the note still says.
- **3b — the new value takes the note outside the Base's filter.** The write stands — it
  is exactly what the user asked for — and the row leaves the tree on the refresh,
  announced with a notice naming what happened and offering to open the note, the answer
  [[New cards in place]] already gives. Undo still takes it back.
- **4a — only one date property is configured.** The entry offers the one end there is,
  and nothing is written to the unconfigured key.
- **4b — the entry's dates cannot be read as a span** — unreadable, or a target before its
  start. Refused at the entry with the reason, nothing written. A note may already say such
  a thing and the timeline shelves it with the reason visible ([[Bars from two dates]]);
  a prompt that produced one would be the view creating the plan it refuses to guess.
- **4c — the note carries transition stamps.** Untouched. Plan and record are different
  keys, deliberately: scheduling from the tree may no more reach a stamped key than
  scheduling from the timeline may ([[Stamp when work starts and finishes]]).
- **4d — the note already carries dates.** **Unschedule** appears — only then — removing
  the configured date keys rather than blanking them, and undo restores their values.
- **5a — the same change is made from the board or the roadmap.** One context menu, one
  planner, one gate: the batch is identical whichever projection the row was in, so a
  horizon set from the tree and a card dragged between buckets are the same write with two
  gestures.

## Acceptance criteria

- With a horizon property configured, a row's context menu offers **Set horizon** with the
  declared values, else the values observed among results, always showing the item's own
  value checked; picking one writes exactly that key, one batch, one undo.
- With a date property configured, **Schedule** opens an entry prefilled from the note's
  own dates and writes exactly the configured date keys — the one configured, if only one
  is — in one batch, one undo.
- **Clear horizon** and **Unschedule** appear only while the note carries the key they
  would remove, remove the key rather than blanking it, and undo restores the value.
- An unconfigured axis contributes no menu action and no write: nothing is ever written to
  an unnamed key.
- A row the Base excluded offers none of these actions and renders its values as static
  text; a batch naming one is refused whole.
- Transition stamps and every other key the plugin owns are untouched by any of these
  writes; a colliding axis property gates writes like every other collision.
- A refused batch changes nothing; a write whose value takes the note out of the filter
  applies, is announced with an open path, and stays undoable.
- The batch a menu action produces in backlog mode is identical to the one the equivalent
  roadmap gesture produces ([[Moving between horizons]],
  [[Drag from the shelf to schedule]]).

## Where it lives

**Nothing yet — this note is design.** The vocabulary resolves in `src/domain/settings.ts`
beside `stateMenuValues`, over the axis keys `src/domain/viewOptions.ts` already declares
and `configProblems` already checks for collisions; the plans are value and date writes
beside `computeStateDropWrites` in `src/domain/writePlan.ts`; the actions join the one
context menu in `src/view/interactions/menu.ts` beside `showStateMenu`, which already
decides what an excluded row is offered; the date entry is a prompt beside the new-item
prompts in `src/ui/prompts.ts`; the editable horizon cell is `src/view/render/columns.ts`,
where the tags column's own in-place editing lives; the writes, the key removals and their
captured inverses are `src/storage/frontmatter.ts`.
