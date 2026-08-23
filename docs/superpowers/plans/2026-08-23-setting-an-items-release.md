# Setting an item's release — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user put a work item in a release, or take it out, from the backlog view's menus and the keyboard — so the release view merged in the first increment finally has something to show.

**Architecture:** It mirrors `Set iteration` at every layer. The item gains a parsed release entry and a presence flag; `domain/writePlan.ts` gains one pure planner; one host method is the single place the write is planned and announced; the menu and the keyboard both call it. The value is written as a **link**, not a label.

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom), eslint with per-directory `no-restricted-imports`, fallow, `scripts/docs-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-23-setting-an-items-release-design.md`

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`; each may reach anything below it and nothing above. `ui/` and `i18n/` are leaves. Violations fail `npm run lint`.
- **400-line maximum per source file** (lint, `skipBlankLines`/`skipComments`); `test/**` has 450.
- **Never write frontmatter outside** `storage/frontmatter.ts`, `storage/createNote.ts`, `storage/absenceNotes.ts`, `storage/propertyWrite.ts`. This increment adds no new writer — it adds a planner and routes it through the existing gate.
- **Every user-visible string goes through `t()`** from `i18n/t.ts`; `src/i18n/en.ts` is data (no imports, no logic). A property key, a type name or a CSS class is **data** and never enters the catalog. Two shapes the lint bans cannot see, both of which have shipped here: a template whose FIRST QUASI IS EMPTY, and a sentence passed as a positional ARGUMENT or returned from a helper.
- **Nothing builds a sentence by joining pieces.** List joining and plurals are grammar: pass an array and let the catalog join it.
- **`view/release/` still writes nothing.** This increment does not touch it. `test/view/releaseWritesNothing.test.ts` must stay green untouched.
- **One move, N inputs:** the menu and the keyboard land on ONE host method, which is the only place the batch is planned and the only place it is announced.
- **A Set menu's checkmark is asked of the PLAN** — an entry is checked exactly when picking it would write nothing. Never a comparison written beside the plan.
- **An unconfigured key is never written to.**
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) passes. Coverage thresholds only ever go up. CI runs the same on Ubuntu **and** Windows.
- **Commit after every task.** `CHANGELOG.md` gains its `[Unreleased]` entry in Task 7.

---

### Task 1: `release` joins the optional properties

The presence flag the "no release" entry gates on is `item.ownKeys`, which is
`Record<OptionalField, boolean>`. So the field has to exist in that vocabulary before
anything can ask about it.

**READ FIRST — this task touches a guard with a warning on it.** `mayHoldField`
(`src/domain/itemTypes.ts`) carries a docstring saying **"Do not widen it from this comment"**
and naming two wrong bodies already written. Read it, and read
`docs/issues/Creation seeds a placement the type may not hold.md`, before editing.

**What you are permitted to do:** give the NEW `release` field its own answer.
**What you must NOT do:** change which types may hold any EXISTING field. A `Milestone`'s and
an `Iteration`'s shipped behaviour for `start`, `target`, `horizon`, `iteration` and
`iterationGoal` must be byte-identical after this task.

**Files:**
- Modify: `src/domain/optionalProperties.ts` (`OptionalField`, `PROPERTY_TABLE`)
- Modify: `src/domain/itemTypes.ts` (`mayHoldField`)
- Test: `test/domain/optionalProperties.test.ts`, `test/domain/liveTypeKeys.test.ts`

**Interfaces:**
- Produces: `'release'` as a member of `OptionalField`; `optionalProperty('release')` answering with the suggested key name; `mayHoldField(type, 'release', settings)` false for every marker type and true for plan work.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/optionalProperties.test.ts`:

```ts
it('offers a release property, suggested beside the other optional ones', () => {
	expect(OPTIONAL_FIELDS).toContain('release');
	// The suggested name is DATA — it is what a vault writes, not text somebody reads.
	expect(optionalProperty('release').suggested).toBe('release');
});
```

Add to `test/domain/liveTypeKeys.test.ts`:

```ts
describe('which types may hold a release', () => {
	it('refuses every marker and admits plan work', () => {
		const settings = settingsWith({ releaseKey: 'release' });
		// A release holds WORK, and a marker is not work — the reader already refuses
		// such a note; this is the same rule at the writing end.
		for (const marker of ['Milestone', 'Iteration', 'Release']) {
			expect(mayHoldField(marker, 'release', settings)).toBe(false);
		}
		for (const work of ['Epic', 'Feature', 'PBI', 'Task']) {
			expect(mayHoldField(work, 'release', settings)).toBe(true);
		}
	});

	it('leaves every other field''s answer exactly as it was', () => {
		const settings = settingsWith({ releaseKey: 'release' });
		// The guard this task edits carries a warning against widening it. These are the
		// shipped answers; none of them may move.
		expect(mayHoldField('Release', 'horizon', settings)).toBe(false);
		expect(mayHoldField('Release', 'iteration', settings)).toBe(false);
		expect(mayHoldField('Milestone', 'horizon', settings)).toBe(true);
		expect(mayHoldField('Iteration', 'start', settings)).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/domain/optionalProperties.test.ts test/domain/liveTypeKeys.test.ts`
Expected: FAIL — `'release'` is not assignable to `OptionalField`.

- [ ] **Step 3: Implement**

In `src/domain/optionalProperties.ts`, add `| 'release'` to the `OptionalField` union and an
entry to `PROPERTY_TABLE`. Follow the shape of the `iteration` entry exactly — read it and
copy its fields, including whatever it states for the suggested name and the display name key.

In `src/domain/itemTypes.ts`, `mayHoldField` currently opens with
`if (!isReleaseType(typeName)) return true;`. That early return is what keeps every other
type's answers untouched, and it is now too wide — a `Milestone` and an `Iteration` must also
refuse `release`. Add the release field's rule **before** that line so the existing body is
reached unchanged for every other field:

```ts
	// A release holds WORK. A marker is not work, so no marker may hold a membership —
	// the same rule `membershipTarget` (`domain/releases.ts`) already applies at the
	// reading end, stated here for the writing end. Asked BEFORE the release-type early
	// return below, which exists to leave every other type's answers alone: this is a new
	// field's rule and it changes no shipped answer.
	if (field === 'release') return !isMarkerType(typeName);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/domain/optionalProperties.test.ts test/domain/liveTypeKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Check what else moved**

Run: `npx vitest run test/domain/ test/storage/`
Expected: PASS. **If anything about the backfill (`missingKeyStubs`) changed, STOP and report
it** — adding a field to this vocabulary means ✨ now stubs a `release` key on work items, and
that is a deliberate consequence (a property no note carries cannot be picked in Obsidian's
property UI, which is why the backfill exists) but it must be a green, understood change rather
than a surprise.

- [ ] **Step 6: Commit**

```bash
git add src/domain/optionalProperties.ts src/domain/itemTypes.ts test/domain/optionalProperties.test.ts test/domain/liveTypeKeys.test.ts
git commit -m "Let a work item hold a release, and no marker hold one"
```

---

### Task 2: the backlog view learns the membership property

**Files:**
- Modify: `src/domain/viewOptions.ts` (one option)
- Modify: `src/domain/settingsResolve.ts` (`releaseKey`)
- Modify: `src/domain/model.ts` (`BacklogItem.releaseEntry`)
- Modify: `src/domain/readItems.ts` (read it)
- Test: `test/domain/readItems.test.ts`, `test/domain/viewOptions.test.ts`

**Interfaces:**
- Consumes: `OptionalField` from Task 1.
- Produces: `BacklogSettings.releaseKey: string`; `BacklogItem.releaseEntry: LinkEntry | null`.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/readItems.test.ts`:

```ts
it('reads the release a work item names, as a resolved link', () => {
	const vault = new FakeVault();
	vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
	vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
	const model = buildModel(vault.app, vault.entries(), settingsWith({ releaseKey: 'release' }));
	expect(model.byPath.get('F.md')?.releaseEntry?.file?.path).toBe('2.4.md');
});

it('reads no release entry when the key is unbound', () => {
	const vault = new FakeVault();
	vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
	vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
	const model = buildModel(vault.app, vault.entries(), settingsWith({ releaseKey: '' }));
	expect(model.byPath.get('F.md')?.releaseEntry).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/domain/readItems.test.ts`
Expected: FAIL — `releaseEntry` does not exist on the item.

- [ ] **Step 3: Implement**

In `src/domain/model.ts`, beside `iterationEntry: LinkEntry | null;` on `BacklogItem`:

```ts
	/**
	 * The release this item names, resolved — or null where the key is unbound or the
	 * value names nothing. Parsed here rather than read at plan time so the planner can
	 * compare by PATH: two spellings of one release note are one release.
	 */
	releaseEntry: LinkEntry | null;
