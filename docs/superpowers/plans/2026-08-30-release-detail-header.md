# Release Detail Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the two closing actions into the release detail header, retire the standalone `Set released date` control they made redundant, and widen ✨ to bind the three options those actions need that are not properties.

**Architecture:** Five independent changes over `src/view/release/` and two stylesheet partials. No write path, gate or refusal changes: every batch is the one already shipped. The actions move into `drawHeader`, `drawReleased` stops drawing an invitation, `.pbl-rel-actions-note` takes a full-width line, the scope's action area gains a layout-only modifier class, and `runReleaseInit` gains a second sweep over non-property options.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0), vitest + jsdom, esbuild, plain CSS partials assembled by `scripts/styles-assemble.mjs`.

## Global Constraints

- **`npm run check` must pass**: `build`, `lint`, `test:coverage`, `analyze`, `docs`. CI runs the same five on Ubuntu **and** Windows. Run them as individual steps, not one chained call.
- **Coverage floors only ever go up, and must NOT be raised in this work.** `docs/issues/The coverage figure is not reproducible to a hundredth.md` records why a rise needs a figure that is reproducible. `scripts/coverage-floors.mjs` requires every floor to keep a covered unit of headroom.
- **400-line max per `src/` file**, 450 per `test/` file, enforced by lint — configured `skipBlankLines: true, skipComments: true`, so `wc -l` is the WRONG instrument and reads roughly 2.5x high on this heavily-docblocked tree. `renderScope.ts` counts 202 and `releaseClose.ts` 207; both have ~195 lines of headroom. `npm run lint` is what answers this. Measured on the files this plan
  touches: `renderScope.ts` 202, `releaseClose.ts` 207, `init.test.ts` 120,
  `releaseClose.test.ts` 157, `settings.test.ts` 324 — and
  **`releaseEdits.test.ts` at exactly 450, with none**, which is why Task 4 creates a file
  rather than appending to it.
- **Every user-visible string goes through `t()`** from `src/i18n/en.ts`. The catalog is data: no imports, no logic. **Nothing the plugin writes, matches or persists may come from it** — type names, state values, option keys, folder paths.
- **Layer rule, lint-enforced:** `main → commands → view → storage → domain`. `view/` may import `domain/`; `domain/` may not import `view/`.
- **Every module in `src/` must be specified** in a use case's `## Where it lives` or an ADR's `## Decision` (`docs-check.mjs` rule 7). No new `src/` modules are created here, so no register edit is required for rule 7 — but the two PBIs' `## Where it lives` already name every file this touches.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **Marketplace rules:** sentence-case UI text, `setCssProps` over inline styles, no global `app`.
- **`CHANGELOG.md`** gains entries under `[Unreleased]` in the PR that earns them.
- Obsidian cannot run here. The jsdom suite and `npm run harness` are the substitutes; **say so honestly — a live-vault check is owed and this plan does not discharge it.**

## File structure

| File | Responsibility after this plan |
| --- | --- |
| `src/domain/settings.ts` | gains `DEFAULT_RELEASED_VALUES`, the shipped released vocabulary, beside `DEFAULT_DONE_VALUES` and `DEFAULT_HORIZON_VALUES` |
| `src/view/release/init.ts` | gains `RELEASE_SUGGESTED_VALUES` and the second sweep in `runReleaseInit` |
| `src/view/release/newRelease.ts` | `boundKeys` learns to see non-property options |
| `src/view/release/renderScope.ts` | `drawHeader` owns the footline and calls `drawReleaseActions`; `drawReleased` draws the value as the control and nothing when bound-and-empty |
| `src/view/release/releaseClose.ts` | `drawReleaseActions` marks its area with the scope modifier class |
| `src/i18n/en.ts` | `release.scope.markReleased` removed |
| `styles/releaseScope.css` | `.pbl-rel-footline`, the scope action area's own layout, the note's full-width line; `button.pbl-rel-released-unset` removed |
| `test/view/release/releaseHeader.test.ts` | **new** — what the header draws for each state of the released figure |

---

### Task 1: The shipped released vocabulary

**Files:**
- Modify: `src/domain/settings.ts` (beside `DEFAULT_DONE_VALUES`, around line 306)
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const DEFAULT_RELEASED_VALUES: string[]` — the vocabulary Task 3's ✨ sweep binds. A `string[]`, matching its two siblings, joined with `', '` at the binding site.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/settings.test.ts`:

```ts
describe('the shipped released vocabulary', () => {
	it('is a value list, not a sentence', () => {
		// A vocabulary is DATA: it is matched against what a release note carries, so it
		// must never come from the catalog. Two people on different Obsidian languages
		// must not write status values the other's view reports as not-released.
		expect(DEFAULT_RELEASED_VALUES).toEqual(['Released']);
	});
});
```

