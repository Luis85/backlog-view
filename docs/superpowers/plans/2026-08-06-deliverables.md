# Deliverables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Deliverable` as a rootable extra type with its own folder, badge, and a
fourth board projection ("Deliverables") driven by its own workflow — a state property,
ordered states and done values entirely separate from the requirements board's — while
every other property (`parent`/`order`/`type`, tags, the roadmap axis) is the one the
other types already use.

**Architecture:** `Deliverable` joins the fixed `EXTRA_TYPES` vocabulary — pinned rank,
`Task` children, and (like every `EXTRA_TYPES` member, `Issue`/`Bug` included — the
toolbar's top-level creator has always offered all three unconditionally) creatable
with no parent at all. A second, parallel workflow — `deliverableStateKey`
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
- Test: `test/domain/itemTypes.test.ts`, `test/view/toolbar.test.ts`,
  `test/view/rendering.test.ts` (existing full-vocabulary test only — see the
  step-ordering note below), `test/view/creation.test.ts`,
  `test/domain/backlogReadme.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EXTRA_TYPES` includes `'Deliverable'`; `childTypeChoices(null)` includes
  every member of `EXTRA_TYPES`. Later tasks (2, 20) read the widened `EXTRA_TYPES`.

**Step-ordering note, found by review: Task 1 alone leaves `npm run check` red until
Task 2 lands, so the two are implemented and committed together.**
`test/view/rendering.test.ts`'s PRE-EXISTING `'styles every declared type — none falls
through to bare text'` test iterates the whole (now-widened) `ALL_TYPES` and requires
every member to have a badge icon, a colour class that is not `pbl-lvl-unknown`, and a
matching stylesheet rule. Widening `EXTRA_TYPES` here without Task 2's
`NAMED_TYPE_STYLE`/`badges.css` entries makes that pre-existing test fail — the exact
"a worker follows the listed steps and commits a red `npm run check`" defect this
plan's own Global Constraints forbid. Do Task 1's steps below, then Task 2's, then run
and commit both together; Task 1's own Step 4/5 below say so again at the point that
matters.

**Found by review, and it simplifies this task rather than complicating it: there is
no `ROOTABLE_EXTRA_TYPES` distinction to invent, because `Issue` and `Bug` are ALREADY
root-creatable — today, before this feature exists.** An earlier draft of this task
assumed `Issue`/`Bug` need a real parent and gave `Deliverable` alone a new
`ROOTABLE_EXTRA_TYPES` marker so `childTypeChoices(null)` would offer only it. But the
toolbar's own top-level "pick another type" menu (`renderToolbar`, confirmed by
`test/view/toolbar.test.ts`'s own description of it as "the place where any type can be
made") iterates `ALL_TYPES` UNCONDITIONALLY and calls `promptCreateItem(host, [type],
null)` for every declared name — a user can already create a parentless `Issue` or
`Bug` through it, and always could, independent of anything this feature adds. A
`childTypeChoices(null)` that named only `Deliverable` as rootable would make the
GENERATED README's hierarchy table claim `Issue`/`Bug` cannot be roots while the
toolbar it is describing lets you create one anyway — the exact "documentation
contradicts the real behavior" defect this whole plan has been catching elsewhere,
just pre-existing this time rather than introduced by Deliverable. Since this task is
already the one touching `childTypeChoices(null)`'s top-level branch, the correct fix
is to make it agree with the toolbar's real, standing behavior: spread the WHOLE
`EXTRA_TYPES` list, not a hand-picked subset. `Deliverable` needs no special
"rootable" flag distinguishing it from `Issue`/`Bug` — on this axis it never was
different from them.

- [ ] **Step 1: Update the fixture and every pre-existing assertion the widened
  vocabulary breaks, then add new tests**

**Found by review: this task's earlier draft added new tests but left several
PRE-EXISTING assertions in `test/domain/itemTypes.test.ts` unchanged, and a full run
of the file cannot pass with `EXTRA_TYPES`/`ALL_TYPES` widened until they are fixed
too.** Traced against the actual current file (not a paraphrase — line numbers below
are from the file as it stands before this task):

1. **The shared `fixture()` (lines 37-56) needs a `Deliverable` file**, or a loop added
   in the very next task-list item below throws `missing fixture item Deliverable`
   the moment `EXTRA_TYPES` includes it. Add this line right after the existing
   `Issue.md` line, parented under `Epic` the same way `Bug`/`Issue` already are:

```ts
	vault.addFile('Deliverable.md', { frontmatter: { type: 'Deliverable', order: 50 }, parentLink: 'Epic' });
```

2. **`'offers the extra types under every rung above the deepest'`** (currently lines
   97-102) — its three assertions each need `, 'Deliverable'` appended, since the
   under-a-parent branch already spreads the whole (now three-member) `EXTRA_TYPES`:

```ts
	it('offers the extra types under every rung above the deepest', () => {
		const { get } = fixture();
		expect(childTypeChoices(get('Epic'))).toEqual(['Feature', 'Issue', 'Bug', 'Deliverable']);
		expect(childTypeChoices(get('Feature'))).toEqual(['PBI', 'Issue', 'Bug', 'Deliverable']);
		expect(childTypeChoices(get('PBI'))).toEqual(['Task', 'Issue', 'Bug', 'Deliverable']);
	});
```

3. **`'still refuses to put a marker under anything'`** (currently lines 134-139) loops
   `for (const parent of [...LEVELS, ...EXTRA_TYPES]) { expect(childTypeChoices(get(parent))).not.toContain('Milestone'); }`
   — this is why fixture step 1 above is required: without a `Deliverable` fixture
   file, `get('Deliverable')` throws inside this loop the moment `EXTRA_TYPES` includes
   it. With the fixture fixed, this test needs NO other edit — it already generalizes
   over whatever `EXTRA_TYPES` holds.

4. **`'offers only the top level at the top level'`** (currently lines 120-125) —
   REPLACE its body and its now-stale `// CHANGED:` comment entirely; this is the
   assertion pinning the exact value this task changes, not a new test to add beside it.
   **This value is corrected again below, past Step 3** — the toolbar's top-level
   creator turns out to offer every declared type, not just the extras, so write it
   with the final expectation directly rather than a value this same task revises a
   few paragraphs later:

```ts
	it('offers every declared type at the top level, matching the toolbar\'s own creator', () => {
		// The toolbar's top-level "pick another type" menu has always offered every
		// ALL_TYPES entry unconditionally, with no parent — this list has to agree with
		// that standing behavior rather than invent a narrower one.
		expect(childTypeChoices(null)).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug', 'Deliverable', 'Milestone']);
	});
```

5. **Both literal `ALL_TYPES` array assertions** — `'offers the ladder then the extras
   for assignment by hand'` (currently line 144) and `'is a fixed vocabulary, matched
   case-insensitively'` (currently line 151) — each need `'Deliverable'` inserted
   between `'Bug'` and `'Milestone'`:

```ts
	expect(ALL_TYPES).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug', 'Deliverable', 'Milestone']);
```

   Apply this exact change to BOTH occurrences (the second test also has an unrelated
   `LEVELS` assertion immediately above it — leave that one as it is).

Then add the new tests, none of which have a pre-existing counterpart — inside the
`describe('childTypeChoices', ...)` block, alongside the others:

```ts
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

Add `defaultTypeFolder` to the file's existing `../../src/domain/settings` import list
(`ALL_TYPES`/`defaultSettings`/`defaultTypeFolder` — new — `EXTRA_TYPES`/`LEVELS`/
`MARKER_TYPES`/`resolveSettings`); `FakeVault`/`buildModel` are already imported.

**Found by review: widening `ALL_TYPES` breaks one more pre-existing assertion, in a
DIFFERENT file this task's earlier draft never touched — `test/view/toolbar.test.ts`.**
`renderToolbar`'s "pick another type" menu (`src/view/render/toolbar.ts:32-36`) already
loops the whole `ALL_TYPES` unconditionally, so `Deliverable` joining it adds a "New
Deliverable" entry there automatically, with no code change of this task's own needed
in `toolbar.ts` — but `'offers every type in the New picker and opens the right
prompt'` (in `test/view/toolbar.test.ts`) pins the exact seven-entry list this produces
today. Update it to eight, `Deliverable` inserted between `Bug` and `Milestone`
(`ALL_TYPES`'s own order — `EXTRA_TYPES` before `MARKER_TYPES`):

```ts
// test/view/toolbar.test.ts
	it('offers every type in the New picker and opens the right prompt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const picker = Menu.lastShown;
		expect(picker?.items.map((i) => i.titleText)).toEqual([
			'New Epic',
			'New Feature',
			'New PBI',
			'New Task',
			'New Issue',
			'New Bug',
			'New Deliverable',
			'New Milestone',
		]);

		picker?.item('New PBI')?.click();
		expect(Modal.lastOpened?.titleEl.textContent).toBe('New PBI');
	});
```

**Found by review: two more pre-existing assertions, in two more files this task's
earlier draft never touched, also break under the widened vocabulary.**

`test/view/creation.test.ts:36` opens the child-type picker under an Epic and pins its
exact option list to `['Feature', 'Issue', 'Bug']` — the same `childTypeChoices`
under-a-parent branch Step 1's item 2 above already re-asserts for `itemTypes.test.ts`,
reached here through the real modal instead. Append `'Deliverable'`:

```ts
// test/view/creation.test.ts
		expect([...(typePicker?.options ?? [])].map((o) => o.value)).toEqual(['Feature', 'Issue', 'Bug', 'Deliverable']);
```

`test/domain/backlogReadme.test.ts:594` pins the generated autoType-exception sentence,
which interpolates `EXTRA_TYPES.map(code).join(' and ')`
(`src/domain/backlogReadme.ts:119` — unchanged by this task; only the array it reads
grows). With three members that literal join produces `` `Issue` and `Bug` and
`Deliverable` `` — inelegant English, but the actual, unmodified output of existing
code this task does not touch, and pinning what the generator actually emits is this
test's whole job:

```ts
// test/domain/backlogReadme.test.ts
		expect(auto).toContain('`Issue` and `Bug` and `Deliverable` keep their type wherever they land');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL on every point above, before the Step 1 edits land — after they land
(and before Step 3's implementation), the SAME run should fail differently:
`childTypeChoices(get('Epic'))` still returns `['Feature', 'Issue', 'Bug']` (no
Deliverable, since `EXTRA_TYPES` has not been widened in `settings.ts` yet),
`childTypeChoices(null)` still returns `['Epic', 'Milestone']`, and
`defaultTypeFolder('Deliverable')` still returns `''`.

Run: `npx vitest run test/view/toolbar.test.ts -t "New picker"`
Expected: FAIL — the New picker's real menu still has only seven entries (no "New
Deliverable"), since `ALL_TYPES` has not been widened yet.

- [ ] **Step 3: Implement**

In `src/domain/settings.ts`:

```ts
export const EXTRA_TYPES = ['Issue', 'Bug', 'Deliverable'];
```

In `DEFAULT_TYPE_SUBFOLDERS`, add a line:

```ts
	deliverable: 'deliverables',
```

(keeping the existing `bug: 'bugs'` / `milestone: 'milestones'` entries as they are).

**Found by a later review round: the fix below is not "the markers plus every extra
type" — it is EVERY declared type, because the toolbar's "pick another type" menu
does not stop at extras.** Re-reading `renderToolbar` (`src/view/render/toolbar.ts:32-36`)
confirms it loops the WHOLE `ALL_TYPES` — `Feature`, `PBI` and `Task` included — calling
`promptCreateItem(host, [type], null)` for each, so a user can already create a
parentless `Feature` today, not only a parentless extra type. The same reasoning
that made `childTypeChoices(null)` spread all of `EXTRA_TYPES` rather than a
hand-picked `Deliverable`-only subset applies again, one level up: since the toolbar
draws no line anywhere in `ALL_TYPES`, this function should not either.

In `src/domain/itemTypes.ts`, `childTypeChoices`'s top-level branch:

```ts
export function childTypeChoices(parent: LadderPosition | null): string[] {
	// A marker holds nothing — no rung below it and no extra type beside it. The empty
	// list is the answer, and every affordance built from it has to be ABSENT rather than
	// empty (the add button, `New <child>`); see `renderRowTrailing`.
	if (parent !== null && isMarkerType(parent.typeName)) return [];
	// The toolbar's top-level creator has always offered every declared type
	// unconditionally, with no parent (`renderToolbar`'s "pick another type" menu
	// iterates ALL_TYPES) — this has to agree with that standing behavior rather than
	// invent a narrower "which types make sense as roots" question nothing else in
	// the view asks.
	if (!parent) return ALL_TYPES;
	const ladderChild = LEVELS[childLevelIndex(parent)];
	const onLadder = parent.levelIndex >= 0 && parent.levelIndex < LEVELS.length - 1;
	return onLadder ? [ladderChild, ...EXTRA_TYPES] : [ladderChild];
}
```

This drops `ladderChild`'s computation out of the `!parent` branch entirely (it is
only needed by the two branches below it now) and no longer touches `MARKER_TYPES` in
this function at all — `ALL_TYPES` already contains every marker. No import changes
are needed — `ALL_TYPES` is already imported in `itemTypes.ts` (it feeds
`pruneOutsideHierarchy`'s `supported` set elsewhere in this codebase, confirmed
unrelated to this function). Step 1's test for the top-level branch already carries
this exact expected value (`['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug',
'Deliverable', 'Milestone']`) — nothing more to update there.

The under-a-parent branch (`return onLadder ? [ladderChild, ...EXTRA_TYPES] : [ladderChild];`)
needs no change — it already spreads the whole `EXTRA_TYPES` list, so `Deliverable`
joining that list is already offered there for free.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: PASS

Run: `npx vitest run test/view/toolbar.test.ts`
Expected: PASS (the whole file — the New-picker fix must not regress any of the
file's other, unrelated tests)

Run: `npx vitest run test/view/creation.test.ts test/domain/backlogReadme.test.ts`
Expected: PASS

Run: `npx vitest run test/view/rendering.test.ts -t "styles every declared type"`
Expected: FAIL at this point — `Deliverable` has no `NAMED_TYPE_STYLE` entry yet, so its
badge falls through to `pbl-lvl-unknown`. This is expected and is exactly why Step 5
does not commit yet: proceed to Task 2, then return here and re-run this same command,
which must PASS before either task is committed.

- [ ] **Step 5: Commit together with Task 2 (see Task 2 Step 5)**

Do not commit here — Task 2's Step 5 is the single commit for both tasks, since Task 1
alone leaves the pre-existing full-vocabulary rendering test red.

---

### Task 2: Deliverable's own badge and colour

**Files:**
- Modify: `src/view/render/rows.ts`
- Modify: `styles/badges.css`
- Test: `test/view/rendering.test.ts`

**Interfaces:**
- Consumes: `NAMED_TYPE_STYLE` (existing table in `badges.ts`).
- Produces: a `deliverable` badge/colour, matching the same "every declared type has an
  entry or the table's own coverage test fails" contract `Issue`/`Bug`/`Milestone` use.

**Implement this task immediately after Task 1's Steps 1-4, before either task's
commit** — see Task 1's step-ordering note: `npm run check` cannot pass on Task 1's
own commit alone.

- [ ] **Step 1: Write the failing test**

```ts
// test/view/rendering.test.ts — new test, using the existing view harness
it('renders a Deliverable with its own badge icon and colour', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
	const { containerEl } = makeView(vault);

	const badge = rowByTitle(containerEl, 'D').querySelector('.pbl-badge');
	expect(badge?.classList.contains('pbl-lvl-deliverable')).toBe(true);
	expect(badge?.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('package');
});
```

Check the file's existing imports for `FakeVault`, `makeView`, `rowByTitle` — all three
already appear in `test/helpers/view.ts`/`test/helpers/vault.ts` and are used elsewhere
in this file per the harness conventions in `test/CLAUDE.md`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/rendering.test.ts -t "Deliverable with its own badge"`
Expected: FAIL — `pbl-lvl-deliverable` class absent; the badge falls through to
`pbl-lvl-unknown` (no `NAMED_TYPE_STYLE` entry for `deliverable`).

- [ ] **Step 3: Implement**

In `src/view/render/rows.ts`, extend the table:

```ts
const NAMED_TYPE_STYLE: Record<string, { icon: string; badge: string }> = {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/rendering.test.ts`
Expected: PASS — the whole file, including both this task's new test AND Task 1's
pre-existing `'styles every declared type — none falls through to bare text'` test,
which only turns green once this task's `NAMED_TYPE_STYLE`/`badges.css` entries land.

- [ ] **Step 5: Commit (Tasks 1 and 2 together)**

```bash
git add src/domain/settings.ts src/domain/itemTypes.ts src/view/render/rows.ts styles/badges.css \
  test/domain/itemTypes.test.ts test/view/toolbar.test.ts test/view/rendering.test.ts \
  test/view/creation.test.ts test/domain/backlogReadme.test.ts
git commit -m "feat: Deliverable joins the type vocabulary, with its own badge and colour"
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
  `deliverableDoneValues: string[]`. Consumed by Task 4 (viewOptions.ts), Task 5
  (vocabulary.ts), Task 6 (model.ts), Task 7 (writePlan.ts), Task 8 (frontmatter.ts).

- [ ] **Step 1: Write the failing tests, and update every pre-existing exact-count
  assertion this table's new member breaks**

**Found by review: widening `OPTIONAL_FIELDS`/`OPTIONAL_PROPERTIES` from six members
to seven breaks three pre-existing, exact-array assertions in
`test/domain/settings.test.ts` that this task's earlier draft left untouched — the
promised full run of the file cannot pass without them.** Traced against the real
file:

1. **`describe('optionalKeyFor', ...)`'s `'maps each field to the property it is
   stored under'`** — its settings fixture needs `deliverableStateKey: 'deliverableStatus'`
   added, and BOTH of its `toEqual([...])` arrays need a 7th entry:

```ts
	it('maps each field to the property it is stored under', () => {
		const settings = {
			...defaultSettings(),
			stateKey: 'status',
			startedDateKey: 'started',
			finishedDateKey: 'finished',
			horizonKey: 'horizon',
			startKey: 'start',
			targetKey: 'due',
			deliverableStateKey: 'deliverableStatus',
		};
		expect(OPTIONAL_FIELDS.map((field) => optionalKeyFor(settings, field))).toEqual([
			'status',
			'started',
			'finished',
			'horizon',
			'start',
			'due',
			'deliverableStatus',
		]);
		expect(OPTIONAL_FIELDS.map((field) => optionalKeyFor(defaultSettings(), field))).toEqual([
			'',
			'',
			'',
			'',
			'',
			'',
			'',
		]);
	});
```

2. **`describe('the optional-property table', ...)`'s `'reads its fields in
   declaration order, ...'`** — its declaration-order array needs `'deliverableState'`
   appended (matching `PROPERTY_TABLE`'s declaration order, `deliverableState` last):

```ts
	it('reads its fields in declaration order, which is the order everything states them in', () => {
		expect(OPTIONAL_PROPERTIES.map((property) => property.field)).toEqual([
			'state',
			'startedDate',
			'finishedDate',
			'horizon',
			'start',
			'target',
			'deliverableState',
		]);
		expect(OPTIONAL_FIELDS.map(optionalProperty)).toEqual(OPTIONAL_PROPERTIES);
	});
```

3. **`describe('adoptableProperties', ...)`'s `'offers the shipped key for every
   optional property nobody has named'`** — needs `'deliverableStatus'` appended:

```ts
	it('offers the shipped key for every optional property nobody has named', () => {
		const config = fakeConfig({});
		expect(adoptableProperties(config, resolveSettings(config)).map((p) => p.suggested)).toEqual([
			'status',
			'started',
			'finished',
			'horizon',
			'start',
			'due',
			'deliverableStatus',
		]);
	});
```

Then add the new tests, following the file's existing
`defaultSettings()`/`resolveSettings(fakeConfig({...}))` pattern:

```ts
// test/domain/settings.test.ts — new tests
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

Run: `npx vitest run test/domain/settings.test.ts` (the whole file, not just the new
tests)
Expected: FAIL on the three pre-existing tests updated in Step 1 too — each still
expects a six-entry array (`OPTIONAL_FIELDS`/`OPTIONAL_PROPERTIES` are still six
members long until Step 3 lands), so the seven-entry expected arrays this step just
wrote fail against them, with a length mismatch.

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
- Test: `test/domain/deliverableModel.test.ts` (new file — see below)

**Interfaces:**
- Consumes: `firstSeen` (existing private helper), `BacklogSettings.deliverableDoneValues`
  (Task 3).
- Produces: `collectObservedDeliverableStates(all, settings): string[]`, exported.
  Consumed by Task 6 (`model.ts`'s `buildModel`).

Found by review (Codex, PR #77): a naive copy of `collectObservedStates` would read
`deliverableStateValue` off ANY item, including a PBI or a Bug that happens to carry the
Deliverable-state key — minting a stray column no card could ever land in. This collector
filters to `Deliverable`-typed items first.

**Found by a later review round: this task's tests do not go into `test/domain/model.test.ts`.**
That file is already 422 nonblank, noncomment lines against the `test/**` 450-line
budget (`eslint.config.mjs`); this task's two tests plus Task 6's four would land it
around 498 — well over. Rather than growing the file this plan's own root guide warns
against ("split by subject before a file becomes the place tests hide"), both tasks'
Deliverable-workflow model coverage goes into a new file, `test/domain/deliverableModel.test.ts`,
which this task creates and Task 6 adds to. It imports the same helpers
(`FakeVault`, `buildModel`, `defaultSettings`) `model.test.ts` already does.

- [ ] **Step 1: Write the failing test**

```ts
// test/domain/deliverableModel.test.ts — new file (see the note above on why this
// is not test/domain/model.test.ts)
import { describe, expect, it } from 'vitest';
import { collectObservedDeliverableStates } from '../../src/domain/vocabulary';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

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

Run: `npx vitest run test/domain/deliverableModel.test.ts`
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
until Task 6. That is expected; Task 6 lands next and the two land together before
either is runnable end to end. (If your TDD loop needs a green step here first, stub
`deliverableStateValue: null` onto the RawItem type in Task 6's own step instead of
splitting — see Task 6's note.)

- [ ] **Step 4: Run tests to verify they pass**

This step's tests will only go green once Task 6 lands `deliverableStateValue` on
`BacklogItem`. Proceed directly to Task 6; return here to confirm PASS once it is done.

Run (after Task 6): `npx vitest run test/domain/deliverableModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Commit together with Task 6 (see Task 6 Step 5) — the two do not compile independently.

---

### Task 6: `BacklogItem.deliverableStateValue` / `deliverableDone`, in the raw-item phase

**Files:**
- Modify: `src/domain/model.ts`
- Test: `test/domain/deliverableModel.test.ts` (created by Task 5 — see its note on
  why this is not `test/domain/model.test.ts`)

**Interfaces:**
- Consumes: `BacklogSettings.deliverableStateKey`/`deliverableDoneValues` (Task 3),
  `collectObservedDeliverableStates` (Task 5).
- Produces: `BacklogItem.deliverableStateValue: string | null`,
  `BacklogItem.deliverableDone: boolean`, `BacklogModel.observedDeliverableStates: string[]`.
  Consumed by Task 9 (`board.ts`'s `deliverablesWorkflow` — found by review, this task
  reference was Task 8, which never touches `board.ts`), Task 16 (`render/board.ts`'s
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
// test/domain/deliverableModel.test.ts — appended after Task 5's describe block, in
// the same file (no new imports needed — describe/expect/it/buildModel/defaultSettings/
// FakeVault are already imported there)
describe('BacklogItem.deliverableStateValue / deliverableDone', () => {
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

it('marks deliverableDone true for a Deliverable done in ITS OWN workflow, requirements state untouched', () => {
	// Found by review: every other test in this describe block only ever asserts
	// deliverableDone === false, so an implementation that hardcoded false (or never
	// wired deliverableDoneValues into addItem at all) would still pass the suite.
	// This is the one case that actually exercises the true branch.
	const settings = {
		...defaultSettings(),
		stateKey: 'status',
		deliverableStateKey: 'deliverableStatus',
		deliverableDoneValues: ['Published'],
	};
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Open', deliverableStatus: 'Published' },
	});
	const model = buildModel(vault.app, vault.entries(), settings);
	const d = model.items.find((i) => i.title === 'D');
	if (!d) throw new Error('missing D');

	expect(d.deliverableDone).toBe(true);
	// Done in ITS OWN workflow, not the requirements one — 'Open' names no requirements
	// done value, so item.done must stay false.
	expect(d.stateValue).toBe('Open');
	expect(d.done).toBe(false);
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/deliverableModel.test.ts -t "Deliverable"`
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

Run: `npx vitest run test/domain/deliverableModel.test.ts`
Expected: PASS — the whole file, including both this task's tests AND Task 5's
`collectObservedDeliverableStates` describe block above them.

- [ ] **Step 5: Commit**

```bash
git add src/domain/model.ts src/domain/vocabulary.ts test/domain/deliverableModel.test.ts
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
  `computeDeliverableStateWrites(item, state): ItemWrite[]`, and a Deliverable-scoped
  `missingKeyStubs` (this task's second fix, below). Consumed by Task 8
  (`storage/frontmatter.ts`), Task 12 (`cardMoves.ts`).

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

**Found by review, a second gap in this same file: `computeInitWrites`' backfill must
scope the Deliverable-state stub to Deliverable-typed items only.** Joining
`OPTIONAL_FIELDS` (Task 3) puts `'deliverableState'` in the generic list
`missingKeyStubs` iterates for EVERY item, with no type filter — so pressing "Assign
missing properties" with `deliverableStateKey` configured would stamp an empty
`deliverableStatus: ''` onto every PBI, Task, Epic, Issue and Bug in the backlog that
lacks the key, not just Deliverables. `missingKeyStubs` already has exactly this shape
of exception for `horizon` (skipped when the axis is unconfigured); this is the same
kind of per-field narrowing, keyed on the ITEM's type instead of on a global
configuration flag:

```ts
// test/domain/writePlan.test.ts — new test, beside any existing computeInitWrites
// coverage in this file
describe('computeInitWrites — the Deliverable state stub', () => {
	it('backfills the Deliverable state key only on Deliverable-typed items', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10 } });
		const configured = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const model = buildModel(vault.app, vault.entries(), configured);

		const writes = computeInitWrites(model, configured);

		const forD = writes.find((w) => w.file.path === 'D.md');
		const forP = writes.find((w) => w.file.path === 'P.md');
		expect(forD?.stubs).toContain('deliverableState');
		expect(forP?.stubs ?? []).not.toContain('deliverableState');
	});
});
```

Add `computeInitWrites` to this file's existing `../../src/domain/writePlan` import
line if it is not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/writePlan.test.ts -t "computeDeliverableStateWrites"`
Expected: FAIL — `computeDeliverableStateWrites` does not exist.

Run: `npx vitest run test/domain/writePlan.test.ts -t "Deliverable state stub"`
Expected: FAIL — `computeInitWrites` stamps `'deliverableState'` onto `P.md` too, since
`missingKeyStubs` has no type-scoping for it yet.

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

Scope the backfill stub in `missingKeyStubs`, right beside the existing `horizon`
exception:

```ts
function missingKeyStubs(item: BacklogItem, settings: BacklogSettings): OptionalField[] {
	const stubs: OptionalField[] = [];
	for (const field of OPTIONAL_FIELDS) {
		// A named horizon property with no values is an UNCONFIGURED bucket axis — see
		// the existing comment on this branch, unchanged.
		if (field === 'horizon' && !hasHorizonAxis(settings)) continue;
		// The Deliverable workflow's own state describes a Deliverable, never a PBI, a
		// Task or any other type sharing the same backfill pass — the property-table row
		// this key gets in the generated README (Task 20) says "on a Deliverable", and
		// this is what keeps that literally true rather than aspirational.
		if (field === 'deliverableState' && item.typeName?.toLowerCase() !== 'deliverable') continue;
		if (optionalKeyFor(settings, field) === '' || item.ownKeys[field]) continue;
		stubs.push(field);
	}
	return stubs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/writePlan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/writePlan.ts test/domain/writePlan.test.ts
git commit -m "feat: plan writes for the Deliverable workflow's state, scoped to Deliverables"
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

**Found by review: `src/storage/frontmatter.ts` is 391 nonblank, noncomment lines
against the `src/` 400-line budget (`eslint.config.mjs`).** A first draft of this step
added the same shape spread across more lines than it needed — 11 net new lines,
enough on its own to fail `npm run lint`. Both additions below are written as tightly
as the existing `state`/`removeStateKey` pair beside them, saving six lines with no
behavior change: 5 lines added here rather than 11.

In `src/storage/frontmatter.ts`'s `applyInto`, right after the existing state
apply/remove pair:

```ts
	// The stateKey may be unset (progress tracking off) — never write to an empty key.
	if (write.removeStateKey && settings.stateKey) delete fm[settings.stateKey];
	else if (write.state !== undefined && settings.stateKey) setOwn(fm, settings.stateKey, write.state);
	const deliverableStateKey = optionalKeyFor(settings, 'deliverableState');
	if (write.removeDeliverableStateKey && deliverableStateKey) delete fm[deliverableStateKey];
	else if (write.deliverableState !== undefined && deliverableStateKey) setOwn(fm, deliverableStateKey, write.deliverableState);
```

In `touchedKeys`, right after the existing state line:

```ts
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	const deliverableStateKeyTouched = optionalKeyFor(settings, 'deliverableState');
	if ((write.removeDeliverableStateKey || write.deliverableState !== undefined) && deliverableStateKeyTouched) keys.push(deliverableStateKeyTouched);
```

(Named `deliverableStateKeyTouched` rather than reusing `deliverableStateKey` only
because the two live in different functions — `applyInto` and `touchedKeys` — not
because they mean anything different.)

`optionalKeyFor` is already imported from `../domain/settings` at the top of this file.
No change is needed to `captureInverse`, `applyRestores` or `restoreInto` — they already
work generically off `touchedKeys`' list and `rawValueOf`/`setOwn`, exactly as they do
for `state`/`removeStateKey`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/storage/frontmatter.test.ts`
Expected: PASS

Run: `npx eslint src/storage/frontmatter.ts`
Expected: PASS — confirms the file stays under the 400-line budget after this task's
additions (391 lines before this task, +5 net from the compacted blocks above).

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
- Modify: `src/view/host.ts` (the `Projection` type alone — see below)
- Test: `test/storage/collapseStore.test.ts`

**Interfaces:**
- Consumes: `BOARD_MODE`/`ROADMAP_MODE` (existing), `readEnum` (existing).
- Produces: `Projection = 'tree' | 'board' | 'roadmap' | 'deliverables'`; `DELIVERABLES_MODE`
  constant; both round-trip through `CollapseState.projection()`/`setProjection()`.

**Found by review: `CollapseState.projection()`/`setProjection()` cannot type-check
against the OLD `Projection` union.** An earlier draft of this task typed
`projection(): Projection` returning `'deliverables'` and `setProjection(mode:
Projection)` accepting it, while leaving `Projection` itself unwidened until Task 11 —
`npx tsc --noEmit` fails on this task's own commit, and the storage-only Vitest run in
Step 4 below does not catch that, since it never type-checks `collapseState.ts` against
the interface. The `Projection` widening is a one-line type declaration with no
implementation behind it (`BacklogViewHost`'s two new methods are still Task 11's own
job), so it moves here, to the task that actually needs it to compile — Task 11 below
now consumes it rather than producing it.

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

In `src/view/host.ts`, widen the `Projection` type alone (the two new
`BacklogViewHost` interface members are Task 11's own job, not this task's):

```ts
export type Projection = 'tree' | 'board' | 'roadmap' | 'deliverables';
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

- [ ] **Step 4: Run tests to verify they pass, and confirm the type-check**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS — `Projection` now includes `'deliverables'` in the same commit as the
code that returns/accepts it, so nothing here is left type-broken for Task 11 to fix.
`BacklogViewHost` gains no new interface members in this task, so no implementer is
left incomplete either — that compile failure is Task 11's own, deliberately.

- [ ] **Step 5: Commit**

```bash
git add src/storage/collapseStore.ts src/view/collapseState.ts src/view/host.ts test/storage/collapseStore.test.ts
git commit -m "feat: persist the Deliverables projection in the collapse store"
```

---

### Task 11: Declare the write path and the filter-only predicate on `BacklogViewHost`

**Files:**
- Modify: `src/view/host.ts`
- Test: none (interface-only; exercised by later tasks' tests)

**Interfaces:**
- Consumes: `Projection` (widened by Task 10, already includes `'deliverables'`),
  `computeDeliverableStateWrites`/`ItemWrite` (Task 7).
- Produces: `BacklogViewHost.performDeliverablesBoardMove(item, state): Promise<boolean>`;
  `BacklogViewHost.isRowHiddenByFilterOnly(item): boolean`. Consumed by every
  remaining task.

This is a pure interface change with no runtime behavior of its own — TypeScript will
fail every implementer (`ProductBacklogView`) to compile until Task 13 implements both
new methods. **Found by review: that expected compile failure must not be committed on
its own, here or after Task 12.** Neither this task's own commit nor Task 12's leaves
`npm run check` passing — the whole point of the two new interface members is that
nothing implements them until Task 13 — so both defer to Task 13's single combined
commit rather than landing a broken `npx tsc --noEmit` twice first. This task carries
no test of its own for the same reason Task 12 doesn't: the compile failure IS the
check, and Task 13's Step 4 is where it is confirmed resolved.

- [ ] **Step 1: Declare the write-path method**

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

- [ ] **Step 2: Declare the filter-only visibility predicate**

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

- [ ] **Step 3: Confirm the expected compile failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `ProductBacklogView` (in `src/view/backlogView.ts`) does not implement
`performDeliverablesBoardMove` or `isRowHiddenByFilterOnly` yet. This is the expected
state until Task 13.

- [ ] **Step 4: Do not commit yet — proceed to Task 12, then Task 13**

Task 13's Step 5 is the single combined commit for `src/view/host.ts` (this task),
`src/view/cardMoves.ts` (Task 12) and `src/view/backlogView.ts` (Task 13) — the three
land together, since `npm run check` cannot pass on any one of them alone until Task 13
implements the interface Tasks 11 and 12 only declare and extend.

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
delegates to it and a caller (Task 16's drag wiring, Task 18's keyboard, Task 19's menu)
actually invokes it. Task 16's view-level tests are what exercises this method end to
end, the same way `test/view/boardMoves.test.ts` is what exercises `performBoardMove`
rather than a unit test of `CardMoveController` alone.

- [ ] **Step 2: Do not commit yet — proceed to Task 13**

Same reason as Task 11's own deferred commit: `ProductBacklogView` still does not
implement `BacklogViewHost`'s two new members, so `npx tsc --noEmit` stays red through
this task. Task 13's Step 5 commits `host.ts`, `cardMoves.ts` and `backlogView.ts`
together once that implementation lands.

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

- [ ] **Step 5: Commit (Tasks 11, 12 and 13 together)**

```bash
git add src/view/host.ts src/view/cardMoves.ts src/view/backlogView.ts
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

it('names the current focus, not the whole base, when a Deliverable exists outside it', () => {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
	// A top-level Deliverable, outside any Feature subtree — `collectFocusRoots` never
	// reaches it once focus narrows to "Feature", so `model.results` excludes it even
	// though it exists in the base.
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' }, { focus: 'Feature' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
	const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
	expect(title).toContain('focus');
	expect(hint).toContain('All types');
	// Must not suggest creating one "here" as an alternative to clearing focus — a
	// Deliverable created from the toolbar while focused on Feature is parentless and
	// would not appear on this board either, so that phrasing would be a dead end.
	expect(hint).not.toMatch(/create one here/i);
});

it('offers "create one" under PBI focus, since a parentless Deliverable shows there', () => {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	// No PBI and no Deliverable exist yet — `collectFocusRoots`' `extraFocused` rule
	// admits every extra type at the PBI rung regardless of subtree, so a Deliverable
	// created from the toolbar while focused on PBI would appear here immediately,
	// unlike the Feature-focus case above.
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' }, { focus: 'PBI' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
	expect(hint).toMatch(/create one/i);
	expect(hint).not.toMatch(/would not appear/i);
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
 * A configured Deliverable workflow with no Deliverable-typed results in the currently
 * shown population — distinct from "everything is done and hidden", which this board
 * has no concept of (Scope): a base full of other work is never reported as complete.
 *
 * **Found by review: `model.results` is narrowed to the focused subtree while a focus
 * is active (Task 16's own note on `renderDeliverablesBoard`), so an unqualified
 * "no deliverables yet" is false the moment a Deliverable exists elsewhere in the base
 * but not under the current focus.** This reuses the same `model.focused` distinction
 * `renderEmptyState`/`emptyHint` (this file, existing) already draw for the identical
 * problem on the tree — word the guidance in terms of the current focus and name the
 * way back, rather than inventing a second "does the WHOLE base have one" query no
 * other empty state here makes either.
 *
 * **A second gap, found by a later review round: the focused guidance must not offer
 * "create one here" as an alternative to clearing focus — except where it truthfully
 * can.** The toolbar's New button creates a Deliverable with no parent
 * (`promptCreateItem(host, ['Deliverable'], null)`); a focus on a LEVEL like
 * `Feature` only admits a new root when the root's own type matches that level
 * (`collectFocusRoots`' `matches`), and a Deliverable never does — UNLESS the focus
 * is `PBI` itself (`extraFocused`, `EXTRA_TYPE_RANK`) or the focus is `Deliverable`
 * BY NAME (`focusExtra` matches `typeName` alone, regardless of subtree position).
 * Both are focuses this same focus picker offers (`ALL_TYPES`-driven, Task 1). So
 * creating from here while focused on `Feature` files a note this very board still
 * would not show — a suggestion that looks like a fix and silently is not one — but
 * creating while focused on `PBI` or `Deliverable` shows it immediately, and telling
 * the user to clear focus first in THAT case is the same kind of wrong claim in the
 * other direction. `admitsNewDeliverable` below names the two focuses that differ.
 *
 * **Found by a later review round still: this check must ask by focus TYPE, not by
 * whether the toolbar's own vocabulary loop needed editing.** `host.settings.focusLevel`
 * is read directly (`itemTypes.ts`'s own `settings.focusLevel.trim().toLowerCase()`
 * pattern) rather than through `model.focused`, which only says THAT a focus is
 * active, never which one.
 */
export function renderNoDeliverablesState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const focused = host.model?.focused ?? false;
	const focusLevel = host.settings.focusLevel.trim().toLowerCase();
	const admitsNewDeliverable = focusLevel === 'pbi' || focusLevel === 'deliverable';
	guidanceShell(
		treeEl,
		'package',
		focused ? 'No deliverables in this focus' : 'No deliverables yet',
		focused
			? admitsNewDeliverable
				? 'Nothing typed "Deliverable" is in the current focus. Create one from the ' +
					'toolbar\'s New menu — it will appear here — or switch the focus button back ' +
					'to "All types" to see Deliverables elsewhere in the base.'
				: 'Nothing typed "Deliverable" is in the current focus. Switch the focus button ' +
					'in the toolbar back to "All types" to see Deliverables elsewhere in the base — ' +
					'or to create a new one, since one made from here would not appear on this ' +
					'board until you do.'
			: 'Nothing in this base is typed "Deliverable". Create one from the toolbar\'s New ' +
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

- [ ] **Step 5: Do not commit yet — proceed to Tasks 15 and 16**

**Found by review: deferring only to Task 15 is not far enough.** Task 15's own
`renderDeliverablesBoardContent` imports and calls `renderDeliverablesBoard`, which
Task 16 is what actually defines in `board.ts` — so a commit landing Task 14 and 15
alone (`emptyStates.ts` + `projections.ts`) still fails `npx tsc --noEmit` on a missing
export, exactly the "expected compile failure committed anyway" defect the Task
11-13 fix above corrects. Task 16's Step 5 is the single combined commit for all three
tasks' files.

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
with the parametrized signature Task 16 introduces. Implement Tasks 14, 15 and 16
together (this task's Step 3 references Task 16's `BoardRenderOptions`); their tests
are written and run together at the end of Task 16, and Task 16's Step 5 is the single
commit for all three — **found by review: this task's own Step 5 below must not commit
on its own either**, since `projections.ts` imports `renderDeliverablesBoard` from
`board.ts`, which does not exist as an export until Task 16 implements it, and a
commit here alone fails `npx tsc --noEmit` on that missing export.

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

- [ ] **Step 5: Do not commit yet — proceed to Task 16**

Task 16's Step 5 is the single combined commit for `src/view/render/emptyStates.ts`
(Task 14), `src/view/render/projections.ts` (this task) and `src/view/render/board.ts`
(Task 16), landing together once `renderDeliverablesBoard` actually exists.

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

it('renders a card done in ITS OWN workflow as done, even when the requirements state is not', () => {
	// Found by review: the negative test above alone cannot rule out an
	// implementation that never wires deliverableDone into createCard at all, or
	// hardcodes false — this is the case that requires the positive branch to work.
	const vault = boardVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'Open', deliverableStatus: 'Published' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableDoneValues: 'Published',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	expect(cardByTitle(containerEl, 'D').classList.contains('pbl-done')).toBe(true);
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

A third, in `test/view/boardMoves.test.ts`: this task is where `renderColumn`'s drop
wiring starts calling a `move` that can be `performDeliverablesBoardMove`, so the
wrong-property regression the PBI's acceptance criteria require of the drag input
belongs here, beside the requirements board's own `dragging a card to a new state`
suite — not deferred to a later task that never touches this file:

```ts
// test/view/boardMoves.test.ts
it('dropping a card on the Deliverables board writes deliverableStatus alone', async () => {
	const vault = boardVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'New', deliverableStatus: 'Draft' },
	});
	const harness = makeView(vault, {
		stateProperty: 'note.status',
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	cardDrag(cardByTitle(containerEl, 'D'), columnByName(containerEl, 'Review'));
	await flush();

	expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
	// The requirements property is a separate key: this move must not touch it.
	expect(vault.fm('D.md')['status']).toBe('New');
});
```

(The rest of `test/view/boardMoves.test.ts`'s Deliverables coverage — own-column no-op,
undo, config-problems gate — is the requirements suite's shape repeated over the new
projection, not a new rule; add it here too if a future review finds one of those paths
untested rather than opening a new task for it.)

A fourth, back in `test/view/board.test.ts`, pinning the parametrized stray-column hint —
the same file's existing "styles the done column as finished, and appends observed
strays after the workflow" test covers the requirements board's stray column but never
reads its tooltip text, so nothing already catches this text reverting to a hardcoded
string:

```ts
// test/view/board.test.ts
it('names the DELIVERABLE workflow-states option in a stray column’s hint, not the requirements one', () => {
	const vault = boardVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Blocked' },
	});
	const harness = makeView(vault, {
		deliverableStateProperty: 'note.deliverableStatus',
		deliverableStateValues: 'Draft, Review',
	});
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const stray = columnByName(containerEl, 'Blocked');
	expect(stray.dataset.tooltip).toContain('Deliverable workflow states (in order)');
	expect(stray.dataset.tooltip).not.toContain('"Workflow states (in order)"');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/board.test.ts -t "own workflow"`
Expected: FAIL — `renderDeliverablesBoard` does not exist yet (compile error via
Task 15's import).

Run: `npx vitest run test/view/boardMoves.test.ts -t "Deliverables board"`
Expected: FAIL — same compile error; also `performDeliverablesBoardMove` does not exist
on the harness's host type until Task 12/13 land.

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
	/**
	 * The view-options display name of THIS workflow's state list, named in the
	 * stray-column tooltip (`renderColumnHeader`) so the hint points at the setting
	 * that actually holds this board's states — found by review: an unparametrized
	 * tooltip hardcoded the requirements option name, so a stray Deliverables column
	 * told the user to edit "Workflow states (in order)", a property this board
	 * ignores entirely.
	 */
	stateOptionLabel: string;
}

/**
 * Everything `renderColumn`/`renderCard` need beyond `ctx` and the element/model
 * they are rendering — bundled so both stay within the repo's `max-params: 5` lint
 * rule. Found by review: the first draft threaded `dnd`, `carded` and `opts` as three
 * separate trailing parameters, which pushed both functions to six.
 */
interface ColumnRenderCtx {
	dnd: CardDragController;
	carded: Set<string>;
	opts: BoardRenderOptions;
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
	const render: ColumnRenderCtx = { dnd, carded: cardPaths(board), opts };
	const colEls = board.columns.map((col) => renderColumn(ctx, colsEl, col, render));
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
		stateOptionLabel: 'Workflow states (in order)',
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
 * OUTSIDE that subtree will not render here until focus clears — **except under `PBI`
 * focus specifically**, where `collectFocusRoots`' own `extraFocused` rule
 * (`EXTRA_TYPE_RANK === focusIdx`) already admits every extra type as a focus root by
 * TYPE rather than by subtree position, the same established behavior `Issue`/`Bug`
 * get under PBI focus today — a parentless Deliverable stays visible there too. Also
 * regardless of either workflow's completion state (Scope: no "Show completed items"
 * concept here).
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
		stateOptionLabel: 'Deliverable workflow states (in order)',
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

`renderColumn` takes the bundled `render: ColumnRenderCtx` instead of three separate
trailing parameters, and passes it straight through to `renderCard`:

```ts
function renderColumn(ctx: RowContext, colsEl: HTMLElement, col: BoardColumn, render: ColumnRenderCtx): HTMLElement {
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
	renderColumnHeader(colEl, col, strip, filtering, render.opts.stateOptionLabel);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, render);
	render.dnd.wireDropTarget(colEl, (source) => render.opts.move(source.item, col.state));
	render.dnd.wireScroller(cardsEl);
	return colEl;
}
```

`renderColumnHeader` takes the same label, and its stray-column tooltip names it instead of
the hardcoded requirements string — found by review, the fourth spot this file names a
setting by a string literal instead of a parameter:

```ts
function renderColumnHeader(
	colEl: HTMLElement,
	col: BoardColumn,
	strip: boolean,
	filtering: boolean,
	stateOptionLabel: string,
): void {
	// … header/count/limit rendering unchanged …
	if (col.outsideWorkflow) {
		const mark = header.createSpan({ cls: 'pbl-board-col-stray' });
		setIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${col.label}" is not one of the configured workflow states. Add it to "${stateOptionLabel}" in the view options, or move its cards.`,
		);
	}
	// … strip/no-state tooltips, renderColumnPolicy call, unchanged …
}
```

`renderCard` also takes the bundled `render: ColumnRenderCtx` — `opts.doneOf` is
optional (`BoardRenderOptions`), so it falls back to `item.done` here, the one place
that needs the fallback rather than repeating it at every `opts` construction site:

```ts
function renderCard(ctx: RowContext, cardsEl: HTMLElement, item: BacklogItem, render: ColumnRenderCtx): void {
	const doneOf = render.opts.doneOf ?? ((i: BacklogItem) => i.done);
	const card = createCard(ctx, cardsEl, item, doneOf(item));
	renderCardBody(ctx, card, item);
	renderCardMatches(ctx, card, item, render.carded);
	wireCardActivation(ctx, card, item);
	render.dnd.wireCard(card, item);
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

and its import line — **found by review: `renderBoard` must be DROPPED from it, not
kept.** Task 15's own import (`renderBoard, renderDeliverablesBoard`) was correct at
the time, since the pre-existing `renderBoardContent` still called `renderBoard`
directly; this step is what stops that call, so `projections.ts` no longer calls
`renderBoard` at all — only the two `render*Board` entry points — and the unused name
fails `@typescript-eslint/no-unused-vars`:

```ts
import { renderDeliverablesBoard, renderRequirementsBoard } from './board';
```

(`renderBoard` stays `export`ed from `board.ts` itself — `renderRequirementsBoard` and
`renderDeliverablesBoard` both call it from inside that same file — it is simply no
longer one of `projections.ts`'s own imports.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/board.test.ts`
Expected: PASS — including every requirements-board test in this file, which must
still pass unchanged now that they route through `renderRequirementsBoard`.

Run: `npx vitest run test/view/boardMoves.test.ts`
Expected: PASS — including the new "Deliverables board" drop test and every
requirements-board move test in this file, unchanged.

Run: `npx vitest run test/view` (wide regression check — `createCard`'s new optional
parameter must not change the roadmap's own card rendering, which calls it too)
Expected: PASS

- [ ] **Step 5: Commit (Tasks 14, 15 and 16 together)**

```bash
git add src/view/render/board.ts src/view/render/projections.ts src/view/render/emptyStates.ts \
  test/view/board.test.ts test/view/boardMoves.test.ts
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

it('counts only Deliverable-typed items on the Deliverables board, never the whole base', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	vault.addFile('P1.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('P2.md', { frontmatter: { type: 'PBI', order: 20 } });
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	// One Deliverable card renders; the toolbar must not report the base's other 2
	// PBIs as part of "how many items are on this board".
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
`hidingCompleted()` branch); the fourth test reports "3 items" instead of "1 item"
(the whole base's `model.results.length`, unscoped to Deliverable-typed items); the
fifth test's tooltip still contains "PBI" (`levelBreakdown` reads the whole
`model.results`, and nothing corrects it after `renderToolbar` sets it once).

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

`syncCountLabel`: **found by review, a second gap beside the hidden-predicate one this
task already fixes.** Only the hidden predicate branched on projection in the first
draft — `total`/`shown` still counted `model.results.length` whole, so a base with one
Deliverable and ten PBIs would report "11 items" beside a board showing one card, and
filtering a PBI (never a card on this board) would change the count anyway. The
POPULATION has to be scoped the same way `renderDeliverablesBoard`'s own predicate
already is, before either count is taken.

**A third gap, found by a later review round: the count label's own TOOLTIP is set by
`renderToolbar`, never by `syncCountLabel`, and stays unscoped even after this fix.**
`renderToolbar` creates the `.pbl-count-label` span and calls
`setTooltip(countEl, levelBreakdown(host, model))` once, at full-render time;
`levelBreakdown` (this file, existing) always iterates the whole `model.results`
regardless of projection. `syncCountLabel` runs immediately after `renderToolbar` on
every render (`ProductBacklogView.render()` calls them in that order) and overwrites
the label's TEXT, but never touches its tooltip attribute — so on the Deliverables
board the visible text now correctly says "1 item" while hovering it still shows the
whole base's breakdown ("2 Epic · 4 Feature · 1 Deliverable"), a label and its own
tooltip disagreeing about what they are counting. `levelBreakdown` also turns out to
take an unused `host` parameter in the real code (its body never reads it, only
`model.results`) — dropped here rather than carried forward. Moving the tooltip into
`syncCountLabel`, over the SAME scoped `population` the label text already uses,
fixes both at once and makes it structurally impossible for them to drift apart again:

```ts
/** e.g. "2 Epic · 4 Feature · 9 PBI · 3 Bug" for the item-count tooltip, over whichever population is passed. */
function levelBreakdown(items: BacklogItem[]): string {
	const byLevel = new Map<string, number>();
	for (const item of items) {
		const label = displayType(item) || 'Untyped';
		byLevel.set(label, (byLevel.get(label) ?? 0) + 1);
	}
	return [...byLevel].map(([label, n]) => `${n} ${label}`).join(' · ');
}

export function syncCountLabel(host: BacklogViewHost, barEl: HTMLElement): void {
	const label = barEl.querySelector<HTMLElement>('.pbl-count-label');
	const model = host.model;
	if (!label || !model) return;
	const onDeliverables = host.projection === 'deliverables';
	const isDeliverable = (item: BacklogItem) => item.typeName?.toLowerCase() === 'deliverable';
	const population = onDeliverables ? model.results.filter(isDeliverable) : model.results;
	const hidden = (item: BacklogItem): boolean =>
		onDeliverables ? host.isRowHiddenByFilterOnly(item) : host.isRowHidden(item);
	const total = population.length;
	const shown = population.filter((item) => !hidden(item)).length;
	if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
	else label.setText(`${shown} of ${total}`);
	setTooltip(label, levelBreakdown(population));
}
```

`setTooltip` is already imported in this file (`import { BasesQueryResult, Menu,
setIcon, setTooltip } from 'obsidian';`). Update `renderToolbar`'s own call site to
match the new signature — it is immediately overwritten by `syncCountLabel` on every
render regardless of what it passes, so it keeps passing the whole, unscoped
population (no Deliverables-awareness needed there, since nothing ever observes its
transient value):

```ts
	setTooltip(countEl, levelBreakdown(model.results));
```

Import `BacklogItem` into this file if not already present (`BacklogModel` already is;
check the existing `import { BacklogModel } from '../../domain/model';` line and widen
it to `import { BacklogItem, BacklogModel } from '../../domain/model';`).

Add one more test to this task's Step 1, beside the mixed-base count test:

```ts
it('scopes the count tooltip to Deliverables too, not just the label text', () => {
	const vault = new FakeVault();
	vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
	vault.addFile('P1.md', { frontmatter: { type: 'PBI', order: 10 } });
	const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
	harness.view.setProjection('deliverables');
	const { containerEl } = harness;

	const label = containerEl.querySelector<HTMLElement>('.pbl-count-label');
	expect(label?.getAttribute('aria-label') ?? label?.getAttribute('data-tooltip') ?? '').not.toContain('PBI');
});
```

(Check `test/helpers/obsidian-mock.ts`'s `setTooltip` mock for which attribute it
actually writes — `aria-label` or `data-tooltip` — and read the correct one; both are
listed above so the assertion is correct whichever the mock uses, but only one branch
will ever be non-empty.)

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
	const { containerEl } = harness;

	// Select the card directly rather than via arrow navigation — the leading no-state
	// column is empty in this fixture, so an ArrowRight walk lands on ITS stop, never
	// on a card, and this test's subject is the move-key routing, not board arithmetic.
	const card = harness.view.model?.results.find((i) => i.title === 'D');
	if (!card) throw new Error('missing D');
	harness.view.selectItem(card);

	key(treeOf(containerEl), 'ArrowRight', { altKey: true });
	await flush();

	expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
	expect(vault.fm('D.md')['status']).toBe('Untouched');
});
```

**Found by review: `Harness` (`test/helpers/view.ts`) has only `view`, `config` and
`containerEl` — `makeView` never returns the `FakeVault`.** The `vault` local created
above the call is the one to read frontmatter off; do not destructure a `vault` field
off `harness`, here or in Task 19's write test below, both of which fail to compile
otherwise.

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
	const { containerEl } = harness;

	cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const submenu = Menu.lastShown?.item('Set state')?.submenu;
	expect(submenu?.item('Draft')?.checked).toBe(true);

	submenu?.item('Review')?.click();
	await flush();
	expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
	expect(vault.fm('D.md')['status']).toBe('Untouched');
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

### Task 20: The generated README — the Deliverable-state property row

**Files:**
- Modify: `src/domain/backlogReadme.ts`
- Test: `test/domain/backlogReadme.test.ts`

**Interfaces:**
- Consumes: `deliverableStateKey` (Task 3).
- Produces: `fieldRows` gains a Deliverable-state row when configured.

`fieldRows` is hand-enumerated (one `if` per property) rather than driven by
`PROPERTY_TABLE`, so a field joining `OptionalField` does not put a row in this table
for free — this task's one real gap. `typeSection`'s own prose does NOT need an edit
(see Step 3's note): an earlier draft of this task believed it did, on the premise
that only `Deliverable` — or, in a later draft, only the extra types — needed calling
out as rootable, and Task 1's own fixes (across two review rounds) retracted that
premise entirely: `childTypeChoices(null)` now equals the whole `ALL_TYPES` list, so
`parentsOf`/the table already state every type's root capability correctly with no
further change here.

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

it('shows the Deliverable row and does not claim only extras can root', () => {
	const content = backlogReadmeContent(defaultSettings(), [], 'test');
	expect(content).toContain('Deliverable');
	// A Feature/PBI/Task can also be created with no parent (the toolbar's top-level
	// creator draws no line anywhere in ALL_TYPES) — the prose must not say otherwise.
	expect(content).not.toMatch(/only.*(root|no parent)/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/domain/backlogReadme.test.ts -t "Deliverable"`
Expected: FAIL — no `deliverableStatus` row appears even when configured.

- [ ] **Step 3: Implement**

In `src/domain/backlogReadme.ts`'s `fieldRows`, after the existing stamp/horizon/start/
target rows:

```ts
	if (settings.deliverableStateKey) {
		rows.push(`| ${cell(settings.deliverableStateKey)} | Optional, on a Deliverable | The Deliverable workflow's own state — a separate workflow from the one above |`);
	}
```

**Found by review, across two rounds: first that "only `Deliverable` is rootable" was
false (Task 1), and then that "only the extra types are rootable" is ALSO false — Task
1's later fix makes `childTypeChoices(null)` equal `ALL_TYPES` in full, since the
toolbar's top-level creator draws no line anywhere in that list, not even at the
ladder.** An earlier draft of THIS task added a sentence to `typeSection`'s prose
saying the extra types "may also stand alone" — true on its own, but scoped to the
wrong set now that `Feature`/`PBI`/`Task` share the exact same capability. Rather than
widen the sentence to name every type (duplicating what the table's own
`parentsOf`/"*(nothing — it is a root)*" marker already states correctly, per row, for
every one of them), this task now removes the sentence: root capability is a PER-TYPE
fact the table already gets right for the whole vocabulary, and prose repeating "these
can all be roots" for a table where every single row already says so adds nothing —
it is the "measure with an instrument that can see all of it" rule applied to this
document's own two ways of saying the same thing. `typeSection`'s prose reverts to
describing pure STRUCTURAL shape (ladder / pinned extra / no-rung marker), which is
what it is actually for:

```ts
function typeSection(settings: BacklogSettings): string[] {
	const rows = ALL_TYPES.map((t) => `| ${cell(t)} | ${list(parentsOf(t))} | ${list(childrenOf(t))} |`);
	return [
		`## ${TYPES_HEADING}`,
		'',
		`${LEVELS.join(' → ')} is a ladder: each level holds the next one down. ` +
			`${EXTRA_TYPES.join(' and ')} sit *beside* it — they hang from any rung above the ` +
			`deepest and hold ${code(LEVELS[LEVELS.length - 1])} items wherever they hang, which ` +
			'is why they are types rather than levels. ' +
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

This is textually IDENTICAL to the function as it exists before this task touches it
at all — Task 1's `childTypeChoices(null)` fix already makes `parentsOf`/the table
correct for `Deliverable` (and, as a side effect, for `Feature`/`PBI`/`Task` too) with
zero changes needed in `typeSection` itself. This task's real, remaining change here
is the `fieldRows` row above; the prose needed no edit once the false "extras only"
premise was retracted, which is itself worth stating so a future reader does not
wonder why a "found by review" note describes a change that nets to nothing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/domain/backlogReadme.test.ts`
Expected: PASS — including every existing test in this file; `typeSection`'s own
prose and its existing tests are untouched by this task, so nothing there should need
updating.

- [ ] **Step 5: Commit**

```bash
git add src/domain/backlogReadme.ts test/domain/backlogReadme.test.ts
git commit -m "feat: document the Deliverable state property in the generated README"
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
  `Bug` and `Deliverable` that sit beside it rather than on it, or `Milestone` — a
  marker on neither, which states a date rather than work.
```

(No parenthetical singling out `Deliverable`'s root capability here — as Step 2 below
covers, all three extra types share it, so this top-level bullet stays the same shape
it already had.)

- [ ] **Step 2: Update "Issues and bugs sit beside the ladder"**

Around `README.md:306-354`, add a short paragraph after the existing "None of this is
enforced" paragraph (before "### Where new items are filed"). **Found by review: an
earlier draft of this paragraph called root creation an addition unique to
`Deliverable`, which Task 1's own fix makes false — the toolbar's top-level creator has
always offered `Issue` and `Bug` with no parent too, unconditionally.** `Deliverable`'s
real difference from them is its own workflow and board, not rootability:

```
`Deliverable` is the same shape as `Issue` and `Bug` — pinned rank, `Task` children,
never re-typed by a move, and (like them) creatable with **no parent at all**, from the
toolbar's own "pick another type" menu. What is new is its own folder and badge colour
like every declared type gets, and its own board with its own workflow — see
[The Deliverables board](#the-deliverables-board) below.
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
everywhere else — focused on a Feature, this board shows only the Deliverables nested
under that focus; focused on PBI specifically, every Deliverable stays visible
regardless of where it sits, the same way `Issue` and `Bug` already do under PBI
focus.) Moving a card (drag, Alt+Left/Right, or the card menu's Set state) writes only
the Deliverable state property.

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

**Found by review: the EXISTING "Show completed items" row in this same table needs its
own edit, or the finished table contradicts itself.** That row currently reads:

```
| Show completed items | on | Off hides fully-done subtrees from every projection (only while a state property is set); nothing about ranking or rollups changes |
```

"Every projection" was true before this feature — it is no longer, since Task 17
explicitly exempts the Deliverables board and this task's own new board section (Step
3) says the toggle has no effect there. Change its Purpose column to:

```
| Show completed items | on | Off hides fully-done subtrees from the tree, the board and the roadmap (only while a state property is set); the Deliverables board ignores it — see [The Deliverables board](#the-deliverables-board) — and nothing about ranking or rollups changes anywhere |
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
- Later review rounds, on the plan itself: the menu gate's OR bug, the keyboard tests'
  empty-leading-column assumption, and the focus-scope prose overstatement → Tasks 19,
  18, 16/21; the toolbar count's whole-base scoping and the empty advisory's
  focus-blindness → Tasks 17, 14; the stray-column tooltip naming the wrong workflow's
  option → Task 16; the raw-item-phase claim recurring in §6 of the design spec (fixed
  there directly, not a plan task); and, this round, `Issue`/`Bug` already being
  root-creatable via the toolbar (Task 1 no longer invents a `ROOTABLE_EXTRA_TYPES`
  subset; Task 20's prose simplifies to match) and the Deliverable-state backfill stub
  needing the same Deliverable-typed scoping the observed-vocabulary collector already
  has (Task 7's `missingKeyStubs` fix).
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
