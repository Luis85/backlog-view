# Children on the card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a card an expandable list of its direct children, so a board of Epics can
show which Features each one holds without leaving the board.

**Architecture:** One new view module, `src/view/render/cardChildren.ts`, called from the
shared `renderCardBody` — so board cards, roadmap bucket cards and shelf cards all get it
and timeline rows (which use the card shell but never the body) do not. Expansion reuses
the tree's per-path collapse state. The render records which paths it drew a disclosure
for into a set the view publishes per pass, and the card menu and the toolbar's bulk
controls both read that set rather than re-deriving the answer.

**Tech Stack:** TypeScript, the Obsidian Bases custom-view API, vitest + jsdom, plain CSS
partials assembled by `styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-07-card-children-expansion-design.md`

## Global Constraints

- `npm run check` must pass before every commit — build, lint, coverage-thresholded
  tests, fallow, docs register. CI runs the same five on Ubuntu **and** Windows.
- Layering: `view/` may reach `domain/` and `storage/`, never the reverse. Modules reach
  view state only through `BacklogViewHost`. Enforced by `no-restricted-imports`.
- Every module in `src/` must be *specified* by a use case's `## Where it lives` or an
  ADR's `## Decision`, or `docs-check.mjs` rule 7 fails. **The register note therefore
  lands in the same commit as the new module**, not later.
- `src/` files are capped at 400 lines by lint; `test/**` at 450; style partials at 400.
- Coverage thresholds in `vitest.config.mts` only ever go up.
- UI text is sentence case. Use `setCssProps` over inline styles. No global `app`.
- Per-card controls inside a card projection are `<button>` with `tabindex="-1"` — each
  card projection is one tab stop.
- Nothing in this feature writes frontmatter. If a step tempts you to write, stop: the
  read-only property is what makes the context-row rule hold without a check.
- A wikilink in `docs/` must not wrap across a line — `docs-check.mjs` captures the
  newline inside it and reports "unresolved wikilink".

---

### Task 1: The disclosure

**Files:**
- Create: `src/view/render/cardChildren.ts`
- Create: `styles/card-children.css`
- Create: `docs/requirements/Children on the card.md`
- Create: `test/view/cardChildren.test.ts`
- Modify: `styles/index.css` (import list)
- Modify: `src/view/render/columns.ts` (`RowContext`, `rowContext`)
- Modify: `src/view/render/board.ts` (`renderCardBody`)
- Modify: `src/view/host.ts` (`BacklogViewHost.cardChildrenShown`)
- Modify: `src/view/backlogView.ts` (own the set, clear it per pass, pass it to `rowCtx`)

**Interfaces:**
- Consumes: `BacklogViewHost.isRowHidden`, `isCollapsed`, `setCollapsed`, `isFiltering`,
  `openItem`, `openItemInNewTab`; `renderBadge` / `renderTitleText` from
  `./rows`; `uniqueElementId` from `../selection`.
- Produces:
  - `listedChildren(host: BacklogViewHost, item: BacklogItem): BacklogItem[]`
  - `childrenLabel(children: BacklogItem[]): string`
  - `renderCardChildren(ctx: RowContext, card: HTMLElement, item: BacklogItem): void`
  - `RowContext.cardKids: Set<string>`
  - `BacklogViewHost.cardChildrenShown: ReadonlySet<string>`

- [ ] **Step 1: Write the failing test**

Create `test/view/cardChildren.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

useViewHarness();

/** The disclosure's toggle, or null when the card drew none. */
function disclosure(card: HTMLElement): HTMLButtonElement | null {
	return card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
}

function kidTitles(card: HTMLElement): string[] {
	return Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map(
		(el) => el.textContent ?? '',
	);
}

/** `boardVault` plus a grandchild, so "direct children only" has something to exclude. */
function nestedVault(): FakeVault {
	const vault = boardVault();
	vault.addFile('Task B1a.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Feature B1' });
	return vault;
}

describe('children on the card', () => {
	it('names the visible direct children, by their shared type', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.textContent).toContain('2 features');
	});

	it('draws nothing on a card with no children', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic A'))).toBeNull();
	});

	it('opens collapsed, and lists the children once expanded', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		expect(kidTitles(card)).toEqual([]);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('false');

		disclosure(card)?.click();

		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('true');
	});

	it('lists direct children only — a grandchild is not on the epic', () => {
		const { containerEl } = makeBoard(nestedVault());
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
	});
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run test/view/cardChildren.test.ts`
Expected: FAIL — every case, because `.pbl-card-kids-toggle` does not exist yet
(`disclosure(...)` returns null, so `?.textContent` is undefined and `kidTitles` is `[]`).

- [ ] **Step 3: Carry the per-pass set on `RowContext`**

In `src/view/render/columns.ts`, add the field to the interface and the builder:

```ts
export interface RowContext {
	host: BacklogViewHost;
	dnd: DragDropController;
	/** Rendered rows by path — the view's O(1) lookup for selection and subtree updates. */
	rows: Map<string, HTMLElement>;
	/**
	 * Paths whose card drew a child disclosure this pass. Filled by the render and read
	 * by the card menu and the toolbar's bulk controls, so both answer from what is on
	 * screen rather than re-deriving it and hoping the two agree.
	 */
	cardKids: Set<string>;
	chips: ChipProp[];
}

export function rowContext(
	host: BacklogViewHost,
	dnd: DragDropController,
	rows: Map<string, HTMLElement>,
	cardKids: Set<string>,
): RowContext {
	return { host, dnd, rows, cardKids, chips: host.chips };
}
```

- [ ] **Step 4: Publish it on the host**

In `src/view/host.ts`, beside `board` and `roadmap`:

```ts
	/**
	 * Paths whose card drew a child disclosure in the last render pass — rebuilt per
	 * pass exactly as `board` and `roadmap` are. The menu offers children where the
	 * screen shows them; a surface that drew no body (a timeline row, a tree row) is
	 * absent, so the discriminator is what happened rather than which projection it is.
	 *
	 * Readonly, and not the write path: the render fills the view's own set through
	 * `RowContext.cardKids`. A renderer adding through this member would need a cast,
	 * which is how a readonly boundary becomes decorative.
	 */
	readonly cardChildrenShown: ReadonlySet<string>;
```

In `src/view/backlogView.ts`, add the field beside `board` (near line 58), the getter, and
the two wiring changes:

```ts
	/** Backing store for `cardChildrenShown`; the render fills it, `render` clears it. */
	private readonly cardKids = new Set<string>();

	get cardChildrenShown(): ReadonlySet<string> {
		return this.cardKids;
	}
```

In `rowCtx()` (near line 523):

```ts
	private rowCtx(): RowContext {
		return rowContext(this, this.dnd, this.rowEls, this.cardKids);
	}
```

And clear it where `rowEls` is cleared, immediately after `this.treeEl.empty();`:

```ts
		this.rowEls.clear();
		// Same lifetime as the row index: a set that outlived its render would claim
		// disclosures for a screen that is gone.
		this.cardKids.clear();
```

- [ ] **Step 5: Write the module**

Create `src/view/render/cardChildren.ts`:

```ts
import { setIcon, setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { renderBadge, renderTitleText } from './rows';
import { BacklogViewHost } from '../host';
import { uniqueElementId } from '../selection';
import { BacklogItem } from '../../domain/model';

/**
 * One level of the tree, on the card. A rollup says three of eight are done and never
 * which three; this says which — and stops there, because a card that nested would be
 * a board inside a board.
 */

/**
 * The direct children a card may list: the ones the view is showing anyway.
 * `isRowHidden` is the single visibility rule the tree and both card projections
 * share, so a done child hidden from the tree is absent here too — while the card's
 * rollup goes on counting it. The two numbers differ on purpose.
 */
export function listedChildren(host: BacklogViewHost, item: BacklogItem): BacklogItem[] {
	return item.children.filter((child) => !host.isRowHidden(child));
}

/**
 * What the disclosure calls them. Naming the type is worth more than a bare count — a
 * board of Epics says "3 features" — but only while they agree on one, since a mixed
 * set has no true name. The plural is a naive `+ s`, the same shape `columnLabel` uses
 * for `1 card` / `2 cards`: type names are user data, so a declared type that
 * pluralizes otherwise reads slightly wrong, and the ceiling is a word, never an action.
 */
export function childrenLabel(children: BacklogItem[]): string {
	const count = children.length;
	const type = children[0]?.typeName ?? null;
	if (type !== null && children.every((child) => child.typeName === type)) {
		return `${count} ${type.toLowerCase()}${count === 1 ? '' : 's'}`;
	}
	return `${count} child${count === 1 ? '' : 'ren'}`;
}

/**
 * The disclosure, and the list when it is open. Nothing here writes frontmatter — that
 * is what makes the context-row rule hold by construction rather than by a check, so a
 * context card gets this like any other card.
 */
export function renderCardChildren(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	// Annotated rather than inferred from `ctx.host` so fallow can see which host
	// members this file uses — it resolves interface members through an explicit type
	// and not through a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const children = listedChildren(host, item);
	// A card whose children have all hidden draws no chevron, exactly as such a row
	// renders as a leaf: a disclosure opening onto nothing is a lie.
	if (children.length === 0) return;
	ctx.cardKids.add(item.file.path);

	const wrap = card.createDiv({ cls: 'pbl-card-kids' });
	const list = wrap.createEl('ul', { cls: 'pbl-card-kids-list' });
	list.id = uniqueElementId('pbl-card-kids');
	const toggle = wrap.createEl('button', {
		cls: 'pbl-card-kids-toggle',
		attr: { type: 'button', tabindex: '-1', 'aria-controls': list.id },
	});
	// Both ids are minted rather than derived: these attributes resolve across the whole
	// document, and two saved views can sit in split panes.
	toggle.id = uniqueElementId('pbl-card-kids-toggle');
	// The list is NAMED by the toggle, not merely controlled by it. `aria-controls`
	// says the two are related and nothing about what the list holds, so a reader
	// arriving straight at the list would get no count and no context; `aria-labelledby`
	// is what makes it announce "3 features" before its items.
	list.setAttribute('aria-labelledby', toggle.id);
	const chevron = toggle.createSpan({ cls: 'pbl-card-kids-chevron' });
	setIcon(chevron, 'chevron-right');
	toggle.createSpan({ cls: 'pbl-card-kids-count', text: childrenLabel(children) });
	// The quick filter OVERRIDES collapse state without replacing it: `isCollapsed`
	// returns false while it runs, but `setCollapsed` still writes. A live toggle would
	// therefore write state that reads back as expanded, look inert, and then take
	// effect once the filter cleared. Same real `disabled` flag the toolbar's collapse
	// controls take, for the same reason — `pointer-events: none` stops a mouse and
	// nothing else.
	toggle.disabled = host.isFiltering();
	// The list sits after the toggle in the DOM so a reader meets the count first; CSS
	// orders them visually.
	wrap.append(list);

	// The disclosure counts what it LISTS and the rollup beside it counts everything
	// beneath, so with completed work hidden the two disagree on purpose. Said out loud
	// only when it is true, and only in the one place a user can ask: two numbers
	// differing with nothing to explain them reads as broken data, and a permanent
	// caveat on every card reads as noise.
	const omitted = item.children.length - children.length;
	const note = omitted > 0 ? ` — ${omitted} more ${omitted === 1 ? 'is' : 'are'} hidden by the current view` : '';

	const draw = (): void => {
		// Read live, never captured at wire time: a surrounding refresh can change this
		// under a listener that is still attached.
		const collapsed = host.isCollapsed(item.file.path);
		toggle.setAttribute('aria-expanded', String(!collapsed));
		chevron.toggleClass('pbl-expanded', !collapsed);
		setTooltip(toggle, (collapsed ? `Show what is under "${item.title}"` : 'Hide these') + note);
		list.empty();
		if (collapsed) return;
		for (const child of children) renderChildEntry(host, list, child);
	};

	toggle.addEventListener('click', (evt) => {
		// The card listens on itself. Without this the note opens AND the card expands
		// underneath it, so a broken toggle looks like a working one.
		evt.stopPropagation();
		host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
		draw();
	});
	// A middle click never fires `click`, so the guard above never runs for it and the
	// card's own `auxclick` opens the parent in a new tab. There is nothing to do on a
	// middle click here — doing nothing is exactly what has to be arranged for.
	toggle.addEventListener('auxclick', (evt) => evt.stopPropagation());
	draw();
}

function renderChildEntry(host: BacklogViewHost, list: HTMLElement, child: BacklogItem): void {
	const li = list.createEl('li');
	const entry = li.createEl('button', {
		cls: 'pbl-card-kid' + (child.done ? ' pbl-done' : ''),
		attr: { type: 'button', tabindex: '-1' },
	});
	renderBadge(host, entry, child);
	// Through `renderTitleText`, so a quick-filter match highlights here exactly as it
	// does in a row or a card title.
	renderTitleText(host, entry.createSpan({ cls: 'pbl-card-kid-title' }), child.title);
	setTooltip(entry, `Open "${child.title}"`);
	entry.addEventListener('click', (evt) => {
		evt.stopPropagation();
		host.openItem(child, evt);
	});
	entry.addEventListener('auxclick', (evt) => {
		if (evt.button !== 1) return;
		evt.stopPropagation();
		host.openItemInNewTab(child);
	});
}
```

