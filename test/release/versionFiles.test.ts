import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The three files a release reads, held to each other.
 *
 * `npm version` keeps them in step — the `version` script runs `version-bump.mjs`,
 * which writes `manifest.json` and adds the `versions.json` entry from the version npm
 * just set. Nothing checked that they STAYED in step, and RELEASING.md documents a path
 * that invites them apart: "when the version files are already committed" is the case
 * where a person or an agent edits them by hand, and `npm version` must not be run on
 * top of it.
 *
 * What each disagreement costs is different, which is why they are three assertions
 * rather than one:
 *
 * - The release workflow reads the tag from `manifest.json` ALONE. A `package.json` left
 *   behind is invisible at publish time and surfaces later as a repository that
 *   disagrees with its own releases.
 * - `versions.json` is what Obsidian reads to decide which release a given app version
 *   may install. A published version missing from it is not a tidiness problem: the
 *   client has no compatibility answer for it, which is a user-facing bug that no test
 *   in this repository would otherwise catch and no reviewer reliably notices.
 *
 * A node test rather than a sixth step in `npm run check` (ADR 0007): the suite already
 * runs in CI, so this is enforced everywhere the gate is without changing what the gate
 * IS.
 */
function json(path: string): Record<string, string> {
	return JSON.parse(readFileSync(path, 'utf8'));
}

describe('the version files agree with each other', () => {
	const manifest = json('manifest.json');
	const pkg = json('package.json');
	const versions = json('versions.json');

	it('names one version in the manifest and the package', () => {
		expect(manifest.version).toBe(pkg.version);
	});

	it('lists the manifest version in versions.json, at the app version it requires', () => {
		// The value is the MINIMUM app version for this plugin version, which is what
		// `version-bump.mjs` copies from the manifest — so a hand-edited bump that
		// forgot the entry, or that pinned it to a stale floor, fails here.
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
	});

	it('reads the files it claims to — the instrument before its verdict', () => {
		// All three assertions above pass vacuously if a read returned an empty object,
		// which a moved or renamed file would produce quietly.
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
		expect(Object.keys(versions).length).toBeGreaterThan(0);
	});
});
