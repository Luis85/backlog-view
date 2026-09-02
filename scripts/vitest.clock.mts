/**
 * `npm run clock` — the whole suite with `Date` shifted, for finding fixtures whose premise
 * is a position relative to today and whose spelling is a fixed calendar date.
 *
 * Not a gate and not part of `npm run check`: it reports, the way `npm run perf` does. What
 * it is for is the class of defect a green suite cannot see — a test that passes today and
 * fails on a date nobody chose. Paths resolve from the WORKING DIRECTORY, like every other
 * script here, so this config sits beside the script that names it rather than at the root.
 */
import { mergeConfig } from 'vitest/config';
import base from '../vitest.config.mts';

export default mergeConfig(base, {
	test: { setupFiles: ['./test/helpers/locale.ts', './test/helpers/shiftClock.ts'] },
});
