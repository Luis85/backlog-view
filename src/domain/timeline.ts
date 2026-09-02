import { formatDate } from '../i18n/t';
import { CivilDate, daysInMonth } from './noteFields';

/**
 * Calendar arithmetic for the roadmap's dated axis: spans, the month-aligned
 * window the grid draws, and where in it a date falls. Pure civil-date math —
 * every function works on year/month/day triples and none consults a clock or a
 * zone, so the same note occupies the same cell on every device and every test
 * says which day "today" is.
 */

/** What an item states about its plan: at least one end, read straight off the note. */
export interface DateSpan {
	start: CivilDate | null;
	target: CivilDate | null;
}

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

/** Days from `a` to `b` (negative when `b` precedes `a`); Date.UTC so no zone leaks in. */
export function daysBetween(a: CivilDate, b: CivilDate): number {
	return Math.round((utc(b) - utc(a)) / 86_400_000);
}

function utc(date: CivilDate): number {
	return Date.UTC(date.year, date.month - 1, date.day);
}

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

/**
 * The earlier of two optional dates — absence is not a bound, so a null end
 * yields the other. Ties keep `a`, which is the accumulator at every call site
 * and makes the fold stable.
 */
export function earliest(a: CivilDate | null, b: CivilDate | null): CivilDate | null {
	if (a === null || b === null) return a ?? b;
	return daysBetween(a, b) < 0 ? b : a;
}

/** The later of two optional dates, by the same rule as `earliest`. */
export function latest(a: CivilDate | null, b: CivilDate | null): CivilDate | null {
	if (a === null || b === null) return a ?? b;
	return daysBetween(a, b) > 0 ? b : a;
}

/**
 * True when both ends are stated and the target precedes the start. Such a pair
 * is a typo to fix, never a span: `deriveBars` shelves the item that states one,
 * and the rollup walk refuses it as evidence, because an inference standing in
 * for a value that needs correcting is exactly what hides the correction. One
 * statement of the rule, since it is asked in two layers.
 */
export function reversedSpan(start: CivilDate | null, target: CivilDate | null): boolean {
	return start !== null && target !== null && daysBetween(start, target) < 0;
}

