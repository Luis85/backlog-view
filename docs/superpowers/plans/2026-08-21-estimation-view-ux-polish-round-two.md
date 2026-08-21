# Estimation view UX/UI polish, round two — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the eight decisions in the round-two polish spec — one sort glyph, one
dimension name, one weight sentence, one type weight, one strip taken out of the box model,
two recorded refusals and one measurement — with no new capability.

**Architecture:** Six code decisions across four layers that already exist
(`view/estimation`, `domain`, `i18n`, `styles`), plus one harness probe and one
documentation edit. Nothing is added to `src/` as a module; every change edits a function,
a rule or a string that ships today. Two of the six are invisible to all 3228 tests
(computed type, cell geometry) and are read off a headless browser through the committed
`?measure` knob.

**Tech Stack:** TypeScript, Obsidian Bases custom-view API, vitest + jsdom, the static
harness bundle (`npm run harness`) read by headless Chromium.

**Spec:** `docs/superpowers/specs/2026-08-21-estimation-view-ux-polish-round-two-design.md`
**Prior spec (its four refusals still bind):** `docs/superpowers/specs/2026-08-20-estimation-view-ux-polish-design.md`

---

## Global Constraints

- **No new features.** Every Open Feature and PBI under `Business value estimation` is out
  of scope, and so is `Editing a dimension's scale`, which owns BOTH the rubric editor and
  the removal of the dimension's `Range` box. A change needing a new catalog namespace, a
  new option key, a new property on a note, or a new column IS a feature — say so and stop.
- `npm run check` — build + lint + coverage-thresholded tests + fallow + docs register —
  must pass whole at exit 0. It was green at exit 0 on this branch before this plan
  (verified 2026-08-21, after `git merge origin/main` reported *Already up to date*).
- `npm run analyze` reports three PRE-EXISTING findings that are not ours: 5 dev
  dependencies in production, one clone group in `src/ui/prompts.ts`, warn-level
  private-type-leaks. Do not fix, suppress or ignore-list any of them. Never run
  `npm run analyze` without a preceding `test:coverage`.
- **A comment that states a rule is not a check.** Every invariant asserted in a comment
  gets a test that fails without it, and the test is WATCHED failing: revert the fix, run,
  see red, restore.
- **Write the guarantee to the check, never ahead of it.** If a check cannot reach the whole
  claim, narrow the sentence. An ugly honest sentence beats a clean one that over-promises.
- **A rule addressed by POSITION breaks silently when the DOM moves.** `ruleAt` proves a
  rule exists; only a DOM test proves it matches. Decisions 5 and 6 need the pair.
- `src/view/estimation/**` is inside `UI_TEXT_LITERAL` and `UI_TEXT_PROPERTY`. A sentence
  handed to `sortHeader`, `iconButton`, `guidanceShell` or `scaleSpec` as a POSITIONAL
  ARGUMENT is invisible to lint — `test/i18n/estimation.test.ts` is that shape's only
  holder.
- `src/domain/` is UNSWEPT for UI text. The English literals edited in `scoringModel.ts`
  and `estimationOptions.ts` are CORRECT there. **Do not sweep `domain/` as a side effect.**
- `@container` is unavailable and no media query knows the pane's width. No breakpoint is
  available.
- Another session shares this checkout. **Stage explicit paths; never `git add docs/`.**
  Foreign commits and dirty files appear mid-run.
- Marketplace rules: sentence-case UI text, `setCssProps` over inline styles, no global
  `app`.

### Line budgets — measured 2026-08-21, corrected

The task brief's per-file numbers for the estimation test files were RAW `wc -l`, not the
budget lint counts. The budget is `max-lines: 450, skipBlankLines: true, skipComments: true`
for `test/**` (`eslint.config.mjs`). Measured with
`npx eslint <file> --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'`:

| File | Raw | **Counted** | Room |
| --- | --- | --- | --- |
| `test/harness/harness.test.ts` | 757 | **439** | **11 — the one real constraint** |
| `test/view/estimation/table.test.ts` | 438 | 316 | 134 |
| `test/view/estimation/scoring.test.ts` | 447 | 335 | 115 |
| `test/view/estimation/panel.test.ts` | 434 | 308 | 142 |
| `test/view/estimation/sort.test.ts` | 185 | 156 | 294 |
| `test/view/estimation/styleRules.test.ts` | 169 | 76 | 374 |

So "a single new test in `table.test.ts` breaks the build" is false — but the spec's
placement is kept anyway, because it is placement by SUBJECT: decision 1 belongs in
`sort.test.ts`, decisions 5 and 6 in `styleRules.test.ts`. **Do not raise any cap. Do not
split a file this correction shows has room.**

`styles/estimation.css` is 334 of a **400-line cap on RAW lines** (`scripts/styles-assemble.mjs`,
`MAX_LINES = 400`, comments included) — 66 raw lines of room. Decision 6 REPLACES the
existing `.pbl-est-row > .pbl-est-total, .pbl-est-coverage` flex block rather than adding
beside it.

### The instrument

```bash
npm run harness -- test/harness/estimation.ts
CHROME=~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom \
  --window-size=1200,900 --virtual-time-budget=4000 \
  'file:///c:/Projects/backlog-view/.harness/index.html?config=full&select=Full%20profile&measure' \
  | tr '>' '\n' | grep -E '^(TYPE|BOX|NUM) '
```

ALWAYS pipe it. `chrome-win64`, not `chrome-win`. Add `--screenshot=<path>` on the same
command line to render a PNG. `?theme=light` switches the scheme.

**Baselines re-taken 2026-08-21 in this session, before any change** (they match the brief
exactly):

- Columns at 1200px, one left edge per column across the header and all eleven rows:
  title `25→249`, total `257→329`, coverage `337→409`, confidence `417→489`,
  effort `497→569`, currency `577→717`. **Do not regress these.**
- Type ladder: `panel total 20px/600`, `panel title 15px/**600**`, `row title 13px/400`,
  `head cell 12px/500`. After decision 5 the panel title must read **15px/500**.
- The row bottoms out at 588px; at a 900px window the Currency column is off the right
  edge behind a horizontal scroller, with a 2px chip sliver as its only trace.

### Catalog count

`src/i18n/en.ts` holds **297** keys — re-taken 2026-08-21 with two agreeing instruments:
`node` regex `/^\t'[^']+':/gm` → 297, and `Object.keys(en).length` at runtime → 297. That
matches CLAUDE.md. Task 3 adds two keys, so CLAUDE.md's count becomes **299** and is
updated in that task's commit.

## File Structure

| File | Change | Decision |
| --- | --- | --- |
| `styles/estimationPanel.css` | `.pbl-est-header .pbl-est-title` weight | 5 |
| `test/view/estimation/styleRules.test.ts` | rule-exists half for 5 and 6 | 5, 6 |
| `test/view/estimation/panel.test.ts` | matches-something half for 5 | 5 |
| `test/harness/knobs.ts` | a `NUM` probe per numeric column | 6 |
| `test/harness/harness.test.ts` | the knob still reports it (≤ 11 counted lines) | 6 |
| `styles/estimation.css` | strip absolute inside a stretched cell; sort label/glyph | 6, 1 |
| `src/view/estimation/renderTable.ts` | `sortHeader` label span + glyph + `aria-label` | 1 |
| `src/i18n/en.ts` | two `estimation.sort.*` keys; `problems.lead` reworded | 1, 3 |
| `test/view/estimation/sort.test.ts` | the glyph, the two directions, the name | 1 |
| `test/i18n/estimation.test.ts` | the sorted header's name comes from the catalog | 1 |
| `src/domain/scoringModel.ts` | `dimensionProblems`/`boundEntries` by label; weight delta | 2, 3 |
| `src/domain/estimationOptions.ts` | `dimensionGroup` takes a resolved dimension; `Weight (% of 100)` | 2, 3 |
| `test/domain/scoringModel.test.ts` | label naming, lowercase collision entry, the delta | 2, 3 |
| `test/domain/estimationOptions.test.ts` | resolved heading, SHIPPED `Label` default | 2, 3 |
| `DESIGN.md` | "column header" qualified in the Body and Label entries | 8 |
| `docs/**`, `CHANGELOG.md` | the register edits, the new PBI, the `[Unreleased]` entry | 4, 7, all |