Add `DEFAULT_RELEASED_VALUES` to the existing import from `../../src/domain/settings`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/settings.test.ts -t 'shipped released vocabulary'`
Expected: FAIL — the module has no export `DEFAULT_RELEASED_VALUES`.

- [ ] **Step 3: Write minimal implementation**

In `src/domain/settings.ts`, immediately after `DEFAULT_HORIZON_VALUES`:

```ts
/**
 * The shipped vocabulary for "this release is out" — what `Mark as released` writes and
 * what `Generate release notes` asks a release against, where the reader has declared
 * nothing of their own. A default the user edits freely, exactly as the two lists above.
 *
 * **A constant and never `t('release.option.releasedValuesHint')`, which holds the same
 * kind of string.** That hint is a placeholder: drawn, never written, so translating an
 * example of what to type is display. This is BOUND into the `.base` and then matched
 * against what release notes carry, so a catalog-sourced value would have a reader on a
 * German Obsidian write German status words and hand over a vault whose releases an
 * English reader's view reports as not-released. The root guide's own test — "one sees
 * different words" is text, "one writes notes the other's view cannot read" is data.
 */
export const DEFAULT_RELEASED_VALUES = ['Released'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/domain/settings.test.ts -t 'shipped released vocabulary'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings.ts test/domain/settings.test.ts
git commit -m "Add the shipped released vocabulary as domain data"
```

---

### Task 2: `boundKeys` learns to see non-property options

**Files:**
- Modify: `src/view/release/newRelease.ts:129-131` (`boundKeys`)
- Test: `test/view/release/init.test.ts`

**Interfaces:**
- Consumes: `declaredPropertyKeys(config)` from `src/domain/releaseOptions.ts` — returns `string[]`, and **filters to `option.type === 'property'`**.
- Produces: `boundKeys` (module-private) now also reflects `releaseNotesFolder`, `releasedStatusValues` and `releasedTransitionValue`. Task 3 depends on this: without it, a press whose only work is binding those three compares equal and reports it bound nothing.

**Why this task exists and comes first.** `bindAndReport` decides whether the press changed anything by comparing `boundKeys` before and after. `declaredPropertyKeys` filters to property options, and all three new options are `text`, `dropdown` and `folder` — invisible to it. This is the identical defect `boundKeys`' own docblock already records for `stateProperty`: "a press whose only work was binding the state key… compared equal and reported that it had bound nothing, then skipped the redraw." Fixing it first means Task 3's test can assert the report rather than working around it.

- [ ] **Step 1: Write the failing test**

Append to `test/view/release/init.test.ts`:

```ts
describe('the press reports binding a non-property option', () => {
	it('sees a folder bind that no property key reflects', async () => {
		// Every PROPERTY already bound, so the only work left is the folder. `boundKeys`
		// reads `declaredPropertyKeys`, which filters to property options — so before this
		// fix the comparison was equal and the press reported it had bound nothing, then
		// skipped the redraw that would show the button it had just switched on.
		const { view } = mountRelease({ bindAll: true });
		expect(view.config.get('releaseNotesFolder')).toBeUndefined();
		expect(await bindAndReport(view)).toBe(true);
	});
});
```

Add to the file's imports: `bindAndReport` from `../../../src/view/release/newRelease`, and
`mountRelease` from `../../helpers/release`. **The file currently imports `makeReleaseView`,
not `mountRelease`** — both exist in that helper; `mountRelease({ bindAll: false })` mounts an
UNTOUCHED config (`configValues = {}`), which is what every candidate test below needs, and
`mountRelease({ bindAll: true })` spreads `RELEASE_CONFIG`, which binds every property and
deliberately no folder.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/release/init.test.ts -t 'sees a folder bind'`
Expected: FAIL — `expected false to be true`. (It fails for the right reason only once Task 3 makes the sweep bind the folder. **Run this step again at the end of Task 3** and confirm it goes green there; until then it is red because nothing binds a folder at all, which is a different reason. Note that in the commit message.)

- [ ] **Step 3: Write minimal implementation**

Replace `boundKeys` in `src/view/release/newRelease.ts`:

```ts
/**
 * Every option a press could change, as one comparable string.
 *
 * **Not `declaredPropertyKeys` alone**, which filters to `type === 'property'` and so
 * cannot see the three the closing actions need — a folder, a value list and a dropdown.
 * This is the same defect the paragraph above records for `stateProperty`, met a second
 * time from the other side: there a declared key was missing from a hand-written list,
 * here a bound option is of a kind the list's own filter drops. A press whose only work
 * is binding the notes folder would otherwise compare equal, report that it bound
 * nothing, and skip the redraw that draws `Generate release notes`.
 */
function boundKeys(config: BasesViewConfig): string {
	const others = RELEASE_SUGGESTED_VALUES.map(({ option }) => `${option}=${String(config.get(option) ?? '')}`);
	return [...declaredPropertyKeys(config), ...others].join('\n');
}
```

Import `RELEASE_SUGGESTED_VALUES` from `./init`.

- [ ] **Step 4: Run lint and the file's own suite**

Run: `npm run lint && npx vitest run test/view/release/init.test.ts`
Expected: lint clean. The new test still FAILS (nothing binds a folder yet) and every other test in the file PASSES — a regression here means `boundKeys` changed an answer it should not have.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/newRelease.ts test/view/release/init.test.ts
git commit -m "Let the bind report see options that are not properties

The new test is red until the sweep that binds them lands in the next
commit; every existing test in the file stays green, which is what says
this changed no answer it should not have."
```

---

### Task 3: ✨ binds the three non-property options

**Files:**
- Modify: `src/view/release/init.ts` (add `RELEASE_SUGGESTED_VALUES`; extend `runReleaseInit`)
- Test: `test/view/release/init.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_RELEASED_VALUES` (Task 1); `config.get(option) !== undefined` as the "touched" test, the rule `adoptCandidates` documents.
- Produces: `export const RELEASE_SUGGESTED_VALUES: ValueCandidate[]` where `interface ValueCandidate { option: string; value: (config: BasesViewConfig) => string }` — read by Task 2's `boundKeys` for its option names, and by `runReleaseInit` to bind.

**Why a `value` function and not a string.** `releasedTransitionValue` must be one of `releasedStatusValues` or `configProblems` refuses it (`settings.transitionNotReleased`). Binding both to the literal `Released` independently is two statements that must agree; reading the list at bind time makes the invariant hold by construction, including where the reader declared their own vocabulary and left the transition untouched.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/release/init.test.ts`:

```ts
describe('the press binds the options that are not properties', () => {
	it('binds the notes folder to the option’s own placeholder', () => {
		const { view } = mountRelease({ bindAll: false });
		void runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('docs/release-notes');
	});

	it('binds the released vocabulary from domain data, never from the catalog', () => {
		// The option's placeholder is `t('release.option.releasedValuesHint')` — the string
		// `Released, Archived`. Binding a placeholder uniformly would write the CATALOG's
		// language into the `.base`, which is data in the wrong artifact.
		const { view } = mountRelease({ bindAll: false });
		void runReleaseInit(view);
		expect(view.config.get('releasedStatusValues')).toBe('Released');
		expect(view.config.get('releasedStatusValues')).not.toBe(en['release.option.releasedValuesHint']);
	});

	it('binds the transition to the FIRST of the reader’s own list, not the literal', () => {
		// The case a fixture spelling `Released` cannot see: with a vocabulary already
		// declared, binding the literal would fail `configProblems`' own check that the
		// transition is one of the released values.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releasedStatusValues', 'Shipped, Archived');
		void runReleaseInit(view);
		expect(view.config.get('releasedTransitionValue')).toBe('Shipped');
	});

	it('never overwrites an option the reader has touched', () => {
		// Cleared is not untouched, and neither is set — `adoptCandidates`' own rule,
		// applied to the three that reach none of its machinery.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releaseNotesFolder', 'notes/ship');
		void runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('notes/ship');
	});

	it('leaves a fully configured view with no configuration problems', () => {
		// The promise of the press, as one assertion rather than five.
		const { view } = mountRelease({ bindAll: false });
		void runReleaseInit(view);
		const settings = resolveReleaseSettings(view.config);
		expect(settings.notesFolder).not.toBe('');
		expect(settings.releasedValues).toContain(settings.releasedTransition);
	});
});
```

Add to the file's imports: `resolveReleaseSettings` from `../../../src/domain/releaseOptions`
and `en` from `../../../src/i18n/en`. `runReleaseInit` and `mountRelease` are already
imported — the first by the file, the second by Task 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/release/init.test.ts -t 'options that are not properties'`
Expected: FAIL — five failures, each `expected undefined to be …`.

- [ ] **Step 3: Write minimal implementation**

In `src/view/release/init.ts`, after `RELEASE_SUGGESTED_KEYS`:

```ts
/** An option ✨ binds that names no property, and how to decide its value at bind time. */
export interface ValueCandidate {
	option: string;
	value: (config: BasesViewConfig) => string;
}

/**
 * The three the closing actions need and {@link RELEASE_SUGGESTED_KEYS} cannot carry: a
 * folder, a value list and a dropdown over that list. They reach none of
 * `adoptCandidates`' machinery because they name no property — there is no key for
 * `taken` to guard and no collision to report. What they share with the seven is the ONE
 * rule that applies to them, applied in {@link runReleaseInit}: an option the reader has
 * touched is never overwritten, and cleared is not untouched.
 *
 * **`releaseNotesFolder` binds the option's own placeholder** (`releaseOptions.ts`), which
 * is the rule all seven property candidates already follow — `versionProperty` suggests
 * and places `version`, `releasedDateProperty` suggests and places `released`. A
 * placeholder is where this codebase writes down what it would pick, so picking anything
 * else is the plugin holding two opinions about one option. Not derived from
 * `defaultTypeFolder(RELEASE_TYPE)` (`docs/releases`) for that reason: the placeholder
 * already says `docs/release-notes`, and a second answer beside it is drift.
 *
 * **`releasedStatusValues` must NOT follow that rule**, and this is the trap. Its
 * placeholder is `t('release.option.releasedValuesHint')` — the string `Released,
 * Archived`, in the translation catalog. Binding it would make ✨ write the CATALOG's
 * language into the `.base`, so a reader on a German Obsidian binds German status words,
 * stamps them onto release notes, and hands over a vault whose releases an English
 * reader's view reports as not-released. It binds {@link DEFAULT_RELEASED_VALUES}, which
 * is domain data for exactly that reason.
 *
 * **`releasedTransitionValue` reads the list rather than restating the literal.**
 * `configProblems` refuses a transition that is not one of the released values, so two
 * independent literals would be two statements that must agree. Reading whatever the
 * config holds AFTER the row above has run makes the invariant hold by construction —
 * and it is why this list is ORDERED and swept in order.
 */
export const RELEASE_SUGGESTED_VALUES: ValueCandidate[] = [
	{ option: 'releaseNotesFolder', value: () => 'docs/release-notes' },
	{ option: 'releasedStatusValues', value: () => DEFAULT_RELEASED_VALUES.join(', ') },
	{ option: 'releasedTransitionValue', value: (config) => releasedValuesOf(config)[0] ?? '' },
];
```

Add imports: `DEFAULT_RELEASED_VALUES` from `../../domain/settings`, and `releasedValuesOf` from `../../domain/releaseOptions` — **which must be exported there**; it is currently module-private (`src/domain/releaseOptions.ts:247`). Change `function releasedValuesOf` to `export function releasedValuesOf` and add to its docblock:

```ts
/** The declared released values, read straight off the config for the dropdown that
 *  offers them — the same text `resolveReleaseSettings` turns into `releasedValues`.
 *  Exported since 2026-08-30 for ✨'s own second reader (`view/release/init.ts`): the
 *  transition it binds must be one of these, and re-splitting the same string beside it
 *  is the two-readers-disagreeing hazard this codebase states at every model boundary. */
```

Then extend `runReleaseInit`, after the existing property loop and **before** `resolveReleaseSettings`:

```ts
	// The second sweep, in order: each candidate reads the config as the one before it
	// left it, which is what lets the transition pick from a vocabulary this same press
	// may have just supplied. An empty value binds nothing — a transition with no list to
	// choose from is not a value, and writing `''` would report as touched to the next press.
	for (const { option, value } of RELEASE_SUGGESTED_VALUES) {
		if (view.config.get(option) !== undefined) continue;
		const bound = value(view.config);
		if (bound !== '') view.config.set(option, bound);
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/release/init.test.ts`
Expected: PASS, all of them — **including Task 2's `sees a folder bind that no property key reflects`**, which was left red on purpose.

- [ ] **Step 5: Watch the catalog invariant fail**

Temporarily change the `releasedStatusValues` row to `value: () => t('release.option.releasedValuesHint')` (importing `t`), run:

Run: `npx vitest run test/view/release/init.test.ts -t 'never from the catalog'`
Expected: FAIL. Restore the constant and confirm PASS. **This is the invariant most likely to be "simplified" back by a later reader**, so it is the one worth watching red.

- [ ] **Step 6: Run the full gate**

Run: `npm run build && npm run lint && npm run docs`
Expected: all clean. `analyze` needs a coverage file — it runs in Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/view/release/init.ts src/domain/releaseOptions.ts test/view/release/init.test.ts
git commit -m "Let the sparkle bind the three options that are not properties

The folder takes its option's own placeholder, the rule all seven
property candidates already follow. The vocabulary does NOT: that
placeholder is a t() call holding 'Released, Archived', so binding it
uniformly would write the catalog's language into the .base and hand a
German reader a vault an English reader's view reports as not-released.
It binds DEFAULT_RELEASED_VALUES instead. The transition reads the list
the row above may have just supplied, so configProblems' own check holds
by construction rather than by two literals agreeing."
```

---

### Task 4: The released date stops inviting

**Files:**
- Modify: `src/view/release/renderScope.ts:296-318` (`drawReleased`) and its docblock above it
- Modify: `src/i18n/en.ts` (remove `release.scope.markReleased`)
- Modify: `styles/releaseScope.css` (remove `button.pbl-rel-released-unset`)
- Create: `test/view/release/releaseHeader.test.ts`

**A NEW test file, and that is measured rather than preferred.** `releaseEdits.test.ts`
already owns the released-date dialog and would be the obvious home — but it counts
**exactly 450** lines under lint's own rule (`skipBlankLines`, `skipComments`), which is
the budget. It has zero headroom, so appending one test fails lint before it fails for a
reason worth reading. The four below go in a new file, which `test/` needs no register
edit for (rule 7 covers `src/` only, deliberately).

**Interfaces:**
- Consumes: `ReleaseRow.released: ReleaseFigure<string>` — `{ unconfigured: boolean; invalid: boolean; value: string | null }`.
- Produces: no new symbol. `.pbl-rel-released` is drawn **only** when a date exists; `RELEASED_BUTTON = '.pbl-rel-released'` in `releaseEdits.ts` and `'pbl-rel-released'` in `FOCUS_HANDLE_CLASSES` are both unchanged and both still correct — they name a control that is now sometimes absent, which they already tolerate (`focusControl` looks up fresh and no-ops on null).

- [ ] **Step 1: Write the failing tests**

Create `test/view/release/releaseHeader.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen } from '../../helpers/release';
import { en } from '../../../src/i18n/en';

describe('the released date is a control only when there is a date', () => {
	it('draws nothing when the key is bound and the value absent', () => {
		// The invitation retired: `Mark as released` below is the way to set a date, so a
		// second control offering the same field is two controls for one property. The
		// rule this moves to is the target date's own — an absent figure draws nothing.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
	});

	it('still offers marking on that very release', () => {
		// Asserted BESIDE the absence, not in another file: retiring the invitation is only
		// safe because this button covers it, and a future change that removed both would
		// pass two suites that each still made sense on their own.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).not.toBeNull();
	});

	it('draws the date itself as the control when one exists', () => {
		const { view } = releaseScreen({ status: 'Released', released: '2026-06-18' });
		const el = view.viewEl.querySelector('.pbl-rel-released');
		expect(el?.textContent).toBe(en['release.scope.releasedOn'].replace('{date}', '2026-06-18'));
	});

	it('still says so when the date cannot be read', () => {
		const { view } = releaseScreen({ status: 'In progress', released: ['a', 'b'] });
		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-unreadable')).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/release/releaseHeader.test.ts`
Expected: FAIL on the first case — the invitation button is drawn, so `.pbl-rel-released` is not null.

- [ ] **Step 3: Write minimal implementation**

Replace the `drawReleased` body in `src/view/release/renderScope.ts`:

```ts
function drawReleased(view: ReleaseView, factsEl: HTMLElement, release: ReleaseRow): void {
	if (release.released.unconfigured) return;
	if (release.released.invalid) {
		factsEl.createSpan({
			cls: 'pbl-rel-unreadable',
			text: t('release.figureUnreadable', { label: t('release.index.column.released') }),
		});
		return;
	}
	const date = release.released.value;
	// Bound and EMPTY draws nothing — `drawFigure`'s own rule for the target date beside
	// it, which this figure was the one exception to. The exception's reason was that
	// absence is an invitation for the one field this screen can fill; `Mark as released`
	// in the footline below is that invitation now, and two controls for one property is
	// worse than a field named as a field.
	if (date === null) return;
	const btn = factsEl.createEl('button', {
		cls: 'pbl-rel-released',
		// No `aria-label` here: the button's own text says both what it holds and what it
		// is, which is what a name over it would replace — `drawDescription`'s own rule.
		attr: { type: 'button' },
		text: t('release.scope.releasedOn', { date: formatCivil(date) }),
	});
	setTooltip(btn, t('release.scope.releasedTitle', { name: release.name }));
	// The date the button DRAWS, kept in its accessible name — see `drawStatus`' own note
	// on why this follows the tooltip rather than preceding it.
	btn.setAttribute('aria-label', chipName(t('release.index.column.released'), formatCivil(date)));
	btn.addEventListener('click', () => editReleaseReleased(view, release));
}
```

Rewrite the paragraph in its docblock that reads *"An UNSET date draws the invitation, because this is the one figure on the screen the reader can fill."* to:

```
 * An UNSET date draws NOTHING, which is `drawFigure`'s own rule for the target date beside
 * it and was this figure's one exception until 2026-08-30. The exception's reason —
 * absence is an invitation for the one field this screen can fill — stopped applying when
 * `Mark as released` landed in the footline below, whose offer predicate fires on exactly
 * this condition (`released.value === null && !released.invalid`). Editing the date is
 * still reachable on every release that HAS one; what is gone is a second control for a
 * field a button already offers.
```

Delete `'release.scope.markReleased': 'Set released date',` from `src/i18n/en.ts` (line 1900) and the sentence in the docblock above it that explains the rename. Delete the `button.pbl-rel-released-unset` rule and its comment from `styles/releaseScope.css`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/release/releaseHeader.test.ts && npm run lint && npm run build`
Expected: PASS, and `build` clean — `t()` derives its key type from the catalog, so a surviving caller of the removed key is a compile error rather than a runtime one.

- [ ] **Step 5: Watch the paired invariant fail**

Revert only the `if (date === null) return;` line, run:

Run: `npx vitest run test/view/release/releaseHeader.test.ts -t 'draws nothing when the key is bound'`
Expected: FAIL. Restore and confirm PASS.

- [ ] **Step 6: Commit**

```bash
git add src/view/release/renderScope.ts src/i18n/en.ts styles/releaseScope.css test/view/release/releaseHeader.test.ts
git commit -m "Draw the released date only where there is one

Set released date and Mark as released were two controls for one field.
The invitation goes; the date itself stays the control that clears,
corrects and backdates, so nothing the dialog could do is lost. The rule
it moves to is the target date's own, one figure to its left."
```

---

### Task 5: The actions move into the header

**Files:**
- Modify: `src/view/release/renderScope.ts` (`renderScope` loses the call; `drawHeader` gains the footline)
- Modify: `src/view/release/releaseClose.ts:41` (the area's classes)
- Modify: `styles/releaseScope.css` (`.pbl-rel-footline`, the scope area's layout)
- Test: `test/view/release/releaseClose.test.ts`

**Interfaces:**
- Consumes: `drawReleaseActions(view, parentEl, release, scope, planSettings)` — signature unchanged; only its `parentEl` argument changes at the call site.
- Produces: `.pbl-rel-footline` inside `.pbl-rel-header`, containing `.pbl-rel-summary` then `.pbl-rel-actions.pbl-rel-scope-actions`.

**Ordering note.** `drawSummary` currently appends to `headerEl`. It must now append to the footline, so `drawHeader` builds the footline and passes it down.

**Line budget: there is room, and the obvious measurement says otherwise.** `wc -l` reports `renderScope.ts` at 542 against a 400-line lint budget, which reads as already over. It is not: `max-lines` is configured `{ max: 400, skipBlankLines: true, skipComments: true }`, and this file is mostly docblock — it counts **202**, with 198 lines of headroom. `releaseClose.ts` counts 207. This task adds about six. Do not restructure anything on the strength of a raw line count; `npm run lint` is the only instrument that answers this question.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/release/releaseClose.test.ts`:

```ts
describe('the actions live in the header', () => {
	it('draws them inside the header block, not between it and the toolbar', () => {
		// The division is the codebase's own, stated at `drawOpenNote`: the toolbar's
		// controls are about the TREE, and these two are about the release the title names.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-header .pbl-rel-scope-actions')).not.toBeNull();
	});

	it('puts the summary and the actions on one line', () => {
		const { view } = releaseScreen({ status: 'In progress' });
		const foot = view.viewEl.querySelector('.pbl-rel-footline');
		expect(foot?.querySelector('.pbl-rel-summary')).not.toBeNull();
		expect(foot?.querySelector('.pbl-rel-scope-actions')).not.toBeNull();
	});

	it('still draws them on a release with no members', () => {
		// The empty-scope screen is the one place extension 1a can be exercised at all.
		// Drawn inside the header this holds structurally rather than by a comment nobody
		// must break — and this test is what says so.
		const { view } = releaseScreen({ status: 'In progress' }, emptyReleaseVault());
		expect(view.viewEl.querySelector('.pbl-rel-scope-actions')).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/release/releaseClose.test.ts -t 'actions live in the header'`
Expected: FAIL on the first two — there is no `.pbl-rel-scope-actions` and no `.pbl-rel-footline`. The third PASSES already, and must go on passing.

- [ ] **Step 3: Write minimal implementation**

In `src/view/release/renderScope.ts`, delete this from `renderScope` (including its two-line comment above it):

```ts
	drawReleaseActions(view, view.viewEl, release, scope, planSettings);
```

At the end of `drawHeader`, replace `drawSummary(headerEl, release, scope.members, planSettings);` with:

```ts
	// The header's last line: the summary on the left, the actions on the right. Both are
	// about the RELEASE rather than the tree, which is the division `drawOpenNote` above
	// already states — so the band that used to sit between this header and the tree's own
	// toolbar is gone and the actions are on the correct side of that line.
	//
	// It is also what makes the ordering STRUCTURAL. Drawn from `renderScope`, this call
	// had to sit above two empty-state returns and a comment had to say why; the header is
	// drawn on every screen, so the empty-scope case that `Generating the release notes`
	// extension 1a is about now gets the actions by construction.
	const footEl = headerEl.createDiv({ cls: 'pbl-rel-footline' });
	drawSummary(footEl, release, scope.members, planSettings);
	drawReleaseActions(view, footEl, release, scope, planSettings);
```

In `src/view/release/releaseClose.ts`, change line 41:

```ts
	// Two classes, two jobs. `.pbl-rel-actions` is shared with the index's own head
	// (`renderIndex.ts`) and means "an action area, disabled while a write is in flight" —
	// `syncBusy` sweeps `.pbl-rel-actions button` and that is correct for `New release`
	// too, since a note created during a sibling view's batch acts on a stale model the
	// same way. `.pbl-rel-scope-actions` is this area's LAYOUT alone, which is what the
	// index's rule was supplying by accident: `styles/release.css` gives that class
	// `justify-content: flex-end` and a padding for a component this is not.
	const areaEl = parentEl.createDiv({ cls: 'pbl-rel-actions pbl-rel-scope-actions' });
```

In `styles/releaseScope.css`, replace the `.pbl-rel-actions` rule with:

```css
/* The header's last line: the summary keeps the left, the actions take the right.

   The summary's basis is wide enough that the ACTIONS wrap first — at a narrow pane the
   buttons drop to their own line and the strip keeps `33%` beside `1 of 3 items done`
   rather than orphaning the sentence under a squeezed bar. Measured at 560px in the
   browser harness. */
.pbl-rel-footline {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-3);
}

.pbl-rel-footline .pbl-rel-summary {
	flex: 1 1 22em;
}

/* A COMPOUND selector, and that is load-bearing: `styles/release.css` styles the bare
   `.pbl-rel-actions` for the index's own head at (0,1,0), and this element carries that
   class too. `.pbl-rel-scope-actions` alone would also be (0,1,0) and the winner would be
   whichever partial `index.css` imports last — the tie this repository has already shipped
   as a defect twice. At (0,2,0) it wins on specificity and neither import position
   matters. */
.pbl-rel-actions.pbl-rel-scope-actions {
	flex: 0 0 auto;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--size-4-2);
	margin-inline-start: auto;
	padding: 0;
}
```

- [ ] **Step 4: Run the release suite**

Run: `npx vitest run test/view/release/ && npm run lint`
Expected: PASS, all of it. **The nine tests extension 1a already turns red are the guard here** — they must pass with the call moved, never be edited to match.

- [ ] **Step 5: Watch the structural claim fail**

Move the `drawReleaseActions` call from `drawHeader` to the end of `renderScope` (below the empty-state returns), run:

Run: `npx vitest run test/view/release/`
Expected: FAIL — several tests, including `still draws them on a release with no members`. Restore and confirm PASS.

- [ ] **Step 6: Commit**

```bash
git add src/view/release/renderScope.ts src/view/release/releaseClose.ts styles/releaseScope.css test/view/release/releaseClose.test.ts
git commit -m "Fold the release actions into the header

Three control bands become two. The division is the codebase's own,
stated at drawOpenNote: the toolbar's controls are about the tree and
these two are about the release the title names.

The action area keeps .pbl-rel-actions, which syncBusy sweeps and which
is correct for the index's New release too, and gains a layout-only
modifier — at a compound selector, since the modifier alone would tie
the index's rule and leave the winner to import order."
```

---

### Task 6: A refusal never captions the button beside it

**Files:**
- Modify: `styles/releaseScope.css` (`.pbl-rel-actions-note`)
- Test: `test/view/release/releaseClose.test.ts`

**Interfaces:**
- Consumes: `.pbl-rel-actions-note`, drawn by `nameWhatIsMissing` and by `drawGenerate`'s two early returns in `releaseClose.ts`. No TypeScript changes.
- Produces: nothing new.

**Why a partial-shape test.** jsdom computes no layout, so no suite here can assert that a note is on its own line. The check is `rowChrome.test.ts`'s own shape — read the partial off disk and assert it still declares the rule — and it is honest about being narrower than the claim.

- [ ] **Step 1: Write the failing test**

Append to `test/view/release/releaseClose.test.ts`:

```ts
describe('a refusal is not a caption on the button beside it', () => {
	// **Narrower than the claim, and the narrow sentence is the honest one** —
	// `rowChrome.test.ts`'s own shape and reason. jsdom computes no layout, so what is
	// checked is that `styles/releaseScope.css` still declares the full-width line. It
	// would not notice a different rule overriding it.
	const css = readFileSync('styles/releaseScope.css', 'utf8');

	it('gives the note a line of its own inside the action area', () => {
		// Before this, the area was a plain horizontal row and a refusal replaced its own
		// button IN PLACE — so `[Mark as released]  To generate release notes, bind the
		// release membership property.` put a sentence about generation immediately right
		// of the marking button. Both sentences name their own action; the layout invited
		// the wrong reading anyway.
		const block = css.match(/\.pbl-rel-actions-note\s*\{[^}]*\}/);
		expect(block, 'no rule for the actions note').not.toBeNull();
		expect(block?.[0]).toContain('flex: 1 0 100%');
	});
});
```

Add `import { readFileSync } from 'node:fs';` to the file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/release/releaseClose.test.ts -t 'not a caption'`
Expected: FAIL — the rule exists but declares no `flex`.

