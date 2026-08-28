# Release detail page — tree, summary, toolbar and the view's ✨

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the release view's detail screen a place to work — a folding, keyboard-driven, clickable tree with a summary strip and a scope toolbar — and give the view the ✨ control its binding action has never had, without the view ever editing a note.

**Architecture:** `src/view/release/renderScope.ts` splits into four modules by concern (screen, tree, keys, toolbar). The only `domain/` addition is a scope-local completion predicate for hiding; the summary draws figures `releaseIndex` already computes. Folds reuse the view-state store's existing per-identity `folds`; one new `prefs` field carries the hide-done toggle.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0 floor), vitest + jsdom, esbuild, ESLint with per-directory `no-restricted-imports`.

**Spec:** `docs/superpowers/specs/2026-08-28-release-detail-ux-design.md`

## Global Constraints

- **The release view never edits a note.** `applyWrites`, `applyRestores` and `applyPropertyWrites` are never called from `src/view/release/`. `test/view/releaseNeverEdits.test.ts` asserts this on the calls; it must stay green and must not be relaxed.
- **`npm run check` is the whole gate** — build, lint, coverage-thresholded tests, fallow, docs register. All five pass before every commit. Coverage thresholds in `vitest.config.mts` only ever go up.
- **400-line lint cap** on every `src/` file and every `styles/` partial; `test/**` has its own cap of 450.
- **Every user-visible sentence goes through `t()`**, keyed in `src/i18n/en.ts`. The catalog is FLAT (`'release.scope.back'`), it is data — no imports, no logic — and the sentence is the unit of translation. Nothing builds a message by joining pieces.
- **Layers:** `main → commands → view → storage → domain`; each may reach anything below and nothing above. `ui/` and `i18n/` are leaves.
- **`setCssProps` over inline styles**, `normalizePath` on user paths, no global `app`, sentence-case UI text.
- **Styles live in `styles/<partial>.css`**; the root `styles.css` is generated and gitignored. Edit the partial.
- **A `## [Unreleased]` entry in `CHANGELOG.md`** is added by the PR that earns it (Task 6).
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing** — revert the fix, run it, see red, restore.

---

### Task 1: The ✨ reports what it bound, and both entry points share the report

Slice D. Independent of every other task — it touches the index, not the scope screen.

**Files:**
- Modify: `src/view/release/newRelease.ts` (extract the bind-and-report step; `newRelease` keeps its own message)
- Create: `src/view/release/initControl.ts` (the ✨ control itself)
- Modify: `src/view/release/renderIndex.ts` (draw it on the actions bar)
- Modify: `src/view/release/releaseView.ts` (draw it on the `noMembership` scope empty state)
- Modify: `src/i18n/en.ts` (three keys)
- Modify: `docs/requirements/Creating a release from the release view.md` (`## Where it lives`)
- Test: `test/view/release/initControl.test.ts`

**Interfaces:**
- Produces: `bindAndReport(view: ReleaseView): Promise<boolean>` — exported from `newRelease.ts`, returns whether the press bound anything. `renderReleaseInit(view: ReleaseView, parentEl: HTMLElement, position: 'bar' | 'empty'): void` — exported from `initControl.ts`.
- Consumes: `runReleaseInit(view)` from `./init`, `adoptCandidates` / `notePropertyId` from `domain/optionalProperties.ts`, `declaredPropertyKeys` / `resolveReleaseSettings` from `domain/releaseOptions.ts`.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/initControl.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mountRelease } from '../../helpers/release';

describe('the release view’s ✨', () => {
	it('is drawn on the index bar even with nothing left to bind', () => {
		// Every candidate already bound: the bar control is a fixture of the bar, not a
		// state of the config — `render/toolbar.ts` and `estimation/toolbar.ts` both draw
		// theirs unconditionally, and a control that came and went would be worse.
		const { view } = mountRelease({ bindAll: true });
		expect(view.viewEl.querySelector('.pbl-rel-init')).not.toBeNull();
	});

	it('says it bound nothing rather than looking dead', async () => {
		const notices: string[] = [];
		const { view } = mountRelease({ bindAll: true, onNotice: (m) => notices.push(m) });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await vi.waitFor(() => expect(notices).toHaveLength(1));
		expect(notices[0]).toContain('nothing');
	});

	it('reports the keys it bound', async () => {
		const notices: string[] = [];
		const { view } = mountRelease({ bindAll: false, onNotice: (m) => notices.push(m) });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await vi.waitFor(() => expect(notices).toHaveLength(1));
		expect(notices[0]).not.toContain('nothing');
		expect(view.config.get('membershipProperty')).toBeTruthy();
	});

	it('is WITHHELD on the noMembership empty state when nothing is adoptable', () => {
		// `renderSetupCta`'s own rule, and the reason is the same: an option someone
		// CLEARED is a decision this must not overrule, so a press that could only no-op
		// is not offered where guidance already names the option to set.
		const { view } = mountRelease({ membership: '', bindAll: true, pick: 'Releases/0.8.md' });
		expect(view.viewEl.querySelector('.pbl-empty')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).toBeNull();
	});

	it('is offered on that empty state when the membership key can still be bound', () => {
		const { view } = mountRelease({ membership: '', bindAll: false, pick: 'Releases/0.8.md' });
		expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).not.toBeNull();
	});

	it('writes no note from either position', () => {
		const { view, vault } = mountRelease({ bindAll: false });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		expect(vault.created).toHaveLength(0);
	});
});
```

Extend `test/helpers/release.ts`'s mount helper with the `bindAll`, `membership`, `pick` and `onNotice` options these tests use, following the shapes already there.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/release/initControl.test.ts`
Expected: FAIL — no `.pbl-rel-init` in the DOM.

- [ ] **Step 3: Extract the bind-and-report step**

In `src/view/release/newRelease.ts`, replace the three lines inside `newRelease` with a call to a new exported function, keeping every word of the existing comments on the moved lines:

```ts
/**
 * Bind whatever this vault has never touched, and answer WHETHER anything was bound.
 *
 * Extracted so the ✨ control and the `New release` press cannot come to disagree about
 * what a bind is — the root guide's "one move, N inputs": the binding and the reading
 * that reports it live together, never beside each caller. The two callers differ only
 * in what they SAY about a press that bound nothing, which is why this answers a boolean
 * rather than showing a message of its own: `New release` stays quiet and opens its
 * dialog (the requirement's "stays quiet when it did not"), while a standalone control
 * with nothing after it would otherwise look dead.
 */
export async function bindAndReport(view: ReleaseView): Promise<boolean> {
	// A FRESH resolve of the live config, never `view.settings`: that field is a snapshot
	// from the last data update, so an option bound since then reads as unset here and the
	// press reports a configuration change it did not make — `init.ts`'s own documented trap,
	// met on the reading side rather than the binding one.
	const before = boundKeys(resolveReleaseSettings(view.config));
	// Run unconditionally rather than asking first which options are unset. `runReleaseInit`
	// already puts that question to the live config (`adoptCandidates`), binds only what
	// nobody has touched, leaves a cleared option alone and does nothing at all when
	// everything is bound — a second reading of the same question here could only ever come
	// to disagree with it.
	await runReleaseInit(view);
	return boundKeys(view.settings) !== before;
}
```

