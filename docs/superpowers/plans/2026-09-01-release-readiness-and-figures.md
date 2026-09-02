# Release readiness and the figures beside it — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the release view three readiness criteria and the summary figures that are
those same predicates counted, computed in one walk so no number is derived twice.

**Architecture:** One new pure module (`src/domain/releaseReadiness.ts`) walks the members
`releaseScope` already resolved and returns the three verdicts and the five figures together.
One new render module (`src/view/release/renderReadiness.ts`) draws a chip row and the extra
figures, called from `drawHeader` after `drawSummary`. Five new options on the release view's
own bag. Nothing writes.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0 floor), vitest (node for
`domain/`, jsdom for `view/`), esbuild, ESLint with per-directory `no-restricted-imports`.

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`. Each may reach anything below it
  and nothing above. `i18n/` is a leaf below every layer. Violations fail `npm run lint`.
- **400-line max per `src/` file**, 450 for `test/**`. Enforced by lint.
- **Every user-visible sentence goes through `src/i18n/en.ts`.** `domain/releaseReadiness.ts`
  and `view/release/renderReadiness.ts` are both swept directories: a bare capitalised string
  at a setter, at `new Notice`, at `setTooltip(el, …)`, or at one of the thirteen banned
  option-bag properties (`text`/`label`/`title`/`heading`/`description`/`placeholder`/`cta`/
  `ctaLabel`/`fieldName`/`name`/`displayName`/`reason`/`'aria-label'`) fails lint. Property
  keys and the vault's own risk values are **data** and never enter the catalog.
- **Nothing in this increment writes.** No `applySafely`, no `applyPropertyWrites`, no plan,
  no undo slot.
- **`setCssProps` over inline styles**; sentence-case UI text; no global `app`.
- **`npm run check`** is the gate: `build && typecheck:test && lint && lint:md &&
  test:coverage && analyze && docs`. All seven, before every commit. Coverage thresholds in
  `vitest.config.mts` only ever go up.
- **Stylesheet:** edit a partial in `styles/`, never the generated root `styles.css`. A new
  partial must be imported by `styles/index.css` or `npm run build` fails.
- **Context rows are never counted.** An `outsideFilter` or context ancestor is not a member:
  no denominator, no figure, no verdict.
- **Commit style:** subject in the imperative, body saying why. End every message with the
  two trailer lines this repository uses (`Co-Authored-By:` and `Claude-Session:`).

---

### Task 1: The five options, and how they resolve

**Files:**
- Modify: `src/domain/releaseOptions.ts` (the `ReleaseSettings` interface, the option
  declarations in `getReleaseViewOptions`, and the `resolveReleaseSettings` return)
- Modify: `src/i18n/en.ts` (five option labels, two hints)
- Test: `test/domain/releaseOptions.test.ts`
- Modify: `test/helpers/releaseSettings.ts` (the five new fields default to unconfigured)

**Interfaces:**
- Consumes: `configReaders(config)` giving `propKey`, `list`, `dedupe`; `notePropsOnly`.
- Produces: `ReleaseSettings` gains `estimateKey: string`, `dependsOnKey: string`,
  `riskKey: string`, `criticalRiskValues: string[]`, `addressedRiskValues: string[]`.
  Tasks 2–6 all read these names.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/releaseOptions.test.ts`, inside its existing top-level `describe`:

```ts
it('resolves the readiness keys, and leaves an unconfigured one empty', () => {
    const bound = resolveReleaseSettings(
        fakeConfig({
            estimateProperty: 'note.effort',
            dependsOnProperty: 'note.dependsOn',
            riskProperty: 'note.risk',
            criticalRiskValues: 'High, Critical',
            addressedRiskValues: 'Mitigated',
        }),
    );
    expect(bound.estimateKey).toBe('effort');
    expect(bound.dependsOnKey).toBe('dependsOn');
    expect(bound.riskKey).toBe('risk');
    expect(bound.criticalRiskValues).toEqual(['High', 'Critical']);
    expect(bound.addressedRiskValues).toEqual(['Mitigated']);

    // Absence is a value: an unbound key is '' and an untouched list is empty, never a
    // guessed default. A criterion reading these must be able to say "not configured".
    const bare = resolveReleaseSettings(fakeConfig({}));
    expect(bare.estimateKey).toBe('');
    expect(bare.dependsOnKey).toBe('');
    expect(bare.riskKey).toBe('');
    expect(bare.criticalRiskValues).toEqual([]);
    expect(bare.addressedRiskValues).toEqual([]);
});
```

If the suite's existing config helper is not named `fakeConfig`, use whatever that file
already calls it — read the top of the file first and match it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/releaseOptions.test.ts -t 'readiness keys'`
Expected: FAIL — `bound.estimateKey` is `undefined`, and TypeScript reports the five
properties do not exist on `ReleaseSettings`.

- [ ] **Step 3: Add the fields to `ReleaseSettings`**

In `src/domain/releaseOptions.ts`, beside `descriptionKey` in the interface:

```ts
	/**
	 * The member's own effort estimate, read as a NUMBER. Three readers share it — the
	 * estimated-effort sum, the completed-effort sum and the unestimated count — which is
	 * why it is one key and not three: they are one predicate asked three ways.
	 *
	 * Suggested `effort`, which is `estimationOptions.ts`'s own key for the same concept,
	 * so a vault pressing ✨ in both views lands on one property rather than two.
	 */
	estimateKey: string;
	/** The member's prerequisites. What CLEARS one is this view's own `stateKey` and its
	 *  done values — see `releaseReadiness.ts` for why that is not a sixth option. */
	dependsOnKey: string;
	riskKey: string;
	/** Which risk values are critical. A vocabulary is the vault's own, so there is no
	 *  default: an empty list means the criterion is unconfigured, not that nothing is
	 *  critical. */
	criticalRiskValues: string[];
	/** Which values count as addressed. Same rule, same absence of a default. */
	addressedRiskValues: string[];
```

- [ ] **Step 4: Declare the five options**

In `getReleaseViewOptions`, immediately after the `descriptionProperty` entry:

```ts
			{
				type: 'property',
				key: 'estimateProperty',
				displayName: t('release.option.estimate'),
				placeholder: 'effort',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'dependsOnProperty',
				displayName: t('release.option.dependsOn'),
				placeholder: 'dependsOn',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'riskProperty',
				displayName: t('release.option.risk'),
				placeholder: 'risk',
				filter: notePropsOnly,
			},
			// No `default:` on either list, for `releaseStatusValues`' own reason: these are
			// the reader's words for their own process, and shipping a guess would put it in
			// every vault's `.base` the first time the options panel was opened. Empty means
			// unconfigured, which is what the criterion reports.
			{
				type: 'text',
				key: 'criticalRiskValues',
				displayName: t('release.option.criticalRiskValues'),
				placeholder: t('release.option.criticalRiskValuesHint'),
			},
			{
				type: 'text',
				key: 'addressedRiskValues',
				displayName: t('release.option.addressedRiskValues'),
				placeholder: t('release.option.addressedRiskValuesHint'),
			},
```

- [ ] **Step 5: Resolve them**

In `resolveReleaseSettings`, after `descriptionKey`:

```ts
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reason already stated above for `versionKey`.
		estimateKey: propKey('estimateProperty', ''),
		dependsOnKey: propKey('dependsOnProperty', ''),
		riskKey: propKey('riskProperty', ''),
		// `dedupe` for both: a vault listing `High, high` means one value, and a criterion
		// counting it twice would report a denominator nobody can reconcile.
		criticalRiskValues: dedupe(list('criticalRiskValues')),
		addressedRiskValues: dedupe(list('addressedRiskValues')),
```

- [ ] **Step 6: Add the catalog keys**

In `src/i18n/en.ts`, beside the other `release.option.*` keys:

```ts
	'release.option.estimate': 'Estimate property',
	'release.option.dependsOn': 'Prerequisites property',
	'release.option.risk': 'Risk property',
	'release.option.criticalRiskValues': 'Risk values that are critical',
	'release.option.criticalRiskValuesHint': 'High, Critical',
	'release.option.addressedRiskValues': 'Risk values that count as addressed',
	'release.option.addressedRiskValuesHint': 'Mitigated, Accepted',
```

- [ ] **Step 7: Widen the test helper**

In `test/helpers/releaseSettings.ts`, add the five fields to whatever object
`releaseSettingsWith` spreads its overrides onto, each unconfigured:

```ts
	estimateKey: '',
	dependsOnKey: '',
	riskKey: '',
	criticalRiskValues: [],
	addressedRiskValues: [],
```

- [ ] **Step 8: Run the test and the gate**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS.
Run: `npm run check`
Expected: all seven steps pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain/releaseOptions.ts src/i18n/en.ts test/domain/releaseOptions.test.ts test/helpers/releaseSettings.ts
git commit -m "$(cat <<'MSG'
Give the release view the keys its readiness criteria read

Five options on its own bag, never the backlog view's: the estimate, the
prerequisites, the risk, and the two vocabularies a risk value is judged
against. No default on either list — a vocabulary is the vault's own, and an
empty one means unconfigured rather than "nothing is critical".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 2: The estimate predicate, and the effort figures

**Files:**
- Create: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseReadiness.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings` from Task 1; `ReleaseScope` and `ReleaseFigure<T>` from
  `src/domain/releases.ts`; `ownValue`, `readNumber` from `src/domain/noteFields.ts`;
  `ownWorkflowReading` from `src/domain/board.ts`.
- Produces:

```ts
export type Verdict = 'satisfied' | 'partly' | 'not' | 'unconfigured' | 'empty';

export interface ReleaseCriterion {
    key: 'estimated' | 'blocked' | 'risk';
    verdict: Verdict;
    /** Members clearing it. Null when unconfigured. */
    cleared: number | null;
    /** Members not clearing it, each counted ONCE however many values it holds. Null when unconfigured. */
    outstanding: number | null;
    /** Members the criterion could not read at all — extension 5a. Null when unconfigured. */
    unreadable: number | null;
}

export interface ReleaseReadiness {
    members: number;
    criteria: ReleaseCriterion[];
    unestimated: ReleaseFigure<number>;
    estimatedEffort: ReleaseFigure<number>;
    completedEffort: ReleaseFigure<number>;
    blocked: ReleaseFigure<number>;
    criticalRisks: ReleaseFigure<number>;
}

export function estimateValue(raw: unknown): number | null;
export function isEstimated(raw: unknown): boolean;
export function releaseReadiness(
    app: App,
    scope: ReleaseScope,
    settings: ReleaseSettings,
    planSettings: BacklogSettings,
): ReleaseReadiness;
```

  Task 3 fills the `blocked` figure and its criterion; Task 4 fills `criticalRisks`; Task 5
  renders all of it. `isEstimated` is exported for `A definition of ready` to reuse later —
  one predicate, not two.
