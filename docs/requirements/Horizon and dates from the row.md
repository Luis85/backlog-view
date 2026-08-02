---
type: PBI
parent: "[[Scheduling work]]"
order: 40
status: Active
priority: P2
created: 2026-08-02
source: user request
files:
  - src/domain/settings.ts
  - src/domain/model.ts
  - src/domain/roadmap.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/menu.ts
  - src/view/interactions/plan.ts
  - src/ui/prompts.ts
---

# Horizon and dates from the row

**As** someone who plans while working the tree, **I want** to set an item's horizon and
its planned dates from the row itself, **so that** a plan can be changed where the
decision is made instead of only in the projection that draws it.

[[Workflow state]] settled this shape once already, for the one property the tree could
edit: a value the note carries, offered as the vocabulary the view options declare,
written as one gated batch, taken back by one undo. The roadmap's properties are the same
shape — the horizon is a declared property with declared ordered values, exactly as the
workflow states are ([[Horizons or dates]]), and the planned dates are the same write with
a different entry. What was missing was only the surface: those values could be set by
roadmap gestures ([[Moving between horizons]], [[Drag from the shelf to schedule]]) and
their menu equivalents ([[Keyboard and menu on the roadmap]]), all of them behind roadmap
mode. The epic's own rule is that the projections never disagree — one model, one result
set, one write gate, one undo history — and a property that can only be set in one
projection is a projection disagreeing about what the backlog can do. So the actions
belong to the **item**, not to the mode, and this is where the tree got them.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | **Set horizon**, **Clear horizon**, **Schedule** or **Unschedule** in a row's context menu |
| **Preconditions** | A configured axis: a horizon property with at least one declared value, or a date property |
| **Guarantee** | Nothing horizon- or date-related is offered unless that axis is configured, and nothing is ever written to an unconfigured key. Each action is one batch through the same gate every write goes through, undoable as one — and never touches a transition stamp. |

**Main flow**

1. The user opens the context menu on a row.
2. **Set horizon** offers this base's horizon vocabulary — the declared values **plus**
   every value the results already carry, which is exactly the bucket list the roadmap
   draws — with the item's own checked, beside **Set state**.
3. Picking one writes that value to the note's horizon property: one batch, through the
   gate, one undo.
4. **Schedule** opens a date entry prefilled with the dates the note itself states;
   confirming writes the configured date properties as one batch.
5. The row re-renders what its note now says, and the roadmap places the item from the
   same frontmatter the next time it draws — one model, one gate, one undo history across
   the three projections.

**Extensions**

- **1a — the row came from outside the Base's filter.** None of these actions is offered:
  the context-row rule the state chip already keeps ([[Workflow state]]). It can be seen,
  not changed, and the gate refuses whole any batch that names it anyway.
- **1b — an axis is not configured.** Its actions are **absent, not inert** — set and
  clear horizon only while the bucket axis is configured, schedule and unschedule only
  while a date property is: the state chip's render-only-when-configured rule, applied per
  axis, so no offered action can write to a key nobody named.
- **2a — the horizon property is named but its values list is cleared.** That is an
  *unconfigured* bucket axis, not a vocabulary problem — the one definition
  [[Horizons or dates]] already gives, and the roadmap renders guidance rather than
  buckets for it. So **Set horizon** is absent, exactly as 1b says, even where results
  carry horizon values: an action here would write into an axis nothing draws and no
  roadmap gesture could match.
- **2b — a result carries a value the declaration does not name.** It is offered. The
  roadmap mints a trailing bucket for exactly that value
  ([[Buckets from a horizon property]]), so a menu confined to the declared list could not
  reach a target the drag can — the board's "every target a drag can reach, the menu can
  too" rule, which for horizons means the union rather than the state menu's either/or.
  Only results contribute: a context row's horizon is not this base's vocabulary and can
  never become assignable to a result.
- **2c — the item holds a horizon on neither list.** It is added, so the current value
  always renders checked. A menu that cannot show what the item *is* loses it on the next
  pick.
- **2d — the note already carries a horizon.** **Clear horizon** stands at the foot of
  the same list — only then, so no offered action writes nothing — and it **removes the
  key** rather than blanking it: untriaged is a state a note returns to, whereas an empty
  value would place the item in a bucket named nothing ([[Moving between horizons]]).
  Undo restores the value.
- **2e — the horizon property is one of the Base's visible columns.** It renders there as
  an ordinary property cell, read-only like every other one. The menu is the single
  editing surface: the tags column is editable because the view renders its pills itself
  ([[Property columns]]), and a horizon is a Bases value drawn by Bases — one editing
  path is worth more here than a second one that has to agree with it.
- **3a — the write is refused** (configuration problems, or a batch naming a note the Base
  excluded). Refused whole and loudly; nothing half-applies, and the row keeps rendering
  what the note still says.