```

In `src/domain/readItems.ts`, beside the `iterationEntry` line in the item literal:

```ts
		releaseEntry: readReleaseEntry(app, file, cache, settings.releaseKey),
```

and beside `readIterationEntry`:

```ts
/** One release, read the way one iteration is: the first link, or nothing. */
function readReleaseEntry(app: App, file: TFile, cache: CachedMetadata | null, key: string): LinkEntry | null {
	return key ? (readLinkList(app, file, cache, key)[0] ?? null) : null;
}
```

In `src/domain/settingsResolve.ts`, beside the iteration key:

```ts
		releaseKey: clearablePropKey('releaseProperty', fallback.releaseKey),
```

**Use `clearablePropKey`, not `propKey`.** `propKey` cannot tell a cleared option from an unset
one, which is the defect the release view's own comment records at its model boundary.

Add `releaseKey` to `BacklogSettings` and to `defaultSettings()`.

In `src/domain/viewOptions.ts`, add the option beside the iteration property's, following that
entry's shape exactly.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/domain/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/viewOptions.ts src/domain/settingsResolve.ts src/domain/model.ts src/domain/readItems.ts test/domain/
git commit -m "Let the backlog view name the property that holds a release"
```

---

### Task 3: `computeReleaseWrites` — the one planner

**Files:**
- Modify: `src/domain/writePlan.ts`
- Test: `test/domain/releaseWrites.test.ts`

