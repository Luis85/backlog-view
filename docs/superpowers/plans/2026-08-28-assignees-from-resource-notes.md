# Assignees from the resource notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assignee vocabulary becomes the `Resource` notes the base returned, an item names one by wikilink, and a resource can be created from the assignee menu.

**Architecture:** `readItems`' existing resource gate stops discarding and diverts onto the model, the shape `divertAbsence` already has one line above it. The assignee property is then read by the shared link reader and written by a new `applyLinks` that collapses the two link writers already in `storage/frontmatter.ts`. The roadmap's rows become those notes, keyed by path, and every name-based source of a row is deleted.

**Tech Stack:** TypeScript, Obsidian Bases API (floor 1.12.0), vitest (node + jsdom), eslint, fallow, `scripts/docs-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-28-assignees-from-resource-notes-design.md`

## Global Constraints

- `npm run check` must pass before every commit — build, lint, coverage-thresholded tests, fallow, docs register. Coverage thresholds in `vitest.config.mts` only ever go up.
- Layering (`eslint.config.mjs` `no-restricted-imports`): `main → commands → view → storage → domain`; `ui/` and `i18n/` import none of them.
- 400-line max per `src/` file; 450-line max per `test/` file.
- Every module in `src/` must be specified in `docs/` — a use case's `## Where it lives` or an ADR's `## Decision`. `test/` is exempt.
- Every user-facing sentence goes through `t()` — `src/i18n/en.ts` is data, no imports and no logic. `view/`, `ui/`, `storage/`, `domain/viewOptions.ts`, `domain/roadmap.ts` are swept directories, so an English literal there fails lint.
- Frontmatter is written only from `src/storage/`. Every write path goes through the `configProblems` gate.
- An `outsideFilter` row is never a write target, never a ranking peer, and never a source of anything derived from the results.
- A Set menu's checkmark is asked of the PLAN — an entry is checked exactly when picking it would write nothing.
- **Breaking, with no migration**: a note carrying `assignee: Sarah` names nobody after this. Stated in [[Resource Management]] and [[No migration off the string assignees]].

---

### Task 1: The model keeps the resources it already refuses

**Files:**
- Modify: `src/domain/readItems.ts` — `RawStore`, the `isResourceType` gate in `addItem`, a new `divertResource`
- Modify: `src/domain/model.ts` — `BacklogModel.resources`, populated in `buildModel`
- Test: `test/domain/resourceRoster.test.ts` (create)

**Interfaces:**
- Consumes: `isResourceType` (`src/domain/itemTypes.ts`), `RawStore`, `divertAbsence`'s shape.
- Produces:
  ```ts
  /** A `Resource` note the base returned — never an item, and the whole of the roster. */
  export interface ResourceNote {
      file: TFile;
      /** The note's own basename, which is the person's name. */
      title: string;
  }
  ```
  `RawStore.resources: ResourceNote[]` and `BacklogModel.resources: ResourceNote[]`, sorted by `title` through `localeCompare`.

- [ ] **Step 1: Write the failing test**

Create `test/domain/resourceRoster.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * `hierarchyOnly` OFF on purpose — that is the vault where every note a folder-scoped
 * base returns becomes an item, so the divert is what refuses a resource rather than the
 * scope prune. With it on, a check written without this case passes with the gate deleted.
 */
const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });

/** What the Base returned, when it did not return everything. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

describe('the roster the model keeps', () => {
	it('keeps every Resource note the base returned, alphabetically, and makes no item of one', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.resources.map((r) => r.title)).toEqual(['Alex', 'Sam']);
		expect(model.all.map((i) => i.title)).toEqual(['Epic A']);
	});

	it('keeps no resource the base did not return', () => {
		// A result naming a resource as its parent pulls that note in through
		// `loadOutsideParents` with no entry. It is not this base's vocabulary, so it is
		// not a row, not a menu entry and not a drop target.
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 }, parentLink: 'Alex' });
		const model = buildModel(vault.app, only(vault, 'Epic A.md'), settings);

		expect(model.resources).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/resourceRoster.test.ts`
Expected: FAIL — `model.resources` is undefined.

- [ ] **Step 3: Divert instead of discarding**

In `src/domain/readItems.ts`, add to `RawStore` beside `absences`:

```ts
	/**
	 * The `Resource` notes diverted before they could become items — `absences`' own
	 * shape and its own reason. Beside the items rather than among them: nothing that
	 * walks the tree, ranks siblings, counts a rollup or draws a projection may meet one.
	 */
	resources: ResourceNote[];
```

Initialise it in `createItems` (`{ all: [], byPath: new Map(), absences: [], resources: [] }`), and replace the `isResourceType` early return:

```ts
	if (isResourceType(typeName)) return divertResource(store, file, entry);
```

Add the divert beside `divertAbsence`:

```ts
/**
 * Keep who a resource IS and produce no item — `divertAbsence`'s shape, out of line so
 * `addItem` stays under its complexity budget.
 *
 * Always null, which is `addItem`'s own "no ancestor to seed": a resource has no parent,
 * so it can never pull one in and `loadOutsideParents` must never be handed one.
 *
 * A note the base never RETURNED keeps nothing, and that is the context-row rule rather
 * than a rule of this roster: an `outsideFilter` note is never a source of anything
 * derived from the results. One can still arrive here — a result naming a resource as its
 * parent pulls it in through `loadOutsideParents` — and a row, a menu entry or a drop
 * target minted from it would be a target the user cannot act on.
 */
function divertResource(store: RawStore, file: TFile, entry: BasesEntry | null): null {
	if (entry !== null) store.resources.push({ file, title: file.basename });
	return null;
}
```

Export the interface from the same file, above `RawStore`:

```ts
/** A `Resource` note the base returned — never an item, and the whole of the roster. */
export interface ResourceNote {
	file: TFile;
	/** The note's own basename, which is the person's name. */
	title: string;
}
```

- [ ] **Step 4: Carry it onto the model**

In `src/domain/model.ts`, add to `BacklogModel` beside `absences`:

```ts
	/**
	 * The `Resource` notes the base returned, sorted by name — the roster the assignee
	 * menu offers and the roadmap draws a row per. Never items: see `readItems`'
	 * `divertResource`.
	 */
	resources: ResourceNote[];
```

and populate it where `absences: store.absences` is set:

```ts
		// Sorted through `localeCompare` — the collation `collectObservedAssignees`
		// already uses, which follows the USER's locale because a name is data.
		resources: [...store.resources].sort((a, b) => a.title.localeCompare(b.title)),
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run test/domain/resourceRoster.test.ts`
Expected: PASS, both cases.

- [ ] **Step 6: Full check and commit**

```bash
npm run check
git add -A && git commit -m "Keep the resource notes the base returned"
```

If `npm run docs` fails on rule 7, no module is newly unspecified — Task 8 does the register. If it fails for another reason, fix it before committing.

---

### Task 2: The assignee is read as a link

**Files:**
- Modify: `src/domain/readItems.ts` — `RawItem.assigneeEntry`, read through `readFirstLinkEntry`
- Modify: `src/domain/model.ts` — the derived display name, if `BacklogItem` restates the field
- Modify: `src/view/render/chips.ts` — `LABEL_CHIPS.assignee.valueOf`
- Test: `test/domain/resourceRoster.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's `ResourceNote`; `readFirstLinkEntry(app, file, cache, key)` and `LinkEntry { raw: string; file: TFile | null }` (`src/domain/noteFields.ts`).
- Produces: `RawItem.assigneeEntry: LinkEntry | null`, and
  ```ts
  /** The name to SHOW for an item's assignee: the resolved note's own title, else the raw text, else nobody. */
  export function assigneeName(item: { assigneeEntry: LinkEntry | null }): string | null;
  ```
  in `src/domain/readItems.ts`. `assigneeValue` is deleted; every reader calls `assigneeName`.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/resourceRoster.test.ts`, importing `assigneeName` from `../../src/domain/readItems`:

```ts
describe('what an item says its assignee is', () => {
	it('shows the resolved resource note title, not the raw link text', () => {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: '[[Alex]]' } });
		const epic = buildModel(vault.app, vault.entries(), settings).all[0];

		expect(assigneeName(epic)).toBe('Alex');
		expect(epic.assigneeEntry?.file?.path).toBe('Alex.md');
	});

	it('shows a value that resolves to nothing as its own text, and resolves to no note', () => {
		// Every plain string left over from before this shipped lands here. It is not an
		// error and is not repaired.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Sarah' } });
		const epic = buildModel(vault.app, vault.entries(), settings).all[0];

		expect(assigneeName(epic)).toBe('Sarah');
		expect(epic.assigneeEntry?.file).toBe(null);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/resourceRoster.test.ts -t "what an item says"`
Expected: FAIL — `assigneeName` is not exported.

- [ ] **Step 3: Replace the field**

In `src/domain/readItems.ts`, replace the `assigneeValue` declaration on `RawItem` with:

```ts
	/**
	 * Who the note says it is assigned to — the `raw`/`file` pair `readLinkList` returns,
	 * `iterationEntry`'s shape and its reason: unresolved is not unset. A link naming a
	 * deleted note, or a plain name left over from before resources were notes, has a
	 * `raw` and no `file`; reading that as "nobody" would leave the reader with a value
	 * on the note and nothing in the view to clear.
	 */
	assigneeEntry: LinkEntry | null;
```

Replace the read (`assigneeValue: readLabel(settings.assigneeKey, fm)`) with:

```ts
		assigneeEntry: readFirstLinkEntry(app, file, cache, settings.assigneeKey),
```

Add the display helper at the foot of the file:

```ts
/**
 * The name to SHOW for an item's assignee: the resolved note's own title, so a rename
 * reaches every item that names them, else the raw text for a value that resolves to
 * nothing, else nobody.
 *
 * A function rather than a field because it is presentation derived from the entry, and a
 * second stored copy is one refresh away from disagreeing with the link it came from.
 */
export function assigneeName(item: { assigneeEntry: LinkEntry | null }): string | null {
	return item.assigneeEntry === null ? null : (item.assigneeEntry.file?.basename ?? item.assigneeEntry.raw);
}
```

- [ ] **Step 4: Fix every reader the compiler names**

Run `npx tsc -noEmit -skipLibCheck` and work the list. Each is a mechanical swap of `item.assigneeValue` for `assigneeName(item)`:

- `src/view/render/chips.ts` — `LABEL_CHIPS.assignee.valueOf: (item) => assigneeName(item)`
- `src/domain/roadmap.ts` — `resourceSource`, `placeAssigned`, `placeContextLane`
- `src/domain/writePlan.ts` — `computeAssigneeWrites`
- `src/view/interactions/labels.ts` — `assigneeChoices`
- `src/view/interactions/keyboard.ts` — `handleResourceMoveKey`
- `src/view/rowSignature.ts` — its term list; use `assigneeName(item)` there too, and update the doc-comment table row to name `assigneeEntry`
- `src/domain/vocabulary.ts` — `collectObservedAssignees` reads `item.assigneeValue`; give `VocabularySource` the entry and call `assigneeName`

Behaviour is unchanged for a plain-string vault: `assigneeName` returns the raw text.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. Existing assignee tests use plain names, which still read back identically.

- [ ] **Step 6: Full check and commit**

```bash
npm run check
git add -A && git commit -m "Read an item's assignee as a link"
```

---

### Task 3: One link writer, not three copies

**Files:**
- Modify: `src/storage/frontmatter.ts` — `applyIteration` and `applyRelease` collapse into `applyLinks`
- Test: `test/storage/labelWrites.test.ts` (extend)

**Interfaces:**
- Consumes: `wikilinkTo` (already imported by `frontmatter.ts`), `ItemWrite`.
- Produces: `applyLinks(app, fm, settings, write)` — private to `frontmatter.ts`, called from `applyInto` exactly where `applyIteration` and `applyRelease` were called.

A pure refactor. No planner, no caller and no test outside this file changes.

- [ ] **Step 1: Write the failing test**

