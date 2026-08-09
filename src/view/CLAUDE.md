# view/ — DOM and interaction

Rendering, drag and drop, keyboard, menus, and the write gate. Reaches `domain/` and
`storage/`; modules reach view state only through `BacklogViewHost`, and `host.ts` stays
free of runtime code so imports stay cycle-free.

## Cost

- Rendering cost is the scaling limit (a few hundred rows is a normal backlog), so:
  expand/collapse calls `host.refreshSubtree(item)` — which re-renders that row's child
  group in place — never `host.render()`; the view keeps a path → row element index
  (`rowEls`) plus the selected row, so rows are reached by lookup rather than by
  searching for them — a `treeEl.querySelector`/`querySelectorAll` naming the receiver,
  dotted (`this.els.treeEl`), bare or computed (`els['treeEl']`), fails lint
  (`no-restricted-syntax`, the receiver is the ban), an aliased one
  (`const el = this.els.treeEl; el.querySelectorAll(...)`) is caught only if it is on a
  path the spy in `test/view/renderCost.test.ts` drives — selection, subtree refresh and
  drag cleanup. That spy is a regression guard for the paths that exist; the lint rule is
  the statement of the invariant, because it holds for paths not yet written. And the
  per-render config lookups (`getOrder`, `getDisplayName`) are resolved once per data
  update by `resolveColumns` onto `host.columns`, which `RowContext` carries as a snapshot,
  never in the per-row path. `refreshRowChildren` must prune the subtree it removes
  from `rowEls`, and anything captured at wire time (drag handlers) must read expansion
  state live, because a targeted refresh leaves surrounding rows in place. Data updates
  still rebuild everything — skipping that needs to account for arbitrary chip property
  values.
- The write gate is `writeGate.ts`, not the view: `WriteGate` holds `applying`, the undo
  slot, `recovery`, the deferred update and the busy state — five fields serving one
  concern, of which only `busy` was ever read from outside it — and the view owns one,
  delegates `applySafely`, `canUndo` and `undoLast` to it, and publishes its progress
  through `syncBusyUi`. The gate touches none of the view's ELEMENTS (Notices are its
  own; the toolbar and the tree are the view's, reached through the two hooks it is
  constructed with) and reads view state through `BacklogViewHost` like every other
  module.
- A batch write is one refresh, not one per file. Every file `applyWrites` touches
  comes back as its own `onDataUpdated`, so mid-batch the view would rebuild the model
  and every row hundreds of times, each pass rendering a half-applied tree. While
  `applying`, `onDataUpdated` only records the update (`gate.deferUpdate()`); the gate
  flushes it through `refreshFromData` in `runExclusively`'s `finally`, so a failed batch
  refreshes too — the writes before the failure are on disk and the tree has to show
  them. Nothing about interaction pauses: each write awaits, so scrolling, filtering and
  selection keep working against the (briefly stale) model.
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
- **Set risk is the state menu's shape without a projection**: rendered inside
  `buildItemMenu`'s `editable` guard on `hasRiskLevels` — a property AND a levels list, so
  a submenu never opens onto nothing — offering the declared list plus the item's own
  unlisted value, checked from `computeRiskWrites` rather than from a comparison beside it,
  with a `Clear risk` foot gated on `item.ownKeys.risk`. It lives in `interactions/menu.ts`
  beside Set state rather than in `interactions/plan.ts`: risk is an attribute of the item,
  not a position on an axis. Two inputs now — the menu and the chip below — and still no
  `performRiskMove`, because the second input does not plan beside the first: it opens the
  same builder. The rule is about a second PLAN, not a second surface.
- **The risk chip is the state chip a third time** (`renderRiskChip`, beside the other two
  in `render/columns.ts`), on `hasRiskLevels` — the same pair Set risk is gated on, so a
  chip whose menu could set nothing is not a state either side can reach alone — opening
  `addRiskItems` through `showRiskMenu`, and drawn as the risk property's OWN cell like the
  other two, so the row never draws the value twice with one of them inert. It differs from
  the horizon's in one place: an unjudged note draws a dashed *Risk* chip rather than
  nothing, because absence here is an invitation and not a placement the shelf already
  names. Its column drops where the properties menu put it, like every other column.
