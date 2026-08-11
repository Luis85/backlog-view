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

- [ ] **Step 3: Correct the layer guides AND the source docstring that says the same thing**

Two places assert that tests have no states, and the SOURCE one matters more because a
maintainer reads it before the guide:

- `src/view/projection.ts`, the docstring above `hidesCompleted` (around line 52), says the
  catalog "has no workflow at all — this increment gives tests no states, so there is no
  completion for a toggle to hide". False now. An automated reviewer flagged exactly this and
  named the risk precisely: leaving it invites a future maintainer to *enable* the filtering,
  since the stated reason for withholding it has evaporated.
- `src/view/CLAUDE.md`, the `hidesCompleted` paragraph, says the same thing.

Rewrite both to the decision that actually holds: tests DO have states and a done flag, a done
test styles its row (`pbl-done` via `ownWorkflowReading`), and the catalog still hides nothing
and shows no rollups — because `assignAll` counts a child only where child and parent are both
plan rows, so there is no subtree completion to hide by. That is extension 3c's accepted cost,
not an absence of states. Verify the `pbl-done` half against `src/view/render/rows.ts` before
writing it rather than repeating this sentence.

Also correct any sentence in `src/domain/CLAUDE.md` claiming the catalog has no workflow.

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


---

### Task 13: The catalog draws no rollup column

**Files:**
- Modify: `src/view/render/columns.ts` (the rollup header, the meta cell, and the reserved width)
- Test: `test/view/testCatalog.test.ts` or `test/view/testCatalogState.test.ts`, whichever has room under the 450-line cap

**Interfaces:**
- Consumes: `treeShaped` / the projection predicates in `src/view/projection.ts`.
- Produces: nothing later tasks read.

**Why:** found on the branch by an automated PR reviewer. The catalog reuses `renderTree`,
so it inherits the rollup header and the `.pbl-meta-col` cell whose gates ask only
`settings.stateKey` and `settings.showCounts`. But the model deliberately gives catalog rows
**no** rollups — `assignAll` counts a child only when the child and the parent are both plan
rows, which is extension 3c in `docs/requirements/Tests stay out of the plan.md`, an accepted
cost rather than an oversight. So with a state property configured or Show counts on, the
catalog draws a `Progress` / `Items` header over a column that is empty on every row, and
reserves its width — shrinking every test title for nothing.

This is the register's own rule read in the other direction: *a projection opting out of a
feature opts out of the computation, not just the button.* Here the computation was opted out
of and the control was left drawing. Both directions are the same rule and it has now been
missed once each way.

**Do not "fix" it by giving the catalog rollups.** 3c priced that (a second projection-scoped
pass over the tree) and declined it; this task withholds the column, nothing more.

- [ ] **Step 1: Write the failing test**

```ts
	it('draws no rollup column, because it has no rollups to put in one', () => {
		// The catalog's rows carry no descendant counts by design (`Tests stay out of the
		// plan` 3c), so a Progress header over an empty column on every row is the control
		// outliving the computation behind it — and it costs every test title the width.
		const { containerEl } = makeView(bothFamilies(), { showCounts: true, stateProperty: 'note.status' });
		clickExpandAll(containerEl);
		// The plan draws it, which is what makes the assertion below about the CATALOG
		// rather than about the fixture.
		expect(containerEl.querySelector('.pbl-meta-col')).not.toBeNull();

		catalog(containerEl);
		expect(containerEl.querySelector('.pbl-meta-col')).toBeNull();
		expect(containerEl.querySelector('.pbl-cols')?.textContent ?? '').not.toContain('Progress');
	});
```

Read `render/columns.ts` first and confirm the class names and the header's text — the
selectors above are from the reviewer's description, not from a reading of the file. If the
header cell carries a different label or class, assert what is actually there. What must not
change is the shape: plan draws it, catalog does not.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/ -t "no rollup column"`
Expected: FAIL — the catalog renders the meta column and its header.

- [ ] **Step 3: Withhold the column in the catalog**

Find the three places that decide the rollup — the header, the per-row cell, and the width
reservation (`ROW_LEAD_WIDTH` / the `--pbl-meta-col` custom property or `renderAddSpacer`'s
equivalent). Gate all three on the projection, through a predicate in
`src/view/projection.ts` rather than a bare `projection === 'catalog'` comparison — a lint
rule (`no-restricted-syntax`) forbids that comparison outside that module, and the module's
own docstring explains why.

Add the predicate there beside `treeShaped` and `hidesCompleted`, in their voice:

```ts
/**
 * Whether this projection draws the rollup column. The catalog does not, and the reason is
 * the same one that withholds its completed toggle: it has nothing to put in it. `assignAll`
 * counts a child only where the child and the parent are both plan rows, so a suite's
 * descendant count is structurally zero — a `Progress` header over an empty column on every
 * row would be the control outliving the computation behind it, and would cost every test
 * title the width it reserves.
 */
export function hasRollup(projection: Projection): boolean {
	return projection !== 'catalog';
}
```

**All three gates or none.** A header withheld while the cells still render leaves unlabelled
boxes; cells withheld while the width is still reserved leaves the gap the reservation exists
to fill. `src/view/CLAUDE.md`'s column-fit section states why an end-anchored strip cannot
simply skip an element.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run test/view/`
Expected: PASS, including every existing column-fit test unchanged — those measure the plan
and must not move.

- [ ] **Step 5: Run the whole check and commit**

`npm run check` in the FOREGROUND.

```bash
npm run check
git add src/view/projection.ts src/view/render/columns.ts test/view/
git commit -m "Withhold the rollup column where there are no rollups"
```


---

### Task 14: The backfill stubs the state key an item's workflow actually uses

**Files:**
- Modify: `src/domain/writePlan.ts` (`missingKeyStubs`)
- Test: `test/domain/writePlanProperties.test.ts`

**Interfaces:**
- Consumes: `stateKeyFor` from `src/domain/board.ts`.
- Produces: nothing later tasks read.

**Why:** found on the branch by an automated PR reviewer as the mirror of Task 6's gate, and
it is **wider than reported**. `missingKeyStubs` gates `deliverableState` on the type and
`testState` on the ladder, but `state` — the requirements key — is gated on nothing. So
**Assign missing properties** stubs `settings.stateKey` onto every item, including ones whose
workflow never reads it:

- a `Test suite`, `Test case` or catalog `Task`, when `testStateProperty` names a distinct key;
- **a `Deliverable`, when `deliverableStateProperty` names a distinct key** — which is not new
  and predates this feature entirely. The reviewer saw only the catalog half; the Deliverable
  half has been there since that workflow shipped.

Both are the same defect: the stub is chosen by the FIELD's name rather than by whether this
item's workflow uses that key. `stateKeyFor(settings, item)` is the function that already
answers it.

**Do not delete the two existing gates.** They answer the opposite question — whether a
SECONDARY key belongs on this item — and this one answers whether the PRIMARY key does. Three
gates, three rules, each stated where it holds.

> **Countermanded during execution (2026-08-10).** This instruction cannot be carried out and
> still pass `npm run check`. The implementer reported it and the reviewer verified it
> independently: with all three gates written out, `npx fallow` reports `✗ 1 above threshold`
> and names `missingKeyStubs` under High complexity functions; unified to one
> `stateKeyFor`-driven lookup, `✗ 0`. The unification ships. What the paragraph above was
> protecting — three rules, not one blurred one — survives as the reason the unified gate is
> keyed on `stateKeyFor` alone and nothing else, so it is still one question asked once.
>
> Two consequences the review pinned down, recorded here because the shipped behaviour is not
> what this task's prose predicts. The unified gate narrows by KEY EQUALITY where the deleted
> gates narrowed by item CATEGORY, and those are not the same rule:
> - it is key equality that makes the SHIPPED DEFAULT correct — with both secondary keys unset
>   and falling back to `stateKey`, a category gate gives a `Deliverable` and a `Test case` no
>   `state` stub at all, so ✨ stops creating the very key those rows read;
> - and it widens where a secondary key is explicitly configured to the same string as another
>   workflow's key, which `configProblems` permits (`WORKFLOW_STATE_LABELS` exempts the three
>   workflow-state labels from the collision report). That plans a redundant stub for a key
>   another field in the same write already names — invisible at the vault, since `stubKeys`
>   dedupes and `applyInto` only writes an absent key.
>
> Both are pinned by tests rather than left to the reader.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/writePlanProperties.test.ts`, beside the two existing stub-gate tests
(read them first and match their shape):

