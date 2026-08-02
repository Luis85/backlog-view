# Per-column agreements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each configured workflow state a WIP limit and a written policy, shown on its board column, so the board reports overcommitment as it happens and carries the team's working agreement where the work is.

**Architecture:** One mechanism, two payloads. `viewOptions.ts` generates a `wipLimit.<state>` and a `columnPolicy.<state>` option per configured state — the way it already generates a `typeFolder.<type>` per type. `settings.ts` resolves them into two name-keyed tables. `board.ts` reads each table once while it builds the column, so `BoardColumn` carries its own `limit` and `policy` and nothing downstream does a lookup. `render/board.ts` draws them; `interactions/menu.ts` gains a one-entry column menu the header and the keyboard both open.

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom environments), ESLint with type-aware rules, fallow.

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`. Each may reach anything below it and nothing above. Enforced by per-directory `no-restricted-imports` in `eslint.config.mjs` — a violation fails `npm run lint`.
- **400-line maximum** per file in `src/`, **450** in `test/`. Enforced by lint.
- **Never write frontmatter outside `storage/frontmatter.ts`.** Nothing in this plan writes anything; no task may import a write path.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`. Marketplace rules, enforced by lint and review.
- **`showAtMouseEvent` is banned outside `src/view/interactions/menu.ts`** — a lint rule. Menus opened from a click go through `showMenuForClick`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Every "run it to verify it fails" step below is mandatory, not decorative.
- **Coverage thresholds only ever go up** (`vitest.config.mts`). Do not lower one to make a task pass.
- **Definition of done:** `npm run check` — build, lint, coverage-thresholded tests, fallow, docs register. All five, before every commit.
- **Branch:** `claude/next-increment-brainstorm-ev1n6l`. Do not push to another.
- **Spec:** `docs/superpowers/specs/2026-08-02-per-column-agreements-design.md`.

---

## File Structure

| File | Change |
| --- | --- |
| `src/domain/settings.ts` | Modify — `byName`, `nameTable`, `wipLimitKey`, `columnPolicyKey`, `parseWipLimit`, two new `BacklogSettings` fields and their resolution |
| `src/domain/viewOptions.ts` | Modify — `progressGroup` generates the two option families from the configured states |
| `src/domain/board.ts` | Modify — `BoardColumn.limit`, `BoardColumn.policy`, `overBy` |
| `src/view/render/board.ts` | Modify — the limit span, the over-limit signal, the policy affordance, the spoken label, the header's `contextmenu` |
| `src/view/interactions/menu.ts` | Modify — `buildColumnMenu`, `showColumnMenu` |
| `src/view/host.ts` | Modify — `showColumnMenuFor(index)` on `BacklogViewHost` |
| `src/view/backlogView.ts` | Modify — implement `showColumnMenuFor` |
| `src/view/interactions/keyboard.ts` | Modify — `isMenuKey`, the column-stop branch |
| `styles.css` | Modify — five new rules |
| `test/domain/settings.test.ts` | Modify — resolution, parsing, the prototype guard |
| `test/domain/viewOptions.test.ts` | Modify — which options are generated for which states |
| `test/domain/board.test.ts` | Modify — the column carries its limit and policy; `overBy` |
| `test/docs/surfaces.test.ts` | Modify — the generated per-state keys, discovered by calling the schema |
| `test/view/board.test.ts` | Modify — the header |
| `test/view/columnAgreements.test.ts` | Create — the policy affordance, the column menu, the keyboard path, and the invariant |

`test/view/columnAgreements.test.ts` is a new file rather than more of
`test/view/boardMenu.test.ts` for one reason: that file is 311 lines against a 450-line
budget, and the three groups below would take it past it. Splitting by subject before a
file becomes the place tests hide is the project's own rule.
| `docs/requirements/WIP limits.md` | Modify — `Done`, real `## Where it lives` |
| `docs/requirements/Explicit policies on the column.md` | Modify — `Done`, the menu sentence amended |
| `docs/requirements/Drag a card to a new state.md` | Modify — `Done` |
| `docs/issues/A renamed state orphans its limit.md` | Create |
| `docs/issues/Smoke test the column agreements.md` | Create |
| `docs/README.md` | Modify — the Product Kanban paragraph gains the fourth increment |

---

### Task 1: Settings — the two tables

**Files:**
- Modify: `src/domain/settings.ts`
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export function byName<T>(table: Record<string, T>, name: string | null): T | undefined`
  - `export function wipLimitKey(state: string): string` → `wipLimit.<lowercased>`
  - `export function columnPolicyKey(state: string): string` → `columnPolicy.<lowercased>`
  - `BacklogSettings.wipLimits: Record<string, number>` — keyed lowercase, absent means unlimited
  - `BacklogSettings.columnPolicies: Record<string, string>` — keyed lowercase, absent means none

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/settings.test.ts`, inside the existing `describe('resolveSettings', …)` block:

```ts
	it('reads a WIP limit and a policy for each configured state', () => {
		const settings = resolveSettings(
			fakeConfig({
				stateValues: 'New, In review, Done',
				doneValues: 'Done',
				'wipLimit.in review': '3',
				'columnPolicy.in review': 'Reviewed by someone who did not write it',
			}),
		);
		expect(settings.wipLimits['in review']).toBe(3);
		expect(settings.columnPolicies['in review']).toBe('Reviewed by someone who did not write it');
	});

	it('refuses a limit on a done state, even one hand-written into the base', () => {
		// Extension 1b: WIP is what sits between started and finished, so a done
		// column has no limit — and the SETTINGS are where that is decided, not the
		// schema, or a key left behind by re-marking a state as done would revive it.
		const settings = resolveSettings(
			fakeConfig({ stateValues: 'New, Done', doneValues: 'Done', 'wipLimit.done': '2', 'columnPolicy.done': 'Nothing left to do' }),
		);
		expect(settings.wipLimits['done']).toBeUndefined();
		// A policy is not a limit: a done column can carry a working agreement.
		expect(settings.columnPolicies['done']).toBe('Nothing left to do');
	});

	it('treats an unparseable limit as no limit, never as zero', () => {
		// A `.base` file is hand-editable, so every one of these can arrive. An unset
		// limit is NOT a limit of zero — extension 1a says so, and zero would put every
		// column permanently over.
		for (const raw of ['', '   ', '0', '-2', 'three', '2.5', 'NaN']) {
			const settings = resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.new': raw }));
			expect(settings.wipLimits['new'], `limit from ${JSON.stringify(raw)}`).toBeUndefined();
		}
		expect(resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.new': ' 4 ' })).wipLimits['new']).toBe(4);
	});

	it('keys a state named after something on Object.prototype without inheriting it', () => {
		// State values are user data. `table['constructor']` finds a function, and every
		// truthy guard downstream passes — the defect this project has now shipped three
		// times on three different tables.
		const settings = resolveSettings(fakeConfig({ stateValues: 'constructor, toString', 'wipLimit.constructor': '2' }));
		expect(settings.wipLimits['constructor']).toBe(2);
		expect(byName(settings.wipLimits, 'toString')).toBeUndefined();
		expect(byName(settings.columnPolicies, 'constructor')).toBeUndefined();
	});

	it('ignores a limit or policy for a state the workflow does not name', () => {
		const settings = resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.archived': '1', 'columnPolicy.archived': 'gone' }));
		expect(settings.wipLimits['archived']).toBeUndefined();
		expect(settings.columnPolicies['archived']).toBeUndefined();
	});
```