---

### Task 1: The panel title takes one weight (decision 5)

**Files:**
- Modify: `styles/estimationPanel.css` — the `.pbl-est-header .pbl-est-title` rule
- Test: `test/view/estimation/styleRules.test.ts` (rule exists), `test/view/estimation/panel.test.ts` (rule matches)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by a later task. Independent.

DESIGN.md's **Title** declares `var(--font-ui-medium)`, `var(--font-medium)` and names two
wearers. `.pbl-empty-title` obeys it; `.pbl-est-header .pbl-est-title` declares
`var(--font-semibold)` and renders at 600. **Do NOT amend DESIGN.md up to semibold** — that
alternative is refused in the spec (it would change every empty-state headline, which is
deliberately quiet, and a title at the Answer's own weight competes with the number the
panel exists to state).

- [ ] **Step 1: Write the failing rule-exists test**

Append to the `describe('the panel header owns its own type', …)` block in
`test/view/estimation/styleRules.test.ts`:

```ts
	it('gives the panel title the Title step WEIGHT, not the Answer beside it', () => {
		// Measured 15px/600 against a DESIGN.md Title entry declaring `--font-medium`, while
		// `.pbl-empty-title` — the entry's other wearer — renders 500. One declared step, two
		// weights on screen; `ruleAt` cannot read a computed weight, so what it reads is the
		// declaration, and the absence beside it is what stops the old one being left in place.
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-weight: var(--font-medium);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-weight: var(--font-semibold);')).toBe(-1);
	});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/styleRules.test.ts -t 'Title step WEIGHT'`
Expected: FAIL — the `--font-medium` lookup returns -1 and the `--font-semibold` lookup
does not.

- [ ] **Step 3: Write the matches-something test**

The pair `styleRules.test.ts` cannot give on its own: `ruleAt` proves a rule exists and
never that it matches. Add to `test/view/estimation/panel.test.ts` (308 of 450 counted, so
it fits), in the describe block covering the sticky header:

```ts
	it('draws the item name inside the header the type rule addresses', () => {
		// `.pbl-est-header .pbl-est-title` is a DESCENDANT selector, so it applies only while the
		// title is inside the header — the exact condition three type rules in this view lost
		// silently when the summary moved. jsdom applies no stylesheet, so this asserts the
		// STRUCTURE the rule needs and `styleRules.test.ts` asserts the rule; neither half alone
		// is the guarantee.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const title = containerEl.querySelector('.pbl-est-header > .pbl-est-title');
		expect(title?.textContent).toBe('Full');
	});
```

Read the file's existing fixture/helper names first (`makeEstimationView`, `selectItem`,
`configuredValues`, its own `fixture()`) and use exactly those — do not import a second
copy. If the file already asserts this structure, skip this step and record in the commit
message that the matches-something half was already present, naming the test.

- [ ] **Step 4: Run it — it should PASS already**

Run: `npx vitest run test/view/estimation/panel.test.ts -t 'inside the header the type rule addresses'`
Expected: PASS. It is the half that will fail LATER, if the title ever leaves the header —
which is the whole point of adding it. Record that in the commit message honestly: it was
not watched failing because the structure it guards is already correct, and the check it
pairs with was.

- [ ] **Step 5: Make the rule-exists test pass**

In `styles/estimationPanel.css`, in the `.pbl-est-header .pbl-est-title` rule, replace

```css
	font-weight: var(--font-semibold);
```

with

```css
	/* DESIGN.md's Title step, whose other wearer (`.pbl-empty-title`) already renders 500 —
	   measured at 600 here on 2026-08-21, one declared step wearing two weights. 500 under a
	   20px/600 Answer is also what the Answer entry's own argument asks for: the number is what
	   the panel exists to state, and a title at the same weight competes with it. */
	font-weight: var(--font-medium);
```

- [ ] **Step 6: Run both tests**

Run: `npx vitest run test/view/estimation/styleRules.test.ts test/view/estimation/panel.test.ts`
Expected: PASS.

- [ ] **Step 7: Read the computed weight off a real browser**

```bash
npm run harness -- test/harness/estimation.ts
CHROME=~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom \
  --window-size=1200,900 --virtual-time-budget=4000 \
  'file:///c:/Projects/backlog-view/.harness/index.html?config=full&select=Full%20profile&measure' \
  | tr '>' '\n' | grep -E '^TYPE '
```

Expected: `TYPE panel title size=15px weight=500`, and the other three steps unchanged —
`panel total 20px/600`, `row title 13px/400`, `head cell 12px/500`. Paste the four lines
into the commit message. If any other step moved, stop: the rule reached something it
should not have.

- [ ] **Step 8: Commit**

```bash
git add styles/estimationPanel.css test/view/estimation/styleRules.test.ts test/view/estimation/panel.test.ts
git commit -m "$(cat <<'EOF'
Give the estimation panel's title one weight, the one DESIGN.md declares

Watched failing: the rule-exists assertion in styleRules.test.ts, both halves
(the --font-medium lookup returned -1, the --font-semibold lookup did not).
The matches-something half in panel.test.ts passed on write, deliberately: it
guards a structure that is currently correct, which is the half `ruleAt` can
never see.

Measured after, headless Chromium at 1200x900:
  TYPE panel title size=15px weight=500
EOF
)"
```

---

### Task 2: The value strip leaves the box model (decision 6)

**Files:**
- Modify: `test/harness/knobs.ts` — `drawEstimationMeasurements` gains a `NUM` probe
- Modify: `test/harness/harness.test.ts` — the knob still reports it (**11 counted lines of room**)
- Modify: `styles/estimation.css` — the two strip cells and `.pbl-est-strip`
- Test: `test/view/estimation/styleRules.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the `NUM <col> top=… bottom=… h=…` line format in the `?measure` output, read
  by no later task but by every future geometry question.

In both schemes the numbers in `Value` and `Coverage` sit about 3px above those in
`Confidence` and `Effort`. The row is `align-items: center`; a plain cell is one ~18px
line, a strip cell is a `column` flex with a 3px gap plus a 3px strip, ~24px — so the row
centres each cell correctly and the numbers still do not line up.

**`.pbl-est-cell`, `.pbl-est-total` and `.pbl-est-coverage` share `overflow: hidden`, so a
strip hung BELOW its cell is clipped away entirely.** The strip becomes absolute INSIDE the
cell. The block-end offset is a MEASURED number, not a chosen one.

- [ ] **Step 1: Add the probe to the measure knob**

In `test/harness/knobs.ts`, after the existing `BOX` loop in
`drawEstimationMeasurements` and before the `probes` array, add:

```ts
	// The four numeric columns' own numbers, top and bottom — the probe decision 6 needs and
	// the `BOX` lines above cannot answer: those report a CELL's box, and the defect is the
	// number's position INSIDE two cells that are taller than their siblings. `rows[0]` only:
	// one row settles whether the four share a baseline, and eleven would print 44 lines
	// saying it eleven times.
	for (const col of ['total', 'coverage', 'confidence', 'effort']) {
		const cell = rows[0]?.querySelector(col === 'total' || col === 'coverage' ? `.pbl-est-${col}` : `[data-col="${col}"]`);
		const num = cell?.querySelector('.pbl-est-num');
		if (!(num instanceof HTMLElement)) continue;
		const box = num.getBoundingClientRect();
		lines.push(`NUM ${col} top=${box.top.toFixed(1)} bottom=${box.bottom.toFixed(1)} h=${box.height.toFixed(1)}`);
	}
