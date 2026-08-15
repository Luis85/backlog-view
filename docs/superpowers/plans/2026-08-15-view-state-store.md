# View-state store implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and re-shape `storage/collapseStore.ts` into a view-state store whose
stored entry separates folds from preferences, validated by one table read in both
directions.

**Architecture:** Three modules replace two. `storage/viewIdentity.ts` answers *which*
saved view this is; `storage/viewStateStore.ts` owns *what* is stored, as
`{ base, folds, prefs }`; `view/viewState.ts` holds the live copy. The stored key changes
to `product-backlog:view-state` with no migration, and the old key is cleared on first
write.

**Tech Stack:** TypeScript, Obsidian 1.12.0 API, vitest with jsdom, ESLint,
fallow (dead code / duplication / complexity), `scripts/docs-check.mjs`.

The design is `docs/superpowers/specs/2026-08-15-view-state-store-design.md`. Where this
plan and the spec disagree, the spec wins.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register)
  must pass **before every commit**. CI runs the same five steps on Ubuntu and Windows.
- `node_modules/` is absent in a fresh clone. Run `npm ci` once before anything else.
- 400-line lint cap on `src/**` files, 450 on `test/**` (blank lines and comments skipped).
- `load/saveLocalStorage` is banned by `no-restricted-syntax` outside `src/storage/`.
- Layer rule: `view/` may import `storage/`, never the reverse. `eslint.config.mjs`
  enforces it.
- `docs-check.mjs` rule 7: **every** module in `src/` must be specified in a use case's
  `## Where it lives` or an ADR's `## Decision`. It also verifies that every source path a
  note names exists. Both fail the build, so doc edits ship inside the task that renames
  the file, never after it.
- Coverage thresholds in `vitest.config.mts` only ever go up.
- Sentence-case UI text; no behaviour change is in scope, so no new user-visible string.
- An invariant asserted in a comment gets a test that fails without it, **and the test is
  watched failing** — revert, run, see red, restore.

---

### Task 1: Split identity out of the store

`resolveViewIdentity` (today `collapseStoreIdentity`) answers "which saved view is this?".
`commands/readme.ts` wants that and nothing else from the store. This task moves identity
to its own module with no behaviour change, so the suite must stay green throughout.

