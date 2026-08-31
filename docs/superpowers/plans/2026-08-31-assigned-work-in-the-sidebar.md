# Assigned work in the sidebar — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fourth Bases view (`product-my-work`) that shows one person's work as a backlog tree, with the person picked in the view rather than in the Base, readable in a sidebar-width pane.

**Architecture:** The view is registered like the other three (ADR 0030: one registration file per view, one shared `WriteLock`), builds the ordinary `BacklogModel`, and derives its rows with the SAME scope walk the release view already uses — membership swapped from "names this release" to "assignee resolves to this person". Three pieces of that walk and its tree plumbing are extracted first (`domain/scopeRows.ts`, `view/scopeFolds.ts`, `view/scopeKeys.ts`), so the new view adds rows, a toolbar, a row menu and a stylesheet partial and nothing else. The person pick, the folds and the hide-done flag are view state (vault-scoped localStorage, keyed by base path and view name), never `.base` settings — ADR 0011.

**Tech Stack:** TypeScript 6.0 (`~6.0.3`), Obsidian 1.12.0 typings (pinned to the floor), esbuild, vitest + jsdom, eslint (layer rules and text bans), fallow, `docs-check.mjs`.

## Global Constraints

Every task's requirements implicitly include all of these.

- **`npm run check` must pass before every commit** — `build`, `lint`, `lint:md`, `test:coverage`, `analyze`, `docs`. CI runs the same on Ubuntu and Windows.
- **Layers**: `main → commands → view → storage → domain`. Each may reach anything below it and nothing above; `ui/` and `i18n/` are leaves. `eslint.config.mjs` enforces this, so a violation fails `npm run lint` rather than waiting for review.
- **400-line maximum per file in `src/`**, 450 in `test/`, 400 per stylesheet partial.
- **Every user-visible string goes through `t()`**, with its key in `src/i18n/en.ts`. `view/` is a swept directory: `UI_TEXT_LITERAL`, `UI_TEXT_PROPERTY` and `TEXT_TERNARY` fail lint on a literal. Never key anything the plugin writes, matches or persists — property keys, type names, state values, option keys.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **Only `storage/` writes**: `processFrontMatter`, `vault.create` and `load/saveLocalStorage` are banned everywhere else by `no-restricted-syntax`.
- **Every module in `src/` must be specified** by a PBI's `## Where it lives` or an ADR's `## Decision`, or `npm run docs` fails. Each task below writes its own docs note, in the same task.
- **The context-row rule**: an `outsideFilter` row renders, it parents, and that is all — never a write target, never a ranking peer, never a source of anything derived from the Base's results.
- **The stylesheet**: edit `styles/<partial>.css` and import it from `styles/index.css`. The root `styles.css` is generated and gitignored.
- **Coverage thresholds only ever go up** (`vitest.config.mts`), and `scripts/coverage-floors.mjs` fails a run that leaves a floor with no headroom. Do not lower one to land this work.
- **Commits** go on branch `claude/assigned-work-backlog-tree-fkj69a`.

## Files

**New**

| File | Responsibility |
| --- | --- |
| `src/domain/scopeRows.ts` | The scope walk (`ScopeRow`, keep set, pre/post-order rollup) and the four pure row-list transforms, over ANY membership predicate |
| `src/domain/assignedWork.ts` | Who counts as one person's work, the rows, and what is next |
| `src/domain/myWorkOptions.ts` | This view's options bag and its resolver (`MyWorkSettings`) |
| `src/view/scopeFolds.ts` | A per-scope fold set over the view-state store, with the session-only fallback |
| `src/view/scopeKeys.ts` | The roving `aria-activedescendant` keyboard for a scope tree |
| `src/view/mywork/register.ts` | `registerMyWorkView(plugin, lock)` |
| `src/view/mywork/myWorkView.ts` | The `BasesView`: settings, model, the pick, the gate, the empty states |
| `src/view/mywork/renderTree.ts` | The rows, the disclosure, the next marker |
| `src/view/mywork/toolbar.ts` | The person picker, collapse and expand, hide done |
| `src/view/mywork/rowMenu.ts` | The one write this surface offers: Set state |
| `styles/mywork.css` | The panel, and everything that gives way in a narrow pane |
| `test/helpers/mywork.ts` | `makeMyWorkView`, `myWorkVault`, and the row accessors |
| `test/harness/mountMyWork.ts`, `test/harness/mywork.ts` | The browser-harness mount and its bundle entry |
| `docs/requirements/One person's tree.md` | PBI — the domain rules and the view shell |
| `docs/requirements/The person is a pick.md` | PBI — the picker, the persisted pick, the empty states |
| `docs/requirements/A tree that fits a sidebar.md` | PBI — the narrow-pane behaviour and the one write |

**Modified**

| File | Change |
| --- | --- |
| `src/domain/releases.ts` | `releaseScope` calls the extracted walk; `ScopeRow` is re-homed |
| `src/view/release/scopeTree.ts` | The fold helpers and the row transforms come from the extracted modules |
| `src/view/release/scopeKeys.ts` | Moved to `src/view/scopeKeys.ts`; `renderScope.ts` calls it there |
| `src/view/release/renderScope.ts`, `src/view/release/scopeToolbar.ts` | Import sites follow the moves |
| `src/storage/foldKeys.ts` | `MYWORK_FOLD` joins the prefix vocabulary |
| `src/storage/viewStateStore.ts` | `prefs.person`, in `ViewPrefs`, `PREF_READERS` and `PATH_PREFS` |
| `src/main.ts` | `registerMyWorkView(this, lock)` |
| `src/i18n/en.ts` | The `mywork.*` keys |
| `styles/index.css` | Imports `mywork.css` |
| `CHANGELOG.md` | An `[Unreleased]` entry |

---

### Task 1: The scope walk, over any membership predicate

The release view already builds exactly the tree this feature needs — members, plus every
ancestor that holds one in place, with a rollup and a `subtreeDone` — and the only
release-shaped thing about it is *which* items are members. Extract it before writing a
second copy. The existing release suite is the safety net: it must stay green with no
assertion edited.

**Files:**

- Create: `src/domain/scopeRows.ts`
- Modify: `src/domain/releases.ts` (`releaseScope`, and the `ScopeRow` export)
- Modify: `src/view/release/scopeTree.ts` (drop `rowsAfterHideDone`, `visibleRows`, `siblingPlaces`, `childRows`)
- Modify: `src/view/release/renderScope.ts`, `src/view/release/scopeToolbar.ts`, `src/view/release/scopeKeys.ts` (import sites)
- Test: `test/domain/scopeRows.test.ts` (new); `test/domain/releaseScope.test.ts` must pass unchanged
- Docs: `docs/requirements/One person's tree.md` (create)

**Interfaces:**

- Consumes: `BacklogModel`, `BacklogItem` (`src/domain/model.ts`), `ownWorkflowReading` (`src/domain/board.ts`), `isMarkerType` (`src/domain/itemTypes.ts`)
- Produces:
  - `interface ScopeRow { item: BacklogItem; depth: number; context: boolean; memberTotal: number; memberDone: number; subtreeDone: boolean }`
  - `function scopeRows(model: BacklogModel, isMember: (item: BacklogItem) => boolean): ScopeRow[]`
  - `function rowsAfterHideDone(rows: ScopeRow[], hideDone: boolean): ScopeRow[]`
  - `function visibleRows(rows: ScopeRow[], folded: ReadonlySet<string>): ScopeRow[]`
  - `function siblingPlaces(rows: ScopeRow[]): { row: ScopeRow; pos: number; count: number }[]`
  - `function childRows(rows: ScopeRow[]): Set<string>`

- [ ] **Step 1: Write the failing test**

`test/domain/scopeRows.test.ts` — the generic behaviour, stated over a predicate that is
not the release one.

```ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { scopeRows } from '../../src/domain/scopeRows';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

function model(vault: FakeVault) {
	return buildModel(vault.app, vault.entries(), {
		...defaultSettings(),
		typeKey: 'type',
		parentKey: 'parent',
		orderKey: 'order',
		stateKey: 'state',
	});
}

describe('scopeRows', () => {
	it('keeps a member, its ancestors as context, and counts only members below', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { type: 'Epic' });
		vault.addFile('Feature.md', { type: 'Feature' }, { parentLink: 'Epic' });
		vault.addFile('Mine.md', { type: 'PBI', state: 'Doing' }, { parentLink: 'Feature' });
		vault.addFile('Theirs.md', { type: 'PBI' }, { parentLink: 'Feature' });

		const rows = scopeRows(model(vault), (item) => item.file.path === 'Mine.md');

		expect(rows.map((r) => [r.item.file.path, r.depth, r.context])).toEqual([
			['Epic.md', 0, true],
			['Feature.md', 1, true],
			['Mine.md', 2, false],
		]);
		expect(rows[0].memberTotal).toBe(1);
		expect(rows[2].memberTotal).toBe(0);
	});

	it('walks THROUGH a marker and re-roots the member at the level it occupied', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 1.md', { type: 'Iteration' });
		vault.addFile('Mine.md', { type: 'PBI' }, { parentLink: 'Sprint 1' });

		const rows = scopeRows(model(vault), (item) => item.file.path === 'Mine.md');

		expect(rows.map((r) => r.item.file.path)).toEqual(['Mine.md']);
		expect(rows[0].depth).toBe(0);
	});

	it('subtreeDone is true only when every member at or below the row is done', () => {
		const vault = new FakeVault();
		vault.addFile('Feature.md', { type: 'Feature' });
		vault.addFile('Done.md', { type: 'PBI', state: 'Done' }, { parentLink: 'Feature' });
		vault.addFile('Open.md', { type: 'PBI', state: 'Doing' }, { parentLink: 'Feature' });

		const both = scopeRows(model(vault), (item) => item.typeName === 'PBI');
		expect(both.find((r) => r.item.file.path === 'Feature.md')!.subtreeDone).toBe(false);

		const doneOnly = scopeRows(model(vault), (item) => item.file.path === 'Done.md');
		expect(doneOnly.find((r) => r.item.file.path === 'Feature.md')!.subtreeDone).toBe(true);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/scopeRows.test.ts`
Expected: FAIL with `Cannot find module '../../src/domain/scopeRows'`.

- [ ] **Step 3: Create `src/domain/scopeRows.ts` by MOVING the code**

Move — do not retype — `ScopeRow` with its whole docblock out of `src/domain/releases.ts`,
and the four list transforms out of `src/view/release/scopeTree.ts`. Every comment travels
with the code it explains; only the membership question becomes a parameter.

```ts
import { BacklogItem, BacklogModel } from './model';
import { ownWorkflowReading } from './board';
import { isMarkerType } from './itemTypes';

/** …the docblock moved verbatim from `releases.ts`… */
export interface ScopeRow {
	item: BacklogItem;
	depth: number;
	context: boolean;
	memberTotal: number;
	memberDone: number;
	subtreeDone: boolean;
}

/**
 * Members, plus every ancestor that holds one in place — with two kinds walked THROUGH
 * rather than kept. A MARKER, because `descendantCount` scores one 0 and traverses it, so
 * a marker is never what holds a row in place. An `outsideFilter` ancestor, because it is
 * not in the results and the context-row rule says such a row is never a source of
 * anything derived from them. Both skips CONTINUE the walk upward: an included ancestor
 * further up is still the member's rightful place.
 *
 * `isMember` is the whole of what varies between the screens that use this — a release's
 * membership property, or an item's assignee.
 */
export function scopeRows(model: BacklogModel, isMember: (item: BacklogItem) => boolean): ScopeRow[] {
	const members = new Set<string>();
	const keep = new Set<string>();
	for (const item of model.byPath.values()) {
		if (item.outsideFilter || !isMember(item)) continue;
		members.add(item.file.path);
		keep.add(item.file.path);
		for (let up = item.parent; up !== null; up = up.parent) {
			if (isMarkerType(up.typeName) || up.outsideFilter) continue;
			keep.add(up.file.path);
		}
	}

	// One pass, pre-order for `rows` (the tree's own drawing order) and post-order for the
	// rollup: a row's totals need every descendant visited, so the row is pushed on the way
	// DOWN and filled in on the way back UP. `rows` holds the object the recursion mutates.
	const rows: ScopeRow[] = [];
	const walk = (item: BacklogItem, depth: number): { total: number; done: number } => {
		const kept = keep.has(item.file.path);
		const mine = members.has(item.file.path);
		let row: ScopeRow | null = null;
		if (kept) {
			row = { item, depth, context: !mine, memberTotal: 0, memberDone: 0, subtreeDone: false };
			rows.push(row);
		}
		let belowTotal = 0;
		let belowDone = 0;
		for (const child of item.children) {
			const sub = walk(child, kept ? depth + 1 : depth);
			belowTotal += sub.total;
			belowDone += sub.done;
		}
		// A row reports what is BELOW it, never itself, so a leaf member draws no trivial 1/1.
		if (row) {
			row.memberTotal = belowTotal;
			row.memberDone = belowDone;
		}
		// Hiding asks the other question — is EVERY member at or below this row done, this
		// row's own membership included — so it reads these two rather than the pair above.
		const total = belowTotal + (mine ? 1 : 0);
		const done = belowDone + (mine && ownWorkflowReading(item).done ? 1 : 0);
		if (row) row.subtreeDone = total > 0 && done === total;
		return { total, done };
	};
	// From the model's REAL roots, so a focus level set on the backlog view cannot decide
	// what this tree contains.
	for (const root of model.realRoots) walk(root, 0);
	return rows;
}
```

Then paste `rowsAfterHideDone`, `visibleRows`, `siblingPlaces` and `childRows` in below,
byte for byte from `scopeTree.ts`, and export all four — three of them were file-private
there and now cross a module boundary.

- [ ] **Step 4: Point `releaseScope` at it**

In `src/domain/releases.ts`, replace the member, keep and walk body with one call, keeping
the release's own membership question and its members count:

```ts
import { ScopeRow, scopeRows } from './scopeRows';

export function releaseScope(
	app: App,
	model: BacklogModel,
	settings: ReleaseSettings,
	index: ReleaseIndex,
	path: string,
): ReleaseScope {
	const release = index.rows.find((row) => row.path === path) ?? null;
	if (release === null) return { release: null, rows: [], members: 0 };
	const releasePaths: ReadonlySet<string> = new Set(model.releases.map((r) => r.file.path));
	const rows = scopeRows(model, (item) => membershipTarget(app, item, releasePaths, settings) === path);
	return { release, rows, members: rows.filter((row) => !row.context).length };
}
```

`scannableRows` in that file becomes dead once nothing else calls it — delete it rather
than leaving it for `npm run analyze` to report.

- [ ] **Step 5: Follow the imports in the release view**

`scopeTree.ts`, `renderScope.ts`, `scopeToolbar.ts` and `scopeKeys.ts` take `ScopeRow` and
the four transforms from `../../domain/scopeRows`. Update the import sites rather than
re-exporting from `releases.ts` — a type belongs with the code that produces it.

- [ ] **Step 6: Run the new test and the release suite**

Run: `npx vitest run test/domain/scopeRows.test.ts test/domain/releaseScope.test.ts test/view/release`
Expected: PASS, with no release assertion edited.

- [ ] **Step 7: Write the PBI that specifies the module**

Create `docs/requirements/One person's tree.md` with frontmatter
`type: PBI`, `parent: "[[Assigned work in the sidebar]]"`, `order: 10`, `status: Open`,
`created: 2026-08-31`, `source: user request, 2026-08-31`, and the blank `started`,
`finished`, `horizon`, `start`, `due`, `risk`, `assignee`, `priority`, `iteration`,
`release` fields every note here carries. The body carries the six use-case sections, in
this order and exactly once each: `**As**`, `## Use case` (with the Actor, Trigger,
Preconditions and Guarantee table rows), `**Main flow**`, `**Extensions**`,
`## Acceptance criteria`, `## Where it lives`.

`## Where it lives` names `src/domain/scopeRows.ts` now and `src/domain/assignedWork.ts`
in Task 2. State the rule the extraction rests on: one walk, two membership questions, so
the two screens cannot drift about what a context row is.

- [ ] **Step 8: Run the gates and commit**

Run: `npm run lint && npm run docs && npx vitest run test/domain test/view/release`

```bash
git add src/domain/scopeRows.ts src/domain/releases.ts src/view/release test/domain/scopeRows.test.ts "docs/requirements/One person's tree.md"
git commit -m "Take the scope walk out of the release view, over any membership predicate"
```

---

### Task 2: What counts as one person's work, and what is next

**Files:**

- Create: `src/domain/assignedWork.ts`
- Test: `test/domain/assignedWork.test.ts`
- Modify: `docs/requirements/One person's tree.md`

**Interfaces:**

