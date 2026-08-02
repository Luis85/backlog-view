# Ponytail audit cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplication and single-caller indirection the repo-wide ponytail audit found, without changing a single observable behaviour.

**Architecture:** Six independent, behaviour-preserving refactors, each confined to one or two files. Every one of them is already covered by existing tests — the audit found duplication, not gaps — so the check for each task is *the existing covering tests, named explicitly, watched green before and after*, plus the full `npm run check`. No new src files, no new options, no new dependencies.

**Tech Stack:** TypeScript 6.0 (pinned `~6.0.3`), vitest 4 + jsdom, esbuild, eslint 10 flat config, fallow, `docs-check.mjs`.

## Global Constraints

- **Definition of done for every task:** `npm run check` passes (build + lint + coverage-thresholded tests + fallow + docs register). All five. CI runs the same on Ubuntu **and** Windows.
- **Coverage thresholds only ever go up.** `vitest.config.mts` holds statements 97 / branches 92 / functions 98 / lines 97. Statements has the least room. If a refactor pushes a number up, raise the threshold in the same commit; never lower one.
- **Never write frontmatter outside `src/storage/frontmatter.ts`.** `no-restricted-syntax` bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `src/storage/`. No task here touches a write path's *behaviour*; two touch code that plans writes.
- **Layer rule, enforced by `no-restricted-imports`:** `main → commands → view → storage → domain`. `domain/` may not import from `view/`, `storage/`, `ui/` or `commands/`. `view/` importing `domain/` is fine and is what two tasks below rely on.
- **`max-lines: 400`** (skipBlankLines + skipComments) on `src/**`, **450** on `test/**`. `complexity: 16`, `max-depth: 4`, `max-params: 5`.
- **Every module and test file must be named by at least one note under `docs/`.** Deleting a test file is safe (the check only runs over files that exist). Creating one would need a note — no task here creates a file.
- **No new files.** Every edit is in place, so no `docs/` note has to be written to satisfy the register.
- **Commit style:** conventional prefix, one task per commit, and end the message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Branch first.** `main` is the default branch; do not commit these directly to it.

## File Structure

No files are created or deleted except one test file that is removed outright.

| File | Change | Responsibility after the change |
| --- | --- | --- |
| `src/domain/writePlan.ts` | Modify (2 call sites) | Unchanged. Two hand-rolled case-insensitive comparisons become calls to the existing `sameValue`. |
| `src/view/interactions/plan.ts` | Modify (delete a private function) | Unchanged. Imports `formatCivil` from `src/domain/timeline.ts` instead of defining its own. |
| `src/domain/settings.ts` | Modify (`OptionalProperty`, `PROPERTY_TABLE`, `optionalKeyFor`) | Unchanged. The field → settings-key mapping moves into the table that is already keyed by field. |
| `src/domain/vocabulary.ts` | Modify (one new private helper, three collectors shrink to one line each) | Unchanged. The "skip context rows, dedupe case-insensitively keeping first casing" rule is stated once instead of three times. |
| `src/view/render/emptyStates.ts` | Modify (two new private helpers) | Unchanged. The `pbl-empty` and `pbl-empty-filter` shells are each built in one place. |
| `test/view/pragmaticSpike.test.ts` | **Delete** | Gone. The board and roadmap suites already drive the same adapter through real synthetic drag events. |

Task order is deliberate: Tasks 1–3 are one- to ten-line edits that build confidence in the check loop, Tasks 4–5 are the two real shrinks, Task 6 is a deletion whose only risk is the docs register.

---

### Task 1: Reuse `sameValue` in the two planners that hand-roll it

The domain guide states the rule outright: *"'Same placement' and 'same state' are one question, answered by `sameValue` in `noteFields.ts`: case-insensitive, with absence a value rather than a missing one. The plan, the menu's checkmark and the keyboard ladder all ask it, because a plan that said 'unchanged' on a different rule than the checkmark would disagree about what the user is looking at."*

`src/domain/writePlan.ts` does not import `sameValue`. It spells the comparison out twice.

**Files:**
- Modify: `src/domain/writePlan.ts:5` (the import), `src/domain/writePlan.ts:250-252`, `src/domain/writePlan.ts:291-292`
- Test: no new test. Covered by `test/domain/board.test.ts` and `test/domain/stamps.test.ts` (state no-ops), `test/domain/writePlanAxis.test.ts` (horizon no-ops), `test/view/boardMoves.test.ts` and `test/view/roadmapMoves.test.ts` (the no-op must not cost the undo slot). (Corrected after review: the first draft named `test/domain/writePlan.test.ts` for the state no-op, but that file only imports `computeDropWrites`, `computeInitWrites`, `DropTarget` and `ORDER_SPACING` — it never calls `computeStateWrites`. `test/domain/board.test.ts` and `test/domain/stamps.test.ts` are the files that actually do.)

