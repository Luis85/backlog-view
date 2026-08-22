# Release Management — first increment implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `product-release`, a third registered Bases view that lists every release and draws one release's scope as a tree, and that writes nothing to any note.

**Architecture:** `Release` joins the fixed type vocabulary as a third marker, so the model grows a `releases` collection the way it already grows `iterations`. One pure domain module (`domain/releases.ts`) derives both screens from that model, so an index row and a release header cannot disagree. The view is a `BasesView` subclass with no `WriteGate` and no `WriteLock`, drawing its own read-only rows rather than reusing `render/rows.ts`, which is bound to `BacklogViewHost`.

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom), eslint with per-directory `no-restricted-imports`, fallow (dead code / complexity), `scripts/docs-check.mjs` (register gate).

**Spec:** `docs/superpowers/specs/2026-08-22-release-management-first-increment-design.md`

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`; each may reach anything below it and nothing above. `ui/` and `i18n/` are leaves. Violations fail `npm run lint`, not review.
- **400-line maximum per source file**, enforced by lint. `test/**` has its own budget of 450.
- **Never write frontmatter outside** `storage/frontmatter.ts`, `storage/createNote.ts`, `storage/propertyWrite.ts`. This increment adds no writer at all.
- **Every user-visible string goes through `t()`** from `i18n/t.ts`; the catalog is `src/i18n/en.ts`, which is data (no imports, no logic). `view/release/` is a swept directory from its first commit. A type name, a property key or an option key is **data** and never enters the catalog.
- **Type names are fixed constants** (ADR 0013). Nothing lets a vault rename `Release`.
- **The stylesheet is one partial per concern** under `styles/`, assembled by `styles/index.css`. The root `styles.css` is generated and gitignored — never edit it.
- **`createSvg` rejects a space-separated class string.** Pass an array. A lint rule (`SVG_CLASS_TOKENS`) bans the string spelling.
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) passes. Coverage thresholds in `vitest.config.mts` only ever go up.
- **Every module in `src/` must be specified** by a note's `## Where it lives` or an ADR's `## Decision`, or `npm run docs` fails. `test/` is exempt.
- **Commit after every task.** `CHANGELOG.md` gains its `[Unreleased]` entry in the PR that earns it (Task 10).

---

### Task 1: `Release` in the fixed type vocabulary

The type has to exist before anything can look for it. It is a **marker** — no rung, no legal children, hangs from nothing — which is the same category `Milestone` and `Iteration` already occupy.

**Files:**
- Modify: `src/domain/typeVocabulary.ts` (the `RELEASE_TYPE` constant, `MARKER_TYPES`)
- Modify: `src/view/render/badges.ts` (`NAMED_TYPE_STYLE` entry)
- Modify: `src/domain/itemTypes.ts` (`isReleaseType`, the `drawsAsPoint` gate, and `placementEnds`)
- Modify: `src/domain/bars.ts` (the no-bar refusal that gate needs beside it)
- Modify: `src/view/manual/typesSection.ts` (`INTENT` entry — required, see Step 6)
- Modify: `styles/badges.css` (the `pbl-lvl-release` colour)
- Test: `test/domain/itemTypes.test.ts`, `test/domain/bars.test.ts`, `test/storage/frontmatterDates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RELEASE_TYPE: string` and `isReleaseType(typeName: string | null): boolean`, both used by Tasks 2, 4 and 5.

- [ ] **Step 1: Write the failing test**

Adding a name to `ALL_TYPES` has three consequences a newcomer will not predict, and this test states all of them. `ALL_TYPES` is built from `MARKER_TYPES`, and `test/view/manualTypes.test.ts` already checks that `INTENT` in `typesSection.ts` covers every entry of it — so a type added without an explanation fails a test that is not this one.

Add to `test/domain/itemTypes.test.ts`:

```ts
import { RELEASE_TYPE, MARKER_TYPES, ALL_TYPES, LEVELS, EXTRA_TYPES } from '../../src/domain/typeVocabulary';
import { isReleaseType, isMarkerType, childTypeChoices } from '../../src/domain/itemTypes';

describe('Release is a marker, not a rung', () => {
	it('is a declared marker beside Milestone and Iteration', () => {
		expect(RELEASE_TYPE).toBe('Release');
		expect(MARKER_TYPES).toContain(RELEASE_TYPE);
		expect(ALL_TYPES).toContain(RELEASE_TYPE);
	});

	it('is on neither ladder and is not an extra type', () => {
		expect(LEVELS).not.toContain(RELEASE_TYPE);
		expect(EXTRA_TYPES).not.toContain(RELEASE_TYPE);
	});

	it('matches its own name case-insensitively and nothing else', () => {
		expect(isReleaseType('Release')).toBe(true);
		expect(isReleaseType('release')).toBe(true);
		expect(isReleaseType('RELEASE')).toBe(true);
		expect(isReleaseType('Milestone')).toBe(false);
		expect(isReleaseType('Iteration')).toBe(false);
		expect(isReleaseType(null)).toBe(false);
	});

	it('answers the structural marker question too', () => {
		expect(isMarkerType(RELEASE_TYPE)).toBe(true);
	});

	// NOT "is not a child of anything", and the difference is the DESIGN rather than a gap.
	// `linkAll` attaches every item with a resolved `parentPath` and special-cases no
	// marker, so a hand-written parent nests a `Milestone` today and nests a `Release` the
	// same way — deliberately. `Releases as their own type` 2a's "the parent places it
	// nowhere" means it occupies no rung and counts for nothing, which the model DOES
	// enforce: `descendantCount`'s walk scores a marker 0 and traverses THROUGH it, so a
	// work item somebody filed under a release still reaches its real ancestors.
	// `test/domain/milestones.test.ts` states all three cases for `Milestone`, and rooting
	// a marker in `linkAll` would break the third outright.
	it('offers no legal children — a release holds nothing', () => {
		const release = { ladder: LEVELS, typeName: RELEASE_TYPE, effectiveLevelIndex: -1 };
		expect(childTypeChoices(release as never)).toEqual([]);
	});

	it('counts for nothing wherever it sits, and is traversed through', () => {
		// The three claims `test/domain/milestones.test.ts` makes of a `Milestone`, asked of
		// a `Release`: nested under an epic it adds nothing to the count, contributes no
		// date evidence, and does not hide its own subtree from the ancestors above it.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('1.0', { type: 'Release', parent: 'An epic', due: '2026-12-01' }),
			note('Prep', { type: 'PBI', parent: '1.0', due: '2026-09-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		// The release itself is not counted; the PBI filed under it still is.
		expect(epic.descendantCount).toBe(1);
		// And the release's own date is not evidence for the epic's inferred span.
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 9, day: 1 });
	});

	it('leaves every other classification alone', () => {
		expect(isReleaseType('Epic')).toBe(false);
		expect(isReleaseType('Test suite')).toBe(false);
		expect(isMarkerType('Epic')).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL — `RELEASE_TYPE` and `isReleaseType` are not exported.

- [ ] **Step 3: Add the constant and the predicate**

In `src/domain/typeVocabulary.ts`, beside `MILESTONE_TYPE` and `ITERATION_TYPE`:

```ts
/**
 * The third declared marker, named for the reason the other two are: a surface that
 * captions what it drew names the TYPE, and a type name is data — matched in frontmatter,
 * never translated — so the name lives here rather than being spelled again beside every
 * reader. A release holds no work: membership is a property on the item
 * ([[Releases as their own type]]), which is exactly what makes it a marker and not an
 * extra type.
 */
export const RELEASE_TYPE = 'Release';
export const MARKER_TYPES = [MILESTONE_TYPE, ITERATION_TYPE, RELEASE_TYPE];
```

In `src/domain/itemTypes.ts`, beside `isIterationType`:

```ts
/**
 * One marker BY NAME, the shape `isIterationType` already has. Asked where a rule is
 * about RELEASES specifically — which notes the release view lists — rather than the
 * structural question `isMarkerType` answers for all three alike.
 */
export function isReleaseType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === RELEASE_TYPE.toLowerCase();
}
```

Import `RELEASE_TYPE` from `./typeVocabulary` in `itemTypes.ts` — it already imports `ITERATION_TYPE` from there.

- [ ] **Step 4: Keep the release off the backlog roadmap**

`MARKER_TYPES` is not only a classification — it is the switch four dated-axis consumers
read. `drawsAsPoint` returns true for **any** marker that is not an `Iteration`, so without
this step a `Release` would immediately: draw as a point in `milestoneLines.ts:62`, be placed
by `placeMarker` in `bars.ts:106`, offer `['target']` from `placementEnds`, and — worst —
report a writable body from `bars.ts:278`, so a timeline drag on the **backlog** view would
write a release's date through the **backlog's** target key.

That is [[A release on the dated axis]], which this increment explicitly defers, shipped by
accident and wired to the wrong view's date mapping. That feature will draw release markers
from the roadmap's OWN release-date key, which does not exist yet, so there is nothing here
to draw from and nothing correct to write.

In `src/domain/itemTypes.ts`:

```ts
export function drawsAsPoint(typeName: string | null, iterationBars: boolean): boolean {
	if (!isMarkerType(typeName)) return false;
	// A `Release` is a marker STRUCTURALLY — no rung, no children, no prerequisites — and
	// draws no point on this roadmap. [[A release on the dated axis]] is where a release
	// gets a position, from the ROADMAP's own release-date key; until then the backlog's
	// target key is the wrong mapping to read and a far worse one to write, since
	// `bars.ts`'s holdable body would let a timeline drag edit a release through it.
	if (isReleaseType(typeName)) return false;
	return isIterationType(typeName) ? !iterationBars : true;
}
```

**`drawsAsPoint` returning false is not enough on its own, and getting this half-right is
worse than not gating at all.** Two other call sites read that predicate through a ternary
whose *else* branch is the permissive one:

`placementEnds` is `drawsAsPoint(...) ? ['target'] : [...BOTH_ENDS]`. Refusing a release
there flips it from one end to **both**, and `storage/frontmatter.ts:126` uses that list to
decide which date keys a write may touch — so the gate meant to keep releases off the dated
axis would instead have let the writer edit *both* backlog date properties on a release, and
`canSchedule` would have offered Schedule and Unschedule to go with it. In
`src/domain/itemTypes.ts`:

```ts
export function placementEnds(typeName: string | null, iterationBars: boolean): PlacementEnd[] {
	// A `Release` speaks NO end here — not one, not two. `drawsAsPoint` refuses it (see
	// there), and the ternary below reads that refusal as "therefore a span", which would
	// hand the WRITER both backlog date keys and the menu a Schedule action. The gate has
	// to be stated at every consumer that reads the predicate through a ternary, or it
	// makes the very surface it was closing more permissive than before.
	if (isReleaseType(typeName)) return [];
	return drawsAsPoint(typeName, iterationBars) ? ['target'] : [...BOTH_ENDS];
}
```

Then check every caller treats an empty list as "no ends": `storage/frontmatter.ts:126`,
`view/cardMoves.ts` at 203, 230 and 253, and `canSchedule` in `view/interactions/plan.ts`.
Each must refuse rather than fall through — an empty `ends` that reaches
`computeScheduleWrites` and plans nothing is acceptable; one that is read as "unspecified,
so use the default" is the same bug again. Add a test at the **writer**, not only at the
menu: `applyWrites` given a schedule write against a `Release` must plan no date key.

The third is the placement itself, and **it goes in `placeItem`, not in `deriveBars`.** Both
matter: `placeItem` (`bars.ts:101`) falls THROUGH to the ordinary start/target derivation once
`drawsAsPoint` says no, so a release carrying the backlog's date properties would draw as a
*bar* instead of a point — the same leak wearing a different shape. And `placeItem` is the one
site every path reaches: `deriveBars` calls it at `bars.ts:132` for the dated axis, and
`roadmap.ts:596` calls it independently for the **resources** axis, which `deriveLanes` routes
through without ever touching `deriveBars`. A guard in `deriveBars` would have left the
resource lanes and the shelf placing releases exactly as before.

In `src/domain/bars.ts`, at the top of `placeItem`, before the `drawsAsPoint` branch:

```ts
	// No bar and no point: see `drawsAsPoint`'s own note. Refused here as well because a
	// false from that predicate means "not a POINT", which the lines below would otherwise
	// read as "therefore a bar".
	if (isReleaseType(item.typeName)) return null;