- Consumes: `scopeRows`, `ScopeRow` (Task 1); `inPlan` (`src/domain/model.ts`); `ownWorkflowReading` (`src/domain/board.ts`); `isMarkerType` (`src/domain/itemTypes.ts`)
- Produces:
  - `function assignedTo(item: BacklogItem, personPath: string): boolean`
  - `function assignedRows(model: BacklogModel, personPath: string): ScopeRow[]`
  - `function nextAssigned(rows: ScopeRow[]): ScopeRow | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { assignedRows, nextAssigned } from '../../src/domain/assignedWork';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

function model(vault: FakeVault) {
	return buildModel(vault.app, vault.entries(), {
		...defaultSettings(),
		typeKey: 'type',
		parentKey: 'parent',
		orderKey: 'order',
		stateKey: 'state',
		assigneeKey: 'assignee',
	});
}

function peopleVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('People/Ada.md', { type: 'Resource' });
	vault.addFile('People/Bo.md', { type: 'Resource' });
	vault.addFile('Feature.md', { type: 'Feature' });
	vault.addFile('Mine.md', { type: 'PBI', state: 'Doing', assignee: '[[Ada]]' }, { parentLink: 'Feature', links: { assignee: 'People/Ada' } });
	vault.addFile('Theirs.md', { type: 'PBI', assignee: '[[Bo]]' }, { parentLink: 'Feature', links: { assignee: 'People/Bo' } });
	return vault;
}

describe('assignedRows', () => {
	it('keeps the items whose assignee link resolves to this person', () => {
		const rows = assignedRows(model(peopleVault()), 'People/Ada.md');
		expect(rows.map((r) => r.item.file.path)).toEqual(['Feature.md', 'Mine.md']);
		expect(rows[0].context).toBe(true);
	});

	it('matches the NOTE, never the spelling', () => {
		// Two items naming Ada through different link text — a bare name and a path — land
		// in one tree, because the roster is notes rather than strings.
	});

	it('never makes an excluded item a member, even when it names this person', () => {
		// An outsideFilter item with the right assignee is not a member. It may still be
		// drawn as context for a member below it, and it is never a write target.
	});

	it('refuses an item that is not a row of the plan', () => {
		// An Iteration or a Release carrying an assignee is not work — `inPlan` says so.
	});
});

describe('nextAssigned', () => {
	it('is the first unfinished MEMBER in plan order', () => {
		const rows = assignedRows(model(peopleVault()), 'People/Ada.md');
		expect(nextAssigned(rows)?.item.file.path).toBe('Mine.md');
	});

	it('never names a context row', () => {
		// An unfinished context ancestor sits ABOVE the first member in the walk, and is not
		// what to do next: the same list refuses to write to it.
	});

	it('is null when everything of theirs is done', () => {
		// Nothing to mark, rather than a marker on a finished row.
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/assignedWork.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
import { BacklogItem, BacklogModel, inPlan } from './model';
import { ownWorkflowReading } from './board';
import { isMarkerType } from './itemTypes';
import { ScopeRow, scopeRows } from './scopeRows';

/**
 * Whose work this item is — the assignee link's own TARGET, never its text.
 *
 * The note, because [[The roster comes from the notes]] made a resource a note rather than
 * a name: two spellings of one person must not be two people, and a value resolving to
 * nothing names nobody this view can draw a tree for.
 */
export function assignedTo(item: BacklogItem, personPath: string): boolean {
	return item.assigneeEntry?.file?.path === personPath;
}

/**
 * One person's tree. The marker refusal and `inPlan` are `inIteration`'s own three
 * refusals minus `outsideFilter` — placement is not membership, and `scopeRows` answers
 * that one itself, in the one place both screens read it from.
 */
export function assignedRows(model: BacklogModel, personPath: string): ScopeRow[] {
	return scopeRows(model, (item) => !isMarkerType(item.typeName) && inPlan(item) && assignedTo(item, personPath));
}

/**
 * What is next: the first unfinished MEMBER in plan order, because plan order already says
 * what the product owner ranked highest. There is no personal rank — a second `order` per
 * person is a second ranking graph, and this register refuses those.
 *
 * Never a context row. The walk goes THROUGH one and never stops on it: a row the Base
 * excluded is not actionable, so offering it as what to do next would name the one row
 * this surface also refuses to write to.
 */
export function nextAssigned(rows: ScopeRow[]): ScopeRow | null {
	return rows.find((row) => !row.context && !ownWorkflowReading(row.item).done) ?? null;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/domain/assignedWork.test.ts`
Expected: PASS.

- [ ] **Step 5: Finish the PBI**

Add `src/domain/assignedWork.ts` to `## Where it lives`, with the three rules in prose: the
link's target decides, plan order decides what is next, and a context row is neither a
member nor an answer.

- [ ] **Step 6: Commit**

```bash
git add src/domain/assignedWork.ts test/domain/assignedWork.test.ts "docs/requirements/One person's tree.md"
git commit -m "Derive one person's tree, and what is next, from plan order"
```

---

### Task 3: The view's own options

A separately registered view inherits no binding from the backlog view. This one reads a
type, a parent and an order to build the tree at all, an assignee to know whose work it is,
and a state property to know what is done.

**Files:**

- Create: `src/domain/myWorkOptions.ts`
- Test: `test/domain/myWorkOptions.test.ts`
- Docs: `docs/requirements/The person is a pick.md` (create)

**Interfaces:**

- Consumes: `configReaders` (`src/domain/settingsResolve.ts`), `notePropsOnly` (`src/domain/optionalProperties.ts`), `openTargetOptions` / `resolveItemHandling` (`src/domain/itemHandling.ts`), `DEFAULT_DONE_VALUES` (`src/domain/settings.ts`)
- Produces:
  - `interface MyWorkSettings { parentKey: string; orderKey: string; typeKey: string; assigneeKey: string; stateKey: string; doneValues: string[]; openIn: OpenTarget }`
  - `function getMyWorkViewOptions(config: BasesViewConfig): BasesAllOptions[]`
  - `function resolveMyWorkSettings(config: BasesViewConfig): MyWorkSettings`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getMyWorkViewOptions, resolveMyWorkSettings } from '../../src/domain/myWorkOptions';
import { FakeViewConfig } from '../helpers/vault';