```

- [ ] **Step 2: Write the failing harness test — mind the 11 lines**

Before writing, confirm the room:

```bash
npx eslint test/harness/harness.test.ts --rule '{"max-lines":["error",{"max":430,"skipBlankLines":true,"skipComments":true}]}'
```

Then add exactly this inside the existing
`it('the ?measure knob reports a box per column and a type per probe', …)`, after the
`TYPE` loop (comments do not count against the budget; the three code lines do):

```ts
		// Decision 6's probe. What is asserted is that the knob REPORTS one number line per
		// numeric column — never what the numbers are, which is a browser's answer and would be
		// the screenshot suite ADR 0020 refuses.
		for (const col of ['total', 'coverage', 'confidence', 'effort']) {
			expect(lines.filter((l) => l.startsWith(`NUM ${col} `)), `${col} number`).toHaveLength(1);
		}
```

Rename the test's own title to `…a box per column, a type per probe and a number per numeric column`.

- [ ] **Step 3: Run it and watch it fail, then re-measure the budget**

Run: `npx vitest run test/harness/harness.test.ts -t 'measure knob'`
Expected: FAIL with `total number` — length 0, expected 1 — **if the probe from step 1 is
reverted first**. Revert step 1, run, see red, restore. Then:

```bash
npx eslint test/harness/harness.test.ts --rule '{"max-lines":["error",{"max":450,"skipBlankLines":true,"skipComments":true}]}'
```

Expected: no output (≤ 450). If it reports over, split `harness.test.ts` by subject — the
`?measure` block is a candidate for its own file — and **do not raise the cap.**

- [ ] **Step 4: Read the BEFORE numbers**

```bash
npm run harness -- test/harness/estimation.ts
CHROME=~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom \
  --window-size=1200,900 --virtual-time-budget=4000 \
  'file:///c:/Projects/backlog-view/.harness/index.html?config=full&select=Full%20profile&measure' \
  | tr '>' '\n' | grep -E '^(NUM|BOX pbl-est-(total|coverage|cell)\[?[a-z]*\]? row0) '
```

Record all four `NUM` lines and the four row0 `BOX` lines. **These are the numbers the
offset is derived from**: the strip's current top edge relative to its cell's box is where
it must keep drawing, and the two plain cells' `NUM top` is the baseline the two strip
cells must move to. Paste them into the commit message as the BEFORE half.

- [ ] **Step 5: Write the failing rule-exists tests**

Add to `test/view/estimation/styleRules.test.ts`:

```ts
describe('a decoration never sizes the box the value is centred in', () => {
	it('takes the strip out of the box model without letting it out of the cell', () => {
		// The three cell classes share `overflow: hidden`, so a strip hung BELOW its cell is
		// clipped away entirely — absolute against the CELL, which is why the cell is the
		// positioning context and the strip's offsets are block-end rather than a translate.
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'position: relative;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-strip', 'position: absolute;')).toBeGreaterThan(-1);
	});

	it('gives the two strip cells the same height and the same centring as the plain two', () => {
		// The measured cause: a `column` flex holding a number plus a 3px strip and a 3px gap is
		// ~24px against a plain cell's ~18px, and a row that centres each cell as a whole then
		// starts the taller cell's number higher. `stretch` makes all four the row's content
		// height; `align-items: center` centres the number in each identically.
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'align-self: stretch;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'align-items: center;')).toBeGreaterThan(-1);
		// The column flex is what made the cell taller than its siblings, so it must be GONE
		// rather than overridden — an override is a rule the next reader has to reconcile.
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'flex-direction: column;')).toBe(-1);
	});
});
```

- [ ] **Step 6: Run them and watch them fail**

Run: `npx vitest run test/view/estimation/styleRules.test.ts -t 'sizes the box'`
Expected: FAIL on the `position: relative`, `align-self`, `align-items` lookups (all -1)
and on the `flex-direction: column` lookup (present today).

- [ ] **Step 7: Replace the flex block in `styles/estimation.css`**

REPLACE — do not add beside — the existing block:

```css
.pbl-est-row > .pbl-est-total,
.pbl-est-row > .pbl-est-coverage {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	justify-content: center;
	gap: 3px;
}
```

with:

```css
/* The two cells that carry a strip. A `column` flex holding the number plus a 3px strip and a
   3px gap measured ~24px against a plain cell's ~18px line, and a row that centres each cell
   as a whole then starts the taller cell's number higher — every cell centred correctly and
   the four numbers 3px apart, in a table whose whole job is comparing numbers across a row.

   So the strip leaves the box model and STAYS INSIDE THE CELL while doing it: these three
   classes share `overflow: hidden` above, so a strip hung below its cell would be clipped
   away entirely. `stretch` makes the cell as tall as the row's content box rather than as
   tall as its own contents, and a flex ROW with `align-items: center` is what every plain
   numeric cell already effectively is — so the number centres identically in all four.

   Third instance of one idea, after the panel's clear control: a decoration that annotates a
   value must not be allowed to size the box the value is centred in.

   Scoped to a ROW's cells: these two class names are worn by three different elements — a row
   cell, a sortable header button, and the panel's decomposition summary — and an unscoped
   declaration here restyled all three at once, once. */
.pbl-est-row > .pbl-est-total,
.pbl-est-row > .pbl-est-coverage {
	display: flex;
	align-items: center;
	align-self: stretch;
	position: relative;
}
```

Then, in the `.pbl-est-strip` rule, add the absolute placement:

```css
.pbl-est-strip {
	/* Against the CELL (`position: relative` above), spanning its inline extent at the block
	   end. The offset is MEASURED, not chosen — see the plan's step 4/9 readings. */
	position: absolute;
	inset-inline: 0;
	inset-block-end: <MEASURED>;
	height: 3px;
	…
}
```

`<MEASURED>` is settled in step 9. Start from the step-4 reading: the strip's old top edge
minus the cell's new content-box block start. Logical properties only — the physical-side
ban applies (`docs/requirements/Nothing pins a physical side.md`).

Check the raw cap after editing:

```bash
awk 'END{print NR}' styles/estimation.css   # must stay ≤ 400
```

- [ ] **Step 8: Run the whole estimation suite**

Run: `npx vitest run test/view/estimation test/harness/harness.test.ts`
Expected: PASS. `table.test.ts` already asserts decision 6's structural half — the strip is
a child of the cell it annotates — and nothing there should move. If it fails, the strip
left its cell.

- [ ] **Step 9: Measure the AFTER numbers and settle the offset**

Re-run the harness build and the headless command from step 4, plus a screenshot:

```bash
npm run harness -- test/harness/estimation.ts
CHROME=~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom \
  --screenshot=.harness/after.png --window-size=1200,900 --virtual-time-budget=4000 \
  'file:///c:/Projects/backlog-view/.harness/index.html?config=full&select=Full%20profile&measure' \
  | tr '>' '\n' | grep -E '^(NUM|BOX) '
```

Two things must hold, and iterate on `<MEASURED>` until both do:

1. **All four `NUM` lines report the same `top`** (within 0.5px). That is the decision.
2. **The six column left edges are unchanged** — title `25→249`, total `257→329`, coverage
   `337→409`, confidence `417→489`, effort `497→569`, currency `577→717`, one per column
   across the header and all eleven rows.

Then read `.harness/after.png` and confirm the strip still draws under its number and is
not clipped. Also run `?theme=light` once. Paste the four AFTER `NUM` lines and the final
offset into the commit message.

- [ ] **Step 10: Commit**

```bash
git add styles/estimation.css test/harness/knobs.ts test/harness/harness.test.ts test/view/estimation/styleRules.test.ts
git commit -m "$(cat <<'EOF'
Take the value and coverage strips out of the box model, inside their cells

Watched failing: the harness test's NUM assertion with the knob's probe reverted
(0 lines, expected 1), and both styleRules assertions against the shipped sheet
(position/align-self/align-items at -1, flex-direction: column present).

Measured, headless Chromium at 1200x900 — four numbers on one baseline where
they were 3px apart, and the six column left edges unmoved:
  BEFORE: <paste the four NUM lines>
  AFTER:  <paste the four NUM lines>
  offset: inset-block-end: <MEASURED>
