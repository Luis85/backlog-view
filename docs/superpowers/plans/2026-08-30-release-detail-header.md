# Release Detail Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Corrected on 2026-08-30, after implementation.** Two of this plan's premises were false
> and were ruled on during execution; the code that shipped follows the rulings, and the
> instructions below have been rewritten to match it. What changed, and where: **Task 4**
> assumed `Mark as released` covers every bound-and-empty released date — it does not, so
> the invitation is withheld only where that action is OFFERED, and `release.scope.markReleased`
> and `button.pbl-rel-released-unset` both survive. **Task 4** also gained a focus fix the plan
> did not foresee, recorded in its Interfaces. **Task 2** imported a symbol Task 3 was to
> define, which as written yields an unbuildable intermediate commit; the symbol was pulled
> forward into Task 2 and the step now says so. **Task 5** (corrected 2026-08-30, in the
> post-review fix wave) carried two more: its CSS snippet showed `flex: 0 0 auto` and omitted
> `display: flex` and `min-inline-size: 0`, all three of which the shipped rule needs and two
> of which Task 6's own review round put there; and its second test snippet used
> `releaseScreen`'s default `scopeVault()`, whose members point at `R.md` while the helper
> opens `0.9.md`, so `drawSummary` withheld the very element the checkpoint asserts. The
> shipped test passes `twoWorkflowVault()`. The superseded text is not preserved in place
> — an instruction that breaks if followed is a trap, and this repository keeps what was
> DECIDED, which is what this note is. The rulings themselves are in the SDD ledger for this
> plan.

**Goal:** Fold the two closing actions into the release detail header, narrow the standalone `Set released date` control to the states the closing action cannot cover, and widen ✨ to bind the three options those actions need that are not properties.

**Architecture:** Five independent changes over `src/view/release/` and two stylesheet partials. No write path, gate or refusal changes: every batch is the one already shipped. The actions move into `drawHeader`, `drawReleased` draws its invitation only where `closeOffer` withholds the action below it, `.pbl-rel-actions-note` takes a full-width line, the scope's action area gains a layout-only modifier class, and `runReleaseInit` gains a second sweep over non-property options.

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
| `src/view/release/renderScope.ts` | `drawHeader` owns the footline and calls `drawReleaseActions`; `drawReleased` draws the value as the control, and the unset-date invitation only where `closeOffer(...).offered` is false |
| `src/view/release/releaseClose.ts` | `drawReleaseActions` marks its area with the scope modifier class |
| `src/view/release/releaseEdits.ts` | `focusControl`/`save` take a `fallback` selector, so clearing a date does not strand focus on the body |
| `src/i18n/en.ts` | unchanged — `release.scope.markReleased` is KEPT, since the invitation survives in three states |
| `styles/releaseScope.css` | `.pbl-rel-footline`, the scope action area's own layout, the note's full-width line; `button.pbl-rel-released-unset` KEPT |
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
- Test: none in this commit — `test/view/release/init.test.ts` proves this task's change in
  **Task 3**, for the reason Step 1 gives. What is asserted here is that every test already in
  that file still passes.

**Interfaces:**
- Consumes: `declaredPropertyKeys(config)` from `src/domain/releaseOptions.ts` — returns `string[]`, and **filters to `option.type === 'property'`**.
- Produces: `boundKeys` (module-private) now also reflects `releaseNotesFolder`, `releasedStatusValues` and `releasedTransitionValue`. Task 3 depends on this: without it, a press whose only work is binding those three compares equal and reports it bound nothing.
- **Build order, corrected 2026-08-30.** This step imports `RELEASE_SUGGESTED_VALUES` from `./init`, and the plan as first written did not define it until Task 3 — so the intermediate commit would not compile, and `npm run build` at Step 4 would have failed for a reason nothing here explained. The definition is PULLED FORWARD into this task: Step 3 below adds `ValueCandidate`, `RELEASE_SUGGESTED_VALUES` and the `releasedValuesOf` export to `src/view/release/init.ts` and `src/domain/releaseOptions.ts` first, and Task 3 adds only the sweep that reads them. That is what shipped (commit `80b4da5`, which built and linted); **Task 3 must not re-add them.** Read "passed CI" no wider than it goes: CI runs on a pushed HEAD, not on each commit under it, so what this checkpoint verified is `npm run build` and `npm run lint` locally — which is exactly why the test that could only be red here now lives in Task 3 (Step 1).

