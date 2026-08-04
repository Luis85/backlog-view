# A writable timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the roadmap's dated axis writable — drag a shelf card onto the grid to schedule it, slide a bar, drag its ends, drop it back on the shelf to unschedule — with discrete zoom, a jump-to-today control, and a frame that scrolls inside itself.

**Architecture:** Four layers, outermost last. `domain/timeline.ts` gains a scale record and the day arithmetic every gesture is made of; a new `domain/bars.ts` owns what the dated axis makes of an item and what a gesture may take hold of. `storage/frontmatter.ts` becomes the place a date write is *decided* — against the live value, merged into the note's own datetime shape — and reports back what it changed. `view/host.ts` gains one `performScheduleMove`, which the drag, the modal and the menu all call. `view/interactions/timelineDrag.ts` (new) turns pointer positions into plans and hands them to it.

**Tech Stack:** TypeScript, esbuild, vitest (node + jsdom environments), ESLint with type-aware rules, fallow, `@atlaskit/pragmatic-drag-and-drop`.

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`. Each may reach anything below it and nothing above. Enforced by per-directory `no-restricted-imports` in `eslint.config.mjs` — a violation fails `npm run lint`.
- **400-line maximum** per file in `src/` and per partial in `styles/`, **450** in `test/`. Enforced by lint and by `styles-assemble.mjs`. Two files are already at the ceiling and nothing in this plan may grow them: `src/view/interactions/menu.ts` (399) and `src/domain/roadmap.ts` (391).
- **Never write frontmatter outside `storage/frontmatter.ts`** (`applyWrites` / `applyRestores` / `createBacklogItem`). `no-restricted-syntax` bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `src/storage/`.
- **Every write goes through the gate** (`view/writeGate.ts`): `applySafely` for forward batches, `undoLast` for the replay. No task may call `applyWrites` from `view/`.
- **The context-row rule:** an `outsideFilter` row is never a write target, never a ranking peer, never a source of anything derived. Every new entry point in this plan is subject to it, and Task 14 is where that is checked.
- **`showAtMouseEvent` is banned outside `src/view/interactions/menu.ts`.** Menus opened from a click go through `showMenuForClick`.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Every "run it to verify it fails" step below is mandatory, not decorative.
- **Coverage thresholds only ever go up** (`vitest.config.mts`: statements 97.55, branches 93.1, functions 98, lines 97). Do not lower one to make a task pass.
- **Definition of done:** `npm run check` — build, lint, coverage-thresholded tests, fallow, docs register. All five, before every commit.
- **Branch:** `claude/next-product-increment-ujxye4`. Do not push to another.
- **Spec:** `docs/superpowers/specs/2026-08-03-writable-timeline-design.md`.

## Two places this plan narrows the spec

Both are written here rather than discovered mid-task, because a plan that quietly
disagrees with its spec is the defect the spec itself keeps naming.

1. **The window's dates are scale-free; the header CELLS clip.** The spec says both
   "`timelineWindow` aligns its bounds to the scale's unit" and "its bounds are computed
   without reference to the scale, so the window covers the **same dates at every zoom**
   and header cells clip where it ends". Those cannot both hold: a unit-aligned window
   starts on a Monday at week zoom and the first of a month at month zoom, which is a
   different stretch of calendar per scale. The longer paragraph states its reasoning
   ("rounding the cap out to whole cells … would put the scale back into the answer by
   the side door") and carries the guarantee the acceptance criteria rest on, so it
   wins: `timelineWindow` keeps its month-padded bounds and its clamp, and
   `timelineCells` builds the cells for a scale, clipping the first and last where the
   window ends. That makes "the same spans place at all three zooms" one assertion.
2. **`barHolds` lives in `src/domain/bars.ts`, not `src/domain/timeline.ts`.**
   `domain/model.ts` imports `timeline.ts` (`earliest`, `latest`, `reversedSpan`), so
   `timeline.ts` may not import `BacklogItem` — a predicate over an item cannot live
   there without a cycle. `bars.ts` is where the dated axis's per-item decisions move
   anyway (Task 2), it is the module that PRODUCES `TimelineBar`, and it keeps
   `roadmap.ts` under the 400-line cap.

---

## File Structure

| File | Change |
| --- | --- |
| `src/domain/timeline.ts` | Modify — the scale record, `timelineCells`, `addDays`, `dayAt`, `cellSpan`, the day budget |
| `src/domain/itemTypes.ts` | Modify — `PlacementEnd`, `placementEnds` (moved in from `view/interactions/plan.ts`) |
| `src/domain/bars.ts` | **Create** — `TimelineBar`, `ShelfCard`, `placeItem`, `deriveBars`, `barHolds` |
| `src/domain/roadmap.ts` | Modify — the dated half moves out; `buildRoadmap` calls `deriveBars` |
| `src/domain/writePlan.ts` | Modify — `AxisWrite.ends`, `computeScheduleWrites` stops deciding from the model |
| `src/storage/frontmatter.ts` | Modify — the datetime merge, the live-value decision, the two refusals, `WriteOutcome` |
| `src/storage/collapseStore.ts` | Modify — `zoom` on the snapshot, validated against the scale ids |
| `src/view/collapseState.ts` | Modify — the `zoom` field, its accessor, restore and flush |
| `src/view/writeGate.ts` | Modify — `applySafely` returns the outcome |
| `src/view/host.ts` | Modify — `performScheduleMove`, `zoom`/`setZoom`, `shelfOpen`/`setShelfOpen`, `RoadmapSnapshot`, `ScrollBox` |
| `src/view/backlogView.ts` | Modify — the three new host methods, the axis class, the capture-before-empty |
| `src/view/collapseState.ts` | (above) |
| `src/view/interactions/plan.ts` | Modify — `placementEnds` imported, the two menu paths routed through the host |
| `src/view/interactions/cardDrag.ts` | Modify — the hold on the payload, `wirePositionalTarget`, `announceScheduleMove` |
| `src/view/interactions/timelineDrag.ts` | **Create** — the overlay, the shelf drop, the bar holds, the preview |
| `src/view/interactions/keyboard.ts` | Modify — the navigable set narrows to what compaction leaves |
| `src/view/render/timeline.ts` | Modify — draws at a scale; the drop overlay and the content wrapper |
| `src/view/render/roadmap.ts` | Modify — `dnd` on both axes, the shelf's removal supplied by the axis, the scroll boxes |
| `src/view/render/projections.ts` | Modify — `captureScroll`, `restoreScroll` over every band by identity |
| `src/view/render/toolbar.ts` | Modify — the zoom picker, jump-to-today, the shelf toggle and `syncShelfToggle` |
| `styles/timeline.css` | Modify — the two-element scroll box, the overlay, the ghost bar, the grips |
| `styles/roadmap.css` | Modify — the dated frame's band rule |
| `test/domain/timeline.test.ts` | Modify — the scale relation, `dayAt` as the inverse, the budget as a guarantee |
| `test/domain/bars.test.ts` | **Create** — `placeItem`, `barHolds` |
| `test/domain/itemTypes.test.ts` | Modify — `placementEnds` per type |
| `test/domain/writePlanAxis.test.ts` | Modify — the planner claims nothing about the note |
| `test/storage/frontmatter.test.ts` | Modify — the merge, the live decision, both refusals, the verdict |
| `test/storage/collapseStore.test.ts` | Modify — `zoom` validated and round-tripped |
| `test/view/roadmapFrame.test.ts` | Modify — the frame's bands and the scroll boxes |
| `test/view/timelineDrag.test.ts` | **Create** — every gesture, driven against a panned grid |
| `test/view/timelineZoom.test.ts` | **Create** — the picker, persistence, the date anchor, the shelf toggle |
| `test/view/contextCardWrites.test.ts` | Modify — the timeline's entry points |
| `docs/requirements/*.md` | Modify — six register corrections and closures (Task 15) |
| `docs/issues/Smoke test the writable timeline.md` | **Create** |
| `docs/README.md` | Modify — the roadmap epic's paragraph gains this increment |

---

### Task 1: The scale record, the day arithmetic, the day budget

**Files:**
- Modify: `src/domain/timeline.ts`
- Test: `test/domain/timeline.test.ts`

**Interfaces:**
- Consumes: `CivilDate`, `daysInMonth` from `src/domain/noteFields.ts`; the existing
  `daysBetween`, `barGeometry`, `DateSpan`, `BarGeometry`, `formatCivil`.
- Produces:
  - `export type ScaleId = 'week' | 'month' | 'quarter'`
  - `export interface TimelineScale { id: ScaleId; dayPx: number; unit: ScaleId; lineWidth: number }`
  - `export const SCALES: TimelineScale[]` — week/month/quarter, in that order
  - `export const DEFAULT_SCALE_ID: ScaleId = 'month'`
  - `export function scaleFor(id: string | null): TimelineScale`
  - `export const MIN_BAR_PX = 4`
  - `export const MAX_TIMELINE_DAYS = 1830`
  - `export interface TimelineWindow { start: CivilDate; days: number }` — `months` is gone
  - `export interface TimelineCell { label: string; days: number }`
  - `export function timelineCells(window: TimelineWindow, scale: TimelineScale): TimelineCell[]`
  - `export function addDays(date: CivilDate, count: number): CivilDate`
  - `export function dayAt(window: TimelineWindow, scale: TimelineScale, x: number): CivilDate`
  - `export function cellSpan(scale: TimelineScale, day: CivilDate): number`
  - `DAY_PX` and `MAX_TIMELINE_MONTHS` are REMOVED. `src/view/render/timeline.ts` is the
    only importer of `DAY_PX`; leave it broken until Task 7 — `npm run build` fails
    between the two, which is why they are one commit (Step 7 below).

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/timeline.test.ts`:

```ts
describe('the scale table', () => {
	it('is strictly denser at each step, and every scale can hold two marks in a day', () => {
		// Stated as a RELATION over the table rather than as three numbers, because this
		// is the third revision of the same constraint — first the nudge, then the bar
		// floor, now the line widths — and each earlier one fixed the instance while
		// leaving the rule unwritten. [[A milestone line across the plan]] extension 1d
		// requires today's line and a milestone dated today to both draw and not merge,
		// so a day must be at least as wide as both marks side by side.
		for (const scale of SCALES) {
			expect(scale.dayPx, `${scale.id} must fit two marks`).toBeGreaterThanOrEqual(2 * scale.lineWidth);
		}
		const widths = SCALES.map((s) => s.dayPx);
		expect(widths).toEqual([...widths].sort((a, b) => b - a));
		expect(new Set(widths).size).toBe(widths.length);
	});

	it('keeps month as the shipped density, so the default view does not move', () => {
		expect(scaleFor('month').dayPx).toBe(4);
		expect(scaleFor(null).id).toBe(DEFAULT_SCALE_ID);
		expect(scaleFor('fortnight').id).toBe(DEFAULT_SCALE_ID);
	});
});

describe('day arithmetic', () => {
	it('steps whole days across a month end and a leap day', () => {
		expect(addDays({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 1 });
		expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
		expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
		expect(addDays({ year: 2026, month: 8, day: 4 }, 0)).toEqual({ year: 2026, month: 8, day: 4 });
	});

	it('reads a pixel offset back as the day barGeometry drew there — at every scale', () => {
		// dayAt is the exact inverse of the daysBetween(window.start, date) that
		// barGeometry already computes, so px↔date is one rule stated in two
		// directions rather than two rules that can drift apart. Tested as the round
		// trip rather than against hand-computed pixels, because the round trip is the
		// property the gestures rest on.
		const window = timelineWindow([{ start: { year: 2026, month: 8, day: 1 }, target: null }], TODAY);
		for (const scale of SCALES) {
			for (const offset of [0, 17, 200, window.days - 1]) {
				const date = addDays(window.start, offset);
				const geometry = barGeometry(window, { start: date, target: date });
				expect(dayAt(window, scale, geometry.startDay * scale.dayPx)).toEqual(date);
			}
		}
	});

	it('clamps a pointer outside the window to its edges rather than inventing a date', () => {
		const window = timelineWindow([], TODAY);
		expect(dayAt(window, scaleFor('month'), -500)).toEqual(window.start);
		expect(dayAt(window, scaleFor('month'), 10_000_000)).toEqual(addDays(window.start, window.days - 1));
	});

	it('gives the shelf drop a duration per zoom: a week, the month, the quarter', () => {
		// cellSpan is a DURATION, not a snapping unit — decision 1 made the snap a day
		// at every zoom, and this is only what a drop with no duration of its own
		// defaults to.
		const august = { year: 2026, month: 8, day: 13 };
		expect(cellSpan(scaleFor('week'), august)).toBe(7);
		expect(cellSpan(scaleFor('month'), august)).toBe(31);
		expect(cellSpan(scaleFor('month'), { year: 2026, month: 2, day: 3 })).toBe(28);
		// Q3 2026: July 31 + August 31 + September 30.
		expect(cellSpan(scaleFor('quarter'), august)).toBe(92);
	});
});

describe('the window and its header cells', () => {
	it('covers the same dates at every zoom', () => {
		// The backstop is a TIME budget, not a cell count. Tested as the guarantee
		// [[Zoom and the today marker]] states — at every zoom the same results place
		// and only the granularity changes — rather than as a number, which a test
		// naming sixty of anything would not catch being re-expressed per cell.
		const spans = [
			{ start: { year: 2024, month: 1, day: 5 }, target: { year: 2027, month: 11, day: 30 } },
		];
		const window = timelineWindow(spans, TODAY);
		for (const scale of SCALES) {
			const cells = timelineCells(window, scale);
			expect(cells.reduce((sum, cell) => sum + cell.days, 0)).toBe(window.days);
			expect(barGeometry(window, spans[0]).outside).toBe(false);
		}
	});

	it('clips the first and last cell at the window rather than growing the window', () => {
		const window = timelineWindow([], TODAY);
		for (const scale of SCALES) {
			const cells = timelineCells(window, scale);
			expect(cells.every((cell) => cell.days > 0)).toBe(true);
			expect(cells.reduce((sum, cell) => sum + cell.days, 0)).toBe(window.days);
		}
	});

	it('bounds a typo’d year to the day budget around today', () => {
		const window = timelineWindow([{ start: { year: 20260, month: 8, day: 1 }, target: null }], TODAY);
		expect(window.days).toBeLessThanOrEqual(MAX_TIMELINE_DAYS);
		expect(daysBetween(window.start, TODAY)).toBeGreaterThanOrEqual(0);
		expect(daysBetween(TODAY, addDays(window.start, window.days - 1))).toBeGreaterThanOrEqual(0);
	});
});
```

Add to that file's imports, and define `TODAY` beside the existing fixtures if the file
does not already have one:

```ts
import {
	addDays,
	barGeometry,
	cellSpan,
	dayAt,
	daysBetween,
	DEFAULT_SCALE_ID,
	MAX_TIMELINE_DAYS,
	SCALES,
	scaleFor,
	timelineCells,
	timelineWindow,
} from '../../src/domain/timeline';

const TODAY = { year: 2026, month: 8, day: 4 };
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/domain/timeline.test.ts`
Expected: FAIL — `SCALES`, `scaleFor`, `addDays`, `dayAt`, `cellSpan`, `timelineCells`,
`MAX_TIMELINE_DAYS` and `DEFAULT_SCALE_ID` are not exported.

- [ ] **Step 3: Add the scale record**

In `src/domain/timeline.ts`, replace `export const DAY_PX = 4;` with:

```ts
/** Which discrete density the grid draws at. Three scales, never a continuous zoom. */
export type ScaleId = 'week' | 'month' | 'quarter';

/**
 * One density of the grid. `dayPx` is the only thing that scales — a length in DAYS is
 * multiplied by it and a length in PIXELS is not, and mixing the two is what a zoom
 * control turns into a bug.
 *
 * `lineWidth` is here rather than in the stylesheet because it is not free: today's
 * line and a milestone dated today must both draw and not merge
 * ([[A milestone line across the plan]] extension 1d), and the milestone's line steps
 * aside by exactly one line width inside the same day. So a day has to be at least as
 * wide as both marks together — `dayPx >= 2 * lineWidth`, for every scale in this
 * table, which `test/domain/timeline.test.ts` asks of the table itself rather than of
 * three hand-picked cases. Quarter cannot satisfy it at 2px marks and narrows them
 * instead of losing one.
 */
export interface TimelineScale {
	id: ScaleId;
	dayPx: number;
	/** The header cell this scale draws — the unit, never the snapping grid. */
	unit: ScaleId;
	/** Width in pixels of a full-height mark (today, a milestone) at this density. */
	lineWidth: number;
}

/** Densest first. `month` is exactly what shipped, so the default view does not move. */
export const SCALES: TimelineScale[] = [
	{ id: 'week', dayPx: 16, unit: 'week', lineWidth: 2 },
	{ id: 'month', dayPx: 4, unit: 'month', lineWidth: 2 },
	{ id: 'quarter', dayPx: 2, unit: 'quarter', lineWidth: 1 },
];

export const DEFAULT_SCALE_ID: ScaleId = 'month';

/** The scale a stored or picked id names; the default for anything unrecognised. */
export function scaleFor(id: string | null): TimelineScale {
	return SCALES.find((scale) => scale.id === id) ?? SCALES.find((scale) => scale.id === DEFAULT_SCALE_ID)!;
}

/**
 * The narrowest a bar may be drawn, in PIXELS — its own constant rather than `dayPx`,
 * which at quarter zoom would be one pixel: a stated plan rendered as an invisible one.
 * This is what [[Zoom and the today marker]] extension 2a means by "the minimum
 * drawable width". The dates are the fact and the pixels are the zoom's, but a fact
 * drawn at zero width has stopped being reported.
 */
export const MIN_BAR_PX = 4;
```

- [ ] **Step 4: Turn the month backstop into a day budget**

Replace `MAX_TIMELINE_MONTHS` and the `TimelineMonth` / `TimelineWindow` declarations:

```ts
/**
 * Backstop on how much CALENDAR the grid will draw — a time budget, never a cell
 * count. A cell count would make the reachable calendar depend on the zoom (sixty
 * weeks is fourteen months; sixty quarters is fifteen years), so a two-year plan
 * visible at month zoom would clip to edge indicators at week zoom — contradicting
 * the guarantee [[Zoom and the today marker]] states outright, that at every zoom the
 * same results place and only the granularity changes. Roughly the sixty months this
 * already meant.
 */
export const MAX_TIMELINE_DAYS = 1830;

/**
 * The dated grid: every placed date and today, padded a month each side, bounded by
 * the day budget. Computed WITHOUT reference to the scale, so it covers the same dates
 * at every zoom; the header cells clip against it rather than the window growing out
 * to whole cells of whichever scale happens to be showing.
 */
export interface TimelineWindow {
	start: CivilDate;
	/** Total days the grid covers. */
	days: number;
}

