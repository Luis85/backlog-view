# Review findings — `claude/horizon-board-ui-bugs-yg4mya`

Ten-angle `/code-review` over the branch (shelf leads the horizon board; quick filter
removed; children section dropped from the horizon card menu). `tsc`, `eslint`,
`npm run docs` and every changed-area suite pass — nothing below is caught by a gate.

Three classes, in the order they must be worked:

1. **Layout** — three risks a gate cannot see. Needs `npm run harness` or a vault.
2. **Code** — two dead registers, one dangerous default, four weakened tests.
3. **Prose** — comments and register notes describing machinery this branch deleted.

Phases are ordered by file overlap, not by severity. Lanes inside a phase are
file-disjoint and can run in parallel; phases cannot.

---

## Phase 1 — layout (one lane; `roadmap.css`, `roadmap.ts` and `shelf.ts` all interact)

Verify each with `npm run harness` before and after. jsdom lays nothing out, so the
suite cannot see any of these.

- **`styles/roadmap.css:175`** — the new `.pbl-bucket { max-height: 100% }` is the cap
  that `.pbl-bucket-collapsed .pbl-bucket-header`'s own comment (25 lines below) says its
  `min-height: 0; overflow: hidden` pair was harmless only in the absence of. Fold a
  bucket with a long horizon name in a short pane: the rotated name clips at the band
  height and the count, which sits after it in the column, is what goes. Measured before
  this change: a 51-character name took the band 220px → 383px with the count in view.
  Fix the clipping, then rewrite that comment to whichever condition now holds.
- **`src/view/render/roadmap.ts:91`** — hoisting the shelf makes the drag-only empty
  shelf (`.pbl-dragging .pbl-shelf-empty { display: flex }`, `styles/shelf.css:28`) the
  FIRST band on a `height: 100%` frame. Horizon axis, everything placed: pressing and
  dragging a card inserts ~50px above the buckets and the whole board slides down under
  the pointer at dragstart. Previously the reveal appended below and moved nothing.
- **`src/view/render/shelf.ts:174`** — `.pbl-shelf` is now a scrollport
  (`max-height: 30%; overflow-y: auto`) with no drag auto-scroll. `renderShelf` wires a
  drop target at line 193 but never `dnd.wireScroller(shelfEl)`. Every other card
  container has one: `.pbl-bucket-cards` (roadmap.ts:392), `.pbl-board-col-cards`
  (board.ts:343), the timeline scroller (roadmap.ts:250). `roadmap.ts:102` wires `treeEl`,
  which scrolls the pane, not the shelf's own overflow. Horizon axis with ~40 unplaced
  items, hold a dragged card at the shelf's bottom edge: the cards below the fold cannot
  be reached. Pre-existing on the dated axis; new on horizons, the axis where the shelf is
  what you drag *from*.
- **`styles/roadmap.css:103`** — the advisory is capped at `max-height: 30%` and scrolls,
  but `renderRoadmapAdvisory` draws only when `population + shelf.length + context.length
  === 0`, while `.pbl-roadmap-buckets` keeps `flex: 1 1 auto; min-height: 220px`. On a
  553px pane the empty bucket band takes ~330px and the empty state — its prose, the ✨
  `runInit` CTA and the manual link — is clipped to ~165px with its own scrollbar. The
  shelf and context strip need the cap; the advisory, which only renders when there is no
  other content, does not.

While in the file, two duplications worth collapsing in the same pass:

- The horizon band rule restates `max-height: 30%; overflow-y: auto` already declared for
  the same three selectors by the dated-axis rule at `styles/roadmap.css:54-67`. Only
  `flex` differs (`0 0 auto` vs `0 1 auto`), which the comment itself says. The shared
  half belongs in the unconditional group at :120-122 — the earlier block's comment
  promises "a band added later declares a maximum too, and nobody has to remember this
  paragraph", which the copy makes false.
- `.pbl-bucket`'s `max-height: 100%` is the seventh declaration copied verbatim from
  `.pbl-board-col` (`styles/board.css:47`). `board.css` already groups the two wherever
  they agree (`.pbl-board-col-header, .pbl-bucket-header` and others); add `.pbl-bucket`
  there instead.

