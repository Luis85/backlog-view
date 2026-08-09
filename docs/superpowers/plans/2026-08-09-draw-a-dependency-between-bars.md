# Draw a dependency between bars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A connector on each drawn bar of the dated roadmap that can be dragged onto
another bar to state "that item waits for this one", calling the dependency write the
context menu already owns rather than planning a second one.

**Architecture:** Legality is the existing `candidates()` asked from the other end and
swept once at drag start. The gesture is a new `interactions/linkDrag.ts` over the shared
`CardDragController`, which learns a payload *kind* so that every drop target that means
"move this" refuses a link drag by default. The write is `applyDependencyWrite`, exported
and called, never re-planned.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.10.2+), Pragmatic
drag-and-drop (`@atlaskit/pragmatic-drag-and-drop`), Vitest + jsdom, esbuild.

**Spec:** `docs/superpowers/specs/2026-08-09-draw-a-dependency-between-bars-design.md`
**Requirement:** `docs/requirements/Draw a dependency between bars.md`

## Global Constraints

- **Layers.** `main → commands → view → storage → domain`, each reaching only downward;
  `eslint.config.mjs` fails the build on a violation. `ui/` is a leaf that knows none of
  them.
- **`npm run check` is the whole gate** — build, lint, coverage-thresholded tests, fallow,
  docs register. All five pass before every commit. Coverage thresholds
  (`vitest.config.mts`) only ever go up.
- **400-line max per `src/` file**, 450 for `test/`, `max-lines-per-function` 100,
  `complexity` 16, `max-params` 5 — all `skipBlankLines: true, skipComments: true`.
- **400-line max per `styles/` partial**, and every partial must be imported by
  `styles/index.css` or `npm run build` fails. Never edit the generated root `styles.css`.
- **Never write frontmatter outside `src/storage/frontmatter.ts`.** Every write path goes
  through the `configProblems` gate. `processFrontMatter`, `vault.create` and
  `load/saveLocalStorage` are banned by `no-restricted-syntax` outside `storage/`.
- **The view never writes to a note the Base excluded** (`outsideFilter`).
  `applySafely` refuses the whole batch if any write targets one.
- **An SVG node's `cls` is an ARRAY, never a space-separated string** — a lint rule
  (`SVG_CLASS_TOKENS` in `eslint.config.mjs`). `createSvg('path', { cls: ['a', 'b'] })`.
- **`setCssProps` over inline styles**; sentence-case UI text; no global `app`;
  `normalizePath` on user paths.
- **Every module in `src/` must be *specified*** by a use case's `## Where it lives` or an
  ADR's `## Decision`, or `docs-check.mjs` fails. `test/` is exempt.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing** — revert the fix, run it, see red, restore.
- **Address code by name, not by line number**, in comments and register notes alike.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/view/interactions/dependencies.ts` (modify) | Adds `declaredMap`, an optional `declared` parameter on `candidates`, and exports `legalTargetPaths` and `applyDependencyWrite` |
| `src/view/interactions/cardDrag.ts` (modify) | Payload *kind*; link source / link target / link pointer registrations; the default refusal of a link payload by every move target |
| `src/view/interactions/linkDrag.ts` (create) | The gesture: what a bar's two roles are, the marking held during a drag, the preview line, and the call into the write |
| `src/view/render/timeline.ts` (modify) | Draws the connector; adds `pbl-bar-clipped-end` |
| `styles/timeline.css` (modify) | The connector, its reveal, its `(hover: none)` pair, three placements, the drag marking, the preview line |
| `styles/timelineFurniture.css` (modify) | The bar label's left gap, and `.pbl-linking` joining the label-hiding rule |
| `test/helpers/fixtures.ts` (modify) | Demo-fixture additions and the named edge-case variant |
| `test/harness/page.ts` (modify) | `?fixture=` selects a variant |
| `test/harness/mount.ts` (modify) | `mountHarness` takes which fixture to mount |
| `test/view/linkDrag.test.ts` (create) | The sweep, the connector, the gesture, the refusals, the cost check |
| `test/view/contextCardWrites.test.ts` (modify) | A fourth block: the connector drag over the context-row rule |
| `test/view/rendering.test.ts` (modify) | `.pbl-bar-connector` joins the hover-reveal cascade check |
| `test/harness/harness.test.ts` (modify) | Each fixture renders the cases it exists for |
| `test/CLAUDE.md` (modify) | The fixture rule and the scope of its check |
| `docs/requirements/Draw a dependency between bars.md` (modify) | `## Where it lives`, the two corrections, status |
| `docs/issues/A dependency write is announced to nobody.md` (create) | The registered gap |

**This table said `styles/timeline.css` (modify) otherwise until the work was done.**
`timeline.css` was already at its 400-line cap, so nothing in this feature landed there —
every rule below, including the connector's own, is in `styles/timelineFurniture.css`
instead. Every later step in this plan that names `styles/timeline.css` as where a rule
was to be added is the same divergence stated again rather than a second one; the file
that actually carries the connector, the reveal, the drag marking and the preview line is
`timelineFurniture.css` throughout.

---

### Task 1: The legal-target sweep, and the write made callable

**Files:**
- Modify: `src/view/interactions/dependencies.ts`
- Test: `test/view/linkDrag.test.ts` (create)

**Interfaces:**
- Consumes: `dependentsClosure(path: string, prerequisites: Map<string, string[]>): Set<string>` from `src/domain/dependencies.ts` (already exported).
- Produces:
  - `legalTargetPaths(app: App, model: BacklogModel, source: BacklogItem): Set<string>`
  - `applyDependencyWrite(host: BacklogViewHost, item: BacklogItem, dependsOn: DependsOnDelta): void` (was private)

**Background for the implementer.** `candidates(app, model, item)` answers *what may this
item be made to wait for*, excluding four things: the item itself, whatever it already
declares (however spelled, resolved or not), anything that would close a loop, and every
`outsideFilter` row. A drag runs the other way — dropping source S onto target T writes to
**T** — so the legal targets are exactly `{ T : S ∈ candidates(T) }`. Do not restate the
four exclusions; ask `candidates`. Items are matched by `.file` identity, never by path: a
note deleted and recreated at the same path is a different note wearing the same address.

**This note said the legal set was exactly `{ T : S ∈ candidates(T) }` until the work was
done.** `candidates`' fourth exclusion filters `outsideFilter` on the *candidate* side —
what may be offered — not on the target itself, so that formula would let a context row be
reported as a legal drop target. `legalTargetPaths` needs its own `!target.outsideFilter`
guard on the target side, asked directly rather than inherited from `candidates`: see
`src/view/interactions/dependencies.ts`'s own comment on `legalTargetPaths` for why the two
sides of the same exclusion cannot share one check.

- [ ] **Step 1: Write the failing test**

Create `test/view/linkDrag.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { legalTargetPaths } from '../../src/view/interactions/dependencies';
import { BacklogItem, BacklogModel } from '../../src/domain/model';

useViewHarness();

const DEPS = { dependsOnProperty: 'note.dependsOn' };

/** B waits for A, C waits for B, D waits for nothing — a two-deep chain plus a loner. */
function chainVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' } });
	vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40 } });
	return vault;
}

function itemFor(model: BacklogModel, path: string): BacklogItem {
	const item = model.byPath.get(path);
	if (!item) throw new Error(`no item: ${path}`);
	return item;
}

describe('which bars a link may be dropped onto', () => {
	function sweep(vault: FakeVault, from: string, only?: string[]) {
		const { view } = makeView(vault, DEPS, only ? { only } : {});
		const model = view.model;
		if (!model) throw new Error('no model');
		return { paths: [...legalTargetPaths(view.app, model, itemFor(model, from))].sort(), model, view };
	}

	it('refuses the source itself and anything already waiting for it', () => {
		// A is already B's prerequisite, so dropping A on B would write the line that is
		// on disk. A on A is the loop of length one.
		expect(sweep(chainVault(), 'A.md').paths).toEqual(['C.md', 'D.md']);
	});

	it('refuses a target the source waits on THROUGH a chain, not only directly', () => {
		// C waits for B waits for A. Dropping C onto A would make A wait for C and close
		// a three-node loop — a one-hop check would miss it and offer A.
		expect(sweep(chainVault(), 'C.md').paths).toEqual(['D.md']);
	});

	it('refuses a row the Base excluded, which is never a write target', () => {
		const vault = chainVault();
		// D is a context row here: present in the vault, absent from the results.
		const { paths } = sweep(vault, 'A.md', ['A.md', 'B.md', 'C.md']);
		expect(paths).toEqual(['C.md']);
	});

	it('refuses a target whose existing entry never resolved into a real edge', () => {
		// B names A twice, once bare and once bracketed. Both spellings are B's own
		// declaration, so A must not be offered for B however the line reads.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: ['A', '[[A]]'] } });
		expect(sweep(vault, 'A.md').paths).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/linkDrag.test.ts
```

