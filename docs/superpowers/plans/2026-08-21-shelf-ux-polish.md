# Shelf UX/UI polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the shelf's resize grip on a sized band, give the iteration board's shelf the
picks the roadmap's already has, lay a compact row out in aligned columns, and stop a
shelved parent's children reading as a sibling row.

**Architecture:** Four changes over one surface. Three of them add nothing new — they reuse
mechanisms this codebase already has: the tree's stored per-column widths (published on the
band rather than inherited), the tree's fold chevron and indent guide, and the `kidsEl` parameter's own
shape for a second optional element. The one genuinely new module is a five-line resolver
that answers "which shelf is on screen", so the header's controls stop reading
`host.roadmap` directly.

**Tech Stack:** TypeScript, Obsidian 1.12 Bases custom view API, vitest + jsdom, plain CSS
partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-21-shelf-ux-polish-design.md`

## Global Constraints

- `npm run check` must pass before every commit — build, lint, coverage-thresholded tests,
  fallow, docs register. All five. CI runs the same on Ubuntu **and** Windows.
- Every module in `src/` must be specified by a `docs/` note — a use case's
  `## Where it lives` or an ADR's `## Decision`. A NEW module with no note fails
  `npm run docs`. Add the note edit in the same task that adds the module.
- Coverage thresholds in `vitest.config.mts` only ever go up, never down.
- 400-line lint cap per `src/` file and per `styles/` partial; 450 lines per `test/` file.
- Sentence-case UI text. No user-visible English literal in `src/view/render/`,
  `src/view/interactions/` or `src/i18n`-swept directories — every sentence goes through
  `t()` against `src/i18n/en.ts`.
- Never write frontmatter outside `storage/frontmatter.ts` and `storage/createNote.ts`.
  Nothing in this plan writes anything to a note.
- An invariant asserted in a comment gets a test that fails without it, and the test is
  **watched failing**: revert the fix, run it, see red, restore.
- jsdom lays nothing out. A geometry claim is asserted as the stylesheet DECLARATION
  (`bodyOf` from `test/helpers/cssVars.ts`) and measured in `npm run harness`; appearance
  in a themed vault stays the live-vault sweep's (ADR 0020).
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS
  ```

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `styles/shelfControls.css` | modify | The grip's auto margin (Task 1); the fold slot (Task 5) |
| `src/view/shelfSurface.ts` | **create** | Which shelf is on screen, its cards, whether it is shut (Task 2) |
| `src/view/host.ts` | modify | `BoardSnapshot.shelf` (Task 2) |
| `src/view/render/iterationBoard.ts` | modify | Return the shelf's cards; `picks: true`; tab stops (Tasks 2, 3) |
| `src/view/render/shelfControls.ts` | modify | `showTypeMenu` / `runSearch` read the resolver (Task 2) |
| `src/view/interactions/menu.ts` | modify | `addShelfSection` serves the iteration board (Task 3) |
| `src/i18n/en.ts` | modify | Five keys stop saying "unplaced" (Task 3) |
| `src/view/render/shelf.ts` | modify | `holdEmpty` cells; the fold slot; `toggleEl` (Tasks 4, 5) |
| `src/view/render/board.ts` | modify | `renderCardBody` passes `holdEmpty` and `toggleEl` through (Tasks 4, 5) |
| `src/view/render/cardChildren.ts` | modify | `toggleEl`, and the count as a number in list mode (Task 5) |
| `styles/shelf.css` | modify | The aligned row, the group header, the children (Tasks 4, 5) |

---

### Task 1: The grip sits at a sized band's foot

**Files:**
- Modify: `styles/shelfControls.css` (the `.pbl-shelf-grip` block)
- Test: `test/view/shelfResize.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Self-contained CSS.

**Why:** `position: sticky` never MOVES an element — it holds one inside its scrollport
when scrolling would carry it away, and does nothing otherwise. With a picked height and
content shorter than it, flow puts the grip under the last group and sticky has no reason
to act. Measured with every type group folded and a 400px pick: the grip's bottom sits
139px above the band's foot.

- [ ] **Step 1: Write the failing test**

Add to `test/view/shelfResize.test.ts`, inside the existing `describe` block that holds
the `flex-shrink` selector test (search for `'states the shrink refusal at a specificity
that beats the dated axis'` and put this beside it):

```ts
it('is pushed to the foot of a band taller than its cards', () => {
	// `position: sticky` never MOVES an element — it holds one inside its scrollport when
	// scrolling would carry it away, and does nothing at all otherwise. A band with a
	// picked height and less content than that leaves the grip in flow, directly under the
	// last group: measured in the browser harness with every type group folded and a 400px
	// pick, the grip's bottom sat 139px above the band's foot, and −5px with this margin
	// (which is where it sits when the band DOES overflow, so the two states now agree).
	//
	// Scoped to `.pbl-shelf-sized` in both directions. An unpicked band is `height: auto`,
	// so its grip is already at the foot and there is no free space for an auto margin to
	// consume — and the base rule's `margin-block-start: calc(-1 * var(--size-4-2))` is the
	// gap-cancel extension 1e's measurement depends on, which an unscoped `auto` would
	// silently drop. Measured: the unpicked band stayed at 219px.
	const css = readFileSync('styles/shelfControls.css', 'utf8');
	expect(bodyOf(css, '.pbl-shelf-sized .pbl-shelf-grip', 'styles/shelfControls.css')).toContain(
		'margin-block-start: auto;',
	);
	// And the base rule keeps the negative pull, which is what the unpicked band is sized by.
	expect(bodyOf(css, '.pbl-shelf-grip', 'styles/shelfControls.css')).toContain(
		'margin-block-start: calc(-1 * var(--size-4-2));',
	);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/shelfResize.test.ts -t 'pushed to the foot'
```

Expected: FAIL — `bodyOf` throws or returns nothing for `.pbl-shelf-sized .pbl-shelf-grip`,
because no such rule exists yet.

- [ ] **Step 3: Add the rule**

In `styles/shelfControls.css`, directly after the `.pbl-shelf-grip` block (before
`.pbl-shelf-grip::after`), add:

```css
/* **Sticky holds; it does not push.** The grip is the band's last flex item, so on a band
   the reader has SIZED taller than its cards, flow leaves it under the last group and
   `position: sticky` has nothing to do — measured in the browser harness with every type
   group folded and a 400px pick, its bottom sat 139px above the band's foot, and −5px with
   this margin, which is exactly where it sits when the band overflows. The two states agree
   now instead of disagreeing by the band's spare room.

   Scoped to the sized band in BOTH directions rather than written on the rule above. An
   unpicked band is `height: auto`, so its grip is already at the foot and there is no free
   space for an auto margin to eat; and an auto margin there would replace the negative pull
   above, which is the gap-cancel [[Resizing the shelf]] extension 1e measures the
   content-sized band by. Measured: the unpicked band is 219px with and without this. On an
   overflowing band the auto margin resolves to 0 and sticky pins the strip exactly as
   before. */
.pbl-shelf-sized .pbl-shelf-grip {
	margin-block-start: auto;
}
```

- [ ] **Step 4: Watch it pass, then watch it fail again**

```bash
npx vitest run test/view/shelfResize.test.ts
```

Expected: PASS. Now delete the `margin-block-start: auto;` line, re-run, see the new test
go red, and restore it. That is the watched-failing rule and it is not optional.

- [ ] **Step 5: Record it in the register**

In `docs/requirements/Resizing the shelf.md`, add this extension to the `**Extensions**`
list, after `2c`:

```markdown
- **2f — the band is taller than its cards, and the grip is not at its foot.** It is now.
  `position: sticky` holds an element inside its scrollport when scrolling would carry it
  away and does nothing otherwise, so a band with a picked height and less content than that
  left the grip in flow, under the last group: measured with every type group folded and a
  400px pick, its bottom sat 139px above the band's foot. An auto start margin puts it on
  the edge the gesture actually moves — −5px, the same offset it has when the band
  overflows. Scoped to the band that HAS a pick, because an unpicked band is content-sized
  and has no spare room to push into, and because the negative pull it would replace is what
  1e measures. Reported from a vault, 2026-08-21.
```

Then run the register gate:

```bash
npm run docs
```

Expected: `✓ register and ADRs consistent`.

- [ ] **Step 6: Full check and commit**

```bash
npm run check
git add styles/shelfControls.css test/view/shelfResize.test.ts "docs/requirements/Resizing the shelf.md"
git commit -m "fix: put the shelf grip at a sized band's foot

Sticky holds an element inside its scrollport; it never pushes one down.
A band with a picked height and fewer cards than that left the grip in
flow under the last group — measured at 139px above the band's foot with
every type group folded and a 400px pick.

Scoped to the sized band, so the unpicked band keeps the negative pull
extension 1e measures it by.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
```

---

### Task 2: One resolver for "which shelf is on screen"

**Files:**
- Create: `src/view/shelfSurface.ts`
- Modify: `src/view/host.ts` (`BoardSnapshot`)
- Modify: `src/view/render/iterationBoard.ts`
- Modify: `src/view/render/shelfControls.ts` (`showTypeMenu`, `runSearch`)
- Modify: `docs/requirements/The shelf, organized.md` (`## Where it lives`)
- Test: `test/view/shelfSurface.test.ts` (create)

**Interfaces:**
- Consumes: `BacklogViewHost` (`src/view/host.ts`), `ShelfCard` (`src/domain/bars.ts`).
- Produces:
  ```ts
  export interface ActiveShelf {
      el: HTMLElement | null;
      cards: ShelfCard[];
      collapsed: boolean;
  }
  export function activeShelf(host: BacklogViewHost): ActiveShelf;
  ```
  Task 3 calls `activeShelf` from `src/view/interactions/menu.ts`.

**Why a new module rather than a function in `shelfControls.ts`:** `render/shelfControls.ts`
imports `interactions/menu.ts` for `showMenuAtElement`. Task 3 needs `interactions/menu.ts`
to call this resolver, and an import back would be a cycle. `src/view/` root is where
helpers both directories may reach already live (`childrenList.ts`, `projection.ts`).

- [ ] **Step 1: Write the failing test**

