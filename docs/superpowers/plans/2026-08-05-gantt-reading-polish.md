# Gantt Reading Polish Implementation Plan

> **Superseded 2026-08-07, in part:** Task 4's today-label pill (`.pbl-today-label`, the
> `.pbl-timeline-band` it mounted in, and `HeaderTiers.todayBand`) was removed once a
> legend strip existed to name the today line's colour instead — see
> `docs/requirements/State colour and a legend.md`. The rest of this plan (gridlines,
> weekend banding, the two-tier header, row tracking, bar labels, the density toggle)
> still describes what shipped. Left as a transcript of the tasks as they were executed
> rather than rewritten task-by-task.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Furnish the roadmap's dated axis so it reads as a gantt chart — body gridlines, weekend banding, a labeled today marker, a two-tier header, row tracking, bar labels, and a compact row density toggle.

**Architecture:** Every new mark is what the milestone line already is: an absolute, `aria-hidden`, `pointer-events: none` element positioned in days × `scale.dayPx`, emitted from the same `timelineCells` loop the header runs — except weekend shading, which is exactly 7-day periodic and therefore one CSS repeating-gradient layer with a TS-published phase offset. Density is a new store field copying the `zoom` field's shape exactly. Spec: `docs/superpowers/specs/2026-08-05-gantt-reading-polish-design.md`.

**Tech Stack:** TypeScript, Obsidian Bases view API (mocked in tests), vitest (node + jsdom), plain CSS partials assembled by `styles-assemble.mjs`.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) must pass **before every commit**. Run it as the last step of every task.
- Coverage thresholds in `vitest.config.mts` only ever go up — Task 9 raises them to the new actuals.
- 400-line max per `src/` file and per style partial (enforced by lint / `styles-assemble.mjs`); 450 per test file.
- TDD: write the failing test, **watch it fail**, then implement. A test never watched failing proves nothing here (root `CLAUDE.md`).
- UI text is sentence case; styles via `setCssProps`, never inline `style` strings; no `querySelector` in `src/` naming a tree receiver (test files may query freely).
- No new runtime dependencies; no writes to frontmatter, localStorage or the `.base` outside `storage/` (this increment adds none — density goes through the existing collapse store).
- CSS custom properties read by new rules must stay within the set the partials already read (`--background-modifier-hover`, `--background-modifier-border`, `--background-primary`, `--text-muted`, `--font-ui-smaller`, `--size-4-1`, `--size-4-2`, `--color-red`), so `test/harness/harness.test.ts`'s theme-stub coverage check needs no stub additions. If you add any other `var(--x)`, you must also add it to `test/harness/theme.css`.
- The lanes work this plan was written to follow is **not** in flight — it is specified in the register as [[Lanes on the roadmap]] and unimplemented, so this increment lands first rather than behind it. `src/storage/collapseStore.ts`, `src/view/collapseState.ts` and `src/view/render/toolbar.ts` are still the surfaces lanes will touch; every edit here is additive (new fields, new functions), so it stays a merge lanes can resolve by keeping both sides.
- Commit messages: plain imperative sentences, no `feat:`/`fix:` prefixes (repo style), ending with the `Co-Authored-By:` trailer for whichever model writes them.

---

### Task 1: Domain — super-unit header cells, and the year moves up out of the bottom tier

**Files:**
- Modify: `src/domain/timeline.ts` (the `cellSpan`/`timelineCells`/`unitOffset`/`cellLabel` cluster, lines ~247–288)
- Test: `test/domain/timeline.test.ts`
- Test (expectation updates only): `test/view/timelineZoom.test.ts:85`, `test/view/roadmapFrame.test.ts:407-409`

**Interfaces:**
- Consumes: existing `TimelineWindow`, `TimelineScale`, `TimelineCell`, `SCALES`, `scaleFor`, `daysBetween`, `addDays`, `daysInMonth`, `MONTH_LABELS`, `quarterFirstMonth`, `isoWeekday`.
- Produces: `superCells(window: TimelineWindow, scale: TimelineScale): TimelineCell[]` (exported). Bottom-tier labels change: month cells `Aug` (was `Aug 2026`), quarter cells `Q3` (was `Q3 2026`), week cells unchanged (`4 Aug`). Public signatures of `timelineCells` and `cellSpan` unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/timeline.test.ts` (add `superCells` to the existing import from `../../src/domain/timeline`):

```ts
describe('the header tiers', () => {
	it('draws months above weeks and years above months and quarters', () => {
		const window = timelineWindow([], d(2026, 8, 15)); // Jul 1 – Sep 30 2026
		expect(superCells(window, scaleFor('week')).map((c) => c.label)).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026']);
		expect(superCells(window, scaleFor('month')).map((c) => c.label)).toEqual(['2026']);
		expect(superCells(window, scaleFor('quarter')).map((c) => c.label)).toEqual(['2026']);
	});

	it('covers exactly the window at every scale, clipped edges included', () => {
		const spans = [{ start: d(2026, 11, 20), target: d(2027, 2, 2) }];
		const window = timelineWindow(spans, d(2026, 8, 15)); // Jul 1 2026 – Mar 31 2027
		for (const scale of SCALES) {
			const total = superCells(window, scale).reduce((sum, c) => sum + c.days, 0);
			expect(total, scale.id).toBe(window.days);
		}
		// A year clipped by the window edge still names itself from its own first day.
		expect(superCells(window, scaleFor('month')).map((c) => c.label)).toEqual(['2026', '2027']);
	});

	it('drops the year from the bottom tier once the top tier carries it', () => {
		const window = timelineWindow([], d(2026, 8, 15));
		expect(timelineCells(window, scaleFor('month')).map((c) => c.label)).toEqual(['Jul', 'Aug', 'Sep']);
		expect(timelineCells(window, scaleFor('quarter')).map((c) => c.label)).toEqual(['Q3']);
		// A week can straddle two months, so its label keeps naming both parts itself.
		expect(timelineCells(window, scaleFor('week'))[0].label).toBe('29 Jun');
	});
});
```

- [ ] **Step 2: Run them, verify they fail**

Run: `npx vitest run test/domain/timeline.test.ts`
Expected: FAIL — `superCells` is not exported; the label tests fail on `'Jul 2026' !== 'Jul'`.

- [ ] **Step 3: Implement**

In `src/domain/timeline.ts`, replace exactly four functions — `cellSpan`, `timelineCells`, `unitOffset` and `cellLabel` — with the block below. `isoWeekday` and `quarterFirstMonth` sit interleaved between them in the file; both stay exactly as they are (function declarations hoist, so their position relative to the new code does not matter):

```ts
/** The units a header tier can draw. The scales own the first three; `year` exists only as a super-unit. */
type HeaderUnit = ScaleId | 'year';

/** The coarser orientation band drawn above each scale's cells — [[Reading the grid]]. */
const SUPER_UNIT: Record<ScaleId, HeaderUnit> = { week: 'month', month: 'year', quarter: 'year' };

