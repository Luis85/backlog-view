// @vitest-environment jsdom
// `createRelease`'s own creation test, beside `createNote.test.ts` rather than inside it:
// a release is not a backlog item and takes no `NewItemSpec` — see `createNote.ts`'s own
// doc comment on why it stands apart from `createBacklogItem` and `createResourceNote`.
//
// jsdom, not the directory default (`node`): `releaseSettingsWith` now lives in
// `test/helpers/release.ts`, which imports `ReleaseView` and calls `installObsidianDom()`
// at module top — the same reason `baseFile.test.ts` and the `viewState*` tests in this
// directory carry the same pragma.
import { describe, expect, it } from 'vitest';
import { createRelease } from '../../src/storage/createNote';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/release';

describe('createRelease', () => {
	it('creates one release note in the configured folder', async () => {
		const vault = new FakeVault();
		const file = await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases', versionKey: 'v' }), {
			title: '2.4',
			version: '2.4.0',
		});
		expect(file.path).toBe('Releases/2.4.md');
		expect(vault.fm('Releases/2.4.md')).toEqual({ type: 'Release', v: '2.4.0' });
	});

	it('writes no key the view has not bound', async () => {
		// Absence is a value. A cleared version property means this vault does not
		// track versions, and the note must not carry an empty one — checked against
		// the WHOLE frontmatter object, not just the bound name from the previous test:
		// a guard dropped in favour of a hardcoded fallback key (`'version'`, say) or an
		// empty-string key would both still leave `'v' in fm` false, so only asserting
		// the note carries nothing beyond `type` catches either.
		const vault = new FakeVault();
		await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases', versionKey: '' }), {
			title: '2.4',
			version: '2.4.0',
		});
		expect(vault.fm('Releases/2.4.md')).toEqual({ type: 'Release' });
	});

	it('writes target date and status alongside version when all three are bound', async () => {
		const vault = new FakeVault();
		await createRelease(
			vault.app,
			releaseSettingsWith({ folder: 'Releases', versionKey: 'v', targetDateKey: 'target-date', statusKey: 'status' }),
			{ title: '2.4', version: '2.4.0', targetDate: '2026-09-12', status: 'Planned' },
		);
		expect(vault.fm('Releases/2.4.md')).toEqual({
			type: 'Release',
			v: '2.4.0',
			'target-date': '2026-09-12',
			status: 'Planned',
		});
	});

	it('seeds no parent, no order and no placement', async () => {
		// A release is a marker: no rung, no children, hangs from nothing. The
		// standing rule at `createBacklogItem` is that a Release is seeded NOTHING a
		// surface adds; this asserts it of the note rather than trusting the comment.
		const vault = new FakeVault();
		await createRelease(vault.app, releaseSettingsWith({ folder: 'Releases' }), { title: '2.4' });
		expect(Object.keys(vault.fm('Releases/2.4.md'))).toEqual(['type']);
	});

	it('refuses to create when no type key is configured', async () => {
		// `typeKey` is the one field of the four `createRelease` writes that this settings
		// bag can genuinely clear (`clearablePropKey` in `resolveReleaseSettings`, unlike
		// `createBacklogItem`'s and `createResourceNote`'s always-bound `typeKey`). A
		// release with no type key is not a release anything downstream will recognise —
		// `isReleaseType` and `membershipTarget` both key off it — so this refuses rather
		// than writing a note under an empty-string key.
		const vault = new FakeVault();
		await expect(
			createRelease(vault.app, releaseSettingsWith({ folder: 'Releases', typeKey: '' }), { title: '2.4' }),
		).rejects.toThrow();
		expect(vault.files.has('Releases/2.4.md')).toBe(false);
	});
});