```

`placeItem` returns a `Placement`, not `null` — read the type before writing this and return
whatever it uses for "not on this axis at all". If the only unplaceable answer it can give is
`{ kind: 'shelf', reason: … }`, that is the wrong one: a release on the shelf is still a
release the roadmap is showing, and the shelf is a counted, drop-targetable band. Prefer a
`kind` the callers already skip, and if none exists, refuse the item one level up in BOTH
callers — `deriveBars` at `bars.ts:132` and `roadmap.ts:596` — rather than inventing a
placement kind for this increment.

- [ ] **Step 5: Test the gate**

```ts
	it('draws no point and no bar on the backlog roadmap', () => {
		expect(drawsAsPoint('Release', false)).toBe(false);
		expect(drawsAsPoint('Release', true)).toBe(false);
		// Still a marker structurally — no rung, no children, no prerequisites.
		expect(isMarkerType('Release')).toBe(true);
		// And a Milestone is untouched, which is what says this gate is about the deferred
		// feature rather than about markers.
		expect(drawsAsPoint('Milestone', false)).toBe(true);
	});

	it('is placed on neither axis, by the path the resources axis takes', () => {
		// TWO assertions on purpose. `deriveBars` covers the dated axis; `roadmap.ts:596`
		// calls `placeItem` independently for the resources axis, so a guard proved only
		// through `deriveBars` proves nothing about resource lanes or the shelf.
		const release = { typeName: 'Release', /* plus the backlog's own start and target */ } as BacklogItem;
		expect(placeItem(release, statedEnds(release), false)).toEqual(/* the not-placed answer */);
	});

	it('speaks no placement end, so nothing offers or writes a release date', () => {
		// NOT `['start', 'target']`, which is what the ternary hands back for anything
		// `drawsAsPoint` refuses. This assertion is the whole reason the gate is safe.
		expect(placementEnds('Release', false)).toEqual([]);
		expect(placementEnds('Release', true)).toEqual([]);
		// The two it must not disturb.
		expect(placementEnds('Milestone', false)).toEqual(['target']);
		expect(placementEnds('Epic', false)).toEqual(['start', 'target']);
	});
```

And at the writer, in `test/storage/frontmatterDates.test.ts` — the call site that decides
what lands in a note:

```ts
	it('writes no date key for a release, at either end', () => {
		// `placementEnds` is what `applyWrites` consults; a release speaks none, so a
		// schedule write against one must plan nothing rather than both keys.
		const vault = new FakeVault();
		vault.addFile('1.0.md', { frontmatter: { type: 'Release' } });
		// Build the same schedule write the timeline would, then assert the frontmatter is
		// untouched. Copy the surrounding file's own helper for planning one.
		expect(vault.fm('1.0.md')).toEqual({ type: 'Release' });
	});
```

Write that last one against the file's real helpers rather than the sketch above — read
`test/storage/frontmatterDates.test.ts` first and follow how its neighbours plan a write.

Add a `deriveBars` case in `test/domain/bars.test.ts` for a release carrying the backlog's
own start and target properties, asserting it places nothing. Watch it fail with the
`bars.ts` guard commented out — that is the branch that would ship the deferred feature.

- [ ] **Step 6: Add the badge style and the manual entry**

In `src/view/render/badges.ts`, add to `NAMED_TYPE_STYLE` (keys are lowercase):

```ts
	release: { icon: 'package', badge: 'pbl-lvl-release' },
```

In `styles/badges.css`, beside the other named-type colours:

```css
.pbl-lvl-release { --pbl-badge-rgb: var(--color-green-rgb); }
```

In `src/view/manual/typesSection.ts`, add to `INTENT`:

```ts
	Release:
		'A set of things going out together, with a version and a target date. Work names its ' +
		'release in a property rather than hanging from one, so like a Milestone it holds ' +
		'nothing. The release view is where one is read; the backlog draws it as an ordinary row.',
```

- [ ] **Step 7: Let the toolbar offer it, and update the test that says so**

Adding a name to `ALL_TYPES` has a fourth consequence: the backlog toolbar's New menu offers
`New Release`, because `byProjectionType` (`src/view/projection.ts`) filters only
`isIterationType` outside the boards. **This is intended — do not add a `Release` exclusion.**

`Iteration` is excluded there for a reason that does not apply: the board's scope picker is a
dedicated door deriving its number, dates and folder, and a second door would be a second set
of defaults. `Release` has no such door, so excluding it would leave the type creatable only by
hand-editing frontmatter. `Milestone` is the precedent — a marker carrying a date the creator
does not set, offered anyway.

`test/view/toolbar.test.ts` asserts the menu's exact contents and will fail until you extend
it. Add `'New Release'` after `'New Milestone'`:

```ts
		// Every declared type: this menu is the one place a top-level item of any type
		// can be made.
		expect(picker?.items.map((i) => i.titleText)).toEqual([
			'New Epic',
			'New Feature',
			'New PBI',
			'New Task',
			'New Issue',
			'New Bug',
			'New Idea',
			'New Deliverable',
			'New Milestone',
			'New Release',
		]);
```

The order is `ALL_TYPES`' own — `[...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES, ...]` — and
`RELEASE_TYPE` goes last in `MARKER_TYPES`, so `New Release` lands after `New Milestone`.
`Iteration` is absent from that list because the creator filters it, which is the behaviour
this step is deliberately not copying.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run test/domain/itemTypes.test.ts test/domain/bars.test.ts test/view/manualTypes.test.ts test/view/toolbar.test.ts`
Expected: PASS all four. `manualTypes.test.ts` is the one that fails if Step 6's `INTENT` entry is missing — watch it fail once by deleting the entry, then put it back.

- [ ] **Step 9: Commit**

```bash
git add src/domain/typeVocabulary.ts src/domain/itemTypes.ts src/domain/bars.ts src/view/render/badges.ts src/view/manual/typesSection.ts styles/badges.css test/domain/itemTypes.test.ts test/domain/bars.test.ts test/view/toolbar.test.ts
git commit -m "Add Release to the vocabulary as a third marker"
```

---

### Task 2: `releases` on the model

**Files:**
- Modify: `src/domain/model.ts` (the `BacklogModel.releases` field and the filter that fills it)
- Test: `test/domain/model.test.ts`

**Interfaces:**
- Consumes: `isReleaseType` from Task 1.
- Produces: `BacklogModel.releases: BacklogItem[]` — read by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

The two rules to state are the ones `iterations` already keeps and that a newcomer will not infer: read off the **whole unfocused tree**, and **excluding `outsideFilter`**.

Add to `test/domain/model.test.ts`:

```ts
describe('releases on the model', () => {
	it('collects every Release result, and nothing else', () => {
		const vault = new FakeVault();
		vault.addFile('R1.md', { frontmatter: { type: 'Release' } });
		vault.addFile('R2.md', { frontmatter: { type: 'release' } });
		vault.addFile('M.md', { frontmatter: { type: 'Milestone' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith());
		expect(model.releases.map((r) => r.file.path).sort()).toEqual(['R1.md', 'R2.md']);
	});

	it('excludes a release the Base filtered out', () => {
		const vault = new FakeVault();
		vault.addFile('Inside.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Outside.md', { frontmatter: { type: 'Release' } });
		// How every context-row test in this repository excludes a note: filter the entries the
		// view is handed. There is no `entriesExcept` helper.
		const entries = vault.entries().filter((e) => e.file.path !== 'Outside.md');
		const model = buildModel(vault.app, entries, settingsWith());
		expect(model.releases.map((r) => r.file.path)).toEqual(['Inside.md']);
	});

	it('is not narrowed by an active focus level', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ focusLevel: 'Epic' }));
		expect(model.releases.map((r) => r.file.path)).toEqual(['R.md']);
	});
});
```

Match the existing file's helpers for building a vault and settings — read the `iterations` tests in the same file and copy their shape exactly rather than inventing one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/model.test.ts -t "releases on the model"`
Expected: FAIL — `model.releases` is undefined.

- [ ] **Step 3: Add the field**

In `src/domain/model.ts`, in the `BacklogModel` interface beside `iterations`:

```ts
	/**
	 * Every `Release` result in the base — the release view's own population, parallel to
	 * `results` rather than a wider version of it. Read off `items`, the whole unfocused
	 * tree, for `iterations`' own reason: which releases exist is a fact about the base,
	 * not about whichever subtree a focus level set on another projection is narrowing.
	 * Excludes `outsideFilter` items, same as `results` and `iterations` — a release the
	 * Base excluded is not this base's to list, and it never arrives as a context row
	 * either, because a release parents nothing.
	 */
	releases: BacklogItem[];
```

In the `rest` object of `buildModel`, beside the `iterations` line:

```ts
		// Same source, same guard, the same reason — see `BacklogModel.releases`.
		releases: items.filter((item) => !item.outsideFilter && isReleaseType(item.typeName)),
```