describe('my work options', () => {
	it('offers the same suggestions the backlog view does, without sharing the setting', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({}) as never);
		expect(settings.parentKey).toBe('parent');
		expect(settings.assigneeKey).toBe('assignee');
	});

	it('reads a CLEARED option as unbound rather than as the default', () => {
		const settings = resolveMyWorkSettings(new FakeViewConfig({ assigneeProperty: '' }) as never);
		expect(settings.assigneeKey).toBe('');
	});

	it('offers every key exactly once', () => {
		const keys = getMyWorkViewOptions(new FakeViewConfig({}) as never)
			.flatMap((group) => group.items ?? [])
			.map((item) => item.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
```

Check `FakeViewConfig`'s real constructor shape in `test/helpers/vault.ts` before writing —
`test/domain/releaseOptions.test.ts` is the working example to copy.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/myWorkOptions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Follow `src/domain/releaseOptions.ts` exactly: the same `modelGroup()` shape, the same
`configReaders` destructuring, every label through `t()`.

```ts
export function getMyWorkViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	return [modelGroup(), workGroup(config)];
}

export function resolveMyWorkSettings(config: BasesViewConfig): MyWorkSettings {
	const { propKey, clearablePropKey, str, list } = configReaders(config);
	const doneValues = list('doneValues');
	return {
		parentKey: propKey('parentProperty', 'parent'),
		orderKey: propKey('orderProperty', 'order'),
		typeKey: propKey('typeProperty', 'type'),
		// Clearable: turning a property off is a decision this view must not overrule, and
		// an unbound assignee is the state the first empty state exists for.
		assigneeKey: clearablePropKey('assigneeProperty', 'assignee'),
		stateKey: clearablePropKey('stateProperty', 'state'),
		doneValues: doneValues.length > 0 ? doneValues : DEFAULT_DONE_VALUES,
		openIn: resolveItemHandling(str).openIn,
	};
}
```

Verify the reader names against `resolveReleaseSettings` before writing: a cleared option
must resolve to `''`, never to the suggestion.

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/domain/myWorkOptions.test.ts`
Expected: PASS.

- [ ] **Step 5: Start the PBI**

Create `docs/requirements/The person is a pick.md` — `type: PBI`,
`parent: "[[Assigned work in the sidebar]]"`, `order: 20`, `status: Open`, the same
frontmatter fields as Task 1's note, and the six sections in order. `## Where it lives`
names `src/domain/myWorkOptions.ts`, and every option key is written in backticks so the
register specifies the surface rather than merely mentioning it.

- [ ] **Step 6: Commit**

```bash
git add src/domain/myWorkOptions.ts test/domain/myWorkOptions.test.ts "docs/requirements/The person is a pick.md"
git commit -m "Give the my-work view its own options bag"
```

---

### Task 4: The view, registered, with a pick that survives a restart

The shell: register it, build the model from THIS view's own mappings, restore and persist
the person, and draw the states that come before a tree.

**Files:**

- Create: `src/view/mywork/myWorkView.ts`, `src/view/mywork/register.ts`
- Modify: `src/main.ts`, `src/storage/viewStateStore.ts`, `src/i18n/en.ts`
- Test: `test/helpers/mywork.ts` (new), `test/view/mywork/shell.test.ts` (new), `test/storage/viewStateStore.test.ts` (extend)
- Docs: `docs/requirements/The person is a pick.md`

**Interfaces:**

- Consumes: `resolveMyWorkSettings` (Task 3); `buildModel` (`src/domain/model.ts`); `resolveSettings` (`src/domain/settingsResolve.ts`); `configProblems` (`src/domain/settingsConsistency.ts`); `applyWrites` (`src/storage/frontmatter.ts`); `WriteGate` (`src/view/writeGate.ts`); `guidanceShell` (`src/view/render/emptyStates.ts`); `OpenController` (`src/view/openTarget.ts`)
- Produces:
  - `const MY_WORK_VIEW_TYPE = 'product-my-work'`
  - `class MyWorkView extends BasesView` with `viewEl`, `settings: MyWorkSettings`, `planSettings: BacklogSettings`, `model: BacklogModel | null`, `pickedPerson: string | null`, `activeRowFile: TFile | null`, `treeHadFocus: boolean`, `gate: WriteGate<ItemWrite>`, `opener: OpenController`, `openContext()`, `pick(path: string | null)`, `render()`, `refresh()`
  - `function registerMyWorkView(plugin: Plugin, lock: WriteLock): void`

- [ ] **Step 1: Write the failing test**

`test/view/mywork/shell.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeMyWorkView, myWorkVault } from '../../helpers/mywork';

describe('the my-work view', () => {
	it('says the assignee property is unbound rather than drawing an empty pane', () => {
		const { view } = makeMyWorkView(myWorkVault(), { assigneeProperty: '' });
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-tree')).toBeNull();
	});

	it('says the base returns no people when the roster is empty', () => {
		const vault = myWorkVault({ resources: false });
		const { view } = makeMyWorkView(vault);
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
	});

	it('asks for a person when nothing is picked', () => {
		const { view } = makeMyWorkView(myWorkVault());
		expect(view.pickedPerson).toBeNull();
		expect(view.viewEl.querySelector('.pbl-empty')).not.toBeNull();
	});

	it('remembers the pick across a remount of the same base', () => {
		const vault = myWorkVault();
		makeMyWorkView(vault).view.pick('People/Ada.md');
		expect(makeMyWorkView(vault).view.pickedPerson).toBe('People/Ada.md');
	});

	it('keeps the pick when there is no view identity, instead of resetting it', () => {
		// An embedded base: `resolveViewIdentity` returns null on purpose, so the pick is
		// session-only. Assigning null in that branch would reset it on every data update.
		const { view } = makeMyWorkView(myWorkVault(), {}, { embedded: true });
		view.pick('People/Ada.md');
		view.onDataUpdated();
		expect(view.pickedPerson).toBe('People/Ada.md');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/shell.test.ts`
Expected: FAIL — `test/helpers/mywork` not found.

- [ ] **Step 3: Add `prefs.person` to the store**

In `src/storage/viewStateStore.ts` — the file's own comment says a third path-valued pref
is one entry and nothing else, so this is that entry:

```ts
const PATH_PREFS = ['scope', 'release', 'person'] as const;
```

In `ViewPrefs`:

```ts
	/**
	 * The person whose work is on screen, as a `Resource` note path — absent when nobody is
	 * picked. A working position, per device and per saved view, never a `.base` setting
	 * (ADR 0011): one saved view serves everybody, so the pick cannot be a value the file
	 * carries.
	 *
	 * `PATH_PREFS`' third entry, and that is all a path-valued pref costs:
	 * `renamePathPrefs` then carries it, so renaming a resource note keeps the panel on the
	 * same person instead of emptying it without a word.
	 */
	person?: string;
```

In `PREF_READERS`, beside `release`, with its stated reason — a path is checked by
resolving it, which this layer cannot do:

```ts
	person: anyName,
```

- [ ] **Step 4: Extend the store test and run it**

In `test/storage/viewStateStore.test.ts`, beside the existing rename cases:

```ts
	it('carries a renamed person pick', () => {
		saveViewState(app, id, { folds: emptyFolds, prefs: { person: 'People/Ada.md' } });
		renamePathPrefs(app, 'People/Ada.md', 'Team/Ada Lovelace.md');
		expect(loadViewState(app, id).prefs.person).toBe('Team/Ada Lovelace.md');
	});
```

Run: `npx vitest run test/storage/viewStateStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the view**

`src/view/mywork/myWorkView.ts`, modelled on `src/view/release/releaseView.ts`.

```ts
export const MY_WORK_VIEW_TYPE = 'product-my-work';

export class MyWorkView extends BasesView {
	type = MY_WORK_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: MyWorkSettings;
	model: BacklogModel | null = null;
	/** The person whose tree is on screen, or null before anybody is picked. */
	pickedPerson: string | null = null;
	/**
	 * The settings the MODEL was built from, and therefore what the gate validates and what
	 * a write plans against. Held rather than re-resolved at the write, so the plan and the
	 * model can never be two resolvers disagreeing about one config.
	 */
	planSettings: BacklogSettings = defaultSettings();
	/** The roving selection's row — the FILE, never its path: Obsidian mutates the one
	 *  `TFile` in place on a rename, so the identity survives what a path cannot. */
	activeRowFile: TFile | null = null;
	/** Whether the TREE held focus just before the current render detached it. */
	treeHadFocus = false;
	readonly opener = new OpenController();
	readonly gate: WriteGate<ItemWrite>;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-mw-view' });
		// Nothing to render until Bases delivers the first result set — say what is
		// happening rather than showing an empty pane.
		this.viewEl.setText(t('mywork.loading'));
		// `config`/`data`/`app` are assigned after construction, so the first resolve reads a
		// config answering "nothing is set" rather than `this.config`.
		this.settings = resolveMyWorkSettings({ get: () => undefined, getAsPropertyId: () => null } as never);
		this.gate = new WriteGate<ItemWrite>(
			{
				app: () => this.app,
				writeProblems: () => configProblems(this.planSettings),
				// The context-row rule, structurally: a row the Base excluded is never a write
				// target, so a batch naming one is refused WHOLE rather than filtered.
				outsideFilter: (path) => this.model?.byPath.get(path)?.outsideFilter === true,
			},
			{ syncBusy: () => this.syncBusy(), flushDataUpdate: () => this.refresh() },
			lock,
			(writes, onProgress, onInverse) => applyWrites(this.app, this.planSettings, writes, onProgress, onInverse),
		);
	}

	onunload(): void {
		this.gate.dispose();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		// A batch write touches one file at a time; deferring the rebuild until the whole
		// batch settles keeps a multi-key write from redrawing mid-flight.
		if (this.gate.deferUpdate()) return;
		this.refresh();
	}

	refresh(): void {
		this.settings = resolveMyWorkSettings(this.config);
		this.restorePick();
		this.render();
	}

	openContext(): OpenContext {
		return { app: this.app, viewEl: this.viewEl, settings: { openIn: this.settings.openIn } };
	}

	/** Picking a person. Persists, clears the roving row — a pick is a change of tree, and
	 *  a row selected in Ada's tree is not where Bo's should start — then redraws. */
	pick(path: string | null): void {
		this.pickedPerson = path;
		this.activeRowFile = null;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) {
			const state = loadViewState(this.app, id);
			saveViewState(this.app, id, { ...state, prefs: { ...state.prefs, person: path ?? undefined } });
		}
		this.render();
	}

	/** LEAVE THE FIELD ALONE with no identity: an embedded base's pick is session-only, and
	 *  assigning null here would reset it on every data update (`releaseView.ts`). */
	private restorePick(): void {
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (!id) return;
		this.pickedPerson = loadViewState(this.app, id).prefs.person ?? null;
	}

	render(): void {
		this.viewEl.empty();
		// A property nothing is bound to is a configuration to fix, and a different answer
		// from a base that simply holds no people.
		if (!this.settings.assigneeKey) {
			guidanceShell(this.viewEl, 'settings-2', t('mywork.empty.noAssignee.title'), t('mywork.empty.noAssignee.hint'));
			return;
		}
		// The model is built with THIS view's own mappings layered onto the backlog
		// resolver's — `resolveSettings` reads through `propKey`, which cannot tell a cleared
		// option from an unset one, so a property this view reports as unbound would come
		// back as the default and the tree would nest by a mapping the options screen says is
		// off. Two resolvers disagreeing at the model boundary is the same defect as one view
		// reading another's configuration.
		this.planSettings = {
			...resolveSettings(this.config),
			typeKey: this.settings.typeKey,
			parentKey: this.settings.parentKey,
			orderKey: this.settings.orderKey,
			assigneeKey: this.settings.assigneeKey,
			stateKey: this.settings.stateKey,
			doneValues: this.settings.doneValues,
		};
		this.model = buildModel(this.app, this.data.data, this.planSettings);
		if (this.model.resources.length === 0) {
			guidanceShell(this.viewEl, 'users', t('mywork.empty.noRoster.title'), t('mywork.empty.noRoster.hint'));
			return;
		}
		// The picker is drawn in every state that HAS a roster, including the two below: the
		// way out of "nobody picked" is the control itself.
		drawMyWorkToolbar(this, this.viewEl);
		if (this.pickedPerson === null || !this.model.byPath.has(this.pickedPerson)) {
			guidanceShell(this.viewEl, 'user-round-search', t('mywork.empty.noPick.title'), t('mywork.empty.noPick.hint'));
			return;
		}
		drawMyWorkTree(this, this.viewEl);
	}

	private syncBusy(): void {
		// Nothing to publish yet — Task 8 gives the toolbar its indicator.
	}
}
```

Until Tasks 6 and 8 land, declare `drawMyWorkToolbar` and `drawMyWorkTree` as one-line
local stubs in this file and move them out in their own tasks. A stub that draws nothing
keeps this task's tests honest and the build green.

- [ ] **Step 6: Register it**

`src/view/mywork/register.ts`:

```ts
import { Plugin } from 'obsidian';
import { getMyWorkViewOptions } from '../../domain/myWorkOptions';
import { MY_WORK_VIEW_TYPE, MyWorkView } from './myWorkView';
import { WriteLock } from '../writeLock';
import { t } from '../../i18n/t';