- **The four per-row menus are one function**: `chipMenu` in `interactions/menu.ts`, with
  `showStateMenu` / `showHorizonMenu` / `showRiskMenu` / `showTagMenu` as one-line exports
  over it. It is what stops a control from also activating the row it sits on — the reason
  every one of them was five identical lines before.
- **The horizon chip is that same shape over the placement** (`renderHorizonChip`,
  beside the state chip in `render/columns.ts`): rendered on `hasHorizonAxis` — the one
  definition of a configured bucket axis, never a second opinion — static for a context
  row, and opening `showHorizonMenu`, which is `addHorizonItems`, which is what the row
  menu's Set horizon is. Two surfaces, one builder: they cannot offer different values
  or disagree about which is checked. The chip IS that property's cell (`renderCell`
  dispatches on the column's kind), so the row never draws it twice with only one of them
  editable.
- The tree opens collapsed for a parent nobody has ruled on — `collapseNewParents`
  collapses each one the first time it is seen, in BOTH scopes from that one pass (it runs
  on a data update, not per projection, so the scope off screen would otherwise be
  unsettled and open a whole backlog the first time it was shown), tracked in `settled` so a data update
  never undoes what the user expanded, and a restored session is not re-collapsed by the
  very pass meant to honour it. An explicit `setCollapsed` also settles the path, so a
  row expanded to reveal a drop or a new child is not collapsed again by the refresh that
  follows the write — a childless row is not a "parent" until that write lands, so
  nothing else would have settled it. View tests start from the collapsed tree, so
  `makeView` expands through the real toolbar control unless a test opts in with
  `{ collapsed: true }`.

## Controls

- Row layout is columnar: `.pbl-row-spacer` is the flexible middle, and everything after
  it (`.pbl-props`, one `.pbl-prop` cell per drawn column, then `.pbl-meta-col`) is
  fixed-width, so values line
  up across rows regardless of title length and indent. Every column the pass DRAWS
  renders on every row — an empty property cell, a leaf's empty `.pbl-meta-col` — or the
  columns after it would shift per row. Drawn, not configured: a column the pane cannot
  hold is on no row at all, which is the difference the fit below turns on. **That holds for the whole end-anchored strip, not only
  for the columns**: the add button is last in it, and a row that can hold nothing
  withholds the control but reserves its width (`renderAddSpacer`, which the header uses
  for the same reason), because an element skipped from an end-anchored strip does not
  leave a gap where it was — everything before it slides into its width. Widths live on the tree element as `--pbl-prop-col` /
  `--pbl-prop-count` (one set per render pass, inherited by targeted subtree refreshes),
  and `.pbl-cols` is the presentational (`aria-hidden`) header naming the columns; row
  cells carry the property name in their tooltip and `aria-label` instead of repeating
  it as visible text. The header is not a row: `renderTree` checks for a rendered
  `.pbl-row` before falling back to the empty states. Columns never shrink (a shrunk
  column no longer sits under its header), so a pane too narrow for them drops them
  whole: `columnFit` derives the threshold from the *configured* width and count — a
  fixed CSS breakpoint would clip two 280px columns in a 700px pane — and
  `syncColumnFit` beside it applies the verdict, which is a COUNT plus one bit for the
  rollup (`host.columnFit`, stored as ONE object so the rows and the header cannot end up
  describing different frames) rather than a ladder of classes: columns
  drop from the END of the properties menu's order,
  because that order is the user's own statement of what matters and a ranking of ours
  beside it would be a second opinion about it. **A dropped column is not rendered**, and
  that is the accessibility half of the decision rather than an implementation detail:
  clipping it in CSS would leave its cell in the accessibility tree — a Bases value can
  render a native control, and the chips are `tabindex="-1"` buttons assistive tech
  reaches by design — so focusing one would scroll the strip out from under its header.
  The rollup is the one exception and keeps a class (`pbl-hide-meta`) for the ROWS,
  because it is not in that order at all: pinned past its end, so "last" would always pick
  it first, it goes after every column instead. **The header asks about it anyway**
  (`columnFit.rollupDropped`), and that is the distinction to keep: configured is not
  drawn, and a header built from the configuration alone was a sticky bordered bar holding
  a spacer, an empty box and a label the stylesheet hides — the whole point of the bar is
  the labels, so with none left it is not rendered. So the rollup is one concept behind
  two mechanisms: the rows get a class, the header gets the verdict. That is a recorded
  cost rather than an oversight — it cannot disagree visibly (`rollupDropped` implies no
  columns implies no header) and `display: none` keeps the hidden box out of the
  accessibility tree — and the two ways out of it are in
  `docs/issues/The rollup is hidden by class and headed by verdict.md`. Every column a
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
  one left out of the sum, comes back as a clipped row rather than a dropped column. It
  ends at the rollup: below that only the row's lead is left, and the title truncates
  from there. `columnFit` measures `ctx.host.columns` — what EXISTS — and never
  `ctx.columns`, which is the slice the last verdict produced: measuring that would
  ratchet the count down and never let a column come back when the pane widens.
