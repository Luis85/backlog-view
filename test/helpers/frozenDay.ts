/**
 * The day the suite is frozen on — the constant alone, with no `vi` call under it.
 *
 * A file of its own for one reason, and it was measured rather than reasoned: `clock.ts`
 * freezes at MODULE scope, so a test importing the constant from there installs the freeze
 * by importing it, and `test/verification/frozenClock.test.ts` stayed GREEN with the
 * `setupFiles` entry deleted. That test's whole job is to go red in exactly that case. A
 * constant that cannot be read without being applied is not a constant the check can be
 * written against.
 *
 * So: this module imports nothing and does nothing. `clock.ts` applies it; the check reads
 * it. Every other test should keep reading the clock through what it renders.
 *
 * **`PBL_SHIFT_DAYS` moves the day, and that is the whole of `npm run clock`** — see
 * `clock.ts` for what the probe prices and why it is one mechanism rather than two.
 */

/** Midday UTC, so no local zone can put the civil date on a neighbouring day by itself. */
const PINNED = '2026-08-31T12:00:00.000Z';

/** The pinned instant, shifted by `PBL_SHIFT_DAYS` — 0, and so 2026-08-31, under `npm run check`. */
export const FROZEN_TODAY = new Date(Date.parse(PINNED) + Number(process.env.PBL_SHIFT_DAYS ?? '0') * 86_400_000);
