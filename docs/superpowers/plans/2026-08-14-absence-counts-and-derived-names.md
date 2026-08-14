# Absence counts and derived names — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a `2 items / 1 absence` readout on each resource band's header counting only
the absences that are upcoming or still running, and derive an absence note's name from its
facts so recording one asks for the dates alone.

**Architecture:** Two pure functions in `src/domain/absences.ts` (`pendingAbsences`,
`absenceTitle`) and the callers that read them — the band header in
`src/view/render/lanes.ts`, and the two absence acts in
`src/view/interactions/absences.ts`. `src/storage/absenceNotes.ts` is untouched: the
derivation happens upstream of the write boundary, which is where a decision about what a
note is called belongs. The `AbsenceFacts` interface moves down a layer to sit with the
function that consumes it.

**Tech Stack:** TypeScript, Obsidian plugin API (1.12.0 floor), esbuild, vitest (node +
jsdom environments), ESLint with per-directory `no-restricted-imports`.

**Spec:** [2026-08-14-absence-counts-and-derived-names-design.md](../specs/2026-08-14-absence-counts-and-derived-names-design.md)

## Global Constraints

- **`npm run check` must pass** — build + lint + coverage-thresholded tests + fallow +
  docs register. All five, before any commit.
- **Layers reach downward only.** `domain/` may not import `storage/` or `view/`;
  `storage/` may import `domain/`. Enforced by `no-restricted-imports`; a violation fails
  `npm run lint`.
- **`src/**` lint budget: 400 lines per file, `max-params: 5`, `complexity: 16`.**
  `renderLaneHead` goes from 4 parameters to 5 — exactly at the limit, so nothing else may
  be added to its signature.
- **`test/**` lint budget: 450 lines per file** (`skipBlankLines`, `skipComments`).
  `test/view/resourceAbsences.test.ts` is at **408** of 450 today. That is why the header
  readout's tests go in `test/view/resourceLanes.test.ts` (at 200) — the header count is
  that file's subject anyway.
- **Nothing under `src/domain/` reads a clock.** `today` is always a parameter.
- **Sentence-case UI text** (marketplace rule, enforced by lint and review).
- **Never write frontmatter outside `src/storage/frontmatter.ts` / `absenceNotes.ts`.**
- **Coverage thresholds only ever rise**, and the figure recorded is what the FINISHED
  increment measures — never one taken mid-flight.
- **Test dates that must be relative to today are built from `todayStamp()`**, never by
  stubbing the clock — the established pattern (`test/view/timelineLeadGeometry.test.ts`).
  `todayCivil()` reads the live clock in the view and no test fakes it.

---

## File structure

**Modify:**

| File | Responsibility after this change |
| --- | --- |
| `src/domain/absences.ts` | Adds `pendingAbsences` (how many stretches are still to come) and `absenceTitle` (what an absence note is called). Gains `AbsenceFacts`, moved down from `storage/`. |
| `src/storage/absenceNotes.ts` | Imports `AbsenceFacts` instead of declaring it. No other change. |
| `src/view/render/lanes.ts` | `renderLaneHead` takes `today` and draws the labelled readout. |
| `src/view/render/timeline.ts` | `drawEntries` passes `pass.drawing.today` through to `renderLaneHead`. |
| `src/ui/prompts.ts` | `AbsenceResult` and `AbsencePromptOptions.editing` lose `title`; the Title field goes; Start takes the autofocus. |
| `src/view/interactions/absences.ts` | Both acts derive the name. `absenceProblem` loses its title rule. |
| `styles/lanes.css` | `.pbl-lane-count` refuses to shrink, so the name ellipsizes into it. |
| `test/domain/absences.test.ts` | Node tests for both new functions. `civil`/`away` move to module scope. |
| `test/view/resourceLanes.test.ts` | The readout's own tests (the header is this file's subject) + two moved count assertions. |
| `test/view/resourceAbsences.test.ts` | One moved count assertion + the whole add/edit flow reshaped for three fields. |
| `test/view/contextCardWrites.test.ts` | One moved count assertion. |
| `test/helpers/fixtures.ts` | A third demo absence: one that has ENDED. |
| `test/harness/harness.test.ts` | The absence-row count in `demoVault()` goes 2 → 3. |
| `docs/requirements/Resource absences.md` | The refusal amended, 4i amended, two new extensions, acceptance criteria. |
| `docs/requirements/Showing a resources axis on the roadmap.md` | The count's new wording. |
| `docs/tests/suites/Smoke test the roadmap.md` | The live-vault rows. |
| `CHANGELOG.md` | Two `[Unreleased]` entries. |
| `vitest.config.mts` | Coverage thresholds, measured at the end. |

**Create:** nothing. Every module this touches already exists and is already specified by a
register note, so `docs-check.mjs` rule 7 needs no new note.

---

### Task 1: `pendingAbsences` — how many stretches are still to come

**Files:**
- Modify: `src/domain/absences.ts` (append after `crossedAbsences`)
- Test: `test/domain/absences.test.ts`

**Interfaces:**
- Consumes: `Absence`, `CivilDate` and `daysBetween` — all three are already imported in
  `src/domain/absences.ts`, so this task adds no import.
- Produces: `pendingAbsences(absences: Absence[], today: CivilDate): number`, read by Task 2.

- [ ] **Step 1: Move the two date helpers to module scope**

They live inside `describe('a bar scheduled across an absence')` today and the new describe
needs them. Cut these from inside that describe and paste them at module scope, directly
below the `settingsFor` helper near the top of `test/domain/absences.test.ts`:

```ts
function civil(text: string): CivilDate {
	const read = readDate(text).value;
	if (read === null) throw new Error(`not a date: ${text}`);
	return read;
}

function away(title: string, start: string, target: string): Absence {
	return { file: {} as TFile, title, resource: 'Alice', start: civil(start), target: civil(target) };
}
```

Leave `const AUGUST = away('Alice away', '2026-08-04', '2026-08-06');` where it is, inside
that describe — only the two functions move.

- [ ] **Step 2: Write the failing test**

Add this describe at the END of `test/domain/absences.test.ts`, and add `pendingAbsences`
to the existing import from `'../../src/domain/absences'`:

```ts
describe('how many stretches are still to come', () => {
	// Fixed rather than derived from the clock: this function TAKES today, which is the
	// whole reason it can be asked about a day the test chooses.
	const TODAY = civil('2026-08-14');

	it('counts one that has not ended — running or still ahead', () => {
		// One comparison, not two: a stretch whose target is today or later has either not
		// started or not finished, and there is no third case.
		expect(pendingAbsences([away('Running', '2026-08-10', '2026-08-20')], TODAY)).toBe(1);
		expect(pendingAbsences([away('Ahead', '2026-09-01', '2026-09-05')], TODAY)).toBe(1);
	});

	it('counts the day it ends, and not the day after', () => {
		// Inclusive at today, `crossedAbsences`' own boundary rule — one absence must not
		// mean two different things on one row.
		expect(pendingAbsences([away('Ends today', '2026-08-01', '2026-08-14')], TODAY)).toBe(1);
		expect(pendingAbsences([away('Ended yesterday', '2026-08-01', '2026-08-13')], TODAY)).toBe(0);
	});

	it('counts only the pending ones out of a mixed list', () => {
		const list = [
			away('Old', '2026-01-01', '2026-01-05'),
			away('Running', '2026-08-10', '2026-08-20'),
			away('Next', '2026-12-01', '2026-12-05'),
		];

		expect(pendingAbsences(list, TODAY)).toBe(2);
	});

	it('counts nothing for a resource with no stretches at all', () => {
		expect(pendingAbsences([], TODAY)).toBe(0);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/domain/absences.test.ts`
Expected: FAIL — `pendingAbsences is not a function` (or a TS error that it is not exported).

- [ ] **Step 4: Write the implementation**

Append to `src/domain/absences.ts`, after `crossedAbsences`:

```ts
/**
 * How many of these stretches have not ended — the count a band's header reports beside its
 * item count.
 *
 * **"Upcoming or currently active" is ONE comparison, not two.** A stretch whose target is
 * today or later has either not started or not finished, and there is no third case; written
 * as two conditions it invites a reader to "fix" a missing start comparison that would then
 * drop every running absence. Inclusive at today, `crossedAbsences`' own boundary rule, so
 * one absence does not mean two different things on one row.
 *
 * From DATES, never from geometry, which is that function's other rule read again: a stretch
 * outside the drawn window still counts, or the number would change as the reader scrolls.
 *
 * `today` is a parameter because nothing in this layer reads a clock — `todayCivil()` is
 * computed in the view and injected, which is what lets a test say which day today is.
 */
export function pendingAbsences(absences: Absence[], today: CivilDate): number {
	return absences.filter((absence) => daysBetween(today, absence.target) >= 0).length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/domain/absences.test.ts`
Expected: PASS, all describes including the pre-existing ones.

- [ ] **Step 6: Commit**

```bash
git add src/domain/absences.ts test/domain/absences.test.ts
git commit -m "Count the absences a resource still has ahead of them"
```

---

### Task 2: the band header's labelled readout

**Files:**
- Modify: `src/view/render/lanes.ts` (`renderLaneHead`, around line 174-199)
- Modify: `src/view/render/timeline.ts` (`drawEntries`, around line 355-375)
- Modify: `styles/lanes.css` (`.pbl-lane-count`, around line 42)
- Test: `test/view/resourceLanes.test.ts` (new tests + two moved assertions)
- Test: `test/view/resourceAbsences.test.ts` (one moved assertion, line 103)
- Test: `test/view/contextCardWrites.test.ts` (one moved assertion, line 489)

**Interfaces:**
- Consumes: `pendingAbsences(absences: Absence[], today: CivilDate): number` from Task 1.
- Produces: `.pbl-lane-count` textContent in the form `"2 items"` or
  `"2 items / 1 absence"`. `laneCountOf` in `test/helpers/roadmap.ts` returns it and needs
  no change.

- [ ] **Step 1: Write the failing tests**

In `test/view/resourceLanes.test.ts`, add two import lines. `FakeVault`, `laneCountOf` and
`lanesOf` are already imported; these two are not:

```ts
import { addDays, formatCivil } from '../../src/domain/timeline';
import { readDate, todayStamp } from '../../src/domain/noteFields';
```

**This file has its OWN `laneRoadmap`**, a near-twin of the shared helper's taking
`{ only, focus, expanded }` rather than a config object — so `laneRoadmap(vault)` in the
tests below resolves to the local one and needs no import.

Add at module scope, below the existing imports:

```ts
/**
 * `todayCivil()` reads the live clock and no test fakes it, so a fixture that has to be
 * "before today" or "after today" is built from the same clock — the pattern
 * `test/view/timelineLeadGeometry.test.ts` uses for the today line.
 */
const TODAY = readDate(todayStamp()).value ?? { year: 2026, month: 1, day: 1 };
const dayFromToday = (offset: number): string => formatCivil(addDays(TODAY, offset));

/** One resource with one bar, plus whichever stretches a test wants to count. */
function countingVault(stretches: Array<{ title: string; start: string; target: string }>): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	for (const one of stretches) {
		vault.addFile(`${one.title}.md`, {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: one.start, due: one.target },
		});
	}
	return vault;
}
```

Then add this describe at the END of the file:

```ts
describe('the band header’s readout', () => {
	it('names the pending absences beside the items, and only the pending ones', () => {
		// The filter on today is the whole reason this readout exists: the rows below draw
		// every stretch a resource ever had, so a finished one is exactly what the reader
		// does not want counted.
		const vault = countingVault([
			{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) },
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) },
		]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item / 1 absence');
	});

	it('pluralizes each half on its own count', () => {
		const vault = countingVault([
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) },
			{ title: 'Later', start: dayFromToday(20), target: dayFromToday(24) },
		]);
		vault.addFile('More work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-02', due: '2026-08-04' },
		});
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('2 items / 2 absences');
	});

	it('drops the absence half entirely with nothing pending', () => {
		// `0 absences` reports nothing the reader needed and would sit on nearly every band.
		const vault = countingVault([{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) }]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item');
	});

	it('keeps the readout on a COLLAPSED band, where no stretch is drawn at all', () => {
		// The one case the header is the only surface for, and the reason this ships at all:
		// `laneEntries` skips the whole band, so a folded roster shows no hatch anywhere.
		// Deliberately the opposite of the legend's rule, which keys what the pass PAINTED.
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		const harness = laneRoadmap(vault);

		harness.view.setLaneCollapsed('Alice', true);

		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item / 1 absence');
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/view/resourceLanes.test.ts`
Expected: FAIL — four failures reading `expected '1' to be '1 item / 1 absence'` and
similar. The pre-existing `counts result bars on the header` test still passes at this
point.