and in `newRelease` itself:

```ts
	// Said rather than silent: the press changed the saved view's own configuration, which
	// nothing else on this screen reports. Quiet when it bound nothing is this caller's own
	// half of the rule — the dialog opens either way, so a silent press is not a dead one.
	if (await bindAndReport(view)) new Notice(t('release.new.bound'));
```

- [ ] **Step 4: Write the control**

Create `src/view/release/initControl.ts`:

```ts
import { Notice, setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { adoptCandidates } from '../../domain/optionalProperties';
import { declaredPropertyKeys, resolveReleaseSettings } from '../../domain/releaseOptions';
import { bindAndReport } from './newRelease';
import { RELEASE_SUGGESTED_KEYS } from './init';

/**
 * The release view's ✨, in two positions that answer the same question differently.
 *
 * **On the BAR it is always drawn.** `render/toolbar.ts` and `estimation/toolbar.ts` both
 * draw theirs unconditionally, and a toolbar control that came and went as the
 * configuration changed would be worse than one that no-ops — so a press with nothing to
 * bind says so instead of looking dead.
 *
 * **On an EMPTY STATE it is withheld** when nothing is adoptable, which is `renderSetupCta`'s
 * own rule in `render/emptyStates.ts` and its own reason: an option somebody CLEARED is a
 * decision this must not overrule, and the guidance beside it already names the option to
 * set. That is the honest answer when nothing here can be done for them.
 *
 * It writes no note in either position — `bindAndReport` reaches `runReleaseInit`, which
 * touches the `.base` and nothing else (`test/view/releaseNeverEdits.test.ts`).
 */
export function renderReleaseInit(view: ReleaseView, parentEl: HTMLElement, position: 'bar' | 'empty'): void {
	if (position === 'empty' && !anythingToBind(view)) return;
	const btn = parentEl.createEl('button', {
		cls: position === 'bar' ? 'clickable-icon pbl-rel-init' : 'pbl-rel-init mod-cta',
		attr: { type: 'button', 'aria-label': t('release.init.label') },
	});
	setIcon(position === 'bar' ? btn : btn.createSpan({ cls: 'pbl-btn-icon' }), 'sparkles');
	if (position === 'empty') btn.createSpan({ text: t('release.init.label') });
	setTooltip(btn, t('release.init.label'));
	btn.addEventListener('click', () => {
		void bindAndReport(view).then((bound) => {
			new Notice(bound ? t('release.new.bound') : t('release.init.nothing'));
			view.render();
		});
	});
}

/**
 * Whether a press could bind anything at all — asked of the LIVE config through the same
 * `adoptCandidates` the action itself uses, never of `view.settings`, which is a snapshot
 * from the last data update. Two readings of one question that could disagree is the trap
 * `init.ts` already documents.
 */
function anythingToBind(view: ReleaseView): boolean {
	const taken = new Set(declaredPropertyKeys(view.config).filter((key) => key !== ''));
	return adoptCandidates(view.config, RELEASE_SUGGESTED_KEYS, taken).length > 0;
}
```

Export `RELEASE_SUGGESTED_KEYS` from `src/view/release/init.ts` (it is `const` and unexported today).

- [ ] **Step 5: Add the catalog keys**

In `src/i18n/en.ts`, beside the other `release.*` entries:

```ts
	'release.init.label': 'Add missing properties',
	'release.init.nothing': 'Every release property is already bound. Nothing to add.',
```

- [ ] **Step 6: Draw it in both positions**

In `src/view/release/renderIndex.ts`, in `renderIndex`, on the actions bar — before `renderNewRelease`, so the primary action stays last:

```ts
	const actionsEl = view.viewEl.createDiv({ cls: 'pbl-rel-actions' });
	renderReleaseInit(view, actionsEl, 'bar');
	renderNewRelease(view, actionsEl);
```

In `src/view/release/releaseView.ts`, in `draw`, the `membershipKey === ''` branch moved from `renderScope.ts` stays where it is — instead pass the empty element on. In `renderScope.ts`'s `noMembership` branch:

```ts
	if (view.settings.membershipKey === '') {
		const empty = guidanceShell(
			view.viewEl,
			'settings-2',
			t('release.scope.noMembership.title'),
			t('release.scope.noMembership.hint'),
		);
		// The one screen that names an option and, until now, offered no way to set it.
		renderReleaseInit(view, empty, 'empty');
		return;
	}
```

- [ ] **Step 7: Style the bar control**

In `styles/release.css`, beside `.pbl-rel-new` — `.pbl-rel-actions` is already `justify-content: flex-end`, so the icon button needs only its own gap:

```css
/* The ✨ beside `New release`. `.clickable-icon` supplies the chrome, so there is no
   `button:not(.clickable-icon)` contest to lose here — `.pbl-rel-back`'s own case. */
.pbl-rel-init {
	flex: 0 0 auto;
	margin-inline-end: var(--size-4-1);
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/release/ test/view/releaseNeverEdits.test.ts`
Expected: PASS, including `releaseNeverEdits` unchanged.

- [ ] **Step 9: Update the register**

In `docs/requirements/Creating a release from the release view.md`, rewrite the `src/view/release/init.ts` paragraph in `## Where it lives`: it is no longer "the ✨ ACTION without a ✨ button". State that `src/view/release/initControl.ts` draws it, that the bar always draws it and the empty state withholds it when nothing is adoptable, and that the bind-and-report pair is `bindAndReport` in `newRelease.ts` so both entry points report by the same reading. Add an acceptance criterion: **a standalone press that bound nothing says so; one that bound something reports it; neither writes a note.**

Do the same in `src/view/release/init.ts`'s own header, which says "this view draws no ✨ button of its own".

- [ ] **Step 10: Run the whole gate and commit**

Run: `npm run check`
Expected: all five steps pass.

```bash
git add -A
git commit -m "Give the release view a control for the binding it could already do"
```

---

### Task 2: The summary strip

Slice B. No new derivation — `ReleaseRow` already carries `members` and `done`.

**Files:**
- Modify: `src/view/release/renderScope.ts` (`drawHeader` becomes two lines)
- Modify: `src/i18n/en.ts` (two keys)
- Modify: `styles/release.css`
- Modify: `docs/requirements/Summing up a release.md` (status, `## Where it lives`, and the module-location correction)
- Test: `test/view/releaseScopeRender.test.ts` (extend)

**Interfaces:**
- Consumes: `ReleaseRow.members` and `ReleaseRow.done`, both `ReleaseFigure<number>` from `domain/releases.ts`; `ReleaseScope.members` for the count already drawn.
- Produces: nothing other tasks consume; Task 5 draws its all-done state under the same header.

