# Releases own their creation — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the release view its own door — a `New release` gesture, a folder option and a bind-and-backfill ✨ — and take `Release` out of the backlog tree, which is offered there today only because that door did not exist.

**Architecture:** The release view gains a create path and keeps every edit path shut. One function binds-and-backfills, reached from two entry points. The backlog view stops drawing and stops offering `Release`, and drops the folder row it no longer needs. The read-only invariant narrows from "writes nothing" to "never edits an existing note".

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom), eslint with per-directory `no-restricted-imports`, fallow, `scripts/docs-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-24-releases-own-their-creation-design.md`

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`; each may reach anything below it and nothing above. `ui/` and `i18n/` are leaves. Violations fail `npm run lint`.
- **400-line maximum per `src/` file** (lint, `skipBlankLines`/`skipComments`); `test/**` has 450.
- **Frontmatter is written only** in `storage/frontmatter.ts`, `storage/createNote.ts`, `storage/absenceNotes.ts`, `storage/propertyWrite.ts`. Enforced by `no-restricted-syntax`.
- **Every user-visible string goes through `t()`** from `i18n/t.ts`; `src/i18n/en.ts` is DATA (no imports, no logic). A property key, a type name, an option id, a folder path or a CSS class is DATA and never enters the catalog. **Two shapes the lint bans cannot see, both of which have shipped here:** a template whose FIRST QUASI IS EMPTY (`` `${n} items` ``), and a sentence passed as a positional ARGUMENT to a helper or returned from one. Lint passing is not evidence against either.
- **Nothing builds a sentence by joining pieces.** Pass a parameter or an array and let the catalog join it.
- **An unconfigured key is never written to.** Absence is a value.
- **Unset is not cleared, and the distinction lives in the CONFIG, not the resolved settings.** `adoptCandidates` and `runEstimationInit` both ask `config.get(option) !== undefined` directly, because — as `optionalProperties.ts` states — *cleared and never-set resolve to the same `''` key*. Any code that needs to tell them apart reads the live config. `clearablePropKey` draws the distinction only for an option whose default is a REAL value; for one defaulting to `''` it is identical to `propKey`.
- **The membership key is never stubbed onto work items.** `membershipTarget` reads a present-but-blank value as UNRESOLVED, so a stub reports the whole backlog as broken. `neverStubbed` refuses it and continues to.
- **`normalizePath` on user paths** (marketplace rule), and `setCssProps` over inline styles.
- **fallow's COGNITIVE complexity budget is separate** from eslint's cyclomatic `complexity: 16` and is checked by `npm run analyze`. A passing `npx eslint` is not evidence the cognitive budget holds — that mistake has been made on this codebase already.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert, run, see red, restore. `cp` a copy aside first — never `git checkout -- <file>`, which also discards uncommitted work.
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) passes. Coverage floors only ever go UP — currently 98.89 / 95.40 / 99.90 / 99.73 in `vitest.config.mts`. CI runs the same on Ubuntu **and** Windows.
- **Commit after every task**, staging by explicit path. Never `git add -A`, `git add .` or `git commit -a`. `CHANGELOG.md` gains its `[Unreleased]` entry in Task 8.

---

### Task 1: the settings the gesture needs

One change to `ReleaseSettings`: the folder the gesture files into. A prerequisite for Tasks 3 and 7 rather than a feature of its own.

**A correction to an earlier draft of this plan.** This task also asked for `versionProperty`, `targetDateProperty` and `releaseStatusProperty` to move from `propKey` to `clearablePropKey`, on the premise that the cleared-vs-unset distinction was unstatable without it. That premise was false and the change was reverted. `clearablePropKey(key, def)` is `config.get(key) === undefined ? def : propKey(key, '')`, so with a `''` default every branch collapses to `propKey`'s own outcomes — `settingsResolve.ts` declines the identical switch for `releaseKey` and says why. The distinction is read from the live config by Task 6's ✨, per the Global Constraint above. **Do not reintroduce it.**

**Files:**
- Modify: `src/domain/releaseOptions.ts` (`ReleaseSettings`, `resolveReleaseSettings`, `releaseGroup`)
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Produces: `ReleaseSettings.folder: string`, and a `releaseFolder` option of `type: 'folder'` defaulting to `defaultTypeFolder(RELEASE_TYPE)`.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/releaseOptions.test.ts`. Read the file first and match its existing fixture helper for building a config — do not invent one.

```ts
it('files a new release under docs/releases when nothing says otherwise', () => {
	// The value is DATA — where a note lands, not text anybody reads. It tracks
	// `defaultTypeFolder('Release')` rather than a literal so the two cannot drift.
	expect(resolveReleaseSettings(configWith({})).folder).toBe('docs/releases');
});

```

An earlier draft mandated a second test here, pinning `versionKey` for a cleared and an untouched option. It asserted nothing — it passed before its implementation existed, because the two states resolve identically — and it was removed with the switch it was written to guard. The distinction is tested where it is real: Task 6, against the live config.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: FAIL — `folder` is not a property of `ReleaseSettings`.

- [ ] **Step 3: Implement**

In `src/domain/releaseOptions.ts`, add to `ReleaseSettings`:

```ts
	/** Where `New release` files a note. A PATH, not a property key. */
	folder: string;