**Why this task exists and comes first.** `bindAndReport` decides whether the press changed anything by comparing `boundKeys` before and after. `declaredPropertyKeys` filters to property options, and all three new options are `text`, `dropdown` and `folder` — invisible to it. This is the identical defect `boundKeys`' own docblock already records for `stateProperty`: "a press whose only work was binding the state key… compared equal and reported that it had bound nothing, then skipped the redraw." Fixing it first means Task 3's test can assert the report rather than working around it.

- [ ] **Step 1: Read why this task carries no test of its own**

**`boundKeys`' widening is unobservable until the sweep exists**, so the test that proves it
can only be red in this commit — and a commit with a red suite fails this repository's own
definition of done (`npm run check`, which CI runs step for step). The proof is therefore
authored in **Task 3 Step 1**, one commit later, where it goes red and then green inside a
single task the way every other task here works.

**This task DID carry that test until 2026-08-30**, appended here and committed red on
purpose, with Step 4 below stating that it must stay red (found by review, Codex, PR #221).
That instructed an intermediate commit no gate would pass, beside a build-order note two
paragraphs up claiming this checkpoint passed CI — which it could only do because CI ran on
the pushed head rather than on this commit. Both are corrected: the test moved, and the note
now says what was actually verified here.

What this task still owes is the NEGATIVE claim, and Step 2 is where it is taken.

- [ ] **Step 2: Take the baseline before you touch anything**

Run: `npx vitest run test/view/release/init.test.ts`
Expected: PASS, all of it. This is the reading Step 4 is compared against — `boundKeys` feeds
every existing candidate test in the file, so "every one of these still passes afterwards" is
the whole of what says this widening changed no answer it should not have.

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

Import `RELEASE_SUGGESTED_VALUES` from `./init` — **and define it there in this same commit**, per the build-order note above, so this task's own checkpoint compiles. Task 3 then extends `runReleaseInit` alone and declares nothing.

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
 * reader's view reports as not-released. Its answer is {@link DEFAULT_RELEASED_VALUES},
 * which is domain data for exactly that reason — but only where the reader has stated
 * nothing to seed from; see the invariant below.
 *
 * **The vocabulary and the transition must agree, whichever the reader set first.**
 * `configProblems` refuses a transition that is not one of the released values, so two
 * independent answers are two statements that must agree. The list is ORDERED and swept in
 * order, and each half reads the other: an unset transition takes the FIRST of whatever
 * list the config holds after the row above has run, and an unset vocabulary is seeded FROM
 * a non-empty transition the reader already set rather than from the default beside it.
 * Both directions, because a sweep carrying only the first binds `Released` beside a
 * reader's own `Shipped` and withholds every closing action ✨ exists to enable — after a
 * press that reported success (found by review, Codex, PR #221).
 */
export const RELEASE_SUGGESTED_VALUES: ValueCandidate[] = [
	{ option: 'releaseNotesFolder', value: () => 'docs/release-notes' },
	{
		option: 'releasedStatusValues',
		// `resolveReleaseSettings` rather than `config.get`, so the value compared here is
		// read through the reader `closeOffer` itself will use — trimmed, which a raw read
		// is not.
		value: (config) =>
			resolveReleaseSettings(config).releasedTransition || DEFAULT_RELEASED_VALUES.join(', '),
	},
	{ option: 'releasedTransitionValue', value: (config) => releasedValuesOf(config)[0] ?? '' },
];
```

Add imports: `DEFAULT_RELEASED_VALUES` from `../../domain/settings`, and `releasedValuesOf` and `resolveReleaseSettings` from `../../domain/releaseOptions`. The second of those is already exported; **`releasedValuesOf` is not** — it is module-private (`src/domain/releaseOptions.ts:247`). Change `function releasedValuesOf` to `export function releasedValuesOf` and add to its docblock:

```ts
/** The declared released values, read straight off the config for the dropdown that
 *  offers them — the same text `resolveReleaseSettings` turns into `releasedValues`.
 *  Exported since 2026-08-30 for ✨'s own second reader (`view/release/init.ts`): the
 *  transition it binds must be one of these, and re-splitting the same string beside it
 *  is the two-readers-disagreeing hazard this codebase states at every model boundary. */
```


- [ ] **Step 4: Run the gate**

Run: `npm run check`
Expected: clean, all five steps — the same reading Step 2 took, now with the widening in
place. Every test in `init.test.ts` still passes, which is what says `boundKeys` changed no
answer it should not have; nothing here is expected to be red.

- [ ] **Step 5: Commit**

```bash
git add src/view/release/newRelease.ts src/view/release/init.ts src/domain/releaseOptions.ts
git commit -m "Let the bind report see options that are not properties

No test of its own: the widening is unobservable until the sweep that
binds these options lands in the next commit, so the test that proves it
is authored there rather than committed red here. Every existing test in
init.test.ts still passes, which is what says this changed no answer it
should not have."
```

---

### Task 3: ✨ binds the three non-property options

**Files:**
- Modify: `src/view/release/init.ts` (export `wouldBindValue`, extend `runReleaseInit` — and
  nothing else declared here; the candidate list both read was declared in Task 2)
- Modify: `src/view/release/initControl.ts` (`anythingToBind` asks the value half too)
- Modify: `src/view/release/releaseView.ts` (the `noReleases` screen's `fixes`)
- Test: `test/view/release/init.test.ts`, `test/view/release/initControl.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_RELEASED_VALUES` (Task 1); `RELEASE_SUGGESTED_VALUES` and its
  `ValueCandidate` type, both **declared in Task 2** and only READ here; `config.get(option)
  !== undefined` as the "touched" test, the rule `adoptCandidates` documents.
- Produces: `wouldBindValue(config, candidate)` — the one question "would a press bind this?"
  — plus the sweep inside `runReleaseInit` that decides a write with it, and the OFFER that
  asks it before drawing the button.
- **This contract said "Produces `RELEASE_SUGGESTED_VALUES`" until 2026-08-30**, after the
  step below had already been corrected not to declare it — so a reader following the summary
  rather than the step still duplicated the identifier and broke the checkpoint (found by
  review, Codex, PR #221). A task's own file list and interface are part of its instructions,
  not a preamble to them.

**Why a `value` function and not a string.** `releasedTransitionValue` must be one of `releasedStatusValues` or `configProblems` refuses it (`settings.transitionNotReleased`). Binding both to the literal `Released` independently is two statements that must agree; reading the list at bind time makes the invariant hold by construction, including where the reader declared their own vocabulary and left the transition untouched.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/release/init.test.ts` — **the folder-bind case first**, which was
authored in Task 2 until 2026-08-30 and moved here so that no instructed checkpoint commits a
red suite (see that task's Step 1):

```ts
describe('the press reports binding a non-property option', () => {
	it('sees a folder bind that no property key reflects', async () => {
		// Every PROPERTY already bound, so the only work left is the folder. `boundKeys`
		// reads `declaredPropertyKeys`, which filters to property options — so before
		// Task 2's fix the comparison was equal and the press reported it had bound
		// nothing, then skipped the redraw that would show the button it had just
		// switched on.
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

Then the sweep's own cases:

```ts
describe('the press binds the options that are not properties', () => {
	// `await`, never `void`: `runReleaseInit` is async, and two of these assert ABSENCE — an
	// unawaited press would let any await added inside it pass them vacuously and drop the
	// guards silently (found by review, Codex, PR #221).
	it('binds the notes folder to the option’s own placeholder', async () => {
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('docs/release-notes');
	});

	it('binds the released vocabulary from domain data, never from the catalog', async () => {
		// The option's placeholder is `t('release.option.releasedValuesHint')` — the string
		// `Released, Archived`. Binding a placeholder uniformly would write the CATALOG's
		// language into the `.base`, which is data in the wrong artifact.
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		expect(view.config.get('releasedStatusValues')).toBe('Released');
		expect(view.config.get('releasedStatusValues')).not.toBe(en['release.option.releasedValuesHint']);
	});

	it('binds the transition to the FIRST of the reader’s own list, not the literal', async () => {
		// The case a fixture spelling `Released` cannot see: with a vocabulary already
		// declared, binding the literal would fail `configProblems`' own check that the
		// transition is one of the released values.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releasedStatusValues', 'Shipped, Archived');
		await runReleaseInit(view);
		expect(view.config.get('releasedTransitionValue')).toBe('Shipped');
	});

	// The MIRROR of the case above, and the direction a candidate list holding a constant
	// cannot pass: with the transition touched and the vocabulary unset, seeding the list
	// from the default alone binds `Released` beside a transition of `Shipped`, and both
	// closing actions stay withheld after a press that reported success.
	it.each(['Shipped', ' Shipped'])(
		'seeds the vocabulary FROM a transition the reader set first (%j), so the pair agrees either way',
		async (transition) => {
			const { view } = mountRelease({ bindAll: false });
			view.config.set('releasedTransitionValue', transition);
			await runReleaseInit(view);
			const settings = resolveReleaseSettings(view.config);
			expect(settings.releasedValues).toContain('Shipped');
			expect(releaseNoteProblems(settings)).toEqual([]);
		},
	);

	it('never overwrites an option the reader has touched', async () => {
		// Cleared is not untouched, and neither is set — `adoptCandidates`' own rule,
		// applied to the three that reach none of its machinery.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releaseNotesFolder', 'notes/ship');
		await runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('notes/ship');
	});

	it('leaves a fully configured view with no configuration problems', async () => {
		// The promise of the press, as one assertion rather than five.
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		const settings = resolveReleaseSettings(view.config);
		expect(settings.notesFolder).not.toBe('');
		expect(settings.releasedValues).toContain(settings.releasedTransition);
	});
});
```

Add to the file's imports: `resolveReleaseSettings` from `../../../src/domain/releaseOptions`,
`releaseNoteProblems` from `../../../src/domain/settingsConsistency`, and `en` from
`../../../src/i18n/en`. `runReleaseInit` and `mountRelease` are already
imported — the first by the file, the second by Task 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/release/init.test.ts -t 'options that are not properties'`
Expected: FAIL — six failures (the seeded pair is parameterised over two spellings), each
`expected undefined to be …` or a vocabulary that does not contain the transition.

- [ ] **Step 3: Write minimal implementation**

**Nothing is DECLARED here.** `ValueCandidate`, `RELEASE_SUGGESTED_VALUES` and the
`releasedValuesOf` export landed in Task 2, which needed them to compile — see that task's
build-order note. Re-adding them here is a duplicate exported identifier and a checkpoint
that will not build (found by review, Codex, PR #221: the correction was written into Task 2
and this snippet was left standing). This task adds the SWEEP that reads them, and nothing
else.

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

**And the OFFER, which is half of this task rather than a follow-up.** A sweep the control
does not know about is the offer and the action coming apart, which is exactly what
`adoptableReleaseKeys`' own docblock forbids: an upgraded vault with every property bound and
one of the three closing options still unset would hide a ✨ that, pressed, would do real
work. So the same question the sweep asks is exported and asked by the control.

Export the guard from `init.ts` rather than restating it — `wouldBindValue(config, candidate)`,
untouched and a non-empty computed value — and have the sweep call it, so there is one rule
and not two copies. Then in `src/view/release/initControl.ts`, `anythingToBind` asks it of
every value candidate the `fixes` list names, after its existing property question:

```ts
	const valueCandidates = RELEASE_SUGGESTED_VALUES.filter((candidate) => fixes.includes(candidate.option));
	return valueCandidates.some((candidate) => wouldBindValue(view.config, candidate));
```

And in `src/view/release/releaseView.ts`, the `noReleases` screen passes `fixes` DERIVED from
both lists rather than the property one alone — a base with zero releases is the first-use
case that most needs every binding:

```ts
			renderReleaseInit(this, empty, 'empty', [
				...RELEASE_SUGGESTED_KEYS.map((candidate) => candidate.option),
				...RELEASE_SUGGESTED_VALUES.map((candidate) => candidate.option),
			]);
```

Derived, never a second list written out here: a further candidate is then covered by being
declared in `init.ts` and not by a list beside it going stale. `initControl.test.ts` gains the
case — every property bound, one value option unset, the button still offered.

**This half was in no executable step until 2026-08-30** (found by review, Codex, PR #221).
It shipped inside this task's own commit (`2c53cdf`), and the plan named it only in Task 7's
register update — so the tasks as written produced the sweep and left the button hidden.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/release/init.test.ts test/view/release/initControl.test.ts`
Expected: PASS, all of them — **including `sees a folder bind that no property key reflects`**, which proves Task 2's widening and could not go green until this sweep existed.

- [ ] **Step 5: Watch the catalog invariant fail**

Temporarily change the `releasedStatusValues` row's fallback to
`t('release.option.releasedValuesHint')` (importing `t`), run:

Run: `npx vitest run test/view/release/init.test.ts -t 'never from the catalog'`
Expected: FAIL. Restore `DEFAULT_RELEASED_VALUES` and confirm PASS. **This is the invariant most likely to be "simplified" back by a later reader**, so it is the one worth watching red.

- [ ] **Step 6: Run the full gate**

Run: `npm run build && npm run lint && npm run docs`
Expected: all clean. `analyze` needs a coverage file — it runs in Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/view/release/init.ts src/view/release/initControl.ts src/view/release/releaseView.ts test/view/release/init.test.ts test/view/release/initControl.test.ts
git commit -m "Let the sparkle bind the three options that are not properties

The folder takes its option's own placeholder, the rule all seven
property candidates already follow. The vocabulary does NOT: that
placeholder is a t() call holding 'Released, Archived', so binding it
uniformly would write the catalog's language into the .base and hand a
German reader a vault an English reader's view reports as not-released.
It falls back to DEFAULT_RELEASED_VALUES instead, and seeds from the
reader's own transition where they set one first. The transition reads
the list the row above may have just supplied, so configProblems' own
check holds by construction in both directions rather than by two
literals agreeing."
```

---

### Task 4: The released date stops inviting where the closing action covers it

**Files:**
- Modify: `src/view/release/renderScope.ts` (`drawReleased`) and its docblock above it
- Modify: `src/view/release/releaseEdits.ts` (`focusControl`/`save` gain a `fallback`)
- Create: `test/view/release/releaseHeader.test.ts`
- Modify: `test/view/release/releaseEdits.test.ts` and `test/harness/releaseHarness.test.ts` —
  both carry cases written against the UNCONDITIONAL invitation, so both fail on the narrowed
  rule until they are adjusted. Named here as well as in the step below because a file a task
  must change is part of its contract, and this one was in neither its file list nor its
  staging command until 2026-08-30 (found by review, Codex, PR #221)
- **Unchanged, and that is the correction of 2026-08-30:** `src/i18n/en.ts` keeps
  `release.scope.markReleased`, and `styles/releaseScope.css` keeps
  `button.pbl-rel-released-unset`. The first draft of this task deleted both on the premise
  that `Mark as released` covers every bound-and-empty date. **It does not** — `closeOffer`
  gates on `missing.length === 0 && unreadable === null && !alreadyOut && dateFree`, so the
  invitation is still the only route to a date in three states. Deleting the key and the
  rule would take the control away in exactly the states that need it, and the key deletion
  would not even compile.

**A NEW test file, and that is measured rather than preferred.** `releaseEdits.test.ts`
already owns the released-date dialog and would be the obvious home — but it counts
**exactly 450** lines under lint's own rule (`skipBlankLines`, `skipComments`), which is
the budget. It has zero headroom, so appending one test fails lint before it fails for a
reason worth reading. The four below go in a new file, which `test/` needs no register
edit for (rule 7 covers `src/` only, deliberately).

**Interfaces:**
- Consumes: `ReleaseRow.released: ReleaseFigure<string>` — `{ unconfigured: boolean; invalid: boolean; value: string | null }` — and `closeOffer(release, settings): CloseOffer` from `src/domain/releases.ts`, already imported by `releaseClose.ts` and now by `renderScope.ts` too.
- Produces: `.pbl-rel-released` is drawn when a date exists, and — carrying `pbl-rel-released-unset` — where `closeOffer(...).offered` is false. `'pbl-rel-released'` in `FOCUS_HANDLE_CLASSES` is unchanged.
- **`releaseEdits.ts` is NOT untouched, and the first draft of this section was wrong to say so.** It claimed `focusControl` looking up fresh and no-opping on null was sufficient. A no-op is exactly the defect: clearing a date on an OFFERED release removes `.pbl-rel-released` — the write is what makes `Mark as released` offered again — so `focusControl(view, RELEASED_BUTTON)` finds nothing and focus falls to `<body>`, off the keyboard path entirely. `focusControl` and `save` gain an optional `fallback` selector, and the released-date dialog passes `CLOSE_BUTTON = '.pbl-rel-close'`: the control the write just brought back. The regression test is the last case in `releaseHeader.test.ts` — the existing clear test in `releaseEdits.test.ts` asserts frontmatter only and passes straight through the bug. Found by review and confirmed independently by Codex on PR #221.

- [ ] **Step 1: Write the failing tests**

Create `test/view/release/releaseHeader.test.ts` — the shipped file, which asserts the
CORRECTED rule (a draft here asserted the unconditional one, and its first case would have
locked the defect in):

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen } from '../../helpers/release';
import { en } from '../../../src/i18n/en';
import { Modal } from '../../helpers/obsidian-mock';
import { flush } from '../../helpers/view';

describe('the released date is a control only when there is one, or Mark as released cannot cover it', () => {
	it('draws nothing when the key is bound, the value absent, and Mark as released is offered', () => {
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
	});

	it('and that fixture really does offer Mark as released', () => {
		// The premise the case above rests on. Asserted beside it, not in another file:
		// a future change that withheld both would pass two suites that each still read
		// as sensible on their own.
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

	it('draws the invitation when the status is already released but the date is not', () => {
		// `alreadyOut` — one of the three states `Mark as released` cannot cover. Without
		// this control an imported or hand-edited note here would have no way at all to
		// record when it shipped.
		const { view } = releaseScreen({ status: 'Released' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-released')?.textContent).toBe(en['release.scope.markReleased']);
	});

	// Plus the focus regression above: clear a date through the dialog on an offered
	// release and assert `document.activeElement` is `.pbl-rel-close`, not the body.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/release/releaseHeader.test.ts`
Expected: FAIL on the first case — the invitation is drawn unconditionally, so `.pbl-rel-released` is not null on an offered release. The `alreadyOut` case PASSES before the change and must keep passing after it: it is the half that says the narrowing did not go too far.

- [ ] **Step 3: Write minimal implementation**

Replace the `drawReleased` body in `src/view/release/renderScope.ts`. **This is the
`closeOffer`-gated form that shipped, not the unconditional `if (date === null) return;` an
earlier draft carried** — that draft would take the only route to a released date away from
the three states `Mark as released` is withheld in, and Codex confirmed on PR #221 that
anyone executing it would reverse the fix:

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
	// Bound and empty draws the invitation only where `Mark as released` is withheld —
	// see this function's own docblock. Where that action IS offered, it is the way to
	// set this field and this control draws nothing, `drawFigure`'s own rule for an
	// absent figure.
	if (date === null && closeOffer(release, view.settings).offered) return;
	const btn = factsEl.createEl('button', {
		cls: 'pbl-rel-released' + (date === null ? ' pbl-rel-released-unset' : ''),
		// No `aria-label`: the button's own text says both what it holds and what it is,
		// which is what a name over it would replace — `drawDescription`'s own rule.
		attr: { type: 'button' },
		text: date === null ? t('release.scope.markReleased') : t('release.scope.releasedOn', { date: formatCivil(date) }),
	});
	setTooltip(btn, t('release.scope.releasedTitle', { name: release.name }));
	// The date the button DRAWS, kept in its accessible name — see `drawStatus`' own note on
	// why this follows the tooltip rather than preceding it.
	btn.setAttribute('aria-label', chipName(t('release.index.column.released'), date === null ? null : formatCivil(date)));
	btn.addEventListener('click', () => editReleaseReleased(view, release));
}
```

Rewrite the paragraph in its docblock that reads *"An UNSET date draws the invitation, because this is the one figure on the screen the reader can fill."* to say what the gate above actually does — that an unset date draws the invitation **only where `Mark as released` is withheld**, asked as `!closeOffer(...).offered` rather than restated beside it; that `offered` is four conjuncts and `dateFree` is only the last, so a missing closing option, an unreadable status, or a release already carrying a released status each leave the field bound and empty with no other route; and that this control is therefore the fallback the footline's button does not cover rather than a second copy of it.

**Nothing is deleted.** `release.scope.markReleased` stays in `src/i18n/en.ts` — it is the invitation's label in those three states, and the `t()` key type would not compile without it — and `button.pbl-rel-released-unset` stays in `styles/releaseScope.css`, since the class is still applied. `releaseEdits.ts` gains the `fallback` recorded under Interfaces above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/release/releaseHeader.test.ts && npm run lint && npm run build`
Expected: PASS, and `build` clean. Also run `test/view/release/releaseEdits.test.ts` and `test/harness/releaseHarness.test.ts` — both carry cases written against the unconditional invitation and both need adjusting to the narrowed rule. (`test/harness/`, not `test/view/`: the plan said the latter until 2026-08-30 and no such file exists.)

- [ ] **Step 5: Watch the paired invariant fail**

Revert only the `&& closeOffer(release, view.settings).offered` clause — leaving `if (date === null) return;` — and run:

Run: `npx vitest run test/view/release/releaseHeader.test.ts`
Expected: FAIL on `draws the invitation when the status is already released`, which is the half the correction exists for. Then revert the whole guard instead (draw always) and confirm `draws nothing when the key is bound` fails. Restore and confirm both PASS: one revert each way is what says the gate is a gate rather than a constant.

- [ ] **Step 6: Commit**

```bash
git add src/view/release/renderScope.ts src/view/release/releaseEdits.ts test/view/release/releaseHeader.test.ts test/view/release/releaseEdits.test.ts test/harness/releaseHarness.test.ts
git commit -m "Draw the released date only where Mark as released cannot cover it"
```

---

### Task 5: The actions move into the header

**Files:**
- Modify: `src/view/release/renderScope.ts` (`renderScope` loses the call; `drawHeader` gains the footline)
- Modify: `src/view/release/releaseClose.ts:41` (the area's classes)
- Modify: `styles/releaseScope.css` (`.pbl-rel-footline`, the scope area's layout)
- Modify: `styles/release.css` (the index head keeps what the rule below stops giving it)
- Test: `test/view/release/releaseClose.test.ts`

**Interfaces:**
- Consumes: `drawReleaseActions(view, parentEl, release, scope, planSettings)` — signature unchanged; only its `parentEl` argument changes at the call site.
- Produces: `.pbl-rel-footline` inside `.pbl-rel-header`, containing `.pbl-rel-summary` then `.pbl-rel-actions.pbl-rel-scope-actions`.

**Two screens share `.pbl-rel-actions`, and this task stops one of them borrowing from the
other.** `releaseScope.css`'s bare `.pbl-rel-actions` rule imports AFTER `release.css`'s, so
at equal specificity it was styling the release INDEX head too — supplying its `flex-wrap`,
`align-items`, the larger `gap` and the 12px below it. Making that rule a compound selector
takes all four away from a screen this task does not otherwise touch: the index ✨ stretches
to the CTA's height and the space above the first band collapses to the 4px of its own
padding. So `release.css` must DECLARE what it was borrowing, in this same commit, and the
compound rule must cancel the two that are the index's own chrome. Missed when this shipped
and fixed after the fact (found by review, Codex, PR #221); stated here so following the plan
does not reproduce it.

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
		// `twoWorkflowVault()`, never `releaseScreen`'s default `scopeVault()`: that fixture's
		// members name `R.md` while this helper opens `0.9.md`, so the scope is empty,
		// `drawSummary` withholds `.pbl-rel-summary` and the checkpoint below is unreachable.
		const { view } = releaseScreen({ status: 'In progress' }, twoWorkflowVault());
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

Add `twoWorkflowVault` to the file's existing `../../helpers/release` import — the second
test above needs a fixture whose members actually name the release the helper opens.

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

In `styles/release.css`, give the index head the four declarations it has been borrowing —
`flex-wrap: wrap`, `align-items: center`, `gap: var(--size-4-2)` (up from `--size-4-1`, which
was declared and never won) and `margin-bottom: var(--size-4-3)` — and say in its comment that
they were in effect long before they were declared.

Then in `styles/releaseScope.css`, replace the `.pbl-rel-actions` rule with:

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
   matters. The two `0`s CANCEL the INDEX head's own chrome off the bare rule
   (`release.css` states it there); its `gap` and `align-items` are wanted. */
.pbl-rel-actions.pbl-rel-scope-actions {
	display: flex;
	flex: 0 1 auto;
	min-inline-size: 0;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--size-4-2);
	margin-inline-start: auto;
	margin-bottom: 0;
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
git add src/view/release/renderScope.ts src/view/release/releaseClose.ts styles/releaseScope.css styles/release.css test/view/release/releaseClose.test.ts
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
- Modify: `docs/requirements/Editing a release from its own screen.md` (extension 6a rewritten, 7b's focus fix)
- Modify: `CHANGELOG.md`
- Modify: `test/harness/mountRelease.ts` (correct the `FULL` docblock; the constant STAYS)
- Modify: this plan file, for the three premises implementation falsified

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
- `src/view/release/initControl.ts` — `anythingToBind`, which decides whether the empty
  state's ✨ is drawn at all and had to learn the same thing.
- `src/domain/releaseOptions.ts` — `releasedValuesOf`, exported for ✨'s own second reader
  so the transition it binds is one of the values it has just bound.
```

And to `Editing a release from its own screen.md`'s own `## Where it lives`:
`src/view/release/releaseEdits.ts` — the `fallback` on `focusControl`/`save`, since the
released date is the one control on this screen the write it caused can remove.

- [ ] **Step 2: Record the narrowing where it was decided**

`Editing a release from its own screen.md` extension 6a records the 2026-08-29 rename of this control **and states the invitation unconditionally**, which this work made stale. **Rewrite that bullet rather than appending under it** — an appended sentence contradicting the one above it leaves the register holding both. What it must now say: the invitation is drawn only where [[Marking a release as released]] is withheld; where that action is offered it is the route to a first date and this control draws nothing; the three states that keep it are a closing option OTHER than this field's own key still unbound, an unreadable status, and a release whose status already reads as released with no date beside it; and the price is that writing a date WITHOUT the status is no longer reachable where the action is offered.

An earlier draft of this step said "retired… drawn only where a release has one". **That is false and must not be pasted:** `closeOffer` gates on four conjuncts and only one is `dateFree`.

Extension 7b gains the focus fix: clearing the date can remove the very button that was pressed, so the restore names `.pbl-rel-close` as a fallback.

- [ ] **Step 3: Add the changelog entries**

Under `## [Unreleased]` → `### Changed`, add:

```markdown
- A release's own screen draws the two closing actions inside its header rather than in a
  band between the header and the tree, beside the progress strip. At a narrow pane they
  wrap to their own line and the strip stays whole.
- The released date on that header is now the control wherever a release has one. Where the
  date is empty, the invitation to set one is drawn only where `Mark as released` is
  withheld — the status property, the released statuses or the transition value still
  unbound, a status that cannot be read, or a release already carrying a released status
  with no date beside it. Everywhere else that action is
  the way to a first date and writes the status with it, so the ordinary release has one
  control for the field instead of two.
- ✨ on a release view also binds the notes folder, the statuses that mean released, and
  the status to write — the three the closing actions need that Obsidian's property picker
  can never offer, because none of them is a property. The button now offers itself when any
  of the three is unbound, instead of only when a property is. No option gains a default: a
  vault that never presses ✨ still opens its options panel empty.
```

**Not** "`Set released date` is gone from the release header" — an earlier draft of this step said so and it is false in three states.

Under `### Fixed`, add:

```markdown
- The reason a closing action is not offered now takes a line of its own instead of sitting
  beside whichever button is still there — which, since a reason replaces its own button,
  was always the other action's, so it read as that button's caption.
- Clearing a release's released date no longer drops keyboard focus to the page. Clearing it
  can make `Mark as released` offered again, which removes the very button the dialog was
  opened from, so the focus restore had nothing left to find; it now falls back to the
  closing action the write brought back.
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

**Spec coverage.** Every section of the spec maps to a task: the header's last line → Task 5; the released date as the control → Task 4; refusals on their own line → Task 6; the layout leak → Task 5; ✨'s three options → Tasks 1–3; the register, changelog and verification → Task 7. **Task 4's spec section was itself wrong**, and this self-review did not catch it: the spec claimed `Mark as released` covers every bound-and-empty released date, `closeOffer` says otherwise in three states, and what shipped follows `closeOffer`. Task 4 above carries the corrected form. The spec's `## Testing` list is covered item for item, with one addition it did not name — Task 2, which exists because `boundKeys` filters to property options and would have reported Task 3's press as a no-op.

**Three things this plan got wrong, corrected on 2026-08-30 after implementation** — recorded here rather than quietly patched, because a plan that reads as if it was always right teaches nothing:

1. Task 4 deleted `release.scope.markReleased` and `button.pbl-rel-released-unset` on a false premise about `closeOffer`. Both are kept; the invitation is gated, not retired.
2. Task 4's Interfaces called the existing `focusControl` null no-op sufficient. It is the defect: clearing a date removes its own control, so a `fallback` selector was needed.
3. Task 2 imported a symbol Task 3 defined, which as written does not build. The definition belongs in Task 2.

**Two things the spec got wrong, corrected here rather than followed:**

1. The spec says `drawReleaseActions` moving into `drawHeader` "retires a comment". It also moves `drawSummary`'s parent, which the spec does not mention — Task 5 states it, because a summary left on `headerEl` while the actions move to a footline is the half-applied version of this change and it looks right.
2. The spec's `## Where it lives` does not name `src/view/release/newRelease.ts`. Task 2 changes it and Task 7 adds it, because rule 7 is checked against the tree rather than against the spec.

**Type consistency.** `ValueCandidate.value` is `(config: BasesViewConfig) => string` and is called as `value(view.config)`; `RELEASE_SUGGESTED_VALUES` is read in Task 2 for `.option` only, which that interface carries — **and both are defined in Task 2**, not Task 3, since Task 2 imports them (the build-order correction recorded there). `releasedValuesOf` returns `string[]` and is indexed `[0] ?? ''`. `ReleaseFigure<string>` is destructured as `unconfigured` / `invalid` / `value` in Task 4, matching `domain/releases.ts`.

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
