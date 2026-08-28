// The release membership at the write boundary, beside `applyLinks`'s own file for the
// identical reason it exists: a link is spelled from the editing note's own path
// (`wikilinkTo`), never from a basename, or two same-named release notes would be
// indistinguishable on disk.
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { settingsWith } from '../helpers/settings';

describe('writing a release membership', () => {
	it('spells the value as a link resolved from the editing note', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release }]);
		// A LINK, not a bare string built by hand: `wikilinkTo` goes through Obsidian's own
		// `fileToLinktext`, which is what the basename-collision test below actually exercises.
		expect(vault.fm('F.md').release).toBe('[[2.4]]');
	});

	it('DELETES the key rather than blanking it', async () => {
		const vault = new FakeVault();
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release: null }]);
		expect('release' in vault.fm('F.md')).toBe(false);
	});

	it('writes nothing when the key is unbound', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		await applyWrites(vault.app, settingsWith({ releaseKey: '' }), [{ file: feature, release }]);
		// The whole note, not just the absence of a `release` key: an unconfigured key is
		// `''`, and `setOwn(fm, '', …)` would add that as a real key nobody named — a hole
		// the narrower assertion above cannot see.
		expect(vault.fm('F.md')).toEqual({ type: 'Feature' });
	});

	it('is undoable as one batch', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		const settings = settingsWith({ releaseKey: 'release' });
		const inverses: RestoreWrite[] = [];
		await applyWrites(vault.app, settings, [{ file: feature, release }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('F.md').release).toBe('[[2.4]]');

		await applyRestores(vault.app, inverses);
		expect('release' in vault.fm('F.md')).toBe(false);
	});

	// PBI acceptance criterion: "Two releases whose notes share a basename are
	// distinguishable in the picker and resolve to the file that was picked." The picker
	// half is a menu concern (Task 6); this is the write half, and it is checked by
	// RESOLVING the written link through the vault's own link resolution — a bare
	// `[[2.4]]` would string-match neither fixture path and still be wrong, which a test
	// comparing the written string to the target's path alone could not catch.
	it('resolves to the release that was picked, not the same-named one', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Archive/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const picked = vault.files.get('Archive/2.4.md')!;

		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release: picked }]);

		const written = vault.fm('F.md').release as string;
		const linkpath = written.slice(2, -2); // strip [[ ]]
		const resolved = vault.app.metadataCache.getFirstLinkpathDest(linkpath, 'F.md');
		expect(resolved).toBe(picked);
	});
});