function unitSpan(unit: HeaderUnit, day: CivilDate): number {
	if (unit === 'week') return 7;
	if (unit === 'month') return daysInMonth(day.year, day.month);
	if (unit === 'quarter') {
		const first = quarterFirstMonth(day.month);
		return [0, 1, 2].reduce((sum, i) => sum + daysInMonth(day.year, first + i), 0);
	}
	return daysBetween({ year: day.year, month: 1, day: 1 }, { year: day.year + 1, month: 1, day: 1 });
}

/**
 * The whole unit `day` falls in, in days — the default DURATION a shelf drop takes
 * when the item arrives with none of its own. Used by that one gesture and by nothing
 * else: it is not a snapping unit, and no gesture that already has a date consults it.
 */
export function cellSpan(scale: TimelineScale, day: CivilDate): number {
	return unitSpan(scale.unit, day);
}

/** One tier's cells across the window, clipped at both edges — the walk both tiers share. */
function unitCells(window: TimelineWindow, unit: HeaderUnit, label: (unitStart: CivilDate) => string): TimelineCell[] {
	const cells: TimelineCell[] = [];
	for (let day = 0; day < window.days; ) {
		const date = addDays(window.start, day);
		const offset = unitOffset(unit, date);
		const length = Math.min(unitSpan(unit, date) - offset, window.days - day);
		cells.push({ label: label(addDays(date, -offset)), days: length });
		day += length;
	}
	return cells;
}

/** The header cells of one scale across the window, clipped at both edges. */
export function timelineCells(window: TimelineWindow, scale: TimelineScale): TimelineCell[] {
	return unitCells(window, scale.unit, (start) => cellLabel(scale.unit, start));
}

/**
 * The coarser tier above the cells — months above weeks, years above months and
 * quarters — for orientation. Same walk, same clipping, so the two tiers' day
 * totals always agree with the window.
 */
export function superCells(window: TimelineWindow, scale: TimelineScale): TimelineCell[] {
	const unit = SUPER_UNIT[scale.unit];
	return unitCells(window, unit, (start) => superLabel(unit, start));
}

/** How far into its own unit a date sits — 0 when the cell starts there. */
function unitOffset(unit: HeaderUnit, date: CivilDate): number {
	if (unit === 'week') return isoWeekday(date);
	if (unit === 'month') return date.day - 1;
	if (unit === 'quarter') return daysBetween({ year: date.year, month: quarterFirstMonth(date.month), day: 1 }, date);
	return daysBetween({ year: date.year, month: 1, day: 1 }, date);
}

/**
 * The cell's name, from the unit's own first day so a clipped cell still names it.
 * Year-free below the top tier: the super tier carries the year, and repeating it
 * per cell is the noise the tier exists to remove. The week cell keeps its month —
 * a week can straddle two, so its label stays self-sufficient.
 */
function cellLabel(unit: ScaleId, unitStart: CivilDate): string {
	if (unit === 'week') return `${unitStart.day} ${MONTH_LABELS[unitStart.month - 1]}`;
	if (unit === 'month') return MONTH_LABELS[unitStart.month - 1];
	return `Q${Math.floor((unitStart.month - 1) / 3) + 1}`;
}

/** The super tier's name for its unit — the tier that owns the year spells it out. */
function superLabel(unit: HeaderUnit, unitStart: CivilDate): string {
	if (unit === 'month') return `${MONTH_LABELS[unitStart.month - 1]} ${unitStart.year}`;
	return String(unitStart.year);
}
```

Note: `TimelineScale.unit` is typed `ScaleId`, so `SUPER_UNIT[scale.unit]` and `cellLabel(scale.unit, …)` type-check as-is.

- [ ] **Step 4: Update the expectations the label change breaks**

- `test/domain/timeline.test.ts:43` — `['Jul 2026', 'Aug 2026', 'Sep 2026']` → `['Jul', 'Aug', 'Sep']`
- `test/domain/timeline.test.ts:55-56` — `'Apr 2026'` → `'Apr'`, `'Dec 2026'` → `'Dec'`
- `test/domain/timeline.test.ts:61` — `c.label === 'Feb 2028'` → `c.label === 'Feb'`
- `test/domain/timeline.test.ts:71` — `toContain('Aug 2026')` → `toContain('Aug')` (read the surrounding test; if it is asserting week labels it already passes — only month/quarter labels changed)
- `test/view/timelineZoom.test.ts:85` — `/^Q[1-4] \d{4}$/` → `/^Q[1-4]$/`
- `test/view/roadmapFrame.test.ts:407` — `/^Q[1-4] \d{4}$/` → `/^Q[1-4]$/`
- `test/view/roadmapFrame.test.ts:409` — `toContain('Aug 2026')` → `toContain('Aug')`

- [ ] **Step 5: Run the full suite, verify green, run the whole gate**

Run: `npx vitest run` then `npm run check`
Expected: PASS. If any other test read a month/quarter header label, update it the same way — the only behaviour change is the year moving out of the bottom tier.

- [ ] **Step 6: Commit**

```bash
git add src/domain/timeline.ts test/domain/timeline.test.ts test/view/timelineZoom.test.ts test/view/roadmapFrame.test.ts
git commit -m "Add super-unit header cells and move the year out of the bottom tier"
```

---

### Task 2: Domain — the weekend phase

**Files:**
- Modify: `src/domain/timeline.ts` (beside `timelineWindow`)
- Test: `test/domain/timeline.test.ts`

**Interfaces:**
- Produces: `weekendOffsetDays(window: TimelineWindow): number` (exported) — days from the window's start to the first Saturday, 0..6.

- [ ] **Step 1: Write the failing test**

```ts
describe('the weekend phase', () => {
	it('counts days to the first Saturday, zero when the window opens on one', () => {
		// timelineWindow([], 2026-08-15) starts 2026-07-01, a Wednesday; first Saturday is Jul 4.
		expect(weekendOffsetDays(timelineWindow([], d(2026, 8, 15)))).toBe(3);
		// timelineWindow([], 2026-09-15) starts 2026-08-01, itself a Saturday.
		expect(weekendOffsetDays(timelineWindow([], d(2026, 9, 15)))).toBe(0);
	});
});
```

- [ ] **Step 2: Run, verify FAIL** (`weekendOffsetDays` not exported)

Run: `npx vitest run test/domain/timeline.test.ts`

- [ ] **Step 3: Implement**

In `src/domain/timeline.ts`, after `timelineWindow`:

```ts
/**
 * Days from the window's start to its first Saturday — the phase the weekend
 * layer's 7-day repeating gradient starts at. ISO weekday, the module's own
 * boundary rule, so the same window shades the same days on every device.
 */
export function weekendOffsetDays(window: TimelineWindow): number {
	return (5 - isoWeekday(window.start) + 7) % 7;
}
```

- [ ] **Step 4: Run, verify PASS, then `npm run check`**

- [ ] **Step 5: Commit**

```bash
git add src/domain/timeline.ts test/domain/timeline.test.ts
git commit -m "Phase the weekend banding from the window's first Saturday"
```

---

### Task 3: Render — the two-tier header

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderCellHeader`)
- Create: `styles/timelineFurniture.css`
- Modify: `styles/index.css` (one import line)
- Modify: `test/helpers/roadmap.ts:137-140` (doc comment on `cellLabels`)
- Test: create `test/view/timelineFurniture.test.ts`