/** One header cell: a unit of the active scale, clipped where the window ends. */
export interface TimelineCell {
	label: string;
	days: number;
}
```

Then rewrite `timelineWindow` to clamp in days and drop the month list:

```ts
export function timelineWindow(spans: DateSpan[], today: CivilDate): TimelineWindow {
	let min = today;
	let max = today;
	for (const span of spans) {
		for (const date of [span.start, span.target]) {
			if (date === null) continue;
			if (daysBetween(min, date) < 0) min = date;
			if (daysBetween(max, date) > 0) max = date;
		}
	}
	const first = addMonths({ year: min.year, month: min.month }, -1);
	const last = addMonths({ year: max.year, month: max.month }, 1);
	const start: CivilDate = { year: first.year, month: first.month, day: 1 };
	const end = addDays({ year: last.year, month: last.month, day: 1 }, daysInMonth(last.year, last.month) - 1);
	const days = daysBetween(start, end) + 1;
	if (days <= MAX_TIMELINE_DAYS) return { start, days };
	// Clamped around TODAY, in days: the reader's own mark stays in view and the far
	// bar clips to the edge, styled as running beyond it. The clamp is not rounded out
	// to whole cells — that would put the scale back into the answer by the side door,
	// since a quarter boundary reaches further than a week one, and the same bar would
	// render normally at one zoom and as an edge indicator at another.
	return { start: addDays(today, -Math.floor(MAX_TIMELINE_DAYS / 2)), days: MAX_TIMELINE_DAYS };
}
```

- [ ] **Step 5: Add the three pure functions and the cells**

```ts
/** Whole-day civil arithmetic — the step every slide and resize is made of. */
export function addDays(date: CivilDate, count: number): CivilDate {
	const moved = new Date(utc(date) + count * 86_400_000);
	return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

/**
 * The day a pixel offset inside the grid names, clamped into the window. The exact
 * inverse of the `daysBetween(window.start, date)` that `barGeometry` computes, so
 * px→date and date→px are one rule stated in two directions rather than two rules that
 * can drift apart. A drop writes the day under the pointer at EVERY zoom: the day is
 * the finest unit the data model has, and coarsening a date because the reader zoomed
 * out is the silent rewrite decision 1 exists to refuse.
 */
export function dayAt(window: TimelineWindow, scale: TimelineScale, x: number): CivilDate {
	const day = Math.min(Math.max(Math.floor(x / scale.dayPx), 0), window.days - 1);
	return addDays(window.start, day);
}

/**
 * The whole unit `day` falls in, in days — the default DURATION a shelf drop takes
 * when the item arrives with none of its own. Used by that one gesture and by nothing
 * else: it is not a snapping unit, and no gesture that already has a date consults it.
 */
export function cellSpan(scale: TimelineScale, day: CivilDate): number {
	if (scale.unit === 'week') return 7;
	if (scale.unit === 'month') return daysInMonth(day.year, day.month);
	const first = quarterFirstMonth(day.month);
	return [0, 1, 2].reduce((sum, i) => sum + daysInMonth(day.year, first + i), 0);
}

/** The header cells of one scale across the window, clipped at both edges. */
export function timelineCells(window: TimelineWindow, scale: TimelineScale): TimelineCell[] {
	const cells: TimelineCell[] = [];
	for (let day = 0; day < window.days; ) {
		const date = addDays(window.start, day);
		const offset = unitOffset(scale, date);
		const length = Math.min(cellSpan(scale, date) - offset, window.days - day);
		cells.push({ label: cellLabel(scale, addDays(date, -offset)), days: length });
		day += length;
	}
	return cells;
}

/** How far into its own unit a date sits — 0 when the cell starts there. */
function unitOffset(scale: TimelineScale, date: CivilDate): number {
	if (scale.unit === 'week') return isoWeekday(date);
	if (scale.unit === 'month') return date.day - 1;
	return daysBetween({ year: date.year, month: quarterFirstMonth(date.month), day: 1 }, date);
}

/** Monday is 0 — ISO 8601, one boundary on every device rather than a locale guess. */
function isoWeekday(date: CivilDate): number {
	return (new Date(utc(date)).getUTCDay() + 6) % 7;
}

function quarterFirstMonth(month: number): number {
	return month - ((month - 1) % 3);
}

/** The cell's name, taken from the unit's own first day so a clipped cell still names it. */
function cellLabel(scale: TimelineScale, unitStart: CivilDate): string {
	if (scale.unit === 'week') return `${unitStart.day} ${MONTH_LABELS[unitStart.month - 1]}`;
	if (scale.unit === 'month') return `${MONTH_LABELS[unitStart.month - 1]} ${unitStart.year}`;
	return `Q${Math.floor((unitStart.month - 1) / 3) + 1} ${unitStart.year}`;
}
```

`monthsBetween` becomes unused once the window stops iterating months — delete it, or
`npm run analyze` (fallow) fails on dead code.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/domain/timeline.test.ts`
Expected: PASS. `npx vitest run test/domain` also passes — `roadmap.test.ts` and
`model.test.ts` use `timelineWindow` only through `barGeometry`.

- [ ] **Step 7: Point the renderer at a scale so the build compiles**

`src/view/render/timeline.ts` imports `DAY_PX`, which no longer exists, and reads
`window.months`, which no longer exists. Task 7 rewrites that module properly; this
step is the minimum that restores `npm run build` so this task can be committed on its
own. In `renderTimeline`, take a `scale: TimelineScale` parameter (threaded from
`renderRoadmap`, which for now passes `scaleFor(null)`), replace every `DAY_PX` with
`scale.dayPx`, and replace the `window.months` loop in `renderMonthHeader` with
`timelineCells(window, scale)` using `cell.days` and `cell.label`.

- [ ] **Step 8: Run the full gate**

Run: `npm run check`
Expected: all five steps pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain/timeline.ts src/view/render/timeline.ts src/view/render/roadmap.ts test/domain/timeline.test.ts
git commit -m "Give the grid three densities and the day arithmetic every gesture needs"
```

---

### Task 2: `placementEnds` moves down, and `bars.ts` owns the dated axis

**Files:**
- Modify: `src/domain/itemTypes.ts`
- Create: `src/domain/bars.ts`
- Modify: `src/domain/roadmap.ts` (the dated half moves out)
- Modify: `src/view/interactions/plan.ts` (imports rather than declares)
- Test: `test/domain/itemTypes.test.ts`, `test/domain/bars.test.ts` (create)

**Interfaces:**
- Consumes: `TimelineScale`, `DateSpan`, `reversedSpan`, `daysBetween` from Task 1.
- Produces:
  - `export type PlacementEnd = 'start' | 'target'` (itemTypes.ts)
  - `export function placementEnds(typeName: string | null): PlacementEnd[]` (itemTypes.ts)
    — takes the TYPE, not the item, so `storage/` can ask it of the live note without
    reaching into `view/`
  - `export interface TimelineBar { item; span; inferredStart; inferredEnd }` (bars.ts, moved)
  - `export interface ShelfCard { item; reason }` (bars.ts, moved)
  - `export interface StatedEnds { start: FieldReading<CivilDate>; target: FieldReading<CivilDate> }`
  - `export function statedEnds(item: BacklogItem): StatedEnds`
  - `export function withoutEnds(stated: StatedEnds, ends: PlacementEnd[]): StatedEnds`
  - `export type Placement = { kind: 'bar'; bar: TimelineBar } | { kind: 'shelf'; reason: string | null }`
  - `export function placeItem(item: BacklogItem, stated: StatedEnds): Placement`
  - `export interface DatedAxis { bars: TimelineBar[]; shelf: ShelfCard[]; context: BacklogItem[] }`
  - `export function deriveBars(rows: BacklogItem[]): DatedAxis`
  - `export type BarHold = 'body' | 'start' | 'end'`
  - `export function barHolds(item: BacklogItem, settings: BacklogSettings, bar: TimelineBar): BarHold[]`
  - `export const UNSCHEDULED_LABEL = 'Unscheduled'`

`roadmap.ts` re-exports nothing: every importer of `TimelineBar` / `ShelfCard`
(`view/render/timeline.ts`, `view/render/roadmap.ts`, `test/*`) is repointed at
`bars.ts`. A re-export would be a second place the type appears to live.

- [ ] **Step 1: Write the failing tests for `placementEnds`**

Append to `test/domain/itemTypes.test.ts`:

```ts
describe('placementEnds', () => {
	it('gives a work item both ends and a marker its target alone', () => {
		expect(placementEnds('PBI')).toEqual(['start', 'target']);
		expect(placementEnds('Bug')).toEqual(['start', 'target']);
		expect(placementEnds(null)).toEqual(['start', 'target']);
		// The type is the stronger statement: a start a milestone merely ignores is not
		// a date any hand may write or delete.
		expect(placementEnds('Milestone')).toEqual(['target']);
		expect(placementEnds('milestone')).toEqual(['target']);
	});

	it('answers about a TYPE, not an item, so the writer can ask it of the live note', () => {
		// The writer decides against what the note currently says — including what type
		// it currently is — so this predicate may not take a BacklogItem. A signature
		// test rather than a behaviour one, because the signature is the invariant.
		const ends: PlacementEnd[] = placementEnds('Milestone');
		expect(ends).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/itemTypes.test.ts`
Expected: FAIL — `placementEnds` is not exported from `src/domain/itemTypes.ts`.

- [ ] **Step 3: Move `placementEnds` into `itemTypes.ts`**

Append to `src/domain/itemTypes.ts`:

```ts
/** The two ends a dated placement can act on, in the order every entry asks for them. */
export type PlacementEnd = 'start' | 'target';

const BOTH_ENDS: PlacementEnd[] = ['start', 'target'];

/**
 * Which ends a placement acts on for this TYPE. A milestone answers for its target
 * alone — the type states *point* as strongly as a missing key does, and a start it
 * merely ignores is not a date any hand may write or delete.
 *
 * Stated per type rather than per control, so every path inherits the narrowing by
 * asking rather than by restating it: the row's Schedule and Unschedule, the shelf
 * drop, the body slide, both grips, and — since this takes a type name and not an item
 * — the WRITER, which has to decide against what the note currently says. It lives
 * here rather than in `view/` for exactly that last reason: `storage/` may not reach
 * upward, and a second copy is the one that would drift.
 */
export function placementEnds(typeName: string | null): PlacementEnd[] {
	return isMarkerType(typeName) ? ['target'] : [...BOTH_ENDS];
}
```

In `src/view/interactions/plan.ts`, delete the local `BOTH_ENDS` and `placementEnds`,
import the shared one, and call it with the type:

```ts
import { isMarkerType, placementEnds } from '../../domain/itemTypes';
```

`canSchedule`, `carriesDates`, `scheduleFields` and `unschedule` each become
`placementEnds(item.typeName)`. The `isMarkerType` import stays only if the file still
uses it directly; drop it from the import list if lint reports it unused.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/domain/itemTypes.test.ts test/view/menu.test.ts test/view/plan.test.ts`
Expected: PASS — the menu's milestone narrowing is unchanged, now asked of the type.

- [ ] **Step 5: Write the failing tests for `bars.ts`**

Create `test/domain/bars.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { buildModel } from '../../src/domain/model';
import { resolveSettings } from '../../src/domain/settings';
import { FakeViewConfig } from '../helpers/vault';
import { barHolds, placeItem, statedEnds, withoutEnds } from '../../src/domain/bars';

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function model(vault: FakeVault, values: Record<string, unknown> = DATE_AXIS) {
	const settings = resolveSettings(new FakeViewConfig(values));
	return { model: buildModel(vault.app, vault.entries(), settings), settings };
}

function itemFor(vault: FakeVault, path: string, values: Record<string, unknown> = DATE_AXIS) {
	const built = model(vault, values);
	const item = built.model.byPath.get(path);
	if (!item) throw new Error(`no item at ${path}`);
	return { item, settings: built.settings };
}

describe('placeItem', () => {
	it('answers bar or shelf from the ends it is GIVEN, not from the note', () => {
		// The preview asks this with the ends a removal would leave, and `deriveBars`
		// asks it with the ends the note states. One function, so the indicator before
		// a drop and the placement after it cannot disagree — the register's own
		// "the checkmark is asked of the plan" rule, reaching a third surface.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' }, parentLink: 'Parent' });
		const { item } = itemFor(vault, 'Parent.md');

		expect(placeItem(item, statedEnds(item)).kind).toBe('bar');
		const left = placeItem(item, withoutEnds(statedEnds(item), ['start', 'target']));
		expect(left.kind).toBe('bar');
		// Its own dates gone, the descendants still supply a span: it keeps a bar,
		// inferred, and the shelf preview would be a lie.
		if (left.kind !== 'bar') throw new Error('unreachable');
		expect(left.bar.inferredStart).toBe(true);
		expect(left.bar.span.start).toEqual({ year: 2026, month: 8, day: 10 });
	});

	it('shelves a parent whose whole subtree is dateless', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
		const { item } = itemFor(vault, 'Parent.md');

		expect(placeItem(item, withoutEnds(statedEnds(item), ['start'])).kind).toBe('shelf');
	});

	it('shelves a marker whose target goes, however stale a start it keeps', () => {
		// A marker never reaches inferSpan at all: placeMarker ignores the start and
		// shelves on an absent target. A comparison written beside the placement rules
		// would predict a bar here, which is why the preview asks this function.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { item } = itemFor(vault, 'Ship.md');

		const left = placeItem(item, withoutEnds(statedEnds(item), ['target']));
		expect(left.kind).toBe('shelf');
		if (left.kind !== 'shelf') throw new Error('unreachable');
		expect(left.reason).toBeNull();
	});

	it('shelves an unreadable or reversed pair with its reason, before any inference', () => {
		const vault = new FakeVault();
		vault.addFile('Broken.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon', target: '2026-08-01' } });
		vault.addFile('Backwards.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-31', target: '2026-08-01' } });

		expect(placeItem(itemFor(vault, 'Broken.md').item, statedEnds(itemFor(vault, 'Broken.md').item))).toEqual({
			kind: 'shelf',
			reason: 'Unreadable start date',
		});
		const backwards = itemFor(vault, 'Backwards.md').item;
		expect(placeItem(backwards, statedEnds(backwards))).toEqual({
			kind: 'shelf',
			reason: 'Target date precedes the start date',
		});
	});
});

describe('barHolds', () => {
	function holdsFor(frontmatter: Record<string, unknown>, values = DATE_AXIS) {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { order: 10, ...frontmatter } });
		const { item, settings } = itemFor(vault, 'Item.md', values);
		const placement = placeItem(item, statedEnds(item));
		if (placement.kind !== 'bar') throw new Error('expected a bar');
		return barHolds(item, settings, placement.bar);
	}

	it('offers body and both grips on a stated pair', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01', target: '2026-08-10' }).sort()).toEqual([
			'body',
			'end',
			'start',
		]);
	});

	it('offers the grip on an OPEN end — that grip is how the missing date gets written', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01' }).sort()).toEqual(['body', 'end', 'start']);
	});

	it('withholds every grip on an unconfigured key', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01' }, { startProperty: 'note.start', targetProperty: '' })).toEqual(
			['start', 'body'].sort(),
		);
	});

	it('gives a marker the body alone: a point has no duration to resize', () => {
		expect(holdsFor({ type: 'Milestone', target: '2026-09-30' })).toEqual(['body']);
	});

	it('withholds a marker’s hold entirely where its target key is unconfigured', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, target: '2026-09-30' } });
		const { item, settings } = itemFor(vault, 'Ship.md', { startProperty: 'note.start', targetProperty: '' });
		// With no target property there is no bar either, so the shelf card is what a
		// gesture would have to grip — and it offers nothing. Asserted through the
		// placement so the two answers cannot disagree.
		expect(placeItem(item, statedEnds(item)).kind).toBe('shelf');
		expect(barHolds(item, settings, { item, span: { start: null, target: null }, inferredStart: false, inferredEnd: false })).toEqual([]);
	});

	it('an inferred END withholds the body hold too, not only its own grip', () => {
		// Extension 1c: sliding a bar half-anchored to its children is a resize wearing
		// a slide's cursor. Watch this one fail with `holds.push('body')` unguarded.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' }, parentLink: 'Parent' });
		const { item, settings } = itemFor(vault, 'Parent.md');
		const placement = placeItem(item, statedEnds(item));
		if (placement.kind !== 'bar') throw new Error('expected a bar');

		expect(placement.bar.inferredEnd).toBe(true);
		expect(barHolds(item, settings, placement.bar)).toEqual(['start']);
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run test/domain/bars.test.ts`
Expected: FAIL — `src/domain/bars.ts` does not exist.

- [ ] **Step 7: Create `src/domain/bars.ts`**

Move `TimelineBar`, `ShelfCard`, `deriveBars`, `placeMarker`, `keepsOrder` and
`inferSpan` out of `src/domain/roadmap.ts` verbatim (comments included — they are the
record of why each rule is where it is), then restructure the top of the walk:

```ts
import { isMarkerType, PlacementEnd, placementEnds } from './itemTypes';
import { BacklogItem } from './model';
import { absentReading, CivilDate, FieldReading } from './noteFields';
import { BacklogSettings, optionalKeyFor } from './settings';
import { DateSpan, daysBetween, reversedSpan } from './timeline';

/**
 * What the DATED axis makes of an item: the bar it draws, the shelf card it becomes,
 * and what a gesture may take hold of. Pure, like everything under `domain/` — the
 * grid is `view/render/timeline.ts`'s and the gestures are
 * `view/interactions/timelineDrag.ts`'s; this module only answers questions.
 *
 * It is a module rather than half of `roadmap.ts` because it is the layer's one place
 * that both DERIVES a placement and is asked to predict one: the drop indicator calls
 * `placeItem` with the ends a removal would leave, and `deriveBars` calls it with the
 * ends the note states. A comparison written beside the placement rules and expected
 * to agree with them is exactly what drifted when the second axis arrived.
 */

/** What the item states about its plan, tri-state per end, as the readers give it. */
export interface StatedEnds {
	start: FieldReading<CivilDate>;
	target: FieldReading<CivilDate>;
}

export function statedEnds(item: BacklogItem): StatedEnds {
	return { start: item.plannedStart, target: item.plannedTarget };
}

/** The same ends with the named ones removed — what a shelf drop would leave behind. */
export function withoutEnds(stated: StatedEnds, ends: PlacementEnd[]): StatedEnds {
	return {
		start: ends.includes('start') ? absentReading() : stated.start,
		target: ends.includes('target') ? absentReading() : stated.target,
	};
}

/** Where one item lands on this axis. */
export type Placement = { kind: 'bar'; bar: TimelineBar } | { kind: 'shelf'; reason: string | null };

/**
 * Bar or shelf, for ONE item, from the ends it is given. Every rule the axis has lives
 * behind this one call — the marker reduction, the unreadable and reversed refusals,
 * the rollup inference — because they do not compose into a single condition anyone
 * could restate correctly beside them.
 */
export function placeItem(item: BacklogItem, stated: StatedEnds): Placement {
	// A MARKER is reduced to its point before any span rule is asked about it. A stale
	// start later than the target would otherwise read as a reversed pair and shelve.
	// The start is ignored, never rewritten — ignoring a value and deleting it are
	// different acts, and only the first was specified.
	if (isMarkerType(item.typeName)) return placeMarker(item, stated.target);
	if (stated.start.invalid) return { kind: 'shelf', reason: 'Unreadable start date' };
	if (stated.target.invalid) return { kind: 'shelf', reason: 'Unreadable target date' };
	if (reversedSpan(stated.start.value, stated.target.value)) {
		return { kind: 'shelf', reason: 'Target date precedes the start date' };
	}
	const bar = inferSpan(item, stated.start.value, stated.target.value);
	return bar === null ? { kind: 'shelf', reason: null } : { kind: 'bar', bar };
}

/** The rows of the dated axis, split as `buildRoadmap` needs them. */
export interface DatedAxis {
	bars: TimelineBar[];
	shelf: ShelfCard[];
	context: BacklogItem[];
}

export function deriveBars(rows: BacklogItem[]): DatedAxis {
	const axis: DatedAxis = { bars: [], shelf: [], context: [] };
	for (const item of rows) {
		// A context row is never placed by its own dates and gets no inferred span
		// either: it routes straight to `context` before a span is ever computed for it.
		if (item.outsideFilter) {
			axis.context.push(item);
			continue;
		}
		const placement = placeItem(item, statedEnds(item));
		if (placement.kind === 'bar') axis.bars.push(placement.bar);
		else axis.shelf.push({ item, reason: placement.reason });
	}
	return axis;
}
```

`placeMarker` becomes a `Placement`-returning function over one reading rather than a
pusher into the model:

```ts
function placeMarker(item: BacklogItem, target: FieldReading<CivilDate>): Placement {
	if (target.invalid) return { kind: 'shelf', reason: 'Unreadable target date' };
	if (target.value === null) return { kind: 'shelf', reason: null };
	// Equal ends are what `barGeometry` already reports as a milestone, so the diamond
	// the timeline draws for a stated pair is the same diamond, reached by the type.
	return {
		kind: 'bar',
		bar: { item, span: { start: target.value, target: target.value }, inferredStart: false, inferredEnd: false },
	};
}
```

- [ ] **Step 8: Add `barHolds` and the unscheduled label**

Append to `src/domain/bars.ts`:

```ts
/** What a gesture may take hold of on a drawn bar. */
export type BarHold = 'body' | 'start' | 'end';

/** What a placement is called out loud once every end it may touch is gone. */
export const UNSCHEDULED_LABEL = 'Unscheduled';

/**
 * Where a gesture may take hold — asked ONCE, by the renderer that draws the grips and
 * by the drag that honours them, so what looks grabbable and what can actually be
 * written cannot disagree.
 *
 * Three rules, each from [[Move and resize a bar]]:
 * - a marker offers no end grips (1g): a point has no duration to resize, and its body
 *   slide moves the target alone;
 * - an INFERRED end withholds the body hold too, not only its own grip (1c) — sliding a
 *   bar half-anchored to its children is a resize wearing a slide's cursor;
 * - an unconfigured key offers no grip at all (1a), because nothing is ever written to
 *   one.
 *
 * An OPEN end is not an inferred end: it is absent, its property is configured, and its
 * grip is exactly how the missing date gets written.
 */
export function barHolds(item: BacklogItem, settings: BacklogSettings, bar: TimelineBar): BarHold[] {
	const ends = placementEnds(item.typeName);
	const writable = (end: PlacementEnd): boolean => ends.includes(end) && optionalKeyFor(settings, end) !== '';
	if (isMarkerType(item.typeName)) return writable('target') ? ['body'] : [];
	const holds: BarHold[] = [];
	if (!bar.inferredStart && writable('start')) holds.push('start');
	if (!bar.inferredEnd && writable('target')) holds.push('end');
	if (!bar.inferredStart && !bar.inferredEnd && holds.length > 0) holds.push('body');
	return holds;
}
```

- [ ] **Step 9: Point `roadmap.ts` at it**

In `src/domain/roadmap.ts`: delete the moved code, import from `./bars`, re-point
`buildRoadmap`:

```ts
import { deriveBars, ShelfCard, TimelineBar } from './bars';
```

```ts
	if (axis === 'horizons') deriveBuckets(rows, settings, roadmap, visible);
	else {
		const dated = deriveBars(rows);
		roadmap.bars = dated.bars;
		roadmap.shelf = dated.shelf;
		roadmap.context = dated.context;
	}
```

`RoadmapModel` keeps its `bars` / `shelf` / `context` fields, typed from `./bars`. The
`isMarkerType`, `CivilDate` and `daysBetween` imports in `roadmap.ts` go if nothing
there still uses them — `npm run lint` says which.

Repoint every other importer of `TimelineBar` / `ShelfCard` at `../../domain/bars`:
`src/view/render/timeline.ts`, `src/view/render/roadmap.ts`, and any test that names
them.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run test/domain test/view/roadmap.test.ts test/view/roadmapFrame.test.ts`
Expected: PASS. `test/domain/roadmap.test.ts` is unchanged — `buildRoadmap` behaves
identically, which is the point of doing the move before anything new is built on it.

- [ ] **Step 11: Watch the body-hold invariant fail**

Comment out the `!bar.inferredStart && !bar.inferredEnd &&` guard in `barHolds`, run
`npx vitest run test/domain/bars.test.ts`, and see "an inferred END withholds the body
hold too" fail. Restore it.

- [ ] **Step 12: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/domain/bars.ts src/domain/itemTypes.ts src/domain/roadmap.ts src/view src/domain/writePlan.ts test/domain
git commit -m "Ask one function where an item lands, and one what may take hold of it"
```

---

### Task 3: The writer preserves a datetime's time and shape

**Files:**
- Modify: `src/storage/frontmatter.ts`
- Test: `test/storage/frontmatter.test.ts`

**Interfaces:**
- Consumes: `AxisWrite` (unchanged this task), `axisEntries`.
- Produces: no new exports. `axisEntries`'s consumer in `applyInto` gains a merge step.

This is a **live defect on the shipped menu path**, not a new feature: `planDate` emits
a plain `formatCivil` string and `SchedulePromptModal` uses native `type="date"`
fields, so scheduling a note that carries `2026-08-01T09:00+02:00` erases its time
today. It is fixed here, in the writer, and **watched failing first** — that is the
evidence the test asserts what it reads as.

**Why the writer and not the plan.** The obvious fix is to carry the old raw value on
`BacklogItem` and have the planner re-emit the civil date with its suffix. That is
wrong, and `frontmatter.ts` already says why in three places: the model's idea of a
value can be a refresh behind — an external edit, or a batch still settling — so a
suffix taken from the model would overwrite a time or offset changed since the model
was built, which is the one thing this fix exists to stop happening.

- [ ] **Step 1: Write the failing test**

Append to `test/storage/frontmatter.test.ts`:

```ts
describe('the axis write keeps the value’s own shape', () => {
	it('replaces the date and leaves the time and offset the note carries', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01T09:00+02:00' } });
		const settings = resolveSettings(new FakeViewConfig({ startProperty: 'note.start' }));

		await applyWrites(vault.app, settings, [{ file, axis: { start: '2026-08-05' } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-05T09:00+02:00');
	});

	it('keeps a shape the note gained AFTER the model was built', async () => {
		// The case a model-carried suffix could not see and would silently overwrite:
		// the plan was made against a plain date, and by the time it lands the note
		// carries a time somebody else set. A planner-level test cannot reach this.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01' } });
		const settings = resolveSettings(new FakeViewConfig({ startProperty: 'note.start' }));
		vault.fm('Item.md').start = '2026-08-01T14:30:00';

		await applyWrites(vault.app, settings, [{ file, axis: { start: '2026-08-05' } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-05T14:30:00');
	});

	it('writes a plain date where the note has no time to keep, and never invents one', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: {} });
		const settings = resolveSettings(new FakeViewConfig({ targetProperty: 'note.target' }));

		await applyWrites(vault.app, settings, [{ file, axis: { target: '2026-08-05' } }]);

		expect(vault.fm('Item.md').target).toBe('2026-08-05');
	});

	it('takes no shape from a value the reader refuses', async () => {
		// `soon` is not a date with a time attached; replacing it is a correction, and
		// carrying its text forward would write `2026-08-05soon`.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: 'soon' } });
		const settings = resolveSettings(new FakeViewConfig({ targetProperty: 'note.target' }));

		await applyWrites(vault.app, settings, [{ file, axis: { target: '2026-08-05' } }]);

		expect(vault.fm('Item.md').target).toBe('2026-08-05');
	});
});
```

- [ ] **Step 2: Run it and WATCH IT FAIL**

Run: `npx vitest run test/storage/frontmatter.test.ts -t 'keeps the value'`
Expected: FAIL — `expected '2026-08-05' to be '2026-08-05T09:00+02:00'`. This is the
shipped defect. Read the failure before fixing it: it is the evidence that the test
asserts what it reads as.

- [ ] **Step 3: Merge the requested date into the live value**

In `src/storage/frontmatter.ts`, replace the axis loop in `applyInto`:

```ts
	for (const { key, value } of axisEntries(settings, write.axis)) {
		if (value === null) delete fm[key];
		else setOwn(fm, key, mergeDate(ownValue(fm, key), value));
	}
```

and add, beside `isBlank`:

```ts
/**
 * The requested CIVIL date, wearing whatever time and offset the note currently holds.
 *
 * The merge happens here rather than in the plan because the live value is the only
 * one that can be trusted: the row that planned this can be a refresh behind the note,
 * and a suffix taken from the model would overwrite a time somebody changed in
 * between. [[Move and resize a bar]] extension 1e is the requirement — a drag re-plans
 * a date, it does not re-format a value.
 *
 * A value the reader REFUSES contributes no shape: `soon` is not a date with a time
 * attached, and carrying its text forward would write `2026-08-05soon`. Only the
 * suffix of a value that actually parses as a date rides along, which is exactly the
 * `readDate` regex's own trailing group.
 */
function mergeDate(live: unknown, requested: string): string {
	if (typeof live !== 'string') return requested;
	const match = /^\d{4}-\d{1,2}-\d{1,2}([Tt\s].*)$/.exec(live.trim());
	return match ? `${requested}${match[1]}` : requested;
}
```

`readDate`'s own pattern is `^(\d{4})-(\d{1,2})-(\d{1,2})([Tt\s].*)?$`; this is the
same shape with the suffix required, so a value this merge carries a suffix from is
always one the model read as a date. Add `readDate` to the imports only if the
implementation ends up using it — it does not, deliberately: parsing the live value
into a `CivilDate` and re-formatting it would tidy `2026-8-1` into `2026-08-01`, and
the spelling on disk is the user's.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/storage/frontmatter.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add src/storage/frontmatter.ts test/storage/frontmatter.test.ts
git commit -m "Keep the time a note states when a gesture moves its date"
```

---

### Task 4: The writer decides against the live value, and says what it did

**Files:**
- Modify: `src/domain/writePlan.ts` (the `AxisWrite.ends` field only)
- Modify: `src/storage/frontmatter.ts`
- Modify: `src/view/writeGate.ts`, `src/view/host.ts`, `src/view/backlogView.ts`,
  `src/view/interactions/structure.ts` (the return type ripples)
- Test: `test/storage/frontmatter.test.ts`, `test/view/contextRows.test.ts`

**Interfaces:**
- Consumes: `placementEnds` (Task 2), `PlacementEnd`.
- Produces:
  - `AxisWrite.ends?: PlacementEnd[]` — the placement shape the plan was made under
  - `export interface DateChange { before: DateSpan; after: DateSpan }` (frontmatter.ts)
  - `export interface WriteOutcome { changed: boolean; dates: DateChange | null }`
  - `applyWrites(...): Promise<WriteOutcome>`
  - `WriteGate.applySafely(writes): Promise<WriteOutcome | null>` — null when refused or
    failed. A `WriteOutcome` is truthy, so every existing `if (await …)` call site is
    unchanged; the two that compare explicitly are listed in Step 6.
  - `BacklogViewHost.applySafely(writes): Promise<WriteOutcome | null>`

Four things move into the writer, all for one reason — **the model's idea of a value
can be a refresh behind, and the note is the only thing that knows what is true**:

1. the no-op decision (was `planDate`'s comparison against `plannedStart` /
   `plannedTarget`);
2. the reversed-pair refusal, judged on the effective pair — the requested end plus the
   LIVE other one — and **only where the item has a pair to reverse**;
3. the live-TYPE refusal: a batch planned for one placement shape must not apply to
   another;
4. the verdict: whether anything effectively changed, and the dates it moved between.

- [ ] **Step 1: Write the failing tests**

Append to `test/storage/frontmatter.test.ts`:

```ts
describe('the writer decides a date against the live note', () => {
	function dateSettings() {
		return resolveSettings(new FakeViewConfig({ startProperty: 'note.start', targetProperty: 'note.target' }));
	}

	it('writes a request the MODEL thought redundant but the note does not', async () => {
		// The row said 1 August, the note says 2 August, and the user re-confirms what
		// the screen showed. Deciding in the planner discards this as unchanged and the
		// note keeps something else — the user's request dropped before the writer
		// could see it was needed.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01' } });
		vault.fm('Item.md').start = '2026-08-02';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(outcome.changed).toBe(true);
	});

	it('reports no change — and consumes no undo — for a date the note already states', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-8-1' } });
		const inverses: unknown[] = [];

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }], undefined, (i) => inverses.push(i));

		// Compared as civil DATES, not as text: re-confirming a date the note already
		// states must not tidy `2026-8-1` into `2026-08-01`. The comparison moved here
		// with the decision — it is a question about the spelling on disk.
		expect(vault.fm('Item.md').start).toBe('2026-8-1');
		expect(outcome.changed).toBe(false);
		expect(inverses).toHaveLength(0);
	});

	it('reports the dates it moved BETWEEN, from the values it actually saw', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-02', target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }]);

		expect(outcome.dates?.before).toEqual({ start: { year: 2026, month: 8, day: 2 }, target: { year: 2026, month: 8, day: 20 } });
		expect(outcome.dates?.after).toEqual({ start: { year: 2026, month: 8, day: 1 }, target: { year: 2026, month: 8, day: 20 } });
	});

	it('refuses the whole batch when the effective pair would be reversed', async () => {
		// A one-end write is planned against a span the render showed; a target changed
		// by another editor mid-drag can turn a legal start into a reversed pair. The
		// guarantee is about what lands on DISK, so it is checked where disk is — and
		// refused whole rather than re-clamped to a date the user never pointed at.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01', target: '2026-08-20' } });
		vault.fm('Item.md').target = '2026-08-03';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-10', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(outcome.changed).toBe(false);
	});

	it('never invents a reversal for a placement with no pair', async () => {
		// A marker's start is deliberately ignored AND preserved, so a stale start
		// later than the requested target would make the writer refuse every marker
		// drop — a validation inventing a conflict out of a value the projection never
		// drew. The check asks the same question the plan asks, of the LIVE type.
		const vault = new FakeVault();
		const file = vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', start: '2026-12-01', target: '2026-09-30' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { target: '2026-10-15', ends: ['target'] } }]);

		expect(vault.fm('Ship.md').target).toBe('2026-10-15');
		expect(vault.fm('Ship.md').start).toBe('2026-12-01');
		expect(outcome.changed).toBe(true);
	});

	it('refuses a batch whose planned shape is not the shape the note now has', async () => {
		// An external edit turned an ordinary item into a marker while a modal was
		// open. Applying the half that still fits would commit a plan the user made
		// about a different thing, so the batch is refused whole — `applySafely`
		// already refuses whole for the same reason.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI', start: '2026-08-01', target: '2026-08-20' } });
		vault.fm('Item.md').type = 'Milestone';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-05', target: '2026-08-25', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(vault.fm('Item.md').target).toBe('2026-08-20');
		expect(outcome.changed).toBe(false);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/storage/frontmatter.test.ts -t 'decides a date'`
Expected: FAIL — `applyWrites` resolves `undefined`, so `outcome.changed` throws; and
`AxisWrite` has no `ends`, so the fixtures do not compile.

- [ ] **Step 3: Carry the expectation on the write**

In `src/domain/writePlan.ts`, add to `AxisWrite`:

```ts
	/**
	 * The placement shape this plan was made under — which ends the item HAD when the
	 * plan was made. The writer compares it against the live one and refuses the batch
	 * where they disagree, because dates alone cannot say: a marker that became an
	 * ordinary item leaves a target-only request arriving at an ordinary item, which is
	 * exactly what a legitimate end-grip write looks like. A write states its
	 * expectation and the writer is where the expectation is checked — the same
	 * discipline as the restore's compare-and-swap. Absent on a horizon write, which
	 * has no shape to disagree about.
	 */
	ends?: PlacementEnd[];
```

with `import { childLevelIndex, EXTRA_TYPE_RANK, isExtraType, isMarkerType, nextLevelIndex, PlacementEnd } from './itemTypes';`.

- [ ] **Step 4: Teach the writer to decide, refuse and report**

In `src/storage/frontmatter.ts`:

```ts
/** The dates one axis write moved between, read off the note either side of it. */
export interface DateChange {
	before: DateSpan;
	after: DateSpan;
}

/**
 * What a batch actually did. `changed` is what the announcement asks — a batch that
 * completed is not the same as a batch that changed something, and a screen-reader
 * user hearing about a move that did not happen is the failure this exists to prevent.
 * `dates` is the first axis write's before/after, from the values the writer itself
 * saw: the model may be a refresh behind, so the caller cannot name them.
 */
export interface WriteOutcome {
	changed: boolean;
	dates: DateChange | null;
}
```

`applyWrites` gains the refusal and the report:

```ts
export async function applyWrites(
	app: App,
	settings: BacklogSettings,
	writes: ItemWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<WriteOutcome> {
	const outcome: WriteOutcome = { changed: false, dates: null };
	let done = 0;
	for (const write of writes) {
		let inverse: RestoreWrite | null = null;
		let refused = false;
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			const before = axisSpan(fm, settings);
			// Refusals are asked of the LIVE note before anything is touched, and they
			// refuse the batch WHOLE: a partly-applied batch leaves the note in a state
			// nobody asked for, which is `applySafely`'s own rule reaching the one
			// decision it cannot make from outside the file.
			if (refusesAxis(fm, settings, write)) {
				refused = true;
				return;
			}
			const keys = touchedKeys(settings, write);
			const prior = keys.map((key) => rawValueOf(fm, key));
			const tags = applyInto(app, fm, settings, write);
			inverse = captureInverse(write.file, keys, prior, fm, tags);
			if (write.axis && (write.axis.start !== undefined || write.axis.target !== undefined)) {
				outcome.dates ??= { before, after: axisSpan(fm, settings) };
			}
		});
		if (refused) {
			console.error('Product Backlog: refused a date batch the note no longer fits', write);
			new Notice('That note changed while the move was in flight, so nothing was written.');
			return { changed: false, dates: null };
		}
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}
```

and the two helpers:

```ts
/** The pair the note currently states, read the same tolerant way the model reads it. */
function axisSpan(fm: Record<string, unknown>, settings: BacklogSettings): DateSpan {
	const read = (field: PlacementEnd): CivilDate | null => {
		const key = optionalKeyFor(settings, field);
		return key === '' ? null : readDate(ownValue(fm, key)).value;
	};
	return { start: read('start'), target: read('target') };
}

/**
 * Why a date batch may not land on this note, asked of the LIVE frontmatter.
 *
 * Two questions, both about the note having moved under the plan:
 *
 * - the SHAPE. `axisEntries` applies every field the batch carries, so an external
 *   edit that turned an ordinary item into a marker would let a stale two-ended plan
 *   write the start that type may not touch — the narrowing kept everywhere else and
 *   lost at the last step.
 * - the PAIR. "No gesture may write a reversed span" is a guarantee about what lands
 *   on disk, so the effective pair is the requested end plus the live other one. Asked
 *   only where the placement HAS a pair: a marker's start is ignored and preserved, so
 *   a stale one later than the target is not a conflict, it is a value the projection
 *   never drew.
 */
function refusesAxis(fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): boolean {
	const axis = write.axis;
	if (!axis || axis.ends === undefined) return false;
	const live = placementEnds(readString(ownValue(fm, settings.typeKey)));
	if (live.length !== axis.ends.length || live.some((end) => !axis.ends?.includes(end))) return true;
	if (live.length < 2) return false;
	const current = axisSpan(fm, settings);
	const requested = (field: PlacementEnd): CivilDate | null => {
		const value = axis[field];
		if (value === undefined) return current[field];
		return value === null ? null : readDate(value).value;
	};
	return reversedSpan(requested('start'), requested('target'));
}
```

Imports gain `CivilDate`, `readDate`, `sameValue` are already partly there — the final
list is `hasTag, normalizeTag, ownValue, readDate, readString, readTags` from
`noteFields`, `placementEnds, PlacementEnd` from `../domain/itemTypes`,
`DateSpan, reversedSpan` from `../domain/timeline`, and `Notice` from `obsidian`.

- [ ] **Step 5: Make the no-op decision the writer's**

`applyInto`'s axis loop drops a write whose requested civil date is the one the note
already states — the comparison that used to live in `planDate`:

```ts
	for (const { key, value } of axisEntries(settings, write.axis)) {
		if (value === null) {
			// A removal for a key that is not there changes nothing, and `captureInverse`
			// already reports that by capturing no inverse — but deleting a missing key
			// is also not a write, so this is the same statement made once.
			delete fm[key];
			continue;
		}
		const live = readDate(ownValue(fm, key));
		// Civil-date equality, not text equality: re-confirming `2026-8-1` must not
		// rewrite it as `2026-08-01`. The spelling on disk is the user's, and tidying it
		// is a write nobody asked for. This is the question the planner used to answer
		// from the model, where the value could be a refresh behind.
		if (!live.invalid && live.value !== null && sameCivil(live.value, readDate(value).value)) continue;
		setOwn(fm, key, mergeDate(ownValue(fm, key), value));
	}
```

with

```ts
function sameCivil(a: CivilDate, b: CivilDate | null): boolean {
	return b !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}
```

`sameCivil` is deleted from `src/domain/writePlan.ts` in Task 5.

- [ ] **Step 6: Ripple the return type**

- `src/view/writeGate.ts`: `applySafely(writes: ItemWrite[]): Promise<WriteOutcome | null>`;
  the two early returns become `null`; `runExclusively` carries the outcome through.
  `undoLast` is untouched — a replay reports restores, not dates.
- `src/view/host.ts`: `applySafely(writes: ItemWrite[]): Promise<WriteOutcome | null>`.
- `src/view/backlogView.ts`: `applyMove` becomes
  `const applied = await this.applySafely(writes); if (applied === null) row?.classList.remove('pbl-pending'); return applied;`
  and returns `Promise<WriteOutcome | null>`; `applyCardMove` keeps
  `Promise<boolean>` and gates on `outcome !== null && outcome.changed`.
- `src/view/interactions/structure.ts:134`: `const applied = writes.length > 0 && (await host.applySafely(writes)) !== null;`
- `test/view/contextRows.test.ts:145,155`: `expect(applied).toBeNull();`

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/storage test/view`
Expected: PASS.

- [ ] **Step 8: Watch the pair narrowing fail**

Delete the `if (live.length < 2) return false;` line, run
`npx vitest run test/storage/frontmatter.test.ts -t 'never invents a reversal'`, and see
it fail: the marker's stale start makes the writer refuse a legitimate drop. Restore it.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/domain/writePlan.ts src/storage/frontmatter.ts src/view test/storage test/view/contextRows.test.ts
git commit -m "Decide a date against the note, and report what the writer actually did"
```

---

### Task 5: The planner stops claiming anything about the note

**Files:**
- Modify: `src/domain/writePlan.ts`
- Modify: `src/view/interactions/plan.ts` (the two callers pass the ends)
- Test: `test/domain/writePlanAxis.test.ts`

**Interfaces:**
- Consumes: `PlacementEnd`, `placementEnds`.
- Produces:
  - `computeScheduleWrites(item: BacklogItem, plan: SchedulePlan, ends: PlacementEnd[]): ItemWrite[]`
    — the ends ride onto `AxisWrite.ends`; `planDate` and `sameCivil` are deleted.

- [ ] **Step 1: Write the failing tests**

Replace the "plans nothing for a re-confirmed date" and "omits a removal for a key the
note lacks" cases in `test/domain/writePlanAxis.test.ts` with:

```ts
	it('states what was asked for, and claims nothing about what the note holds', () => {
		// The planner sees a model that can be a refresh behind the note, so it is no
		// longer allowed an opinion about whether a write is needed. It proposes; the
		// writer — the only module that can see the note — decides.
		const item = itemAt('Item.md', { start: '2026-08-01' });

		const writes = computeScheduleWrites(item, { start: '2026-08-01' }, ['start', 'target']);

		expect(writes).toEqual([{ file: item.file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }]);
	});

	it('carries a null for every end the placement allows, key present or not', () => {
		// `ownKeys` is a model-time reading too. An unschedule planned while a bar had
		// one end would omit the other end's null, and an editor who added that date
		// mid-drag would find the item still scheduled after an action that said it
		// would clear it — a removal that half-happened.
		const item = itemAt('Item.md', { start: '2026-08-01' });

		const writes = computeScheduleWrites(item, { start: null, target: null }, ['start', 'target']);

		expect(writes).toEqual([{ file: item.file, axis: { start: null, target: null, ends: ['start', 'target'] } }]);
	});

	it('plans nothing when the plan names no end at all', () => {
		const item = itemAt('Item.md', { start: '2026-08-01' });
		expect(computeScheduleWrites(item, {}, ['start', 'target'])).toEqual([]);
	});

	it('refuses a date it cannot read rather than guessing at one', () => {
		// The entry refuses an unreadable date before it gets here; this is the backstop
		// that keeps the rule true of the planner too.
		const item = itemAt('Item.md', {});
		expect(computeScheduleWrites(item, { start: 'soon' }, ['start', 'target'])).toEqual([]);
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/writePlanAxis.test.ts`
Expected: FAIL — `computeScheduleWrites` takes two arguments, and the first case's
write is dropped as unchanged.

- [ ] **Step 3: Simplify the planner**

```ts
/**
 * The batch a schedule (or unschedule) means: one write naming the ends the plan
 * names. Both ends ride the SAME `ItemWrite`, so a span is one undo rather than two
 * halves of one that can be taken back separately.
 *
 * It decides nothing from the model, in either direction — not whether a date is
 * already stated, not whether a key is there to remove. Both are questions about what
 * the note holds RIGHT NOW, and the row that planned this can be a refresh behind it,
 * so both are the writer's (`storage/frontmatter.ts`). What this function does is
 * state what was asked for, plus the placement shape it was asked under, so the writer
 * can check its expectation.
 *
 * It stays type-agnostic deliberately: WHICH ends a plan may name is `placementEnds`
 * in `domain/itemTypes.ts`, asked by the caller. Pushing the narrowing in here would
 * put one type rule in two places.
 */
export function computeScheduleWrites(item: BacklogItem, plan: SchedulePlan, ends: PlacementEnd[]): ItemWrite[] {
	const axis: AxisWrite = { ends };
	let planned = false;
	for (const field of ends) {
		const requested = plan[field];
		if (requested === undefined) continue;
		// The one backstop that stays: no date is ever guessed at, wherever the value
		// arrived from. It is a question about the REQUEST, not about the note.
		if (requested !== null && readDate(requested).value === null) continue;
		axis[field] = requested;
		planned = true;
	}
	return planned ? [{ file: item.file, axis }] : [];
}
```

Delete `planDate` and `sameCivil`; drop `CivilDate` and `sameValue` from the imports if
nothing else in the file uses them (`computeStateWrites` and `computeHorizonWrites`
still use `sameValue` — a horizon re-pick is a model question the horizon axis has not
moved, and moving it is not this increment's).

- [ ] **Step 4: Update the two existing callers**

`src/view/interactions/plan.ts`:

```ts
		onSubmit: (values) =>
			void host.performScheduleMove(item, planFrom(item, values)),
```

```ts
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	const plan: SchedulePlan = {};
	for (const field of placementEnds(item.typeName)) plan[field] = null;
	return host.performScheduleMove(item, plan);
}
```

`performScheduleMove` does not exist until Task 6. Until it does, call
`host.applySafely(computeScheduleWrites(item, plan, placementEnds(item.typeName)))` and
leave the routing to Task 6 — Task 6's first step is the test that fails because the
two paths still plan their own write.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/domain test/view`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/writePlan.ts src/view/interactions/plan.ts test/domain/writePlanAxis.test.ts
git commit -m "Let the planner ask for a date, and the writer decide what it means"
```

---

### Task 6: One schedule move, three inputs

**Files:**
- Modify: `src/view/host.ts`
- Modify: `src/view/backlogView.ts`
- Modify: `src/view/interactions/cardDrag.ts`
- Modify: `src/view/interactions/plan.ts`
- Test: `test/view/roadmapMoves.test.ts`

**Interfaces:**
- Consumes: `WriteOutcome`, `DateChange` (Task 4); `placeItem`, `statedEnds`,
  `UNSCHEDULED_LABEL` (Task 2); `computeScheduleWrites` (Task 5).
- Produces:
  - `BacklogViewHost.performScheduleMove(item: BacklogItem, plan: SchedulePlan): Promise<boolean>`
  - `export function announceScheduleMove(title: string, change: DateChange, placement: Placement | null): void`
    in `cardDrag.ts`, beside `announceBoardMove` and `announceHorizonMove`

`performScheduleMove` is the only place a date batch is planned and the only place it is
announced — the epic's "one move, three inputs" rule reaching a third projection. The
modal and the menu's Unschedule route through it; the drag (Tasks 11–13) calls the same
method.

**What is captured before the await and what is not.** `applyCardMove`'s capture rule
covers **vocabulary**: a bucket label the batch's own refresh may destroy is read up
front, because the rebuilt roadmap cannot name a bucket that has gone with its last
card. Dates are not vocabulary — they come back with the writer's verdict, from the
live values it saw — and the resulting PLACEMENT comes from the rebuilt model, because
by the time the write resolves the refresh has already run and what the row now is, is
a fact rather than a forecast.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/roadmapMoves.test.ts`:

```ts
describe('scheduling from the row, on the one path', () => {
	function datedVault() {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' }, parentLink: 'Parent' });
		return vault;
	}

	function datedView(vault: FakeVault) {
		const harness = makeView(vault, { startProperty: 'note.start', targetProperty: 'note.target' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		return harness;
	}

	it('announces the dates the WRITER saw, not the ones the row was drawn from', async () => {
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Child.md');
		// The note moved under the row: the screen says the 10th, the note says the 11th.
		vault.fm('Child.md').start = '2026-08-11';

		await view.performScheduleMove(item as never, { start: '2026-08-12' });

		expect(await announced()).toBe('Moved "Child" from 2026-08-11 to 2026-08-20 to 2026-08-12 to 2026-08-20');
	});

	it('says nothing at all when the write changed nothing', async () => {
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Child.md');

		const moved = await view.performScheduleMove(item as never, { start: '2026-08-10' });

		expect(moved).toBe(false);
		expect(await announced()).toBe('');
	});

	it('names the INFERRED span a parent keeps rather than claiming it was unscheduled', async () => {
		// `inferSpan` refills an end the note no longer states, so announcing a removal
		// as "Unscheduled" would describe something other than what renders. This is
		// `announceHorizonMove`'s own lesson — it recorded a cleanup as "from Unplaced
		// to Unplaced" — reached by the other axis.
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Parent.md');

		await view.performScheduleMove(item as never, { start: null, target: null });

		expect(await announced()).toBe('Moved "Parent" from 2026-08-01 to 2026-08-31 to 2026-08-10 to 2026-08-20');
	});

	it('says Unscheduled only where the item actually leaves the axis', async () => {
		const vault = new FakeVault();
		vault.addFile('Alone.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Alone.md');

		await view.performScheduleMove(item as never, { start: null, target: null });

		expect(await announced()).toBe('Moved "Alone" from 2026-08-01 to Unscheduled');
	});

	it('routes the menu’s Unschedule through the same method', async () => {
		const vault = datedVault();
		const { view, containerEl } = datedView(vault);
		const spy = vi.spyOn(view, 'performScheduleMove');
		const item = view.model?.byPath.get('Child.md');

		await unschedule(view, item as never);

		expect(spy).toHaveBeenCalledOnce();
		expect(containerEl).toBeTruthy();
	});
});
```

Import `unschedule` from `../../src/view/interactions/plan` and `announced` from
`../helpers/dnd`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/roadmapMoves.test.ts -t 'scheduling from the row'`
Expected: FAIL — `view.performScheduleMove is not a function`.

- [ ] **Step 3: Declare the host method**

In `src/view/host.ts`:

```ts
	/**
	 * Plan and apply the date batch a schedule move means — the ends the item's own
	 * type answers for, or their removal. The board's and the horizon axis's rule on
	 * the dated one: one path for every input (a drag, a grip, the row's entry, the
	 * menu's Unschedule), so no input can reach a date another cannot, and every move
	 * that lands announces itself once. A batch the WRITER decides changed nothing
	 * resolves false, leaving the undo slot untouched and saying nothing.
	 */
	performScheduleMove(item: BacklogItem, plan: SchedulePlan): Promise<boolean>;
```

with `import { ItemWrite, SchedulePlan } from '../domain/writePlan';`.

- [ ] **Step 4: Implement it, and let the announcement read the verdict**

In `src/view/backlogView.ts`:

```ts
	async performScheduleMove(item: BacklogItem, plan: SchedulePlan): Promise<boolean> {
		const writes = computeScheduleWrites(item, plan, placementEnds(item.typeName));
		if (writes.length === 0) return false;
		const outcome = await this.applyMove(item, writes);
		// Not "did the call return" but "did the note change": the planner now hands
		// the gate a non-empty batch for a re-confirmed date, and `runExclusively`
		// reports success for anything that completed. Announcing on that would tell a
		// screen-reader user about a move that did not happen.
		if (outcome === null || !outcome.changed || outcome.dates === null) return false;
		// The dates came back with the verdict; the PLACEMENT comes from the rebuilt
		// model, because the batch's own refresh has already run by the time this
		// resolves — what the row now is, is a fact rather than a forecast. A write can
		// take its own note out of the base, and then there is no row and nothing to
		// dereference: the announcement names the dates and stops there rather than
		// guessing that the card left the view.
		const live = this.model?.byPath.get(item.file.path) ?? null;
		announceScheduleMove(item.title, outcome.dates, live ? placeItem(live, statedEnds(live)) : null);
		return true;
	}
```

`applyMove` already returns the outcome after Task 4's ripple. `applyCardMove` is
untouched: this method shares its shape rather than its body, because the announcement
here is driven by the verdict rather than by a closure captured up front — and the
comment on `applyCardMove` says why that is the *opposite* rule for vocabulary.

- [ ] **Step 5: Write the announcement**

Append to `src/view/interactions/cardDrag.ts`:

```ts
/**
 * Say what a date move changed. Old span and new, in the same live region and the same
 * words as a board or a horizon move — a drag, a grip, the row's entry and the menu's
 * Unschedule are one move said once.
 *
 * "Unscheduled" is only true where the item actually LEAVES the axis. A parent whose
 * descendants still carry dates keeps a bar: `inferSpan` refills an end the note no
 * longer states, so announcing a removal as "Unscheduled" would describe something
 * other than what renders. The placement is asked of `placeItem` — the function that
 * decides what draws — never of a comparison written beside it.
 *
 * A null placement means the rebuilt model has no row for this item at all: the write
 * took its own note out of the base. Then the dates it wrote are the whole of what can
 * honestly be said. This does NOT announce that the card left the view — that is the
 * outcome report, which needs a note's disappearance correlated with the write that
 * caused it, and `docs/issues/The outcome report was built from one sentence.md`
 * records that as unsolved here.
 */
export function announceScheduleMove(title: string, change: DateChange, placement: Placement | null): void {
	const to = placement === null ? spanWords(change.after) : placementWords(placement);
	announceMove(title, spanWords(change.before), to);
}

function placementWords(placement: Placement): string {
	return placement.kind === 'shelf' ? UNSCHEDULED_LABEL : spanWords(placement.bar.span);
}

/** A span in the register's own date format; the shelf's word when there is none. */
function spanWords(span: DateSpan): string {
	if (span.start !== null && span.target !== null) {
		return daysBetween(span.start, span.target) === 0
			? formatCivil(span.start)
			: `${formatCivil(span.start)} to ${formatCivil(span.target)}`;
	}
	if (span.start !== null) return `from ${formatCivil(span.start)}`;
	if (span.target !== null) return `to ${formatCivil(span.target)}`;
	return UNSCHEDULED_LABEL;
}
```

- [ ] **Step 6: Route the two menu paths through it**

`src/view/interactions/plan.ts` — replace the `applySafely` calls left in Task 5:

```ts
		onSubmit: (values) => void host.performScheduleMove(item, planFrom(item, values)),
```

```ts
/** Take the item off the plan: every date key its own type answers for, in one undoable batch. */
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	const plan: SchedulePlan = {};
	for (const field of placementEnds(item.typeName)) plan[field] = null;
	return host.performScheduleMove(item, plan);
}
```

Update the module preamble: `promptSchedule` and `unschedule` no longer apply their own
writes, and the sentence about `host.applySafely` becomes one about
`host.performScheduleMove` — with the reason, that leaving them on the gate directly
would make the drag a second idea of what scheduling is.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/view/roadmapMoves.test.ts test/view/menu.test.ts test/view/plan.test.ts`
Expected: PASS.

- [ ] **Step 8: Watch the inferred-span announcement fail**

Change `placementWords` to `return UNSCHEDULED_LABEL;` unconditionally, run the third
case, and see it report a parent as unscheduled while its bar is still on screen.
Restore.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view test/view
git commit -m "Give the dated axis one move, and let it name what actually happened"
```

---

### Task 7: The grid draws at a scale

**Files:**
- Modify: `src/view/render/timeline.ts`
- Modify: `src/view/render/roadmap.ts`
- Modify: `styles/timeline.css`
- Test: `test/view/roadmapFrame.test.ts`

**Interfaces:**
- Consumes: `TimelineScale`, `scaleFor`, `timelineCells`, `MIN_BAR_PX`, `dayAt` (Task 1).
- Produces:
  - `renderTimeline(ctx, containerEl, bars, today, scale): TimelineRender`
  - `TimelineRender { cards; todayLeft; scroller; content; window; }` — the scroller
    element and the window the drag will measure against
  - `--pbl-tl-line` published on the grid, so the stylesheet stops hard-coding 2px

Three fixed pixel counts convert, under one rule: **a length in days is scaled and a
length in pixels is not.**

| Was | Becomes | Because |
| --- | --- | --- |
| `DAY_PX` | `scale.dayPx` | the zoom is the parameter |
| `Math.max(spanDays * DAY_PX, DAY_PX)` | `Math.max(spanDays * scale.dayPx, MIN_BAR_PX)` | one pixel per day at quarter zoom is a plan drawn invisible |
| `TODAY_NUDGE_PX = 2` | `scale.lineWidth` | a nudge is a SUB-DAY offset; two pixels at 1px/day is a two-day displacement, putting the line in the wrong day |

- [ ] **Step 1: Write the failing tests**

Append to `test/view/roadmapFrame.test.ts`:

```ts
describe('the grid at each density', () => {
	it('draws a stated plan at least MIN_BAR_PX wide, even at the sparsest zoom', () => {
		// A one-day bar at quarter zoom is one pixel: a stated plan rendered as an
		// invisible one. The floor is its own constant precisely because it is a length
		// in PIXELS and must not scale with the zoom.
		const vault = new FakeVault();
		vault.addFile('One day.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-04' } });
		const { view, containerEl } = datedRoadmap(vault);
		view.setZoom('quarter');

		const bar = barFor(containerEl, 'One day');
		expect(parseFloat(bar.style.getPropertyValue('--pbl-bar-width'))).toBeGreaterThanOrEqual(4);
	});

	it('keeps a milestone’s line inside its own day at every zoom', () => {
		// The nudge is a sub-day offset. At quarter zoom a fixed two pixels is a two-day
		// displacement, putting the line and its label in the wrong day — and the day
		// is exactly wide enough for both marks because `dayPx >= 2 * lineWidth`.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, target: TODAY_ISO } });
		const { view, containerEl } = datedRoadmap(vault);

		for (const zoom of ['week', 'month', 'quarter'] as const) {
			view.setZoom(zoom);
			const line = containerEl.querySelector<HTMLElement>('.pbl-milestone-line');
			const today = containerEl.querySelector<HTMLElement>('.pbl-today');
			const nudged = parseFloat(line?.style.getPropertyValue('--pbl-milestone-left') ?? '0');
			const todayLeft = parseFloat(today?.style.getPropertyValue('--pbl-today-left') ?? '0');
			const dayPx = scaleFor(zoom).dayPx;
			expect(nudged - todayLeft, `${zoom} nudge`).toBeGreaterThan(0);
			expect(nudged - todayLeft, `${zoom} nudge`).toBeLessThan(dayPx);
		}
	});

	it('names its header cells by the active scale’s unit', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
		const { view, containerEl } = datedRoadmap(vault);

		view.setZoom('quarter');
		expect(cellLabels(containerEl).some((label) => /^Q[1-4] \d{4}$/.test(label))).toBe(true);
		view.setZoom('month');
		expect(cellLabels(containerEl)).toContain('Aug 2026');
	});
});
```

with a `cellLabels` accessor added to `test/helpers/roadmap.ts`:

```ts
/** Every header cell's text, in drawn order — months, weeks or quarters by zoom. */
export function cellLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell')).map((c) => c.textContent ?? '');
}
```

`setZoom` lands in Task 8; until then these three cases fail on it. Write them now and
run them at Step 5 of Task 8 — this task's own step is the two that do not need it.

- [ ] **Step 2: Run the first case to verify it fails**

Run: `npx vitest run test/view/roadmapFrame.test.ts -t 'MIN_BAR_PX'`
Expected: FAIL — at month zoom the bar is 4px, so temporarily assert against the
`quarter` scale by calling `renderTimeline` directly, or accept this case as one of the
three that turn green in Task 8. The one to see fail NOW is the nudge, at month zoom
with `scale.lineWidth`: it passes only because 2 happens to be both numbers.

- [ ] **Step 3: Parameterise the renderer**

In `src/view/render/timeline.ts`:

```ts
export interface TimelineRender {
	cards: BacklogItem[];
	/** Pixel offset of the today line from the grid's left edge. */
	todayLeft: number;
	/** The element that scrolls — both axes, on this projection. */
	scroller: HTMLElement;
	/** The positioned layer inside it; full-height marks and the overlay live here. */
	content: HTMLElement;
	window: TimelineWindow;
}

