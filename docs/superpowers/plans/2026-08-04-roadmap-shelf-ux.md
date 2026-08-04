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
  or an ADR's `## Decision`) — `docs-check.mjs` gates this, and Task 11 is where the two
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

**Interfaces:**
- Consumes: `ShelfSort` from `src/domain/shelf.ts` (Task 1); `CollapseSnapshot`/`saveCollapseState` fields from Task 2.
- Produces: `CollapseState.shelfCollapsed(): boolean`, `.setShelfCollapsed(boolean): void`, `.shelfSort(): ShelfSort`, `.setShelfSort(ShelfSort): void`, `.shelfHiddenTypes(): ReadonlySet<string>`, `.setShelfHiddenTypes(ReadonlySet<string>): void`. `BacklogViewHost` gains matching `readonly shelfCollapsed: boolean` / `setShelfCollapsed` / `readonly shelfSort: ShelfSort` / `setShelfSort` / `readonly shelfHiddenTypes: ReadonlySet<string>` / `setShelfHiddenTypes`, implemented on `ProductBacklogView`. Tasks 4 and 6 both consume these host members.

This task has no dedicated test file of its own — it is exercised end-to-end by Task 4's
and Task 6's view tests, the same way `setProjection`/`setAxisPick` have no standalone
unit test but are driven through `test/view/*.test.ts`. Do the change, then confirm the
existing suite is undisturbed.

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

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`shelf.ts` from Task 1 must already exist for this to resolve
`ShelfSort`.)

- [ ] **Step 5: Commit**

```bash
git add src/view/collapseState.ts src/view/host.ts src/view/backlogView.ts
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

- [ ] **Step 4: Repoint `shelfCountOf` at the toolbar**

The count moved out of `.pbl-shelf` entirely — it now lives on the toolbar's collapse
button (`.pbl-shelf-count`, above), never repeated inside the tree. The existing
`test/helpers/roadmap.ts` helper (already used by `test/view/roadmapFrame.test.ts:354`,
which must keep passing unchanged) searches inside `shelfOf(containerEl)`, which would
now find nothing. Widen its search to the whole container — the function's contract
("the shelf's displayed count, as a string") does not change, only where that text lives:

```ts
// test/helpers/roadmap.ts — replace the existing shelfCountOf:
export function shelfCountOf(containerEl: HTMLElement): string {
	return containerEl.querySelector('.pbl-shelf-count')?.textContent ?? '';
}
```

Run: `npx vitest run test/view/roadmapFrame.test.ts`
Expected: PASS — this existing test must not regress from the DOM move.

- [ ] **Step 5: Run the shelf UX test to verify it passes**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: PASS (both tests). The controls exist but show nothing useful yet (no shelf
data synced) — that is the next task.

- [ ] **Step 6: Commit**

```bash
git add src/view/render/shelfControls.ts src/view/render/toolbar.ts test/helpers/roadmap.ts test/view/shelfUx.test.ts
git commit -m "Add the shelf's toolbar controls: collapse toggle, sort, type filter"
```

---

## Task 5: Sync the shelf controls after every content render

**Files:**
- Modify: `src/view/backlogView.ts`
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

`shelfCountOf` comes from `test/helpers/roadmap.ts` (Task 4 already repointed it at the
toolbar) — add it to this file's import from that module if it is not already imported.

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
git add src/view/backlogView.ts test/view/shelfUx.test.ts
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

```ts
export function shelfGroupHeaders(containerEl: HTMLElement): string[] {
	return Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-shelf-group-name') ?? []).map(
		(h) => h.textContent ?? '',
	);
}
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
		const { containerEl, view } = makeRoadmap(horizonVault());
		expect(shelfTitles(containerEl)).toEqual([]);
		expect(shelfOf(containerEl)).not.toBeNull();

		view.setShelfCollapsed(false);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
	});

	it('keeps a visible label on the collapsed drop target — a user mid-drag is looking at it, not the toolbar', () => {
		const { containerEl } = makeRoadmap(horizonVault());
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
		const { containerEl, view } = makeRoadmap(horizonVault());
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
		const { containerEl } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});
});
```

Add `FakeVault` to the imports at the top of the file if not already present:
`import { FakeVault } from '../helpers/vault';`

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: FAIL — `setShelfCollapsed` exists (Task 3) but `renderRoadmap` doesn't consult
it yet, so the shelf still renders its cards regardless, and the "no advisory" test
fails because `renderRoadmapAdvisory` still gates on `cards.length` (which is currently
non-zero from the shelf itself).

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

- [ ] **Step 6: Run the full suite once**

Run: `npx vitest run`
Expected: PASS. This is the first point where a regression in `renderShelf`'s move would
show up broadly (e.g. `test/view/contextRowWrites.test.ts`, `test/view/roadmapMoves.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/view/render/shelf.ts src/view/render/roadmap.ts test/helpers/roadmap.ts test/view/shelfUx.test.ts
git commit -m "Move shelf/context rendering to shelf.ts; make collapse keyboard- and advisory-safe"
```

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
		const { containerEl } = makeRoadmap(vault);
		// Default collapsed — confirm the premise before testing the drop.
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-collapsed')).toBe(true);

		cardDrag(cardByTitle(containerEl, 'Placed'), shelfOf(containerEl) as HTMLElement);
		await flush();

		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails or passes for the wrong reason**

Run: `npx vitest run test/view/shelfUx.test.ts`
Expected: This SHOULD already pass after Task 6, since `renderShelf` wires the drop
target before the collapsed check. If it fails, the bug is in Task 6's ordering — fix
`shelf.ts` there rather than adding new code here (the drop-target wiring line must run
before the `if (empty || collapsed) return [];` line).

- [ ] **Step 3: Confirm and commit**

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
   roadmap is sized the same way. */
.pbl-shelf-cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
   that surplus height instead of leaving them their natural size. */
.pbl-bucket-cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
right — that is Task 10.

- [ ] **Step 5: Commit**

```bash
git add styles/roadmap.css
git commit -m "Full-width horizon buckets with a responsive multi-column card grid"
```

---

## Task 10: Full `npm run check`, then the live-vault smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: PASS — build, lint, coverage-thresholded tests, fallow, docs register. If
fallow flags a complexity/duplication/dependency issue in a new file, address it before
moving on (do not suppress it inline; see `CLAUDE.md`'s framework-invoked-members note
for the one legitimate exception, which does not apply to anything in this plan).

If the docs register check fails here, it is because Task 11 has not run yet — that is
expected; do not treat it as a regression to chase inside this task.

- [ ] **Step 2: Build for a live vault**

Run: `npm run test-build`

This bundles into `.obsidian/plugins/<id>/` in the repo root so a human can open the
repo as a vault. Name it explicitly when handing this off — this plan's own honesty
rule: the full-width bucket layout, the multi-column card grid, the shelf's spacing
gutter, and the collapsed-shelf's compact height are all visual claims jsdom cannot
verify, and none of them may be reported as "done" until someone has actually looked.

- [ ] **Step 3: Note what still needs a human's eyes**

Do not check this box until a live vault has confirmed:
- Buckets share the pane's width on an ordinary 3-4 horizon vault, with no horizontal
  scrollbar, and multiple card columns appear in a wide bucket.
- The shelf's edges have a visible gutter, not flush against the pane.
- A collapsed shelf reads as compact chrome, not an empty box taking noticeable space.
- The shelf's toolbar controls (collapse button, sort picker, type-filter chips) are
  legible and usable at the toolbar's normal size.

---

## Task 11: Author the two backlog PBI notes and update the register

**Files:**
- Create: `docs/requirements/The shelf, organized.md`
- Create: `docs/requirements/Buckets that use the room they have.md`
- Modify: `docs/README.md`

This task runs LAST, after all code exists, so `## Where it lives` states real facts
rather than a plan for facts that might change during implementation.