EOF
)"
```

---

### Task 3: The sort direction gets a shape and a name (decision 1)

**Files:**
- Modify: `src/view/estimation/renderTable.ts` — `sortHeader`
- Modify: `src/i18n/en.ts` — two `estimation.sort.*` keys
- Modify: `styles/estimation.css` — `.pbl-est-sort-label`, `.pbl-est-sort-dir`
- Modify: `CLAUDE.md` — the catalog count 297 → 299
- Test: `test/view/estimation/sort.test.ts`, `test/i18n/estimation.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: `estimation.sort.ascending` / `estimation.sort.descending`, each taking one
  `{column}` parameter; the DOM shape `button.pbl-est-sort > span.pbl-est-sort-label` plus
  `span.pbl-est-sort-dir[data-icon]` on the active header only.

`button.pbl-est-sort:hover` and `button.pbl-est-sort[aria-sort]` share one identical
declaration block, and `sortHeader` draws no glyph: hovering ANY header looks exactly like
the sorted one, and **ascending and descending are visually identical**. And the direction
is announced to NOBODY — `aria-sort` is supported on `columnheader`/`rowheader`, and this
table is `role="listbox"` with `role="option"` rows and a plain div header holding six
buttons.

**`aria-sort` STAYS.** It is the style hook and the hook every direction assertion in
`sort.test.ts` reads, and the attribute a future move to real column-header roles would
already have. What is added is the `aria-label`, because the attribute cannot be trusted.

**The shared `:hover, [aria-sort]` colour block is deliberately NOT split.** Once the glyph
exists, hover is colour alone and sorted is colour plus a glyph — already two signals, one
of which survives monochrome. Do not "finish" that.

- [ ] **Step 1: Write the failing view tests**

Add to `test/view/estimation/sort.test.ts` (156 of 450 counted — ample room):

```ts
describe('the sort direction has a shape and a name', () => {
	it('draws no direction element on a header nobody has sorted by', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(header(containerEl, 'total').querySelector('.pbl-est-sort-dir')).toBeNull();
	});

	it('draws a DIFFERENT glyph for each direction, so the two are not visually identical', () => {
		// The defect: `aria-sort` was the only difference between ascending and descending, and
		// it is not a supported attribute on a button in a `role="listbox"` — so the direction
		// survived neither a colour screenshot nor a screen reader. `data-icon` is what the
		// harness's `setIcon` records (`test/helpers/obsidian-mock.ts`).
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		const descending = header(containerEl, 'total').querySelector<HTMLElement>('.pbl-est-sort-dir')?.dataset.icon;
		click(header(containerEl, 'total'));
		const ascending = header(containerEl, 'total').querySelector<HTMLElement>('.pbl-est-sort-dir')?.dataset.icon;
		expect(descending).toBe('chevron-down');
		expect(ascending).toBe('chevron-up');
		expect(ascending).not.toBe(descending);
	});

	it('states the direction in the header button\'s accessible name', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		expect(header(containerEl, 'total').getAttribute('aria-label')).toContain('descending');
		click(header(containerEl, 'total'));
		expect(header(containerEl, 'total').getAttribute('aria-label')).toContain('ascending');
		// `aria-sort` stays: it is the stylesheet's state hook and this file's own direction
		// hook, and the attribute a move to real column-header roles would already have. What
		// it is NOT is a thing any assistive technology reads on a button in a listbox, which
		// is why the name above is added rather than the attribute trusted.
		expect(header(containerEl, 'total').getAttribute('aria-sort')).toBe('ascending');
	});

	it('puts the label in its own span so the direction is never what truncates', () => {
		// The four numeric columns are a fixed 72px and `Confidence` is the widest header word,
		// leaving about 10px of slack — so a glyph beside a bare text node pushes the label into
		// the cell's own ellipsis at some widths and in most translations. The label shrinks;
		// `.pbl-est-sort-dir` is `flex: 0 0 auto`.
		const { containerEl } = makeEstimationView(fixture(), values());
		const label = header(containerEl, 'confidence').querySelector('.pbl-est-sort-label');
		expect(label?.textContent).toBe('Confidence');
	});
});
```

**What these do not check**, and the sentence is narrowed rather than left standing: that
the glyph is LEGIBLE at 10px — the harness's question, and only on a real display — or that
any assistive technology reads the name, which is neither's.

- [ ] **Step 2: Write the failing i18n test**

`test/i18n/estimation.test.ts` is the only holder for a sentence handed to `sortHeader` as
a positional argument. Its existing head-row test drains the row with no sort active, so a
sorted header's name needs its own. Add, after `it('draws every column header from it, …')`:

```ts
	it('names a SORTED header from it, direction and all', () => {
		// The one string in this view that lint cannot see even in a swept directory: an
		// `aria-label` built by `sortHeader` from a positional argument. Unsorted, the head row
		// carries no such name at all, so the existing test above cannot reach it.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const head = partOf(containerEl, '.pbl-est-head');
		partOf(head, '.pbl-est-sort[data-col="total"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(unmarked(drawnText(partOf(containerEl, '.pbl-est-head')))).toEqual([]);
	});
```

- [ ] **Step 3: Run both and watch them fail**

Run: `npx vitest run test/view/estimation/sort.test.ts test/i18n/estimation.test.ts`
Expected: FAIL — no `.pbl-est-sort-dir` element, no `aria-label`, no `.pbl-est-sort-label`,
and the i18n test reporting the untranslated direction name (or an empty-name failure).

- [ ] **Step 4: Add the two catalog keys**

In `src/i18n/en.ts`, amend the column block's comment and add the two keys beneath it:

```ts
	/** The prioritized list's column labels — also each sort button's own accessible name
	 * while nothing is sorted BY it. The ACTIVE column's name states the direction instead
	 * (`estimation.sort.*` below), because `aria-sort` is not a supported attribute on a
	 * button inside a `role="listbox"` and is announced to nobody. */
	'estimation.column.item': 'Item',
	…
	'estimation.column.currency': 'Currency',

	/** The active sort header's accessible name. {column} is the column's own label above —
	 * a catalog string, not data. The GLYPH beside it carries the same fact for a sighted
	 * reader (`chevron-up`/`chevron-down`), per DESIGN.md's Shape-Before-Colour Rule. */
	'estimation.sort.ascending': '{column}, sorted ascending',
	'estimation.sort.descending': '{column}, sorted descending',
```

- [ ] **Step 5: Draw the label span, the glyph and the name**

In `src/view/estimation/renderTable.ts`, replace the body of `sortHeader`'s element
construction. Today:

```ts
	const btn = head.createEl('button', { cls: `${cls} pbl-est-sort`, text: label, attr: { 'data-col': column } });
	if (active) btn.setAttribute('aria-sort', active.direction === 'asc' ? 'ascending' : 'descending');
```

becomes:

```ts
	const btn = head.createEl('button', { cls: `${cls} pbl-est-sort`, attr: { 'data-col': column } });
	// The label in its own truncating span, and that is not tidying: the four numeric columns
	// are a fixed 72px and `Confidence` leaves about 10px of slack, so a glyph beside a bare
	// text node pushes the label into the cell's own ellipsis at some widths and in most
	// translations. The span shrinks; the glyph is `flex: 0 0 auto`, so the direction is never
	// the thing that disappears.
	btn.createSpan({ cls: 'pbl-est-sort-label', text: label });
	if (!active) return wireSortClick(view, btn, spec, active);
	btn.setAttribute('aria-sort', active.direction === 'asc' ? 'ascending' : 'descending');
	// `aria-sort` above stays — the stylesheet's state hook, every direction assertion's hook,
	// and the attribute a move to real `columnheader` roles would already have. It is NOT read
	// by anything today: ARIA supports it on `columnheader`/`rowheader`, and this is a button
	// inside a `role="listbox"`. So the direction is SAID here and SHOWN below.
	btn.setAttribute('aria-label', t(active.direction === 'asc' ? 'estimation.sort.ascending' : 'estimation.sort.descending', { column: label }));
	setIcon(btn.createSpan({ cls: 'pbl-est-sort-dir' }), active.direction === 'asc' ? 'chevron-up' : 'chevron-down');
	return wireSortClick(view, btn, spec, active);
```

