# Iterations board implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Iteration` note type and an `iteration` link property, then give board mode a scope picker that shows one iteration's work in a workflow of its own.

**Architecture:** Three existing seams do almost all the work. `Iteration` joins `MARKER_TYPES`, inheriting every structural rule Milestone already pays for. `iteration` becomes one row in `PROPERTY_TABLE`, which buys the view option, the setup binding, the collision gate and the backfill. The board gains a *scope* — a third `Workflow` factory beside `requirementsWorkflow` and `deliverablesWorkflow`, over a population read off the whole unfocused tree, with the pick persisted beside `axis` in the collapse store.

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
| `src/domain/optionalProperties.ts` | `iterationState` field, `resolvedIterationStateKey` |
| `src/domain/readItems.ts` | `iterationStateValue` |
| `src/domain/model.ts` | `iterationResults`, `observedIterationStates` |
| `src/domain/board.ts` | `iterationWorkflow` |
| `src/storage/collapseStore.ts` | `boardScope` field, read defensively |
| `src/view/collapseState.ts` | `boardScope()` / `setBoardScope()` |
| `src/view/uiState.ts` | the accessor pair |
| `src/view/host.ts` | declarations |
| `src/view/render/toolbarControls.ts` | `renderBoardScopePicker` |
| `src/view/render/board.ts` | `renderIterationBoard` |
| `src/view/render/emptyStates.ts` | two states |
| `src/view/render/projections.ts` | the fork |
| `src/domain/writePlan.ts` | `computeIterationStateWrites` and its `ItemWrite` fields |
| `src/storage/frontmatter.ts` | the iteration state write, beside the Deliverable and Test ones |
| `src/storage/writeKeys.ts` | a second `carried` row, for the resolved state key |
| `src/view/cardMoves.ts` | `performIterationBoardMove` |

---

## Part A — the type and the property

### Task 1: `Iteration` joins the vocabulary

**Files:**
- Modify: `src/domain/typeVocabulary.ts` (`MARKER_TYPES`, `DEFAULT_TYPE_SUBFOLDERS`)
- Modify: `src/view/render/badges.ts` (`NAMED_TYPE_STYLE`)
- Modify: `styles/badges.css`
- Modify: `docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md`
- Modify: `docs/README.md` (folder table)
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
- **Amended 2026-08-15 (Iterations).** The vocabulary is **eight** names. `Iteration`
  joins `MARKER_TYPES` rather than `EXTRA_TYPES` for the reason the Milestone amendment
  gives: items link to an iteration, they are never its children, so it occupies no rung
  and hangs from nothing, and declares no prerequisites — though like every marker it may
  still be waited FOR. Nothing this ADR decided changes — the vocabulary is still
  fixed, still constants, and the eighth name owes the same three shipped opinions the
  other seven do. It has them: `iterations`, `calendar-clock`, purple.
