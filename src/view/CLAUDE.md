# view/ — DOM and interaction

Rendering, drag and drop, keyboard, menus, and the write gate. Reaches `domain/` and
`storage/`; modules reach view state only through `BacklogViewHost`, and `host.ts` stays
free of runtime code so imports stay cycle-free.

## Cost

- Rendering cost is the scaling limit (a few hundred rows is a normal backlog), so:
  expand/collapse calls `host.refreshSubtree(item)` — which re-renders that row's child
  group in place — never `host.render()`; the view keeps a path → row element index
  (`rowEls`) plus the selected row, so no interaction scans the DOM; and per-render
  config lookups (`getOrder`, `getDisplayName`) live on `RowContext`, not in the per-row
  path. `refreshRowChildren` must prune the subtree it removes from `rowEls`, and
  anything captured at wire time (drag handlers) must read expansion state live, because
  a targeted refresh leaves surrounding rows in place. Data updates still rebuild
  everything — skipping that needs to account for arbitrary chip property values.
- A batch write is one refresh, not one per file. Every file `applyWrites` touches
  comes back as its own `onDataUpdated`, so mid-batch the view would rebuild the model
  and every row hundreds of times, each pass rendering a half-applied tree. While
  `applying`, `onDataUpdated` only records `pendingDataUpdate`; `applySafely` flushes it
  through `refreshFromData` in its `finally`, so a failed batch refreshes too — the
  writes before the failure are on disk and the tree has to show them. Nothing about
  interaction pauses: each write awaits, so scrolling, filtering and selection keep
  working against the (briefly stale) model.
- `applyWrites` reports progress per file and the view publishes it with `syncBusy`,
  which touches text and flags only — never structure. Re-rendering the toolbar per
  tick would reintroduce exactly the jank the deferral removes. The indicator is
  rendered always and hidden in CSS, with an animation delay so a single-file write
  never flashes it.

## What is rendered, and what is merely hidden

- The quick filter is ephemeral view state: while active, `isCollapsed` reports false
  (everything on a match path renders expanded), rows are not draggable (visual
  neighbors are not real siblings), and `setFilter` re-renders the tree only so the
  toolbar input keeps focus.
- "Show completed items" hides only fully-done subtrees (`subtreeDone`) and only at
  render level (`isRowHidden`): the model, rollups and ALL order math keep using full
  sibling lists — hidden siblings still get renumber writes. The quick filter
  suspends hiding. Structure ops and the move menu target the nearest *visible*
  neighbor (`visibleNeighbor`) so no command is visually inert; a parent whose
  children all hide renders as a leaf (chevron and aria-expanded follow visible
  children, not `children.length`).
- A context row is visible only while it is placing a visible result: `isRowHidden` hides
  one whose children have all gone, whatever hid them, so a done subtree can't leave an
  empty scaffold behind.
- State editing: the chip/menu UI renders only when `stateKey` is configured, and
  `applyWrites` drops `ItemWrite.state` without a stateKey (never write to an empty
  key). Menu values = `stateMenuValues` (configured list, else observed ∪ a done
  value) plus the item's own unlisted value, so the current state can always render
  checked.
- The tree opens collapsed for a parent nobody has ruled on — `collapseNewParents`
  collapses each one the first time it is seen, tracked in `settled` so a data update
  never undoes what the user expanded, and a restored session is not re-collapsed by the
  very pass meant to honour it. An explicit `setCollapsed` also settles the path, so a
  row expanded to reveal a drop or a new child is not collapsed again by the refresh that
  follows the write — a childless row is not a "parent" until that write lands, so
  nothing else would have settled it. View tests start from the collapsed tree, so
  `makeView` expands through the real toolbar control unless a test opts in with
  `{ collapsed: true }`.

## Controls

- Row layout is columnar: `.pbl-chips` is the flexible middle, and `.pbl-state-col` /
  `.pbl-meta-col` are fixed-width trailing columns so the state chip and the rollup line
  up across rows regardless of title length and indent. Both columns render on every row
  whenever their feature is configured — a leaf without a rollup still gets the empty
  `.pbl-meta-col`, or the columns after it would shift per row.
- Two tab-stop zones, and a control's element type follows from which one it is in.
  The **toolbar** is ordinary UI: every activatable control is a real `<button>`
  (`iconButton`, both clear buttons), so Tab reaches all of them. The **tree** is one
  stop — arrows move the selection — so its per-row controls (`.pbl-add`, the state
  chip) are buttons with `tabindex="-1"`: activatable by assistive tech, invisible to
  Tab, with the context menu as the documented keyboard path. A `div` with an
  `aria-label` and a click handler is the thing to avoid in either zone.
- Any menu opened from a `<button>` goes through `showMenuForClick`. Enter or Space
  synthesizes a click at (0, 0), and `showAtMouseEvent` would drop the menu in the
  viewport corner; the helper falls back to the button's own rect. This shipped as a bug
  once, so it is now a lint rule: `showAtMouseEvent` is banned everywhere except
  `interactions/menu.ts`, where the anchoring decision is made.
- Once a control is focusable, disabling it in CSS is a lie — `pointer-events: none`
  stops a mouse and nothing else. The collapse controls pause while the quick filter
  overrides collapse state, so they carry a real `disabled` flag, set in
  `syncFilterUi` because a filter change re-renders only the tree and leaves the
  toolbar's DOM in place.

## Lifecycle

- A Bases view is handed its `app` **after** construction, so nothing in the
  `ProductBacklogView` constructor may read `this.app`. This has bitten twice — the
  collapse controller and the rename listener — and the jsdom tests catch it instantly,
  which is the argument for driving them through the real view. Register such things on
  the first data update instead (`watchRenames`).
