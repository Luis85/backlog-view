---
type: PBI
parent: "[[View state]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Property columns

**As** someone scanning a backlog for priorities or owners, **I want** the Base's
properties in aligned columns, **so that** I can read down a column and compare — which is
the whole reason to put values in columns rather than after the title.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Any render, once the Base's visible properties are known |
| **Preconditions** | The Base has visible properties configured |
| **Guarantee** | A rendered column always sits under its header. Values that cannot line up are not rendered at all. |

**Main flow**

1. Which properties become columns is resolved **once per data update**, and everything
   else reads that result — the rows, the header and the tag menu alike. Membership and
   order are the **Bases properties menu's**, and nothing else's: a property is a column
   when the menu shows it, where the menu puts it. What kind of property it is decides
   only what is drawn *inside* the cell — a chip for a state, horizon, risk or tags
   property, the value otherwise — never whether there is one
   ([ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md)).
2. Every column that is DRAWN renders on **every** row, empty cells included, or the
   columns after it would shift from row to row. Drawn is not the same as configured:
   one the pane cannot hold is on no row at all (**3a**).
3. Columns are fixed-width, so values line up regardless of title length or indent depth.
4. A presentational header names them; each cell carries its property name in its tooltip
   and `aria-label` rather than repeating it as visible text. It names what is DRAWN, and
   is absent entirely when nothing is — a bar whose labels have all gone is a sticky
   bordered stripe above the rows, and the rollup being *configured* is not the same
   question as its being on screen.

**Extensions**

- **1a — the tags property is one of the columns.** Its values render as pills, editable
  from the context menu. Editing follows the **column**, not the setting: a menu that
  edited an invisible property would write something nothing on screen shows.
- **1b — the tags column has dropped for width.** The menu still offers it, with the
  item's tags checked. No command is withheld for lack of space, and on a narrow pane the
  menu is the only way left to edit.
- **2a — a row renders no add button.** Its width is reserved anyway. The rule in step 2
  is about the whole end-anchored strip and not only about the columns: a row that can
  hold nothing withholds the control, and skipping the element it sat in slides every
  column on that row right by its width.
- **3a — the pane is too narrow.** Columns **drop whole**, from the END of the properties
  menu's order — that order is the user's own statement of what matters, so a ranking of
  the view's own beside it would be a second opinion about it — and the rollup drops after
  all of them, since it is pinned past the end of that order rather than being in it.
  Shrinking one would put it out from under its header, which is worse than not showing
  it. A dropped column is **not rendered**: clipping it would leave its cell in the
  accessibility tree, so a control inside a column the view says it dropped would stay
  reachable and focusing it would scroll the strip out from under its header. The
  threshold is derived from the *configured* width and count, measured after the rows
  render so a scrollbar is already accounted for, and always against the columns that
  EXIST rather than the ones the last verdict left — measuring the survivors would ratchet
  the count down and never let a column come back when the pane widens.
- **3b — the verdict changes after a render.** Exactly one more pass runs; the second
  measures the same tree, so it cannot oscillate.

**Guarantees**

- A tag edit is written as a **delta**, never as a computed list. A row's tags are a
  snapshot from the last refresh, so two removals before that refresh lands would both
  start from the same list and the second would put the first tag back. The delta is
  applied against the live value inside `processFrontMatter`.

## Acceptance criteria

- Columns are fixed-width so values line up across rows regardless of title length.
- A pane too narrow drops whole columns rather than shrinking them out of alignment, from
  the end of the user's order, and a dropped column leaves nothing a keyboard or a screen
  reader can find.
- Tag edits are written as a delta, never as a computed list, so two quick edits cannot
  undo each other.
- The set of columns is derived once and read everywhere — deriving it twice is how the
  tag menu came to offer editing for a column the renderer had skipped.
- The widths TypeScript owns are published to CSS as custom properties, so the layout and
  the fit calculation cannot drift apart. One property per column, since
  [[Resizable property columns]] gave each its own width.

## Where it lives

`src/domain/viewOptions.ts` (`tagsProperty` — and no option for
*whether* to show the columns: the Bases properties menu is the only switch, and
[ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md) is why; no option for
their WIDTH either since 2026-08-14, which is [[Resizable property columns]]) ·
`src/view/render/columns.ts` (`RowContext`, the header, every trailing cell, plus
`resolveColumns` and the fit — `columnFit` decides how many columns the pane holds and
`syncColumnFit` applies that count, together, because a threshold computed in one file and
applied in another is one edit away from the two disagreeing; `rowContext` is where the
count becomes the slice the renderers draw) ·
`src/view/resize.ts` (`ResizePolicy` — when to re-measure, paired with `syncColumnFit`
above; `src/view/backlogView.ts` owns the `ResizeObserver` itself and forwards to it) ·
`src/view/interactions/tags.ts` (vocabulary, normalization, the delta writes).
Tests: `test/view/columns.test.ts`, `test/view/tags.test.ts`.
