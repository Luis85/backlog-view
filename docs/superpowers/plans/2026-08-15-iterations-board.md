# Iterations board implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Iteration` note type and an `iteration` link property, then give board mode a scope picker that shows one iteration's work in a workflow of its own.

**Architecture:** Three existing seams do almost all the work. `Iteration` joins `MARKER_TYPES`, inheriting every structural rule Milestone already pays for. `iteration` becomes one row in `PROPERTY_TABLE`, which buys the view option, the setup binding, the collision gate and the backfill. And the iteration board is **its own `Projection` value**, with the chosen iteration's path stored beside it as a parameter.

**Read this before Task 8.** An earlier revision of this plan made the iteration board a *scope field* consulted at call sites, keeping `host.projection === 'board'`. Seven review rounds then found seven separate functions that answer for the product board while an iteration is chosen — `filterScopeFor`, `countedPopulation`, `hideCompleted`, the columns dispatch, the `Set state` gate, its checkmark planner, `byProjectionType` — each found one at a time, each fix correct and one case short of the next.

`src/view/projection.ts` predicted it in the file itself: *"A projection added beside `'tree'` rather than **as** a tree fails each of those gates silently and differently wherever a comparison bypasses this file"*, and `filterScopeFor`'s own comment records the identical history for the Deliverables board — *"three separate fixes to keep patching the gap… each was one case short, because a single set was being asked two questions."*

So the iteration board is a projection. **This does not change the control**: the toolbar still shows one `Board` position and a scope picker, which is what was asked for. Picking an iteration sets the projection *and* the scope path; picking `Product` sets the projection back. What it changes is that "am I an iteration board" is asked in one module, and `Record<Projection, …>` in `src/view/collapseState.ts` **fails to compile** until every projection question has an answer — the instrument that can see the whole set, rather than a review round per member of it.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (floor 1.12.0), esbuild, vitest + jsdom, ESLint with per-directory `no-restricted-imports`.

## Global Constraints

- **Definition of done is `npm run check`** — build, lint, coverage-thresholded tests, fallow, docs register. All five, on every commit. Coverage thresholds in `vitest.config.mts` only ever go up.
- **Layers:** `main → commands → view → storage → domain`, each may reach anything below and nothing above. `ui/` is a leaf. Violations fail `npm run lint`.
- **400-line max per `src/` file**, enforced by lint. `test/**` has its own budget of 450.
- **Never write frontmatter outside `storage/frontmatter.ts`.** `processFrontMatter`, `vault.create` and `load/saveLocalStorage` are banned by `no-restricted-syntax` everywhere outside `storage/`.
- **Every write path goes through the `configProblems` gate**, and forward batches are refused whole if any write targets an `outsideFilter` item.
- **Every module in `src/` must be specified** by a use case's `## Where it lives` or an ADR's `## Decision`, or `npm run docs` fails.
- **Every view-option key must be named in `docs/requirements/`**, or `test/docs/surfaces.test.ts` fails.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **The stylesheet is one partial per concern** under `styles/`; the root `styles.css` is generated. Edit the partial.

## Specification

Everything here implements:

- `docs/superpowers/specs/2026-08-15-iterations-design.md` — the design.
- `docs/requirements/An iteration is a note of its own.md` — Part A.
- `docs/requirements/A board scoped to one iteration.md` — Part B.

**Out of scope for this plan.** `docs/requirements/An iteration draws as a bar or a line.md` (the `drawsAsPoint` split and the `iterationBars` option) is an independent subsystem touching the roadmap's placement path. It gets its own plan. Nothing here depends on it, and nothing here may widen `placementEnds`.

## File structure

**Part A — the type and the property**

| File | Change |
| --- | --- |
| `src/domain/typeVocabulary.ts` | `ITERATION_TYPE`, added to `MARKER_TYPES`; `iterations` in `DEFAULT_TYPE_SUBFOLDERS` |
| `src/view/render/badges.ts` | `iteration` row in `NAMED_TYPE_STYLE` |
| `styles/badges.css` | `.pbl-lvl-iteration` hue, with the sharing decision recorded |
| `scripts/docs-check.mjs` | `LEGAL_CHILDREN` / `ROOT_TYPES`, matched to the README hierarchy table |
| `src/domain/optionalProperties.ts` | `iteration` in `OptionalField`, `iterationKey` in `OptionalSettingsKey`, one `PROPERTY_TABLE` row |
| `src/domain/settings.ts` | `iterationKey` field, default, resolve |
| `src/domain/viewOptions.ts` | `optionalPropertyOption('iteration', …)` |
| `src/domain/readItems.ts` | read the link into `iterationPath` |
| `src/domain/writePlan.ts` | `computeIterationWrites` |
| `src/storage/frontmatter.ts` | `applyIteration`, beside the parent link's write |
| `src/storage/writeKeys.ts` | one row in `touchedKeys`' `carried` list |
| `src/view/interactions/labels.ts` | `addIterationItems` |

**Part B — the scoped board**

| File | Change |
| --- | --- |
| `src/domain/viewOptions.ts` | `iterationsGroup()` |
| `src/domain/settings.ts` | `iterationStateKey` / `iterationStates` / `iterationDoneValues` |
| `src/domain/settingsResolve.ts` | `ITERATION_NAMES`, the third `SecondaryWorkflowNames` row |
| `src/domain/settingsConsistency.ts` | `'iteration state'` in `WORKFLOW_STATE_LABELS` |
| `src/domain/optionalProperties.ts` | `iterationState` field, `resolvedIterationStateKey` |
| `src/domain/readItems.ts` | `iterationStateValue` |
| `src/domain/model.ts` | `iterationResults` — **no** `observedIterationStates`, see Task 7 |
| `src/domain/vocabulary.ts` | `collectObservedIterationStates`, the scope-local collector |
| `src/domain/board.ts` | `iterationWorkflow` |
| `src/view/host.ts` | `Projection` gains `'iteration'`; `ColumnScope` gains a per-iteration value |
| `src/storage/collapseStore.ts` | `ITERATION_MODE`, and the `boardScope` path field |
| `src/view/projection.ts` | the seven projection questions answered for it |
| `src/view/collapseState.ts` | the `PROJECTION_MODE` row, `boardScope()` / `setBoardScope()` |
| `src/view/uiState.ts` | the accessor pair |
| `src/view/host.ts` | declarations |
| `src/view/render/toolbarControls.ts` | `renderBoardScopePicker` |
| `src/view/render/toolbarStatus.ts` | `countedPopulation` gains its case |
| `src/view/render/board.ts` | `renderIterationBoard` |
| `src/view/render/emptyStates.ts` | two states |
| `src/view/render/projections.ts` | the fork |
| `src/view/backlogView.ts` | `pbl-board-mode`, asked rather than enumerated |
| `src/domain/writePlan.ts` | `computeIterationStateWrites` and its `ItemWrite` fields (Task 10) |
| `src/storage/frontmatter.ts` | the iteration state write (Task 10) |
| `src/storage/writeKeys.ts` | a second `carried` row, for the resolved state key (Task 10) |
| `src/view/cardMoves.ts` | `performIterationBoardMove` (Task 10) |
| `src/view/interactions/create.ts` | carries the scope into the creation write |

---

## Part A — the type and the property

### Task 1: `Iteration` joins the vocabulary

**Files:**
- Modify: `src/domain/typeVocabulary.ts` (`MARKER_TYPES`, `DEFAULT_TYPE_SUBFOLDERS`)
- Modify: `src/view/render/badges.ts` (`NAMED_TYPE_STYLE`)
- Modify: `styles/badges.css`
- Modify: `docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md`
- Modify: `docs/README.md` (folder table **and** hierarchy table)
- Modify: `scripts/docs-check.mjs` (`LEGAL_CHILDREN`, `ROOT_TYPES`)
- Modify: `docs/requirements/An iteration is a note of its own.md` (names `typeFolder.iteration`)
- Test: `test/domain/itemTypes.test.ts`, `test/view/badges.test.ts`

**Interfaces:**
- Produces: `ITERATION_TYPE: string` (`'Iteration'`) and `isIterationType(name: string | null): boolean` from `src/domain/typeVocabulary.ts` and `src/domain/itemTypes.ts` respectively. Every later task imports these rather than spelling the string.

- [ ] **Step 1: Write the failing test**

In `test/domain/itemTypes.test.ts`:

```ts
describe('the Iteration type', () => {
	it('is a marker: no rung, no children, no dependencies', () => {
		expect(isMarkerType('Iteration')).toBe(true);
		expect(isMarkerType('iteration')).toBe(true);
		expect(childTypeChoices(itemOfType('Iteration'))).toEqual([]);
	});

	it('is in ALL_TYPES, so every consumer that reads the vocabulary finds it', () => {
		expect(ALL_TYPES).toContain('Iteration');
	});

	it('files under its own folder by default', () => {
		expect(folderForType(defaultSettings(), 'Iteration')).toBe('docs/iterations');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/itemTypes.test.ts -t 'Iteration type'`
Expected: FAIL — `isMarkerType('Iteration')` is `false`.

- [ ] **Step 3: Add the name**

In `src/domain/typeVocabulary.ts`, beside `DELIVERABLE_TYPE`:

```ts
/**
 * The time box's own type name, named once so `MARKER_TYPES` and every
 * `isIterationType` call site read the identical string rather than two spellings that
 * can drift — the reason `DELIVERABLE_TYPE` above is a constant.
 *
 * A MARKER, not an extra type, and the category is the whole design: an iteration
 * occupies no rung, holds nothing and hangs from nothing, because items LINK to it
 * rather than being its children. Every structural rule follows from that membership
 * without being written here — no `+` offering a child, no OUTGOING dependency edge,
 * ranked out of the ladder. Outgoing only: a marker declares no prerequisites, but any
 * item may still name one AS a prerequisite, exactly as it may name a milestone. See
 * ADR 0013's 2026-08-15 amendment.
 */
export const ITERATION_TYPE = 'Iteration';
export const MARKER_TYPES = ['Milestone', ITERATION_TYPE];
```

And in `DEFAULT_TYPE_SUBFOLDERS`, beside `milestone`:

```ts
	iteration: 'iterations',
```

- [ ] **Step 4: Add `isIterationType`**

In `src/domain/itemTypes.ts`, beside `isMarkerType`:

```ts
/**
 * This one marker by name — asked ONLY where the two markers must differ, which today
 * is the iteration board's scope picker and the `iteration` property's own menu.
 *
 * Deliberately narrow. `isMarkerType` is what every STRUCTURAL question asks, and a rule
 * spelled with this predicate instead would be a rule about one name rather than about
 * markers. `typeVocabulary.ts` records what happened when `isExtraType` came to mean two
 * things at four call sites.
 */
export function isIterationType(typeName: string | null): boolean {
	return typeName !== null && typeName.toLowerCase() === ITERATION_TYPE.toLowerCase();
}
```

- [ ] **Step 5: Add the badge**

In `src/view/render/badges.ts`, in `NAMED_TYPE_STYLE`:

```ts
	iteration: { icon: 'calendar-clock', badge: 'pbl-lvl-iteration' },
```

`calendar-clock`, not `calendar` or `calendar-range`: those two are the timeline zoom's Months and Quarters, and two controls in one row wearing one icon is the mistake the harness mock caught once already.

- [ ] **Step 6: Add the hue, with the decision recorded**

In `styles/badges.css`, after `.pbl-lvl-deliverable`:

```css
/*
 * PURPLE, Feature's, and the sharing rule this file states demanded a reason rather than
 * "whichever looked least crowded". All eight theme tokens were already worn when this
 * badge arrived, so the question was only WHICH pair shares and what keeps it apart.
 *
 * The count above this block says ELEVEN badges; it is TWELVE now. Update it in the same
 * edit — a count in prose goes stale the moment a name is added, which is why the rule
 * beneath it is written as a rule and not as an inventory.
 *
 * An Iteration hangs from nothing, so it sits at the TOP LEVEL of the tree, beside Epics
 * (orange) and Milestones (cyan) — the two hues it therefore must not take. Every other
 * wearer is a descendant, separated from it by the ladder's own indentation. A Feature is
 * the safest of those: it is a rung, always indented under an Epic, so an Iteration and a
 * Feature are never siblings at one indentation.
 *
 * The board is not a second meeting place. An Iteration is never a CARD — it is the scope
 * a board is chosen by, named in the picker, never a member of its own population — so
 * the cards a Feature sits among there never include one.
 */
.pbl-lvl-iteration { --pbl-badge-rgb: var(--color-purple-rgb); }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/domain/itemTypes.test.ts test/view/badges.test.ts`
Expected: PASS. `badges.test.ts` renders one of every `ALL_TYPES` entry and asserts each got an icon and a colour the stylesheet defines, so it covers the new name without being edited.

- [ ] **Step 8: Amend ADR 0013 and the README folder table**

In `docs/adrs/0013-…md`, under Consequences, beside the Milestone amendment:

```markdown
- **Amended 2026-08-15 (Iterations).** The vocabulary is **twelve** names — counted from
  `ALL_TYPES`, not from this record's own title, which still says seven and has been wrong
  since `Deliverable` and the two test types arrived. `Iteration`
  joins `MARKER_TYPES` rather than `EXTRA_TYPES` for the reason the Milestone amendment
  gives: items link to an iteration, they are never its children, so it occupies no rung
  and hangs from nothing, and declares no prerequisites — though like every marker it may
  still be waited FOR. Nothing this ADR decided changes — the vocabulary is still
  fixed, still constants, and the twelfth name owes the same three shipped opinions the
  other seven do. It has them: `iterations`, `calendar-clock`, purple.
```

In `docs/README.md`'s folder table, after the `milestones/` row:

```markdown
| `iterations/` | Time boxes work is committed to, owned by no item | `Iteration` |
```

**Two more gates fire on this task, and both are easy to miss because neither is about
`src/`.**

**The register's own hierarchy.** `scripts/docs-check.mjs` keeps its own `LEGAL_CHILDREN`
and `ROOT_TYPES`, and compares that map against the **hierarchy** table in
`docs/README.md` in *both* directions. Adding the type to the plugin without adding it
here leaves the register unable to hold an `Iteration` note at all — it is rejected as an
unknown type — and adding it to only one of the three surfaces fails the comparison. All
three, and the entry is `Milestone`'s exactly:

```js
	// A marker holds nothing and hangs from nothing: no children, and a root of its own.
	Iteration: new Set(),
```

plus `Iteration` in `ROOT_TYPES` — a separate set on purpose, because only that one decides
whether a parentless note is rejected — and the matching row in the README hierarchy table.

**The generated folder option.** `ALL_TYPES` drives `typeFolderKey`, so `getViewOptions()`
now emits `typeFolder.iteration`, and `test/docs/surfaces.test.ts` requires every emitted
key to appear as an **exact code token** in `docs/requirements/`. A generic
`typeFolder.<type>` does not satisfy it. `Milestones as their own type.md` names
`typeFolder.milestone` for exactly this reason; name `typeFolder.iteration` the same way in
`An iteration is a note of its own.md`:

```markdown
- It files into `typeFolder.iteration` — shipped default `iterations` under the home
  folder — and takes the `calendar-clock` icon and the purple badge.
```

Neither gate is optional: Step 9's `npm run check` fails on both.

- [ ] **Step 9: Run the whole gate and commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add -A
git commit -m "Add Iteration as the twelfth declared type

A marker beside Milestone: it occupies no rung, holds nothing and hangs from
nothing, because items link to an iteration rather than being its children.
Owes the three shipped opinions ADR 0013 requires of a declared name, and has
them — the iterations folder, calendar-clock, and purple.

