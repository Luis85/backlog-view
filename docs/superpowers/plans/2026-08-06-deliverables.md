# Deliverables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Deliverable` as a rootable extra type with its own folder, badge, and a
fourth board projection ("Deliverables") driven by its own workflow — a state property,
ordered states and done values entirely separate from the requirements board's — while
every other property (`parent`/`order`/`type`, tags, the roadmap axis) is the one the
other types already use.

**Architecture:** `Deliverable` joins the fixed `EXTRA_TYPES` vocabulary (pinned rank,
`Task` children) plus a new `ROOTABLE_EXTRA_TYPES` marker that makes it the one extra
type `childTypeChoices(null)` offers. A second, parallel workflow — `deliverableStateKey`
/ `deliverableStates` / `deliverableDoneValues`, wired through the existing
`OptionalField`/`PROPERTY_TABLE` machinery — drives a fourth `Projection` value,
`'deliverables'`, which reuses every board building block (`boardColumns`, `renderBoard`,
`CardMoveController`) through two new parameters: a `Workflow` object (which property
reads and writes) and a candidate list (which items are cards). Nothing about layout,
persistence shape, or the write gate is duplicated — only the workflow and the
type filter differ.

**Tech Stack:** TypeScript, Obsidian Bases custom view API, Vitest + jsdom (see
`test/CLAUDE.md`), the project's own four-layer architecture (`domain/` → `storage/` /
`view/` → `commands/`/`main.ts`, each reaching only downward).

## Global Constraints

- Reuse generic mechanisms for `parent`/`order`/`type`, tags, and the roadmap axis —
  Deliverables introduce **no new code** for any of these (per the brainstorming
  decision: "we don't need extra logic for properties we already track").
- The Deliverables board ships with **columns and a workflow only** — no WIP limits, no
  column policies, no started/finished date stamps, and it does not honor "Show
  completed items" (Scope/Out, `docs/superpowers/specs/2026-08-06-deliverables-design.md`).
- "One move, three inputs": a drop, an Alt+arrow and the card menu's Set state must all
  land on one `CardMoveController` method (`performDeliverablesBoardMove`) — never an
  independently planned write at any of the three call sites.
- There is one `host.board` snapshot field, not two. `ProjectionContent.board` is
  overwritten every render regardless of which projection produced it, so it is already
  correctly null off both board-shaped projections and non-null on exactly one of them
  at a time. No `host.deliverablesBoard` field.
- Every write goes through `storage/frontmatter.ts` (`applyWrites`/`applyRestores`) —
  never `processFrontMatter` anywhere else — and through the `configProblems` gate.
- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register)
  must pass before any task is considered done; coverage thresholds only go up.
- Sentence-case UI text; no `setCssProps`-avoidable inline styles; `styles/` partials
  stay under 400 lines (badges.css is nowhere near that limit and needs no split).

---

### Task 1: `Deliverable` joins the type vocabulary

**Files:**
- Modify: `src/domain/settings.ts`
- Modify: `src/domain/itemTypes.ts`
- Test: `test/domain/itemTypes.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EXTRA_TYPES` includes `'Deliverable'`; a new exported
  `ROOTABLE_EXTRA_TYPES: string[]` in `settings.ts`; `childTypeChoices(null)` includes
  `'Deliverable'`. Later tasks (2, 22) read `ROOTABLE_EXTRA_TYPES` and the widened
  `EXTRA_TYPES`.

`Issue` and `Bug` need a parent (they are offered only under a real rung); `Deliverable`
does not. `EXTRA_TYPES` alone can't express that difference, so a second, narrower list
holds the ones that may sit at the top — the same shape `MARKER_TYPES` already is beside
`EXTRA_TYPES`, not a hardcoded string threaded through `itemTypes.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/domain/itemTypes.test.ts — inside the existing describe block, beside the
// other childTypeChoices tests
it('offers Deliverable under an Epic, a Feature or a PBI, beside Issue and Bug', () => {
	const { get } = fixture();
	expect(childTypeChoices(get('Epic'))).toEqual(['Feature', 'Issue', 'Bug', 'Deliverable']);
});

it('offers Deliverable at the top level too — the one extra type that is rootable', () => {
	expect(childTypeChoices(null)).toEqual(['Epic', 'Milestone', 'Deliverable']);
});

it('pins Deliverable at EXTRA_TYPE_RANK wherever it hangs, holding only Tasks', () => {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 }, parentLink: 'Epic' });
	const model = buildModel(vault.app, vault.entries(), defaultSettings());
	const d = model.items.find((i) => i.title === 'D');
	if (!d) throw new Error('missing D');
	expect(d.effectiveLevelIndex).toBe(EXTRA_TYPE_RANK);
	expect(d.levelIndex).toBe(-1);
	expect(childTypeChoices(d)).toEqual(['Task']);
});

it('defaults the Deliverable folder to <home>/deliverables', () => {
	expect(defaultTypeFolder('Deliverable')).toBe('docs/deliverables');
});
```

Add `FakeVault`, `buildModel`, `defaultSettings`, `defaultTypeFolder` to that file's
imports if not already present (`buildModel`/`defaultSettings`/`FakeVault` already are,
per the existing fixture; `defaultTypeFolder` needs adding to the `../../src/domain/settings`
import list).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL — `childTypeChoices(get('Epic'))` returns `['Feature', 'Issue', 'Bug']`
(no Deliverable), `childTypeChoices(null)` returns `['Epic', 'Milestone']` (no
Deliverable), and `defaultTypeFolder('Deliverable')` returns `''`.

- [ ] **Step 3: Implement**

In `src/domain/settings.ts`:

```ts
export const EXTRA_TYPES = ['Issue', 'Bug', 'Deliverable'];
```

Right after `EXTRA_TYPES`' own doc comment block (before `MARKER_TYPES`), add:

```ts
/**
 * The subset of `EXTRA_TYPES` that may also sit at the TOP LEVEL, with no parent at
 * all — `Deliverable` is the first member. `EXTRA_TYPES` alone cannot express this:
 * `Issue` and `Bug` still need a real rung above them, so `childTypeChoices`' top-level
 * branch reads this list instead of `EXTRA_TYPES` itself.
 */
export const ROOTABLE_EXTRA_TYPES = ['Deliverable'];
```

In `DEFAULT_TYPE_SUBFOLDERS`, add a line:

```ts
	deliverable: 'deliverables',
```

(keeping the existing `bug: 'bugs'` / `milestone: 'milestones'` entries as they are).

In `src/domain/itemTypes.ts`, `childTypeChoices`'s top-level branch:

```ts
	// Top level is the ladder's top plus the markers plus the rootable extra types: a
	// milestone hangs from nothing, a rootable Deliverable may choose to hang from
	// nothing, while an ordinary extra type (Issue, Bug) hangs from something and
	// creating one with no parent would make an item whose own rule says it should
	// have had one.
	if (!parent) return [ladderChild, ...MARKER_TYPES, ...ROOTABLE_EXTRA_TYPES];
```

Add `ROOTABLE_EXTRA_TYPES` to the `import { ALL_TYPES, BacklogSettings, byName, EXTRA_TYPES, LEVELS, MARKER_TYPES } from './settings';` line at the top of `itemTypes.ts`.

The under-a-parent branch (`return onLadder ? [ladderChild, ...EXTRA_TYPES] : [ladderChild];`)
needs no change — it already spreads the whole `EXTRA_TYPES` list, so `Deliverable`
joining that list is already offered there for free.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings.ts src/domain/itemTypes.ts test/domain/itemTypes.test.ts
git commit -m "feat: Deliverable joins the type vocabulary, rootable"
```

---

### Task 2: Deliverable's own badge and colour

**Files:**
- Modify: `src/view/render/rows.ts`
- Modify: `styles/badges.css`
- Test: `test/view/rendering.test.ts`

**Interfaces:**
- Consumes: `NON_RUNG_STYLE` (existing table in `rows.ts`).
- Produces: a `deliverable` badge/colour, matching the same "every declared type has an
  entry or the table's own coverage test fails" contract `Issue`/`Bug`/`Milestone` use.

- [ ] **Step 1: Write the failing test**

```ts
// test/view/rendering.test.ts — new test, using the existing view harness
it('renders a Deliverable with its own badge icon and colour', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
	const { containerEl } = makeView(vault);

	const badge = rowByTitle(containerEl, 'D').querySelector('.pbl-badge');
	expect(badge?.classList.contains('pbl-lvl-deliverable')).toBe(true);
	expect(badge?.querySelector('.pbl-badge-icon [data-icon]')?.getAttribute('data-icon')).toBe('package');
});
```

Check the file's existing imports for `FakeVault`, `makeView`, `rowByTitle` — all three
already appear in `test/helpers/view.ts`/`test/helpers/vault.ts` and are used elsewhere
in this file per the harness conventions in `test/CLAUDE.md`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/rendering.test.ts -t "Deliverable with its own badge"`
Expected: FAIL — `pbl-lvl-deliverable` class absent; the badge falls through to
`pbl-lvl-unknown` (no `NON_RUNG_STYLE` entry for `deliverable`).

- [ ] **Step 3: Implement**

In `src/view/render/rows.ts`, extend the table:

```ts
const NON_RUNG_STYLE: Record<string, { icon: string; badge: string }> = {
	issue: { icon: 'circle-alert', badge: 'pbl-lvl-issue' },
	bug: { icon: 'bug', badge: 'pbl-lvl-bug' },
	milestone: { icon: 'diamond', badge: 'pbl-lvl-milestone' },
	deliverable: { icon: 'package', badge: 'pbl-lvl-deliverable' },
};
```

In `styles/badges.css`, after the `.pbl-lvl-milestone` rule:

```css
/* Green is otherwise unused across the four levels and the three other extra types. */
.pbl-lvl-deliverable { --pbl-badge-rgb: var(--color-green-rgb); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/view/rendering.test.ts -t "Deliverable with its own badge"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/view/render/rows.ts styles/badges.css test/view/rendering.test.ts
git commit -m "feat: give Deliverable its own badge icon and colour"
```

---

### Task 3: The Deliverable workflow's property vocabulary

**Files:**
- Modify: `src/domain/settings.ts`
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: `PROPERTY_TABLE`, `OptionalField`, `BacklogSettings` (existing).
- Produces: `OptionalField` gains `'deliverableState'`; `BacklogSettings` gains
  `deliverableStateKey: string`, `deliverableStates: string[]`,
  `deliverableDoneValues: string[]`. Consumed by Task 4 (viewOptions.ts), Task 6
  (vocabulary.ts), Task 7 (model.ts), Task 9 (writePlan.ts / frontmatter.ts).

- [ ] **Step 1: Write the failing tests**

```ts
// test/domain/settings.test.ts — new tests, following the file's existing
// defaultSettings()/resolveSettings(fakeConfig({...})) pattern
it('gives the Deliverable workflow its own defaults', () => {
	const s = defaultSettings();
	expect(s.deliverableStateKey).toBe('');
	expect(s.deliverableStates).toEqual([]);
	expect(s.deliverableDoneValues).toEqual(DEFAULT_DONE_VALUES);
});

it('resolves the Deliverable state property independently of the requirements one', () => {
	const s = resolveSettings(
		fakeConfig({
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Concept, Draft, Review, Published',
			deliverableDoneValues: 'Published',
			stateProperty: 'note.status',
		}),
	);
	expect(s.deliverableStateKey).toBe('deliverableStatus');
	expect(s.deliverableStates).toEqual(['Concept', 'Draft', 'Review', 'Published']);
	expect(s.deliverableDoneValues).toEqual(['Published']);
	expect(s.stateKey).toBe('status');
});

it('reports a collision between the two workflows sharing one key', () => {
	const s = resolveSettings(
		fakeConfig({ stateProperty: 'note.status', deliverableStateProperty: 'note.status' }),
	);
	expect(configProblems(s).some((p) => p.includes('deliverable state'))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/settings.test.ts -t "Deliverable"`
Expected: FAIL — `TypeError`/`undefined` on `s.deliverableStateKey` etc., since the
field does not exist yet.

- [ ] **Step 3: Implement**

In `BacklogSettings`, after `targetKey`:

```ts
	/** Frontmatter key holding the Deliverable workflow's own state, or '' when unset. */
	deliverableStateKey: string;
	/** Deliverable workflow states offered by its board, in order; [] falls back to observed. */
	deliverableStates: string[];
	/** State values (case-insensitive) that count as done, for the Deliverable workflow. */
	deliverableDoneValues: string[];
```

Widen `OptionalField` and `OptionalSettingsKey`:

```ts
export type OptionalField = 'state' | 'startedDate' | 'finishedDate' | 'horizon' | 'start' | 'target' | 'deliverableState';
```