```

In `docs/README.md`'s folder table, after the `milestones/` row:

```markdown
| `iterations/` | Time boxes work is committed to, owned by no item | `Iteration` |
```

- [ ] **Step 9: Run the whole gate and commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add -A
git commit -m "Add Iteration as the eighth declared type

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
	const iterationLink = settings.iterationKey ? readLinkEntry(app, file, cache, settings.iterationKey) : null;
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
- Produces: `computeIterationWrites(item: BacklogItem, target: TFile | null): ItemWrite[]` — `null` clears. `ItemWrite` gains an `iteration?: string | null` field, where `null` means delete the key.

- [ ] **Step 1: Write the failing test**

In `test/domain/writePlan.test.ts`:

```ts
describe('computeIterationWrites', () => {
	it('writes a wikilink to the chosen note', () => {
		expect(computeIterationWrites(pbi, sprint12)).toEqual([
			{ path: pbi.path, iteration: '[[Sprint 12]]' },
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
	if (iterations.length === 0) return;
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
		expect(settings.iterationDoneValues).toEqual(['shipped']);
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
- Produces: `model.iterationResults: BacklogItem[]`, and
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

	it('excludes context rows', () => {
		expect(paths(inIteration(model, sprint12))).not.toContain('excluded-epic.md');
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

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain/iterationModel.test.ts test/domain/board.test.ts`
Expected: PASS, including every level of the focus block.

- [ ] **Step 6: Watch the focus invariant fail**

Temporarily build `iterationResults` from the focused results instead of `items`. Run the focus block. Expected: FAIL on at least one level. Restore.

- [ ] **Step 7: Commit**

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

### Task 8: Persist the scope

**Files:**
- Modify: `src/storage/collapseStore.ts`, `src/view/collapseState.ts`, `src/view/uiState.ts`, `src/view/host.ts`
- Test: `test/storage/collapseStore.test.ts`

**Interfaces:**
- Produces: `host.boardScope: string | null` (an Iteration note path, or `null` for Product) and `host.setBoardScope(scope: string | null): void`.

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

- [ ] **Step 3: Store it**

In `src/storage/collapseStore.ts`, add `boardScope?: string | null` to both the snapshot and `StoredEntry`, a line in `defaultPicks` and one in `writePicks`.

**Read it as a plain string, not through `readEnum`.** `AXIS_VALUES` and `ZOOM_VALUES` are closed vocabularies; a note path is not, so there is no list to check against. Validate only that it is a non-empty string, and let *resolution* — not storage — decide that a path naming no Iteration renders Product. That split is what keeps the value user data: a stale path stays stored, and restoring the note restores the choice.

- [ ] **Step 4: Expose it**

`boardScope()` / `setBoardScope()` in `collapseState.ts` beside `axisPick()` / `setAxisPick()`; the accessor pair in `uiState.ts` beside `axisPick`, asking `hooks.render()` — a full render, like the projection: no Bases refresh follows a change it was not told about. Declare both on `BacklogViewHost` in `host.ts` and forward in one line from `backlogView.ts`.

- [ ] **Step 5: Migrate it on a rename**

This is the step the other UI-state picks did not need and this one does, because it is
the first pick whose VALUE is a path. `CollapseState.renamePath` migrates the collapsed
and settled row keys and nothing else, so without this a renamed sprint note leaves the
stored scope pointing at the old path, resolution reads it as stale, and the user is
silently dropped to Product — a rename quietly undoing a choice, which is the opposite of
the "retained, not rewritten" rule the stale case exists to keep.

Run the value through `movedPath(this.scope, oldPath, newPath)` in the same loop, and set
`changed` when it moves. `movedPath` is what makes the folder case work for free: it
matches the exact path OR the `oldPath + '/'` prefix, so a renamed *folder* carries the
note inside it. A comparison against the renamed path alone would leave it behind — the
mistake `renamePath`'s own comment records for the row keys.

Both cases are covered by the two tests in Step 1.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: PASS, including both rename cases.

- [ ] **Step 7: Commit**

```bash
npm run check
git add -A
git commit -m "Persist the board scope beside the roadmap axis pick

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

	it('does not render with the iteration property unconfigured', () => {
		// Both halves. With no configured property nothing can join a scope, so every
		// entry the picker offered would draw an empty board.
		expect(scopePicker(render(withIterations, { iterationKey: '' }))).toBe(null);
	});

	it('renders only in board mode', () => {
		expect(scopePicker(render(withIterations, { projection: 'roadmap' }))).toBe(null);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Draw it**

In `src/view/render/toolbarControls.ts`, add a `case 'board':` to `renderProjectionZone`'s switch — the file's own comment says a projection that grows a control adds a case, not a guard somewhere else in the row — and write `renderBoardScopePicker` against `renderAxisPicker` beside it, using `menuButton`, `showMenuForClick` and `pickAndRefocus(barEl, 'scope', …)`. Pass `barEl`, never `zone`: the zone is destroyed by the rebuild the pick causes.

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

### Task 10: Render the scoped board

**Files:**
- Modify: `src/view/render/board.ts` (`renderIterationBoard`), `src/view/render/emptyStates.ts`, `src/view/render/projections.ts`, `src/view/projection.ts`
- Test: `test/view/iterationBoard.test.ts`

- [ ] **Step 1: Write the failing tests**

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

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts -t 'iteration board'`
Expected: FAIL.

- [ ] **Step 3: Render it**

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
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const population = model.iterationResults.filter((item) => item.iterationPath === scope);
	const board = boardColumns(
		iterationWorkflow(population, host.settings),
		population,
		(item) => !host.isRowHidden(item),
		() => true,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		move: (item, state) => void host.performIterationBoardMove(item, state),
		stateOptionLabel: 'Iteration workflow states (in order)',
		drawEmpty: (h, aside, root) => {
			if (population.length === 0) renderNoIterationItemsState(aside);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside, root);
		},
	});
}
```

- [ ] **Step 4: Teach the three projection-shaped functions about the scope**

Each takes the **projection** alone today, and a board scope does not change the
projection, so each answers for the product board while an iteration is chosen. All three
are one-line answers in the place that already owns the question — never a branch at a
call site:

- `filterScopeFor` (`src/view/projection.ts`) must answer `'whole'`, as it does for the
  Deliverables board. It answers `'focused'` for every `board` today, so an inherited
  focus would hide a matching card **through the filter** that Step 3's population just
  promised no focus could hide. The population and the match index have to agree, or the
  promise holds for the cards and breaks for the search.
- `countedPopulation` (`src/view/render/toolbarStatus.ts`) must return this scope's
  carriers. It returns `model.results` minus Deliverables for every `board`, which is
  wrong twice here: it counts product work this board never shows and drops the
  Deliverables it deliberately includes. It is one function so the count label and the
  completed toggle's "(N hidden)" cannot disagree — put the scope inside it.

```ts
it('indexes the quick filter over the whole tree, so an inherited focus hides no match', () => {
	const board = renderScope(focused(model, 'Feature'), sprint12, { filter: 'login' });
	expect(cardPaths(board)).toContain('task-login.md'); // outside the focused subtree
});

it('counts this scope, Deliverables included and product work excluded', () => {
	expect(countLabel(renderScope(model, sprint12))).toBe('4 items');
});
```

- [ ] **Step 5: Set the two narrowing controls off**

In `src/view/projection.ts`, this scope's `VisibilityRule` takes `hideCompleted: false` — one field, in the one predicate, never a per-caller choice. That predicate's own comment records why: it was a per-caller choice for three surfaces until the fourth forgot.

`inProjection` is `projectionMember('board')`, which already returns `!inCatalog`.

- [ ] **Step 6: Suppress the two toolbar controls**

The focus picker renders a fixed, disabled button with no menu, no "Focused: <level>" label and no clear button — `renderFocusPicker`'s existing unconditional branch for the Deliverables board is the model. "Show completed items" is absent rather than present and inert.

- [ ] **Step 7: Fork on it**

In `src/view/render/projections.ts`, board mode dispatches on `host.boardScope`: `null`, or a path no `Iteration` result matches, renders the product board; a matching path renders `renderIterationBoard`. Resolution here, not in storage — a stale scope renders Product and the stored value is untouched.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/iterationBoard.test.ts test/view/board.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

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

### Task 11: Moves

**Files:**
- Modify: `src/domain/writePlan.ts` (the planner and its `ItemWrite` fields)
- Modify: `src/storage/frontmatter.ts` (the state write), `src/storage/writeKeys.ts` (its capture)
- Modify: `src/view/cardMoves.ts` (`performIterationBoardMove`), `src/view/host.ts`
- Modify: `src/view/interactions/cardDrag.ts`, `keyboard.ts`, `menu.ts`
- Test: `test/view/contextCardWrites.test.ts`, `test/view/iterationBoard.test.ts`

**The bottom three files come first**, and skipping them is why this task looked smaller
than it is. `applyCardMove` only *executes* an `ItemWrite` somebody already planned, and
the repository has planners and writer fields for the product, Deliverable and Test states
only. With `iterationStateKey` distinct from all three there is nothing that can write
`sprintState` alone — reusing either existing planner writes the **wrong workflow's key**,
which is the one failure this whole feature is supposed to make impossible.

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

- [ ] **Step 3: Plan, write and capture the iteration state**

Three edits, each the third instance of a pair that already exists:

- `src/domain/writePlan.ts` — `computeIterationStateWrites`, beside the Deliverable and
  Test planners, with `iterationState?: string` and `removeIterationStateKey?: boolean`
  on `ItemWrite` (the same pair every workflow state carries, because "no state" is a key
  removal rather than an empty string).
- `src/storage/frontmatter.ts` — the write, beside the Deliverable and Test state writes
  that were pulled out of `applyInto` together to stay under the complexity cap. Through
  `resolvedIterationStateKey`, so a falling-back workflow writes the product key.
- `src/storage/writeKeys.ts` — a second `carried` row, and it must use the **resolved**
  key for the reason that list's own comment gives: *"Same RESOLVED keys `applyInto` just
  wrote: capture and apply must read the same fallback, or a key written under it would
  have no inverse to undo it with."*

```ts
		[write.removeIterationStateKey || write.iterationState !== undefined, resolvedIterationStateKey(settings)],
```

This is a different row from Task 4's. That one captures the iteration **link**
(`settings.iterationKey`, unresolved — it has no fallback); this one captures the
iteration **state** (`resolvedIterationStateKey`). Two properties, two rows.

- [ ] **Step 4: Add the one host method**

In `src/view/cardMoves.ts`, beside `performBoardMove` and `performDeliverablesBoardMove`, over the shared `applyCardMove`. **The capture rule holds:** read the vocabulary that will NAME the move *before* the await, because the batch's own refresh rebuilds the board before it resolves and the column just vacated may be gone with its last card.

This is the only place an iteration-board move's batch is planned and the only place it is announced. The three inputs call it; none of them plans a write beside it.

- [ ] **Step 5: Route the three inputs**

`cardDrag.ts`, `keyboard.ts` (Alt+Left/Right) and `menu.ts` (Set state) each gain a branch selecting this method when the board scope is an iteration — a `=== 'board'`-shaped gate in the same files the Deliverables board's own branches sit in.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/view/contextCardWrites.test.ts test/view/iterationBoard.test.ts`
Expected: PASS. `contextCardWrites.test.ts` asks the three questions of each card projection — the drag, the keyboard and menu paths a drag cannot take, and the structural refusal behind both — so a new card projection is covered there by construction.

- [ ] **Step 7: Commit**

```bash
npm run check
git add -A
git commit -m "Move a card on an iteration board

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

- [ ] **Step 2: Set each note's `status: Done` and write the Feature's `## Outcome`**

- [ ] **Step 3: Add the `[Unreleased]` changelog entry**

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
