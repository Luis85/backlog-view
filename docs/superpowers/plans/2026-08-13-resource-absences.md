# Resource absences implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A resource's own unavailable stretch, written from its row header and drawn in that row and nowhere else — a note with a declared type this backlog recognizes and then refuses to treat as work.

**Architecture:** `Absence` is a standalone type constant in no vocabulary list. `readItems.ts` diverts a note carrying it before a `RawItem` exists, so it is excluded from every projection unconditionally; what it diverts into is a plain `Absence` record on the model, placed into a resource's row by `deriveLanes` and drawn as its own entry in the lane's band. Creating one is a prompt of its own and a write of its own — not `createBacklogItem`, which has no shape for a note with no parent and no rank — and deleting one is Obsidian's file delete, since it was never one of this backlog's write targets.

**Tech Stack:** TypeScript, Obsidian Bases custom view API 1.12.0, vitest + jsdom.

**Spec:** `docs/requirements/Resource absences.md` (PBI, order 30). Its parent Feature is `docs/requirements/The resource timeline.md`, whose "Landmines" section owns extension 4e; the two shipped siblings are `Showing a resources axis on the roadmap.md` (Done) and `Assigning items to a resource.md` (Active).

## Two places this plan departs from the spec's `## Where it lives`

Both were found by reading the code the spec projects onto, and neither changes an acceptance criterion. Read them before Task 1; if either is wrong, the plan changes shape rather than detail.

**1. The reader cannot be a second pass over the entries.** The note says the new reader "would need its own look at the same `entries: BasesEntry[]` `buildModel` already takes … the same list, read a second time for the opposite type." That breaks a live invariant: `test/domain/modelCost.test.ts` asserts `reads === items` — `getFileCache` is called exactly once per note loaded, and `addItem` is the only call site in `domain/`. A second pass reading each entry's frontmatter through the metadata cache doubles that count and fails the test; reading through `BasesEntry.getValue()` instead avoids the cache but is unreadable in this harness at all (`test/CLAUDE.md`: "`entry.getValue()` returns null, so property chips render empty in tests"), so every absence test would assert against a vault the code cannot read.

So the divert happens **where the cache is already open**: `addItem` reads `typeName` today, at line 191, four lines before it builds the `RawItem`. Recognizing the absence there costs no second read, keeps `reads === items` true (an absence is not an item and never was), and satisfies the criterion exactly as written — "excluded from the model unconditionally, before `RawItem` is built". What changes is only that `readItems.ts` learns what an absence IS rather than only that it is skipped, and that the record lands on `BacklogModel.absences` rather than in a module the model never mentions.

**2. `ResourceLane.bars` is not the seam the sibling note promised.** `Showing a resources axis on the roadmap.md` says: "`ResourceLane.bars` is a plain list the renderer walks, which is the seam [[Resource absences]] needs: a second source appends to it rather than changing how a row is drawn." It cannot: `TimelineBar.item` is a `BacklogItem` (`src/domain/bars.ts:22`), and this PBI's whole premise is that an absence is never one. The seam is real — a row draws from more than one source, and the renderer walks a list per source — but it is a second LIST (`ResourceLane.absences`), not an append to `bars`. Task 7 corrects that sentence in the sibling note.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) must pass. On Windows the docs-checker and `contextRowWrites` suites flake at the default 5s timeout — verify with `npx vitest run --coverage --testTimeout=30000`, and run `npm run analyze` and `npm run docs` explicitly, since a failed test run skips both.
- **400-line lint cap per `src/` file**, comments and blanks excluded. Measured headroom before this work: `src/view/backlogView.ts` **5**, `src/storage/frontmatter.ts` **13**, `src/view/render/timeline.ts` **23** — all three are why the plan puts new code in new modules rather than beside the code it resembles. Roomy: `prompts.ts` 154, `viewOptions.ts` 101, `roadmap.ts` 181, `lanes.ts` 326, `itemTypes.ts` 328, `typeVocabulary.ts` 367. `styles/timeline.css` is at 398 of its own 400 — put nothing there; `styles/lanes.css` is the resources axis's partial.
- **`Absence` joins no list.** Not `ALL_TYPES`, not `LEVELS`, `EXTRA_TYPES`, `MARKER_TYPES` or `TEST_LEVELS`. Every `ALL_TYPES` consumer must need no edit — that is the acceptance criterion and also how the change stays small.
- **A new view-option key** (`typeFolder.absence`) is a `.base` promise: `test/docs/surfaces.test.ts` requires it named in a requirement note and claimed by exactly one manual setup entry. Both are already satisfied — the spec names `` `typeFolder.absence` `` in a code span, and the manual's setup section claims the family `typeFolder.*` (`src/view/manual/setupSection.ts:132`). **Verify, don't assume** (Task 4 step 4).
- **Everything that puts bytes in the vault lives in `storage/`** — `no-restricted-syntax` bans `vault.create` and `processFrontMatter` outside it. The delete goes there too, by the same rule, even though no lint rule names `trashFile`.
- **Coverage thresholds only ever go up**: statements 98.48, branches 94.81, functions 99.81, lines 99.59.
- **An invariant asserted in a comment gets a test that fails without it, watched failing** — revert, run, see red, restore.
- Sentence-case UI text; `setCssProps` over inline styles; `normalizePath` on user paths; no `!important`.

## Out of scope, stated rather than skipped

- **A keyboard path to Add absence and to Delete absence.** The pane is one tab stop with a roving selection over `roadmap.cards`, and an absence is not a card. This is precisely the gap the bucket's own New button already documents — "a bucket is not a keyboard stop, so nothing selects one to act on … Closing the gap properly means bucket stops, which is `docs/requirements/Keyboard and menu on the roadmap.md`'s work" — so both controls are `tabindex="-1"` and the gap is recorded in the same words rather than closed here. Say it in the note; do not invent a menu to work around it.
- **Extension 4e** (a Base whose query narrows by type must name `Absence`). Not something this PBI builds its way out of — the Feature's landmines own it.
- **Extension 4f** (renaming `typeKey` after absences exist). Explicitly not migrated, the same non-guarantee every declared type carries.
- **Editing an absence.** The spec has create, draw and delete. A written absence with a wrong range is deleted and re-added.

## File Structure

**Created**

- `src/domain/absences.ts` — what an absence IS: the record, whether the configuration can carry one, and reading one out of frontmatter with the same validity gate the prompt applies. Pure, and the one place 2a/2b/4d/4g are answered.
- `src/storage/absenceNotes.ts` — the two vault acts: create the note, trash it. Its own module because `frontmatter.ts` has 13 lines of headroom and because neither act goes through `applyWrites` — an absence is not a write target, so it has no batch and no inverse.
- `src/view/interactions/absences.ts` — the view's side: open the prompt from a row header, gate it, write, announce; and the absence row's own context menu.
- `test/domain/absences.test.ts`, `test/view/resourceAbsences.test.ts`.
- `docs/adrs/0028-absence-is-a-reserved-name-outside-the-vocabulary.md`.

**Modified**

- `src/domain/typeVocabulary.ts` — `ABSENCE_TYPE`, joining nothing.
- `src/domain/itemTypes.ts` — `isAbsenceType`, beside `isMarkerType`.
- `src/domain/readItems.ts` — divert the note where the cache is already open.
- `src/domain/model.ts` — `BacklogModel.absences`, carried off the store.
- `src/domain/roadmap.ts` — `ResourceLane.absences`, and a third minting source.
- `src/domain/settingsResolve.ts`, `src/domain/viewOptions.ts` — one folder option more than `ALL_TYPES` has.
- `src/view/render/lanes.ts` — the absence entry, its row, and the header's Add button.
- `src/view/render/timeline.ts` — one more entry kind in the draw loop (≈4 lines; 23 available).
- `src/ui/prompts.ts` — `AbsencePromptModal`.
- `styles/lanes.css` — the blocked stretch.
- `test/helpers/obsidian-mock.ts` or `test/helpers/vault.ts` — `fileManager.trashFile`.
- `docs/requirements/Resource absences.md`, `docs/requirements/Showing a resources axis on the roadmap.md`, `CHANGELOG.md`.

