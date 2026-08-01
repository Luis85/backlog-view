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

	it('accepts an angle-bracket link destination, which is how a space is written', async () => {
		// The defect this whole file exists for. `<…>` is CommonMark's destination form;
		// the register happens to percent-encode everywhere, so it never met the bug.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: 'Lives in `src/thing.ts` and `test/thing.test.ts`. See [the slice](<A slice.md>).',
		});

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts an angle-bracket destination carrying an anchor', async () => {
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts`, `test/thing.test.ts`, and [the slice](<A slice.md>#outcome).',
		});

		expect(await problemsFor(files)).toEqual([]);
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

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts every Markdown bullet marker on an extension', async () => {
		// The register writes `-`. A contributor writing `*` or `+` is writing Markdown,
		// and an index matcher that encoded one spelling has already blocked one.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			extensions: ['* **2a — one way it goes otherwise** — because.', '+ **2b — another** — because.'].join('\n'),
		});

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts trailing whitespace after a heading', async () => {
		// Invisible in every editor, and `## Use case ` is the same heading.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase()
			.replace('## Use case', '## Use case  ')
			.replace('## Acceptance criteria', '## Acceptance criteria   ');

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts an opening whose markers are broken across lines', async () => {
		// The 100-column wrap does this routinely, and the marker is still the marker.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			opening: '**As** a user, **I\nwant** the thing done **so\nthat** the work is visible.',
		});

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts notes in a nested folder', async () => {
		// `walk` recurses, so a note in `requirements/board/` is a requirement — and is
		// held to every rule one at the top level is.
		const files = baseRegister();
		files['docs/requirements/board/On the board.md'] = useCase({
			title: 'On the board',
			order: 20,
		});

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts files that are not markdown sitting beside the notes', async () => {
		// `Product Backlog.base` lives in `docs/` and is the whole point of the folder.
		const files = baseRegister();
		files['docs/Product Backlog.base'] = 'views:\n  - type: product-backlog\n';
		files['docs/requirements/diagram.svg'] = '<svg></svg>';

		expect(await problemsFor(files)).toEqual([]);
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

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts wikilinks carrying an alias or a heading', async () => {
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts`, `test/thing.test.ts`, [[A slice|the slice]] and [[A slice#Outcome]].',
		});

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts fractional and negative ranks', async () => {
		// Orders are fractional by design — that is how an item lands between two
		// neighbours without renumbering the group.
		const files = baseRegister();
		files['docs/requirements/Thing.md'] = note('Epic', -5, null, '# Thing\n\nWhy this exists.\n');
		files['docs/requirements/A slice.md'] = note('Feature', 12.5, 'Thing', '# A slice\n\n**Outcome** — it works.\n');

		expect(await problemsFor(files)).toEqual([]);
	});

	it('accepts the record kinds and the pairs the corpus does not use', async () => {
		// Issue and Bug attach to an Epic, a Feature or a PBI alike, and hold Tasks.
		const files = baseRegister();
		files['docs/issues/A question.md'] = note('Issue', 20, 'Thing', '# A question\n\n## The decision\n\nTaken.\n');
		files['docs/bugs/A defect.md'] = note('Bug', 20, 'A slice', '# A defect\n\n## What happened\n\nIt broke.\n');
		files['docs/tasks/Some work.md'] = note('Task', 10, 'A question', '# Some work\n\n## Evidence\n\nMeasured.\n');

		expect(await problemsFor(files)).toEqual([]);
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

	it('accepts a supersession chain declared from both ends', async () => {
		const files = baseRegister();
		files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', {
			status: 'Superseded',
			'superseded-by': '2',
		});
		files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision', { supersedes: '1' });
		files['docs/adrs/README.md'] =
			'# ADRs\n\n- [0001](0001-the-first-decision.md)\n- [0002](0002-the-second-decision.md)\n';

		expect(await problemsFor(files)).toEqual([]);
	});
});

/** The problems alone — the assertion every case above makes is that there are none. */
async function problemsFor(files: Record<string, string>): Promise<string[]> {
	return (await checkRegister(files)).problems;
}
