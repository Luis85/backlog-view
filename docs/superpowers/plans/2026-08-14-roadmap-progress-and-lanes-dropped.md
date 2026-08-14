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

- [ ] **Step 2: Say why, in each note**

Replace each note's `## Where it lives` section with:

```markdown
## Why it was dropped

Built, tried and refused on 2026-08-14. Lanes are not coming back to either
projection, so this note is kept as the record of a design already considered
rather than as work waiting to be done. It stays in the tree so every
`[[wikilink]]` to it still resolves and nobody proposes lanes again from the
code alone.
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
  export function renderBarProgress(
      host: BacklogViewHost,
      mounts: { bar: HTMLElement | null; lead: HTMLElement },
      item: BacklogItem,
  ): void
  ```
  `bar` is `null` where the shape takes no band — a milestone diamond, an outside-window arrow, and the lane context row, which has no `.pbl-bar` at all. Task 4 does not call this.

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
 * The words come from `renderRollup` in `./columns.ts` rather than being invented
 * here: one item cannot report its progress differently per projection, which is what
 * `Progress on the bar` guarantees.
 */
export function renderBarProgress(
	host: BacklogViewHost,
	mounts: { bar: HTMLElement | null; lead: HTMLElement },
	item: BacklogItem,
): void {
	const settings = host.settings;
	if ((!settings.stateKey && !settings.showCounts) || !hasRollup(host.projection)) return;
	if (item.descendantCount === 0) return;
	if (settings.stateKey) {
		const ratio = item.doneDescendants / item.descendantCount;
		if (mounts.bar) {
			const track = mounts.bar.createDiv({ cls: 'pbl-bar-progress' });
			track.createDiv({ cls: 'pbl-bar-progress-fill' }).setCssProps({
				'--pbl-progress': `${Math.round(ratio * 100)}%`,
			});
		}
		const label = mounts.lead.createSpan({
			cls: 'pbl-bar-count',
			text: `${item.doneDescendants}/${item.descendantCount}`,
		});
		setTooltip(label, `${item.doneDescendants} of ${item.descendantCount} items done`);
		return;
	}
	mounts.lead.createSpan({ cls: 'pbl-bar-count', text: String(item.descendantCount) });
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
	renderBarProgress(ctx.host, { bar: geometry.milestone || geometry.outside ? null : el, lead }, bar.item);
```

Add the import beside the other `./` imports. **Budget: this is +1 code line of the 10 this file has.** Do not add anything else to this file in this task.

- [ ] **Step 6: Call it from the lane context row**

In `src/view/render/lanes.ts`, inside `renderLaneContextRow`, after `setTooltip(lead, item.title);` and before the empty track is created:

```ts
	renderBarProgress(ctx.host, { bar: null, lead }, item);
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

`src/view/render/timeline.ts`, in `renderBarRow`, beside the `renderBarProgress` call Task 3 added:

```ts
	ctx.placed.set(bar.item.file.path, { item: bar.item, mount: lead, listsChildren: false });
```

**Budget: +1 code line in `timeline.ts`, leaving 8.**

A row's mount is its `lead` — the sticky lead column, the one text region such a row has. A card's mount is the card.

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
git add src/view/ test/view/roadmapMatches.test.ts docs/requirements/
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
- Produces:
  ```ts
  // src/view/childrenList.ts
  export function matchesFor(host: BacklogViewHost, item: BacklogItem): BacklogItem[]
  ```

- [ ] **Step 1: Write the failing tests**

Add to `test/view/roadmapMatches.test.ts`:

```ts
// The row menu on a TIMELINE ROW offers "Open match …" for a match three levels
// down, and for a DIRECT child — the row lists no children, so nothing is
// subtracted.

// The row menu on a BUCKET CARD does NOT offer a direct child as a match: the
// card's own disclosure already lists it, and one card cannot say the same
// thing twice.

// A context row's menu offers navigation and no write action — the existing
// rule, re-asserted here because this task adds entries to that menu.
```

Drive `buildItemMenu` the way `test/view/roadmapMoves.test.ts` drives it; do not reach into `addMatchSection` directly, or the test proves nothing about the menu a user opens.

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
	const roadmap = host.roadmap;
	if (roadmap) {
		const placed = roadmap.placed.get(item.file.path);
		const listed = placed?.listsChildren ? listedChildren(host, item) : [];
		return undisclosedMatches(host, item, new Set(roadmap.placed.keys()), listed);
	}
	const board = host.board?.board;
	if (!board) return [];
	return undisclosedMatches(host, item, cardPaths(board), listedChildren(host, item));
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

- [ ] **Step 2: Test whether `Focus level picks the rows` can close**

Its third outstanding item is inferred spans counting below-focus results. Write one test in `test/domain/roadmap.test.ts`: with a focus level set, a focused row's inferred span covers a dated descendant **below** the focus level.

```bash
npx vitest run test/domain/roadmap.test.ts -t 'below-focus'
```

If it passes, `Spans roll up the tree` already met the requirement — set `status: Done` and say so in `## Where it lives`. **If it fails, the note stays `Open`** and its `## Where it lives` names the hole precisely. Do not fix it here: it is a domain change and this increment's scope is the view.

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
