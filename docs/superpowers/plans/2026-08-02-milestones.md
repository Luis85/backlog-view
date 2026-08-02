# Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Milestone` to the fixed type vocabulary as a **declared marker** — no rung, no children, no parent — that files into its own folder, states one date in the roadmap's configured target property, and draws on the dated axis as a diamond on its row plus a line down the whole plan.

**Architecture:** The vocabulary gains a **third category** beside `LEVELS` and `EXTRA_TYPES`: `MARKER_TYPES`, with `ALL_TYPES` as the union of all three. `isMarkerType` is the one predicate every downstream rule asks. The marker is deliberately **not** an entry in `EXTRA_TYPES` — that list means *pinned at `EXTRA_TYPE_RANK`, children are Tasks, hangs from Epic/Feature/PBI*, and a milestone is the opposite on all three counts, so putting the name there would falsify the contract rather than extend it. Everything downstream is a guard at a call site that already exists: the autoType cascade stops at a marker, the rollup walk never counts one, `deriveBars` reduces one to its target point *before* the span checks, the placement actions answer for the type rather than for the control, and `barGeometry` learns to say "wholly outside the window" instead of clamping a point onto an edge it does not sit on.

**Tech Stack:** TypeScript 6.0.x (held at `~6.0.3`), esbuild, vitest + jsdom, eslint (flat config, layered `no-restricted-imports`), fallow, `docs-check.mjs`.

## Global Constraints

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests + fallow + docs register. All five must pass **before every commit**. CI runs the same on Ubuntu and Windows.
- **`Milestone` must NOT be added to `EXTRA_TYPES`.** It is a third category. `isExtraType` must keep meaning exactly one thing at its four call sites.
- The cascade's retype exemption widens to the declared **non-rung** types only. `Epic`, `Feature`, `PBI` and `Task` must keep being retyped by position — an exemption that reached the ladder would silently undo `docs/requirements/Assigning type on a move.md`.
- **eslint `max-lines` counts with `skipBlankLines` and `skipComments`** — it is not `wc -l`. Current counted sizes of the files this plan touches, against a **400** cap for `src/` and **450** for `test/`:
  `src/domain/model.ts` **375** (25 spare) · `src/view/interactions/menu.ts` **249** · `src/view/render/rows.ts` **221** · `src/domain/roadmap.ts` **186** · `src/view/interactions/plan.ts` **92** · `src/view/render/timeline.ts` **92** ·
  `test/domain/model.test.ts` **422** (28 spare) · `test/domain/roadmap.test.ts` **419** (31 spare) · `test/domain/writePlan.test.ts` **362** · `test/view/plan.test.ts` **314** · `test/view/rendering.test.ts` **271** · `test/domain/settings.test.ts` **273** · `test/view/roadmapFrame.test.ts` **232** · `test/view/menu.test.ts` **184** · `test/domain/itemTypes.test.ts` **149** · `test/domain/timeline.test.ts` **105**.
  Because `model.test.ts` and `roadmap.test.ts` have almost no room, **Tasks 6 and 7 put their tests in a new file `test/domain/milestones.test.ts`**, which `docs-check.mjs` then requires a note to name (Task 11 does that).
  Measure with: `npx eslint <file> --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'`
- **Watch every invariant test fail before trusting it.** Revert the fix, run the test, see red, restore. A comment stating a rule is not a check (`docs/issues/A comment that states a rule is not a check.md`).
- Never write frontmatter outside `storage/frontmatter.ts`. Layer rule: `main → commands → view → storage → domain`, each may reach anything below it and nothing above.
- Marketplace rules: sentence-case UI text, `setCssProps` over inline styles, no global `app`.
- Branch: `claude/next-product-increment-delxnx`, already reset to the merged `origin/main` (`ddc6370`). Commit per task.

---

### Task 1: `Milestone` joins the vocabulary as a declared marker

The third category, its folder default, and the predicate everything else asks.

**Files:**
- Modify: `src/domain/settings.ts` (the `LEVELS`/`EXTRA_TYPES`/`ALL_TYPES` block ~line 92, `DEFAULT_TYPE_SUBFOLDERS` ~line 106)
- Modify: `src/domain/itemTypes.ts` (beside `isExtraType`, ~line 57)
- Test: `test/domain/settings.test.ts`, `test/domain/itemTypes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MARKER_TYPES: string[]` (exported from `src/domain/settings.ts`, value `['Milestone']`)
  - `ALL_TYPES` becomes `[...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES]`
  - `isMarkerType(typeName: string | null): boolean` (exported from `src/domain/itemTypes.ts`)
  - `defaultTypeFolder('Milestone')` → `'docs/milestones'`; `typeFolderKey('Milestone')` → `'typeFolder.milestone'` (already generic)

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/settings.test.ts` (a new `describe` at the end of the file):

```ts
describe('the marker category', () => {
	it('declares Milestone outside both the ladder and the extra types', () => {
		// The whole point of the third category: every rule that reads EXTRA_TYPES keeps
		// meaning exactly what `Types beside the ladder` says it means.
		expect(MARKER_TYPES).toEqual(['Milestone']);
		expect(LEVELS).not.toContain('Milestone');
		expect(EXTRA_TYPES).not.toContain('Milestone');
		expect(ALL_TYPES).toEqual([...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES]);
	});

	it('ships the marker a folder of its own under the home folder', () => {
		expect(defaultTypeFolder('Milestone')).toBe('docs/milestones');
		expect(defaultTypeFolder('Milestone', 'work')).toBe('work/milestones');
		expect(defaultSettings().typeFolders.milestone).toBe('docs/milestones');
	});
});
```

Add whatever of `MARKER_TYPES` / `ALL_TYPES` / `LEVELS` / `EXTRA_TYPES` / `defaultTypeFolder` / `defaultSettings` is missing from the file's existing `../../src/domain/settings` import.

Append to `test/domain/itemTypes.test.ts`:

```ts
describe('isMarkerType', () => {
	it('recognises every declared marker, case-insensitively, and nothing else', () => {
		for (const marker of MARKER_TYPES) {
			expect(isMarkerType(marker)).toBe(true);
			expect(isMarkerType(marker.toLowerCase())).toBe(true);
		}
		// The trap this whole design exists to avoid: a marker is not an extra type, and
		// asking one predicate the other's question must stay a wrong answer.
		for (const other of [...LEVELS, ...EXTRA_TYPES]) expect(isMarkerType(other)).toBe(false);
		expect(isMarkerType('Spike')).toBe(false);
		expect(isMarkerType(null)).toBe(false);
		expect(MARKER_TYPES.some((m) => isExtraType(m))).toBe(false);
	});
});
```

Add `isMarkerType` to the existing `../../src/domain/itemTypes` import, and `MARKER_TYPES`, `LEVELS`, `EXTRA_TYPES` to the `../../src/domain/settings` import in that file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/settings.test.ts test/domain/itemTypes.test.ts`
Expected: FAIL — `MARKER_TYPES` and `isMarkerType` are not exported.

- [ ] **Step 3: Add the third category**

In `src/domain/settings.ts`, replace the `LEVELS`/`EXTRA_TYPES`/`ALL_TYPES` block:

```ts
export const LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];
export const EXTRA_TYPES = ['Issue', 'Bug'];
/**
 * The third category: a declared **marker**. It occupies no rung, holds nothing, and
 * hangs from nothing — the opposite of an extra type on all three counts, which is why
 * the name is here rather than in `EXTRA_TYPES`. That list means *pinned at
 * `EXTRA_TYPE_RANK`, children are Tasks, hangs from an Epic, a Feature or a PBI*
 * (`itemTypes.ts` states it), so adding a marker to it would not extend the contract but
 * falsify it, and `isExtraType` would start meaning two things at four call sites.
 */
export const MARKER_TYPES = ['Milestone'];
/** Every declared type, ladder first — the whole vocabulary in one list. */
export const ALL_TYPES = [...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES];
```

In `DEFAULT_TYPE_SUBFOLDERS`, add the entry after `bug`:

```ts
	bug: 'bugs',
	milestone: 'milestones',
```

- [ ] **Step 4: Add the predicate**

In `src/domain/itemTypes.ts`, add `MARKER_TYPES` to the import from `./settings`, and add below `isExtraType`:

```ts
/**
 * True when `typeName` is a declared MARKER (case-insensitive): a name that occupies no
 * rung, holds nothing and hangs from nothing. Deliberately a second predicate rather than
 * a widened `isExtraType` — the two answer opposite questions about rank, children and
 * parents, and the four sites that ask `isExtraType` mean the pinned-rank container.
 */
export function isMarkerType(typeName: string | null): boolean {
	if (typeName === null) return false;
	const name = typeName.toLowerCase();
	return MARKER_TYPES.some((t) => t.toLowerCase() === name);
}
```

Also extend the module docblock at the top of `itemTypes.ts` — after the extra-types paragraph, add:

```
 * A **marker** is the third category and the inverse of all three: no rung, no children,
 * no parent. It has no `levelIndex` either, so `computeLevel` treats it exactly as it
 * treats an unrecognised name — the difference is that it is *declared*, which is what
 * earns it a folder, a badge, admission to `hierarchyOnly` and acceptance as a focus.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/domain/settings.test.ts test/domain/itemTypes.test.ts`
Expected: PASS. Other suites will now fail — `test/docs/surfaces.test.ts` (it asserts a hand-written six type-folder keys) and `test/view/rendering.test.ts` (badge table, focus picker). **That is expected and is fixed in Task 3.** Note which ones fail; do not fix them here.

- [ ] **Step 6: Do not commit yet**

Because `npm run check` must pass on every commit, **Tasks 1, 2 and 3 form one commit** — Task 3 is what restores green. Continue to Task 2.

---

### Task 2: The marker is offered at the top level and offers nothing

**Files:**
- Modify: `src/domain/itemTypes.ts` (`LadderPosition` ~line 22, `childTypeChoices` ~line 75)
- Modify: `src/domain/backlogReadme.ts` (`position` ~line 69, the prose beneath the type table ~line 101)
- Test: `test/domain/itemTypes.test.ts`, `test/domain/backlogReadme.test.ts`

**Interfaces:**
- Consumes: `isMarkerType`, `MARKER_TYPES` (Task 1).
- Produces: `LadderPosition` gains `typeName: string | null`. `childTypeChoices(null)` → `['Epic', 'Milestone']`; `childTypeChoices(<marker>)` → `[]`.

- [ ] **Step 1: Write the failing tests**

In `test/domain/itemTypes.test.ts`, the existing helper is `get(typeName)` — read it and make it supply `typeName` on the `LadderPosition` it builds. Change the existing top-level expectation and add the new cases:

```ts
	// CHANGED: the top level is the ladder's top *plus* the markers.
	expect(childTypeChoices(null)).toEqual(['Epic', 'Milestone']);
```

