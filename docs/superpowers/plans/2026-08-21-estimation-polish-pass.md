# Estimation view polish pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nine named defects in the estimation view — one reported from a vault, five
from code review, three from auditing the view against its own PBI — adding no capability.

**Architecture:** Each defect is fixed where its root cause lives, never at the call site
that reported it. Two are stylesheet faults in `styles/estimationPanel.css` and
`styles/estimation.css`; one is an ordering fault in a pure `domain/` function; the rest
are in `src/view/estimation/` and the i18n catalog. One new pure planner joins an existing
`domain/` module. No new file in `src/`.

**Tech Stack:** TypeScript, Obsidian Bases custom-view API (floor 1.12.0), vitest with a
jsdom harness, `Intl` for locale-sensitive formatting, plain CSS partials assembled by
`scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-21-estimation-polish-pass-design.md`

## Global Constraints

- `npm run check` — build + lint + coverage-thresholded tests + fallow + docs register —
  must pass before any commit. Coverage thresholds only ever go up.
- Layer rule: `main → commands → view → storage → domain`. Each layer may reach anything
  below it and nothing above. `i18n/` imports nothing.
- Never write frontmatter outside `storage/frontmatter.ts`, `storage/createNote.ts` and
  `storage/propertyWrite.ts`. Every write path goes through the `configProblems` gate.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore.
- `max-lines: 400` for `src/**` and `450` for `test/**`, both counted with blanks and
  comments skipped. `max-lines-per-function: 100`. `complexity: 16`.
- Stylesheet: one partial per concern, 400-line cap per partial, `styles/index.css`
  assembles them. The root `styles.css` is generated — never edit it.
- `view/estimation/` is an **i18n-swept** directory: `UI_TEXT_LITERAL` and
  `UI_TEXT_PROPERTY` refuse an English literal at a setter, `new Notice`, a bare
  `setTooltip`, and the ten option-bag properties including `'aria-label'`. Every user
  sentence is a `t()` key in `src/i18n/en.ts`.
- The sentence is the unit of translation. Nothing builds a message by joining pieces;
  list joining uses `list()` from `src/i18n/t.ts` (`Intl.ListFormat`, catalog locale).
- `CHANGELOG.md` gains `[Unreleased]` entries in the same pull request that earns them.
  No version bump in this pass.
- `setCssProps` over inline styles. Sentence-case UI text. No global `app`.
- Obsidian cannot run here. jsdom lays nothing out, so no test in this plan may claim a
  measured position. Say so honestly and hand over `npm run test-build`.

## Two corrections to the spec, made while planning

Both are narrowings. Neither changes the scope of a task.

1. **A's gutter value is `var(--size-4-8)` (32px), not the "about 28px" the spec
   estimated.** The spec computed the control from `--icon-s` (16px). `.clickable-icon`
   does not set its own icon size — it inherits `--icon-size`, which is `var(--icon-m)` =
   **18px** on the desktop root and **20px** at the touch breakpoint
   (`test/harness/obsidian.css`). With `padding: var(--size-2-2) var(--size-2-3)` (4px 6px)
   the control is 30px, and 32px on touch. `var(--size-4-8)` is the one token that covers
   both; there is no `--size-4-7`.

2. **C1 fixes the table row only. The panel half is dropped, deliberately.** The spec
   claimed `refocusPick`'s `.focus()` scrolls a point button under the panel's sticky
   header. It does not, in the case that actually runs: `renderPanel` restores
   `panelScrollTop`, so the rebuilt row is back where the reader left it — on screen — and
   a `.focus()` on an in-view element scrolls nothing. And `.pbl-est-header`'s height is
   content-driven (title, summary, up to two derived lines), so any constant
   `scroll-margin` there would be a guess dressed as a measurement. The table's
   `.pbl-est-head` is a real `min-height: 32px`, and arrow-stepping upward genuinely does
   park a row behind it. Fix the one that happens.

---

## File Structure

