import { describe, expect, it } from 'vitest';

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
 */
describe('the suite runs on one frozen day', () => {
	it('reads the same date whenever it runs', () => {
		expect(new Date().toISOString()).toBe('2026-08-31T12:00:00.000Z');
		expect(Date.now()).toBe(Date.parse('2026-08-31T12:00:00.000Z'));
	});

	it('leaves the timers real, so an await still resolves', async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		expect(new Date().toISOString()).toBe('2026-08-31T12:00:00.000Z');
	});
});
