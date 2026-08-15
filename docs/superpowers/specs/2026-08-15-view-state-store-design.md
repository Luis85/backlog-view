# The view-state store — design

Scope: `src/storage/collapseStore.ts` and `src/view/collapseState.ts` are renamed,
re-shaped and split into three modules. No feature changes, no new user-visible control.
One user-visible **break**: the stored entry is written under a new key with no migration,
so every reader's working position resets once.

The requirement notes named below are the requirement. This document states only the
**mechanism**. Where it disagrees with a register note, the note wins and this file is
wrong.

## 0. Why

The name stopped being true. `collapseStore` holds thirteen values, and five of them are
not a collapse or a position of any kind:

| Stored | What it is |
| --- | --- |
| `collapsed`, `expanded`, `collapsedLanes`, `shelfExpanded` | folds — where the reader is |
| `mode`, `axis`, `focus` | what the reader is looking at |
| `zoom`, `density`, `leadWidth` | layout preferences |
| `clickFolds`, `shelfSort` | behaviour preferences |
| `shelfHiddenTypes` | a filter |

ADR 0011 records the drift as it happened — *"the entry has since taken every other piece
of working position"* — and `clickFolds` is the value that settles the argument: it moved
out of the `.base` on 2026-08-11 **because it is a preference**, and a preference is not a
collapse.

The name is the symptom. The defect is the cost: adding one stored value today means an
edit in **ten** places — the snapshot type, the stored type, `defaultPicks`, `writePicks`,
`readEntry`, `entryHasContent`, a private field on the class, a getter/setter pair,
`restore` and `flush`. Nothing fails when one of the ten is missed. A value can be written
and dropped on the way back in, and the only report is a reader losing a pick.

Not in scope: `view/uiState.ts`'s accessors stay written out, because each one's render
depth is real per-value behaviour rather than repetition. Only its name changes (§6).

## 1. Three modules

| Module | Owns |
| --- | --- |
| `src/storage/viewIdentity.ts` | **which** saved view this is: the leaf walk, the map key, `movedPath` |
| `src/storage/viewStateStore.ts` | **what** is stored: read, validate, write, prune, rekey |
| `src/view/viewState.ts` | the live copy: fold bookkeeping, scopes, debounce, flush, rename |

Identity splits out because it has a consumer that wants nothing else from the store:
`commands/readme.ts` asks only "which base view is this?" and today imports the whole
persistence module to get it. The split is also what keeps both storage files short enough
to read whole.

The layer rule is unchanged: `view/` reaches `storage/`, never the reverse. The projection
constants stay in `storage/` and are read upward, for the reason the existing comment
gives — the three-way agreement between `PROJECTION_MODE`, `projectionFor` and the stored
allowlist can only be a compile error if the list lives at the bottom.

### `storage/viewIdentity.ts`

```ts
export interface ViewIdentity { base: string; view: string }
export function resolveViewIdentity(app: App, el: HTMLElement, viewName: string): ViewIdentity | null
export function viewStateKey(id: ViewIdentity): string
export function viewNameOf(key: string): string | null
export function movedPath(path: string, oldPath: string, newPath: string): string | null
```

Bodies move across unchanged. `resolveViewIdentity` is today's `collapseStoreIdentity`;
its refusal to key an embedded base on the host note is the decision in ADR 0011 and the
limitation in [[Embedded bases do not persist collapse state]], and neither is reopened
here.

### `storage/viewStateStore.ts`

```ts
export interface ViewFolds { collapsed: string[]; expanded: string[]; lanes: string[] }
export interface ViewPrefs { mode?: string; axis?: string; zoom?: string; density?: string;
	leadWidth?: number; focus?: string; clickFolds?: boolean; shelfExpanded?: boolean;
	shelfSort?: string; shelfHiddenTypes?: string[] }
export interface ViewStateSnapshot { folds: ViewFolds; prefs: ViewPrefs }

export function loadViewState(app: App, id: ViewIdentity): ViewStateSnapshot
export function saveViewState(app: App, id: ViewIdentity, state: ViewStateSnapshot): void
export function dropViewState(app: App, id: ViewIdentity): void
export function rekeyBase(app: App, oldPath: string, newPath: string): void
```

Arrays at the boundary, not `Set`s. The snapshot is then the same shape as the stored
JSON, which is what makes the round trip one comparison rather than a translation the test
has to model too. The view keeps its `Set`s internally (§5).

## 2. The stored shape

```jsonc
"product-backlog:view-state": {
  "<encoded base path>#<encoded view name>": {
    "base": "docs/Product Backlog.base",
    "folds": { "collapsed": ["…"], "expanded": ["…"], "lanes": ["luis"] },
    "prefs": { "mode": "board", "zoom": "month", "leadWidth": 240 }
  }
}
```