- [ ] **Step 1: Write the failing test**

Add to `test/view/releaseScopeRender.test.ts`:

```ts
describe('the summary strip', () => {
	it('draws the bar, the percentage and the sentence from ONE row', () => {
		// 0.8 has three members in the fixture, one of them Done.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		const strip = view.viewEl.querySelector('.pbl-rel-summary')!;
		expect(strip.querySelector('.pbl-rel-pct')!.textContent).toBe('33%');
		expect(strip.textContent).toContain('1 of 3 items done');
	});

	it('reports the same numbers the index band reported', () => {
		// One `ReleaseRow`, two screens — the rule `domain/releases.ts` states: progress
		// "is computed nowhere else". A second derivation would pass this only by luck.
		const index = mountRelease({});
		const band = index.view.viewEl.querySelector('[data-path="Releases/0.8.md"]')!.textContent!;
		const scope = mountRelease({ pick: 'Releases/0.8.md' });
		const strip = scope.view.viewEl.querySelector('.pbl-rel-summary')!.textContent!;
		expect(band).toContain('1 of 3');
		expect(strip).toContain('1 of 3');
	});

	it('names an unconfigured progress rather than leaving a gap', () => {
		// Extension 2c: absent AND named, never a silent omission and never a zero.
		const { view } = mountRelease({ pick: 'Releases/0.8.md', stateKey: '' });
		const strip = view.viewEl.querySelector('.pbl-rel-summary')!;
		expect(strip.querySelector('.pbl-rel-bar')).toBeNull();
		expect(strip.textContent).toContain('3 items');
		expect(strip.textContent!.toLowerCase()).toContain('not configured');
	});

	it('draws no strip for a release with no members', () => {
		// Extension 1a: nothing to count, and nothing reads as zero.
		const { view } = mountRelease({ pick: 'Releases/Someday.md' });
		expect(view.viewEl.querySelector('.pbl-rel-summary')).toBeNull();
	});

	it('counts a Deliverable member by its OWN workflow', () => {
		// `ReleaseRow.done` reads through `ownWorkflowReading`, so a Deliverable answers by
		// its own state property. Drawing the row keeps that for free; deriving a second
		// figure from the plan's state key would get it backwards.
		const { view } = mountRelease({ pick: 'Releases/0.9.md', deliverableDone: true });
		expect(view.viewEl.querySelector('.pbl-rel-summary')!.textContent).toContain('1 of');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/releaseScopeRender.test.ts`
Expected: FAIL — no `.pbl-rel-summary`.

- [ ] **Step 3: Split the header into two lines**

In `src/view/release/renderScope.ts`, `drawHeader` gains a `pbl-rel-hline` wrapper around what it draws today, then the strip beneath it:

```ts
/**
 * The summary strip: one bar, one percentage, one sentence — drawn from the SAME
 * `ReleaseRow` the index band was drawn from.
 *
 * **Nothing is derived here.** `domain/releases.ts` states the rule in its own words —
 * progress "is computed nowhere else — the single-release screen reads the same row,
 * which is what stops a band and a release header disagreeing about one release". A
 * second count over the same members would be a second opinion about a number that has
 * one right answer.
 *
 * `done` is a FIGURE, so its three answers are the three drawn here: unconfigured says so
 * and is never a zero (extension 2c — a progress nobody configured must not read as a
 * progress the screen forgot), invalid is impossible for a count and falls through with
 * it, and a value draws the bar. The item count answers beside it either way.
 *
 * Withheld whole when there are no members: `0 of 0 items done` beside an empty state
 * that already says the release is empty says it twice and worse (extension 1a).
 */
function drawSummary(headerEl: HTMLElement, release: ReleaseRow, members: number): void {
	if (release.members.unconfigured || members === 0) return;
	const sumEl = headerEl.createDiv({ cls: 'pbl-rel-summary' });
	if (release.done.unconfigured || release.done.value === null) {
		sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.members', { count: members }) });
		sumEl.createSpan({
			cls: 'pbl-rel-unreadable',
			text: t('release.figureUnconfigured', { label: t('release.scope.progress') }),
		});
		return;
	}
	const done = release.done.value;
	const pct = Math.round((100 * done) / members);
	const barEl = sumEl.createDiv({ cls: 'pbl-rel-bar pbl-rel-bar-wide' });
	barEl.createDiv({ cls: 'pbl-rel-bar-fill' }).setCssProps({ '--pbl-rel-fill': `${pct}%` });
	sumEl.createSpan({ cls: 'pbl-rel-pct', text: t('release.scope.percent', { pct }) });
	sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.doneOf', { done, total: members }) });
}
```

Call it at the end of `drawHeader`, and move the existing member-count span out of `.pbl-rel-facts` into the strip — the sentence `1 of 3 items done` already states the count, so two of them on one header is the same number twice.

- [ ] **Step 4: Add the catalog keys**

```ts
	'release.scope.progress': 'Progress',
	'release.scope.percent': '{pct}%',
	'release.scope.doneOf': '{done} of {total} items done',
	'release.figureUnconfigured': '{label} is not configured',
```

`release.scope.percent` is a key rather than a template in the module because the per-cent sign's position is grammar, not data.

- [ ] **Step 5: Style it**

In `styles/release.css`:

```css
/* The header now stacks two lines: the release's identity, then one strip of figures. */
.pbl-rel-header {
	flex-direction: column;
	align-items: stretch;
}

.pbl-rel-hline {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
}

/* One strip, one denominator. `flex-wrap` because a narrow pane must drop the sentence
   under the bar rather than shrink a bar whose fill is a PERCENTAGE of its own box —
   `columns.css`'s own measured reason for refusing to let a progress bar shrink. */
.pbl-rel-summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2) var(--size-4-3);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

.pbl-rel-bar-wide {
	inline-size: 160px;
	block-size: 8px;
}

.pbl-rel-pct {
	font-variant-numeric: tabular-nums;
	font-weight: var(--font-medium);
	color: var(--text-normal);
}

.pbl-rel-figure {
	display: inline-flex;
	align-items: center;
	gap: var(--size-4-1);
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/view/releaseScopeRender.test.ts test/view/releaseIndex.test.ts`
Expected: PASS.

- [ ] **Step 7: Look at it**

Run: `npm run harness -- test/harness/release.ts` then open `.harness/index.html?pick=Releases/0.8.md`, and again with `?theme=light`.
Check: the strip sits under the identity line, the bar does not shrink at a narrow pane, and the percentage's digits do not reflow.

- [ ] **Step 8: Update the register**