/**
 * The my-work view's own registration — one file per view, so a fourth capability adds a
 * file rather than a branch in main (ADR 0030). The lock arrives from main because the
 * write path is the one piece of plugin-wide runtime state: a state set here is in the
 * same undo slot as a state set on the board.
 */
export function registerMyWorkView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(MY_WORK_VIEW_TYPE, {
		// An ordinary view-type label, so it is translated — only the plugin's own identity
		// in `registerBacklogView.ts` gets the eslint-disable.
		name: t('mywork.viewName'),
		icon: 'lucide-user-round-check',
		factory: (controller, containerEl) => new MyWorkView(controller, containerEl, lock),
		options: getMyWorkViewOptions,
	});
}
```

and one line in `src/main.ts` beside the other three: `registerMyWorkView(this, lock);`.

- [ ] **Step 7: Add the catalog keys**

In `src/i18n/en.ts`, beside the `release.*` block:

```ts
	'mywork.viewName': 'My work',
	'mywork.loading': 'Loading assigned work…',
	'mywork.empty.noAssignee.title': 'No assignee property is set',
	'mywork.empty.noAssignee.hint': 'Pick the property your notes name a person in, in this view’s options.',
	'mywork.empty.noRoster.title': 'This base returns no people',
	'mywork.empty.noRoster.hint': 'A person is a note of type Resource. Widen the filter, or make one.',
	'mywork.empty.noPick.title': 'Pick a person',
	'mywork.empty.noPick.hint': 'Their work appears below in plan order, with the next thing to do marked.',
```

- [ ] **Step 8: Write the test helper**

`test/helpers/mywork.ts`, in `test/helpers/release.ts`'s shape:
`myWorkVault(opts)` builds an Epic, a Feature, two PBIs assigned to two different people, a
third assigned to nobody, one `outsideFilter` context ancestor and two `Resource` notes —
one of whom carries nothing. `makeMyWorkView(vault, config?, opts?)` mounts the view
through `mountLeaf`, with `opts.embedded` mounting it where `resolveViewIdentity` answers
null.

Every later task's tests read this one file, so write all of its accessors now, copied in
shape from `test/helpers/release.ts`: `row(view, path, { optional })`, `rowPaths(view)`,
`treeEl(view)`, `twisty(view, path)`, `press(view, key)`, `active(view)`,
`pickPerson(view, path)` (sets the `<select>` value and dispatches `change`, so the test
drives the real gesture), `menuOn(view, path)` (dispatches `contextmenu`),
`choose(menu, label)` and `labels(menu)` over `Menu.lastShown`, and a re-export of `flush`
from `test/helpers/view.ts`.

- [ ] **Step 9: Run the tests**

Run: `npx vitest run test/view/mywork test/storage/viewStateStore.test.ts`
Expected: PASS.

- [ ] **Step 10: Finish the PBI and commit**

`docs/requirements/The person is a pick.md`'s `## Where it lives` now also names
`src/view/mywork/myWorkView.ts`, `src/view/mywork/register.ts` and
`src/storage/viewStateStore.ts`, and states the ADR 0011 rule in prose: the pick is device
UI state, never a `.base` setting, because one saved view serves everybody.

```bash
git add src/view/mywork src/main.ts src/storage/viewStateStore.ts src/i18n/en.ts test/helpers/mywork.ts test/view/mywork test/storage/viewStateStore.test.ts "docs/requirements/The person is a pick.md"
git commit -m "Register the my-work view and remember whose work is on screen"
```

---

### Task 5: One fold set per scope, shared by both trees

The release tree's fold set is per release, because "is this row open in THIS release" is a
different question per release. This tree asks the identical question per person. Extract
rather than copy: the whole of what varies is the key prefix.

**Files:**

- Create: `src/view/scopeFolds.ts`
- Modify: `src/storage/foldKeys.ts` (add `MYWORK_FOLD`; teach `notePath` and `foldKeyPaths` the prefix)
- Modify: `src/storage/viewStateStore.ts` (add `myWorkHideDone?: boolean` to `ViewPrefs`, and `myWorkHideDone: onlyTrue` to `PREF_READERS` — absence IS the off state, so a default writes nothing; NOT a `PATH_PREFS` entry, since its value is a flag rather than a path)
- Modify: `src/view/release/scopeTree.ts` (delete the fold half, call the shared one)
- Modify: `src/view/viewState.ts` (re-export the new prefix beside the other three)
- Test: `test/view/scopeFolds.test.ts` (new); `test/view/release/*` and `test/storage/foldKeys.test.ts` must pass unchanged

**Interfaces:**

- Consumes: `loadViewState` / `saveViewState` (`src/storage/viewStateStore.ts`), `resolveViewIdentity` (`src/storage/viewIdentity.ts`), `childRows` (Task 1)
- Produces:
  - `interface FoldHost { app: App; viewEl: HTMLElement; config: { name?: string }; render(): void }`
  - `function foldedPaths(host: FoldHost, prefix: string, scopePath: string): Set<string>`
  - `function toggleFold(host: FoldHost, prefix: string, scopePath: string, path: string): void`
  - `function setAllFolds(host: FoldHost, prefix: string, scopePath: string, rows: ScopeRow[], folded: boolean): void`
  - `function scopeFlag(host: FoldHost, key: 'releaseHideDone' | 'myWorkHideDone'): boolean`
  - `function setScopeFlag(host: FoldHost, key: 'releaseHideDone' | 'myWorkHideDone', next: boolean): void`

- [ ] **Step 1: Write the failing test**

`test/view/scopeFolds.test.ts` — the same three questions the release fold tests ask,
asked of a host that is not a release view:

```ts
// @vitest-environment jsdom
it('folds a row under one scope without folding it under another', () => {
	toggleFold(host, PREFIX, 'People/Ada.md', 'Feature.md');
	expect([...foldedPaths(host, PREFIX, 'People/Ada.md')]).toEqual(['Feature.md']);
	expect([...foldedPaths(host, PREFIX, 'People/Bo.md')]).toEqual([]);
});

it('writes no key for a leaf when collapsing everything', () => {
	setAllFolds(host, PREFIX, 'People/Ada.md', rows, true);
	expect([...foldedPaths(host, PREFIX, 'People/Ada.md')]).toEqual(['Feature.md']);
});

it('falls back to a session-only set with no view identity', () => {
	// An embedded base: folds are gone on reload, and the tree is one press from reopening.
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/scopeFolds.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the code**

Move `foldPrefix`, `sessionFolds`, `readRawFolds`, `writeRawFolds`, `foldedPaths`,
`writeFolds`, `toggleFold` and `setAllFolds` out of `src/view/release/scopeTree.ts` into
`src/view/scopeFolds.ts` with their docblocks, replacing `ReleaseView` with `FoldHost` and
the hardcoded `RELEASE_FOLD` with a `prefix` parameter. `sessionFolds` becomes a
`WeakMap<FoldHost, string[]>`, so a remounted view still starts fresh. `hideDoneOn` and
`setHideDone` generalise the same way into `scopeFlag` / `setScopeFlag`, keeping the
"absence IS the off state" rule — a default writes nothing.

In `src/storage/foldKeys.ts`:

```ts
/**
 * Prefix marking a key as ONE PERSON's own fold state — {@link RELEASE_FOLD}'s reason with
 * the scope swapped. "Is this row open in Ada's tree" and "…in Bo's" are two questions
 * about one note, and one bit answering both would move a reader's place in the other
 * every time they used it. A shared ancestor sits in as many trees as it has assignees
 * below it, which is exactly the case a bare-path key gets wrong.
 */
