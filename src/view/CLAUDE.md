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
  prefix while the rest stays forward. That stranded prefix redo is not lost either:
  `UndoRecovery` stashes it against the remainder and rejoins it when the retry
  completes, so redo re-applies the whole recovered batch and never only its tail —
  chained failures accumulate into the same stash, and a retry consumed whole by
  conflicts or missing notes leaves the carried redo AS the slot, since the prefix
  the failed attempt did restore is still the one coherently reversible thing.
  The Ctrl/Cmd+Z chord is handled
  before the empty-model return in `handleTreeKeydown`: the change being undone may
  be exactly what emptied the tree.

## What is rendered, and what is merely hidden

- The quick filter is ephemeral view state, owned by `filterState.ts` (the shape
  `collapseState.ts` already has): while active, `isCollapsed` reports false
  (everything on a match path renders expanded), rows are not draggable (visual
  neighbors are not real siblings), and `setFilter` re-renders the tree only so the
  toolbar input keeps focus. It keeps TWO sets — `visible` (a match plus its ancestors
  and its whole subtree) decides what renders, `matches` (the matches themselves)
  answers which of the things under a card the search actually found. One set cannot
  do both: everything in a match's subtree is visible and almost none of it matched.
- `isRowHidden` and `isRowHiddenUnfiltered` are one `hidden` method with a flag, so the
  narrowed board and the population its counts are measured against cannot disagree
  about what is in a column. **Lifting the filter is not the same as having no filter**:
  a running filter suspends the completed-items toggle, and the population has to keep
  that suspension, or a matched-but-otherwise-hidden card reads as "1 of 0" — each
  number defensible on its own, the pair nonsense. What "of" means is what this filter
  is choosing among.
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
- **The horizon chip is that same shape over the placement** (`renderHorizonChip`,
  beside the state chip in `render/columns.ts`): rendered on `hasHorizonAxis` — the one
  definition of a configured bucket axis, never a second opinion — static for a context
  row, and opening `showHorizonMenu`, which is `addHorizonItems`, which is what the row
  menu's Set horizon is. Two surfaces, one builder: they cannot offer different values
  or disagree about which is checked. A property with an interactive chip is skipped by
  `chipProps`, so the row never draws it twice with only one of them editable.
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
  it (`.pbl-props` → `.pbl-horizon-col` → `.pbl-state-col` → `.pbl-meta-col`) is
  fixed-width, so values line
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
  fixed CSS breakpoint would clip two 280px columns in a 700px pane — and
  `syncColumnFit` beside it applies the verdict, toggling `pbl-hide-props` /
  `pbl-hide-meta` / `pbl-hide-horizon` / `pbl-hide-state` — in that order of usefulness,
  the state chip surviving longest because it summarizes a row on its own. Every column a
  row can carry has to be in that budget: one drawn but not summed does not drop, it
  overflows. The two live in one file because a threshold
  computed in one place and applied in another is one edit from disagreeing; the view
  keeps only the policy of when to re-measure, driving it from a `ResizeObserver`
  (absent in jsdom, and `clientWidth` is 0 there, so tests stub it and call the render
  path). Two things make the measurement honest: it happens *after* the rows render, so
  the scrollbar that `overflow-y: auto` may have just added is already taking its width,
  and the observer watches the **tree**, whose content box shrinks when that scrollbar
  appears — the view's own box does not. A verdict that changes after a render triggers
  exactly one more pass (`refitting`), since the second pass measures the same tree.
  The indent term comes from `ctx.rows`, the index the render just filled rather than a
  second walk of the model: the pass that drew the rows is the one that knows which
  rows are on screen, and a collapse shrinks it in the same pass it happens in. Everything the threshold counts has to be *bounded in CSS and summed here*:
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

## The board projection

- One scroller, two projections: board mode reuses `.pbl-tree` with its role swapped to
  `listbox` and the keydown dispatched to `handleBoardKeydown`. The column-fit ladder
  (`pbl-hide-*`) is the tree's — entering board mode clears its stale verdicts, or a
  narrow-pane decision from tree mode would hide card cells.
- The mode is `host.projection` — `'tree' | 'board' | 'roadmap'` — backed by the
  collapse store (UI state, per saved view, per device) — never `settings` and never
  the `.base`: base settings are saved on the view, working position in localStorage.
  `setProjection` re-renders itself, because no config was set and no Bases refresh is
  coming; the roadmap-axis pick (`setAxisPick`) follows the same rule.
- `CardDragController` (in `interactions/cardDrag.ts`) is ONE controller for both card
  projections. It collects every adapter registration's cleanup and runs them at the top
  of each render pass: the projection is rebuilt wholesale, and pragmatic listeners left
  on detached elements would fire against a board that no longer exists. Its `dispose`
  also clears the live region, a shared singleton on `document.body`. `wireDropTarget`
  takes what a drop MEANS as a callback — a column writes a state, a bucket writes a
  horizon, the shelf removes one — so the controller resolves the dragged card and never
  decides a write. Every target wears one drop-over class (`pbl-drop-over`).