In `docs/requirements/Summing up a release.md`: change the "Nothing yet" paragraph to state what has shipped (the item count and the items-denominator progress, from the index's own row) and what has not (the effort figures, the blocked and risk counts, the unestimated figure). Correct `## Where it lives`: the figures are `src/domain/releases.ts`'s `ReleaseRow.members` and `.done`, this view's options are `src/domain/releaseOptions.ts` — **not** `domain/viewOptions.ts` — and the strip is drawn by `src/view/release/renderScope.ts`, not a module in `src/view/render/`. **Amend main flow 5 and its acceptance criterion**, which is a decision rather than a note: it says every figure names the property and the vocabulary it read, and a release mixing ordinary work with Deliverables has no one property to name because `done` reads through `ownWorkflowReading`. Rewrite it to *"every figure names its property and vocabulary where there is one; a figure computed over a population spanning several workflows names the workflows instead"*, and rewrite the acceptance criterion under it the same way. Note the date and that it was the author's call — the sentence predates `ownWorkflowReading`, so this is a requirement catching up with a reading it never anticipated, not a rule being relaxed to fit an implementation.

- [ ] **Step 9: Run the whole gate and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "Draw a release's progress from the row the index already counted"
```

---

### Task 3: Folds, the disclosure, and a click that opens the note

Slice A, first half. `renderScope.ts` splits here.

**Files:**
- Create: `src/view/release/scopeTree.ts` (the rows, the disclosure, the fold set)
- Modify: `src/view/release/renderScope.ts` (keeps the header and the empty states; calls the tree)
- Modify: `src/view/release/releaseView.ts` (gains the `OpenController`)
- Modify: `src/domain/releaseOptions.ts` (this view's own `openIn` option)
- Modify: `src/i18n/en.ts` (two keys)
- Modify: `styles/release.css`
- Modify: `docs/requirements/The scope of a release as a tree.md`
- Test: `test/view/release/scopeTree.test.ts`

**Interfaces:**
- Produces: `drawScopeTree(view: ReleaseView, release: ReleaseRow, rows: ScopeRow[]): void`, `foldedPaths(view: ReleaseView): Set<string>`, `toggleFold(view: ReleaseView, path: string): void`, `setAllFolds(view: ReleaseView, rows: ScopeRow[], folded: boolean): void` — all from `scopeTree.ts`. Task 4 consumes `foldedPaths` and `toggleFold`; Task 5 consumes `setAllFolds`.
- Consumes: `ScopeRow` from `domain/releases.ts`; `loadViewState` / `saveViewState` from `storage/viewStateStore.ts`; `resolveViewIdentity` from `storage/viewIdentity.ts`; `OpenController` from `view/openTarget.ts`.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/scopeTree.test.ts`:

```ts
describe('the scope tree', () => {
	it('draws a disclosure on a row with children and a placeholder on a leaf', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		const parent = row(view, 'Passwordless sign-in.md');
		expect(parent.querySelector('.pbl-twisty')).not.toBeNull();
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		const leaf = row(view, 'Send the magic link.md');
		// The gutter is held so a level's titles share one x — but it announces nothing.
		expect(leaf.querySelector('.pbl-twisty-leaf')).not.toBeNull();
		expect(leaf.hasAttribute('aria-expanded')).toBe(false);
	});

	it('folding hides the descendants and persists across a data update', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('false');
		view.onDataUpdated();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
	});

	it('keeps a folded parent’s own rollup', () => {
		// The rollup is over the subtree, never over what is drawn: folding is a render
		// decision and must not change a number.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		const before = row(view, 'Passwordless sign-in.md').querySelector('.pbl-progress-label')!.textContent;
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Passwordless sign-in.md').querySelector('.pbl-progress-label')!.textContent).toBe(before);
	});

	it('a click on the row opens the note; a click on the disclosure does not', () => {
		const { view, opened } = mountRelease({ pick: 'Releases/0.8.md' });
		row(view, 'Expire the link.md').click();
		expect(opened).toEqual(['Expire the link.md']);
		twisty(view, 'Passwordless sign-in.md').click();
		expect(opened).toEqual(['Expire the link.md']);
	});

	it('a context row carries no rollup, folded or not', () => {
		// The context-row rule: it renders, it parents, and that is all.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		expect(row(view, 'Sign-up flow.md').querySelector('.pbl-progress')).toBeNull();
	});

	it('forgets nothing when the base is embedded — the pick’s own asymmetry', () => {
		// No view identity, so folds are session-only rather than absent: they survive a
		// data update in the session and are gone on remount, exactly as `pickedPath` is.
		const { view } = mountRelease({ pick: 'Releases/0.8.md', embedded: true });
		twisty(view, 'Passwordless sign-in.md').click();
		view.onDataUpdated();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
	});
});
```

Add `row`, `twisty` and the `opened` / `embedded` mount options to `test/helpers/release.ts`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/release/scopeTree.test.ts`
Expected: FAIL — no `.pbl-twisty`.

- [ ] **Step 3: Move the tree into its own module**

Create `src/view/release/scopeTree.ts` with `drawRow`, `siblingPlaces` and `drawTree` moved verbatim from `renderScope.ts` — comments included — then add the fold set, the disclosure and the click. The fold store:

```ts
/**
 * The paths folded shut on THIS view, from the same per-identity entry the pick is
 * stored in. Nothing new is persisted: `folds.collapsed` already exists, is keyed by
 * path, is pruned by path and is migrated by both rename walks.
 *
 * The in-memory fallback is `restorePick`'s own asymmetry, read from the other end: an
 * embedded base has no identity, so its folds are session-only rather than absent —
 * gone on reload, exactly as the pick is, and the tree is one press from opening again.
 */
const sessionFolds = new WeakMap<ReleaseView, Set<string>>();

export function foldedPaths(view: ReleaseView): Set<string> {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) return sessionFolds.get(view) ?? new Set();
	return new Set(loadViewState(view.app, id).folds.collapsed);
}
```

`toggleFold` writes back through `saveViewState` where there is an identity and into `sessionFolds` where there is not. `setAllFolds` takes the rows so `expand all` can clear exactly this scope's paths rather than every fold the view holds.

The visible rows are computed before drawing — a row is drawn unless any ancestor in the walk is folded:

```ts
/**
 * The rows a fold set leaves on screen, in the same pre-order the walk produced.
 *
 * A row is hidden by an ANCESTOR being folded, never by its own state, so the test is
 * "is any open fold shallower than me still in force" — the same shape `siblingPlaces`
 * uses to close a sibling group, and for the same reason: `rows` carries its own depth
 * and nothing else says who a row's parent was.
 */
