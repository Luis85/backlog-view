---
type: PBI
parent: "[[Risk management]]"
order: 20
status: Done
priority: P2
created: 2026-08-09
source: user request
files:
  - src/domain/settings.ts
  - src/view/backlogView.ts
  - src/view/interactions/menu.ts
  - src/view/render/columns.ts
  - src/view/render/rows.ts
---

# Risk from the row

**As** someone reading a backlog rather than auditing one, **I want** to see each item's
risk on its row and change it there, **so that** the level is read where the work is
listed instead of only by opening a menu on the one item I already suspected.

[[Setting the risk on an item]] built the property, the vocabulary and the write; what it
deliberately did not build was a surface. The design note refused a column on a cost
argument — the responsive fit budget sums every column a row can carry, and one drawn but
not summed overflows rather than dropping — and on the observation that the menu makes the
levels pickable, which is what the levels were for. **Pickable is not the same as
visible.** A risk nobody can see on the row is a judgement that has to be gone looking
for, one item at a time, which is the spreadsheet the feature exists to replace. The
budget argument was a reason to add the term, not a reason to withhold the column: the
state chip and the horizon chip both pay it.

So this is the third instance of one shape, not a third kind of thing — [[Workflow state]]
settled it for the state property and [[Horizon and dates from the row]] took it over the
placement, both times as a chip in a fixed column, opening the row menu's own builder.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The row's own **risk chip**, or **Set risk** in its context menu |
| **Preconditions** | A named risk property **and** a non-empty levels list; the tree has loaded |
| **Guarantee** | The chip shows what the note says and offers exactly what the menu offers. Nothing is drawn or written unless both halves are configured, and a row the base excluded is shown its level and offered no way to change it. |

**Main flow**

1. The tree draws a risk column, one chip per row, between the property columns and the
   horizon.
2. The chip names the level the note declares.
3. Pressing it opens the levels list — the row menu's own, with the item's own level
   checked and **Clear risk** at its foot while the note carries the key.
4. Picking one writes it exactly as the menu does: one batch, through the one gate, one
   undo.
5. The row re-renders what the note now says.

**Extensions**

- **1a — risk is not fully configured.** No column at all: absent rather than inert, on
  exactly the pair the menu is gated on ([[Setting the risk on an item]] extension 2a). A
  property with no declared levels is still a legitimate free-text property that Obsidian's
  own editor edits, and the backfill still stubs it — the chip is what goes away, not the
  property.
- **1b — the risk property is one of the Base's visible columns.** The chip stands in its
  place, the state and horizon rule exactly ([[Property columns]]): a value with an
  interactive surface of its own is not also drawn as a read-only cell, or the row would
  show it twice with only one of them editable. With the levels cleared there is no chip
  and the property goes back to being an ordinary column.
- **1c — the pane is too narrow.** The column drops WHOLE rather than shrinking, and it
  drops after the property columns and before the rollup. That position is a claim about
  what summarizes a row: the state chip survives longest because it does so on its own, the
  placement next, and risk goes before the rollup because it is the only one of the four
  whose property is still readable in Obsidian's own editor when the column is gone — the
  rollup is derived from rows nothing else shows. Its width is in the budget rather than
  merely in the stylesheet: a column drawn but not summed overflows instead of dropping.
- **2a — the note carries no risk, or an empty key.** The chip reads *Risk*, dashed and
  faint, and its accessible name says pressing it sets one. Not nothing, which is what an
  unset horizon draws: absence there is a placement the shelf already names elsewhere,
  while absence here is an invitation, and the row is where the judgement is meant to be
  made. An empty key reads the same as no key — it holds no judgement either — and
  **Clear risk** is still what takes the key away.
- **2b — the note holds a level the declared list does not name.** The chip shows it, and
  the menu appends it so it renders checked ([[Setting the risk on an item]] extension 4b).
  A chip that could not show what the item *is* would be worse than no chip.
- **3a — the row came from outside the Base's filter.** The chip is a static `div`, not a
  button: shown with the reason in its tooltip, never a write target. With nothing to show
  it is absent entirely rather than a button-shaped invitation to a write this row cannot
  take. The gate refuses whole any batch that names such a row anyway.
- **3b — the keyboard.** The chip is `tabindex="-1"`, like every other per-row control: the
  tree is one tab stop, arrows move the selection, and the context menu's **Set risk** is
  the documented keyboard path. Assistive tech can still activate it.

## Acceptance criteria

- With a risk property named and levels declared, every row draws a risk chip showing the
  level its note declares, and pressing it opens the same list, with the same entry
  checked, that the row menu's **Set risk** offers — one builder, so the two cannot drift.
- Picking a level from the chip writes exactly the risk key, one batch, one undo — the
  same write the menu produces, since it is the same plan.
- The chip replaces the property's read-only cell while it is drawn, and neither the chip
  nor the column appears while risk is not fully configured, where the property is an
  ordinary column again.
- An unjudged note draws a dashed chip that says what pressing it does; a row the Base
  excluded draws a static one, or none where it has nothing to say.
- The column is in the fit budget and drops whole, after the properties and before the
  rollup.
- **Not checked here:** how the chip looks in a themed vault, and whether four fixed
  columns still read as columns on a real pane. The jsdom suite asserts markup and the
  browser harness draws without asserting ([[Smoke test the tree]]).

## Where it lives

`renderRiskChip` in `src/view/render/columns.ts`, beside `renderStateChip` and
`renderHorizonChip` whose shape it takes, gated on `hasRiskLevels` in
`src/domain/settings.ts` — the same predicate the row menu's **Set risk** is gated on, so
a chip whose menu could set nothing is not a state either side can reach alone. The column
is `RISK_COL_WIDTH` and a `hideRisk` term in the same file's `columnFit`, whose verdict
`src/view/backlogView.ts` clears when a card projection takes over; the width is published
to CSS by `renderTree` in `src/view/render/rows.ts`, so the stylesheet reads the number
rather than repeating it. `chipProps` beside them adds the risk key to the properties an
interactive chip already shows.

The menu is `showRiskMenu` in `src/view/interactions/menu.ts` — one of four one-line
exports over `chipMenu` there, which is what four per-row controls opening their section's
own builder now costs; the builder itself (`addRiskItems`) is untouched and shared with the
row menu.

Driven in `test/view/risk.test.ts`, whose chip block was watched failing without the
change, and in `test/harness/harness.test.ts` against the demo fixture, which carries a
declared level, an undeclared one, an unjudged row and a context row so the browser
harness draws all four faces.