Expected: FAIL — `legalTargetPaths` is not exported by
`src/view/interactions/dependencies.ts`.

- [ ] **Step 3: Hoist the declared map and add the sweep**

In `src/view/interactions/dependencies.ts`, replace the body of `candidates` and add the
two functions. Keep every existing comment on `candidates` — only its signature and its
first statement change.

```ts
/**
 * Every item's own declared prerequisite paths, in one pass.
 *
 * Hoisted out of `candidates` so a sweep that asks the question of every row builds this
 * once rather than once per row. `candidates` still defaults to building its own, so the
 * two menu callers are unchanged and cannot fall out of step with the sweep — there is
 * one definition of "what this note declares", not a fast one and a careful one.
 */
function declaredMap(app: App, model: BacklogModel): Map<string, string[]> {
	return new Map([...model.byPath].map(([path, item]) => [path, declaredPrerequisitePaths(app, model, item)]));
}

function candidates(
	app: App,
	model: BacklogModel,
	item: BacklogItem,
	declared: Map<string, string[]> = declaredMap(app, model),
): BacklogItem[] {
	// Asked once for the whole menu rather than once per row: naming any item that
	// already waits on this one — at any depth, including through a broken cyclic edge —
	// is what would close a loop.
	const closesLoop = dependentsClosure(item.file.path, declared);
	const already = new Set(declared.get(item.file.path) ?? []);
	return [...model.byPath.values()].filter(
		(candidate) =>
			!candidate.outsideFilter && !closesLoop.has(candidate.file.path) && !already.has(candidate.file.path),
	);
}

/**
 * Every note a link drag from `source` may be dropped ONTO.
 *
 * Dragging S onto T writes to T — T is the one that waits — so T is legal exactly when S
 * is a legal prerequisite FOR T. That is `candidates` asked from the other end, and it is
 * asked rather than restated: the four exclusions (self, already declared however spelled,
 * would close a loop, outside the filter) have one definition, and a second formulation
 * beside it is what drifts. Stating it as "something it already waits for" is the MENU's
 * sentence, where the item under the cursor is the dependent; here the dependent is the
 * one dropped onto, and the same words name the wrong end.
 *
 * One `declaredMap` for the whole sweep, so a target costs one closure walk rather than a
 * rebuild plus a walk. Swept ONCE when a drag starts — never per frame; the check that
 * says so is in `test/view/linkDrag.test.ts`.
 *
 * Matched on `.file`, not on the path, for the reason `applyDependencyWrite` states: a
 * note deleted and another created at the same path satisfies a path compare while being
 * a different note.
 */
export function legalTargetPaths(app: App, model: BacklogModel, source: BacklogItem): Set<string> {
	const declared = declaredMap(app, model);
	const legal = new Set<string>();
	for (const target of model.byPath.values()) {
		if (candidates(app, model, target, declared).some((c) => c.file === source.file)) legal.add(target.file.path);
	}
	return legal;
}
```

- [ ] **Step 4: Export the write**

Change `function applyDependencyWrite(` to `export function applyDependencyWrite(` and
replace the first paragraph of its doc comment — which currently says it is *not*
exported — with:

```ts
/**
 * The one place a dependency write is planned and applied.
 *
 * Exported for `interactions/linkDrag.ts`, which CALLS it rather than planning beside it:
 * one move, two inputs, one place the batch is made. Adding a third input means calling
 * this, never writing a second plan next to it.
 *
```

Leave the rest of that comment (the `host.model` recheck, the file-identity rule) exactly
as it is.

- [ ] **Step 5: Run the new test and the existing menu suite**

```bash
npx vitest run test/view/linkDrag.test.ts test/view/dependencyMenu.test.ts
```

Expected: PASS, both files. `dependencyMenu.test.ts` passing unchanged is the evidence
that the hoist changed no behaviour.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add src/view/interactions/dependencies.ts test/view/linkDrag.test.ts
git commit -m "Ask legality from the end the drop writes to"
```

---

### Task 2: The connector, drawn

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderBarRow`, `barClasses`)
- Modify: `styles/timeline.css`
- Modify: `styles/timelineFurniture.css`
- Test: `test/view/linkDrag.test.ts`, `test/view/rendering.test.ts`

**Interfaces:**
- Consumes: `BarRowMounts` (fields `content`, `scroller`, `dnd`, `tracks`,
  `conflictedPrereqs`, `palettes`), `RowContext` (carries `host`), `BarGeometry` (fields
  include `outside`, `clippedStart`, `clippedEnd`, `milestone`, `startDay`, `spanDays`).
- Produces: a `button.pbl-bar-connector` child of `.pbl-bar`, and the class
  `pbl-bar-clipped-end` on a bar whose end is clamped by the window. Task 3 wires the
  button; nothing else reads it.

**Background for the implementer.** `barHolds` decides which *date* grips a bar offers and
withholds them wherever no end is the note's own. The connector is **not** subject to
that: it writes a link and claims no date, so an inferred bar — which has no grips at all
— still gets one. The only refusals are: the dependency key unconfigured, and the bar not
actually drawn. An `outsideFilter` row never reaches `renderBarRow` at all, because
`deriveBars` routes it to context before any span is computed — so it needs no guard here.

`barClasses` currently folds `geometry.clippedEnd` into `pbl-bar-open-end` together with
`span.target === null`. Those two want different connector placement, so a separate class
is added; no existing rule changes.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/linkDrag.test.ts`:

```ts
import { barFor, gripNames, rowFor } from '../helpers/roadmap';

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

function datedLinkView(vault: FakeVault, values: Record<string, unknown> = { ...DATE_AXIS, ...DEPS }) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('dates');
	return harness;
}

function barVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' } });
	vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-20', due: '2026-08-28' } });
	return vault;
}

function connectorFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	return barFor(containerEl, title).querySelector<HTMLElement>('.pbl-bar-connector');
}

