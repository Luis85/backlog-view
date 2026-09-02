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
import { beforeEach } from 'vitest';

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

function installShift(): void {
	globalThis.Date = Shifted as unknown as DateConstructor;
}

installShift();

/**
 * Re-installed before EVERY test, not once when this file is evaluated — and that is a
 * correction rather than belt-and-braces. A test that pins with a bare `vi.setSystemTime`
 * replaces `Date` for good: the harness's `vi.useRealTimers()` does not put the shift back,
 * so every test after it in that file ran at the pinned 2026 date while `npm run clock`
 * reported a clean whole-suite probe. Measured in both directions — after a bare pin the
 * next test read 2026-08-05 rather than the shifted date, and reads the shifted date now.
 *
 * A file-local `beforeEach` still wins, being registered later and so running after this
 * one, which is what lets a test that MEANS to pin its clock still do so. (Codex, PR #243.)
 */
beforeEach(installShift);
