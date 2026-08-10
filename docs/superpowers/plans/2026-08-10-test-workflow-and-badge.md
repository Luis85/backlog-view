# Test workflow and badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give test-catalog items a workflow of their own — a state property defaulting to `status`, an ordered state list and its own done values — configured from a `Test management` options group, and move `Test case` to cyan so it is no longer the same colour as `Test suite`.

**Architecture:** The Deliverable workflow is the template, built three times over already (key with a fallback, own state list, own done values, own options group, own `ItemWrite` fields). The test workflow is that mechanism a fourth time with ONE difference: it is selected by `inCatalog(item)` — the ladder — rather than by a type name. The two selectors are disjoint by construction, since a `Deliverable` is an extra type whose `ladderFor` answer is always `LEVELS`, so the three-way branch needs no ordering argument.

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom), eslint, fallow, a Markdown register gate (`scripts/docs-check.mjs`).

## Global Constraints

- **`npm run check` must pass before every commit.** It is build + lint + coverage-thresholded tests + fallow + the docs register. CI runs the same five on Ubuntu **and** Windows.
- **400-line cap per source file**, enforced by lint. `test/**` has its own cap of 450.
- **Layering** (`main → commands → view → storage → domain`) is enforced by `no-restricted-imports`. `domain/` never touches the DOM and never writes.
- **The configuration is four modules and the dependencies run one way** (ADR 0026): `typeVocabulary.ts` is a leaf; `settings.ts` is the shape and imports it; `optionalProperties.ts` and `settingsResolve.ts` sit above the shape and are never imported by it; `configProblems` lives in `settingsConsistency.ts`. A piece in the wrong one fails `npm run analyze` on the cycle.
- **Never write frontmatter outside `storage/frontmatter.ts`.** `no-restricted-syntax` bans `processFrontMatter` everywhere else.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **Marketplace rules:** sentence-case UI text, `setCssProps` over inline styles, no global `app`.
- **A rollup is a plan number**, `stateColors` is keyed by the state VALUE, and `colourProblem`'s allowed key set stays `states ∪ deliverableStates` — do not add `testStates` to it (Task 7 depends on this).
- **`CHANGELOG.md` gains an `[Unreleased]` entry in the PR that earns it** — Task 9.

---

### Task 1: The settings shape, and one resolver for both secondary workflows

**Files:**
- Modify: `src/domain/settings.ts` (the `BacklogSettings` fields beside `deliverableStateKey`, and `defaultSettings`)
- Modify: `src/domain/optionalProperties.ts` (`PROPERTY_TABLE`, and `resolvedTestStateKey` beside `resolvedDeliverableStateKey`)
- Modify: `src/domain/settingsResolve.ts` (generalise `resolveDeliverableWorkflow`, call it twice)
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `settings.testStateKey: string`, `settings.testStates: string[]`, `settings.testDoneValues: string[]`; `resolvedTestStateKey(settings: BacklogSettings): string`; `PROPERTY_TABLE.testState` with `option: 'testStateProperty'`, `settingsKey: 'testStateKey'`, `label: 'test state'`, `suggested: 'status'`.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/settings.test.ts`:

```ts
describe('the test workflow resolves like the Deliverable one', () => {
	it('falls back to the requirements key, states and EFFECTIVE done values when unbound', () => {
		const settings = resolveSettings(
			new FakeViewConfig({
				stateProperty: 'note.status',
				stateValues: 'Draft, Ready, Approved',
				doneValues: 'Approved',
			}) as unknown as BasesViewConfig,
		);
		expect(settings.testStateKey).toBe('');
		expect(resolvedTestStateKey(settings)).toBe('status');
		expect(settings.testStates).toEqual(['Draft', 'Ready', 'Approved']);
		expect(settings.testDoneValues).toEqual(['Approved']);
	});

	it('takes the shipped defaults, never the requirements customization, on its OWN key', () => {
		// An own distinct key is a genuinely independent workflow: borrowing a list read
		// through a DIFFERENT property is the bug the Deliverable resolver was written for.
		const settings = resolveSettings(
			new FakeViewConfig({
				stateProperty: 'note.status',
				stateValues: 'Draft, Ready, Approved',
				doneValues: 'Approved',
				testStateProperty: 'note.testStatus',
			}) as unknown as BasesViewConfig,
		);
		expect(settings.testStateKey).toBe('testStatus');
		expect(resolvedTestStateKey(settings)).toBe('testStatus');
		expect(settings.testStates).toEqual([]);
		expect(settings.testDoneValues).toEqual(DEFAULT_DONE_VALUES);
	});

	it('leaves the test key unbound on a first-run setup, so it shares status', () => {
		// `state` is declared FIRST in PROPERTY_TABLE and adopts `status`, which the loop then
		// adds to `taken`; the "don't suggest an already-taken key" guard skips every later
		// row suggesting it. That ordering IS the "tests default to status" rule.
		const config = new FakeViewConfig({}) as unknown as BasesViewConfig;
		const adopted = adoptableProperties(config, resolveSettings(config));
		expect(adopted.find((p) => p.option === 'stateProperty')?.suggested).toBe('status');
		expect(adopted.some((p) => p.option === 'testStateProperty')).toBe(false);
	});
});
```

`adoptableProperties(config, settings)` takes TWO arguments — the config and the settings
resolved from it — which is how every existing test in that file calls it.

Import `resolvedTestStateKey` from `../../src/domain/optionalProperties` and
`DEFAULT_DONE_VALUES` from `../../src/domain/settings` at the top of the file if not already
imported.

**One existing test in that file needs its COMMENT corrected, not its assertion.** The test
asserting the adoptable suggestions begins *"Nine, not ten: `deliverableState` suggests the
SAME key `state` does"*. Adding `testState` keeps the list at nine and for the same reason,
so the assertion stands — update the comment to say nine, not eleven, and to name both rows
the guard skips. Leaving it saying "ten" would make a correct test read as a stale one.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/domain/settings.test.ts -t "test workflow resolves"`
Expected: FAIL — `resolvedTestStateKey` is not exported, and `settings.testStateKey` is `undefined`.

- [ ] **Step 3: Add the three fields to the shape**

In `src/domain/settings.ts`, immediately after `deliverableDoneValues`:

```ts
	/** Frontmatter key holding the test workflow's own state, or '' when unset. */
	testStateKey: string;
	/** Test workflow states offered by a catalog row's Set state, in order; [] falls back to observed. */
	testStates: string[];
	/** State values (case-insensitive) that count as done, for the test workflow. */
	testDoneValues: string[];
```

And in `defaultSettings`, immediately after `deliverableDoneValues`:

```ts
		testStateKey: '',
		testStates: [],
		testDoneValues: [...DEFAULT_DONE_VALUES],
```

- [ ] **Step 4: Add the property row and the resolved key**

In `src/domain/optionalProperties.ts`, add **after** the `deliverableState` entry in `PROPERTY_TABLE` (order within the table only matters relative to `state`, which is already first — keep `testState` after it):

```ts
	testState: {
		option: 'testStateProperty',
		// Same suggestion as `state` and `deliverableState`, and the same mechanism delivers
		// the same outcome: `adoptableProperties` refuses a suggestion another property has
		// claimed, `state` is declared first and takes `status`, so a first-run setup leaves
		// THIS key unbound and `resolvedTestStateKey` falls back to `stateKey`. Tests read
		// `status` by sharing the plan's property, never by a second option written to point
		// at it — which is what "test items rely on status by default" actually means here.
		suggested: 'status',
		label: 'test state',
		settingsKey: 'testStateKey',
	},
```

And beside `resolvedDeliverableStateKey`:

```ts
/**
 * The key a TEST's state is read and written through: its own when named, else the
 * requirements key it shares by default. The identical fallback `resolvedDeliverableStateKey`
 * states for the other secondary workflow, and stated separately rather than through a
 * `resolvedSecondaryKey(settings, 'test')` because a dozen call sites read these by name and
 * a parameterised one would make every one of them worse.
 */
export function resolvedTestStateKey(settings: BacklogSettings): string {
	return settings.testStateKey || settings.stateKey;
}
```

