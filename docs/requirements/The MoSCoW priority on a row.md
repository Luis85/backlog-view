---
type: PBI
parent: "[[Prioritization]]"
order: 10
status: Done
priority: P2
created: 2026-08-16
source: user request
files:
  - src/domain/optionalProperties.ts
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/labels.ts
  - src/view/render/chips.ts
started: ""
finished: ""
horizon: ""
risk: ""
assignee: ""
start: 2026-08-16
due: 2026-08-16
---

# The MoSCoW priority on a row

**As** someone deciding what a team does next, **I want** each item to carry a priority
from a short ladder I declare, shown on its row and changed there, **so that** what is a
`Must` and what is a `Won't` is written down beside the work instead of argued about again
every planning session.

This is the second DECLARED ladder, not a second kind of thing. [[Setting the risk on an
item]] built the property, the vocabulary and the write; [[Risk from the row]] built the
chip. Everything either of them established holds here unchanged — absence is a value, the
checkmark is asked of the plan, a context row is never a write target — so what this note
says is which vocabulary ships and where the shape was reused rather than copied. It is
one use case rather than the risk feature's two for exactly that reason: there was no
second increment, because the surface came with the property.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The row's own **priority chip**, or **Set priority** in its context menu |
| **Preconditions** | A named priority property **and** a non-empty ladder; the tree has loaded |
| **Guarantee** | A rung is written only to a note the base returned and only to a key the options name. Absence is preserved as a value — a note nobody has ranked carries no priority key at all, and clearing removes the key rather than blanking it. The chip and the menu offer the same list, checked the same way, because they are one builder. |

**Main flow**

1. The user names the priority property (`priorityProperty`), or presses ✨ and lets this
   view bind the key it suggests — `priority`, the same key the picker shows as its
   placeholder.
2. The ladder (`priorityValues`) ships prefilled with `1 - Must, 2 - Should, 3 - Could,
   4 - Won't` and stays editable: a default vocabulary, not a fixed one.
3. ✨ creates that key, empty, on every result that does not carry it. Nothing is ranked
   for the user.
4. The tree draws a priority column, one chip per row, naming the rung the note declares.
5. Pressing the chip — or **Set priority** in the row menu — opens the ladder, with the
   item's own rung checked and **Clear priority** at its foot while the note carries the
   key.
6. Picking a rung writes it to the note's own priority property, through the one write
   gate, as a single undoable batch.

**Extensions**

- **1a — the priority property shares a key with another property this view owns.** The
  collision is reported and every write in the view is blocked until it is fixed
  ([[Safe writes]]). Priority joins that report by name like every other property.
- **2a — the ladder is emptied.** No **Set priority** and no chip — absent rather than
  inert, on exactly the pair `hasPriorityLevels` asks. The property is still backfilled,
  still edited in Obsidian's own editor, and goes back to being an ordinary read-only
  column. Deliberately unlike the horizon axis, whose key is *not* stubbed when its values
  are cleared: priority has no projection to be incoherent with, which is
  [[Setting the risk on an item]] extension 2a's reasoning unchanged.
- **4a — the note holds a rung the declared ladder does not name.** It is appended to the
  end of the list so it can render checked, and the chip shows it. A menu that cannot show
  what the item *is* loses that value on the next pick. This is the ordinary case in a
  vault that ranked with `P1`/`P2` before naming a MoSCoW ladder.
- **4b — the note carries the key with nothing in it**, the state ✨ leaves behind. The
  chip reads *Priority*, dashed and faint, and its accessible name says pressing it sets
  one; no entry is checked and no nameless entry joins the list. **Clear priority** is
  still what takes the key away.
- **4c — the priority property is one of the Base's visible columns.** The chip stands in
  its place ([[Property columns]]), the state, horizon and risk rule exactly: a value with
  an interactive surface of its own is not also drawn as a read-only cell.
- **4d — the pane is too narrow.** The column drops WHOLE rather than shrinking, in its
  place in the properties menu's order like every other column, and its width is in the
  fit budget — a column drawn but not summed overflows instead of dropping.
- **5a — the row came from outside the Base's filter.** The chip is a static `div` with
  the reason in its tooltip, and **Set priority** is absent from the menu. With nothing to
  show there is no chip at all rather than a button-shaped invitation to a write this row
  cannot take. The gate refuses whole any batch that names such a row anyway.