- **`planSettings` is a parameter from this task on**, not added later: the completed-effort
  figure has to ask each member's own workflow whether it can say *done*, and Task 3's
  blocked criterion asks the same of each prerequisite. `workflowClears` is written here and
  reused there rather than being introduced twice.

- [ ] **Step 1: Write the failing test**

Create `test/domain/releaseReadiness.test.ts`. Model the fixture on
`test/domain/releaseScope.test.ts`'s own helpers — read that file first and reuse
`releaseSettingsWith`, `settingsWith`, `FakeVault`, `buildModel`, `releaseIndex` and
`releaseScope` exactly as it does, rather than inventing a second way to build a scope.

```ts
import { describe, expect, it } from 'vitest';
import { isEstimated, releaseReadiness } from '../../src/domain/releaseReadiness';

describe('the estimate predicate', () => {
    // A placeholder wearing a value is the missing estimate, whatever it says. This is the
    // same predicate `A definition of ready` will read, which is why it is exported rather
    // than inlined: two copies is how they come to disagree.
    it('clears on a finite number and on nothing else', () => {
        expect(isEstimated(5)).toBe(true);
        expect(isEstimated(0)).toBe(true);
        expect(isEstimated(2.5)).toBe(true);
        expect(isEstimated('TBD')).toBe(false);
        // A numeric PREFIX is a placeholder, not an estimate. `noteFields.ts`'s shared
        // `readNumber` parses both of these to a number, which is why this predicate does
        // not use it — the two spellings a placeholder actually turns up in.
        expect(isEstimated('5 TBD')).toBe(false);
        expect(isEstimated('8 points')).toBe(false);
        // A quoted numeric scalar is still an estimate: somebody typed a number as a string.
        expect(isEstimated('5')).toBe(true);
        expect(isEstimated('  7  ')).toBe(true);
        // A negative effort is not an estimate: it lets totals CANCEL, which produced
        // `5 of 0 pts (0%)`. `Capacity against commitment` refuses a negative capacity for
        // the same reason — no unit here can be less than none.
        expect(isEstimated(-1)).toBe(false);
        expect(isEstimated('-3')).toBe(false);
        expect(isEstimated('')).toBe(false);
        expect(isEstimated(null)).toBe(false);
        expect(isEstimated(undefined)).toBe(false);
        expect(isEstimated(NaN)).toBe(false);
        expect(isEstimated(Infinity)).toBe(false);
        expect(isEstimated(-Infinity)).toBe(false);
        expect(isEstimated({})).toBe(false);
        expect(isEstimated([])).toBe(false);
    });
});

describe('the effort figures', () => {
    it('sums each member once, and counts the unestimated separately', () => {
        // Three members: 6 (done), 9 (not done), and one with no estimate at all.
        const readiness = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' });
        expect(readiness.estimatedEffort).toEqual({ value: 15, invalid: false, unconfigured: false });
        expect(readiness.completedEffort).toEqual({ value: 6, invalid: false, unconfigured: false });
        expect(readiness.unestimated).toEqual({ value: 1, invalid: false, unconfigured: false });
    });

    it('reports every estimate figure as unconfigured, never zero, with no key bound', () => {
        const readiness = readinessOf(effortVault(), 'R.md', {});
        for (const figure of [readiness.estimatedEffort, readiness.completedEffort, readiness.unestimated]) {
            expect(figure).toEqual({ value: null, invalid: false, unconfigured: true });
        }
        // The count reads the same key as the sums: a screen showing "2 unestimated" beside
        // "effort: not configured" contradicts itself, which is what the harness mock caught.
        expect(readiness.criteria.find((c) => c.key === 'estimated')?.verdict).toBe('unconfigured');
    });

    it('reports completed effort as unconfigured when no workflow can say done', () => {
        // The estimated total and the unestimated count read the estimate key alone and still
        // answer. The COMPLETED total needs a workflow, and without one every member reads as
        // not done — a zero that looks measured and is not.
        const readiness = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' }, { doneValues: [] });
        expect(readiness.estimatedEffort).toEqual({ value: 15, invalid: false, unconfigured: false });
        expect(readiness.unestimated).toEqual({ value: 1, invalid: false, unconfigured: false });
        expect(readiness.completedEffort).toEqual({ value: null, invalid: false, unconfigured: true });
    });

    it('still measures completed effort when only an UNESTIMATED member has no workflow', () => {
        // That member reaches neither total, so its unknown done state cannot change either
        // one — withholding a fully computable figure over it would hide a real answer.
        const readiness = readinessOf(mixedWorkflowVault(), 'R.md', { estimateKey: 'effort' });
        expect(readiness.completedEffort).toEqual({ value: 6, invalid: false, unconfigured: false });
    });

    it('does not sum a placeholder wearing a number', () => {
        // `effort: '5 TBD'` is unestimated, so it joins the count and reaches neither sum —
        // the criterion and the total reading one predicate rather than two.
        const readiness = readinessOf(placeholderEffortVault(), 'R.md', { estimateKey: 'effort' });
        expect(readiness.estimatedEffort.value).toBe(6);
        expect(readiness.unestimated.value).toBe(1);
    });

    it('counts no context ancestor in any figure', () => {
        // The same vault with an Epic above the members that is NOT in the release. It
        // carries an estimate, and it must reach no sum and no count.
        const withContext = readinessOf(contextEffortVault(), 'R.md', { estimateKey: 'effort' });
        const without = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' });
        expect(withContext.estimatedEffort).toEqual(without.estimatedEffort);
        expect(withContext.completedEffort).toEqual(without.completedEffort);
        expect(withContext.unestimated).toEqual(without.unestimated);
    });

    it('says an empty release has nothing to check rather than that it is satisfied', () => {
        const readiness = readinessOf(emptyReleaseVault(), 'R.md', { estimateKey: 'effort' });
        expect(readiness.criteria.find((c) => c.key === 'estimated')?.verdict).toBe('empty');
    });
});
```

The fixtures and the entry point, in the same file — `FakeVault`'s shape is
`test/helpers/release.ts`'s own `scopeVault()`, read it if anything here is unclear:

```ts
import { buildModel } from '../../src/domain/model';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { CivilDate } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';

/** This suite is not about `today`, so a fixed value stands in for it. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

function readinessOf(
    vault: FakeVault,
    path: string,
    overrides: Partial<Parameters<typeof releaseSettingsWith>[0]> = {},
    planOverrides: { stateKey?: string; dependsOnKey?: string; doneValues?: string[] } = {},
) {
    const plan = settingsWith({ stateKey: 'status', doneValues: ['Done'], ...planOverrides });
    const settings = releaseSettingsWith({
        parentKey: 'parent',
        orderKey: 'order',
        typeKey: 'type',
        membershipKey: 'release',
        ...overrides,
    });
    // `plan.dependsOnKey` is what `readItems` reads the edges with, and in the real view it
    // comes from this view's OWN `dependsOnProperty` through `resolveSettings` — so the
    // fixture binds it here the same way rather than leaving `item.prerequisites` empty.
    const model = buildModel(vault.app, vault.entries(), plan);
    const index = releaseIndex(vault.app, model, settings, { stateKey: plan.stateKey, today: TODAY });
    const scope = releaseScope(vault.app, model, settings, index, path);
    return releaseReadiness(vault.app, scope, settings, plan);
}

/** Three members: 6 done, 9 not done, and one carrying no estimate at all. */
function effortVault(): FakeVault {
    const vault = new FakeVault();
    vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
    vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
    vault.addFile('M1.md', {
        frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 6, status: 'Done' },
    });
    vault.addFile('M2.md', {
        frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: 9, status: 'Doing' },
    });
    vault.addFile('M3.md', { frontmatter: { type: 'PBI', parent: 'E', order: 3, release: '[[R]]' } });
    return vault;
}

/** The same three members, under an Epic that is NOT in the release and carries an estimate
 *  of its own. It is scaffolding: it must reach no sum and no count. */
function contextEffortVault(): FakeVault {
    const vault = effortVault();
    vault.addFile('E.md', { frontmatter: { type: 'Epic', effort: 100, status: 'Done' } });
    return vault;
}

/** One member estimated `6`, one carrying the placeholder `'5 TBD'`. */
function placeholderEffortVault(): FakeVault {
    const vault = new FakeVault();
    vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
    vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
    vault.addFile('M1.md', {
        frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 6, status: 'Done' },
    });
    vault.addFile('M2.md', {
        frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: '5 TBD', status: 'Doing' },
    });
    return vault;
}

/**
 * Two estimated `PBI`s under the requirements workflow, plus an UNESTIMATED `Deliverable` in
 * a vault binding no `deliverableStateProperty` — the member whose unreadable workflow must
 * not withhold a figure it contributes nothing to.
 */
function mixedWorkflowVault(): FakeVault {
    const vault = effortVault();
    vault.addFile('D1.md', { frontmatter: { type: 'Deliverable', parent: 'E', order: 4, release: '[[R]]' } });
    return vault;
}

/** A release nobody has filled. Not a release that is done. */
function emptyReleaseVault(): FakeVault {
    const vault = new FakeVault();
    vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
    return vault;
}
```

If `FakeVault.addFile` refuses a second call for the same path, build `contextEffortVault()`
by writing the Epic's frontmatter at first insertion rather than overwriting it — read
`test/helpers/vault.ts` and follow what it actually allows.

Build Task 3's and Task 4's fixtures the same way, on this shape: `blockedVault()` gives one
member `dependsOn: ['[[P1]]', '[[P2]]', '[[P3]]']` with all three unfinished and a second
member `dependsOn: '[[P4]]'` with `P4` done; `independentVault()` is `effortVault()` with no
`dependsOn` key anywhere; `unreadablePrereqVault()` has one member naming `'[[Nowhere]]'`,
a note the vault does not hold. `selfAndCycleVault()` has one member naming ITSELF and two
members naming each other, with every one of those targets marked `status: Done` — so a
reader that resolved the raw links would call all three cleared.
`deliverablePrereqVault()` has one member whose prerequisite is a `Deliverable`, in a vault
binding no `deliverableStateProperty` and no `deliverableDoneValues`. `multiRiskVault()` gives one member
`risk: ['Low', 'Critical', 'Medium']` and one member `risk: 'Low'`;
`lowAndBlankRiskVault()` has one member at `Low` and one with no risk key;
`addressedRiskVault()` gives one member `risk: ['Critical', 'Mitigated']`;
`contextRiskVault()` is `multiRiskVault()` with `E.md` carrying `risk: 'Critical'`.
`mixedRiskVault()` gives one member `risk: ['Low', { level: 'Critical' }]`.
`malformedRiskVault()` has one member whose `risk` is an object (`{ level: 'Critical' }`)
and one with no risk key at all — so the assertion separates the unreadable from the absent.
The mixed list is the harder case: its readable half alone would clear the criterion.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/releaseReadiness.test.ts`
Expected: FAIL — cannot resolve `../../src/domain/releaseReadiness`.

- [ ] **Step 3: Write the module**

Create `src/domain/releaseReadiness.ts`:

```ts
import { App } from 'obsidian';
import { ownValue } from './noteFields';
import { ownWorkflowKind, ownWorkflowReading, WorkflowKind, workflowStateInfo } from './board';
import { ReleaseFigure, ReleaseScope } from './releases';
import { ReleaseSettings } from './releaseOptions';
import { BacklogSettings } from './settings';
import { BacklogItem } from './model';