- The whole column is the drop target and the highlight is the only drop signal —
  within-column order is derived from the Base's sort, so there is no between-cards
  edge, no hitbox package, and deliberately no Alt+Up/Down rank shortcut.
- **One move, three inputs.** A drop, Alt+Left/Right and the card menu's Set state all
  call `performBoardMove`; none of them plans its own write. That is also the only
  place a move is announced (`announceBoardMove`, which lives in `cardDrag.ts`
  because that module owns the live region and cleans it up) — three callers
  announcing separately is how they come to say different things about one change.
  The roadmap's horizon move is the same rule, on `performHorizonMove`.
  The message names COLUMNS via `columnLabelFor`, never the raw value, so it says what
  is on screen: "No state" rather than a silence, and the yielded "Unset" rather than
  a name a real state has taken.
- The board's Set state offers `host.board`'s **rendered columns**, not a list rebuilt
  from the settings — that is what makes "every target a drag can reach, the menu can
  too" true by construction rather than by two lists agreeing. `stateMenuValues` alone
  cannot supply it: it returns only the configured states when a list is set, and
  knows nothing of no-state. The same builder skips the tree's move section on a card,
  because every entry in it is defined by a row's visible neighbours.
- Context cards are never wired as draggables, and `performBoardMove` still rides
  `applySafely`, whose outside-filter refusal is the structural backstop — the board
  block in `test/view/contextCardWrites.test.ts` drives both, and drives the keyboard
  and menu paths too: a keyboard can SELECT what a drag was never wired to pick up, so
  the refusal has to hold where the drag could not reach. The roadmap block beside it
  asks the same three questions. Column counts are result cards only; a context card is
  placement, not population.
- A filtered column header says "3 of 12" (`BoardColumn.fullCount`), and a card kept
  hiding a match below it names those matches on its face — whether or not the card
  itself matched, since a match under a matching card is a second result and one card
  cannot stand for two — `hiddenMatches` walks its
  subtree, stopping at anything already rendered so one match is never announced by two
  cards. It matters most under focus, where the only cards are the focus level's: a
  match three levels down would otherwise be found, counted in the rollup, and
  impossible to get to. The links are `tabindex="-1"` buttons like every other per-row
  control, so the card MENU carries the same matches — that is their keyboard path, the
  same answer the tree gives for the add button and the state chip, and without it the
  links would be pointer-only and the feature would fail at its own purpose. Each link
  stops both its click AND its `auxclick` from reaching the card beneath: a middle click
  never fires `click`, so stopping the primary one alone still opened the parent in a
  new tab.
- The board is one tab stop and its shortcuts are invisible, so it carries hidden
  instructions (`.pbl-sr-only`, attached with `aria-describedby`). The id is minted by
  `uniqueElementId` because that attribute resolves across the whole document and two
  boards can sit in split panes; the view drops the attribute on every render pass, so
  it can never outlive the element it names.
- The selection is ONE thing across projections: a row/card by path, or — board only —
  a column stop (`SelectionController`), because an empty column must stay reachable
  by keyboard. Anything that takes the card selection releases the column stop, and
  render passes re-point via `resyncAfterRender` — column stops are reapplied by the
  board render (they live on elements it just rebuilt), which runs BEFORE the resync,
  so the resync leaves a held column alone rather than stripping the active
  descendant it just set. Rendering the tree releases any held column stop: board
  state must not outlive the projection it points into.

## The roadmap projection

- The placement actions belong to the ITEM, not to the mode: `interactions/plan.ts`
  serves Set horizon, Schedule and Unschedule from the row menu in all three
  projections, because the projections share one model, one gate and one undo history
  and a property settable only inside roadmap mode would be a projection disagreeing
  about what the backlog can do.
- Those actions gate per axis on `hasHorizonAxis` / `hasDateAxis` — the same
  predicates `configuredAxes` is built from, so what the menu offers and what the
  roadmap draws cannot drift apart. A horizon property with an empty values list is
  UNCONFIGURED for both. Set horizon offers `horizonMenuValues` (declared ∪ observed
  on results) plus the item's own unlisted value — the union, not the state menu's
  either/or, because an undeclared horizon is a bucket the roadmap already draws. In
  roadmap mode the DRAWN buckets lead and the rest follow, the same reason the board's
  Set state reads its rendered columns: hiding can remove a value's first carrier, so
  the collected order and the minted order are not always the same, and the frame on
  screen is the one that can be checked. Membership never narrows with what is hidden.
  Removal actions (Clear horizon, Unschedule, an emptied field in the entry) appear
  only while the note CARRIES the key (`item.ownKeys`, presence not value), so no
  offered action can write nothing, and they delete the key rather than blanking it.
