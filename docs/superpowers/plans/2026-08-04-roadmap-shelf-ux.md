# Roadmap shelf UX & full-width buckets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the roadmap's "Unplaced" shelf a collapse toggle (default collapsed),
always-on type grouping, a display-only sort and a type filter, fix its uneven card
sizing and edge-flush spacing, and make the horizon buckets fill the available width
with a responsive multi-column card grid.

**Architecture:** A new pure domain function (`organizeShelf`) groups/sorts/filters the
shelf's cards; three new fields ride the existing collapse-store per-view entry exactly
like `mode`/`axis`; the shelf's interactive controls become toolbar chrome (a new
`shelfControls.ts`, following the `renderAxisPicker`/`syncCountLabel` precedent) because
the roadmap pane is a `role="listbox"` composite widget that cannot host a `<select>` or
checkboxes; the shelf's card content moves to a new `shelf.ts` and becomes
collapse-aware; two stylesheet changes (a new `shelf.css`, and edits to `roadmap.css`)
deliver the visual fixes and the bucket grid.

**Tech Stack:** TypeScript, Obsidian Bases view API, vitest (jsdom for view/ tests, node
for domain/storage tests), plain CSS partials assembled by `styles-assemble.mjs`.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register)
  must pass before any commit is considered done; run it at the end of every task if
  you have time, and always before the final task.
- 400-line max per `src/` file, enforced by lint. `domain/roadmap.ts` is already at 391
  and `view/render/toolbar.ts` at 387 — new logic goes in new files, not appended there.
- Never write frontmatter outside `storage/frontmatter.ts`; never touch
  `load/saveLocalStorage` outside `storage/`; both are enforced by
  `no-restricted-syntax` in `eslint.config.mjs` and will fail lint if violated.
- UI state (collapse, sort, filter, mode, axis) goes to `storage/collapseStore.ts`'s
  vault-scoped localStorage, never to the `.base` file.
- Sort and the type filter are display-only: nothing they do may ever produce a
  frontmatter write. If you find yourself calling `applySafely`/`applyWrites` from
  anywhere in this feature, stop — that is out of scope and wrong.