```ts
type OptionalSettingsKey =
	| 'stateKey'
	| 'startedDateKey'
	| 'finishedDateKey'
	| 'horizonKey'
	| 'startKey'
	| 'targetKey'
	| 'deliverableStateKey';
```

Add to `PROPERTY_TABLE` (after `target`, so it reads last in every table it feeds):

```ts
	deliverableState: {
		option: 'deliverableStateProperty',
		suggested: 'deliverableStatus',
		label: 'deliverable state',
		settingsKey: 'deliverableStateKey',
	},
```

In `defaultSettings()`, after `targetKey: ''`:

```ts
		deliverableStateKey: '',
		deliverableStates: [],
		deliverableDoneValues: [...DEFAULT_DONE_VALUES],
```

In `resolveSettings()`, compute the effective done values the same way `doneValues`
already is, right after the existing `doneValues`/`effectiveDoneValues` block:

```ts
	const deliverableDoneValuesRaw = list('deliverableDoneValues');
	const effectiveDeliverableDoneValues =
		deliverableDoneValuesRaw.length > 0 ? deliverableDoneValuesRaw : fallback.deliverableDoneValues;
```

And in the returned object, after `targetKey: propKey('targetProperty', fallback.targetKey),`:

```ts
		deliverableStateKey: propKey('deliverableStateProperty', fallback.deliverableStateKey),
		deliverableStates: dedupe(list('deliverableStateValues')),
		deliverableDoneValues: effectiveDeliverableDoneValues,
```

