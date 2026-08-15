# One row per resource — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the roadmap's resources axis, make a band one row per person whatever they
have — stretches drawn in the lane header's own track, overlapping ones packed into
sub-lanes, and the cost of scheduling across an absence shown as a number.

**Architecture:** Two pure span primitives in `src/domain/timeline.ts` (`mergeSpans`,
`unionDays`), three pure absence functions over them in `src/domain/absences.ts`
(`packAbsences`, `daysLost`, `awayWeeks`), and a render restructure in
`src/view/render/lanes.ts` where the absence `TimelineEntry` kind disappears and the
header's previously-empty track becomes the surface. **No state-model change** — the
collapse store is untouched.

**Tech Stack:** TypeScript, Obsidian plugin API (1.12.0 floor), esbuild, vitest (node +
jsdom), ESLint with per-directory `no-restricted-imports`.

**Spec:** [2026-08-14-one-row-per-resource-design.md](../specs/2026-08-14-one-row-per-resource-design.md)

**Branch:** `feature/absence-counts-and-derived-names` (PR #136), on top of the derived-name
work already landed there.

## Global Constraints

- **`npm run check` must pass** — build + lint + coverage-thresholded tests + fallow + docs
  register. All five, before every commit.
- **Layers reach downward only.** `src/domain/` may import neither `storage/` nor `view/`,
  may not touch the DOM, and may not read a clock — `today` is always a parameter.
  `no-restricted-imports` fails `npm run lint` on a violation.
- **`src/**` lint budget:** 400 lines per file (blank lines and comments skipped),
  `complexity: 16`, **`max-params: 5`**. `renderLaneHead` is AT that limit today, which is
  why Task 3 collapses its signature rather than growing it.
- **`test/**` lint budget:** 450 lines per file. `test/view/resourceAbsences.test.ts` is the
  file nearest it — check the lint output after each task that touches it.
- **`styles/` partials:** 400 lines each, and every partial must be imported by
  `styles/index.css`. `styles/lanes.css` is at 229.
- **An absence mark is CONTENT**, so every colour it draws from is a TEXT or `--color-*`
  token, never `--background-modifier-*`. `test/view/timelineBoxing.test.ts` asserts this as
  a rule; do not weaken those assertions to accommodate a new colour.
- **Sentence-case UI text** (Obsidian marketplace rule, enforced by lint and review).
- **Do NOT change the coverage thresholds** in `vitest.config.mts`. Task 7 owns that, and
  `docs/issues/The coverage figure is not reproducible to a hundredth.md` is why the answer
  is usually "declined rise". If `npm run check` fails ONLY on a threshold, report it as a
  concern; never lower one.
- **Stage paths explicitly when committing.** Another session shares this checkout — never
  `git add -A` or `git add docs/`.
- **No `setIcon`** (use `drawIcon`), no inline styles (use `setCssProps`), and an SVG node's
  `cls` is an ARRAY, never a space-separated string. All three are lint rules.

---

## File structure

**Modify:**

| File | Responsibility after this change |
| --- | --- |
| `src/domain/timeline.ts` | Gains `mergeSpans` (merged, sorted, both-ended ranges) and `unionDays` (their total). The one place overlapping day ranges are combined. |
| `src/domain/absences.ts` | Loses `pendingAbsences`; gains `isPending` (private), `packAbsences`, `daysLost`, `awayWeeks`. |
| `src/view/render/lanes.ts` | `TimelineEntry` loses its absence member; `renderLaneHead` takes `(ctx, content, entry, ruler)` and draws the packed stretches into its own track; `renderLaneAbsence` is replaced by `renderLaneAbsences`; `drawnSpans` widens from lanes; `noteAbsenceClash` reports days lost. |
| `src/view/render/timeline.ts` | `drawEntries` loses its absence branch and passes the ruler; `TimelineDrawing` gains `lanes`; `drawnSpans` gets its second argument. |
| `src/view/render/roadmap.ts` | Passes `roadmap.lanes` into `TimelineDrawing`. |
| `src/view/render/legend.ts` | Adds the `Days lost` swatch on a new `DrawnColors` field. |
| `src/view/host.ts` | `DrawnColors` gains `daysLost: boolean`. |
| `styles/lanes.css` | `.pbl-absence-row` rules go; header track heights drive off `--pbl-lane-sublanes`; the wash is re-keyed to `--pbl-away`; quiet lanes and the load rail arrive. |
| `styles/legend.css` | The `Days lost` swatch. |
| `test/domain/timeline.test.ts` | `mergeSpans` / `unionDays`. |
| `test/domain/absences.test.ts` | `packAbsences`, `daysLost`, `awayWeeks`; the `pendingAbsences` describe is rewritten onto `awayWeeks`. |
| `test/view/resourceAbsences.test.ts` | No absence ROW; the mark in the header track; the menu per mark; the drop bubbling; the window still widened. |
| `test/view/absenceCollision.test.ts` | The wash and clash assertions re-keyed. |
| `test/view/resourceLanes.test.ts` | The four readout assertions rewritten onto the item count and the pill; the fold-is-inert check. |
| `test/view/legend.test.ts` | The `Days lost` key. |
| `docs/requirements/Resource absences.md` | 4a reversed, 4k amended, the readout amended, the accessibility cost. |
| `docs/requirements/Showing a resources axis on the roadmap.md` | The header track, the readout, quiet lanes. |
| `docs/requirements/Folding a resource's band.md` | The load rail; the refused fold default. |
| `docs/tests/suites/Smoke test the roadmap.md` | The live-vault rows. |
| `CHANGELOG.md` | The `[Unreleased]` entries folded, not appended. |

**Create:** nothing.

---

### Task 1: `mergeSpans` and `unionDays`

**Files:**
- Modify: `src/domain/timeline.ts` (append near `daysBetween`)
- Test: `test/domain/timeline.test.ts`

**Interfaces:**
- Consumes: `DateSpan`, `CivilDate`, `daysBetween` — all already in this file.
- Produces: `mergeSpans(spans: DateSpan[]): Array<{ start: CivilDate; target: CivilDate }>` and
  `unionDays(spans: DateSpan[]): number`. Tasks 2 and 4 both call them.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/timeline.test.ts` (add `mergeSpans` and `unionDays` to the existing
import from `'../../src/domain/timeline'`; if the file has no `civil`-style helper, add the
one below at module scope):

```ts
describe('combining overlapping day ranges', () => {
	const day = (text: string): CivilDate => {
		const read = readDate(text).value;
		if (read === null) throw new Error(`not a date: ${text}`);
		return read;
	};
	const span = (start: string, target: string): DateSpan => ({ start: day(start), target: day(target) });
	const shown = (spans: Array<{ start: CivilDate; target: CivilDate }>): string[] =>
		spans.map((one) => `${formatCivil(one.start)}→${formatCivil(one.target)}`);

	it('leaves ranges that share no day alone, in date order', () => {
		expect(shown(mergeSpans([span('2026-08-10', '2026-08-12'), span('2026-08-01', '2026-08-03')]))).toEqual([
			'2026-08-01→2026-08-03',
			'2026-08-10→2026-08-12',
		]);
	});

	it('merges two that overlap into the range they cover together', () => {
		expect(shown(mergeSpans([span('2026-08-01', '2026-08-05'), span('2026-08-04', '2026-08-09')]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
	});

	it('merges two that merely touch, and two that are adjacent', () => {
		// Inclusive at both ends, `crossedAbsences`' own boundary rule: 1–5 and 5–9 share the
		// 5th. Adjacent ranges (1–5, 6–9) cover a continuous run of days and merge too — that
		// one changes no COUNT, only how many ranges come back.
		expect(shown(mergeSpans([span('2026-08-01', '2026-08-05'), span('2026-08-05', '2026-08-09')]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
		expect(shown(mergeSpans([span('2026-08-01', '2026-08-05'), span('2026-08-06', '2026-08-09')]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
	});

	it('swallows a range wholly inside another', () => {
		expect(shown(mergeSpans([span('2026-08-01', '2026-08-20'), span('2026-08-05', '2026-08-06')]))).toEqual([
			'2026-08-01→2026-08-20',
		]);
	});

	it('borrows the stated end for a one-ended range, as the geometry does', () => {
		expect(shown(mergeSpans([{ start: null, target: day('2026-08-04') }]))).toEqual([
			'2026-08-04→2026-08-04',
		]);
		expect(shown(mergeSpans([{ start: day('2026-08-04'), target: null }]))).toEqual([
			'2026-08-04→2026-08-04',
		]);
	});

	it('counts days inclusively, and counts a shared day once', () => {
		expect(unionDays([span('2026-08-01', '2026-08-03')])).toBe(3);
		// 1–5 is five days and 4–9 is six; together they cover nine, not eleven. Counting the
		// sum instead is the defect this exists to prevent.
		expect(unionDays([span('2026-08-01', '2026-08-05'), span('2026-08-04', '2026-08-09')])).toBe(9);
		expect(unionDays([span('2026-08-01', '2026-08-03'), span('2026-08-10', '2026-08-12')])).toBe(6);
		expect(unionDays([])).toBe(0);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/domain/timeline.test.ts`
Expected: FAIL — `mergeSpans is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/domain/timeline.ts`, below `daysBetween`:

```ts
/**
 * These ranges with every overlap combined away — sorted, both ends stated, and each
 * covering a continuous run of days.
 *
 * The one place day ranges are combined, and that is the point rather than tidiness: two
 * quantities in this plugin are a union of the same absences — how many days a bar loses,
 * and how long a resource is away — and computing it twice is how two numbers about one
 * set of stretches come to disagree.
 *
 * A one-ended range borrows its other end, `barGeometry`'s own borrowing, so a range is
 * judged at the day it actually draws rather than treated as unbounded in the direction it
 * has no date for.
 *
 * Ranges are merged when they share a day OR when they are adjacent. The second half
 * changes no COUNT — 1–5 and 6–9 cover nine days whether that is one range or two — so it
 * is done for the caller that wants the RANGES: a load rail drawn as two strips with no gap
 * between them is one strip with a seam in it.
 */
export function mergeSpans(spans: DateSpan[]): Array<{ start: CivilDate; target: CivilDate }> {
	const ranges = spans
		.map((span) => ({ start: (span.start ?? span.target) as CivilDate, target: (span.target ?? span.start) as CivilDate }))
		// Ascending by start: `daysBetween(b, a)` is a − b, which is the sign a comparator wants.
		.sort((a, b) => daysBetween(b.start, a.start));
	const merged: Array<{ start: CivilDate; target: CivilDate }> = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		// `<= 1` rather than `<= 0`: a gap of one day is no gap at all once both ends are
		// inclusive, and the range ending later of the two is the one to keep — a short range
		// wholly inside a long one must not shorten it.
		if (last !== undefined && daysBetween(last.target, range.start) <= 1) {
			if (daysBetween(last.target, range.target) > 0) last.target = range.target;
			continue;
		}
		merged.push({ ...range });
	}
	return merged;
}

/** How many days these ranges cover between them, counting a shared day once. */
export function unionDays(spans: DateSpan[]): number {
	return mergeSpans(spans).reduce((total, range) => total + daysBetween(range.start, range.target) + 1, 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/domain/timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add src/domain/timeline.ts test/domain/timeline.test.ts
git commit -m "Combine overlapping day ranges in one place"
```

---

### Task 2: `packAbsences`, `daysLost`, `awayWeeks` — and `pendingAbsences` goes

**Files:**
- Modify: `src/domain/absences.ts`
- Test: `test/domain/absences.test.ts`

**Interfaces:**
- Consumes: `mergeSpans` / `unionDays` from Task 1; `crossedAbsences`, `Absence`,
  `daysBetween`, `CivilDate`, `DateSpan` already here.
- Produces: `packAbsences(absences: Absence[]): Absence[][]`,
  `daysLost(span: DateSpan, absences: Absence[]): number`,
  `awayWeeks(absences: Absence[], today: CivilDate): number`.
- **Removes:** `pendingAbsences`. Task 6 rewrites its only caller.

- [ ] **Step 1: Write the failing tests**

In `test/domain/absences.test.ts`: **delete the whole
`describe('how many stretches are still to come', …)` block** — the function it drives is
being removed — and append the three describes below. Update the import from
`'../../src/domain/absences'`: drop `pendingAbsences`, add `packAbsences`, `daysLost`,
`awayWeeks`. The module-scope `civil` and `away` helpers stay as they are.

```ts
describe('packing overlapping stretches into sub-lanes', () => {
	const titles = (packed: Absence[][]): string[][] => packed.map((sub) => sub.map((one) => one.title));

	it('puts stretches that share no day in one sub-lane, in date order', () => {
		const packed = packAbsences([away('B', '2026-08-10', '2026-08-12'), away('A', '2026-08-01', '2026-08-03')]);

		expect(titles(packed)).toEqual([['A', 'B']]);
	});

	it('opens a second sub-lane for two that merely TOUCH', () => {
		// Inclusive at both ends, `crossedAbsences`' rule: 1–5 and 5–9 share the 5th, so they
		// cannot be drawn on one line without one of them lying about a day.
		const packed = packAbsences([away('A', '2026-08-01', '2026-08-05'), away('B', '2026-08-05', '2026-08-09')]);

		expect(titles(packed)).toEqual([['A'], ['B']]);
	});

	it('opens a third only when three are mutually overlapping', () => {
		const packed = packAbsences([
			away('A', '2026-08-01', '2026-08-10'),
			away('B', '2026-08-02', '2026-08-11'),
			away('C', '2026-08-03', '2026-08-12'),
		]);

		expect(titles(packed)).toEqual([['A'], ['B'], ['C']]);
	});

	it('reuses the first sub-lane that has room rather than the emptiest', () => {
		// A greedy first-fit, so a long stretch does not push everything after it downward.
		const packed = packAbsences([
			away('Long', '2026-08-01', '2026-08-20'),
			away('Early', '2026-08-02', '2026-08-04'),
			away('Late', '2026-08-06', '2026-08-08'),
		]);

		expect(titles(packed)).toEqual([['Long'], ['Early', 'Late']]);
	});

	it('packs nothing into nothing', () => {
		expect(packAbsences([])).toEqual([]);
	});
});

describe('how many of a bar’s days an absence takes', () => {
	const AUG = away('Alice away', '2026-08-04', '2026-08-06');

	it('counts nothing for a span that crosses nothing', () => {
		expect(daysLost({ start: civil('2026-08-10'), target: civil('2026-08-20') }, [AUG])).toBe(0);
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-20') }, [])).toBe(0);
	});

	it('counts only the days the two actually share', () => {
		// The bar runs 1–5, the stretch 4–6: two shared days, not the stretch's three.
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-05') }, [AUG])).toBe(2);
	});

	it('counts the whole span when the stretch covers it', () => {
		expect(daysLost({ start: civil('2026-08-05'), target: civil('2026-08-06') }, [AUG])).toBe(2);
	});

	it('counts a day shared by two stretches ONCE', () => {
		// The union, never the sum — two overlapping stretches do not cost a day twice.
		const also = away('Also', '2026-08-05', '2026-08-08');
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [AUG, also])).toBe(5);
	});

	it('judges a one-ended bar at the single day it draws', () => {
		expect(daysLost({ start: null, target: civil('2026-08-05') }, [AUG])).toBe(1);
		expect(daysLost({ start: null, target: civil('2026-08-20') }, [AUG])).toBe(0);
	});
});

describe('how long a resource is away', () => {
	const TODAY = civil('2026-08-14');

	it('rounds part of a week up, since a partial week is still time lost', () => {
		expect(awayWeeks([away('One day', '2026-08-20', '2026-08-20')], TODAY)).toBe(1);
		expect(awayWeeks([away('Seven', '2026-08-20', '2026-08-26')], TODAY)).toBe(1);
		expect(awayWeeks([away('Eight', '2026-08-20', '2026-08-27')], TODAY)).toBe(2);
	});

	it('leaves out a stretch that has already ended, and keeps one still running', () => {
		// The filter `pendingAbsences` used to be, now the only thing left of it.
		expect(awayWeeks([away('Over', '2026-08-01', '2026-08-13')], TODAY)).toBe(0);
		expect(awayWeeks([away('Ends today', '2026-08-01', '2026-08-14')], TODAY)).toBe(2);
	});

	it('counts a day two stretches share once', () => {
		const overlapping = [away('A', '2026-08-20', '2026-08-26'), away('B', '2026-08-24', '2026-08-30')];
		// Eleven days together, not fourteen — two weeks, not two-and-a-bit rounded to three.
		expect(awayWeeks(overlapping, TODAY)).toBe(2);
	});

	it('is nothing for a resource with no stretches at all', () => {
		expect(awayWeeks([], TODAY)).toBe(0);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/absences.test.ts`
Expected: FAIL — `packAbsences is not a function` and two more.

- [ ] **Step 3: Replace `pendingAbsences` with the shared predicate**

In `src/domain/absences.ts`, **delete `pendingAbsences` entirely** — doc comment and all —
and put this in its place:

```ts
/**
 * Has this stretch not ended? One comparison, not two: a stretch whose target is today or
 * later has either not started or not finished, and there is no third case — written as two
 * conditions it invites a reader to "fix" a missing start comparison that would drop every
 * running absence.
 *
 * Inclusive at today, `crossedAbsences`' own boundary rule, so one absence does not mean two
 * different things on one row. From DATES and never from geometry, so a stretch outside the
 * drawn window still counts and the answer does not change as the reader scrolls.
 *
 * Private, and it was `pendingAbsences` — an exported COUNT — until the band header stopped
 * reporting one (2026-08-14). What the header shows now is weeks, so the count had no caller
 * left and only the filter survived.
 */
function isPending(absence: Absence, today: CivilDate): boolean {
	return daysBetween(today, absence.target) >= 0;
}
```

- [ ] **Step 4: Add the three functions**

Append to `src/domain/absences.ts`:

```ts
/**
 * These stretches grouped into the sub-lanes they can be drawn on — the first holding as
 * many as fit without sharing a day, the next taking what is left, and so on.
 *
 * **This is not the lane-packing extension 4a refused, and the difference is the whole
 * argument.** That refusal's reason was "a packing rule is a second geometry to keep in step
 * with the one the bars use". This returns `Absence[][]` and computes no pixel: it runs over
 * ABSENCES only and never over bars, so every bar is still placed by `barGeometry` against
 * the same window, one row per `timelineRows` row, with nothing moved aside for anything.
 * There is one geometry and a grouping decided before it.
 *
 * What 4a was protecting survives in a sharper form: nothing is ever hidden or merged by
 * packing. Two stretches that share a day get two sub-lanes and the header grows to hold
 * them both.
 *
 * Greedy FIRST-fit rather than best-fit, deliberately: a long stretch then holds sub-lane 0
 * and everything short slots in beneath it, instead of each new stretch pushing the pile
 * down. The boundary is `crossedAbsences`' — inclusive at both ends — so two that merely
 * touch do not share a line, because one of them would have to lie about the shared day.
 */
export function packAbsences(absences: Absence[]): Absence[][] {
	const sorted = [...absences].sort((a, b) => daysBetween(b.start, a.start));
	const packed: Absence[][] = [];
	for (const absence of sorted) {
		const room = packed.find((sub) => daysBetween(sub[sub.length - 1].target, absence.start) >= 1);
		if (room === undefined) packed.push([absence]);
		else room.push(absence);
	}
	return packed;
}

/**
 * How many of the days this span DRAWS are days its resource is away — the number the row
 * reports beside a bar scheduled across a stretch.
 *
 * Each crossed stretch is clamped to the bar's own days first and the results are UNIONED,
 * never summed: two overlapping stretches must not cost the same day twice, which is the
 * defect this shares its primitive with `awayWeeks` to prevent.
 *
 * `crossedAbsences` decides WHICH stretches count, so the two cannot disagree about whether
 * a bar is affected at all — a row that carries the clash mark and reports zero days lost
 * would be two answers to one question.
 */
export function daysLost(span: DateSpan, absences: Absence[]): number {
	const from = (span.start ?? span.target) as CivilDate;
	const to = (span.target ?? span.start) as CivilDate;
	return unionDays(
		crossedAbsences(span, absences).map((absence) => ({
			start: daysBetween(from, absence.start) > 0 ? absence.start : from,
			target: daysBetween(absence.target, to) > 0 ? absence.target : to,
		})),
	);
}

/**
 * How long this resource is still away, in whole weeks rounded UP — the band header's pill.
 *
 * Rounded up because a partial week is still time nobody can be scheduled into, and reported
 * in weeks because a header is scanned rather than read: "3 wk away" answers the question a
 * roster is being looked at to answer, and the exact days are on the stretches themselves.
 *
 * Only the stretches that have not ended (`isPending`), and their union rather than their
 * sum — `daysLost`'s rule, from the same primitive, so the two numbers on one screen cannot
 * disagree about how long one set of stretches lasts.
 */
export function awayWeeks(absences: Absence[], today: CivilDate): number {
	const pending = absences.filter((absence) => isPending(absence, today));
	return Math.ceil(unionDays(pending.map((absence) => ({ start: absence.start, target: absence.target }))) / 7);
}
```

Add `mergeSpans` is NOT needed here — only `unionDays`. Add `unionDays` to the existing
import from `'./timeline'`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/domain/absences.test.ts`
Expected: PASS.

- [ ] **Step 6: Expect the build to break, and leave it broken**

Run: `npx tsc --noEmit`
Expected: FAIL in `src/view/render/lanes.ts` — `pendingAbsences` no longer exists. That is
Task 6's caller. **Do not fix it here and do not commit a broken tree**: instead, make the
one-line stopgap in `laneReadout` so the tree compiles, and say in your report that Task 6
replaces it:

```ts
	const away = absences.length === 0 ? 0 : awayWeeks(lane.absences, today);
```

with `lane.absences` in place of the removed count, and the string left as it is for now —
`${away} absence${away === 1 ? '' : 's'}` becomes `${away} wk away` in Task 6. Import
`awayWeeks` instead of `pendingAbsences`. Update the two `resourceLanes.test.ts` assertions
that break so the suite is green; Task 6 rewrites them properly.

**If that stopgap turns out to need more than three changed lines, stop and report
NEEDS_CONTEXT** — it means Task 6 should have come first, and reordering is cheaper than a
tangle.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add src/domain/absences.ts src/view/render/lanes.ts test/domain/absences.test.ts test/view/resourceLanes.test.ts
git commit -m "Pack absences, count days lost, and measure how long someone is away"
```

---

### Task 3: the stretches move into the lane header's own track

The largest task, and indivisible: removing the absence entry kind breaks every test that
knows about an absence row, all at once.

**Files:**
- Modify: `src/view/render/lanes.ts`, `src/view/render/timeline.ts`,
  `src/view/render/roadmap.ts`, `styles/lanes.css`
- Test: `test/view/resourceAbsences.test.ts`, `test/view/absenceCollision.test.ts`

**Interfaces:**
- Consumes: `packAbsences` from Task 2.
- Produces: `renderLaneHead(ctx, content, entry: { lane, collapsed }, ruler: { window, scale, today }): HTMLElement`;
  `drawnSpans(entries: TimelineEntry[], lanes: ResourceLane[]): DateSpan[]`;
  `TimelineDrawing.lanes: ResourceLane[]`.

- [ ] **Step 1: Write the failing tests**

In `test/view/resourceAbsences.test.ts`, replace the `bandOrder` helper (it keys on
`.pbl-absence-row`, which is going away) and add the new cases. The helper becomes:

```ts
/**
 * Every drawn line of the band, in order. There is no absence ROW any more — a stretch
 * draws inside its header's own track — so a header reports how many marks it carries
 * rather than being followed by a line each.
 */
function bandOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row');
	return Array.from(rows).map((el) => {
		if (!el.classList.contains('pbl-lane-head')) return el.querySelector('.pbl-card-title')?.textContent ?? '';
		const name = el.querySelector('.pbl-lane-name')?.textContent;
		return `lane:${name}+${el.querySelectorAll('.pbl-absence').length}`;
	});
}
```

Then update the three tests that used the old shape and add five new ones:

```ts
	it('draws in its own resource’s header, not in a row of its own', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// One row per person: the stretch is a mark inside the header's track, and Alice's
		// work follows the header directly.
		expect(bandOrder(containerEl)).toEqual(['lane:Alice+1', 'Work', 'lane:Bob+0']);
		expect(containerEl.querySelectorAll('.pbl-absence-row')).toHaveLength(0);
	});

	it('puts the mark inside the header’s own track', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const track = containerEl.querySelector<HTMLElement>('.pbl-lane-head .pbl-timeline-track');

		expect(track?.querySelectorAll('.pbl-absence')).toHaveLength(1);
	});

	it('packs two that share a day onto two sub-lanes, and says how many', () => {
		// 4a's promise kept in its new form: nothing is hidden or merged, the header grows.
		const vault = absenceVault();
		vault.addFile('Also away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-05', due: '2026-08-08' },
		});
		const { containerEl } = laneRoadmap(vault);
		const head = lanesOf(containerEl)[0];

		expect(head.querySelectorAll('.pbl-absence')).toHaveLength(2);
		expect(head.style.getPropertyValue('--pbl-lane-sublanes')).toBe('2');
	});

	it('keeps the context menu on the mark, which is now the only route to it', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const mark = containerEl.querySelector<HTMLElement>('.pbl-lane-head .pbl-absence');

		mark?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Edit absence', 'Delete absence']);
	});

	it('lets a drop on the MARK still reach the band it sits in', async () => {
		// The mark is a CHILD of a registered element rather than a sibling drawing into the
		// band, so dragover and drop bubble to the header. That is the whole mechanism, and
		// its absence is `docs/bugs/An absence stretch is a dead spot in its own band.md`.
		const vault = absenceVault();
		vault.addFile('Bob away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);
		const mark = lanesOf(containerEl)[1].querySelector<HTMLElement>('.pbl-absence');
		if (mark === null) throw new Error('no mark to drop on');

		cardDrag(barFor(containerEl, 'Work'), mark);
		await flush();

		expect(vault.fm('Work.md')['assignee']).toBe('Bob');
	});

	it('names every stretch on the header, since none of them has a row any more', () => {
		// The accessibility cost of one-row-per-person, stated as a check rather than only in
		// the register: three rows each with a name become one description with three in it.
		const { containerEl } = laneRoadmap(absenceVault());

		expect(lanesOf(containerEl)[0].getAttribute('aria-description')).toBe(
			'Unavailable: Alice away 2026-08-04 → 2026-08-06',
		);
	});
```

The existing `is positioned by the same date math a bar is`, `grows the window to hold
itself, in a row nothing else draws in`, `says "beyond what is drawn" where the grid refuses
to reach it` and `marks a stretch the window cuts through…` tests keep their assertions but
must now find their marks under `.pbl-lane-head`; their existing selectors (`.pbl-absence`)
already do. **Delete `says whose row it is in and which days it covers`** — the row it
asserts on is gone, and the case it covered is the `aria-description` test above.

In `test/view/absenceCollision.test.ts`, the assertion
`expect(harness.containerEl.querySelector('.pbl-absence-row .pbl-absence-wash')).toBeNull()`
loses its subject. Replace it with the header's:

```ts
		expect(harness.containerEl.querySelector('.pbl-lane-head .pbl-absence-wash')).toBeNull();
```

with a comment saying the header's track carries the stretches themselves, so a wash there
would shade the days twice.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/absenceCollision.test.ts`
Expected: FAIL — the band still emits absence rows.

- [ ] **Step 3: Drop the entry kind and stop emitting the rows**

In `src/view/render/lanes.ts`:

- Delete the `| { kind: 'absence'; absence: Absence }` member of `TimelineEntry`.
- In `laneEntries`, delete the `for (const absence of lane.absences)` loop and rewrite the
  comment above it — the band is header → rows → context, and the stretches are the header's
  now.
- Delete `renderLaneAbsence` entirely.

- [ ] **Step 4: Widen the window from the lanes instead**

Still in `lanes.ts`, `drawnSpans` gains its second argument:

```ts
export function drawnSpans(entries: TimelineEntry[], lanes: ResourceLane[]): DateSpan[] {
	const bars = entries.flatMap((entry) => (entry.kind === 'row' ? [entry.row.bar.span] : []));
	const stretches = lanes.flatMap((lane) =>
		lane.absences.map((absence) => ({ start: absence.start, target: absence.target })),
	);
	return [...bars, ...stretches];
}
```

and its doc comment keeps the bug reference, restated for the new source:

```ts
/**
 * Every span this grid will DRAW — which is not the same list as its bars, and the
 * difference is a shipped bug. The window used to be the bars alone, so an absence stretch
 * beyond their reach was clamped to the edge and painted on a day it does not cover; worst
 * in a row an absence MINTED, which holds no bar at all, so nothing the row exists to draw
 * had any say in the window it is drawn against. See
 * `docs/bugs/An absence drew at the edge of a window it never widened.md`.
 *
 * The stretches come from the LANES rather than from the entries, since 2026-08-14: they
 * are no longer entries at all, they are drawn in each header's own track. The hazard is
 * unchanged and so is the fix — a source that stops reaching this list is a window that
 * stops holding what it draws. The dated axis passes no lanes.
 */
```

In `src/view/render/timeline.ts`: add `lanes: ResourceLane[]` to `TimelineDrawing` (with a
doc comment saying it is the axis's own list, empty on the dated axis, and that **`rows` is
still derived from `laneElement` alone** so there is only ever one discriminator for which
axis is on screen), and change the call to `drawnSpans(entries, drawing.lanes)`.

In `src/view/render/roadmap.ts`, pass `lanes: axis === 'resources' ? roadmap.lanes : []`
into the `TimelineDrawing` literal — read the file for the exact spelling of the axis test it
already uses when building `entries`, and reuse that rather than writing a second one.

- [ ] **Step 5: Collapse `renderLaneHead`'s signature and draw the marks**

`renderLaneHead` is at 5 parameters, the `max-params` limit, and needs two more. It collapses
instead:

```ts
export function renderLaneHead(
	ctx: RowContext,
	content: HTMLElement,
	entry: { lane: ResourceLane; collapsed: boolean },
	ruler: { window: TimelineWindow; scale: TimelineScale; today: CivilDate },
): HTMLElement {
```

with a doc-comment paragraph saying why:

```
 * Four parameters rather than six, and the grouping is not cosmetic: this was at the
 * `max-params` limit of five when it took `today`, and the header now needs the window and
 * the scale to place the stretches it draws. Both groupings already exist as shapes — `entry`
 * is the `TimelineEntry` `'lane'` member without its tag, and `ruler` is what
 * `renderAbsenceWash` already takes plus the day the readout asks about — so nothing new was
 * invented to fit under the cap.
```

Inside, `lane` and `collapsed` come off `entry`, the readout takes `ruler.today`, and the
final line hands the track over to be filled. **The drawer creates and RETURNS the track**,
which is what keeps both it and the rail at four parameters — five is the cap and neither has
room to also be handed an element it can make itself:

```ts
	const track = renderLaneAbsences(ctx, head, lane, ruler);
	if (collapsed) renderLaneRail(track, lane, ruler);
	return head;
```

(The rail is Task 4's; add its call there, not here.)

Add the drawer below it:

```ts
/**
 * One resource's unavailable stretches, drawn in that resource's own header track — which
 * is what makes a band one row per person whatever they have.
 *
 * Positioned by `barGeometry` against the same window a bar is, so a stretch and the work it
 * crosses cannot disagree about which day is which, and packed by `packAbsences` so two that
 * share a day get two sub-lanes instead of two rows. The sub-lane count goes onto the HEADER
 * as `--pbl-lane-sublanes` and the stylesheet does the arithmetic: one number crossing the
 * boundary rather than a height computed here.
 *
 * **Each mark keeps its pointer events, and that is deliberate in both directions.** It needs
 * them for the context menu, which is now the ONLY route to Edit and Delete — the row that
 * used to carry them is gone. And the band's drop still works because a mark is a CHILD of
 * the header, an element `TimelineDrawing.laneElement` registers, so `dragover` and `drop`
 * bubble to it. That is exactly what
 * `docs/bugs/An absence stretch is a dead spot in its own band.md` was: a stretch that drew
 * into a band as a SIBLING without joining it. A `pointer-events: none` here would kill the
 * menu; a `stopPropagation` would recreate the dead spot.
 *
 * The stretches' names and dates go on the header as one `aria-description`, because none of
 * them has a row to be named by any more. That is a REGRESSION and not a substitution —
 * three stretches become one string a reader cannot move within — accepted as the cost of
 * one row per person and recorded as such in `docs/requirements/Resource absences.md`.
 */
function renderLaneAbsences(
	ctx: RowContext,
	head: HTMLElement,
	lane: ResourceLane,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): HTMLElement {
	// Annotated rather than left as `ctx.host`, the fallow gotcha in the root `CLAUDE.md`:
	// an interface member reached only through a property access reports as an unused class
	// member even though it is called.
	const host: BacklogViewHost = ctx.host;
	const track = head.createDiv({ cls: 'pbl-timeline-track' });
	if (lane.absences.length === 0) return track;
	const packed = packAbsences(lane.absences);
	head.setCssProps({ '--pbl-lane-sublanes': String(packed.length) });
	head.setAttribute(
		'aria-description',
		`Unavailable: ${lane.absences.map((one) => `${one.title} ${formatCivil(one.start)} → ${formatCivil(one.target)}`).join('; ')}`,
	);
	packed.forEach((sub, index) => {
		for (const absence of sub) {
			const geometry = barGeometry(ruler.window, { start: absence.start, target: absence.target });
			const mark = track.createDiv({ cls: ['pbl-absence', ...edgeClasses(geometry)].join(' ') });
			mark.setCssProps({
				'--pbl-bar-left': `${geometry.startDay * ruler.scale.dayPx}px`,
				'--pbl-bar-width': `${Math.max(geometry.spanDays * ruler.scale.dayPx, MIN_BAR_PX)}px`,
				'--pbl-sublane': String(index),
			});
			setTooltip(mark, `${absence.title} — ${formatCivil(absence.start)} → ${formatCivil(absence.target)}`);
			mark.addEventListener('contextmenu', (evt) => showAbsenceMenu(host, absence, evt));
		}
	});
	return track;
}
```

The early return still creates the track: a header with no stretches keeps its track, because
that empty track is what carries the band across the day area — and the rail draws into it.

- [ ] **Step 6: Move the CSS onto the header**

In `styles/lanes.css`:

- **Delete** `.pbl-absence-row .pbl-timeline-lead > *`, `.pbl-absence-row .pbl-timeline-track`
  and `.pbl-absence-icon`, plus any other `.pbl-absence-row` rule. Keep the comment block
  above `.pbl-lane-context .pbl-timeline-lead > *` but rewrite its cross-reference — it
  currently points at `.pbl-absence-row below for the rule`, which will not exist.
- `.pbl-absence` keeps its hatch, its border and its `--text-muted` tokens. Its `height`
  becomes `13px` and its `top: 50%; transform: translateY(-50%)` is replaced by the sub-lane
  arithmetic:

```css
/* One geometry for every sub-lane count, rather than a centred single and a pitched pair:
   13px marks on a 17px pitch, the first at 7px. At one sub-lane the mark sits 7 above and 10
   below inside the 30px floor — near enough to centred that nobody measures it, and it costs
   a `calc` instead of a branch. */
.pbl-absence {
	height: 13px;
	top: calc(7px + var(--pbl-sublane) * 17px);
}
```

- The header's track grows with the count:

```css
/* `max(30px, …)` rather than a bare formula: one sub-lane wants the floor rather than the
   27px the pitch alone gives it, and a lane with no stretches at all wants the same 30px so
   a roster does not stagger. `--pbl-lane-sublanes` is 0 unless a header drew marks. */
.pbl-lane-head .pbl-timeline-track {
	min-height: max(30px, calc(10px + var(--pbl-lane-sublanes, 0) * 17px));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/absenceCollision.test.ts`
Expected: PASS. Then `npx vitest run` for the rest — `resourceLanes.test.ts` and
`legend.test.ts` both touch this area.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add src/view/render/lanes.ts src/view/render/timeline.ts src/view/render/roadmap.ts styles/lanes.css test/view/resourceAbsences.test.ts test/view/absenceCollision.test.ts
git commit -m "Draw a resource's stretches in their own header track"
```

---

### Task 4: quiet lanes, and the load rail

**Files:**
- Modify: `src/view/render/lanes.ts`, `styles/lanes.css`
- Test: `test/view/resourceLanes.test.ts`

**Interfaces:**
- Consumes: `mergeSpans` from Task 1.
- Produces: `.pbl-lane-quiet` on a header with nothing at all; `.pbl-lane-rail` strips in a
  folded band's header track.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('the band header’s readout')` block in
`test/view/resourceLanes.test.ts`:

```ts
	it('draws a lane with nothing at all as a quiet row', () => {
		const harness = laneRoadmap(countingVault([]));
		const bob = lanesOf(harness.containerEl)[1];

		// Contrast, not opacity: a row-level `opacity` would dim the sticky lead column with
		// it, which is the trap `styles/lanes.css` records at the context row's own muting.
		expect(bob.classList.contains('pbl-lane-quiet')).toBe(true);
		expect(lanesOf(harness.containerEl)[0].classList.contains('pbl-lane-quiet')).toBe(false);
	});

	it('is not quiet when the only thing it holds is a stretch', () => {
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		const harness = laneRoadmap(vault);

		expect(lanesOf(harness.containerEl)[0].classList.contains('pbl-lane-quiet')).toBe(false);
	});

	it('draws a load rail for a band folded over work, and none for an open one', () => {
		const harness = laneRoadmap(countingVault([]));

		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(0);
		harness.view.setLaneCollapsed('Alice', true);
		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(1);
	});

	it('draws one rail per continuous run, not one per bar', () => {
		const vault = countingVault([]);
		// Two bars that share days, and one far away: two runs, three bars.
		vault.addFile('Overlapping.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-05', due: '2026-08-15' },
		});
		vault.addFile('Later.md', {
			frontmatter: { type: 'Epic', order: 30, assignee: 'Alice', start: '2026-10-01', due: '2026-10-10' },
		});
		const harness = laneRoadmap(vault);
		harness.view.setLaneCollapsed('Alice', true);

		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-lane-rail')).toHaveLength(2);
	});

	it('renders the same rows folded and open when a lane holds no work', () => {
		// The check under a REFUSAL: "no work → folded by default" was asked for and declined
		// as inert, because a lane with no bars has nothing beneath its header either way.
		// If that stops being true this fails, and the refusal gets re-decided rather than
		// quietly outliving its reason.
		const harness = laneRoadmap(countingVault([]));
		const rowsWhenOpen = harness.containerEl.querySelectorAll('.pbl-lane-head, .pbl-timeline-row').length;

		harness.view.setLaneCollapsed('Bob', true);

		expect(harness.containerEl.querySelectorAll('.pbl-lane-head, .pbl-timeline-row')).toHaveLength(rowsWhenOpen);
	});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/view/resourceLanes.test.ts`
Expected: FAIL on the quiet class and the rail; the last one (the refusal check) should
already PASS — confirm it does, and say so in your report. If it fails, stop and report
BLOCKED: it means folding an empty lane is not inert and the spec's §4 refusal rests on
something untrue.

- [ ] **Step 3: Mark the quiet lanes**

In `renderLaneHead`, extend the class list:

```ts
	const quiet = lane.bars.length === 0 && lane.absences.length === 0 && lane.context.length === 0;
	const head = content.createDiv({
		cls:
			'pbl-lane-head' +
			(lane.declared ? '' : ' pbl-lane-undeclared') +
			(collapsed ? ' pbl-lane-collapsed' : '') +
			(quiet ? ' pbl-lane-quiet' : ''),
	});
```

`context` is in the test because a lane placing an excluded note is not empty — it has
something on screen under it, so calling it quiet would mute a row that is doing work.

- [ ] **Step 4: Draw the rail**

Below `renderLaneAbsences` in `lanes.ts`:

```ts
/**
 * Where a folded band's work LIES, as one thin strip per continuous run of days.
 *
 * Only while the band is folded: an open one draws its own bars, and a rail beneath them
 * would restate what the reader is already looking at. It is decoration and nothing else —
 * `aria-hidden`, no pointer events, no tooltip — because everything it stands for is one
 * click away and the band's own count already says how much there is.
 *
 * `mergeSpans` rather than one strip per bar, so two bars that overlap read as the one run
 * they are: drawn per bar, a busy fortnight is a row of seams.
 *
 * **The `opacity` on this is exempt from the rule beside it, and the exemption is why it is
 * stated here.** `styles/lanes.css` says muting is done to a row's CONTENT and never to the
 * row, because a row-level `opacity` takes the sticky lead column down with it. This is an
 * aria-hidden decorative child inside one track, so it dims nothing that carries meaning.
 */
function renderLaneRail(
	track: HTMLElement,
	lane: ResourceLane,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): void {
	for (const run of mergeSpans(lane.bars.map((bar) => bar.span))) {
		const geometry = barGeometry(ruler.window, run);
		if (geometry.outside) continue;
		const rail = track.createDiv({ cls: 'pbl-lane-rail', attr: { 'aria-hidden': 'true' } });
		rail.setCssProps({
			'--pbl-bar-left': `${geometry.startDay * ruler.scale.dayPx}px`,
			'--pbl-bar-width': `${Math.max(geometry.spanDays * ruler.scale.dayPx, MIN_BAR_PX)}px`,
		});
	}
}
```

and call it from `renderLaneHead`, on the track `renderLaneAbsences` returned (Task 3 left
the call site ready for this line):

```ts
	const track = renderLaneAbsences(ctx, head, lane, ruler);
	if (collapsed) renderLaneRail(track, lane, ruler);
```

Add `mergeSpans` to the existing import from `'../../domain/timeline'`.

- [ ] **Step 5: Style both**

In `styles/lanes.css`:

```css
/* A resource with nothing on screen under them: still a row, because a roster exists to show
   who is on it, but one step quieter than one that has something to say. CONTRAST rather than
   opacity — see the context row's muting above for what a row-level opacity costs. */
.pbl-lane-quiet .pbl-timeline-lead,
.pbl-lane-quiet {
	background-color: var(--background-primary-alt);
}

.pbl-lane-quiet .pbl-lane-name {
	color: var(--text-muted);
	font-weight: var(--font-normal);
}

/* Where a folded band's work lies. Decoration only, so `opacity` here dims nothing that
   carries meaning — the rule it looks like it breaks is about a ROW's opacity taking the
   sticky lead column with it. */
.pbl-lane-rail {
	position: absolute;
	bottom: 0;
	left: var(--pbl-bar-left);
	width: var(--pbl-bar-width);
	height: 3px;
	border-radius: var(--radius-s);
	background-color: var(--text-accent);
	opacity: 0.75;
	pointer-events: none;
}
```

- [ ] **Step 6: Run the tests, the gate, and commit**

Run: `npx vitest run test/view/resourceLanes.test.ts` then `npm run check`.

```bash
git add src/view/render/lanes.ts styles/lanes.css test/view/resourceLanes.test.ts
git commit -m "Quiet the empty lanes, and show where a folded band's work lies"
```

---

### Task 5: the wash, the clash swatch, and the days lost

**Files:**
- Modify: `styles/lanes.css`, `styles/legend.css`, `src/view/render/lanes.ts`,
  `src/view/host.ts`, `src/view/render/legend.ts`, `src/view/render/timeline.ts`
- Test: `test/view/absenceCollision.test.ts`, `test/view/legend.test.ts`,
  `test/view/timelineBoxing.test.ts`

**Interfaces:**
- Consumes: `daysLost` from Task 2, `crossedAbsences`.
- Produces: `DrawnColors.daysLost: boolean`; `.pbl-away-swatch`, `.pbl-days-lost`,
  `.pbl-legend-days-lost`; `--pbl-away` in `styles/lanes.css`.

- [ ] **Step 1: Write the failing tests**

In `test/view/absenceCollision.test.ts`:

```ts
	it('says how many of a bar’s days the stretch takes', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const row = rowFor(containerEl, 'Work');

		// `Work` runs 1–10 August and Alice is away 4–6: three days.
		expect(row?.querySelector('.pbl-days-lost')?.textContent).toBe('3 days lost to absence');
	});

	it('says so differently when the stretch covers the bar whole', () => {
		const vault = new FakeVault();
		vault.addFile('Short.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-04', due: '2026-08-05' },
		});
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-01', due: '2026-08-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Short')?.querySelector('.pbl-days-lost')?.textContent).toBe('all 2 days lost');
	});

	it('keeps the sentence reachable even where the visible label is dropped', () => {
		// The toolbar's own rule: shed the visible thing, never the reachable one. The label
		// needs room the year zoom does not have; the `.pbl-sr-only` sentence is written either
		// way, so nothing is lost with it.
		const harness = laneRoadmap(absenceVault());
		harness.view.setTimelineZoom('year');
		const row = rowFor(harness.containerEl, 'Work');

		expect(row?.querySelector('.pbl-days-lost')).toBeNull();
		expect(row?.querySelector('.pbl-sr-only')?.textContent).toContain('Crosses an absence');
	});

	it('says a milestone falls on an away day rather than counting its days', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, assignee: 'Alice', due: '2026-08-05' },
		});
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Ship')?.querySelector('.pbl-days-lost')?.textContent).toBe(
			'· falls on an away day',
		);
	});
```

Read `test/helpers/view.ts` for the real name of the zoom control before writing the third
test — if the harness has no zoom setter, drive the width threshold by stubbing the scale the
same way the file's other geometry tests do, and say in your report which you used.

In `test/view/legend.test.ts`, beside the existing `Unavailable` assertion, add one for
`Days lost` keyed exactly when a clash drew and not otherwise.

In `test/view/timelineBoxing.test.ts`, add a stylesheet-text check beside the three that
already state this pattern: `.pbl-absence-wash` names `--pbl-away` and names no
`--background-modifier-*` token. **State its own reach in a comment** — it sees a declaration
in a rule, it cannot see a later rule overriding it, and it cannot tell you what anything
looks like.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/view/absenceCollision.test.ts test/view/legend.test.ts test/view/timelineBoxing.test.ts`
Expected: FAIL on all four new subjects.

- [ ] **Step 3: Re-key the wash**

In `styles/lanes.css`, replace `.pbl-absence-wash`'s colours (keep `box-sizing`, the
positioning and `pointer-events: none` exactly as they are):

```css
/* The away key, defined once and used by the wash, the lead swatch and the legend, so the
   column and the marks that stand for it cannot drift apart. A `--color-*` token mixed with a
   TEXT token: an absence is CONTENT, so no part of it is drawn from `--background-modifier-*`
   — the rule `docs/bugs/An absence read fainter than the decoration behind it.md` records. */
.pbl-timeline-grid {
	--pbl-away: color-mix(in srgb, var(--color-yellow) 55%, var(--text-muted));
}

.pbl-absence-wash {
	box-sizing: border-box;
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-bar-left);
	width: var(--pbl-bar-width);
	background-color: color-mix(in srgb, var(--pbl-away) 16%, transparent);
	/* Hatched in the row's own DARK, so the column darkens whatever it crosses rather than
	   brightening it — a light hatch over a saturated bar reads as a second bar. */
	background-image: repeating-linear-gradient(
		45deg,
		color-mix(in srgb, var(--background-primary) 35%, transparent) 0 4px,
		transparent 4px 8px
	);
	border-inline: 1px solid color-mix(in srgb, var(--pbl-away) 85%, transparent);
	pointer-events: none;
}
```

Read the file for the real selector that scopes the grid before using `.pbl-timeline-grid` —
put `--pbl-away` on whatever element already scopes these rules, and say which you chose.

- [ ] **Step 4: Swap the glyph for a swatch, and add the cost**

In `src/view/render/lanes.ts`, `noteAbsenceClash` keeps its `.pbl-sr-only` sentence
**verbatim** and changes what it draws beside it:

```ts
export function noteAbsenceClash(row: HTMLElement, lead: HTMLElement, crossed: Absence[], cost: string | null): void {
	if (crossed.length === 0) return;
	const spans = crossed.map((one) => `${one.title} ${formatCivil(one.start)} → ${formatCivil(one.target)}`).join('; ');
	const said = `Crosses ${crossed.length === 1 ? 'an absence' : `${crossed.length} absences`}: ${spans}`;
	row.createSpan({ cls: 'pbl-sr-only', text: said });
	// A hatched swatch in the away key rather than the `calendar-x` glyph it replaced, so the
	// lead mark and the column it stands for read as one thing — and the legend can key it.
	const flag = lead.createSpan({ cls: 'pbl-away-flag pbl-away-swatch', attr: { 'aria-hidden': 'true' } });
	setTooltip(flag, said);
	if (cost !== null) row.createSpan({ cls: 'pbl-days-lost', text: cost, attr: { 'aria-hidden': 'true' } });
}
```

The `cost` is `aria-hidden` because the `.pbl-sr-only` sentence already carries the fact — a
reader must not hear it twice.

Its caller in `drawEntries` (`src/view/render/timeline.ts`) computes both:

```ts
			if (lane) {
				renderAbsenceWash(bar.track, lane.absences, { window, scale });
				const crossed = crossedAbsences(entry.row.bar.span, lane.absences);
				noteAbsenceClash(bar.row, bar.lead, crossed, clashCost(entry.row, lane, { window, scale }));
				if (crossed.length > 0) drawn.daysLost = true;
			}
```

and `clashCost` is a small function beside `drawEntries` — a **marker** answers first, then
the width threshold, then the wording:

```ts
/**
 * What a bar SAYS about the days it loses, or null where the label has no room.
 *
 * A milestone is a point, so there is no arithmetic to do: `crossedAbsences` already
 * answered whether it lands on an away day, and a count of days would be one either way.
 *
 * The threshold is the whole reason this returns null rather than a string every time. The
 * label is new furniture INSIDE the day track: at year zoom a bar is a few pixels and this
 * sentence is ~180px, so it would dominate the grid and collide with the bar after it. The
 * `.pbl-sr-only` sentence in `noteAbsenceClash` is written unconditionally, so dropping the
 * visible half loses nothing — the toolbar's own rule, shed the visible thing and never the
 * reachable one.
 */
function clashCost(row: TimelineRow, lane: ResourceLane, ruler: { window: TimelineWindow; scale: TimelineScale }): string | null {
	if (isMarkerType(row.bar.item.typeName)) return '· falls on an away day';
	const geometry = barGeometry(ruler.window, row.bar.span);
	if (geometry.spanDays * ruler.scale.dayPx < MIN_COST_LABEL_PX) return null;
	const lost = daysLost(row.bar.span, lane.absences);
	if (lost === 0) return null;
	const whole = lost >= geometry.spanDays;
	return whole ? `all ${lost} days lost` : `${lost} days lost to absence`;
}
```

`MIN_COST_LABEL_PX` is a named constant beside it — start at `120` and say in your report that
it is a live-vault tuning knob, the same caveat the wash percentages carry.

Check `isMarkerType`'s real import path and the field holding a bar's type name before
writing this; `row.bar.item` is a `BacklogItem`.

- [ ] **Step 5: Key it in the legend**

`src/view/host.ts` — `DrawnColors` gains:

```ts
	/**
	 * A bar reported days lost to an absence somewhere on this grid — the resources axis
	 * only, since it is the only one whose rows belong to a resource. Reported from the
	 * RENDER like `absence` beside it, and for the same reason: a collapsed band draws no
	 * clash, so a predicate over `roadmap.lanes` would key a mark nothing on screen makes.
	 */
	daysLost: boolean;
```

Every literal building a `DrawnColors` needs the new field — `npx tsc --noEmit` names them.
`BarColors` is `Omit<DrawnColors, 'absence'>`; widen it to
`Omit<DrawnColors, 'absence' | 'daysLost'>` and extend its doc comment: a bar row reports
neither the hatch nor the clash, because both are the band's business rather than the bar's
own colour.

`src/view/render/legend.ts` — after the `Unavailable` swatch:

```ts
	if (drawn.daysLost) addSwatch(legendEl, 'pbl-legend-days-lost', 'Days lost');
```

`styles/legend.css` — `.pbl-legend-days-lost` carries the wash's own colours at a finer hatch
period, the way `.pbl-legend-absence` already does, and **names the same `--pbl-away` token
the wash does**. Add that pairing to the stylesheet-text checks beside the existing one.

- [ ] **Step 6: Run everything, the gate, and commit**

Run: `npx vitest run` then `npm run check`.

```bash
git add src/view/render/lanes.ts src/view/render/timeline.ts src/view/render/legend.ts src/view/host.ts styles/lanes.css styles/legend.css test/view/absenceCollision.test.ts test/view/legend.test.ts test/view/timelineBoxing.test.ts
git commit -m "Show what an absence costs the work that crosses it"
```

---

### Task 6: the readout becomes a count and a pill

**Files:**
- Modify: `src/view/render/lanes.ts`, `styles/lanes.css`
- Test: `test/view/resourceLanes.test.ts`, `test/view/resourceAbsences.test.ts`,
  `test/view/contextCardWrites.test.ts`

**Interfaces:**
- Consumes: `awayWeeks` from Task 2.
- Produces: `.pbl-lane-count` holding the item count alone (absent at zero) and
  `.pbl-lane-away` holding the pill.

- [ ] **Step 1: Write the failing tests**

Rewrite the `describe('the band header’s readout')` cases in `test/view/resourceLanes.test.ts`
that assert the `N items / N absences` string. `laneCountOf` still returns
`.pbl-lane-count`'s text; add a helper beside it in `test/helpers/roadmap.ts`:

```ts
/** The away pill's text, or '' where the header draws none. */
export function laneAwayOf(lane: HTMLElement): string {
	return lane.querySelector('.pbl-lane-away')?.textContent ?? '';
}
```

The cases become:

```ts
	it('reports the items and the weeks away as two separate things', () => {
		const vault = countingVault([
			{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) },
			{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(11) },
		]);
		const harness = laneRoadmap(vault);
		const alice = lanesOf(harness.containerEl)[0];

		expect(laneCountOf(alice)).toBe('1 item');
		// The ended stretch is not counted — the filter is the whole reason the pill exists.
		expect(laneAwayOf(alice)).toBe('1 wk away');
	});

	it('drops the item count entirely at zero rather than reading a zero', () => {
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: dayFromToday(5), due: dayFromToday(9) },
		});
		const harness = laneRoadmap(vault);
		const bob = lanesOf(harness.containerEl)[1];

		expect(laneCountOf(bob)).toBe('');
		expect(laneAwayOf(bob)).toBe('1 wk away');
	});

	it('drops the pill when nothing is still to come', () => {
		const vault = countingVault([{ title: 'Over', start: dayFromToday(-20), target: dayFromToday(-10) }]);
		const harness = laneRoadmap(vault);

		expect(laneCountOf(lanesOf(harness.containerEl)[0])).toBe('1 item');
		expect(laneAwayOf(lanesOf(harness.containerEl)[0])).toBe('');
	});

	it('weights the pill up where the resource also holds work', () => {
		// A busy-and-away row is the loudest thing in the column, because it is the one a
		// planner has to do something about.
		const vault = countingVault([{ title: 'Ahead', start: dayFromToday(5), target: dayFromToday(9) }]);
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: dayFromToday(5), due: dayFromToday(9) },
		});
		const harness = laneRoadmap(vault);

		expect(lanesOf(harness.containerEl)[0].querySelector('.pbl-lane-away')?.className).toContain('pbl-lane-away-busy');
		expect(lanesOf(harness.containerEl)[1].querySelector('.pbl-lane-away')?.className).not.toContain('pbl-lane-away-busy');
	});
```

Also update the pre-existing `counts result bars on the header` (`'2 items'` / `''` for Bob,
who has none), `is never counted, and never shelved` (`''`), and the single assertions in
`test/view/resourceAbsences.test.ts` (`'1 item'`) and `test/view/contextCardWrites.test.ts`
(`'1 item'`). Task 2's stopgap left some of these saying something else — read them rather
than assuming.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/view/resourceLanes.test.ts`
Expected: FAIL — the header still writes one combined string.

- [ ] **Step 3: Split the readout**

In `renderLaneHead`, replace the single `.pbl-lane-count` span:

```ts
	if (lane.bars.length > 0) {
		lead.createSpan({ cls: 'pbl-lane-count', text: `${lane.bars.length} item${lane.bars.length === 1 ? '' : 's'}` });
	}
	renderAwayPill(lead, lane, ruler.today);
```

and replace `laneReadout` with:

```ts
/**
 * How long this resource is still away, as a pill beside their item count.
 *
 * **Weeks rather than a count of stretches**, which is what this reported until 2026-08-14:
 * two stretches is not a quantity a planner can act on, and three weeks is. `awayWeeks`
 * unions them, so a resource with two overlapping stretches is not away twice.
 *
 * Dropped entirely at zero, like the item count beside it. A roster row for someone with
 * nothing to say draws nothing rather than a column of zeroes — which is the whole of what
 * "one row per person" buys once the stretches move into the header.
 *
 * Weighted up when the resource ALSO holds work, because that row is the one a planner has
 * to do something about: away with nothing booked is information, away with four items
 * booked is a problem.
 */
function renderAwayPill(lead: HTMLElement, lane: ResourceLane, today: CivilDate): void {
	const weeks = awayWeeks(lane.absences, today);
	if (weeks === 0) return;
	const busy = lane.bars.length > 0 ? ' pbl-lane-away-busy' : '';
	lead.createSpan({ cls: `pbl-lane-away${busy}`, text: `${weeks} wk away` });
}
```

Swap the `awayWeeks` import in for whatever Task 2's stopgap left.

- [ ] **Step 4: Style the pill**

In `styles/lanes.css`:

```css
/* Beside the item count, and it does not shrink for the same reason the count does not: the
   resource NAME ellipsizes into whatever is left, which is one declaration instead of a third
   fit mechanism beside `columnFit` and `syncToolbarFit`. */
.pbl-lane-away {
	flex: 0 0 auto;
	white-space: nowrap;
	padding: 0 var(--size-2-2);
	border-radius: var(--radius-s);
	color: var(--text-muted);
	font-weight: var(--font-normal);
	font-size: var(--font-smaller);
}

/* Away AND booked — the row a planner has to act on, so it is the loudest thing in the
   column. Contrast rather than colour alone: the pill still reads with no hue at all. */
.pbl-lane-away-busy {
	background-color: var(--background-modifier-border);
	color: var(--text-normal);
}
```

- [ ] **Step 5: Run everything, the gate, and commit**

Run: `npx vitest run` then `npm run check`.

```bash
git add src/view/render/lanes.ts styles/lanes.css test/helpers/roadmap.ts test/view/resourceLanes.test.ts test/view/resourceAbsences.test.ts test/view/contextCardWrites.test.ts
git commit -m "Report a resource's items and their weeks away as two things"
```

---

### Task 7: the register, the fixture, and the gate

**Files:**
- Modify: `docs/requirements/Resource absences.md`,
  `docs/requirements/Showing a resources axis on the roadmap.md`,
  `docs/requirements/Folding a resource's band.md`,
  `docs/tests/suites/Smoke test the roadmap.md`, `CHANGELOG.md`, `vitest.config.mts`
- Test: `test/helpers/fixtures.ts`, `test/harness/harness.test.ts`

- [ ] **Step 1: Give the demo fixture an overlapping pair**

`demoVault()` has three absences and none of them overlap, so nothing in the repository
exercises packing. Add a fourth that shares days with Dana's running one:

```ts
	add('Dana has a training week', { type: 'Absence', assignee: 'Dana', start: '2026-08-12', due: '2026-08-18' });
```

and extend the comment above the block: a fourth, overlapping the offsite, so the harness
draws a two-sub-lane header — the case packing exists for.

`test/harness/harness.test.ts`'s absence-row count assertion is now about MARKS rather than
rows. Rewrite it to count `.pbl-lane-head .pbl-absence` and expect 4, with a comment saying
the rows became header marks on 2026-08-14.

- [ ] **Step 2: Reverse extension 4a**

In `docs/requirements/Resource absences.md`, replace 4a:

```markdown
- **4a — an absence overlaps another absence in the same row.** They PACK: the first
  sub-lane holds as many stretches as fit without sharing a day, the next takes what is
  left, and the header grows to hold every sub-lane. Nothing is hidden and nothing is
  merged — two stretches that share a day are two marks on two lines, exactly as they were
  when each had a row.

  **This reverses the original 4a** ("both draw, stacked; the row's own height grows rather
  than either one moving to avoid the other") and the acceptance criterion that said "with
  no lane-packing". The reason those gave was that "a packing rule is a second geometry to
  keep in step with the one the bars use", and what answers it is that this packing is
  narrower than the one refused: `packAbsences` returns `Absence[][]` and computes no pixel,
  runs over ABSENCES only and never over bars, and every bar is still placed by
  `barGeometry` — one geometry, and a grouping decided before it. What the old 4a was
  protecting survives in a sharper form: nothing moved aside for anything, and no stretch
  dropped or merged, at a third of the height.

  An absence overlapping a BAR is not this case and never was — the bar keeps its own row
  and the stretch shades it (4k).
```

Replace the acceptance criterion `Overlapping bars and absences in one row stack, with no
lane-packing.` with:

```markdown
- Overlapping stretches pack into sub-lanes inside one header, growing it; nothing is hidden
  or merged. A bar keeps its own row whatever crosses it.
```

- [ ] **Step 3: Amend 4k and add the header-track extension**

Amend 4k so it no longer names a line that exists: the wash still shades the band's work
rows, but the "named line" it contrasts itself with is now the header's own track.

Add:

```markdown
- **4n — a stretch is drawn in its resource's HEADER, not in a row of its own** (added
  2026-08-14). One row per person whatever they have. The title, the dates and the
  Edit/Delete menu move onto the mark itself, which is now the only route to them, so a
  `pointer-events: none` on a mark or a `stopPropagation` in its handler breaks the feature
  in two different ways. A drop still reaches the band because a mark is a CHILD of the
  header rather than a sibling drawing into it — the distinction
  [[An absence stretch is a dead spot in its own band]] records.

  **What this costs a screen reader, stated as a regression rather than a substitution.**
  Each stretch had a row carrying `<title> — unavailable <dates>` and `Assigned to <name>`.
  It now has neither: the header takes one `aria-description` listing every stretch, so
  three become one string with no structure and no way to move between them. Accepted
  because one-row-per-person is the point of the change and no per-stretch element can carry
  a name while the row it replaced is gone. The keyboard gap is unchanged, not widened — an
  absence row was never a keyboard stop either, and [[Keyboard and menu on the roadmap]]
  still owns closing it.
```

- [ ] **Step 4: Amend the readout paragraph, again**

The paragraph admitting the labelled readout says the count survives folding and is a filter
on today. Both still hold; what changes is the SHAPE. Rewrite its last sentences: the header
reports an item count (dropped at zero) and a weeks-away pill (dropped at zero, weighted up
when the resource also holds work), and record that `0 items` was reported for a few hours
on 2026-08-14 and was dropped because a roster of quiet rows reading zero is noise.

- [ ] **Step 5: The other two notes**

`docs/requirements/Showing a resources axis on the roadmap.md` — `## Where it lives` gains
the header track, the two-part readout, and `.pbl-lane-quiet`.

`docs/requirements/Folding a resource's band.md` — the load rail, and the refusal:

```markdown
**A model-driven fold default was asked for on 2026-08-14 and refused as INERT.** The
request was "a band with no work folds itself", which needs a second stored set beside
`collapsedLanes` — an explicit set of folded names cannot express "folded unless opened".
It buys nothing: once the stretches moved into the header's own track (4n), a lane with no
bars has nothing beneath its header, so `laneEntries` emits the identical list either way.
The default would have shown a chevron pointing right and cost a first load after upgrade
where every empty lane folded itself once, which reads as data loss. The check that keeps
this honest is in `test/view/resourceLanes.test.ts`: a lane with no work renders the same
rows folded and open.
```

- [ ] **Step 6: The changelog, folded rather than appended**

`CHANGELOG.md`'s `[Unreleased]` already carries the band-readout entry from this branch.
**Rewrite that entry rather than adding a second** — one user-visible change, not two — so it
describes what actually ships: one row per person, the weeks-away pill, packing, and the
days-lost report. The derived-name `### Changed` entry is untouched.

- [ ] **Step 7: The smoke suite**

Add rows in the file's existing shape for: the packed header at two and three sub-lanes; the
16% warm wash over a saturated bar in both schemes; whether `MIN_COST_LABEL_PX` is anywhere
near right at real zooms; whether the quiet lane's contrast step reads as quiet rather than
as disabled; and whether a screen reader makes anything of the header's concatenated stretch
description. All tagged **Never checked**.

- [ ] **Step 8: Run the gate, then the thresholds**

Run: `npm run check`. If the four measured coverage figures all exceed the current
thresholds, raise them and add a line to the comment block above them in the shape the
existing lines use. If they split across runs the way
`docs/issues/The coverage figure is not reproducible to a hundredth.md` records, **decline the
rise** and say so in the comment — that is the register's own standing policy and not a
judgement call to re-make.

- [ ] **Step 9: Commit**

```bash
npm run check
git add docs/requirements/ docs/tests/ CHANGELOG.md vitest.config.mts test/helpers/fixtures.ts test/harness/harness.test.ts
git commit -m "Record one row per resource, and the two decisions it reverses"
```

---

## Self-review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §1 the `max-params` constraint | Task 3, step 5 |
| §2 stretches into the header track | Task 3 |
| §2 the window widened from lanes | Task 3, step 4 |
| §2 the drop bubbling | Task 3, steps 1 and 5 |
| §3 `packAbsences` and one geometry | Tasks 2 and 3, step 6 |
| §4 the refused fold default | Task 4, step 1 (the check) + Task 7, step 5 |
| §4 the load rail | Task 4 |
| §4 quiet lanes | Task 4 |
| §5 the wash re-key | Task 5, step 3 |
| §5 the clash swatch and days lost | Task 5, step 4 |
| §5 the label's suppression rule | Task 5, step 4 (`clashCost`) |
| §5 the legend key | Task 5, step 5 |
| §5 one union primitive | Task 1 |
| §6 the readout and the pill | Task 6 |
| §6 the accessibility cost | Task 3, step 1 (the check) + Task 7, step 3 |
| §7 values | Tasks 3-6 CSS |
| §8 what this supersedes | Task 6 + Task 7, steps 4 and 6 |
| The register | Task 7 |
| Live-vault rows | Task 7, step 7 |

**Type consistency:** `mergeSpans` / `unionDays` (Task 1) are called by `daysLost` and
`awayWeeks` (Task 2) and by `renderLaneRail` (Task 4). `packAbsences` (Task 2) is called by
`renderLaneAbsences` (Task 3). `awayWeeks` (Task 2) is called by `renderAwayPill` (Task 6)
via Task 2's own stopgap. `daysLost` (Task 2) is called by `clashCost` (Task 5).
`renderLaneHead`'s four-parameter signature is set in Task 3 and read by Tasks 4 and 6.
`DrawnColors.daysLost` is added in Task 5 and read only there.

**Ordering constraints:** 1 → 2 → 3; 4, 5 and 6 all depend on 3 but not on each other; 7 is
last. Task 2 knowingly leaves a three-line stopgap in `laneReadout` that Task 6 removes —
flagged in both tasks, because a task that leaves a tree that does not compile is worse.

**One thing the plan cannot settle:** `MIN_COST_LABEL_PX` and every percentage in the wash
are pixel judgements against real text at real zooms. They are named constants with a stated
starting value, and the smoke-suite rows are where they get decided.