| File | Responsibility in this pass |
| --- | --- |
| `styles/estimationPanel.css` | A: which box the clear control positions against, and the width of the gutter it sits in. |
| `styles/estimation.css` | C1: the table row's scroll margin under the sticky header. |
| `src/domain/weightedScore.ts` | B1: the order `currencyOf` asks its questions in. |
| `src/domain/estimationWritePlan.ts` | C2: `planRestamp`, beside the two planners already there. |
| `src/view/estimation/init.ts` | B2 (guard), C3 (the whole problem list in the notice). |
| `src/view/estimation/estimationView.ts` | B2 (the empty-state button's class), C2 (`performRestamp`). |
| `src/view/estimation/renderTable.ts` | B3 (refocus the sort header), B5 (the rows wrapper). |
| `src/view/estimation/panel.ts` | C2: the restamp control, beside the orphan cleanup. |
| `src/i18n/en.ts` | B4 (one shared undo key), C2 (the restamp label), C3 (the list parameter). |
| `src/view/render/toolbar.ts` | B4: calls the shared key. |
| `CHANGELOG.md` | The `[Unreleased]` entries this pass earns. |
| `docs/bugs/`, `docs/issues/`, `docs/requirements/` | The register notes the pass owes. |

---

## Task 1: A — the clear control's gutter

**Files:**
- Modify: `styles/estimationPanel.css` (the `.pbl-est-dim`, `.pbl-est-dim-head` and
  `.pbl-est-clear` rules)
- Test: `test/view/estimation/styleRules.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `.pbl-est-dim` carries `position: relative`; `.pbl-est-dim-head` carries
  `padding-inline-end: var(--size-4-8)` and no `position`. Task 2 edits a different
  partial and does not depend on this.

**Background the implementer needs.** `.pbl-est-clear` is the `x` that removes one
dimension's stored answer. It is `position: absolute` and meant to sit in a gutter the
head reserves, so that revealing it on hover can never reflow the row. It does not: an
absolute inset resolves against the containing block's **padding box**, so
`inset-inline-end: 0` measured from `.pbl-est-dim-head` puts the button *inside* the
content area — over the last point button — and leaves the reserved padding empty beside
it. Reported from a vault on 2026-08-21.

- [ ] **Step 1: Look at it in the harness before writing any CSS**

```bash
npm run harness
```

Open the page. The estimation panel's dimension rows are drawn by the real view against
the real stylesheet. Confirm two things with your eyes: the `x` overlaps the last point
button, and there is unused space to the right of it. Note that a themed vault's colours
are NOT faithful here — layout and spacing are. Do not skip this step; it is the only
thing in this task that can see a position.

- [ ] **Step 2: Write the failing test**

Add to `test/view/estimation/styleRules.test.ts`. `ruleAt(selector, decl)` is already
defined at the top of that file — it returns the index of the last rule matching that
selector-and-declaration pair, or `-1`.

```ts
describe('the clear control sits in the gutter the row reserves for it', () => {
	// An absolute inset resolves against the containing block's PADDING box. Positioning
	// `.pbl-est-clear` against `.pbl-est-dim-head` therefore measured from INSIDE the
	// gutter that head reserves, putting the control over the last point button and
	// leaving the reserved space empty beside it (reported from a vault, 2026-08-21).
	// `.pbl-est-dim` has no inline padding, so its padding box's inline-end edge IS the
	// head's border-box edge, and `inset-inline-end: 0` lands in the gutter.
	it('positions the control against the row, not against the head that reserves the gutter', () => {
		expect(ruleAt('.pbl-est-dim', 'position: relative')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-dim-head', 'position: relative')).toBe(-1);
	});

	// 32px is the control, not a round number: `.clickable-icon` is
	// `padding: var(--size-2-2) var(--size-2-3)` (4px 6px) around an icon sized by the
	// INHERITED `--icon-size`, which is `--icon-m` — 18px on the desktop root and 20px at
	// the touch breakpoint. So 30px, and 32px on touch. The previous `--size-4-5` (20px)
	// was narrower than the control even before the padding-box fault above.
	//
	// This pins the TOKEN. It does not prove 32px covers the control, which needs a
	// layout engine — `npm run harness`, then a vault.
	it('reserves the control’s real width rather than the 20px it used to', () => {
		expect(ruleAt('.pbl-est-dim-head', 'padding-inline-end: var(--size-4-8)')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-dim-head', 'padding-inline-end: var(--size-4-5)')).toBe(-1);
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/styleRules.test.ts
```

Expected: both new tests FAIL. The first because `.pbl-est-dim` has no `position` and
`.pbl-est-dim-head` has `position: relative`; the second because the head still reserves
`var(--size-4-5)`.

- [ ] **Step 4: Move `position: relative` up one level**

In `styles/estimationPanel.css`, the `.pbl-est-dim` rule currently reads:

```css
.pbl-est-dim {
	display: flex;
	flex-direction: column;
	gap: var(--size-2-2);
	padding-block: var(--size-4-2);
}
```

Replace it with:

```css
/* THE CONTAINING BLOCK FOR `.pbl-est-clear`, and that is the whole reason for the
   declaration. An absolute inset resolves against the containing block's PADDING box, so
   with `position: relative` on `.pbl-est-dim-head` instead, `inset-inline-end: 0`
   measured from inside the gutter that head reserves — putting the control over the last
   point button with the reserved space sitting empty beside it (reported from a vault,
   2026-08-21). This row carries `padding-block` only, so ITS padding box's inline-end
   edge is the head's border-box edge, and `0` lands in the gutter. `top: 0` still
   resolves to where the head begins, so the control keeps its corner. */
.pbl-est-dim {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: var(--size-2-2);
	padding-block: var(--size-4-2);
}
```

- [ ] **Step 5: Take `position: relative` off the head and widen its gutter**

The `.pbl-est-dim-head` rule currently reads:

```css
.pbl-est-dim-head {
	position: relative;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
	/* Holds the clear control's gutter open at rest, since the control itself is out of flow. */
	padding-inline-end: var(--size-4-5);
}
```

Replace it with:

```css
/* No `position` here on purpose — see `.pbl-est-dim` above, which is the containing block
   the clear control resolves against. */
.pbl-est-dim-head {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
	/* Holds the clear control's gutter open at rest, since the control itself is out of
	   flow. 32px is the CONTROL, not a round number: `.clickable-icon` is
	   `padding: var(--size-2-2) var(--size-2-3)` (4px 6px) around an icon sized by the
	   inherited `--icon-size` = `--icon-m`, which is 18px on the desktop root and 20px at
	   the touch breakpoint. So 30px, and 32px on touch. This was `--size-4-5` (20px),
	   narrower than the control it reserved for. */
	padding-inline-end: var(--size-4-8);
}
```

- [ ] **Step 6: Run the test and the lint gate**

```bash
npx vitest run test/view/estimation/styleRules.test.ts && npm run lint
```

Expected: PASS. `npm run lint` also runs `styles-assemble.mjs`'s partial-length gate; the
partial grew by comments only, so it must still pass.

- [ ] **Step 7: Look again in the harness**

```bash
npm run harness
```

Expected: the `x` sits clear of the last point button, in the gutter, and revealing it on
hover moves nothing. If it still overlaps, the control is wider than 32px in this build —
report the number rather than nudging the token until it looks right.

- [ ] **Step 8: Commit**

```bash
git add styles/estimationPanel.css test/view/estimation/styleRules.test.ts
git commit -m "Position the clear control against the row that reserves its gutter

An absolute inset resolves against the containing block's padding box, so
positioning against the head measured from inside the gutter that head
reserves — the control landed over the last point button with the reserved
space empty beside it. The gutter was also 20px against a 30px control.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: C1 — the sticky header hides the row the keyboard stepped to

**Files:**
- Modify: `styles/estimation.css` (the `.pbl-est-row` rule)
- Test: `test/view/estimation/styleRules.test.ts`

**Interfaces:**
- Consumes: nothing. Task 1 edited a different partial.
- Produces: `.pbl-est-row` carries `scroll-margin-block-start`. Nothing later depends on it.

**Background the implementer needs.** `selectRow` in `renderTable.ts` calls
`row.scrollIntoView({ block: 'nearest' })` when the selection moved by keyboard.
`.pbl-est-head` is `position: sticky; top: 0` inside the same scroller (`.pbl-est-table`).
`nearest` scrolls the row flush to the scroller's edge — which is *underneath* the sticky
header — so stepping upward with `ArrowUp` parks the selected row behind the column
labels. `scroll-margin-block-start` is the platform's answer: it tells
`scrollIntoView` to leave that much room, with no JavaScript and no measurement.

Read the spec's correction 2 before starting: the panel does **not** get this treatment,
and the reason is written down.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/styleRules.test.ts`:

```ts
describe('a row stepped to by keyboard clears the sticky header', () => {
	// `selectRow` scrolls with `block: 'nearest'`, which lands the row flush against the
	// scroller's edge — under `.pbl-est-head`, which is `position: sticky; top: 0` in that
	// same scroller. So an `ArrowUp` step parked the selected row behind the column
	// labels. `scroll-margin-block-start` is the platform's own answer and needs no
	// measurement at runtime.
	//
	// The VALUE matches the header's own `min-height: 32px`. Whether it is ENOUGH is a
	// layout question jsdom cannot answer — `npm run harness`, then a vault.
	it('reserves the header’s height as scroll margin on the row', () => {
		expect(ruleAt('.pbl-est-row', 'scroll-margin-block-start: var(--size-4-8)')).toBeGreaterThan(-1);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/styleRules.test.ts
```

Expected: the new test FAILS with the received value `-1`.

- [ ] **Step 3: Add the declaration**

In `styles/estimation.css`, the `.pbl-est-row` rule currently reads:

```css
.pbl-est-row {
	border-bottom: 1px solid var(--background-modifier-border);
	cursor: pointer;
}
```

Replace it with:

```css
.pbl-est-row {
	border-bottom: 1px solid var(--background-modifier-border);
	cursor: pointer;
	/* `selectRow` scrolls a keyboard step with `block: 'nearest'`, which lands the row
	   flush against this scroller's edge — under `.pbl-est-head`, which is sticky at
	   `top: 0` inside it. So `ArrowUp` used to park the selected row behind the column
	   labels. 32px is that header's own `min-height`; a margin here is the platform
	   answering it, with nothing measured at runtime. Deliberately NOT mirrored on
	   `.pbl-est-dim` in the panel: `renderPanel` restores the panel's scroll position, so
	   the rebuilt row is already on screen and `refocusPick`'s `.focus()` scrolls nothing
	   — and `.pbl-est-header`'s height is content-driven, so a constant there would be a
	   guess rather than a measurement. */
	scroll-margin-block-start: var(--size-4-8);
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run test/view/estimation/styleRules.test.ts && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Confirm in the harness**

```bash
npm run harness
```

Scroll the table down, then press `ArrowUp` repeatedly to walk the selection back up.
Expected: the selected row always stays fully below the column labels. This is the whole
of what can be checked before a vault.

- [ ] **Step 6: Commit**

```bash
git add styles/estimation.css test/view/estimation/styleRules.test.ts
git commit -m "Keep a keyboard-stepped row clear of the sticky column labels

`block: 'nearest'` lands a row flush against the scroller's edge, which is
under the sticky header, so ArrowUp parked the selection behind the labels.
The panel is deliberately not mirrored — its scroll position is restored, so
the focused row is already in view, and its header's height is content-driven.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: B1 — `currencyOf` calls a hand-typed total an orphan

**Files:**
- Modify: `src/domain/weightedScore.ts` (`currencyOf`)
- Test: `test/domain/weightedScore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `currencyOf` returns `'handwritten'` — not `'orphan'` — for a stored total with
  no stamp and no answers. Task 8 (C2) relies on `orphan` meaning a **stamped** total whose
  inputs are gone.

**Background the implementer needs.** `currencyOf` classifies a total already stored on a
note. `computeTotal` returns `null` when `answered === 0`, so `item.result === null` means
"no dimension on this note has an answer" — which is exactly the state a note is in when
somebody typed a value into the property editor by hand. `currencyOf` asks
`result === null` (→ `'orphan'`) **before** `storedStamp === null` (→ `'handwritten'`), so
that note reads *Inputs gone* and the panel offers the orphan cleanup, which deletes what
the person typed. `docs/requirements/Business value estimation.md` is explicit: "an absent
one means it was written by hand or by something else."

This is a **pure function in `domain/`** — node environment, no jsdom, no DOM.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/weightedScore.test.ts`. Match the file's existing `configured(...)`
model helper and its `currencyOf` call convention — read a neighbouring `currencyOf` test
first and copy its shape rather than inventing one.

```ts
it('reads a total with no stamp and no answers as hand-written, never as an orphan', () => {
	// `computeTotal` returns null at `answered === 0`, so "no answers" and "inputs gone"
	// arrive at this function as the same `result === null`. The STAMP is what tells them
	// apart: `docs/requirements/Business value estimation.md` — "an absent one means it
	// was written by hand or by something else". Asked in the other order, a number
	// somebody typed into the property editor read as `orphan` and the panel offered to
	// delete it.
	const model = configured();
	const currency = currencyOf(model, { storedTotal: 4, storedStamp: null, result: null });
	expect(currency).toBe('handwritten');
});

it('still reads a STAMPED total with no answers as an orphan', () => {
	// The other half of the same swap, so the fix cannot be read as "handwritten always
	// wins": a stamp vouching for inputs that are gone is exactly what `orphan` is for,
	// and `planOrphanCleanup` is offered on it.
	const model = configured();
	const currency = currencyOf(model, { storedTotal: 4, storedStamp: stampValue(model, { answered: 3, enabled: 8 }), result: null });
	expect(currency).toBe('orphan');
});
```

If `stampValue`'s second argument shape differs in this file's existing tests, use theirs —
it takes a `Coverage` (`{ answered, enabled }`).

- [ ] **Step 2: Run it and watch the first one fail**

```bash
npx vitest run test/domain/weightedScore.test.ts
```

Expected: the first test FAILS with `expected 'handwritten', received 'orphan'`. The second
PASSES already — it is the guard against over-correcting in Step 3, so watch it pass now.

- [ ] **Step 3: Swap the two checks**

In `src/domain/weightedScore.ts`, `currencyOf` currently reads:

```ts
	// Currency describes the STORED total; with nothing stored there is nothing to judge.
	if (item.storedTotal === null) return 'none';
	// A stored total whose inputs are gone is an orphan — reported, removed only by action.
	if (item.result === null) return 'orphan';
	if (item.storedStamp === null) return 'handwritten';
```

Replace those five lines with:

```ts
	// Currency describes the STORED total; with nothing stored there is nothing to judge.
	if (item.storedTotal === null) return 'none';
	// THE STAMP IS ASKED BEFORE THE INPUTS, and the order is the rule rather than a
	// preference. `computeTotal` returns null at `answered === 0`, so "nobody has answered
	// a dimension" and "the answers behind this total were deleted" both arrive here as
	// `result === null` — and only the stamp tells them apart. Asked the other way round,
	// a number typed into the property editor by hand read as `orphan`, and the panel
	// offered the cleanup that deletes it (`docs/requirements/Business value
	// estimation.md`: "an absent one means it was written by hand or by something else").
	if (item.storedStamp === null) return 'handwritten';
	// A STAMPED total whose inputs are gone is an orphan — reported, removed only by action.
	if (item.result === null) return 'orphan';
```

- [ ] **Step 4: Run the whole domain suite**

```bash
npx vitest run test/domain/
```

Expected: PASS, both new tests included. Run the whole directory rather than the one file:
`estimationItems.ts` calls `currencyOf` per item, so its own suite is the check that no
existing expectation depended on the old order.

- [ ] **Step 5: Run the view suites that render the currency chip**

```bash
npx vitest run test/view/estimation/
```

Expected: PASS. If a fixture here expected `orphan` on a stamp-less note, the fixture was
encoding the bug — change the fixture, and say so in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/domain/weightedScore.ts test/domain/weightedScore.test.ts
git commit -m "Ask the stamp before the inputs when reading a stored total

computeTotal returns null at zero answers, so 'nobody has answered' and 'the
answers were deleted' reach currencyOf identically and only the stamp tells
them apart. Asked the other way round, a hand-typed total read as an orphan
and the panel offered the cleanup that deletes it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: B4 — one undo label, because there is one undo slot

**Files:**
- Modify: `src/i18n/en.ts` (delete `estimation.toolbar.undo`, reword `toolbar.undo`)
- Modify: `src/view/estimation/toolbar.ts:30`
- Test: `test/i18n/estimation.test.ts:118`

**Interfaces:**
- Consumes: nothing.
- Produces: `t('toolbar.undo')` is the only undo label in the catalog. Later tasks add keys
  but do not touch this one.

**Background the implementer needs.** ADR 0030 moved the undo slot (`lastUndo`) out of the
per-view gate and onto a plugin-wide `WriteLock`, on purpose: a slot per view would be two
views racing on one vault with two ideas of what "the last batch" was. So the estimation
toolbar's undo button genuinely can take back a backlog drag, and the backlog toolbar's can
take back an estimation pick. The **behaviour is correct and stays**. What is wrong is that
both buttons name a scope the slot does not have: `'Undo last estimation change'` and
`'Undo last backlog change'`. Fix the labels, not the lock.

- [ ] **Step 1: Point the estimation test at the shared key and watch it fail**

In `test/i18n/estimation.test.ts` around line 118, change the assertion from
`marked('estimation.toolbar.undo')` to `marked('toolbar.undo')`:

```ts
		expect(drawn).toContain(marked('toolbar.undo'));
```

Read the surrounding test first — `marked()` is that suite's own way of proving a drawn
string came from the catalog rather than from a literal. Do not change how it is called.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/i18n/estimation.test.ts
```

Expected: FAIL — the toolbar still draws `estimation.toolbar.undo`.

- [ ] **Step 3: Reword the shared key and delete the estimation one**

In `src/i18n/en.ts`, line 260 currently reads:

```ts
	'toolbar.undo': 'Undo last backlog change',
```

Replace it with:

```ts
	/**
	 * NO VIEW IN THE NAME, because there is one undo slot for the whole vault. ADR 0030
	 * put `lastUndo` on the plugin-wide `WriteLock` on purpose — a slot per view would be
	 * two views racing with two ideas of what the last batch was — so this button really
	 * can take back a batch the reader made in another view, and a label promising
	 * otherwise was the only wrong part. The estimation toolbar shares this key rather
	 * than owning a second one saying "estimation".
	 */
	'toolbar.undo': 'Undo last change',
```

Then delete line 805 entirely:

```ts
	'estimation.toolbar.undo': 'Undo last estimation change',
```

- [ ] **Step 4: Point the estimation toolbar at the shared key**

In `src/view/estimation/toolbar.ts` line 30, currently:

```ts
	const undo = iconButton(bar, 'undo-2', t('estimation.toolbar.undo'), 'pbl-est-undo');
```

Replace with:

```ts
	// The SHARED key, not one of this view's own: the undo slot is vault-wide (ADR 0030),
	// so a label naming this view would promise a scope the slot does not have.
	const undo = iconButton(bar, 'undo-2', t('toolbar.undo'), 'pbl-est-undo');
```

- [ ] **Step 5: Run both i18n suites and the type check**

```bash
npx vitest run test/i18n/ && npx tsc --noEmit
```

Expected: PASS. `t()` derives its key type from the catalog, so a surviving caller of the
deleted key is a **compile error** rather than a runtime miss — `tsc` is the real check
that nothing else referenced it.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/en.ts src/view/estimation/toolbar.ts test/i18n/estimation.test.ts
git commit -m "Name the undo button after the slot it actually empties

ADR 0030 makes one vault-wide undo slot deliberate, so both buttons could
already take back the other view's batch and both labels said otherwise. One
shared key, one fewer key in the catalog.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: B2 — the guided setup can bind 13 properties and stub none

**Files:**
- Modify: `src/view/estimation/init.ts` (`runEstimationInit`)
- Modify: `src/view/estimation/estimationView.ts` (`renderUnconfigured`)
- Modify: `src/i18n/en.ts` (one new key)
- Test: `test/view/estimation/init.test.ts`, `test/view/estimation/toolbar.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `runEstimationInit` returns without touching `view.config` when
  `view.gate.writing` is true. The guided empty state's button carries `pbl-est-init`.

**Background the implementer needs.** `runEstimationInit` is the ✨: it binds every
suggested property nobody has named, then backfills those keys onto every result. The two
halves are one action because neither works alone, and
`docs/requirements/Binding the estimation properties.md` states the guarantee as
all-or-nothing. The function's own comment says the order is the rule — decide, gate, then
write — and it already runs `modelProblems` before touching the config for exactly that
reason. But the **lock** refusal is not asked: it writes the bindings, then calls
`applySafely`, which can refuse the whole batch because another view is mid-write. Result:
13 properties bound, nothing stubbed, and the guided empty state replaced by a config
warning about a state the button just created.

Why a synchronous check is sufficient and not a narrowed race: there is no `await` between
the guard and `applySafely`, and the lock is taken synchronously on entry to
`runExclusively`. JavaScript runs to completion, so no other view can take the lock in
between.

Second half: the empty-state button has no `pbl-est-init` class, so
`syncEstimationToolbar` — which disables the toolbar's own ✨ while `gate.writing` — never
finds it. That is what makes this reachable by a click at all.

- [ ] **Step 1: Write the failing test for the guard**

Add to `test/view/estimation/init.test.ts`. The real-batch pattern is
`vault.beforeWrite = () => new Promise(...)`, which holds the lock open until you call the
captured `release`; copy it from `test/view/estimation/toolbar.test.ts`'s "disables both
write controls while a batch is running" test.

```ts
it('changes no configuration when the lock is already held', async () => {
	// The all-or-nothing guarantee (`docs/requirements/Binding the estimation
	// properties.md`). Binding first and gating second left 13 properties bound and
	// nothing stubbed, and replaced the guided empty state with a config warning about a
	// state this button had just created.
	const vault = new FakeVault();
	vault.addFile('Bare.md', { frontmatter: {} });
	vault.addFile('Scored.md', { frontmatter: { 'strategic-alignment': 5 } });

	// ONE lock, two views — the scenario the guard is for. The writer is a configured
	// view mid-batch; the view under test is the unconfigured one whose empty state
	// offers the ✨.
	const lock = new WriteLock();
	let release: () => void = () => {};
	vault.beforeWrite = () => new Promise<void>((r) => (release = r));
	const writer = makeEstimationView(vault, configuredValues(), { lock });
	selectItem(writer.containerEl, 'Scored.md');
	click(pointButton(writer.containerEl, 'strategic-alignment', 4));

	const { view, config } = makeEstimationView(vault, {}, { lock });
	await runEstimationInit(view);

	// Not "fewer writes" — NONE, and no binding either.
	expect(config.setCalls).toHaveLength(0);
	expect(vault.fm('Bare.md')['customer-value']).toBeUndefined();

	release();
	await flush();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/init.test.ts
```

Expected: FAIL — `config.setCalls` has 13 entries, because the bindings were written before
the batch was refused.

- [ ] **Step 3: Add the catalog key for the refusal**

In `src/i18n/en.ts`, beside `estimation.problems.blocked` (line 746), add:

```ts
	/** Said rather than left silent, for `estimation.problems.blocked`'s own reason: the
	 *  guided empty state is still on screen, so a button that returned quietly would
	 *  simply look dead. */
	'estimation.init.busy': 'Another change is being saved. Try the setup again once it finishes.',
```

- [ ] **Step 4: Add the guard before the bindings are written**

In `src/view/estimation/init.ts`, `runEstimationInit` currently reads (after the
`modelProblems` block):

```ts
	if (problems.length > 0) {
		new Notice(t('estimation.problems.blocked', { problem: problems[0] }));
		return;
	}
	for (const [option, value] of pending) view.config.set(option, value);
```

Insert the lock check between them:

```ts
	if (problems.length > 0) {
		new Notice(t('estimation.problems.blocked', { problem: problems[0] }));
		return;
	}
	// THE THIRD REFUSAL, asked here for the same reason the two above it are: this action's
	// two halves are one guarantee (`docs/requirements/Binding the estimation
	// properties.md`), and `applySafely` can refuse the whole backfill because another view
	// holds the lock — which would leave 13 properties bound and nothing stubbed.
	//
	// A SYNCHRONOUS check is sufficient and not a narrowed race: there is no `await`
	// between here and `applySafely`, and the lock is taken synchronously on entry to
	// `runExclusively`, so run-to-completion means no other view can take it in between.
	if (view.gate.writing) {
		new Notice(t('estimation.init.busy'));
		return;
	}
	for (const [option, value] of pending) view.config.set(option, value);
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run test/view/estimation/init.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write the failing test for the empty-state button's class**

Add to `test/view/estimation/toolbar.test.ts`:

```ts
it('disables the guided empty state’s own setup button while a batch runs', async () => {
	// The toolbar's ✨ carries `pbl-est-init` and `syncEstimationToolbar` disables it. The
	// empty state's button ran the SAME action with no class at all, so nothing ever
	// disabled it — which is what made the all-or-nothing hole reachable by a click.
	const vault = new FakeVault();
	vault.addFile('Scored.md', { frontmatter: { 'strategic-alignment': 5 } });

	const lock = new WriteLock();
	let release: () => void = () => {};
	vault.beforeWrite = () => new Promise<void>((r) => (release = r));
	const writer = makeEstimationView(vault, configuredValues(), { lock });
	selectItem(writer.containerEl, 'Scored.md');
	click(pointButton(writer.containerEl, 'strategic-alignment', 4));

	// Unconfigured, so this view draws the guided empty state rather than a toolbar.
	const { view, containerEl } = makeEstimationView(vault, {}, { lock });
	view.syncBusy();

	const setup = containerEl.querySelector('.pbl-est-empty .pbl-est-init') as HTMLButtonElement;
	expect(setup).not.toBeNull();
	expect(setup.disabled).toBe(true);

	release();
	await flush();
});
```

- [ ] **Step 7: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/toolbar.test.ts
```

Expected: FAIL — the query returns `null`, because the button has only `mod-cta`.

- [ ] **Step 8: Give the empty-state button the class**

In `src/view/estimation/estimationView.ts`, `renderUnconfigured` currently reads:

```ts
		const btn = empty.createEl('button', { cls: 'mod-cta', text: t('estimation.empty.useDefaults') });
```

Replace with:

```ts
		// `pbl-est-init` is not decoration — it is how `syncEstimationToolbar` FINDS this
		// button to disable it. It runs the same action as the toolbar's ✨, so it has to
		// go quiet on the same fact; without the class nothing ever disabled it, which is
		// what made the bind-then-refuse hole reachable by a click.
		const btn = empty.createEl('button', { cls: 'mod-cta pbl-est-init', text: t('estimation.empty.useDefaults') });
```

Then confirm `renderUnconfigured` ends by publishing the current gate state, so a view
opened *during* a sibling's batch draws straight into the disabled state rather than waiting
for a later `syncBusy`. Add as the last line of the method:

```ts
		// Drawn into whatever state the lock is already in — the toolbar's own rule
		// (`renderEstimationToolbar` calls `syncEstimationToolbar` for exactly this), which
		// this state now needs too because it owns a write control.
		syncEstimationToolbar(this);
```

`syncEstimationToolbar` is already imported in this file for `syncBusy`. If it is not,
import it from `./toolbar`.

- [ ] **Step 9: Run both suites**

```bash
npx vitest run test/view/estimation/ && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 10: Watch both new tests fail without the fix**

Revert the two source edits (the guard, and the class), run
`npx vitest run test/view/estimation/init.test.ts test/view/estimation/toolbar.test.ts`,
confirm both new tests go red, then restore the edits. This is the repository's rule for a
comment that states an invariant, and both edits carry one.

- [ ] **Step 11: Commit**

```bash
git add src/view/estimation/init.ts src/view/estimation/estimationView.ts src/i18n/en.ts test/view/estimation/init.test.ts test/view/estimation/toolbar.test.ts
git commit -m "Ask the lock before the guided setup changes any configuration

The action's two halves are one guarantee, and applySafely can refuse the
whole backfill while another view writes — leaving 13 properties bound and
nothing stubbed. The empty state's button also carried no class, so nothing
ever disabled it, which is what made that reachable by a click.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: B3 — a sort click drops keyboard focus to `<body>`

**Files:**
- Modify: `src/view/estimation/renderTable.ts` (`wireSortClick`, plus one new helper)
- Test: `test/view/estimation/keyboard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a new module-private `refocusSortHeader(view: EstimationView, column: SortColumn): void`.
  Task 7 edits the same file but not this function.

**Background the implementer needs.** A sort header is a real `<button>`. Its click handler
stores the new pick and calls `view.refresh()`, which is **synchronous** and rebuilds the
whole view — destroying the button that was just activated. Nothing refocuses, so focus
falls to `<body>` and a second `Enter` cannot flip the direction. Every other
rebuild-causing control in this plugin refocuses: `refocusPick` in `panel.ts`,
`pickAndRefocus` in `view/render/toolbar.ts`.

Address the rebuilt button by reading `dataset.col` and comparing, not by interpolating
into a selector — `refocusPick`'s documented rule. Here the column vocabulary is a fixed
six, so no spelling can be a syntax error, but the shape stays the one the codebase trusts.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/keyboard.test.ts`. `key(el, name)` comes from
`test/helpers/view.ts` and dispatches a bubbling `KeyboardEvent`.

```ts
it('keeps focus on a sort header across the rebuild its own click causes', () => {
	// `view.refresh()` destroys the button that was just activated. Without a refocus,
	// focus fell to `<body>` and a SECOND Enter reached nothing — so the direction could
	// be set once by keyboard and never flipped. Every other rebuild-causing control in
	// this plugin refocuses (`refocusPick`, `pickAndRefocus`).
	const { containerEl } = makeEstimationView(fixture(), configuredValues());

	const header = () => containerEl.querySelector('.pbl-est-sort[data-col="total"]') as HTMLButtonElement;
	header().focus();
	click(header());

	// The button is a NEW element after the rebuild, so this asks the document what holds
	// focus rather than trusting the old reference.
	expect(containerEl.ownerDocument.activeElement).toBe(header());
	const first = header().getAttribute('aria-sort');

	// The second press is the point: it only reaches a header if the first one left focus
	// on it.
	key(header(), 'Enter');
	click(header());
	expect(header().getAttribute('aria-sort')).not.toBe(first);
});
```

If this suite's `fixture()` has fewer than two rows, use a two-row one so a direction flip
is observable — copy `states.test.ts`'s `fixture()`, which has `Bravo.md` before `Alpha.md`.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/keyboard.test.ts
```

Expected: FAIL at the first `expect` — `activeElement` is `<body>`, not the header.

- [ ] **Step 3: Refocus the rebuilt header**

In `src/view/estimation/renderTable.ts`, `wireSortClick` currently reads:

```ts
function wireSortClick(view: EstimationView, btn: HTMLElement, spec: HeaderSpec, active: SortPick | null): void {
	btn.addEventListener('click', () => {
		setSort(view, sortValue({ column: spec.column, direction: active ? flip(active.direction) : firstDirection(spec.column) }));
		view.refresh();
	});
}
```

Replace it, and add the helper beneath it:

```ts
function wireSortClick(view: EstimationView, btn: HTMLElement, spec: HeaderSpec, active: SortPick | null): void {
	btn.addEventListener('click', () => {
		setSort(view, sortValue({ column: spec.column, direction: active ? flip(active.direction) : firstDirection(spec.column) }));
		view.refresh();
		refocusSortHeader(view, spec.column);
	});
}

/**
 * Focus back onto the header this click rebuilt. `view.refresh()` above is synchronous and
 * redraws the whole view, so `btn` is detached by the time this runs and focus has fallen
 * to `<body>` — which meant a second `Enter` reached nothing and a direction set by
 * keyboard could never be flipped. `refocusPick` (`panel.ts`) and `pickAndRefocus`
 * (`view/render/toolbar.ts`) are the same rule for the same reason.
 *
 * Read off `dataset` and compared, never interpolated into a selector — `refocusPick`'s
 * own rule. A column here is one of a fixed six rather than text a user typed, so no
 * spelling can be a syntax error; the shape stays the one this codebase trusts anyway,
 * because the next `data-` address may not be a closed vocabulary.
 */
function refocusSortHeader(view: EstimationView, column: SortColumn): void {
	const headers = Array.from(view.viewEl.querySelectorAll<HTMLElement>('.pbl-est-sort'));
	headers.find((el) => el.dataset.col === column)?.focus();
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run test/view/estimation/keyboard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Watch it fail without the fix**

Remove the `refocusSortHeader(view, spec.column);` line, re-run, confirm red, restore it.

- [ ] **Step 6: Run the directory and lint**

```bash
npx vitest run test/view/estimation/ && npm run lint
```

Expected: PASS. Lint matters here: `renderTable.ts` gains a function, and `max-lines` is
400 counted with comments skipped. It was 241 before this task.

- [ ] **Step 7: Commit**

```bash
git add src/view/estimation/renderTable.ts test/view/estimation/keyboard.test.ts
git commit -m "Refocus the sort header the click's own rebuild destroyed

refresh() is synchronous and redraws the whole view, so focus fell to <body>
and a second Enter could not flip the direction. Addressed by dataset compare
rather than an interpolated selector, refocusPick's own rule.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: B5 — the sort buttons are pruned by assistive technology

**Files:**
- Modify: `src/view/estimation/renderTable.ts` (`renderTable`, `wireEvents`, `renderRows`,
  `applySelection` call sites)
- Modify: `styles/estimation.css` (one new rule for the wrapper)
- Test: `test/view/estimation/table.test.ts`, `test/view/estimation/keyboard.test.ts`, and
  wherever else `.pbl-est-table` is addressed as the listbox

**Interfaces:**
- Consumes: `refocusSortHeader` exists (Task 6) and is untouched here.
- Produces: `.pbl-est-table` is the scroller with **no** role. `.pbl-est-rows` is a new
  child carrying `role="listbox"`, `tabindex="0"` and `aria-activedescendant`.
  `view.tableEl` **still points at the scroller** — it is read only for `scrollTop`.

**Background the implementer needs.** `role="listbox"` currently sits on
`.pbl-est-table`, which is both the scroll box and the parent of the sticky header. ARIA
prunes children of a listbox that are not `option`s, so the six sort buttons — and the
`aria-sort` on the active one — are invisible to assistive technology. The code already
says so in a comment at `renderTable.ts:347`.

Split the two jobs: the scroller keeps the box, an inner wrapper takes the list semantics,
and the header stays a sticky sibling **inside the scroller** so nothing about column
alignment or scrollbar width changes.

Do not move the `scrollTop` restore and do not touch `view.tableEl`. Both are about the
scroller, which is not what changes.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/table.test.ts`:

```ts
describe('the list semantics cover the rows and nothing else', () => {
	// ARIA prunes non-`option` children of a listbox, so with the role on the scroller the
	// six sort buttons — and the `aria-sort` on the active one — were invisible to
	// assistive technology. The scroller keeps the box; a wrapper takes the semantics.
	it('puts the listbox on a wrapper whose every child is an option', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());

		expect(containerEl.querySelector('.pbl-est-table')!.getAttribute('role')).toBeNull();
		const list = containerEl.querySelector('.pbl-est-rows')!;
		expect(list.getAttribute('role')).toBe('listbox');
		expect(list.getAttribute('tabindex')).toBe('0');

		// The claim is about EVERY child, not about the rows being present — that is what
		// the pruning rule is actually sensitive to.
		const roles = Array.from(list.children).map((el) => el.getAttribute('role'));
		expect(roles.length).toBeGreaterThan(0);
		expect(roles.every((role) => role === 'option')).toBe(true);
	});

	// The header has to stay INSIDE the scroller or it stops being sticky and the
	// scrollbar starts shifting the columns out of line with it.
	it('leaves the header inside the scroller, beside the wrapper', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const scroller = containerEl.querySelector('.pbl-est-table')!;
		expect(scroller.querySelector(':scope > .pbl-est-head')).not.toBeNull();
		expect(scroller.querySelector(':scope > .pbl-est-rows')).not.toBeNull();
	});

	it('points aria-activedescendant from the listbox, not from the scroller', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-table')!.getAttribute('aria-activedescendant')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-rows')!.getAttribute('aria-activedescendant')).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/view/estimation/table.test.ts
```

Expected: all three FAIL — `.pbl-est-rows` does not exist yet.

- [ ] **Step 3: Split the scroller from the list in `renderTable`**

In `src/view/estimation/renderTable.ts`, the tail of `renderTable` currently reads:

```ts
	const tableEl = view.contentEl.createDiv({ cls: 'pbl-est-table', attr: { role: 'listbox', tabindex: '0' } });
	view.tableEl = tableEl;
	renderHead(view, tableEl, pick);
	// The model's own declared output range, never the spread of what this base returned —
	// `EstimationModel` carries no `ScoringModel`, so the range comes off the view.
	const output: [number, number] = [view.settings.model.outputMin, view.settings.model.outputMax];
	const rows = renderRows(tableEl, items, view.selectedPath, output);
	wireEvents(view, tableEl, model, items, rows);
	// Clamped to the fresh `scrollHeight` so a rebuild with fewer rows (a note leaving the
	// base's results) cannot park the pane below its own last row.
	tableEl.scrollTop = Math.min(previousScrollTop, tableEl.scrollHeight);
```

Replace it with:

```ts
	// TWO ELEMENTS FOR TWO JOBS, and the split is an accessibility rule rather than
	// tidying. The scroller holds the box and the sticky header; the wrapper holds the list
	// semantics. With `role="listbox"` on the scroller, the six sort buttons were
	// non-`option` children of a listbox and ARIA pruned them — along with the `aria-sort`
	// beside them, as `sortHeader`'s own comment says. The header stays INSIDE the
	// scroller: it is `position: sticky` against that scroller, and moving it out would
	// also let the scrollbar shift the rows out of line with the labels.
	const tableEl = view.contentEl.createDiv({ cls: 'pbl-est-table' });
	view.tableEl = tableEl;
	renderHead(view, tableEl, pick);
	// The model's own declared output range, never the spread of what this base returned —
	// `EstimationModel` carries no `ScoringModel`, so the range comes off the view.
	const output: [number, number] = [view.settings.model.outputMin, view.settings.model.outputMax];
	const listEl = tableEl.createDiv({ cls: 'pbl-est-rows', attr: { role: 'listbox', tabindex: '0' } });
	const rows = renderRows(listEl, items, view.selectedPath, output);
	wireEvents(view, listEl, model, items, rows);
	// On the SCROLLER, which is what scrolls — `view.tableEl` is read for nothing else.
	// Clamped to the fresh `scrollHeight` so a rebuild with fewer rows (a note leaving the
	// base's results) cannot park the pane below its own last row.
	tableEl.scrollTop = Math.min(previousScrollTop, tableEl.scrollHeight);
```

`renderRows`, `wireEvents`, `TableCtx.tableEl` and `applySelection` now all receive the
**wrapper**. Their parameter is already named `tableEl`; rename it to `listEl` in each of
those four so the name states which element it is, and update `TableCtx`'s field with it.
Nothing outside this file reads `TableCtx`.

- [ ] **Step 4: Follow the tab stop in the keydown guard**

`wireEvents`' keydown handler opens with a guard whose whole job is to keep a header
button's own `Enter` from falling through to the row list. Once the parameter is renamed it
reads `evt.target !== listEl`, which is correct — and now narrower, because the header is
no longer a descendant at all. Replace the guard's comment so it says the true reason:

```ts
		// Only the list's own tab stop. A sort header is a real button and its Enter/Space
		// must stay its own — the resize grips' rule (`src/view/CLAUDE.md`). Since the
		// listbox moved off the scroller, the header is not even a descendant of this
		// element, so this guard now only has to exclude the rows' own descendants.
		if (evt.target !== listEl) return;
```

- [ ] **Step 5: Give the wrapper its one rule**

In `styles/estimation.css`, immediately after the `.pbl-est-head, .pbl-est-row` block, add:

```css
/* A wrapper for the list SEMANTICS, not for layout: `role="listbox"` may only have
   `option` children, and on the scroller it had the six sort buttons too, so assistive
   technology pruned them (`renderTable.ts`'s own note). It is a plain block filling the
   scroller's inline size, so no row's column positions move — the rows stay flex rows and
   this element adds no track of its own. */
.pbl-est-rows {
	display: flex;
	flex-direction: column;
}
```

- [ ] **Step 6: Run the estimation suites and fix the addresses that moved**

```bash
npx vitest run test/view/estimation/
```

Expected: some existing tests FAIL. `.pbl-est-table` is referenced 25 times across
`test/view/estimation/{init,keyboard,states,styleRules,table,toolbar}.test.ts` and
`test/harness/harness.test.ts`. Work through them by asking, for each one, **which element
that assertion is about**:
- the **role**, `tabindex`, `aria-activedescendant`, or a row/`option` lookup → change to
  `.pbl-est-rows`
- `scrollTop`, the border, the overflow, or "the table exists at all" → leave as
  `.pbl-est-table`

Do not blanket-replace. A `.pbl-est-table` that should have stayed is a silently weakened
test.

- [ ] **Step 7: Run the whole suite plus lint and the type check**

```bash
npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: PASS. Watch `renderTable.ts` against `max-lines` again.

- [ ] **Step 8: Look in the harness**

```bash
npm run harness
```

Expected: nothing visibly changed. The header stays pinned while rows scroll, and the
columns stay aligned with the labels. A visible difference here means the wrapper took a
layout role it should not have — check the new CSS rule rather than the markup.

- [ ] **Step 9: Commit**

```bash
git add src/view/estimation/renderTable.ts styles/estimation.css test/
git commit -m "Put the listbox on the rows, not on the scroller holding the header

ARIA prunes non-option children of a listbox, so the six sort buttons and the
aria-sort beside them were invisible to assistive technology. The scroller
keeps the box and the sticky header; a wrapper takes the semantics, so no
column alignment and no scrollbar width changes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: C2 — `stale` and `foreign` name a problem and offer no action

**Files:**
- Modify: `src/domain/estimationWritePlan.ts` (`planRestamp`)
- Modify: `src/view/estimation/estimationView.ts` (`performRestamp`)
- Modify: `src/view/estimation/panel.ts` (the control, beside the orphan cleanup)
- Modify: `src/i18n/en.ts` (one new key)
- Test: `test/view/estimation/scoring.test.ts`, `test/view/estimation/panel.test.ts`

**Interfaces:**
- Consumes: Task 3's ordering — `orphan` now means a **stamped** total whose inputs are
  gone, and `handwritten` is its own currency. `planRestamp` must refuse both.
- Produces:
  - `planRestamp(model: ScoringModel, item: EstimationItem): PropertyWrite | null` exported
    from `src/domain/estimationWritePlan.ts`.
  - `EstimationView.performRestamp(item: EstimationItem): Promise<void>`.

**Background the implementer needs.** The currency vocabulary has four failure words —
*Needs re-estimation* (`stale`), *Another model* (`foreign`), *Hand-written*
(`handwritten`), *Inputs gone* (`orphan`) — and exactly one button, the orphan cleanup.
`writesNothing` in `estimationWritePlan.ts` returns `held === value`, so re-picking the
score a note already holds writes nothing and does **not** restamp. So the only route out of
a stale total is to change a score to something the reader does not mean and then change it
back. This task gives those two currencies the action their words already imply.

Why not `handwritten`: the whole point of Task 3 is that a hand-typed number is a person's
and is not overwritten by an action offered on a render pass. Why not `orphan`: there is no
`result` to restamp from — that is what `planOrphanCleanup` is for.

`totalStampSets(model, item, result)` already exists in this module and is what
`planScoreWrite` and `planOrphanCleanup` both build their `sets` from. Reuse it.

- [ ] **Step 1: Write the failing planner tests**

Add to `test/view/estimation/scoring.test.ts`, which is the planners' own suite. Copy the
neighbouring `planOrphanCleanup` tests' fixture style.

```ts
describe('planRestamp', () => {
	// The currency vocabulary had four failure words and one button. `writesNothing`
	// returns `held === value`, so re-picking the held score restamps nothing, and the only
	// route out of a stale total was to change a score to something the reader did not mean
	// and change it back.
	it('writes the computed total and a fresh stamp for a stale total', () => {
		const { model, item } = staleFixture();
		const plan = planRestamp(model, item)!;

		expect(plan.file).toBe(item.file);
		// The total the ANSWERS produce, not the one on the note — that disagreement is
		// what `stale` means.
		expect(plan.sets).toEqual(totalStampSets(model, item, item.result));
		// Nothing but the pair: a restamp is not a score change.
		expect(plan.sets.map((set) => set.key).sort()).toEqual([model.stampProperty, model.valueProperty].sort());
	});

	it('is offered for a foreign stamp too, since the answers on this note are what it restamps from', () => {
		const { model, item } = foreignFixture();
		expect(planRestamp(model, item)).not.toBeNull();
	});

	// Each refusal for its own reason, so the guard cannot be loosened by accident.
	it('refuses a total that is already current', () => {
		const { model, item } = currentFixture();
		expect(planRestamp(model, item)).toBeNull();
	});

	it('refuses a hand-written total, which is a person’s number and not this action’s to replace', () => {
		const { model, item } = handwrittenFixture();
		expect(planRestamp(model, item)).toBeNull();
	});

	it('refuses an orphan, which has no result to restamp from — that is the cleanup’s job', () => {
		const { model, item } = orphanFixture();
		expect(planRestamp(model, item)).toBeNull();
	});

	it('refuses a note with no stored total at all', () => {
		const { model, item } = unscoredFixture();
		expect(planRestamp(model, item)).toBeNull();
	});
});
```

Build the six fixtures from this suite's existing helpers — each is a `FakeVault` note plus
`buildEstimationModel`, and the currency you want follows from the frontmatter:
`stale` = answers plus a stamp whose coverage or total disagrees; `foreign` = a stamp with a
different 8-hex fingerprint; `current` = a stamp `stampValue` would produce now;
`handwritten` = a stored total and no stamp; `orphan` = a stamp with no answers;
`unscored` = no stored total. If a helper for one already exists in the file, use it.

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run test/view/estimation/scoring.test.ts
```

Expected: FAIL — `planRestamp` is not exported.

- [ ] **Step 3: Add the planner**

In `src/domain/estimationWritePlan.ts`, after `planOrphanCleanup`, add:

```ts
/**
 * Rewrites a stored total and stamp from the answers currently on the note — the action
 * the two currencies that report a stamp problem never had.
 *
 * `writesNothing` asks `held === value`, so re-picking the score a note already holds
 * plans nothing and restamps nothing: the only route out of a `stale` total was to change a
 * score to a value the reader did not mean and then change it back. This is that route,
 * named.
 *
 * The refusals are each their own reason rather than one convenience test:
 * `current` has nothing to fix; `handwritten` is a person's own number and no action
 * offered beside a render pass may overwrite it (see `currencyOf`, which asks the stamp
 * before the inputs for that reason); `orphan` has no `result` to restamp FROM, which is
 * what `planOrphanCleanup` is for; and `none` has no stored total at all.
 */
export function planRestamp(model: ScoringModel, item: EstimationItem): PropertyWrite | null {
	if (item.currency !== 'stale' && item.currency !== 'foreign') return null;
	if (item.result === null) return null;
	const sets = totalStampSets(model, item, item.result);
	return sets.length > 0 ? { file: item.file, sets } : null;
}
```

The `item.result === null` line is not dead beside the currency test: it is what narrows
`result` to non-null for `totalStampSets`, and it documents that this planner restamps *from
the note* rather than recomputing a model.

- [ ] **Step 4: Run the planner tests**

```bash
npx vitest run test/view/estimation/scoring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the view method**

In `src/view/estimation/estimationView.ts`, directly after `performOrphanCleanup`, add:

```ts
	/** Rewrites a stored total and stamp from the answers on the note — offered only while
	 *  `item.currency` reads 'stale' or 'foreign', and only ever a write in response to
	 *  this action. `performOrphanCleanup`'s shape exactly: plan, gate, refresh unless the
	 *  batch's own deferred-update flush already drew it. */
	async performRestamp(item: EstimationItem): Promise<void> {
		const plan = planRestamp(this.settings.model, item);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		if (!this.gate.flushedLastBatch) this.refresh();
	}
```

Add `planRestamp` to the existing `estimationWritePlan` import at the top of the file.

- [ ] **Step 6: Add the catalog key**

In `src/i18n/en.ts`, beside the orphan cleanup's own label, add:

```ts
	/** Says what the action does to the NOTE, not which currency word offered it — two
	 *  currencies (`stale` and `foreign`) offer the same action, so naming either in the
	 *  label would make it wrong half the time. */
	'estimation.panel.restamp': 'Recalculate the stored total from the answers on this note',
```

- [ ] **Step 7: Write the failing panel test**

Add to `test/view/estimation/panel.test.ts`:

```ts
describe('the panel offers a restamp where the currency reports a stamp problem', () => {
	it('offers it on a stale total and writes the recomputed pair', async () => {
		const vault = staleVault();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Stale.md');

		const restamp = containerEl.querySelector('.pbl-est-restamp') as HTMLButtonElement;
		expect(restamp).not.toBeNull();
		click(restamp);
		await flush();

		// The total the answers produce, through the gate — not merely "something changed".
		const answers = new Map(Object.entries({ 'strategic-alignment': 5 }));
		expect(vault.fm('Stale.md')['business-value']).toBe(computeTotal(configured(), answers)!.total);
	});

	// Each absence for its own reason: `current` has nothing to fix, and `handwritten` is a
	// person's number this action must not replace (`currencyOf` asks the stamp first for
	// exactly that).
	it('offers nothing on a current total', () => {
		const { containerEl } = makeEstimationView(currentVault(), configuredValues());
		selectItem(containerEl, 'Current.md');
		expect(containerEl.querySelector('.pbl-est-restamp')).toBeNull();
	});

	it('offers nothing on a hand-written total', () => {
		const { containerEl } = makeEstimationView(handwrittenVault(), configuredValues());
		selectItem(containerEl, 'Typed.md');
		expect(containerEl.querySelector('.pbl-est-restamp')).toBeNull();
	});

	it('still offers the orphan cleanup rather than a restamp on an orphan', () => {
		const { containerEl } = makeEstimationView(orphanVault(), configuredValues());
		selectItem(containerEl, 'Orphan.md');
		expect(containerEl.querySelector('.pbl-est-restamp')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-orphan-clear')).not.toBeNull();
	});
});
```

Use whatever class the orphan cleanup button actually carries — read `panel.ts`'s
`renderPanel` tail (around line 301) and copy it rather than trusting
`.pbl-est-orphan-clear` above.

- [ ] **Step 8: Run and watch them fail**

```bash
npx vitest run test/view/estimation/panel.test.ts
```

Expected: the first and last FAIL (`.pbl-est-restamp` missing); the two "offers nothing"
tests pass trivially and are the guards for Step 9.

- [ ] **Step 9: Add the control beside the orphan cleanup**

In `src/view/estimation/panel.ts`, the tail of `renderPanel` draws the orphan cleanup with
a `panelEl.createEl('button', …)`. Add the restamp beside it as a **branch, not a second
region** — the two currencies are disjoint, so at most one control is ever drawn:

```ts
	// A BRANCH, because the currencies are disjoint: an orphan has no result to restamp
	// from and a stale total needs no cleanup, so the panel never shows both. `stale` and
	// `foreign` share this one action — its label says what it does to the note rather than
	// naming either word.
	if (item.currency === 'stale' || item.currency === 'foreign') {
		const restamp = panelEl.createEl('button', {
			cls: 'pbl-est-restamp',
			text: t('estimation.panel.restamp'),
			attr: { type: 'button' },
		});
		restamp.addEventListener('click', () => void view.performRestamp(item));
	}
```

Place it inside the same conditional structure the orphan control already uses so the two
are visibly alternatives in the source, not two independent `if`s a later edit can make
both true.

- [ ] **Step 10: Run the panel and i18n suites**

```bash
npx vitest run test/view/estimation/ test/i18n/ && npx tsc --noEmit
```

Expected: PASS. `test/i18n/estimation.test.ts` sweeps this directory for un-keyed literals;
a `text:` literal here would fail `UI_TEXT_PROPERTY` at lint time too.

- [ ] **Step 11: Watch the control's absence fail**

Remove the `if (item.currency === 'stale' …)` block, run
`npx vitest run test/view/estimation/panel.test.ts`, confirm the two positive tests go red,
restore it. Then delete the `item.currency !== 'stale' && item.currency !== 'foreign'` guard
from `planRestamp`, run `npx vitest run test/view/estimation/scoring.test.ts`, confirm the
four refusal tests go red, restore it.

- [ ] **Step 12: Commit**

```bash
git add src/domain/estimationWritePlan.ts src/view/estimation/estimationView.ts src/view/estimation/panel.ts src/i18n/en.ts test/view/estimation/scoring.test.ts test/view/estimation/panel.test.ts
git commit -m "Give the two stamp-problem currencies the action their words imply

writesNothing returns held === value, so re-picking the held score restamped
nothing and the only route out of a stale total was to change a score the
reader did not mean and change it back. Refused on current, handwritten and
orphan, each for its own reason.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: C3 — the blocked-setup notice drops every problem after the first

**Files:**
- Modify: `src/i18n/en.ts` (`estimation.problems.blocked`)
- Modify: `src/view/estimation/init.ts:78`
- Test: `test/view/estimation/init.test.ts`

**Interfaces:**
- Consumes: Task 5 edited the lines around this one. Apply Task 5 first.
- Produces: nothing later depends on this.

**Background the implementer needs.** `runEstimationInit` reports `problems[0]` and
discards the rest, so a configuration with two faults is fixed one round trip at a time —
while `renderProblems` in the same view lists all of them. `list()` in `src/i18n/t.ts`
already exists and joins with `Intl.ListFormat` in the **catalog's** locale, and the readme
command's `readme.*` notices are the precedent for exactly this.

Take the punctuation rule with it. The catalog comment beside those readme keys records
that each problem is a whole sentence carrying its own period, so a `'; '` join rendered
`"…".; "…"..`. The message therefore ends **without** a terminal period.

- [ ] **Step 1: Write the failing test**

Add to `test/view/estimation/init.test.ts`:

```ts
it('names every configuration problem, not only the first', () => {
	// `renderProblems` already lists all of them, so reporting one here made the view hold
	// two ideas of how much to say — and a two-fault configuration was fixed one round
	// trip at a time.
	const notices: string[] = [];
	// Capture the Notice text however this suite already does it; if it does not yet, spy
	// on the `Notice` constructor in `test/helpers/dom.ts`'s obsidian double.
	const vault = new FakeVault();
	vault.addFile('Bare.md', { frontmatter: {} });

	// Two problems at once: a collision needs two options naming one property, which is
	// what `modelProblems` reports one entry per.
	const { view } = makeEstimationView(vault, twoProblemValues());
	void runEstimationInit(view);

	expect(notices[0]).toContain(firstProblem);
	expect(notices[0]).toContain(secondProblem);
});
```

Read how this suite already asserts a `Notice` before writing the capture — Task 5's test
in the same file goes through the same path, and `test/helpers/dom.ts` is where the
`obsidian` double lives. Derive `firstProblem` / `secondProblem` from
`modelProblems(...)` rather than hard-coding two English sentences, so a reworded problem
does not fail this test for the wrong reason.

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run test/view/estimation/init.test.ts
```

Expected: FAIL — the notice contains only the first problem.

- [ ] **Step 3: Make the catalog key take a list**

In `src/i18n/en.ts`, line 746 currently reads:

```ts
	'estimation.problems.blocked': 'Fix the estimation model first: {problem}',
```

Replace with:

```ts
	/**
	 * `{problems}` is a LIST, joined by `list()` (`Intl.ListFormat`, the catalog's own
	 * locale) rather than by a separator at the call site — the readme notices' own shape.
	 *
	 * NO TERMINAL PERIOD: each problem is already a whole sentence carrying one, which is
	 * what made the `'; '` version of this render `"…".; "…"..`. That is the one thing
	 * about this message that is not a pure wording change.
	 */
	'estimation.problems.blocked': 'Fix the estimation model first: {problems}',
```

- [ ] **Step 4: Pass the whole list**

In `src/view/estimation/init.ts`, line 78 currently reads:

```ts
		new Notice(t('estimation.problems.blocked', { problem: problems[0] }));
```

Replace with:

```ts
		// Every problem, because `renderProblems` already lists every problem — reporting
		// one made a two-fault configuration a round trip per fault. Joined by `list()` in
		// the CATALOG's locale, never by a separator here: list joining is grammar.
		new Notice(t('estimation.problems.blocked', { problems: list(problems) }));
```

Add `list` to the existing `t` import: `import { list, t } from '../../i18n/t';`.

- [ ] **Step 5: Run the test, the type check and lint**

```bash
npx vitest run test/view/estimation/init.test.ts && npx tsc --noEmit && npm run lint
```

Expected: PASS. `t()` derives its parameter names from the catalog by template literal
type, so passing the old `problem` key would be a **compile error** — `tsc` is what proves
the rename reached the call site.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/en.ts src/view/estimation/init.ts test/view/estimation/init.test.ts
git commit -m "Name every configuration problem in the blocked-setup notice

renderProblems already listed all of them, so reporting one made a two-fault
configuration a round trip per fault. Joined by list() in the catalog's
locale, and with no terminal period — each problem carries its own.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: The register, the changelog, and the checks CI cannot run

**Files:**
- Create: `docs/bugs/The clear control overlaps the last point.md`
- Create: `docs/issues/A hand-typed total was read as an orphan.md`
- Create: `docs/issues/The guided setup bound properties it could not stub.md`
- Modify: `docs/requirements/Reading the estimation table at a glance.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: every task above. Run this last.
- Produces: `npm run check` passes on all five steps.

**Background the implementer needs.** `docs/` is a backlog in this plugin's own schema and
`scripts/docs-check.mjs` gates it: the register's hierarchy and sibling orders, every
wikilink, every source path a current note names, the use-case shape, ADR frontmatter, and
the rule that every module in `src/` is *specified* by at least one note's
`## Where it lives` or `## Decision`. This pass adds **no module**, so no note is required
by that rule — these notes are owed because a stated guarantee was not kept, which is what
`docs/issues/` is for, and because behaviour the PBI promises has changed.

Read `docs/README.md`'s folder table and an existing note in each folder for the exact
frontmatter before writing. Do not invent a shape.

- [ ] **Step 1: Write the bug note for A**

`docs/bugs/The clear control overlaps the last point.md`. State the evidence (reported
from a vault, 2026-08-21), the padding-box cause, the fix, and what a check can and cannot
reach here — `styleRules.test.ts` pins the token and the containing block; only a vault
answers whether 32px covers the control. Note that the other two
`inset-inline-end: 0` rules in `styles/` were read and are overlays with no reserved
gutter.

- [ ] **Step 2: Write the two issue notes**

Each states the guarantee, the note that states it, how the code did not keep it, and the
test that now does:
- B1 → `docs/requirements/Business value estimation.md`'s "an absent one means it was
  written by hand or by something else", against `currencyOf`'s question order.
- B2 → `docs/requirements/Binding the estimation properties.md`'s all-or-nothing
  guarantee, against binding before gating; include why a synchronous check is sufficient.

- [ ] **Step 3: Extend the PBI's acceptance criteria**

In `docs/requirements/Reading the estimation table at a glance.md`, three criteria change.
Add them in the file's existing voice:
- the table's list semantics cover the rows only, and the sort headers are not inside the
  listbox (B5);
- a row reached by keyboard clears the sticky column labels (C1);
- `stale` and `foreign` each offer the restamp action; `current`, `handwritten`, `orphan`
  and `none` do not (C2).

Update its `## Where it lives` to name `.pbl-est-rows` and `planRestamp`.

- [ ] **Step 4: Add the `[Unreleased]` entries**

In `CHANGELOG.md`'s `[Unreleased]` section — creating it if absent, in the file's existing
format. No version bump. One line per user-visible change: the clear control's overlap, the
hand-typed total no longer offered for deletion, the guided setup's all-or-nothing
behaviour, the sort header keeping focus, the restamp action, the sticky-header scroll, the
undo label, and the full problem list.

- [ ] **Step 5: Run the whole gate**

```bash
npm run check
```

Expected: all five steps PASS — build, lint, coverage-thresholded tests, fallow, docs
register. If coverage dropped, add the missing test rather than lowering a threshold:
thresholds only ever go up.

If fallow reports `planRestamp` or `performRestamp` as unused, check that `panel.ts` reaches
the view through a **typed** local or parameter. Fallow resolves an interface member through
an explicit type annotation, not through a property access — annotate rather than reaching
for `usedClassMembers`, which is for members a framework invokes.

- [ ] **Step 6: Commit the register**

```bash
# EXPLICIT PATHS, never `git add docs/`: another session works in this same
# checkout, so a directory-wide add stages someone else's file.
git add "docs/bugs/The clear control overlaps the last point.md" \
        "docs/issues/A hand-typed total was read as an orphan.md" \
        "docs/issues/The guided setup bound properties it could not stub.md" \
        "docs/requirements/Reading the estimation table at a glance.md" \
        CHANGELOG.md
git commit -m "Register the polish pass: one bug, two broken guarantees, three criteria

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand over the checks this environment cannot run**

```bash
npm run test-build
```

This bundles into `.obsidian/plugins/<id>/` in the repository root, so this repository can
be opened as a vault — `docs/Product Backlog.base` displays the register through the
plugin. Say plainly, in the handover, what is still owed and why:

- **A's gutter** — the harness has Obsidian's default `--icon-m`, but a theme may set its
  own, and 32px is sized to the default. Needs eyes on a themed vault.
- **C1's scroll margin** — 32px matches `.pbl-est-head`'s `min-height`, and a theme that
  changes the row height or the font moves it.
- **B5** — no automated check here can prove a screen reader reads the sort headers now.
  The DOM claim is tested; the outcome is not.

Do not describe any of these as verified.

---

## Self-Review

**1. Spec coverage.** A → Task 1. B1 → Task 3. B2 → Task 5. B3 → Task 6. B4 → Task 4.
B5 → Task 7. C1 → Task 2. C2 → Task 8. C3 → Task 9. The spec's "What the gates ask of this
pass" (changelog, one key added and one deleted, no new module) → Tasks 4, 8 and 10. The
spec's "Register notes this pass owes" → Task 10. The spec's order of work is the task
order, with the harness look folded into Task 1 as its first step, where the deliverable
needs it. No gaps.

**2. Placeholders.** Every code step carries real code. The three places that say "read the
existing shape first" — the `Notice` capture in Task 9, the orphan button's real class name
in Task 8, and the frontmatter shapes in Task 10 — name the exact file to read and why the
plan does not guess, rather than deferring a decision.

**3. Type consistency.** `planRestamp(model: ScoringModel, item: EstimationItem):
PropertyWrite | null` is used under that name and signature in Tasks 8 and 10.
`performRestamp(item: EstimationItem): Promise<void>` likewise. `refocusSortHeader(view:
EstimationView, column: SortColumn): void` is defined and called in Task 6 only.
`.pbl-est-rows` is spelled identically in Tasks 7 and 10. `var(--size-4-8)` is the value in
Tasks 1 and 2 and both state the arithmetic behind it. Task 7 renames `tableEl` → `listEl`
in four places within one file and nothing outside reads them.

**Two dependencies worth respecting:** Task 9 edits lines Task 5 just changed, so Task 5
runs first. Task 8's refusals depend on Task 3's ordering fix, so Task 3 runs first.