Append to `test/storage/labelWrites.test.ts` a case that pins the shared rule at both existing keys, so a third row cannot be added later without it:

```ts
describe('writing the link properties', () => {
	// One rule read twice, which is what makes the loop worth having: `applyIteration` and
	// `applyRelease` were two spellings of it.
	const linked = { ...settings, iterationKey: 'iteration', releaseKey: '' };

	it('spells a wikilink, skips an unconfigured key, and a null removes rather than blanks', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });
		const sprint = vault.addFile('Sprint 4.md', { frontmatter: { type: 'Iteration' } });
		const release = vault.addFile('1.0.md', { frontmatter: { type: 'Release' } });

		// The release key is unconfigured, so its half of this batch invents no key.
		await applyWrites(vault.app, linked, [{ file, iteration: sprint, release }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', iteration: '[[Sprint 4]]' });

		await applyWrites(vault.app, linked, [{ file, iteration: null }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});
});
```

- [ ] **Step 2: Run it and watch it PASS**

Run: `npx vitest run test/storage/labelWrites.test.ts -t "writing the link properties"`
Expected: PASS against today's two writers. Green first is correct here and is the point: this task is a refactor, so the test is its safety net rather than a red-first feature test. If it fails, the assertion is wrong about today's behaviour — fix the test before touching `frontmatter.ts`, or the refactor lands on a false baseline.

- [ ] **Step 3: Collapse the two writers**

Replace `applyIteration` and `applyRelease` in `src/storage/frontmatter.ts` with:

```ts
/**
 * The LINK properties: the iteration, the release. Each is one note written as a wikilink
 * spelt from the editing note's own path, an unconfigured key dropped, and null deleting
 * the key rather than blanking it.
 *
 * `applyLabels`' shape one field-kind over, and extracted for `applyLabels`' own reason:
 * these were two copies of one rule, so a third property wanting it is a row in this list
 * rather than a third restatement. The plain LABEL properties stay in `applyLabels`
 * because a label is a string the reader picked and a link is a note — `wikilinkTo` is
 * exactly the difference, and a helper general enough to cover both would carry the
 * link spelling past the properties that must not have it.
 */
function applyLinks(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	const links: [TFile | null | undefined, string][] = [
		[write.iteration, settings.iterationKey],
		[write.release, settings.releaseKey],
	];
	for (const [target, key] of links) {
		if (target === undefined || !key) continue;
		if (target === null) delete fm[key];
		else setOwn(fm, key, wikilinkTo(app, target, write.file.path));
	}
}
```

Replace the two calls in `applyInto` with one `applyLinks(app, fm, settings, write)` at the position `applyIteration` held.

Check `ItemWrite.release`'s current type before writing this — if the release is planned as something other than `TFile | null`, keep its own writer and put only the iteration in the list, and narrow this comment to say so. **Write the guarantee to the check.**

- [ ] **Step 4: Run the suite**

Run: `npx vitest run test/storage/ test/domain/writePlanProperties.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 5: Full check and commit**

```bash
npm run check
git add -A && git commit -m "Collapse the two link writers into one"
```

---

### Task 4: An assignee pick names a note

The largest task, and indivisible: the register's rule is that a move is ONE host method and three inputs, so the planner, the writer and all three inputs change together or two of them disagree about what a pick means.

**Files:**
- Modify: `src/domain/writePlan.ts` — `ItemWrite.assignee`, `computeAssigneeWrites`, `computeResourceMoveWrites`
- Modify: `src/storage/frontmatter.ts` — the assignee joins `applyLinks`, leaves `applyLabels`
- Modify: `src/domain/roadmap.ts` — `ResourceSource`, `resourceSource`, `resourceLabel`, `resourceTargetLabel`, `resourcePlacementLabel`
- Modify: `src/view/cardMoves.ts` — `performResourceMove`
- Modify: `src/view/host.ts` — its signature
- Modify: `src/view/interactions/labels.ts` — `assigneeChoices` → resources, `chooseAssignee`, `addAssigneeItems`, `promptNewAssignee` deleted
- Modify: `src/view/interactions/resourceNotes.ts` — `promptNewResource` gains its callback
- Modify: `src/view/interactions/keyboard.ts` — `handleResourceMoveKey`
- Modify: `src/view/render/roadmap.ts` — the band drop
- Modify: `src/view/render/shelf.ts` — the un-place drop (null, unchanged in meaning)
- Modify: `src/i18n/en.ts` — add `menu.newResource`, `menu.noResources`; remove `menu.newAssignee`, `menu.assignTitle`, `menu.assignField`, `menu.assignPlaceholder`, `menu.assignCta`
- Test: `test/view/assignee.test.ts` (rewrite), `test/domain/writePlanProperties.test.ts` (extend), `test/view/contextRowWrites.test.ts` and `test/view/contextCardWrites.test.ts` (extend)

**Interfaces:**
- Consumes: `ResourceNote` and `BacklogModel.resources` (Task 1); `assigneeName` and `assigneeEntry` (Task 2); `applyLinks` (Task 3).
- Produces:
  ```ts
  export function computeAssigneeWrites(item: BacklogItem, target: TFile | null): ItemWrite[];
  export function computeResourceMoveWrites(item: BacklogItem, target: TFile | null, schedule: ScheduleGesture | null): ItemWrite[];
  export interface ResourceSource { entry: LinkEntry | null; keyPresent: boolean }
  // BacklogViewHost:
  performResourceMove(item: BacklogItem, target: TFile | null, when?: ScheduleGesture): Promise<boolean>;
  // view/interactions/resourceNotes.ts:
  export function promptNewResource(host: BacklogViewHost, then?: (file: TFile) => void): void;
  ```
  `ItemWrite.assignee` becomes `TFile | null`.

- [ ] **Step 1: Write the failing plan test**

Append to `test/domain/writePlanProperties.test.ts`:

```ts
describe('what an assignee pick writes', () => {
	/** An item, the resource it names, and a second resource to move it to. */
	function assigned(value: string | null) {
		const vault = new FakeVault();
		const alex = vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const sam = vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Item.md', {
			frontmatter: { type: 'PBI', order: 10, ...(value !== null ? { assignee: value } : {}) },
		});
		const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });
		const item = buildModel(vault.app, vault.entries(), settings).results[0];
		return { item, alex, sam };
	}

	it('plans the file, never a name', () => {
		const { item, alex } = assigned(null);
		expect(computeAssigneeWrites(item, alex)).toEqual([{ file: item.file, assignee: alex }]);
	});

	it('plans nothing when the item already names that note, compared by path', () => {
		// Two spellings of one note are one resource. This is also the menu's checkmark: an
		// entry is checked exactly when picking it would write nothing.
		const { item, alex } = assigned('[[Alex]]');
		expect(computeAssigneeWrites(item, alex)).toEqual([]);
	});

	it('plans a move to another resource', () => {
		const { item, sam } = assigned('[[Alex]]');
		expect(computeAssigneeWrites(item, sam)).toEqual([{ file: item.file, assignee: sam }]);
	});

	it('never treats an unresolved value as already there', () => {
		// A link that resolved to nothing has no path, so it matches no target — the leftover
		// string case, which must stay pickable rather than reading as current.
		const { item, alex } = assigned('Sarah');
		expect(computeAssigneeWrites(item, alex)).toEqual([{ file: item.file, assignee: alex }]);
	});

	it('plans a removal only where the key is present', () => {
		expect(computeAssigneeWrites(assigned('[[Alex]]').item, null)).toEqual([
			{ file: assigned('[[Alex]]').item.file, assignee: null },
		]);
		expect(computeAssigneeWrites(assigned(null).item, null)).toEqual([]);
	});
});
```

The removal case above builds its fixture twice to name the file; if that reads badly, hoist `const { item } = assigned('[[Alex]]')` and use `item.file`. Do not weaken the assertion to `toHaveLength`.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/domain/writePlanProperties.test.ts -t "what an assignee pick writes"`
Expected: FAIL — `computeAssigneeWrites` still takes a string.

