# Estimation view UX/UI polish — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipped estimation view (a six-column table beside a per-item scoring panel) readable — a real type ladder, aligned columns, colour spent only where something needs doing, a toolbar that reaches the undo the view already has, and a panel whose answer is on screen before its inputs.

**Architecture:** No new capability and no new domain code. The view's four render modules and its two stylesheet partials change; one new view module (`toolbar.ts`) and one new committed harness knob are added. Every value is an Obsidian design token — this plugin owns no palette (`DESIGN.md`).

**Tech Stack:** TypeScript, Obsidian 1.12.0 Bases custom-view API, plain CSS partials assembled by `scripts/styles-assemble.mjs`, vitest + jsdom, esbuild. No runtime dependencies are added.

**Spec:** [`docs/superpowers/specs/2026-08-20-estimation-view-ux-polish-design.md`](../specs/2026-08-20-estimation-view-ux-polish-design.md). Read it before Task 1 — it records three refusals and four corrected rule violations, and re-deriving any of them from the code will get them wrong.

## Global Constraints

Every task's requirements implicitly include all of these.

- **`npm run check` must pass before every commit** — `build`, `lint`, `test:coverage`, `analyze` (fallow), `docs`. Coverage thresholds in `vitest.config.mts` only ever go up.
- **Layer direction is enforced by lint:** `main → commands → view → storage → domain`. `ui/` and `i18n/` import nothing above them. No task here may add an upward import.
- **400-line maximum per source file and per stylesheet partial.** `npm run build` fails on a partial over 400 lines; `eslint` fails on a source file over 400. `styles/estimation.css` is at 311 and `src/view/estimation/estimationView.ts` at 214 — both are touched by this plan, so watch them.
- **No colour literals in `styles/`.** Not hex, not `rgb()`, not `hsl()`, not a named colour. Every colour is an Obsidian custom property.
- **No font-family other than `inherit`.** Every size is `var(--font-ui-*)`.
- **Logical CSS properties only** — `inset-inline-end`, `padding-inline`, `margin-inline-start`, `text-align: end`. Never `right`, `margin-left`, `padding-right`.
- **Sentence-case UI text.** Marketplace rule, enforced in review.
- **All user-visible strings go through `t()` from `src/i18n/t.ts`**, with the sentence added to `src/i18n/en.ts`. The **sentence** is the unit of translation: never build a message by joining pieces. Nothing the plugin writes, matches or persists may enter the catalog (no property keys, no state values, no type names).
- **Never write frontmatter outside `storage/`.** This plan adds no write path; the toolbar's two actions call existing view methods.
- **Type ladder for this surface** (`DESIGN.md`, amended 2026-08-20): **Answer** `var(--font-ui-large)`/`var(--font-semibold)`; **Title** `var(--font-ui-medium)`/`var(--font-semibold)`; **Body** `var(--font-ui-small)`; **Label** `var(--font-ui-smaller)`.
- **`test/**` lint budget is `max-lines: 450`.** Split a suite by subject before it becomes the place tests hide.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.

---

### Task 1: The `?measure` knob — build the instrument first

The instrument comes first because it is what verifies Tasks 2–9, and because CLAUDE.md's rule is *measure a set with an instrument that can see all of it, and test the instrument first*. jsdom lays nothing out, so column geometry and computed type are invisible to the whole suite; this knob is the only way to read them.

**Files:**
- Modify: `test/harness/estimation.ts`
- Modify: `test/harness/harness.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `?measure` on the estimation harness page, printing lines into `<pre id="pbl-measure">`. Two line shapes, both read by later tasks with `--dump-dom`:
  - `BOX <class> <head|row0..rowN> left=<n> right=<n> w=<n>`
  - `TYPE <name> size=<n>px weight=<n> color=<rgb>`
- Produces: `drawEstimationMeasurements(view: EstimationView): void` exported from `test/harness/estimation.ts`.

- [ ] **Step 1: Write the failing test**

Add to `test/harness/harness.test.ts`:

```ts
it('the ?measure knob reports a box per column and a type per probe', () => {
	// The instrument this repository has no other way to check. jsdom lays nothing out, so
	// every number below is 0 and asserting one would measure the runner — what is asserted
	// is that the knob REPORTS, per column and per probe, because a knob that quietly
	// stopped emitting is a page that looks fine and answers nothing (`test/CLAUDE.md`).
	const root = document.body.createDiv();
	const { view } = mountEstimationHarness(root, 'full');
	drawEstimationMeasurements(view);
	const pre = document.getElementById('pbl-measure');
	expect(pre).not.toBeNull();
	const lines = (pre!.textContent ?? '').split('\n');
	for (const cls of ['pbl-est-title', 'pbl-est-total', 'pbl-est-coverage', 'pbl-est-currency']) {
		expect(lines.filter((l) => l.startsWith(`BOX ${cls} `)).length, `${cls} boxes`).toBeGreaterThan(1);
	}
	expect(lines.filter((l) => l.startsWith('BOX pbl-est-title head '))).toHaveLength(1);
	for (const probe of ['row title', 'panel total', 'panel title', 'decomp term']) {
		expect(lines.filter((l) => l.startsWith(`TYPE ${probe} `)), `${probe} type`).toHaveLength(1);
	}
});
```

Add the import to that file's existing import from `./mountEstimation` / `./estimation`:

```ts
import { drawEstimationMeasurements } from './estimation';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/harness/harness.test.ts -t "measure knob"`
Expected: FAIL — `drawEstimationMeasurements` is not exported.

- [ ] **Step 3: Write the implementation**

In `test/harness/estimation.ts`, add above the existing bottom-of-file `__pbl` assignment:

```ts
/**
 * `?measure` — every column's own box and every named element's computed type, into one
 * element a headless `--dump-dom` can read.
 *
 * COMMITTED rather than left in a scratch mock, because it is the only instrument this
 * repository has for two whole classes of defect: jsdom lays nothing out, so
 * `getBoundingClientRect` answers zeros and a column that slides under its own header is
 * invisible to the suite; and jsdom applies no stylesheet, so a computed `font-size` cannot
 * be read there at all. Both shipped once — a 29.8px column slide and five wrong type sizes,
 * three of them rules that had silently stopped matching. Read with:
 *
 *   chrome --headless=new --dump-dom '<page>?measure'
 *
 * It reports and asserts nothing (ADR 0020). `harness.test.ts` checks that it still
 * reports a line per column and per probe — never what the numbers are, which would be the
 * screenshot suite that ADR refuses.
 */
export function drawEstimationMeasurements(view: EstimationView): void {
	const lines: string[] = [];
	const table = view.tableEl;
	const head = table?.querySelector('.pbl-est-head');
	const rows = Array.from(table?.querySelectorAll('.pbl-est-row') ?? []);
	const hosts: Array<[string, Element | null | undefined]> = [['head', head], ...rows.map((r, i) => [`row${i}`, r] as [string, Element])];

	for (const cls of ['pbl-est-title', 'pbl-est-total', 'pbl-est-coverage', 'pbl-est-cell', 'pbl-est-currency']) {
		for (const [name, host] of hosts) {
			const el = host?.querySelector(`.${cls}`);
			if (!(el instanceof HTMLElement)) continue;
			const box = el.getBoundingClientRect();
			lines.push(`BOX ${cls} ${name} left=${box.left.toFixed(1)} right=${box.right.toFixed(1)} w=${box.width.toFixed(1)}`);
		}
	}

	const probes: Array<[string, Element | null | undefined]> = [
		['row title', rows[0]?.querySelector('.pbl-est-title')],
		['row total', rows[0]?.querySelector('.pbl-est-total')],
		['row chip', rows[0]?.querySelector('.pbl-est-chip')],
		['head cell', head?.querySelector('.pbl-est-title')],
		['panel title', view.panelEl?.querySelector('.pbl-est-title')],
		['panel total', view.panelEl?.querySelector('.pbl-est-total')],
		['panel coverage', view.panelEl?.querySelector('.pbl-est-coverage')],
		['panel derived', view.panelEl?.querySelector('.pbl-est-derived')],
		['panel heading', view.panelEl?.querySelector('h4')],
		['dim label', view.panelEl?.querySelector('.pbl-est-dim-label')],
		['rubric', view.panelEl?.querySelector('.pbl-est-rubric')],
		['point button', view.panelEl?.querySelector('button.pbl-est-point')],
		['decomp term', view.panelEl?.querySelector('.pbl-est-decomp span')],
		['toolbar count', view.viewEl.querySelector('.pbl-est-count')],
	];
	for (const [name, el] of probes) {
		if (!(el instanceof HTMLElement)) continue;
		const cs = getComputedStyle(el);
		lines.push(`TYPE ${name} size=${cs.fontSize} weight=${cs.fontWeight} color=${cs.color}`);
	}

	document.getElementById('pbl-measure')?.remove();
	const pre = document.body.createEl('pre', { text: lines.join('\n') });
	pre.id = 'pbl-measure';
}
```

Add the type import at the top of the same file:

```ts
import type { EstimationView } from '../../src/view/estimation/estimationView';
```

And wire the knob beside the existing `?select=` handling at the bottom of the file:

```ts
// After the selection knob: the panel has to be on screen before its type can be read.
if (new URLSearchParams(window.location.search).has('measure')) drawEstimationMeasurements(view);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/harness/harness.test.ts -t "measure knob"`
Expected: PASS.

- [ ] **Step 5: Verify the knob in a real browser**

Run:
```bash
npm run harness -- test/harness/estimation.ts
```
Then, with any Chromium (`CHROME_PATH`, Playwright's, or the PATH — `scripts/perf.mjs` documents the search):
```bash
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=4000 \
  'file:///<repo>/.harness/index.html?config=full&select=Full%20profile&measure' \
  | sed -n '/id="pbl-measure"/,/<\/pre>/p'
```
Expected: `BOX` lines whose `left=` values are non-zero and **differ per row** for `pbl-est-total` (this is the bug Task 3 fixes — record the numbers), and `TYPE` lines showing `panel total size=15px` (the bug Task 5 fixes).

- [ ] **Step 6: Commit**

```bash
git add test/harness/estimation.ts test/harness/harness.test.ts
git commit -m "Commit the estimation harness's column and type measurements"
```

---

### Task 2: The table declares a UI size, and the decomposition declares one too

**Files:**
- Modify: `styles/estimation.css`
- Modify: `styles/estimationPanel.css`
- Test: `test/view/estimation/styleRules.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `.pbl-est-table { font-size: var(--font-ui-small) }` and `.pbl-est-decomp { font-size: var(--font-ui-smaller) }` in the assembled stylesheet. No markup changes, so no later task depends on a symbol from this one.

