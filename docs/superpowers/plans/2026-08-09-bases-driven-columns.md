# Bases-driven columns — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bases properties menu the single source of which columns a backlog row shows and in what order, chips included.

**Architecture:** `chipProps` becomes `resolveColumns`, which stops subtracting the state, horizon, risk and tags properties from `config.getOrder()` and instead tags each entry with a `kind` saying what is drawn inside it. Every column then renders inline in `.pbl-props` in the user's order, so the three fixed chip columns, their width constants and four of the five `pbl-hide-*` classes disappear; narrowing becomes a count of how many leading columns fit, and the columns past it are not rendered at all.

**Tech Stack:** TypeScript, esbuild, vitest + jsdom, eslint (typescript-eslint + eslint-plugin-obsidianmd), fallow, a Node script for the docs register. No runtime dependency is added.

**Spec:** `docs/superpowers/specs/2026-08-09-bases-driven-columns-design.md`. Read it first — it records the four alternatives that were rejected, and a reviewer will ask.

## Global Constraints

- `npm run check` is the gate: `npm run build && npm run lint && npm run test:coverage && npm run analyze && npm run docs`. All five pass before any commit that ends a task.
- Coverage thresholds in `vitest.config.mts` only ever go up, never down.
- Layers: `main → commands → view → storage → domain`, each reaching only downward. `no-restricted-imports` fails lint on a violation.
- 400-line max per `src/` file, 450 per `test/` file, 100 lines per function, complexity 16, 5 params max (`eslint.config.mjs`). All count non-blank non-comment lines.
- No `querySelector`/`querySelectorAll` on a receiver naming `treeEl` — a lint rule, see `src/view/CLAUDE.md`.
- Sentence-case UI text; `setCssProps` over inline styles; no global `app`.
- Every module in `src/` must be *specified* by a `## Where it lives` in a use case or a `## Decision` in an ADR — `npm run docs` enforces it.
- An invariant asserted in a comment gets a test that fails without it, and the test is **watched failing** before the fix is restored.
- Obsidian cannot run here. Say plainly what still needs a live-vault check.

---

### Task 1: The ordered column list, and the row that draws it

The core of the change: one list, kinds instead of subtraction, every column inline in
the user's order. The three fixed chip columns go with it.

**Files:**
- Modify: `src/view/host.ts` (the `ChipProp` interface and the `chips` member)
- Modify: `src/view/render/columns.ts` (`chipProps`, `renderColumnHeader`, `renderRowColumns`, `renderPropCells`, `renderStateChip`, the three width constants)
- Modify: `src/view/render/rows.ts:41-70` (the `setCssProps` block and the `ctx.chips` read)
- Modify: `src/view/render/board.ts:404` (`renderCardBody`)
- Modify: `src/view/backlogView.ts:32,108,291` (import, field, assignment)
- Modify: `src/view/interactions/tags.ts:14-16` (`tagsColumnVisible`)
- Modify: `src/domain/board.ts:212` (delete `hasStateColumn`)
- Modify: `styles/columns.css` (delete three column rules, fix one comment)
- Test: `test/view/columnKinds.test.ts` (new), `test/view/columns.test.ts`, `test/view/risk.test.ts`, `test/view/rendering.test.ts`, `test/view/deliverableWorkflowByType.test.ts`

**Interfaces:**
- Consumes: `hasHorizonAxis` (`src/domain/roadmap.ts`), `hasRiskLevels` and `resolvedDeliverableStateKey` (`src/domain/settings.ts`), `stateKeyFor` and `ownWorkflowReading` (`src/domain/board.ts`) — all already imported by `columns.ts`.
- Produces:
  - `export type ColumnKind = 'value' | 'tags' | 'state' | 'horizon' | 'risk'` (`src/view/host.ts`)
  - `export interface Column { prop: BasesPropertyId; label: string; kind: ColumnKind }` (`src/view/host.ts`)
  - `BacklogViewHost.columns: readonly Column[]` — replaces `chips`
  - `export function resolveColumns(host: BacklogViewHost): Column[]` (`src/view/render/columns.ts`) — replaces `chipProps`
  - `export function renderPropCells(ctx: RowContext, row: HTMLElement, item: BacklogItem, columns: Column[]): void` — now takes the columns to draw
  - `RowContext.columns: Column[]` — replaces `RowContext.chips`

- [ ] **Step 1: Write the failing test for the list**

Create `test/view/columnKinds.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/** The prop/kind pairs the view resolved, which is what every renderer reads. */
function kinds(view: { columns: readonly { prop: string; kind: string }[] }): [string, string][] {
	return view.columns.map((column) => [column.prop, column.kind]);
}

describe('the columns are the properties menu, in its order', () => {
	it('tags each visible property with the rendering it gets, keeping the menu order', () => {
		const { config, view } = makeView(fixture(), {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			riskProperty: 'note.risk',
		});
		// Deliberately not the order the old code pinned them in: a chip goes where the
		// user put it, between two ordinary properties if that is what they chose.
		config.order = ['note.status', 'note.points', 'note.horizon', 'note.tags', 'note.risk'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([
			['note.status', 'state'],
			['note.points', 'value'],
			['note.horizon', 'horizon'],
			['note.tags', 'tags'],
			['note.risk', 'risk'],
		]);
	});

	it('draws nothing for a configured property the properties menu does not show', () => {
		// The invariant the whole change rests on, asked of all four kinds at once:
		// configuring a property is not what puts it on a row — visibility is.
		const { config, containerEl, view } = makeView(fixture(), {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			riskProperty: 'note.risk',
		});
		config.order = [];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([]);
		expect(containerEl.querySelector('.pbl-state-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-horizon-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-risk-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-prop-tags')).toBeNull();
	});

	it('reads a special property as an ordinary value when its vocabulary is empty', () => {
		// hasHorizonAxis and hasRiskLevels are each a PAIR — a key AND a declared list.
		// With the list cleared there is no chip to draw and no menu it could open, so
		// the column falls through to the plain rendering rather than drawing a control
		// that can set nothing.
		const { config, view } = makeView(fixture(), {
			horizonProperty: 'note.horizon',
			horizonValues: '',
			riskProperty: 'note.risk',
			riskValues: '',
		});
		config.order = ['note.horizon', 'note.risk'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([
			['note.horizon', 'value'],
			['note.risk', 'value'],
		]);
	});

	it("never draws the view's own machinery, however visible it is made", () => {
		// The tree IS the parent column and the badge IS the type; `order` is an
		// implementation number. These are not properties the view declines to show,
		// they are the view itself.
		const { config, view } = makeView(fixture());
		config.order = ['file.name', 'note.parent', 'note.order', 'note.type', 'note.points'];
		view.onDataUpdated();

		expect(kinds(view)).toEqual([['note.points', 'value']]);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/columnKinds.test.ts`