```ts
	it('offers nothing under a marker — a point in time contains no work', () => {
		// Absent, not empty: `renderRowTrailing` builds its label from the first of these,
		// and `New undefined` on a modal with no types is what an empty list renders as.
		expect(childTypeChoices(get('Milestone'))).toEqual([]);
	});

	it('still refuses to put a marker under anything', () => {
		for (const parent of [...LEVELS, ...EXTRA_TYPES]) {
			expect(childTypeChoices(get(parent))).not.toContain('Milestone');
		}
	});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL — `childTypeChoices(null)` returns `['Epic']`, and a marker parent returns a ladder child.

- [ ] **Step 3: Teach `LadderPosition` the name**

In `src/domain/itemTypes.ts`:

```ts
/** Where an item sits on the ladder — all these functions need of a parent. */
export interface LadderPosition {
	/** Index into `LEVELS`; -1 for an extra type, a marker, or a type off the ladder. */
	levelIndex: number;
	/** The rung the item occupies, chained down the parent levels. */
	effectiveLevelIndex: number;
	/**
	 * The name on the note. A marker has no rung and therefore no position that could
	 * distinguish it, so the only thing that tells one from the ordinary item sitting at
	 * the same effective level is what it calls itself.
	 */
	typeName: string | null;
}
```

`BacklogItem` already carries `typeName: string | null`, so every view call site keeps compiling.

- [ ] **Step 4: Rewrite `childTypeChoices`**

```ts
export function childTypeChoices(parent: LadderPosition | null): string[] {
	// A marker holds nothing — no rung below it and no extra type beside it. The empty
	// list is the answer, and every affordance built from it has to be ABSENT rather than
	// empty (the add button, `New <child>`); see `renderRowTrailing`.
	if (parent !== null && isMarkerType(parent.typeName)) return [];
	const ladderChild = LEVELS[childLevelIndex(parent)];
	// Top level is the ladder's top plus the markers, and exactly those two: a milestone
	// hangs from nothing, while a Bug hangs from something and creating one with no parent
	// would make an item whose own rule says it should have had one.
	if (!parent) return [ladderChild, ...MARKER_TYPES];
	const onLadder = parent.levelIndex >= 0 && parent.levelIndex < LEVELS.length - 1;
	return onLadder ? [ladderChild, ...EXTRA_TYPES] : [ladderChild];
}
```

- [ ] **Step 5: Fix the README generator's synthesized position**

In `src/domain/backlogReadme.ts`, `position` must supply the new field. It is also where the marker's row gets its rank — a marker must NOT take `EXTRA_TYPE_RANK`:

```ts
/** Where a type sits on the ladder, for the two questions the type table asks. */
function position(typeName: string): LadderPosition {
	const levelIndex = LEVELS.indexOf(typeName);
	if (levelIndex >= 0) return { levelIndex, effectiveLevelIndex: levelIndex, typeName };
	// An extra type is pinned; a marker occupies no rung at all, and `childTypeChoices`
	// answers it by name before any rank is consulted.
	return { levelIndex: -1, effectiveLevelIndex: EXTRA_TYPE_RANK, typeName };
}
```

The generated type table already reads `ALL_TYPES` and `childTypeChoices`, so the `Milestone` row — parent *(nothing — it is a root)*, children *(nothing)* — appears with no further edit. Extend the prose sentence beneath the table (currently `${LEVELS.join(' → ')} is a ladder … ${EXTRA_TYPES.join(' and ')} sit *beside* it …`) with one clause naming the markers:

```ts
			`${MARKER_TYPES.join(' and ')} ${MARKER_TYPES.length === 1 ? 'is' : 'are'} neither: a ` +
			`marker hangs from nothing and holds nothing, and states a date rather than work.`,
```

Append it to the same string expression; add `MARKER_TYPES` to the `./settings` import. Read the surrounding code first and match its joining style exactly.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/domain/itemTypes.test.ts test/domain/backlogReadme.test.ts`
Expected: `itemTypes` PASS. `backlogReadme.test.ts` will likely fail on an assertion naming six rows — update it to read `ALL_TYPES` rather than a hand-written list, in the same spirit as Task 3.

---

### Task 3: The badge and the focus picker read the vocabulary, not a remembered list

This is the task that restores green, and it is the argument the spec makes: `EXTRA_TYPE_STYLE` already refuses to be forgotten because a test asserts the table covers the vocabulary; the picker and `typeFolder.<type>` do not, so make them.

**Files:**
- Modify: `src/view/render/rows.ts` (`EXTRA_TYPE_STYLE` ~line 28, its use in `renderBadge` ~line 233)
- Modify: `src/view/render/toolbar.ts` (`renderFocusPicker` ~lines 282–285)
- Modify: `styles.css` (beside `.pbl-lvl-issue` / `.pbl-lvl-bug`, ~line 660)
- Test: `test/view/rendering.test.ts`, `test/docs/surfaces.test.ts`

**Interfaces:**
- Consumes: `MARKER_TYPES`, `ALL_TYPES` (Task 1).
- Produces: `NON_RUNG_STYLE` (renamed from `EXTRA_TYPE_STYLE`, module-private) covering `[...EXTRA_TYPES, ...MARKER_TYPES]`; CSS class `.pbl-lvl-milestone`.

- [ ] **Step 1: Make the two remembered lists vocabulary-driven (these are the failing tests)**

In `test/docs/surfaces.test.ts`, replace the hand-written six:

```ts
	it('includes the keys generated per type, which no scan of the source could see', () => {
		// `key: typeFolderKey(type)` produces one persisted key per type name. Reading the
		// VOCABULARY rather than a copy of it is what makes a seventh name covered by
		// arriving rather than by being remembered — the discipline `NON_RUNG_STYLE`
		// already has, and the reason a `Milestone` could otherwise ship uncovered.
		const keys = optionKeys();
		expect(ALL_TYPES.length).toBeGreaterThan(0);
		for (const type of ALL_TYPES) {
			expect(keys).toContain(typeFolderKey(type));
		}
	});
```

Add an import of `ALL_TYPES, typeFolderKey` from `../../src/domain/settings`.

In `test/view/rendering.test.ts`, change the loop at ~line 47 and the focus-picker assertion at ~line 224:

```ts
		for (const type of [...EXTRA_TYPES, ...MARKER_TYPES]) {
```

```ts
		// Read off the vocabulary, so an eighth name is a failing test rather than an entry
		// a saved view can hold and no user can pick.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['All types', ...ALL_TYPES]);
```

Add `MARKER_TYPES` to that file's `../../src/domain/settings` import. Add a `Milestone`-typed note titled `Ship 1.0` to the fixture used by the per-extra-type badge test (~line 67), and assert its colour beside the existing ones:

```ts
		expect(badge('Ship 1.0')?.classList.contains('pbl-lvl-milestone')).toBe(true);
```

Read the fixture builder in the file and follow its shape exactly.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/view/rendering.test.ts test/docs/surfaces.test.ts`
Expected: FAIL — the picker lists seven, the milestone badge is `pbl-lvl-unknown`.

Note: `typeFolder.milestone` is already generated by `getViewOptions()` from `ALL_TYPES` with no source change (`src/domain/viewOptions.ts:202`), so that half passes on arrival — which is exactly the point of the change.

- [ ] **Step 3: Cover the marker in the badge table**

In `src/view/render/rows.ts`, rename and extend:

```ts
/**
 * Icon and badge colour per declared NON-RUNG type — the extra types and the markers,
 * keyed lowercase. The vocabulary is fixed, so this covers ALL of it: there is no
 * fallback for a declared type, because there is no declared type this file has not been
 * told about. A test renders one of each and asserts every badge got an icon and a colour
 * the stylesheet defines, which is what makes that safe to rely on rather than something
 * to remember — and is the reason a seventh name could not ship here unnoticed.
 */
const NON_RUNG_STYLE: Record<string, { icon: string; badge: string }> = {
	issue: { icon: 'circle-alert', badge: 'pbl-lvl-issue' },
	bug: { icon: 'bug', badge: 'pbl-lvl-bug' },
	milestone: { icon: 'diamond', badge: 'pbl-lvl-milestone' },
};
```

Rename the single use inside `renderBadge`:

```ts
	const style = byTypeName(NON_RUNG_STYLE, item.typeName);
```

and update the comment above it that says "Anything outside the six" → "Anything outside the declared vocabulary".

- [ ] **Step 4: Give it a colour**

In `styles.css`, beside the other badge colours:

```css
.pbl-lvl-issue { --pbl-badge-rgb: var(--color-pink-rgb); }
.pbl-lvl-bug { --pbl-badge-rgb: var(--color-red-rgb); }
/* A marker is not work, so it takes a colour no rung and no container uses. */
.pbl-lvl-milestone { --pbl-badge-rgb: var(--color-purple-rgb); }
```

- [ ] **Step 5: Make the focus picker read the vocabulary**

In `src/view/render/toolbar.ts`, replace the two loops:

```ts
		choice('', 'All types');
		// Every declared type, read off the vocabulary rather than category by category:
		// being ACCEPTABLE as a focus (`focusTarget` already reads `ALL_TYPES`) is not the
		// same as being OFFERABLE, and a name in neither hand-written list was one a saved
		// view could hold and no user could pick.
		for (const type of ALL_TYPES) choice(type, type);
```

Remove the now-unused `EXTRA_TYPES` / `LEVELS` imports **only if nothing else in the file uses them** — check first (`toolbar.ts:31` uses `ALL_TYPES`, line 282 used `LEVELS`). `npm run lint` and fallow will both report a dead import.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS across the suite.

- [ ] **Step 7: Full check and commit (covering Tasks 1–3)**

Run: `npm run check`
Expected: all five steps pass.

```bash
git add -A
git commit -m "$(cat <<'EOF'
Declare Milestone as a marker: a third category beside the ladder

The vocabulary takes MARKER_TYPES rather than a seventh entry in EXTRA_TYPES,
which means pinned rank, Task children and an Epic/Feature/PBI parent — the
opposite of a marker on all three counts, and two meanings for isExtraType at
four call sites.

The two remembered lists that would have let the name ship uncovered now read
the vocabulary: the focus picker enumerates ALL_TYPES, and the surfaces test
asks for typeFolder.<type> per declared name instead of a hand-written six.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 4: A row with no child type shows no create affordance

Extension 4a. The add button labels itself from the first of the choices; with none, that is `New undefined` opening a modal with nothing in it.

**Files:**
- Modify: `src/view/render/rows.ts` (`renderRowTrailing` ~line 261)
- Test: `test/view/rendering.test.ts`

**Interfaces:**
- Consumes: `childTypeChoices` returning `[]` for a marker (Task 2).
- Produces: no new exports. `.pbl-add` is absent on a row whose `childTypes` is empty. `buildItemMenu` needs no change — its `for (const type of childTypes)` loop already emits nothing.

- [ ] **Step 1: Write the failing test**

In `test/view/rendering.test.ts` (the fixture already has `Ship 1.0` from Task 3):

