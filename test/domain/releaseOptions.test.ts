import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions, resolveReleaseSettings } from '../../src/domain/releaseOptions';
import { FakeViewConfig } from '../helpers/vault';

function keysOf(config: FakeViewConfig): string[] {
	return getReleaseViewOptions(config as never)
		.flatMap((group) => ('items' in group ? group.items : []))
		.map((item) => (item as { key: string }).key);
}

describe('the release view names its own keys', () => {
	it('declares all eight, the three model mappings and the folder included', () => {
		expect(keysOf(new FakeViewConfig({})).sort()).toEqual(
			[
				'membershipProperty',
				'orderProperty',
				'parentProperty',
				'releaseFolder',
				'releaseStatusProperty',
				'targetDateProperty',
				'typeProperty',
				'versionProperty',
			].sort(),
		);
	});

	it('resolves each key, and leaves an unconfigured one empty', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({ typeProperty: 'note.kind' }) as never);
		expect(settings.typeKey).toBe('kind');
		expect(settings.membershipKey).toBe('');
		expect(settings.versionKey).toBe('');
	});

	it('defaults the three model mappings the way the backlog view does', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(settings.typeKey).toBe('type');
		expect(settings.parentKey).toBe('parent');
		expect(settings.orderKey).toBe('order');
	});

	it('tells a CLEARED mapping from one never set', () => {
		// The whole "No type property is mapped" state depends on this, and `propKey`
		// cannot express it — it hands back the default for both.
		const cleared = resolveReleaseSettings(new FakeViewConfig({ typeProperty: '' }) as never);
		expect(cleared.typeKey).toBe('');
		const untouched = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(untouched.typeKey).toBe('type');
	});

	it('files a new release under docs/releases when nothing says otherwise', () => {
		// The value is DATA — where a note lands, not text anybody reads. It tracks
		// `defaultTypeFolder('Release')` rather than a literal so the two cannot drift.
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).folder).toBe('docs/releases');
	});

	it('reads a picked release folder the way every other folder option is read', () => {
		// Trimmed, stripped of leading/trailing separators and normalized — `vaultFolder`,
		// the same reading `resolveFolders` gives every type folder.
		expect(resolveReleaseSettings(new FakeViewConfig({ releaseFolder: '/Releases/' }) as never).folder).toBe(
			'Releases',
		);
	});

	it('tells a cleared version property from an untouched one', () => {
		// The whole of the dialog's field rule rests on this distinction: unset means
		// "not configured yet" and gets bound, cleared means "not wanted" and is left
		// alone. `propKey` answers '' to both and cannot express it. This test pins
		// today's OUTPUT while the mechanism changes underneath — the distinction it
		// enables is asserted where it is CONSUMED, in later tasks.
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).versionKey).toBe('');
		expect(resolveReleaseSettings(new FakeViewConfig({ versionProperty: '' }) as never).versionKey).toBe('');
		expect(resolveReleaseSettings(new FakeViewConfig({ versionProperty: 'note.v' }) as never).versionKey).toBe('v');
	});
});