```

In `resolveReleaseSettings`, resolve it from the new option. Read how `settingsResolve.ts` spells a folder value — including `normalizePath` — and match it rather than writing a second spelling. **Leave the three release property fields on `propKey`**, for the reason at the top of this task.

Add the option to `releaseGroup()`, following the shape of `newItemsGroup`'s folder rows in `src/domain/viewOptions.ts` (`type: 'folder'`, a `default`, a `placeholder`). Its default is `defaultTypeFolder(RELEASE_TYPE)` from `src/domain/typeVocabulary.ts` — **not** a literal `'docs/releases'`, so the option and the table cannot drift.

The display name goes through `t()`. The option key, the folder path and the type name are DATA.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run test/domain/`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

Run `npm run check` in the FOREGROUND and wait; all five steps must pass.

```bash
git add src/domain/releaseOptions.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "Give the release view a folder, and a cleared option it can tell apart"
```

---

### Task 2: `Release` leaves the backlog view

Two halves of one deliverable — a release is neither drawn nor offered in the backlog view — plus the folder row that has no consumer once both land.

**The mechanism is settled — an earlier draft of this task got it wrong and a run proved it.**

An earlier draft put the refusal in `projectionMember` (`src/view/projection.ts`). That cannot
work. `renderForest` (`src/view/render/reconcile.ts`) computes `hasChildren` from a row's
non-hidden children and recurses *inside the path that drew the row*, so a `Release` hidden there
takes its whole subtree with it — measured, not reasoned:
`expected [ 'Ship it' ] to deeply equal [ 'Ship it', 'Work' ]`. The roadmap's `onThisRoadmap`
mechanism does not transfer, because the roadmap renders no nested forest.

**The refusal goes in `inPlan` (`src/domain/model.ts`)**, one line above the `isIterationType`
exclusion already there. Measured on this branch: that line alone makes the tree behave, with
`projection.ts` untouched.

**Its consequence is accepted by ruling, not by accident: a `Release` leaves both BOARDS too**,
since `inPlan` is what they read. That is wider than "the tree" and the human ruled for it — a
`Release` is a marker with a dedicated view, and `inPlan` already refuses `Iteration`, the other
marker with a dedicated control. See the spec's section 4.

**Eight existing tests pin the old drawn behaviour and must be RETIRED WITH THEIR REASONS, not
deleted quietly:** six in `test/view/releaseRows.test.ts` (one is named "the board does not move",
from the increment that first added the type), one in `rendering.test.ts` that joins the
`Iteration` exclusion written beside it, and one fixture artefact in `writePlanAxis.test.ts`. For
each, say in the diff what it used to assert and why that decision no longer holds. A test whose
subject genuinely still matters must be rewritten rather than dropped.

**Also in scope:** `honouredFocusLevel` guards the roadmap against a stored focus on a type it no
longer draws. A stored `Release` focus would strand the tree the same way — give it the same
guard.