- On top of that, the HORIZON axis is directly manipulable and the dated axis is not,
  and the difference is structural rather than a flag: `renderRoadmap` passes the drag
  controller on only where a drop has a write behind it, so nothing on the timeline is
  draggable and the shelf there is not a target. A projection must not offer a gesture
  it cannot keep — moving a *bar* is scheduling's own feature, arriving with its plans.
- So on the horizon axis: a bucket and the shelf are drop targets, a result card is a
  drag source (a context card never is), and Alt+Left/Right steps one placement. All
  three land on `performHorizonMove`, and so does Set horizon while that axis is drawn
  (`chooseHorizon`) — which is the only path that announces, so a pick and a drop onto
  one bucket say the same sentence once. Off the roadmap there is no frame to announce
  into and the same planned write goes straight through the gate; `chooseState` splits
  on the board for the same reason.
- The Alt+arrow ladder leads with the SHELF, then the buckets as they render. The shelf
  is the roadmap's no-state column — where un-placing lives, and where an untriaged card
  enters the axis from, which is also where the specified lift arrives from the shelf
  (`docs/requirements/Keyboard and menu on the roadmap.md`). Edges hold rather than wrap
  — **except that the shelf edge is not an edge for a card that is drawn there without
  being on it.** An empty or unreadable key reads as absence, so such a card indexes at
  stop 0 while its note still holds something, and reaching the shelf is a real cleanup:
  the write the shelf drop and Clear horizon both plan for that same card. Holding the
  edge there left the keyboard unable to express a move its two siblings could, which is
  the "one move, three inputs" rule failing by omission rather than by disagreement —
  the harder kind to notice, since nothing produces a wrong write, one input just goes
  quiet. `offLadder` in `handleRoadmapMoveKey` is that case, and it uses the same
  presence-versus-value split `placementLabel` does.
- An EMPTY shelf still renders on the horizon axis, carrying `pbl-shelf-empty`: the DOM
  keeps it so a drop has somewhere to land, and the stylesheet keeps it out of the layout
  until a drag is live. A target that exists only while it is occupied is one nothing can
  ever reach. Whether it actually appears under a dragged card is a vault check.
- A roadmap card is the board's card: `createCard` / `renderCardBody` /
  `wireCardActivation` are exported from `render/board.ts` and shared, so an item
  cannot look different per projection. Timeline rows reuse the card SHELL (selection,
  context styling) with a row layout — `.pbl-card.pbl-timeline-row` overrides the
  card's column geometry in CSS.
- A bucket's New button runs the ordinary gated creation flow with the bucket's value as
  a `CreatePlacement`, written inside the same `createBacklogItem` call as the type and
  the rank. One write, so no note ever exists in a bucket its frontmatter does not claim.
  It is `tabindex="-1"` like the tree's `.pbl-add`: the pane is one tab stop and a bucket
  is not yet a keyboard stop of its own.
- The axis is resolved per render (`activeAxis(settings, axisPick)`), never stored
  resolved: the pick is retained in the collapse store even while its axis is
  unconfigured, so restoring the configuration restores the choice. The picker renders
  only in roadmap mode with BOTH axes configured — with one there is no choice to make.
- Roles are earned, not assumed: the pane is a `listbox` only while cards render
  (snapshot decided after the render pass), a labelled `region` otherwise — the
  board's no-workflow reasoning, applied to an empty frame. Keyboard is a linear walk
  of `roadmap.cards` (axis order, then shelf, then context) with both arrow pairs,
  Home/End, Enter to open, and the shared chrome keys; the 2D treegrid semantics come
  with the scheduling feature.
- `todayCivil()` is computed in the view and INJECTED into the domain: nothing under
  `domain/` reads a clock, which is what keeps every window and geometry test able to
  say which day today is. The timeline scrolls to today only while `scrollLeft` is 0 —
  a data update mid-session must not yank the view back to now.
- The board- and roadmap-mode CSS guards both clear the tree's stale `pbl-hide-*`
  verdicts; the fit ladder is the tree's alone.

## Lifecycle

- Anything an awaited write reports on has to be **captured before the await**. The
  Bases update that arrives mid-batch is deferred and then flushed in
  `runExclusively`'s `finally` — synchronously, before the awaited write resolves — so
  code reading view state after the await already sees the rebuilt model.
  `performBoardMove` takes both the state being left and the column vocabulary up
  front for that reason: afterwards the stray column the card just vacated may be gone
  with its last card, and naming the move from the new board reports a column the user
  never touched.
- A Bases view is handed its `app` **after** construction, so nothing in the
  `ProductBacklogView` constructor may read `this.app`. This has bitten twice — the
  collapse controller and the rename listener — and the jsdom tests catch it instantly,
  which is the argument for driving them through the real view. Register such things on
  the first data update instead (`watchRenames`).
