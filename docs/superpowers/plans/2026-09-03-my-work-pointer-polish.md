# My work: the pointer, and five pieces of polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A click in a scope tree marks the row it opens, and the my-work view gains a pointer path to its row menu, an open-note marker, a press for a roster of one, and two reading fixes.

**Architecture:** Six small changes over existing modules — no new module, no new write path, no new stored view state. The pointer fix lands in the SHARED `src/view/scopeKeys.ts` and so reaches both scope trees at once; everything else is my-work's own (`src/view/mywork/`, `styles/mywork.css`), except the context-row emphasis, which is applied to `styles/releaseScope.css` in the same shape so the two trees do not drift.

**Tech Stack:** TypeScript, Obsidian 1.12.0 API (pinned exactly), vitest + jsdom, plain CSS partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-03-my-work-pointer-polish-design.md`

## Global Constraints

- Read `CLAUDE.md`, `src/view/CLAUDE.md` and `test/CLAUDE.md` before the first edit. They are binding.
- `npm test` is the inner loop. `npm run check` runs before each commit (build + both typechecks + lint + markdown + coverage-thresholded tests + fallow + docs register). All seven must pass.
- One file per concern, 400-line lint cap in `src/`, 450 in `test/`, 400 per CSS partial.
- Layers: `main → commands → view → storage → domain`, `ui/` and `i18n/` are leaves. Enforced by `no-restricted-imports`.
- **Every user-visible string goes through `t()`** with a key added to `src/i18n/en.ts`. `view/` is a swept directory: an English literal at a setter, at `new Notice`, at a `setTooltip`, or in one of the thirteen banned option-bag properties (`text`, `label`, `title`, `aria-label`, …) fails lint.
- Do not edit the key-count paragraph in `CLAUDE.md`. It is dated 2026-09-03 and is only re-measured on a merged tree.
- Never query `treeEl` for rows (`TREE_SCAN` lint ban) — reach a row through the draw's `rowEls` index or through `.closest()` from an event target.
- Never write frontmatter outside `storage/`. Nothing in this plan writes at all.
- Commit messages end with the two attribution lines used on this branch (`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` and the `Claude-Session:` line). Copy them from `git log -1 --format=%B` on this branch.
- Branch: `claude/my-work-ux-improvements-b6bd7b`. Push with `git push -u origin claude/my-work-ux-improvements-b6bd7b`.

---

## File Structure

| File | Responsibility in this change |
| --- | --- |
| `src/view/scopeKeys.ts` | Task 1 — the pointer moves the roving selection (both scope trees). |
| `src/view/scopeRow.ts` | Task 2 — one control guard for both open gestures, replacing the `.pbl-twisty`-only auxclick guard. |
| `src/view/mywork/renderTree.ts` | Task 2 — the `⋯` row menu button. Task 5 — publishes the drawn Next row element. |
| `src/view/mywork/myWorkView.ts` | Task 3 — `watchApp`/`syncOpenRow` and the kept draw. Task 4 — the solo-roster press. Task 5 — Next into view on a person change. Task 6 — the loading shell. |
| `styles/mywork.css` | Tasks 2, 3, 6 — the button's reveal, the open marker, the context emphasis. |
| `styles/releaseScope.css` | Task 6 — the identical context emphasis. |
| `src/i18n/en.ts` | Tasks 2 and 4 — two new keys. |
| `test/helpers/vault.ts` | Task 3 — `getActiveFile`, `file-open` handlers, `openNote()`. |
| `test/helpers/mywork.ts` | Task 2 — `mwMenuButton` accessor. |
| `test/view/mywork/*.test.ts`, `test/view/release/scopeKeys.test.ts` | The checks. |
| `docs/requirements/The tree answers the pointer.md` | Task 7 — the register's own record. |
| `CHANGELOG.md` | Task 7 — the `[Unreleased]` entry. |

---

### Task 1: The pointer moves the roving selection

**Files:**
- Modify: `src/view/scopeKeys.ts` (inside `wireScopeKeys`, beside the existing `treeEl.addEventListener('focus', show)`)
- Test: `test/view/mywork/keys.test.ts`, `test/view/release/scopeKeys.test.ts`

**Interfaces:**
- Consumes: `wireScopeKeys(host, treeEl, scope, draw)` and its closure — `rows: ScopeRow[]`, `rowEls: ReadonlyMap<string, HTMLElement>`, `moveTo(next: number)`, `show()` — all already in that function.
- Produces: nothing new. The behaviour later tasks rely on is that a `mousedown` inside a row sets `aria-selected`/`.pbl-selected` on THAT row and writes `host.activeRowFile`.

- [ ] **Step 1: Write the failing test (my work)**

Append to `test/view/mywork/keys.test.ts`, inside the existing `describe`:

```ts
	it('marks the row a click lands on, not the row the keyboard left behind', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

		expect(mwActive(view)).toBe('PBI Ada.md');
		expect(view.activeRowFile?.path).toBe('PBI Ada.md');
	});

	it('leaves the clicked row marked when the click focuses the tree', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		// The browser's own order: `mousedown`, then focus lands on the tree (one tab
		// stop, so the nearest focusable ancestor takes it), then `click`. jsdom does
		// neither the focus nor the click for us, so the focus is dispatched by hand —
		// it is the event whose listener used to repaint row 0 and scroll to the top.
		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		treeEl(view).dispatchEvent(new FocusEvent('focus'));

		expect(mwActive(view)).toBe('PBI Ada.md');
	});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/mywork/keys.test.ts -t 'marks the row a click'`
Expected: FAIL — `mwActive(view)` is `null` (nothing has marked a row) on the first, and `'Epic.md'` (row 0, marked by the focus listener) on the second.

- [ ] **Step 3: Write the implementation**

In `src/view/scopeKeys.ts`, immediately BEFORE the existing `treeEl.addEventListener('focus', show);` line:

```ts
	/**
	 * The POINTER's own route into the same roving selection — `render/rows.ts`'s
	 * `host.selectItem(item, false)` on the backlog tree's own click, owed here and
	 * missing from BOTH scope trees until now: a click opened one note and marked
	 * another.
	 *
	 * `mousedown` rather than `click`, and that is the whole of the fix rather than an
	 * incidental choice. Clicking a row focuses `treeEl` — the tree is one tab stop, so
	 * the browser gives focus to the nearest focusable ancestor — and the `focus`
	 * listener below runs `show()` over whatever `active` still names, which is row 0
	 * until a key has moved it. Focus lands BETWEEN `mousedown` and `click`, so a
	 * correction wired on `click` arrives after the wrong row has been painted and
	 * `scrollIntoView` has taken the pane back to the top.
	 *
	 * `show()`'s own `scrollIntoView({ block: 'nearest' })` is left in place on this path
	 * rather than parameterised away: `nearest` moves nothing for a row already fully in
	 * view, and a row the reader clicked while it was half cut off is one they meant to
	 * act on.
	 *
	 * A `mousedown` on a control INSIDE the row (the disclosure, the row menu button) is
	 * deliberately not excluded — both act on that row, so marking it is right.
	 */
	treeEl.addEventListener('mousedown', (evt) => {
		// Asserted rather than tested, `renderTree.ts`'s own reason for the identical
		// lookup: this listener is on `treeEl`, so a dispatched event always reports an
		// element under it.
		const rowEl = (evt.target as Element).closest('.pbl-row');
		const at = rows.findIndex((r) => rowEls.get(r.item.file.path) === rowEl);
		// `-1` is a click on the tree's own padding, between rows: it marks nothing,
		// rather than moving the selection somewhere the reader did not point at.
		if (at !== -1) moveTo(at);
	});