**Interfaces:**
- Consumes: `BacklogItem.releaseEntry`, `BacklogSettings.releaseKey` (Task 2); `item.ownKeys.release` (Task 1).
- Produces: `computeReleaseWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[]`.

- [ ] **Step 1: Write the failing test**

Create `test/domain/releaseWrites.test.ts`:

```ts
describe('planning one release membership', () => {
	it('writes the picked release onto the item, and nothing else', () => {
		const { item, target, settings } = fixture({ release: null });
		const writes = computeReleaseWrites(item, target, settings);
		expect(writes).toEqual([{ file: item.file, release: target.file }]);
	});

	it('plans NOTHING when the item is already in that release', () => {
		// The checkmark is asked of this output, so an agreeing re-pick must be empty —
		// not a write the applier happens to no-op, which would spend the undo slot.
		const { item, target, settings } = fixture({ release: '2.4.md' });
		expect(computeReleaseWrites(item, target, settings)).toEqual([]);
	});

	it('compares by PATH, so two spellings of one note are one release', () => {
		const { item, target, settings } = fixture({ release: '2.4.md', spelling: '[[Releases/2.4|2.4]]' });
		expect(computeReleaseWrites(item, target, settings)).toEqual([]);
	});

	it('REMOVES the key for a "no release" pick, never writes it empty', () => {
		const { item, settings } = fixture({ release: '2.4.md' });
		expect(computeReleaseWrites(item, null, settings)).toEqual([{ file: item.file, release: null }]);
	});

	it('plans nothing for "no release" when the note carries no key', () => {
		// Asked of PRESENCE (`ownKeys`), never of the parsed entry: a hand-edited
		// `release: ''` reads as no entry while the key visibly holds something, and
		// asking the entry would tick the None checkmark on a note that is not empty.
		const { item, settings } = fixture({ release: null });
		expect(computeReleaseWrites(item, null, settings)).toEqual([]);
	});

	it('plans nothing at all when the key is unbound', () => {
		const { item, target } = fixture({ release: null });
		expect(computeReleaseWrites(item, target, settingsWith({ releaseKey: '' }))).toEqual([]);
	});
});
```