```ts
	it('withholds every create affordance on a row that can hold nothing', () => {
		// Absent, not empty. `addLabel` builds its text from `childTypes[0]`, so an empty
		// list renders "New undefined" and opens a modal with no type to pick — the same
		// answer the context-row rule gives: remove the control rather than let it fail at
		// the end.
		const row = rowByTitle(containerEl, 'Ship 1.0');
		expect(row.querySelector('.pbl-add')).toBeNull();
		expect(rowByTitle(containerEl, 'An epic').querySelector('.pbl-add')).not.toBeNull();

		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.filter((t) => t.startsWith('New '))).toEqual([]);
		expect(titles.some((t) => t.includes('undefined'))).toBe(false);
	});
```

Match the fixture's actual epic title; read the surrounding tests for `rowByTitle` and the `Menu` double.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/rendering.test.ts -t 'withholds every create affordance'`
Expected: FAIL — `.pbl-add` is rendered, `aria-label` reads `New undefined`.

- [ ] **Step 3: Guard the button**

In `src/view/render/rows.ts`:

```ts
function renderRowTrailing(ctx: RowContext, row: HTMLElement, item: BacklogItem, childTypes: string[]): void {
	renderRowColumns(ctx, row, item);

	// A row that can hold nothing gets no button, rather than one labelled from the first
	// of no choices — `New undefined`, opening a modal with no type to pick. The context
	// menu's `New <child>` disappears with it, by having nothing to loop over.
	if (childTypes.length === 0) return;

	// A native button so assistive tech can activate it, with no Tab stop — the same
	// bargain the state chip makes: the tree keeps its single-tab-stop model, and the
	// context menu carries the documented keyboard path (New <child>).
	const addBtn = row.createEl('button', {
```

(the rest unchanged)

- [ ] **Step 4: Watch the invariant fail, then confirm it passes**

Run: `npx vitest run test/view/rendering.test.ts -t 'withholds every create affordance'`
Expected: PASS.
Then **revert Step 3**, re-run, confirm RED, restore. Do not skip this.

- [ ] **Step 5: Full check and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
Withhold the create affordances on a row with no child type

A milestone holds nothing, so childTypeChoices returns an empty list — and
addLabel builds its text from the first of it. Absent rather than empty, the
answer the context-row rule already gives: remove the control instead of
opening it and apologising.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 5: The autoType cascade stops at a marker

Landmine row 1. `rankOf` recognises only extra types, so a marker nested in a moved subtree takes the positional rung and its descendants are retyped from a rank it does not have.

**Files:**
- Modify: `src/domain/writePlan.ts` (`computeTypeChanges` ~lines 169–229)
- Test: `test/domain/writePlan.test.ts`

**Interfaces:**
- Consumes: `isMarkerType` (Task 1).
- Produces: no new exports. `computeTypeChanges` returns `{ cascade: [] }` when the dragged item is a marker, and skips a marker child's whole branch.

**Design note, deliberate.** This plan does NOT introduce an `isDeclaredNonRung` predicate. The spec's second landmine — "the exemption widens to the declared non-rung types" — is satisfied by the early return below, which exempts the dragged marker *and* stops the walk, in one rule. A second predicate spelling the union would have exactly one reachable caller and would be one more place for a widening to reach the ladder by stopping a word early.

- [ ] **Step 1: Write the failing tests**

