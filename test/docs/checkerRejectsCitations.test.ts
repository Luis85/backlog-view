import { describe } from 'vitest';
import { note, runRejections, useCase } from '../helpers/register';

/**
 * **Planted violations: the `**Checked by**` citation rule.**
 *
 * Split from `checkerRejects.test.ts` by subject when that file hit its line budget, the
 * split the budget exists to force — these are one rule's cases, and they are here rather
 * than among the cross-references because a citation is a different act from a reference.
 * Naming a path says where something lives; citing a check says the check is live, which
 * is why this rule holds in a closed note where the source-path rule waves a historical
 * path through.
 *
 * The rule verifies a citation RESOLVES; it cannot verify the claim beside it, and
 * [[A claim in four notes and nothing to check it]] holds why the candidates that try are
 * worse than the problem. So what these cases pin is narrow and worth stating: a rotted
 * citation fails, and a marker the gate cannot parse fails rather than passing silently.
 *
 * That second one is the whole reason this rule has three report sites instead of two.
 * Its first version matched marker, path and name in a single regex that excluded `\n`
 * to stay bounded — so the register's own first citation, which Markdown wrapped across
 * two lines, matched nothing and went unchecked while the run stayed green. A rule that
 * quietly does nothing on input it cannot parse reads exactly like a rule that works,
 * which is the defect the citation rule was built to catch, committed by the rule itself.
 */