export function renderTimeline(
	ctx: RowContext,
	containerEl: HTMLElement,
	bars: TimelineBar[],
	today: CivilDate,
	scale: TimelineScale,
): TimelineRender {
	const window = timelineWindow(bars.map((bar) => bar.span), today);
	// TWO elements, not one. The scroll box is the outer one; the positioned layer is
	// the inner. Full-height marks (the today line, the milestone lines, the drop
	// overlay) resolve `top: 0; bottom: 0` against their containing block's PADDING
	// box — the visible height, not the content height — so making the scroll box the
	// containing block would make every one of them viewport-tall and scroll away,
	// leaving the lower rows crossed by nothing. A line that stops partway down is
	// worse than no line: it says the plan divides there.
	const grid = containerEl.createDiv({ cls: 'pbl-timeline' });
	const content = grid.createDiv({ cls: 'pbl-timeline-content' });
	content.setCssProps({
		'--pbl-tl-lead': `${TIMELINE_LEAD_PX}px`,
		'--pbl-tl-days': `${window.days * scale.dayPx}px`,
		// The stylesheet stops hard-coding 2px: the width is the scale's, because
		// `dayPx >= 2 * lineWidth` is what lets today's line and a coincident
		// milestone's both draw inside one day.
		'--pbl-tl-line': `${scale.lineWidth}px`,
	});
	const headerTrack = renderCellHeader(content, window, scale);
	renderMilestoneLines(content, headerTrack, window, bars, today, scale);
	for (const bar of bars) renderBarRow(ctx, content, window, bar, scale);
	const todayLeft = TIMELINE_LEAD_PX + todayOffset(window, today, scale);
	const line = content.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	line.setCssProps({ '--pbl-today-left': `${todayLeft}px` });
	setTooltip(line, `Today — ${formatCivil(today)}`);
	return { cards: bars.map((bar) => bar.item), todayLeft, scroller: grid, content, window };
}
```

`renderMonthHeader` becomes `renderCellHeader`, iterating `timelineCells(window, scale)`
and giving each cell `cls: 'pbl-timeline-cell'` with `--pbl-cell-w` (the old
`pbl-timeline-month` / `--pbl-month-w` renamed — the class named a unit that is no
longer the only one). `renderMilestoneLines` takes the scale and uses
`nudge = day === todayDay ? scale.lineWidth : 0` and `day * scale.dayPx`.
`renderBarRow` uses `scale.dayPx` and `Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)`.
`todayOffset` takes the scale.

`src/view/render/roadmap.ts` passes `scaleFor(host.zoom)` — which is `scaleFor(null)`
until Task 8 adds `host.zoom` — and returns the new fields on `RoadmapSnapshot`
(Task 9 wires them; for now `renderRoadmap` may hold them in locals and return
`todayLeft` as before).

- [ ] **Step 4: Rename the stylesheet's month cell and read the line width**

In `styles/timeline.css`: `.pbl-timeline-month` → `.pbl-timeline-cell`, `--pbl-month-w`
→ `--pbl-cell-w`, and both full-height marks take their width from the scale:

```css
.pbl-today {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-today-left);
	/* The scale's, not a constant: `dayPx >= 2 * lineWidth` is what lets this line and
	   a milestone dated today both draw inside one day instead of one erasing the
	   other. See SCALES in `src/domain/timeline.ts`. */
	width: var(--pbl-tl-line);
	z-index: 1;
	background-color: var(--color-red);
	opacity: 0.55;
}
```

and the same `width: var(--pbl-tl-line);` on `.pbl-milestone-line`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/roadmapFrame.test.ts test/view/roadmap.test.ts`
Expected: PASS, except the two cases that need `setZoom`. Mark them `it.todo` with the
Task 8 reference and turn them on there, or land Tasks 7 and 8 as one commit — the
latter is preferred, because a test written and then skipped is one nobody watches fail.