**Interfaces:**
- Consumes: `sameValue(a: string | null, b: string | null): boolean` from `src/domain/noteFields.ts:121`.
- Produces: nothing new. `computeStateWrites` and `computeHorizonWrites` keep their exact signatures.

- [ ] **Step 1: Watch the covering tests pass before touching anything**

Run:

```bash
npx vitest run test/domain/writePlan.test.ts test/domain/writePlanAxis.test.ts test/view/boardMoves.test.ts test/view/roadmapMoves.test.ts
```

Expected: PASS. Record the number of tests. This is the baseline the refactor must reproduce exactly.

- [ ] **Step 2: Prove the tests actually pin the comparison**

Temporarily break `src/domain/writePlan.ts:251` by replacing the whole `const same = …` line with `const same = false;` and re-run the same four files.

Expected: FAIL. If they all pass, stop and report it — the comparison is unpinned and this task needs a real test written first, not a refactor. Then restore the line.

- [ ] **Step 3: Add the import**

In `src/domain/writePlan.ts`, line 5 currently reads:

```typescript
import { CivilDate, readDate } from './noteFields';
```

Change it to:

```typescript
import { CivilDate, readDate, sameValue } from './noteFields';
```

- [ ] **Step 4: Replace the state comparison**

In `computeStateWrites`, replace these two lines:

```typescript
	const current = item.stateValue;
	const same = state === null ? current === null : current !== null && current.toLowerCase() === state.toLowerCase();
	if (same) return [];
```

with:

```typescript
	if (sameValue(item.stateValue, state)) return [];
```

**Corrected after review:** this step originally also added a two-line comment explaining why `sameValue` is the one answer. The final review pointed out that a de-duplication task had thereby duplicated prose — the comment restated `sameValue`'s own definition-site doc comment nearly verbatim, and `computeHorizonWrites` below got no equivalent, so the file was inconsistent about it too. The comment is not part of this step. The reasoning lives with the definition in `src/domain/noteFields.ts`, which is where it belongs.

This is exact, not merely equivalent: `sameValue(null, null)` is `true`, `sameValue(null, 'x')` and `sameValue('x', null)` are `false`, and two non-null values compare lowercased — the three branches the deleted expression spelled out by hand.

- [ ] **Step 5: Replace the horizon comparison**

In `computeHorizonWrites`, replace:

```typescript
	const current = item.horizon.value;
	if (current !== null && current.toLowerCase() === value.toLowerCase()) return [];
```

with:

```typescript
	if (sameValue(item.horizon.value, value)) return [];
```

Note the difference from Task 1 Step 4 and why it is still exact: `value` is non-null on this branch (the `value === null` case returned above), so the only behaviour `sameValue` adds — `null` equalling `null` — is unreachable here.

- [ ] **Step 6: Run the covering tests, then the whole gate**

Run:

```bash
npx vitest run test/domain/writePlan.test.ts test/domain/writePlanAxis.test.ts test/view/boardMoves.test.ts test/view/roadmapMoves.test.ts
```

Expected: PASS, with the same test count as Step 1.

Then:

```bash
npm run check
```

Expected: all five steps pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain/writePlan.ts
git commit -m "refactor: plan state and horizon no-ops through sameValue

The domain guide already names sameValue as the one answer to \"is this the
same placement\"; writePlan.ts spelled the comparison out twice instead, which
is the drift the shared helper exists to prevent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: One `formatCivil`, not two

`src/domain/timeline.ts:54` exports `formatCivil` and `src/view/render/timeline.ts` already imports it. `src/view/interactions/plan.ts:100` defines a second, near-identical copy.

They differ in one way: the domain one pads the year to four digits, the private one does not.

**Corrected after review:** the first draft of this brief claimed that difference was unreachable because `readDate` (`src/domain/noteFields.ts:199`) requires `^(\d{4})-`. That is wrong — `\d{4}` matches four digit *characters*, not a value ≥ 1000, so a note spelling `0050-01-01` yields `year: 50` and the padding difference is real. It is still not a regression, and the direction matters: unpadded `50-01-01` is not a valid `<input type="date">` value and the field would silently blank, while the padded form round-trips. So this task is a deduplication that happens to close a latent hole. Do not present it as a bug fix in the commit message; do not present it as unreachable either.