- [ ] **Step 3: Write minimal implementation**

In `styles/releaseScope.css`, extend the existing `.pbl-rel-actions-note` rule:

```css
/* Why an action is not offered: an option to bind, or a field to repair. Muted and small,
   the shell every other secondary sentence on this screen uses — it is an explanation
   beside a control, never a refusal of something the reader just did.

   A FULL-WIDTH line inside the action area, so it can only be read as its own statement.
   The area is a wrapping flex row of buttons; a note sized to its content sat horizontally
   beside whichever button was still offered, and since a refusal replaces its OWN button in
   place, the one on screen was always the other action's. Buttons keep the row; sentences
   take a line. */
.pbl-rel-actions-note {
	flex: 1 0 100%;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/view/release/releaseClose.test.ts && npm run build`
Expected: PASS, and `build` clean (the stylesheet is assembled and size-budgeted at build time).

- [ ] **Step 5: Look at it**

Run: `npm run harness -- test/harness/release.ts`

Open the printed `file://` URL at `?pick=Releases/0.8.md&config=nomembership` and at `?pick=Releases/1.1.md`. Confirm by eye that in both the sentence is on a line of its own and no button sits beside it. **This step draws and asserts nothing (ADR 0020); it is how the defect was found and it is the only place the fix is visible.**

