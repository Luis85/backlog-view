# Release detail follow-up — four findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three limitations PR #206 shipped with, plus the index band's silent
progress gap, on top of the branch rather than by reworking it.

**Architecture:** Four independent fixes, one commit each. Two are in `view/release/`
(focus after a disclosure click; a band naming its own progress gap). One is a one-line
policy change in `storage/viewStateStore.ts` (a saturated fold budget drops the OLDEST
keys, not the newest). One relocates the fold-key parsing DOWN a layer into a new
`storage/foldKeys.ts` so a store-level rename walk can migrate release folds without
duplicating that parsing — relocation, not duplication, which is the condition the task
sets for taking it on at all.

**Tech Stack:** TypeScript, Obsidian 1.12.0 API, vitest + jsdom, ESLint layer rules.

## Global Constraints

- `npm run check` (build, lint, coverage-thresholded tests, fallow, docs register) must
  pass before **every** commit. **Run it in the FOREGROUND, one step per call.**
  `npm run test:coverage` takes several minutes; that is normal.
- Coverage thresholds in `vitest.config.mts` only ever go **UP**. If coverage falls, cover
  the code. Lowering one to go green is disqualifying.
- **The release view never edits a note.** `test/view/releaseNeverEdits.test.ts` stays
  green and loses no assertion.
- **One question, one answer.** The index band, the header strip, each row's rollup and the
  Hide-done toggle read one figure — `release.done.unconfigured`, computed once in
  `domain/releases.ts`. A second copy of that predicate anywhere is the defect.
- Layer rule (`eslint.config.mjs` `no-restricted-imports`): `storage/` may not import from
  `view/`. `view/` may import from `storage/`.
- Every module in `src/` must be **specified** in `docs/` — in a use case's
  `## Where it lives` or an ADR's `## Decision`. `scripts/docs-check.mjs` gates it.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run the test, see red, restore.
- Comments explain WHY — the failure prevented, the alternative rejected.
- Sentence-case UI text; every user-visible sentence goes through `src/i18n/en.ts`, never
  a literal at the call site.
- Work on `claude/release-management-ux-74jh80`. Never rebase, squash or amend existing
  commits; add commits on top.

---

### Task 1: A mouse click on a disclosure keeps focus in the tree

