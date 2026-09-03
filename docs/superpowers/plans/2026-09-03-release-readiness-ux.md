# Release readiness UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave no red state on a release's scope screen without a control that clears it, and let a member's effort and risk be set from that screen.

**Architecture:** Four slices over the existing release view. `domain/releaseReadiness.ts` stays the one walk that computes every figure and gains the *list* behind one count. `domain/releaseWritePlan.ts` gains three planners (a release's capacity, a member's effort, a member's risk) and its existing per-role reconfiguration guard widens to cover them. The view gains two modules — `readinessFix.ts` (a red state and its remedy) and `scopeChips.ts` (a member row's two editable chips) — and every write still goes through `ReleaseView.applyRelease`, the view's single gated write path.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0), vitest + jsdom, ESLint flat config with per-directory import bans, plain CSS partials.

## Global Constraints

- `npm run check` is the gate: build, test typecheck, lint, markdown, coverage-thresholded tests, fallow, docs register. The inner loop is `npm test`. Both must pass before any commit.
- **400-line cap per `src/` file and per `styles/` partial**, enforced by lint and by `scripts/styles-assemble.mjs`. `test/**` caps at 450.
- **Layering:** `main → commands → view → storage → domain`; each layer may reach anything below it and nothing above. `i18n/` is below everything. Violations fail `npm run lint`.
- **Every user-visible sentence is a catalog key** in `src/i18n/en.ts`. No bare string at a setter, at `new Notice`, at `setTooltip`, or in the thirteen banned option-bag properties (`text`/`label`/`title`/`heading`/`description`/`placeholder`/`cta`/`ctaLabel`/`fieldName`/`name`/`displayName`/`reason`/`aria-label`). No message re-spells a view option's label — take it as a parameter (`test/i18n/optionLabels.test.ts`).
- **Never write frontmatter outside `storage/`.** The release view's writer is `applyPropertyWrites` (`storage/propertyWrite.ts`), reached only through `ReleaseView.applyRelease`.
- **The context-row rule:** a `context` scope row is never a write target, never a ranking peer, never a source of anything derived from the results. It renders, it parents, and that is all.
- **A checkmark, an offer or a visibility question is asked of the PLAN** — an entry is checked exactly when picking it would write nothing — never by a comparison written beside the plan.
- **Per-row controls in a tree are `<button tabindex="-1">`** with the row's context menu as their keyboard path. The tree is one tab stop.
- **Capture before the await:** a control plans with the key it was drawn with; the configuration is re-checked at apply time by `reconfiguredKey`.
- Every new `src/` module must be specified in `docs/` — a use case's `## Where it lives` or an ADR's `## Decision` — or `npm run check`'s docs step fails.
- `CHANGELOG.md`'s `[Unreleased]` section gains an entry in the PR that earns it.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/releaseReadiness.ts` (modify) | adds `outstandingPaths` to each criterion, filled in the existing walk |
| `src/domain/releaseWritePlan.ts` (modify) | adds `releaseCapacityWrites`, `memberEffortWrites`, `memberRiskWrites`; widens `ReleaseField` and `reconfiguredKey` |
| `src/domain/scopeRows.ts` (modify) | adds `rowsForPaths` |
| `src/view/release/init.ts` (modify) | `runReleaseInit` takes an optional option-name filter |
| `src/view/release/readinessFix.ts` (create) | a red state → its remedy button and action |
| `src/view/release/scopeChips.ts` (create) | a member row's Effort and Risk chips, their menu entries, and their write paths |
| `src/view/release/renderReadiness.ts` (modify) | chips become buttons; the capacity comparison becomes a bar; red notes route through `readinessFix.ts` |
| `src/view/release/scopeTree.ts` (modify) | draws the two chips on member rows |
| `src/view/release/scopeCreate.ts` (modify) | the row menu gains the readiness entries |
| `src/view/release/renderScope.ts` (modify) | applies the criterion filter before drawing the tree |
| `src/view/release/scopeToolbar.ts` (modify) | draws the clear-filter control while a filter is active |
| `src/view/release/releaseView.ts` (modify) | `criterionFilter` field + `setCriterionFilter`; `applyRelease` docblock widens |
| `styles/releaseScope.css` (modify) | the capacity bar, the two row chips, the pressed criterion chip |
| `src/i18n/en.ts` (modify) | every new sentence |

---

### Task 1: `runReleaseInit` can bind one option

**Files:**
- Modify: `src/view/release/init.ts`
- Modify: `src/view/release/newRelease.ts` (`bindAndReport`)
- Test: `test/view/release/init.test.ts`

**Interfaces:**
- Produces: `runReleaseInit(view: ReleaseView, only?: string[]): Promise<boolean>` — binds only the candidates whose `option` is in `only`; every candidate when `only` is undefined. `bindAndReport(view: ReleaseView, only?: string[]): Promise<boolean>` passes it through.

- [ ] **Step 1: Read the two functions first**

Read `src/view/release/init.ts` in full and `bindAndReport` in `src/view/release/newRelease.ts`. `runReleaseInit` runs two sweeps — `RELEASE_SUGGESTED_KEYS` through `adoptableReleaseKeys`, then `RELEASE_SUGGESTED_VALUES` through `wouldBindValue`. Both take the candidate list; the filter narrows the list handed to each, never the sweep's own logic.

- [ ] **Step 2: Write the failing test**

Add to `test/view/release/init.test.ts`:

```ts
it('binds only the option it was narrowed to', async () => {
    const { view } = makeReleaseView(noReleaseVault(), {});
    const bound = await runReleaseInit(view, ['estimateProperty']);

    expect(bound).toBe(true);
    expect(view.config.getAsPropertyId('estimateProperty')).toBe('note.effort');
    // Every other candidate is untouched — the whole point of the narrowing.
    expect(view.config.getAsPropertyId('capacityProperty')).toBeNull();
    expect(view.config.getAsPropertyId('membershipProperty')).toBeNull();
});

it('reports nothing bound when the narrowed option is already set', async () => {
    const { view } = makeReleaseView(noReleaseVault(), { estimateProperty: 'note.effort' });
    expect(await runReleaseInit(view, ['estimateProperty'])).toBe(false);
});
```

