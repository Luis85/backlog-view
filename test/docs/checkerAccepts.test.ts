import { describe, expect, it } from 'vitest';
import { adr, baseRegister, checkRegister, hierarchyTable, note, useCase } from '../helpers/register';

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

	it('accepts a Deliverable at every rung an Issue or a Bug may sit at', async () => {
		// The register documents the plugin's own schema, and `childTypeChoices` answers
		// `[ladderChild, ...EXTRA_TYPES]` at every rung on the ladder — so a Deliverable is
		// legal under an Epic, a Feature and a PBI, and takes Tasks like the other two extra
		// types. It was missing from the gate for the whole of the increment that introduced
		// it, which is the direction this file exists to catch: a legal form the checker
		// started refusing.
		const files = baseRegister();
		files['docs/deliverables/The one-pager.md'] = note('Deliverable', 40, 'Thing', '# The one-pager\n\nA thing to produce.\n');
		files['docs/deliverables/The deck.md'] = note('Deliverable', 50, 'A slice', '# The deck\n\nA thing to produce.\n');
		// The PBI rung too, or the name outruns the test: with only the Epic and Feature
		// parents driven, `PBI` could drop `...EXTRA` and this would still pass. Found in
		// review, and it is the rule this repo states about its own claims — write the
		// guarantee to the check.
		files['docs/deliverables/The runbook.md'] = note('Deliverable', 60, 'Doing the thing', '# The runbook\n\nA thing to produce.\n');
		files['docs/tasks/Draft the deck.md'] = note('Task', 30, 'The deck', '# Draft the deck\n\nWork.\n');

		await expectAccepted(files);
	});

	it('accepts a Resource, the one note in this register that is not a work item', async () => {
		// A `Resource` is a person — a note `readItems.ts` recognises in order to REFUSE it as
		// an item at all — so every rule below the exemption would ask it a question it has no
		// answer for: no rung to rank among, no status in the register's vocabulary, no
		// requirement to hang from. The `Absence` exemption is the precedent and the reason:
		// the gate must not assert a schema the plugin does not write.
		//
		// Written with the frontmatter the plugin actually produces rather than through
		// `note()`, which would supply the very `order`, `parent` and `status` this case is
		// about not needing.
		const files = baseRegister();
		files['docs/resources/Elli.md'] = '---\ntype: Resource\n---\n\n# Elli\n\nA person.\n';

		await expectAccepted(files);
	});

	it('accepts a Release, which is a marker and so an ordinary root of this register', async () => {
		// The other direction from the case above, and the one this branch got wrong first: a
		// `Release` is a DECLARED type and a marker like `Milestone` and `Iteration`, both of
		// which this register already holds as ordinary notes — so it is ranked, it carries a
		// register status, and it is a root by nature rather than a note the gate skips. See
		// `docs/issues/The gate was one marker behind.md`.
		//
		// Its own `version`, `target-date` and release status are the PLUGIN's vocabulary and
		// live beside the register's, which is what makes the two rulings compatible: the gate
		// reads `type`, `order`, `parent` and `status`, and never looks at the rest.
		const files = baseRegister();
		files['docs/releases/Feisty Reindeer.md'] =
			'---\ntype: Release\norder: 20\nversion: 1.1.0\ntarget-date: 2026-11-01\nstatus: Open\n---\n\n# Feisty Reindeer\n\nA release.\n';

		await expectAccepted(files);
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

	it('accepts a resolving **Checked by** citation, in a note and in the root README', async () => {
		// Both sites the rule covers, because they are reached differently: `docs/` files
		// come from the walk and the root README is fetched by name. A rule that worked on
		// one and silently did nothing on the other would look exactly like this passing.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'`src/thing.ts` and `test/thing.test.ts`.',
				'',
				'**Checked by** `test/thing.test.ts` — "the thing works".',
			].join('\n'),
		});
		files['README.md'] = '# The plugin\n\n**Checked by** `test/thing.test.ts` — "the thing works".\n';

		await expectAccepted(files);
	});

	it('accepts a citation Markdown has wrapped across two lines', async () => {
		// The legal form the first version of this rule refused — silently, which is the
		// expensive direction: the register's own first citation wrapped exactly like this
		// and was never checked, while the run stayed green and read as if it had been.
		const files = baseRegister();
		files['test/thing.test.ts'] = "it('the thing works when it is wrapped', () => {});\n";
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'`src/thing.ts` and `test/thing.test.ts`.',
				'',
				'**Checked by** `test/thing.test.ts` — "the thing works',
				'when it is wrapped".',
			].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts a citation naming a lint rule, which is this repo’s other kind of check', async () => {
		// `eslint.config.mjs` is admitted beside `test/` deliberately: the root CLAUDE.md's
		// answer to a category invariant is a lint rule at the forbidden thing, not a test,
		// so a rule that took only test files would refuse the checks most worth citing.
		const files = baseRegister();
		files['eslint.config.mjs'] = 'export const RULE = { selector: "Nope", message: "no raw reads" };\n';
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `eslint.config.mjs` — "no raw reads".',
		});

		await expectAccepted(files);
	});

	it('accepts a citation naming a table-driven case label — the limit, pinned', async () => {
		// The cited name must be a whole quoted string in the file, and deliberately NOT an
		// `it()` title: this register's own citations name `runRejections` case labels, whose
		// titles are `reports %s` and whose text lives in an array. Review asked for titles
		// specifically; green here is the answer, so anyone making that change has to come
		// and decide it rather than discover it.
		const files = baseRegister();
		files['test/thing.test.ts'] = [
			"const cases = [['the thing works', () => {}]];",
			"it.each(cases)('reports %s', (_name, run) => run());",
		].join('\n');
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "the thing works".',
		});

		await expectAccepted(files);
	});

	it('resolves only the FIRST quoted name after a marker — the limit, pinned', async () => {
		// Not a feature: a boundary, asserted so it cannot move by accident. A second name
		// under one marker reads as covered and is not, which review caught in the first
		// note that tried it. The gate cannot tell a second cited name from an ordinary
		// quoted phrase, so `docs/README.md` states "one marker, one citation" instead.
		//
		// Green here is therefore the claim that the second name is IGNORED. Anyone making
		// the rule validate every quoted name has to come here and change this case, which
		// is the point — the limit is pinned, not merely described.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'`src/thing.ts` and `test/thing.test.ts`.',
				'',
				'**Checked by** `test/thing.test.ts` — "the thing works", and "a name no file holds".',
			].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts the marker NAMED in a code span, which is documentation not a citation', async () => {
		// `docs/README.md` documents the convention by naming the marker inline, and the
		// gate reported its own convention page as a malformed citation. Naming a thing is
		// not doing it — the same rule code spans already carry for wikilinks and paths.
		const files = baseRegister();
		// Keeps the hierarchy table: a register that documents no hierarchy is a different
		// failure, and this case is about citations.
		files['docs/README.md'] = `# docs\n\nA claim may carry a \`**Checked by**\` citation naming its test.\n\n${hierarchyTable()}`;

		await expectAccepted(files);
	});

	it('accepts a citation commented out in HTML, which renders as nothing', async () => {
		// A contributor parking a citation is writing something that does not render, so the
		// gate must not read it. Reported as a malformed citation before — a failure on a
		// correct document, which is the direction this project holds more expensive.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n<!-- **Checked by** `test/gone.test.ts` — "later" -->',
		});

		await expectAccepted(files);
	});

	it('accepts the marker shown literally with a backslash escape', async () => {
		// `\\**Checked by**` renders as text, not emphasis, so it is a document showing the
		// convention rather than using it. A text scan matched the asterisks anyway and
		// failed a correct document — the third construct to reach the marker scan that way,
		// after a code span and an HTML comment, and the one that made it a category.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\nWrite \\**Checked by** to cite a test.',
		});

		await expectAccepted(files);
	});

	it('accepts a cited name the test source had to escape', async () => {
		// A name is written in prose and read out of source. `doesn't retry` is spelled
		// `it('doesn\\'t retry', …)` because the delimiter forced an escape the register has
		// no reason to carry — so comparing only the literal form fails a citation that is
		// exactly right, and nobody would suspect the CHECK of it.
		const files = baseRegister();
		files['test/thing.test.ts'] = "it('doesn\\'t retry', () => {});\n";
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "doesn\'t retry".',
		});

		await expectAccepted(files);
	});

	it('accepts a protocol-relative destination, which is external', async () => {
		// `//cdn.example.com/x.md` borrows the page's scheme and names none of its own, so a
		// test for `scheme:` does not see one and the destination reads as a path — the gate
		// would look for a directory called `cdn.example.com` beneath the note.
		const files = baseRegister();
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\nSee [the guide](//cdn.example.com/guide.md).',
		});

		await expectAccepted(files);
	});

	it('accepts a cited name that itself contains a quote', async () => {
		// A test name may CONTAIN a quote — `test/view/board.test.ts` has one naming a state
		// `"constructor"` — and one character class for both ends stopped at the inner one,
		// captured a prefix, and reported a correct citation as stale. Curly outside,
		// straight inside; the pairs admit each other.
		const files = baseRegister();
		files['test/thing.test.ts'] = 'it(\'a state named "constructor"\', () => {});\n';
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — “a state named "constructor"”.',
		});

		await expectAccepted(files);
	});

	it('accepts a cited name whose repeated space is deliberate', async () => {
		// The inverse of the false pass fixed one commit earlier, and caused by that fix:
		// the source is no longer normalized, so collapsing every whitespace run in the
		// CITATION rejects a name reproduced exactly. Only the Markdown wrap is normalized.
		const files = baseRegister();
		files['test/thing.test.ts'] = "it('the  thing works', () => {});\n";
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: '`src/thing.ts` and `test/thing.test.ts`.\n\n**Checked by** `test/thing.test.ts` — "the  thing works".',
		});

		await expectAccepted(files);
	});

	it('accepts a **Checked by** example inside a fence, which is documentation not a citation', async () => {
		// `docs/README.md` documents the convention by showing it, naming a path that does
		// not exist on purpose. Fenced, so it is an example being quoted rather than a
		// reference being made — the same rule wikilinks and source paths already follow.
		const files = baseRegister();
		files['docs/README.md'] = [
			'# docs',
			'',
			'The register. Cite a check like this:',
			'',
			'```',
			'**Checked by** `test/nothing/here.test.ts` — "a name no file holds"',
			'```',
			'',
			hierarchyTable(),
		].join('\n');

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
		// The nested note is made **load-bearing**: it is the only note specifying
		// `src/board.ts`, so a `walk` that stopped recursing would leave that module
		// unspecified and this case would fail with `no use case or ADR specifies
		// src/board.ts`. Added
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

	it('lists a stale path or link in a record note instead of failing it', async () => {
		// `tasks/`, `issues/`, `bugs/` and `superpowers/` are records of a moment and may
		// name a file since split away, or a note since deleted — rewriting them would
		// falsify the record, and deleting a note is ordinary backlog work. Being listed is
		// the point: visible, not silently exempt. A LIVING note gets neither leniency —
		// `checkerRejects.test.ts` plants both directions there.
		const files = baseRegister();
		files['docs/tasks/Old work.md'] =
			note('Task', 10, 'Doing the thing', '# Old work\n\nTouched `src/gone.ts`, for [[A deleted note]].\n');
		files['docs/superpowers/plans/2026-08-02-example.md'] = '# A plan\n\nSee [[No such note]].\n';

		const result = await checkRegister(files);

		expect(result.problems).toEqual([]);
		expect(result.output).toContain('historical reference');
		expect(result.output).toContain('src/gone.ts');
		expect(result.output).toContain('[[A deleted note]]');
		expect(result.output).toContain('[[No such note]]');
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

	it('accepts a PRD or an SDD with no backlog frontmatter', async () => {
		// docs/prds/ and docs/sdds/ hold the requirements and design documents the register's
		// own epics are derived FROM — evidence kept verbatim, never a work item, so neither
		// carries a type or a rank.
		const files = baseRegister();
		files['docs/sdds/2026-08-02 Some target architecture.md'] = '# SDD — some architecture\n\nThe design.\n';
		// Verbatim means verbatim: a received document names notes and files from wherever it
		// was written, and this repository owes none of them a target. Checking those links
		// would force the one edit the rule exists to prevent.
		files['docs/prds/2026-08-04 A document naming other things.md'] =
			'# PRD — with links\n\nSee [[Customer Interview — ACME]] and [the appendix](appendix/none.md).\n';
		files['docs/prds/2026-08-02 Some product direction.md'] = '# PRD — some direction\n\nWhat was asked for.\n';
		// And one that arrived with frontmatter of its own: a document written elsewhere may
		// say `type: requirements` about itself, which is not this register's vocabulary and
		// must not be read as a backlog note that forgot its rank.
		files['docs/prds/2026-08-03 A document with its own metadata.md'] =
			'---\ntype: requirements\nauthor: Someone\n---\n\n# PRD — with metadata\n\nAs received.\n';

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

	it('accepts a module named in an ADR `## Decision`', async () => {
		// The arm for a module that is architecture rather than behaviour: no use case owns
		// `src/view/host.ts`, and ADR 0003 names it where the choice is made. The register
		// uses this form exactly once, which is precisely why nothing else would notice the
		// gate refusing it.
		const files = baseRegister();
		files['src/host.ts'] = 'export const host = 1;\n';
		files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision').replace(
			'## Decision\n\nSomething.',
			'## Decision\n\nThe layers reach each other through `src/host.ts`.',
		);

		await expectAccepted(files);
	});

	it('accepts a module named anywhere in a `## Where it lives`, not only on its first line', async () => {
		// The section is read to its end — the next `## ` heading, or the end of the note,
		// since `## Where it lives` is a use case's last section. Real ones carry prose after
		// the paths (this rule's own note explains there which module is deliberately absent),
		// and a slice that stopped at the first line or the first blank would drop it.
		const files = baseRegister();
		files['src/late.ts'] = 'export const late = 1;\n';
		files['docs/requirements/Doing the thing.md'] = useCase({
			whereItLives: [
				'Lives in `src/thing.ts`, covered by `test/thing.test.ts`.',
				'',
				'**And a paragraph about what is not here**, because the section is prose too:',
				'the late half of it also names `src/late.ts`.',
			].join('\n'),
		});

		await expectAccepted(files);
	});

	it('accepts a test file no note names', async () => {
		// `src/` still has to be specified: a module nothing specifies is a capability
		// nobody asked for. A test file is not — the rule it was held to only ever asserted
		// that a path token appears somewhere under `docs/`, which is satisfiable by
		// mentioning the file and describing nothing, so it bought a register edit per test
		// file and nothing else. Tightening what counts for `src/` does not bring it back.
		const files = baseRegister();
		files['test/unnamed.test.ts'] = 'export const spec = 1;\n';

		await expectAccepted(files);
	});
	it('accepts a note whose title ends in a dot before the extension', async () => {
		// `A trailing thought..md` ends in `d`. Windows holds it happily, and git checks it
		// out on every platform — but a rule that strips `.md` to find a "stem" sees a
		// trailing dot and rejects it. That rule shipped, with a rejection case asserting the
		// false positive was correct, so the gate refused a legal name and the suite agreed.
		// The check reads the directory entry as it sits on disk, extension included.
		const files = baseRegister();
		files['docs/issues/A trailing thought..md'] = note(
			'Issue',
			20,
			'Thing',
			'# A trailing thought\n\n## The decision\n\nWe did it.\n',
		);

		await expectAccepted(files);
	});
	it('accepts a Test case carrying `## How to check` and a `cadence:`', async () => {
		// The sweep now reads `docs/tests/cases/` instead of `docs/issues/` — a re-point, not
		// an addition — while the gate below stays type-scoped rather than folder-scoped; see
		// the comment on `SWEPT_TYPES` in `docs-check.mjs`. order: 20 for the suite, not 10:
		// a `Test suite` is a root exactly like an `Epic`, and root order is scoped by parent
		// (`null` for every root regardless of type), so 10 would collide with `Thing`, the
		// root `baseRegister()` already has at that order.
		const files = baseRegister();
		files['docs/tests/suites/Smoke test the tree.md'] =
			'---\ntype: Test suite\norder: 20\nstatus: Open\n---\n\n# Smoke test the tree\n\nA suite.\n';
		files['docs/tests/cases/Look at the thing.md'] =
			'---\ntype: Test case\nparent: "[[Smoke test the tree]]"\norder: 10\nstatus: Open\ncadence: release\n---\n\n# Look at the thing\n\n## How to check\n\nOpen it.\n';

		await expectAccepted(files);
	});
	it('accepts an Issue that is not a verification and says nothing about cadence', async () => {
		// Most of `docs/issues/` is this: decisions and limitations, no `## How to check`,
		// no `cadence:`. The biconditional has to leave them alone, or the gate added for
		// the release sweep would fail the majority of the folder it was written for.
		const files = baseRegister();
		files['docs/issues/A thing we decided.md'] = note(
			'Issue',
			20,
			'Thing',
			'# A thing we decided\n\n## The decision\n\nWe did it this way.\n',
		);

		await expectAccepted(files);
	});
	it('accepts `## How to check, properly` in a note about a gate, which no device can run', async () => {
		// The real note this protects is an investigation into a CI gate that never ran.
		// A prefix match would sweep it into a checklist of things to do in a live vault,
		// and then demand a `cadence:` of a note that has no business carrying one — so
		// this case fails in BOTH directions if the matcher stops being whole-line.
		const files = baseRegister();
		files['docs/issues/A gate that did not run.md'] = note(
			'Issue',
			20,
			'Thing',
			'# A gate that did not run\n\n## The failure mode\n\nIt passed.\n\n## How to check, properly\n\nRun it.\n',
		);

		await expectAccepted(files);
	});
	it('accepts an Absence, which the plugin writes into this very folder and is not a work item', async () => {
		// `docs/` is a vault this plugin is pointed at, so pressing Add absence on a
		// resource row writes one of these HERE. An absence has no parent, no rank, no
		// status and no ladder rung on purpose (ADR 0028), so every backlog rule the gate
		// has would fail one — and it did, until 2026-08-14: three of them in
		// `docs/absences/` turned `npm run check` red with fifteen problems for a feature
		// working exactly as specified.
		//
		// Written with none of the fields `note()` supplies, because that is the shape
		// `createAbsenceNote` actually produces — a case built from the helper would pass
		// on frontmatter no absence carries.
		const files = baseRegister();
		files['docs/absences/Away.md'] =
			'---\ntype: Absence\nassignee: Alice\nstart: 2026-08-04\ndue: 2026-08-06\n---\n\n# Away\n';

		await expectAccepted(files);
	});
	it('accepts a note whose status is Dropped', async () => {
		// A refused design stays in the tree rather than being deleted, so the gate has
		// to accept the status that says so. `docs/Product Backlog.base` already
		// declares Dropped a done value, so the config knew this word before the
		// checker did.
		const files = baseRegister();
		files['docs/requirements/Refused.md'] = useCase({
			title: 'Refused',
			order: 90,
			parent: 'A slice',
		}).replace('status: Open', 'status: Dropped');

		await expectAccepted(files);
	});

	it('accepts an Absence wherever it is filed, since its folder is a user setting', async () => {
		// Exempted by TYPE, not by path: `Folder for Absence items` is configuration this
		// checker cannot see, so a `docs/absences/` rule would be the gate guessing one.
		const files = baseRegister();
		files['docs/requirements/Alice is away.md'] =
			'---\ntype: Absence\nassignee: Alice\nstart: 2026-08-04\ndue: 2026-08-06\n---\n\n# Alice is away\n';

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