- [ ] **Step 6: Commit (with Task 8)**

---

### Task 8: The zoom picker, jump-to-today, and where the zoom lives

**Files:**
- Modify: `src/storage/collapseStore.ts`
- Modify: `src/view/collapseState.ts`
- Modify: `src/view/host.ts`, `src/view/backlogView.ts`
- Modify: `src/view/render/toolbar.ts`
- Test: `test/storage/collapseStore.test.ts`, `test/view/timelineZoom.test.ts` (create)

**Interfaces:**
- Consumes: `ScaleId`, `SCALES`, `DEFAULT_SCALE_ID`, `scaleFor` (Task 1);
  `RoadmapSnapshot.scroller` and `.window` (Task 7).
- Produces:
  - `CollapseSnapshot.zoom?: string | null` and `StoredEntry.zoom?: string`
  - `CollapseState.zoomPick(): string | null`, `CollapseState.setZoom(id: string): void`
  - `BacklogViewHost.zoom: ScaleId`, `BacklogViewHost.setZoom(id: ScaleId): void`
  - `renderZoomPicker`, `renderTodayButton` in `toolbar.ts` (module-private)

**Two places, not one.** `collapseStore.ts` validates and stores it; `CollapseState` is
what actually HOLDS `mode` and `axis` as private fields, reads them on restore and
constructs the snapshot it saves. A store-only change gives a picker that works all
session and reverts the moment the view is reopened — the worst shape of this bug,
because nothing fails until someone comes back the next day.

- [ ] **Step 1: Write the failing store tests**

Append to `test/storage/collapseStore.test.ts`:

```ts
	it('round-trips the zoom, and drops a scale this plugin never wrote', () => {
		const app = fakeApp();
		const id = { base: 'Plan.base', view: 'Roadmap' };

		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: 'roadmap', axis: 'dates', zoom: 'quarter' });
		expect(loadCollapseState(app, id).zoom).toBe('quarter');

		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: 'roadmap', axis: 'dates', zoom: 'fortnight' });
		// Stored state is user-writable data another version may have written: anything
		// unrecognizable is dropped rather than trusted, exactly as `axis` is.
		expect(loadCollapseState(app, id).zoom).toBeNull();
	});

	it('needs no entry for a view at its defaults, zoom included', () => {
		const app = fakeApp();
		const id = { base: 'Plan.base', view: 'Roadmap' };
		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: null, axis: null, zoom: null });
		expect(loadCollapseState(app, id).zoom).toBeNull();
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/storage/collapseStore.test.ts`
Expected: FAIL — `zoom` is not a field of `CollapseSnapshot`.

- [ ] **Step 3: Store the zoom**

In `src/storage/collapseStore.ts`, beside `AXIS_VALUES`:

```ts
/**
 * The values the `zoom` field may hold. Mirrors `ScaleId` in `domain/timeline.ts`;
 * spelled here as strings for the same reason `AXIS_VALUES` is — stored state is read
 * defensively, not trusted as a type.
 */
const ZOOM_VALUES = ['week', 'month', 'quarter'];
```

`CollapseSnapshot` gains `zoom?: string | null`; `StoredEntry` gains `zoom?: string`;
`loadCollapseState` returns `zoom: entry?.zoom ?? null`; `saveCollapseState` writes it
under the same "a view at its defaults needs no entry" condition (add `&& zoom === null`
to that test and `if (zoom !== null) map[key].zoom = zoom;` beside the others);
`readEntry` validates `if (typeof record.zoom === 'string' && ZOOM_VALUES.includes(record.zoom)) entry.zoom = record.zoom;`
and adds `|| entry.zoom !== undefined` to its final "is this entry worth keeping" test.

- [ ] **Step 4: Hold it on the view's collapse state**

In `src/view/collapseState.ts`, beside `axis`:

```ts
	/** The retained timeline zoom; null until the user first picks one. */
	private zoom: string | null = null;
```

```ts
	/** The retained timeline zoom for this saved view — null before the user picks. */
	zoomPick(): string | null {
		return this.zoom;
	}

	setZoom(id: string): void {
		this.zoom = id;
		this.scheduleSave();
	}
```

`restore` adds `this.zoom = snapshot.zoom ?? null;` and `flush` passes `zoom: this.zoom`
into `saveCollapseState`.

- [ ] **Step 5: Write the failing view tests**

Create `test/view/timelineZoom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { cellLabels } from '../helpers/roadmap';
import { scaleFor } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function datedVault() {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
	return vault;
}

function zoomButton(containerEl: HTMLElement, label: string): HTMLButtonElement {
	const btn = containerEl.querySelector<HTMLButtonElement>(`.pbl-zoom-btn[aria-label="${label}"]`);
	if (!btn) throw new Error(`zoom button not found: ${label}`);
	return btn;
}

describe('the zoom control', () => {
	it('renders only on the dated axis, and states which scale is active', () => {
		const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		expect(zoomButton(containerEl, 'Zoom to months').getAttribute('aria-pressed')).toBe('true');
		zoomButton(containerEl, 'Zoom to quarters').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(zoomButton(containerEl, 'Zoom to quarters').getAttribute('aria-pressed')).toBe('true');
		expect(view.zoom).toBe('quarter');
	});

	it('is absent in tree mode, on the board, and on the horizon axis', () => {
		const vault = datedVault();
		vault.addFile('Triaged.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, horizonProperty: 'note.horizon' }, { collapsed: true });

		expect(containerEl.querySelector('.pbl-zoom-picker')).toBeNull();
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(containerEl.querySelector('.pbl-zoom-picker')).toBeNull();
		view.setAxisPick('dates');
		expect(containerEl.querySelector('.pbl-zoom-picker')).not.toBeNull();
	});

	it('comes back at the scale it was left, across a reopen', () => {
		// A round trip, not a store call: `CollapseState` is what holds this, and a
		// store-only change gives a picker that works all session and reverts the moment
		// the view is reopened — nothing fails until someone comes back the next day.
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		first.view.setProjection('roadmap');
		first.view.setZoom('week');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(second.view.zoom).toBe('week');
	});

	it('is session-only in an embedded base — the exception it joins, checked not assumed', () => {
		// `collapseStoreIdentity` deliberately returns no identity for an embedded view,
		// so nothing persists there today: not collapse state, not the mode, not the
		// axis, and now not the zoom. That gap is [[Embedded bases do not persist
		// collapse state]]'s, and minting an identity is a collision question about
		// where a base is embedded, not a timeline question.
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true });
		first.view.setProjection('roadmap');
		first.view.setZoom('week');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true });
		expect(second.view.zoom).toBe('month');
	});

	it('redraws the header at the picked unit without touching a note', () => {
		const vault = datedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		view.setZoom('quarter');
		expect(cellLabels(containerEl).some((l) => /^Q[1-4] \d{4}$/.test(l))).toBe(true);
		expect(vault.writeLog).toHaveLength(0);
		expect(scaleFor(view.zoom).dayPx).toBe(2);
	});
});

describe('jump to today', () => {
	it('puts today back in view from a scrolled position', () => {
		const vault = datedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('no timeline scroller');
		Object.defineProperty(scroller, 'clientWidth', { value: 600, configurable: true });
		scroller.scrollLeft = 4000;

		containerEl.querySelector<HTMLButtonElement>('.pbl-today-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const todayLeft = view.roadmap?.todayLeft ?? 0;
		expect(scroller.scrollLeft).toBe(Math.max(todayLeft - 300, 0));
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run test/view/timelineZoom.test.ts`
Expected: FAIL — `view.setZoom is not a function`.