```ts
it('stubs the requirements state only on items whose workflow reads it', () => {
	// Both secondary workflows on keys of their own, so neither a test nor a Deliverable
	// reads `status` — and a stub for it would be an empty property the row never uses.
	// The Deliverable half is not new: `state` has never had a membership gate.
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
	vault.addFile('Runbook.md', { frontmatter: { type: 'Deliverable', order: 30 } });
	const settings = settingsWith({
		stateKey: 'status',
		testStateKey: 'testStatus',
		deliverableStateKey: 'docStatus',
	});
	const model = buildModel(vault.app, vault.entries(), settings);
	const stubsFor = (path: string) =>
		computeInitWrites(model, settings).find((w) => w.file.path === path)?.stubs ?? [];
	expect(stubsFor('Epic.md')).toContain('state');
	expect(stubsFor('Case.md')).not.toContain('state');
	expect(stubsFor('Runbook.md')).not.toContain('state');
	// And each still gets its OWN workflow's key, so this narrows nothing it should not.
	expect(stubsFor('Case.md')).toContain('testState');
	expect(stubsFor('Runbook.md')).toContain('deliverableState');
});
```

Read `settingsWith` first — if it does not accept `deliverableStateKey`/`testStateKey`
directly, build the settings through `resolveSettings` the way the neighbouring tests do.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/domain/writePlanProperties.test.ts -t "workflow reads it"`
Expected: FAIL on the `Case.md` assertion, and again on `Runbook.md` — two failures, which is
the point: one of them predates this feature.

- [ ] **Step 3: Gate the primary stub on the item's own workflow**

In `missingKeyStubs`, before the two existing gates:

```ts
		// The requirements key belongs on an item whose workflow actually READS it, which is
		// not every item once a secondary workflow is on a key of its own: a catalog row
		// reads `testStateKey` and a Deliverable reads `deliverableStateKey`, so stubbing
		// `stateKey` there creates an empty property the row never consults. `stateKeyFor` is
		// the one place that decides which key an item's workflow uses, so asking it here is
		// the same question the chip and the menu ask rather than a fourth opinion.
		//
		// Shared keys are the common case and fall out correctly without a special case:
		// when a secondary key falls back, `stateKeyFor` returns `settings.stateKey` and this
		// gate does nothing.
		if (field === 'state' && stateKeyFor(settings, item) !== settings.stateKey) continue;
```

Import `stateKeyFor` from `./board`. Check the layering first — `writePlan.ts` and `board.ts`
are both in `domain/`, so this is legal, but confirm it introduces no import cycle by running
`npm run analyze`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run test/domain/`
Expected: PASS. Every existing backfill test must be unchanged — if one flips, the gate is
too wide.

- [ ] **Step 5: Watch it fail without the fix**

Revert Step 3, re-run the one test, confirm both assertions go red, restore.

- [ ] **Step 6: Run the whole check and commit**

`npm run check` in the FOREGROUND.

```bash
npm run check
git add src/domain/writePlan.ts test/domain/writePlanProperties.test.ts
git commit -m "Stub the state key an item's own workflow reads"
```


---

### Task 15: The test catalog earns its own changelog entry

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:** none.

**Why:** `CHANGELOG.md`'s `[Unreleased]` section describes the assignee property (which came
from `main`) and the two entries Task 9 added — but the feature this branch shipped BEFORE
this plan started has no entry at all: the fifth toolbar projection, the `Test suite` and
`Test case` types, their badge and test axis, and the rule keeping tests out of the plan's
tree, boards and roadmap.

`CLAUDE.md` states that `[Unreleased]` entries are added by the pull request that earns them,
and `RELEASING.md` says explicitly that the release step is NOT the one to fill `[Unreleased]`
in from scratch. So this is a debt of the earlier work on this branch, and it has to close
before a tag — Task 9's own new bullet refers to "a test catalog row", a thing the changelog
never introduces.

- [ ] **Step 1: Establish what actually shipped**

Do not write from this task's description. Read the register notes for the feature —
`docs/requirements/A catalog of tests.md`, `The test catalog projection.md`,
`A projection for the tests.md`, `Tests stay out of the plan.md` and
`A badge when the palette is full.md` — and check each user-visible claim against the code
before it becomes a bullet.

The traps, all of which this plan has already produced as false prose somewhere:
- The catalog has **no board, no rollups and no completed-items toggle.** A done test styles
  its row and hides nothing.
- A `Test case` is a catalog member by NAME whatever it hangs under, so it never appears in
  the plan's tree, board or roadmap.
- The badge's colours have been seen by NOBODY. Say nothing about how they look.

- [ ] **Step 2: Write the entries under `[Unreleased]`**

Add to the existing `### Added` section, above or below the current bullets as reads best —
do not create a second `### Added`. Match the voice of the entries already there: what the
user can now do, in their words, not the mechanism.

At minimum the projection itself, the two types with their badge, and the exclusion from the
plan's projections. Judge whether they are one bullet or three; three related bullets is
normal in this file, and one dense bullet is also normal — read the neighbours and match.

Do not touch the `### Changed` section's cyan entry; that is Task 9's and it is correct.

- [ ] **Step 3: Check the section rules**

Run `npx vitest run test/release/changelogVersion.test.ts` — it checks the section structure
and heading boundaries. `[Unreleased]` must stay above the first dated `##`, and `0.6.0`
must remain the first dated section below it.

- [ ] **Step 4: Run the whole check and commit**

`npm run check` in the FOREGROUND.

```bash
npm run check
git add CHANGELOG.md
git commit -m "Give the test catalog the changelog entry its own PR owed it"
```


---

### Task 16: A root drop may not change which projection draws the row

**Files:**
- Modify: `src/domain/dropTargets.ts` (`rootDropTarget`)
- Test: `test/domain/dropTargets.test.ts`

**Interfaces:**
- Consumes: `ladderFor` from `src/domain/itemTypes.ts`.
- Produces: nothing later tasks read.

**Why, and why the register already decided it.** Found on the branch by an automated
reviewer: with `autoType` off (the default), the catalog offers **Move to top level** for a
`Task` beneath a `Test case`. Taking it clears the parent without changing the type, and on
rebuild `ladderFor('Task', null)` answers `LEVELS` — so the row leaves the catalog and
reappears in the plan. It vanishes from the screen the user dragged it on.

