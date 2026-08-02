# Product Backlog — agent guide

Obsidian plugin registering a custom **Bases view** (`product-backlog`): a drag-and-drop
work-item tree (Epic → Feature → PBI → Task) over notes in a flat folder, driven by
`parent`/`order`/`type` frontmatter — with two more projections toggled per saved view:
a kanban **board** whose columns are the configured workflow states, and a read-only
**roadmap** drawing whichever axis the view options declare (horizon buckets, or a
timeline from two date properties) with everything unplaceable on a counted shelf. The
mode and the roadmap-axis pick are UI state (vault-scoped localStorage, beside the
collapse state), never a `.base` setting: base settings are saved on the view, working
position on the device.
Requires Obsidian 1.10.2+ (Bases custom view API).

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow + docs register
```

All five must pass before committing; CI runs the same steps, on Ubuntu **and Windows** —
paths and line endings are the only things that differ between them, and both have already
produced a defect this repository could not see. Coverage thresholds
(vitest.config.ts) only ever go up. Fallow (config: .fallowrc.json) gates dead code,
duplication, complexity/CRAP (fed by the vitest coverage file) and dependency hygiene —
framework-invoked members (`BasesView.type`, suggest callbacks) are declared in
`usedClassMembers`, not suppressed inline. `docs-check.mjs` gates `docs/` the same way:
the register's hierarchy and sibling orders, every wikilink, every source path a current
note names, the use-case shape, the ADR frontmatter — and the check that finds *missing*
notes, since every module and test file must be named by at least one. That gate has a
gate: `test/docs/checkerAccepts.test.ts` and `test/docs/checkerRejects.test.ts` run it over
planted trees in both directions, so a rule quietly lost fails a test, and a legal form it
starts refusing does too — the direction that blocks a contributor rather than letting one
through. Obsidian itself
cannot run here — the jsdom test harness below is the substitute; say so honestly when a
change still needs a live-vault smoke test.

`npm run test-build` is the handover for exactly those cases: it bundles into
`.obsidian/plugins/<id>/` in the repository root (gitignored), so the human can open
this repository as a vault and look. Name it when a change needs eyes — it is a shorter
ask than "please set up a vault", and `docs/` is already a backlog with a `.base` file
in it — open `docs/Product Backlog.base` and the plugin is displaying its own register.

## Architecture (one file per concern, 400-line max enforced by lint)

Four layers, outermost first. **Each may reach anything below it and nothing above** —
`eslint.config.mjs` enforces this with per-directory `no-restricted-imports`, so a
violation fails `npm run lint` rather than waiting for review:

```
main → commands → view → storage → domain
                    ↘________________↗
