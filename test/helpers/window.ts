/**
 * Fixture dates for the timeline's drawn window.
 *
 * A LEAF: it imports `src/domain/` and nothing else in `test/`, so the browser harness's
 * own fixtures can use it without pulling vitest into the bundle.
 */
import { addDays, formatCivil, MAX_TIMELINE_DAYS } from '../../src/domain/timeline';
import { CivilDate, readDate, todayStamp } from '../../src/domain/noteFields';

/**
 * **The drawn window is a position relative to TODAY, so every fixture about its edges is
 * one too.** `timelineWindow` grows to hold each span it draws until the total exceeds
 * `MAX_TIMELINE_DAYS`, and then clamps to exactly that many days centred on today. So
 * "outside the window" is not a date — it is `today ± HALF_WINDOW`, and a literal that
 * satisfies it reads as safely outside on the day it is typed and stops doing so once the
 * clock arrives.
 *
 * That is not a hypothetical. A shifted-`Date` probe over the whole suite put eight tests
 * in six files on the wrong side of this: fixtures dated 2031 to 2033, which were beyond
 * the window in 2026 and inside it in 2029. Two OTHER tests had already failed for the
 * mirror-image reason on 2026-09-01, and `legend.test.ts` states the rule its own header
 * — this is that rule with one implementation instead of a copy per file.
 */
const PARSED_TODAY = readDate(todayStamp()).value;
if (PARSED_TODAY === null) throw new Error('todayStamp() did not parse as a date');
// Re-bound rather than narrowed in place: a module-level `if` narrows the statements after
// it, not the bodies of functions that could be called at any time.
const TODAY: CivilDate = PARSED_TODAY;

/** Half the clamp: once clamped, the grid runs `today - HALF_WINDOW` to `today + HALF_WINDOW`. */
export const HALF_WINDOW = Math.floor(MAX_TIMELINE_DAYS / 2);

/** A civil date `days` from today — negative for the past. The primitive the rest use. */
export function fromToday(days: number): string {
	return formatCivil(addDays(TODAY, days));
}

/**
 * A span too long for the grid to draw whole, so the window clamps around today — the
 * precondition every "outside the window" case needs, since the window otherwise simply
 * grows to fit whatever it is shown.
 */
export function clampingSpan(): { start: string; due: string } {
	return { start: fromToday(-MAX_TIMELINE_DAYS), due: fromToday(MAX_TIMELINE_DAYS) };
}

/** A date past the clamped window's FAR edge, by `days`. */
export const pastWindow = (days = 60): string => fromToday(HALF_WINDOW + days);

/** A date before the clamped window's NEAR edge, by `days`. */
export const beforeWindow = (days = 60): string => fromToday(-(HALF_WINDOW + days));

/**
 * A date past the far end of {@link clampingSpan} — outside the drawn window AND outside
 * every other span the fixture draws.
 *
 * Not the same question as {@link pastWindow}, and measured rather than assumed: a mark
 * sitting past the window's edge but still inside the long plan's own span draws as an
 * ordinary marker, so a fixture that wants the beyond-the-grid rendering has to clear the
 * PLAN, not just the window. Probed at four distances to find which side of that line each
 * falls.
 */
export const beyondPlan = (days = 365): string => fromToday(MAX_TIMELINE_DAYS + days);