- [ ] **Step 5: Generalise the resolver and call it twice**

In `src/domain/settingsResolve.ts`, rename `DeliverableWorkflowInputs` to `SecondaryWorkflowInputs` and `resolveDeliverableWorkflow` to `resolveSecondaryWorkflow`, add a `names` parameter, and make it return a plain triple the caller re-labels. Replace the whole function and its interface with:

```ts
/**
 * One SECONDARY workflow's three resolved fields — the Deliverable's, and the test
 * catalog's. Every argument in the comments below was written for the Deliverable and is
 * true of the test workflow word for word with `test` substituted, so this is one function
 * called twice rather than two copies of a fallback ladder that took a bug to get right.
 * A third secondary workflow is a call.
 *
 * The seam is the honest one: these three are the only fields whose value depends on
 * ANOTHER of their own group — the key's fallback decides what the two lists fall back to
 * — so they are a unit wherever they are computed.
 */
interface SecondaryWorkflowInputs {
	propKey: (key: string, def: string) => string;
	list: (key: string) => string[];
	dedupe: (values: string[]) => string[];
	fallback: BacklogSettings;
	/** The requirements workflow's own resolved vocabulary, which the two lists may fall back to. */
	states: string[];
	effectiveDoneValues: string[];
}

/** Which option keys and which fallback fields this secondary workflow reads. */
interface SecondaryWorkflowNames {
	property: string;
	stateValues: string;
	doneValues: string;
	fallbackKey: 'deliverableStateKey' | 'testStateKey';
	fallbackDoneValues: 'deliverableDoneValues' | 'testDoneValues';
}

interface SecondaryWorkflow {
	key: string;
	states: string[];
	doneValues: string[];
}

function resolveSecondaryWorkflow(inputs: SecondaryWorkflowInputs, names: SecondaryWorkflowNames): SecondaryWorkflow {
	const { propKey, list, dedupe, fallback, states, effectiveDoneValues } = inputs;
	// The KEY's own fallback condition, named ONCE and consulted by both lists below: as
	// the returned key directly, and as the gate BEHIND each list's own emptiness check —
	// a populated list wins first, and this only picks WHICH fallback an empty one takes.
	// See `resolvedDeliverableStateKey` / `resolvedTestStateKey`, which state the identical
	// condition for every READER outside this function.
	const own = propKey(names.property, fallback[names.fallbackKey]);
	const fallsBack = own === '';
	// Falls back to the requirements workflow's own EFFECTIVE done values ONLY when the KEY
	// is also falling back: a vault that customized `doneValues` must not have that ignored
	// while this workflow shares its property. An OWN, distinct key with no done values of
	// its own is a genuinely independent workflow and gets the shipped default instead —
	// never an unrelated property's customized list.
	const doneRaw = list(names.doneValues);
	const doneValues = doneRaw.length > 0 ? doneRaw : fallsBack ? effectiveDoneValues : fallback[names.fallbackDoneValues];
	// Same rule over the declared vocabulary: falls back to the shared workflow's OWN
	// declared states ONLY when the KEY is also falling back — a state property configured
	// on its OWN distinct key, with no declared states yet, must not borrow a vocabulary
	// that belongs to a DIFFERENT property.
	const statesRaw = dedupe(list(names.stateValues));
	return { key: own, states: fallsBack && statesRaw.length === 0 ? states : statesRaw, doneValues };
}
```

Then replace the single call site (the line beginning `const deliverable = resolveDeliverableWorkflow(`) with:

```ts
	const secondary = { propKey, list, dedupe, fallback, states, effectiveDoneValues };
	const deliverable = resolveSecondaryWorkflow(secondary, {
		property: 'deliverableStateProperty',
		stateValues: 'deliverableStateValues',
		doneValues: 'deliverableDoneValues',
		fallbackKey: 'deliverableStateKey',
		fallbackDoneValues: 'deliverableDoneValues',
	});
	const test = resolveSecondaryWorkflow(secondary, {
		property: 'testStateProperty',
		stateValues: 'testStateValues',
		doneValues: 'testDoneValues',
		fallbackKey: 'testStateKey',
		fallbackDoneValues: 'testDoneValues',
	});
```

Replace `...deliverable,` in the returned object with the six explicit fields (the triple is now generic, so the caller names them):

```ts
		deliverableStateKey: deliverable.key,
		deliverableStates: deliverable.states,
		deliverableDoneValues: deliverable.doneValues,
		testStateKey: test.key,
		testStates: test.states,
		testDoneValues: test.doneValues,
```

And update the `stateColors` line, which still reads the Deliverable's list and must NOT gain the test's (see Global Constraints):

```ts
		stateColors: nameTable([...states, ...deliverable.states], (s) => stateColorName(str(stateColorKey(s)))),
```

Delete the now-stale comment above `keyEntries` that says `deliverableStateKey` "is resolved here too and then OVERWRITTEN by `...deliverable` below" and replace it with:

```ts
	// `deliverableStateKey` and `testStateKey` are resolved here too and then OVERWRITTEN by
	// the explicit fields below: they are the two optional keys with a fallback of their own.
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the whole check**

Run: `npm run check`
Expected: all five steps pass. If `settingsResolve.ts` is over 400 lines, the generalisation should have made it shorter, not longer — re-read Step 5 rather than adding a file.

- [ ] **Step 8: Commit**

```bash
git add src/domain/settings.ts src/domain/optionalProperties.ts src/domain/settingsResolve.ts test/domain/settings.test.ts
git commit -m "Resolve the test workflow through one secondary-workflow resolver"
```

---

### Task 2: The collision exemption stops being a pair

**Files:**
- Modify: `src/domain/settingsConsistency.ts` (`STATE_KEY_SHARING_EXEMPT` and the loop that reads it; `settingsInconsistency`)
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: `settings.testStateKey`, `settings.testStates`, `settings.testDoneValues` (Task 1).
- Produces: nothing new; `configProblems(settings): string[]` keeps its signature.

**Why this is its own task:** with `status` shared by all three workflows the key now has three users, the current length test fails, and `configProblems` reports a collision — which **blocks every write in the view**, on the shipped default configuration. It fails closed and loudly, which is why it must land with Task 1 rather than after it.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/settings.test.ts`:

```ts
describe('three workflows may share one state key', () => {
	function sharing(extra: Record<string, unknown> = {}) {
		return resolveSettings(
			new FakeViewConfig({
				parentProperty: 'note.parent',
				orderProperty: 'note.order',
				typeProperty: 'note.type',
				stateProperty: 'note.status',
				deliverableStateProperty: 'note.status',
				testStateProperty: 'note.status',
				...extra,
			}) as unknown as BasesViewConfig,
		);
	}

	it('reports no collision when every user of the key is a workflow state', () => {
		expect(configProblems(sharing())).toEqual([]);
	});

	it('still reports one when a label of any other kind joins them', () => {
		// The exemption is about workflows, not about "these labels" — one more property on
		// the key is an ordinary clash and has to read as one.
		const problems = configProblems(sharing({ riskProperty: 'note.status' }));
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('"status"');
	});
});
```

- [ ] **Step 2: Run the tests and watch the first fail**

Run: `npx vitest run test/domain/settings.test.ts -t "three workflows may share"`
Expected: the first FAILS with a reported collision naming state, deliverable state and test state; the second passes for the wrong reason (it reports a collision because everything does).

- [ ] **Step 3: Replace the pair with a set**

In `src/domain/settingsConsistency.ts`, replace `STATE_KEY_SHARING_EXEMPT` and its comment with:

```ts
/**
 * The labels `configProblems` lets share ONE key: the three workflow states, explicitly
 * configured to the same property. Sharing by FALLBACK is already legitimate and never
 * reaches this map (`ownedProperties` reads the raw keys, so an unbound one resolves to
 * ''); this is the same "they can use the same status property" idea asked for explicitly.
 * The workflows keep independent vocabularies either way, so the usual reason a shared key
 * is a mistake — one property silently overwriting the other's meaning — never applies.
 *
 * A SET rather than a pair, and that is the correction rather than a generalisation for its
 * own sake: written as "exactly these two labels and no more" it reported a collision the
 * moment a third workflow defaulted to the same key — blocking every write in the view, on
 * the shipped configuration. Scoped to workflow states only: one more label of any other
 * kind (order, tags, an axis key) reports as a collision again, these named in it like any
 * other clash.
 */
const WORKFLOW_STATE_LABELS = new Set(['state', 'deliverable state', 'test state']);
```

And in `configProblems`, replace the `if (users.length === STATE_KEY_SHARING_EXEMPT.length && …) continue;` line with:

```ts
		if (users.every((label) => WORKFLOW_STATE_LABELS.has(label))) continue;
```

- [ ] **Step 4: Add the test workflow's fixture assertions**

In `settingsInconsistency`, after the two `deliverable*` checks, add their twins:

```ts
	if (settings.testDoneValues.length === 0) return 'testDoneValues is empty';
	if (settings.testStateKey === '' && settings.testStates.length === 0 && settings.states.length > 0) {
		return 'testStates is empty while the key falls back to a configured states list';
	}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: PASS, both new cases and everything already there.

- [ ] **Step 6: Watch the first test fail without the fix**

Revert the one-line change in `configProblems` to the old length test, run `npx vitest run test/domain/settings.test.ts -t "reports no collision"`, confirm RED, then restore. This is the Global Constraint on watched-failing tests: the comment above `WORKFLOW_STATE_LABELS` states a rule, so a test has to hold it.

- [ ] **Step 7: Run the whole check and commit**

```bash
npm run check
git add src/domain/settingsConsistency.ts test/domain/settings.test.ts
git commit -m "Let every workflow state share one key, not exactly two"
```

---

### Task 3: Reading a test's own state

**Files:**
- Modify: `src/domain/readItems.ts` (the `RawItem` fields beside `deliverableStateValue`, and the reader)
- Modify: `src/domain/board.ts` (`stateKeyFor`, `ownWorkflowReading`)
- Test: `test/domain/testLadder.test.ts`

**Interfaces:**
- Consumes: `resolvedTestStateKey` (Task 1).
- Produces: `item.testStateValue: string | null` and `item.testDone: boolean` on every item; `stateKeyFor(settings, item)` and `ownWorkflowReading(item)` returning the test workflow's key and reading for a catalog member.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/testLadder.test.ts`:

```ts
describe('an item’s workflow follows its type, or its ladder', () => {
	const configured = settingsWith({ stateKey: 'status', testStateKey: 'testStatus', testDoneValues: ['Approved'] });

	function workflowFixture() {
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Case.md', {
			frontmatter: { type: 'Test case', order: 10, status: 'Active', testStatus: 'Approved' },
			parentLink: 'Suite',
		});
		// A typeless child of a case: a catalog member by ladder, not by its own name.
		vault.addFile('Implied.md', { frontmatter: { order: 20, testStatus: 'Draft' }, parentLink: 'Case' });
		// A Task under a case: a plan type NAME on a catalog member.
		vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 30, testStatus: 'Draft' }, parentLink: 'Case' });
		// The other secondary workflow, which must be unaffected in both directions.
		vault.addFile('Runbook.md', { frontmatter: { type: 'Deliverable', order: 40, status: 'Active' } });
		const model = buildModel(vault.app, vault.entries(), configured);
		return (path: string) => {
			const item = model.byPath.get(`${path}.md`);
			if (!item) throw new Error(`no item ${path}`);
			return item;
		};
	}

	it('reads a catalog member through the test key, whatever its own type name says', () => {
		const get = workflowFixture();
		expect(ownWorkflowReading(get('Case'))).toEqual({ value: 'Approved', done: true });
		expect(ownWorkflowReading(get('Implied'))).toEqual({ value: 'Draft', done: false });
		expect(ownWorkflowReading(get('Test task'))).toEqual({ value: 'Draft', done: false });
	});

	it('leaves the plan and the Deliverable workflow on their own keys', () => {
		const get = workflowFixture();
		expect(stateKeyFor(configured, get('Runbook'))).toBe('status');
		expect(stateKeyFor(configured, get('Case'))).toBe('testStatus');
		expect(stateKeyFor(configured, get('Suite'))).toBe('testStatus');
	});
});
```

Import `ownWorkflowReading` and `stateKeyFor` from `../../src/domain/board` at the top of the file.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/domain/testLadder.test.ts -t "workflow follows its type"`
Expected: FAIL — `ownWorkflowReading` returns the requirements reading, and `stateKeyFor` returns `status` for the case.

- [ ] **Step 3: Read the test state onto every item**

In `src/domain/readItems.ts`, add to the `RawItem` interface immediately after `deliverableDone`:

```ts
	/** The test workflow's own state value, or null when its key is unset or absent. */
	testStateValue: string | null;
	/** True when the test state matches one of ITS OWN configured done values. */
	testDone: boolean;
```

And in the reader, immediately after the `deliverableStateValue` lines:

```ts
	// Read on every item rather than only on catalog members, exactly as the Deliverable's
	// is read on every item rather than only on Deliverables: this is a plain key read, and
	// the membership question belongs where the workflow is CHOSEN. It cannot be asked here
	// at all — a `RawItem` has no `ladder` yet, since `assignAll` is what puts one on it.
	const testStateKey = resolvedTestStateKey(settings);
	const testStateValue = testStateKey ? readString(ownValue(fm, testStateKey)) : null;
	const testDoneValues = settings.testDoneValues.map((v) => v.toLowerCase());
```

Then add to the returned object, beside `deliverableStateValue`:

```ts
		testStateValue,
		testDone: testStateValue !== null && testDoneValues.includes(testStateValue.toLowerCase()),
```

Import `resolvedTestStateKey` from `./optionalProperties` beside the existing `resolvedDeliverableStateKey` import.

- [ ] **Step 4: Route the two selectors**

In `src/domain/board.ts`, replace `stateKeyFor` and `ownWorkflowReading` with:

```ts
/**
 * The key an item's state is read and written through. Three workflows now, and the two
 * secondary selectors are DISJOINT BY CONSTRUCTION rather than ordered: `isDeliverableType`
 * asks a type NAME and `inCatalog` asks the LADDER, and a `Deliverable` is an extra type
 * whose `ladderFor` answer is always `LEVELS`. No item can satisfy both, so this branch
 * needs no argument about which is tested first.
 *
 * The ladder and not a list of test type names, for the reason the whole catalog rests on:
 * a typeless child of a `Test suite` and a `Task` under a `Test case` are both catalog
 * members, and a predicate written as `isTestType(item.typeName)` gets both wrong while
 * passing every other fixture.
 */
export function stateKeyFor(settings: BacklogSettings, item: BacklogItem): string {
	if (isDeliverableType(item.typeName)) return resolvedDeliverableStateKey(settings);
	if (inCatalog(item)) return resolvedTestStateKey(settings);
	return settings.stateKey;
}

/**
 * The same "an item's workflow follows its type, or its ladder" rule `stateKeyFor` states
 * for the KEY, stated once more for the VALUE. Before these two existed, the chip and the
 * menu each hand-wrote the same ternary — two copies of one rule is how they came to
 * disagree in the first place, and it is why a third workflow needed exactly two edits.
 *
 * The pair is returned together so both halves come from ONE decision: a caller that needs
 * only the value still gets the value of the workflow whose done flag it would have got.
 */
