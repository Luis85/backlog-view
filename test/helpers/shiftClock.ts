/**
 * Shifts `Date` by `PBL_SHIFT_DAYS`, for `npm run clock`.
 *
 * A setup file rather than a per-test `vi.setSystemTime`, because the question it answers is
 * about the WHOLE suite: which fixtures state a position relative to today (inside the drawn
 * window, beyond it, near-term) as a fixed calendar date, and so stop meaning what they say
 * once the clock arrives. Two tests had already failed that way on 2026-09-01 before anyone
 * thought to ask the question of the rest.
 *
 * Only `Date` is replaced, and only its no-argument construction and `now()` move: a fixture
 * that names an explicit date still gets exactly that date, which is the whole point — the
 * fixture stays put while today moves under it.
 */
const DAYS = Number(process.env.PBL_SHIFT_DAYS ?? '0');
const DELTA = DAYS * 86_400_000;
const REAL = Date;

class Shifted extends REAL {
	constructor(...args: unknown[]) {
		if (args.length === 0) super(REAL.now() + DELTA);
		else super(...(args as [number]));
	}

	static override now(): number {
		return REAL.now() + DELTA;
	}
}

globalThis.Date = Shifted as unknown as DateConstructor;