```

- [ ] **Step 4: Run the my-work test and watch it pass**

Run: `npx vitest run test/view/mywork/keys.test.ts`
Expected: PASS, the whole file.

- [ ] **Step 5: Write the release-tree test — one fix, two trees**

Append to `test/view/release/scopeKeys.test.ts`, inside its existing `describe`, using that file's own helpers (`makeReleaseView` / whatever mount helper the file already uses at the top of its other cases — copy the arrange lines from the test directly above yours, and use `row(view, <path>)` and `active(view)` from `test/helpers/release.ts`):

```ts
	it('marks the row a click lands on', () => {
		// Arrange exactly as the test above this one does, then:
		row(view, <the path of a row below the first>).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

		expect(active(view)).toBe(<that same path>);
	});
```

Replace the two placeholders with the fixture's own paths — read the file's other cases for the tree it mounts. Do not invent a fixture: this test exists to show the SHARED mechanism reaches the second tree, not to re-litigate it.

- [ ] **Step 6: Run both suites**

Run: `npx vitest run test/view/mywork/keys.test.ts test/view/release/scopeKeys.test.ts`
Expected: PASS.

- [ ] **Step 7: Watch the fix fail without the code**

Comment out the `mousedown` listener, run the four cases, see them red, restore it. `CLAUDE.md` requires the test be WATCHED failing — a passing test proves nothing about what it asserts until it has been seen red.

- [ ] **Step 8: Gate and commit**

```bash
npm run check
git add src/view/scopeKeys.ts test/view/mywork/keys.test.ts test/view/release/scopeKeys.test.ts
git commit
```

Message: `A click marks the row it opens, in both scope trees` and a body naming the focus-between-events reason.

---

### Task 2: A pointer path to the row menu

**Files:**
- Modify: `src/view/mywork/renderTree.ts` (a new `drawRowMenuButton`, called from `drawRow`)
- Modify: `src/view/scopeRow.ts` (one control guard for both gestures)
- Modify: `src/i18n/en.ts` (one key)
- Modify: `styles/mywork.css`
- Modify: `test/helpers/mywork.ts` (one accessor)
- Test: `test/view/mywork/writes.test.ts`, `test/view/mywork/narrow.test.ts`

**Interfaces:**
- Consumes: `showMyWorkRowMenu(view: MyWorkView, row: ScopeRow, evt: MouseEvent)` from `./rowMenu`, already imported by `renderTree.ts`.
- Produces: `.pbl-mw-menu` — a `<button>` in every row; `mwMenuButton(view, path): HTMLElement` in `test/helpers/mywork.ts`.

- [ ] **Step 1: Add the catalog key**

In `src/i18n/en.ts`, in the Task 9 row-menu block (beside `'mywork.menu.open'`), add:

```ts
	/** The row's own menu button (`view/mywork/renderTree.ts`) — the pointer's way into
	 *  the menu the right-click and the Menu key already build. */
	'mywork.rowMenu': 'Actions',