- [ ] **Step 7: Expose the zoom on the host**

`src/view/host.ts`:

```ts
	/**
	 * Which density the dated axis draws at. UI state like the mode and the axis pick:
	 * per saved view, per device, in the collapse store — never in the `.base`, because
	 * pane width is a property of the screen in front of you and not of the base.
	 */
	readonly zoom: ScaleId;
	/** Pick a density and re-render; the collapse store persists it. */
	setZoom(id: ScaleId): void;
	/** Put today back in the middle of the timeline's scroller, from any position. */
	jumpToToday(): void;
```

`src/view/backlogView.ts`:

```ts
	get zoom(): ScaleId {
		return scaleFor(this.collapse.zoomPick()).id;
	}

	setZoom(id: ScaleId): void {
		if (id === this.zoom) return;
		this.collapse.setZoom(id);
		// UI state like the mode and the pick: no config was set, so no Bases refresh is
		// coming and this render is the change.
		this.render();
	}

	jumpToToday(): void {
		const roadmap = this.roadmap;
		if (!roadmap?.scroller || roadmap.todayLeft === null) return;
		roadmap.scroller.scrollLeft = Math.max(roadmap.todayLeft - roadmap.scroller.clientWidth / 2, 0);
	}
```

- [ ] **Step 8: Add the two toolbar controls**

In `src/view/render/toolbar.ts`, called from `renderToolbar` beside `renderAxisPicker`:

```ts
/**
 * The zoom picker and jump-to-today, on the dated axis alone — the horizon axis has no
 * density to choose and no today to return to. Segmented buttons like the axis picker,
 * because the choice is one of three and a menu would hide two of them.
 */
function renderTimelineControls(host: BacklogViewHost, barEl: HTMLElement): void {
	if (host.projection !== 'roadmap' || activeAxis(host.settings, host.axisPick) !== 'dates') return;
	const wrap = barEl.createDiv({ cls: 'pbl-zoom-picker', attr: { role: 'group', 'aria-label': 'Timeline zoom' } });
	const position = (id: ScaleId, icon: string, label: string) => {
		const btn = iconButton(wrap, icon, label);
		btn.addClass('pbl-zoom-btn');
		btn.toggleClass('is-active', host.zoom === id);
		btn.setAttribute('aria-pressed', String(host.zoom === id));
		btn.addEventListener('click', () => host.setZoom(id));
	};
	position('week', 'calendar-days', 'Zoom to weeks');
	position('month', 'calendar', 'Zoom to months');
	position('quarter', 'calendar-range', 'Zoom to quarters');
	const today = iconButton(barEl, 'locate-fixed', 'Jump to today');
	today.addClass('pbl-today-btn');
	today.addEventListener('click', () => host.jumpToToday());
}
```

`ScaleId` joins the imports from `../../domain/timeline`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run test/view/timelineZoom.test.ts test/view/roadmapFrame.test.ts test/storage/collapseStore.test.ts test/view/persistence.test.ts`
Expected: PASS, including the three Task 7 cases that needed `setZoom`.

- [ ] **Step 10: Watch the persistence fail where it actually breaks**

Comment out `this.zoom = snapshot.zoom ?? null;` in `CollapseState.restore`, run the
round-trip case, and see it come back at `month` — the store still holds `week`. That is
the shape of the bug this test exists for. Restore it.

- [ ] **Step 11: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/domain/timeline.ts src/storage/collapseStore.ts src/view styles/timeline.css test
git commit -m "Draw the grid at three densities, and remember which one this screen chose"
```

---

### Task 9: The frame owns its own height, and every band keeps its place

**Files:**
- Modify: `styles/roadmap.css`, `styles/timeline.css`
- Modify: `src/view/render/roadmap.ts`, `src/view/render/timeline.ts`
- Modify: `src/view/render/projections.ts`
- Modify: `src/view/host.ts`, `src/view/backlogView.ts`
- Test: `test/view/roadmapFrame.test.ts`, `test/view/timelineZoom.test.ts`

**Interfaces:**
- Produces:
  - `export interface ScrollBox { key: string; el: HTMLElement }` (host.ts)
  - `RoadmapSnapshot` gains `scroller: HTMLElement | null`, `boxes: ScrollBox[]`,
    `window: TimelineWindow | null`, `scale: TimelineScale | null`
  - `ScrollAnchor` gains `scale: string | null`, `offsets: Record<string, { top: number; left: number }>`,
    `leadingDate: CivilDate | null`
  - `export function captureScroll(treeEl, roadmap, anchor): ScrollAnchor` (projections.ts)
  - `restoreScroll(treeEl, anchor, roadmap, projection): ScrollAnchor` — the `saved`
    parameter goes; it reads what `captureScroll` put on the anchor

**The stylesheet change is the load-bearing half, and it is a two-axis move.** The pane
is the scroll box today because `.pbl-roadmap-mode .pbl-tree` is `overflow-x: auto`
while `.pbl-roadmap` is `min-width: max-content`. `.pbl-timeline-header` is
`sticky; top: 0` and `.pbl-timeline-lead` is `sticky; left: 0`, and both pin against the
pane precisely because the pane is the one scroll box for both axes. Give the timeline
an `overflow-x` alone and the header pins to the top of a full-height element and
scrolls away with the pane — the month labels leaving the screen while the grid they
name stays. So the timeline becomes the scroll box for **both** axes on the dated axis,
and the pane scrolls neither way in the ordinary case.

**The band rule**, stated as a rule because the frame has more bands than the two that
prompted it:

> The timeline takes what is left; **every other band declares a maximum and scrolls
> itself.**

No exceptions. Both bands carved out of earlier drafts — the context strip by omission,
the advisory by an "it is one line" that was simply wrong about the DOM
(`renderRoadmapAdvisory` delegates to `renderEmptyState`: an icon, a title, wrapping
text and a button) — were the defect, and the rule was the fix.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/roadmapFrame.test.ts`:

```ts
describe('the dated frame’s scroll boxes', () => {
	it('keeps each band’s place by WHICH BAND IT IS, never by its position', () => {
		// The bands are conditional — the context strip renders only with context rows,
		// the advisory only when no cards do — so a filter can change which bands exist
		// between two renders, and a positional pairing would restore the context
		// strip's offset onto the advisory and open it scrolled past its own heading.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const shelfEl = shelfOf(containerEl);
		if (!shelfEl) throw new Error('no shelf');
		shelfEl.scrollTop = 120;

		refresh(view, vault);

		expect(shelfOf(containerEl)?.scrollTop).toBe(120);
	});

	it('starts a band that has just appeared at the top', () => {
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		shelfOf(containerEl)!.scrollTop = 120;
		view.setAxisPick('horizons');
		view.setAxisPick('dates');
		// Different drawn content — the roadmap's two axes are different content on one
		// frame — so every band starts at the top rather than inheriting the other
		// axis's shelf offset.
		expect(shelfOf(containerEl)?.scrollTop).toBe(0);
	});

	it('captures the offsets from the OLD scroller, before the DOM goes', () => {
		// `renderTreeContent` reads `treeEl.scrollTop/scrollLeft` just before
		// `treeEl.empty()` — the PANE, which on this axis no longer scrolls. Restoring
		// those would silently discard the reader's pan and jump back to today on every
		// refresh. Capture and restore are one decision about which element the scroll
		// box is, and they have to name the same one.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		scroller!.scrollLeft = 900;

		refresh(view, vault);

		expect(containerEl.querySelector<HTMLElement>('.pbl-timeline')?.scrollLeft).toBe(900);
	});
});

