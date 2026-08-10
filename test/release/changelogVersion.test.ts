import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `CHANGELOG.md` held against `manifest.json`, the same way `versionFiles.test.ts` holds
 * the version files against each other.
 *
 * `RELEASING.md` says the version-bump commit renames `## [Unreleased]` to
 * `## [<version>] - <date>` in the same breath as bumping `manifest.json`. Nothing
 * enforced that until this test: a rule stated only in prose is exactly the shape of
 * defect `../CLAUDE.md`'s Claims section warns about — read as settled, caught by no
 * check. This makes the two facts disagree loudly: `manifest.json`'s version must be the
 * FIRST dated heading below `## [Unreleased]`, not merely present somewhere in the file's
 * history, so a bump that forgot the entry — or added one under the wrong heading — fails
 * here rather than shipping a changelog that does not name its own latest release.
 *
 * What this cannot check: that the entry says anything true. A heading with no bullets
 * under it still passes. That is deliberate and the same limit `versionFiles.test.ts`
 * accepts for its own three assertions — the instrument can see the version files agree,
 * not that either one is correct.
 */
const HEADING = /^## \[(\d+\.\d+\.\d+)\]/gm;

describe('the changelog names the released version', () => {
	const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
	const changelog = readFileSync('CHANGELOG.md', 'utf8');

	it('has an [Unreleased] section', () => {
		expect(changelog).toMatch(/^## \[Unreleased\]$/m);
	});

	it('names the manifest version in its first dated heading', () => {
		const [firstVersion] = [...changelog.matchAll(HEADING)].map((m) => m[1]);
		expect(firstVersion).toBe(manifest.version);
	});
});