Import `setIcon` from `obsidian` at the top of the file (the module does not import it
today; `currencyChip.ts`, `panel.ts` and `toolbar.ts` are the precedent).

Extract the existing click wiring into `wireSortClick(view, btn, spec, active)` so
`sortHeader` stays inside the `max-lines-per-function` (100) and `max-params` (5) budgets
and the early return above is legal:

```ts
/** The click half of a header button, split out so `sortHeader` can return early once the
 *  inactive case has nothing more to draw. A click computes the NEXT pick from the CURRENT
 *  one — flip if this is already the active column, else that column's own first direction. */
function wireSortClick(view: EstimationView, btn: HTMLElement, spec: HeaderSpec, active: SortPick | null): void {
	btn.addEventListener('click', () => {
		setSort(view, sortValue({ column: spec.column, direction: active ? flip(active.direction) : firstDirection(spec.column) }));
		view.refresh();
	});
}
```

If `sortHeader`'s early-return shape fights the existing destructuring, keep it as a plain
`if (active) { … }` block instead — the early return is a convenience, not the decision.

- [ ] **Step 6: Add the two style rules**

In `styles/estimation.css`, after the `button.pbl-est-sort:focus-visible` rule:

```css
/* The label shrinks and the direction does not. `Confidence` is the widest header word in a
   fixed 72px column and leaves about 10px of slack, so without this split a glyph pushes the
   label into the cell's own ellipsis — and the direction, the smaller of the two, is what a
   shrink-to-fit would drop first. 10px rather than an icon's usual 12px for the same reason. */
.pbl-est-sort-label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pbl-est-sort-dir {
	display: inline-flex;
	align-items: center;
	flex: 0 0 auto;
}

.pbl-est-sort-dir .svg-icon {
	width: 10px;
	height: 10px;
}
```

Do NOT touch the `button.pbl-est-sort:hover, button.pbl-est-sort[aria-sort]` block. Check
the raw cap: `awk 'END{print NR}' styles/estimation.css` must stay ≤ 400.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view/estimation test/i18n/estimation.test.ts`
Expected: PASS. If the existing head-row i18n test now fails on an unmarked string, the
label span or the glyph is leaking a literal — fix the call site, not the test.

- [ ] **Step 8: Re-take the catalog count and update CLAUDE.md**

```bash
node -e "const s=require('fs').readFileSync('src/i18n/en.ts','utf8');console.log((s.match(/^\t'[^']+':/gm)||[]).length)"
npx tsx -e "import {en} from './src/i18n/en'; console.log(Object.keys(en).length)"
```

Both must print **299**. Update CLAUDE.md's `297 keys are in it (counted 2026-08-21)` to
`299` with the same date. If the two instruments disagree, stop and find out why — one of
them cannot see a shape the other can, which is the exact failure this project has hit
twice.

- [ ] **Step 9: Look at it**

```bash
npm run harness -- test/harness/estimation.ts
CHROME=~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom \
  --screenshot=.harness/sort.png --window-size=1200,900 --virtual-time-budget=4000 \
  'file:///c:/Projects/backlog-view/.harness/index.html?config=full&select=Full%20profile&measure' \
  | tr '>' '\n' | grep -E '^BOX '
```

The six column left edges must be unchanged (title `25→249` … currency `577→717`). The
screenshot shows no sorted header (the page loads unsorted), so this step confirms only
that the label span did not move a column. Whether a 10px glyph READS on a real display is
unanswerable here and is owed to the live-vault smoke test.

- [ ] **Step 10: Commit**

```bash
git add src/view/estimation/renderTable.ts src/i18n/en.ts styles/estimation.css CLAUDE.md test/view/estimation/sort.test.ts test/i18n/estimation.test.ts
git commit -m "$(cat <<'EOF'
Give the sort direction a glyph and an accessible name

Watched failing, all four sort.test.ts assertions and the i18n one: no
.pbl-est-sort-dir element, no aria-label, no .pbl-est-sort-label span, and the
sorted head row carrying an unmarked English name under a marked catalog.

aria-sort stays — the style hook and this suite's direction hook, and not a
thing any assistive technology reads on a button inside a role="listbox", which
is why the name was added rather than the attribute trusted. The shared
:hover/[aria-sort] colour block is deliberately not split.

Catalog 297 -> 299, re-counted with two agreeing instruments. Column left edges
unmoved at 1200px.
EOF
)"
```

---

### Task 4: One name for a dimension, in all three places (decision 2)

**Files:**
- Modify: `src/domain/scoringModel.ts` — `dimensionProblems`, `boundEntries`
- Modify: `src/domain/estimationOptions.ts` — `dimensionGroup`, `getEstimationViewOptions`
- Test: `test/domain/scoringModel.test.ts`, `test/domain/estimationOptions.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: `dimensionGroup(d: ScoringDimension): BasesAllOptions` — the signature changes
  from `(id: string)`. Task 5 edits the same function's `Weight` item.

`dimensionProblems` builds every sentence from `d.id`
(`strategic-alignment: the weight must be a positive number`) while the panel that produced
the mistake says `Strategic alignment`. `ScoringDimension` has carried a `label` the whole
time and `estimationSettings.ts` resolves it as
`read.text(dimOption(id, 'label')) || shipped?.label || id`, so it is never empty.

**These are English literals in `src/domain/`, which is UNSWEPT — correct here, a lint
failure one directory over. Do not sweep `domain/`.**

- [ ] **Step 1: Write the failing domain tests**

Add to `test/domain/scoringModel.test.ts` (145 of 450 counted):

```ts
describe('a dimension is named the way the panel names it', () => {
	it('names each problem by the label, never by the slug', () => {
		// The existing assertions here match on /reach/i, which passes for the id AND the label —
		// so this is a NEW assertion naming the label exactly, not a tightening of one that
		// would have passed either way.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 0 }] });
		expect(modelProblems(model)).toContain('Reach: the weight must be a positive number');
	});

	it('names an OVERRIDDEN label by the override', () => {
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Blast radius', weight: 0 }] });
		expect(modelProblems(model).join(' ')).toContain('Blast radius');
		expect(modelProblems(model).join(' ')).not.toContain('reach:');
	});

	it('puts a dimension inside the collision sentence in lowercase', () => {
		// `settings.sharedKey` joins the list into ONE sentence, which is why the three scales
		// and the two pair slots beside it are plain lowercase nouns. `SUGGESTED_KEYS` already
		// spells `d.label.toLowerCase()` for the same reason.
		const model = modelWith({
			dimensions: [{ ...dimension('reach'), label: 'Reach', key: 'note.shared' }],
			confidence: { key: 'note.shared', min: 1, max: 5, rubric: [] },
		});
		expect(modelProblems(model).join(' ')).toContain('reach');
		expect(modelProblems(model).join(' ')).not.toContain('Reach');
	});
});
```

Read the file's existing helpers first (`modelWith`, `dimension`, or whatever it actually
spells) and use exactly those, filling every field `ScoringDimension` and `ScaleConfig`
require. If a rubric-length problem masks the weight problem, give the fixture a rubric of
the right length — `modelProblems` reports the weight sum only when nothing else failed, but
`dimensionProblems`' own entries are unconditional.

Add to `test/domain/estimationOptions.test.ts` (67 of 450 counted):

```ts
describe('a dimension group is headed the way the panel heads it', () => {
	it('heads the group by the RESOLVED label, including an override', () => {
		const options = getEstimationViewOptions(configFor({ 'dimLabel.reach': 'Blast radius' }));
		expect(groupNames(options)).toContain('Blast radius');
		expect(groupNames(options)).not.toContain('Reach');
	});

	it('heads an id outside the shipped eight by its own label rather than its slug', () => {
		const options = getEstimationViewOptions(configFor({ dimensions: 'novelty', 'dimLabel.novelty': 'Novelty' }));
		expect(groupNames(options)).toContain('Novelty');
	});

	it('keeps the SHIPPED label in the Label box\'s own default and placeholder', () => {
		// The half a careless fix breaks. `dimensionGroup`'s rule is that a box's `default` and
		// `placeholder` are the SHIPPED value and never the CURRENT one, or a dimension already
		// overridden shows its override as though nothing had been chosen. A group HEADING is not
		// a candidate value — it names which dimension the boxes belong to — so only the heading
		// moves to the resolved label.
		const item = labelItem(getEstimationViewOptions(configFor({ 'dimLabel.reach': 'Blast radius' })), 'reach');
		expect(item.default).toBe('Reach');
		expect(item.placeholder).toBe('Reach');
	});
});
```