- [ ] **Step 6: Call it from the shared card body**

In `src/view/render/board.ts`, at the end of `renderCardBody`:

```ts
	if (ctx.chips.length > 0) renderPropCells(ctx, card, item);
	renderRollup(host, card, item);
	// One call, three surfaces: board cards, roadmap bucket cards and shelf cards all
	// come through here. Timeline rows never do — they use the card SHELL with a
	// bar-grid row layout — which is exactly why they get no disclosure.
	renderCardChildren(ctx, card, item);
```

Add the import at the top of the file:

```ts
import { renderCardChildren } from './cardChildren';
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run test/view/cardChildren.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 8: Write the stylesheet partial**

Create `styles/card-children.css`:

```css
/* ==========================================================================
   Children on the card

   One level of the tree, on a card. Loaded after `cards.css` so its rules win at
   equal specificity — the disclosure sits inside `.pbl-card` and overrides the
   card's own type scale.
   ========================================================================== */

.pbl-card-kids {
	display: flex;
	flex-direction: column;
	gap: var(--size-2-1);
}

.pbl-card-kids-toggle {
	display: flex;
	align-items: center;
	gap: var(--size-2-1);
	align-self: flex-start;
	padding: 0 var(--size-2-1);
	height: auto;
	line-height: 1.4;
	box-shadow: none;
	background-color: transparent;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

.pbl-card-kids-toggle:hover:not(:disabled) {
	background-color: var(--background-modifier-hover);
	color: var(--text-normal);
}

.pbl-card-kids-toggle:disabled {
	opacity: 0.5;
}

.pbl-card-kids-chevron {
	display: flex;
	align-items: center;
	transition: transform 100ms ease-in-out;
}

.pbl-card-kids-chevron .svg-icon {
	width: 14px;
	height: 14px;
}

.pbl-card-kids-chevron.pbl-expanded {
	transform: rotate(90deg);
}

/*
 * No padding and no gap: the indent belongs to the ENTRY, below, so the button covers
 * it. A `<ul>` that carried the indent itself would leave a clickable strip beside every
 * child that belongs to neither — and on a card, space that belongs to no control
 * belongs to the card, which would put "open the parent" exactly where the eye reads
 * "child". Giving it to the button makes that strip activate the child instead.
 */
.pbl-card-kids-list {
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pbl-card-kids-list:empty {
	display: none;
}

.pbl-card-kid {
	display: flex;
	align-items: center;
	gap: var(--size-2-2);
	width: 100%;
	/* The left value is the list's indent, carried by the button so it is clickable. */
	padding: var(--size-2-1) var(--size-2-1) var(--size-2-1) var(--size-4-3);
	height: auto;
	line-height: 1.4;
	box-shadow: none;
	background-color: transparent;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	text-align: left;
}

.pbl-card-kid:hover {
	background-color: var(--background-modifier-hover);
	color: var(--text-normal);
}

.pbl-card-kid-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pbl-card-kid.pbl-done .pbl-card-kid-title {
	text-decoration: line-through;
	opacity: 0.7;
}
```

Add the import to `styles/index.css`, immediately after `cards.css`:

```css
@import "./board.css";
@import "./cards.css";
@import "./card-children.css";
@import "./roadmap.css";
```

- [ ] **Step 9: Write the register note**

Create `docs/requirements/Children on the card.md`. Order 40 is the first free rank under
`Backlog and board` (10 Switching projections, 20 What a card shows, 30 Board empty
states):

```markdown
---
type: PBI
parent: "[[Backlog and board]]"
order: 40
status: Open
priority: P2
created: 2026-08-07
files:
  - src/view/render/cardChildren.ts
---

# Children on the card

**As** someone reading a board of epics, **I want** to open a card and see what is
directly under it, **so that** I learn which features an epic holds without leaving the
projection I am working in.

A rollup says three of eight are done. It never says which three. Azure DevOps cards
carry a child checklist and GitHub Projects a sub-issue list for the reason
[[What a card shows]] already cites — on a board, the hierarchy has to travel on the
card — and a count is the half of it that cannot be acted on.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Expanding a card that has children |
| **Preconditions** | A card projection is showing, and the item has at least one child the view is not hiding |
| **Guarantee** | The disclosure shows exactly the direct children the tree would show, reaches every one of them without a pointer, and writes nothing to any note. |

**Main flow**

1. The card renders a disclosure naming its visible direct children by count and, when
   they share one, by type.
2. The user opens it.
3. The card lists those children — type badge and name — one level deep.
4. Activating an entry opens that child's note.
5. The state is remembered, per saved view and per device, like every other collapse.

**Extensions**

- **1a — the item has no visible direct children.** No disclosure renders. A card whose
  children have all hidden is a leaf, exactly as such a row is: a chevron opening onto
  nothing is a lie its rollup already covers for.
- **1b — the card is a timeline row.** No disclosure. A dated-axis row is the card
  *shell* in a bar-grid layout, and a disclosure inside that geometry is its own
  question.
- **1c — the quick filter is running.** It overrides collapse state, so every listed
  card shows its children and the toggle is disabled — it would otherwise write state
  that reads back as expanded and took effect once the filter cleared.
- **3a — a child is done.** Listed, styled done. Hiding finished work is the option that
  says so, not this.
- **3b — a child already has a card of its own.** Still listed. The disclosure answers
  what is under this item, and that does not change with where else the item is drawn.
- **3c — a child matched the quick filter.** The card's match list stops naming it, since
  the disclosure does. One card cannot say the same thing twice.
- **4a — the user has no pointer.** The card menu offers the same children, from the same
  list. A disclosure nobody without a mouse can reach is not a list of children.
- **5a — the item is a context row.** It gets the disclosure like any other card. Nothing
  here writes, so the rule that governs it is not in question.

## Acceptance criteria

- A card with at least one visible direct child renders a disclosure naming them by
  count, and by type when they share one; a card with none renders no disclosure at all,
  including when its children are hidden rather than absent.
- Expanded, the card lists its direct children and only those — a grandchild never
  appears. Each entry carries the child's type badge and name, and a done child is styled
  done.
- Which children are listed is `isRowHidden`, the rule the tree and both card projections
  already share, so hiding completed work and the quick filter mean the same thing here
  as everywhere. The card's rollup keeps counting what the list omits.
- Activating an entry opens that child, and never the card's own note — by primary click
  and by middle click, which are separate events and separately guarded. The toggle
  opens nothing on either.
- Expansion is the tree's own per-path collapse state: remembered per saved view and per
  device, unchanged by a data update, and shared with the row, so one bit means "this
  node is open" in both projections. While the quick filter runs the toggle is disabled.
- The card menu offers the same children, on a right-click and on the menu key, and does
  not offer them on a surface that drew no disclosure.
- Nothing in the feature writes to a note.

## Where it lives

`src/view/render/cardChildren.ts` — `listedChildren` (the visible direct children),
`childrenLabel` (what to call them) and `renderCardChildren` (the disclosure, and the
list when it is open), called from `renderCardBody` in `src/view/render/board.ts` so
every card projection gets one implementation and timeline rows, which use the card
shell without the body, get none. The module also records which paths it drew a
disclosure for; the view publishes that set and `src/view/interactions/menu.ts` and the
toolbar's bulk controls read it, so neither re-derives an answer the screen already has.
Driven in `test/view/cardChildren.test.ts`, and against context cards in
`test/view/contextCardWrites.test.ts`.
```

- [ ] **Step 10: Run the full check**

Run: `npm run check`
Expected: all five steps pass. If `docs` fails with "unresolved wikilink", a link wrapped
across a line — reword so it does not.

- [ ] **Step 11: Commit**

```bash
git add src/view/render/cardChildren.ts styles/card-children.css styles/index.css \
  src/view/render/columns.ts src/view/render/board.ts src/view/host.ts \
  src/view/backlogView.ts docs/requirements/Children\ on\ the\ card.md \
  test/view/cardChildren.test.ts
git commit -m "feat: expand a card to see its direct children"
```

---

### Task 2: The interaction rules the disclosure has to keep

**Files:**
- Modify: `test/view/cardChildren.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced. No new production code is expected — this task
  exists to prove Task 1's guards, and to find them missing if they are.

- [ ] **Step 1: Write the failing tests**

Append to the `describe` block in `test/view/cardChildren.test.ts`:

```ts
	it('excludes a child the view is hiding, and says so in the count', () => {
		// Feature B1 is Done; with completed work hidden it is not a child on screen.
		const { containerEl } = makeBoard(boardVault(), { showCompleted: false });
		const card = cardByTitle(containerEl, 'Epic B');
		expect(disclosure(card)?.textContent).toContain('1 feature');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B2']);
	});

	// The rollup beside it still counts two. That disagreement is deliberate, and a
	// deliberate disagreement nothing explains is indistinguishable from a bug.
	it('explains the omitted child in the tooltip, and only when there is one', () => {
		const hiding = makeBoard(boardVault(), { showCompleted: false });
		expect(disclosure(cardByTitle(hiding.containerEl, 'Epic B'))?.dataset.tooltip).toContain(
			'1 more is hidden by the current view',
		);

		const showing = makeBoard(boardVault());
		expect(disclosure(cardByTitle(showing.containerEl, 'Epic B'))?.dataset.tooltip).not.toContain('hidden');
	});

	// `aria-controls` says the two are related and nothing about what the list holds.
	// A reader landing straight on the list needs the count, which is the toggle's text.
	it('names the list by the disclosure, not merely controls it', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		const toggle = disclosure(card);
		const list = card.querySelector<HTMLElement>('.pbl-card-kids-list');

		expect(toggle?.id).toBeTruthy();
		expect(list?.getAttribute('aria-labelledby')).toBe(toggle?.id);
		expect(toggle?.textContent).toContain('2 features');
	});

	it('styles a done child done', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();
		const done = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid.pbl-done'));
		expect(done.map((el) => el.querySelector('.pbl-card-kid-title')?.textContent)).toEqual([
			'Feature B1',
		]);
	});

	it('opens the child, not the card, on a primary click', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();

		card.querySelectorAll<HTMLElement>('.pbl-card-kid')[0].click();

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	it('opens the child, not the card, on a middle click', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();

		card
			.querySelectorAll<HTMLElement>('.pbl-card-kid')[0]
			.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	// The toggle is the control whose failure is invisible: the card expands either way,
	// so an opened note is the only evidence the guard is missing.
	it('opens nothing when the toggle itself is clicked', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();
		expect(vault.opened).toEqual([]);
	});

	it('opens nothing when the toggle itself is middle-clicked', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.dispatchEvent(
			new MouseEvent('auxclick', { button: 1, bubbles: true }),
		);
		expect(vault.opened).toEqual([]);
	});

	it('keeps an expanded card expanded across a data update', () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();

		refresh(view, vault);

		expect(kidTitles(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('shares its bit with the tree row, because it is the same bit', () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();

		view.setProjection('tree');

		expect(titlesOf(containerEl)).toContain('Feature B1');
	});

	it('disables the toggle while the quick filter runs, and lists anyway', () => {
		const { containerEl, view } = makeBoard(boardVault());
		view.setFilter('Feature B');
		const card = cardByTitle(containerEl, 'Epic B');
		// Asserted on the property, not a class: a control disabled only in CSS still
		// answers a keyboard.
		expect(disclosure(card)?.disabled).toBe(true);
		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
	});
```

Extend the imports at the top of the file:

```ts
import { refresh, titlesOf, useViewHarness } from '../helpers/view';
```

- [ ] **Step 2: Run them and read each failure**

Run: `npx vitest run test/view/cardChildren.test.ts`
Expected: the four guard cases and the filter case are the ones that matter. If any of
them PASSES without you having written the corresponding guard in Task 1, the test is
not reaching the behaviour — fix the test, not the count. In particular, if
"opens nothing when the toggle itself is middle-clicked" passes with the `auxclick`
guard deleted, the event is not reaching the card and the test proves nothing.

- [ ] **Step 3: Watch a guard fail on purpose**

Temporarily delete the `toggle.addEventListener('auxclick', …)` line from
`src/view/render/cardChildren.ts`.

Run: `npx vitest run test/view/cardChildren.test.ts -t 'middle-clicked'`
Expected: FAIL — `vault.opened` holds `Epic B.md`.

Restore the line and re-run: PASS. Repeat for the `click` guard with the primary-click
case. This is the repository's standing rule: an invariant asserted in a comment gets a
test that fails without it, and the test is watched failing.

- [ ] **Step 4: Run the full check**

Run: `npm run check`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add test/view/cardChildren.test.ts
git commit -m "test: the disclosure's guards, watched failing"
```

---

### Task 3: The card menu offers the same children

**Files:**
- Modify: `src/view/interactions/menu.ts`
- Modify: `test/view/cardChildren.test.ts`

**Interfaces:**
- Consumes: `listedChildren` and `BacklogViewHost.cardChildrenShown` from Task 1.
- Produces: `addChildrenSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void`,
  called from `buildItemMenu`.

- [ ] **Step 1: Write the failing test**

Append to `test/view/cardChildren.test.ts`:

```ts
	it('offers the same children in the card menu, on a right-click', () => {
		const { containerEl } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Feature B1"');
		expect(titles).toContain('Open child "Feature B2"');
	});

	// The menu key is the case the section exists for — and it reaches buildItemMenu
	// through showContextMenuFor, never through the render's wiring. A discriminator
	// that lived on the pointer path would pass the test above and fail here.
	it('offers them on the menu key too', () => {
		const { containerEl, view } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		card.click();
		view.showContextMenuFor(
			// The selected item, by the same path the card carries.
			view.model!.items.find((i) => i.file.path === card.dataset.path)!,
		);

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Feature B1"');
	});

	it('opens the child from the menu entry', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		Menu.lastShown?.item('Open child "Feature B1"')?.clickHandler?.();

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	it('offers nothing on a card that drew no disclosure', () => {
		const { containerEl } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.some((t) => t.startsWith('Open child'))).toBe(false);
	});
```

Extend the imports:

```ts
import { Menu } from '../helpers/obsidian-mock';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/cardChildren.test.ts -t 'menu'`
Expected: FAIL — no menu item titled `Open child "Feature B1"`.

- [ ] **Step 3: Add the section**

In `src/view/interactions/menu.ts`, add the function beside `addMatchSection`:

```ts
/**
 * The children this card is showing, offered where a pointer is not available. Each
 * card projection is one tab stop, so the disclosure's entries are `tabindex="-1"`
 * buttons and this is their keyboard path — the same answer the tree gives for the add
 * button and the state chip.
 *
 * The gate is `cardChildrenShown`, filled by the render, and not the projection: a
 * dated-axis timeline row shares `wireCardActivation` with real cards but draws no body
 * and so no disclosure, and the axis cannot separate them either, since that axis also
 * draws a shelf of real cards. Reading what the render drew also survives the entry
 * point: the menu key arrives through `showContextMenuFor`, which calls `buildItemMenu`
 * directly and never touches the render's wiring, so a flag threaded through that wiring
 * would miss exactly the case this section exists for.
 */
function addChildrenSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!host.cardChildrenShown.has(item.file.path)) return;
	menu.addSeparator();
	for (const child of listedChildren(host, item)) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Open child "${child.title}"`)
				.setIcon('corner-left-down')
				.onClick((evt) => host.openItem(child, evt)),
		);
	}
}
```

Call it in `buildItemMenu`, immediately after `addMatchSection`:

```ts
	addMatchSection(host, menu, item);
	addChildrenSection(host, menu, item);
	addShelfSection(host, menu);
```

Add the import:

```ts
import { listedChildren } from '../render/cardChildren';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/view/cardChildren.test.ts`
Expected: PASS.

- [ ] **Step 5: Prove the timeline row is excluded**

The dated axis is the one place a bar row and a shelf card sit in **one** projection, so
it is the only fixture where the rule can fail and be seen. A test that drove the
projection alone would pass while the rule was wrong.

Add to `test/view/cardChildren.test.ts`:

```ts
	/**
	 * The dated axis, drawing both surfaces at once: `Dated epic` has two dates so it
	 * gets a timeline ROW (the card shell in a bar-grid layout, never `renderCardBody`),
	 * while its undated `Feature X` is unplaceable and lands on the shelf, which draws
	 * ordinary cards. `horizonProperty: ''` clears the horizon axis `makeRoadmap`
	 * configures by default, so `activeAxis` resolves to dates.
	 */
	function datedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Feature X.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Dated epic' });
		vault.addFile('Task X1.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Feature X' });
		return vault;
	}

	const DATED_AXIS = { startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' };

	it('offers nothing on a timeline row, which draws no body', () => {
		const { containerEl } = makeRoadmap(datedVault(), DATED_AXIS);
		rowFor(containerEl, 'Dated epic')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.some((t) => t.startsWith('Open child'))).toBe(false);
	});

	it('still offers them on a shelf card in the same projection', () => {
		const { containerEl } = makeRoadmap(datedVault(), DATED_AXIS);
		cardByTitle(containerEl, 'Feature X').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Task X1"');
	});
```

Extend the imports:

```ts
import { makeRoadmap, rowFor } from '../helpers/roadmap';
```

If the fixture does not actually produce both surfaces — check with
`shelfTitles(containerEl)` and `timelineRows(containerEl)` — adjust the **fixture** until
it does. Do not weaken the assertion: a test that no longer has both surfaces in one
projection is not testing the rule.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: pass. If `test/view/cardChildren.test.ts` is over 450 lines, split it — the
menu cases are the natural second file (`test/view/cardChildrenMenu.test.ts`), and the
register note's `## Where it lives` gains its name.

- [ ] **Step 7: Commit**

```bash
git add src/view/interactions/menu.ts test/view/cardChildren.test.ts
git commit -m "feat: the card menu offers the children the card lists"
```

---

### Task 4: One card never names the same child twice

**Files:**
- Modify: `src/view/render/cardChildren.ts`
- Modify: `src/view/render/board.ts` (`renderCardMatches`)
- Modify: `src/view/interactions/menu.ts` (`addMatchSection`)
- Modify: `test/view/cardChildren.test.ts`

**Interfaces:**
- Produces: `undisclosedMatches(host: BacklogViewHost, item: BacklogItem, carded: Set<string>): BacklogItem[]`
  in `cardChildren.ts`, used by both the card face and the menu.

- [ ] **Step 1: Write the failing test**

```ts
	it('does not name a matched child twice on one card', () => {
		const { containerEl, view } = makeBoard(boardVault());
		view.setFilter('Feature B1');
		const card = cardByTitle(containerEl, 'Epic B');

		// The disclosure lists it (the filter forces every card open) …
		expect(kidTitles(card)).toContain('Feature B1');
		// … so the match list must not name it as well.
		const matches = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-match')).map(
			(el) => el.textContent,
		);
		expect(matches).not.toContain('Feature B1');
	});

	it('still names a match the disclosure cannot reach', () => {
		const { containerEl, view } = makeBoard(nestedVault(), {}, { focus: 'Epic' });
		view.setFilter('Task B1a');
		const card = cardByTitle(containerEl, 'Epic B');

		// A grandchild: one level down is not what the disclosure shows, and with the
		// board focused on Epics it has no card of its own either. The match list is the
		// only thing that can reach it, so the dedup must not have taken it.
		const matches = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-match')).map(
			(el) => el.textContent,
		);
		expect(matches).toContain('Task B1a');
	});
```

- [ ] **Step 2: Run to verify the first fails**

Run: `npx vitest run test/view/cardChildren.test.ts -t 'twice'`
Expected: FAIL — `Feature B1` appears in both lists.

- [ ] **Step 3: State the rule once**

Add to `src/view/render/cardChildren.ts`:

```ts
/**
 * The matches a card should name on its face: everything `hiddenMatches` found beneath
 * it, minus anything its own disclosure already lists. One card cannot say the same
 * thing twice — and the walk itself is untouched, so a match three levels down still
 * surfaces where nothing else can reach it.
 *
 * Unconditional, not conditional on the card being expanded: a collapsed disclosure
 * still says "3 tasks" and is one click from the child, so the match stays reachable,
 * and making this depend on expansion state would mean a toggle had to rebuild the
 * match list too.
 */
export function undisclosedMatches(
	host: BacklogViewHost,
	item: BacklogItem,
	carded: Set<string>,
): BacklogItem[] {
	const listed = new Set(listedChildren(host, item).map((child) => child.file.path));
	return hiddenMatches(item, (child) => host.isFilterMatch(child), carded).filter(
		(match) => !listed.has(match.file.path),
	);
}
```

Add the import:

```ts
import { hiddenMatches } from '../../domain/board';
```

- [ ] **Step 4: Read it from both surfaces**

In `src/view/render/board.ts`, inside `renderCardMatches`, replace the `hiddenMatches`
call:

```ts
	const matches = undisclosedMatches(host, item, carded);
```

and swap the import of `hiddenMatches` for `undisclosedMatches` from `./cardChildren`
(leave `cardPaths` and the rest of the `domain/board` import alone).

In `src/view/interactions/menu.ts`, inside `addMatchSection`, make the same replacement,
so the menu and the card face cannot disagree about which matches are worth naming.

- [ ] **Step 5: Run to verify both pass**

Run: `npx vitest run test/view/cardChildren.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the existing board-filter suite**

Run: `npx vitest run test/view/boardFilter.test.ts test/view/board.test.ts`
Expected: PASS. If a case now fails because a match it expected is a direct child, that
is this feature changing behaviour on purpose — update the assertion and say so in the
commit message, do not weaken the dedup.

- [ ] **Step 7: Run the full check and commit**

```bash
npm run check
git add src/view/render/cardChildren.ts src/view/render/board.ts \
  src/view/interactions/menu.ts test/view/cardChildren.test.ts
git commit -m "fix: a card names a matched child once, not twice"
```

---

### Task 5: The toolbar's bulk controls reach cards

**Files:**
- Modify: `src/view/render/toolbar.ts`
- Modify: `src/view/backlogView.ts`
- Modify: `test/view/toolbar.test.ts` (or the suite that covers the collapse controls —
  find it with `rg 'Collapse all' test/`)

**Interfaces:**
- Produces: `syncCollapseCtls(host: BacklogViewHost, barEl: HTMLElement): void`, exported
  from `toolbar.ts` and called after the content render.

- [ ] **Step 1: Write the failing test**

**Four cases, two per projection.** The rule is about *card projections*, not about the
board, so board-only coverage would still pass if the controls were always disabled on
the roadmap, never redrew its bucket and shelf cards, or stayed enabled on a
timeline-only dated axis. Each projection gets one enabled case and one disabled case.

```ts
	function collapseCtls(containerEl: HTMLElement): HTMLButtonElement[] {
		return Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl'));
	}

	function collapseCtl(containerEl: HTMLElement, label: string): HTMLButtonElement | undefined {
		// `iconButton` puts the label in `aria-label`; the button's own text is an icon.
		return collapseCtls(containerEl).find((b) => b.getAttribute('aria-label') === label);
	}

	function kidTitlesOf(card: HTMLElement): (string | null)[] {
		return Array.from(card.querySelectorAll('.pbl-card-kid-title')).map((el) => el.textContent);
	}

	it('offers Expand all and Collapse all on the board, driving the cards', () => {
		const { containerEl } = makeBoard(boardVault());
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('drives the roadmap’s cards too', () => {
		// A horizon roadmap: its bucket cards and shelf cards both come through
		// `renderCardBody`, so they carry disclosures exactly as board cards do.
		const vault = horizonVault();
		vault.addFile('Feature N1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Now item' });
		const { containerEl } = makeRoadmap(vault);
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Now item'))).toEqual(['Feature N1']);
	});

	// Half the original gate's reason survives: on a projection that drew no disclosure
	// these buttons change nothing on screen and still write collapse state, which then
	// surprises the tree. Disabled, not absent, and on the property rather than in CSS.
	it('disables them on a board that drew no cards at all', () => {
		// No configured workflow, so the board draws guidance rather than columns.
		const { containerEl } = makeBoard(boardVault(), { stateProperty: '', stateValues: '' });
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on a dated roadmap whose only rows are timeline rows', () => {
		const vault = new FakeVault();
		// BOTH dated, so both draw bars and neither is unplaceable: the shelf stays
		// empty, no card body is drawn anywhere in the projection, and there is
		// genuinely nothing to collapse. This is the case a board-only test cannot
		// reach — cards exist on screen, and none of them is a card body.
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Dated feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-09-01', due: '2026-10-01' },
			parentLink: 'Dated epic',
		});
		const { containerEl } = makeRoadmap(vault, DATED_AXIS);

		// Confirm the fixture really is timeline-only before trusting the verdict.
		expect(shelfTitles(containerEl)).toEqual([]);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});