- [ ] **Step 6: Commit**

```bash
git add styles/releaseScope.css test/view/release/releaseClose.test.ts
git commit -m "Give a withheld action's reason a line of its own

A refusal replaces its own button in place, so the button left beside it
was always the other action's — and the sentence read as its caption.
The test is narrower than the claim and says so: jsdom computes no
layout, so it checks the partial still declares the rule."
```

---

### Task 7: The register, the changelog, and the whole gate

**Files:**
- Modify: `docs/requirements/Marking a release as released.md` (`## Where it lives`)
- Modify: `docs/requirements/Generating the release notes.md` (`## Where it lives`)
- Modify: `docs/requirements/Editing a release from its own screen.md` (an extension recording the retirement)
- Modify: `CHANGELOG.md`
- Modify: `test/harness/mountRelease.ts` (drop the `FULL` workaround)

**Interfaces:**
- Consumes: everything above.
- Produces: a tree that passes all five `check` steps.

**The harness workaround comes out here.** `mountRelease.ts` binds `releaseNotesFolder` by hand in its `FULL` constant, because a folder is not a property and nothing offered to bind one. ✨ now does, but the harness mounts a config directly rather than pressing ✨ — so `FULL` stays. What changes is its comment, which currently says the option "is undrawable here at all"; that is no longer why. **Read the constant and correct the sentence rather than deleting the constant.**