describe('the connector on a drawn bar', () => {
	it('is drawn on a result bar when the dependency key is bound', () => {
		const { containerEl } = datedLinkView(barVault());
		expect(connectorFor(containerEl, 'Alpha')).not.toBeNull();
	});

	it('is absent when the dependency key is unbound — a feature this view does not have', () => {
		const { containerEl } = datedLinkView(barVault(), DATE_AXIS);
		expect(connectorFor(containerEl, 'Alpha')).toBeNull();
	});

	it('is offered on an INFERRED bar, which has no date grip at all', () => {
		// A parent stating no dates of its own, drawn from its child's. `barHolds`
		// withholds every grip because there is no baseline to move from; a link claims
		// no date, so it needs none.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
			parentLink: 'Parent',
		});
		const { containerEl } = datedLinkView(vault);
		expect(gripNames(containerEl, 'Parent')).toEqual([]);
		expect(connectorFor(containerEl, 'Parent')).not.toBeNull();
	});

	it('marks a bar whose end the window clamps, so its connector can sit inside the grid', () => {
		// Far enough out that the window exceeds MAX_TIMELINE_DAYS and clamps around
		// today, leaving this bar's end off the drawn grid.
		const vault = barVault();
		vault.addFile('Far.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-08-04', due: '2036-08-04' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Far');
		expect(bar.classList.contains('pbl-bar-clipped-end')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('is absent where no bar is drawn at all', () => {
		// Wholly outside the window: `barClasses` returns early with pbl-bar-outside and
		// there is no on-screen end for a handle to sit past.
		const vault = barVault();
		vault.addFile('Ancient.md', { frontmatter: { type: 'PBI', order: 30, start: '1990-01-01', due: '1990-02-01' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Ancient');
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).toBeNull();
	});
});
```

In `test/view/rendering.test.ts`, add `'.pbl-bar-connector'` to the selector array in the
test named `reveals every hover-hidden control on a hoverless device, in cascade order`:

```ts
		for (const selector of ['.pbl-add', '.pbl-bucket-add', '.pbl-tag-remove', '.pbl-tag-add', '.pbl-bar-connector']) {
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run test/view/linkDrag.test.ts test/view/rendering.test.ts
```

Expected: FAIL — no `.pbl-bar-connector` element, no `pbl-bar-clipped-end` class, and the
cascade test cannot find the connector's `opacity: 0` rule.

- [ ] **Step 3: Draw the connector**

In `src/view/render/timeline.ts`, add this function beside `renderBarLabel`:

```ts
/**
 * The dependency connector — a HANDLE, not a grip, and the distinction decides both of
 * its rules. `barHolds` withholds a grip wherever no end is the note's own, because a
 * grip writes a DATE and needs a baseline to move from; this writes a link and claims no
 * date, so an inferred bar offers one and a bar clipped by the window offers one at the
 * clamped edge. A handle can sit at a boundary without asserting anything is there,
 * which is what a diamond cannot do.
 *
 * Two refusals, and only two. The key unconfigured is a feature this view does not have
 * ([[Draw a dependency between bars]] 1c), and a bar wholly outside the window has no
 * on-screen end (`geometry.outside`). An `outsideFilter` row needs no guard: `deriveBars`
 * routes it to context before any span is computed, so it never has a bar to hang one on
 * — the same reason [[Arrows between bars]] 1c needs none.
 *
 * `tabindex="-1"` like every other per-row control: the pane is one tab stop and the
 * arrows move the selection. The context menu's Depends on… is the keyboard path, which
 * is what SC 2.5.7 requires of a gesture and is why it shipped first.
 */
function renderConnector(ctx: RowContext, el: HTMLElement, bar: TimelineBar, geometry: BarGeometry): void {
	if (ctx.host.settings.dependsOnKey === '' || geometry.outside) return;
	el.createEl('button', {
		cls: 'pbl-bar-connector',
		attr: { 'aria-label': `Draw a dependency from ${bar.item.title}`, tabindex: '-1' },
	});
}
```

Task 3 rewrites this function to wire what it draws; drawing first is what lets its
placement be looked at before any gesture exists. Do **not** take `mounts` here and mark
it unused — `no-unused-vars` and `no-void` both have opinions, and an unused parameter
added in anticipation of the next task is the kind of scaffolding this codebase's lint
budget exists to refuse.

Call it in `renderBarRow`, immediately after the `for (const hold of holds)` loop and
before `renderBarLabel(...)`:

```ts
	renderConnector(ctx, el, bar, geometry);
```

In `barClasses`, add one line after the existing `pbl-bar-open-end` line:

```ts
	if (bar.span.target === null || geometry.clippedEnd) cls += ' pbl-bar-open-end';
	// Distinct from open-end, which also covers a bar with no target date at all. The two
	// want different connector placement: an open end has an on-screen edge to sit past,
	// a clamped one does not.
	if (geometry.clippedEnd) cls += ' pbl-bar-clipped-end';
```

- [ ] **Step 4: Add the stylesheet rules**

In `styles/timeline.css`, immediately after the `.pbl-bar-grip-start` /
`.pbl-bar-grip-end` pair:

```css
/* The dependency connector — `renderConnector` in `src/view/render/timeline.ts`. A child
   of the positioned `.pbl-bar`, so `left`/`right` resolve against the bar's own edges.
   It sits OUTSIDE the end rather than on it, which is what keeps `.pbl-bar-grip-end` at
   right: -3px reachable on a bar one day wide — the two would otherwise trade places at
   the zoom where a bar is narrower than its own handles. */
.pbl-bar-connector {
	position: absolute;
	top: 50%;
	left: 100%;
	transform: translate(4px, -50%);
	width: 9px;
	height: 9px;
	padding: 0;
	border: 1.5px solid var(--pbl-bar-color);
	border-radius: 50%;
	background-color: var(--background-primary);
	box-shadow: none;
	cursor: crosshair;
	opacity: 0;
}

/* Revealed by the ROW, not by the bar: a bar six pixels wide is a poor hover target for
   the control that reveals its own handle. */
.pbl-timeline-row:hover .pbl-bar-connector,
.pbl-bar-connector:focus-visible,
.pbl-bar-connector.is-active {
	opacity: 1;
}

/* Immediately after the `opacity: 0` it undoes, and deliberately NOT in
   `styles/touch.css`: a media query adds no specificity, so any later rule for the same
   selector would get between the pair and this would silently reveal nothing. `.pbl-add`
   and `.pbl-bucket-add` each carry exactly this block for exactly this reason, and a
   hover-revealed control that lacked one shipped unreachable on touch once. Permanent is
   the cheap direction here: what a hoverless device loses is the discretion, not the
   gesture. */
@media (hover: none) {
	.pbl-bar-connector {
		opacity: 1;
	}
}

.pbl-bar-connector.is-active {
	background-color: var(--pbl-bar-color);
}

/* A clamped end has no on-screen end to sit beyond. Past it lands outside the scrollable
   grid, unreachable at exactly the zoom that produced the clipping — so the handle comes
   inside. The same answer the arrow layer gives an anchor at a clipped edge. */
.pbl-bar-clipped-end .pbl-bar-connector {
	left: auto;
	right: 0;
	transform: translate(-2px, -50%);
}

/* A milestone's rule carries `translateX(-50%)`, so the diamond occupies
   [left - 6, left + 6] and `left: 100%` would miss it by half its own width. */
.pbl-bar-milestone .pbl-bar-connector {
	left: 100%;
	transform: translate(9px, -50%);
}
```

In `styles/timelineFurniture.css`, change `.pbl-bar-label-after`:

```css
/* The left gap clears the connector, which sits in exactly the space `.pbl-bar-label`'s
   own `padding: 0 var(--size-4-2)` used to be the whole of. Seen in the browser harness
   before it shipped: the dot landed on the first letter of the title. */
.pbl-bar-label-after {
	left: var(--pbl-label-left);
	padding-left: 18px;
}
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run test/view/linkDrag.test.ts test/view/rendering.test.ts test/view/timelineFurniture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Look at it**

```bash
npm run harness
```

Open the printed `file://` URL with `?view=roadmap`, expand the tree with the toolbar
control, and hover a bar. The dot should sit clear of the label and of the end grip.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add src/view/render/timeline.ts styles/timeline.css styles/timelineFurniture.css test/view/linkDrag.test.ts test/view/rendering.test.ts
git commit -m "Give a bar a handle that claims no date"
```

---

### Task 3: The gesture, and the refusal that makes it safe

**Files:**
- Modify: `src/view/interactions/cardDrag.ts`
- Create: `src/view/interactions/linkDrag.ts`
- Modify: `src/view/render/timeline.ts` (`renderConnector` wires what it drew)
- Modify: `styles/timeline.css`, `styles/timelineFurniture.css`
- Test: `test/view/linkDrag.test.ts`

**Interfaces:**
- Consumes: `legalTargetPaths`, `applyDependencyWrite` (Task 1); `.pbl-bar-connector`
  (Task 2); `CardSource` (fields `item`, `hold`, `scrollLeft`, `span`, `ends`).
- Produces on `CardDragController`:
  - `wireLinkSource(el: HTMLElement, item: BacklogItem, hooks: { onStart: () => void; onEnd: () => void }): void`
  - `wireLinkTarget(el: HTMLElement, plan: (source: CardSource) => void, hooks?: DropHooks): void`
  - `wireLinkPointer(handlers: { onDrag: (clientX: number, clientY: number) => void; onEnd: () => void }): void`

  *This note said `wireLinkTarget` otherwise until the work was done*: it was never kept
  as its own method. It collapsed into the existing `wireDropTarget(el, plan, hooks = {},
  kind: DragKind = 'move')`, called with `kind: 'link'` — fallow flagged the two methods as
  a clone, and the duplication was the tell that the link/move split belonged on the one
  shared method's signature rather than as a second entry point identical but for which
  literal it passed `mine`. See that method's own comment in `cardDrag.ts` for why one
  defaulted parameter is what makes the refusal structural rather than a convention.
- Produces in `linkDrag.ts`:
  - `wireBarLink(ctx: RowContext, parts: BarLinkParts): void` where
    `interface BarLinkParts { dnd: CardDragController; content: HTMLElement; row: HTMLElement; barEl: HTMLElement; connector: HTMLElement | null; item: BacklogItem }`

**Background for the implementer — read this before writing anything.** Every existing
drop target gates on `source.data.view === this.token` and nothing else. A connector drag
would therefore be accepted by two targets that mean something entirely different:

- the timeline grid's positional target (`wirePositionalTarget` in `timelineDrag.ts`),
  whose `onDrop` calls `planFor`, takes the `source.hold === null` arm, and **writes a
  date**;
- the dated shelf, whose drop **unschedules**.

Both break the guarantee that no drop of this gesture changes a date. Do not fix this by
adding a guard to those two call sites — the next target somebody writes would reopen it
by omission. Put the check on the shared layer, where a target inherits it by default.

**Auto-scroll needs nothing** (extension 2b). `wireTimelineDrag` already registers the
timeline's own scroller with `autoScrollForElements`, which engages for any element-adapter
drag over it — a link drag included. Do not add a second registration; a target reachable
only by scrolling is reachable, and where a pointer still cannot get there, the menu path
always can, which is why it shipped first.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/linkDrag.test.ts`:

```ts
import { cardDrag, gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { flush } from '../helpers/view';
import { shelfOf } from '../helpers/roadmap';

/** The whole gesture: pick the connector up, cross a bar, release on it. */
function linkDrag(connector: HTMLElement, targetBar: HTMLElement): void {
	cardDrag(connector, targetBar);
}

describe('drawing a dependency from one bar to another', () => {
	it('writes to the bar dropped ONTO, which is the one that waits', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['dependsOn']).toEqual(['[[Alpha]]']);
		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('changes no date, on either note', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['start']).toBe('2026-08-20');
		expect(vault.fm('Beta.md')['due']).toBe('2026-08-28');
		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('writes nothing when released on an illegal target', async () => {
		// Beta already waits for Alpha, so Alpha onto Beta would write the line on disk.
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const before = JSON.stringify(vault.fm('Beta.md'));
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(JSON.stringify(vault.fm('Beta.md'))).toBe(before);
	});

	it('writes nothing when released on its own bar', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Alpha'));
		await flush();

		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('marks the illegal targets while the drag is held, and clears them when it ends', () => {
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);

		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(true);
		expect(rowFor(containerEl, 'Alpha')?.classList.contains('pbl-link-source')).toBe(true);

		gesture.cancel();
		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(false);
	});

	it('sweeps legality ONCE per drag, not once per frame', () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const model = view.model;
		if (!model) throw new Error('no model');
		// The sweep walks `byPath` once for itself and once per target inside
		// `candidates`; what matters is that crossing more bars adds none of that.
		const spy = vi.spyOn(model.byPath, 'values');
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		const afterStart = spy.mock.calls.length;
		expect(afterStart).toBeGreaterThan(0);

		gesture.over(barFor(containerEl, 'Beta'), { clientX: 40 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 60 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 80 });

		expect(spy.mock.calls.length).toBe(afterStart);
		gesture.cancel();
	});
});

describe('a link drag is refused by every target that means a move', () => {
	it('writes no date when released on the timeline grid', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		const at = pannedGrid(containerEl, { rectLeft: 320, scrollLeft: 90 });
		gridDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, overlayOf(containerEl), { clientX: at(400) });
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('does not unschedule when released on the dated shelf', async () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		view.setShelfCollapsed(false);
		const shelf = shelfOf(containerEl);
		if (!shelf) throw new Error('no shelf');
		cardDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, shelf);
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});
});
```

Add `vi` to the vitest import at the top of the file:
`import { describe, expect, it, vi } from 'vitest';`

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run test/view/linkDrag.test.ts
```

Expected: FAIL. Note especially which two fail *loudly*: `writes no date when released on
the timeline grid` and `does not unschedule when released on the dated shelf` — those are
the hole this task exists to close, and seeing them red is the point.

- [ ] **Step 3: Teach the controller what kind of gesture a payload is**

In `src/view/interactions/cardDrag.ts`, add near `DROP_OVER`:

```ts
/**
 * What a payload IS, so a target can refuse a gesture that means something else.
 *
 * There are two kinds and they are not interchangeable: a card MOVE asks a region to
 * write a placement, a LINK drag asks a bar to record an ordering. Every target that
 * means "move this" must refuse a link, and the check is here rather than at each of
 * them — the timeline grid would otherwise take a link drop and write a DATE, and the
 * dated shelf would unschedule. A guard per call site holds only for the call sites
 * somebody thought of; this one holds for targets not yet written.
 */
const LINK_KIND = 'link';
type DragKind = 'move' | 'link';

function kindOf(data: Record<string, unknown>): DragKind {
	return data.kind === LINK_KIND ? 'link' : 'move';
}
```

Add the private gate as a method on `CardDragController`:

```ts
	/** This view's drag, and this KIND of it. Every `canDrop` here goes through it. */
	private mine(data: Record<string, unknown>, kind: DragKind): boolean {
		return data.view === this.token && kindOf(data) === kind;
	}
```

Change the two existing `canDrop` bodies to use it. In `wireDropTarget`:

```ts
					canDrop: ({ source }) => {
						if (!this.mine(source.data, 'move')) return false;
						const resolved = this.resolve(source.data);
						return resolved !== null && (!hooks.accepts || hooks.accepts(resolved));
					},
```

In `wirePositionalTarget`:

```ts
					canDrop: ({ source }) => this.mine(source.data, 'move'),
```

- [ ] **Step 4: Add the three link registrations**

Still in `cardDrag.ts`, after `wirePositionalTarget`. Add
`monitorForElements` to the existing import from
`@atlaskit/pragmatic-drag-and-drop/element/adapter`.

```ts
	/**
	 * A bar's connector as a drag source. Carries no hold, no span and no ends: a link
	 * claims no date, so there is nothing for a relative gesture to measure against.
	 *
	 * `onStart` is where the legal-target sweep happens — once, at drag start — and
	 * `onEnd` fires however the drag ends, dropped or cancelled, so the marking it put on
	 * the grid can never outlive the gesture.
	 */
	wireLinkSource(el: HTMLElement, item: BacklogItem, hooks: { onStart: () => void; onEnd: () => void }): void {
		if (item.outsideFilter) return;
		this.cleanups.push(
			draggable({
				element: el,
				getInitialData: () => ({ path: item.file.path, kind: LINK_KIND, view: this.token }),
				onDragStart: () => {
					el.addClass('is-active');
					hooks.onStart();
				},
				onDrop: () => {
					el.removeClass('is-active');
					hooks.onEnd();
				},
			}),
		);
	}

	/**
	 * A bar as the target of a link. `accepts` refuses rather than ignores, so an illegal
	 * bar never highlights for a drop it would not take — the same contract every region
	 * target keeps, and what makes "refused before release" true rather than a promise.
	 */
	wireLinkTarget(el: HTMLElement, plan: (source: CardSource) => void, hooks: DropHooks = {}): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				canDrop: ({ source }) => {
					if (!this.mine(source.data, 'link')) return false;
					const resolved = this.resolve(source.data);
					return resolved !== null && (!hooks.accepts || hooks.accepts(resolved));
				},
				onDragEnter: ({ source }) => {
					el.addClass(DROP_OVER);
					const resolved = this.resolve(source.data);
					if (resolved) hooks.onEnter?.(resolved);
				},
				onDragLeave: () => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
				},
				onDrop: ({ source }) => {
					el.removeClass(DROP_OVER);
					hooks.onLeave?.();
					const resolved = this.resolve(source.data);
					if (resolved) plan(resolved);
				},
			}),
		);
	}

	/**
	 * Where the pointer IS during a link drag, wherever it is — the gap between two bars
	 * included, which is most of the grid and exactly where a preview line has to keep
	 * drawing. A monitor rather than a target: there is no region here whose meaning is
	 * being asked about, only a coordinate. Gated on the same private token, so a drag in
	 * a split pane over the same notes never draws a line in this one.
	 */
	wireLinkPointer(handlers: { onDrag: (clientX: number, clientY: number) => void; onEnd: () => void }): void {
		this.cleanups.push(
			monitorForElements({
				canMonitor: ({ source }) => this.mine(source.data, 'link'),
				onDrag: ({ location }) => handlers.onDrag(location.current.input.clientX, location.current.input.clientY),
				onDrop: () => handlers.onEnd(),
			}),
		);
	}