No change is needed to `ownedProperties()`, `configProblems()`, `adoptableProperties()`
or the backfill's stubs — all four already iterate `OPTIONAL_PROPERTIES`, which is
derived from `PROPERTY_TABLE`'s keys, so the new field is covered the moment it joins
the table.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: PASS (including every pre-existing test in the file — `configProblems`'s
generic loop over `OPTIONAL_PROPERTIES` needs no new branch).

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings.ts test/domain/settings.test.ts
git commit -m "feat: add the Deliverable workflow's property vocabulary"
```

---

### Task 4: A "Deliverables" view-options group

**Files:**
- Modify: `src/domain/viewOptions.ts`
- Test: `test/domain/viewOptions.test.ts`

**Interfaces:**
- Consumes: `optionalPropertyOption`, `DEFAULT_DONE_VALUES` (existing), `OptionalField`
  (Task 3).
- Produces: `getViewOptions()` includes a "Deliverables" group.

- [ ] **Step 1: Write the failing test**

```ts
// test/domain/viewOptions.test.ts — matching the file's existing pattern of asserting
// on getViewOptions()'s group shape
it('exposes a Deliverables group with its own state property, states and done values', () => {
	const groups = getViewOptions();
	const group = groups.find((g) => 'displayName' in g && g.displayName === 'Deliverables');
	if (!group || !('items' in group)) throw new Error('Deliverables group missing');
	const keys = group.items.map((item) => item.key);
	expect(keys).toEqual(['deliverableStateProperty', 'deliverableStateValues', 'deliverableDoneValues']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/viewOptions.test.ts -t "Deliverables group"`
Expected: FAIL — no group named `'Deliverables'` in `getViewOptions()`'s result.

- [ ] **Step 3: Implement**

In `src/domain/viewOptions.ts`, add a new function beside `roadmapGroup`:

```ts
/**
 * The Deliverable workflow's own group — columns and a workflow only, per Scope: no
 * WIP-limit or policy boxes, unlike `progressGroup`'s requirements workflow.
 */
function deliverablesGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Deliverables',
		items: [
			optionalPropertyOption('deliverableState', 'Deliverable state property'),
			{
				type: 'text',
				key: 'deliverableStateValues',
				displayName: 'Deliverable workflow states (in order)',
				default: '',
				placeholder: 'Concept, Draft, Review, Published',
			},
			{
				type: 'text',
				key: 'deliverableDoneValues',
				displayName: 'Deliverable states that count as done',
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
		],
	};
}
```

In `getViewOptions()`, insert it after `progressGroup(settings)`:

```ts
	return [
		hierarchyGroup(),
		progressGroup(settings),
		deliverablesGroup(),
		roadmapGroup(),
		newItemsGroup(settings.homeFolder),
		displayGroup(),
	];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/domain/viewOptions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/viewOptions.ts test/domain/viewOptions.test.ts
git commit -m "feat: add the Deliverables view-options group"
```

---

### Task 5: `collectObservedDeliverableStates` — scoped to Deliverable items

**Files:**
- Modify: `src/domain/vocabulary.ts`
- Test: `test/domain/model.test.ts`

**Interfaces:**
- Consumes: `firstSeen` (existing private helper), `BacklogSettings.deliverableDoneValues`
  (Task 3).
- Produces: `collectObservedDeliverableStates(all, settings): string[]`, exported.
  Consumed by Task 7 (`model.ts`'s `buildModel`).

Found by review (Codex, PR #77): a naive copy of `collectObservedStates` would read
`deliverableStateValue` off ANY item, including a PBI or a Bug that happens to carry the
Deliverable-state key — minting a stray column no card could ever land in. This collector
filters to `Deliverable`-typed items first.

- [ ] **Step 1: Write the failing test**

```ts
// test/domain/model.test.ts — new describe block, or alongside existing
// collectObservedStates coverage if this file already has one
import { collectObservedDeliverableStates } from '../../src/domain/vocabulary';

describe('collectObservedDeliverableStates', () => {
	it('reads only Deliverable-typed items, never a PBI carrying the same key', () => {
		const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, deliverableStatus: 'Stray' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft']);
	});

	it('sorts open states before its own done values', () => {
		const settings = {
			...defaultSettings(),
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'],
		};
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Published' } });
		vault.addFile('B.md', { frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft', 'Published']);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/model.test.ts -t "collectObservedDeliverableStates"`
Expected: FAIL — `collectObservedDeliverableStates` does not exist (import error).

- [ ] **Step 3: Implement**

In `src/domain/vocabulary.ts`, widen `VocabularySource` and add the collector:

```ts
interface VocabularySource {
	outsideFilter: boolean;
	stateValue: string | null;
	tags: string[];
	horizon: FieldReading<string>;
	typeName: string | null;
	deliverableStateValue: string | null;
}
```

```ts
/**
 * First occurrence of every Deliverable workflow state value, sorted the same way
 * `collectObservedStates` sorts its own: open states alphabetically, then done ones.
 * Scoped to `Deliverable`-typed items BEFORE the first-seen walk — not a blind copy of
 * `collectObservedStates`, which would mint a stray column from a non-Deliverable
 * item's coincidental value in the same key.
 */
export function collectObservedDeliverableStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const deliverables = all.filter((item) => item.typeName?.toLowerCase() === 'deliverable');
	const done = new Set(settings.deliverableDoneValues.map((v) => v.toLowerCase()));
	const values = firstSeen(deliverables, (item) =>
		item.deliverableStateValue === null ? [] : [item.deliverableStateValue],
	).sort((a, b) => a.localeCompare(b));
	return [...values.filter((v) => !done.has(v.toLowerCase())), ...values.filter((v) => done.has(v.toLowerCase()))];
}
```

This will not compile yet — `deliverableStateValue` does not exist on `BacklogItem`
until Task 7. That is expected; Task 7 lands next and the two land together before
either is runnable end to end. (If your TDD loop needs a green step here first, stub
`deliverableStateValue: null` onto the RawItem type in Task 7's own step instead of
splitting — see Task 7's note.)

- [ ] **Step 4: Run tests to verify they pass**

This step's tests will only go green once Task 7 lands `deliverableStateValue` on
`BacklogItem`. Proceed directly to Task 7; return here to confirm PASS once it is done.

Run (after Task 7): `npx vitest run test/domain/model.test.ts -t "collectObservedDeliverableStates"`
Expected: PASS

- [ ] **Step 5: Commit**

Commit together with Task 7 (see Task 7 Step 5) — the two do not compile independently.

---

### Task 6: `BacklogItem.deliverableStateValue` / `deliverableDone`, in the raw-item phase

**Files:**
- Modify: `src/domain/model.ts`
- Test: `test/domain/model.test.ts`

**Interfaces:**
- Consumes: `BacklogSettings.deliverableStateKey`/`deliverableDoneValues` (Task 3),
  `collectObservedDeliverableStates` (Task 5).
- Produces: `BacklogItem.deliverableStateValue: string | null`,
  `BacklogItem.deliverableDone: boolean`, `BacklogModel.observedDeliverableStates: string[]`.
  Consumed by Task 8 (`board.ts`'s `deliverablesWorkflow`), Task 16 (`render/board.ts`'s
  `createCard` completion flag).

**Found by review (Codex, PR #77): these fields must be computed in `addItem` — the
`RawItem` phase — not in `assignAll`.** `buildModel` calls
`collectObservedStates(linked.all, settings)` (and, after this task, `collectObserved-
DeliverableStates`) right after `linkAll`, at `model.ts:180`, well before `assignAll`
ever runs at `model.ts:183`. A field populated in `assignAll` would not exist yet when
the collector reads `linked.all`. `stateValue` and `done` are already computed in
`addItem` for exactly this reason — `deliverableStateValue`/`deliverableDone` are
computed the same place, beside them.

- [ ] **Step 1: Write the failing tests**

```ts
// test/domain/model.test.ts — new tests beside the existing stateValue/done coverage
it('reads the Deliverable workflow state independently of the requirements one', () => {
	const settings = {
		...defaultSettings(),
		stateKey: 'status',
		deliverableStateKey: 'deliverableStatus',
		deliverableDoneValues: ['Published'],
	};
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
	});
	const model = buildModel(vault.app, vault.entries(), settings);
	const d = model.items.find((i) => i.title === 'D');
	if (!d) throw new Error('missing D');

	expect(d.deliverableStateValue).toBe('Draft');
	expect(d.deliverableDone).toBe(false);
	// The requirements workflow's own fields are untouched by the second one.
	expect(d.stateValue).toBe('Done');
	expect(d.done).toBe(true);
});

it('collects observed Deliverable states onto the model, scoped to Deliverable items', () => {
	const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	const model = buildModel(vault.app, vault.entries(), settings);

	expect(model.observedDeliverableStates).toEqual(['Draft']);
});

it('is null when the Deliverable state property is unconfigured', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
	const model = buildModel(vault.app, vault.entries(), defaultSettings());
	const d = model.items.find((i) => i.title === 'D');
	if (!d) throw new Error('missing D');

	expect(d.deliverableStateValue).toBeNull();
	expect(d.deliverableDone).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/model.test.ts -t "Deliverable"`
Expected: FAIL — TypeScript compile error, `deliverableStateValue` does not exist on
`BacklogItem`/`BacklogModel`.

- [ ] **Step 3: Implement**

In `src/domain/model.ts`, add two fields to `RawItem` (right after `done`):

```ts
	/** True when the state value matches one of the configured done values. */
	done: boolean;
	/** Raw value of the Deliverable workflow's own state property, if configured. */
	deliverableStateValue: string | null;
	/** True when the Deliverable state matches one of ITS OWN configured done values. */
	deliverableDone: boolean;
```

In `addItem`, alongside the existing `stateValue`/`doneValues`/`done` computation:

```ts
	const stateValue = settings.stateKey ? readString(ownValue(fm, settings.stateKey)) : null;
	const doneValues = settings.doneValues.map((v) => v.toLowerCase());
	const deliverableStateValue = settings.deliverableStateKey
		? readString(ownValue(fm, settings.deliverableStateKey))
		: null;
	const deliverableDoneValues = settings.deliverableDoneValues.map((v) => v.toLowerCase());
```

and, in the returned `item` object, alongside `done`:

```ts
		done: stateValue !== null && doneValues.includes(stateValue.toLowerCase()),
		deliverableStateValue,
		deliverableDone:
			deliverableStateValue !== null && deliverableDoneValues.includes(deliverableStateValue.toLowerCase()),
```

`LinkedItem`/`BacklogItem` need no redeclaration — they `extend` `RawItem`, and neither
`stateValue` nor `done` is redeclared there either.

In `BacklogModel`, add beside `observedStates`:

```ts
	/** Distinct Deliverable-workflow state values, scoped to Deliverable items. */
	observedDeliverableStates: string[];
```

In `buildModel`, beside the existing `collectObservedStates`/`collectObservedTags` call
(both read off `linked.all`, before `assignAll`):

```ts
	const observedStates = collectObservedStates(linked.all, settings);
	const observedTags = collectObservedTags(linked.all);
	const observedDeliverableStates = collectObservedDeliverableStates(linked.all, settings);
```

And add it to the `rest` object a few lines below:

```ts
	const rest = {
		realRoots: roots,
		byPath,
		observedStates,
		observedTags,
		observedHorizons,
		observedDeliverableStates,
		ignoredCount,
	};
```

Add `collectObservedDeliverableStates` to the existing
`import { collectObservedHorizons, collectObservedStates, collectObservedTags } from './vocabulary';` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/model.test.ts`
Expected: PASS (this also makes Task 5's tests pass — run those too:
`npx vitest run test/domain/model.test.ts -t "collectObservedDeliverableStates"`).

- [ ] **Step 5: Commit**

```bash
git add src/domain/model.ts src/domain/vocabulary.ts test/domain/model.test.ts
git commit -m "feat: model the Deliverable workflow's state, in the raw-item phase"
```

---

### Task 7: `computeDeliverableStateWrites` and the `ItemWrite` fields

**Files:**
- Modify: `src/domain/writePlan.ts`
- Test: `test/domain/writePlan.test.ts`

**Interfaces:**
- Consumes: `BacklogItem.deliverableStateValue` (Task 6), `sameValue` (existing, from
  `noteFields.ts`).
- Produces: `ItemWrite.deliverableState?: string`, `ItemWrite.removeDeliverableStateKey?: boolean`,
  `computeDeliverableStateWrites(item, state): ItemWrite[]`. Consumed by Task 9
  (`storage/frontmatter.ts`), Task 15 (`cardMoves.ts`).

Deliberately the `state`/`removeStateKey` shape, not `AxisWrite` — no span/date
semantics apply here, and no stamp logic (`settings`/`today` params) is needed, per
Scope.

- [ ] **Step 1: Write the failing tests**

```ts
// test/domain/writePlan.test.ts — new describe block
describe('computeDeliverableStateWrites', () => {
	function deliverable(state: string | null) {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, ...(state !== null ? { deliverableStatus: state } : {}) },
		});
		const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const model = buildModel(vault.app, vault.entries(), settings);
		return model.results[0];
	}

	it('writes the canonical value, untransformed', () => {
		const item = deliverable('Draft');
		expect(computeDeliverableStateWrites(item, 'Review')).toEqual([{ file: item.file, deliverableState: 'Review' }]);
	});

	it('plans nothing for a re-pick of the same state, case-insensitively', () => {
		expect(computeDeliverableStateWrites(deliverable('draft'), 'Draft')).toEqual([]);
	});

	it('removes the key for a drop on the no-state column', () => {
		const item = deliverable('Draft');
		const writes = computeDeliverableStateWrites(item, null);
		expect(writes).toEqual([{ file: item.file, removeDeliverableStateKey: true }]);
	});

	it('plans nothing for a stateless card dropped on the no-state column', () => {
		expect(computeDeliverableStateWrites(deliverable(null), null)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/writePlan.test.ts -t "computeDeliverableStateWrites"`
Expected: FAIL — `computeDeliverableStateWrites` does not exist.

- [ ] **Step 3: Implement**

In `src/domain/writePlan.ts`, add to `ItemWrite` (right after `removeStateKey`):

```ts
	/** New value for the Deliverable workflow's own state property. */
	deliverableState?: string;
	/** Remove the Deliverable state property entirely — its no-state column's drop. */
	removeDeliverableStateKey?: boolean;
```

Add the planner, beside `computeStateWrites`:

```ts
/**
 * Everything ONE Deliverable-workflow state change writes: the target column's
 * canonical value, or key removal for the no-state target. No stamp logic — the
 * Deliverables board carries no started/finished date stamps (Scope).
 */
export function computeDeliverableStateWrites(item: BacklogItem, state: string | null): ItemWrite[] {
	if (sameValue(item.deliverableStateValue, state)) return [];
	return [
		state === null ? { file: item.file, removeDeliverableStateKey: true } : { file: item.file, deliverableState: state },
	];
}
```

`sameValue` is already imported from `./noteFields` at the top of this file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/writePlan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/writePlan.ts test/domain/writePlan.test.ts
git commit -m "feat: plan writes for the Deliverable workflow's state"
```

---

### Task 8: Apply and capture the Deliverable state in `storage/frontmatter.ts`

**Files:**
- Modify: `src/storage/frontmatter.ts`
- Test: `test/storage/frontmatter.test.ts`

**Interfaces:**
- Consumes: `ItemWrite.deliverableState`/`removeDeliverableStateKey` (Task 7),
  `optionalKeyFor(settings, 'deliverableState')` (Task 3).
- Produces: `applyWrites` applies and captures the new fields; undo/redo work
  identically to the requirements `state`/`removeStateKey` pair.

- [ ] **Step 1: Write the failing tests**

```ts
// test/storage/frontmatter.test.ts — new tests, following the existing
// "writes the state to the configured key" test's shape
it('writes the Deliverable state to its own configured key, never to an empty key', async () => {
	const vault = new FakeVault();
	const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable' } });
	const configured = { ...settings, deliverableStateKey: 'deliverableStatus' };

	await applyWrites(vault.app, configured, [{ file: item, deliverableState: 'Draft' }]);
	expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');

	await applyWrites(vault.app, settings, [{ file: item, deliverableState: 'Review' }]);
	expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');
});

it('removes the Deliverable state key, and undo puts it back', async () => {
	const vault = new FakeVault();
	const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable', deliverableStatus: 'Draft' } });
	const configured = { ...settings, deliverableStateKey: 'deliverableStatus' };
	const inverses: RestoreWrite[] = [];

	await applyWrites(vault.app, configured, [{ file: item, removeDeliverableStateKey: true }], undefined, (inv) =>
		inverses.push(inv),
	);
	expect('deliverableStatus' in vault.fm('D.md')).toBe(false);

	await applyRestores(vault.app, inverses);
	expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/storage/frontmatter.test.ts -t "Deliverable state"`
Expected: FAIL — the write is silently dropped (nothing in `applyInto`/`touchedKeys`
recognizes `deliverableState`/`removeDeliverableStateKey` yet).

- [ ] **Step 3: Implement**

In `src/storage/frontmatter.ts`'s `applyInto`, right after the existing state
apply/remove pair:

```ts
	// The stateKey may be unset (progress tracking off) — never write to an empty key.
	if (write.removeStateKey && settings.stateKey) delete fm[settings.stateKey];
	else if (write.state !== undefined && settings.stateKey) setOwn(fm, settings.stateKey, write.state);
	const deliverableStateKey = optionalKeyFor(settings, 'deliverableState');
	if (write.removeDeliverableStateKey && deliverableStateKey) delete fm[deliverableStateKey];
	else if (write.deliverableState !== undefined && deliverableStateKey) {
		setOwn(fm, deliverableStateKey, write.deliverableState);
	}
```

In `touchedKeys`, right after the existing state line:

```ts
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	if (
		(write.removeDeliverableStateKey || write.deliverableState !== undefined) &&
		optionalKeyFor(settings, 'deliverableState')
	) {
		keys.push(optionalKeyFor(settings, 'deliverableState'));
	}
```

`optionalKeyFor` is already imported from `../domain/settings` at the top of this file.
No change is needed to `captureInverse`, `applyRestores` or `restoreInto` — they already
work generically off `touchedKeys`' list and `rawValueOf`/`setOwn`, exactly as they do
for `state`/`removeStateKey`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/storage/frontmatter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/frontmatter.ts test/storage/frontmatter.test.ts
git commit -m "feat: apply and capture the Deliverable workflow's state writes"
```

---

### Task 9: Parametrize `boardColumns` over a `Workflow`

**Files:**
- Modify: `src/domain/board.ts`
- Test: `test/domain/board.test.ts`

**Interfaces:**
- Consumes: `BacklogModel`, `BacklogItem`, `stateMenuValues`'s fallback logic
  (`settings.ts`).
- Produces: exported `Workflow` interface, `requirementsWorkflow(model, settings)`,
  `deliverablesWorkflow(model, settings)`, and `boardColumns` with a new signature:
  `boardColumns(model, workflow, candidates, visible, population?)`. Consumed by Task
  16 (`render/board.ts`, both call sites).

**This is the largest single mechanical change in the plan: every existing call to
`boardColumns` in `test/domain/board.test.ts` changes shape.** The transform is the
same for every one of them: `boardColumns(model, X, Y[, Z])` (where `X` is a
`BacklogSettings` value, `Y` is `visible`, `Z` an optional `population`) becomes
`boardColumns(model, requirementsWorkflow(model, X), model.focused ? model.roots : model.results, Y[, Z])` —
this is exactly the compound expression `boardColumns` computed internally today
(`const candidates = model.focused ? model.roots : model.results;`), now pulled out to
the caller. The 16 existing call sites in `test/domain/board.test.ts`, each mapped
explicitly (line numbers are pre-edit, from the current file):

```
L36:  boardColumns(model, settings, everything)
  →   boardColumns(model, requirementsWorkflow(model, settings), model.focused ? model.roots : model.results, everything)
L50:  boardColumns(model, reordered, everything)
  →   boardColumns(model, requirementsWorkflow(model, reordered), model.focused ? model.roots : model.results, everything)
L62:  boardColumns(model, unconfigured, everything)
  →   boardColumns(model, requirementsWorkflow(model, unconfigured), model.focused ? model.roots : model.results, everything)
L74:  boardColumns(model, settings, everything)   (repeat the L36 substitution)
L88:  boardColumns(model, clashing, everything)
  →   boardColumns(model, requirementsWorkflow(model, clashing), model.focused ? model.roots : model.results, everything)
L104: boardColumns(model, settings, everything)   (repeat the L36 substitution)
L116: boardColumns(model, settings, everything)   (repeat the L36 substitution)
L132: boardColumns(model, settings, everything)   (repeat the L36 substitution)
L145: boardColumns(model, settings, everything)   (repeat the L36 substitution)
L157: boardColumns(model, settings, (item) => item.title !== 'B')
  →   boardColumns(model, requirementsWorkflow(model, settings), model.focused ? model.roots : model.results, (item) => item.title !== 'B')
L172: boardColumns(model, settings, everything)   (repeat the L36 substitution)
L198: boardColumns(model, focused, everything)
  →   boardColumns(model, requirementsWorkflow(model, focused), model.focused ? model.roots : model.results, everything)
L210: boardColumns(model, focused, everything)    (repeat the L198 substitution)
L236: boardColumns(model, focused, everything)    (repeat the L198 substitution)
L286: return boardColumns(model, s, everything);
  →   return boardColumns(model, requirementsWorkflow(model, s), model.focused ? model.roots : model.results, everything);
L341: boardColumns(model, ...) — read this call's full argument list in the file
  before editing; it may already pass an explicit `population` as a 4th argument.
  Apply the identical substitution to its first three positions and carry any 4th
  argument through unchanged.
```

Add `import { requirementsWorkflow } from '../../src/domain/board';` (or extend the
existing `board.ts` import line) to `test/domain/board.test.ts`.

- [ ] **Step 1: Write the failing tests**

First, apply every substitution in the table above to `test/domain/board.test.ts` — this
step alone should compile (once Step 3 lands) and pass unchanged, since `requirements-
Workflow`'s behavior is designed to reproduce `boardColumns`' PREVIOUS internal logic
exactly. Then add new tests for the `deliverablesWorkflow`/type-filtered path:

```ts
// test/domain/board.test.ts — new describe block
describe('boardColumns with the Deliverables workflow', () => {
	function deliverablesSettings(extra: Partial<BacklogSettings> = {}): BacklogSettings {
		return { ...settings, deliverableStateKey: 'deliverableStatus', ...extra };
	}

	it('cards only Deliverable-typed results, never a PBI sharing the candidate list', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, deliverableStatus: 'Draft' } });
		const s = deliverablesSettings();
		const model = buildModel(vault.app, vault.entries(), s);

		const isDeliverable = (item: BacklogItem) => item.typeName?.toLowerCase() === 'deliverable';
		const board = boardColumns(
			model,
			deliverablesWorkflow(model, s),
			model.results,
			(item) => isDeliverable(item),
		);

		expect(board.cardCount).toBe(1);
		expect(board.columns.flatMap((c) => c.cards.map((card) => card.title))).toEqual(['D']);
	});

	it('reads state from deliverableStateValue, never the requirements stateValue', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const s = { ...deliverablesSettings(), stateKey: 'status' };
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(model, deliverablesWorkflow(model, s), model.results, () => true);

		const col = board.columns.find((c) => c.label === 'Draft');
		expect(col?.cards.map((c) => c.title)).toEqual(['D']);
	});

	it('never applies WIP limits or column policies — the Deliverables board has none', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const s = deliverablesSettings({ deliverableStates: ['Draft'] });
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(model, deliverablesWorkflow(model, s), model.results, () => true);

		const col = board.columns.find((c) => c.label === 'Draft');
		expect(col?.limit).toBeNull();
		expect(col?.policy).toBe('');
	});
});
```

Add `deliverablesWorkflow` to the `board.ts` import line in this file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/board.test.ts`
Expected: FAIL — compile errors (`requirementsWorkflow`/`deliverablesWorkflow` do not
exist; `boardColumns` still takes `settings` as its second argument, not a `Workflow`).

- [ ] **Step 3: Implement**

In `src/domain/board.ts`, add the `Workflow` interface and two builders, and rewrite
`boardColumns`/`workflowColumns`:

```ts
/**
 * What a board's columns are drawn from: how to read a card's state, the configured
 * list (or its observed fallback), the raw observed values (for the stray-column pass,
 * which needs them even once a workflow IS configured), the done values, and the
 * per-state WIP limits/policies — `{}` for a workflow that carries neither.
 */
export interface Workflow {
	stateOf(item: BacklogItem): string | null;
	values: string[];
	observedValues: string[];
	doneValues: string[];
	wipLimits: Record<string, number>;
	columnPolicies: Record<string, string>;
}

/** The requirements board's workflow — `boardColumns`' original, only caller until now. */
export function requirementsWorkflow(model: BacklogModel, settings: BacklogSettings): Workflow {
	return {
		stateOf: (item) => item.stateValue,
		values: stateMenuValues(settings, model.observedStates),
		observedValues: model.observedStates,
		doneValues: settings.doneValues,
		wipLimits: settings.wipLimits,
		columnPolicies: settings.columnPolicies,
	};
}

/**
 * The Deliverables board's own workflow — no WIP limits or column policies (Scope).
 * `values`' fallback is the same rule `stateMenuValues` already states for the
 * requirements workflow, applied to the Deliverable one's own configured/observed pair.
 */
export function deliverablesWorkflow(model: BacklogModel, settings: BacklogSettings): Workflow {
	return {
		stateOf: (item) => item.deliverableStateValue,
		values: menuValues(settings.deliverableStates, settings.deliverableDoneValues, model.observedDeliverableStates),
		observedValues: model.observedDeliverableStates,
		doneValues: settings.deliverableDoneValues,
		wipLimits: {},
		columnPolicies: {},
	};
}
```

```ts
export function boardColumns(
	model: BacklogModel,
	workflow: Workflow,
	candidates: BacklogItem[],
	visible: (item: BacklogItem) => boolean,
	population: (item: BacklogItem) => boolean = visible,
): BoardModel {
	const { columns, byValue, noState } = workflowColumns(workflow);
	// State-to-column matching is case-insensitive, exactly as doneValues matching
	// already is. A card whose state names no column gathers under no-state rather
	// than minting one — only an OBSERVED result value mints a column, above.
	const columnFor = (card: BacklogItem): BoardColumn => {
		const state = workflow.stateOf(card);
		return (state !== null ? byValue.get(state.toLowerCase()) : undefined) ?? noState;
	};

	const cards = candidates.filter(visible);
	const sortIndex = new Map<BacklogItem, number>();
	for (const card of cards) {
		columnFor(card).cards.push(card);
		sortIndex.set(card, card.outsideFilter ? firstPlacedIndex(card, visible) : card.entryIndex);
	}
	for (const card of candidates) {
		if (!card.outsideFilter && population(card)) columnFor(card).fullCount += 1;
	}
	let cardCount = 0;
	for (const col of columns) {
		col.cards.sort((a, b) => (sortIndex.get(a) ?? 0) - (sortIndex.get(b) ?? 0) || a.entryIndex - b.entryIndex);
		col.count = col.cards.reduce((n, card) => n + (card.outsideFilter ? 0 : 1), 0);
		cardCount += col.count;
	}
	return { columns, cardCount };
}
```

`workflowColumns` drops its `model`/`settings` parameters for one `Workflow`:

```ts
function workflowColumns(workflow: Workflow): { columns: BoardColumn[]; byValue: Map<string, BoardColumn>; noState: BoardColumn } {
	const done = new Set(workflow.doneValues.map((v) => v.toLowerCase()));
	const column = (state: string | null, outsideWorkflow: boolean): BoardColumn => ({
		state,
		label: state ?? NO_STATE_LABEL,
		done: state !== null && done.has(state.toLowerCase()),
		outsideWorkflow,
		cards: [],
		count: 0,
		fullCount: 0,
		limit: byName(workflow.wipLimits, state) ?? null,
		policy: byName(workflow.columnPolicies, state) ?? '',
	});
	const noState = column(null, false);
	const columns = [noState, ...workflow.values.map((s) => column(s, false))];
	const byValue = new Map<string, BoardColumn>();
	for (const col of columns) {
		if (col.state !== null) byValue.set(col.state.toLowerCase(), col);
	}
	for (const value of workflow.observedValues) {
		if (byValue.has(value.toLowerCase())) continue;
		const col = column(value, true);
		byValue.set(value.toLowerCase(), col);
		columns.push(col);
	}
	if (byValue.has(NO_STATE_LABEL.toLowerCase())) noState.label = NO_STATE_COLLISION_LABEL;
	return { columns, byValue, noState };
}
```

Finally, `src/domain/settings.ts` needs the small extraction `deliverablesWorkflow`
depends on — `menuValues`, with `stateMenuValues` becoming a thin wrapper so every
EXISTING caller of `stateMenuValues` (e.g. `interactions/menu.ts`'s `stateChoices`) is
unaffected:

```ts
/**
 * The values a workflow's menus offer: the configured list when set, else the observed
 * values — with a done value appended so marking something done is always one click
 * away. The pure rule behind `stateMenuValues`, extracted so a second workflow
 * (the Deliverables board's) can share it without reading `BacklogSettings` directly.
 */
export function menuValues(configured: string[], doneValues: string[], observed: string[]): string[] {
	if (configured.length > 0) return configured;
	const done = new Set(doneValues.map((v) => v.toLowerCase()));
	if (observed.some((v) => done.has(v.toLowerCase()))) return observed;
	return doneValues.length > 0 ? [...observed, doneValues[0]] : observed;
}

export function stateMenuValues(settings: BacklogSettings, observedStates: string[]): string[] {
	return menuValues(settings.states, settings.doneValues, observedStates);
}
```

Import `menuValues` into `board.ts`'s existing
`import { BacklogSettings, byName, stateMenuValues } from './settings';` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/board.test.ts`
Expected: PASS — every migrated existing test plus the three new Deliverables ones.

Run also: `npx vitest run test/domain/settings.test.ts` (the `menuValues`/
`stateMenuValues` extraction must not change `stateMenuValues`' own behavior — its
existing tests, if any, must still pass unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/domain/board.ts src/domain/settings.ts test/domain/board.test.ts
git commit -m "refactor: parametrize boardColumns over a Workflow, add the Deliverables one"
```

---

### Task 10: `DELIVERABLES_MODE` persists in the collapse store

**Files:**
- Modify: `src/storage/collapseStore.ts`
- Modify: `src/view/collapseState.ts`
- Test: `test/storage/collapseStore.test.ts`

**Interfaces:**
- Consumes: `BOARD_MODE`/`ROADMAP_MODE` (existing), `readEnum` (existing).
- Produces: `DELIVERABLES_MODE` constant; `Projection` (Task 11) round-trips through
  `CollapseState.projection()`/`setProjection()`.

- [ ] **Step 1: Write the failing test**

```ts
// test/storage/collapseStore.test.ts — new test, mirroring the file's existing
// board/roadmap mode round-trip coverage
it('round-trips the Deliverables mode through the stored allowlist', () => {
	vault.addFile('B.base');
	saveCollapseState(
		vault.app,
		{ base: 'B.base', view: 'Backlog' },
		{ collapsed: new Set(), expanded: new Set(), mode: DELIVERABLES_MODE },
	);

	const restored = loadCollapseState(vault.app, { base: 'B.base', view: 'Backlog' });
	expect(restored.mode).toBe(DELIVERABLES_MODE);
});

it('still drops an unrecognised mode value, defensively', () => {
	vault.addFile('B.base');
	vault.localStorage.set('product-backlog:collapse', {
		'B.base%23Backlog': { base: 'B.base', collapsed: [], expanded: [], mode: 'something-else' },
	});

	const restored = loadCollapseState(vault.app, { base: 'B.base', view: 'Backlog' });
	expect(restored.mode).toBeNull();
});
```

Add `DELIVERABLES_MODE` to this file's `collapseStore` import line.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/storage/collapseStore.test.ts -t "Deliverables mode"`
Expected: FAIL — `DELIVERABLES_MODE` does not exist; the stored mode round-trips as
`null` even for a value that should be recognised once the constant is added.

- [ ] **Step 3: Implement**

In `src/storage/collapseStore.ts`, beside `ROADMAP_MODE`:

```ts
/** The value the `mode` field holds while the view is the Deliverables board. */
export const DELIVERABLES_MODE = 'deliverables';
```

In `readEntry`, widen the allowlist:

```ts
	const mode = readEnum(record.mode, [BOARD_MODE, ROADMAP_MODE, DELIVERABLES_MODE]);
```

In `src/view/collapseState.ts`, import `DELIVERABLES_MODE` and widen `projection()`/
`setProjection()`:

```ts
	projection(): Projection {
		if (this.mode === BOARD_MODE) return 'board';
		if (this.mode === ROADMAP_MODE) return 'roadmap';
		if (this.mode === DELIVERABLES_MODE) return 'deliverables';
		return 'tree';
	}

	setProjection(mode: Projection): void {
		// The tree is the default and needs no stored value; a stored entry saved
		// before a projection existed reads back as the tree the same way.
		this.mode = mode === 'tree' ? null : mode === 'board' ? BOARD_MODE : mode === 'roadmap' ? ROADMAP_MODE : DELIVERABLES_MODE;
		this.scheduleSave();
	}
```

(`Projection` itself is widened in Task 11; this task's own tests exercise the store
directly, so they do not depend on that yet.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/collapseStore.ts src/view/collapseState.ts test/storage/collapseStore.test.ts
git commit -m "feat: persist the Deliverables projection in the collapse store"
```

---

### Task 11: Widen `Projection`, declare the write path and the filter-only predicate on `BacklogViewHost`

**Files:**
- Modify: `src/view/host.ts`
- Test: none (interface-only; exercised by later tasks' tests)

**Interfaces:**
- Consumes: `Projection` (existing), `computeDeliverableStateWrites`/`ItemWrite`
  (Task 7).
- Produces: `Projection = 'tree' | 'board' | 'roadmap' | 'deliverables'`;
  `BacklogViewHost.performDeliverablesBoardMove(item, state): Promise<boolean>`;
  `BacklogViewHost.isRowHiddenByFilterOnly(item): boolean`. Consumed by every
  remaining task.

This is a pure interface change with no runtime behavior of its own — TypeScript will
fail every implementer (`ProductBacklogView`) to compile until Task 13 implements both
new methods, which is expected and is why this task carries no test of its own; the
compile failure IS the check, resolved by Task 13.

- [ ] **Step 1: Widen `Projection`**

```ts
export type Projection = 'tree' | 'board' | 'roadmap' | 'deliverables';
```

- [ ] **Step 2: Declare the write-path method**

Beside `performBoardMove` in the `BacklogViewHost` interface:

```ts
	/**
	 * Plan and apply the Deliverable workflow's state write — the canonical value, or
	 * key removal for the no-state column. The board's rule, on the Deliverable
	 * workflow's own property: one path for all three inputs (a drop, an Alt+arrow,
	 * the card menu), so no input can write the requirements state key by mistake.
	 */
	performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean>;
```

- [ ] **Step 3: Declare the filter-only visibility predicate**

Beside `isRowHiddenUnfiltered`:

```ts
	/**
	 * The Deliverables board's own visibility rule: the quick filter alone, never
	 * "Show completed items" — that toggle describes the requirements workflow's own
	 * rollup (`item.subtreeDone`), and the Deliverables board has no completion concept
	 * of its own (Scope). Found by review: `syncCountLabel` needs this too, or the
	 * toolbar's count and the board's own visible cards can disagree.
	 */
	isRowHiddenByFilterOnly(item: BacklogItem): boolean;
```

- [ ] **Step 4: Confirm the expected compile failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `ProductBacklogView` (in `src/view/backlogView.ts`) does not implement
`performDeliverablesBoardMove` or `isRowHiddenByFilterOnly` yet. This is the expected
state until Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/view/host.ts
git commit -m "feat: declare the Deliverables write path and filter-only visibility on BacklogViewHost"
```

---

### Task 12: `CardMoveController.performDeliverablesBoardMove`

**Files:**
- Modify: `src/view/cardMoves.ts`
- Test: none directly (this class has no dedicated unit-test file today — see Task 17,
  which exercises it through the real view harness, the same way `performBoardMove` is
  exercised via `test/view/boardMoves.test.ts` rather than a `cardMoves.test.ts`)

**Interfaces:**
- Consumes: `computeDeliverableStateWrites` (Task 7), `announceBoardMove` (existing,
  `interactions/cardDrag.ts` — already generic over columns/title/from/to),
  `applyCardMove` (existing private method).
- Produces: `CardMoveController.performDeliverablesBoardMove(item, state): Promise<boolean>`.
  Consumed by Task 13 (`backlogView.ts`'s delegation).

- [ ] **Step 1: Implement**

In `src/view/cardMoves.ts`, add a fourth sibling method beside `performBoardMove`:

```ts
	async performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		const from = item.deliverableStateValue;
		// `host.board` is the one snapshot field — it already holds whichever
		// board-shaped projection's snapshot the last render produced, so reading it
		// here needs no `host.projection` check: it is non-null on exactly this move's
		// own board while the Deliverables projection is active.
		const columns = this.host.board?.board;
		return this.applyCardMove(item, computeDeliverableStateWrites(item, state), () =>
			announceBoardMove(columns, item.title, from, state),
		);
	}
```

Import `computeDeliverableStateWrites` into the existing
`import { computeDropWrites, computeHorizonWrites, computeScheduleWrites, computeStateWrites, ItemWrite, SchedulePlan } from '../domain/writePlan';`
line.

There is no Step 2-4 TDD cycle for this task in isolation: `performDeliverablesBoardMove`
has no observable effect until `BacklogViewHost.performDeliverablesBoardMove` (Task 13)
delegates to it and a caller (Task 19's drag wiring, Task 20's keyboard, Task 21's menu)
actually invokes it. Task 17's view-level tests are what exercises this method end to
end, the same way `test/view/boardMoves.test.ts` is what exercises `performBoardMove`
rather than a unit test of `CardMoveController` alone.

- [ ] **Step 5: Commit**

```bash
git add src/view/cardMoves.ts
git commit -m "feat: CardMoveController.performDeliverablesBoardMove"
```

---

### Task 13: Wire the delegation and the filter-only predicate on `ProductBacklogView`

**Files:**
- Modify: `src/view/backlogView.ts`
- Test: none directly — this resolves Task 11's expected compile failure; exercised by
  Task 17's tests.

**Interfaces:**
- Consumes: `CardMoveController.performDeliverablesBoardMove` (Task 12).
- Produces: `ProductBacklogView.performDeliverablesBoardMove`/`isRowHiddenByFilterOnly`
  implemented; `pbl-board-mode` widened to both board-shaped projections.

- [ ] **Step 1: Implement the write-path delegation**

Beside the existing one-line delegations (`performBoardMove` etc.):

```ts
	performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		return this.cardMoves.performDeliverablesBoardMove(item, state);
	}
```

- [ ] **Step 2: Implement the filter-only predicate**

Beside `isRowHiddenUnfiltered`:

```ts
	isRowHiddenByFilterOnly(item: BacklogItem): boolean {
		return this.filter.active && !this.filter.keeps(item.file.path);
	}
```

`this.filter` (a `FilterState`) already exposes `active`/`keeps` — confirmed by the
existing `hidden()` method's own first branch, which this mirrors without the
`hidingCompleted()`/`outsideFilter` branches that follow it.

- [ ] **Step 3: Widen the board-mode CSS class**

In `renderTreeContent`:

```ts
		this.viewEl.toggleClass('pbl-board-mode', projection === 'board' || projection === 'deliverables');
```

- [ ] **Step 4: Confirm the compile failure from Task 11 is resolved**

Run: `npx tsc --noEmit`
Expected: PASS (no more missing-method errors on `ProductBacklogView`).

Run: `npx vitest run test/view` (the whole view suite — a wide regression check, since
this touches a base class every view test constructs)
Expected: PASS — no existing test asserts on `pbl-board-mode` being absent for a
projection value that did not exist before this task, so nothing here should regress.

- [ ] **Step 5: Commit**

```bash
git add src/view/backlogView.ts
git commit -m "feat: wire the Deliverables write path and filter-only visibility on the view"
```

---

### Task 14: Guidance states for the Deliverables board

**Files:**
- Modify: `src/view/render/emptyStates.ts`
- Test: `test/view/board.test.ts`

**Interfaces:**
- Consumes: `guidanceShell`, `renderSetupCta` (existing private helpers in this file),
  `adoptableProperties` (existing).
- Produces: `renderDeliverablesBoardNoWorkflowState(host, treeEl)`,
  `renderNoDeliverablesState(host, treeEl)`. Consumed by Task 15
  (`renderDeliverablesBoardContent`) and Task 16
  (`renderBoard`'s `drawEmpty` for the Deliverables board).

- [ ] **Step 1: Write the failing tests**

```ts
// test/view/board.test.ts — new tests, following the existing
// "shows guidance instead of a board when no state property is configured" pattern
it('shows guidance instead of the Deliverables board when no Deliverable state property is configured', () => {
	const vault = boardVault();
	const harness = makeView(vault, {});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
	expect(hint).toContain('Deliverable state property');
	expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
});

it('shows "no Deliverables yet" when the workflow is configured but nothing is typed Deliverable', () => {
	const vault = boardVault(); // Epics and Features only, no Deliverable
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
	expect(title).toContain('deliverable');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/board.test.ts -t "Deliverables board"`
Expected: FAIL — `setProjection('deliverables')` is a valid call (Task 11 widened the
type) but nothing renders a Deliverables-specific guidance state yet (Task 15 has not
wired the dispatcher, so this currently falls through to the tree). These tests will
only go fully green once Task 15 lands; write them now so Task 15's own Step 4 has
something to turn green, per this plan's usual TDD shape — or defer running this task's
own Step 2/4 verification until immediately after Task 15, noting that dependency here.

- [ ] **Step 3: Implement**

In `src/view/render/emptyStates.ts`, beside `renderBoardNoWorkflowState`:

```ts
/**
 * The Deliverables board without its own workflow configured — the same "no lie about
 * a workflow that does not exist" rule `renderBoardNoWorkflowState` states, for the
 * second workflow.
 */
export function renderDeliverablesBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		'No workflow to show',
		'The Deliverables board is a projection of its own workflow, and this view has no ' +
			'Deliverable state property yet. Set "Deliverable state property" in the view ' +
			'options — and optionally "Deliverable workflow states (in order)" — and the ' +
			'board will draw one column per state.',
	);
	renderSetupCta(host, empty, ['deliverableState']);
}

/**
 * A configured Deliverable workflow with no Deliverable-typed results anywhere in the
 * base — distinct from "everything is done and hidden", which this board has no concept
 * of (Scope): a base full of other work is never reported as complete.
 */
export function renderNoDeliverablesState(host: BacklogViewHost, treeEl: HTMLElement): void {
	guidanceShell(
		treeEl,
		'package',
		'No deliverables yet',
		'Nothing in this base is typed "Deliverable". Create one from the toolbar\'s New ' +
			'menu, or type an existing note as a Deliverable from its Set type menu.',
	);
}
```

`renderSetupCta` already accepts an `OptionalField[]` (`fixes` parameter) — passing
`['deliverableState']` requires nothing new from it; `'deliverableState'` is a valid
`OptionalField` value as of Task 3.

- [ ] **Step 4: Run tests to verify they pass**

This task's tests depend on Task 15's dispatcher wiring to reach these functions at
all. Proceed to Task 15, then return here.

Run (after Task 15): `npx vitest run test/view/board.test.ts -t "Deliverables board"`
Expected: PASS

- [ ] **Step 5: Commit**

Commit together with Task 15 (see Task 15 Step 5) — the two do not produce an
observable effect independently.

---

### Task 15: `renderProjectionContent`'s fourth branch

**Files:**
- Modify: `src/view/render/projections.ts`
- Test: `test/view/board.test.ts`

**Interfaces:**
- Consumes: `renderBoardContent`'s shape (existing, same file),
  `renderDeliverablesBoardNoWorkflowState` (Task 14), `renderBoard` (Task 16 — see the
  note on step ordering below).
- Produces: `renderProjectionContent` dispatches `'deliverables'` to a new
  `renderDeliverablesBoardContent`, returning its board through the SAME
  `ProjectionContent.board` field `renderBoardContent` already returns — no second
  snapshot field.

**Step-ordering note:** this task's `renderDeliverablesBoardContent` calls `renderBoard`
with the parametrized signature Task 16 introduces. Implement Tasks 15 and 16 together
(this task's Step 3 references Task 16's `BoardRenderOptions`); their tests are written
and run together at the end of Task 16.

- [ ] **Step 1: Write the failing test**

(This is the test named in Task 14 Step 1 — `'shows guidance instead of the
Deliverables board when no Deliverable state property is configured'` — plus one more,
asserting the fourth toggle actually draws columns once configured. Found by review:
the content dispatcher is "the one change in the whole design a passing test suite
could not catch without a `view/`-level test actually asserting on the fourth toggle's
rendered content".)

```ts
// test/view/board.test.ts
it('draws the Deliverables board, scoped to Deliverable-typed results, once configured', () => {
	const vault = boardVault(); // Epics and Features, none typed Deliverable
	vault.addFile('D1.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	const harness = makeView(vault, {
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review, Published',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	expect(columnNames(containerEl)).toEqual(['No state', 'Draft', 'Review', 'Published']);
	expect(cardTitles(columnByName(containerEl, 'Draft'))).toEqual(['D1']);
	// Epics and Features never become cards on this board.
	expect(cardTitles(columnByName(containerEl, 'No state'))).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/board.test.ts -t "Deliverables"`
Expected: FAIL — `renderProjectionContent` still falls through to `renderTree` for
`'deliverables'`, so no `.pbl-board-col` elements exist.

- [ ] **Step 3: Implement**

In `src/view/render/projections.ts`, widen the dispatcher:

```ts
export function renderProjectionContent(
	projection: Projection,
	ctx: RowContext,
	treeEl: HTMLElement,
	dnd: CardDragController,
): ProjectionContent {
	if (projection === 'board') return renderBoardContent(ctx, treeEl, dnd);
	if (projection === 'roadmap') return renderRoadmapContent(ctx, treeEl, dnd);
	if (projection === 'deliverables') return renderDeliverablesBoardContent(ctx, treeEl, dnd);
	renderTree(ctx, treeEl);
	return { board: null, roadmap: null, role: 'tree', label: 'Product backlog' };
}
```

Add the new content function, mirroring `renderBoardContent`'s shape exactly:

```ts
/**
 * The Deliverables board projection — the same guidance-or-columns rule
 * `renderBoardContent` follows, gated on the DELIVERABLE state property instead of the
 * requirements one. Returns its board through the same `ProjectionContent.board`
 * field `renderBoardContent` uses — there is no second snapshot field.
 */
function renderDeliverablesBoardContent(ctx: RowContext, treeEl: HTMLElement, dnd: CardDragController): ProjectionContent {
	const label = 'Deliverables board';
	if (!ctx.host.settings.deliverableStateKey) {
		renderDeliverablesBoardNoWorkflowState(ctx.host, treeEl);
		return { board: null, roadmap: null, role: 'region', label };
	}
	return { board: renderDeliverablesBoard(ctx, treeEl, dnd), roadmap: null, role: 'listbox', label };
}
```

`renderDeliverablesBoard` is the Task 16 function that builds the `BoardModel` via
`deliverablesWorkflow`/`boardColumns` and calls the parametrized `renderBoard`. Import
it, along with `renderDeliverablesBoardNoWorkflowState`, at the top of this file:

```ts
import { renderBoard, renderDeliverablesBoard } from './board';
import { renderBoardNoWorkflowState, renderDeliverablesBoardNoWorkflowState, renderRoadmapNoAxisState } from './emptyStates';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/board.test.ts`
Expected: PASS — this also resolves Task 14's two tests; run
`npx vitest run test/view/board.test.ts -t "Deliverables board"` to confirm those too.

- [ ] **Step 5: Commit**

```bash
git add src/view/render/projections.ts src/view/render/emptyStates.ts test/view/board.test.ts
git commit -m "feat: dispatch the Deliverables projection to its own board content"
```

---

### Task 16: Parametrize `renderBoard`/`renderColumn`/`createCard`, add `renderDeliverablesBoard`

**Files:**
- Modify: `src/view/render/board.ts`
- Test: `test/view/board.test.ts`, `test/view/boardMoves.test.ts`

**Interfaces:**
- Consumes: `boardColumns`/`Workflow`/`requirementsWorkflow`/`deliverablesWorkflow`
  (Task 9), `BoardModel` (existing), `BacklogItem.deliverableDone` (Task 6).
- Produces: `renderBoard(ctx, boardEl, dnd, board, opts)` (new signature, `opts:
  BoardRenderOptions`), `createCard(ctx, containerEl, item, done?)`,
  `renderDeliverablesBoard(ctx, treeEl, dnd): BoardSnapshot`. Consumed by Task 15
  (already wired above) and Task 19 (drag wiring reads `renderColumn`'s `move` param
  indirectly through `renderBoard`).

Found by review, four separate gaps in this one file:
1. `renderBoard`/`renderColumn` hardcode `host.settings`/`host.performBoardMove`/
   `boardColumns`'s requirements-scoped call internally.
2. `createCard` hardcodes `item.done` for the `pbl-done` class — the requirements
   workflow's completion, wrong for a card whose OWN workflow disagrees.
3. `renderBoardAdvisory` assumes "the base is empty" and "nothing matches this board's
   type filter" are the same question.
4. The board-mode CSS class (Task 13, already done) and "Show completed items" gate
   (Task 20) are elsewhere but depend on this task's population predicate shape.

- [ ] **Step 1: Write the failing tests**

The Deliverables-scoped test from Task 15 Step 1 already exercises most of this file
through the dispatcher. Add two more, directly asserting the two behaviors unique to
this file:

```ts
// test/view/board.test.ts
it('renders a card done in its own workflow as done, regardless of the requirements state', () => {
	const vault = boardVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		deliverableStateProperty: 'note.deliverableStatus',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	// Done on the REQUIREMENTS board, not on this one.
	expect(cardByTitle(containerEl, 'D').classList.contains('pbl-done')).toBe(false);
});

it('shows "no deliverables yet" rather than "all done and hidden" for a base with none', () => {
	const vault = boardVault(); // Epics and Features only
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
	expect(title).not.toContain('done');
	expect(title).toContain('deliverable');
});
```

(`test/view/boardMoves.test.ts` gets its Deliverables-specific write-path tests in
Task 19, once `renderColumn`'s drop wiring calls the right `move`; nothing new here.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/board.test.ts -t "own workflow"`
Expected: FAIL — `renderDeliverablesBoard` does not exist yet (compile error via
Task 15's import).

- [ ] **Step 3: Implement**

In `src/view/render/board.ts`, widen imports:

```ts
import { boardColumns, BoardColumn, BoardModel, cardPaths, deliverablesWorkflow, hiddenMatches, overBy, requirementsWorkflow } from '../../domain/board';
```

Replace `renderBoard` and `renderBoardAdvisory`:

```ts
/** What differs between the two board-shaped projections' render passes. */
export interface BoardRenderOptions {
	move: (item: BacklogItem, state: string | null) => void;
	drawEmpty: (host: BacklogViewHost, aside: HTMLElement) => void;
	doneOf?: (item: BacklogItem) => boolean;
}

export function renderBoard(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	board: BoardModel,
	opts: BoardRenderOptions,
): BoardSnapshot {
	renderBoardInstructions(boardEl);
	const colsEl = boardEl.createDiv({ cls: 'pbl-board-cols' });
	const carded = cardPaths(board);
	const colEls = board.columns.map((col) => renderColumn(ctx, colsEl, col, dnd, carded, opts));
	dnd.wireScroller(boardEl);
	renderBoardAdvisory(ctx, boardEl, board, opts.drawEmpty);
	return { board, colEls };
}

/** The requirements board — `renderBoard`'s original, only caller until now. */
export function renderRequirementsBoard(ctx: RowContext, boardEl: HTMLElement, dnd: CardDragController): BoardSnapshot {
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const board = boardColumns(
		model,
		requirementsWorkflow(model, host.settings),
		model.focused ? model.roots : model.results,
		(item) => !host.isRowHidden(item),
		(item) => !host.isRowHiddenUnfiltered(item),
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		move: (item, state) => void host.performBoardMove(item, state),
		drawEmpty: (h, aside) => {
			const m = h.model;
			if (!m) return;
			if (m.results.length === 0) renderEmptyState(h, aside);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside);
			else renderAllDoneState(h, aside, m.results.length);
		},
	});
}

/**
 * The Deliverables board — every Deliverable-typed result `model.results` currently
 * contains, focused or not: it reads `model.results` rather than `model.roots`
 * because a type filter over the latter cannot reach a nested Deliverable under an
 * active focus (a focus's roots are Features/PBIs, never a Deliverable itself). This
 * is NOT the same as bypassing focus — `model.results` is itself narrowed to the
 * focused subtree when a focus is active (`buildModel`'s `shown()`), so a Deliverable
 * OUTSIDE that subtree still will not render here until focus clears. Also regardless
 * of either workflow's completion state (Scope: no "Show completed items" concept here).
 */
export function renderDeliverablesBoard(ctx: RowContext, boardEl: HTMLElement, dnd: CardDragController): BoardSnapshot {
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const isDeliverable = (item: BacklogItem) => item.typeName?.toLowerCase() === 'deliverable';
	const board = boardColumns(
		model,
		deliverablesWorkflow(model, host.settings),
		model.results,
		(item) => !host.isRowHiddenByFilterOnly(item) && isDeliverable(item),
		(item) => isDeliverable(item),
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		move: (item, state) => void host.performDeliverablesBoardMove(item, state),
		doneOf: (item) => item.deliverableDone,
		drawEmpty: (h, aside) => {
			const m = h.model;
			if (!m) return;
			const anyDeliverable = m.results.some(isDeliverable);
			if (!anyDeliverable) renderNoDeliverablesState(h, aside);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside);
		},
	});
}
```

`renderBoardAdvisory` takes the empty-drawer as a parameter instead of deciding
internally:

```ts
function renderBoardAdvisory(
	ctx: RowContext,
	boardEl: HTMLElement,
	board: BoardModel,
	drawEmpty: (host: BacklogViewHost, aside: HTMLElement) => void,
): void {
	if (board.columns.some((col) => col.cards.length > 0)) return;
	drawEmpty(ctx.host, boardEl.createDiv({ cls: 'pbl-board-advisory' }));
}
```

`renderColumn` takes the same `opts` and passes `move`/`doneOf` down:

```ts
function renderColumn(
	ctx: RowContext,
	colsEl: HTMLElement,
	col: BoardColumn,
	dnd: CardDragController,
	carded: Set<string>,
	opts: BoardRenderOptions,
): HTMLElement {
	const strip = col.state === null && col.cards.length === 0 && col.fullCount === 0;
	const filtering = ctx.host.isFiltering();
	const colEl = colsEl.createDiv({
		cls:
			'pbl-board-col' +
			(col.done ? ' pbl-col-done' : '') +
			(col.outsideWorkflow ? ' pbl-col-outside' : '') +
			(col.state === null ? ' pbl-col-nostate' : '') +
			(strip ? ' pbl-board-strip' : ''),
		attr: { role: 'group', 'aria-label': columnLabel(col, filtering) },
	});
	renderColumnHeader(colEl, col, strip, filtering);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, dnd, carded, opts.doneOf);
	dnd.wireDropTarget(colEl, (source) => opts.move(source.item, col.state));
	dnd.wireScroller(cardsEl);
	return colEl;
}
```

`renderCard`/`createCard` take a `doneOf` reader, defaulted to `item.done`:

```ts
function renderCard(
	ctx: RowContext,
	cardsEl: HTMLElement,
	item: BacklogItem,
	dnd: CardDragController,
	carded: Set<string>,
	doneOf: (item: BacklogItem) => boolean = (i) => i.done,
): void {
	const card = createCard(ctx, cardsEl, item, doneOf(item));
	renderCardBody(ctx, card, item);
	renderCardMatches(ctx, card, item, carded);
	wireCardActivation(ctx, card, item);
	dnd.wireCard(card, item);
}

export function createCard(ctx: RowContext, containerEl: HTMLElement, item: BacklogItem, done = item.done): HTMLElement {
	const selected = ctx.host.selectedPath === item.file.path;
	const card = containerEl.createDiv({
		cls:
			'pbl-card' +
			(done ? ' pbl-done' : '') +
			(item.outsideFilter ? ' pbl-card-context pbl-outside' : '') +
			(selected ? ' pbl-selected' : ''),
		attr: { role: 'option', 'aria-selected': String(selected) },
	});
	card.dataset.path = item.file.path;
	ctx.rows.set(item.file.path, card);
	return card;
}
```

Import `renderNoDeliverablesState` into this file's
`import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';` line.

Update `render/projections.ts`'s `renderBoardContent` (existing function, not touched
by Task 15) to call `renderRequirementsBoard` instead of the old `renderBoard`:

```ts
	return { board: renderRequirementsBoard(ctx, treeEl, dnd), roadmap: null, role: 'listbox', label };
```

and its import line:

```ts
import { renderBoard, renderDeliverablesBoard, renderRequirementsBoard } from './board';
```

(`renderBoard` itself stays imported/exported for `renderDeliverablesBoard`'s and
`renderRequirementsBoard`'s own use inside `board.ts`; `projections.ts` calls the two
`render*Board` entry points, never the shared `renderBoard` directly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/board.test.ts`
Expected: PASS — including every requirements-board test in this file, which must
still pass unchanged now that they route through `renderRequirementsBoard`.

Run: `npx vitest run test/view` (wide regression check — `createCard`'s new optional
parameter must not change the roadmap's own card rendering, which calls it too)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/view/render/board.ts src/view/render/projections.ts test/view/board.test.ts
git commit -m "feat: parametrize the board renderer, add the Deliverables board"
```

---

### Task 17: The fourth toolbar toggle, and the completed-toggle/count-label gates

**Files:**
- Modify: `src/view/render/toolbar.ts`
- Test: `test/view/toolbar.test.ts`

**Interfaces:**
- Consumes: `Projection` (Task 11), `isRowHiddenByFilterOnly` (Task 13).
- Produces: a fourth `.pbl-mode-btn` in `renderModeToggle`; `renderCompletedToggle`
  hidden on the Deliverables board; `syncCountLabel` counts by the filter-only
  predicate on that projection.

Found by review: `syncCountLabel` (unrelated to the completed-toggle button itself,
but the same family of bug) hardcodes `host.isRowHidden`, so a Deliverable rendered
visible on this board (because `isRowHiddenByFilterOnly` does not hide it) could still
be reported hidden by the toolbar's own count.

- [ ] **Step 1: Write the failing tests**

```ts
// test/view/toolbar.test.ts — new tests, following the file's existing mode-toggle
// and completed-toggle coverage
it('offers a fourth toggle position for the Deliverables board', () => {
	const { containerEl, view } = makeView(fixture());
	const btn = projectionButton(containerEl, 'Show Deliverables board');
	expect(btn).toBeTruthy();

	btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	expect(view.projection).toBe('deliverables');
});

it('hides "Show completed items" on the Deliverables board even with a requirements state key', () => {
	const harness = makeView(fixture(), { stateProperty: 'note.status' });
	harness.view.setProjection('deliverables');
	expect(harness.containerEl.querySelector('.pbl-completed-toggle')).toBeNull();
});

it('counts a Deliverable done only in the requirements workflow as visible, not hidden', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		showCompleted: false,
		deliverableStateProperty: 'note.deliverableStatus',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
});
```

`projectionButton` already exists in `test/helpers/view.ts` (used by the existing
tree/board/roadmap toggle tests in this file), keyed on the button's `aria-label`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/toolbar.test.ts -t "Deliverables"`
Expected: FAIL — no fourth toggle position exists;
`renderCompletedToggle` still renders on the Deliverables board;
`syncCountLabel` reports "0 of 1" for the third test (hidden by `isRowHidden`'s
`hidingCompleted()` branch).

- [ ] **Step 3: Implement**

In `src/view/render/toolbar.ts`'s `renderModeToggle`:

```ts
	position('tree', 'list-tree', 'Show as backlog tree');
	position('board', 'square-kanban', 'Show as kanban board');
	position('roadmap', 'map', 'Show as roadmap');
	position('deliverables', 'package', 'Show Deliverables board');
```

`renderCompletedToggle`'s gate:

```ts
function renderCompletedToggle(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	if (!host.settings.stateKey || host.projection === 'deliverables') return;
	...
```

`syncCountLabel`:

```ts
export function syncCountLabel(host: BacklogViewHost, barEl: HTMLElement): void {
	const label = barEl.querySelector<HTMLElement>('.pbl-count-label');
	const model = host.model;
	if (!label || !model) return;
	const hidden = (item: BacklogItem): boolean =>
		host.projection === 'deliverables' ? host.isRowHiddenByFilterOnly(item) : host.isRowHidden(item);
	const total = model.results.length;
	const shown = model.results.filter((item) => !hidden(item)).length;
	if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
	else label.setText(`${shown} of ${total}`);
}
```

Import `BacklogItem` into this file if not already present (`BacklogModel` already is;
check the existing `import { BacklogModel } from '../../domain/model';` line and widen
it to `import { BacklogItem, BacklogModel } from '../../domain/model';`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/toolbar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/view/render/toolbar.ts test/view/toolbar.test.ts
git commit -m "feat: the fourth toolbar toggle, and the completed-toggle/count-label gates"
```

---

### Task 18: `handleProjectionKeydown` treats `'deliverables'` as board-shaped

**Files:**
- Modify: `src/view/interactions/keyboard.ts`
- Test: `test/view/keyboard.test.ts`

**Interfaces:**
- Consumes: `handleBoardKeydown` (existing), `performDeliverablesBoardMove` (Task 13).
- Produces: the Deliverables board reaches ordinary board keyboard navigation, and
  Alt+Left/Right writes the Deliverable state.

**Two independent gaps, found by review, both from the same missed pattern:** the
top-level dispatcher (`handleProjectionKeydown`) sends everything but `'board'`/
`'roadmap'` to the TREE handler — so `'deliverables'` would reach `handleTreeKeydown`'s
own Alt+arrows, which reorder/indent/outdent and write `parent`/`order`, not merely
lack a feature. And even once routed to the board handler, `handleBoardMoveKey`
hardcodes `host.performBoardMove` — the third of "one move, three inputs" to be fixed,
after the drag (Task 16) and the menu (Task 19).

- [ ] **Step 1: Write the failing tests**

**Found by review: `key(treeOf(containerEl), 'ArrowRight')` alone does not select the
`D` card.** Every board draws a leading no-state column first (`boardColumns` always
puts it at index 0), which is empty in this fixture — `nextBoardPosition`'s
`ArrowRight`-from-nothing case is `entry(0)`, which lands on that EMPTY column's own
stop (`{col: 0, card: -1}`), not on a card, and a further `ArrowRight` cannot recover a
card position either (`Math.min(pos.card, ...)` carries `-1` forward once the column
entered has fewer cards than that). Selecting the card directly through the host,
rather than depending on arrow arithmetic that was never this test's subject, is both
simpler and correct:

```ts
// test/view/keyboard.test.ts — new tests
it('routes the Deliverables board through the board keyboard handler, not the tree', async () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	const harness = makeView(vault, {
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	// Nothing selected yet: the TREE handler's ArrowRight is a no-op with no current
	// row (`handleExpandCollapseKey` is only reached when `current` is non-null), while
	// the BOARD handler always has an entry point — even an empty leading column is a
	// valid stop. Landing on `selectedBoardColumn` is proof the board dispatcher ran;
	// the tree handler would leave it untouched (null).
	key(treeOf(containerEl), 'ArrowRight');
	await flush();
	expect(harness.view.selectedBoardColumn).toBe(0);
});

it('Alt+Right on a Deliverables card writes the Deliverable state alone', async () => {
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Untouched', deliverableStatus: 'Draft' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl, vault: v } = harness;

	// Select the card directly rather than via arrow navigation — the leading no-state
	// column is empty in this fixture, so an ArrowRight walk lands on ITS stop, never
	// on a card, and this test's subject is the move-key routing, not board arithmetic.
	const card = harness.view.model?.results.find((i) => i.title === 'D');
	if (!card) throw new Error('missing D');
	harness.view.selectItem(card);

	key(treeOf(containerEl), 'ArrowRight', { altKey: true });
	await flush();

	expect(v.fm('D.md')['deliverableStatus']).toBe('Review');
	expect(v.fm('D.md')['status']).toBe('Untouched');
});
```

Check `makeView`'s harness return shape in `test/helpers/view.ts` for the exact field
name of the returned `FakeVault` (`vault` per the existing convention seen in other
`test/view/*.test.ts` files); adjust the destructure above to match if it differs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/keyboard.test.ts -t "Deliverables"`
Expected: FAIL — the first test fails because `handleTreeKeydown` runs instead of
`handleBoardKeydown` (`selectedBoardColumn` stays `null`, since only the board handler
ever sets it); the second fails because even once routed, `handleBoardMoveKey` calls
`performBoardMove`, writing `status` rather than `deliverableStatus`.

- [ ] **Step 3: Implement**

In `src/view/interactions/keyboard.ts`, widen the top-level dispatcher:

```ts
export function handleProjectionKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	if (host.projection === 'board' || host.projection === 'deliverables') handleBoardKeydown(host, evt);
	else if (host.projection === 'roadmap') handleRoadmapKeydown(host, evt);
	else handleTreeKeydown(host, evt);
}
```

In `handleBoardMoveKey`, branch on projection for the write:

```ts
function handleBoardMoveKey(
	host: BacklogViewHost,
	snapshot: BoardSnapshot,
	pos: BoardPosition,
	evt: KeyboardEvent,
): void {
	if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight') return;
	evt.preventDefault();
	const card = snapshot.board.columns[pos.col].cards[pos.card];
	if (!card || card.outsideFilter) return;
	const target = pos.col + (evt.key === 'ArrowRight' ? 1 : -1);
	if (target < 0 || target >= snapshot.board.columns.length) return;
	const state = snapshot.board.columns[target].state;
	if (host.projection === 'deliverables') void host.performDeliverablesBoardMove(card, state);
	else void host.performBoardMove(card, state);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/keyboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/view/interactions/keyboard.ts test/view/keyboard.test.ts
git commit -m "feat: route the Deliverables board through board keyboard handling"
```

---

### Task 19: `activeBoard(host)` and the menu's four Deliverables-aware call sites

**Files:**
- Modify: `src/view/interactions/menu.ts`
- Test: `test/view/menu.test.ts`

**Interfaces:**
- Consumes: `performDeliverablesBoardMove` (Task 13), `computeDeliverableStateWrites`
  (Task 7), `deliverableStateKey` (Task 3).
- Produces: `activeBoard(host): BoardModel | null`; the Set-state gate, `stateChoices`,
  `chooseState`, `addStateItems` and `addMatchSection` all Deliverables-aware.

Found by review: four independent call sites in this one file resolve "which board is
active" with the same `host.projection === 'board' ? host.board?.board : null` ternary
— or, worse, a `host.settings.stateKey`-only visibility gate that has no Deliverables
branch at all. Since `host.board` already holds whichever board-shaped projection's
snapshot is current (Task 12's own comment states why), `activeBoard` needs no
projection check of its own — it is simply `host.board?.board ?? null`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/view/menu.test.ts — new tests
it('offers Set state on a Deliverables-board card when only the Deliverable key is configured', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	const harness = makeView(vault, {
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const setState = Menu.lastShown?.item('Set state');
	expect(setState).toBeDefined();
	const submenu = setState?.submenu;
	expect(submenu?.items.map((i) => i.titleText)).toContain('Review');
});

it('checks the entry against deliverableStateValue, and writing it touches only that key', async () => {
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Untouched', deliverableStatus: 'Draft' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl, vault: v } = harness;

	cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const submenu = Menu.lastShown?.item('Set state')?.submenu;
	expect(submenu?.item('Draft')?.checked).toBe(true);

	submenu?.item('Review')?.click();
	await flush();
	expect(v.fm('D.md')['deliverableStatus']).toBe('Review');
	expect(v.fm('D.md')['status']).toBe('Untouched');
});

it('keeps a filtered match under a Deliverable card reachable through the card menu', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, deliverableStatus: 'irrelevant' }, parentLink: 'D' });
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;
	harness.view.setFilter('T');

	cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	expect(Menu.lastShown?.item('Open match "T"')).toBeDefined();
});

it('hides Set state on the tree when only the Deliverable key is configured', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	// deliverableStateKey configured, requirements stateKey left unset — the tree's
	// own Set state must not appear promising a write to an empty key.
	const { containerEl } = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });

	rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	expect(Menu.lastShown?.item('Set state')).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/menu.test.ts -t "Deliverables"`
Expected: FAIL — the Set-state gate checks only `host.settings.stateKey` (absent here),
so "Set state" is missing entirely from the first two tests; `addMatchSection` gates on
`host.projection === 'board'` alone, so the third finds no "Open match" entry.

- [ ] **Step 3: Implement**

In `src/view/interactions/menu.ts`, add the shared helper near the top (after the
imports):

```ts
/**
 * Whichever board-shaped projection is active, or null off both. `host.board` is
 * already the one snapshot field — non-null on exactly `'board'` and `'deliverables'`,
 * whichever is current — so this needs no `host.projection` branch of its own.
 */
function activeBoard(host: BacklogViewHost): BoardModel | null {
	return host.board?.board ?? null;
}
```

Import `BoardModel` into this file's existing
`import { cardPaths, hiddenMatches } from '../../domain/board';` line, widened to
`import { BoardModel, cardPaths, hiddenMatches } from '../../domain/board';`.

The Set-state visibility gate, in `buildItemMenu`: **projection-aware, not an OR of
both keys — found by review.** An OR would expose "Set state" on the Tree or Roadmap
projection the moment ONLY `deliverableStateKey` is configured, but `stateChoices`/
`chooseState` on those projections still read the (unconfigured) requirements
`stateKey` — offering a menu whose picks write to an empty key and are silently
dropped (`applyWrites`' "never write to an empty key" rule). The gate has to select the
SAME key the rest of the menu will actually use for the current projection:

```ts
	if (editable) {
		addSetTypeMenu(host, menu, item);
		const activeStateKey = host.projection === 'deliverables' ? host.settings.deliverableStateKey : host.settings.stateKey;
		if (activeStateKey) addSetStateMenu(host, menu, item);
```

`stateChoices`:

```ts
function stateChoices(host: BacklogViewHost, item: BacklogItem): StateChoice[] {
	const board = activeBoard(host);
	if (board) return board.columns.map((col) => ({ state: col.state, label: col.label }));
	const values = stateMenuValues(host.settings, host.model?.observedStates ?? []);
	const current = item.stateValue;
	const listed = current !== null && values.some((v) => sameValue(v, current));
	const all = listed || current === null ? values : [...values, current];
	return all.map((state) => ({ state, label: state }));
}
```

`chooseState`:

```ts
function chooseState(host: BacklogViewHost, item: BacklogItem, choice: StateChoice): Promise<unknown> {
	if (host.projection === 'deliverables') return host.performDeliverablesBoardMove(item, choice.state);
	if (host.projection === 'board' || choice.state === null) return host.performBoardMove(item, choice.state);
	return host.applySafely(computeStateWrites(item, choice.state, host.settings, todayStamp()));
}
```

`addStateItems`' checked-entry test:

```ts
function addStateItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const choice of stateChoices(host, item)) {
		menu.addItem((si) => {
			si.setTitle(choice.label).onClick(() => void chooseState(host, item, choice));
			const noop =
				host.projection === 'deliverables'
					? computeDeliverableStateWrites(item, choice.state).length === 0
					: computeStateWrites(item, choice.state, host.settings, todayStamp()).length === 0;
			if (noop) si.setChecked(true);
		});
	}
}
```

Import `computeDeliverableStateWrites` into this file's existing
`import { computeStateWrites, computeTypeChanges, ItemWrite } from '../../domain/writePlan';`
line.

`addMatchSection`:

```ts
function addMatchSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const board = activeBoard(host);
	if (!board || !host.isFiltering()) return;
	const carded = cardPaths(board);
	const matches = hiddenMatches(item, (child) => host.isFilterMatch(child), carded);
	if (matches.length === 0) return;
	menu.addSeparator();
	for (const match of matches) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Open match "${match.title}"`)
				.setIcon('search')
				.onClick((evt) => host.openItem(match, evt)),
		);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/menu.test.ts`
Expected: PASS — including every requirements-board menu test, unaffected since
`activeBoard` returns the same thing `host.projection === 'board' ? host.board?.board :
null` did on that projection.

- [ ] **Step 5: Commit**

```bash
git add src/view/interactions/menu.ts test/view/menu.test.ts
git commit -m "feat: route the card menu's Set state and matches through activeBoard"
```

---

### Task 20: The generated README — the property row and the extra-types prose

**Files:**
- Modify: `src/domain/backlogReadme.ts`
- Test: `test/domain/backlogReadme.test.ts`

**Interfaces:**
- Consumes: `childTypeChoices(null)` (Task 1), `deliverableStateKey` (Task 3).
- Produces: `fieldRows` gains a Deliverable-state row when configured; `typeSection`'s
  opening paragraph correctly states which extra types are rootable.

Two gaps, found by review: `fieldRows` is hand-enumerated (one `if` per property)
rather than driven by `PROPERTY_TABLE`, so a field joining `OptionalField` does not put
a row in this table for free; and `typeSection`'s prose interpolates the whole
`EXTRA_TYPES` list into "they hang from any rung above the deepest," which becomes
false the moment `Deliverable` — rootable — is one of them.

- [ ] **Step 1: Write the failing tests**

```ts
// test/domain/backlogReadme.test.ts — new tests, following the file's existing
// fieldRows/typeSection coverage pattern
it('adds a property row for a configured Deliverable state key', () => {
	const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
	const content = backlogReadmeContent(settings, [], 'test');
	expect(content).toContain('deliverableStatus');
});

it('omits the Deliverable state row when unconfigured', () => {
	const content = backlogReadmeContent(defaultSettings(), [], 'test');
	expect(content).not.toContain('deliverableStatus');
});

it('says Deliverable may also stand alone, without claiming Issue and Bug can', () => {
	const content = backlogReadmeContent(defaultSettings(), [], 'test');
	expect(content).toContain('Deliverable');
	expect(content).toMatch(/Deliverable.*stand alone|stand alone.*Deliverable/);
	// The prose must not claim the WHOLE extra-types list hangs from any rung once one
	// of them (Deliverable) does not have to.
	expect(content).not.toMatch(/Issue.*Bug.*Deliverable.*hang from any rung/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/backlogReadme.test.ts -t "Deliverable"`
Expected: FAIL — no `deliverableStatus` row appears even when configured; the prose
test may already pass trivially (nothing mentions Deliverable at all yet) but the
positive assertion (`toContain('Deliverable')` / `stand alone`) fails.

- [ ] **Step 3: Implement**

In `src/domain/backlogReadme.ts`'s `fieldRows`, after the existing stamp/horizon/start/
target rows:

```ts
	if (settings.deliverableStateKey) {
		rows.push(`| ${cell(settings.deliverableStateKey)} | Optional, on a Deliverable | The Deliverable workflow's own state — a separate workflow from the one above |`);
	}
```

In `typeSection`, rewrite the opening paragraph to ask `childTypeChoices(null)` the
same per-type root question the table below it already asks, rather than assuming
every `EXTRA_TYPES` member answers alike:

```ts
function typeSection(settings: BacklogSettings): string[] {
	const rows = ALL_TYPES.map((t) => `| ${cell(t)} | ${list(parentsOf(t))} | ${list(childrenOf(t))} |`);
	const rootableExtras = EXTRA_TYPES.filter((t) => childTypeChoices(null).includes(t));
	const pinnedExtras = EXTRA_TYPES.filter((t) => !rootableExtras.includes(t));
	const extraProse =
		pinnedExtras.length > 0 && rootableExtras.length > 0
			? `${pinnedExtras.map(code).join(' and ')} sit *beside* it — they hang from any rung above the ` +
				`deepest and hold ${code(LEVELS[LEVELS.length - 1])} items wherever they hang, which is why ` +
				`they are types rather than levels. ${rootableExtras.map(code).join(' and ')} ${rootableExtras.length === 1 ? 'is' : 'are'} the same shape, but may also stand alone with no parent at all.`
			: `${EXTRA_TYPES.join(' and ')} sit *beside* it — they hang from any rung above the ` +
				`deepest and hold ${code(LEVELS[LEVELS.length - 1])} items wherever they hang, which ` +
				'is why they are types rather than levels.';
	return [
		`## ${TYPES_HEADING}`,
		'',
		`${LEVELS.join(' → ')} is a ladder: each level holds the next one down. ${extraProse} ` +
			`${MARKER_TYPES.join(' and ')} is neither: a ` +
			`marker hangs from nothing and holds nothing, and states a date rather than work.`,
		'',
		'| Type | Parent may be | Children may be |',
		'| --- | --- | --- |',
		...rows,
		'',
		'Write the type exactly as spelled above; matching is case-insensitive but the ' +
			'spelling is the vocabulary. A type this plugin does not ship is kept as written and ' +
			'shown as itself.' +
			(settings.autoType
				? ' With one exception, and it belongs to this view: assigning types on a move ' +
					`rewrites what you drag into a **new parent**, a name of your own included. ` +
					`Reordering among siblings rewrites nothing, ${EXTRA_TYPES.map(code).join(' and ')} ` +
					'keep their type wherever they land, and the same custom name deeper in the ' +
					'subtree you dragged is left alone.'
				: ' Nothing rewrites it into one of these.'),
	];
}
```

This reads generically off `EXTRA_TYPES`/`childTypeChoices(null)` rather than naming
`Deliverable` by string, so a future rootable extra type needs no further change here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/backlogReadme.test.ts`
Expected: PASS — including every existing test in this file (with `EXTRA_TYPES` today
holding `Issue`/`Bug`/`Deliverable` and only `Deliverable` rootable, `pinnedExtras =
['Issue', 'Bug']` and `rootableExtras = ['Deliverable']`, both non-empty, so the
existing generic-extra-types assertions — if any test the prose's exact old wording —
may need re-reading against the new sentence; if a pre-existing test asserts the OLD
uniform sentence verbatim, update its expected string to match the new one rather than
reverting the fix).

- [ ] **Step 5: Commit**

```bash
git add src/domain/backlogReadme.ts test/domain/backlogReadme.test.ts
git commit -m "feat: document the Deliverable property and its root capability in the generated README"
```

---

### Task 21: The shipped `README.md`

**Files:**
- Modify: `README.md`
- Test: none (hand-written prose; no automated check covers this file's content beyond
  markdown validity, which is not gated by `npm run check` — flag this honestly rather
  than inventing a test for prose)

**Interfaces:**
- Consumes: nothing programmatic — this is the plugin's own user manual, distinct from
  the per-vault generated README `backlogReadme.ts` writes (Task 20).
- Produces: updated prose in four places.

Found by review: every documentation fix in this plan so far lands in the GENERATED,
per-vault README. The root `README.md` — what a user reads on the plugin listing or in
the repository — is a separate, hand-written document this feature also has to touch,
or the plugin's actual manual stays silent about a feature with no other discovery
path.

- [ ] **Step 1: Update the type list**

Around `README.md:30-32` (the bullet naming the extra types), change:

```
- **`type`** — the ladder `Epic → Feature → PBI → Task`, the **extra types** `Issue` and
  `Bug` that sit beside it rather than on it, or `Milestone` — a marker on neither, which
  states a date rather than work.
```

to:

```
- **`type`** — the ladder `Epic → Feature → PBI → Task`, the **extra types** `Issue`,
  `Bug` and `Deliverable` that sit beside it rather than on it (`Deliverable` may also
  stand alone, with no parent at all), or `Milestone` — a marker on neither, which
  states a date rather than work.
```

- [ ] **Step 2: Update "Issues and bugs sit beside the ladder"**

Around `README.md:306-354`, add a short paragraph after the existing "None of this is
enforced" paragraph (before "### Where new items are filed"), naming `Deliverable`'s
one difference from `Issue`/`Bug` — root creation and its own board (cross-referencing
the board section this task also updates):

```
`Deliverable` is the same shape — pinned rank, `Task` children, never re-typed by a
move — with one addition: it may also be created with **no parent at all**, from the
toolbar's own "pick another type" menu. It gets its own folder and badge colour like
every declared type, and its own board — see [The Deliverables board](#the-deliverables-board)
below.
```

Update the sentence naming badge colours ("`Issue` and `Bug` each get their own badge
icon and colour...") to include Deliverable:

```
`Issue`, `Bug` and `Deliverable` each get their own badge icon and colour — an alert in
pink, a bug in red, a package in green — distinct from the four level colours.
```

- [ ] **Step 3: Add a short "The Deliverables board" section**

After the existing board section (from `README.md:499`, ending wherever its own
subsections end — locate the next `##` heading and insert immediately before it), add:

```markdown
### The Deliverables board

A fourth projection, alongside tree/board/roadmap, reserved for items typed
`Deliverable` — concepts, designs and anything else the team must produce rather than
plan. It has its **own workflow**: its own state property, its own ordered states, its
own done values, entirely independent of the board above. A Deliverable finished in one
workflow does not read as finished in the other.

Columns and a workflow only — no WIP limits, no column policies, no started/finished
date stamps, and "Show completed items" has no effect here: a Deliverable's
completion state on either workflow never hides its card, and only the quick filter
narrows what is shown. (The toolbar's **Focus** picker still applies here as it does
everywhere else — focused on a Feature or a PBI, this board shows only the
Deliverables nested under that focus.) Moving a card (drag, Alt+Left/Right, or the
card menu's Set state) writes only the Deliverable state property.

Everything else about a Deliverable — its parent, its rank, its tags, its place on the
roadmap — is the same property every other type already uses; nothing about this board
changes how those work.
```

- [ ] **Step 4: Update the view-options table**

Around `README.md:626-653`, after the existing "Folder for *&lt;type&gt;* items" row (or
in the natural reading position for a new group), add three rows:

```
| Deliverable state property | *(off)* | Note property with the Deliverable workflow's own state; enables the Deliverables board |
| Deliverable workflow states (in order) | *(off)* | The Deliverables board's columns, in that order. Left unset, it draws the states your Deliverables actually carry |
| Deliverable states that count as done | `Done, Closed, Completed, Removed` | Which Deliverable state values complete a Deliverable, for this workflow alone |
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document Deliverables in the shipped README"
```

---

## Self-Review

**1. Spec coverage** — checked against every numbered architecture section of
`docs/superpowers/specs/2026-08-06-deliverables-design.md` and both PBIs:

- §1 (type vocabulary, root creation, badge/colour, README prose) → Tasks 1, 2, 20.
- §2 (OptionalField, BacklogSettings fields, viewOptions group, fieldRows row) → Tasks
  3, 4, 20.
- §3 (model fields, raw-item phase, observed vocabulary) → Tasks 5, 6.
- §4 (Workflow parametrization, candidate set, population decoupled from
  `subtreeDone`) → Tasks 9, 16.
- §5 (ItemWrite fields, computeDeliverableStateWrites) → Task 7.
- §6 (content dispatcher, persistence, CardMoveController method, card completion,
  menu's four call sites, drag's move parameter, board-mode class, advisory,
  completed-toggle gate, both keyboard dispatcher gaps) → Tasks 8, 10, 11, 12, 13, 14,
  15, 16, 17, 18, 19.
- §7 (shipped README.md) → Task 21.
- The two Codex findings from the second review round (raw-item phase placement;
  `syncCountLabel` parity) → Tasks 6, 13, 17.
- PBI acceptance criteria: rank pinning and Task-only children (Task 1), root creation
  both via the row `+` and the toolbar (Task 1), badge coverage test (Task 2), never
  pruned by `hierarchyOnly` (already free — `pruneOutsideHierarchy` reads `ALL_TYPES`
  generically, confirmed while researching Task 1; no task needed), generated README
  table and prose consistency (Task 20).

No spec section is unaddressed.

**2. Placeholder scan** — every task's Implement step contains real, compilable
TypeScript against the actual current source (verified by reading each file in full
before drafting its task), not prose describing an edit. Task 9's existing-test
migration table is the one place this plan states a mechanical transform rather than
hand-editing all 16 call sites verbatim — the transform itself is fully specified with
two worked full examples and it is IDENTICAL for every remaining line, so this is a
completely specified rule rather than a hand-wave. Tasks 5/6 and 14/15 are explicitly
cross-referenced as landing together, since each pair does not compile independently —
called out rather than silently split.

**3. Type consistency** — traced across every task: `Workflow.stateOf`/`values`/
`observedValues`/`doneValues`/`wipLimits`/`columnPolicies` (Task 9) match their use in
`requirementsWorkflow`/`deliverablesWorkflow` and in `workflowColumns`.
`BoardRenderOptions.move`/`drawEmpty`/`doneOf` (Task 16) match their construction sites
in `renderRequirementsBoard`/`renderDeliverablesBoard` and their consumption in
`renderColumn`/`renderCard`/`createCard`. `ItemWrite.deliverableState`/
`removeDeliverableStateKey` (Task 7) match their handling in `applyInto`/`touchedKeys`
(Task 8). `BacklogViewHost.performDeliverablesBoardMove`/`isRowHiddenByFilterOnly`
(Task 11) match their implementations (Task 13) and every call site (Tasks 16, 17, 18,
19). `OptionalField`'s new `'deliverableState'` member (Task 3) matches its
`PROPERTY_TABLE` entry, its `optionalPropertyOption` use (Task 4), and its
`renderSetupCta` use (Task 14).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-deliverables.md`. Two
execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review
between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch
execution with checkpoints.

**Which approach?**
