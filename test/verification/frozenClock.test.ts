import { describe, expect, it } from 'vitest';
import { todayStamp } from '../../src/domain/noteFields';

/**
 * The check under `test/helpers/clock.ts`.
 *
 * Every other test in this suite reads the clock only through what it renders, so dropping
 * the `setupFiles` entry would not fail any of them TODAY — it would fail some of them on
 * a day nobody has reached yet, which is the whole defect the freeze exists to remove and
 * the one shape a per-test assertion cannot catch. Asked at the clock itself instead, so
 * it holds for tests not yet written.
 *
 * Asked as a CIVIL date rather than as an instant, which is the correction of the first
 * round: `dateStamp` reads the local components, so `toISOString()` agreeing proves nothing
 * a contributor east of UTC+12 would recognise — this file passed under `TZ=Pacific/Auckland`
 * while the two tests it stands for failed. The check now names the day the view would name.
 *
 * The reachable date matters as much as the frozen one: `Date` is faked and the timers are
 * not, so a test that awaits a real `setTimeout` still resolves.
 */
describe('the suite runs on one frozen day', () => {
	it('reads the same civil date whenever and wherever it runs', () => {
		const now = new Date();
		expect([now.getFullYear(), now.getMonth() + 1, now.getDate()]).toEqual([2026, 8, 31]);
		expect(todayStamp()).toBe('2026-08-31');
	});

	it('leaves the timers real, so an await still resolves', async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		expect(todayStamp()).toBe('2026-08-31');
	});
});