- [ ] **Step 3: Change the planner and the writer**

`src/domain/writePlan.ts` — replace `computeAssigneeWrites`:

```ts
/**
 * The write an assignee pick means — `computeIterationWrites`' two rules over the one
 * link property that is a PERSON. Compared by PATH, never by the raw text: two spellings
 * of one note are one resource, and a link that resolved to nothing has no path and is
 * therefore never "already there" for any target.
 *
 * A removal is asked of PRESENCE (`ownKeys`), never of the parsed entry, for
 * `computeIterationWrites`' stated reason: a hand-edited `assignee: ''` reads as no entry
 * while the key still visibly holds something, and asking the entry would tick Clear on a
 * note the reader can see is not empty.
 */
export function computeAssigneeWrites(item: BacklogItem, target: TFile | null): ItemWrite[] {
	if (target === null) return item.ownKeys.assignee ? [{ file: item.file, assignee: null }] : [];
	if (item.assigneeEntry?.file?.path === target.path) return [];
	return [{ file: item.file, assignee: target }];
}
```

Change `ItemWrite.assignee` to `TFile | null` and rewrite its doc comment to say it is a link. Change `computeResourceMoveWrites`' second parameter to `target: TFile | null`.

`src/storage/frontmatter.ts` — move `[write.assignee, settings.assigneeKey]` out of `applyLabels`' list into `applyLinks`', and update both doc comments: `applyLabels` now covers risk, priority and the iteration goal; `applyLinks` covers the iteration, the release and the assignee.

- [ ] **Step 4: Change `ResourceSource` and the labels**

`src/domain/roadmap.ts`:

```ts
/** What a note's assignee key said, and whether it was there at all. */
export interface ResourceSource {
	entry: LinkEntry | null;
	keyPresent: boolean;
}

export function resourceSource(item: BacklogItem): ResourceSource {
	return { entry: item.assigneeEntry, keyPresent: item.ownKeys.assignee };
}

/**
 * A resource named in the casing the row on screen carries, or the note's own title where
 * no row draws it, or the raw text for a value that resolves to nothing. Three fallbacks
 * and not two, because a link is a third value shape: unresolved is a fact the reader can
 * see on the note, and reporting it as the shelf would say "from Unplaced" about a note
 * that plainly says Sarah.
 */
function resourceLabel(roadmap: RoadmapModel, entry: LinkEntry): string {
	const lane = entry.file ? roadmap.lanes.find((l) => l.file?.path === entry.file?.path) : undefined;
	return lane?.name ?? entry.file?.basename ?? entry.raw;
}

/** Where a pick sends a card. Nobody named is the shelf, under the name the frame gives it. */
export function resourceTargetLabel(roadmap: RoadmapModel, target: TFile | null): string {
	if (target === null) return shelfLabel();
	return roadmap.lanes.find((l) => l.file?.path === target.path)?.name ?? target.basename;
}
```

`resourcePlacementLabel` takes the `ResourceSource` and returns `source.entry === null ? …unassigned… : resourceLabel(roadmap, source.entry)`, keeping its existing two-ways-to-say-nobody branch on `keyPresent`. Delete `laneFor` if nothing else calls it.

**`ResourceLane.file` does not exist until Task 5.** For this task, give `ResourceLane` the field now — `file: TFile | null`, null only for the milestones' row — and set it in `deriveLanes`' declared-lane map and in `laneNamed` by looking the name up in `model.resources`. That bridge is deleted in Task 5; write it as three lines and no comment beyond `// Bridged until the rows come from the notes (Task 5).`

- [ ] **Step 5: Change the three inputs**

`src/view/host.ts` and `src/view/cardMoves.ts` — `performResourceMove(item, target: TFile | null, when?)`. Inside it, `declareResource(this.host, name)` stays for now (Task 7 deletes it); pass `target?.basename ?? null`.

`src/view/interactions/keyboard.ts` — `resourceStops` returns the assignable lanes rather than their names, **filtered to the ones that have a file**:

```ts
const stops = assignableLanes(roadmap).filter((lane) => lane.file !== null);
```

