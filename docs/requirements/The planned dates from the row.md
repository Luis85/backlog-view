---
type: PBI
parent: "[[Scheduling work]]"
order: 30
status: Active
priority: P2
created: 2026-08-15
source: user request
files:
  - src/view/host.ts
  - src/view/render/board.ts
  - src/view/render/chips.ts
  - src/view/render/columns.ts
  - src/view/interactions/plan.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-15
due: ""
risk: ""
assignee: ""
---

# The planned dates from the row

**As** someone reading a backlog rather than opening it note by note, **I want** each
item's planned dates on its row and settable there, **so that** a date is changed where
the work is listed instead of only on the timeline or through a dialog that asks about
both ends at once.

This is the **fourth instance of one shape**, not a fourth kind of thing. [[Workflow
state]] settled it for the state property, [[Horizon and dates from the row]] took it over
the placement, [[Risk from the row]] over the judgement, and this takes it over the two
ends of the plan — which were the only properties this view writes that a row still drew
as a dead value cell.

The request was wider than what was built: *every property the plugin owns, editable in a
chip when the property is selected in the view's property settings*. Half of that was
already true — a chip has always been drawn only when the Bases properties menu shows its
property ([[Property columns]], [ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md)) —
and the rest is a scope decision recorded here rather than left implied. Of the optional
properties, `startedDate` and `finishedDate` stay out because **plan and record are
different keys**: [[Stamp when work starts and finishes]] owns them and
[[Horizon and dates from the row]]'s guarantee ends "and never touches a transition
stamp", so a chip that maintained the record by hand would be the opposite of what a
record is for. `dependsOn` stays out because it is a LIST of links, so its surface is the
tags column's rather than a chip's, and it already has two ([[Dependencies as a
property]]). `parent`, `order` and `type` stay out because the view already draws them as
itself — the tree is the parent column, the badge is the type, and `order` is an
implementation number.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The row's own **start** or **target** chip |
| **Preconditions** | That end's property is named in the view options **and** shown by the Base's properties menu |
| **Guarantee** | The chip shows what the note states and writes exactly that one key, one batch through the one gate, one undo — the batch the roadmap's own gestures and the row menu's Schedule produce for the same change. It never touches the other end, and never a transition stamp. |

**Main flow**

1. The tree draws a column for each configured date property the properties menu shows,
   one chip per row, in the place that property's read-only cell would have had.
2. The chip names the date the note states.
3. Pressing it opens a date entry for **that end alone**, prefilled from the note, with a
   clear button.
4. Confirming writes exactly that key: one batch, through the gate, one undo.
5. The row re-renders what the note now says, and the roadmap places the item from the
   same frontmatter the next time it draws.

**Extensions**

- **1a — the property is named but the properties menu is not showing it.** No column and
  no chip — and the row menu's **Schedule** and **Unschedule** stay offered, today's rule
  for the four chips before it. The tags rule (editing follows the column) deliberately
  does not extend here: for tags the menu IS the column, while a hidden date property has
  no route left but opening the note. The asymmetry is ADR 0023's, recorded there, and
  this note widens it by one property rather than changing it.
- **1b — that end's key is unconfigured.** There is no column, because nothing names the
  property. Nothing to gate and nothing to draw.
- **1c — the item's type does not use that end.** A `Milestone` states one date and has no
  span, so its **start cell draws nothing at all** — the rule stated from the type's side
  in [[Milestones as their own type]], reaching the chip through the same `placementEnds`
  call every other date path asks. The cell is still rendered, or every column after it
  would shift on that row alone.
- **2a — the note states no date.** The chip reads the **column's own display name**,
  dashed and faint, its accessible name saying that pressing it sets one. The risk and
  assignee chips' answer, not the horizon chip's: absence in a placement is a state the
  shelf already names, while absence here is an invitation. *Unscheduled* is deliberately
  not used — the shelf's word covers both ends at once, and one chip cannot claim it.
- **2b — the note states a value the reader refuses.** The same dashed face, with the
  reason in the tooltip: the horizon chip's rule exactly, so a chip never shows a value
  the axis would not honour. Unset and unreadable therefore wear one face and differ by
  tooltip.
- **2c — the row came from outside the Base's filter.** A static `div`, never a button,
  with the reason in its tooltip; absent entirely where it has nothing to show. The gate
  refuses whole any batch naming such a row anyway.