Again: read the file's existing helpers and reuse them; add `groupNames`/`labelItem`-style
local helpers only if none exist.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/scoringModel.test.ts test/domain/estimationOptions.test.ts`
Expected: FAIL — problems named `reach:` not `Reach:`, groups headed `Reach` under an
override and `novelty` for an unshipped id.

- [ ] **Step 3: Name the dimension by its label in `scoringModel.ts`**

In `boundEntries`:

```ts
		// The label, lowercased: this entry lands INSIDE a sentence (`settings.sharedKey` joins
		// the list into one), which is why the three scales and the two pair slots below are
		// plain lowercase nouns. `SUGGESTED_KEYS` already spells `d.label.toLowerCase()` for the
		// same reason, so this is the existing shape rather than a new one.
		...model.dimensions.map((d) => ({ key: d.key, label: d.label.toLowerCase() })),
```

In `dimensionProblems`, replace all four `${d.id}` with `${d.label}` and amend the doc
comment:

```ts
/** One dimension's own problems: its range, its rubric coverage, its property, its weight —
 *  each named by the dimension's LABEL, which is what the options panel that produced the
 *  mistake calls it. `estimationSettings.ts` resolves the label as
 *  `read.text(dimOption(id, 'label')) || shipped?.label || id`, so it is never empty and the
 *  slug is never the only name available. Sentence-initial, so the shipped labels'
 *  capitalisation is already right. */
```

- [ ] **Step 4: Head the group by the resolved label in `estimationOptions.ts`**

`getEstimationViewOptions` already resolves the settings, so the resolved dimensions are in
hand — the map moves from `ids` to `settings.model.dimensions`:

```ts
	const settings = resolveEstimationSettings(config);
	return [modelGroup(), ...settings.model.dimensions.map(dimensionGroup), scalesGroup()];
```

and `dimensionGroup` takes the dimension:

```ts
/** One dimension's group. Every BOX's `default` and `placeholder` is the SHIPPED value,
 * never the CURRENT one, or a dimension already overridden would show its override as
 * though nothing had been chosen — which is why `shipped` is still read here beside the
 * resolved `d`.
 *
 * The group's HEADING is the exception, and it is not an exception to that rule: a heading
 * is not a candidate value. It names which dimension the boxes belong to, so it takes the
 * RESOLVED label — the same words the panel row inside it shows. Headed by
 * `defaultDimension(id)?.label ?? id`, a dimension outside the shipped eight was headed by
 * its slug and an overridden one by the shipped word while its own Label box held the
 * override. */
function dimensionGroup(d: ScoringDimension): BasesAllOptions {
	const { id } = d;
	const shipped = defaultDimension(id);
	const shippedLabel = shipped?.label ?? id;
	const shippedWeight = shipped ? String(shipped.weight) : '';
	return {
		type: 'group',
		displayName: d.label,
		items: [
			…
			{
				type: 'text',
				key: dimOption(id, 'label'),
				displayName: 'Label',
				default: shippedLabel,
				placeholder: shippedLabel,
			},
		],
	};
}
```

Delete the now-unused `ids` local. Import `ScoringDimension` as a type from `./scoringModel`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain test/view/estimation`
Expected: PASS. The view tests are in scope because the problems block renders these
sentences.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scoringModel.ts src/domain/estimationOptions.ts test/domain/scoringModel.test.ts test/domain/estimationOptions.test.ts
git commit -m "$(cat <<'EOF'
Name a dimension by its label in all three places it is named

Watched failing, all six assertions: problems read `reach:` where the panel says
`Reach`, the group under an overridden Label was headed by the shipped word, and
an id outside the shipped eight was headed by its slug.

The Label box's own default and placeholder still hold the SHIPPED value — the
half a careless fix breaks, and now asserted. A group HEADING is not a candidate
value, which is why it and only it moves to the resolved label.

English literals in src/domain/, which is UNSWEPT and stays that way.
EOF
)"
```

---

### Task 5: The weight rule is stated where a weight is typed (decision 3)

**Files:**
- Modify: `src/domain/estimationOptions.ts` — the `Weight` item's `displayName`
- Modify: `src/domain/scoringModel.ts` — the weight-total sentence
- Modify: `src/i18n/en.ts` — `estimation.problems.lead`
- Test: `test/domain/scoringModel.test.ts`, `test/domain/estimationOptions.test.ts`

**Interfaces:**
- Consumes: `dimensionGroup(d: ScoringDimension)` from Task 4.
- Produces: nothing later.

**The refusal STAYS and is register-backed** (`docs/requirements/Configuring the estimation
model.md`, extension 3b). Reading `weightedScore.ts` argues the opposite at first glance —
`computeTotal` renormalises by the answered dimensions' own weight sum, so a model totalling
87 computes a number without dividing by zero. That renormalisation is what makes a PARTIAL
profile agree with `docs/requirements/The scoring model is configuration.md`'s stated
arithmetic, whose FULL profile divides by 100. At a sum of 87 a full profile divides by 87
and the model stops being the one the note specifies.

**REFUSED: a live running total in the options panel.** `BasesOption` is
`{ type, displayName, shouldHide? }` — no static-text item type, no description field. A
running total would be a new control, which is a feature, and one whose value is mostly to
paper over a refusal the register wants. Build nothing.

Only the legibility changes: the box says the rule, the refusal says what to type, the lead
sentence says where to go.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/scoringModel.test.ts`:

```ts
	it('states how far off the weights are, because that is the number to type', () => {
		// There are eight weight boxes and the view draws the problem block INSTEAD of the
		// table, so editing one is a guaranteed transient failure state whose only feedback is
		// the whole view disappearing. The delta is arithmetic already in hand.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 87 }] });
		expect(modelProblems(model)).toContain('the weights total 87, not 100 (13 short)');
	});

	it('says over rather than short when the weights exceed 100', () => {
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 110 }] });
		expect(modelProblems(model)).toContain('the weights total 110, not 100 (10 over)');
	});
```

Add to `test/domain/estimationOptions.test.ts`:

```ts
	it('names the weight rule at the box that produces the mistake', () => {
		// The refusal stays (extension 3b, register-backed). What changes is that the rule is
		// legible before the mistake is made rather than only after.
		const item = weightItem(getEstimationViewOptions(configFor({})), 'reach');
		expect(item.displayName).toBe('Weight (% of 100)');
	});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/scoringModel.test.ts test/domain/estimationOptions.test.ts`
Expected: FAIL — the sentence has no delta, the box says `Weight`.

- [ ] **Step 3: Add the delta and rename the box**

In `src/domain/scoringModel.ts`'s `modelProblems`:

```ts
	if (problems.length === 0 && Math.abs(weightSum - 100) > 1e-9) {
		// The delta, not just the sum: eight weight boxes make a transient failure guaranteed,
		// and the view draws the problem block INSTEAD of the table — so the one number the
		// reader needs is how far off they are. Arithmetic already in hand.
		const off = Math.abs(100 - weightSum);
		problems.push(`the weights total ${weightSum}, not 100 (${off} ${weightSum < 100 ? 'short' : 'over'})`);
	}
```

Round `off` only if the fixtures show a float artefact; if they do, prefer
`Number(off.toFixed(2))` over a bare `Math.round`, which would print `0` for a 0.4
mismatch that the `1e-9` test still refuses.

In `src/domain/estimationOptions.ts`'s `dimensionGroup`, the `Weight` item:

```ts
			{
				type: 'text',
				key: dimOption(id, 'weight'),
				// The rule at the box that produces the mistake, before it is made. The refusal
				// itself stays and is register-backed (`Configuring the estimation model`
				// extension 3b): at a sum of 87 a full profile divides by 87 and the model stops
				// being the one `The scoring model is configuration` specifies. A live running
				// total is REFUSED — `BasesOption` is `{ type, displayName, shouldHide? }`, so it
				// would be a new control, which is a feature.
				displayName: 'Weight (% of 100)',
				default: shippedWeight,
				placeholder: shippedWeight,
			},
```

- [ ] **Step 4: Reword the lead sentence**

In `src/i18n/en.ts`:

```ts
	'estimation.problems.lead': 'Fix the estimation model in this view\'s options first:',
```

Leave `estimation.problems.blocked` alone — it is a Notice from the setup action refusing
itself, not the block above a list, and it already names its one problem inline.

Sentence case, no new key, no data — an edit to an existing key in the existing
`estimation.*` namespace. The *what breaks if two people with different Obsidian languages
open the same vault* test answers "one sees different words".

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain test/view/estimation test/i18n/estimation.test.ts`
Expected: PASS. If a view test pins the old lead string verbatim, update it — the string
moved on purpose.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scoringModel.ts src/domain/estimationOptions.ts src/i18n/en.ts test/domain/scoringModel.test.ts test/domain/estimationOptions.test.ts
git commit -m "$(cat <<'EOF'
State the weight rule where a weight is typed

Watched failing: the delta assertions (both directions) against a sentence that
reported only the sum, and the box-name assertion against `Weight`.

The refusal itself stays and is register-backed (Configuring the estimation
model, extension 3b): computeTotal's renormalisation is what makes a PARTIAL
profile agree with the specified arithmetic, whose full profile divides by 100 —
at 87 a full profile divides by 87 and the model stops being the specified one.

REFUSED, recorded not dropped: a live running total in the options panel.
BasesOption is { type, displayName, shouldHide? } — no static text, no
description — so it would be a new control, which is a feature.
EOF
)"
```

---

### Task 6: DESIGN.md says "column headers" about two different things (decision 8)

**Files:**
- Modify: `DESIGN.md` — the **Body** and **Label** Hierarchy entries

**Interfaces:** none. No code.

The **Body** entry lists "column and bucket headers"; the **Label** entry lists "meta
cells". The estimation table's column headers measure 12px — Label — and the previous pass
put them there on purpose, because the step inside one table would otherwise have been 3px
where the rest of the interface reads at 1px. Both are right and the wording cannot say so:
"column header" means a board column's header in one and a table's column header in the
other.

- [ ] **Step 1: Qualify both entries in place**

```md
- **Body** (`var(--font-ui-small)`): row titles, card titles, board column and roadmap
  bucket headers, toolbar buttons, the filter input, empty hints. The default reading size.
- **Label** (`var(--font-ui-smaller)`, line-height 1.6–1.7): badges, chips, counts, limits,
  parent breadcrumbs, match pills, meta cells, a TABLE's column headers, the busy indicator.
  Everything that annotates rather than names. *A table's column header is a Label and a
  board column's is Body — qualified 2026-08-21, because unqualified "column header"
  appeared in both entries and an ambiguous entry in a four-step ladder is how the next
  silent drift gets in.*
```

Keep the exact surrounding prose; change only what the two lines say about column headers.

- [ ] **Step 2: Run the register gate**

Run: `npm run docs`
Expected: PASS. `DESIGN.md` is not a register note, but the gate reads wikilinks across
`docs/` and a stray one here would surface.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "$(cat <<'EOF'
Say which kind of column header each type step means

No code. The Body entry's "column and bucket headers" and the Label entry's
"meta cells" both covered a column header, and the estimation table's headers
measure 12px on purpose — a 3px step inside one table where the rest of the
interface reads at 1px. Nothing to watch fail: this is a wording fix, and the
drift it prevents is exactly what decision 5 in this pass cleaned up after.
EOF
)"
```

---

### Task 7: The register (decisions 4 and 7, plus every decision's note)

**Files:**
- Modify: `docs/requirements/Styling rules are checks.md` — three rows join the table
- Modify: `docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md`
- Modify: `docs/requirements/Reading the estimation table at a glance.md`
- Modify: `docs/requirements/Configuring the estimation model.md`
- Create: `docs/requirements/<the Whole-Column PBI>.md` — a new PBI under
  `docs/requirements/The prioritized list.md`
- Modify: `CHANGELOG.md` — an `[Unreleased]` entry

**Interfaces:** none. No code. **`docs-check.mjs` is the gate** — the register's hierarchy
and sibling orders, every wikilink, every source path a current note names, the use-case
shape, the ADR frontmatter.

**Decision 4 is a refusal and builds nothing.** `estimationOptions.ts` offers 47 boxes and
the rubric SENTENCES get none — they are stored keys hand-edited in the `.base`. Making the
ABSENCE legible where the boxes are not is impossible for decision 3's mechanical reason:
an options menu built from `{ type, displayName, shouldHide? }` has no way to say anything
that is not itself a control, and a disabled box reading "edit this in the `.base`" is a new
control with its own strings and its own styling, and a worse version of the surface
`Editing a dimension's scale` already specifies. The absence is reported where it already
is — at refusal time, by `dimensionProblems`' `8 points need 8 rubric sentences, found 5`,
which Task 4 made name its dimension the way the panel does.

**Decision 7 is a measurement and builds nothing.** `columnFit` is not generalised, no
breakpoint is added, `@container` remains unavailable.

- [ ] **Step 1: Three rows into the styling table**

In `docs/requirements/Styling rules are checks.md`, append to the `| Rule | Today |` table
(after the dimension-row divider row), matching that table's existing voice exactly — each
row naming its check and recording "watched failing":

```md
| The panel's title wears DESIGN.md's Title WEIGHT (`var(--font-medium)`), and the Answer's `var(--font-semibold)` appears in no rule for it | **Checked** 2026-08-21, `test/view/estimation/styleRules.test.ts`, both directions. Watched failing. Found by reading computed style, not by looking: 15px/**600** against a Title entry declaring 500, whose other wearer (`.pbl-empty-title`) already obeyed it. `ruleAt` cannot read a computed weight — the pair's other half is `test/view/estimation/panel.test.ts`, which asserts the title is INSIDE the header the descendant selector addresses, the exact condition three type rules in this view lost silently |
| A decoration never sizes the box the value is centred in — `.pbl-est-strip` is `position: absolute` inside a cell that is `align-self: stretch`, and neither strip cell declares `flex-direction: column` | **Checked** 2026-08-21, same file, existence and absence. Watched failing. The column flex made the two strip cells ~24px against a plain cell's ~18px, so a row centring each cell as a whole started their numbers ~3px higher — in a table whose whole job is comparing numbers across a row. The strip stays INSIDE the cell because the three cell classes share `overflow: hidden`. What no rule check reaches is whether the four numbers actually land on one baseline: that is `?measure`'s `NUM` probe, read by hand in a headless browser, and jsdom lays nothing out |
| The sorted header draws a direction ELEMENT, and the two directions draw different glyphs | **Checked** 2026-08-21, `test/view/estimation/sort.test.ts` — a DOM check rather than a rule check, because the defect was a missing element and not a missing declaration. Watched failing. `aria-sort` alone was the only difference between ascending and descending, and it is not a supported attribute on a button inside a `role="listbox"`: the direction survived neither a colour screenshot nor a screen reader. What no check here reaches is whether a 10px glyph READS on a real display — the live-vault smoke test's, and it stays owed |
```

- [ ] **Step 2: Answer two items in the smoke-test note**

In `docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md`, under
its existing `## What the harness answered about the narrow pane ahead of the walk` section
(extend it; do not start a rival one):