**Files:**
- Modify: `src/view/interactions/plan.ts` (imports, and delete lines 99-103)
- Test: no new test. Covered by `test/view/plan.test.ts` (the schedule prompt's prefilled start/target values).

**Interfaces:**
- Consumes: `formatCivil(date: CivilDate): string` from `src/domain/timeline.ts:54`. `view/` importing `domain/` is permitted by the layer rule.
- Produces: nothing new.

- [ ] **Step 1: Watch the covering test pass**

Run:

```bash
npx vitest run test/view/plan.test.ts
```

Expected: PASS.

- [ ] **Step 2: Prove it pins the formatting**

Temporarily change `src/view/interactions/plan.ts:102` to return `'x'` and re-run `test/view/plan.test.ts`.

Expected: FAIL on a prefilled schedule value. If it passes, stop and report — the prompt's prefill is unpinned. Then restore.

- [ ] **Step 3: Import the domain function**

`src/view/interactions/plan.ts` has no import from `../../domain/timeline` yet. Add one after the existing `settings` import (line 5), keeping the file's alphabetical-by-module habit:

```typescript
import { formatCivil } from '../../domain/timeline';
```

- [ ] **Step 4: Delete the private copy**

Remove these five lines from `src/view/interactions/plan.ts` (99-103):

```typescript
/** `YYYY-MM-DD`, the shape the prompt asks for and the one every reader here accepts. */
function formatCivil(date: CivilDate): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
```

- [ ] **Step 5: Check whether `CivilDate` is still used in the file**

Run:

```bash
npx tsc -noEmit -skipLibCheck
```

If it reports `CivilDate` as unused in `plan.ts`, drop it from the `../../domain/noteFields` import on line 4 (leaving `sameValue`). If it is still used by another signature in the file, leave the import alone. Do not guess — let the compiler answer.

- [ ] **Step 6: Run the covering test, then the whole gate**

```bash
npx vitest run test/view/plan.test.ts
```

Expected: PASS.

```bash
npm run check
```

Expected: all five steps pass. Fallow's duplication rule should now report one fewer clone.

- [ ] **Step 7: Commit**

```bash
git add src/view/interactions/plan.ts
git commit -m "refactor: use the domain formatCivil in the schedule prompt

The same YYYY-MM-DD formatter was written twice; view/render/timeline.ts
already imports the domain one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Fold `optionalKeyFor`'s switch into the table it duplicates

`PROPERTY_TABLE` (`src/domain/settings.ts:246`) is already keyed by `OptionalField` and the compiler already checks it is complete. `optionalKeyFor` (`src/domain/settings.ts:274`) is a fifteen-line switch over those same six fields, mapping each to a `BacklogSettings` key. Two statements of one mapping.

The table's own doc comment says four readers depend on it being one statement. This makes `optionalKeyFor` the fifth, instead of the second copy.

**Files:**
- Modify: `src/domain/settings.ts:229-237` (the `OptionalProperty` interface), `:246-255` (`PROPERTY_TABLE`), `:273-289` (`optionalKeyFor`)
- Test: no new test. Covered by `test/domain/settings.test.ts:245-268` (`describe('optionalKeyFor')`, which asserts all six keys in declaration order both configured and unconfigured) and `:283` (`OPTIONAL_FIELDS.map(optionalProperty)` deep-equals `OPTIONAL_PROPERTIES`).

**Interfaces:**
- Consumes: `BacklogSettings` from the same file.
- Produces: `OptionalProperty` gains one field —

```typescript
	/** The `BacklogSettings` field this property's configured key is resolved into. */
	settingsKey: OptionalSettingsKey;
```

  where `OptionalSettingsKey` is a new non-exported union in `src/domain/settings.ts`:

```typescript
type OptionalSettingsKey = 'stateKey' | 'startedDateKey' | 'finishedDateKey' | 'horizonKey' | 'startKey' | 'targetKey';
```

  `optionalKeyFor(settings: BacklogSettings, field: OptionalField): string` keeps its exact signature. Nothing else changes; no caller of `OptionalProperty` constructs one by literal (verified: the only producer is `optionalProperty`, which spreads the table).

- [ ] **Step 1: Watch the covering tests pass**

```bash
npx vitest run test/domain/settings.test.ts
```

Expected: PASS.

- [ ] **Step 2: Add the union type**

In `src/domain/settings.ts`, immediately above the `OptionalProperty` interface (line 229), add:

```typescript
/**
 * The `BacklogSettings` field one optional property's key lands in. Spelled as a union
 * rather than `keyof BacklogSettings` so the table below can only name a string-valued
 * key: `keyof` would let a boolean option through and `optionalKeyFor` would return one.
 */
type OptionalSettingsKey = 'stateKey' | 'startedDateKey' | 'finishedDateKey' | 'horizonKey' | 'startKey' | 'targetKey';
```

- [ ] **Step 3: Add the field to the interface**

Inside `export interface OptionalProperty` (`src/domain/settings.ts:229`), after the `label` field, add:

```typescript
	/** The `BacklogSettings` field this property's configured key is resolved into. */
	settingsKey: OptionalSettingsKey;
```

- [ ] **Step 4: Run the build to see the table fail**

```bash
npx tsc -noEmit -skipLibCheck
```

Expected: FAIL — six errors, one per row of `PROPERTY_TABLE`, each saying `settingsKey` is missing. That is the compiler doing the completeness check this task is relying on. If it reports fewer than six, the table has drifted from the union and that is the real finding.

- [ ] **Step 5: Fill in the table**

Replace `PROPERTY_TABLE` (`src/domain/settings.ts:246-255`) with:

```typescript
const PROPERTY_TABLE: Record<OptionalField, Omit<OptionalProperty, 'field'>> = {
	state: { option: 'stateProperty', suggested: 'status', label: 'state', settingsKey: 'stateKey' },
	startedDate: { option: 'startedDateProperty', suggested: 'started', label: 'started date', settingsKey: 'startedDateKey' },
	finishedDate: { option: 'finishedDateProperty', suggested: 'finished', label: 'finished date', settingsKey: 'finishedDateKey' },
	// The roadmap's three, whose suggestions follow the ecosystem's own vocabulary
	// (the Tasks plugin's `start` and `due`) without assuming it.
	horizon: { option: 'horizonProperty', suggested: 'horizon', label: 'horizon', settingsKey: 'horizonKey' },
	start: { option: 'startProperty', suggested: 'start', label: 'start', settingsKey: 'startKey' },
	target: { option: 'targetProperty', suggested: 'due', label: 'target', settingsKey: 'targetKey' },
};
```

- [ ] **Step 6: Replace the switch**

Replace `optionalKeyFor` (`src/domain/settings.ts:273-289`) — the doc comment and the whole switch — with:

```typescript
/**
 * The frontmatter key one optional field is stored under; '' when it is unconfigured.
 * Read off `PROPERTY_TABLE`, so the field → key mapping is stated exactly once: a
 * switch beside the table was a second statement of it, and the compiler only ever
 * checked one of them for completeness.
 */
export function optionalKeyFor(settings: BacklogSettings, field: OptionalField): string {
	return settings[PROPERTY_TABLE[field].settingsKey];
}
```

- [ ] **Step 7: Run the covering tests, then the whole gate**

```bash
npx vitest run test/domain/settings.test.ts
```

Expected: PASS, unchanged count. In particular `optionalKeyFor` still returns the six keys in `OPTIONAL_FIELDS` order and six empty strings on `defaultSettings()`.

```bash
npm run check
```

Expected: all five pass. Watch fallow's complexity/CRAP output — `settings.ts` should improve, since a six-arm switch is gone.

- [ ] **Step 8: Commit**

```bash
git add src/domain/settings.ts
git commit -m "refactor: resolve optional keys off PROPERTY_TABLE

The table is already keyed by field and already compiler-checked for
completeness; the switch beside it was the same mapping written a second time,
unchecked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: State the vocabulary rule once instead of three times

`src/domain/vocabulary.ts` holds three collectors. Its own preamble says why they live together: *"All three obey one rule … **a note the Base excluded contributes nothing.** … Stated once here, each collector is a line of it rather than three chances to forget."* The comment says "one line of it"; the code is three copies of the same `Map` fold.

The fold is identical in all three: skip `outsideFilter`, key case-insensitively, keep the casing seen first. Only what comes *out* of each item and what happens *after* differ — states sort and partition by done, tags sort, horizons keep tree order.

**Files:**
- Modify: `src/domain/vocabulary.ts` (add one private helper; each of the three exported functions shrinks)
- Test: no new test. All three collectors are pinned, including the context-row rule: `test/domain/model.test.ts:286` and `:537` (states, order and done-last), `:516` and `:525` (tags), `test/domain/roadmap.test.ts:317-345` (horizons, minting order and the "takes nothing from a context row" case), `test/domain/modelContextRows.test.ts:217` (states from a context row) and `:227` (tags from a context row).

**Interfaces:**
- Consumes: `tagKey` from `src/domain/noteFields.ts:74`, already imported.
- Produces: no change to any exported signature. `collectObservedStates(all, settings)`, `collectObservedTags(all)` and `collectObservedHorizons(all)` all keep their exact names, parameters and return types — `src/domain/model.ts:169-178` is untouched.

- [ ] **Step 1: Watch every covering test pass**

```bash
npx vitest run test/domain/model.test.ts test/domain/modelContextRows.test.ts test/domain/roadmap.test.ts
```

Expected: PASS. Record the count.

- [ ] **Step 2: Prove the context-row rule is pinned in all three**

Temporarily delete the `if (item.outsideFilter) continue;` line from **`collectObservedHorizons`** only, and re-run:

```bash
npx vitest run test/domain/roadmap.test.ts
```

Expected: FAIL on `'takes nothing from a context row'`. Restore, then repeat for `collectObservedStates` and `collectObservedTags`, each time expecting a failure in `test/domain/modelContextRows.test.ts`. All three must fail. If any survives, that collector is unpinned and needs a test before it is refactored — do not proceed on that one.

- [ ] **Step 3: Add the fold**

In `src/domain/vocabulary.ts`, immediately below the `VocabularySource` interface, add:

```typescript
/**
 * The rule the three collectors below share, stated once: walk the loaded items,
 * **skip every context row** — an excluded note's value is not this base's
 * vocabulary — and keep the first casing of each distinct value, in the order the
 * walk met it. `key` is how identity is decided; the tags collector passes `tagKey`
 * rather than lowercasing again, because tag identity is that function's to define.
 */
function firstSeen(
	all: VocabularySource[],
	valuesOf: (item: VocabularySource) => string[],
	key: (value: string) => string = (value) => value.toLowerCase(),
): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		for (const value of valuesOf(item)) {
			if (!seen.has(key(value))) seen.set(key(value), value);
		}
	}
	return [...seen.values()];
}
```

- [ ] **Step 4: Rewrite the three collectors**

Replace the bodies of all three exported functions, keeping every doc comment above them exactly as it is. `collectObservedStates`:

```typescript
export function collectObservedStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const values = firstSeen(all, (item) => (item.stateValue === null ? [] : [item.stateValue])).sort((a, b) =>
		a.localeCompare(b),
	);
	return [...values.filter((v) => !done.has(v.toLowerCase())), ...values.filter((v) => done.has(v.toLowerCase()))];
}
```

`collectObservedTags`:

```typescript
export function collectObservedTags(all: VocabularySource[]): string[] {
	return firstSeen(all, (item) => item.tags, tagKey).sort((a, b) => a.localeCompare(b));
}
```

`collectObservedHorizons`:

```typescript
export function collectObservedHorizons(all: VocabularySource[]): string[] {
	return firstSeen(all, (item) => (item.horizon.value === null ? [] : [item.horizon.value]));
}
```

Two things to get right. First, `.sort()` on the array `firstSeen` returns is safe — it is a fresh array built from `seen.values()`, not a shared one. Second, the states collector must sort **before** partitioning, exactly as it does today: alphabetical, then open states ahead of done ones.

- [ ] **Step 5: Run the covering tests, then the whole gate**

```bash
npx vitest run test/domain/model.test.ts test/domain/modelContextRows.test.ts test/domain/roadmap.test.ts
```

Expected: PASS with the same count as Step 1.

```bash
npm run check
```

Expected: all five pass. `vocabulary.ts` drops roughly 25 lines of body; check the coverage summary and raise a threshold if a number moved up.

- [ ] **Step 6: Commit**

```bash
git add src/domain/vocabulary.ts
git commit -m "refactor: fold the three vocabulary collectors onto one walk

The module's own preamble says the context-row rule is stated once so each
collector is a line of it. It was written three times; now it is one fold and
three call sites, and tag identity still goes through tagKey.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: One `pbl-empty` shell, one `pbl-empty-filter` shell

`src/view/render/emptyStates.ts` builds the same DOM five times. Three states build `pbl-empty` → `pbl-empty-icon` → `pbl-empty-title` → `pbl-empty-hint` and then differ only in their footer button; two build `pbl-empty-filter` → `pbl-empty-filter-icon` → a text div → a button.

This matters beyond line count: `docs/requirements/One stylesheet per concern.md` maps stylesheet regions to the module that writes each class. Five hand-written copies of a class list are five places a rename has to land.

**Files:**
- Modify: `src/view/render/emptyStates.ts`
- Test: no new test. Covered by `test/view/rendering.test.ts` (the tree's empty state and its hint text), `test/view/board.test.ts` (the no-workflow guidance and its setup button), `test/view/roadmap.test.ts` (the no-axis guidance, including the half-configured horizon wording), `test/view/filter.test.ts` (the no-match state and its Clear filter button) and `test/view/visibility.test.ts` (the all-done state and its Show completed items button).

**Interfaces:**
- Consumes: `setIcon` from `obsidian`, already imported.
- Produces: two non-exported helpers in this file only —

```typescript
function guidanceShell(treeEl: HTMLElement, icon: string, title: string, hint: string): HTMLElement
function noticeShell(treeEl: HTMLElement, icon: string, text: string): HTMLElement
```

  Each returns the container so the caller can append its own footer. No exported signature in this file changes: `renderLoadingState`, `renderEmptyState`, `renderBoardNoWorkflowState`, `renderRoadmapNoAxisState`, `renderFilterEmptyState` and `renderAllDoneState` all keep their names and parameters.

- [ ] **Step 1: Watch every covering test pass**

```bash
npx vitest run test/view/rendering.test.ts test/view/board.test.ts test/view/roadmap.test.ts test/view/filter.test.ts test/view/visibility.test.ts
```

Expected: PASS. Record the count.

- [ ] **Step 2: Prove the class names are pinned**

Temporarily change `pbl-empty-title` to `pbl-empty-heading` in `renderEmptyState` and re-run `test/view/rendering.test.ts`.

Expected: FAIL. If it passes, the tests assert on text without asserting on structure — note it and continue, but do not treat the suite as proof the DOM is unchanged; diff the rendered HTML by hand in Step 5 instead. Restore the class either way.

- [ ] **Step 3: Add the two shells**

In `src/view/render/emptyStates.ts`, directly below the module's opening doc comment and above `renderLoadingState`, add:

```typescript
/**
 * The shell every piece of *guidance* shares — icon, title, hint — returned so the
 * caller can add the one action that differs. Written once because the class names are
 * the contract `docs/requirements/One stylesheet per concern.md` maps to this module,
 * and five hand-written copies of them are five places a rename has to land.
 */
function guidanceShell(treeEl: HTMLElement, icon: string, title: string, hint: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), icon);
	empty.createDiv({ cls: 'pbl-empty-title', text: title });
	empty.createDiv({ cls: 'pbl-empty-hint', text: hint });
	return empty;
}

