import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs helper with no type declarations, imported for what it does.
import { headings } from '../../scripts/docs-markdown.mjs';

/**
 * `CHANGELOG.md` held against `manifest.json`, the same way `versionFiles.test.ts` holds
 * the version files against each other.
 *
 * `RELEASING.md` says a second commit, right after the version bump and in the same pull
 * request, renames `## [Unreleased]` to `## [<version>] - <date>` — it cannot be the same
 * commit `npm version` makes, since that one runs against a clean tree. Nothing enforced
 * that until this test: a rule stated only in prose is exactly the shape of defect
 * `../CLAUDE.md`'s Claims section warns about — read as settled, caught by no check. This
 * makes the two facts disagree loudly: `manifest.json`'s version must be the FIRST dated
 * heading below `## [Unreleased]`, not merely present somewhere in the file's history, so
 * a bump that forgot the entry — or added one under the wrong heading — fails here rather
 * than shipping a changelog that does not name its own latest release.
 *
 * What this cannot check: that the entry says anything true. A heading with no bullets
 * under it still passes, and so does a date that does not exist on a calendar — `2026-13-40`
 * matches `\d{4}-\d{2}-\d{2}` exactly as a real one does, and `changelogNotes` never reads
 * the heading's date at all, only the body beneath it, so an invalid one reaches neither
 * the release body nor anything else this check gates. That is deliberate and the same
 * limit `versionFiles.test.ts` accepts for its own three assertions — the instrument can
 * see the version files agree, not that either one is correct.
 *
 * This used to be a hand-written regex, and review found a genuine gap on every round: no
 * date required, no anchor to `[Unreleased]`'s own position, filtering for well-formed
 * headings before deciding which one was "first" (so a malformed one in first place hid
 * behind a correct one further down), requiring brackets that a bracket-less malformed
 * heading skipped past, and finally — CommonMark permits 0-3 leading spaces before a
 * heading marker, which every version anchored on `^##` missed. Each fix closed one hole
 * and opened the next: exactly the failure mode
 * [ADR 0021](../../docs/adrs/0021-parse-the-register-with-mdast.md) retired for the docs
 * register itself, for the same reason. `headings()` is the same mdast-backed parser
 * `docs-check.mjs` already trusts for every other `## ` heading in this repository, so
 * "the first heading below `[Unreleased]`" is asked of a real CommonMark parse instead of
 * one more pattern.
 *
 * `headings()` is ATX-only by design, not by the gap this file's history is otherwise a
 * catalogue of: its own comment in `docs-markdown.mjs` explains that recognising CommonMark's
 * other level-two spelling — a line underlined with `---` — read the `---` of every note's
 * own YAML frontmatter as a heading whose text was the whole block, across the entire
 * register. Widening it to catch a Setext-style `## ` heading here would reopen that,
 * repository-wide, to close a shape nobody writes a changelog heading in — an ATX `##` is
 * the only spelling `RELEASING.md` ever asks for. Narrowing the claim rather than the
 * parser: this test knows a real dated heading from a malformed one in every ATX spelling,
 * and does not look for one written as a Setext underline.
 */
const DATED_VERSION = /^\[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/;

describe('the changelog names the released version', () => {
	const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
	const all = headings(readFileSync('CHANGELOG.md', 'utf8'));
	const unreleasedAt = all.findIndex((h) => h.text === '[Unreleased]');

	it('has an [Unreleased] section', () => {
		expect(unreleasedAt).toBeGreaterThanOrEqual(0);
	});

	it('names the manifest version, dated, as the first heading below [Unreleased]', () => {
		const first = all[unreleasedAt + 1];
		const dated = first ? DATED_VERSION.exec(first.text) : null;
		expect(dated?.[1]).toBe(manifest.version);
	});
});
