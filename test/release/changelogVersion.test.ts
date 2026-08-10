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
 *
 * Two things a looser match let through, caught by review before this test shipped: a
 * heading missing its `- <date>` (RELEASING.md's own rule, unchecked), and a version
 * heading placed ABOVE `[Unreleased]` rather than below it — both read as "first" to a
 * pattern with no date and no anchor to `[Unreleased]`'s own position. `DATED_VERSION`
 * requires the date; slicing from `[Unreleased]` onward before matching requires the
 * heading to be at or after it, which is the only place Keep a Changelog puts one.
 */
const UNRELEASED = /^## \[Unreleased\]$/m;
const DATED_VERSION = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/gm;

describe('the changelog names the released version', () => {
	const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
	const changelog = readFileSync('CHANGELOG.md', 'utf8');

	it('has an [Unreleased] section', () => {
		expect(changelog).toMatch(UNRELEASED);
	});

	it('names the manifest version, dated, as the first heading below [Unreleased]', () => {
		const afterUnreleased = changelog.slice(changelog.search(UNRELEASED));
		const [firstVersion] = [...afterUnreleased.matchAll(DATED_VERSION)].map((m) => m[1]);
		expect(firstVersion).toBe(manifest.version);
	});
});
