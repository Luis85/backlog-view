import { describe, expect, it } from 'vitest';
import { CivilDate } from '../../src/domain/noteFields';
import {
	addDays,
	barGeometry,
	cellSpan,
	dayAt,
	DateSpan,
	daysBetween,
	DEFAULT_SCALE_ID,
	dependencyAnchor,
	earliest,
	formatCivil,
	latest,
	MAX_TIMELINE_DAYS,
	mergeSpans,
	SCALES,
	scaleFor,
	superCells,
	timelineCells,
	timelineWindow,
	unionDays,
	weekendOffsetDays,
} from '../../src/domain/timeline';

const d = (year: number, month: number, day: number): CivilDate => ({ year, month, day });
const TODAY = { year: 2026, month: 8, day: 4 };

describe('civil-date arithmetic', () => {
	it('counts days between civil dates, sign included, with no zone in sight', () => {
		expect(daysBetween(d(2026, 8, 1), d(2026, 8, 1))).toBe(0);
		expect(daysBetween(d(2026, 8, 1), d(2026, 9, 1))).toBe(31);
		expect(daysBetween(d(2026, 9, 1), d(2026, 8, 1))).toBe(-31);
		// Across the leap day.
		expect(daysBetween(d(2028, 2, 28), d(2028, 3, 1))).toBe(2);
	});

	it('formats as the register’s own date shape, padded', () => {
		expect(formatCivil(d(2026, 8, 1))).toBe('2026-08-01');
		expect(formatCivil(d(986, 12, 31))).toBe('0986-12-31');
	});
});

describe('the timeline window', () => {
	it('is the dated grid around today when nothing is placed', () => {
		const window = timelineWindow([], d(2026, 8, 15));

		expect(window.start).toEqual(d(2026, 7, 1));
		expect(timelineCells(window, scaleFor('month')).map((c) => c.label)).toEqual(['Jul', 'Aug', 'Sep']);
		expect(window.days).toBe(31 + 31 + 30);
	});

	it('spans every placed date and today, padded a month each side', () => {
		const spans = [
			{ start: d(2026, 5, 20), target: d(2026, 6, 2) },
			{ start: null, target: d(2026, 11, 30) },
		];
		const window = timelineWindow(spans, d(2026, 8, 15));
		const cells = timelineCells(window, scaleFor('month'));

		expect(cells[0].label).toBe('Apr');
		expect(cells[cells.length - 1].label).toBe('Dec');
	});

	it('knows a leap February from a plain one', () => {
		const window = timelineWindow([], d(2028, 2, 10));
		const february = timelineCells(window, scaleFor('month')).find((c) => c.label === 'Feb');
		expect(february?.days).toBe(29);
	});

	it('clamps a runaway year to the bounded grid, keeping today inside', () => {
		const spans = [{ start: d(2026, 8, 1), target: d(9999, 1, 1) }];
		const window = timelineWindow(spans, d(2026, 8, 15));

		expect(window.days).toBe(MAX_TIMELINE_DAYS);
		const labels = timelineCells(window, scaleFor('month')).map((c) => c.label);
		expect(labels).toContain('Aug');
	});
});

