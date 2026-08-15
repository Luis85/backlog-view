# Reconcile the tree's rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop rebuilding every row on every data update — keep the row elements whose content did not change — so a write batch no longer costs ~280 ms on an 832-row tree.

**What this does and does not buy:** the per-row cost drops from building a row to serializing and comparing a signature. The render stays **linear in the visible rows** — `renderForest` walks every one of them whether it keeps it or not, and skipping that walk needs to know what changed, which `onDataUpdated()` cannot say. This is a large constant-factor cut, not a change of class; virtualisation is the only thing that changes the class, and ADR 0029 refuses it for now with reasons.

**Architecture:** Three moves, in order. First make room: `src/view/backlogView.ts` is at the 400-line cap and the reconcile has to change it, so the render orchestration comes out at the seam the register already named. Then remove the render-time captures that make reusing a row unsafe: every per-row control resolves its item from `data-path` at event time. Then reconcile — a per-pass fingerprint decides whether reuse is legal at all, and a per-row signature decides which rows survive.

**Tech Stack:** TypeScript, Obsidian 1.12.0 Bases custom-view API, vitest + jsdom, esbuild. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-reconcile-tree-rows-design.md`
**Bug:** `docs/bugs/The render is the whole cost of a data update.md`

## Global Constraints

- **Every `src/` file is capped at 400 effective lines** (`max-lines`, blank lines and comments skipped) and `test/**` at 450. Check headroom before adding to a file. Current effective counts: `backlogView.ts` ~399, `columns.ts` ~381, `menu.ts` ~376, `rows.ts` ~275.
- **Layers:** `main → commands → view → storage → domain`. Each may reach anything below it and nothing above; `eslint.config.mjs` enforces it per directory. `ui/` reaches none of them. Modules reach view state only through `BacklogViewHost`, and `src/view/host.ts` stays free of runtime code.
- **Never write frontmatter outside `src/storage/frontmatter.ts`.** Nothing in this plan writes.
- **Every module in `src/` must be specified** by a use case's `## Where it lives` or an ADR's `## Decision` — a Task, Issue or Bug note counts for nothing. A new `src/` file without that fails `npm run docs`. This plan creates two: `src/view/renderPass.ts` and `src/view/rowSignature.ts`.
- **Definition of done for every task:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) passes before the commit. Coverage thresholds in `vitest.config.mts` only ever go up.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore. Steps below say where.
- **Marketplace rules:** sentence-case UI text, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **A `ponytail:` comment** marks a deliberate simplification with a known ceiling, naming the ceiling and the upgrade path.
- Commit messages: imperative, no model identifier, no line-number citations.

---

### Task 1: Make room in `backlogView.ts`

The register has been waiting for this and predicted this increment would meet it: `docs/tasks/Split the view dispatch hub again.md` says *"the next increment will meet this task again — which is exactly what the criterion below was written to refuse."* The named seam is the render orchestration; the last split took only its post-content half into `render/afterContent.ts`.

That task deliberately does not prescribe the cut and says to read the file fresh first. What follows prescribes the shape, because Task 5 needs a specific place to put the reconcile — but read `renderTreeContent` end to end before moving a line.

**Files:**
- Create: `src/view/renderPass.ts`
- Modify: `src/view/backlogView.ts` (the `render()` / `renderTreeContent()` block)
- Modify: `docs/tasks/Split the view dispatch hub again.md` (the `## Outcome`)
- Modify: `docs/adrs/0003-four-layers-enforced-by-lint.md` **or** a use case's `## Where it lives` — see Step 6
- Test: no new test; the existing view suite must pass unchanged

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  // src/view/renderPass.ts
  export interface RenderPassEls {
      viewEl: HTMLElement;
      treeEl: HTMLElement;
      toolbarEl: HTMLElement;
      legendEl: HTMLElement;
  }

  export interface RenderPassDeps {
      selection: SelectionController;
      resize: ResizePolicy;
      dnd: DragDropController;
      cardDnd: CardDragController;
      rowCtx: () => RowContext;
      scroll: ScrollAnchor;
      /**
       * Publish the snapshots the content render just produced, at the point the view
       * used to assign them — BEFORE the post-content work, which reads `host.roadmap`.
       * The same hook shape `WriteGate` is constructed with.
       */
      publish: (board: BoardSnapshot | null, roadmap: RoadmapSnapshot | null) => void;
  }

  export interface RenderPassResult {
      scroll: ScrollAnchor;
      /** True when the fit verdict changed and the caller owes a second, guarded pass. */
      refitNeeded: boolean;
  }
  ```

  **Why a callback rather than a return value**, since this looks like indirection for its own sake: the snapshots have two readers at two different times inside one pass, and returning them serves only the later one.

  - `captureScroll(treeEl, roadmap, scroll)` wants the **previous** snapshot — `scrollBoxes` uses it to find the timeline scroller and the per-band scroll boxes — so it must run before anything publishes.
  - `syncAfterContent` wants the **new** one: it reads `host.roadmap?.drawn` for the legend, and the dated-axis collapse controls read it too.

  Publishing on return puts the second reader before the assignment, so the legend and those controls draw one frame stale — and `null` on the first roadmap render. Nothing in the suite catches that, which is why it is stated here rather than left to the review.

  ```ts

  export function renderPass(
      host: BacklogViewHost,
      els: RenderPassEls,
      deps: RenderPassDeps,
  ): RenderPassResult;
  ```
  Task 5 adds one field to `RenderPassDeps` and changes the body of `renderPass`. Nothing else in this plan touches `backlogView.ts`.

- [ ] **Step 1: Record the starting line count**

Run this and write the number down — Step 7 compares against it.

```bash
npx eslint src/view/backlogView.ts --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}' 2>&1 | grep -o 'has [0-9]* lines'
```

Expected: a number close to 399.

- [ ] **Step 2: Create the module with the exported shape**

Create `src/view/renderPass.ts` containing the four exported types above and a `renderPass` function whose body is **the body of `renderTreeContent` moved verbatim**, with these mechanical substitutions:

- `this.viewEl` → `els.viewEl`, and the same for `treeEl`, `toolbarEl`, `legendEl`
- `this.selection` → `deps.selection`, and the same for `resize`, `dnd`, `cardDnd`
- `this.rowCtx()` → `deps.rowCtx()`
- `this.scroll` → a local `let scroll = deps.scroll`
- `this.setColumnFit(...)` → `host.setColumnFit(...)`
- `this.isFiltering()` → `host.isFiltering()`, and the same for every other member already on `BacklogViewHost`
- `this.board = content.board` and `this.roadmap = content.roadmap` → locals, returned
- the guarded `refitting` second pass at the end → **stays in `backlogView.ts`**; here it becomes `refitNeeded: deps.resize.refit()`

Move the comments with the lines they explain. They are the record of why each step sits where it does — several of them are the only copy of a decision.

Write a module doc comment saying what the module is: the content render pass, everything between capturing the old frame's scroll and handing back what the pass produced.

- [ ] **Step 3: Delegate from the view**

In `src/view/backlogView.ts`, replace the body of `renderTreeContent` with the delegation, keeping the refit loop and its guard:

```ts
	/** Re-render only the content pane — used by the filter so the toolbar input keeps focus. */
	private renderTreeContent(): void {
		syncFilterUi(this, this.toolbarEl);
		if (!this.model) return;
		const result = renderPass(
			this,
			{ viewEl: this.viewEl, treeEl: this.treeEl, toolbarEl: this.toolbarEl, legendEl: this.legendEl },
			{
				selection: this.selection,
				resize: this.resize,
				dnd: this.dnd,
				cardDnd: this.cardDnd,
				rowCtx: () => this.rowCtx(),
				scroll: this.scroll,
				// Assigned mid-pass, where these two lines used to sit: the post-content
				// work inside the pass reads `host.roadmap`, and the scroll capture before
				// it deliberately reads the old one.
				publish: (board, roadmap) => {
					this.board = board;
					this.roadmap = roadmap;
				},
			},
		);
		this.scroll = result.scroll;
		// Measured against the tree that now exists, scrollbar and all. A changed
		// verdict means a column came or went, which only the rows can show — one
		// more pass, guarded, since the second pass measures the same tree.
		if (result.refitNeeded && !this.refitting) {
			this.refitting = true;
			try {
				this.renderTreeContent();
			} finally {
				this.refitting = false;
			}
		}
	}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, with no test edited. This is a move — a test that needs changing means behaviour changed, so find what moved rather than editing the assertion.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: PASS. If `npm run docs` fails with `src/view/renderPass.ts` unspecified, that is Step 6 and it is expected here.

- [ ] **Step 6: Specify the new module**

`docs-check.mjs` rule 7 requires it. `renderPass.ts` is the render orchestration the layer rule is built on and no single use case owns it — the same position `src/view/host.ts` is in, which [ADR 0003](../../adrs/0003-four-layers-enforced-by-lint.md) names under `## Decision`. Add the path to that ADR's `## Decision` section, in the sentence that names `host.ts`, describing what it is rather than mentioning it.

Run: `npm run docs`
Expected: PASS.

- [ ] **Step 7: Confirm the headroom is real**

Run the Step 1 command again.
Expected: at least **70 lines** below the cap — the number `Split the view dispatch hub again`'s first acceptance criterion asks for, and less than that is worth arguing for rather than assuming. If the cut bought less, take the card-move plumbing or the menu trio as well; both are named in that task as seams.

- [ ] **Step 8: Close the register task**

In `docs/tasks/Split the view dispatch hub again.md`, extend `## Outcome` with what this cut took and the resulting number, and set `status: Done` with `finished: 2026-08-15` — but only if Step 7 met the seventy lines. If it did not, leave it open and say why in the outcome.