/**
 * The lighter shell the two *transient* states share — nothing is wrong, something is
 * merely hidden — one line of text and a way back, on its own class so the stylesheet
 * can treat it differently from guidance.
 */
function noticeShell(treeEl: HTMLElement, icon: string, text: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), icon);
	empty.createDiv({ text });
	return empty;
}
```

- [ ] **Step 4: Rewrite the five callers**

`renderEmptyState` — keep its existing doc comment and the `focused` / `topLevel` derivation, replace the four DOM lines:

```typescript
export function renderEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const model = host.model;
	const focused = model?.focused ?? false;
	const topLevel = focused && model ? newItemType(host.settings, model) : LEVELS[0];
	const empty = guidanceShell(
		treeEl,
		'list-tree',
		focused ? `No ${topLevel} items` : 'No backlog items',
		emptyHint(host, focused, topLevel),
	);
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: `New ${topLevel}` });
	btn.addEventListener('click', () => promptCreateItem(host, [topLevel], null));
}
```

`renderBoardNoWorkflowState` — keep its doc comment, and keep the hint string byte for byte (it is user-facing copy under the marketplace sentence-case rule):

```typescript
export function renderBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		'No workflow to show',
		'The board is a projection of your workflow, and this view has no state property yet. ' +
			'Set "State property" in the view options — and optionally "Workflow states (in order)" — ' +
			'and the board will draw one column per state.',
	);
	renderSetupCta(host, empty, ['state']);
}
```

`renderRoadmapNoAxisState` — keep its doc comment and the `halfConfigured` / `horizonHalf` derivation exactly as it is:

```typescript
export function renderRoadmapNoAxisState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const halfConfigured = host.settings.horizonKey !== '' && host.settings.horizonValues.length === 0;
	const horizonHalf = halfConfigured
		? 'A horizon property is set, but "Horizons (in order)" is empty — fill it to get Now-Next-Later buckets'
		: 'Set "Horizon property" and "Horizons (in order)" for Now-Next-Later buckets';
	const empty = guidanceShell(
		treeEl,
		'map',
		'No axis to show',
		'The roadmap draws whichever axis the view options declare — confidence horizons, or dates. ' +
			`${horizonHalf}, or set "Start date property" or "Target date property" for a timeline.`,
	);
	renderSetupCta(host, empty, ['horizon', 'start', 'target']);
}
```

`renderFilterEmptyState`:

```typescript
export function renderFilterEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = noticeShell(treeEl, 'search-x', `No items match "${host.filterText.trim()}".`);
	const btn = empty.createEl('button', { text: 'Clear filter' });
	btn.addEventListener('click', () => {
		host.setFilter('');
		host.focusFilter();
	});
}
```

`renderAllDoneState` — keep its doc comment:

```typescript
export function renderAllDoneState(host: BacklogViewHost, treeEl: HTMLElement, total: number): void {
	const empty = noticeShell(treeEl, 'circle-check', `All ${total} item${total === 1 ? ' is' : 's are'} done and hidden.`);
	const btn = empty.createEl('button', { text: 'Show completed items' });
	btn.addEventListener('click', () => host.config.set('showCompleted', true));
}
```

`renderLoadingState` keeps its own shape: it carries `role="status"` and `aria-live="polite"` on the container and a spinner class the others do not have. Folding it into a shell would mean a fourth parameter nothing else uses — leave it alone.

- [ ] **Step 5: Confirm the DOM is byte-identical where it matters**

Run:

```bash
npx vitest run test/view/rendering.test.ts test/view/board.test.ts test/view/roadmap.test.ts test/view/filter.test.ts test/view/visibility.test.ts
```

Expected: PASS with the same count as Step 1. If Step 2 showed the class names are not asserted, additionally check by hand that the element order inside each state is unchanged: container, icon, title, hint, button — the CSS in `styles.css` around the empty-state region positions on sibling order.

- [ ] **Step 6: Run the whole gate**

```bash
npm run check
```

Expected: all five pass. `docs-check.mjs` will still be happy — the notes that name this module name it by path, not by line, so nothing in `docs/` breaks. Line references like `emptyStates.ts:50` inside backticks are not validated by the checker and will now be stale by a few lines; that is pre-existing drift, not this task's to fix, and not worth chasing.

- [ ] **Step 7: Commit**

```bash
git add src/view/render/emptyStates.ts
git commit -m "refactor: build the empty-state shells in one place each

