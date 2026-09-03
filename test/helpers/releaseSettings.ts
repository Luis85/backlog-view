import { ReleaseSettings } from '../../src/domain/releaseOptions';

/**
 * A `ReleaseSettings` object built directly, every optional key off by default — for
 * tests over `createRelease` and anything else that takes the resolved settings shape
 * rather than a `BasesViewConfig` to resolve it from (`resolveReleaseSettings` only
 * builds one FROM a config, and a creator test wants the shape itself). An override per
 * field, so a test binding one key asserts about that key alone.
 *
 * Its own leaf module, not folded into `test/helpers/release.ts`: that file imports
 * `ReleaseView` and calls `installObsidianDom()` at module top, so anything importing it
 * needs jsdom. This builder touches no DOM, and a `test/storage/` test importing it
 * should stay on that directory's `node` default rather than picking up jsdom by
 * accident of where the fixture happened to live.
 */
export function releaseSettingsWith(overrides: Partial<ReleaseSettings> = {}): ReleaseSettings {
	return {
		parentKey: '',
		orderKey: '',
		typeKey: 'type',
		membershipKey: '',
		versionKey: '',
		targetDateKey: '',
		statusKey: '',
		// EVERY field, and the four below were missing until 2026-08-29 — nothing then
		// checked this literal against the shape it claims to return, so a field added to
		// `ReleaseSettings` arrived here as `undefined` rather than as a build error. That
		// is not cosmetic: `createRelease`'s "two release properties name one key" guard
		// collects its keys and filters `!== ''`, so two `undefined`s read as one key
		// spoken twice and every creation threw. `npm run typecheck:test` is what checks it
		// now: a field added to `ReleaseSettings` fails the gate here until it is added.
		releasedDateKey: '',
		descriptionKey: '',
		// Five more added 2026-09-02 with the readiness criteria — same by-hand rule, and
		// each unconfigured: absence is a value here too.
		estimateKey: '',
		// The capacity figure, added with `Capacity against commitment`'s Task 1 — same
		// by-hand rule as the others above: unconfigured, since absence is a value here too.
		capacityKey: '',
		// Its unit, added with Task 3 — same rule, same reason: unconfigured by default.
		capacityUnit: '',
		dependsOnKey: '',
		riskKey: '',
		criticalRiskValues: [],
		addressedRiskValues: [],
		statusValues: [],
		// Three more added 2026-08-29 with the closing actions (Task 1 of [[Closing a
		// release]]) — the same by-hand rule stated above, now paid a second time.
		releasedValues: [],
		releasedTransition: '',
		notesFolder: '',
		openIn: 'split',
		folder: '',
		...overrides,
	};
}
