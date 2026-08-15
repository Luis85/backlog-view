# Progress on the bar, matches in the row, lanes dropped — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empty `Hierarchy on the roadmap` — the last unbuilt feature of the Product Roadmap epic — by dropping lanes from the register, giving timeline rows the progress the tree already computes, and giving every roadmap surface the quick filter's match naming.

**Architecture:** Three independent changes over one spec. The register gains a `Dropped` status so a refused design stays findable. A new render module draws a progress band inset inside a bar and a count in the row's lead cell, from rollup fields that already exist. Match naming stops predicting which items are on screen and instead reads a register the render fills as it draws — the same pattern `RowContext.cardKids` already uses for disclosures.

**Tech Stack:** TypeScript 6 (strict), Obsidian 1.12.0 plugin API, esbuild, Vitest + jsdom, ESLint 10 with per-directory import rules, plain-CSS partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-14-roadmap-progress-and-lanes-dropped-design.md`

## Global Constraints

- **`npm run check` must pass before every commit.** Five steps: build, lint, coverage-thresholded tests, fallow, docs register. CI runs the same five on Ubuntu **and** Windows.
- **400 code lines per file**, enforced by ESLint `max-lines` (`skipBlankLines: true, skipComments: true`); `test/**` gets 450. **100 code lines per function** (`max-lines-per-function`).
  Headroom measured 2026-08-14, before any change in this plan:
  `src/view/render/timeline.ts` **10** · `src/view/interactions/menu.ts` **3** · `src/view/backlogView.ts` **2** · `src/view/render/columns.ts` 44 · `src/view/render/board.ts` 120 · `src/view/render/lanes.ts` 236 · `src/view/render/shelf.ts` 254 · `src/view/host.ts` 271 · `src/view/childrenList.ts` 372 · `styles/timeline.css` 191.
  The first three are why this plan puts new code in new or roomy files rather than where it is used. **Do not add lines to `backlogView.ts`.**
- **Layers:** `main → commands → view → storage → domain`, plus `ui/` as a leaf. Each may reach anything below it and nothing above. `no-restricted-imports` fails lint on a violation. `domain/` never touches the DOM and never imports a view type.
- **Never write frontmatter outside `storage/frontmatter.ts`.** Nothing in this plan writes to a note; if you find yourself planning a write, you have misread the task.
- **`setCssProps` over inline styles**, `normalizePath` on user paths, sentence-case UI text, no global `app`. Marketplace rules, enforced by lint and review.
- **Every module in `src/` must be specified** in a use case's `## Where it lives` or an ADR's `## Decision`. `docs-check.mjs` rule 7 fails otherwise. Task 3 and Task 4 each create a module and each updates a note in the same commit.
- **Coverage thresholds in `vitest.config.mts` only ever go up.** If a task drops coverage, add the missing test rather than lowering a number.
- **Watch every new test fail before making it pass.** Write the test, run it, see red, then implement. Where a task says "verify it fails", the expected failure message is given — if you see a different failure, the test is wrong, not the code.
- **ASD-STE100 Simplified Technical English** in prose you add to `docs/`.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/view/render/barProgress.ts` | The progress band inside a bar and the descendant count in a row's lead cell. Reads rollup fields, writes no state. Its own module because `timeline.ts` has 10 lines of headroom. |
| `test/view/barProgress.test.ts` | Drives the band and the count over the bar shapes: leaf, no workflow, milestone, outside arrow, inferred, open-ended, context. |
| `test/view/roadmapMatches.test.ts` | Drives match naming across the roadmap's five surfaces, the two not-drawn cases, and both disclosure policies through the menu. |

**Modified:**

| File | Change |
| --- | --- |
| `scripts/docs-check.mjs` | `NOTE_STATUSES` gains `Dropped`. |
| `docs/README.md` | Conventions table gains `Dropped`; lane clauses stripped from the roadmap and Kanban paragraphs. |
| `test/helpers/register.ts` | `note()` gains an optional `status` argument. |
| `test/docs/checkerAccepts.test.ts` | A `Dropped` note passes the gate. |
| `docs/requirements/*.md` | Two notes go `Dropped`; the notes carrying lane clauses lose them; two notes gain `## Where it lives` text for the new modules. |
| `styles/timeline.css` | `.pbl-bar-progress` (the inset band) and `.pbl-bar-count` (the lead cell's count). |
| `src/view/render/timeline.ts` | Two call lines: register the row's mount, render its progress. Budget: +2 of 10. |
| `src/view/render/columns.ts` | `PlacedMount` type and `RowContext.placed`. |
| `src/view/render/board.ts` | `renderCardMatches` exported and given two new parameters. |
| `src/view/render/roadmap.ts` | Bucket cards register a mount; the second pass runs after every surface has drawn. |
| `src/view/render/shelf.ts` | Shelf cards and context-strip cards register a mount. |
| `src/view/render/lanes.ts` | The lane context row registers a mount and renders its count. |
| `src/view/childrenList.ts` | `undisclosedMatches` takes the already-listed set; new `matchesFor` answers for whichever projection drew. |
| `src/view/host.ts` | `RoadmapSnapshot.placed`, so the menu can read the register after the pass. |
| `src/view/interactions/menu.ts` | `addMatchSection` calls `matchesFor`. Must be net-negative; it has 3 lines. |

**Deliberately unchanged:** `src/view/backlogView.ts` (2 lines of headroom — the register lives on `RowContext`, which it already passes, and on `RoadmapSnapshot`, which it already stores) and `src/domain/` (every number this plan draws already exists and is already tested).

---

### Task 1: `Dropped` joins the register's status vocabulary

The register gate accepts three statuses. A refused design needs a fourth, and `docs/Product Backlog.base` already declares `doneValues: Done, Dropped` — so the config anticipated it and the checker did not.

**Files:**
- Modify: `scripts/docs-check.mjs` (the `NOTE_STATUSES` line)
- Modify: `docs/README.md` (the conventions table row for `status`)
- Modify: `test/helpers/register.ts:205-210` (`note`)
- Test: `test/docs/checkerAccepts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `note(type, order, parent, body, status?)` — the fifth argument defaults to `'Open'`, so every existing call is unchanged. Task 2 relies on the checker accepting `status: Dropped`.

- [ ] **Step 1: Give the test helper a status argument**

`test/helpers/register.ts` currently hardcodes `status: Open`. Replace the function:

```ts
export function note(
	type: string,
	order: number | string,
	parent: string | null,
	body: string,
	status = 'Open',
): string {
	const lines = ['---', `type: ${type}`, `order: ${order}`];
	if (parent !== null) lines.push(`parent: "[[${parent}]]"`);
	lines.push(`status: ${status}`, '---', '', body);
	return lines.join('\n');
}
```

- [ ] **Step 2: Write the failing test**

Add to `test/docs/checkerAccepts.test.ts`, inside the existing `describe('the gate accepts valid documents', …)` block. Read the file's header comment first — it explains why every case here must be a legal form the register does not itself use, and why green alone is not the assertion.

```ts
	it('accepts a note whose status is Dropped', async () => {
		// A refused design stays in the tree rather than being deleted, so the gate has
		// to accept the status that says so. `docs/Product Backlog.base` already
		// declares Dropped a done value, so the config knew this word before the
		// checker did.
		const files = baseRegister();
		files['docs/requirements/Refused.md'] = note(
			'PBI',
			90,
			'A feature',
			'# Refused\n\nSomething.\n',
			'Dropped',
		);
		const result = await checkRegister(files);
		expect(result.problems).toEqual([]);
	});
```

Check `baseRegister()` in `test/helpers/register.ts` for the exact parent note name and the shape a `PBI` must have — a `PBI`'s parent must be a `Feature`, and a use-case body may be required. Use the same shape a neighbouring accept case uses; do not invent one.

- [ ] **Step 3: Run the test and watch it fail**

```bash
npx vitest run test/docs/checkerAccepts.test.ts -t 'Dropped'
```

Expected: FAIL, with a problem reading `status "Dropped" is not one of Open,Active,Done`. If it fails for any other reason — a missing parent, a malformed use case — fix the fixture and get back to this exact message before continuing. A case that fails for the wrong reason will pass for the wrong reason.

- [ ] **Step 4: Widen the vocabulary**

`scripts/docs-check.mjs`, the line under the comment `/** The register's own status vocabulary, from the conventions table in docs/README.md. */`:

```js
const NOTE_STATUSES = new Set(["Open", "Active", "Done", "Dropped"]);
```

- [ ] **Step 5: Update the conventions table the comment points at**

`docs/README.md`, the `status` row of the field table:

```markdown
  | `status` | every backlog note | `Open`, `Active`, `Done`, or `Dropped` — refused, kept for the record |