```

- [ ] **Step 2: Write the failing test**

In `test/helpers/mywork.ts`, add beside `mwTwisty`:

```ts
/** The row menu button on one row — never optional, because every row draws one. */
export function mwMenuButton(view: MyWorkView, path: string): HTMLElement {
	const el = mwRow(view, path)?.querySelector<HTMLElement>('.pbl-mw-menu');
	if (!el) throw new Error(`row menu button not found: ${path}`);
	return el;
}
```

In `test/view/mywork/writes.test.ts`, add to the existing `describe` (its `menuOn`, `labels` and `choose` helpers are already at the top of that file; add `mwMenuButton` to its import from `../../helpers/mywork`):

```ts
	it('opens the SAME menu from the row’s own button as from a right-click', () => {
		const { view } = makeMyWorkView(myWorkVault(), { stateProperty: 'note.state' });
		view.pick('People/Ada.md');

		menuOn(view, 'PBI Ada.md');
		const fromRightClick = labels(Menu.lastShown);

		mwMenuButton(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(labels(Menu.lastShown)).toEqual(fromRightClick);
	});

	it('does not open the note when the menu button is pressed', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwMenuButton(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(vault.opened).toHaveLength(0);
	});

	it('draws the button on a context row too — the menu there is the two Opens', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwMenuButton(view, 'Epic.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(labels(Menu.lastShown)).toEqual([t('mywork.menu.open'), t('mywork.menu.openTab')]);
	});
```

- [ ] **Step 3: Run and watch it fail**

Run: `npx vitest run test/view/mywork/writes.test.ts`
Expected: FAIL — `row menu button not found: PBI Ada.md`.

- [ ] **Step 4: Draw the button**

In `src/view/mywork/renderTree.ts`, in `drawRow`, after the `drawScopeStateChip(...)` line and before the `return rowEl;`:

```ts
	drawRowMenuButton(view, rowEl, row);
```

and, at the end of the module:

```ts
/**
 * The POINTER's own way into the row menu — the same menu `showMyWorkRowMenu` builds for
 * a right-click and for the Menu key, on a control that can be seen and can be tapped.
 * Set state was reachable by right-click and Shift+F10 alone until now, which is no route
 * at all on a touch device and no hint anywhere that the menu exists.
 *
 * Drawn on EVERY row, context rows included: the menu itself is what withholds Set state
 * there (`rowMenu.ts`), and Open and Open in a new tab are offered on a context row on
 * purpose — reading a note is not a write.
 *
 * `tabindex="-1"` because the tree is one tab stop (`src/view/CLAUDE.md`), and the
 * keyboard already reaches the identical menu through ContextMenu / Shift+F10.
 *
 * The click does NOT need `stopPropagation`: `wireRowOpen` (`view/scopeRow.ts`) asks
 * whether the event began on a control in the row, which is the receiver-side question
 * `render/rows.ts`'s own `fromRowControl` records the reason for — ten per-control
 * `stopPropagation` guards, each new control having to remember an eleventh, and two that
 * did not.
 */
function drawRowMenuButton(view: MyWorkView, rowEl: HTMLElement, row: ScopeRow): void {
	const btnEl = rowEl.createEl('button', {
		cls: 'pbl-mw-menu',
		attr: { type: 'button', tabindex: '-1', 'aria-label': t('mywork.rowMenu') },
	});
	setIcon(btnEl, 'ellipsis');
	setTooltip(btnEl, t('mywork.rowMenu'));
	btnEl.addEventListener('click', (evt) => showMyWorkRowMenu(view, row, evt));
}
```

- [ ] **Step 5: Move the open gestures' guard to the receiver**

In `src/view/scopeRow.ts`, inside `wireRowOpen`, replace the two listeners' bodies so both ask ONE question:

```ts
export function wireRowOpen(view: RowOpener, rowEl: HTMLElement, row: ScopeRow): void {
	// One question, asked by BOTH gestures: did this event begin on a control inside the
	// row rather than on the row? `render/rows.ts`'s own `fromRowControl` records what the
	// alternative costs — a `stopPropagation` per control, ten of them accumulated, and
	// each new control having to remember an eleventh. `button` is the whole selector
	// because every control either tree draws inside a row is one: the disclosure
	// (`.pbl-twisty`) and, since the my-work tree grew one, the row menu button
	// (`.pbl-mw-menu`). Naming those two classes here would put one tree's vocabulary in
	// the module the other shares.
	const fromControl = (evt: Event): boolean => evt.target instanceof Element && evt.target.closest('button') !== null;
	rowEl.addEventListener('click', (evt) => {
		if (fromControl(evt)) return;
		if (window.getSelection()?.isCollapsed === false) return;
		view.opener.open(view.openContext(), row.item, evt);
	});
	rowEl.addEventListener('auxclick', (evt) => {
		if (evt.button !== 1) return;
		if (fromControl(evt)) return;
		view.opener.openIn(view.openContext(), row.item, 'tab');
	});
}
```

Update that function's docblock: the paragraph explaining the hand-excluded disclosure is now a paragraph about one receiver-side guard covering both gestures and every control.

- [ ] **Step 6: Run and watch it pass**

Run: `npx vitest run test/view/mywork/`
Expected: PASS, including the existing disclosure tests — the twisty's own `stopPropagation` stays where it is and the new guard is a second, wider answer to the same question.

- [ ] **Step 7: Style the button**

In `styles/mywork.css`, after the `.pbl-mw-next` rule:

```css
/* The row's own menu button (`renderTree.ts`) — revealed the way `.pbl-grip` is in
   `tree.css`, which is the idiom this tree's neighbours already use: the control is
   always PRESENT (so no row reflows when a pointer crosses it) and only becomes visible
   where a pointer or the selection says the reader is on that row. */
button.pbl-mw-menu {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 22px;
	block-size: 22px;
	padding: 0;
	color: var(--text-muted);
	background-color: transparent;
	box-shadow: none;
	border: 0;
	border-radius: var(--radius-s);
	opacity: 0;
	transition: opacity 120ms ease-in-out;
	cursor: pointer;
}

.pbl-row:hover button.pbl-mw-menu,
.pbl-row:focus-within button.pbl-mw-menu,
.pbl-row.pbl-selected button.pbl-mw-menu {
	opacity: 1;
}

button.pbl-mw-menu:hover {
	color: var(--text-normal);
	background-color: var(--background-modifier-hover);
}

/* A reader who cannot hover is exactly the reader who cannot right-click, so on a touch
   pane the button is the ONLY route to the menu and is never hidden. `styles/touch.css`
   states the same rule for the six controls that came before it, and the same trap: a
   media query adds no specificity, so a reveal written ABOVE the rule it undoes reveals
   nothing. This sits after the rules it overrides. */
@media (hover: none) {
	button.pbl-mw-menu {
		opacity: 1;
	}
}
```

- [ ] **Step 8: Assert the stylesheet's own claims**

In `test/view/mywork/narrow.test.ts`, beside the existing source-read assertions (that file already reads `styles/mywork.css` from disk — reuse its own reader rather than adding a second):

```ts
	it('reveals the row menu button on hover, on selection, and always without hover', () => {
		expect(css).toMatch(/\.pbl-row:hover button\.pbl-mw-menu/);
		expect(css).toMatch(/\.pbl-row\.pbl-selected button\.pbl-mw-menu/);
		// The touch rule, and its POSITION: a media query adds no specificity, so it has
		// to come after the `opacity: 0` it undoes.
		expect(css.indexOf('@media (hover: none)')).toBeGreaterThan(css.indexOf('button.pbl-mw-menu {'));
	});
```

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add src/view/mywork/renderTree.ts src/view/scopeRow.ts src/i18n/en.ts styles/mywork.css test/helpers/mywork.ts test/view/mywork/
git commit
```

Message: `A row menu the pointer can reach`.

- [ ] **Step 10: Look at it, at four widths**

Run: `npm run harness -- test/harness/mywork.ts`, then open the printed URL with `?person=People/Ada.md&width=200`, and again at `240`, `260` and `600`. Read the deepest row that carries the Next marker.

Record what you see in the commit body or in Task 7's register note: whether the button clips at 200px and 240px. **If it clips, the BUTTON is what yields** — add `.pbl-mw-view button.pbl-mw-menu { display: none }` inside the existing `@container (max-width: 260px)` block, GUARDED by `@media (hover: hover)` so a touch pane keeps its only route in, and say so in the note. Do not widen the 260px cutoff and do not take room from the chip.

---

### Task 3: Which note is open

**Files:**
- Modify: `src/view/mywork/myWorkView.ts`
- Modify: `styles/mywork.css`
- Modify: `test/helpers/vault.ts`
- Test: `test/view/mywork/tree.test.ts`

**Interfaces:**
- Consumes: `TreeDraw` (`src/view/scopeKeys.ts`) — `drawMyWorkTree` already returns `TreeDraw | null`, and its `rowEls: ReadonlyMap<string, HTMLElement>` is the index this task marks through.
- Produces: `.pbl-mw-open` on at most one row; `FakeVault.openNote(path: string | null): void` and `FakeVault.activeFile: TFile | null` in the test helper.

- [ ] **Step 1: Teach the fake workspace to open a note**

In `test/helpers/vault.ts`:

Add beside `activeView`:

```ts
	/** The file the workspace calls active, as `getActiveFile()` answers it. */
	activeFile: TFile | null = null;
```

Add beside `cssChangeHandlers`:

```ts
	/** Handlers registered through workspace.on('file-open'), fired by `openNote`. */
	private fileOpenHandlers: ((file: TFile | null) => void)[] = [];
```

In the `workspace` object, extend `on` and add `getActiveFile`:

```ts
			getActiveFile: () => this.activeFile,
			on: (name: string, cb: (file: TFile | null) => void) => {
				if (name === 'css-change') this.cssChangeHandlers.push(cb);
				if (name === 'file-open') this.fileOpenHandlers.push(cb);
				return { name };
			},
```

Add beside `changeCss()`:

```ts
	/** Open a note the way the workspace does: the active file moves, then `file-open`
	 *  fires. `null` is "the workspace has no file open", which a view has to survive. */
	openNote(path: string | null): void {
		this.activeFile = path === null ? null : (this.files.get(path) ?? null);
		for (const cb of this.fileOpenHandlers) cb(this.activeFile);
	}
```

- [ ] **Step 2: Write the failing test**

In `test/view/mywork/tree.test.ts` (add `refreshMyWork` to its imports if it is not already there):

```ts
	it('marks the row whose note the workspace has open', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		vault.openNote('PBI Ada.md');

		expect(mwRow(view, 'PBI Ada.md').classList.contains('pbl-mw-open')).toBe(true);
		expect(mwRow(view, 'Feature.md').classList.contains('pbl-mw-open')).toBe(false);
	});

	it('moves the mark when a different note is opened, and drops it when none is', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		vault.openNote('PBI Ada.md');
		vault.openNote('Feature.md');
		expect(mwRow(view, 'PBI Ada.md').classList.contains('pbl-mw-open')).toBe(false);
		expect(mwRow(view, 'Feature.md').classList.contains('pbl-mw-open')).toBe(true);

		vault.openNote(null);
		expect(mwRow(view, 'Feature.md').classList.contains('pbl-mw-open')).toBe(false);
	});

	it('keeps the mark across a redraw, which builds fresh elements', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');
		vault.openNote('PBI Ada.md');

		refreshMyWork(view, vault);

		expect(mwRow(view, 'PBI Ada.md').classList.contains('pbl-mw-open')).toBe(true);
	});
```

- [ ] **Step 3: Run and watch it fail**

Run: `npx vitest run test/view/mywork/tree.test.ts -t 'open'`
Expected: FAIL — the class is never applied.

- [ ] **Step 4: Implement**

In `src/view/mywork/myWorkView.ts`:

Import the draw's type beside the existing imports:

```ts
import type { TreeDraw } from '../scopeKeys';
```

Add the two fields beside `activeRowFile`:

```ts
	/** The last draw's own row index, kept so `syncOpenRow` can mark a row without
	 *  querying the tree — `TREE_SCAN`'s own ban, and the reason `wireScopeKeys` takes
	 *  this index rather than building one. Null in every state that draws no tree. */
	private treeDraw: TreeDraw | null = null;
	private watchedApp = false;
```

In `onDataUpdated`, before the deferral check's `refresh()`:

```ts
	onDataUpdated(): void {
		this.watchApp();
		if (this.gate.deferUpdate()) return;
		this.refresh();
	}
```

Add the two methods:

```ts
	/**
	 * What this view subscribes to on the APP, wired on the first data update rather
	 * than in the constructor — `backlogView.ts`'s own `watchApp` and its reason: a Bases
	 * view is handed its `app` afterwards, so there is nothing to subscribe to yet when it
	 * is built. `registerEvent` takes it off with the view.
	 *
	 * `file-open` is the only one this view needs. A note opened from a link, the graph or
	 * another pane changes which row is the one the reader is looking at, and NOTHING else
	 * tells this view that: opening a note is not a data update, so no render follows one.
	 */
	private watchApp(): void {
		if (this.watchedApp) return;
		this.watchedApp = true;
		this.registerEvent(this.app.workspace.on('file-open', () => this.syncOpenRow()));
	}

	/**
	 * Mark the row whose note the workspace has open, through the last draw's own index.
	 *
	 * A class of its own, never `.pbl-selected`: the selection is the row the KEYBOARD is
	 * on, and this is the note the WORKSPACE has open. Reusing the selection would move a
	 * reader's cursor because a note opened somewhere else, and `wireScopeKeys` would then
	 * be reading a selection it did not set.
	 *
	 * Called from the listener AND from the end of `render()`, because a redraw builds
	 * fresh elements that carry no class of ours.
	 */
	private syncOpenRow(): void {
		const openPath = this.app.workspace.getActiveFile()?.path ?? null;
		for (const [path, el] of this.treeDraw?.rowEls ?? []) el.toggleClass('pbl-mw-open', path === openPath);
	}
```

In `draw()`, the last line becomes:

```ts
		this.treeDraw = drawMyWorkTree(this, this.viewEl);
```

In `render()`, null the draw before `this.draw()` (the elements it indexes are about to be detached) and sync after the focus restore:

```ts
		this.viewEl.empty();
		this.treeDraw = null;
		this.draw();
```

```ts
		this.restoreFocus(focusHandle);
		this.syncOpenRow();
```

- [ ] **Step 5: Run and watch it pass**

Run: `npx vitest run test/view/mywork/`
Expected: PASS.

- [ ] **Step 6: Style the marker**

In `styles/mywork.css`, after the `.pbl-mw-context` rule:

```css
/* The note the workspace has open — a different fact from `.pbl-selected`, which is the
   row the keyboard is on, and drawn differently for it: the selection keeps `tree.css`'s
   inset accent bar, and this is a faint ground with the title at full strength. Obsidian's
   own file explorer marks its active file the same way, with the same token. */
.pbl-mw-open {
	background-color: var(--nav-item-background-active, var(--background-modifier-hover));
}

.pbl-mw-open .pbl-title {
	color: var(--text-normal);
	font-weight: var(--font-medium);
}
```

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add src/view/mywork/myWorkView.ts styles/mywork.css test/helpers/vault.ts test/view/mywork/tree.test.ts
git commit
```

Message: `The my-work tree says which note is open`.

---

### Task 4: A roster of one

**Files:**
- Modify: `src/view/mywork/myWorkView.ts` (the no-pick branch of `draw()`)
- Modify: `src/i18n/en.ts`
- Test: `test/view/mywork/shell.test.ts`

**Interfaces:**
- Consumes: `guidanceShell(parentEl, icon, title, hint): HTMLElement` (`src/view/render/emptyStates.ts`) — it RETURNS the shell, which is what a press is appended to.
- Produces: `.pbl-mw-solo`, a `mod-cta` button in the no-pick state.

- [ ] **Step 1: Add the catalog key**

In `src/i18n/en.ts`, beside `'mywork.empty.noPick.hint'`:

```ts
	/** The press a roster of ONE draws in the no-pick state (`view/mywork/myWorkView.ts`).
	 *  The name is a parameter: it is vault data, never text this catalog spells. */
	'mywork.empty.noPick.cta': 'Show {name}’s work',
```

- [ ] **Step 2: Write the failing test**

In `test/view/mywork/shell.test.ts`:

```ts
	it('offers a press for a roster of one, and picks that person with it', () => {
		const vault = myWorkVault();
		// The fixture ships two people; a roster of ONE is what this press is for.
		vault.files.delete('People/Bo.md');
		vault.frontmatter.delete('People/Bo.md');
		const { view } = makeMyWorkView(vault);

		const btn = view.viewEl.querySelector<HTMLElement>('.pbl-mw-solo');
		expect(btn?.textContent).toBe(t('mywork.empty.noPick.cta', { name: 'Ada' }));

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.pickedPerson).toBe('People/Ada.md');
	});

	it('draws no such press when the roster holds more than one person', () => {
		const { view } = makeMyWorkView(myWorkVault());

		expect(view.viewEl.querySelector('.pbl-mw-solo')).toBeNull();
	});
