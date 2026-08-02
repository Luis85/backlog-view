import { describe, expect, it } from 'vitest';
import { adr, baseRegister, checkRegister, note, useCase } from '../helpers/register';

/**
 * **Does a valid document pass?**
 *
 * The other direction — does an invalid one fail — is `checkerRejects.test.ts`, and it is
 * the direction `docs-check.mjs` was built in: every rule in it was verified by planting
 * the violation and watching the check reject it. That method found two dozen holes and
 * missed the most expensive defect in the file, because a false pass and a false failure
 * are not discovered by the same person.
 *
 * A false pass is found by someone hunting for holes. A false failure is found by someone
 * who was doing something else, and their likely response is to change the *document*:
 * "CI is red on a link I just wrote — fine, I will write the link the other way." The bug
 * then survives as a rule nobody can state, believed by people who never learned why.
 * `[the filter](<The quick filter on the board.md>)` was exactly that: angle brackets are
 * Markdown's sanctioned way of putting a space in a link destination, every note here has
 * spaces in its name, and the one correct way to write that link was rejected.
 *
 * So each case below is a **legal form the register does not itself use**, and each
 * expects a green run. The register avoiding a construct is not evidence the construct is
 * wrong; it is the reason nothing would notice if the gate started refusing it.
 *
 * ---
 *
 * **Adding a case: green is not the assertion.** Every case here asserts an *absence* —
 * no problems — which is the weakest thing a test can claim, because almost anything
 * produces it. Review found two cases in the first draft of this file that were green for
 * reasons unrelated to what they were named after:
 *
 * - one that would have read a **crashed** checker as acceptance, since a run that never
 *   printed a report contributes an empty problem list; and
 * - `](<A slice.md>#outcome)`, which is not an anchored bracketed link at all — a
 *   bracketed destination ends at `>` — so the case passed on the gate ignoring trailing
 *   junk while claiming to cover a legal form. Anchors go **inside** the brackets.
 *
 * Writing this corpus is therefore no protection against writing a vacuous case into it,
 * and the corpus cannot catch that class in itself. The check that does is cheap and has
 * to be run by hand: **break the rule the case is named after, and watch this case fail.**
 * If it stays green, the case is testing something else. Both defects above were found
 * that way once someone thought to look, and neither would have been found by reading it.
 */