describe('preserving a place across a zoom change', () => {
	it('reopens at the same DATE, not the same pixel count', () => {
		// A zoom redefines what a pixel is worth: a day a hundred days out sits 400px
		// away at month zoom and 200px at quarter. `restoreScroll`'s existing
		// `saved + (newTodayLeft - oldTodayLeft)` correction cannot see it — it corrects
		// for the window moving, not for the ruler changing. Driven while PANNED AWAY
		// from today, since at today the two rules agree and the bug is invisible.
		const vault = shelfHeavyVault();
		const { view, containerEl } = datedRoadmap(vault);
		const scroller = () => containerEl.querySelector<HTMLElement>('.pbl-timeline')!;
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window');
		const monthPx = scaleFor('month').dayPx;
		scroller().scrollLeft = 100 * monthPx;
		const leading = dayAt(window, scaleFor('month'), scroller().scrollLeft);

		view.setZoom('quarter');

		const after = view.roadmap?.window;
		expect(dayAt(after!, scaleFor('quarter'), scroller().scrollLeft)).toEqual(leading);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/roadmapFrame.test.ts -t 'scroll boxes'`
Expected: FAIL — the shelf's offset is not captured at all, so it comes back 0.

- [ ] **Step 3: Return the frame's scroll boxes**

`src/view/host.ts`:

```ts
/** One scroll box the frame owns, keyed by WHICH BAND IT IS rather than by position. */
export interface ScrollBox {
	key: string;
	el: HTMLElement;
}
```

`RoadmapSnapshot` gains:

```ts
	/**
	 * The element that scrolls the timeline — both axes on the dated one. Null off it,
	 * where the pane is still the scroll box, which is every other projection.
	 */
	scroller: HTMLElement | null;
	/**
	 * Every scroll box in the frame, the pane excluded (the view adds that). Bounding
	 * the bands turned each of them into a scroll box of its own, and a rebuild empties
	 * the whole pane: the shelf is the one that bites, because scheduling a card IS a
	 * rebuild, so a reader working down a long shelf would be thrown back to its top on
	 * every drop.
	 */
	boxes: ScrollBox[];
	/** The window the grid drew, for the drag's px↔date and for the zoom anchor. */
	window: TimelineWindow | null;
	scale: TimelineScale | null;
```

`renderRoadmap` collects them: `{ key: 'timeline', el: timeline.scroller }`,
`{ key: 'shelf', el: shelfCardsEl }`, `{ key: 'context', el: contextCardsEl }`,
`{ key: 'advisory', el: asideEl }`, each pushed only where that band rendered. The keys
are literals in one place, so a band added later declares its own.

- [ ] **Step 4: Capture before the DOM goes, restore by identity**

`src/view/render/projections.ts`:

```ts
/** The scroller's memory across renders: what it drew, at what scale, and where each band sat. */
export interface ScrollAnchor {
	content: string;
	todayLeft: number | null;
	/** The scale the offsets were measured at; null off the dated axis. */
	scale: string | null;
	/** Each band's own offsets, by identity — never by position in a collection. */
	offsets: Record<string, { top: number; left: number }>;
	/** The civil date at the timeline's leading edge, which is what a zoom change preserves. */
	leadingDate: CivilDate | null;
}

/** The pane plus whatever bands the frame owns. One list, so capture and restore agree. */
function scrollBoxes(treeEl: HTMLElement, roadmap: RoadmapSnapshot | null): ScrollBox[] {
	// The pane is one of these, not an exception to them: it stops scrolling on the
	// dated axis in the ordinary case, but the short-pane fallback gives it a vertical
	// offset again. Conditioning the capture on whether that fallback is active would be
	// a second question to keep in step with the layout; capturing a zero costs nothing.
	return [{ key: 'pane', el: treeEl }, ...(roadmap?.boxes ?? [])];
}

/**
 * Read every band's offset off the DOM that is about to be destroyed. Called from the
 * view BEFORE `treeEl.empty()`, against the PREVIOUS snapshot — reading the pane there
 * would capture a box that no longer scrolls on this axis, and restoring that would
 * discard the reader's pan on every refresh.
 */
export function captureScroll(treeEl: HTMLElement, roadmap: RoadmapSnapshot | null, anchor: ScrollAnchor): ScrollAnchor {
	const offsets: Record<string, { top: number; left: number }> = {};
	for (const box of scrollBoxes(treeEl, roadmap)) {
		offsets[box.key] = { top: box.el.scrollTop, left: box.el.scrollLeft };
	}
	const scroller = roadmap?.scroller ?? null;
	const leadingDate =
		scroller && roadmap?.window && roadmap.scale ? dayAt(roadmap.window, roadmap.scale, scroller.scrollLeft) : null;
	return { ...anchor, offsets, leadingDate };
}

export function restoreScroll(
	treeEl: HTMLElement,
	anchor: ScrollAnchor,
	roadmap: RoadmapSnapshot | null,
	projection: Projection,
): ScrollAnchor {
	const todayLeft = roadmap?.todayLeft ?? null;
	const drawn = todayLeft != null ? 'dates' : roadmap ? 'horizons' : projection;
	const scale = roadmap?.scale?.id ?? null;
	// Band identity applies WITHIN the same drawn content, which is the rule that was
	// already here: both frames have a band called the shelf, holding different cards
	// under different layouts, so matching on the band name alone would restore a
	// deeply scrolled dated shelf onto the horizon one.
	const same = drawn === anchor.content;
	const scroller = roadmap?.scroller ?? treeEl;
	for (const box of scrollBoxes(treeEl, roadmap)) {
		const saved = same ? anchor.offsets[box.key] : undefined;
		box.el.scrollTop = saved?.top ?? 0;
		// The one box whose horizontal offset is decided by the anchor policy below.
		if (box.el !== scroller) box.el.scrollLeft = saved?.left ?? 0;
	}
	scroller.scrollLeft = anchorScrollLeft(anchor, same, scale, todayLeft, roadmap, scroller.clientWidth);
	return { content: drawn, todayLeft, scale, offsets: {}, leadingDate: null };
}

/**
 * Where the horizontal offset belongs. Three cases, in the order they are decided:
 *
 * - different content — the switch — centres on today, or starts at 0 where there is
 *   no today to centre on;
 * - the same content at a DIFFERENT scale keeps the DATE at the leading edge, not the
 *   pixel count: a zoom redefines what a pixel is worth, and the existing
 *   today-correction below cannot see it, because it corrects for the window moving
 *   rather than for the ruler changing;
 * - the same content at the same scale keeps the pixel carry, corrected by how far
 *   today moved — exact for that case, which is every ordinary refresh.
 */
function anchorScrollLeft(
	anchor: ScrollAnchor,
	same: boolean,
	scale: string | null,
	todayLeft: number | null,
	roadmap: RoadmapSnapshot | null,
	viewport: number,
): number {
	if (!same) return todayLeft == null ? 0 : Math.max(todayLeft - viewport / 2, 0);
	if (scale !== anchor.scale && anchor.leadingDate && roadmap?.window && roadmap.scale) {
		return Math.max(daysBetween(roadmap.window.start, anchor.leadingDate) * roadmap.scale.dayPx, 0);
	}
	const saved = anchor.offsets['timeline']?.left ?? anchor.offsets['pane']?.left ?? 0;
	if (todayLeft != null && anchor.todayLeft != null) return Math.max(saved + (todayLeft - anchor.todayLeft), 0);
	return saved;
}
```

`src/view/backlogView.ts` — in `renderTreeContent`, replace the two `scrollTop` /
`scrollLeft` locals with the capture, taken from the snapshot that is about to be
destroyed:

```ts
		// Captured from the OLD frame, before its DOM goes: on the dated axis the pane
		// is not the scroll box, and reading it here would capture zeros.
		this.scroll = captureScroll(this.treeEl, this.roadmap, this.scroll);
		this.treeEl.empty();
```

and later `this.scroll = restoreScroll(this.treeEl, this.scroll, this.roadmap, projection);`.

- [ ] **Step 5: Give the frame its height**

`styles/roadmap.css` — the axis class is toggled in `backlogView.ts` beside the mode
class (`this.viewEl.toggleClass('pbl-roadmap-dates', projection === 'roadmap' && activeAxis(this.settings, this.axisPick) === 'dates')`).
A `:has()` selector would need no new state and is the reason to mention it, but it is
the clever answer to a question the boring one already closes, and it raises specificity
in a stylesheet whose ordering is documented as load-bearing.

```css
/* On the dated axis the FRAME owns its height and the timeline is the scroll box, so
   the pane scrolls neither way in the ordinary case. The vertical fallback stays: a
   floor plus four maxima can exceed a short or embedded pane, and no allocation makes
   that fit — so the pane scrolls rather than clipping, because `.pbl-view` clips and a
   region nobody can reach is the one thing this must never produce. */
.pbl-roadmap-dates .pbl-tree {
	overflow-x: hidden;
	overflow-y: auto;
}

.pbl-roadmap-dates .pbl-roadmap {
	min-width: 0;
	height: 100%;
	min-height: 0;
}

/* THE BAND RULE, and it has no exceptions. The timeline takes what is left; every
   other band declares a maximum and scrolls itself. Saying a band "scrolls itself"
   creates no scrollport — cards and rows wrap to an intrinsic height — so each one
   needs its own `overflow-y` as well as its cap, or an unbounded band in a short pane
   grows until it squeezes the timeline out. A band added later declares a maximum too,
   and nobody has to remember this paragraph to get that right. */
.pbl-roadmap-dates .pbl-timeline {
	flex: 1 1 auto;
	min-height: 0;
	/* The floor beneath which the grid stops yielding; below it the pane scrolls. */
	min-height: 180px;
}

.pbl-roadmap-dates .pbl-shelf,
.pbl-roadmap-dates .pbl-roadmap-context,
.pbl-roadmap-dates .pbl-board-advisory {
	flex: 0 1 auto;
	max-height: 30%;
	overflow-y: auto;
	/* Not sticky here: the frame no longer scrolls sideways under them. */
	position: static;
	width: auto;
}
```

`styles/timeline.css` — the two elements:

```css
/* The scroll box, on BOTH axes. Not `.pbl-timeline-content`: full-height marks resolve
   `top: 0; bottom: 0` against their containing block's padding box, so making the
   scroll box the containing block would make every line viewport-tall and scroll away. */
.pbl-timeline {
	overflow: auto;
}

.pbl-timeline-content {
	position: relative;
	/* Over a minimum of the scrollport, because `max-content` alone is the height of
	   the rows that exist: a timeline with few bars — or none, which is the state every
	   fresh backlog starts in — would leave the blank grid below the last row outside
	   the drop overlay and refusing drops, while [[Roadmap empty states]] requires
	   every region of the frame to be a drop target. */
	width: max-content;
	min-width: 100%;
	height: max-content;
	min-height: 100%;
}
```

Sticky still works through the wrapper: the nearest scrollport is the outer box and the
wrapper's own `overflow` stays `visible`, so `.pbl-timeline-header` and
`.pbl-timeline-lead` keep pinning as they do now.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view`
Expected: PASS.

- [ ] **Step 7: Watch the capture point fail**

Move the `captureScroll` call to AFTER `this.treeEl.empty()`, run
`npx vitest run test/view/roadmapFrame.test.ts -t 'before the DOM goes'`, and see the
pan come back as 0. Restore. A half-applied version of this change is worse than none,
because it restores a real offset onto the wrong box.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view styles test/view
git commit -m "Move the scroll box inside the timeline, and key every band's place by name"
```

**What jsdom cannot answer here** — this is the part of the increment where the checks
genuinely stop short of the claims, so the claims go on the smoke note (Task 15): jsdom
computes no layout, so a test can assert which element carries the class and never that
the pane stopped overflowing, that the header and the lead column held their place while
the rows moved under them, or that nothing clips under the header in an embedded base.

---

### Task 10: The shelf compacts, and the way back is a real control

**Files:**
- Modify: `src/view/render/toolbar.ts`
- Modify: `src/view/render/roadmap.ts`
- Modify: `src/view/render/projections.ts`
- Modify: `src/view/host.ts`, `src/view/backlogView.ts`
- Modify: `src/view/interactions/keyboard.ts`
- Modify: `styles/timeline.css`
- Test: `test/view/timelineZoom.test.ts`

**Interfaces:**
- Produces:
  - `BacklogViewHost.shelfOpen: boolean | null` — null means "no press yet, the width
    decides"; `setShelfOpen(open: boolean): void`
  - `RoadmapSnapshot.shelfId: string | null`, `RoadmapSnapshot.shelfEl: HTMLElement | null`
  - `export function syncShelfToggle(host, barEl): void` (toolbar.ts)
  - `export function syncShelfFit(host, treeEl): void` (roadmap.ts) — the measuring pass

Five things have to be true together, and each was a separate defect in an earlier
draft:

1. **The control is a real button in the TOOLBAR.** Hiding the cards in CSS alone would
   strand every unplaced card until the pane was widened — the opposite of "may lose its
   card, never its existence". Making the shelf HEADER the button puts a focusable
   non-option child inside the `role="listbox"` the pane wears whenever cards render,
   which is a second tab stop in a composite that has exactly one.
2. **One decider, not two.** A container query plus a button desynchronise: at a wide
   pane the query shows the cards while the flag still says closed, so the control would
   announce "collapsed" over visible content. CSS cannot write an ARIA attribute, so the
   compaction is measured in code and applied as a class — the same shape as
   `pbl-hide-props` and its siblings.
3. **Its own measuring pass.** The post-render refit and `onResize` both return early
   for every non-tree projection, with a stated reason that stays true: board columns
   and the timeline scroll rather than dropping columns, so the COLUMN ladder is the
   tree's. What changes is that the roadmap now has a measured question of its own.
   No second render pass and no `refitting` guard: a column coming or going can only be
   shown by rebuilding the rows, while the shelf's cards are already in the DOM.
4. **Hidden cards leave the navigable set.** `renderShelf` puts every shelf item in
   `snapshot.cards` and the arrow handler walks it unconditionally, so a class-only
   collapse would let Arrow and End select a card nobody can see and point
   `aria-activedescendant` at hidden content.
5. **The pane's role is resolved AFTER that.** `renderRoadmapContent` picks `listbox` or
   `region` from `roadmap.cards.length` at render time; on a narrow pane whose only
   cards are shelved, every option leaves the navigable set and the pane would stay an
   empty `listbox`.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineZoom.test.ts`:

```ts
describe('the shelf on a narrow pane', () => {
	function shelvedVault() {
		const vault = new FakeVault();
		vault.addFile('Dated.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		for (let i = 0; i < 6; i++) vault.addFile(`Unplanned ${i}.md`, { frontmatter: { type: 'PBI', order: 20 + i } });
		return vault;
	}

	function widthOf(el: HTMLElement, width: number) {
		Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
	}

	it('compacts on a narrow pane and states so on a real control', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		const toggle = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle');
		expect(toggle?.getAttribute('aria-expanded')).toBe('false');
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(true);
		// The way back is a press, not an arrow into the dark: a real focusable control
		// outside the composite, naming the region it controls.
		expect(toggle?.getAttribute('aria-controls')).toBe(shelfOf(containerEl)?.id);
	});

	it('a press overrides the width, and survives the rebuild a write causes', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);

		refresh(view, vault);
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);
	});

	it('answers a keyboard activation, because it is a real button', () => {
		// Asserted as a CONTROL, not as a class: it is the way back to cards a
		// measurement hid, so reaching it without a pointer is the whole point of
		// putting it in the toolbar rather than on the shelf's header.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();
		const toggle = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle');

		expect(toggle?.tagName).toBe('BUTTON');
		toggle?.focus();
		// Enter on a focused button dispatches a click; the harness's `key` helper does
		// not, so the activation is driven the way the browser would deliver it.
		toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

		expect(toggle?.getAttribute('aria-expanded')).toBe('true');
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);
	});

	it('measures again after a resize, not only on the first render', () => {
		// A fixture that is only ever measured once cannot fail this: the pane crosses
		// the threshold AFTER the first render, which is the case the tree's own ladder
		// needed a ResizeObserver for.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 900);
		view.render();
		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(false);

		widthOf(treeOf(containerEl), 320);
		(view as unknown as { onResize(): void }).onResize();

		expect(shelfOf(containerEl)?.hasClass('pbl-shelf-compact')).toBe(true);
	});

	it('takes hidden cards out of the navigable set and clamps a selection in them', () => {
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		const shelfCard = view.roadmap?.cards.at(-1);
		view.selectItem(shelfCard as never);

		widthOf(treeOf(containerEl), 320);
		(view as unknown as { onResize(): void }).onResize();

		// A keyboard user with no visible position is the worse half of "hidden versus
		// absent", so the selection is clamped the way a vanished board column already
		// clamps `selectedBoardColumn`.
		expect(view.roadmap?.cards.map((c) => c.file.path)).not.toContain(shelfCard?.file.path);
		expect(view.selectedPath).not.toBe(shelfCard?.file.path);
	});

	it('stops calling the pane a listbox when compaction leaves it no options', () => {
		const vault = new FakeVault();
		for (let i = 0; i < 6; i++) vault.addFile(`Unplanned ${i}.md`, { frontmatter: { type: 'PBI', order: 10 + i } });
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();

		expect(treeOf(containerEl).getAttribute('role')).toBe('region');
	});

	it('keeps the toggle pointing at the shelf a content-only render just rebuilt', () => {
		// The toolbar outlives the pane: a quick filter rebuilds the pane and leaves the
		// toolbar standing, so a per-render id would leave `aria-controls` naming a
		// detached node — which exposes no region at all. The id is fixed for the life of
		// the VIEW, not a constant: two saved views can sit in split panes.
		const vault = shelvedVault();
		const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		widthOf(treeOf(containerEl), 320);
		view.render();
		const before = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.getAttribute('aria-controls');

		view.setFilter('Unplanned');

		expect(containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle')?.getAttribute('aria-controls')).toBe(before);
		expect(shelfOf(containerEl)?.id).toBe(before);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/timelineZoom.test.ts -t 'narrow pane'`
Expected: FAIL — there is no `.pbl-shelf-toggle`.

- [ ] **Step 3: The open flag and the shelf's id**

`src/view/host.ts`:

```ts
	/**
	 * Whether the roadmap's shelf is expanded: true or false once the reader has
	 * pressed the toggle, null while the pane's width is still deciding. View state
	 * that survives a render — a rebuild must not re-collapse a strip the reader just
	 * opened — and deliberately NOT collapse-store state, which keys on paths and has
	 * nothing to key this on.
	 */
	readonly shelfOpen: boolean | null;
	setShelfOpen(open: boolean): void;
	/**
	 * The id the shelf element carries, fixed for the life of this VIEW. Per view
	 * rather than a constant: two saved views can sit in split panes, and duplicate
	 * ids would make one toolbar's toggle address the other's shelf.
	 */
	readonly shelfId: string;
```

`src/view/backlogView.ts`:

```ts
	/** Null until the reader presses: the pane's width decides until then. */
	private shelfOpenFlag: boolean | null = null;
	readonly shelfId = uniqueElementId('pbl-shelf');

	get shelfOpen(): boolean | null {
		return this.shelfOpenFlag;
	}

	setShelfOpen(open: boolean): void {
		this.shelfOpenFlag = open;
		// No render: the cards are already in the DOM and a class decides whether they
		// show, which is the whole reason this measure needs no second pass.
		syncShelfFit(this, this.treeEl);
		syncShelfToggle(this, this.toolbarEl);
	}
```

`uniqueElementId` already exists for the board's `aria-describedby`; reuse it rather
than minting a second id scheme.

- [ ] **Step 4: Measure, in one place, and apply as a class**

In `src/view/render/roadmap.ts`:

```ts
/** Below this the shelf's cards cost more than they are worth beside the grid. */
const SHELF_COMPACT_PX = 560;

/**
 * Resolve the shelf's compaction and apply it — the ONE decider. The width sets the
 * default and a press overrides it, and `aria-expanded` states whatever that resolved
 * to, because CSS cannot write an ARIA attribute and a container query plus a flag are
 * two deciders that desynchronise.
 *
 * It runs after render and on resize, gated to the dated axis, and it needs no second
 * render pass — unlike the column ladder, whose verdict can only be shown by rebuilding
 * the rows. So there is no `refitting` guard here, because there is no re-entry.
 *
 * Three things follow from the verdict and are done here, together, because separately
 * they were three defects: the class, the NAVIGABLE set (a hidden card an arrow can
 * still reach is a keyboard user with no visible position), and the pane's role (a
 * composite promising options it no longer has).
 */
export function syncShelfFit(host: BacklogViewHost, treeEl: HTMLElement): void {
	const snapshot = host.roadmap;
	if (!snapshot || snapshot.roadmap.axis !== 'dates' || !snapshot.shelfEl) return;
	// Two cases, not three: no press yet means the width decides, and a press means the
	// press decides. Written as one conditional so nothing else can be read into it.
	const compact = host.shelfOpen === null ? treeEl.clientWidth < SHELF_COMPACT_PX : !host.shelfOpen;
	snapshot.shelfEl.toggleClass('pbl-shelf-compact', compact);
	snapshot.cards = compact ? snapshot.allCards.filter((item) => !snapshot.shelfPaths.has(item.file.path)) : snapshot.allCards;
	// Resolved AFTER compaction, never at render: on a narrow pane whose only cards are
	// shelved, every option leaves the navigable set and the pane would stay an empty
	// listbox — a composite promising options it no longer has.
	treeEl.setAttribute('role', snapshot.cards.length > 0 ? 'listbox' : 'region');
}
```

Filtering `allCards` rather than `cards` matters: `syncShelfFit` runs again on every
resize, so narrowing the already-narrowed list would make each pass smaller than the
last and a widening resize could never restore what an earlier one removed.

`RoadmapSnapshot` gains `shelfEl: HTMLElement | null`, `allCards: BacklogItem[]` (the
unnarrowed reading order) and `shelfPaths: Set<string>`; `renderShelf` sets
`shelfEl.id = host.shelfId` and returns its element.

- [ ] **Step 5: Clamp a selection that has just left the set**

In `src/view/backlogView.ts`, after `syncShelfFit` runs:

```ts
		// A resize that collapses the strip clamps a selection already sitting in it,
		// the way a vanished board column already clamps `selectedBoardColumn`.
		if (this.selectedPath !== null && !this.roadmap?.cards.some((c) => c.file.path === this.selectedPath)) {
			this.clearSelection();
		}
```

`onResize` stops returning early for the roadmap:

```ts
	private onResize(): void {
		// The COLUMN ladder is the tree's — board columns and the timeline scroll rather
		// than dropping columns — and that reason stays true. What is new is that the
		// roadmap has a measured question of its own.
		if (this.projection === 'roadmap') {
			syncShelfFit(this, this.treeEl);
			syncShelfToggle(this, this.toolbarEl);
			return;
		}
		if (this.projection !== 'tree') return;
		if (this.refit()) this.renderTreeContent();
	}
```

and `renderTreeContent` calls the same two after the render, before `resyncAfterRender`.

- [ ] **Step 6: Build the toggle once, sync it every pass**

In `src/view/render/toolbar.ts`, built inside `renderTimelineControls` and updated by:

```ts
/**
 * Point the shelf toggle at the shelf as it currently stands. Synced rather than
 * conditionally rendered, for the reason `syncBusy`, `syncFilterUi` and
 * `syncCountLabel` are: a content-only render (the quick filter's) rebuilds the pane
 * and leaves the toolbar standing, so "render it only where the shelf does" cannot be
 * honoured — a filter that empties the shelf would leave the button standing, and one
 * that brings shelf cards back would leave it missing. Built once, updated here, so it
 * also keeps focus across a filter keystroke.
 */
export function syncShelfToggle(host: BacklogViewHost, barEl: HTMLElement): void {
	const btn = barEl.querySelector<HTMLButtonElement>('.pbl-shelf-toggle');
	if (!btn) return;
	const shelf = host.roadmap?.shelfEl ?? null;
	btn.toggleClass('pbl-hidden-ctl', shelf === null);
	if (shelf === null) return;
	const open = !shelf.hasClass('pbl-shelf-compact');
	btn.setAttribute('aria-expanded', String(open));
	btn.setAttribute('aria-controls', host.shelfId);
	btn.setAttribute('aria-label', open ? 'Collapse unplaced items' : 'Expand unplaced items');
	btn.toggleClass('is-active', !open);
}
```

and in `renderTimelineControls`:

```ts
	const shelfBtn = iconButton(barEl, 'inbox', 'Collapse unplaced items');
	shelfBtn.addClass('pbl-shelf-toggle');
	shelfBtn.addEventListener('click', () => host.setShelfOpen(host.roadmap?.shelfEl?.hasClass('pbl-shelf-compact') ?? true));
```

The shelf HEADER keeps its icon, label and count and stays a `div`.

- [ ] **Step 7: The compact class**

`styles/timeline.css`:

```css
/* Compacted to its labelled count: an unplaced result may lose its card, never its
   existence — and the way back is the toolbar's toggle, which is a real focusable
   control outside the pane's composite. This is the ONLY compaction in the frame,
   because it is the only band with a control that reopens it: every other band shrinks
   toward its minimum and keeps scrolling, and hiding cards with no way back is the
   unreachable region the band rule exists to forbid. */
.pbl-shelf-compact .pbl-shelf-cards {
	display: none;
}

/* A control for a region that is not on screen is a defect in the other direction. */
.pbl-hidden-ctl {
	display: none;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run test/view`
Expected: PASS.

- [ ] **Step 9: Watch the navigable-set narrowing fail**

Delete the `snapshot.cards = compact ? … : …` line, run the fourth case, and see an
arrow reach a card nobody can see. Restore.

- [ ] **Step 10: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view styles/timeline.css test/view
git commit -m "Compact the shelf where the pane is narrow, and give it a way back"
```

---

### Task 11: The drop overlay, and a shelf card scheduled where the pointer says

**Files:**
- Modify: `src/view/interactions/cardDrag.ts`
- Create: `src/view/interactions/timelineDrag.ts`
- Modify: `src/view/render/timeline.ts`, `src/view/render/roadmap.ts`
- Modify: `styles/timeline.css`
- Test: `test/view/timelineDrag.test.ts` (create), `test/helpers/dnd.ts`

**Interfaces:**
- Consumes: `dayAt`, `addDays`, `cellSpan` (Task 1); `barHolds`, `BarHold` (Task 2);
  `performScheduleMove` (Task 6); `RoadmapSnapshot.window` / `.scale` / `.scroller` (Task 9).
- Produces:
  - `export interface CardSource { item: BacklogItem; hold: BarHold | null }` (cardDrag.ts)
  - `CardDragController.wireCard(el, item, hold?: BarHold)` — the hold rides the payload
  - `CardDragController.wireDropTarget(el, plan, accepts?: (source: CardSource) => boolean)`
  - `CardDragController.wirePositionalTarget(el, handlers)` where handlers are
    `{ onDrag(source, clientX): void; onDrop(source, clientX): void; onLeave(): void }`
  - `export function wireTimelineDrag(ctx: RowContext, dnd: CardDragController, parts: TimelineParts): void`
    (timelineDrag.ts), `TimelineParts { overlay; content; window; scale; today }`

**The registration is not new, and must not be.** `CardDragController` holds a private
`token` whose comment states the hazard exactly: the adapter's registry is
document-global, two saved views can sit in split panes over the same notes, and a card
that crosses between them resolves its path against the receiving view's model and
writes ITS keys. On the timeline the stakes are the receiving view's `startKey` /
`targetKey`. So every timeline source and target registers **through the controller** —
one place mints the identity, and `timelineDrag.ts` decides what a position means.

**The drop target is one overlay, not "the track".** There is no single track to
register: `.pbl-timeline-track` is created once inside the header and again inside every
row, so registering any one of them would take drops over that row alone and none over
the gaps or the empty space below the last row — most of the grid a user would aim at.
One overlay rather than a target per row, because without lanes **the row a drop lands
on carries no meaning**: the dragged item is the subject and only the X says anything.
[[Lanes on the roadmap]] owns the combined batch and will be reworking this area anyway.

- [ ] **Step 1: Write the failing tests**

Create `test/view/timelineDrag.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, treeOf, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { rowFor, shelfOf } from '../helpers/roadmap';
import { addDays, dayAt, scaleFor } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function scheduleVault() {
	const vault = new FakeVault();
	vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
	vault.addFile('Unplanned.md', { frontmatter: { type: 'PBI', order: 20 } });
	return vault;
}

function datedView(vault: FakeVault, values: Record<string, unknown> = DATE_AXIS) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	// EVERY pointer case is driven against a panned grid at a nonzero viewport offset:
	// a fixture at the origin with no scroll passes whether or not the pointer is
	// converted at all.
	pannedGrid(harness.containerEl, { rectLeft: 220, scrollLeft: 640 });
	return { ...harness, vault };
}

describe('dragging a shelf card onto the grid', () => {
	it('writes the day under the pointer, spanning the zoom’s cell', async () => {
		const vault = scheduleVault();
		const { view, containerEl } = datedView(vault);
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window');
		const scale = scaleFor('month');
		const day = dayAt(window, scale, 300);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), overlayOf(containerEl), { clientX: 220 + 300 - 640 + 640 });
		await flush();

		// Start is the day under the pointer; target is start plus the cell, minus a
		// day — a duration that still decays with distance, without the write's own
		// granularity ever changing. `start === target` would render as a MILESTONE
		// diamond, so a dropped PBI would arrive looking like a deadline.
		expect(vault.fm('Unplanned.md').start).toBe(iso(day));
		expect(vault.fm('Unplanned.md').target).toBe(iso(addDays(day, 30)));
	});

	it('writes a marker’s target alone, at the drop day, with no span offset', async () => {
		// Extension 2e, and the `cellSpan` rule: a duration is supplied only where a
		// SPAN is written; a one-ended plan takes the drop day. Offsetting a lone date
		// by a week because the reader zoomed out is the silent coarsening decision 1
		// refuses — and on a deadline it moves the one date a gesture must never move.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10 } });
		const { view, containerEl } = datedView(vault);
		const day = dayAt(view.roadmap!.window!, scaleFor('month'), 300);

		gridDrag(cardByTitle(containerEl, 'Ship'), overlayOf(containerEl), { clientX: 220 + 300 });
		await flush();

		expect(vault.fm('Ship.md').target).toBe(iso(day));
		expect(vault.fm('Ship.md').start).toBeUndefined();
	});

	it('takes the drop day with no offset where only ONE date property is configured', async () => {
		const vault = scheduleVault();
		const { view, containerEl } = datedView(vault, { targetProperty: 'note.target' });
		const day = dayAt(view.roadmap!.window!, scaleFor('month'), 300);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), overlayOf(containerEl), { clientX: 220 + 300 });
		await flush();

		expect(vault.fm('Unplanned.md').target).toBe(iso(day));
	});

	it('offers a marker no grip at all where its target key is unconfigured', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10 } });
		const { containerEl } = datedView(vault, { startProperty: 'note.start' });

		expect(cardByTitle(containerEl, 'Ship').getAttribute('draggable')).not.toBe('true');
	});

	it('writes nothing when the drag ends off both the grid and the shelf', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), treeOf(containerEl), { clientX: 400 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('previews the dates before the release, and clears them when the pointer leaves', () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const overlay = overlayOf(containerEl);

		const finish = gridDrag.start(cardByTitle(containerEl, 'Unplanned'));
		finish.over(overlay, { clientX: 220 + 300 });
		expect(overlay.querySelector('.pbl-drop-ghost')).not.toBeNull();
		expect(overlay.querySelector('.pbl-drop-ghost-dates')?.textContent).toContain('2026-');
		finish.leave(overlay);
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
	});
});

function iso(date: { year: number; month: number; day: number }): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
```

Add to `test/helpers/dnd.ts`:

```ts
/**
 * Put the timeline at a nonzero viewport offset AND a nonzero scroll. jsdom computes
 * no layout, so both have to be stubbed — and both have to be nonzero, because a
 * fixture at the origin passes whether or not the pointer is converted at all.
 */
export function pannedGrid(containerEl: HTMLElement, { rectLeft, scrollLeft }: { rectLeft: number; scrollLeft: number }): void {
	const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
	const overlay = containerEl.querySelector<HTMLElement>('.pbl-timeline-drop');
	if (!scroller || !overlay) throw new Error('the timeline is not rendered');
	scroller.scrollLeft = scrollLeft;
	Object.defineProperty(scroller, 'clientWidth', { value: 600, configurable: true });
	// The overlay starts PAST the sticky lead column, so that exclusion is structural
	// rather than a constant kept in step with the CSS — and a bounding rect already
	// moves with the scroll, which is why a placing read adds no scroll term.
	overlay.getBoundingClientRect = () =>
		({ left: rectLeft - scrollLeft, right: 4000, top: 0, bottom: 400, width: 4000, height: 400, x: rectLeft - scrollLeft, y: 0, toJSON: () => ({}) }) as DOMRect;
}

export function overlayOf(containerEl: HTMLElement): HTMLElement {
	const overlay = containerEl.querySelector<HTMLElement>('.pbl-timeline-drop');
	if (!overlay) throw new Error('no drop overlay');
	return overlay;
}

/** A positional drag: start, move over the target at a viewport X, drop there. */
export function gridDrag(source: HTMLElement, target: HTMLElement, at: { clientX: number }): void {
	const gesture = gridDrag.start(source);
	gesture.over(target, at);
	gesture.drop(target, at);
}

gridDrag.start = (source: HTMLElement) => {
	const dt = fakeDataTransfer();
	source.dispatchEvent(dragEvent('dragstart', dt));
	return {
		over: (target: HTMLElement, at: { clientX: number }) => {
			target.dispatchEvent(dragEvent('dragenter', dt, { ...at, clientY: 20 }));
			target.dispatchEvent(dragEvent('dragover', dt, { ...at, clientY: 20 }));
		},
		leave: (target: HTMLElement) => target.dispatchEvent(dragEvent('dragleave', dt, { clientX: 0, clientY: 0 })),
		drop: (target: HTMLElement, at: { clientX: number }) => target.dispatchEvent(dragEvent('drop', dt, { ...at, clientY: 20 })),
	};
};
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/timelineDrag.test.ts`
Expected: FAIL — `the timeline is not rendered` (no `.pbl-timeline-drop`).

- [ ] **Step 3: Let the payload carry the hold, and add a positional target**

In `src/view/interactions/cardDrag.ts`:

```ts
/** A resolved drag source: the card's item, and which hold was taken on a bar. */
export interface CardSource {
	item: BacklogItem;
	/** Null for an ordinary card — a bucket's, the shelf's, the board's. */
	hold: BarHold | null;
}
```

`wireCard` gains `hold: BarHold | null = null` and puts it on the payload
(`getInitialData: () => ({ path: item.file.path, hold, view: this.token })`).

`wireDropTarget` gains an optional `accepts`:

```ts
	wireDropTarget(el: HTMLElement, plan: (item: BacklogItem) => void, accepts?: (source: CardSource) => boolean): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				// Only this view's own drags, and — where the caller asks — only the
				// sources this region actually honours. REFUSED rather than ignored, so
				// the strip never highlights for a drag it would not act on, the same
				// reason a foreign view's card is refused instead of dropped silently.
				canDrop: ({ source }) => source.data.view === this.token && (!accepts || accepts(this.resolve(source.data))),
				…
```

with the resolution factored out, since three call sites now need it:

```ts
	/**
	 * The item a payload names, resolved at DROP time — the dragged path outlives the
	 * model it was taken from, because a refresh mid-drag can drop the note.
	 *
	 * The `typeof` is the TYPE system's, not a runtime case: pragmatic hands
	 * `source.data` back as `Record<string, unknown>`, while `canDrop` admits only a
	 * source carrying this controller's private token and the one place minting that
	 * token pairs it with `item.file.path`, a string, always.
	 */
	private resolve(data: Record<string, unknown>): CardSource | null {
		const path = data.path;
		const item = typeof path === 'string' ? this.host.model?.byPath.get(path) : undefined;
		if (!item) return null;
		return { item, hold: (data.hold as BarHold | null | undefined) ?? null };
	}
```

`canDrop`'s `accepts` arm takes `this.resolve(source.data)` and treats null as refused.

And the positional sibling:

```ts
	/**
	 * A region where the POSITION of the pointer is the message, not merely the region
	 * — the timeline's grid. Registered through this controller like every other
	 * target, so it gates on the same private token and keeps the same
	 * resolve-at-drop-time rule: the stakes here are the RECEIVING view's date keys, so
	 * a card crossing between two split panes would write a different property than the
	 * gesture showed.
	 *
	 * What a position MEANS is the caller's, exactly as `plan` is for a region target.
	 */
	wirePositionalTarget(
		el: HTMLElement,
		handlers: {
			onDrag: (source: CardSource, clientX: number) => void;
			onDrop: (source: CardSource, clientX: number) => void;
			onLeave: () => void;
		},
	): void {
		this.cleanups.push(
			dropTargetForElements({
				element: el,
				canDrop: ({ source }) => source.data.view === this.token,
				onDrag: ({ source, location }) => {
					const resolved = this.resolve(source.data);
					if (resolved) handlers.onDrag(resolved, location.current.input.clientX);
				},
				onDragLeave: () => handlers.onLeave(),
				onDrop: ({ source, location }) => {
					handlers.onLeave();
					const resolved = this.resolve(source.data);
					if (resolved) handlers.onDrop(resolved, location.current.input.clientX);
				},
			}),
		);
	}