**Files:**
- Create: `src/storage/viewIdentity.ts`
- Modify: `src/storage/collapseStore.ts` (delete the moved functions, import them back)
- Modify: `src/commands/readme.ts:7,53` (import and call the new name)
- Modify: `src/view/collapseState.ts:1-15` (import `movedPath` from the new module)
- Create: `test/storage/viewIdentity.test.ts`
- Modify: `docs/requirements/Collapse persistence.md` (`## Where it lives`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface ViewIdentity { base: string; view: string }
  export function resolveViewIdentity(app: App, el: HTMLElement, viewName: string): ViewIdentity | null
  export function viewStateKey(id: ViewIdentity): string
  export function viewNameOf(key: string): string | null
  export function movedPath(path: string, oldPath: string, newPath: string): string | null
  ```

- [ ] **Step 1: Install dependencies**

```bash
npm ci
```

- [ ] **Step 2: Write the failing test**

Create `test/storage/viewIdentity.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { movedPath, viewNameOf, viewStateKey } from '../../src/storage/viewIdentity';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();

describe('viewStateKey', () => {
	it('encodes both halves, so no pair of base and view can collide with another', () => {
		// 'A#B' + 'C' and 'A' + 'B#C' are different views and must not share a key.
		expect(viewStateKey({ base: 'A#B', view: 'C' })).not.toBe(viewStateKey({ base: 'A', view: 'B#C' }));
	});

	it('round-trips a view name through viewNameOf, separator and all', () => {
		expect(viewNameOf(viewStateKey({ base: 'Docs/Plan.base', view: 'Sprint #3' }))).toBe('Sprint #3');
	});

	it('refuses a key it did not write rather than guessing a name', () => {
		expect(viewNameOf('one#two#three')).toBeNull();
		expect(viewNameOf('%E0%A4%A#Backlog')).toBeNull();
	});
});

describe('movedPath', () => {
	it('moves the renamed thing itself', () => {
		expect(movedPath('Old.base', 'Old.base', 'New.base')).toBe('New.base');
	});

	it('carries everything under a renamed folder', () => {
		expect(movedPath('Plans/Q3/Old.base', 'Plans', 'Archive')).toBe('Archive/Q3/Old.base');
	});

	it('leaves a path that merely shares a name prefix alone', () => {
		expect(movedPath('Plans2/Old.base', 'Plans', 'Archive')).toBeNull();
	});
});
```

- [ ] **Step 3: Run the test and watch it fail**

```bash
npx vitest run test/storage/viewIdentity.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/storage/viewIdentity"`.

- [ ] **Step 4: Create the module**

Create `src/storage/viewIdentity.ts`. Move `collapseStoreIdentity` (renamed
`resolveViewIdentity`), `mapKey` (renamed and **exported** as `viewStateKey`),
`viewNameOf` (now exported), `movedPath` and the `ViewIdentity` interface out of
`src/storage/collapseStore.ts` **with their doc comments unchanged** — every one of those
comments records a bug, and none of the reasoning changes by moving file.

The file opens with:

```ts
import { App, FileView } from 'obsidian';

/**
 * Which saved view a piece of stored state belongs to, and how that identity is spelled
 * as a storage key. Split from the store because it has a consumer that wants nothing
 * else: `commands/readme.ts` asks only which base view it is looking at.
 */
```

Keep every body byte-identical apart from the two renames. `viewStateKey` keeps the
"unique, never parsed" comment; `resolveViewIdentity` keeps the paragraph about refusing
an embedded base's host note, which is ADR 0011's decision and
`docs/issues/Embedded bases do not persist collapse state.md`.

- [ ] **Step 5: Point the store at it**

In `src/storage/collapseStore.ts`, delete the five moved declarations and add:

```ts
import { movedPath, ViewIdentity, viewNameOf, viewStateKey } from './viewIdentity';
```

Replace every `mapKey(` call with `viewStateKey(`.

Do **not** re-export the moved symbols from the store as a convenience. The two consumers
in Step 6 import them from `viewIdentity` directly, which leaves a re-export with no
reader — and fallow fails `npm run check` on dead code, correctly.

- [ ] **Step 6: Update the two consumers**

`src/commands/readme.ts` — import `resolveViewIdentity` from `../storage/viewIdentity` and
call it at line 53. Its comment says "the identity the collapse store already resolves for
its own" — reword to name the identity module, since that is now what it means.

`src/view/collapseState.ts` — import `movedPath` and `ViewIdentity` from
`../storage/viewIdentity`, leaving the rest of its store imports alone.

- [ ] **Step 7: Run the tests**

```bash
npx vitest run test/storage/ test/view/ test/commands/
```

Expected: PASS, including the existing `test/storage/collapseStore.test.ts` untouched.

- [ ] **Step 8: Satisfy the register**

`docs-check.mjs` rule 7 needs the new module specified. In
`docs/requirements/Collapse persistence.md`, replace the first sentence of
`## Where it lives` with:

```markdown
`src/storage/viewIdentity.ts` (which saved view this is: the leaf walk that finds the
`.base`, the storage key, and the rename arithmetic both halves need) ·
`src/storage/collapseStore.ts` (defensive read, pruning — the only module allowed to touch
local storage) · `src/view/collapseState.ts` (which rows are shut, the once-only default,
the debounced save).
```

- [ ] **Step 9: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass. If fallow reports `viewNameOf` as unused, confirm the store
imports it — do **not** add it to `usedClassMembers`, which is for framework-invoked
members only.

- [ ] **Step 10: Commit**

```bash
git add src/storage/viewIdentity.ts src/storage/collapseStore.ts src/commands/readme.ts \
  src/view/collapseState.ts test/storage/viewIdentity.test.ts "docs/requirements/Collapse persistence.md"
git commit -m "Split view identity out of the collapse store

commands/readme.ts wants only 'which base view is this' and imported the
whole persistence module to get it. No behaviour change."
```

---

### Task 2: The view-state store

The core. The store is rewritten around `{ base, folds, prefs }`, one reader table
validates both directions, and the key changes with no migration. The view is adapted in
the same commit — its file name does not change yet — because the store's API changes and
a half-switched tree neither builds nor passes fallow.

**Files:**
- Create: `src/storage/viewStateStore.ts` (via `git mv` from `collapseStore.ts`, then rewritten)
- Modify: `src/view/collapseState.ts` (imports, `prefs` bag, `restore`, `flush`)
- Modify: `src/main.ts:4` (import path for `rekeyBase`)
- Modify: `eslint.config.mjs:59` (the `no-restricted-syntax` message names the old path)
- Create: `test/storage/viewStateStore.test.ts` (via `git mv` from `collapseStore.test.ts`, then rewritten)
- Modify: `CHANGELOG.md` (`[Unreleased] ### Changed`)
- Modify: `docs/adrs/0011-keep-collapse-state-out-of-the-base-file.md` (one Consequences line)
- Modify: the 23 register notes naming `src/storage/collapseStore.ts`

**Interfaces:**
- Consumes: `ViewIdentity`, `viewStateKey`, `viewNameOf`, `movedPath` from Task 1.
- Produces:
  ```ts
  export interface ViewFolds { collapsed: string[]; expanded: string[]; lanes: string[] }
  export interface ViewPrefs {
  	mode?: string; axis?: string; zoom?: string; density?: string; leadWidth?: number;
  	focus?: string; clickFolds?: boolean; shelfExpanded?: boolean; shelfSort?: string;
  	shelfHiddenTypes?: string[];
  }
  export interface ViewStateSnapshot { folds: ViewFolds; prefs: ViewPrefs }
  export function loadViewState(app: App, id: ViewIdentity): ViewStateSnapshot
  export function saveViewState(app: App, id: ViewIdentity, state: ViewStateSnapshot): void
  export function dropViewState(app: App, id: ViewIdentity): void
  export function rekeyBase(app: App, oldPath: string, newPath: string): void
  export const BOARD_MODE, ROADMAP_MODE, DELIVERABLES_MODE, CATALOG_MODE: string
  export type ProjectionMode
  export const MIN_TIMELINE_LEAD_PX = 160, MAX_TIMELINE_LEAD_PX = 480
  ```

- [ ] **Step 1: Move the files, keeping their history**

```bash
git mv src/storage/collapseStore.ts src/storage/viewStateStore.ts
git mv test/storage/collapseStore.test.ts test/storage/viewStateStore.test.ts
```

The tree does not build now. That is expected until Step 6.

- [ ] **Step 2: Write the failing round-trip test**

Replace the whole head of `test/storage/viewStateStore.test.ts` (imports through the
`stored` helper) with the block below, and add the three new `describe`s at the end of the
file. **This is the most valuable check in the change**: `Required<…>` makes the compiler
refuse a stored value that nobody added to the fixture.

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	DELIVERABLES_MODE,
	loadViewState,
	MAX_TIMELINE_LEAD_PX,
	MIN_TIMELINE_LEAD_PX,
	rekeyBase,
	saveViewState,
	ViewFolds,
	ViewPrefs,
} from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';
const LEGACY_KEY = 'product-backlog:collapse';