/** `2026-08-01` — the register's own date format, and the tooltip's. */
export function formatCivil(date: CivilDate): string {
	const pad = (n: number, width: number) => String(n).padStart(width, '0');
	return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Year and month only — the unit the window is aligned to. */
interface MonthPoint {
	year: number;
	month: number;
}

function addMonths(point: MonthPoint, count: number): MonthPoint {
	const index = point.year * 12 + (point.month - 1) + count;
	return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

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

/**
 * Days from the window's start to its first Saturday — the phase the weekend
 * layer's 7-day repeating gradient starts at. ISO weekday, the module's own
 * boundary rule, so the same window shades the same days on every device.
 */
export function weekendOffsetDays(window: TimelineWindow): number {
	return (5 - isoWeekday(window.start) + 7) % 7;
}

/**
 * Where a span sits in the window, in whole days from its start. Ends are
 * inclusive — a one-day span is one day wide — and an end the note does not
 * state borrows the other, so a single date renders at the date it has. An
 * equal pair the note STATES is the milestone case, a point in time rather
 * than a span — an end borrowed from the other is not one, or every note
 * carrying a single date would render as a diamond instead of the one-day
 * bar it is. Reversed spans never reach here: they shelve as
 * unreadable. `outside` is the further answer a POINT needs, that a clipped
 * span does not: whether anything of it is in view at all.
 */
export interface BarGeometry {
	/** First day of the bar, clamped into the window. */
	startDay: number;
	/** Days the bar covers inside the window, at least 1. */
	spanDays: number;
	/**
	 * True when the note STATES both ends and they land on the same day — never for an
	 * end borrowed from the other, or every note carrying a single date would be one.
	 */
	milestone: boolean;
	/** True when that end runs past the window's edge and was clamped to it. */
	clippedStart: boolean;
	clippedEnd: boolean;
	/**
	 * True when NOTHING of the span is inside the window — it lies wholly past one edge,
	 * and `startDay`/`spanDays` describe the clamp rather than the span. A clipped bar can
	 * honestly say "this continues beyond what is drawn", because part of it is still in
	 * view; a point beyond the edge cannot, and drawing it at the edge would claim a date
	 * the item does not have. Which side it lies past is `clippedStart`.
	 */
	outside: boolean;
}

export function barGeometry(window: TimelineWindow, span: DateSpan): BarGeometry {
	const start = span.start ?? span.target;
	const end = span.target ?? span.start;
	// deriveBars admits only spans with at least one stated end.
	if (start === null || end === null) throw new Error('a bar needs at least one date');
	const startDay = daysBetween(window.start, start);
	const endDay = daysBetween(window.start, end);
	const lastDay = window.days - 1;
	const clampedStart = Math.min(Math.max(startDay, 0), lastDay);
	const clampedEnd = Math.min(Math.max(endDay, 0), lastDay);
	return {
		startDay: clampedStart,
		spanDays: clampedEnd - clampedStart + 1,
		milestone: span.start !== null && span.target !== null && daysBetween(span.start, span.target) === 0,
		clippedStart: startDay < 0,
		clippedEnd: endDay > lastDay,
		outside: endDay < 0 || startDay > lastDay,
	};
}

/**
 * Where one dependency edge's arrow anchors, in days from the window's start — the
 * prerequisite's END day and the dependent's START day, both read off `barGeometry`
 * rather than restated: an anchor at a clipped end lands on the clipped edge because
 * `startDay`/`spanDays` are already clamped there, an anchor at an open end lands on
 * the day the borrowed date already draws the bar at because `barGeometry` borrows it
 * before this ever runs, and a milestone's end equals its start because a point has
 * no width to add — [[Arrows between bars]] 1e, 1g and 1h, none of them a case this
 * function writes, all of them `barGeometry`'s own rule read from the far side.
 *
 * Null when either end has nothing of its own bar in the window at all (`outside`):
 * an arrow needs two ends and the window has one — 1a's other half, the one no
 * domain edge list can see, because window clipping is a render-time fact
 * `dependencyArrows` never asked.
 */
export interface DependencyAnchor {
	fromDay: number;
	toDay: number;
}

export function dependencyAnchor(window: TimelineWindow, from: DateSpan, to: DateSpan): DependencyAnchor | null {
	const fromGeometry = barGeometry(window, from);
	const toGeometry = barGeometry(window, to);
	if (fromGeometry.outside || toGeometry.outside) return null;
	const fromDay = fromGeometry.milestone ? fromGeometry.startDay : fromGeometry.startDay + fromGeometry.spanDays;
	return { fromDay, toDay: toGeometry.startDay };
}

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

/** Monday is 0 — ISO 8601, one boundary on every device rather than a locale guess. */
function isoWeekday(date: CivilDate): number {
	return (new Date(utc(date)).getUTCDay() + 6) % 7;
}

function quarterFirstMonth(month: number): number {
	return month - ((month - 1) % 3);
}

/**
 * The cell's name, from the unit's own first day so a clipped cell still names it.
 * Year-free below the top tier: the super tier carries the year, and repeating it
 * per cell is the noise the tier exists to remove. The week cell keeps its month —
 * a week can straddle two, so its label stays self-sufficient.
 *
 * The two that name a MONTH are formatted in the reader's own locale (`formatDate`),
 * because a month name is data presentation and not a translation — the whole point of
 * [[Locale-aware sorting and formatting]]. The week label hands `Intl` the day and the
 * month together rather than pasting them, since their order is the locale's to choose.
 *
 * **`Q3` is NOTATION and stays spelled here, which is a decision rather than an
 * oversight.** `Intl.DateTimeFormat` has no quarter field to ask — CLDR carries quarter
 * names, ECMA-402 exposes none — so the choice is this or twelve months' worth of the
 * mistake the month labels just stopped making: a catalog key would make a quarter
 * GRAMMAR and freeze it at the languages this plugin happens to ship, where `Q3` at least
 * reads the same everywhere. It is the same kind of stable notation as `formatCivil`'s
 * `2026-08-01`, and it moves the day `Intl` grows a field for it.
 */
function cellLabel(unit: ScaleId, unitStart: CivilDate): string {
	if (unit === 'week') return formatDate('dayMonth', unitStart.year, unitStart.month, unitStart.day);
	if (unit === 'month') return formatDate('month', unitStart.year, unitStart.month);
	return `Q${Math.floor((unitStart.month - 1) / 3) + 1}`;
}

/**
 * The super tier's name for its unit — the tier that owns the year spells it out.
 *
 * The bare year goes through the calendar formatter too, never `formatNumber`, which
 * would group it as `2,026`. `String(year)` was the third option and is what this drew
 * until the cells beside it became locale-aware: it writes ASCII digits under a header
 * whose months are the reader's, so a Persian roadmap read `2026` over `۲۰۲۶`.
 */
function superLabel(unit: HeaderUnit, unitStart: CivilDate): string {
	if (unit === 'month') return formatDate('monthYear', unitStart.year, unitStart.month);
	return formatDate('year', unitStart.year, 1);
}