- [ ] **Step 9: Commit**

```bash
git add src/view/renderPass.ts src/view/backlogView.ts docs/
git commit -m "Take the render pass out of the dispatch hub

The reconcile has to change renderTreeContent and backlogView.ts had two
lines of headroom, so the seam the register already named comes out first."
```

---

### Task 2: Delegate the chips

Five controls in `src/view/render/columns.ts` capture their `BacklogItem` in a closure at render time. This is invisible today because every update rebuilds every row; it is what makes a kept row unsafe.

The delegated handler goes on `treeEl`, which is the one container for **both** row and card projections — `renderProjectionContent` renders boards into it too. So one handler covers the tree's chips and the cards' chips, and both resolve their item the same way.

It lives in `src/view/render/rows.ts`, beside `wireRowEvents`, which is the pane-level delegation this copies. `rows.ts` has ~125 lines of headroom; `columns.ts` has ~19 and is the wrong place to put new code.

**Files:**
- Modify: `src/view/render/rows.ts` (add `wireChipEvents`, export `itemForEvent`)
- Modify: `src/view/render/columns.ts` (remove five `addEventListener` calls)
- Modify: `src/view/backlogView.ts` (one wiring call in the constructor)
- Test: `test/view/rowControls.test.ts` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  ```ts
  // src/view/render/rows.ts
  /** The item any row- or card-aimed event is about, resolved from `data-path`. */
  export function itemForEvent(host: BacklogViewHost, evt: Event): BacklogItem | null;
  /** One delegated handler for every per-item chip, on rows and cards alike. */
  export function wireChipEvents(host: BacklogViewHost, treeEl: HTMLElement): void;
  ```

- [ ] **Step 1: Write the failing test**

Create `test/view/rowControls.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, rowByTitle, useViewHarness } from '../helpers/view';
import * as menu from '../../src/view/interactions/menu';

useViewHarness();

function oneItem(state: string): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, status: state } });
	return vault;
}

describe('row controls after a data update', () => {
	it('opens the state menu for the item the model holds now, not the one captured at render', () => {
		const { view, containerEl } = makeView(oneItem('Open'), { stateKey: 'status' });
		view.onDataUpdated();
		const before = view.model?.byPath.get('Alpha.md');

		// An UNCHANGED update, deliberately. `buildModel` runs every pass, so the model's
		// object for this path is new while the row's signature is identical — and that is
		// the only shape that exercises a KEPT row once Task 5 lands. Changing the
		// frontmatter would change the signature, rebuild the row, and install a fresh
		// closure, which proves nothing about delegation either before or after.
		view.onDataUpdated();

		const spy = vi.spyOn(menu, 'showStateMenu').mockImplementation(() => {});
		rowByTitle(containerEl, 'Alpha').querySelector<HTMLElement>('.pbl-state-chip')?.click();

		expect(spy).toHaveBeenCalledTimes(1);
		const passed = spy.mock.calls[0][2];
		expect(passed).toBe(view.model?.byPath.get('Alpha.md'));
		// The point of the test: NOT the object the first render closed over.
		expect(passed).not.toBe(before);
	});
});
```

If `vault.setFrontmatter` is not the helper's name, read `test/helpers/vault.ts` and use the one that rewrites a note's frontmatter. Do not add a helper for this — one exists.

If `.pbl-state-chip` is not the chip's class, read `renderStateChip` in `src/view/render/columns.ts` and use the class it builds. Do not guess.

- [ ] **Step 2: Run it, and understand why it passes**

Run: `npx vitest run test/view/rowControls.test.ts`
Expected: **PASS**, before you have changed any source.

That is not a broken test, and do not "fix" it by making it fail. A full rebuild replaces the chip along with the row, so the captured item is always fresh — which means **no test can distinguish a captured item from a delegated one until rows are kept**. The capture is a latent defect today and a live one after Task 5.

This is the same situation as Task 3's disclosure test, and the human has ruled on both: they are written now, from the rule, rather than after Task 5 from the code. The comment in the test says so. What Task 2 buys is the delegation itself; what this test buys is that Task 5 cannot land the capture back.

Do not skip running it. A test that fails here means the harness or a selector is wrong, and you want to know that before touching `columns.ts`.

- [ ] **Step 3: Add the resolver and the delegated handler**

In `src/view/render/rows.ts`, generalise the existing private `rowItem` — which resolves `.pbl-row` only — into an exported resolver that also answers for cards, and add the delegation. Keep `rowItem` as it is; it is the tree's own activation path and its `.pbl-row` narrowing is deliberate (`"on a card projection every one of these handlers resolves nothing and stands aside"`).

```ts
/**
 * The item any row- or card-aimed event is about, or null off both. Resolved at EVENT
 * time from `data-path` against the current model, never captured at render — which is
 * what lets a render KEEP a row element instead of rebuilding it. A chip that closed
 * over its item would point into the previous model the moment an update landed.
 */
export function itemForEvent(host: BacklogViewHost, evt: Event): BacklogItem | null {
	const el = evt.target instanceof Element ? evt.target.closest('[data-path]') : null;
	const path = el instanceof HTMLElement ? el.dataset.path : undefined;
	return path ? (host.model?.byPath.get(path) ?? null) : null;
}

/**
 * Every per-item chip, on one delegated handler for the whole pane. The tree's rows and
 * both card projections render into `treeEl`, so one listener serves all of them, and
 * `renderCell` wires nothing per element.
 *
 * The selector is the list of chips; each entry names the menu it opens. A chip added
 * without an entry here opens nothing, which is a visible failure — the alternative,
 * wiring it at render, is the invisible one this function exists to remove.
 */
export function wireChipEvents(host: BacklogViewHost, treeEl: HTMLElement): void {
/**
 * Every selector is prefixed `button`, and that is load-bearing rather than tidy.
 *
 * A context row's chips are the SAME classes on a `div` — `renderStateChip` builds
 * `createDiv({ cls: `${cls} pbl-state-static` })` where `cls` already starts with
 * `pbl-state-chip`, and the horizon and label chips do the identical thing. A selector
 * matching the class alone would open an edit menu on a read-only value, and the write
 * behind it would then be refused by the gate — a control that offers what it cannot do,
 * which is the context-row rule this codebase says every past bug in it forgot.
 *
 * `button` is also the rule `fromRowControl` already states for the same question, so
 * this is the existing answer rather than a second one.
 */
const CHIPS =
	'button.pbl-state-chip, button.pbl-horizon-chip, button.pbl-risk-chip,' +
	' button.pbl-assignee-chip, button.pbl-date-chip, button.pbl-tag-add, button.pbl-tag-remove';

export function wireChipEvents(host: BacklogViewHost, treeEl: HTMLElement): void {
	treeEl.addEventListener('click', (evt) => {
		const target = evt.target instanceof Element ? evt.target : null;
		const chip = target?.closest(CHIPS);
		if (!chip) return;
		const item = itemForEvent(host, evt);
		if (!item) return;
		if (chip.hasClass('pbl-state-chip')) return void showStateMenu(host, evt, item);
		if (chip.hasClass('pbl-horizon-chip')) return void showHorizonMenu(host, evt, item);
		if (chip.hasClass('pbl-risk-chip')) return void showRiskMenu(host, evt, item);
		if (chip.hasClass('pbl-assignee-chip')) return void showAssigneeMenu(host, evt, item);
		// The date chip opens a modal rather than a menu — `promptSchedule`, which takes
		// no event. It needs the item resolved per click like the rest and none of the
		// anchoring the menu chips need.
		if (chip.hasClass('pbl-date-chip')) return void promptSchedule(host, item, [endOfDateChip(chip)]);
		if (chip.hasClass('pbl-tag-add')) return void showTagMenu(host, evt, item);
		removeTagFromEvent(host, item, chip);
	});
}
```

**The chips moved while this plan was being written.** `main` relocated every chip renderer into a new `src/view/render/chips.ts` and added a **sixth**, `renderDateChip`; only `renderTagCell` stayed in `columns.ts`. So this task's listener removals are in `chips.ts` and `columns.ts` both, and the sixth chip is a capture site the earlier drafts of this plan never mentioned.

The date chip differs from the other five in a way that matters here: it calls `promptSchedule(host, item, [spec.end])` directly — a modal, not a menu — and its handler takes no event at all. It therefore needs the item resolved per click like the rest, and none of the menu anchoring. `endOfDateChip` above stands for whatever recovers `spec.end` (`'start'` or `'target'`) from the element: put it on the chip as a `dataset` entry when it is built, using whatever `dateChipFor` already keys on, and read it back. Do not infer it from the chip's label.

Four details this sketch leaves to the file:

- **The label chips are two classes, not one.** `LABEL_CHIPS` in `columns.ts` holds `cls: 'pbl-risk-chip'` and `cls: 'pbl-assignee-chip'`; there is no shared `pbl-label-chip`. Read `LABEL_CHIPS` and dispatch on the two real classes — the sketch above does, and `spec.showMenu` is where the two menu functions come from. Do not invent a shared class to make one branch possible; two entries in a five-entry list is cheaper than a class the stylesheet does not know.
- The **tag remove** button needs its tag. It is already in the pill's text (`.pbl-tag-text` renders `#${tag}`); put it on the button as `remove.dataset.tag = tag` and read it back — do not parse the rendered text.
- **Verify the button claim before trusting the selector.** Every editable chip is built with `createEl('button', …)` today. Confirm that for each of the six, and if one is not a button, fix the delegation to exclude the static form some other way rather than dropping the `button` prefix for all of them.

- [ ] **Step 3b: Prove the static chips stay inert**

Append to `test/view/rowControls.test.ts`. This is the context-row rule, and it is the failure this delegation would introduce rather than one it inherits:

```ts
	it('opens no menu when a context row\'s static chip is clicked', () => {
		// An outsideFilter row's chips are the same CLASSES on a div — the delegated
		// selector must not reach them. A menu here would offer a write the gate then
		// refuses: a control that says it can do what it cannot.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, status: 'Open' } });
		vault.addFile('Kid.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
		// A base returning only the child pulls the parent in as a context row.
		const { view, containerEl } = makeView(vault, { stateKey: 'status' }, { results: ['Kid.md'] });
		view.onDataUpdated();

		const spy = vi.spyOn(menu, 'showStateMenu').mockImplementation(() => {});
		rowByTitle(containerEl, 'Parent').querySelector<HTMLElement>('.pbl-state-chip')?.click();

		expect(spy).not.toHaveBeenCalled();
	});
```

`makeView`'s third argument is a guess at how the harness restricts the result set. Read `test/helpers/view.ts` and `test/view/contextRowWrites.test.ts` — that suite builds context-row fixtures constantly and its way is the way.

Replace the five `addEventListener` calls in `columns.ts` with nothing. The classes and `dataset` writes stay.

- [ ] **Step 4: Wire it once**

In `src/view/backlogView.ts`, beside the existing `wireRowEvents(this, this.treeEl);` in the constructor:

```ts
		// Every per-item chip, delegated for the same reason the row's own activation is
		// — and for one more: a delegated chip is what lets a render keep a row.
		wireChipEvents(this, this.treeEl);
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run test/view/rowControls.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. Existing chip tests that click a chip keep passing — the control still opens the same menu with the same item, only resolved later.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add src test
git commit -m "Resolve a chip's item per event, not per render

Five chips closed over the BacklogItem while the row was built. Harmless
while every update rebuilds every row, and exactly what makes keeping one
unsafe: the closure points into the model the update replaced."
```

---

### Task 3: Delegate the add button and the disclosure, and put a rule on it

Two more captures in `src/view/render/rows.ts`, and the second is the one that matters most — `renderRowLead` passes `() => host.refreshSubtree(item)` as the chevron's redraw, and `refreshSubtree` renders that item's `children`. A kept row would refold from the previous model. Its sibling `fold` closes over `item.file.path`, a string, and is safe.

Then a lint rule at the forbidden thing, so a control written tomorrow cannot reopen the capture.

**Files:**
- Modify: `src/view/render/rows.ts` (`renderRowLead`, `renderRowTrailing`)
- Modify: `eslint.config.mjs` (one selector, scoped to two files)
- Modify: `src/view/CLAUDE.md` (the sentence that is currently wider than the truth)
- Test: `test/view/rowControls.test.ts` (extend)

**Interfaces:**
- Consumes: `itemForEvent(host, evt)` from Task 2.
- Produces: nothing new. `renderChevron`'s signature is unchanged — the timeline rows share it and pass their own redraw.

- [ ] **Step 1: Write the failing test**

Append to `test/view/rowControls.test.ts`:

```ts
	it('refolds a kept row from the children the model holds now', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Child A.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
		vault.addFile('Child B.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Parent' });
		const { view, containerEl } = makeView(vault);
		view.onDataUpdated();
		expect(titlesOf(containerEl)).toEqual(['Parent', 'Child A', 'Child B']);

		// The children REORDER. Adding one would not do: `descendantCount` is a signature
		// term, so a new child rebuilds the parent's row and its closure with it, and the
		// test would prove nothing about a kept disclosure. A swap leaves every one of the
		// parent's own terms equal — same frontmatter, same count, same done count, same
		// visible-children answer — so the parent's row is KEPT and its captured child
		// list is the only thing that could be stale.
		vault.setFrontmatter('Child A.md', { type: 'PBI', order: 30, parent: '[[Parent]]' });
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'Parent');
		row.querySelector<HTMLElement>('.pbl-chevron')?.click(); // collapse
		row.querySelector<HTMLElement>('.pbl-chevron')?.click(); // expand

		expect(titlesOf(containerEl)).toEqual(['Parent', 'Child B', 'Child A']);
	});
```

Import `titlesOf` from `../helpers/view` alongside the existing imports.

- [ ] **Step 2: Run it**

Run: `npx vitest run test/view/rowControls.test.ts`
Expected: **PASS** today — because today's update rebuilt the row and its closure with it.

This one cannot be watched failing yet. It is the regression guard for Task 5, where keeping the row is what would break it, and it is written now because writing it after the reconcile would be writing it to the implementation. Add a comment in the test saying exactly that, so nobody deletes it as vacuous:

```ts
		// Passes today because every update rebuilds the row. It is here for Task 5,
		// where the row is KEPT and the disclosure's closure is what would go stale —
		// the case a signature cannot catch, since the parent's own frontmatter and
		// rollup are both unchanged by a reorder while its child list is not.
		//
		// The reorder is load-bearing, not incidental: this test was first written as
		// "a child ARRIVES", which changes `descendantCount` — a signature term — so the
		// parent's row would have been rebuilt and nothing about a kept disclosure would
		// have been exercised. Do not simplify it back.
```

- [ ] **Step 3: Delegate the two controls**

In `renderRowLead`, the redraw resolves its item at click time:

```ts
	const path = item.file.path;
	const fold = (): void => void host.setCollapsed(path, !host.isCollapsed(path));
	// Resolved per click, not captured: `refreshSubtree` renders the item's `children`,
	// and on a KEPT row a captured item is the previous model's child list. `fold` above
	// is safe for the opposite reason — a path is the row's identity and does not go
	// stale. Two callbacks, one hazard; see ADR 0029.
	renderChevron(host, row, { ...state, toggle: fold }, () => {
		const current = host.model?.byPath.get(path);
		if (current) host.refreshSubtree(current);
	});
```

In `renderRowTrailing`, the add button joins the delegated handler from Task 2. Add `.pbl-add` to `wireChipEvents`'s selector and give it a branch that recomputes its own type list, since that list is derived from the item:

```ts
		if (chip.hasClass('pbl-add')) {
			return void promptCreateItem(host, offerableTypes(host, childTypeChoices(item)), item);
		}
```

and delete the `addBtn.addEventListener` line. The button's `aria-label` and tooltip still come from `addLabel(childTypes)` at render — those are text, not captures.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, including both tests in `rowControls.test.ts`.

- [ ] **Step 5: Add the lint rule**

In `eslint.config.mjs`, beside the other selector constants (`WRITE_BOUNDARY`, `TREE_SCAN`, and the rest), add:

```js
/**
 * A row's controls are wired on the PANE, never on the element. A listener built during
 * a render closes over that render's `BacklogItem`, which is the previous model's object
 * the moment an update lands — and reusing a row element is exactly what this codebase
 * now does. The rule sits at the call rather than on a list of the controls, because the
 * next control is the one a list would miss.
 *
 * It sees this spelling. A listener added through an aliased reference
 * (`const on = el.addEventListener`) is not caught here and is caught by
 * `test/view/rowControls.test.ts` only on the paths that test drives.
 */
const ROW_LISTENER = {
	selector: "CallExpression[callee.property.name='addEventListener']",
	message:
		'A per-row control may not carry its own listener: it would close over this render\'s BacklogItem and go stale when the model is rebuilt. Add it to wireChipEvents in render/rows.ts, which resolves the item from data-path per event.',
};
```

Then add `ROW_LISTENER` to the `syntaxRules([...])` list for the config block covering `src/view/render/rows.ts`, `src/view/render/columns.ts` **and `src/view/render/chips.ts`** — main moved the chip renderers into that third module, and a rule that stops at the first two would leave every chip free to grow its own listener again, which is exactly the hole this rule exists to close. If those two files are inside a wider block, split them into a block of their own — the file already does this (*"Disjoint regions of `src/`; see the note above `syntaxRules`"*).

**There are four exemptions, not two, and getting this wrong makes the gate unpassable.** Two more listeners live in `rows.ts` and neither is removed by this plan:

- `renderChevron`'s `click`. It closes over `state.toggle`, `redraw` and the element — **callbacks, not an item**. The tree's redraw is the one Task 3 just made resolve by path, and the timeline passes its own; so this listener never holds a `BacklogItem` and is correct as it stands.
- `renderRowLead`'s `title` `mouseover`, which fires the `hover-link` trigger. It closes over `item` and reads `item.file.path` from it.

The second one is safe today only by luck — a path does not go stale — so **make it safe by construction first**: `renderRowLead` already computes `const path = item.file.path` for the fold callback in Step 3, so use that same local in the hover handler and let the closure hold a string instead of the item. One line, and it removes a trap for whoever next adds `item.title` to that handler.

**Count the CALLS, not the functions.** `eslint-disable-next-line` suppresses one call, and `wireRowEvents` alone has three — `click`, `auxclick` and `contextmenu`. Six calls survive in `rows.ts`:

| Call | Why it is exempt |
| --- | --- |
| `wireRowEvents` — `click` | the delegation itself |
| `wireRowEvents` — `auxclick` | the delegation itself |
| `wireRowEvents` — `contextmenu` | the delegation itself |
| `wireChipEvents` — `click` | the delegation itself |
| `renderChevron` — `click` | closes over callbacks, never an item |
| `renderRowLead` — `mouseover` | closes over a path string, never an item |

So do not write six next-line directives. Put the two delegation functions **adjacent** in the file and wrap them in one block disable, which says the thing once:

```ts
/* eslint-disable no-restricted-syntax -- these two ARE the delegation: they take the
   listeners off the rows so a render may keep one. The rule below them is what stops a
   per-row control growing its own. */
export function wireRowEvents(host: BacklogViewHost, treeEl: HTMLElement): void { … }

export function wireChipEvents(host: BacklogViewHost, treeEl: HTMLElement): void { … }
/* eslint-enable no-restricted-syntax */
```

