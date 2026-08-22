import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { defaultResourceFolder } from '../../src/domain/typeVocabulary';

/**
 * `resourceFolder` — a `Resource` note's own folder, in a file of its own rather than
 * `settings.test.ts` (already near the `test/**` line budget): the shipped default, that
 * it follows a changed home folder, that a picked value is normalised through
 * `vaultFolder`, and that clearing it resolves to '' rather than back to the default.
 */

/** Stand-in for BasesViewConfig backed by a plain object, matching settings.test.ts's own. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return {
		get: (key: string) => values[key],
		getAsPropertyId: () => null,
	} as never;
}

describe('defaultResourceFolder', () => {
	it('files under the given home folder, defaulting to the shipped one', () => {
		expect(defaultResourceFolder()).toBe('docs/resources');
		expect(defaultResourceFolder('work')).toBe('work/resources');
	});

	it('is the bare subfolder name when there is no home folder at all', () => {
		expect(defaultResourceFolder('')).toBe('resources');
	});
});

describe('resolveSettings resourceFolder', () => {
	it('ships the same default defaultSettings does', () => {
		expect(defaultSettings().resourceFolder).toBe('docs/resources');
		expect(resolveSettings(fakeConfig()).resourceFolder).toBe(defaultResourceFolder());
	});

	it('follows a changed home folder, like every type folder does', () => {
		expect(resolveSettings(fakeConfig({ homeFolder: 'Roadmap' })).resourceFolder).toBe('Roadmap/resources');
	});

	it('normalises a hand-edited value the way every other folder setting does', () => {
		expect(resolveSettings(fakeConfig({ resourceFolder: 'work//people//resources/' })).resourceFolder).toBe(
			'work/people/resources',
		);
	});

	it('resolves a cleared option to no folder of its own, not back to the default', () => {
		// `config.get` reports "never set" and "cleared" identically, so this is what
		// `clearable` exists to prove: an empty string in the `.base` must stay empty
		// rather than silently reverting to `docs/resources`.
		expect(resolveSettings(fakeConfig({ resourceFolder: '' })).resourceFolder).toBe('');
	});
});