**Files:**
- Modify: `src/view/release/releaseView.ts` (the `scopeHadFocus` capture in `render()`, and
  the `focusedControlClass()` docstring that currently calls this "Real, unfixed, and
  outside this increment's scope")
- Modify: `src/view/release/scopeTree.ts` (`drawDisclosure`'s click listener)
- Test: `test/view/release/scopeTree.test.ts`

**Interfaces:**
- Consumes: `ReleaseView.activeScopePath: string | null`, `ReleaseView.scopeHadFocus:
  boolean`, `toggleFold(view, releasePath, path)`, `wireScopeKeys`'s existing restore
  (`scopeKeys.ts`, last block) which focuses `.pbl-tree` and marks `activeScopePath`'s row
  when `view.scopeHadFocus` is true.
- Produces: nothing new. No signature changes.

**Why this shape.** `toggleFold` calls `view.render()`, which `empty()`s `viewEl` and
detaches the focused `.pbl-twisty`. Restoring "the focused control by its stable class"
cannot work here: **every** row's disclosure carries `.pbl-twisty`, so a class-keyed
restore would focus the FIRST disclosure in the tree — worse than the body. Per-row
identity is what is missing, and the tree already has it: `activeScopePath` plus the
restore at the foot of `wireScopeKeys`. So the click names its row and hands focus back to
the composite widget, which is where a keyboard user would be anyway. Do **not** add
`pbl-twisty` to `FOCUS_HANDLE_CLASSES`.

- [ ] **Step 1: Write the failing test**

In `test/view/release/scopeTree.test.ts`, beside the existing fold tests (reuse whatever
`renderScopeFor`/mount helper that file already uses — read the file's own setup first and
follow it; do not invent a second harness):

```ts
it('keeps focus in the tree when a disclosure is clicked with the mouse', () => {
	const { view, root } = mountReleaseScope(); // whatever this file already calls
	const rows = [...root.querySelectorAll<HTMLElement>('.pbl-row')];
	const parent = rows.find((r) => r.hasAttribute('aria-expanded'))!;
	const parentPath = parent.getAttribute('data-path') ?? parent.id; // use this file's own row identity
	const twisty = parent.querySelector<HTMLElement>('button.pbl-twisty')!;

	// A real mouse press focuses the button before the click handler runs; jsdom does not,
	// so the test says so explicitly rather than pretending the click alone did it.
	twisty.focus();
	twisty.click();

	const treeEl = root.querySelector<HTMLElement>('.pbl-tree')!;
	expect(document.activeElement).toBe(treeEl);
	// And on the row that was clicked, not on the first row in the tree.
	expect(treeEl.querySelector('.pbl-row[aria-selected="true"]')).toBe(
		[...root.querySelectorAll<HTMLElement>('.pbl-row')].find((r) => rowPathOf(r) === parentPath),
	);
});
```

Adapt the row-identity helper to whatever the file already uses to map a row element back
to its note path. If the file has no such helper, assert on the row's visible title text
instead — but assert on the CLICKED row specifically, never merely "some row is selected",
which the first-disclosure bug would also satisfy.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/view/release/scopeTree.test.ts -t 'keeps focus in the tree'`
Expected: FAIL — `document.activeElement` is `document.body`.

- [ ] **Step 3: Name the clicked row at the click**

In `src/view/release/scopeTree.ts`, `drawDisclosure`:

```ts
	twisty.addEventListener('click', (evt) => {
		// The row's own listener would otherwise open the note behind the fold.
		evt.stopPropagation();
		// Per-row identity for the redraw's focus restore, set BEFORE the render this
		// call triggers. `render()` cannot work it out afterwards: it identifies a
		// surviving control by a stable class, and every row's disclosure wears
		// `.pbl-twisty`, so a class-keyed restore would land on the FIRST disclosure in
		// the tree rather than this one — worse than the body it currently falls to.
		// `wireScopeKeys`'s own restore reads exactly this field.
		view.activeScopePath = row.item.file.path;
		toggleFold(view, release.path, row.item.file.path);
	});
```

- [ ] **Step 4: Let a control INSIDE the tree count as the tree having focus**

In `src/view/release/releaseView.ts`, `render()`:

```ts
		// `contains`, not `===`: a MOUSE press on a per-row control inside the tree (the
		// disclosure) focuses that button, and the redraw this render is performing is
		// about to detach it. Focus was inside the composite widget, so it belongs back on
		// the composite widget — `wireScopeKeys` puts it on the row `activeScopePath`
		// names. An element contains itself, so the keyboard case (focus ON the tree) is
		// unchanged.
		this.scopeHadFocus = previousEl !== null && previousEl.classList.contains('pbl-tree') && previousEl.contains(document.activeElement);
```

Then rewrite the tail of `focusedControlClass()`'s docstring — it currently states the bug
as unfixed ("this method returns null for it … Real, unfixed, and outside this increment's
scope") and would be a comment stating a rule the code no longer keeps. Say instead that a
per-row control inside the tree is handled by `scopeHadFocus` above, which is why the
twisty is deliberately not a `FOCUS_HANDLE_CLASSES` entry: the tree is the focus target,
not the button.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run test/view/release/scopeTree.test.ts`
Expected: PASS, and every other test in the file still green.

- [ ] **Step 6: Watch it fail without the fix**

Revert Step 3 only (leave Step 4 in place), re-run the test: expect FAIL with focus on the
tree but the wrong row selected. Restore Step 3. Then revert Step 4 only, re-run: expect
FAIL with focus on `document.body`. Restore. Both halves are load-bearing; if either
revert stays green, the test is asserting less than it reads as — fix the test.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "Hand focus back to the tree when a disclosure is clicked"
```

---

### Task 2: A band whose progress cannot be computed says so

**Files:**
- Modify: `src/view/release/renderScope.ts` (export the existing unconfigured sentence)
- Modify: `src/view/release/renderIndex.ts` (`drawProgressLine`, `speakProgress`,
  `absentFigures`, `drawAbsences` and their docstrings)
- Modify: `styles/release.css` (only if the muted-phrase rule needs a second selector)
- Test: `test/view/releaseIndex.test.ts`

**Interfaces:**
- Consumes: `ReleaseRow.done.unconfigured`, `ReleaseRow.members`,
  `ReleaseRow.unconfiguredWorkflows: WorkflowKind[]` (all from `domain/releases.ts`).
- Produces: `export function unconfiguredProgressText(unconfiguredWorkflows:
  WorkflowKind[]): string` — moved from private to exported in
  `src/view/release/renderScope.ts`. Same body, same two catalog keys
  (`release.figureUnconfigured` when the list is empty, `release.scope.progressUnconfigured`
  otherwise).

**Why this shape.** The residual after the last commit is that a band which cannot compute
progress draws no bar, no phrase and no explanation — you learn why by opening that
release. The `rows.every(...)` gate below the list is correct for a GLOBAL statement and
cannot be made to explain one band, so the explanation moves onto the band that owns it and
Progress leaves the absence note entirely. That is one statement, not two: with the band
saying it, a `Progress` entry beneath the list would be the same sentence twice, and the
cross-row `every` predicate — the thing that shipped a bug two sort orders could not agree
on — is deleted rather than kept beside its replacement. The remaining five absent figures
are settings-only, so `AbsentFigure.unconfigured` narrows back to a single row.

The sentence is **the one `renderScope.ts` already draws**, exported rather than re-written:
a second wording here is a second answer to one question, and it would drift on which
workflows `WorkflowKind` names. `renderIndex.ts` importing `renderScope.ts` adds no cycle —
`renderScope.ts` imports `scopeTree`, `scopeToolbar`, `scopeKeys` and `initControl`, and
none of them, nor it, imports `renderIndex.ts`. Confirm that with `npm run analyze` (part of
`npm run check`), which refuses a cycle.

- [ ] **Step 1: Write the failing tests**

In `test/view/releaseIndex.test.ts`, following that file's own fixture helpers (read them
first — it already builds `ReleaseRow`s with configured and unconfigured figures):

```ts
it('names the progress gap on the band that has one, not only beneath the list', () => {
	// Two releases, one computable and one not: the case a list-wide statement cannot make.
	const { root } = renderIndexFor(mixedProgressRows());
	const bands = [...root.querySelectorAll<HTMLElement>('.pbl-rel-band')];
	const silent = bands.find((b) => b.textContent?.includes('Ordinary'))!;
	expect(silent.textContent).toContain('Progress is not configured');
	// The computable band keeps its figure and gains no such sentence.
	const shown = bands.find((b) => b.textContent?.includes('Deliverables'))!;
	expect(shown.querySelector('.pbl-rel-bar')).not.toBeNull();
	expect(shown.textContent).not.toContain('is not configured');
});

it('says it once — on the band, never also in the note beneath the list', () => {
	// EVERY release unconfigured: the case the old `rows.every` gate covered.
	const { root } = renderIndexFor(allUnconfiguredRows());
	const note = root.querySelector('.pbl-rel-note');
	expect(note?.textContent ?? '').not.toContain('Progress');
	for (const band of root.querySelectorAll<HTMLElement>('.pbl-rel-band')) {
		expect(band.textContent).toContain('is not configured');
	}
});

it('speaks the gap in the band accessible name', () => {
	const { root } = renderIndexFor(mixedProgressRows());
	const band = [...root.querySelectorAll<HTMLElement>('.pbl-rel-band')].find((b) =>
		b.textContent?.includes('Ordinary'),
	)!;
	expect(band.getAttribute('aria-label')).toContain('is not configured');
});
```

Use the file's own selector for a band and for the accessible name — read `drawBand` and
`bandLabel` in `src/view/release/renderIndex.ts` and match what they actually produce
rather than the names guessed above. `mixedProgressRows()` must be a release whose members
are all Deliverables with `deliverableStateProperty` bound beside a release of ordinary work
with `stateProperty` cleared — the exact fixture the review comment names.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/view/releaseIndex.test.ts`
Expected: FAIL — the band has no such text, and the note still names Progress.

- [ ] **Step 3: Export the sentence**

In `src/view/release/renderScope.ts`, change `function unconfiguredProgressText` to
`export function unconfiguredProgressText`, and add one line to its docstring saying the
index's own bands call it too, so the two screens cannot describe one release's gap
differently — the same single-answer rule `ReleaseRow.done` states one layer down.

- [ ] **Step 4: Draw and speak it on the band**

In `src/view/release/renderIndex.ts`:

```ts
import { unconfiguredProgressText } from './renderScope';
```

```ts
function drawProgressLine(line2: HTMLElement, row: ReleaseRow): void {
	const noItems = noMembersText(row);
	if (noItems !== null) {
		line2.createSpan({ cls: 'pbl-rel-nomembers', text: noItems });
		return;
	}
	const phrase = progressPhrase(row);
	if (phrase === null) {
		// The one case left: members counted, state not readable for them. Named HERE
		// rather than beneath the list, because it is a fact about THIS release —
		// `done.unconfigured` is `ownWorkflowReading`'s answer over this release's own
		// members, so a neighbouring band can be perfectly computable and a list-wide
		// sentence would be false for one of the two. `members.unconfigured` is the
		// other way round: a setting, true of every band at once, and already named
		// once beneath the list by `drawAbsences`.
		if (!row.members.unconfigured) {
			line2.createSpan({ cls: 'pbl-rel-nomembers', text: unconfiguredProgressText(row.unconfiguredWorkflows) });
		}
		return;
	}
	// ... unchanged from here
}
```

```ts
function speakProgress(row: ReleaseRow): string | null {
	const spoken = noMembersText(row) ?? progressPhrase(row);
	if (spoken !== null) return spoken;
	// The band SHOWS the gap, so the band's own name says it too: a reader who cannot see
	// the strip must not be the only one told nothing about why there is no figure.
	return row.members.unconfigured ? null : unconfiguredProgressText(row.unconfiguredWorkflows);
}
```

If `.pbl-rel-nomembers`'s name misleads for this second use, add the selector to that rule
in `styles/release.css` under a name that covers both (or give the new span its own class
listed beside it) — do not duplicate the declarations.

- [ ] **Step 5: Take Progress out of the note beneath the list**

Delete the `column.rollupProgress` entry from `absentFigures()` and narrow the type back to
one row, since all five survivors are settings-only:

```ts
interface AbsentFigure {
	label: string;
	unconfigured: (row: ReleaseRow) => boolean;
}
```

with `drawAbsences` calling `figure.unconfigured(rows[0])`. Rewrite both docstrings: the
`rows.every` paragraph and the "Progress is the one PER-RELEASE figure" paragraph are now
statements the code does not keep, and the honest replacement is short — every figure named
here is read off the VIEW's settings, every row agrees, and the one per-release figure says
so on its own band instead. Keep the recorded history of why `rows[0]` was wrong for
Progress: it is the reason Progress is not in this list.

- [ ] **Step 6: Run the tests and watch them pass, then watch them fail without the fix**

Run: `npx vitest run test/view/releaseIndex.test.ts`
Expected: PASS. Then revert Step 4's `drawProgressLine` branch only and re-run: expect the
first and second tests to FAIL. Restore.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "Name a release's own progress gap on its band"
```

---

### Task 3: A saturated fold budget drops the OLDEST keys, not the newest

**Files:**
- Modify: `src/storage/viewStateStore.ts` (`readFolds`'s `take`, and `MAX_FOLDS`'s docstring)
- Test: `test/storage/viewStateStore.test.ts`, `test/view/release/scopeTree.test.ts`

**Interfaces:**
- Consumes / Produces: nothing new. `readFolds` keeps its signature; only its truncation
  END changes.

**Why this shape.** `readFolds` spends one `MAX_FOLDS` budget across five lists and takes
`list.slice(0, budget)` — the FIRST entries. Every writer in the codebase appends: the
release view's `writeFolds` puts `others` then `mine`, and `ViewState.flush` writes a Set in
insertion order. So a saturated budget discards exactly the folds just made, and folding
appears to do nothing with no error. Keeping the TAIL inverts that: what is dropped is the
oldest fold in the entry, which is the eviction a backstop is supposed to have. It is one
expression, and it fixes every scope at once — the release view's, the backlog tree's, the
dated axis's and the cards' — rather than teaching one caller to jump the queue, which is
where a per-scope reservation would have led. The ORDER the five lists are taken in is
unchanged and still the rule: collapsed first.

**The trap:** `slice(-0)` is `slice(0)` — the whole array. A zero budget must be spelled as
an early return, or an exhausted budget silently returns everything.

- [ ] **Step 1: Write the failing tests**

In `test/storage/viewStateStore.test.ts` (read its existing `MAX_FOLDS` test first — there
is already one asserting the cap, and it may assert the first-kept order; that assertion is
what this change inverts, so update it in the same edit rather than leaving two rules):

```ts
it('drops the oldest folds when the budget is full, never the newest', () => {
	const collapsed = Array.from({ length: 12002 }, (_, i) => `note-${i}.md`);
	saveViewState(app, identity, { folds: { ...emptyFolds, collapsed }, prefs: {} });

	const back = loadViewState(app, identity).folds.collapsed;
	expect(back).toHaveLength(12000);
	// The two APPENDED last survive; the two written first are what goes.
	expect(back).toContain('note-12001.md');
	expect(back).toContain('note-12000.md');
	expect(back).not.toContain('note-0.md');
});

it('gives an exhausted budget nothing, rather than the whole list', () => {
	// `collapsed` alone fills the budget, so `expanded` must come back empty — the
	// `slice(-0) === slice(0)` trap, which would return every expanded key instead.
	const collapsed = Array.from({ length: 12000 }, (_, i) => `c-${i}.md`);
	saveViewState(app, identity, { folds: { ...emptyFolds, collapsed, expanded: ['e.md'] }, prefs: {} });

	expect(loadViewState(app, identity).folds.expanded).toEqual([]);
});
```

Adapt `saveViewState`/`loadViewState`'s exact call shape and the `emptyFolds` fixture to
what that file already uses.

And in `test/view/release/scopeTree.test.ts`, the user-visible claim — the store test alone
proves the policy, not that the release view benefits from it:

```ts
it('keeps a fold made while the budget is already full', () => {
	// Another view's scopes have already spent the whole budget.
	primeCollapsed(Array.from({ length: 12000 }, (_, i) => `\u0000card:old-${i}.md`));
	const { view, root } = mountReleaseScope();

	root.querySelector<HTMLElement>('.pbl-row[aria-expanded="true"] button.pbl-twisty')!.click();

	expect(foldedPaths(view, releasePath)).toContain(memberPath);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/storage/viewStateStore.test.ts test/view/release/scopeTree.test.ts`
Expected: FAIL — the newest keys are missing, `expanded` comes back with its entry, and the
release fold does not survive.

- [ ] **Step 3: Keep the tail**

In `src/storage/viewStateStore.ts`:

```ts
	const take = (value: unknown): string[] => {
		const list = texts(value);
		// The NEWEST keys, not the first ones. Every writer here APPENDS — the release
		// view's `writeFolds` puts the other releases' keys before this one's, and
		// `ViewState.flush` writes a Set in insertion order — so taking the head made a
		// saturated budget discard exactly the fold just made, and folding a row appeared
		// to do nothing with nothing reporting it. Dropping the oldest is the eviction a
		// backstop is for.
		//
		// `budget <= 0` is spelled out rather than left to `slice`: `slice(-0)` is
		// `slice(0)`, which returns the WHOLE list, so an exhausted budget would hand back
		// everything it exists to refuse.
		if (budget <= 0) return [];
		const kept = list.slice(-budget);
		budget -= kept.length;
		return kept;
	};
```

- [ ] **Step 4: Update the `MAX_FOLDS` docstring**

Its paragraph says collapsed keys are "kept first" and explains the ORDER of the lists.
That is still true of the list order and no longer true of the WITHIN-list end. Say both:
the lists are still spent in this order, and within a list what survives is the most recent.

- [ ] **Step 5: Run the tests and watch them pass, then watch them fail without the fix**

Run: `npx vitest run test/storage/viewStateStore.test.ts test/view/release/scopeTree.test.ts`
Expected: PASS. Revert Step 3 to `list.slice(0, budget)` and re-run: all three FAIL.
Restore.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "Drop the oldest folds when the budget is full, not the newest"
```

---

### Task 4: A rename carries a release's folds

**Files:**
- Create: `src/storage/foldKeys.ts`
- Modify: `src/view/viewState.ts` (import the parsing rather than define it; re-export the
  three prefixes so its eight consumers are untouched; call `movedFoldKey` in `renamePath`)
- Modify: `src/storage/viewStateStore.ts` (add `renamePathFolds`)
- Modify: `src/main.ts` (wire it beside `renamePathPrefs`)
- Modify: `docs/requirements/Collapse persistence.md` (`## Where it lives` must name the new
  module — `scripts/docs-check.mjs` rule 7 fails the build otherwise)
- Test: `test/storage/viewStateStore.test.ts`, `test/view/release/scopeTree.test.ts`

**Interfaces:**
- Produces, in `src/storage/foldKeys.ts`:
  - `export const TIMELINE_SCOPE = '\u0000timeline:'`
  - `export const CARD_SCOPE = '\u0000card:'`
  - `export const RELEASE_FOLD = '\u0000release:'`
  - `export function notePath(key: string): string`
  - `export function scopeOf(key: string): string`
  - `export function movedFoldKey(key: string, oldPath: string, newPath: string): string | null`
- Produces, in `src/storage/viewStateStore.ts`:
  - `export function renamePathFolds(app: App, oldPath: string, newPath: string): void`
- `src/view/viewState.ts` re-exports the three constants
  (`export { TIMELINE_SCOPE, CARD_SCOPE, RELEASE_FOLD } from '../storage/foldKeys';`) so
  `backlogView.ts`, `host.ts`, `interactions/menu.ts`, `render/toolbar.ts`,
  `render/toolbarControls.ts`, `release/scopeTree.ts` and the three test files that import
  them from there keep working unchanged.

**Why this shape — and why it is allowed.** The PR states the limitation as "fixing it means
duplicating `notePath`/`scopeOf` into `storage/`, where the layer rule forbids reaching up to
`view/`". The rule the layers state is about the DIRECTION of an import, and these two
functions are pure string arithmetic over a stored key shape with no view dependency at all
— so the answer is not to copy them down but to MOVE them down, to the layer whose format
they describe, and let `view/` import them upward as it already imports `movedPath` from
`storage/viewIdentity.ts`. Relocation is not duplication: after this there is still exactly
one `notePath` in the tree. The requirement this closes is not cosmetic —
`docs/requirements/Collapse persistence.md`'s acceptance criteria say "Renaming a note, a
view or a base migrates the state rather than orphaning it", which release folds do not do
today.

`movedFoldKey` is one function with two callers by design. `ViewState.renamePath`'s loop is
already `scopeOf(key) + movedPath(notePath(key), …)`, so it becomes a call to the same
helper — and gains the half it was missing: a release-fold key carries TWO paths, and
renaming the RELEASE note has to move the key's first half, which the old expression never
touched.

`renamePathFolds` is a second exported walk beside `renamePathPrefs` rather than an
extension of it: `renamePathPrefs` is named in an ADR and in three register notes, and
renaming a symbol across those to save one map read on an event that fires when a human
renames a file is not a trade worth making.

**In scope:** the `collapsed` and `expanded` lists. **Out of scope, and say so in the
code:** `collapsedColumns`/`expandedColumns` also carry an iteration note path
(`movedColumnKey`), and stored entries for views that are not loaded have the same
staleness there. That is pre-existing, older than this branch, and belongs to whoever picks
up the iteration board — do not widen this task into it.

- [ ] **Step 1: Write the failing tests**

In `test/view/release/scopeTree.test.ts`:

```ts
it('carries a member fold through a rename of that member', () => {
	const { view } = mountReleaseScope();
	toggleFold(view, releasePath, 'Backlog/Feature A.md');

	renamePathFolds(app, 'Backlog/Feature A.md', 'Backlog/Feature A renamed.md');

	expect([...foldedPaths(view, releasePath)]).toEqual(['Backlog/Feature A renamed.md']);
});

it('carries a member fold through a rename of the RELEASE it belongs to', () => {
	const { view } = mountReleaseScope();
	toggleFold(view, releasePath, 'Backlog/Feature A.md');

	renamePathFolds(app, releasePath, 'Releases/0.9 renamed.md');

	// Read under the release's NEW path: the key's first half moved with it.
	expect([...foldedPaths(view, 'Releases/0.9 renamed.md')]).toEqual(['Backlog/Feature A.md']);
});

it('carries a folder rename to every member beneath it', () => {
	const { view } = mountReleaseScope();
	toggleFold(view, releasePath, 'Backlog/Feature A.md');

	renamePathFolds(app, 'Backlog', 'Work');

	expect([...foldedPaths(view, releasePath)]).toEqual(['Work/Feature A.md']);
});
```

And in `test/storage/viewStateStore.test.ts`, that the backlog's own scoped keys go through
the same walk and a bare tree key does too:

```ts
it('renames every fold key shape a stored entry can hold', () => {
	saveViewState(app, identity, {
		folds: { ...emptyFolds, collapsed: ['a.md', '\u0000card:a.md', '\u0000timeline:a.md'] },
		prefs: {},
	});

	renamePathFolds(app, 'a.md', 'b.md');

	expect(loadViewState(app, identity).folds.collapsed).toEqual(['b.md', '\u0000card:b.md', '\u0000timeline:b.md']);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/view/release/scopeTree.test.ts test/storage/viewStateStore.test.ts`
Expected: FAIL — `renamePathFolds` is not exported by `storage/viewStateStore.ts`.

- [ ] **Step 3: Create `src/storage/foldKeys.ts`**

Move — do not copy — the three prefix constants and `notePath`/`scopeOf` out of
`src/view/viewState.ts`, **with their existing docstrings**, and add `movedFoldKey`:

```ts
import { movedPath } from './viewIdentity';

/**
 * The SHAPE of a stored fold key, in the layer that stores it.
 *
 * These lived in `view/viewState.ts` until a rename walk needed them: `renamePathFolds`
 * (`viewStateStore.ts`) has to migrate a release view's folds, and that view holds no
 * `ViewStateController` to do it in memory — it reads and writes `folds.collapsed`
 * directly. `storage/` may not import `view/`, and copying the parsing down would have put
 * one rule in two places for the duplication gate to find. Moving it down instead leaves
 * exactly one `notePath` in the tree, in the layer whose FORMAT it describes; `view/`
 * imports it upward the same way it already imports `movedPath` from `viewIdentity.ts`.
 * `view/viewState.ts` re-exports the three prefixes, so nothing that names them had to move.
 */
```

```ts
/**
 * The same key with every note path it carries moved — or null for a key this rename does
 * not touch.
 *
 * A release-fold key carries TWO paths, the release and the member, and either can be the
 * thing renamed: `ViewState.renamePath`'s old expression asked only about the member, so
 * renaming the release note itself stranded every fold in its scope under a path no reader
 * would ever ask for again. `movedPath` matches the path itself OR its `oldPath/` prefix,
 * so a folder rename carries everything beneath it — the event names the folder and never
 * the notes in it.
 */
export function movedFoldKey(key: string, oldPath: string, newPath: string): string | null {
	if (key.startsWith(RELEASE_FOLD)) {
		const cut = key.lastIndexOf('\u0000');
		const release = key.slice(RELEASE_FOLD.length, cut);
		const member = key.slice(cut + 1);
		const movedRelease = movedPath(release, oldPath, newPath) ?? release;
		const movedMember = movedPath(member, oldPath, newPath) ?? member;
		if (movedRelease === release && movedMember === member) return null;
		return `${RELEASE_FOLD}${movedRelease}\u0000${movedMember}`;
	}
	const moved = movedPath(notePath(key), oldPath, newPath);
	return moved === null ? null : scopeOf(key) + moved;
}
```

- [ ] **Step 4: Point `view/viewState.ts` at it**

Replace the moved definitions with:

```ts
import { movedFoldKey, notePath, scopeOf } from '../storage/foldKeys';

// Re-exported rather than moved at every call site: eight modules and three suites name
// these prefixes from here, and the constants did not change — only which layer defines
// them. See `storage/foldKeys.ts` for why that layer is the right one.
export { CARD_SCOPE, RELEASE_FOLD, TIMELINE_SCOPE } from '../storage/foldKeys';
```

and use `movedFoldKey` in `renamePath`'s loop:

```ts
		for (const key of [...this.settled]) {
			// One helper with `renamePathFolds`, not a second spelling of the same
			// arithmetic: this walk covers the LOADED view's in-memory copy, which `flush`
			// writes back wholesale, and the store's walk covers every stored entry — the
			// same pair `renameScoped` and `renamePathPrefs` already form for the prefs.
			const next = movedFoldKey(key, oldPath, newPath);
			if (next === null) continue;
			this.settled.delete(key);
			this.settled.add(next);
			if (this.collapsed.delete(key)) this.collapsed.add(next);
			changed = true;
		}
```

Keep the existing comment about a folder rename carrying every row beneath it — move it to
whichever of the two places still states the rule, rather than dropping it.

- [ ] **Step 5: Add the store-level walk**

In `src/storage/viewStateStore.ts`, beside `renamePathPrefs`:

```ts
/**
 * Carry every stored fold key through a rename — the folds half of what
 * {@link renamePathPrefs} does for the two path-valued preferences, wired to the same
 * `vault.on('rename')` at the plugin.
 *
 * It exists because one view has no in-memory copy for `ViewState.renamePath` to migrate:
 * the release view reads and writes `folds.collapsed` through this module directly, so
 * without this walk a renamed member (or a renamed release) reopened its row —
 * `docs/requirements/Collapse persistence.md`'s "renaming a note migrates the state rather
 * than orphaning it" was false for exactly that view. For the backlog view this is not a
 * duplicate of `ViewState.renamePath` for the same reason `renamePathPrefs` is not a
 * duplicate of `renameScoped`: that one covers the loaded view, whose flush would put a
 * stale key straight back, and this one covers every OTHER stored entry.
 *
 * `collapsed` and `expanded` only. `collapsedColumns`/`expandedColumns` carry an iteration
 * note path too and have the same staleness in stored entries — older than this walk, and
 * the iteration board's own to fix, since `movedColumnKey` lives with the board's key
 * shape rather than here.
 */
export function renamePathFolds(app: App, oldPath: string, newPath: string): void {
	const map = readMap(app);
	let moved = false;
	for (const entry of Object.values(map)) {
		for (const list of ['collapsed', 'expanded'] as const) {
			entry.folds[list] = entry.folds[list].map((key) => {
				const next = movedFoldKey(key, oldPath, newPath);
				if (next === null) return key;
				moved = true;
				return next;
			});
		}
	}
	if (moved) writeMap(app, map);
}
```

- [ ] **Step 6: Wire it**

In `src/main.ts`, call `renamePathFolds(this.app, file.path, oldPath)` wherever
`renamePathPrefs` is called — read that call site and match its argument order exactly
(Obsidian's rename event hands the NEW file and the OLD path, so the order is easy to get
backwards; the existing call is the reference).

- [ ] **Step 7: Register the new module**

Add `src/storage/foldKeys.ts` to `## Where it lives` in
`docs/requirements/Collapse persistence.md`, with a clause saying what it is for (the shape
of a stored fold key, and the rename arithmetic both the loaded view and the store walk
run). Then extend that note's extension 3a or its acceptance criteria to say the migration
covers a release's folds, since the branch's own spec currently records the opposite.

- [ ] **Step 8: Run the tests and watch them pass, then watch them fail without the fix**

Run: `npx vitest run test/view/release/scopeTree.test.ts test/storage/viewStateStore.test.ts`
Expected: PASS. Then revert Step 5's body to a no-op and re-run: the three scopeTree tests
and the store test FAIL. Restore. Then, separately, revert only the `RELEASE_FOLD` branch of
`movedFoldKey` and re-run: the release-rename test FAILS while the member-rename one still
passes — if it does not, that test is not reaching the half it names.

- [ ] **Step 9: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "Carry a release's folds through a rename, from the layer that stores them"
```

---

### Task 5: Say what changed

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]`)
- Modify: `docs/superpowers/specs/2026-08-28-release-detail-ux-design.md` and
  `docs/superpowers/plans/2026-08-28-release-detail-ux.md` — both record the three
  limitations as accepted, and two of the three are no longer true
- Modify: the PR body (`Known limitations` becomes what actually remains)

- [ ] **Step 1: Amend the spec and plan**

Every sentence in those two documents that states a limitation this pass closed is now a
comment stating a rule the code does not keep — the exact defect the branch's own review
found four times. For each: say what it is now, and keep the reason the original decision
was made where that reason is still the interesting part (the layer question in Task 4 is,
because the answer was to move the parsing rather than duplicate it, and the next person
facing a `storage/` ↔ `view/` question should find that).

- [ ] **Step 2: Add the changelog entries**

Under `## [Unreleased]`, in `### Fixed` (create it if it is absent), one entry per fix,
written for someone deciding whether to upgrade rather than for a reviewer — what they will
notice, not which function changed.

- [ ] **Step 3: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "Say what the follow-up pass fixed, and stop recording it as a limitation"
```

- [ ] **Step 4: Push and update the PR body**

```bash
git push -u origin claude/release-management-ux-74jh80
```

Then rewrite the PR's **Known limitations** section to what is left, and add a short
paragraph naming the four findings this pass closed. The live-vault check stays owed and
stays unticked.

---

## Still owed, and not something this plan can do

A live-vault check, which the PR already promises in writing. `npm run test-build` bundles
into `.obsidian/plugins/product-backlog-view` so this repository can be opened as a vault.
Unverified here and to be reported as unverified, never as passing: the scope tree's focus
ring and `aria-activedescendant` under a real screen reader; `button.pbl-twisty` and
`button.pbl-rel-toggle` against a THEMED vault's own button rules (they win on source
order, which a higher-specificity theme rule would beat); and the toolbar's fit at a narrow
pane. Task 1 adds a focus move a screen reader will announce, so it joins that list rather
than shortening it.