- [ ] **Step 1: Update the two PBIs' `## Where it lives`**

Each already names `renderScope.ts`, `releaseClose.ts` and `init.ts`. Add to `Marking a release as released.md`:

```
- `src/domain/settings.ts` — `DEFAULT_RELEASED_VALUES`, the shipped vocabulary ✨ binds.
  Domain data and never the catalog: a bound status value is matched against what release
  notes carry, so a catalog-sourced one would differ per reader's Obsidian language.
```

Add to both PBIs, adjusting the sentence to each:

```
- `src/view/release/newRelease.ts` — `boundKeys`, which decides whether a ✨ press changed
  anything and had to learn to see options that are not properties.
```

- [ ] **Step 2: Record the retirement where it was decided**

`Editing a release from its own screen.md` extension 6a records the 2026-08-29 rename of this control. Append a sentence to that extension:

```
Retired on 2026-08-30. `Set released date` and `Mark as released` were two controls for
one field, which is what the rename made bearable rather than fixed. The date itself is
the control now — it is drawn only where a release has one, and it still clears, corrects
and backdates through the same dialog. Setting a date without also writing the status
stops being a one-press action: press `Mark as released`, then click the date.
```

- [ ] **Step 3: Add the changelog entries**

Under `## [Unreleased]` → `### Changed`, add:

```markdown
- A release's own screen draws the two closing actions inside its header rather than in a
  band between the header and the tree, beside the progress strip. At a narrow pane they
  wrap to their own line and the strip stays whole.
- `Set released date` is gone from the release header. The released date itself is the
  control: it is drawn only on a release that has one, and pressing it still clears,
  corrects or backdates through the same dialog. `Mark as released` is how a release gets
  its first date, so setting one without also writing the status now takes two presses.
- ✨ on a release view also binds the notes folder, the statuses that mean released, and
  the status to write — the three the closing actions need that Obsidian's property picker
  can never offer, because none of them is a property. Neither option gains a default: a
  vault that never presses ✨ still opens its options panel empty.
```

Under `### Fixed`, add:

```markdown
- The reason a closing action is not offered now takes a line of its own instead of sitting
  beside whichever button is still there — which, since a reason replaces its own button,
  was always the other action's, so it read as that button's caption.
```

- [ ] **Step 4: Correct the harness comment**

In `test/harness/mountRelease.ts`, the `FULL` constant's docblock says the folder being unbound made `Generate release notes` "undrawable here at all". Replace that clause with:

```
 * ✨ binds this option since 2026-08-30, but this mount hands the view a config directly
 * rather than pressing anything — so the constant stays and its reason narrows: what it
 * supplies is the state AFTER a press, which is what "binds every key" has to mean here.
```

