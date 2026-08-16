# Iterations foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Iteration` note type, the two optional properties that go with it (the link an item carries, and the goal an iteration carries), the menu that sets the link, and the rule that joining an iteration writes that iteration's start and target onto the item.

**Architecture:** Three existing seams do nearly all of it. `Iteration` joins `MARKER_TYPES`, inheriting every structural rule `Milestone` already pays for — no rung, no children, no outgoing dependency edge — so no ladder code changes. `iteration` and `iterationGoal` become two rows in `PROPERTY_TABLE`, which buys the view options, the ✨ binding, the collision gate and the `ownedProperties` listing. The one genuinely new behaviour is that `Set iteration` plans **three** writes in one batch — the link plus the two dates — which is a new planner function and one extra row in the writer, the writer's undo capture, and the menu.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (floor 1.12.0), esbuild, vitest + jsdom, ESLint with per-directory `no-restricted-imports`.

## Scope

This plan implements, from `docs/superpowers/specs/2026-08-15-iterations-design.md`:

- §1 — `Iteration` joins the type vocabulary
- §2 — `iteration` and `iterationGoal` join the optional properties
- §9 — Joining an iteration schedules the item

and closes these register notes:

- `docs/requirements/An iteration is a note of its own.md` (PBI, order 10)
- `docs/requirements/An iteration's timeframe schedules its items.md` (PBI, order 15)

**Deliberately not here.** §3–§7 (the scope picker, the three buckets, the moves, the empty states, the goal line) and §10 (the create/edit dialog) are `A board scoped to one iteration` and `Creating an iteration from the board`, and get their own plan — they are a subsystem of their own, they depend on everything here, and the previous single plan covering two of these PBIs ran to 2,250 lines. §8 (`drawsAsPoint` / `iterationBars`) was already independent and stays so.

**This plan ships working software on its own.** After it, a vault can type notes as `Iteration`, file them, give them a goal, put work items in one from the row and card menus, and have those items take the iteration's dates. What it cannot do yet is *show* an iteration board. That is a coherent stopping point, not a half-feature: the link and the dates are read by the roadmap, which already draws from `start`/`target`.

## Global Constraints

Every task's requirements implicitly include this section.

- **Definition of done is `npm run check`** — build, lint, coverage-thresholded tests, fallow, docs register. All five, on every commit. Coverage thresholds in `vitest.config.mts` only ever go up.
- **Layers:** `main → commands → view → storage → domain`, each may reach anything below and nothing above. `ui/` is a leaf; `i18n/` is a leaf one level lower. Violations fail `npm run lint`.
- **400-line max per `src/` file**, `max-lines-per-function` 100, `complexity` 16, `max-depth` 4, `max-params` 5 — all with `skipBlankLines: true, skipComments: true`, so a 700-line file with heavy documentation is legal. `test/**` has a 450-line budget.
- **Never write frontmatter outside `src/storage/frontmatter.ts`.** `processFrontMatter`, `vault.create` and `load/saveLocalStorage` are banned by `no-restricted-syntax` everywhere outside `storage/`.
- **Every write path goes through the `configProblems` gate**, and forward batches are refused whole if any write targets an `outsideFilter` item.
- **Every module in `src/` must be specified** by a use case's `## Where it lives` or an ADR's `## Decision`, or `npm run docs` fails. This plan adds no new `src/` module, so nothing new needs specifying.
- **`docs-check.mjs` checks both directions, and they close on each other.** A path named in a current `docs/requirements/` note must **exist**, and a module in `src/` that no note names fails rule 7. So the exact path goes into a note's `## Where it lives` **in the same commit as the file it names** — never before it, and never after. The same holds for a test path. (This plan originally claimed only test paths were checked for existence; `npm run docs` says otherwise, and it was right.)
- **Every view-option key must be named in `docs/requirements/`** in a code span, or `test/docs/surfaces.test.ts` fails. The keys this plan adds — `iterationProperty`, `iterationGoalProperty`, and the generated `typeFolder.iteration` — are already named there.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **`CHANGELOG.md` gains an `[Unreleased]` entry in the pull request that earns it.**
- The stylesheet is one partial per concern under `styles/`; the root `styles.css` is generated. Edit the partial.

## File structure

| File | Change |
| --- | --- |
| `src/domain/typeVocabulary.ts` | `ITERATION_TYPE`, added to `MARKER_TYPES`; `iteration: 'iterations'` in `DEFAULT_TYPE_SUBFOLDERS` |
| `src/view/render/badges.ts` | `iteration` row in `NAMED_TYPE_STYLE` |
| `styles/badges.css` | `.pbl-lvl-iteration` hue, with its sharing decision recorded |
| `scripts/docs-check.mjs` | `Iteration` in `LEGAL_CHILDREN` and `ROOT_TYPES` |
| `docs/README.md` | hierarchy-table row and folder-table row |
| `docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md` | amendment for the twelfth name |
| `src/domain/optionalProperties.ts` | `iteration` + `iterationGoal` in `OptionalField`, `iterationKey` + `iterationGoalKey` in `OptionalSettingsKey`, two `PROPERTY_TABLE` rows |
| `src/domain/settings.ts` | the two fields, their defaults, their resolve |
| `src/domain/viewOptions.ts` | `iterationsGroup()`, holding both `optionalPropertyOption` calls |
| `src/domain/readItems.ts` | `iterationEntry`, `iterationGoalValue` |
| `src/domain/writePlan.ts` | `computeIterationWrites`; the `iteration` / `iterationGoal` fields on `ItemWrite`; the third `missingKeyStubs` early return |
| `src/storage/frontmatter.ts` | `applyIteration` beside the parent link's write; one row in `applyLabels` |
| `src/storage/writeKeys.ts` | two rows in `touchedKeys`' `carried` list |
| `src/view/interactions/labels.ts` | `addIterationItems` |