export function ownWorkflowReading(item: BacklogItem): WorkflowReading {
	if (isDeliverableType(item.typeName)) return { value: item.deliverableStateValue, done: item.deliverableDone };
	if (inCatalog(item)) return { value: item.testStateValue, done: item.testDone };
	return { value: item.stateValue, done: item.done };
}
```

Add `inCatalog` to the existing `./itemTypes` import and `resolvedTestStateKey` to the `./optionalProperties` import.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run test/domain/testLadder.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the whole check**

Run: `npm run check`
Expected: PASS. Any fixture built by spreading `defaultSettings()` will now be rejected by `settingsInconsistency` if it sets `states` without `testStates` — build fixtures through `resolveSettings` or `settingsWith`, which is what the error message says.

- [ ] **Step 7: Commit**

```bash
git add src/domain/readItems.ts src/domain/board.ts test/domain/testLadder.test.ts
git commit -m "Follow an item's ladder to its workflow, not only its type"
```

---

### Task 4: The catalog's own state vocabulary

**Files:**
- Modify: `src/domain/vocabulary.ts` (`VocabularySource`, `collectObservedTestStates`)
- Modify: `src/domain/model.ts` (`vocabularyOf` and its two call sites in `projectionForest` and `buildModel`)
- Test: `test/view/testCatalog.test.ts`

**Interfaces:**
- Consumes: `item.testStateValue` (Task 3), `settings.testDoneValues` (Task 1).
- Produces: `collectObservedTestStates(all, settings): string[]`; `vocabularyOf(items, settings, catalog: boolean)` — the third parameter says which workflow this population's `observedStates` comes from.

- [ ] **Step 1: Write the failing test**

Add to `test/view/testCatalog.test.ts`, inside the `the catalog and the plan share a model and divide it` describe block:

```ts
	it('offers the TEST workflow’s observed states in the catalog and the plan’s in the plan', () => {
		// Both directions in one fixture, because a shared list satisfies either alone.
		const vault = bothFamilies();
		vault.addFile('Ready case.md', {
			frontmatter: { type: 'Test case', order: 40, testStatus: 'Approved' },
			parentLink: 'Suite',
		});
		vault.addFile('Live PBI.md', {
			frontmatter: { type: 'PBI', order: 40, status: 'Shipping' },
			parentLink: 'Feature',
		});
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			testStateProperty: 'note.testStatus',
		});
		clickExpandAll(containerEl);
		expect(stateOffers(containerEl, 'A PBI')).toContain('Shipping');
		expect(stateOffers(containerEl, 'A PBI')).not.toContain('Approved');
		catalog(containerEl);
		expect(stateOffers(containerEl, 'Case')).toContain('Approved');
		expect(stateOffers(containerEl, 'Case')).not.toContain('Shipping');
	});
```

And add this helper beside `assigneeOffers` near the top of the file:

```ts
/** The values `Set state` offers on one row. */
function stateOffers(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const sub = Menu.lastShown?.item('Set state')?.submenu;
	return (sub?.items ?? []).map((mi) => mi.titleText).filter((t): t is string => typeof t === 'string');
}
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/testCatalog.test.ts -t "TEST workflow’s observed states"`
Expected: FAIL — the catalog offers the plan's states.

- [ ] **Step 3: Add the collector**

In `src/domain/vocabulary.ts`, add `ladder: string[];` and `testStateValue: string | null;` to `VocabularySource`, import `inCatalog` from `./itemTypes` beside `isDeliverableType`, and add beside `collectObservedDeliverableStates`:

```ts
/**
 * First occurrence of every TEST workflow state value, sorted the way the other two sort
 * their own: open states alphabetically, then done ones.
 *
 * Scoped by `inCatalog` BEFORE the first-seen walk, exactly as the Deliverable collector
 * scopes by type and for a reason that bites harder here — the test key is SHARED with the
 * requirements property by default, so without the filter every plan row's ordinary status
 * would join the catalog's vocabulary. Redundant for the one caller that has it today,
 * whose population is catalog members and context rows and nothing else, and still where
 * the correctness lives: a collector is correct over the list it is handed or it is correct
 * by luck.
 */
export function collectObservedTestStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const tests = all.filter((item) => inCatalog(item));
	const values = firstSeen(tests, (item) => (item.testStateValue === null ? [] : [item.testStateValue]));
	return sortOpenThenDone(values, settings.testDoneValues);
}
```

- [ ] **Step 4: Let a population say which workflow its states come from**

In `src/domain/model.ts`, add `collectObservedTestStates` to the `./vocabulary` import, and change `vocabularyOf`:

```ts
function vocabularyOf(
	items: BacklogItem[],
	settings: BacklogSettings,
	catalog: boolean,
): Pick<ProjectionPopulation, 'observedStates' | 'observedHorizons' | 'observedTags' | 'observedAssignees'> {
	return {
		// WHICH workflow, asked of the population rather than of each item: a population is
		// homogeneous by membership, and the done list a state menu sorts by is the
		// population's while the value read is the item's. Supplied by `projectionForest`'s
		// two call sites, which are the two places that already know which projection they
		// are computing.
		observedStates: catalog ? collectObservedTestStates(items, settings) : collectObservedStates(items, settings),
		observedHorizons: collectObservedHorizons(items),
		observedTags: collectObservedTags(items),
		observedAssignees: collectObservedAssignees(items),
	};
}
```

Add a `catalog: boolean` parameter to `projectionForest` after `member`, pass it through to its `vocabularyOf` call, and update its two call sites in `buildModel`:

```ts
		catalog: projectionForest(roots, inCatalog, settings, true),
```

```ts
	const plan = projectionForest(focusRoots, (item) => !inCatalog(item), settings, false);
```

And the plan's own vocabulary line in `rest`:

```ts
		...vocabularyOf(items.filter((item) => !inCatalog(item)), settings, false),
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run test/view/testCatalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the whole check and commit**

```bash
npm run check
git add src/domain/vocabulary.ts src/domain/model.ts test/view/testCatalog.test.ts
git commit -m "Collect the catalog's states from the test workflow"
```

---

### Task 5: Writing a test's state

**Files:**
- Modify: `src/domain/writePlan.ts` (`ItemWrite` fields, `computeTestStateWrites`)
- Modify: `src/storage/frontmatter.ts` (`applyInto`)
- Test: `test/view/testCatalog.test.ts`

**Interfaces:**
- Consumes: `resolvedTestStateKey` (Task 1), `ownWorkflowReading` (Task 3).
- Produces: `ItemWrite.testState?: string` and `ItemWrite.removeTestStateKey?: boolean`; `computeTestStateWrites(item: BacklogItem, state: string | null): ItemWrite[]`.

- [ ] **Step 1: Write the failing test**

Add to `test/view/testCatalog.test.ts`:

```ts
	it('writes a catalog row’s state to the TEST key and leaves the plan’s alone', async () => {
		const vault = bothFamilies();
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			testStateProperty: 'note.testStatus',
			testStateValues: 'Draft, Ready, Approved',
		});
		catalog(containerEl);
		rowByTitle(containerEl, 'Case').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Ready')?.clickHandler?.();
		await flush();
		expect(vault.fm('Case.md')['testStatus']).toBe('Ready');
		expect(vault.fm('Case.md')['status']).toBeUndefined();
	});
```

Add `flush` to the imports from `../helpers/view`.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/testCatalog.test.ts -t "writes a catalog row"`
Expected: FAIL — the write lands on `status`.

- [ ] **Step 3: Add the write fields and the planner**

In `src/domain/writePlan.ts`, add to `ItemWrite` beside the Deliverable pair:

```ts
	/** The test workflow's own state to set; absent means leave it alone. */
	testState?: string;
	/** Remove the test workflow's state key entirely — absence is what untriaged means. */
	removeTestStateKey?: boolean;
```

And beside `computeDeliverableStateWrites`:

```ts
/**
 * Everything ONE test-workflow state change writes. No stamp logic, for the reason the
 * Deliverable's has none and one more here: this epic records no results, so a case's state
 * is what it IS rather than when it ran, and a started/finished date would be a claim about
 * a run.
 */
export function computeTestStateWrites(item: BacklogItem, state: string | null): ItemWrite[] {
	if (sameValue(item.testStateValue, state)) return [];
	return [state === null ? { file: item.file, removeTestStateKey: true } : { file: item.file, testState: state }];
}
```

- [ ] **Step 4: Apply it at the write boundary**

In `src/storage/frontmatter.ts`, in `applyInto`, beside the Deliverable's two lines:

```ts
	// The resolved key, never the raw `testStateKey`: sharing the requirements property by
	// fallback is the default configuration, and the reader uses the same resolution.
	const testStateKey = resolvedTestStateKey(settings);
	if (write.removeTestStateKey && testStateKey) delete fm[testStateKey];
	else if (write.testState !== undefined && testStateKey) setOwn(fm, testStateKey, write.testState);