/**
 * A release's readiness, and the figures that ARE its criteria counted.
 *
 * **One walk, one predicate per number.** `docs/requirements/Summing up a release.md` says
 * the blocked and risk figures "use the predicates [[Release readiness]] declares rather
 * than a second set beside them", and this module is the only place either is written: a
 * criterion and the figure beside it are the same question asked twice, so they are
 * computed together and can never disagree.
 *
 * **The population is `scope.members`** — the notes whose OWN property names this release —
 * read off the rows `releaseScope` already resolved rather than a second walk of the model.
 * A context ancestor is scaffolding: it is in no denominator, no sum and no count. That is
 * the context-row rule, and `test/domain/releaseReadiness.test.ts` asks it of every figure.
 *
 * **Nothing here writes, and nothing here reads a clock.**
 */

export type Verdict = 'satisfied' | 'partly' | 'not' | 'unconfigured' | 'empty';

export interface ReleaseCriterion {
	key: 'estimated' | 'blocked' | 'risk';
	verdict: Verdict;
	/** Members clearing it. Null when unconfigured. */
	cleared: number | null;
	/** Members not clearing it, each counted ONCE however many values it holds. */
	outstanding: number | null;
	/**
	 * Members the criterion could not read at all — extension 5a's "both numbers are
	 * stated". An unanswered item is not a passing one, so these are inside `outstanding`
	 * as well as reported here.
	 */
	unreadable: number | null;
}

export interface ReleaseReadiness {
	/**
	 * How many members every figure here was computed over — `scope.members` counted once,
	 * so the renderer can ask whether the release is EMPTY without inferring it from the
	 * verdicts. It cannot be inferred: a criterion nobody configured reads `unconfigured`
	 * whether the release holds fifty members or none, so "every verdict is empty" is false
	 * for an empty release the moment one criterion is unconfigured.
	 */
	members: number;
	criteria: ReleaseCriterion[];
	unestimated: ReleaseFigure<number>;
	estimatedEffort: ReleaseFigure<number>;
	completedEffort: ReleaseFigure<number>;
	blocked: ReleaseFigure<number>;
	criticalRisks: ReleaseFigure<number>;
}

const UNCONFIGURED: ReleaseFigure<number> = { value: null, invalid: false, unconfigured: true };

function counted(value: number): ReleaseFigure<number> {
	return { value, invalid: false, unconfigured: false };
}

function unconfiguredCriterion(key: ReleaseCriterion['key']): ReleaseCriterion {
	return { key, verdict: 'unconfigured', cleared: null, outstanding: null, unreadable: null };
}

/**
 * Satisfied, partly and not are a COUNT, not a judgement — the readiness note's own words.
 * All of them clear it and it is satisfied; none do and it is not; anything between is
 * partly. An empty release satisfies nothing: with no members there is nothing to check,
 * which is a different statement from a pass.
 */
function verdictOf(cleared: number, outstanding: number): Verdict {
	if (cleared + outstanding === 0) return 'empty';
	if (outstanding === 0) return 'satisfied';
	if (cleared === 0) return 'not';
	return 'partly';
}

/**
 * **An estimate clears its criterion by being a number** — the predicate
 * `docs/requirements/Release readiness.md` states and `A definition of ready` will reuse,
 * which is why {@link isEstimated} is exported rather than inlined. `TBD`, an empty string
 * and anything non-finite are the missing estimate wearing a value, and a criterion that
 * accepted them would report a release as fully estimated on the strength of somebody's
 * placeholder.
 *
 * **NOT `readNumber`, and that is the correction of this draft.** `noteFields.ts`'s shared
 * reader parses a string with `Number.parseFloat`, which takes a numeric PREFIX: `'5 TBD'`
 * reads as 5 and `'8 points'` as 8, so the two spellings a placeholder actually turns up in
 * would both be counted and summed. That is the exact reading this predicate says it
 * refuses. Raised by a review bot and reproduced before it was taken.
 *
 * A quoted numeric scalar is still an estimate — a frontmatter `effort: '5'` is a number
 * somebody typed as a string, and refusing it would call an estimated item unestimated — so
 * the test is that the WHOLE trimmed string is a finite number. `Number('')` is `0`, which
 * is why the empty check comes first rather than being left to `Number.isFinite`.
 *
 * `readNumber` stays untouched: it is shared with readers this increment does not own, and
 * narrowing it here would change figures nothing in this plan has looked at.
 */
/** Every workflow a member or a prerequisite can belong to — `WorkflowKind`'s own three. */
const WORKFLOW_KINDS: WorkflowKind[] = ['requirements', 'deliverable', 'test'];

/**
 * **A key is half of a workflow; the other half is which values clear it** — the same rule
 * the risk criterion keeps, read here for the state vocabulary. A bound `stateKey` with an
 * empty `doneValues` clears nothing, so `ownWorkflowReading(...).done` is false for every
 * item: a figure gated on the key alone reports a measured-looking zero, and a criterion
 * gated on it reports every member of every release as blocked.
 */
function workflowClears(kind: WorkflowKind, planSettings: BacklogSettings): boolean {
	const info = workflowStateInfo(kind, planSettings);
	return info.key !== '' && info.doneValues.length > 0;
}

export function estimateValue(raw: unknown): number | null {
	const parsed = finiteFrom(raw);
	// **Never negative.** `Capacity against commitment` already refuses a negative capacity
	// "since no unit this feature names can be less than none", and an effort estimate is the
	// same quantity from the other side. Allowing one lets estimates CANCEL: a completed 5
	// against an unfinished -5 totals zero, and the strip drew `5 of 0 pts (0%)` — a
	// contradiction, with negative and above-100 percentages available from the same door.
	// Refusing it at the reader closes the whole class rather than guarding each figure, and
	// leaves `0 <= completed <= estimated` true by construction.
	return parsed === null || parsed < 0 ? null : parsed;
}

function finiteFrom(raw: unknown): number | null {
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (trimmed === '') return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The criterion's own half of {@link estimateValue}. One predicate and one reader, so the
 * sum and the verdict can never disagree about which members are estimated — a criterion
 * calling `'5 TBD'` unestimated while the total beside it added 5 is the drift this pairing
 * exists to prevent.
 */
export function isEstimated(raw: unknown): boolean {
	return estimateValue(raw) !== null;
}

export function releaseReadiness(
	app: App,
	scope: ReleaseScope,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): ReleaseReadiness {
	const members = scope.rows.filter((row) => !row.context).map((row) => row.item);
	return {
		members: members.length,
		criteria: [estimateCriterion(app, members, settings)],
		...effortFigures(app, members, settings, planSettings),
		blocked: UNCONFIGURED,
		criticalRisks: UNCONFIGURED,
	};
}

function estimateCriterion(app: App, members: BacklogItem[], settings: ReleaseSettings): ReleaseCriterion {
	if (settings.estimateKey === '') return unconfiguredCriterion('estimated');
	const cleared = members.filter((item) => isEstimated(estimateOf(app, item, settings))).length;
	const outstanding = members.length - cleared;
	// `unreadable` is 0 rather than null: this criterion reads a QUANTITY, so a member with
	// nothing where it looks is unestimated — a stated answer — rather than one the
	// criterion could not read. The vocabulary criteria are where 5a has work to do.
	return { key: 'estimated', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable: 0 };
}

/**
 * **Three figures, two different configurations.** The estimated total and the unestimated
 * count read the ESTIMATE key alone, so they answer wherever that key is bound. The
 * COMPLETED total additionally needs a workflow that can say what done means, and without
 * one `ownWorkflowReading(item).done` is false for every member — which would produce a
 * completed effort of zero that looks measured and is not, drawn as `0 of 15 pts (0%)`.
 * `ReleaseRow.done` already refuses to report that as a zero (`Summing up a release`
 * extension 2c), and this figure must refuse it for the same reason. Raised by a review bot
 * against a draft that made all three answer together.
 *
 * The test is over the OWN workflows of the members whose estimate is actually in the sum.
 * One of those whose kind cannot clear is enough, because a partial sum reported as a whole
 * is the same false precision in smaller print — but an UNESTIMATED member contributes to
 * neither total, so its unknown done state cannot change either one, and letting it withhold
 * a fully computable figure would hide a real answer for no reason. A draft tested every
 * member; a review bot narrowed it.
 */
function effortFigures(
	app: App,
	members: BacklogItem[],
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): Pick<ReleaseReadiness, 'unestimated' | 'estimatedEffort' | 'completedEffort'> {
	if (settings.estimateKey === '') {
		// All three read the SAME key, so all three are unconfigured together. Drawing a
		// count beside "not configured" contradicts itself — caught in the harness before
		// this module existed, and `Summing up a release` extension 2a is amended to say so.
		return { unestimated: UNCONFIGURED, estimatedEffort: UNCONFIGURED, completedEffort: UNCONFIGURED };
	}
	// Read every estimate first, so the readability test below sees exactly the members whose
	// value reaches a total — never one whose estimate is missing anyway.
	const weighed = members.map((item) => ({ item, value: estimateValue(estimateOf(app, item, settings)) }));
	const missing = weighed.filter((entry) => entry.value === null).length;
	const counting = weighed.filter((entry): entry is { item: BacklogItem; value: number } => entry.value !== null);
	const doneReadable = counting.every((entry) => workflowClears(ownWorkflowKind(entry.item), planSettings));
	let estimated = 0;
	let completed = 0;
	for (const entry of counting) {
		estimated += entry.value;
		// The member's OWN workflow, so a Deliverable answers by its own — the reader the
		// progress bar above this already uses.
		if (doneReadable && ownWorkflowReading(entry.item).done) completed += entry.value;
	}
	// ponytail: a member whose descendant in the same release also carries an estimate is
	// double counted here. Naming those members is `Capacity against commitment`'s own
	// figure (`docs/requirements/Capacity against commitment.md`), and it is the next
	// increment; until it lands this total is wrong in a vault whose parent estimates are
	// aggregates.
	return {
		unestimated: counted(missing),
		estimatedEffort: counted(estimated),
		completedEffort: doneReadable ? counted(completed) : UNCONFIGURED,
	};
}

function estimateOf(app: App, item: BacklogItem, settings: ReleaseSettings): unknown {
	return ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.estimateKey);
}
```

If `BacklogItem` exposes the file under a different name than `item.file`, read
`src/domain/model.ts` and use whatever `releases.ts` itself uses to reach a note's
frontmatter — match the neighbour rather than guessing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseReadiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the context test fail without its guard**

Change `scope.rows.filter((row) => !row.context)` to `scope.rows` and re-run. Expected: the
"counts no context ancestor" test FAILS. Restore the filter and re-run to green. This is the
repository's own rule — an invariant stated in a comment gets a test watched failing.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check`