Then one `// eslint-disable-next-line no-restricted-syntax` on each of the other two, with its reason from the table.

Exemptions naming themselves are the point. The rule cannot see "closes over a `BacklogItem`" — no AST selector can — so it bans the spelling it *can* see and each exemption states why it is not the thing the rule is for. A rule with no exemptions here would be a rule that bans its own fix, and one applied without them fails `npm run lint`, which no later task can clear.

- [ ] **Step 5b: Prove the gate still passes**

Run: `npm run lint`
Expected: PASS, with **zero** `no-restricted-syntax` reports in `rows.ts`.

Count what it reports rather than skimming for red. The exemptions are per CALL, and `wireRowEvents` has three of them, so a plausible-looking set of directives can still leave two violations standing — which blocks this task and every task after it. If it reports anything, map each report to the table above before adding a directive: a call not in that table is a real violation and wants the delegation, not an exemption.

- [ ] **Step 6: Watch the rule reject the thing it forbids**

Temporarily re-add one captured listener to `renderStateChip` in `columns.ts`:

```ts
	chip.addEventListener('click', (evt) => showStateMenu(host, evt, item));
```

Run: `npm run lint`
Expected: FAIL on that line with the message above.

Then remove it and re-run: `npm run lint` → PASS. A rule nobody watched reject anything is a rule nobody has tested.

- [ ] **Step 7: Narrow the guide's sentence**

`src/view/CLAUDE.md` currently says *"nothing about a row is captured at wire time"* in the Cost section. That was true of the delegated handlers and false of seven controls. Rewrite it to state what now holds and what checks it, in the shape the root `CLAUDE.md` requires — write the guarantee to the check, never ahead of it:

> **No per-row control carries its own listener.** Every one is wired on the pane and resolves its item from `data-path` per event (`wireRowEvents` and `wireChipEvents` in `render/rows.ts`), so a render may KEEP a row element without leaving a handler pointing into the model the update replaced. A direct `addEventListener` in `render/rows.ts` or `render/columns.ts` fails lint; an aliased one is caught only on a path `test/view/rowControls.test.ts` drives.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add src test eslint.config.mjs
git commit -m "Put the no-capture rule at the call, not on a list of controls

The disclosure's redraw was the worst of the seven: it closes over the item
OBJECT and refreshSubtree renders its children, so a kept row would refold
from a model that is gone. The fold beside it takes the path and is safe."
```

---

### Task 4: The signature and the fingerprint

Two pure functions, no DOM, no wiring. `src/view/childrenList.ts` is the precedent for a pure module in the view layer.

**Files:**
- Create: `src/view/rowSignature.ts`
- Create: `docs/adrs/0029-reconcile-rows-by-signature.md`
- Modify: `docs/adrs/README.md` (the index)
- Test: `test/view/rowSignature.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/view/rowSignature.ts
  /** Everything a pass draws from that is not one item — compared once per render. */
  export function renderInputs(host: BacklogViewHost): string;
  /** Whether reuse is legal at all this pass: every column must be frontmatter-backed. */
  export function reusableColumns(columns: Column[]): boolean;
  /** Everything one row draws from. Two rows drawing the same thing agree. */
  export function rowSignature(
      host: BacklogViewHost,
      item: BacklogItem,
      place: { pos: number; count: number },
  ): string;
  ```
  Task 5 calls all three.

- [ ] **Step 1: Write the failing tests**

Create `test/view/rowSignature.test.ts`. Cover both directions — a false difference costs a wasted row build, a false match ships a stale row, and only the second is a bug:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { renderInputs, reusableColumns, rowSignature } from '../../src/view/rowSignature';

useViewHarness();

const PLACE = { pos: 1, count: 1 };

function viewOf(fm: Record<string, unknown>, config: Record<string, unknown> = {}) {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, ...fm } });
	const made = makeView(vault, config);
	made.view.onDataUpdated();
	return made;
}

function sigOf(fm: Record<string, unknown>, config: Record<string, unknown> = {}): string {
	const { view } = viewOf(fm, config);
	const item = view.model?.byPath.get('Alpha.md');
	if (!item) throw new Error('no item');
	return rowSignature(view, item, PLACE);
}

describe('rowSignature', () => {
	it('agrees for two items drawing the same row', () => {
		expect(sigOf({ status: 'Open' })).toBe(sigOf({ status: 'Open' }));
	});

	it('differs when a frontmatter value a cell draws changes', () => {
		expect(sigOf({ status: 'Open' })).not.toBe(sigOf({ status: 'Doing' }));
	});

	it('differs across values JSON would flatten together', () => {
		// Each pair serializes identically under a plain `JSON.stringify`, and each is a
		// FALSE MATCH — the direction that ships a stale row. Table-driven so a fourth
		// collision is a row rather than another test.
		const collisions: Array<[Record<string, unknown>, Record<string, unknown>]> = [
			[{ n: null }, { n: NaN }],
			[{ n: NaN }, { n: Infinity }],
			[{ d: new Date('2026-01-01T00:00:00.000Z') }, { d: '2026-01-01T00:00:00.000Z' }],
			// The tagging must not create a collision of its own: an authored string that
			// spells a sentinel is escaped out of that namespace.
			[{ n: NaN }, { n: '#num:NaN' }],
			[{ d: new Date('2026-01-01T00:00:00.000Z') }, { d: '#date:2026-01-01T00:00:00.000Z' }],
			[{ s: '#num:NaN' }, { s: '##num:NaN' }],
		];
		for (const [left, right] of collisions) {
			expect(sigOf(left)).not.toBe(sigOf(right));
		}
	});

	it('differs when a frontmatter key nothing draws is added', () => {
		// A false DIFFERENCE is the safe direction: one wasted row build, never a stale
		// cell. The frontmatter is one term precisely so no one has to decide which keys
		// a column might be pointed at tomorrow.
		expect(sigOf({ status: 'Open' })).not.toBe(sigOf({ status: 'Open', notes: 'x' }));
	});

	it('differs when the row sits at a different position among its siblings', () => {
		const { view } = viewOf({ status: 'Open' });
		const item = view.model?.byPath.get('Alpha.md');
		if (!item) throw new Error('no item');
		expect(rowSignature(view, item, { pos: 1, count: 2 })).not.toBe(rowSignature(view, item, { pos: 2, count: 2 }));
	});
});

describe('renderInputs', () => {
	it('differs when a setting that changes a row is toggled', () => {
		// showCounts turns renderRollup from no cell into a count cell, with the
		// frontmatter and the rollup numbers both unchanged.
		expect(renderInputs(viewOf({}, { showCounts: false }).view)).not.toBe(
			renderInputs(viewOf({}, { showCounts: true }).view),
		);
	});

	it('differs when a column\'s rendered value type changes', () => {
		// Obsidian's property type, not the note's: the same scalar renders differently
		// and no frontmatter moves. If the harness cannot vary the value type a fake
		// entry returns, say so in the report and drop this test rather than asserting
		// against a stub that cannot reproduce it — do not weaken the source rule.
		const { view } = viewOf({ points: 3 });
		const before = renderInputs(view);
		// Whatever the harness's way of changing the type a `getValue` result reports is.
		// Read `test/helpers/vault.ts` for it.
		expect(renderInputs(view)).not.toBe(before);
	});

	it('differs when the filter text changes', () => {
		const { view } = viewOf({});
		const before = renderInputs(view);
		view.setFilterText('alp');
		expect(renderInputs(view)).not.toBe(before);
	});
});

describe('reusableColumns', () => {
	it('accepts frontmatter columns', () => {
		expect(reusableColumns([{ prop: 'note.status', label: 'Status', kind: 'value' }])).toBe(true);
	});

	it('refuses a column whose value can change with the frontmatter untouched', () => {
		expect(reusableColumns([{ prop: 'file.mtime', label: 'Modified', kind: 'value' }])).toBe(false);
		expect(reusableColumns([{ prop: 'formula.spent', label: 'Spent', kind: 'value' }])).toBe(false);
	});
});
```

If `view.setFilterText` is not the host's method for the quick filter, read `src/view/host.ts` for the one that is and use it. If `makeView`'s second argument does not take `showCounts`, read `test/helpers/settings.ts` — and note the lint rule there: spreading `defaultSettings()` is banned, use `settingsWith({ ... })`.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/view/rowSignature.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/view/rowSignature.ts`:

```ts
import { BacklogItem } from '../domain/model';
import { ownWorkflowReading } from '../domain/board';
import { childTypeChoices } from '../domain/itemTypes';
import { offerableTypes } from './projection';
import { Column } from './render/columns';
import { BacklogViewHost } from './host';

/**
 * Everything a pass draws from that belongs to no single item, as one string compared
 * once per render.
 *
 * It exists so `rowSignature` below can stay strictly per-item. A row draws from more
 * than its own note — `showCounts` turns the rollup cell on and off, a changed done value
 * repaints `.pbl-done`, the filter text decides which substring lights up, the fit verdict
 * sizes every cell — and `refreshFromData` re-resolves the settings on the same
 * argument-less update path, so a view-option change arrives looking like a data change.
 *
 * Listing those inside the per-row signature would be a list of the places somebody
 * thought of, and the next settings-derived rendering decision is the one it would miss.
 * Answered here instead: unchanged, rows may be kept; changed, the pass rebuilds. See
 * ADR 0029.
 */
export function renderInputs(host: BacklogViewHost): string {
	return JSON.stringify([
		host.settings,
		host.columns,
		host.projection,
		host.filterText,
		host.columnFit,
		valueKinds(host),
	]);
}