```

`DATED_AXIS` is the constant defined in Task 3 — if these live in a different file,
repeat it rather than exporting it from a test:
`{ startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' }`.

Imports for this block:

```ts
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap, shelfTitles } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
```

Check the accessible-name attribute `iconButton` sets before writing the finder — read
`iconButton` in `src/view/render/toolbar.ts` and match it.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/view/toolbar.test.ts -t 'Expand all'`
Expected: FAIL — no `.pbl-collapse-ctl` exists in board mode at all.

- [ ] **Step 3: Remove the projection gate**

In `src/view/render/toolbar.ts`, unwrap the two `collapseButton` calls (currently inside
`if (host.projection === 'tree')`) and replace the comment above them:

```ts
	// Expand and collapse drive the tree's rows and, since cards grew disclosures, the
	// cards too. They are no longer gated on the projection — but they ARE gated on the
	// screen having something to collapse: see `syncCollapseCtls`, which runs after the
	// content render because that is what fills the set it reads.
	collapseButton(host, barEl, 'chevrons-up-down', 'Expand all', () => {
		for (const item of model.items) host.setCollapsed(item.file.path, false);
	});
	collapseButton(host, barEl, 'chevrons-down-up', 'Collapse all', () => {
		for (const item of model.items) {
			if (item.children.length > 0) host.setCollapsed(item.file.path, true);
		}
	});
```

- [ ] **Step 4: Add the post-content sync**

In `src/view/render/toolbar.ts`, beside `syncCountLabel`:

```ts
/**
 * The bulk collapse controls, decided from what the render actually drew. It has to run
 * AFTER the content: `renderToolbar` goes first and the cards are drawn afterwards, so a
 * verdict taken during the toolbar pass would read the previous frame's set —
 * `syncCountLabel` above is the same shape for the same reason.
 *
 * A card projection with no disclosure gets them disabled rather than removed. They
 * would otherwise write collapse state that changes nothing on screen and then surprises
 * the tree later — inert to look at and not inert in effect, which is the worst pairing.
 * The real `disabled` property, never CSS: `pointer-events: none` stops a mouse and
 * nothing else.
 */
export function syncCollapseCtls(host: BacklogViewHost, barEl: HTMLElement): void {
	const nothingToCollapse = host.projection !== 'tree' && host.cardChildrenShown.size === 0;
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl').forEach((btn) => {
		btn.disabled = host.isFiltering() || nothingToCollapse;
	});
}
```

In `src/view/backlogView.ts`, call it beside `syncCountLabel` (near line 510):

```ts
		syncCountLabel(this, this.toolbarEl);
		syncCollapseCtls(this, this.toolbarEl);
