# Product Backlog — agent guide

Obsidian plugin registering a custom **Bases view** (`product-backlog`): a drag-and-drop
work-item tree (Epic → Feature → PBI → Task) over notes in a flat folder, driven by
`parent`/`order`/`type` frontmatter — with two more projections toggled per saved view:
a kanban **board** whose columns are the configured workflow states, and a
**roadmap** drawing whichever axis the view options declare (horizon buckets that a
card can be moved between, or a read-only timeline from two date properties) with
everything unplaceable on a counted shelf that is also the target that un-places. The
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
(vitest.config.mts) only ever go up. Fallow (config: .fallowrc.json) gates dead code,
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
cannot run here — the jsdom test harness ([`test/CLAUDE.md`](test/CLAUDE.md)) is the
substitute; say so honestly when a change still needs a live-vault smoke test.

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
| `domain/settings.ts` | `BacklogSettings`, defaults, config resolution, `configProblems` validation, the optional-property table every layer reads a key through | node tests |
| `domain/viewOptions.ts` | The declarative Bases view-options schema (its `key`s are persisted user data) | node tests |
| `domain/itemTypes.ts` | The type vocabulary: the level ladder, and the extra types that sit beside it | node tests |
| `domain/noteFields.ts` | Reading a work item's fields off a note: wikilink/bare/alias/list parents, tolerant numbers | node tests |
| `domain/model.ts` | Tree building in three typed phases: parent links, cycles, sorting, effective levels, focus re-rooting, rollups | node tests |
| `domain/folderNotes.ts` | Folder-note inference — the same ancestor walk over loaded items and over the vault | node tests |
| `domain/dropTargets.ts` | Drop-target math and the `DropZone`/`DropTarget` vocabulary (zones, no-op/cycle/stale-link rules) | node tests |
| `domain/board.ts` | Board derivation: columns from the workflow, card assignment, context-card placement and sorting | node tests |
| `domain/roadmap.ts` | Roadmap derivation: the declared axis, horizon buckets, timeline placement, the shelf partition, context handling | node tests |
| `domain/timeline.ts` | Civil-date arithmetic: spans, the bounded month window, bar geometry — today is always injected | node tests |
| `domain/writePlan.ts` | What a change *would* write: drop plans (tree, state, horizon), ranking, backfill. Pure — applies nothing | node tests |
| `domain/backlogReadme.ts` | The README a backlog folder carries: the schema in the view's own keys, generated from configuration and the offered states. Pure text | node tests |
| `domain/readmeText.ts` | Putting a configured value into that text without it changing meaning: the code span, the table cell, the copyable YAML | node tests |
| `domain/readmeMarker.ts` | What the generated README *is*: its file name, and the one line saying which view wrote it | node tests |
| **`storage/`** | **The only place anything is persisted.** | |
| `storage/frontmatter.ts` | ALL frontmatter writes + note creation | node tests |
| `storage/baseFile.ts` | Writing the `.base` file itself | node tests |
| `storage/readmeFile.ts` | Writing the generated README: the marker check, the identical-file no-op, the refusal | node tests |
| `storage/collapseStore.ts` | Per-view UI state (collapse sets + projection mode + roadmap-axis pick) in vault-scoped localStorage: base identity, defensive read, pruning | jsdom tests |
| **`view/`** | **DOM and interaction.** | |
| `view/host.ts` | `BacklogViewHost` — the interface modules use to reach view state | — |
| `view/registry.ts` | The live views, and which one the workspace is showing — how a palette command reaches a Bases view | jsdom tests |
| `view/backlogView.ts` | The BasesView subclass: state, lifecycle, projection dispatch, write gate | jsdom tests |
| `view/selection.ts` | The one selection either projection holds — row/card by path, or a board column stop — and its aria bookkeeping | jsdom tests |
| `view/collapseState.ts` | The view's working position: which rows are shut (once-only default), the projection mode, the debounced save | jsdom tests |
| `view/filterState.ts` | The quick filter's session state: the text, the match path that renders, the matches themselves | jsdom tests |
| `view/render/toolbar.ts`, `view/render/rows.ts` | DOM rendering: toolbar, and the tree/row lead | jsdom tests |
| `view/render/projections.ts` | The content-pane fork: which projection draws into the scroller, the role/label the pane claims, and where the scroll offsets belong | jsdom tests |
| `view/render/board.ts` | The board projection: columns, cards, the advisory beside empty stages — and the card body every projection shares | jsdom tests |
| `view/render/roadmap.ts` | The roadmap projection: buckets or the dated grid, the shelf, the context strip, the advisory — and, on the horizon axis, the drop targets and the per-bucket New | jsdom tests |
| `view/render/timeline.ts` | The dated grid: month header, bars and milestones with exact-date tooltips, the today line | jsdom tests |
| `view/render/emptyStates.ts` | What the tree shows with no rows: loading, empty, no match, all done — plus the board's and roadmap's unconfigured guidance and the one-press setup beside it | jsdom tests |
| `view/render/columns.ts` | `RowContext` (per-pass row index + hoisted config lookups), the column header and every trailing column: property cells, tags, the state and horizon chips, rollup | jsdom tests |
| `view/interactions/dragDrop.ts` | The tree's drag: transient state, indicators, hover-expand, root strip | jsdom tests |
| `view/interactions/cardDrag.ts` | The card drag both projections share: Pragmatic wiring, drop targets that take their own plan, announcements (ADR 0018) | jsdom tests |
| `view/interactions/keyboard.ts` | Tree keyboard navigation + shortcuts | jsdom tests |
| `view/interactions/menu.ts` | Context menu | jsdom tests |
| `view/interactions/structure.ts` | Move/indent/outdent, and the setup action (bind the missing properties, then backfill) | jsdom + node |
| `view/interactions/create.ts` | New-item flow (config-gated) + folder inference | jsdom tests |
| `view/interactions/plan.ts` | The roadmap's placement writes from a row: set/clear horizon, schedule, unschedule | jsdom tests |
| `view/interactions/tags.ts` | Tag vocabulary, normalization and the add/remove writes | jsdom tests |
| `view/interactions/undo.ts` | The undo replay: the slot, the partial-failure remainder, and `UndoRecovery` | jsdom tests |
| `src/ui/prompts.ts` | New-item, folder and schedule prompts (native date fields + folder suggest) | jsdom tests |
| `src/ui/valueSuggest.ts` | Shared `AbstractInputSuggest` base the folder and tag suggesters extend | jsdom tests |
| `src/commands/scaffold.ts` | "Create backlog" command flow | jsdom tests |
| `src/commands/readme.ts` | "Write backlog readme" command: the config gate, the outcomes, the active-view check | jsdom tests |

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