function visibleRows(rows: ScopeRow[], folded: ReadonlySet<string>): ScopeRow[] {
	let hiddenBelow: number | null = null;
	return rows.filter((row) => {
		if (hiddenBelow !== null && row.depth > hiddenBelow) return false;
		hiddenBelow = null;
		if (folded.has(row.item.file.path)) hiddenBelow = row.depth;
		return true;
	});
}
```

- [ ] **Step 4: Draw the disclosure and wire the click**

In `drawRow`, before the badge:

```ts
	// Held on a leaf too — `visibility: hidden`, not absent — so a level's titles share
	// one x. `aria-expanded` goes on the ROW, and only where there is something to
	// expand: on a leaf it would announce an interaction that does not exist, which is
	// why `renderScope.ts` had none of it while the tree could not fold at all.
	const twistyEl = rowEl.createEl('button', {
		cls: 'pbl-twisty' + (hasKids ? '' : ' pbl-twisty-leaf'),
		attr: { type: 'button', tabindex: '-1', 'aria-label': t(open ? 'release.scope.collapse' : 'release.scope.expand') },
	});
	if (hasKids) {
		rowEl.setAttribute('aria-expanded', String(open));
		setIcon(twistyEl, open ? 'chevron-down' : 'chevron-right');
		twistyEl.addEventListener('click', (evt) => {
			// The row's own listener would otherwise open the note behind the fold.
			evt.stopPropagation();
			toggleFold(view, row.item.file.path);
		});
	}
```

and on the row itself:

```ts
	rowEl.addEventListener('click', (evt) => view.opener.open(view.openContext(), row.item, evt));
```

`ReleaseView` gains `opener = new OpenController()`, and the open target is **this view's own option** rather than the backlog resolver's. In `src/domain/releaseOptions.ts`, beside the other declarations:

```ts
			{
				key: 'openIn',
				displayName: t('option.openIn'),
				type: 'dropdown',
				default: defaultItemHandling('split').openIn,
				options: openInOptions(),
			},
```

resolved onto `ReleaseSettings.openIn`, and the context built inline where the click is handled — `estimationView.ts:130`'s exact shape:

```ts
	view.opener.open({ app: view.app, viewEl: view.viewEl, settings: { openIn: view.settings.openIn } }, row.item, evt);
```

**Not `resolveSettings(view.config).openIn`.** `releaseView.ts` already states the rule for this boundary: that resolver reads through `propKey` and cannot tell a cleared option from an unset one, so two resolvers disagreeing at one boundary "is the same defect as one view reading another's configuration". The estimation view declares its own for the same reason (`domain/estimationOptions.ts:86`).

Add the option to `declaredPropertyKeys`' sweep only if it is a PROPERTY option — it is not; `openIn` is a dropdown of behaviours, so Task 1's `taken` seed is unaffected. Add an assertion to `test/domain/releaseOptions.test.ts` that the new option carries a `default:`, since an unset dropdown with no default would open nothing.

- [ ] **Step 5: Add the catalog keys**

```ts
	'release.scope.collapse': 'Collapse',
	'release.scope.expand': 'Expand',
```

- [ ] **Step 6: Style the disclosure**

In `styles/release.css`:

```css
/* The disclosure. It holds its gutter on a leaf so a level's titles share one x, and it
   is `visibility` rather than `display` for exactly that: a leaf with no box would let
   its title slide left of its siblings'. */
button.pbl-twisty {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 18px;
	block-size: 18px;
	padding: 0;
	margin: 0;
	color: var(--text-faint);
	background-color: transparent;
	box-shadow: none;
	border: none;
	border-radius: var(--radius-s);
	cursor: pointer;
}

button.pbl-twisty:hover {
	color: var(--text-normal);
	background-color: var(--background-modifier-hover);
}

button.pbl-twisty .svg-icon {
	inline-size: 14px;
	block-size: 14px;
}

button.pbl-twisty-leaf {
	visibility: hidden;
	cursor: default;
}

/* A row is a target again — it opens its note — so the two refusals this file made when
   nothing on the screen was clickable go with them. `user-select` STAYS auto: nothing
   here is dragged, and a screen for reading must let a reader copy a title. */
.pbl-rel-view .pbl-row {
	cursor: pointer;
}

