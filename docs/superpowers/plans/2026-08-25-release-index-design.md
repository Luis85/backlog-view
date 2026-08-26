# Release index redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the release index's five-column button grid with a two-line band per release, grouped into In flight and Shipped, carrying progress, a released date, slip and an overdue warning — and fix the specificity defect that makes every row paint as a raised button.

**Architecture:** Three new `ReleaseFigure`s and two derived values land on `ReleaseRow` in `src/domain/releases.ts`, which stays the only place any of them is computed — the single-release screen reads the same row, which is what stops a band and a release header disagreeing. `releaseIndex` gains a `today` parameter injected by the view (the `writePlan.ts` convention) and gains shipped-ness as its sort's first key; the flat `rows` array stays flat and stays the sorted one. `renderIndex.ts` emits a group heading where a row's own `shipped` flag changes — grouping is where the heading falls, never what the order is.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0 floor), vitest + jsdom, esbuild, plain CSS partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-25-release-index-design-design.md`. Read it before Task 1; every task below implements part of it and none of them restates its reasoning.

## Global Constraints

- **`npm run check` must pass before every commit** — build, lint, coverage-thresholded tests, fallow, docs register. **Run it in the FOREGROUND and BLOCK on it.** Several agents on the previous branch backgrounded it and ended their turn; do not.
- **A passing `npx eslint` is NOT evidence.** Fallow's COGNITIVE complexity budget is separate from eslint's cyclomatic `complexity: 16` and only runs inside `npm run check` (via `npm run analyze`).
- **Coverage floors only ever go UP, and each is set UNDER the one-fewer-covered-unit figure**, never at the measurement. `vitest.config.mts` records two past CI failures from getting this wrong. Current floors: statements 98.91 / branches 95.42 / functions 99.90 / lines 99.74.
- **Every user-visible string goes through `t()`** with its key in `src/i18n/en.ts`. Two shapes lint cannot see and that have shipped untranslated here before: **a template whose first quasi is empty** (`` `${n} of ${total} done` ``) and **a sentence passed as a positional ARGUMENT to a helper** or returned from one. A plural form is a catalog `{ one, other }` object, never an `n === 1 ? … : …` written at the call.
- **Nothing the plugin writes, matches or persists goes in the catalog** — property keys, type names, state values. The test when it is not obvious: what breaks if two people with different Obsidian languages open the same vault.
- **`domain/` never touches the DOM and never reads a clock.** `today` is injected. Enforced by `no-restricted-imports`.
- **`src/` files are capped at 400 lines** and `styles/` partials likewise, both enforced by lint/build. `renderIndex.ts` is at 294.
- **Stage by explicit path.** Never `git add -A`, `git add .`, or `git commit -a`.
- **Never put a model identifier** in a commit message, a changelog entry, or any pushed artifact.
- **Read the register before reasoning from the code.** A proposal that reads as obvious from the source alone is the one most likely already refused in `docs/`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore. If the check cannot reach the whole claim, narrow the sentence rather than leaving the wider one standing.
- **Do not push and do not open a PR.** The controller does both.

---

### Task 1: The specificity fix

Independent of the redesign and outlives it: the row stays a real `<button>` whatever the layout becomes, so this ships first and could ship alone.

**Files:**
- Modify: `styles/release.css`
- Create: `docs/issues/The release index rows paint as Obsidian buttons.md`
- Test: `test/view/release/rowChrome.test.ts`

**Interfaces:**
- Produces: nothing other tasks consume. The compound selector `button.pbl-rel-row` is the artifact later tasks must not lower back to a bare class.

**Background.** `.pbl-rel-row` is a bare class at specificity `(0,1,0)`. Obsidian's `app.css` carries `button:not(.clickable-icon)` at `(0,1,1)`, declaring `background-color: var(--interactive-normal)` and `box-shadow: var(--input-shadow)`. `(0,1,1)` wins regardless of source order, so the row's own reset never applies. Measured in headless Chromium on 2026-08-25: the row computes `rgb(51, 51, 51)` over a body of `rgb(28, 28, 28)`. `justify-content` is a third loss — the plugin never declares it, so Obsidian's bare `button { justify-content: center }` supplies it.

The fix pattern is `styles/cardChildren.css`'s `button.pbl-card-kids-toggle` and the one `docs/issues/Four other controls still lose to Obsidian's button rule.md` prescribes: element-qualify to tie at `(0,1,1)` and win on source order.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/rowChrome.test.ts`. This checks what a test in this repository CAN check — that the assembled stylesheet still spells the reset at a compound selector — and its docblock says plainly what it cannot.

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * **This test is narrower than the claim it guards, and the narrow sentence is the honest
 * one.** No test here can compute a selector's specificity against Obsidian's own
 * stylesheet: `app.css` is not a dependency, jsdom computes no styles, and the browser
 * harness draws without asserting (ADR 0020). What is checked is that the assembled
 * stylesheet still spells the row's chrome reset at a COMPOUND selector — so a change that
 * lowers it back to a bare class fails here. It would not notice a DIFFERENT Obsidian rule
 * outranking a DIFFERENT declaration.
 *
 * The measurement that found the defect is a headless-Chromium probe, recorded in
 * `docs/issues/The release index rows paint as Obsidian buttons.md`, and it is deliberately
 * not in `npm run check` for the reason ADR 0020 gives.
 */