This is not a new judgement call. `docs/requirements/Test suite and test case as a ladder of
their own.md` extension **1c** already withholds `Task` from the catalog's top-level CREATOR
for precisely this reason, and calls it *"the case that proves the restriction belongs to the
top-level creator rather than to a type list"*. The drop is the same act by another entry
point and never got the same rule — the "one move, several inputs" family, where a rule is
kept at one surface and forgotten at another.

Read 1c before writing anything.

**Which rows this affects, exactly.** Only those whose ladder DEPENDS on the parent.
`ladderFor` chains from the parent for two inputs — `Task` and a note with no `type` — and
answers from the name for every other. So a `Test case` dropped at top level stays a catalog
member and must still be offered the target; a catalog `Task` must not be. Do not write a
`Task`-specific test: ask the ladder.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/dropTargets.test.ts`, beside the other `rootDropTarget` tests:

```ts
it('refuses a root drop that would move the row to the other projection', () => {
	// A `Task` under a `Test case` is a catalog member because its parent is; at the top
	// level `ladderFor` answers the plan's ladder, so clearing the parent would take the row
	// off the screen it was dragged on. Extension 1c withholds the same act from the
	// top-level CREATOR for this reason; the drop is the same act by another входа point.
	const vault = new FakeVault();
	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
	vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (path: string) => {
		const item = model.byPath.get(path);
		if (!item) throw new Error(`no item ${path}`);
		return item;
	};
	const catalog = model.catalog.roots;
	expect(rootDropTarget(model, get('Test task.md'), false, catalog)).toBeNull();
	// And the row whose ladder does NOT depend on its parent is still offered it, so this
	// narrows exactly the case that changes projection and nothing else.
	expect(rootDropTarget(model, get('Case.md'), false, catalog)).not.toBeNull();
});
```

Fix the stray non-English word in that comment ("входа" → "entry") — it is a typo in this
brief, not a thing to reproduce. Match the file's existing `rootDropTarget` tests for how
they build settings and call the function; the signature takes four arguments.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/domain/dropTargets.test.ts -t "other projection"`
Expected: FAIL on the first assertion — a target is returned where null is wanted.

- [ ] **Step 3: Refuse the drop that would change membership**

In `rootDropTarget`, after the existing focus and stale-link handling:

```ts
	// **A root drop may not change which projection draws the row.** `ladderFor` chains from
	// the PARENT for a `Task` and for a typeless note, so clearing the parent re-answers it:
	// a catalog `Task` becomes a plan `Task` and vanishes from the screen it was dragged on.
	// Extension 1c of `Test suite and test case as a ladder of their own` already withholds
	// this act from the top-level CREATOR for the same reason; a drop is the same act by
	// another entry point, and the rule belongs to both.
	//
	// Asked of the LADDER rather than of the type name: every other type answers from its
	// own name and is unaffected, so this narrows exactly the rows whose membership the
	// clearing would change.
	if (ladderFor(item.typeName, null) !== dragged.ladder) return null;
```