```

The comment in `docs-check.mjs` names this table as the source of the vocabulary, so the two move in one commit or the comment is false.

- [ ] **Step 6: Run the test and watch it pass**

```bash
npx vitest run test/docs/checkerAccepts.test.ts -t 'Dropped'
```

Expected: PASS.

- [ ] **Step 7: Confirm the guard still guards**

```bash
npx vitest run test/docs/checkerRejects.test.ts -t 'status'
```

Expected: PASS. `checkerRejects.test.ts` already plants `status: Started` and expects `status "Started" is not one of`. Widening the set must not have disabled it — that check is the whole reason the accept and reject corpora exist as a pair.

- [ ] **Step 8: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass.

- [ ] **Step 9: Commit**

```bash
git add scripts/docs-check.mjs docs/README.md test/helpers/register.ts test/docs/checkerAccepts.test.ts
git commit -m "Let the register say a design was refused"
```

---

### Task 2: Drop lanes from both projections

Lanes were tried and refused, in the roadmap and on the board. Both notes stay in the tree so every wikilink resolves and the refusal stays findable; every clause promising lane behaviour comes out of the notes that ship.

**Files:**
- Modify: `docs/requirements/Lanes on the roadmap.md`
- Modify: `docs/requirements/Swimlanes by parent.md`
- Modify: whichever notes carry a lane clause — **derive the list by search, do not trust a list** (see Step 3)
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `Dropped` accepted by the gate (Task 1).
- Produces: nothing code depends on.

- [ ] **Step 1: Mark both notes dropped**

In `docs/requirements/Lanes on the roadmap.md` and `docs/requirements/Swimlanes by parent.md`, change the frontmatter line to `status: Dropped`.

- [ ] **Step 2: Say why, inside the section the gate requires**

**Keep the `## Where it lives` heading.** `docs-check.mjs` runs
`checkSections(note.file, text, USE_CASE_SECTIONS, "use case")` for every note with
`type: PBI`, with no status gate, and `## Where it lives` is one of those seven required
headings. Renaming it to `## Why it was dropped` fails `npm run docs` and the task cannot
be committed. Found by review, against a draft of this plan that said to replace it.

So the rationale goes **inside** that section, replacing its body:

```markdown
## Where it lives

**Why it was dropped.** Built, tried and refused on 2026-08-14. Lanes are not coming
back to either projection, so this note is kept as the record of a design already
considered rather than as work waiting to be done. It stays in the tree so every
`[[wikilink]]` to it still resolves and nobody proposes lanes again from the code alone.
```

Keep each note's story, its use case and its acceptance criteria exactly as they are: they are what was refused, and a record with its content removed records nothing.

- [ ] **Step 3: Find every lane clause, by search**

```bash
grep -rln -i 'lane' docs/requirements/ docs/README.md
```

Read each hit. Most are **false positives** and must be left alone:

- `src/view/render/lanes.ts`, `ResourceLane`, "a resource's band" — these are the **resource** lanes of `Showing a resources axis on the roadmap`, a different feature that keeps its name and its code.
- Any note whose subject is the resources axis (`Assigning items to a resource`, `Folding a resource's band`, `Resource absences`, `Scheduling inside a resource's row`, `Showing a resources axis on the roadmap`).

Strip only clauses that promise **lanes-by-parent** behaviour — the "with lanes on …" conditionals, the "move to lane" menu action, the combined lane-plus-axis batch, and any acceptance criterion resting on one. The spec names eight notes it found; re-derive rather than copying that list, because the register is edited between spec and plan and a copied list is exactly the enumeration that goes stale.

- [ ] **Step 4: Strip them**

Remove each clause so the surrounding sentence still reads. Where a criterion exists only to describe the lane case, remove the criterion. Do not leave "lanes were dropped" notes behind in shipped notes — the two `Dropped` notes are the record, and a sentence in every neighbour is nine copies of one fact.

- [ ] **Step 5: Update `docs/README.md`**

The roadmap and Kanban paragraphs name lanes among what is still design. Say instead that lanes were tried and refused, naming both notes. Keep it to one clause in each paragraph.

- [ ] **Step 6: Run the register gate**

```bash
npm run docs
```

Expected: `✓ register and ADRs consistent`. This proves every wikilink into the two dropped notes still resolves — the whole argument for keeping them.

- [ ] **Step 7: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass. No `src/` file changed, so the build and lint steps are confirming that.

- [ ] **Step 8: Commit**

```bash
git add docs/
git commit -m "Drop lanes from the roadmap and the board"
```

---

### Task 3: A progress band on the bar, a count in the lead cell

A timeline row is the one surface with no progress on it: `renderCardBody` gives every card the rollup, and rows do not come through it. Two things render — a band inset inside the bar, and a count in the lead cell — because the band cannot draw where there is no workflow or no bar, and the count still must.

**Files:**
- Create: `src/view/render/barProgress.ts`
- Modify: `styles/timeline.css`
- Modify: `src/view/render/timeline.ts` (one call in `renderBarRow`, budget +1 of 10)
- Modify: `src/view/render/lanes.ts` (one call in `renderLaneContextRow`)
- Modify: `docs/requirements/Progress on the bar.md` (`## Where it lives`)
- Test: `test/view/barProgress.test.ts`

**Interfaces:**
- Consumes: `BacklogItem.doneDescendants` and `.descendantCount` from `src/domain/model.ts`; `hasRollup(projection)` from `src/view/projection.ts`; `BacklogViewHost.settings` (`stateKey`, `showCounts`).
- Produces:
  ```ts
  // src/view/render/columns.ts — the one definition both renderers read
  export interface RollupReport {
      /** Face text: "3/8" with a workflow, "8" without one, '' for a leaf. */
      label: string;
      /** Long form for a tooltip, or '' when there is no ratio to state. */
      tooltip: string;
      /** Done share 0..1, or null when no workflow makes one meaningful. */
      ratio: number | null;
  }
  export function rollupReport(host: BacklogViewHost, item: BacklogItem): RollupReport | null
  ```
  **Two different emptinesses, and they must stay apart.** `null` means the rollup is switched off for this view — no workflow and no counts configured, or a projection with no rollup — and nothing is drawn at all. A report with an **empty `label`** means the rollup is on and this item is a leaf: the tree still draws its `.pbl-meta-col`, empty, so leaf rows stay aligned with the header and with their non-leaf siblings. Collapsing the two would unalign every leaf row in the tree while every test still passed. Found by review, against a draft of this plan that returned `null` for both.

  Task 3 Step 0 builds it; `renderRollup` is rewritten onto it in the same step.