describe('bar geometry', () => {
	const window = timelineWindow([], d(2026, 8, 15)); // Jul 1 … Sep 30

	it('spans inclusively from start to target', () => {
		const bar = barGeometry(window, { start: d(2026, 8, 1), target: d(2026, 8, 10) });
		expect(bar.startDay).toBe(31);
		expect(bar.spanDays).toBe(10);
		expect(bar.milestone).toBe(false);
		expect(bar.clippedStart).toBe(false);
		expect(bar.clippedEnd).toBe(false);
	});

	it('places a single date at the date it has, one day wide', () => {
		expect(barGeometry(window, { start: d(2026, 8, 1), target: null }).spanDays).toBe(1);
		expect(barGeometry(window, { start: null, target: d(2026, 8, 1) }).startDay).toBe(31);
	});

	it('marks equal stated ends as the milestone case', () => {
		const bar = barGeometry(window, { start: d(2026, 8, 1), target: d(2026, 8, 1) });
		expect(bar.milestone).toBe(true);
		// A lone date is a point with an open end, not a milestone: the note did not
		// say the plan starts and ends there, only where one end is.
		expect(barGeometry(window, { start: d(2026, 8, 1), target: null }).milestone).toBe(false);
	});

	it('clips an end past the window’s edge and says so', () => {
		const bar = barGeometry(window, { start: d(2026, 6, 1), target: d(2026, 12, 1) });
		expect(bar.startDay).toBe(0);
		expect(bar.clippedStart).toBe(true);
		expect(bar.clippedEnd).toBe(true);
		expect(bar.spanDays).toBe(window.days);
	});

	it('refuses a fully dateless span — deriveBars never admits one', () => {
		expect(() => barGeometry(window, { start: null, target: null })).toThrow();
	});

	it('says a span is wholly outside the window rather than reporting a clamped one', () => {
		// The window clamps at MAX_TIMELINE_DAYS around today, so a typo'd year lands
		// past the edge. Clamping a POINT onto that edge draws a diamond at a date the
		// milestone does not have — and a diamond is exactly the claim that this is the
		// date, where a clipped end only claims a direction.
		const far = d(2200, 1, 1);
		const beyond = barGeometry(window, { start: far, target: far });
		expect(beyond.outside).toBe(true);
		expect(beyond.clippedEnd).toBe(true);
		const before = d(1900, 1, 1);
		const past = barGeometry(window, { start: before, target: before });
		expect(past.outside).toBe(true);
		expect(past.clippedStart).toBe(true);
	});

	it('does not call a span outside when it merely runs past both edges', () => {
		// A bar covering the whole window is in view everywhere; only "nothing of it is
		// drawn" is outside.
		const wide = barGeometry(window, { start: d(1900, 1, 1), target: d(2200, 1, 1) });
		expect(wide.outside).toBe(false);
		const inside = barGeometry(window, { start: d(2026, 8, 15), target: d(2026, 8, 15) });
		expect(inside.outside).toBe(false);
		expect(inside.milestone).toBe(true);
	});
});

describe('dependency arrow anchors', () => {
	const window = timelineWindow([], d(2026, 8, 15)); // Jul 1 … Sep 30

	it('anchors an ordinary span at its stated start and the day AFTER its stated end', () => {
		const anchor = dependencyAnchor(window, { start: d(2026, 8, 1), target: d(2026, 8, 10) }, { start: d(2026, 8, 15), target: d(2026, 8, 20) });
		expect(anchor).not.toBeNull();
		// startDay for Aug 1 is 31 (Jul has 31 days); the prerequisite's own bar is drawn
		// [31, 41), so its end anchor is the day AFTER its last day, 41 — not 40, which
		// would sit ON the last day rather than at its right edge.
		expect(anchor?.fromDay).toBe(41);
		expect(anchor?.toDay).toBe(45); // Aug 15's startDay
	});

	it('meets a milestone at its own date — its end equals its start, a point has no width', () => {
		const anchor = dependencyAnchor(window, { start: d(2026, 8, 10), target: d(2026, 8, 10) }, { start: d(2026, 8, 20), target: null });
		expect(anchor?.fromDay).toBe(barGeometry(window, { start: d(2026, 8, 10), target: d(2026, 8, 10) }).startDay);
	});

	it('anchors an open end at the right edge of the one-day bar its borrowed date draws', () => {
		// The prerequisite states only a start; barGeometry borrows it for both ends, so
		// the bar is one day wide — the SAME ordinary "start + span" formula that
		// anchors a full span already lands on that bar's own right edge, with no
		// special case needed for the end being open.
		const openEnd = barGeometry(window, { start: d(2026, 8, 1), target: null });
		expect(openEnd.spanDays).toBe(1);
		const anchor = dependencyAnchor(window, { start: d(2026, 8, 1), target: null }, { start: d(2026, 8, 20), target: null });
		expect(anchor?.fromDay).toBe(openEnd.startDay + openEnd.spanDays);
	});

	it('anchors a clipped end at the clipped edge, inside the grid', () => {
		const anchor = dependencyAnchor(window, { start: d(2026, 6, 1), target: d(2026, 12, 1) }, { start: d(2026, 8, 1), target: null });
		expect(anchor?.fromDay).toBe(window.days); // the far right edge, never past it
	});

	it('anchors nothing when either end lies wholly outside the window', () => {
		const far = d(2200, 1, 1);
		expect(dependencyAnchor(window, { start: far, target: far }, { start: d(2026, 8, 1), target: null })).toBeNull();
		expect(dependencyAnchor(window, { start: d(2026, 8, 1), target: null }, { start: far, target: far })).toBeNull();
	});
});

