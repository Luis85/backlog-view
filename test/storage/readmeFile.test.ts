import { beforeEach, describe, expect, it } from 'vitest';
import { readmeMarker, README_MARKER_PREFIX } from '../../src/domain/readmeMarker';
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

	it('replaces another view s readme and reports whose it was', async () => {
		// Two views may share a home folder and configure different keys. The folder holds
		// one contract at a time, so the write goes through and the caller is told — the
		// alternative, refusing, cannot tell this apart from an ordinary rename.
		const theirs = `${readmeMarker('other/Other.base › Board')}\n\n# This folder is a product backlog\n`;
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', theirs);

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result).toEqual({
			outcome: 'replaced',
			path: 'docs/README_PRODUCT_BACKLOG.md',
			previous: 'other/Other.base › Board',
		});
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(GENERATED);
	});

	it('recognizes its own file after git has given it CRLF line endings', async () => {
		// The vault this document is written for lives in a repository, and Windows
		// checkouts arrive with \r. A marker that failed to match its own file there would
		// report every regeneration as somebody else's document.
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', GENERATED.replace(/\n/g, '\r\n'));

		const result = await writeBacklogReadme(vault.app as never, 'docs', `${GENERATED}\n## Workflow states\n`);

		expect(result.outcome).toBe('updated');
		expect(result.previous).toBeUndefined();
	});

	it('recognizes its own file after an editor has saved it with a byte-order mark', async () => {
		// Same class as the CRLF case and the same workflow: a Windows editor writing UTF-8
		// with a BOM would otherwise make the plugin call its own document somebody else's,
		// and refuse every regeneration until a human found the invisible character.
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', `\uFEFF${GENERATED}`);

		const result = await writeBacklogReadme(vault.app as never, 'docs', `${GENERATED}\n## Workflow states\n`);

		expect(result.outcome).toBe('updated');
	});

	it('refuses a file that only opens like a marker', async () => {
		// The prefix is not the marker: a comment somebody wrote themselves, or a marker
		// left half-written by a truncated write or a bad merge, is a file to leave alone —
		// and the second is the one most worth not overwriting.
		const theirs = `${README_MARKER_PREFIX} of my own, thanks -->\n\n# Notes\n`;
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', theirs);

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result.outcome).toBe('foreign');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(theirs);
	});

	it('refuses a file that stopped being ours between the check and the write', async () => {
		// The permission is about the file's content, and `read`-then-`modify` answers it
		// about content that need not still be there when the write lands — sync, a second
		// window, a second command. The re-check inside `process` is what closes that gap.
		await writeBacklogReadme(vault.app as never, 'docs', GENERATED);
		const theirs = '# Mine now\n';
		const file = vault.files.get('docs/README_PRODUCT_BACKLOG.md') as never;
		const process = vault.app.vault.process;
		vault.app.vault.process = async (f: never, fn: (data: string) => string) => {
			vault.contents.set('docs/README_PRODUCT_BACKLOG.md', theirs);
			return process(f, fn);
		};

		const result = await writeBacklogReadme(vault.app as never, 'docs', `${GENERATED}\n## Workflow states\n`);

		expect(result.outcome).toBe('foreign');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(theirs);
		expect(file).toBeDefined();
	});

	it('names the document it actually replaced, not the one it read a moment earlier', async () => {
		// A third view wins the same race: the write is still permitted — the file is one
		// of ours — but the notice must name what this write took over, or it reports a
		// document nobody touched.
		await writeBacklogReadme(vault.app as never, 'docs', GENERATED);
		const theirs = `${readmeMarker('third/Third.base › Planning')}\n\n# This folder is a product backlog\n`;
		const process = vault.app.vault.process;
		vault.app.vault.process = async (f: never, fn: (data: string) => string) => {
			vault.contents.set('docs/README_PRODUCT_BACKLOG.md', theirs);
			return process(f, fn);
		};

		const result = await writeBacklogReadme(vault.app as never, 'docs', `${GENERATED}\n## Workflow states\n`);

		expect(result).toEqual({
			outcome: 'replaced',
			path: 'docs/README_PRODUCT_BACKLOG.md',
			previous: 'third/Third.base › Planning',
		});
	});

	it('refuses a file of the same name that it did not write', async () => {
		const theirs = '# My own notes about this folder\n';
		await vault.app.vault.create('docs/README_PRODUCT_BACKLOG.md', theirs);

		const result = await writeBacklogReadme(vault.app as never, 'docs', GENERATED);

		expect(result.outcome).toBe('foreign');
		expect(vault.contents.get('docs/README_PRODUCT_BACKLOG.md')).toBe(theirs);
	});
});