- Sentence-case UI text, no special characters in any user-facing string.
- Every module in `src/` must be specified in `docs/` (a use case's `## Where it lives`,
  or an ADR's `## Decision`) — `docs-check.mjs` gates this, and Task 10 is where the two
  new PBI notes get written to satisfy it.
- The jsdom test harness has no layout engine. Any claim about actual rendered widths,
  column counts, or on-screen appearance can only be verified live — say so explicitly
  rather than asserting it from a DOM test, and the final task calls for
  `npm run test-build`.

---

## Task 1: `organizeShelf` — grouping, sorting, filtering the shelf

**Files:**
- Modify: `test/helpers/obsidian-mock.ts` (the mock `TFile` has no `stat` at all yet)
- Modify: `test/helpers/vault.ts` (`AddFileOptions` gains a way to set it)
- Create: `src/domain/shelf.ts`
- Test: `test/domain/shelf.test.ts`

**Interfaces:**
- Consumes: `ShelfCard` from `src/domain/roadmap.ts` (`{ item: BacklogItem; reason: string | null }`), `displayType` from `src/domain/itemTypes.ts`, `ALL_TYPES` from `src/domain/settings.ts`.
- Produces: `export type ShelfSort = 'tree' | 'title' | 'modified'`, `export interface ShelfGroup { type: string; cards: ShelfCard[] }`, `export const OTHER_GROUP = 'Other'`, `export function organizeShelf(cards: ShelfCard[], sort: ShelfSort, hiddenTypes: ReadonlySet<string>): ShelfGroup[]`. Task 6 (`view/render/shelf.ts`) and Task 4 (`view/render/shelfControls.ts`) both import from here.

The `'modified'` sort needs `item.file.stat.mtime`, and the mock `TFile` (`test/CLAUDE.md`:
"extend it when new obsidian API surface is used") has no `stat` property yet at all —
add it before writing a test that would otherwise throw on `undefined.mtime`.

- [ ] **Step 1: Extend the test mocks with `TFile.stat`**

In `test/helpers/obsidian-mock.ts`:

```ts
export class TFile {
	path: string;
	basename: string;
	extension: string;
	parent: { path: string } | null;
	stat: { mtime: number; ctime: number; size: number };

	constructor(path: string, mtime = 0) {
		this.path = path;
		const slash = path.lastIndexOf('/');
		const name = slash === -1 ? path : path.substring(slash + 1);
		const dot = name.lastIndexOf('.');
		this.basename = dot === -1 ? name : name.substring(0, dot);
		this.extension = dot === -1 ? '' : name.substring(dot + 1);
		this.parent = { path: slash === -1 ? '/' : path.substring(0, slash) };
		this.stat = { mtime, ctime: mtime, size: 0 };
	}
}
```

In `test/helpers/vault.ts`, extend `AddFileOptions` and pass it through:

```ts
export interface AddFileOptions {
	frontmatter?: Record<string, unknown>;
	/** Values of the `parent` key rendered as parsed frontmatter links. */
	parentLink?: string;
	/** `file.stat.mtime`, for tests exercising "last modified" ordering. Defaults to 0. */
	mtime?: number;
}
```

```ts
// addFile — change the first line of the body:
addFile(path: string, options: AddFileOptions = {}): TFile {
	const file = new TFile(path, options.mtime ?? 0);
	// ...unchanged below
```

Run: `npx vitest run` (the full suite)
Expected: PASS, unchanged — this is a pure addition (a new constructor parameter with a
default, a new optional field), nothing existing reads or depends on the old two-arg
shape.

- [ ] **Step 2: Write the failing domain tests**

```ts
// test/domain/shelf.test.ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { organizeShelf } from '../../src/domain/shelf';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

function shelfFrom(vault: FakeVault, overrides: Partial<BacklogSettings> = {}) {
	const settings = { ...defaultSettings(), horizonKey: 'horizon', horizonValues: ['Now', 'Next', 'Later'], ...overrides };
	const model = buildModel(vault.app, vault.entries(), settings);
	return buildRoadmap(model, settings, () => true, 'horizons').shelf;
}

function titlesOf(cards: { item: { title: string } }[]): string[] {
	return cards.map((c) => c.item.title);
}

describe('organizing the shelf', () => {
	it('groups by ALL_TYPES order, not input order, with an Other group last', () => {
		const vault = new FakeVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('A Bug.md', { frontmatter: { type: 'Bug', order: 20 } });
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 30 } });
		// A root-level custom type with no parent would normally be pruned by
		// hierarchyOnly (the default) — it matches no declared level or extra type
		// and has nothing to anchor it, so it disables that pruning rather than
		// giving the note a parent it does not need for what this test is about.
		vault.addFile('A Custom.md', { frontmatter: { type: 'Spike', order: 40 } });

		const groups = organizeShelf(shelfFrom(vault, { hierarchyOnly: false }), 'tree', new Set());
		expect(groups.map((g) => g.type)).toEqual(['Epic', 'Task', 'Bug', 'Other']);
	});

	it('omits an empty group entirely rather than rendering it with nothing in it', () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const groups = organizeShelf(shelfFrom(vault), 'tree', new Set());
		expect(groups).toHaveLength(1);
		expect(groups[0].type).toBe('Epic');
	});

	it("omits a hidden type's group whole, and conserves every other card", () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 20 } });
		const shelf = shelfFrom(vault);

		const shown = organizeShelf(shelf, 'tree', new Set());
		expect(shown.flatMap((g) => g.cards)).toHaveLength(shelf.length);

		const filtered = organizeShelf(shelf, 'tree', new Set(['Task']));
		expect(filtered.map((g) => g.type)).toEqual(['Epic']);
		expect(filtered.flatMap((g) => g.cards)).toHaveLength(shelf.length - 1);
	});

	it('sorts within a group by title A to Z, never across groups', () => {
		const vault = new FakeVault();
		vault.addFile('Zed Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('Ann Task.md', { frontmatter: { type: 'Task', order: 20 } });

		const byTitle = organizeShelf(shelfFrom(vault), 'title', new Set());
		expect(titlesOf(byTitle[0].cards)).toEqual(['Ann Task', 'Zed Task']);
	});

	it('sorts within a group by last modified, most recent first', () => {
		const vault = new FakeVault();
		// Declared in the OPPOSITE order from their mtimes, so a test that accidentally
		// fell back to input order (or sorted oldest-first) would still fail.
		vault.addFile('Older Task.md', { frontmatter: { type: 'Task', order: 10 }, mtime: 1000 });
		vault.addFile('Newer Task.md', { frontmatter: { type: 'Task', order: 20 }, mtime: 2000 });

		const byModified = organizeShelf(shelfFrom(vault), 'modified', new Set());
		expect(titlesOf(byModified[0].cards)).toEqual(['Newer Task', 'Older Task']);
	});

	it('groups an untyped child by its inferred level, not into Other', () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped child.md', { frontmatter: { order: 10 }, parentLink: 'An Epic' });
		const shelf = shelfFrom(vault);
		expect(shelf.some((c) => c.item.title === 'Untyped child')).toBe(true);

		const groups = organizeShelf(shelf, 'tree', new Set());
		const featureGroup = groups.find((g) => g.type === 'Feature');
		expect(featureGroup?.cards.map((c) => c.item.title)).toContain('Untyped child');
	});

	it('folds a differently-cased declared type into the one canonical group', () => {
		const vault = new FakeVault();
		vault.addFile('lowercase task.md', { frontmatter: { type: 'task', order: 10 } });
		const groups = organizeShelf(shelfFrom(vault), 'tree', new Set());
		expect(groups.map((g) => g.type)).toEqual(['Task']);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/domain/shelf.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/shelf'`.

- [ ] **Step 4: Write the implementation**

```ts
// src/domain/shelf.ts
import { displayType } from './itemTypes';
import { ALL_TYPES } from './settings';
import { ShelfCard } from './roadmap';

/** Display-only ordering of cards within a group. Never written anywhere. */
export type ShelfSort = 'tree' | 'title' | 'modified';

export interface ShelfGroup {
	type: string;
	cards: ShelfCard[];
}

/** The trailing group for any type `ALL_TYPES` does not name. */
export const OTHER_GROUP = 'Other';

/**
 * The canonical `ALL_TYPES` entry this card's own badge names, or `OTHER_GROUP` when
 * none does. `displayType`, never raw `item.typeName`: an untyped child infers a
 * `levelIndex` from its parent and is badged accordingly, and a declared type's casing
 * on the note is not the casing `ALL_TYPES` spells it with — grouping on the raw field
 * would put both under `Other` despite the card's own badge visibly disagreeing.
 */
function groupKey(card: ShelfCard): string {
	const shown = displayType(card.item).toLowerCase();
	return ALL_TYPES.find((t) => t.toLowerCase() === shown) ?? OTHER_GROUP;
}

function compareCards(sort: ShelfSort, a: ShelfCard, b: ShelfCard): number {
	if (sort === 'title') return a.item.title.localeCompare(b.item.title);
	if (sort === 'modified') return b.item.file.stat.mtime - a.item.file.stat.mtime;
	// 'tree': the input is already sibling order: `roadmap.shelf` keeps it, and a
	// stable sort over an already-ordered array leaves it exactly where it was.
	return 0;
}

/**
 * Group the shelf's cards by the type each one's own badge already shows, in
 * `ALL_TYPES` order plus a trailing `OTHER_GROUP` — never the input order. A group is
 * omitted whole when it is empty or its type is hidden. Within a surviving group, sort
 * orders cards for display only: nothing here is ever written to a note.
 */
export function organizeShelf(cards: ShelfCard[], sort: ShelfSort, hiddenTypes: ReadonlySet<string>): ShelfGroup[] {
	const byType = new Map<string, ShelfCard[]>();
	for (const card of cards) {
		const key = groupKey(card);
		const group = byType.get(key);
		if (group) group.push(card);
		else byType.set(key, [card]);
	}
	const groups: ShelfGroup[] = [];
	for (const type of [...ALL_TYPES, OTHER_GROUP]) {
		if (hiddenTypes.has(type)) continue;
		const groupCards = byType.get(type);
		if (!groupCards || groupCards.length === 0) continue;
		groups.push({ type, cards: [...groupCards].sort((a, b) => compareCards(sort, a, b)) });
	}
	return groups;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/domain/shelf.test.ts`
Expected: PASS (all seven tests).

- [ ] **Step 6: Commit**

```bash
git add test/helpers/obsidian-mock.ts test/helpers/vault.ts src/domain/shelf.ts test/domain/shelf.test.ts
git commit -m "Add organizeShelf: group, sort and filter the shelf by displayed type"
```

---

## Task 2: Persist shelf collapse, sort and type filter in the collapse store

**Files:**
- Modify: `src/storage/collapseStore.ts`
- Test: `test/storage/collapseStore.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CollapseSnapshot` gains `shelfExpanded?: boolean`, `shelfSort?: string | null`, `shelfHiddenTypes?: string[] | null`; `loadCollapseState`/`saveCollapseState` read and write them. Task 3 (`view/collapseState.ts`) is the only other consumer.

- [ ] **Step 1: Write the failing tests**

Append to `test/storage/collapseStore.test.ts` (inside a new `describe`, after the existing `'the persisted view mode'` block — copy its `id`/`none` constants or reuse them if already in scope):

```ts
describe('the shelf working position', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('defaults to collapsed, tree sort, nothing hidden — and needs no entry at all', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();

		const snapshot = loadCollapseState(vault.app, id);
		expect(snapshot.shelfExpanded).toBe(false);
		expect(snapshot.shelfSort).toBeNull();
		expect(snapshot.shelfHiddenTypes).toEqual([]);
	});

	it('round-trips an explicit expand', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, shelfExpanded: true });
		expect(loadCollapseState(vault.app, id).shelfExpanded).toBe(true);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ shelfExpanded: true });
	});

	it('round-trips a non-default sort and the hidden-type list', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, shelfSort: 'title', shelfHiddenTypes: ['Task', 'Bug'] });
		const snapshot = loadCollapseState(vault.app, id);
		expect(snapshot.shelfSort).toBe('title');
		expect(snapshot.shelfHiddenTypes).toEqual(['Task', 'Bug']);
	});

	it('drops a stored sort it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], shelfSort: 'sideways' },
		});
		expect(loadCollapseState(vault.app, id).shelfSort).toBeNull();
	});

	it('drops a stored hidden-types entry that is not an array of strings', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], shelfHiddenTypes: 'Task' },
		});
		expect(loadCollapseState(vault.app, id).shelfHiddenTypes).toEqual([]);
	});
});
```

Check the file's imports already include `STORE_KEY`; if not, add it to the existing
`import { ... } from '../../src/storage/collapseStore'` line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: FAIL — `snapshot.shelfExpanded` etc. are `undefined`, and `TS2339` for
properties that don't exist yet on `CollapseSnapshot` (or a runtime `undefined` mismatch
if TS isn't checked at test time).

- [ ] **Step 3: Implement**

In `src/storage/collapseStore.ts`:

```ts
// Add beside AXIS_VALUES:
/** The values the `shelfSort` field may hold. Mirrors `ShelfSort` in `domain/shelf.ts`. */
const SHELF_SORT_VALUES = ['tree', 'title', 'modified'];
```

```ts
// CollapseSnapshot gains three fields:
export interface CollapseSnapshot {
	collapsed: Set<string>;
	expanded: Set<string>;
	mode?: string | null;
	axis?: string | null;
	/** True only once the user has explicitly expanded the shelf; absent means collapsed, the default. */
	shelfExpanded?: boolean;
	/** Absent or null means 'tree' (sibling order), the default. */
	shelfSort?: string | null;
	/** Types currently hidden by the shelf's own type filter; absent or empty means none. */
	shelfHiddenTypes?: string[] | null;
}
```

```ts
// StoredEntry gains matching optional fields:
interface StoredEntry {
	base: string;
	collapsed: string[];
	expanded: string[];
	mode?: string;
	axis?: string;
	/** Absent means collapsed — the default. Never stored as `true`... wait, stored
	 * as `true` only, since `false` IS the default and needs no entry. */
	shelfExpanded?: boolean;
	/** Absent means 'tree', the default. */
	shelfSort?: string;
	/** Absent or empty means nothing hidden. */
	shelfHiddenTypes?: string[];
}
```

```ts
// loadCollapseState:
export function loadCollapseState(app: App, id: ViewIdentity): CollapseSnapshot {
	const entry = readMap(app)[mapKey(id)];
	return {
		collapsed: new Set(entry?.collapsed ?? []),
		expanded: new Set(entry?.expanded ?? []),
		mode: entry?.mode ?? null,
		axis: entry?.axis ?? null,
		shelfExpanded: entry?.shelfExpanded ?? false,
		shelfSort: entry?.shelfSort ?? null,
		shelfHiddenTypes: entry?.shelfHiddenTypes ?? [],
	};
}
```

```ts
// saveCollapseState:
export function saveCollapseState(app: App, id: ViewIdentity, snapshot: CollapseSnapshot): void {
	const map = readMap(app);
	const key = mapKey(id);
	const collapsed = [...snapshot.collapsed].slice(0, MAX_PATHS);
	const expanded = [...snapshot.expanded].slice(0, MAX_PATHS - collapsed.length);
	const mode = snapshot.mode ?? null;
	const axis = snapshot.axis ?? null;
	const shelfExpanded = snapshot.shelfExpanded ?? false;
	const shelfSort = snapshot.shelfSort ?? null;
	const shelfHiddenTypes = snapshot.shelfHiddenTypes ?? [];
	// A view at its defaults — nothing settled, the tree, no pick, shelf untouched —
	// needs no entry.
	if (
		collapsed.length === 0 &&
		expanded.length === 0 &&
		mode === null &&
		axis === null &&
		!shelfExpanded &&
		shelfSort === null &&
		shelfHiddenTypes.length === 0
	) {
		delete map[key];
	} else {
		map[key] = { base: id.base, collapsed, expanded };
		if (mode !== null) map[key].mode = mode;
		if (axis !== null) map[key].axis = axis;
		if (shelfExpanded) map[key].shelfExpanded = true;
		if (shelfSort !== null) map[key].shelfSort = shelfSort;
		if (shelfHiddenTypes.length > 0) map[key].shelfHiddenTypes = shelfHiddenTypes;
	}
	pruneMissingBases(app, map, key);
	writeMap(app, map);
}
```

```ts
// readEntry — add after the axis line, before the final `return`:
if (typeof record.shelfExpanded === 'boolean' && record.shelfExpanded) entry.shelfExpanded = true;
if (typeof record.shelfSort === 'string' && SHELF_SORT_VALUES.includes(record.shelfSort)) entry.shelfSort = record.shelfSort;
if (Array.isArray(record.shelfHiddenTypes)) {
	const types = record.shelfHiddenTypes.filter((t): t is string => typeof t === 'string' && t.length > 0);
	if (types.length > 0) entry.shelfHiddenTypes = types;
}
```

```ts
// readEntry's final "worth keeping" check — extend the condition:
return entry.collapsed.length > 0 ||
	entry.expanded.length > 0 ||
	entry.mode !== undefined ||
	entry.axis !== undefined ||
	entry.shelfExpanded !== undefined ||
	entry.shelfSort !== undefined ||
	entry.shelfHiddenTypes !== undefined
	? entry
	: null;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: PASS, including every pre-existing test in the file (this task must not
change `mode`/`axis` behavior).

- [ ] **Step 5: Commit**

```bash
git add src/storage/collapseStore.ts test/storage/collapseStore.test.ts
git commit -m "Persist shelf collapse, sort and type filter in the collapse store"
```

---

## Task 3: `CollapseState` accessors and `BacklogViewHost` wiring

**Files:**
- Modify: `src/view/collapseState.ts`
- Modify: `src/view/host.ts`
- Modify: `src/view/backlogView.ts`
- Test: `test/view/persistence.test.ts` (extend)

**Interfaces:**
- Consumes: `ShelfSort` from `src/domain/shelf.ts` (Task 1); `CollapseSnapshot`/`saveCollapseState` fields from Task 2.
- Produces: `CollapseState.shelfCollapsed(): boolean`, `.setShelfCollapsed(boolean): void`, `.shelfSort(): ShelfSort`, `.setShelfSort(ShelfSort): void`, `.shelfHiddenTypes(): ReadonlySet<string>`, `.setShelfHiddenTypes(ReadonlySet<string>): void`. `BacklogViewHost` gains matching `readonly shelfCollapsed: boolean` / `setShelfCollapsed` / `readonly shelfSort: ShelfSort` / `setShelfSort` / `readonly shelfHiddenTypes: ReadonlySet<string>` / `setShelfHiddenTypes`, implemented on `ProductBacklogView`. Tasks 4 and 6 both consume these host members.

Tasks 4 and 6 exercise the setters and getters in memory — they mutate state and check
the same session's render, never closing the view — so neither would notice a wrong
field name inside `restore()` or a field silently dropped from `flush()`'s
`saveCollapseState` call (both fields are optional, so a typo compiles and every other
planned test still passes). Task 2 tests the storage functions directly, underneath
`CollapseState`. The one path nothing drives is `CollapseState` round-tripping through
an actual close and reopen, the same way `test/view/persistence.test.ts` already proves
for `collapsed`/`expanded`/`mode`/`axis` — so this task adds that case for the shelf
fields rather than leaving the gap between Task 2's unit tests and Task 4/6's in-memory
ones unclosed.

- [ ] **Step 1: Extend `CollapseState`**

In `src/view/collapseState.ts`, add the import and three field/accessor groups:

```ts
import { ShelfSort } from '../domain/shelf';
```

```ts
// Alongside `private axis: string | null = null;`:
private shelfExpanded = false;
/** null means 'tree' (sibling order), the default. */
private shelfSortValue: string | null = null;
private hiddenShelfTypes = new Set<string>();
```

```ts
// Alongside setAxisPick, inside the class:

shelfCollapsed(): boolean {
	return !this.shelfExpanded;
}

setShelfCollapsed(collapsed: boolean): void {
	this.shelfExpanded = !collapsed;
	this.scheduleSave();
}

shelfSort(): ShelfSort {
	return (this.shelfSortValue as ShelfSort | null) ?? 'tree';
}

setShelfSort(sort: ShelfSort): void {
	this.shelfSortValue = sort === 'tree' ? null : sort;
	this.scheduleSave();
}

shelfHiddenTypes(): ReadonlySet<string> {
	return this.hiddenShelfTypes;
}

setShelfHiddenTypes(types: ReadonlySet<string>): void {
	this.hiddenShelfTypes = new Set(types);
	this.scheduleSave();
}
```

Update `restore()` (add after `this.axis = snapshot.axis ?? null;`):

```ts
this.shelfExpanded = snapshot.shelfExpanded ?? false;
this.shelfSortValue = snapshot.shelfSort ?? null;
this.hiddenShelfTypes = new Set(snapshot.shelfHiddenTypes ?? []);
```

Update `flush()` — the `saveCollapseState` call gains three fields:

```ts
saveCollapseState(this.host.app, id, {
	collapsed: this.collapsed,
	expanded,
	mode: this.mode,
	axis: this.axis,
	shelfExpanded: this.shelfExpanded,
	shelfSort: this.shelfSortValue,
	shelfHiddenTypes: [...this.hiddenShelfTypes],
});
```

- [ ] **Step 2: Extend `BacklogViewHost`**

In `src/view/host.ts`, add the import:

```ts
import { ShelfSort } from '../domain/shelf';
```

Add after the `axisPick`/`setAxisPick` pair:

```ts
/** Whether the shelf is collapsed for this saved view; collapsed is the default. */
readonly shelfCollapsed: boolean;
/** Toggle the shelf's collapse state and re-render the content pane. */
setShelfCollapsed(collapsed: boolean): void;
/** The shelf's display-only sort pick; 'tree' (sibling order) is the default. */
readonly shelfSort: ShelfSort;
setShelfSort(sort: ShelfSort): void;
/** Types currently hidden from the shelf by its own type filter. */
readonly shelfHiddenTypes: ReadonlySet<string>;
setShelfHiddenTypes(types: ReadonlySet<string>): void;
```

- [ ] **Step 3: Implement on `ProductBacklogView`**

In `src/view/backlogView.ts`, add the import:

```ts
import { ShelfSort } from '../domain/shelf';
```

Add after `setAxisPick` (still inside the class):

```ts
get shelfCollapsed(): boolean {
	return this.collapse.shelfCollapsed();
}

setShelfCollapsed(collapsed: boolean): void {
	if (collapsed === this.shelfCollapsed) return;
	this.collapse.setShelfCollapsed(collapsed);
	// Content only, like setFilter — a full render() would tear down and rebuild
	// the very toolbar control the user just activated, taking their focus with it.
	this.renderTreeContent();
}

get shelfSort(): ShelfSort {
	return this.collapse.shelfSort();
}

setShelfSort(sort: ShelfSort): void {
	if (sort === this.shelfSort) return;
	this.collapse.setShelfSort(sort);
	this.renderTreeContent();
}

get shelfHiddenTypes(): ReadonlySet<string> {
	return this.collapse.shelfHiddenTypes();
}

setShelfHiddenTypes(types: ReadonlySet<string>): void {
	this.collapse.setShelfHiddenTypes(types);
	this.renderTreeContent();
}
```

`renderTreeContent` is `private` on the class; these new methods are members of the same
class, so calling it is legal.

- [ ] **Step 4: Write and run the end-to-end persistence test**

Append to `test/view/persistence.test.ts`, inside the existing `describe('collapse state
persistence', ...)` block:

```ts
it('persists the shelf collapse, sort and type filter across a reopen', () => {
	const vault = fixture();
	const first = makeView(vault, {}, { base: 'Backlog.base' });
	first.view.setShelfCollapsed(false);
	first.view.setShelfSort('title');
	first.view.setShelfHiddenTypes(new Set(['Task']));
	first.view.onunload();

	const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
	expect(second.view.shelfCollapsed).toBe(false);
	expect(second.view.shelfSort).toBe('title');
	expect(second.view.shelfHiddenTypes).toEqual(new Set(['Task']));
});
```

This reads the getters directly rather than the DOM — the shelf has no rendering yet
(that is Task 6), and these three fields are `ProductBacklogView` state regardless of
projection, the same way `mode`/`axis` already are.

Run: `npx vitest run test/view/persistence.test.ts`
Expected: PASS. If it fails, the mismatch is between what `flush()` saves and what
`restore()` reads back for one of the three fields — check both against Task 2's
`CollapseSnapshot` field names before assuming the test is wrong.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`shelf.ts` from Task 1 must already exist for this to resolve
`ShelfSort`.)

- [ ] **Step 6: Commit**

```bash
git add src/view/collapseState.ts src/view/host.ts src/view/backlogView.ts test/view/persistence.test.ts
git commit -m "Wire shelf collapse/sort/filter through CollapseState and BacklogViewHost"
```

---

## Task 4: Shelf toolbar controls — build

**Files:**
- Create: `src/view/render/shelfControls.ts`
- Modify: `src/view/render/toolbar.ts`
- Test: `test/view/shelfUx.test.ts` (new file)

**Interfaces:**
- Consumes: `BacklogViewHost` (Task 3's new members), `organizeShelf`/`ShelfSort` (Task 1).
- Produces: `export function renderShelfControls(host: BacklogViewHost, barEl: HTMLElement): void`, called from `renderToolbar`. `export function syncShelfControls(host: BacklogViewHost, barEl: HTMLElement): void` is ALSO defined here but wired in Task 5 — write it now, since the two functions share the DOM class names and are easiest to get right together, but its call site is Task 5's job.

`toolbar.ts` is at 387 of its 400-line budget: add only the one new function call, not
the control-building logic itself.

- [ ] **Step 1: Write the failing test**

```ts
// test/view/shelfUx.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap } from '../helpers/roadmap';
import { useViewHarness } from '../helpers/view';

useViewHarness();

function shelfControlsOf(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-shelf-controls');
}

describe('the shelf toolbar controls', () => {
	it('exist in the toolbar, not inside the roadmap listbox, on the very first render', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const controls = shelfControlsOf(containerEl);
		expect(controls).not.toBeNull();
		expect(containerEl.querySelector('.pbl-toolbar')?.contains(controls)).toBe(true);
		expect(containerEl.querySelector('[role="listbox"]')?.contains(controls)).toBe(false);
	});

	it('renders nothing in the toolbar outside roadmap mode', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		expect(shelfControlsOf(containerEl)).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: FAIL — `.pbl-shelf-controls` is never rendered.

- [ ] **Step 3: Implement `renderShelfControls` and `syncShelfControls`**

```ts
// src/view/render/shelfControls.ts
import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { organizeShelf, ShelfSort } from '../../domain/shelf';
import { SHELF_LABEL } from '../../domain/roadmap';

const SORT_OPTIONS: { value: ShelfSort; label: string }[] = [
	{ value: 'tree', label: 'Sibling order' },
	{ value: 'title', label: 'Title (A to Z)' },
	{ value: 'modified', label: 'Last modified' },
];

/**
 * The shelf's interactive chrome — collapse toggle, sort picker, type filter — built
 * as toolbar chrome, a sibling of `.pbl-tree`, never a descendant: the roadmap pane
 * carries `role="listbox"` while any cards render, a one-tab-stop composite widget
 * whose own controls are `tabindex="-1"` buttons with no room for a `<select>` or
 * checkboxes. Structure only: `host.roadmap` is not current yet at the point
 * `renderToolbar` runs (see `syncShelfControls`, called after content renders), so
 * nothing here reads live shelf data.
 */
export function renderShelfControls(host: BacklogViewHost, barEl: HTMLElement): void {
	if (host.projection !== 'roadmap') return;
	const wrap = barEl.createDiv({ cls: 'pbl-shelf-controls', attr: { role: 'group', 'aria-label': SHELF_LABEL } });

	const collapseBtn = wrap.createEl('button', {
		cls: 'pbl-shelf-collapse-btn clickable-icon',
		attr: { type: 'button' },
	});
	collapseBtn.createSpan({ cls: 'pbl-shelf-collapse-icon' });
	collapseBtn.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	// A dedicated span, not text baked only into the aria-label: a sighted user reads
	// this, a screen-reader user reads the aria-label below — the same fact, two
	// modalities, same reason a tooltip and an aria-label both exist elsewhere here.
	collapseBtn.createSpan({ cls: 'pbl-shelf-count' });
	collapseBtn.addEventListener('click', () => host.setShelfCollapsed(!host.shelfCollapsed));

	const sortSelect = wrap.createEl('select', { cls: 'pbl-shelf-sort', attr: { 'aria-label': 'Sort the shelf' } });
	for (const { value, label } of SORT_OPTIONS) sortSelect.createEl('option', { value, text: label });
	sortSelect.addEventListener('change', () => host.setShelfSort(sortSelect.value as ShelfSort));

	wrap.createDiv({ cls: 'pbl-shelf-type-filter' });
}

/**
 * Fill in what `renderShelfControls` could not know yet — the shelf's real population,
 * which control values are current, and which types have cards to filter. Called after
 * every content render (`syncCountLabel`'s own timing), so it runs on the plain filter
 * path too, not only on a full render.
 */
export function syncShelfControls(host: BacklogViewHost, barEl: HTMLElement): void {
	const wrap = barEl.querySelector<HTMLElement>('.pbl-shelf-controls');
	if (!wrap) return;
	const shelf = host.roadmap?.roadmap.shelf ?? [];
	wrap.toggleClass('pbl-shelf-controls-empty', shelf.length === 0);
	if (shelf.length === 0) return;

	const collapsed = host.shelfCollapsed;
	const collapseBtn = wrap.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
	if (collapseBtn) {
		const icon = collapseBtn.querySelector<HTMLElement>('.pbl-shelf-collapse-icon');
		if (icon) setIcon(icon, collapsed ? 'chevron-right' : 'chevron-down');
		const count = collapseBtn.querySelector<HTMLElement>('.pbl-shelf-count');
		if (count) count.setText(String(shelf.length));
		const label = `${SHELF_LABEL} (${shelf.length})`;
		const action = collapsed ? `Expand ${label}` : `Collapse ${label}`;
		// The button's own accessible name carries the toggle-state fact via
		// aria-expanded, not just the count: an icon and a text label are both
		// sighted-only, and without this attribute a screen-reader user at this
		// button cannot tell a collapsed shelf from an expanded one.
		collapseBtn.setAttribute('aria-label', action);
		collapseBtn.setAttribute('aria-expanded', String(!collapsed));
		setTooltip(collapseBtn, action);
	}

	const sortSelect = wrap.querySelector<HTMLSelectElement>('.pbl-shelf-sort');
	if (sortSelect && sortSelect.value !== host.shelfSort) sortSelect.value = host.shelfSort;

	const filterEl = wrap.querySelector<HTMLElement>('.pbl-shelf-type-filter');
	if (!filterEl) return;
	// Rebuilding the chips would destroy whichever one the user just activated,
	// taking its focus with it — the same problem the toolbar rebuild has, one level
	// deeper. `group.type` is a stable identifier across a rebuild where the DOM node
	// is not, so capture which type currently holds focus (if any) and hand it back
	// to the freshly-built checkbox for that same type below. `document.activeElement`
	// plus `contains`/`closest`, not a `:focus` selector — no dependency on how
	// thoroughly the test environment's selector engine matches live focus state.
	const active = document.activeElement;
	const focusedType =
		active instanceof HTMLElement && filterEl.contains(active)
			? active.closest<HTMLElement>('.pbl-shelf-type-chip')?.dataset.shelfType
			: undefined;
	filterEl.empty();
	for (const group of organizeShelf(shelf, 'tree', new Set())) {
		const chip = filterEl.createEl('label', {
			cls: 'pbl-shelf-type-chip',
			attr: { 'data-shelf-type': group.type },
		});
		const checkbox = chip.createEl('input', { type: 'checkbox' });
		checkbox.checked = !host.shelfHiddenTypes.has(group.type);
		checkbox.addEventListener('change', () => {
			const hidden = new Set(host.shelfHiddenTypes);
			if (checkbox.checked) hidden.delete(group.type);
			else hidden.add(group.type);
			host.setShelfHiddenTypes(hidden);
		});
		chip.createSpan({ text: `${group.type} (${group.cards.length})` });
		if (group.type === focusedType) checkbox.focus();
	}
}
```

In `src/view/render/toolbar.ts`, add the import and one call:

```ts
import { renderShelfControls } from './shelfControls';
```

```ts
	renderFocusPicker(host, barEl, model);
	renderModeToggle(host, barEl);
	renderAxisPicker(host, barEl);
	renderShelfControls(host, barEl);
```

(Insert `renderShelfControls(host, barEl);` right after the existing `renderAxisPicker` call.)

The count moving out of `.pbl-shelf` (it now lives on the toolbar's collapse button,
`.pbl-shelf-count`, above) means `test/helpers/roadmap.ts`'s `shelfCountOf` — currently
searching inside `shelfOf(containerEl)` — will eventually need to widen to the whole
container. That change is deliberately NOT made here: at this point in the plan,
`renderShelfControls` has built an EMPTY `.pbl-shelf-count` span (its text is filled in
only by `syncShelfControls`, whose call site is Task 5's job), while the OLD in-tree
shelf still renders its own populated one — the toolbar comes first in DOM order, so a
widened `querySelector` here would silently return the empty span and break
`test/view/roadmapFrame.test.ts:354`'s existing `shelfCountOf` assertion. Task 5 is where
this widening actually belongs, once `syncShelfControls` is wired and the toolbar's span
carries the real count too. Leave `test/helpers/roadmap.ts` untouched by this task.

- [ ] **Step 4: Run the shelf UX test to verify it passes**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: PASS (both tests). The controls exist but show nothing useful yet (no shelf
data synced) — that is the next task.

- [ ] **Step 5: Commit**

```bash
git add src/view/render/shelfControls.ts src/view/render/toolbar.ts test/view/shelfUx.test.ts
git commit -m "Add the shelf's toolbar controls: collapse toggle, sort, type filter"
```

---

## Task 5: Sync the shelf controls after every content render

**Files:**
- Modify: `src/view/backlogView.ts`
- Modify: `test/helpers/roadmap.ts` (repoint `shelfCountOf` at the toolbar)
- Test: `test/view/shelfUx.test.ts` (extend)

**Interfaces:**
- Consumes: `syncShelfControls` from Task 4's `shelfControls.ts`.
- Produces: nothing new — this task only wires an existing function into the render lifecycle.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/shelfUx.test.ts` (add `titlesOf`... actually add what's needed):

```ts
import { rows, titlesOf } from '../helpers/view'; // add to the existing import line if not already imported
```

Actually, add these test cases inside the existing `describe` block:

```ts
	it('hides the cluster once a filter empties the shelf, without a full toolbar rebuild', () => {
		const vault = horizonVault();
		const { containerEl, view } = makeRoadmap(vault);
		expect(shelfControlsOf(containerEl)).not.toBeNull();
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);

		// "Untriaged" is the shelf's only card; filter it out entirely.
		view.setFilter('nonexistent-search-term');
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(true);

		view.setFilter('');
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);
	});

	it('shows the real shelf count once content has rendered', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(shelfCountOf(containerEl)).toBe('1');
	});

	it('marks the collapse toggle accessibly, and flips it when toggled', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const collapseBtn = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Expand');

		view.setShelfCollapsed(false);
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Collapse');
	});

	it('never rebuilds the rest of the toolbar when a shelf control changes', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const modeBtn = containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]');
		expect(modeBtn).not.toBeNull();

		// A full render() would tear down and rebuild the whole toolbar, replacing
		// this element — the same DOM node before and after is the proof it didn't.
		view.setShelfCollapsed(false);
		view.setShelfSort('title');
		view.setShelfHiddenTypes(new Set(['Task']));

		expect(containerEl.querySelector('.pbl-mode-btn[aria-label="Show as roadmap"]')).toBe(modeBtn);
	});

	it('keeps focus on the type-filter checkbox that was just toggled, not merely the rest of the toolbar', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl } = makeRoadmap(vault);
		const taskCheckbox = containerEl.querySelector<HTMLInputElement>(
			'.pbl-shelf-type-chip[data-shelf-type="Task"] input',
		);
		expect(taskCheckbox).not.toBeNull();
		taskCheckbox?.focus();

		// The `change` handler calls setShelfHiddenTypes, which re-renders the content
		// pane and rebuilds every chip from scratch — the very node holding focus
		// right now does not survive that. What must survive is focus landing on
		// WHATEVER checkbox now represents "Task", even though it is a new DOM node.
		taskCheckbox!.checked = false;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));

		const rebuiltCheckbox = containerEl.querySelector<HTMLInputElement>(
			'.pbl-shelf-type-chip[data-shelf-type="Task"] input',
		);
		expect(rebuiltCheckbox).not.toBeNull();
		expect(rebuiltCheckbox).not.toBe(taskCheckbox);
		expect(document.activeElement).toBe(rebuiltCheckbox);
	});
```

`shelfCountOf` comes from `test/helpers/roadmap.ts`, but still searches inside
`shelfOf(containerEl)` at this point — Task 4 deliberately left it there (see its own
Step 4). Widen it now, alongside these tests, so the "shows the real shelf count" test
below fails for the right reason at Step 2 (an empty toolbar span, not a stale read of
the old in-tree shelf that still has a real one until Task 6 removes it):

```ts
// test/helpers/roadmap.ts — replace the existing shelfCountOf:
export function shelfCountOf(containerEl: HTMLElement): string {
	return containerEl.querySelector('.pbl-shelf-count')?.textContent ?? '';
}
```

Add `shelfCountOf` to this file's import from `../helpers/roadmap` if it is not already
imported.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: FAIL on the filter-visibility, count, and aria-expanded/aria-label
assertions — `syncShelfControls` exists (Task 4) but nothing calls it yet, so the
cluster's class and the collapse button's attributes never update past their
just-built state. The "never rebuilds the rest of the toolbar" test may already PASS at
this point — Task 3's setters call `renderTreeContent()`, never `render()`, from the
moment they were written — and that is fine: it stands as a regression guard for this
step and every step after, not a behavior this step introduces.

- [ ] **Step 3: Wire the sync call**

In `src/view/backlogView.ts`, add the import:

```ts
import { syncShelfControls } from './render/shelfControls';
```

In `renderTreeContent()`, add the call right after `syncCountLabel(this, this.toolbarEl);`:

```ts
		syncCountLabel(this, this.toolbarEl);
		syncShelfControls(this, this.toolbarEl);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: PASS (all seven tests so far).

- [ ] **Step 5: Commit**

```bash
git add src/view/backlogView.ts test/view/shelfUx.test.ts test/helpers/roadmap.ts
git commit -m "Sync the shelf toolbar controls after every content render"
```

---

## Task 6: Shelf card content, collapse-aware — `shelf.ts`

**Files:**
- Create: `src/view/render/shelf.ts`
- Modify: `src/view/render/roadmap.ts`
- Test: `test/helpers/roadmap.ts` (extend), `test/view/shelfUx.test.ts` (extend)

**Interfaces:**
- Consumes: `organizeShelf` (Task 1), `host.shelfCollapsed`/`shelfSort`/`shelfHiddenTypes` (Task 3), `createCard`/`renderCardBody`/`wireCardActivation` from `./board` (unchanged).
- Produces: `export function renderShelf(ctx: RowContext, frameEl: HTMLElement, shelf: ShelfCard[], dnd: CardDragController | null): BacklogItem[]`, `export function renderContextStrip(ctx: RowContext, frameEl: HTMLElement, context: BacklogItem[]): BacklogItem[]` — both consumed by `renderRoadmap` in `roadmap.ts`.

This is the task that fixes the collapse/keyboard-walk invariant and the advisory-gate
regression, both found during design review — write their tests FIRST, watch them fail
against the OLD `roadmap.ts` behavior (comment out nothing; the old code simply doesn't
have collapse yet, so these fail for "collapse does nothing" reasons), then make them
pass by moving the code.

- [ ] **Step 1: Add helpers to `test/helpers/roadmap.ts`**

This step is also what keeps every EARLIER roadmap test passing once this task makes
`renderShelf` collapse-aware: `test/view/roadmapMoves.test.ts`, `test/view/roadmap.test.ts`,
`test/view/roadmapFrame.test.ts` and `test/view/cardDrag.test.ts` all pre-date the
collapsed-by-default shelf and assert on shelf cards (`shelfTitles`,
`cardByTitle(..., 'Untriaged' | 'Garbled' | 'Bare')`) being visible immediately — none of
them expand the shelf first, because there was nothing to expand when they were written.
Two of the four (`roadmapMoves.test.ts`, `cardDrag.test.ts`) go through the shared
`makeRoadmap` helper below and need no per-file change at all; the other two do not (see
after the helper), and get their own one-line fix instead of a rewrite:

```ts
export function shelfGroupHeaders(containerEl: HTMLElement): string[] {
	return Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-shelf-group-name') ?? []).map(
		(h) => h.textContent ?? '',
	);
}
```

Replace the existing `makeRoadmap`:

```ts
/**
 * A view already showing the roadmap. The mode is UI state, not a base setting, so
 * it is flipped through the host exactly as the toolbar does — never the config.
 * The shelf itself opens collapsed by default (Task 3) — expanded here unless the
 * caller passes `shelfCollapsed: true` to assert on the collapsed state itself, the
 * same escape hatch `makeView`'s `collapsed` param gives the tree.
 */
export function makeRoadmap(
	vault: FakeVault,
	extra: Record<string, unknown> = {},
	{ shelfCollapsed = false }: { shelfCollapsed?: boolean } = {},
): Harness {
	const harness = makeView(vault, { ...HORIZON_AXIS, ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	if (!shelfCollapsed) harness.view.setShelfCollapsed(false);
	return harness;
}
```

Every call site that goes THROUGH this helper (`roadmapMoves.test.ts`, `cardDrag.test.ts`)
needs no change — they get the auto-expanded shelf they already assumed. Only tests that
mean to exercise the TRUE collapsed-by-default state pass `{ shelfCollapsed: true }`
explicitly, in the new tests below and in Task 7's drop-target test.

`roadmap.test.ts` and `roadmapFrame.test.ts` do NOT go through this helper — each defines
its own local `roadmapView()` that calls `makeView` directly and never imports
`makeRoadmap` at all, so fixing only `test/helpers/roadmap.ts` leaves both files' shelf
assertions (and, in `roadmap.test.ts`, one keyboard-walk test that reaches the shelf's
card by arrow key — collapsed cards are excluded from that walk once this task lands)
seeing a collapsed shelf. Add the identical one-line fix to both local helpers:

In `test/view/roadmap.test.ts`:

```ts
function roadmapView(vault: FakeVault, cfg: Record<string, unknown> = { ...AXES }, opts: { base?: string } = {}) {
	const harness = makeView(vault, cfg, { collapsed: true, ...opts });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
	return harness;
}
```

In `test/view/roadmapFrame.test.ts`:

```ts
function roadmapView(vault: FakeVault, cfg: Record<string, unknown>, opts: { base?: string } = {}) {
	const harness = makeView(vault, cfg, { collapsed: true, ...opts });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
	return harness;
}
```

Two more spots in `test/view/roadmap.test.ts` bypass EVERY helper, calling `makeView` and
`setProjection('roadmap')` inline and asserting `shelfTitles` right after — add the same
call to each:

```ts
it('switches on the model already in hand — same results, no re-query, no writes', () => {
	const vault = roadmapVault();
	const { view, containerEl } = makeView(vault, { ...AXES }, { collapsed: true });
	const before = view.model;

	view.setProjection('roadmap');
	view.setShelfCollapsed(false);
	expect(view.model).toBe(before);
	// ...unchanged from here.
```

```ts
it('carries the quick filter across the switch — session state in all three projections', () => {
	const vault = roadmapVault();
	const { view, containerEl } = makeView(vault, { ...AXES }, { collapsed: true });
	view.setFilter('Untriaged');

	view.setProjection('roadmap');
	view.setShelfCollapsed(false);
	expect(view.filterText).toBe('Untriaged');
	// ...unchanged from here.
```

One EARLIER test needs the same treatment retroactively: Task 5's "marks the collapse
toggle accessibly, and flips it when toggled" asserted `aria-expanded="false"` on first
render, which was correct against the two-argument `makeRoadmap` in place when that task
was written — this task's new default changes what "first render" means for every caller.
Update that test now, in `test/view/shelfUx.test.ts`:

```ts
it('marks the collapse toggle accessibly, and flips it when toggled', () => {
	const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
	const collapseBtn = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
	// ...unchanged from here.
```

- [ ] **Step 2: Write the failing tests**

Append to `test/view/shelfUx.test.ts`:

```ts
import { key } from '../helpers/view'; // add to the existing view-helpers import line
import { shelfCountOf, shelfGroupHeaders, shelfOf, shelfTitles } from '../helpers/roadmap';
```

```ts
describe('the shelf, collapsed by default', () => {
	it('renders nothing inside the tree until expanded, but stays a drop target', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		expect(shelfTitles(containerEl)).toEqual([]);
		expect(shelfOf(containerEl)).not.toBeNull();

		view.setShelfCollapsed(false);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
	});

	it('keeps a visible label on the collapsed drop target — a user mid-drag is looking at it, not the toolbar', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const shelf = shelfOf(containerEl);
		expect(shelf?.querySelector('.pbl-shelf-name')?.textContent).toBe('Unplaced');
	});

	it('groups the expanded shelf by type, in a fixed order', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('changes display order within a group via the sort control, without touching group order', () => {
		const vault = new FakeVault();
		vault.addFile('Zed Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('Ann Task.md', { frontmatter: { type: 'Task', order: 20 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		// Tree/sibling order is the default: the order the notes were declared in.
		expect(shelfTitles(containerEl)).toEqual(['Zed Task', 'Ann Task']);

		view.setShelfSort('title');
		expect(shelfTitles(containerEl)).toEqual(['Ann Task', 'Zed Task']);
	});

	it('hides a whole type group via the type filter, while the shelf count stays the true total', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		view.setShelfCollapsed(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfCountOf(containerEl)).toBe('2');

		view.setShelfHiddenTypes(new Set(['Task']));
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
		// Both shelved items still count — the filter only changes what is displayed.
		expect(shelfCountOf(containerEl)).toBe('2');
	});

	it('excludes collapsed shelf cards from Arrow/End keyboard navigation', () => {
		const { containerEl, view } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
		const tree = containerEl.querySelector<HTMLElement>('.pbl-tree');
		expect(tree?.getAttribute('role')).toBe('listbox'); // Now/Later buckets still have cards
		expect(view.selectedPath).toBeNull();

		key(tree as HTMLElement, 'End');
		// The shelf's one card ("Untriaged") is collapsed and must never be reachable —
		// the walk lands on the last AXIS card instead.
		expect(view.selectedPath).toBe('Later item.md');
		expect(view.selectedPath).not.toBe('Untriaged.md');
	});

	it('renders no advisory when everything is shelved and collapsed', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
		// The design's own requirement, not just "no advisory": a pane with nothing
		// keyboard-reachable must not keep announcing itself as a listbox with options.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
	});

	it('renders no advisory when the only visible card is a context row already placed in a bucket', () => {
		// Mirrors test/domain/roadmap.test.ts's "an excluded focus-level item sits in a
		// bucket that already exists, uncounted": placedCount, shelf and context are ALL
		// zero here, yet a card IS on screen (the Epic, as a context row inside 'Now') —
		// exactly the case the axisCardCount term exists to catch, since none of
		// placedCount/shelf.length/context.length would count it.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'now' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ horizonProperty: 'note.horizon', focusLevel: 'Epic' });
		// The Base returns only the feature; the Epic surfaces purely as context, the
		// same shape the domain fixture's own vault.entries().filter(...) sets up.
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		view.setProjection('roadmap');

		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});
});
```

Add to the imports at the top of the file: `ProductBacklogView` from `'../../src/view/backlogView'`, `FakeViewConfig` from `'../helpers/vault'` (alongside the existing `FakeVault` import).

Add `FakeVault` to the imports at the top of the file if not already present:
`import { FakeVault } from '../helpers/vault';`

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: FAIL on the first three tests — `setShelfCollapsed` exists (Task 3) but
`renderRoadmap` doesn't consult it yet, so the shelf still renders its cards
regardless.

Both "renders no advisory" tests ALREADY PASS at this point, each for a reason that has
nothing to do with the fix. The shelved-and-collapsed one: the old, not-yet-collapse-aware
`renderShelf` still includes `Untriaged` in `cards` unconditionally, so `cards.length` is
already `1` and the old `renderRoadmapAdvisory` gate (`renderedCards > 0`) already
suppresses the advisory — the same shape as `1b` for "not really at 0". The context-in-a-
bucket one: the Epic's bucket card is pushed onto `cards` before the shelf/context ever
render, so `cards.length` is already `1` regardless of which formula gates the advisory —
this one stays true even after Step 4 lands, which is exactly why Step 5.5 below reverts
to `cards.length` for the OTHER test rather than this one; a formula bug this test is
meant to catch (summing `placedCount`/`shelf.length`/`context.length` instead of
capturing the axis's own rendered count) would need its OWN revert to demonstrate, not
one this task performs — see the spec's own note on why the axis count is captured
before the shelf renders. Neither test passing early is a gap to chase here: each stands
as a regression guard for the state Step 4 produces, the same way the toolbar-identity
test in an earlier task was already true before its own fix landed.

- [ ] **Step 4: Implement `shelf.ts`, then update `roadmap.ts`**

```ts
// src/view/render/shelf.ts
import { setIcon, setTooltip } from 'obsidian';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { CardDragController } from '../interactions/cardDrag';
import { BacklogItem } from '../../domain/model';
import { SHELF_LABEL, ShelfCard } from '../../domain/roadmap';
import { organizeShelf } from '../../domain/shelf';

/**
 * Everything the axis could not place, grouped by type, sorted within each group,
 * filtered by type — all three display-only, never written. Collapsing contributes
 * zero cards, exactly as an empty shelf already did, so the caller's keyboard-walk
 * array and the pane's listbox/region role stay correct with no extra logic for
 * either case. `dnd` non-null is what keeps an EMPTY shelf on the page too — the
 * shelf is the target that un-places, and a target reachable only while occupied is
 * one nothing can ever reach. Collapsing is a view convenience and never gates the
 * drop target: it is wired before the collapsed check below, not after.
 *
 * The static icon-plus-name header renders unconditionally — collapsed, expanded, or
 * empty — because it is the ONE label a user sees while their attention and cursor
 * are actually over the shelf mid-drag; the toolbar's own collapse button carries the
 * interactive count and expand/collapse state, but it is not itself droppable and is
 * not where a dragging user is looking. Removing this label when collapsed would leave
 * an unlabeled empty strip as the drop target, which is a real regression, not the
 * "repeated information" this design otherwise avoids — the toolbar owns the
 * INTERACTIVE controls, this owns identifying the target itself.
 */
export function renderShelf(
	ctx: RowContext,
	frameEl: HTMLElement,
	shelf: ShelfCard[],
	dnd: CardDragController | null,
): BacklogItem[] {
	const host = ctx.host;
	const empty = shelf.length === 0;
	if (empty && !dnd) return [];
	const collapsed = !empty && host.shelfCollapsed;
	const shelfEl = frameEl.createDiv({
		cls: ['pbl-shelf', empty && 'pbl-shelf-empty', collapsed && 'pbl-shelf-collapsed'].filter(Boolean).join(' '),
		attr: { role: 'group', 'aria-label': `${SHELF_LABEL}, ${shelf.length} item${shelf.length === 1 ? '' : 's'}` },
	});
	setTooltip(
		shelfEl,
		dnd
			? 'Results this axis cannot place — dropping a card here removes its horizon'
			: 'Results this axis cannot place — no placement on their own notes yet',
	);
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	header.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	dnd?.wireDropTarget(shelfEl, (item) => void ctx.host.performHorizonMove(item, null));
	if (empty || collapsed) return [];

	const cards: BacklogItem[] = [];
	for (const group of organizeShelf(shelf, host.shelfSort, host.shelfHiddenTypes)) {
		const groupEl = shelfEl.createDiv({ cls: 'pbl-shelf-group' });
		const header = groupEl.createDiv({ cls: 'pbl-shelf-group-header' });
		header.createSpan({ cls: 'pbl-shelf-group-name', text: group.type });
		header.createSpan({ cls: 'pbl-shelf-group-count', text: String(group.cards.length) });
		const cardsEl = groupEl.createDiv({ cls: 'pbl-shelf-cards' });
		for (const entry of group.cards) {
			const card = createCard(ctx, cardsEl, entry.item);
			renderCardBody(ctx, card, entry.item);
			// Unreadable is unplaced, and the card says why rather than rendering
			// somewhere a guess put it.
			if (entry.reason !== null) {
				const reason = card.createDiv({ cls: 'pbl-shelf-reason' });
				setIcon(reason.createSpan({ cls: 'pbl-shelf-reason-icon' }), 'alert-triangle');
				reason.createSpan({ text: entry.reason });
			}
			wireCardActivation(ctx, card, entry.item);
			dnd?.wireCard(card, entry.item);
			cards.push(entry.item);
		}
	}
	return cards;
}

/**
 * Context rows with no place on the axis — a focused item outside the filter whose
 * value names no existing bucket, or whose own dates never place it. Never grouped,
 * sorted or filtered: the context-row rule (never a ranking peer, never a source of
 * anything derived from the results) applies here exactly as everywhere else.
 */
export function renderContextStrip(ctx: RowContext, frameEl: HTMLElement, context: BacklogItem[]): BacklogItem[] {
	if (context.length === 0) return [];
	const stripEl = frameEl.createDiv({ cls: 'pbl-roadmap-context', attr: { role: 'group', 'aria-label': 'Context' } });
	const header = stripEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'corner-left-down');
	header.createSpan({ cls: 'pbl-shelf-name', text: 'Context' });
	setTooltip(header, "Not in this base's filter — shown for the hierarchy, never counted");
	const cardsEl = stripEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const item of context) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
	}
	return context;
}
```

Now edit `src/view/render/roadmap.ts`:

1. Replace the import line:

```ts
import { buildRoadmap, HorizonBucket, RoadmapAxis, SHELF_LABEL, ShelfCard } from '../../domain/roadmap';
```

with:

```ts
import { buildRoadmap, HorizonBucket, RoadmapAxis } from '../../domain/roadmap';
import { renderContextStrip, renderShelf } from './shelf';
```

(`SHELF_LABEL`/`ShelfCard` are no longer used directly in `roadmap.ts` — they move with
the functions that used them.)

2. Delete the entire `renderShelf` function body (the one currently at lines 154-196,
   doc comment included) and the entire `renderContextStrip` function body (lines
   204-218, doc comment included) — both now live in `shelf.ts`.

3. Update `renderRoadmap` to capture the axis's own card count before the shelf/context
   push onto `cards`, and pass the corrected population to the advisory:

```ts
export function renderRoadmap(
	ctx: RowContext,
	treeEl: HTMLElement,
	axis: RoadmapAxis,
	today: CivilDate,
	dnd: CardDragController,
): RoadmapSnapshot {
	const host = ctx.host;
	const model = host.model;
	if (!model) return { roadmap: { axis, buckets: [], bars: [], shelf: [], context: [], placedCount: 0 }, cards: [], todayLeft: null };
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	const placing = axis === 'horizons' ? dnd : null;
	if (placing) {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, placing));
		placing.wireScroller(treeEl);
	} else {
		const timeline = renderTimeline(ctx, frameEl, roadmap.bars, today);
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
	}
	// Captured before the shelf renders: collapsing the shelf changes ITS contribution
	// to `cards` (see `renderShelf`), never the axis's own — this is the true "does the
	// roadmap have anything to show" count, including context cards already placed in
	// a bucket, which no domain-model counter answers on its own.
	const axisCardCount = cards.length;
	cards.push(...renderShelf(ctx, frameEl, roadmap.shelf, placing));
	cards.push(...renderContextStrip(ctx, frameEl, roadmap.context));
	renderRoadmapAdvisory(ctx, frameEl, axisCardCount + roadmap.shelf.length + roadmap.context.length);
	return { roadmap, cards, todayLeft };
}
```

4. Update `renderRoadmapAdvisory`'s signature and doc comment:

```ts
/**
 * Why the roadmap has no cards, said beside the frame rather than instead of it — the
 * board's advisory rule. Gated on the roadmap's actual population — the axis's own
 * cards (results and any context card already placed in a bucket), the shelf's real
 * count and the standalone context strip's count — never on how many are currently
 * keyboard-reachable: a collapsed shelf legitimately contributes zero cards to that
 * walk, and an all-shelved, collapsed backlog is not empty, it is a backlog not yet
 * planned.
 */
function renderRoadmapAdvisory(ctx: RowContext, frameEl: HTMLElement, population: number): void {
	const host = ctx.host;
	const model = host.model;
	if (!model || population > 0) return;
	const aside = frameEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside);
	else renderAllDoneState(host, aside, model.results.length);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/shelfUx.test.ts test/view/roadmapFrame.test.ts test/domain/roadmap.test.ts`
Expected: PASS. `roadmapFrame.test.ts` and `roadmap.test.ts` must still pass unchanged —
this task moves code, it does not change the shelf's placement/reason/count behavior.

- [ ] **Step 5.5: Watch the "renders no advisory" test fail — it never went red on its
  own, so CLAUDE.md's watched-failing rule applies here exactly as it does in Task 7**

Step 3 already noted this test passes before the fix for an unrelated reason (the old
`renderShelf` still counted the shelf's card). It has never been observed failing for
the RIGHT reason — that the new population formula, not `cards.length`, is what keeps it
correct. In `src/view/render/roadmap.ts`, temporarily revert the advisory call to the old
argument:

```ts
renderRoadmapAdvisory(ctx, frameEl, cards.length);
```

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: FAIL — with the shelf collapsed and holding the only item, `cards.length` is
now `0` (the collapsed shelf contributes nothing to `cards`), so the advisory renders
where the test expects none. Seeing this red is the proof the fix (and the test) are
doing real work. Restore the corrected line
(`renderRoadmapAdvisory(ctx, frameEl, axisCardCount + roadmap.shelf.length + roadmap.context.length);`)
and re-run to confirm PASS before moving on.

- [ ] **Step 6: Run the full suite once**

Run: `npx vitest run`
Expected: PASS. This is the first point where a regression in `renderShelf`'s move would
show up broadly (e.g. `test/view/contextRowWrites.test.ts`, `test/view/roadmapMoves.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/view/render/shelf.ts src/view/render/roadmap.ts test/helpers/roadmap.ts test/view/shelfUx.test.ts test/view/roadmap.test.ts test/view/roadmapFrame.test.ts
git commit -m "Move shelf/context rendering to shelf.ts; make collapse keyboard- and advisory-safe"
```

`roadmap.test.ts` and `roadmapFrame.test.ts` are in this list because Step 1 above already
edited them (the local `roadmapView()` auto-expand fix, plus the two raw call sites) —
without staging them here, the fix exists on disk but never reaches the pushed commit,
and CI sees the two files exactly as collapse-by-default breaks them.

---

## Task 7: The collapsed-shelf-stays-a-drop-target invariant test

**Files:**
- Test: `test/view/shelfUx.test.ts` (extend)

This is the invariant the design called out by name — its own test, modeled on how
`test/view/contextRowWrites.test.ts` drives its invariant, so a future change to the
collapse toggle fails it without anyone predicting the surface. It needs its own task
because it exercises the write path (`performHorizonMove`), not just rendering.

**Interfaces:**
- Consumes: `cardDrag` from `test/helpers/dnd.ts`, `flush` from `test/helpers/view.ts`, `cardByTitle` from `test/helpers/board.ts`, `shelfOf` from `test/helpers/roadmap.ts`.

Roadmap cards are wired through Pragmatic Drag and Drop, not the tree's native HTML5
drag events — `test/helpers/view.ts`'s `drag` helper is for tree-row reordering and
emits a plain `MouseEvent` with no `dataTransfer`, which the card's Pragmatic adapter
silently ignores. `test/helpers/dnd.ts`'s `cardDrag(card, region)` is the one that
actually supplies the adapter's payload — `test/view/roadmapMoves.test.ts` already
drives every roadmap card move through it, including the near-identical "drop onto an
empty, live-drag-only shelf" case this task's test mirrors. Using the wrong helper here
would not fail loudly: the drop would silently do nothing, `horizon` would stay
whatever it started as, and a test written the wrong way around that assertion could
easily read as passing for the wrong reason — or, worse, send whoever hits a real
failure here chasing a bug in `shelf.ts` that does not exist.

- [ ] **Step 1: Write the failing test**

```ts
import { cardDrag } from '../helpers/dnd'; // new import
import { cardByTitle } from '../helpers/board'; // new import
import { flush } from '../helpers/view'; // extend existing import
```

```ts
describe('the shelf as a drop target while collapsed', () => {
	it('still un-places a card dropped on it', async () => {
		const vault = horizonVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 5, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault, {}, { shelfCollapsed: true });
		// Default collapsed — confirm the premise before testing the drop.
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-collapsed')).toBe(true);

		cardDrag(cardByTitle(containerEl, 'Placed'), shelfOf(containerEl) as HTMLElement);
		await flush();

		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test — it should already pass**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: PASS, since `renderShelf` wires the drop target before the collapsed check.
If it fails instead, the bug is in Task 6's ordering — fix `shelf.ts` there rather than
adding new code here (the drop-target wiring line must run before the
`if (empty || collapsed) return [];` line).

- [ ] **Step 3: Watch it fail — this is CLAUDE.md's rule for an invariant asserted only
  in a comment, not a genuine red-phase test**

`shelf.ts`'s doc comment states the invariant in prose ("Collapsing is a view
convenience and never gates the drop target: it is wired before the collapsed check
below, not after") — exactly the shape `CLAUDE.md` requires a watched-failing test for,
since a passing test here proves nothing about what it would catch. In `src/view/render/shelf.ts`,
temporarily move the `dnd?.wireDropTarget(...)` line to AFTER the
`if (empty || collapsed) return [];` line (reversing the real order). Run:

`npx vitest run test/view/shelfUx.test.ts`

Expected: FAIL — with the shelf collapsed, `wireDropTarget` is now skipped by the early
return, the drop never lands, and `'horizon' in vault.fm('Placed.md')` stays `true`.
Seeing this red is the proof the test would catch a regression in the ordering. Revert
`shelf.ts` back to the real order and re-run to confirm PASS before moving on.

- [ ] **Step 4: Confirm and commit**

```bash
git add test/view/shelfUx.test.ts
git commit -m "Add the collapsed-shelf-still-a-drop-target invariant test"
```

---

## Task 8: `styles/shelf.css` — uniform cards, spacing fix, collapsed state

**Files:**
- Create: `styles/shelf.css`
- Modify: `styles/timeline.css` (remove the section that moves out)
- Modify: `styles/index.css` (add the import)

**Interfaces:** none — CSS only, class names already established by Task 6
(`.pbl-shelf`, `.pbl-shelf-collapsed`, `.pbl-shelf-group`, `.pbl-shelf-group-header`,
`.pbl-shelf-group-name`, `.pbl-shelf-group-count`, `.pbl-shelf-cards`,
`.pbl-shelf-controls`, `.pbl-shelf-controls-empty`, `.pbl-shelf-sort`,
`.pbl-shelf-type-filter`, `.pbl-shelf-type-chip`) and existing ones
(`.pbl-shelf-empty`, `.pbl-shelf-reason`, `.pbl-shelf-reason-icon`,
`.pbl-roadmap-context`, `.pbl-shelf-header`, `.pbl-shelf-icon`, `.pbl-shelf-name`).

- [ ] **Step 1: Create `styles/shelf.css`**

```css
/* The unplaced shelf, its type groups, its toolbar controls, and the context strip —
   `src/view/render/shelf.ts` and `src/view/render/shelfControls.ts`. */

.pbl-shelf,
.pbl-roadmap-context {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	padding: var(--size-4-2) var(--size-4-3);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background-color: var(--background-secondary);
}

/* Context stands beside the shelf, visibly not part of its count. */
.pbl-roadmap-context {
	border-style: dashed;
	background-color: transparent;
}

/* An empty shelf takes no space — and is still the target that un-places, which a
   strip appearing only while a drag is live can be and an absent element cannot.
   The DOM keeps it so a drop has somewhere to land; this keeps it out of the way. */
.pbl-shelf-empty {
	display: none;
}

.pbl-dragging .pbl-shelf-empty {
	display: flex;
	border-style: dashed;
}

/* Collapsed keeps its footprint minimal — the toolbar carries the name, the count
   and the toggle, so there is nothing left to show here until it is expanded. */
.pbl-shelf-collapsed {
	padding-block: var(--size-4-1);
	min-height: 0;
}

.pbl-shelf-header {
	display: flex;
	align-items: center;
	gap: var(--size-4-1);
	font-size: var(--font-ui-small);
	font-weight: var(--font-medium);
	color: var(--text-normal);
}

.pbl-shelf-icon {
	display: flex;
	align-items: center;
	color: var(--text-muted);
}

.pbl-shelf-icon .svg-icon {
	width: 14px;
	height: 14px;
}

.pbl-shelf-group {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-1);
}

.pbl-shelf-group-header {
	display: flex;
	align-items: center;
	gap: var(--size-4-1);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-medium);
	color: var(--text-muted);
	text-transform: uppercase;
}

.pbl-shelf-group-count {
	color: var(--text-faint);
}

/* A grid, not a wrapping flex row: the previous layout shrank trailing-row cards
   unevenly. Matches the bucket card grid in roadmap.css, so every card in the
   roadmap is sized the same way. `min(240px, 100%)`, not a bare 240px: the shelf's
   own gutter (roadmap.css) and internal padding both eat into its content box, so a
   narrow enough pane can leave less than 240px for the grid to work with — a bare
   240px floor would then force the track wider than its container and reintroduce
   the very horizontal scrollbar this rewrite exists to remove. Capping the minimum
   at the available width degrades to a single narrower column instead. */
.pbl-shelf-cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
	gap: var(--size-4-2);
}

/* Why a value could not be read: the reason travels on the card it shelved. */
.pbl-shelf-reason {
	display: flex;
	align-items: center;
	gap: var(--size-2-1);
	font-size: var(--font-ui-smaller);
	color: var(--text-warning);
}

.pbl-shelf-reason-icon {
	display: flex;
	align-items: center;
}

.pbl-shelf-reason-icon .svg-icon {
	width: 12px;
	height: 12px;
}

/* The shelf's toolbar chrome — a sibling of `.pbl-tree`, never inside it. */
.pbl-shelf-controls {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
}

.pbl-shelf-controls-empty {
	display: none;
}

.pbl-shelf-sort {
	font-size: var(--font-ui-smaller);
}

.pbl-shelf-type-filter {
	display: flex;
	align-items: center;
	gap: var(--size-4-1);
	flex-wrap: wrap;
}

.pbl-shelf-type-chip {
	display: flex;
	align-items: center;
	gap: var(--size-2-1);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}
```

- [ ] **Step 2: Remove the moved section from `styles/timeline.css`**

Delete everything from the `/* ----- the shelf: what the axis cannot place, visible and
counted */` comment (currently line 219) through the end of the `.pbl-shelf-reason-icon
.svg-icon` rule (currently line 298) — the whole block now lives in `shelf.css`.

- [ ] **Step 3: Register the import in `styles/index.css`**

Add after the existing `@import "./timeline.css";` line:

```css
@import "./shelf.css";
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: succeeds — `styles-assemble.mjs` fails loudly on a partial over 400 lines or
one no entry file imports, so a clean build confirms both files are within budget and
wired in.

- [ ] **Step 5: Run the view test suite**

Run: `npx vitest run test/view`
Expected: PASS — CSS changes should not affect jsdom class-name assertions, since none
of the DOM structure changed in this task, only stylesheet rules.

- [ ] **Step 6: Commit**

```bash
git add styles/shelf.css styles/timeline.css styles/index.css
git commit -m "Move the shelf's CSS into its own partial; grid-based uniform card sizing"
```

---

## Task 9: Full-width horizon buckets with a responsive card grid

**Files:**
- Modify: `styles/roadmap.css`

**Interfaces:** none — CSS only.

- [ ] **Step 1: Change `.pbl-bucket`'s width rule**

In `styles/roadmap.css`, replace:

```css
.pbl-bucket {
	flex: 0 0 260px;
	display: flex;
	flex-direction: column;
	min-width: 0;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background-color: var(--background-secondary);
}
```

with:

```css
/* Buckets grow to share the row's full width equally, down to a floor of 280px —
   the explicit min-width is load-bearing: flex-basis alone is not a floor once
   shrinking is enabled, and the shrink would otherwise go all the way to 0. Only
   past that floor does the row fall back to `.pbl-tree`'s existing horizontal scroll. */
.pbl-bucket {
	flex: 1 1 280px;
	min-width: 280px;
	display: flex;
	flex-direction: column;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background-color: var(--background-secondary);
}
```

- [ ] **Step 2: Change `.pbl-bucket-cards` to a responsive grid**

Replace:

```css
.pbl-bucket-cards {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	padding: var(--size-4-2);
	overflow-y: auto;
	flex: 1 1 auto;
	min-height: var(--size-4-8);
}
```

with:

```css
/* align-content: start is not optional: .pbl-roadmap-buckets is a flex row with
   align-items: stretch, so every bucket already stretches to the tallest one, and a
   grid's default alignment would otherwise stretch a sparse bucket's own cards into
   that surplus height instead of leaving them their natural size. `min(240px, 100%)`
   for the same reason as the shelf's own grid: a bucket's floor width minus its own
   padding can still fall under 240px with enough buckets on a narrow pane, and a bare
   floor would force the track past its container rather than degrading to one
   narrower column. */
.pbl-bucket-cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
	align-content: start;
	gap: var(--size-4-2);
	padding: var(--size-4-2);
	overflow-y: auto;
	flex: 1 1 auto;
	min-height: var(--size-4-8);
}
```

- [ ] **Step 3: Fix the flush-edge spacing on the pinned strips**

Replace:

```css
.pbl-roadmap .pbl-shelf,
.pbl-roadmap .pbl-roadmap-context,
.pbl-roadmap .pbl-board-advisory {
	position: sticky;
	left: 0;
	width: 100cqw;
	align-self: flex-start;
	box-sizing: border-box;
}
```

with:

```css
/* A visible gutter from the pane's edges — the value matches .pbl-shelf's own
   internal inline padding in shelf.css, so the gutter reads as a continuation of it
   rather than a second, different margin. Width is reduced by twice the gutter so
   the margin box still fits the scrollport exactly; a bare 100cqw with a margin
   added on top would overflow by 2 * the gutter and reintroduce a scrollbar. */
.pbl-roadmap .pbl-shelf,
.pbl-roadmap .pbl-roadmap-context,
.pbl-roadmap .pbl-board-advisory {
	position: sticky;
	left: 0;
	width: calc(100cqw - 2 * var(--size-4-3));
	margin-inline: var(--size-4-3);
	align-self: flex-start;
	box-sizing: border-box;
}
```

- [ ] **Step 4: Build and run the view suite**

Run: `npm run build && npx vitest run test/view`
Expected: both succeed. No jsdom test asserts on computed widths (jsdom has no layout
engine), so this step confirms nothing broke structurally, not that the layout looks
right — that is Task 11.

- [ ] **Step 5: Update `docs/issues/Smoke test the visual changes.md`**

Task 11's own live-vault checklist (Step 3 there) is a one-off list scoped to this plan
— it is not the repository's actual re-run-before-every-release checklist, which is this
note. Left untouched, it would keep instructing maintainers to verify buckets as fixed
`flex: 0 0 260px` columns (now false) and would carry no check at all for the new grid,
gutter, or shelf controls — the temporary plan checklist would be the only record of
what changed, and it disappears once this plan is done.

Replace this bullet under "## The roadmap":

```
**Bucket layout in a narrow pane** — buckets are `flex: 0 0 260px` and the frame is
`min-width: max-content`, so a narrow pane should scroll sideways rather than squeeze
them. Check the buckets keep their width and the pane scrolls.
```

with:

```
**Bucket layout at different widths** — buckets share the row's width equally down to a
280px floor (`flex: 1 1 280px; min-width: 280px`), reflowing cards into multiple grid
columns as a bucket's own width allows. Check an ordinary 3-4 horizon vault shows no
horizontal scrollbar and a wide bucket's cards form more than one column; check a pane
narrow enough to hit the 280px floor falls back to the pane's existing horizontal
scroll, same as before.
```

Replace this bullet (same section):

```
**The shelf pinned to the scrollport** — `position: sticky` with `width: 100cqw` inside a
`max-content` frame. Pan the timeline sideways: the shelf, the context strip and the
advisory must stay put and stay full-width, not slide off or collapse.
```

with:

```
**The shelf pinned to the scrollport, with a real gutter** — `position: sticky` with a
width reduced to leave a visible gutter from the pane's edges (matching the shelf's own
internal padding), inside a `max-content` frame. Pan the timeline sideways: the shelf,
the context strip and the advisory must stay put, stay off the pane's edges, and force
no scrollbar of their own.
```

Add two new bullets after "The drop-over highlight" (same section), for surface this
plan adds rather than changes:

```
**The shelf, collapsed by default** — a fresh view opens with the shelf's cards hidden
and only its toolbar chrome (collapse button, sort picker, type filter) visible. Check
the collapsed strip reads as compact chrome, not an empty box taking noticeable space,
and that expanding it reveals cards grouped under type sub-headers in a uniform-width
grid.

**The shelf's toolbar controls** — the collapse button, sort picker and type-filter
chips live in the toolbar, not inside the roadmap pane. Check they are legible and
usable at the toolbar's normal size, and that toggling any one of them never visibly
rebuilds the rest of the toolbar.
```

- [ ] **Step 6: Commit**

```bash
git add styles/roadmap.css "docs/issues/Smoke test the visual changes.md"
git commit -m "Full-width horizon buckets with a responsive multi-column card grid"
```

---

## Task 10: Author the two backlog PBI notes and update the register

**Files:**
- Create: `docs/requirements/The shelf, organized.md`
- Create: `docs/requirements/Buckets that use the room they have.md`
- Modify: `docs/requirements/The unplaced shelf.md` (its own `## Where it lives` goes
  stale the moment Task 6 moves `renderShelf` out of `roadmap.ts`)
- Modify: `docs/README.md`

This task runs after all code exists (Tasks 1-9), so `## Where it lives` states real
facts rather than a plan for facts that might change during implementation — and it
runs BEFORE the full `npm run check` gate (the next task), not after: `docs-check.mjs`'s
rule that every `src/` module be specified in a use case or ADR would otherwise fail on
the three new modules Tasks 1-9 already added (`domain/shelf.ts`,
`view/render/shelf.ts`, `view/render/shelfControls.ts`), with nothing yet registering
them. Running the full gate before this task exists only to fail on a check this task
is what satisfies.

It is not only new notes that need writing here: `docs/requirements/The unplaced
shelf.md` already exists and already has a `## Where it lives` section naming
`src/view/render/roadmap.ts` as where the shelf renders — a claim Task 6 makes false by
moving that code to `src/view/render/shelf.ts`. Leaving it unchanged would mean the
register's oldest note about the shelf points at a module that no longer contains what
it says, exactly the kind of drift `CLAUDE.md` asks the register to stay honest against.

**Interfaces:** none — documentation only, gated by `docs-check.mjs` (part of
`npm run check`).

Both new notes are authored `status: Active`, not `Done` — every acceptance criterion
about actual on-screen appearance (uniform card widths, the full-width bucket layout,
the multi-column grid, the spacing gutter) is exactly what Task 11 says jsdom cannot
verify and a human has to actually look at. Marking either `Done` here would advertise
an unverified visual claim as settled. Task 11 is where they become `Done`, and only
after that live-vault check has actually happened.

- [ ] **Step 1: Create the first PBI note**

```markdown
---
type: PBI
parent: "[[A third projection]]"
order: 50
status: Active
priority: P2
created: 2026-08-04
files:
  - src/domain/shelf.ts
  - src/storage/collapseStore.ts
  - src/view/collapseState.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/render/shelf.ts
  - src/view/render/shelfControls.ts
  - src/view/render/toolbar.ts
  - src/view/render/roadmap.ts
---

# The shelf, organized

**As** someone whose shelf fills up before the first triage pass, **I want** it
collapsible, grouped by type, sortable and filterable, **so that** a shelf holding
dozens of untriaged items is something I can actually work through instead of a wall of
cards I have to scroll past to see the plan.

[[The unplaced shelf]] specified the shelf's existence and its counting guarantee; it
said nothing about comfort once the shelf holds more than a handful of items — a live
vault surfaced uneven card widths, a shelf flush against the pane's edges, and a
horizontal scrollbar the shelf itself was forcing. This PBI is that comfort pass,
alongside the same visual fixes.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with items on the shelf |
| **Preconditions** | Roadmap mode is on and the horizon or dated axis is configured |
| **Guarantee** | Grouping, sort and the type filter are display-only — nothing is ever written to a note because of them. Grouping alone never drops a card: every card the shelf holds resolves to exactly one group before the type filter narrows what is shown. The type filter is then a deliberate, separate narrowing on top of that grouping — hiding a type hides its whole group on purpose, the same way [[The unplaced shelf]]'s own "Show completed items" and quick filter deliberately narrow the shelf elsewhere. |

**Main flow**

1. The shelf opens collapsed by default, remembered per view like the projection and
   the roadmap axis — a working position, never a `.base` setting.
2. Expanded, its cards group under always-on type sub-headers, in the same order as
   the type ladder plus the extra types and markers, with a trailing group for anything
   else — fixed order, empty groups omitted.
3. Within a group, a sort picker orders cards by sibling order (the default), title, or
   last modified — display only, never written.
4. A type filter hides whole groups; the shelf's own count keeps reporting the true
   total regardless of what is currently hidden.
5. The shelf and the context strip render with uniform card widths, proper spacing from
   the pane's edges, and no shelf-caused horizontal scrollbar.

**Extensions**

- **1a — collapsed, still a target.** Collapsing removes the shelf's cards from
  keyboard navigation (they were never Tab-reachable to begin with; they leave the
  Arrow/End walk too) but never from being a drop target: dropping a card onto a
  collapsed shelf still un-places it.
- **1b — everything is shelved and collapsed.** The roadmap's advisory (empty backlog,
  filtered-empty, all done) does not fire for this: an all-shelved, collapsed backlog
  is not empty, it is untriaged, and the advisory is gated on the roadmap's actual
  population rather than on how many cards are currently keyboard-reachable.
- **4a — a hidden group's last item is un-shelved.** The stored hidden-type preference
  is simply unused until a card of that type reappears; nothing is lost or reset.

## Acceptance criteria

- The shelf's collapse state, sort pick and type-filter selections persist per saved
  view, per device — the same store `mode` and the roadmap axis pick already use.
- Collapsed by default on a view nobody has touched; toggling it is a real `<button>`
  reachable from the toolbar, not a per-row control inside the roadmap's one-tab-stop
  listbox.
- Type groups render in a fixed order (the declared type vocabulary, plus a trailing
  group for anything outside it); a group with nothing in it renders nothing.
- Sort and the type filter never write to a note; the shelf's count is the true total,
  unaffected by which groups are currently hidden.
- Shelf and context-strip cards render at a uniform width; the shelf sits with a
  visible gutter from the pane's edges and forces no scrollbar of its own.

## Where it lives

The grouping, sort and filter logic is `organizeShelf` in `src/domain/shelf.ts` — pure,
keyed by `displayType(item)` (never raw `typeName`, which would misgroup an untyped
child carrying an inferred level and any differently-cased declared type), driven in
`test/domain/shelf.test.ts`.

Persistence is three fields on the collapse store's existing per-view entry
(`src/storage/collapseStore.ts`), read as defensively as `mode`/`axis` already are, with
matching accessors on `src/view/collapseState.ts`.

The interactive controls — the collapse toggle, the sort picker, the type filter — are
toolbar chrome in `src/view/render/shelfControls.ts`, built in `renderToolbar`
(`src/view/render/toolbar.ts`) and synced after every content render
(`ProductBacklogView.renderTreeContent`, `src/view/backlogView.ts`) the same way the
item count already is — never inside `treeEl`'s `role="listbox"`, which has no room for
a `<select>` or checkboxes without breaking its one-tab-stop contract. Three new host
methods (`setShelfCollapsed`/`setShelfSort`/`setShelfHiddenTypes`) each write through
`CollapseState` and re-render the content pane alone — never the whole toolbar — so a
keyboard user's focus survives the control they just used, the same reason `setFilter`
does not call a full `render()` either.

The shelf's card content — grouped, sorted, filtered — renders in
`src/view/render/shelf.ts`, which also carries the context strip (unchanged: never
grouped, sorted or filtered, per the context-row rule). Collapsing removes the shelf's
cards from the keyboard-navigable array `RoadmapSnapshot.cards` builds, exactly as an
empty shelf already does, so `render/projections.ts`'s existing
`role: roadmap.cards.length > 0 ? 'listbox' : 'region'` recomputes correctly with no new
logic — and `renderRoadmapAdvisory` (`src/view/render/roadmap.ts`) is gated on the
roadmap's actual population instead (the axis's own rendered count, captured before the
shelf renders, plus the shelf's real count plus the context strip's count), so a
collapsed, all-shelved backlog is never reported as empty or done, and neither is a
focused view whose only visible row is a context card already placed inside a bucket.
Driven in `test/view/shelfUx.test.ts` (accessors added to `test/helpers/roadmap.ts`),
including the invariant that the shelf stays a drop target while collapsed.

Card sizing and the spacing/overflow fixes live in the new `styles/shelf.css`, moved out
of `styles/timeline.css` (which carried it only because the shelf and the timeline
shipped together, not because it belongs there). The full-width/grid layout itself is a
live-vault check — jsdom has no layout engine — recorded verified only after
`npm run test-build`.
```

- [ ] **Step 2: Create the second PBI note**

```markdown
---
type: PBI
parent: "[[The horizon board]]"
order: 40
status: Active
priority: P2
created: 2026-08-04
files:
  - styles/roadmap.css
---

# Buckets that use the room they have

**As** someone with a wide pane and three or four horizons, **I want** the buckets to
share the whole width instead of sitting in a fixed 260px column, **so that** the
roadmap does not waste most of a wide screen while every card stacks one to a row.

[[Buckets from a horizon property]] specified the buckets themselves — declared order,
case-insensitive matching, minted strays — and left their width and their cards' layout
as a fixed column, the same shape the board's columns use. A live vault showed the cost
of copying that shape here: a workflow board's columns are meant to hold a limit's worth
of cards in a glance-able stack, but a roadmap horizon is closer to a backlog slice, and
a fixed 260px column under-uses a wide pane far more than the board's columns do.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders on the horizon axis |
| **Preconditions** | Roadmap mode is on, the horizon axis is active |
| **Guarantee** | Buckets always share the full available width equally, down to a minimum width below which the row falls back to the existing horizontal scroll rather than compressing further; cards inside a bucket lay out in as many columns as the bucket's own width allows. |

**Main flow**

1. The horizon buckets render in one row, each sharing the row's width equally.
2. As the pane narrows or a horizon is added, each bucket narrows too, down to a
   minimum width.
3. Below that minimum, the row falls back to the horizontal scroll it already had —
   the same behavior as today, just no longer the default for the common case of three
   or four buckets on an ordinary pane.
4. Inside a bucket, cards lay out as a responsive grid: a wide bucket shows multiple
   card columns, a narrow one stays a single column — the same rule, no branch for
   either case.

**Extensions**

- **1a — a bucket holds fewer cards than its neighbors.** Its own grid still starts
  from the top and never stretches its cards to fill the row's shared height — the
  height only the flex row imposes, never the bucket's own content.

## Acceptance criteria

- Buckets share available width equally down to a minimum width, never below it; past
  that point the row scrolls horizontally exactly as it did before this PBI.
- Cards inside a bucket lay out as a CSS grid, reflowing into more columns as the
  bucket's rendered width allows, with no stretch applied to a sparse bucket's cards.
- No behavior changes for the shelf, the context strip, the dated axis, or the board:
  this PBI is `styles/roadmap.css` only.

## Where it lives

`.pbl-bucket` (`styles/roadmap.css`) changes from a fixed `flex: 0 0 260px` to
`flex: 1 1 280px` with an explicit `min-width: 280px` — the explicit minimum is load
bearing, since `flex-basis` alone is not a floor once shrinking is enabled, and the
previous `min-width: 0` on the same rule would otherwise let a bucket compress past its
stated minimum instead of the row falling back to the `.pbl-tree` scroller's existing
`overflow-x: auto`.

`.pbl-bucket-cards` changes from a flex column to a CSS grid
(`repeat(auto-fill, minmax(min(240px, 100%), 1fr))`), with `align-content: start` —
necessary because `.pbl-roadmap-buckets` is itself a flex row with `align-items: stretch`, so
every bucket already stretches to the tallest one, and a grid's default alignment would
otherwise stretch a sparse bucket's own cards into that surplus height instead of
leaving them their natural size.

The visual result — actual column counts at a given pane width, and whether the
fallback scroll reads well with many horizons — is a live-vault check: jsdom has no
layout engine, so `npm run test-build` is what this note relies on rather than a DOM
assertion.
```

- [ ] **Step 3: Update `docs/requirements/The unplaced shelf.md`** (its `## Where it lives`, plus the sibling-order claim this plan narrows)

That note's `## Where it lives` section currently reads (in part):

```
The shelf renders
in `src/view/render/roadmap.ts`, driven in `test/domain/roadmap.test.ts` and
`test/view/roadmapFrame.test.ts` (accessors in `test/helpers/roadmap.ts`).
```

and later:

```
Step 4 and 2a arrived with [[Moving between horizons]], on the horizon axis: a shelf
card is a drag source, the shelf itself is the target that un-places, and an empty
shelf renders as `pbl-shelf-empty` — in the DOM so a drop has somewhere to land,
kept out of the layout by `styles.css` until a drag is live.
```

Replace the first passage with:

```
The shelf renders
in `src/view/render/shelf.ts`, driven in `test/domain/roadmap.test.ts` and
`test/view/shelfUx.test.ts` (accessors in `test/helpers/roadmap.ts`) — moved out of
`src/view/render/roadmap.ts` once the shelf gained collapse, grouping, sort and a type
filter ("The shelf, organized").
```

Replace `kept out of the layout by \`styles.css\`` with
`kept out of the layout by \`styles/shelf.css\`` — the rule moved with the rest of the
shelf's CSS.

One more passage DOES need a change, not just a path correction: this note's main flow
and acceptance criteria state, unqualified, that "the shelf keeps sibling order" — true
when it was a single flat list, false as a whole-shelf property now that
"The shelf, organized" groups the shelf by type ahead of anything else. Two types
interleaved in raw sibling order (a Task ranked between two Epics, say) now render with
every Epic before every Task — sibling order survives only WITHIN a group, the same
qualifier that new note's own main flow step 3 already states correctly.
Leaving the older note's unqualified claim standing would contradict a living use case
the moment this plan ships. Replace:

```
2. The rest gather on the shelf: a labelled strip beside the axis, in sibling order,
   showing the same cards the axis shows.
```

with:

```
2. The rest gather on the shelf: a labelled strip beside the axis, showing the same
   cards the axis shows. Grouped by type ("The shelf, organized"); sibling order
   orders cards within a group, not across the whole strip.
```

and replace:

```
- The shelf keeps sibling order — the order property's rank, not arrival order — and
  names its count.
```

with:

```
- Within each type group, the shelf keeps sibling order — the order property's rank,
  not arrival order ("The shelf, organized" specifies the grouping itself). The shelf
  names its count.
```

Everything else in the note (its status, the rest of the use case, the open
dated-axis-drag criterion) stays untouched — these two passages are the only ones a
living use case's own contract requires, not a broader rewrite.

- [ ] **Step 4: Update `docs/requirements/Moving between horizons.md`'s `## Where it lives`**

This ACTIVE note's own write-path specification goes stale the same way, for the same
reason: it says "the buckets and the shelf that receive it are
`src/view/render/roadmap.ts`", true before Task 6, false after — the shelf half of that
sentence moves to `src/view/render/shelf.ts`. Replace:

```
The gesture is `src/view/interactions/cardDrag.ts`, the drag layer both card projections
now share ([[Share the card drag between projections]]); the buckets and the shelf that
receive it are `src/view/render/roadmap.ts`; `bucketLabelFor` in `src/domain/roadmap.ts`
is what names a placement out loud, so an announcement can only say what is on screen.
```

with:

```
The gesture is `src/view/interactions/cardDrag.ts`, the drag layer both card projections
now share ([[Share the card drag between projections]]); the buckets that receive it are
`src/view/render/roadmap.ts`, the shelf `src/view/render/shelf.ts` ("The shelf,
organized" moved it there); `bucketLabelFor` in `src/domain/roadmap.ts` is what names a
placement out loud, so an announcement can only say what is on screen.
```

Nothing else in the note changes — its status, use case and open criteria are unaffected
by where the shelf's rendering lives.

- [ ] **Step 5: Add the shelf's title sort to `docs/requirements/Locale-aware sorting and
  formatting.md`'s inventory**

Task 1's `compareCards` (`src/domain/shelf.ts`) calls `a.item.title.localeCompare(b.item.title)`
with no locale argument for the `'title'` sort — the same bare-`localeCompare` shape this
open design note exists to inventory and eventually fix, and its own acceptance criteria
already treats a new bare call as the mistake a future lint rule catches. That note is
"Nothing yet — this note is design": no locale-resolution mechanism exists anywhere in
`src/` yet ([[Locale resolution and fallback]] is equally unbuilt), so actually wiring
locale-aware collation here would mean building an entire separate, unbuilt feature as a
side effect of the shelf's sort control — out of scope for this plan. Track the new site
instead of leaving it uncounted.

In `docs/requirements/Locale-aware sorting and formatting.md`, change:

```
Three `localeCompare` calls, all currently locale-less:

| Site | Sorts |
| --- | --- |
| `ui/prompts.ts:58` | Folder paths in the folder suggest |
| `domain/model.ts:495` | `observedStates` — the state vocabulary offered in the menu |
| `domain/model.ts:512` | The tag vocabulary |
```

to:

```
Four `localeCompare` calls, all currently locale-less:

| Site | Sorts |
| --- | --- |
| `ui/prompts.ts:58` | Folder paths in the folder suggest |
| `domain/model.ts:495` | `observedStates` — the state vocabulary offered in the menu |
| `domain/model.ts:512` | The tag vocabulary |
| `domain/shelf.ts` (`compareCards`) | Shelf cards within a type group, by title |
```

(Fill in the exact line number once `src/domain/shelf.ts` exists, matching the other
three rows' precision.)

In the same note's `## Where it lives`, add `src/domain/shelf.ts` beside
`src/domain/model.ts` in the file list, and `test/domain/shelf.test.ts` beside
`test/domain/model.test.ts` in the tests list.

- [ ] **Step 6: Update `docs/README.md`'s use-case count only**

The two new PBI notes exist as of this step regardless of their status, so the
register's own count of them is a structural fact, not a claim about whether the
feature works — safe to update now, unlike the narrative sentence below (see Task 11's
final step for that).

In the `**Product Roadmap**` paragraph, change:

```
specified across six features and 18 use cases
```

to:

```
specified across six features and 20 use cases
```

Do not add a sentence describing what the two new PBIs DO here — that is a "this is
built and verified" claim, and at this point in the plan neither note has been
confirmed against a live vault yet. It belongs beside the point where the notes
actually become `Done` (Task 11's last step), not here.

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: PASS — this is the point where the docs register gate actually checks the two
new notes' frontmatter, wikilinks, hierarchy and `## Where it lives` shape, and the
corrected `The unplaced shelf.md`/`Moving between horizons.md` no longer name a module
that moved.

- [ ] **Step 8: Commit**

```bash
git add "docs/requirements/The shelf, organized.md" "docs/requirements/Buckets that use the room they have.md" "docs/requirements/The unplaced shelf.md" "docs/requirements/Moving between horizons.md" "docs/requirements/Locale-aware sorting and formatting.md" docs/README.md
git commit -m "Register the shelf UX and full-width bucket PBIs in the backlog"
```

---

## Task 11: Full `npm run check`, then the live-vault smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: PASS — build, lint, coverage-thresholded tests, fallow, docs register. The
previous task already registered both new PBI notes, so the docs phase has what it
needs to check them against; nothing here should fail on missing registration. If
fallow flags a complexity/duplication/dependency issue in a new file, address it before
moving on (do not suppress it inline; see `CLAUDE.md`'s framework-invoked-members note
for the one legitimate exception, which does not apply to anything in this plan).

- [ ] **Step 2: Build for a live vault**

Run: `npm run test-build`

This bundles into `.obsidian/plugins/<id>/` in the repo root so a human can open the
repo as a vault. Name it explicitly when handing this off — this plan's own honesty
rule: the full-width bucket layout, the multi-column card grid, the shelf's spacing
gutter, and the collapsed-shelf's compact height are all visual claims jsdom cannot
verify, and none of them may be reported as "done" until someone has actually looked.

- [ ] **Step 3: Note what still needs a human's eyes**

Every item below is a visual acceptance criterion from one of the two PBI notes Task 10
wrote (jsdom cannot verify any of them); this list has to cover both notes' criteria in
full, not a sample, or Step 4 can mark a PBI `Done` while one of its own stated
guarantees is still broken. Do not check this box until a live vault has confirmed:

From "Buckets that use the room they have":
- Buckets share the pane's width equally on an ordinary 3-4 horizon vault, with no
  horizontal scrollbar, and multiple card columns appear in a wide bucket.
- Narrowing the pane (or adding horizons) until a bucket would drop below 280px falls
  back to the row's horizontal scroll instead of compressing further — the same
  behavior the fixed-width layout already had, now triggered by the floor rather than
  always-on.
- A sparse bucket's cards keep their natural size — they do not stretch to fill the
  row's shared height the way the flex-column layout used to let them.

From "The shelf, organized":
- The shelf's edges have a visible gutter, not flush against the pane.
- A collapsed shelf reads as compact chrome, not an empty box taking noticeable space.
- The shelf's toolbar controls (collapse button, sort picker, type-filter chips) are
  legible and usable at the toolbar's normal size.
- Shelf and context-strip cards render at a uniform width, and neither the shelf nor
  the context strip forces a scrollbar of its own (distinct from the bucket row's,
  above — the strips are pinned via `position: sticky`, not part of the scrolling row).

- [ ] **Step 4: Only now, mark both PBIs `Done` and describe them in the README**

If — and only if — a human has actually confirmed every item in Step 3 against a live
vault: change `status: Active` to `status: Done` in both
`docs/requirements/The shelf, organized.md` and
`docs/requirements/Buckets that use the room they have.md`, AND add the narrative
sentence to `docs/README.md`'s `**Product Roadmap**` paragraph — the two belong
together, since both are "this is built and verified" claims, and Task 10 deliberately
left this sentence out for exactly that reason (it only updated the use-case count,
which was true the moment the notes existed).

In `docs/README.md`, find the sentence Task 10 already left in place:

```
and a bucket creates in place, its value riding the same single creation write.
```

Insert immediately after it, before `The dated axis is still read-only`:

```
 A later PBI made the
shelf usable at scale — collapsible, grouped by type, sortable and filterable — and
gave the horizon buckets the width a wide pane actually has, cards reflowing into
multiple columns as the space allows.
```

So the paragraph reads (only the inserted sentence is new):

```
...and a bucket creates in place, its value riding the same single creation write. A later PBI made the
shelf usable at scale — collapsible, grouped by type, sortable and filterable — and
gave the horizon buckets the width a wide pane actually has, cards reflowing into
multiple columns as the space allows. The dated axis is still read-only — scheduling by drag, the bar moves, the lanes and the
milestone type are design — ...
```

Also add a row to `docs/issues/Smoke test the visual changes.md`'s `## Runs` table —
that note is the actual re-run-before-every-release checklist (Task 9 updated its
bullets to match this plan's new behavior); recording the run there is what closes the
loop Task 9 opened, rather than leaving the confirmation stranded in this plan alone:

```
| 2026-08-04 | the shelf's collapse/grouping/sort/filter and the full-width bucket grid | Confirmed against `npm run test-build`; see PR #65. |
```

Commit all three changes together:

```bash
git add "docs/requirements/The shelf, organized.md" "docs/requirements/Buckets that use the room they have.md" docs/README.md "docs/issues/Smoke test the visual changes.md"
git commit -m "Confirm the shelf UX and full-width bucket PBIs against a live vault"
```

If nobody has performed that check yet — including if you, the implementer, have no
way to open a live Obsidian vault — leave both notes `Active`, leave the README's
narrative sentence unwritten, and say so explicitly when handing this off. An
unverified visual claim marked `Done` (or described in the README as already delivered)
is a worse outcome than an honestly incomplete PBI.

---

## Task 12: Push and open for review

- [ ] **Step 1: Final full check**

Run: `npm run check`
Expected: PASS, clean, no uncommitted changes (`git status` clean aside from anything
intentionally left for a human, e.g. the live-vault smoke-test notes from Task 11).

- [ ] **Step 2: Push**

```bash
git push -u origin <current-branch>
```

- [ ] **Step 3: Report the live-vault items**

Summarize for the human reviewer, explicitly, which of Task 11's checklist items still
need their eyes — do not claim any of them verified from the test suite alone.