- [ ] **Step 5: Run every gate**

Run each, in order, and read each result:

```bash
npm run build
npm run lint
npm run test:coverage
npm run analyze
npm run docs
```

Expected: all five clean. `test:coverage` takes ~4 minutes — run it in the background and wait rather than shortening it. **If a coverage floor fails, do NOT raise it**: find the uncovered line and either test it or delete it.

- [ ] **Step 6: Look at the whole screen once more**

Run: `npm run harness -- test/harness/release.ts`

Open `?pick=Releases/0.8.md` (in flight, no released date), `?pick=Releases/0.7.md` (shipped, the date is the control) and the same two at a narrow window. Confirm the header reads as one block and the actions sit beside the summary.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "Record the header overhaul in the register and the changelog"
git push -u origin claude/release-detail-header
```

Then open a pull request against `main`, filling in `.github/PULL_REQUEST_TEMPLATE.md`'s three checkboxes. **The third is not a formality here**: a live vault is owed for the footline's spacing against a themed vault's metrics and for whether the released date reads as editable against a theme's accent. Say so, and leave the box unticked.

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: the header's last line → Task 5; the released date as the control → Task 4; refusals on their own line → Task 6; the layout leak → Task 5; ✨'s three options → Tasks 1–3; the register, changelog and verification → Task 7. The spec's `## Testing` list is covered item for item, with one addition it did not name — Task 2, which exists because `boundKeys` filters to property options and would have reported Task 3's press as a no-op.