Expected: FAIL — `view.columns` is undefined (the field is still `chips`), and the first
test's expectation would fail anyway because `chipProps` subtracts the three specials.

- [ ] **Step 3: Declare the column type on the host**

In `src/view/host.ts`, replace the `ChipProp` interface (lines 23–34) with:

```ts
/**
 * A column of the trailing strip: the property id to read, the label the header shows,
 * and WHICH RENDERING it gets. Membership and order belong to the Bases properties
 * menu alone — a kind never decides whether a column exists, only what is drawn inside
 * it. Declared here with the other view state the host exposes, so the interface every
 * module depends on depends on nothing itself.
 */
export type ColumnKind = 'value' | 'tags' | 'state' | 'horizon' | 'risk';

export interface Column {
	prop: BasesPropertyId;
	label: string;
	kind: ColumnKind;
}
```

and change the member at line 156 from `readonly chips: ChipProp[];` to:

```ts
	readonly columns: readonly Column[];
```

- [ ] **Step 4: Resolve the list**

In `src/view/render/columns.ts`, replace `chipProps` and `chipLabel` (lines 174–235,
including `stateColumnLabel`, which goes entirely) with:

```ts
/**
 * The columns this view draws, in the order the Bases properties menu declares them.
 * Resolved once per data update by the view (`host.columns`), because it answers two
 * questions — what the rows draw, and what the tag menu may edit — and they must not
 * drift apart.
 *
 * Nothing is subtracted for being special any more. A configured state, horizon, risk
 * or tags property is a column when the menu shows it, where the menu puts it, and is
 * absent when it does not: one source for what is on a row, which is what this used to
 * have two of.
 */
export function resolveColumns(host: BacklogViewHost): Column[] {
	let props: BasesPropertyId[] = [];
	try {
		props = host.config.getOrder();
	} catch {
		return [];
	}
	const settings = host.settings;
	// Not properties this view declines to show — the view ITSELF. The tree is the
	// parent column, the badge is the type, the title is the name, and `order` is an
	// implementation number rather than a fact about the item.
	const skip = new Set<string>([
		'file.name',
		`note.${settings.parentKey}`,
		`note.${settings.orderKey}`,
		`note.${settings.typeKey}`,
	]);
	return props
		.filter((prop) => !skip.has(prop))
		.map((prop) => ({ prop, label: columnLabel(host, prop), kind: columnKind(settings, prop) }));
}

/**
 * Which rendering a visible property gets. The three chip kinds ask the SAME predicate
 * their menu is gated on — a key AND a declared vocabulary — so a chip whose menu could
 * set nothing cannot exist: with the list cleared the property falls through to `value`
 * and renders as an ordinary column, which is the behaviour the risk chip already had
 * and is now stated once for all three.
 *
 * Both state keys map to `state`. With the two workflows on distinct keys and both
 * visible, that is two columns, and `renderStateChip` draws into whichever one names
 * the key this row's own workflow writes.
 */
function columnKind(settings: BacklogSettings, prop: BasesPropertyId): ColumnKind {
	const deliverableKey = resolvedDeliverableStateKey(settings);
	if (settings.stateKey && prop === `note.${settings.stateKey}`) return 'state';
	if (deliverableKey && prop === `note.${deliverableKey}`) return 'state';
	if (hasHorizonAxis(settings) && prop === `note.${settings.horizonKey}`) return 'horizon';
	if (hasRiskLevels(settings) && prop === `note.${settings.riskKey}`) return 'risk';
	if (settings.tagsKey && prop === `note.${settings.tagsKey}`) return 'tags';
	return 'value';
}

function columnLabel(host: BacklogViewHost, prop: BasesPropertyId): string {
	try {
		return host.config.getDisplayName(prop);
	} catch {
		return prop.substring(prop.indexOf('.') + 1);
	}
}
```

Update the imports at the top of the file: drop `hasStateColumn`, keep `ownWorkflowReading`
and `stateKeyFor`, and import `Column`, `ColumnKind` from `../host` beside
`BacklogViewHost`.

- [ ] **Step 5: Carry the list on the render context**

Still in `src/view/render/columns.ts`, in `RowContext` (line 27) and `rowContext`
(line 36), rename the field:

```ts
	columns: Column[];
```
```ts
	return { host, dnd, rows, cardKids, columns: [...host.columns] };
```

- [ ] **Step 6: Draw every column, in order**

Replace `renderRowColumns` and `renderPropCells` (lines 293–323) with:

```ts
/**
 * The trailing columns of one row. Every column is fixed-width and the strip is
 * anchored to the row's end, so values line up across rows regardless of title length
 * or indent — and the ORDER is the properties menu's, chips included.
 */
export function renderRowColumns(ctx: RowContext, row: HTMLElement, item: BacklogItem): void {
	// Pushes the columns to the row's end; also the click target between them.
	row.createDiv({ cls: 'pbl-row-spacer' });
	if (ctx.columns.length > 0) renderPropCells(ctx, row, item, ctx.columns);
	renderRollup(ctx.host, row, item);
}

/**
 * Shared with the cards, which pass a narrowed list — one resolved column list drives
 * every projection, and a caller may draw fewer of them but never a different set.
 */
export function renderPropCells(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	columns: Column[],
): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	for (const column of columns) {
		// `value` takes no modifier: `.pbl-prop-value` is already the class of the SPAN
		// a plain value renders into, and giving the cell the same name would make one
		// selector mean two boxes.
		const cls = 'pbl-prop' + (column.kind === 'value' ? '' : ` pbl-prop-${column.kind}`);
		renderCell(ctx.host, props.createDiv({ cls }), item, column);
	}
}

/** Which of the five renderings this column asked for. */
function renderCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): void {
	if (column.kind === 'tags') renderTagCell(host, cell, item, column);
	else if (column.kind === 'state') renderStateChip(host, cell, item, column.prop);
	else if (column.kind === 'horizon') renderHorizonChip(host, cell, item);
	else if (column.kind === 'risk') renderRiskChip(host, cell, item);
	else renderValue(host, cell, item, column);
}
```

`renderValue` and `renderTagCell` take a `Column` where they took a `ChipProp`; both
read only `.prop` and `.label`, so the bodies are unchanged apart from the parameter
type and the name (`chip` → `column`). Delete the `cell.addClass('pbl-prop-tags')` line
at the top of `renderTagCell` — the cell now arrives with that class.

- [ ] **Step 7: Give the state chip its column's key**

Change `renderStateChip`'s signature and opening guard:

```ts
function renderStateChip(
	host: BacklogViewHost,
	col: HTMLElement,
	item: BacklogItem,
	prop: BasesPropertyId,
): void {
	// The CELL is the properties menu's question and the CHIP is the row's own: this
	// column names ONE key, and a row draws into it only when that is the key its
	// workflow writes. With both workflows visible on distinct keys there are two such
	// columns, and every row fills exactly one of them and leaves the other empty —
	// empty rather than absent, or the columns after it would shift on that row alone.
	// `stateKeyFor` is the same function `buildItemMenu` gates Set state on, so the chip
	// and the menu can never disagree about which key this row writes.
	const key = stateKeyFor(host.settings, item);
	if (!key || `note.${key}` !== prop) return;
	const { value, done } = ownWorkflowReading(item);
	// ... unchanged from here
```

Delete the paragraph in the old doc comment that explains `hasStateColumn` versus
`stateKeyFor`; the guard above replaces it.

- [ ] **Step 8: Simplify the header**

Replace `renderColumnHeader` (lines 242–276) with:

```ts
export function renderColumnHeader(ctx: RowContext, containerEl: HTMLElement): void {
	if (ctx.columns.length === 0) return;
	const settings = ctx.host.settings;
	// Presentational: every value below carries its own accessible label.
	const header = containerEl.createDiv({ cls: 'pbl-cols', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-row-spacer' });

	const props = header.createDiv({ cls: 'pbl-props' });
	for (const column of ctx.columns) {
		const cell = props.createDiv({ cls: 'pbl-prop pbl-col-label', text: column.label });
		setTooltip(cell, column.label);
	}
	if (settings.stateKey || settings.showCounts) {
		header.createDiv({
			cls: 'pbl-meta-col pbl-col-label',
			text: settings.stateKey ? 'Progress' : 'Items',
		});
	}
	renderAddSpacer(header);
}
```

Every column now takes its own property's display name, which is what retires
`stateColumnLabel`: it existed because one column held two properties, and the
properties menu no longer lets that happen.

- [ ] **Step 9: Delete the three width constants**

In `src/view/render/columns.ts` delete `STATE_COL_WIDTH`, `HORIZON_COL_WIDTH` and
`RISK_COL_WIDTH` (lines 45–49), keeping `META_COL_WIDTH` and `INDENT_PER_DEPTH`. In
`src/view/render/rows.ts` drop them from the import list and from the `setCssProps`
block, leaving:

```ts
	treeEl.setCssProps({
		'--pbl-prop-col': `${ctx.host.settings.propColumnWidth}px`,
		'--pbl-prop-count': String(ctx.columns.length),
		'--pbl-meta-col': `${META_COL_WIDTH}px`,
		'--pbl-indent': `${INDENT_PER_DEPTH}px`,
	});
```

`columnFit` still references the deleted constants at this point — leave its body alone;
Task 2 rewrites it. To keep the build green now, replace its three chip terms with `0`
is NOT the move: instead do Task 2's `columnFit` rewrite here only if the compiler
complains. It will: delete the `state`, `horizon` and `risk` locals in `columnFit` and
the `hasStateColumn` / `hasHorizonAxis` / `hasRiskLevels` terms in its five thresholds,
so the sum reads `lead + meta + props` in every line. The verdict is wrong until Task 2
fixes it; that is why Task 2's test comes immediately after and why the two land on the
same branch.

- [ ] **Step 10: Point the remaining readers at the new name**

- `src/view/backlogView.ts:32` — `import { resolveColumns, rowContext, RowContext } from './render/columns';`
- `src/view/backlogView.ts:108` — `columns: Column[] = [];` (import `Column` from `./host`)
- `src/view/backlogView.ts:291` — `this.columns = resolveColumns(this);`
- `src/view/interactions/tags.ts:15` — `return host.columns.some((column) => column.kind === 'tags');`
- `src/view/render/board.ts:404` — the card's narrowed list:

```ts
	// A card draws the plain columns only. The chips are the tree's: a board card's
	// column IS its state and a bucket IS its horizon, so a chip on the card would
	// repeat what the card's own position already says. Filtered from the ONE resolved
	// list rather than resolved a second time — two derivations of "what is on screen"
	// is how the tag menu came to offer editing for a column the renderer had skipped.
	const plain = ctx.columns.filter((column) => column.kind === 'value' || column.kind === 'tags');
	if (plain.length > 0) renderPropCells(ctx, card, item, plain);
```

- [ ] **Step 11: Delete `hasStateColumn`**

Remove the function at `src/domain/board.ts:212` and its doc comment. `render/columns.ts`
was its only caller; the question it answered stops being asked once a column exists
because the property is visible. Run `npx tsc -noEmit -skipLibCheck` to confirm nothing
else referenced it.

- [ ] **Step 12: Drop the three column rules from the stylesheet**

In `styles/columns.css` delete the `.pbl-state-col`, `.pbl-horizon-col` and
`.pbl-risk-col` rules (and narrow the file's opening comment, which describes them). No
new rule is needed: `.pbl-prop` is already `display: flex; align-items: center;
overflow: hidden` at the column width, which is exactly what those three declared.

In the same file, the `:focus-visible` comment cites `.pbl-state-col`'s and
`.pbl-horizon-col`'s `overflow: hidden` as the reason the ring is inset. The reason
survives, the names do not — change it to `.pbl-prop`'s.

- [ ] **Step 13: Run the new tests**

Run: `npx vitest run test/view/columnKinds.test.ts`
Expected: PASS, all four.

- [ ] **Step 14: Update the suites that assert the old markup**

Run: `npx vitest run test/view test/domain`
Expected: failures in four files, each naming a deleted class. Fix each by asking the
column what it is rather than where it was pinned:

- `test/view/columns.test.ts` — the header test expects `['points', 'status', 'Progress']`
  from `config.order = ['note.points']`; the state label came from a pinned column that
  no longer exists, so the order must now name it: `config.order = ['note.points',
  'note.status']` for the same expectation. `--pbl-prop-count` becomes `'2'`.
- `test/view/columns.test.ts` horizon block (around line 224) — `.pbl-horizon-col
  .pbl-state-text` becomes `.pbl-prop-horizon .pbl-state-text`, the
  `--pbl-horizon-col` assertion goes, and the test must put `note.horizon` in
  `config.order`.
- `test/view/risk.test.ts` (lines 126, 183, 196) — `.pbl-risk-col` becomes
  `.pbl-prop-risk`, the `--pbl-risk-col` assertion goes, and `note.risk` joins
  `config.order`.
- `test/view/deliverableWorkflowByType.test.ts` (lines 102, 127, 137) and
  `test/view/rendering.test.ts` (lines 522, 538) — `.pbl-state-col` becomes
  `.pbl-prop-state`, with `note.status` (and `note.docStatus` where the Deliverable
  workflow is under test) added to `config.order`.

For `rendering.test.ts:538`, which asserts the state column is immediately followed by
the rollup: that adjacency is now between the LAST column and `.pbl-meta-col`, so assert
`row.querySelector('.pbl-props')?.nextElementSibling` is the `.pbl-meta-col`.

- [ ] **Step 15: Add the two-workflow column test**

Append to `test/view/columnKinds.test.ts`:

```ts
	it('gives each workflow its own column, and fills only the one a row writes', () => {
		// Two visible state properties are two columns now. The old single column held
		// both and had to call itself "State"; each of these takes its own property's
		// name, and a row fills exactly one of them.
		const vault = fixture();
		vault.addFile('Doc.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Draft' } });
		const { config, containerEl, view } = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.docStatus',
			deliverableStateValues: 'Concept, Draft, Published',
		});
		config.order = ['note.status', 'note.docStatus'];
		view.onDataUpdated();

		const cellsOf = (title: string) =>
			Array.from(rowByTitle(containerEl, title).querySelectorAll('.pbl-prop-state')).map(
				(cell) => cell.querySelector('.pbl-state-text')?.textContent ?? '',
			);
		// The Deliverable writes docStatus, so its chip is in the second column and the
		// first is an empty cell — empty, or every column after it would shift.
		expect(cellsOf('Doc')).toEqual(['', 'Draft']);
		// And the other way round for an item on the requirements workflow.
		expect(cellsOf('Epic A')[1]).toBe('');
	});
```

Add `rowByTitle` to the file's import from `../helpers/view`. Check the Deliverable
frontmatter key the helper expects by reading
`test/view/deliverableWorkflowByType.test.ts`'s own fixture and matching it.

- [ ] **Step 16: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. If `test/view/columns.test.ts` now exceeds the 450-line budget, move its
narrowing block into `test/view/columnKinds.test.ts`'s neighbour rather than trimming a
test.

- [ ] **Step 17: Lint and typecheck**

Run: `npm run build && npm run lint`
Expected: both pass. `columns.ts` should be well under its 400-line budget now — the
task is net subtraction.

- [ ] **Step 18: Commit**

```bash
git add src test styles
git commit -m "feat: a column is a visible property, wherever the menu puts it"
```

---

### Task 2: Narrowing counts columns instead of ranking them

A column that does not fit is **not rendered**. Clipping it with `overflow: hidden`
would leave its cell in the accessibility tree — a Bases value can render a native
control, and the chips are `tabindex="-1"` buttons assistive technology reaches by
design — so a "dropped" column would stay reachable, and focusing it would scroll the
overflow box and slide every remaining column out from under its header. The old
`display: none` ladder did not have that hole; the replacement must not open one.

**Files:**
- Modify: `src/view/host.ts` (one member and one setter)
- Modify: `src/view/render/columns.ts` (`columnFit`, `syncColumnFit`, `rowContext`)
- Modify: `src/view/backlogView.ts:108-ish` (the field) and `:559-562` (the reset)
- Modify: `styles/propertyColumns.css` (four deleted rules), `styles/cards.css:225-232`
- Test: `test/view/columns.test.ts`, `test/view/risk.test.ts`

**Interfaces:**
- Consumes: `RowContext.columns`, `renderedDepth`, `BacklogViewHost.columns` from Task 1.
- Produces:
  - `BacklogViewHost.columnsShown: number | null` — how many columns the last measurement said fit, null before anything was measured and on every card projection
  - `BacklogViewHost.setColumnsShown(shown: number | null): void`
  - `columnFit(settings, columnCount, depth, width): { shown: number; hideMeta: boolean }` (private)
  - `syncColumnFit(ctx, viewEl, treeEl): boolean` — signature unchanged, still "did the verdict change"

- [ ] **Step 1: Write the failing tests**

Replace the narrowing test in `test/view/columns.test.ts` ("drops the columns a pane
cannot hold") with these three:

```ts
	it('drops columns from the end of the order, keeping the rollup to the last', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 280 });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};
		const drawn = () => rowByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop').length;

		// Wider than any fixed breakpoint would be, and two 280px columns still do not
		// fit: the threshold is the configured width, not a guess.
		paneWidth(1400);
		expect(drawn()).toBe(2);

		paneWidth(900);
		expect(drawn()).toBe(1);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		// No column fits, and the rollup is still worth its 84px.
		paneWidth(500);
		expect(drawn()).toBe(0);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		// Narrower than the row's own lead plus the rollup: nothing left to give.
		paneWidth(300);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(true);

		// And every column comes back in the order it left. This is the case a fit that
		// measured the DRAWN columns rather than the resolved ones would fail: it would
		// ratchet down to zero and stay there.
		paneWidth(1400);
		expect(drawn()).toBe(2);
	});

	it('leaves nothing of a dropped column for a keyboard or a screen reader to find', () => {
		// Clipping would hide the cell and keep it focusable — a control inside a column
		// the view says it dropped, and focusing it scrolls the strip out from under its
		// header. The cell is not rendered at all.
		const vault = fixture();
		vault.entryValues.set('Epic A.md', {
			'note.done': {
				toString: () => 'true',
				renderTo: (el: HTMLElement) => {
					el.createEl('input', { attr: { type: 'checkbox' } });
				},
			},
		});
		const { containerEl, config, view } = makeView(vault, {
			propertyColumnWidth: 280,
			stateProperty: 'note.status',
		});
		config.order = ['note.points', 'note.done', 'note.status'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 700, configurable: true });
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.querySelectorAll('.pbl-prop').length).toBe(1);
		expect(row.querySelector('input')).toBeNull();
		expect(row.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('does not buy a second render pass on a pane whose verdict has not moved', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 280 });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 900, configurable: true });

		let passes = 0;
		const realEmpty = HTMLElement.prototype.empty;
		Object.defineProperty(tree, 'empty', {
			configurable: true,
			value: function (this: HTMLElement): void {
				passes += 1;
				realEmpty.call(this);
			},
		});

		view.onDataUpdated();
		const settled = passes;
		view.onDataUpdated();
		// One pass for the refresh and no refit pass: the pane did not change, so the
		// verdict did not either.
		expect(passes - settled).toBe(1);
	});
```

Add `rowByTitle` to the file's imports from `../helpers/view` if it is not already
there. Keep the "second pass alive after a render throws" test and the "counts the
indent" test, replacing their `pbl-hide-props` assertions with the same `drawn()` read
(0 where the class was expected true, 1 where false).

- [ ] **Step 2: Watch them fail**

Run: `npx vitest run test/view/columns.test.ts`
Expected: FAIL — every column still renders at every width; the code toggles classes.

- [ ] **Step 3: Carry the verdict on the host**

In `src/view/host.ts`, beside `columns`:

```ts
	/**
	 * How many of {@link columns} the last measurement said this pane can hold — null
	 * before anything has been measured, and on every card projection, where the ladder
	 * does not apply. Written by `syncColumnFit` alone and read by `rowContext`, which
	 * slices the list the renderers draw.
	 */
	readonly columnsShown: number | null;
	setColumnsShown(shown: number | null): void;
```

In `src/view/backlogView.ts`, beside the `columns` field:

```ts
	columnsShown: number | null = null;

	setColumnsShown(shown: number | null): void {
		this.columnsShown = shown;
	}
```

- [ ] **Step 4: Slice the list the renderers see**

In `src/view/render/columns.ts`, `rowContext`:

```ts
export function rowContext(
	host: BacklogViewHost,
	dnd: DragDropController,
	rows: Map<string, HTMLElement>,
	cardKids: Set<string>,
): RowContext {
	// What this pass DRAWS. `host.columns` stays what EXISTS — `syncColumnFit` measures
	// that one, or a narrowed pane would ratchet the count down and never let a column
	// come back when it widens again.
	return { host, dnd, rows, cardKids, columns: host.columns.slice(0, host.columnsShown ?? host.columns.length) };
}
```

- [ ] **Step 5: Rewrite the verdict**

```ts
/**
 * How many of the columns fit in a pane this wide, and whether the rollup does. Columns
 * never shrink — that is what keeps them aligned under their header — so a pane too
 * narrow for them drops them instead, and the threshold has to come from what the rows
 * actually need rather than a fixed breakpoint: two 280px columns need more than twice
 * the room of two 100px ones, and every level of indent takes another 24px from the
 * deepest row's title.
 *
 * They drop from the END of the user's order. The properties menu is where the user says
 * what matters, so a ranking of our own beside it would be a second opinion about their
 * own declaration. The rollup is the exception, and only because it is not in that order
 * at all — it is pinned past the end, so "last" would always pick it first; it goes after
 * every column instead.
 *
 * Private: the threshold and what it drives are one decision, applied by
 * {@link syncColumnFit} below. Exporting the calculation alone invites a second caller
 * that measures the same pane and then disagrees about what to hide.
 */
function columnFit(
	settings: BacklogSettings,
	columnCount: number,
	depth: number,
	width: number,
): { shown: number; hideMeta: boolean } {
	const meta = settings.stateKey || settings.showCounts ? META_COL_WIDTH : 0;
	const lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH;
	const room = width - lead - meta;
	const shown = Math.max(0, Math.min(columnCount, Math.floor(room / settings.propColumnWidth)));
	// Nothing below this: what is left is the row's own lead, and the title truncates
	// from there.
	return { shown, hideMeta: shown === 0 && width < lead + meta };
}

/**
 * Measure the pane and apply {@link columnFit} to it. Lives with the widths and the
 * threshold it reads — a decision computed in one file and applied in another is one
 * edit away from the two disagreeing.
 *
 * Measured after the rows are in place: an empty tree has no scrollbar, and its width is
 * not the width the columns will actually get. Returns true when the decision CHANGED,
 * which is exactly when what was rendered no longer matches it and the caller owes the
 * rows another pass — and the next pass renders FEWER CELLS rather than hiding the ones
 * it drew. Hiding them would leave a control inside a dropped column reachable by
 * keyboard and by assistive tech, and scroll the strip out from under its header when
 * one took focus.
 *
 * It measures `ctx.host.columns` and never `ctx.columns`: the second is the slice the
 * last verdict produced, and measuring it would ratchet the count down for good.
 */
export function syncColumnFit(ctx: RowContext, viewEl: HTMLElement, treeEl: HTMLElement): boolean {
	const width = treeEl.clientWidth;
	// Zero while detached or before the first layout: keep the last decision.
	if (width === 0) return false;
	// Indent is part of what a row needs, so expanding a deep branch can be what makes
	// the columns stop fitting.
	const fit = columnFit(ctx.host.settings, ctx.host.columns.length, renderedDepth(ctx), width);
	const changed = fit.shown !== ctx.columns.length || fit.hideMeta !== viewEl.hasClass('pbl-hide-meta');
	ctx.host.setColumnsShown(fit.shown);
	viewEl.toggleClass('pbl-hide-meta', fit.hideMeta);
	return changed;
}
```

`changed` compares against `ctx.columns.length` — what this pass actually DREW — rather
than against the stored number, so a render that drew a different count than the stored
verdict claims still asks for the pass that reconciles them.

- [ ] **Step 6: Reset the verdict on a card projection**

`src/view/backlogView.ts:559-562`:

```ts
		if (projection !== 'tree') {
			// The column ladder is the tree's: a narrow-pane verdict from tree mode must
			// not strip cells off cards, and its rollup class must not hide theirs.
			this.setColumnsShown(null);
			this.viewEl.removeClass('pbl-hide-meta');
		}
```

- [ ] **Step 7: Rewrite the stylesheet**

`styles/propertyColumns.css` — delete `.pbl-view.pbl-hide-props`, `.pbl-hide-state`,
`.pbl-hide-horizon` and `.pbl-hide-risk`. Keep `.pbl-view.pbl-hide-meta .pbl-meta-col`,
with the reason restated:

```css
/* The rollup is not in the user's order — it is pinned past the end of it — so it does
   not drop by not being rendered the way a column does, and it drops last: only once no
   column is shown and the pane cannot hold even this. */
```

`.pbl-props` keeps its existing width rule: `--pbl-prop-count` is `ctx.columns.length`,
which is now the count actually drawn, so the box is always exactly as wide as its cells.
Update the comment above it, which claims the columns "drop entirely once the pane is too
narrow" via a container query — they drop by not being rendered, and `columnFit` is where
that is decided.

`styles/cards.css:225-232` loses its `.pbl-props` halves:

```css
/* The board and the roadmap never drop the rollup for room the way the tree does — a
   stale verdict from tree mode must not hide a card's. The columns need no such rule:
   a card projection resets the count rather than carrying a class. */
.pbl-view.pbl-board-mode .pbl-card .pbl-meta-col,
.pbl-view.pbl-roadmap-mode .pbl-card .pbl-meta-col {
	display: flex;
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/columns.test.ts test/view/risk.test.ts`
Expected: PASS. `test/view/risk.test.ts:235-243` asserts `pbl-hide-risk` and
`pbl-hide-meta` at two pane widths — rewrite the risk half as a count of rendered
`.pbl-prop` cells (the risk column is just a column now) and keep the rollup half.

- [ ] **Step 9: Watch the a11y test fail without the fix**

Temporarily make `rowContext` pass `host.columns` unsliced — the clipping design this
replaced, where `.pbl-props` was narrowed by a variable and `overflow: hidden` did the
hiding. Run
`npx vitest run test/view/columns.test.ts -t 'keyboard or a screen reader'`.
Expected: FAIL — the checkbox and the chip are both still in the row. Restore the slice
and confirm PASS. The rule this test states is the one the first design got wrong, so it
is worth having seen it fail.

- [ ] **Step 10: Full suite, then commit**

Run: `npx vitest run && npm run build && npm run lint`

```bash
git add src styles test
git commit -m "fix: the pane drops the last column, and drops it from the DOM"
```

---

### Task 3: Delete the properties toggle

**Files:**
- Modify: `src/domain/viewOptions.ts:357-393` (`displayGroup`)
- Modify: `src/domain/settings.ts:25,282,862` (the field, the default, the resolver)
- Modify: `test/domain/settings.test.ts:55-67`, `test/domain/viewOptions.test.ts:43`
- Modify: `test/helpers/fixtures.ts:39-60` (`demoOptions`, and a new `demoOrder`)
- Modify: `test/harness/mount.ts:60`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function demoOrder(): string[]` in `test/helpers/fixtures.ts` — the harness's visible property order.

- [ ] **Step 1: Delete the option**

In `src/domain/viewOptions.ts`, remove the `showProperties` toggle from `displayGroup`,
leaving the width slider, the tags property and the descendant-count toggle.

In `src/domain/settings.ts`, delete `showChips: boolean;` (line 25), `showChips: true,`
(line 282) and `showChips: bool('showProperties', fallback.showChips),` (line 862).

- [ ] **Step 2: Follow the compiler**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: errors anywhere `showChips` is still read. Task 1 already removed the two in
`columns.ts`; fix any that remain by deleting the read, never by reintroducing a
default.

- [ ] **Step 3: Fix the two domain tests**

`test/domain/settings.test.ts:55-67` sets `showProperties: false` and asserts
`settings.showChips` is false — delete both the input and the assertion, keeping the
rest of the case (it covers several options at once; read it before cutting).

`test/domain/viewOptions.test.ts:43` lists `'showProperties'` among the expected option
keys — remove the entry.

`test/docs/surfaces.test.ts` needs no change: it requires every option key to be named
by a requirement, and one fewer key is one fewer requirement to satisfy. Task 5 removes
the mention from `docs/requirements/Property columns.md`.

- [ ] **Step 4: Give the harness a visible order**

In `test/helpers/fixtures.ts`, delete `showProperties: false` from `demoOptions()` and
add beside it:

```ts
/**
 * What the harness's Bases properties menu shows, in its order. It has to be stated
 * now: the columns ARE this list, so a harness with an empty order draws a bare tree
 * and answers nothing about the layout. A chip is deliberately not first and not last —
 * the point of the page is that a chip sits wherever the menu puts it.
 */
export function demoOrder(): string[] {
	return ['note.status', 'note.horizon', 'note.risk', 'note.tags'];
}
```

In `test/harness/mount.ts:60`:

```ts
	const config = new FakeViewConfig(demoOptions());
	config.order = demoOrder();
	anyView.config = config;
```

adding `demoOrder` to the import on line 15.

- [ ] **Step 5: Look at it**

Run: `npm run harness`
Expected: the tree draws four columns in that order, chips interleaved, under a header
naming each. Confirm the header sits above its cells and that narrowing the browser
window drops columns from the right. This answers layout and spacing only — colour,
iconography and anything Bases hands the view are still owed a live-vault check.

- [ ] **Step 6: Run the suite and commit**

Run: `npx vitest run && npm run build && npm run lint`

```bash
git add src test
git commit -m "refactor: the properties menu is the only switch for what a row shows"
```

---

### Task 4: The init action names the next step

**Files:**
- Modify: `src/view/interactions/structure.ts:117-142` (`runInit`)
- Test: `test/view/init.test.ts` (find the existing file with
  `grep -rln "runInit\|All items already have" test/`; add the case there rather than
  creating a second suite for one action)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

In the suite that already drives `runInit`, add:

```ts
	it('says where a property it just bound becomes visible', () => {
		// Binding a property and stubbing it onto every note still shows nothing: the
		// columns are the Bases properties menu, and `BasesViewConfig` has no setter for
		// it. The Notice is the only place that loop is closed.
		// ... arrange exactly as the neighbouring "binds the suggested keys" case does
		await runInit(host);
		expect(lastNotice()).toContain('properties menu');
	});
```

Match the arrange block and the notice helper to whatever the neighbouring cases in that
file already use — do not invent a second way to read a Notice.

- [ ] **Step 2: Watch it fail**

Run: `npx vitest run <that file>`
Expected: FAIL — the Notice ends after the list of what was bound.

- [ ] **Step 3: Add the clause**

In `runInit`, where the adopted properties are reported:

```ts
	const done: string[] = [];
	if (adopted.length > 0) done.push(`set up ${adopted.map((property) => property.suggested).join(', ')}`);
	if (applied) done.push(`updated ${writes.length} item${writes.length === 1 ? '' : 's'}`);
	// Half the loop this action exists to close is outside it: a bound property draws no
	// column until the base SHOWS it, and `BasesViewConfig` exposes no way to set the
	// order from here. Naming the menu is the whole fix.
	const next = adopted.length > 0 ? ' Add them in the properties menu to show them as columns.' : '';
	if (done.length > 0) new Notice(`Product Backlog: ${done.join(' and ')}.${next}`);
	else if (writes.length === 0) new Notice('All items already have the properties this view writes.');
```

Sentence case, and no special characters — marketplace rules.

- [ ] **Step 4: Run and commit**

Run: `npx vitest run && npm run lint`

```bash
git add src test
git commit -m "feat: init says where the properties it bound become columns"
```

---

### Task 5: The register

Every note that states the old rule follows the code. `npm run docs` gates the shape;
the reading is yours.

**Files:**
- Modify: `docs/requirements/Property columns.md`
- Modify: `docs/issues/Tree columns and narrowing.md`
- Create: `docs/adrs/0023-columns-are-the-bases-property-order.md`
- Modify: `docs/adrs/README.md` (the ADR index, if it lists them — check)
- Modify: `src/view/CLAUDE.md` (the **Controls** section)

- [ ] **Step 1: Rewrite the PBI**

`docs/requirements/Property columns.md` states the old rule in four places: the main
flow ("Which properties become columns is resolved once per data update" is still true;
the rest is not), extension **3a** (the four-step drop order), the acceptance criteria,
and `## Where it lives`, which names `showProperties` and
`src/view/render/columns.ts`'s deleted symbols. Rewrite it around the new rule:
membership and order are the properties menu's, a kind decides only what is drawn
inside a column, the drop is from the end of that order with the rollup last. Keep the
tag-delta guarantee — it is untouched and still the reason the write is a delta.

`## Where it lives` must name every `src/` module the note specifies, since
`docs-check.mjs` rule 7 reads exactly that section: `src/domain/viewOptions.ts`
(`propertyColumnWidth`, `tagsProperty` — no longer `showProperties`),
`src/view/render/columns.ts`, `src/view/resize.ts`, `src/view/interactions/tags.ts`.

- [ ] **Step 2: Rewrite the smoke test**

`docs/issues/Tree columns and narrowing.md` tells a human to watch four named classes
drop in a fixed order. Replace the "How to check" list with the new one: confirm the
header sits above its cells at default width; reorder the properties in the Bases menu
and confirm the columns and the header move together; hide one and confirm it goes from
both; narrow the pane and confirm columns drop from the END of the order with the rollup
outlasting them all; widen and confirm they return in the same order. Add the case only
a vault can answer: a chip drawn in the middle of the strip still reads as a chip and
not as a squeezed value.

- [ ] **Step 3: Write the ADR**

Create `docs/adrs/0023-columns-are-the-bases-property-order.md`. Copy the frontmatter
shape from a neighbour (`adr`, `title`, `status`, `date`, `area` — `docs-check.mjs`
validates all five) with `status: Accepted` and `date: 2026-08-09`. The `## Decision`
section is what `docs-check.mjs` rule 7 reads for module specification, so name
`src/view/render/columns.ts` there. Record the four rejected alternatives from the
spec's *The decision* section — chips always rendering, the usefulness ranking kept,
chips on cards, and seeding the order from the plugin (refused because
`BasesViewConfig` has no setter, checked against the 1.13.1 typings) — and the accepted
cost: a configured property draws nothing until the base shows it, with the ✨ Notice as
the only pointer.

- [ ] **Step 4: Update the layer guide**

`src/view/CLAUDE.md`'s **Controls** section describes the fixed strip
(`.pbl-props` → `.pbl-risk-col` → `.pbl-horizon-col` → `.pbl-state-col` →
`.pbl-meta-col`), the four hide classes and the usefulness ladder, and its
`chipProps`/`host.chips` paragraph. All of it follows the code. The rules that SURVIVE
and must still be stated: every DRAWN column renders on every row — an empty cell, never
a skipped one — which is now a statement about the fitted set rather than about the
configured one, since a column the pane cannot hold is drawn on no row at all; the
end-anchored strip reserves the add button's width; widths are published to CSS as custom
properties; the threshold is derived from the configured width rather than a breakpoint;
the second pass runs exactly once; and the fit is measured after the rows render. Two new
rules earn a sentence each, and both have a test behind them (Task 2, steps 1 and 9):
`columnFit` measures the resolved list and never the slice, and a dropped column leaves
nothing behind for a keyboard or a screen reader to find.

- [ ] **Step 5: Run the register gate**

Run: `npm run docs`
Expected: PASS. It checks the hierarchy, the sibling orders, every wikilink, every
source path a current note names, the use-case shape and the ADR frontmatter — and that
every module in `src/` is specified somewhere.

- [ ] **Step 6: Commit**

```bash
git add docs src/view/CLAUDE.md
git commit -m "docs: the register says the columns are the properties menu"
```

---

### Task 6: The whole gate

- [ ] **Step 1: Run it**

Run: `npm run check`
Expected: all five steps pass.

- [ ] **Step 2: Raise the coverage floor if the change earned it**

If `vitest run --coverage` reports higher numbers than `vitest.config.mts` declares,
raise the thresholds to what the suite now delivers. They only ever go up. If a number
went DOWN, find the branch that lost its test rather than lowering the floor — the most
likely candidate is a deleted chip path whose test went with the markup it asserted.

- [ ] **Step 3: Check the bundle still builds for a vault**

Run: `npm run test-build`
Expected: it bundles into `.obsidian/plugins/<id>/`. Say in the PR that this repository
can be opened as a vault and `docs/Product Backlog.base` opened in it, which is the
live-vault check this change owes: whether a chip in the middle of the strip looks
right, and whether the properties menu's own ordering UI behaves as assumed against a
real Bases build. Neither is answerable here.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "chore: raise the coverage floor to what the suite now delivers"
git push -u origin claude/tree-view-base-properties-zkyydc
```

---

## Self-review notes

- **Spec coverage.** Column model → Task 1 steps 3–5. Rendering → Task 1 steps 6–8, 10.
  Narrowing → Task 2. Deletions → Task 1 steps 9, 11, 12 and Tasks 2–3. First-run gap →
  Task 4. Checks → the test steps in Tasks 1–3. Docs → Task 5. Out-of-scope items appear
  in no task, which is correct.
- **Three things the spec got wrong first, all in the narrowing.** (1) The rollup's hide
  class and the two places countering it on cards cannot all go — the rollup is the one
  column not dropped by count, so `pbl-hide-meta` is its only mechanism; Task 2 narrows
  them instead of deleting them. (2) A render that rewrites the fitted count destroys the
  verdict the fit is about to compare against, buying a second full render on every
  refresh of a narrow pane. (3) Clipping the columns past `k` with `overflow: hidden`
  leaves them focusable and in the accessibility tree, which the `display: none` ladder
  they replace did not — so they are not rendered instead, which also disposes of (2) by
  removing the variable entirely. All three were found in review on the spec and are
  corrected there.
- **Task 1 step 9 is the seam to watch.** `columnFit` still compiles against constants
  the same step deletes, so the build is only green once its three chip terms go —
  which makes the verdict WRONG until Task 2 rewrites it. The two tasks land on one
  branch for that reason; do not ship Task 1 alone.
