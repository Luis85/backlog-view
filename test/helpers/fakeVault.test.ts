import { describe, expect, it } from 'vitest';
import { FakeVault } from './vault';

/**
 * The fake's link resolution, which is cached — and is also the instrument the harness's
 * `?perf` numbers come off, so a wrong answer here is a wrong answer about the plugin.
 *
 * These are about the CACHE rather than about resolution: the scan it replaced could not
 * be stale, so every case below is one the index introduced. The delete-then-add one is
 * why the invalidation counts mutations instead of watching `size` — that pair returns
 * the size to where it started, and a cache trusting it answers with a removed file.
 * (Found by review on PR #128, not by anything failing.)
 */
describe('the fake vault resolves links against the current file set', () => {
	const dest = (vault: FakeVault, linkpath: string): string | null =>
		vault.app.metadataCache.getFirstLinkpathDest(linkpath, '')?.path ?? null;

	// Every file below sits in a FOLDER, and that is load-bearing rather than decorative:
	// `getFirstLinkpathDest` tries the exact path, then the path with `.md`, and only then
	// the index — so a root-level `Epic.md` is answered by the second branch and the cache
	// is never touched at all. A first draft of these tests filed them at the root, warmed
	// nothing, and passed against the very staleness they were written to catch.
	it('sees a delete and an add that leave the file count where it started', () => {
		const vault = new FakeVault();
		vault.addFile('Dir/Epic.md');
		vault.addFile('Dir/Other.md');
		// Warms the index through the basename branch — without this the assertions below
		// run against a cold cache and prove nothing.
		expect(dest(vault, 'Epic')).toBe('Dir/Epic.md');

		vault.files.delete('Dir/Epic.md');
		vault.addFile('Dir/Replacement.md');

		expect(dest(vault, 'Epic')).toBeNull();
		expect(dest(vault, 'Replacement')).toBe('Dir/Replacement.md');
	});

	it('follows a rename, which also leaves the count alone', () => {
		const vault = new FakeVault();
		vault.addFile('Dir/Epic.md');
		expect(dest(vault, 'Epic')).toBe('Dir/Epic.md');

		vault.renameFile('Dir/Epic.md', 'Dir/Renamed.md');

		expect(dest(vault, 'Epic')).toBeNull();
		expect(dest(vault, 'Renamed')).toBe('Dir/Renamed.md');
	});

	it('takes a path before a basename, whatever order the files were added in', () => {
		const vault = new FakeVault();
		// `Work/Epic.md` is added FIRST and still loses `Epic`, which is the whole
		// difference from the scan this replaced: that returned whichever file came first
		// in insertion order matching ANY of its three conditions, so an early basename
		// match beat a later path one. Precedence is now stated — exact path, then path
		// with `.md`, then basename — and this is the case that tells the two apart.
		vault.addFile('Work/Epic.md');
		vault.addFile('Epic.md');

		expect(dest(vault, 'Work/Epic.md')).toBe('Work/Epic.md');
		expect(dest(vault, 'Epic')).toBe('Epic.md');
	});

	it('falls back to the basename, and the first file added under it wins', () => {
		const vault = new FakeVault();
		vault.addFile('A/Dup.md');
		vault.addFile('B/Dup.md');

		// No file at `Dup.md`, so only the basename can answer — and it answers with the
		// one added first, which is what the insertion-ordered index preserves.
		expect(dest(vault, 'Dup')).toBe('A/Dup.md');
	});
});