describe('earliest and latest', () => {
	const march = { year: 2026, month: 3, day: 1 };
	const june = { year: 2026, month: 6, day: 1 };

	it('takes whichever end exists when the other is absent', () => {
		expect(earliest(null, june)).toEqual(june);
		expect(earliest(march, null)).toEqual(march);
		expect(latest(null, june)).toEqual(june);
		expect(latest(march, null)).toEqual(march);
		expect(earliest(null, null)).toBeNull();
		expect(latest(null, null)).toBeNull();
	});

	it('orders by civil date, not by argument position', () => {
		expect(earliest(june, march)).toEqual(march);
		expect(earliest(march, june)).toEqual(march);
		expect(latest(june, march)).toEqual(june);
		expect(latest(march, june)).toEqual(june);
	});

	it('keeps the first argument when the two are the same day', () => {
		expect(earliest(march, { ...march })).toBe(march);
		expect(latest(march, { ...march })).toBe(march);
	});
});

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
		// Offsets stay inside the window this span produces (Jul–Sep 2026, 92 days): an
		// offset past `window.days - 1` names a date the window itself doesn't cover, so
		// barGeometry legitimately clamps it and the round trip can only be asked of a
		// day the window actually has.
		for (const scale of SCALES) {
			for (const offset of [0, 17, 60, window.days - 1]) {
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

describe('the weekend phase', () => {
	it('counts days to the first Saturday, zero when the window opens on one', () => {
		// timelineWindow([], 2026-08-15) starts 2026-07-01, a Wednesday; first Saturday is Jul 4.
		expect(weekendOffsetDays(timelineWindow([], d(2026, 8, 15)))).toBe(3);
		// timelineWindow([], 2026-09-15) starts 2026-08-01, itself a Saturday.
		expect(weekendOffsetDays(timelineWindow([], d(2026, 9, 15)))).toBe(0);
	});
});

describe('combining overlapping day ranges', () => {
	const span = (start: CivilDate, target: CivilDate): DateSpan => ({ start, target });
	const shown = (spans: Array<{ start: CivilDate; target: CivilDate }>): string[] =>
		spans.map((one) => `${formatCivil(one.start)}→${formatCivil(one.target)}`);

	it('leaves ranges that share no day alone, in date order', () => {
		expect(shown(mergeSpans([span(d(2026, 8, 10), d(2026, 8, 12)), span(d(2026, 8, 1), d(2026, 8, 3))]))).toEqual([
			'2026-08-01→2026-08-03',
			'2026-08-10→2026-08-12',
		]);
	});

	it('merges two that overlap into the range they cover together', () => {
		expect(shown(mergeSpans([span(d(2026, 8, 1), d(2026, 8, 5)), span(d(2026, 8, 4), d(2026, 8, 9))]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
	});

	it('merges two that merely touch, and two that are adjacent', () => {
		// Inclusive at both ends, `crossedAbsences`' own boundary rule: 1–5 and 5–9 share the
		// 5th. Adjacent ranges (1–5, 6–9) cover a continuous run of days and merge too — that
		// one changes no COUNT, only how many ranges come back.
		expect(shown(mergeSpans([span(d(2026, 8, 1), d(2026, 8, 5)), span(d(2026, 8, 5), d(2026, 8, 9))]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
		expect(shown(mergeSpans([span(d(2026, 8, 1), d(2026, 8, 5)), span(d(2026, 8, 6), d(2026, 8, 9))]))).toEqual([
			'2026-08-01→2026-08-09',
		]);
	});

	it('swallows a range wholly inside another', () => {
		expect(shown(mergeSpans([span(d(2026, 8, 1), d(2026, 8, 20)), span(d(2026, 8, 5), d(2026, 8, 6))]))).toEqual([
			'2026-08-01→2026-08-20',
		]);
	});

	it('borrows the stated end for a one-ended range, as the geometry does', () => {
		expect(shown(mergeSpans([{ start: null, target: d(2026, 8, 4) }]))).toEqual(['2026-08-04→2026-08-04']);
		expect(shown(mergeSpans([{ start: d(2026, 8, 4), target: null }]))).toEqual(['2026-08-04→2026-08-04']);
	});

	it('counts days inclusively, and counts a shared day once', () => {
		expect(unionDays([span(d(2026, 8, 1), d(2026, 8, 3))])).toBe(3);
		// 1–5 is five days and 4–9 is six; together they cover nine, not eleven. Counting the
		// sum instead is the defect this exists to prevent.
		expect(unionDays([span(d(2026, 8, 1), d(2026, 8, 5)), span(d(2026, 8, 4), d(2026, 8, 9))])).toBe(9);
		expect(unionDays([span(d(2026, 8, 1), d(2026, 8, 3)), span(d(2026, 8, 10), d(2026, 8, 12))])).toBe(6);
		expect(unionDays([])).toBe(0);
	});
});
