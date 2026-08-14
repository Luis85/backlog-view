---
type: PBI
parent: "[[The render path states its costs as checks]]"
order: 50
status: Done
area: performance
created: 2026-08-12
closed: 2026-08-12
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A row costs its content, not its wiring

**As** someone working a few-hundred-row backlog, **I want** a data update to spend its
time on what the rows show rather than on re-parsing icons and re-wiring listeners,
**so that** the refresh that ends every write batch stops costing half a second of it.

## Use case

| | |
| --- | --- |
| **Actor** | The render pass — on every data update, including the one that ends every write batch |
| **Trigger** | `onDataUpdated`, a projection switch, or any other full content render |
| **Preconditions** | None — the tree renders exactly as before; only where its cost goes changes |
| **Guarantee** | Every gesture means what it meant: activation, folding, menus and the native drag behave identically, and a handler acts only on the item the CURRENT model holds for the row under the event — never on one captured at render time. |

**Main flow**

1. Each icon a row draws is cloned from a per-name template built once through the real
   `setIcon` (`drawIcon` in `src/view/render/icons.ts`) — whatever `setIcon` left on the
   template, attributes and children both, lands on every element served, so parity with
   Obsidian, the test mock and the harness renderer is by construction rather than by
   cases.
2. The tree's activation (`wireRowEvents`) and its native drag handlers
   (`DragDropController.wireTree`) are wired ONCE on the pane; an event resolves its row
   from `data-path` against the current model at event time. This also removes the
   stale-closure hazard, which is what any future row REUSE across data updates needs to
   be correct. Together the two cuts measured ~9–14% off a data update, a render and a
   tree or board switch at 832 rows — the interleaved A/B in
   [[The render is the whole cost of a data update]], which is also where the method and
   its honesty limits live.
3. A data update rebuilds the rows and touches no listener: the pane's set survives
   `treeEl.empty()`, and there is no per-row `dragend` — the document listener the view
   already registers hears every one, where the per-row copy ran each cleanup twice.

**Extensions**

- **1a — a name `setIcon` cannot resolve.** The template carries whatever `setIcon` left
  for it — the harness marks it `data-icon-missing` — and the copy carries the marker
  through, so an unresolvable icon stays as visible as it was with the direct call.
- **2a — the event began on the pane's own background.** No row resolves, so nothing is
  selected, folded or opened — not whichever row happened to be wired last.
- **2b — the event began on a control inside a row.** `fromRowControl` stands aside
  exactly as before; delegation moves where the question is asked, never what it asks.
- **2c — the row's path is not in the current model.** A stale element — the shape a row
  has after its note leaves the results — resolves to no item: nothing crashes, nothing
  writes, nothing opens.
- **2d — a native drag bubbles up from a card projection.** Cards are `.pbl-card`, and
  `.pbl-row` is the tree's alone, so the tree's handlers resolve nothing and pass it by.
- **2e — a drag starts on a row the render marked non-draggable.** Filtering and context
  rows set `draggable` false, and the delegated `dragstart` reads that back rather than
  restating the rule — the render's own statement stays the only one.

## Acceptance criteria

- The icon builder runs once per name and every served element matches what `setIcon`
  produces — `test/view/icons.test.ts`, watched failing with the cache removed.
- A click, auxclick, contextmenu, dragover or drop from the pane background or from a row
  the model does not hold does nothing — `test/view/opening.test.ts`,
  `test/view/dragDrop.test.ts`.
- Every existing activation, fold, menu and drag test passes unchanged — the suites are
  the parity check, since they drive the same events through the same rows.
- A dragleave over a row that never took the drop indicator leaves the live target's
  indicator alone.
- No assertion in this work measures elapsed time; the measurements live in
  [[The render is the whole cost of a data update]] and were read off the browser
  harness's `?perf` panel, not asserted anywhere.

## Where it lives

`src/view/render/icons.ts` · `src/view/render/rows.ts` ·
`src/view/interactions/dragDrop.ts` · `src/view/backlogView.ts` ·
`test/view/icons.test.ts` · `test/view/opening.test.ts` · `test/view/dragDrop.test.ts`