Five hand-written copies of the same class list, in the module whose class
names a requirements note maps to the stylesheet. Now two shells and five
callers that only supply what differs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Delete the pragmatic-drag-and-drop spike test

`test/view/pragmaticSpike.test.ts` asserts that the *library* fires its adapters under synthetic jsdom drag events. Its own comment gives the reason to keep it: *"if a library upgrade breaks jsdom compatibility, this file names the problem before a board test muddies it."*

That is a speculative diagnostic. `test/view/boardMoves.test.ts`, `test/view/contextCardWrites.test.ts` and `test/view/roadmapMoves.test.ts` drive the same adapter through the same synthetic events against real write paths — a library upgrade that broke jsdom compatibility would fail all of them loudly, and the first thing anyone would do is read the diff, which names the dependency. The spike buys a slightly nicer failure message for an event that has not happened.

Do this task last. It is the only one whose risk is the docs register rather than the code.

**Files:**
- Delete: `test/view/pragmaticSpike.test.ts`
- Modify: none. `docs/issues/Pragmatic drag and drop for the board.md:77` names the file, and that is allowed — `docs-check.mjs` treats `issues/` as a record of a moment (`LIVING` is `requirements/` and `adrs/` only), so a path it names that no longer exists is reported as a historical reference, not an error.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Confirm the board suites really do exercise the adapter**