```

`ui/` is a leaf of reusable Obsidian dialogs that knows about none of them. `test/`
mirrors the same directories.

| File | Responsibility | Testable |
| --- | --- | --- |
| `src/main.ts` | Registers the view via `registerBasesView`, plus the command | — |
| **`domain/`** | **The backlog itself. Reads the vault, never writes it; never touches the DOM.** | |
| `domain/settings.ts` | `BacklogSettings`, defaults, config resolution, `configProblems` validation | node tests |
| `domain/viewOptions.ts` | The declarative Bases view-options schema (its `key`s are persisted user data) | node tests |
| `domain/itemTypes.ts` | The type vocabulary: the level ladder, and the extra types that sit beside it | node tests |
| `domain/noteFields.ts` | Reading a work item's fields off a note: wikilink/bare/alias/list parents, tolerant numbers | node tests |
| `domain/model.ts` | Tree building in three typed phases: parent links, cycles, sorting, effective levels, focus re-rooting, rollups | node tests |
| `domain/folderNotes.ts` | Folder-note inference — the same ancestor walk over loaded items and over the vault | node tests |
| `domain/dropTargets.ts` | Drop-target math and the `DropZone`/`DropTarget` vocabulary (zones, no-op/cycle/stale-link rules) | node tests |
| `domain/board.ts` | Board derivation: columns from the workflow, card assignment, context-card placement and sorting | node tests |
| `domain/roadmap.ts` | Roadmap derivation: the declared axis, horizon buckets, timeline placement, the shelf partition, context handling | node tests |
| `domain/timeline.ts` | Civil-date arithmetic: spans, the bounded month window, bar geometry — today is always injected | node tests |
| `domain/writePlan.ts` | What a change *would* write: drop plans, ranking, backfill. Pure — applies nothing | node tests |
| **`storage/`** | **The only place anything is persisted.** | |
| `storage/frontmatter.ts` | ALL frontmatter writes + note creation | node tests |
| `storage/baseFile.ts` | Writing the `.base` file itself | node tests |
| `storage/collapseStore.ts` | Per-view UI state (collapse sets + projection mode + roadmap-axis pick) in vault-scoped localStorage: base identity, defensive read, pruning | jsdom tests |
| **`view/`** | **DOM and interaction.** | |
| `view/host.ts` | `BacklogViewHost` — the interface modules use to reach view state | — |
| `view/backlogView.ts` | The BasesView subclass: state, lifecycle, projection dispatch, write gate | jsdom tests |
| `view/selection.ts` | The one selection either projection holds — row/card by path, or a board column stop — and its aria bookkeeping | jsdom tests |
| `view/collapseState.ts` | The view's working position: which rows are shut (once-only default), the projection mode, the debounced save | jsdom tests |
| `view/render/toolbar.ts`, `view/render/rows.ts` | DOM rendering: toolbar, and the tree/row lead | jsdom tests |
| `view/render/projections.ts` | The content-pane fork: which projection draws into the scroller, and the role/label the pane claims | jsdom tests |
| `view/render/board.ts` | The board projection: columns, cards, the advisory beside empty stages — and the card body every projection shares | jsdom tests |
| `view/render/roadmap.ts` | The roadmap projection: buckets or the dated grid, the shelf, the context strip, the advisory | jsdom tests |
| `view/render/timeline.ts` | The dated grid: month header, bars and milestones with exact-date tooltips, the today line | jsdom tests |
| `view/render/emptyStates.ts` | What the tree shows with no rows: loading, empty, no match, all done — plus the roadmap's no-axis guidance | jsdom tests |
| `view/render/columns.ts` | `RowContext` (per-pass row index + hoisted config lookups), the column header and every trailing column: property cells, tags, state chip, rollup | jsdom tests |
| `view/interactions/dragDrop.ts` | The tree's drag: transient state, indicators, hover-expand, root strip | jsdom tests |
| `view/interactions/boardDrag.ts` | The board's drag: Pragmatic drag and drop wiring, column drops, announcements (ADR 0018) | jsdom tests |
| `view/interactions/keyboard.ts` | Tree keyboard navigation + shortcuts | jsdom tests |
| `view/interactions/menu.ts` | Context menu | jsdom tests |
| `view/interactions/structure.ts` | Move/indent/outdent/backfill operations | jsdom + node |
| `view/interactions/create.ts` | New-item flow (config-gated) + folder inference | jsdom tests |
| `view/interactions/tags.ts` | Tag vocabulary, normalization and the add/remove writes | jsdom tests |
| `view/interactions/undo.ts` | The undo replay: the slot, the partial-failure remainder, and `UndoRecovery` | jsdom tests |
| `src/ui/prompts.ts` | New-item and folder prompts (+ folder suggest) | jsdom tests |
| `src/ui/valueSuggest.ts` | Shared `AbstractInputSuggest` base the folder and tag suggesters extend | jsdom tests |
| `src/commands/scaffold.ts` | "Create backlog" command flow | jsdom tests |

Rules: never write frontmatter outside `storage/frontmatter.ts` (`applyWrites` /
`createBacklogItem`), and every write path — including creation — goes through the
`configProblems` gate. That rule is also enforced mechanically: `no-restricted-syntax`
bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage` everywhere outside
`storage/`, so a new write path cannot appear by accident. Modules reach view state only
through `BacklogViewHost`; keep `host.ts` free of runtime code so imports stay cycle-free.