New test files: `test/domain/iterationDates.test.ts`. Extended: `test/domain/settings.test.ts`, `test/domain/writePlanProperties.test.ts`, `test/view/contextRowWrites.test.ts`, `test/domain/itemTypes.test.ts`.

---

### Task 1: `Iteration` joins the type vocabulary

**Files:**
- Modify: `src/domain/typeVocabulary.ts` — `MARKER_TYPES`, `DEFAULT_TYPE_SUBFOLDERS`
- Modify: `src/view/render/badges.ts` — `NAMED_TYPE_STYLE`
- Modify: `src/view/manual/typesSection.ts` — an `INTENT` entry for `Iteration`, or
  `test/view/manualTypes.test.ts`'s "gives every type entry a non-empty explanation" fails
  (`entryFor` reads `INTENT[typeName]` with no fallback, by design)
- Modify: `styles/badges.css`
- Modify: `scripts/docs-check.mjs` — `LEGAL_CHILDREN`, `ROOT_TYPES`
- Modify: `docs/README.md` — hierarchy table, folder table
- Modify: `docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md`
- Test: `test/domain/itemTypes.test.ts`
- Test (ripple effects of widening `MARKER_TYPES`/`ALL_TYPES`, not called out above but
  required for `npm run check` to pass): `test/domain/settings.test.ts` (`MARKER_TYPES`
  literal), `test/domain/backlogReadme.test.ts` (`'Milestone is neither'` substring),
  `test/helpers/register.ts` (the fixture's own hard-coded hierarchy table — every
  `checkerAccepts`/`checkerRejects`/`checkerRejectsAdrs` test runs the real
  `docs-check.mjs` against it), `test/docs/checkerRejects.test.ts` (two root-rejection
  messages naming the legal root types), `test/view/menu.test.ts`,
  `test/view/testCatalog.test.ts`, `test/view/toolbar.test.ts` (three hard-coded
  "every declared type" lists a top-level `Set type` / `New` menu offers)

**Interfaces:**
- Produces: `ITERATION_TYPE: string` (the literal `'Iteration'`) exported from `src/domain/typeVocabulary.ts`. `ALL_TYPES` gains `'Iteration'`; `MARKER_TYPES` gains it too, so `isMarkerType('Iteration')` is `true` for free; `typeFolderKey('Iteration')` answers `typeFolder.iteration`. **Not produced here:** `isIterationType` — it has no caller until Task 5 (the `Set iteration` menu), which is where it is written; see that task.

**Why a marker.** A marker occupies no rung, holds nothing and hangs from nothing, which is exactly what an iteration is — items *link* to it, they are never its children. Every structural rule then follows without being written: no rung in the ladder, no `+` offering to create a child under it, no **outgoing** dependency edge, ranked out of the ladder by `itemTypes.ts`. Do **not** add it to `EXTRA_TYPES`; that list means *pinned at `EXTRA_TYPE_RANK`, children are Tasks, hangs from an Epic, a Feature or a PBI*, and adding a marker would falsify the contract rather than extend it.

- [ ] **Step 1: Write the failing test**

In `test/domain/itemTypes.test.ts`:

```ts
import { ALL_TYPES, ITERATION_TYPE, MARKER_TYPES, typeFolderKey } from '../../src/domain/typeVocabulary';
import { childTypeChoices, isMarkerType } from '../../src/domain/itemTypes';

describe('Iteration is a declared marker', () => {
	it('is a marker type and a member of the whole vocabulary', () => {
		expect(ITERATION_TYPE).toBe('Iteration');
		expect(MARKER_TYPES).toContain('Iteration');
		expect(ALL_TYPES).toContain('Iteration');
	});

	it('inherits every marker rule rather than declaring one', () => {
		expect(isMarkerType('Iteration')).toBe(true);
		// A marker holds nothing, so nothing is offered beneath it. `childTypeChoices` takes
		// a `LadderPosition | null`, never a bare type name — the snippet this plan carried
		// passed the string `'Iteration'` directly, which does not satisfy that interface and
		// would not compile. Build the minimal shape instead.
		expect(
			childTypeChoices({ typeName: 'Iteration', levelIndex: -1, effectiveLevelIndex: 0, ladder: LEVELS }),
		).toEqual([]);
	});

	it('files into its own subfolder', () => {
		expect(typeFolderKey('Iteration')).toBe('typeFolder.iteration');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL — `ITERATION_TYPE` is not exported.

- [ ] **Step 3: Add the name and its three shipped opinions**

In `src/domain/typeVocabulary.ts`, beside `DELIVERABLE_TYPE`:

```ts
/**
 * The second declared marker. Named once, like `DELIVERABLE_TYPE`, so `MARKER_TYPES`
 * and every `isIterationType` call site read the identical string rather than two
 * spellings that can drift.
 */
export const ITERATION_TYPE = 'Iteration';
export const MARKER_TYPES = ['Milestone', ITERATION_TYPE];
```

and in `DEFAULT_TYPE_SUBFOLDERS`, beside `milestone`:

```ts
	iteration: 'iterations',
```

- [ ] **Step 4: Give it a badge and an icon**

In `src/view/render/badges.ts`, in `NAMED_TYPE_STYLE`:

```ts
	iteration: { icon: 'calendar-clock', badge: 'pbl-lvl-iteration' },
