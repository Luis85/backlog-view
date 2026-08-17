---
type: Test case
order: 20
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Tree columns and narrowing

A verification to run.

## Why this exists

`columnFit` computes a threshold from the drawn columns' own widths; jsdom can assert
how many cells it renders but never that the header actually lines up with the cells below
it, or that the drop reads as graceful rather than jarring. The same is true of the resize
grips added on 2026-08-14: the suite drives the gesture, and only a vault shows whether a
6px strip that is invisible until hovered can be found by somebody looking for it.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- **First, before anything else: do the chips render at all?** `resolveColumns`
  (`src/view/render/columns.ts`) matches every `getOrder()` entry against
  `` `note.${key}` `` — that is how a state, horizon, risk or tags property is recognised
  as its own kind, and how `parent`, `order` and `type` are skipped. But a `.base` file
  persists the order as **bare names**: `docs/Product Backlog.base` stores `status`,
  `priority`, `area`, `tags`, and the table view beside it mixes bare `type` with
  `file.name`. So the whole feature rests on Bases normalising order entries to `note.*`
  before `getOrder()` returns them, and nothing in this repository can ask it.
  If it does not, no id matches: every column falls through to the plain `value`
  rendering, no chip is drawn anywhere, the cells are probably empty (`getValue('status')`
  with an unqualified id), and `parent` / `order` / `type` stop being skipped. That is
  the whole feature failing at once, not one property looking odd, so it is the first
  thing to look at and the thing to report before running the rest of this list. Open
  `docs/Product Backlog.base` in a vault, confirm `status` and `tags` are among the
  visible properties, and confirm the state chip and the tag pills are on the rows.
  The assumption is not new — the old skip list matched the same way — but its blast
  radius is: it used to mean one property rendered twice.
- With the pane at its default width, confirm the column header sits directly above the
  cells it names — no drift row to row.
- Narrow the pane slowly and watch the columns drop from the END of the properties menu's
  order, one at a time, the rollup surviving them all and going last (`pbl-hide-meta`,
  the one class left). Title and structure stay to the end.
- Widen back out and confirm every column returns in the same order it left.
- A dropped column is not rendered at all, so Tab and the screen reader should find
  nothing where it was — check with a checkbox-rendering property in the last column.
- **The resize grips** ([[Resizable property columns]]): hover a column header and
  confirm the whole column band washes in the hover colour — the strip's full height,
  square corners, no gap above or below — and the mark paints at its leading edge;
  on the mark, confirm the cursor becomes a resize cursor and the accent confirms it;
  drag it and confirm the boundary under the pointer follows it, live, with every row's
  cell in that column moving too and the header still above its own values when you let
  go. Reopen the base and confirm the
  width came back. Then Tab into the tree, confirm the grips are reachable in order,
  step one with the arrow keys, and press Home to put it back. Then resize one by pointer
  again and double click the same grip, which is the reset a mouse has.
- A theme is what this last part is really for: the grip borrows `--interactive-accent`
  and `--text-on-accent`, and whether it reads as a handle against a themed header is not
  a question the browser harness can answer.

## Acceptance criteria

- **Confirmed that a `.base` storing bare property names still yields `note.*` ids from
  `getOrder()`**, by seeing the chips render from `docs/Product Backlog.base`. A failure
  here invalidates the rest of the list rather than being one item on it.
- Header alignment confirmed at default width.
- The drop confirmed to follow the menu's order from its end, both narrowing and widening,
  with the rollup last.
- A column resized by pointer and by keyboard, alignment held through both, and the width
  confirmed to come back after a reopen.
