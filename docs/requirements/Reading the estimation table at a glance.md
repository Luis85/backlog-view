---
type: PBI
parent: "[[The prioritized list]]"
order: 20
status: Open
created: 2026-08-20
source: design pass, 2026-08-20
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Reading the estimation table at a glance

**As** someone scanning the table before opening any note, **I want** the columns to line
up, the currency to carry colour only where something needs doing, and the panel's answer
to stay on screen while the rest of it scrolls, **so that** value, coverage and currency
read as one system rather than a spreadsheet of bare digits nobody has explained.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is scanning the table, before opening any note behind it |
| **Trigger** | Opening the estimation view on a configured model |
| **Preconditions** | The model resolves without problems |
| **Guarantee** | Nothing on the toolbar writes except the two actions that already existed — the backfill and the undo of the last batch — and both go through the same gate every other write in this view does. |

**Main flow**

1. The table draws with a 3px strip under the value and coverage cells, scaled to the
   model's own declared output range rather than to whatever the base happens to return,
   and a currency chip that spends colour and an icon only on the two currencies that need
   an action.
2. With at least one result, the first row is selected on the first render, so a scored
   panel is already on screen — nothing is written by the selection itself.
3. The panel's header states the item's title, then the total, its coverage and the
   currency chip, then the two derived numbers, and stays pinned in view while the
   dimension rows beneath it scroll.
4. Each dimension and scale draws its label and its point buttons on one line, with the
   rubric sentence for the held point kept on its own line below, and a clear control
   revealed on hover or focus rather than sitting there always.
5. The toolbar above the table states how many of the results are scored, and both its
   buttons — the backfill action and the undo of the last batch — disable while a write is
   in flight.
6. `ArrowRight` on the selected table row moves keyboard focus into that row's panel, so
   the panel is reachable without a pointer and without passing through every point button
   in the table first.

**Extensions**

- **1a — the currency is `none`.** The cell holds no chip at all — only the dash every
  other cell with nothing to show already draws. An empty pill beside four coloured ones
  would read as an unfilled field.
- **2a — the base returns nothing.** No row is selected, and the results empty state draws
  in the table's own track; the panel column stays collapsed rather than drawing a
  placeholder that explains what a click would give.
- **4a — a clear control removes the row's own stored value.** Focus moves to the row it
  was pressed in, not to the button, which is gone along with the value it removed.
- **5a — the undo button.** It re-enables to the write gate's own undo slot, never merely
  because a batch finished — a batch that changed nothing installs no inverse and leaves
  undo exactly as disabled as it was.

## Acceptance criteria

- The value and coverage strips are sized from the model's declared output range; adding
  or removing items from the base does not move a strip that is already drawn. Confidence
  and effort carry no strip at all.
- `current` draws no colour class. `stale` and `orphan` draw attention orange plus an
  icon each. `foreign` and `handwritten` draw a dashed edge with no fill. `none` draws no
  chip shell.
- The currency cell is a fixed 140px column; the chip inside it sizes to its own word, so
  no row's chip width can shift a sibling column's left edge.
- The panel's header — title, total, coverage, currency chip, both derived lines — stays
  on screen while the rows beneath it scroll.
- Each dimension and scale row puts its label and its points on one line; the rubric
  sentence for the held point is still on its own line below, never moved to hover only.
- A clear control is invisible until its row is hovered or the control itself holds
  keyboard focus.
- Opening a configured view with at least one result selects the first row and writes
  nothing.
- The toolbar states `{scored} of {total} scored`, and both its buttons are disabled
  while `EstimationView.gate` is writing.
- `ArrowRight` on a table row moves focus into that row's panel; `Enter` still opens the
  selected note.

## Where it lives

`src/view/estimation/estimationView.ts` becomes a flex column — the toolbar above the
existing two-track grid rather than the grid alone — and its `render()` now selects the
first row itself whenever nothing is already selected, so a fresh view opens on a scored
panel instead of an empty second track; `syncBusy` publishes the write gate's state to the
toolbar the same way it already publishes `aria-busy` to the pane. `src/view/estimation/
toolbar.ts` is the module this pass adds: the bind-and-backfill action and the batch undo
the view already had and could not reach a second time, plus the `{scored} of {total}
scored` count, all three going quiet or disabled together while a write is running.
`src/view/estimation/renderTable.ts` gains the value and coverage strips and the currency
cell split from its chip, so a long currency word can no longer widen the column it sits
in, plus the `ArrowRight` handler that hands focus to the selected row's panel. Reading the
active sort at a glance is not colour alone: the sorted header's `sortHeader` also draws a
`chevron-up` (ascending) or `chevron-down` (descending) glyph beside its own truncating
label span, and states the direction in the button's own accessible name rather than
trusting `aria-sort` to be read by anything. `aria-sort` **stays** — it is the style hook
the stylesheet selects on, and the hook a future move to real column-header roles would
already need.
`src/view/estimation/panel.ts` gains the sticky header that states the title, the total,
the coverage and the currency chip above the dimension rows — see
[[Taking a total apart]] and [[Why this item scored what it scored]] for what moved there
and why — and the one-line row shape with its hover-revealed clear control, whose
radiogroup semantics and rubric-visibility rule [[A rubric for every point]] specifies.

Tests: `test/view/estimation/table.test.ts`, `test/view/estimation/panel.test.ts`,
`test/view/estimation/keyboard.test.ts`, `test/view/estimation/toolbar.test.ts`,
`test/view/estimation/states.test.ts`, `test/view/estimation/styleRules.test.ts`,
`test/view/rendering.test.ts`.