/**
 * Every stored value, with every key REQUIRED. A value added to `ViewPrefs` or
 * `ViewFolds` and forgotten here fails the BUILD rather than the suite — which is the
 * omission this whole shape exists to make impossible, since nothing else reports a
 * value that is written and then dropped on the way back in.
 */
const FULL_PREFS: Required<ViewPrefs> = {
	mode: DELIVERABLES_MODE,
	axis: 'dates',
	zoom: 'quarter',
	density: 'compact',
	leadWidth: 240,
	focus: 'Feature',
	clickFolds: true,
	shelfExpanded: true,
	shelfSort: 'modified',
	shelfHiddenTypes: ['Task'],
};

const FULL_FOLDS: Required<ViewFolds> = {
	collapsed: ['Epic.md'],
	expanded: ['Feature.md'],
	lanes: ['luis'],
};

const ID = { base: 'Plan.base', view: 'Backlog' };

function emptyFolds(): ViewFolds {
	return { collapsed: [], expanded: [], lanes: [] };
}

function stored(vault: FakeVault): Record<string, { base: string; folds: ViewFolds; prefs: ViewPrefs }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<
		string,
		{ base: string; folds: ViewFolds; prefs: ViewPrefs }
	>;
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
	vault.addFile('Plan.base');
	for (const path of ['Epic.md', 'Feature.md']) vault.addFile(path);
});

describe('the stored entry', () => {
	it('round-trips every value the view can store', () => {
		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: FULL_PREFS });

		expect(loadViewState(vault.app, ID)).toEqual({ folds: FULL_FOLDS, prefs: FULL_PREFS });
	});

	it('needs no entry at all for a view at its defaults', () => {
		saveViewState(vault.app, ID, { folds: emptyFolds(), prefs: {} });

		expect(loadViewState(vault.app, ID)).toEqual({ folds: emptyFolds(), prefs: {} });
		expect(Object.keys(stored(vault))).toHaveLength(0);
	});

	it('refuses to WRITE a value it would refuse to read back', () => {
		// The write path validated nothing before this shape: a bad value was stored and
		// then silently dropped on the next open, reported only by a reader losing a pick.
		saveViewState(vault.app, ID, {
			folds: FULL_FOLDS,
			prefs: { mode: 'gantt', leadWidth: 4000, shelfSort: 'priority' },
		});

		expect(Object.values(stored(vault))[0].prefs).toEqual({});
	});
});

describe('folds and prefs are different kinds of thing', () => {
	it('carries both buckets through a base rename', () => {
		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: FULL_PREFS });
		vault.files.delete('Plan.base');
		vault.addFile('Archive/Plan.base');

		rekeyBase(vault.app, 'Plan.base', 'Archive/Plan.base');

		expect(loadViewState(vault.app, { base: 'Archive/Plan.base', view: 'Backlog' })).toEqual({
			folds: FULL_FOLDS,
			prefs: FULL_PREFS,
		});
	});
});

describe('the 0.8 entry', () => {
	it('is not read, and is cleared on the first write', () => {
		vault.localStorage.set(LEGACY_KEY, {
			'Plan.base#Backlog': { base: 'Plan.base', collapsed: ['Epic.md'], expanded: [], mode: 'board' },
		});

		expect(loadViewState(vault.app, ID)).toEqual({ folds: emptyFolds(), prefs: {} });

		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: {} });
		expect(vault.localStorage.has(LEGACY_KEY)).toBe(false);
	});
});
```

Then rewrite the surviving `describe`s in that file to the new call names and shape: every
`saveCollapseState(app, id, { collapsed: new Set([...]), expanded: new Set() })` becomes
`saveViewState(app, id, { folds: { collapsed: [...], expanded: [], lanes: [] }, prefs: {} })`,
every `loadCollapseState` becomes `loadViewState`, every `restored.collapsed` assertion
drops its spread (`expect(restored.folds.collapsed).toEqual([...])`), and every pick moves
under `prefs`. Keep all 39 existing cases — they are the module's behaviour and none of it
changes. If the file passes 450 lines, move the `rekeyBase` describes into
`test/storage/viewIdentity.test.ts`'s file as a `rekeyBase` describe importing from the
store; do not delete cases to fit.

- [ ] **Step 3: Run the test and watch it fail**

```bash
npx vitest run test/storage/viewStateStore.test.ts
```

Expected: FAIL — `loadViewState` is not exported.

- [ ] **Step 4: Rewrite the store**

`src/storage/viewStateStore.ts`, in full. Keep the existing doc comments for the constants
(`PROJECTION_MODES`, `AXIS_VALUES`, `MIN/MAX_TIMELINE_LEAD_PX`, `MAX_PATHS`) — each states
a decision — and adapt only what the reshape changes.

```ts
import { App } from 'obsidian';
import { movedPath, ViewIdentity, viewNameOf, viewStateKey } from './viewIdentity';

/**
 * Everything one saved view remembers between sessions, in vault-scoped localStorage:
 * which rows are folded, and every pick that is this device's rather than the base's.
 *
 * Never the `.base` file (ADR 0011). Base settings are saved on the view; working
 * position and per-device preferences are saved here, under one key holding one entry
 * per base view.
 *
 * The entry has two buckets and the split is behavioural, not cosmetic: `folds` is
 * everything keyed by something the VAULT can lose, so it is what the prune and the
 * rename walk; `prefs` is everything else and neither ever touches it.
 */