.pbl-rel-view .pbl-row:hover {
	background-color: var(--background-modifier-hover);
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/release/ test/view/releaseNeverEdits.test.ts test/view/releaseTreeExit.test.ts`
Expected: PASS.

- [ ] **Step 8: Watch one invariant fail**

Delete the `evt.stopPropagation()` line, run the click test, see it fail (a fold opens the note), restore it. The comment beside it now has a check under it.

- [ ] **Step 9: Update the register**

In `docs/requirements/The scope of a release as a tree.md`: the note currently SPECIFIES the absence of collapse and selection ("`aria-selected` describes a selection this screen does not have and `aria-expanded` a collapse it does not offer"). Rewrite that paragraph — `aria-expanded` is now carried on a row with children and deliberately absent on a leaf; `aria-selected` stays absent until Task 4 adds the roving selection, and Task 4 updates it again. Name `src/view/release/scopeTree.ts` in `## Where it lives`. Add acceptance criteria: **a folded parent keeps its own rollup**, and **a click on the disclosure does not open the note**.

- [ ] **Step 10: Run the whole gate and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "Let a release's scope fold, and open the note a row names"
```

---

### Task 4: The keyboard tree

Slice A, second half.

**Files:**
- Create: `src/view/release/scopeKeys.ts`
- Modify: `src/view/release/scopeTree.ts` (one tab stop on the container, ids on the rows)
- Modify: `docs/requirements/The scope of a release as a tree.md`
- Test: `test/view/release/scopeKeys.test.ts`

**Interfaces:**
- Produces: `wireScopeKeys(view: ReleaseView, treeEl: HTMLElement, rows: ScopeRow[]): void`.
- Consumes: `foldedPaths`, `toggleFold` from `scopeTree.ts`; `OpenController` via the view.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/scopeKeys.test.ts`:

```ts
describe('the scope tree’s keyboard', () => {
	it('takes ONE tab stop, and the rows take none', () => {
		// A composite widget is one stop with a roving active descendant — `src/view/CLAUDE.md`.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		const tree = view.viewEl.querySelector('.pbl-tree')!;
		expect(tree.getAttribute('tabindex')).toBe('0');
		expect(view.viewEl.querySelectorAll('.pbl-row[tabindex="0"]')).toHaveLength(0);
	});

	it('ArrowDown and ArrowUp move between VISIBLE rows only', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		press(view, 'ArrowDown');
		press(view, 'ArrowDown');
		expect(active(view)).toBe('Passwordless sign-in.md');
		twisty(view, 'Passwordless sign-in.md').click();
		press(view, 'ArrowDown');
		// The three PBIs are folded away, so the next visible row is the next Feature.
		expect(active(view)).toBe('Session handling.md');
	});

	it('ArrowLeft folds an open row and steps out of a closed one', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		select(view, 'Passwordless sign-in.md');
		press(view, 'ArrowLeft');
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('false');
		press(view, 'ArrowLeft');
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('ArrowRight unfolds a closed row and steps in from an open one', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		select(view, 'Passwordless sign-in.md');
		press(view, 'ArrowLeft');
		press(view, 'ArrowRight');
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('true');
		press(view, 'ArrowRight');
		expect(active(view)).toBe('Send the magic link.md');
	});

	it('Enter opens the active row’s note', () => {
		const { view, opened } = mountRelease({ pick: 'Releases/0.8.md' });
		select(view, 'Expire the link.md');
		press(view, 'Enter');
		expect(opened).toEqual(['Expire the link.md']);
	});

	it('ArrowRight on a leaf does nothing at all', () => {
		// Not "moves to the next row": a leaf has nothing to step into, and moving would
		// make Right mean two different things depending on where it landed.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		select(view, 'Send the magic link.md');
		press(view, 'ArrowRight');
		expect(active(view)).toBe('Send the magic link.md');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/release/scopeKeys.test.ts`
Expected: FAIL — the container has no `tabindex`.

- [ ] **Step 3: Write the controller**

Create `src/view/release/scopeKeys.ts`:

```ts
/**
 * The scope tree's keyboard: one tab stop on the container and a roving
 * `aria-activedescendant`, which is what `src/view/CLAUDE.md` requires of a composite
 * widget — a tree whose every row was a stop would take one Tab per item to cross.
 *
 * **Its own controller rather than `view/selection.ts`.** That module is built around a
 * `BacklogViewHost` and the projections' own selection, so reusing it would mean
 * satisfying a host interface in order to withhold most of it — the same call
 * `renderScope.ts` already made about `render/rows.ts`, for the same reason.
 *
 * The row ids are minted per view instance, because two saved views can sit in split
 * panes over the same notes and `aria-activedescendant` resolves a DOCUMENT id.
 */
export function wireScopeKeys(view: ReleaseView, treeEl: HTMLElement, rows: ScopeRow[]): void
```

```ts
export function wireScopeKeys(view: ReleaseView, treeEl: HTMLElement, rows: ScopeRow[]): void {
	const visible = rows;
	let active = 0;
	const show = (): void => {
		const row = visible[active];
		if (row === undefined) return;
		for (const el of treeEl.querySelectorAll('.pbl-row')) el.removeAttribute('aria-selected');
		const el = treeEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(row.item.file.path)}"]`);
		if (el === null) return;
		el.setAttribute('aria-selected', 'true');
		treeEl.setAttribute('aria-activedescendant', el.id);
		// `content-visibility: auto` on a row means a skipped row has no layout box, so a
		// row reached by the keyboard has to be scrolled to rather than assumed visible.
		el.scrollIntoView({ block: 'nearest' });
	};
	const moveTo = (next: number): void => {
		if (next < 0 || next >= visible.length) return;
		active = next;
		show();
	};
	treeEl.addEventListener('keydown', (evt) => {
		const row = visible[active];
		if (row === undefined) return;
		const folded = foldedPaths(view);
		const open = !folded.has(row.item.file.path);
		const hasKids = visible[active + 1]?.depth === row.depth + 1 || folded.has(row.item.file.path);
		switch (evt.key) {
			case 'ArrowDown':
				moveTo(active + 1);
				break;
			case 'ArrowUp':
				moveTo(active - 1);
				break;
			case 'ArrowRight':
				// Step IN, never step NEXT. A leaf has nothing to enter, and moving here
				// would make one key mean two things depending on where it landed.
				if (hasKids && !open) toggleFold(view, row.item.file.path);
				else if (hasKids) moveTo(active + 1);
				else return;
				break;
			case 'ArrowLeft':
				// Fold what is open; only a CLOSED row steps out, to the nearest shallower
				// row above it — which is its parent, since the walk is pre-order.
				if (hasKids && open) toggleFold(view, row.item.file.path);
				else {
					const up = visible.slice(0, active).reduce((found, r, i) => (r.depth < row.depth ? i : found), -1);
					if (up === -1) return;
					moveTo(up);
				}
				break;
			case 'Home':
				moveTo(0);
				break;
			case 'End':
				moveTo(visible.length - 1);
				break;
			case 'Enter':
			case ' ':
				view.opener.open(view.openContext(), row.item, evt);
				break;
			default:
				// Unhandled keys reach the pane — no `preventDefault` on this path.
				return;
		}
		evt.preventDefault();
	});
	treeEl.addEventListener('focus', show);
}
```

`visible` is the row list the tree actually DREW (Task 3's `visibleRows` output), not `scope.rows` — arrowing onto a folded-away row would move the active descendant to an element that is not in the DOM. `renderScope.ts` passes the drawn list.

- [ ] **Step 4: Give the container its stop and the rows their ids**

In `scopeTree.ts`, the tree element gains `tabindex="0"` and each row an `id`. Rows keep no `tabindex` at all — the disclosure's `tabindex="-1"` from Task 3 stays, since it is reachable by the mouse and by the arrow keys rather than by Tab.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 6: Watch one invariant fail**

Change `ArrowRight` on a leaf to move down a row, run that test, see it fail, restore. The rule "Right means step IN, never step NEXT" now has a check under it.

- [ ] **Step 7: Look at it**

Run: `npm run harness -- test/harness/release.ts`, open `?pick=Releases/0.8.md`, then Tab into the tree and drive it with the arrows.
Check: one Tab reaches the tree, the focus ring is on the container until a row is active, and the active row is visible when it is reached.

- [ ] **Step 8: Update the register**

In `docs/requirements/The scope of a release as a tree.md`, the paragraph Task 3 rewrote: `aria-selected` is now carried by the active row. Name `src/view/release/scopeKeys.ts` in `## Where it lives` and state why `view/selection.ts` is not reused. Add an acceptance criterion: **the tree is one tab stop, and Right on a leaf does nothing.**