describe('checked-claim citations', () => {
	runRejections([
		[
			// A citation must name a CHECK. Pointing at the implementation a claim
			// describes is the claim restated, and it resolves trivially — the file exists
			// and contains the symbol — while skipping the one step this rule is for.
			'a citation naming an implementation file instead of a check',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `src/thing.ts` — "thing".',
				});
			},
			'has a **Checked by** with no `path.test.ts` and "test name" after it',
		],
		[
			// `test/` holds the doubles and the fixture builders as well as the tests, and
			// admitting every `.ts` under it admitted those too — the file is there and the
			// exported name is in it, so the citation resolved while naming no test case a
			// reader could open. Planted with the helper present, so what rejects it is the
			// suffix rule and not a missing file.
			'a citation naming a helper under test/ rather than a test file',
			(files) => {
				files['test/helpers/register.ts'] = 'export const useCase = () => {};\n';
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives:
						'`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/helpers/register.ts` — "useCase".',
				});
			},
			'has a **Checked by** with no `path.test.ts` and "test name" after it',
		],
		[
			// The pattern admits `.` and `/`, so `test/..` spells a path that LOOKS like it
			// starts in the test tree and lands anywhere — the restriction to test files
			// read as closed while one traversal walked straight through it. The suffix
			// rule does not close this: a name is not a location, so the spelling below
			// satisfies the pattern and still leaves `test/`.
			'a citation whose path climbs out of test/ into the source tree',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives:
						'`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/../src/thing.test.ts` — "thing".',
				});
			},
			'climbs out of the directory it names',
		],
		[
			// A table cell is a `tableCell` and not a paragraph, so bounding a citation by
			// paragraph found no owner and scanned to the END of the document — where this
			// malformed marker would have adopted the real citation two sections down.
			'a malformed marker inside a table cell, with a resolvable citation later',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: [
						'`src/thing.ts` and `test/thing.test.ts`.',
						'',
						'| Claim | Evidence |',
						'| --- | --- |',
						'| It happens | **Checked by** the tests |',
						'',
						'**Checked by** `test/thing.test.ts` — "the thing works".',
					].join('\n'),
				});
			},
			'has a **Checked by** with no `path.test.ts` and "test name" after it',
		],
		[
			'a citation naming a test file that does not exist',
			(files) => {
				files['docs/issues/A limitation.md'] = note(
					'Issue',
					10,
					'A slice',
					'# A limitation\n\nIt behaves.\n\n**Checked by** `test/gone.test.ts` — "the thing works".\n',
				);
			},
			'cites test/gone.test.ts, which does not exist',
		],
		[
			// The half the source-path rule above cannot give: an `issues/` note is not
			// living, so a path it merely NAMES is allowed to be historical. A citation is
			// a stronger act — it says the check is live — so it fails here where the same
			// path in ordinary prose would be waved through.
			'a citation in a closed-note directory, where a named path would be allowed',
			(files) => {
				files['docs/issues/A limitation.md'] = note(
					'Issue',
					10,
					'A slice',
					'# A limitation\n\nOnce lived in `src/gone.ts`.\n\n**Checked by** `test/gone.test.ts` — "the thing works".\n',
				);
			},
			'cites test/gone.test.ts, which does not exist',
		],
		[
			// The rule's one false PASS: `includes("")` is true of every file, so a citation
			// quoting nothing resolved against whatever it pointed at. A comparison with a
			// vacuous case reports success loudest exactly where it knows least.
			'a citation whose quoted name is only whitespace',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "   ".',
				});
			},
			'cites test/thing.test.ts with an empty test name',
		],
		[
			// Flattening the source as well as the citation collapsed the difference this
			// rule exists to see: a name is exactly the whitespace it holds, and a citation
			// wraps only because Markdown wrapped it. One is normalized, the other is not.
			'a citation whose spacing does not match the name in the file',
			(files) => {
				files['test/thing.test.ts'] = "it('the  thing works', () => {});\n";
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "the thing works".',
				});
			},
			'cites "the thing works", which test/thing.test.ts does not name',
		],
		[
			'a citation naming a test the file no longer contains',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "renamed away".',
				});
			},
			'cites "renamed away", which test/thing.test.ts does not name',
		],
		[
			// The rename this rule is FOR, in the spelling a substring match cannot see: the
			// title was not replaced, it was extended, so the old phrase is still in the file
			// and the citation read as live while naming a test that no longer exists. Matching
			// a whole quoted string is what tells the two apart — and it also stops a phrase
			// resolving against an identifier or a comment, which is how `"resolveSettings"`
			// passed against an import line.
			'a citation whose test has been renamed by extending its old title',
			(files) => {
				files['test/thing.test.ts'] = "it('the thing works when it is wrapped', () => {});\n";
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives:
						'`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "the thing works".',
				});
			},
			'cites "the thing works", which test/thing.test.ts does not name',
		],
		[
			// The failure mode this rule's FIRST version had, turned into a report. That
			// version matched marker, path and name in one regex that excluded `\n` to stay
			// bounded — so the first real citation written into the register, which Markdown
			// wrapped across two lines, matched nothing and went unchecked while the run
			// stayed green. A rule that quietly does nothing on input it cannot parse reads
			// exactly like a rule that works.
			'a **Checked by** marker the gate cannot parse a citation out of',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** the tests, obviously.',
				});
			},
			'has a **Checked by** with no `path.test.ts` and "test name" after it',
		],
		[
			// Review asked whether the paragraph boundary (`\n[ \t]*\n`) misses `\r\n\r\n` on
			// the Windows leg of CI, letting a malformed marker reach forward and adopt a
			// path and a quoted name from a later paragraph. It does not: `readText`
			// normalizes CRLF before any pattern in this file sees a document, so the
			// boundary only ever meets `\n`. That is one line away from being untrue — a
			// rule reading a file any other way would reintroduce it — so the case is kept
			// rather than the reasoning. It fails on the malformed marker, never silently
			// resolving the citation two paragraphs down.
			'a malformed marker on a CRLF checkout, with a resolvable citation further down',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: [
						'`src/thing.ts` and `test/thing.test.ts`.',
						'',
						'**Checked by** the tests, obviously.',
						'',
						'Later paragraph naming `test/thing.test.ts` and "the thing works".',
					].join('\n'),
				});
				for (const [path, text] of Object.entries(files)) files[path] = text.replaceAll('\n', '\r\n');
			},
			'has a **Checked by** with no `path.test.ts` and "test name" after it',
		],
		[
			// The other half of that lesson, in the accept direction's shape: a citation
			// Markdown has wrapped is a legal citation and must resolve. Without this, the
			// rule could be "fixed" back into the broken version and only this case would
			// notice — the reject cases above all fit on one line.
			'a wrapped citation whose test name is genuinely absent',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: [
						'`src/thing.ts` and `test/thing.test.ts`.',
						'',
						'**Checked by** `test/thing.test.ts` — "the thing works',
						'when it is wrapped".',
					].join('\n'),
				});
			},
			'cites "the thing works when it is wrapped", which test/thing.test.ts does not name',
		],
		[
			// The root README is fetched by name rather than reached by the walk, so it is
			// a second code path and needs its own planting — a rule that covered only the
			// walk would pass every case above and still miss the file the wrong sentence
			// this convention exists for was actually read in.
			'a rotted citation in the root README, which is not in the register at all',
			(files) => {
				files['README.md'] = '# The plugin\n\n**Checked by** `test/gone.test.ts` — "the thing works".\n';
			},
			'cites test/gone.test.ts, which does not exist',
		],	]);
});