```

- [ ] **Step 4: Render the overlay**

In `src/view/render/timeline.ts`, after the rows and the today line:

```ts
	// One overlay over the day area, spanning the full height of the CONTENT (which is
	// at least the scrollport, so the blank grid below the last row — the state every
	// fresh backlog starts in — is a drop target too). Positioned past the sticky lead
	// column, so the exclusion the pointer conversion depends on is structural rather
	// than a constant kept in step with the CSS.
	//
	// It takes pointer events only while a drag is LIVE, so it never sits between the
	// reader and a bar's grips: the empty shelf's own trick — in the DOM so a drop has
	// somewhere to land, out of the way until a drag needs it — reached by a second
	// surface.
	const overlay = content.createDiv({ cls: 'pbl-timeline-drop', attr: { 'aria-hidden': 'true' } });
```

returned on `TimelineRender` as `overlay`.

`styles/timeline.css`:

```css
.pbl-timeline-drop {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-tl-lead);
	right: 0;
	z-index: 2;
	pointer-events: none;
}

.pbl-dragging .pbl-timeline-drop {
	pointer-events: auto;
}

/* The preview: a ghost bar and the dates it means, so the drop states its contract
   before it commits it. */
.pbl-drop-ghost {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	left: var(--pbl-ghost-left);
	width: var(--pbl-ghost-width);
	height: 14px;
	border-radius: var(--radius-s);
	border: 1px dashed var(--interactive-accent);
	background-color: var(--background-modifier-hover);
}

.pbl-drop-ghost-dates {
	position: absolute;
	top: calc(50% + 14px);
	left: var(--pbl-ghost-left);
	padding: var(--size-2-1) var(--size-4-1);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	background-color: var(--background-primary);
	white-space: nowrap;
}
```

- [ ] **Step 5: Create `src/view/interactions/timelineDrag.ts`**

```ts
/**
 * What a pointer position on the dated grid MEANS. The geometry, the grips and the
 * preview are their own module: `cardDrag.ts` is explicitly *the whole region is the
 * target and the highlight is the only drop signal*, and a positional drag is a second
 * concern that would push it past its stated job as well as its budget.
 *
 * Nothing here registers with the adapter directly — every source and target goes
 * through `CardDragController`, which mints the token that keeps a drag on the view it
 * started from. This module decides what a position means and hands the plan to
 * `host.performScheduleMove`, which is the only place a date batch is planned and the
 * only place it is announced.
 *
 * **Placing reads the pointer; moving reads the delta**, and conflating them is a bug
 * at the sparse scales — see `holdPlan` below.
 */

/** Everything a gesture on the grid measures against. */
export interface TimelineParts {
	overlay: HTMLElement;
	scroller: HTMLElement;
	window: TimelineWindow;
	scale: TimelineScale;
}

export function wireTimelineDrag(ctx: RowContext, dnd: CardDragController, parts: TimelineParts): void {
	const host = ctx.host;
	dnd.wirePositionalTarget(parts.overlay, {
		onDrag: (source, clientX) => preview(host, parts, source, clientX),
		onLeave: () => clearPreview(parts),
		onDrop: (source, clientX) => {
			clearPreview(parts);
			const plan = planFor(host, parts, source, clientX);
			// A drag ending nowhere meaningful writes nothing and does not consume the
			// undo slot — and a hold that moved nowhere plans nothing at all, so a
			// request the user never made never reaches the writer.
			if (plan) void host.performScheduleMove(source.item, plan);
		},
	});
	// Auto-scroll is opt-in per element, and the element to register is the one that
	// actually scrolls: here the timeline's own scroller, because
	// [[Zoom and the today marker]] requires the scrolling to stay inside the view and
	// the pane never to scroll sideways. Without this a drag could reach no date that
	// is not already on screen, and the grid is thousands of pixels wide by design.
	dnd.wireScroller(parts.scroller);
}

/**
 * The day under the pointer. `dayAt` takes an offset from the window's first day while
 * the adapter reports a VIEWPORT `clientX`, so the overlay's own bounding rect is
 * subtracted — the rect starts past the sticky lead column, which is why that exclusion
 * needs no constant.
 *
 * One subtraction and NO scroll term: a bounding rect already moves with the scroll, and
 * adding `scrollLeft` would double-count the pan. Untranslated, preview and write are
 * both off by the pane's position plus the scroll — a drop over one day scheduling
 * another. (`holdPlan`'s delta read DOES carry a scroll term, for the opposite reason;
 * the two paragraphs have to be read together or someone will "fix" one into the other.)
 */
function dropDay(parts: TimelineParts): (clientX: number) => CivilDate {
	return (clientX) => dayAt(parts.window, parts.scale, clientX - parts.overlay.getBoundingClientRect().left);
}

/**
 * What a SHELF drop means: the day under the pointer, and — only where a span is being
 * written — the zoom's cell as its duration.
 *
 * `cellSpan` supplies a duration ONLY where a span is written; a one-ended plan takes
 * the drop day. Both ways of arriving at one end obey that — a marker, which takes a
 * target and no span whatever is configured (extension 2e), and an ordinary item on an
 * axis where only one date property is named (2c). Neither has a duration to default,
 * so neither is offset from the day the pointer named: computing the span and then
 * narrowing it would put a target-only drop on 3 August at week zoom onto 9 August,
 * which is the silent coarsening decision 1 exists to refuse.
 */
function shelfPlan(host: BacklogViewHost, parts: TimelineParts, item: BacklogItem, clientX: number): SchedulePlan | null {
	const ends = writableEnds(host.settings, item);
	if (ends.length === 0) return null;
	const day = dropDay(parts)(clientX);
	if (ends.length === 1) return { [ends[0]]: formatCivil(day) };
	return { start: formatCivil(day), target: formatCivil(addDays(day, cellSpan(parts.scale, day) - 1)) };
}