Add `byName` to the import list at the top of the file:

```ts
import {
	adoptableProperties,
	byName,
	configProblems,
	defaultSettings,
	horizonMenuValues,
	OPTIONAL_FIELDS,
	OPTIONAL_PROPERTIES,
	optionalKeyFor,
	optionalProperty,
	resolveSettings,
	stateMenuValues,
} from '../../src/domain/settings';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: FAIL — `byName` is not exported, and `wipLimits` / `columnPolicies` do not exist on the resolved settings.

- [ ] **Step 3: Add the fields to `BacklogSettings`**

In `src/domain/settings.ts`, after the `doneValues` field:

```ts
	/**
	 * WIP limit per column, keyed by LOWERCASED state value. Absent means unlimited,
	 * which is NOT a limit of zero. Done states never appear here whatever the `.base`
	 * holds: WIP is what sits between started and finished, and capping the archive is
	 * a different idea wearing the same word.
	 */
	wipLimits: Record<string, number>;
	/**
	 * The working agreement written on a column, keyed by LOWERCASED state value.
	 * Absent means none, and a column with none shows no affordance at all. Unlike a
	 * limit, a done column may carry one.
	 */
	columnPolicies: Record<string, string>;
```

- [ ] **Step 4: Generalise the name table and add the key builders**

Replace `byTypeName` (currently at `src/domain/settings.ts:129`) with the pair below, keeping its whole doc comment on `byName` — the comment is the record of a defect that shipped three times and must not be lost.

**The delegate is deliberate, and a reviewer should hold it to this reason rather than
to "one-line wrappers are indirection".** `byTypeName` has four call sites —
`src/domain/settings.ts:150`, `src/domain/itemTypes.ts:1` and `:96`, and
`src/view/render/rows.ts:8` and `:233` — plus two mentions in `CLAUDE.md` files. Three
of those files are ones the milestones increment is editing right now, and
`render/rows.ts:233` is `EXTRA_TYPE_STYLE`, which that increment changes by definition.
A rename would be tidier and would collide in the other branch's hottest files; the
delegate collides with nothing. Rename it once milestones has landed.

```ts
export function byName<T>(table: Record<string, T>, name: string | null): T | undefined {
	if (name === null) return undefined;
	const key = name.toLowerCase();
	return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** The same lookup, named for the table it was written for. */
export function byTypeName<T>(table: Record<string, T>, typeName: string | null): T | undefined {
	return byName(table, typeName);
}
```

Replace `typeFoldersFor` (currently at `src/domain/settings.ts:156`) with the generalised table builder:

```ts
/**
 * A table keyed by lowercased name, skipping every name the reader has no value for.
 * Null-prototype, because the names are user data: a type or a state called
 * `constructor` must be a plain key rather than a collision with something inherited
 * off `Object`. Read it back with {@link byName}, never with a bare index.
 */
function nameTable<T>(names: string[], read: (name: string) => T | null): Record<string, T> {
	const table: Record<string, T> = Object.create(null) as Record<string, T>;
	for (const name of names) {
		const value = read(name);
		if (value !== null) table[name.toLowerCase()] = value;
	}
	return table;
}
```

Both former call sites of `typeFoldersFor` become `nameTable` calls with the empty string mapped to `null`. In `defaultSettings()` (currently `src/domain/settings.ts:190`):

```ts
		typeFolders: nameTable(ALL_TYPES, (t) => defaultTypeFolder(t) || null),
```

and in `resolveFolders` (currently `src/domain/settings.ts:463`):

```ts
		typeFolders: nameTable(types, (type) =>
			clearable(typeFolderKey(type), defaultTypeFolder(type, homeFolder), () =>
				vaultFolder(str(typeFolderKey(type))),
			) || null,
		),
```

Add the key builders beside `typeFolderKey`:

```ts
/**
 * The persisted option key for one state's WIP limit. Shared by the schema that
 * declares the option and the resolver that reads it back, for the reason
 * {@link typeFolderKey} gives: a key spelled twice is a key that can differ, and this
 * one is user data in a `.base` file.
 */
export function wipLimitKey(state: string): string {
	return `wipLimit.${state.toLowerCase()}`;
}

/** The persisted option key for one state's column policy. */
export function columnPolicyKey(state: string): string {
	return `columnPolicy.${state.toLowerCase()}`;
}

/**
 * A WIP limit as read from a hand-editable `.base`: a whole number of one or more, or
 * null for no limit. Everything else — empty, blank, zero, negative, fractional,
 * non-numeric — is no limit, because an unset limit is not a limit of zero and a
 * column pinned permanently over its limit says nothing at all.
 */
function parseWipLimit(raw: string): number | null {
	const n = Number(raw.trim());
	return Number.isInteger(n) && n >= 1 ? n : null;
}
```

- [ ] **Step 5: Resolve the two tables**

In `defaultSettings()`, beside `doneValues`:

```ts
		wipLimits: nameTable<number>([], () => null),
		columnPolicies: nameTable<string>([], () => null),
```

In `resolveSettings`, after the existing `const doneValues = list('doneValues');` and after `states` is computed (it is `dedupe(list('stateValues'))` — hoist it into a `const states` above the returned object if it is still inline):

```ts
	const states = dedupe(list('stateValues'));
	const doneSet = new Set(doneValues.map((v) => v.toLowerCase()));
	// Limits are refused for done states HERE rather than only in the schema, so a key
	// left in the `.base` by re-marking a state as done cannot revive its limit.
	const limitedStates = states.filter((s) => !doneSet.has(s.toLowerCase()));
```

and in the returned object, replacing the existing `states: dedupe(list('stateValues')),`:

```ts
		states,
		wipLimits: nameTable(limitedStates, (s) => parseWipLimit(str(wipLimitKey(s)))),
		columnPolicies: nameTable(states, (s) => str(columnPolicyKey(s)).trim() || null),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: PASS, including the pre-existing `falls back to defaults for an empty config`, which compares the whole object — two empty null-prototype tables satisfy it.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS. If lint reports `byTypeName` as an unused export, do **not** delete it — check `src/domain/itemTypes.ts:96` still imports it and fix the import instead.

- [ ] **Step 8: Commit**

```bash
git add src/domain/settings.ts test/domain/settings.test.ts
git commit -m "Resolve a WIP limit and a policy per configured state"
```

---

### Task 2: The generated view options

**Files:**
- Modify: `src/domain/viewOptions.ts`
- Test: `test/domain/viewOptions.test.ts`, `test/docs/surfaces.test.ts`

**Interfaces:**
- Consumes: `wipLimitKey`, `columnPolicyKey`, `BacklogSettings.states`, `BacklogSettings.doneValues` from Task 1.
- Produces: option keys `wipLimit.<lowercased state>` and `columnPolicy.<lowercased state>` in the Progress group of `getViewOptions(config)`.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/viewOptions.test.ts`, inside `describe('getViewOptions', …)`:

```ts
	it('generates a limit and a policy box per configured state', () => {
		const flat = getViewOptions(fakeConfig({ stateValues: 'New, In review, Done', doneValues: 'Done' })).flatMap(
			(o) => ('items' in o ? o.items : [o]),
		);
		const keys = flat.map((o) => o.key);
		expect(keys).toContain('wipLimit.new');
		expect(keys).toContain('wipLimit.in review');
		expect(keys).toContain('columnPolicy.new');
		expect(keys).toContain('columnPolicy.done');
		// A done column has no limit to set, so it is not offered one.
		expect(keys).not.toContain('wipLimit.done');
	});

	it('offers neither until a workflow is stated', () => {
		// With no `stateValues` the board falls back to observed values, which are not a
		// workflow anyone agreed. Limits and policies are agreements; there is nothing
		// to attach them to, so the Progress group is unchanged.
		const keys = getViewOptions(fakeConfig())
			.flatMap((o) => ('items' in o ? o.items : [o]))
			.map((o) => o.key);
		expect(keys.filter((k) => k.startsWith('wipLimit.') || k.startsWith('columnPolicy.'))).toEqual([]);
	});
```

Append to `test/docs/surfaces.test.ts`, after `includes the keys generated per type, which no scan of the source could see`:

```ts
	it('includes the keys generated per configured state, and names their families', () => {
		// These keys cannot be enumerated the way the per-type ones can — they are built
		// from the user's own workflow — so what a requirement names is the FAMILY, and
		// what this asserts is that the schema really generates one per state.
		const keys = optionKeys(fakeConfig({ stateValues: 'New, In review, Done', doneValues: 'Done' }));
		expect(keys).toContain('wipLimit.in review');
		expect(keys).toContain('columnPolicy.in review');
		expect(keys).not.toContain('wipLimit.done');
		expect(named('wipLimit')).toBe(true);
		expect(named('columnPolicy')).toBe(true);
	});
```

`optionKeys` in that file currently takes no argument and `fakeConfig` does not exist there. Change its signature and add the double:

```ts
/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return { get: (key: string) => values[key], getAsPropertyId: () => null } as never;
}