The harness itself — the helpers, what a view test drives, and the limits of the jsdom
substitute — lives in [`test/CLAUDE.md`](test/CLAUDE.md), loaded when you are working
there. What stays here binds while you are editing `src/`:

- `test/**` has its own lint budget (`max-lines: 450`), because the one suite without a cap
  is the one that grows: split by subject before a file becomes the place tests hide. The
  Obsidian ruleset deliberately stops at `src/` — it is type-aware, and the test doubles
  exist to do what it forbids.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. Six of ten review findings
  on one pull request were comments precisely stating the rule the code beside them
  broke, so a confident paragraph is evidence of intent and of nothing else — see
  `docs/issues/A comment that states a rule is not a check.md`. Twice, watching the test
  fail was what showed it asserted less than it read as.

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
without anyone predicting the surface — and `test/view/contextCardWrites.test.ts` asks
the same three questions of each CARD projection (the drag, the keyboard and menu paths
a drag cannot take, the structural refusal behind both), because a card is a different
set of entry points over the same rule.

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

One action also writes the **`.base` itself**: `runInit` (the toolbar's ✨, and the
board's and roadmap's unconfigured empty states) binds this view's suggested key for
every optional property nobody has named, and then backfills those keys onto the notes.
The two halves are one action because neither works alone — Obsidian's picker offers
the properties a vault HAS, so a property no note carries cannot be picked, and a
property nothing names cannot be written to a note. It runs the `configProblems` gate
itself before touching either: an action that changed the configuration and then had
every write refused would leave the view worse than it found it. Everything about
*which* properties those are lives in `domain/settings.ts` — see `src/domain/CLAUDE.md`.