```

Import `resolvedTestStateKey` beside the existing `resolvedDeliverableStateKey` import. **Never write to an unconfigured key** — the `&& testStateKey` guard is that rule, and it is the same shape the state key already uses.

- [ ] **Step 5: Route the menu's pick**

In `src/view/interactions/menu.ts`, in `stateChoices`, replace the `values` assignment with:

```ts
	const values = deliverableOrTestValues(host, item, model) ?? stateMenuValues(host.settings, model ? rowVocabulary(model, item).observedStates : []);
```

and add above it:

```ts
/**
 * A secondary workflow's own offered values, or null when this row is on neither. Both are
 * `menuValues` over that workflow's declared list, its done values and its own observed
 * vocabulary — the requirements list would be a third opinion about a property it is not
 * even read through.
 */
function deliverableOrTestValues(host: BacklogViewHost, item: BacklogItem, model: BacklogModel | null): string[] | null {
	if (!model) return null;
	if (isDeliverableType(item.typeName)) return deliverablesWorkflow(model, host.settings).values;
	if (!inCatalog(item)) return null;
	return menuValues(host.settings.testStates, host.settings.testDoneValues, rowVocabulary(model, item).observedStates);
}
```

In `chooseState`, add the test branch immediately after the Deliverable one, since a catalog row has no board to move on:

```ts
	if (inCatalog(item)) return void host.applySafely(computeTestStateWrites(item, choice.state));
```

Add `inCatalog` to the `../../domain/itemTypes` import, `menuValues` to the `../../domain/settings` import, and `computeTestStateWrites` to the `../../domain/writePlan` import.

- [ ] **Step 6: Add the two assertions that follow WITHOUT being written**

The chip and `pbl-done` read `stateKeyFor` and `ownWorkflowReading`, so Task 3 already made
them honour the test workflow — which means nothing here proves it and a later refactor could
take it back silently. Add to `test/view/testCatalog.test.ts`:

```ts
	it('draws a catalog row’s chip from the test workflow, and marks it done by ITS done values', () => {
		const vault = bothFamilies();
		vault.addFile('Signed off.md', {
			frontmatter: { type: 'Test case', order: 40, status: 'New', testStatus: 'Approved' },
			parentLink: 'Suite',
		});
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			testStateProperty: 'note.testStatus',
			testDoneValues: 'Approved',
			order: ['note.testStatus'],
		});
		catalog(containerEl);
		const row = rowByTitle(containerEl, 'Signed off');
		expect(row.querySelector('.pbl-state-chip')?.textContent).toBe('Approved');
		// Done by the TEST workflow's own list, while its `status: New` says otherwise.
		expect(row.hasClass('pbl-done')).toBe(true);
		// And still nothing HIDES: the catalog withholds the completed toggle and opts out
		// of the computation behind it, which having a workflow does not change.
		expect(titlesOf(containerEl)).toContain('Signed off');
	});
```

If the chip does not render, the property must be a visible column — that is what the
`order` option above is for; a chip is drawn by a column the Base shows.

- [ ] **Step 7: Run the tests and verify they pass**

Run: `npx vitest run test/view/ test/storage/`
Expected: PASS.

- [ ] **Step 8: Run the whole check and commit**

If `menu.ts` exceeds its 400-line cap, move `deliverableOrTestValues` into `src/view/projection.ts` — it is a question about which population a row belongs to, which is that module's subject — rather than creating a new file.

```bash
npm run check
git add src/domain/writePlan.ts src/storage/frontmatter.ts src/view/interactions/menu.ts test/view/testCatalog.test.ts
git commit -m "Write a catalog row's state through the test key"
```

---

### Task 6: The Test management options group

**Files:**
- Modify: `src/domain/viewOptions.ts` (`testManagementGroup`, and its entry in the groups list)
- Test: `test/domain/viewOptions.test.ts`

**Interfaces:**
- Consumes: nothing beyond the option keys Task 1 already resolves — `testStateProperty`, `testStateValues`, `testDoneValues`.
- Produces: nothing later tasks read.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/viewOptions.test.ts`:

```ts
it('exposes a Test management group with its own state property, states and done values', () => {
	const groups = getViewOptions();
	const group = groups.find((g) => 'displayName' in g && g.displayName === 'Test management');
	if (!group || !('items' in group)) throw new Error('Test management group missing');
	const keys = group.items.map((item) => item.key);
	expect(keys).toEqual(['testStateProperty', 'testStateValues', 'testDoneValues']);
});

it('gives the test workflow no per-state colour boxes', () => {
	// Not an omission: `stateColors` is keyed by the state VALUE, so a second box for a
	// state both workflows spell the same way would be two controls over one key — and a
	// test-only state takes its positional colour rather than an override.
	const groups = getViewOptions(
		new FakeViewConfig({ testStateValues: 'Draft, Ready, Approved' }) as unknown as BasesViewConfig,
	);
	const group = groups.find((g) => 'displayName' in g && g.displayName === 'Test management');
	if (!group || !('items' in group)) throw new Error('Test management group missing');
	expect(group.items.some((item) => item.key.startsWith('stateColor.'))).toBe(false);
});
```

This is the exact shape of the `exposes a Deliverables group…` test already in that file, so read it first and place these beside it.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/domain/viewOptions.test.ts -t "group of its own"`
Expected: FAIL — no such group.

- [ ] **Step 3: Add the group**

In `src/domain/viewOptions.ts`, beside `deliverablesGroup`:

```ts
/**
 * The test workflow's own group — the Deliverables group's mirror MINUS its colour
 * section, which is a decision rather than an omission: `stateColors` is keyed by the state
 * VALUE, so a test state spelled like a requirements or Deliverable state already picks up
 * that state's colour and would be two controls over one key. What a test-ONLY state gives
 * up is the override; it takes the positional colour its place in this list earns, which is
 * what every state had before per-state colours existed.
 */
function testManagementGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Test management',
		items: [
			optionalPropertyOption('testState', 'Test state property'),
			{
				type: 'text',
				key: 'testStateValues',
				displayName: 'Test workflow states (in order)',
				default: '',
				// About whether a case is fit to be WALKED. Deliberately not the plan's
				// New/Active/Done, and deliberately not Pass/Fail — a result, which this epic
				// refuses. A placeholder suggests and configures nothing.
				placeholder: 'Draft, Ready, Approved',
			},
			{
				type: 'text',
				key: 'testDoneValues',
				displayName: 'Test states that count as done',
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
		],
	};
}
```

Add `testManagementGroup()` to the list of groups, immediately after `deliverablesGroup(settings)`.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run test/domain/viewOptions.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate the backfill, which this group is what makes reachable**

Exposing the picker is what turns a latent defect into a shipped one, so it is fixed in the
same task rather than left for the final review. `missingKeyStubs`
(`src/domain/writePlan.ts`) walks `OPTIONAL_FIELDS` and stubs every field's key onto every
item; `deliverableState` has a type gate and `testState` has none. With a distinct
`testStateProperty` configured, pressing **Assign missing properties** would write an empty
test-state key onto every Epic, PBI and Task in the base.

Write the failing test first, in `test/domain/writePlan.test.ts` beside the existing
Deliverable-gate test (find it with `grep -n "deliverableState" test/domain/writePlan.test.ts`
and match its shape):

```ts
it('stubs the test state on a catalog member and on nothing else', () => {
	// The Deliverable gate's mirror, and the ladder rather than a type name for the reason
	// every other membership test here uses it: a `Task` under a `Test case` is a catalog
	// member and a type-name gate would miss it.
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
	vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
	const settings = settingsWith({ testStateKey: 'testStatus' });
	const model = buildModel(vault.app, vault.entries(), settings);
	const stubsFor = (path: string) =>
		computeInitWrites(model, settings).find((w) => w.file.path === path)?.stubs ?? [];
	expect(stubsFor('Case.md')).toContain('testState');
	expect(stubsFor('Test task.md')).toContain('testState');
	expect(stubsFor('Epic.md')).not.toContain('testState');
});
```

Run it, watch it fail on the Epic. Then add the gate in `missingKeyStubs`, immediately after
the `deliverableState` one:

```ts
		// The same rule as the Deliverable's above and the same reason, asked of the LADDER
		// rather than a type name: a test's state describes a test, and a `Task` under a
		// `Test case` is one while a `Task` under a PBI is not. Without this, binding the
		// property and pressing Assign missing properties stubs an empty test-state key onto
		// every plan item in the base — which is what exposing the picker makes reachable,
		// so the gate ships with the picker rather than after it.
		if (field === 'testState' && !inCatalog(item)) continue;