- [ ] **Step 3: Draw the label**

In `src/view/render/lanes.ts`, add `pendingAbsences` to the existing import from
`'../../domain/absences'` and `CivilDate` to the existing import from
`'../../domain/timeline'`.

Change `renderLaneHead`'s signature to take `today` last (5 parameters, exactly at the
`max-params` limit):

```ts
export function renderLaneHead(
	ctx: RowContext,
	content: HTMLElement,
	lane: ResourceLane,
	collapsed: boolean,
	today: CivilDate,
): HTMLElement {
```

Replace the `lead.createSpan({ cls: 'pbl-lane-count', ... })` line **and the comment block
above it** with:

```ts
	lead.createSpan({ cls: 'pbl-lane-count', text: laneReadout(lane, today) });
```

Add this function directly below `renderLaneHead`:

```ts
/**
 * What a band's header reports: its result bars, and the absences that have not ended.
 *
 * **The item half is RESULT bars and stays so**, the rule a bucket's count already keeps —
 * a context row placed here is placement, not population, and an absence is furniture of
 * the row. Only its spelling changed on 2026-08-14; a band whose only content is an absence
 * still reads `0 items`.
 *
 * **The absence half is a glyph's refusal answered in words.** One was built on 2026-08-14
 * and removed the same day, for two reasons that still hold: the stretch's own hatched row
 * sits directly beneath the header, and a fourth `user-x` in this lead competed with the
 * Add absence button that reveals on hover in the same place. The glyph stays refused. What
 * words buy that the mark could not is the two things the rows below cannot say — a
 * FILTER on today, since the band draws every stretch a resource ever had, and a count that
 * survives folding, since `laneEntries` skips a collapsed band's absences entirely.
 *
 * It is dropped at zero rather than reading `0 absences`, which would sit on nearly every
 * band reporting nothing anyone asked for.
 *
 * Plurals inline, this codebase's own idiom at eleven other call sites rather than a shared
 * helper for two words.
 */
function laneReadout(lane: ResourceLane, today: CivilDate): string {
	const items = `${lane.bars.length} item${lane.bars.length === 1 ? '' : 's'}`;
	const away = pendingAbsences(lane.absences, today);
	if (away === 0) return items;
	return `${items} / ${away} absence${away === 1 ? '' : 's'}`;
}
```

- [ ] **Step 4: Pass `today` through the entry walk**

In `src/view/render/timeline.ts`, inside `drawEntries`, change the destructure and the
header call:

```ts
	const { scale, laneElement, today } = pass.drawing;
```

```ts
			inBand(renderLaneHead(ctx, mounts.content, entry.lane, entry.collapsed, today), false);
```

`TimelineDrawing` already carries `today`, so nothing else changes.

- [ ] **Step 5: Let the name truncate into the label**

In `styles/lanes.css`, replace the `.pbl-lane-count` rule with:

```css
/* The label is much wider than the bare number it replaced, in a lead column the user can
   resize (`renderLeadResize`). Refusing to shrink is the whole of "the name truncates
   first": `.pbl-lane-name` above already ellipsizes and shrinks at the flex default, so no
   breakpoint and no measurement is needed — and a third fit mechanism beside `columnFit`
   and `syncToolbarFit` was refused for exactly that reason. */
.pbl-lane-count {
	flex: 0 0 auto;
	white-space: nowrap;
	color: var(--text-muted);
	font-weight: var(--font-normal);
}
```

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `npx vitest run test/view/resourceLanes.test.ts`
Expected: the four new tests PASS. `counts result bars on the header` now FAILS with
`expected '2 items' to be '2'` — that is the next step.

- [ ] **Step 7: Move the four existing count assertions to the label**

`test/view/resourceLanes.test.ts`, in `counts result bars on the header`:

```ts
		expect(laneCountOf(alice)).toBe('2 items');
		expect(laneCountOf(bob)).toBe('0 items');
```

`test/view/resourceLanes.test.ts`, in `is never counted, and never shelved`:

```ts
		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('0 items');
```

`test/view/contextCardWrites.test.ts`, in the block asserting the context row's membership:

```ts
		expect(laneCountOf(sam)).toBe('1 item');
```

`test/view/resourceAbsences.test.ts`, in `counts for nothing on the header, and takes no
stripe` — and it needs a sentence, or `'1 item'` reads as though the absence half does not
exist:

```ts
		// Result bars only, the rule a context row already keeps. No absence half here
		// because `absenceVault`'s stretch ENDED (2026-08-06) and only pending ones are
		// counted — the readout's own cases are driven in `resourceLanes.test.ts`.
		expect(laneCountOf(lanesOf(containerEl)[0])).toBe('1 item');
```

- [ ] **Step 8: Run the three suites to verify they pass**

Run: `npx vitest run test/view/resourceLanes.test.ts test/view/resourceAbsences.test.ts test/view/contextCardWrites.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/view/render/lanes.ts src/view/render/timeline.ts styles/lanes.css test/view/resourceLanes.test.ts test/view/resourceAbsences.test.ts test/view/contextCardWrites.test.ts
git commit -m "Report a band's items and its pending absences in words"
```

---

### Task 3: `absenceTitle`, and `AbsenceFacts` moving down a layer

**Files:**
- Modify: `src/domain/absences.ts` (add `AbsenceFacts` and `absenceTitle`)
- Modify: `src/storage/absenceNotes.ts` (import `AbsenceFacts` instead of declaring it)
- Test: `test/domain/absences.test.ts`

**Interfaces:**
- Produces: `AbsenceFacts { resource: string; start: string; target: string }` and
  `absenceTitle(facts: AbsenceFacts): string`, both read by Task 4.
- `AbsenceSpec extends AbsenceFacts` in `src/storage/absenceNotes.ts` keeps its `folder`
  and `title` fields. **`createAbsenceNote`, `updateAbsenceNote`, `renameAbsenceNote` and
  `deleteAbsenceNote` are not changed by this task or any later one.**