**Read `rootDropTarget`'s real parameter names before pasting** — the sketch above may not
match them, and the item being dragged is the one to ask. Import `ladderFor` from
`./itemTypes`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run test/domain/ test/view/`
Expected: PASS. Every existing root-drop test must be unchanged — a plan row at top level is
unaffected, since `ladderFor` answers `LEVELS` for it either way.

- [ ] **Step 5: Watch it fail without the fix**

Revert Step 3, re-run the one test, confirm RED, restore.

- [ ] **Step 6: Run the whole check and commit**

`npm run check` in the FOREGROUND.

```bash
npm run check
git add src/domain/dropTargets.ts test/domain/dropTargets.test.ts
git commit -m "Refuse a root drop that would change which projection draws the row"
```


---

### Task 17: The projection-predicate lint rule does not exist

**Files:**
- Modify: `CLAUDE.md`, `src/view/CLAUDE.md`
- Create: `docs/issues/The projection predicate has no lint rule behind it.md`

**Interfaces:** none.

**Why.** Both guides assert that a `no-restricted-syntax` rule forbids a bare
`projection === 'tree'` outside `src/view/projection.ts`. **There is no such rule.**
Verified twice: nothing in `eslint.config.mjs` matches, and a probe file containing exactly
that comparison under `src/view/` lints clean.

The claim is load-bearing, which is why it cannot just be deleted. `src/view/CLAUDE.md`
uses it to argue that the predicate module holds "for a gate nobody has written yet rather
than merely existing beside the ones that do" — that is the whole reason a reader trusts
`treeShaped`/`hidesCompleted` instead of comparing names. Remove the sentence and the
argument goes with it; leave it and the guide is lying about its own safety net.

And the drift it claims to prevent has already happened. Bare `host.projection === '...'`
comparisons live in at least: `render/emptyStates.ts`, `render/projections.ts`,
`render/toolbarStatus.ts`, `render/toolbarControls.ts`, `render/toolbar.ts`,
`render/legend.ts`, `interactions/keyboard.ts`, `interactions/plan.ts`,
`interactions/menu.ts`, `backlogView.ts`. Confirm the list yourself before writing it down.

**This task does NOT add the lint rule.** Adding it would fail a dozen-plus existing call
sites, several of which are legitimate dispatch (`renderContent`'s switch is a switch on the
projection by design). Deciding which are legitimate and which are the drift is real work
with a real product question in it, and it is not this plan's. This task makes the guides
honest and records the gap where the next person will find it.

- [ ] **Step 1: Establish the facts yourself**

Run all three, and put the outputs in your report:
- `grep -rn "no-restricted-syntax" -A 40 eslint.config.mjs | grep -in "projection"` — expect nothing.
- Write a throwaway file under `src/view/` containing a function that returns
  `projection === 'tree'`, run `npx eslint` on it, confirm it passes, then delete it.
- `grep -rn "projection === '" src/ | grep -v "src/view/projection.ts"` — the real list.

If any of that contradicts what this task says, stop and report it rather than proceeding.

- [ ] **Step 2: Correct both guides**

In `src/view/CLAUDE.md`'s projection paragraph and in `CLAUDE.md` wherever the same claim
appears, replace the lint-rule sentence with what is actually true. The honest version keeps
the module's purpose and drops the false guarantee — something to the effect that the
predicates exist so that "tree-shaped" is asked in one place rather than compared in six,
that nothing enforces it mechanically, and that the comparisons already spread across the
files you listed are the evidence for why it matters.

Write it in the guides' own voice, and follow the root guide's own rule: *write the
guarantee to the check, never ahead of it.* If narrowing the sentence makes it uglier, the
ugliness is the information.

- [ ] **Step 3: Record the gap as an issue note**

Create `docs/issues/The projection predicate has no lint rule behind it.md`. Read
`docs/README.md` for the frontmatter an issue note needs and two existing issue notes for
the shape. It should state: the claim the guides made, that no rule exists, how you verified
it, the call sites that already compare directly, and the open question — which of those are
legitimate dispatch and which are the drift the predicate module was built to stop. Name the
question; do not answer it.

- [ ] **Step 4: Run the whole check and commit**

`npm run check` in the FOREGROUND. The register gate validates the new note's frontmatter,
its wikilinks and every source path it names.

```bash
npm run check
git add CLAUDE.md src/view/CLAUDE.md docs/issues/
git commit -m "Say what actually holds about the projection predicate"
```


---

### Task 18: One rule for every move that could change a row's projection

**Files:**
- Modify: `src/domain/dropTargets.ts` (extract the predicate Task 16 inlined; apply it in every target function there)
- Modify: `src/view/interactions/structure.ts` (`outdentTarget`, and any sibling target function that changes a parent)
- Test: `test/domain/dropTargets.test.ts` and/or `test/view/structure*.test.ts` — by subject

**Interfaces:**
- Produces: one exported predicate in `src/domain/dropTargets.ts`, something like
  `changesProjection(item: BacklogItem, parent: BacklogItem | null): boolean`. Name it as you
  see fit; what matters is that it is ONE function every target consults.

**Why.** Task 16 refused a root drop that would move a row into the other projection, and put
the check inline in `rootDropTarget`. An automated reviewer then found the same bug at the
next entry point: with `Epic → Test case → Task`, the `Task` is an ordinary child, so
**Outdent** is offered; taking it reparents the `Task` under the hidden `Epic`, `ladderFor`
re-answers from the new parent, and the row leaves the catalog — regardless of `autoType`.

**This is the third time this exact rule has been found missing at a surface that did not have
it**: the top-level creator had it (extension 1c), the root drop did not (Task 16), and now
outdent does not. That is the "one move, several inputs" family, and patching outdent alone
invites a fourth instance. The rule goes in one place that every target consults.

- [ ] **Step 1: Enumerate the entry points yourself — do not trust this list**

Every reparenting operation produces a `DropTarget` carrying a `parent` and hands it to
`host.performDrop`. Find them all. Start from:
- `grep -rn "performDrop" src/` — every caller
- `grep -rn "DropTarget" src/` — every producer

At least `rootDropTarget`, `dropTargetFor`/`siblingPosition`/`insidePosition` and
`outdentTarget` exist; check whether indent has one, whether the move menu produces targets
of its own, and whether `Clear parent link` / `Use folder position` reparent by another route
(they go through `removeParentWrites`, not a `DropTarget` — decide whether the rule belongs
there too, and say why in your report either way).

**Put the finding in your report as a list**: for each entry point, whether it can change the
item's ladder, and whether it now consults the predicate.

**Refuse at the TARGET, not at the write.** These functions are what the menu asks to decide
whether to OFFER a command — `outdentTarget`'s own comment says "exported so the menu can
offer the command on exactly the rows where it works". Refusing later would leave an offered
command that does nothing, and this repo's rule is *absent rather than inert*.

- [ ] **Step 2: Write the failing tests first**

At minimum, outdent: build `Epic → Test case → Task`, confirm `outdentTarget` currently
returns a target for the `Task`, and assert it should be null.

**Make each test discriminate the LADDER from a type NAME.** A fixture whose only refused row
is a `Task` passes against `typeName === 'Task' && inCatalog(item)`, which is not the rule —
that mistake was made once already on this branch. Include a **typeless** row (no `type` in
its frontmatter) under a `Test case`, since `ladderFor` chains from the parent for exactly
two inputs — `Task` and typeless — and the typeless one is what tells the two implementations
apart. Also assert a row that must STILL be offered the command, so an over-wide refusal
fails.

Watch them fail before implementing.

- [ ] **Step 3: Extract the predicate and apply it**

Take the condition Task 16 inlined in `rootDropTarget` — read it, do not re-derive it — and
lift it to a named exported function that takes the item and its PROSPECTIVE parent, so it
serves a target whose destination is a grandparent as well as one whose destination is null.
`rootDropTarget` then calls it with `null`; `outdentTarget` calls it with the grandparent.

Its comment should point at `docs/requirements/Test suite and test case as a ladder of their
own.md` extension 1c, which decided this for the creator, and record that the rule reached
three entry points at three different times. Verify 1c says what you claim before citing it.

- [ ] **Step 4: Watch each new test fail without the predicate, and prove it discriminates**

Revert the predicate's use in each target, confirm the matching test goes RED, restore. Then
temporarily replace the predicate's body with the type-name version
(`item.typeName === 'Task' && inCatalog(item)`) and confirm the TYPELESS assertions fail.
Report both observations. This is the check that makes the tests worth having.

- [ ] **Step 5: Run the whole check and commit**

`npm run check` in the FOREGROUND, and watch its exit code rather than inferring from output.

```bash
npm run check
git add src/domain/dropTargets.ts src/view/interactions/structure.ts test/
git commit -m "Ask one predicate whether a move would change the row's projection"
```

### Task 19: The published contracts still promise no drop is ever refused for a type

**Files:**
- Modify: `src/view/manual/typesSection.ts` (the `Type is advisory, not enforced` entry)
- Modify: `src/domain/backlogReadme.ts` (`rulesSection`, the "type rules are advisory" bullet)
- Test: whichever suites already assert on those two texts — find them, do not assume

**Why.** An automated reviewer on PR #123 found that this branch falsified two texts the
plugin *publishes to users*, and both were verified by hand before this task was written:

1. `src/view/manual/typesSection.ts`, entry `Type is advisory, not enforced`, ends
   *"No drag is ever refused for what it would type something as. Other drops still are —
   onto an item's own descendant, or into a sibling group a reorder cannot reach right now —
   neither of which is about type."* Task 18's `keepsProjection` refuses exactly that class of
   drop, and outdent and the parent-link actions withhold for it too. The sentence enumerates
   the refusals and now the list is short by one.
2. The same entry says Set type *"in the tree and the roadmap offers the whole vocabulary"*
   and that only *"a board's menu narrows"*. `offerableTypes` (`src/view/projection.ts`)
   applies the catalog-membership filter on the `types === ALL_TYPES` path in **every**
   projection, which is the `retypeChoices` path Set type takes. The tree narrows now.
3. `src/domain/backlogReadme.ts`'s `rulesSection` opens *"The type rules are advisory ...
   nothing is refused"* — the same falsification as (1), in a file the plugin writes into
   the user's vault.

A user hitting an intentionally absent action with a manual that says it cannot be absent
diagnoses a malfunction. That is the cost, and it is why this is worth a task rather than a
deferred minor.

- [ ] **Step 1: Verify all three claims yourself before changing a word**

Read `keepsProjection` in `src/domain/itemTypes.ts` and its four call sites, and read
`offerableTypes` lines around the `wanted` filter. Establish for yourself, and put in your
report:
- exactly which rows a move can be refused for (the answer is narrow — `ladderFor` chains from
  the parent for only two inputs, a `Task` and a note with **no** `type`, so every other type
  answers from its own name and can never change ladder by moving);
- that in a vault carrying no test types nothing is refused at all, since every row answers
  `LEVELS`;
- whether Set type in the tree really does withhold `Test suite` / `Test case` on a plan row.

If any of the three is wrong, say so and fix only the ones that are real. The point of this
step is that this repo has shipped prose asserting what the code does not do more than a dozen
times on this branch alone — do not add a fourteenth by trusting the paragraph above.

- [ ] **Step 2: Grep for every other copy before editing either file**

`grep -rn "nothing is refused" src/ docs/`, `grep -rn "never refused" src/ docs/`,
`grep -rn "refused" src/view/manual/ src/domain/backlogReadme.ts`, and
`grep -rn "whole vocabulary" src/ docs/`. Put the full output in your report. Three separate
rounds on this branch each fixed the instances they were told about and missed one; the grep
is what breaks that pattern.

- [ ] **Step 3: Write the corrections**

Say what actually holds, in the register's voice — the rule, not the mechanism:

- The type rules stay advisory *within* a ladder: a `Task` under an `Epic` stays a `Task`, the
  ladder guides and does not enforce. What is refused is narrower and structural — **a move
  that would take a row out of the projection it is drawn on**, which only a `Task` or a
  typeless note can do, and only by moving across the boundary between the plan and the test
  catalog. Name the reason: a row that answered the other ladder would vanish off the screen
  it was dragged on.
- Set type offers what **this projection can show**, in every projection — not just a board.
  The two boards' narrowing is one case of that rule, not the whole of it.

Keep both texts sentence-case and free of the special characters the manifest rules ban.
Do not restate the mechanism (`ladderFor`, `keepsProjection`) in user-facing prose; users have
neither symbol.

- [ ] **Step 3a: One more thing the generated README says wrongly, in the same file**

Found while measuring Task 14 and left for this task, since this is the task that edits
`src/domain/backlogReadme.ts`. It compares each secondary state key only against
`settings.stateKey`, so **two secondaries sharing a key with each other but not with the
requirements key read as unshared**, and the table prints one key as two rows — one saying
"on a Deliverable", one saying "on a test". Reproduce it first: resolve settings with
`stateProperty` on `status` and BOTH `deliverableStateProperty` and `testStateProperty` on
`shared`, generate the README, and count the rows for `shared`.

This is the same class as the defect the file's own `sharedStateKey` comment says was fixed
once already — the fix then compared against one other key, which was right while there were
two workflows and became wrong at three. State the rule so a fourth workflow cannot reopen
it: a key gets ONE row, naming every workflow that reads it.

If your reproduction shows the table is already correct, say so and change nothing — the
observation came from a measurement aimed at something else and has not been confirmed
against the shipped generator.

- [ ] **Step 4: Fix the tests that assert on these strings**

Find them (`grep -rn "advisory" test/`, and the README snapshot/assertion suites). If a test
asserts the old sentence, it must now assert the new one; if a test asserts only that the
entry exists, consider whether the *claim* is worth an assertion — a manual entry stating a
refusal the code does not make is the same defect class as an unchecked comment.

- [ ] **Step 5: Run the whole check and commit**

`npm run check` in the FOREGROUND, and watch the exit code rather than inferring from output.

```bash
npm run check
git add src/view/manual/typesSection.ts src/domain/backlogReadme.ts test/ docs/
git commit -m "Say which drops the projection boundary refuses"
```

---

## Execution status

Recorded in this tracked file on purpose. This plan is being executed subagent-driven, whose
ledger lives in a git-ignored scratch directory — and that directory has now been destroyed
twice by container reclaims, taking every brief, report and review package with it. The
commits survived both times because each task was pushed as it closed. What follows is the
state a fresh session needs, kept where a reclaim cannot reach it. Update it as tasks close.

**Complete and reviewed clean:** Tasks 1-21, except 22 (below). Tasks 19, 20 and 21 each
landed after this section was first written.

**A controller error worth keeping.** Task 21's brief told the implementer to gate the new
`Clear test state` foot on `item.ownKeys`, copying the neighbours. It refused, and it was
right: `readOwnKeys` fills that flag through `optionalKeyFor`, which answers the RAW
`testStateKey`, while the test workflow reads the RESOLVED one. On the shipped default — tests
sharing the plan's `status`, so the raw key is empty — the flag is false on every note that
carries a state, so the recommended gate would have shipped a control that exists, passes its
tests, and never appears. Measured, not argued. The lesson generalises past this task: a
presence gate is only as good as the key it asks about, and this codebase has two of those.

**Follow-up, deliberately not built here.** The plan-gated foot leaves a residue: any value
`readString` refuses (blank, whitespace, YAML null, an empty list, a mapping) reads as no
value and is offered no clear. The plugin manufactures it — `applyInto` stubs a missing
optional key as `''`, and ✨ stubs the test state onto every catalog member — so with a
distinct `testStateProperty` every catalog row gets one. What cannot be removed is always an
EMPTY key, the stub the backfill left as an invitation, so nothing is ever stuck on screen and
no state a user set is affected; what is lost is the tidy-up the horizon's presence gate
gives. The fix is one condition (a presence signal read through the resolved key, or a
presence-gated `computeTestStateWrites`) but `ownKeys` is also the backfill's own complement,
so it needs its own task and tests. Recorded in the code, `src/view/CLAUDE.md` and extension
5d rather than left to be found.

Task 14 took three fix rounds and is worth reading before touching `missingKeyStubs`. Its
three category gates were unified into one `stateKeyFor`-driven lookup because the three-gate
form breaches fallow's complexity threshold — the countermand is recorded at Task 14's Step 3
above. Every finding after the first round was PROSE describing that gate wrongly, four times
running, including once from a controller instruction that told an implementer to restore a
rationale nobody had checked was still true.

**Not started:**

- **Task 15** — the test catalog has no `[Unreleased]` changelog entry at all.
- **Task 19** — the built-in manual and the generated vault README still tell users that no
  drag is ever refused for what it would type something as, and that only a board narrows
  Set type. `keepsProjection` falsified the first; `offerableTypes` falsified the second.

**Open, unverified:** an automated reviewer reported that `hiddenMatches`
(`src/domain/board.ts`) walks raw `parent.children` with no membership-edge guard, so with
`Release (Deliverable) -> Test case -> Release follow-up (PBI)` filtered by `Release`, the
Deliverable's card may name the PBI as a match beneath it although the catalog boundary breaks
that edge in the active projection. **Reproduce before fixing.** This is the sixth finding on
that machinery, and on two of the previous five the suggested fix was correct in isolation and
produced the next finding — the four questions `member` answers are separate, and every round
that treated two of them as one rule created the next round.

**Found while measuring, out of scope, unfixed:** `src/domain/backlogReadme.ts` compares each
secondary state key only against `settings.stateKey`, so two secondaries sharing a key with
each other but not with the requirements key read as unshared, and the generated README prints
one key as two rows. Same class as the defect its own `sharedStateKey` comment says was fixed
once already. Task 19 edits that file.

**For the final whole-branch review.** Point it at the two families where this branch's
defects actually lived rather than at the diff as a whole: the filter/match machinery (six
findings, one function) and projection-boundary gates (four findings, four separate entry
points — the creator had the rule, the root drop did not, outdent did not, and the parent-link
actions did not). Deferred minors: no live-vault check of menu-entry absence (jsdom only);
unchecked drag call-site wiring affecting `rootDropTarget` and `dropTargetFor`; `dropTargetFor`
sitting at the max-params limit; the generated README's "see below, and A and B" phrasing.

**Owed and unperformable in this environment:** visual confirmation of the test suite's orange
against the test case's cyan in a real theme; the `Test management` group in Obsidian's own
options pane; whether Bases accepts a view-option key containing a space.

---

### Task 20: A card announces matches only from rows this projection draws

**Files:**
- Modify: `src/domain/board.ts` (`hiddenMatches`)
- Modify: `src/view/childrenList.ts` (`undisclosedMatches`, which supplies the guard)
- Test: `test/view/testCatalog.test.ts` or a filter/board suite — by subject, matching the
  file that already owns the neighbouring assertions
- Possibly: `docs/requirements/A projection for the tests.md` and `src/view/CLAUDE.md`'s
  card-matches paragraph

**Why.** Reported by an automated reviewer and REPRODUCED here before this task was written.
`hiddenMatches` recurses through raw `parent.children` with no membership guard — the one
"what is beneath this card" walk in the codebase that crosses the ladder boundary. On the same
card, three quantities answer that question and only this one gets it wrong: the rollup stops
at the boundary (`assignAll`'s `inCatalog(child) || inCatalog(item)`), the disclosure stops at
it (`listedChildren` through `isRowHidden`), and the filter index stops at it (`markSubtree`).

The evidence that makes it a defect rather than a preference is a pair of measurements over
the SAME edge with the same needle:

```
Release (Deliverable) -> Smoke case (Test case) -> Release follow-up (PBI)
  filter "follow-up"   -> cards: []          the index refuses to keep the card
  filter "Release"     -> cards: ['Release'], match links: ['Release follow-up']