**Interfaces:**
- Consumes: `superCells` from Task 1.
- Produces: header DOM `header > [lead, .pbl-timeline-tiers > [.pbl-timeline-band, .pbl-timeline-track.pbl-timeline-super, .pbl-timeline-track]]`; super cells carry `pbl-timeline-cell pbl-timeline-cell-super`. `renderCellHeader` returns `HeaderTiers` — the cell track and the empty band. `TimelineRender.headerTrack` is still the cell track, so milestone labels and the drop ghost keep their mount, while Task 4's today pill takes the band, which exists so that it collides with nothing (see Task 4). The new partial file exists for every later task to append to.

- [ ] **Step 1: Write the failing test**

Create `test/view/timelineFurniture.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';
import { weekendOffsetDays } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

function furnishedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-20' } });
	vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-10', due: '2026-09-01' } });
	// A Milestone, which is the TYPE `renderMilestoneLines` gates on — a PBI with equal
	// dates draws the diamond but no line and no header label, so the type is what this
	// fixture needs and the equal pair is what makes it a point rather than a span.
	vault.addFile('Gamma.md', { frontmatter: { type: 'Milestone', order: 30, start: '2026-09-15', due: '2026-09-15' } });
	return vault;
}

function datedRoadmap(vault: FakeVault) {
	const harness = makeView(vault, { ...DATE_AXIS }, { collapsed: true });
	harness.view.setProjection('roadmap');
	return harness;
}

function superLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell-super')).map((c) => c.textContent ?? '');
}

function bottomCells(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell:not(.pbl-timeline-cell-super)'));
}

describe('the two-tier header', () => {
	it('draws the coarser tier above the cells, and the year lives up there', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		// Month zoom, the default: years above months.
		expect(superLabels(containerEl).length).toBeGreaterThan(0);
		expect(superLabels(containerEl).every((l) => /^\d{4}$/.test(l))).toBe(true);
		view.setZoom('week');
		// Week zoom: months above weeks, carrying the year the weeks do not.
		expect(superLabels(containerEl).some((l) => /^[A-Z][a-z]{2} \d{4}$/.test(l))).toBe(true);
	});

	it('sizes both tiers to the same total width, so the columns cannot shear', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const sum = (cells: HTMLElement[]) =>
			cells.reduce((n, c) => n + parseFloat(c.style.getPropertyValue('--pbl-cell-w')), 0);
		const supers = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell-super'));
		expect(sum(supers)).toBe(sum(bottomCells(containerEl)));
	});
});
```

- [ ] **Step 2: Run, verify FAIL** (no `.pbl-timeline-cell-super` in the DOM)

Run: `npx vitest run test/view/timelineFurniture.test.ts`

- [ ] **Step 3: Implement the renderer**

In `src/view/render/timeline.ts`, add `superCells` to the import from `../../domain/timeline`, and replace `renderCellHeader` with:

```ts
/** What the header hands back: the tier a mark mounts against, per mark. */
interface HeaderTiers {
	/** The cell tier — `TimelineRender.headerTrack`, where the milestone labels and the drop ghost mount. */
	cells: HTMLElement;
	/** The empty strip above both tiers, which the today pill has to itself (Task 4). */
	todayBand: HTMLElement;
}

/** Presentational, like the tree's column header: every row carries its own dates. */
function renderCellHeader(grid: HTMLElement, window: TimelineWindow, scale: TimelineScale): HeaderTiers {
	const header = grid.createDiv({ cls: 'pbl-timeline-header', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-timeline-lead' });
	// Three stacked strips in the track slot: an empty band, then the coarser
	// orientation tier, then the cells. The band is created here rather than where
	// its pill is so it lands ABOVE both tiers — a mark appended later would sit
	// under them. Why the pill gets a strip nobody else draws in: see renderTimeline.
	const tiers = header.createDiv({ cls: 'pbl-timeline-tiers' });
	const todayBand = tiers.createDiv({ cls: 'pbl-timeline-band' });
	renderHeaderTier(tiers, superCells(window, scale), scale, 'pbl-timeline-super', 'pbl-timeline-cell pbl-timeline-cell-super');
	const cells = renderHeaderTier(tiers, timelineCells(window, scale), scale, '', 'pbl-timeline-cell');
	return { cells, todayBand };
}

function renderHeaderTier(
	tiers: HTMLElement,
	cells: TimelineCell[],
	scale: TimelineScale,
	trackCls: string,
	cellCls: string,
): HTMLElement {
	const track = tiers.createDiv({ cls: `pbl-timeline-track${trackCls ? ' ' + trackCls : ''}` });
	for (const cell of cells) {
		const cellEl = track.createDiv({ cls: cellCls, text: cell.label });
		cellEl.setCssProps({ '--pbl-cell-w': `${cell.days * scale.dayPx}px` });
	}
	return track;
}
```

Also add `TimelineCell` to the import from `../../domain/timeline`, and in `renderTimeline`
destructure the new return shape (the rest of the function is unchanged, `headerTrack`
still being the cell tier):

```ts
	const { cells: headerTrack, todayBand } = renderCellHeader(content, window, scale);
```

`todayBand` is unused until Task 4; if lint objects in the meantime, land Tasks 3 and 4
back to back rather than suppressing it.

- [ ] **Step 4: Create the partial and import it**

Create `styles/timelineFurniture.css`:

```css
/* The dated axis's reading furniture — the header tiers, gridlines, weekend banding,
   row tracking, bar labels and the density class — `src/view/render/timeline.ts`.
   Position in index.css is NOT load-bearing: everything here that overrides
   `timeline.css` outranks it by specificity, never by order. */

/* The track slot of the header, holding the today band and two stacked tracks. Block
   layout: each track keeps its own `width: var(--pbl-tl-days)`, and the flex-basis the
   track class declares is inert outside a flex parent. `.pbl-timeline-band` needs no
   rule of its own — it is a plain block filling this width, and its height is whatever
   the pill inside it turns out to be. */
.pbl-timeline-tiers {
	flex: 0 0 var(--pbl-tl-days);
	width: var(--pbl-tl-days);
}

.pbl-timeline-super {
	border-bottom: 1px solid var(--background-modifier-border);
}

.pbl-timeline-cell-super {
	font-weight: 600;
}
```

In `styles/index.css`, after `@import "./timeline.css";` add:

```css
@import "./timelineFurniture.css";
```

- [ ] **Step 5: Update the helper's doc comment**

`test/helpers/roadmap.ts:137` — the comment on `cellLabels` becomes:

```ts
/** Every header cell's text across BOTH tiers, in drawn order — super tier first. */
```

- [ ] **Step 6: Run the new file, then the whole suite, then `npm run check`**

Run: `npx vitest run test/view/timelineFurniture.test.ts && npx vitest run && npm run check`
Expected: PASS — `cellLabels`-based assertions still hold (they use `some`/`toContain`).

- [ ] **Step 7: Commit**

```bash
git add src/view/render/timeline.ts styles/timelineFurniture.css styles/index.css test/view/timelineFurniture.test.ts test/helpers/roadmap.ts
git commit -m "Draw the timeline header as two tiers"
```