/** The ends this item's TYPE answers for, narrowed to the keys the view options name. */
function writableEnds(settings: BacklogSettings, item: BacklogItem): PlacementEnd[] {
	return placementEnds(item.typeName).filter((end) => optionalKeyFor(settings, end) !== '');
}
```

`planFor` dispatches on `source.hold` — null is the shelf drop, and Task 12 adds the
three bar holds. `preview` draws the ghost from the same plan, so the preview and the
write cannot disagree about what a position means:

```ts
function preview(host: BacklogViewHost, parts: TimelineParts, source: CardSource, clientX: number): void {
	clearPreview(parts);
	const plan = planFor(host, parts, source, clientX);
	if (!plan) return;
	const span = previewSpan(source.item, plan);
	if (span.start === null && span.target === null) return;
	const geometry = barGeometry(parts.window, span);
	const ghost = parts.overlay.createDiv({ cls: 'pbl-drop-ghost' });
	ghost.setCssProps({
		'--pbl-ghost-left': `${geometry.startDay * parts.scale.dayPx}px`,
		'--pbl-ghost-width': `${Math.max(geometry.spanDays * parts.scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = parts.overlay.createDiv({ cls: 'pbl-drop-ghost-dates', text: spanText({ span }) });
	dates.setCssProps({ '--pbl-ghost-left': `${geometry.startDay * parts.scale.dayPx}px` });
}

function clearPreview(parts: TimelineParts): void {
	parts.overlay.empty();
}

/**
 * The span a plan WOULD leave on this item: the ends it names, over the ends the note
 * already states. Built from the plan rather than from the pointer, so the ghost and
 * the write cannot disagree about what a position means — which is the same reason the
 * removal indicator asks `placeItem` rather than comparing values beside it.
 */
function previewSpan(item: BacklogItem, plan: SchedulePlan): DateSpan {
	const stated = statedSpan(item);
	const end = (field: PlacementEnd): CivilDate | null => {
		const requested = plan[field];
		if (requested === undefined) return stated[field];
		return requested === null ? null : readDate(requested).value;
	};
	return { start: end('start'), target: end('target') };
}
```

`spanText` is `src/view/render/timeline.ts`'s, and it is exported for this. Its
parameter widens from a whole `TimelineBar` to
`{ span: DateSpan; inferredStart?: boolean; inferredEnd?: boolean }`, so a preview —
which has a span and no bar — can ask it, and a real bar still satisfies it. One
sentence describing a span, said the same way on the grid, in the ghost and in the
shelf's outcome line. `statedSpan` is `timelineDrag.ts`'s own, defined in Task 12.

- [ ] **Step 6: Wire it from the roadmap, and make the dated axis draggable**

In `src/view/render/roadmap.ts`, `const placing = axis === 'horizons' ? dnd : null;`
goes: `dnd` is passed on for both axes, and the timeline branch calls
`wireTimelineDrag(ctx, dnd, { overlay, scroller, window, scale })`. The shelf's cards
are wired as sources on both axes — `dnd.wireCard(card, entry.item)` unconditionally —
except where the item has no writable end at all, which `renderShelf` asks through
`canSchedule(ctx.host.settings, entry.item)` on the dated axis. A gesture whose only
possible batch is empty must not begin.

`renderRoadmap`'s preamble paragraph about withholding the controller is rewritten:
that withholding is what this increment removes, and the sentence must not survive it.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/view/timelineDrag.test.ts`
Expected: PASS.

- [ ] **Step 8: Watch the pointer conversion fail**

Delete the `- parts.overlay.getBoundingClientRect().left` term, run the first case, and
see the write land on a day 220px away from the drop. Then set the fixture's `rectLeft`
and `scrollLeft` to 0 and watch the same broken code PASS — that is why every pointer
case is driven against a panned grid.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view styles/timeline.css test
git commit -m "Turn a position on the grid into a date, and let the shelf drop write it"
```

---

### Task 12: Holding a bar — the body slide and the two grips

**Files:**
- Modify: `src/view/interactions/timelineDrag.ts`
- Modify: `src/view/render/timeline.ts` (the grips)
- Modify: `styles/timeline.css`
- Test: `test/view/timelineDrag.test.ts`

**Interfaces:**
- Consumes: `barHolds` (Task 2), `CardSource.hold` (Task 11).
- Produces: `planFor` gains its three hold branches; `renderBarRow` draws the grips
  `barHolds` allows and wires each through `dnd.wireCard(el, item, hold)`.

**Placing reads the pointer; moving reads the delta.** A hold on an existing bar must
not read the pointer absolutely, because a rendered edge is not always its date: a span
shorter than `MIN_BAR_PX` is drawn wider than it is, so at quarter zoom the end grip of a
one-day bar sits days past its target. Reading absolutely would mean *grabbing* the grip
already previews a later date, and the smallest twitch writes it. So a hold captures the
endpoint's own date and the pointer's start, and each frame moves that date by

```
round(((x - x₀) + (scrollLeft - scrollLeft₀)) / dayPx)
```

days. Zero movement is zero days at every zoom, which is the property that matters and
the one an absolute read cannot promise.

**The scroll term is not the double-count the placing rule refuses**, and the two rules
have to be read together or someone will "fix" one into the other. A placing read
measures against the overlay's bounding rect, which already moves with the pan, so
adding `scrollLeft` would count it twice. A moving read measures against a pointer
position captured in viewport space, which does *not* move with the pan — so while
auto-scroll pans the grid under a held pointer, `x - x₀` stays zero while later dates
slide beneath it, and without the term the preview freezes exactly when the scroller is
doing its job. **Rect-relative reads exclude the scroll; viewport-relative deltas
include it.**

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineDrag.test.ts`:

```ts
describe('holding a bar', () => {
	it('slides both stated ends by whole days, never changing the duration', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'body'), overlayOf(containerEl), { clientX: 1000 + 3 * scale.dayPx });
		await flush();

		expect(vault.fm('Planned.md').start).toBe('2026-08-07');
		expect(vault.fm('Planned.md').target).toBe('2026-08-13');
	});

	it('reads the DELTA, so grabbing a one-day bar at quarter zoom previews nothing', async () => {
		// A span shorter than the minimum drawable width is drawn WIDER than it is, so
		// at quarter zoom the end grip of a one-day bar sits days past its target.
		// Reading the pointer absolutely means grabbing the grip already previews a
		// later date — and the smallest twitch writes it.
		const vault = new FakeVault();
		vault.addFile('Day.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-04' } });
		const { view, containerEl } = datedView(vault);
		view.setZoom('quarter');
		pannedGrid(containerEl, { rectLeft: 220, scrollLeft: 640 });

		gridDrag(gripOf(containerEl, 'Day', 'end'), overlayOf(containerEl), { clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('plans nothing at all when a drag wanders and comes back', async () => {
		// A drag that expressed no change must produce no BATCH — not a batch the
		// writer then decides about. Its job is to judge a REQUESTED date against the
		// live one, and if a hold that moved nowhere submitted the model's own
		// endpoints, an editor who had changed that date meanwhile would have their
		// work quietly reverted.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const gesture = gridDrag.start(gripOf(containerEl, 'Planned', 'body'));
		gesture.over(overlayOf(containerEl), { clientX: 1400 });
		gesture.drop(overlayOf(containerEl), { clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('moves one date on an end grip and clamps at equal rather than crossing', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'end'), overlayOf(containerEl), { clientX: 1000 - 30 * scale.dayPx });
		await flush();

		// 2a: a reversed span is unreadable, so no gesture may write one — and it
		// clamps rather than refusing, because the diamond a coincident pair draws is
		// the shape and not the type.
		expect(vault.fm('Planned.md').target).toBe('2026-08-04');
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
	});

	it('leaves a one-ended bar’s open end open on a body slide', async () => {
		// 1a: shifting an absence would invent a date the note never stated, and equal
		// ends would draw a milestone the note never claimed.
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'body'), overlayOf(containerEl), { clientX: 1000 + 3 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Open.md').start).toBe('2026-08-07');
		expect(vault.fm('Open.md').target).toBeUndefined();
	});

	it('writes an open end from its own grip, counting days from the stated one', async () => {
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'end'), overlayOf(containerEl), { clientX: 1000 + 5 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Open.md').target).toBe('2026-08-09');
	});

	it('writes nothing when an open end is released without moving', async () => {
		// Zero days from the borrowed baseline would be a date EQUAL to the stated end —
		// a milestone diamond — and a plan that stated no end still states none. Absent
		// is a value here, and a gesture that did not move must not turn it into one.
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'start'), overlayOf(containerEl), { clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('carries no stale start on a marker’s slide, at any zoom', async () => {
		// 1g, and the category claim: "the plan is narrowed by type" is checked once per
		// gesture, because the next gesture is exactly the one that would break it.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Ship', 'body'), overlayOf(containerEl), { clientX: 1000 + 2 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Ship.md').target).toBe('2026-10-02');
		expect(vault.fm('Ship.md').start).toBe('2026-07-01');
	});

	it('offers no grip where a bar’s end is inferred, and none at all where both are', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);

		expect(gripNames(containerEl, 'Parent')).toEqual(['start']);
	});

	it('a source wired by one controller is not droppable on another’s target', () => {
		// The `canDrop` contract stated as a test rather than as the comment it is
		// today: two saved views can sit in split panes over the same notes, and the
		// stakes here are the RECEIVING view's date keys.
		const vault = scheduleVault();
		const first = datedView(vault);
		const second = datedView(vault);

		gridDrag(cardByTitle(first.containerEl, 'Unplanned'), overlayOf(second.containerEl), { clientX: 500 });

		expect(vault.writeLog).toHaveLength(0);
	});
});
```

with two accessors in `test/helpers/roadmap.ts`:

```ts
/** One of a bar's grips, by which hold it is. */
export function gripOf(containerEl: HTMLElement, title: string, hold: 'body' | 'start' | 'end'): HTMLElement {
	const el = barFor(containerEl, title).parentElement?.querySelector<HTMLElement>(`[data-pbl-hold="${hold}"]`);
	if (!el) throw new Error(`no ${hold} grip on ${title}`);
	return el;
}

/** Which holds a bar actually offers, in drawn order. */
export function gripNames(containerEl: HTMLElement, title: string): string[] {
	const row = rowFor(containerEl, title);
	return Array.from(row?.querySelectorAll<HTMLElement>('[data-pbl-hold]') ?? []).map(
		(el) => el.dataset.pblHold ?? '',
	);
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/timelineDrag.test.ts -t 'holding a bar'`
Expected: FAIL — `no body grip on Planned`.

- [ ] **Step 3: Draw the grips `barHolds` allows**

In `renderBarRow`, after the bar element:

```ts
	// Asked ONCE, of `barHolds`, by the renderer that draws these and the drag that
	// honours them — so what looks grabbable and what can actually be written cannot
	// disagree. The body hold IS the bar; the grips are its two edges.
	for (const hold of barHolds(bar.item, ctx.host.settings, bar)) {
		const grip = hold === 'body' ? el : el.createDiv({ cls: `pbl-bar-grip pbl-bar-grip-${hold}` });
		grip.dataset.pblHold = hold;
		dnd.wireCard(grip, bar.item, hold);
	}
```

`renderBarRow` therefore takes the controller. `styles/timeline.css`:

```css
/* The two edges, wide enough to hit at four pixels per day — whether they actually are
   is a vault check, not a jsdom one. */
.pbl-bar-grip {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 6px;
	cursor: ew-resize;
}

.pbl-bar-grip-start {
	left: -3px;
}

.pbl-bar-grip-end {
	right: -3px;
}

.pbl-bar {
	cursor: grab;
}
```

- [ ] **Step 4: Capture the baseline on drag start**

`wireCard`'s `onDragStart` already exists; the hold's baseline is captured in
`timelineDrag.ts` by the positional target's first `onDrag`, which is the first frame
after the pick-up:

```ts
/** What a hold captured when it began: the date it grips, and where the pointer was. */
interface HeldGrip {
	date: CivilDate;
	clientX: number;
	scrollLeft: number;
}

let held: HeldGrip | null = null;
```

Module-level mutable state is what this file exists to hold — one drag is live at a
time, and the adapter guarantees it — but it must be cleared on `onLeave` AND on
`onDrop`, or a stale baseline outlives its gesture. Prefer a closure over
`wireTimelineDrag`'s scope to a module-level `let`, so two views in split panes cannot
share it:

```ts
export function wireTimelineDrag(ctx: RowContext, dnd: CardDragController, parts: TimelineParts): void {
	let held: HeldGrip | null = null;
	…
```

- [ ] **Step 5: The three hold branches**

```ts
/**
 * The plan a hold means, or null where the gesture expressed no change.
 *
 * **A zero final delta plans nothing, on every hold.** A drag that wanders and comes
 * back to where it started has expressed no change, so it produces no batch at all —
 * not a batch the writer then decides about. That distinction matters now that the
 * writer owns the no-op question: its job is to judge a REQUESTED date against the live
 * one, and a request the user never made must not reach it. If one did, a hold that
 * moved nowhere would submit the model's own endpoints, and where another editor had
 * changed that date meanwhile the writer would see a real change and quietly revert it.
 */
function holdPlan(
	host: BacklogViewHost,
	parts: TimelineParts,
	baseline: HeldGrip,
	item: BacklogItem,
	hold: BarHold,
	clientX: number,
): SchedulePlan | null {
	// Viewport-relative, so the pan is INCLUDED: while auto-scroll moves the grid under
	// a held pointer, `clientX - baseline.clientX` stays zero while later dates slide
	// beneath it. The placing read subtracts a bounding rect, which already moves with
	// the scroll, and adds no such term — the two rules are opposites for the same
	// reason and must not be unified.
	const days = Math.round(
		(clientX - baseline.clientX + (parts.scroller.scrollLeft - baseline.scrollLeft)) / parts.scale.dayPx,
	);
	if (days === 0) return null;
	const ends = writableEnds(host.settings, item);
	const span = statedSpan(item);
	if (hold === 'body') {
		// Moves only the ends the note actually STATES (and may touch) — both, so a
		// two-ended slide never changes duration; the stated one alone where the bar has
		// one, its open end staying open. The bar's rendered width is not a duration to
		// preserve when half of it is an absence: filling it in would close a one-ended
		// plan by a gesture that promised to move it.
		const plan: SchedulePlan = {};
		for (const end of ends) {
			const date = span[end];
			if (date !== null) plan[end] = formatCivil(addDays(date, days));
		}
		return Object.keys(plan).length > 0 ? plan : null;
	}
	const end: PlacementEnd = hold === 'start' ? 'start' : 'target';
	if (!ends.includes(end)) return null;
	// An open end has no date to capture, so it BORROWS the stated one: a one-dated bar
	// renders one cell wide at the date it has, so the open end is drawn against the
	// stated one and counts from there.
	const moved = addDays(baseline.date, days);
	const opposite = end === 'start' ? span.target : span.start;
	// Clamped at equal rather than crossing — but ONLY against an end the note itself
	// states. A reversed span is a property of a note's OWN pair, which is the only pair
	// `reversedSpan` is ever asked about; where the opposite end is inferred there is no
	// span to reverse, and clamping would write a bound taken from the children's dates,
	// which extension 1c forbids writing. Dragged past inferred evidence the gesture
	// writes the day the pointer names, and `inferSpan` places the result: `keepsOrder`
	// already drops evidence falling on the wrong side of a stated end.
	const clamped = opposite === null ? moved : clampAtEqual(end, moved, opposite);
	return { [end]: formatCivil(clamped) };
}

function clampAtEqual(end: PlacementEnd, moved: CivilDate, opposite: CivilDate): CivilDate {
	const crosses = end === 'start' ? daysBetween(moved, opposite) < 0 : daysBetween(opposite, moved) < 0;
	return crosses ? opposite : moved;
}

/** What the NOTE states, never what the bar renders: an inferred end is not a date to move. */
function statedSpan(item: BacklogItem): DateSpan {
	return { start: item.plannedStart.value, target: item.plannedTarget.value };
}
```

The baseline's `date` is the endpoint the hold grips, captured on the first `onDrag`
frame:

```ts
function baselineFor(item: BacklogItem, hold: BarHold, clientX: number, parts: TimelineParts): HeldGrip {
	const span = statedSpan(item);
	// An open end borrows the stated one — a missing target counts days from the start,
	// a missing start counts back from the target — which is exactly where it is DRAWN.
	const date =
		hold === 'start' ? (span.start ?? span.target) : hold === 'end' ? (span.target ?? span.start) : (span.start ?? span.target);
	return { date: date ?? parts.window.start, clientX, scrollLeft: parts.scroller.scrollLeft };
}
```

`planFor` becomes the dispatch:

```ts
function planFor(host, parts, source, clientX, held): SchedulePlan | null {
	if (source.hold === null) return shelfPlan(host, parts, source.item, clientX);
	return held ? holdPlan(host, parts, held, source.item, source.hold, clientX) : null;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/view/timelineDrag.test.ts`
Expected: PASS.

- [ ] **Step 7: Watch the delta read fail**

Replace the delta with an absolute read (`dayAt(parts.window, parts.scale, clientX - rect.left)`),
run "reads the DELTA, so grabbing a one-day bar at quarter zoom previews nothing", and
see a write land from a gesture that never moved. Restore.

- [ ] **Step 8: Watch the clamp’s narrowing fail**

Remove the `opposite === null ? moved :` arm — clamping against the INFERRED end — run
the inferred-parent case, and see a bound taken from the children's dates written onto
the parent. Restore.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view styles/timeline.css test
git commit -m "Move a bar by the delta of the gesture, not the position of the pointer"
```

---

### Task 13: The shelf un-places what the timeline placed

**Files:**
- Modify: `src/view/render/roadmap.ts`
- Modify: `src/view/interactions/timelineDrag.ts`
- Test: `test/view/timelineDrag.test.ts`

**Interfaces:**
- Consumes: `placeItem`, `withoutEnds`, `statedEnds` (Task 2); `accepts` on
  `wireDropTarget` (Task 11).
- Produces: `renderShelf(ctx, frameEl, shelf, dnd, removal)` where
  `removal: { plan: (item: BacklogItem) => void; tooltip: string } | null`

**The shelf takes its removal from the AXIS, not from a truthy controller.**
`renderShelf` currently reads `dnd` as "the horizon axis": it hardcodes
`performHorizonMove(item, null)` and words its tooltip "removes its horizon". Both are
correct today only because the dated axis passes `null` — the withholding Task 11
removed. Handed a controller unchanged, a bar dropped on the timeline's shelf would
clear its **horizon** while the tooltip promised exactly that: consistent wording for
the wrong write, which is worse than either alone. So the shelf is given the removal to
plan and the words to say it in, and `dnd` goes back to meaning only "drops are live
here".

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineDrag.test.ts`:

```ts
describe('dropping a bar back on the shelf', () => {
	it('removes the date keys rather than blanking them, and undo restores them', async () => {
		const vault = scheduleVault();
		const { view, containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Planned', 'body'), shelfOf(containerEl)!);
		await flush();

		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect('target' in vault.fm('Planned.md')).toBe(false);
		await view.undoLast();
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
	});

	it('narrows a marker to its target and leaves a stale start alone', async () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Ship', 'body'), shelfOf(containerEl)!);
		await flush();

		expect('target' in vault.fm('Ship.md')).toBe(false);
		expect(vault.fm('Ship.md').start).toBe('2026-07-01');
	});

	it('refuses a GRIP released over the shelf — a resize is not an unschedule', async () => {
		// `wireDropTarget` admits any source carrying the view's token and hands its
		// callback the resolved item alone, so with the bar holds wired as sources it
		// cannot tell a resize from a body drag: a start grip released over the shelf
		// would fire the full unschedule and delete BOTH keys instead of moving one end.
		// Refused rather than ignored, so the strip never highlights for a drag it
		// would not honour.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Planned', 'start'), shelfOf(containerEl)!);
		await flush();

		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
		expect(vault.writeLog).toHaveLength(0);
		expect(shelfOf(containerEl)?.hasClass('pbl-drop-over')).toBe(false);
	});

	it('refuses a SHELF card dropped back on the shelf, which is not merely tidiness', async () => {
		// A card shelved as unreadable or reversed still carries its date keys —
		// `deriveBars` shelves it with a reason rather than for want of dates — so the
		// removal would delete the very values the reason is telling the user to correct.
		const vault = new FakeVault();
		vault.addFile('Backwards.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-31', target: '2026-08-01' } });
		const { containerEl } = datedView(vault);

		cardDrag(cardByTitle(containerEl, 'Backwards'), shelfOf(containerEl)!);
		await flush();

		expect(vault.fm('Backwards.md').start).toBe('2026-08-31');
		expect(vault.writeLog).toHaveLength(0);
	});

	it('previews the inferred span a parent KEEPS, not the shelf', async () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);
		const shelf = shelfOf(containerEl)!;

		const gesture = gridDrag.start(gripOf(containerEl, 'Parent', 'body'));
		gesture.over(shelf, { clientX: 10 });

		expect(shelf.querySelector('.pbl-shelf-outcome')?.textContent).toContain('2026-08-10');
	});

	it('previews the shelf for a wholly dateless subtree, and for a marker with a stale start', () => {
		const vault = new FakeVault();
		vault.addFile('Alone.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);
		const shelf = shelfOf(containerEl)!;

		for (const title of ['Alone', 'Ship']) {
			const gesture = gridDrag.start(gripOf(containerEl, title, 'body'));
			gesture.over(shelf, { clientX: 10 });
			expect(shelf.querySelector('.pbl-shelf-outcome')?.textContent, title).toContain('Unscheduled');
			gesture.leave(shelf);
		}
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/timelineDrag.test.ts -t 'back on the shelf'`
Expected: FAIL — the drop clears the item's HORIZON, so the date keys survive.

- [ ] **Step 3: Let the axis supply the removal and the words**

`renderShelf` takes a `removal` and stops naming a property:

```ts
/** What dropping a card on the shelf MEANS, and the words that promise it. */
interface ShelfRemoval {
	plan: (item: BacklogItem) => void;
	tooltip: string;
	/** Which sources this strip honours — the bar BODY alone on the dated axis. */
	accepts: (source: CardSource) => boolean;
}
```

The horizon axis passes
`{ plan: (item) => void host.performHorizonMove(item, null), tooltip: 'Results this axis cannot place — dropping a card here removes its horizon', accepts: (s) => s.hold === null && !shelfPaths.has(s.item.file.path) }`
and the dated axis
`{ plan: (item) => void host.performScheduleMove(item, unschedulePlan(item)), tooltip: 'Results this axis cannot place — dropping a bar here removes its dates', accepts: (s) => s.hold === 'body' }`.

`unschedulePlan(item)` is `unschedule`'s own body without the apply — export it from
`interactions/plan.ts` so the drag inherits the narrowing by asking rather than
restating it:

```ts
/** Every date key this item's own type answers for, as a plan that removes them. */
export function unschedulePlan(item: BacklogItem): SchedulePlan {
	const plan: SchedulePlan = {};
	for (const field of placementEnds(item.typeName)) plan[field] = null;
	return plan;
}

export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	return host.performScheduleMove(item, unschedulePlan(item));
}
```

`renderShelf`'s drop registration becomes
`dnd?.wireDropTarget(shelfEl, removal.plan, removal.accepts)` and the tooltip reads
`removal.tooltip`.

- [ ] **Step 4: Preview the outcome, asked of the placement rule**

In `renderShelf`, on the dated axis, the target's drag handlers write the prediction into
a `.pbl-shelf-outcome` line in the header. The outcome is asked of `placeItem` with the
ends the removal would leave — never derived beside it:

```ts
/**
 * What this removal would LEAVE, predicted from the function that places. `deriveBars`
 * decides bar-or-shelf over several rules that do not compose into one — a marker goes
 * through `placeMarker`, which ignores the start entirely and shelves whenever the
 * target is absent, so a marker keeping a stale start still shelves and never reaches
 * `inferSpan`; an unreadable or reversed pair shelves with its reason before any
 * inference is asked. A comparison written beside those and expected to agree with them
 * is exactly what drifted when the second axis arrived.
 *
 * The preview PREDICTS and the announcement REPORTS: this is drawn from the model in
 * hand, and a descendant's dates changed by another editor mid-drag can make the real
 * outcome differ. That is true of every preview here and needs no machinery — the
 * announcement names the placement from the REBUILT model instead.
 */
function removalOutcome(item: BacklogItem): string {
	const left = placeItem(item, withoutEnds(statedEnds(item), placementEnds(item.typeName)));
	return left.kind === 'shelf' ? UNSCHEDULED_LABEL : `Keeps ${spanText(left.bar)}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/timelineDrag.test.ts test/view/roadmapMoves.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the grip refusal fail**

Make `accepts` return true unconditionally on the dated axis, run "refuses a GRIP
released over the shelf", and see a resize delete both date keys. Restore.

- [ ] **Step 7: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/view test/view
git commit -m "Let the shelf remove what this axis placed, and say which outcome it is"
```

---

### Task 14: The context-row rule, asked of a third set of gestures

**Files:**
- Modify: `test/view/contextCardWrites.test.ts`
- Modify: `src/view/render/timeline.ts` / `src/view/render/roadmap.ts` if a case fails

**Interfaces:** none. This task adds checks, and fixes only what they catch.

Every new entry point is a write path, so each is subject to the same rule: **an
`outsideFilter` row is never a write target, never a ranking peer, never a source of
anything derived.** This is not re-derived for the timeline — the check goes in the file
that already asks the three questions of each card projection, so the new gestures fail
it without anyone having predicted the surface.

- [ ] **Step 1: Write the failing tests**

Append a `describe('the timeline’s entry points', …)` block to
`test/view/contextCardWrites.test.ts`, mirroring the board and roadmap blocks already
there:

```ts
describe('the timeline’s entry points and the context-row rule', () => {
	function contextVault() {
		const vault = new FakeVault();
		// The Feature is returned by the filter; its Epic parent is context, loaded for
		// the hierarchy and never a result.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-05' }, parentLink: 'Epic' });
		return vault;
	}

	it('never draws a context row as a bar, and never wires it as a source', () => {
		const { containerEl } = contextTimeline(contextVault());

		expect(rowFor(containerEl, 'Epic')).toBeNull();
		const card = cardByTitle(containerEl, 'Epic');
		expect(card.getAttribute('draggable')).not.toBe('true');
		expect(card.querySelector('[data-pbl-hold]')).toBeNull();
	});

	it('refuses the whole batch if a date write names one anyway', async () => {
		// The structural backstop, driven where a drag could not reach: `applySafely`
		// refuses whole rather than filtering, because dropping the offending write
		// alone would apply the rest and leave the hierarchy half-updated.
		const vault = contextVault();
		const { view } = contextTimeline(vault);
		const epic = view.model?.byPath.get('Epic.md');

		const moved = await view.performScheduleMove(epic as never, { start: '2026-09-01' });

		expect(moved).toBe(false);
		expect(vault.fm('Epic.md').start).toBe('2026-08-01');
	});

	it('keeps a context row out of every derived number the dated axis reports', () => {
		const { view, containerEl } = contextTimeline(contextVault());

		// Never counted, never shelved: the shelf is a statement about the RESULTS, and
		// the placed count plus the shelved count is the visible result rows.
		expect(shelfTitles(containerEl)).not.toContain('Epic');
		expect(view.roadmap?.roadmap.placedCount).toBe(1);
		expect(view.roadmap?.roadmap.context.map((i) => i.title)).toEqual(['Epic']);
	});

	it('offers no Schedule or Unschedule on a context row’s menu', () => {
		const { containerEl } = contextTimeline(contextVault());
		cardByTitle(containerEl, 'Epic').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = (Menu.lastShown?.items ?? []).map((i) => i.title);
		expect(titles).not.toContain('Schedule…');
		expect(titles).not.toContain('Unschedule');
	});
});
```

- [ ] **Step 2: Run it to verify it fails, or does not**

Run: `npx vitest run test/view/contextCardWrites.test.ts`
Expected: the first, third and fourth cases PASS on existing structure — `deriveBars`
routes an `outsideFilter` row to `context` before a span is ever computed, and the menu
already drops the placement actions. **If any of them fails, that is the finding this
task exists for**: fix it in `render/timeline.ts` or `render/roadmap.ts`, not in the
test. The second is the one to watch fail if `applySafely`'s refusal is ever narrowed.

- [ ] **Step 3: Watch the structural refusal fail**

Comment out the `writes.some((w) => …outsideFilter === true)` guard in
`src/view/writeGate.ts`, run the second case, and see a context row's dates written.
Restore it — this is the check that holds for entry points not yet written.

- [ ] **Step 4: Run the full gate and commit**

Run: `npm run check`

```bash
git add test/view/contextCardWrites.test.ts src/view
git commit -m "Ask the context-row rule of the timeline's gestures too"
```

---

### Task 15: The register the increment owes

**Files:**
- Modify: `docs/requirements/Zoom and the today marker.md`
- Modify: `docs/requirements/Drag from the shelf to schedule.md`
- Modify: `docs/requirements/Move and resize a bar.md`
- Modify: `docs/requirements/Keyboard and menu on the roadmap.md`
- Modify: `docs/requirements/The unplaced shelf.md`
- Modify: `docs/requirements/Roadmap empty states.md`
- Modify: `docs/requirements/Bars from two dates.md`
- Create: `docs/issues/Smoke test the writable timeline.md`
- Modify: `docs/README.md`

**Interfaces:** none — but `docs-check.mjs` rule 7 makes this task load-bearing for the
build: **every module in `src/` must be SPECIFIED by at least one note**, in a use
case's `## Where it lives` or an ADR's `## Decision`. Two modules are new
(`src/domain/bars.ts`, `src/view/interactions/timelineDrag.ts`) and `npm run docs`
fails until a note describes each. A mention anywhere else counts for nothing.

- [ ] **Step 1: The four corrections**

Each contradicts a sentence written before the code existed, so each is an edit to that
sentence rather than an addition beside it.

1. **`Zoom and the today marker.md`** — main flow step 2. "each with the grid cell drags
   will snap to" becomes the decision: the zoom changes pixel density and header
   granularity only; a drop writes the day under the pointer at every zoom, and the ISO
   week governs header cell boundaries and the shelf drop's default LENGTH, not the
   write's granularity. The matching acceptance criterion follows. Status → `Done`, and
   `## Where it lives` names `src/domain/timeline.ts` (the scale table and the day
   budget), `src/view/render/toolbar.ts` (the picker, jump-to-today, the shelf toggle
   and `syncShelfToggle`), `src/storage/collapseStore.ts` and `src/view/collapseState.ts`
   (the per-device memory, in BOTH places), `src/view/render/projections.ts` (the date
   anchor across a scale change and the per-band offsets) and `styles/roadmap.css` (the
   band rule).
2. **`Drag from the shelf to schedule.md`** — step 2 and extension 2c. "start and target
   spanning that one cell — its first day and its last" becomes: start is the day under
   the pointer, target is start plus the zoom's cell minus a day. Under day snapping one
   cell is one day, so the old wording writes `start === target`, which
   [[Bars from two dates]] step 4 renders as a milestone diamond — a dropped PBI arriving
   as a deadline. `2c` and `2e` gain the one rule both halves collapse to: **`cellSpan`
   supplies a duration only where a span is written; a one-ended plan takes the drop
   day.** Status → `Done`; `## Where it lives` names
   `src/view/interactions/timelineDrag.ts` (the overlay, the placing read, the preview),
   `src/domain/timeline.ts` (`dayAt`, `cellSpan`) and `src/domain/bars.ts` (`barHolds`
   and the removal's predicted outcome).
3. **`Move and resize a bar.md`** — **delete extension `1f`** rather than leaving it as a
   rule about a case no code can reach: with day snapping there is no unit larger than a
   day to step by, so the month-end overflow the clamp guards against cannot occur, and
   an unreachable rule is a claim with nothing under it. The acceptance criterion's
   "clamped at month end rather than overflowing" goes with it. **`3b` narrows** to what
   ships: the write stands, the bar leaves on the refresh, undo takes it back — and the
   announcement is NOT built, with the question staying owned by
   [[The outcome report was built from one sentence]]. Status → `Done`;
   `## Where it lives` names `src/view/interactions/timelineDrag.ts` (the delta read,
   the clamp, the open-end baseline), `src/domain/bars.ts` (`barHolds`),
   `src/storage/frontmatter.ts` (the datetime merge, the live decision, both refusals)
   and `src/view/host.ts` (`performScheduleMove`).
4. **`Keyboard and menu on the roadmap.md`** — delete "the roadmap's dated axis has no
   non-pointer moves *and no pointer ones either*". `Schedule` and `Unschedule` write
   today, and after this increment the pointer paths do too; the sentence is already
   false and would be doubly so on merge. It stays `Active`: the lift and the bucket
   stops are still its work, and WCAG 2.2 SC 2.5.7 is satisfied by the menu paths the
   day the drags land, so the lift is the combined-move and ergonomic path rather than
   the compliance one.

- [ ] **Step 2: The three closures**

5. **`The unplaced shelf.md`** → `Done`. The dated half of the drag lands: a shelf card
   is a drag source and the shelf is the target that un-places, on both axes. Its
   `## Where it lives` gains the removal-by-axis rule (`renderShelf` takes what a drop
   means and the words to promise it in, rather than reading `dnd` as "the horizon
   axis") and the narrow-pane compaction with its toolbar control.
6. **`Roadmap empty states.md`** → `Done`, **but narrow extension `2c` FIRST.** It and
   the matching criterion promise that a note created dateless into a base whose filter
   excludes it is "announced with an open path" — the outcome report this increment does
   not build; `createFromPrompt` emits the generic `Created` notice and nothing else.
   Closing the note over an unnarrowed criterion would be the defect this spec keeps
   naming: a guarantee written ahead of its check. Every grid region is now a drop
   target, which is the other half of what held it open.
7. **`Bars from two dates.md`** → `Done`. Its stated reason for staying open was
   inferred parent spans waiting on [[Spans roll up the tree]]; that PBI is Done and
   `deriveBars` sets `inferredStart` / `inferredEnd` today, so the note was held open by
   a sentence rather than by a gap. `## Where it lives` moves the derivation from
   `src/domain/roadmap.ts` to `src/domain/bars.ts` and names `placeItem` as the one
   answer to bar-or-shelf.

- [ ] **Step 3: The smoke note**

Create `docs/issues/Smoke test the writable timeline.md`, frontmatter matching
`docs/issues/Smoke test the visual changes.md` (`type: Issue`,
`parent: "[[Product Backlog]]"`, `status: Open`, `priority: P2`, `area: verification`,
`cadence: release`, `created: 2026-08-04`, a `files:` list of the modules it covers).
What it lists is exactly what jsdom cannot answer, named honestly rather than claimed:

- **That exactly one thing scrolls, and that the header and lead column stay pinned to
  it.** jsdom computes no layout, so nested scrollers and sticky containing blocks are
  both invisible to it: a test can assert which element carries the class and never that
  the pane stopped overflowing or that the month labels held their place while the rows
  moved under them. The two-axis restructure makes this the part most worth looking at
  first.
- Whether the preview reads as a contract — the ghost bar and its dates legible while
  the pointer is moving.
- Whether an end grip is reachable at four pixels per day, and whether the three
  densities are three *usable* scales rather than three numbers. 16, 4 and 2 are
  reasoned, not measured, and the width of a real pane is the only thing that can say
  whether quarter zoom shows enough plan to be worth having.
- Whether a drag toward the pane edge actually pans the grid, and at a usable rate.
  Registering the scroller is checkable here; that it ENGAGES toward an edge is a
  pointer-position behaviour of the drag library, which jsdom does not run.
- Whether today's line and a milestone dated today read as TWO marks at quarter zoom,
  where each is one pixel at 0.55 opacity. If a one-pixel line cannot be seen, the answer
  is a denser `quarter`, not a thinner mark.
- The narrow-pane shelf compaction, and whether anything clips under the header in an
  embedded base.
- The today line and jump-to-today from a scrolled position.

Name the handover: `npm run test-build` bundles into this repository's own
`.obsidian/plugins/`, and `docs/Product Backlog.base` is a real backlog with a real
milestone on it — the plugin displaying its own register is the smoke test.

- [ ] **Step 4: The README paragraph**

`docs/README.md`'s roadmap-epic paragraph gains this increment: the dated axis became
writable — a shelf card scheduled at the day under the pointer with the zoom's cell as
its default duration, a bar slid and resized by whole days, a bar dropped back on the
shelf removing its keys — with three discrete densities, a jump-to-today, a frame that
scrolls inside itself, and the date decision moved into the writer so a note's own time,
offset and spelling survive a gesture that moves its date.

- [ ] **Step 5: Run the register check**

Run: `npm run docs`
Expected: PASS. The two failures to expect first are rule 7 (a new module no note
specifies — check the `## Where it lives` sections name `src/domain/bars.ts` and
`src/view/interactions/timelineDrag.ts` by path) and a broken `[[wikilink]]` to a note
whose name was typed rather than copied.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "Correct the four sentences written before the code, and close what landed"
```

---

### Task 16: The gate, on both platforms

**Files:** `vitest.config.mts` (thresholds only)

- [ ] **Step 1: Run the whole gate**

Run: `npm run check`
Expected: build, lint, coverage-thresholded tests, fallow and the docs register all pass.

- [ ] **Step 2: Raise the coverage thresholds to what this increment earned**

Run `npm run test:coverage` and read the summary. Set each threshold just below the
measured figure, keeping the margin it had — and **never lower one**. If a figure has
gone DOWN, that is a finding, not a number to accommodate: the usual cause is a branch
built and not driven, and the fix is the missing case, not the threshold. Note in the
comment above the block which increment moved which figure, as the existing comment does.

- [ ] **Step 3: Ask what is missing**

Re-read the spec's own "What jsdom cannot answer" list against Task 15's smoke note: a
claim in one and not the other is either a check that was quietly dropped or a guarantee
written ahead of its check. Both are the same defect.

- [ ] **Step 4: Push and open the pull request**

```bash
git push -u origin claude/next-product-increment-ujxye4
```

CI runs the same five steps on Ubuntu **and Windows** — paths and line endings are the
only things that differ between them, and both have already produced a defect this
repository could not see. The date arithmetic here is all `Date.UTC`, which is the one
thing in this increment that could have gone platform-dependent and deliberately did
not.

---

## Ordering, and what may be reordered

Tasks 1–2 are the domain floor and everything rests on them. Tasks 3–5 are the write
path in a deliberate order: **the writer learns to decide before the planner stops
deciding**, so every step is green — the reverse order has a commit where a re-confirmed
date writes twice. Task 6 is the one move all three inputs land on, and it must precede
the gestures rather than follow them, or the drag becomes a second idea of what
scheduling is and the routing is a refactor instead of a wiring.

Tasks 7–10 are the frame and can be read as one piece: 7 and 8 are best landed together
(Task 7's three cases need `setZoom`, and a test written and then skipped is one nobody
watches fail). Task 9 must precede 11, because the drag measures against the scroller
Task 9 moves.

Tasks 11–13 are the gestures, in the order they build on each other: the overlay and the
placing read, then the holds and the delta read, then the removal. Task 14 could run at
any point after 13 and is placed last among the code tasks deliberately — it is the
check that holds for entry points not yet written, so it is worth running against all of
them at once.

Task 15 cannot move: `npm run docs` fails from the moment `src/domain/bars.ts` exists
until a note specifies it, so every commit from Task 2 onward technically owes the
register a line. Add the `## Where it lives` sentence for `bars.ts` in **Task 2's own
commit** and for `timelineDrag.ts` in **Task 11's**, then do the corrections and
closures properly in Task 15. A plan that leaves the gate red between commits is a plan
whose "run `npm run check` before committing" step is a lie.