/** One vault-scoped entry holds every Product Backlog view's state. */
const STORE_KEY = 'product-backlog:view-state';
/**
 * The key 0.8 and earlier wrote. Not read and not migrated — the decision is in ADR 0011's
 * consequences and ADR 0016 is what permits it before 1.0. Cleared on the first write so
 * no vault carries a dead entry forever.
 */
const LEGACY_KEY = 'product-backlog:collapse';

/**
 * Backstop on how many fold keys a single view may remember, across all three lists.
 * A real backlog is a few hundred rows, so this is far above normal use and exists only
 * so a pathological vault cannot grow the entry without bound. Collapsed keys are kept
 * first: an expanded entry only suppresses the default, while a collapsed one is visible
 * state, and a lane is one per resource rather than one per note.
 */
const MAX_FOLDS = 12000;

export const BOARD_MODE = 'board';
export const ROADMAP_MODE = 'roadmap';
export const DELIVERABLES_MODE = 'deliverables';
export const CATALOG_MODE = 'catalog';
const PROJECTION_MODES = [BOARD_MODE, ROADMAP_MODE, DELIVERABLES_MODE, CATALOG_MODE] as const;
export type ProjectionMode = (typeof PROJECTION_MODES)[number];

const AXIS_VALUES = ['horizons', 'dates', 'resources'];
const ZOOM_VALUES = ['week', 'month', 'quarter'];
const DENSITY_VALUES = ['compact'];
const SHELF_SORT_VALUES = ['tree', 'title', 'modified'];
export const MIN_TIMELINE_LEAD_PX = 160;
export const MAX_TIMELINE_LEAD_PX = 480;

/** Everything keyed by something the vault can lose: note paths, and a lane's own name. */
export interface ViewFolds {
	collapsed: string[];
	expanded: string[];
	/**
	 * Resource bands folded shut, by name. A fold like the others, and NOT a path — which
	 * is why the prune walks the two lists above and never this one.
	 */
	lanes: string[];
}

/** Everything else: one value each, never pruned, never renamed. */
export interface ViewPrefs {
	mode?: string;
	axis?: string;
	zoom?: string;
	density?: string;
	leadWidth?: number;
	focus?: string;
	clickFolds?: boolean;
	shelfExpanded?: boolean;
	shelfSort?: string;
	shelfHiddenTypes?: string[];
}

export interface ViewStateSnapshot {
	folds: ViewFolds;
	prefs: ViewPrefs;
}

interface StoredEntry {
	/**
	 * The base this entry belongs to, carried rather than parsed back out of the key.
	 * A view name may contain anything a user can type — "Sprint #3" is an ordinary
	 * name — so splitting the key on a separator would misread the base path and let
	 * another view's save prune a live entry.
	 */
	base: string;
	folds: ViewFolds;
	prefs: ViewPrefs;
}

type StoredMap = Record<string, StoredEntry>;

/** A stored value this plugin recognises, or `undefined` for one it does not. */
type Reader<T> = (value: unknown) => T | undefined;

function oneOf(allowed: readonly string[]): Reader<string> {
	return (value) => (typeof value === 'string' && allowed.includes(value) ? value : undefined);
}

/**
 * Only a stored `true`. Anything else a hand-edited entry holds is not a boolean this
 * wrote, and the default is what it falls back to anyway.
 */
function onlyTrue(value: unknown): true | undefined {
	return value === true ? true : undefined;
}

/**
 * A NUMBER rather than an enum, so there is no vocabulary to check it against. Outside
 * the range it reads back as absent rather than clamped: a clamp would still trust a
 * corrupt-but-plausible number into the layout.
 */