/** Every option, flattened out of its groups — the shape Bases is handed. */
function optionKeys(config?: BasesViewConfig): string[] {
	const keys: string[] = [];
	for (const entry of getViewOptions(config)) {
		const group = entry as { items?: { key?: string }[]; key?: string };
		if (Array.isArray(group.items)) keys.push(...group.items.map((i) => i.key ?? ''));
		else if (group.key) keys.push(group.key);
	}
	return keys;
}
```

with `import { BasesViewConfig } from 'obsidian';` added at the top of `test/docs/surfaces.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/viewOptions.test.ts test/docs/surfaces.test.ts`
Expected: FAIL — no `wipLimit.*` key is generated, and `named('wipLimit')` is false because no requirement names the family yet.

- [ ] **Step 3: Generate the options**

In `src/domain/viewOptions.ts`, extend the imports from `./settings`:

```ts
import {
	ALL_TYPES,
	columnPolicyKey,
	DEFAULT_DONE_VALUES,
	DEFAULT_HOME_FOLDER,
	DEFAULT_HORIZON_VALUES,
	DEFAULT_PROP_COLUMN_WIDTH,
	defaultSettings,
	defaultTypeFolder,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
	OptionalField,
	optionalProperty,
	resolveSettings,
	typeFolderKey,
	wipLimitKey,
} from './settings';
```

`getViewOptions` resolves once and hands the settings to the Progress group:

```ts
export function getViewOptions(config?: BasesViewConfig): BasesAllOptions[] {
	// The type list is fixed, but each type's DEFAULT folder sits under this view's home
	// folder — so the callback still reads the config. Declaring the shipped `docs/…`
	// here regardless would make every picker in a `Roadmap` base advertise a folder the
	// creation flow does not use, and restoring that shown default would move the type.
	//
	// The workflow states are the same idea taken further: they are user data outright,
	// so the limit and policy boxes exist only once a workflow does.
	const settings = config ? resolveSettings(config) : defaultSettings();
	return [
		hierarchyGroup(),
		progressGroup(settings),
		roadmapGroup(),
		newItemsGroup(settings.homeFolder),
		displayGroup(),
	];
}
```

`progressGroup` takes the settings and appends the two families after the existing `startedDate` / `finishedDate` pickers:

```ts
function progressGroup(settings: BacklogSettings): BasesAllOptions {
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	return {
		type: 'group',
		displayName: 'Progress',
		items: [
			// KEEP all seven existing items exactly as they are — the state property
			// picker, stateValues, doneValues, startedStates, the two date pickers and
			// whatever else the group already holds. Only the spread below is new.
			// One box per configured state, the mechanism the per-type folder keys use.
			// A limit is `text` rather than `slider` because a slider always holds a
			// number and cannot say "unset" — and an unset limit is not a limit of zero.
			...settings.states.flatMap((state): BasesOptions[] => [
				...(done.has(state.toLowerCase())
					? []
					: [
							{
								type: 'text',
								key: wipLimitKey(state),
								displayName: `WIP limit for ${state}`,
								default: '',
								placeholder: 'No limit',
							} as BasesOptions,
						]),
				{
					type: 'text',
					key: columnPolicyKey(state),
					displayName: `Policy for ${state}`,
					default: '',
					placeholder: 'What has to be true to leave this column',
				} as BasesOptions,
			]),
		],
	};
}
```

Import `BacklogSettings` as a type from `./settings` if it is not already imported.

- [ ] **Step 4: Name the two families in the requirements**

`test/docs/surfaces.test.ts` reads only **code spans** in `docs/requirements/`, so the families have to be written as code. In `docs/requirements/WIP limits.md`, replace the `## Where it lives` section:

```markdown
## Where it lives

One generated option per configured state — `wipLimit.<state>`, lowercased, the
mechanism the per-type folder keys already use — declared in
`src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`, which is also
where a done state is refused a limit. The column carries its own limit
(`src/domain/board.ts`), the header draws it (`src/view/render/board.ts`), and no
write path imports `overBy` at all — the cheapest possible guarantee that a limit
refuses nothing.

Driven by `test/domain/settings.test.ts`, `test/domain/viewOptions.test.ts`,
`test/domain/board.test.ts`, `test/view/board.test.ts` and — for the guarantee —
`test/view/columnAgreements.test.ts`, which drives every board write path against a
column already over its limit.
```

In `docs/requirements/Explicit policies on the column.md`, replace its `## Where it lives`:

```markdown
## Where it lives

One generated option per configured state — `columnPolicy.<state>`, lowercased,
declared in `src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`. The
column carries its own policy (`src/domain/board.ts`); the header's affordance and its
`aria-describedby` are in `src/view/render/board.ts`, and the column menu is
`buildColumnMenu` in `src/view/interactions/menu.ts`, opened by the header and by
`src/view/interactions/keyboard.ts` on the selected column stop.

Driven by `test/domain/viewOptions.test.ts`, `test/domain/board.test.ts` and
`test/view/columnAgreements.test.ts`.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/domain/viewOptions.test.ts test/docs/surfaces.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS. `npm run docs` will flag the two requirement notes if any `src/` or `test/` path above is misspelled — every one of them must exist.

- [ ] **Step 7: Commit**

```bash
git add src/domain/viewOptions.ts test/domain/viewOptions.test.ts test/docs/surfaces.test.ts "docs/requirements/WIP limits.md" "docs/requirements/Explicit policies on the column.md"
git commit -m "Offer a WIP limit and a policy box per configured state"
```

---

### Task 3: The column carries its own limit and policy

**Files:**
- Modify: `src/domain/board.ts`
- Test: `test/domain/board.test.ts`

**Interfaces:**
- Consumes: `byName`, `BacklogSettings.wipLimits`, `BacklogSettings.columnPolicies` from Task 1.
- Produces:
  - `BoardColumn.limit: number | null`
  - `BoardColumn.policy: string`
  - `export function overBy(col: BoardColumn): number` — cards over the limit, `0` when at, under, or unlimited.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/board.test.ts`:

```ts
describe('a column carries its own agreement', () => {
	const limited = {
		...settings,
		wipLimits: { active: 2 } as Record<string, number>,
		columnPolicies: { active: 'Someone is actually working on it' } as Record<string, string>,
	};

	function board(vault: FakeVault, s = limited) {
		const model = buildModel(vault.app, vault.entries(), s);
		return boardColumns(model, s, everything);
	}

	function column(vault: FakeVault, label: string, s = limited) {
		const col = board(vault, s).columns.find((c) => c.label === label);
		if (!col) throw new Error(`column not found: ${label}`);
		return col;
	}

	function vaultWith(...states: string[]): FakeVault {
		const vault = new FakeVault();
		states.forEach((status, i) => vault.addFile(`A${i}.md`, { frontmatter: { type: 'Epic', order: i, status } }));
		return vault;
	}

	it('reads the limit and the policy off the settings, keyed by its own state', () => {
		const col = column(vaultWith('Active'), 'Active');
		expect(col.limit).toBe(2);
		expect(col.policy).toBe('Someone is actually working on it');
	});

	it('leaves an unconfigured column with no limit and no policy', () => {
		const col = column(vaultWith('New'), 'New');
		expect(col.limit).toBeNull();
		expect(col.policy).toBe('');
	});

	it('gives the no-state column neither, without reading a key off Object.prototype', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const col = column(vault, NO_STATE_LABEL);
		expect(col.limit).toBeNull();
		expect(col.policy).toBe('');
	});

	it('counts the overage from the FULL population, never the matches', () => {
		// Extension 4a: a filter that made an over-limit column look under its limit
		// would turn a search into a lie about the work.
		const vault = vaultWith('Active', 'Active', 'Active');
		const model = buildModel(vault.app, vault.entries(), limited);
		const filtered = boardColumns(
			model,
			limited,
			(item) => item.file.path === 'A0.md',
			() => true,
		);
		const col = filtered.columns.find((c) => c.label === 'Active');
		expect(col?.count).toBe(1);
		expect(col?.fullCount).toBe(3);
		expect(overBy(col as BoardColumn)).toBe(1);
	});

	it('is not over at the limit, and never over without one', () => {
		expect(overBy(column(vaultWith('Active', 'Active'), 'Active'))).toBe(0);
		expect(overBy(column(vaultWith('New', 'New', 'New'), 'New'))).toBe(0);
	});
});
```

Extend the imports at the top of `test/domain/board.test.ts`:

```ts
import { boardColumns, BoardColumn, NO_STATE_COLLISION_LABEL, NO_STATE_LABEL, overBy } from '../../src/domain/board';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/board.test.ts`
Expected: FAIL — `overBy` is not exported and `col.limit` does not exist.

- [ ] **Step 3: Add the fields and the predicate**

In `src/domain/board.ts`, add to the `BoardColumn` interface after `outsideWorkflow`:

```ts
	/**
	 * The agreed work-in-progress limit for this stage, or null for none. Never set on
	 * the no-state column or a done one — {@link BacklogSettings.wipLimits} is where
	 * that is decided, so nothing here has to remember it.
	 */
	limit: number | null;
	/** The working agreement written on this stage in the view options, or ''. */
	policy: string;
```

In `workflowColumns`, inside the `column` factory, after `done`:

```ts
		// `byName`, never a bare index: a state value is user data, and a workflow may
		// legitimately contain a state called `constructor`.
		limit: byName(settings.wipLimits, state) ?? null,
		policy: byName(settings.columnPolicies, state) ?? '',
```

Import `byName` from `./settings`.

Add the predicate beside `boardColumns`:

```ts
/**
 * How many cards this column holds beyond what was agreed — 0 at the limit, under it,
 * or with no limit at all. Reads {@link BoardColumn.fullCount}, never `count`: a filter
 * that made an over-limit column look under its limit would turn a search into a lie
 * about the work.
 *
 * Nothing that PLANS a write imports this. A limit never refuses a move, and a planner
 * that cannot see a limit cannot consult one.
 */
export function overBy(col: BoardColumn): number {
	return col.limit === null ? 0 : Math.max(0, col.fullCount - col.limit);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/domain/board.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: PASS. Other suites construct `BoardColumn` literals; if any fails to compile, add `limit: null, policy: ''` to that literal rather than making the fields optional — an optional field is a third state nobody meant.

- [ ] **Step 6: Commit**

```bash
git add src/domain/board.ts test/domain/board.test.ts
git commit -m "Give a board column its own limit and policy"
```

---

### Task 4: The header draws the limit

**Files:**
- Modify: `src/view/render/board.ts`, `styles.css`
- Test: `test/view/board.test.ts`

**Interfaces:**
- Consumes: `BoardColumn.limit`, `overBy` from Task 3.
- Produces: `.pbl-board-col-limit` span, `.pbl-board-col-over` on the header, `.pbl-board-col-over-icon`, and the limit clause in the column's `aria-label`.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/board.test.ts`, inside the top-level `describe`:

```ts
	/** The board's own workflow, with a limit of two on Active. */
	const LIMITED = { ...WORKFLOW, 'wipLimit.active': '2' };

	/** N epics, all Active, so the Active column can be filled past its limit. */
	function activeVault(n: number): FakeVault {
		const vault = new FakeVault();
		for (let i = 1; i <= n; i++) {
			vault.addFile(`E${i}.md`, { frontmatter: { type: 'Epic', order: i * 10, status: 'Active' } });
		}
		return vault;
	}

	it('shows the count against the limit, and nothing when no limit is set', () => {
		const { containerEl } = boardView(boardVault(), LIMITED);
		expect(columnByName(containerEl, 'Active').querySelector('.pbl-board-col-limit')?.textContent).toBe('/ 2');
		expect(columnByName(containerEl, 'New').querySelector('.pbl-board-col-limit')).toBeNull();
	});

	it('signals an over-limit column in more than colour alone', () => {
		const { containerEl } = boardView(activeVault(3), LIMITED);
		const header = columnByName(containerEl, 'Active').querySelector('.pbl-board-col-header');
		// The class is the colour; the icon is what survives a colour-blind reader and
		// a monochrome screenshot. Asserting only the class would pass on a signal
		// nobody can see.
		expect(header?.classList.contains('pbl-board-col-over')).toBe(true);
		expect(header?.querySelector('.pbl-board-col-over-icon')).not.toBeNull();
	});

	it('is not over at the limit', () => {
		const { containerEl } = boardView(activeVault(2), LIMITED);
		const header = columnByName(containerEl, 'Active').querySelector('.pbl-board-col-header');
		expect(header?.classList.contains('pbl-board-col-over')).toBe(false);
		expect(header?.querySelector('.pbl-board-col-over-icon')).toBeNull();
	});

	it('speaks the limit and the overage as part of the column', () => {
		const { containerEl } = boardView(activeVault(3), LIMITED);
		expect(columnByName(containerEl, 'Active').getAttribute('aria-label')).toBe(
			'Active, 3 cards, limit 2, over by 1',
		);
	});

	it('keeps the signal reading the full population under a filter', async () => {
		// Extension 4a. The pair count narrows; the limit clause does not.
		const { containerEl, view } = boardView(activeVault(3), LIMITED);
		view.setFilter('E1');
		await flush();
		const col = columnByName(containerEl, 'Active');
		expect(col.getAttribute('aria-label')).toBe('Active, 1 of 3 cards match, limit 2, over by 1');
		expect(col.querySelector('.pbl-board-col-header')?.classList.contains('pbl-board-col-over')).toBe(true);
	});
```

`boardView`, `WORKFLOW`, `columnByName`, `flush` and `FakeVault` are all already in this
file's scope. `view.setFilter(text)` followed by `await flush()` is exactly how
`test/view/boardFilter.test.ts` drives the quick filter.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/view/board.test.ts`
Expected: FAIL — no `.pbl-board-col-limit` element, and the label has no limit clause.

- [ ] **Step 3: Draw it**

In `src/view/render/board.ts`, import `overBy` from `../../domain/board`, then extend `columnLabel`:

```ts
function columnLabel(col: BoardColumn, filtering: boolean): string {
	// Always col.label, never the constant: the synthetic column yields its name
	// when a real state claims it, and an accessible name that kept the old text
	// would disagree with the screen — unreachable by the very speech input that
	// targets columns by their visible name.
	const label = col.state === null ? `${col.label} — dropping here clears the state` : col.label;
	// Filtered, the count is a pair and has to be spoken as one: "2 cards" in a column
	// of eleven would tell a screen-reader user the stage had emptied.
	const counts = filtering
		? `${col.count} of ${col.fullCount} cards match`
		: `${col.count} card${col.count === 1 ? '' : 's'}`;
	if (col.limit === null) return `${label}, ${counts}`;
	// The overage is spoken because the icon beside it is not: an over-limit column
	// has to say so to someone who cannot see either the colour or the shape.
	const over = overBy(col);
	return `${label}, ${counts}, limit ${col.limit}${over > 0 ? `, over by ${over}` : ''}`;
}
```

and `renderColumnHeader`'s `if (!strip)` block:

```ts
	if (!strip) {
		// A column is a stage of the workflow, not a search result: while the filter
		// narrows the cards the header says how many of the stage's work it matched, so
		// nobody reads a filtered board as a column that emptied.
		const count = filtering ? `${col.count} of ${col.fullCount}` : String(col.count);
		header.createSpan({ cls: 'pbl-board-col-count' + (filtering ? ' pbl-board-col-count-filtered' : ''), text: count });
		if (col.limit !== null) {
			header.createSpan({ cls: 'pbl-board-col-limit', text: `/ ${col.limit}` });
			// More than colour alone: the class carries the colour, the icon carries the
			// shape, and `columnLabel` carries the words.
			if (overBy(col) > 0) {
				header.addClass('pbl-board-col-over');
				setIcon(header.createSpan({ cls: 'pbl-board-col-over-icon' }), 'triangle-alert');
			}
		}
	}
```

- [ ] **Step 4: Add the styles**

Append to `styles.css`, beside the existing `.pbl-board-col-count-filtered` rule:

```css
/* The limit reads with the count, not against it: "3 / 2" is one quantity in two
   parts, so it takes the count's own muted treatment until the column is over. */
.pbl-board-col-limit {
	flex: 0 0 auto;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}

/* Over the limit is a signal, never a refusal — so it colours the numbers rather
   than the column, and the icon beside them is what a monochrome screenshot keeps. */
.pbl-board-col-over .pbl-board-col-count,
.pbl-board-col-over .pbl-board-col-limit {
	color: var(--text-error);
}

.pbl-board-col-over-icon {
	display: flex;
	align-items: center;
	color: var(--text-error);
}

.pbl-board-col-over-icon .svg-icon {
	width: 14px;
	height: 14px;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/board.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/view/render/board.ts styles.css test/view/board.test.ts
git commit -m "Say how full a column is against what was agreed"
```

---

### Task 5: The policy, its affordance and its menu

**Files:**
- Modify: `src/view/render/board.ts`, `src/view/interactions/menu.ts`, `src/view/host.ts`, `src/view/backlogView.ts`, `styles.css`, `test/helpers/obsidian-mock.ts`
- Create: `test/view/columnAgreements.test.ts`

**Interfaces:**
- Consumes: `BoardColumn.policy` from Task 3.
- Produces:
  - `export function buildColumnMenu(policy: string): Menu | null` in `interactions/menu.ts`
  - `export function showColumnMenu(evt: MouseEvent, policy: string): void` in `interactions/menu.ts`
  - `showColumnMenuFor(index: number): void` on `BacklogViewHost`
  - `.pbl-board-col-policy` affordance and a `.pbl-sr-only` description element on the header

- [ ] **Step 1: Teach the Menu double about disabled items**

`test/helpers/obsidian-mock.ts`'s `MenuItem` has `setTitle`, `setIcon`, `setChecked`,
`onClick` and `setSubmenu`, and no `setDisabled` — so the entry built below would throw.
Add it beside `setChecked`, in the same shape:

```ts
	disabled = false;

	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		return this;
	}
