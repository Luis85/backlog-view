import { describe, expect, it } from 'vitest';
import { todayCivil, todayStamp } from '../../src/domain/noteFields';

/**
 * The check under `test/helpers/clock.ts`.
 *
 * Every other test in this suite reads the clock only through what it renders, so dropping
 * the `setupFiles` entry would not fail any of them TODAY — it would fail some of them on
 * a day nobody has reached yet, which is the whole defect the freeze exists to remove and
 * the one shape a per-test assertion cannot catch. Asked at the clock itself instead, so
 * it holds for tests not yet written.
 *
 * The reachable date matters as much as the frozen one: `Date` is faked and the timers are
 * not, so a test that awaits a real `setTimeout` still resolves.
 *
 * **The CIVIL date is the one the four tests actually read**, and freezing the instant does
 * not freeze it. `dateStamp` reads `getFullYear`/`getMonth`/`getDate`, which are LOCAL, so
 * at UTC+13/UTC+14 — Pacific/Auckland in DST, Pacific/Kiritimati — a midday-UTC instant on
 * the 31st is already the 1st. The zone is pinned beside the instant for that reason, and
 * the assertion below goes through `todayStamp`/`todayCivil` rather than a hand-rolled
 * getter, so it is the reader the plugin uses that is held to the frozen day.
 */
describe('the suite runs on one frozen day', () => {
	it('reads the same date whenever it runs', () => {
		expect(new Date().toISOString()).toBe('2026-08-31T12:00:00.000Z');
		expect(Date.now()).toBe(Date.parse('2026-08-31T12:00:00.000Z'));
	});

	it('reads the same CIVIL date whenever it runs, in whatever zone', () => {
		// Not `new Date().toISOString()`: that is the instant, and the instant was never the
		// problem. Every dated projection reads `todayCivil()`, which goes through local
		// getters — so this is the assertion that fails in UTC+14 without a pinned zone.
		//
		// **In UTC it passes for the wrong reason, and nothing in-process can fix that.** A
		// host already in UTC satisfies it whether or not the helper pinned anything, and
		// `expect(process.env.TZ).toBe('UTC')` is the same tautology one level down — both
		// were tried and both stayed green with the pin deleted. What guards the pin is the
		// `zone` job in `.github/workflows/ci.yml`, which runs this suite under
		// `TZ=Pacific/Kiritimati`: there, and only there, deleting the pin turns this red.
		expect(todayStamp()).toBe('2026-08-31');
		expect(todayCivil()).toEqual({ year: 2026, month: 8, day: 31 });
	});

	it('leaves the timers real, so an await still resolves', async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		expect(new Date().toISOString()).toBe('2026-08-31T12:00:00.000Z');
	});
});
