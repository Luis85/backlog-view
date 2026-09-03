# Capacity against commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** State a release's declared capacity against its committed effort — difference and
utilization, in the unit the vault estimates in — as one figure on the release summary strip.

**Architecture:** The commitment already exists (`releaseReadiness.ts` sums each member's own
estimate once, beside the criterion reading the same key). This adds the capacity as a fourth
figure on `ReleaseReadiness`, read off the release note through the reader the estimates
already use; a double-count count from one pass over the scope rows; two view options; and one
render function on the strip. Nothing is written, nothing is stored, no clock is read.

**Tech Stack:** TypeScript, Obsidian Bases custom view API, vitest (node + jsdom), esbuild.

## Global Constraints

- `npm run check` must pass before every commit — build, test typecheck, lint, markdown,
  coverage-thresholded tests, fallow, docs register. Coverage thresholds only ever go up.
  **The targeted commands in each task's steps are the inner TDD loop, not the gate**: run
  them while iterating, then run `npm run check` once before the commit step and commit only
  on a clean exit. A task whose targeted suites pass can still fail coverage, fallow or the
  docs register, and a commit that fails them is a commit that fails CI.
- Four layers, outermost first: `main → commands → view → storage → domain`, each reaching
  only downward. `i18n/` imports nothing. Enforced by `eslint.config.mjs`.
- **No English literal on a UI path.** Every sentence goes through `t()` and lives in
  `src/i18n/en.ts`. A message may not re-spell a view option's label — it takes it as a
  parameter (`test/i18n/optionLabels.test.ts`).
- **Nothing the plugin persists changes with the locale.** Option keys, property keys and
  frontmatter values are never translated.
- `max-lines`: 400 for `src/`, 450 for `test/` (blank lines and comments skipped).
  `max-lines-per-function`: 100. `complexity`: 16.
- The view NEVER writes to a note the Base excluded, and a context row is never a member,
  never counted, and never a source of a figure.
- Every module in `src/` must be specified in `docs/` — a use case's `## Where it lives` or
  an ADR's `## Decision`. `test/` is exempt.
- Spec: `docs/superpowers/specs/2026-09-03-capacity-against-commitment-design.md`.

**Deviation from the spec, decided while planning:** the spec puts `capacity` on `ReleaseRow`
in `domain/releases.ts`. It goes on `ReleaseReadiness` in `domain/releaseReadiness.ts`
instead, because `releaseReadiness.ts` already imports types from `releases.ts`, so a value
import back the other way is a runtime cycle — and because that module already owns the other
half of this comparison, which is its stated reason for existing. Update the spec's
`## Slice A` and the PBI's `## Where it lives` in Task 6.

---

### Task 1: The capacity figure

**Files:**
- Modify: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseCapacity.test.ts` (create)

**Interfaces:**
- Consumes: `ReleaseFigure<T>` (`{ value: T | null; invalid: boolean; unconfigured: boolean }`)
  and `ReleaseScope` (`{ release: ReleaseRow | null; rows: ScopeRow[]; members: number }`) from
  `src/domain/releases.ts`; `estimateValue(raw: unknown): number | null` and `ownValue` already
  in scope in this module.
- Produces: `ReleaseReadiness.capacity: ReleaseFigure<number>`, populated by
  `releaseReadiness(app, scope, settings, planSettings)`.

Four readings, kept apart because they send the reader to different places:

| Frontmatter | `settings.capacityKey` | Figure |
| --- | --- | --- |
| anything | `''` | `{ value: null, invalid: false, unconfigured: true }` |
| key absent, or `null` | bound | `{ value: null, invalid: false, unconfigured: false }` |
| `-5`, `'later'`, `[]`, `Infinity` | bound | `{ value: null, invalid: true, unconfigured: false }` |
| `40`, `'40'` | bound | `{ value: 40, invalid: false, unconfigured: false }` |

- [ ] **Step 1: Write the failing test**

Create `test/domain/releaseCapacity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { releaseReadiness } from '../../src/domain/releaseReadiness';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/** This suite is not about `today` — `releaseReadiness.test.ts`'s own stand-in. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

/** `test/domain/releaseReadiness.test.ts`'s `readinessOf`, narrowed to what this file needs. */
function readinessOf(vault: FakeVault, overrides: Record<string, unknown> = {}) {
	const plan = settingsWith({ stateKey: 'status', doneValues: ['Done'] });
	const settings = releaseSettingsWith({
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		membershipKey: 'release',
		estimateKey: 'effort',
		capacityKey: 'capacity',
		...overrides,
	});
	const model = buildModel(vault.app, vault.entries(), plan);
	const index = releaseIndex(vault.app, model, settings, { stateKey: plan.stateKey, today: TODAY });
	const scope = releaseScope(vault.app, model, settings, index, 'R.md');
	return releaseReadiness(vault.app, scope, settings, plan);
}

/**
 * The capacity half of `docs/requirements/Commitment against declared capacity.md`.
 * Its own file rather than `releaseReadiness.test.ts`, which is already the longest
 * suite in `test/domain/`.
 */
describe('the capacity a release declares', () => {
	function vaultWith(capacity: unknown): FakeVault {
		const vault = new FakeVault();
		vault.addFile('R.md', {
			frontmatter: capacity === undefined ? { type: 'Release' } : { type: 'Release', capacity },
		});
		vault.addFile('M.md', { frontmatter: { type: 'PBI', order: 1, release: '[[R]]', effort: 5 } });
		return vault;
	}

	function capacityOf(vault: FakeVault, overrides: Record<string, unknown> = {}) {
		return readinessOf(vault, overrides).capacity;
	}

	it('reads a number the release note declares', () => {
		expect(capacityOf(vaultWith(40))).toEqual({ value: 40, invalid: false, unconfigured: false });
	});

	it('reads a quoted number, exactly as an estimate is read', () => {
		expect(capacityOf(vaultWith('40'))).toEqual({ value: 40, invalid: false, unconfigured: false });
	});

	it('is unconfigured with no key bound, whatever the note says', () => {
		expect(capacityOf(vaultWith(40), { capacityKey: '' })).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
	});

	it('is absent — not unconfigured — where the key is bound and the note is silent', () => {
		expect(capacityOf(vaultWith(undefined))).toEqual({ value: null, invalid: false, unconfigured: false });
	});

	it('refuses a negative capacity on READ, since nothing writes one', () => {
		expect(capacityOf(vaultWith(-5))).toEqual({ value: null, invalid: true, unconfigured: false });
	});

	it('refuses a value that is not a number at all', () => {
		expect(capacityOf(vaultWith('later'))).toEqual({ value: null, invalid: true, unconfigured: false });
	});

	it('accepts zero, which is a statement rather than an error', () => {
		expect(capacityOf(vaultWith(0))).toEqual({ value: 0, invalid: false, unconfigured: false });
	});
});
```

`releaseSettingsWith` (`test/helpers/releaseSettings.ts`) and `settingsWith`
(`test/helpers/settings.ts`) are the real helper names; `readinessOf` above is
`test/domain/releaseReadiness.test.ts`'s own, narrowed. Do not widen either helper for this
suite.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/releaseCapacity.test.ts`
Expected: FAIL — `capacity` is not a property of the readiness object (`undefined`), and
`capacityKey` is not a property of `ReleaseSettings` (a typecheck error).