Write `fixture` at the top of the file as a small helper building an item, a target release and
`settingsWith({ releaseKey: 'release' })`. Read `test/domain/` for the existing fixture helpers
before writing your own — reuse rather than add.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/domain/releaseWrites.test.ts`
Expected: FAIL — `computeReleaseWrites` is not exported.

- [ ] **Step 3: Implement**

In `src/domain/writePlan.ts`, beside `computeIterationWrites`:

```ts
/**
 * One item's release membership, planned.
 *
 * An unconfigured key plans nothing — absence is a value.
 *
 * Emptiness means "this pick would change nothing", because the MENU's checkmark is asked
 * of this output. A re-pick that agrees returns `[]` rather than a write the applier
 * happens to no-op, which would spend the undo slot on nothing.
 */
export function computeReleaseWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[] {
	if (!settings.releaseKey) return [];
	// A None pick is asked of PRESENCE (`ownKeys`), never of the PARSED entry — the split
	// `computeIterationWrites` states above. A hand-edited `release: ''` reads as no entry
	// while the key still visibly holds something, so asking the entry would tick the None
	// checkmark on a note the reader can see is not empty.
	if (target === null) return item.ownKeys.release ? [{ file: item.file, release: null }] : [];
	// By PATH, never by the raw text: two spellings of one note are one release, and a
	// link that resolved to nothing has no path and is therefore never "already there".
	return item.releaseEntry?.file?.path === target.file.path ? [] : [{ file: item.file, release: target.file }];
}
```

Add `release?: TFile | null` to `ItemWrite`, documented as: the TARGET FILE, not a string —
`storage/frontmatter.ts` spells it with `wikilinkTo` from the editing note's own path.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/domain/releaseWrites.test.ts`
Expected: PASS all six.

- [ ] **Step 5: Commit**

```bash
git add src/domain/writePlan.ts test/domain/releaseWrites.test.ts
git commit -m "Plan one item's release membership, and nothing beside it"
```

---

### Task 4: the writer spells it as a link

**Files:**
- Modify: `src/storage/frontmatter.ts`
- Test: `test/storage/releaseWrite.test.ts`

**Interfaces:**
- Consumes: `ItemWrite.release` (Task 3).
- Produces: nothing new — `applyWrites` handles the field.

- [ ] **Step 1: Write the failing test**

Create `test/storage/releaseWrite.test.ts`:

```ts
describe('writing a release membership', () => {
	it('spells the value as a link resolved from the editing note', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [
			{ file: vault.file('F.md'), release: vault.file('Releases/2.4.md') },
		]);
		// A LINK, not the basename: a plain string would let Obsidian resolve two
		// same-named release notes to the wrong file.
		expect(vault.frontmatterOf('F.md').release).toBe('[[Releases/2.4]]');
	});

	it('DELETES the key rather than blanking it', async () => {
		const vault = new FakeVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [
			{ file: vault.file('F.md'), release: null },
		]);
		expect('release' in vault.frontmatterOf('F.md')).toBe(false);
	});

	it('writes nothing when the key is unbound', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		await applyWrites(vault.app, settingsWith({ releaseKey: '' }), [
			{ file: vault.file('F.md'), release: vault.file('Releases/2.4.md') },
		]);
		expect('release' in vault.frontmatterOf('F.md')).toBe(false);
	});
});
```