function inRange(min: number, max: number): Reader<number> {
	return (value) =>
		typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

/** Not an enum: a focus or a type name outside the configured vocabulary already reads as none. */
function anyName(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function texts(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((text): text is string => typeof text === 'string' && text.length > 0);
}

function nonEmptyTexts(value: unknown): string[] | undefined {
	const list = texts(value);
	return list.length > 0 ? list : undefined;
}

/**
 * The one statement of what a stored preference may be. It is run on the way IN, over an
 * entry another version of this plugin may have written, and on the way OUT, over the
 * snapshot the view hands down — so a value the store would refuse to read can never be
 * written in the first place. Two directions, one rule; a new preference is one row here
 * and one field on {@link ViewPrefs}.
 */
const PREF_READERS: { [K in keyof ViewPrefs]-?: Reader<NonNullable<ViewPrefs[K]>> } = {
	mode: oneOf(PROJECTION_MODES),
	axis: oneOf(AXIS_VALUES),
	zoom: oneOf(ZOOM_VALUES),
	density: oneOf(DENSITY_VALUES),
	leadWidth: inRange(MIN_TIMELINE_LEAD_PX, MAX_TIMELINE_LEAD_PX),
	focus: anyName,
	clickFolds: onlyTrue,
	shelfExpanded: onlyTrue,
	shelfSort: oneOf(SHELF_SORT_VALUES),
	shelfHiddenTypes: nonEmptyTexts,
};

/** A record, or an empty one for anything that is not a plain object. */
function objectOf(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

/**
 * Absence is a value: a reader answering `undefined` means the key is not written at all,
 * which is what makes clearing a focus remove the field rather than store a name meaning
 * "none".
 */
function readPrefs(source: unknown): ViewPrefs {
	const record = objectOf(source);
	const prefs: Record<string, unknown> = {};
	for (const [key, read] of Object.entries(PREF_READERS)) {
		const value = (read as Reader<unknown>)(record[key]);
		if (value !== undefined) prefs[key] = value;
	}
	return prefs as ViewPrefs;
}

/** The same, for the folds — one {@link MAX_FOLDS} budget spent across the three lists. */
function readFolds(source: unknown): ViewFolds {
	const record = objectOf(source);
	const collapsed = texts(record.collapsed).slice(0, MAX_FOLDS);
	const expanded = texts(record.expanded).slice(0, MAX_FOLDS - collapsed.length);
	const lanes = texts(record.lanes).slice(0, MAX_FOLDS - collapsed.length - expanded.length);
	return { collapsed, expanded, lanes };
}

/**
 * A view at its defaults needs no entry. Asked by the read side and the write side with
 * one function, so a shape one writes and the other refuses cannot arise.
 */
function hasContent(entry: StoredEntry): boolean {
	const { collapsed, expanded, lanes } = entry.folds;
	return collapsed.length + expanded.length + lanes.length > 0 || Object.keys(entry.prefs).length > 0;
}

export function loadViewState(app: App, id: ViewIdentity): ViewStateSnapshot {
	const entry = readMap(app)[viewStateKey(id)];
	return { folds: readFolds(entry?.folds), prefs: readPrefs(entry?.prefs) };
}

/**
 * Write this view's entry, leaving every other view's alone. Entries whose base file is
 * gone go with it — the only chance to notice, since nothing enumerates the bases that
 * ever wrote here.
 */
export function saveViewState(app: App, id: ViewIdentity, state: ViewStateSnapshot): void {
	const map = readMap(app);
	const key = viewStateKey(id);
	const entry: StoredEntry = { base: id.base, folds: readFolds(state.folds), prefs: readPrefs(state.prefs) };
	if (hasContent(entry)) map[key] = entry;
	else delete map[key];
	pruneMissingBases(app, map, key);
	writeMap(app, map);
}

/** Forget one view's entry — used when its state has just been written elsewhere. */
export function dropViewState(app: App, id: ViewIdentity): void {
	const map = readMap(app);
	const key = viewStateKey(id);
	if (!(key in map)) return;
	delete map[key];
	writeMap(app, map);
}

/**
 * Follow a `.base` that was renamed or moved — directly, or by moving a folder above it.
 * The path is half the key, so without this an ordinary bit of vault tidying would orphan
 * every entry for that base: never found again under the new path, and then deleted by
 * the next save, because a base that no longer exists is what `pruneMissingBases` looks
 * for.
 *
 * Takes any rename, file or folder, and does nothing when no entry sits under the old
 * path. That also makes it idempotent.
 */
export function rekeyBase(app: App, oldPath: string, newPath: string): void {
	const map = readMap(app);
	let moved = false;
	for (const [key, entry] of Object.entries(map)) {
		const base = movedPath(entry.base, oldPath, newPath);
		if (base === null) continue;
		const view = viewNameOf(key);
		if (view === null) continue;
		delete map[key];
		map[viewStateKey({ base, view })] = { ...entry, base };
		moved = true;
	}
	if (moved) writeMap(app, map);
}

function writeMap(app: App, map: StoredMap): void {
	try {
		app.saveLocalStorage(STORE_KEY, map);
		// Not a migration: the 0.8 entry is never read. Cleared here so the bytes go with
		// the version that stopped understanding them.
		if (app.loadLocalStorage(LEGACY_KEY) !== null) app.saveLocalStorage(LEGACY_KEY, null);
	} catch (e) {
		// A full or unavailable localStorage must not take the view down with it: this
		// state is a convenience, and every projection renders fine without it.
		console.error('Product Backlog: could not save view state', e);
	}
}

/** Drop entries for bases that no longer exist, never the one being written. */
function pruneMissingBases(app: App, map: StoredMap, keep: string): void {
	for (const [key, entry] of Object.entries(map)) {
		if (key === keep) continue;
		if (app.vault.getAbstractFileByPath(entry.base) === null) delete map[key];
	}
}

/**
 * Read the stored map defensively. It is user-writable state on disk that older — or
 * newer — versions of this plugin may have written, so every level is checked and
 * anything unrecognizable is dropped rather than trusted.
 *
 * Dropped, never carried: an OLDER plugin version writing over a newer one's entry loses
 * the newer values. The nested shape makes it look like it might merge.
 */
function readMap(app: App): StoredMap {
	let raw: unknown = null;
	try {
		raw = app.loadLocalStorage(STORE_KEY) as unknown;
	} catch {
		return {};
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const map: StoredMap = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const entry = readEntry(value);
		if (entry) map[key] = entry;
	}
	return map;
}

function readEntry(value: unknown): StoredEntry | null {
	const record = objectOf(value);
	// An entry with no base cannot be pruned when its file goes, so it would linger
	// forever; dropping it costs one view's state and is self-healing.
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry: StoredEntry = { base, folds: readFolds(record.folds), prefs: readPrefs(record.prefs) };
	return hasContent(entry) ? entry : null;
}
```

- [ ] **Step 5: Run the store tests**

```bash
npx vitest run test/storage/
```

Expected: PASS. The tree still does not build — the view is next.

- [ ] **Step 6: Adapt the view**

In `src/view/collapseState.ts`:

Replace the store import with `viewStateStore`, adding `ViewPrefs`. Then delete the ten
scalar private fields (`mode`, `axis`, `zoom`, `density`, `leadWidth`, `focus`,
`clickFoldsValue`, `shelfExpanded`, `shelfSortValue` — and keep `hiddenShelfTypes` and
`foldedLanes`, which are `Set`s) and put one bag in their place:

```ts
	/**
	 * Every scalar pick, in the shape the store takes. One object rather than ten fields:
	 * `restore` and `flush` stop enumerating, so a pick added to one and forgotten in the
	 * other cannot happen.
	 */
	private prefs: ViewPrefs = {};

	/**
	 * The two collections that stay `Set`s. `isCollapsed` and `isLaneCollapsed` are asked
	 * once per row, so rebuilding a set from an array per call is a render cost this view
	 * refuses; they are flattened once per flush instead. `hiddenShelfTypes` mirrors
	 * `prefs.shelfHiddenTypes` and is written by the same setter, so the two cannot drift.
	 */
	private hiddenShelfTypes = new Set<string>();
	private foldedLanes = new Set<string>();
```

Add the one helper every setter goes through:

```ts
	/**
	 * Absence is a value. `null`, `false`, `''` and `[]` all mean "no entry", which is the
	 * same rule the store keeps on the way to disk — stated here so the two cannot answer
	 * differently about what a cleared pick is.
	 */
	private setPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K] | null): void {
		const empty = value === null || value === false || value === '' || (Array.isArray(value) && value.length === 0);
		// The cast is the one TypeScript needs: narrowing does not survive an indexed
		// access on a generic key, and `empty` is exactly the null case it removes.
		if (empty) delete this.prefs[key];
		else this.prefs[key] = value as ViewPrefs[K];
		this.scheduleSave();
	}
```

Rewrite each accessor to read the bag and write through the helper. Every public signature
stays exactly as it is:

```ts
	projection(): Projection { return projectionFor(this.prefs.mode ?? null); }
	setProjection(mode: Projection): void { this.setPref('mode', PROJECTION_MODE[mode]); }
	axisPick(): string | null { return this.prefs.axis ?? null; }
	setAxisPick(axis: string): void { this.setPref('axis', axis); }
	zoomPick(): string | null { return this.prefs.zoom ?? null; }
	setZoom(id: string): void { this.setPref('zoom', id); }
	densityPick(): string | null { return this.prefs.density ?? null; }
	setDensity(value: string | null): void { this.setPref('density', value); }
	clickFolds(): boolean { return this.prefs.clickFolds ?? false; }
	setClickFolds(value: boolean): void { this.setPref('clickFolds', value); }
	leadWidthPick(): number | null { return this.prefs.leadWidth ?? null; }
	setLeadWidth(value: number | null): void { this.setPref('leadWidth', value); }
	focusLevel(): string { return this.prefs.focus ?? ''; }
	setFocusLevel(level: string): void { this.setPref('focus', level || null); }
	shelfCollapsed(): boolean { return !(this.prefs.shelfExpanded ?? false); }
	setShelfCollapsed(collapsed: boolean): void { this.setPref('shelfExpanded', !collapsed); }
	shelfSort(): ShelfSort { return (this.prefs.shelfSort as ShelfSort | undefined) ?? 'tree'; }
	setShelfSort(sort: ShelfSort): void { this.setPref('shelfSort', sort === 'tree' ? null : sort); }

	shelfHiddenTypes(): ReadonlySet<string> { return this.hiddenShelfTypes; }

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.hiddenShelfTypes = new Set(types);
		this.setPref('shelfHiddenTypes', [...types]);
	}