That filter is load-bearing until Task 5: a lane minted by `laneNamed` has no file, and `performResourceMove(card, null)` means UNASSIGN — so an Alt+arrow onto such a row would silently take the assignee off instead of moving it. Task 5 makes it redundant by construction (every lane is a note) and `AssignableLane` then carries the narrowing in the type; delete the filter there.

The ladder's current index is `stops.findIndex((lane) => lane.file?.path === card.assigneeEntry?.file?.path)` — asked of the ENTRY's path, so an unresolved value matches no stop and lands off-ladder, which is the case `offLadder` already handles. The call becomes `host.performResourceMove(card, stops[target].file)`.

`src/view/render/roadmap.ts` — the band drop passes `band.lane.file`. Because `assignableLanes` narrows (Task 5), for now guard: the existing `if (band.lane.markers || …) { submitGesture(…); return; }` already runs first, so add `if (!band.lane.file) return;` beneath it rather than asserting.

`src/view/render/shelf.ts` — unchanged, `null` still means un-place.

- [ ] **Step 6: Rebuild the menu**

`src/view/interactions/labels.ts`:

```ts
/**
 * What Set assignee offers: the `Resource` notes the base returned, and nothing else.
 *
 * One source where there were three. A roster is no longer a recommendation on top of
 * observed names — it is the notes, so an observed string is not a vocabulary this base
 * recommends to anybody and the item's own unresolved value earns no entry either: a
 * value that is not a link resolves to nobody, which is a fact to render rather than an
 * option to offer. Scoped through the model's own list, which `divertResource` already
 * scoped to the results.
 */
function assigneeTargets(host: BacklogViewHost): ResourceNote[] {
	return host.model?.resources ?? [];
}
```

`addAssigneeItems` becomes a bespoke builder rather than a call into `addLabelItems`, because its choices are notes and not strings:

```ts
export function addAssigneeItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const targets = assigneeTargets(host);
	for (const target of targets) {
		menu.addItem((si) => {
			si.setTitle(target.title).onClick(() => void chooseAssignee(host, item, target.file));
			if (computeAssigneeWrites(item, target.file).length === 0) si.setChecked(true);
		});
	}
	// 2a: a menu with nothing to pick says why rather than opening empty, and the reason
	// is always the same one — the base returned no resources.
	if (targets.length === 0) menu.addItem((si) => si.setTitle(t('menu.noResources')).setDisabled(true));
	menu.addItem((si) =>
		si
			.setTitle(t('menu.newResource'))
			.setIcon('plus')
			.onClick(() => promptNewResource(host, (file) => void chooseAssignee(host, item, file))),
	);
	if (!item.ownKeys.assignee) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle(t('menu.clearAssignee'))
			.setIcon('eraser')
			.onClick(() => void chooseAssignee(host, item, null)),
	);
}
```

Delete `promptNewAssignee` entirely, and drop the now-unused `extra` and `apply` fields from `addLabelItems`' spec if risk and priority are its only callers left. `chooseAssignee(host, item, target: TFile | null)` keeps its `onResourceAxis` split unchanged.

If `labels.ts` exceeds 400 lines after this, split the assignee half into `src/view/interactions/assignee.ts` and say so in Task 8's register edit.

- [ ] **Step 7: The creation callback**

`src/view/interactions/resourceNotes.ts`:

```ts
export function promptNewResource(host: BacklogViewHost, then?: (file: TFile) => void): void {
```

pass `then` through to `writeResource`, and call it after the Notice:

```ts
		new Notice(t('resource.created', { name: file.basename }));
		// The note exists BEFORE anything links to it — a link to a note that does not
		// exist is the one value this flow must not produce — so a failed creation
		// throws past this line and writes no link.
		then?.(file);
```

Change `known` to `host.model?.resources.map((r) => r.title) ?? []`, and update `resource.duplicateWarning`'s comment in `en.ts`: the warning can now claim a `Resource` note exists, which it could not on 2026-08-22.

- [ ] **Step 8: New sentences**

`src/i18n/en.ts` — add beside `menu.clearAssignee`:

```ts
	'menu.newResource': 'New resource...',
	'menu.noResources': 'No resources in this base',
```

Remove `menu.newAssignee`, `menu.assignTitle`, `menu.assignField`, `menu.assignPlaceholder`, `menu.assignCta`, and any doc comment above them that names the removed prompt.

- [ ] **Step 9: Rewrite the view tests**

`test/view/assignee.test.ts` — the fixture vault gains `Alex.md` and `Sam.md` as `type: Resource`, and the items name them as `'[[Alex]]'`. Assert:
- the submenu lists the resource notes alphabetically and nothing else;
- an item's current resource renders checked, and a second spelling of the same note is not a second entry;
- an item carrying a leftover plain string has no entry checked and offers no entry for its own value;
- with no resource note in the base, the submenu holds the disabled reason and `New resource...` alone;
- `New resource...` creates the note and then writes the link — assert the frontmatter is `[[<name>]]`;
- a failed creation writes no link.

Extend `test/view/contextRowWrites.test.ts` and `test/view/contextCardWrites.test.ts` so the new pick path is driven against a context row and refused.

- [ ] **Step 10: Run and commit**

```bash
npx vitest run
npm run check
git add -A && git commit -m "Name a resource by link when an item is assigned"
```

---

### Task 5: The rows are the resource notes

**Files:**
- Modify: `src/domain/roadmap.ts` — `ResourceLane`, `AssignableLane`, `deriveLanes`, `placeAssigned`, `placeContextLane`, `assignableLanes`; `laneNamed` deleted
- Modify: `src/view/render/lanes.ts` — the `declared` class and the undeclared tooltip removed
- Modify: `src/view/render/roadmap.ts` — the empty state for a base with no resources
- Modify: `src/i18n/en.ts` — add `roadmap.noResources.title` / `.hint`; remove `lane.undeclaredResource`
- Test: `test/domain/resourceRoster.test.ts` (extend), `test/view/roadmapResources.test.ts` (whichever suite drives the axis today — find it with `grep -rl "resources" test/view/`)