describe('the index row does not paint as an Obsidian button', () => {
	const css = readFileSync('styles/release.css', 'utf8');

	it('resets the background and the shadow at a compound selector', () => {
		// `button.pbl-rel-row` is (0,1,1) and ties Obsidian's `button:not(.clickable-icon)`,
		// then wins on source order. A bare `.pbl-rel-row` is (0,1,0) and loses outright.
		const block = css.match(/button\.pbl-rel-row\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the row').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
	});

	it('states its own main-axis alignment rather than inheriting Obsidian’s centring', () => {
		// Obsidian's bare `button` declares `justify-content: center`. The row never did,
		// so a dropped column would centre what is left.
		expect(css).toMatch(/\.pbl-rel-row\s*\{[^}]*justify-content:\s*flex-start/);
	});

	it('keeps a focus indicator that does not depend on Obsidian’s ring', () => {
		// The reset above declares `box-shadow: none` at (0,1,1), which ties Obsidian's own
		// `button:focus-visible` and wins on order — so without an explicit outline, focus
		// would go invisible rather than merely lose its fill.
		expect(css).toMatch(/\.pbl-rel-row:focus-visible\s*\{[^}]*outline:/);
	});
});
```

- [ ] **Step 2: Run it and watch the first two fail**

Run: `npx vitest run test/view/release/rowChrome.test.ts`
Expected: the compound-selector test FAILS (`no element-qualified reset for the row`) and the `justify-content` test FAILS. The `:focus-visible` test already PASSES — the row has that rule today, and it is asserted so the fix cannot silently remove it.

- [ ] **Step 3: Apply the fix**

In `styles/release.css`, leave the existing `.pbl-rel-row` block alone except for adding the alignment, and add the element-qualified override immediately after it:

```css
.pbl-rel-row {
	/* …every existing declaration stays… */
	/* Obsidian's bare `button` declares `justify-content: center`, which this row never
	   contradicted: harmless while the name column takes the slack, wrong the moment a
	   figure column drops. */
	justify-content: flex-start;
}

/* Obsidian's own `button:not(.clickable-icon)` is (0,1,1) and declares a filled background
   and a raised shadow; the bare class above is (0,1,0) and loses to it whatever the source
   order, so the reset in it never applied and every row painted as a raised control.
   Measured in headless Chromium on 2026-08-25: `rgb(51, 51, 51)` over a body of
   `rgb(28, 28, 28)`. Element-qualifying ties (0,1,1) and then wins on order — the
   `button.pbl-card-kids-toggle` pattern in `styles/cardChildren.css`, and the fix
   `docs/issues/Four other controls still lose to Obsidian's button rule.md` prescribes for
   exactly this shape. See `docs/issues/The release index rows paint as Obsidian buttons.md`.

   A row is a row, not a raised control — but it stays a real `<button>`: picking a release
   is this view's whole navigation, and the 2026-08-23 `display: contents` measurement is
   what established that a row without a box is a row without a tab stop. */
button.pbl-rel-row {
	background-color: transparent;
	box-shadow: none;
}
```

- [ ] **Step 4: Run the test and watch all three pass**

Run: `npx vitest run test/view/release/rowChrome.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Verify the fix in headless Chromium**

Build the harness and measure the real cascade — the second of the two ways this repository's precedent requires.

```bash
npm run harness -- test/harness/release.ts
```

Then write a throwaway probe (delete it afterwards; `.harness/` is gitignored):

```bash
cat > .harness/probe.html <<'EOF'
<!doctype html><html><head>
<link rel="stylesheet" href="obsidian.css">
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="styles.css">
</head><body class="theme-dark">
<div class="pbl-view pbl-rel-view"><div class="pbl-rel-list"><div class="pbl-rel-grid">
<button type="button" class="pbl-rel-row"><span class="pbl-rel-name">0.8</span></button>
</div></div></div>
<pre id="out"></pre>
<script>
const c = getComputedStyle(document.querySelector('.pbl-rel-row'));
document.getElementById('out').textContent = JSON.stringify({
  backgroundColor: c.backgroundColor, boxShadow: c.boxShadow, justifyContent: c.justifyContent,
}, null, 1);
</script></body></html>
EOF
CHROME=$(command -v chromium || echo /opt/pw-browsers/chromium)
"$CHROME" --headless --disable-gpu --no-sandbox --dump-dom "file://$PWD/.harness/probe.html" 2>/dev/null \
  | sed -n '/<pre id="out">/,/<\/pre>/p'
rm .harness/probe.html
```

Expected AFTER the fix: `backgroundColor: "rgba(0, 0, 0, 0)"`, `boxShadow: "none"`, `justifyContent: "flex-start"`.
Record the before and after numbers — Step 6's note needs them.

- [ ] **Step 6: Write the bug note**

Create `docs/issues/The release index rows paint as Obsidian buttons.md`. This is the "Recorded separately" that `2026-08-24-releases-own-their-creation-design.md`'s Out of scope promised and nobody filed. Follow the frontmatter shape of `docs/issues/Four other controls still lose to Obsidian's button rule.md` (`type: Issue`, `order`, `parent`, `status`, `priority`, `area`, `created`, `closed`, `source`, `files`, and the empty `started`/`finished`/`horizon`/`start`/`due`/`risk`/`assignee` fields — `docs-check.mjs` requires them).

Parent it under `[[Codebase health]]` and set `status: Done` with today's `closed`, since this task fixes it. The body states: the two selectors and their specificities, the measured before and after from Step 5, why no check in this repository could have seen it (jsdom computes no styles; the harness asserts nothing, ADR 0020), that the row only became a `<button>` on 2026-08-23 — after the earlier sweep closed — which is why no audit reached it, and that the live-vault question stays open because a theme can style `button` harder than the harness's baseline.

- [ ] **Step 7: Audit the other bare-class buttons in this stylesheet**

Run `grep -n "^\.pbl-rel-[a-z-]*\s*{" styles/release.css` and, for each, check whether the class names a real `<button>` in `src/view/release/`. `.pbl-rel-back` (the scope screen's back control, `renderScope.ts`) is the known candidate. For each one found:

- If it should carry NO button chrome, apply the same element-qualified override and say so.
- If it WANTS button chrome, leave it and say in a comment that it is deliberate. `.pbl-rel-new` carries `mod-cta` and is exactly this case — leave it alone and note it.

Add a test case per control changed to `rowChrome.test.ts`, in the same shape as Step 1's first test.

- [ ] **Step 8: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add styles/release.css test/view/release/rowChrome.test.ts "docs/issues/The release index rows paint as Obsidian buttons.md"
git commit -m "Stop the index rows painting as Obsidian buttons"
```

---

### Task 2: The three new option declarations

**Files:**
- Modify: `src/domain/releaseOptions.ts`, `src/i18n/en.ts`
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Produces: `ReleaseSettings` gains `releasedDateKey: string`. Tasks 3–5 read it. The state property and its done values arrive on the settings `buildModel` already receives (`stateKey`, `doneValues` on `BacklogSettings`) rather than on `ReleaseSettings` — see Step 3.

**Background.** `getReleaseViewOptions` declares eight options today in two groups (`modelGroup`, `releaseGroup`). This adds three, making ten declared keys. `resolveReleaseSettings` reads them with `configReaders(config)`; read that function's existing comments before touching it — the `clearablePropKey` vs `propKey` distinction is load-bearing and already stated there.

**Why the state property matters beyond convenience:** `stateKey` defaults to `''`, so a progress figure built on today's model would read **0%** on any base that never bound a state property — silently, and identically to a release where nothing is finished. Declaring the option is what turns that into an absent figure named once.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/releaseOptions.test.ts`, following the shape of the existing "resolves each key, and leaves an unconfigured one empty" test in that file:

```ts
it('declares the state property, its done values, and the released date', () => {
	const groups = getReleaseViewOptions(emptyConfig());
	const keys = groups.flatMap((g) => ('items' in g ? g.items : [])).map((i) => i.key);
	expect(keys).toContain('stateProperty');
	expect(keys).toContain('doneValues');
	expect(keys).toContain('releasedDateProperty');
});

it('resolves the released date key, and leaves it empty when unbound', () => {
	// `propKey`, not `clearablePropKey`: the default is '' so the two resolve the same
	// value for every input, exactly as `versionKey` and the other release-own keys do.
	expect(resolveReleaseSettings(configWith({ releasedDateProperty: 'note.released' })).releasedDateKey).toBe(
		'released',
	);
	expect(resolveReleaseSettings(emptyConfig()).releasedDateKey).toBe('');
});
```

Use whatever `emptyConfig()` / `configWith()` helpers that file already has; do not invent new ones.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: FAIL — `stateProperty` not in keys, and `releasedDateKey` is not a property of `ReleaseSettings` (a compile error under `npm run build`).

- [ ] **Step 3: Declare the options**

In `src/domain/releaseOptions.ts`, add to `releaseGroup()`'s `items`, before the `releaseFolder` folder option:

```ts
{
	type: 'property',
	key: 'stateProperty',
	displayName: t('release.option.state'),
	placeholder: 'status',
	filter: notePropsOnly,
},
{
	type: 'text',
	key: 'doneValues',
	displayName: t('release.option.doneValues'),
	placeholder: 'Done, Shipped',
},
{
	type: 'property',
	key: 'releasedDateProperty',
	displayName: t('release.option.releasedDate'),
	placeholder: 'released',
	filter: notePropsOnly,
},
```

Check the `type: 'text'` spelling against how `viewOptions.ts` declares its own comma-separated value lists (`doneValues` there) and copy that shape exactly — including how the list is parsed on the way out — rather than guessing.

Add `releasedDateKey: string;` to the `ReleaseSettings` interface with a doc comment saying it is on the RELEASE note (beside `versionKey`), and resolve it in `resolveReleaseSettings`:

```ts
// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the same
// value for every input — the reason already stated above for `versionKey`.
releasedDateKey: propKey('releasedDateProperty', ''),
```

**`stateProperty` and `doneValues` deliberately do NOT join `ReleaseSettings`.** They are keys `resolveSettings` already reads by name onto `BacklogSettings` as `stateKey` and `doneValues`, and `releaseView.ts`'s `buildModel` call already spreads `resolveSettings(this.config)` — so declaring the options is the whole of the plumbing and `item.done` starts answering. Adding them to `ReleaseSettings` too would be two readers of one config key that can disagree. State this in a comment at the declarations.

- [ ] **Step 4: Add the catalog keys**

In `src/i18n/en.ts`, beside the existing `release.option.*` keys:

```ts
'release.option.state': 'Workflow state property',
'release.option.doneValues': 'States that count as done',
'release.option.releasedDate': 'Released date property',
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/domain/releaseOptions.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "Declare the state, done values and released date on the release view"
```

---

### Task 3: `released` and `slip` on the row

**Files:**
- Modify: `src/domain/releases.ts`
- Test: `test/domain/releases.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings.releasedDateKey` (Task 2).
- Produces: `ReleaseRow` gains `released: ReleaseFigure<CivilDate>` and `slip: number | null`. Tasks 5, 6 and 7 read both.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/releases.test.ts`. Its `KEYS` literal is the settings fixture — it needs `releasedDateKey` added. Note that file is **not type-checked** (`tsconfig.json` covers `src/**/*.ts` only), so a missing field will not fail the build; add it by hand.

```ts
it('reads the released date with the same three answers as the target', () => {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', released: '2026-09-14' } });
	vault.addFile('U.md', { frontmatter: { type: 'Release', released: ['a', 'b'] } });
	vault.addFile('N.md', { frontmatter: { type: 'Release' } });
	const rows = indexOf(vault).rows;

	expect(row(rows, 'R.md').released.value).toEqual({ year: 2026, month: 9, day: 14 });
	expect(row(rows, 'U.md').released.invalid).toBe(true);
	expect(row(rows, 'N.md').released.value).toBeNull();
	expect(row(rows, 'N.md').released.invalid).toBe(false);
});

it('reports the released date as unconfigured when no key is bound', () => {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', released: '2026-09-14' } });
	const rows = releaseIndex(vault.app, modelOf(vault), { ...KEYS, releasedDateKey: '' }).rows;
	expect(row(rows, 'R.md').released.unconfigured).toBe(true);
});

it('derives slip as released minus target in days, negative when early', () => {
	const vault = new FakeVault();
	vault.addFile('Late.md', { frontmatter: { type: 'Release', target: '2026-09-10', released: '2026-09-14' } });
	vault.addFile('Early.md', { frontmatter: { type: 'Release', target: '2026-09-10', released: '2026-09-08' } });
	vault.addFile('OnTime.md', { frontmatter: { type: 'Release', target: '2026-09-10', released: '2026-09-10' } });
	vault.addFile('NoRelease.md', { frontmatter: { type: 'Release', target: '2026-09-10' } });
	vault.addFile('NoTarget.md', { frontmatter: { type: 'Release', released: '2026-09-10' } });
	const rows = indexOf(vault).rows;

	expect(row(rows, 'Late.md').slip).toBe(4);
	expect(row(rows, 'Early.md').slip).toBe(-2);
	expect(row(rows, 'OnTime.md').slip).toBe(0);
	// Null without EITHER date — never zero, which would read as "shipped on time".
	expect(row(rows, 'NoRelease.md').slip).toBeNull();
	expect(row(rows, 'NoTarget.md').slip).toBeNull();
});
```

Write the small `indexOf`, `modelOf` and `row` helpers at the top of the file if that file does not already have equivalents; reuse its existing ones if it does.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: FAIL — `released` and `slip` are undefined on the row.

- [ ] **Step 3: Implement**

In `src/domain/releases.ts`, add to the `ReleaseRow` interface:

```ts
/**
 * On the RELEASE note: the date it actually shipped. Read exactly as {@link target} is,
 * with the same three answers — unset, unreadable, a date. It is what tells shipped from
 * in flight AND what makes {@link slip} derivable: one binding, two figures. Picked over
 * interpreting a status string or inferring shipped-ness from 100% progress, both of
 * which are wrong in both directions.
 */
released: ReleaseFigure<CivilDate>;
/**
 * Released minus target, in days. **Derived, never read** — no note carries it.
 *
 * Null without EITHER date, and that is not the same as `0`: a zero slip means shipped on
 * the day promised, where null means the question cannot be asked yet. Negative means
 * early, which is a real answer rather than an error.
 */
slip: number | null;
```

Add the reading inside the `model.releases.map` callback, beside `target`:

```ts
released: settings.releasedDateKey ? figure(readTarget(ownValue(fm, settings.releasedDateKey))) : UNCONFIGURED,
```

and compute `slip` from the two figures after the object is built, or inline via a helper:

```ts
/**
 * Whole days between two civil dates, `b - a`. Both are civil — year, month and day as the
 * notes spell them — so this converts through UTC midnight deliberately: `Date.UTC` has no
 * zone and no DST, which is what keeps a span the same number of days whoever reads it.
 * A local-time construction would give 23 or 25 hours across a DST boundary and round to
 * the wrong day.
 */
function daysBetween(a: CivilDate, b: CivilDate): number {
	const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
	return Math.round(ms / 86_400_000);
}
```

`slip` is then `target.value !== null && released.value !== null ? daysBetween(target.value, released.value) : null`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/domain/releases.ts test/domain/releases.test.ts
git commit -m "Read a release's released date, and derive its slip"
```

---

### Task 4: `done` on the row, counted in the walk that already counts members

**Files:**
- Modify: `src/domain/releases.ts`
- Test: `test/domain/releases.test.ts`

**Interfaces:**
- Produces: `ReleaseRow` gains `done: ReleaseFigure<number>`. Tasks 6 and 7 read it with `members` to draw progress.

**Background.** `releaseIndex` already walks `scannableRows(model)` once, resolving each item's membership through `membershipTarget` and incrementing a `counts` map. The done count rides that same walk — one traversal, one denominator. `item.done` is the requirements reading on `BacklogItem`, computed by `buildModel` from `stateKey` and `doneValues`, which Task 2's option declaration is what supplies.

- [ ] **Step 1: Write the failing test**

```ts
it('counts done members over the same population as members', () => {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release' } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[R]]', status: 'Done' } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', release: '[[R]]', status: 'Done' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', release: '[[R]]', status: 'Doing' } });
	const rows = indexOf(vault).rows;

	expect(row(rows, 'R.md').members.value).toBe(3);
	expect(row(rows, 'R.md').done.value).toBe(2);
});

it('counts no ancestor that is not itself a member', () => {
	// The context-row rule, asked of this figure: an ancestor drawn for context is never a
	// counting source. Adding one changes no number.
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release' } });
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[R]]', status: 'Done' }, parentLink: 'Epic' });
	const rows = indexOf(vault).rows;

	expect(row(rows, 'R.md').members.value).toBe(1);
	expect(row(rows, 'R.md').done.value).toBe(1);
});

it('reports done as unconfigured without a state key OR without a membership key', () => {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release' } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[R]]', status: 'Done' } });
	const model = modelOf(vault);

	// No state key: nothing says what done MEANS, so the figure is absent rather than 0.
	expect(releaseIndex(vault.app, modelOf(vault, { stateKey: '' }), KEYS).rows[0].done.unconfigured).toBe(true);
	// No membership key: a done count with no membership has nothing to count OVER.
	expect(releaseIndex(vault.app, model, { ...KEYS, membershipKey: '' }).rows[0].done.unconfigured).toBe(true);
});
```

`modelOf(vault, overrides)` must let the test build a model whose `stateKey` is cleared — check how `test/domain/releasesModel.test.ts` and `test/helpers/settings.ts` already do this (`settingsWith({ stateKey: '' })`) and follow it rather than inventing a second path.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: FAIL — `done` is undefined on the row.

- [ ] **Step 3: Implement**

Add to `ReleaseRow`:

```ts
/**
 * Members whose own state is a done value — the numerator {@link members} is the
 * denominator of. A FIGURE for the reason `members` is one: unconfigured WITHOUT a state
 * property (nothing says what done means, and a `0` would read as "none finished" on a
 * base that simply never bound one) and unconfigured without a membership property too,
 * because a done count with no membership has nothing to count over.
 *
 * Counted in the same walk that counts `members`, so there is one traversal and one
 * population. Progress is this over `members` and is computed nowhere else — the
 * single-release screen reads the same row, which is what stops a band and a release
 * header disagreeing about one release.
 */
done: ReleaseFigure<number>;
```

In the walk, add a second map beside `counts` and increment it when the member is done. The state key lives on the model's settings rather than on `ReleaseSettings`, so read it off the item: `item.done` is already computed. Add a `doneCounts` map and, inside the `counts.set(...)` branch:

```ts
if (item.done) doneCounts.set(named, (doneCounts.get(named) ?? 0) + 1);
```

Then in the row:

```ts
done:
	settings.membershipKey && stateConfigured
		? figure({ value: doneCounts.get(item.file.path) ?? 0, invalid: false })
		: UNCONFIGURED,
```

`stateConfigured` needs the model's own state key. `releaseIndex` takes `(app, model, settings)`; the model does not carry its settings. **Add the state key to the signature rather than re-reading the config** — `releaseIndex(app, model, settings, stateConfigured: boolean)` is one more parameter and two callers (`releaseView.ts` and the tests). Task 5 adds `today` to the same signature; decide the final parameter shape once, in Task 5, and note here that this parameter is provisional. Simplest is a single options object; if you take that, do it here and Task 5 adds a field rather than a positional argument.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/domain/releases.ts src/view/release/releaseView.ts test/domain/releases.test.ts
git commit -m "Count a release's done members in the walk that counts its members"
```

---

### Task 5: `overdue`, the injected `today`, and shipped-first ordering

**Files:**
- Modify: `src/domain/releases.ts`, `src/view/release/releaseView.ts`
- Test: `test/domain/releases.test.ts`

**Interfaces:**
- Consumes: `released` and `slip` (Task 3), the parameter shape settled in Task 4.
- Produces: `ReleaseRow` gains `shipped: boolean` and `overdue: boolean`. Task 7 reads `shipped` to place headings; Task 6 reads `overdue` to draw the warning.

**Background.** `today` is injected by the view, following `writePlan.ts`'s convention for the same value — nothing under `domain/` reads a clock, which is what keeps every test able to say which day today is. `todayCivil()` lives in `src/domain/noteFields.ts` and the view calls it.

**Overdue is a fact, not a heuristic**: the target has passed and there is no released date. An early warning ("target near, progress low") was considered and refused — it needs two constants nobody can derive and a window to measure elapsed time against, and a release note carries no start date anywhere in the model. Overdue warns late; it is never wrong.

- [ ] **Step 1: Write the failing test**

```ts
const TODAY: CivilDate = { year: 2026, month: 9, day: 20 };

it('is overdue when the target has passed and nothing shipped', () => {
	const vault = new FakeVault();
	vault.addFile('Past.md', { frontmatter: { type: 'Release', target: '2026-09-10' } });
	vault.addFile('Future.md', { frontmatter: { type: 'Release', target: '2026-09-30' } });
	vault.addFile('Today.md', { frontmatter: { type: 'Release', target: '2026-09-20' } });
	vault.addFile('Shipped.md', { frontmatter: { type: 'Release', target: '2026-09-10', released: '2026-09-12' } });
	vault.addFile('Undated.md', { frontmatter: { type: 'Release' } });
	const rows = indexOf(vault, TODAY).rows;

	expect(row(rows, 'Past.md').overdue).toBe(true);
	expect(row(rows, 'Future.md').overdue).toBe(false);
	// The target date itself is not yet past.
	expect(row(rows, 'Today.md').overdue).toBe(false);
	// Shipped is never overdue, whatever its target — it is late, which `slip` says.
	expect(row(rows, 'Shipped.md').overdue).toBe(false);
	// No target is not a missed target.
	expect(row(rows, 'Undated.md').overdue).toBe(false);
});

it('orders in flight before shipped, and each group its own way', () => {
	const vault = new FakeVault();
	vault.addFile('FlightB.md', { frontmatter: { type: 'Release', target: '2026-10-01' } });
	vault.addFile('FlightA.md', { frontmatter: { type: 'Release', target: '2026-09-25' } });
	vault.addFile('FlightNone.md', { frontmatter: { type: 'Release' } });
	vault.addFile('ShipOld.md', { frontmatter: { type: 'Release', target: '2026-07-01', released: '2026-07-03' } });
	vault.addFile('ShipNew.md', { frontmatter: { type: 'Release', target: '2026-08-01', released: '2026-08-04' } });
	const paths = indexOf(vault, TODAY).rows.map((r) => r.path);

	expect(paths).toEqual([
		// In flight, ascending by target, undated LAST WITHIN ITS GROUP.
		'FlightA.md',
		'FlightB.md',
		'FlightNone.md',
		// Shipped, DESCENDING by released date, so the most recent heads its own tail.
		'ShipNew.md',
		'ShipOld.md',
	]);
});

it('does not reorder across repeated renders', () => {
	const vault = new FakeVault();
	vault.addFile('A.md', { frontmatter: { type: 'Release', target: '2026-09-25' } });
	vault.addFile('B.md', { frontmatter: { type: 'Release', target: '2026-09-25' } });
	const first = indexOf(vault, TODAY).rows.map((r) => r.path);
	const second = indexOf(vault, TODAY).rows.map((r) => r.path);
	expect(second).toEqual(first);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: FAIL — `overdue` is undefined, and the order test fails because shipped releases sort in among the live ones by target date.

- [ ] **Step 3: Implement**

Add to `ReleaseRow`:

```ts
/** Has a released date. What the index groups on, and never a state value. */
shipped: boolean;
/**
 * The target has passed and nothing has shipped. A FACT, not a heuristic — see the
 * design's own section on what was refused and why.
 */
overdue: boolean;
```

Compute both after the figures, with `today` from the parameter. Compare civil dates by their `dateKey` rather than by constructing `Date` objects.

The sort gains shipped-ness as its **first** key, and the two groups order differently:

```ts
rows.sort((a, b) => {
	// Shipped-ness leads. Grouping is where the HEADING falls (`renderIndex.ts`); this is
	// what the order IS, and the flat `rows` array stays the sorted one — `releaseScope`
	// and every existing test read it.
	if (a.shipped !== b.shipped) return a.shipped ? 1 : -1;
	if (a.shipped) {
		// DESCENDING by released date, so the most recent shipped release heads its own
		// tail rather than being buried under every older one. Values compared, never
		// their difference — see the note on the in-flight key below, which this shares.
		const ra = dateKey(a.released);
		const rb = dateKey(b.released);
		if (ra !== rb) return ra > rb ? -1 : 1;
	} else if (dateKey(a.target) !== dateKey(b.target)) {
		// …the existing ascending target comparison, unchanged, undated last WITHIN this
		// group now rather than within the whole list…
		return dateKey(a.target) < dateKey(b.target) ? -1 : 1;
	}
	// …the existing rank and path tie-breaks, unchanged…
});
```

Keep the existing comments on the rank and path keys — they explain live traps (the `Infinity - Infinity` NaN hazard, and why the path key is what makes the order stable). Do not delete them while restructuring around them.

In `src/view/release/releaseView.ts`, pass `todayCivil()` into the `releaseIndex` call, importing it from `../../domain/noteFields`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS. Also run the full domain suite — `releaseScope.test.ts` reads `rows` and may assume the old order.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/domain/releases.ts src/view/release/releaseView.ts test/domain/releases.test.ts
git commit -m "Sort shipped releases into their own tail, and say which are overdue"
```

---

### Task 6: The band replaces the column grid

**Files:**
- Modify: `src/view/release/renderIndex.ts`, `styles/release.css`, `src/i18n/en.ts`
- Test: `test/view/release/index.test.ts` (or the existing view test for this screen — check `test/view/releaseView.test.ts` first and put band tests wherever that screen's markup is already asserted)

**Interfaces:**
- Consumes: every figure from Tasks 3–5.
- Produces: `.pbl-rel-band` markup. Task 7 inserts headings between bands.

**The layout**, from the spec:

```
┌ 0.8   0.8.0                          12 Sep 2026 · 18 days left   [In progress]
│ ▓▓▓▓▓▓▓░░░░░  8 of 14 done                              3 days overdue
```

- **Line 1** — name, version, then pushed to the end: the target date with days remaining, and the status chip.
- **Line 2** — a fixed-width progress bar, the counted phrase `8 of 14 done`, and a note pushed to the end: the overdue warning while in flight, or the slip once shipped.
- **Overdue** draws a 3px rule down the band's leading edge, a red date and a red bar, plus the note. Four signals, one band, one condition.
- A release with **no members** says `No items yet` and draws no bar. A zero-length bar reads as failure where the answer is emptiness.
- The member count is **folded into the progress phrase** — `8 of 14 done` states the count and the denominator in one place, which is the whole of what the Items column said.

- [ ] **Step 1: Write the failing test**

```ts
it('draws a band with a bar, a counted phrase and the status', async () => {
	const vault = new FakeVault();
	vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0', target: '2026-09-12', status: 'In progress' } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Doing' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

	const band = containerEl.querySelector('.pbl-rel-band');
	expect(band).not.toBeNull();
	expect(band?.querySelector('.pbl-rel-bar')).not.toBeNull();
	expect(band?.textContent).toContain(en['release.index.progress'].other.replace('{done}', '1').replace('{total}', '2'));
	expect(band?.querySelector('.pbl-state-chip')?.textContent).toContain('In progress');
});

it('says there is nothing to count rather than drawing an empty bar', async () => {
	const vault = new FakeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', target: '2026-09-12' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
	const band = containerEl.querySelector('.pbl-rel-band');

	expect(band?.textContent).toContain(en['release.index.noMembers']);
	expect(band?.querySelector('.pbl-rel-bar')).toBeNull();
});

it('marks an overdue release and names why', async () => {
	// today is stubbed by the harness; see the existing date tests for how.
	const vault = new FakeVault();
	vault.addFile('Late.md', { frontmatter: { type: 'Release', target: '2026-01-01' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
	const band = containerEl.querySelector('.pbl-rel-band');

	expect(band?.classList.contains('pbl-rel-overdue')).toBe(true);
});

it('pairs every figure with its label in the accessible name', async () => {
	const vault = new FakeVault();
	vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0', target: '2026-09-12' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
	const label = containerEl.querySelector('.pbl-rel-band')?.getAttribute('aria-label') ?? '';

	expect(label).toContain('0.8');
	expect(label).toContain(en['release.index.column.version']);
	expect(label).toContain('0.8.0');
});
```

Check how the existing release view tests stub `today` before writing the overdue case — if nothing does yet, the view calls `todayCivil()` and the test must control it; the simplest honest route is a fixture whose target is far enough in the past that any real today is after it, and a comment saying so.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/release/`
Expected: FAIL — no `.pbl-rel-band` in the markup.

- [ ] **Step 3: Add the catalog keys**

```ts
'release.index.progress': { one: '{done} of {total} item done', other: '{done} of {total} items done' },
'release.index.noMembers': 'No items yet',
'release.index.daysLeft': { one: '{count} day left', other: '{count} days left' },
'release.index.daysOverdue': { one: '{count} day overdue', other: '{count} days overdue' },
'release.index.daysLate': { one: '{count} day late', other: '{count} days late' },
'release.index.daysEarly': { one: '{count} day early', other: '{count} days early' },
'release.index.shippedOnTime': 'Shipped on time',
```

**`release.index.progress` is why this is a key and not a template**: `` `${done} of ${total} items done` `` has an EMPTY first quasi, which is one of the two shapes lint cannot see and which has shipped untranslated in this repository before. Say so in a comment at the key.

- [ ] **Step 4: Implement the band**

Rewrite `renderIndex.ts`'s row drawing. The `ColumnSpec` list, `columnSpecs()`, `drawableColumns()`, `columnWidthVar()` and `sizeCell()` all go with the grid. **`rowLabel` does not go** — the accessible-name composition survives and is rebuilt over the band's own parts, still composing every piece through the catalog and joining with `Intl.ListFormat` inside it, never a joiner written at the call.

Keep `drawAbsences` and `drawUnresolved`, which are about the list rather than the row. `drawAbsences` reads `columnSpecs()`; it now reads the band's own figure list instead — same rule, new source.

The band stays a real `<button>` with `type="button"`, `data-path` and `aria-label`, and `renderNewRelease` is untouched at the head of the index.

Watch the 400-line cap: `renderIndex.ts` is at 294 and the band adds more than the grid removes. If it crosses, split the band's own drawing into `src/view/release/renderBand.ts` **as its own commit before the behaviour change**, and add that module to `docs/requirements/Every release in one list.md`'s `## Where it lives` in the same commit — `docs-check.mjs` rule 7 requires every `src/` module to be specified, so the gate is red at a commit that adds one without it.

- [ ] **Step 5: Style the band**

In `styles/release.css`, replace the grid rules with the band's. Keep `button.pbl-rel-band` element-qualified from the start — Task 1's whole finding is that a bare class loses. The bar is a fixed-width track with a filled portion; overdue is one condition driving four declarations (leading rule, date colour, bar colour, and the note), grouped under a single `.pbl-rel-overdue` block so the four cannot drift apart.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view/release/ test/view/releaseView.test.ts`
Expected: PASS.

- [ ] **Step 7: Look at it**

```bash
npm run harness -- test/harness/release.ts
```

Open the printed URL and read the screen in both schemes (`?theme=light`) and at the 500px minimum. This answers layout, spacing, hierarchy and **Obsidian's default colours only**. It does not answer a themed vault's colours, its accent, or whether `--text-error` reads as a warning rather than an error under one. Note anything that looks wrong and fix it before committing; note anything that cannot be answered here for Task 8's smoke-suite step.

- [ ] **Step 8: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/view/release/renderIndex.ts styles/release.css src/i18n/en.ts test/view/release/
git commit -m "Draw a release as a band with its progress, not a row of columns"
```

---

### Task 7: The two groups and their headings

**Files:**
- Modify: `src/view/release/renderIndex.ts`, `styles/release.css`, `src/i18n/en.ts`
- Test: the same view test file as Task 6

**Interfaces:**
- Consumes: `ReleaseRow.shipped` (Task 5) and the band (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
it('heads each group where shipped-ness changes, with its count', async () => {
	const vault = new FakeVault();
	vault.addFile('Live.md', { frontmatter: { type: 'Release', target: '2026-12-01' } });
	vault.addFile('Ship1.md', { frontmatter: { type: 'Release', target: '2026-07-01', released: '2026-07-02' } });
	vault.addFile('Ship2.md', { frontmatter: { type: 'Release', target: '2026-06-01', released: '2026-06-02' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

	const headings = [...containerEl.querySelectorAll('.pbl-rel-group')].map((h) => h.textContent ?? '');
	expect(headings).toHaveLength(2);
	expect(headings[0]).toContain(en['release.index.group.inFlight']);
	expect(headings[1]).toContain(en['release.index.group.shipped']);
	// The count is the group's own, not the list's.
	expect(headings[1]).toContain('2');
});

it('draws no heading for a group with no releases in it', async () => {
	const vault = new FakeVault();
	vault.addFile('Live.md', { frontmatter: { type: 'Release', target: '2026-12-01' } });
	const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

	const headings = [...containerEl.querySelectorAll('.pbl-rel-group')];
	expect(headings).toHaveLength(1);
	expect(headings[0].textContent).toContain(en['release.index.group.inFlight']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/release/`
Expected: FAIL — no `.pbl-rel-group` element.

- [ ] **Step 3: Add the catalog keys**

```ts
'release.index.group.inFlight': 'In flight',
'release.index.group.shipped': 'Shipped',
'release.index.group.count': '{label} ({count})',
```

- [ ] **Step 4: Implement**

In the row loop, emit a heading when a row's `shipped` differs from the previous row's — which is exactly "where the flag changes", never a second sort and never a partition of the array. Say that in a comment: `releaseIndex` decided the whole order and this module still re-sorts nothing.

Count each group by counting rows with that flag, once, before the loop.

- [ ] **Step 5: Style the headings**

A sticky-free label above each group, `--font-ui-smaller`, `--text-faint`, consistent with `.pbl-rel-head`'s treatment. The heading is not a row and is not focusable.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view/release/ test/view/releaseView.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add src/view/release/renderIndex.ts styles/release.css src/i18n/en.ts test/view/release/
git commit -m "Group the index into what is in flight and what has shipped"
```

---

### Task 8: The register, the changelog and the floors

**Files:**
- Modify: `docs/requirements/Every release in one list.md`, `docs/tests/suites/Smoke test the release view.md`, `CHANGELOG.md`, `vitest.config.mts`, `CLAUDE.md`

- [ ] **Step 1: Correct what earlier tasks made false**

Check each against the tree before editing; one or two may already have been handled.

- **`docs/requirements/Every release in one list.md`** — extension **3a** becomes "undated last *within its group*"; new extensions for the shipped grouping, the released date's three answers, and overdue; the `## Where it lives` section rewritten for the band and for any module Task 6 split out. Its main flow already says a row shows "progress, commitment against capacity, and slip" — **progress and slip now ship; commitment against capacity does not** and belongs to epic rank 40. Say which is which rather than leaving the sentence reading as fully delivered.
- **Extension 1b** of the same note still says the empty state "offers **no create button**". The previous increment added one. Correct it.
- **`docs/requirements/Every release at once.md`** — check whether its own text describes the five-column grid, and correct it if so.

- [ ] **Step 2: Fold the live-vault items into the smoke suite**

`docs/tests/suites/Smoke test the release view.md` already carries six unrun items from the two increments before this one. Add, rather than starting a second list:

- whether the band's `<button>` reset holds against a **theme** that styles `button` harder than the harness's baseline — precisely the surface Task 1's defect lives on;
- whether `--text-error` reads as a *warning* under a theme rather than as an error;
- whether the two new options appear correctly in the Bases options menu, and whether Obsidian's property picker can offer a released-date property no note yet carries;
- how the band reads at a real pane width in a real vault, in both schemes.

**Do not describe any of it as verified.** The suite's Outcome should say plainly that nothing in this increment has been seen in Obsidian.

- [ ] **Step 3: Write the changelog entry**

`CHANGELOG.md`, under `[Unreleased]` → `### Added`, `### Changed` and `### Fixed`. Write for someone deciding whether to upgrade, not for a reviewer reading a diff. Name:

- the band, the grouping and the new order (**this changes what the screen looks like** — a reader who liked the columns should learn that from here);
- the two new options, and that progress reads as absent rather than 0% until a state property is bound;
- the fixed defect: rows painted as raised buttons and no longer do.

- [ ] **Step 4: Correct the i18n key count**

`CLAUDE.md` states the catalog holds **597** keys. Measured on merged `main` on 2026-08-25 it is **643**, both ways that paragraph describes — an `Object.keys` count over the bundled catalog and a match-counting `grep -Po` over the key lines — with no duplicates. This increment adds more. **Re-measure on your own tree** with both instruments, confirm they agree, and write that number. `grep -c` counts LINES and is wrong.

- [ ] **Step 5: Raise the floors**

Run `npm run check`, read the measured coverage, and set each floor **under the one-fewer-covered-unit figure** — not at the measurement. Where one fewer falls below the floor already standing, leave that floor alone and say so in the comment, which is the exception that file already states twice.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check` in the FOREGROUND.

```bash
git add docs/ CHANGELOG.md vitest.config.mts CLAUDE.md
git commit -m "Record what the release index shows now, and what it costs"
```

---

## Self-review

**Spec coverage.** Section 1 (the measured defect) → Task 1. Section 2's band → Task 6; its two groups and order → Tasks 5 and 7; what turns a band red → Tasks 5 and 6; blocked and risky members → explicitly out of scope in the spec, and no task builds them. "What it costs": two new view options → Task 2 (three declarations, since `doneValues` accompanies `stateProperty`); three new figures → Tasks 3 and 4. "Where it lives" → the file lists of Tasks 2–7. "The accessible name" → Task 6 Step 4. "Checks" → the node tests in Tasks 3–5 and the jsdom tests in Tasks 6–7, with the narrowness caveat carried into Task 1's test docblock. "What the harness cannot answer" → Task 6 Step 7 and Task 8 Step 2. "Register edits this increment owes" → Task 8, all four bullets.

**Two things the spec names that this plan deliberately does not build**, so a reviewer does not read them as gaps: blocked and risky member counts (the spec defers them and says the band's second line is designed with room for them), and commitment against capacity (epic rank 40).

**One open decision, flagged rather than hidden.** Task 4 needs the model's state key inside `releaseIndex` and Task 5 needs `today`; both change the signature. Task 4 says to settle the parameter shape once — an options object is the recommendation — and Task 5 then adds a field rather than a third positional argument. An implementer taking Task 4 in isolation must read that step to the end before choosing.

**Type consistency.** `ReleaseFigure<T>` is `{ value: T | null; invalid: boolean; unconfigured: boolean }` throughout. `done` and `members` are both `ReleaseFigure<number>`; `released` and `target` are both `ReleaseFigure<CivilDate>`; `slip` is `number | null` and `shipped`/`overdue` are plain booleans, none of them figures — each is derived from figures that carry their own absence, so wrapping them again would be a second absence rule. `CivilDate` is `{ year, month, day }` from `src/domain/noteFields.ts`.