```

Keep each existing doc comment on the accessor it belongs to — `setFocusLevel`'s "the
whole tree is the default and needs no stored value" and `setProjection`'s note about the
tree storing nothing are exactly what `setPref` now enforces.

`restore` loses its eleven assignments:

```ts
		const { folds, prefs } = loadViewState(this.host.app, this.id);
		this.collapsed = new Set(folds.collapsed);
		// Both lists settle a key; only the collapsed ones are shut.
		this.settled = new Set([...folds.collapsed, ...folds.expanded]);
		seedTimelineScope(this.collapsed, this.settled);
		seedCardScope(this.collapsed, this.settled);
		this.prefs = prefs;
		this.hiddenShelfTypes = new Set(prefs.shelfHiddenTypes ?? []);
		// Normalized on the way back in as well, so an entry written before the key was
		// canonical still shuts the band it was about.
		this.foldedLanes = new Set(folds.lanes.map(laneKey));
```

and `flush` loses its thirteen-line literal:

```ts
		const expanded = [...this.settled].filter((key) => !this.collapsed.has(key));
		saveViewState(this.host.app, id, {
			folds: { collapsed: [...this.collapsed], expanded, lanes: [...this.foldedLanes] },
			prefs: this.prefs,
		});
```

Replace `dropCollapseState` with `dropViewState` in `flush`, and `collapseStoreIdentity`
with `resolveViewIdentity` (already imported from `viewIdentity` in Task 1).

- [ ] **Step 7: Write the lane-prune invariant where the prune actually is**

The store never prunes note paths — `flush` in the view does, against the vault. So the
invariant "a prune that walked every array in `ViewFolds` would drop every folded band"
has to be asserted there, beside the lane persistence cases already in
`test/view/persistence.test.ts` (around line 253):

```ts
	it('keeps a folded band when the flush prunes a note that is gone', () => {
		// `folds.lanes` holds resource NAMES. The flush drops fold keys whose FILE is
		// gone, and a prune that took the whole folds bucket rather than the two path
		// lists would shut nothing and silently reopen every band the reader folded.
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setLaneCollapsed('Dana', true);
		vault.files.delete('Epic A.md');
		first.view.onunload();

		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(second.view.isLaneCollapsed('Dana')).toBe(true);
	});