```

Import `inCatalog` from `./itemTypes` — `writePlan.ts` already imports from that module.

Run the test again and confirm it passes.

- [ ] **Step 6: Run the whole check and commit**

```bash
npm run check
git add src/domain/viewOptions.ts src/domain/writePlan.ts test/domain/viewOptions.test.ts test/domain/writePlan.test.ts
git commit -m "Give the test workflow its own options group, and gate its backfill"
```

---

### Task 7: Test case takes cyan

**Files:**
- Modify: `styles/badges.css`
- Test: `test/harness/harness.test.ts` (already asserts both badge classes render — read it, do not duplicate it)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**What is checkable and what is not:** nothing in the suite reads `styles/badges.css`, so the HUE itself has no automated check and must not grow a brittle one that asserts CSS text. What is checked is that both classes still render (`test/harness/harness.test.ts`) and that `badgeStyleFor` still maps the two type names (`test/view/manualTypes.test.ts`). The hue is a live-vault and browser-harness question — say so rather than claiming more.

- [ ] **Step 1: Change the hue and rewrite the two comments**

In `styles/badges.css`, replace the block that sets both test types to orange — its comment and both rules — with:

```css
/*
 * ELEVEN badges, still eight theme tokens, and this is where the pair-by-pair answer had to
 * become a rule: Idea/Task was one sharing decision taken alone, and two more taken the same
 * way is how Idea and Deliverable both reached for green on branches that could not see each
 * other. The rule: HUE IS IDENTITY, and where two types share one, the test axis below or
 * the icon separates them. Which pair shares is a decision recorded here, never "whichever
 * looked least crowded".
 *
 * A `Test suite` takes ORANGE, Epic's. An Epic is a root by POSITION in the plan and a suite
 * is a root by NATURE in the catalog, and the two populations are disjoint by construction
 * (`inCatalog`), so no screen draws both.
 *
 * A `Test case` takes CYAN, Milestone's, by the same standard — the one whose existing wearer
 * a test is least likely to sit beside. A `Milestone` is a marker: no rung, no children, no
 * parent, drawn as a line on the timeline, and never a catalog member. The two cannot meet
 * where a case is actually READ; they can meet in the plan tree, where a case appears only as
 * an advisory mis-drag.
 *
 * Nothing is minted here: both are Obsidian's own tokens, so the badges still track the
 * user's theme.
 */
.pbl-lvl-test-suite { --pbl-badge-rgb: var(--color-orange-rgb); }
.pbl-lvl-test-case { --pbl-badge-rgb: var(--color-cyan-rgb); }
```

Then extend the test-axis comment below it. Replace the sentence beginning *"The difference survives the hue being shared with Epic"* with:

```
 * The axis is LOAD-BEARING now rather than reinforcing. While both test types shared one hue
 * it merely backed up the icon; a `Test case` on cyan is the same hue as a `Milestone`, so
 * the edge is what says *test* before anything else is read — which is what keeps
 * "no two types are distinguishable by icon alone" true for both shared pairs.
```

Also update the older comment that says *"one pair has to share"* (above `.pbl-lvl-issue`) so it does not contradict the block above: change that clause to *"so some pairs share, and which pair is a decision rather than an oversight — the rule is stated with the test types below"*.

- [ ] **Step 2: Verify the stylesheet still assembles and every gate passes**

Run: `npm run check`
Expected: PASS. `styles-assemble.mjs` fails a partial over 400 lines or one no entry file imports — neither should change here.

- [ ] **Step 3: Look at it in the browser harness**

Run: `npm run harness`
Open the printed `file://` URL with `?view=catalog`, then again with `?theme=light`. Confirm the suite and the case now read as two colours and both still read as outlined. This answers layout and relative hierarchy only; **colour is not faithful here** (ADR 0020), so the live-vault check is still owed.

- [ ] **Step 4: Commit**

```bash
git add styles/badges.css
git commit -m "Give Test case its own hue, and state the sharing rule once"
```

---

### Task 8: The register

**Files:**
- Modify: `docs/requirements/A badge when the palette is full.md`
- Modify: `docs/requirements/Tests stay out of the plan.md`
- Modify: `docs/requirements/A projection for the tests.md`
- Modify: `src/domain/CLAUDE.md`, `src/view/CLAUDE.md`
- Create: `docs/requirements/A workflow for the tests.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing code reads.

**Why a new note and not only edits:** `docs-check.mjs` rule 7 requires every module in `src/` to be *specified* by a note's `## Where it lives` or an ADR's `## Decision`. No new module is created by this plan, so rule 7 is already satisfied — but the workflow is a feature nobody can find from the existing notes, and the two contradicted notes need a note to point AT.

- [ ] **Step 1: Write the new PBI note**

Create `docs/requirements/A workflow for the tests.md` with `type: PBI`, `parent: "[[A catalog of tests]]"`, a fresh `order` after the existing children, `status: Done`, `created: 2026-08-10`, `source: user request`. Follow the shape of `A badge when the palette is full.md` — a user story, a use-case table, a main flow, extensions, acceptance criteria, and a `## Where it lives` section naming every module Tasks 1–6 touched. Read `docs/README.md` first for the frontmatter the gate requires.

Run `node scripts/docs-check.mjs` after writing it; it validates the hierarchy, sibling orders, every wikilink and every source path the note names.

- [ ] **Step 2: Correct the two contradicted notes**

In `A badge when the palette is full.md`, main flow step 2 currently says both test types take **one** borrowed hue. Rewrite it to say they take two, keeping the note's own criterion (*the one whose existing wearer a test is least likely to sit beside*) and its guarantee (*no shipped type changes colour*), and record what changed: the sharing is now three pairs, and the axis moved from reinforcing to load-bearing.

In `Tests stay out of the plan.md`, extension 4a and the completed-toggle paragraph turn on *"this epic gives tests no workflow"*. Rewrite both so the CONCLUSION survives on the new reason: a test's state is still never read by a projection it is excluded from, still mints no plan board column, and still cannot appear in a plan row's Set state menu — because the workflows are separate, not because there is no second workflow.

In `A projection for the tests.md`, correct any sentence claiming tests have no states.

- [ ] **Step 3: Correct the layer guides**

In `src/view/CLAUDE.md`, the `hidesCompleted` paragraph says *"the test catalog has no workflow at all — this increment gives tests no states, so there is no completion for a toggle to hide"*. The catalog still withholds the toggle and still hides nothing; rewrite the REASON, which is now a decision rather than an absence: tests have states, the catalog does not hide by them, and `3c`'s rollup cost is why.

In `src/domain/CLAUDE.md`, add the workflow-selection rule to the TWO LADDERS bullet: an item's workflow follows its type or its ladder, the two selectors are disjoint by construction, and both are stated in `stateKeyFor` and `ownWorkflowReading` and nowhere else.

- [ ] **Step 4: Run the register gate and the whole check**

Run: `npm run check`
Expected: PASS, including `✓ register and ADRs consistent`.

- [ ] **Step 5: Commit**

```bash
git add docs/ src/domain/CLAUDE.md src/view/CLAUDE.md
git commit -m "Record the test workflow, and correct what it makes false"
```

---

