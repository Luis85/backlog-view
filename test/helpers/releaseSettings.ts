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
		folder: '',
		...overrides,
	};
}