---

### Task 4: Render — body gridlines, the weekend layer, the today label

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderTimeline`)
- Modify: `styles/timelineFurniture.css`
- Test: `test/view/timelineFurniture.test.ts`

**Interfaces:**
- Consumes: `weekendOffsetDays` (Task 2), the two-tier header (Task 3).
- Produces: `.pbl-grid-line` (one per interior cell boundary, `--pbl-grid-left`), `.pbl-weekend-layer` (week zoom only, `--pbl-weekend-offset`; `--pbl-day-px` published on the content layer), `.pbl-today-label` in the header's `.pbl-timeline-band` (`--pbl-today-left`, track-relative — every strip in the tier stack is the same width, so the offset is the same number wherever it mounts).

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineFurniture.test.ts`:

```ts
describe('grid rhythm', () => {
	it('extends every interior cell boundary down the grid body', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const cells = bottomCells(containerEl);
		const lines = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-grid-line'));
		// One line per boundary BETWEEN cells: the day-0 boundary is the lead column's border.
		expect(lines.length).toBe(cells.length - 1);
		const firstWidth = parseFloat(cells[0].style.getPropertyValue('--pbl-cell-w'));
		expect(parseFloat(lines[0].style.getPropertyValue('--pbl-grid-left'))).toBe(TIMELINE_LEAD_PX + firstWidth);
	});

	it('shades weekends at week zoom alone, phased to the first Saturday', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		expect(containerEl.querySelector('.pbl-weekend-layer')).toBeNull(); // month, the default
		view.setZoom('week');
		const layer = containerEl.querySelector<HTMLElement>('.pbl-weekend-layer');
		if (!layer) throw new Error('no weekend layer at week zoom');
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window on the snapshot');
		expect(layer.style.getPropertyValue('--pbl-weekend-offset')).toBe(`${weekendOffsetDays(window) * 16}px`);
		view.setZoom('quarter');
		expect(containerEl.querySelector('.pbl-weekend-layer')).toBeNull();
	});

	it('names the today line in the header, at the line’s own offset', () => {
		const { view, containerEl } = datedRoadmap(furnishedVault());
		const label = containerEl.querySelector<HTMLElement>('.pbl-today-label');
		if (!label) throw new Error('no today label');
		expect(label.textContent).toBe('Today');
		const trackLeft = parseFloat(label.style.getPropertyValue('--pbl-today-left'));
		expect(TIMELINE_LEAD_PX + trackLeft).toBe(view.roadmap?.todayLeft ?? -1);
	});

	it('gives the today pill a strip nothing else draws in', () => {
		// The pill is opaque and placed by a day offset, so anything else it shares a
		// strip with can end up underneath it: a milestone dated today in the cell
		// tier, or — since the bottom tier drops the year — the super tier's `2026`
		// when today falls near a super cell's start. Its own band is the whole rule.
		const { containerEl } = datedRoadmap(furnishedVault());
		const band = containerEl.querySelector<HTMLElement>('.pbl-timeline-band');
		if (!band) throw new Error('no today band');
		expect(band.children).toHaveLength(1);
		expect(band.firstElementChild?.classList.contains('pbl-today-label')).toBe(true);
		const milestone = containerEl.querySelector<HTMLElement>('.pbl-milestone-label');
		expect(milestone?.parentElement?.classList.contains('pbl-timeline-band')).toBe(false);
	});
});
```

- [ ] **Step 2: Run, verify FAIL** (none of the three classes render)

- [ ] **Step 3: Implement**

In `renderTimeline` (`src/view/render/timeline.ts`):

1. Add `'--pbl-day-px': `${scale.dayPx}px`` to the existing `content.setCssProps({...})` call.
2. Immediately after that call, before `renderCellHeader`:

```ts
	// One layer, not one band per weekend: weekends are exactly 7-day periodic, so
	// the stylesheet repeats a 2-on/5-off gradient and TS publishes only the phase.
	// Week zoom alone — at 4px and 2px per day the stripes are noise, which is where
	// the surveyed tools stop shading too.
	if (scale.id === 'week') {
		const weekend = content.createDiv({ cls: 'pbl-weekend-layer', attr: { 'aria-hidden': 'true' } });
		weekend.setCssProps({ '--pbl-weekend-offset': `${weekendOffsetDays(window) * scale.dayPx}px` });
	}
```

3. After the `renderCellHeader` call, before `renderMilestoneLines`:

```ts
	renderGridLines(content, window, scale);
```

4. After the today-line block (`setTooltip(line, …)`) — into `todayBand` from Task 3,
   **not** `headerTrack`:

```ts
	// The band, which exists so this pill shares a strip with nothing. It is opaque
	// and placed by a day offset, so in either tier it would sooner or later land on
	// top of something: a milestone label in the cell tier, whose hover reveals a
	// name nothing else states, or — since the cells now drop the year — the super
	// tier's `2026`, the only place the year appears at all. Neither can be dodged by
	// nudging pixels the way the two 2px LINES are, because these are labels wide
	// enough to overlap for days on either side of the date.
	const todayLabel = todayBand.createDiv({ cls: 'pbl-today-label', text: 'Today' });
	todayLabel.setCssProps({ '--pbl-today-left': `${todayOffset(window, today, scale)}px` });
	setTooltip(todayLabel, formatCivil(today));
```

5. Add the helper (beside `renderMilestoneLines`), and `weekendOffsetDays` to the domain import:

```ts
/**
 * The header's cell boundaries, extended down the grid body — decoration only,
 * drawn before the milestone lines so a boundary never paints over a mark that
 * means something. No line at day 0: that boundary is the lead column's border.
 */
function renderGridLines(content: HTMLElement, window: TimelineWindow, scale: TimelineScale): void {
	let day = 0;
	for (const cell of timelineCells(window, scale)) {
		day += cell.days;
		if (day >= window.days) break;
		const line = content.createDiv({ cls: 'pbl-grid-line', attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-grid-left': `${TIMELINE_LEAD_PX + day * scale.dayPx}px` });
	}
}
```

- [ ] **Step 4: Style it**

Append to `styles/timelineFurniture.css`:

```css
/* The header's cell rhythm, extended down the body. Positioned, so it paints above
   row backgrounds and below the bars (positioned later in the DOM) — a 1px dashed
   line over a hover tint is the normal gantt look. */
.pbl-grid-line {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-grid-left);
	border-left: 1px dashed var(--background-modifier-border);
	pointer-events: none;
}

/* Saturdays and Sundays, one gradient: 2 days of tint, 5 of nothing, repeating —
   phased by --pbl-weekend-offset (days to the first Saturday, in px). Translucent,
   so it composes with the zebra tint and the hover in either paint order.

   The background-size is what makes the phase survive the repeat, and is not
   cosmetic: left at its default a gradient tiles at the LAYER's width, so shifting
   it exposes a copy phased to that width rather than to the week, and any window
   that is not a whole number of weeks — the 92-day Jul–Sep default among them —
   grows a stray band at its left edge. Sized to exactly one seven-day period, the
   tile IS the period and every copy lands on a Saturday. */
.pbl-weekend-layer {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-tl-lead);
	/* The WINDOW's width, not the wrapper's right edge: `.pbl-timeline-content` carries
	   `min-width: 100%`, so in a pane wider than the dated track it runs on past the
	   last cell — and `right: 0` would band blank space no header dates explain. */
	width: var(--pbl-tl-days);
	pointer-events: none;
	background-image: linear-gradient(
		to right,
		var(--background-modifier-hover) 0,
		var(--background-modifier-hover) calc(var(--pbl-day-px) * 2),
		transparent calc(var(--pbl-day-px) * 2)
	);
	background-size: calc(var(--pbl-day-px) * 7) 100%;
	background-position-x: var(--pbl-weekend-offset);
}

/* The milestone label's shape at the today line's own offset, red to match the line
   it names — but RELATIVE, not absolute, and that is the point. In flow it gives the
   otherwise-empty band its height, so no constant has to be kept in step with the
   pill's font for the strip to fit it; `left` then nudges it to the date without
   taking it back out of flow. Nothing shares the strip, so it needs no backing. */
.pbl-today-label {
	position: relative;
	left: var(--pbl-today-left);
	display: inline-block;
	padding: var(--size-4-1);
	font-size: var(--font-ui-smaller);
	font-weight: 600;
	color: var(--color-red);
}
```

- [ ] **Step 5: Run the file, the suite, `npm run check`** — all PASS

- [ ] **Step 6: Commit**

```bash
git add src/view/render/timeline.ts styles/timelineFurniture.css test/view/timelineFurniture.test.ts
git commit -m "Extend cell boundaries, weekend banding and a today label into the grid"
```

---

### Task 5: Row tracking — zebra stripes, hover, the scrolled-lead shadow

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderTimeline` loop, `renderBarRow` return type)
- Modify: `styles/timelineFurniture.css`
- Test: `test/view/timelineFurniture.test.ts`

**Interfaces:**
- Produces: `pbl-row-even` on alternate `.pbl-timeline-row`s (render-assigned — CSS has no nth-of-class); `pbl-scrolled-x` on the scroller while `scrollLeft > 0`; `renderBarRow` now returns the row `HTMLElement`.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineFurniture.test.ts`:

```ts
describe('row tracking', () => {
	it('stripes alternate rows from the render pass', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.classList.contains('pbl-row-even'))).toEqual([false, true, false]);
	});

	it('marks the grid once it is scrolled, so the lead column can carry its edge', () => {
		const { containerEl } = datedRoadmap(furnishedVault());
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('no timeline scroller');
		scroller.scrollLeft = 120;
		scroller.dispatchEvent(new Event('scroll'));
		expect(scroller.classList.contains('pbl-scrolled-x')).toBe(true);
		scroller.scrollLeft = 0;
		scroller.dispatchEvent(new Event('scroll'));
		expect(scroller.classList.contains('pbl-scrolled-x')).toBe(false);
	});
});
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Implement**

In `renderTimeline`, replace `for (const bar of bars) renderBarRow(ctx, mounts, window, bar, scale);` with:

```ts
	bars.forEach((bar, index) => {
		const row = renderBarRow(ctx, mounts, window, bar, scale);
		// Assigned at render because CSS has no nth-of-class, and nth-child would
		// count the header, the lines and the layers interleaved in this container.
		if (index % 2 === 1) row.addClass('pbl-row-even');
	});
```

And after the `grid` div is created:

```ts
	const syncScrolled = () => grid.toggleClass('pbl-scrolled-x', grid.scrollLeft > 0);
	grid.addEventListener('scroll', syncScrolled, { passive: true });
	syncScrolled();
```

(The grid is rebuilt every render pass, so the listener cannot leak — the board drag controller's own reasoning.)

Change `renderBarRow`'s signature to return `HTMLElement` and add `return row;` as its last line (after `wireCardActivation`).

- [ ] **Step 4: Style it**

Append to `styles/timelineFurniture.css`:

```css
/* Ordered faint-to-strong: zebra under hover, both translucent so the weekend
   banding reads through them. Each outranks timeline.css's transparent
   `.pbl-card.pbl-timeline-row` background by specificity, not by order — but
   hover and zebra tie with each other, so WITHIN this block order is behaviour
   and hover has to stay last. */
.pbl-card.pbl-timeline-row.pbl-row-even {
	background-color: color-mix(in srgb, var(--background-modifier-hover) 35%, transparent);
}

/* The row's background does not reach its lead cell: `.pbl-timeline-lead` paints an
   opaque --background-primary so the track can scroll under the sticky column, and an
   opaque child never shows its parent's background through. Tinting the row alone
   starts the highlight at the day area and leaves the title outside the thing tracking
   it. So the lead composes the same tint over --background-primary itself — opaque, as
   it must stay — which is why these are the same two percentages twice and not a
   variable: the pair is the appearance, and a reader comparing them is the check. */
.pbl-card.pbl-timeline-row.pbl-row-even .pbl-timeline-lead {
	background-color: color-mix(in srgb, var(--background-modifier-hover) 35%, var(--background-primary));
}

.pbl-card.pbl-timeline-row:hover {
	background-color: color-mix(in srgb, var(--background-modifier-hover) 80%, transparent);
}

.pbl-card.pbl-timeline-row:hover .pbl-timeline-lead {
	background-color: color-mix(in srgb, var(--background-modifier-hover) 80%, var(--background-primary));
}