- Also produces:
  ```ts
  export function renderBarProgress(
      host: BacklogViewHost,
      mounts: { bar: HTMLElement | null; lead: HTMLElement },
      item: BacklogItem,
  ): void
  ```
  `bar` is `null` where the shape takes no band — a milestone diamond, an outside-window arrow, and the lane context row, which has no `.pbl-bar` at all. Task 4 does not call this.

- [ ] **Step 0: Extract the report both renderers will share**

Decided before execution: the guard, the ratio and both strings live in **one** place, because `.fallowrc.json` runs a `duplicates` rule and because "one item cannot report its progress differently per projection" is a guarantee two copies of a string cannot hold.

In `src/view/render/columns.ts`, above `renderRollup`:

```ts
/**
 * What an item's rollup SAYS — the guard, the ratio and both strings, in one place.
 *
 * Two renderers read this: the tree's rollup column below, and `renderBarProgress` for
 * the roadmap's dated rows. They draw different DOM — a meta column, versus a band
 * inside a bar and a count in a lead cell — but they must never disagree about the
 * words or about when there is nothing to say, which is what
 * `Progress on the bar` guarantees. Copies of a string are how that guarantee rots.
 *
 * Null means the rollup is OFF for this view — no workflow and no counts configured, or
 * a projection with no rollup — and nothing is drawn. An empty `label` is the other
 * emptiness: the rollup is on and this item is a leaf, which the tree still gives an
 * empty `.pbl-meta-col` so its row stays aligned with the header and with its non-leaf
 * siblings. An empty measure is not a zero, and it is not an absent column either.
 */
export function rollupReport(host: BacklogViewHost, item: BacklogItem): RollupReport | null {
	const settings = host.settings;
	if ((!settings.stateKey && !settings.showCounts) || !hasRollup(host.projection)) return null;
	if (item.descendantCount === 0) return { label: '', tooltip: '', ratio: null };
	if (!settings.stateKey) return { label: String(item.descendantCount), tooltip: '', ratio: null };
	return {
		label: `${item.doneDescendants}/${item.descendantCount}`,
		tooltip: `${item.doneDescendants} of ${item.descendantCount} items done`,
		ratio: item.doneDescendants / item.descendantCount,
	};
}
```

Rewrite `renderRollup` onto it, keeping its DOM and its classes exactly as they are — `.pbl-meta-col`, `.pbl-progress`, `.pbl-progress-bar`, `.pbl-progress-fill`, `.pbl-progress-label`, `.pbl-count`, and the `pbl-complete` class at `ratio === 1`. **Order matters:** the column is created after the null check and BEFORE the empty-label check, exactly as today —

```ts
	const report = rollupReport(host, item);
	if (!report) return;
	const col = row.createDiv({ cls: 'pbl-meta-col' });
	if (!report.label) return;
```

— so a leaf still reserves its empty column. **This is a refactor with no behaviour change**, so the existing tree tests are the check: they must pass untouched. Before trusting them, confirm one of them actually asserts the leaf's empty `.pbl-meta-col`; if none does, add that assertion first and watch it fail against a deliberately wrong ordering, because this is the one difference the rewrite could silently swallow.

```bash
npx vitest run test/view/ -t 'rollup'
npm run check
```

Expected: PASS, and the full gate green. Commit this on its own, so the behaviour-free refactor is separable from the feature:

```bash
git add src/view/render/columns.ts
git commit -m "Say the rollup once"
```

Stage it explicitly. `columns.ts` appears in no other commit in this plan, so a `git commit` with nothing staged would leave the whole refactor in the working tree while every later check passed against it — the shape of a defect review already found once in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `test/view/barProgress.test.ts`. Read `test/CLAUDE.md` first for how a view test mounts the view and drives a render; copy the setup from `test/view/timeline.test.ts` rather than inventing one, and build fixtures with `demoOptions()` / `demoResults()` from `test/helpers/fixtures.ts`.

The cases, each asserted from the rule rather than from the implementation:

```ts
// A parent with descendants: the fill's width is the done share, and the count
// says the same numbers the tree's rollup column says.
// Fixture: a Feature with 4 PBIs beneath it, 1 of them done, both dates set.
//   expect fill.style.getPropertyValue('--pbl-progress') === '25%'
//   expect countEl.textContent === '1/4'
// Assert the TRACK and the FILL are different elements — `.pbl-bar-progress` with
// a `.pbl-bar-progress-fill` child. A single element would be a band in one
// colour, and the one colour available on a bar is the bar's own, which is
// invisible against it.

// A leaf draws neither. An empty measure is not a zero.
//   expect row.querySelector('.pbl-bar-progress') === null
//   expect row.querySelector('.pbl-bar-count') === null

// No state property configured, showCounts on: NO band, and the count is
// present with the descendant count as its text. Assert the VALUE — the band's
// absence and the count's presence are two claims, and only the second is what
// the tree promises in this configuration.
//   expect row.querySelector('.pbl-bar-progress') === null
//   expect countEl.textContent === '4'

// A milestone draws no band. Its mark is a point, not a span.
// An outside-window arrow draws no band, even with descendants: the arrow is a
// 10px mark and a band inside it would claim a width it does not have.

// An INFERRED bar at 100% done keeps its own geometry: the bar element still
// carries `pbl-bar-inferred`, and the band is a child of it rather than a
// replacement for it. This is the case a full-height fill would destroy.
//   expect barEl.classList.contains('pbl-bar-inferred')
//   expect barEl.querySelector('.pbl-bar-progress')

// An OPEN-ENDED bar at 100% done, likewise: `pbl-bar-open-end` still on the
// bar, band inside it.

// The ROW's accessible name includes the count, and the BAR's aria-label is
// still the dates alone. Progress is announced once per row, from the lead
// cell, not twice.
//   expect the row to carry a `.pbl-sr-only` span whose text is
//     '1 of 4 items done' — NOT row.textContent, which is blind to whether
//     the lead's own tooltip has replaced its subtree in the accessible name
//   expect barEl.getAttribute('aria-label')).not.toContain('done')

// A context item counts its VISIBLE results only — an outsideFilter parent over
// 2 results, 1 done, reads 1/2 no matter what the excluded note's own state is.
// Driven on a LANE CONTEXT ROW's count, NOT on a band: `deriveBars` routes every
// outsideFilter item to `context` before a placement is computed, so no context
// item ever draws a bar on any axis, and a "context bar" test would be asserting
// a state the projection cannot produce.
```

