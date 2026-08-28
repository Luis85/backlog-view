import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions, resolveReleaseSettings } from '../../src/domain/releaseOptions';
import { FakeViewConfig } from '../helpers/vault';

function keysOf(config: FakeViewConfig): string[] {
	return getReleaseViewOptions(config as never)
		.flatMap((group) => ('items' in group ? group.items : []))
		.map((item) => (item as { key: string }).key);
}

describe('the release view names its own keys', () => {
	it('declares all twelve, the three model mappings, the folder and its own open target', () => {
		expect(keysOf(new FakeViewConfig({})).sort()).toEqual(
			[
				'doneValues',
				'membershipProperty',
				'openIn',
				'orderProperty',
				'parentProperty',
				'releasedDateProperty',
				'releaseFolder',
				'releaseStatusProperty',
				'stateProperty',
				'targetDateProperty',
				'typeProperty',
				'versionProperty',
			].sort(),
		);
	});

	it('carries a default on its open-target dropdown, or an unset pick would open nothing', () => {
		const openIn = getReleaseViewOptions(new FakeViewConfig({}) as never)
			.flatMap((group) => ('items' in group ? group.items : []))
			.find((item) => (item as { key: string }).key === 'openIn') as { default?: unknown } | undefined;
		expect(openIn?.default).toBe('split');
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

	it('resolves its own open target, defaulting to split like the estimation view', () => {
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).openIn).toBe('split');
		expect(resolveReleaseSettings(new FakeViewConfig({ openIn: 'tab' }) as never).openIn).toBe('tab');
	});

	it('resolves the released date key, and leaves it empty when unbound', () => {
		// `propKey`, not `clearablePropKey`: the default is '' so the two resolve the same
		// value for every input, exactly as `versionKey` and the other release-own keys do.
		expect(
			resolveReleaseSettings(new FakeViewConfig({ releasedDateProperty: 'note.released' }) as never).releasedDateKey,
		).toBe('released');
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).releasedDateKey).toBe('');
	});
});