**Two things the spec got wrong, corrected here rather than followed:**

1. The spec says `drawReleaseActions` moving into `drawHeader` "retires a comment". It also moves `drawSummary`'s parent, which the spec does not mention — Task 5 states it, because a summary left on `headerEl` while the actions move to a footline is the half-applied version of this change and it looks right.
2. The spec's `## Where it lives` does not name `src/view/release/newRelease.ts`. Task 2 changes it and Task 7 adds it, because rule 7 is checked against the tree rather than against the spec.

**Type consistency.** `ValueCandidate.value` is `(config: BasesViewConfig) => string` in Task 3 and is called as `value(view.config)` there; `RELEASE_SUGGESTED_VALUES` is read in Task 2 for `.option` only, which that interface carries. `releasedValuesOf` returns `string[]` and is indexed `[0] ?? ''`. `ReleaseFigure<string>` is destructured as `unconfigured` / `invalid` / `value` in Task 4, matching `domain/releases.ts`.

**Two measurements this plan got wrong before they were checked**, both from the same
instrument and both caught by measuring the way the rule measures. An earlier draft of Task 5 warned that `renderScope.ts` was already over the 400-line budget at 542 and might need extracting. That was `wc -l` against a rule configured `skipComments: true` — the file counts 202. The warning would have sent an implementer into an unnecessary module split with a register edit attached. It is corrected in Task 5.

The second was the mirror image and would have bitten harder: an earlier Task 4 appended
four tests to `releaseEdits.test.ts` because that file owns the released-date dialog. It
counts **exactly 450** against a 450 budget — no headroom at all — so the first appended
test would have failed lint rather than failed for its own reason. Task 4 creates
`test/view/release/releaseHeader.test.ts` instead.

The general form is the root guide's own: measure a set with an instrument that can see
what the rule sees, and test the instrument first. `wc -l` said 542 where lint says 202,
and said 686 where lint says 450 — wrong in the safe direction once and the dangerous
direction once.