```

In `styles/badges.css`, beside the milestone rule. **The paragraph below is wrong and was
never built as written**: purple is not unclaimed — it is `.pbl-lvl-1`, Feature's, already
— so every one of Obsidian's eight tokens is spoken for before this badge exists. There is
no unused hue left to reach for; the twelfth badge has to share one, same as three pairs
already do. It takes CYAN, joining Milestone (see the actual comment landed in
`styles/badges.css` for the corrected reasoning — this block is left here only as the
record of what was wrong):

```css
/* WRONG — do not build this. Purple already belongs to `.pbl-lvl-1` (Feature). */
.pbl-lvl-iteration { --pbl-badge-rgb: var(--color-purple-rgb); }
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: PASS.

- [ ] **Step 6: Teach the register gate the same name**

In `scripts/docs-check.mjs`, in `LEGAL_CHILDREN`, beside `Milestone`:

```js
	Iteration: new Set(),
```

and in `ROOT_TYPES`:

```js
const ROOT_TYPES = new Set(["Epic", "Milestone", "Test suite", "Iteration"]);
```

In `docs/README.md`, add a hierarchy-table row — `Iteration` | `—` | `—` — matching `LEGAL_CHILDREN` exactly, and a folder-table row for `iterations/`. The gate checks the table against the map in **both** directions, so a mismatch in either fails.

- [ ] **Step 7: Amend ADR 0013**

Add a dated amendment for the twelfth declared name, in the shape the Milestone addition on 2026-08-02 already used. Do not change the ADR's `status` — it is still `Accepted`; an amendment records a name joining the fixed vocabulary, not a decision being superseded.

- [ ] **Step 8: Run the whole gate**

Run: `npm run check`
Expected: all five steps pass. `test/docs/surfaces.test.ts` is the one to watch — it checks the generated `typeFolder.iteration` key is named in `docs/requirements/`, and it already is.

**A first pass at this task added `isIterationType` here (a former Step 5), on the
brief's instruction to place it "beside `isMarkerType`".** It has no caller until Task 5
(the `Set iteration` menu) — a predicate written before its first call site fails BOTH
`npm run test:coverage`'s function-coverage floor and `npm run analyze` (fallow)'s
dead-code check independently, for the same reason: a test-only export is exactly what
fallow's "no known consumers" exists to catch, so adding a unit test to satisfy coverage
would leave fallow correctly failing anyway. **Decision:** `isIterationType` moved to
Task 5, its first real consumer. Task 1 now produces only the name, its membership and
its folder key, and `npm run check` passes clean on that alone.

- [ ] **Step 9: Commit**

```bash
git add src/domain/typeVocabulary.ts src/view/render/badges.ts src/view/manual/typesSection.ts \
  styles/badges.css scripts/docs-check.mjs docs/README.md docs/adrs \
  test/domain/itemTypes.test.ts test/domain/settings.test.ts test/domain/backlogReadme.test.ts \
  test/helpers/register.ts test/docs/checkerRejects.test.ts \
  test/view/menu.test.ts test/view/testCatalog.test.ts test/view/toolbar.test.ts \
  docs/superpowers/plans/2026-08-16-iterations-foundation.md
git commit -m "Declare Iteration, the twelfth name and the second marker"
```

---

### Task 2: The `iteration` property

**Files:**
- Modify: `src/domain/optionalProperties.ts` — `OptionalField`, `OptionalSettingsKey`, `PROPERTY_TABLE`
- Modify: `src/domain/settings.ts` — `iterationKey` field, default, resolve
- Modify: `src/domain/viewOptions.ts` — `iterationsGroup()`
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: `ITERATION_TYPE` from Task 1.
- Produces: `optionalKeyFor(settings, 'iteration')` returns the configured key or `''`. `BacklogSettings.iterationKey: string`. The view option key is `iterationProperty`.

**One row buys five things** — the view option, the ✨ setup binding, the key-collision gate, the `ownedProperties` listing and the backfill stub. Add the field to **both** unions and the table; the table is `Record<OptionalField, …>`, so the compiler refuses a field added to the union and forgotten in the table.

- [ ] **Step 1: Write the failing test**

In `test/domain/settings.test.ts`:

```ts
it('resolves the iteration property into its own key', () => {
	const settings = resolveSettings(fakeConfig({ iterationProperty: 'sprint' }));
	expect(settings.iterationKey).toBe('sprint');
	expect(optionalKeyFor(settings, 'iteration')).toBe('sprint');
});

it('leaves the iteration key empty when nothing names it', () => {
	const settings = resolveSettings(fakeConfig({}));
	expect(settings.iterationKey).toBe('');
	expect(optionalKeyFor(settings, 'iteration')).toBe('');
});

it('refuses an iteration key that collides with a key this view owns', () => {
	const problems = configProblems(resolveSettings(fakeConfig({ iterationProperty: 'status', stateProperty: 'status' })));
	expect(problems.join(' ')).toContain('iteration');
});
```

Use the existing helpers in this file for `fakeConfig` / `resolveSettings` — follow how `assigneeProperty` is tested a few cases above; do not invent a second fixture shape.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: FAIL — `iterationKey` does not exist on `BacklogSettings`.

- [ ] **Step 3: Add the field to both unions and the table**

In `src/domain/optionalProperties.ts`, add `| 'iteration'` to `OptionalField` and `| 'iterationKey'` to `OptionalSettingsKey`, then the row:

```ts
	// The link an item carries to say which time box it is in. Suggested by the name the
	// concept has, and — like every other row here — offered as a placeholder rather than
	// matched: nothing reads a property because of what it is called.
	iteration: { option: 'iterationProperty', suggested: 'iteration', label: 'iteration', settingsKey: 'iterationKey' },
```

- [ ] **Step 4: Add the settings field**

In `src/domain/settings.ts`, add `iterationKey: string;` to `BacklogSettings` with a doc comment, `iterationKey: ''` to the defaults, and the resolve line beside the other optional keys. Follow `assigneeKey` exactly — it is the most recent row and the shape is settled.