Also: `styles/cardChildren.css:65` — `.pbl-card-kids-toggle:disabled` is dead, nothing has
assigned `toggle.disabled` since the filter went. The `:not(:disabled)` qualifier at :54
is inert with it.

---

## Phase 2 — code semantics and tests (four parallel lanes, file-disjoint)

### Lane 2a — `src/domain/board.ts`, `test/domain/board.test.ts`, `test/domain/boardOpenWork.test.ts`

- **`:565` — `owned = visible` is now a default only tests take, and it defaults to the
  one value `owned` exists to prevent.** All three production callers (board.ts:184,
  board.ts:234, iterationBoard.ts:43) pass it explicitly and every one differs from
  `visible` — the whole point of `BoardColumn.held`, documented as the field that must NOT
  be measured through the visibility rule because the completed toggle lives in it. A
  fourth board projection that omits the argument gets `held === count`: its done column
  reports zero while full of finished work and the fold default stops firing in exactly
  the configuration it was written for — the Codex PR #140 defect, restored by a default.
  Drop the default and pass it at the four test sites, or default to `() => true` so the
  safe reading is the one you fall into.
- **`:697` — `emptyNoState`'s `col.count === 0` conjunct is vacuous.** It was
  `col.fullCount === 0`, a genuinely independent reading; `count` is now a reduce over
  `cards` (:664), so `cards.length === 0` forces it. The paragraph explaining the term
  was deleted, the term was not, and it reads as a second guarantee it no longer gives.