A type belongs with the code that *produces* it, not the code that consumes it — that is
why `DropTarget` and `DropZone` live in `domain/dropTargets.ts` rather than with the
writer and the view that read them. Both used to sit upstream and made the pure layer
depend on the effectful one.

## Testing

- `test/helpers/obsidian-mock.ts` — runtime stand-in for the `obsidian` module (aliased in
  `vitest.config.ts`). Extend it when new obsidian API surface is used; keep it minimal.
- `test/helpers/dom.ts` — installs Obsidian's DOM prototype extensions (`createEl`,
  `addClass`, `setCssProps`, …) for jsdom files. Call `installObsidianDom()` at module top.
- `test/helpers/vault.ts` — `FakeVault` (metadata cache, vault, `processFrontMatter`, workspace
  recorder) and `FakeViewConfig` (records `set()` calls). Assert writes via
  `vault.fm(path)` / `vault.writeLog`; assert navigation via `vault.opened`.
- `test/helpers/view.ts` — the view harness every `test/view/*.test.ts` file shares:
  `makeView`, `refresh`, `fixture`, the row/tree accessors, `drag`, `key`, `stubRect`,
  `flush`, `submitPrompt`, and `useViewHarness()` for the per-test reset. Call
  `useViewHarness()` at the top of the file; the helper installs no hooks by itself.
- `test/helpers/register.ts` — a whole miniature repository (`docs/`, `src/`, `test/`)
  written to a throwaway directory and handed to the REAL `docs-check.mjs` as a subprocess.
  The gate is a script — top-level await, paths relative to the working directory,
  `process.exit` for its verdict — so it is run the way CI runs it rather than refactored
  into something importable; a seam built for the test is the thing that would get tested.
  `baseRegister()` is one valid tree and every case is a single delta against it, so a
  failure names a rule rather than a document.
- View tests (`test/view/*.test.ts`, one file per subject) drive REAL interactions: dispatch
  `dragstart`/`dragover`/`drop` (stub `getBoundingClientRect` for drop zones — jsdom returns
  zeros, and `dataTransfer` is absent unless the test supplies one), `keydown`, `click`,
  `contextmenu` (grab the menu via `Menu.lastShown`). Async writes need `await flush()`.
- `test/**` has its own lint budget (`max-lines: 450`), because the one suite without a cap
  is the one that grows: split by subject before a file becomes the place tests hide. The
  Obsidian ruleset deliberately stops at `src/` — it is type-aware, and the test doubles
  exist to do what it forbids.
- Known harness limits: `FakeVault` caches are static — after a write, assert frontmatter
  rather than re-rendering; `entry.getValue()` returns null, so property chips render
  empty in tests.

## Invariants that bite

Layer-specific rules live beside the layer they govern, so they are loaded when you are
working there rather than read as one wall:

| | |
| --- | --- |
| [`src/domain/CLAUDE.md`](src/domain/CLAUDE.md) | levels and depth, scope, focus mode, ranking and orders, folder mode, cycles, orphans |
| [`src/storage/CLAUDE.md`](src/storage/CLAUDE.md) | the write boundary, collapse-store identity, renames, pruning |
| [`src/view/CLAUDE.md`](src/view/CLAUDE.md) | render cost, what is hidden vs absent, tab stops, controls, view lifecycle |

What stays here is what belongs to no single layer.

### The context-row rule