Import `isReleaseType` alongside the existing `isIterationType` import.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/model.ts test/domain/model.test.ts
git commit -m "Carry the base's releases on the model"
```

---

### Task 3: `releaseOptions.ts` — this view's seven keys

**Files:**
- Create: `src/domain/releaseOptions.ts`
- Modify: `src/i18n/en.ts` (the option labels)
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Consumes: `resolveSettings` / `configReaders` from `src/domain/settingsResolve.ts`, `notePropsOnly` from `src/domain/optionalProperties.ts`.
- Produces:
  - `getReleaseViewOptions(config: BasesViewConfig): BasesAllOptions[]`
  - `interface ReleaseSettings { parentKey: string; orderKey: string; typeKey: string; membershipKey: string; versionKey: string; targetDateKey: string; statusKey: string }`
  - `resolveReleaseSettings(config: BasesViewConfig): ReleaseSettings`

  Every key is `''` when unconfigured. Tasks 4, 5, 7, 8 and 9 all read this.

- [ ] **Step 1: Write the failing test**

The load-bearing claim is that **seven** keys are declared, including the three core model mappings. Read the spec's "Its own `releaseOptions.ts`" section before writing this: a view that finds releases by type, builds a tree by parent and sorts by mapped rank cannot read any of those without naming them, and the estimation view is not a precedent for omitting them because `buildEstimationModel` reads results flat.

Create `test/domain/releaseOptions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions, resolveReleaseSettings } from '../../src/domain/releaseOptions';
import { FakeViewConfig } from '../helpers/vault';

function keysOf(config: FakeViewConfig): string[] {
	return getReleaseViewOptions(config as never)
		.flatMap((group) => ('items' in group ? group.items : []))
		.map((item) => (item as { key: string }).key);
}

describe('the release view names its own keys', () => {
	it('declares all seven, the three model mappings included', () => {
		expect(keysOf(new FakeViewConfig({})).sort()).toEqual(
			[
				'membershipProperty',
				'orderProperty',
				'parentProperty',
				'releaseStatusProperty',
				'targetDateProperty',
				'typeProperty',
				'versionProperty',
			].sort(),
		);
	});

	it('resolves each key, and leaves an unconfigured one empty', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({ typeProperty: 'note.kind' }) as never);
		expect(settings.typeKey).toBe('kind');
		expect(settings.membershipKey).toBe('');
		expect(settings.versionKey).toBe('');
	});

	it('defaults the three model mappings the way the backlog view does', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(settings.typeKey).toBe('type');
		expect(settings.parentKey).toBe('parent');
		expect(settings.orderKey).toBe('order');
	});

	it('tells a CLEARED mapping from one never set', () => {
		// The whole "No type property is mapped" state depends on this, and `propKey` alone
		// cannot express it — it hands back the default for both.
		const cleared = resolveReleaseSettings(new FakeViewConfig({ typeProperty: '' }) as never);
		expect(cleared.typeKey).toBe('');
		const untouched = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(untouched.typeKey).toBe('type');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/domain/releaseOptions.ts`. Read `src/domain/estimationOptions.ts` for the group shape and `src/domain/settingsResolve.ts` for `configReaders` before writing; `propKey` there is what strips the `note.` prefix.

```ts
import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { configReaders } from './settingsResolve';
import { notePropsOnly } from './optionalProperties';
import { t } from '../i18n/t';

/**
 * What Bases shows in the release view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog and `estimationOptions.ts` is for the estimation
 * table.
 *
 * SEVEN keys, and the three model mappings among them are the point. A separately
 * registered view inherits no binding from the backlog view, and this one reads a type to
 * find releases at all, a parent to build the scope tree, and an order to rank the index.
 * The estimation view declares none of the three because `buildEstimationModel` reads Base
 * results FLAT — no hierarchy, no types, no ranking — so it is a precedent for one options
 * file per view and for nothing beyond that.
 *
 * Each defaults to the same suggestion the backlog view offers, which is
 * [[Settings scoped to their view]]'s rule exactly: sharing a suggestion is not sharing a
 * setting, and the two may legitimately be pointed at different properties.
 */
export interface ReleaseSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	/** On the ITEM: which release it names. */
	membershipKey: string;
	/** On the RELEASE note. */
	versionKey: string;
	targetDateKey: string;
	statusKey: string;
}

export function getReleaseViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [modelGroup(), releaseGroup()];
}

function modelGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('release.option.group.model'),
		items: [
			{
				type: 'property',
				key: 'typeProperty',
				displayName: t('option.typeProperty'),
				default: 'note.type',
				placeholder: 'type',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'parentProperty',
				displayName: t('option.parentProperty'),
				default: 'note.parent',
				placeholder: 'parent',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'orderProperty',
				displayName: t('option.orderProperty'),
				default: 'note.order',
				placeholder: 'order',
				filter: notePropsOnly,
			},
		],
	};
}

function releaseGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('release.option.group.release'),
		items: [
			{
				type: 'property',
				key: 'membershipProperty',
				displayName: t('release.option.membership'),
				placeholder: 'release',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'versionProperty',
				displayName: t('release.option.version'),
				placeholder: 'version',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'targetDateProperty',
				displayName: t('release.option.targetDate'),
				placeholder: 'target-date',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'releaseStatusProperty',
				displayName: t('release.option.status'),
				placeholder: 'status',
				filter: notePropsOnly,
			},
		],
	};
}

export function resolveReleaseSettings(config: BasesViewConfig): ReleaseSettings {
	// `clearablePropKey`, NOT `propKey`, for the three mappings that ship a real default.
	// `propKey` returns its fallback whenever `getAsPropertyId` gives nothing usable, and
	// `getAsPropertyId` reports "cleared" and "never set" identically — so with `propKey`
	// a type property the user deliberately cleared resolves back to `type`, the
	// "No type property is mapped" state is unreachable, and the view test that binds
	// `{ typeProperty: '' }` can never pass. `clearablePropKey` draws exactly that
	// distinction (`config.get(key) === undefined ? def : propKey(key, '')`) and exists
	// for this: unset takes the suggestion, cleared means off.
	const { clearablePropKey, propKey } = configReaders(config);
	return {
		parentKey: clearablePropKey('parentProperty', 'parent'),
		orderKey: clearablePropKey('orderProperty', 'order'),
		typeKey: clearablePropKey('typeProperty', 'type'),
		// No fallback: absence is a value, and a suggestion is not a binding. A membership
		// key nobody bound must read as unconfigured rather than as `release`, or the view
		// would report a scope from a property the user never named.
		membershipKey: propKey('membershipProperty', ''),
		versionKey: propKey('versionProperty', ''),
		targetDateKey: propKey('targetDateProperty', ''),
		statusKey: propKey('releaseStatusProperty', ''),
	};
}
```

Check `configReaders`' actual exported shape before relying on `propKey` — if its signature differs, use whatever `resolveSettings` itself uses at `settingsResolve.ts:279-290` and keep the fallback semantics above.

Note `releaseStatusProperty`, not `statusProperty`: the backlog view's own state key is `stateProperty`, and a second key spelled `statusProperty` in a different view is the kind of near-collision that reads as a typo in a `.base` file.

- [ ] **Step 4: Add the catalog keys**

In `src/i18n/en.ts`, add the five new keys (the three model mappings reuse the existing `option.*` keys):

```ts
	'release.option.group.model': 'Model',
	'release.option.group.release': 'Release',
	'release.option.membership': 'Membership property',
	'release.option.version': 'Version property',
	'release.option.targetDate': 'Target date property',
	'release.option.status': 'Status property',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/releaseOptions.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "Give the release view its own seven option keys"
```

---

### Task 4: `releases.ts` — the index

**Files:**
- Create: `src/domain/releases.ts`
- Test: `test/domain/releases.test.ts`

**Interfaces:**
- Consumes: `BacklogModel.releases` (Task 2), `ReleaseSettings` (Task 3), `readString` / `readDate` / `ownValue` / `FieldReading` / `CivilDate` from `src/domain/noteFields.ts`. **Both tolerant readers unwrap an array into its first element (`noteFields.ts:187` and `:269`), so a list must be refused BEFORE either is called** — see `readLabel` and `readTarget` below.
- Produces:

```ts
export interface ReleaseFigure<T> { value: T | null; invalid: boolean; unconfigured: boolean }
export interface ReleaseRow {
	item: BacklogItem;
	path: string;
	name: string;
	version: ReleaseFigure<string>;
	target: ReleaseFigure<CivilDate>;
	status: ReleaseFigure<string>;
	/** A FIGURE, not a bare number: with the membership key unbound the count is
	 *  unreadable, not zero. See the field's own note in the module. */
	members: ReleaseFigure<number>;
}
export interface ReleaseIndex { rows: ReleaseRow[]; unresolved: BacklogItem[] }
export function releaseIndex(app: App, model: BacklogModel, settings: ReleaseSettings): ReleaseIndex
```

  Task 8 renders `ReleaseIndex`; Task 5 reuses `ReleaseFigure` and the membership predicate.

- [ ] **Step 1: Write the failing test**

Three separate claims, and the third is the one people get wrong: **unconfigured, absent and unreadable are three answers**, not two. `FieldReading` in `noteFields.ts` already separates absent from invalid; `ReleaseFigure` adds the third.

Create `test/domain/releases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { releaseIndex } from '../../src/domain/releases';
import { buildModel } from '../../src/domain/model';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

const KEYS = {
	parentKey: 'parent',
	orderKey: 'order',
	typeKey: 'type',
	membershipKey: 'release',
	versionKey: 'version',
	targetDateKey: 'target-date',
	statusKey: 'status',
};

function indexOf(vault: FakeVault, settings = KEYS) {
	return releaseIndex(vault.app, buildModel(vault.app, vault.entries(), settingsWith()), settings);
}