- [ ] **Step 1: Write the failing test**

Add `absenceTitle` to the existing import from `'../../src/domain/absences'` in
`test/domain/absences.test.ts`, and add this describe at the end:

```ts
describe('what an absence note is called', () => {
	it('names the resource and both ends, so two never collide', () => {
		// Both dates, so `uniqueNotePath` never has to append a number: `Alice away 1` and
		// `Alice away 2` are two names that say nothing apart, and a filename is read in the
		// explorer, in search and in a link, where no row is there to supply the dates.
		expect(absenceTitle({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' })).toBe(
			'Alice away 2026-08-04 → 2026-08-06',
		);
	});

	it('is the one producer, so both acts derive the same name from the same facts', () => {
		// Stated as the property rather than trusted: the create path and the edit path each
		// call this, which is what stops them disagreeing about what an absence is called.
		const facts = { resource: 'Bob', start: '2026-09-01', target: '2026-09-04' };

		expect(absenceTitle(facts)).toBe(absenceTitle({ ...facts }));
		expect(absenceTitle(facts)).toBe('Bob away 2026-09-01 → 2026-09-04');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/absences.test.ts`
Expected: FAIL — `absenceTitle is not a function`.

- [ ] **Step 3: Move `AbsenceFacts` and add the derivation**

Cut this interface out of `src/storage/absenceNotes.ts` (it is directly above
`AbsenceSpec`) and paste it into `src/domain/absences.ts`, below the `Absence` interface,
with its comment rewritten for its new home:

```ts
/**
 * What an absence SAYS — the three facts that reach its frontmatter, as strings, straight
 * from the form that produced them and already validated.
 *
 * Here rather than in `storage/`, where it was declared until 2026-08-14: it is what an
 * absence IS, this layer is where that is defined, and `absenceTitle` below consumes it —
 * a type belongs with the code that produces it, and `domain/` may not import `storage/`
 * to reach one. `AbsenceSpec` in `src/storage/absenceNotes.ts` still extends it with the
 * two facts that decide where the note IS rather than what it says.
 *
 * Distinct from `Absence` and deliberately so: that one holds parsed `CivilDate`s and a
 * `TFile`, and is what reading a note back produces.
 */
export interface AbsenceFacts {
	resource: string;
	/** Both ends as `YYYY-MM-DD` — this is a request to write, not a reading. */
	start: string;
	target: string;
}
```

Append `absenceTitle` at the end of `src/domain/absences.ts`:

```ts
/**
 * What an absence note is CALLED, derived from the facts it holds — so recording one asks
 * for the dates and nothing else.
 *
 * The one producer, which is the point rather than tidiness: creating an absence and editing
 * one already share a single form, a single validator and a single set of refusals, and a
 * name computed separately in each act is exactly how the two would come to disagree about
 * what an absence is.
 *
 * Both dates are in it so two absences never collide and `uniqueNotePath` never appends a
 * number — `Alice away 1` beside `Alice away 2` is two names that say nothing apart, and a
 * basename is read in the explorer, in search and in a link, none of which has a row beside
 * it to supply the dates. Every character here survives `sanitizeTitle`, which replaces
 * `\/:*?"<>|#^[]` and leaves the arrow and the hyphens alone.
 *
 * **A hand rename does not survive the next edit**, and that is the accepted cost of the
 * name being a function of the facts rather than a defect: rename the note in Obsidian, edit
 * a date, and it takes the derived name back. The alternative — comparing against the name
 * this would have produced for the OLD facts — is a second rule whose failure mode is a note
 * that silently stops following its own dates.
 */
export function absenceTitle(facts: AbsenceFacts): string {
	return `${facts.resource} away ${facts.start} → ${facts.target}`;
}
```

In `src/storage/absenceNotes.ts`, import the moved type — add it to the existing
`domain/` imports:

```ts
import { AbsenceFacts } from '../domain/absences';
```

`AbsenceSpec extends AbsenceFacts` and `updateAbsenceNote`'s `spec: AbsenceFacts` both keep
working unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/domain/absences.test.ts test/storage`
Expected: PASS.

- [ ] **Step 5: Verify the layer rule and dead-code gate still hold**

Run: `npm run lint && npm run analyze`
Expected: both clean. `storage/` importing `domain/` is the legal direction (it already
imports `domain/settings.ts` and `domain/typeVocabulary.ts`), and `AbsenceFacts` has a
consumer in each layer so fallow reports it live.

- [ ] **Step 6: Commit**

```bash
git add src/domain/absences.ts src/storage/absenceNotes.ts test/domain/absences.test.ts
git commit -m "Derive an absence note's name from the facts it holds"
```

---

### Task 4: the form asks for the dates alone

This is the largest task and it cannot be split without leaving the suite red: removing the
Title field breaks every add and edit test at once. Write the tests to the new contract
first, watch them fail, then change the three source files.

**Files:**
- Modify: `src/ui/prompts.ts` (`AbsenceResult`, `AbsencePromptOptions`, `AbsencePromptModal`)
- Modify: `src/view/interactions/absences.ts` (`absenceProblem`, `promptEditAbsence`,
  `writeAbsence`, `editAbsence`)
- Test: `test/view/resourceAbsences.test.ts`

**Interfaces:**
- Consumes: `absenceTitle(facts: AbsenceFacts): string` from Task 3.
- Produces: `AbsenceResult { resource: string; start: string; target: string }` — three
  fields, in that DOM order, which is what the test helper's positional fill depends on.

- [ ] **Step 1: Reshape the test helper to three fields**

In `test/view/resourceAbsences.test.ts`, replace `submitAbsence` (and its doc comment):

```ts
/**
 * Fill the open absence prompt and submit it — `submitPrompt`'s shape over this form's own
 * three fields, in DOM order. Returns whether the prompt CLOSED: a refusal keeps it open
 * with the values in place, which is the whole of what 2a and 2b promise, so a test
 * asserting the refusal has to be able to see it rather than only the absence of a write.
 *
 * There is no title among them: the note's name is derived from these three facts
 * (`absenceTitle`), so a caller that could pass one would be describing a form that does
 * not exist.
 */
function submitAbsence(fields: { resource?: string; start: string; target: string }): boolean {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	const values = [fields.resource, fields.start, fields.target];
	inputs.forEach((input, i) => {
		if (values[i] === undefined) return;
		input.value = values[i] as string;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return modal.contentEl.childElementCount === 0;
}
```