Import `runReleaseInit` and `noReleaseVault` if the file does not already.

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/view/release/init.test.ts`
Expected: FAIL — `runReleaseInit` takes one argument, so the second is a type error, and without the filter the first assertion's siblings are bound too.

- [ ] **Step 4: Implement**

In `init.ts`, add the parameter and narrow both candidate lists before their sweeps:

```ts
export async function runReleaseInit(view: ReleaseView, only?: string[]): Promise<boolean> {
    // The filter narrows the CANDIDATE LIST, never the sweep: `adoptableReleaseKeys` mutates
    // a `taken` set as it goes, so narrowing afterwards would let a key this press is not
    // binding still reserve itself against one it is. `initControl.ts`'s own `fixes`
    // narrowing makes the identical choice for the offer.
    const wanted = (option: string): boolean => only === undefined || only.includes(option);
    const keys = RELEASE_SUGGESTED_KEYS.filter((candidate) => wanted(candidate.option));
    const values = RELEASE_SUGGESTED_VALUES.filter((candidate) => wanted(candidate.option));
    // …the existing body, reading `keys` and `values` where it read the two constants.
}
```

In `newRelease.ts`, widen `bindAndReport` the same way and pass it through:

```ts
export async function bindAndReport(view: ReleaseView, only?: string[]): Promise<boolean> {
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run test/view/release/init.test.ts test/view/release/initControl.test.ts test/view/release/newRelease.test.ts`
Expected: PASS — the existing callers pass no filter and keep binding everything.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: runReleaseInit can bind one named option"
```

---

### Task 2: A red state that names an unbound key becomes a bind button

**Files:**
- Create: `src/view/release/readinessFix.ts`
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `src/i18n/en.ts`
- Modify: `styles/releaseScope.css`
- Modify: `docs/requirements/Commitment against declared capacity.md` (`## Where it lives`)
- Test: `test/view/release/readinessFix.test.ts`

**Interfaces:**
- Consumes: `bindAndReport(view, only?)` from Task 1.
- Produces:
  - `drawFixNote(view: ReleaseView, parentEl: HTMLElement, text: string, remedy: Remedy | null): void` — draws `.pbl-rel-unreadable` as a plain span when `remedy` is null, and as a `.pbl-rel-fix` button carrying the same text when it is not.
  - `type Remedy = { kind: 'bind'; option: string } | { kind: 'open'; file: TFile } | { kind: 'run'; run: () => void }`

- [ ] **Step 1: Read what draws red today**

Read `src/view/release/renderReadiness.ts`. Every red state is `note(sumEl, t(...))`, one helper at the bottom of the file. The states that name an unbound key are `release.scope.effortUnconfigured` (no `estimateKey`) and `release.scope.capacityUnconfigured` (no `capacityKey`).

- [ ] **Step 2: Write the failing test**

Create `test/view/release/readinessFix.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen, scopeVault } from '../../helpers/release';
import { RELEASE_CONFIG } from '../../helpers/release';
import { flush, useViewHarness } from '../../helpers/view';

useViewHarness();

/** The scope screen with the estimate and capacity properties deliberately unbound — the
 *  state a reader lands in before anything has been configured for readiness. */
function unboundScreen() {
    const config: Record<string, unknown> = { ...RELEASE_CONFIG };
    delete config.estimateProperty;
    delete config.capacityProperty;
    return releaseScreen({}, scopeVault(), config);
}

describe('an unbound readiness key', () => {
    it('draws its red note as a button that binds that one option', async () => {
        const { view } = unboundScreen();
        const fixes = view.viewEl.querySelectorAll<HTMLButtonElement>('.pbl-rel-fix');
        // One for the effort key, one for the capacity key.
        expect(fixes.length).toBe(2);

        const effort = [...fixes].find((el) => el.dataset.fix === 'estimateProperty')!;
        effort.click();
        await flush();

        expect(view.config.getAsPropertyId('estimateProperty')).toBe('note.effort');
        // The capacity option is NOT bound: the button binds what its own sentence is about.
        expect(view.config.getAsPropertyId('capacityProperty')).toBeNull();
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/view/release/readinessFix.test.ts`
Expected: FAIL — no `.pbl-rel-fix` element exists, so `fixes.length` is 0.

- [ ] **Step 4: Write `readinessFix.ts`**

```ts
import { Notice, TFile, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { bindAndReport } from './newRelease';

/**
 * A red state and the press that clears it.
 *
 * The scope screen states every figure it cannot read, and until now stated them and
 * stopped: an unbound key named a property nobody could bind from this screen, and an
 * unreadable value named a note nobody could open from it. This module is the one place
 * that pairing is decided — the SENTENCE stays `renderReadiness.ts`'s, because it is the
 * figure's own; what this owns is what pressing it does.
 *
 * Nothing here plans a write. A `bind` remedy touches the `.base` alone (`init.ts`), an
 * `open` remedy opens a note, and a `run` remedy is a dialog its caller owns — so this
 * module reaches no writer and states no rule about one.
 */
export type Remedy =
    | { kind: 'bind'; option: string }
    | { kind: 'open'; file: TFile }
    | { kind: 'run'; run: () => void };

/**
 * The red note, with its action where one exists. A state with no remedy keeps the plain
 * span it always drew — a button that does nothing is worse than a sentence that says so.
 *
 * `dataset.fix` carries the option a bind remedy names, so a test and a reader's own
 * inspector can tell two fix buttons apart; the visible text is the figure's sentence and
 * is never rewritten here.
 */
export function drawFixNote(view: ReleaseView, parentEl: HTMLElement, text: string, remedy: Remedy | null): void {
    if (remedy === null) {
        parentEl.createSpan({ cls: 'pbl-rel-unreadable', text });
        return;
    }
    const btn = parentEl.createEl('button', { cls: 'pbl-rel-unreadable pbl-rel-fix', attr: { type: 'button' }, text });
    if (remedy.kind === 'bind') btn.dataset.fix = remedy.option;
    setTooltip(btn, tooltipFor(remedy));
    btn.addEventListener('click', () => runRemedy(view, remedy));
}

function tooltipFor(remedy: Remedy): string {
    if (remedy.kind === 'bind') return t('release.fix.bind');
    if (remedy.kind === 'open') return t('release.fix.open');
    return t('release.fix.edit');
}

function runRemedy(view: ReleaseView, remedy: Remedy): void {
    if (remedy.kind === 'run') {
        remedy.run();
        return;
    }
    if (remedy.kind === 'open') {
        view.opener.open(view.openContext(), { file: remedy.file }, null);
        return;
    }
    void bindAndReport(view, [remedy.option]).then((bound) => {
        new Notice(bound ? t('release.new.bound') : t('release.init.nothing'));
        // A press that bound nothing changed no configuration, so there is nothing for a
        // redraw to show — and skipping it keeps focus on THIS button rather than on a
        // detached copy of it. `initControl.ts` makes the identical call.
        if (bound) view.render();
    });
}
```

Check `OpenController.open`'s real signature in `src/view/openTarget.ts` before writing that call and match it — if it takes a `BacklogItem` rather than a `{ file }`, take the whole item on the remedy instead and adjust `Remedy`'s `open` arm to `{ kind: 'open'; item: BacklogItem }`.

- [ ] **Step 5: Route the two unbound states through it**

In `renderReadiness.ts`, `drawEffortFigures`' `total === null` branch and `drawCapacityFigures`' `capacity.unconfigured` branch call `drawFixNote` instead of `note`, passing `{ kind: 'bind', option: 'estimateProperty' }` and `{ kind: 'bind', option: 'capacityProperty' }`. Both functions need `view` — thread it from `drawReadinessFigures`' caller in `renderScope.ts` (`drawSummary` already holds it).

Leave every other `note(...)` call alone; Tasks 3 and 4 take them.

- [ ] **Step 6: Catalog and styles**

Add to `src/i18n/en.ts`:

```ts
'release.fix.bind': 'Bind this property and try again',
'release.fix.open': 'Open the note holding this value',
'release.fix.edit': 'Set this value',
```

Add to `styles/releaseScope.css` — a fix button looks like the note it replaces, with a pointer and an underline on hover:

```css
.pbl-rel-fix {
	background: none;
	border: none;
	padding: 0;
	font: inherit;
	color: inherit;
	cursor: pointer;
	text-decoration: underline dotted;
}
```

Confirm the partial is still under 400 lines.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 8: Register**

In `docs/requirements/Commitment against declared capacity.md`, add `src/view/release/readinessFix.ts` to `## Where it lives` with one sentence: *the red state's own remedy — a bind, an open, or a dialog its caller owns.*

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: an unbound readiness key binds itself from its own red note"
```

---

### Task 3: A bound but empty capacity opens a number dialog

**Files:**
- Modify: `src/domain/releaseWritePlan.ts`
- Modify: `src/view/release/releaseEdits.ts`
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseWritePlan.test.ts`, `test/view/release/releaseEdits.test.ts`

**Interfaces:**
- Consumes: `drawFixNote` / `Remedy` from Task 2.
- Produces:
  - `ReleaseField` gains `'capacity'`; `ROLE_KEYS` gains `capacity: 'capacityKey'`.
  - `releaseCapacityWrites(file: TFile, key: string, current: number | null, entry: string): ReleaseWrite[]`
  - `editReleaseCapacity(view: ReleaseView, release: ReleaseRow, capacity: number | null): void`
  - `reconfiguredKey(settings: ReleaseSettings, writes: ReleaseWrite[]): string | null` — widened from the three-key object literal to the whole settings bag.

- [ ] **Step 1: Write the failing planner test**

Add to `test/domain/releaseWritePlan.test.ts`:

```ts
describe('releaseCapacityWrites', () => {
    const file = { path: 'R.md' } as TFile;

    it('writes the number the reader typed', () => {
        expect(releaseCapacityWrites(file, 'capacity', null, ' 40 ')).toEqual([
            { file, requiresType: 'Release', sets: [{ key: 'capacity', value: '40', role: 'capacity' }] },
        ]);
    });

    it('plans nothing for the value the note already holds', () => {
        expect(releaseCapacityWrites(file, 'capacity', 40, '40')).toEqual([]);
        // The same number spelled differently is the same number — never a rewrite.
        expect(releaseCapacityWrites(file, 'capacity', 40, '40.0')).toEqual([]);
    });

    it('clears the key on an emptied box', () => {
        expect(releaseCapacityWrites(file, 'capacity', 40, '  ')).toEqual([
            { file, requiresType: 'Release', sets: [{ key: 'capacity', value: null, role: 'capacity' }] },
        ]);
    });

    it('plans nothing when the key is unbound, and nothing for a clear of an absent value', () => {
        expect(releaseCapacityWrites(file, '', null, '40')).toEqual([]);
        expect(releaseCapacityWrites(file, 'capacity', null, '')).toEqual([]);
    });

    it('refuses a value the reader of this figure would not count', () => {
        expect(releaseCapacityWrites(file, 'capacity', null, '40 pts')).toEqual([]);
        expect(releaseCapacityWrites(file, 'capacity', null, '-1')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts`
Expected: FAIL — `releaseCapacityWrites` is not exported.

- [ ] **Step 3: Implement the planner**

In `src/domain/releaseWritePlan.ts`, widen the role union and the key map, then add:

```ts
export type ReleaseField = 'status' | 'description' | 'released' | 'capacity';

const ROLE_KEYS = {
    status: 'statusKey',
    description: 'descriptionKey',
    released: 'releasedDateKey',
    capacity: 'capacityKey',
} as const;

/**
 * What the release declares it can take, typed into the header's own dialog.
 *
 * **Judged by `estimateValue`, the reader that COUNTS it** — the same predicate
 * `capacityFigure` applies (`domain/releaseReadiness.ts`), so a value this dialog accepts
 * is a value the strip beside it will compare. `40 pts` and a negative are refused here
 * because they are refused there: a control that wrote a capacity its own figure then
 * reported as unreadable would be manufacturing the red state it exists to clear.
 *
 * A refusal plans NOTHING rather than throwing — the dialog validates before it submits
 * (`SchedulePromptModal`'s `validate`), so this is the second half of one rule and not a
 * silent swallow.
 *
 * The no-op test is NUMERIC, never textual: `40` and `40.0` are one capacity, and a
 * string comparison would rewrite the note for a spelling nobody sees. Same trade the
 * released date makes by comparing against `formatCivil`.
 */
export function releaseCapacityWrites(
    file: TFile,
    key: string,
    current: number | null,
    entry: string,
): ReleaseWrite[] {
    const trimmed = entry.trim();
    if (trimmed === '') return current === null ? [] : fieldWrite(file, 'capacity', key, null);
    const value = estimateValue(trimmed);
    if (value === null) return [];
    if (current !== null && current === value) return [];
    return fieldWrite(file, 'capacity', key, trimmed);
}
```

Import `estimateValue` from `./releaseReadiness`. Check that import direction does not create a cycle (`npm run analyze` is what refuses one) — if it does, move `estimateValue` and `finiteFrom` into `domain/noteFields.ts` and re-export from `releaseReadiness.ts` so both modules read one predicate.

Widen `reconfiguredKey`'s parameter to `settings: ReleaseSettings` and leave its body as is.

- [ ] **Step 4: Run the planner test**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing dialog test**

Add to `test/view/release/releaseEdits.test.ts`, modelled on the existing released-date block in that file (read it first — it drives `SchedulePromptModal` through `submitPrompt`):

```ts
it('writes the capacity typed into the header dialog', async () => {
    const { view, vault } = releaseScreen({ capacity: undefined });
    button(view, '.pbl-rel-capacity-fix').click();
    await flush();
    submitPrompt({ capacity: '40' });
    await flush();

    expect(vault.frontmatter('0.9.md').capacity).toBe('40');
});
```

Match the real helper names in that file — `submitPrompt`'s shape depends on which modal is open, and a `ValuePromptModal` submits a single string.

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run test/view/release/releaseEdits.test.ts`
Expected: FAIL — no `.pbl-rel-capacity-fix` control.

- [ ] **Step 7: Implement the dialog and wire it**

In `releaseEdits.ts`, beside the other three editors:

```ts
const CAPACITY_FIX = '.pbl-rel-capacity-fix';

/**
 * The capacity a release declares, typed straight into the figure that reports it missing.
 *
 * The fourth field this view edits on the release note, and it joins the other three here
 * rather than beside the figure that opens it — `releaseEdits.ts`'s own rule.
 *
 * Prefilled with what the note STATES and never with a guess: a dialog that opened holding
 * a number the note does not have would write one on a confirm nobody meant as an entry.
 * An UNREADABLE capacity reaches this as `null` and is offered no dialog at all
 * (`renderReadiness.ts`), the released date's own refusal and for its reason.
 */
export function editReleaseCapacity(view: ReleaseView, release: ReleaseRow, capacity: number | null): void {
    const key = view.settings.capacityKey;
    new ValuePromptModal(view.app, {
        title: t('release.scope.capacityTitle', { name: release.name }),
        fieldName: key,
        placeholder: t('release.scope.capacityPlaceholder'),
        ctaLabel: t('release.scope.capacitySave'),
        known: [],
        onClosed: () => focusControl(view, CAPACITY_FIX),
        onSubmit: (value) =>
            void save(view, releaseCapacityWrites(release.item.file, key, capacity, value), CAPACITY_FIX),
    }).open();
}
```

`ValuePromptModal` refuses a blank entry, so *clearing* a capacity is not reachable from this dialog — that is acceptable and must be stated in the docblock: the field is cleared by editing the note, which the unreadable state's own Open remedy reaches. If clearing turns out to be wanted, `SchedulePromptModal`'s pattern (a field that submits `''`) is the upgrade path.

In `renderReadiness.ts`, `drawCapacityFigures`' `capacity.value === null` branch draws `drawFixNote(view, sumEl, t('release.scope.capacityAbsent'), { kind: 'run', run: () => editReleaseCapacity(view, release, null) })` and gives the button the extra class `pbl-rel-capacity-fix`. Add a `cls` field to `Remedy`'s call site rather than hard-coding it inside `drawFixNote`: give `drawFixNote` an optional fifth parameter `extraCls?: string`.

The `capacity.invalid` branch keeps its plain sentence and gains an `open` remedy pointing at `release.item.file`.

- [ ] **Step 8: Catalog**

```ts
'release.scope.capacityTitle': 'Capacity for {name}',
'release.scope.capacityPlaceholder': 'A number, in the unit this view is configured with',
'release.scope.capacitySave': 'Set capacity',
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts test/view/release/`
Expected: PASS.

- [ ] **Step 10: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: a missing capacity is typed into the figure that reports it"
```

---

### Task 4: The unit and the risk vocabularies get their own dialogs

**Files:**
- Modify: `src/view/release/readinessFix.ts`
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/view/release/readinessFix.test.ts`

**Interfaces:**
- Consumes: `drawFixNote` / `Remedy` (Task 2), `ReleaseView.config.set` (Obsidian's `BasesViewConfig`).
- Produces: `editCapacityUnit(view: ReleaseView): void` and `editRiskValues(view: ReleaseView): void`, both writing the `.base` and re-rendering.

- [ ] **Step 1: Read how a `.base` value is written**

Read `runReleaseInit`'s value sweep in `src/view/release/init.ts` — `RELEASE_SUGGESTED_VALUES` and `wouldBindValue` show the exact `view.config.set(option, value)` call and whether it must be awaited. Copy that call, do not invent one.

- [ ] **Step 2: Write the failing test**

Add to `test/view/release/readinessFix.test.ts`:

```ts
describe('the capacity unit', () => {
    it('is typed into the note that says it is unset', async () => {
        const config: Record<string, unknown> = { ...RELEASE_CONFIG, capacityUnit: '' };
        const { view } = releaseScreen({ capacity: 40 }, scopeVault(), config);
        button(view, '.pbl-rel-unit-fix').click();
        await flush();
        submitPrompt('story points');
        await flush();

        expect(view.config.get('capacityUnit')).toBe('story points');
    });
});

describe('the risk vocabularies', () => {
    it('are written together, or not at all', async () => {
        const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
        const { view } = releaseScreen({}, scopeVault(), config);
        button(view, '.pbl-rel-riskvalues-fix').click();
        await flush();
        submitPrompt({ critical: 'High, Critical', addressed: 'Mitigated' });
        await flush();

        expect(view.config.get('criticalRiskValues')).toBe('High, Critical');
        expect(view.config.get('addressedRiskValues')).toBe('Mitigated');
    });
});
```

`submitPrompt`'s shape follows the modal each dialog opens: a `ValuePromptModal` for the unit (one string), and for the two lists a two-field dialog. Read `src/ui/prompts.ts` and pick the modal that already takes two text fields; if none does, use two sequential `ValuePromptModal`s is **not** acceptable — the spec requires one press writing both or neither, so add a two-field option to the existing `IterationPromptModal` pattern or write the dialog with `openTextPrompt`'s mechanism. Decide, then make the test match the decision.

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/view/release/readinessFix.test.ts`
Expected: FAIL — neither control exists.

- [ ] **Step 4: Implement both dialogs in `readinessFix.ts`**

Each writes its options and then calls `view.render()`, because a `.base` write raises no data update of its own. The risk dialog writes both keys before the single render, so a half-configured vocabulary is never drawn.

Prefill the unit dialog with `view.settings.capacityUnit`. Prefill the risk dialog's two fields with the current lists, and put the members' own observed risk values in the placeholder where the base returned any — read them off the model rather than re-walking the vault.

- [ ] **Step 5: Wire the three remaining red states**

In `renderReadiness.ts`:
- `release.scope.capacityNoUnit` → `{ kind: 'run', run: () => editCapacityUnit(view) }`, class `pbl-rel-unit-fix`.
- the risk criterion's `unconfigured` chip → its own fix button beside the chip row, class `pbl-rel-riskvalues-fix`, drawn only when `riskKey` is bound and one of the two lists is empty (with the key unbound, Task 2's bind button is the right remedy and this one would be a second answer).
- `release.scope.effortUnreadable` and `release.scope.capacityUnreadable` → `{ kind: 'open', file: release.item.file }` for the capacity; the effort one is a sum over MEMBERS and names no single note, so it keeps its plain sentence and no remedy.