- The narrow-pane item gets decision 7's answer: **scrolled, with the end column hidden.**
  The row's minimum is **588px** — a 96px title floor, four 72px columns, the 140px currency
  column, five 8px gaps and 24px of padding; the panel keeps its own 320px floor, so the
  view needs about **940px** before the table's track can hold all six columns.
  `.pbl-est-table` declares `overflow-y: auto` and no `overflow-x`, and CSS computes a
  `visible` overflow on one axis to `auto` when the other is not visible — so the table has
  a horizontal scroller nobody wrote. Screenshotted at a 900px window: the `Currency` header
  and every chip on every row are past the right edge, and the only trace is a 2px sliver of
  an orange chip against the table's border — the scroll edge, not a partial draw.
- The `Current`-chip item gets its DEFAULT-colour half: looked at in both schemes at 1200px,
  the chip reads against the panel's `--background-secondary` fill and against a row.

Mark both as **harness observations** (ADR 0020), keep the community-theme half open, and
**the note stays Open**.

- [ ] **Step 3: Two requirement notes**

- `docs/requirements/Reading the estimation table at a glance.md` — the sort direction is
  part of reading the table at a glance. Its `## Where it lives` describes a header that now
  draws a direction glyph and states the direction in the button's accessible name, with
  `aria-sort` kept as the style hook it is.
- `docs/requirements/Configuring the estimation model.md` — extension 3b's refusal is
  unchanged; the acceptance criterion "each refusal above names the dimension" now means **by
  label**, and the note says which name and why (the panel that produced the mistake uses it).
  Record decision 4's refusal here or in the rubric note, whichever already owns the rubric
  sentences' storage, with its mechanical reason: `BasesOption` is
  `{ type, displayName, shouldHide? }`.

- [ ] **Step 4: Open the Whole-Column PBI**

Create a PBI under `docs/requirements/The prioritized list.md`. Its siblings are
`Ranking the items by value.md` (order 10, Done) and
`Reading the estimation table at a glance.md` (order 20, Open), so this one takes
**order 30**. Frontmatter, copying a sibling's exact field list and order:

```yaml
---
type: PBI
parent: "[[The prioritized list]]"
order: 30
status: Open
created: 2026-08-21
source: design pass, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---
```

The body carries decision 7's measurement and **its CORRECTED reason**. The previous spec's
decision 11 deferred this with "a real breakpoint wants a live vault's actual pane widths
rather than a threshold guessed in a harness". **That reason is false and must be recorded
as false**, so the next reader does not defer it for a reason already known to be wrong:
`columnFit` guesses no threshold — it SUMS the drawn columns' own widths against the measured
pane, precisely because "a fixed CSS breakpoint would clip two 280px columns in a 700px pane".
No breakpoint is wanted and none is being guessed.

The honest reason is **size**: the tree's mechanism is a measure-then-re-render pass
(`syncColumnFit` returns whether the verdict CHANGED and the caller owes another pass), a
header that must describe the same frame as the rows, and — new here, with no counterpart in
the tree — a **persisted sort pick that can name a column this pane does not draw**.

- [ ] **Step 5: The changelog entry**

Add to `CHANGELOG.md`'s `[Unreleased]` section — one entry earned by this PR, not invented at
release time. Cover what a user sees: the sort direction now readable and announced, the four
numeric columns on one baseline, the panel title at its declared weight, dimension problems
named the way the options panel names them, and the weight rule stated at the box.

- [ ] **Step 6: Run the register gate and the full check**

```bash
npm run docs
npm run check
```

Expected: both PASS, `check` green whole at exit 0. Rule 7 (every module in `src/` specified
by a use case's `## Where it lives` or an ADR's `## Decision`) is not at risk — this pass adds
no module — but the hierarchy, the sibling orders and every wikilink are.

- [ ] **Step 7: Commit — explicit paths only**

Another session shares this checkout. **Never `git add docs/`.**

```bash
git add "docs/requirements/Styling rules are checks.md" \
        "docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md" \
        "docs/requirements/Reading the estimation table at a glance.md" \
        "docs/requirements/Configuring the estimation model.md" \
        "docs/requirements/<the new PBI>.md" \
        CHANGELOG.md
git commit -m "$(cat <<'EOF'
Record what this pass measured, refused, and opened

Three rows into the styling table, each naming its check and what was watched
failing. Two smoke-test items answered as harness observations (ADR 0020) with
the community-theme halves still open; the note stays Open.

Decision 4 refused with its mechanical reason: BasesOption is
{ type, displayName, shouldHide? }, so a legible absence where the rubric boxes
are not would be a new control, and a worse version of the surface `Editing a
dimension's scale` already specifies. Nothing built.

Decision 7 measured and opened as a PBI: 588px row minimum, ~940px before the
track holds six columns, a horizontal scroller nobody wrote, and the end column
hidden behind it. Its previously recorded reason for deferral was FALSE
(columnFit guesses no threshold — it sums drawn columns against the measured
pane) and is corrected in the note. The honest reason is size, including a
persisted sort pick that can name a column this pane does not draw.
EOF
)"
```

---

### Task 8: Gate, and hand over

**Files:** none.

- [ ] **Step 1: Full check**

```bash
npm run check
```

Expected: all five steps green, exit 0. If `analyze` reports the three PRE-EXISTING findings
(5 dev dependencies in production, one clone group in `src/ui/prompts.ts`, warn-level
private-type-leaks), leave every one of them alone.

- [ ] **Step 2: Confirm no budget was raised**

```bash
git diff origin/main --stat -- eslint.config.mjs vitest.config.mts scripts/styles-assemble.mjs .fallowrc.json
```

Expected: empty, or a diff with no cap or threshold in it. A raised cap or a lowered coverage
threshold is a failure of this plan, not a result of it.

- [ ] **Step 3: The vault handover**

```bash
npm run test-build
```

- [ ] **Step 4: Say what is still owed**

Report plainly, without hedging: the live-vault smoke test is **still owed**. Unanswerable
here (ADR 0020) are the plain `Current` chip and the accent value strip under a COMMUNITY
theme — the harness answers only Obsidian's DEFAULT colours — and whether a 10px sort glyph
reads on a real display. Say which decisions were closed by measurement and which by a test,
and name the two that built nothing on purpose.

---

## Self-Review

**Spec coverage.** Decision 1 → Task 3. Decision 2 → Task 4. Decision 3 → Task 5.
Decision 4 (refusal) → Task 7 step 3. Decision 5 → Task 1. Decision 6 → Task 2.
Decision 7 (measurement) → Task 7 steps 2 and 4. Decision 8 → Task 6. The spec's
`## Where it lives` names seven files; all seven appear in the File Structure table. Its
`## Tests` names six test files plus the read-by-hand pair; all six are in the table, and
the read-by-hand half is Task 1 step 7 and Task 2 step 9. Its `## Register` names six
targets; all six are in Task 7. One deliberate deviation, recorded: the spec says
`table.test.ts` gets nothing because it is "at 438 of 450" — that number is raw lines and the
budget counts 316, so the file has room. Nothing is added there anyway, because the spec is
right that decision 6's structural half is already asserted in it.

**Placeholder scan.** Two placeholders remain by design and each is a MEASUREMENT, not a
gap: `<MEASURED>` in Task 2 step 7 (the strip's block-end offset, settled by step 9's
readings — the spec is explicit that it is a measured number and not a chosen one) and
`<the new PBI>` in Task 7 (a note title, chosen when the note is written). Every commit
message carries `<paste …>` markers for numbers only a run can produce. No step says "add
appropriate error handling" or "write tests for the above".

**Type consistency.** `dimensionGroup` changes from `(id: string)` to `(d: ScoringDimension)`
in Task 4 and Task 5 edits that same signature's `Weight` item — Task 5 declares the
dependency. `wireSortClick(view, btn, spec, active)` is defined once, in Task 3 step 5, and
called twice in the same step. The `NUM <col> top=… bottom=… h=…` line format is written in
Task 2 step 1 and asserted in step 2 with the same prefix. `estimation.sort.ascending` /
`estimation.sort.descending` are spelled identically in Task 3 steps 4 and 5.