```bash
git add src/domain/releaseReadiness.ts test/domain/releaseReadiness.test.ts
git commit -m "$(cat <<'MSG'
Count a release's effort, and say what carries no estimate

One predicate — an estimate is a finite number — exported so the definition
of ready reuses it rather than writing a second. The two sums and the
unestimated count read that same key, so all three are unconfigured together:
a count beside "not configured" contradicts itself.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 3: The blocked predicate

**Files:**
- Modify: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseReadiness.test.ts`

**Interfaces:**
- Consumes: `dependsOnKey` from Task 1; `ReleaseCriterion`, `verdictOf`, `counted`,
  `UNCONFIGURED`, `unconfiguredCriterion` from Task 2; `BacklogItem.prerequisites` and
  `BacklogItem.brokenPrerequisites` (`src/domain/model.ts`), which are
  `resolveDependencies`' own resolved output — **never a second reading of the raw links**.
- Produces: `releaseReadiness().blocked` is a real figure, and `criteria` gains its
  `'blocked'` entry.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/releaseReadiness.test.ts`:

```ts
describe('the blocked predicate', () => {
    it('counts a member with three unmet prerequisites once, not three times', () => {
        const readiness = blockedReadiness(blockedVault());
        expect(readiness.blocked).toEqual({ value: 1, invalid: false, unconfigured: false });
    });

    it('treats no edges as resolved', () => {
        // An empty edge list is REMOVED rather than stored, so an item that waits for
        // nothing has no value where this criterion looks. The blanket "unreadable is not
        // cleared" rule would leave a release full of independent work unable to satisfy
        // this criterion at all — which is the readiness note's own stated exception.
        const readiness = blockedReadiness(independentVault());
        expect(readiness.blocked).toEqual({ value: 0, invalid: false, unconfigured: false });
        expect(readiness.criteria.find((c) => c.key === 'blocked')?.verdict).toBe('satisfied');
    });

    it('counts a prerequisite it cannot read as outstanding, and reports it separately', () => {
        // A prerequisite outside the base, or a broken link: the wait cannot be shown to be
        // over, so the member does not clear — and 5a wants the number said out loud rather
        // than folded into the others.
        const criterion = blockedReadiness(unreadablePrereqVault()).criteria.find((c) => c.key === 'blocked');
        expect(criterion?.outstanding).toBe(1);
        expect(criterion?.unreadable).toBe(1);
    });

    it('is unconfigured, never zero, with no edge key and with no done values', () => {
        expect(readinessOf(blockedVault(), 'R.md', {}).blocked).toEqual({
            value: null,
            invalid: false,
            unconfigured: true,
        });
        // Without this guard every member reads as having no prerequisites, so an unbound
        // edge key would report every release as satisfied rather than as unconfigured.
        // An edge says what a thing waits for and nothing about whether the wait is over,
        // so with no state key bound this criterion is exactly as unconfigured as one with
        // no property at all.
        const noState = readinessOf(blockedVault(), 'R.md', { dependsOnKey: 'dependsOn' }, { stateKey: '', dependsOnKey: 'dependsOn' });
        expect(noState.blocked.unconfigured).toBe(true);
    });

    it('is unconfigured with a state key bound but no done values', () => {
        // A key is half of a workflow. With an empty `doneValues` nothing clears, so
        // `ownWorkflowReading(...).done` is false for every prerequisite — a gate on the key
        // alone reports every member of every release as blocked, which is a configuration
        // mistake dressed as a finding about the release.
        const emptyVocabulary = readinessOf(
            blockedVault(),
            'R.md',
            { dependsOnKey: 'dependsOn' },
            { doneValues: [], dependsOnKey: 'dependsOn' },
        );
        expect(emptyVocabulary.blocked.unconfigured).toBe(true);
    });

    it('counts a prerequisite in an unconfigured secondary workflow as unreadable', () => {
        // A Deliverable prerequisite in a vault that never configured the Deliverable
        // workflow is unreadable, not unfinished — the same distinction, one workflow down.
        const criterion = blockedReadiness(deliverablePrereqVault()).criteria.find((c) => c.key === 'blocked');
        expect(criterion?.unreadable).toBe(1);
        expect(criterion?.cleared).toBe(0);
    });

    it('counts a self-reference and a cycle as unreadable, never as cleared by a done target', () => {
        // `resolveDependencies` puts both in `brokenPrerequisites` on purpose. Re-reading the
        // raw links here would resolve a self-reference happily and then call the member
        // cleared because the target it found is done — a release reporting nothing
        // outstanding on exactly the items whose dependencies are malformed.
        const criterion = blockedReadiness(selfAndCycleVault()).criteria.find((c) => c.key === 'blocked');
        expect(criterion?.unreadable).toBe(2);
        expect(criterion?.cleared).toBe(0);
    });
});
```

Add `blockedReadiness(vault)` beside `readinessOf`, binding the edge key on BOTH bags —
`readinessOf(vault, 'R.md', { dependsOnKey: 'dependsOn' }, { dependsOnKey: 'dependsOn' })` —
since the release settings decide whether the criterion is configured and the plan settings
are what `readItems` reads the entries with. `readinessOf`'s fourth argument of plan
overrides is what lets the last assertion unbind `stateKey`. Build `blockedVault()` with one member naming three
prerequisites that are all unfinished, plus one member naming a finished one.
`independentVault()` has members carrying no `dependsOn` key at all.
`unreadablePrereqVault()` has one member whose `dependsOn` names a note the model does not
hold.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/releaseReadiness.test.ts -t 'blocked predicate'`
Expected: FAIL — `blocked` is `{ value: null, invalid: false, unconfigured: true }` for
every case, since Task 2 hard-coded it.

- [ ] **Step 3: Implement it**

In `src/domain/releaseReadiness.ts`, replace the hard-coded `blocked: UNCONFIGURED` and add:

```ts
/**
 * **What clears a prerequisite is this view's own already-bound state key and its done
 * values**, not a sixth and seventh option. `docs/requirements/Release readiness.md` asks
 * each criterion to declare its own key and clearing values; this view's `stateKey` already
 * IS its own — the rule protects against borrowing the key from the view that WRITES it,
 * which this does not do. A separate "cleared at" list is a later slice, for the day a vault
 * clears a dependency short of done.
 *
 * With no edge key bound the criterion is unconfigured, and so it is with no state key: an
 * edge says what a thing waits for and nothing about whether the wait is over, so an edge
 * key alone answers half a question. The readiness note says so in its own words. **The edge
 * key guard is load-bearing rather than defensive**: with `dependsOnProperty` unbound every
 * member carries no entries at all, so without it every release would read as satisfied.
 *
 * **The edges are the MODEL's, never re-read here.** `item.prerequisites` and
 * `item.brokenPrerequisites` are `resolveDependencies`' own output (`domain/dependencies.ts`),
 * and reading the raw links again would build a second, disagreeing graph: that resolver
 * deliberately rejects an unresolvable entry, an item naming ITSELF, and any entry inside a
 * cycle, all into `broken`. A hand-rolled reader resolves a self-reference happily and then
 * calls the member cleared because the target it found is done — which is the release
 * reporting nothing outstanding on exactly the items whose dependencies are malformed.
 * Raised by a review bot against this plan's first draft and confirmed at
 * `domain/dependencies.ts`'s `settle`.
 *
 * That this reads the RELEASE view's own key rather than the backlog view's is not luck:
 * `resolveSettings` maps every `PROPERTY_TABLE` row's option to its settings key
 * generically (`domain/settingsResolve.ts`), and `releaseView.ts` builds its model with
 * `resolveSettings(this.config)` — this view's own config. Declaring `dependsOnProperty` in
 * Task 1 is therefore what points the model's resolution at the key this criterion reads.
 * The two cannot drift, because there is only one.
 *
 * **No edges is RESOLVED** — the readiness note's stated exception. An empty list is removed
 * rather than stored, so an item that waits for nothing has no value where this looks;
 * counting that as unreadable would leave a release of independent work unable to satisfy
 * this criterion at all.
 *
 * A broken entry IS unreadable: the wait cannot be shown to be over. It costs the member its
 * criterion and is reported separately (extension 5a).
 */
function blockedCriterion(
	members: BacklogItem[],
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): ReleaseCriterion {
	// Unconfigured when there is no edge key, and equally when NO workflow could say a
	// prerequisite is done: with nothing clearing anything, "every member blocked" is a
	// configuration mistake reported as a finding about the release.
	const anyWorkflow = WORKFLOW_KINDS.some((kind) => workflowClears(kind, planSettings));
	if (settings.dependsOnKey === '' || !anyWorkflow) return unconfiguredCriterion('blocked');
	let cleared = 0;
	let outstanding = 0;
	let unreadable = 0;
	for (const item of members) {
		// Counted ONCE per member however many entries it holds — the acceptance criterion.
		const broken = item.brokenPrerequisites.length > 0;
		// A prerequisite whose OWN workflow is unconfigured is unreadable, not unfinished:
		// `ownWorkflowReading(...).done` is false for every item under an unbound key or an
		// empty done list, so counting it as waiting would report a Deliverable prerequisite
		// as blocking on a vault that never configured the Deliverable workflow.
		const unread = item.prerequisites.some((p) => !workflowClears(ownWorkflowKind(p), planSettings));
		const waiting = item.prerequisites.some(
			(p) => workflowClears(ownWorkflowKind(p), planSettings) && !ownWorkflowReading(p).done,
		);
		if (broken || unread) unreadable += 1;
		if (broken || unread || waiting) outstanding += 1;
		else cleared += 1;
	}
	return { key: 'blocked', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable };
}

// `workflowClears` and `WORKFLOW_KINDS` are Task 2's, written there for the completed-effort
// figure and reused here unchanged — the identical question asked of a prerequisite instead
// of a member.
```

`releaseReadiness` gains only the plan settings — no model, no link resolution, no lookup
map:

```ts
export function releaseReadiness(
	app: App,
	scope: ReleaseScope,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): ReleaseReadiness {
	const members = scope.rows.filter((row) => !row.context).map((row) => row.item);
	// Each criterion is computed once and reused: the figure beside it IS its outstanding
	// count, so a second call here would be the second walk this module exists to avoid.
	const blocked = blockedCriterion(members, settings, planSettings);
	return {
		members: members.length,
		criteria: [estimateCriterion(app, members, settings), blocked],
		...effortFigures(app, members, settings, planSettings),
		blocked: figureFrom(blocked),
		criticalRisks: UNCONFIGURED,
	};
}

/** The figure beside a criterion IS its outstanding count — never a second walk. */
function figureFrom(criterion: ReleaseCriterion): ReleaseFigure<number> {
	return criterion.outstanding === null ? UNCONFIGURED : counted(criterion.outstanding);
}
```