Check the exact helper names on `FakeVault` before writing — read `test/helpers/vault.ts`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/storage/releaseWrite.test.ts`
Expected: FAIL — nothing writes the field.

- [ ] **Step 3: Implement**

In `applyInto` in `src/storage/frontmatter.ts`, beside the iteration's own handling:

```ts
		// The TARGET FILE spelled from the EDITING note's own path, exactly as `parent` is
		// a few lines up and for the identical reason: a plain basename would let Obsidian
		// resolve two same-named release notes to the wrong one.
		if (write.release !== undefined && settings.releaseKey) {
			if (write.release === null) delete fm[settings.releaseKey];
			else setOwn(fm, settings.releaseKey, wikilinkTo(app, write.release, write.file.path));
		}
```

Read how the iteration link is written in this file and match it — including how the inverse is
captured for undo, which `applyWrites` does as each write lands.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/storage/`
Expected: PASS.

- [ ] **Step 5: Verify undo takes it back**

Add to the same file:

```ts
	it('is undoable as one batch', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const settings = settingsWith({ releaseKey: 'release' });
		const result = await applyWrites(vault.app, settings, [
			{ file: vault.file('F.md'), release: vault.file('Releases/2.4.md') },
		]);
		await applyRestores(vault.app, result.undo);
		expect('release' in vault.frontmatterOf('F.md')).toBe(false);
	});
```

Read `applyWrites`' actual return shape before writing this — match it rather than guessing.

- [ ] **Step 6: Commit**

```bash
git add src/storage/frontmatter.ts test/storage/releaseWrite.test.ts
git commit -m "Write a release membership as a link, and take it back"
```

---

### Task 5: the one host method

**Files:**
- Modify: `src/view/host.ts` (the interface member)
- Modify: `src/view/cardMoves.ts` (the implementation)
- Modify: `src/view/backlogView.ts` (delegate)
- Test: `test/view/releaseMove.test.ts`

**Interfaces:**
- Consumes: `computeReleaseWrites` (Task 3).
- Produces: `performReleaseMove(item: BacklogItem, target: BacklogItem | null): Promise<boolean>` on `BacklogViewHost`.

- [ ] **Step 1: Write the failing test**

Create `test/view/releaseMove.test.ts`:

```ts
describe('putting one item in a release', () => {
	useViewHarness();

	it('writes the membership and announces it once', async () => {
		const { view, vault } = makeViewWithReleases();
		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['F.md']);
		expect(liveRegionText()).toContain('2.4');
	});

	it('refuses a batch naming an item the base excluded', async () => {
		// The context rule, at the gate rather than only at the entry point.
		const { view, vault } = makeViewWithReleases({ exclude: 'F.md' });
		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});
```

Read `test/view/` for the existing card-move tests and reuse their helpers — `performBoardMove`
and `performHorizonMove` already have suites, and this is the same shape.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/releaseMove.test.ts`
Expected: FAIL — `performReleaseMove` is not a function.

- [ ] **Step 3: Implement**

In `src/view/cardMoves.ts`, follow `performHorizonMove`'s shape exactly. It must:

- plan with `computeReleaseWrites`,
- return early when the plan is empty (no gate call, no announcement, no undo slot spent),
- **capture the release's NAME before the await** — the batch's own refresh rebuilds the model,
  and the release just picked may be gone from it by the time the write resolves. This is the
  capture rule `applyCardMove` states,
- apply through `applySafely`, which is what refuses a batch naming an excluded item,
- announce once, from here and nowhere else.

Add the member to `BacklogViewHost` in `src/view/host.ts` and delegate from
`src/view/backlogView.ts`, matching how the other card moves are wired.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/view/releaseMove.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/view/host.ts src/view/cardMoves.ts src/view/backlogView.ts test/view/releaseMove.test.ts
git commit -m "One method plans and announces a release move"
```

---

### Task 6: the menu and the keyboard