### One move, three inputs — per projection

A card move is a drop, an Alt+arrow and a menu pick landing on ONE host method
(`performBoardMove`, `performHorizonMove`), which is the only place its batch is
planned and the only place it is announced. Adding a fourth input means calling that
method, never planning a write beside it; adding a projection means adding one such
method, not a second idea of what a move is. Both share `applyCardMove`, which also
states the capture rule: the vocabulary that will NAME the move is read before the
await, because the batch's own refresh rebuilds `board`/`roadmap` before it resolves
and the column or bucket just vacated may be gone with its last card.

The two removal writes are the same shape twice — `removeStateKey` and
`removeHorizonKey`, both on keys that may not be configured at all — so
`writeOptional` in `storage/frontmatter.ts` is the single statement of "absence is a
value, and never write to an empty key". A third such property adds a call, not a rule.

A Set menu's **checkmark is asked of the PLAN** — an entry is checked exactly when
picking it would write nothing — never by a comparison written beside the plan and
expected to agree with it. Those two drifted the moment a second property joined: a
horizon the reader refuses reads as no value, so comparing values checked `Unplaced`
on a note whose key still held something, offering as current an action that removes a
key and spends the undo slot.

**A write can take its own note out of the base**, and nothing reports it. A filter can
name the very property a move writes, so a legitimate write can make its own card
vanish; the card leaves in silence, which is what
`docs/requirements/Moving between horizons.md` extension 3b says should not happen. It
was built once and removed — the mechanism belongs to `New cards in place`, and building
it from one sentence took eleven review findings across seven rounds without reaching a
correct rule. Read `docs/issues/The outcome report was built from one sentence.md`
before building it again: the open question is that nothing correlates a Bases pass with
a write, and a design that needs that correlation cannot be made to work here.


## Gotchas

- `obsidian` npm typings trail the app: `setSubmenu` is absent from them entirely, so
  `submenuOf` casts rather than imports. That is a typings gap, NOT a version guard —
  submenus predate the 1.10.2 in `manifest.json`, so there is no fallback path and
  should not be one. `isEmpty` is the opposite case: it IS in the typings, but on
  `ObjectValue` rather than the `Value` that `getValue()` returns, so testing for it
  is a genuine question about the value in hand.
- Fallow resolves an interface's members through an **explicit type annotation**, not
  through a property access: a host method reached only via `const host = ctx.host`
  reports as an unused class member even though it is called. Annotate the local
  (`const host: BacklogViewHost = ctx.host`) rather than reaching for
  `usedClassMembers`, which is for members a framework invokes and would hide a
  genuinely dead one.
- Nothing here carries compatibility with older *plugin* versions. `minAppVersion`
  is the only compatibility boundary, and it is a floor, not a range — a shim for an
  Obsidian older than it is dead code by definition.
- Marketplace rules (enforced by `npm run lint` + review): sentence-case UI text, no
  special characters in the manifest description, `setCssProps` over inline styles,
  `normalizePath` on user paths, no global `app`.
- Release tags must equal `manifest.json` version with NO `v` prefix — `.npmrc` sets
  `tag-version-prefix=""`; the release workflow rejects mismatches. See `RELEASING.md`.
- Dependencies are noticed by Dependabot and verified by `npm run check` — ADR 0019, which
  also says why `npm audit` is deliberately NOT a sixth step. Two upgrades are refused on
  purpose, with the reason in `.github/dependabot.yml`: **TypeScript is held at `~6.0.3`**
  (`typescript-eslint` 8 declares `typescript <6.1.0`, so 6.0.x is permitted and 7 is
  refused outright with ERESOLVE, and lint is what would be lost — the tilde IS that peer
  ceiling, so do not make it a caret), and **`@types/node` tracks the `engines`
  floor**, not npm's newest. Do not "fix" either by widening the range.
- Work is tracked in `docs/`, which is a backlog **in this plugin's own schema** and the
  layout the view ships as its default — `requirements/` (Epic → Feature → PBI),
  `tasks/`, `issues/`, `bugs/`. Every note states the evidence it rests on. Closed notes
  are kept: several are checklists to re-run rather than history, since appearance and
  base identity cannot be tested here. See `docs/README.md`.