No new imports: Task 2 already brings `ownWorkflowKind`, `workflowStateInfo`, `WorkflowKind`
and `BacklogSettings`, and `releaseReadiness` already takes `planSettings`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseReadiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the "no edges is resolved" test fail without its branch**

Delete the `if (edges.length === 0) { cleared += 1; continue; }` branch and re-run. Expected:
that test FAILS — a release of independent work reports every member outstanding. Restore it
and re-run to green.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check`

```bash
git add src/domain/releaseReadiness.ts test/domain/releaseReadiness.test.ts
git commit -m "$(cat <<'MSG'
Say how much of a release is waiting on something

A member with three unmet prerequisites is one blocked item, not three. What
clears a prerequisite is this view's own state key and its done values, so an
edge key with no state bound is unconfigured rather than half an answer — an
edge says what a thing waits for and nothing about whether the wait is over.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 4: The risk predicate

**Files:**
- Modify: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseReadiness.test.ts`

**Interfaces:**
- Consumes: `riskKey`, `criticalRiskValues`, `addressedRiskValues` from Task 1; the helpers
  from Tasks 2 and 3.
- Produces: `releaseReadiness().criticalRisks` is a real figure, and `criteria` gains its
  `'risk'` entry — making `criteria` three long, in the order
  `['estimated', 'blocked', 'risk']`, which Task 5 renders in that order.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/releaseReadiness.test.ts`:

```ts
describe('the critical risk predicate', () => {
    const RISK = { riskKey: 'risk', criticalRiskValues: ['High', 'Critical'], addressedRiskValues: ['Mitigated'] };

    it('counts a member with three risk values at most once', () => {
        const readiness = readinessOf(multiRiskVault(), 'R.md', RISK);
        expect(readiness.criticalRisks).toEqual({ value: 1, invalid: false, unconfigured: false });
    });

    it('clears on a non-critical value AND on no value at all', () => {
        // Absence is an answer here, and this is the exception most likely to be got
        // backwards. The criterion asks whether CRITICAL risks are addressed: a `Low` is not
        // an outstanding critical risk, and neither is a missing value. Reading it as
        // "addressed or nothing" fails a release for every ordinary low and medium risk in
        // it, and demands a synthetic value on risk-free items besides.
        const readiness = readinessOf(lowAndBlankRiskVault(), 'R.md', RISK);
        expect(readiness.criticalRisks).toEqual({ value: 0, invalid: false, unconfigured: false });
        expect(readiness.criteria.find((c) => c.key === 'risk')?.verdict).toBe('satisfied');
    });

    it('clears a critical value that is addressed', () => {
        const readiness = readinessOf(addressedRiskVault(), 'R.md', RISK);
        expect(readiness.criticalRisks.value).toBe(0);
    });

    it('is unconfigured with no key, and unconfigured with a key but an empty vocabulary', () => {
        // A key is half of a criterion; the other half is which values clear it. A key bound
        // with no value list is unconfigured, not empty — the same answer as no key at all,
        // and for the same reason.
        expect(readinessOf(multiRiskVault(), 'R.md', {}).criticalRisks.unconfigured).toBe(true);
        expect(readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk' }).criticalRisks.unconfigured).toBe(true);
        // BOTH lists, in both directions: this criterion reads two vocabularies, and either
        // one missing leaves it unable to answer. With no way to say a risk has been dealt
        // with, "3 of 3 outstanding" is an unfinished configuration reported as a finding
        // about the release.
        expect(
            readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk', criticalRiskValues: ['High'] })
                .criticalRisks.unconfigured,
        ).toBe(true);
        expect(
            readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk', addressedRiskValues: ['Mitigated'] })
                .criticalRisks.unconfigured,
        ).toBe(true);
    });

    it('counts a malformed risk value as unreadable, never as absent', () => {
        // Absence clears this criterion; a value the reader cannot interpret must not. A
        // filter that dropped unreadable entries left an empty list indistinguishable from
        // no list, so malformed critical-risk data made a release look ready.
        const criterion = readinessOf(malformedRiskVault(), 'R.md', RISK).criteria.find((c) => c.key === 'risk');
        expect(criterion?.unreadable).toBe(1);
        expect(criterion?.outstanding).toBe(1);
    });

    it('counts a PARTLY readable risk list as unreadable', () => {
        // `['Low', { level: 'Critical' }]` keeps its `Low`, so counting only the survivors
        // clears the member on the strength of the half of the list that happened to parse —
        // while the entry nobody could read might be the unaddressed critical risk.
        const criterion = readinessOf(mixedRiskVault(), 'R.md', RISK).criteria.find((c) => c.key === 'risk');
        expect(criterion?.unreadable).toBe(1);
        expect(criterion?.cleared).toBe(0);
    });

    it('counts no context ancestor, whatever risk it carries', () => {
        const withContext = readinessOf(contextRiskVault(), 'R.md', RISK);
        expect(withContext.criticalRisks).toEqual(readinessOf(multiRiskVault(), 'R.md', RISK).criticalRisks);
    });
});
```

`multiRiskVault()` gives one member three risk values including a critical unaddressed one.
`lowAndBlankRiskVault()` has one member at `Low` and one with no risk key.
`addressedRiskVault()` has a member at `Critical` and `Mitigated` together — write both
values in the one list, since a member carrying several values is exactly the case the first
assertion is about. `contextRiskVault()` puts a `Critical` context ancestor above the
members of `multiRiskVault()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/releaseReadiness.test.ts -t 'critical risk predicate'`
Expected: FAIL — `criticalRisks` is unconfigured for every case.

- [ ] **Step 3: Implement it**

In `src/domain/releaseReadiness.ts`:

```ts
/**
 * **Absence is an answer here**, and this is the exception this criterion is most often got
 * backwards. It asks whether CRITICAL risks are addressed, so a member clears it by being
 * **not critical, or addressed** — a `Low` is not an outstanding critical risk, and neither
 * is a missing value. Reading it as "addressed or nothing" fails a release for every
 * ordinary low and medium risk in it, and demands a synthetic value on risk-free items
 * besides, which is the plugin inventing data to satisfy its own check. Only a critical
 * value that is not among the addressed ones costs the criterion an item, which is what the
 * criterion's own name says.
 *
 * **A key is half of a criterion; the other half is which values clear it** — and this
 * criterion reads TWO vocabularies, so a key bound with either list empty is unconfigured,
 * the same answer as no key at all. `docs/requirements/Release readiness.md` names both:
 * critical risks "names which risk values are critical AND which values count as addressed".
 * An earlier draft of this comment argued that an empty addressed list is a true reading
 * rather than a missing one — that a vault with no word for "addressed" simply has every
 * critical value outstanding. It contradicted this task's own test two paragraphs up, and
 * the test is the one that matches the register: with no way to say a risk has been dealt
 * with, "3 of 3 outstanding" is a configuration nobody finished, reported as a finding about
 * the release.
 *
 * **Absence and unreadability are different answers, and the filter used to collapse them.**
 * A member with NOTHING where this looks clears the criterion — that is the exception above.
 * A member whose risk property holds an object, or a list of them, has a value the reader
 * cannot interpret: dropping those entries leaves an empty list indistinguishable from an
 * absent one, so malformed critical-risk data would make a release look ready. A present but
 * unreadable value costs the member the criterion and is reported in `unreadable`, which is
 * what 5a asks. Raised by a review bot against a draft that filtered and forgot.
 */
function riskCriterion(app: App, members: BacklogItem[], settings: ReleaseSettings): ReleaseCriterion {
	// BOTH vocabularies, not just the critical one — see this function's own docblock.
	if (settings.riskKey === '' || settings.criticalRiskValues.length === 0 || settings.addressedRiskValues.length === 0) {
		return unconfiguredCriterion('risk');
	}
	let cleared = 0;
	let outstanding = 0;
	let unreadable = 0;
	for (const item of members) {
		const reading = riskValuesOf(app, item, settings);
		if (reading.unreadable) {
			// A value the reader cannot interpret is not an absent one — see the docblock.
			unreadable += 1;
			outstanding += 1;
			continue;
		}
		// Counted ONCE per member however many values it holds — the acceptance criterion.
		const values = reading.values;
		const exposed = values.some(
			(value) =>
				settings.criticalRiskValues.some((critical) => sameValue(value, critical)) &&
				!values.some((held) => settings.addressedRiskValues.some((ok) => sameValue(held, ok))),
		);
		if (exposed) outstanding += 1;
		else cleared += 1;
	}
	return { key: 'risk', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable };
}

/**
 * A member's risk values, and whether the property held something this reader refuses.
 * `undefined` and `null` are ABSENCE and read as no values with `unreadable` false; anything
 * else that yields no readable string — an object, a list of them, an empty string — is a
 * value somebody wrote that this reader cannot use.
 */
function riskValuesOf(
	app: App,
	item: BacklogItem,
	settings: ReleaseSettings,
): { values: string[]; unreadable: boolean } {
	const raw = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.riskKey);
	if (raw === undefined || raw === null) return { values: [], unreadable: false };
	const entries = Array.isArray(raw) ? raw : [raw];
	const values: string[] = [];
	// **ANY rejected entry, not only a list where every entry was rejected.** A mixed list
	// like `['Low', { level: 'Critical' }]` keeps its `Low` and would otherwise read as a
	// clean, clearing value while the entry nobody could read might be the unaddressed
	// critical risk. Counting the survivors is the version that reports a release ready on
	// the strength of the half of a list that happened to parse.
	let rejected = false;
	for (const entry of entries) {
		const text = readString(entry);
		if (text === null) rejected = true;
		else values.push(text);
	}
	// An empty LIST is absence, not a refusal: `risk: []` says the same thing as no key, the
	// reading `dependsOn` already takes for an edge list nothing wrote. An empty STRING is
	// not — `readString` refuses it, so it arrives here as a rejected entry, which is the
	// register's own rule for a value somebody wrote and no reader will guess at.
	return { values, unreadable: rejected };
}
```

Add `readString` and `sameValue` to the `./noteFields` import. `sameValue` is the
case-insensitive comparison the rest of `domain/` uses, so a vault writing `high` matches a
list saying `High`.

Wire it into `releaseReadiness`, computed once like the others:

```ts
	const risk = riskCriterion(app, members, settings);
	return {
		members: members.length,
		criteria: [estimateCriterion(app, members, settings), blocked, risk],
		...effortFigures(app, members, settings, planSettings),
		blocked: figureFrom(blocked),
		criticalRisks: figureFrom(risk),
	};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseReadiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the absence test fail under the wrong reading**

Change the clearing condition to "addressed or nothing" — that is, count a member as exposed
whenever it holds no addressed value — and re-run. Expected: "clears on a non-critical value
AND on no value at all" FAILS. Restore the correct reading and re-run to green.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check`

