# Product Backlog — agent guide

Obsidian plugin registering a custom **Bases view** (`product-backlog`): a drag-and-drop
work-item tree (Epic → Feature → PBI → Task) over notes in a flat folder, driven by
`parent`/`order`/`type` frontmatter. Requires Obsidian 1.10.2+ (Bases custom view API).

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow static analysis
```

All four must pass before committing; CI runs the same steps. Coverage thresholds
(vitest.config.ts) only ever go up. Fallow (config: .fallowrc.json) gates dead code,
duplication, complexity/CRAP (fed by the vitest coverage file) and dependency hygiene —
framework-invoked members (`BasesView.type`, suggest callbacks) are declared in
`usedClassMembers`, not suppressed inline. Obsidian itself cannot run here — the jsdom
test harness below is the substitute; say so honestly when a change still needs a
live-vault smoke test.

## Architecture (one file per concern, 400-line max enforced by lint)

| File | Responsibility | Testable |
| --- | --- | --- |
| `src/main.ts` | Registers the view via `registerBasesView` | — |
| `src/settings.ts` | View options schema, config resolution, `configProblems` validation | node tests |
| `src/model.ts` | Pure tree building: parent links, cycles, sorting, effective levels, focus re-rooting, rollups | node tests |
| `src/folderNotes.ts` | Folder-note inference — the same ancestor walk over loaded items and over the vault | node tests |
| `src/ops.ts` | ALL frontmatter writes: drop plans, ranking, backfill, note creation | node tests |
| `src/dropTargets.ts` | Pure drop-target math (zones, no-op/cycle/stale-link rules) | node tests |
| `src/host.ts` | `BacklogViewHost` — the interface modules use to reach view state | — |
| `src/view.ts` | The BasesView subclass: state, lifecycle, selection, write gate | jsdom tests |
| `src/render/toolbar.ts`, `src/render/rows.ts` | DOM rendering: toolbar, and the tree/row lead | jsdom tests |
| `src/render/columns.ts` | `RowContext` (per-pass row index + hoisted config lookups), the column header and every trailing column: property cells, tags, state chip, rollup | jsdom tests |
| `src/interactions/dragDrop.ts` | Transient drag state, indicators, hover-expand, root strip | jsdom tests |
| `src/interactions/keyboard.ts` | Tree keyboard navigation + shortcuts | jsdom tests |
| `src/interactions/menu.ts` | Context menu | jsdom tests |
| `src/interactions/structure.ts` | Move/indent/outdent/backfill operations | jsdom + node |
| `src/interactions/create.ts` | New-item flow (config-gated) + folder inference | jsdom tests |
| `src/interactions/tags.ts` | Tag vocabulary, normalization and the add/remove writes | jsdom tests |
| `src/modal.ts` | New-item and folder prompts (+ folder suggest) | jsdom tests |
| `src/scaffold.ts` | "Create backlog" command: folder + configured .base file | jsdom tests |

Rules: never write frontmatter outside `src/ops.ts` (`applyWrites` / `createBacklogItem`),
and every write path — including creation — goes through the `configProblems` gate.
Modules reach view state only through `BacklogViewHost`; keep `host.ts` free of runtime
code so imports stay cycle-free.

## Testing

- `test/obsidian-mock.ts` — runtime stand-in for the `obsidian` module (aliased in
  `vitest.config.ts`). Extend it when new obsidian API surface is used; keep it minimal.
- `test/dom-helpers.ts` — installs Obsidian's DOM prototype extensions (`createEl`,
  `addClass`, `setCssProps`, …) for jsdom files. Call `installObsidianDom()` at module top.
- `test/helpers.ts` — `FakeVault` (metadata cache, vault, `processFrontMatter`, workspace
  recorder) and `FakeViewConfig` (records `set()` calls). Assert writes via
  `vault.fm(path)` / `vault.writeLog`; assert navigation via `vault.opened`.
- View tests (`test/view.test.ts`) drive REAL interactions: dispatch `dragstart`/
  `dragover`/`drop` (stub `getBoundingClientRect` for drop zones — jsdom returns zeros),
  `keydown`, `click`, `contextmenu` (grab the menu via `Menu.lastShown`). Async writes
  need `await flush()`.
- Known harness limits: `FakeVault` caches are static — after a write, assert frontmatter
  rather than re-rendering; `entry.getValue()` returns null, so property chips render
  empty in tests.

## Invariants that bite

- Config property ids are `note.`-prefixed (`note.parent`); frontmatter keys are not.
  `resolveSettings` strips the prefix.
- `depth` is VISUAL only (focus mode re-roots it). Level math must use
  `effectiveLevelIndex`, which chains down the parent levels and carries unknown
  custom types through the ladder (see `childLevelIndex`). Never derive levels
  from depth.
- The autoType cascade retypes only descendants whose type matches a configured
  level; custom types outside the ladder are deliberate user data.
- Scope (`settings.hierarchyOnly`, on by default): a base filtered by folder returns
  every note living there, so `pruneOutsideHierarchy` drops the ones that are not work
  items — a note belongs when it has a *supported* type (matching a configured level) or
  a parent (explicit, empty-marker, folder-inferred, or unresolvable). The test runs per
  root subtree, so one participant keeps the whole component (untyped children, untyped
  containers of typed items). Pruned notes leave `model.byPath`/`items` entirely, so
  backfill and rollups never see them; `model.ignoredCount` carries the number for the
  toolbar advisory and the empty state. Turning the option off restores "every note is
  an item" — the fixture opt-out (`unscoped`) in the tests.
- Focus mode: the top row is a synthetic grouping — `focusRoot` items keep their real
  `parent` pointer, and reordering/outdent/indent across that row must stay disabled.
- `model.roots` is the RENDERED forest (synthetic under focus); every data operation
  (backfill, ranking parentless items, root-level outdent) must use `model.realRoots`.
- The quick filter is ephemeral view state: while active, `isCollapsed` reports false
  (everything on a match path renders expanded), rows are not draggable (visual
  neighbors are not real siblings), and `setFilter` re-renders the tree only so the
  toolbar input keeps focus.
- Tag editing follows the *column*, not the setting: `tagsColumnVisible` requires
  `tagsKey` to be configured AND that property to be one of the Base's visible ones,
  because the pills the user removes are the ones the column renders — a context menu
  that edited an invisible property would write things nothing on screen shows.
  `applyWrites` drops `ItemWrite.tags` without a `tagsKey` (same rule as state), an
  empty list deletes the key rather than writing `[]`, and the list is always rewritten
  as a YAML sequence even when the note held one space-separated string. `observedTags`
  is result-only vocabulary, exactly like `observedStates`.
- State editing: the chip/menu UI renders only when `stateKey` is configured, and
  `applyWrites` drops `ItemWrite.state` without a stateKey (never write to an empty
  key). Menu values = `stateMenuValues` (configured list, else observed ∪ a done
  value) plus the item's own unlisted value, so the current state can always render
  checked.
- "Show completed items" hides only fully-done subtrees (`subtreeDone`) and only at
  render level (`isRowHidden`): the model, rollups and ALL order math keep using full
  sibling lists — hidden siblings still get renumber writes. The quick filter
  suspends hiding. Structure ops and the move menu target the nearest *visible*
  neighbor (`visibleNeighbor`) so no command is visually inert; a parent whose
  children all hide renders as a leaf (chevron and aria-expanded follow visible
  children, not `children.length`).
- Outside-filter ancestors (`settings.showOutsideParents`, on by default): the Bases query
  returns matches without their parents, which would flatten the tree, so `loadOutsideParents`
  walks each item's parent chain through the *metadata cache* and adds the missing notes with
  `entry: null` and `outsideFilter: true`. They are context, not results: no Bases row (so no
  property chips), not draggable, excluded from every ranking path (`siblingPosition`,
  `siblingContext`, `outdent`, the move menu) because their real siblings were never loaded,
  and skipped by `computeInitWrites`. They ARE valid drop parents and can take new children.
  Their rollups describe the visible subtree only. `entry` is nullable for exactly this
  reason — anything reading `item.entry` must handle null. The seed for the walk is
  `outsideParentSeed`, which mirrors `linkParents`' precedence (explicit link, else the
  nearest folder note *in the vault* when `folderHierarchy` is on) — seeding from explicit
  links alone leaves filtered folder hierarchies flat, since inference only ever looks in
  `byPath`.
- One rule covers the whole context-row feature, and every past bug in it was a place
  that forgot the rule rather than a new rule: **an `outsideFilter` row is never a write
  target, never a ranking peer, and never a source of anything derived from the Base's
  results** (counts, level breakdown, state vocabulary, creation folder). It renders, it
  parents, and that is all. "Never a ranking peer" means never written to and never
  renumbered — its `order` is still *read* (`afterHighestKnown`, `endOfSiblingsOrder`,
  the backfill's max-order scan), because the row is on screen and a rank that ignored
  it would place an item above something the user can see. Ask that question of any new code touching the tree; the
  "write safety with context rows, across every entry point" test in `view.test.ts`
  drives every interaction against a fixture with context rows above, beside and between
  results, so a new write path fails it without anyone predicting the surface.
- "Derived from the results" includes numbers computed *while walking the tree*, not just
  code that reads a model collection: `assignAll` traverses **through** a context row to
  the results below it but never counts it, so a rollup reports what the Base returned and
  an excluded note's own state can neither skew a progress bar nor keep a finished subtree
  on screen. Two invariant tests in `view.test.ts` state this from the rule rather than
  the implementation — one for writes, one for rollups.
- `model.results` is the Base's own rows and `model.items` is everything rendered.
  Anything answering "what is in this base" takes `results`; only rendering, navigation
  and collapse state take `items`.
- A context row is visible only while it is placing a visible result: `isRowHidden` hides
  one whose children have all gone, whatever hid them, so a done subtree can't leave an
  empty scaffold behind.
- An `outsideFilter` row is NOT always an ancestor: a filter that returns an Epic and its
  PBI but not the Feature between them loads that Feature as context *below* a result, so
  any subtree walk can meet one. The autoType cascade therefore stops at such a row and
  skips its whole branch — retyping only the levels below it would half-update the ladder.
- The view NEVER writes to a note the Base excluded — enforced structurally in
  `applySafely`, which refuses the WHOLE batch (loudly) if any write targets an
  `outsideFilter` item, so a new write path cannot reopen the hole by omission. It rejects
  rather than filters: dropping the offending write alone would apply the rest and leave
  the hierarchy half-updated. The UI withholds every control that would
  produce one: the state chip renders as a static `.pbl-state-static` div (and not at all
  when unset), and the context menu drops Set type, Set state and the parent-link actions.
  `New <child>` stays — it writes a *different* note — but it must not land that note
  outside the filter either: `inferFolder` counts only result rows, and folder mode's
  "children go beside the parent's folder note" rule is skipped for a context parent
  (the explicit parent link keeps the hierarchy right wherever it lands).
  `observedStates` likewise skips them: an excluded parent's state is not this base's
  vocabulary and must not become assignable to results.
- Renumbering rewrites a whole sibling
  group, so `computeDropWrites` refuses that path when the group holds an `outsideFilter`
  row and places the item after the highest known order instead (`afterHighestKnown`) —
  the single choke point that makes the invariant hold. Because that fallback lands the
  item last, the *positional* operations refuse such a group up front instead of landing
  somewhere other than aimed: `siblingPosition` (before/after drops), `canReorder` (the
  move menu, Alt+arrow) and `outdentTarget`. Appends — dropping *into* a parent, the
  top-level strip, indent — stay available, since last is what they mean anyway. Gate each
  command on what it actually does: `canReorder` covers only the four move commands, while
  Indent follows its neighbour and Outdent answers for its own destination — gating those
  on `canReorder` too would make the menu offer less than Alt+arrow already allows.
- `outsideParentSeed` is resolved for every item even when `showOutsideParents` is off: it
  is also the evidence (`item.parentExists`) that a note is anchored in the hierarchy.
  Without it `hierarchyOnly` prunes a folder-inferred Base result whose folder note simply
  wasn't loaded — dropping a row the query explicitly returned. Only the *loading* of the
  ancestors is gated by the option.
- Known limitation, not specific to context rows: in a filtered base any parent whose
  children are partly excluded has a partial `children` list, so `insidePosition` +
  `computeInsertOrder` can compute an order that duplicates an excluded sibling's. Equal
  orders fall back to `entryIndex` and the group self-corrects on the next renumbering
  drop. Fixing it properly needs the complete child set (backlinks + folder scan), which
  `computeDropWrites` cannot reach without giving up its purity.
- `breakCycles` re-roots `cycleEntry(item)`, the node that actually closes the loop, not the
  first unreachable item found: with outside-filter ancestors the unreachable item is usually
  a healthy match hanging below a cycle, and re-rooting it would strand a valid parent link.
- Orphans (`parent === null && hasParentValue`): never backfill their type; dropping them
  at top level MUST clear the stale link (`clearsStaleLink`), even position-unchanged.
- Folder mode (`settings.folderHierarchy`): explicit links beat folder-note inference;
  parent-clearing writes `parent: ''` (`explicitRoot`) instead of deleting the key,
  because a deleted key re-infers on the next build. Files are never moved on disk.
  `ItemWrite.removeParentKey` is the deliberate opposite: delete the key to hand the
  item back to folder inference ("Use folder position", "Clear parent link").
- `applyWrites` is serialized but not transactional: a mid-batch failure leaves the
  earlier writes applied (orders self-correct on the next renumbering drop).
- Orders are sibling-scoped fractional ranks; when a gap `< MIN_GAP` the whole sibling
  group renumbers. Missing orders sort last, in Bases result order (`entryIndex`) —
  `data.data` arrives presorted by the user's Bases sort config, so never re-sort it.
- Parent links are written as `[[wikilinks]]` via `fileToLinktext` regardless of the
  user's link-format setting (markdown links are not parsed in frontmatter).
- Writes go through `applySafely`: serialized (`applying` flag), blocked when
  `configProblems` is non-empty.

## Gotchas

- `obsidian` npm typings may trail the app; feature-detect newer API (`setSubmenu`,
  `isEmpty`) instead of hard-importing it.
- Marketplace rules (enforced by `npm run lint` + review): sentence-case UI text, no
  special characters in the manifest description, `setCssProps` over inline styles,
  `normalizePath` on user paths, no global `app`.
- Release tags must equal `manifest.json` version with NO `v` prefix — `.npmrc` sets
  `tag-version-prefix=""`; the release workflow rejects mismatches. See `RELEASING.md`.
- Collapse state is session-only and is NEVER written to the `.base` file: a path per
  collapsed row is exactly the growth the file should not take, and the Bases API hands
  a view no reference to its own file, so there is nowhere else to key it either
  (`data.json` would need one map per base). The tree therefore opens collapsed —
  `collapseNewParents` collapses each parent the first time it is seen, tracked in
  `defaultedPaths` so a data update never undoes what the user expanded, and prunes
  paths that leave the model so a long-lived view does not hold every path it ever saw.
  An explicit `setCollapsed` also marks the path defaulted, so a row expanded to
  reveal a drop or a new child is not collapsed again by the refresh that follows the
  write — a childless row is not a "parent" until that write lands, so nothing else
  would have settled it. `dropLegacyCollapsedConfig` clears the key older versions wrote. View tests start
  from the collapsed tree, so `makeView` expands through the real toolbar control
  unless a test opts in with `{ collapsed: true }`.
- Rendering cost is the scaling limit (a few hundred rows is a normal backlog), so:
  expand/collapse calls `host.refreshSubtree(item)` — which re-renders that row's child
  group in place — never `host.render()`; the view keeps a path → row element index
  (`rowEls`) plus the selected row, so no interaction scans the DOM; and per-render
  config lookups (`getOrder`, `getDisplayName`) live on `RowContext`, not in the per-row
  path. `refreshRowChildren` must prune the subtree it removes from `rowEls`, and
  anything captured at wire time (drag handlers) must read expansion state live, because
  a targeted refresh leaves surrounding rows in place. Data updates still rebuild
  everything — skipping that needs to account for arbitrary chip property values.
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
  toggles `pbl-hide-props` / `pbl-hide-meta` from a `ResizeObserver` (absent in jsdom,
  and `clientWidth` is 0 there, so tests stub it and call the render path).
- `tagsKey` is the one property option whose default is a real key, so `resolveSettings`
  tells "never set" from "cleared" (`clearablePropKey`): without that the option could
  not be turned off, since `getAsPropertyId` reports both as null.