- [ ] **Step 3: Add `capacityKey` to the settings type**

In `src/domain/releaseOptions.ts`, beside `estimateKey: string;` in the `ReleaseSettings`
interface:

```ts
	/** The release note's own declared capacity, in {@link ReleaseSettings.capacityUnit}. */
	capacityKey: string;
```

and in `resolveReleaseSettings`, beside `estimateKey`:

```ts
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reason already stated above for `versionKey`.
		capacityKey: propKey('capacityProperty', ''),
```

The option ROW that makes `capacityProperty` bindable is Task 3; this step is only the
reading, so that Task 1 can be tested on a settings fixture.

- [ ] **Step 4: Add the figure**

In `src/domain/releaseReadiness.ts`, add to the `ReleaseReadiness` interface, after
`completedEffort`:

```ts
	/**
	 * What the release note itself declares it can take, in the view's own unit.
	 *
	 * Four readings, not three: unconfigured is no key bound, `invalid` is a bound key
	 * holding something no reader will make a number of — **a negative among them**, since
	 * nothing in this plugin writes a capacity and extension 1b therefore judges one on
	 * READ — and value-null-with-neither-flag is a bound key the note is silent at. The last
	 * two are drawn differently because they send the reader to different places: one is a
	 * property to bind, the other a number to type.
	 */
	capacity: ReleaseFigure<number>;
```

and the reader, beside `effortFigures`:

```ts
/**
 * The release's own declared capacity. `estimateValue` is the reader on purpose: it already
 * refuses a non-finite value and a negative one, and its own comment names this feature as
 * the reason it refuses negatives — so "an unreadable capacity and an unreadable estimate
 * are the same judgement" is true by construction rather than by two readers agreeing.
 */
function capacityFigure(app: App, scope: ReleaseScope, settings: ReleaseSettings): ReleaseFigure<number> {
	if (settings.capacityKey === '') return UNCONFIGURED;
	const item = scope.release?.item;
	if (item === undefined) return UNCONFIGURED;
	const raw: unknown = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.capacityKey);
	if (raw === null || raw === undefined) return { value: null, invalid: false, unconfigured: false };
	const value = estimateValue(raw);
	return value === null ? { value: null, invalid: true, unconfigured: false } : counted(value);
}
```

and wire it into the returned object in `releaseReadiness`:

```ts
		capacity: capacityFigure(app, scope, settings),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseCapacity.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole domain suite and lint**

Run: `npx vitest run test/domain && npx eslint src/domain`
Expected: PASS. If `test/domain/releaseOptions.test.ts` fails on a key count or an exhaustive
settings comparison, add `capacityKey: ''` to its expectation — that suite asserts the
resolver's whole shape on purpose.

- [ ] **Step 7: Commit**

```bash
git add src/domain/releaseReadiness.ts src/domain/releaseOptions.ts test/domain/releaseCapacity.test.ts
git commit -m "Read the capacity a release declares"
```

---

### Task 2: The possible double count

**Files:**
- Modify: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseCapacity.test.ts:` (append a second `describe`)

**Interfaces:**
- Consumes: `ScopeRow` from `src/domain/scopeRows.ts` — `{ item: BacklogItem; depth: number;
  context: boolean; memberTotal: number; memberDone: number; … }`, where `depth` is the depth
  within THIS tree and `context: true` marks an ancestor drawn only to hold a member in place;
  `isEstimated(raw: unknown): boolean` from this module.
- Produces: `ReleaseReadiness.doubleCounted: ReleaseFigure<number>` — how many members carry
  an estimate **while a descendant member in the same release carries one**.

