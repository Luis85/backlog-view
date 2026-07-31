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
| `src/ops.ts` | ALL frontmatter writes: drop plans, ranking, backfill, note creation | node tests |
| `src/dropTargets.ts` | Pure drop-target math (zones, no-op/cycle/stale-link rules) | node tests |
| `src/host.ts` | `BacklogViewHost` — the interface modules use to reach view state | — |
| `src/view.ts` | The BasesView subclass: state, lifecycle, selection, write gate | jsdom tests |
| `src/render/toolbar.ts`, `src/render/rows.ts` | DOM rendering (`RowContext` carries the per-pass row index and hoisted config lookups) | jsdom tests |
| `src/interactions/dragDrop.ts` | Transient drag state, indicators, hover-expand, root strip | jsdom tests |
| `src/interactions/keyboard.ts` | Tree keyboard navigation + shortcuts | jsdom tests |
| `src/interactions/menu.ts` | Context menu | jsdom tests |
| `src/interactions/structure.ts` | Move/indent/outdent/backfill operations | jsdom + node |
| `src/interactions/create.ts` | New-item flow (config-gated) + folder inference | jsdom tests |
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
  top-level strip, indent — stay available, since last is what they mean anyway.
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
- The collapsed-item list persists in the `.base` file via `config.set('collapsedItems')`
  — prune paths against `model.byPath` when persisting.
- Rendering cost is the scaling limit (a few hundred rows is a normal backlog), so:
  expand/collapse calls `host.refreshSubtree(item)` — which re-renders that row's child
  group in place — never `host.render()`; the view keeps a path → row element index
  (`rowEls`) plus the selected row, so no interaction scans the DOM; and per-render
  config lookups (`getOrder`, `getDisplayName`) live on `RowContext`, not in the per-row
  path. `refreshRowChildren` must prune the subtree it removes from `rowEls`, and
  anything captured at wire time (drag handlers) must read expansion state live, because
  a targeted refresh leaves surrounding rows in place. Data updates still rebuild
  everything — skipping that needs to account for arbitrary chip property values.
- Row layout is columnar: `.pbl-chips` is the flexible middle, and `.pbl-state-col` /
  `.pbl-meta-col` are fixed-width trailing columns so the state chip and the rollup line
  up across rows regardless of title length and indent. Both columns render on every row
  whenever their feature is configured — a leaf without a rollup still gets the empty
  `.pbl-meta-col`, or the columns after it would shift per row.