**Files:**
- Modify: `src/domain/model.ts` (`inPlan` — the one-line refusal)
- Modify: `src/view/projection.ts` (`byProjectionType`, and `honouredFocusLevel`'s guard)
- Modify: `src/domain/viewOptions.ts` (`newItemsGroup` — drop the `Release` row)
- Test: `test/domain/viewOptions.test.ts`, `test/view/releaseRows.test.ts`, `test/view/rendering.test.ts`, `test/domain/writePlanAxis.test.ts`, and the new `test/view/releaseTreeExit.test.ts`. NOTE: `test/view/projection.test.ts` does NOT exist and `byProjectionType` is not exported — drive it through a surface that reads it.

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: no `Release` row and no `Release` type offer in the tree projection; no `Release` entry in the backlog's new-items folder group.

- [ ] **Step 1: Write the failing tests**

```ts
it('draws no release row in the tree, even when the base returns one', () => {
	// The release view is the only door now. Same narrowing `roadmapRows` already
	// makes one projection over.
	const { view } = makeViewWithReleases();
	expect(rowPaths(view)).not.toContain('2.4.md');
});

it('offers Release as a type nowhere in the tree', () => {
	// `New <child>`, `Set type` and the focus picker all read `byProjectionType`.
	expect(byProjectionType('tree', ALL_TYPES)).not.toContain('Release');
});

it('keeps every work item that a release row was above', () => {
	// The trap: the forest and the hiding must agree. A row whose ancestor stops
	// being drawn must still appear, not vanish with it.
	const { view } = makeViewWithReleases();
	expect(rowPaths(view)).toContain('F.md');
});
```

`makeViewWithReleases` and `rowPaths` may not exist under those names — read `test/helpers/view.ts` and `test/view/` and use what does. The third test is the one that catches the trap; write it first and keep it.

Add to `test/domain/viewOptions.test.ts`: the new-items group offers no `Release` folder row. That file has an exact-match test for the group — read it and extend rather than adding a parallel one.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/view/projection.test.ts test/domain/viewOptions.test.ts`
Expected: FAIL — a release row is drawn and `Release` is offered.

- [ ] **Step 3: Implement**

In `byProjectionType`, add the tree to the narrowing that already drops `Release` for the roadmap. **Rewrite the comment above it** — it currently says a `Release` stays offered *because it has no dedicated door*, and that reason has now been retired. State that the release view owns the gesture, the way the paragraph below it states the iteration scope picker does.

In `inPlan` (`src/domain/model.ts`), refuse a `Release`, beside the `isIterationType` exclusion already there. That one line is the whole of the not-drawn half.

In `newItemsGroup` (`src/domain/viewOptions.ts`), drop the `Release` row. `ALL_TYPES` includes `MARKER_TYPES`, so it is generated rather than written out — the exclusion goes where `Resource`'s already does, and gets a sentence saying the release view owns that folder now.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run check` in the FOREGROUND. Expected: all five steps pass. **A broad suite is the point here** — this task changes a predicate five surfaces read, and the failures it causes elsewhere are the information.

- [ ] **Step 5: Commit**

```bash
git add src/view/projection.ts src/domain/viewOptions.ts test/
git commit -m "Take Release out of the backlog view, now that it has its own door"
```

---

### Task 3: the creator

**Files:**
- Modify: `src/storage/createNote.ts`
- Test: `test/storage/createRelease.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings` (Task 1).
- Produces: `createRelease(app, settings: ReleaseSettings, spec: { title: string; version?: string; targetDate?: string; status?: string }): Promise<TFile>` — the name Tasks 4 and 7 call. If it reads better beside `createResourceNote` under another name, rename it and say so in your report so the later tasks are told.

- [ ] **Step 1: Write the failing test**

Create `test/storage/createRelease.test.ts`. Read `test/helpers/vault.ts` for the real `FakeVault` accessor names first — the plan does not guess them.

```ts
it('creates one release note in the configured folder', async () => {
	const vault = new FakeVault();
	const file = await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases', versionKey: 'v' }), {
		title: '2.4',
		version: '2.4.0',
	});
	expect(file.path).toBe('Releases/2.4.md');
	expect(vault.fm('Releases/2.4.md')).toEqual({ type: 'Release', v: '2.4.0' });
});

it('writes no key the view has not bound', async () => {
	// Absence is a value. A cleared version property means this vault does not
	// track versions, and the note must not carry an empty one.
	const vault = new FakeVault();
	await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases', versionKey: '' }), {
		title: '2.4',
		version: '2.4.0',
	});
	expect('v' in vault.fm('Releases/2.4.md')).toBe(false);
});

it('seeds no parent, no order and no placement', async () => {
	// A release is a marker: no rung, no children, hangs from nothing. The
	// standing rule at `createBacklogItem` is that a Release is seeded NOTHING a
	// surface adds; this asserts it of the note rather than trusting the comment.
	const vault = new FakeVault();
	await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases' }), { title: '2.4' });
	expect(Object.keys(vault.fm('Releases/2.4.md'))).toEqual(['type']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/storage/createRelease.test.ts`
Expected: FAIL — the function is not exported.

- [ ] **Step 3: Implement**

In `src/storage/createNote.ts`, write the creator beside `createResourceNote`. **Not `createBacklogItem` with fewer fields:** its `NewItemSpec` requires a parent, a rank and a ladder type, and a release has none of the three — which is `createResourceNote`'s own stated reason for standing apart. Read that reason and follow it; a wrapper passing a fake parent and a fake rank to reuse `createBacklogItem` is the outcome to avoid.

Reuse `ensureFolder`, `uniqueNotePath` and `setOwn` from the same module. One atomic write, as `createBacklogItem` documents: a create-then-update pair can fail in between and leave a blank note behind.

Add a sentence distinguishing this from the standing "a `Release` is seeded NOTHING a surface adds" rule, which is about a surface seeding its own context — a sprint, a sprint's dates, a bucket horizon. This seeds a release's own fields, which is a different claim. The two read alike and the next reader will ask.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/storage/`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

Run `npm run check` in the FOREGROUND.

```bash
git add src/storage/createNote.ts test/storage/createRelease.test.ts
git commit -m "Create one release note, and nothing beside it"
```

---

### Task 4: the dialog

**Files:**
- Create: `src/ui/newReleaseDialog.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/ui/newReleaseDialog.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings` (Task 1).
- Produces: a dialog resolving to `{ title, version, targetDate, status }` or null on cancel. State the exact export name and shape in your report — Task 7 calls it.

`ui/` is a leaf: it may import nothing from `view/`, `storage/`, `domain/` or `commands/`. Pass it the settings it needs as a parameter.

- [ ] **Step 1: Write the failing test**

Read `test/ui/` for how the existing dialogs are driven — `stateColorsDialog` and `estimationPresetDialog` both have suites — and match that harness.

```ts
it('offers a field for every bound property and none for a cleared one', () => {
	// The cleared case, not the unset one: an unset option is bound before the
	// dialog opens (Task 6) — which asks the live CONFIG, not these resolved keys —
	// so a missing field can only mean deliberately cleared.
	const dlg = openNewReleaseDialog(app, releaseSettingsWith({ versionKey: 'v', targetDateKey: '', statusKey: 's' }));
	expect(fieldNames(dlg)).toEqual(['title', 'version', 'status']);
});

it('refuses to confirm without a title', () => {
	// The title is the note's name — there is nothing to create without it.
	const dlg = openNewReleaseDialog(app, releaseSettingsWith({}));
	expect(canConfirm(dlg)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/ui/newReleaseDialog.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Write the dialog. Every label, the heading and the confirm button go through `t()`. **Watch for the two invisible shapes:** a sentence passed positionally into a helper, and a template whose first quasi is empty. Read your own diff for both before committing — lint sees neither.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/ui/` — Expected: PASS.

- [ ] **Step 5: Full gate and commit**

```bash
git add src/ui/newReleaseDialog.ts src/i18n/en.ts test/ui/newReleaseDialog.test.ts
git commit -m "Ask for a release's own fields, and only the ones this vault keeps"
```

---

### Task 5: the narrowed boundary

Do this BEFORE the init module (Task 6) and before the control (Task 7), so no task ever ends on a red
suite. The narrowed claim passes with no creation code written yet — it simply permits more — which is
why it can come first.

**Files:**
- Rename + modify: `test/view/releaseWritesNothing.test.ts` → a name matching the narrowed claim
- Modify: `eslint.config.mjs` (`WRITE_BOUNDARY`)
- Modify: `src/view/release/register.ts` (its comment only)

- [ ] **Step 1: Narrow the claim**

The file asserts a category claim in three layers. The claim becomes:

> **This view creates notes and its own config. It never edits a note that already exists.**

`applyWrites`, `applyRestores` and `applyPropertyWrites` stay banned — those are the edit paths. The note creators and `config.set` become permitted. Keep all three layers; change what each admits, and rewrite the docblock to state the narrower claim. **Do not delete a layer to make it pass.**

- [ ] **Step 2: Rename the file**

`git mv` it to a name matching what it asserts. A file called `releaseWritesNothing` asserting something else is the exact shape this repo's rules warn against.

- [ ] **Step 3: Scope the lint rule**

`WRITE_BOUNDARY` bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage` across `src/view/` with no exemption for this directory. Add the narrowest exemption that lets the creator be called — and state at the rule what is still banned there.

- [ ] **Step 4: Correct the registration comment**

`registerReleaseView` says *"this view plans no batch, so there is nothing for a lock to serialize."* **That stays true** — creation is not a batch and plans no undo, so no `WriteLock` is threaded in. Add a sentence about creation so the next reader does not read "writes nothing" into it.

- [ ] **Step 5: Run and commit**

Run `npm run check` in the FOREGROUND. Expected: all five pass.

```bash
git add test/view/ eslint.config.mjs src/view/release/register.ts
git commit -m "Narrow the release view's claim to what it still keeps"
```

---

### Task 6: bind and backfill

**Files:**
- Create: `src/view/release/init.ts`
- Test: `test/view/release/init.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings` (Task 1).
- Produces: `runReleaseInit(view: ReleaseView): Promise<void>` — one function, two callers (this task and Task 7).

- [ ] **Step 1: Write the failing test**

Read `src/view/estimation/init.ts` in full first. It states an ORDER as a rule: decide the bindings, gate on the model they would produce, and only then write — because an action that changes the configuration and then has every write refused leaves the view worse than it found it.

```ts
it('binds every untouched option and leaves a cleared one alone', async () => {
	const view = makeReleaseView({ versionProperty: '' });   // cleared
	await runReleaseInit(view);
	expect(view.config.setCalls.map((c) => c.key)).toContain('targetDateProperty');
	expect(view.config.setCalls.map((c) => c.key)).not.toContain('versionProperty');
});

it("stubs a release note's own keys and NOT the membership key on work items", async () => {
	// `membershipTarget` reads a blank membership as UNRESOLVED, so stubbing it
	// would report the whole backlog as broken on this very index.
	const { view, vault } = makeReleaseViewWithWork();
	await runReleaseInit(view);
	expect(vault.fm('2.4.md')).toHaveProperty('version');
	expect('release' in vault.fm('PBI-1.md')).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/release/init.test.ts` — Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement**

Follow `runEstimationInit`'s order and its use of `adoptCandidates` over this view's own key list. Backfill the release notes' own keys onto existing release notes. **Do not touch the membership key on work items.**

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/view/` — Expected: PASS, including the narrowed boundary suite Task 5 renamed.
If it fails, the narrowing was wrong rather than this task — read it before changing anything here.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/init.ts test/view/release/init.test.ts
git commit -m "Bind the release view's own options, and stub what a release note holds"
```

---

### Task 7: the control

**Files:**
- Modify: `src/view/release/renderIndex.ts` (toolbar control and empty state)
- Modify: `src/i18n/en.ts`
- Test: `test/view/release/newRelease.test.ts`

**Interfaces:**
- Consumes: the creator (Task 3), the dialog (Task 4), `runReleaseInit` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
it('creates a release from the toolbar and from the empty state alike', async () => {
	// One move, N inputs: both entry points land on one function, which is the
	// only place the note is created. A second creation path beside it is the
	// thing this asserts against.
	const fromToolbar = await createViaToolbar();
	const fromEmpty = await createViaEmptyState();
	expect(fromEmpty.writeLog).toEqual(fromToolbar.writeLog);
});

it("binds the view's options before asking for fields", async () => {
	// The order is the rule: on a fresh vault every option is unset, the bind
	// gives them their suggested keys, and all four fields then appear.
	const { view, dialog } = await openNewReleaseOn(makeReleaseView({}));
	expect(fieldNames(dialog)).toEqual(['title', 'version', 'targetDate', 'status']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/release/newRelease.test.ts` — Expected: FAIL, no control exists.

- [ ] **Step 3: Implement**

One function, called from the toolbar control and from the empty state. It runs `runReleaseInit` when options are unset, then opens the dialog, then creates. **The dialog states that it is binding the view's options** rather than changing the `.base` silently — that sentence goes through `t()`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check` in the FOREGROUND.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/renderIndex.ts src/i18n/en.ts test/view/release/newRelease.test.ts
git commit -m "Offer New release from the toolbar and the empty state"
```

---

### Task 8: the register, the changelog and the gate

**Files:**
- Create: a PBI under `docs/requirements/Putting work in a release.md`
- Modify: `docs/tests/suites/Smoke test the release view.md`
- Modify: `CHANGELOG.md`, `vitest.config.mts`

- [ ] **Step 1: Write the PBI**

Use the `adding-backlog-items` skill's shape, or copy `Setting an item's release.md`'s. Its `## Where it lives` names what actually shipped — verify each path against the code rather than transcribing this plan.

Record the **retired justification**: `byProjectionType` offered `Release` in the tree because the release view had no door, and that reason is now gone. That is the part worth keeping.

- [ ] **Step 2: Add to the smoke suite**

Only a vault can judge: whether the dialog reads well, whether the bind-notice is clear, where a release actually lands, and whether the index looks right without release rows in the tree. **Do not describe any of it as verified.**

- [ ] **Step 3: Write the changelog entry**

Under `[Unreleased]` → `### Added` and `### Changed`. Name the two costs a user can hit:
- **A vault that changed the backlog's home folder** had releases under `<home>/releases`; the new option defaults to `docs/releases` and the release view cannot read the other view's home folder, so such a vault's next release lands there until the option is set.
- **Creation is not undoable** — true of every `New` in the plugin.

Do NOT promise a warning about either. Nothing detects them.

- [ ] **Step 4: Run the gate and raise the floors**

Run `npm run check`, read the measured coverage, raise `vitest.config.mts` to just under it. **Floors only ever go UP.** A floor at exactly the measured value reddens on the next merge.

- [ ] **Step 5: Re-run and commit**

```bash
npm run check
git add docs/ CHANGELOG.md vitest.config.mts
git commit -m "Record what a release's own door ships, and what it costs"
```

---

## Self-review notes

**Spec coverage.** Section 1 (the gesture) → Tasks 3, 4, 7. Section 2 (the folder) → Tasks 1, 2. Section 3 (the ✨) → Tasks 6, 7. Section 4 (the tree) → Task 2. Section 5 (the boundary) → Task 5. Out-of-scope items get no task, deliberately.

**One decision this plan makes that the spec did not.** The boundary is narrowed (Task 5) BEFORE anything needs it — the init module in Task 6 and the control in Task 7. An earlier draft ordered these the other way and had Task 6 commit a knowingly-red suite, which contradicts this repo's unconditional rule that all five gate steps pass before every commit. Narrowing first costs nothing: the narrowed claim passes with no creation code written, it simply permits more. The two stay separate tasks so a reviewer can reject the boundary change while approving the module.

**The riskiest task is 2.** `projectionMember`'s tree answer is `inPlan`, which `projectionForest` also builds from, under a stated rule that the two must agree. The plan names the trap and the mechanism to mirror but does not prescribe the line, because the correct line depends on how `onThisRoadmap` composes — and a plan that guessed it would be worse than one that says where to look.

**What no test here can reach.** Whether the dialog reads well, whether the bind-notice is understood, and whether the index looks right are live-vault questions. The suite is already unrun; this adds to it.