describe('the release index', () => {
	it('orders by target date, then rank, with the undated last', () => {
		const vault = new FakeVault();
		vault.addFile('Late.md', { frontmatter: { type: 'Release', 'target-date': '2026-12-01' } });
		vault.addFile('Early.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		vault.addFile('Undated.md', { frontmatter: { type: 'Release' } });
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(['Early', 'Late', 'Undated']);
	});

	it('breaks a shared date by rank, and a shared rank by path', () => {
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 20 } });
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 10 } });
		vault.addFile('C.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		vault.addFile('D.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		const names = indexOf(vault).rows.map((r) => r.name);
		expect(names.slice(0, 2)).toEqual(['A', 'B']);
		// No rank on either: the tie falls to path, which is stable across renders.
		expect(names.slice(2)).toEqual(['C', 'D']);
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(names);
	});

	it('reads a rank the model’s tolerant reader accepts', () => {
		// `readNumber` is `Number.parseFloat`, so this is rank 10 everywhere else in the
		// plugin. A `Number()` conversion would make it NaN and sort the release last.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: '10 - first' } });
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 20 } });
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(['A', 'B']);
	});

	it('reads rank from the MAPPED order key, never a literal `order`', () => {
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', rank: 10, order: 99 } });
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', rank: 20, order: 1 } });
		const rows = releaseIndex(vault.app, buildModel(vault.app, vault.entries(), settingsWith()), {
			...KEYS,
			orderKey: 'rank',
		}).rows;
		expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
	});

	it('tells unconfigured, absent and unreadable apart', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', 'target-date': 'soon', status: 'Planned' } });
		const configured = indexOf(vault).rows[0];
		expect(configured.target).toEqual({ value: null, invalid: true, unconfigured: false });
		expect(configured.version).toEqual({ value: null, invalid: false, unconfigured: false });
		expect(configured.status.value).toBe('Planned');

		const unbound = releaseIndex(vault.app, buildModel(vault.app, vault.entries(), settingsWith()), {
			...KEYS,
			targetDateKey: '',
		}).rows[0];
		expect(unbound.target).toEqual({ value: null, invalid: false, unconfigured: true });
	});

	it('calls an empty or malformed label unreadable, never absent', () => {
		const vault = new FakeVault();
		// 3b names the empty version explicitly: somebody wrote something there.
		vault.addFile('Empty.md', { frontmatter: { type: 'Release', version: '', status: { a: 1 } } });
		// A LIST is unreadable too, and it is the one `readString` would quietly unwrap to
		// its first element and call clean.
		vault.addFile('Listed.md', {
			frontmatter: { type: 'Release', version: ['0.8.0', '0.9.0'], 'target-date': ['2026-09-01', '2026-10-01'] },
		});
		vault.addFile('Missing.md', { frontmatter: { type: 'Release' } });
		const rows = indexOf(vault).rows;
		expect(rows.find((r) => r.name === 'Listed')?.version).toEqual({
			value: null,
			invalid: true,
			unconfigured: false,
		});
		// And the DATE, which would otherwise report a clean 2026-09-01 and SORT by it.
		expect(rows.find((r) => r.name === 'Listed')?.target).toEqual({
			value: null,
			invalid: true,
			unconfigured: false,
		});
		const empty = rows.find((r) => r.name === 'Empty');
		expect(empty?.version).toEqual({ value: null, invalid: true, unconfigured: false });
		expect(empty?.status).toEqual({ value: null, invalid: true, unconfigured: false });
		// A key the note simply does not carry stays absent — the third answer.
		const missing = rows.find((r) => r.name === 'Missing');
		expect(missing?.version).toEqual({ value: null, invalid: false, unconfigured: false });
	});

	it('counts members, and a release nothing points at is still a row', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Empty.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[R]]' } });
		const rows = indexOf(vault).rows;
		expect(rows.find((r) => r.name === 'R')?.members.value).toBe(1);
		expect(rows.find((r) => r.name === 'Empty')?.members.value).toBe(0);
	});

	it('cannot count members at all with the membership key unbound', () => {
		const vault = releaseVault();
		const rows = releaseIndex(vault.app, buildModel(vault.app, vault.entries(), settingsWith()), {
			...KEYS,
			membershipKey: '',
		}).rows;
		// Not zero. Zero is a real answer and this is not one.
		expect(rows[0].members).toEqual({ value: null, invalid: false, unconfigured: true });
	});

	it('reports an item whose membership names a non-release, and one holding two values', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Bad.md', { frontmatter: { type: 'Feature', release: '[[E]]' } });
		vault.addFile('Two.md', { frontmatter: { type: 'Feature', release: ['[[R]]', '[[E]]'] } });
		// Present but unreadable is a REPORT, not an absence: the note carries the key, so
		// somebody wrote something there. A key no note carries stays silent.
		vault.addFile('Blank.md', { frontmatter: { type: 'Feature', release: '' } });
		vault.addFile('Object.md', { frontmatter: { type: 'Feature', release: { a: 1 } } });
		vault.addFile('None.md', { frontmatter: { type: 'Feature' } });
		const { rows, unresolved } = indexOf(vault);
		expect(unresolved.map((i) => i.file.path).sort()).toEqual([
			'Bad.md',
			'Blank.md',
			'Object.md',
			'Two.md',
		]);
		expect(rows.find((r) => r.name === 'R')?.members.value).toBe(0);
	});
});
```

Use the fixture spellings `test/CLAUDE.md` documents: a **bracketed link that resolves** needs `parentLink`-style cache wiring, a bare name goes straight into `frontmatter`. Read that section before writing the membership fixtures — a cache this repository's fake vault can hold but Obsidian would not produce has cost a real bug here before.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/domain/releases.ts`. It is pure: it derives from the model and touches no DOM, shaped like `board.ts` and `roadmap.ts`.

```ts
import { App } from 'obsidian';
import { BacklogItem, BacklogModel } from './model';
import { ReleaseSettings } from './releaseOptions';
import { CivilDate, ownValue, readDate, readString } from './noteFields';
import { isReleaseType } from './itemTypes';

/**
 * A figure with THREE answers, not two. `FieldReading` in `noteFields.ts` separates a
 * key that holds nothing (absent) from one holding something no reader will guess at
 * (invalid); this adds the third the register insists on — a key nobody bound at all.
 * "Unconfigured" is a column absent for every row and named once; "invalid" is one row
 * saying somebody wrote something there. Collapsing them reports a configuration mistake
 * as a data mistake, or the reverse.
 */
export interface ReleaseFigure<T> {
	value: T | null;
	invalid: boolean;
	unconfigured: boolean;
}

export interface ReleaseRow {
	item: BacklogItem;
	path: string;
	name: string;
	version: ReleaseFigure<string>;
	target: ReleaseFigure<CivilDate>;
	status: ReleaseFigure<string>;
	/**
	 * Notes whose OWN membership property names this release — never an ancestor, never a
	 * descendant. A FIGURE like the other three, not a bare number: with the membership key
	 * unbound every release would otherwise report a truthful-looking `0`, when the honest
	 * answer is that the count cannot be read at all. Same rule as every other unconfigured
	 * figure — the column is absent and named once, never zero in each row.
	 */
	members: ReleaseFigure<number>;
}

export interface ReleaseIndex {
	rows: ReleaseRow[];
	/**
	 * Items carrying a membership value that named no release — a link to something that
	 * is not a release, two values at once, or a non-plan row carrying the property by
	 * hand. Reported rather than dropped: they belong to no release, so they appear on no
	 * release's screen and this is the only place they can be seen.
	 */
	unresolved: BacklogItem[];
}

const UNCONFIGURED = { value: null, invalid: false, unconfigured: true } as const;

function figure<T>(reading: { value: T | null; invalid: boolean }): ReleaseFigure<T> {
	return { value: reading.value, invalid: reading.invalid, unconfigured: false };
}

/**
 * A label read with [[Releases as their own type]] 3b's own rule: a configured key holding
 * SOMETHING that is not a usable label — an object, a list of them, **or an empty string,
 * which 3b names explicitly** — is unreadable rather than absent, "because somebody wrote
 * something there".
 *
 * `readString` alone cannot answer this: it returns null for an object and for `''` alike,
 * so hard-coding `invalid: false` beside it reports malformed data as an unset key. Worse
 * for a LIST, which it does not refuse at all — it recurses into the first element, so
 * `['0.8.0', '0.9.0']` reads as a clean `0.8.0` and the second value disappears. Not
 * `readPlacement` either, which is the closest existing reader and deliberately calls an
 * empty value ABSENCE — right for a roadmap horizon, wrong for a version 3b says is a
 * refusal.
 */
/**
 * The same refusal for the DATE figure, and it needs its own statement because `readDate`
 * has `readString`'s habit: `noteFields.ts:269` unwraps an array by recursing into its
 * first element, so `target-date: [2026-09-01, 2026-10-01]` would report a clean
 * `2026-09-01` and SORT the index by it. A release states one target date; a list of them
 * is 3b's configured-but-unreadable, not a value to pick from.
 */
function readTarget(raw: unknown): FieldReading<CivilDate> {
	if (Array.isArray(raw)) return { value: null, invalid: true };
	return readDate(raw);
}

function readLabel(raw: unknown): { value: string | null; invalid: boolean } {
	if (raw === null || raw === undefined) return { value: null, invalid: false };
	// Refused BEFORE `readString`, which would unwrap it to its first element and call the
	// figure clean. A label is one value; a list of them is somebody writing something the
	// reader will not guess at, which is 3b's own definition of unreadable.
	if (Array.isArray(raw)) return { value: null, invalid: true };
	const text = readString(raw);
	if (text !== null && text.trim() !== '') return { value: text, invalid: false };
	return { value: null, invalid: true };
}

/**
 * Every row a membership property may legally be READ from: the whole tree, minus the
 * context rows.
 *
 * NOT `model.results`, and this is the trap. `results` is the PLAN projection —
 * `projectionForest(focusRoots, inPlan, …)` — so `inPlan` has already dropped every
 * iteration and every test-catalog row before this module sees them. Scanning it would
 * make two of the four non-plan cases unreportable: an `Iteration` or a `Test case`
 * carrying the property by hand would be invisible rather than refused, which is the
 * silent drop [[Setting an item's release]] 1f exists to prevent. `byPath` is the whole
 * set `assignAll` built, so the eligibility guard in `membershipTarget` is what refuses a
 * row — never the population it was never shown.
 *
 * `outsideFilter` rows ARE excluded, and that is the context-row rule rather than an
 * exception to this one: a row the Base excluded is never a source of anything derived
 * from the results.
 */
function scannableRows(model: BacklogModel): BacklogItem[] {
	return [...model.byPath.values()].filter((item) => !item.outsideFilter);
}

/**
 * The rank the model already parsed — `item.order`, not a second read of the cache.
 *
 * `readItems.ts:241` sets `order: readNumber(ownValue(fm, settings.orderKey))` from the
 * MAPPED order key, which is exactly the value this sort wants. Re-reading it here was
 * redundant and, worse, disagreed: `readNumber` uses `Number.parseFloat`, so `10 - first`
 * is rank 10 everywhere else in the plugin, while a `Number()` conversion makes it `NaN`
 * and drops the release to the undated tail. One value, parsed once, or the index orders
 * releases differently from every other screen.
 *
 * A release with no readable rank sorts after every release that has one, so the path
 * tie-break decides between them.
 */
function rank(item: BacklogItem): number {
	return item.order ?? Number.POSITIVE_INFINITY;
}

/** A civil date as a sortable integer; undated sorts last, never as the epoch. */
function dateKey(target: ReleaseFigure<CivilDate>): number {
	const d = target.value;
	if (d === null) return Number.POSITIVE_INFINITY;
	return d.year * 10000 + d.month * 100 + d.day;
}

export function releaseIndex(app: App, model: BacklogModel, settings: ReleaseSettings): ReleaseIndex {
	const byPath = new Map<string, number>();
	for (const release of model.releases) byPath.set(release.file.path, 0);
	const unresolved: BacklogItem[] = [];

	for (const item of scannableRows(model)) {
		const named = membershipTarget(app, item, model, settings);
		if (named === null) continue;
		if (named === UNRESOLVED) {
			unresolved.push(item);
			continue;
		}
		byPath.set(named, (byPath.get(named) ?? 0) + 1);
	}

	const rows = model.releases.map((item) => {
		const fm = app.metadataCache.getFileCache(item.file)?.frontmatter;
		return {
			item,
			path: item.file.path,
			name: item.file.basename,
			version: settings.versionKey ? figure(readLabel(ownValue(fm, settings.versionKey))) : UNCONFIGURED,
			target: settings.targetDateKey ? figure(readTarget(ownValue(fm, settings.targetDateKey))) : UNCONFIGURED,
			status: settings.statusKey ? figure(readLabel(ownValue(fm, settings.statusKey))) : UNCONFIGURED,
			members: settings.membershipKey
				? figure({ value: byPath.get(item.file.path) ?? 0, invalid: false })
				: UNCONFIGURED,
		};
	});

	rows.sort((a, b) => {
		// Values compared, never their difference — `Infinity - Infinity` is `NaN` and
		// `Infinity - n` is `Infinity`, and a comparator that returns either sorts at
		// random. Both keys below use the same shape for the same reason.
		if (dateKey(a.target) !== dateKey(b.target)) return dateKey(a.target) < dateKey(b.target) ? -1 : 1;
		// NOT `rank(a) - rank(b)` guarded by `Number.isFinite`: an unranked release is
		// `+Infinity`, and `Infinity - 10` is `Infinity`, which that guard rejects — so the
		// ranked release and the unranked one would fall through to the PATH tie-break
		// together, and a rank the vault states would decide nothing. Compare the values,
		// never their difference.
		if (rank(a.item) !== rank(b.item)) return rank(a.item) < rank(b.item) ? -1 : 1;
		// The final tie-break, and it is what makes the order STABLE across renders: two
		// releases sharing a date and a rank — or a vault with the order property unmapped,
		// where none of them has a rank at all — would otherwise sit in whatever order the
		// results arrived in.
		return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
	});

	return { rows, unresolved };
}
```