- **3b — the new value takes the note outside the Base's filter.** The write stands — it
  is exactly what the user asked for — and the row leaves the tree on the refresh. Undo
  still takes it back, across the filter boundary, the rule the epic states for every
  write.
- **4a — only one date property is configured.** The entry offers the one end there is,
  and nothing is written to the unconfigured key.
- **4b — the entry's dates cannot be read as a span** — unreadable, or a target before its
  start. Refused at the entry with the reason, the prompt staying open on what was typed,
  nothing written. A note may already say such a thing and the timeline shelves it with
  the reason visible ([[Bars from two dates]]); a prompt that produced one would be the
  view creating the plan it refuses to guess at.
- **4c — a field is emptied.** That end's key is removed and the other is left alone, so a
  span can be reduced to a milestone without unscheduling the item. Same rule as the
  horizon's: absence is a value, never an empty string.
- **4d — the note states a date the reader refuses.** Its field arrives blank rather than
  holding the unreadable value, so confirming replaces it instead of writing it back.
- **4e — a field arrived blank and is confirmed unchanged.** Nothing is written, even
  where the key exists holding an empty value — the stub the backfill creates
  ([[Backfill missing properties]]). A blank field removes what the note *states*, and a
  field that arrived blank states nothing; deleting the key for pressing Save would spend
  the undo slot on a change nobody made. **Unschedule** stays the deliberate way to take
  a key away, and still removes an empty one.
- **4f — the note carries transition stamps.** Untouched. Plan and record are different
  keys, deliberately: scheduling from the tree may no more reach a stamped key than
  scheduling from the timeline may ([[Stamp when work starts and finishes]]).
- **4g — the note already carries dates.** **Unschedule** appears — only then — removing
  the configured date keys in one batch, and undo restores their values.
- **5a — the same change is made from the board or the roadmap.** One context menu, one
  planner, one gate: the batch is identical whichever projection the row was in.

## Acceptance criteria

- With the bucket axis configured, a row's context menu offers **Set horizon** with the
  declared values **union** the values observed among results, the item's own always
  checked; picking one writes exactly that key, one batch, one undo.
- With a date property configured, **Schedule** opens an entry prefilled from the note's
  own dates and writes exactly the configured date keys — the one configured, if only one
  is — in one batch, one undo. An unreadable date or a target before its start is refused
  at the entry, and nothing is written.
- **Clear horizon** and **Unschedule** appear only while the note carries the key they
  would remove, remove the key rather than blanking it, and undo restores the value; an
  emptied field in the entry removes that end alone.
- An unconfigured axis contributes no menu action and no write — a horizon property whose
  values list is cleared is unconfigured, the same axis the roadmap declines to draw.
- A row the Base excluded offers none of these actions; a batch naming one is refused
  whole.
- Transition stamps and every other key the plugin owns stay untouched by these writes; a
  colliding axis property gates writes like every other collision.
- Re-picking the value an item already holds, or re-confirming the entry unchanged,
  writes nothing and keeps the previous undo — including an entry whose fields arrived
  blank because the keys exist but hold nothing.
- **Not yet:** that the batch a menu action produces is identical to the one the
  equivalent roadmap gesture produces. Nothing on the roadmap writes yet
  ([[Moving between horizons]], [[Drag from the shelf to schedule]]), so the criterion
  has nothing to compare against — it is why this note is still `Active`, and it is the
  first thing those two use cases have to satisfy: they plan through the same
  `computeHorizonWrites` / `computeScheduleWrites`, or the claim stops being structural.

## Where it lives

The vocabulary is `horizonMenuValues` in `src/domain/settings.ts` beside
`stateMenuValues`, over `model.observedHorizons` — result-only, in bucket-minting order —
collected in `src/domain/model.ts`, which also records which axis keys a note *carries*
(`axisKeys`: presence, not value, so a removal action can never write nothing). Whether an
axis is configured at all is `hasHorizonAxis` / `hasDateAxis` in `src/domain/roadmap.ts`,
the same predicates `configuredAxes` is built from, so the menu and the projection cannot
disagree. The plans are `computeHorizonWrites` and `computeScheduleWrites` in
`src/domain/writePlan.ts`; the writes, the key removals and their captured inverses are
the `AxisWrite` block in `src/storage/frontmatter.ts`. The actions live in
`src/view/interactions/plan.ts`, hung on the one context menu by
`src/view/interactions/menu.ts`, and the date entry is `SchedulePromptModal` in
`src/ui/prompts.ts` — which asks the caller to validate rather than reading dates itself,
since `ui/` may not reach the domain.
Tests: `test/domain/writePlanAxis.test.ts`, `test/domain/roadmap.test.ts`,
`test/domain/settings.test.ts`, `test/view/plan.test.ts`, and
`test/view/contextRowWrites.test.ts`, whose every-entry-point sweep now drives these
actions too.