- Which properties become columns is resolved once per data update into `host.columns`
  (`resolveColumns`), and everything else reads that: the rows render it, and
  `tagsColumnVisible` is `columns.some((c) => c.kind === 'tags')`. Deriving it twice is how
  the tag menu came to offer editing for a column the renderer had skipped.
- Tag editing follows the *column*, not the setting: `tagsColumnVisible` asks whether
  the tags property is one of the resolved columns, because the pills the user removes
  are the ones the column renders — a context menu that edited an invisible property
  would write things nothing on screen shows. That
  is a question about the Base's configuration, not about the pane: narrowing is a space
  decision — the pane draws fewer of the resolved columns (`host.columnFit`) and the
  rollup keeps its class — and no command is withheld for it (the state chip's column
  drops the same way and Set state stays). On a pane too narrow for the
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
- **A row's activation asks whether the event began on the ROW, not on a control it
  contains** — `fromRowControl` in `render/rows.ts`, asked by both wirings
  (`wireRowEvents` for the tree, `wireCardActivation` for cards and timeline rows). It
  replaced ten per-control `stopPropagation` calls, and the reason is the failure they
  produced twice: opting out was the control's job to remember, and the dependency
  connector and the bar grips both forgot, shipping handles that opened the note. Moving
  the question to the receiver covers a control that forgets. `ROW_CONTROL` is `button`
  plus three documented non-buttons (the tree's div chevron, `.pbl-bar-grip`, and a
  property cell's `.pbl-prop-value` / `.pbl-tag`), which is what keeps it a rule rather
  than a list of remembered places: the tab-stop rule below already requires every new
  per-row control to be a real `<button>`, so one written tomorrow is covered without
  editing the selector. `auxclick` asks separately because a middle click never fires
  `click` — the reason every one of those per-control guards came in pairs.
- Two tab-stop zones, and a control's element type follows from which one it is in.
  The **toolbar** is ordinary UI: every activatable control is a real `<button>`
  (`iconButton`, both clear buttons), so Tab reaches all of them. The **tree** is one
  stop — arrows move the selection — so its per-row controls (`.pbl-add`, the state
  chip) are buttons with `tabindex="-1"`: activatable by assistive tech, invisible to
  Tab, with the context menu as the documented keyboard path. A `div` with an
  `aria-label` and a click handler is the thing to avoid in either zone.
- **One control inside a composite pane is a real tab stop, and it is chrome rather
  than content**: the dated axis's lead-resize grip (`renderLeadResize` in
  `interactions/timelineLeadResize.ts`), a `role="separator"` with `tabindex="0"`
  mounted in the timeline header. What earns it is that it cannot compete with the
  roving selection the pane owns — it is fixed to the grid's own geometry, it never
  renders among the cards, and `handleRoadmapKeydown` returns on any event whose target
  is not the pane itself (`evt.target !== evt.currentTarget`), so the grip's arrow keys
  stay the grip's. The per-row answer does not fit it either: a continuous "hold the
  arrow key" resize has no menu to be the keyboard path.
  The **ARIA cost is real and unresolved.** While cards render the pane is a `listbox`
  (`render/projections.ts`), so the grip is a focusable non-`option` inside it, which
  the composite pattern does not sanction. It is a known, accepted deviation rather
  than a clean case: the alternatives were a pointer-only grip, which this plugin
  cannot ship because it is not desktop-only, or no resize at all. What is checked is
  narrower than the claim — `test/view/timelineLeadResize.test.ts` asserts what the
  grip ANNOUNCES (`role`, `aria-orientation`, the three `aria-value*`, the real tab
  stop), that its own arrow keys resize, and the guard itself at the forbidden thing:
  an ArrowDown, a key the grip does not claim and so lets bubble, dispatched at the
  focused grip moves no card selection. What nothing here can say is how a screen
  reader reads a separator in that position. That one is a live-vault item in
  `docs/requirements/Smoke test the roadmap.md`.