Assert the band by class and its width by the `--pbl-progress` custom property, never by a computed pixel width: jsdom computes no layout, and a test that reads one is asserting nothing.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run test/view/barProgress.test.ts
```

Expected: every case FAILS with a null element — `.pbl-bar-progress` and `.pbl-bar-count` do not exist yet. A case that passes at this point is asserting something other than its name; fix it now.

- [ ] **Step 3: Write the renderer**

Create `src/view/render/barProgress.ts`. It mirrors `renderRollup` in `src/view/render/columns.ts:485` — read that function first, because the two must report the same numbers in the same words, and the guard on its first line is the one to copy rather than restate.

```ts
import { setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { hasRollup } from '../projection';
import { BacklogItem } from '../../domain/model';

/**
 * How far along a dated row's subtree is, on the two surfaces a timeline row has:
 * a band inside the bar, and a count in the sticky lead cell.
 *
 * **The band is INSET inside the bar, never a wash over it**, and that is the whole
 * reason it is a band. A bar's own background is already carrying meaning three ways
 * in `styles/timeline.css` — `.pbl-bar-inferred` is `background: none` plus a dashed
 * border, `.pbl-bar-open-start` / `.pbl-bar-open-end` are gradients fading to
 * transparent, and their compound has a rule of its own. A child spanning the bar's
 * height would paint over every one of them, so at 100% done an open span would read
 * as stated and closed and an inference would read as a plan. Inset, no shape needs a
 * special case and none can be forgotten.
 *
 * **A track and a fill, in the tree's own two colours — never the bar's.** `.pbl-bar`
 * paints `background-color: var(--pbl-bar-color)`, so a band in that colour would be
 * invisible against an ordinary stated span at every percentage, which is the commonest
 * shape there is. `styles/columns.css` already solved this for the tree: a neutral
 * track (`--background-modifier-border`) with a green fill
 * (`rgb(var(--color-green-rgb))`). Copied rather than re-decided, so the band reads
 * against all eight state colours at once and looks like the progress this reader
 * already knows.
 *
 * **The count is not a consequence of the band.** With no workflow configured there is
 * no done to count, and `Progress on the bar` extension 1c still promises the tree's
 * descendant count in exactly that configuration — which a timeline row would never
 * show, since it calls `renderRollup` nowhere. So the count renders on its own terms
 * wherever the item has descendants: beside the band with a workflow, and as the whole
 * report without one.
 *
 * `bar` is null where the shape takes no band — a milestone diamond and an
 * outside-window arrow are marks rather than spans (`markWidth` in `./barLabel.ts`
 * owns that distinction), and a lane context row draws no `.pbl-bar` at all. Those
 * surfaces still get their count, so each reports what it can draw and claims nothing
 * it cannot.
 *
 * The words and the guard are `rollupReport`'s in `./columns.ts`, shared with the tree's
 * own renderer rather than restated here: one item cannot report its progress
 * differently per projection, which is what `Progress on the bar` guarantees, and two
 * copies of a string is how that comes apart.
 *
 * The count carries the words, and the BAR does not. A bar's label is its dates, which
 * is what a bar is about; the count sits in the lead cell, which is part of the row's
 * own accessible name, so a screen reader walking the row hears the progress once
 * rather than twice.
 */
export function renderBarProgress(
	host: BacklogViewHost,
	mounts: { row: HTMLElement; bar: HTMLElement | null; lead: HTMLElement },
	item: BacklogItem,
): void {
	const report = rollupReport(host, item);
	// An empty label is the tree's leaf case, where it reserves an empty column for
	// alignment. A timeline row has no column to keep aligned, so it draws nothing.
	if (!report || !report.label) return;
	if (mounts.bar && report.ratio !== null) {
		const track = mounts.bar.createDiv({ cls: 'pbl-bar-progress' });
		track.createDiv({ cls: 'pbl-bar-progress-fill' }).setCssProps({
			'--pbl-progress': `${Math.round(report.ratio * 100)}%`,
		});
	}
	const label = mounts.lead.createSpan({ cls: 'pbl-bar-count', text: report.label });
	if (report.tooltip) setTooltip(label, report.tooltip);
	// Said again for a screen reader, on the ROW, because the lead cell carries its own
	// `setTooltip(lead, title)` and a tooltip that becomes an `aria-label` REPLACES the
	// cell's text in the accessible name — taking this count with it. `renderRowFacts`
	// already states the row's state and its dependencies this way, for the same reason.
	// The visible chip above is inside that labelled cell and so is not announced, which
	// is what keeps this from being a second announcement rather than the only one.
	mounts.row.createSpan({ cls: 'pbl-sr-only', text: report.tooltip || `${report.label} items` });
}
```

- [ ] **Step 4: Style the band and the count**

Add to `styles/timeline.css`, below the `.pbl-bar-inferred` rules so the reader meets the shapes before the thing drawn inside them:

```css
/* How far along, drawn INSIDE the bar and inset from its edges — see
   `renderBarProgress`. The inset is the point: `.pbl-bar-inferred` is an outline and
   the open-end rules are gradients, so a child at full height would paint over the
   very thing that says a span is inferred or unstated. Bottom-aligned and a few
   pixels tall, so the border, the dashes and both fades stay readable above it.

   A TRACK, not a bare fill, and neither of them in `--pbl-bar-color`: `.pbl-bar` is
   painted in that colour, so a band wearing it would be invisible on every ordinary
   stated span. These are the tree's own two progress colours from `columns.css`
   (`.pbl-progress-bar` / `.pbl-progress-fill`), which is what makes one rule read
   against all eight state colours and look like the progress the tree already shows. */
.pbl-bar-progress {
	position: absolute;
	inset-inline-start: 2px;
	inset-inline-end: 2px;
	bottom: 1px;
	height: 4px;
	border-radius: 2px;
	background-color: var(--background-modifier-border);
	overflow: hidden;
	/* Decoration over a mark that already carries the row's accessible name and the
	   drag grips; it must never take a hit away from them. */
	pointer-events: none;
}

.pbl-bar-progress-fill {
	width: var(--pbl-progress, 0%);
	height: 100%;
	border-radius: 2px;
	background-color: rgb(var(--color-green-rgb));
}

/* The count in the sticky lead cell, in the tree's own rollup-label shape. */
.pbl-bar-count {
	margin-inline-start: auto;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	flex: 0 0 auto;
}
```

`.pbl-bar` is already `position: absolute`, so the band's `inset-inline-start` and `bottom` resolve against the bar's own edges — the same arrangement `.pbl-bar-grip` already relies on. Confirm that before assuming it: read the `.pbl-bar` rule at the top of the file.

- [ ] **Step 5: Call it from the timeline row**

In `src/view/render/timeline.ts`, inside `renderBarRow`, after the bar element `el` and its grips exist and after `lead` is populated — put the call immediately before the existing `renderRowFacts(...)` line:

```ts
	renderBarProgress(ctx.host, { row, bar: geometry.milestone || geometry.outside ? null : el, lead }, bar.item);
```

Add the import beside the other `./` imports. **Budget: this is +1 code line of the 10 this file has.** Do not add anything else to this file in this task.

- [ ] **Step 6: Call it from the lane context row**

In `src/view/render/lanes.ts`, inside `renderLaneContextRow`, after `setTooltip(lead, item.title);` and before the empty track is created:

```ts
	renderBarProgress(ctx.host, { row, bar: null, lead }, item);
```

This row has no `.pbl-bar` at all — it is a lead cell and an empty track — so it takes the count and no band, which is the whole reason `bar` is nullable.

- [ ] **Step 7: Run the tests and watch them pass**

```bash
npx vitest run test/view/barProgress.test.ts
```

Expected: PASS, every case.

- [ ] **Step 8: Prove the inset and the contrast by breaking them**

Two claims here are the design, so find out now what the suite can actually see. Temporarily change `.pbl-bar-progress` to `top: 0; bottom: 0; height: auto;`, and separately change `.pbl-bar-progress-fill`'s colour to `var(--pbl-bar-color)`. Run the tests after each. **Both still pass** — jsdom computes no layout and resolves no custom property to a colour, so neither the inset nor the contrast is checked anywhere. Restore both rules and write that limit into the note in Step 10 rather than leaving the guarantees looking checked. They belong on the live-vault list, not in a test that would only pretend.

- [ ] **Step 9: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass. If `max-lines` fails on `timeline.ts`, you added more than the one call line — move whatever else you added into `barProgress.ts`.

- [ ] **Step 10: Specify the module**

`docs-check.mjs` rule 7 requires every `src/` module to be specified. Replace the `## Where it lives` section of `docs/requirements/Progress on the bar.md`:

```markdown
## Where it lives

**Built.** `renderBarProgress` in `src/view/render/barProgress.ts` draws both halves —
the band inside the bar and the count in the lead cell — from the rollup fields
`src/domain/model.ts` already assigns, in the words `renderRollup` already uses. Its
own module because `src/view/render/timeline.ts` sits at its 400-line budget, the same
reason `barLabel.ts` and `lanes.ts` left that file before it.

The band is inset inside the bar rather than washed over it, because a bar's
background already says whether its span is inferred (`background: none` plus a dashed
border) and whether either end is unstated (a gradient fading to transparent) — claims
a full-height child would paint over. It is a track and a fill in the tree's own two
progress colours rather than the bar's, since `.pbl-bar` is painted in that colour and a
band wearing it would be invisible on every ordinary span. `renderBarRow` in
`timeline.ts` passes a null bar for a milestone and for an outside-window arrow, which
are marks rather than spans, and `renderLaneContextRow` in `lanes.ts` passes null
because that row draws no bar at all; all three still render their count. No context
item is banded on any axis, because `deriveBars` routes one to `context` before a
placement is computed for it.

Driven in `test/view/barProgress.test.ts`. **Neither the inset nor the contrast is
checked there** — jsdom computes no layout and resolves no custom property to a colour,
so a full-height band in the bar's own colour passes every assertion in that file. Both
are on the live-vault list in the spec, with the compact density's band height.
```

- [ ] **Step 11: Commit**

```bash
git add src/view/render/barProgress.ts styles/timeline.css src/view/render/timeline.ts src/view/render/lanes.ts test/view/barProgress.test.ts docs/requirements/
git commit -m "Draw how far along a dated row is"
```

---

### Task 4: The roadmap names its matches, on every surface

`renderCardMatches` is called from the board's column path alone, so no roadmap surface names a match the filter found beneath it. The fix does not enumerate the surfaces — it has a surface register itself as it draws, the way `RowContext.cardKids` already registers disclosures.

**Files:**
- Modify: `src/view/render/columns.ts` (the `PlacedMount` type, `RowContext.placed`, `rowContext`)
- Modify: `src/view/childrenList.ts` (`undisclosedMatches` takes the already-listed set)
- Modify: `src/view/render/board.ts` (`renderCardMatches` exported, two new parameters)
- Modify: `src/view/render/roadmap.ts` (bucket cards register; the second pass)
- Modify: `src/view/render/shelf.ts` (shelf cards and context-strip cards register)
- Modify: `src/view/render/lanes.ts` (the lane context row registers)
- Modify: `src/view/render/timeline.ts` (the bar row registers — budget +1 of the 9 left)
- Modify: `src/view/host.ts` (`RoadmapSnapshot.placed`)
- Modify: `docs/requirements/Focus level picks the rows.md` (`## Where it lives`)
- Test: `test/view/roadmapMatches.test.ts`

**Interfaces:**
- Consumes: `hiddenMatches` and `cardPaths` from `src/domain/board.ts`; `listedChildren` from `src/view/childrenList.ts`; `BacklogViewHost.isFilterMatch`, `.isRowHidden`, `.isFiltering`.
- Produces:
  ```ts
  // src/view/render/columns.ts
  export interface PlacedMount {
      item: BacklogItem;
      mount: HTMLElement;
      listsChildren: boolean;
  }
  // on RowContext
  placed: Map<string, PlacedMount>;

  // src/view/childrenList.ts — `listed` is what the CALLER already shows
  export function undisclosedMatches(
      host: BacklogViewHost,
      item: BacklogItem,
      carded: Set<string>,
      listed: readonly BacklogItem[],
  ): BacklogItem[]

  // src/view/render/board.ts
  export function renderCardMatches(
      ctx: RowContext,
      mount: HTMLElement,
      item: BacklogItem,
      carded: Set<string>,
      listsChildren: boolean,
  ): void
  ```
  Task 5 reads `RoadmapSnapshot.placed` and calls `undisclosedMatches` with the same four arguments.

- [ ] **Step 1: Write the failing tests**

Create `test/view/roadmapMatches.test.ts`. Model the setup on `test/view/roadmapFrame.test.ts`. Every case runs with the quick filter **active** — match naming does nothing otherwise.

```ts
// Each of the five surfaces names a match three levels below it, and each link
// opens its own note:
//   - a bucket card (horizon axis)
//   - a timeline bar row (dated axis)
//   - a shelf card
//   - a context-strip card (roadmap.context — a focused outsideFilter root on
//     the dated axis lands here)
//   - a lane context row (ResourceLane.context — resources axis)
// Assert `.pbl-card-match` buttons under the surface's own element, with the
// match's title as text, and that clicking one opens the MATCH and not the
// card beneath it. Assert `auxclick` with `button: 1` separately: a middle
// click never fires `click`, and stopping only the primary event is a bug the
// board already shipped once.

// A DIRECT child as the match, on a timeline bar row: it is named. This is the
// case the old unconditional subtraction ate, and a three-levels-down test
// passes straight over it.

// The same direct child on a BUCKET CARD: named once by the card's disclosure
// and NOT a second time as a match.

// Two ways an item is modelled but not drawn while a filter runs — assert the
// ANCESTOR names the match rather than stopping at it:
//   - a collapsed shelf (host.shelfCollapsed; renderShelf has no filter term)
//   - an expanded shelf whose type filter hides the matching group
//     (host.shelfHiddenTypes, passed to organizeShelf)

// A folded lane REOPENS under a filter — isLaneCollapsed returns
// `!filter.active && …` — so its rows draw, register, and name their own
// matches. Assert that, not the impossible opposite.
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run test/view/roadmapMatches.test.ts
```

Expected: every case FAILS — no `.pbl-card-match` element exists on any roadmap surface today. If the bucket-card duplicate case passes, check it is actually filtering; a case that never filters is green for free.

- [ ] **Step 3: Add the register to `RowContext`**

In `src/view/render/columns.ts`, beside the `cardKids` field:

```ts
/**
 * A surface that put an item on screen, and where that item's match links go: the
 * card itself, or a row's sticky lead cell.
 *
 * `listsChildren` is whether this surface shows the item's children on its own face,
 * which decides whether a match already on the card is named twice. It cannot be read
 * off `cardKids`: a timeline row joins that set for its FOLD chevron, which lists
 * nothing.
 */
export interface PlacedMount {
	item: BacklogItem;
	mount: HTMLElement;
	listsChildren: boolean;
}
```

Add to `RowContext`:

```ts
	/**
	 * What this pass actually DREW, and where each one's matches go. Filled by the
	 * surfaces as they render and read after they have all run, so "is this item on
	 * screen" is a fact rather than a prediction — the same arrangement `cardKids`
	 * above uses, and for the same reason.
	 *
	 * The roadmap needs it because its model is not what it draws: `RoadmapModel.shelf`
	 * holds every shelved item whether or not `host.shelfCollapsed` shows them, and
	 * `organizeShelf` drops whole groups from an EXPANDED shelf through
	 * `host.shelfHiddenTypes`. Neither is overridden by an active filter, while a lane
	 * fold IS — two states that look alike, answering the same question oppositely.
	 */
	placed: Map<string, PlacedMount>;
```

And in `rowContext()`, add `placed: new Map()` to the returned object. It is created here rather than on the view because `backlogView.ts` has two code lines of headroom and already passes this context to the whole render pass.

- [ ] **Step 4: Make the subtraction the caller's**

In `src/view/childrenList.ts`, change `undisclosedMatches` to take what the caller already lists rather than deciding for it:

```ts
export function undisclosedMatches(
	host: BacklogViewHost,
	item: BacklogItem,
	carded: Set<string>,
	listed: readonly BacklogItem[],
): BacklogItem[] {
	const shown = new Set(listed.map((child) => child.file.path));
	return hiddenMatches(
		item,
		(child) => host.isFilterMatch(child),
		carded,
		(child) => !host.isRowHidden(child),
	).filter((match) => !shown.has(match.file.path));
}
```

Update the doc comment above it: the rule is that a surface must not name twice what it already shows, and **only the surface knows what it shows**. A timeline row draws no disclosure, so subtracting `listedChildren` there would delete a direct-child match — the below-focus result this whole feature exists to reach.

- [ ] **Step 5: Open `renderCardMatches` to the other surfaces**

In `src/view/render/board.ts`, export it and let the caller say what it lists:

```ts
export function renderCardMatches(
	ctx: RowContext,
	mount: HTMLElement,
	item: BacklogItem,
	carded: Set<string>,
	listsChildren: boolean,
): void {
	const host: BacklogViewHost = ctx.host;
	if (!host.isFiltering()) return;
	const matches = undisclosedMatches(host, item, carded, listsChildren ? listedChildren(host, item) : []);
	if (matches.length === 0) return;
	const list = mount.createDiv({ cls: 'pbl-card-matches' });
	// … body unchanged from here
}
```

Import `listedChildren` beside the existing `undisclosedMatches` import. Leave the body alone — the `fromRowControl` arrangement and the `auxclick` handler are both load-bearing. Update the call in `renderCard` to `renderCardMatches(ctx, card, item, render.carded, true)`: a board card lists its children.

- [ ] **Step 6: Have each roadmap surface register**

One line per surface, at the point where it has both the item and the element its links belong on.

`src/view/render/roadmap.ts`, in `renderBucket`, after `wireCardActivation(ctx, card, item);`:

```ts
		ctx.placed.set(item.file.path, { item, mount: card, listsChildren: true });
```

`src/view/render/shelf.ts`, after each `renderCardBody(...)` — there are two, the shelf card and the context-strip card:

```ts
	ctx.placed.set(entry.item.file.path, { item: entry.item, mount: card, listsChildren: true });
```

(use the local name each site actually has for the item — `entry.item` in one, `item` in the other).

`src/view/render/lanes.ts`, in `renderLaneContextRow`, before `return row;`:

```ts
	ctx.placed.set(item.file.path, { item, mount: lead, listsChildren: false });
```

**And in the same edit, make that row reachable — it is not today.** `renderLaneContextRow` never calls `wireCardActivation`, and `renderTimeline` publishes `cards: bars.map((bar) => bar.item)`, which excludes `lane.context` entirely. So a lane context row cannot be selected, cannot be opened with Enter, and has no menu — while `Opening the work` says Enter opens the note in every projection, **context rows included**, and `Keyboard and menu on the roadmap` extension 2a says the same. That is a pre-existing bug in the resources axis, not something this increment introduces; but this increment is what makes it bite, because match links are `tabindex="-1"` and the menu is their only keyboard route. Adding pointer-only links to an unreachable row would be the exact failure section 3 exists to prevent.

Two changes, both small:

```ts
	// in renderLaneContextRow, beside the placed registration
	wireCardActivation(ctx, row, item);
```

and in `src/view/render/timeline.ts`, where the entry pass builds its result, include the `context` entries' items in `cards` alongside the bars', in the order they draw. Read `drawEntries` and the `cards:` construction at `renderTimeline` before editing: the order of `cards` is the roving keyboard walk's reading order, so a context row must land where it draws, not appended at the end.

**File the bug.** Add `docs/bugs/A lane context row could not be reached.md` in this task's commit, stating what was wrong, the criterion it broke (`Opening the work`), how it was found (review of this increment's plan), and the two call sites. `docs-check.mjs` requires a `type`, `order`, `status` and a parent — model it on an existing note in `docs/bugs/` and hang it under `Showing a resources axis on the roadmap`.