```

and add it to the import from `./render/toolbar` on line 27.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/view/toolbar.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the disabled cases fail**

Temporarily change `nothingToCollapse` to `false`.

Run: `npx vitest run test/view/toolbar.test.ts -t 'disables them'`
Expected: FAIL — **both** cases, the board one and the dated-roadmap one. If only the
board case goes red, the roadmap fixture is not timeline-only; the `shelfTitles`
assertion inside it should have caught that, so fix the fixture.

Restore and re-run: PASS.

Then the mirror check — temporarily change `nothingToCollapse` to
`host.projection !== 'tree'` (the naive "always disabled off the tree" bug):

Run: `npx vitest run test/view/toolbar.test.ts -t 'Expand all|roadmap'`
Expected: FAIL on both enabled cases. This is the failure mode board-only coverage
would have missed entirely. Restore.

- [ ] **Step 7: Run the full check and commit**

```bash
npm run check
git add src/view/render/toolbar.ts src/view/backlogView.ts test/view/toolbar.test.ts
git commit -m "feat: the bulk collapse controls reach cards, and go quiet where nothing is collapsible"
```

---

### Task 6: Context cards, the register's cross-links, and the coverage floor

**Files:**
- Modify: `test/view/contextCardWrites.test.ts`
- Modify: `docs/requirements/What a card shows.md`
- Modify: `docs/requirements/Hierarchy on the board.md`
- Modify: `docs/requirements/Hierarchy on the roadmap.md`
- Create: `docs/issues/Smoke test the card children in a live vault.md`
- Modify: `vitest.config.mts`

- [ ] **Step 1: Add the context-card cases**

In `test/view/contextCardWrites.test.ts`, inside the existing
`describe('write safety with context rows, across the board’s entry points')` block, add
the case below. It reuses `boardStressView()`, already defined at the top of that block:
focused on `PBI`, it renders `Mid` as an inert context card, and the `Task` beneath `Mid`
is a result — so the context card draws a disclosure with something real in it.

```ts
	// The disclosure is a READ affordance, which is the whole reason a context card may
	// have one: the feature has no drag source, no drop target and no writing menu
	// entry, so the context-row rule holds by there being no write rather than by a
	// check. Driven anyway — a future edit that gives the list a write is caught here,
	// in the suite that exists for exactly that.
	it('gives a context card a disclosure that lists, opens and writes nothing', () => {
		const { containerEl, vault } = boardStressView();
		const card = cardByTitle(containerEl, 'Mid');
		const toggle = card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
		expect(toggle).not.toBeNull();

		toggle?.click();

		expect(
			Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent),
		).toEqual(['Task']);

		card.querySelectorAll<HTMLElement>('.pbl-card-kid')[0].click();

		// It opened the child, and the whole interaction wrote nothing.
		expect(vault.opened.map((o) => o.path)).toEqual(['Task.md']);
		expect(vault.writeLog).toEqual([]);
	});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/view/contextCardWrites.test.ts`
Expected: PASS.

- [ ] **Step 3: Cross-link the register**

In `docs/requirements/What a card shows.md`, extend extension 4b so the rollup answer
points at the new one. Keep the existing sentence — it is still true — and add:

```markdown
- **4b — the item has children the board is not showing.** Its card carries its rollup, so
  descendants surface as progress rather than disappearing — the answer the tree already
  gives a collapsed parent. A rollup is a number, though, and
  [[Children on the card]] is what says *which* of them: one level, on the card,
  expandable.