- [ ] **Step 2: Drop `title:` from every call and move the paths to derived names**

Every `submitAbsence({ ... })` call in the file loses its `title:` entry. Nine of them also
assert a path that is now derived. Apply each of these edits:

In `writes one note with exactly four facts, and no hierarchy at all`:

```ts
		addButton(containerEl, 'Bob')?.click();
		expect(submitAbsence({ start: '2026-09-01', target: '2026-09-04' })).toBe(true);
		await flush();

		// The name is derived from the three facts, so the path is a check on the derivation
		// as well as on the folder — and on every character of it surviving `sanitizeTitle`.
		const fm = vault.fm('docs/absences/Bob away 2026-09-01 → 2026-09-04.md');
```

In `takes the resource typed into the prompt, which the row only prefills`:

```ts
		submitAbsence({ resource: 'Quinn', start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('docs/Quinn away 2026-09-01 → 2026-09-04.md')['assignee']).toBe('Quinn');
```

In `files it where the config says at SUBMIT, not where it said when the form opened`:

```ts
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.files.has('docs/away/Bob away 2026-09-01 → 2026-09-04.md')).toBe(true);
		expect(vault.files.has('docs/absences/Bob away 2026-09-01 → 2026-09-04.md')).toBe(false);
```

In `files it in the home folder when it has no folder of its own`:

```ts
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('notes/Bob away 2026-09-01 → 2026-09-04.md')['type']).toBe('Absence');
```

In `files it in the vault root when no folder is configured at all`:

```ts
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
		await flush();

		expect(vault.fm('Bob away 2026-09-01 → 2026-09-04.md')['type']).toBe('Absence');
```

In `is blocked by the config gate, exactly as every other write` — no `submitAbsence` call,
no change.

In `writes nothing for a blank field or a reversed range`, remove the title case entirely
(there is no field left to blank) and keep the other three:

```ts
		addButton(containerEl, 'Alice')?.click();
		// 2b: caught at the prompt, which stays open — there is no shelf for a written
		// absence to land on, so there would be no surface to show the mistake afterwards.
		expect(submitAbsence({ start: '2026-09-04', target: '2026-09-01' })).toBe(false);
		// 2a: a range needs both ends stated.
		expect(submitAbsence({ start: '2026-09-04', target: '' })).toBe(false);
		// And a resource: a stretch nobody is away for has no row to draw in, and it is now
		// also half of what names the note.
		expect(submitAbsence({ resource: '', start: '2026-09-04', target: '2026-09-05' })).toBe(false);
		await flush();
```

In `reports a write it could not make, rather than failing silently`:

```ts
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
```

In `re-asks the gate at submit, so a config narrowed under the open form writes nothing`:

```ts
		submitAbsence({ start: '2026-09-01', target: '2026-09-04' });
```

- [ ] **Step 3: Reshape the edit block, where the rename rule changed**

In `test/view/resourceAbsences.test.ts`'s `describe('editing a placed absence')`, replace
each of these tests with the version below. `absenceVault()`'s note is `Alice away.md` with
`2026-08-04 → 2026-08-06` for `Alice`, so its derived name is
`Alice away 2026-08-04 → 2026-08-06`.

```ts
	it('opens the SAME form the add flow does, filled with what the stretch says', () => {
		// One form for both acts, so they cannot come to disagree about what an absence is —
		// same fields, same validator, same refusals. Three fields now: the note's name is
		// derived from them rather than typed beside them.
		const { containerEl } = laneRoadmap(absenceVault());

		openEdit(containerEl);

		const inputs = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []);
		expect(inputs.map((i) => i.value)).toEqual(['Alice', '2026-08-04', '2026-08-06']);
	});

	it('rewrites the days it covers and who it is for, and takes the derived name with it', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		expect(submitAbsence({ resource: 'Bob', start: '2026-08-05', target: '2026-08-09' })).toBe(true);
		await flush();

		// The same note, edited and renamed — never a second one written beside the first.
		const fm = vault.fm('Bob away 2026-08-05 → 2026-08-09.md');
		expect(fm['assignee']).toBe('Bob');
		expect(fm['start']).toBe('2026-08-05');
		expect(fm['due']).toBe('2026-08-09');
		expect(vault.files.has('Alice away.md')).toBe(false);
	});

	it('renames the note when the FACTS change, since the facts are what name it', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Alice away 2026-08-05 → 2026-08-09.md')).toBe(true);
		expect(vault.files.has('Alice away.md')).toBe(false);
		// Through Obsidian's own rename, so the frontmatter travels with the note.
		expect(vault.fm('Alice away 2026-08-05 → 2026-08-09.md')['assignee']).toBe('Alice');
	});

	it('names the note the rename actually produced, not the name that was asked for', async () => {
		// `uniqueNotePath` appends a number where the name is taken, so the note the reader is
		// told to look for has to be the one that exists. Rare now that both dates are in the
		// name — which is why the collision is planted rather than waited for.
		const vault = absenceVault();
		vault.addFile('Alice away 2026-08-04 → 2026-08-06.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.has('Alice away 2026-08-04 → 2026-08-06 1.md')).toBe(true);
		expect(Notice.messages).toContain('Updated "Alice away 2026-08-04 → 2026-08-06 1".');
	});

	it('leaves a name that only differs by a character the disk cannot take', async () => {
		// The derived name can still hold one, through the resource: `A/B` sanitizes to `A-B`.
		// Compared raw it reads as a new name, and `uniqueNotePath` then finds the note's own
		// path occupied — renaming it for a character the disk was always going to drop.
		const vault = new FakeVault();
		vault.addFile('A-B away 2026-08-04 → 2026-08-06.md', {
			frontmatter: { type: 'Absence', assignee: 'A/B', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'A/B', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.has('A-B away 2026-08-04 → 2026-08-06.md')).toBe(true);
		expect(vault.files.has('A-B away 2026-08-04 → 2026-08-06 1.md')).toBe(false);
	});

	it('leaves the note where it is when the facts have not changed', async () => {
		// A rename to the name a note already has is a needless write, and one Obsidian would
		// answer by appending a number. The fixture is already at its derived name, which is
		// what a note created by this flow looks like.
		const vault = new FakeVault();
		vault.addFile('Alice away 2026-08-04 → 2026-08-06.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-04', target: '2026-08-06' });
		await flush();

		expect(vault.files.size).toBe(1);
		expect(vault.files.has('Alice away 2026-08-04 → 2026-08-06.md')).toBe(true);
	});

	it('refuses a broken range at the form, exactly as adding one does', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);

		openEdit(containerEl);
		// The prompt stays open with the values in place: a written absence has no shelf to
		// land on, so there would be no surface left to show the mistake on.
		expect(submitAbsence({ start: '2026-08-09', target: '2026-08-04' })).toBe(false);
		await flush();

		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
	});

	it('reports a save it could not make, rather than failing silently', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add('Alice away.md');

		openEdit(containerEl);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not save the absence'))).toBe(true);
	});

	it('writes the frontmatter BEFORE the rename, so a refused write leaves the name alone', async () => {
		const vault = absenceVault();
		const { containerEl } = laneRoadmap(vault);
		vault.failWrites.add('Alice away.md');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		// Both halves follow from one edit now — new dates mean new frontmatter AND a new
		// name — and the first one is refused. Renaming first would move the note and every
		// link naming it, and then fail, leaving a note whose name describes a stretch it does
		// not hold. This way the worst outcome is the one the reader can see and fix.
		openEdit(containerEl);
		submitAbsence({ resource: 'Bob', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.files.has('Bob away 2026-08-05 → 2026-08-09.md')).toBe(false);
		expect(vault.files.has('Alice away.md')).toBe(true);
		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
	});

	it('re-asks the gate at submit, exactly as the add flow does', async () => {
		// The edit form outlives the config it opened under for the same reason the add form
		// does — Obsidian's options pane stays reachable while a modal is up — and the write
		// after a narrowing would reach `setOwn(fm, '', ...)`, a key nobody configured.
		const vault = absenceVault();
		const harness = laneRoadmap(vault);

		openEdit(harness.containerEl);
		harness.config.values['targetProperty'] = undefined;
		refresh(harness.view, vault);
		submitAbsence({ resource: 'Alice', start: '2026-08-05', target: '2026-08-09' });
		await flush();

		expect(vault.fm('Alice away.md')['start']).toBe('2026-08-04');
		expect(Notice.messages.some((m) => m.startsWith('Name the assignee and both date properties'))).toBe(true);
	});
```