```

- [ ] **Step 5: Create the gesture module**

Create `src/view/interactions/linkDrag.ts`:

```ts
import { CardDragController, CardSource } from './cardDrag';
import { applyDependencyWrite, legalTargetPaths } from './dependencies';
import { RowContext } from '../render/columns';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';

/**
 * The Gantt gesture: drag from a bar's connector onto another bar to say *that item
 * waits for this one*.
 *
 * It plans NOTHING. The drop calls `applyDependencyWrite`, which is what the context
 * menu's Depends on… calls, so the batch, its refusals, its announcement and its undo
 * are identical either way — one move, two inputs, one place the batch is made. Adding a
 * third input means calling that same function, never writing a plan beside it.
 *
 * Legality is likewise not decided here: `legalTargetPaths` asks `candidates` from the
 * end the drop writes to. What this module owns is only WHEN that question is asked
 * (once, at drag start) and what the answer LOOKS like while the drag is held.
 */

/** What one bar contributes to the gesture: a place to drag from, and a place to drop on. */
export interface BarLinkParts {
	dnd: CardDragController;
	/** The scrolling content box every mark and the preview line are drawn into. */
	content: HTMLElement;
	row: HTMLElement;
	barEl: HTMLElement;
	/** Absent where `renderConnector` refused to draw one. */
	connector: HTMLElement | null;
	item: BacklogItem;
}

