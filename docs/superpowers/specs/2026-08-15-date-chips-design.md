# The planned dates, from the row

A chip per date end in the tree, on the same terms the state, horizon, risk and assignee
chips already have: drawn when the Base's properties menu shows that property, replacing
its read-only cell, opening the row menu's own write.

This is the **fourth instance of one shape**, not a fourth kind of thing.
[[Workflow state]] settled it, [[Horizon and dates from the row]] took it over the
placement, [[Risk from the row]] over the judgement, and this takes it over the two ends
of the plan — the only properties this view writes that a row still renders as a dead
value cell.

## What is being asked for

> I want to be able to edit every property the plugin owns in a chip in the tree view if
> the property is selected in the view's property settings.

The rule in the second half is **already how the chips work**: `columnKind`
(`src/view/render/columns.ts`) turns a property into a chip only when
`config.getOrder()` lists it, and `renderCell` dispatches on that kind, so a chip is that
property's own cell and vanishes to an ordinary column when the property is deselected.
Nothing about that changes.

What is missing is coverage. Of the eleven optional properties in
`src/domain/optionalProperties.ts`, four have a chip (`state` — through all three
workflow keys — `horizon`, `risk`, `assignee`) and `tags` has an editable column of pills.
The rest are the subject of this spec's scope decision:

| Property | Today | In scope |
| --- | --- | --- |
| `start`, `target` | a dead value cell; editable only through the row menu's two-field **Schedule** | **yes** |
| `startedDate`, `finishedDate` | written by state transitions, never by hand | no |
| `dependsOn` | the **Depends on…** menu and the roadmap's drag connector | no |
| `parent`, `order`, `type` | not columns at all — `resolveColumns` skips them | no |

**The stamps are out on purpose, and the reason is a rule rather than an omission.** Plan
and record are different keys: `Horizon and dates from the row`'s guarantee ends "and
never touches a transition stamp", and `Stamp when work starts and finishes` owns them.
A chip that edited a stamp would make the record a thing the reader maintains, which is
the opposite of what a record is for. Reversing it is a product decision this spec does
not take.

`dependsOn` is out for a different reason — it is a list of links, so its chip would be
the tags column's shape rather than a chip's, and it already has two surfaces. Worth its
own note; not this one.

`parent`, `order` and `type` are out because the view already draws them as itself: the
tree IS the parent column, the badge IS the type, and `order` is an implementation
number ([ADR 0023](../../adrs/0023-columns-are-the-bases-property-order.md)).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The row's own **start** or **due** chip |
| **Preconditions** | That end's property is named in the view options **and** selected in the Base's properties menu |
| **Guarantee** | The chip shows what the note states and writes exactly that one key, in one batch through the one gate, undoable as one — identical to the batch the roadmap's own gestures and the row menu's Schedule produce. It never touches the other end, and never a transition stamp. |

**Main flow**

1. The tree draws a column for a configured date property the properties menu shows, one
   chip per row, in the place that property's read-only cell would have had.
2. The chip names the date the note states.
3. Pressing it opens a date entry **for that end alone**, prefilled with what the note
   says, carrying a clear button.
4. Confirming writes exactly that key: one batch, through the one gate, one undo.
5. The row re-renders what the note now says, and the roadmap places the item from the
   same frontmatter the next time it draws.

**Extensions**