Leave `is blocked by the config gate before it takes any typing` exactly as it is — it
opens no form.

- [ ] **Step 4: Run the suite to verify it fails**

Run: `npx vitest run test/view/resourceAbsences.test.ts`
Expected: FAIL — the derived paths do not exist because the form still asks for a title,
and `inputs.map((i) => i.value)` still returns four values.

- [ ] **Step 5: Take the Title field out of the prompt**

In `src/ui/prompts.ts`:

```ts
export interface AbsenceResult {
	resource: string;
	start: string;
	target: string;
}
```

```ts
	/**
	 * The stretch being EDITED, pre-filling the two date fields. Absent when adding one,
	 * which is what makes this one form for both acts rather than two that can disagree
	 * about what an absence is — the validator, the field list and the refusal rules are the
	 * same questions whether the note exists yet or not.
	 *
	 * No title among them since 2026-08-14: the note's name is derived from the three facts
	 * (`absenceTitle`), so there is nothing here to pre-fill it with.
	 */
	editing?: { start: string; target: string };
```

In `AbsencePromptModal.onOpen`, drop `title` from `values`:

```ts
		const values: AbsenceResult = {
			resource: this.options.resource,
			start: editing?.start ?? '',
			target: editing?.target ?? '',
		};
```

and from the `refusableBody` reader:

```ts
		const { errorEl, submit } = refusableBody(this, this.options, () => ({
			resource: values.resource.trim(),
			start: values.start.trim(),
			target: values.target.trim(),
		}));
```

Delete the Title `field(...)` line and move the autofocus to Start:

```ts
		field('Resource', 'resource', (input) => new KnownValueSuggest(this.app, input, this.options.known));
		// Autofocused rather than the resource, which the row this was opened on already
		// answered — and there is no title field to claim it since the name became a
		// function of these three facts.
		field('Start', 'start', (input) => (input.type = 'date'));
		field('End', 'target', (input) => (input.type = 'date'));
```

`submitOnEnter`'s third argument is the autofocus flag, so the `field` helper's last line
becomes:

```ts
			submitOnEnter(text.inputEl, submit, key === 'start');
```

- [ ] **Step 6: Derive the name in both acts**

In `src/view/interactions/absences.ts`, add `absenceTitle` to the existing import from
`'../../domain/absences'`.

`absenceProblem` loses its title rule:

```ts
function absenceProblem(result: AbsenceResult): string | null {
	if (!result.resource) return 'Name the resource this absence is for.';
	if (!result.start || !result.target) return 'An absence needs both a start and an end date.';
	if (result.target < result.start) return 'The end date is before the start date.';
	return null;
}
```

`promptEditAbsence` pre-fills two fields, and its description no longer promises a title:

```ts
		description: 'Changes who is away and for how long. The note is renamed to match.',
		resource: absence.resource,
		editing: { start: formatCivil(absence.start), target: formatCivil(absence.target) },
```

`writeAbsence` derives the name:

```ts
async function writeAbsence(host: BacklogViewHost, result: AbsenceResult): Promise<void> {
	if (refusedByConfig(host)) return;
	try {
		const spec = { folder: absenceFolder(host), title: absenceTitle(result), ...result };
		const file = await createAbsenceNote(host.app, host.settings, spec);
		new Notice(`Marked ${result.resource} away — "${file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to create the absence', e);
		new Notice('Could not create the absence. See the developer console for details.');
	}
}
```

`editAbsence` renames to the name the NEW facts derive, and needs no guard for an edit that
renames nothing — `renameAbsenceNote` already returns early when the sanitized name equals
the basename:

```ts
		await renameAbsenceNote(host.app, absence.file, absenceTitle(result));