```bash
git add src/domain/releaseReadiness.ts test/domain/releaseReadiness.test.ts
git commit -m "$(cat <<'MSG'
Count the critical risks a release has not addressed

A member is counted once however many values it carries, and it clears the
criterion by being not critical OR addressed — a Low is not an outstanding
critical risk, and neither is a missing value. A risk key bound with no
critical vocabulary is unconfigured rather than empty: a key is half a
criterion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 5: The chip row and the figures on screen

**Files:**
- Create: `src/view/release/renderReadiness.ts`
- Create: `styles/releaseReadiness.css`
- Modify: `styles/index.css` (import the partial)
- Modify: `src/view/release/renderScope.ts` (call it from `drawHeader`)
- Modify: `src/i18n/en.ts`
- Test: `test/view/releaseReadiness.test.ts`

**Interfaces:**
- Consumes: `ReleaseReadiness`, `ReleaseCriterion`, `Verdict`, `releaseReadiness` from Tasks
  2–4.
- Produces: `drawReadiness(headerEl: HTMLElement, readiness: ReleaseReadiness): void` and
  `drawReadinessFigures(sumEl: HTMLElement, readiness: ReleaseReadiness): void`.

- [ ] **Step 1: Write the failing test**

Create `test/view/releaseReadiness.test.ts`, mounting the way
`test/view/releaseScopeRender.test.ts` does — read it first and reuse `makeReleaseView`,
`RELEASE_CONFIG`, `scopeVault` and `useViewHarness` exactly as it does.

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { useViewHarness } from '../helpers/view';

describe("a release's readiness on screen", () => {
    useViewHarness();

    it('draws one chip per criterion, in order', () => {
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort',
            dependsOnProperty: 'note.dependsOn', riskProperty: 'note.risk',
            criticalRiskValues: 'Critical', addressedRiskValues: 'Mitigated' });
        const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
        expect(chips).toHaveLength(3);
        expect(chips.map((el) => el.dataset.criterion)).toEqual(['estimated', 'blocked', 'risk']);
    });

    it('collapses to one chip when every criterion is unconfigured', () => {
        // Three chips saying nothing three times is noise on exactly the vault that most
        // needs signal. One chip still LISTS them, which is what the readiness note asks;
        // the tooltip names all three.
        const { containerEl } = openScope(RELEASE_CONFIG);
        const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
        expect(chips).toHaveLength(1);
        // The three names are reachable without a pointer: a tooltip on a static, unfocusable
        // div reaches nobody using a keyboard or a screen reader, which is the same objection
        // this row already answers for an unsatisfied chip.
        const hidden = chips[0].querySelector('.pbl-sr-only') as HTMLElement;
        expect(hidden.textContent).toBe('Estimated, Dependencies resolved, Critical risks addressed');
        expect(hidden.getAttribute('aria-hidden')).toBeNull();
        expect(chips[0].textContent).toContain('Readiness: 3 criteria not configured');
    });

    it('names the criterion in every chip that is not satisfied', () => {
        // Two chips both reading "2 of 5 outstanding" are indistinguishable, and the tooltip
        // that would separate them is on a static unfocusable div — a pointer-only channel.
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort',
            dependsOnProperty: 'note.dependsOn', riskProperty: 'note.risk',
            criticalRiskValues: 'Critical', addressedRiskValues: 'Mitigated' });
        const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
        for (const chip of chips) {
            if (chip.classList.contains('pbl-rel-crit-ok')) continue;
            expect(chip.textContent).toMatch(/Estimated|Dependencies resolved|Critical risks addressed/);
        }
    });

    it('keeps the effort figures when progress is unconfigured', () => {
        // They read the ESTIMATE key, not the state workflow, so the summary's early return
        // for unconfigured progress must not take them with it.
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort', stateProperty: '' });
        const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
        expect(strip.textContent).toContain('unestimated');
        expect(strip.querySelector('.pbl-rel-unreadable')).not.toBeNull();
        // The estimated total still answers; the progress THROUGH it does not, so it is
        // stated alone rather than against a zero that would read as measured.
        expect(strip.textContent).toContain('pts estimated');
        expect(strip.textContent).not.toContain('0 of');
    });

    it('draws the effort figure for a release whose every estimate is zero', () => {
        // `0` is a valid estimate, so this is not the same release as one nobody estimated —
        // and the percentage must not be a NaN drawn as one.
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' }, 'Zeros.md');
        const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
        expect(strip.textContent).toContain('0 of 0 pts (0%)');
        expect(strip.textContent).not.toContain('NaN');
    });

    it('keeps individual chips when only some are unconfigured', () => {
        // A mix is where the unconfigured one is the actionable item, so it keeps its own
        // chip rather than being folded away with the answers beside it.
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' });
        const chips = [...containerEl.querySelectorAll('.pbl-rel-crit')] as HTMLElement[];
        expect(chips).toHaveLength(3);
    });

    it('draws no readiness row for a release with no members', () => {
        const { containerEl } = openScope({ ...RELEASE_CONFIG, estimateProperty: 'note.effort' }, 'Empty.md');
        expect(containerEl.querySelector('.pbl-rel-ready')).toBeNull();
    });

    it('plans no write while the screen renders', () => {
        // The category check on the CALL, not a list of the paths somebody thought of: this
        // whole increment is a read, and the next render path added must not be able to
        // reopen that by omission.
        const { view } = makeReleaseView(scopeVault(), { ...RELEASE_CONFIG, estimateProperty: 'note.effort' });
        const spy = vi.spyOn(view, 'applySafely');
        view.pick('R.md');
        expect(spy).not.toHaveBeenCalled();
    });
});
```

Write `openScope(config, path = 'R.md')` as a local helper mirroring
`releaseScopeRender.test.ts`'s own. Add a `Zeros.md` release to the fixture vault whose two
members both carry `effort: 0`, for the zero-total assertion. If the release view's write entry point is not
`applySafely` on the view, spy on whatever `view/writeGate.ts` actually exposes for this
view — read it and name the real method rather than the one this plan guessed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/releaseReadiness.test.ts`
Expected: FAIL — no `.pbl-rel-crit` element exists.

- [ ] **Step 3: Add the catalog keys**

In `src/i18n/en.ts`, beside the other `release.scope.*` keys:

```ts
	'release.scope.readinessEstimated': 'Estimated',
	'release.scope.readinessBlocked': 'Dependencies resolved',
	'release.scope.readinessRisk': 'Critical risks addressed',
	/** A criterion partly met: the number somebody actually acts on comes first. */
	/** A criterion not fully met NAMES itself: two chips both reading "2 of 5 outstanding"
	 *  are indistinguishable, and the only identity would be a tooltip on a static,
	 *  unfocusable div — which reaches a pointer alone. */
	'release.scope.readinessPartly': '{criterion}: {outstanding} of {count} outstanding',
	/** The same, where some of those could not be read at all — extension 5a wants the
	 *  unreadable ones stated rather than folded into the total. */
	'release.scope.readinessPartlyUnreadable': '{criterion}: {outstanding} of {count} outstanding, {unreadable} unreadable',
	'release.scope.readinessUnconfigured': '{criterion}: not configured',
	/** Every criterion unconfigured — one chip rather than three saying nothing. The
	 *  tooltip names all three, so nothing is hidden by the collapse. */
	'release.scope.readinessNoneConfigured': {
		one: 'Readiness: {count} criterion not configured',
		other: 'Readiness: {count} criteria not configured',
	},
	'release.scope.effort': '{done} of {total} pts ({pct}%)',
	/** Estimated but not measurable: the estimate key is bound and no workflow can say what
	 *  done means, so there is a total and no progress through it. */
	'release.scope.effortEstimated': '{total} pts estimated',
	'release.scope.effortUnconfigured': 'Effort is not configured',
	'release.scope.unestimated': '{count} unestimated',
```

Match the plural shape to whatever `release.scope.members` uses in this file — read it and
copy its structure rather than the sketch above.

- [ ] **Step 4: Write the render module**

Create `src/view/release/renderReadiness.ts`:

```ts
import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { ReleaseCriterion, ReleaseReadiness } from '../../domain/releaseReadiness';

/**
 * The readiness chip row, and the figures that join the summary strip beside the bar.
 *
 * A second module rather than more of `renderScope.ts`, which is at 584 lines: this draws a
 * different thing from a different model, and the 400-line cap is a gate rather than a
 * preference.
 *
 * **Nothing is derived here.** Every number and every verdict comes from
 * `domain/releaseReadiness.ts`, which computed them in one walk — a count written beside the
 * chip that reported it would be a second opinion about a number with one right answer,
 * which is the defect `Summing up a release` exists to prevent.
 */

/** Which criterion is which, for the test and for the stylesheet — never a user-facing name. */
const CRITERION_NAME: Record<ReleaseCriterion['key'], () => string> = {
	estimated: () => t('release.scope.readinessEstimated'),
	blocked: () => t('release.scope.readinessBlocked'),
	risk: () => t('release.scope.readinessRisk'),
};

export function drawReadiness(headerEl: HTMLElement, readiness: ReleaseReadiness): void {
	// Withheld whole for a release with no members, `drawSummary`'s own rule: three verdicts
	// beside an empty state that already says the release is empty says it twice and worse.
	//
	// **The MEMBER COUNT, never the verdicts.** An unconfigured criterion reads
	// `unconfigured` whether the release holds fifty members or none, so "every verdict is
	// empty" is false for an empty release the moment one criterion is unconfigured — and
	// true for no release where any criterion is. A review bot caught that against this
	// plan's own `Empty.md` test, which binds the estimate key alone.
	if (readiness.members === 0) return;
	const rowEl = headerEl.createDiv({ cls: 'pbl-rel-ready' });
	const unconfigured = readiness.criteria.filter((c) => c.verdict === 'unconfigured');
	if (unconfigured.length === readiness.criteria.length) {
		drawCollapsed(rowEl, unconfigured);
		return;
	}
	for (const criterion of readiness.criteria) drawChip(rowEl, criterion);
}

/**
 * Every criterion unconfigured: ONE chip. Three chips saying nothing three times is noise on
 * exactly the vault that most needs signal — a first run, where ✨ has bound the keys and
 * nobody has written the vocabularies yet. The readiness note requires an unconfigured
 * criterion to be LISTED rather than silent, and the tooltip lists all three, so the collapse
 * hides nothing.
 */