```

The index denies that match the power to keep the card alive, and the card then prints it
anyway — the difference being only whether the card happened to match for an unrelated
reason. The control, with no boundary (`Release -> Plumbing (Feature) -> Release follow-up`),
keeps the card, names the match and rolls up 2: the feature working.

**The framing in the original report is wrong and the fix must not inherit it.** It says the
card exposes the PBI "as though it were beneath that Deliverable in the active projection".
The Deliverables board has no edges — it is a flat set of `deliverableResults` cards and never
draws the plan's forest — so that is not a statement this projection can make. The checkable
version is narrower: *the card's three "beneath me" quantities disagree, and the two that are
already right are the rollup and the disclosure.*

Severity is low: a link on a card face and a menu entry, both read-only, and the note is
reachable from the tree and the requirements board. It is an ownership misstatement, not a
write hazard. It earns a task because it is the sixth finding on this machinery and the first
one whose fix location is known before anyone edits.

- [ ] **Step 1: Reproduce it yourself before changing anything**

Fixture: `Release.md` (`type: Deliverable`), `Smoke case.md` (`type: Test case`, parent
`Release`), `Release follow-up.md` (`type: PBI`, parent `Smoke case`) — the intervening test
named so it cannot match the needle. Render the Deliverables board through the real toolbar
button, `setFilter('Release')`, and assert on the MATCH SET the card exposes
(`undisclosedMatches` / `.pbl-card-match`), never on `containerEl.textContent`. A previous
round asserted `textContent`, passed, and proved nothing.

- [ ] **Step 2: Fix it in the WALK, never in the match set**

The PBI is a plan member and is legitimately a match in the `whole` index. It must stay one:
that is what puts it on the tree as a promoted root, and it is the same property that keeps a
`Deliverable` nested under a test on its own board. **Any rule of the form "a member below a
non-member is not a match" is a previous round's regression restated** and deletes that
Deliverable's card — `test/view/testCatalog.test.ts:493` exists to pin exactly that.

So: `hiddenMatches` may descend only through rows this projection DRAWS. The predicate is
already in the caller's hand — `undisclosedMatches` has the `host`, and `!host.isRowHidden(child)`
answers it. A match's own ancestors along drawn edges are in `visible`, so the intermediate
rows a genuine deep match hides behind are not hidden, while a non-member is hidden
unconditionally by `rowHidden`'s first line. One guard, threaded from `view/childrenList.ts`
into `domain/board.ts`, covers both consumers — the card face and `addMatchSection`'s menu
entries — since both go through `undisclosedMatches`.

Do NOT spell the guard `!child.outsideFilter` (breaks a context Deliverable naming its Task
child) or "has no card" / "is not a direct child" (breaks the deep-match feature itself).

- [ ] **Step 3: Watch the new test fail, and watch these seven keep passing**

Run each before and after. They are the mirrors previous rounds broke:

1. `test/view/testCatalog.test.ts:493` — nested `Deliverable` under a `Test case`, filtered by
   its own title, keeps its card. **Breaks under any set-side fix.**
2. `test/view/testCatalog.test.ts:545` — `Epic -> Test case -> Runbook` filtered by `Epic`:
   board empty.
3. `test/view/testCatalog.test.ts:567` — a `Test case` under a `Deliverable` is never a match.
4. `test/view/testCatalog.test.ts:513` and `:529` — the up and down mirrors on
   `Epic -> Test case -> PBI`.
5. `test/view/boardFilter.test.ts` — the deep-match feature itself (`Epic A -> Feature A1 ->
   PBI Login` under focus): the Epic card must still name `PBI Login`. This is why the guard
   must be membership/visibility.
6. `test/view/deliverablesBoardContext.test.ts` — a context (`outsideFilter`) Deliverable
   naming its Task child. A context row IS a member.
7. Add the no-boundary control as a fixture: `Release -> Plumbing (Feature) -> Release
   follow-up`, filter `follow-up` — card survives, match named, `descendantCount: 2`. It is
   the direct mirror of the defect fixture and the two must stay apart.

- [ ] **Step 4: State the rule where the next walk will read it**

`src/view/CLAUDE.md`'s card-matches paragraph currently says `hiddenMatches` "walks its
subtree, stopping at anything already rendered". That is now one guard short. Say what the
walk actually stops at, and why the match SET is deliberately not where this is enforced —
that asymmetry is the whole finding and the next person will otherwise fix it in the set.

- [ ] **Step 5: Run the whole check and commit**

```bash
npm run check
git add src/domain/board.ts src/view/childrenList.ts test/ docs/ src/view/CLAUDE.md
git commit -m "Announce a match only from a row this projection draws"
```

---

### Task 21: A test state can be set and never removed

**Files:**
- Modify: `src/view/interactions/menu.ts` (`stateChoices`, or a removal entry beside it)
- Test: `test/view/testCatalogState.test.ts`
- Probably: `docs/requirements/A workflow for the tests.md` (the extension that specifies
  Set state on a catalog row), and `src/view/CLAUDE.md` if the rule needs stating there

**Why.** Reported by an automated reviewer on `1070fec` and confirmed here by reading the
code, not by agreeing with it:

`stateChoices` (`src/view/interactions/menu.ts`) returns `activeBoard(host)`'s columns when a
board is drawn — and the leading no-state column is the ONLY thing that ever contributes
`state: null`, which is what removes the key. With no board it returns
`deliverableOrTestValues(...) ?? stateMenuValues(...)` plus the item's own unlisted value:
strings, every one. The catalog is tree-shaped and has no board and never will, so
**`computeTestStateWrites(item, null)` is unreachable from the UI**. Both surfaces are
affected, because the chip and the row menu share `addStateItems`.

A requirements row is not in this position even though its tree menu is equally string-only:
its user can switch to the board and drop the card in `No state`. A `Deliverable` likewise
has its own board. The catalog is the one workflow with a property the plugin will set and
cannot unset, and this branch shipped that property.

This is the mirror of a rule the repo already keeps — *"Removal actions appear only while the
note CARRIES the key, so no offered action can write nothing"*. That rule stops an action
that would do nothing; this is an action that can do something and is never offered.

- [ ] **Step 1: Reproduce before designing**

Drive a catalog row with a test state set, open both surfaces — the state chip and the row
menu's `Set state` — and assert the offered entries. Confirm no entry removes the key, and
confirm `computeTestStateWrites(item, null)` does plan a removal when called directly, so the
gap really is the offer and not the planner.

- [ ] **Step 2: Pick the shape, and follow an existing precedent rather than inventing one**

Two precedents exist and they disagree, which is the decision to make and record:
- the BOARD's answer is a no-state CHOICE in the same list (`col.state === null`);
- the row menu's answer for every other optional property is a **Clear foot** gated on
  `item.ownKeys` — `Clear horizon`, `Unschedule`, and the two label menus all do this, and
  `src/view/CLAUDE.md` states the gate as presence, never value.

Prefer the Clear foot: it is the shape this menu already uses for removal, it gates on
presence so it is never offered when there is nothing to take away, and a no-state entry in a
list of states reads as a state on a projection that draws no columns to explain it. If you
choose otherwise, say why in the report and in the register note — do not leave two shapes
with no argument between them.

Whichever you pick, the CHECKMARK comes from the plan (`computeTestStateWrites` returning
nothing), never from a comparison written beside it. That rule is in the root `CLAUDE.md` and
it was broken once already when a second property arrived.

- [ ] **Step 3: Watch it fail, then check the neighbours did not move**

The new test must fail before the fix. Then confirm, by assertion and not by reasoning:
- a catalog row with NO test state is not offered the removal (presence gate);
- a requirements row and a `Deliverable` row are unchanged on every surface — this is the
  catalog's gap and the fix must not add an entry to the other two workflows;
- the entry writes through `computeTestStateWrites`, so a catalog row's removal cannot
  acquire the requirements workflow's date stamps.

- [ ] **Step 4: Run the whole check and commit**

Note two files are at their line cap and must not grow: `src/domain/backlogReadme.ts` (400)
and `test/view/testCatalog.test.ts` (450). Neither should need to.

```bash
npm run check
git add src/view/interactions/menu.ts test/ docs/ src/view/CLAUDE.md
git commit -m "Offer the catalog the removal its workflow already plans"
```

---

### Task 22: The card disclosure counts a row it does not draw as one it is hiding

**Files:**
- Modify: `src/view/render/cardChildren.ts` (the `omitted` count)
- Test: `test/view/cardChildren.test.ts` (or the suite that already owns the disclosure's count)
- Probably: `src/view/CLAUDE.md`'s card-disclosure paragraph

**Why.** Reported by an automated reviewer on `18ffd6f`, confirmed here by reading the code:

```ts
const omitted = item.children.length - children.length;
const note = omitted > 0 ? ` — ${omitted} more ${omitted === 1 ? 'is' : 'are'} hidden by the current view` : '';
```

`children` is `listedChildren`, which filters on `!host.isRowHidden(child)` — and `rowHidden`'s
FIRST, unconditional clause is `!rule.inProjection(item)`. So a catalog child is dropped from
the list, then counted again in `omitted` off RAW `item.children`. An `Epic` holding a
`Feature` and a `Test case`, on any plan projection, reports *"1 more is hidden by the current
view"* — announcing a row the plan is not merely hiding but does not have.

The comment directly above that line says what the note is FOR: the disclosure counts what it
lists while the rollup counts everything beneath, "so with completed work hidden the two
disagree on purpose", said out loud only where a user can ask. Completed-hidden is a row this
projection draws and is choosing not to show. A catalog member is not that. **Absent rather
than hidden** is the branch's rule and the reason the toggle, the rollup and the match walk
were each fixed already.

**This is a FOURTH quantity on the same card**, and worth noting because Task 20's
investigation named three and called two of them correct. The three were the rollup, the
disclosure's LIST, and the match walk. The disclosure's own omitted COUNT was not examined,
and it is wrong. A count derived by subtracting a filtered list from a raw one is the shape to
look for.

Severity is low — a tooltip and a count, read-only. It earns a task because it is the seventh
finding in one family on this branch and the cheapest possible instance of it.

- [ ] **Step 1: Reproduce before fixing**

Build `Epic → Feature` plus `Epic → Test case`, render a plan CARD projection that draws the
Epic with a disclosure, and assert the tooltip text. Confirm it says one is hidden. Then the
control: with the `Test case` replaced by a completed `Feature` and completed items hidden,
the same sentence SHOULD appear — that case is what the note exists for and must survive.

- [ ] **Step 2: Count over the rows this projection draws**

`projectionMember(host.projection)` (`src/view/projection.ts`) answers membership alone;
`isRowHidden` conflates membership with the completed toggle and the quick filter, which is
right for the LIST and wrong for this denominator. Take the members of `item.children` first,
then subtract the listed ones.

Do not reach for `!child.outsideFilter` (a context row IS a member) or for `inCatalog` spelled
directly (that is a second opinion about membership, and the projection decides it, not the
ladder alone).

- [ ] **Step 3: Watch it fail, and watch the control keep passing**

Revert the fix, see the new assertion go red, restore. Then confirm the completed-items case
still reports its hidden child — a fix that silences the note entirely would pass a naive test
and delete the feature.

- [ ] **Step 4: Run the whole check and commit**

Three files are at their line cap and must not grow: `src/domain/backlogReadme.ts` (400),
`test/view/testCatalog.test.ts` (450), `src/view/interactions/menu.ts` (400).

```bash
npm run check
git add src/view/render/cardChildren.ts test/ src/view/CLAUDE.md docs/
git commit -m "Count what this projection draws, not what the note holds"
```

---

### Task 23: Delete the autoType feature

**Decision.** The user's, on 2026-08-11, in response to the final review's one Important
finding: *"we should remove the whole auto type feature instead"*. Not a refactor — the
feature goes.

**Files** (measured, not guessed — verify the list yourself before trusting it):
- `src/domain/writePlan.ts` — `computeTypeChanges` (~106 lines) and its call at :198
- `src/view/interactions/menu.ts` — the `!host.settings.autoType` early return at :220 and the
  `computeTypeChanges` call at :222
- `src/domain/settings.ts`, `src/domain/settingsResolve.ts`, `src/domain/viewOptions.ts` — the
  field, its resolution, and the toggle
- `src/domain/itemTypes.ts` — `keepsTypeOnMove`, whose only consumer is the README sentence
  below; and the `nextLevelIndex` docblock's reference to the cascade
- `src/domain/backlogReadme.ts` — the conditional at :139-143 and the rules bullet at :517
- Tests: `test/domain/writePlan.test.ts`, `writePlanContextRows.test.ts`, `testLadder.test.ts`,
  `settings.test.ts`, `backlogReadme.test.ts`
- Register: `docs/requirements/Assigning type on a move.md` (the feature's own note),
  `src/domain/CLAUDE.md`, `README.md`, the manual, and
  `docs/issues/The dragged item is retyped, its descendants are not.md`, which this CLOSES

**Why this rather than the guard.** The final review found the cascade's nested no-crossing
guard unchecked — deleting `|| child.ladder !== destLadder` leaves all 1818 tests green, and
losing it lets a drag of an unrelated Epic write a plan rung onto a hand-nested `Test suite`
and take it out of the catalog. That is the one door that does not ask `keepsProjection`.
Deleting the cascade removes the door.

It also settles two open register items rather than carrying them: the issue note above
records that the dragged item is retyped while its descendants are not — an artefact nobody
chose — and ADR 0009 says the type rules are advisory. `autoType` was the single exception to
that ADR, off by default, and it is the only reason `keepsTypeOnMove`, the nested ladder guard
and the "which types a move leaves alone" README sentence exist.

- [ ] **Step 1: Establish the true call graph before deleting anything**

`grep -rn "autoType\|computeTypeChanges\|keepsTypeOnMove" src/ test/ docs/ *.md`. Put the full
output in your report. Some hits are prose that merely mentions the feature and some are code
that depends on it; say which is which before you edit. In particular decide whether
`nextLevelIndex` and `childLevelIndex` survive — they are the ladder's own arithmetic and are
used well beyond the cascade, so they almost certainly do.

- [ ] **Step 2: Delete, and let the compiler and lint find the rest**

Remove the option, its resolution, the toggle, the planner and the two call sites. `npm run
analyze` (fallow) gates dead code, so anything left orphaned fails the build rather than
lingering — run it early and often.

**A persisted `autoType` key in an existing `.base` becomes inert, which is correct and needs
no migration**: `resolveSettings` reads the keys it knows and ignores the rest. Do not write a
shim; ADR 0016 says a pre-1.0 breaking change gets a changelog line, not a deprecation window.

- [ ] **Step 3: The README generator loses a branch, not a sentence**

`backlogReadme.ts` currently says one of two things depending on the setting. With the feature
gone the unconditional truth is the "off" branch — *moving a note never rewrites its type* —
and the whole `keepsTypeOnMove` list at :139-143 goes with it. Check the surrounding prose
still reads as one paragraph rather than a sentence with a hole in it, and remember that file
is at its 400-line cap: this should take it comfortably under.

- [ ] **Step 4: The register records a removal, not a silence**

- `docs/requirements/Assigning type on a move.md` is a Done PBI for a feature that no longer
  exists. Do not delete the note. Give it the status the register uses for withdrawn work
  (read `docs/README.md`'s folder table and the frontmatter of an existing closed note first —
  match what is there, do not invent a value) and state at the top WHY it was removed, naming
  the unchecked nested guard and the user's decision.
- `docs/issues/The dragged item is retyped, its descendants are not.md` is closed by this.
  Close it, saying the asymmetry went away with the feature rather than being resolved.
- `src/domain/CLAUDE.md` has several paragraphs built on the cascade — the `depth` bullet, the
  extra-types bullet, the two-ladders bullet. Each states a real rule that outlives the
  feature; edit them so they no longer promise a cascade, without deleting the rule they are
  actually about.
- **ADR 0009 gains no new decision** — it already says the rules are advisory, and this makes
  that true without exception. Add nothing to it unless you find it now says something false.
- `CHANGELOG.md` gains a `### Removed` entry under `[Unreleased]`, in the user's language: the
  option is gone, a move never rewrites a type, and an existing setting is simply ignored.