- [ ] **Step 6: Catalog**

```ts
'release.scope.unitTitle': 'Unit for capacity and effort',
'release.scope.unitPlaceholder': 'points',
'release.scope.unitSave': 'Set unit',
'release.scope.riskValuesTitle': 'Which risk values matter',
'release.scope.riskValuesCritical': 'Critical values',
'release.scope.riskValuesAddressed': 'Addressed values',
'release.scope.riskValuesHint': 'Comma-separated. The criterion needs both.',
'release.scope.riskValuesSave': 'Set risk values',
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 8: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: the unit and the risk vocabularies are set from their own red notes"
```

---

### Task 5: The capacity comparison becomes a bar

**Files:**
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `styles/releaseScope.css`
- Test: `test/view/release/releaseHeader.test.ts`

**Interfaces:**
- Consumes: nothing new. Produces: nothing other modules read — presentation only.

- [ ] **Step 1: Write the failing test**

Add to `test/view/release/releaseHeader.test.ts`:

```ts
describe('the capacity comparison', () => {
    it('draws a bar filled to the committed share, and the numbers beside it', () => {
        // scopeVault()'s members carry `effort` summing to 15; a capacity of 20 is 75%.
        const { view } = releaseScreen({ capacity: 20 });
        const fill = view.viewEl.querySelector<HTMLElement>('.pbl-rel-cap-fill')!;

        expect(fill.style.getPropertyValue('--pbl-rel-cap')).toBe('75%');
        expect(view.viewEl.textContent).toContain('15 of 20 pts committed');
        expect(view.viewEl.textContent).toContain('5 left');
    });

    it('clamps the fill at 100% and marks the bar over capacity', () => {
        const { view } = releaseScreen({ capacity: 10 });
        const barEl = view.viewEl.querySelector<HTMLElement>('.pbl-rel-cap')!;

        expect(barEl.classList.contains('pbl-rel-cap-over')).toBe(true);
        expect(barEl.querySelector<HTMLElement>('.pbl-rel-cap-fill')!.style.getPropertyValue('--pbl-rel-cap')).toBe('100%');
        expect(view.viewEl.textContent).toContain('5 over');
    });
});
```

