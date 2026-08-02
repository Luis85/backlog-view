import { describe, expect, it } from 'vitest';
import { CivilDate } from '../../src/domain/noteFields';
import {
	barGeometry,
	daysBetween,
	formatCivil,
	MAX_TIMELINE_MONTHS,
	timelineWindow,
} from '../../src/domain/timeline';

const d = (year: number, month: number, day: number): CivilDate => ({ year, month, day });

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
		expect(window.months.map((m) => m.label)).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026']);
		expect(window.days).toBe(31 + 31 + 30);
	});

	it('spans every placed date and today, padded a month each side', () => {
		const spans = [
			{ start: d(2026, 5, 20), target: d(2026, 6, 2) },
			{ start: null, target: d(2026, 11, 30) },
		];
		const window = timelineWindow(spans, d(2026, 8, 15));

		expect(window.months[0].label).toBe('Apr 2026');
		expect(window.months[window.months.length - 1].label).toBe('Dec 2026');
	});

	it('knows a leap February from a plain one', () => {
		const window = timelineWindow([], d(2028, 2, 10));
		const february = window.months.find((m) => m.label === 'Feb 2028');
		expect(february?.days).toBe(29);
	});

	it('clamps a runaway year to the bounded grid, keeping today inside', () => {
		const spans = [{ start: d(2026, 8, 1), target: d(9999, 1, 1) }];
		const window = timelineWindow(spans, d(2026, 8, 15));

		expect(window.months.length).toBe(MAX_TIMELINE_MONTHS);
		const labels = window.months.map((m) => m.label);
		expect(labels).toContain('Aug 2026');
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
});