---

### Task 1: The name, and the note that never becomes an item

The exclusion first, because every other task rests on it and because it is the half that can go wrong invisibly — a note that keeps rendering as a task is the one inversion this feature exists to prevent.

**Files:**
- Modify: `src/domain/typeVocabulary.ts`, `src/domain/itemTypes.ts`, `src/domain/readItems.ts`, `src/domain/model.ts`
- Create: `src/domain/absences.ts`
- Test: `test/domain/absences.test.ts`

**Interfaces:**
- Consumes: `readDate` / `FieldReading<CivilDate>` / `readString` (`src/domain/noteFields.ts`), `ownValue`, `reversedSpan` (`src/domain/timeline.ts`), `BacklogSettings`.
- Produces:
  - `export const ABSENCE_TYPE = 'Absence'` (`typeVocabulary.ts`)
  - `export function isAbsenceType(typeName: string | null): boolean` (`itemTypes.ts`)
  - `export interface Absence { file: TFile; title: string; resource: string; start: CivilDate; target: CivilDate }`
  - `export function absencesConfigured(settings: BacklogSettings): boolean`
  - `export function readAbsence(file: TFile, fm: Record<string, unknown> | undefined, settings: BacklogSettings): Absence | null`
  - `BacklogModel.absences: Absence[]`

- [ ] **Step 1: Write the failing test**

Create `test/domain/absences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { absencesConfigured } from '../../src/domain/absences';
import { ALL_TYPES } from '../../src/domain/typeVocabulary';
import { defaultSettings, resolveSettings } from '../../src/domain/settings';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/** The axis's own three properties, which an absence reads through as well. */
const ABSENCE_CONFIG = {
	assigneeProperty: 'note.assignee',
	startProperty: 'note.start',
	targetProperty: 'note.due',
};

function settingsFor(extra: Record<string, unknown> = {}) {
	return resolveSettings(new FakeViewConfig({ ...ABSENCE_CONFIG, ...extra }) as never, defaultSettings());
}

/** One epic, and one absence written the way the prompt writes them. */
function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Alice away.md', {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}

describe('an absence is never a work item', () => {
	it('is dropped before it becomes an item, and its facts kept beside them', () => {
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor());

		// Not an item, not a result, not reachable by path — the exclusion is the type's,
		// and it happens before a `RawItem` is built rather than by failing a later test.
		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.byPath.has('Alice away.md')).toBe(false);
		expect(model.absences.map((a) => a.title)).toEqual(['Alice away']);
		expect(model.absences[0].resource).toBe('Alice');
	});

	it('is dropped with hierarchyOnly off, where every note becomes an item', () => {
		// The polarity that distinguishes this from every other declared type: the scope
		// prune is what drops an unsupported note, and it does not run at all here.
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor({ hierarchyOnly: false }));

		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.absences).toHaveLength(1);
	});

	it('keeps the name out of every list the work-item vocabulary drives', () => {
		// Stated at the list rather than at its consumers: `childTypeChoices`, `focusTarget`,
		// the shelf's grouping, the generated README and the manual all read this one array,
		// so none of them needs an edit and none of them can grow an entry by accident.
		expect(ALL_TYPES).not.toContain('Absence');
	});

	it('reads nothing at all until both date properties are configured', () => {
		// 4d: a note with both dates in its frontmatter is not read as a one-ended
		// ordinary range from whichever single key survives — nothing distinguishes
		// "the other key left the settings" from "this was never a two-ended absence".
		expect(absencesConfigured(settingsFor())).toBe(true);
		expect(absencesConfigured(settingsFor({ targetProperty: null }))).toBe(false);
		expect(absencesConfigured(settingsFor({ assigneeProperty: null }))).toBe(false);

		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor({ targetProperty: null }));
		// Still dropped from the model — that is the TYPE's doing and unconditional — and
		// still not readable as anything.
		expect(model.byPath.has('Alice away.md')).toBe(false);
		expect(model.absences).toEqual([]);
	});

	it('refuses a range a hand edit broke, the same way the prompt refuses one', () => {
		// 4g: the prompt is not the only way frontmatter changes, and this plugin cannot
		// intercept Obsidian's own editor. One rule, asked of the note's own values as
		// well as of the settings, because "a range this axis cannot trust" is one fact.
		const vault = new FakeVault();
		vault.addFile('No end.md', { frontmatter: { type: 'Absence', assignee: 'A', start: '2026-08-01' } });
		vault.addFile('Reversed.md', {
			frontmatter: { type: 'Absence', assignee: 'A', start: '2026-08-09', due: '2026-08-02' },
		});
		vault.addFile('Unreadable.md', {
			frontmatter: { type: 'Absence', assignee: 'A', start: 'soon', due: '2026-08-02' },
		});
		vault.addFile('Nobody.md', {
			frontmatter: { type: 'Absence', start: '2026-08-01', due: '2026-08-02' },
		});

		const model = buildModel(vault.app, vault.entries(), settingsFor());

		// All four are dropped from the model by their type, and none of them draws:
		// there is no shelf for a written absence to fall back to.
		expect(model.items).toEqual([]);
		expect(model.absences).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/absences.test.ts --testTimeout=30000`
Expected: FAIL — `Cannot find module '../../src/domain/absences'`, and `model.absences` does not exist.

- [ ] **Step 3: Name it, in the module that names types**

In `src/domain/typeVocabulary.ts`, after `MARKER_TYPES`:

```ts
/**
 * The one DECLARED name that is not a work-item type at all — a resource's own
 * unavailable stretch. It joins none of the lists above and, deliberately, not
 * `ALL_TYPES` either: that list is what admits a name everywhere a work item's name
 * matters (`childTypeChoices` offers every entry at the top level, `focusTarget` accepts
 * one as a focus root, the shelf groups by it, the generated README and the in-app manual
 * document it as a declared type), and every one of those is exactly what an absence must
 * refuse. Keeping it out is what makes each of those consumers need NO edit, rather than
 * six exclusions somebody has to remember.
 *
 * It is the opposite POLARITY from a marker on the read, too: a marker is recognized and
 * KEPT — ranked out of the ladder, still a `BacklogItem` — while this is recognized and
 * DROPPED, never read as an item at all.
 *
 * Deliberately absent from `DEFAULT_TYPE_SUBFOLDERS`: an absence with no folder of its
 * own falls through to the home folder, which is what the spec asks for and what a type
 * this plugin ships no opinion about already gets.
 */
export const ABSENCE_TYPE = 'Absence';
```

In `src/domain/itemTypes.ts`, beside `isMarkerType`:

```ts
/**
 * A note this backlog recognizes in order to refuse it. Its own predicate rather than a
 * widened `isMarkerType`, for that predicate's own reason: the two answer opposite
 * questions, and the one call site here decides whether a note becomes an item at all.
 */
export function isAbsenceType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === ABSENCE_TYPE.toLowerCase();
}
```

- [ ] **Step 4: Write what an absence is, and when it can be read**

Create `src/domain/absences.ts`:

```ts
import { TFile } from 'obsidian';
import { CivilDate, ownValue, readDate, readString } from './noteFields';
import { BacklogSettings } from './settings';
import { reversedSpan } from './timeline';

/**
 * A resource's own unavailable stretch: four facts and no hierarchy. Deliberately not a
 * `BacklogItem` and deliberately not built from one — it has no parent, no rank, no
 * ladder rung and no state, so every field a `BacklogItem` carries would be a placeholder
 * here, and every walk that reads one would have to learn to skip it.
 *
 * Both ends are non-null by construction: `readAbsence` is the only producer and refuses
 * anything else, so nothing downstream has to ask whether a range is a range.
 */
export interface Absence {
	file: TFile;
	title: string;
	/** The resource whose row it draws in — matched case-insensitively, as bars are. */
	resource: string;
	start: CivilDate;
	target: CivilDate;
}

/**
 * Whether the configuration can carry an absence at all: BOTH date properties, and the
 * assignee that says whose row it is.
 *
 * Sharper than the resources axis's own gate, which accepts either date property alone
 * (`hasDateAxis`) — a work item with one end open infers the other from its subtree, and
 * an absence has nothing beneath it to infer from. Asked of CREATING one and of READING
 * one back, from this single definition: a note with both dates still in its frontmatter
 * must not be read as a one-ended ordinary range just because the setting naming its
 * other end went away, and nothing distinguishes that case from a note that was never a
 * two-ended absence.
 */
export function absencesConfigured(settings: BacklogSettings): boolean {
	return settings.assigneeKey !== '' && settings.startKey !== '' && settings.targetKey !== '';
}

/**
 * One absence, or null for anything this axis cannot trust to be what it claims.
 *
 * The same validation the prompt applies, applied again here — not belt-and-braces, but
 * the only reading that cannot mislead. The prompt is not the only way a note's
 * frontmatter changes: Obsidian's own editor is always available and this plugin cannot
 * intercept it, so a hand edit can produce the exact shapes the prompt was built to
 * refuse. A work item's answer to a broken range is the shelf ([[Bars from two dates]]),
 * and a written absence has no shelf — it draws in one row or nowhere — so the answer
 * here is nowhere, silently.
 */
export function readAbsence(
	file: TFile,
	fm: Record<string, unknown> | undefined,
	settings: BacklogSettings,
): Absence | null {
	if (!absencesConfigured(settings)) return null;
	const resource = readString(ownValue(fm, settings.assigneeKey));
	if (resource === null) return null;
	const start = readDate(ownValue(fm, settings.startKey));
	const target = readDate(ownValue(fm, settings.targetKey));
	// Both ends STATED and readable: `invalid` is a value the reader refused, and null is
	// a key that said nothing. Neither is a range.
	if (start.value === null || target.value === null) return null;
	// The same comparison a bar's own pair goes through, so "reversed" means one thing in
	// this plugin rather than two that must agree.
	if (reversedSpan(start.value, target.value)) return null;
	return { file, title: file.basename, resource, start: start.value, target: target.value };
}
```

- [ ] **Step 5: Divert the note where the cache is already open**

In `src/domain/readItems.ts`, `addItem` already reads `const typeName = readString(ownValue(fm, settings.typeKey));` immediately before building the `RawItem`. Return early there:

```ts
	// Hoisted out of the literal below because the dependency read now asks it too.
	const typeName = readString(ownValue(fm, settings.typeKey));
	// Recognized in order to be REFUSED, and refused here rather than by the scope prune:
	// `pruneOutsideHierarchy` runs only while `hierarchyOnly` is on, so a vault with it off
	// — where every note a folder-scoped Base returns becomes an item — would keep this one
	// as a real-looking task. That is the one inversion this whole feature exists to
	// prevent, so the gate is unconditional and sits before a `RawItem` exists at all.
	//
	// Read HERE rather than by a second pass over the same entries, which is what the
	// register projected: `addItem` is the only `getFileCache` call site in this layer and
	// `test/domain/modelCost.test.ts` pins one read per note loaded, so a second reader
	// would either double that count or have to read through `BasesEntry.getValue()`,
	// which this harness cannot answer at all. The cache is open on this line; nothing is
	// cheaper than using it.
	if (isAbsenceType(typeName)) {
		const absence = readAbsence(file, fm, settings);
		if (absence) store.absences.push(absence);
		// No seed either way: an absence has no parent, so it can never pull an ancestor
		// in, and `loadOutsideParents` must never be handed one.
		return null;
	}
```

Add `absences: Absence[]` to the `RawStore` interface and initialize it to `[]` wherever the store is built.

- [ ] **Step 6: Carry them off the store**

In `src/domain/model.ts`, add to `BacklogModel`:

```ts
	/**
	 * Every absence the Base returned, read but never made into an item — see
	 * `src/domain/absences.ts`. Beside the items rather than among them: nothing that
	 * walks the tree, ranks siblings, counts a rollup or draws a projection may meet one,
	 * and the only reader is the resources axis's own row derivation.
	 */
	absences: Absence[];
```

and fill it from the store in `buildModel`, beside where `items` is taken.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/domain/absences.test.ts test/domain/modelCost.test.ts test/domain/model.test.ts --testTimeout=30000`
Expected: PASS. `modelCost` is the one that proves the divert cost nothing — if `reads === items` still holds, no second cache read was added.

- [ ] **Step 8: Watch the unconditional claim fail**

Move the `isAbsenceType` early return so it runs only under `settings.hierarchyOnly`. Run the file. Expected: **"is dropped with hierarchyOnly off" FAILS** — the absence comes back as an item. Restore. That test is the whole difference between this and every other exclusion in the model.

- [ ] **Step 9: Lint and commit**

Run: `npx eslint src/domain/ test/domain/absences.test.ts`

```bash
git add src/domain/typeVocabulary.ts src/domain/itemTypes.ts src/domain/absences.ts src/domain/readItems.ts src/domain/model.ts test/domain/absences.test.ts
git commit -m "Recognize an absence in order to refuse it"
```

---

### Task 2: The row an absence belongs to

**Files:**
- Modify: `src/domain/roadmap.ts` (`ResourceLane`, `deriveLanes`)
- Test: `test/domain/resources.test.ts` (append — it already covers `deriveLanes`)

**Interfaces:**
- Consumes: `Absence`, `model.absences`.
- Produces: `ResourceLane.absences: Absence[]`.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/resources.test.ts` (match its existing fixture helpers; the assertions are what matter):

```ts
describe('absences in the row list', () => {
	it('draws in the row its own resource names, and nowhere else', () => {
		// Same vault, one absence for Alice.
		const roadmap = laneModel(withAbsence('Alice', '2026-08-04', '2026-08-06'));
		const alice = roadmap.lanes.find((l) => l.name === 'Alice');

		expect(alice?.absences.map((a) => a.title)).toEqual(['Away']);
		expect(roadmap.lanes.filter((l) => l.absences.length > 0)).toHaveLength(1);
	});

	it('mints a row for a resource nothing else names — a third source', () => {
		// 4b: an absence can be the first reason a row exists, extending the
		// declared-or-observed list rather than needing something assigned first.
		const roadmap = laneModel(withAbsence('Quinn', '2026-08-04', '2026-08-06'));
		const quinn = roadmap.lanes.find((l) => l.name === 'Quinn');

		expect(quinn).toBeDefined();
		expect(quinn?.declared).toBe(false);
		expect(quinn?.bars).toEqual([]);
		expect(quinn?.absences).toHaveLength(1);
	});

	it('joins the row a result already minted, matched as the bars are', () => {
		// Case-insensitively, the one matching rule this axis has.
		const roadmap = laneModel(withAbsence('alice', '2026-08-04', '2026-08-06'));

		expect(roadmap.lanes.filter((l) => l.name.toLowerCase() === 'alice')).toHaveLength(1);
		expect(roadmap.lanes.find((l) => l.name === 'Alice')?.absences).toHaveLength(1);
	});

	it('is never counted, and never changes what the shelf reports', () => {
		// The row's count is RESULT bars, exactly as a bucket's count is results. An
		// absence is neither a result nor a work item, so it moves no number here.
		const bare = laneModel(noAbsences());
		const withOne = laneModel(withAbsence('Alice', '2026-08-04', '2026-08-06'));

		expect(withOne.placedCount).toBe(bare.placedCount);
		expect(withOne.shelf.map((c) => c.item.title)).toEqual(bare.shelf.map((c) => c.item.title));
		expect(withOne.lanes.find((l) => l.name === 'Alice')?.bars.length).toBe(
			bare.lanes.find((l) => l.name === 'Alice')?.bars.length,
		);
	});

	it('draws on the other two axes not at all', () => {
		// It reaches `deriveLanes` and nothing else: the horizon axis and the plain dated
		// axis read `model.results`, which an absence was never in.
		const horizons = laneModel(withAbsence('Alice', '2026-08-04', '2026-08-06'), 'horizons');
		const dates = laneModel(withAbsence('Alice', '2026-08-04', '2026-08-06'), 'dates');

		expect(horizons.buckets.flatMap((b) => b.cards)).toHaveLength(bareCardCount);
		expect(dates.bars.map((b) => b.item.title)).not.toContain('Away');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/resources.test.ts --testTimeout=30000`