```

Add `t` to the file's imports if it is not already there (`import { t } from '../../../src/i18n/t';`). If deleting from `vault.files` is not how this suite removes a note, copy whatever the neighbouring tests do instead — `myWorkVault({ resources: false })` is the no-roster case and is NOT this one.

- [ ] **Step 3: Run and watch it fail**

Run: `npx vitest run test/view/mywork/shell.test.ts -t 'roster of one'`
Expected: FAIL — no `.pbl-mw-solo` element.

- [ ] **Step 4: Implement**

In `src/view/mywork/myWorkView.ts`, in `draw()`, the no-pick branch becomes:

```ts
		if (this.pickedPerson === null || !pickedResource(this.model, this.pickedPerson)) {
			const shellEl = guidanceShell(
				this.viewEl,
				'user-round-search',
				t('mywork.empty.noPick.title'),
				t('mywork.empty.noPick.hint'),
			);
			this.drawSoloPress(shellEl);
			return;
		}
```

and the method:

```ts
	/**
	 * A roster of ONE has one answer, and this is the press that gives it — appended to
	 * the no-pick guidance rather than drawn instead of it, so the picker above stays the
	 * way to a different answer.
	 *
	 * **Never an auto-pick**, and that is the decision rather than the lazy half of one:
	 * `pick(null)` stores nothing, so "never picked" and "deliberately cleared" are the
	 * same stored state. An auto-pick would undo a clear on the next data update, and
	 * telling the two apart costs a second stored value — the shape ADR 0011 already
	 * charges for. One press buys the same "one person, no ceremony" with no new state.
	 */
	private drawSoloPress(shellEl: HTMLElement): void {
		const roster = this.model?.resources ?? [];
		if (roster.length !== 1) return;
		const only = roster[0];
		const btn = shellEl.createEl('button', {
			cls: 'mod-cta pbl-mw-solo',
			text: t('mywork.empty.noPick.cta', { name: only.title }),
		});
		btn.addEventListener('click', () => this.pick(only.file.path));
	}