The key is unchanged in construction — both halves encoded, never parsed, each entry
carrying its own `base` — because that is a decision with a bug behind it (splitting a key
on a separator once deleted a live entry).

**`folds` is everything keyed by something the vault can lose. `prefs` is everything
else.** The prune and the rename take `folds` and cannot reach `prefs`, so the rule stops
being a paragraph and becomes a type.

`collapsedLanes` moves **into** `folds` as `lanes`. It was exiled to sit beside the shelf
fields for one reason — everything in the flat path set is pruned against the vault, and a
resource name is not a file — and that reason is gone once the two path lists are named.
A lane is a fold; it belongs with the folds; the prune walks `collapsed` and `expanded`
only.

`shelfHiddenTypes` stays in `prefs` by the same rule: type names are not paths and are
never pruned. It is a filter rather than a preference, and it is stored, never renamed and
never pruned, which is the only distinction this shape makes.

## 3. One table, both directions

Each bucket has one table of readers:

```ts
type Reader<T> = (value: unknown) => T | undefined;
const PREF_READERS: { [K in keyof ViewPrefs]-?: Reader<NonNullable<ViewPrefs[K]>> } = {
	mode: oneOf(PROJECTION_MODES),
	zoom: oneOf(ZOOM_VALUES),
	leadWidth: inRange(MIN_TIMELINE_LEAD_PX, MAX_TIMELINE_LEAD_PX),
	clickFolds: onlyTrue,
	// …one row per stored value
};
```

`readPrefs(source)` runs the table over any record and keeps what survives. It is called
on the way **in**, over a stored entry, and on the way **out**, over the snapshot the view
hands down. That symmetry is the robustness the current module lacks: today the write path
validates **nothing**, so a value that `readEntry` would refuse can be written, stored, and
silently dropped on the next open.

It replaces `defaultPicks`, `defaultShelf`, `writePicks`, `writeShelf`, the `ShelfState`
interface, `readShelfFields` and the thirteen-clause `entryHasContent` — about 95 lines of
restatement for roughly 30 of table and two loops.

Rules the table keeps, unchanged from today and each still stated where it is enforced:

- **Absence is a value.** A reader returning `undefined` means the key is not written.
  `null`, `''`, `false` and `[]` all read as absence, which is what makes clearing a focus
  delete the key rather than store a name meaning "none".
- **Defensive at every level.** Stored data is user-writable and may be written by another
  version. A `folds` or `prefs` that is not an object reads as empty rather than throwing.
- **Unrecognised keys are dropped, never carried.** That is today's behaviour and it has a
  consequence worth stating in the module: an **older** plugin version writing over a newer
  one's entry loses the newer values. The nested shape makes it look like it might merge.
- **An entry with no content is deleted, not stored.** One predicate — every fold list
  empty and no pref present — asked by the read side and the write side, so a shape one
  writes and the other refuses cannot arise.

`MAX_PATHS` (12000) now bounds the whole `folds` bucket rather than the two path lists:
collapsed first, then expanded, then lanes. Collapsed keys are kept first for the reason
they always were — an expanded key only suppresses the default, while a collapsed one is
visible state.

## 4. The break

The key becomes `product-backlog:view-state`. There is **no migration**: the old entry is
not read, and the store clears `product-backlog:collapse` the first time it writes, so no
vault carries a dead entry forever. Every reader opens once with the tree collapsed, the
tree projection, and the shelf shut.

ADR 0016 is what permits this: before 1.0 a breaking change gets a `CHANGELOG` line rather
than a deprecation window. A migration would have to stay correct forever, and only a live
vault can really prove it — this repository cannot run Obsidian.

Lands with it:

- `CHANGELOG.md`, `[Unreleased] ### Changed` — one entry, written for someone deciding
  whether to upgrade: what resets, and that nothing in the `.base` is touched.
- **ADR 0011 gains a dated Consequences line.** Its decision is unchanged — vault-scoped
  localStorage, keyed per base and per view, never the `.base` — so this is an amendment,
  not a new ADR.
- `eslint.config.mjs`'s `no-restricted-syntax` message names the old path and is updated
  with it. The ban itself is unchanged: `load/saveLocalStorage` stays forbidden outside
  `storage/`.

## 5. The view side

`view/collapseState.ts` becomes `view/viewState.ts`, class `CollapseState` becomes
`ViewState`. Everything about scopes is unchanged and moves across as it stands:
`TIMELINE_SCOPE`, `CARD_SCOPE`, `notePath`, `scopeOf`, `laneKey`, `seedTimelineScope`,
`seedCardScope`, `collapseNewParents`, `renamePath`, the debounce, and the flush-time
prune against the vault.