Expected: FAIL — `ResourceLane` has no `absences`.

- [ ] **Step 3: Give a row its second source**

In `src/domain/roadmap.ts`, add to `ResourceLane` and correct the seam comment while you are in it:

```ts
	/**
	 * Result bars, in tree order, positioned exactly as the dated axis positions one.
	 * Work items only — an absence is not a `BacklogItem` and so cannot be a `TimelineBar`,
	 * which is why it has a list of its own below rather than appending here.
	 */
	bars: TimelineBar[];
	/**
	 * This resource's own unavailable stretches — the row's second source, drawn beside
	 * its bars and counted with neither. Never a work item, so never in `bars`, never in
	 * the shelf and never in `placedCount`.
	 */
	absences: Absence[];
```

In `deriveLanes`, take the absences as a parameter and place them in a third pass, between the results and the context rows:

```ts
function deriveLanes(rows: BacklogItem[], settings: BacklogSettings, roadmap: RoadmapModel, absences: Absence[]): void {
	const lanes = settings.resourceNames.map(
		(name): ResourceLane => ({ name, declared: true, bars: [], absences: [], context: [] }),
	);
	const byName = new Map<string, ResourceLane>(lanes.map((lane) => [lane.name.toLowerCase(), lane]));
	for (const item of rows) {
		if (!item.outsideFilter) placeAssigned(item, lanes, byName, roadmap);
	}
	// Second, so a resource a result already named keeps the casing that result gave its
	// row — and third-source minting: unlike a context row, an absence MAY create a row,
	// because it is a statement this base's own notes make about a resource rather than a
	// value borrowed from a note the filter excluded.
	for (const absence of absences) laneFor(absence.resource, lanes, byName).absences.push(absence);
	for (const item of rows) {
		if (item.outsideFilter) placeContextLane(item, byName, roadmap);
	}
	roadmap.lanes = lanes;
	roadmap.bars = lanes.flatMap((lane) => lane.bars);
}

/** The row this name belongs to, minting a trailing one where nothing has yet. */
function laneFor(name: string, lanes: ResourceLane[], byName: Map<string, ResourceLane>): ResourceLane {
	const existing = byName.get(name.toLowerCase());
	if (existing) return existing;
	const lane: ResourceLane = { name, declared: false, bars: [], absences: [], context: [] };
	byName.set(name.toLowerCase(), lane);
	lanes.push(lane);
	return lane;
}
```

Have `placeAssigned` use `laneFor` too, so the minting rule is stated once rather than twice. `buildRoadmap` passes `model.absences` — no new parameter, since it already takes the model.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/domain/resources.test.ts test/domain/roadmap.test.ts --testTimeout=30000`
Expected: PASS.

- [ ] **Step 5: Watch the counting claim fail**

Add `lane.bars.length + lane.absences.length` wherever the row's count is derived (it is `lane.bars.length`, read in `renderLaneHead`). Run `test/view/resourceLanes.test.ts`. Expected: the counting test FAILS. Restore. An absence is placement, not population — the same rule a context row already keeps.

- [ ] **Step 6: Commit**

```bash
git add src/domain/roadmap.ts test/domain/resources.test.ts
git commit -m "Place an absence in the row its own resource names"
```

---

### Task 3: The blocked stretch

**Files:**
- Modify: `src/view/render/lanes.ts` (the entry kind, and the row), `src/view/render/timeline.ts` (≈4 lines), `styles/lanes.css`
- Test: `test/view/resourceAbsences.test.ts` (new)

**Interfaces:**
- Consumes: `barGeometry(window, span)` (`src/domain/timeline.ts`), `TimelineScale`, `TimelineWindow`.
- Produces: `TimelineEntry` gains `{ kind: 'absence'; absence: Absence }`; `export function renderLaneAbsence(content: HTMLElement, absence: Absence, ruler: { window: TimelineWindow; scale: TimelineScale }): HTMLElement`.

- [ ] **Step 1: Write the failing test**

Create `test/view/resourceAbsences.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { laneNames, lanesOf } from '../helpers/roadmap';

useViewHarness();

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Alice away.md', {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}

function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	return harness;
}

/** Every drawn line of the band, in order, headers and absences included. */
function bandOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row, .pbl-absence-row');
	return Array.from(rows).map((el) => {
		if (el.classList.contains('pbl-lane-head')) return `lane:${el.querySelector('.pbl-lane-name')?.textContent}`;
		if (el.classList.contains('pbl-absence-row')) return `away:${el.querySelector('.pbl-card-title')?.textContent}`;
		return el.querySelector('.pbl-card-title')?.textContent ?? '';
	});
}