- [ ] **Step 9: Run the whole gate and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "Drive the release scope from the keyboard, one tab stop deep"
```

---

### Task 5: The scope toolbar, hiding, and the all-done state

Slice C. The one `domain/` addition and the one `storage/` addition.

**Files:**
- Create: `src/view/release/scopeToolbar.ts`
- Modify: `src/domain/releases.ts` (the scope-local completion predicate)
- Modify: `src/storage/viewStateStore.ts` (`ViewPrefs.releaseHideDone` and its reader)
- Modify: `src/view/release/renderScope.ts`, `src/view/release/scopeTree.ts`
- Modify: `src/i18n/en.ts`, `styles/release.css`
- Modify: `docs/requirements/Rollups and hiding finished work.md`, `docs/requirements/The scope of a release as a tree.md`
- Test: `test/domain/releaseScope.test.ts`, `test/storage/viewStateStore.test.ts`, `test/view/release/scopeToolbar.test.ts`

**Interfaces:**
- Produces: `ScopeRow.subtreeDone: boolean` on the existing interface; `drawScopeToolbar(view: ReleaseView, parentEl: HTMLElement, rows: ScopeRow[]): void`.
- Consumes: `setAllFolds` from `scopeTree.ts` (Task 3); `ownWorkflowReading` from `domain/board.ts`.

- [ ] **Step 1: Write the failing domain test**

Add to `test/domain/releaseScope.test.ts`:

```ts
describe('a scope row’s own completion', () => {
	it('is over the release’s MEMBERS, not the model’s descendants', () => {
		// `item.subtreeDone` counts every non-marker descendant the BASE returned and
		// consults no membership at all — so a done member whose only unfinished child is
		// in ANOTHER release would never hide by it. This predicate is why.
		const scope = scopeOf('0.8', {
			'Feature.md': { release: '0.8', status: 'Done' },
			'Child in 0.9.md': { parent: 'Feature', release: '0.9', status: 'Open' },
		});
		expect(rowFor(scope, 'Feature.md').subtreeDone).toBe(true);
	});

	it('is false while any MEMBER below is unfinished', () => {
		const scope = scopeOf('0.8', {
			'Feature.md': { release: '0.8', status: 'Done' },
			'Child.md': { parent: 'Feature', release: '0.8', status: 'Open' },
		});
		expect(rowFor(scope, 'Feature.md').subtreeDone).toBe(false);
	});

	it('reads each member through its OWN workflow', () => {
		const scope = scopeOf('0.8', { 'Deliverable.md': { release: '0.8', deliverableState: 'Shipped' } });
		expect(rowFor(scope, 'Deliverable.md').subtreeDone).toBe(true);
	});

	it('is false on a context row whatever sits below it', () => {
		// A context row is never a source of anything derived from the results, and its own
		// state must not keep a finished subtree on screen or take one off it.
		const scope = scopeOf('0.8', {
			'Epic.md': { status: 'Done' },
			'Member.md': { parent: 'Epic', release: '0.8', status: 'Done' },
		});
		expect(rowFor(scope, 'Epic.md').context).toBe(true);
		expect(rowFor(scope, 'Epic.md').subtreeDone).toBe(true);
	});
});
```

The last case states the rule the implementer must get right: a context row's completion is its MEMBERS' completion, never its own state.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseScope.test.ts`
Expected: FAIL — `subtreeDone` is not on `ScopeRow`.

- [ ] **Step 3: Add the predicate to the scope walk**

In `src/domain/releases.ts`, `ScopeRow` gains the field, and `releaseScope`'s `walk` computes it on the way back up:

```ts
	/**
	 * Whether every MEMBER at or below this row is done — the predicate hiding uses, and
	 * deliberately not `item.subtreeDone`.
	 *
	 * That model field is `item.done && done === count` over every non-marker descendant
	 * the BASE returned, consulting no membership at all, so a done member whose only
	 * unfinished child belongs to another release (or to none) would never hide by it.
	 * This one asks the same question of this release's own population, which is the
	 * population every other figure on this screen is measured over.
	 *
	 * A CONTEXT row answers for its members alone: its own state is not this base's
	 * plan, so it can neither keep a finished subtree on screen nor take an unfinished
	 * one off it — the context-row rule, in the shape `assignAll` already keeps it.
	 */
	subtreeDone: boolean;
```

- [ ] **Step 4: Write the failing storage test**

Add to `test/storage/viewStateStore.test.ts`:

```ts
it('round-trips the release view’s hide-done toggle', () => {
	saveViewState(app, id, { folds: emptyFolds(), prefs: { releaseHideDone: true } });
	expect(loadViewState(app, id).prefs.releaseHideDone).toBe(true);
});

it('discards a hide-done value of the wrong shape', () => {
	// `PREF_READERS` is exhaustive over `ViewPrefs` by TYPE and `readPrefs` writes only the
	// keys it holds, so stored state is read defensively rather than trusted.
	writeRaw(app, id, { prefs: { releaseHideDone: 'yes' } });
	expect(loadViewState(app, id).prefs.releaseHideDone).toBeUndefined();
});

it('writes nothing for the default', () => {
	// `onlyTrue`, storing the NON-default state — `bucketList`'s own documented rule.
	saveViewState(app, id, { folds: emptyFolds(), prefs: { releaseHideDone: false } });
	expect(rawEntry(app, id)?.prefs.releaseHideDone).toBeUndefined();
});
```

- [ ] **Step 5: Add the field and its reader**

In `src/storage/viewStateStore.ts`, in `ViewPrefs`:

```ts
	/**
	 * Whether the release view's scope screen is hiding finished subtrees. The ON state of
	 * a toggle that starts OFF, so a default writes nothing — `bucketList`'s own rule.
	 */
	releaseHideDone?: boolean;
```

and in `PREF_READERS`: `releaseHideDone: onlyTrue,`. The map is declared `{ [K in keyof ViewPrefs]-?: … }`, so omitting the reader is a compile error rather than a silent discard.

- [ ] **Step 6: Write the failing view test**

Create `test/view/release/scopeToolbar.test.ts`:

```ts
describe('the scope toolbar', () => {
	it('collapses and expands every row of THIS scope', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-collapse')!.click();
		expect(view.viewEl.querySelectorAll('.pbl-row')).toHaveLength(1);
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-expand')!.click();
		expect(view.viewEl.querySelectorAll('.pbl-row').length).toBeGreaterThan(1);
	});

	it('hides a finished subtree and leaves the rollups alone', () => {
		const { view } = mountRelease({ pick: 'Releases/0.7.md' });
		const before = row(view, 'Card payments.md').querySelector('.pbl-progress-label')!.textContent;
		hideDone(view).click();
		expect(row(view, 'Card payments.md', { optional: true })).toBeNull();
		hideDone(view).click();
		expect(row(view, 'Card payments.md').querySelector('.pbl-progress-label')!.textContent).toBe(before);
	});

	it('draws the all-done state with its count, never a blank scroller', () => {
		// Extension 4c, and the way back is this toolbar's own toggle beside it.
		const { view } = mountRelease({ pick: 'Releases/0.7.md' });
		hideDone(view).click();
		const done = view.viewEl.querySelector('.pbl-rel-alldone')!;
		expect(done.textContent).toContain('1');
		expect(hideDone(view)).not.toBeNull();
	});

	it('draws a parent whose children all hid as a LEAF', () => {
		// Extension 4a: an expander over nothing is worse than no expander.
		const { view } = mountRelease({ pick: 'Releases/0.5.md' });
		hideDone(view).click();
		const parent = row(view, 'Retention policy.md');
		expect(parent.hasAttribute('aria-expanded')).toBe(false);
	});

	it('withholds the toggle with no plan state key bound', () => {
		// Gated exactly as the `done` figure is: a control that could hide rows the summary
		// refuses to count would put two answers to "what is done here" on one screen.
		const { view } = mountRelease({ pick: 'Releases/0.8.md', stateKey: '' });
		expect(view.viewEl.querySelector('.pbl-rel-hidedone')).toBeNull();
	});

	it('has NO context-rows toggle', () => {
		// Cut by the register: [[The scope of a release as a tree]] extension 3b says a
		// context ancestor is drawn regardless, because hiding it breaks a member's place.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		expect(view.viewEl.textContent).not.toContain('Context rows');
	});
});
```