`src/view/render/timeline.ts`, in `renderBarRow`, beside the `renderBarProgress` call Task 3 added:

```ts
	ctx.placed.set(bar.item.file.path, { item: bar.item, mount: lead, listsChildren: false });
```

**Budget: +1 code line in `timeline.ts`, leaving 8.**

A row's mount is its `lead` — the sticky lead column, the one text region such a row has. A card's mount is the card.

- [ ] **Step 6b: While filtering, a row's count slot says MATCHES instead of progress**

**Twice measured, twice wrong, and the second measurement found the rule.** Drawing match titles in the lead let them shrink against the title and left one character of the row's name at the default width. Replacing them with a fixed-width chip (`flex: 0 0 auto`) still cost the title 34px at 220px — and, because an unshrinkable item cannot yield, it overflowed the lead by **28.95px** at the 160px floor where the old list managed 3.31px.

The rule underneath both: **a fixed-width column's only shrinkable item is the title, so anything ADDED to the lead is taken from the row's name.** The affordance therefore must not be an addition.

It is a **substitution**. The lead already carries a count slot — `.pbl-bar-count`, the rollup Task 3 put there. Matches only exist while the quick filter is active, so:

- **filter inactive** → that slot shows the rollup, exactly as today;
- **filter active** → the same slot shows the match affordance instead.

