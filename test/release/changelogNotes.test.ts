import { describe, expect, it } from 'vitest';
import { changelogNotes } from '../../scripts/changelog-notes.mjs';

/**
 * `changelogNotes`'s boundary logic, direct — the found/not-found branch and the
 * has-a-next-heading/runs-to-EOF branch, both invisible if this were only exercised
 * through the release workflow that calls it. See ADR 0025 for why the release body
 * reads this file's entry at all, and `changelogVersion.test.ts` for the check that
 * keeps the heading this function looks for from going missing on `main` in the first
 * place — this file is about the extraction, not about whether the heading exists.
 */
const SAMPLE = `# Changelog

## [Unreleased]

- Something in flight.

## [0.6.0] - 2026-08-10

Changelog tracking starts here.

## [0.5.2] - 2026-08-05

Earlier notes, trimmed of the surrounding blank lines.
`;

describe('changelogNotes', () => {
	it('extracts the body between a version heading and the next one', () => {
		expect(changelogNotes(SAMPLE, '0.6.0')).toBe('Changelog tracking starts here.');
	});

	it('extracts to end of file for the oldest entry', () => {
		expect(changelogNotes(SAMPLE, '0.5.2')).toBe('Earlier notes, trimmed of the surrounding blank lines.');
	});

	it('throws when the version has no dated heading', () => {
		expect(() => changelogNotes(SAMPLE, '9.9.9')).toThrow(/no dated heading/);
	});

	// Review found this one live: `indexOf('\n', …)` returns -1 with no newline after the
	// heading, and -1 + 1 used to slice from 0 — the WHOLE file — for a heading that
	// actually has nothing after it at all, rather than the empty body it really has.
	it('is empty, not the whole file, when the matching heading is the last line with no trailing newline', () => {
		const noTrailingNewline = '# Changelog\n\n## [Unreleased]\n\n## [0.6.0] - 2026-08-10';
		expect(changelogNotes(noTrailingNewline, '0.6.0')).toBe('');
	});

	it('is empty when the matching heading is followed only by its own trailing newline', () => {
		const headingOnly = '# Changelog\n\n## [Unreleased]\n\n## [0.6.0] - 2026-08-10\n';
		expect(changelogNotes(headingOnly, '0.6.0')).toBe('');
	});
});