```bash
npx vitest run test/view/boardMoves.test.ts test/view/roadmapMoves.test.ts test/view/contextCardWrites.test.ts
```

Expected: PASS. Then confirm they go through the library rather than around it:

```bash
npx vitest run test/view/boardMoves.test.ts --coverage --coverage.include='src/view/interactions/cardDrag.ts'
```

Expected: `cardDrag.ts` covered — its `draggable` and `dropTargetForElements` registrations executed. If `cardDrag.ts` shows no coverage, **stop and do not delete the spike**: the board tests are reaching the host method directly and the spike is the only thing proving the adapter works at all. Report that instead; it is a bigger finding than this deletion.

- [ ] **Step 2: Delete the file**

```bash
git rm test/view/pragmaticSpike.test.ts
```

- [ ] **Step 3: Run the whole gate**

```bash
npm run check
```

Expected: all five pass. Two things to read rather than skim:

- The `docs` step prints a `historical path reference(s)` block; `docs/issues/Pragmatic drag and drop for the board.md -> test/view/pragmaticSpike.test.ts` should appear there. That line is informational — the run must still end `✓ register and ADRs consistent`. If it instead **fails** with `names test/view/pragmaticSpike.test.ts, which does not exist`, then that note is under a living folder after all: restore the file, add the note's path to the finding, and stop.
- The coverage summary. Removing this test removes no `src/` coverage (it imports only `test/helpers/`), so the four numbers should be unchanged. If any dropped, the spike was covering src after all — restore it.

