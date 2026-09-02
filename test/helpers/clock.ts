import { beforeEach, vi } from 'vitest';
import { FROZEN_TODAY } from './frozenDay';

/**
 * One frozen day for the whole suite.
 *
 * `todayCivil()` is read in the view (`render/projections.ts`) and injected into the
 * domain, so every dated projection draws its window around the real clock — and a fixture
 * with fixed dates therefore draws a different window on every day it is run. Four tests
 * were asserting pixels derived from the distance between today and their August fixtures:
 * two went red overnight on 2026-09-01, having passed in CI the day before with nothing
 * changed between the two runs, and the other two go red on any day except the one they
 * were written on. A suite whose result depends on when it runs is not a check.
 *
 * **Frozen at TOP LEVEL, not only in the hook.** A setup file runs before the test module
 * is imported, and `roadmapFrame`/`roadmapMarkers` compute their `TODAY_ISO` at module
 * scope. Deferred to `beforeEach` alone, the fixture would name the real day while the
 * render drew the frozen one — the same defect this file exists to remove, wearing
 * different clothes. The hook is the second half: several suites call `vi.useRealTimers()`
 * of their own, and the test after one of those must not inherit the real clock.
 *
 * **Only `Date` is faked.** Nothing in `src/` reads a time finer than a date, and faking
 * the timers wholesale would strand every test that awaits a real one.
 *
 * **The ZONE is pinned beside the instant, and it has to be.** Freezing the instant does
 * not freeze the civil date, which is the thing those four tests actually read: `dateStamp`
 * (`src/domain/noteFields.ts`) reads `getFullYear`/`getMonth`/`getDate`, all LOCAL, so at
 * UTC+13/UTC+14 — Pacific/Auckland in DST, Pacific/Kiritimati — a midday-UTC instant on the
 * 31st is already the 1st, and the freeze produced the very mismatch it exists to remove.
 * CI runs UTC, so nothing was red there; a contributor in NZ would have met it alone. This
 * repository has shipped a defect only one PLATFORM could see, and this is the same shape
 * one axis over.
 *
 * Assigned BEFORE the freeze, and before anything constructs a `Date`: Node re-reads
 * `process.env.TZ` on the next `Date` operation, so the order is what makes it hold.
 *
 * The day itself is the last one this suite passed CI on, and it is arbitrary in every
 * other respect. Move it and the four tests above must be re-derived, which is the cost
 * that made it worth pinning rather than following the clock.
 *
 * **`PBL_SHIFT_DAYS` moves the frozen day, and that is all `npm run clock` is.** It prices
 * exactly the cost named in the paragraph above — how many tests a move of the pin would
 * make re-derivable — rather than hunting a live defect, because a frozen suite cannot have
 * one: today does not arrive. The knob lives HERE rather than in a second setup file that
 * shifts the real clock, which is what it was until 2026-09-02. That spelling worked only
 * by accident: `mergeConfig` APPENDS `setupFiles` rather than replacing them, so the freeze
 * was installed first and the shifter captured the FAKE `Date` as its own `REAL` — the
 * probe was measuring the frozen day plus the shift while its config, its own docstring and
 * the register all said it was measuring the real one. Two mechanisms, one of them relying
 * on an undocumented merge order, for a number one constant produces.
 *
 * The constant itself is in `frozenDay.ts`, which does nothing — see there for why the
 * check under this file cannot read it from here.
 */
process.env.TZ = 'UTC';

vi.useFakeTimers({ toFake: ['Date'], now: FROZEN_TODAY });
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'], now: FROZEN_TODAY });
});