- [ ] **Step 5: Prove the deletion is total**

Re-run the Step 1 grep and put the after-output in the report. Every surviving hit must be
either prose deliberately recording the removal, or a historical plan/spec under
`docs/superpowers/`. Then run the whole check.

```bash
npm run check
git add -A src/ test/ docs/ README.md CHANGELOG.md
git commit -m "Delete the autoType cascade"
```

---

### Task 24: Delete the drop-on-background move to top level

**Decision.** The user's, 2026-08-11: *"I dont want to move an item to the top by dropping
it on the background. this should be a deliberate action and is already doable via the
right-click or by moving the items order"*. Main had just replaced the "Move to top level"
strip with a drop on the tree background (PR #130); this removes the gesture rather than
renaming it again.

**Verified before writing this task**: `outdentTarget` returns `{ parent: null, … }` when the
grandparent is null, ranked among `model.realRoots`, so **Outdent** on a depth-1 row IS the
deliberate top-level move. Accepted cost, stated so nobody rediscovers it as a bug: Outdent
climbs ONE level, so a deeply nested item needs several. `Move to top` (the menu's other
entry) reorders within siblings and is a different action.

**Files** (verify the list yourself — this is a deletion and the compiler will find more):
- `src/domain/dropTargets.ts` — `rootDropTarget` and, if nothing else uses them, the two
  parameters this branch added to it (`focused`, `rendered`)
- `src/view/interactions/dragDrop.ts` — `rootTarget`, `setupRootDropZone`, the `.pbl-tree`
  `dragover`/`drop` handlers, and the call that installs them
- Tests: `test/domain/dropTargets.test.ts` (its `rootDropTarget` block),
  `test/view/dragDrop.test.ts`, and `test/view/projectionMoves.test.ts`, which asserts the
  projection guard on the root drop
- Prose: `src/view/manual/sections.ts` and `test/view/manualSections.test.ts` (which pins its
  wording), `docs/requirements/Help for moving and ranking.md`,
  `docs/requirements/A projection for the tests.md`, `src/domain/CLAUDE.md`,
  `docs/issues/Tree drag between siblings, into a parent and onto the background.md`,
  `CHANGELOG.md`

**The enumeration that shrinks.** `keepsProjection` is consulted by four gates today; with
`rootDropTarget` gone it is three. The manual's `When a drop is unavailable` entry NAMES those
gates — "dropping it beside a row at the top level, a drop on the tree background, Outdent,
and the two menu entries that remove the parent link" — and `test/view/manualSections.test.ts`
asserts that string. Both must shrink with the code. This exact sentence has already been
wrong twice on this branch (once short by a menu entry, once naming a strip main had deleted),
so **count the gates by grepping `keepsProjection` rather than by editing the sentence you
find**.

- [ ] **Step 1: Establish what dies and what survives**

`grep -rn "rootDropTarget\|setupRootDropZone\|rootTarget" src/ test/ docs/`. Put the output in
your report. Decide, and say why: do `effectivelyFocused` and the `rendered`/`focused`
parameters have another caller, or do they go too? `effectivelyFocused` is used elsewhere —
check before deleting anything it belongs to.

- [ ] **Step 2: Delete, and let the compiler and fallow find the rest**

`npm run analyze` gates dead code, so an orphaned export fails the build. Run it early.

A drop on the background must become genuinely inert — no `preventDefault` on `dragover`, so
no drop cursor invites a gesture nothing will honour. Absent rather than inert is this repo's
rule and it applies to a drop target as much as to a menu entry.

- [ ] **Step 3: Fix the prose by counting, not by editing what you find**

Re-grep `keepsProjection` after the deletion, count the call sites, and make the manual's
enumeration match that count exactly. Update the test's expected string in the same commit.
Then check `docs/requirements/A projection for the tests.md` and `src/domain/CLAUDE.md`, which
both describe the root drop as one of the guarded surfaces.

- [ ] **Step 4: A changelog entry, in the user's language**

Under `[Unreleased]` → `### Changed` (or `### Removed` — pick by whether a user would read
this as a capability lost or a behaviour changed, and say which you chose). Name the
replacement: Outdent, from the row's menu or Shift+Tab.

- [ ] **Step 5: Prove it and commit**

Re-run the Step 1 grep and put the after-output in the report. Every surviving hit must be
prose deliberately recording the removal or a historical plan under `docs/superpowers/`.

```bash
npm run check
git add -A src/ test/ docs/ CHANGELOG.md
git commit -m "Delete the drop that made an item top-level"
```