`membershipTarget` and the `UNRESOLVED` sentinel are Task 5's — write them there and import them here, or write them in this task and have Task 5 consume them. **Write them here**, at the bottom of this file, since the index needs the count before Task 5 exists:

```ts
/** Returned when a membership value exists but names no release this base holds. */
export const UNRESOLVED = Symbol('unresolved membership');

/**
 * Which release this item names: a path, `UNRESOLVED`, or null for "names none".
 *
 * THREE refusals, and each is a rule rather than a safeguard:
 *   - a value naming a note that is not a release,
 *   - two values at once — [[The scope of a release as a tree]] 1c: membership is one
 *     value, and reading a list as membership of each would make every writer in this
 *     epic destructive,
 *   - **a carrier that is not plan work.** [[Setting an item's release]] 1f requires this
 *     of the READER, not only of the writer: a release property hand-written onto a
 *     `Milestone`, an `Iteration`, another `Release` or a test-catalog note does not put
 *     it in the scope, "because a release holds work and those notes are not work".
 *     Refusing at one end only would let a hand-edit do what the menu will not — and this
 *     increment builds no menu, so the reader is the only end there is.
 */
export function membershipTarget(
	app: App,
	item: BacklogItem,
	model: BacklogModel,
	settings: ReleaseSettings,
): string | typeof UNRESOLVED | null {
	if (!settings.membershipKey) return null;
	const fm = app.metadataCache.getFileCache(item.file)?.frontmatter;
	const raw = ownValue(fm, settings.membershipKey);
	if (raw === null || raw === undefined) return null;
	if (Array.isArray(raw)) {
		if (raw.length === 0) return null;
		if (raw.length > 1) return UNRESOLVED;
	}
	const text = readString(raw);
	// PRESENT but unreadable — an empty string, an object, a list of objects — is
	// UNRESOLVED, never absent. `readString` answers null to all three exactly as it
	// answers null to a key the note does not carry, and collapsing them drops a
	// hand-written mistake in silence: the note HAS the key, so somebody wrote something
	// there. Only a missing key and an empty list mean "names none", and both are already
	// returned above.
	if (text === null || text.trim() === '') return UNRESOLVED;
	if (!inPlan(item) || isMarkerType(item.typeName)) return UNRESOLVED;
	const target = resolveReleasePath(app, item, text, model);
	return target ?? UNRESOLVED;
}

/**
 * The linkpath a membership value spells, resolved against the releases this base holds.
 *
 * **Obsidian's own resolution wins, and a resolved non-release is an answer, not a miss.**
 * An earlier draft fell back to a basename match whenever the resolved note was not a
 * release — so `[[R]]` resolving to a note called `R` that is an Epic would silently be
 * reassigned to a release called `R` in another folder. That is the view inventing a
 * membership the vault does not spell, and it is exactly extension 1b's case: the value
 * names something that is not a release, so it is UNRESOLVED and gets reported.
 *
 * The basename fallback survives only where Obsidian resolved NOTHING — the bare-name
 * spelling `resolveParent` already tolerates — and even there it refuses a tie: two
 * releases sharing a basename give no answer, because picking the first is arbitrary and
 * a release contract cannot rest on file order.
 */
function resolveReleasePath(app: App, item: BacklogItem, text: string, model: BacklogModel): string | null {
	const linkpath = linkpathFromRawValue(text);
	const file = app.metadataCache.getFirstLinkpathDest(linkpath, item.file.path);
	if (file !== null) {
		// Resolved: the answer is whether THAT note is a release. Never look further.
		return model.releases.some((r) => r.file.path === file.path) ? file.path : null;
	}
	const named = model.releases.filter((r) => r.file.basename.toLowerCase() === linkpath.toLowerCase());
	return named.length === 1 ? named[0].file.path : null;
}
```

Import `inPlan` and `linkpathFromRawValue`, plus `isMarkerType` from `./itemTypes`. **`isMarkerType` is not redundant beside `inPlan`, and this is the line to get right:** `inPlan` is `!inCatalog(item) && !isIterationType(item.typeName)`, so it excludes the test catalog and iterations while ADMITTING a `Milestone` and a `Release` — correct for the backlog tree, where both are drawn as rows, and wrong here. `isMarkerType` covers all three markers at once, so a fourth marker added later is refused without anyone having to remember this call site.

`app` is a parameter rather than a field read off the model: `BacklogModel` carries no `app` — `buildModel(app, entries, settings)` takes one and keeps none — so every reader that opens a file cache is handed it.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS all nine.

- [ ] **Step 5: Add the plan-work refusal test and watch it fail**

Add to `test/domain/releases.test.ts`:

```ts
	it('never reassigns a link Obsidian already resolved to a non-release', () => {
		const vault = new FakeVault();
		// An Epic named R, and a release ALSO named R one folder over. `[[R]]` resolves to
		// the Epic; reassigning it to the release would be a membership nobody wrote.
		vault.addFile('R.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Releases/R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[R]]' } });
		const { rows, unresolved } = indexOf(vault);
		expect(unresolved.map((i) => i.file.basename)).toEqual(['F']);
		expect(rows[0].members.value).toBe(0);
	});

	it('refuses a bare name two releases could answer to', () => {
		const vault = new FakeVault();
		vault.addFile('A/1.0.md', { frontmatter: { type: 'Release' } });
		vault.addFile('B/1.0.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '1.0' } });
		// Picking the first would make membership depend on file order.
		expect(indexOf(vault).unresolved.map((i) => i.file.basename)).toEqual(['F']);
	});

	it('refuses a membership property hand-written on a non-plan row', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('M.md', { frontmatter: { type: 'Milestone', release: '[[R]]' } });
		vault.addFile('I.md', { frontmatter: { type: 'Iteration', release: '[[R]]' } });
		vault.addFile('R2.md', { frontmatter: { type: 'Release', release: '[[R]]' } });
		vault.addFile('TC.md', { frontmatter: { type: 'Test case', release: '[[R]]' } });
		const { rows, unresolved } = indexOf(vault);
		expect(rows.find((r) => r.name === 'R')?.members.value).toBe(0);
		expect(unresolved.map((i) => i.file.basename).sort()).toEqual(['I', 'M', 'R2', 'TC']);
	});
```

Then comment out the `if (!inPlan(item) || …) return UNRESOLVED;` line, run the test, **watch it fail**, and restore it.

**This test is also what proves `scannableRows` is not `model.results`.** `results` is the plan projection, so `inPlan` has already removed the `Iteration` and the `Test case` before this module runs — scan it and the `I` and `TC` entries can never appear, however correct the guard is. Swap `scannableRows(model)` for `model.results` and watch those two vanish from the expectation: the guard refuses a row, and the population decides whether the row was ever offered to it. An invariant asserted in a comment gets a test that fails without it, and the test is watched failing — this repository has been bitten by confident comments over checks that asserted less than they read as.

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS with the line restored.

- [ ] **Step 6: Commit**

```bash
git add src/domain/releases.ts test/domain/releases.test.ts
git commit -m "Derive the release index, with membership refused at the reader"
```

---

### Task 5: `releases.ts` — one release's scope

**Files:**
- Modify: `src/domain/releases.ts`
- Test: `test/domain/releaseScope.test.ts`

**Interfaces:**
- Consumes: `membershipTarget`, `UNRESOLVED` (Task 4).
- Produces:

```ts
export interface ScopeRow { item: BacklogItem; depth: number; context: boolean }
export interface ReleaseScope { release: ReleaseRow | null; rows: ScopeRow[]; members: number }
export function releaseScope(app: App, model: BacklogModel, settings: ReleaseSettings, path: string): ReleaseScope
```

  Task 9 renders `ReleaseScope`.

- [ ] **Step 1: Write the failing test**

Create `test/domain/releaseScope.test.ts`. The two claims that carry the feature are **no cascade in either direction** and **a context ancestor carries no number**.

