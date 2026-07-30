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
| `src/render/toolbar.ts`, `src/render/rows.ts` | DOM rendering | jsdom tests |
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
- Focus mode: the top row is a synthetic grouping — `focusRoot` items keep their real
  `parent` pointer, and reordering/outdent/indent across that row must stay disabled.
- `model.roots` is the RENDERED forest (synthetic under focus); every data operation
  (backfill, ranking parentless items, root-level outdent) must use `model.realRoots`.
- The quick filter is ephemeral view state: while active, `isCollapsed` reports false
  (everything on a match path renders expanded), rows are not draggable (visual
  neighbors are not real siblings), and `setFilter` re-renders the tree only so the
  toolbar input keeps focus.
- Orphans (`parent === null && hasParentValue`): never backfill their type; dropping them
  at top level MUST clear the stale link (`clearsStaleLink`), even position-unchanged.
- Orders are sibling-scoped fractional ranks; when a gap `< MIN_GAP` the whole sibling
  group renumbers. Missing orders sort last, alphabetically.
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