In `test/domain/writePlan.test.ts`, beside the existing cascade cases (which already prove a rung's name **is** retyped by position — keep them, they are what the widened exemption must not undo):

```ts
	it('does not retype a dragged marker, and does not touch what hangs beneath it', () => {
		// A marker occupies no rung, so there is no rank to descend from. `rankOf` would
		// hand it the POSITIONAL one and renumber its subtree from a rank it does not
		// have — the failure the existing comment describes for extra types, reached by a
		// new name. The precedent for the shape is outsideFilter: where the cascade cannot
		// say what a rung is, it stops rather than guesses.
		const model = buildTestModel([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone' }),
			note('Prep', { type: 'PBI', parent: 'Ship 1.0' }),
		]);
		const dragged = model.byPath.get('Ship 1.0.md') as BacklogItem;
		const parent = model.byPath.get('An epic.md') as BacklogItem;
		const { typeField, cascade } = computeTypeChanges(dragged, parent, autoTyped(), true);
		expect(typeField).toBeUndefined();
		expect(cascade).toEqual([]);
	});

	it('skips a marker nested inside a moved subtree, and its whole branch with it', () => {
		const model = buildTestModel([
			note('An epic', { type: 'Epic' }),
			note('Other epic', { type: 'Epic' }),
			note('A feature', { type: 'Feature', parent: 'An epic' }),
			note('A story', { type: 'PBI', parent: 'A feature' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'A feature' }),
			note('Prep', { type: 'PBI', parent: 'Ship 1.0' }),
		]);
		const dragged = model.byPath.get('A feature.md') as BacklogItem;
		const parent = model.byPath.get('Other epic.md') as BacklogItem;
		const { cascade } = computeTypeChanges(dragged, parent, autoTyped(), true);
		const touched = cascade.map((w) => w.file.path);
		expect(touched).not.toContain('Ship 1.0.md');
		expect(touched).not.toContain('Prep.md');
		// The sibling ON the ladder is still retyped — the exemption must not reach a rung.
		expect(touched).toContain('A story.md');
	});
```

`buildTestModel` / `note` / `autoTyped` are illustrative — read the file's real helpers and use them exactly. A `Milestone`-typed note must survive `hierarchyOnly`; `pruneOutsideHierarchy` reads `ALL_TYPES`, which Task 1 widened.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/writePlan.test.ts -t marker`
Expected: FAIL — `Prep` is retyped from the marker's positional rank.

- [ ] **Step 3: Stop the cascade at a marker**

In `src/domain/writePlan.ts`, add `isMarkerType` to the `./itemTypes` import, then inside `computeTypeChanges`, immediately after the existing early return:

```ts
	const cascade: ItemWrite[] = [];
	if (!parentChanged || !settings.autoType) return { cascade };

	/**
	 * Where the cascade STOPS. A marker occupies no rung, so nothing beneath one can be
	 * ranked from it, and the marker itself has no position to be retyped by — the same
	 * shape, and the same reason, as a row the Base excluded: where this walk cannot say
	 * what a rung is, it stops rather than guesses. Stopping at the dragged item covers
	 * both halves at once — the marker keeps its type, and so does anything hand-nested
	 * beneath it — which is why `rankOf` below never meets one and stays a question about
	 * extra types alone.
	 *
	 * It must NOT reach the ladder: `Epic`, `Feature`, `PBI` and `Task` are declared *as
	 * rungs*, and exempting them would undo `Assigning type on a move` wholesale.
	 */
	const stopsAt = (item: BacklogItem): boolean => item.outsideFilter || isMarkerType(item.typeName);
	if (stopsAt(dragged)) return { cascade };
```

and in `walk`, replace the `outsideFilter` guard:

```ts
		for (const child of node.children) {
			// The cascade stops at a note the Base excluded — a filter can leave one
			// *between* two results (Epic and PBI returned, the Feature between them
			// not) — and at a marker, which has no rung for the branch below to descend
			// from. We may not retype either, and retyping only the levels below one
			// would leave a worse ladder than leaving that branch as it stands.
			if (stopsAt(child)) continue;
```

- [ ] **Step 4: Watch the invariants fail, then confirm**

Run: `npx vitest run test/domain/writePlan.test.ts`
Expected: PASS, including every pre-existing cascade case.
Then revert Step 3, re-run, confirm both new tests go RED **and** that the pre-existing "a rung IS retyped by position" cases stay green. Restore.

- [ ] **Step 5: Full check and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
Stop the autoType cascade at a marker, item and branch alike

rankOf recognised only extra types, so a marker nested in a moved subtree took
the positional rung and its descendants were retyped from a rank it does not
have — the item left alone and its children silently corrupted, the failure
ADR 0014 already records for a nested Bug, reached by a new name.

One rule covers both halves: the walk stops at a marker exactly as it stops at
a row the Base excluded. It pointedly does not reach the ladder — a rung's name
is declared AS that rung and must keep being retyped by position.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 6: A marker aggregates into nothing

Landmine row 4. The rollup walk gathers from every result descendant, so a hand-nested milestone's target becomes a dateless ancestor's inferred end — a deadline reported as work. Stated **once** in `assignAll`, so it holds for every quantity that walk gathers.

**Files:**
- Modify: `src/domain/model.ts` (`assignAll`, the `const self = …` line ~541)
- Create: `test/domain/milestones.test.ts`

**Interfaces:**
- Consumes: `isMarkerType` (Task 1).
- Produces: no new exports. A marker child contributes `0` to `descendantCount`, `doneDescendants`, `descendantStart` and `descendantTarget`; its own subtree is still traversed through.

**Why a new test file:** `test/domain/model.test.ts` counts **422** of a 450 budget and `test/domain/roadmap.test.ts` counts **419**. Both are one test away from failing lint. `test/domain/milestones.test.ts` holds the domain-level marker behaviour that Tasks 6 and 7 add — split by subject, which is the expected move here.

- [ ] **Step 1: Write the failing tests**

Create `test/domain/milestones.test.ts`. Read `test/domain/model.test.ts` first and reuse its fixture builder — prefer a shared helper under `test/helpers/` if one exists over duplicating one.

```ts
/**
 * What a marker does to everything around it: nothing. Split out of `model.test.ts` and
 * `roadmap.test.ts` by subject — both were within a handful of lines of the 450-line test
 * budget, and the one suite without a cap is the one that grows.
 */
describe('a marker aggregates into nothing', () => {
	it('is never counted by an ancestor’s progress rollup', () => {
		// Never counted is a rule about AGGREGATION. A point in time contains no work, so
		// its own status must neither advance a progress figure nor keep a finished
		// subtree on screen. This is the second exception to "a rollup counts every
		// descendant the Base returned"; the first is the context row, and they sit on the
		// same line for the same reason.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('A story', { type: 'PBI', parent: 'An epic', status: 'Done' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', status: 'Open' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.doneDescendants).toBe(1);
		// The marker being open must not keep the epic's subtree on screen.
		expect(epic.subtreeDone).toBe(true);
	});

	it('is never evidence for an ancestor’s inferred span', () => {
		// A release date hand-placed under an epic must not become the end of that epic's
		// inferred bar — precisely the reading a dateless ancestor takes from a dated
		// descendant. Having a parent makes a marker neither countable nor datable.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', due: '2026-12-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantStart).toBeNull();
		expect(epic.descendantTarget).toBeNull();
	});

	it('is traversed THROUGH: results hand-nested below one still reach their ancestors', () => {
		// The marker is skipped, not its subtree — the context row's exact shape. A work
		// item somebody filed under a milestone is still this base's work.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic' }),
			note('Prep', { type: 'PBI', parent: 'Ship 1.0', due: '2026-09-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 9, day: 1 });
	});
});
```

The fixture must configure `targetKey: 'due'` — read how `model.test.ts` supplies settings for the span tests "Spans roll up the tree" added, and copy that exactly.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/milestones.test.ts`
Expected: FAIL — the epic counts 2 descendants and infers a target of 2026-12-01.

- [ ] **Step 3: Add the second exception, in one line**

In `src/domain/model.ts`, inside `assignAll`'s child loop, replace the `self` line and extend the comment above it:

```ts
			// Traverse *through* a context row to the results below it, but never count
			// it: rollups describe what the Base returned, and an excluded note's own
			// state must not skew a progress bar or keep a finished subtree on screen.
			//
			// A MARKER is the second exception, and it is stated here rather than at a
			// call site precisely so it holds for every quantity this walk gathers — the
			// counts, and the date evidence below. A marker is not work: it is neither a
			// unit of progress nor evidence of when work happens, so a release date filed
			// under an epic must not become that epic's inferred end. Its own subtree is
			// traversed exactly as a context row's is.
			const self = child.outsideFilter || isMarkerType(child.typeName) ? 0 : 1;
```

Add `isMarkerType` to the existing `./itemTypes` import at line 3.

The date branch below already reads `if (self === 1 && …)`, so it is covered by the same edit. That is the reason to put the rule in `self` rather than in either consumer.

- [ ] **Step 4: Watch each invariant fail, then confirm**

Run: `npx vitest run test/domain/milestones.test.ts`
Expected: PASS.
Revert Step 3, re-run, confirm all three go RED (the third proves the skip did not become a prune). Restore.

- [ ] **Step 5: Check the line budget**

Run: `npx eslint src/domain/model.ts test/domain/milestones.test.ts --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'`
Expected: `model.ts` still under 400 (it was 375; this edit adds no counted lines, only comments). `milestones.test.ts` well under 450.

- [ ] **Step 6: Full check and commit**

Run: `npm run check`
`npm run docs` will fail: `test/domain/milestones.test.ts` is a new file no note names. **Add it to the `files:` frontmatter of `docs/requirements/Milestones as their own type.md` now** (Task 11 does the rest of that note).

```bash
git add -A
git commit -m "$(cat <<'EOF'
A marker is never counted and never dated evidence

Stated once in assignAll, beside the context-row skip it resembles, so it holds
for every quantity that walk gathers: the progress counts, the done-subtree
state, and the date evidence spans roll up from. A release date filed under an
epic was becoming that epic's inferred end — a deadline reported as work.

The marker is skipped, not its subtree: a result hand-nested below one still
reaches its ancestors, exactly as it does through a context row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 7: A milestone is reduced to its target point in derivation

Landmine row 5, and extension 2c. `deriveBars` shelves a milestone as a reversed span when a stale start sits after the target — **before any rendering seam runs**, so a fix in `barClasses` would never be reached.

**Files:**
- Modify: `src/domain/roadmap.ts` (`deriveBars` ~line 294)
- Modify: `src/domain/CLAUDE.md` (the roadmap-context bullet)
- Test: `test/domain/milestones.test.ts` (created in Task 6)

**Interfaces:**
- Consumes: `isMarkerType` (Task 1).
- Produces: no new exports. On the dated axis a marker yields `TimelineBar { span: { start: target, target }, inferredStart: false, inferredEnd: false }`, or shelves.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/milestones.test.ts`:

```ts
describe('a milestone draws as the point it is', () => {
	it('reduces to its target date and ignores a start the note also carries', () => {
		// The type is the stronger statement. Reading the pair as a span would let a stray
		// property turn a deadline into a duration.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', start: '2026-01-01', due: '2026-12-01' })],
			{ startKey: 'start', targetKey: 'due' },
		);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.bars).toHaveLength(1);
		expect(roadmap.bars[0].span).toEqual({
			start: { year: 2026, month: 12, day: 1 },
			target: { year: 2026, month: 12, day: 1 },
		});
		expect(roadmap.bars[0].inferredStart).toBe(false);
		expect(roadmap.bars[0].inferredEnd).toBe(false);
	});

	it('draws a stale start LATER than the target as a point, not a shelved reversal', () => {
		// This is the whole reason the reduction lives in derivation. A rendering seam is
		// never reached: `reversedSpan` shelves the item before any geometry runs.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', start: '2027-01-01', due: '2026-12-01' })],
			{ startKey: 'start', targetKey: 'due' },
		);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.bars[0].span.target).toEqual({ year: 2026, month: 12, day: 1 });
	});

	it('never infers a milestone’s date from anything', () => {
		// Nothing about a deadline is inferred, swapped or written by rendering it. A
		// milestone with no target shelves as unplaced even with dated work below it.
		const roadmap = buildRoadmapFrom(
			[
				note('Ship 1.0', { type: 'Milestone' }),
				note('Prep', { type: 'PBI', parent: 'Ship 1.0', due: '2026-09-01' }),
			],
			{ targetKey: 'due' },
		);
		expect(roadmap.bars.map((b) => b.item.title)).not.toContain('Ship 1.0');
		expect(roadmap.shelf.find((s) => s.item.title === 'Ship 1.0')?.reason).toBeNull();
	});

	it('shelves an unreadable target with the reason on its card', () => {
		// A guessed date on a deadline is indistinguishable from a commitment nobody made.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', due: 'soon' })],
			{ targetKey: 'due' },
		);
		expect(roadmap.shelf[0].reason).toBe('Unreadable target date');
	});

	it('is an ordinary result on the bucket axis, and its date is never read as a horizon', () => {
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' })],
			{ horizonKey: 'horizon', horizonValues: ['Now', 'Next'], targetKey: 'due' },
			'horizons',
		);
		expect(roadmap.shelf.map((s) => s.item.title)).toEqual(['Ship 1.0']);
		expect(roadmap.buckets.every((b) => b.count === 0)).toBe(true);
	});
});
```

`buildRoadmapFrom` is illustrative — read `test/domain/roadmap.test.ts` for the real helper (it calls `buildRoadmap(model, settings, visible, axis)`) and use it exactly.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/milestones.test.ts -t milestone`
Expected: FAIL — the first case draws a 2026-01-01 → 2026-12-01 span, the second shelves as `Target date precedes the start date`.

- [ ] **Step 3: Reduce the marker in `deriveBars`**

In `src/domain/roadmap.ts`, add `import { isMarkerType } from './itemTypes';` (a new import — `roadmap.ts` does not import it today), and change `deriveBars`:

```ts
function deriveBars(rows: BacklogItem[], roadmap: RoadmapModel): void {
	for (const item of rows) {
		if (item.outsideFilter) {
			roadmap.context.push(item);
			continue;
		}
		// A MARKER is reduced to its point before any span rule is asked about it. It has
		// to happen here rather than in drawing: a stale start later than the target would
		// shelve it as a reversed span and no rendering seam is ever reached. The start is
		// ignored, never rewritten — ignoring a value and deleting it are different acts,
		// and only the first was specified.
		if (isMarkerType(item.typeName)) {
			placeMarker(item, roadmap);
			continue;
		}
		const start = item.plannedStart;
```

(the rest of the function unchanged), and add below it:

```ts
/**
 * A marker states one date, in the same key a bar's end is read from and read the same
 * tolerant civil way. Absent is unplaced and unreadable shelves with its reason, exactly
 * as a span end does — and nothing is ever inferred for it, because an inference standing
 * in for a deadline is a commitment nobody made.
 */
function placeMarker(item: BacklogItem, roadmap: RoadmapModel): void {
	const target = item.plannedTarget;
	if (target.invalid) {
		roadmap.shelf.push({ item, reason: 'Unreadable target date' });
		return;
	}
	if (target.value === null) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	// Equal ends are what `barGeometry` already reports as a milestone, so the diamond the
	// timeline draws for a stated pair is the same diamond, reached by the type.
	roadmap.bars.push({
		item,
		span: { start: target.value, target: target.value },
		inferredStart: false,
		inferredEnd: false,
	});
}
```

Add a sentence to the `deriveBars` docblock: *"A marker never reaches any of that: it is reduced to its target point first, so the ordinary span rules are never asked about a type they do not describe."*

Update the roadmap bullet in `src/domain/CLAUDE.md` in the same commit, so the layer guide does not carry a stale claim — a defect this repository has produced before.

- [ ] **Step 4: Watch each invariant fail, then confirm**

Run: `npx vitest run test/domain/milestones.test.ts`
Expected: PASS.
Revert the `if (isMarkerType(...))` block, re-run, confirm RED on the reduction and the reversal cases. Restore.

- [ ] **Step 5: Full check and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
Reduce a milestone to its target point before any span rule runs

deriveBars shelved a milestone carrying a stale start after its target as a
reversed span, so a fix in the rendering seam would never have been reached.
The type is the stronger statement: the start is ignored — never rewritten, and
never deleted — and equal ends are the diamond barGeometry already draws.

Nothing about a deadline is inferred: a milestone with no target shelves as
unplaced even with dated work beneath it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 8: A placement action answers for the type it acts on

Landmine rows 7 and 8 — "one trap wearing two coats". Stated per **type**, once, so the row's entries and every gesture still to be built inherit it rather than each re-deciding.

**Files:**
- Modify: `src/view/interactions/plan.ts` (`carriesDates` ~line 22, `scheduleFields` ~line 111, `validateSchedule` docblock ~line 138, `unschedule` ~line 183)
- Modify: `src/view/interactions/menu.ts` (the `hasDateAxis` gate at line 49, imports at lines 6 and 13)
- Test: `test/view/plan.test.ts`, `test/view/menu.test.ts`

**Interfaces:**
- Consumes: `isMarkerType` (Task 1).
- Produces, exported from `src/view/interactions/plan.ts`:
  - `placementEnds(item: BacklogItem): ('start' | 'target')[]`
  - `canSchedule(settings: BacklogSettings, item: BacklogItem): boolean`
  - `carriesDates(item)` and `unschedule(host, item)` keep their signatures and narrow internally.

- [ ] **Step 1: Write the failing tests**

In `test/view/plan.test.ts`:

```ts
	it('asks a milestone for its target alone, and never applies the span rule to it', () => {
		// Offering both ends contradicts the type twice: a milestone carrying a stale start
		// after its target draws correctly but could not be reopened and saved unchanged,
		// and a start-only write would read as scheduled while the item stayed shelved.
		const { host, item } = makeScheduleCase('Ship 1.0', { type: 'Milestone', start: 'start', target: 'due' });
		promptSchedule(host, item);
		expect(SchedulePromptModal.last?.fields.map((f) => f.field)).toEqual(['target']);
	});

	it('takes the target alone away on Unschedule, leaving a start it only promised to ignore', async () => {
		// Ignoring a value and deleting it are different acts, and only the first was
		// specified. This is the rule 2d states, reached by the other hand.
		const { host, item } = makeScheduleCase('Ship 1.0', {
			type: 'Milestone',
			start: 'start',
			target: 'due',
			values: { start: '2026-01-01', due: '2026-12-01' },
		});
		await unschedule(host, item);
		expect(host.applied).toEqual([[{ file: item.file, axis: { target: null } }]]);
	});

	it('offers a milestone no schedule entry at all on a start-only vault', () => {
		// Narrowing the fields to the target alone narrows what may offer them: an entry
		// opened onto no fields is the failure 4a and the context-row rule both answer by
		// removing the control. A gesture that can only end in nothing must not start.
		const { host, item } = makeScheduleCase('Ship 1.0', { type: 'Milestone', start: 'start', target: '' });
		expect(canSchedule(host.settings, item)).toBe(false);
		// A work item in the same vault keeps it — the rule is per type, not per vault.
		expect(canSchedule(host.settings, itemNamed(host, 'A story'))).toBe(true);
	});

	it('answers Unschedule’s offer on the target key alone for a milestone', () => {
		const { host, item } = makeScheduleCase('Ship 1.0', {
			type: 'Milestone',
			start: 'start',
			target: 'due',
			values: { start: '2026-01-01' },
		});
		// A start-only milestone carries nothing this action may take away.
		expect(carriesDates(item)).toBe(false);
	});
```

In `test/view/menu.test.ts`:

```ts
	it('withholds Schedule from a milestone on a start-only vault, and keeps it for work', () => {
		const host = makeMenuHost({ startKey: 'start', targetKey: '' });
		expect(menuTitles(host, 'Ship 1.0')).not.toContain('Schedule');
		expect(menuTitles(host, 'A story')).toContain('Schedule');
	});
```

`makeScheduleCase`, `SchedulePromptModal.last`, `host.applied`, `itemNamed`, `makeMenuHost`, `menuTitles` are illustrative — read the two test files and use their real helpers and doubles. Do not invent a harness.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/view/plan.test.ts test/view/menu.test.ts`
Expected: FAIL — both ends offered, both removed, `canSchedule` not exported.

- [ ] **Step 3: State the rule once, per type**

In `src/view/interactions/plan.ts`, add `import { isMarkerType } from '../../domain/itemTypes';`, add `BacklogSettings` to the `../../domain/settings` import, and add near the top:

```ts
/** The two ends a placement can act on, in the order the entry asks for them. */
const BOTH_ENDS = ['start', 'target'] as const;

/**
 * Which ends a placement acts on for THIS item. A milestone answers for its target alone
 * — the type is the stronger statement, and a start it merely ignores is not a date any
 * hand may write or delete.
 *
 * Stated per **type** rather than per control on purpose: the row's Schedule and
 * Unschedule are simply the paths that exist first, and the roadmap's gestures — a shelf
 * card dropped on the grid, a bar dropped back on the shelf, a bar slide, each keyboard
 * equivalent — are specified in siblings still unbuilt. A rule written per control is one
 * control out of date the moment a fourth path is added; a rule written per type is one
 * every new path inherits by asking.
 */
export function placementEnds(item: BacklogItem): ('start' | 'target')[] {
	return isMarkerType(item.typeName) ? ['target'] : [...BOTH_ENDS];
}

/**
 * Whether a placement entry has any field to ask for at all — the narrowed ends, against
 * the configured keys. Withheld rather than opened empty: a control that opens onto
 * nothing is the failure the context-row rule and the empty add button both answer by
 * removing the control, not by opening it and apologising.
 *
 * For a work item this is exactly `hasDateAxis`. For a milestone on a start-only vault
 * there is no legal batch left — the target has no key to receive a write and the start is
 * a key this type may not touch — so the entry is absent.
 */
export function canSchedule(settings: BacklogSettings, item: BacklogItem): boolean {
	return placementEnds(item).some((end) => optionalKeyFor(settings, end) !== '');
}
```

Rewrite the three consumers:

```ts
/** True when the note carries a date key this item's placement may take away. */
export function carriesDates(item: BacklogItem): boolean {
	return placementEnds(item).some((end) => item.ownKeys[end]);
}
```

```ts
function scheduleFields(host: BacklogViewHost, item: BacklogItem): { field: string; name: string; value: string }[] {
	const fields = [];
	for (const field of placementEnds(item)) {
		const key = optionalKeyFor(host.settings, field);
		if (key === '') continue;
		const reading = field === 'start' ? item.plannedStart : item.plannedTarget;
		fields.push({ field, name: key, value: reading.value ? formatCivil(reading.value) : '' });
	}
	return fields;
}
```

```ts
/** Take the item off the plan: every date key its own type answers for, in one undoable batch. */
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	const plan: SchedulePlan = {};
	for (const field of placementEnds(item)) plan[field] = null;
	return host.applySafely(computeScheduleWrites(item, plan));
}
```

`validateSchedule` needs **no** change, and that is the point. Add one paragraph to its docblock, because a reader will look for the narrowing there:

```
 * The span rule narrows by itself: `placementEnds` decides which fields exist, so a
 * milestone's values carry no `start` and the comparison below cannot fire. There is no
 * second place to keep in step, which is what "per type, not per control" buys.
```

- [ ] **Step 4: Gate the menu on the same question**

In `src/view/interactions/menu.ts`, grep for other uses of `hasDateAxis` first (there is one, at line 49); then:

```ts
import { addHorizonItems, canSchedule, carriesDates, promptSchedule, unschedule } from './plan';
```

and line 49:

```ts
		// Per axis, and absent rather than inert when one is not configured — the state
		// chip's own rule. `canSchedule` rather than `hasDateAxis`: the two agree for work
		// and diverge for a milestone on a start-only vault, where the narrowed entry
		// would open asking for nothing at all.
		if (canSchedule(host.settings, item)) addScheduleItems(host, menu, item);
```

Drop `hasDateAxis` from the line-6 import once nothing uses it; `roadmap.ts` still exports it for `configuredAxes`.

- [ ] **Step 5: Watch each invariant fail, then confirm**

Run: `npx vitest run test/view/plan.test.ts test/view/menu.test.ts`
Expected: PASS.
Revert `placementEnds` to always return both ends, re-run, confirm all five new tests go RED **and** the pre-existing work-item schedule/unschedule tests stay green. Restore.

- [ ] **Step 6: Full check and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
A placement action answers for the type it acts on, not for the control

scheduleFields offered both ends and validateSchedule applied the span rule, so
the entry could refuse a milestone the timeline draws; carriesDates gated on
either key and unschedule removed both, so Unschedule appeared on a milestone
with no milestone date and deleted a start the feature only promised to ignore.

placementEnds states it once, per type: the row's two entries are only the paths
that exist first, and the roadmap's gestures inherit the narrowing by asking. A
milestone on a start-only vault has no legal batch left, so the entry is absent
rather than opened onto nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 9: A point beyond the window is not clamped onto its edge

Landmine row 6, and extension 1a of `A milestone line across the plan`. `barGeometry` clamps both ends into the window and still reports `milestone`, so a date past the 60-month edge arrives as a one-day diamond at day 0 or the last day — a marker at a date nobody set.

**Files:**
- Modify: `src/domain/timeline.ts` (`BarGeometry` ~line 145, `barGeometry` ~line 157)
- Modify: `src/view/render/timeline.ts` (`renderBarRow` ~line 67, `barClasses` ~line 102)
- Modify: `styles.css` (after `.pbl-bar-milestone`)
- Test: `test/domain/timeline.test.ts`, `test/view/roadmapFrame.test.ts`

**Interfaces:**
- Consumes: `barGeometry` (existing).
- Produces: `BarGeometry` gains `outside: boolean`. `barClasses` returns `pbl-bar pbl-bar-outside pbl-bar-open-start|pbl-bar-open-end` for such a bar and drops `pbl-bar-milestone`. The row gains an `aria-label` of `` `${title} — ${dates}` ``.

- [ ] **Step 1: Write the failing tests**

In `test/domain/timeline.test.ts`:

```ts
	it('says a span is wholly outside the window rather than reporting a clamped one', () => {
		// The window clamps at MAX_TIMELINE_MONTHS around today, so a typo'd year lands
		// past the edge. Clamping a POINT onto that edge draws a diamond at a date the
		// milestone does not have — and a diamond is exactly the claim that this is the
		// date, where a clipped end only claims a direction.
		const today = { year: 2026, month: 8, day: 2 };
		const far = { year: 2200, month: 1, day: 1 };
		const window = timelineWindow([{ start: far, target: far }], today);
		const beyond = barGeometry(window, { start: far, target: far });
		expect(beyond.outside).toBe(true);
		expect(beyond.clippedEnd).toBe(true);
		const before = { year: 1900, month: 1, day: 1 };
		const past = barGeometry(window, { start: before, target: before });
		expect(past.outside).toBe(true);
		expect(past.clippedStart).toBe(true);
	});

	it('does not call a span outside when it merely runs past both edges', () => {
		// A bar covering the whole window is in view everywhere; only "nothing of it is
		// drawn" is outside.
		const today = { year: 2026, month: 8, day: 2 };
		const window = timelineWindow([], today);
		const wide = barGeometry(window, {
			start: { year: 1900, month: 1, day: 1 },
			target: { year: 2200, month: 1, day: 1 },
		});
		expect(wide.outside).toBe(false);
		const inside = barGeometry(window, { start: today, target: today });
		expect(inside.outside).toBe(false);
		expect(inside.milestone).toBe(true);
	});
```

In `test/view/roadmapFrame.test.ts`:

```ts
	it('draws no diamond for a milestone past the window edge, only the direction it lies past', () => {
		const containerEl = renderDatedRoadmap([
			note('Ship 1.0', { type: 'Milestone', due: '2200-01-01' }),
			note('A story', { type: 'PBI', due: '2026-09-01' }),
		]);
		const bar = barFor(containerEl, 'Ship 1.0');
		expect(bar.classList.contains('pbl-bar-milestone')).toBe(false);
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.classList.contains('pbl-bar-open-end')).toBe(true);
		// The exact date is never lost — it stays where 4a puts it.
		expect(rowFor(containerEl, 'Ship 1.0').getAttribute('aria-label')).toContain('2200-01-01');
	});

	it('puts the milestone’s name and exact date in its row’s accessible name', () => {
		const containerEl = renderDatedRoadmap([note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' })]);
		expect(rowFor(containerEl, 'Ship 1.0').getAttribute('aria-label')).toBe('Ship 1.0 — Milestone 2026-12-01');
	});
```

`renderDatedRoadmap`, `barFor`, `rowFor` are illustrative — read the file and use its real helpers.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/domain/timeline.test.ts test/view/roadmapFrame.test.ts`
Expected: FAIL — `outside` is not a property; the far milestone renders `pbl-bar-milestone` at the last day.

- [ ] **Step 3: Let the geometry answer "wholly outside"**

In `src/domain/timeline.ts`, add to `BarGeometry`:

```ts
	/** True when that end runs past the window's edge and was clamped to it. */
	clippedStart: boolean;
	clippedEnd: boolean;
	/**
	 * True when NOTHING of the span is inside the window — it lies wholly past one edge,
	 * and `startDay`/`spanDays` describe the clamp rather than the span. A clipped bar can
	 * honestly say "this continues beyond what is drawn", because part of it is still in
	 * view; a point beyond the edge cannot, and drawing it at the edge would claim a date
	 * the item does not have. Which side it lies past is `clippedStart`.
	 */
	outside: boolean;
```

and in the returned object:

```ts
		clippedStart: startDay < 0,
		clippedEnd: endDay > lastDay,
		outside: endDay < 0 || startDay > lastDay,
```

Update the interface docblock's closing sentence to mention the new answer.

- [ ] **Step 4: Draw the direction, not the date**

In `src/view/render/timeline.ts`:

```ts
function barClasses(bar: TimelineBar, geometry: BarGeometry): string {
	// Nothing of it is in view. Drawing the clamp would put a diamond at a date the item
	// does not have, and a diamond IS the claim that this is the date — so the row carries
	// only the direction it lies past, in the same open-end vocabulary a clipped bar uses.
	// The exact date is in the bar's tooltip and in the row's accessible name.
	if (geometry.outside) {
		return `pbl-bar pbl-bar-outside ${geometry.clippedStart ? 'pbl-bar-open-start' : 'pbl-bar-open-end'}`;
	}
	let cls = 'pbl-bar';
	if (geometry.milestone) cls += ' pbl-bar-milestone';
	if (bar.span.start === null || geometry.clippedStart) cls += ' pbl-bar-open-start';
	if (bar.span.target === null || geometry.clippedEnd) cls += ' pbl-bar-open-end';
	if (bar.inferredStart || bar.inferredEnd) cls += ' pbl-bar-inferred';
	return cls;
}
```

and in `renderBarRow`, beside the bar's own labels:

```ts
	const dates = spanText(bar);
	el.setAttribute('aria-label', dates);
	setTooltip(el, dates);
	// The row is the timeline's one selection stop, so it is where everything the marks
	// show has to be readable: the name and the exact dates together. Nothing about a
	// milestone may exist only under a hover, and a row past the window edge has no mark
	// stating its date at all.
	row.setAttribute('aria-label', `${bar.item.title} — ${dates}`);
	wireCardActivation(ctx, row, bar.item);
```

- [ ] **Step 5: Style the edge mark**

In `styles.css`, after `.pbl-bar-milestone`:

```css
/* Wholly past an edge: a direction, not a date. Half the bar height and no fill of its
   own, so it can never be mistaken for a span that happens to be short. */
.pbl-bar-outside {
	width: 10px;
	height: 8px;
	border-radius: 0;
	background: none;
	border-top: 2px solid var(--pbl-bar-color);
	opacity: 0.7;
}
```

- [ ] **Step 6: Watch the invariants fail, then confirm**

Run: `npx vitest run test/domain/timeline.test.ts test/view/roadmapFrame.test.ts`
Expected: PASS.
Revert the `if (geometry.outside)` branch in `barClasses`, re-run, confirm RED. Restore. Then revert `outside:` in `barGeometry` and confirm the domain test goes RED. Restore.

- [ ] **Step 7: Full check and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
Draw a point past the window edge as a direction, not as a date

barGeometry clamped both ends into the window and still reported `milestone`,
so a date beyond the 60-month edge arrived as a one-day diamond at day 0 or the
last day — a marker at a date nobody set. A clipped bar can say "this continues
beyond what is drawn"; a diamond is the claim that this IS the date.

The geometry now answers "wholly outside" and the row keeps the edge mark for
the side it lies past. The exact date moves nowhere: it is in the tooltip, and
the row's accessible name now carries the name and the dates together, which is
the timeline's one selection stop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 10: A milestone line across the plan

The second use case. The today line is exactly this shape already — a full-height mark drawn once across the grid from a single date — so this is a second instance of something that works.

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderTimeline` ~line 35, `renderMonthHeader` ~line 57)
- Modify: `styles.css` (after `.pbl-today`)
- Test: `test/view/roadmapFrame.test.ts`

**Interfaces:**
- Consumes: `isMarkerType` (Task 1), `barGeometry(...).outside` (Task 9), the marker bar shape from Task 7.
- Produces: `renderMonthHeader` returns the header's track `HTMLElement`. New module-private `renderMilestoneLines(grid, headerTrack, window, bars, today)`. New DOM: `.pbl-milestone-line` (one per distinct in-window milestone date, in the grid, `aria-hidden`) and `.pbl-milestone-label` (one per line, in the header track).

**Painting order, and why.** Lines are created **after the header and before the rows**, so the bars — positioned elements later in the DOM — paint over them ("behind the bars"). The today line stays **last** and keeps `z-index: 1`, so it paints over everything; the milestone lines take `z-index: 0`. Suppressing either is what extension 1d rules out in both directions: painted under, the milestone's line is invisible at exactly the date it exists to call out; painted over, today is.

- [ ] **Step 1: Write the failing tests**

In `test/view/roadmapFrame.test.ts`:

```ts
	it('draws one line per readable milestone inside the window, each with a row of its own', () => {
		const containerEl = renderDatedRoadmap([
			note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' }),
			note('A story', { type: 'PBI', start: '2026-09-01', due: '2026-10-01' }),
		]);
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		// Every line has a row: no milestone is visible only as a line.
		expect(rowFor(containerEl, 'Ship 1.0')).not.toBeNull();
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0']);
	});

	it('draws one line naming both when two milestones share a date', () => {
		// Two lines a pixel apart read as one and quietly misreport the count.
		const containerEl = renderDatedRoadmap([
			note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' }),
			note('Contract ends', { type: 'Milestone', due: '2026-12-01' }),
		]);
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0 · Contract ends']);
	});

	it('draws no line for a milestone outside the window, and none for a context row', () => {
		const containerEl = renderDatedRoadmap([
			note('Ship 1.0', { type: 'Milestone', due: '2200-01-01' }),
			note('Excluded', { type: 'Milestone', due: '2026-12-01', outsideFilter: true }),
		]);
		// A line across every result is derived FROM the results, and a context row is
		// never a source of one.
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
	});

	it('draws a milestone dated today beside the today line, with today keeping its pixel', () => {
		const containerEl = renderDatedRoadmap([note('Ship 1.0', { type: 'Milestone', due: TODAY_ISO })]);
		const px = (sel: string, prop: string) =>
			Number.parseFloat(containerEl.querySelector<HTMLElement>(sel)?.style.getPropertyValue(prop) ?? '');
		expect(px('.pbl-milestone-line', '--pbl-milestone-left')).toBe(px('.pbl-today', '--pbl-today-left') + 2);
		expect(containerEl.querySelectorAll('.pbl-today')).toHaveLength(1);
	});

	it('hides a line exactly when its row hides', () => {
		// The visibility rule travels with the item, not with the projection.
		const containerEl = renderDatedRoadmap(
			[note('Ship 1.0', { type: 'Milestone', due: '2026-12-01', status: 'Done' })],
			{ showCompleted: false },
		);
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
		expect(rowFor(containerEl, 'Ship 1.0')).toBeNull();
	});

	it('makes neither the line nor its label a second selection stop', () => {
		const containerEl = renderDatedRoadmap([note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' })]);
		const line = containerEl.querySelector<HTMLElement>('.pbl-milestone-line');
		expect(line?.getAttribute('aria-hidden')).toBe('true');
		expect(line?.hasAttribute('tabindex')).toBe(false);
		expect(containerEl.querySelector('.pbl-milestone-label')?.closest('[role="option"]')).toBeNull();
	});
```

`labelTexts`, `TODAY_ISO`, and the `outsideFilter` / `showCompleted` fixture options are illustrative — read the file for the real ones. `TODAY_ISO` must match whatever date the harness injects as today; find how the existing today-line test fixes it.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/view/roadmapFrame.test.ts -t milestone`
Expected: FAIL — no `.pbl-milestone-line` exists.

- [ ] **Step 3: Return the header's track and draw the lines**

In `src/view/render/timeline.ts`, add `import { isMarkerType } from '../../domain/itemTypes';`, and change:

```ts
	renderMonthHeader(grid, window);
	for (const bar of bars) renderBarRow(ctx, grid, window, bar);
```

to

```ts
	const headerTrack = renderMonthHeader(grid, window);
	// Before the rows, so the bars — positioned elements later in the DOM — paint over
	// them. A line says what falls either side of a date; a bar is the thing being asked
	// about, and must not be obscured by the question.
	renderMilestoneLines(grid, headerTrack, window, bars, today);
	for (const bar of bars) renderBarRow(ctx, grid, window, bar);
```

Change `renderMonthHeader` to return the track:

```ts
function renderMonthHeader(grid: HTMLElement, window: TimelineWindow): HTMLElement {
	const header = grid.createDiv({ cls: 'pbl-timeline-header', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-timeline-lead' });
	const track = header.createDiv({ cls: 'pbl-timeline-track' });
	for (const month of window.months) {
		const cell = track.createDiv({ cls: 'pbl-timeline-month', text: month.label });
		cell.setCssProps({ '--pbl-month-w': `${month.days * DAY_PX}px` });
	}
	return track;
}
```

Add below it:

```ts
/** How far a milestone's line steps aside for today's, inside the same day cell. */
const TODAY_NUDGE_PX = 2;

/**
 * A line down the whole plan per milestone DATE, behind the bars — a diamond says *when*,
 * a line says *what is on either side of it*, which is the question a deadline is actually
 * asked. The today line is the same shape, drawn once across the grid from a single date,
 * so this is a second instance of something that works rather than a drawing layer.
 *
 * Grouped by day, not by item: two lines a pixel apart read as one and quietly misreport
 * the count, so two milestones on a date are one line naming both. A milestone outside the
 * window draws none — `outside` says so, and a line at the edge would claim a date the
 * milestone does not have. Nothing here is focusable and nothing is written: the line is
 * decoration of a row, and every fact it shows is in that row's accessible name.
 */
function renderMilestoneLines(
	grid: HTMLElement,
	headerTrack: HTMLElement,
	window: TimelineWindow,
	bars: TimelineBar[],
	today: CivilDate,
): void {
	// Insertion order is bar order, which is row order — so a shared line names its
	// milestones the way the rows read.
	const byDay = new Map<number, string[]>();
	for (const bar of bars) {
		if (!isMarkerType(bar.item.typeName)) continue;
		const geometry = barGeometry(window, bar.span);
		if (geometry.outside) continue;
		byDay.set(geometry.startDay, [...(byDay.get(geometry.startDay) ?? []), bar.item.title]);
	}
	const todayDay = daysBetween(window.start, today);
	for (const [day, names] of byDay) {
		// Today keeps its position and its place on top: it is the one mark on this grid
		// that is the reader's own, and no plan may hide *now*. The milestone's line is
		// what gives way, drawn beside it inside the same day cell — room the grid has,
		// since a day is wider than either mark.
		const nudge = day === todayDay ? TODAY_NUDGE_PX : 0;
		const line = grid.createDiv({ cls: 'pbl-milestone-line', attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-milestone-left': `${TIMELINE_LEAD_PX + day * DAY_PX + nudge}px` });
		// The label sits in the header band, where the month header already is, and the
		// full name stays in the tooltip: horizontal space is the scarce resource in an
		// Obsidian pane, so the line survives the narrowing and the text is what gives way.
		// Same variable, different origin: the line is positioned in the grid, which
		// includes the sticky lead column, and the label inside the track, which does not.
		const label = names.join(' · ');
		const labelEl = headerTrack.createDiv({ cls: 'pbl-milestone-label', text: label });
		labelEl.setCssProps({ '--pbl-milestone-left': `${day * DAY_PX + nudge}px` });
		setTooltip(labelEl, label);
	}
}
```

- [ ] **Step 4: Style it**

In `styles.css`, after the `.pbl-today` rule:

```css
/* A milestone's line runs the grid's full height at its date, behind the bars. Same
   shape as .pbl-today and deliberately a lower layer: today stays on top because it is
   the reader's own mark, and the two sit side by side inside one day cell. */
.pbl-milestone-line {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-milestone-left);
	width: 2px;
	z-index: 0;
	background-color: var(--color-purple);
	opacity: 0.55;
}

/* In the header band, so the name reads where the months do. Backed, because it sits
   over the month labels; truncating, because horizontal space is what a pane runs out
   of first and the full name is one hover away. */
.pbl-milestone-label {
	position: absolute;
	top: 0;
	left: var(--pbl-milestone-left);
	max-width: 140px;
	padding: var(--size-4-1);
	font-size: var(--font-ui-smaller);
	color: var(--color-purple);
	background-color: var(--background-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	pointer-events: none;
}
```

- [ ] **Step 5: Watch the invariants fail, then confirm**

Run: `npx vitest run test/view/roadmapFrame.test.ts`
Expected: PASS.
Revert `if (geometry.outside) continue;` and confirm the outside case goes RED. Revert the `byDay` grouping to one line per bar and confirm the shared-date case goes RED. Revert the nudge and confirm the today case goes RED. Restore all three.

- [ ] **Step 6: Check the line budget, full check, commit**

Run: `npx eslint src/view/render/timeline.ts --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'`
Expected: well under 400 (was 92).

Run: `npm run check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
Draw each milestone as a line down the whole plan

A diamond says when; a line says what falls either side of it, which is the
question a deadline is actually asked. The today line is already that shape, so
this is a second instance rather than a drawing layer.

One line per DATE, not per item — two lines a pixel apart read as one and
misreport the count. Behind the bars, under today: today keeps its pixel and its
place on top, and the milestone's line steps aside inside the same day cell
rather than either being suppressed. Every line has a row, no line is focusable,
and nothing about one is written anywhere.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 11: The records and the register learn the seventh name

Landmine row 10, and the "records and sibling specs to settle in the same change" paragraph.

**Files:**
- Modify: `docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md`, `docs/adrs/0014-rank-extra-types-by-type-not-by-position.md`, and the ADR index (find it — `docs-check.mjs` requires every record listed there; update the title it shows for 0013)
- Modify: `docs-check.mjs` (`LEGAL_CHILDREN` ~line 22, the root rule ~line 284)
- Modify: `docs/README.md` (hierarchy table ~line 120, the `Issue`/`Bug` paragraph above it, and the numbered check list if it names the root rule)
- Modify: `test/docs/checkerAccepts.test.ts`, `test/docs/checkerRejects.test.ts`
- Modify: `docs/requirements/Milestones.md`, `docs/requirements/Milestones as their own type.md`, `docs/requirements/A milestone line across the plan.md`
- Modify: `docs/requirements/Types beside the ladder.md` (~line 198), `docs/requirements/A README in the backlog folder.md` (~line 53), `docs/requirements/A help button for the item types.md` (~lines 22, 39)
- Modify: `docs/requirements/Spans roll up the tree.md` (delete the "Not yet built" paragraph at ~line 134)
- Modify: root `CLAUDE.md`, `src/domain/CLAUDE.md`, `src/view/CLAUDE.md`

**Interfaces:** none — documentation and the register's own checker.

- [ ] **Step 1: Write the failing checker tests**

In `test/docs/checkerRejects.test.ts`, beside the existing `'Task under Epic is not a legal pair'` and `'Feature with no parent — only an Epic is a root'` cases, plant:

```ts
		// A marker holds nothing, so a child under one is exactly as wrong as a Task under
		// an Epic — and the register is the plugin's own schema, so a wrong parent here is
		// a bug in the example.
		'Task under Milestone is not a legal pair',
		'PBI with no parent — only an Epic or a Milestone is a root',
```

In `test/docs/checkerAccepts.test.ts`, add a parentless milestone to the planted tree the checker must accept:

```ts
		// A marker is a root by NATURE, where an Epic is a root by position on the ladder.
		files['docs/milestones/Ship 1.0.md'] = note('Milestone', 60, null, '# Ship 1.0\n\nThe date.\n');
```

Read both files first and match their planting helpers exactly; adapt the reject strings to the messages the code will actually produce.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/docs/`
Expected: FAIL — `unknown type "Milestone"`, and the accepts case rejected as a non-Epic root.

- [ ] **Step 3: Teach the checker the marker**

In `docs-check.mjs`:

```js
const LEGAL_CHILDREN = {
	Epic: new Set(["Feature", "Issue", "Bug"]),
	Feature: new Set(["PBI", "Issue", "Bug"]),
	PBI: new Set(["Task", "Issue", "Bug"]),
	Task: new Set(),
	Issue: new Set(["Task"]),
	Bug: new Set(["Task"]),
	// A marker holds nothing and hangs from nothing: no children, and a root of its own.
	Milestone: new Set(),
};
/**
 * The types that legitimately have no parent. An `Epic` is a root by POSITION — the top
 * of the ladder — and a `Milestone` is a root by NATURE: a release date is owned by the
 * plan, not by an epic.
 */
const ROOT_TYPES = new Set(["Epic", "Milestone"]);
```

and the root rule:

```js
	if (note.parent === null) {
		if (!ROOT_TYPES.has(note.type)) {
			fail(note.file, `${note.type} with no parent — only ${[...ROOT_TYPES].join(" or ")} is a root`);
		}
	} else if (!notes.has(note.parent)) {
```

Adjust the expected message in the reject test to whatever this actually produces.

- [ ] **Step 4: Update `docs/README.md`**

Add the row to the hierarchy table:

```markdown
| `Milestone` | *(nothing — a root by nature)* | *(nothing)* |
```

and a paragraph after the `Issue`/`Bug` one:

```markdown
`Milestone` is neither a rung nor a container: it hangs from nothing, holds nothing, and
counts for nothing. It states a date rather than work, so it never enters a rollup — a
number reporting progress must only ever count work — and it files into `milestones/`.
```

Amend numbered item 1 if it states the root rule in terms of Epics alone.

- [ ] **Step 5: Amend ADR 0013**

**Keep the filename.** `docs-check.mjs` checks the `adr:` number against the filename, and every relative link resolves by it — a rename would break links the checker also validates. Change:

- frontmatter `title: Fix the type vocabulary at seven names`, and the `# ADR 0013 — …` heading to match. Update the ADR index entry's title too.
- the decision block:

```
LEVELS       = Epic · Feature · PBI · Task
EXTRA_TYPES  = Issue · Bug
MARKER_TYPES = Milestone
```

- the Consequences line "Each of the six gets a shipped opinion" → "Each of the seven".
- add a Consequences bullet:

```markdown
- **Amended 2026-08-02 (Milestones).** The vocabulary is now **seven** names in **three**
  categories. The filename still says six; it is kept because the record is addressed by
  its number and renaming it would break every link that resolves today. Nothing this ADR
  decided changed — the vocabulary is still fixed, still not an option, still matched
  case-insensitively, and every one of the seven still gets a shipped opinion. What grew
  is the count, which is exactly the kind of staleness a record absorbs rather than is
  superseded by.
```

- [ ] **Step 6: Amend ADR 0014's definition, not its decision**

Replace the Decision's opening definition sentence:

```markdown
An **extra type** is a declared type that is not a rung **and holds the deepest level**.
Its rank is a property of the type:
```

and add to Consequences:

```markdown
- **Amended 2026-08-02 (Milestones).** "A declared type that is not a rung" is the
  **genus**, not the species. A marker is one too, and it occupies no rank at all — so the
  definition as first written classified a milestone as the very thing it is not, and
  pinned it at `EXTRA_TYPE_RANK` by that classification alone. The amendment is one
  clause: what makes an extra type an extra type is the **pinned rank whose children are
  Tasks**, and everything this record decides about `Issue` and `Bug` stands unchanged.
  The pin-at-every-node consequence above holds for markers in the opposite direction —
  the cascade **stops** at one, because there is no rank to descend from.
```

Do **not** change its status; nothing it decided was reversed.

- [ ] **Step 7: Unpin the counts in the register**

Unpin rather than renumber — a requirement that states a number goes stale in silence while one that reads the vocabulary fails out loud.

- `docs/requirements/Types beside the ladder.md` ~line 198: "six types, no options" → "a fixed vocabulary, no options".
- `docs/requirements/A README in the backlog folder.md` ~line 53: "the six type names" → "every type name in the vocabulary".
- `docs/requirements/A help button for the item types.md` ~lines 22 and 39: same treatment. Its own extension 3b already says the section is generated from `ALL_TYPES`, so a pinned count in the flow above contradicts its own criteria.

- [ ] **Step 8: Close the three milestone notes and delete the stale paragraph**

- `docs/requirements/Milestones.md`: `status: Done`, add `closed: 2026-08-02`. Retitle the landmine section "Landmines, and where each was answered" and append the answering call site to each row as a short clause — `stopsAt` in `computeTypeChanges` · `renderFocusPicker` reading `ALL_TYPES` · `canSchedule` · the `self` line in `assignAll` · `placeMarker` · `BarGeometry.outside` · `placementEnds` · `placementEnds` again · the `childTypes.length === 0` guard · `ALL_TYPES` in `surfaces.test.ts`. Keep the table — it is a checklist to re-run.
- `docs/requirements/Milestones as their own type.md`: `status: Done`, `closed: 2026-08-02`, add `test/domain/milestones.test.ts` to `files:`. Rewrite "Where it lives" from "Nothing is built yet" to what shipped, naming every source path — the checker validates each exists, and requires every module and test file to be named by at least one note. Leave extension 2f's gesture bullets: they describe unbuilt siblings and are the specification those will inherit.
- `docs/requirements/A milestone line across the plan.md`: `status: Done`, `closed: 2026-08-02`, rewrite "Where it lives".
- `docs/requirements/Spans roll up the tree.md`: delete the "**Not yet built: extension 1b's marker exclusion.**" paragraph at ~line 134 — it is now built, and a note claiming otherwise is exactly the staleness `docs-check.mjs` cannot catch.

- [ ] **Step 9: Update the layer guides**

- Root `CLAUDE.md`: the architecture table's one-liners for `domain/itemTypes.ts` ("the level ladder, and the extra types that sit beside it" → "…, the extra types beside it, and the markers that sit on no rung at all") and `domain/roadmap.ts`.
- `src/domain/CLAUDE.md`: a bullet after the extra-types one stating the marker category and its three consequences (no rung / no children / no parent; never counted, never dated evidence; the cascade stops at one).
- `src/view/CLAUDE.md`: in the roadmap section, one bullet for the milestone line and the row's accessible name, and a note that Schedule and the removal actions gate on `canSchedule`/`placementEnds` rather than `hasDateAxis`.

- [ ] **Step 10: Run the whole check**

Run: `npm run check`
Expected: all five pass, including `npm run docs`.
If it reports an unnamed module or test file, add it to the `files:` of the note that owns it. If it reports a sibling order collision among roots, the register's roots are 10/20/30/40/50 — pick unused values.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Settle the records the seventh name dates

ADR 0013 was titled for six names; the count grew and nothing it decided did, so
it is amended rather than superseded — the filename keeps its number because
every link resolves by it. ADR 0014 defined an extra type as "a declared type
that is not a rung", which a marker also is, so the definition as written
classified a milestone as the thing this feature says it is not and pinned it at
a rank it does not have. The amendment is one clause: declared-not-a-rung is the
genus, the pinned rank is the species.

docs-check.mjs held a legal-parent table of six types and a root rule naming one;
it now knows a marker holds nothing and is a root by nature, and the checker's
own tests plant that case in both directions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

### Task 12: A Feature Test epic — the smoke-test checklist

A register subtree that is a manual smoke test across every feature, and doubles as fixture data: `docs/` is a backlog in this plugin's own schema, so opening `docs/Product Backlog.base` displays it. The milestone note is what finally gives the dated axis something to draw.

**Files:**
- Create: `docs/requirements/Feature Test.md` (Epic)
- Create: `docs/requirements/Smoke test the tree.md`, `docs/requirements/Smoke test the board.md`, `docs/requirements/Smoke test the roadmap.md` (Features)
- Create: several `docs/issues/*.md` (checklist items) and, where a case has sub-steps, `docs/tasks/*.md`
- Create: `docs/milestones/Ship the roadmap epic.md` (Milestone)
- Modify: `docs/Product Backlog.base`

**Interfaces:** none — register content.

**Shape constraints, from `docs-check.mjs`. Read them before writing a single note:**
- Every note outside `adrs/` and `superpowers/` needs `type`, `order` and a `status` from `Open | Active | Done`.
- **No PBIs.** A `PBI` must carry the full use-case shape (`**As**` … `## Use case` table with all four rows … `**Main flow**` … `**Extensions**` labelled `**Na — ` naming a step the flow has … `## Acceptance criteria` … `## Where it lives`). A smoke-test checklist is not a use case. `LEGAL_CHILDREN` gives `Feature` → `PBI | Issue | Bug`, so the checklist items hang as **`Issue`** notes under each Feature (in `docs/issues/`), with any sub-steps as `Task` under those.
- Basenames are globally unique across `docs/`.
- Sibling `order` values are unique within a parent, and roots share one group — existing roots are 10, 20, 30, 40, 50, so `Feature Test` takes **60** and the milestone **70**.
- Notes in `requirements/` are LIVING: every `src/` or `test/` path they name must exist. `issues/` and `tasks/` are records of a moment and may name stale paths.
- Every wikilink must resolve.

- [ ] **Step 1: Create the Epic**

`docs/requirements/Feature Test.md`:

```markdown
---
type: Epic
order: 60
status: Open
created: 2026-08-02
source: user request
---

# Feature Test

**A smoke test this repository can actually run.** Obsidian does not run in CI and jsdom
asserts classes rather than pixels, so a whole class of defect — appearance, base
identity, what a drag feels like — is invisible to `npm run check` and visible in about
ninety seconds in a vault. This epic is the checklist for those ninety seconds, kept as
notes rather than as a document because `docs/` is a backlog in this plugin's own schema:
running the smoke test and reading the checklist are the same act.

**Outcome** — Anyone can run `npm run test-build`, open this repository as a vault, open
`docs/Product Backlog.base`, and walk one list per projection until every case has been
looked at. Closed items stay: this is a checklist to re-run, not history.

## How to run it

```bash
npm run test-build   # bundles into .obsidian/plugins/<id>/ in the repository root
```

Then open this repository as a vault and open `docs/Product Backlog.base`. The plugin is
displaying its own register, which is what makes every case below a real one rather than
a fixture somebody wrote to pass.

## Use cases

- [[Smoke test the tree]] — rows, columns, drag, keyboard, the menu.
- [[Smoke test the board]] — columns, cards, state writes.
- [[Smoke test the roadmap]] — both axes, the shelf, bars, diamonds and lines.
```

Read `docs/requirements/Product Roadmap.md` first and copy the section shape an Epic in this register actually carries — `docs-check.mjs` checks that a Feature lists its use cases, and there may be an equivalent rule for an Epic listing its Features.

- [ ] **Step 2: Create the three Features**

Each with `type: Feature`, `parent: "[[Feature Test]]"`, `order: 10 | 20 | 30`, `status: Open`, an `**Outcome** —` line, and a `## Use cases` list naming its `Issue` children by wikilink. Copy the shape from an existing Feature note.

- [ ] **Step 3: Create the checklist items**

One `Issue` per case group in `docs/issues/`, `parent` pointing at its Feature, unique `order` within it. Each is a short checklist — what to look at, and what would count as wrong. Cover at minimum:

*Tree* — badges and icons for all seven types including the new milestone diamond badge; the column header lining up with row cells; narrowing the pane to watch `pbl-hide-*` drop columns in order; a drag between siblings, into a parent, and onto the root strip; Alt+arrow move/indent/outdent; the context menu's Set type / Set state / Edit tags; the quick filter highlighting matches; "Show completed items" hiding a done subtree; undo taking a batch back.

*Board* — a column per configured state plus the no-state column; a filtered header reading "3 of 12"; a card carrying its hidden matches; dragging a card between columns; Alt+Left/Right; the card menu's Set state offering the rendered columns.

*Roadmap* — the axis picker appearing only with both axes configured; bucket drag and drop and the shelf as the target that un-places; an empty shelf appearing under a live drag; the dated axis's month header at true month lengths; a solid bar against a **dashed inferred outline in light and dark themes**, and against `.pbl-timeline-row.pbl-done .pbl-bar`'s green override; whether an unclosed dashed edge reads as *open* rather than as a rendering glitch (**still owed from the previous increment — this is the first chance to look**); a milestone's diamond and its full-height line; two milestones on one date drawing one line naming both; a milestone dated today drawn beside the today line with today still on top; the milestone label truncating in a narrow pane with the full name in the tooltip.

- [ ] **Step 4: Create the milestone**

`docs/milestones/Ship the roadmap epic.md`:

```markdown
---
type: Milestone
order: 70
status: Open
created: 2026-08-02
source: user request
due: 2026-09-30
---

# Ship the roadmap epic

The date the [[Product Roadmap]] epic is meant to be complete by. It is here to be a real
milestone in a real backlog rather than a fixture: opening `docs/Product Backlog.base` on
the dated axis draws it as a diamond on its own row and as a line down the plan, which is
the only way the appearance of either can be checked at all.

It hangs from nothing on purpose. A release date is owned by the plan, not by an epic —
and hanging it under one would be exactly the case [[Milestones as their own type]]
extension 1a exists to keep out of the rollups.
```

- [ ] **Step 5: Configure the base so the dated axis draws**

`docs/Product Backlog.base` currently configures only `homeFolder`, `stateProperty`, `stateValues`, `doneValues` and a sort. Add the roadmap's keys so the smoke test has an axis to look at:

```yaml
    targetProperty: note.due
    startProperty: note.start
    horizonProperty: note.horizon
```

Add `due:` dates to two or three existing register notes so there is a bar to compare the diamond against, and leave at least one dated parent **without** its own dates so the inferred outline renders. Keep the edit small — this is the plugin's own register, and every note it changes is real content.

- [ ] **Step 6: Run the check**

Run: `npm run check`
Expected: PASS. `npm run docs` is the one that will complain — read every failure literally; the most likely are a sibling order collision, an unresolved wikilink, and an Epic or Feature missing the section shape its type requires.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add a Feature Test epic: the smoke test this repository cannot run in CI

Obsidian does not run here and jsdom asserts classes rather than pixels, so
appearance, base identity and what a drag feels like are invisible to npm run
check and visible in about ninety seconds in a vault. The checklist is notes
rather than a document because docs/ is a backlog in this plugin's own schema —
running the smoke test and reading the checklist are the same act.

It carries the first real milestone in the register, so the diamond and its line
have something to draw, and it carries the inferred-bar appearance check still
owed from the previous increment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RNqLHNcuUeaFrHyoVE1B8P
EOF
)"
```

---

## Final gate

- [ ] `npm run check` passes on the final commit.
- [ ] `npm run test-build`, then say plainly in the PR body **what still needs a live-vault smoke test** — the milestone badge colour, the diamond, the line and its label, the today-line collision, and the inferred bar's dashed outline in both themes (owed from the previous increment). jsdom asserts classes, not pixels; do not claim any of it was verified.
- [ ] Push with `git push -u origin claude/next-product-increment-delxnx` and open a PR (ready for review, not draft), mirroring `.github/pull_request_template.md` if one exists.
- [ ] Expect Codex to review the PR automatically. Its findings on this repository have been real twice; check each one properly rather than dismissing it.

## Self-review notes

**Spec coverage.** Every row of the landmine table maps to a task: `rankOf` → 5 · `renderFocusPicker` → 3 · `addScheduleItems` → 8 · the date rollup → 6 · `deriveBars` → 7 · `barGeometry` → 9 · `scheduleFields`/`validateSchedule` → 8 · `carriesDates`/`unschedule` → 8 · `renderRowTrailing` → 4 · `surfaces.test.ts` → 3. The "records and sibling specs" paragraph → 11. Both use cases' acceptance criteria are covered by Tasks 1–4 and 6–10, except extension 2f's gestures, which belong to three unbuilt sibling specs and are stated once in `placementEnds` for those to inherit.

**Deliberate omissions, both named where they occur.** No `isDeclaredNonRung` predicate (Task 5 — one early return covers the exemption and the walk, and a second predicate would be one more place for a widening to reach the ladder). No outcome report when a write takes a card out of the base — `docs/issues/The outcome report was built from one sentence.md` says why, and nothing in this feature changes that.
