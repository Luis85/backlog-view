---
type: PBI
parent: "[[Scheduling work]]"
order: 0
status: Done
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
  - src/view/render/columns.ts
  - src/ui/prompts.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-15
risk: ""
assignee: ""
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
| **Trigger** | The row's own **horizon chip**, or **Set horizon**, **Clear horizon**, **Schedule** or **Unschedule** in its context menu |
| **Preconditions** | A configured axis: a horizon property with at least one declared value, or a date property |
| **Guarantee** | Nothing horizon- or date-related is offered unless that axis is configured, and nothing is ever written to an unconfigured key. Each action is one batch through the same gate every write goes through, undoable as one — and never touches a transition stamp. |

**Main flow**

1. The user presses the row's horizon chip, or opens its context menu.
2. **Set horizon** offers this base's horizon vocabulary — the declared values **plus**
   every value the results already carry, which is exactly the bucket list the roadmap
   draws — with the item's own checked, beside **Set state**. The chip opens that same
   list: one builder, so the two surfaces cannot offer different sets or disagree about
   which entry is current.
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
- **1c — the row shows its placement as a chip**, in a column of its own beside the state
  chip, on exactly the condition the roadmap draws its bucket axis on. It is the state
  chip's shape over the placement, and deliberately so: a horizon is the same kind of
  thing — a declared value from a declared vocabulary — and a second look would read as a
  second kind of thing. Unplaced is named with the roadmap's own word for it rather than
  with the property's name, since the chip states a placement and "not placed yet" is one;
  what pressing it does is in the accessible name. A value the reader refuses says
  *Unplaced* too, with the reason in the tooltip — the shelf's answer, on a row.
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
- **2e — the horizon property is one of the Base's visible columns.** The chip stands in
  its place — the state property's own rule ([[Workflow state]]): a value with an
  interactive surface of its own is not also drawn as a read-only cell, or the row would
  show it twice and only one of them would be editable. With the bucket axis
  unconfigured there is no chip, and the property goes back to being an ordinary column
  ([[Property columns]]).
- **2f — the roadmap is the projection.** The **drawn buckets lead**, read off the frame
  as rendered, with anything the vocabulary reaches and no bucket covers after them: the
  board's own rule for Set state, which offers its rendered columns rather than a list
  rebuilt from the settings that then has to agree with them. It matters because hiding —
  a focus level, the quick filter, a finished subtree — can remove a value's first
  carrier, so the order the axis mints buckets in is not always the order the vocabulary
  was collected in, and on screen the buckets are the version the user can check. What is
  *reachable* never narrows: a hidden row's value is still offered, last.
- **3a — the write is refused** (configuration problems, or a batch naming a note the Base
  excluded). Refused whole and loudly; nothing half-applies, and the row keeps rendering
  what the note still says.
- **3b — the new value takes the note outside the Base's filter.** The write stands — it
  is exactly what the user asked for — and the row leaves the tree on the refresh. Undo
  still takes it back, across the filter boundary, the rule the epic states for every
  write.
- **4a — only one date property is configured.** The entry offers the one end there is,
  and nothing is written to the unconfigured key.
- **4b — the entry's dates cannot be read as a span.** The fields are native date inputs,
  so the platform's own picker applies and the only things they can hand back are a
  calendar date and nothing at all — which leaves exactly one refusal for the entry to
  make: a target before its start, reported with the reason, the prompt staying open on
  what was entered, nothing written. A note may already say such a thing and the timeline
  shelves it with the reason visible ([[Bars from two dates]]); a prompt that produced one
  would be the view creating the plan it refuses to guess at. The planner keeps its own
  refusal for a value arriving from anywhere else.
- **4c — a field is emptied.** That end's key is removed and the other is left alone, so a
  span can be reduced to a milestone without unscheduling the item. Same rule as the
  horizon's: absence is a value, never an empty string. Each field carries its own clear
  button for it: a date input empties segment by segment from the keyboard, and a gesture
  that fiddly is one nobody finds — the capability would be technically present and
  practically gone.
- **4d — the note states a date the reader refuses.** Its field arrives blank rather than
  holding the unreadable value — the entry asks for a date and that is not one — so
  **typing** one replaces it, and the unreadable value is never carried back to disk.
  Confirming the blank field untouched is 4e's case and not this one: the reader was
  shown the same blank an absent value gives, so pressing Save cannot mean "delete what
  I was never shown". Removing it is **Unschedule**, which takes the other end too.
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