export const MYWORK_FOLD = '\u0000mywork:';
```

Extend `notePath` and `foldKeyPaths` to treat it exactly as `RELEASE_FOLD`: both keys carry
two paths, so both answer from the LAST NUL, and both die with either of their notes.

- [ ] **Step 4: Call it from the release tree**

`scopeTree.ts` keeps `effectiveHideDone` — it asks a release-shaped question
(`release.done.unconfigured`) — and calls the shared functions with `RELEASE_FOLD` and
`release.path`.

- [ ] **Step 5: Run both suites**

Run: `npx vitest run test/view/scopeFolds.test.ts test/view/release test/storage/foldKeys.test.ts`
Expected: PASS, with no release assertion edited.

- [ ] **Step 6: Commit**

```bash
git add src/view/scopeFolds.ts src/storage/foldKeys.ts src/view/release src/view/viewState.ts test/view/scopeFolds.test.ts
git commit -m "Share one fold set per scope between the two trees that need one"
```

---

### Task 6: The tree, and what is next

**Files:**

- Create: `src/view/mywork/renderTree.ts`, `styles/mywork.css`
- Modify: `styles/index.css`, `src/i18n/en.ts`, `src/view/mywork/myWorkView.ts` (drop the stub)
- Test: `test/view/mywork/tree.test.ts`
- Docs: `docs/requirements/One person's tree.md`

**Interfaces:**

- Consumes: `assignedRows`, `nextAssigned` (Task 2); `rowsAfterHideDone`, `visibleRows`, `siblingPlaces`, `childRows` (Task 1); `foldedPaths`, `toggleFold`, `scopeFlag` (Task 5); `MYWORK_FOLD` (Task 5); `drawIcon` (`src/view/render/icons.ts`); `badgeStyleFor` (`src/view/render/badges.ts`); `uniqueElementId` (`src/view/selection.ts`); `ownWorkflowReading` (`src/domain/board.ts`)
- Produces:
  - `interface TreeDraw { treeEl: HTMLElement; rows: ScopeRow[]; kids: ReadonlySet<string>; rowEls: ReadonlyMap<string, HTMLElement>; folded: ReadonlySet<string> }`
  - `function drawMyWorkTree(view: MyWorkView, parentEl: HTMLElement): TreeDraw`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeMyWorkView, myWorkVault, row, rowPaths, twisty } from '../../helpers/mywork';