- **An SVG node's `cls` is an ARRAY, never a space-separated string**, and that is a lint
  rule (`no-restricted-syntax`) rather than a habit. `addClass` lives on `HTMLElement`, so
  Obsidian hands `createSvg`'s `cls` straight to `classList.add`, which rejects a token
  containing spaces. It shipped: every conflicting dependency edge threw
  `InvalidCharacterError` in a vault, and because the throw aborted `renderTimeline`
  before `renderRoadmap` reached `wireTimelineDrag`, the grid never registered its drop
  target — bars picked up and had nowhere to land, so a conflict looked like it locked
  the timeline. Neither the suite nor the browser harness could see it, because both run
  on `test/helpers/dom.ts` and its `createSvg` split the string; that file is faithful
  now, so a DRIVEN path fails a test, and the lint rule is the statement for a path
  nothing drives yet.
- Any menu opened from a `<button>` goes through `showMenuForClick`. Enter or Space
  synthesizes a click at (0, 0), and `showAtMouseEvent` would drop the menu in the
  viewport corner; the helper falls back to the button's own rect. This shipped as a bug
  once, so it is now a lint rule: `showAtMouseEvent` is banned everywhere except
  `interactions/menu.ts`, where the anchoring decision is made.
- Once a control is focusable, disabling it in CSS is a lie — `pointer-events: none`
  stops a mouse and nothing else. The collapse controls pause while the quick filter
  overrides collapse state, and go disabled on a card projection that drew no
  disclosure to collapse — both carry a real `disabled` flag, and `syncCollapseCtls`
  (`render/toolbar.ts`) is their only writer today, called after the content render
  beside `syncCountLabel` so it reads the frame that just drew rather than the one
  before it. Nothing enforces "only" mechanically — a lint rule for it was considered
  and declined — so the guarantee is a fact about this code, not a checked invariant;
  the click handler on `.pbl-collapse-ctl` (and the card disclosure's own toggle) READS
  the flag to guard against a click that lands on a child element and bubbles past
  `disabled`, which does not reopen the split `syncFilterUi` once caused, since a
  reader cannot disagree with the writer about what the value is.
- **The toolbar is zones, and only one of them belongs to the projection.** The primary
  action leads and the switcher follows it — both `.pbl-btn-group`, one shared segmented
  box, because in each of them two or more buttons are one control. Then
  `renderProjectionZone` draws whatever this projection owns and *nothing* when it
  owns none — the zone and its leading separator are created together and removed
  together, decided from what was drawn rather than from a second reading of the settings
  — then the spacer, then the `⋯`, then the controls that are the same in every
  projection, then the readouts. Adding a projection is adding a case to that switch; a
  control added anywhere else in the row is a claim that it belongs to every projection.
  **Two positions in that order are load-bearing and the rest are taste.** New is first
  because the row CLIPS from the right past the last rung, so leading it is what makes
  "nothing costs the primary action its place" true by arrangement rather than by a rung
  order no arrangement of rungs could deliver. The `⋯` is directly after the spacer for
  the same reason read once more: it is the only route to every shed control, so it must
  be the last thing the clip reaches, not the first — which is what it was when it sat
  beside undo.
- **Two questions to ask of anything added to the toolbar.** *Does it change the row's
  width without a render behind it?* Then it calls `syncToolbarFit` itself —
  `renderTreeContent`'s own call at its end covers a full render and a content-only one
  alike, and four paths call it separately because nothing routes through that render at
  all: revealing or collapsing the filter, the busy indicator appearing or going, a pane
  resize, and a theme or font change (`css-change`, because the ladder measures rendered
  text and nothing else notices one changing). *Must it survive `barEl.empty()`?* Then it
  lives on the toolbar element, not inside it — `data-pbl-fit` and `pbl-filter-open` both
  do, while `pbl-filter-active` may stay on the box because `renderFilterBox` re-derives
  it from the input's value. The two interact, which is the failure worth remembering:
  state lost on a rebuild hid a control, and the focus mechanism then restored focus to
  something invisible, silently.
- **The row never wraps, and what it sheds it does not withhold.** `syncToolbarFit`
  (`render/toolbarFit.ts`) measures the rendered row and writes a step as `data-pbl-fit`;
  `styles/toolbarFit.css` says what each step drops. It MEASURES where `columnFit` sums,
  because a control's width is its translated label and nothing owns that. Anything that
  changes a control's own width re-runs it, not only a resize — revealing the collapsed
  filter is a ~130px change with no render behind it, which is why the `:focus` width
  growth the input used to have was deleted rather than accommodated. Every control a
  step drops is in the `⋯`, and each entry is disabled exactly when the button it
  duplicates is, read off that button's `disabled` property: `syncCollapseCtls` and
  `syncBusy` own that flag, and a condition re-derived in the menu would be a second
  opinion about it.

## The board projection

- One scroller, two projections: board mode reuses `.pbl-tree` with its role swapped to
  `listbox` and the keydown dispatched to `handleBoardKeydown`. The column fit is the
  tree's — entering board mode resets the verdict to null and clears `pbl-hide-meta`, or a
  narrow-pane decision from tree mode would strip cells off cards.
- The mode is `host.projection` — `'tree' | 'board' | 'roadmap'` — backed by the
  collapse store (UI state, per saved view, per device) — never `settings` and never
  the `.base`: base settings are saved on the view, working position in localStorage.
  `setProjection` re-renders itself, because no config was set and no Bases refresh is
  coming; the roadmap-axis pick (`setAxisPick`) follows the same rule. **The focus
  level is that rule with one extra consequence**: it is stored the same way
  (`setFocusLevel`), but it re-roots the MODEL rather than only the render, so it
  rebuilds through `refreshFromData` and the restore has to run BEFORE that build —
  which is why `refreshFromData` restores first and reads `focusLevel` off the store
  onto the settings it just resolved. Everything downstream still reads it as
  `settings.focusLevel`; the `.base` is simply no longer where it comes from.
- `CardDragController` (in `interactions/cardDrag.ts`) is ONE controller for both card
  projections. It collects every adapter registration's cleanup and runs them at the top
  of each render pass: the projection is rebuilt wholesale, and pragmatic listeners left
  on detached elements would fire against a board that no longer exists. Its `dispose`
  also clears the live region, a shared singleton on `document.body`. `wireDropTarget`
  takes what a drop MEANS as a callback — a column writes a state, a bucket writes a
  horizon, the shelf removes one — so the controller resolves the dragged card and never
  decides a write. Every target wears one drop-over class (`pbl-drop-over`).
  **A payload names its note by the `TFile`, never by a path string**, and `resolve` is
  the one place that matters because every drag — board, bucket, shelf, link — comes
  through it. One field answers both questions a mid-drag refresh raises, because a
  rename mutates the file in place while a deletion does not: `file.path` is therefore
  always the CURRENT path and is the lookup key, and the file itself is then compared to
  what that lookup returned. Both halves are load-bearing and they fail oppositely — a
  path captured at drag start cancels a valid drop the moment the note is renamed, and a
  lookup trusted without the comparison accepts a delete-and-recreate under the same name
  and writes to a note nobody picked up. Same fact `src/storage/CLAUDE.md` leans on for
  the dependency undo, used here for the other direction.
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
  links would be pointer-only and the feature would fail at its own purpose. They need
  no guard of their own against the card beneath — see the row-activation filter below.
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
- Schedule and the removal actions on the dated axis gate on `canSchedule` /
  `placementEnds` (`interactions/plan.ts`), not on `hasDateAxis`: a milestone answers
  `['target']` rather than both ends, and the two predicates agree for ordinary work and
  diverge exactly where a milestone's only writable end is the target — offering the
  entry there on `hasDateAxis` alone would open it onto a field list narrowed to nothing.
- The dated axis draws a milestone as a line down the whole grid (`renderMilestoneLines`
  in `render/timeline.ts`), one per DATE rather than per item so two milestones sharing a
  day still read as one mark, behind the bars and under the today line — which keeps its
  pixel and its place on top, the milestone's line stepping aside inside the same day
  cell instead of either being suppressed. The line is decoration only: nothing about it
  is focusable or written, so the milestone's own row carries the name and the exact
  dates together in its accessible name, which is where a fact the line shows must also
  be reachable without it.
- Both axes are directly manipulable now, but not the same way. The horizon axis's
  buckets and shelf are ordinary drop TARGETS — the board's rule, a region highlights
  and the highlight is the whole signal. The dated axis has no lanes, so a row carries
  no meaning of its own; `renderRoadmap` wires its grid as ONE positional target
  instead (`interactions/timelineDrag.ts`, registered through `CardDragController`
  like every other target), where only the pointer's X says anything and `dayAt` turns
  it into a date. Two sources reach it: a shelf card, gated by `canSchedule` (a marker
  with no writable end offers no grip at all), and a bar already placed — its body
  slides by the gesture's delta rather than a position, its end grips resize one end —
  both onto the grid alone. The dated axis's shelf is a drop TARGET too, the mirror of
  the grid: a bar's BODY hold dropped there un-schedules it (`removal.plan` in
  `render/roadmap.ts`, planning `unschedulePlan`), while a grip is refused (a resize is
  not an unschedule) and so is a shelf card dropped back on itself (it may still carry
  keys its shelving reason is asking to be fixed, not removed). A drop on that shelf
  always means something now, on both axes, so an EMPTY dated-axis shelf stays in the
  DOM exactly as the horizon axis's always has.
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
- The shelf's own header carries its controls — a disclosure, a sort pick, a type
  filter — and they follow the per-row control rule exactly: `tabindex="-1"` buttons
  opening a `Menu`, never form controls, with the card menu's shelf section as the
  keyboard path (`addShelfSection`). One builder feeds both surfaces. The one case a
  menu cannot cover is an all-shelved, collapsed roadmap, where no card renders and so
  no card menu opens: there the pane is a `region` rather than a composite, and
  `syncShelfTabStops` puts EVERY header control back in the tab order, decided from the
  same final card count the role is. Every one, not the disclosure alone — hiding the
  last visible type empties the pane by itself, and rescuing only the disclosure leaves
  the filter that caused it unreachable. Using any of them rebuilds the pane and destroys
  the button pressed, so `refocus` puts focus back — on the PANE where cards remain, on
  the control's replacement where none do. Not interchangeable: the pane's key handler
  ignores any event whose target is not the pane itself, so focusing a `tabindex="-1"`
  control inside a composite silently kills the arrows while looking correct.