- [ ] **Step 5: Add the options group**

In `src/domain/viewOptions.ts`, a new group, and call it from `getViewOptions()` after `deliverablesGroup()`:

```ts
/**
 * The iterations group. It holds no workflow options and that is the decision, not an
 * omission: the iteration board reads the PRODUCT state key and narrows it, so there is
 * no second property to configure here. See the 2026-08-16 revision of the design.
 */
function iterationsGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Iterations',
		items: [optionalPropertyOption('iteration', 'Iteration property')],
	};
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run test/domain/settings.test.ts test/domain/viewOptions.test.ts`
Expected: PASS. `viewOptions.test.ts` may assert a group count or a key list — update it to include the new group rather than working around it.

- [ ] **Step 7: Commit**

```bash
git add src/domain test/domain
git commit -m "Name the property that puts an item in an iteration"
```

---

### Task 3: Read the iteration link

**Files:**
- Modify: `src/domain/readItems.ts`
- Test: `test/domain/model.test.ts`

**Interfaces:**
- Consumes: `optionalKeyFor(settings, 'iteration')` from Task 2.
- Produces: `BacklogItem.iterationEntry: LinkEntry | null` — the `raw`/`file` pair `readLinkList` already returns, or `null` when no key is configured or the note carries nothing.

**Unresolved is not unset.** Keep both halves of the reading. `raw` is what the note spells and `file` is what it resolved to; a link naming a deleted note has a `raw` and no `file`. Collapsing that to "no value" would tick `None` as the current choice on a note whose frontmatter visibly holds a link, and leave the reader no way to clear the value they can see — the horizon menu's own defect, reached by a different road.

- [ ] **Step 1: Write the failing test**

In `test/domain/model.test.ts`:

```ts
it('reads the iteration link, keeping what the note spells and what it resolved to', () => {
	const model = buildModelWith({ iterationProperty: 'iteration' }, [
		note('PBI-1.md', { iteration: '[[Sprint 12]]' }),
		note('Sprint 12.md', { type: 'Iteration' }),
	]);
	const pbi = model.byPath.get('PBI-1.md')!;
	expect(pbi.iterationEntry?.file?.path).toBe('Sprint 12.md');
	expect(pbi.iterationEntry?.raw).toBe('Sprint 12');
});

it('keeps a broken iteration link rather than dropping it', () => {
	const model = buildModelWith({ iterationProperty: 'iteration' }, [note('PBI-1.md', { iteration: '[[Gone]]' })]);
	const pbi = model.byPath.get('PBI-1.md')!;
	expect(pbi.iterationEntry?.raw).toBe('Gone');
	expect(pbi.iterationEntry?.file).toBeNull();
});

it('reads nothing when no iteration property is configured', () => {
	const model = buildModelWith({}, [note('PBI-1.md', { iteration: '[[Sprint 12]]' })]);
	expect(model.byPath.get('PBI-1.md')!.iterationEntry).toBeNull();
});
```

Use this file's existing model-building helper rather than a new one; `buildModelWith` above stands for whatever it is actually called here.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/model.test.ts`
Expected: FAIL — `iterationEntry` is undefined.

- [ ] **Step 3: Read it**

In `src/domain/readItems.ts`, add the field to the item interface with a doc comment, and read it beside `dependsOnEntries`:

```ts
	iterationEntry: settings.iterationKey ? (readLinkList(app, file, cache, settings.iterationKey)[0] ?? null) : null,
```