/** The class the content box wears while a link drag is live. */
const LINKING = 'pbl-linking';
const ILLEGAL = 'pbl-link-illegal';
const SOURCE = 'pbl-link-source';

/**
 * The live gesture's own state, held per CONTENT BOX rather than per bar: every bar wires
 * itself, and all of them have to agree about one drag. A render pass rebuilds the grid
 * wholesale and mints a new box, so nothing here can outlive the frame it belongs to.
 */
interface LiveLink {
	legal: Set<string>;
	line: SVGPathElement | null;
	fromX: number;
	fromY: number;
}

const live = new WeakMap<HTMLElement, LiveLink>();

/**
 * Wire one bar's two roles.
 *
 * The source half is skipped where no connector was drawn — the key unbound, or no bar
 * on screen — and the TARGET half is wired regardless, because a bar with no connector of
 * its own is still something another bar's link may legitimately point at.
 */
export function wireBarLink(ctx: RowContext, parts: BarLinkParts): void {
	const host: BacklogViewHost = ctx.host;
	const { dnd, content, row, barEl, connector, item } = parts;
	if (connector) {
		dnd.wireLinkSource(connector, item, {
			onStart: () => begin(host, content, row, item, connector),
			onEnd: () => end(content),
		});
	}
	dnd.wireLinkTarget(barEl, (source) => drop(host, source, item), {
		accepts: (source) => (live.get(content)?.legal.has(item.file.path) ?? false) && source.item.file !== item.file,
	});
}

/**
 * Start of a drag: sweep legality ONCE, mark what the drop would refuse, and open the
 * preview line.
 *
 * Only the illegal targets are marked. Most bars are legal, so marking legal marked four
 * of six rows in the browser harness and read as a multi-select; refusal is the scarce
 * thing, and it is the thing the acceptance criterion asks to be visible before release.
 */
function begin(host: BacklogViewHost, content: HTMLElement, row: HTMLElement, item: BacklogItem, connector: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	const legal = legalTargetPaths(host.app, model, item);
	const box = content.getBoundingClientRect();
	const dot = connector.getBoundingClientRect();
	const state: LiveLink = {
		legal,
		line: null,
		fromX: dot.left + dot.width / 2 - box.left,
		fromY: dot.top + dot.height / 2 - box.top,
	};
	live.set(content, state);
	content.addClass(LINKING);
	row.addClass(SOURCE);
	for (const other of Array.from(content.querySelectorAll<HTMLElement>('.pbl-timeline-row'))) {
		const path = other.dataset.pblPath;
		if (other !== row && path !== undefined && !legal.has(path)) other.addClass(ILLEGAL);
	}
}

/** End of a drag, however it ended. Nothing the gesture drew may outlive it. */
function end(content: HTMLElement): void {
	const state = live.get(content);
	state?.line?.parentElement?.remove();
	live.delete(content);
	content.removeClass(LINKING);
	for (const row of Array.from(content.querySelectorAll<HTMLElement>(`.${ILLEGAL}, .${SOURCE}`))) {
		row.removeClass(ILLEGAL);
		row.removeClass(SOURCE);
	}
}

/**
 * The preview line, redrawn per frame by moving ONE path's `d` — the layer and the path
 * are minted on the first frame and never per frame, since a drag is many frames and a
 * node per frame is a node per frame to remove.
 */
export function wireLinkPreview(dnd: CardDragController, content: HTMLElement): void {
	dnd.wireLinkPointer({
		onDrag: (clientX, clientY) => {
			const state = live.get(content);
			if (!state) return;
			const box = content.getBoundingClientRect();
			const toX = clientX - box.left;
			const toY = clientY - box.top;
			if (!state.line) {
				const layer = content.createSvg('svg', { cls: ['pbl-link-preview'], attr: { 'aria-hidden': 'true' } });
				state.line = layer.createSvg('path', { cls: ['pbl-link-preview-line'] });
			}
			state.line.setAttribute(
				'd',
				`M ${state.fromX} ${state.fromY} C ${state.fromX + 40} ${state.fromY}, ${toX - 40} ${toY}, ${toX} ${toY}`,
			);
		},
		onEnd: () => end(content),
	});
}

/**
 * What a release on a legal bar MEANS. Re-asked of the current model rather than trusted
 * from drag start: the graph can change while a gesture is held, exactly as it can while
 * a suggester is open, and the same silence is refused for the same reason.
 *
 * Matched on `.file`, never on the path — a note deleted and another created at the same
 * path satisfies a path compare while being a different note.
 */
function drop(host: BacklogViewHost, source: CardSource, target: BacklogItem): void {
	const model = host.model;
	const liveTarget = model?.byPath.get(target.file.path);
	if (!model || liveTarget?.file !== target.file) return;
	if (!legalTargetPaths(host.app, model, source.item).has(target.file.path)) return;
	applyDependencyWrite(host, liveTarget, { add: source.item.file });
}
```

- [ ] **Step 6: Wire it from the renderer**

Two changes in `src/view/render/timeline.ts`.

**First**, give every timeline row a path to be marked by. In `renderBarRow`, beside the
class it already adds:

```ts
	row.addClass('pbl-timeline-row');
	// The marking loop reads this rather than matching titles: a title is not unique and
	// is not an identity, and `begin` runs over every row on the grid.
	row.dataset.pblPath = bar.item.file.path;
```

**Second**, rewrite `renderConnector` from Task 2. Its guard now decides only whether the
DOT is drawn, because a bar with no connector of its own is still something another bar's
link may legitimately point at — so the target half is wired either way, and the early
return goes.

```ts
/** Where this row's connector is drawn, and what it is drawn against. Grouped rather
 *  than passed flat: `max-params` is 5 and this would be the sixth. */