/**
 * The RENDERED TYPE of each column, probed once per pass from a single entry.
 *
 * A property's type is Obsidian's, not the note's: change `points` from text to date in
 * the property registry and `Value.renderTo` draws the same YAML scalar a different way,
 * while the frontmatter — and so every row signature — is identical. The columns list
 * cannot see it either; the property id did not change.
 *
 * A type belongs to the PROPERTY, vault-wide, so it cannot differ between two notes in
 * one column — which is what makes a probe exact rather than a sample. But the sample
 * must be **per column**: one entry chosen for all of them reports nothing for a column
 * that entry happens to leave empty, and keeps reporting nothing as the registry changes
 * underneath a later row that does have a value. So each column finds its own first
 * populated entry, and a column no result populates contributes nothing because there is
 * nothing on screen to go stale.
 *
 * `results`, not `items`: a context row is never a source of anything derived from the
 * Base's results.
 */
function valueKinds(host: BacklogViewHost): string[] {
	// THIS projection's results, not the plan's: the catalog draws from
	// `model.catalog`, so probing `model.results` would record an empty kind for a
	// property only the test rows carry. `projectionPopulation` is the existing
	// answer to "whose rows are these" and the renderer asks it too.
	const model = host.model;
	const results = model ? projectionPopulation(host.projection, model).results : [];
	return host.columns.map((column) => {
		for (const item of results) {
			try {
				const value = item.entry?.getValue(column.prop) ?? null;
				// `drawsSomething`, not `!= null`: a missing property comes back as a
				// `NullValue` INSTANCE, which is not null, so a bare null check stops at
				// the first row that lacks the property and records `NullValue` as the
				// column's type for good — leaving a populated row's rendering unguarded.
				if (drawsSomething(value)) return value.constructor.name;
			} catch {
				// This entry cannot answer for this property; the next one may.
			}
		}
		return '';
	});
}

/**
 * Whether this column set allows reuse at all.
 *
 * `file.mtime`, `file.size` and a `formula.*` are refused: a body edit changes
 * `file.mtime` with the frontmatter untouched, so the cell would go stale while its
 * signature matched — the one failure direction that is not acceptable.
 *
 * **This is the source of the value, not the value's rendering, and it is only half the
 * question.** A `note.*` value goes through `Value.renderTo` in `renderValue`, which for a
 * wikilink draws a link whose text belongs to ANOTHER note. Rename that note and this
 * row's own frontmatter is unchanged. The prefix cannot see that, and the second half is
 * answered per row at render time instead — see the volatility rule in
 * `render/rows.ts`, which asks the cell what it actually drew rather than predicting it.
 *
 * ponytail: a whole-pass refusal for the non-frontmatter columns, where a per-cell rule
 * would keep the win for those vaults. Upgrade path is re-rendering those cells alone on
 * a kept row, which costs a second reuse rule; take it when a vault that shows one of
 * these columns complains about the pause.
 */
export function reusableColumns(columns: Column[]): boolean {
	return columns.every((column) => column.prop.startsWith('note.'));
}

/**
 * A JSON replacer that keeps values JSON would otherwise flatten into each other.
 *
 * The signature's whole job is that a match means "draws the same". `JSON.stringify`
 * breaks that in three places, and each is a **false match** — the direction that ships a
 * stale row rather than one wasted build:
 *
 * - `NaN` and `Infinity` both serialize as `null`, so a key changing between YAML `.nan`
 *   and an empty value reads as unchanged.
 * - a `Date` serializes to its ISO string, so a real date and a string that spells the
 *   same instant collide — and Bases renders those two differently.
 * - `undefined` is dropped entirely, so a key holding it is indistinguishable from a key
 *   that is absent.
 *
 * It reads `this[key]` rather than the `value` argument because `toJSON` runs FIRST: by
 * the time the replacer sees a `Date` it is already a string. The holder is where the
 * type still exists.
 *
 * **Ordinary strings beginning `#` are escaped**, and that is what keeps the tagging
 * injective rather than trading one collision for another: without it a note literally
 * containing the text `#num:NaN` would serialize exactly as a real `NaN` does. Escaping
 * moves every user string out of the sentinel namespace — `#num:NaN` becomes
 * `##num:NaN`, `##x` becomes `###x` — so no authored value can spell a tag.
 */
function distinctly(this: Record<string, unknown>, key: string, value: unknown): unknown {
	const raw = this[key];
	if (raw instanceof Date) return `#date:${raw.toISOString()}`;
	if (typeof raw === 'number' && !Number.isFinite(raw)) return `#num:${String(raw)}`;
	if (raw === undefined && key !== '') return '#undefined';
	if (typeof raw === 'string' && raw.startsWith('#')) return `#${raw}`;
	return value;
}

/**
 * Everything ONE row draws from, given that {@link renderInputs} already held.
 *
 * Two groups: the note's frontmatter, which is one term covering the badge, the title,
 * every `note.*` cell, all four chips and the tags — and the derived values a row shows
 * that its own frontmatter cannot give.
 *
 * The frontmatter goes in whole rather than key by key on purpose. A subset would have to
 * predict which keys a column might be pointed at, and the safe failure direction is the
 * other one: a signature that differs when the row would have drawn the same costs one
 * wasted row build, where a signature that matches when it would have drawn differently
 * ships a stale row.
 */
export function rowSignature(
	host: BacklogViewHost,
	item: BacklogItem,
	place: { pos: number; count: number },
): string {
	const frontmatter = host.app.metadataCache.getFileCache(item.file)?.frontmatter ?? null;
	return JSON.stringify([
		JSON.stringify(frontmatter, distinctly),
		item.depth,
		item.levelIndex,
		item.effectiveLevelIndex,
		item.impliedType,
		// Draws the `.pbl-orphan` unlink marker, and flips when a referenced parent starts
		// being returned by the Base: same frontmatter, same depth, same position.
		item.orphan,
		item.outsideFilter,
		item.descendantCount,
		item.doneDescendants,
		ownWorkflowReading(item).done,
		item.children.some((child) => !host.isRowHidden(child)),
		host.isCollapsed(item.file.path),
		host.selectedPath === item.file.path,
		place.pos,
		place.count,
		offerableTypes(host, childTypeChoices(item)),
	]);
}
```

Check every member against the file that defines it before trusting this list — `BacklogItem` in `src/domain/model.ts`, the host in `src/view/host.ts`. A field named here that does not exist fails the build; a field that exists and is missing from the list ships a stale row, and the build says nothing.

**On `valueKinds`' cost.** It scans results until each column finds a value, so a column no result populates walks the whole list — O(results × empty columns) in the worst case, once per pass rather than per row. That is fine at the sizes measured and it is the kind of thing that stops being fine quietly, so note the figure in Task 6 if the per-row number does not move as expected.

```ts
// ponytail: linear scan per empty column, once per pass. If a wide base with mostly
// empty columns ever shows up in the numbers, cache the resolved kinds and invalidate
// them on a column-list change.
```

- [ ] **Step 3a: Give the emptiness test one owner**

`renderValue` in `src/view/render/columns.ts` already decides whether a value draws anything — `value === null || value instanceof NullValue`, then the `isEmpty()` probe on the values that declare one. `valueKinds` needs the identical question, and a second copy of it is how the two come to disagree: the first draft of the probe asked `!= null`, which a `NullValue` instance passes.

Extract it rather than repeat it:

```ts
/**
 * Whether a Bases value draws anything at all.
 *
 * One statement of it, because two readings drift: a missing property comes back as a
 * `NullValue` INSTANCE rather than `null`, and `isEmpty` is declared on some `Value`
 * subclasses and not on `Value` itself, so both tests are easy to write differently the
 * second time. `renderValue` asks it to decide whether to draw a cell, and `valueKinds`
 * asks it to decide which value it may read a type from.
 */
export function drawsSomething(value: Value | null): value is Value {
	if (value === null || value instanceof NullValue) return false;
	const maybeEmpty = value as { isEmpty?: () => boolean };
	return !(typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty());
}
```

Have `renderValue` call it in place of its inline checks, so the behaviour it has today is what the helper carries. That is a refactor with no behaviour change — if a test moves, you changed something.

- [ ] **Step 3b: Re-derive the list with an instrument, and reconcile it against the code**

The list above is an enumeration, and the first draft of it was written from memory and missed `item.orphan` — which draws the `.pbl-orphan` unlink marker and flips when a referenced parent starts being returned by the Base, with the frontmatter, depth and position all unchanged. Review caught it. Do not trust the second draft either.

```bash
awk 'NR>=128 && NR<=275' src/view/render/rows.ts | grep -o 'item\.[a-zA-Z]*' | sort -u
awk 'NR>=366 && NR<=395' src/view/render/rows.ts | grep -o 'item\.[a-zA-Z]*' | sort -u
awk 'NR>=350 && NR<=800' src/view/render/columns.ts | grep -o 'item\.[a-zA-Z]*' | sort -u
```

Those line ranges are `renderItem`/`renderRowLead`/`renderRowTrailing`, `renderBadge`, and the cells. **Check the ranges still cover those functions before believing the output** — they are positions, and the file moves. Read the function names at each boundary first; that is the "test the instrument before measuring with it" step, and skipping it is how a sweep quietly returns a short list.

For each field the sweep prints, name the term that covers it — the frontmatter term, an explicit entry, or the path itself. Anything left over goes in. Write the resulting mapping into the module's doc comment, so the next person sweeps against a list rather than against a memory.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/view/rowSignature.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the ADR**

Create `docs/adrs/0029-reconcile-rows-by-signature.md`. Frontmatter is `adr: 29`, `title`, `status: Accepted`, `date: 2026-08-15`, `area: performance` — and **no `parent`, no `type`**, tested by key, so not even a bare `parent:`. The five headings appear in this order and the order is the argument:

- `## Context` — the measurement from the bug note: ~0.3 ms per row, linear, rebuilt whole per update, two constant-factor cuts already spent, and the note's refusal to propose a fix.
- `## Decision` — diffing, and it must **name `src/view/rowSignature.ts` and `src/view/renderPass.ts` as whole paths**, describing what each is. This is what `docs-check.mjs` rule 7 reads; a mention in `## Context` counts for nothing.
- `## Consequences` — including what got **harder**, which an ADR with only good consequences has not thought about: a render is no longer a clean slate, so anything a row wears outside the signature has a lifetime to reason about; a new settings-derived rendering decision is covered by the fingerprint but a new per-item one has to be added to the signature, and the build cannot tell you that you forgot.
- `## Alternatives` — virtualisation (refused *for now*, with the reason), a cheaper per-row path (spent), and re-rendering by provenance (`onDataUpdated()` takes no arguments). "Simpler" is not a reason; give each the specific one.
- `## Revisit when` — mount cost rather than update cost becomes the complaint, or a vault with a `file.*` column asks for the same win.