describe('an absence on the resources axis', () => {
	it('draws in its own resource’s band, above that row’s work', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// Absences lead the band: an unavailable stretch is a fact about the ROW, and the
		// work in it reads against that rather than the other way round.
		expect(bandOrder(containerEl)).toEqual(['lane:Alice', 'away:Alice away', 'Work', 'lane:Bob']);
	});

	it('is positioned by the same date math a bar is', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const bar = containerEl.querySelector<HTMLElement>('.pbl-timeline-row .pbl-bar');
		const away = containerEl.querySelector<HTMLElement>('.pbl-absence');

		// Both offsets are days×dayPx from the same window origin, so a stretch that starts
		// three days after the bar sits three days to its right — asserted as the CSS
		// custom properties, since jsdom lays nothing out.
		expect(away?.style.getPropertyValue('--pbl-bar-left')).not.toBe('');
		expect(away?.style.getPropertyValue('--pbl-bar-left')).not.toBe(
			bar?.style.getPropertyValue('--pbl-bar-left'),
		);
	});

	it('gives a resource nothing else names a row of its own', () => {
		const vault = absenceVault();
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-02', due: '2026-08-03' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(laneNames(containerEl)).toEqual(['Alice', 'Bob', 'Quinn']);
	});

	it('stacks rather than packing: one line each, and the band grows', () => {
		// 4a. Two overlapping absences in one row draw as two lines — no lane-packing, no
		// second column, nothing moved aside to avoid the other.
		const vault = absenceVault();
		vault.addFile('Also away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-05', due: '2026-08-08' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(bandOrder(containerEl)).toEqual([
			'lane:Alice',
			'away:Alice away',
			'away:Also away',
			'Work',
			'lane:Bob',
		]);
	});

	it('counts for nothing on the header', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// Result bars only, the rule a context row already keeps.
		expect(lanesOf(containerEl)[0].querySelector('.pbl-lane-count')?.textContent).toBe('1');
	});

	it('draws nothing at all with one date property configured', () => {
		// 4d, at the surface: not a one-ended bar from the key that survives.
		const { containerEl } = laneRoadmap(absenceVault(), { targetProperty: null });

		expect(containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
	});

	it('never draws on the other two axes', () => {
		const harness = laneRoadmap(absenceVault(), { horizonProperty: 'note.horizon', horizonValues: 'Now, Next' });

		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		harness.view.setAxisPick('horizons');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/resourceAbsences.test.ts --testTimeout=30000`
Expected: FAIL — no `.pbl-absence-row` is drawn.

- [ ] **Step 3: Add the entry kind and the row**

In `src/view/render/lanes.ts`, extend `TimelineEntry` and `laneEntries`:

```ts
export type TimelineEntry =
	| { kind: 'lane'; lane: ResourceLane }
	| { kind: 'absence'; absence: Absence }
	| { kind: 'row'; row: TimelineRow }
	| { kind: 'context'; item: BacklogItem };
```

```ts
	for (const lane of lanes) {
		entries.push({ kind: 'lane', lane });
		// Absences lead the band: an unavailable stretch is a fact about the ROW, and the
		// work in it reads against that rather than the other way round. One entry each —
		// two overlapping stretches are two lines, never packed into one (4a), because a
		// packing rule is a second geometry to keep in step with the one the bars use.
		for (const absence of lane.absences) entries.push({ kind: 'absence', absence });
		for (const bar of lane.bars) {
			entries.push({ kind: 'row', row: { bar, hasChildren: false, collapsed: false } });
		}
		for (const item of lane.context) entries.push({ kind: 'context', item });
	}
```

and the row itself:

```ts
/**
 * One unavailable stretch, drawn where a bar would be drawn and by the same arithmetic —
 * `barGeometry` against the same window, so a stretch and the work it crosses cannot
 * disagree about which day is which.
 *
 * NOT a card: `createCard` gives a `BacklogItem` its selection, its context styling and
 * its place in the pane's roving walk, and an absence is none of those things — it is not
 * in `roadmap.cards`, cannot be selected, and has no note-opening activation. What it has
 * is a title, a range, and a context menu to delete it (`view/interactions/absences.ts`).
 *
 * The dates go in the row's own accessible name rather than on the mark: the mark is a
 * plain div, where ARIA prohibits a name, and a reader who cannot see the stretch needs
 * to be told whose row it is in and which days it covers — neither of which any
 * neighbouring element says for it.
 */
export function renderLaneAbsence(
	content: HTMLElement,
	absence: Absence,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): HTMLElement {
	const { window, scale } = ruler;
	const row = content.createDiv({ cls: 'pbl-timeline-row pbl-absence-row' });
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	drawIcon(lead.createSpan({ cls: 'pbl-absence-icon' }), 'user-x');
	const title = lead.createDiv({ cls: 'pbl-card-title', text: absence.title });
	setTooltip(title, absence.title);
	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	const geometry = barGeometry(window, { start: absence.start, target: absence.target });
	const mark = track.createDiv({ cls: 'pbl-absence' });
	mark.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * scale.dayPx}px`,
		'--pbl-bar-width': `${Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = `${formatCivil(absence.start)} → ${formatCivil(absence.target)}`;
	setTooltip(mark, dates);
	row.setAttribute('aria-label', `${absence.title} — unavailable ${dates}`);
	return row;
}
```

- [ ] **Step 4: Draw it from the entries loop**

In `src/view/render/timeline.ts`, add the branch beside the `'lane'` one (the loop already holds `window` and `scale`):

```ts
		if (entry.kind === 'absence') {
			// Its own drawn line, and NOT counted as a bar row: the stripe alternates over
			// work, and an absence is furniture of the row rather than a row of work in it.
			const away = renderLaneAbsence(content, entry.absence, { window, scale });
			if (lane) renderLaneRowDescription(away, lane.name);
			continue;
		}
```

- [ ] **Step 5: Style the blocked stretch**

Append to `styles/lanes.css`:

```css
/* An unavailable stretch. Hatched rather than filled, and muted rather than coloured: a
   bar is work somebody planned and this is the absence of any, so the two must not read
   alike at a glance — the same argument `.pbl-bar-inferred` makes for outlining a span
   the view derived rather than one a note stated. It carries no state colour, no grip and
   no connector, because none of those means anything here. */
.pbl-absence {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	left: var(--pbl-bar-left);
	width: var(--pbl-bar-width);
	height: 12px;
	border-radius: var(--radius-s);
	background-image: repeating-linear-gradient(
		45deg,
		var(--background-modifier-border) 0,
		var(--background-modifier-border) 4px,
		transparent 4px,
		transparent 8px
	);
	border: 1px solid var(--background-modifier-border);
}

/* Muted like a context row, and for a related reason: it is here to say what the row
   cannot take, not to be read as part of the plan. */
.pbl-absence-row {
	opacity: 0.8;
}

.pbl-absence-row .pbl-timeline-track {
	min-height: 22px;
}

.pbl-absence-icon {
	display: flex;
	align-items: center;
	color: var(--text-muted);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/resourceLanes.test.ts test/view/resourceMoves.test.ts --testTimeout=30000`
Expected: PASS. The two existing suites are the regression check that nothing about the band's bars moved.

- [ ] **Step 7: Watch the stripe claim fail**

Let the absence branch fall through to `drawnRows++`. Run `test/view/resourceLanes.test.ts` and `test/view/timelineFurniture.test.ts`. Expected: a `pbl-row-even` assertion FAILS — an absence would flip the parity of every work row beneath it. Restore. If nothing fails, add the assertion: the claim in the comment is that the stripe counts work rows only.

- [ ] **Step 8: Lint, build and commit**

Run: `npx eslint src/view/render/ test/view/resourceAbsences.test.ts && npm run build`
Expected: clean — `timeline.ts` gained ≈4 lines against 23 of headroom, and `lanes.css` is nowhere near its cap.

```bash
git add src/view/render/lanes.ts src/view/render/timeline.ts styles/lanes.css test/view/resourceAbsences.test.ts
git commit -m "Draw an absence as a blocked stretch in its own resource's row"
```

---

### Task 4: A folder of its own, without joining the list

**Files:**
- Modify: `src/domain/settingsResolve.ts` (one call site), `src/domain/viewOptions.ts` (one option)
- Test: `test/domain/absences.test.ts` (append), and `test/docs/surfaces.test.ts` must pass unchanged

**Interfaces:**
- Consumes: `typeFolderKey('Absence') === 'typeFolder.absence'`, `resolveFolders(read, types, fallback)`, `folderForType(typeName, settings)`.
- Produces: `settings.typeFolders.absence`.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/absences.test.ts`:

```ts
describe('where an absence is filed', () => {
	it('has a folder option of its own, resolved like every other type’s', () => {
		const settings = settingsFor({ 'typeFolder.absence': 'docs/absences' });

		expect(folderForType(ABSENCE_TYPE, settings)).toBe('docs/absences');
	});

	it('falls back to the home folder rather than to a shipped subfolder', () => {
		// 3a. Deliberately absent from `DEFAULT_TYPE_SUBFOLDERS`: sharing the home folder
		// with every other type's notes is safe, because what keeps an absence out of the
		// tree and the other axes is its TYPE and never its folder.
		const settings = settingsFor({ homeFolder: 'docs' });

		expect(folderForType(ABSENCE_TYPE, settings)).toBeNull();
		expect(settings.homeFolder).toBe('docs');
	});

	it('reaches that folder without joining the work-item vocabulary', () => {
		// The criterion stated at both ends: the key exists, and the list that drives every
		// creator menu, focus target and shelf group does not contain the name.
		expect(typeFolderKey(ABSENCE_TYPE)).toBe('typeFolder.absence');
		expect(ALL_TYPES).not.toContain(ABSENCE_TYPE);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/absences.test.ts --testTimeout=30000`
Expected: FAIL — `folderForType('Absence', settings)` is null even when the option is set, because nothing resolves that key.

- [ ] **Step 3: Resolve one more folder than the list has**

In `src/domain/settingsResolve.ts`, at the `resolveFolders` call:

```ts
	// `ALL_TYPES` plus the one declared name that is deliberately not in it. Passed as a
	// local array rather than by widening the vocabulary: `resolveFolders` already takes
	// the types it should resolve, so this reuses the whole per-type shape — the option
	// key, the clearable read, the home-folder fallback — without any consumer of
	// `ALL_TYPES` seeing a seventh entry it would then have to exclude.
	const folders = resolveFolders({ str, clearable }, [...ALL_TYPES, ABSENCE_TYPE], fallback);
```

In `src/domain/viewOptions.ts`, the same widening at the folder-picker generator:

```ts
			// One picker per type, in ladder order then the extras — and then the absence,
			// which has a folder like any other note this plugin writes and is a type in no
			// other sense. `defaultTypeFolder` answers '' for it, so the box shows the home
			// folder as its placeholder and an unset option files it there.
			...[...ALL_TYPES, ABSENCE_TYPE].map(
```

Both files import `ABSENCE_TYPE`; neither imports it into `view/`, so `ALL_TYPES_IMPORT`'s lint rule is unaffected.

- [ ] **Step 4: Verify the surfaces gate — the one nothing else tells you**

Run: `npx vitest run test/docs/surfaces.test.ts --testTimeout=30000`
Expected: PASS, and it must pass *for the right reasons*. Confirm both by hand before believing it:

- `typeFolder.absence` is named in a requirement — `docs/requirements/Resource absences.md` carries it in a code span. Check with `grep -n 'typeFolder.absence' docs/requirements/`.
- Exactly one setup entry claims it — `src/view/manual/setupSection.ts:132` claims the family `typeFolder.*`, and the matcher treats a `prefix.*` claim as covering every key under it. Check with `grep -n "typeFolder" src/view/manual/setupSection.ts`.

If either is missing, add it: the requirement mention goes in the spec's own prose, the manual claim in the existing folders entry — never a second entry, which the test refuses.

- [ ] **Step 5: Run the tests and commit**

Run: `npx vitest run test/domain/absences.test.ts test/docs/surfaces.test.ts test/domain/settings.test.ts --testTimeout=30000`

```bash
git add src/domain/settingsResolve.ts src/domain/viewOptions.ts test/domain/absences.test.ts
git commit -m "Give an absence a folder option without widening the vocabulary"
```

---

### Task 5: Add absence

**Files:**
- Modify: `src/ui/prompts.ts`, `src/view/render/lanes.ts`, `src/storage/frontmatter.ts` (export two helpers)
- Create: `src/storage/absenceNotes.ts`, `src/view/interactions/absences.ts`
- Test: `test/view/resourceAbsences.test.ts` (append)

**Interfaces:**
- Consumes: `configProblems(settings)`, `absencesConfigured(settings)`, `folderForType(ABSENCE_TYPE, settings)`, `settings.homeFolder`, `ensureFolder`, `sanitizeTitle`.
- Produces:
  - `export class AbsencePromptModal extends PromptModal<AbsencePromptOptions>` with `onSubmit: (result: { resource: string; title: string; start: string; target: string }) => void`
  - `export async function createAbsenceNote(app: App, settings: BacklogSettings, spec: { folder: string; title: string; resource: string; start: string; target: string }): Promise<TFile>`
  - `export function promptAddAbsence(host: BacklogViewHost, lane: ResourceLane): void`
  - `export function uniqueNotePath(app: App, folder: string, title: string): string` (extracted from `createBacklogItem`)

- [ ] **Step 1: Write the failing test**

Append to `test/view/resourceAbsences.test.ts` (add `Modal, Notice` from `../helpers/obsidian-mock` and `flush` from `../helpers/view`):

```ts
describe('adding an absence', () => {
	/** The header's own Add button for a row. */
	function addButton(containerEl: HTMLElement, name: string): HTMLButtonElement | null {
		const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
		return head?.querySelector<HTMLButtonElement>('.pbl-lane-absence-add') ?? null;
	}

	it('offers itself on a row header, tabindex -1 like every other per-row control', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const add = addButton(containerEl, 'Alice');

		expect(add).not.toBeNull();
		expect(add?.getAttribute('tabindex')).toBe('-1');
		expect(add?.getAttribute('aria-label')).toBe('Add absence for Alice');
	});

	it('is withheld with only one date property configured', () => {
		// 1a: sharper than the axis's own gate, which accepts either date alone. An
		// absence's range needs both ends written and has nothing beneath it to infer from,
		// so the control is absent rather than opening onto a form that cannot be satisfied.
		const { containerEl } = laneRoadmap(absenceVault(), { targetProperty: null });

		expect(addButton(containerEl, 'Alice')).toBeNull();
	});

	it('writes one note with exactly four facts, and no hierarchy at all', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { 'typeFolder.absence': 'docs/absences' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ title: 'Conference', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		const fm = vault.fm('docs/absences/Conference.md');
		expect(fm['type']).toBe('Absence');
		expect(fm['assignee']).toBe('Bob');
		expect(fm['start']).toBe('2026-09-01');
		expect(fm['due']).toBe('2026-09-04');
		// No parent, no order: it is not in the hierarchy and has no rank among anything.
		expect('parent' in fm).toBe(false);
		expect('order' in fm).toBe(false);
	});

	it('files it in the home folder when it has no folder of its own', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { homeFolder: 'docs' });

		addButton(containerEl, 'Bob')?.click();
		submitAbsence({ title: 'Conference', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('docs/Conference.md')['type']).toBe('Absence');
	});

	it('is blocked by the config gate, exactly as every other write', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault, { orderProperty: 'note.parent' });

		addButton(containerEl, 'Alice')?.click();

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('writes nothing for a blank field or a reversed range', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		const before = vault.writeLog.length;

		addButton(containerEl, 'Alice')?.click();
		// 2b: caught at the prompt, which stays open — there is no shelf for a written
		// absence to land on, so there would be no surface to show the mistake afterwards.
		expect(submitAbsence({ title: 'Away', start: '2026-09-04', target: '2026-09-01' })).toBe(false);
		// 2a: a range needs both ends stated.
		expect(submitAbsence({ title: 'Away', start: '2026-09-04', target: '' })).toBe(false);
		await flush();

		expect(vault.writeLog).toHaveLength(before);
	});
});
```

Add a `submitAbsence` helper beside the file's others, driving the real modal through `Modal.lastOpened` the way `submitPrompt` in `test/helpers/view.ts` drives `TitlePromptModal` — returning false when the modal refused and stayed open.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/resourceAbsences.test.ts --testTimeout=30000`
Expected: FAIL — no `.pbl-lane-absence-add` exists.

- [ ] **Step 3: The prompt**

In `src/ui/prompts.ts`, after `SchedulePromptModal`:

```ts
export interface AbsenceResult {
	resource: string;
	title: string;
	start: string;
	target: string;
}

export interface AbsencePromptOptions {
	heading: string;
	description: string;
	/** Pre-filled from the row it was opened on, and editable — the row is a default, not a lock. */
	resource: string;
	/** Names to suggest, so spellings stay consistent with the rows already drawn. */
	known: string[];
	/** Refuse with a reason, keeping the prompt open. What a date IS belongs to the layer that reads them. */
	validate: (result: AbsenceResult) => string | null;
	onSubmit: (result: AbsenceResult) => void;
}

/**
 * Prompt asking for one resource's unavailable stretch: who, what to call it, and both
 * ends of the range. Both ends, always — this is the one form in this file where an empty
 * date is not a real answer, because an absence with one end has nothing beneath it to
 * infer the other from and no shelf to wait on.
 *
 * The fields are `type="date"` for `SchedulePromptModal`'s own reason: the platform's
 * picker, and the only values that can come back are a calendar date or nothing.
 * `validate` is asked rather than decided here, which is what keeps `ui/` free of the
 * domain — the same contract the schedule prompt already has.
 */
export class AbsencePromptModal extends PromptModal<AbsencePromptOptions> { /* … */ }
```

Model the body on `SchedulePromptModal`: a description line, an error element rendered up front, a resource field with `KnownValueSuggest`, a title field, two date fields, and a `Save` CTA calling `validate` before `onSubmit`.

- [ ] **Step 4: The write**

First, in `src/storage/frontmatter.ts`, extract the unique-path loop out of `createBacklogItem` so both creators name notes the same way (net zero lines there — five out, one call in):

```ts
/**
 * The path a new note takes: the sanitized title in the folder, suffixed until nothing is
 * there. Shared by both creators, so an absence and a work item cannot disagree about what
 * a title becomes on disk or about what happens when the name is taken.
 */
export function uniqueNotePath(app: App, folder: string, title: string): string {
	const base = sanitizeTitle(title);
	const filePath = (name: string) => (folder ? normalizePath(`${folder}/${name}.md`) : `${name}.md`);
	let path = filePath(base);
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) path = filePath(`${base} ${i}`);
	return path;
}
```

Then create `src/storage/absenceNotes.ts`:

```ts
/**
 * The two vault acts an absence has, and the only two: create the note, and trash it.
 *
 * Its own module rather than a pair of functions in `frontmatter.ts`, for two reasons that
 * point the same way. That file is at its 400-line budget. And neither act goes through
 * `applyWrites`: an absence is not a write target of this backlog — no batch, no captured
 * inverse, no undo slot — so putting them beside the batch writer would file them under a
 * mechanism they deliberately do not use. What they DO share with it is the rule that
 * makes `storage/` a boundary at all: everything that puts bytes in the vault is in this
 * directory.
 *
 * `createAbsenceNote` is not `createBacklogItem` with different arguments. That function's
 * `NewItemSpec` carries a parent, a rank and a type chosen from the ladder, and an absence
 * has none of the three — it would be three fields passed as null and a fourth passed as a
 * constant, which is a different function wearing another's signature.
 */
export async function createAbsenceNote(app: App, settings: BacklogSettings, spec: AbsenceSpec): Promise<TFile> {
	const folder = vaultFolder(spec.folder);
	await ensureFolder(app, folder);
	const path = uniqueNotePath(app, folder, spec.title);
	// One atomic write, `createBacklogItem`'s own rule: a create-then-update pair could
	// fail in between and leave a note that is an absence in name and a blank note in fact.
	const fm: Record<string, unknown> = {
		[settings.typeKey]: ABSENCE_TYPE,
		[settings.assigneeKey]: spec.resource,
		[settings.startKey]: spec.start,
		[settings.targetKey]: spec.target,
	};
	return app.vault.create(path, `---\n${stringifyYaml(fm)}---\n`);
}
```

Every key here is known non-empty: `absencesConfigured` is the caller's gate and `typeKey` always resolves.

- [ ] **Step 5: The view's side**

Create `src/view/interactions/absences.ts` holding `promptAddAbsence(host, lane)`: run `configProblems` first (an action that opened a form and then had its write refused would waste the user's typing), resolve the folder as `folderForType(ABSENCE_TYPE, settings) || settings.homeFolder`, open the prompt pre-filled with `lane.name` and suggesting the drawn row names, validate (all four present, `target >= start` — a string comparison, since zero-padded ISO dates order lexically exactly as the calendar does), write, and `new Notice(...)` naming what was created.

In `src/view/render/lanes.ts`, add the button to `renderLaneHead`'s lead, beside the New button and gated:

```ts
/**
 * Mark this resource unavailable for a stretch. Gated on `absencesConfigured` rather than
 * on the axis being drawn — sharper than the axis's own precondition, which accepts either
 * date property alone — so the control is absent rather than opening a form whose range
 * could never be written.
 *
 * `tabindex="-1"` like the row's New button and the tree's add button, and with the same
 * gap behind it: the pane is one tab stop and a row is not a keyboard stop, so there is no
 * keyboard route to this control. Closing that properly means row stops, which is
 * `docs/requirements/Keyboard and menu on the roadmap.md`'s work — the identical statement
 * the bucket's New button already carries, not a new one.
 */
function renderLaneAbsenceAdd(ctx: RowContext, lead: HTMLElement, lane: ResourceLane): void {
	if (!absencesConfigured(ctx.host.settings)) return;
	const btn = lead.createEl('button', {
		cls: 'clickable-icon pbl-lane-absence-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `Add absence for ${lane.name}` },
	});
	drawIcon(btn, 'user-x');
	setTooltip(btn, `Add absence for "${lane.name}"`);
	btn.addEventListener('click', () => promptAddAbsence(ctx.host, lane));
}
```

Style it in `styles/lanes.css` by joining `.pbl-lane-add`'s existing hover/`@media (hover: none)` selectors rather than writing a second copy of them.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/creation.test.ts --testTimeout=30000`
Expected: PASS. `creation.test.ts` is the regression check on the `uniqueNotePath` extraction.

- [ ] **Step 7: Watch the gate fail**

Drop the `absencesConfigured` guard from `renderLaneAbsenceAdd`. Run the file. Expected: **"is withheld with only one date property configured" FAILS**. Restore. Then remove the `configProblems` check from `promptAddAbsence` and expect the config-gate test to fail. Restore.

- [ ] **Step 8: Lint and commit**

Run: `npx eslint src/ui/prompts.ts src/storage/ src/view/interactions/absences.ts src/view/render/lanes.ts test/view/resourceAbsences.test.ts`

```bash
git add src/ui/prompts.ts src/storage/frontmatter.ts src/storage/absenceNotes.ts src/view/interactions/absences.ts src/view/render/lanes.ts styles/lanes.css test/view/resourceAbsences.test.ts
git commit -m "Write an absence from a resource's row header"
```

---

### Task 6: Deleting one

**Files:**
- Modify: `src/storage/absenceNotes.ts`, `src/view/interactions/absences.ts`, `src/view/render/lanes.ts`, `test/helpers/vault.ts`
- Test: `test/view/resourceAbsences.test.ts` (append)

**Interfaces:**
- Consumes: `app.fileManager.trashFile(file)`.
- Produces: `export async function deleteAbsenceNote(app: App, file: TFile): Promise<void>`; `export function showAbsenceMenu(host: BacklogViewHost, absence: Absence, evt: MouseEvent): void`.

- [ ] **Step 1: Extend the fake vault**

`test/helpers/vault.ts`'s `fileManager` has only `processFrontMatter`. Add the one method this uses, keeping it minimal as `test/CLAUDE.md` asks:

```ts
			/** Obsidian's own delete-to-trash, recorded so a test can assert the note went. */
			trashFile: async (file: TFile) => {
				this.files.delete(file.path);
				this.frontmatter.delete(file.path);
				this.trashed.push(file.path);
			},
```

with `readonly trashed: string[] = []` beside `writeLog`.

- [ ] **Step 2: Write the failing test**

```ts
describe('deleting an absence', () => {
	it('offers a delete on the stretch’s own context menu, and nothing else', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const row = containerEl.querySelector<HTMLElement>('.pbl-absence-row');

		row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		// Not `buildItemMenu`: every entry in that menu is about a work item — a type, a
		// state, a parent link, a rank — and an absence has none of them.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Delete absence']);
	});

	it('removes the note through Obsidian’s own delete, not through the gate', async () => {
		const vault = absenceVault();
		const { view, containerEl } = laneRoadmap(vault);
		containerEl
			.querySelector<HTMLElement>('.pbl-absence-row')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		Menu.lastShown?.item('Delete absence')?.clickHandler?.();
		await flush();

		expect(vault.trashed).toEqual(['Alice away.md']);
		// No batch was captured, so there is nothing for undo to take back — the note was
		// never one of this backlog's write targets.
		expect(vault.writeLog).toEqual([]);
		expect(view.canUndo()).toBe(false);
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run test/view/resourceAbsences.test.ts -t "deleting" --testTimeout=30000`
Expected: FAIL — no menu opens.

- [ ] **Step 4: Implement**

In `src/storage/absenceNotes.ts`:

```ts
/**
 * Remove the note, through Obsidian's OWN delete rather than this backlog's undo.
 *
 * There is no batch to reverse: an absence was never one of this plugin's write targets,
 * so the gate captured no inverse of the write that created it and has none of the
 * deletion either. `trashFile` honours the user's own "deleted files" setting, which is
 * the recovery path that belongs to a whole note going away — and the one the user
 * already knows, since it is every other note's.
 */
export async function deleteAbsenceNote(app: App, file: TFile): Promise<void> {
	await app.fileManager.trashFile(file);
}
```

In `src/view/interactions/absences.ts`, a small `showAbsenceMenu` opening a `Menu` with the one entry (icon `trash-2`), calling `deleteAbsenceNote` and reporting failure through a `Notice`. Wire it in `renderLaneAbsence` with a `contextmenu` listener — the row is not a card, so `wireCardActivation` is not involved and there is nothing to guard against bubbling into.

- [ ] **Step 5: Run the tests, watch the undo claim, and commit**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/undo.test.ts --testTimeout=30000`
Expected: PASS.

Then route the delete through `host.applySafely` instead and re-run. Expected: it cannot even be expressed — `ItemWrite` names a `file` and a set of frontmatter changes, and there is no "remove the note" among them. That is the check, and it is a compile error rather than a test: record it in the note rather than pretending a test drives it.

```bash
git add src/storage/absenceNotes.ts src/view/interactions/absences.ts src/view/render/lanes.ts test/helpers/vault.ts test/view/resourceAbsences.test.ts
git commit -m "Delete an absence through Obsidian's own delete"
```

---

### Task 7: The register, the ADR, the changelog, and the whole check

**Files:**
- Modify: `docs/requirements/Resource absences.md`, `docs/requirements/Showing a resources axis on the roadmap.md`, `CHANGELOG.md`, possibly `vitest.config.mts`
- Create: `docs/adrs/0028-absence-is-a-reserved-name-outside-the-vocabulary.md`

- [ ] **Step 1: Correct the sibling's seam sentence**

In `docs/requirements/Showing a resources axis on the roadmap.md`, the last paragraph promises the wrong seam. Replace:

```markdown
What is genuinely new is the row-grouping walk itself, and where an absence's bar merges
into it. `ResourceLane.bars` is a plain list the renderer walks, which is the seam
[[Resource absences]] needs: a second source appends to it rather than changing how a row
is drawn.
```

with:

```markdown
What is genuinely new is the row-grouping walk itself, and where an absence merges into
it. A row draws from a list per SOURCE and the renderer walks each — which is the seam
[[Resource absences]] needed, though not in the shape this paragraph first promised: it
said a second source would append to `ResourceLane.bars`, and it cannot, because
`TimelineBar.item` is a `BacklogItem` and an absence is deliberately never one. The seam
held; the sentence was wrong about which list. `ResourceLane.absences` is the second one,
added 2026-08-13.
```

- [ ] **Step 2: Rewrite this PBI's frontmatter and `## Where it lives`**

Set `status: Done` — every acceptance criterion is met, and unlike its two siblings this note has no criterion deferred. Add the `files:` list (every module in the File Structure section above). Rewrite `## Where it lives` to state what was built, and to record these four things explicitly:

1. **Why the reader sits in `addItem`** rather than in a second pass — the `modelCost` invariant and the `getValue()` dead end, both named, since the previous text projected the opposite and an implementer reading it would build something the suite refuses.
2. **`ResourceLane.absences`**, and that the sibling's "appends to `bars`" sentence was corrected rather than satisfied.
3. **The keyboard gap**: neither Add absence nor Delete absence has a keyboard path, in the bucket New button's own words, pointing at `Keyboard and menu on the roadmap`.
4. **What a live vault still owes**: how the hatched stretch reads against a themed background and against a bar it overlaps, whether a screen reader announces an absence row usefully among `option` rows, and the delete's confirmation behaviour under the user's own "deleted files" setting — jsdom paints nothing and trashes nothing.

- [ ] **Step 3: Write ADR 0028**

`docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md` is what this touches, and the spec is explicit that expanding this vocabulary "has always been a considered act rather than a silent one". Write a short ADR in the repository's own frontmatter shape (copy 0027's), recording:

- **Decision**: `Absence` is a declared, reserved type name that joins no vocabulary list, including `ALL_TYPES`. It names `src/domain/typeVocabulary.ts`'s `ABSENCE_TYPE` and `src/domain/absences.ts`.
- **Context**: every other name this vocabulary has added is KEPT polarity and RECLASSIFIES a same-named note; this is the first DROPPED one, so a note that coincidentally carried `type: Absence` vanishes from every projection the moment the feature ships rather than merely rendering differently.
- **Consequences**: accepted as the honest cost of a plain, guessable name a user must be able to type into their own Base query (extension 4e); an obscure collision-proof string would trade a rare migration surprise for an everyday usability cost on every vault. Recorded with a release-note callout, not engineered around.

Run `npm run docs` after — the ADR frontmatter shape is gated.

- [ ] **Step 4: The changelog, with the callout the ADR asks for**

Add to `[Unreleased]`:

```markdown
- **Mark a resource unavailable** — **Add absence** on a row header writes a note saying
  who is away and for how long, and that stretch draws as a blocked band in their row and
  nowhere else. It is never a backlog item: it has no parent, no rank and no state, it
  never appears in the tree, on a board or on the other roadmap axes, and it is deleted
  through Obsidian's ordinary file delete rather than this plugin's undo. Needs both date
  properties configured — an absence has no children to infer a missing end from.

### Changed

- **`Absence` is now a reserved type name.** If a note in your vault already uses
  `Absence` as an informal value of your type property, it will stop appearing in every
  projection — the plugin now reads that name as "a resource is away", not as work. Rename
  the value on those notes to keep them in the backlog.
```

- [ ] **Step 5: Run the whole check**

Run: `npx vitest run --coverage --testTimeout=30000`
Then: `npm run build && npm run lint && npm run analyze && npm run docs`

Run all four explicitly. If the tests trip the Windows timeout flake, `analyze` and `docs` never ran and a green-looking `npm run check` verified neither.

- [ ] **Step 6: Ratchet the coverage thresholds if they moved up**

Raise any of the four totals in `vitest.config.mts` that the run reports above its threshold. Never lower one: a bar that drops is a branch this feature added and did not cover, and the fix is a test.

- [ ] **Step 7: Commit, and offer the handover**

```bash
git add "docs/requirements/Resource absences.md" "docs/requirements/Showing a resources axis on the roadmap.md" docs/adrs/0028-absence-is-a-reserved-name-outside-the-vocabulary.md CHANGELOG.md vitest.config.mts
git commit -m "Record absences, and the name they reserve"
```

Then offer, in order of cost: `npm run harness` (the hatched stretch against the real stylesheet, and how it reads beside a bar it overlaps — Obsidian's default colours only), and `npm run test-build` (this repository opened as a vault, which is what discharges the live-vault list). Say which owed checks each can and cannot make.

---

## Self-review

**Spec coverage.** Main flow 1–4: Tasks 5 (trigger, prompt, write) and 3 (draw). 1a: Task 5 step 1, "withheld with only one date property". 2a/2b: Task 5, "writes nothing for a blank field or a reversed range". 3a: Task 4, "falls back to the home folder". 4a: Task 3, "stacks rather than packing". 4b: Tasks 2 and 3, minting. 4c: Task 6. 4d: Tasks 1 and 3. 4e: out of scope, the Feature's landmine — recorded, not built. 4f: not migrated, recorded in the note. 4g: Task 1, "refuses a range a hand edit broke". 4h: Task 7's ADR and changelog callout.

Every acceptance criterion maps onto one of those. The two the plan meets differently from the spec's `## Where it lives` — the reader's location and the `bars` seam — are stated at the top of this plan and are corrections rather than gaps: no criterion changes.

**Placeholders.** Two steps deliberately describe rather than spell: `AbsencePromptModal`'s body (Task 5 step 3) and `showAbsenceMenu` (Task 6 step 4), both of which are close copies of a named existing function in the same file — `SchedulePromptModal` and `chipMenu` respectively. Every other step carries its code. If an executor cannot see the model to copy, that is a plan failure: read the named function first.

**Type consistency.** `Absence` has the same five fields at every use — `file`, `title`, `resource`, `start`, `target`, both dates `CivilDate` and non-null by construction. `absencesConfigured(settings)` is the single gate name in the domain, the render and the button. `ABSENCE_TYPE` is the only spelling of the string; nothing compares against a literal `'Absence'` outside `isAbsenceType`.