Never both, so the lead's width budget is unchanged and the title keeps what it had. It is also the more useful number during a search: the rollup counts every descendant regardless of the filter, which is not what a reader narrowing the view is asking about.

Two consequences to build:

1. `renderBarProgress` is not the right owner any more — the choice depends on the filter and on the match walk, which run later. Have the second pass **replace** the lead's `.pbl-bar-count` content for a row that has matches, rather than appending beside it. Keep the `.pbl-sr-only` progress span as it is: it is on the row, costs no width, and the marker-label fix from round 1 stays.

2. **The affordance must be able to shrink**, so it can never do what round 1's chip did:

```css
/* Occupies the count slot while a filter runs — a substitution, not an addition, because
   the lead's only shrinkable item is the row's title and anything added comes out of the
   row's name. Shrinkable itself, down to the icon alone: an unshrinkable chip hung 28.95px
   out of the column at the 160px floor, measured. */
.pbl-row-matches {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	display: inline-flex;
	align-items: center;
	gap: var(--size-2-1);
	padding: 0 var(--size-2-1);
	height: auto;
	line-height: 1.4;
	box-shadow: none;
	background-color: var(--background-modifier-hover);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
```

Cards are untouched by all of this: bucket cards, shelf cards and the context strip keep the full link list, because a card has the width and the board has drawn it that way since the feature existed.

**Re-measure at 160 / 220 / 480, and the pass conditions are now:**
1. Row height equal, chip and no chip, in the same render. (Passed twice; keep it passing.)
2. **Nothing past the lead's right edge at 160px** — this is the one round 1 regressed, so measure it first.
3. **A chip row's `.pbl-card-title` width within a few px of a non-chip row's at the same width.** This is now achievable, because the slot was already spent on the rollup. If it still fails, stop and report the numbers — do not reach for a third shape without me.

- [ ] **Step 7: Run the second pass**

In `src/view/render/roadmap.ts`, after `renderContextStrip` and before `syncShelfTabStops` — every surface has drawn by then, which is the whole point:

```ts
	nameMatches(ctx);
```

And the function, beside the other helpers in that file:

```ts
/**
 * Name the matches the filter found under each drawn item, now that every surface has
 * registered. A second pass rather than inline calls, because "which items are already
 * on screen" is only true once the last one is: the board can ask its model
 * (`cardPaths`) because a `BoardModel` is already narrowed to what draws, and the
 * roadmap's is not.
 */
function nameMatches(ctx: RowContext): void {
	if (!ctx.host.isFiltering()) return;
	const carded = new Set(ctx.placed.keys());
	for (const placed of ctx.placed.values()) {
		renderCardMatches(ctx, placed.mount, placed.item, carded, placed.listsChildren);
	}
}
```

- [ ] **Step 8: Publish the register for the menu**

In `src/view/host.ts`, add to `RoadmapSnapshot` beside `cards`:

```ts
	/**
	 * What the pass drew, by path — the register `nameMatches` built, kept so the row
	 * menu can offer the same matches the faces do. The menu is handed an item and no
	 * surface, so `listsChildren` has to travel with the mount or the menu would have
	 * to guess: always subtracting loses a row's direct-child match, never subtracting
	 * offers a card's disclosure entries a second time.
	 */
	placed: ReadonlyMap<string, PlacedMount>;
```