describe('the my-work tree', () => {
	it('draws a member under its ancestors, with the ancestors marked as context', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		expect(rowPaths(view)).toEqual(['Feature.md', 'Mine.md']);
		expect(row(view, 'Feature.md')!.classList.contains('pbl-mw-context')).toBe(true);
	});

	it('marks exactly one row as what is next', () => {
		const marked = view.viewEl.querySelectorAll('.pbl-mw-next');
		expect(marked).toHaveLength(1);
		expect(marked[0].closest('.pbl-row')?.getAttribute('data-path')).toBe('Mine.md');
	});

	it('marks nothing when everything of theirs is done', () => {
		expect(view.viewEl.querySelector('.pbl-mw-next')).toBeNull();
	});

	it('announces its OWN level and sibling place, not the backlog’s', () => {
		expect(row(view, 'Mine.md')!.getAttribute('aria-level')).toBe('2');
		expect(row(view, 'Mine.md')!.getAttribute('aria-setsize')).toBe('1');
	});

	it('folds a row, and it is still folded after a redraw', () => {
		twisty(view, 'Feature.md').click();
		expect(row(view, 'Mine.md', { optional: true })).toBeNull();
		view.render();
		expect(row(view, 'Mine.md', { optional: true })).toBeNull();
	});

	it('opens a note on a click, on a context row too', () => {
		row(view, 'Feature.md')!.click();
		// `FakeVault.opened` records `{ path, mode }` per `getLeaf().openFile()` — opening is
		// not a write, so a context row is a legitimate target for it.
		expect(view.app.vault.opened.map((o) => o.path)).toContain('Feature.md');
	});

	it('does not evict the note the reader is on', () => {
		// The Feature's whole outcome: the panel answers "what is mine, what is next"
		// WITHOUT taking over the pane being read. The mode recorded is never the one that
		// replaces the active leaf — `OpenController` reuses a side pane, and `openIn` is
		// this view's own option, so the reader decides where.
		row(view, 'Mine.md')!.click();
		expect(view.app.vault.opened.at(-1)!.mode).not.toBe(false);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/tree.test.ts`
Expected: FAIL — no rows are drawn.

- [ ] **Step 3: Write the renderer**

The sequence is `drawScopeTree`'s: hide-done first, fold second, `childRows` over the
hide-done list, `siblingPlaces` over the visible list. The CONTAINER is the tab stop —
`role="tree"`, `tabindex="0"` — with the keyboard moving a roving selection inside it
(Task 7). The `aria-label` is the person's own title, which is vault content and goes
nowhere near the catalog.

```ts
export function drawMyWorkTree(view: MyWorkView, parentEl: HTMLElement): TreeDraw {
	const person = view.model!.byPath.get(view.pickedPerson!)!;
	const treeEl = parentEl.createDiv({
		cls: 'pbl-tree pbl-mw-tree',
		attr: { role: 'tree', 'aria-label': person.title, tabindex: '0' },
	});
	const all = assignedRows(view.model!, view.pickedPerson!);
	const folded = foldedPaths(view, MYWORK_FOLD, view.pickedPerson!);
	// Hide-done first, fold second: `withKids` has to answer "does this row still have a
	// child" AFTER a finished subtree has gone, or a parent whose children all hid keeps a
	// disclosure over a subtree that is not there.
	const afterHide = rowsAfterHideDone(all, hidesDone(view));
	const withKids = childRows(afterHide);
	const visible = visibleRows(afterHide, folded);
	// Over the hide-done list rather than the visible one: what to do next does not change
	// because somebody folded the row above it.
	const next = nextAssigned(afterHide);
	// Built WHILE drawing rather than queried back out of the DOM — `src/view/CLAUDE.md`'s
	// `TREE_SCAN` bans that scan, and the keyboard looks a row up on every arrow key.
	const rowEls = new Map<string, HTMLElement>();
	for (const { row, pos, count } of siblingPlaces(visible)) {
		rowEls.set(
			row.item.file.path,
			drawRow(view, treeEl, row, {
				pos,
				count,
				hasKids: withKids.has(row.item.file.path),
				open: !folded.has(row.item.file.path),
				next: row === next,
			}),
		);
	}
	return { treeEl, rows: visible, kids: withKids, rowEls, folded };
}
```

`hidesDone` is this module's own one-line gate, exported so the toolbar and the tree can
never answer it differently about the same view — the stored flag AND a bound state key,
because a control that could hide rows with nothing left on screen to bring them back is
worse than no control (`effectiveHideDone`'s own rule, asked of this view's question):

```ts
export function hidesDone(view: MyWorkView): boolean {
	return scopeFlag(view, 'myWorkHideDone') && view.settings.stateKey !== '';
}
```

`drawRow` draws, in order: the disclosure (held on a leaf too, `visibility: hidden`, so a
level's titles share one x), the type badge, the title with its `setTooltip`, the
`.pbl-row-spacer`, the state chip as a static `.pbl-state-static` div, and the next marker.
Depth goes on the row through `setCssProps({ '--pbl-depth': String(row.depth) })`.
`aria-expanded` goes on the row and only where there is something to expand; `aria-selected`
is the keyboard's, never set at draw time.

The click opens the note through `view.opener.open(view.openContext(), row.item, evt)`,
guarded by `window.getSelection()?.isCollapsed === false` for the drag-select reason
`scopeTree.ts` records, with the `auxclick` pair beside it for the middle click a `click`
listener never sees.

Two keys join the catalog:

```ts
	'mywork.next': 'Next',
	'mywork.nextTip': 'The first unfinished item of theirs in plan order.',
```

- [ ] **Step 4: Write the stylesheet partial**

`styles/mywork.css`, imported from `styles/index.css`. Indent from `--pbl-depth`, as the
tree already does. Give the file a header saying whether its position in the import list is
load-bearing, and why — if it re-targets another partial's class, say which selector
outranks which; if it does not, say that.

- [ ] **Step 5: Run the test and the build**

Run: `npx vitest run test/view/mywork/tree.test.ts && npm run build`
Expected: PASS, and the assembled stylesheet builds (the partial is under 400 lines and is
imported).

- [ ] **Step 6: Look at it**

Run: `npm run harness -- test/harness/mywork.ts` once Task 10 writes that entry; before
then, `npm run harness` and drive the view through the console hook. Confirm the depth
ladder, the next marker and the context rows read as a tree. Say in the commit message what
this does NOT answer: a themed vault's colours and accent, and anything Bases hands the
view.

- [ ] **Step 7: Commit**

```bash
git add src/view/mywork styles/mywork.css styles/index.css src/i18n/en.ts test/view/mywork/tree.test.ts "docs/requirements/One person's tree.md"
git commit -m "Draw one person's tree, and mark what is next"
```

---

### Task 7: The keyboard, shared

A tree whose every row is a tab stop takes one Tab per item to cross. The release tree
already solves this with one tab stop and a roving `aria-activedescendant`, and the only
release-shaped things in that module are the view type and the fold scope.

**Files:**

- Create: `src/view/scopeKeys.ts` (git-moved from `src/view/release/scopeKeys.ts`)
- Delete: `src/view/release/scopeKeys.ts`
- Modify: `src/view/release/renderScope.ts`, `src/view/release/releaseView.ts` (field renames), `src/view/mywork/renderTree.ts`
- Test: `test/view/release/scopeKeys.test.ts` must pass unchanged; `test/view/mywork/keys.test.ts` (new)

**Interfaces:**

- Consumes: `toggleFold` (Task 5), `TreeDraw` (Task 6 — moved beside `wireScopeKeys` so neither module imports the other back, which is what keeps the pair a DAG rather than the cycle `npm run analyze` refuses)
- Produces:
  - `interface ScopeKeyHost extends FoldHost { opener: OpenController; openContext(): OpenContext; activeRowFile: TFile | null; treeHadFocus: boolean }`
  - `function wireScopeKeys(host: ScopeKeyHost, treeEl: HTMLElement, scope: { prefix: string; path: string }, draw: TreeDraw): void`

- [ ] **Step 1: Write the failing test**

`test/view/mywork/keys.test.ts`:

```ts
// @vitest-environment jsdom
it('moves the roving selection and points aria-activedescendant at it', () => {
	press(view, 'ArrowDown');
	expect(active(view)).toBe('Mine.md');
	expect(treeEl(view).getAttribute('aria-activedescendant')).toBe(row(view, 'Mine.md')!.id);
});

it('opens and closes a row with the arrow keys', () => { /* ArrowRight, ArrowLeft */ });

it('opens the note on Enter', () => { /* through openContext, never a write */ });

it('keeps the selected row across the redraw a fold causes', () => { /* activeRowFile */ });

it('reaches both ends with Home and End', () => { /* … */ });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/keys.test.ts`
Expected: FAIL — nothing wires a keydown.

- [ ] **Step 3: Move the module**

```bash
git mv src/view/release/scopeKeys.ts src/view/scopeKeys.ts
```

Replace `ReleaseView` with `ScopeKeyHost`, `releasePath` with the `scope` bag, and
`view.activeScopeFile` / `view.scopeHadFocus` with the interface's `activeRowFile` /
`treeHadFocus`. Rename those two fields on `ReleaseView` to match, so both views satisfy
one interface rather than the interface carrying two names for one idea. `ScopeDraw`
becomes `TreeDraw` in both callers.

- [ ] **Step 4: Wire both callers**

`renderScope.ts` passes `{ prefix: RELEASE_FOLD, path: release.path }`;
`renderTree.ts` passes `{ prefix: MYWORK_FOLD, path: view.pickedPerson! }` as the step after
the draw, exactly as `renderScope.ts` does.

- [ ] **Step 5: Run both suites**

Run: `npx vitest run test/view/release test/view/mywork`
Expected: PASS, with no release assertion edited.

- [ ] **Step 6: Commit**

```bash
git add -A src/view test/view "docs/requirements/One person's tree.md"
git commit -m "Share one scope-tree keyboard between the two trees that need one"
```

---

### Task 8: The toolbar — the person is picked here

**Files:**

- Create: `src/view/mywork/toolbar.ts`
- Modify: `src/view/mywork/myWorkView.ts` (drop the stub; wire `syncBusy`), `src/i18n/en.ts`
- Test: `test/view/mywork/toolbar.test.ts`
- Docs: `docs/requirements/The person is a pick.md`

**Interfaces:**

- Consumes: `namedTargets` (`src/domain/readItems.ts`) for the collision-aware labels, `model.resources` for the roster, `view.pick` (Task 4), `setAllFolds` / `scopeFlag` / `setScopeFlag` (Task 5)
- Produces: `function drawMyWorkToolbar(view: MyWorkView, parentEl: HTMLElement): void`

- [ ] **Step 1: Write the failing test**

```ts
it('lists every Resource note the base returned, including one carrying nothing', () => {
	const names = [...view.viewEl.querySelectorAll('.pbl-mw-person option')].map((o) => o.textContent);
	expect(names).toEqual(expect.arrayContaining(['Ada', 'Bo']));
});

it('names two people who share a basename apart', () => {
	// `namedTargets` gives the path-minus-extension for the pair that collides, and the
	// basename for everybody else.
});

it('picking a person persists and redraws', () => {
	pickPerson(view, 'People/Ada.md');
	expect(view.pickedPerson).toBe('People/Ada.md');
	expect(view.viewEl.querySelector('.pbl-mw-tree')).not.toBeNull();
});

it('withholds hide-done when no state property is bound', () => {
	// A control that could hide rows nothing can bring back is not drawn — the release
	// toolbar's own gate, asked of this view's own question.
});

it('collapses and expands every row of THIS person’s tree and no other', () => { /* … */ });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/toolbar.test.ts`
Expected: FAIL — no picker is drawn.

- [ ] **Step 3: Write the toolbar**

A native `<select>` over `namedTargets(view.model.resources)` — the control that already
collapses to nothing in a narrow pane, and that is reachable by keyboard and screen reader
with no code of ours — plus collapse-all, expand-all and hide-done, drawn exactly as
`scopeToolbar.ts` draws its three (`clickable-icon` buttons, `aria-label` and `setTooltip`
from one key each). Every label goes through `t()`; the option TEXT is a person's name and
is data.

New keys:

```ts
	'mywork.person': 'Person',
	'mywork.personPlaceholder': 'Nobody picked',
	'mywork.collapseAll': 'Collapse all',
	'mywork.expandAll': 'Expand all',
	'mywork.hideDone': 'Hide done',
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/view/mywork`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/view/mywork/toolbar.ts src/view/mywork/myWorkView.ts src/i18n/en.ts test/view/mywork/toolbar.test.ts "docs/requirements/The person is a pick.md"
git commit -m "Pick the person in the view, from the notes the base returned"
```

---

### Task 9: It is a place to work — one write, one gate

The epic's definition of done: an item can be acted on from the list, and every such write
goes through the same gate and the same context-row refusals as every other projection. The
smallest honest version of that is Set state from a row's menu.

**Files:**

- Create: `src/view/mywork/rowMenu.ts`
- Modify: `src/view/mywork/renderTree.ts` (wire `contextmenu`), `src/i18n/en.ts`
- Test: `test/view/mywork/writes.test.ts`
- Docs: `docs/requirements/A tree that fits a sidebar.md` (create, `order: 30`)

**Interfaces:**

- Consumes: `computeStateWrites` (`src/domain/writePlan.ts`), the state vocabulary (`src/domain/vocabulary.ts` — use the same reader the backlog's `Set state` menu uses), `todayCivil` (`src/domain/noteFields.ts`), `showMenuForClick` (`src/view/interactions/menu.ts`), `view.gate.applySafely`
- Produces: `function showMyWorkRowMenu(view: MyWorkView, row: ScopeRow, evt: MouseEvent): void`

- [ ] **Step 1: Write the failing test**

```ts
it('sets a state through the gate, and stamps it', async () => {
	menuOn(view, 'Mine.md');
	await choose(Menu.lastShown, 'Done');
	await flush();
	expect(vault.fm('Mine.md').state).toBe('Done');
	expect(vault.fm('Mine.md').finished).toBeTruthy();
});

it('offers NO writing action on a context row', () => {
	menuOn(view, 'Outside.md');
	expect(labels(Menu.lastShown)).toEqual([t('mywork.menu.open'), t('mywork.menu.openTab')]);
});

it('refuses the WHOLE batch if any write names an excluded note', async () => {
	await view.gate.applySafely([
		{ file: vault.file('Mine.md'), state: 'Done' },
		{ file: vault.file('Outside.md'), state: 'Done' },
	]);
	await flush();
	expect(vault.fm('Outside.md').state).toBeUndefined();
	expect(vault.fm('Mine.md').state).toBeUndefined();   // rejected, never filtered
});

it('checks the entry the plan would write nothing for', () => {
	// The checkmark is asked of the PLAN, never of a comparison written beside it: the two
	// drift the moment a second property joins, and an entry that removes a key would be
	// offered as the current one.
});

it('blocks every write while the settings have a problem', async () => {
	// `configProblems` is non-empty — the gate refuses before anything is touched.
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/writes.test.ts`
Expected: FAIL — no menu is shown.

- [ ] **Step 3: Write the menu**

```ts
export function showMyWorkRowMenu(view: MyWorkView, row: ScopeRow, evt: MouseEvent): void {
	const menu = new Menu();
	addOpenSection(menu, view, row.item);
	// The context-row rule, at the one place this surface could break it: such a row
	// renders, it parents, and that is all — no Set state, and no action that would write
	// to a note the Base excluded. `applySafely` refuses one structurally as well; this is
	// what keeps the UI from offering an action it would then refuse.
	if (!row.context && view.settings.stateKey) addSetStateMenu(menu, view, row.item);
	showMenuForClick(menu, evt);
}
```

`addSetStateMenu` checks an entry exactly when picking it would write nothing —
`computeStateWrites(item, state, view.planSettings, todayCivil()).length === 0` — asked of
the PLAN, never of a comparison beside it. Its `onClick` calls
`void view.gate.applySafely(computeStateWrites(item, state, view.planSettings, todayCivil()))`.

New keys: `mywork.menu.open`, `mywork.menu.openTab`, `mywork.menu.setState`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/view/mywork/writes.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the context-row test fail without the guard**

Delete the `!row.context` clause, re-run, watch the context-row test go red, restore it. An
invariant asserted in a comment gets a test that fails without it, and the test is watched
failing.

- [ ] **Step 6: Write the PBI and commit**

Create `docs/requirements/A tree that fits a sidebar.md` — `type: PBI`,
`parent: "[[Assigned work in the sidebar]]"`, `order: 30`, `status: Open`, six sections in
order. `## Where it lives` names `src/view/mywork/rowMenu.ts`,
`src/view/mywork/renderTree.ts`, `src/view/mywork/toolbar.ts`, `src/view/scopeFolds.ts`,
`src/view/scopeKeys.ts` and `styles/mywork.css`.

```bash
git add src/view/mywork/rowMenu.ts src/view/mywork/renderTree.ts src/i18n/en.ts test/view/mywork/writes.test.ts "docs/requirements/A tree that fits a sidebar.md"
git commit -m "Let a row be acted on, through the same gate and the same refusals"
```

---

### Task 10: A tree that survives a sidebar's width

Where the view is docked is Obsidian's business — a `.base` tab drags into the left sidebar
already. What the plugin owes is that nothing in the panel needs width it will not get.

**Files:**

- Modify: `styles/mywork.css`
- Create: `test/harness/mountMyWork.ts`, `test/harness/mywork.ts`
- Modify: `test/harness/harness.test.ts` if it enumerates the entries
- Test: `test/view/mywork/narrow.test.ts`
- Docs: `docs/requirements/A tree that fits a sidebar.md`

- [ ] **Step 1: Write the failing test**

jsdom lays nothing out, so the assertion is about what the markup PROMISES rather than
about measured pixels — the honest half, with the looking done in the browser harness at
Step 5.

```ts
it('gives the panel a container the narrow rules can key on', () => {
	expect(view.viewEl.classList.contains('pbl-mw-view')).toBe(true);
});

it('draws no fixed-width property column', () => {
	expect(view.viewEl.querySelector('.pbl-col')).toBeNull();
});

it('keeps the person picker in every state that has a roster', () => {
	// It is the one control the panel cannot do without: the way out of "nobody picked".
	expect(view.viewEl.querySelector('.pbl-mw-person')).not.toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/narrow.test.ts`

- [ ] **Step 3: Make the panel narrow-safe**

In `styles/mywork.css`, key the rules on a **container query** over `.pbl-mw-view` rather
than a viewport media query: the PANE is narrow, the window is not, and a sidebar in a wide
window is exactly the case a media query gets wrong.

```css
.pbl-mw-view {
	container-type: inline-size;
}

/* What goes first is what the panel does not exist to answer. The title, the depth and the
   next marker stay at every width; the state chip and the rollup are decoration once the
   row has no room for them. */
@container (max-width: 260px) {
	.pbl-mw-view .pbl-state-static,
	.pbl-mw-view .pbl-mw-rollup {
		display: none;
	}
	.pbl-mw-view .pbl-mw-toolbar {
		flex-wrap: wrap;
	}
}
```

- [ ] **Step 4: Write the browser-harness entry**

`test/harness/mountMyWork.ts` and `test/harness/mywork.ts`, copied in shape from
`mountRelease.ts` and `release.ts`: `?person=People/Ada.md` goes through the real `pick`, so
it persists exactly as a click's would, and `?width=280` sets the container width so the
narrow rungs can be looked at. Add the fixture people to `test/helpers/fixtures.ts` if the
shared demo results carry none.

- [ ] **Step 5: Look at it, at three widths**

Run: `npm run harness -- test/harness/mywork.ts`
Open the page at 240px, 320px and 600px. Confirm nothing clips, nothing overlaps, and the
tree still reads as a tree. Record what this does not answer: a themed vault's colours, its
accent, and anything Bases hands the view — those need the live-vault check.

- [ ] **Step 6: Run and commit**

Run: `npx vitest run test/view/mywork test/harness && npm run build`

```bash
git add styles/mywork.css test/harness test/view/mywork/narrow.test.ts "docs/requirements/A tree that fits a sidebar.md"
git commit -m "Keep the tree readable at a sidebar's width"
```

---

### Task 11: The register, the catalog check, and the whole gate

**Files:**

- Create: `test/i18n/mywork.test.ts`
- Modify: `CHANGELOG.md`, the three PBIs, `docs/requirements/Assigned work in the sidebar.md`
- Modify: `docs/README.md` only if its tree paragraph needs the fourth view named

- [ ] **Step 1: Write the i18n test**

`test/i18n/mywork.test.ts`, in `test/i18n/projections.test.ts`'s shape rather than
`estimation.test.ts`'s: mark the WHOLE catalog, drive the view through every state —
unconfigured, no roster, nobody picked, a tree, the menu — and assert that everything
rendering UNMARKED is data (a note title, a person's name, a state value). A per-slice list
of keys checks the ones somebody remembered; the whole-catalog form is the only one that
can fail for a call site nobody listed. The two shapes no lint rule can see are a template
whose first quasi is empty and a sentence handed to a helper as an argument, and both have
shipped here before.

- [ ] **Step 2: Run it**

Run: `npx vitest run test/i18n`
Expected: PASS — or a genuine finding, which is the point of this shape.

- [ ] **Step 3: Add the changelog entry**

Under `## [Unreleased]` in `CHANGELOG.md`:

```markdown
### Added

- **My work** — a fourth Bases view showing one person's work as a backlog tree, with the
  person picked in the view rather than in the Base. Dock the tab wherever you want it; the
  toolbar, the chips and the tree give way in a narrow pane. The pick, the folds and "hide
  done" are remembered per device and per saved view.
```

- [ ] **Step 4: Close the notes**

Set `status: Done`, `started` and `finished` on the three PBIs and on
`docs/requirements/Assigned work in the sidebar.md`, and check the sibling `order` values
are unique among the Feature's children — `npm run docs` gates the hierarchy and the
sibling orders.

- [ ] **Step 5: Run the whole gate**

Run: `npm run check`
Expected: all six steps pass, on this tree. On a coverage failure, look for the DEAD branch
before writing a test, and do not lower a floor: `scripts/coverage-floors.mjs` reports the
headroom each one has.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "Say what the my-work view is, in the register and the changelog"
git push -u origin claude/assigned-work-backlog-tree-fkj69a
```

- [ ] **Step 7: Open the pull request**

Ready for review, not a draft. Name in the body what still needs a live-vault smoke test —
Obsidian cannot run here, and saying so is part of the handover:

- the panel docked in a real left sidebar, at the widths people actually use;
- a themed vault's colours and accent, which the harness answers for Obsidian's defaults only;
- the view appearing in Bases' own view picker under its translated name;
- the pick surviving an Obsidian restart, which only a real `localStorage` can show.

Mention `npm run test-build` in the body: it installs the plugin into this repository, whose
`docs/` is already a backlog with `docs/Product Backlog.base` in it, so the reviewer can
open the register with the plugin displaying it.

---

## What this plan deliberately does NOT build

- **No ✨ init.** The unconfigured state explains which property to bind and stops there —
  `releaseView.ts`'s own `noType` state, for its reason. The backlog's `runInit` reaches
  `BacklogViewHost` and `computeInitWrites`, neither of which knows this view exists, so
  reusing it would mean satisfying a host interface in order to withhold most of it.
- **No drag, no reparenting, no ranking.** Plan order answers "what is next"; a second
  `order` per person would be a second ranking graph, which this register refuses.
- **No comparing people and no summing load.** That belongs to Product Operations, and
  [[My work]] draws that line explicitly — both epics were written on the same day and both
  wanted the same calculation.
- **One write, not a full editing surface.** Set state satisfies "it is a place to work";
  anything wider is its own PBI under this Feature, written when somebody asks for it.
- **`view/render/rows.ts` is not reused.** It is built around `BacklogViewHost` and the
  backlog view's own columns, so reusing it would mean satisfying that host in order to
  withhold most of it — the call `renderScope.ts` already made, for the same reason. What
  IS shared is what is genuinely the same shape: the scope walk, the fold set, the
  keyboard, the badges and the icons.