- **5b — the keyboard.** The chip is `tabindex="-1"`, like every other per-row control:
  the tree is one tab stop, arrows move the selection, and the context menu's **Set
  priority** is the documented keyboard path.
- **6a — the rung picked is the one the item already holds.** Nothing is planned and
  nothing is written, matched case-insensitively, so a re-pick cannot spend the one undo
  slot on a change nobody made — and the note's own spelling is left exactly as it is.
- **6b — the note carries no priority key.** **Clear priority** is absent. Every removal
  action in this view is offered on the key's *presence* rather than on its value, so none
  of them can write nothing.

## Acceptance criteria

- A `priorityProperty` picker and a `priorityValues` list appear in the view options under
  **Prioritization**; the list ships holding `1 - Must, 2 - Should, 3 - Could, 4 - Won't`
  and can be emptied.
- ✨ binds `priority` when the option was never touched, and creates that key empty on
  every result lacking it — leaving every existing value untouched.
- Every row draws a priority chip showing the rung its note declares, and pressing it
  opens the same list, with the same entry checked, that the row menu's **Set priority**
  offers — one builder, so the two cannot drift.
- Picking a rung writes only the priority key; clearing deletes it; both are one undoable
  batch, and the undo restores the prior value.
- Neither the chip nor the menu appears while the property is unnamed or the ladder is
  cleared, where the property is an ordinary column again — and a priority write aimed at
  a row the base excluded is refused whole.
- **Not checked here:** how the chip looks in a themed vault, and whether five fixed
  columns still read as columns on a real pane. The jsdom suite asserts markup and the
  browser harness draws without asserting ([[Smoke test the tree]]).

## Where it lives

Priority is a row of the optional-property table in `src/domain/optionalProperties.ts`,
which is what makes steps 1 and 3 work with no code of their own: `adoptableProperties`
binds the suggestion, `configProblems` reports its collisions, `readOwnKeys` in
`src/domain/readItems.ts` tracks whether the note carries the key, and `missingKeyStubs`
in `src/domain/writePlan.ts` stubs it. `hasPriorityLevels` in `src/domain/settings.ts` is
the pair from steps 1 and 2 asked once — beside `hasRiskLevels` and stated separately
rather than parameterised, for the reason `resolvedTestStateKey` gives beside
`resolvedDeliverableStateKey`.

The **Prioritization** option group and `DEFAULT_PRIORITY_VALUES` are
`src/domain/viewOptions.ts` and `src/domain/settings.ts`; the rung the note declares is
read into `priorityValue` by `src/domain/readItems.ts`, the tolerant way the workflow
state is read.

Step 6 is `computePriorityWrites` in `src/domain/writePlan.ts` — the value, or null for a
removal offered only on presence — applied by `applyLabels` in
`src/storage/frontmatter.ts`, which took it as one row in its list and needed no new shape
at all. That is the standing rule collecting: `applyRisk` was the third restatement of
"never a key no property names, and a null removes rather than blanks" and was extracted
when the assignee arrived; this is the first label property to arrive after the
extraction, and it cost one line there and one in `touchedKeys`
(`src/storage/writeKeys.ts`), which is what makes the write undoable.

What the menu OFFERS is `addPriorityItems` in `src/view/interactions/labels.ts`, beside
`addRiskItems` and over the same `declaredChoices` — the "declared list, plus the item's
own unlisted value" rule, which was `riskChoices` until this ladder wanted it and now
takes the list and the value rather than the host and the item. The chip is a row of
`LABEL_CHIPS` in `src/view/render/chips.ts`, drawn by the same `renderLabelChip`, and the
column is a row of `columnKind`'s claims in `src/view/render/columns.ts`;
`src/view/interactions/menu.ts` keeps the **Set priority** entry beside **Set risk**,
because a priority is an attribute of the item and not a position on an axis.

Driven in `test/view/priority.test.ts`, `test/storage/labelWrites.test.ts`,
`test/domain/settings.test.ts` and `test/view/contextRowWrites.test.ts`, whose write sweep
now carries a priority on all three context rows so a new write path fails it without
anyone predicting the surface.