Import `PlacedMount` from `./render/columns`. In `src/view/render/roadmap.ts`, add `placed: ctx.placed` to the object `renderRoadmapProjection` returns.

- [ ] **Step 9: Run the tests and watch them pass**

```bash
npx vitest run test/view/roadmapMatches.test.ts
```

Expected: PASS, every case. The menu cases are Task 5 — leave them failing or unwritten until then, and say which in the commit.

- [ ] **Step 10: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass. Fallow may report `PlacedMount.item` unused if only reached through a property access — annotate the local (`const placed: PlacedMount = …`) rather than adding it to `usedClassMembers`.

- [ ] **Step 11: Specify the modules**

In `docs/requirements/Focus level picks the rows.md`, replace the last paragraph of `## Where it lives`:

```markdown
The quick filter's descendant naming is `nameMatches` in `src/view/render/roadmap.ts`,
over `RowContext.placed` in `src/view/render/columns.ts` — a register each surface fills
as it draws, holding where an item's match links go and whether that surface lists its
children. It is read rather than predicted because the roadmap's model is not what it
draws: `RoadmapModel.shelf` holds every shelved item whether `host.shelfCollapsed` shows
them or not, and `organizeShelf` drops whole groups from an expanded shelf through
`host.shelfHiddenTypes`. Neither is overridden by an active filter; a lane fold is. The
walk itself is `hiddenMatches` in `src/domain/board.ts`, unchanged, through
`undisclosedMatches` in `src/view/childrenList.ts` — which now takes the already-listed
set from its caller, since a timeline row draws no disclosure and subtracting one would
delete a direct-child match. Driven in `test/view/roadmapMatches.test.ts`.

The inferred spans remain, which is why this note stays open.
```

- [ ] **Step 12: Commit**

```bash
git add src/view/ styles/timeline.css test/view/roadmapMatches.test.ts docs/
git commit -m "Let every roadmap surface name what the search found under it"
```

---

### Task 5: The same matches in the row menu

The links are `tabindex="-1"`, so the menu is their keyboard path rather than an extra. On the roadmap it does not exist: `addMatchSection` asks for a board and exits when there is none.

**Files:**
- Modify: `src/view/childrenList.ts` (new `matchesFor`)
- Modify: `src/view/interactions/menu.ts` (`addMatchSection` — **3 code lines of headroom; this change must be net-negative**)
- Modify: `docs/requirements/Keyboard, menu and touch.md` or `docs/requirements/The quick filter on the board.md` (`## Where it lives`, wherever the menu's match section is currently specified — find it with `grep -rn addMatchSection docs/`)
- Test: `test/view/roadmapMatches.test.ts` (the menu cases)

**Interfaces:**
- Consumes: `RoadmapSnapshot.placed` and `BacklogViewHost.board` (Task 4); `cardPaths` from `src/domain/board.ts`.
- **`PlacedMount` is exported from `src/view/host.ts`, NOT from `render/columns.ts`.** Task 4 moved it: declaring it in `render/columns.ts` and importing it into `host.ts` opened 16 circular dependencies that fallow refuses, because every `render/` module already reaches `host.ts` through `RowContext`. It follows the precedent `DrawnColors` sets in that same file, which is there for the same reason. Import it from `../host`.
- Produces:
  ```ts
  // src/view/childrenList.ts
  export function matchesFor(host: BacklogViewHost, item: BacklogItem): BacklogItem[]
  ```

- [ ] **Step 1: Write the failing tests**

Add to `test/view/roadmapMatches.test.ts`:

```ts
// The row menu on a TIMELINE ROW offers "Open match …" for a match three
// levels down.
//
// A DIRECT child of that row is offered ONCE, as "Open child" — not as a
// match. The row lists no children on its FACE, so the face names the child as
// a match; its MENU lists children through `cardChildrenShown`, so the menu
// names it as a child. Two surfaces, two policies, one entry each. Asserting
// "Open match" here would contradict the no-duplicate case below.

// The row menu on a BUCKET CARD does NOT offer a direct child as a match: the
// card's own disclosure already lists it, and one card cannot say the same
// thing twice.

// NO NOTE APPEARS TWICE IN ONE MENU. On that same row, collect every entry
// title and assert the child's title appears exactly once. This is what
// catches the menu reusing the face's policy — the row lists no children on
// its face but its menu does, through `cardChildrenShown`, which it joins via
// the fold chevron.

// A context row's menu offers navigation and no write action — the existing
// rule, re-asserted here because this task adds entries to that menu.
```

**Drive the menu the way a user opens it, not by calling the builder.** Dispatch `contextmenu` on the row or card and take the menu from `Menu.lastShown`, as `test/view/roadmapMoves.test.ts` does. Calling `buildItemMenu` directly would pass for a surface a keyboard user cannot even select — which is exactly what a lane context row was before Task 4 wired its activation, so this is the assertion that keeps that fix honest. For the lane context row, additionally assert it is in the roadmap's navigable `cards` and that Enter opens its note, so "the menu exists" and "the menu is reachable" are two checks rather than one hope.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run test/view/roadmapMatches.test.ts -t 'menu'
```

Expected: FAIL — no `Open match` entry on any roadmap menu. The bucket-card case may pass vacuously (no entries at all); confirm it fails for the right reason by checking the three-levels-down case fails first.

- [ ] **Step 3: Put the question where both callers already share one answer**

In `src/view/childrenList.ts` — the module whose own comment says it exists so the card face and the row menu "share one answer without" a cycle:

```ts
/**
 * The matches to offer for this item, asked of whichever projection drew it.
 *
 * A board asks its model: a `BoardModel` is already narrowed to what draws, so
 * `cardPaths` is honest there. The roadmap asks the register its render filled, because
 * its model is not what it draws — and that register is also where the disclosure
 * policy is, which the menu cannot work out for itself: it is handed an item and no
 * surface, so always subtracting would lose a row's direct-child match and never
 * subtracting would offer a card's disclosure entries a second time.
 */
export function matchesFor(host: BacklogViewHost, item: BacklogItem): BacklogItem[] {
	// The MENU's already-listed set is not the face's. `addChildrenSection` adds an
	// "Open child" entry for every `listedChildren` whenever the path is in
	// `cardChildrenShown` — and a timeline row joins that set through its FOLD chevron,
	// while listing nothing on its face. Reusing the face's policy here would offer one
	// note twice in one menu: once as a child, once as a match. So the menu asks the
	// thing that actually lists in a menu.
	const listed = host.cardChildrenShown.has(item.file.path) ? listedChildren(host, item) : [];
	const roadmap = host.roadmap;
	if (roadmap) return undisclosedMatches(host, item, new Set(roadmap.placed.keys()), listed);
	const board = host.board?.board;
	if (!board) return [];
	return undisclosedMatches(host, item, cardPaths(board), listed);
}
```

Import `cardPaths` beside the existing `hiddenMatches` import.

- [ ] **Step 4: Shrink `addMatchSection` onto it**

In `src/view/interactions/menu.ts`:

```ts
function addMatchSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!host.isFiltering()) return;
	const matches = matchesFor(host, item);
	if (matches.length === 0) return;
	// … separator and loop unchanged
}
```

Import `matchesFor` beside `listedChildren` and `undisclosedMatches`; drop the `undisclosedMatches` import if nothing else in the file uses it, and drop `cardPaths` likewise — `activeBoard` stays, it has two other callers. **This must remove at least as many lines as it adds: the file has 3.** Verify with `npm run lint` rather than by counting.

- [ ] **Step 5: Run the tests and watch them pass**

```bash
npx vitest run test/view/roadmapMatches.test.ts
```

Expected: PASS, every case including Task 4's.

- [ ] **Step 6: Run the full gate**

```bash
npm run check
```

Expected: all five steps pass. A `max-lines` failure on `menu.ts` means Step 4 grew the file — move more of the question into `childrenList.ts`, which has 372 lines of headroom.

- [ ] **Step 6b: Ask the lane context row the context-row questions**

Task 4 gave that row a context menu — a **new entry point onto an `outsideFilter` item** — and `test/view/contextCardWrites.test.ts` was not extended to drive it. This repository's own rule is that each card projection's entry points get asked the same three questions, which is why that file exists. Add the lane context row to it: its menu offers no write action, its Set-type / Set-state / parent-link entries are absent, and nothing it can reach writes to the excluded note. Watch each fail against a deliberately permissive guard before trusting it.

- [ ] **Step 6c: Make the reachability claim mechanical**

Task 4's tests say in prose that a roadmap row's matches are unreachable until this task lands. Prose does not fail. Now that the menu names them, replace that comment with an assertion: on a timeline row and on a lane context row, with a filter active and a match below, the row menu contains an `Open match` entry for it. That is the check that would have caught this task never landing, and it is this repository's own rule — a rule stated in a comment is not a check.

- [ ] **Step 7: Specify it**

Update the `## Where it lives` section that currently describes `addMatchSection` (find it with `grep -rn addMatchSection docs/`), saying that the menu now asks `matchesFor` in `src/view/childrenList.ts`, which answers for whichever projection drew and carries the disclosure policy with it.