- [ ] **Step 7: Write the toolbar**

Create `src/view/release/scopeToolbar.ts`:

```ts
/**
 * The scope screen's own toolbar — above the scroller, so it never scrolls away.
 *
 * Three controls and deliberately not four: the context-rows toggle the design started
 * with was cut by [[The scope of a release as a tree]] extension 3b, which says a context
 * ancestor is drawn regardless because hiding it would break a member's place.
 */
export function drawScopeToolbar(view: ReleaseView, parentEl: HTMLElement, rows: ScopeRow[]): void {
	const barEl = parentEl.createDiv({ cls: 'pbl-rel-toolbar' });
	iconBtn(barEl, 'chevrons-down-up', t('release.scope.collapseAll'), 'pbl-rel-collapse', () =>
		setAllFolds(view, rows, true),
	);
	iconBtn(barEl, 'chevrons-up-down', t('release.scope.expandAll'), 'pbl-rel-expand', () =>
		setAllFolds(view, rows, false),
	);
	barEl.createDiv({ cls: 'pbl-rel-spacer' });
	// Gated exactly as `ReleaseRow.done` is — on the PLAN's state key. A control that could
	// hide rows the summary refuses to count would put two answers to "what is done here"
	// on one screen, which is the disagreement this view's one-population rule prevents.
	// The edge that leaves open — a Deliverable readable through its own workflow with no
	// plan key bound — is [[Summing up a release]]'s to answer for every figure at once.
	if (view.backlogSettings.stateKey === '') return;
	const on = hideDoneOn(view);
	const btn = barEl.createEl('button', {
		cls: 'pbl-rel-toggle pbl-rel-hidedone' + (on ? ' pbl-rel-toggle-on' : ''),
		attr: { type: 'button', 'aria-pressed': String(on) },
		text: t('release.scope.hideDone'),
	});
	btn.addEventListener('click', () => setHideDone(view, !on));
}

/** Read and write through the same per-identity entry the pick and the folds use. An
 *  embedded base has no identity, so this is session-only there — `restorePick`'s own
 *  asymmetry, and the same accepted cost. */
export function hideDoneOn(view: ReleaseView): boolean {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) return sessionHideDone.get(view) ?? false;
	return loadViewState(view.app, id).prefs.releaseHideDone === true;
}

function setHideDone(view: ReleaseView, next: boolean): void {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) sessionHideDone.set(view, next);
	else {
		const state = loadViewState(view.app, id);
		// `undefined` for the default rather than `false`: absence IS the off state, and a
		// stored `false` would be a value meaning "none" — `readPrefs`'s own rule.
		saveViewState(view.app, id, {
			...state,
			prefs: { ...state.prefs, releaseHideDone: next ? true : undefined },
		});
	}
	view.render();
}

const sessionHideDone = new WeakMap<ReleaseView, boolean>();

function iconBtn(barEl: HTMLElement, icon: string, label: string, cls: string, run: () => void): void {
	const btn = barEl.createEl('button', {
		cls: `clickable-icon ${cls}`,
		attr: { type: 'button', 'aria-label': label },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	btn.addEventListener('click', run);
}
```

In `scopeTree.ts`, `visibleRows` gains the hide pass: a row is dropped when `hideDone` is on and `row.subtreeDone`, and a parent left with no visible children draws as a leaf. When every root drops, `renderScope.ts` draws the all-done state instead of the tree:

```ts
/**
 * Everything in the release is finished and hidden — extension 4c, drawn rather than
 * left as a blank scroller.
 *
 * `renderAllDoneState` in `render/emptyStates.ts` is NOT reused: it takes a
 * `BacklogViewHost` this view has none of, and its way back is
 * `config.set('showCompleted', true)` — a `.base` setting, where this toggle is
 * deliberately per-device view state (ADR 0011). The way back here is the toolbar's own
 * toggle, which is still on screen above it.
 */
```

- [ ] **Step 8: Add the catalog keys and the styles**

```ts
	'release.scope.collapseAll': 'Collapse all',
	'release.scope.expandAll': 'Expand all',
	'release.scope.hideDone': 'Hide done',
	'release.scope.allDone': 'All {count} items are done.',
```

and in `styles/release.css` the `.pbl-rel-toolbar`, `.pbl-rel-toggle`, `.pbl-rel-toggle-on` and `.pbl-rel-alldone` rules from the harness mock's `SHEET` — the same publication path `styles/release.css`'s own header records for the index's bands.

- [ ] **Step 9: Run every test**

Run: `npx vitest run`
Expected: PASS, `releaseNeverEdits` included.

- [ ] **Step 10: Watch one invariant fail**

Change the scope predicate to `item.subtreeDone`, run `test/domain/releaseScope.test.ts`, see the cross-release case fail, restore.

- [ ] **Step 11: Look at it**

Run: `npm run harness -- test/harness/release.ts`, open `?pick=Releases/0.7.md` and press `Hide done` — the all-done state and the toggle beside it. Check `?theme=light` too.

- [ ] **Step 12: Update the register**

In `docs/requirements/Rollups and hiding finished work.md`, `## Where it lives`: name `src/view/release/scopeToolbar.ts` and `src/view/release/scopeTree.ts`, and state that the release scope hides by its OWN member-scoped predicate rather than `item.subtreeDone`, with the reason. In `The scope of a release as a tree.md`, add the acceptance criterion: **hiding never removes a context ancestor that still holds a visible member**.

- [ ] **Step 13: Run the whole gate and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "Fold, hide and celebrate a finished release scope"
```

---

### Task 6: The changelog, and the live-vault handover

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the `[Unreleased]` entry**

Under `## [Unreleased]`, in the existing style — one line per user-visible change, no module names:

```markdown
### Added

- The release view's detail screen folds, opens notes, and is drivable from the keyboard.
- A release's progress is drawn on its own screen, from the same count the index reports.
- A scope toolbar: collapse all, expand all, and hide finished work.
- A control on the release view for adding the release properties a vault has not bound.
```

- [ ] **Step 2: Run the gate**

Run: `npm run check`
Expected: `test/release/changelogVersion.test.ts` stays green — no version bump here, so no dated section is owed.

- [ ] **Step 3: Build the vault handover**

Run: `npm run test-build`
This bundles into `.obsidian/plugins/<id>/` in the repository root, so this repository can be opened as a vault and `docs/Product Backlog.base` will show the plugin displaying its own register.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Record the release detail work in the changelog"
```

- [ ] **Step 5: Say what is still owed**

In the PR body, state plainly: jsdom computes no layout and no styles, so **appearance, focusability and geometry in a themed vault are unanswered here**. The harness answers layout, spacing and hierarchy on Obsidian's DEFAULT colours only. What needs a live vault: the scope tree's focus ring and `aria-activedescendant` under a real screen reader, the toolbar's fit at a narrow pane, and the summary bar against a themed accent.