Purple is a shared hue and the sharing rule wanted a reason. An Iteration sits
at the top level beside Epics and Milestones, so orange and cyan are out; every
other wearer is a descendant that indentation already separates, and a Feature
is always indented under an Epic. It is not a second meeting on the board
either: an Iteration is the scope a board is chosen by, never a card in it."
```

---

### Task 2: `iteration` joins the optional properties

**Files:**
- Modify: `src/domain/optionalProperties.ts` (`OptionalField`, `OptionalSettingsKey`, `PROPERTY_TABLE`)
- Modify: `src/domain/settings.ts` (`BacklogSettings.iterationKey`, `defaultSettings`, `resolveSettings`)
- Modify: `src/domain/viewOptions.ts`
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `settings.iterationKey: string` — `''` when unconfigured. View-option key `iterationProperty`. Suggested frontmatter key `iteration`.

- [ ] **Step 1: Write the failing test**

In `test/domain/settings.test.ts`:

```ts
describe('the iteration property', () => {
	it('resolves the configured key', () => {
		const s = resolveSettings(configWith({ iterationProperty: 'note.sprint' }), vault);
		expect(s.iterationKey).toBe('sprint');
	});

	it('is empty when unconfigured, and nothing is written to an empty key', () => {
		expect(resolveSettings(configWith({}), vault).iterationKey).toBe('');
	});

	it('collides with a key the plugin already owns, gating writes', () => {
		const s = resolveSettings(configWith({ iterationProperty: 'note.parent' }), vault);
		expect(configProblems(s).join(' ')).toContain('iteration');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/settings.test.ts -t 'iteration property'`
Expected: FAIL — `iterationKey` is not a property of the resolved settings.

- [ ] **Step 3: Widen the two unions and add the table row**

In `src/domain/optionalProperties.ts`, add `| 'iteration'` to `OptionalField` and `| 'iterationKey'` to `OptionalSettingsKey`, then in `PROPERTY_TABLE`, after `assignee`:

```ts
	// The link an item names its time box by. Suggested `iteration` rather than `sprint`:
	// the type is `Iteration` and the plugin does not have an opinion about which
	// cadence a team runs. Offered as a placeholder, never matched by name.
	iteration: { option: 'iterationProperty', suggested: 'iteration', label: 'iteration', settingsKey: 'iterationKey' },
```

- [ ] **Step 4: Add the settings field**

In `src/domain/settings.ts`, in `BacklogSettings` beside `assigneeKey`:

```ts
	/** Frontmatter key holding the link to an item's iteration, or '' when unset. */
	iterationKey: string;
```

and in `defaultSettings`: `iterationKey: '',`

The resolve needs no new code — `resolveSettings` walks `OPTIONAL_PROPERTIES`, so the table row above is what resolves it. Confirm this by reading the loop before adding anything; if it turns out to be a hand-written list, add the line there rather than generalising the loop in this task.

- [ ] **Step 5: Declare the view option**

In `src/domain/viewOptions.ts`, in the group where `riskProperty` and `assigneeProperty` are declared:

```ts
			optionalPropertyOption('iteration', 'Iteration property'),
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: PASS, all three.

- [ ] **Step 7: Name the option key in the register**

`test/docs/surfaces.test.ts` fails on a view-option key no requirement names. `iterationProperty` is already named in `docs/requirements/An iteration is a note of its own.md`. Run `npx vitest run test/docs/surfaces.test.ts` to confirm rather than assume.

- [ ] **Step 8: Commit**

```bash
npm run check
git add -A
git commit -m "Add the iteration property as one optional-property row

One row in PROPERTY_TABLE buys the view option, the setup binding, the
key-collision gate and the backfill stub. Suggested key is iteration, not
sprint: the type is Iteration and the plugin has no opinion about which
cadence a team runs."
```

---

### Task 3: Read the link off a note

**Files:**
- Modify: `src/domain/readItems.ts`
- Test: `test/domain/readItems.test.ts`

**Interfaces:**
- Consumes: `settings.iterationKey` from Task 2.
- Produces: `BacklogItem.iterationLink: LinkEntry | null` — the `{ raw, file }` pair
  `noteFields.ts` already defines, or `null` when the key holds nothing. Derived:
  `iterationPath = item.iterationLink?.file?.path ?? null`. Population matching uses the
  PATH; the plan (Task 4) needs the whole entry, because a link that resolved to nothing
  is not the same as no link at all.

- [ ] **Step 1: Write the failing test**

```ts
describe('the iteration link', () => {
	it('resolves a wikilink to a note path', () => {
		const item = readOne({ iteration: '[[Sprint 12]]' }, { iterationKey: 'iteration' });
		expect(item.iterationPath).toBe('docs/iterations/Sprint 12.md');
	});

	it('resolves an alias and a bare name the same way parent does', () => {
		expect(readOne({ iteration: '[[Sprint 12|S12]]' }, { iterationKey: 'iteration' }).iterationPath)
			.toBe('docs/iterations/Sprint 12.md');
		expect(readOne({ iteration: 'Sprint 12' }, { iterationKey: 'iteration' }).iterationPath)
			.toBe('docs/iterations/Sprint 12.md');
	});

	it('is null with no key configured, so an unconfigured property reads nothing', () => {
		expect(readOne({ iteration: '[[Sprint 12]]' }, { iterationKey: '' }).iterationPath).toBe(null);
	});

	it('keeps a broken link rather than repairing it, and does not read as absent', () => {
		const item = readOne({ iteration: '[[Gone]]' }, { iterationKey: 'iteration' });
		expect(item.iterationPath).toBe(null);
		// The distinction Task 4 needs: unresolved is NOT unset.
		expect(item.iterationLink?.raw).toBe('[[Gone]]');
	});

	it('reads no entry at all when the key is absent', () => {
		expect(readOne({}, { iterationKey: 'iteration' }).iterationLink).toBe(null);
	});

	it('takes the first entry when the key holds a list', () => {
		const item = readOne({ iteration: ['[[Sprint 12]]', '[[Sprint 13]]'] }, { iterationKey: 'iteration' });
		expect(item.iterationPath).toBe('docs/iterations/Sprint 12.md');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/readItems.test.ts -t 'iteration link'`
Expected: FAIL — `iterationPath` is undefined.

- [ ] **Step 3: Read it**

In `src/domain/readItems.ts`, beside where `deliverableStateValue` is read (around line 188), using the same link resolution `parent` already uses — read that call and copy its shape rather than writing a second resolver:

```ts
	// Through the metadata cache like `parent` and `dependsOn`, never a string compare:
	// a wikilink, an alias and a bare name all name one note, and only the cache knows
	// which. A link naming nothing keeps its `raw` and is NEVER repaired by a write — see
	// [[Broken links still render]].
	//
	// The whole ENTRY, not just the resolved path. `LinkEntry.raw` exists for exactly this
	// case, and its own comment says so: it is "what a removal matches on for an entry
	// that resolved to nothing". Collapsing an unresolved link to `null` would make it
	// indistinguishable from an unset key, and the Set menu would then tick `None` on a
	// note whose frontmatter still holds a broken link — offering as current an action
	// that cannot be taken. That is the same defect the horizon menu shipped once.
	// `readLinkList`, the reader that already exists — there is no `readLinkEntry`, and
	// inventing one would duplicate the cache handling this function does. An iteration
	// is SINGULAR, so take the first entry and ignore any others: a list under this key
	// is a note the user mis-filled, and reading the first is the same answer the parent
	// link gives for the same shape.
	const iterationLink = settings.iterationKey
		? (readLinkList(app, file, cache, settings.iterationKey)[0] ?? null)
		: null;
```

Add `iterationLink: LinkEntry | null` to the item interface, plus a derived
`iterationPath: string | null` (`iterationLink?.file?.path ?? null`) so the population
filter in Task 7 stays a plain path compare.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/readItems.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
npm run check
git add -A
git commit -m "Read an item's iteration link into iterationPath

Through the metadata cache the way parent and dependsOn already are, so a
wikilink, an alias and a bare name all resolve to one note path. A broken link
stays null and is never repaired by a write nobody asked for."
```

---

### Task 4: Plan and apply the write

**Files:**
- Modify: `src/domain/writePlan.ts` (`computeIterationWrites`)
- Modify: `src/storage/frontmatter.ts` (a write beside `applyHierarchy`'s parent link)
- Modify: `src/storage/writeKeys.ts` (`touchedKeys`)
- Test: `test/domain/writePlan.test.ts`, `test/storage/frontmatter.test.ts`

**Interfaces:**
- Consumes: `iterationPath` from Task 3.
- Produces: `computeIterationWrites(item: BacklogItem, target: TFile | null): ItemWrite[]` —
  `null` clears. `ItemWrite` gains an **`iteration?: TFile | null`** field: the FILE, never
  a serialized string, so the writer can spell a path-aware link. `null` means delete the
  key, `undefined` leaves it alone.

- [ ] **Step 1: Write the failing test**

In `test/domain/writePlan.test.ts`:

```ts
describe('computeIterationWrites', () => {
	it('carries the target FILE, so the writer can spell a path-aware link', () => {
		// NOT a serialized string: `[[Sprint 12]]` cannot say WHICH Sprint 12.
		expect(computeIterationWrites(pbi, sprint12File)).toEqual([
			{ path: pbi.path, file: pbi.file, iteration: sprint12File },
		]);
	});

	it('plans nothing when the item already names that iteration', () => {
		expect(computeIterationWrites(pbiInSprint12, sprint12)).toEqual([]);
	});

	it('plans a delete for None', () => {
		expect(computeIterationWrites(pbiInSprint12, null)).toEqual([
			{ path: pbi.path, file: pbi.file, iteration: null },
		]);
	});

	it('plans a delete for None even when the link resolved to nothing', () => {
		// Unresolved is not unset. Without this the menu ticks None and the broken
		// value can never be cleared.
		expect(computeIterationWrites(pbiWithBrokenLink, null)).toHaveLength(1);
	});

	it('plans nothing for None when the key is genuinely absent', () => {
		expect(computeIterationWrites(pbi, null)).toEqual([]);
	});
});
```

The second case is what makes a Set menu's checkmark askable of the PLAN: an entry is checked exactly when picking it would write nothing.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/writePlan.test.ts -t computeIterationWrites`
Expected: FAIL — not exported.

- [ ] **Step 3: Plan the write**

In `src/domain/writePlan.ts`, beside `computeAssigneeWrites`:

```ts
/**
 * The batch that puts one item in an iteration, or takes it out of one.
 *
 * Compares by RESOLVED PATH, never by the string in frontmatter: `[[Sprint 12]]`,
 * `[[Sprint 12|S12]]` and `Sprint 12` all name one note, so a string compare would plan a
 * write that changes nothing but spends the undo slot — and would tick a Set menu's
 * checkmark for a value the reader already holds under a different spelling. The horizon
 * menu drifted exactly this way once, offering as current an action that removes a key.
 *
 * Carries the target FILE, never a pre-serialized string, for the reason `write.parent`
 * does: two Iteration notes may share a basename in different folders, and only
 * Obsidian's own path-aware generation can spell an unambiguous link from THIS note to
 * THAT one. `[[${target.basename}]]` resolves, relative to the edited note, to whichever
 * of the two Obsidian picks.
 */
export function computeIterationWrites(item: BacklogItem, target: TFile | null): ItemWrite[] {
	// `None` clears whatever the key holds, INCLUDING a link that resolved to nothing.
	// Asking `iterationPath` alone would read a broken link as no link, tick `None` as
	// current, and leave the user unable to clear the very value they can see.
	if (target === null) return item.iterationLink === null ? [] : [{ path: item.path, file: item.file, iteration: null }];
	if (target.path === item.iterationPath) return [];
	return [{ path: item.path, file: item.file, iteration: target }];
}
```

Add to `ItemWrite`:

```ts
	/** The Iteration note to link to, or null to delete the key. Absent leaves it alone. */
	iteration?: TFile | null;
```

- [ ] **Step 4: Apply it**

**Not in `applyLabels`**, and this is the correction that matters. That list is for plain
LABEL strings — the risk and the assignee — and it has neither `app` nor the source path,
which path-aware link generation needs. A link belongs with the links.

In `src/storage/frontmatter.ts`, beside `applyHierarchy`'s own parent write:

```ts
/**
 * The iteration link. Beside the parent's rather than in `applyLabels`, because it is a
 * LINK: `wikilinkTo` needs the app and the SOURCE path to spell an unambiguous target,
 * and the label list carries neither. Sharing that list would have written
 * `[[${basename}]]`, which resolves to the wrong note wherever two iterations share one.
 *
 * The three rules that list keeps are kept here too, and they are the ones to check on
 * any new optional property: `undefined` leaves the key alone, `null` deletes it, and an
 * UNCONFIGURED key is never written at all.
 */
function applyIteration(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): void {
	if (write.iteration === undefined || !settings.iterationKey) return;
	if (write.iteration === null) delete fm[settings.iterationKey];
	else setOwn(fm, settings.iterationKey, wikilinkTo(app, write.iteration, write.file.path));
}
```

Call it from `applyInto` beside `applyLabels`. The reflex to reuse the label list was the
right reflex and the wrong list: reuse is judged by what the value IS, not by how few
lines the change is.

**And capture it**, in `src/storage/writeKeys.ts`. `applyWrites` decides whether anything
changed and builds the undo from `touchedKeys`, so a key written but not listed there is
written with `WriteOutcome.changed` still false and **no restore in the undo slot** — the
undo criterion below would fail while every write test passed. That function's `carried`
list says so itself: *"each such property should add a line here rather than another
branch — the assignee did exactly that."* One row:

```ts
		[write.iteration !== undefined, settings.iterationKey],
```

Its own comment states the condition rule: listed whenever the write TOUCHES the key and
a property names it — the same condition `applyIteration` writes on, so applying and
capturing cannot drift.

- [ ] **Step 5: Write the write-boundary test**

In `test/storage/frontmatter.test.ts`:

```ts
it('never writes the iteration key when it is unconfigured', async () => {
	const fm = await applyOne({ iteration: '[[Sprint 12]]' }, { ...settings, iterationKey: '' });
	expect(Object.keys(fm)).not.toContain('iteration');
});

it('deletes the key on null rather than writing an empty string', async () => {
	const fm = await applyOne({ iteration: null }, { ...settings, iterationKey: 'iteration' }, { iteration: '[[S11]]' });
	expect('iteration' in fm).toBe(false);
});

it('spells the link from the editing note, not from the target basename', async () => {
	// Two Sprint 12 notes in different folders. The write carries the FILE, so the
	// writer can disambiguate; a serialized string could not.
	const fm = await applyOne({ iteration: sprint12InQ3 }, { ...settings, iterationKey: 'iteration' });
	expect(fm.iteration).toBe('[[q3/Sprint 12]]');
});
```

- [ ] **Step 6: Run both suites, and drive undo through both directions**

```ts
it('undoes setting an iteration', async () => {
	await setIteration(pbi, sprint12);
	await host.undoLast();
	expect(frontmatterOf(pbi).iteration).toBeUndefined();
});

it('undoes clearing an iteration', async () => {
	await setIteration(pbiInSprint12, null);
	await host.undoLast();
	expect(frontmatterOf(pbi).iteration).toBe('[[Sprint 12]]');
});
```

Both fail without the `writeKeys.ts` row, and neither fails without it in a way the
write tests would notice — which is the point of driving undo rather than the write.

Run: `npx vitest run test/domain/writePlan.test.ts test/storage/frontmatter.test.ts`
Expected: PASS.

- [ ] **Step 7: Watch the invariant test fail**

Revert the `!key` guard's effect by temporarily changing the new row to `[write.iteration, settings.iterationKey || 'iteration']`. Run the first test of Step 5. Expected: FAIL. Restore. This is the repository's rule — an invariant asserted in a comment gets a test that is *watched* failing.

- [ ] **Step 8: Commit**

```bash
npm run check
git add -A
git commit -m "Plan and write an item's iteration as one more label property

One row in applyLabels' list, which is exactly what that generalisation was
for. The plan compares by resolved path rather than by the frontmatter string,
so three spellings of one note plan no write — which is what lets a Set menu's
checkmark be asked of the plan instead of a comparison beside it."
```

---

### Task 5: `Set iteration` on the menus

**Files:**
- Modify: `src/view/interactions/labels.ts` (`addIterationItems`)
- Modify: `src/view/interactions/menu.ts` (call it)
- Test: `test/view/contextRowWrites.test.ts`, `test/view/menu.test.ts`

**Interfaces:**
- Consumes: `computeIterationWrites` from Task 4, `isIterationType` from Task 1.
- Produces: `addIterationItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('Set iteration', () => {
	it('offers every Iteration note plus None', () => {
		expect(menuTitles(openRowMenu(pbi), 'Set iteration')).toEqual(['Sprint 11', 'Sprint 12', 'None']);
	});

	it('checks the entry that would write nothing, asked of the plan', () => {
		expect(checkedTitle(openRowMenu(pbiInSprint12), 'Set iteration')).toBe('Sprint 12');
	});

	it('is absent on a context row', () => {
		expect(menuSection(openRowMenu(contextPbi), 'Set iteration')).toBe(null);
	});

	it('is absent on a catalog member', () => {
		expect(menuSection(openRowMenu(testCase), 'Set iteration')).toBe(null);
	});

	it('still offers None with no iterations left, so a broken link can be cleared', () => {
		const menu = openRowMenu(pbiWithBrokenLink, { iterations: [] });
		expect(menuTitles(menu, 'Set iteration')).toEqual(['None']);
	});

	it('is absent with no iterations and nothing to clear', () => {
		expect(menuSection(openRowMenu(pbi, { iterations: [] }), 'Set iteration')).toBe(null);
	});

	it('is absent with no iteration property configured', () => {
		expect(menuSection(openRowMenu(pbi, { iterationKey: '' }), 'Set iteration')).toBe(null);
	});

	it('is absent on an Iteration row — an iteration is never put in one', () => {
		expect(menuSection(openRowMenu(sprint12Row), 'Set iteration')).toBe(null);
	});

	it('offers every Iteration note under a focus that re-roots the results', () => {
		expect(menuTitles(openRowMenu(pbi, { focus: 'PBI' }), 'Set iteration'))
			.toEqual(['Sprint 11', 'Sprint 12', 'None']);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/menu.test.ts -t 'Set iteration'`
Expected: FAIL — no such section.

- [ ] **Step 3: Build the submenu**

In `src/view/interactions/labels.ts`, following `addAssigneeItems`' shape:

```ts
/**
 * Set iteration's entries — every `Iteration` note in the model, then None.
 *
 * Three refusals, and each is a different rule rather than three spellings of one:
 * an unconfigured key has nothing to write to; a context row is never a write target;
 * and a CATALOG member's link could never draw a card, since the iteration board is a
 * board in the plan projection (`projectionMember` returns `!inCatalog` for it). A link
 * accepted and silently never drawn is worse than an action that is simply absent.
 */
export function addIterationItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (host.settings.iterationKey === '' || item.outsideFilter || inCatalog(item)) return;
	// An iteration is never PUT IN one. It is the scope a board is chosen by, and a
	// cross- or self-assignment would make one a card on another's board — which Task 1's
	// badge decision leans on being impossible.
	if (isIterationType(item.typeName)) return;
	// `byPath`, not `results`: a focus level re-roots `results`, so a top-level Iteration
	// outside the focused subtree would vanish from this menu. The same reason
	// `candidates` in `interactions/dependencies.ts` reads `byPath` — and the same reason
	// it filters `outsideFilter` explicitly, since `byPath` carries context rows.
	const iterations = [...(host.model?.byPath.values() ?? [])].filter(
		(i) => isIterationType(i.typeName) && !i.outsideFilter,
	);
	// No targets is NOT the same as nothing to do. An item still holding a link — a
	// broken one, or one to the iteration that was just deleted — needs `None` to clear
	// it, and this is the last place offering that. Hiding the whole submenu because the
	// TARGET list is empty leaves a value on screen the reader cannot remove: the
	// "unresolved is not unset" rule again, one level up from the plan that keeps it.
	if (iterations.length === 0 && item.iterationLink === null) return;
	// ... submenu built with `submenuOf`, one entry per iteration plus None, each
	// `.setChecked(computeIterationWrites(item, target).length === 0)` — the checkmark
	// asked of the PLAN, never of a value comparison beside it.
}
```

Write the submenu body against `addAssigneeItems` in the same file; do not invent a second menu-building helper.

- [ ] **Step 4: Call it**

In `src/view/interactions/menu.ts`, beside the Set assignee call.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/view/menu.test.ts test/view/contextRowWrites.test.ts`
Expected: PASS. `contextRowWrites.test.ts` drives every interaction against a fixture with context rows above, beside and between results, so the new write path is exercised there without anyone predicting the surface.

- [ ] **Step 6: Commit**

```bash
npm run check
git add -A
git commit -m "Offer Set iteration on plan rows and cards

Three refusals, three different rules: an unconfigured key has nothing to
write to, a context row is never a write target, and a catalog member's link
could never draw a card, since the iteration board is a board in the plan
projection. The checkmark is asked of the plan, so an entry is ticked exactly
when picking it would write nothing."
```

---

## Part B — the scoped board

### Task 6: The Iterations workflow settings

**Files:**
- Modify: `src/domain/viewOptions.ts` (`iterationsGroup`)
- Modify: `src/domain/settings.ts`
- Modify: `src/domain/optionalProperties.ts` (`iterationState`, `resolvedIterationStateKey`)
- Modify: `src/domain/settingsResolve.ts` (`ITERATION_NAMES` and its `resolveSecondaryWorkflow` call)
- Modify: `src/domain/settingsConsistency.ts` (`WORKFLOW_STATE_LABELS`)
- Modify: `src/domain/readItems.ts` (`iterationStateValue`)
- Test: `test/domain/iterationSettings.test.ts` (new)

**Interfaces:**
- Produces: `resolvedIterationStateKey(settings): string`, `settings.iterationStates: string[]`, `settings.iterationDoneValues: string[]`, `BacklogItem.iterationStateValue: string | null`.

- [ ] **Step 1: Write the failing tests — the fallback, in both directions**

New file `test/domain/iterationSettings.test.ts`. These four are the ones the Deliverables note got wrong, so they are written from the rule rather than from the implementation:

```ts
describe('the iteration workflow falls back field by field', () => {
	it('borrows the product key when no iteration state property is set', () => {
		expect(resolvedIterationStateKey({ ...s, iterationStateKey: '', stateKey: 'status' })).toBe('status');
	});

	it('uses its own key once set, leaving the product state untouched', () => {
		expect(resolvedIterationStateKey({ ...s, iterationStateKey: 'sprintState', stateKey: 'status' }))
			.toBe('sprintState');
	});

	it('keeps its own declared states over the shared list once configured', () => {
		const settings = resolveSettings(configWith({
			stateValues: 'Todo, Doing, Done',
			iterationStateValues: 'Committed, Started, Shipped',
		}), vault);
		expect(settings.iterationStates).toEqual(['Committed', 'Started', 'Shipped']);
	});

	it('keeps its own done values over the shared list once configured', () => {
		const settings = resolveSettings(configWith({
			doneValues: 'Done',
			iterationDoneValues: 'Shipped',
		}), vault);
		// CASING IS PRESERVED. `list()` trims and no more; the lowercasing happens at
		// COMPARISON (`new Set(effectiveDoneValues.map((v) => v.toLowerCase()))`), not on
		// the way in — the same as the product and test workflows. An expectation of
		// `['shipped']` here is red against a correct implementation.
		expect(settings.iterationDoneValues).toEqual(['Shipped']);
	});
});
```

**A list you set always wins**, shared key or not. What the key decides is which fallback an *empty* list takes, never whether a populated one is used.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/iterationSettings.test.ts`
Expected: FAIL — `resolvedIterationStateKey` is not exported.

- [ ] **Step 3: Add the group**

In `src/domain/viewOptions.ts`, mirroring `deliverablesGroup()` exactly:

```ts
/** The iteration workflow's own group — columns and a workflow only, like `deliverablesGroup`. */
function iterationsGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Iterations',
		items: [
			optionalPropertyOption('iterationState', 'Iteration state property'),
			{
				type: 'text',
				key: 'iterationStateValues',
				displayName: 'Iteration workflow states (in order)',
				default: '',
				placeholder: 'Committed, In progress, Review, Shipped',
			},
			{
				type: 'text',
				key: 'iterationDoneValues',
				displayName: 'Iteration states that count as done',
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
		],
	};
}
```

Register it in the options list beside `deliverablesGroup()`.

- [ ] **Step 4: Add the resolver**

In `src/domain/optionalProperties.ts`, add `iterationState` to `OptionalField`, `iterationStateKey` to `OptionalSettingsKey`, a `PROPERTY_TABLE` row with `suggested: 'status'` (the same reasoning the `deliverableState` row records — `state` is declared first and claims `status`, so a first-run setup leaves this unbound and the fallback shares the property), and:

```ts
/**
 * The key an ITERATION-board card's state is read and written through: its own when
 * named, else the requirements key it shares by default. The identical fallback
 * `resolvedDeliverableStateKey` states for the other secondary workflow, and stated
 * separately for the reason recorded there — a dozen call sites read these by name and
 * a parameterised `resolvedSecondaryKey` would make every one of them worse.
 */
export function resolvedIterationStateKey(settings: BacklogSettings): string {
	return settings.iterationStateKey || settings.stateKey;
}
```

- [ ] **Step 5: Add the three settings fields, and RESOLVE them**

`iterationStateKey: string`, `iterationStates: string[]`, `iterationDoneValues: string[]`
in `BacklogSettings`, defaulting to `''`, `[]`, `[...DEFAULT_DONE_VALUES]`.

**Fields and defaults alone resolve nothing**, and this is the third file the task needs.
The field-by-field fallback the four tests in Step 1 assert lives in
`src/domain/settingsResolve.ts`, behind `SecondaryWorkflowNames` and
`resolveSecondaryWorkflow`, and that file knows only the Deliverable and Test workflows
today. Without a third row the options are read by nothing, the fallback never runs, and
every one of those tests fails for a reason that looks like the fallback logic being wrong
rather than absent. Add the row beside `DELIVERABLE_NAMES` and `TEST_NAMES`:

```ts
const ITERATION_NAMES: SecondaryWorkflowNames = {
	property: 'iterationStateProperty',
	stateValues: 'iterationStateValues',
	doneValues: 'iterationDoneValues',
	fallbackKey: 'iterationStateKey',
	fallbackDoneValues: 'iterationDoneValues',
};
```

The ids stay literal rather than built from a shared prefix, for the reason that file
records: a persisted option id has to stay greppable, and `viewOptions.ts` spells these
the same way. Then one more `resolveSecondaryWorkflow` call in `resolveSettings`, beside
the two already there — the file's comment says its whole shape exists to keep that to one
line per workflow, so a third workflow should cost exactly one.

Widen `fallbackKey` and `fallbackDoneValues`' unions to admit the new names.

**And exempt the shared key from the collision gate.** `configProblems` reports two
properties sharing one frontmatter key, *except* where every sharer is in
`WORKFLOW_STATE_LABELS` — `{'state', 'deliverable state', 'test state'}` today. Sharing
the product key is a **supported** iteration configuration, so without the fourth label a
user who explicitly points `iterationStateProperty` at `status` gets a reported collision
and **every write path blocked**, on a configuration this feature deliberately offers.

```ts
	const WORKFLOW_STATE_LABELS = new Set(['state', 'deliverable state', 'test state', 'iteration state']);
```

The label has to match `PROPERTY_TABLE`'s `label` for the `iterationState` field exactly —
that set is keyed by label, so a mismatch silently fails to exempt.

**And extend the resolved-settings invariant.** `settingsConsistency.ts` also holds
`settingsInconsistency` and `listProblem`, which assert what `resolveSettings` can and
cannot produce — and they check the Deliverable and test workflows only. Left alone, a
test fixture could hold iteration settings `resolveSettings` would never emit: empty
`iterationDoneValues`, an empty inherited state list, untrimmed or duplicated states. Every
iteration test in this plan would then be passing or failing against a configuration the
product cannot reach, which is worse than a failing test. Add the third workflow's three
fields to both checks beside the two already there.

```ts
it('allows the iteration state to share the product key on purpose', () => {
	const s = resolveSettings(configWith({ stateProperty: 'note.status', iterationStateProperty: 'note.status' }), vault);
	expect(configProblems(s)).toEqual([]);
});
```

In `readItems.ts`, read `iterationStateValue` beside `deliverableStateValue`, off
`resolvedIterationStateKey(settings)`.

This also settles the open question Task 2 step 4 flagged: `resolveSettings` is not one
generic walk over `OPTIONAL_PROPERTIES` for everything — the optional PROPERTY comes from
that table, and a secondary WORKFLOW's two value lists come from here.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/domain/iterationSettings.test.ts test/domain/settings.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run check
git add -A
git commit -m "Add the iteration workflow's own settings group

Mirrors the Deliverables group and falls back to the product workflow field by
field: the key when no iteration state property is set, each list only while it
is itself empty. A list you set always wins, shared key or not — the four tests
are written from that rule rather than from the implementation, because this is
the sentence the Deliverables note got wrong the same day a check asserting the
opposite landed."
```

---

### Task 7: The workflow and the population

**Files:**
- Modify: `src/domain/board.ts` (`iterationWorkflow`)
- Modify: `src/domain/model.ts` (`iterationResults`, `observedIterationStates`)
- Test: `test/domain/iterationModel.test.ts` (new)

**Interfaces:**
- Consumes: `iterationPath` (Task 3), `resolvedIterationStateKey` (Task 6).
- Produces: `model.iterationResults: BacklogItem[]`,
  `withContextAncestors(population, model): BacklogItem[]` (Task 10 calls it), and
  `iterationWorkflow(population: BacklogItem[], settings: BacklogSettings): Workflow` —
  the **population**, not the model, so there is no model-wide observed list for a scope
  to disagree with.

- [ ] **Step 1: Write the failing tests**

New file `test/domain/iterationModel.test.ts`:

```ts
describe('an iteration board population', () => {
	it('holds the carriers only — no descendant joins by inheritance', () => {
		expect(paths(inIteration(model, sprint12))).toEqual(['pbi-login.md', 'task-tests.md']);
	});

	it('holds Deliverables, whatever type they are', () => {
		expect(paths(inIteration(model, sprint12))).toContain('deliverable-spec.md');
	});

	it('excludes catalog members, which is projection membership and not a type filter', () => {
		expect(paths(inIteration(model, sprint12))).not.toContain('test-case-login.md');
	});

	it('excludes context rows from the POPULATION', () => {
		expect(paths(inIteration(model, sprint12))).not.toContain('excluded-epic.md');
	});

	it('still renders an excluded ancestor as an inert context card', () => {
		// Counted nowhere, a column source nowhere, a write target nowhere — but on
		// screen, because the carrier below it needs the placement.
		const board = renderScope(model, sprint12);
		expect(contextCardPaths(board)).toContain('excluded-epic.md');
		expect(sum(board.columns.map((c) => c.count))).toBe(4); // the carriers alone
	});

	it('excludes an Iteration that names another iteration', () => {
		// Not reachable through the menu, but reachable by hand — and the badge decision
		// rests on an Iteration never being a card.
		expect(paths(inIteration(model, sprint13))).not.toContain('docs/iterations/Sprint 12.md');
	});

	it('observes only this scope\'s states, so a sibling sprint opens no column here', () => {
		expect(iterationWorkflow(inIteration(model, sprint12), settings).observedValues)
			.not.toContain('Deferred'); // carried only in Sprint 13
	});

	it('observes the ITERATION state, not the product one, when the keys differ', () => {
		const s = { ...base, stateKey: 'status', iterationStateKey: 'sprintState' };
		// The card carries status: Blocked and sprintState: Started.
		const observed = iterationWorkflow(inIteration(model, sprint12), s).observedValues;
		expect(observed).toContain('Started');
		expect(observed).not.toContain('Blocked');
	});

	describe('immune to the focus level', () => {
		for (const level of ALL_TYPES) {
			it(`is not narrowed by ${level} focus`, () => {
				expect(paths(inIteration(focused(model, level), sprint12)))
					.toEqual(paths(inIteration(model, sprint12)));
			});
		}
		it('is not narrowed by no focus at all', () => {
			expect(paths(inIteration(focused(model, ''), sprint12))).toEqual(paths(inIteration(model, sprint12)));
		});
	});
});
```

The focus block is stated from the rule over every level `ALL_TYPES` names, not over the two levels someone thought of — a category invariant is checked at the forbidden thing.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/iterationModel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Build the population**

In `src/domain/model.ts`, beside `deliverableResults` (around line 219), read off `items` — the whole tree `assignAll` just built, **before** either focus branch re-roots anything:

```ts
	/**
	 * Every result carrying an iteration link, regardless of any active focus level —
	 * the iteration boards' whole population, keyed by the linked note's path.
	 *
	 * Read off the unfocused tree for the reason `deliverableResults` already is: a focus
	 * is a LADDER control, picking which rung becomes a card, and this population is
	 * defined by a LINK the ladder knows nothing about. A focus left set on another
	 * projection must never make a sprint's own work disappear.
	 *
	 * Excludes `outsideFilter` items, same as `results`, and catalog members, because the
	 * iteration board is a board in the PLAN projection — `projectionMember` returns
	 * `!inCatalog` for it, and that is projection membership rather than a type filter.
	 * No work-item type is filtered: a `Deliverable` naming an iteration is a card here.
	 */
	iterationResults: items.filter(
		(item) =>
			!item.outsideFilter &&
			!inCatalog(item) &&
			!isIterationType(item.typeName) &&
			item.iterationPath !== null,
	),
```

`!isIterationType` is not belt-and-braces. Task 5's menu refuses to offer the action on an
Iteration row, but a hand-written frontmatter key would still put Sprint 12 inside Sprint
13 — and Task 1's badge decision rests on an Iteration never being a card. A rule the
population keeps holds against a note nobody edited through the UI; a rule only the menu
keeps does not.

**Do not add an `observedIterationStates` to the model.** An earlier draft of this plan
did, collected over every carrier, and it was wrong: that merges every iteration's
vocabulary, so a `Deferred` carried only in Sprint 13 would open an empty `Deferred`
column on Sprint 12 and offer it as a Set-state target there. The observed vocabulary is
**this scope's**, so it is collected inside the workflow from the population the workflow
is handed — which is exactly what `requirementsWorkflow` does with `collectObservedStates`
rather than reading `model.observedStates`, for the reason its own comment gives.

- [ ] **Step 4: Add the workflow**

In `src/domain/board.ts`, beside `deliverablesWorkflow`:

```ts
/**
 * An iteration board's workflow. The third instance of this interface, stated as a
 * factory for the reason the other two are: the domain tests then exercise the workflow
 * the view builds rather than one the view replaces a field of.
 *
 * One column list for every card on the board, `Deliverable` cards included. A board that
 * columned some cards by one vocabulary and some by another would not be a board.
 *
 * COLUMNS only. A card's finished styling is NOT this workflow's business: `createCard`
 * asks `ownWorkflowReading(item)` and takes no completion parameter, on purpose — that
 * parameter was removed because a per-board override is a category invariant asked at the
 * places someone thought of, and three call sites took the default and styled a
 * Deliverable by a workflow that does not track it. So a card here can sit in a column
 * this workflow calls done without wearing `pbl-done`. Do not "fix" that by restoring
 * the override.
 */
export function iterationWorkflow(population: BacklogItem[], settings: BacklogSettings): Workflow {
	const observed = collectObservedIterationStates(population, settings);
	return {
		stateOf: (item) => item.iterationStateValue,
		values: menuValues(settings.iterationStates, settings.iterationDoneValues, observed),
		observedValues: observed,
		doneValues: settings.iterationDoneValues,
		wipLimits: {},
		columnPolicies: {},
	};
}
```

It takes the **population**, not the model, and that is the whole fix for the merged
vocabulary: there is no model-wide list a scope could disagree with, because the only list
is built from the cards this board holds.

**`collectObservedStates` is the wrong collector**, and reaching for it is the obvious
mistake. It hard-codes `item.stateValue` and `settings.doneValues`
(`src/domain/vocabulary.ts`), so with a distinct `iterationStateProperty` it reads the
PRODUCT state off every card: in-scope iteration values mint no column, and unrelated
product values mint bogus ones. Add a sibling beside it, the way `collectObservedAssignees`
already sits beside it:

```ts
/** Every iteration state this board's own cards carry, open ones first then done. */
export function collectObservedIterationStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const values = firstSeen(all, (item) => (item.iterationStateValue === null ? [] : [item.iterationStateValue]));
	return sortOpenThenDone(values, settings.iterationDoneValues);
}
```

- [ ] **Step 5: Add the context-ancestor helper the renderer needs**

Task 10 builds its board from the carriers **plus** their excluded ancestors, so those
ancestors can render as inert context cards. Nothing in the repository does that today —
the product board gets context rows for free because it is handed `model.results`, which
already contains them, and a link-filtered list does not. So the helper is new, and it
belongs in `src/domain/board.ts` beside `requirementsFocusRoots`, which is the existing
"widen a candidate list for the renderer" function:

```ts
/**
 * A board's candidates: the population, plus every `outsideFilter` ancestor one of them
 * hangs from. Widening the CANDIDATES is not widening the population — the context-row
 * rule is that such a row renders and parents and does nothing else, and a row cannot
 * render at all if the list handed to `boardColumns` has already dropped it.
 *
 * The product board never needed this: it is handed `model.results`, which carries its
 * context rows already. A population filtered by a LINK does not, which is why this
 * exists here and nowhere else.
 */
export function withContextAncestors(population: BacklogItem[], model: BacklogModel): BacklogItem[] {
	const seen = new Set(population.map((item) => item.file.path));
	const out = [...population];
	for (const item of population) {
		for (let p = item.parent; p !== null && p.outsideFilter; p = p.parent) {
			if (seen.has(p.file.path)) break;
			seen.add(p.file.path);
			out.push(p);
		}
	}
	return out;
}
```

Walking up while the ancestor is `outsideFilter` and stopping at the first one already
seen: a shared excluded parent is added once, and a chain of them is added whole. Stopping
at the first in-filter ancestor is deliberate — that one is either a carrier already or is
not this board's business.

```ts
it('adds an excluded parent once for two carriers beneath it', () => {
	expect(withContextAncestors([taskA, taskB], model).filter((i) => i === excludedEpic)).toHaveLength(1);
});

it('adds a whole chain of excluded ancestors', () => {
	expect(paths(withContextAncestors([deepTask], model))).toContain('excluded-feature.md');
});

it('adds nothing when every ancestor is in the filter', () => {
	expect(withContextAncestors([plainPbi], model)).toEqual([plainPbi]);
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/domain/iterationModel.test.ts test/domain/board.test.ts`
Expected: PASS, including every level of the focus block.

- [ ] **Step 7: Watch the focus invariant fail**

Temporarily build `iterationResults` from the focused results instead of `items`. Run the focus block. Expected: FAIL on at least one level. Restore.

- [ ] **Step 8: Commit**

```bash
npm run check
git add -A
git commit -m "Derive an iteration board's population and its workflow

Read off the whole unfocused tree, the way deliverableResults already is: a
focus is a ladder control picking which rung becomes a card, and this
population is defined by a link the ladder knows nothing about, so a focus left
set on another projection must never make a sprint's work disappear. Checked
over every level ALL_TYPES names plus no focus at all.

No work-item type is filtered — a Deliverable naming an iteration is a card
here. Catalog members are excluded, and that is projection membership rather
than a type filter."
```

---

### Task 8: A projection of its own, and its scope

**Files:**
- Modify: `src/storage/collapseStore.ts`, `src/view/collapseState.ts`, `src/view/uiState.ts`, `src/view/host.ts`
- Test: `test/storage/collapseStore.test.ts`

**Interfaces:**
- Produces: the `'iteration'` member of `Projection`; `host.boardScope: string | null`
  (the chosen Iteration note's path, meaningful only in that projection) and
  `host.setBoardScope(scope: string | null): void`, which sets **both** the projection and
  the path — `null` returns to `'board'`, so the picker cannot leave the two disagreeing.

- [ ] **Step 1: Write the failing tests**

```ts
describe('the board scope', () => {
	it('round-trips per saved view', () => {
		store.setBoardScope('docs/iterations/Sprint 12.md');
		expect(reopen(store).boardScope()).toBe('docs/iterations/Sprint 12.md');
	});

	it('is retained, not rewritten, when its note is gone', () => {
		// The view renders Product; the STORE still holds the path, so restoring the
		// note restores the choice. This is the axis pick's own rule.
		store.setBoardScope('docs/iterations/Gone.md');
		expect(reopen(store).boardScope()).toBe('docs/iterations/Gone.md');
	});

	it('is absent from the stored entry when Product', () => {
		store.setBoardScope(null);
		expect(rawEntry(store)).not.toHaveProperty('boardScope');
	});

	it('follows the note when it is renamed', () => {
		store.setBoardScope('docs/iterations/Sprint 12.md');
		store.renamePath('docs/iterations/Sprint 12.md', 'docs/iterations/Sprint 12 (Q3).md');
		expect(store.boardScope()).toBe('docs/iterations/Sprint 12 (Q3).md');
	});

	it('follows the note when a FOLDER above it is renamed', () => {
		store.setBoardScope('docs/iterations/Sprint 12.md');
		store.renamePath('docs/iterations', 'docs/sprints');
		expect(store.boardScope()).toBe('docs/sprints/Sprint 12.md');
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/storage/collapseStore.test.ts -t 'board scope'`
Expected: FAIL.

- [ ] **Step 3: Make it a projection first**

Before any storage. In `src/view/host.ts`:

```ts
export type Projection = 'tree' | 'board' | 'roadmap' | 'deliverables' | 'catalog' | 'iteration';
```

Then **let the compiler drive the rest**. `PROJECTION_MODE` in
`src/view/collapseState.ts` is a `Record<Projection, ProjectionMode | null>`, so the build
breaks until it gains a row — and that row is **`BOARD_MODE`, the same value `'board'`
maps to**. There is no `ITERATION_MODE` and `PROJECTION_MODES` in
`src/storage/collapseStore.ts` is unchanged: step 4 makes the retained SCOPE the sole
discriminator between the two boards, so a second stored mode would be exactly the second
value that can disagree with the first. (An earlier revision of this step asked for one,
written before step 4 existed.)

`projectionFor` — the map read backwards — therefore answers `'board'` for `BOARD_MODE`,
and the scope-aware resolution in step 4 is what turns that into `'iteration'`. Reading a
mode back is deliberately not the place the two boards are told apart.

Now answer the seven questions in `src/view/projection.ts`, which is where "what a
projection IS" is asked rather than compared. Every one of these was found by a separate
review round while this was a scope field; as a projection they are one edit each in one
file:

| Question | Answer for `'iteration'` | Why |
| --- | --- | --- |
| `toolbarPosition` | `'board'` | **new** — which toggle position this projection lights up |
| `treeShaped` | `false` | cards, not rows |
| `hidesCompleted` | `false` | completion here is the iteration workflow's question, not the product rollup's |
| `hasRollup` | as `board` | same card shell |
| `projectionMember` | `!inCatalog` | a board in the plan projection |
| `filterScopeFor` | `'whole'` | the population ignores the focus, so the match index must too |
| `byProjectionType` | every type **except `Iteration`**, `Deliverable` included | offer exactly what this board can show — no more, no less |
| `projectionPopulation` | the ordinary plan population | **it cannot answer for a scope** — see below |

**`toolbarPosition` is the price of splitting internal identity from control identity**,
and it has to be paid in the same task that splits them. Two places in the toolbar compare
the projection to a position directly, and both break the moment those two stop being the
same thing:

- `renderProjectionZone` (`src/view/render/toolbarControls.ts`) switches on
  `host.projection`, so a `case 'board'` would stop matching the instant a scope is
  picked. **The picker would delete itself on first use** — no way back to `Product`, no
  way to another iteration, the control gone precisely because it worked.
- The toggle's own `position()` helper (`src/view/render/toolbar.ts`) sets `is-active` and
  `aria-pressed` from `host.projection === mode`, so in the `'iteration'` projection **no
  position renders pressed at all** — a switcher showing nothing selected.

So `projection.ts` gains one more question, and it is the one that keeps the author's
control decision true: `toolbarPosition('iteration') === 'board'`. The zone switches on
that, and so does the toggle's pressed state. This is a real cost of the split, not a
free consequence of it — worth paying for the compile-checked gates, and worth naming.

**The stored mode does not distinguish the two board projections — the scope does.**
`PROJECTION_MODE` maps BOTH `'board'` and `'iteration'` to the same stored `BOARD_MODE`,
and the effective projection is derived from that mode plus the retained scope. This is
the shape that removes the whole class of "the stored pair disagrees" rather than guarding
each way in:

- Choosing an iteration stores the scope. The mode is already `BOARD_MODE`.
- Choosing `Product` clears the scope to `null`.
- Leaving for the tree and coming back stores `BOARD_MODE` again and **derives
  `'iteration'` from the retained scope** — the reader returns to the sprint they left, the
  way the roadmap's retained axis pick already returns them to the axis they left.

An earlier revision stored the two independently and guarded the click that could
desynchronise them. That guard only fires while the current position IS `Board`, so the
round trip `Sprint 12 → Tree → Board` walked straight past it: `setProjection('board')`
with a retained scope still naming Sprint 12, product cards under a picker naming an
iteration. One guard per way in is the enumeration mistake this plan keeps finding; making
the two values incapable of disagreeing is the fix.

```ts
it('returns to the iteration it left after a trip through the tree', () => {
	const host = hostWith({ projection: 'iteration', boardScope: sprint12 });
	host.setProjection('tree');
	host.setProjection('board');
	expect(host.projection).toBe('iteration');
	expect(host.boardScope).toBe(sprint12);
});

it('returns to the product board when the scope was cleared', () => {
	const host = hostWith({ projection: 'board', boardScope: null });
	host.setProjection('tree');
	host.setProjection('board');
	expect(host.projection).toBe('board');
});
```

**The pressed state is not the only comparison in that helper.** `position()`'s click
handler calls `host.setProjection(mode)`, so with the effective projection `'iteration'`,
clicking the **already-pressed** `Board` button is not the no-op it looks like: it sets the
projection to `'board'` without going through `setBoardScope(null)`, leaving the stored
projection and the stored scope disagreeing — the one thing step 5's `setBoardScope`
contract exists to prevent. The click has to ask `toolbarPosition` too: clicking the
position you are already on does nothing, and leaving a scope is `setBoardScope(null)`,
never a bare `setProjection`.

```ts
it('does nothing when the pressed Board position is clicked while scoped', () => {
	const host = hostWith({ projection: 'iteration', boardScope: sprint12 });
	clickPosition(renderToolbar(host), 'Board');
	expect(host.projection).toBe('iteration');
	expect(host.boardScope).toBe(sprint12);
});
```

```ts
it('keeps the scope picker on screen after a scope is chosen', () => {
	const bar = renderToolbar(hostWith({ projection: 'iteration', boardScope: sprint12 }));
	expect(scopePicker(bar)).not.toBe(null);
});

it('presses the Board position while an iteration is chosen', () => {
	const bar = renderToolbar(hostWith({ projection: 'iteration', boardScope: sprint12 }));
	expect(pressedPosition(bar)).toBe('Board');
});
```

Drive the first through the *interaction*, not the state: pick an iteration from the
picker, let the rebuild happen, then look for the picker in the rebuilt toolbar. A test
that renders the end state directly passes while the round trip is broken.

**`projectionPopulation` is deliberately NOT where the scoped population lives.** It takes
`(projection, model)` and nothing else, and every existing caller passes exactly that — so
it can answer "the plan's population" but never "*this* iteration's carriers", which needs
the chosen path. Widening its contract would touch every caller to thread a value all but
one of them ignore.

The scoped population belongs where the scope is already in hand: `countedPopulation`
takes the `host`, and `renderIterationBoard` filters `model.iterationResults` by the chosen
path directly. Both read the same field off the same host, so they cannot disagree — which
is the guarantee that mattered, and it is met without a contract change.

`byProjectionType` is the one to read twice, and **"every type" is the wrong answer** —
it was the answer an earlier revision of this plan gave, and it is wrong in the opposite
direction from the product board's. The rule is one sentence: **a board offers exactly the
types it can show.**

It strips `Deliverable` for `'board'` and keeps only `Deliverable` for `'deliverables'`.
An iteration board shows both, so it strips neither — withholding a type a board displays
is the defect. But it also shows no `Iteration`, because Task 7's population rejects one
(an iteration is the scope, never a card in it). Offering `Iteration` would let a reader
create one here, or retype a visible card to one, and **watch it vanish from the board it
was created on** — the same defect through the other door.

```ts
it('offers exactly what an iteration board can show', () => {
	expect(byProjectionType('iteration', ALL_TYPES)).toContain('Deliverable');
	expect(byProjectionType('iteration', ALL_TYPES)).not.toContain('Iteration');
	expect(byProjectionType('board', ALL_TYPES)).not.toContain('Deliverable');
});
```

Both menus, since `offerableTypes` feeds `Set type` and the creation choices alike.

- [ ] **Step 4: Resolve a stale scope ONCE, not at the render**

`host.projection` is what every projection-dependent question consults. So the stale-scope
fallback cannot live in `renderProjectionContent`: resolving it there draws product-board
content while the projection still reads `'iteration'`, and `hidesCompleted`,
`filterScopeFor`, `countedPopulation`, the focus-control suppression and the offered types
all keep iteration behaviour. The reader would see **product cards under a zero-item
iteration count, with no completed toggle** — every gate individually consistent and the
screen incoherent.

Two values, and the distinction is the whole of it:

- the **stored** scope, raw, which is user data and is never rewritten — a path whose note
  is gone stays exactly as written, so restoring the note restores the choice;
- the **effective** projection, resolved once from the stored mode, that value, the model
  **and** the settings: `'iteration'` while the stored mode is `BOARD_MODE`, the iteration
  property is configured, and the path names an `Iteration` result; `'board'` otherwise.
  The mode alone never says which of the two boards this is — see step 3 — so the two
  stored values cannot contradict each other.

Both halves. With `iterationProperty` cleared, every item reads a null iteration, so the
path still names a note but no card can ever match it — and Task 9's picker is gone
(`iterationKey` is empty) while the pressed `Board` button is a deliberate no-op. The
reader would be stranded on a permanently empty scoped board with no control to leave it,
where extension 1b promises the unchanged product board. The raw path is still retained,
so re-configuring the property restores the scope.

`host.projection` returns the effective one. Nothing downstream asks the question twice,
and nothing downstream can answer it differently.

```ts
it('reads as the ordinary board when the iteration property is cleared', () => {
	// The path still names a real Iteration note; nothing can carry the link.
	const host = hostWith({ storedScope: sprint12, iterationKey: '' });
	expect(host.projection).toBe('board');
	expect(rawStoredScope(host)).toBe(sprint12); // retained — reconfiguring restores it
});

it('reads as the ordinary board everywhere while the scope is stale', () => {
	const host = hostWith({ storedScope: 'docs/iterations/Gone.md' });
	expect(host.projection).toBe('board');
	expect(countLabel(renderToolbar(host))).toBe(productCount);
	expect(completedToggle(renderToolbar(host))).not.toBe(null);
});

it('keeps the stored value, so restoring the note restores the choice', () => {
	const host = hostWith({ storedScope: 'docs/iterations/Gone.md' });
	expect(rawStoredScope(host)).toBe('docs/iterations/Gone.md');
});
```

This is the same lesson as the toolbar's, one layer up: **resolution belongs at one point
upstream of every consumer**, never at the last one that happens to need it.

- [ ] **Step 5: Store the scope path**

In `src/storage/collapseStore.ts`, add `boardScope?: string | null` to both the snapshot and `StoredEntry`, a line in `defaultPicks` and one in `writePicks`.

**Read it as a plain string, not through `readEnum`.** `AXIS_VALUES` and `ZOOM_VALUES` are closed vocabularies; a note path is not, so there is no list to check against. Validate only that it is a non-empty string, and let *resolution* — not storage — decide that a path naming no Iteration renders Product. That split is what keeps the value user data: a stale path stays stored, and restoring the note restores the choice.

- [ ] **Step 6: Expose it**

`boardScope()` / `setBoardScope()` in `collapseState.ts` beside `axisPick()` /
`setAxisPick()`; the accessor pair in `uiState.ts`, declared on `BacklogViewHost` in
`host.ts` and forwarded in one line from `backlogView.ts`.

**`setBoardScope` calls `hooks.recomputeFilter()` before `hooks.render()`** — like
`setProjection`, not like `setAxisPick`. The quick-filter index is built FOR a projection,
and changing the scope changes `filterScopeFor` from the focused index to the whole-tree
one. Without the rebuild, a filter already running keeps answering for the forest it was
built over: matches outside the focused subtree stay missing until some unrelated refresh,
which is extension 2c broken in the one case it exists for. `setProjection`'s own comment
states the ordering — *"Before the render, not after: the render is what reads the index."*

```ts
it('rebuilds the match index when the scope changes under a live filter', () => {
	// Product board, Feature focus, filter running — then switch to Sprint 12.
	const host = hostWith({ projection: 'board', focus: 'Feature', filter: 'login' });
	host.setBoardScope(sprint12);
	expect(cardPaths(render(host))).toContain('task-login.md'); // outside the focused subtree
});
```

Drive the transition, not the end state: a test that renders an already-scoped host builds
its index once, correctly, and never exercises the stale-index path at all.

- [ ] **Step 7: Migrate it on a rename**

This is the step the other UI-state picks did not need and this one does, because it is
the first pick whose VALUE is a path. `CollapseState.renamePath` migrates the collapsed
and settled row keys and nothing else, so without this a renamed sprint note leaves the
stored scope pointing at the old path, resolution reads it as stale, and the user is
silently dropped to Product — a rename quietly undoing a choice, which is the opposite of
the "retained, not rewritten" rule the stale case exists to keep.

Run the value through `movedPath(this.scope, oldPath, newPath)` in the same loop, and set
`changed` when it moves.

**And migrate the column-fold keys with it.** Step 3's fold scope carries the chosen
iteration's PATH, and `collapsedColumns` / `expandedColumns` are keyed by that scope plus
the column's own value (`columnKey` in `collapseState.ts`). So a renamed iteration whose
`Done` was folded would leave its fold behind under the old path and strand a key nothing
reads — the board reopening columns the reader closed, and the store growing entries that
never match again. This is the cost of putting a path inside a key, and it is worth
paying; what is not acceptable is paying half of it.

```ts
it('carries a folded column with its iteration on a rename', () => {
	store.setColumnCollapsed(`iteration:${sprint12}`, 'Done', true);
	store.renamePath(sprint12, 'docs/iterations/Sprint 12 (Q3).md');
	expect(store.columnCollapsed('iteration:docs/iterations/Sprint 12 (Q3).md', 'Done', false)).toBe(true);
});

it('carries them under a folder rename too', () => {
	store.setColumnCollapsed(`iteration:${sprint12}`, 'Done', true);
	store.renamePath('docs/iterations', 'docs/sprints');
	expect(store.columnCollapsed('iteration:docs/sprints/Sprint 12.md', 'Done', false)).toBe(true);
});
``` `movedPath` is what makes the folder case work for free: it
matches the exact path OR the `oldPath + '/'` prefix, so a renamed *folder* carries the
note inside it. A comparison against the renamed path alone would leave it behind — the
mistake `renamePath`'s own comment records for the row keys.

Both cases are covered by the two tests in Step 1.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/storage/collapseStore.test.ts test/view/projection.test.ts`
Expected: PASS, including both rename cases.

- [ ] **Step 9: Commit**

```bash
npm run check
git add -A
git commit -m "Make the iteration board a projection, and persist its scope

Vault-scoped localStorage, per saved view, per device, never the .base —
ADR 0011's rule applied again. Stored as a plain string rather than through
readEnum: a note path is not a closed vocabulary, so there is no list to check
against, and resolution rather than storage decides that a stale path renders
Product. That split is what keeps a stale scope retained instead of rewritten.

It is the first UI-state pick whose value is a PATH, so it is also the first that has to
be migrated on a rename — through `movedPath`, which carries a note whose FOLDER was
renamed as well as one renamed directly. Without it a rename would silently drop the
reader to Product, which is a choice undone rather than retained."
```

---

### Task 9: The scope picker

**Files:**
- Modify: `src/view/render/toolbarControls.ts`
- Test: `test/view/iterationBoard.test.ts` (new)

**Interfaces:**
- Consumes: `host.boardScope` / `setBoardScope` (Task 8), `isIterationType` (Task 1).

- [ ] **Step 1: Write the failing tests**

```ts
describe('the board scope picker', () => {
	it('names Product and every Iteration note', () => {
		expect(scopeChoices(render(withIterations))).toEqual(['Product', 'Sprint 11', 'Sprint 12']);
	});

	it('does not render with no Iteration notes', () => {
		expect(scopePicker(render(noIterations))).toBe(null);
	});

	it('qualifies two iterations that share a basename', () => {
		// The write is path-aware (Tasks 4 and 11); the PICKER has to be too, or the
		// reader chooses between two identical labels.
		expect(scopeChoices(render(withDuplicateNames)))
			.toEqual(['Product', 'q3/Sprint 12', 'q4/Sprint 12']);
	});

	it('does not render with the iteration property unconfigured', () => {
		// Both halves. With no configured property nothing can join a scope, so every
		// entry the picker offered would draw an empty board.
		expect(scopePicker(render(withIterations, { iterationKey: '' }))).toBe(null);
	});

	it('renders only in the Board position', () => {
		expect(scopePicker(render(withIterations, { projection: 'roadmap' }))).toBe(null);
	});

	it('is still there after a scope is picked, so the choice can be changed', () => {
		const bar = render(withIterations);
		clickScope(bar, 'Sprint 12');
		expect(scopeChoices(rebuiltToolbar())).toEqual(['Product', 'Sprint 11', 'Sprint 12']);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Draw it**

In `src/view/render/toolbarControls.ts`, `renderProjectionZone` switches on
`toolbarPosition(host.projection)` rather than the projection itself, and its `'board'`
case draws the picker — so the picker survives its own use, which it would not if the
switch compared the projection directly (Task 8, step 3). The file's own comment holds: a
projection that grows a control adds a case, not a guard somewhere else in the row.

Write `renderBoardScopePicker` against `renderAxisPicker` beside it, using `menuButton`,
`showMenuForClick` and `pickAndRefocus(barEl, 'scope', …)`. Pass `barEl`, never `zone`:
the zone is destroyed by the rebuild the pick causes.

**Labels must disambiguate.** Tasks 4 and 11 go to real trouble keeping two `Sprint 12`
notes in different folders distinct in the WRITE; a picker offering two identical entries
undoes that at the only point where a human chooses. Qualify a colliding basename with
enough of its path to separate it — and only a colliding one, since qualifying every entry
would make the common case unreadable to fix a rare one. The value behind each entry stays
the note itself, never the label. `Set iteration` (Task 5) shows the same list and needs
the same treatment.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/view/iterationBoard.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Check the toolbar still fits one row**

Run: `npm run harness` and look. [[A toolbar that fits one row]] is a requirement, and this adds a control to board mode where there was none. If it does not fit, that is a finding to report before continuing, not something to fix silently here.

- [ ] **Step 6: Commit**

```bash
npm run check
git add -A
git commit -m "Draw the board scope picker

The axis picker's twin, in the same zone, added as a case in the projection
switch rather than a guard elsewhere in the row. Two refusals: no Iteration
notes means nothing to choose between, and no configured iteration property
means every entry would draw an empty board."
```

---

### Task 10: The move plumbing, then the scoped board

**Every task in this plan ends green**, and this one nearly did not: its
`renderIterationBoard` wires `move: (item, state) => host.performIterationBoardMove(...)`,
and an earlier revision did not add that method until Task 11 — so Task 10's own
`npm run check` could not compile, let alone pass. The move *plumbing* therefore lands
here, ahead of the render that references it; Task 11 keeps the three input paths and
creation, which need a board on screen to be driven against.

That ordering is not an accident of this plan. The render needs a method to *name*, and
the inputs need a render to be *tested through* — so the only order in which each task
stands alone is plumbing, render, inputs.

**Files:**
- Modify: `src/view/render/board.ts` (`renderIterationBoard`), `src/view/render/emptyStates.ts`, `src/view/render/projections.ts`, `src/view/projection.ts`
- Test: `test/view/iterationBoard.test.ts`

- [ ] **Step 1: Land the planner, the writer, its capture and the host method**

Lift Task 11's own step of the same name and do it here — the whole of it, in this order,
because the render below cannot compile without the last one:

1. `src/domain/writePlan.ts` — `computeIterationStateWrites`, beside the Deliverable and
   Test planners, with `iterationState?: string` and `removeIterationStateKey?: boolean`
   on `ItemWrite`.
2. `src/storage/frontmatter.ts` — the write, beside the Deliverable and Test state writes,
   through `resolvedIterationStateKey`.
3. `src/storage/writeKeys.ts` — the `carried` row, using the **resolved** key:

```ts
		[write.removeIterationStateKey || write.iterationState !== undefined, resolvedIterationStateKey(settings)],
```

4. `src/view/cardMoves.ts` — `performIterationBoardMove`, beside `performBoardMove` and
   `performDeliverablesBoardMove`, over the shared `applyCardMove`; declared on
   `BacklogViewHost` in `src/view/host.ts` and forwarded in one line. `applyCardMove`'s
   capture rule holds: the vocabulary that names the move is read **before** the await,
   because the batch's own refresh rebuilds the board before it resolves and the column
   just vacated may be gone with its last card.

Nothing calls it yet. That is fine and is the point — a method with no caller compiles,
and Step 2's render is its first one.

- [ ] **Step 2: Write the failing tests**

```ts
it('cards exactly the population, and the column counts sum to it', () => {
	const board = renderScope(model, sprint12);
	expect(cardPaths(board).size).toBe(4);
	expect(sum(board.columns.map((c) => c.count))).toBe(4);
});

it('says "No items in this iteration yet" rather than the product board\'s advisory', () => {
	expect(emptyText(renderScope(model, emptySprint))).toBe('No items in this iteration yet');
});

it('shows the unconfigured guidance with no workflow, and the scope is still enterable', () => {
	const board = renderScope(model, sprint12, { stateKey: '', iterationStateKey: '' });
	expect(emptyText(board)).toContain('Iteration state property');
});
```

The second is [[A board scoped to Deliverables]] extension 1b met a second time: the product board's advisory cannot tell an empty base from an empty scope.

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts -t 'iteration board'`
Expected: FAIL.

- [ ] **Step 4: Render it**

In `src/view/render/board.ts`, beside `renderDeliverablesBoard`:

```ts
export function renderIterationBoard(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	scope: string,
): BoardSnapshot {
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [], scope: `iteration:${scope}` };
	const population = model.iterationResults.filter((item) => item.iterationPath === scope);
	// CANDIDATES are not the population. `boardColumns` needs the context ancestors an
	// in-scope carrier hangs from, or an `outsideFilter` parent is gone before the board
	// can draw it as an inert context card — extension 3a, and the context-row rule the
	// whole epic keeps. The candidate list is the carriers PLUS their `outsideFilter`
	// ancestors; the counted population, the workflow vocabulary and every write target
	// stay the carriers alone. A context row renders, it parents, and that is all.
	const candidates = withContextAncestors(population, model); // defined in Task 7
	const board = boardColumns(
		iterationWorkflow(population, host.settings),
		candidates,
		(item) => !host.isRowHidden(item) && (item.outsideFilter || population.includes(item)),
		(item) => !host.isRowHiddenUnfiltered(item) && !item.outsideFilter,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		// Its own fold scope, and it carries the CHOSEN ITERATION. `ColumnScope` is what
		// keeps identically named columns on different boards from sharing collapse
		// state: `'board'` would fold Product's `Done` with this one, and a constant
		// `'iteration'` would fold Sprint 13's `Done` when the reader folds Sprint 12's —
		// the same defect one level in, and exactly what extension 2h forbids. Widen the
		// union in `src/view/host.ts` to a per-iteration value:
		// `'board' | 'deliverables' | 'horizons' | \`iteration:${string}\``.
		scope: `iteration:${scope}`,
		move: (item, state) => void host.performIterationBoardMove(item, state),
		stateOptionLabel: 'Iteration workflow states (in order)',
		drawEmpty: (h, aside, root) => {
			if (population.length === 0) renderNoIterationItemsState(aside);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside, root);
		},
	});
}
```

- [ ] **Step 5: The gates the projection value does NOT answer**

Task 8 answered the seven questions in `projection.ts`, so `filterScopeFor`,
`byProjectionType`, `hidesCompleted`, `projectionMember` and `projectionPopulation` are
already right here and need no branch at any call site. Two direct comparisons remain,
because they are dispatch rather than predicates, and each needs its own case:

- `countedPopulation` (`src/view/render/toolbarStatus.ts`) compares the projection
  directly against `'deliverables'` and `'board'`. Add the `'iteration'` case, returning
  this scope's carriers. It is one function so the count label and the completed toggle's
  "(N hidden)" cannot disagree — which is exactly why the case goes inside it.
- `renderProjectionContent` (`src/view/render/projections.ts`) — the if-chain that the
  layer guide calls dispatch by design. See Step 7.

```ts
it('counts this scope, Deliverables included and product work excluded', () => {
	expect(countLabel(renderScope(model, sprint12))).toBe('4 items');
});

it('indexes the quick filter over the whole tree, so an inherited focus hides no match', () => {
	const board = renderScope(focused(model, 'Feature'), sprint12, { filter: 'login' });
	expect(cardPaths(board)).toContain('task-login.md'); // outside the focused subtree
});
```

The second passes because of `filterScopeFor('iteration') === 'whole'` from Task 8, not
because of anything in this task. It is written here anyway: it is the guarantee a reader
of this board cares about, and a test that passes for a reason stated elsewhere still
fails if that reason is removed.

- [ ] **Step 6: Set the two narrowing controls off**

In `src/view/projection.ts`, this scope's `VisibilityRule` takes `hideCompleted: false` — one field, in the one predicate, never a per-caller choice. That predicate's own comment records why: it was a per-caller choice for three surfaces until the fourth forgot.

`inProjection` is `projectionMember('board')`, which already returns `!inCatalog`.

- [ ] **Step 7: Turn on the board LAYOUT**

`renderTreeContent` (`src/view/backlogView.ts`) sets `pbl-board-mode` from
`projection === 'board' || projection === 'deliverables'`. That class is what gives the
scroller `overflow-x: auto` (`styles/board.css`); without it an iteration board keeps
`.pbl-tree`'s `overflow-x: hidden`, so **every column past the pane's width is
unreachable** — no scrollbar, no drag target, the work simply not there — and the stale
responsive rules can strip card metadata as well.

Do not add a third name to that comparison. Ask `projection.ts` — this is the same
enumeration hazard the toolbar's position comparison already was, one file over, and the
third board is the one that proves a list was the wrong shape:

```ts
/** Whether this projection draws CARD COLUMNS, and so needs the board layout. */
export function boardShaped(projection: Projection): boolean {
	return projection === 'board' || projection === 'deliverables' || projection === 'iteration';
}
```

It is a different question from `toolbarPosition`, which answers `'board'` for
`'iteration'` but not for `'deliverables'` — that one has a toggle position of its own.
Two questions, because they genuinely differ on a projection that exists today.

```ts
it('draws an iteration board with the board layout, so wide column sets scroll', () => {
	expect(renderScope(model, sprint12).viewEl.hasClass('pbl-board-mode')).toBe(true);
});
```

- [ ] **Step 8: Suppress the two toolbar controls**

The focus picker renders a fixed, disabled button with no menu, no "Focused: <level>" label and no clear button — `renderFocusPicker`'s existing unconditional branch for the Deliverables board is the model. "Show completed items" is absent rather than present and inert.

- [ ] **Step 9: Fork on it, and gate the columns on a resolved workflow**

In `src/view/render/projections.ts`'s dispatch chain, `'iteration'` renders
`renderIterationBoard` — **but only past a `resolvedIterationStateKey` check**, exactly as
`'deliverables'` is gated today. Without that gate `boardColumns` runs with no key, every
card lands in the no-state column, `drawEmpty` never fires, and extension 4a's
unconfigured guidance is unreachable: the board looks like a working one-column board
instead of saying what is missing.

The SCOPE's own staleness is **not** resolved here — Task 8 step 4 already did it, once,
upstream of every consumer. By the time this dispatch runs, `host.projection` is already
`'board'` for a stale scope, so this chain needs no fallback of its own and must not grow
one: a second resolution is a second opinion.

- [ ] **Step 10: Run the tests**

Run: `npx vitest run test/view/iterationBoard.test.ts test/view/board.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
npm run check
git add -A
git commit -m "Render a board scoped to one iteration

Neither narrowing control reaches it: hideCompleted is false in this
projection's VisibilityRule — one field rather than a per-caller choice — and
the population is already unfocused. The toolbar drops both controls rather
than showing them inert.

An empty scope says so in its own words. The product board's advisory cannot
tell an empty base from an empty scope, which is the distinction the
Deliverables board had to draw first."
```

---

### Task 11: The three inputs, and creation in place

**Files:**
- Modify: `src/view/interactions/cardDrag.ts`, `keyboard.ts`, `menu.ts`
- Modify: `src/view/interactions/create.ts` and `createBacklogItem` in `src/storage/frontmatter.ts`
- Test: `test/view/contextCardWrites.test.ts`, `test/view/iterationBoard.test.ts`

**The planner, the writer, its capture and `performIterationBoardMove` all landed in Task
10**, because the render there names the host method and could not compile without it.
What is left here is the part that needs a board on screen to be driven against: the three
input paths, and creation.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes the resolved iteration state key alone', async () => {
	await moveCard(pbi, 'Shipped', { scope: sprint12 });
	expect(written(pbi)).toEqual({ sprintState: 'Shipped' });
});

it('is taken back by the one undo slot', async () => {
	await moveCard(pbi, 'Shipped', { scope: sprint12 });
	await host.undoLast();
	expect(written(pbi)).toEqual({ sprintState: 'Committed' });
});

it('refuses the whole batch when a write targets a context card', async () => {
	await expect(moveCard(contextPbi, 'Shipped', { scope: sprint12 })).rejects.toThrow();
});

for (const input of ['drag', 'keyboard', 'menu'] as const) {
	it(`announces itself the same way from ${input}`, async () => {
		expect(await announcementFrom(input, pbi, 'Shipped')).toBe('Login flow moved to Shipped');
	});
}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts -t move`
Expected: FAIL.

- [ ] **Step 3: Route the three inputs — and for the menu, routing is not enough**

`cardDrag.ts` and `keyboard.ts` (Alt+Left/Right) each gain a branch selecting this method
in the `'iteration'` projection, beside the Deliverables board's own branches.

`menu.ts` needs **three** changes, not one, and routing the click is only the third:

1. **The gate.** `addEditableSections` decides whether to draw the Set state submenu at
   all from the item's own `stateKeyFor`. With only `iterationStateProperty` configured, an
   ordinary PBI has no product key, so it would get **no Set state menu at all** on a board
   whose columns are perfectly well defined. The gate has to ask the projection's workflow,
   not the item's own.
2. **The checkmark's planner.** `stateWrites` computes the no-op comparison with the
   product or Deliverable planner. On this board it must use `computeIterationStateWrites`,
   or the tick lands on a different value from the column the card is sitting in — a Set
   menu's checkmark is asked of THE PLAN, and it has to be the plan this move would
   actually make.
3. **The click**, routed to `performIterationBoardMove`.

**And the routing is projection-FIRST in both functions.** `chooseState` and `stateWrites`
test `isDeliverableType` before anything else today, so a `Deliverable` card on an
iteration board would take the Deliverable workflow for both its click and its checkmark —
on the one board that deliberately mixes the two kinds into a single column vocabulary.
The card would sit in an iteration column and its menu would offer, and write, another
board's states. The iteration branch goes ahead of the type branch in both.

```ts
it('offers Set state with only the iteration workflow configured', () => {
	const menu = openCardMenu(pbi, { stateKey: '', iterationStateKey: 'sprintState' });
	expect(menuSection(menu, 'Set state')).not.toBe(null);
});

it('checks the entry matching the card\'s own column, not its product state', () => {
	// status: Blocked, sprintState: Started — the card sits in Started.
	expect(checkedTitle(openCardMenu(pbi), 'Set state')).toBe('Started');
});

it('routes a DELIVERABLE card here by the projection, not by its type', async () => {
	// The type branch would win without projection-first routing, and this board
	// columns Deliverables by the iteration workflow like everything else on it.
	expect(menuTitles(openCardMenu(deliverableInSprint12), 'Set state'))
		.toEqual(iterationStates);
	await moveViaMenu(deliverableInSprint12, 'Shipped');
	expect(written(deliverableInSprint12)).toEqual({ sprintState: 'Shipped' });
});
```

The second is the one to watch fail: with the product planner it ticks `Blocked`, a value
this board has no column for.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/view/contextCardWrites.test.ts test/view/iterationBoard.test.ts`
Expected: PASS. `contextCardWrites.test.ts` asks the three questions of each card projection — the drag, the keyboard and menu paths a drag cannot take, and the structural refusal behind both — so a new card projection is covered there by construction.

- [ ] **Step 5: Seed a new card with the scope's iteration**

Narrowing the offered types (Task 8) is only half of "a board offers what it can show".
The other half is that what it creates **stays**: `promptCreateItem` passes the type, the
parent and an optional horizon to `createBacklogItem`, so a PBI or a Deliverable created
from an iteration board's toolbar carries **no iteration link** and vanishes from the
board on the next refresh — the exact failure the type-narrowing exists to prevent,
arriving through the other door.

The shape is already there to copy. `createBacklogItem` writes a horizon in the SAME
`vault.create`, and its comment says why: *"so it is never momentarily a note sitting in a
bucket its own frontmatter does not name, and never a write to an unconfigured key."* An
iteration is that rule again — one more field on the spec, written in the same create,
through the configured key or not at all.

Creation stays outside the undo history, as it already does: undo never deletes a note.

`NewItemSpec` carries the **`TFile`**, not a name — `iteration?: TFile` beside
`horizon?: string`, spelled with `wikilinkTo(app, spec.iteration, path)` from the NEW
note's own path. A horizon is a plain value and a basename is fine for it; an iteration is
a link, and Task 4 already refused the ambiguous spelling on the edit path. Refusing it
there and permitting it here would let a card created on Sprint 12 link to the *other*
Sprint 12 and vanish on refresh — the same defect this step exists to prevent.

```ts
it('creates into the iteration the board is showing', async () => {
	await createFromToolbar({ scope: sprint12File, typeName: 'PBI', title: 'New work' });
	expect(frontmatterOf('New work').iteration).toBe('[[Sprint 12]]');
});

it('links unambiguously when two iterations share a basename', async () => {
	await createFromToolbar({ scope: sprint12InQ3, typeName: 'PBI', title: 'New work' });
	expect(frontmatterOf('New work').iteration).toBe('[[q3/Sprint 12]]');
});

it('writes no iteration key when the property is unconfigured', async () => {
	await createFromToolbar({ scope: sprint12, iterationKey: '', typeName: 'PBI' });
	expect(Object.keys(frontmatterOf('New work'))).not.toContain('iteration');
});

it('creates without one on the product board', async () => {
	await createFromToolbar({ scope: null, typeName: 'PBI' });
	expect(frontmatterOf('New work').iteration).toBeUndefined();
});
```

- [ ] **Step 6: Commit**

```bash
npm run check
git add -A
git commit -m "Move a card on an iteration board, and create into it

One host method, three inputs, one place the batch is planned and one place it
is announced. The vocabulary naming the move is captured before the await: the
batch's own refresh rebuilds the board before it resolves, and the column just
vacated may be gone with its last card."
```

---

### Task 12: Close the register and the changelog

**Files:**
- Modify: `docs/requirements/An iteration is a note of its own.md`, `A board scoped to one iteration.md`, `An Iterations board.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Fill in each note's `## Where it lives` against what was actually built**

Every path must exist — these notes are under `docs/requirements/`, which `docs-check.mjs` treats as living, so a named path that is not there fails the gate.

- [ ] **Step 2: Close the two PBIs this plan delivered — and NOT the Feature**

`An iteration is a note of its own` and `A board scoped to one iteration` go to
`status: Done`. `An Iterations board` stays **Open**, and so does
`An iteration draws as a bar or a line`, which this plan does not build.

A Feature is done when its use cases are, and this one lists three. Marking it Done with
one unimplemented would put a false status into a backlog that is read as the project's
own — and this repository displays that backlog with this plugin, so the lie would be on
screen. Its `## Outcome` is written when the third PBI lands, since the README says an
outcome is written after the work.

- [ ] **Step 3: Add the `[Unreleased]` changelog entry**

Describing the two PBIs that landed, not the Feature.

Added by the pull request that earns it, never invented at release time.

- [ ] **Step 4: Run the whole gate**

Run: `npm run check`
Expected: exit 0, on Ubuntu and — via CI — on Windows.

- [ ] **Step 5: Say what still needs a live vault**

Obsidian cannot run here. Owed, and to be stated honestly in the pull request rather than implied as done:

- the `Iteration` badge colour and `calendar-clock` icon in a themed vault;
- the scope picker's fit in the toolbar row ([[A toolbar that fits one row]]);
- the picker's behaviour against a base that Bases refreshes underneath it.

`npm run test-build` bundles into `.obsidian/plugins/<id>/` in this repository root, and `docs/Product Backlog.base` opens the register as a backlog — so the plugin can display its own iterations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Close the Iterations board notes and log the change"
```

---

## Self-review

**Spec coverage.** §1 → Task 1. §2 → Tasks 2–5. §3 → Tasks 8–9. §4 → Tasks 7, 10. §5 → Task 6. §6 → Task 11. §7 → Task 10. §8 → **out of scope, its own plan**, stated at the top. Register work → Tasks 1 and 12.

**Placeholders.** Three steps deliberately say "write it against the named neighbour" rather than reproducing a whole function — Task 5 step 3 (the submenu body, against `addAssigneeItems`), Task 9 step 3 (against `renderAxisPicker`), Task 11 step 3 (against `performDeliverablesBoardMove`). Each names an exact existing symbol in an exact file, and the rule the new code must keep is written out. That is a pointer, not a placeholder — but an implementer who cannot find the neighbour should stop rather than invent.

**Type consistency.** `iterationPath` (Task 3) is what Tasks 4, 7 and 10 match on. `resolvedIterationStateKey` (Task 6) is what Tasks 7 and 11 write through. `host.boardScope` is `string | null` throughout — `null` is Product, never `''`. `computeIterationWrites` takes `{ path, basename } | null`, which is what Task 5's menu passes.

**One risk worth naming.** Task 2 step 4 assumes `resolveSettings` walks `OPTIONAL_PROPERTIES` rather than a hand-written list. The step says to read the loop first and adapt rather than generalise it — if it turns out to be hand-written, that is a one-line addition in the same place, not a refactor to fold into this task.
