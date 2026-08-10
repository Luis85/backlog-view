import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { headings } from './docs-markdown.mjs';

/**
 * The body of one dated version heading in `CHANGELOG.md` — everything between it and
 * the next `## ` heading, or the end of the file for the oldest entry, trimmed.
 *
 * Heading boundaries come from `headings()`, the same mdast-backed parser
 * `docs-check.mjs` trusts for the docs register, rather than a hand-written pattern: a
 * first version anchored on `^## ` missed a heading indented by CommonMark's permitted
 * 0-3 leading spaces, the same gap review found in `test/release/changelogVersion.test.ts`
 * before this file existed — see ADR 0021 for why a parser replaced patterns there, and
 * ADR 0025 for why the release body reads this file's entry at all.
 *
 * Exported so the boundary logic (heading found or not, a next heading to stop at or
 * none) is testable directly, in `test/release/changelogNotes.test.ts`, rather than only
 * through the release workflow that calls it.
 */
export function changelogNotes(changelog, version) {
	const dated = new RegExp(`^\\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`);
	const all = headings(changelog);
	const at = all.findIndex((h) => dated.test(h.text));
	if (at === -1) throw new Error(`CHANGELOG.md has no dated heading for ${version}`);
	// A heading with no newline after it is the last line of a file that does not end in
	// one: indexOf returns -1, and `-1 + 1` used to slice from 0 — the whole file, not the
	// empty body that heading actually has nothing after.
	const lineEnd = changelog.indexOf('\n', all[at].index);
	const from = lineEnd === -1 ? changelog.length : lineEnd + 1;
	return changelog.slice(from, all[at + 1]?.index ?? changelog.length).trim();
}

// CLI entry: `node scripts/changelog-notes.mjs <version>`, what the release workflow
// runs to build the file `gh release create --notes-file` reads. Guarded on the real
// path (not `import.meta.url` compared directly — that breaks on Windows, where it
// stays `file:///C:/...` against argv's `C:\...`) so importing this module for its
// export never touches argv or the filesystem.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const version = process.argv[2];
	if (!version) {
		console.error('Usage: node scripts/changelog-notes.mjs <version>');
		process.exit(1);
	}
	process.stdout.write(`${changelogNotes(readFileSync('CHANGELOG.md', 'utf8'), version)}\n`);
}