```ts
describe("one release's scope", () => {
	it('draws a member under a non-member ancestor, and marks the ancestor context', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.rows.map((r) => [r.item.file.basename, r.depth, r.context])).toEqual([
			['E', 0, true],
			['F', 1, false],
		]);
		expect(scope.members).toBe(1);
	});

	it('never inherits membership down a subtree', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', release: '[[R]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.members).toBe(1);
		expect(scope.rows.map((r) => r.item.file.basename)).toEqual(['E']);
	});

	it('draws a member whose ancestor is missing from the results at top level', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'Gone', release: '[[R]]' } });
		expect(scopeOf(vault, 'R.md').rows.map((r) => [r.item.file.basename, r.depth])).toEqual([['F', 0]]);
	});

	it('keeps a context ancestor even when its own state would hide it', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]' } });
		expect(scopeOf(vault, 'R.md').rows.map((r) => r.item.file.basename)).toEqual(['E', 'F']);
	});

	it('is empty, and says which release, when nothing names it', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.rows).toEqual([]);
		expect(scope.members).toBe(0);
		expect(scope.release?.name).toBe('R');
	});

	it('returns no release for a path that is gone', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		expect(scopeOf(vault, 'Vanished.md').release).toBeNull();
	});

	it('never draws a release as a row inside a release, excluded or not', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Other.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		// Filed UNDER the other release by hand, and a member of R.
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'Other', release: '[[R]]' } });
		const rows = scopeOf(vault, 'R.md').rows;
		// The marker draws no row AND does not take the member down with it. Asserting only
		// the absence of `Other` passes on an EMPTY list, which is the bug wearing the
		// test's own clothes, so the member's own row is asserted beside it.
		expect(rows.map((r) => r.item.file.basename)).not.toContain('Other');
		expect(rows.map((r) => [r.item.file.basename, r.depth])).toEqual([['F', 0]]);
	});

	it('marks a context ancestor that is itself in another release as context here', () => {
		const vault = new FakeVault();
		vault.addFile('R1.md', { frontmatter: { type: 'Release' } });
		vault.addFile('R2.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', release: '[[R2]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R1]]' } });
		const scope = scopeOf(vault, 'R1.md');
		expect(scope.rows.find((r) => r.item.file.basename === 'E')?.context).toBe(true);
		expect(scope.members).toBe(1);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/domain/releaseScope.test.ts`
Expected: FAIL — `releaseScope` is not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/releases.ts`:

```ts
export interface ScopeRow {
	item: BacklogItem;
	/** Depth within THIS tree, not the backlog's — the scope re-roots at its own members. */
	depth: number;
	/** True for an ancestor drawn only to keep a member in its place. */
	context: boolean;
}

export interface ReleaseScope {
	release: ReleaseRow | null;
	rows: ScopeRow[];
	members: number;
}

/**
 * The scope of one release: its members, and the ancestors that hold them in place.
 *
 * **Membership never cascades, in either direction.** An ancestor is scaffolding — not a
 * member, not counted, and marked as context so its number-free row is not read as a
 * zero. Inheriting down would put in the release work nobody named; inferring up would
 * put in it an Epic whose other children ship later.
 *
 * A context ancestor is drawn regardless of its own state: hiding it would break the
 * member's place, and it is scaffolding rather than something the reader asked to see.
 */
export function releaseScope(app: App, model: BacklogModel, settings: ReleaseSettings, path: string): ReleaseScope {
	const release = releaseIndex(app, model, settings).rows.find((row) => row.path === path) ?? null;
	if (release === null) return { release: null, rows: [], members: 0 };

	const members = new Set<string>();
	for (const item of scannableRows(model)) {
		if (membershipTarget(app, item, model, settings) === path) members.add(item.file.path);
	}

	// Every ancestor of a member, so a member keeps its place — **except a marker, which is
	// walked THROUGH rather than kept.**
	//
	// Two rules meet here and both say the same thing. `Releases as their own type` 4a: an
	// excluded release "never arrives as a context row" and "appears as no row anywhere" —
	// and because this plan keeps the hand-written parent edge, a member filed under a
	// release would otherwise drag that release in as a context ancestor, excluded or not.
	// And the model's own rule: `descendantCount` scores a marker 0 and traverses through
	// it, so a marker is never the thing that holds a row in place; the real ancestor above
	// it is. Keeping one here would draw a release inside a release's own scope.
	const keep = new Set(members);
	for (const item of scannableRows(model)) {
		if (!members.has(item.file.path)) continue;
		for (let up = item.parent; up !== null; up = up.parent) {
			if (isMarkerType(up.typeName)) continue;
			keep.add(up.file.path);
		}
	}

	const rows: ScopeRow[] = [];
	const walk = (item: BacklogItem, depth: number): void => {
		// A row that is not kept is walked THROUGH, never stopped at. A member filed under a
		// marker — the hand-written parent edge this plan deliberately keeps — has that
		// marker as an ancestor, and a marker is never kept; returning here would drop the
		// MEMBER along with it while the header went on counting it, so the scope and the
		// index would disagree about one release. That is the one defect this module exists
		// to prevent. Descending without drawing it leaves the depth alone too, so the
		// member re-roots at the level the marker occupied.
		const kept = keep.has(item.file.path);
		if (kept) rows.push({ item, depth, context: !members.has(item.file.path) });
		for (const child of item.children) walk(child, kept ? depth + 1 : depth);
	};
	// From the model's REAL roots, not its rendered ones: a focus level set on the backlog
	// view must not decide what a release's scope contains.
	for (const root of model.realRoots) walk(root, 0);

	return { release, rows, members: members.size };
}
```

A member whose ancestor is absent from the results is an orphan in the model — it is already one of `realRoots`, so the walk reaches it at depth 0 with no extra branch. Verify that against `model.ts`'s orphan handling before assuming it; if orphans are not roots, add them explicitly after the walk.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/releaseScope.test.ts`
Expected: PASS all eight.

- [ ] **Step 5: Commit**

```bash
git add src/domain/releases.ts test/domain/releaseScope.test.ts
git commit -m "Derive one release's scope, with ancestors as context"
```

---

### Task 6: the picked release as view state

**Files:**
- Modify: `src/storage/viewStateStore.ts` (`ViewPrefs.release`, `PREF_READERS.release`)
- Test: `test/storage/viewStateStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ViewPrefs.release?: string` — a note path. Task 7 reads and writes it through `loadViewState` / `saveViewState`.

- [ ] **Step 1: Write the failing test**

The precedent to copy is `scope`, already in `PREF_READERS` as `anyName` and documented there: a path is checked by resolving it against the vault, which this layer cannot do and which the view redoes on every render anyway.

Add to `test/storage/viewStateStore.test.ts`:

```ts
it('round-trips the picked release, and refuses a value of the wrong shape', () => {
	saveViewState(app, id, { ...empty, prefs: { release: 'Releases/0.8.md' } });
	expect(loadViewState(app, id).prefs.release).toBe('Releases/0.8.md');

	saveViewState(app, id, { ...empty, prefs: { release: 42 as never } });
	expect(loadViewState(app, id).prefs.release).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/storage/viewStateStore.test.ts -t "picked release"`
Expected: FAIL — the pref is dropped by `readPrefs`, which only keeps keys `PREF_READERS` names.

- [ ] **Step 3: Add the pref**

In `src/storage/viewStateStore.ts`, in `ViewPrefs`:

```ts
	/**
	 * The release whose screen is open, as a note path — absent when the index is showing.
	 * A working position, per device and per saved view, never a `.base` setting
	 * ([[Settings scoped to their view]]).
	 */
	release?: string;
```

In `PREF_READERS`, beside `scope`:

```ts
	// `anyName`, for `scope`'s own stated reason: a path is checked by RESOLVING it against
	// the vault, which this layer cannot do. A remembered release that has moved or been
	// deleted returns the index, which the view decides on render — not a failure.
	release: anyName,
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/storage/viewStateStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/viewStateStore.ts test/storage/viewStateStore.test.ts
git commit -m "Remember which release is open, per device and per saved view"
```

---

### Task 7: the view, its registration, and its empty states

**Files:**
- Create: `src/view/release/releaseView.ts`
- Create: `src/view/release/register.ts`
- Create: `styles/release.css`
- Modify: `styles/index.css` (the import)
- Modify: `src/main.ts` (one registration call)
- Modify: `src/i18n/en.ts`
- Create: `test/helpers/release.ts` (the harness)
- Test: `test/view/releaseView.test.ts`

**Interfaces:**
- Consumes: `resolveReleaseSettings` (Task 3), `releaseIndex` / `releaseScope` (Tasks 4-5), `ViewPrefs.release` (Task 6), `guidanceShell` from `src/view/render/emptyStates.ts`.
- Produces:
  - `RELEASE_VIEW_TYPE = 'product-release'`
  - `class ReleaseView extends BasesView` with `settings: ReleaseSettings`, `pickedPath: string | null`, `viewEl: HTMLElement`, `pick(path: string | null): void`
  - `registerReleaseView(plugin: Plugin): void`

  Tasks 8 and 9 render into `view.viewEl` and call `view.pick`.

- [ ] **Step 1: Write the failing test**

Create `test/view/releaseView.test.ts`, driving the two unconfigured states apart — the whole point is that they are different answers.

```ts
describe('the release view', () => {
	useViewHarness();

	it('says which option to bind when no type property is mapped', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: '' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('type property');
		expect(containerEl.querySelector('.pbl-rel-grid')).toBeNull();
	});

	it('draws an empty list, not a warning, when the base holds no release', () => {
		const vault = new FakeVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: 'note.type' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		// No create button on THIS view. The backlog toolbar's own New menu still offers
		// `New Release`, which is a different view's existing creator and is asserted there.
		expect(containerEl.querySelector('.pbl-empty button')).toBeNull();
	});

	it('opens the index with nothing picked, and a release once one is', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-rel-grid')).toBeNull();
	});

	it('leaves nothing behind when the view unloads', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-view')).not.toBeNull();
		view.onunload();
		// The container is Bases', and it is reused by whatever view comes next.
		expect(containerEl.querySelector('.pbl-rel-view')).toBeNull();
	});

	it('keeps a session-only pick across a data update in an embedded base', () => {
		const vault = releaseVault();
		// No `base`, so `mountLeaf` builds no leaf and `resolveViewIdentity` answers null —
		// the embedded case, where the pick is session-only rather than absent.
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('0.8.md');
		view.onDataUpdated();
		expect(view.pickedPath).toBe('0.8.md');
		expect(containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
	});

	it('returns to the index when the remembered release is gone', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('Vanished.md');
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/releaseView.test.ts`
Expected: FAIL — the view and the harness do not exist.

- [ ] **Step 3: Write the harness**

Create `test/helpers/release.ts`, narrowed from `test/helpers/estimation.ts` — no lock, because this view has no writer:

```ts
import { ReleaseView } from '../../src/view/release/releaseView';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig, mountLeaf } from './vault';

installObsidianDom();

export interface ReleaseHarness {
	view: ReleaseView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * `makeEstimationView`'s shape minus the `WriteLock`: this view writes nothing, so there
 * is nothing to serialize and no undo slot to share. A lock parameter here would suggest
 * otherwise.
 */
export function makeReleaseView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ base, viewName }: { base?: string; viewName?: string } = {},
): ReleaseHarness {
	const containerEl = mountLeaf(vault, base);
	const view = new ReleaseView({} as never, containerEl);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	return { view, config, containerEl };
}

/** Re-exported so a release suite takes its clicks from one place, the way the estimation
 *  suites do. `flush`, `key` and `useViewHarness` come from `./view`. */
export { click } from './estimation';

/** Every key bound — what a fully configured vault looks like. */
export const RELEASE_CONFIG = {
	typeProperty: 'note.type',
	parentProperty: 'note.parent',
	orderProperty: 'note.order',
	membershipProperty: 'note.release',
	versionProperty: 'note.version',
	targetDateProperty: 'note.target-date',
	releaseStatusProperty: 'note.status',
};

/** Three releases: two dated, one not — the index's ordering fixture. */
export function releaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('0.8.md', {
		frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress' },
	});
	vault.addFile('0.9.md', {
		frontmatter: { type: 'Release', version: '0.9.0', 'target-date': '2026-10-24', status: 'Planned' },
	});
	vault.addFile('Someday.md', { frontmatter: { type: 'Release', status: 'Idea' } });
	return vault;
}

/** One release, one member, and a non-member ancestor above it — the context-row case. */
export function scopeVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('F.md', {
		frontmatter: { type: 'Feature', parent: '[[E]]', release: '[[R]]' },
		parentLink: 'E',
	});
	return vault;
}
```

**Read `test/CLAUDE.md`'s `addFile` bullet before touching those fixtures.** Whether a parent value is bracketed and whether it resolves are two separate questions, and they decide different things: `[[E]]` beside a real `E.md` is indexed, so it needs `parentLink: 'E'` AND the brackets in `frontmatter`; a bare `parent: E` is never indexed and goes into `frontmatter` alone. Getting it backwards builds a metadata cache Obsidian would never hand out, which has already cost this repository a real bug.

The membership values (`release: '[[R]]'`) are read by `membershipTarget` through `getFirstLinkpathDest`, not through `frontmatterLinks`, so they need no `parentLink` wiring — but check that assumption against `readLinkList`'s own tests before relying on it, and if the resolution path does read the cache, wire them the same way.

- [ ] **Step 4: Write the view**

Create `src/view/release/releaseView.ts`. Keep it under 400 lines — the two render modules are Tasks 8 and 9, and this file only decides which one runs.

```ts
import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogModel, buildModel } from '../../domain/model';
import { ReleaseSettings, resolveReleaseSettings } from '../../domain/releaseOptions';
import { releaseIndex, releaseScope } from '../../domain/releases';
import { resolveSettings } from '../../domain/settingsResolve';
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';
import { guidanceShell } from '../render/emptyStates';
import { renderIndex } from './renderIndex';
import { renderScope } from './renderScope';

export const RELEASE_VIEW_TYPE = 'product-release';

/**
 * The release view: the plugin's third Bases view, and the first that WRITES NOTHING.
 *
 * There is no `WriteGate` and no `WriteLock` here, and their absence is the design rather
 * than an omission. The lock exists to serialize writers (ADR 0030); a view with no writer
 * has nothing to serialize, and holding one would suggest otherwise. Every write rule the
 * register states — the `configProblems` gate, the context-row refusal, capture before the
 * await — is about a batch this view never plans.
 *
 * Its entry point is the INDEX, not one release: with nothing picked it lists every
 * release the results hold, and picking a row opens that release's screen. Which release
 * is open is view state, per device and per saved view.
 */
export class ReleaseView extends BasesView {
	type = RELEASE_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: ReleaseSettings;
	/** The open release's path, or null for the index. Restored on mount, saved on every pick. */
	pickedPath: string | null = null;
	model: BacklogModel | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-rel-view' });
	}

	/**
	 * Both existing Bases views detach their own element on unload, and this one has as
	 * much reason to: `viewEl` is a child appended to a container Bases owns and reuses, so
	 * a saved Base switching away from this view — or its leaf closing — would otherwise
	 * leave the old shell, and every row listener on it, attached under the next view.
	 *
	 * No gate to dispose and no observers to disconnect, unlike the other two: this view
	 * holds neither.
	 */
	onunload(): void {
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.settings = resolveReleaseSettings(this.config);
		this.restorePick();
		this.render();
	}

	/** Picking a row, or the back control's null. Persists, then redraws. */
	pick(path: string | null): void {
		this.pickedPath = path;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) {
			const state = loadViewState(this.app, id);
			saveViewState(this.app, id, { ...state, prefs: { ...state.prefs, release: path ?? undefined } });
		}
		this.render();
	}

	/**
	 * Restore the pick from the store — and LEAVE THE FIELD ALONE when there is no identity
	 * to restore from.
	 *
	 * `resolveViewIdentity` returns null for an embedded Base on purpose, which means the
	 * pick is session-only there rather than absent. Assigning `null` in that branch would
	 * reset it on every `onDataUpdated`, so any Bases refresh would throw a reader who had
	 * opened a release straight back to the index. The estimation view's own session-only
	 * sort pick keeps the field for exactly this reason.
	 */
	private restorePick(): void {
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (!id) return;
		this.pickedPath = loadViewState(this.app, id).prefs.release ?? null;
	}

	render(): void {
		this.viewEl.empty();
		// The three model mappings are this view's own (`releaseOptions.ts`). Without a type
		// key nothing can be recognised as a release at all, so this is a configuration to
		// fix — a different answer from a base that simply holds no release yet.
		if (!this.settings.typeKey) {
			guidanceShell(this.viewEl, 'settings-2', t('release.empty.noType.title'), t('release.empty.noType.hint'));
			return;
		}
		// The model is built with THIS view's three mappings, not the backlog resolver's.
		// `resolveSettings` reads them through `propKey`, which cannot tell a cleared option
		// from an unset one — so a parent property this view reports as unbound would come
		// back as `parent` here, and the scope would go on nesting rows by a mapping the
		// options screen says is off. Two resolvers disagreeing at the model boundary is
		// the same defect as one view reading another's configuration.
		this.model = buildModel(this.app, this.data.data, {
			...resolveSettings(this.config),
			typeKey: this.settings.typeKey,
			parentKey: this.settings.parentKey,
			orderKey: this.settings.orderKey,
		});
		if (this.model.releases.length === 0) {
			// No create button ON THIS VIEW: no use case in this epic specifies creating a
			// release, and an empty state must not promise a write nothing defines. The
			// backlog toolbar's New menu does offer `New Release` — deliberately, the way it
			// offers `New Milestone` — and that is a different view's existing writer.
			guidanceShell(this.viewEl, 'package', t('release.empty.noReleases.title'), t('release.empty.noReleases.hint'));
			return;
		}
		const scope =
			this.pickedPath === null ? null : releaseScope(this.app, this.model, this.settings, this.pickedPath);
		// A remembered release that no longer exists returns the INDEX, silently. A working
		// position that has gone is not a failure and must not raise one.
		if (scope === null || scope.release === null) {
			renderIndex(this, releaseIndex(this.app, this.model, this.settings));
			return;
		}
		renderScope(this, scope);
	}
}
```

Check `guidanceShell`'s real signature in `src/view/render/emptyStates.ts` before calling it — it returns the shell so a caller can add one action, and its parameter order may differ from the call above. Do not hand-roll the four class names; that drift is exactly why it was exported.

- [ ] **Step 5: Register it**

Create `src/view/release/register.ts`:

```ts
import { Plugin } from 'obsidian';
import { getReleaseViewOptions } from '../../domain/releaseOptions';
import { RELEASE_VIEW_TYPE, ReleaseView } from './releaseView';
import { t } from '../../i18n/t';

/**
 * The release view's own registration — one file per view, so a third capability adds a
 * file rather than a branch in main (ADR 0030).
 *
 * No `WriteLock` parameter, unlike `registerEstimationView`: this view plans no batch, so
 * there is nothing for a lock to serialize and no undo slot to share. Threading one in
 * "for symmetry" would state a relationship that does not exist.
 */
export function registerReleaseView(plugin: Plugin): void {
	plugin.registerBasesView(RELEASE_VIEW_TYPE, {
		// An ordinary view-type label, so it is translated — only the plugin's own identity
		// in `registerBacklogView.ts` gets the eslint-disable.
		name: t('release.viewName'),
		icon: 'lucide-package',
		factory: (controller, containerEl) => new ReleaseView(controller, containerEl),
		options: getReleaseViewOptions,
	});
}
```

In `src/main.ts`, beside the other two:

```ts
		registerReleaseView(this);
```

- [ ] **Step 6: Add the stylesheet partial**

Create `styles/release.css` with the rules the harness mock proved out. Start from the `SHEET` constant in `test/harness/mock.ts` if it is still on disk — it was written against the real assembled stylesheet for exactly this. Add the import to `styles/index.css`, and state in a comment whether the position is load-bearing (it is not: nothing else selects `.pbl-rel-*`).

- [ ] **Step 7: Add the catalog keys**

```ts
	'release.viewName': 'Product release',
	'release.empty.noType.title': 'No type property is mapped',
	'release.empty.noType.hint':
		'This view reads each note’s type to find the releases. Bind the type property in the view options.',
	'release.empty.noReleases.title': 'No releases in this base',
	'release.empty.noReleases.hint':
		'A release is a note typed Release, carrying a version and a target date. Add one to the vault and it appears here.',
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/releaseView.test.ts`
Expected: PASS. Tasks 8 and 9 supply `renderIndex` and `renderScope`; stub each as a one-line function that creates `.pbl-rel-grid` / `.pbl-rel-header` so this task's tests pass on their own, and replace them next.

- [ ] **Step 9: Commit**

```bash
git add src/view/release/ src/main.ts src/i18n/en.ts styles/release.css styles/index.css test/helpers/release.ts test/view/releaseView.test.ts
git commit -m "Register the release view, writing nothing"
```

---

### Task 8: `renderIndex.ts`

**Files:**
- Create: `src/view/release/renderIndex.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/view/releaseIndex.test.ts`

**Interfaces:**
- Consumes: `ReleaseIndex`, `ReleaseRow`, `ReleaseFigure` (Task 4); `ReleaseView.pick` (Task 7).
- Produces: `renderIndex(view: ReleaseView, index: ReleaseIndex): void`.

- [ ] **Step 1: Write the failing test**