/* Only once there is anything under the sticky edge to hint at. */
.pbl-scrolled-x .pbl-timeline-lead {
	box-shadow: 4px 0 6px -3px var(--background-modifier-border);
}
```

The lead pairing is a CASCADE fact, and jsdom computes no cascade — no test in this
suite can reach it. It is a harness check: `npm run harness` at `?view=roadmap`, hover a
row, and the highlight has to run unbroken from the title through the bar. Step 5 below
covers it.

- [ ] **Step 5: Run the file, the suite, `npm run check`** — all PASS. Then
`npm run harness` at `?view=roadmap` and hover a row: the highlight must span the lead
and the track as one band, in both colour schemes. Nothing in vitest can answer that.

- [ ] **Step 6: Commit**

```bash
git add src/view/render/timeline.ts styles/timelineFurniture.css test/view/timelineFurniture.test.ts
git commit -m "Track timeline rows: stripes, hover and a scrolled-lead shadow"
```

---

### Task 6: Bar labels

**Files:**
- Modify: `src/view/render/timeline.ts` (`renderBarRow` + new helper + new exported constant)
- Modify: `styles/timelineFurniture.css`
- Test: `test/view/timelineFurniture.test.ts`

**Interfaces:**
- Produces: `LABEL_RESERVE_PX = 160` (exported); `markWidth`, which answers with the width the STYLESHEET draws rather than `--pbl-bar-width`; one `.pbl-bar-label` per row with `pbl-bar-label-after` + `--pbl-label-left`, or `pbl-bar-label-before` + `--pbl-label-right`. Decoration only: `aria-hidden`, `pointer-events: none`, hidden while `.pbl-dragging`.

- [ ] **Step 1: Write the failing test**

Append to `test/view/timelineFurniture.test.ts`:

```ts
describe('bar labels', () => {
	it('labels the bar where the eye is, flipping sides at the window edge', () => {
		const vault = new FakeVault();
		// Far enough out that the real clock cannot move the window edge: the free
		// room right of the bar is 46 days (Jun 15 → Jul 31 2030, the padding month).
		vault.addFile('Far off.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-01', due: '2030-06-15' } });
		const { view, containerEl } = datedRoadmap(vault);

		// Month zoom: 46 days × 4px = 184px ≥ the 160px reserve — label after the bar.
		const label = () => containerEl.querySelector<HTMLElement>('.pbl-bar-label');
		expect(label()?.textContent).toBe('Far off');
		expect(label()?.getAttribute('aria-hidden')).toBe('true');
		expect(label()?.classList.contains('pbl-bar-label-after')).toBe(true);

		// Quarter zoom: 46 × 2px = 92px < 160 — the label flips before the bar.
		view.setZoom('quarter');
		expect(label()?.classList.contains('pbl-bar-label-before')).toBe(true);
	});

	it('clears the mark the stylesheet draws, not the one the span implies', () => {
		const vault = new FakeVault();
		// A milestone: one day of span, so 4px of --pbl-bar-width — and a 12px diamond
		// on screen. Measuring the span would start the title inside the mark. Both
		// ends stated, because that is what `barGeometry` requires of a milestone: an
		// end borrowed from a lone `due` is a one-day BAR and never reaches this branch.
		vault.addFile('Ship it.md', { frontmatter: { type: 'PBI', order: 10, start: '2030-06-15', due: '2030-06-15' } });
		const { containerEl } = datedRoadmap(vault);
		const bar = containerEl.querySelector<HTMLElement>('.pbl-bar-milestone');
		const label = containerEl.querySelector<HTMLElement>('.pbl-bar-label-after');
		if (!bar || !label) throw new Error('no milestone diamond, or no after-label');
		const gap =
			parseFloat(label.style.getPropertyValue('--pbl-label-left')) -
			parseFloat(bar.style.getPropertyValue('--pbl-bar-left'));
		expect(gap).toBe(12);
	});

	it('drops the label rather than placing it off the track', () => {
		const vault = new FakeVault();
		// Clipped at both window edges: no room after, and flipping it before a bar
		// starting at day 0 would set --pbl-label-right to the whole track width and
		// park the label behind the sticky lead. The lead already shows the title.
		vault.addFile('Whole plan.md', { frontmatter: { type: 'PBI', order: 10, start: '2020-01-01', due: '2040-01-01' } });
		const { containerEl } = datedRoadmap(vault);
		expect(containerEl.querySelector('.pbl-bar')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-bar-label')).toBeNull();
	});
});
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Implement**

In `src/view/render/timeline.ts`, add near `TIMELINE_LEAD_PX`:

```ts
/**
 * Room reserved for a title beside its bar, in PIXELS — matches the label's CSS
 * budget (max-width 144px + 2×8px padding). Short of this at the window's right
 * edge, the label flips to the bar's left rather than truncating against nothing.
 */
export const LABEL_RESERVE_PX = 160;

/** `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css` — see `markWidth`. */
const MILESTONE_MARK_PX = 12;
const OUTSIDE_MARK_PX = 10;
```

In `renderBarRow`, after the grips loop and before the marker `aria-label` line:

```ts
	renderBarLabel(track, bar, geometry, scale, window);
```

Add both helpers beside `barClasses`:

```ts
/**
 * How wide the mark actually DRAWS, which is what a label beside it has to clear.
 * `--pbl-bar-width` is not that number for two of the three shapes: `.pbl-bar-milestone`
 * is a 12px diamond and `.pbl-bar-outside` a 10px arrow whatever the span, so a
 * one-day milestone at quarter zoom measures 4px here and would have its title
 * painted across it. Same order of tests as `barClasses`, which is what decides
 * which shape is drawn — keep the two in step, and both in step with
 * `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css`.
 *
 * The diamond's 45° rotation puts its tips ~2.5px outside this box; the label's own
 * 8px of padding is the clearance, so this stays the CSS width rather than a
 * bounding-box calculation nothing else in the file does.
 */
function markWidth(geometry: BarGeometry, scale: TimelineScale): number {
	if (geometry.outside) return OUTSIDE_MARK_PX;
	if (geometry.milestone) return MILESTONE_MARK_PX;
	return Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX);
}

/**
 * The title where the reader's eye already is — decoration only. The row's
 * accessible name carries the title and the bar's aria-label the dates, so this
 * is aria-hidden; pointer-events die in CSS so the grips never lose a hit.
 */
function renderBarLabel(
	track: HTMLElement,
	bar: TimelineBar,
	geometry: BarGeometry,
	scale: TimelineScale,
	window: TimelineWindow,
): void {
	const left = geometry.startDay * scale.dayPx;
	const width = markWidth(geometry, scale);
	const trackWidth = window.days * scale.dayPx;
	const after = left + width + LABEL_RESERVE_PX <= trackWidth;
	// Neither side has room: a bar clipped at BOTH window edges leaves none, and
	// flipping it before a bar that starts at day 0 would put the whole label off the
	// track behind the sticky lead column. Nothing is lost by dropping it — the row's
	// lead carries the same title, which is what makes this decoration rather than
	// content, and squeezing it over the bar would only trade a hidden label for an
	// unreadable one.
	if (!after && left < LABEL_RESERVE_PX) return;
	const label = track.createDiv({ cls: 'pbl-bar-label', text: bar.item.title, attr: { 'aria-hidden': 'true' } });
	if (after) {
		label.addClass('pbl-bar-label-after');
		label.setCssProps({ '--pbl-label-left': `${left + width}px` });
	} else {
		label.addClass('pbl-bar-label-before');
		label.setCssProps({ '--pbl-label-right': `${trackWidth - left}px` });
	}
}
```

- [ ] **Step 4: Style it**

Append to `styles/timelineFurniture.css`:

```css
/* max-width + 2×padding = LABEL_RESERVE_PX in render/timeline.ts — the reserve the
   side flip is decided against. Change them together. */
.pbl-bar-label {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	max-width: 144px;
	padding: 0 var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	pointer-events: none;
}

.pbl-bar-label-after {
	left: var(--pbl-label-left);
}

.pbl-bar-label-before {
	right: var(--pbl-label-right);
}

/* The grid declutters exactly while the user is aiming a drop. */
.pbl-dragging .pbl-bar-label {
	visibility: hidden;
}
```

- [ ] **Step 5: Run the file, the suite, `npm run check`** — all PASS

- [ ] **Step 6: Commit**

```bash
git add src/view/render/timeline.ts styles/timelineFurniture.css test/view/timelineFurniture.test.ts
git commit -m "Label each bar with its title in the track"
```

---

### Task 7: Density — the stored pick

**Files:**
- Modify: `src/storage/collapseStore.ts`
- Modify: `src/view/collapseState.ts`
- Test: `test/storage/collapseStore.test.ts` (only if it has per-field describe blocks — check; otherwise the view round-trip in Task 8 is the coverage, matching how `zoom` is tested)