Read `scopeVault()` in `test/helpers/release.ts` first and use its real effort values — if its members carry no `effort`, add it there, and check no existing assertion counts on their absence.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/release/releaseHeader.test.ts`
Expected: FAIL — no `.pbl-rel-cap` element; the figure is a text span.

- [ ] **Step 3: Implement**

In `drawCapacityFigures`, replace the two final `figure(...)` calls (`capacityOver` / `capacityUnder`) with one bar plus one sentence:

```ts
// **The bar is the comparison; the sentence is the numbers.** Eight sibling spans of
// jargon is what this replaced, and the reason is that a ratio is the one thing a reader
// takes in without reading — the summary strip's own progress bar, one line up, making
// the identical trade.
//
// **The arithmetic does not move.** `over` is still `exactDifference` over the exact
// commitment, `pct` is still divided before it is multiplied, and both were decided
// above: this branch draws them and derives nothing.
const barEl = sumEl.createDiv({ cls: 'pbl-rel-cap' + (over > 0 ? ' pbl-rel-cap-over' : '') });
// CLAMPED, because a bar wider than its track is a layout bug rather than a reading: past
// 100% the number beside it is what says how far over, and the class is what says that at
// a glance.
barEl.createDiv({ cls: 'pbl-rel-cap-fill' }).setCssProps({ '--pbl-rel-cap': `${Math.min(100, pct)}%` });
figure(
    sumEl,
    over >= 0
        ? t('release.scope.capacityOver', { /* the existing parameters, unchanged */ })
        : t('release.scope.capacityUnder', { /* the existing parameters, unchanged */ }),
);
```

Keep both catalog sentences as they are unless they read badly beside a bar; if they do, change the ENGLISH only and leave the parameters alone, so no caller and no other catalog changes.

The three states with no two numbers to compare (`capacityNoPct` for a zero capacity, the overflowed ratio, `capacityAlone`, `committed`) keep their text exactly as they are — a bar needs both numbers.

- [ ] **Step 4: Styles**

Add to `styles/releaseScope.css`, modelled on `.pbl-rel-bar`/`.pbl-rel-bar-fill` already in that file:

```css
.pbl-rel-cap {
	flex: 0 0 auto;
	width: 80px;
	height: 4px;
	border-radius: 2px;
	background: var(--background-modifier-border);
	overflow: hidden;
}

.pbl-rel-cap-fill {
	width: var(--pbl-rel-cap, 0%);
	height: 100%;
	background: var(--interactive-accent);
}