```

Update `editAbsence`'s doc comment: the order is still frontmatter-then-rename for the same
reason, and both halves now follow from one edit rather than from two fields.

- [ ] **Step 7: Run the suite to verify it passes**

Run: `npx vitest run test/view/resourceAbsences.test.ts`
Expected: PASS, every describe.

- [ ] **Step 8: Run the whole suite, and lint**

Run: `npx vitest run && npm run lint`
Expected: PASS. `test/view/resourceAbsences.test.ts` must still be under the 450-line
budget — it loses the title field's cases and gains no net length, but check the lint output
rather than assuming.

- [ ] **Step 9: Commit**

```bash
git add src/ui/prompts.ts src/view/interactions/absences.ts test/view/resourceAbsences.test.ts
git commit -m "Ask an absence for its dates and derive its name"
```

---

### Task 5: the demo fixture gains an absence that has ENDED

**Files:**
- Modify: `test/helpers/fixtures.ts` (the absence block, around line 218-221)
- Test: `test/harness/harness.test.ts` (the absence-row count, around line 101)

**Interfaces:** none — this task adds a fixture note and adjusts the count that pins it.

- [ ] **Step 1: Write the failing assertion**

In `test/harness/harness.test.ts`, in `draws the resources axis, with an empty declared row
and a row an absence minted`:

```ts
		// Three stretches: one running, one ahead for the row it mints, and one that has
		// ENDED — the case the band header's readout must count as nothing.
		expect(containerEl.querySelectorAll('.pbl-absence-row')).toHaveLength(3);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/harness/harness.test.ts`
Expected: FAIL — `expected 2 to be 3`.

- [ ] **Step 3: Add the third stretch**

In `test/helpers/fixtures.ts`, extend the comment above the two `add(...)` calls and add a
third line beneath them:

```ts
	// Three unavailable stretches, which are the resources axis's second SOURCE and are not
	// work items at all — no parent, no rank, no state. One in a row that already has bars,
	// so a stretch reads against the work it crosses; one for a resource nobody is assigned
	// to and no roster names, which MINTS a row of its own, the case where an absence is the
	// only reason a row is on screen at all — also the case whose window the grid used to
	// size without it. And one that has ENDED, the case the band header's readout must count
	// as nothing: a fixed past date rather than a today-relative one, so it stays past as
	// the clock moves.
	add('Dana is at the offsite', { type: 'Absence', assignee: 'Dana', start: '2026-08-10', due: '2026-08-14' });
	add('Sam is on leave', { type: 'Absence', assignee: 'Sam', start: '2026-09-01', due: '2026-09-18' });
	add('Dana was at a conference', { type: 'Absence', assignee: 'Dana', start: '2026-07-06', due: '2026-07-10' });
```

Do NOT assert a pending COUNT in `harness.test.ts`: `Dana is at the offsite` ends on
2026-08-14, so its pendingness changes with the clock. What is asserted is that the rows
draw, which does not.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/harness/harness.test.ts`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run: `npm run harness`
Open the printed `file://` URL with `?view=roadmap`, pick the resources axis, and check
four things by eye:

1. Dana's header reads `N items / 1 absence` — her ended conference is not counted, her
   offsite is (while today is on or before 2026-08-14).
2. Sam's header reads `0 items / 1 absence` — the minted row, where the item count is zero
   and the absence half is the only thing saying why the row exists.
3. Drag the lead-column grip narrow: the resource NAME ellipsizes and the label stays whole.
4. An absence row's own lead now reads a long derived name for any absence created here.

Then run `?theme=light` and repeat 1-3. Record anything that reads badly — the label's
wording and `absenceTitle` are both one function each, so a change is cheap at this point
and expensive after the register is written.

- [ ] **Step 6: Commit**

```bash
git add test/helpers/fixtures.ts test/harness/harness.test.ts
git commit -m "Give the demo backlog an absence that has already ended"
```

---

### Task 6: the register, the changelog, and the full gate

**Files:**
- Modify: `docs/requirements/Resource absences.md`
- Modify: `docs/requirements/Showing a resources axis on the roadmap.md`
- Modify: `docs/tests/suites/Smoke test the roadmap.md`
- Modify: `CHANGELOG.md`
- Modify: `vitest.config.mts`

**Interfaces:** none. This task records decisions and closes the gate.

- [ ] **Step 1: Amend the refusal on `docs/requirements/Resource absences.md`**

Find the paragraph beginning **The band header carries NO glyph saying the band holds an
absence, and that is a refusal rather than an omission.** Keep every sentence of it — the
glyph is still refused, for both of its reasons — and append:

```markdown
**What the header DOES carry, since 2026-08-14, is a labelled readout** — `2 items / 1
absence`, `laneReadout` in `src/view/render/lanes.ts` over `pendingAbsences` in
`src/domain/absences.ts`. That is not the refusal reversed: words are not the fourth
`user-x`, so the reason above about the Add absence button is untouched, and the item half
is still RESULT bars, so a band whose only content is an absence still reads `0 items`.
What words buy that the mark could not is the two things the row below cannot say. The
count is FILTERED on today — the band draws every stretch a resource ever had, so a
finished one is exactly what must not be counted, and the reader would otherwise compare
each hatch to the today line one at a time. And it survives FOLDING, where `laneEntries`
skips the whole band and the header is the only surface left. The absence half is dropped
at zero rather than reading `0 absences`. Deliberately the opposite of the legend's rule,
which keys what the pass PAINTED and so must not key a collapsed band's swatch: the
readout is a fact about the band, and the header is drawn either way.
```

- [ ] **Step 2: Amend extension 4i, and add two extensions**

In `## Use case` → **Extensions**, replace 4i's title sentence and its title clause:

```markdown
- **4i — editing one already placed** (added 2026-08-14). Beside the delete on that same
  menu, opening the SAME form Add absence opens, pre-filled: one field list, one validator,
  one set of refusals, so the two acts cannot come to disagree about what an absence is.
  Changing the resource or either date rewrites the frontmatter in place and renames the
  note to match — because the note's name is derived from exactly those three facts (4l),
  so an edit to any of them IS a rename. Through Obsidian's own rename, so any link naming
  it follows. Outside the gate for 4c's reason, and so outside the undo: what takes an edit
  back is the file history every other note has.
```

Add after 4k:

```markdown
- **4l — the title is derived, not asked for** (added 2026-08-14). The form asks for the
  resource, a start and an end, and the note is named `<resource> away <start> → <end>`
  (`absenceTitle` in `src/domain/absences.ts`, the one producer, so the create path and the
  edit path cannot disagree). Both dates are in it so two absences never collide and
  `uniqueNotePath` never appends a number — a basename is read in the explorer, in search
  and in a link, none of which has a row beside it to supply the dates. **A hand rename does
  not survive the next edit**: rename the note in Obsidian, change a date, and it takes the
  derived name back. Accepted rather than engineered around — the alternative is comparing
  against the name the OLD facts would have produced, a second rule whose failure mode is a
  note that silently stops following its own dates. Nothing is retroactive: an absence that
  already exists keeps its name until it is edited, and `readAbsence` never required a
  derived one.
- **4m — the band header counts the stretches still to come** (added 2026-08-14). Its
  readout is `2 items / 1 absence`, the absence half counting only those whose end is today
  or later, and dropped entirely at zero. See the refusal paragraph under
  `## Where it lives` for why this is not the removed glyph returning.
```

- [ ] **Step 3: Amend the acceptance criteria**

Replace the criterion beginning `Submitting the prompt with a resource, a title and both
dates writes one new note...`:

```markdown
- Submitting the prompt with a resource and both dates writes one new note carrying exactly
  those facts — no parent, no order, and its own declared type (`Absence`) rather than one
  from the ladder — named `<resource> away <start> → <end>`, derived rather than typed.
```

Replace the criterion beginning `A blank resource, start or end writes nothing...`:

```markdown
- A blank resource, start or end writes nothing; an end before the start writes nothing
  either, caught at the prompt rather than left to a render with nowhere to show it. There is
  no title to leave blank — the form has three fields.
```

Add:

```markdown
- A band header reports its result bars and, when there is one, the absences whose end is
  today or later — a collapsed band included, since it is then the only surface saying so.
  A finished stretch is counted by nothing.
```

- [ ] **Step 4: Note the count's wording on the axis PBI**

In `docs/requirements/Showing a resources axis on the roadmap.md`, in `## Where it lives`,
beside the sentence about the row header, add:

```markdown
**The header's count became a labelled readout on 2026-08-14** — `2 items / 1 absence`,
`laneReadout` in `src/view/render/lanes.ts`. The item half is unchanged in meaning and is
still result bars; what is new is the words and the second half, whose reasons belong to
[[Resource absences]] and are recorded there. `.pbl-lane-count` refuses to shrink
(`styles/lanes.css`), so the resource NAME ellipsizes into the label at a narrow lead
width rather than the label being measured and shortened — a third fit mechanism beside
`columnFit` and `syncToolbarFit` was refused.
```

- [ ] **Step 5: Add the live-vault rows**

In `docs/tests/suites/Smoke test the roadmap.md`, add rows in the file's existing shape for:

- the readout at the default lead width on a real roster — does the label crowd the
  resource name, and where does the ellipsis fall;
- the long derived name in an absence row's own lead, beside the dates the bar already
  states;
- whether a screen reader reads the readout usefully, given the header claims no role of
  its own and labels its rows by proximity alone.

- [ ] **Step 6: Write the changelog entries**

Under `## [Unreleased]` in `CHANGELOG.md`:

```markdown
### Added

- **A resource band's header says how many absences are still to come** — `2 items / 1
  absence`, counting only the stretches that are running or ahead, so a finished one no
  longer has to be told apart from the today line by eye. It stays on a folded band, which
  is where nothing else on screen says it.

### Changed

- **Recording an absence asks for the dates alone.** The note is named
  `<resource> away <start> → <end>` from the facts you enter, so there is no title to think
  of — and editing a date renames the note to match. An absence that already exists keeps
  its name until you edit it; a name you set by hand in Obsidian is replaced the next time
  you edit the stretch.
```

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: all five steps pass — build, lint, tests, fallow, docs register.

- [ ] **Step 8: Raise the coverage thresholds to what this increment measures**

`npm run check` prints the coverage table. Copy the four measured figures into
`vitest.config.mts`'s `thresholds` block, and add a line to the comment above them naming
this increment and the totals, in the shape the existing lines use. **Only ever upward** —
if a figure came out lower than the current threshold, that is uncovered new code to test,
not a threshold to lower.

- [ ] **Step 9: Re-run the gate and commit**

```bash
npm run check
git add docs/requirements/ docs/tests/ CHANGELOG.md vitest.config.mts
git commit -m "Record the band readout and the derived absence name"
```

Note: stage those paths explicitly. Another session shares this checkout, so a broad
`git add docs/` can pick up work that is not this increment's.

---

## Self-review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §1 The count | Task 1 |
| §2 The label | Task 2, steps 3-4 |
| §3 The style | Task 2, step 5 |
| §4 The collapsed band / legend's opposite rule | Task 2, step 1 (fourth test) + Task 6, step 1 |
| §5 The derived name + `AbsenceFacts` move | Task 3 |
| §6 The form | Task 4, step 5 |
| §7 The two acts | Task 4, step 6 |
| §8 Three consequences | Task 3 (doc comment) + Task 6, steps 2-3 |
| §9 The fixture | Task 5 |
| The checks — node | Tasks 1 and 3 |
| The checks — view | Task 2, step 1; Task 4, steps 1-3 |
| The checks — moved assertions | Task 2, step 7 |
| The register | Task 6, steps 1-5 |
| CHANGELOG | Task 6, step 6 |
| Coverage thresholds | Task 6, step 8 |
| What a live vault still owes | Task 5, step 5 (harness) + Task 6, step 5 (suite rows) |

**Type consistency:** `pendingAbsences(absences: Absence[], today: CivilDate): number` is
defined in Task 1 and called in Task 2's `laneReadout`. `absenceTitle(facts: AbsenceFacts):
string` is defined in Task 3 and called twice in Task 4. `AbsenceResult` is narrowed to
three fields in Task 4 step 5 and `absenceTitle(result)` in step 6 relies on that shape
being `AbsenceFacts`-compatible — it is, field for field. `renderLaneHead`'s fifth parameter
is added in Task 2 step 3 and supplied in step 4. `laneReadout` is the name used in the code,
the register and the changelog alike.

**One ordering constraint:** Task 4 depends on Task 3 (`absenceTitle` must exist). Task 2
depends on Task 1. Tasks 5 and 6 come last. Task 2 and Task 3 are independent of each other.
