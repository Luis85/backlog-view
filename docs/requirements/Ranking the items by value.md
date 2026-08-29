---
type: PBI
parent: "[[The prioritized list]]"
order: 10
status: Done
created: 2026-08-17
source: written after the first increment shipped, to describe what was built
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Ranking the items by value

**As** someone deciding what to do next, **I want** the items and their numbers as one
sortable table, **so that** the comparison this view exists for is one screen rather than
eight notes opened side by side.

Seven columns — item, value, coverage, confidence, effort, indicator, currency — each a
real header button, though the indicator draws only while at least one operand is
configured (the shipped default configures one, so it draws in practice). A click sorts a
copy of the model's own items. Sorting this table is reading; the backlog's `order` is
untouched by every click on it.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is prioritizing |
| **Trigger** | Opening the estimation view on a configured model, and clicking a column header |
| **Preconditions** | The model resolves without problems |
| **Guarantee** | Nothing in this table writes. No sort, no selection and no keypress on it changes a note, a rank or a property — the only thing a click can change is what the reader is looking at. |

**Main flow**

1. The view draws one row per result, in the Base's own order, with no column marked
   sorted.
2. The user clicks a column header. The table sorts a copy of the items and marks that
   header with `aria-sort`.
3. The user clicks the same header again and the direction flips.
4. The user selects a row — by click, or by arrow key from the table — and the panel
   opens on it ([[Taking a total apart]]).
5. The pick is remembered for this saved view, so reopening it sorts the same way.

**Extensions**

- **1a — the base returned nothing.** The results empty state draws in place of the rows.
- **2a — a number column's first click.** Descending, because the useful first look at a
  value, a coverage, a confidence, an effort or the indicator is the top of it. The title
  column's first click is ascending, for the same reason.
- **2b — a row has nothing to show for the active column.** It sorts after every answered
  row, in both directions. Absence is not a low value.
- **2c — the currency column.** It sorts by a declared reading — current, stale, foreign,
  handwritten, orphan, none — rather than alphabetically, which is the order a reader
  hunting for rows that need attention wants.
- **2d — a different column is clicked.** It starts at its own first direction, and
  `aria-sort` moves off the old one rather than marking two.
- **4a — the arrow keys reach the end of the table.** They hold at the last row and at the
  first rather than wrapping. `Enter` opens the selected note; with nothing selected it
  opens nothing, and on an empty table nothing happens at all. `ArrowRight` moves focus into
  the selected row's panel. `Enter` still opens the note.
- **4b — the selected row leaves the results.** The stale selection is cleared, so the
  next arrow press does not teleport to row 0.
- **5a — the base identity cannot be resolved.** The pick still sorts on screen and
  touches no store entry — session-only, exactly as the roadmap's axis and the shelf's own
  sort are. An unrecognized stored value falls back to Base order rather than to a guess.

## Acceptance criteria

- Every header is a real button; before any click no column carries `aria-sort`.
- A number column sorts descending first and flips on the second click; the title column
  sorts ascending first.
- Rows with nothing to show for the active column sort last in both directions.
- The currency column sorts current, stale, foreign, handwritten, orphan, none.
- Switching columns moves `aria-sort` and starts the new column at its own first
  direction.
- The pick survives a second view over the same base and view name, is session-only
  without an identifiable base, and falls back to Base order for a value it does not
  recognize.
- Arrow keys hold at both ends, `Enter` opens the selected note, and a selection whose row
  has left the results is cleared rather than carried.
- The selection and the scroll position both survive a rebuild, and a restored scroll
  position is clamped when fewer rows remain.
- No click on this table writes anything: the Base's own order underneath it is never
  touched.

## Where it lives

`src/view/estimation/estimationView.ts` (the Bases view itself — loading, the guided empty
state, the config warning, the table for a configured model, and `selectedPath`) ·
`src/view/estimation/register.ts` (`registerEstimationView` — this view's own
registration file, ADR 0030, sharing the plugin-wide `WriteLock`) ·
`src/view/estimation/renderTable.ts` (the header buttons — seven while the indicator is
configured — `aria-sort`, one row per item, `CURRENCY_ORDER`, and the delegated click and
keyboard) ·
`src/view/estimation/currencyChip.ts` (`renderCurrencyChip`, split out once
`renderTable.ts` neared its 400-line cap — the currency CELL `renderTable.ts` draws is
the fixed-width column; this module draws the CHIP inside it, sized to its own word,
with an icon for the two currencies — stale, orphan — that need an action) ·
`src/domain/estimationItems.ts` (`buildEstimationModel`, the items being sorted) ·
`src/storage/viewStateStore.ts` (the `estimationSort` pref, resolved through the same
`resolveViewIdentity` the backlog's tree restores by).

Tests: `test/view/estimation/table.test.ts`, `test/view/estimation/sort.test.ts`,
`test/view/estimation/states.test.ts`, `test/view/estimation/register.test.ts`.