**Interfaces:**
- Produces: `CollapseSnapshot.density?: string | null`, `StoredEntry.density?: string` (enum `['compact']`, absent = comfortable); `CollapseState.densityPick(): string | null` and `CollapseState.setDensity(value: string | null): void`.

- [ ] **Step 1: Implement the store field — `zoom`'s shape, exactly**

In `src/storage/collapseStore.ts`:

1. After `ZOOM_VALUES`:
```ts
/** The values the `density` field may hold; absent means comfortable rows, the default. */
const DENSITY_VALUES = ['compact'];
```
2. `CollapseSnapshot`, after `zoom`:
```ts
	/** The retained timeline row density; null or absent means comfortable, the default. */
	density?: string | null;
```
3. `StoredEntry`, after `zoom`:
```ts
	/** Absent means comfortable rows, the default. */
	density?: string;
```
4. `writePicks` — add `if (snapshot.density) entry.density = snapshot.density;` and update its doc comment's "The four picks" to "The five picks".
5. `loadCollapseState` — add `density: entry?.density ?? null,` after `zoom`.
6. `entryHasContent` — add `entry.density !== undefined ||` after the `zoom` line.
7. `readEntry` — after the zoom block:
```ts
	const density = readEnum(record.density, DENSITY_VALUES);
	if (density !== undefined) entry.density = density;
```

- [ ] **Step 2: Implement the controller — mirror `zoomPick`/`setZoom`**

In `src/view/collapseState.ts`:

1. Field, after `zoom`:
```ts
	/** The retained timeline row density; null means comfortable, the default. */
	private density: string | null = null;
```
2. Methods, after `setZoom`:
```ts
	/** The retained row density for this saved view — null means comfortable, the default. */
	densityPick(): string | null {
		return this.density;
	}

	setDensity(value: string | null): void {
		this.density = value;
		this.scheduleSave();
	}
```
3. `restore` — add `this.density = snapshot.density ?? null;` after the `zoom` line.
4. `flush`'s `saveCollapseState` snapshot — add `density: this.density,` after `zoom`.

- [ ] **Step 3: Build and lint only** (the field is dead until Task 8 wires the host — fallow may flag `densityPick`/`setDensity` as unused class members; if it does, squash Tasks 7 and 8 into ONE commit rather than suppressing anything)

Run: `npm run check`
Expected: PASS, or fallow reporting the two new members unused — in which case do **not** commit yet; proceed to Task 8 and commit both together.