```ts
describe('the release index', () => {
	useViewHarness();

	it('draws one row per release, in the domain module’s order', () => {
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const names = [...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent);
		expect(names).toEqual(['0.8', '0.9', 'Someday']);
	});

	it('opens a release when its row is clicked', () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-row[data-path="0.8.md"]') as HTMLElement);
		expect(view.pickedPath).toBe('0.8.md');
	});

	it('names an unconfigured column ONCE, and never blanks it per row', () => {
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, versionProperty: '' });
		expect(containerEl.querySelectorAll('.pbl-rel-version')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-rel-note')).toHaveLength(1);
	});

	it('says unreadable rather than absent when somebody wrote something there', () => {
		const vault = releaseVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'Release', 'target-date': 'soon' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const row = containerEl.querySelector('.pbl-rel-row[data-path="Bad.md"]') as HTMLElement;
		expect(row.querySelector('.pbl-rel-unreadable')).not.toBeNull();
	});

	it('reports the unresolved once, beneath the rows', () => {
		const vault = releaseVault();
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', release: '[[Nothing]]' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-unresolved')?.textContent).toContain('1');
	});

	it('plans no write', async () => {
		const vault = releaseVault();
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-row') as HTMLElement);
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/releaseIndex.test.ts`
Expected: FAIL — the stub from Task 7 draws no rows.

- [ ] **Step 3: Implement**

Replace the Task 7 stub with `src/view/release/renderIndex.ts`. Draw the grid the mock settled: a five-column CSS grid, cells as `display: contents` rows so one divider spans the row, figures right-aligned with `tabular-nums`. Every string through `t()`. Rows carry `data-path` so a test addresses one by path rather than by position.

Key points a newcomer will not infer:
- **A column whose key is unconfigured is absent for every row and named once** in a `.pbl-rel-note` line beneath the grid — never an empty cell per row.
- **A row's `.pbl-state-chip` also carries `.pbl-state-static`.** This view is read-only, so every chip on it is the static one — the same div a context row already renders. It draws grey: `--pbl-state-color` is consumed by the legend and the card projections, not by a row chip.
- Sort order comes from `releaseIndex` and is never re-sorted here. One denominator, one predicate, one answer.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/view/releaseIndex.test.ts`
Expected: PASS all six.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/renderIndex.ts src/i18n/en.ts test/view/releaseIndex.test.ts
git commit -m "Draw the index of every release"
```

---

### Task 9: `renderScope.ts`

**Files:**
- Create: `src/view/release/renderScope.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/view/releaseScopeRender.test.ts`

**Interfaces:**
- Consumes: `ReleaseScope`, `ScopeRow` (Task 5); `ReleaseView.pick` (Task 7); `badgeStyleFor` from `src/view/render/badges.ts`.
- Produces: `renderScope(view: ReleaseView, scope: ReleaseScope): void`.

- [ ] **Step 1: Write the failing test**

```ts
describe("a release's scope on screen", () => {
	useViewHarness();

	it('indents by its own depth and marks context rows', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		const rows = [...containerEl.querySelectorAll('.pbl-row')];
		expect(rows.map((el) => el.getAttribute('style'))).toContain('--pbl-depth: 1;');
		expect(rows[0].classList.contains('pbl-rel-context')).toBe(true);
	});

	it('gives a context row no state chip and no count', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		const context = containerEl.querySelector('.pbl-rel-context') as HTMLElement;
		expect(context.querySelector('.pbl-state-chip')).toBeNull();
		expect(context.querySelector('.pbl-outside-marker')).not.toBeNull();
	});

	it('states the member count, which excludes every context row', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-facts')?.textContent).toContain('1');
	});

	it('returns to the index from the back control', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		click(containerEl.querySelector('.pbl-rel-back') as HTMLElement);
		expect(view.pickedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
	});

	it('says an empty release is empty, and names it', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('R');
	});

	it('draws no tree and names the option when membership is unconfigured', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), { ...RELEASE_CONFIG, membershipProperty: '' });
		view.pick('R.md');
		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-empty-hint')?.textContent).toContain('membership');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/releaseScopeRender.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/view/release/renderScope.ts`: a `.pbl-rel-header` (back control, name, version, status chip, target and member count in `.pbl-rel-facts`), then a `.pbl-tree` of `.pbl-row` elements.

Its own read-only rows, **not** `src/view/render/rows.ts` — that module takes a `BacklogViewHost` and wires menus, create prompts, tag removal and drag into every row, none of which a read-only screen has. Reuse the *stylesheet* classes (`.pbl-row`, `.pbl-badge`, `.pbl-title`, `.pbl-state-chip.pbl-state-static`, `.pbl-outside-marker`) and `badgeStyleFor` for the icon and badge class.

Set indentation with `setCssProps({ '--pbl-depth': String(row.depth) })` — never an inline `style` attribute, which the marketplace rules ban.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/view/releaseScopeRender.test.ts`
Expected: PASS all six.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/renderScope.ts src/i18n/en.ts test/view/releaseScopeRender.test.ts
git commit -m "Draw one release's scope as the tree it already is"
```

---

### Task 10: the invariant, the register, and the gate

The increment's central claim — **this view writes nothing** — is a category claim, so it is checked at the forbidden call rather than by listing the paths someone thought of.

**Files:**
- Test: `test/view/releaseWritesNothing.test.ts`
- Modify: `test/i18n/projections.test.ts`
- Modify: `docs/requirements/The scope of a release as a tree.md` (`## Where it lives`)
- Modify: `docs/requirements/Releases as their own type.md` (`## Where it lives`)
- Modify: `docs/requirements/Every release in one list.md` (`## Where it lives`)
- Modify: `CHANGELOG.md`
- Modify: `vitest.config.mts` (coverage thresholds, upward only)

- [ ] **Step 1: Write the invariant test**

```ts
import * as frontmatter from '../../src/storage/frontmatter';
import * as createNote from '../../src/storage/createNote';
import * as propertyWrite from '../../src/storage/propertyWrite';

describe('the release view writes nothing', () => {
	useViewHarness();

	it('reaches no write entry point, from any interaction on either screen', async () => {
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const createBacklogItem = vi.spyOn(createNote, 'createBacklogItem');
		const applyPropertyWrites = vi.spyOn(propertyWrite, 'applyPropertyWrites');

		const vault = scopeVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		// Every input either screen offers: a row click, the back control, a keypress on a
		// row, a right-click, and a redraw after each.
		click(containerEl.querySelector('.pbl-rel-row') as HTMLElement);
		await flush();
		containerEl.querySelector('.pbl-row')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		key(containerEl.querySelector('.pbl-row') as HTMLElement, 'Enter');
		click(containerEl.querySelector('.pbl-rel-back') as HTMLElement);
		await flush();
		view.pick('R.md');
		await flush();

		expect(applyWrites).not.toHaveBeenCalled();
		expect(createBacklogItem).not.toHaveBeenCalled();
		expect(applyPropertyWrites).not.toHaveBeenCalled();
		// The spies are the check; this is the belt, and it fails for a write path that
		// reached the vault without going through any of the three.
		expect(vault.writeLog).toEqual([]);
	});
});
```

- [ ] **Step 2: Watch it fail**

Temporarily add a `this.app.fileManager.processFrontMatter(...)` call to `renderIndex.ts`, run the test, **watch `vault.writeLog` catch it**, then remove the call. A test that has never been seen red is a comment.

Run: `npx vitest run test/view/releaseWritesNothing.test.ts`
Expected: PASS after the temporary call is removed.

- [ ] **Step 3: Extend the i18n projection test**

In `test/i18n/projections.test.ts`, drive the release view — both screens — with the whole catalog marked, and assert that what renders unmarked is data (a type name, a property key, a note title, a version string). This is the check that scales: a per-slice list of keys checks the ones somebody remembered.

Run: `npx vitest run test/i18n/`
Expected: PASS.

- [ ] **Step 4: Correct the register**

Three `## Where it lives` sections currently describe code that will not exist:

- `Releases as their own type.md` — change "declared in `src/domain/viewOptions.ts`" to `src/domain/releaseOptions.ts`, and name `src/domain/typeVocabulary.ts`, `src/domain/itemTypes.ts` and `src/domain/model.ts`.
- `The scope of a release as a tree.md` — change "The rows reuse `src/view/render/rows.ts`" to `src/view/release/renderScope.ts`, and say why: that module takes a `BacklogViewHost` and wires the very actions a read-only screen excludes. Name `src/domain/releases.ts` for the derivation.
- `Every release in one list.md` — name `src/view/release/renderIndex.ts` and `src/domain/releases.ts`, and `src/storage/viewStateStore.ts` for the picked release.

Every module created in Tasks 3-9 must appear in one of these, or `npm run docs` fails rule 7.

- [ ] **Step 5: Add the changelog entry**

Under `## [Unreleased]` in `CHANGELOG.md`:

```markdown
### Added

- A release view (`product-release`): every release in the base as one list, and one
  release's scope drawn as the tree it already is. Read-only — it plans no write.
- `Release` joins the fixed type vocabulary as a marker, beside `Milestone` and `Iteration`.
```

- [ ] **Step 6: Run the whole gate**

Run: `npm run check`
Expected: PASS all five steps. If coverage thresholds moved up, commit the raised numbers — they only ever go up.

- [ ] **Step 7: Look at it, and say what is still owed**

Run: `npm run harness` and open the page; then `npm run test-build` and open this repository as a vault, with `docs/Product Backlog.base`, to see the view against real Bases and a real theme.

Neither replaces the other and neither is a test. Report honestly what was checked in a live vault and what was not — a themed vault's colours, its accent, and anything Bases hands the view are unanswerable in the harness.

- [ ] **Step 8: Commit**

```bash
git add test/ docs/ CHANGELOG.md vitest.config.mts
git commit -m "Check that the release view writes nothing, and correct the register"
```

---

## Self-review notes

**Spec coverage.** Every section of the design maps to a task: the fixed type (1), the model collection (2), the seven option keys (3), the index with its ordering and three-way figures (4, 8), the scope with context ancestors and plan-work eligibility (5, 9), the picked release as view state (6), registration and both empty states (7), and the write-nothing invariant plus the register corrections (10).

**Two questions this plan opened and then closed against the source, rather than leaving them for the implementer to trip over:**

1. `BacklogModel` carries no `app` — `buildModel(app, entries, settings)` takes one and keeps none — so `releaseIndex` and `releaseScope` take it as their first parameter. Every signature and call site in Tasks 4, 5 and 7 spells it that way.
2. `inPlan` is `!inCatalog(item) && !isIterationType(item.typeName)`, so it **admits a `Milestone` and a `Release`**. The membership guard is therefore `!inPlan(item) || isMarkerType(item.typeName)`, never `isReleaseType` alone. Getting this wrong is the P2 finding on the design PR walking straight back in, so Task 4 Step 5 makes it a watched-failing test rather than a comment.

**One judgement past the register**, flagged in the spec and repeated here: a non-plan row carrying the membership property is *reported* with the unresolved rather than dropped silently. `Setting an item's release` 1f says refuse and says nothing about saying so. If review cuts the reporting half, Task 4's `membershipTarget` returns `null` for that case instead of `UNRESOLVED`, and one assertion in Task 4 Step 5 changes.