**Files:**
- Modify: `src/view/interactions/labels.ts` (`addReleaseItems`, `canSetRelease`)
- Modify: `src/view/interactions/menu.ts` (one call)
- Modify: `src/view/interactions/keyboard.ts` (the key path)
- Modify: `src/i18n/en.ts`
- Test: `test/view/releaseMenu.test.ts`

**Interfaces:**
- Consumes: `performReleaseMove` (Task 5), `computeReleaseWrites` (Task 3).
- Produces: `addReleaseItems(host, menu, item)`, `canSetRelease(host, item): boolean`.

- [ ] **Step 1: Write the failing test**

Create `test/view/releaseMenu.test.ts`:

```ts
describe('the Set release menu', () => {
	useViewHarness();

	it('offers every release the base holds, and a way out', () => {
		const { view } = makeViewWithReleases();
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['2.4', '2.5', 'No release']);
	});

	it('checks the entry exactly when picking it would write nothing', () => {
		// Asked of the PLAN. A comparison written beside the plan drifts from it — the
		// register records those two coming apart the moment a second property joined.
		const { view } = makeViewWithReleases({ memberOf: { 'F.md': '2.4.md' } });
		expect(checkedReleaseLabel(view, 'F.md')).toBe('2.4');
	});

	it('checks "No release" for an item in none', () => {
		const { view } = makeViewWithReleases();
		expect(checkedReleaseLabel(view, 'F.md')).toBe('No release');
	});

	it('is absent entirely when the property is unbound', () => {
		const { view } = makeViewWithReleases({ releaseProperty: '' });
		// ABSENT, not present and inert.
		expect(releaseMenuLabels(view, 'F.md')).toEqual([]);
	});

	it('is offered on no marker and no test-catalog note', () => {
		const { view } = makeViewWithReleases();
		for (const path of ['2.4.md', 'Sprint 1.md', 'M1.md', 'Case.md']) {
			expect(releaseMenuLabels(view, path)).toEqual([]);
		}
	});

	it('offers no release the base excluded', () => {
		const { view } = makeViewWithReleases({ exclude: '2.5.md' });
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['2.4', 'No release']);
	});

	it('distinguishes two releases that share a basename', () => {
		// The write resolves correctly either way, because it carries the TFile — this is
		// about the reader being able to tell which one they are picking.
		const { view } = makeViewWithReleases({ releases: ['Releases/2.4.md', 'Archive/2.4.md'] });
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['2.4 (Releases)', '2.4 (Archive)', 'No release']);
	});

	it('the keyboard writes the batch the menu writes', async () => {
		const { view, vault } = makeViewWithReleases();
		await pickReleaseByKeyboard(view, 'F.md', '2.4');
		await flush();
		const byKeyboard = [...vault.writeLog];
		vault.writeLog.length = 0;
		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		await flush();
		expect(byKeyboard).toEqual(vault.writeLog);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/releaseMenu.test.ts`
Expected: FAIL — no release entries are built.

- [ ] **Step 3: Implement**

In `src/view/interactions/labels.ts`, write `canSetRelease` and `addReleaseItems` beside the
iteration's own pair. Read `canSetIteration`'s four refusals and mirror them; the eligibility
question is the same one, and `mayHoldField(item.typeName, 'release', settings)` from Task 1 is
what answers the type half.

The list comes from `host.model.releases`, which already excludes `outsideFilter` — so the
"not offered for an excluded release" rule holds by construction rather than by a filter here.

**The basename qualification:** where two releases in the list share a basename, qualify each
with its containing folder; where a basename is unique, show it bare. State that rule at the
function. This is the question `docs/issues/Two releases with the same basename read alike.md`
records as open for the INDEX — the picker settles it for the picker only, and that note must
be updated in Task 7 to say so.

Every label through `t()`; a release's own NAME is vault content and goes nowhere near the
catalog.

