import { describe, expect, it } from 'vitest';
import { todayCivil, todayStamp } from '../../src/domain/noteFields';
import { FROZEN_TODAY } from '../helpers/frozenDay';

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
 *
 * **Expected against `FROZEN_TODAY` rather than against a spelled-out `2026-08-31`, and
 * that is not a tautology — but the first version of it was.** What the literal bought was a
 * second copy of the day, which went red under `npm run clock` for no reason but its own
 * spelling: three of the sixty-nine failures that probe reported on 2026-09-02 were this
 * file objecting to the shift it exists to make possible. Deriving it from `clock.ts`
 * instead left this file GREEN with the `setupFiles` entry deleted — the import installed
 * the freeze at module scope, so the check brought its own subject. Watched failing in that
 * direction, which is what found it. The constant comes from `frozenDay.ts`, which does
 * nothing at all, so deleting the setup entry leaves these three reading the real clock.
 */
describe('the suite runs on one frozen day', () => {
	/** The frozen day in UTC — not through a local getter, which is the thing under test. */
	const frozenUtcDay = FROZEN_TODAY.toISOString().slice(0, 10);

	it('reads the same date whenever it runs', () => {
		expect(new Date().toISOString()).toBe(FROZEN_TODAY.toISOString());
		expect(Date.now()).toBe(FROZEN_TODAY.getTime());
	});

	it('reads the same CIVIL date whenever it runs, in whatever zone', () => {
		// Not `new Date().toISOString()`: that is the instant, and the instant was never the
		// problem. Every dated projection reads `todayCivil()`, which goes through local
		// getters — so this is the assertion that fails in UTC+14 without a pinned zone. The
		// expectation is the UTC day, so the two sides disagree exactly when the zone drifts.
		//
		// **In UTC it passes for the wrong reason, and nothing in-process can fix that.** A
		// host already in UTC satisfies it whether or not the helper pinned anything, and
		// `expect(process.env.TZ).toBe('UTC')` is the same tautology one level down — both
		// were tried and both stayed green with the pin deleted. What guards the pin is the
		// `zone` job in `.github/workflows/ci.yml`, which runs this suite under
		// `TZ=Pacific/Kiritimati`: there, and only there, deleting the pin turns this red.
		expect(todayStamp()).toBe(frozenUtcDay);
		const [year, month, day] = frozenUtcDay.split('-').map(Number);
		expect(todayCivil()).toEqual({ year, month, day });
	});

	it('leaves the timers real, so an await still resolves', async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		expect(new Date().toISOString()).toBe(FROZEN_TODAY.toISOString());
	});
});