interface ConnectorPlace {
	row: HTMLElement;
	barEl: HTMLElement;
	geometry: BarGeometry;
}

function renderConnector(ctx: RowContext, mounts: BarRowMounts, place: ConnectorPlace, bar: TimelineBar): void {
	const { row, barEl, geometry } = place;
	const dot =
		ctx.host.settings.dependsOnKey === '' || geometry.outside
			? null
			: barEl.createEl('button', {
					cls: 'pbl-bar-connector',
					attr: { 'aria-label': `Draw a dependency from ${bar.item.title}`, tabindex: '-1' },
				});
	wireBarLink(ctx, { dnd: mounts.dnd, content: mounts.content, row, barEl, connector: dot, item: bar.item });
}
```

Update the call in `renderBarRow`:

```ts
	renderConnector(ctx, mounts, { row, barEl: el, geometry }, bar);
```

And register the preview once per render pass, in `renderTimeline` beside the
`arrowLayer` creation:

```ts
	wireLinkPreview(dnd, content);
```

Import both at the top of `render/timeline.ts`:

```ts
import { wireBarLink, wireLinkPreview } from '../interactions/linkDrag';
```

- [ ] **Step 7: Add the drag-state stylesheet rules**

In `styles/timeline.css`, after the connector rules from Task 2:

```css
/* Held drag: only refusal is marked. Marking the LEGAL targets marked four of six rows
   in the browser harness and read as a multi-select — most bars are legal, so the
   scarce thing is the one worth a mark. */
.pbl-linking .pbl-link-illegal .pbl-bar {
	opacity: 0.25;
	filter: grayscale(1);
}

/* The bar under the pointer. The board's columns and the roadmap's buckets say this with
   a region highlight; a bar is not a region, so it says it with its own outline. */