```

Run it, and prove it can fail: in `flush`, add `this.foldedLanes.clear()` inside the prune
loop's body. Expected: RED. Remove it and the test passes again.

- [ ] **Step 8: Update the last two call sites**

`src/main.ts:4` — `import { rekeyBase } from './storage/viewStateStore';`

`eslint.config.mjs:59` — the message becomes
`'Persisted view state goes through src/storage/viewStateStore.ts.'`. The selector is
unchanged.

- [ ] **Step 9: Update the tests that read the stored entry directly**

Seven test files reach into localStorage by key and read the flat shape. Find them:

```bash
grep -rln "product-backlog:collapse" test/
```

`test/storage/viewStateStore.test.ts`, `test/view/persistence.test.ts`,
`test/view/timelineCollapse.test.ts`, `test/view/timelineLeadResize.test.ts`,
`test/view/cardChildren.test.ts`, `test/view/roadmap.test.ts`, `test/view/board.test.ts`
and `test/view/timelineZoom.test.ts`. In each: the key becomes
`'product-backlog:view-state'`, an entry read of `.collapsed` or `.expanded` becomes
`.folds.collapsed` / `.folds.expanded`, and a pick read like `.mode` or `.leadWidth`
becomes `.prefs.mode` / `.prefs.leadWidth`. A test that SEEDS localStorage by hand seeds
the new shape — `{ base, folds: { collapsed, expanded, lanes }, prefs: {} }`.

Do not weaken an assertion to make it pass. If one of these fails on the new shape and the
fix is not obvious, that is a finding about the reshape, not about the test.

- [ ] **Step 10: Run the whole suite**

```bash
npx vitest run
```

Expected: PASS. `test/view/persistence.test.ts` and the timeline lead tests drive this
path hardest; if one fails on a pick coming back as `undefined` rather than `null`, the
accessor is missing its `?? null`.

- [ ] **Step 11: Watch the new invariants fail**

Prove each new test can fail, one at a time, restoring after each:

1. In `readFolds`, prune `lanes` as if it were a path list (`lanes: []`) — the
   "keeps prefs and lane folds untouched" case must go red. Restore.
2. In `saveViewState`, use `state.prefs` instead of `readPrefs(state.prefs)` — the
   "refuses to WRITE a value it would refuse to read back" case must go red. Restore.
3. In `writeMap`, delete the `LEGACY_KEY` line — the "0.8 entry" case must go red. Restore.
4. Delete one key from `FULL_PREFS` — `npx tsc --noEmit` must fail. Restore.

- [ ] **Step 12: The break, in the register**

`CHANGELOG.md`, under `## [Unreleased]` `### Changed`:

```markdown
- **Your working position resets once on upgrade.** Which rows were folded, the projection
  each view was showing, the roadmap axis, zoom, density and lead width, the focus level,
  the click behaviour and the shelf's own controls are stored under a new key and the old
  one is not read. Open each view once and set it up again; nothing in your `.base` files
  and nothing in your notes is touched.
```

`docs/adrs/0011-keep-collapse-state-out-of-the-base-file.md`, appended to `## Consequences`:

```markdown
- **The entry is `{ folds, prefs }` as of 2026-08-15**, and the key is
  `product-backlog:view-state`. Two thirds of what it holds was never a fold — `zoom`,
  `density` and `leadWidth` are layout preferences, `clickFolds` and `shelfSort` are
  behaviour, `shelfHiddenTypes` is a filter — and the split is what the prune and the
  rename walk: `folds` is everything keyed by something the vault can lose, and they
  cannot reach `prefs` at all. The old key is not migrated, which ADR 0016 permits before
  1.0; it is cleared on the first write.
```

- [ ] **Step 13: The register sweep**

```bash
grep -rln "src/storage/collapseStore.ts\|test/storage/collapseStore.test.ts" docs/ | grep -v superpowers
```

Replace `src/storage/collapseStore.ts` with `src/storage/viewStateStore.ts`, and
`test/storage/collapseStore.test.ts` with `test/storage/viewStateStore.test.ts`, in every
note the grep returns. `superpowers/` notes are historical records of a decision on a date
and are **not** rewritten — `docs-check.mjs` exempts them.

**The test path is not optional.** `docs-check.mjs:430` matches
`` `(src|test)/….ts` `` in a living note's prose and fails on one that no longer exists,
so a sweep that took only the source path leaves the gate red. Five notes name the test
file: [[Switching projections]], [[Collapse persistence]], [[A resizable lead column]],
[[Three projections, one toggle]] and [[Persisted keys stay as written]].

Rule 7 — every `src/` module *specified* in a note — is what exempts `test/` from needing
a note of its own. It does not exempt a test path a note chose to name.

Two need more than a path swap:

- `docs/tests/cases/Verify base identity in a live vault.md:62` names
  `product-backlog:collapse` in a tester's instructions. Change it to
  `product-backlog:view-state` and add: the first open after upgrading from 0.8 must show
  the view at its defaults, and the old key must be gone from the console.
- `docs/requirements/Persisted keys stay as written.md` names the collapse-store key under
  **Collapse-store keys**. Rename that paragraph's subject to the view-state store; the
  invariant (no locale-dependent component in the identity) is unchanged.

- [ ] **Step 14: Run the full gate**

```bash
npm run check
```

Expected: all five pass. Coverage may move; if a threshold in `vitest.config.mts` is now
exceeded, raise it to the new figure — thresholds only ever go up.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "Store view state as folds and prefs, under a new key

The entry holds thirteen values and five were never a fold. It is now
{ folds, prefs }: folds is everything keyed by something the vault can
lose, so the prune and the rename walk it and cannot reach prefs.