Add the entry to `docs/adrs/README.md`, in number order:

```markdown
- [0029 — Reconcile rows by signature, rather than rebuilding them](0029-reconcile-rows-by-signature.md)
```

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add src/view/rowSignature.ts test/view/rowSignature.test.ts docs/adrs
git commit -m "Answer what a row draws from, and what the pass draws from

Two terms, deliberately at different scales: the pass's shared inputs are
compared once, which is what lets the per-row signature stay per-item."
```

---

### Task 5: Reconcile

**Files:**
- Modify: `src/view/render/rows.ts` (`renderTree`, `renderForest`, `renderItem`, `forgetSubtree`)
- Modify: `src/view/renderPass.ts` (the empty-or-reuse decision)
- Modify: `src/view/backlogView.ts` (the signature index, cleared with `rowEls`)
- Modify: `src/view/render/columns.ts` (`RowContext` gains the signature map)
- Test: `test/view/rowReuse.test.ts` (create)

**Interfaces:**
- Consumes: `renderInputs`, `reusableColumns`, `rowSignature` from Task 4; `RenderPassDeps` from Task 1.
- Produces:
  ```ts
  // src/view/render/columns.ts — RowContext gains one field
  /** Signature per rendered path, from the pass that drew it. Read to decide reuse. */
  sigs: Map<string, string>;

  // src/view/renderPass.ts — RenderPassDeps gains one field
  /** The previous pass's render inputs, or null when nothing is on screen. */
  lastInputs: string | null;
  // and RenderPassResult gains
  inputs: string;
  ```

- [ ] **Step 1: Write the failing test**

Create `test/view/rowReuse.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, rowByTitle, rows, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

function backlog(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	for (const [i, name] of ['Alpha', 'Beta', 'Gamma'].entries()) {
		vault.addFile(`${name}.md`, {
			frontmatter: { type: 'Feature', order: (i + 1) * 10, status: 'Open' },
			parentLink: 'Epic',
		});
	}
	return vault;
}

describe('row reuse across a data update', () => {
	it('keeps the same element for every path when nothing changed', () => {
		const { view, containerEl } = makeView(backlog(), { stateKey: 'status' });
		view.onDataUpdated();
		const before = rows(containerEl);

		view.onDataUpdated();

		const after = rows(containerEl);
		expect(after).toHaveLength(before.length);
		after.forEach((row, i) => expect(row).toBe(before[i]));
	});

	it('rebuilds only the row whose note changed', () => {
		const { view, containerEl, vault } = makeView(backlog(), { stateKey: 'status' });
		view.onDataUpdated();
		const untouched = rowByTitle(containerEl, 'Gamma');
		const changed = rowByTitle(containerEl, 'Beta');

		vault.setFrontmatter('Beta.md', { type: 'Feature', order: 20, status: 'Doing', parent: '[[Epic]]' });
		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Gamma')).toBe(untouched);
		expect(rowByTitle(containerEl, 'Beta')).not.toBe(changed);
	});

	it('leaves exactly one column header after repeated updates', () => {
		const { view, containerEl, config } = makeView(backlog(), { stateKey: 'status' });
		config.order = ['note.status'];
		view.onDataUpdated();
		view.onDataUpdated();
		view.onDataUpdated();

		expect(containerEl.querySelectorAll('.pbl-cols')).toHaveLength(1);
	});

	it('carries a kept row\'s child group with it when siblings reorder', () => {
		const vault = backlog();
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Alpha' });
		const { view, containerEl } = makeView(vault, { stateKey: 'status' });
		view.onDataUpdated();

		// Alpha moves below Gamma. Its subtree has to travel with it.
		vault.setFrontmatter('Alpha.md', { type: 'Feature', order: 40, status: 'Open', parent: '[[Epic]]' });
		view.onDataUpdated();

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Beta', 'Gamma', 'Alpha', 'Deep']);
	});

	it('re-indents a reused child group when its parent is reparented deeper', () => {
		// A same-depth sibling reorder does not exercise this: the group's own
		// `--pbl-depth` is written by `childGroupEl` at CREATION only, so a reparent to a
		// new depth rebuilds the row (depth is in the signature) and leaves the reused
		// group's indent guide at the old level.
		const vault = backlog();
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Alpha' });
		const { view, containerEl } = makeView(vault, { stateKey: 'status' });
		view.onDataUpdated();

		// Alpha moves from under Epic to under Beta — one level deeper, still expanded.
		vault.setFrontmatter('Alpha.md', { type: 'Feature', order: 10, status: 'Open', parent: '[[Beta]]' });
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'Alpha');
		const group = row.nextElementSibling as HTMLElement;
		expect(group.hasClass('pbl-children')).toBe(true);
		// Asserted against the ROW's own depth rather than a literal: `renderItem` and
		// `childGroupEl` write the same number, and the bug is precisely that they stop
		// agreeing. A hard-coded 2 would still pass if both drifted together.
		expect(group.style.getPropertyValue('--pbl-depth')).toBe(row.style.getPropertyValue('--pbl-depth'));
	});

	it('rebuilds every row when a setting that changes a row is toggled', () => {
		const { view, containerEl } = makeView(backlog(), { stateKey: 'status', showCounts: false });
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');

		view.setShowCounts(true);

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
	});

	it('rebuilds every row when a column is not frontmatter-backed', () => {
		const { view, containerEl, config } = makeView(backlog(), { stateKey: 'status' });
		config.order = ['file.mtime'];
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');

		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
	});
});
```

`view.setShowCounts` and `config.order` are guesses at the harness's real surface. Read `test/helpers/view.ts` and `src/view/host.ts` and use the real ones. `test/view/renderCost.test.ts` already sets `config.order = [...COLUMNS]` — copy that.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run test/view/rowReuse.test.ts`
Expected: the first, second and fourth FAIL — every element is new after an update. The third, fifth and sixth PASS, because a full rebuild satisfies them trivially. Say so in a comment on each of those three: they are guards on the reconcile's escape hatches, and they pass before and after by design.

- [ ] **Step 3: Carry the signatures on the pass**

In `src/view/render/columns.ts`, add `sigs: Map<string, string>` to `RowContext` and to `rowContext(...)`. In `src/view/backlogView.ts`, add `readonly rowSigs = new Map<string, string>()` beside `rowEls`, clear it wherever `rowEls.clear()` is called, and pass it through `rowCtx()`.

The two maps have one lifetime. A signature index that outlived its rows would claim elements that are gone — the same rule `cardKids` already states beside `rowEls`.

- [ ] **Step 4: Decide the escape hatch in the pass**

In `src/view/renderPass.ts`, replace the unconditional clear:

```ts
	// Reuse is legal only when nothing shared by the pass moved. Everything a row draws
	// that is not its own note lives in this one string — see `renderInputs` — so a
	// settings change, a filter change, a projection switch or a column that is not
	// frontmatter-backed all land here rather than in a per-row term somebody has to
	// remember to add.
	const inputs = renderInputs(host);
	const reuse =
		treeShaped(host.projection) &&
		inputs === deps.lastInputs &&
		reusableColumns(host.columns) &&
		deps.rowCtx().rows.size > 0;
	if (!reuse) {
		els.treeEl.empty();
		host.clearRowIndex();
	}
```

`clearRowIndex()` is a new one-line host method clearing `rowEls`, `rowSigs` and `cardKids` together — three maps with one lifetime, cleared from one place rather than from three call sites that have to agree. Add it to `BacklogViewHost` in `src/view/host.ts` (declaration only; `host.ts` stays free of runtime code).

Return `inputs` in `RenderPassResult`; `backlogView` stores it and passes it back as `lastInputs` next pass.

- [ ] **Step 4b: Clear before every empty state**

`renderTree`'s three early returns — no results, everything filtered out, everything done and hidden — fire **after** the reuse decision and **before** anything prunes. A data update that empties the tree keeps the shared inputs identical and the index non-empty, so reuse is chosen, and the empty message is then appended below the rows it is claiming do not exist.

The spec lists this as Risk 3. It is not optional and it is not a corner: marking the last open item done is an ordinary write.

At the top of each early-return branch in `renderTree`:

```ts
	// The early returns render no rows, so nothing below prunes the ones already here.
	// A reused pass would append this message under the rows it says are not there.
	treeEl.empty();
	ctx.host.clearRowIndex();
```

Add the regression test to `test/view/rowReuse.test.ts`:

```ts
	it('leaves only the empty state when the last result goes', () => {
		const { view, containerEl, vault } = makeView(backlog(), { stateKey: 'status' });
		view.onDataUpdated();
		expect(rows(containerEl).length).toBeGreaterThan(0);

		vault.removeFile('Alpha.md');
		vault.removeFile('Beta.md');
		vault.removeFile('Gamma.md');
		vault.removeFile('Epic.md');
		view.onDataUpdated();

		expect(rows(containerEl)).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-cols')).toHaveLength(0);
	});
```

`vault.removeFile` is a guess — read `test/helpers/vault.ts` for the real one. Run this test before the fix and watch it fail: the rows and the header are still there.

- [ ] **Step 5: Claim the header**

In `renderTree` in `src/view/render/rows.ts`, the header is appended fresh on every pass and the row index cannot see it. Claim it instead:

```ts
	// Claimed rather than appended: with the tree no longer emptied, a fresh header per
	// pass would stack, and a cleanup that walks the row index cannot see a node that is
	// not a row.
	const existingHeader = treeEl.querySelector(':scope > .pbl-cols');
	existingHeader?.detach();
	renderColumnHeader(ctx, treeEl);
	const header = treeEl.querySelector(':scope > .pbl-cols');
	if (header && header !== treeEl.firstChild) treeEl.insertBefore(header, treeEl.firstChild);
```

`:scope >` matters: a board column's own header must not be claimed by the tree's.

Note the deliberate simplicity — the header is rebuilt, not diffed. It is one element per pass against several hundred rows, and giving it its own signature would be the second reuse rule this design is avoiding.

```ts
// ponytail: the header is rebuilt every pass. One element against N rows; give it a
// signature only if a measurement says it matters.
```

- [ ] **Step 6: Reconcile the forest**

`renderForest` walks a container with a cursor, claiming or building at each position, and prunes what is left. `renderItem` returns the node after the row and its group.

```ts
/**
 * Render a sibling group, skipping hidden items so aria positions stay true.
 *
 * The walk claims rather than builds where it can: an element whose path is indexed and
 * whose signature is unchanged is moved into place instead of rebuilt. With an empty
 * index and an empty container this is exactly a build, which is why there is one path
 * here and not two.
 */
function renderForest(ctx: RowContext, containerEl: HTMLElement, siblings: BacklogItem[], start?: ChildNode | null): void {
	const visible = siblings.filter((item) => !ctx.host.isRowHidden(item));
	let cursor: ChildNode | null = start === undefined ? containerEl.firstChild : start;
	visible.forEach((item, i) => {
		cursor = renderItem(ctx, containerEl, item, { pos: i + 1, count: visible.length }, cursor);
	});
	// Everything after the last claimed node is a row this pass did not draw.
	while (cursor) {
		const next: ChildNode | null = cursor.nextSibling;
		if (cursor instanceof HTMLElement) forgetElement(ctx, cursor);
		cursor.detach();
		cursor = next;
	}
}
```

`renderTree` calls it with the header's `nextSibling` as `start`, so the prune above never reaches the header.

`renderItem` gains the cursor parameter and a claim branch. The rules it has to keep, each one a review finding from the spec:

- The row and its `.pbl-children` group are **one structural unit**. The group is the row's **next sibling**, not its descendant — `childGroupEl` builds it in the container and `refreshRowChildren` reaches it by `row.nextElementSibling`. Moving, replacing and detaching all take both.
- **Whether a group should exist is asked of the item, never of what happened to the row.** The condition is the one `renderItem` already computes — any visible child, and not collapsed — and it is answered the same way whether the row was kept, replaced or built:
  - it should exist and one is there → reuse that element and recurse into it, **after re-writing its `--pbl-depth`**;
  - it should exist and none is there → create it;
  - it should not exist and one is there → `forgetElement` it and detach.

  Writing this as "a replaced row keeps its group, a new row creates one" is wrong in both directions, and `Collapse all` is the case that shows it: it flips `collapsed`, so the signature changes and the row is replaced, and a keep-the-group rule would leave the collapsed descendants on screen. Expanding a row that was already indexed is the mirror — the row is not new, and it needs a group it does not have.

  Reusing the group where it survives is still what keeps a reordered parent from rebuilding its whole subtree, which is the cost this task exists to remove. It is just not the rule; it is one branch of it.

  **A group is an element with state too**, so ask it the same question the rows get: what does it draw from? `childGroupEl` writes `--pbl-depth` from `item.depth` and nothing else, and it writes it **only at creation**. Reparent an expanded item to a different depth and its row rebuilds — `depth` is in the signature — while the reused group keeps the old indent guide. So a claimed group has that one property re-written from the current item. One line, and cheaper than recreating the group and its subtree with it.

  Extract the claim-or-create into a small helper beside `childGroupEl` rather than inlining three branches into `renderItem`; `childGroupEl` becomes its create arm, and the depth write is then stated once for both arms instead of once per caller.
- `forgetElement` drops the detached element's path **and every path in its group** from `ctx.rows` and `ctx.sigs` — the job `forgetSubtree` does today, reached from the DOM rather than from the model, because the model no longer describes what is on screen at that point.
- Every claim and every build writes `ctx.sigs.set(path, sig)`, so the next pass compares against what this pass actually drew — **except a volatile row**, below.

- [ ] **Step 6c: A row that drew someone else's content can never be claimed**

The column gate asks where a value comes FROM. It cannot ask what the value renders INTO, and that is a second hole: `renderValue` hands the value to `Value.renderTo`, so a `note.related` holding `[[Other note]]` draws a link whose text belongs to another note, and an embed draws that note's content outright. Change the other note and this row's frontmatter — and so its signature — is identical.

This is not hypothetical: it is the exact scenario of the live-vault check in Task 7. Written as it stands, the guard would call that column reusable and the check would find a stale cell. A design whose own verification contradicts it is wrong at the design, not at the verification.

Predicting which values do this is the losing move — it means reimplementing Bases' renderer in a predicate. **Ask the cell what it actually drew.** `renderValue` already inspects `valueEl` after `renderTo` (it reads `textContent` to decide emptiness), so the question goes where the looking already happens:

```ts
	// Did this cell draw something belonging to ANOTHER note? A link's text is the
	// target's, an embed's content is the target's outright, and neither moves this
	// note's frontmatter when it changes. Asked of the rendered DOM rather than of the
	// value, because predicting what Bases' renderer produces means reimplementing it.
	const external = valueEl.querySelector('a, .internal-embed, img') !== null;
```

Thread that answer up: `renderCell` and `renderPropCells` return it alongside what they already return, and `renderItem` uses it in one line:

```ts
	// A volatile row is indexed — selection and subtree refresh still need to find it —
	// but never SIGNED, so the next pass's `sigs.get(path) === sig` can never match and
	// the row is rebuilt. One line, and no second structure to keep in step with `sigs`.
	if (volatile) ctx.sigs.delete(item.file.path);
	else ctx.sigs.set(item.file.path, sig);
```

Note what this costs, in the report and in the ADR: a vault whose columns are all link-valued gets no reuse at all, and pays one `querySelector` per cell for the privilege. A vault whose value columns are text, numbers and dates — which includes the harness fixture Task 6 measures with — keeps the whole win. If Task 6 shows the reconcile never activating on a realistic column set, that is the signal that this rule is too blunt, and the per-cell refresh named in `reusableColumns` is the upgrade.

Add to `test/view/rowReuse.test.ts`:

```ts
	it('never keeps a row whose value cell drew a link', () => {
		const vault = backlog();
		vault.setFrontmatter('Alpha.md', {
			type: 'Feature', order: 10, status: 'Open', parent: '[[Epic]]', related: '[[Gamma]]',
		});
		const { view, containerEl, config } = makeView(vault, { stateKey: 'status' });
		config.order = ['note.related'];
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');
		const other = rowByTitle(containerEl, 'Beta');

		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
		// And only that row: a link in one cell must not cost the whole pass its reuse.
		expect(rowByTitle(containerEl, 'Beta')).toBe(other);
	});
```

Whether the fake entry's `renderTo` produces an anchor at all is a harness question — read `test/helpers/` and check. **If it does not, this test cannot be written honestly here**: say so in the report, drop the test rather than asserting against a stub that cannot reproduce the case, and make the live-vault check in Task 7 carry it instead. Do not weaken the source rule to match what jsdom can show.

- [ ] **Step 6b: Let the drag controller clean up after itself**

A kept row wears whatever it was wearing, and the tree's native drag puts four things on rows that no signature knows about. Today none of it matters because the rows are destroyed. `DragDropController.onRenderStart` currently drops its two references without cleaning them:

```ts
	/** Rows are about to be rebuilt; drop the references to the old indicator and source rows. */
	onRenderStart(): void {
		this.activeDropRow = null;
		this.dragSourceRow = null;
	}
```

The reconcile must **not** answer this by clearing `.pbl-drop-*` in `renderForest`. A reconcile that enumerates another module's classes is the same "list of the places somebody thought of" this design refuses everywhere else — and the list is already longer than that one entry: `pbl-drop-before`, `pbl-drop-after`, `pbl-drop-inside`, `pbl-drag-source`, and `pbl-hover-expanding`.

The controller owns them, so the controller cleans them. In `src/view/interactions/dragDrop.ts`, make `onRenderStart` remove the drop and source classes from the rows it is about to forget, and cancel the hover expand — `cancelHoverExpand()` already removes `pbl-hover-expanding` and clears the timer. Rewrite the doc comment: rows are no longer necessarily rebuilt, which is exactly why the cleanup can no longer be left to their destruction.

**There is an eighth capture site here**, and it is not in the lint rule's reach:

```ts
		const timer = window.setTimeout(() => {
			…
			if (this.host.setCollapsed(path, false)) {
				this.host.refreshSubtree(item);
			}
		}, 600);
```