One rule covers the whole context-row feature, and every past bug in it was a place
that forgot the rule rather than a new rule: **an `outsideFilter` row is never a write
target, never a ranking peer, and never a source of anything derived from the Base's
results** (counts, level breakdown, state and tag vocabulary, creation folder). It renders, it
parents, and that is all. "Never a ranking peer" means never written to and never
renumbered — its `order` is still *read* (`afterHighestKnown`, `endOfSiblingsOrder`,
the backfill's max-order scan), because the row is on screen and a rank that ignored
it would place an item above something the user can see. Ask that question of any new
code touching the tree; the "write safety with context rows, across every entry point"
test in `test/view/contextRowWrites.test.ts` drives every interaction against a fixture
with context rows above, beside and between results, so a new write path fails it
without anyone predicting the surface.

"Derived from the results" includes numbers computed *while walking the tree*, not just
code that reads a model collection: `assignAll` traverses **through** a context row to
the results below it but never counts it, so a rollup reports what the Base returned and
an excluded note's own state can neither skew a progress bar nor keep a finished subtree
on screen. Two invariant tests in `test/view/contextRowWrites.test.ts` state this from
the rule rather than the implementation — one for writes, one for rollups.

The view NEVER writes to a note the Base excluded — enforced structurally in
`applySafely`, which refuses the WHOLE batch (loudly) if any write targets an
`outsideFilter` item, so a new write path cannot reopen the hole by omission. It rejects
rather than filters: dropping the offending write alone would apply the rest and leave
the hierarchy half-updated. The one write path without that replay-time check is undo
(`undoLast`), deliberately: its authorization came at capture time — an undo batch can
only name files its forward batch wrote while they were results, and the write being
undone may itself be what moved one out of the filter (a parent marked done in a base
that excludes done items). The rule both paths keep is *never write to a note the user
could not act on*; `test/view/contextRowWrites.test.ts` drives undo across that
boundary too. The UI withholds every control that would produce one: the
state chip renders as a static `.pbl-state-static` div (and not at all when unset), and
the context menu drops Set type, Set state and the parent-link actions. `New <child>`
stays — it writes a *different* note — but it must not land that note outside the filter
either: `inferFolder` counts only result rows, and folder mode's "children go beside the
parent's folder note" rule is skipped for a context parent (the explicit parent link
keeps the hierarchy right wherever it lands). `observedStates` likewise skips them: an
excluded parent's state is not this base's vocabulary and must not become assignable to
results.

### The write path

Writes go through `applySafely` (forward batches) or `undoLast` (replaying the last
batch's inverses), both over one gate (`runExclusively`): serialized (`applying` flag)
and blocked when `configProblems` is non-empty; forward batches are additionally
refused whole if any write targets an `outsideFilter` item. Everything applied was
planned by `domain/writePlan.ts`, which touches nothing, and applied by
`storage/frontmatter.ts`, which is the only module that may — and which captures each
write's inverse as it lands, so the last effective batch can always be taken back
(`applyRestores`, compare-and-swap per key).


## Gotchas

- `obsidian` npm typings trail the app: `setSubmenu` is absent from them entirely, so
  `submenuOf` casts rather than imports. That is a typings gap, NOT a version guard —
  submenus predate the 1.10.2 in `manifest.json`, so there is no fallback path and
  should not be one. `isEmpty` is the opposite case: it IS in the typings, but on
  `ObjectValue` rather than the `Value` that `getValue()` returns, so testing for it
  is a genuine question about the value in hand.
- Nothing here carries compatibility with older *plugin* versions. `minAppVersion`
  is the only compatibility boundary, and it is a floor, not a range — a shim for an
  Obsidian older than it is dead code by definition.
- Marketplace rules (enforced by `npm run lint` + review): sentence-case UI text, no
  special characters in the manifest description, `setCssProps` over inline styles,
  `normalizePath` on user paths, no global `app`.
- Release tags must equal `manifest.json` version with NO `v` prefix — `.npmrc` sets
  `tag-version-prefix=""`; the release workflow rejects mismatches. See `RELEASING.md`.
- Work is tracked in `docs/`, which is a backlog **in this plugin's own schema** and the
  layout the view ships as its default — `requirements/` (Epic → Feature → PBI),
  `tasks/`, `issues/`, `bugs/`. Every note states the evidence it rests on. Closed notes
  are kept: several are checklists to re-run rather than history, since appearance and
  base identity cannot be tested here. See `docs/README.md`.