```

- [ ] **Step 5: Run and watch it pass**

Run: `npx vitest run test/view/mywork/shell.test.ts`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add src/view/mywork/myWorkView.ts src/i18n/en.ts test/view/mywork/shell.test.ts
git commit
```

Message: `A roster of one is one press away`.

---

### Task 5: The Next row is where the reader lands

**Files:**
- Modify: `src/view/mywork/renderTree.ts` (publish the drawn Next row's element)
- Modify: `src/view/mywork/myWorkView.ts` (`render()`'s scroll restore)
- Test: `test/view/mywork/lifecycle.test.ts`

**Interfaces:**
- Consumes: `nextAssigned(...)` and the `rowEls` map, both already built in `drawMyWorkTree`.
- Produces: `MyWorkView.nextRowEl: HTMLElement | null` — the drawn row carrying the Next marker, or null when the tree drew none.

- [ ] **Step 1: Write the failing test**

In `test/view/mywork/lifecycle.test.ts`:

```ts
	it('scrolls the Next row into view when the person changes', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Bo.md');

		const scrolled: HTMLElement[] = [];
		// jsdom computes no layout and `test/helpers/dom.ts` stubs `scrollIntoView` with a
		// no-op, so what a test can honestly say is WHICH element was asked to scroll —
		// never that it moved.
		const proto = Element.prototype as unknown as { scrollIntoView: () => void };
		const original = proto.scrollIntoView;
		proto.scrollIntoView = function (this: HTMLElement): void {
			scrolled.push(this);
		};
		try {
			view.pick('People/Ada.md');
		} finally {
			proto.scrollIntoView = original;
		}

		expect(scrolled).toContain(mwRow(view, 'PBI Ada.md'));
	});
```

`PBI Ada.md` is the Next row of Ada's tree in this fixture — the first unfinished member in plan order. If the fixture's own arrangement makes another row the marked one, assert on THAT row (read `.pbl-mw-next`'s row through `mwRow`), and say so in the test's name rather than changing the fixture.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/view/mywork/lifecycle.test.ts -t 'Next row into view'`
Expected: FAIL — nothing scrolls that row; `render()` parks the new person's tree at `scrollTop = 0`.

- [ ] **Step 3: Publish the element**

In `src/view/mywork/renderTree.ts`, after the `for (const { row, pos, count } of siblingPlaces(visible))` loop:

```ts
	// Published for `render()`'s own scroll decision (below): a NEW person's tree is
	// parked at the top by the offset restore, and the top is not where this view's one
	// headline answer necessarily is.
	view.nextRowEl = next === null ? null : (rowEls.get(next.item.file.path) ?? null);
```

`nextAssigned` returns `ScopeRow | null`; if it returns `undefined` in this codebase, compare with `?? null` instead of `=== null` — read its signature rather than assuming.

- [ ] **Step 4: Hold and use it**

In `src/view/mywork/myWorkView.ts`, add the field beside `activeRowFile`:

```ts
	/** The drawn row carrying the Next marker, published by `drawMyWorkTree` — what a
	 *  person switch scrolls to instead of the top. Null in every state that draws no
	 *  tree, and on a tree where every row is finished. */
	nextRowEl: HTMLElement | null = null;
```

In `render()`, null it beside the draw (`this.treeDraw = null;` from Task 3 — the same line's neighbours), and replace the scroll restore with:

```ts
		const drawnEl = this.viewEl.querySelector('.pbl-mw-tree');
		// A person SWITCH has no offset to restore — `previousTop` is 0 for one, because
		// an offset belongs to the person it was scrolled in — so the question there is
		// not "where was this tree" but "where does this reader need to be". The answer
		// this view exists to give is the Next row, which in a long tree is below the
		// fold. A same-person redraw restores the offset exactly as before: a reader who
		// scrolled somewhere on purpose must not be dragged back by a data update.
		if (drawnEl !== null && this.drawnPerson !== this.pickedPerson && this.nextRowEl !== null) {
			this.nextRowEl.scrollIntoView({ block: 'nearest' });
		} else if (drawnEl !== null) {
			// Clamped to the FRESH `scrollHeight`, `releaseView.ts`'s own rule: a redraw
			// with fewer rows must not park the pane below its own last row.
			drawnEl.scrollTop = Math.min(previousTop, drawnEl.scrollHeight);
		}
		this.drawnPerson = this.pickedPerson;
```

**Order matters**: `this.drawnPerson = this.pickedPerson;` currently sits immediately after `this.draw()`. Move it BELOW the scroll block, or the comparison above always reports "same person". Read the surrounding lines before editing, and keep `previousTop`'s own capture where it is (before `empty()`).

- [ ] **Step 5: Run and watch it pass**

Run: `npx vitest run test/view/mywork/`
Expected: PASS, including the existing scroll-restore tests in `lifecycle.test.ts` — a same-person redraw must still restore its offset. If one of those now fails, the `drawnPerson` assignment moved to the wrong place.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add src/view/mywork/renderTree.ts src/view/mywork/myWorkView.ts test/view/mywork/lifecycle.test.ts
git commit
```

Message: `A person switch lands on what is next`.

---

### Task 6: Two reading fixes

**Files:**
- Modify: `styles/mywork.css`, `styles/releaseScope.css`
- Modify: `src/view/mywork/myWorkView.ts` (the loading state)
- Test: `test/view/mywork/narrow.test.ts`, `test/view/mywork/shell.test.ts`

**Interfaces:**
- Consumes: `renderLoadingState(treeEl: HTMLElement): void` from `src/view/render/emptyStates.ts` — the spinner-and-text state the backlog view already shows before its first data update, with its own existing key.
- Produces: nothing new.

**Note on scope:** the spec listed the loading shell under "not in this change", on the belief it needed two new catalog keys. It does not — `renderLoadingState` already exists and carries its own. A one-line swap that reuses a shipped helper is cheaper than the sentence explaining why it was left out, so it is in.

- [ ] **Step 1: Write the failing tests**

In `test/view/mywork/narrow.test.ts` (reusing that file's own stylesheet reader):

```ts
	it('dims a context row without an opacity over the whole row', () => {
		// `opacity` over the row dims the badge and the chip with the title, and takes the
		// title's own muted colour under the contrast floor. The emphasis is carried by
		// colour instead, per element.
		expect(css).not.toMatch(/\.pbl-mw-context\s*\{[^}]*opacity/);
		expect(css).toMatch(/\.pbl-mw-context \.pbl-title/);
	});
```

In `test/view/mywork/shell.test.ts`:

```ts
	it('shows the shared loading state before the first data update', () => {
		const containerEl = document.createElement('div');
		const view = new MyWorkView({} as never, containerEl, new WriteLock());

		expect(view.viewEl.querySelector('.pbl-loading')).not.toBeNull();
	});
```

Add the imports that test needs (`MyWorkView`, `WriteLock`) if the file does not already carry them.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/view/mywork/narrow.test.ts test/view/mywork/shell.test.ts`
Expected: FAIL on both — the opacity rule is still there, and the constructor still calls `setText`.

- [ ] **Step 3: Change the context emphasis, in both trees**

In `styles/mywork.css`, replace the `.pbl-mw-context` rule with:

```css
/* A context ancestor is scaffolding holding a member in place, not something the reader
   asked to see — de-emphasised for that, never hidden, or the member loses its place.
   **By colour, not by `opacity`**, and that changed on 2026-09-03: `opacity: 0.62` over
   the whole row dimmed the badge and the state chip along with the title, and multiplied
   the title's own `--text-muted` down under the contrast floor a theme picked that token
   to clear. Colour per element says the same thing and stays legible, and the badge — the
   one part of the row that is a colour statement of its own — carries the softening
   instead. The release scope's own `.pbl-rel-context` is the identical rule and was
   changed with this one; two trees drawing one shape must not drift. */
.pbl-mw-context .pbl-title {
	color: var(--text-faint);
}

.pbl-mw-context .pbl-badge {
	opacity: 0.7;
}
```

Apply the identical pair to `styles/releaseScope.css` under `.pbl-rel-context`, with a comment pointing at this note rather than repeating the reasoning.

- [ ] **Step 4: Use the shared loading state**

In `src/view/mywork/myWorkView.ts`, import it beside `guidanceShell`:

```ts
import { guidanceShell, renderLoadingState } from '../render/emptyStates';
```

and replace `this.viewEl.setText(t('mywork.loading'));` in the constructor with:

```ts
		// The shared state, not a bare line of text: `renderLoadingState` carries the
		// spinner, `role="status"` and `aria-live="polite"` that make this announce rather
		// than sit there, and it costs no catalog key of this view's own.
		renderLoadingState(this.viewEl);
```

If `t('mywork.loading')` then has no caller, delete the key from `src/i18n/en.ts` — an unused key is exactly what `npm run check`'s fallow step is for. Check with `grep -rn "mywork.loading" src/ test/` before deleting, and remove any test that asserts the old text.

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run test/view/mywork/`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add styles/mywork.css styles/releaseScope.css src/view/mywork/myWorkView.ts src/i18n/en.ts test/view/mywork/
git commit
```

Message: `Context rows read, and the first frame says it is loading`.

- [ ] **Step 7: Look at it**

Run: `npm run harness -- test/harness/mywork.ts` and read the context rows beside the member rows at `?width=600` and `?width=240`. They must still read as scaffolding — clearly quieter than a member — without any of the three parts of the row becoming unreadable.

---

### Task 7: The register, the changelog, and the honest limits

**Files:**
- Create: `docs/requirements/The tree answers the pointer.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/requirements/A tree that fits a sidebar.md` (only if Task 2's harness pass changed the narrow block)

**Interfaces:**
- Consumes: everything the six tasks above shipped.
- Produces: the register's own record, which `npm run check`'s `docs-check.mjs` step gates.

- [ ] **Step 1: Write the PBI**

Create `docs/requirements/The tree answers the pointer.md` with this frontmatter — `order: 40` is the next free sibling order under that Feature (10, 20, 30 are taken):

```yaml
---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 40
status: Open
created: 2026-09-03
source: user request — my-work UX polish, 2026-09-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---
```

The body follows the shape of its siblings: an **As/I want/So that**, a **Use case** table, **Main flow**, **Extensions**, **Acceptance criteria**, and **Where it lives**. Take the criteria from the spec's own Verification section, plus:

- A `mousedown` in either scope tree marks the row it lands on and writes `host.activeRowFile`; a following `focus` leaves that mark where it is.
- Every my-work row draws `.pbl-mw-menu`, opening the identical menu `showMyWorkRowMenu` builds for a right-click, and its press never opens the note.
- `wireRowOpen` asks ONE receiver-side question of both gestures — did the event begin on a `button` inside the row — rather than naming one tree's control classes.
- `.pbl-mw-open` marks the row whose note the workspace has open, follows `file-open`, and survives a redraw. It is never `.pbl-selected`.
- The no-pick state draws `.pbl-mw-solo` exactly when the roster holds one person, and no stored value distinguishes "never picked" from "cleared".
- A person switch scrolls the drawn Next row into view; a same-person redraw restores the offset instead.
- `.pbl-mw-context` and `.pbl-rel-context` carry no `opacity` over the whole row.

**Where it lives** names `src/view/scopeKeys.ts`, `src/view/scopeRow.ts`, `src/view/mywork/renderTree.ts`, `src/view/mywork/myWorkView.ts`, `styles/mywork.css` and `styles/releaseScope.css` — every module this change touched, since `docs-check.mjs` rule 7 requires each `src/` module be SPECIFIED somewhere.

Record the harness widths you actually read in Task 2 Step 10 and Task 6 Step 7, with the numbers, and state plainly what is still owed: a themed vault's colours, its accent, and how the pane feels dragged into a real Obsidian sidebar. Obsidian cannot run here.

- [ ] **Step 2: Add the changelog entry**

Under `## [Unreleased]` in `CHANGELOG.md`, in the style of the entries above it:

```markdown
### Fixed

- A click in the my-work and release scope trees marked the first row and scrolled the pane to the top instead of marking the row it opened.

### Added

- A row menu button on every my-work row, so Set state is reachable by pointer and by touch.
- The my-work tree marks the row whose note is open, and a roster of one offers a press to pick that person.
```

- [ ] **Step 3: Run the whole gate**

Run: `npm run check`
Expected: all seven steps pass. `docs-check.mjs` is the one most likely to object — it gates the register's hierarchy, sibling orders, every link and every source path the new note names.

- [ ] **Step 4: Commit and push**

```bash
git add docs/ CHANGELOG.md
git commit
git push -u origin claude/my-work-ux-improvements-b6bd7b
```

- [ ] **Step 5: Open the pull request**

Ready for review, not a draft. Check for a template under `.github/` first and fill its headings if one exists. The body says what changed, names the harness widths that were read, and states the live-vault check as still owed.

---

## Self-review

**Spec coverage** — §1 pointer fix → Task 1. §2 row menu button → Task 2 (including the width measurement and its stated fallback). §3 open-note marker → Task 3. §4 roster of one → Task 4. §5 Next into view and the context emphasis → Tasks 5 and 6, with the release tree's identical rule in Task 6 Step 3. Spec "Not in this change": the loading shell is now IN, with the reason stated at Task 6; the count and the write paths stay out, and nothing in this plan adds either. Verification → each task's own steps, plus Task 7.

**Type consistency** — `TreeDraw` (`src/view/scopeKeys.ts`) is the type in Task 3's field and is what `drawMyWorkTree` already returns. `nextRowEl` is `HTMLElement | null` where it is set (Task 5 Step 3) and where it is read (Step 4). `mwMenuButton` is defined in Task 2 Step 2 and used only there. `FakeVault.openNote` is defined in Task 3 Step 1 and used in Step 2.

**Placeholders** — two deliberate ones, both in Task 1 Step 5, where the release fixture's own paths have to be read from the file rather than guessed; the step says so and says what to copy.