`scheduleHoverExpand` closes over `item` for 600 ms. An external data update landing mid-hover used to destroy the row under it; with reuse, the timer can fire against the previous model's item. Cancelling the hover expand in `onRenderStart` is what closes it — the timer never survives a render, so there is nothing stale to fire. Do it that way rather than by resolving the item inside the callback: the pending expand is about a gesture that the render has already invalidated, and running it late would expand a row the user is no longer hovering.

Note in the report that this site exists and why the Task 3 lint rule does not cover it — the rule is scoped to `render/rows.ts` and `render/columns.ts`, and this is `interactions/dragDrop.ts`. Do not widen the rule here; that is a decision for the final review with the whole diff in view.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/rowReuse.test.ts test/view/rowControls.test.ts`
Expected: PASS, all of them — including the Task 3 disclosure test, which now exercises the case it was written for.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS. Pay attention to `test/view/contextRowWrites.test.ts` and `test/view/renderCost.test.ts` — the first drives every write path against context rows, the second counts config lookups per pass. Neither should need editing. If one does, the reconcile changed behaviour and the test is right.

- [ ] **Step 9: Watch the guard actually guard**

Temporarily change `reusableColumns` to `return true`. Run the `file.mtime` test.
Expected: it still passes, because jsdom's fake entry does not make `file.mtime` change. **That is the honest result and it is not a check.** Say so in the test file: the guard's real failure needs a vault where `file.mtime` moves, which is the live-vault check Task 7 files. What the test holds is that the predicate is *consulted*, not that its absence is caught.

Restore `reusableColumns`.

- [ ] **Step 10: Run the gate and commit**

```bash
npm run check
git add src test
git commit -m "Keep the rows a data update did not change

The walk claims an element whose path is indexed and whose signature is
unchanged, and builds where it cannot -- which with an empty index is
exactly the render it replaces, so there is one path here and not two."
```

---

### Task 6: Measure it

Nothing is claimed until it is measured, and this quantity has had two instruments lie about it. Read `## Partly addressed` and `## Lesson` in the bug note before starting.

**Files:**
- No source change. This task produces numbers.

- [ ] **Step 1: Build a baseline**

```bash
git stash list   # confirm nothing is stashed
git worktree add /tmp/backlog-baseline main
cd /tmp/backlog-baseline && npm ci && npm run build
```

- [ ] **Step 2: Run the A/B**

```bash
cd - && npm run perf -- --against /tmp/backlog-baseline
```

If `--against` takes a bundle path rather than a directory, read `scripts/` for what it wants. Do not run the two builds at different times and subtract — that is the retracted measurement, and this environment's drift is larger than what it would resolve.

- [ ] **Step 3: Read it correctly**

Record the medians of the panel's medians, 832 rows, folder fixture, tree expanded, for `update`, `render only`, `mount (collapsed)` and each projection switch. Then ask two questions before believing any of it:

- **Do the spreads overlap?** A delta between overlapping spreads is this environment's drift, which has been read as a finding here twice. Alternate more runs rather than reporting it.
- **How big is the constant, and does it hold at every size?** `update` will still be **linear in the visible rows**, and expecting otherwise is a mistake this plan made until review caught it: `renderForest` visits every visible item and `rowSignature` serializes each one's frontmatter whether the row is kept or not. The walk is the floor, and it is inherent — skipping it needs provenance, which `onDataUpdated()` cannot give.

  So the claim is a **constant-factor cut**, and the number to report is the per-row cost: run `?notes=200`, `?notes=800` and `?notes=1600`, divide `update` by the row count at each, and check the per-row figure fell and stayed roughly flat across sizes. A per-row cost that falls at 200 and rises again at 1600 means the signature walk is eating the saving — that is Risk 4 in the spec arriving, and the reference-comparison upgrade named there is the answer.

  **Only virtualisation changes the class**, which is the refused-for-now alternative in ADR 0029, and this measurement is the evidence for or against ever taking it. Say which the numbers support.

- [ ] **Step 4: Write the numbers down**

Put the table in the scratchpad for Task 7. Carry both honesty notes with it: the harness's fake `entry` has no `renderTo`, so a real vault pays more per row and this is a **lower bound with a known direction and an unknown size**; and mount cost is untouched by this change, which is virtualisation's argument and not this one's.

- [ ] **Step 5: Clean up**

```bash
git worktree remove /tmp/backlog-baseline
```

---

### Task 7: Close the register

**Files:**
- Modify: `docs/bugs/The render is the whole cost of a data update.md`
- Modify: `docs/adrs/0029-reconcile-rows-by-signature.md`
- Modify: `CHANGELOG.md`
- Modify: `src/view/CLAUDE.md`
- Create: `docs/tests/cases/<a name for the live-vault check>.md`

- [ ] **Step 1: The bug note**

Add `## Fix` — the change, and **the test that fails without it** (`test/view/rowReuse.test.ts`, by name). Add the A/B table from Task 6 in the shape the existing `## Partly addressed` tables use, with the per-row figures at all three sizes.

**On whether to close it.** An earlier draft of this plan said to close only on a class change. That was wrong, and it would have left the note open forever: the reconcile keeps the walk, so the cost stays linear by construction and only virtualisation changes that. Judge it on the symptom the note actually reports instead — *"a vault of roughly 800 notes … is sluggish"*, half a second after every write:

- If the 832-row `update` is now fast enough that the pause is gone, close it. Say in the outcome that the **class is unchanged and why**, and that virtualisation is what would change it, with ADR 0029's `## Revisit when` as the pointer. A note closed on a symptom, with its limit written down, is honest; one left open against a criterion nothing can meet is not.
- If the pause is still there, leave it open and say what the numbers were. Do not close a P1 on a percentage that did not reach the complaint.

The note's own `## Lesson` is about believing a number too early. This paragraph is that lesson applied to the criterion rather than to the measurement.

Keep `## Where to look`, `## Live-vault checks owed` and `## How to check` — they are still true and the last is how anyone re-runs this.

- [ ] **Step 2: The ADR's consequences**

Fill `## Consequences` in ADR 0029 with what actually happened, including the measured numbers and what got harder. If Task 6 disagreed with the design's expectation, the ADR says so — a record that only reports the good half has not been thought about.

- [ ] **Step 3: The changelog**

Add to `## [Unreleased]` → `### Fixed`, written for someone deciding whether to upgrade, not for the commit log. Name what they will feel — the pause after a write on a large backlog — and the one condition where it does not apply (a column that is not a note property). No implementation detail.

- [ ] **Step 4: The view guide**

`src/view/CLAUDE.md`'s Cost section still says *"Data updates still rebuild everything — skipping that needs to account for arbitrary chip property values."* That sentence is now the history of this change. Replace it with what holds, and write the guarantee to the check: what the fingerprint refuses, what the signature covers, that a row is no longer a clean slate, and that a new per-item rendering term has to join `rowSignature` because nothing will tell you it is missing.

- [ ] **Step 5: The live-vault check**

Create a `Test case` under `docs/tests/cases/` — `type: Test case`, an `order`, `status: Open`, a `cadence: release`, a `parent` naming a `Test suite` in `docs/tests/suites/`, and the shape that folder documents: `Why this exists`, a **Preconditions** line, `## How to check`, `Acceptance criteria`, `## Outcome`.

What it checks is the one thing this repository cannot: a real Bases `renderTo` cell — a link, an embed, a date — must not go stale on a kept row. Steps: open a vault with a `note.*` link column, edit the linked note's title, and confirm the cell redraws. Then add a `file.mtime` column and confirm rows rebuild on every update.

`docs-check.mjs` holds `## How to check` and `cadence:` to each other: both present or both absent.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add docs CHANGELOG.md src/view/CLAUDE.md
git commit -m "Record what the reconcile cost and what it bought"
```

- [ ] **Step 7: Push and open the pull request**

```bash
git push -u origin claude/next-increment-brainstorm-nlpsnh
```

Fill `.github/PULL_REQUEST_TEMPLATE.md`'s two sections. The third checkbox applies: this needs a live-vault check `npm run check` cannot run, and the test case from Step 5 names it.

---

## Self-Review

**Spec coverage.** Step 1 of the spec (delegation) is Tasks 2 and 3, including the seventh site review found. Step 2 (the reconcile) is Task 5, with all three non-row things — the clear, the header, the child groups — as named steps. The signature and the fingerprint are Task 4. The gate's two arms (render inputs, non-frontmatter columns) are `renderInputs` and `reusableColumns`. All four risks are covered: transient classes in Task 5 Step 6, `rowEls` accuracy in Steps 3 and 6, the early returns in Step 4's `clearRowIndex`, and the frontmatter term's cost in Task 6 Step 3. Measurement is Task 6, the checks are spread across Tasks 2–5, and the register artifacts are Task 7.

**One thing the spec did not anticipate**, added here: `backlogView.ts` had two lines of headroom, so Task 1 exists. The register had already predicted this increment would meet that task.

**Placeholders.** Three places name a guess and say to read the file rather than trust it — the harness's frontmatter setter, the label chip's discriminator, and the show-counts host method. Each names the file that holds the answer. That is deliberate: inventing a signature I have not read would be the failure mode, not the fix.

**Type consistency.** `renderInputs`, `reusableColumns` and `rowSignature` are used in Task 5 exactly as Task 4 declares them. `RowContext.sigs`, `RenderPassDeps.lastInputs` and `RenderPassResult.inputs` are declared in Task 5's Interfaces block and used in its steps. `itemForEvent` is declared in Task 2 and consumed in Task 3. `clearRowIndex()` is introduced in Task 5 Step 4 and declared on the host there.