- **2d — the projection is a card.** The date renders as the **plain value it was before
  the chips existed**, and the chip is absent. Two halves, and they fail oppositely: a card
  must keep SHOWING the value, because no board column and no bucket says anything about
  *when*, so the card is the only place it appears; and it must not carry the CHIP, whose
  entry is the row menu's and which no card projection routes to — an affordance that
  looks live and is not. This is the case that shows the card filter's own rule is about
  **repetition** rather than about which kinds are chips: state and horizon are withheld
  from a card because its column or its bucket already says them, and a date has no such
  equivalent. Found by review (Codex, PR #152) after the first version reclassified the
  keys and silently dropped them from every card.
- **3a — the entry is confirmed unchanged.** Nothing is written and the previous undo
  stands, including where the key exists holding an empty value: `planFrom` decides from
  the FORM, and a field nobody touched states nothing
  ([[planFrom still decides a removal from the model, not the form]]).
- **3b — the field is emptied.** That end's key is removed and the other is left alone, so
  a span can be reduced to a milestone without unscheduling the item. Absence is a value,
  never an empty string.
- **3c — the field arrived blank because the note's value is unreadable.** Confirming it
  writes nothing, so an unreadable date cannot be cleared from the chip. **Unschedule**
  remains the way out and takes both ends with it — the cost
  [[Horizon and dates from the row]] extension 4d already records, reached by one more
  surface rather than newly created by it.
- **3d — the entered date would put the target before the start.** Refused at the entry,
  with the reason, nothing written, the prompt left open on what was entered. The one-end
  entry shows one field, so the rule is checked against **the end the note states**, and
  the message NAMES that date: a refusal measured against a field the reader cannot see
  otherwise reads as a bug rather than as a rule. A marker is exempt by construction — the
  end it does not have is not compared against, so a stale start cannot refuse the only
  date that type has.
- **3e — the write is refused** (configuration problems, or a batch naming an excluded
  note). Refused whole and loudly; the row keeps rendering what the note still says.
- **3f — the new date takes the note outside the Base's filter.** The write stands and the
  row leaves the tree on the refresh, in silence — the behaviour everywhere else in this
  plugin. Undo still takes it back across the boundary.
- **4a — the keyboard.** The chip is `tabindex="-1"` like every other per-row control, and
  the row menu's **Schedule** is the documented path. It opens both ends rather than one,
  which is enough: a field left untouched writes nothing, so that entry already produces
  the identical one-ended batch. What a keyboard cannot reach is the shortcut, not the
  capability — see **Not built**.

## Acceptance criteria

- With a date property configured and shown by the properties menu, every row draws a chip
  for it showing the date its note states, standing in that property's read-only cell
  rather than beside it, and neither chip nor column appears while the property is not
  shown.
- Pressing it opens an entry for **that end alone**, prefilled from the note, and writes
  exactly that key in one batch, one undo — the same batch the equivalent roadmap gesture
  produces, because it is the same planner and the same host method.
- An unset note draws a dashed chip named for the column and saying what pressing it does;
  an unreadable value draws that same face with the reason in its tooltip; a `Milestone`'s
  start cell is empty; a row the Base excluded draws a static chip, or none where it has
  nothing to say.
- Clearing the field removes that end's key alone and leaves the other, and undo restores
  it; re-confirming the entry unchanged writes nothing and keeps the previous undo.
- A date that would reverse the span is refused at the entry against the end the note
  states, naming that date, and nothing is written.
- On a card the date renders as the value it always did, and the chip does not appear
  there at all.
- Transition stamps and every other key the plugin owns stay untouched by these writes.
- The column is in the fit budget and drops whole, by its place in the properties menu's
  order like every other column — which cost nothing to deliver, because these are
  ordinary resolved columns and `columnFit` sums every one of them whatever its kind.
- **Not built:** per-end entries in the row menu. The chip's exact control has no menu
  twin, only an equivalent one, so the register's "two surfaces over one action must be
  available at the same times" rule is satisfied by argument here rather than by
  construction. If the two-field entry ever stops writing nothing for an untouched field,
  this falls with it.
- **Not checked here:** how the chip looks in a themed vault, and whether six fixed
  columns still read as columns on a real pane ([[Smoke test the tree]]).

## Where it lives

`renderDateChip` in `src/view/render/chips.ts`, driven by a table of the two ends, beside
`renderStateChip`, `renderHorizonChip` and `renderLabelChip` whose shape it takes. That
file is new: the chips were in `src/view/render/columns.ts` until this change would have
taken it past its 400-line budget, and the seam is the one `writeGate.ts` and
`cardMoves.ts` were taken along — `columns.ts` decides WHICH properties are columns and
how wide they are, and `chips.ts` decides what a cell that is more than a value draws.
`renderCell` is the one caller and stays in `columns.ts`, because dispatching on a
column's kind is a question about columns — and it is where the per-projection answer
lives too: a date kind draws its chip on a tree-shaped projection and falls through to
`renderValue` anywhere else, asked through `treeShaped` so the catalog is a tree here
without anyone remembering to add it. `renderCardBody` in `src/view/render/board.ts`
carries the other half, admitting both kinds to the columns a card draws.

The kinds are `'start'` and `'target'` in `ColumnKind` (`src/view/host.ts`), assigned by
`columnKind` — now a LIST of key-to-kind claims rather than the chain of ifs it was, which
hit the complexity budget at the eighth key. Each date end is claimed on its KEY alone,
the assignee's reasoning rather than the horizon's: a date field needs no declared
vocabulary, so there is no second half to pair with, and `hasDateAxis` is not asked
because it answers whether the ROADMAP can draw a timeline.

The entry is `promptSchedule` in `src/view/interactions/plan.ts`, which now takes the ends
to ask for and defaults to the item's own — **no new modal**: `SchedulePromptModal` already
takes a field list, and a one-end entry is that list with one row in it. `unshownEnds`
beside it is the span rule's baseline, and is the one thing on this path decided from the
model rather than from the form; the comment there says why that is safe where a WRITE
decided the same way was not.

Tests: `test/view/dateChips.test.ts` (the faces, the marker's empty cell, the one-end
write, the reversal refusal — each watched failing), `test/view/planAgreement.test.ts`
(a fifth pair: the chip against the timeline grip for the same date),
`test/view/contextRowWrites.test.ts` (the every-entry-point sweep now drives it), and
`test/helpers/fixtures.ts`, whose `demoOrder()` shows both date properties so
`npm run harness` draws every face against the real stylesheet.