function drawCollapsed(rowEl: HTMLElement, unconfigured: ReleaseCriterion[]): void {
	const chipEl = rowEl.createDiv({
		cls: 'pbl-state-chip pbl-state-static pbl-rel-crit pbl-rel-crit-unset',
		text: t('release.scope.readinessNoneConfigured', { count: unconfigured.length }),
	});
	const names = unconfigured.map((criterion) => CRITERION_NAME[criterion.key]()).join(', ');
	setTooltip(chipEl, names);
	// **Not the tooltip alone.** This chip is a static, unfocusable `div`, so `setTooltip`
	// reaches a pointer and nobody else — the identical objection this module already
	// answers for an unsatisfied chip by putting its criterion in the visible text. Here the
	// visible text is the whole point of the collapse, so the names ride a `.pbl-sr-only`
	// span instead: `drawSummary`'s own provenance sentence uses exactly this mechanism, and
	// for exactly this reason (`aria-describedby` is not reliably exposed on a role-less,
	// unfocusable host, and an `aria-label` would REPLACE the count the chip draws). Raised
	// by a review bot, which was right that the earlier draft claimed the collapse "hides
	// nothing" while hiding it from everyone not using a mouse.
	chipEl.createSpan({ cls: 'pbl-sr-only', text: names });
}

function drawChip(rowEl: HTMLElement, criterion: ReleaseCriterion): void {
	const name = CRITERION_NAME[criterion.key]();
	const chipEl = rowEl.createDiv({
		cls: `pbl-state-chip pbl-state-static pbl-rel-crit pbl-rel-crit-${verdictClass(criterion.verdict)}`,
		text: chipText(criterion, name),
	});
	chipEl.dataset.criterion = criterion.key;
	setTooltip(chipEl, name);
}

function chipText(criterion: ReleaseCriterion, name: string): string {
	if (criterion.verdict === 'unconfigured') return t('release.scope.readinessUnconfigured', { criterion: name });
	if (criterion.outstanding === null || criterion.cleared === null) return name;
	if (criterion.verdict === 'satisfied') return name;
	// "Satisfied, partly and not are a count, not a judgement" — so a criterion that is not
	// satisfied says HOW MANY, which is the number somebody acts on. It also says WHICH: two
	// unsatisfied criteria both reading "2 of 5 outstanding" are indistinguishable, and the
	// tooltip that would tell them apart is on a static unfocusable div and reaches a pointer
	// alone. The harness mock had the name in every chip; an earlier draft of this module
	// dropped it, and a review bot caught the regression.
	const count = criterion.cleared + criterion.outstanding;
	// The unreadable ones are STATED rather than folded into the total — extension 5a. Zero
	// of them takes the shorter sentence, so an ordinary release does not carry a ", 0
	// unreadable" nobody needs.
	if (criterion.unreadable !== null && criterion.unreadable > 0) {
		return t('release.scope.readinessPartlyUnreadable', {
			criterion: name,
			outstanding: criterion.outstanding,
			count,
			unreadable: criterion.unreadable,
		});
	}
	return t('release.scope.readinessPartly', { criterion: name, outstanding: criterion.outstanding, count });
}

/** A `Verdict` is domain vocabulary; this is the stylesheet's. Kept apart deliberately —
 *  a class name is not a value the plugin persists, and a verdict is not a colour. */
function verdictClass(verdict: ReleaseCriterion['verdict']): string {
	if (verdict === 'satisfied') return 'ok';
	if (verdict === 'partly') return 'part';
	if (verdict === 'not') return 'no';
	return 'unset';
}

/**
 * The three figures joining the existing summary strip. The estimate progress is ONE figure
 * with its denominator named inside it (`9 of 15 pts (60%)`) rather than a sum and a second
 * percentage: mocked both ways in the harness, and two percentages beside the items bar read
 * as competing and wrapped the strip at 900px.
 *
 * All three read the same key, so all three are absent together — the count included. A
 * `2 unestimated` beside `Effort is not configured` contradicts itself.
 */
export function drawReadinessFigures(sumEl: HTMLElement, readiness: ReleaseReadiness): void {
	const total = readiness.estimatedEffort.value;
	const done = readiness.completedEffort.value;
	if (total === null) {
		// The estimate key itself is unbound, so none of the three figures answers.
		sumEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.scope.effortUnconfigured') });
		return;
	}
	// A release whose every member is unestimated has nothing to sum, which is a different
	// statement from a total of zero — extension 4a. **Decided from the COUNT of estimated
	// members, never from the sum**: `0` is a valid estimate this predicate accepts, so a
	// release whose members all estimate zero (or whose estimates cancel) would otherwise be
	// drawn exactly like one nobody has estimated at all. A review bot caught that on this
	// plan's first draft, which tested `total > 0`.
	const estimatedMembers = readiness.criteria.find((criterion) => criterion.key === 'estimated')?.cleared ?? 0;
	if (estimatedMembers > 0) {
		// `done === null` is the estimate key bound with no workflow that can say done: there
		// is a real total and no progress through it, so the total is stated alone rather
		// than against a zero that would read as measured.
		if (done === null) {
			sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.effortEstimated', { total }) });
		} else {
			// A real total of zero has no percentage to compute, and dividing by it produces
			// the `NaN` that would be drawn as one. Zero is the only case left: negative
			// estimates are refused at the reader, so `0 <= done <= total` holds and the
			// percentage cannot come out negative or above 100.
			const pct = total === 0 ? 0 : Math.round((100 * done) / total);
			sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.effort', { done, total, pct }) });
		}
	}
	if (readiness.unestimated.value !== null) {
		sumEl.createSpan({
			cls: 'pbl-rel-figure',
			text: t('release.scope.unestimated', { count: readiness.unestimated.value }),
		});
	}
}
```

- [ ] **Step 5: Write the stylesheet partial**

Create `styles/releaseReadiness.css`:

```css
/* The readiness chip row, under the footline. `.pbl-state-chip` (columns.css) supplies the
   whole chip; this partial adds only the three verdict colours and the row's own layout.

   `max-width: none` overrides the chip's own 140px cap, which exists for a property column
   and would clip a sentence here. Measured in the browser harness at 900px and 560px. */
.pbl-rel-ready {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
	padding-block-start: var(--size-4-2);
}

.pbl-rel-crit {
	max-width: none;
}

/* Obsidian's own semantic colours, never literals — a themed vault restates these and the
   chips follow it. Border AND text, so the verdict survives a theme that flattens one. */
.pbl-rel-crit-ok {
	color: var(--text-success);
	border-color: var(--text-success);
}

.pbl-rel-crit-part {
	color: var(--text-warning);
	border-color: var(--text-warning);
}

.pbl-rel-crit-no {
	color: var(--text-error);
	border-color: var(--text-error);
}

/* Recessive on purpose: an unbound key is a setup task, not a release blocker, so it must
   not compete with a real verdict beside it. */
.pbl-rel-crit-unset {
	font-style: italic;
}
```

- [ ] **Step 6: Import the partial**

In `styles/index.css`, add `@import 'releaseReadiness.css';` after the `releaseScope.css`
import. Order matters where two rules of equal specificity contest a property; nothing here
does, so the position is only a reading convenience — put it beside its neighbour and say so
if `index.css`'s own header asks for a reason.

- [ ] **Step 7: Wire it into the header**

In `src/view/release/renderScope.ts`, import both functions and extend `drawHeader`. The
readiness is computed **once** and handed to both, never derived twice:

```ts
	const footEl = headerEl.createDiv({ cls: 'pbl-rel-footline' });
	const readiness = releaseReadiness(view.app, scope, releaseSettings, planSettings);
	drawSummary(footEl, release, scope.members, planSettings, readiness);
	drawReleaseActions(view, footEl, release, scope, planSettings);
	drawReadiness(headerEl, readiness);
```

and inside `drawSummary`, call `drawReadinessFigures(sumEl, readiness)` **in both branches** —
immediately before the early `return` in the unconfigured-progress branch, and again at the
end of the configured one, after the `.pbl-sr-only` provenance span.

**Both, and that is the point.** `drawSummary` returns early when progress is unconfigured
(`release.done.unconfigured || release.done.value === null`), and the effort figures and the
unestimated count depend on the ESTIMATE key rather than on the state workflow. Placed only
after the configured rollup, a release with an estimate key bound and no state workflow would
lose readable figures along with the one that really is unreadable. The earlier return —
`release.members.unconfigured || members === 0` — is different and needs no call: it fires
before `sumEl` exists, and a release with no members has nothing to sum anyway. Read `drawSummary`'s current signature and
thread the parameter through rather than reaching for a module-level value. Where
`releaseSettings` comes from, follow what `renderScope.ts` already has in hand —
`releaseView.ts` passes it to this module today.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run test/view/releaseReadiness.test.ts`
Expected: PASS.
Run: `npx vitest run test/view/releaseScopeRender.test.ts`
Expected: PASS — the existing header assertions must be undisturbed.

- [ ] **Step 9: Watch the write spy fail without a write**

Temporarily add a `void view.applySafely([])` call inside `drawReadiness` and re-run.
Expected: "plans no write while the screen renders" FAILS. Remove it and re-run to green. A
spy that never fires is worth nothing until it has been seen firing.

- [ ] **Step 10: Look at it**

Run: `npm run harness -- test/harness/release.ts`
Open `.harness/index.html?pick=Releases/0.8.md`, and again with `&theme=light` and at a
narrow window. Confirm the chip row sits under the footline, the strip stays on one line at
900px, and the actions wrap before the strip does at 560px.

- [ ] **Step 11: Run the gate and commit**

Run: `npm run check`

```bash
git add src/view/release/renderReadiness.ts styles/releaseReadiness.css styles/index.css src/view/release/renderScope.ts src/i18n/en.ts test/view/releaseReadiness.test.ts
git commit -m "$(cat <<'MSG'
Put a release's readiness where its decision is made

Three chips under the footline, and the effort figures beside the bar the
screen already draws. The estimate progress is one figure with its denominator
inside it rather than a second percentage competing with the items bar, and
every criterion unconfigured collapses to one chip that names all three in its
tooltip.

Nothing is derived in the renderer: one walk in the domain layer answers the
chips and the figures both.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 6: ✨ binds the three keys

**Files:**
- Modify: `src/view/release/init.ts` (`RELEASE_SUGGESTED_KEYS` and its docblock)
- Test: `test/view/releaseView.test.ts` or whichever suite already drives `runReleaseInit` —
  find it with `grep -rn "RELEASE_SUGGESTED_KEYS\|runReleaseInit" test/` and extend that file
  rather than starting a new one.

**Interfaces:**
- Consumes: the option keys from Task 1.
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the failing test**

In the suite found above, add:

```ts
it('binds the readiness keys too, so a press leaves no criterion unconfigured', () => {
    const config = freshConfig();
    runReleaseInit(config);
    expect(config.get('estimateProperty')).toBe('note.effort');
    expect(config.get('dependsOnProperty')).toBe('note.dependsOn');
    expect(config.get('riskProperty')).toBe('note.risk');
    // The VOCABULARIES are not candidates and could not be: there is no key to hand out —
    // what a vault calls its own risk values is its own to write, the same reason
    // `releaseStatusValues` is absent from this list.
    expect(config.get('criticalRiskValues')).toBeUndefined();
    expect(config.get('addressedRiskValues')).toBeUndefined();
});
```

Match `freshConfig()` and the call shape to whatever that suite already uses.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run <that file> -t 'readiness keys too'`
Expected: FAIL — the three options are undefined.