One reader table validates both directions, so the store can no longer
write a value it would refuse to read back — the write path validated
nothing. The key becomes product-backlog:view-state with no migration
(ADR 0016), and the 0.8 entry is cleared on the first write."
```

---

### Task 3: Rename the view side

Mechanical, and the last of the misnomer. No logic changes: if a diff hunk in this task
is not a name, it does not belong in this task.

**Files:**
- Rename: `src/view/collapseState.ts` → `src/view/viewState.ts` (`CollapseState` → `ViewState`)
- Rename: `src/view/uiState.ts` → `src/view/viewStateController.ts` (`UiStateController` → `ViewStateController`)
- Modify: `src/view/backlogView.ts:2,84,137`
- Rename: any `test/**` file whose subject is the renamed class
- Modify: the register notes naming either path, and the two naming the controller class

**Interfaces:**
- Consumes: `loadViewState`, `saveViewState`, `dropViewState`, `ViewPrefs` from Task 2.
- Produces: `class ViewState`, `class ViewStateController`, and the unchanged exports
  `TIMELINE_SCOPE` and `CARD_SCOPE`.

- [ ] **Step 1: Move the files**

```bash
git mv src/view/collapseState.ts src/view/viewState.ts
git mv src/view/uiState.ts src/view/viewStateController.ts
```

- [ ] **Step 2: Rename the classes and every import**

```bash
grep -rln "collapseState\|CollapseState\|uiState\|UiStateController" src/ test/
```

In each file the grep returns: `CollapseState` → `ViewState`, `UiStateController` →
`ViewStateController`, `'./collapseState'` → `'./viewState'`, `'./uiState'` →
`'./viewStateController'` (and the `../view/…` spellings in `test/`). The private field
`private readonly collapse: CollapseState` in both `backlogView.ts` and the controller
becomes `private readonly state: ViewState` — leaving it named `collapse` keeps the
misnomer at the call site, which is the whole point of this task.

The class doc comment on `ViewState` still says "the view's working position". Correct it:
it holds working position **and** this device's preferences, which is why it is no longer
called a collapse state.

- [ ] **Step 3: Rename the test files whose subject moved**

```bash
git mv test/view/persistence.test.ts test/view/viewStatePersistence.test.ts
```

Leave every other test file where it is — `test/view/toolbarCollapse.test.ts` and
`test/view/cardChildren.test.ts` are named for the behaviour they drive, not the class.

- [ ] **Step 4: Run the suite**

```bash
npx vitest run
```

Expected: PASS, with no test body changed — only names and import paths.

- [ ] **Step 5: The register sweep**

```bash
grep -rln "src/view/collapseState.ts\|src/view/uiState.ts\|test/view/persistence.test.ts\|UiStateController" \
  docs/ | grep -v superpowers
```

`test/view/persistence.test.ts` is renamed in Step 3 of this task and is named by three
living notes — [[Collapse persistence]], [[Focus level]] and [[Opening the work]]. It is
checked by the same rule as a source path (`docs-check.mjs:430`), so it moves with them.

Swap the paths, and the class name in the two notes that name it in prose
(`docs/requirements/Switching projections.md:98` and
`docs/requirements/A projection for the tests.md:572`). `docs-check.mjs` verifies paths
and not symbols, so the class name is the half no gate will catch — grep for it, do not
rely on the check.

`docs/requirements/Collapse persistence.md`'s `## Where it lives` gets its final form, all
four modules:

```markdown
`src/storage/viewIdentity.ts` (which saved view this is: the leaf walk that finds the
`.base`, the storage key, and the rename arithmetic both halves need) ·
`src/storage/viewStateStore.ts` (what is stored: the defensive read, the one reader table
both directions run through, and pruning — the only module allowed to touch local
storage) · `src/view/viewState.ts` (which rows are shut, the once-only default, the
debounced save) · `src/view/viewStateController.ts` (the read/write pair each stored pick
exposes to the toolbar, and the render depth each change needs).
Tests: `test/storage/viewStateStore.test.ts`, `test/storage/viewIdentity.test.ts`,
`test/view/viewStatePersistence.test.ts`.
```

- [ ] **Step 6: Run the full gate**

```bash
npm run check
```

Expected: all five pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Rename the collapse state to the view state

The class holds the projection, the zoom, the focus level and six other
preferences. UiStateController is renamed with it: ViewState beside
UiStateController gives two names for one subject one file apart.

Names only."
```

- [ ] **Step 8: Push**

```bash
git push -u origin claude/refactor-collapsestore-hx3bcs
```

---

## Verification

- [ ] `npm run check` passes on the final commit.
- [ ] `grep -rn "collapseStore\|CollapseState\|collapseState" src/ test/` returns nothing.
- [ ] This returns nothing — source paths and test paths alike, since `docs-check.mjs`
      checks both:

```bash
grep -rln "src/storage/collapseStore.ts\|src/view/collapseState.ts\|src/view/uiState.ts\
\|test/storage/collapseStore.test.ts\|test/view/persistence.test.ts\|UiStateController" \
  docs/ | grep -v superpowers
```
- [ ] The four watch-it-fail exercises in Task 2 Step 9 were each run and each went red.

**What this repository cannot check, and must be said in the PR:** Obsidian does not run
here. Base identity rests on an observation about a `.base` leaf presenting as a
`FileView` (ADR 0011), and the key change resets real state in a real vault. `npm run
test-build` bundles into `.obsidian/plugins/product-backlog-view/`; open this repository
as a vault and confirm three things — the view opens at its defaults once, a fold and a
zoom persist across a tab close afterwards, and `product-backlog:collapse` is gone from
the vault's localStorage.