- [ ] **Step 4: Commit**

```bash
git commit -m "test: drop the pragmatic drag-and-drop spike

It asserted that the dependency works under jsdom. The board, roadmap and
context-card suites drive the same adapter through real write paths, so a
broken upgrade already fails in a dozen places.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Not in this plan — four findings that need a decision first

The audit's largest cuts each reverse something this repository decided on purpose and wrote down, or change behaviour the guides describe. Writing them up as tasks would be me overruling a documented decision inside a refactoring plan, so each gets a brief instead. Say the word on any of them and I will expand it into tasks in this same shape.

### A. The docs register gate — about 1800 lines

**Corrected after review:** the first draft measured these six files and undercounted every one of them by 5-15%. Re-measured at `b7ed566` (`wc -l`, none of these files is touched by this branch): `docs-check.mjs` (589) plus `test/docs/checkerAccepts.test.ts` (302), `checkerRejects.test.ts` (306), `checkerRejectsAdrs.test.ts` (250), `surfaces.test.ts` (149) and `test/helpers/register.ts` (240): **1836 lines that ship nothing**, validating markdown grammar.

What earns its place: unresolved wikilinks, dead `src/`/`test/` paths in living notes, and "no note names this module". Those three are about 80 lines and they catch real rot.

What is arguable: use-case section ordering and duplicate-section counting, the extension-label step grammar, ADR supersession reciprocity *and* chronology, the ADR numbering-gap scan — and above all the 1007 lines of tests proving the checker itself works in both directions.

**The decision:** is `docs/` a product surface (it is the plugin's own dogfood fixture, opened as a vault by `npm run test-build`) or a notebook? If it is a product surface, the gate is proportionate and this finding is void. If it is a notebook, the gate costs more to maintain than the register it guards. Root `CLAUDE.md` argues the former, at length and from scars — which is why this is a brief and not a task.

### B. The three pragmatic-drag-and-drop dependencies

ADR 0018 chose them. The tree's own drag is 198 lines of native HTML5 DnD (`src/view/interactions/dragDrop.ts`) and does the *harder* job — three drop zones per row, ratio-based zone math, hover-to-expand. The card drag is the easy case: a whole region is the target, no edge detection, no reordering, and `src/view/interactions/cardDrag.ts` is 166 lines of wiring around it. (Corrected after review: the first draft undercounted both by roughly 10%.)

**The decision:** does the auto-scroll behaviour justify the bundle? `autoScrollForElements` is the one piece that is genuinely fiddly to hand-roll. If it does, keep all three. If not, `-3 deps` and `cardDrag.ts` shrinks toward the tree's shape.

Independently cuttable either way: `@atlaskit/pragmatic-drag-and-drop-live-region` backs exactly one call, `announce()`. A `div[role="status"][aria-live="polite"]` on `document.body` with a `textContent` assignment is about eight lines and removes one dependency without touching the drag at all. That one I would take now if you want a fourth safe task.

### C. `src/view/host.ts` — a 204-line interface with one implementer

No test double implements `BacklogViewHost`; `ProductBacklogView` is the only one, and `src/view/render/board.ts` annotates locals with it purely to satisfy fallow. The stated reason is cycle-freedom, and `import type { ProductBacklogView }` gives that for nothing — type-only imports are erased before esbuild sees them.

**The decision:** ADR 0003 makes the interface a layering statement, not a technical necessity, and about 140 of those lines are doc comments that are genuinely load-bearing (they are the best description of the view's contract anywhere in the repo). Cutting it means relocating that prose, not deleting it, so the real saving is well under 140 lines. Lowest value-per-risk of the three; I would leave it.

### D. `UndoRecovery` — about 64 lines plus its tests

`src/view/interactions/undo.ts:46-109` stashes, carries and rejoins the redo inverses stranded when an undo replay fails **partway but not on its first file**, so that a later retry's redo re-applies the whole recovered batch rather than only its tail. On a single-level, session-only undo.

Reaching it takes: a batch lands, the user undoes it, a write throws mid-replay but not on file one, the user undoes again to finish the remainder, then redoes. The replacement is `this.lastUndo = remainder` on partial failure and dropping the carried redo — about five lines.

**The decision:** this is not data loss (nothing is destroyed either way; a redo simply stops being offered), but it *is* behaviour that `src/view/CLAUDE.md` describes in detail and that `test/view/undo.test.ts` pins. Cutting it means deleting documented behaviour and its tests, which is a product call, not a refactor. If the answer is "the chain was theoretical", the cut is clean and mechanical.

---

## Expected result

**Corrected after review:** this section originally predicted "roughly -60 lines of source and -55 lines of test". That estimate was wrong by roughly 3.5x on the source side. Measured against `git diff b7ed566..HEAD` (`src/` code lines via ESLint's own `max-lines` rule — the metric `skipBlankLines`/`skipComments` count, run with `max: 0` to read the reported total off each file, before and after):

- `src/` **code lines**: **-17**, not -60. Per file: `settings.ts` -11, `vocabulary.ts` -4, `writePlan.ts` -3, `plan.ts` -3, `emptyStates.ts` **+4** (the two extracted shells cost more lines than the five call sites saved). These are stable figures: every later commit on this branch touched comments or tests, neither of which the code-line metric counts.
- `src/` and `test/` **physical lines**: read them, do not trust a number written here —

```bash
git diff --shortstat b7ed566..HEAD -- src test
```

  Source comes out slightly *positive* (the doc comments the table and the shells picked up outweigh what the duplication removed) and `test/` comes out around fifty lines down, dominated by `test/view/pragmaticSpike.test.ts` (55 lines, one test) going away; `test/helpers/dnd.ts` un-exported three helpers it no longer shares, and `rendering.test.ts` and `filter.test.ts` each gained one assertion.

  **Why a command and not a figure.** The first version of this section stated exact physical-line counts, and they were wrong within the same review round that produced them: they were measured before a sibling commit in that very round deleted two comment lines and added two test lines. Any statement a document makes about the size of its own diff is false as soon as one more commit lands, and this branch is *about* not stating things that cannot be checked. So the durable claim is below and the volatile numbers are a command.

No behaviour change, no dependency change, `npm run check` green on every commit. What this branch actually buys is not fewer lines — on the source side it is close to a wash — but a single statement of several rules that were previously spelled out two or three times: `sameValue` for "same placement", one field → key table instead of a table plus a switch, one fold instead of three vocabulary collectors, two DOM shells instead of five hand-written copies. The larger cuts wait on the four decisions above.
