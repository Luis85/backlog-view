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
- The undo slot (`lastUndo`) installs on the first EFFECTIVE inverse of a batch, not
  when the batch starts — so a no-op batch keeps the previous undo, and a batch that
  fails partway has installed exactly the applied prefix. `undoLast` replays through
  the same `runExclusively` gate minus the context-row check: authorization came at
  capture time (see the root context-row rule). The toolbar undo button re-enables to
  `canUndo()`, not to "idle" — which is why `syncBusy` takes it as a parameter rather
  than treating undo as one more `.pbl-write-ctl`. A replay that COMPLETED but
  restored nothing consumes the slot (its conflicts stay conflicted, its missing
  notes stay missing — the same dead batch must not be offered forever); a forward
  no-op keeps it. A replay that FAILED partway swaps the slot to its unfinished
  remainder, so the next undo finishes taking the change back — the restored prefix
  already installed its redo, and leaving that would make the next undo re-apply the
  prefix while the rest stays forward. The prefix's redo is the price; redo returns
  once an undo completes. The Ctrl/Cmd+Z chord is handled before the empty-model
  return in `handleTreeKeydown`: the change being undone may be exactly what emptied
  the tree.

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

- Row layout is columnar: `.pbl-row-spacer` is the flexible middle, and everything after
  it (`.pbl-props` → `.pbl-state-col` → `.pbl-meta-col`) is fixed-width, so values line
  up across rows regardless of title length and indent. Every configured column renders
  on every row — an empty property cell, a leaf's empty `.pbl-meta-col` — or the columns
  after it would shift per row. Widths live on the tree element as `--pbl-prop-col` /
  `--pbl-prop-count` (one set per render pass, inherited by targeted subtree refreshes),
  and `.pbl-cols` is the presentational (`aria-hidden`) header naming the columns; row
  cells carry the property name in their tooltip and `aria-label` instead of repeating
  it as visible text. The header is not a row: `renderTree` checks for a rendered
  `.pbl-row` before falling back to the empty states. Columns never shrink (a shrunk
  column no longer sits under its header), so a pane too narrow for them drops them
  whole: `columnFit` derives the threshold from the *configured* width and count — a
  fixed CSS breakpoint would clip two 280px columns in a 700px pane — and the view
  toggles `pbl-hide-props` / `pbl-hide-meta` / `pbl-hide-state` from a `ResizeObserver`
  (absent in jsdom, and `clientWidth` is 0 there, so tests stub it and call the render
  path). Two things make the measurement honest: it happens *after* the rows render, so
  the scrollbar that `overflow-y: auto` may have just added is already taking its width,
  and the observer watches the **tree**, whose content box shrinks when that scrollbar
  appears — the view's own box does not. A verdict that changes after a render triggers
  exactly one more pass (`refitting`), since the second pass measures the same tree.
  The indent term comes from `ctx.maxDepth`, an output of the render rather than a
  second walk of the model: the pass that drew the rows is the one that knows which
  rows are on screen. Everything the threshold counts has to be *bounded in CSS and summed here*:
  `ROW_LEAD_WIDTH` is written as its terms (padding, grip, chevron, capped badge, title
  min-width, the orphan and outside markers, spacer, add button) so it can be checked
  against `styles.css`, the badge carries a `max-width` for that reason, indent is added
  per rendered depth, and the tree's own padding is subtracted because `clientWidth`
  includes it while rows live in the content box. The numbers TS owns — the two column
  widths and the indent step — are *published* to CSS as custom properties by
  `renderTree`, the same way `--pbl-prop-col` already was, so the stylesheet reads them
  instead of repeating them. The terms that are Obsidian's (`--size-4-1` gaps, the tree
  padding) cannot be owned that way and stay as constants; a theme that redefines them
  moves the threshold by a few pixels, which is the accepted cost of not measuring. A term that grows without a bound, or
  one left out of the sum, comes back as a clipped row rather than a dropped column. The
  ladder ends at the state chip: below that only the row's lead is left, and the title
  truncates from there.
- Which properties become columns is resolved once per data update into `host.chips`
  (`chipProps`), and everything else reads that: the rows render it, and
  `tagsColumnVisible` is `chips.some((c) => c.tags)`. Deriving it twice is how the tag
  menu came to offer editing for a column `chipProps` had skipped.
- Tag editing follows the *column*, not the setting: `tagsColumnVisible` asks whether
  the tags property is one of the resolved columns, because the pills the user removes
  are the ones the column renders — a context menu that edited an invisible property
  would write things nothing on screen shows. That
  is a question about the Base's configuration, not about the pane: the responsive
  `pbl-hide-*` classes are a space decision, and no command is withheld for them (the
  state chip drops the same way and Set state stays). On a pane too narrow for the
  column the menu is the only way left to edit tags, and it shows the item's tags
  checked, so nothing is edited unseen.
  `applyWrites` drops `ItemWrite.tags` without a `tagsKey` (same rule as state). The
  write is a *delta* (`TagDelta`), never a computed list: a row's `tags` are a snapshot
  from the last refresh, so two removals before the refresh lands would both start from
  the same list and the second would put the first tag back. `applyTagDelta` therefore
  runs inside `processFrontMatter` against the live value, rewrites it as a YAML
  sequence, deletes the key when the last tag goes, and leaves the note untouched when
  the delta changes nothing. `observedTags` is result-only vocabulary, exactly like
  `observedStates`.
- The tree carries a focus ring only until a row takes it, and the switch is a class
  (`pbl-has-selection`, set beside `aria-activedescendant`) rather than `:has()`: a
  `:has()` selector on a container invalidates whenever its subtree changes, and this
  one rebuilds on every data update. Obsidian's plugin review flags `:has` for the same
  reason. State CSS depends on belongs on the element, put there where the state changes.
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