`readLinkList` handles wikilinks, aliases, bare names and lists — the same handling `parent` and `dependsOn` already use. Taking `[0]` is deliberate: an item is in **one** iteration, and a list-valued key is a note the user hand-edited, whose first entry is the honest reading rather than an error.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/domain/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/readItems.ts test/domain/model.test.ts
git commit -m "Read an item's iteration, keeping unresolved apart from unset"
```

---

### Task 4: Plan and apply the link write

**Files:**
- Modify: `src/domain/writePlan.ts` — `ItemWrite.iteration`, `computeIterationWrites`
- Modify: `src/storage/frontmatter.ts` — `applyIteration`
- Modify: `src/storage/writeKeys.ts` — one row in `touchedKeys`' `carried` list
- Test: `test/domain/writePlanProperties.test.ts`, `test/domain/iterationDates.test.ts`

**Interfaces:**
- Consumes: `BacklogItem.iterationEntry` from Task 3.
- Produces:
  ```ts
  // on ItemWrite
  iteration?: TFile | null;   // a FILE, never a serialized string; null removes the key
  // in writePlan.ts
  export function computeIterationWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[]
  ```
  Task 7 extends this same function with the dates. Task 5 calls it.

**`target` is the iteration's ITEM, and the write carries its `.file`.** Those are two
different types on purpose, and taking the file as the argument — which an earlier
revision of this plan did — makes Task 7 impossible to build. The dates a join writes are
the iteration's own `start` and `target` **readings**, which live on its `BacklogItem`
because that is where `readItems.ts` parses them; a `TFile` is a path and a name and
nothing else. `writePlan.ts` is pure domain: it cannot reach the model to look the item
up, and it must not reach the metadata cache to re-parse the note. So the caller — which
holds the model already, because the menu built its entries from it — passes the item, and
the planner takes `.file` for the link. Getting this wrong does not fail in Task 4; it
fails in Task 7, as a missing argument with no legal way to supply it.

**The plan carries the FILE, never a string**, and this is the other design point. The writer spells the link with Obsidian's own path-aware generation, from the editing note's path to the target's — which is what `wikilinkTo` does for the parent link. A link serialized from a basename would resolve to whichever of two same-named notes Obsidian picks, and the menu would look right while the write went elsewhere. That is also why this write sits beside the parent link's in `applyInto` and **not** in `applyLabels`: that list is for plain strings and carries neither the app nor a source path.

- [ ] **Step 1: Write the failing test**

Create `test/domain/iterationDates.test.ts`:

```ts
describe('computeIterationWrites — the link', () => {
	it('plans the link when the item is not already in that iteration', () => {
		const settings = settingsWith({ iterationKey: 'iteration' });
		const writes = computeIterationWrites(itemIn(null), sprint12Item, settings);
		expect(writes).toEqual([{ file: pbiFile, iteration: sprint12Item.file }]);
	});

	it('plans nothing when the item is already in that iteration', () => {
		const settings = settingsWith({ iterationKey: 'iteration' });
		expect(computeIterationWrites(itemIn(sprint12Item), sprint12Item, settings)).toEqual([]);
	});

	it('plans a removal for None', () => {
		const settings = settingsWith({ iterationKey: 'iteration' });
		expect(computeIterationWrites(itemIn(sprint12Item), null, settings)).toEqual([{ file: pbiFile, iteration: null }]);
	});

	it('plans nothing at all when no iteration key is configured', () => {
		expect(computeIterationWrites(itemIn(null), sprint12Item, settingsWith({ iterationKey: '' }))).toEqual([]);
	});

	it('clears a link that resolved to nothing', () => {
		// Unresolved is not unset: an item holding a broken link must still be clearable.
		const item = itemWithRawIteration('Gone');
		const writes = computeIterationWrites(item, null, settingsWith({ iterationKey: 'iteration' }));
		expect(writes).toEqual([{ file: pbiFile, iteration: null }]);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/iterationDates.test.ts`
Expected: FAIL — `computeIterationWrites` is not exported.

- [ ] **Step 3: Plan it**

In `src/domain/writePlan.ts`:

```ts
/**
 * Everything ONE iteration change writes. The link alone for now; Task 7 of this plan
 * adds the two dates the iteration's own timeframe supplies, in this same batch.
 *
 * `target` is a FILE, never a serialized string: the writer spells the link from the
 * editing note's own path, so two Iteration notes sharing a basename still get distinct
 * links. An unconfigured key plans nothing — absence is a value.
 *
 * Emptiness is what the MENU's checkmark is asked of, so this must return `[]` for a
 * pick that changes nothing rather than a write the applier happens to no-op.
 */
export function computeIterationWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[] {
	if (!settings.iterationKey) return [];
	const current = item.iterationEntry;
	// Compared by PATH, not by the raw text: two spellings of one note are one iteration.
	// A link that resolved to nothing has no path and is therefore never "already there",
	// which is what makes a broken value clearable.
	const same = target === null ? current === null : current?.file?.path === target.file.path;
	if (same) return [];
	return [{ file: item.file, iteration: target.file }];
}
```

Add `iteration?: TFile | null;` to `ItemWrite` with a comment saying `null` removes the key and `undefined` leaves it alone.

- [ ] **Step 4: Apply it**

In `src/storage/frontmatter.ts`, in `applyInto` beside `applyHierarchy`'s parent write:

```ts
/** The iteration link — path-aware like the parent's, and for the parent's reason. */
function applyIteration(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	if (write.iteration === undefined || !settings.iterationKey) return;
	if (write.iteration === null) delete fm[settings.iterationKey];
	else setOwn(fm, settings.iterationKey, wikilinkTo(app, write.iteration, write.file.path));
}
```

- [ ] **Step 5: Capture it for undo**

In `src/storage/writeKeys.ts`, add a row to `touchedKeys`' `carried` list:

```ts
		[write.iteration !== undefined, settings.iterationKey],
```

**This is not optional and it is not bookkeeping.** `applySafely` builds each write's inverse from this list, so a key written and not listed is a change **no undo can reach**. The condition must be the same one `applyIteration` writes on, or applying and capturing drift — which is what the list's own comment says and what the assignee row already demonstrates.

- [ ] **Step 6: Write the undo test, and watch it fail before Step 5's line exists**

In `test/domain/writePlanProperties.test.ts` (or the storage suite that already drives `applyWrites`):

```ts
it('takes an iteration back with the one undo slot', async () => {
	await applyWrites(app, settings, [{ file: pbiFile, iteration: sprint12File }]);
	expect(frontmatterOf(pbiFile).iteration).toBe('[[Sprint 12]]');
	await undoLast();
	expect(frontmatterOf(pbiFile).iteration).toBeUndefined();
});
```

Watch it fail with the `carried` row removed, then restore the row and watch it pass. **Do this literally** — comment the row out, run, see red, restore, run, see green. The whole point of the row is invisible otherwise.

- [ ] **Step 7: Run the suites**

Run: `npx vitest run test/domain test/storage`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/writePlan.ts src/storage/frontmatter.ts src/storage/writeKeys.ts test/
git commit -m "Plan, write and capture an item's iteration"
```

---

### Task 5: `Set iteration` on the row and card menus

**Files:**
- Modify: `src/domain/itemTypes.ts` — `isIterationType`
- Modify: `src/view/interactions/labels.ts`
- Test: `test/view/contextRowWrites.test.ts`

**Interfaces:**
- Consumes: `computeIterationWrites` (Task 4).
- Produces: `isIterationType(typeName: string): boolean` from `src/domain/itemTypes.ts`, and
  `addIterationItems(menu, host, item)` — called from the row and card menu builders,
  beside the assignee's.

**Why the predicate is written here and not in Task 1**, which declared the name: a
function with no caller fails both the coverage floor and fallow's dead-code check, and
this submenu — refusing the row on an `Iteration` itself — is `isIterationType`'s first
real consumer, so it is written where it is first called.

**Five refusals, and each is a different rule.** The submenu is absent on a **context row** (never a write target), on a **catalog member** (a `Test suite`, a `Test case`, or a `Task` beneath one — the population it would join is the plan's, so the link would be stored where no card can draw), on an **`Iteration`** itself (an iteration is a scope, never something put inside one), and when there is **neither a link nor a target** (genuinely nothing to do). It is **present with `None` alone** when the item holds a link and the model has no Iteration notes left — no targets is not the same as nothing to do, and hiding it there would leave a value on screen the reader cannot remove.

- [ ] **Step 1: Write the failing tests**

In `test/view/contextRowWrites.test.ts`:

```ts
describe('Set iteration', () => {
	it('offers every Iteration in the model plus None, whatever the focus level', () => { /* … */ });
	it('is absent on a context row', () => { /* … */ });
	it('is absent on a catalog member', () => { /* … */ });
	it('is absent on an Iteration row', () => { /* … */ });
	it('renders with None alone when the item holds a link and no Iteration is left', () => { /* … */ });
	it('is absent with no link and no targets', () => { /* … */ });
	it('checks an entry exactly when the LINK component of the plan is empty', () => { /* … */ });
	it('names two same-basename iterations apart, and writes the one that was picked', () => { /* … */ });
});
```

Fill each body using this file's existing menu-driving helpers — it already drives `Set assignee` and `Set state` the same way. Do not add a second way to open a menu.

- [ ] **Step 2: Run and watch every one fail**

Run: `npx vitest run test/view/contextRowWrites.test.ts`
Expected: FAIL — no `Set iteration` entry exists.

- [ ] **Step 3: Add the predicate**

In `src/domain/itemTypes.ts`, beside `isMarkerType`:

```ts
/**
 * One marker by name. Asked only where a rule is about ITERATIONS specifically — the
 * board's population refusing one as a card, the menu declining to offer `Set iteration`
 * on one. Every STRUCTURAL question is `isMarkerType`, which both markers answer alike.
 */
export function isIterationType(typeName: string): boolean {
	return typeName.toLowerCase() === ITERATION_TYPE.toLowerCase();
}
```

Import `ITERATION_TYPE` from `./typeVocabulary` beside the module's other imports from it.

- [ ] **Step 4: Build the submenu**

In `src/view/interactions/labels.ts`, beside the assignee's builder. Read the targets from **`host.model.byPath`**, not the results — a focus set elsewhere must not make a top-level iteration unofferable — filtering to `isIterationType` and excluding `outsideFilter` rows.

The checkmark asks `computeIterationWrites(item, target, settings).length === 0`. **Once Task 7 lands, that stops being the whole plan** — see Task 7, Step 6, which narrows this call to the link component. Write it against the plan now so there is one thing to narrow later, never a value comparison beside it.

- [ ] **Step 5: Name colliding basenames apart**

Two Iteration notes sharing a basename are qualified with enough of each path to separate them, **and only where they collide** — qualifying every entry to fix a rare case makes the ordinary one unreadable. The value behind each entry is the note, never its label.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run test/view/contextRowWrites.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/itemTypes.ts src/view/interactions/labels.ts test/view/contextRowWrites.test.ts
git commit -m "Put an item in an iteration from the row and the card"
```

---

### Task 6: The iteration goal

**Files:**
- Modify: `src/domain/optionalProperties.ts`, `src/domain/settings.ts`, `src/domain/viewOptions.ts`
- Modify: `src/domain/readItems.ts` — `iterationGoalValue`
- Modify: `src/domain/writePlan.ts` — `ItemWrite.iterationGoal`, the third `missingKeyStubs` early return
- Modify: `src/storage/frontmatter.ts` — one row in `applyLabels`
- Modify: `src/storage/writeKeys.ts` — one row in `carried`
- Test: `test/domain/settings.test.ts`, `test/domain/writePlanProperties.test.ts`

**Interfaces:**
- Produces: `BacklogSettings.iterationGoalKey: string`; `BacklogItem.iterationGoalValue: string | null`; `ItemWrite.iterationGoal?: string | null`. The board's goal line (next plan) reads `iterationGoalValue`; the create/edit dialog writes `iterationGoal`.

**A plain string, so it is a row in `applyLabels`' list** — the fifth LABEL property, which is exactly what `src/CLAUDE.md` says a fifth label costs, the assignee having already turned that loop from a restatement into a list. Do not give it its own function.

**The backfill must skip it**, and that is the one thing the `PROPERTY_TABLE` row does not buy.

- [ ] **Step 1: Write the failing test**

```ts
it('never stubs the iteration goal onto any note', () => {
	const settings = settingsWith({ iterationGoalKey: 'goal', stateKey: 'status' });
	const writes = computeInitWrites(modelOfEveryType(), settings);
	for (const write of writes) expect(stubKeys(settings, write.stubs)).not.toContain('goal');
});

it('writes and clears a goal through the label list', () => {
	expect(applyTo({ type: 'Iteration' }, { iterationGoal: 'Ship the board' }, settings).goal).toBe('Ship the board');
	expect(applyTo({ goal: 'x' }, { iterationGoal: null }, settings).goal).toBeUndefined();
});
```

- [ ] **Step 2: Run and watch both fail**

Run: `npx vitest run test/domain/writePlanProperties.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the row, the field and the option**

`OptionalField` gains `| 'iterationGoal'`, `OptionalSettingsKey` gains `| 'iterationGoalKey'`, and the table:

```ts
	// What an iteration is FOR, in one line, drawn above the board's columns. A plain
	// string on the Iteration note — never a link, so unlike `iteration` it is a row in
	// the label list rather than a write of its own.
	iterationGoal: { option: 'iterationGoalProperty', suggested: 'goal', label: 'iteration goal', settingsKey: 'iterationGoalKey' },
```

Add `iterationGoalKey` to `BacklogSettings`, its default and its resolve, and a second `optionalPropertyOption('iterationGoal', 'Iteration goal property')` to `iterationsGroup()`.

- [ ] **Step 4: Read it and write it**

In `readItems.ts`, beside `assigneeValue`:

```ts
	iterationGoalValue: settings.iterationGoalKey ? readString(ownValue(fm, settings.iterationGoalKey)) : null,
```

In `frontmatter.ts`, one row in `applyLabels`' `labels` array:

```ts
		[write.iterationGoal, settings.iterationGoalKey],
```

In `writeKeys.ts`, one row in `carried`:

```ts
		[write.iterationGoal !== undefined, settings.iterationGoalKey],
```

- [ ] **Step 5: Exclude it from the backfill**

In `missingKeyStubs` in `src/domain/writePlan.ts`, a **third** early return — beside `horizon`'s and `dependsOn`'s, not folded into either:

```ts
	// A goal belongs to one type. `✨` stubs an empty key on every note that lacks one,
	// which is honest for a state or a date — an empty slot the reader is invited to
	// fill — and dishonest here: a `goal` on every PBI, Feature and Task in the vault is
	// a property that means nothing on the note it lands on. Its own return rather than a
	// widening of `dependsOn`'s: that one's reason is that an empty prerequisite list is a
	// false claim about a relationship. Two rules that agree today are still two rules.
	if (field === 'iterationGoal') continue;
```

- [ ] **Step 6: Run and watch both pass, then watch the exclusion fail without its line**

Run: `npx vitest run test/domain/writePlanProperties.test.ts`
Expected: PASS. Then delete the `continue` above, re-run, see the stub test go red, restore it.

- [ ] **Step 7: Commit**

```bash
git add src/domain src/storage test/domain
git commit -m "Give an iteration a goal, and keep it out of the backfill"
```

---

### Task 7: Joining an iteration writes its timeframe

**Files:**
- Modify: `src/domain/writePlan.ts` — extend `computeIterationWrites`
- Modify: `src/view/interactions/labels.ts` — narrow the checkmark
- Test: `test/domain/iterationDates.test.ts`

**Interfaces:**
- Consumes: `computeIterationWrites` (Task 4), `axisEntries` (`src/storage/writeKeys.ts`, already captured for undo).
- Produces: the same signature, now returning one `ItemWrite` carrying `iteration` **and** an `axis` with `start` / `target`.

**The batch is one write on one file**, not three. `ItemWrite` already carries an `AxisWrite`, and `axisEntries` already keeps the two rules this needs — an unconfigured key is dropped, a `null` deletes — **and is already captured for undo**, so the dates need no `writeKeys.ts` row of their own.

**Four rules, each of which a test must pin separately:**

1. The dates **overwrite** whatever the item held. No merge, no fill-only-what-is-empty, no branch on the item's own values.
2. An end the **iteration** does not carry writes nothing and deletes nothing. `undefined`, never `null`.
3. An end already equal to the iteration's is **absent from the plan**, compared as a civil date the way the axis writes already compare.
4. **No state key is ever named.** This is the category invariant, and it is asserted of the planner rather than by driving the menu, because the menu is one caller of it.

- [ ] **Step 1: Write the failing tests**

Extend `test/domain/iterationDates.test.ts`:

```ts
describe('computeIterationWrites — the timeframe', () => {
	const settings = settingsWith({ iterationKey: 'iteration', startKey: 'start', targetKey: 'due' });

	it('writes the iteration\'s dates over whatever the item held', () => {
		const [write] = computeIterationWrites(itemDated('2026-05-01', '2026-05-30'), sprint12Item, settings);
		expect(write.axis).toEqual({ start: '2026-09-07', target: '2026-09-20' });
	});

	it('leaves an end the iteration does not carry alone, rather than deleting it', () => {
		const [write] = computeIterationWrites(itemDated('2026-05-01', null), sprintStartOnlyItem, settings);
		expect(write.axis?.target).toBeUndefined();
	});

	it('omits a date the item already matches', () => {
		const [write] = computeIterationWrites(itemDated('2026-09-07', '2026-01-01'), sprint12Item, settings);
		expect(write.axis).toEqual({ target: '2026-09-20' });
	});

	it('writes no date under an unconfigured key', () => {
		const bare = settingsWith({ iterationKey: 'iteration', startKey: '', targetKey: '' });
		expect(computeIterationWrites(itemDated(null, null), sprint12Item, bare)[0].axis).toBeUndefined();
	});

	it('re-syncs the dates when the picked iteration is the one it is already in', () => {
		const [write] = computeIterationWrites(itemIn(sprint12Item, '2026-01-01', '2026-01-14'), sprint12Item, settings);
		expect(write.iteration).toBeUndefined();
		expect(write.axis).toEqual({ start: '2026-09-07', target: '2026-09-20' });
	});

	it('plans the link removal alone for None, leaving the dates', () => {
		const writes = computeIterationWrites(itemIn(sprint12Item, '2026-09-07', '2026-09-20'), null, settings);
		expect(writes).toEqual([{ file: pbiFile, iteration: null }]);
	});

	// The category invariant, asked of the planner because every input routes through it.
	it('never names a state key, on any path', () => {
		for (const target of [sprint12Item, sprint13Item, null]) {
			for (const item of [itemIn(null), itemIn(sprint12Item), itemInState('Doing')]) {
				for (const write of computeIterationWrites(item, target, settings)) {
					expect(write.state).toBeUndefined();
					expect(write.removeStateKey).toBeUndefined();
				}
			}
		}
	});
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/domain/iterationDates.test.ts`
Expected: FAIL — `write.axis` is undefined on every case.

- [ ] **Step 3: Extend the planner**

Replace the early `if (same) return []` with a plan that keeps the two questions apart — the link changes, and the dates follow the target:

```ts
export function computeIterationWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[] {
	if (!settings.iterationKey) return [];
	const linkChanges = !sameIteration(item, target);
	// `None` is a removal and nothing else. Leaving a sprint is not a reschedule: the item
	// keeps whatever plan it had, and deleting two date keys on the way out is a decision
	// nobody made.
	if (target === null) return linkChanges ? [{ file: item.file, iteration: null }] : [];
	const axis = timeframeOf(item, target, settings);
	if (!linkChanges && axis === undefined) return [];
	return [{ file: item.file, ...(linkChanges ? { iteration: target.file } : {}), ...(axis ? { axis } : {}) }];
}
```

`timeframeOf` reads the iteration ITEM's own `start` and `target` readings from the model, emits a key only when the iteration HAS that end and the item's differs, and returns `undefined` when neither end survives. Never `null` for a missing end — that would delete.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run test/domain/iterationDates.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the invariant test earn its name**

Add `state: 'Backlog'` to the returned write, run the suite, watch **only** the invariant test go red, remove it. A test that would have passed with a state in the plan is not the check this rule needs.

- [ ] **Step 6: Narrow the menu's checkmark**

In `src/view/interactions/labels.ts`, the checkmark now asks the plan's **link** component alone:

```ts
	// Asked of the plan, and of the LINK component of it — narrowed deliberately when the
	// plan grew to three writes. The register's usual rule (checked exactly when picking
	// writes nothing) would leave the CURRENT iteration unchecked whenever the item's
	// dates had drifted from it, so no entry would show as current. The menu's question is
	// "which iteration is this item in"; that was only ever the same question as "would
	// this be a no-op" while the plan held one write. Still asked of the plan, so nothing
	// compares values beside it — which is the drift the original rule exists to prevent.
	const checked = !computeIterationWrites(item, target, settings).some((w) => w.iteration !== undefined);
```

- [ ] **Step 7: Test the narrowing, in both directions**

```ts
it('keeps the current iteration checked when the item\'s dates have drifted from it', () => { /* … */ });
it('re-applies the timeframe when the checked iteration is picked', () => { /* … */ });
```

Run: `npx vitest run test/view/contextRowWrites.test.ts test/domain/iterationDates.test.ts`
Expected: PASS.

- [ ] **Step 8: Run everything**

Run: `npm run check`
Expected: all five pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain/writePlan.ts src/view/interactions/labels.ts test/
git commit -m "Schedule an item into the iteration it joins"
```

---

### Task 8: Close the register

**Files:**
- Modify: `docs/requirements/An iteration is a note of its own.md` — `status`, `finished`
- Modify: `docs/requirements/An iteration's timeframe schedules its items.md` — `status`, `finished`
- Modify: `docs/requirements/An Iterations board.md` — nothing yet; the Feature stays `Open` until the board lands
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Set both PBIs to `Done` with today's `finished` date**

Do **not** close the parent Feature. Three of its five use cases are still unbuilt, and closing a Feature whose children are open is a defect this register has recorded before.

- [ ] **Step 2: Add the `[Unreleased]` entry**

One `### Added` bullet naming what a user can now do — an `Iteration` note type, an iteration property and a goal property, `Set iteration` on rows and cards, and items taking their iteration's dates. Describe the capability, not the modules.

- [ ] **Step 3: Run the gate**

Run: `npm run check`
Expected: all five pass, including `test/release/changelogVersion.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add docs/requirements CHANGELOG.md
git commit -m "Close the two iteration foundation use cases"
```

---

## Live-vault check still owed

`npm run check` cannot answer these, and the jsdom harness cannot either. Run `npm run test-build` and open this repository as a vault:

- The `Iteration` badge colour and the `calendar-clock` icon against a real theme. Landed as CYAN, shared with `Milestone` (purple was the plan's original pick and was wrong — see Task 1, Step 8 — every theme token was already claimed, so the twelfth badge inevitably shares one). Nothing but the icon and the type name tells a Milestone badge from an Iteration one today; whether that reads as "these two are markers" or as one collision too many is exactly the live-vault question this line exists to ask.
- `Set iteration`'s submenu length in a vault with many iterations, and whether the collision-qualified labels stay readable.
- That a real `[[Sprint 12]]` written by the plugin resolves in Obsidian's own link handling from a note in a different folder.

## Self-review

**Spec coverage.** §1 → Task 1. §2 → Tasks 2, 3, 4, 6 (both properties, both read and write paths, the backfill exclusion). §9 → Tasks 4, 5, 7 (the three writes, the refusals, the checkmark narrowing). §3–§7 and §10 are declared out of scope above and go in the board plan; §8 was already independent.

**Placeholders.** Task 5's test bodies are named but not written out, and that is deliberate rather than a gap: this file already drives `Set assignee` and `Set state` through helpers whose exact signatures should be read from the file rather than guessed at here — writing a second fixture shape into the plan is how a suite grows two ways to open a menu. Every other step carries its code.

**Type consistency.** `computeIterationWrites(item, target, settings)` has one signature across Tasks 4, 5 and 7. `ItemWrite.iteration` is `TFile | null | undefined` throughout; `ItemWrite.iterationGoal` is `string | null | undefined`. `iterationEntry` is the reading everywhere, never `iterationPath`. `iterationKey` and `iterationGoalKey` are the two settings fields, matching their `PROPERTY_TABLE` rows.