**Interfaces:**
- Consumes: `BacklogModel.resources` (Task 1), `assigneeEntry` (Task 2), `ResourceLane.file` (Task 4's bridge).
- Produces:
  ```ts
  export interface ResourceLane { file: TFile | null; name: string; markers: boolean; bars: TimelineBar[]; absences: Absence[]; context: BacklogItem[] }
  /** A row that IS a resource — every lane but the milestones' one. */
  export interface AssignableLane extends ResourceLane { file: TFile }
  export function assignableLanes(roadmap: RoadmapModel | undefined): AssignableLane[];
  ```
  `ResourceLane.declared` is deleted.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/resourceRoster.test.ts`, importing `buildRoadmap` from `../../src/domain/roadmap`:

```ts
describe('the rows the resources axis draws', () => {
	const dated = settingsWith({
		assigneeKey: 'assignee',
		startKey: 'start',
		targetKey: 'due',
		hierarchyOnly: false,
	});

	/** A team of two, one of them with nothing assigned, plus whatever the caller adds. */
	function team(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		return vault;
	}

	function lanesOf(vault: FakeVault) {
		const model = buildModel(vault.app, vault.entries(), dated);
		return buildRoadmap(model, dated, 'resources');
	}

	it('draws one row per resource note, alphabetically, including one nobody names', () => {
		const vault = team();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: '[[Sam]]', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		// Alex has nothing assigned and still gets a row. That is what the removed
		// `resourceNames` option existed for, and it must not be lost with it.
		expect(roadmap.lanes.map((l) => l.name)).toEqual(['Alex', 'Sam']);
		expect(roadmap.lanes[1].bars).toHaveLength(1);
	});

	it('mints no row from a name — an item whose link resolves to no resource shelves', () => {
		const vault = team();
		vault.addFile('Stray.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Sarah', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.map((l) => l.name)).toEqual(['Alex', 'Sam']);
		expect(roadmap.shelf.map((s) => s.item.title)).toEqual(['Stray']);
	});

	it('shelves an item whose link resolves to a note that is not a Resource', () => {
		// A link is not a declaration, and the type is.
		const vault = team();
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: '[[Epic B]]', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.every((l) => l.bars.length === 0)).toBe(true);
		expect(roadmap.shelf.map((s) => s.item.title)).toContain('Work');
	});

	it('puts an absence in its resource row, and draws it nowhere when it resolves to no row', () => {
		const vault = team();
		vault.addFile('Alex away.md', {
			frontmatter: { type: 'Absence', assignee: '[[Alex]]', start: '2026-08-03', due: '2026-08-05' },
		});
		vault.addFile('Nobody away.md', {
			frontmatter: { type: 'Absence', assignee: 'Sarah', start: '2026-08-03', due: '2026-08-05' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.map((l) => l.absences.length)).toEqual([1, 0]);
	});
});
```

Check `buildRoadmap`'s real signature before writing this — it may take the axis differently. Match it; do not add a wrapper.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/domain/resourceRoster.test.ts -t "the rows the resources axis draws"`
Expected: FAIL — `laneNamed` still mints a row from the string.

- [ ] **Step 3: Build the rows from the notes**

`src/domain/roadmap.ts` — `deriveLanes` takes the model's resources and keys by path:

```ts
function deriveLanes(
	rows: BacklogItem[],
	settings: BacklogSettings,
	roadmap: RoadmapModel,
	absences: Absence[],
	resources: ResourceNote[],
): void {
	const markers = markerLane([]);
	// One row per resource note, in the model's own order — every one, whether or not
	// anything names them, which is what the removed `resourceNames` option existed for.
	const lanes = resources.map(
		(resource): ResourceLane => ({
			file: resource.file,
			name: resource.title,
			markers: false,
			bars: [],
			absences: [],
			context: [],
		}),
	);
	// By PATH, never by a folded name: a link resolves or it does not, and there is no
	// middle answer for a case-insensitive comparison to keep. Built from `resources`
	// rather than from `lanes`, so the key comes from a `TFile` the type already
	// guarantees instead of a non-null assertion on the lane's nullable one.
	const byPath = new Map<string, ResourceLane>(resources.map((resource, i) => [resource.file.path, lanes[i]]));
	for (const item of rows) {
		if (item.outsideFilter) continue;
		if (isMarkerType(item.typeName)) placeBar(item, () => markers, roadmap, settings);
		else placeAssigned(item, byPath, roadmap, settings);
	}
	// An absence with no row draws nowhere. It can no longer MINT one: a row is a note,
	// and an absence is a statement about a resource rather than a declaration of one.
	for (const absence of absences) {
		const lane = absence.resource.file ? byPath.get(absence.resource.file.path) : undefined;
		lane?.absences.push(absence);
	}
	for (const item of rows) {
		if (item.outsideFilter) placeContextLane(item, byPath, roadmap);
	}
	roadmap.lanes = markers.bars.length > 0 ? [markers, ...lanes] : lanes;
	roadmap.bars = roadmap.lanes.flatMap((lane) => lane.bars);
}
```

`placeAssigned` resolves through the same map and shelves on a miss:

```ts
function placeAssigned(
	item: BacklogItem,
	byPath: Map<string, ResourceLane>,
	roadmap: RoadmapModel,
	settings: BacklogSettings,
): void {
	const lane = item.assigneeEntry?.file ? byPath.get(item.assigneeEntry.file.path) : undefined;
	// One answer for three cases, and deliberately: nobody named, a link that resolves to
	// nothing, and a link that resolves to a note this base holds but which is not a
	// `Resource`. A link is not a declaration and the type is, so all three shelve —
	// visible, counted, and one drop away from being placed.
	if (!lane) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	placeBar(item, () => lane, roadmap, settings);
}
```

`placeContextLane` resolves the same way. Delete `laneNamed`. Delete `declared` from `ResourceLane` and from `markerLane`. Add `AssignableLane` and narrow `assignableLanes`:

```ts
export function assignableLanes(roadmap: RoadmapModel | undefined): AssignableLane[] {
	return (roadmap?.lanes ?? []).filter((lane): lane is AssignableLane => !lane.markers && lane.file !== null);
}
```

Pass `model.resources` through the `deriveLanes` call site (`roadmap.ts` line ~515). Delete Task 4's bridge lines.

The band's fold key stays the lane NAME (`host.isLaneCollapsed(lane.name)` in `view/render/roadmap.ts`). Deliberately: the key is stored per device in the view-state store, so changing it to a path would silently unfold every band a reader had collapsed. A rename unfolds one band once, which is the cheaper of the two.

- [ ] **Step 4: Drop the undeclared decoration**

`src/view/render/lanes.ts` — remove the `pbl-lane-undeclared` class and the `lane.undeclaredResource` tooltip; every row is now a note. Remove the rule from `styles/` if nothing else uses the class (`grep -rn "pbl-lane-undeclared" styles/ src/`).

- [ ] **Step 5: The empty state**

`src/view/render/roadmap.ts` — in `renderRoadmapAdvisory`, before the existing `eligibleResults === 0` branch:

```ts
	// 2a: the population is the results, so an empty axis has exactly one cause and says
	// it. An empty state that does not explain itself reads as a broken feature.
	if (roadmap.axis === 'resources' && roadmap.lanes.every((lane) => lane.markers)) {
		guidanceShell(aside, 'users', t('roadmap.noResources.title'), t('roadmap.noResources.hint'));
		return aside;
	}
```

with, in `en.ts`:

```ts
	'roadmap.noResources.title': 'No resources in this base',
	'roadmap.noResources.hint':
		'This axis draws one row per resource note the base returns. Widen the base filter to include them, or press New resource to make one.',
```

Match `renderRoadmapAdvisory`'s real parameters — it may need `roadmap` passing in. Check `guidanceShell`'s signature in `src/view/render/emptyStates.ts` and match it exactly.

- [ ] **Step 6: Run and commit**

```bash
npx vitest run
npm run check
git add -A && git commit -m "Draw one row per resource note"
```

---

### Task 6: An absence names its resource by link

**Files:**
- Modify: `src/domain/absences.ts` — `Absence.resource` becomes a `LinkEntry`
- Modify: `src/storage/absenceNotes.ts` — both `setOwn(fm, settings.assigneeKey, spec.resource)` sites write a wikilink
- Modify: `src/view/interactions/absences.ts` — the form names the row's note, not its caption
- Modify: `src/view/render/lanes.ts` — anything drawing `absence.resource` as text
- Test: `test/view/resourceAbsences.test.ts` (extend)

**Interfaces:**
- Consumes: `readFirstLinkEntry`, `wikilinkTo`, `AssignableLane` (Task 5).
- Produces: `Absence.resource: LinkEntry`; `NewAbsenceSpec.resource: TFile`.

- [ ] **Step 1: Write the failing test**

Append to `test/view/resourceAbsences.test.ts`, following that file's existing arrangement for opening the absence form from a row header:

```ts
it('writes the resource as a link, so one fact has one spelling', async () => {
	// The absence writer shares none of `applyWrites`' path, which is exactly why it is
	// easy to leave spelling a resource the old way while everything else spells it the
	// new one — a sweep of the batch writer finds nothing here.
	const vault = new FakeVault();
	vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: '[[Alex]]', start: '2026-08-01', due: '2026-08-10' },
	});
	const harness = await makeRoadmap(vault, RESOURCE_AXIS_WITH_ABSENCES);

	await addAbsenceFromRow(harness, 'Alex', { start: '2026-08-03', due: '2026-08-05' });

	const created = [...vault.files.keys()].find((path) => path.includes('away'));
	expect(vault.fm(created!)['assignee']).toBe('[[Alex]]');
});

it('draws that absence in its resource row and in no other', async () => {
	const vault = new FakeVault();
	vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Alex away.md', {
		frontmatter: { type: 'Absence', assignee: '[[Alex]]', start: '2026-08-03', due: '2026-08-05' },
	});
	const harness = await makeRoadmap(vault, RESOURCE_AXIS_WITH_ABSENCES);

	expect(absenceCountsByLane(harness)).toEqual({ Alex: 1, Sam: 0 });
});
```

`addAbsenceFromRow`, `absenceCountsByLane` and the absence-configured options bag stand for whatever this suite already calls them — read the file and use its own spellings rather than adding helpers. The created note's name is derived, which is why the first test finds it by path rather than predicting it.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/view/resourceAbsences.test.ts -t "writes the resource as a link"`
Expected: FAIL — the frontmatter holds the bare name.

- [ ] **Step 3: Read and write the link**

`src/domain/absences.ts` — `readAbsence` takes the `app` and the cache so it can call `readFirstLinkEntry(app, file, cache, settings.assigneeKey)`; `Absence.resource` becomes that `LinkEntry`. Update `divertAbsence`'s call in `readItems.ts` to pass them — the cache is already open on that line, so no second `getFileCache` is added and `test/domain/modelCost.test.ts` still holds.

The derived absence name (`absences.ts` line ~165, `${facts.resource} away …`) uses `resource.file?.basename ?? resource.raw`.

`src/storage/absenceNotes.ts` — `NewAbsenceSpec.resource` becomes a `TFile`, and both write sites become `setOwn(fm, settings.assigneeKey, wikilinkTo(app, spec.resource, path))`.

`src/view/interactions/absences.ts` — `promptAddAbsence` takes the `AssignableLane` and passes `lane.file`; `known` becomes the resource titles from `host.model?.resources`. The edit path passes `absence.resource.file`, and refuses when it is null: an absence whose link resolves to nothing has no row to have been opened from, so this is a defensive branch, not a user-facing refusal.

- [ ] **Step 4: Run and commit**

```bash
npx vitest run
npm run check
git add -A && git commit -m "Let an absence name its resource by link"
```

---

### Task 7: Delete the declared roster

**Files:**
- Modify: `src/domain/settings.ts` — `resourceNames` field and its default
- Modify: `src/domain/settingsResolve.ts` — its resolve line
- Modify: `src/domain/settingsConsistency.ts` — its entry in `vocabularies`
- Modify: `src/domain/viewOptions.ts` — the option
- Modify: `src/view/interactions/labels.ts` — `declareResource` deleted
- Modify: `src/view/cardMoves.ts` — its call in `performResourceMove`
- Modify: `src/domain/vocabulary.ts` — `collectObservedAssignees` and `observedAssignees` deleted if nothing reads them; `mergedValues` deleted if nothing else calls it
- Modify: `src/view/manual/setupSection.ts` — if it names the option
- Modify: `src/i18n/en.ts` — `option.resourceNames`, `option.resourceNamesHint`
- Delete: `test/view/resourceRoster.test.ts` (the old `.base`-write suite)
- Test: `test/domain/viewOptions.test.ts`, `test/domain/settings.test.ts` (adjust)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: nothing new. This task only removes.

- [ ] **Step 1: Delete `declareResource` and its caller**

Remove the function from `src/view/interactions/labels.ts` and the `declareResource(this.host, name)` line from `performResourceMove` in `src/view/cardMoves.ts`, with its paragraph of comment. Delete `test/view/resourceRoster.test.ts` — it tests the ordering rule of a write that no longer exists.

- [ ] **Step 2: Delete the option**

Remove `resourceNames` from `BacklogSettings`, from `defaultSettings`, from `resolveSettings`, from `settingsConsistency`'s `vocabularies` array, and from `viewOptions.ts`. Remove `option.resourceNames` and `option.resourceNamesHint` from `en.ts`.

- [ ] **Step 3: Let the compiler find the rest**

Run: `npx tsc -noEmit -skipLibCheck`
Fix each site. Run `npm run analyze` — fallow reports anything now dead (`mergedValues`, `collectObservedAssignees`, `observedAssignees`, `ProjectionPopulation.observedAssignees`, `rowVocabulary`'s assignee half). Delete what it names; do not suppress.

- [ ] **Step 4: Run the suite and fix the fallout**

Run: `npx vitest run`
Tests naming `resourceNames` in their options assert a removed setting. Delete those cases rather than rewriting them to assert nothing — a case that no longer has a subject is not a case.

- [ ] **Step 5: Full check and commit**

```bash
npm run check
git add -A && git commit -m "Remove the declared roster the notes replace"
```

---

### Task 8: The register, and the changelog

**Files:**
- Modify: `docs/requirements/Rows from the Resource notes.md` — status Done, `files`, the stated order, `## Where it lives`
- Modify: `docs/requirements/Linking an item to a resource.md` — same
- Modify: `docs/requirements/An absence names its resource by link.md` — same
- Modify: `docs/requirements/Resources as notes.md` — the three-step landmine order marked spent
- Modify: `docs/requirements/Setting the assignee on an item.md` — its `New assignee...` steps superseded, naming the note that replaced them
- Modify: `docs/requirements/Making a resource from the timeline.md` — the second creation surface and the `known` list it can now claim
- Modify: `CLAUDE.md` — the `applyLabels`/`applyLinks` paragraph under **The write path**
- Modify: `CHANGELOG.md` — an `[Unreleased]` entry
- Test: `npm run docs`

**Interfaces:**
- Consumes: the finished code. Nothing produces.

- [ ] **Step 1: Move the three PBIs to Done**

For each, set `status: Done`, `started`/`finished` to today's date, and fill `files:` with the exact paths that changed. Every `src/` module touched must be named in a `## Where it lives` section — that is `docs-check.mjs` rule 7, and it is what fails if a new module (a split-out `interactions/assignee.ts`, say) is left unspecified.

- [ ] **Step 2: State the order that was unstated**

In `Rows from the Resource notes.md`, replace "in a stated order" with the order: alphabetical by note title through `localeCompare`, the collation `collectObservedAssignees` used, following the USER's locale because a name is data.

- [ ] **Step 3: Correct what the register now gets wrong**

- `Rows from the Resource notes.md` extension 2b says a context-row `Resource` "renders and it parents". It does not: `divertResource` keeps only a note the base returned, so nothing downstream is handed one. Rewrite 2b to say that, and say why — the rule is kept once at the keeping rather than at each consumer.
- `Setting the assignee on an item.md` main-flow steps 3 and 5 describe a menu of observed names and `New assignee...`. Add a paragraph under its title saying which note superseded them and when, in that note's own voice; do not delete the history.
- `CLAUDE.md`'s **The write path** section names `applyLabels` as "one loop over a list pairing each planned value with its configured key" for three label properties. Add `applyLinks` beside it as the same shape for the link properties, and say the assignee moved between them — the register's own rule is that a guide naming symbols goes stale, so name them only where the sentence is about them.

- [ ] **Step 4: The changelog**

Add to `CHANGELOG.md`'s `[Unreleased]` section — a dated `## [x.y.z]` heading is the release's job, not this PR's:

```markdown
### Changed

- **Breaking:** an item names its assignee by link to a `Resource` note rather than by
  name. A note carrying `assignee: Sarah` names nobody after this: the text renders and
  nothing else. There is no migration — see `docs/issues/No migration off the string
  assignees.md`.
- The roadmap's resources axis draws one row per `Resource` note the base returns,
  alphabetically, including a resource nobody is assigned to yet.
- `Set assignee` lists those notes and offers `New resource...`, which creates the note
  and assigns it in one action. `New assignee...` is gone.

### Removed

- The `Resources (in order)` view option. The roster is the notes the base returns.
```

Check the exact `[Unreleased]` heading spelling in `CHANGELOG.md` first — `test/release/changelogVersion.test.ts` parses it with mdast.

- [ ] **Step 5: Run the register gate and commit**

```bash
npm run docs
npm run check
git add -A && git commit -m "Record the roster that comes from the notes"
git push -u origin claude/resource-management-assignees-lmho3m
```

---

## Still owed after this plan

Neither is reachable from the jsdom harness, and `npm run test-build` is the handover:

- How a leftover plain string reads in the chip beside a resolved resource's name. "Unstyled" must read as a value the reader can act on, not as a broken chip.
- The resources axis's empty state, and the assignee menu holding its disabled reason and `New resource...` alone.