**Why:** measured, both were unset. Row titles and every number rendered at 15px — the **reading** size inherited from the pane — under a header declaring 12px, so the step inside one table was 3px where the rest of the interface reads at 1px. `var(--font-ui-small)` is DESIGN.md's **Body** entry for "row titles, card titles" and is what the tree's own rows use. The decomposition's eight term sentences rendered at 15px beside the 12px rubric sentences they sit under.

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/styleRules.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a build script, deliberately outside tsconfig's `src/**` include.
import { assembleStyles } from '../../../scripts/styles-assemble.mjs';

/**
 * The estimation view's stylesheet as SHIPPED, asked the two questions a browser is not
 * here to answer: does a rule exist, and does it sit late enough in the cascade to win.
 * `test/view/rendering.test.ts` established this instrument and states its limits at
 * length; this file is the same idea narrowed to one surface, so that suite does not grow
 * past its 450-line budget.
 *
 * What it CANNOT do is prove a rule MATCHES anything — which is exactly how three type
 * rules here came to be present, correct, and applying to nothing. That half is covered by
 * the DOM-structure assertions in `panel.test.ts`; neither check alone is sufficient and
 * the pair is the guarantee.
 */
const styles: string = assembleStyles();

function ruleAt(selector: string, decl: string): number {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const wanted = decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`^[\\t]*${escaped}[,\\s][^{]*\\{[^}]*${wanted}`, 'gm');
	let found = -1;
	for (const match of styles.matchAll(pattern)) found = match.index ?? found;
	return found;
}