**Interfaces:** none — documentation only, gated by `docs-check.mjs` (part of
`npm run check`).

- [ ] **Step 1: Create the first PBI note**

```markdown
---
type: PBI
parent: "[[A third projection]]"
order: 50
status: Done
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
| **Guarantee** | Grouping, sort and the type filter are display-only — nothing is ever written to a note because of them — and the shelf's own guarantee from [[The unplaced shelf]] holds through all three: every card the shelf holds still renders in exactly one group. |

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
order: 30
status: Done
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
(`repeat(auto-fill, minmax(240px, 1fr))`), with `align-content: start` — necessary
because `.pbl-roadmap-buckets` is itself a flex row with `align-items: stretch`, so
every bucket already stretches to the tallest one, and a grid's default alignment would
otherwise stretch a sparse bucket's own cards into that surplus height instead of
leaving them their natural size.

The visual result — actual column counts at a given pane width, and whether the
fallback scroll reads well with many horizons — is a live-vault check: jsdom has no
layout engine, so `npm run test-build` is what this note relies on rather than a DOM
assertion.
```

- [ ] **Step 3: Update `docs/README.md`**

In the `**Product Roadmap**` paragraph, find this sentence (currently ending the
description of the second built feature):

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

- [ ] **Step 4: Run the full gate**

Run: `npm run check`
Expected: PASS — this is the point where the docs register gate actually checks the two
new notes' frontmatter, wikilinks, hierarchy and `## Where it lives` shape.

- [ ] **Step 5: Commit**

```bash
git add "docs/requirements/The shelf, organized.md" "docs/requirements/Buckets that use the room they have.md" docs/README.md
git commit -m "Register the shelf UX and full-width bucket PBIs in the backlog"
```

---

## Task 12: Push and open for review

- [ ] **Step 1: Final full check**

Run: `npm run check`
Expected: PASS, clean, no uncommitted changes (`git status` clean aside from anything
intentionally left for a human, e.g. the live-vault smoke-test notes from Task 10).

- [ ] **Step 2: Push**

```bash
git push -u origin <current-branch>
```

- [ ] **Step 3: Report the live-vault items**

Summarize for the human reviewer, explicitly, which of Task 10's checklist items still
need their eyes — do not claim any of them verified from the test suite alone.