- [ ] **Step 8: Commit**

```bash
git add src/view/childrenList.ts src/view/interactions/menu.ts test/view/roadmapMatches.test.ts docs/requirements/
git commit -m "Give the roadmap's matches a keyboard path"
```

---

### Task 6: Close the notes the increment finished

**Files:**
- Modify: `docs/requirements/Progress on the bar.md` (status)
- Modify: `docs/requirements/Focus level picks the rows.md` (status — conditionally)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Tasks 1–5 complete and green.
- Produces: nothing.

- [ ] **Step 1: Close `Progress on the bar`**

Set `status: Done`. Its `## Where it lives` was rewritten in Task 3.

- [ ] **Step 1b: Judge the two notes Task 2 hollowed out**

`The horizon board.md` and `Drag from the shelf to schedule.md` each carried `status: Active` for one reason: a lane-crossing criterion. Task 2 removed those criteria, so both now read as fully delivered while still saying `Active`. Task 2 was right to leave them — a status flip is a claim about every remaining criterion, not a side effect of deleting one — but the claim is this task's to make.

For each: read its acceptance criteria and its `## Where it lives`, and check every remaining criterion against the code it names. Set `status: Done` only where all of them are met, and say in `## Where it lives` that the lane case went with the design rather than with an implementation. If any criterion is still open, leave the note `Active` and name what it is waiting for — an `Active` note that cannot say what it is waiting for is the thing this step exists to remove.

`Moving between horizons.md` was checked for the same shape and is not hollowed out: it keeps two independent reasons after losing its lane clause. Do not touch it.

- [ ] **Step 1c: Renumber the extensions Task 2 left with a gap**

`Drag from the shelf to schedule.md` reads `2a, 2b, 2c, 2e` after its `2d` was removed. Nothing cites `2d` by letter — that was checked across every note linking to it — so this is readability only: renumber `2e` to `2d`. If any note added since cites a letter in that list, update the citation with it.

- [ ] **Step 2: Test whether `Focus level picks the rows` can close**

Its third outstanding item is inferred spans counting below-focus results. Write one test in `test/domain/roadmap.test.ts`: with a focus level set, a focused row's inferred span covers a dated descendant **below** the focus level.

```bash
npx vitest run test/domain/roadmap.test.ts -t 'below-focus'
```

This is a **probe**, and the two outcomes are handled differently:

- **It passes.** `Spans roll up the tree` already met the requirement. Keep the test — it is now a real check of a real guarantee — set `Focus level picks the rows` to `status: Done`, and say in its `## Where it lives` that the span case is covered and where.

- **It fails.** The note stays `Open`. **Delete the probe** — do not commit it, and do not leave it as `it.skip` or `it.todo`. `npm run check` in Step 4 must be green, and this task stages `test/domain/roadmap.test.ts`, so a red test cannot be committed; a skipped one is worse, because this repository already holds that a rule stated but not checked is the defect (`docs/issues/A comment that states a rule is not a check.md`), and a permanently skipped test is exactly that with a green tick beside it.

  Record the gap where the register keeps gaps instead: paste the probe's code and its actual failure output into `Focus level picks the rows`' `## Where it lives`, naming precisely what the walk does with a below-focus dated descendant. That is evidence a later increment can act on, and it costs nothing to keep. Do not fix the walk here — it is a domain change and this increment's scope is the view.

Found by review: the plan's failing branch previously left a red test staged into a task that has to run the full gate.

- [ ] **Step 2b: Write down the second pitfall the Task 5 fixture works around**

`menuVault()` in `test/view/roadmapMatches.test.ts` documents one of the two structural facts its shape depends on — that a dated leaf's span infers upward through every ancestor, which blocks `hiddenMatches`' walk. It does not document the other: **under `focus`, `deriveBars` only ever sees `model.roots`, so a `TimelineRow` can never get a nested chevron.** The test simply omits `focus` from its `roadmap()` call with nothing saying why, so anyone adding a focused variant re-derives the pitfall from scratch.

Add one comment beside that omission saying it. This is bookkeeping, not behaviour: change no fixture and no assertion, and the suite must stay green with the same counts.

- [ ] **Step 3: Add the changelog entry**

Under `## [Unreleased]`, in the voice the existing entries use — someone deciding whether to upgrade, not a commit log:

```markdown
### Added

- **How far along a roadmap bar is** — a bar on the dated axis now carries a band
  showing the share of the work beneath it that is done, and every row with
  descendants carries the count the tree's rollup column shows. The band draws inside
  the bar without covering it, so a bar whose span is inferred still reads as
  inferred and an open end still reads as open. With no workflow property configured
  there is nothing to call done, so the count is the whole report — exactly as in the
  tree.

- **The roadmap says what your search found underneath** — filter the roadmap and any
  bucket card, bar, shelf card or context row that is only on screen because something
  beneath it matched now names those matches, each one opening its note. They are in
  the row menu too, so this needs no pointer. Previously a match three levels down was
  found, counted, and impossible to reach.

### Changed

- **Lanes will not be built** on the roadmap or the board. They were tried and refused.
```

- [ ] **Step 4: Run the full gate**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
# `test/domain/roadmap.test.ts` only if the probe PASSED and you kept it —
# on the failing branch it was deleted, and `git status` should show it unmodified.
git add docs/ CHANGELOG.md test/domain/roadmap.test.ts
git commit -m "Close what this increment finished"
```

---

## What this plan cannot check

State it in the pull request rather than letting `npm run check` read as proof:

- **The band against all eight state colours**, in light and dark, and against a themed vault's accent. `npm run harness` shows the layout and Obsidian's *default* colours; it cannot show a theme.
- **The inset and the contrast.** jsdom computes no layout and resolves no custom property to a colour, so a full-height band painted in the bar's own colour passes every test in `test/view/barProgress.test.ts`. Task 3 Step 8 makes you watch both, so they are known gaps rather than assumed passes.
- **The band's height at the compact density** — whether an inset band is still visible there.
- **The match links in a narrow lead column** — whether wrapping reads as intended at the smallest width the resize grip allows.

`npm run test-build` installs the plugin into this repository, and `docs/Product Backlog.base` is the fixture: it has deep subtrees, inferred spans, a milestone, context rows and — after Task 2 — dropped items.
