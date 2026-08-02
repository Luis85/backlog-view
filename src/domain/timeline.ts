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

/**
 * The grid's fixed scale, pixels per day. Months render at their true lengths
 * (28–31 days) rather than as equal boxes, so a bar's width is its duration.
 */
export const DAY_PX = 4;

/**
 * Backstop on how many months the grid will draw. A typo'd year must not hang
 * the view under tens of thousands of header cells; the window clamps around
 * today and the far-flung bar clips to the edge, styled as running beyond it.
 */
export const MAX_TIMELINE_MONTHS = 60;

/** One header cell: a month at its true length. */
export interface TimelineMonth {
	label: string;
	days: number;
}

/** The dated grid: month-aligned, spanning every placed date and today, bounded. */
export interface TimelineWindow {
	start: CivilDate;
	/** Total days the grid covers — the sum of the month cells. */
	days: number;
	months: TimelineMonth[];
}

/** Days from `a` to `b` (negative when `b` precedes `a`); Date.UTC so no zone leaks in. */
export function daysBetween(a: CivilDate, b: CivilDate): number {
	return Math.round((utc(b) - utc(a)) / 86_400_000);
}

function utc(date: CivilDate): number {
	return Date.UTC(date.year, date.month - 1, date.day);
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Year and month only — the unit the window is aligned to. */
interface MonthPoint {
	year: number;
	month: number;
}

function addMonths(point: MonthPoint, count: number): MonthPoint {
	const index = point.year * 12 + (point.month - 1) + count;
	return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

function monthsBetween(a: MonthPoint, b: MonthPoint): number {
	return b.year * 12 + (b.month - 1) - (a.year * 12 + (a.month - 1));
}

/**
 * The month-aligned window the grid draws: every placed date and today, padded a
 * month each side. When the dates would blow past `MAX_TIMELINE_MONTHS`, the
 * window clamps to that many months around today instead — today stays in view,
 * and a bar beyond the edge clips rather than dragging thousands of empty header
 * cells into the DOM. With nothing placed it is the dated grid around today.
 */
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
	let first: MonthPoint = addMonths({ year: min.year, month: min.month }, -1);
	let last: MonthPoint = addMonths({ year: max.year, month: max.month }, 1);
	if (monthsBetween(first, last) + 1 > MAX_TIMELINE_MONTHS) {
		const anchor: MonthPoint = { year: today.year, month: today.month };
		first = addMonths(anchor, -Math.floor(MAX_TIMELINE_MONTHS / 2));
		last = addMonths(first, MAX_TIMELINE_MONTHS - 1);
	}
	const months: TimelineMonth[] = [];
	let days = 0;
	for (let point = first; monthsBetween(point, last) >= 0; point = addMonths(point, 1)) {
		const length = daysInMonth(point.year, point.month);
		months.push({ label: `${MONTH_LABELS[point.month - 1]} ${point.year}`, days: length });
		days += length;
	}
	return { start: { year: first.year, month: first.month, day: 1 }, days, months };
}

/**
 * Where a span sits in the window, in whole days from its start. Ends are
 * inclusive — a one-day span is one day wide — and an end the note does not
 * state borrows the other, so a single date renders at the date it has. An
 * equal pair, stated or inferred, is the milestone case, a point in time
 * rather than a span. Reversed spans never reach here: they shelve as
 * unreadable.
 */
export interface BarGeometry {
	/** First day of the bar, clamped into the window. */
	startDay: number;
	/** Days the bar covers inside the window, at least 1. */
	spanDays: number;
	/** True when both ends land on the same day, whether stated or inferred. */
	milestone: boolean;
	/** True when that end runs past the window's edge and was clamped to it. */
	clippedStart: boolean;
	clippedEnd: boolean;
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
	};
}