describe('the gate accepts valid documents', () => {
	it('is green on the corpus every other case is a variation of', async () => {
		// Guards the guard. Every test in both files is a delta against this tree, so a
		// corpus that was already failing would make an accept case unprovable and a
		// reject case pass for the wrong reason.
		const result = await checkRegister(baseRegister());

		expect(result.problems).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it('does not read a crashed run as acceptance', async () => {
		// The hole this file could most easily have had, and the one hardest to see: every
		// case here asserts an EMPTY problem list, and a checker that died before printing
		// its report contributes exactly that. Green would then mean "the gate said
		// nothing", which is what acceptance looks like and also what a crash looks like.
		//
		// A tree with no `src/` at all makes `collectTs` throw, so the run exits non-zero
		// having reported nothing. `checkRegister` refuses to return it as a verdict.
		const files = baseRegister();
		delete files['src/thing.ts'];

		await expect(checkRegister(files)).rejects.toThrow('without reporting problems');
	});

	it('accepts an angle-bracket link destination, which is how a space is written', async () => {
		// The defect this whole file exists for. `<…>` is CommonMark's destination form;
		// the register happens to percent-encode everywhere, so it never met the bug.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: 'Lives in `src/thing.ts` and `test/thing.test.ts`. See [the slice](<A slice.md>).',
		});

		await expectAccepted(files);
	});

	it('accepts an angle-bracket destination carrying an anchor', async () => {
		// The anchor goes INSIDE the brackets. A bracketed destination ends at `>`, so
		// `](<A slice.md>#outcome)` is not this link with an anchor — it is a malformed
		// link whose trailing junk the gate happens to skip, and asserting on it protects
		// nothing. Written the legal way, the fixture exercises the path that splits the
		// anchor off before resolving.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts`, `test/thing.test.ts`, and [the slice](<A slice.md#outcome>).',
		});

		await expectAccepted(files);
	});

	it('accepts percent-encoded and anchored destinations, and skips external ones', async () => {
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'`src/thing.ts` and `test/thing.test.ts`.',
				'',
				'- [encoded](A%20slice.md)',
				'- [anchored](A%20slice.md#outcome)',
				'- [external](https://example.com/not-a-file.md)',
				'- [within this note](#doing-the-thing)',
			].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts every Markdown bullet marker on an extension', async () => {
		// The register writes `-`. A contributor writing `*` or `+` is writing Markdown,
		// and an index matcher that encoded one spelling has already blocked one.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			extensions: ['* **2a — one way it goes otherwise** — because.', '+ **2b — another** — because.'].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts trailing whitespace after a heading', async () => {
		// Invisible in every editor, and `## Use case ` is the same heading.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase()
			.replace('## Use case', '## Use case  ')
			.replace('## Acceptance criteria', '## Acceptance criteria   ');

		await expectAccepted(files);
	});

	it('accepts a register checked out with CRLF line endings', async () => {
		// The other invisible character, and the one that is not the contributor's choice:
		// Git for Windows checks out CRLF by default, so this is what `npm run docs` reads
		// on an ordinary Windows clone of a repository whose files are LF in the object
		// store. The gate's structural patterns are anchored on `\n` — `^---\n` opens the
		// frontmatter, `\*\*Extensions\*\*\n+` opens the block — and none of them match
		// `\r\n`, so the whole register read as typeless and the run reported 136 problems
		// about documents that are correct. A false failure, on every note at once, in the
		// direction this project holds is the more expensive one to get wrong.
		//
		// The whole corpus is converted rather than one note: the condition is a checkout,
		// not a file, and a single CRLF note would leave the case passing on the LF ones.
		const files = Object.fromEntries(
			Object.entries(baseRegister()).map(([path, text]) => [path, text.replaceAll('\n', '\r\n')]),
		);

		await expectAccepted(files);
	});

	it('accepts an opening whose markers are broken across lines', async () => {
		// The 100-column wrap does this routinely, and the marker is still the marker.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			opening: '**As** a user, **I\nwant** the thing done **so\nthat** the work is visible.',
		});

		await expectAccepted(files);
	});

	it('accepts notes in a nested folder', async () => {
		// `walk` recurses, so a note in `requirements/board/` is a requirement — and is
		// held to every rule one at the top level is.
		//
		// The nested note is made **load-bearing**: it is the only note naming
		// `src/board.ts`, so a `walk` that stopped recursing would leave that module
		// unnamed and this case would fail with `no note names src/board.ts`. Added
		// because the case did not previously observe the behaviour it claims — a note
		// the gate never discovers is a note the gate never objects to, so ignoring it
		// left the unchanged corpus green and the assertion passed either way. A fixture
		// that survives the feature being removed is testing nothing.
		const files = baseRegister();
		files['src/board.ts'] = 'export const board = 1;\n';
		files['docs/requirements/board/On the board.md'] = useCase({
			title: 'On the board',
			order: 20,
			whereItLives: 'Lives in `src/board.ts`.',
		});

		await expectAccepted(files);
	});

	it('accepts files that are not markdown sitting beside the notes', async () => {
		// `Product Backlog.base` lives in `docs/` and is the whole point of the folder.
		const files = baseRegister();
		files['docs/Product Backlog.base'] = 'views:\n  - type: product-backlog\n';
		files['docs/requirements/diagram.svg'] = '<svg></svg>';

		await expectAccepted(files);
	});

	it('accepts structure quoted inside a fence or a code span', async () => {
		// Both fence characters, because stripping only ``` leaves every structural
		// question readable inside a tilde fence, where nothing renders and nothing is
		// real. A wikilink in backticks is an example being shown, not a reference made.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'`src/thing.ts` and `test/thing.test.ts`.',
				'',
				'~~~',
				'## Use case',
				'**Main flow**',
				'~~~',
				'',
				'```',
				'## Where it lives',
				'```',
				'',
				'A link like `[[No such note]]` is an example, not a reference.',
			].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts wikilinks carrying an alias or a heading', async () => {
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts`, `test/thing.test.ts`, [[A slice|the slice]] and [[A slice#Outcome]].',
		});

		await expectAccepted(files);
	});

	it('accepts fractional and negative ranks', async () => {
		// Orders are fractional by design — that is how an item lands between two
		// neighbours without renumbering the group.
		const files = baseRegister();
		files['docs/requirements/Thing.md'] = note('Epic', -5, null, '# Thing\n\nWhy this exists.\n');
		files['docs/requirements/A slice.md'] = note('Feature', 12.5, 'Thing', '# A slice\n\n**Outcome** — it works.\n');

		await expectAccepted(files);
	});

	it('accepts a parentless milestone, a root by nature rather than by position', async () => {
		// A marker is a root by NATURE, where an Epic is a root by position on the ladder.
		const files = baseRegister();
		files['docs/milestones/Ship 1.0.md'] = note('Milestone', 60, null, '# Ship 1.0\n\nThe date.\n');

		await expectAccepted(files);
	});

	it('accepts the record kinds and the pairs the corpus does not use', async () => {
		// Issue and Bug attach to an Epic, a Feature or a PBI alike, and hold Tasks.
		const files = baseRegister();
		files['docs/issues/A question.md'] = note('Issue', 20, 'Thing', '# A question\n\n## The decision\n\nTaken.\n');
		files['docs/bugs/A defect.md'] = note('Bug', 20, 'A slice', '# A defect\n\n## What happened\n\nIt broke.\n');
		files['docs/tasks/Some work.md'] = note('Task', 10, 'A question', '# Some work\n\n## Evidence\n\nMeasured.\n');

		await expectAccepted(files);
	});

	it('lists a stale path in a record note instead of failing it', async () => {
		// `tasks/`, `issues/` and `bugs/` are records of a moment and may name a file
		// since split away — rewriting them would falsify the record. Being listed is the
		// point: visible, not silently exempt.
		const files = baseRegister();
		files['docs/tasks/Old work.md'] = note('Task', 10, 'Doing the thing', '# Old work\n\nTouched `src/gone.ts`.\n');

		const result = await checkRegister(files);

		expect(result.problems).toEqual([]);
		expect(result.output).toContain('historical path reference');
		expect(result.output).toContain('src/gone.ts');
	});

	it('accepts a superpowers spec or plan with no backlog frontmatter', async () => {
		// docs/superpowers/ is where the brainstorming and writing-plans skills save their
		// own design specs and implementation plans (CLAUDE.md) — plain markdown, never a
		// backlog note or an ADR, so it carries none of the frontmatter those require.
		const files = baseRegister();
		files['docs/superpowers/specs/2026-08-02-example-design.md'] = '# Example design\n\nSome decisions.\n';
		files['docs/superpowers/plans/2026-08-02-example.md'] = '# Example Implementation Plan\n\nSteps.\n';

		await expectAccepted(files);
	});

	it('accepts a supersession chain declared from both ends', async () => {
		const files = baseRegister();
		files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', {
			status: 'Superseded',
			'superseded-by': '2',
		});
		files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision', { supersedes: '1' });
		files['docs/adrs/README.md'] =
			'# ADRs\n\n- [0001](0001-the-first-decision.md)\n- [0002](0002-the-second-decision.md)\n';

		await expectAccepted(files);
	});

	// The three below are legal because a rule was REMOVED, which is the one way a legal
	// form arrives without anybody writing it. Each pins a deliberate cut so re-adding the
	// rule goes red here rather than quietly costing a contributor an edit — the same
	// service this file does for forms the register merely happens not to use.

	it('accepts a gap in the ADR numbering', async () => {
		// A reserved or abandoned number harms nothing. The failure the gap rule read as —
		// a record something still points at going missing — is caught properly by the
		// supersede checks, which resolve their targets against the numbers that exist.
		const files = baseRegister();
		files['docs/adrs/0003-the-third-decision.md'] = adr(3, 'the-third-decision');
		files['docs/adrs/README.md'] += '- [0003](0003-the-third-decision.md)\n';

		await expectAccepted(files);
	});

	it('accepts extensions written out of step order', async () => {
		// Every bullet is still labelled and still departs from a step the main flow has —
		// those two are what stop a label meaning nothing. Where they sit on the page is
		// the one property here a reader fixes by reading.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			extensions: '- **2b — the second** — because.\n- **2a — the first** — because.',
		});

		await expectAccepted(files);
	});

	it('accepts a test file no note names', async () => {
		// `src/` still has to be named: the architecture table claims one note per concern,
		// so a module nothing describes is a real gap. A test file is not — the rule only
		// ever asserted that a path token appears somewhere under `docs/`, which is
		// satisfiable by mentioning the file and describing nothing.
		const files = baseRegister();
		files['test/unnamed.test.ts'] = 'export const spec = 1;\n';

		await expectAccepted(files);
	});
});

/**
 * The assertion every case above makes: the gate **accepted** the tree.
 *
 * Both halves, because they are not one claim. `problems` is parsed out of the report,
 * so a run that never printed one contributes nothing to it — and "nothing" is exactly
 * what an accepted document looks like from that angle. `checkRegister` now refuses to
 * return such a run at all, and this asserts the exit as well, so the claim is stated
 * where it is made rather than resting entirely on the helper. A suite whose green
 * depends on a checker having run is a suite that has to say so twice.
 *
 * `result.output` rides along as the failure message: the interesting part of a failure
 * here is what the gate said, not that an array was non-empty.
 */
async function expectAccepted(files: Record<string, string>): Promise<void> {
	const result = await checkRegister(files);
	expect(result.problems, result.output).toEqual([]);
	expect(result.ok, result.output).toBe(true);
}