- **1a — the property is named but not selected in the properties menu.** No column and
  no chip, and the row menu's **Schedule** and **Unschedule** stay offered — today's rule
  for the four existing chips, kept deliberately. The tags rule (editing follows the
  column) does not extend here: for tags the menu IS the column, while a hidden date
  property has no other route but opening the note, and this plugin cannot write the
  visible order back (ADR 0023's first-run gap). The asymmetry is already recorded in
  ADR 0023's Consequences and is not widened by this note.
- **1b — that end's key is unconfigured.** The property is not a column at all, because
  nothing names it. Nothing to gate, nothing to draw.
- **1c — the item's type does not use that end.** A `Milestone` states one date and has
  no span, so `placementEnds` gives it `['target']` alone: its **start cell renders
  empty**. The cell is still drawn, so every column after it stays under its header. This
  is the type-side rule stated once — *an action must not offer an end the type does not
  use, or delete one it merely ignores* ([[Milestones as their own type]]) — reaching the
  chip by the same `placementEnds` call every other date path asks.
- **2a — the note states no date.** The chip reads the column's own display name, dashed
  and faint, its accessible name saying that pressing it sets one. The risk and assignee
  chips' answer, not the horizon chip's: absence in a placement is a state the shelf
  already names, while absence here is an invitation, and the row is where the plan gets
  made. "Unscheduled" is deliberately **not** used, because the shelf's word covers both
  ends at once and a single chip cannot claim it. Which name exactly is **Decision 4**.
- **2b — the note states something the reader refuses.** The same dashed face, with
  *Unreadable start date* in the tooltip: the horizon chip's rule exactly, so a chip never
  shows a value the axis would not honour. Unset and unreadable therefore look alike and
  differ by tooltip, which is what the horizon chip already does.
- **2c — the row came from outside the Base's filter.** A static `div`, never a button,
  with the reason in its tooltip; absent entirely where it has nothing to show. The gate
  refuses whole any batch naming such a row anyway.
- **3a — the entry is confirmed unchanged.** Nothing is written and the previous undo
  stands, including where the key exists holding an empty value — `planFrom` decides from
  the FORM, and a field the user did not touch states nothing
  ([[planFrom still decides a removal from the model, not the form]]).
- **3b — the field is emptied.** That end's key is removed and the other is left alone, so
  a span can be reduced to a milestone without unscheduling the item. Absence is a value,
  never an empty string.
- **3c — the field arrived blank because the note's value is unreadable.** Confirming it
  writes nothing, so an unreadable date cannot be cleared from the chip. **Unschedule**
  remains the way out and takes both ends with it. This is the accepted cost extension 4d
  of [[Horizon and dates from the row]] already records, reached by one more surface
  rather than newly created by it.
- **3d — the entered date would put the target before the start.** Refused at the entry,
  with the reason, nothing written — see **Decision 2**.
- **3e — the write is refused** (configuration problems, or a batch naming an excluded
  note). Refused whole and loudly; the row keeps rendering what the note still says.
- **3f — the new date takes the note outside the Base's filter.** The write stands and the
  row leaves the tree on the refresh, in silence — the behaviour everywhere else in this
  plugin. Undo still takes it back across the boundary.
- **4a — the keyboard.** The chip is `tabindex="-1"` like every other per-row control, and
  the row menu's **Schedule** is the documented path — see **Decision 3**.

## Acceptance criteria

- With a date property configured and selected in the properties menu, every row draws a
  chip for it showing the date its note states, and the chip stands in the property's
  read-only cell rather than beside it.
- Pressing it opens an entry for **that end alone**, prefilled from the note, and writes
  exactly that key in one batch, one undo — byte for byte the batch the row menu's
  Schedule produces for the same change, because it is the same planner and the same host
  method.
- An unset note draws a dashed chip naming what pressing it does; an unreadable value
  draws the same face with the reason in its tooltip; a `Milestone`'s start cell is empty;
  a row the Base excluded draws a static chip, or none where it has nothing to say.
- Deselecting the property removes the column and the chip and leaves **Schedule** and
  **Unschedule** in the row menu.
- Re-confirming the entry unchanged writes nothing and keeps the previous undo.
- Transition stamps are untouched by these writes.
- The column is in the fit budget and drops whole, by its place in the properties menu's
  order like every other column.
- **Not checked here:** how the chip looks in a themed vault, and whether six fixed
  columns still read as columns on a real pane. The jsdom suite asserts markup and the
  browser harness draws without asserting ([[Smoke test the tree]]).

## Decisions

### Decision 1 — two kinds, not one `date` kind

`ColumnKind` gains `'start'` and `'target'` rather than a single `'date'` carrying which
end. `renderPropCells` writes `pbl-prop-${kind}` onto every cell, so two kinds give each
end its own CSS hook for nothing, and `renderCell`'s dispatch stays the flat list it is
for the other five. A single kind would buy one fewer union member and cost a lookup at
every reader.

The renderer is **one function driven by a two-row table**, `renderDateChip` beside
`renderLabelChip` — which is itself the shape arrived at when the assignee wanted the
identical renderer to risk's. A second renderer per end would be the copy that rule
already rejected once.

### Decision 2 — a reversed pair is refused at the entry

A one-end entry shows one field, so `validateSchedule` cannot see the other end and a due
date typed before the note's existing start would land, leaving the timeline to shelve the
bar with the reason. Extension 4b of [[Horizon and dates from the row]] promises the
opposite: *a target before its start is refused at the entry and nothing is written.*

So the entry compares against **the end the note states**, read once when the prompt opens
— the same single reading `scheduleFields` already takes, for the same reason it takes it
once.

The cost, accepted and stated: this is one thing decided from the model rather than from
the form, which is exactly the shape of the defect
[[planFrom still decides a removal from the model, not the form]] records. It is safe here and
the difference is the direction of the failure: a stale model can only make this
**wrongly refuse** — visible, recoverable, and the user still holds their input, since the
prompt stays open on what was entered — where `planFrom` could wrongly **delete** a value
another editor had just corrected. A refusal writes nothing, which is what makes staleness
survivable.

### Decision 3 — no per-end menu entries; Schedule is the keyboard path

The tree is one tab stop, so a per-row control is a `tabindex="-1"` button with the
context menu as its documented keyboard path. The row menu's **Schedule** opens both ends
rather than one, so the chip's exact control has no menu twin.

It does not need one. `planFrom` decides from the form, so a field left untouched states
nothing and **Schedule** already produces the identical one-ended batch. The capability is
fully reachable by keyboard; only the shortcut is not. Adding `Set start…` / `Set due…`
would satisfy the register's *"two surfaces over one action must be available at the same
times"* rule literally rather than by argument, at the price of two more entries in an
already long menu and a second builder to keep in step.

Stated so it can be revisited: if the two-field entry ever stops writing nothing for an
untouched field, this decision falls with it.

### Decision 4 — the unset chip carries the COLUMN's name, not a fixed word

`LABEL_CHIPS` gives risk and the assignee a **fixed** placeholder (`Risk`, `Assignee`),
which works because each of those fields is one property with one obvious noun. Neither
date end has one: the field is called `target` internally, the key this view suggests for
it is `due`, and the key a given vault actually uses is whatever its owner named. A fixed
word would put a third name on screen beside those two.

So the visible placeholder is `column.label` — `config.getDisplayName(prop)`, the same
string the header directly above the cell shows and the same string the chip's accessible
name already uses under the rule stated at `chipLabel`: *the noun is the property's own
display name, so the control says which key it writes*. A chip reading `Due` on a vault
whose property is `deadline` would be naming a key that vault does not have.

This is a deliberate deviation from the two label chips, not an oversight in either
direction. It is not worth retrofitting onto them: `risk` and `assignee` have exactly one
sensible noun each, so the fixed word and the display name agree in every configuration
that reaches them.

## Where it will live

- `src/view/host.ts` — `ColumnKind` gains `'start'` and `'target'`.
- `src/view/render/columns.ts` — `columnKind` maps each configured date key to its kind
  (the key alone, no paired vocabulary: the entry behind the chip needs no declared list,
  the assignee's own reasoning); `renderDateChip` and its two-row table beside
  `renderLabelChip`; `renderCell` gains one branch.
- `src/view/interactions/plan.ts` — `promptSchedule(host, item, ends?)` and
  `scheduleFields(host, item, ends)` take the ends to ask for, defaulting to
  `placementEnds(item.typeName)` so every existing caller is unchanged. `validateSchedule`
  gains the note's un-shown end as its baseline (Decision 2). **No new modal**:
  `SchedulePromptModal` already takes a field list, and a one-end entry is that list with
  one row in it.
- `styles/columns.css` — the chip's own rules beside the label chips'.
- **Nothing in the fit budget.** These are ordinary resolved columns carrying their own
  configured widths, and `columnFit` sums every resolved column whatever its kind — the
  lesson the risk column already paid for.
- **Nothing in `domain/`.** `computeScheduleWrites` already plans a one-ended write, and
  `AxisWrite` already carries one end without the other.

Tests:

- `test/view/dateChips.test.ts` — the four faces, the chip replacing the value cell, the
  column disappearing with the property, the `Milestone`'s empty start cell, the reversal
  refusal, and the `tabindex`/`div` rules.
- `test/view/planAgreement.test.ts` — a fifth pair: the chip's entry against the grid
  drag for the same date, so the new surface is held to the agreement the third increment
  just made structural.
- `test/view/contextRowWrites.test.ts` — the every-entry-point sweep gains the chip, so
  the context-row rule holds at a surface nobody has to remember to add.
- `test/helpers/fixtures.ts` — `demoOptions()`'s property order gains the two date
  properties, so `npm run harness` draws all four faces against the real stylesheet.

## Register

A new `PBI` under [[Scheduling work]], beside [[Horizon and dates from the row]], carrying
the use case above. It is the note this spec becomes; the spec itself stays here as the
working document.