- [ ] **Step 3: Add the three candidates**

In `src/view/release/init.ts`, append to `RELEASE_SUGGESTED_KEYS`:

```ts
	{ option: 'estimateProperty', suggested: 'effort' },
	{ option: 'dependsOnProperty', suggested: 'dependsOn' },
	{ option: 'riskProperty', suggested: 'risk' },
```

Then extend that constant's docblock with a paragraph in its own voice:

```ts
 * The three readiness keys joined on 2026-09-01, for `stateProperty`'s own reason read once
 * more: without them every criterion on the scope screen reads as unconfigured and the whole
 * readiness half of this view is missing after a ✨ that said it had bound everything.
 * `effort` is `estimationOptions.ts`'s own suggestion for the same concept and `dependsOn`
 * and `risk` are `PROPERTY_TABLE`'s, so a vault pressing ✨ in two views lands on one
 * property rather than two.
 *
 * `criticalRiskValues` and `addressedRiskValues` are NOT candidates and could not be, for
 * `releaseStatusValues`' own reason: they are text options holding a vocabulary rather than
 * properties, and there is no key to hand out. A press therefore leaves the risk criterion
 * unconfigured, which the chip says in words rather than passing silently — the honest
 * outcome, and the one the collapse rule in `renderReadiness.ts` is shaped around.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run <that file>`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run check`

```bash
git add src/view/release/init.ts <that test file>
git commit -m "$(cat <<'MSG'
Let the release view's spark bind its readiness keys

A press that leaves a feature of this view unconfigured did half the job, and
without these three the whole readiness half of the scope screen is missing.
The two risk vocabularies stay out: there is no key to hand out, and what a
vault calls its own risk values is its own to write.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

### Task 7: The register catches up

**Files:**
- Modify: `docs/requirements/Summing up a release.md` (`## Where it lives`, extension 2a, status)
- Modify: `docs/requirements/Answering the readiness checklist.md` (`## Where it lives`, status)
- Create: `docs/requirements/Testing complete as a readiness criterion.md`
- Modify: `CHANGELOG.md` (`[Unreleased]`, under the existing `### Added`)

**Interfaces:** none — this task ships no code.

- [ ] **Step 1: Name the new modules where they are specified**

`docs-check.mjs` rule 7 requires every module in `src/` to be specified in a use case's
`## Where it lives` or an ADR's `## Decision`. Replace the closing paragraph of
`Summing up a release.md`'s `## Where it lives` — the one beginning "The REST of this note's
figures … are still nothing yet" — with what shipped:

```markdown
**Corrected 2026-09-01.** The remaining figures are `src/domain/releaseReadiness.ts`, which
walks the population `releaseScope` (`src/domain/releases.ts`) already resolved rather than
the model a second time, and returns the criteria and the figures from ONE pass — the effort
sums, the unestimated count, the blocked count and the critical-risk count together, because
each figure is a criterion counted. They are drawn by
`src/view/release/renderReadiness.ts`, called from `renderScope.ts`'s own `drawHeader`.

The estimate-denominator progress is **one figure with its denominator inside it** rather than
a second percentage beside the items bar: mocked both ways in the browser harness on
2026-09-01, where two percentages read as competing and wrapped the strip at 900px.

The **double-count qualifier** — a member carrying an estimate while a descendant in the same
release carries one — is NOT here and is deliberately deferred to
[[Capacity against commitment]], which owns that figure. Until it lands the effort total is
wrong in a vault whose parent estimates are aggregates; `releaseReadiness.ts` carries a
`ponytail:` comment saying so at the sum rather than leaving the gap silent.
```

- [ ] **Step 2: Amend extension 2a**

In the same file, extend extension 2a so it says what shipped:

```markdown
- **2a — the estimate key is unconfigured.** The effort figures, the estimate denominator
  **and the unestimated figure** are absent and named as unconfigured; the item count and the
  item-denominator progress still answer. **Amended 2026-09-01**: this read "the effort
  figures and the estimate denominator" until the harness mock drew `2 unestimated` beside
  `Effort is not configured` — the count reads the same key as the sums, so a screen showing
  one without the others contradicts itself.
```

- [ ] **Step 3: Name the modules in the readiness PBI**

In `docs/requirements/Answering the readiness checklist.md`'s `## Where it lives`, name
`src/domain/releaseReadiness.ts` (the criteria and their verdicts),
`src/view/release/renderReadiness.ts` (the chip row), `styles/releaseReadiness.css` and the
five options in `src/domain/releaseOptions.ts`. State the two decisions the code cannot show:
that a prerequisite is cleared by this view's own already-bound `stateKey` and its done
values rather than a sixth and seventh option, and that every criterion unconfigured collapses
to one chip naming all three in its tooltip.

- [ ] **Step 4: Write the deferred criterion's own note**

Create `docs/requirements/Testing complete as a readiness criterion.md` in the plugin's own
schema. Copy the frontmatter shape from `Answering the readiness checklist.md` exactly —
`type: PBI`, `parent: "[[Release readiness]]"`, `order: 20`, `status: Open`, and every empty
field that note carries, since `docs-check.mjs` checks the shape. Body:

```markdown
# Testing complete as a readiness criterion

**As** someone deciding what ships, **I want** the readiness checklist to say whether the
release's scope has been tested, **so that** the one criterion a release is most often held
for is on the same row as the other three.

Deferred out of the 2026-09-01 increment deliberately, and the reason is the shape rather than
the difficulty: the other three criteria are each **a figure the summary already needed**, so
the predicate and the number are one piece of work. This one maps to no figure, and it costs
two more options — a testing property and the values that count as complete — plus a fifth
vocabulary the vault has to write before the criterion answers at all.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | A release being open with the testing property configured |
| **Preconditions** | The membership property is configured |
| **Guarantee** | The criterion is evaluated over the members alone, counted once per item, and a key bound with no value list reads as unconfigured rather than as failed. |

**Main flow**

1. The view reads each member's own testing state.
2. A member clears the criterion when its state is among the declared complete values.
3. The chip reports satisfied, partly with a count, or not — the same three answers its
   three neighbours give.

**Extensions**

- **1a — no testing key, or a key with no complete values.** The criterion reads as
  unconfigured and names what is missing. A key is half of a criterion.
- **2a — a member with no testing state.** It does not clear: an unanswered item is not a
  passing one. Unlike the risk criterion, absence is not an answer here — "not tested" is the
  outstanding case this criterion exists to find.

## Acceptance criteria

- A key bound with an empty complete-value list reads as unconfigured, never as zero cleared.
- A member with no value where the criterion looks is outstanding and is reported in the
  criterion's `unreadable` count.
- The chip joins the existing row in fourth place and the row still fits one line at 900px.

## Where it lives

`src/domain/releaseReadiness.ts` gains a fourth criterion beside the three it already
computes, and `src/view/release/renderReadiness.ts` draws it with no new shape — the row
already loops. `src/domain/releaseOptions.ts` gains the two options.
```

- [ ] **Step 5: Move the statuses**

Set `Answering the readiness checklist.md` to `status: Done`. Leave
`Summing up a release.md` at `status: Active` — the double-count qualifier is its remainder —
and say so in one sentence in its body beside the corrected `## Where it lives`.

- [ ] **Step 6: Add the changelog entry**

In `CHANGELOG.md`, under `[Unreleased]`'s **existing** `### Added` heading — never a second
copy of it, which `test/release/changelogVersion.test.ts` fails on:

```markdown
- Release readiness on a release's own screen: three criteria — everything estimated,
  dependencies resolved, critical risks addressed — beside the effort totals, the estimate
  progress and how much of the scope carries no estimate at all.
```

- [ ] **Step 7: Run the gate**

Run: `npm run check`
Expected: all seven pass — in particular `docs` (the register's hierarchy, sibling orders and
rule 7) and `lint:md`.

- [ ] **Step 8: Commit**

```bash
git add docs/requirements CHANGELOG.md
git commit -m "$(cat <<'MSG'
Let the register say what the readiness increment built

Both new modules are named where they are specified, extension 2a catches up
with what the harness caught, and the testing criterion gets a note of its own
rather than living as a sentence in a plan nobody reads again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019xQ4qKfVa3Fo9D67YQLbHe
MSG
)"
```

---

## Coverage of the spec

| Spec requirement | Task |
| --- | --- |
| Five options on the release view's own bag | 1 |
| ✨ suggests the three keys, not the vocabularies | 6 |
| Unconfigured is a third answer, never zero | 1, 2, 3, 4 |
| Estimate predicate, exported for reuse | 2 |
| Effort sums and the estimate-denominator progress | 2, 5 |
| Unestimated as its own figure, unconfigured with its key | 2, 5 |
| Blocked, counted once per member | 3 |
| Prerequisite cleared by this view's own state key | 3 |
| No edges is resolved | 3 |
| Unreadable prerequisite reported separately (5a) | 3 |
| Self-references and cycles stay unreadable, via the model's own resolution | 3 |
| A workflow with a key but no done values is unconfigured, not "all blocked" | 3 |
| A prerequisite in an unconfigured secondary workflow is unreadable | 3 |
| Every unsatisfied chip names its own criterion | 5 |
| The unreadable count is stated, not folded into the total | 5 |
| A release estimated entirely at zero is not "nothing estimated" | 5 |
| Both risk vocabularies are required before the criterion answers | 4 |
| The effort figures survive an unconfigured progress figure | 5 |
| A numeric prefix (`5 TBD`) is a placeholder, not an estimate | 2 |
| Completed effort is unconfigured when no workflow can say done | 2, 5 |
| A malformed risk value is unreadable, never absent | 4 |
| An unestimated member's workflow does not withhold the effort figure | 2 |
| The collapsed chip's criterion names reach more than a pointer | 5 |
| A partly readable risk list is unreadable, not cleared by its survivors | 4 |
| A negative estimate is refused, so totals cannot cancel | 2 |
| The empty release is decided by the member count, not by verdicts | 2, 5 |
| Critical risks, counted once per member | 4 |
| Absence is an answer for risk | 4 |
| A key with no vocabulary is unconfigured | 4 |
| Context rows in no figure | 2, 4 |
| Empty release satisfies nothing | 2, 5 |
| Chip row under the footline, `.pbl-state-chip` reused | 5 |
| All-unconfigured collapses to one chip; a mix does not | 5 |
| Estimate progress as one figure, not a second percentage | 5 |
| Nothing writes | 5 |
| Both modules specified in a use case (rule 7) | 7 |
| Testing criterion deferred to a PBI of its own | 7 |
| Double-count qualifier deferred, marked at the sum | 2, 7 |
| Changelog entry in this pull request | 7 |