.pbl-linking .pbl-bar.pbl-drop-over {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

/* The line follows the pointer, so it is addressed in the content box's own pixels and
   must not be clipped to the element's computed size — the arrow layer's own reason.
   Above the bars, unlike the arrow layer, because it is a live gesture rather than a
   drawn fact. */
.pbl-link-preview {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: visible;
	z-index: 3;
}

.pbl-link-preview-line {
	fill: none;
	stroke: var(--interactive-accent);
	stroke-width: 2;
	stroke-dasharray: 4 3;
}
```

In `styles/timelineFurniture.css`, extend the label-hiding rule. **Do not reuse
`.pbl-dragging`** for the link gesture — it means "a card is being dragged" and carries
consequences a link drag must not fire, including revealing the tree's root strip, which
the harness mock demonstrated. What the two share is only the decluttering:

```css
/* The grid declutters exactly while the user is aiming a drop — a card move and a link
   drag alike. Two classes rather than one, because `.pbl-dragging` also reveals the root
   strip, and a link can reparent nothing. */
.pbl-dragging .pbl-bar-label,
.pbl-linking .pbl-bar-label {
	visibility: hidden;
}
```

- [ ] **Step 8: Run the tests**

```bash
npx vitest run test/view/linkDrag.test.ts test/view/timelineDrag.test.ts test/view/cardDrag.test.ts test/view/roadmapMoves.test.ts test/view/board.test.ts
```

Expected: PASS, every file. The four existing files are the evidence that the `mine()`
gate refuses only link payloads and left every card move alone.

- [ ] **Step 9: Watch the refusal fail without its guard**

Temporarily change `wirePositionalTarget`'s `canDrop` back to
`({ source }) => source.data.view === this.token`, then:

```bash
npx vitest run test/view/linkDrag.test.ts -t "writes no date when released on the timeline grid"
```

Expected: FAIL — the drop writes a date. Restore the guard and confirm it passes. Do the
same for `wireDropTarget` against the shelf test. **This step is not optional**: a comment
claiming an invariant is not a check, and this repository has shipped that mistake.

- [ ] **Step 10: Look at it**

```bash
npm run harness
```

`?view=roadmap` — expand, then drag a connector onto another bar. Confirm: illegal rows
dim, the target under the pointer outlines, the line follows, labels vanish, and the root
strip does **not** appear.

- [ ] **Step 11: Gate and commit**

```bash
npm run check
git add src/view/interactions/cardDrag.ts src/view/interactions/linkDrag.ts src/view/render/timeline.ts styles/timeline.css styles/timelineFurniture.css test/view/linkDrag.test.ts
git commit -m "Draw a dependency, and refuse the gesture everywhere it means something else"
```

---

### Task 4: The context-row rule, asked of the new entry point

**Files:**
- Modify: `test/view/contextCardWrites.test.ts`

**Interfaces:**
- Consumes: `wireBarLink` (Task 3), `.pbl-bar-connector` (Task 2).
- Produces: nothing. This task adds only checks.

**Background for the implementer.** The rule: an `outsideFilter` row is never a write
target, never a ranking peer, and never a source of anything derived from the Base's
results. `contextCardWrites.test.ts` asks three questions of each card projection's entry
points — the drag, the paths a keyboard or menu can reach that a drag cannot, and the
structural refusal behind both. A connector drag is a new entry point, so it gets the same
three. Note that the first is satisfied *twice over* here — a context row never has a bar
at all, and `wireLinkSource` returns early on `outsideFilter` — and the check should say
which of those it is testing.

- [ ] **Step 1: Write the failing tests**

Append a fourth block to `test/view/contextCardWrites.test.ts`:

```ts
describe('write safety with context rows, at the dependency connector', () => {
	/** A dated axis where the excluded parent would draw a bar if it were a result. */
	function linkStressVault() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-30' } });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		vault.addFile('Other.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-20', due: '2026-08-28' } });
		return vault;
	}

	function linkStressView(vault: FakeVault) {
		const harness = makeView(
			vault,
			{ startProperty: 'note.start', targetProperty: 'note.due', dependsOnProperty: 'note.dependsOn' },
			{ collapsed: true, only: ['Kid.md', 'Other.md'] },
		);
		harness.view.setProjection('roadmap');
		harness.view.setAxisPick('dates');
		return harness;
	}

	it('draws no connector on a context row, which has no bar to hang one on', () => {
		const { containerEl } = linkStressView(linkStressVault());
		const context = rowFor(containerEl, 'Epic');
		// `createCard` marks an excluded row `pbl-card-context pbl-outside`.
		expect(context?.classList.contains('pbl-outside')).toBe(true);
		expect(context?.querySelector('.pbl-bar-connector')).toBeNull();
	});

	it('never offers a context row as a legal TARGET, which a drag could otherwise reach', () => {
		// The half a drag cannot demonstrate: the row draws no bar, so nothing could be
		// dropped on it — but `legalTargetPaths` is what the drop re-asks, and it is the
		// answer that has to exclude it.
		const vault = linkStressVault();
		const { view } = linkStressView(vault);
		const model = view.model;
		if (!model) throw new Error('no model');
		const source = model.byPath.get('Kid.md');
		if (!source) throw new Error('no source');
		expect([...legalTargetPaths(view.app, model, source)]).not.toContain('Epic.md');
	});

	it('refuses the whole batch structurally if a write for one ever reaches the gate', async () => {
		// The backstop the two above stand in front of, driven where a gesture cannot
		// reach — the shape that holds for an entry point not yet written.
		const vault = linkStressVault();
		const { view } = linkStressView(vault);
		const context = view.model?.byPath.get('Epic.md');
		const other = view.model?.byPath.get('Other.md');
		if (!context || !other) throw new Error('fixture not as expected');
		await view.applySafely([{ file: context.file, dependsOn: { add: other.file } }]);

		expect(vault.fm('Epic.md')['dependsOn']).toBeUndefined();
		// The exact wording `writeGate.ts` uses — note the curly apostrophe, which every
		// other block in this file already matches on.
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});
});
```

Add the imports the block needs at the top of the file:

```ts
import { makeView } from '../helpers/view';
import { rowFor } from '../helpers/roadmap';
import { legalTargetPaths } from '../../src/view/interactions/dependencies';
```

- [ ] **Step 2: Run them**

```bash
npx vitest run test/view/contextCardWrites.test.ts
```

Expected: PASS, all three (Tasks 2 and 3 already made them true — these are regression
guards, not a red-green cycle). If any FAILS, that is a real defect in Task 2 or 3; fix it
there, not here.

`Notice` is already imported at the top of this file, and `Notice.messages` is the mock's
recorded array — there is no `Notice.last()`.

- [ ] **Step 3: Watch the structural refusal fail without its guard**

Comment out the `outsideFilter` refusal in `src/view/writeGate.ts`'s `applySafely`, run
the third test, see it FAIL, restore.

- [ ] **Step 4: Gate and commit**

```bash
npm run check
git add test/view/contextCardWrites.test.ts
git commit -m "Ask the context-row rule of the connector too"
```

---

### Task 5: Harness fixtures, and the rule that says where one goes

**Files:**
- Modify: `test/helpers/fixtures.ts`
- Modify: `test/harness/mount.ts`
- Modify: `test/harness/page.ts`
- Modify: `test/harness/harness.test.ts`
- Modify: `test/CLAUDE.md`

**Interfaces:**
- Consumes: `demoVault()`, `demoResults(vault)`, `demoOptions()` from
  `test/helpers/fixtures.ts`; `mountHarness(root)` from `test/harness/mount.ts`.
- Produces:
  - `edgeCaseVault(): FakeVault` in `test/helpers/fixtures.ts`
  - `mountHarness(root: HTMLElement, fixture: 'demo' | 'edges' = 'demo'): MountedHarness`

**Background for the implementer.** `demoVault()` is the everyday backlog the harness
exists to show. A clipped bar cannot live in it: clipping needs the window to exceed
`MAX_TIMELINE_DAYS` (1830), which clamps the grid to 1830 days around today and squeezes
every other bar in the demo down to a sliver. So the cases split by whether they distort
the everyday picture — the ones that do get a named variant, selected by URL the same way
`?view=` already selects a projection.

- [ ] **Step 1: Write the failing tests**

Append to `test/harness/harness.test.ts`:

```ts
	it('draws the cases the connector has to survive, in the everyday fixture', () => {
		const { view, containerEl } = mount();
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		containerEl.querySelector<HTMLButtonElement>('.pbl-collapse-ctl')?.click();

		// A bar one day wide keeps both its end grip and its connector rather than
		// trading one for the other.
		const oneDay = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-bar')).filter((b) =>
			b.classList.contains('pbl-bar-milestone'),
		);
		expect(oneDay.length).toBeGreaterThan(0);
		// An inferred bar has no grip and still offers a connector.
		const inferred = containerEl.querySelector<HTMLElement>('.pbl-bar-inferred');
		expect(inferred).not.toBeNull();
		expect(inferred?.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('draws a clipped bar in the edge-case fixture, where it distorts nothing', () => {
		const root = document.createElement('div');
		document.body.appendChild(root);
		const { view, containerEl } = mountHarness(root, 'edges');
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const clipped = containerEl.querySelector<HTMLElement>('.pbl-bar-clipped-end');
		expect(clipped, 'the edge fixture exists to draw a clipped bar').not.toBeNull();
		// The connector comes INSIDE the clamped edge; the class is what the stylesheet
		// keys that on, so its presence is the checkable half.
		expect(clipped?.querySelector('.pbl-bar-connector')).not.toBeNull();
	});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run test/harness/harness.test.ts
```

Expected: FAIL — `mountHarness` takes one argument, and neither an inferred bar nor a
clipped one is in the fixture.

- [ ] **Step 3: Add the everyday cases**

In `test/helpers/fixtures.ts`, inside `demoVault()`:

Give `Welcome tour` an inferred bar by dating its child and leaving the parent bare —
replace the `Highlight the sidebar` line with:

```ts
	// Dated while its parent is not, so `Welcome tour` draws an INFERRED bar: outlined,
	// no grips at all, and still a connector — a link claims no date, so it needs no
	// baseline the way a grip does.
	add('Highlight the sidebar', { type: 'PBI', order: 10, status: 'New', horizon: 'Next', start: '2026-08-24', due: '2026-09-05' }, 'Welcome tour');
```

And add a one-day bar plus the second link in the chain, after `Offline-first sync`:

```ts
	// A bar exactly one day wide — start and target on the same date, an ordinary PBI
	// rather than a Milestone, so it draws the diamond from its GEOMETRY. The case where
	// a bar is narrower than its own handles, and both the end grip and the connector
	// still have to be reachable.
	add('Cut the release branch', { type: 'PBI', order: 40, status: 'Ready', start: '2026-09-14', due: '2026-09-14' }, 'Sign-up flow');
	// The second hop of a chain: this waits for `Offline-first sync`, which waits for
	// `Single sign-on`. Dragging from here, `Single sign-on` must be refused THROUGH the
	// chain and not merely as a direct neighbour — the transitive half of the rule, in
	// the picture rather than only in a unit test.
	add('Sync conflict UX', { type: 'PBI', order: 50, status: 'New', start: '2026-10-20', due: '2026-11-30', dependsOn: '[[Offline-first sync]]' }, 'Onboarding');
```

- [ ] **Step 4: Add the variant**

At the end of `test/helpers/fixtures.ts`:

```ts
/**
 * The cases that cannot live in `demoVault()` without wrecking it.
 *
 * A clipped bar needs the window to exceed `MAX_TIMELINE_DAYS`, which clamps the grid to
 * 1830 days around today — every other bar in the demo becomes a sliver. So the everyday
 * fixture keeps its job and this one takes the awkward cases, the same split the harness
 * already makes between projections with `?view=`.
 *
 * Deliberately small: it is a set of cases, not a second backlog.
 */
export function edgeCaseVault(): FakeVault {
	const vault = new FakeVault();
	const add = (title: string, frontmatter: Record<string, unknown>, parent?: string) =>
		vault.addFile(`${title}.md`, { frontmatter, parentLink: parent });

	add('Platform', { type: 'Epic', order: 10, status: 'Active' });
	// Clipped at BOTH edges regardless of what today is, so this fixture does not rot
	// with the calendar: an eight-year span always exceeds the 1830-day budget.
	add('The long migration', { type: 'PBI', order: 10, status: 'Active', start: '2022-01-01', due: '2030-12-31' }, 'Platform');
	// Ordinary, inside the clamped window, so the clipped bar has something to be
	// compared against and something legal to be dragged onto.
	add('Nearby work', { type: 'PBI', order: 20, status: 'New', start: '2026-08-04', due: '2026-08-28' }, 'Platform');
	add('One day only', { type: 'PBI', order: 30, status: 'Ready', start: '2026-08-12', due: '2026-08-12' }, 'Platform');
	return vault;
}
```

- [ ] **Step 5: Let the harness choose a fixture**

In `test/harness/mount.ts`, change the signature and the two `demoResults` call sites:

```ts
/** Which backlog to mount. See `edgeCaseVault` for why there is more than one. */
export type HarnessFixture = 'demo' | 'edges';

export function mountHarness(root: HTMLElement, fixture: HarnessFixture = 'demo'): MountedHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault = fixture === 'edges' ? edgeCaseVault() : demoVault();
```

Everything below is unchanged — `demoResults(vault)` filters by the context-row path and
returns every entry for a vault that has none, so it serves both fixtures.

Add `edgeCaseVault` to the import from `../helpers/fixtures`.

In `test/harness/page.ts`, before the mount:

```ts
/** `?fixture=edges` mounts the awkward cases instead of the everyday backlog. */
const fixture = new URLSearchParams(window.location.search).get('fixture') === 'edges' ? 'edges' : 'demo';
const { view } = mountHarness(document.body, fixture);
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run test/harness/harness.test.ts test/view/
```

Expected: PASS. If a view test breaks, it read the demo fixture — the fixture is shared,
so a changed note changes what those tests see. Fix the assertion, not the fixture, unless
the fixture change was genuinely wrong.

- [ ] **Step 7: Write the rule and say what checks it**

In `test/CLAUDE.md`, under **Looking at it**, after the `test/helpers/fixtures.ts` bullet:

```markdown
- **A change that visibly alters the view puts its cases in a FIXTURE, not in a mock.**
  In `demoVault()` where the case belongs in the everyday picture; in a named variant —
  `edgeCaseVault()`, reached by `?fixture=edges` — where it would distort it, which is
  what a clipped bar does: clipping needs the window past `MAX_TIMELINE_DAYS`, and that
  clamp squeezes every other bar in the demo. An uncommitted `mock.ts` is for markup no
  code produces yet; the moment code produces it, the case belongs somewhere the harness
  can be pointed at and a test can assert exists.
  What checks this is narrower than the rule, and the gap is the point:
  `test/harness/harness.test.ts` asserts each fixture RENDERS the cases it exists for, so
  a deleted note or a renamed class fails. Nothing checks that a contributor remembered
  the rule — a register gate for it was considered and would have to guess which changes
  are "visible".
```

- [ ] **Step 8: Look at both**

```bash
npm run harness
```

Open `?view=roadmap` and `?view=roadmap&fixture=edges` and confirm the everyday picture is
undamaged and the clipped bar's connector sits inside the grid.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add test/helpers/fixtures.ts test/harness/mount.ts test/harness/page.ts test/harness/harness.test.ts test/CLAUDE.md
git commit -m "Put the awkward cases where the harness can be pointed at them"
```

---

### Task 6: The register

**Files:**
- Modify: `docs/requirements/Draw a dependency between bars.md`
- Create: `docs/issues/A dependency write is announced to nobody.md`

**Interfaces:**
- Consumes: every module created or modified in Tasks 1–5.
- Produces: nothing code reads. `docs-check.mjs` rule 7 requires every `src/` module be
  *specified* by a use case's `## Where it lives` or an ADR's `## Decision`, so
  `src/view/interactions/linkDrag.ts` does not pass the gate until this task lands.

- [ ] **Step 1: Replace `## Where it lives`**

In `docs/requirements/Draw a dependency between bars.md`, replace the whole
`## Where it lives` section with:

```markdown
## Where it lives

The gesture is `src/view/interactions/linkDrag.ts` — what a bar's two roles are, when
legality is asked, what the answer looks like while the drag is held, and the call into
the write. The connector itself is drawn by `src/view/render/timeline.ts` beside the
grips, which also gained `pbl-bar-clipped-end`, since the class that already existed
folded a clamped end together with an absent target date and the two want different
placement. Its appearance, its reveal, the `(hover: none)` block that undoes that reveal,
and the marking held during a drag are in `styles/timeline.css`; the bar label's gap and
the decluttering are in `styles/timelineFurniture.css`.

**Legality is asked of `src/view/interactions/dependencies.ts`, not of
`src/domain/dropTargets.ts`.** This note said otherwise until the work was done. The
question is about the dependency graph, and both closure walks and the four exclusions
already live beside the menu that made them; `dropTargets.ts` answers a question about
tree structure and knows nothing of prerequisites. `legalTargetPaths` there is
`candidates` asked from the end the drop writes to — a membership test against the one
definition, never a second formulation of it — and the write is
`applyDependencyWrite`, exported and called rather than re-planned.

**The refusal this note did not ask for, and needed.** Every drop target gated on the
view's own token alone, so a connector drag would have been accepted by the timeline
grid — which would have written a DATE — and by the dated shelf, which would have
unscheduled. `src/view/interactions/cardDrag.ts` now carries a payload KIND, and the
default is refusal: a target that means "move this" refuses a link without knowing links
exist. Put there rather than at those two call sites because the next target somebody
writes is exactly the one a list of call sites would miss.
```

- [ ] **Step 2: Register the announcement gap**

Create `docs/issues/A dependency write is announced to nobody.md`:

```markdown
---
type: Issue
order: 50
parent: "[[Dependencies]]"
status: Open
priority: P3
area: accessibility
created: 2026-08-09
source: found while building [[Draw a dependency between bars]]
files:
  - src/view/interactions/dependencies.ts
  - src/view/interactions/cardDrag.ts
---

# A dependency write is announced to nobody

Every card move announces into the drag library's live region — a board move, a horizon
move, a schedule move, whether the input was a drag, a key or a menu pick. A dependency
write announces nothing, and never has: `Linking two items` shipped the menu path silent,
and `Draw a dependency between bars` kept parity deliberately rather than giving one
input a voice the other lacks.

So nothing regressed, and the drag's acceptance criterion — the same batch, refusals,
announcement and undo as the menu path — is met. What is true anyway is that a
screen-reader user gets no confirmation from either path that an ordering was recorded,
on the one write where the RESULT is a line drawn between two rows they cannot see.

**Why it was not fixed in that increment.** The fix belongs in `applyDependencyWrite`,
which both inputs share — so it changes shipped menu behaviour, which is a change to
`Linking two items` and not a gap in the drag. Doing it there quietly, inside a PBI about
a gesture, is how one note comes to own a decision another note is specified by.

**What it would take.** A sentence naming both notes and what changed — the vocabulary
question is which end to name first, since the write lands on the DEPENDENT and the drag
runs from the prerequisite, and `announceHorizonMove` already shows how two functions were
needed to keep "where it was" and "where it was sent" from collapsing into one wrong
answer. The undo path needs its own words or it says nothing when the link comes back off.
```

- [ ] **Step 3: Add what a vault still owes**

`docs/requirements/Smoke test the roadmap.md` is a bullet list of unanswered questions,
several already annotated with what a harness pass did and did not settle. Add one:

```markdown
- The dependency connector ([[Draw a dependency between bars]]): a 9px dot is actually
  hittable at 4px/day zoom on a trackpad and on a touch screen, where it is permanent
  rather than revealed; the reveal reads as an affordance rather than as noise on a grid
  of many rows; the dot does not collide with the bar label at any zoom or on a bar one
  day wide; the dimming of illegal targets survives a theme that replaces the colour
  tokens, and still reads as *refused* rather than as *disabled*; and the preview line's
  accent is distinguishable from the today line's red and from a conflict arrow's.
  **Never checked** — the harness answered layout and hierarchy only, which is exactly
  what ADR 0020 says it can answer.
```

- [ ] **Step 4: Set the PBI's status**

Change `status: Open` to `status: Done` in the frontmatter of
`docs/requirements/Draw a dependency between bars.md`.

- [ ] **Step 5: Run the register gate on its own first**

```bash
node scripts/docs-check.mjs
```

Expected: `✓ register and ADRs consistent`, and `src/view/interactions/linkDrag.ts` no
longer reported as an unspecified module. If the new issue note's frontmatter is rejected,
read the error, then read a sibling note in `docs/issues/` and match it — do not add keys
the gate did not ask for.

- [ ] **Step 6: Full gate and commit**

```bash
npm run check
git add docs/
git commit -m "Say where the gesture lives, and register the voice it does not have"
```

- [ ] **Step 7: Push and open the pull request**

```bash
git push -u origin claude/item-dependencies-timeline-j8ymvb
```

Then open a pull request against the default branch, ready for review.

---

## What this plan does NOT deliver, and where it is written down

- **An announcement for either input.** Task 6 registers it.
- **A live-vault check.** Nothing here can answer whether a 9px dot is hittable at 4px/day
  on a real trackpad, whether the reveal reads as an affordance in a themed vault, or
  whether the dimming survives a theme that replaces the colour tokens. The jsdom harness
  is the substitute for Obsidian and the browser harness draws without asserting (ADR
  0006 and ADR 0020). Task 6 step 3 writes those questions onto
  `docs/requirements/Smoke test the roadmap.md`, so the debt is registered rather than
  merely mentioned here.
- **A connector at the bar's START.** `dependsOn` is one relation; a start-side dot would
  write the identical thing while suggesting a choice the frontmatter cannot record.
- **Dragging from the shelf.** Extension 2c: the shelf holds what has no bar, so the
  gesture cannot reach it by construction, and dragging from the shelf already means
  scheduling.
