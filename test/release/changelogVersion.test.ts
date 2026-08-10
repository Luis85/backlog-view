import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `CHANGELOG.md` held against `manifest.json`, the same way `versionFiles.test.ts` holds
 * the version files against each other.
 *
 * `RELEASING.md` says a second commit, right after the version bump and in the same pull
 * request, renames `## [Unreleased]` to `## [<version>] - <date>` — it cannot be the same
 * commit `npm version` makes, since that one runs against a clean tree. Nothing enforced
 * that until this test: a rule stated only in prose is exactly the shape of
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
 * Three things a looser match let through, each caught by review before this test
 * reached `main`: a heading missing its `- <date>` (RELEASING.md's own rule, unchecked);
 * a version heading placed ABOVE `[Unreleased]` rather than below it; and — the one the
 * first fix still missed — a malformed heading sitting FIRST below `[Unreleased]`, ahead
 * of a correctly dated one further down. `DATED_VERSION.exec` used with `matchAll` finds
 * the first heading that already happens to be well-formed, filtering before ordering
 * decides "first" — so a malformed heading above a correct one was invisible to it. The
 * fix picks the first heading LINE unconditionally (`HEADING`, no date required) and
 * validates only that one against `DATED_VERSION`: a malformed heading in first place now
 * fails on its own, rather than being skipped in favour of whatever matches further down.
 */
const UNRELEASED = /^## \[Unreleased\]$/m;
const HEADING = /^## \[[^\]]+\].*$/gm;
const DATED_VERSION = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/;

describe('the changelog names the released version', () => {
	const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
	const changelog = readFileSync('CHANGELOG.md', 'utf8');

	it('has an [Unreleased] section', () => {
		expect(changelog).toMatch(UNRELEASED);
	});

	it('names the manifest version, dated, as the first heading below [Unreleased]', () => {
		const unreleased = UNRELEASED.exec(changelog);
		const afterUnreleased = changelog.slice(unreleased.index + unreleased[0].length);
		const [firstHeading] = [...afterUnreleased.matchAll(HEADING)].map((m) => m[0]);
		const dated = firstHeading ? DATED_VERSION.exec(firstHeading) : null;
		expect(dated?.[1]).toBe(manifest.version);
	});
});