- **`:681` — three population-vs-matches invariants lost their tests.** `openWork`'s doc
  still promises it is "Measured over the column's POPULATION rather than off `cards`"
  while `tallyColumns` gates it on the same `visible` that BUILDS `cards`; its
  distinguishing test ("reads the POPULATION, so a filter that hid the open card cannot
  say the column is finished") is gone, as is `overBy`'s "counts the overage from the FULL
  population, never the matches". Decide whether the population reading is still wanted.
  If yes, restore a field not derived from `cards` and the tests under it; if no, narrow
  every doc to what the code now measures. Do not leave the docs wider than the code.

### Lane 2b — `src/view/childrenList.ts`, `src/view/interactions/menu.ts`, `src/view/interactions/plan.ts`, `src/view/projection.ts`

- **`childrenList.ts:111` — the `horizonBoardShowing` guard in `menuChildren` is
  unreachable.** Its only caller, `addChildrenSection` (menu.ts:410), returns on the same
  predicate at :410 before reaching :425. The justification recorded for duplicating it —
  that `matchesFor` subtracts this list from the match walk — was deleted by 88e03e8 with
  `matchesFor` itself. Keep the gate at the one place that decides, drop the other.
- **`childrenList.ts:94` — `horizonBoardShowing` is a copy, and its comment presents the
  copy as the shared answer.** `interactions/plan.ts:87` spells
  `host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'horizons'` inline and
  can legally import the helper; `interactions/labels.ts:119` carries the `'resources'`
  twin. When that read needs a term — a stale snapshot across a projection switch is the
  hazard the comment itself names — one call site gets it and the other does not, and the
  card menu and the move router disagree about which board is on screen.
  Consider the deeper place: `view/projection.ts` is where the guide says a projection is
  asked what it IS, so a `menusListChildren(projection, axis)` beside `treeShaped` and
  `hidesCompleted` states the rule the feature wants ("a projection declares whether its
  card menus list children") rather than an identity test the next axis has to edit.

### Lane 2c — test instruments (`test/helpers/cssVars.ts`, `test/view/{roadmapBoxing,timelineBoxing,shelfSearch,horizonMenu,toolbar}.test.ts`)

- **`horizonMenu.test.ts:65` and `:81` — vacuous-pass risk on the only tests covering the
  feature this branch added.** The hand-rolled
  `Array.from(containerEl.querySelectorAll('.pbl-shelf .pbl-card')).find(el => el.dataset.path === '…')`
  returns `undefined` on a miss, `menuTitles(undefined)` returns `[]`, and every
  `expect(titles).not.toContain('Show children')` then passes for the wrong reason.
  `cardByTitle` (`test/helpers/board.ts:25`) throws instead; `test/helpers/roadmap.ts` has
  `shelfOf` for the scoping.
- **`toolbar.test.ts:515` — "keeps the tree interactive while a batch is in flight" no
  longer renders anything.** Rewritten from `setFilter` (which re-rendered the content
  pane mid-batch, the test's whole subject) to `setCollapsed`, which is
  `this.state.set(this.collapseKey(path), collapsed)` — a bit in the view-state store, no
  render. `collapsedMidBatch` now reports the pre-batch DOM. Restore a mid-batch read that
  actually re-renders.
- **The CSS rule-body parse is hand-rolled four times.** `bodyOf` in
  `roadmapBoxing.test.ts:5` is a verbatim copy of `timelineBoxing.test.ts:8`;
  `horizonBands()` at :67 re-rolls it for a multi-selector rule in the same new file;
  `shelfSearch.test.ts:366` inlines a fourth that slices from the selector rather than the
  `{`, so any assertion whose needle can appear in a selector gets a false positive.
  `test/helpers/cssVars.ts` is the established home and already documents
  `timelineBoxing.test.ts` as a caller. Teach one `bodyOf` the comma-list case and delete
  the other three. `horizonBands()` also holds `expect(at).toBeGreaterThan(-1)` inside the
  helper, so a selector rename fails with no test name attached.

### Lane 2d — coverage deleted with the filter (`test/view/{legend,keyboard,visibility}.test.ts`, lane context row)

Each of these lost its only test to a filter-motivated deletion, and each covers behaviour
that survived the filter. Write the test, watch it fail against a reverted fix, restore.

- **Lane context row activation.** `test/view/roadmapMatches.test.ts` was deleted whole,
  taking `describe('the lane context row those links sit on')` — one case driving the
  arrow walk onto `.pbl-lane-context` and pressing Enter, one clicking it. That is the
  regression check for `docs/bugs/A lane context row could not be reached.md`, which names
  the file under `files:` and in prose at line 71. Survivors cover contextmenu, existence
  and drops only. Simplify `drawnCards` (`lanes.ts:433`) back to a bars-only walk, or drop
  `renderLaneContextRow`'s `wireCardActivation`, and the reported bug returns green.
- **Legend refresh on a content-only render, removal direction.**
  `legend.test.ts:439`'s describe pinned a swatch DISAPPEARING when the last bar keying it
  leaves the grid. What survives (`:161`) asserts only that a swatch STAYS, which is
  equally true of a legend that never refreshes. Content-only renders are still plentiful:
  `setShelfCollapsed`, `setShelfSort`, `setShelfHiddenTypes`, `setShelfSearch`.
- **`keyboard.ts:173` — expand-to-first-visible-child.** The branch is live and reachable
  with no filter at all: `showCompleted: false` hides a finished first child exactly as
  the filter did, and the comment beside it still says so. `keyboard.test.ts:190` uses an
  all-visible fixture; `visibility.test.ts:107` a row whose children are ALL hidden, where
  the branch is a no-op. Change the `find` to `children[0]` today and ArrowRight selects an
  off-screen row — `aria-activedescendant` pointing at a missing element — with nothing
  failing.

---

## Phase 3 — dead registers (two lanes; must follow Phase 1, both touch `roadmap.ts`/`shelf.ts`)

### Lane 3a — `PlacedMount` → `Set<string>`

`src/view/host.ts:179`. The type lost `listsChildren` and `face` on this branch; `item`
and `mount` are set at six sites (roadmap.ts:384, shelf.ts:271 and :330, lanes.ts:444 and
:890, timeline.ts:616) and read at none. The map's only consumer is `childrenList.ts:82`,
`new Set(roadmap.placed.keys())` — paths alone. `RoadmapSnapshot.placed` outlives the
frame on the host, so a detached DOM subtree is retained per drawn row for a value nothing
reads, and `cardedPaths` copies the whole register on every card-menu open. Collapse
`RowContext.placed` to `Set<string>` and `RoadmapSnapshot.placed` to `ReadonlySet<string>`;
delete the interface, its comment, and the imports in `render/columns.ts`.

The registration itself stays load-bearing — `cardedPaths` feeds `menuChildren`'s
subtraction, so a marker drawn and not registered makes its parent bar's menu offer
`Open child` for a note already on the grid (`docs/bugs/Milestones in one row on the dated
axis.md`). Do not delete the `ctx.placed.set` calls; only change what they store.

### Lane 3b — `carded`, `VisibilityRule`, `disclosureButton`

- **`src/view/render/board.ts:82` and `:153`** — `ColumnRenderCtx.carded` is write-only
  since `renderCardMatches` was deleted, but `cardPaths(drawn)` still flatMaps every card
  in every column into a discarded Set on every board render — every `onDataUpdated`
  flush, projection switch, column fold and card-move refresh, on all three board-shaped
  projections. Delete the field, the call and the import; `ColumnRenderCtx` drops to
  `{ dnd, opts }`. Fallow cannot see it: it scores exports, and this is an assigned
  interface field.
- **`src/view/rowVisibility.ts:57`** — with the filter term gone, the interface + factory +
  predicate triple has one construction site (`backlogView.ts:299`) consumed in the same
  expression; nothing holds a `VisibilityRule` and the `member` default is never taken.
  `settings` is carried only to feed `hidingCompleted(rule.settings)` at :73, derivable at
  build time. The two-field split lets `hideCompleted: true` sit beside settings that hide
  nothing — the "two things that must agree" shape this file's own comment argues against.
- **`src/view/render/rows.ts:222`** — `disclosureButton` lost its `disabled` argument and
  is now a nine-line wrapper with one caller (:199) around a single `createEl`, behind a
  three-field object parameter for two strings. Inline it.

---

## Phase 4 — prose (fully parallel by file; must run last, after the code settles)

Every one of these describes machinery this branch deleted. The repo's own rule: a
confident paragraph is evidence of intent and of nothing else. Where a rule is still real,
rewrite it to the surviving mechanism rather than deleting it.

**Start here — the one with a live consequence:**

- **`src/view/render/afterContent.ts:16-17`** — "Every path that redraws CONTENT calls it
  — not only a full render. A filter re-renders the content alone, and it can change every
  one of these: the count becomes '3 of 18'…" is the *only* stated reason `syncAfterContent`
  runs on content-only paths, and its sole example is the deleted filter. The paths it
  still protects are all shelf-side. A reader trimming dead filter references removes the
  call and the count label, collapse controls, legend and toolbar fit stop refreshing on
  every one of them — with Lane 2d's legend coverage already gone.

**Source comments:**

- `src/view/interactions/columnMenu.ts:54` — `addFoldItem`'s whole opening paragraph
  describes a `disabled: host.isFiltering()` flag that `renderChevron` no longer passes and
  a host method that no longer exists. The two-surfaces-must-agree rule it records is real
  and this pair came apart twice already (PR #140) — restate it against what exists.
- `src/view/render/timeline.ts:614` — truncated mid-clause ("It lists no children on its")
  and names `face`, deleted from `PlacedMount`.
- `src/view/render/lanes.ts:885` and `:428` — the marker-diamond and lane-context-row
  registrations justified entirely through `face` and `nameMatches`, both deleted, while
  the registration stays load-bearing (see Lane 3a).
- `src/view/interactions/keyboard.ts:389` — `horizonStops`' doc is now inverted: it argues
  the ladder deliberately does NOT follow reading order, on the axis where the shelf-leads
  change made the two agree. It is the whole stated reason the shelf is stop 0, so a
  contributor reconciling it may reorder the ladder — which per the same paragraph makes
  Alt+Right un-place finished triage. Also `:338`, `:197`, `:315` and `:9` still promise
  "`/` reaches the filter"; `handleFilterKey` is now `handleEscape`.
- `src/view/host.ts:186` and `:192` — `RoadmapSnapshot`'s doc still states the old
  "axis first, then the shelf" order that the keyboard walk reads. Put the order on the
  `cards` field and have both render branches cite it.
- `src/view/host.ts:423` — `shelfSearch` grounds its session-state rule in `FilterState`,
  deleted.
- `src/view/viewStateController.ts:84` — `setBoardScope` still promises the
  `recomputeFilter` rebuild removed from its body, while sibling `setProjection` had the
  same comment deleted; the two now disagree about whether the hook exists.
- `src/view/interactions/menu.ts:58` and `:381` — `renderMatchCount` and `matchesFor`,
  both deleted.
- `src/domain/roadmap.ts:392` and `:399` — describe the quick filter as a live term of
  `visible`; `rowVisibility` lost it entirely.
- `src/view/render/toolbarFit.ts:101` and `:115` — names `.pbl-filter-reveal`, and keeps a
  six-line "Not taken" paragraph reasoning about the filter input's position. `:44`'s
  `LAST_STEP` rung list names the filter icon.
- `src/view/render/shelfControls.ts:280` — justifies the new clear button by "what the
  toolbar's own filter says with a class", present tense, about a box withdrawn here.
- `src/view/render/cardChildren.ts:64` — `isRowHidden` "conflates it with the completed
  toggle and the quick filter".
- `src/view/render/board.ts:308` — the strip comment still argues about "a filter that hid
  every stateless card".
- `styles/index.css:35` — the load-bearing import-order note gives three reasons and two
  were deleted; the survivor (`.pbl-overflow-btn`) is decided by specificity at any order,
  so the position may not be load-bearing at all. Verify before trusting or deleting.

**Register and layer guide:**

- `src/view/CLAUDE.md` — `:561` still lists the deleted `filterScopeFor` among
  `view/projection.ts`'s exports (and its list of files holding bare `projection ===`
  comparisons is now short one: `childrenList.ts`); `:963` states `face: 'none'` as a live
  rule 24 lines after `:939` correctly records it deleted; `:587` says `setProjection`
  recomputes the filter index; `:421`'s two-tab-stop rule names "both clear buttons" when
  one was deleted and the survivor is the shelf's `tabindex="-1"` header button in the
  other zone; `:658` is mangled — "over the POPULATION with the quick the completed toggle
  carried"; `:893` cites `FilterState`; `:950` claims chip-yield declarations are "still
  pinned in `test/view/timelineBoxing.test.ts`" after the block was removed; `:988-992`
  justifies the double gate through `Open match`.
- `CHANGELOG.md` — `:61` says the shelf "renders above the buckets", `:77` says it "stays
  on screen at the bottom". Both ship: `scripts/changelog-notes.mjs` puts `[Unreleased]`
  straight into the release body (ADR 0025). `:77` was written for the pre-hoist fix.
- `docs/tasks/Drop the children section from the horizon board's card menu.md:67` — its
  `## Checks` names `test/view/roadmapMatches.test.ts`, deleted by the next commit, and
  claims it asserts an `Open match` entry this branch removed. Its
  `## Where the gate lives, and why it is two gates` section rests on `matchesFor`.
  Rewrite to the surviving reason once Lane 2b settles which gate stays.
- `docs/tests/suites/Smoke test the tree.md:37` — lists `[[Tree quick filter and Show
  completed items]]` as a live release-cadence case. That note plus
  `docs/tests/cases/Board card carrying hidden matches.md` and `Board columns and the
  filtered header.md` are all `status: Open`, `cadence: release`, and describe typing in a
  toolbar filter box and reading a "3 of 12" header. `docs/tests/` is a living folder;
  `docs-check.mjs` passes them because they cite no `src/` path.
- `docs/tests/suites/Smoke test the roadmap.md:60` — the item this branch ADDS says "the
  shelf stays on screen at the foot", which this branch changed.
- `test/harness/harness.test.ts:436` — `describe('the page can open a dialog and run a
  filter by URL')` now contains only dialog cases.
- `test/view/toolbarFit.test.ts:179-244` — seven orphaned doc comments whose `it()` bodies
  were deleted, stacked with no test between them, describing `revealFilter`,
  `syncFilterUi`, `renderFilterBox`, `setFilter`, `focusFilter`, `pbl-filter-open` and
  `pbl-filter-active`. One states a still-live rule (a control that changes the row's width
  without a render must call `syncToolbarFit` itself) using only the withdrawn control as
  its example — keep the rule, re-example it. Same at `test/view/opening.test.ts:70-74`.