```

In `docs/requirements/Hierarchy on the board.md` and
`docs/requirements/Hierarchy on the roadmap.md`, add a sentence to each naming
`[[Children on the card]]` as the shared implementation both features draw on. Write it
as a real wikilink in those two notes (no backticks — it is in code style *here* only
because this plan predates the note it names, and `docs-check.mjs` resolves links inside
code spans as prose). Keep each link on one line: a wrapped wikilink fails the checker.

- [ ] **Step 4: Register the live-vault check**

Create `docs/issues/Smoke test the card children in a live vault.md`, following the shape
of the existing `Smoke test the …` notes in that folder (read
`docs/issues/Smoke test the board in a live vault.md` first and match its frontmatter and
sections). What it has to name: how the disclosure looks in a real pane in light and dark,
whether an expanded card inside a column scrolls sensibly, and whether a long child title
truncates rather than widening the card.

- [ ] **Step 5: Raise the coverage floor**

Run: `npm run test -- --coverage` (or `npm run check`, which prints the same table) and
read the new totals.

Raise the thresholds in `vitest.config.mts` to the numbers the suite now reaches. They
only ever go up — if a number went *down*, a branch added in Tasks 1–5 is untested, and
the fix is a test, not a lower floor.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: all five pass.

- [ ] **Step 7: Commit and push**

```bash
git add test/view/contextCardWrites.test.ts docs/ vitest.config.mts
git commit -m "test: context cards, the register's cross-links and the raised coverage floor"
git push -u origin claude/card-children-expansion-6yifb4
```

---

## Handover

`npm run check` cannot answer what this looks like. Run `npm run test-build`, open the
repository as a vault, open `docs/Product Backlog.base`, switch to the board and expand a
card — the register is a backlog in this plugin's own schema, so the plugin will be
displaying its own epics and features. `npm run harness` (`?view=board`) is the faster
look when a vault is not at hand, and is faithful about markup, layout and the real
stylesheet but **not** about colour.