- [ ] **Step 4: Commit (or defer to Task 8's commit)**

```bash
git add src/storage/collapseStore.ts src/view/collapseState.ts
git commit -m "Store a timeline row density beside the zoom"
```

---

### Task 8: Density — host, toolbar and the compact class

**Files:**
- Modify: `src/view/host.ts` (interface members after `setZoom`)
- Modify: `src/view/backlogView.ts` (after the `setZoom` block, ~line 244)
- Modify: `src/view/render/toolbar.ts` (`renderTimelineControls`)
- Modify: `src/view/render/timeline.ts` (`renderTimeline`)
- Modify: `styles/timelineFurniture.css`
- Test: `test/view/timelineZoom.test.ts` (new describe — the file is 114/450 lines)

**Interfaces:**
- Consumes: `densityPick`/`setDensity` from Task 7.
- Produces: `BacklogViewHost.density: string | null` and `setDensity(value: string | null): void`; `.pbl-density-toggle` button (dated axis only); `pbl-density-compact` on `.pbl-timeline`.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineZoom.test.ts`:

```ts
describe('the density toggle', () => {
	function densityButton(containerEl: HTMLElement): HTMLButtonElement {
		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-density-toggle');
		if (!btn) throw new Error('density toggle not found');
		return btn;
	}

	it('compacts the grid from the toolbar without touching a note or the base', () => {
		const vault = datedVault();
		const { view, containerEl, config } = makeView(vault, DATE_AXIS, { collapsed: true });
		expect(containerEl.querySelector('.pbl-density-toggle')).toBeNull(); // tree mode
		view.setProjection('roadmap');

		expect(densityButton(containerEl).getAttribute('aria-pressed')).toBe('false');
		densityButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(densityButton(containerEl).getAttribute('aria-pressed')).toBe('true');
		// The name is the setting, not the next action: it must NOT flip with the
		// state, or the pressed toggle announces the mode it is not in.
		expect(densityButton(containerEl).getAttribute('aria-label')).toBe('Compact rows');
		expect(containerEl.querySelector('.pbl-timeline')?.classList.contains('pbl-density-compact')).toBe(true);
		expect(vault.writeLog).toHaveLength(0);
		expect(config.setCalls).toEqual([]);

		// Toggling back clears the class and the pick.
		densityButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-timeline')?.classList.contains('pbl-density-compact')).toBe(false);
		expect(view.density).toBeNull();
	});

	it('comes back compact across a reopen, and reads a foreign value as comfortable', () => {
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		first.view.setProjection('roadmap');
		first.view.setDensity('compact');
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(second.view.density).toBe('compact');
		second.view.onunload();

		// Stored state is user-writable data another version may have written: an
		// unknown density reads back as the default, never trusted into the class.
		const map = vault.localStorage.get('product-backlog:collapse') as Record<string, { density?: string }>;
		map['Plan.base#Roadmap'].density = 'cozy';
		const third = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(third.view.density).toBeNull();
	});
});
```

(If `makeView`'s option is named differently than `viewName`, copy the spelling from the zoom round-trip test at the top of this same file.)

- [ ] **Step 2: Run, verify FAIL** (`density` does not exist on the view)

- [ ] **Step 3: Implement**

`src/view/host.ts`, after `setZoom`:

```ts
	/**
	 * The retained row density for the dated axis — 'compact', or null for
	 * comfortable, the default. UI state exactly like the zoom beside it.
	 */
	readonly density: string | null;
	/** Toggle compact rows and re-render; the collapse store persists the pick. */
	setDensity(value: string | null): void;
```

`src/view/backlogView.ts`, after the `setZoom` method:

```ts
	get density(): string | null {
		return this.collapse.densityPick();
	}

	setDensity(value: string | null): void {
		if (value === this.density) return;
		this.collapse.setDensity(value);
		// UI state like the zoom: no config was set, so this render is the change.
		this.render();
	}
```

`src/view/render/toolbar.ts`, in `renderTimelineControls`, after the three `position(...)` calls and before the jump-to-today button:

```ts
	const compact = host.density === 'compact';
	// The name is the SETTING, fixed, and aria-pressed carries its value — a toggle
	// whose name changes to the next action announces "Comfortable rows, pressed"
	// while compact rows are on, which states the opposite of what is true. The icon
	// still swaps: it is the sighted affordance, and it says nothing to a reader.
	const densityBtn = iconButton(barEl, compact ? 'rows-2' : 'rows-4', 'Compact rows');
	densityBtn.addClass('pbl-density-toggle');
	densityBtn.toggleClass('is-active', compact);
	densityBtn.setAttribute('aria-pressed', String(compact));
	densityBtn.addEventListener('click', () => host.setDensity(compact ? null : 'compact'));
```

`src/view/render/timeline.ts`, in `renderTimeline`, right after the `grid` div is created:

```ts
	grid.toggleClass('pbl-density-compact', ctx.host.density === 'compact');
```

- [ ] **Step 4: Style it**

Append to `styles/timelineFurniture.css`:

```css
/* Compact rows: the 14px bar still fits a 24px row. Outranks timeline.css's
   min-height and the lead's padding by specificity. */
.pbl-density-compact .pbl-timeline-row .pbl-timeline-track {
	min-height: 24px;
}

.pbl-density-compact .pbl-timeline-lead {
	padding-top: 0;
	padding-bottom: 0;
}
```

- [ ] **Step 5: Run the file, the suite, `npm run check`** — all PASS. If Task 7 deferred its commit on fallow's unused-member report, this is where it clears: the host now reaches both members.

- [ ] **Step 6: Commit**

```bash
git add src/view/host.ts src/view/backlogView.ts src/view/render/toolbar.ts src/view/render/timeline.ts styles/timelineFurniture.css test/view/timelineZoom.test.ts
git commit -m "Toggle compact timeline rows from the toolbar"
```

(Include `src/storage/collapseStore.ts src/view/collapseState.ts` here if Task 7's commit was deferred.)

---

### Task 9: Register, README, smoke line, coverage floor

**Files:**
- Create: `docs/requirements/Reading the grid.md`
- Modify: `docs/requirements/Smoke test the roadmap.md` (one checklist line)
- Modify: `docs/README.md` (one sentence in the Roadmap paragraph)
- Modify: `vitest.config.mts` (coverage thresholds, up only)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–8 (the note's `## Where it lives` names those files).

- [ ] **Step 1: Find the new PBI's order**

Run: `grep -rZl 'parent: "\[\[The timeline\]\]"' docs/requirements | xargs -0 grep -H '^order:'`

NUL-delimited, because every note in this register is named in prose and half of them
contain spaces — plain `xargs` splits `Bars from two dates.md` into four arguments and
the pipeline exits 123 having reported nothing.

As of writing that prints 10, 20 and 30, so the value below is **40**. Re-run it anyway:
a sibling landing first moves it.

- [ ] **Step 2: Write the note**

Create `docs/requirements/Reading the grid.md` (adjust `order:` per Step 1):

```markdown
---
type: PBI
parent: "[[The timeline]]"
order: 40
status: Done
priority: P2
created: 2026-08-05
files:
  - src/domain/timeline.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbar.ts
  - src/storage/collapseStore.ts
  - styles/timelineFurniture.css
---

# Reading the grid

**As** someone reading the dated axis, **I want** the grid furnished the way the
surveyed gantt tools converge on — oriented, tracked and labeled — **so that** finding
a bar, its date and its neighbours needs no hovering and no horizontal guesswork.

Every mark here is decoration over facts other elements already carry accessibly: the
row's name, the bar's dated aria-label, the today line's tooltip. Nothing is focusable,
nothing is written, and no rendering decision changes what places or what shelves.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The dated axis renders, or the density toggle is pressed |
| **Preconditions** | Roadmap mode is on, the dated axis is drawn |
| **Guarantee** | Furniture is derived at render from the window and scale alone — never stored on a note, never a write target, and absent furniture never removes a fact: everything a mark shows is also in a row's accessible name or tooltip. |

**Main flow**

1. The header draws two tiers — months above weeks, years above months and quarters —
   both clipped to the window, the bottom tier dropping the year the top tier carries.
2. Each interior cell boundary extends down the grid body; at week zoom, weekends
   shade as a single repeating band phased to the window's first Saturday.
3. The today line's date names itself with a Today label in a header strip of its own,
   so it can bury neither a milestone's name nor the year.
4. Alternate rows stripe, the hovered row highlights across lead and track, and the
   sticky lead column carries a shadow once the grid is scrolled.
5. Each bar carries its title beside it in the track, flipping to the bar's other
   side where the window's edge leaves no room; all labels hide while a drag is live.
6. A toolbar toggle compacts the row height, stored per saved view per device beside
   the zoom pick — UI state, never the `.base`.

**Extensions**

- **2a — month or quarter zoom.** No weekend band renders: at 4px and 2px per day the
  stripes are noise, which is where the surveyed tools stop shading too.
- **5a — the item is a milestone.** The diamond takes the same label through the same
  code path.
- **6a — a stored density this plugin never wrote.** Read defensively and dropped, like
  every stored pick: the view opens comfortable.

## Acceptance criteria

- Both header tiers cover exactly the window at every zoom, and the two tiers' day
  totals agree; the bottom tier is year-free where the top tier carries the year, the
  week cells keeping their month.
- Gridlines are one per interior cell boundary — none at day 0, where the lead
  column's border already is.
- Weekend banding renders at week zoom only, phased by `weekendOffsetDays`.
- Bar labels are aria-hidden, take no pointer events, flip sides against
  `LABEL_RESERVE_PX`, and hide while a drag is live.
- The density pick round-trips through the collapse store, renders only on the dated
  axis, and an unrecognized stored value reads as comfortable.
- No mark is focusable and nothing here writes: the furniture is derived at render
  and derived only.

## Where it lives

`superCells`, `weekendOffsetDays` and the year-free `cellLabel` in
`src/domain/timeline.ts`; the tiers, gridlines, weekend layer, today label, stripes,
scroll shadow and bar labels in `src/view/render/timeline.ts`; the density toggle in
`src/view/render/toolbar.ts` over a `density` field beside `zoom` in
`src/storage/collapseStore.ts`; the rules in `styles/timelineFurniture.css`. Driven in
`test/domain/timeline.test.ts`, `test/view/timelineFurniture.test.ts` and
`test/view/timelineZoom.test.ts`.
```

- [ ] **Step 3: The smoke line and the README sentence**

Open `docs/requirements/Smoke test the roadmap.md`, match its checklist format, and add:

```markdown
- [ ] The grid furniture stays furniture under a real theme: gridlines, weekend
  banding and the row stripes read as background behind the bars, and the Today
  and milestone labels stay legible over the header cells.
```

Open `docs/README.md`, find the Roadmap paragraph, and append one sentence in its
voice, e.g.: `The dated axis reads as a gantt: a two-tier header, weekend banding at
week zoom, a labeled today line, striped and hoverable rows, titles beside the bars,
and a compact density.` (Adapt to the surrounding prose; the exact wording is not
load-bearing, the mention is.)

- [ ] **Step 4: Raise the coverage floor**

Run: `npm run check`. Open `vitest.config.mts`, compare each threshold against the
run's actuals, and raise any threshold that sits below its actual to the actual
rounded **down** to one decimal. Never lower one.

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`
Expected: PASS — including `docs-check` accepting the new note's shape, links and paths.

```bash
git add docs/requirements/"Reading the grid.md" docs/requirements/"Smoke test the roadmap.md" docs/README.md vitest.config.mts
git commit -m "Register the grid furniture and raise the coverage floor"
```

- [ ] **Step 6: Look at it**

Run: `npm run harness` and open `?view=roadmap` in both schemes — the layout, tiers,
stripes and labels are all judgeable there. Note for the human: `npm run test-build`
for the one thing the harness cannot answer (theme colour), per the smoke-test line.
