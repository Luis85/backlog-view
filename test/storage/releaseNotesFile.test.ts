import { beforeEach, describe, expect, it } from 'vitest';
import { joinSource, readmeMarker } from '../../src/domain/readmeMarker';
import { releaseNotesPath, writeReleaseNotes } from '../../src/storage/releaseNotesFile';
import { FakeVault } from '../helpers/vault';

const MINE = readmeMarker(joinSource('P.base', 'Releases', '0.9'));
const THEIRS = readmeMarker(joinSource('P.base', 'Releases', '1.0'));
const GENERATED = `${MINE}\n\n# 0.9\n`;

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
});

describe('releaseNotesPath', () => {
	it('names the file for the release, in the folder, and at the vault root without one', () => {
		expect(releaseNotesPath('notes', '0.9')).toBe('notes/0.9 release notes.md');
		expect(releaseNotesPath('/work/notes/', '0.9')).toBe('work/notes/0.9 release notes.md');
		expect(releaseNotesPath('', '0.9')).toBe('0.9 release notes.md');
	});

	it('never lands on the release note itself, even pointed at the releases folder', () => {
		// The suffix is what stops a whole-file write over a release note — which would be
		// refused forever rather than fixed, since a release note carries no marker.
		expect(releaseNotesPath('Releases', '0.9')).not.toBe('Releases/0.9.md');
	});
});

describe('writeReleaseNotes', () => {
	it('creates the file and the folder it needs', async () => {
		const result = await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);

		expect(result).toEqual({ outcome: 'created', path: 'notes/0.9 release notes.md' });
		expect(vault.folders.has('notes')).toBe(true);
	});

	it('regenerates its own file', async () => {
		await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);
		const result = await writeReleaseNotes(vault.app, 'notes', '0.9', `${GENERATED}\n## Scope\n`);

		expect(result).toEqual({ outcome: 'updated', path: 'notes/0.9 release notes.md' });
	});

	it('refuses ANOTHER release’s generated file rather than replacing it', async () => {
		// Where the README differs on purpose: it replaces a document another view owns,
		// because a renamed base leaves one behind and regenerating is the repair. A whole
		// file written over another release's notes is in no undo slot at all.
		await vault.app.vault.create('notes/0.9 release notes.md', `${THEIRS}\ntheirs\n`);
		const result = await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);

		expect(result).toEqual({
			outcome: 'foreign',
			path: 'notes/0.9 release notes.md',
			previous: joinSource('P.base', 'Releases', '1.0'),
		});
		expect(vault.contents.get('notes/0.9 release notes.md')).toContain('theirs');
	});

	it('refuses a file that becomes another release’s between the read and the write', async () => {
		// Sync lands another release's generated file at this path AFTER the read. A
		// callback that only asks "does this parse as a marker" would overwrite the very
		// file the refuse mode exists to protect.
		await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);
		const theirs = `${THEIRS}\ntheirs\n`;
		const process = vault.app.vault.process;
		vault.app.vault.process = (async (f: never, fn: (data: string) => string) => {
			vault.contents.set('notes/0.9 release notes.md', theirs);
			return process(f, fn);
		}) as typeof vault.app.vault.process;

		const result = await writeReleaseNotes(vault.app, 'notes', '0.9', `${GENERATED}\n## Scope\n`);

		expect(result.outcome).toBe('foreign');
		expect(vault.contents.get('notes/0.9 release notes.md')).toBe(theirs);
	});

	it('leaves an identical file untouched', async () => {
		await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);
		const result = await writeReleaseNotes(vault.app, 'notes', '0.9', GENERATED);

		expect(result).toEqual({ outcome: 'unchanged', path: 'notes/0.9 release notes.md' });
	});
});