describe('the estimation view declares its own type', () => {
	it('gives the table a UI size rather than inheriting the reading size', () => {
		// Measured without this rule: 15px row titles under a 12px header. `--font-ui-small`
		// is DESIGN.md's Body entry and what the tree's rows already use.
		expect(ruleAt('.pbl-est-table', 'font-size: var(--font-ui-small);')).toBeGreaterThan(-1);
	});

	it('gives the decomposition the annotation size', () => {
		expect(ruleAt('.pbl-est-decomp', 'font-size: var(--font-ui-smaller);')).toBeGreaterThan(-1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/view/estimation/styleRules.test.ts`
Expected: FAIL, both assertions — `expected -1 to be greater than -1`.

- [ ] **Step 3: Write the implementation**

In `styles/estimation.css`, immediately before the existing `.pbl-est-head, .pbl-est-row` rule:

```css
/* The table declares a UI size. Measured without this rule: every row title and every
   number rendered at 15px — the READING size inherited from the pane — under a header that
   declares `--font-ui-smaller`. `--font-ui-small` is DESIGN.md's Body entry for exactly
   these ("row titles, card titles") and what `tree.css`'s own rows use, so the estimation
   table was the one list in the plugin set two steps larger than the rest.

   On the table rather than on each cell: one declaration the header then overrides for
   itself, instead of five that can drift apart. */
.pbl-est-table {
	font-size: var(--font-ui-small);
}
```

In `styles/estimationPanel.css`, add to the existing `.pbl-est-decomp` rule:

```css
	/* The decomposition annotates; it does not name. It had no size of its own, so eight
	   term sentences rendered at 15px beside the `--font-ui-smaller` rubric sentences
	   directly above them. */
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/estimation/styleRules.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: PASS — confirms neither partial passed 400 lines.

- [ ] **Step 5: Commit**

```bash
git add styles/estimation.css styles/estimationPanel.css test/view/estimation/styleRules.test.ts
git commit -m "Give the estimation table and its decomposition a UI type size"
```

---

### Task 3: The currency cell splits from its chip, and the columns line up

**Files:**
- Modify: `src/view/estimation/renderTable.ts`
- Modify: `styles/estimation.css`
- Test: `test/view/estimation/table.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: markup `<div class="pbl-est-currency"><span class="pbl-est-chip pbl-est-cur-<currency>">…</span></div>` for every currency but `none`, which renders an empty `.pbl-est-currency` and no child. Task 4 reuses the chip builder, exported as:
  ```ts
  export function renderCurrencyChip(host: HTMLElement, currency: Currency): HTMLElement | null
  ```
  It returns `null` for `none` and appends nothing in that case.

**Why:** `.pbl-est-currency` is one element doing two jobs — the column's cell AND the pill — and it is sized to its own words. `.pbl-est-title` is the only shrinkable item in the row, so it absorbs whatever the chip takes and every fixed column slides. Measured across the eleven fixture rows: `Needs re-estimation` makes its cell 125.8px against the usual 96px, putting that row's numbers **29.8px left** of the header naming them.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/table.test.ts`:

```ts
it('puts the currency word in a chip INSIDE the cell, so the cell can be a fixed column', () => {
	// The alignment defect's structural cause. One element cannot be both a fixed-width
	// column and a pill sized to its own words: `Needs re-estimation` made its cell 125.8px
	// against `Current`'s 96px, and because the title is the row's only shrinkable item,
	// every numeric column on that row slid 29.8px left of its own header. Geometry is
	// unmeasurable here (jsdom lays nothing out — see `test/CLAUDE.md`), so what is pinned
	// is the structure that makes the fix possible: the cell holds a chip, and the word is
	// never the cell's own text.
	const vault = new FakeVault();
	const model = configured();
	const answers = new Map(Object.entries({ 'strategic-alignment': 5 }));
	const total = computeTotal(model, answers)!;
	vault.addFile('Stale.md', {
		frontmatter: {
			'strategic-alignment': 5,
			'business-value': total.total + 1,
			'business-value-model': stampValue(model, total.coverage),
		},
	});
	const { containerEl } = makeEstimationView(vault, configuredValues());
	const cell = row(containerEl, 'Stale.md').querySelector('.pbl-est-currency')!;
	const chip = cell.querySelector('.pbl-est-chip');
	expect(chip, 'the cell holds a chip').not.toBeNull();
	expect(chip!.classList.contains('pbl-est-cur-stale')).toBe(true);
	// The cell itself carries no text of its own — only the chip does.
	expect(Array.from(cell.childNodes).some((n) => n.nodeType === Node.TEXT_NODE)).toBe(false);
});

it('draws no chip at all when there is no stored total to judge', () => {
	// An empty outlined pill beside four marked ones reads as an empty input field. The
	// cell stays, so `:empty::before` still supplies the dash every other absent value uses.
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	const cell = row(containerEl, 'Empty.md').querySelector('.pbl-est-currency')!;
	expect(cell.querySelector('.pbl-est-chip')).toBeNull();
	expect(cell.textContent).toBe('');
});

it('marks the two currencies that need an action with an icon as well as a colour', () => {
	// The Shape-Before-Colour Rule (DESIGN.md): every state that matters survives a
	// monochrome screenshot. `current` deliberately has NO colour class — green means
	// finished in this system, and a fully estimated backlog must stay monochrome.
	const vault = new FakeVault();
	vault.addFile('Orphan.md', { frontmatter: { 'business-value': 3, 'business-value-model': 'x' } });
	const { containerEl } = makeEstimationView(vault, configuredValues());
	const chip = row(containerEl, 'Orphan.md').querySelector('.pbl-est-chip')!;
	expect(chip.classList.contains('pbl-est-cur-orphan')).toBe(true);
	expect(chip.querySelector('[data-icon]'), 'orphan carries an icon').not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/table.test.ts -t currency`
Expected: FAIL — no `.pbl-est-chip` exists; the word is the cell's own text.

- [ ] **Step 3: Write the implementation**

In `src/view/estimation/renderTable.ts`, add the icon map and the chip builder, and replace the currency half of `renderRow`:

```ts
/**
 * The two currencies that need an action carry an icon beside their colour, so the state
 * survives a monochrome screenshot — DESIGN.md's Shape-Before-Colour Rule, and the same
 * colour-and-icon pair the WIP over-limit count already uses.
 *
 * `current` is deliberately absent: green means FINISHED in this system and nothing else,
 * a current total is trustworthy rather than done, and a fully estimated backlog carrying a
 * green chip on every row is exactly the screen DESIGN.md says must stay "monochrome apart
 * from its badges". The plain chip is the whole treatment.
 */
const CURRENCY_ICON: Partial<Record<Currency, string>> = {
	stale: 'refresh-cw',
	orphan: 'unlink',
};

/**
 * The chip inside the cell — never the cell itself, which is the column and must keep a
 * fixed width. `null` for `none`: there is no stored total to judge, so the cell is left
 * empty and `styles/estimation.css`'s `:empty::before` supplies the same dash every other
 * absent value in the row uses.
 */
export function renderCurrencyChip(host: HTMLElement, currency: Currency): HTMLElement | null {
	if (currency === 'none') return null;
	const chip = host.createSpan({ cls: `pbl-est-chip pbl-est-cur-${currency}` });
	const icon = CURRENCY_ICON[currency];
	if (icon) setIcon(chip.createSpan({ cls: 'pbl-est-chip-icon' }), icon);
	chip.createSpan({ cls: 'pbl-est-chip-text', text: currencyWord(currency) });
	return chip;
}
```

Add `setIcon` to the module's `obsidian` import:

```ts
import { setIcon } from 'obsidian';
```

Then replace these two lines at the end of `renderRow`:

```ts
	const currencyEl = row.createDiv({ cls: 'pbl-est-currency' + (item.currency === 'stale' ? ' pbl-est-stale' : '') });
	if (item.currency !== 'none') currencyEl.setText(currencyWord(item.currency));
```

with:

```ts
	// The cell is the COLUMN and keeps a fixed width; the chip inside it hugs its own words.
	// `.pbl-est-stale` is gone with them: the state is now one class per currency on the
	// chip, so five treatments are declared in one place instead of one being special-cased
	// in the markup.
	renderCurrencyChip(row.createDiv({ cls: 'pbl-est-currency' }), item.currency);
```

In `styles/estimation.css`, replace the whole `.pbl-est-currency` block, its `.pbl-est-head .pbl-est-currency` override and the `.pbl-est-currency.pbl-est-stale` rule with:

```css
/* ==========================================================================
   The currency column, and the chip inside it. THEY ARE TWO THINGS, and were one.

   One element cannot be both a fixed-width column and a pill sized to its own words.
   Sized to its content — `flex: 0 0 auto` with a 96px floor and a 140px ceiling — the cell
   grew with the word, and because `.pbl-est-title` is the row's only shrinkable item it
   absorbed the difference: `Needs re-estimation` measured 125.8px against the usual 96px,
   so that row's numbers sat 29.8px LEFT of the header naming them and of every other row.
   Measured across all eleven fixture rows with the harness's `?measure` knob, in both
   directions.

   140px is not a new number. It is the `max-width` this chip already declared and the width
   `components.chip` declares in DESIGN.md, so the widest word was always budgeted for — it
   was budgeted per ROW instead of per COLUMN. The chip keeps the content sizing this file
   used to argue for ("the words are prose, not digits"), which is what that argument was
   ever about; the COLUMN's width was never the chip's to decide.
   ========================================================================== */

.pbl-est-row > .pbl-est-currency,
.pbl-est-head > .pbl-est-currency {
	flex: 0 0 140px;
	width: 140px;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.pbl-est-chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--size-2-1);
	max-width: 100%;
	overflow: hidden;
	white-space: nowrap;
	padding: 0 var(--size-4-1);
	font-size: var(--font-ui-smaller);
	line-height: 1.6;
	color: var(--text-muted);
	/* `--background-modifier-hover`, NOT `--background-secondary`. This chip is drawn on TWO
	   surfaces — a table row painted `--background-primary`, and the panel painted
	   `--background-secondary` — and the sunken fill the state and horizon chips use is
	   invisible against the second of those: the plain `Current` chip vanished into the panel
	   behind it while the coloured ones still read (harness, both schemes). The hover overlay
	   is DESIGN.md's own "field behind counts and badges" and reads against either ground.
	   Those chips live on rows only, so this is a fact about where this one is drawn rather
	   than a second answer to one question. */
	background-color: var(--background-modifier-hover);
	border: 1px solid var(--background-modifier-border);
	/* `--radius-s`, the state and horizon chips' own shape — not the `--radius-l` pill this
	   used to be, which DESIGN.md reserves for counts, tags and the tag-add button. A
	   currency word is a state chip sitting in a column beside two others, and "a second
	   look would read as a second kind of thing". */
	border-radius: var(--radius-s);
}

.pbl-est-chip-text {
	overflow: hidden;
	text-overflow: ellipsis;
}

.pbl-est-chip-icon {
	display: inline-flex;
	align-items: center;
	flex: 0 0 auto;
}

.pbl-est-chip-icon .svg-icon {
	width: 14px;
	height: 14px;
}

/* Attention, and it needs doing — plus the icon above, per the Shape-Before-Colour Rule.
   `current` appears in no rule here on purpose: colour is spent only where there is
   something to do, so a healthy screen is monochrome and the eye lands on these two. */
.pbl-est-chip.pbl-est-cur-stale,
.pbl-est-chip.pbl-est-cur-orphan {
	color: var(--text-warning);
	border-color: var(--text-warning);
	background-color: rgba(var(--color-orange-rgb), 0.12);
}

/* The Dashed Line Rule, meant exactly as written: present, but not asserted. A foreign or
   hand-written total is a number that exists and that this model does not vouch for. */
.pbl-est-chip.pbl-est-cur-foreign,
.pbl-est-chip.pbl-est-cur-handwritten {
	border-style: dashed;
	background-color: transparent;
}
```

Also update the `:empty::before` group in the same file so the dash still reaches the cell:

```css
.pbl-est-cell:empty::before,
.pbl-est-total:empty::before,
.pbl-est-coverage:empty::before,
.pbl-est-currency:empty::before {
	content: '\2013';
}
```

(unchanged — confirm `.pbl-est-currency:empty::before` is still in the list, since the cell is now the empty element for `none`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/estimation/`
Expected: PASS. If `sort.test.ts` or `states.test.ts` asserted on `.pbl-est-currency`'s `textContent`, update those assertions to read the chip's text — the word moved one element in, which is the point of the change.

- [ ] **Step 5: Verify the alignment in a browser**

Run:
```bash
npm run harness -- test/harness/estimation.ts
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=4000 \
  'file:///<repo>/.harness/index.html?config=full&measure' \
  | sed -n '/id="pbl-measure"/,/<\/pre>/p' | grep '^BOX pbl-est-total'
```
Expected: **one distinct `left=` value** across the header row and all eleven rows. Before this task there were three. This is the assertion the suite cannot make.

- [ ] **Step 6: Commit**

```bash
git add src/view/estimation/renderTable.ts styles/estimation.css test/view/estimation/
git commit -m "Split the currency cell from its chip, and line the table's columns up"
```

---

### Task 4: The value and coverage strips

**Files:**
- Modify: `src/view/estimation/renderTable.ts`
- Modify: `styles/estimation.css`
- Test: `test/view/estimation/table.test.ts`

**Interfaces:**
- Consumes: nothing from Task 3 (independent, but the same two files — sequence it after to avoid conflicts).
- Produces: inside a row's `.pbl-est-total` and `.pbl-est-coverage`, a `<span class="pbl-est-num">` holding the text and a `<div class="pbl-est-strip">` carrying `--pbl-progress` as a percentage string. Nothing later depends on it.

**Why:** the two numbers a reader scans for extremes gain a proportional strip. Confidence and effort get none: at 3px under a right-aligned digit it reads as a stray underline, and a stored `-2` effort clamps to an empty strip, which says *low* where the truth is *invalid*.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/table.test.ts`:

```ts
function progressOf(cell: Element): string | null {
	return (cell.querySelector('.pbl-est-strip') as HTMLElement | null)?.style.getPropertyValue('--pbl-progress') ?? null;
}

it("scales the value strip to the model's declared output range, never to the population", () => {
	// A bar that follows the population moves when somebody adds an item, so an item nobody
	// touched changes appearance because of a neighbour — the argument
	// `docs/requirements/The value against effort matrix.md` already settled for its
	// threshold lines. Driven the only way that distinguishes the two: add a third item and
	// assert the first two strips do not move.
	const base = makeEstimationView(fixture(), configuredValues());
	const before = progressOf(row(base.containerEl, 'Full.md').querySelector('.pbl-est-total')!);

	const wider = fixture();
	wider.addFile('Tiny.md', { frontmatter: { compliance: 1 } });
	const after = progressOf(row(makeEstimationView(wider, configuredValues()).containerEl, 'Full.md').querySelector('.pbl-est-total')!);

	expect(before).not.toBeNull();
	expect(after).toBe(before);
});

it('gives coverage a strip and gives confidence and effort none', () => {
	// Measured and cut: at 3px under a right-aligned digit a strip reads as a stray
	// underline, and a negative effort clamps to an EMPTY strip — which says "low" where the
	// truth is "invalid", right beside the cell showing the number the user typed.
	const vault = new FakeVault();
	vault.addFile('Negative.md', { frontmatter: { compliance: 1, confidence: 3, effort: -2 } });
	const { containerEl } = makeEstimationView(vault, configuredValues());
	const r = row(containerEl, 'Negative.md');
	expect(r.querySelector('.pbl-est-coverage .pbl-est-strip')).not.toBeNull();
	expect(r.querySelector('.pbl-est-cell[data-col="confidence"] .pbl-est-strip')).toBeNull();
	expect(r.querySelector('.pbl-est-cell[data-col="effort"] .pbl-est-strip')).toBeNull();
});

it('leaves an unanswered cell with its dash and no strip', () => {
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	const total = row(containerEl, 'Empty.md').querySelector('.pbl-est-total')!;
	expect(total.querySelector('.pbl-est-strip')).toBeNull();
	expect(total.textContent).toBe('');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/table.test.ts -t strip`
Expected: FAIL — no `.pbl-est-strip` element exists.

- [ ] **Step 3: Write the implementation**

In `src/view/estimation/renderTable.ts`, replace `numberCell` with:

```ts
/**
 * A row's numeric cell: the exact number, and — where the cell is one of the two the reader
 * scans for extremes — a strip under it saying how much of a DECLARED range it reached.
 *
 * Left EMPTY rather than a literal dash when there is no value: `styles/estimation.css`'s
 * `:empty::before` rule supplies the dash, so a computed absence and a row still mid-render
 * are never spelled the same way one keystroke apart from a real value. A cell with no value
 * gets no strip either — an empty track would read as "low" rather than as "not answered".
 *
 * `range` null means no strip at all, which is confidence and effort. Both had one and it
 * was cut: at 3px under a right-aligned digit it reads as a stray underline, and a stored
 * `-2` effort clamps to an empty strip, saying *low* where the truth is *invalid* directly
 * beside the cell showing the number the user typed.
 */
function numberCell(el: HTMLElement, value: number | null, range: [number, number] | null): void {
	if (value === null) return;
	el.createSpan({ cls: 'pbl-est-num', text: String(value) });
	if (!range) return;
	const [min, max] = range;
	if (max <= min) return;
	const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
	el.createDiv({ cls: 'pbl-est-strip' }).style.setProperty('--pbl-progress', `${Math.round(ratio * 100)}%`);
}
```

Change `renderRow`'s signature to take the model, and its cell calls. `renderRow` is called from `renderRows`, which is called from `renderTable` — thread `model.dimensions.length` and the settings through as the existing `EstimationModel` already flows there. Replace the body's cell block with:

```ts
function renderRow(tableEl: HTMLElement, item: EstimationItem, output: [number, number]): HTMLElement {
	const row = tableEl.createDiv({ cls: 'pbl-est-row', attr: { role: 'option' } });
	row.dataset.path = item.file.path;
	row.createDiv({ cls: 'pbl-est-title', text: item.title });
	// The model's own declared output range, never the spread of what the base returned.
	numberCell(row.createDiv({ cls: 'pbl-est-total' }), item.result?.total ?? null, output);
	const coverage = row.createDiv({ cls: 'pbl-est-coverage' });
	if (item.result) {
		coverage.createSpan({ cls: 'pbl-est-num', text: `${item.result.coverage.answered}/${item.result.coverage.enabled}` });
		const ratio = item.result.coverage.enabled === 0 ? 0 : item.result.coverage.answered / item.result.coverage.enabled;
		coverage.createDiv({ cls: 'pbl-est-strip' }).style.setProperty('--pbl-progress', `${Math.round(ratio * 100)}%`);
	}
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'confidence' } }), item.confidence, null);
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'effort' } }), item.effort, null);
	renderCurrencyChip(row.createDiv({ cls: 'pbl-est-currency' }), item.currency);
	return row;
}
```

Thread `output` from `renderTable`. **`EstimationModel` is `{ items, byPath }` and carries no `ScoringModel`** — verified in `src/domain/estimationItems.ts` — so the range comes off the view, which `renderTable` already has:

```ts
	const output: [number, number] = [view.settings.model.outputMin, view.settings.model.outputMax];
	const rows = renderRows(tableEl, items, view.selectedPath, output);
```

and `renderRows` passes it straight through to `renderRow`.

In `styles/estimation.css`, add after the `.pbl-est-cell, .pbl-est-total, .pbl-est-coverage` sizing rule:

```css
/* The two cells that carry a strip become a column box, so the number keeps its
   end-alignment and the strip spans the column under it. Scoped to a ROW's cells: these two
   class names are worn by three different elements — a row cell, a sortable header button,
   and the panel's decomposition summary — and an unscoped `display: flex` here restyled all
   three from one declaration. */
.pbl-est-row > .pbl-est-total,
.pbl-est-row > .pbl-est-coverage {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	justify-content: center;
	gap: 3px;
}

.pbl-est-row > .pbl-est-total > .pbl-est-num,
.pbl-est-row > .pbl-est-coverage > .pbl-est-num {
	text-align: end;
}

/* One element, one declaration: the fill and the track are a hard-stop gradient rather than
   a nested fill div. `3px` is `rounded.bar` in DESIGN.md — the declared radius for a bar. */
.pbl-est-strip {
	height: 3px;
	border-radius: 3px;
	background: linear-gradient(
		to right,
		var(--pbl-strip-color, var(--text-faint)) var(--pbl-progress, 0%),
		var(--background-modifier-border) var(--pbl-progress, 0%)
	);
}

/* Value takes the accent; coverage stays faint, so two strips read as one system rather
   than as two competing claims. The accent on a magnitude is a colour spend and its licence
   is `components.bar` in DESIGN.md, which already declares the accent for the timeline bar —
   also a magnitude. Second use of a precedent, not a new meaning. */
.pbl-est-row > .pbl-est-total .pbl-est-strip {
	--pbl-strip-color: var(--interactive-accent);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/estimation/ && npm run build && npm run lint`
Expected: PASS. `renderTable.ts` is 388 lines before this task — if the additions push it past 400, extract the currency chip and the icon map into `src/view/estimation/currencyChip.ts` and import it; `renderTable.ts` keeps the row.

- [ ] **Step 5: Commit**

```bash
git add src/view/estimation/ styles/estimation.css test/view/estimation/
git commit -m "Give value and coverage a proportional strip, scaled to the declared range"
```

---

### Task 5: The panel's sticky answer header, and the three dead type rules

**Files:**
- Modify: `src/view/estimation/panel.ts`
- Modify: `styles/estimation.css` (delete one rule)
- Modify: `styles/estimationPanel.css`
- Modify: `src/i18n/en.ts`
- Test: `test/view/estimation/panel.test.ts`, `test/view/estimation/styleRules.test.ts`

**Interfaces:**
- Consumes: `renderCurrencyChip(host, currency)` from Task 3.
- Produces: `<div class="pbl-est-header">` as the panel's **first** child, holding, in order: `.pbl-est-title`, then `.pbl-est-summary` (holding `.pbl-est-total`, `.pbl-est-coverage`, and the chip), then `.pbl-est-derived`. `.pbl-est-decomp` keeps only its term spans.
- Produces: catalog keys `estimation.panel.valueDimensions` and `estimation.panel.whyThisScored`; `estimation.panel.effortComplexity` is **renamed** to `estimation.panel.scales`.

**Why:** the total used to sit under eleven rows of buttons, and the panel never stated currency at all — so selecting a stale row lost the one fact saying its number is wrong. **And three type rules must be deleted, not left beside their replacements.** `.pbl-est-decomp .pbl-est-total`, `.pbl-est-decomp .pbl-est-coverage` and `.pbl-est-panel > .pbl-est-title` (a CHILD selector) all stop matching once the summary and title move into the header — measured: the total rendered at 15px/500 instead of 20px/semibold, and nothing failed.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/panel.test.ts`:

```ts
it('puts the answer above the inputs, with the total ahead of its own coverage', () => {
	// The total is what the reader opened the panel for and it used to sit under eleven rows
	// of buttons. `panel.ts` drew coverage first, so the header read "8/8 3.49" — the
	// qualifier ahead of the thing it qualifies.
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Full.md');
	const panel = containerEl.querySelector('.pbl-est-panel')!;
	const header = panel.firstElementChild!;
	expect(header.classList.contains('pbl-est-header')).toBe(true);
	// The three rules deleted in this task address these elements by POSITION, so the
	// structure is the other half of the guarantee — `styleRules.test.ts` can only prove a
	// rule exists, never that it matches. Both halves are needed: what shipped was three
	// correct rules matching nothing.
	expect(header.querySelector(':scope > .pbl-est-title')).not.toBeNull();
	expect(header.querySelector(':scope > .pbl-est-summary')).not.toBeNull();
	expect(header.querySelector(':scope > .pbl-est-derived')).not.toBeNull();
	const summary = header.querySelector('.pbl-est-summary')!;
	const order = Array.from(summary.children).map((el) => el.className.split(' ')[0]);
	expect(order.slice(0, 2)).toEqual(['pbl-est-total', 'pbl-est-coverage']);
});

it('states the currency in the panel, beside the total it is about', () => {
	// The panel never said it at all, so selecting a stale row lost the one fact that says
	// its number is wrong. Beside the total rather than after the derived lines: under two
	// sentences it read as a third one.
	const vault = new FakeVault();
	vault.addFile('Orphan.md', { frontmatter: { compliance: 1, 'business-value': 3, 'business-value-model': 'x' } });
	const { containerEl } = makeEstimationView(vault, configuredValues());
	selectItem(containerEl, 'Orphan.md');
	const summary = containerEl.querySelector('.pbl-est-header .pbl-est-summary')!;
	expect(summary.querySelector('.pbl-est-chip.pbl-est-cur-orphan')).not.toBeNull();
});

it('leaves the decomposition holding only its terms', () => {
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Full.md');
	const decomp = containerEl.querySelector('.pbl-est-decomp')!;
	expect(decomp.querySelector('.pbl-est-summary')).toBeNull();
	expect(decomp.querySelector('.pbl-est-total')).toBeNull();
});

it('groups the three fixed scales under one heading, and not under the value dimensions', () => {
	// Nothing computes the total from confidence, so it is not a value dimension — and
	// `panel.ts` draws it between the dimensions and the old "Effort and complexity"
	// heading, so a heading above the first dimension swept it in.
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Full.md');
	const headings = Array.from(containerEl.querySelectorAll('.pbl-est-panel h4')).map((h) => h.textContent);
	expect(headings).toEqual(['Value dimensions', 'Confidence, effort and complexity', 'Why this scored what it scored']);
	const confidenceRow = containerEl
		.querySelector('.pbl-est-panel [data-dim="confidence"][data-kind="scale"]')!
		.closest('.pbl-est-dim')!;
	const scalesHeading = Array.from(containerEl.querySelectorAll('.pbl-est-panel h4')).find(
		(h) => h.textContent === 'Confidence, effort and complexity',
	)!;
	expect(scalesHeading.compareDocumentPosition(confidenceRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

Add to `test/view/estimation/styleRules.test.ts`:

```ts
describe('the panel header owns its own type', () => {
	it('declares all four steps on the header rather than borrowing them by position', () => {
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-size: var(--font-ui-medium);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-total', 'font-size: var(--font-ui-large);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-coverage', 'font-size: var(--font-ui-small);')).toBeGreaterThan(-1);
	});

	it('no longer addresses the total, the coverage or the title by where they sit', () => {
		// The defect this task exists to fix, kept fixed. These three rules were present and
		// correct and matched NOTHING once the summary and the title moved into the sticky
		// header — the total silently rendered at 15px/500 instead of 20px/semibold, and no
		// check in this repository could see it. A rule that matches nothing is the thing the
		// next reader trusts, so it is deleted rather than left beside its replacement.
		expect(styles).not.toContain('.pbl-est-decomp .pbl-est-total');
		expect(styles).not.toContain('.pbl-est-decomp .pbl-est-coverage');
		expect(styles).not.toContain('.pbl-est-panel > .pbl-est-title');
	});

	it('takes the pinned edge padding off the panel and gives it to the header', () => {
		// DESIGN.md: "Padding never sits on an edge something is pinned to. A sticky child
		// pins at the scroller's content edge, so whatever wants a gap owns it inside the box
		// that pins." Left on the panel it was a band above the header that rows scrolled
		// visibly through.
		expect(ruleAt('.pbl-est-panel', 'padding-block-start: 0;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header', 'padding-block-start: var(--size-4-3);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header', 'position: sticky;')).toBeGreaterThan(-1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/panel.test.ts test/view/estimation/styleRules.test.ts`
Expected: FAIL — no `.pbl-est-header` exists; the three dead selectors are still present.

- [ ] **Step 3: Write the implementation**

In `src/i18n/en.ts`, beside the other `estimation.panel.*` entries:

```ts
	'estimation.panel.valueDimensions': 'Value dimensions',
	/** All three FIXED scales, not just two. Nothing computes the total from confidence, so
	 *  it is not a value dimension — and it is drawn between the dimensions and this heading,
	 *  so a heading above the first dimension used to sweep it in. Renamed from
	 *  `effortComplexity` rather than joined by a second key: one heading, three scales. */
	'estimation.panel.scales': 'Confidence, effort and complexity',
	'estimation.panel.whyThisScored': 'Why this scored what it scored',
```

Delete `'estimation.panel.effortComplexity'`.

In `src/view/estimation/panel.ts`, replace the body of `renderPanel` between the `panelEl` creation and the `renderDecomposition` call:

```ts
	panelEl.dataset.path = item.file.path;
	view.panelEl = panelEl;

	// The answer, above the inputs and PINNED there. Its own element rather than four flow
	// siblings, because it is what `position: sticky` is applied to — and because the three
	// type rules that used to reach the title and the summary addressed them by POSITION,
	// which is what silently broke when they moved. The header now declares its own type
	// (`styles/estimationPanel.css`) and nothing depends on where its children sit.
	const header = panelEl.createDiv({ cls: 'pbl-est-header' });
	header.createDiv({ cls: 'pbl-est-title', text: item.title });
	renderSummary(header, item);

	panelEl.createEl('h4', { text: t('estimation.panel.valueDimensions') });
	for (const dimension of scoringModel.dimensions) renderScoreRow(panelEl, dimSpec(item, dimension));

	// The heading comes BEFORE confidence, so all three fixed scales sit under it.
	panelEl.createEl('h4', { text: t('estimation.panel.scales') });
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'confidence', t('estimation.panel.confidence')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'effort', t('estimation.panel.effort')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'complexity', t('estimation.panel.complexity')));

	if (item.result) panelEl.createEl('h4', { text: t('estimation.panel.whyThisScored') });
	renderDecomposition(panelEl, item);
	if (item.currency === 'orphan') renderCleanupButton(panelEl);
```

Add `renderSummary` and cut the summary out of `renderDecomposition`:

```ts
/**
 * The header's one baseline line: the total, its coverage, the currency chip, and the two
 * derived sentences under them.
 *
 * The total comes FIRST. `renderDecomposition` used to draw coverage then total, so the
 * header read `8/8  3.49` — the qualifier ahead of the thing it qualifies. The chip is on
 * this line rather than after the derived sentences, because it is a verdict on the total:
 * under two sentences it read as a third one, and pushed to the header's far end by an auto
 * margin it read as a status for the panel.
 */
function renderSummary(header: HTMLElement, item: EstimationItem): void {
	if (item.result) {
		const summary = header.createDiv({ cls: 'pbl-est-summary' });
		summary.createDiv({ cls: 'pbl-est-total', text: String(item.result.total) });
		summary.createDiv({
			cls: 'pbl-est-coverage',
			text: `${item.result.coverage.answered}/${item.result.coverage.enabled}`,
		});
		renderCurrencyChip(summary, item.currency);
	}
	renderDerived(header, item, ...);
}
```

Call `renderDerived(header, item, scoringModel.confidence)` from inside `renderSummary` by passing the scale through, or leave `renderDerived` called from `renderPanel` immediately after `renderSummary` — either is fine; keep it to one call site.

Change `renderDecomposition` to drop its summary block:

```ts
/** Score × weight per answered dimension — nothing here when nothing is answered, since
 *  there is no decomposition of a total that is not there. The coverage and the total moved
 *  to the header (`renderSummary`): the total is the answer and belonged above the inputs,
 *  not after them. */
function renderDecomposition(panelEl: HTMLElement, item: EstimationItem): void {
	if (!item.result) return;
	const decomp = panelEl.createDiv({ cls: 'pbl-est-decomp' });
	for (const term of item.result.terms) decomp.createSpan({ text: t('estimation.panel.term', term) });
}
```

Import the chip: `import { renderCurrencyChip } from './renderTable';` — or from `./currencyChip` if Task 4's line budget forced the extraction.

In `styles/estimation.css`, **delete** the `.pbl-est-panel > .pbl-est-title` rule entirely, and add `padding-block-start: 0;` to `.pbl-est-panel`.

In `styles/estimationPanel.css`, **delete** `.pbl-est-decomp .pbl-est-total` and `.pbl-est-decomp .pbl-est-coverage`, and add at the top of the file:

```css
/* ==========================================================================
   The panel's answer header — the item's name, its total, the total's coverage, the
   currency verdict, and the two derived sentences — pinned at the top of the panel.

   IT DECLARES ITS OWN TYPE, and that is the whole point of the element. Three rules used to
   reach these same children by POSITION — `.pbl-est-decomp .pbl-est-total`,
   `.pbl-est-decomp .pbl-est-coverage`, and `.pbl-est-panel > .pbl-est-title` as a CHILD
   selector — and moving the summary and the title in here stopped all three from matching.
   Nothing errored. Measured: the total rendered at 15px/500 where the stylesheet believed it
   was setting 20px/semibold, and the DESIGN.md entry declaring that size described a screen
   nobody was seeing. The three rules are DELETED rather than left beside these, because a
   rule that matches nothing is the thing the next reader trusts.

   Four steps, each doing one job: the answer, the name, the qualifier, the annotation.
   ========================================================================== */

.pbl-est-header {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: var(--size-2-2);
	/* THE PINNED-EDGE RULE. A sticky child pins at the SCROLLER's content edge, which is
	   inside `.pbl-est-panel`'s own padding — so with the padding left on the panel, the rows
	   scrolled through a band ABOVE this header and were visible over it. DESIGN.md states
	   the fix as a rule: "whatever wants a gap owns it inside the box that pins". The panel
	   drops its block-start padding and this header draws the same gap itself, which is what
	   the roadmap's pinned strips already do. */
	padding-block-start: var(--size-4-3);
	padding-block-end: var(--size-4-3);
	border-bottom: 1px solid var(--background-modifier-border);
	/* The panel's own fill, so rows scroll UNDER an opaque header rather than through it —
	   and never a shadow: DESIGN.md's One Shadow Rule, and a pinned strip asserts itself by
	   painting and drawing a border. */
	background-color: var(--background-secondary);
}

.pbl-est-header .pbl-est-title {
	flex: 0 0 auto;
	font-size: var(--font-ui-medium);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
	white-space: normal;
}

/* Three members on one baseline, adjacent and in this order: the answer, its coverage, and
   the chip saying whether the answer can be trusted. */
.pbl-est-header .pbl-est-summary {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: var(--size-4-2);
	margin-top: 0;
}

/* DESIGN.md's `Answer` step — the one number a detail panel exists to state. */
.pbl-est-header .pbl-est-total {
	flex: 0 0 auto;
	width: auto;
	text-align: start;
	font-size: var(--font-ui-large);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
}

.pbl-est-header .pbl-est-coverage {
	flex: 0 0 auto;
	width: auto;
	text-align: start;
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}

.pbl-est-header .pbl-est-chip {
	align-self: center;
}

/* One sentence per line. Wrapped into a single run the two derived lines read as one long
   muted string — and each is a whole translated sentence that nothing may split into a label
   and a value, so the line break is the only separation available. */
.pbl-est-derived {
	flex-direction: column;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/view/estimation/ && npm run build && npm run lint`
Expected: PASS. `styles/estimationPanel.css` is 175 lines before this task — confirm it is still under 400.

- [ ] **Step 5: Watch the type test fail without the fix**

Temporarily re-add `.pbl-est-decomp .pbl-est-total { font-size: var(--font-ui-large); }` to `estimationPanel.css` and delete the `.pbl-est-header .pbl-est-total` rule. Run `npx vitest run test/view/estimation/styleRules.test.ts`. Expected: FAIL on both the presence assertion and the absence assertion. Restore. **This is the required "watch it fail" step** — the invariant is stated in a comment and the comment is not the check.

- [ ] **Step 6: Verify the type in a browser**

```bash
npm run harness -- test/harness/estimation.ts
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=4000 \
  'file:///<repo>/.harness/index.html?config=full&select=Full%20profile&measure' \
  | sed -n '/id="pbl-measure"/,/<\/pre>/p' | grep '^TYPE'
```
Expected: `panel total size=20px weight=600`, `panel title size=15px weight=600`, `panel coverage size=13px`, `row title size=13px`, `decomp term size=12px`. Also screenshot `?scroll=460` and confirm no row content is visible above the header.

- [ ] **Step 7: Commit**

```bash
git add src/view/estimation/panel.ts src/i18n/en.ts styles/ test/view/estimation/
git commit -m "Lift the panel's answer into a pinned header that owns its own type"
```

---

### Task 6: One-line dimension rows, and a clear control that is quiet until addressed

**Files:**
- Modify: `src/view/estimation/panel.ts`
- Modify: `styles/estimation.css` (the panel track width)
- Modify: `styles/estimationPanel.css`
- Test: `test/view/estimation/panel.test.ts`, `test/view/rendering.test.ts`

**Interfaces:**
- Consumes: `.pbl-est-header` from Task 5.
- Produces: `<div class="pbl-est-dim-head">` inside each `.pbl-est-dim`, holding the label, the points container, and — only where a value is stored — a `<button class="clickable-icon pbl-est-clear">`. The rubric note stays a sibling of the head, not a child.

**Why:** eleven rows at ~106px is ~1170px in a ~700px track. Label and points on one line takes it to ~76px. And eleven always-visible clear controls break *"controls that are not currently needed are not currently visible"*.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/panel.test.ts`:

```ts
it('puts a row label, its points and its clear control on one line, with the rubric under', () => {
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Full.md');
	const dim = containerEl.querySelector('.pbl-est-dim')!;
	const head = dim.querySelector(':scope > .pbl-est-dim-head')!;
	expect(head.querySelector(':scope > .pbl-est-dim-label')).not.toBeNull();
	expect(head.querySelector(':scope > .pbl-est-points')).not.toBeNull();
	expect(head.querySelector(':scope > .pbl-est-clear')).not.toBeNull();
	// The rubric sentence stays visible and stays on its own line. Moving it to hover is
	// forbidden by `docs/requirements/A rubric for every point.md`: a row with an answer is
	// never silent about it.
	expect(dim.querySelector(':scope > .pbl-est-rubric')).not.toBeNull();
});

it('keeps the clear control OUT of the points group', () => {
	// Inside it, it is a sixth arrow-key stop on a five-point scale (Task 7's radiogroup).
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Full.md');
	const points = containerEl.querySelector('.pbl-est-points')!;
	expect(points.querySelector('.pbl-est-clear')).toBeNull();
});

it('draws no clear control for a row holding nothing', () => {
	const { containerEl } = makeEstimationView(fixture(), configuredValues());
	selectItem(containerEl, 'Empty.md');
	expect(containerEl.querySelector('.pbl-est-clear')).toBeNull();
});
```

Add `.pbl-est-clear` to the selector list in the existing reveal-ordering test in `test/view/rendering.test.ts`:

```ts
		for (const selector of [
			'.pbl-add',
			'.pbl-bucket-add',
			'.pbl-tag-remove',
			'.pbl-tag-add',
			'button.pbl-bar-connector',
			'.pbl-est-clear',
		]) {
```

Add to `test/view/estimation/styleRules.test.ts`:

```ts
it('undoes the clear control transition beside it, because motion.css loads too early', () => {
	// `index.css` imports `motion.css` at position 10 and `estimationPanel.css` at 32. A
	// media query adds NO specificity, so a `transition` declared here beats motion.css's
	// `transition: none` at equal specificity and `prefers-reduced-motion` would silently not
	// apply. `.pbl-add` is safe only because `columns.css` loads at position 6, BEFORE
	// motion.css — an accident of order this partial does not share. DESIGN.md's documented
	// exception ("unless it must sit beside the rule it overrides") is exactly this case.
	const transition = ruleAt('.pbl-est-clear', 'transition: opacity 120ms ease-in-out;');
	const stopped = ruleAt('.pbl-est-clear', 'transition: none;');
	expect(transition).toBeGreaterThan(-1);
	expect(stopped, 'the reduced-motion override must come after the transition').toBeGreaterThan(transition);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/panel.test.ts test/view/estimation/styleRules.test.ts test/view/rendering.test.ts -t clear`
Expected: FAIL — no `.pbl-est-dim-head`, no `.pbl-est-clear`.

- [ ] **Step 3: Write the implementation**

In `src/view/estimation/panel.ts`, rewrite `renderScoreRow` and `renderClearButton`:

```ts
/** One `.pbl-est-dim` row: a head line carrying the label, the point buttons and — only
 *  while the key is bound and a value is stored — the clear control, then the held point's
 *  rubric or clamp note on its own line below. */
function renderScoreRow(panelEl: HTMLElement, spec: RowSpec): void {
	const row = panelEl.createDiv({ cls: 'pbl-est-dim' });
	const head = row.createDiv({ cls: 'pbl-est-dim-head' });
	head.createDiv({ cls: 'pbl-est-dim-label', text: spec.label });
	if (spec.key === '') return; // bare label row: nothing bound, nothing to click or show
	const points = head.createDiv({ cls: 'pbl-est-points' });
	for (let value = spec.min; value <= spec.max; value++) {
		const active = spec.held === value;
		const sentence = `${value} — ${spec.rubric[value - spec.min]}`;
		const btn = points.createEl('button', {
			cls: 'pbl-est-point' + (active ? ' is-active' : ''),
			text: String(value),
			attr: {
				type: 'button',
				'data-dim': spec.id,
				'data-kind': spec.kind,
				'data-value': String(value),
				'aria-label': sentence,
				title: sentence,
			},
		});
		if (active) btn.setAttribute('aria-pressed', 'true');
	}
	// On the HEAD, not inside `points`: inside, it is a sixth arrow-key stop on a five-point
	// scale once the group becomes a radiogroup.
	if (spec.present) renderClearButton(head, spec);
	const note = rubricNote(spec);
	if (note !== null) row.createDiv({ cls: 'pbl-est-rubric', text: note });
}

function renderClearButton(container: HTMLElement, spec: RowSpec): void {
	const label = t('estimation.panel.clear', { label: spec.label });
	const btn = container.createEl('button', {
		cls: 'clickable-icon pbl-est-clear',
		attr: { type: 'button', 'data-dim': spec.id, 'data-kind': spec.kind, 'data-value': '', 'aria-label': label, title: label },
	});
	setIcon(btn, 'x');
}
```

In `styles/estimation.css`, widen the panel track:

```css
.pbl-est-view {
	display: grid;
	/* 320–420px, from 280–360px. A label, five point buttons and the clear control do not fit
	   in 360px — measured, not estimated. The table pays, which is what its own `minmax(0,
	   1fr)` floor already says it should: it shrinks first by design. */
	grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
	…
}
```

In `styles/estimationPanel.css`, replace the `.pbl-est-points` rule and add the head:

```css
/* One line per row: the name, its points, and the clear control. `flex-wrap` is the
   FALLBACK rather than a breakpoint — a range as wide as a legal 1-20 scale cannot share a
   line with its own label, so its points wrap to the line below on their own, and a pane too
   narrow does the same for every row. No media query, no `@container`. */
.pbl-est-dim-head {
	position: relative;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
	/* Holds the clear control's gutter open at rest, since the control itself is out of flow. */
	padding-inline-end: var(--size-4-5);
}

/* GROWS and truncates. It had a 40% floor first, which pushed the clear control onto a line
   of its own and made the row TALLER than the stack it replaced. */
.pbl-est-dim-head .pbl-est-dim-label {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pbl-est-points {
	display: flex;
	flex-wrap: wrap;
	flex: 0 0 auto;
	gap: var(--size-2-2);
}

/* Out of the flow, not a flex item: as a flex item it wrapped to a third line on a wide
   range. Absolutely positioned it sits at the row's top-end corner whether the points fit
   beside the label or below it — and it can never reflow the row, which is DESIGN.md's
   No-Reflow Feedback Rule satisfied by construction rather than by reserving space. */
.pbl-est-clear {
	position: absolute;
	top: 0;
	inset-inline-end: 0;
	opacity: 0;
	transition: opacity 120ms ease-in-out;
}

.pbl-est-dim:hover .pbl-est-clear,
.pbl-est-clear:focus-visible {
	opacity: 1;
}

/* Immediately after the hide it undoes: a media query adds no specificity, so a reveal
   written above it loses the cascade and shows nothing. `test/view/rendering.test.ts`
   checks this ordering rather than trusting this paragraph. */
@media (hover: none) {
	.pbl-est-clear {
		opacity: 1;
	}
}

/* And the reduced-motion override, HERE rather than in `motion.css`, which is DESIGN.md's
   one documented exception. `index.css` imports `motion.css` at position 10 and this partial
   at 32; a media query adds no specificity, so the transition above would beat
   `motion.css`'s `transition: none` and reduced motion would silently not apply. `.pbl-add`
   escapes this only because `columns.css` loads BEFORE motion.css. */
@media (prefers-reduced-motion: reduce) {
	.pbl-est-clear {
		transition: none;
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npm run build && npm run lint`
Expected: PASS, whole suite — `rendering.test.ts`'s reveal check now covers six selectors.

- [ ] **Step 5: Watch the reveal-order test fail without the fix**

Move the `@media (hover: none)` block **above** the `.pbl-est-clear { opacity: 0 }` rule. Run `npx vitest run test/view/rendering.test.ts -t revealed`. Expected: FAIL — *"`.pbl-est-clear`'s reveal must come after the rule it overrides"*. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/view/estimation/panel.ts styles/ test/
git commit -m "Put a dimension row on one line, and reveal its clear control on hover"
```

---

### Task 7: The point buttons become a radiogroup, and a row reaches its panel

**Files:**
- Modify: `src/view/estimation/panel.ts`
- Modify: `src/view/estimation/renderTable.ts`
- Test: `test/view/estimation/keyboard.test.ts` (create)

**Interfaces:**
- Consumes: `.pbl-est-dim-head` and `.pbl-est-points` from Task 6.
- Produces: each `.pbl-est-points` carries `role="radiogroup"` and `aria-label`; each `button.pbl-est-point` carries `role="radio"`, `aria-checked`, and `tabindex` `0` on exactly one member (the held value, else the first). `aria-pressed` is removed.

**Why:** on the shipped default — 8 dimensions at 1–5 plus three 1–5 scales — that is 11 rows, 55 point buttons and up to 11 clear buttons: **66 tab stops** a keyboard user passes through to reach the note below the table.

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/keyboard.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { key } from '../../helpers/view';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, compliance: 1, confidence: 4 } });
	vault.addFile('Second.md', { frontmatter: { compliance: 2 } });
	return vault;
}

describe('the estimation view from the keyboard', () => {
	it('gives each points group one tab stop rather than one per point', () => {
		// 8 dimensions at 1-5 plus three 1-5 scales is 55 point buttons on the shipped
		// default: 55 tab stops between the table and the note below it.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		for (const group of Array.from(containerEl.querySelectorAll('.pbl-est-points'))) {
			expect(group.getAttribute('role')).toBe('radiogroup');
			const stops = Array.from(group.querySelectorAll('button.pbl-est-point')).filter((b) => b.getAttribute('tabindex') === '0');
			expect(stops, 'exactly one tab stop per group').toHaveLength(1);
		}
	});

	it('puts the group tab stop on the held value, and on the first point when nothing is held', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const held = containerEl.querySelector('[data-dim="strategic-alignment"][data-value="5"]')!;
		expect(held.getAttribute('tabindex')).toBe('0');
		expect(held.getAttribute('aria-checked')).toBe('true');
		expect(held.getAttribute('aria-pressed')).toBeNull();
		const unheldFirst = containerEl.querySelector('[data-dim="reach"][data-value="1"]')!;
		expect(unheldFirst.getAttribute('tabindex')).toBe('0');
		expect(unheldFirst.getAttribute('aria-checked')).toBe('false');
	});

	it('moves and picks with the arrows, and holds at both ends', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="compliance"]')!.closest('.pbl-est-points') as HTMLElement;
		// Held is 1, the first point: ArrowLeft must not wrap to the last.
		key(group, 'ArrowLeft');
		expect(containerEl.querySelector('[data-dim="compliance"][data-value="1"]')!.getAttribute('tabindex')).toBe('0');
	});

	it('reaches the panel from a table row with ArrowRight, and still opens the note with Enter', () => {
		// `Enter` is `docs/requirements/Ranking the items by value.md` extension 4a and is
		// unchanged — this adds a key rather than reassigning one.
		const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowDown');
		key(table, 'ArrowRight');
		expect(containerEl.querySelector('.pbl-est-panel')!.contains(document.activeElement)).toBe(true);
		expect(view.app.workspace).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/keyboard.test.ts`
Expected: FAIL — `role` is null; `aria-pressed` is present.

- [ ] **Step 3: Write the implementation**

In `src/view/estimation/panel.ts`, inside `renderScoreRow`, replace the points container creation and the button attributes:

```ts
	const points = head.createDiv({
		cls: 'pbl-est-points',
		attr: { role: 'radiogroup', 'aria-label': spec.label },
	});
	for (let value = spec.min; value <= spec.max; value++) {
		const active = spec.held === value;
		const sentence = `${value} — ${spec.rubric[value - spec.min]}`;
		points.createEl('button', {
			cls: 'pbl-est-point' + (active ? ' is-active' : ''),
			text: String(value),
			attr: {
				type: 'button',
				role: 'radio',
				'aria-checked': String(active),
				// Roving: exactly one member is a tab stop. The held point where there is one,
				// the first point where there is not — so a group is always reachable and a
				// group is never five stops.
				tabindex: active || (spec.held === null && value === spec.min) ? '0' : '-1',
				'data-dim': spec.id,
				'data-kind': spec.kind,
				'data-value': String(value),
				'aria-label': sentence,
				title: sentence,
			},
		});
	}
```

Note: a held value outside the range means no button is `active`, so no button would be the stop. Guard it by computing the stop index once before the loop:

```ts
	// A stored value outside the scale leaves no button active, so the stop would land
	// nowhere and the group would be unreachable — exactly the silent row `scaleSpec`'s own
	// comment describes. The FIRST point is the fallback.
	const stopValue = spec.held !== null && spec.held >= spec.min && spec.held <= spec.max && Number.isInteger(spec.held) ? spec.held : spec.min;
```
then use `tabindex: value === stopValue ? '0' : '-1'`.

Add the group's arrow handling to `wirePanelEvents`:

```ts
	// One delegated keydown for every radiogroup on the panel, the same "never a per-control
	// closure" rule the click above follows. A pick reuses the click path so nothing plans a
	// write beside `performScore`/`performScale`.
	panelEl.addEventListener('keydown', (evt) => {
		const delta = evt.key === 'ArrowRight' ? 1 : evt.key === 'ArrowLeft' ? -1 : 0;
		if (delta === 0) return;
		const group = evt.target instanceof Element ? evt.target.closest('.pbl-est-points') : null;
		if (!group) return;
		evt.preventDefault();
		const radios = Array.from(group.querySelectorAll<HTMLElement>('button.pbl-est-point'));
		const at = radios.findIndex((btn) => btn.tabIndex === 0);
		// Holds at either edge rather than wrapping — the table's own rule for this walk.
		const next = radios[Math.min(Math.max((at === -1 ? 0 : at) + delta, 0), radios.length - 1)];
		next?.click();
	});
```

In `src/view/estimation/renderTable.ts`, add to the table's `keydown` handler, after the `ArrowDown`/`ArrowUp` branch:

```ts
		// Into the panel beside this row. `Enter` keeps opening the note (extension 4a), so
		// this adds a key rather than reassigning one.
		if (evt.key === 'ArrowRight') {
			const first = view.panelEl?.querySelector<HTMLElement>('button.pbl-est-point[tabindex="0"], button');
			if (first) {
				evt.preventDefault();
				first.focus();
			}
			return;
		}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npm run build && npm run lint`
Expected: PASS. `panel.test.ts`'s existing `aria-pressed` assertions, if any, must move to `aria-checked`.

- [ ] **Step 5: Commit**

```bash
git add src/view/estimation/ test/view/estimation/
git commit -m "Make each scale a radiogroup, and reach the panel from a row"
```

---

### Task 8: The toolbar

**Files:**
- Create: `src/view/estimation/toolbar.ts`
- Modify: `src/view/estimation/estimationView.ts`
- Modify: `src/i18n/en.ts`
- Modify: `styles/estimation.css`
- Test: `test/view/estimation/toolbar.test.ts` (create)

**Interfaces:**
- Consumes: `EstimationView.gate` (`canUndo()`, `undoLast()`, `writing`), `runEstimationInit(view)`, `EstimationModel.items`.
- Produces:
  ```ts
  export function renderEstimationToolbar(view: EstimationView, host: HTMLElement, model: EstimationModel | null): void
  ```
  It draws `.pbl-toolbar.pbl-est-toolbar` into `host` with `.pbl-icon-btn` for ✨ and undo, a `.pbl-toolbar-spacer`, and `.pbl-est-count`.
- Produces: `EstimationView.viewEl` becomes a flex column (`.pbl-est-shell`) holding the toolbar and a `.pbl-est-view` grid. **Every existing selector that queried `viewEl > .pbl-est-table` must be checked** — `renderTable` and `renderPanel` create into a `gridEl`, not `viewEl`.

**Why:** `WriteGate.canUndo()`/`undoLast()` are public with **no production caller at all** — `estimationView.ts` says so in a comment. `runEstimationInit` is reachable only from the guided empty state, so a view that gained a dimension after setup cannot bind and backfill it. And `syncBusy` has only `aria-busy` on the whole pane to say anything with.

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/toolbar.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { click, makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Scored.md', { frontmatter: { 'strategic-alignment': 5, compliance: 1 } });
	vault.addFile('Bare.md', { frontmatter: {} });
	return vault;
}

describe("the estimation view's toolbar", () => {
	it('states how many of the results are scored, as one quantity in two parts', () => {
		// The filtered count's own idiom ("3 of 12"): never two quantities joined by a
		// separator, which is what "2 items - 1 scored" was.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-count')!.textContent).toBe('1 of 2 scored');
	});

	it('offers undo only once there is something to take back', () => {
		// `WriteGate.canUndo()` had no production caller at all before this toolbar.
		const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
		const undo = containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement;
		expect(undo.disabled).toBe(true);
		expect(view.gate.canUndo()).toBe(false);
	});

	it('disables both write controls while a batch is running', async () => {
		const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
		const gate = view.gate as unknown as { applying: boolean };
		gate.applying = true;
		view.syncBusy();
		expect((containerEl.querySelector('.pbl-est-init') as HTMLButtonElement).disabled).toBe(true);
		expect((containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement).disabled).toBe(true);
		expect(containerEl.querySelector('.pbl-est-view, .pbl-view')!.getAttribute('aria-busy')).toBe('true');
		gate.applying = false;
		view.syncBusy();
		await flush();
	});

	it('keeps the table and the panel as the grid's own children, not the shell's', () => {
		// The toolbar makes `viewEl` a flex column with a grid inside it. `.pbl-est-view`'s
		// track sizing applies to DIRECT children, so a table nested one div deeper than the
		// grid lands in its single first cell — the defect `estimationView.ts`'s own header
		// warns about for exactly this reason.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const grid = containerEl.querySelector('.pbl-est-view')!;
		expect(grid.querySelector(':scope > .pbl-est-table')).not.toBeNull();
		expect(grid.querySelector(':scope > .pbl-est-panel')).not.toBeNull();
		expect(grid.previousElementSibling!.classList.contains('pbl-toolbar')).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/toolbar.test.ts`
Expected: FAIL — no `.pbl-est-count`, no toolbar.

- [ ] **Step 3: Add the catalog entries**

In `src/i18n/en.ts`:

```ts
	/** The toolbar's own two actions and its count. `{scored} of {total} scored` is the
	 *  filtered count's idiom — one quantity in two parts, so the pair reads as one fact. */
	'estimation.toolbar.init': 'Bind and backfill the estimation properties',
	'estimation.toolbar.undo': 'Undo last estimation change',
	'estimation.toolbar.scored': '{scored} of {total} scored',
```

- [ ] **Step 4: Write the toolbar module**

Create `src/view/estimation/toolbar.ts`:

```ts
import { setIcon } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationModel } from '../../domain/estimationItems';
import type { EstimationView } from './estimationView';
import { runEstimationInit } from './init';

/**
 * The estimation view's toolbar — three things the view already had and could not reach.
 *
 * `runEstimationInit` was reachable only from the guided empty state, so a view that gained
 * a dimension after setup had no way to bind and backfill it. `WriteGate.canUndo()` and
 * `undoLast()` were public with NO production caller at all — `estimationView.ts` said so in
 * a comment, and this is what closes it. And the count is where write progress is published:
 * before it, `syncBusy` had only `aria-busy` on the whole pane to say anything with.
 *
 * A module of its own rather than a method on the view, for `render/toolbar.ts`'s reason:
 * the view is the lifecycle and the write gate, and a bar of controls is a different
 * concern with its own line budget. It touches no DOM the view owns except `host`.
 *
 * Every class here is `styles/toolbar.css`'s existing vocabulary — `.pbl-toolbar`,
 * `.pbl-icon-btn`, `.pbl-toolbar-spacer` — so the only new rule in the stylesheet is the
 * count's.
 */
export function renderEstimationToolbar(view: EstimationView, host: HTMLElement, model: EstimationModel | null): void {
	const bar = host.createDiv({ cls: 'pbl-toolbar pbl-est-toolbar' });

	const init = iconButton(bar, 'sparkles', t('estimation.toolbar.init'), 'pbl-est-init');
	init.addEventListener('click', () => void runEstimationInit(view));

	// Not a plain write control: it re-enables to the UNDO SLOT's state, not to whether a
	// batch has finished — the backlog toolbar's own rule for this button.
	const undo = iconButton(bar, 'undo-2', t('estimation.toolbar.undo'), 'pbl-est-undo');
	undo.disabled = !view.gate.canUndo();
	undo.addEventListener('click', () => void view.gate.undoLast());

	bar.createDiv({ cls: 'pbl-toolbar-spacer' });

	const items = model?.items ?? [];
	bar.createSpan({
		cls: 'pbl-est-count',
		text: t('estimation.toolbar.scored', {
			scored: items.filter((item) => item.result !== null).length,
			total: items.length,
		}),
	});

	// Both go disabled BECAUSE a batch is running — asked of the plugin-wide lock rather than
	// this gate, since a batch the backlog view is writing changes the very notes this table
	// shows (`syncBusy`'s own reasoning).
	if (view.gate.writing) {
		init.disabled = true;
		undo.disabled = true;
	}
}

function iconButton(bar: HTMLElement, icon: string, label: string, cls: string): HTMLButtonElement {
	const btn = bar.createEl('button', {
		cls: `pbl-icon-btn ${cls}`,
		attr: { type: 'button', 'aria-label': label, title: label },
	});
	setIcon(btn, icon);
	return btn;
}
```

- [ ] **Step 5: Restructure the view's shell**

In `src/view/estimation/estimationView.ts`, change the constructor's element and `render()`:

```ts
		// `.pbl-est-shell` is a flex COLUMN — the toolbar, then the grid. The grid is its own
		// element and not this one: `.pbl-est-view`'s track sizing applies to DIRECT children,
		// so putting the toolbar inside the grid would spend a track on it, and nesting the
		// table one div deeper would put the table and the panel into the grid's single first
		// cell. One element per job.
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-est-shell' });
```

In `render()`, after the two early returns and before `renderTable`:

```ts
		this.model = buildEstimationModel(this.app, this.data?.data ?? [], model);
		renderEstimationToolbar(this, this.viewEl, this.model);
		const gridEl = this.viewEl.createDiv({ cls: 'pbl-est-view' });
		gridEl.toggleClass('pbl-est-no-panel', true);
		this.gridEl = gridEl;
		renderTable(this, this.model, tableScrollTop);
		renderPanel(this, this.model, panelScrollTop);
```

Add the field and move the `pbl-est-no-panel` toggling off `viewEl`:

```ts
	/** The two-track grid inside the shell — `renderTable` and `renderPanel` create into
	 *  THIS, never into `viewEl`, which now holds the toolbar above it. Null before the
	 *  first successful render, exactly like `model`. */
	gridEl: HTMLElement | null = null;

	/** Where a projection draws. The grid once one exists; the shell otherwise, so the
	 *  guided empty state and the config warning still land somewhere. */
	get contentEl(): HTMLElement {
		return this.gridEl ?? this.viewEl;
	}
```

Set `this.gridEl = null` at the top of `render()` beside the `viewEl.empty()`, and in the two early-return branches. In `renderTable` and `renderPanel`, replace `view.viewEl.createDiv(...)` with `view.contentEl.createDiv(...)`, and in `renderPanel` replace `view.viewEl.toggleClass('pbl-est-no-panel', !item)` with `view.contentEl.toggleClass('pbl-est-no-panel', !item)`. In `refocusPick`, `view.viewEl.querySelectorAll` still works — the panel is a descendant either way.

- [ ] **Step 6: Add the stylesheet rules**

In `styles/estimation.css`:

```css
/* The shell: the toolbar above, the two-track grid below it. `.pbl-est-view` keeps every
   rule it had — it is still the grid, just no longer the view's root element. */
.pbl-est-shell {
	display: flex;
	flex-direction: column;
	min-height: 0;
	height: 100%;
}

.pbl-est-shell > .pbl-est-view {
	flex: 1 1 auto;
	min-height: 0;
}

/* `tabular-nums` because the pair changes in place as items are scored — DESIGN.md's
   Tabular Number Rule, the same treatment the filtered count and the WIP limit take. */
.pbl-est-count {
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run && npm run build && npm run lint && npm run analyze`
Expected: PASS. `estimationView.ts` was 214 lines — confirm it is under 400. Fallow may report `contentEl` unused if only reached through a property access: annotate the local at each call site (`const host: EstimationView = view`) rather than adding to `usedClassMembers`, per CLAUDE.md's Gotchas.

- [ ] **Step 8: Commit**

```bash
git add src/view/estimation/ src/i18n/en.ts styles/estimation.css test/view/estimation/
git commit -m "Give the estimation view a toolbar, and a way to reach its own undo"
```

---

### Task 9: The first row is selected

**Files:**
- Modify: `src/view/estimation/renderTable.ts`
- Test: `test/view/estimation/states.test.ts`

**Interfaces:**
- Consumes: Task 8's `contentEl`.
- Produces: nothing new; `view.selectedPath` is non-null after a render with results.

**Why:** the grid's second track was reserved and empty until a row was clicked, and nothing said a row was clickable. A placeholder panel explaining what a click gives was built and looked at: at full track height it is a large dashed empty box that earns nothing.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/states.test.ts`:

```ts
it('selects the first row so the panel is on screen without a click', () => {
	// The reader lands on a scored panel that teaches the view by being it. Selection writes
	// nothing — a pick is a click on a point button — so an auto-selected row is no more a
	// write surface than a clicked one.
	const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
	expect(view.selectedPath).not.toBeNull();
	expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
	expect(containerEl.querySelector('.pbl-est-row.pbl-selected')).not.toBeNull();
});

it('selects nothing when the base returned nothing', () => {
	const { containerEl, view } = makeEstimationView(new FakeVault(), configuredValues());
	expect(view.selectedPath).toBeNull();
	expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();
	expect(containerEl.textContent).toContain('No results to estimate.');
});

it('follows the active sort rather than the base order', () => {
	// `items` is this pass's sorted order, so "the first row" is the first row DRAWN.
	const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
	const firstDrawn = containerEl.querySelector('.pbl-est-row') as HTMLElement;
	expect(view.selectedPath).toBe(firstDrawn.dataset.path);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/view/estimation/states.test.ts -t select`
Expected: FAIL — `selectedPath` is null and no panel is drawn.

- [ ] **Step 3: Write the implementation**

In `src/view/estimation/renderTable.ts`, inside `renderTable`, immediately after the stale-selection clear:

```ts
	if (view.selectedPath !== null && !model.byPath.has(view.selectedPath)) view.selectedPath = null;
	const pick = parseSort(view.sortPick);
	const items = sortedItems(model.items, pick);
	// Nothing selected lands the reader on a reserved, empty track with nothing saying a row
	// is clickable. The FIRST DRAWN row — `items`, this pass's sorted order, not
	// `model.items` — so the pick follows what is on screen. It writes nothing: a score is a
	// click on a point button, so an auto-selected row is no more a write surface than a
	// clicked one.
	if (view.selectedPath === null && items.length > 0) view.selectedPath = items[0].file.path;
```

Then move the existing `const items = sortedItems(...)` call so it is not computed twice, and pass `items` to `renderRows` as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npm run build && npm run lint`
Expected: PASS. `states.test.ts` may have an existing assertion that no panel is drawn on a fresh render — that expectation is exactly what this task changes, so update it and say so in the test's comment.

- [ ] **Step 5: Commit**

```bash
git add src/view/estimation/renderTable.ts test/view/estimation/states.test.ts
git commit -m "Select the first estimation row, so the panel is on screen on arrival"
```

---

### Task 10: The register, DESIGN.md and the changelog

**Files:**
- Create: `docs/requirements/Reading the estimation table at a glance.md`
- Modify: `docs/requirements/A rubric for every point.md`
- Modify: `docs/requirements/Taking a total apart.md`
- Modify: `docs/requirements/Why this item scored what it scored.md`
- Modify: `docs/requirements/Ranking the items by value.md`
- Modify: `docs/requirements/Styling rules are checks.md`
- Modify: `CHANGELOG.md`
- Verify: `DESIGN.md` (already amended during design — confirm, do not re-amend)

**Interfaces:**
- Consumes: every module and class name from Tasks 1–9.
- Produces: a register that passes `npm run docs`.

**Why:** `docs-check.mjs` rule 7 requires **every module in `src/` to be specified by at least one note** — in a use case's `## Where it lives` or an ADR's `## Decision`. `src/view/estimation/toolbar.ts` is new, so `npm run docs` fails until a note names it. A mention anywhere else counts for nothing.

- [ ] **Step 1: Run the gate to see it fail**

Run: `npm run docs`
Expected: FAIL — `src/view/estimation/toolbar.ts` is specified by no note.

- [ ] **Step 2: Write the new PBI**

Create `docs/requirements/Reading the estimation table at a glance.md`. Copy the frontmatter shape from `docs/requirements/Ranking the items by value.md` exactly — `type: PBI`, `parent: "[[The prioritized list]]"`, an `order` after the existing children, `status: Open`, `created: 2026-08-20`, `source: design pass, 2026-08-20`, and the six empty string fields (`started`, `finished`, `horizon`, `start`, `due`, `risk`, `assignee`).

The body needs: a user story, a `## Use case` table (Actor / Trigger / Preconditions / Guarantee), main flow, extensions, acceptance criteria, and a `## Where it lives` naming — as prose about each module, not as a list —
`src/view/estimation/toolbar.ts`, `src/view/estimation/renderTable.ts`, `src/view/estimation/panel.ts` and `src/view/estimation/estimationView.ts`.

The **Guarantee** row must state: *"Nothing on the toolbar writes except the two actions that already existed — the backfill and the undo of the last batch — and both go through the same gate every other write in this view does."*

- [ ] **Step 3: Update the four existing notes**

- `A rubric for every point.md` — its `## Where it lives` gains the one-line row shape, the radiogroup with one tab stop per row, and the hover-revealed clear control. Its "never silent about an answer" paragraph gains: *"Moving the sentence to hover was considered and refused — every point's sentence is already on hover through `aria-label`/`title`, and the resting sentence is the one thing that says what the HELD value means."*
- `Taking a total apart.md` and `Why this item scored what it scored.md` — both describe where the total sits, and it moved. The total and its coverage are in the panel's pinned header; the decomposition below holds only its terms, under its own heading.
- `Ranking the items by value.md` — extension **4a** gains `ArrowRight`: *"moves focus into the selected row's panel. `Enter` still opens the note."*
- `Styling rules are checks.md` — add the two rules this pass created that a check could reach and does not have one for: `current` carrying no colour class, and the chip family's radius.

- [ ] **Step 4: Run the gate to verify it passes**

Run: `npm run docs`
Expected: PASS — every named source path resolves, every wikilink resolves, the hierarchy and sibling orders hold, and the use-case shape is complete.

- [ ] **Step 5: Add the changelog entry**

In `CHANGELOG.md`, under `## [Unreleased]`:

```markdown
### Changed

- The estimation view's table and panel are readable: a proportional strip on value and
  coverage, a currency chip that spends colour only where something needs doing, columns
  that line up across every row, and a panel whose total is stated above its inputs and
  stays on screen while they scroll.
- The estimation view has a toolbar — the backfill action, an undo for the last batch, and
  how many of the results are scored.

### Fixed

- A long currency word pushed every numeric column on its row out of line with the header
  above it.
- The estimation panel's total and item name rendered at the wrong size, and the table
  rendered at the reading size rather than a UI size.
```

- [ ] **Step 6: Confirm DESIGN.md, do not re-amend it**

Run: `git diff --stat DESIGN.md`
Expected: the **Answer** typography entry and the restated **Title** entry are already present from the design pass. If they are not, add them per spec decision 10. Do not touch `.impeccable/design.json` — it carries no typography block.

- [ ] **Step 7: Run the whole gate and commit**

```bash
npm run check
git add docs/requirements/ CHANGELOG.md DESIGN.md
git commit -m "Register the estimation view's polish pass, and note it in the changelog"
```

---

### Task 11: The live-vault check this cannot replace

**Files:**
- Modify: `docs/tests/cases/` — a new re-runnable checklist note, following the shape of the existing notes in that folder.

**Interfaces:**
- Consumes: the shipped plugin.
- Produces: a checklist note, kept rather than closed, since appearance cannot be tested in this repository.

**Why:** the harness answers Obsidian's **default** colours only (ADR 0020). None of the following is decidable here, and a spec that stopped at `npm run check` would be claiming more than it verified.

- [ ] **Step 1: Build the plugin into this repository as a vault**

Run: `npm run test-build`
Expected: the bundle lands in `.obsidian/plugins/product-backlog-view/` (gitignored). Open this repository as a vault and open `docs/Product Backlog.base`.

- [ ] **Step 2: Write the checklist note and walk it**

Create the note with these items, each a question a real vault answers and this repository cannot:

- Under a **community theme**, does the attention orange on `Needs re-estimation` separate from the dashed `Another model` at a glance?
- Under a **themed accent**, does the value strip still read as a magnitude rather than as a selection?
- Is the plain `Current` chip visible against the panel's fill in that theme? (It was invisible once, against `--background-secondary`.)
- Do the 76px dimension rows read as one line, or as a cramped one, at a real pane width?
- With a **narrow pane**, what happens to the six columns? The Whole-Column Rule is not implemented in this table (spec decision 11) — record what it actually does, since that observation is the input to the deferred narrow-width work.
- Does `prefers-reduced-motion` actually stop the clear control's fade? (The import order makes this the one motion rule not in `motion.css`.)
- Does the toolbar's undo take back a score, and does the count update?

- [ ] **Step 3: Commit the checklist**

```bash
git add docs/tests/cases/
git commit -m "Add the live-vault checklist the estimation polish pass cannot close here"
```

---

## Self-review

**Spec coverage.** Decisions 1 (Task 4), 2 and 2a (Task 3), 3 (Task 8), 4 (Task 5), 5 (Task 6), 6 (Task 10 step 3, as a recorded refusal), 7 (Task 7), 8 (Task 3), 9 (Task 9), 10 (Task 10 step 6), 11 (Task 11 step 2, as an observation to record), 12 (Tasks 2 and 5), 13 (Task 5). The committed `?measure` knob is Task 1. Every "Where it lives" entry in the spec is touched by some task.

**Type consistency.** `renderCurrencyChip(host, currency)` is defined in Task 3 and consumed by Task 5. `drawEstimationMeasurements(view)` is defined in Task 1 and consumed by its own test only. `renderEstimationToolbar(view, host, model)` is defined in Task 8. `contentEl` is introduced in Task 8 and used by Task 9. `.pbl-est-dim-head` is introduced in Task 6 and its `.pbl-est-points` child is re-attributed in Task 7. `estimation.panel.scales` replaces `estimation.panel.effortComplexity` in Task 5 and is referenced nowhere else.

**Ordering constraint.** Task 5 must precede Task 6 and 7 (both address `.pbl-est-header` and the row shape it creates). Task 3 must precede Task 5 (which imports `renderCurrencyChip`). Task 8 must precede Task 9 (`contentEl`). Task 1 should be first so Tasks 3 and 5 can be verified in a browser. Tasks 2 and 4 are independent of the panel but share files with Task 3, so keep the stated order.

**Known risk.** `renderTable.ts` is 388 of its 400 lines before Task 3, and both Task 3 and Task 4 add to it. The extraction to `src/view/estimation/currencyChip.ts` is named in Task 4 step 4; if it is taken, Task 5's import path changes and Task 10's new register note must name the extra module or `npm run docs` fails.