- With the bucket axis configured, the row shows its horizon as a chip and its context
  menu offers **Set horizon**, both with the declared values **union** the values observed
  among results, the item's own always checked; picking one writes exactly that key, one
  batch, one undo. The chip replaces the property's read-only cell, and neither appears at
  all while the axis is unconfigured. In roadmap mode the
  entries lead with the buckets as drawn, so the list and the axis beside it never
  disagree about their order; what is offered is the same set either way.
- With a date property configured, **Schedule** opens an entry of native date fields,
  prefilled from the note's own dates, and writes exactly the configured date keys — the
  one configured, if only one is — in one batch, one undo. A target before its start is
  refused at the entry and nothing is written; an unreadable date cannot be entered at
  all. Each field can be cleared in one press.
- **Clear horizon** and **Unschedule** appear only while the note carries the key they
  would remove, remove the key rather than blanking it, and undo restores the value; an
  emptied field in the entry removes that end alone.
- The date paths ask for **the ends the item's type has**, which for everything with a
  duration is every configured end. A marker states one date and has no span, so Schedule
  asks it for the target alone and applies no span rule, and Unschedule gates on and
  removes that key alone ([[Milestones as their own type]]). The rule is the same one
  stated from the type's side: an action must not offer an end the type does not use, or
  delete one it merely ignores.
- An unconfigured axis contributes no menu action and no write — a horizon property whose
  values list is cleared is unconfigured, the same axis the roadmap declines to draw.
- A row the Base excluded offers none of these actions; a batch naming one is refused
  whole.
- Transition stamps and every other key the plugin owns stay untouched by these writes; a
  colliding axis property gates writes like every other collision.
- Re-picking the value an item already holds, or re-confirming the entry unchanged,
  writes nothing and keeps the previous undo — including an entry whose fields arrived
  blank because the keys exist but hold nothing.
- The batch a menu action produces is the batch the equivalent roadmap gesture produces.
  This was the one criterion left open when the row's actions were built — nothing on the
  roadmap wrote then, so it had nothing to compare against — and both use cases it was
  waiting on have since landed on the same two planners
  ([[Moving between horizons]], [[Drag from the shelf to schedule]]). Checked as an
  OUTCOME rather than as a plan: one request through both surfaces against two untouched
  vaults, comparing the whole write log — which files were opened, what each says
  afterwards, and how many batches it took. The plans themselves are deliberately not
  identical, and that is why the criterion is written this way: a gesture carries the
  baseline it was measured from and the placement shape it was captured under, and a
  dialog entry carries neither.

## Where it lives

The vocabulary is `horizonMenuValues` in `src/domain/settings.ts` beside
`stateMenuValues`, over `model.observedHorizons` — result-only, in bucket-minting order —
collected in `src/domain/model.ts`, which also records which axis keys a note *carries*
(`ownKeys`: presence, not value, so a removal action can never write nothing). Whether an
axis is configured at all is `hasHorizonAxis` / `hasDateAxis` in `src/domain/roadmap.ts`,
the same predicates `configuredAxes` is built from, so the menu and the projection cannot
disagree. The plans are `computeHorizonWrites` and `computeScheduleWrites` in
`src/domain/writePlan.ts`; the writes, the key removals and their captured inverses are
the `AxisWrite` block in `src/storage/frontmatter.ts`. The actions live in
`src/view/interactions/plan.ts`, hung on the one context menu by
`src/view/interactions/menu.ts` — whose `showHorizonMenu` is also what the row's chip
opens, so the two surfaces share `addHorizonItems` rather than agreeing. The chip itself
is `renderHorizonChip` in `src/view/render/columns.ts`, beside the state chip whose shape
it takes, in a column the fit ladder budgets for and drops before the state one. The date
entry is `SchedulePromptModal` in `src/ui/prompts.ts` — native `type="date"` fields, each
with a clear button — which asks the caller to validate rather than reading dates itself,
since `ui/` may not reach the domain.
Tests: `test/domain/writePlanAxis.test.ts`, `test/domain/roadmap.test.ts`,
`test/domain/settings.test.ts`, `test/view/plan.test.ts`, `test/view/columns.test.ts`,
and
`test/view/contextRowWrites.test.ts`, whose every-entry-point sweep now drives these
actions too. The agreement with the roadmap's own gestures is
`test/view/planAgreement.test.ts`, which drives each request through both surfaces
against two separate vaults and compares what landed — every case watched failing
against a second planner written beside the shared one.