- A roadmap card is the board's card: `createCard` / `renderCardBody` /
  `wireCardActivation` are exported from `render/board.ts` and shared, so an item
  cannot look different per projection. Timeline rows reuse the card SHELL (selection,
  context styling) with a row layout — `.pbl-card.pbl-timeline-row` overrides the
  card's column geometry in CSS.
- **A timeline row's chevron folds ROWS, and a card's disclosure lists children on its
  face; they are two bits, two host method pairs, and one register (2026-08-09).** A row
  goes through `isCollapsed`/`setCollapsed`, and `collapseKey` is the ONE place that
  decides which bit those land on: the dated axis keys under `TIMELINE_SCOPE`, everything
  else under the path. A card's own disclosure never reaches `collapseKey` — it goes
  through the second pair, `isCardCollapsed`/`setCardCollapsed`, always under `CARD_SCOPE`
  regardless of projection ([[Children on the card]]), so the shelf and context cards
  drawn beside the grid keep their disclosure with the ITEM rather than with the screen —
  the opposite of the row's own rule, and deliberately so: folding a bar's subtree is a
  statement about the plan, and a card's own disclosure is a statement about the note,
  which [[Collapsing a bar's subtree]] used to conflate for exactly the cards drawn on
  that axis. The one caller left choosing between the two pairs is `addChildrenSection`
  in `interactions/menu.ts`, which serves a card's Show/Hide children and a bar row's from
  one function and tells them apart by asking `host.roadmap`'s own `bars` whether the path
  it is menuing is a drawn bar — every other caller is wired to one pair and never asks.
  The quick filter still overrides whichever is being asked. The register is
  `RowContext.cardKids` — "what drew a disclosure this pass", never "which projection is
  this" — which is what makes the toolbar's bulk controls and the row menu's section serve
  both without either asking what it is looking at.
  **Which element says "expanded" is decided by the ROW's role, not by preference**: a
  `treeitem` carries `aria-expanded` itself, so the tree's chevron is a plain div, while
  a card row is `role="option"` — which does not support that state — so the timeline's
  is a real `tabindex="-1"` button carrying it, the card disclosure's own answer to the
  same problem, and `button.pbl-chevron` in `styles/tree.css` strips the Obsidian chrome
  that arrives with it. `renderChevron` takes a label exactly to make that choice. **The
  button is the better placement and not a settled one**: `option` also has
  presentational children, so a user agent may flatten it and drop the role and state
  with it. What holds either way is the row's content-derived NAME — which the label
  joins and flips — and the row menu's identical entry as the action's path. Claim that
  and no more; the two redesigns that would settle it are in
  `docs/issues/A disclosure nested in an option role.md`. And because that toggle
  rebuilds the projection, the shelf controls' focus rule applies to it too: the pressed
  button is gone with the frame, so `renderChevron` reports whether it HELD focus and the
  caller puts focus on the PANE — never on the replacement control, which would look
  right and silently kill the arrow keys.
  `domain/bars.ts`'s `timelineRows` decides which rows survive and which keep a chevron,
  and it is asked of the bars derived BEFORE any were hidden: computed from what is
  left, a collapsed row would have no children to have and would lose the very control
  that reopens it. Unlike the tree's, this toggle takes the whole `render()` — the
  window, the gridlines and every full-height mark are derived from the row set it
  changes.
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
  say which day today is. The timeline centres on today only when the drawn content
  CHANGES — `anchorScrollLeft`'s `same` test, comparing `drawnContent` against the
  previous `ScrollAnchor.content` — never on a same-content refresh, whatever
  `scrollLeft` happens to be: a data update mid-session must not yank the view back to
  now.
- The board- and roadmap-mode CSS guards both keep the tree's stale `pbl-hide-meta` off a
  card's rollup; the columns need no such guard, because a card projection resets the
  verdict rather than carrying a class. The fit is the tree's alone either way.

## Lifecycle

- Anything an awaited write reports on has to be **captured before the await**. The
  Bases update that arrives mid-batch is deferred and then flushed in
  `runExclusively`'s `finally` — synchronously, before the awaited write resolves — so
  code reading view state after the await already sees the rebuilt model.
  `performBoardMove` takes both the state being left and the column vocabulary up
  front for that reason: afterwards the stray column the card just vacated may be gone
  with its last card, and naming the move from the new board reports a column the user
  never touched.
- A view announces itself to `registry.ts` while it is loaded (constructor in,
  `onunload` out) because a palette command has no view: a Bases view is drawn *inside*
  a leaf's file view rather than being one, so `getActiveViewOfType` cannot find it.
  Which live view is active is answered by the workspace, and by the **leaf** rather
  than its file: `getActiveViewOfType(FileView)` gives the active leaf, and the view it
  contains is the one to act on. One base open in two split panes is two views with two
  configurations and one path, so a file-path match picks whichever was constructed
  last — and a "most recent" flag is worse still, going stale pointing at a base the
  user has closed.
  Registration is announcement only: it may not read `this.app`, for the reason below.
- A Bases view is handed its `app` **after** construction, so nothing in the
  `ProductBacklogView` constructor may read `this.app`. This has bitten twice — the
  collapse controller and the rename listener — and the jsdom tests catch it instantly,
  which is the argument for driving them through the real view. Register such things on
  the first data update instead (`watchApp`).