In `src/view/interactions/menu.ts`, add one call in the editable section beside
`addIterationItems`. In `src/view/interactions/keyboard.ts`, open the same builder — **not** a
second list.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/view/releaseMenu.test.ts`
Expected: PASS all eight.

- [ ] **Step 5: Commit**

```bash
git add src/view/interactions/labels.ts src/view/interactions/menu.ts src/view/interactions/keyboard.ts src/i18n/en.ts test/view/releaseMenu.test.ts
git commit -m "Offer Set release from the menu and the keyboard"
```

---

### Task 7: the register, the changelog, and the gate

**Files:**
- Modify: `docs/requirements/Setting an item's release.md` (`## Where it lives`, and the narrowed criterion)
- Modify: `docs/issues/Two releases with the same basename read alike.md`
- Modify: `docs/tests/suites/Smoke test the release view.md`
- Modify: `CHANGELOG.md`
- Modify: `vitest.config.mts` (coverage floors, upward only)

- [ ] **Step 1: Correct the register**

In `docs/requirements/Setting an item's release.md`:

- `## Where it lives` must name what shipped: `domain/writePlan.ts`'s `computeReleaseWrites`,
  `view/cardMoves.ts`'s `performReleaseMove`, `interactions/labels.ts`, and
  `storage/frontmatter.ts` for the link write.
- The acceptance criterion "The menu, the keyboard and the drag produce byte-identical batches"
  is met for two of three. **Say so** — record that the drag waits on a surface that holds a
  release as a drop target, and name [[A release on the dated axis]]. Do not delete the
  criterion.

In `docs/issues/Two releases with the same basename read alike.md`: the picker now qualifies on
collision. Record that the picker settled it, that the INDEX and the scope header did not, and
that the two now differ — which is a finding, not a fix.

In `docs/tests/suites/Smoke test the release view.md`, add what only a vault can judge: the
picker's length against a vault with many releases, whether the folder-qualified entries read
well, and the row menu's total length now that a fifth label-ish entry has joined it.

- [ ] **Step 2: Write the changelog entry**

Add to `[Unreleased]` under `### Added`. It describes the capability, not the internals: a work
item can be put in a release, or taken out, from its own menu or the keyboard, and the release
view then shows it. Name the one limitation a user can hit — the membership property is
configured per view, so binding it differently in the two views means the release view will not
see what the backlog view wrote, and nothing reports that.

- [ ] **Step 3: Run the whole gate**

Run: `npm run check`
Expected: EXIT 0, all five steps.

- [ ] **Step 4: Raise the coverage floors**

Read the measured numbers off the run and raise `vitest.config.mts` to just under them, leaving
a small margin. **Floors only ever go up.** A floor set at exactly the measured value reddens on
the next merge from main.

- [ ] **Step 5: Re-run and commit**

```bash
npm run check
git add docs/ CHANGELOG.md vitest.config.mts
git commit -m "Record what setting a release ships, and what it does not"
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: the option (2), eligibility (1, 6),
the planner (3), the link write (4), the one method (5), menu and keyboard (6), the register and
the narrowed criterion (7). The key-mismatch limitation is carried into the changelog in Task 7
and is deliberately given no code — the spec forbids promising a warning that cannot exist.

**One decision this plan makes that the spec did not.** Task 1 adds `release` to `OptionalField`,
which is what supplies `ownKeys.release` for the "no release" gate. That has a consequence the
spec did not name: the ✨ backfill stubs an empty key for every optional property a type may
hold, so it will now stub `release` on work items. That is arguably correct — a property no note
carries cannot be picked in Obsidian's property UI, which is the reason the backfill exists — but
it is a visible change to a shipped feature and Task 1 Step 5 stops if it is not understood.
The alternative, a dedicated presence flag outside that vocabulary, was not taken because it
would be a second mechanism for a question `ownKeys` already answers.

**The one thing no test here can reach.** Whether a user can actually find and use this in
Obsidian — the picker's length, the menu's length, the qualified labels — is a live-vault
question. It joins the suite that is already unrun.