.pbl-rel-cap-over .pbl-rel-cap-fill {
	background: var(--text-error);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 6: Look at it**

Run: `npm run harness`
Open the release scope screen and check the bar sits on the strip's baseline beside the progress bar and does not wrap the row. This is a real check, not a formality — the harness is the only thing here that draws against the stylesheet.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: the capacity comparison is a bar, not a sentence of jargon"
```

---

### Task 6: Planners for a member's effort and risk

**Files:**
- Modify: `src/domain/releaseWritePlan.ts`
- Test: `test/domain/releaseWritePlan.test.ts`

**Interfaces:**
- Produces:
  - `ReleaseField` gains `'effort' | 'risk'`; `ROLE_KEYS` gains `effort: 'estimateKey'`, `risk: 'riskKey'`.
  - `memberEffortWrites(file: TFile, key: string, current: unknown, entry: string): ReleaseWrite[]`
  - `memberRiskWrites(file: TFile, key: string, current: string | null, pick: string | null): ReleaseWrite[]`
  - Neither carries `requiresType`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('memberEffortWrites', () => {
    const file = { path: 'M1.md' } as TFile;

    it('writes the number, refuses what the criterion would not count, and clears on empty', () => {
        expect(memberEffortWrites(file, 'effort', null, '5')).toEqual([
            { file, sets: [{ key: 'effort', value: '5', role: 'effort' }] },
        ]);
        expect(memberEffortWrites(file, 'effort', null, '5 pts')).toEqual([]);
        expect(memberEffortWrites(file, 'effort', null, '-2')).toEqual([]);
        expect(memberEffortWrites(file, 'effort', 5, '  ')).toEqual([
            { file, sets: [{ key: 'effort', value: null, role: 'effort' }] },
        ]);
    });

    it('plans nothing for the value already held, however it is spelled', () => {
        expect(memberEffortWrites(file, 'effort', 5, '5')).toEqual([]);
        expect(memberEffortWrites(file, 'effort', '5', '5.0')).toEqual([]);
    });

    it('never writes an unconfigured key', () => {
        expect(memberEffortWrites(file, '', null, '5')).toEqual([]);
    });

    it('carries no type requirement — a member is work, not a release', () => {
        expect(memberEffortWrites(file, 'effort', null, '5')[0].requiresType).toBeUndefined();
    });
});

describe('memberRiskWrites', () => {
    const file = { path: 'M1.md' } as TFile;

    it('writes the pick, clears on null, and plans nothing for a re-pick', () => {
        expect(memberRiskWrites(file, 'risk', null, 'High')).toEqual([
            { file, sets: [{ key: 'risk', value: 'High', role: 'risk' }] },
        ]);
        expect(memberRiskWrites(file, 'risk', 'High', null)).toEqual([
            { file, sets: [{ key: 'risk', value: null, role: 'risk' }] },
        ]);
        // Case-insensitively — every other pick in this plugin keeps that rule.
        expect(memberRiskWrites(file, 'risk', 'High', 'high')).toEqual([]);
        expect(memberRiskWrites(file, 'risk', null, null)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts`
Expected: FAIL — neither planner is exported.

- [ ] **Step 3: Implement**

```ts
/**
 * A member's effort, planned from the release screen — the first write this view makes to
 * a note that is not the release it is showing.
 *
 * **No `requiresType`.** The three release planners above pin `RELEASE_TYPE` because their
 * note is a release and a retype between the menu and the pick is a window nothing
 * upstream can see. A member is ordinary work of any type on either ladder, so there is no
 * one name to pin — and the gate's own refusal is what stands here instead: a batch naming
 * a note the base did not return is refused whole, which is the guarantee that actually
 * matters for a row drawn from the base's own results.
 *
 * `current` is the RAW frontmatter value, because that is what the row carries and what
 * the criterion beside it reads. Judged by `estimateValue` for {@link
 * releaseCapacityWrites}' own reason: a value this control accepts must be a value the
 * figure beside it will sum, or the chip would manufacture the red state it exists to
 * clear.
 */
export function memberEffortWrites(file: TFile, key: string, current: unknown, entry: string): ReleaseWrite[] {
    const trimmed = entry.trim();
    const held = estimateValue(current);
    if (trimmed === '') return held === null ? [] : memberWrite(file, 'effort', key, null);
    const value = estimateValue(trimmed);
    if (value === null) return [];
    if (held !== null && held === value) return [];
    return memberWrite(file, 'effort', key, trimmed);
}

/**
 * A member's risk level: the picked value, or null to take the key off.
 *
 * `sameValue` for the no-op, case-insensitively — the rule every pick in this plugin
 * keeps, and the reason the menu's checkmark asks this planner rather than comparing
 * beside it.
 */
export function memberRiskWrites(file: TFile, key: string, current: string | null, pick: string | null): ReleaseWrite[] {
    if (pick === null && current === null) return [];
    if (pick !== null && current !== null && sameValue(current, pick)) return [];
    return memberWrite(file, 'risk', key, pick);
}

/** {@link fieldWrite} without the release's type pin — see {@link memberEffortWrites}. */
function memberWrite(file: TFile, role: ReleaseField, key: string, value: string | null): ReleaseWrite[] {
    return key === '' ? [] : [{ file, sets: [{ key, value, role }] }];
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: planners for a member's effort and risk"
```

---

### Task 7: Effort and risk chips on member rows

**Files:**
- Create: `src/view/release/scopeChips.ts`
- Modify: `src/view/release/scopeTree.ts`
- Modify: `src/i18n/en.ts`
- Modify: `styles/releaseScope.css`
- Modify: `docs/requirements/Release readiness.md` (`## Where it lives`)
- Test: `test/view/release/scopeChips.test.ts`

**Interfaces:**
- Consumes: `ScopeRow` (`domain/scopeRows.ts`), `ReleaseSettings`.
- Produces: `drawReadinessChips(rowEl: HTMLElement, row: ScopeRow, settings: ReleaseSettings, riskChoices: string[]): void` — draws `.pbl-rel-effortcol` and `.pbl-rel-riskcol` cells, each holding a `<button class="pbl-state-chip" tabindex="-1">` where the field is offerable.

This task DRAWS and wires nothing. Task 8 makes the chips act.

- [ ] **Step 1: Read the chip this follows**

Read `drawScopeStateChip` in `src/view/scopeRow.ts` and `drawRow` in `src/view/release/scopeTree.ts`. The new chips are drawn in the same trailing strip, after the state chip and before the rollup.

- [ ] **Step 2: Write the failing test**

Create `test/view/release/scopeChips.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen, row, scopeVault } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

describe('the readiness chips', () => {
    it('draws a value chip on an estimated member and a dashed one on an unestimated member', () => {
        const { view } = releaseScreen({});
        // Read `scopeVault()` and name a member that carries `effort` and one that does not.
        const estimated = row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!;
        const unestimated = row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!;

        expect(estimated.textContent).toContain('5');
        expect(unestimated.classList.contains('pbl-state-unset')).toBe(true);
        expect(unestimated.textContent).toContain('Effort');
    });

    it('draws neither chip on a context row', () => {
        const { view } = releaseScreen({});
        // A context ancestor — read `scopeVault()` for the path that is drawn but not a member.
        const context = row(view, 'E.md');

        expect(context.querySelector('.pbl-rel-effortcol .pbl-state-chip')).toBeNull();
        expect(context.querySelector('.pbl-rel-riskcol .pbl-state-chip')).toBeNull();
        // The CELLS are still there, or the columns after them would shift per row.
        expect(context.querySelector('.pbl-rel-effortcol')).not.toBeNull();
    });

    it('draws no risk chip where there is no value to offer', () => {
        const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
        // A vault whose members carry no risk value either: nothing declared, nothing observed.
        const { view } = releaseScreen({}, scopeVault(), config);

        expect(row(view, 'M1.md').querySelector('.pbl-rel-riskcol .pbl-state-chip')).toBeNull();
    });

    it('draws every chip as a tabindex -1 button — the tree is one tab stop', () => {
        const { view } = releaseScreen({});
        for (const chip of view.viewEl.querySelectorAll<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')) {
            expect(chip.tagName).toBe('BUTTON');
            expect(chip.getAttribute('tabindex')).toBe('-1');
        }
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/view/release/scopeChips.test.ts`
Expected: FAIL — no `.pbl-rel-effortcol` cell exists.

- [ ] **Step 4: Write `scopeChips.ts`**

```ts
import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { ownValue, readString } from '../../domain/noteFields';
import { estimateValue } from '../../domain/releaseReadiness';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { ScopeRow } from '../../domain/scopeRows';

/**
 * The two values a member can be given from the release screen — its effort and its risk —
 * drawn as the tree's own chip and, in Task 8, opening the same writes the row menu does.
 *
 * **A CONTEXT row draws the cells and neither chip.** An excluded ancestor is scaffolding:
 * it is in no denominator and is never a write target, so a control on it would offer a
 * write the gate refuses whole. The empty cell stays, because every column a row can draw
 * is drawn on every row or the columns after it shift per row (`src/view/CLAUDE.md`).
 *
 * **An unset value draws a DASHED chip rather than nothing**, which is the tree's own rule
 * for risk and priority: absence here is an invitation, not a placement something else
 * already names.
 */
export function drawReadinessChips(rowEl: HTMLElement, row: ScopeRow, settings: ReleaseSettings, riskChoices: string[]): void {
    drawChip(rowEl, 'pbl-rel-effortcol', {
        offered: !row.context && settings.estimateKey !== '',
        value: effortText(row, settings),
        label: t('release.scope.effortLabel'),
        field: 'effort',
    });
    drawChip(rowEl, 'pbl-rel-riskcol', {
        offered: !row.context && settings.riskKey !== '' && riskChoices.length > 0,
        value: riskText(row, settings),
        label: t('release.scope.riskLabel'),
        field: 'risk',
    });
}

interface ChipSpec {
    offered: boolean;
    value: string | null;
    label: string;
    field: 'effort' | 'risk';
}

function drawChip(rowEl: HTMLElement, columnClass: string, spec: ChipSpec): void {
    const cellEl = rowEl.createDiv({ cls: columnClass });
    if (!spec.offered) return;
    const chipEl = cellEl.createEl('button', {
        cls: 'pbl-state-chip' + (spec.value === null ? ' pbl-state-unset' : ''),
        // `tabindex="-1"`: the tree is ONE tab stop and the row menu is this chip's
        // keyboard path (`src/view/CLAUDE.md`, Controls).
        attr: { type: 'button', tabindex: '-1', 'aria-label': chipName(spec) },
    });
    chipEl.dataset.field = spec.field;
    chipEl.createSpan({ cls: 'pbl-state-text', text: spec.value ?? spec.label });
    setTooltip(chipEl, chipName(spec));
    // AFTER the tooltip: Obsidian's `setTooltip` is reported to implement its tooltip
    // through `aria-label`, which would take the name above back off. `renderScope.ts`'s
    // `drawStatus` states this and its evidence.
    chipEl.setAttribute('aria-label', chipName(spec));
}

/** The action and the value it holds — the tree's own two chip names, both halves DATA. */
function chipName(spec: ChipSpec): string {
    return spec.value === null ? t('chip.set', { label: spec.label }) : t('chip.change', { label: spec.label, value: spec.value });
}

function effortText(row: ScopeRow, settings: ReleaseSettings): string | null {
    const raw: unknown = ownValue(row.item.frontmatter, settings.estimateKey);
    const value = estimateValue(raw);
    return value === null ? null : String(value);
}

function riskText(row: ScopeRow, settings: ReleaseSettings): string | null {
    return readString(ownValue(row.item.frontmatter, settings.riskKey));
}
```

`row.item.frontmatter` may not exist on `BacklogItem` — check the type. If it does not, take the `App` as a parameter and read through `app.metadataCache.getFileCache(row.item.file)?.frontmatter`, exactly as `releaseReadiness.ts`'s `estimateOf` does, and thread `view.app` from the caller.

- [ ] **Step 5: Draw them from the tree**

In `scopeTree.ts`'s `drawRow`, after `drawScopeStateChip(...)` and before `drawRollup(...)`:

```ts
drawReadinessChips(rowEl, row, view.settings, riskChoices);
```

`riskChoices` is computed once per draw in `drawScopeTree` (never per row) as the union of `settings.criticalRiskValues`, `settings.addressedRiskValues` and the values the member rows themselves carry. Pass it down through `RowPlace` if `drawRow` is at its five-parameter budget — read the `max-params` note in that file's own comment before adding an argument.

- [ ] **Step 6: Catalog and styles**

```ts
'release.scope.effortLabel': 'Effort',
'release.scope.riskLabel': 'Risk',
```

Styles: give `.pbl-rel-effortcol` and `.pbl-rel-riskcol` a fixed width each (the strip is columnar and must line up down the tree), and reuse the dashed treatment `.pbl-state-unset` already carries.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/release/`
Expected: PASS. Existing row tests (`rowChrome.test.ts`, `scopeTree.test.ts`) may assert a row's child count or its trailing element — fix them to the new truth rather than reshaping the row around them.

- [ ] **Step 8: Register**

Add `src/view/release/scopeChips.ts` to `## Where it lives` in `docs/requirements/Release readiness.md`.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: effort and risk chips on a release's member rows"
```

---

### Task 8: The chips write, and the row menu is their keyboard path

**Files:**
- Modify: `src/view/release/scopeChips.ts`
- Modify: `src/view/release/scopeCreate.ts`
- Modify: `src/view/release/renderScope.ts`
- Modify: `src/view/release/releaseView.ts` (docblock only)
- Modify: `src/i18n/en.ts`
- Modify: `test/view/releaseNeverEdits.test.ts` (the claim's docblock)
- Modify: `docs/requirements/Answering the readiness checklist.md`
- Modify: `CHANGELOG.md`
- Test: `test/view/release/scopeChips.test.ts`

**Interfaces:**
- Consumes: `memberEffortWrites` / `memberRiskWrites` (Task 6), `drawReadinessChips` (Task 7), `ReleaseView.applyRelease`.
- Produces:
  - `wireReadinessChips(view: ReleaseView, draw: TreeDraw, settings: ReleaseSettings, riskChoices: string[]): void` — one delegated listener on `treeEl`, resolving the row by `data-path`.
  - `addReadinessItems(view: ReleaseView, menu: Menu, row: ScopeRow, riskChoices: string[]): boolean` — appends `Set effort` and `Set risk`; returns whether it added anything.
  - `editMemberEffort(view, row): void` and `showMemberRiskMenu(view, evt|el, row, riskChoices): void` — the ONE method per field both inputs call.

- [ ] **Step 1: Write the failing tests**

```ts
describe('setting a member’s effort', () => {
    it('writes what the chip’s dialog was given', async () => {
        const { view, vault } = releaseScreen({});
        row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!.click();
        await flush();
        submitPrompt('8');
        await flush();

        expect(vault.frontmatter('M2.md').effort).toBe('8');
    });

    it('is reachable from the row menu too, through the same method', async () => {
        const { view, vault } = releaseScreen({});
        openRowMenu(view, 'M2.md');
        pickMenuItem('Set effort');
        await flush();
        submitPrompt('8');
        await flush();

        expect(vault.frontmatter('M2.md').effort).toBe('8');
    });
});

describe('setting a member’s risk', () => {
    it('checks the entry that would write nothing', async () => {
        const { view } = releaseScreen({});
        row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();
        await flush();
        // `M1.md` carries `risk: High` — read `scopeVault()` and match it.
        expect(checkedMenuTitles()).toEqual(['High']);
    });

    it('offers no clear on a member carrying nothing', async () => {
        const { view } = releaseScreen({});
        row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();
        await flush();

        expect(menuTitles()).not.toContain('Clear risk');
    });
});

describe('a context row', () => {
    it('has no readiness entries in its menu', () => {
        const { view } = releaseScreen({});
        openRowMenu(view, 'E.md');

        expect(menuTitles()).not.toContain('Set effort');
        expect(menuTitles()).not.toContain('Set risk');
    });
});
```

`openRowMenu`, `pickMenuItem`, `menuTitles` and `checkedMenuTitles` are the helper shapes `test/view/release/scopeCreate.test.ts` already uses against `helpers/obsidian-mock`'s `Menu` — read that file and use its real names rather than these.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/release/scopeChips.test.ts`
Expected: FAIL — clicking a chip does nothing.

- [ ] **Step 3: Implement the two write paths**

In `scopeChips.ts`:

```ts
/**
 * **One method per field, two inputs each** — the chip and the row menu — which is the root
 * guide's "one move, N inputs" for this screen. The menu entry is not garnish: the chip is
 * `tabindex="-1"` and the tree is one tab stop, so without it the two fields would be
 * pointer-only.
 *
 * The KEY is captured here, with the value it belongs to, and never read again at submit
 * (the root guide's capture-before-the-await). `applyRelease` re-asks `reconfiguredKey`
 * against the settings as they are at apply time, so a `.base` re-pointed while the dialog
 * is open refuses the write rather than landing it on another property.
 */
export function editMemberEffort(view: ReleaseView, row: ScopeRow): void {
    const key = view.settings.estimateKey;
    const current: unknown = ownValue(view.app.metadataCache.getFileCache(row.item.file)?.frontmatter, key);
    new ValuePromptModal(view.app, {
        title: t('release.scope.effortTitle', { name: row.item.title }),
        fieldName: key,
        placeholder: t('release.scope.effortPlaceholder'),
        ctaLabel: t('release.scope.effortSave'),
        known: [],
        onClosed: () => focusChip(view, row, 'effort'),
        onSubmit: (value) => void applyAndRefocus(view, memberEffortWrites(row.item.file, key, current, value), row, 'effort'),
    }).open();
}
```

`showMemberRiskMenu` builds an entry per choice with `setChecked(memberRiskWrites(...).length === 0)` — the checkmark asked of the plan — plus a Clear foot offered only where the note carries a readable value.

`focusChip` looks the chip up FRESH after the await by `[data-path="…"] .pbl-rel-effortcol .pbl-state-chip`, never captured: the write's redraw replaces the element. `releaseEdits.ts`'s `focusControl` is the shape to follow.

- [ ] **Step 4: Wire both inputs**

`wireReadinessChips` adds one delegated `click` listener on `treeEl` — never per row (`src/view/CLAUDE.md`: no per-row control's listener closes over its item) — resolving `evt.target.closest('.pbl-state-chip')`, reading its `dataset.field`, and finding the row by the enclosing `.pbl-row`'s `data-path`. It must not also open the note: `scopeTree.ts`'s `wireRowOpen` is on the same element, so follow `fromRowControl`'s pattern and let the row's own handler ignore an event that began on a control.

Call it from `renderScope.ts` as a fourth wiring step beside `wireScopeKeys` and `wireScopeCreate`.

In `scopeCreate.ts`, `scopeMenu` calls `addReadinessItems` after its type entries, and returns the menu when EITHER half added something — today it returns null for a catalog row, and a catalog row is never a member, so the readiness half adds nothing there and the existing null stands.

- [ ] **Step 5: Narrow the stated boundary**

- `test/view/releaseNeverEdits.test.ts`: rewrite the header docblock to the new claim — *this view creates notes and its own config, edits the release note it is showing, edits a member's effort and risk, and writes nothing else*. The assertions themselves stay: the gesture script still presses none of the new controls.
- `releaseView.ts`'s `applyRelease` docblock: widen "an edit to the release note" to "an edit this view makes".
- `docs/requirements/Answering the readiness checklist.md`: the guarantee that EVALUATING writes nothing still holds; add a sentence saying the chips are no longer read-only and name what they write.
- `CHANGELOG.md` `[Unreleased]`: one line.

- [ ] **Step 6: Catalog**

```ts
'release.scope.effortTitle': 'Effort for {name}',
'release.scope.effortPlaceholder': 'A number',
'release.scope.effortSave': 'Set effort',
'release.scope.setEffort': 'Set effort',
'release.scope.setRisk': 'Set risk',
'release.scope.clearRisk': 'Clear risk',
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/release/ test/view/releaseNeverEdits.test.ts`
Expected: PASS.

- [ ] **Step 8: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: set a member's effort and risk from the release screen"
```

---

### Task 9: The criteria know which members fail them

**Files:**
- Modify: `src/domain/releaseReadiness.ts`
- Test: `test/domain/releaseReadiness.test.ts`

**Interfaces:**
- Produces: `ReleaseCriterion.outstandingPaths: string[] | null` — null exactly where `outstanding` is null; `outstandingPaths.length === outstanding` for every configured criterion; never holds a context row's path.

- [ ] **Step 1: Write the failing test**

```ts
it('names the members behind every outstanding count', () => {
    const readiness = /* the fixture this file already builds */;
    for (const criterion of readiness.criteria) {
        if (criterion.outstanding === null) {
            expect(criterion.outstandingPaths).toBeNull();
            continue;
        }
        expect(criterion.outstandingPaths).not.toBeNull();
        // The list IS the count — one walk, one predicate, no second opinion.
        expect(criterion.outstandingPaths!.length).toBe(criterion.outstanding);
    }
});

it('never names a context row', () => {
    // Build a scope with a context ancestor carrying no estimate, and assert its path is
    // in no criterion's list — a context row is in no denominator and no numerator.
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/releaseReadiness.test.ts`
Expected: FAIL — `outstandingPaths` does not exist.

- [ ] **Step 3: Implement**

Add the field to `ReleaseCriterion` with a docblock stating the rule:

```ts
/**
 * The members behind {@link outstanding} — their paths, so a renderer can narrow to them.
 *
 * **Filled in the SAME loop, by the SAME predicate, that produced the count.** A second
 * pass asking which members fail is exactly the drift this module exists to prevent: a
 * chip reading `3 of 8 outstanding` that narrowed to two rows is worse than one that
 * narrowed to none. `outstandingPaths.length === outstanding` is therefore true by
 * construction, and `test/domain/releaseReadiness.test.ts` asserts it of every criterion
 * on every fixture rather than of one.
 *
 * Null exactly where {@link outstanding} is — an unconfigured criterion has no members to
 * name — so a reader that narrowed one has narrowed both.
 */
outstandingPaths: string[] | null;
```

In `estimateCriterion`, `blockedCriterion` and `riskCriterion`, collect `item.file.path` at each `outstanding += 1` (the estimate criterion currently counts by subtraction — change it to a loop so the list and the count come from one pass). `unconfiguredCriterion` returns `outstandingPaths: null`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: a readiness criterion names the members behind its count"
```

---

### Task 10: `rowsForPaths` narrows a scope tree

**Files:**
- Modify: `src/domain/scopeRows.ts`
- Test: `test/domain/scopeRows.test.ts`

**Interfaces:**
- Produces: `rowsForPaths(rows: ScopeRow[], paths: ReadonlySet<string>): ScopeRow[]` — the named rows plus every ancestor holding one in place, in the input's order, with the ancestors' `depth` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
describe('rowsForPaths', () => {
    it('keeps a named row and the ancestors above it', () => {
        // rows: E (depth 0) > F (depth 1) > P1 (depth 2), P2 (depth 2)
        const kept = rowsForPaths(rows, new Set(['P1.md']));
        expect(kept.map((r) => r.item.file.path)).toEqual(['E.md', 'F.md', 'P1.md']);
    });

    it('drops a subtree naming nothing', () => {
        const kept = rowsForPaths(rows, new Set(['P1.md']));
        expect(kept.some((r) => r.item.file.path === 'P2.md')).toBe(false);
    });

    it('answers empty for a path the rows do not hold', () => {
        expect(rowsForPaths(rows, new Set(['gone.md']))).toEqual([]);
    });

    it('keeps depth exactly as it was — the tree closes up around nothing', () => {
        const kept = rowsForPaths(rows, new Set(['P1.md']));
        expect(kept.map((r) => r.depth)).toEqual([0, 1, 2]);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/scopeRows.test.ts`
Expected: FAIL — `rowsForPaths` is not exported.

- [ ] **Step 3: Implement**

```ts
/**
 * The named rows, and every ancestor that holds one in place.
 *
 * One pass over a DEPTH-ORDERED list, carrying the ancestor chain of the row in hand —
 * `doubleCountFigure`'s own walk shape (`domain/releaseReadiness.ts`), and legitimate for
 * the same reason: `rows` arrives depth-ordered from `scopeRows`, so an ancestor is open
 * exactly while rows deeper than it keep arriving.
 *
 * **Depth is not recomputed.** A narrowed tree draws the same indentation the whole one
 * did, because the rows kept are the same rows: re-rooting them would move a member
 * sideways as a side effect of a filter, and the reader is looking for the row they were
 * just looking at.
 */
export function rowsForPaths(rows: ScopeRow[], paths: ReadonlySet<string>): ScopeRow[] {
    const kept: ScopeRow[] = [];
    // The chain of rows above the one in hand, deepest last.
    const open: ScopeRow[] = [];
    for (const row of rows) {
        while (open.length > 0 && open[open.length - 1].depth >= row.depth) open.pop();
        if (paths.has(row.item.file.path)) {
            // Every open ancestor not yet kept — never only the nearest, or a named row two
            // levels down would be drawn with a hole above it.
            for (const ancestor of open) if (!kept.includes(ancestor)) kept.push(ancestor);
            kept.push(row);
        }
        open.push(row);
    }
    return kept;
}
```

`kept.includes` is O(n²) in the kept set. Leave it: a scope tree is a few hundred rows and this runs once per render. If a vault ever makes it matter, carry a `Set` of kept paths beside the array — but do not write that now.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/scopeRows.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: rowsForPaths narrows a scope tree to named rows and their ancestors"
```

---

### Task 11: The chips drill down

**Files:**
- Modify: `src/view/release/releaseView.ts`
- Modify: `src/view/release/renderReadiness.ts`
- Modify: `src/view/release/renderScope.ts`
- Modify: `src/view/release/scopeToolbar.ts`
- Modify: `src/i18n/en.ts`
- Modify: `styles/releaseScope.css`
- Modify: `docs/requirements/Answering the readiness checklist.md`
- Test: `test/view/release/readinessFilter.test.ts`

**Interfaces:**
- Consumes: `outstandingPaths` (Task 9), `rowsForPaths` (Task 10).
- Produces: `ReleaseView.criterionFilter: ReleaseCriterion['key'] | null` and `setCriterionFilter(key: ReleaseCriterion['key'] | null): void` (assigns and re-renders — the pick sets no config and no Bases refresh is coming, `setProjection`'s own rule).

- [ ] **Step 1: Write the failing test**

Create `test/view/release/readinessFilter.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen, row } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

const chip = (view: ReleaseView, key: string) =>
    view.viewEl.querySelector<HTMLButtonElement>(`.pbl-rel-crit[data-criterion="${key}"]`)!;

describe('drilling into a criterion', () => {
    it('narrows the tree to the failing rows and their ancestors', () => {
        const { view } = releaseScreen({});
        chip(view, 'estimated').click();

        // `M2.md` is unestimated; `M1.md` is not. The ancestor stays as context.
        expect(row(view, 'M2.md', { optional: true })).not.toBeNull();
        expect(row(view, 'M1.md', { optional: true })).toBeNull();
        expect(row(view, 'E.md', { optional: true })).not.toBeNull();
        expect(chip(view, 'estimated').getAttribute('aria-pressed')).toBe('true');
    });

    it('restores the whole tree on a second press', () => {
        const { view } = releaseScreen({});
        chip(view, 'estimated').click();
        chip(view, 'estimated').click();

        expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
    });

    it('suspends hide-done while narrowed', () => {
        // Turn the hide-done toggle on, then narrow to a criterion a DONE member fails.
        // The done member must be drawn: hiding the row you are being told to fix is the
        // dead end this whole feature is about.
    });

    it('clears itself once the criterion is satisfied', async () => {
        const { view, vault } = releaseScreen({});
        chip(view, 'estimated').click();
        // Give the last unestimated member an effort, out of band, and refresh.
        vault.setFrontmatter('M2.md', { effort: 3 });
        refreshRelease(view, vault);

        expect(view.criterionFilter).toBeNull();
        expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
    });

    it('offers no narrowing on a satisfied criterion', () => {
        // A release whose every member is estimated: the chip is drawn and is not a button,
        // or is a disabled one — pick one and assert it. A control that filters to the whole
        // tree is a control that lies.
    });
});
```

Match `vault.setFrontmatter` and `refreshRelease` to the real helper names in `test/helpers/`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/release/readinessFilter.test.ts`
Expected: FAIL — the chips are `div`s and `criterionFilter` does not exist.

- [ ] **Step 3: Implement the state**

On `ReleaseView`:

```ts
/**
 * Which criterion the scope tree is narrowed to, or null for the whole tree.
 *
 * **Session state, deliberately** — a plain field, never the view-state store and never
 * the `.base`. Opening a release must not restore a narrowing nobody remembers asking
 * for; the shelf search takes the identical decision for the identical reason
 * (`src/view/CLAUDE.md`).
 *
 * Cleared by `pick`, beside `activeRowFile`: a filter is a statement about ONE release's
 * rows, and carrying it to the next screen would narrow a tree the reader never narrowed.
 */
criterionFilter: ReleaseCriterion['key'] | null = null;

setCriterionFilter(key: ReleaseCriterion['key'] | null): void {
    this.criterionFilter = key;
    // Re-renders itself: no config was set and no Bases refresh is coming — `setProjection`'s
    // own rule, one view over.
    this.render();
}
```

Clear it in `pick` beside `activeRowFile`.

- [ ] **Step 4: Implement the chips**

In `renderReadiness.ts`, `drawChip` creates a `<button>` rather than a `div` when the criterion has outstanding rows to show, carrying `aria-pressed` and toggling through `view.setCriterionFilter`. A `satisfied`, `empty` or `unconfigured` criterion keeps the static `div` it draws today — a control that would narrow to nothing, or to everything, is a control that lies.

Add `.pbl-rel-crit-on` (or style off `aria-pressed`) in `styles/releaseScope.css`.

- [ ] **Step 5: Implement the narrowing**

In `renderScope.ts`, between computing `readiness` and calling `drawScopeTree`:

```ts
// The filter's own criterion, resolved against the readiness just computed — never a
// remembered list. A filter whose criterion is now satisfied has nothing to show, so it
// clears itself and the whole tree is drawn: work the list to zero and the screen hands
// the release back.
const filtered = criterionRows(view, scope.rows, readiness);
```

`criterionRows` reads `view.criterionFilter`, finds that criterion, and returns `scope.rows` untouched when the filter is null or its `outstandingPaths` is null or empty — assigning `view.criterionFilter = null` in that last case (a field assignment, never `setCriterionFilter`, which would re-render inside a render). Otherwise it returns `rowsForPaths(scope.rows, new Set(paths))`.

`effectiveHideDone` gains a third conjunct: `view.criterionFilter === null`. State in its docblock that the PREFERENCE is untouched and only its effect pauses.

- [ ] **Step 6: The clear control**

In `scopeToolbar.ts`, draw a button while `view.criterionFilter !== null` that calls `view.setCriterionFilter(null)`, labelled with the criterion's own name.

- [ ] **Step 7: Catalog**

```ts
'release.scope.filterOn': 'Showing only what is outstanding for {criterion}',
'release.scope.filterClear': 'Show every row again',
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/release/ test/domain/`
Expected: PASS.

- [ ] **Step 9: Look at it**

Run: `npm run harness` — press each chip, check the pressed state reads as pressed and the toolbar's clear is reachable.

- [ ] **Step 10: Register and commit**

Amend `docs/requirements/Answering the readiness checklist.md` with the drill-down, add a `CHANGELOG.md` line, then:

```bash
npm run check
git add -A
git commit -m "feat: a readiness chip narrows the tree to the rows failing it"
```

---

## Self-Review

**Spec coverage.** §1 → Tasks 1–4 (bind, capacity value, unit, risk vocabularies, unreadable→open). §2 → Task 5. §3 → Tasks 6–8 (planners, chips, wiring + the narrowed boundary). §4 → Tasks 9–11. The spec's testing list maps onto the per-task tests; `test/view/contextCardWrites.test.ts`'s question is asked inside Tasks 7 and 8 rather than as a task of its own, because it is the same fixture those tasks already build.

**One spec item deliberately not built:** the spec says the effort dialog clears the key on an empty box. `ValuePromptModal` refuses a blank entry, so Task 3 records the gap for the capacity and Task 6's planner still implements the clear for the member effort, which reaches it through the menu path. If clearing a capacity turns out to be wanted, the upgrade path is named in Task 3 Step 7.

**Types.** `ReleaseField` is widened once in Task 3 (`'capacity'`) and once in Task 6 (`'effort' | 'risk'`); `ROLE_KEYS` gains a row each time and `reconfiguredKey` takes the whole `ReleaseSettings` from Task 3 onward. `Remedy` is defined in Task 2 and extended nowhere — Tasks 3 and 4 use its `run` and `open` arms as declared. `outstandingPaths` is `string[] | null` in Task 9 and read as `string[]` behind a null check in Task 11.