What changes is the bookkeeping of the ten scalar preferences. They stop being ten private
fields, ten lines in `restore` and ten lines in `flush`, and become one `ViewPrefs` object
with a private helper:

```ts
private setPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K] | null): void
```

which deletes the key for a `null`, `false` or empty value and schedules the save. Each
public accessor stays typed and explicit — `setZoom(id: ScaleId)`, `leadWidthPick():
number | null` — because those are the API the toolbar uses and they carry meaning that a
generated accessor would lose.

**The four collections stay `Set`s on the class**: `collapsed`, `settled`, `foldedLanes`
and the hidden shelf types. `isCollapsed` and `isLaneCollapsed` are asked once per row, so
rebuilding a `Set` from an array per call is a render cost this codebase already refuses to
pay. The `Set`s are built in `restore` and in the setter that changes them, and flattened
to arrays once per flush.

## 6. `UiStateController` → `ViewStateController`

`view/uiState.ts` keeps every accessor. Only the class is renamed, because `ViewState`
beside `UiStateController` gives two names for one subject one file apart — a confusion
this change creates and should therefore fix. The file is renamed to
`view/viewStateController.ts` to match.

## 7. Checks

The suite gets the invariants this shape exists for, and each one is watched failing before
the fix is restored.

- **A compiler-forced round trip.** The fixture is typed `Required<ViewPrefs>` and
  `Required<ViewFolds>`, so a value added to the interface and forgotten in the fixture
  **fails the build**. The test saves the fixture and asserts it reads back identical. This
  is the ten-edit omission caught mechanically rather than by review, and it is the single
  most valuable check in this change.
- **One rejection case per reader**, driven off the same table so a new row cannot be
  untested: a wrong type, and a plausible-but-invalid value — `leadWidth: 4000`,
  `mode: 'gantt'`, `shelfSort: 'priority'`.
- **The bucket invariant.** Rename a note, and delete a note, then assert `prefs` is
  unchanged, `folds.lanes` is unchanged, and only `folds.collapsed` and `folds.expanded`
  moved or shrank. This is the rule §2 exists for, so it is stated from the rule rather
  than from the implementation. The `lanes` half is the assertion that earns its place:
  moving lanes **into** `folds` is what makes "prune the folds" ambiguous, and a prune
  that walked every array in `ViewFolds` would drop every band a reader had folded and
  still pass a check that only said the fold lists shrank.
- **Write validation.** A snapshot carrying an invalid pref is saved and the entry is
  asserted not to hold it. This cannot pass today and is the reason for the symmetry.
- **The break.** A legacy `product-backlog:collapse` entry reads as defaults, throws
  nothing, and is absent after the first save.
- Existing behaviour keeps its existing tests, renamed with the modules:
  `test/storage/collapseStore.test.ts` splits into `test/storage/viewStateStore.test.ts`
  and `test/storage/viewIdentity.test.ts`.
- Coverage thresholds only go up. **Base identity in a live vault stays the one thing this
  repository cannot check** — [[Verify base identity in a live vault]] carries it, and it
  names the storage key in its instructions, so it is edited here.

## 8. The register

`docs-check.mjs` verifies every source path a note names, so the rename is not complete
until the notes are. **23 notes** outside `superpowers/` name
`src/storage/collapseStore.ts` or `src/view/collapseState.ts`. Most are a path swap in a
`## Where it lives` line.

**Four of those 23 also name `src/view/uiState.ts`** — [[Switching projections]],
[[Opening the work]], [[A projection for the tests]] and [[Folding a resource's band]] —
so §6's rename is part of the same sweep, not a follow-up. Two of them name the CLASS in
prose as well (`UiStateController` in [[Switching projections]] and
[[A projection for the tests]]), which no check can catch: `docs-check.mjs` verifies
paths, not symbols. Grep for the class name as well as the path.

Three notes need prose rather than a path swap:

- [[Collapse persistence]] — its `## Where it lives` states the two-module split and now
  states three. Rule 7 needs each new module *specified* somewhere, and this is the note
  that owns them.
- [[Verify base identity in a live vault]] — tells a tester to inspect
  `product-backlog:collapse` by name.
- [[Persisted keys stay as written]] — names the collapse-store key as one of the things
  that must not vary by locale.

Notes under `superpowers/` are historical records of a decision on a date and are **not**
rewritten; `docs-check.mjs` exempts them.

## 9. What this does not do

- No new stored value, no new control, no change to what any projection draws.
- No migration path, by decision (§4).
- No change to the identity walk, the debounce interval, the prune rule or `MAX_PATHS`'
  headroom.
- `view/uiState.ts` keeps its per-accessor render depth. A table over those is the
  over-built version: it trades every typed setter for a dynamic lookup and hides the one
  thing each accessor really decides.