### Task 9: Changelog and the live-vault handover

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/requirements/Plugin Features Smoke Test.md` (or the smoke-test note that carries the existing test-catalog checklist — find it with `grep -rln "typeFolder.test suite" docs/`)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Add the `[Unreleased]` entries**

In `CHANGELOG.md`, under `## [Unreleased]`, add one line per user-visible change: the test workflow and its options group, and `Test case` taking its own colour. `test/release/changelogVersion.test.ts` checks the section structure — run it if unsure of the format.

- [ ] **Step 2: Add the two live-vault checks**

Add to the smoke-test checklist, beside the existing `typeFolder.test suite` question:

- Does the `Test management` group render correctly in Obsidian's own view-options pane, with its three controls and their placeholders?
- With a real theme, do a `Test suite` (orange) and a `Test case` (cyan) read as two colours, and do both still read as tests rather than as an Epic and a Milestone?

Both are stated as open questions rather than assumed. Neither the suite nor the browser harness can answer them — the harness is explicitly not evidence about colour (ADR 0020).

- [ ] **Step 3: Run the whole check and commit**

```bash
npm run check
git add CHANGELOG.md docs/
git commit -m "Changelog, and the two checks only a vault can make"
```

- [ ] **Step 4: Push and let CI run both platforms**

```bash
git push -u origin claude/test-management-epic-increment-wuwlva
```

Watch both `verify` legs. Paths and line endings are the only things that differ between Ubuntu and Windows, and both have already produced a defect this repository could not see.


---

### Task 10: A subtree refresh forgets only the rows it detached

**Files:**
- Modify: `src/view/render/rows.ts` (`refreshRowChildren`, `forgetSubtree`)
- Test: `test/view/testCatalog.test.ts`

**Interfaces:**
- Consumes: `projectionMember` from `src/view/projection.ts` (already exported).
- Produces: nothing later tasks read.

**Why this is a task and not a review note:** found on the branch by an automated PR
reviewer, independent of the workflow feature, and it is the same defect family as the four
`filterState` rounds — a walk over RAW children where it should follow the edges this
projection draws.

`refreshRowChildren` detaches a row's rendered child group and calls
`forgetSubtree(ctx.rows, item.children)` to drop those rows from the `rowEls` index. But
`item.children` is the RAW child list, and `forgetSubtree` recurses through all of it —
including a non-member child whose own subtree holds a PROMOTED member rendered elsewhere.
In `Epic → Feature` and `Epic → Test case → PBI`, the plan draws the `PBI` as an independent
root; collapsing or expanding the Epic walks into the hidden `Test case` and deletes that
`PBI` from `rowEls` while its DOM row is still on screen. Everything that reaches a row by
lookup then fails for it: selection cannot mark or announce it, and a keyboard-opened menu
loses its anchor.

- [ ] **Step 1: Write the failing test**

Add to `test/view/testCatalog.test.ts`:

```ts
	it('keeps a promoted root in the row index when its raw ancestor is collapsed', () => {
		// `Epic → Feature` and `Epic → Test case → PBI`. The PBI is drawn as a promoted plan
		// root; collapsing the Epic detaches only the Feature's group, so the PBI's row stays
		// on screen and must stay reachable by lookup. Asserted through SELECTION, which is
		// what reads `rowEls` — a DOM check would pass while the index was empty.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Bridge case.md', { frontmatter: { type: 'Test case', order: 20 }, parentLink: 'Epic' });
		vault.addFile('Deep PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Bridge case' });
		const { containerEl, view } = makeView(vault);
		clickExpandAll(containerEl);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature', 'Deep PBI']);

		// Collapse the Epic through its own chevron — the real path `refreshRowChildren` runs on.
		rowByTitle(containerEl, 'Epic').querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Deep PBI']);

		// The promoted root is still drawn, so it must still be selectable.
		view.selectPath('Deep PBI.md');
		expect(rowByTitle(containerEl, 'Deep PBI').hasClass('pbl-selected')).toBe(true);
	});
```

If `selectPath` is not the view's public selection entry point, find the one the other
selection tests in `test/view/` drive and use that instead — assert through whatever marks
`pbl-selected`, never by reading the index directly.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/testCatalog.test.ts -t "promoted root in the row index"`
Expected: FAIL — the row is not marked selected, because its `rowEls` entry was deleted.

- [ ] **Step 3: Forget only along the edges this projection draws**

In `src/view/render/rows.ts`, give `forgetSubtree` the projection's membership predicate and
recurse only through drawn children — the same guard `projectionForest`'s depth walk and
`indexMatches`'s subtree walk already use, for the same reason:

```ts
/**
 * Drop a removed subtree from the row index so stale elements can't be found — along the
 * edges this projection DRAWS, never the raw child list.
 *
 * A non-member's subtree can hold a member this projection renders as a promoted ROOT,
 * whose row is somewhere else entirely and is not being detached. Walking raw children
 * deletes that row's index entry while its DOM stays on screen, and everything that reaches
 * a row by lookup then fails for it silently: selection cannot mark or announce it, and a
 * keyboard-opened menu loses its anchor.
 */
function forgetSubtree(rows: Map<string, HTMLElement>, items: BacklogItem[], member: (item: BacklogItem) => boolean): void {
	for (const item of items) {
		if (!member(item)) continue;
		rows.delete(item.file.path);
		forgetSubtree(rows, item.children, member);
	}
}
```

And at its one call site in `refreshRowChildren`:

```ts
		forgetSubtree(ctx.rows, item.children, projectionMember(ctx.host.projection));
```

Add `projectionMember` to the existing `../projection` import in that file.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run test/view/`
Expected: PASS.

- [ ] **Step 5: Watch it fail without the fix**

Revert Step 3's guard, re-run the one test, confirm RED, restore. The comment states a rule,
so a test has to hold it.

- [ ] **Step 6: Run the whole check and commit**

```bash
npm run check
git add src/view/render/rows.ts test/view/testCatalog.test.ts
git commit -m "Forget a detached subtree along drawn edges, not raw children"
```


---

### Task 11: A sibling drop's no-op is asked of the drawn order

**Files:**
- Modify: `src/domain/dropTargets.ts` (`dropTargetFor`'s no-op check, and `siblingPosition`'s comment)
- Modify: `src/view/interactions/dragDrop.ts` (the one `dropTargetFor` call site)
- Test: `test/view/testCatalog.test.ts`

**Interfaces:**
- Consumes: `projectionMember` from `src/view/projection.ts`, `projectionPopulation` likewise (both already exported and already used by `dragDrop.ts`).
- Produces: `dropTargetFor(model, item, zone, dragged, member)` — one added parameter, `member: (item: BacklogItem) => boolean`.

**Why:** this is the second site of the bug Task-independent commit `14be727` fixed for the
root strip, found by an automated PR reviewer. The register already carries the general form:
*a rule about `realRoots` is a rule about ranking, and any other question asked of it is asked
of the wrong list.* `dropTargetFor` still asks its NO-OP question of the real sibling list.

With real roots `Epic A, Test suite, Epic B` the plan draws `Epic A, Epic B`. Dragging
`Epic A` and dropping it *before* `Epic B` changes nothing on either screen — but the real
list puts the insert index at 1 and the dragged item's current index at 0, so the drop is
treated as a move: it rewrites `order` and spends the undo slot. The same happens in a mixed
child group.

`siblingPosition`'s own comment states the assumption that fails — *"its position among the
real group is the position among the visible one"* — which is only true when the two
projections do not interleave. Correct that sentence in the same commit.

- [ ] **Step 1: Write the failing test**

Add to `test/view/testCatalog.test.ts`:

```ts
	it('treats a drop between visually adjacent roots as the no-op it looks like', () => {
		// Real roots interleave: Epic A, Suite, Epic B. The plan draws A then B with nothing
		// between them, so dropping A before B moves nothing on either screen — and must not
		// rewrite an order or spend the undo slot to say so.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 30 } });
		const { view } = makeView(vault);
		const model = view.model;
		const get = (path: string) => {
			const item = model?.byPath.get(path);
			if (!item) throw new Error(`no item ${path}`);
			return item;
		};
		const plan = projectionMember('tree');
		expect(dropTargetFor(model!, get('Epic B.md'), 'before', get('Epic A.md'), plan)).toBeNull();
		// The mirror in the catalog is vacuous here (one suite), so assert the other direction
		// of the same rule instead: a drop that DOES move the row is still offered.
		expect(dropTargetFor(model!, get('Epic A.md'), 'before', get('Epic B.md'), plan)).not.toBeNull();
	});
```

Import `dropTargetFor` from `../../src/domain/dropTargets` and `projectionMember` from
`../../src/view/projection` at the top of the file.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/testCatalog.test.ts -t "visually adjacent roots"`
Expected: FAIL — the first assertion returns a target instead of null.

- [ ] **Step 3: Ask the no-op of the drawn sequence**

In `src/domain/dropTargets.ts`, add the parameter and translate both sides of the comparison
into drawn terms:

```ts
export function dropTargetFor(
	model: BacklogModel,
	item: BacklogItem,
	zone: DropZone,
	dragged: BacklogItem,
	member: (item: BacklogItem) => boolean,
): DropTarget | null {
```

and replace the no-op block with:

```ts
	// Dropping into the slot the item already occupies is a no-op — unless the
	// drop would clear a stale parent link, which is a real change.
	//
	// **Asked of the DRAWN order, while the rank below is still computed from the real
	// group.** Two questions over two lists, and the same split `rootDropTarget` already
	// makes: a sibling group can interleave the projections (real roots `Epic A`,
	// `Test suite`, `Epic B` draw as `Epic A`, `Epic B` in the plan), so a drop that moves
	// the row past nothing anyone can see reads as a move on the real indices. It then
	// rewrites `order` and spends the undo slot with both screens unchanged. With no
	// interleaving the two readings coincide exactly, which is why this is a correction
	// rather than a behaviour change for every existing base.
	if (position.parent === dragged.parent && !clearsStaleLink(position.parent, dragged)) {
		const fullList = position.parent ? position.parent.children : model.realRoots;
		const drawnIndex = fullList.filter(member).indexOf(dragged);
		const drawnInsert = position.siblings.slice(0, position.insertIndex).filter(member).length;
		if (drawnInsert === drawnIndex) return null;
	}
```

Then correct `siblingPosition`'s comment. The sentence *"The item is a real root here (a
promoted one returned above), so its position among the real group is the position among the
visible one, read against the neighbours that actually decide the number"* claims an
equivalence that fails exactly when the projections interleave. Rewrite the tail to say what
is true: the real group is what decides the NUMBER, and the drawn order is what decides
whether the move is worth making — the caller's no-op check above asks that separately.

- [ ] **Step 4: Pass the predicate at the call site**

In `src/view/interactions/dragDrop.ts`, find the `dropTargetFor(` call and add
`projectionMember(this.host.projection)` as its fifth argument. `projectionMember` is
already imported there if `projectionPopulation` is; add it to that import otherwise.

Update every other `dropTargetFor` call — including in `test/domain/dropTargets.test.ts` —
to pass a predicate. For the existing domain tests the plan's projection is the right one:
`projectionMember('tree')`, or `() => true` where the fixture has no catalog members and the
test is about something else. Prefer `projectionMember('tree')` so the tests exercise the
real predicate.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run test/view/ test/domain/`
Expected: PASS. Every pre-existing drop test must still pass unchanged in its assertions —
if one flips, the translation is wrong, not the test.

- [ ] **Step 6: Watch it fail without the fix**

Revert Step 3's two lines to the original `fullList.indexOf(dragged) === position.insertIndex`,
re-run the one test, confirm RED, restore.

- [ ] **Step 7: Run the whole check and commit**

```bash
npm run check
git add src/domain/dropTargets.ts src/view/interactions/dragDrop.ts test/
git commit -m "Ask a sibling drop's no-op of the drawn order, not the ranking group"
```


---

### Task 12: The generated README documents the test workflow

**Files:**
- Modify: `src/domain/backlogReadme.ts` (`fieldRows`)
- Test: `test/domain/backlogReadme.test.ts`

**Interfaces:**
- Consumes: `resolvedTestStateKey` (Task 1), `settings.testStateKey`.
- Produces: nothing later tasks read.

**Why:** found on the branch by an automated PR reviewer, and it is a gap in this plan
rather than in any task's execution — no task extended the generator. **Write backlog
readme** emits the frontmatter contract an outside editor follows. With a distinct
`testStateProperty` configured, that contract omits the property catalog rows read and
write, so someone editing notes by hand uses the wrong key.

**Scope decision, made here so the implementer does not have to guess:** mirror the
DELIVERABLE workflow exactly — a row in `fieldRows`, and no state table of its own.
`stateSection` today returns early unless `settings.stateKey` is set and describes only the
requirements vocabulary; the Deliverable workflow has a field row and no table either. Adding
a table for the test workflow alone would make the document describe two of three workflows
inconsistently. Matching the Deliverable is the consistent answer, and the asymmetry across
all three is a separate question this task does not open.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/backlogReadme.test.ts`, beside the existing Deliverable field-row tests
(find them with `grep -n "Deliverable" test/domain/backlogReadme.test.ts` and match their
shape and their way of building settings):

```ts
it('documents a test state property of its own, and never twice when it is shared', () => {
	// Shared by fallback is the DEFAULT configuration, so the row must not appear twice —
	// the same rule `fieldRows` already keeps for the Deliverable's key, and the reason it
	// asks the RESOLVED key rather than the raw option.
	const shared = settingsWith({ stateKey: 'status' });
	const sharedDoc = backlogReadme(shared, [], 0).join('\n');
	expect(sharedDoc.match(/\| `status` \|/g)).toHaveLength(1);

	// Its own key: its own row, naming what carries it.
	const own = settingsWith({ stateKey: 'status', testStateKey: 'testStatus' });
	const ownDoc = backlogReadme(own, [], 0).join('\n');
	expect(ownDoc).toContain('`testStatus`');
	expect(ownDoc).toContain('on a test');
});
```

Read the file first: `backlogReadme`'s real signature and the settings helper the
neighbouring tests use may differ from the sketch above — match what is actually there
rather than the shape written here, and keep the two assertions.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/domain/backlogReadme.test.ts -t "test state property"`
Expected: FAIL — no `testStatus` row is emitted.

- [ ] **Step 3: Add the row, mirroring the Deliverable's**

In `fieldRows`, after the `deliverableKey && !sharedStateKey` block:

```ts
	// The test workflow's key, on exactly the Deliverable's terms above and for the same
	// two reasons. The RESOLVED key, because sharing the requirements property is this
	// workflow's DEFAULT rather than an edge case — asking the raw option would document
	// the shipped configuration as a property nobody has. And a row of its own only where
	// it IS its own property, because a second row for one key would have the table
	// contradicting itself about how many properties a note carries.
	const testKey = resolvedTestStateKey(settings);
	if (testKey && testKey !== settings.stateKey) {
		const relation = settings.stateKey ? " — separate from the requirements workflow's" : '';
		rows.push(`| ${cell(testKey)} | Optional, on a test | The test workflow's own state${relation} |`);
	}
```

The shared case needs no row of its own, but the requirements row above should say so, the
way it already does for the Deliverable. Extend that row's `alsoDeliverable` clause to name
whichever secondary workflows actually share the key — read the existing clause and widen it
without changing what it says when only the Deliverable shares.

Import `resolvedTestStateKey` from `./optionalProperties`, beside the existing
`resolvedDeliverableStateKey` import.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run test/domain/backlogReadme.test.ts`
Expected: PASS. Existing Deliverable assertions must be unchanged — if one flips, the
widened clause is wrong.

- [ ] **Step 5: Run the whole check and commit**

`npm run check` in the FOREGROUND. The register gate reads this generator's output, so a
wording change can fail `docs`.

```bash
npm run check
git add src/domain/backlogReadme.ts test/domain/backlogReadme.test.ts
git commit -m "Document the test workflow in the generated README"
```