**The count is of the ANCESTORS, not the descendants**, and the direction is load-bearing:
`docs/requirements/Capacity against commitment.md` counts "members carrying an estimate while
a descendant in the same release carries one", which is the member whose estimate may already
CONTAIN the others. The two directions agree on a chain and disagree on a fan: one estimated
Epic over two estimated PBIs is **one** possible double count, not two. A context row is
neither an ancestor nor a descendant for this purpose — it is not a member at all.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/releaseCapacity.test.ts`:

```ts
describe('estimates that may already be inside another estimate', () => {
	function doubleCountOf(vault: FakeVault): number | null {
		return readinessOf(vault).doubleCounted.value;
	}

	function baseVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', capacity: 40 } });
		return vault;
	}

	it('counts a member whose ancestor member is also estimated', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(1);
	});

	it('counts each estimated ancestor once, however deep the chain', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', parent: 'F', order: 1, release: '[[R]]', effort: 2 } });
		// `E` and `F` each cover something estimated below them; `P` covers nothing.
		expect(doubleCountOf(vault)).toBe(2);
	});

	it('counts the ancestor once, not each estimated child under it', () => {
		// The case that tells the two directions apart, and the one a chain cannot: ONE
		// estimate may already contain the two below it, so there is one possible double
		// count and not two.
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('P1.md', { frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 3 } });
		vault.addFile('P2.md', { frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: 2 } });
		expect(doubleCountOf(vault)).toBe(1);
	});

	it('does not count a descendant whose ancestor carries no estimate', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('does not count an estimated member whose children are unestimated', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]' } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('never counts through a context ancestor — an excluded note is not a member', () => {
		const vault = baseVault();
		// `E` is NOT in the release: it is drawn as context to hold `F` in place, and its
		// own estimate is no part of this release's commitment.
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('is unconfigured with no estimate key, rather than a truthful-looking zero', () => {
		const vault = baseVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[R]]', effort: 5 } });
		expect(readinessOf(vault, { estimateKey: '' }).doubleCounted).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/releaseCapacity.test.ts -t 'may already be inside'`
Expected: FAIL — `doubleCounted` is `undefined`.

- [ ] **Step 3: Implement the walk**

In `src/domain/releaseReadiness.ts`, add to the interface after `capacity`:

```ts
	/**
	 * Members carrying an estimate while a DESCENDANT member in the same release carries
	 * one — a possible double count, NAMED and never resolved. Only the vault knows whether
	 * its parent estimates are aggregates, and a view that guessed would be silently wrong
	 * in whichever direction it guessed.
	 *
	 * **The direction is the contract, not a detail.** This counts the estimate that may
	 * already CONTAIN the others, so one estimated Epic over two estimated PBIs is one, not
	 * two. The reverse reading agrees on a chain and disagrees on a fan, which is why it
	 * survived a test suite once already.
	 */
	doubleCounted: ReleaseFigure<number>;
```

and the walk beside `capacityFigure`:

```ts
/**
 * One pass over the rows the scope tree already drew, carrying the depths of the estimated
 * member ancestors still open. `rows` is depth-ordered, so an ancestor is open exactly while
 * rows deeper than it keep arriving.
 *
 * **Context rows close nothing and open nothing.** An excluded note is not a member, so its
 * own estimate is no part of this release and a member below it is not double counted by it
 * — the context-row rule, asked of this figure like every other.
 */
function doubleCountFigure(app: App, scope: ReleaseScope, settings: ReleaseSettings): ReleaseFigure<number> {
	if (settings.estimateKey === '') return UNCONFIGURED;
	// One entry per estimated member still open, and `covers` is what makes this count the
	// ANCESTOR: it is set when an estimated member arrives BELOW this one, and read when the
	// subtree closes. Counting at the arrival instead counts the descendant, which is the
	// reversed predicate — right on a chain, wrong on a fan.
	const open: { depth: number; covers: boolean }[] = [];
	let total = 0;
	const close = (depth: number): void => {
		while (open.length > 0 && open[open.length - 1].depth >= depth) {
			if (open.pop()?.covers === true) total += 1;
		}
	};
	for (const row of scope.rows) {
		close(row.depth);
		if (row.context) continue;
		if (!isEstimated(estimateOf(app, row.item, settings))) continue;
		// EVERY open estimate may already contain this one, not just the nearest: an Epic
		// whose grandchild is estimated is covering an estimate too.
		for (const entry of open) entry.covers = true;
		open.push({ depth: row.depth, covers: false });
	}
	// The last subtree has no row after it to close it.
	close(-1);
	return counted(total);
}
```

and wire it in beside `capacity`:

```ts
		doubleCounted: doubleCountFigure(app, scope, settings),
```

Two things the shape is carrying. `close` pops ancestors at or deeper than the current row
BEFORE the context check, so a context row between two members does not leave a stale ancestor
open. And the count lands on the POP, never on the arrival: an estimated member is counted
when its subtree closes and only if something estimated arrived inside it, which is what makes
one Epic over two estimated PBIs report one rather than two.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseCapacity.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Verify the invariant by reverting it**

Temporarily change `if (row.context) continue;` to `// if (row.context) continue;` and run
`npx vitest run test/domain/releaseCapacity.test.ts -t 'context ancestor'`. Expected: FAIL.
Restore the line and re-run: PASS. **Watch it fail — a comment that states a rule is not a
check.**

- [ ] **Step 6: Commit**

```bash
git add src/domain/releaseReadiness.ts test/domain/releaseCapacity.test.ts
git commit -m "Count the estimates that may already be inside another estimate"
```

---

### Task 3: The two options

**Files:**
- Modify: `src/domain/releaseOptions.ts` (the `readinessOptionItems()` list)
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Consumes: `capacityKey` (Task 1).
- Produces: `ReleaseSettings.capacityUnit: string` — the unit for BOTH halves of the
  comparison, and for the effort figures beside them (Task 4).

- [ ] **Step 1: Write the failing test**

Append to `test/domain/releaseOptions.test.ts`, inside the suite that asserts the resolver:

```ts
	it('resolves the capacity property and its unit, and leaves both empty when unset', () => {
		const bound = resolveReleaseSettings(fakeConfig({ capacityProperty: 'note.capacity', capacityUnit: 'points' }));
		expect(bound.capacityKey).toBe('capacity');
		expect(bound.capacityUnit).toBe('points');
		const unset = resolveReleaseSettings(fakeConfig({}));
		expect(unset.capacityKey).toBe('');
		expect(unset.capacityUnit).toBe('');
	});
```

Use whatever config double that file already uses in place of `fakeConfig`, and match its
own convention for a property id (`note.capacity` resolving to `capacity`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/releaseOptions.test.ts -t 'capacity property'`
Expected: FAIL — `capacityUnit` is `undefined` and the option is not offered.

- [ ] **Step 3: Add the option rows**

In `readinessOptionItems()` in `src/domain/releaseOptions.ts`, after the `estimateProperty`
entry:

```ts
		{
			type: 'property',
			key: 'capacityProperty',
			displayName: t('release.option.capacity'),
			placeholder: 'capacity',
			filter: notePropsOnly,
		},
		{
			// A TEXT box, not a property: the unit is one string for the whole view. Two
			// properties would let a release disagree with its neighbour about the unit
			// while the comparison added them up, and `40 points` in one field is a string
			// nothing can sum.
			type: 'text',
			key: 'capacityUnit',
			displayName: t('release.option.capacityUnit'),
			placeholder: 'points',
		},
```

No `default:` on the unit — an unset unit means the view says so rather than guessing a
word the vault never used.

- [ ] **Step 4: Add `capacityUnit` to the settings type and resolver**

In the `ReleaseSettings` interface, beside `capacityKey`:

```ts
	/** The unit BOTH halves of the comparison are in, and the effort figures beside them. */
	capacityUnit: string;
```

**A new field on this interface breaks a test helper, and the gate is where you find out.**
`releaseSettingsWith` in `test/helpers/releaseSettings.ts` builds a complete `ReleaseSettings`
literal field by field, so an added field makes it `string | undefined` and
`npm run typecheck:test` exits 2 — which the task's own targeted commands do not run. Add it
there in the same style as its neighbours:

```ts
		capacityUnit: '',
```

That file's own comment already records this hazard ("EVERY field, and the four below were
missing until 2026-08-29"); it happened again here, and CI caught it on both platforms after
the commit. Do not widen the helper's type, make the field optional, or suppress the error —
the builder exists to fail exactly this way.

In `resolveReleaseSettings`, beside `capacityKey`:

```ts
		// Trimmed: the value is drawn into a sentence beside two numbers, and a padded unit
		// reads as a spacing bug rather than as data.
		capacityUnit: str('capacityUnit').trim(),
```

- [ ] **Step 5: Add the two labels to the catalog**

In `src/i18n/en.ts`, beside the other `release.option.*` keys:

```ts
	'release.option.capacity': 'Capacity property',
	'release.option.capacityUnit': 'Estimation unit',
```

- [ ] **Step 6: Bind it from the initializer too**

Every other optional property this view reads is in `RELEASE_SUGGESTED_KEYS`
(`src/view/release/init.ts`), including `estimateProperty` — that list is what the toolbar's
✨ binds and then backfills. A property missing from it is one the press cannot reach, so a
reader who initializes the view is told it succeeded while this feature stays unconfigured.
Add the row beside `estimateProperty`:

```ts
	{ option: 'capacityProperty', suggested: 'capacity' },
```

**`capacityUnit` does NOT join it, and not by oversight.** That list adopts PROPERTY keys, and
`RELEASE_SUGGESTED_VALUES` beside it adopts value vocabularies — the unit is neither, and
there is no honest default for it: a guessed unit is exactly what this feature exists to
prevent. It stays a box the reader fills.

Update `test/view/release/init.test.ts`'s expectations for the adopted-key set — it asserts
which options a press binds, so a new row fails it until the expectation names it.

- [ ] **Step 7: Register it among the release-owned properties**

`releaseOwnedProperties()` in `src/domain/settingsConsistency.ts` enumerates every property
this view reads **on a release note**, and `releaseNoteProblems()` reports two roles sharing
one key. Capacity is read on the release note, so it belongs there — without it, binding the
capacity to the same key as the status is not reported, and a status word written over a
numeric capacity makes it unreadable with nothing having warned. Add the row:

```ts
		{ role: 'releaseCapacity', key: settings.capacityKey },
```

widen the `ReleaseNoteRole` union with `'releaseCapacity'`, and add the catalog role
`'property.releaseCapacity'` the collision sentence names it by. The estimate, dependency and
risk keys are deliberately NOT in that list and stay out: they are read on MEMBERS, not on the
release note, which is the distinction the table draws.

Add a case to `test/domain/settingsConsistency.test.ts` binding `capacityProperty` to the same
key as `releaseStatusProperty` and asserting the collision is reported.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/domain/releaseOptions.test.ts test/domain/settingsConsistency.test.ts test/view/release/init.test.ts test/i18n && npx eslint src`
Expected: PASS. `test/i18n/optionLabels.test.ts` will fail if any message quotes either
label — it must be passed as a parameter instead.

- [ ] **Step 9: Commit**

```bash
git add src/domain/releaseOptions.ts src/domain/settingsConsistency.ts src/view/release/init.ts src/i18n/en.ts test/helpers/releaseSettings.ts test/helpers/release.ts test/domain/releaseOptions.test.ts test/domain/settingsConsistency.test.ts test/view/release/init.test.ts
git commit -m "Offer the capacity property and the unit it is in"
```

---

### Task 4: The figure on the strip

**Files:**
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `src/i18n/en.ts`
- Modify: `test/view/releaseReadiness.test.ts` (the two effort assertions gain a unit)
- Test: `test/view/releaseCapacity.test.ts` (create)

**Interfaces:**
- Consumes: `ReleaseReadiness.capacity` and `.doubleCounted` (Tasks 1–2),
  `ReleaseSettings.capacityKey` / `.capacityUnit` (Tasks 1 and 3),
  `ReleaseReadiness.estimatedEffort` (already there — this is the commitment, never re-summed).
- Produces: nothing other tasks read.

The seven states, and the sentence each draws:

| State | Figure (`.pbl-rel-figure`) | Note (`.pbl-rel-unreadable`) |
| --- | --- | --- |
| capacity > 0, commitment ≥ capacity | `capacityOver` | — |
| capacity > 0, commitment < capacity | `capacityUnder` | — |
| capacity 0 | `capacityNoPct` | `capacityZero` |
| capacity > 0, ratio overflows | `capacityNoPct` | `capacityPctOverflow` |
| capacity invalid | `committed` | `capacityUnreadable` |
| capacity key unbound | `committed` | `capacityUnconfigured` |
| capacity absent on the note | `committed` | `capacityAbsent` |
| unit unset (whatever the capacity is, and whether or not there is a commitment) | — | `capacityNoUnit` |
| commitment unreadable or unconfigured | — | the capacity's own note, and the unit's if unset |

**A release with NO MEMBERS draws none of this, and that is deliberate rather than an
oversight.** `drawSummary` returns before the strip exists when `members === 0`
(`renderScope.ts`), so an empty release shows no capacity figure. Reviewed and kept: the
commitment there is a zero nobody measured, and `0 of 40 pts committed (0%, 40 left)` would
report an empty release as having its whole capacity free — the same defect as the
unestimated case above, reached by a different road. An empty release has nothing to compare,
and [[Summing up a release]] extension 1a already says every figure on this strip reads as
nothing to count there. Do not move the capacity outside that gate.

The double count is drawn **outside this table**, once, on every path — it counts estimates
and reads neither the capacity nor the unit, so no state above suppresses it.

- [ ] **Step 1: Write the failing test**

Create `test/view/releaseCapacity.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { useViewHarness } from '../helpers/view';
import { t } from '../../src/i18n/t';
import { FakeVault } from '../helpers/vault';

/**
 * The capacity comparison on the summary strip. Asserted by MESSAGE KEY rather than by
 * wording — `docs/requirements/Tests do not read English.md` — so a copy edit is not a red
 * build and the second CI locale leg is not asserting English.
 */
describe('capacity against commitment on the strip', () => {
	useViewHarness();

	function capacityVault(capacity: unknown): FakeVault {
		const vault = scopeVault();
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 52 });
		if (capacity !== undefined) vault.setFrontmatter('R.md', { type: 'Release', capacity });
		return vault;
	}

	const CONFIGURED = {
		...RELEASE_CONFIG,
		estimateProperty: 'note.effort',
		capacityProperty: 'note.capacity',
		capacityUnit: 'pts',
	};

	function stripText(capacity: unknown, config: Record<string, unknown> = CONFIGURED): string {
		const { view, containerEl } = makeReleaseView(capacityVault(capacity), config);
		view.pick('R.md');
		return containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
	}

	it('names all four numbers and the unit when over-committed', () => {
		expect(stripText(40)).toContain(
			t('release.scope.capacityOver', { commitment: 52, capacity: 40, unit: 'pts', pct: 130, over: 12 }),
		);
	});

	it('says what is left when under-committed', () => {
		expect(stripText(60)).toContain(
			t('release.scope.capacityUnder', { commitment: 52, capacity: 60, unit: 'pts', pct: 87, left: 8 }),
		);
	});

	it('withholds the percentage when the ratio overflows, and says why', () => {
		// A positive capacity is not enough on its own — the guard is on the RESULT.
		const text = stripText(Number.MIN_VALUE);
		expect(text).toContain(t('release.scope.capacityPctOverflow'));
		expect(text).not.toContain('Infinity');
		expect(text).not.toContain('NaN');
		// NOT `not.toContain('%')`: the strip carries the progress percentage and the effort
		// figure's own, so that assertion fails however correctly this figure behaves. What
		// must be absent is a capacity sentence carrying a percentage at all.
		expect(text).not.toContain(t('release.scope.capacityOver', { commitment: 52, capacity: 0, unit: 'pts', pct: 0, over: 52 }));
	});

	it('withholds the percentage at zero capacity, and says why', () => {
		const text = stripText(0);
		expect(text).toContain(t('release.scope.capacityNoPct', { commitment: 52, capacity: 0, unit: 'pts', over: 52 }));
		expect(text).toContain(t('release.scope.capacityZero'));
	});

	it('reports a negative capacity as unreadable rather than comparing against it', () => {
		const text = stripText(-5);
		expect(text).toContain(t('release.scope.committed', { commitment: 52, unit: 'pts' }));
		expect(text).toContain(t('release.scope.capacityUnreadable'));
		expect(text).not.toContain('-5');
	});

	it('tells an unbound key from a note that declares nothing', () => {
		expect(stripText(40, { ...CONFIGURED, capacityProperty: '' })).toContain(
			t('release.scope.capacityUnconfigured'),
		);
		expect(stripText(undefined)).toContain(t('release.scope.capacityAbsent'));
	});

	it('draws no comparison at all with no unit set', () => {
		const text = stripText(40, { ...CONFIGURED, capacityUnit: '' });
		expect(text).toContain(t('release.scope.capacityNoUnit'));
		expect(text).not.toContain(t('release.scope.capacityOver', { commitment: 52, capacity: 40, unit: '', pct: 130, over: 12 }));
	});

	it('draws no comparison for a release nobody has estimated', () => {
		// The sum is a real `0` there — absence presented as a measurement is the defect the
		// effort figure beside this one already refuses.
		const vault = capacityVault(40);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]' });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).not.toContain(t('release.scope.capacityUnder', { commitment: 0, capacity: 40, unit: 'pts', pct: 0, left: 40 }));
	});

	it('still compares a release whose members all estimate zero', () => {
		// `0` is a valid estimate: the guard reads the COUNT of estimated members, never the
		// sum, so a genuinely zero commitment is a comparison and not an absence.
		const vault = capacityVault(40);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 0 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.capacityUnder', { commitment: 0, capacity: 40, unit: 'pts', pct: 0, left: 40 }),
		);
	});

	it('reports a missing unit even with no commitment to label', () => {
		// Two unbound mappings, two notes. Behind the commitment return the reader was told
		// about one of them.
		const text = stripText(40, { ...CONFIGURED, estimateProperty: '', capacityUnit: '' });
		expect(text).toContain(t('release.scope.capacityNoUnit'));
	});

	it('names a double count even when no comparison can be drawn', () => {
		// It counts estimates: neither the capacity nor the unit is an input to it.
		const vault = capacityVault(40);
		vault.setFrontmatter('E.md', { type: 'Epic', order: 1, release: '[[R]]', effort: 20 });
		const { view, containerEl } = makeReleaseView(vault, { ...CONFIGURED, capacityUnit: '' });
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.doubleCount', { count: 1 }),
		);
	});

	it('names the capacity property on every path with a bound key', () => {
		// The unreadable state needs it MOST: it is the one telling the reader to go and fix
		// a value, and it says nothing about where.
		for (const capacity of [40, 0, -5, undefined]) {
			const { view, containerEl } = makeReleaseView(capacityVault(capacity), CONFIGURED);
			view.pick('R.md');
			expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
				t('release.scope.provenanceCapacity', { property: 'capacity', unit: 'pts' }),
			);
		}
	});

	it('drops the unit clause rather than reading a blank one out', () => {
		const text = stripText(40, { ...CONFIGURED, capacityUnit: '' });
		expect(text).toContain(t('release.scope.provenanceCapacityNoUnit', { property: 'capacity' }));
		expect(text).not.toContain(t('release.scope.provenanceCapacity', { property: 'capacity', unit: '' }));
	});

	it('names no property where the key itself is unbound', () => {
		const text = stripText(40, { ...CONFIGURED, capacityProperty: '' });
		expect(text).not.toContain(t('release.scope.provenanceCapacity', { property: '', unit: 'pts' }));
	});

	it('names a possible double count beside the figure, and only when there is one', () => {
		const vault = capacityVault(40);
		vault.setFrontmatter('E.md', { type: 'Epic', order: 1, release: '[[R]]', effort: 20 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.doubleCount', { count: 1 }),
		);
		expect(stripText(40)).not.toContain(t('release.scope.doubleCount', { count: 0 }));
	});
});
```

Check `scopeVault()`'s own fixture in `test/helpers/release.ts` first: `R.md`'s members and
their efforts decide the numbers above. Adjust the expected `commitment`, `pct`, `over` and
`left` to what that fixture actually sums to — the assertions are about the shape, not about
52 in particular.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/view/releaseCapacity.test.ts`
Expected: FAIL — the keys do not exist, so `t()` is a typecheck error and the strip draws
nothing.

- [ ] **Step 3: Add the catalog sentences**

In `src/i18n/en.ts`, beside the other `release.scope.*` figures:

```ts
	/**
	 * The comparison, in the unit the view was told to use. Four numbers in one sentence
	 * rather than four figures: the strip already carries six, and two percentages beside
	 * each other read as competing.
	 */
	'release.scope.capacityOver': '{commitment} of {capacity} {unit} committed ({pct}%, {over} over)',
	'release.scope.capacityUnder': '{commitment} of {capacity} {unit} committed ({pct}%, {left} left)',
	/** Zero capacity: the other three figures still answer, the percentage cannot. */
	'release.scope.capacityNoPct': '{commitment} of {capacity} {unit} committed ({over} over)',
	'release.scope.capacityZero': 'A percentage needs a capacity',
	/**
	 * A positive capacity is not enough for a finite percentage: `estimateValue` accepts any
	 * finite non-negative number, so a capacity near `Number.MIN_VALUE` overflows the ratio
	 * itself. The three figures still answer; the fourth says why it cannot.
	 */
	'release.scope.capacityPctOverflow': 'The utilization is too large to state',
	/** The commitment alone, where the capacity half cannot be read. */
	'release.scope.committed': '{commitment} {unit} committed',
	'release.scope.capacityUnreadable': 'Capacity is not a number',
	'release.scope.capacityUnconfigured': 'Capacity is not configured',
	/** The key IS bound and this release is silent at it — a number to type, not a property
	 *  to bind, which is why it is not the sentence above. */
	'release.scope.capacityAbsent': 'This release declares no capacity',
	/** Extension 3a: unlabelled arithmetic is two numbers whose meaning the reader supplies,
	 *  which is the thing this feature exists to prevent. */
	'release.scope.capacityNoUnit': 'The capacity unit is not set',
	'release.scope.doubleCount': {
		one: '{count} member may double count',
		other: '{count} members may double count',
	},
	/** Drawn on every path with a bound capacity key — the unreadable one included, since
	 *  that reader is the one who needs to know which key to repair. */
	'release.scope.provenanceCapacity': 'Capacity reads {property}, in {unit}.',
	/** The same sentence with no unit set. A separate key rather than an empty parameter:
	 *  `Capacity reads capacity, in .` is what a screen reader would say otherwise, and a
	 *  message assembled around a blank is not a sentence in any language. */
	'release.scope.provenanceCapacityNoUnit': 'Capacity reads {property}.',
```

and change the two effort keys to take the same unit, each gaining an unlabelled twin:

```ts
	'release.scope.effort': '{done} of {total} {unit} ({pct}%)',
	/** The same figure with no unit configured. `pts` was hard-coded here until 2026-09-03,
	 *  which contradicted the configurable unit beside it: a vault estimating in person days
	 *  was told its own numbers were points. An unlabelled number is honest; a guessed unit
	 *  is not. */
	'release.scope.effortNoUnit': '{done} of {total} ({pct}%)',
	'release.scope.effortEstimated': '{total} {unit} estimated',
	'release.scope.effortEstimatedNoUnit': '{total} estimated',
```

- [ ] **Step 4: Draw the figure**

In `src/view/release/renderReadiness.ts`, rename the existing exported
`drawReadinessFigures` body to a private `drawEffortFigures` (same parameters, same body),
and add a new exported entry so the capacity is drawn from ONE place rather than from each of
the effort path's exits — the defect this module's own comment records against
`drawEstimateProvenance`:

```ts
/** The effort figures, then the capacity comparison beside them. ONE call site for the
 *  second, so it cannot be forgotten on one of the first's three exits. */
export function drawReadinessFigures(
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
): void {
	drawEffortFigures(sumEl, readiness, settings);
	drawCapacity(sumEl, readiness, settings);
}
```

Update the two `drawEffort` calls that pass a unit:

```ts
function drawEffort(sumEl: HTMLElement, total: number, done: number | null, unit: string): void {
	if (done === null) {
		const text = unit === ''
			? t('release.scope.effortEstimatedNoUnit', { total })
			: t('release.scope.effortEstimated', { total, unit });
		sumEl.createSpan({ cls: 'pbl-rel-figure', text });
		return;
	}
	const pct = total === 0 ? 0 : Math.round(100 * (done / total));
	const text = unit === ''
		? t('release.scope.effortNoUnit', { done, total, pct })
		: t('release.scope.effort', { done, total, pct, unit });
	sumEl.createSpan({ cls: 'pbl-rel-figure', text });
}
```

(its caller passes `settings.capacityUnit`), and add the comparison:

```ts
/**
 * The capacity comparison — `docs/requirements/Commitment against declared capacity.md`.
 *
 * **The commitment is `estimatedEffort` and is never re-summed here.** That figure and the
 * `estimated` criterion are one walk in `releaseReadiness.ts`; a second sum in the renderer
 * is the drift that module exists to prevent.
 */
function drawCapacity(sumEl: HTMLElement, readiness: ReleaseReadiness, settings: ReleaseSettings): void {
	// The SAME count `drawEffortFigures` reads, computed once and passed to both, so the two
	// can never disagree about whether this release has been estimated at all.
	const estimatedMembers = readiness.criteria.find((criterion) => criterion.key === 'estimated')?.cleared ?? 0;
	drawCapacityFigures(sumEl, readiness, settings, estimatedMembers);
	// **Outside the comparison, and drawn once.** The double count is a count of ESTIMATES:
	// it does not read the capacity, it does not read the unit, and it answers on every path
	// where the comparison cannot be drawn at all. Inside those branches it was suppressed
	// for reasons that have nothing to do with it — an unset unit, an overflowed effort sum.
	drawDoubleCount(sumEl, readiness);
	// **Every path with a bound key, not just the one that draws a percentage.** The
	// provenance is what tells the reader WHICH frontmatter key to go and repair, so the
	// unreadable state is the one that needs it most and the one five early returns would
	// skip. Omitted only where the key itself is unbound — there is no property to name.
	// This is `drawEstimateProvenance`'s own lesson, which a review bot had to teach once
	// already on the path above.
	if (settings.capacityKey === '') return;
	const property = settings.capacityKey;
	sumEl.createSpan({
		cls: 'pbl-sr-only',
		text:
			settings.capacityUnit === ''
				? t('release.scope.provenanceCapacityNoUnit', { property })
				: t('release.scope.provenanceCapacity', { property, unit: settings.capacityUnit }),
	});
}

function drawCapacityFigures(
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	estimatedMembers: number,
): void {
	const capacity = readiness.capacity;
	// The capacity's own state is named even with no commitment to compare it against —
	// extension 2b's "both halves are named" — but a comparison needs both numbers.
	if (capacity.unconfigured) note(sumEl, t('release.scope.capacityUnconfigured'));
	else if (capacity.invalid) note(sumEl, t('release.scope.capacityUnreadable'));
	else if (capacity.value === null) note(sumEl, t('release.scope.capacityAbsent'));
	// **The unit is checked BEFORE the commitment, and that order is the requirement.**
	// Extension 3a makes an unset unit a missing MAPPING, reported like an unbound key — so
	// it is reported whether or not there is a commitment to label. Behind the commitment
	// return it went unreported exactly when the effort sum was itself unreadable, which is
	// a reader with two unbound mappings being told about one.
	const unit = settings.capacityUnit;
	if (unit === '') {
		note(sumEl, t('release.scope.capacityNoUnit'));
		return;
	}
	const commitment = readiness.estimatedEffort.value;
	// The effort figures beside this one already said why there is no total.
	if (commitment === null) return;
	// **A release nobody has estimated sums to zero, and that zero is not a measurement.**
	// `effortFigures` starts its total at 0 and adds nothing, so `estimatedEffort` is a real
	// `0` rather than a null — which would draw `0 of 40 pts committed (0%, 40 left)` and
	// report a completely unsized release as having its whole capacity free. Decided from
	// the COUNT of estimated members, never from the sum, for the reason `drawEffortFigures`
	// states one function above: `0` is a valid estimate, so a release whose members all
	// estimate zero is a genuine zero commitment and still compares.
	if (estimatedMembers === 0) return;
	if (capacity.value === null) {
		figure(sumEl, t('release.scope.committed', { commitment, unit }));
		return;
	}
	const over = commitment - capacity.value;
	if (capacity.value === 0) {
		figure(sumEl, t('release.scope.capacityNoPct', { commitment, capacity: capacity.value, unit, over }));
		note(sumEl, t('release.scope.capacityZero'));
		return;
	}
	// **Divide BEFORE multiplying, and check the result** — `drawEffort`'s own reason, plus
	// one this figure adds: a capacity below 1 with a huge commitment overflows the ratio
	// itself, and `∞%` is a percentage nobody can act on.
	const pct = Math.round(100 * (commitment / capacity.value));
	if (!Number.isFinite(pct)) {
		// The capacity IS a number and IS positive — it is the ratio that overflowed — so
		// this is not `capacityUnreadable`, which would send the reader to fix a value that
		// is fine. Same three figures as the zero case, a different reason for the fourth.
		figure(sumEl, t('release.scope.capacityNoPct', { commitment, capacity: capacity.value, unit, over }));
		note(sumEl, t('release.scope.capacityPctOverflow'));
		return;
	}
	figure(
		sumEl,
		over >= 0
			? t('release.scope.capacityOver', { commitment, capacity: capacity.value, unit, pct, over })
			: t('release.scope.capacityUnder', { commitment, capacity: capacity.value, unit, pct, left: -over }),
	);
}

/** Absent rather than present and empty — extension 4a. */
function drawDoubleCount(sumEl: HTMLElement, readiness: ReleaseReadiness): void {
	const count = readiness.doubleCounted.value;
	if (count === null || count === 0) return;
	figure(sumEl, t('release.scope.doubleCount', { count }));
}

function figure(sumEl: HTMLElement, text: string): void {
	sumEl.createSpan({ cls: 'pbl-rel-figure', text });
}

function note(sumEl: HTMLElement, text: string): void {
	sumEl.createSpan({ cls: 'pbl-rel-unreadable', text });
}
```

If `max-lines-per-function` (100) or `complexity` (16) rejects `drawCapacity`, split the
three no-comparison readings into their own `capacityNote(readiness)` returning a string or
null — not by widening the rule.

- [ ] **Step 5: Update the two existing effort assertions**

`test/view/releaseReadiness.test.ts` asserts the effort text. Its config gains
`capacityUnit: 'pts'` so its existing expectations still read as before; the one test that
does NOT set a unit asserts `release.scope.effortNoUnit` instead.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/view/releaseCapacity.test.ts test/view/releaseReadiness.test.ts test/i18n`
Expected: PASS. `test/i18n/parity.ts` and `projections.test.ts` cover the new keys
automatically — a key rendering UNMARKED there means a sentence escaped the catalog.

- [ ] **Step 7: Give the harness something to draw, then look at it**

**The page cannot show this figure as it stands, and the plan claimed otherwise.**
`test/harness/mountRelease.ts`'s `FULL` spreads `RELEASE_CONFIG`, which binds neither
`capacityProperty` nor `capacityUnit`, and `Releases/0.8.md` in `test/helpers/release.ts`
declares no capacity — so the URL below would render the unconfigured and no-unit refusals
rather than the comparison whose wrapping is the whole reason for looking.

Bind them in `FULL` beside the two risk vocabularies that are already there for this exact
reason (that file's own comment explains why a harness-only binding belongs there rather than
in `RELEASE_CONFIG`, which four init suites read as the unbound case):

```ts
	capacityProperty: 'note.capacity',
	capacityUnit: 'pts',
```

and give the release a `capacity` **in `releaseHarnessVault()`, the vault this mount actually
builds** (`test/harness/mountRelease.ts`, the `release('Releases/0.8.md', { … })` call). NOT
`scopeVault()` in `test/helpers/release.ts` — the browser entry never loads that one, and an
edit there changes nothing on the page. This plan pointed at the wrong fixture twice before a
review bot traced the mount to `releaseHarnessVault(variant)`; trace it yourself rather than
trusting either sentence.

Pick a value BELOW that release's summed member estimates, so the page shows the
over-committed case: the state with the most text in it, and therefore the one that wraps
first. Read the members `releaseHarnessVault` gives `Releases/0.8.md` and their estimate
values before choosing the number — a capacity above the sum draws the under-committed
sentence instead, which is shorter and answers less.

Then run `npm run harness -- test/harness/release.ts` and open
`.harness/index.html?pick=Releases/0.8.md`. Expected: the comparison on the strip, wrapping to
a second line at full width, as the spec's mock showed. This is the check jsdom cannot make.

The harness vault is the harness's own, so this edit is invisible to the rest of the suite —
but `npx vitest run test/harness` covers the mount, so run that before committing.

- [ ] **Step 8: Commit**

```bash
git add src/view/release/renderReadiness.ts src/i18n/en.ts test/harness/mountRelease.ts test/view/releaseCapacity.test.ts test/view/releaseReadiness.test.ts
git commit -m "State the capacity a release declared against what it committed"
```

---

### Task 5: The harness bundle gate

**Files:**
- Create: `test/harness/bundles.test.ts`
- Create: `docs/bugs/The release harness entry could not build.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks read.

The defect is already fixed (commit `2b8db56`): `test/helpers/release.ts` imported `flush`
from `test/helpers/view.ts`, which reads `node:fs` and imports vitest, so esbuild refused the
whole graph and `npm run harness -- test/harness/release.ts` could not build. This task is the
gate, asked at the forbidden thing rather than at today's four entries.

- [ ] **Step 1: Write the failing test**

```ts
import { readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

/**
 * Every harness entry must BUNDLE. The suite runs each mount under vitest, where `node:fs`
 * and vitest itself resolve fine — so a helper that reaches for either passes every test and
 * still makes the page unbuildable, which is what happened to `release.ts` and left the
 * release view unlookable outside Obsidian for the one class of question jsdom cannot answer.
 *
 * Asked of the GRAPH rather than of a list of banned imports in named files: the next entry
 * is exactly the one nobody would have listed.
 */
describe('the harness entries bundle for a browser', () => {
	/**
	 * **Discovered, never listed.** A frozen list of today's entries passes the day somebody
	 * adds a fifth with the same defect — which is the regression this gate exists to catch,
	 * so a list would state the rule and check something narrower.
	 *
	 * Every non-test module under `test/harness/` is bundled, not only the four files
	 * `scripts/harness.mjs` documents as entries: they are all browser modules, an entry is
	 * only a module nothing imports, and a superset needs no registry to be kept in step.
	 */
	const ENTRIES = readdirSync('test/harness')
		.filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
		.map((name) => `test/harness/${name}`)
		.sort();

	it('finds the entries rather than naming them', () => {
		// The discovery is the gate's load-bearing half, so it is asserted rather than
		// assumed: a glob that silently matched nothing would make every case below vacuous.
		expect(ENTRIES).toContain('test/harness/release.ts');
		expect(ENTRIES.length).toBeGreaterThanOrEqual(4);
	});

	it.each(ENTRIES)('%s resolves to browser-safe modules only', async (entry) => {
		const result = await build({
			entryPoints: [entry],
			bundle: true,
			write: false,
			format: 'iife',
			target: 'es2020',
			alias: { obsidian: './test/helpers/obsidian-mock.ts' },
			define: { 'process.env.NODE_ENV': '"development"' },
			metafile: true,
			logLevel: 'silent',
		});
		const reached = Object.keys(result.metafile.inputs);
		expect(reached.filter((path) => path.startsWith('node:') || /node_modules\/vitest\//.test(path))).toEqual([]);
	});
});
```

If a discovered module turns out not to bundle for a reason that is CORRECT — a deliberate
node-only helper that no page imports — do not narrow the glob to exclude it by name: move it
out of `test/harness/`, where a browser module belongs, or state the exclusion as a rule the
next file will also be held to.

- [ ] **Step 2: Run it against the PRE-FIX tree to watch it fail**

```bash
git stash push --keep-index 2>/dev/null || true
git show 2b8db56^:test/helpers/release.ts > /tmp/release-prefix.ts
cp test/helpers/release.ts /tmp/release-fixed.ts && cp /tmp/release-prefix.ts test/helpers/release.ts
npx vitest run test/harness/bundles.test.ts
```

Expected: FAIL on `test/harness/release.ts` — esbuild throws `Could not resolve "node:fs"`.
Then restore: `cp /tmp/release-fixed.ts test/helpers/release.ts`.

- [ ] **Step 3: Run it against the fixed tree**

Run: `npx vitest run test/harness/bundles.test.ts`
Expected: PASS — the discovery case plus one per discovered module.

- [ ] **Step 4: Write the bug note**

`docs/bugs/The release harness entry could not build.md`, with the frontmatter every note in
`docs/bugs/` carries:

```yaml
---
type: Bug
parent: "[[A browser harness without Obsidian]]"
order: 10
status: Done
area: test
priority: P2
created: 2026-09-03
closed: 2026-09-03
source: "Found while mocking the capacity figure for the 2026-09-03 increment — the release
  harness entry would not bundle at all"
files:
  - test/helpers/release.ts
  - test/harness/bundles.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---
```

Pick `order` so it does not collide with an existing child of that parent
(`grep -h '^order:' $(grep -l 'A browser harness without Obsidian' docs/bugs/*.md)`), and
state in the body: the symptom (`npm run harness -- test/harness/release.ts` failing on
`node:fs`), the cause (a browser-bundled helper importing a vitest-and-node one for a one-line
`setTimeout`), what it cost (the release view unlookable outside Obsidian, which is where
appearance, focusability and geometry are answered), the fix, and the gate above.

- [ ] **Step 5: Run the docs and lint gates**

Run: `node scripts/docs-check.mjs && npx markdownlint-cli2 "docs/bugs/*.md"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/harness/bundles.test.ts docs/bugs/
git commit -m "Gate every harness entry on bundling for a browser"
```

---

### Task 6: The register, and the changelog

**Files:**
- Modify: `docs/requirements/Commitment against declared capacity.md`
- Modify: `docs/requirements/Capacity against commitment.md`
- Modify: `docs/superpowers/specs/2026-09-03-capacity-against-commitment-design.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything built above.
- Produces: nothing.

- [ ] **Step 1: Close the PBI and correct where it lives**

In `docs/requirements/Commitment against declared capacity.md`: `status: Open` → `status: Done`,
and replace the opening `Nothing yet.` paragraph with what was built and when. In
`## Where it lives`, replace `src/view/render/` — the BACKLOG view's render directory — with
`src/view/release/renderReadiness.ts`, and replace the `src/domain/readItems.ts` sentence with
`src/domain/releaseReadiness.ts`, naming the cycle that decided it.

- [ ] **Step 2: Correct the feature note's refusal**

In `docs/requirements/Capacity against commitment.md`, the sentence
"A negative capacity is refused where it is entered, since no unit this feature names can be
less than none." No surface can refuse it — nothing in this plugin writes a capacity. Replace
with the read-time judgement its own PBI specifies, keeping the reason:

> A negative capacity is **reported as unreadable on read**, exactly as a non-numeric one is,
> with no comparison, no difference and no utilization drawn from it — nothing here writes a
> capacity, so there is no entry surface that could refuse one. No unit this feature names can
> be less than none, so a negative value is a typo rather than a quantity.

Set the feature's own `status` to `Done` only if [[Commitment against declared capacity]] is
its last open child — check with
`grep -l 'parent: "\[\[Capacity against commitment\]\]"' docs/requirements/*.md`.

- [ ] **Step 3: Correct the spec's Slice A**

In the spec, `## Slice A` says the capacity goes on `ReleaseRow` in `domain/releases.ts`.
Replace with `ReleaseReadiness` in `domain/releaseReadiness.ts` and the cycle reason from this
plan's Global Constraints. A spec left promising a module the code does not have is the defect
the register's own rules warn against.

- [ ] **Step 4: Add the changelog entries**

Under `## [Unreleased]` → `### Added` in `CHANGELOG.md`, one sentence each, under the existing
headings rather than new copies of them:

```markdown
- A release now states the capacity it declared against the effort committed to it — the
  difference, the utilization and any estimate that may already be inside another one — in a
  unit the view is told once.
```

and under `### Changed`:

```markdown
- The release summary's effort figures now read in the unit the view declares rather than
  always saying `pts`, and say nothing about units where none is set.
```

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: all seven steps PASS.

- [ ] **Step 6: Commit and push**

```bash
git add docs/ CHANGELOG.md
git commit -m "Close the capacity PBI, and correct what its notes promised"
git push -u origin claude/next-increment-brainstorm-7pr3nj
```

- [ ] **Step 7: Say what still needs a live vault**

The harness answers layout on Obsidian's DEFAULT colours. A themed vault's colours and accent,
and anything Bases hands the view, are not answered here: report that the strip still owes a
live-vault check (`npm run test-build`, then open `docs/Product Backlog.base`), and say so
plainly rather than reporting the increment closed.