```

- [ ] **Step 2: Write the failing tests**

Create `test/view/columnAgreements.test.ts`. `useViewHarness()` resets `Menu.lastShown`
between tests (`test/helpers/view.ts:32`), which the "no menu" tests depend on.

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { useViewHarness } from '../helpers/view';
import { boardVault, columnByName, makeBoard } from '../helpers/board';

useViewHarness();

/** The board's workflow with a policy written on one column. */
const POLICY = {
	stateProperty: 'note.status',
	stateValues: 'New, Active, Done',
	'columnPolicy.active': 'Someone is actually on it',
};

/** A column's header element, which is where every agreement is drawn. */
function headerOf(containerEl: HTMLElement, name: string): HTMLElement {
	const header = columnByName(containerEl, name).querySelector<HTMLElement>('.pbl-board-col-header');
	if (!header) throw new Error(`no header for column: ${name}`);
	return header;
}

describe('a column carries its policy', () => {
	it('shows an affordance and describes the column with the policy', () => {
		const { containerEl } = makeBoard(boardVault(), POLICY);
		const header = headerOf(containerEl, 'Active');
		expect(header.querySelector('.pbl-board-col-policy')).not.toBeNull();
		const describedBy = header.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(containerEl.querySelector(`#${describedBy ?? ''}`)?.textContent).toBe('Someone is actually on it');
		// Described, not NAMED: the policy says what the column is for, and folding it
		// into the accessible name would make speech input target a column by a
		// paragraph. The label is exactly what it was before the policy existed.
		expect(columnByName(containerEl, 'Active').getAttribute('aria-label')).toBe('Active, 1 card');
	});

	it('leaves a column with no policy completely unchanged', () => {
		// Extension 1a: no empty affordances, and nothing suggesting a feature the user
		// has not asked for.
		const header = headerOf(makeBoard(boardVault(), POLICY).containerEl, 'New');
		expect(header.querySelector('.pbl-board-col-policy')).toBeNull();
		expect(header.hasAttribute('aria-describedby')).toBe(false);
	});

	it('opens the policy from the header context menu', () => {
		const { containerEl } = makeBoard(boardVault(), POLICY);
		headerOf(containerEl, 'Active').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Someone is actually on it']);
	});

	it('offers no menu at all on a column with no policy', () => {
		const { containerEl } = makeBoard(boardVault(), POLICY);
		headerOf(containerEl, 'New').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown).toBeNull();
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/view/columnAgreements.test.ts`
Expected: FAIL — no `.pbl-board-col-policy` element and no menu on `contextmenu`.

- [ ] **Step 4: Build the menu**

In `src/view/interactions/menu.ts`:

```ts
/**
 * The column's menu. A policy is text, not an action, so its one entry is disabled:
 * the menu exists to make the policy reachable without a pointer, and an entry that
 * looked clickable would promise a command that does not exist.
 *
 * Null when there is no policy — a column with nothing agreed offers no menu at all,
 * rather than an empty one.
 */
export function buildColumnMenu(policy: string): Menu | null {
	if (!policy) return null;
	const menu = new Menu();
	menu.addItem((mi) => mi.setTitle(policy).setIcon('info').setDisabled(true));
	return menu;
}

/** The pointer path onto that menu. */
export function showColumnMenu(evt: MouseEvent, policy: string): void {
	const menu = buildColumnMenu(policy);
	if (!menu) return;
	evt.preventDefault();
	showMenuForClick(menu, evt);
}
```

- [ ] **Step 5: Draw the affordance and wire the header**

In `src/view/render/board.ts`, `renderColumn` passes the column's index so the description element gets a stable unique id:

```ts
	const colEls = board.columns.map((col, index) => renderColumn(ctx, colsEl, col, index, dnd, carded));
```

`renderColumn(ctx, colsEl, col, index, dnd, carded)` forwards it to `renderColumnHeader(colEl, col, index, strip, filtering)`, whose tail gains:

```ts
	if (col.policy) {
		// Described rather than named: the policy says what the column is FOR, and
		// folding it into the accessible NAME would make speech input target a column
		// by a paragraph. Extension 3a keeps it off the tab order — the affordance is a
		// span, and the keyboard path is the column's menu.
		const description = header.createSpan({ cls: 'pbl-sr-only', text: col.policy });
		description.id = `pbl-col-policy-${index}`;
		header.setAttr('aria-describedby', description.id);
		const affordance = header.createSpan({ cls: 'pbl-board-col-policy' });
		setIcon(affordance, 'info');
		setTooltip(affordance, col.policy);
		header.addEventListener('contextmenu', (evt) => showColumnMenu(evt, col.policy));
	}
```

Import `showColumnMenu` alongside the existing `showItemMenu` import.

- [ ] **Step 6: Add the affordance style**

Append to `styles.css`, after the over-limit rules from Task 4:

```css
/* The policy affordance sits with the column's other markers, muted until pointed at:
   an agreement is reference material, not a status. */
.pbl-board-col-policy {
	display: flex;
	align-items: center;
	color: var(--text-muted);
}

.pbl-board-col-policy .svg-icon {
	width: 14px;
	height: 14px;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/view/columnAgreements.test.ts`
Expected: PASS.

- [ ] **Step 8: Add the host method**

In `src/view/host.ts`, beside `showContextMenuFor`:

```ts
	/** Open the column's own menu, anchored to the column that index names. */
	showColumnMenuFor(index: number): void;
```

In `src/view/backlogView.ts`, beside `showContextMenuFor`:

```ts
	showColumnMenuFor(index: number): void {
		const col = this.board?.board.columns[index];
		const el = this.board?.colEls[index];
		if (!col || !el) return;
		const menu = buildColumnMenu(col.policy);
		if (!menu) return;
		// Anchored to the column's own element, exactly as `showContextMenuFor` anchors
		// to the row's: a keyboard-opened menu has no pointer to sit under.
		const rect = el.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}
```

Import `buildColumnMenu` from `./interactions/menu`.

- [ ] **Step 9: Run the full check**

Run: `npm run check`
Expected: PASS. If fallow reports `showColumnMenuFor` as an unused class member, it is because the keyboard branch that calls it lands in Task 6 — finish Task 6 before diagnosing further, and if it still reports, annotate the local (`const host: BacklogViewHost = ctx.host`) rather than adding it to `usedClassMembers`.

`npm run docs` will fail here until Task 2's `## Where it lives` sections name
`test/view/columnAgreements.test.ts`: every test file must be named by at least one note.
If Task 2 is already done, this passes; if it is not, do that edit now rather than
skipping the check.

- [ ] **Step 10: Commit**

```bash
git add src/view/render/board.ts src/view/interactions/menu.ts src/view/host.ts src/view/backlogView.ts styles.css test/helpers/obsidian-mock.ts test/view/columnAgreements.test.ts
git commit -m "Put the column's working agreement on the column"
```

---

### Task 6: The keyboard reaches the column menu

**Files:**
- Modify: `src/view/interactions/keyboard.ts`
- Test: `test/view/columnAgreements.test.ts`

**Interfaces:**
- Consumes: `showColumnMenuFor(index)` from Task 5.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/columnAgreements.test.ts`, as a second `describe`:

```ts
describe('the keyboard reaches the column menu', () => {
	it('opens the policy from the selected column stop', () => {
		// The board is one tab stop by design, so a per-column control would multiply
		// stops by columns (extension 3a). The menu is the keyboard path instead.
		const { containerEl, view } = makeBoard(boardVault(), POLICY);
		view.selectBoardColumn(columnNames(containerEl).indexOf('Active'));
		key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Someone is actually on it']);
	});

	it('opens nothing from a column with no policy', () => {
		const { containerEl, view } = makeBoard(boardVault(), POLICY);
		view.selectBoardColumn(columnNames(containerEl).indexOf('New'));
		key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown).toBeNull();
	});

	it('still opens the CARD menu when a card is selected, not the column one', () => {
		// The two menus share a key. A branch that read the column first would take the
		// card's menu away on every board, and no test above would notice.
		const { containerEl } = makeBoard(boardVault(), POLICY);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		key(treeOf(containerEl), 'ContextMenu');
		expect(Menu.lastShown?.item('Set state')).toBeDefined();
	});
});
```

Extend this file's imports:

```ts
import { key, treeOf, useViewHarness } from '../helpers/view';
import { boardVault, cardByTitle, columnByName, columnNames, makeBoard } from '../helpers/board';
```

`key(treeOf(containerEl), …)` is how `test/view/boardMoves.test.ts` drives the board's tab
stop; clicking a card to select it is how that same suite's `select` helper works.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/view/columnAgreements.test.ts`
Expected: FAIL on the first two — a column stop swallows the key and opens nothing. The third should already pass; if it does not, the card path is broken before this task touches it and that is the bug to fix first.

- [ ] **Step 3: Add the branch**

In `src/view/interactions/keyboard.ts`, extract the key test both paths now share:

```ts
/** The two keys that mean "open the context menu where I am standing". */
function isMenuKey(evt: KeyboardEvent): boolean {
	return evt.key === 'ContextMenu' || (evt.key === 'F10' && evt.shiftKey);
}
```

`handleBoardCardKey` uses it:

```ts
	} else if (isMenuKey(evt)) {
		// The menu is the path that works everywhere a drag cannot, so it has to be
		// reachable from the keyboard on the board exactly as it is in the tree.
		evt.preventDefault();
		host.showContextMenuFor(card);
	}
```

and the tail of `handleBoardKeydown` gains the column case:

```ts
	const card = pos && pos.card >= 0 ? snapshot.board.columns[pos.col].cards[pos.card] : null;
	if (card) handleBoardCardKey(host, card, evt);
	// A column stop is a place to stand too, and the policy is the one thing there is
	// to say about it. The card branch runs first: the two menus share a key, and the
	// card is the more specific selection.
	else if (pos && isMenuKey(evt)) {
		evt.preventDefault();
		host.showColumnMenuFor(pos.col);
	}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/view/columnAgreements.test.ts test/view/boardMoves.test.ts test/view/keyboard.test.ts`
Expected: PASS. The last two are in the run because `isMenuKey` was extracted out of a path they already cover.

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/view/interactions/keyboard.ts test/view/columnAgreements.test.ts
git commit -m "Reach a column's policy from the keyboard"
```

---

### Task 7: The invariant — a limit refuses nothing

**Files:**
- Modify: `test/view/columnAgreements.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

This task adds no source code. It is the check behind the guarantee both use cases state, written from the rule rather than from the implementation, in the shape `test/view/contextCardWrites.test.ts` uses for the context-row rule: **every** input, driven against a column already over its limit, so a fourth input added later fails it without anyone predicting the surface.

- [ ] **Step 1: Write the test**

Append to `test/view/columnAgreements.test.ts` as a third `describe`:

```ts
describe('a WIP limit never refuses a write', () => {
	/** Active is limited to one and already holds two — every move below overfills it. */
	const OVERFULL = { stateProperty: 'note.status', stateValues: 'New, Active, Done', 'wipLimit.active': '1' };

	function overfullVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
		vault.addFile('C.md', { frontmatter: { type: 'Epic', order: 30, status: 'Active' } });
		return vault;
	}

	it('applies a drop into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		cardDrag(cardByTitle(containerEl, 'A'), columnByName(containerEl, 'Active'));
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('applies an Alt+arrow move into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		// "A" is in New, which is column 1; one to the right is Active.
		cardByTitle(containerEl, 'A').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('applies a menu Set state into a column that is already over', async () => {
		const vault = overfullVault();
		const { containerEl } = makeBoard(vault, OVERFULL);
		cardByTitle(containerEl, 'A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Active')?.click();
		await flush();
		expect(vault.fm('A.md')['status']).toBe('Active');
	});

	it('says the column is over afterwards, rather than having stopped the move', () => {
		// The guarantee is not "nothing happens" but "the move happens and the board
		// says so". Asserting only the writes above would pass on a board that had
		// quietly stopped signalling.
		const { containerEl } = makeBoard(overfullVault(), OVERFULL);
		expect(headerOf(containerEl, 'Active').classList.contains('pbl-board-col-over')).toBe(true);
	});
});
```

Extend this file's imports once more:

```ts
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';
import { flush, key, treeOf, useViewHarness } from '../helpers/view';
```

Every call above is the spelling the existing board suites use: `cardDrag(cardEl, columnEl)`
then `await flush()` (`test/view/boardMoves.test.ts`), `vault.fm(path)['status']` for the
written frontmatter, and `Menu.lastShown?.item('Set state')?.submenu` for the state submenu
(`test/view/boardMenu.test.ts`).

- [ ] **Step 2: Run it and watch it pass, then watch it fail**

Run: `npx vitest run test/view/columnAgreements.test.ts`
Expected: PASS — nothing consults a limit, which is the point.

A test that passes the moment it is written has proved nothing. Temporarily make the one
write path consult the limit: in `src/view/backlogView.ts`'s `performBoardMove`, find the
target column in `this.board?.board.columns` and `return` early when `overBy(it) > 0`.
Re-run.
Expected: FAIL on the drop, the Alt+arrow and the menu alike — all three, because all
three land on `performBoardMove`. If only one fails, the other two are not reaching that
method and the test is weaker than it reads.

Then revert. This is the "watch it failing" step the project's own rule requires.

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: PASS, with `git diff src/` showing the temporary refusal is gone.

- [ ] **Step 4: Commit**

```bash
git add test/view/columnAgreements.test.ts
git commit -m "Check that no board write path is refused by a limit"
```

---

### Task 8: The register

**Files:**
- Modify: `docs/requirements/WIP limits.md`, `docs/requirements/Explicit policies on the column.md`, `docs/requirements/Drag a card to a new state.md`, `docs/README.md`
- Create: `docs/issues/A renamed state orphans its limit.md`, `docs/issues/Smoke test the column agreements.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a register that passes `npm run docs`.

- [ ] **Step 1: Close the three use cases**

In `docs/requirements/WIP limits.md` and `docs/requirements/Explicit policies on the column.md`, set `status: Done` in the frontmatter and add `closed: 2026-08-02`. Their `## Where it lives` sections were already rewritten in Task 2.

In `docs/requirements/Explicit policies on the column.md`, amend the acceptance criterion that reads *"from the column's context menu — the same menu the selected column already offers for creation"* to:

```markdown
- A column whose state has a policy shows an affordance on its header, and the text
  is reachable without new tab stops: by pointer on the affordance, and from the
  column's context menu — introduced by this use case, and the shell
  [[New cards in place]] later hangs creation off — with assistive technology
  hearing it as the column's description.
```

Make the same change to step 3 of its main flow, which carries the same claim.

In `docs/requirements/Drag a card to a new state.md`, set `status: Done` and add
`closed: 2026-08-02`. Its `## Where it lives` currently ends:

> Still Active, not Done, on one honest technicality: the over-limit acceptance
> criterion cannot be *exercised* until [[WIP limits]] exists to put a column over one.

Replace that paragraph with what closed it:

```markdown
That technicality is gone: [[WIP limits]] ships the limits, and
`test/view/columnAgreements.test.ts` drives the drop, the Alt+arrow and the menu each
into a column already over one, then checks the column still says it is over — the
move happening and the board reporting it are one criterion, not two.
```

- [ ] **Step 2: Write the limitation Issue**

Create `docs/issues/A renamed state orphans its limit.md`:

```markdown
---
type: Issue
parent: "[[WIP limits]]"
order: 10
status: Open
priority: P3
area: design
created: 2026-08-02
source: implementation of the per-column agreements increment
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
---

# A renamed state orphans its limit

## The limitation

A WIP limit and a column policy are persisted under keys built from the state's own
name — `wipLimit.<state>` and `columnPolicy.<state>`, lowercased. Rename a state in
"Workflow states (in order)" and both values stay in the `.base` under the old name,
while the renamed state comes back unlimited and with nothing written on it. Nothing
reports it: the old keys are simply never read again.

## Why it is deliberate

Bases options are declarative. The schema hands Bases a list of keys and Bases reads
and writes them; there is no rename hook, and no point at which this plugin is told
that `stateValues` went from `In review` to `Reviewing` rather than from two states to
two different ones. A resolver that tried to infer it would be guessing, and guessing
wrong means silently attaching one column's agreement to another.

Keying by **position** instead — `wipLimit.2` — survives a rename and breaks on the
commoner edit: reordering the workflow, or inserting a state, would shuffle every
limit onto the wrong column, and quietly, which is worse than losing one visibly.

## What would lift it

An option-rename hook in the Bases API — something that reports the old and new value
of a text option — would make the migration a few lines. Failing that, an explicit
"rename a state" action in the view that rewrites both keys as it rewrites the list.
That is a different feature and would need its own use case.

## Impact

One re-typed number and one re-typed sentence per renamed state. Losing a policy is
the more annoying half; losing a limit at least announces itself the next time the
column fills up.
```

- [ ] **Step 3: Write the verification Issue**

Create `docs/issues/Smoke test the column agreements.md`:

```markdown
---
type: Issue
parent: "[[WIP limits]]"
order: 20
status: Open
priority: P2
area: verification
created: 2026-08-02
source: implementation of the per-column agreements increment
files:
  - src/domain/viewOptions.ts
  - src/view/render/board.ts
---

# Smoke test the column agreements

## Why this exists

Two questions about this increment cannot be answered in this repository. Obsidian
does not run here, so the jsdom harness can say what the schema returns and what the
DOM holds, and nothing about what Bases does with either.

## How to check

Run `npm run test-build`, open this repository as a vault, and open
`docs/Product Backlog.base`.

1. **The options menu regenerates.** With a workflow configured, open the view
   options and note the limit and policy boxes. Add a state to
   "Workflow states (in order)" and, **without reopening the view**, open the options
   again. Is there a limit box and a policy box for the new state?
2. **The dense header reads.** Set a limit of 1 on a state holding three cards, then
   type into the quick filter so one card matches. The header shows the pair count
   and the limit together — `1 of 3 / 1`. Is that readable, or does it need a
   separator, a second line, or the limit dropped while a filter is active?
3. **A state name with a space keys correctly.** Configure a state called
   `In review`, set a limit on it, close and reopen the base. Did the limit survive
   the round trip through the `.base` file, whose key now contains a space?

## Acceptance criteria

- Question 1 answered yes, or a note recording what the menu actually does and what
  the user has to do to see a new state's boxes.
- Question 2 answered with a verdict, and a follow-up note if the answer is that the
  dense case needs a different layout.
- Question 3 answered yes, or a bug recording what the `.base` file holds.

## Outcome

Not yet run.
```

- [ ] **Step 4: Update the register's own summary**

In `docs/README.md`, in the **Product Kanban** paragraph, after the sentence describing the third increment, add:

```markdown
The fourth gave the columns their agreements: a **WIP limit** and an **explicit
policy** per configured state, both generated view options keyed by the state's own
name, the way the per-type folder keys are. The limit reads the full population rather
than the matches, so a filter cannot make an overcommitted stage look calm; it signals
in colour, in shape and in words, and it refuses nothing — a check drives every board
write path against a column already over one. The policy is described rather than
named, reachable by pointer and from a column menu this increment introduces and
creation from a column will later share.
```

Adjust the following sentence — the one listing what remains under the epic — to drop limits and policies from it.

- [ ] **Step 5: Run the register check**

Run: `npm run docs`
Expected: PASS. Every `[[wikilink]]` must resolve, every `src/` and `test/` path a requirement names must exist, no two siblings may share an `order`, and both new Issues must have a legal parent — a `PBI` may parent an `Issue`.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS — all five steps.

- [ ] **Step 7: Commit and push**

```bash
git add docs
git commit -m "Close the column agreements, and record what a vault still has to answer"
git push -u origin claude/next-increment-brainstorm-ev1n6l
```

Then open a pull request for the branch, ready for review.

---

## Notes for the implementer

**Two things in the spec were superseded while planning, both toward less code.** The spec
put `overLimit(settings, column)` in `settings.ts`; it is `overBy(col)` in `domain/board.ts`
instead, because the column is built by walking the configured states and can carry its own
limit — which removes every downstream lookup rather than adding one helper. And the spec
described a new table builder; `typeFoldersFor` was already that function with one type
hard-coded, so it is generalised into `nameTable` and the old one deleted.

**The milestones increment is in flight on another branch.** It edits `settings.ts`,
`viewOptions.ts` and `interactions/menu.ts`, which this plan also edits. The regions differ —
milestones is in `ALL_TYPES` and the type-folder generation; this is in the states and the
progress group — but rebase early rather than at the end, and if `byTypeName` has moved or
gained a caller, keep the delegate rather than reopening the rename.