Create `test/view/shelfSurface.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfOf } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { activeShelf } from '../../src/view/shelfSurface';

useViewHarness();

/**
 * Which shelf is on screen. Three surfaces draw one — the roadmap's two axes and the
 * iteration board — and the header's controls used to read `host.roadmap` directly, so on a
 * board they resolved to nothing and did nothing.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
	return vault;
}

describe('the shelf on screen', () => {
	it('is the roadmap’s where the roadmap drew one', () => {
		const { view, containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: false });
		const shelf = activeShelf(view);
		expect(shelf.el).toBe(shelfOf(containerEl));
		expect(shelf.cards.length).toBeGreaterThan(0);
		expect(shelf.collapsed).toBe(false);
	});

	it('is the iteration board’s where that is what drew one', () => {
		// The band the board draws is a POPULATION rather than a placement, and its collapse
		// is a column fold rather than the roadmap's own bit — so a resolver that read
		// `host.roadmap` answered null here and every control above it did nothing.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Sprint 12.md');
		const shelf = activeShelf(harness.view);
		expect(shelf.el).not.toBeNull();
		expect(shelf.cards.map((card) => card.item.title)).toEqual(['Uncommitted']);
		expect(shelf.collapsed).toBe(false);
	});

	it('reports a collapsed board shelf from the column fold that shuts it', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Sprint 12.md');
		harness.view.setColumnCollapsed('backlog', null, true);
		expect(activeShelf(harness.view).collapsed).toBe(true);
	});

	it('answers with nothing on a projection that draws no shelf', () => {
		const { view } = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		const shelf = activeShelf(view);
		expect(shelf.el).toBeNull();
		expect(shelf.cards).toEqual([]);
		expect(shelf.collapsed).toBe(false);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/shelfSurface.test.ts
```

Expected: FAIL — `Cannot find module '../../src/view/shelfSurface'`.

- [ ] **Step 3: Add the shelf's cards to the board snapshot**

In `src/view/host.ts`, add to `BoardSnapshot` directly after the `shelfEl` member:

```ts
	/**
	 * The cards that band holds, unnarrowed — the roadmap's snapshot carries its own the
	 * same way and for the same reason. A control that rebuilt the pane reads what was
	 * DRAWN rather than re-deriving it, since a second derivation is a second answer to
	 * keep in step. Empty on the two boards that draw no shelf.
	 */
	shelf?: ShelfCard[];
```

Add the import at the top of `src/view/host.ts` if `ShelfCard` is not already imported:

```ts
import { ShelfCard } from '../domain/bars';
```

- [ ] **Step 4: Return it from the iteration board**

In `src/view/render/iterationBoard.ts`, change `renderIterationShelf` to return both, and
the caller to pass both through.

Replace the signature and return of `renderIterationShelf`:

```ts
function renderIterationShelf(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	model: BacklogModel,
): { el: HTMLElement; cards: ShelfCard[]; drawn: BacklogItem[] } {
```

