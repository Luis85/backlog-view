import { beforeEach, describe, expect, it } from 'vitest';
import { readmeMarker } from '../../src/domain/backlogReadme';
import { readmePath, writeBacklogReadme } from '../../src/storage/readmeFile';
import { FakeVault } from '../helpers/vault';

/**
 * The write is a refusal as much as a write: the two outcomes that put no bytes on
 * disk — an identical file, and a file this plugin did not author — are the ones a
 * team keeping the vault in git actually notices.
 */

const MARKER = readmeMarker('work/Backlog.base › Backlog');
const GENERATED = `${MARKER}\n\n# This folder is a product backlog\n`;

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
});

describe('readmePath', () => {
	it('lands in the folder, and at the vault root when there is none', () => {
		expect(readmePath('docs')).toBe('docs/README_PRODUCT_BACKLOG.md');
		expect(readmePath('/work/backlog/')).toBe('work/backlog/README_PRODUCT_BACKLOG.md');
		expect(readmePath('')).toBe('README_PRODUCT_BACKLOG.md');
	});
});

describe('writeBacklogReadme', () => {
	it('creates the file, and the folder it needs', async () => {
		const result = await writeBacklogReadme(vault.app as never, 'work/backlog', GENERATED);

		expect(result).toEqual({ outcome: 'created', path: 'work/backlog/README_PRODUCT_BACKLOG.md' });
		expect(vault.contents.get('work/backlog/README_PRODUCT_BACKLOG.md')).toBe(GENERATED);
		expect(vault.folders.has('work/backlog')).toBe(true);
	});

	it('creates the folder under the same spelling it writes the file under', async () => {
		// A hand-edited or Windows-shaped home folder: creating `work\backlog` and then
		// writing `work/backlog/README...` is a create whose parent does not exist.
		const result = await writeBacklogReadme(vault.app as never, 'work\\\\backlog//', GENERATED);

		expect(result).toEqual({ outcome: 'created', path: 'work/backlog/README_PRODUCT_BACKLOG.md' });
		expect([...vault.folders]).toContain('work/backlog');
		expect([...vault.folders].some((f) => f.includes('\\'))).toBe(false);
	});

	it('writes nothing when the file already matches', async () => {
		await writeBacklogReadme(vault.app as never, 'docs', GENERATED);
		const before = vault.contents.get('docs/README_PRODUCT_BACKLOG.md');

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result.outcome).toBe('unchanged');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(before);
	});

	it('replaces its own output when the configuration changed', async () => {
		await writeBacklogReadme(vault.app as never, 'docs', GENERATED);
		const updated = `${GENERATED}\n## Workflow states\n`;

		const result = await writeBacklogReadme(vault.app as never, 'docs', updated);

		expect(result.outcome).toBe('updated');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(updated);
	});

	it('refuses a readme another view of the same folder generated', async () => {
		// Two views may share a home folder and configure different keys. Replacing the
		// other one leaves the folder documenting keys half its readers do not use.
		const theirs = `${readmeMarker('other/Other.base › Board')}\n\n# This folder is a product backlog\n`;
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', theirs);

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result.outcome).toBe('otherView');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(theirs);
	});

	it('refuses a file of the same name that it did not write', async () => {
		const theirs = '# My own notes about this folder\n';
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', theirs);

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result.outcome).toBe('foreign');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(theirs);
	});
});