and its last two lines — returning BOTH lists, which are two different questions and were
one array in the first draft (Codex, PR #187, P1):

```ts
	// `cards` is the band's whole population, unnarrowed, which is what the card menu's type
	// filter has to be built from: hiding a type must never remove its own way back. `drawn`
	// is what `renderShelf` actually put on screen — narrowed by the search and the hidden
	// types, and empty when the band is collapsed or every group is folded. The tab-stop
	// decision in Task 3 is about what a reader can REACH, so it is the second of these; the
	// first stays positive on a band that is drawing nothing and would have kept the controls
	// out of the tab order in exactly the state they are needed.
	return { el: shelf.el, cards, drawn: shelf.cards };
```

Add `ShelfCard` to the imports from `../../domain/bars`:

```ts
import { ShelfCard } from '../../domain/bars';
```

In `renderIterationBoard`, change the call and the returned object:

```ts
	const shelf = renderIterationShelf(ctx, boardEl, dnd, model);
```

and in the returned object replace `shelfEl,` with:

```ts
		shelfEl: shelf.el,
		shelf: shelf.cards,
```

Import `BacklogItem` from `../../domain/model` if it is not already imported there.

- [ ] **Step 5: Write the resolver**

Create `src/view/shelfSurface.ts`:

```ts
import { BacklogViewHost } from './host';
import { ShelfCard } from '../domain/bars';

/**
 * Which shelf is on screen, what it holds, and whether it is shut.
 *
 * Three surfaces draw a band — the roadmap's two axes and the iteration board — and every
 * control above one has to act on the one in front of the reader. They read `host.roadmap`
 * directly until 2026-08-21, which answered null on a board: the pickers were withheld
 * there partly for that reason, and a control that HAD been drawn would have opened a menu
 * over an empty array.
 *
 * Its own module at the view's root rather than a function in `render/shelfControls.ts`,
 * because `interactions/menu.ts` needs it too and that file is already imported BY
 * `shelfControls.ts` — the obvious home would be a cycle. `childrenList.ts` and
 * `projection.ts` beside it are the same shape: something both directories reach.
 *
 * The two bands answer `collapsed` from different bits and neither may be guessed from the
 * other. The roadmap's is the view-state store's `shelfExpanded`; the iteration board's is a
 * COLUMN fold (`'backlog'`), which is the same mechanism its type groups already use and
 * which defaults to OPEN. That difference is the whole reason this returns the answer rather
 * than the snapshot.
 */
export interface ActiveShelf {
	/** The band's element for this render, or null where no band was drawn. */
	el: HTMLElement | null;
	/** Everything the band holds, before any narrowing — never what the filter leaves. */
	cards: ShelfCard[];
	/** Whether it is shut, from whichever bit shuts THIS band. */
	collapsed: boolean;
}

export function activeShelf(host: BacklogViewHost): ActiveShelf {
	const roadmap = host.roadmap;
	if (roadmap) {
		return { el: roadmap.shelfEl, cards: roadmap.roadmap.shelf, collapsed: host.shelfCollapsed };
	}
	const board = host.board;
	if (board?.shelfEl) {
		return { el: board.shelfEl, cards: board.shelf ?? [], collapsed: host.columnCollapsed('backlog', null, false) };
	}
	return { el: null, cards: [], collapsed: false };
}
```

- [ ] **Step 6: Run the new test**

```bash
npx vitest run test/view/shelfSurface.test.ts
```

Expected: PASS, all four.

- [ ] **Step 7: Point the two header controls at the resolver**

In `src/view/render/shelfControls.ts`, add the import:

```ts
import { activeShelf } from '../shelfSurface';
```

Replace the first three lines of the body of `showTypeMenu`:

```ts
function showTypeMenu(host: BacklogViewHost): void {
	const surface = activeShelf(host);
	const shelf = surface.cards;
	const btn = surface.el?.querySelector<HTMLElement>('.pbl-shelf-filter');
```

and in `runSearch`, replace the line reading the input:

```ts
	const input = activeShelf(host).el?.querySelector<HTMLInputElement>('.pbl-shelf-search-input');
```

Update the comment above `showTypeMenu`'s "Everything is re-read from the host" paragraph
so it says the band is re-resolved too — a comment that still says `host.roadmap` is an
unchecked claim about code that no longer does that.

- [ ] **Step 8: Register the new module**

`docs-check.mjs` rule 7 refuses a `src/` module no note specifies. In
`docs/requirements/The shelf, organized.md`, add to `## Where it lives`, after the
paragraph about the interactive controls:

```markdown
WHICH band those controls act on is `activeShelf` in `src/view/shelfSurface.ts`, and it is
one function because there are three bands and two ways of being shut. The roadmap's
collapse is the view-state store's own bit; the iteration board's is a `'backlog'` column
fold, the same mechanism its type groups use. The controls read `host.roadmap` directly
until 2026-08-21, which is why they could not be offered on a board at all: on one, the
resolution answered null and a drawn picker would have opened a menu over an empty array.
It sits at the view's root rather than in `render/shelfControls.ts` because
`interactions/menu.ts` needs it too, and that file is already imported by `shelfControls.ts`
— the obvious home would be an import cycle.
```

Add `src/view/shelfSurface.ts` to that note's `files:` frontmatter list.

- [ ] **Step 9: Full check and commit**

```bash
npm run check
git add src/view/shelfSurface.ts src/view/host.ts src/view/render/iterationBoard.ts \
        src/view/render/shelfControls.ts test/view/shelfSurface.test.ts \
        "docs/requirements/The shelf, organized.md"
git commit -m "refactor: resolve which shelf is on screen in one place

The header's type filter and search read host.roadmap directly, so on the
iteration board they resolved to nothing. One resolver answers the band,
its cards and whether it is shut — the last from different bits per band,
which is why it returns the answer rather than the snapshot.

At the view's root because interactions/menu.ts needs it and is already
imported by render/shelfControls.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
```

---

### Task 3: The iteration board's shelf carries the picks

**Files:**
- Modify: `src/view/render/iterationBoard.ts` (`picks: true`, `syncShelfTabStops`)
- Modify: `src/view/interactions/menu.ts` (`addShelfSection`)
- Modify: `src/i18n/en.ts` (five keys stop saying "unplaced")
- Modify: `docs/requirements/Cards or a list on the shelf.md` (extension 1b)
- Modify: `docs/requirements/Searching the shelf.md`
- Test: `test/view/iterationShelf.test.ts`

**Interfaces:**
- Consumes: `activeShelf` from Task 2.
- Produces: nothing new. Behaviour only.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/iterationShelf.test.ts`, inside the top-level `describe('the iteration
shelf', ...)`:

```ts
	describe('its picks', () => {
		/** Every control the roadmap's header carries, by class. */
		const CONTROLS = ['.pbl-shelf-layout', '.pbl-shelf-sort', '.pbl-shelf-filter', '.pbl-shelf-search-input'];

		it('draws the same four controls the roadmap’s header does', () => {
			// Withheld until 2026-08-21 because their keyboard path — the card menu's shelf
			// section — was the roadmap's alone. It is not any more, so the reason is gone and
			// the band that most needs narrowing (a backlog, not a handful of unplaced notes)
			// gets the same controls.
			const { containerEl } = onSprint(sprintVault());
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) expect(shelf?.querySelector(control)).not.toBeNull();
		});

		it('narrows the band by the search, and keeps the count the true total', () => {
			const vault = sprintVault();
			vault.addFile('Another idea.md', { frontmatter: { type: 'PBI', order: 50, status: 'New' } });
			const { view, containerEl } = onSprint(vault);
			expect(shelfTitles(containerEl).sort()).toEqual(['Another idea', 'Uncommitted']);
			view.setShelfSearch('another');
			expect(shelfTitles(containerEl)).toEqual(['Another idea']);
			// The count is what the band HOLDS, never what the narrowing leaves — the roadmap's
			// own guarantee, and the reason a narrowing has to say on its face that it is one.
			expect(shelfCountOf(containerEl)).toBe('2');
		});

		it('narrows the band by the type filter', () => {
			const vault = sprintVault();
			vault.addFile('A task.md', { frontmatter: { type: 'Task', order: 60, status: 'New' } });
			const { view, containerEl } = onSprint(vault);
			expect(shelfTitles(containerEl).sort()).toEqual(['A task', 'Uncommitted']);
			view.setShelfHiddenTypes(new Set(['Task']));
			expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
		});

		it('offers the shelf section in a card’s menu, which is the keyboard’s way in', () => {
			// Every header control here is `tabindex="-1"` inside a composite pane, so this menu
			// is not a convenience: without it the four controls above are pointer-only and the
			// feature fails at its own purpose. The board's own rule, stated at its
			// hidden-match links.
			const { containerEl } = onSprint(sprintVault());
			Menu.lastShown = null;
			cardByTitle(containerEl, 'Uncommitted').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const titles = Menu.lastShown?.items.map((item) => item.titleText) ?? [];
			expect(titles).toContain('Shelf layout');
			expect(titles).toContain('Sort the shelf');
			expect(titles).toContain('Filter the shelf by type');
			expect(titles).toContain('Search the shelf...');
		});

		it('returns the controls to the tab order when the narrowing empties the pane', () => {
			// The state that makes a `-1` a trap rather than a convention: an iteration with
			// nothing committed draws empty columns, and a search narrow enough to empty the
			// shelf leaves no card anywhere — so no card menu, which is the only keyboard path
			// to these controls, and the column menu carries no shelf section. Without this the
			// reader cannot clear the search that put them there. (Codex, PR #187.)
			const { view, containerEl } = onSprint(sprintVault());
			view.setShelfSearch('nothing matches this');
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('0');
			}
		});

		it('keeps them out of it while cards are on screen, which is the composite’s rule', () => {
			const { containerEl } = onSprint(sprintVault());
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('withholds the section while the band is shut, as the header withholds the pickers', () => {
			const { view, containerEl } = onSprint(sprintVault());
			view.setColumnCollapsed('backlog', null, true);
			Menu.lastShown = null;
			columnByName(containerEl, 'New').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const titles = Menu.lastShown?.items.map((item) => item.titleText) ?? [];
			expect(titles).not.toContain('Sort the shelf');
		});
	});
```

Add the imports this needs at the top of the file:

```ts
import { Menu } from 'obsidian';
import { shelfCountOf } from '../helpers/roadmap';
```

(`shelfOf`, `shelfTitles`, `cardByTitle` and `columnByName` are already imported there.)

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run test/view/iterationShelf.test.ts -t 'its picks'
```

Expected: FAIL — no controls in the header, no shelf section in the menu.

- [ ] **Step 3: Reword the five keys that say "unplaced"**

The board's band is called `Backlog` and holds work committed to no fortnight — "unplaced"
is the roadmap's word for a different fact. Three of the five keys are also NAMED for it,
and the catalog is data a translator reads, so the name is context rather than decoration.

In `src/i18n/en.ts`:

| was | becomes |
| --- | --- |
| `'shelf.search': 'Search unplaced'` | `'shelf.search': 'Search the shelf'` |
| `'shelf.clearSearch': 'Clear unplaced search'` | `'shelf.clearSearch': 'Clear the shelf search'` |
| `'menu.sortUnplaced': 'Sort unplaced'` | `'menu.sortShelf': 'Sort the shelf'` |
| `'menu.filterUnplacedByType': 'Filter unplaced by type'` | `'menu.filterShelfByType': 'Filter the shelf by type'` |
| `'menu.searchUnplaced': 'Search unplaced...'` | `'menu.searchShelf': 'Search the shelf...'` |

`t()` derives its key type from the catalog, so `npm run build` names every call site of
the three renamed keys. Fix each — they are in `src/view/interactions/menu.ts` and
`src/view/interactions/shelfMenu.ts`. Keep the wording of the surviving comment above each
call honest: any comment that quotes the old sentence is now wrong.

- [ ] **Step 4: Turn the picks on**

In `src/view/render/iterationBoard.ts`, in `renderIterationShelf`, change `picks: false` to
`picks: true` and replace the paragraph in the doc comment that explains the refusal:

```
 * Reused rather than rewritten, and what that buys is one component: the type groups and
 * their folds, the card shell, the drop target and the auto-scroll a long shelf needs are
 * the ones already driven on the roadmap. What it is handed differs in the two things that
 * are genuinely this board's — no axis (a board states nothing about dependencies) and its
 * own name (this shelf is a POPULATION, never the roadmap's placement).
 *
 * It carries the PICKS as of 2026-08-21. They were withheld because the keyboard path for
 * a `tabindex="-1"` control here is the card menu's shelf section, which was built for the
 * roadmap alone — a reason about a missing path rather than about this band, and
 * `addShelfSection` serves both now. The band that most needs narrowing is this one: the
 * roadmap shelves what an axis could not place, and this holds the whole uncommitted
 * backlog.
```

Add the tab-stop sync — and it is asked of the CARDS, never hard-coded (Codex, PR #187,
P1). In `renderIterationBoard`, after the `renderBoard(...)` call rather than beside the
shelf, because the count is not final until the columns have drawn:

```ts
	const content = renderBoard(ctx, boardEl, dnd, board, {
		/* … the existing option bag, unchanged … */
	});
	// **The controls come back into the tab order when the pane holds no card**, which on this
	// board is reachable and is a trap rather than a curiosity: an iteration with nothing
	// committed draws empty columns, and a search or a type filter narrow enough to empty the
	// shelf then leaves no card anywhere — so no card menu, which is the ONLY keyboard path to
	// these controls, and `buildColumnMenu` on the empty columns carries folds and policy and
	// no shelf section at all. A keyboard reader would be left with a search they could not
	// clear. Hard-coding `true` here is what would do that, and the first draft of this plan
	// did (Codex, PR #187).
	//
	// **Asked of what was DRAWN, on both halves, and neither half may be a population count.**
	// `shelf.drawn` rather than `shelf.cards`: the second is the band's whole population, which
	// the card menu needs and which stays positive while a search hides every one of them. And
	// the columns are asked the way `renderBoardAdvisory` in this file already asks them —
	// `col.cards.length`, which a fold empties — rather than `board.cardCount`, which
	// `domain/board.ts` sums from the population before anything folds and which that
	// function's own comment calls "results-only by design". Every committed card in a folded
	// column plus a search that empties the shelf is the same trap through the other half.
	// (Codex, PR #187, three rounds — the first fix used the wrong array, the second the wrong
	// count.)
	syncShelfTabStops(shelf.el, content.board.columns.some((col) => col.cards.length > 0) || shelf.drawn.length > 0);
	return { ...content, shelfEl: shelf.el, shelf: shelf.cards };
```

Note what this does NOT do. `render/projections.ts` gives every board `role: 'listbox'`
whenever it renders, unlike the roadmap beside it, which asks its own card count — so on an
empty iteration board the pane already promises options it does not have, which that file's
own comment ("the listbox role is a promise of options, so it is made only where…") refuses.
That is a defect in three boards rather than in this one, with its own tests, and it is not
this PR's to fix. Report it; do not widen the change. The controls being reachable is the
half that matters to a reader stranded by their own filter.

and import it:

```ts
import { renderShelf, ShelfRemoval } from './shelf';
import { syncShelfTabStops } from './shelfControls';
```

- [ ] **Step 5: Serve the board from the card menu's shelf section**

In `src/view/interactions/menu.ts`, replace the body of `addShelfSection` up to the first
`menu.addSeparator()`:

```ts
function addShelfSection(host: BacklogViewHost, menu: Menu): void {
	const surface = activeShelf(host);
	if (surface.el === null || surface.cards.length === 0) return;
	// Nothing to order or narrow while the cards are shut away — the header withholds the
	// same controls for the same reason. Asked of the band on screen, because the roadmap's
	// collapse and the iteration board's are different bits.
	if (surface.collapsed) return;
	menu.addSeparator();
```

and replace `shelf` with `surface.cards` in the `addShelfTypeItems` call. Add the import:

```ts
import { activeShelf } from '../shelfSurface';
```

Rewrite the last paragraph of the function's doc comment, which currently says "On the
roadmap only":

```
 * On any surface that DREW a band, and only while it holds something — an entry for a
 * region that is not on screen is the defect in the other direction. That is the iteration
 * board as well as the roadmap since 2026-08-21, and it is what let the board's header
 * carry the pickers at all: this menu is their keyboard path, so offering the controls
 * without it would have been the pointer-only shelf the board's own hidden-match links
 * refuse.
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run test/view/iterationShelf.test.ts
npx vitest run test/view/shelfLayout.test.ts test/view/shelfSearch.test.ts test/view/shelfUx.test.ts
```

Expected: PASS. The roadmap suites must be untouched by this — if one fails, the resolver
picked the wrong band and the failure is real.

- [ ] **Step 7: Watch the new tests fail**

Set `picks` back to `false`, run `npx vitest run test/view/iterationShelf.test.ts -t 'its
picks'`, see red on the four control tests. Restore. Then re-add the
`host.projection !== 'iteration'`-style refusal by putting `if (host.projection !==
'roadmap') return;` back at the top of `addShelfSection`, run again, watch the menu test go
red, and remove it.

- [ ] **Step 8: Update the register**

In `docs/requirements/Cards or a list on the shelf.md`, replace extension 1b entirely:

```markdown
- **1b — the shelf is the iteration board's.** It draws the picker, and the three beside
  it, as of 2026-08-21. It did not until then, and the reason was never about this band: the
  keyboard path for a `tabindex="-1"` control here is the card menu's shelf section, which
  was built for the roadmap alone, so offering the controls would have made them
  pointer-only. `addShelfSection` serves both surfaces now, and `activeShelf`
  (`src/view/shelfSurface.ts`) is what tells them which band they are acting on. The pick
  itself always applied here — that was the SORT's half of `renderShelf`'s narrowing rule
  rather than the search's, since a layout draws every card either way. Now that the
  controls are on screen the search and the hidden types apply here too, which is the same
  rule reaching its other branch rather than an exception to it: a narrowing may hide work
  exactly where something on screen says it is doing so.
```

In the same note's `## Acceptance criteria`, replace `The iteration board's shelf draws no
picker and still honours the pick — the sort's rule, not the search's.` with:

```markdown
- The iteration board's shelf draws the same four controls and applies all of them, with
  the card menu's shelf section as their keyboard path.
```

In `docs/requirements/Searching the shelf.md`, add to its `## Where it lives` (or its
Extensions, matching the note's own shape — read it first):

```markdown
The search is offered on the iteration board's shelf too since 2026-08-21, over the same
stored value. One value for both bands is [[Resizing the shelf]]'s "one band, one value"
applied to a narrowing rather than to a height: a query typed on the roadmap narrows the
board's band as well, and the box carrying that text is on screen either way, which is the
condition the narrowing rule actually asks for.
```

Add `src/view/shelfSurface.ts` to that note's `files:` list if it names files.

- [ ] **Step 9: Full check and commit**

```bash
npm run check
git add src/view/render/iterationBoard.ts src/view/interactions/menu.ts \
        src/view/interactions/shelfMenu.ts src/i18n/en.ts \
        test/view/iterationShelf.test.ts docs/requirements/
git commit -m "feat: the iteration board's shelf carries the roadmap's picks

Layout, sort, type filter and search, with the card menu's shelf section
as their keyboard path — which is the reason they were withheld and is
now served on both surfaces.

Five catalog keys stop saying 'unplaced': the board's band is a backlog,
and three of them were named for the roadmap's word as well.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
```

---

### Task 4: A compact row draws aligned columns

**Files:**
- Modify: `src/view/render/board.ts` (`renderCardBody` takes `holdEmpty`)
- Modify: `src/view/render/columns.ts` (`publishColumnWidths`, `shelfBadgeWidth`)
- Modify: `src/view/render/reconcile.ts` (`renderTree` calls the extracted publisher)
- Modify: `src/view/render/shelf.ts` (pass `holdEmpty`; publish the band's geometry)
- Modify: `styles/shelf.css`
- Modify: `docs/requirements/Cards or a list on the shelf.md`
- Test: `test/view/shelfLayout.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  // src/view/render/board.ts
  renderCardBody(ctx, card, item, { kidsEl?: HTMLElement; holdEmpty?: boolean }): void;
  // src/view/render/columns.ts — one statement of the per-column publish, two callers
  export function publishColumnWidths(el: HTMLElement, columns: Column[], host: BacklogViewHost): void;
  export function shelfBadgeWidth(): number;
  ```
  Task 5 adds a third option to `renderCardBody`'s bag.

**Why:** measured over twenty rows at a 1400px pane, titles begin at 4 distinct x positions
and state chips at 4; median row height 34px. The fix is the tree's own anatomy — the same
stored per-column widths — but the BAND publishes them, which is the correction Codex found
on PR #187 and the reason this task is bigger than it first looked.

`renderTree` (`render/reconcile.ts`) is the only publisher of `--pbl-prop-w-N`, and
`renderPass.ts` runs it for `tree` and `catalog` alone. `.pbl-tree` is built once in the
constructor and only emptied per pass, so its inline style outlives every render: a view
opened straight into roadmap mode has no such variables and every cell falls back to 132px,
while one that visited the tree first inherits whatever that pass left — geometry that
depends on projection history. So `renderShelf` publishes them itself, from the same
`columnWidth(host, prop)` the tree publishes from.

And `--pbl-meta-col` is NOT reused for the BADGE: `metaColWidth(chars)` reserves room for the
ROLLUP LABEL, not for a badge, and for the tree population's rollup at that. The band reserves
`--pbl-shelf-badge` from the widest label in `ALL_TYPES` — a fixed vocabulary, so the slot
does not resize when the last Deliverable leaves the band and shift every row with it. It IS
reused for the rollup's own box, below, where it means what it says.

**Holding cells open aligns nothing on its own, and that is the third correction** (Codex,
PR #187). Four variable-width things sit AFTER `.pbl-props` in the DOM: the rollup
(`renderCardBody` appends it after the cells), the shelving reason, the dependency note and
the state cell. With the title absorbing all free space, the property block's x is
`right − (everything after it)`, so it lands somewhere different on every row that differs in
any of the four. The measurement that missed this reported title positions 4 → 1, which is
true and is bought by the badge slot alone; property-cell positions were never measured, and
the one hint in the same run — state chips at two x positions — was noted and passed over.

The rule the row actually needs is one sentence: **everything before the flexible region has a
fixed width, everything after it has a fixed width, and the title and parent between them
absorb the rest.** Then the trailing block starts at `container − fixed_total`, which is the
same number on every row. Ordering within the trailing block is irrelevant to that, which is
why nothing is reordered in the DOM.

Concretely:

| region | width | how |
| --- | --- | --- |
| fold slot | fixed 30px | Task 5, reserved on every row |
| badge | fixed | `--pbl-shelf-badge`, from `ALL_TYPES` |
| title + parent | flexible | title `flex: 1 1 0`, parent `flex: 0 1 auto` |
| notes | fixed | NEW box: the rollup, the shelving reason and the dependency note |
| property cells | fixed | `--pbl-prop-w-N`, every row holding every column |
| state | fixed | held open per row, see below |

The NOTES box is what makes the three variable middle things one fixed reservation instead of
three absent-or-present ones. `renderShelfCard` draws it unconditionally and hands it to
`renderCardBody` as `rollupEl`; `renderRollup` fills it or draws nothing, and the reason and
the dependency join it. Its width reuses the rollup's own reservation — `--pbl-meta-col` and
`--pbl-rollup-label`, published on the band from the BAND's items — which is what those two
variables mean, unlike the badge slot they were first misapplied to.

**Not subgrid** — `.pbl-card` carries `content-visibility: auto`, which forces an
independent formatting context, in which `grid-template-columns: subgrid` computes to
`none`. Measured: the card reported one 1272px track and every row stacked.

- [ ] **Step 1: Write the failing tests**

Add to `test/view/shelfLayout.test.ts`:

```ts
	it('holds a cell open for a column this row has no value for', () => {
		// A card DROPS an empty cell, correctly — it stacks its cells and sizes each to
		// content, so a blank one is a chip-shaped gap with nothing to reserve. A row is the
		// case where that argument stops: the cells are fixed width and shared across rows, so
		// a dropped one shifts every cell after it and the column stops being a column. That
		// is the TREE's rule, arrived at from the same place.
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: false, shelfList: true });
		const counts = shelfOf(containerEl)
			?.querySelectorAll<HTMLElement>('.pbl-card-summary > .pbl-props')
			.values()
			.map((props) => props.querySelectorAll('.pbl-prop').length);
		const seen = new Set([...(counts ?? [])]);
		expect(seen.size).toBe(1);
	});

	it('drops the state cell instead, which is not one of the shared columns', () => {
		// Extension 4a: no chip, and no gap where one would have been. `.pbl-shelf-state` is
		// its own box outside `.pbl-props`, so holding the shared columns open says nothing
		// about it — and a row whose workflow does not write the drawn state property must not
		// keep a chip-shaped hole at the end of the line.
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: false, shelfList: true });
		for (const state of Array.from(shelfOf(containerEl)?.querySelectorAll('.pbl-shelf-state') ?? [])) {
			expect(state.childElementCount).toBeGreaterThan(0);
		}
	});

	it('publishes the column widths on the band, never inheriting the tree’s', () => {
		// `renderTree` is the ONLY publisher of `--pbl-prop-w-N` and `renderPass` runs it for
		// the tree and the catalog alone, while `.pbl-tree` is built once in the constructor
		// and only emptied per pass — so a row reading them off the scroller got 132px on a
		// view opened into roadmap mode, and whatever a previous tree pass left on one that
		// had been there. Geometry that depended on projection history. (Codex, PR #187.)
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: false, shelfList: true });
		const band = shelfOf(containerEl);
		expect(band?.style.getPropertyValue('--pbl-prop-w-0')).not.toBe('');
		expect(band?.style.getPropertyValue('--pbl-shelf-badge')).not.toBe('');
	});

	it('publishes nothing on a band drawing no cells', () => {
		// Beside the height and for its reason: a band with nothing to show reserves nothing.
		const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true, shelfList: true });
		expect(shelfOf(containerEl)?.style.getPropertyValue('--pbl-shelf-badge')).toBe('');
	});

	it('states the aligned-column geometry in the stylesheet', () => {
		// jsdom resolves no cascade and lays nothing out, so the checkable part is the
		// declaration and its selector. The geometry was measured in the browser harness at a
		// 1400px pane over the demo backlog's twenty unplaced items: median row height 34px to
		// 28px, title x positions 4 to 1.
		const css = readFileSync('styles/shelf.css', 'utf8');
		// The badge takes the band's own reserved slot, which is what puts every title on one x
		// — never `--pbl-meta-col`, which reserves for the rollup label and is sized off the
		// TREE's population.
		expect(bodyOf(css, '.pbl-shelf-list .pbl-card-head', 'styles/shelf.css')).toContain(
			'flex: 0 0 var(--pbl-shelf-badge, 84px);',
		);
		// And the cells take the tree's stored widths back, which `.pbl-card .pbl-prop` turns
		// off for a card. `0 1` rather than `0 0`: they must shrink together on a narrow pane
		// rather than force a horizontal scrollbar the band has never had.
		expect(bodyOf(css, '.pbl-shelf-list .pbl-card-summary .pbl-prop', 'styles/shelf.css')).toContain(
			'flex: 0 1 var(--pbl-prop-w, 132px);',
		);
		// The title's basis is ZERO, and that is what makes the shrink identical row to row:
		// with `auto` the basis is the title's own text width, so two rows resolve their cells
		// to different widths under the same deficit and the alignment holds only until the
		// pane narrows.
		expect(bodyOf(css, '.pbl-shelf-list .pbl-card-title', 'styles/shelf.css')).toContain('flex: 1 1 0;');
	});
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run test/view/shelfLayout.test.ts
```

Expected: FAIL on all three — cell counts differ per row, and none of the three rules
exists.

- [ ] **Step 3: Let `renderCardBody` hold the cells open**

In `src/view/render/board.ts`, change the option bag and the one call it feeds:

```ts
export function renderCardBody(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	// Where the children disclosure goes, when that is not `card` itself. The shelf's
	// compact row is the one caller that passes it: its summary is a one-line flex ROW, and
	// a child list inside that row would sit beside the title rather than beneath it — so
	// the row hands its own card element here while the summary takes everything else. A
	// wrapper, never different content: the same children are built either way.
	//
	// `holdEmpty` is the same shape for the same kind of difference, and it is the TREE's
	// rule rather than a new one. A card DROPS a cell with nothing in it, because it stacks
	// its cells and sizes each to content, so a blank one is a chip-shaped gap the layout has
	// no reason to reserve. A ROW's cells are fixed width and shared with every row beside
	// it, so a dropped cell shifts every cell after it and the column stops being one.
	{ kidsEl, holdEmpty = false }: { kidsEl?: HTMLElement; holdEmpty?: boolean } = {},
): void {
```

and the `renderPropCells` call inside it:

```ts
	if (cardColumns.length > 0) renderPropCells(ctx, card, item, cardColumns, { dropEmpty: !holdEmpty });
```

- [ ] **Step 3c: Let the rollup be drawn somewhere else**

In `src/view/render/board.ts`, add `rollupEl` to the same option bag, and use it:

```ts
	// Where the ROLLUP goes when that is not the card itself — `kidsEl`'s own shape, for the
	// third time and the last. A compact row needs its trailing geometry FIXED, and the
	// rollup is one of three things that are present on some rows and absent on others; a
	// box that is always drawn and always reserved is what turns three absences into one
	// width. `renderRollup` fills it or draws nothing into it, and the row is the same either
	// way.
	{ kidsEl, holdEmpty = false, toggleEl, rollupEl }: {
		kidsEl?: HTMLElement;
		holdEmpty?: boolean;
		toggleEl?: HTMLElement;
		rollupEl?: HTMLElement;
	} = {},
```

and change its rollup call:

```ts
	renderRollup(host, rollupEl ?? card, item);
```

- [ ] **Step 4: Pass it from the compact row**

In `src/view/render/shelf.ts`, in `renderShelfCard`, draw the notes box first and hand it to
the body:

```ts
	// **One always-drawn box for the three things that are otherwise absent on some rows.**
	// The rollup, the shelving reason and the dependency note are each present or not per
	// item, and each one that is missing takes its width off the row and moves every fixed
	// column after it. Reserved once, filled by whichever apply, and empty on a row with none
	// — which is the same trade `holdEmpty` makes for the cells one line down.
	const notes = wiring.list ? summary.createDiv({ cls: 'pbl-shelf-notes' }) : null;
	renderCardBody(ctx, summary, entry.item, {
		kidsEl: card,
		holdEmpty: wiring.list,
		rollupEl: notes ?? undefined,
	});
```

and append the two notes into that box rather than straight onto the line — both are drawn a
few lines below, so change `summary.createDiv(...)` to `(notes ?? summary).createDiv(...)` at
the `.pbl-shelf-reason` and `.pbl-shelf-dependency` calls, leaving the card grid untouched.

**And the state cell is held open in list mode**, which amends extension 4a for this layout:

```ts
	renderPropCells(ctx, stateEl, item, stateColumns, { dropEmpty: !list });
```

`renderShelfState` takes the `list` flag to do that. 4a's rule — no chip and no gap where one
would have been — was written for a CARD, where cells are content-sized and a blank one is a
gap with nothing to reserve. In a row the state is a shared column, and a column that skips a
row is not a column: dropping it on the rows whose workflow does not write that property moves
every row's cells relative to every other's. The whole-band case 4a also covers is unchanged —
a Base drawing no state column at all still draws no box, because `renderShelfState` returns
before any of this.

- [ ] **Step 4b: Extract the publisher, and give the band a badge slot**

In `src/view/render/columns.ts`, beside `metaColWidth`, add:

```ts
/**
 * Publish one custom property per column, on the element whose descendants read them.
 *
 * Two callers and one statement of it. `renderTree` puts these on the tree scroller for the
 * tree's own rows; `renderShelf` puts them on the BAND, because the tree's publisher does
 * not run for a card projection at all (`renderPass.ts` gates it on `treeShaped`) and
 * `.pbl-tree` is built once in the constructor, so a view opened straight into roadmap mode
 * has none of these and one that visited the tree first inherits whatever that pass left.
 * A compact row reading them off the scroller had geometry that depended on projection
 * history. (Codex, PR #187.)
 *
 * The VALUE is `columnWidth`'s, which is the stored per-property width, so a column resized
 * in tree mode is the same width on the shelf rather than a second reading of the same
 * question.
 */
export function publishColumnWidths(el: HTMLElement, columns: Column[], host: BacklogViewHost): void {
	const widths: Record<string, string> = {};
	for (const [index, column] of columns.entries()) {
		widths[columnWidthVar(index)] = `${columnWidth(host, column.prop)}px`;
	}
	el.setCssProps(widths);
}

/**
 * The width a compact row reserves for its type badge, so every title after it starts at
 * one x.
 *
 * NOT `metaColWidth`, which reserves for the ROLLUP LABEL and is sized off the tree
 * population's widest one — a number about something else. And not the band's own widest
 * badge either: a slot sized from the cards in front of the reader would resize when the
 * last Deliverable is placed and shift every remaining row sideways. `ALL_TYPES` is a fixed
 * vocabulary, so this is one number for the life of the view. A type outside it truncates
 * inside the slot (`styles/shelf.css`) rather than pushing its own title.
 */
export function shelfBadgeWidth(): number {
	const longest = ALL_TYPES.reduce((widest, type) => Math.max(widest, type.length), 0);
	return Math.max(META_COL_WIDTH, BADGE_LEAD_PX + Math.ceil(longest * ROLLUP_CHAR_PX));
}
```

`BADGE_LEAD_PX` is the badge's own icon, padding and the gap after it — read
`styles/badges.css` and sum the bounds there rather than guessing, the way `ROW_LEAD_WIDTH`
in this file already does, and say in a comment which declarations the sum came from.

Import `ALL_TYPES` from `../../domain/typeVocabulary`, and `columnWidth` / `columnWidthVar`
from `../interactions/columnResize` if they are not already imported here.

Then in `src/view/render/reconcile.ts`, replace `renderTree`'s own per-column loop:

```ts
	// The tree's own columns, through the shared publisher — see `publishColumnWidths`.
	publishColumnWidths(treeEl, ctx.columns, ctx.host);
```

leaving the `--pbl-meta-col`, `--pbl-indent` and `--pbl-rollup-label` writes exactly where
they are: those three are the tree's own geometry and no other surface asks for them.

- [ ] **Step 4c: Publish the band's geometry from `renderShelf`**

In `src/view/render/shelf.ts`, in `renderShelf`, after the `list` constant is decided and
before the groups are drawn (put it beside the `publishShelfHeight` call at the foot, which
is the other thing this function publishes):

```ts
	// A compact row's columns are shared across rows, so the widths have to be somewhere both
	// this band and every cell in it can see — and the tree's publisher does not run for a
	// card projection. Published per render on the band, so nothing here can inherit a stale
	// number from a tree pass that happened before a projection switch. Only in list mode: a
	// card sizes its cells to content and would be overruled by a width it never asked for.
	if (list) {
		publishColumnWidths(shelfEl, ctx.columns, host);
		// The badge slot, from the fixed vocabulary — and the ROLLUP's own reservation, which is
		// what `--pbl-meta-col` and `--pbl-rollup-label` actually mean. `styles/columns.css`
		// already sizes `.pbl-meta-col` from the pair, so publishing them here makes the box
		// `renderRollup` draws into a fixed width on this band, computed from THIS band's items
		// rather than inherited from a tree pass. `rollupChars` returns 0 where nothing reports
		// one, and the label variable is left off entirely in that case — absent is the only
		// honest spelling of "none", the same rule `renderTree` keeps.
		const chars = rollupChars(host, shown.map((entry) => entry.item));
		shelfEl.setCssProps({
			'--pbl-shelf-badge': `${shelfBadgeWidth()}px`,
			'--pbl-meta-col': `${metaColWidth(chars)}px`,
		});
		if (chars > 0) shelfEl.setCssProps({ '--pbl-rollup-label': `${chars}ch` });
		else shelfEl.style.removeProperty('--pbl-rollup-label');
	}
```

Note this sits ABOVE the `if (empty || collapsed) return;` line only if the cells can be
drawn at all — they cannot, so put it after that return, beside `publishShelfHeight`, and
say so in the comment: a band with nothing to show publishes no geometry, exactly as it
publishes no height.

- [ ] **Step 5: Write the stylesheet**

In `styles/shelf.css`, replace the two existing rules
`.pbl-shelf-list .pbl-card-summary .pbl-props` and `.pbl-shelf-list .pbl-card-title` with
the block below, and add the rest after them. Read the surrounding comments first — the
ones being replaced record measurements that stay true and must be carried forward.

```css
/* **The row's columns are the TREE's columns**, and reusing them rather than inventing a
   second set is the whole of this layout. `--pbl-prop-w-N` and `--pbl-shelf-badge` are
   published on the BAND by `renderShelf` itself (`publishColumnWidths`, and
   `--pbl-shelf-badge` beside it), never inherited from `.pbl-tree`: the tree's publisher does
   not run for a card projection, so a row reading them off the scroller got 132px on a view
   opened into roadmap mode and a stale number on one that had visited the tree. Measured in
   the browser harness at a 1400px pane over the demo backlog's twenty unplaced items: titles
   began at 4 distinct x positions and now begin at 1, and the median row is 34px rather than
   28px.

   Subgrid would be the obvious spelling and cannot be used: `.pbl-card` carries
   `content-visibility: auto`, which forces an independent formatting context, and in one
   `grid-template-columns: subgrid` computes to `none`. Measured — the card reported a single
   1272px track and every row stacked. Recorded so this is not re-attempted.

   The badge slot is the band's OWN reservation and deliberately not `--pbl-meta-col`, whose
   width is a reservation for the rollup label and is sized off the tree's population. A type
   outside `ALL_TYPES` truncates in the slot rather than pushing its own title out of line. */
.pbl-shelf-list .pbl-card-head {
	flex: 0 0 var(--pbl-shelf-badge, 84px);
	width: var(--pbl-shelf-badge, 84px);
	min-width: 0;
	overflow: hidden;
}

/* The cells take back the width `.pbl-card .pbl-prop` turns off. That override is right for
   a CARD — it stacks its cells and sizes each to content — and this is the case where it is
   not: a shared column is a width every row agrees on or it is not a column.

   `0 1` rather than `0 0`, and `min-width: 0` beside it, because a fixed width per cell on a
   narrow pane is how the band gets back the horizontal scrollbar [[The shelf, organized]]
   removed. Shrinking, every row shrinks IDENTICALLY — the bases are the same on every row
   now that no cell is dropped (`holdEmpty`, `render/shelf.ts`) — so the alignment survives
   the whole width range instead of holding at one pane size. */
.pbl-shelf-list .pbl-card-summary .pbl-prop {
	flex: 0 1 var(--pbl-prop-w, 132px);
	width: var(--pbl-prop-w, 132px);
	min-width: 0;
}

/* **The wrapper has to shrink for its cells to shrink**, which is the half that makes the
   narrow-pane policy work at all. `.pbl-props` is itself a flex container: pinned at
   `flex: 0 0 auto` it is sized from its contents, so its cells never face a deficit inside
   it, their own `flex-shrink` never engages, and the whole deficit lands on the title —
   which hits its floor and then the row overflows. `0 1 auto` with `min-width: 0` passes the
   squeeze through. (Codex, PR #187 — the first draft pinned it and claimed controlled
   shrinkage in the same breath.)

   No `margin-inline-start: auto` here: the title is `flex: 1 1 0`, so it absorbs every bit of
   free space and the metadata block is already at the line's end. An auto margin beside that
   is a declaration that can never fire.

   `flex-wrap` stays off, and it is load-bearing beside the shrink rather than tidy: a wrapper
   that can finally be squeezed is one whose cells wrap to a second line — a 28px row becoming
   56px the moment it holds two chips. */
.pbl-shelf-list .pbl-card-summary .pbl-props {
	flex: 0 1 auto;
	min-width: 0;
	flex-wrap: nowrap;
}

/* The title is the one thing that yields, and it truncates rather than wraps: a row that
   grew a second line for a long title would not be a row. `overflow-wrap` is reset because
   the card's own rule sets `anywhere`, which fights the ellipsis.

   **The basis is 0, and that is load-bearing rather than tidy.** With `auto` the basis is
   the title's own text width, so under a deficit two rows distribute their shrink
   differently and the cells resolve to different widths — the alignment would hold at a wide
   pane and quietly come apart at a narrow one, which is the failure mode hardest to notice.
   At 0 every row's flex configuration is identical and so is every resolved column.

   The floor decides who yields FIRST. Every other item in the row can shrink, so without one
   the cells and the title shrink in proportion and the row's own subject ends up sharing the
   line evenly with its metadata. In `ch` so it is a number of CHARACTERS at whatever size the
   theme draws them. And the floor yields itself once there is not room for it, which a bare
   `16ch` could not: a reservation is a promise about a container with the space to keep it,
   and below some width 16ch plus the badge, the gaps and the cells is more than the row has.
   Measured across the range rather than argued — at 1200, 640, 480 and 380px the summary's
   scroll width equals its client width exactly, and at 320px a fixed floor overran by 7px.
   The percentage is of the SUMMARY's own content box, so it answers to the band a reader is
   looking at rather than to the viewport, which is what a media query would get wrong in a
   split pane. */
.pbl-shelf-list .pbl-card-title {
	flex: 1 1 0;
	min-width: min(16ch, 40%);
	overflow: hidden;
	overflow-wrap: normal;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* **The trailing reservation**: the rollup, the shelving reason and the dependency note, in
   one box that is always drawn. Its width is the rollup's own reservation — `.pbl-meta-col`
   inside it is sized by `styles/columns.css` from `--pbl-meta-col` and `--pbl-rollup-label`,
   both published on this band by `renderShelf` from this band's items — plus room for the two
   note icons. Fixed either way: a row with none of the three spends the same width as a row
   with all three, which is what keeps every property cell after it on one x.

   The two notes show their ICON and not their sentence. There is no room for a sentence in a
   reservation, and a sentence is what made them variable in the first place; the text stays in
   the DOM rather than being removed, so it still reaches the card's accessible name the
   content-derived way `renderShelfCard` relies on, and the tooltip carries it for a reader who
   can see. */
.pbl-shelf-list .pbl-shelf-notes {
	display: flex;
	align-items: center;
	gap: var(--size-2-1);
	flex: 0 0 calc(var(--pbl-meta-col, 84px) + 2 * (12px + var(--size-2-1)));
}

.pbl-shelf-list .pbl-shelf-reason > span:not(.pbl-shelf-reason-icon),
.pbl-shelf-list .pbl-shelf-dependency > span:not(.pbl-shelf-dependency-icon) {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

/* **The visual order, and why moving these two is safe.** The notes box is appended after the
   property cells in the DOM, and it reads better between the title and them. Nothing about
   ALIGNMENT depends on the order — every item after the flexible title has a fixed width, so
   the trailing block starts at the same x whatever sequence it is in — this is legibility
   alone. `styles/shelf.css` already reorders one element (`.pbl-dragging .pbl-shelf-empty`)
   and states the test: nothing focusable may be separated from its place in the document.
   Both boxes moved here hold `tabindex="-1"` controls only, which are out of the tab order by
   the composite's own rule, and the pane's arrows walk CARDS rather than cells — so no reader
   traverses these in a sequence this could contradict. */
.pbl-shelf-list .pbl-card-summary .pbl-props {
	order: 1;
}

.pbl-shelf-list .pbl-shelf-state {
	order: 2;
}

/* The parent link shares the flexible region with the title rather than sitting in the fixed
   trailing block: the two together absorb whatever the row has spare, so the boundary between
   them and the reservations is at one x on every row. It yields before the title does and
   ellipsises inside itself. */
.pbl-shelf-list .pbl-card-parent {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* A hairline per row and a hover, which is the whole of the rhythm: a long band gives the
   eye nothing to track down without them. On the SUMMARY rather than the card, so an
   expanded parent's children sit inside the line the rule closes rather than below it. */
.pbl-shelf-list .pbl-card-summary {
	min-height: 28px;
	padding-inline: var(--size-4-2);
	border-block-end: 1px solid var(--background-modifier-border);
}

.pbl-shelf-list .pbl-shelf-cards > .pbl-card:last-child .pbl-card-summary {
	border-block-end: 0;
}

.pbl-shelf-list .pbl-card:hover {
	background-color: var(--background-modifier-hover);
}

/* The type group headers read as structure rather than as another muted line. Sticky inside
   the band's own scrollport — the band is a scroller (`roadmap.css`, `board.css`), so a
   reader scrolled into the middle of a long type still knows which one they are in. */
.pbl-shelf-list .pbl-shelf-group-header {
	position: sticky;
	top: 0;
	z-index: 2;
	padding: 2px var(--size-4-2);
	border-radius: var(--radius-s);
	background-color: var(--background-modifier-hover);
	letter-spacing: 0.06em;
	color: var(--text-normal);
}

.pbl-shelf-list .pbl-shelf-group-count {
	margin-inline-start: auto;
	padding-inline: 6px;
	border-radius: var(--radius-s);
	background-color: var(--background-modifier-border);
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}
```

Delete the now-superseded `.pbl-shelf-list .pbl-card` padding rule only if the summary's
`padding-inline` makes it redundant — check by reading it; if it still sets block padding
the row needs, leave it.

- [ ] **Step 6: Run the tests, then watch them fail**

```bash
npx vitest run test/view/shelfLayout.test.ts
npm run build
```

Expected: PASS, and the build must pass because `styles-assemble.mjs` fails a partial over
400 lines — `styles/shelf.css` is close to it. If it trips, split the two layouts into
`styles/shelfList.css` and add it to `styles/index.css` at the same position, stating in
`index.css` why the position is load-bearing (it must come after `board.css` and
`roadmap.css`, like `shelf.css`).

Then set `holdEmpty` back to `false` at the call site, re-run, watch the first test go red,
and restore.

- [ ] **Step 7: Measure it in the browser harness**

This is the half jsdom cannot answer, and the numbers go in the register.

```bash
npm run harness
```

Then open `.harness/index.html?view=roadmap&axis=horizons&shelf` in a browser, or in a
headless session drive it with the Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`:

```bash
/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
  --window-size=1400,2400 --screenshot=/tmp/shelf.png \
  "file://$PWD/.harness/index.html?view=roadmap&axis=horizons&shelf"
```

Switch the band to list from the header's layout picker. Confirm at 1400, 760, 480 and
380px window widths that every row's `.pbl-card-summary` has `scrollWidth === clientWidth`
(no spill) and that the title's left edge is the same on every row. Record the numbers you
actually get in the register edit below — do not copy the ones in this plan.

- [ ] **Step 8: Update the register**

In `docs/requirements/Cards or a list on the shelf.md`, replace extension 3a's acceptance
line and add the alignment guarantee to `## Acceptance criteria`:

```markdown
- A compact row's columns are the tree's stored widths, published on the band: the badge in
  its own `--pbl-shelf-badge` slot, the cells at `--pbl-prop-w-N`, every row holding a cell open for every column so a missing value is
  a gap rather than a shift. Measured at a 1400px pane over twenty unplaced items: titles at
  one x position where there were four, median row 28px where it was 34px.
- The cells shrink together rather than forcing a horizontal scrollbar the band has never
  had, and they shrink identically row to row because the title's flex basis is 0 and no row
  drops a cell.
```

Add to `## Where it lives` the subgrid refusal, verbatim from the spec, the two rejected
alternatives with their measured costs, and the publisher:

```markdown
The widths are published on the BAND by `renderShelf`, through `publishColumnWidths`
(`src/view/render/columns.ts`), which `renderTree` now calls too — one statement of the same
loop. It is not inherited from `.pbl-tree`, and that is a correction rather than a
preference: `renderPass.ts` runs the tree's publisher for the tree and the catalog alone,
while the scroller is built once in the constructor and only emptied per pass, so a compact
row reading those variables got the 132px fallback on a view opened into roadmap mode and a
stale number on one that had visited the tree — geometry decided by projection history.
The badge's own slot is `shelfBadgeWidth()`, from `ALL_TYPES` rather than from
`metaColWidth` (which reserves for the rollup label) or from the band's current cards (which
would resize the slot as work is placed). Found by review, Codex on PR #187.
```

- [ ] **Step 9: Full check and commit**

```bash
npm run check
git add src/view/render/board.ts src/view/render/columns.ts src/view/render/reconcile.ts \
        src/view/render/shelf.ts styles/ \
        test/view/shelfLayout.test.ts "docs/requirements/Cards or a list on the shelf.md"
# Steps 4b and 4c touch columns.ts and reconcile.ts. Left unstaged, `npm run check` still
# passes against the working tree while the COMMIT holds shelf.ts calling exports that are
# not in it — a clean checkout of that commit does not build. Confirm with
# `git status --short` that nothing this task touched is left out before committing.
# (Codex, PR #187.)
git commit -m "feat: a compact shelf row draws aligned columns

The tree's own stored widths rather than a second mechanism, published
on the band: the badge in its own slot, the cells at --pbl-prop-w-N, and every row holding a cell
open for every column so a missing value is a gap and not a shift.

Titles at one x position where there were four; median row 34px to 28px,
measured at a 1400px pane over twenty unplaced items.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
```

---

### Task 5: A shelved parent's children stop reading as a sibling

**Files:**
- Modify: `src/view/render/cardChildren.ts` (`toggleEl`, the count in list mode)
- Modify: `src/view/render/board.ts` (`renderCardBody` passes `toggleEl` through)
- Modify: `src/view/render/shelf.ts` (the fold slot)
- Modify: `styles/shelf.css` (or `styles/shelfList.css` if Task 4 split it)
- Modify: `docs/requirements/Cards or a list on the shelf.md`
- Test: `test/view/cardChildren.test.ts`

**Interfaces:**
- Consumes: `renderCardBody(ctx, card, item, { kidsEl?, holdEmpty? })` from Task 4.
- Produces:
  ```ts
  export function renderCardChildren(
      ctx: RowContext,
      card: HTMLElement,
      item: BacklogItem,
      { toggleEl }?: { toggleEl?: HTMLElement },
  ): void;
  ```

**Why:** three things, not one. The disclosure is a line of its own even while shut, so a
parent row is 48px where every other row is 28px. It sits flush with the card's left edge,
further left than the badge column of the row it belongs to, which is what makes it read as
a sibling. And `margin-top` separates it from its own row while nothing connects the
children back up.

- [ ] **Step 1: Write the failing tests**

Add to `test/view/cardChildren.test.ts` (read its existing helpers first and reuse them —
it already mounts cards and finds toggles):

```ts
	it('puts the disclosure on the line in list mode, and the list beneath it', () => {
		// A parent row costs no extra line at rest: the chevron and its count take a leading
		// fold slot, the tree's own idiom and the reason a tree row is one line whether or not
		// it has children. The LIST stays the card's own child, so it falls beneath the line
		// rather than sitting at the end of it — extension 3b, unchanged.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const card = cardByTitle(containerEl, 'Monthly statement');
		const summary = card.querySelector('.pbl-card-summary');
		expect(summary?.querySelector('.pbl-shelf-fold > .pbl-card-kids-toggle')).not.toBeNull();
		expect(summary?.querySelector('.pbl-card-kids-list')).toBeNull();
		expect(card.querySelector(':scope > .pbl-card-kids > .pbl-card-kids-list')).not.toBeNull();
	});

	it('draws no wrapper at all while the children are shut', () => {
		// Only the `<ul>` is hidden by `.pbl-card-kids-list:empty`; the box around it would still
		// spend its padding and one of the card's flex gaps, so a shut parent would stand taller
		// than a leaf — which this task's same-height requirement forbids. (Codex, PR #187.)
		const { view, containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const path = 'Monthly statement.md';
		view.setCardCollapsed(path, true);
		const wrap = cardByTitle(containerEl, 'Monthly statement').querySelector('.pbl-card-kids');
		expect(wrap?.hasClass('pbl-card-kids-shut')).toBe(true);
	});

	it('reserves the fold slot on a row with no children, so the badges stay on one x', () => {
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const leaf = cardByTitle(containerEl, 'Reconcile the ledger');
		const slot = leaf.querySelector('.pbl-card-summary > .pbl-shelf-fold');
		expect(slot).not.toBeNull();
		expect(slot?.childElementCount).toBe(0);
	});

	it('shows the count as a number on the line and keeps the sentence as the name', () => {
		// The slot has room for a number and not for a sentence, and the sentence is what the
		// list is NAMED by (`aria-labelledby` points at this toggle) — so it moves to the
		// toggle's own `aria-label` rather than being dropped. A reader who cannot see the
		// slot hears exactly what they heard before.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const toggle = cardByTitle(containerEl, 'Monthly statement').querySelector<HTMLElement>('.pbl-card-kids-toggle');
		expect(toggle?.querySelector('.pbl-card-kids-count')?.textContent).toBe('1');
		expect(toggle?.getAttribute('aria-label')).toBe('1 task');
	});

	it('leaves the card grid’s own disclosure exactly where it was', () => {
		// The card stacks, so its disclosure belongs in the wrapper with its list and nothing
		// about this feature is a reason to move it. No fold slot is drawn there at all.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false });
		const card = cardByTitle(containerEl, 'Monthly statement');
		expect(card.querySelector('.pbl-shelf-fold')).toBeNull();
		expect(card.querySelector('.pbl-card-kids > .pbl-card-kids-toggle')).not.toBeNull();
	});
```

Write `parentOnShelfVault()` beside the file's other fixtures: a horizon-axis vault where a
PBI with no horizon carries one Task child, both returned by the base. Model it on
`horizonVault()` in `test/helpers/roadmap.ts` — read that first and follow its shape rather
than inventing a second one.

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run test/view/cardChildren.test.ts
```

Expected: FAIL — no `.pbl-shelf-fold` exists.

- [ ] **Step 3: Let the disclosure be built somewhere else**

In `src/view/render/cardChildren.ts`, change the signature and the two lines that build the
toggle:

```ts
export function renderCardChildren(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	// Where the DISCLOSURE goes when that is not the wrapper — `renderCardBody`'s own
	// `kidsEl` in the mirror. The shelf's compact row is the one caller: its summary is the
	// line, so the toggle belongs ON it while the list stays beneath, and a row with no
	// children still reserves the slot so the badges keep one x. A card passes nothing and
	// is unchanged: it stacks, so its disclosure belongs with its list.
	{ toggleEl }: { toggleEl?: HTMLElement } = {},
): void {
```

Then, after `const wrap = card.createDiv({ cls: 'pbl-card-kids' });`:

```ts
	// Toggle first, list second — DOM order IS reading order, so the count is met before the
	// items it counts. That still holds when the toggle is lifted onto the line: the summary
	// precedes the wrapper inside the card. Both ids are minted rather than derived: these
	// attributes resolve across the whole document, and two saved views can sit in split
	// panes.
	const toggle = (toggleEl ?? wrap).createEl('button', {
		cls: 'pbl-card-kids-toggle',
		attr: { type: 'button', tabindex: '-1' },
	});
```

And after the `toggle.createSpan({ cls: 'pbl-card-kids-count', ... })` line, replace that
line with:

```ts
	// The slot on a compact row has room for a number and not for a sentence. The sentence is
	// what the LIST is named by — `aria-labelledby` points at this toggle — so it moves to
	// the toggle's own `aria-label` rather than being dropped, and a reader who cannot see the
	// slot hears exactly what they heard before. In the wrapper it stays the visible text and
	// no `aria-label` is written, because an accessible name derived from content is the one
	// that cannot drift from what is on screen.
	const label = childrenLabel(children);
	const onLine = toggleEl !== undefined;
	toggle.createSpan({ cls: 'pbl-card-kids-count', text: onLine ? String(children.length) : label });
	if (onLine) toggle.setAttribute('aria-label', label);
```

- [ ] **Step 3b: Mark the wrapper while the list is shut**

A collapsed parent still has its `.pbl-card-kids` wrapper in the card — only the `<ul>`
inside it is hidden, by `.pbl-card-kids-list:empty`. On a compact row that wrapper then
carries the list's own padding AND draws one of the card's flex gaps, so a shut parent is
taller than a leaf and the indent guide draws a stub with nothing under it. That
contradicts this task's own same-height requirement. (Codex, PR #187.)

`:has()` would express it in one selector and this plugin does not use it — `src/view/CLAUDE.md`
says so under "Controls", and `styles/tree.css` states the reason: it invalidates on every
subtree change and this tree rebuilds on every data update. So the code that knows the state
says it, which is exactly what `pbl-has-selection` does beside `aria-activedescendant`.

In `src/view/render/cardChildren.ts`, inside `draw()`, beside the two attributes it already
syncs:

```ts
		toggle.setAttribute('aria-expanded', String(!collapsed));
		chevron.toggleClass('pbl-expanded', !collapsed);
		// The wrapper says whether it is shut, because a stylesheet cannot ask. On a compact
		// row the wrapper is the indent block: shut, it would still draw its padding and one
		// of the card's flex gaps, making a shut parent taller than a leaf and drawing an
		// indent guide with nothing beneath it. `.pbl-card-kids-list:empty` hides the list and
		// says nothing about the box around it.
		wrap.toggleClass('pbl-card-kids-shut', collapsed);
```

- [ ] **Step 4: Pass it through the body**

In `src/view/render/board.ts`, extend `renderCardBody`'s option bag (which Task 4 already
touched) to `{ kidsEl, holdEmpty = false, toggleEl }` with the type
`{ kidsEl?: HTMLElement; holdEmpty?: boolean; toggleEl?: HTMLElement }`, and change its last
line:

```ts
	renderCardChildren(ctx, kidsEl ?? card, item, { toggleEl });
```

- [ ] **Step 5: Draw the slot on the row**

In `src/view/render/shelf.ts`, in `renderShelfCard`, immediately after `summary` is decided:

```ts
	// The fold slot leads the line and is reserved whether or not this item has children, so
	// every badge after it starts at one x — the tree's own arrangement. Created here rather
	// than by `renderCardChildren`, which returns early for a leaf and would leave the row
	// without one.
	const fold = wiring.list ? summary.createDiv({ cls: 'pbl-shelf-fold' }) : null;
```

and change the body call (Task 4 already gave it `holdEmpty`):

```ts
	renderCardBody(ctx, summary, entry.item, { kidsEl: card, holdEmpty: wiring.list, toggleEl: fold ?? undefined });
```

- [ ] **Step 6: Style it**

Add to `styles/shelf.css` (or the list partial, if Task 4 split it):

```css
/* The fold slot: the tree's chevron column, on a shelf row. Reserved on every row whether
   or not it holds a disclosure, which is what keeps the badges on one x — a slot that
   collapsed for a leaf would put the tree back where the flex line was. */
.pbl-shelf-fold {
	display: flex;
	align-items: center;
	flex: 0 0 30px;
	width: 30px;
}

/* Inside the slot the disclosure is a chevron and a number, not a sentence in a padded box:
   the toggle's own rule (`cardChildren.css`) sizes it for a card, where it is a line of its
   own. */
.pbl-shelf-list button.pbl-card-kids-toggle {
	gap: 0;
	padding: 0;
	justify-content: flex-start;
	font-variant-numeric: tabular-nums;
}

.pbl-shelf-list .pbl-card-kids-count {
	color: var(--text-faint);
}

/* And the list is the parent's, visibly: indented so a child's badge begins where the
   parent's TITLE does, with the tree's own 1px indent guide down the group. It carries no
   top margin here — the card's rule gives it one so a stacked card's disclosure is not
   cramped against the body, and on a row that margin is what detached the children from the
   line they belong to. */
.pbl-shelf-list .pbl-card-kids {
	position: relative;
	gap: 0;
	margin-top: 0;
	padding-block-end: var(--size-2-1);
	/* **A child's badge starts where its parent's TITLE starts**, which is the summary's own
	   inline padding, the fold slot, the badge slot and the two flex gaps between them — minus
	   the child button's own inline padding, since that button carries the last step itself.
	   Dropping that last term leaves every child 4px left of the line it belongs to, which is
	   near enough to look like a mistake and far enough to be one. (Codex, PR #187.) */
	padding-inline-start: calc(
		var(--size-4-2) + 30px + var(--size-4-2) + var(--pbl-shelf-badge, 84px) + var(--size-4-2) - var(--size-2-1)
	);
}

.pbl-shelf-list .pbl-card-kids::before {
	content: '';
	position: absolute;
	top: 0;
	bottom: var(--size-2-1);
	/* One gap left of where the children start, so the guide runs between the parent's badge
	   column and its children rather than through them. */
	inset-inline-start: calc(var(--size-4-2) + 30px + var(--size-4-2) + var(--pbl-shelf-badge, 84px));
	width: 1px;
	background-color: var(--background-modifier-border);
	pointer-events: none;
}

.pbl-shelf-list button.pbl-card-kid {
	padding-block: 1px;
	padding-inline-start: var(--size-2-1);
}

/* Shut, the wrapper is not there at all — see `renderCardChildren`'s `draw`. Hiding only the
   `<ul>` (which `.pbl-card-kids-list:empty` already does) leaves a box that still spends this
   rule's padding and one of the card's flex gaps, so a shut parent stands taller than a leaf
   and the guide above draws a stub over nothing. Scoped to the list: a CARD's wrapper holds
   the disclosure itself, and hiding it there would take the control away with the list. */
.pbl-shelf-list .pbl-card-kids-shut {
	display: none;
}
```

- [ ] **Step 7: Run, then watch it fail**

```bash
npx vitest run test/view/cardChildren.test.ts test/view/shelfLayout.test.ts
```

Expected: PASS. Then remove the `toggleEl: fold ?? undefined` argument, re-run, watch the
first and third tests go red, and restore. Then delete the `.pbl-shelf-fold` creation line,
re-run, watch the second go red, and restore.

- [ ] **Step 8: Measure it in the harness**

Rebuild the harness and confirm three things by MEASUREMENT rather than by eye, since the
one that was wrong in this plan was wrong by 4px:

- a parent row with its children SHUT and a leaf row are the same height, to the pixel — the
  state where a leftover wrapper costs its padding plus a flex gap;
- `getBoundingClientRect().left` of an expanded child's `.pbl-badge` equals that of its
  parent's `.pbl-card-title`, exactly — not approximately;
- the indent guide is visible in BOTH schemes (`?theme=light` too — a 1px border colour that
  vanishes in one scheme is a guide that is not there).

```bash
npm run harness
```

Record the heights you measure in the register edit below.

- [ ] **Step 9: Update the register**

In `docs/requirements/Cards or a list on the shelf.md`, rewrite extension 3b — it currently
says the list falls beneath the line and stops there, which is still true and no longer the
whole story:

```markdown
- **3b — a shelved parent with children.** Its LIST stays beneath the line and its
  DISCLOSURE joins it. `.pbl-card-kids` is a direct child of the card, so a card laid out as
  a row put the whole block beside the title: measured at 35px against 28px with the list
  still shut, and taller with it open, the whole summary then centred against it. That is
  what the summary box fixed. What it left was three more: the disclosure was a line of its
  own even while shut, so a parent row was 48px where every other row was 28px; it sat flush
  with the card's left edge, further left than the badge column of the row it belongs to,
  which is what made it read as a sibling; and its top margin separated it from its own row
  while nothing connected the children back up. So the chevron and its count take a leading
  fold slot on the line — the tree's own idiom, and the reason a tree row is one line whether
  or not it has children — the slot is reserved on every row so the badges keep one x, and
  the list is indented to the title with the tree's own indent guide. The count is a number
  in the slot and the sentence is the toggle's `aria-label`, which is what the list is named
  by. (2026-08-21.)
```

- [ ] **Step 10: Full check and commit**

```bash
npm run check
git add src/view/render/cardChildren.ts src/view/render/board.ts src/view/render/shelf.ts \
        styles/ test/view/cardChildren.test.ts "docs/requirements/Cards or a list on the shelf.md"
git commit -m "feat: a shelved parent's children read as the row's own

The disclosure joins the line in a leading fold slot, reserved on every
row so the badges keep one x, and the list is indented to the title with
the tree's indent guide. A parent row costs no extra line at rest.

The count is a number in the slot; the sentence stays the toggle's
accessible name, which is what the list is labelled by.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
```

---

### Task 6: Changelog, and the honest account of what is unverified

**Files:**
- Modify: `CHANGELOG.md`
- Modify: PR #187's body

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Add the entries**

`CHANGELOG.md` gains these under `## [Unreleased]`, in the sections that file already uses
(read it — the section names are its own):

```markdown
### Added

- The iteration board's shelf carries the same four picks as the roadmap's — layout, sort,
  type filter and search — with the card menu's shelf section as their keyboard path.

### Changed

- A compact shelf row draws aligned columns, reusing the tree's own stored property widths: titles at one x position where there were four, and a shorter row.
- A shelved parent's disclosure sits on the line in a leading fold slot, so a parent row
  costs no extra line at rest, and its children are indented to the title.

### Fixed

- The shelf's resize grip sits at the foot of a band the reader has sized, rather than
  under the last section when everything inside is collapsed.
```

- [ ] **Step 2: Full check**

```bash
npm run check
```

Expected: all five steps pass.

- [ ] **Step 3: Commit and push**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for the shelf UX polish

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V7fQnXvwEKAcZYLWoPqixS"
git push -u origin claude/shelf-ux-ui-polish-vamaze
```

- [ ] **Step 4: Say what is still owed**

Update PR #187's body: all four changes are appearance or gesture, so the live-vault sweep
is owed for each (ADR 0020). Name what WAS measured — the harness numbers, at which pane
widths, against Obsidian's own default colours — and what was not: a themed vault's colours
and accent, a real touch device for the fold slot's hit area, and whether the group header's
sticky offset is right against a theme that restyles the band.

---

## Self-Review

**Spec coverage.** §1 grip → Task 1. §2 board picks → Tasks 2 and 3 (resolver, then
behaviour). §3 list layout → Task 4. §4 children → Task 5. The spec's Testing section is
distributed across the tasks that own each claim; its Register section is distributed the
same way, because `npm run docs` runs per commit and a new module with no note fails it in
the task that adds it.

**What review changed after the first draft (Codex, PR #187).** Two P2 findings, both
confirmed against the code and both landing on Task 4. `--pbl-prop-w-N` is published only by
`renderTree`, which `renderPass.ts` runs for `tree` and `catalog` alone, so the first draft's
"the shelf inherits them for free" was true only because the harness mounts into the tree
before `?view=` switches — the band publishes its own now (steps 4b and 4c). And the
narrow-pane policy had to be stated rather than implied: `columnFit` is cleared for card
projections, so nothing is ever dropped here and controlled shrinkage is the whole answer.
Reading those findings turned up a third the review did not name: `--pbl-meta-col` is
`metaColWidth(chars)`, a reservation for the ROLLUP LABEL sized off the tree's population, so
borrowing it for a badge slot borrows a number about something else. The band reserves its
own.

**Two things the spec did not name and this plan adds.** The five catalog keys that say
"unplaced" (Task 3, step 3) — the board's band is a backlog, and a control labelled "Search
unplaced" over it is wrong in a way only the parity change exposes. And the title's
`flex-basis: 0` (Task 4) — without it, alignment holds at a wide pane and comes apart as it
narrows, because a title's `auto` basis differs per row and so does each row's share of the
shrink. Both are corrections to the spec rather than scope creep; fold them back into the
spec if it is re-read.

**Type consistency.** `renderCardBody`'s bag is `{ kidsEl?, holdEmpty?, toggleEl? }` —
Task 4 adds the second, Task 5 the third, and Task 5's step 4 restates the whole type so an
engineer reading tasks out of order gets it right. `renderCardChildren`'s fourth parameter
is `{ toggleEl? }` in both the interface block and step 3. `activeShelf` returns
`{ el, cards, collapsed }` in Task 2's interface block, its implementation, and both Task 3
call sites. `BoardSnapshot.shelf` is `ShelfCard[] | undefined` and every read of it is
`?? []`.

**One risk worth naming.** `styles/shelf.css` is 288 lines and Tasks 4 and 5 add roughly 120
between them, against a 400-line cap `npm run build` enforces. Task 4 step 6 says to split
into `styles/shelfList.css` if it trips, and Task 5 says to follow that split. Do not
discover this at Task 5's commit.
