import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { adr, note, runRejections, useCase } from '../helpers/register';

/**
 * **Does an invalid document fail?**
 *
 * This is the direction `docs-check.mjs` was built in — every rule in it was verified by
 * planting the violation and watching the check reject it, and that method found two
 * dozen holes. What it never had was a corpus that re-runs: the planting was done by hand
 * and recorded in prose, so each tightening re-derived the evidence or did without it.
 *
 * These are those plantings, executable. Each case is **one edit** to the valid corpus in
 * `checkerAccepts.test.ts`, so a failure names a rule rather than a document. Three
 * sibling files hold the groups that outgrew this one — the ADR rules, the `**Checked
 * by**` citations, and the hierarchy table against `LEGAL_CHILDREN`; the accept direction
 * is `checkerAccepts.test.ts`, and none of the five is worth much alone.
 *
 * **The guarantee, stated exactly.** Every place the gate can report a problem has at
 * least one planted case across the four rejection files, so a rule deleted from
 * `docs-check.mjs` turns one of them red.
 *
 * That was **measured, not read**: each of the 45 report sites was neutered in turn and
 * the suite went red for every one. Worth knowing that the first two attempts at that
 * measurement were themselves wrong — one used `\b` in an awk regex (a backspace, not a
 * word boundary), so no mutation ever landed and every site looked uncovered; the other
 * would have had the count test below failing on every mutation, so every site would have
 * looked covered. Both were caught by asking what a broken run would print, which is the
 * check `checkerAccepts.test.ts` now tells contributors to apply to a case.
 *
 * The sweep is a one-off and does not re-run. What re-runs is the count at the end of
 * this file: a new rule moves it and the suite goes red until somebody plants a case.
 *
 * What it does **not** claim: that every *input* reaching a rule is covered. One case per
 * site proves the rule exists and fires; it does not prove the rule is right about every
 * document, and enumerating those is the trap this checker keeps falling into.
 */

describe('the backlog tree', () => {
	runRejections([
		[
			'two siblings holding the same rank',
			(files) => {
				files['docs/requirements/Another slice.md'] = note('Feature', 10, 'Thing', '# Another slice\n\nMore.\n');
			},
			'order 10 is already taken by "A slice"',
		],
		[
			'a note with no rank at all',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace('order: 10\n', '');
			},
			'backlog note has no `order`',
		],
		[
			'a rank that is not a number',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Epic', 'soon', null, '# Thing\n\nWhy.\n');
			},
			'order "soon" is not a number',
		],
		[
			'a missing status',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace('status: Open\n', '');
			},
			'backlog note has no `status`',
		],
		[
			'a status outside the register vocabulary',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace('Open', 'Started');
			},
			'status "Started" is not one of',
		],
		[
			'a note that has silently fallen out of the register',
			(files) => {
				// No type, and not an ADR or an index page — the failure mode a skip hides best.
				files['docs/requirements/Adrift.md'] = '---\norder: 90\nstatus: Open\n---\n\n# Adrift\n';
			},
			'backlog note has no `type` in its frontmatter',
		],
		[
			'a type the vocabulary does not have',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Spike', 10, null, '# Thing\n\nWhy.\n');
			},
			'unknown type "Spike"',
		],
		[
			// The same prototype hazard at the OLDER call site: a note declaring
			// `type: toString` read the inherited function as its rule and slipped past
			// `unknown type` entirely, for as long as this table has been a plain object.
			'a note typed after an Object.prototype member',
			(files) => {
				files['docs/issues/Odd.md'] = note('toString', 20, 'Thing', '# Odd\n\n## The decision\n\nWe did it.\n');
			},
			'unknown type "toString"',
		],
		[
			'a parent/child pair the hierarchy does not allow',
			(files) => {
				files['docs/tasks/Straight to the epic.md'] = note('Task', 20, 'Thing', '# Straight to the epic\n\nWork.\n');
			},
			'Task under Epic is not a legal pair',
		],
		[
			// The extra types are one set repeated at each rung, so a Deliverable is legal
			// wherever an Issue or a Bug is and illegal wherever they are — under a Task,
			// which is the deepest level and holds nothing at all.
			'a Deliverable under a Task, which holds nothing',
			(files) => {
				files['docs/tasks/The work.md'] = note('Task', 10, 'Doing the thing', '# The work\n\nWork.\n');
				files['docs/deliverables/The handout.md'] = note('Deliverable', 10, 'The work', '# The handout\n\nA thing.\n');
			},
			'Deliverable under Task is not a legal pair',
		],
		[
			'a root that is not an Epic',
			(files) => {
				files['docs/requirements/A slice.md'] = note('Feature', 10, null, '# A slice\n\n**Outcome** — it works.\n');
			},
			'Feature with no parent — only Epic, Milestone, Test suite, Iteration or Release can be a root',
		],
		[
			// A marker holds nothing, so a child under one is exactly as wrong as a Task under
			// an Epic — and the register is the plugin's own schema, so a wrong parent here is
			// a bug in the example.
			'Task under Milestone is not a legal pair',
			(files) => {
				files['docs/milestones/Ship 1.0.md'] = note('Milestone', 60, null, '# Ship 1.0\n\nThe date.\n');
				files['docs/tasks/Prep the launch.md'] = note('Task', 10, 'Ship 1.0', '# Prep the launch\n\nWork.\n');
			},
			'Task under Milestone is not a legal pair',
		],
		[
			'a PBI with no parent — a rung below the top is never a root',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ parent: null });
			},
			'PBI with no parent — only Epic, Milestone, Test suite, Iteration or Release can be a root',
		],
		[
			'a parent link naming a note that does not exist',
			(files) => {
				files['docs/requirements/A slice.md'] = note('Feature', 10, 'Nowhere', '# A slice\n\n**Outcome** — ok.\n');
			},
			'parent [[Nowhere]] does not exist',
		],
		[
			'one basename in two folders, which makes every wikilink to it ambiguous',
			(files) => {
				files['docs/issues/A slice.md'] = note('Issue', 20, 'Thing', '# A slice\n\n## The decision\n\nTaken.\n');
			},
			'basename is already used by',
		],
		[
			'a backlog note nested under a folder that merely contains the word superpowers',
			(files) => {
				// The exemption is anchored to the docs/ root, not a bare `superpowers[/\\].*`
				// regex — a coincidental `docs/requirements/superpowers/` must still be a
				// work item, since `walk` descends into it exactly like any other directory.
				files['docs/requirements/superpowers/Adrift.md'] = '---\norder: 90\nstatus: Open\n---\n\n# Adrift\n';
			},
			'backlog note has no `type` in its frontmatter',
		],
		[
			'a product playbook whose wikilink names nothing',
			(files) => {
				// The whole point of exempting `product/` in SOURCE_DOCS rather than in
				// RECEIVED_DOCS: that second list carries a LINK exemption as well, and a
				// playbook is written here, so its links are owed a target exactly like
				// `superpowers/`'s. The first version of the fix put it on the wrong list and
				// this case is what proves it stayed off. (Codex, PR #229.)
				files['docs/product/A playbook.md'] = '# A playbook\n\nFollow [[No Such Note]] first.\n';
			},
			'unresolved wikilink',
		],
		[
			'a superpowers doc sharing a basename with a backlog note',
			(files) => {
				// Exempt from carrying a `type`, never from claiming a name: it is still
				// ordinary prose a `[[wikilink]]` can point at.
				files['docs/superpowers/plans/A slice.md'] = '# A slice\n\nA plan, not the feature.\n';
			},
			'basename is already used by',
		],
	]);
});

describe('cross-references', () => {
	runRejections([
		[
			'a wikilink that resolves to nothing',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Epic', 10, null, '# Thing\n\nSee [[Ghost]].\n');
			},
			'unresolved wikilink [[Ghost]]',
		],
		[
			// The leniency is for RECORDS — `tasks/`, `issues/`, `bugs/`, `superpowers/` —
			// named as themselves rather than as everything outside a living list. Spelled
			// the other way round it was the DEFAULT, and the register's own index, its
			// releases and its resources were all exempt by omission. These two cases are
			// the strict side of that: a folder nobody classified is checked.
			'a dead link in the register index',
			(files) => {
				files['docs/README.md'] += '\nSee [[Ghost]].\n';
			},
			'unresolved wikilink [[Ghost]]',
		],
		[
			'a dead source path in the register index',
			(files) => {
				files['docs/README.md'] += '\nThe view is `src/gone.ts`.\n';
			},
			'names src/gone.ts, which does not exist',
		],
		[
			'a relative link that resolves to nothing',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Epic', 10, null, '# Thing\n\n[gone](<No such note.md>)\n');
			},
			'links No such note.md, which does not exist',
		],
		[
			'a requirement naming a module that does not exist',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					whereItLives: 'Lives in `src/gone.ts`, covered by `test/thing.test.ts`. Also `src/thing.ts`.',
				});
			},
			'names src/gone.ts, which does not exist',
		],
		[
			// The regression this case exists for: `docs/tests/suites/` moved out of
			// `docs/requirements/` in the test-catalog migration and was not added to
			// `LIVING`, so a suite's source-path citations silently stopped being checked —
			// the same shape as the cadence gate this migration went to lengths to keep
			// live, reintroduced through a different rule.
			'a test suite naming a source file that does not exist',
			(files) => {
				files['docs/tests/suites/Smoke test the tree.md'] =
					'---\ntype: Test suite\norder: 20\nstatus: Open\n---\n\n# Smoke test the tree\n\nCovers `test/view/gone.test.ts`.\n';
			},
			'names test/view/gone.test.ts, which does not exist',
		],
		[
			// An embedded image is a reference like any other, and the pattern this rule
			// used to be caught it only because `](` appears in `![alt](src)` as well.
			'an embedded image whose file does not exist',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Epic', 10, null, '# Thing\n\n![diagram](assets/gone.svg)\n');
			},
			'links assets/gone.svg, which does not exist',
		],
		[
			// A reference-style link keeps its destination on the definition, so neither the
			// parser filter nor the `](` scan before it ever looked at one — a gap the
			// register has no instance of, which is what kept it invisible.
			'a reference-style link whose definition points at nothing',
			(files) => {
				files['docs/requirements/Thing.md'] = note('Epic', 10, null, '# Thing\n\n[guide][g]\n\n[g]: <No such note.md>\n');
			},
			'links No such note.md, which does not exist',
		],
		[
			'a module no use case and no ADR specifies',
			(files) => {
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
			},
			'no use case or ADR specifies src/orphan.ts',
		],
		[
			'a module named by a use case outside its `## Where it lives`',
			(files) => {
				// The satisfaction the old rule accepted and this one does not: a path token
				// somewhere under `docs/`. A criterion is a claim about behaviour, not a
				// statement of where the behaviour lives.
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
				files['docs/requirements/Doing the thing.md'] = useCase().replace(
					'- It happens.',
					'- It happens, in `src/orphan.ts`.',
				);
			},
			'no use case or ADR specifies src/orphan.ts',
		],
		[
			'a module named only by an ADR `## Context`',
			(files) => {
				// The direction nobody would check. `## Context` and `## Alternatives` exist to
				// describe what was **considered and rejected**, so a path there is evidence a
				// module was discussed — which is the mention-only satisfaction this rule
				// exists to stop. Accepting a path anywhere in an ADR would keep the loophole
				// open for exactly the notes least likely to be read as specifications.
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision').replace(
					'## Context\n\nSomething.',
					'## Context\n\nWe weighed `src/orphan.ts` and went the other way.',
				);
			},
			'no use case or ADR specifies src/orphan.ts',
		],
		[
			'a module named only by an ADR `## Consequences`',
			(files) => {
				// The other end of `## Decision`, and the one nothing else pins. `## Context`
				// comes BEFORE it, so every case above stays red under a `sectionBody` that
				// reads the decision to the end of the note — the mutation that widens
				// acceptance is invisible to a case planted on the near side. A section that
				// FOLLOWS `## Decision` is what asks whether the slice stops where it says.
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision').replace(
					'## Consequences\n\nSomething.',
					'## Consequences\n\nWhat it cost: `src/orphan.ts` now has two callers.',
				);
			},
			'no use case or ADR specifies src/orphan.ts',
		],
		[
			'a module named only by a record note',
			(files) => {
				// A `Task`, `Issue` or `Bug` is a record of a moment rather than a
				// specification — and those notes are explicitly allowed to name paths that
				// have since moved, so a rule satisfied by one is satisfied by history.
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
				files['docs/tasks/Some work.md'] = note('Task', 10, 'Doing the thing', '# Some work\n\nTouched `src/orphan.ts`.\n');
			},
			'no use case or ADR specifies src/orphan.ts',
		],
	]);
});

describe('the use-case shape', () => {
	runRejections([
		[
			'a use case missing one of its sections',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase().replace('## Where it lives', '## Somewhere else');
			},
			'use case has no ## Where it lives',
		],
		[
			'a section that appears twice, which is what a merge of two conversions leaves',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase().replace(
					'## Acceptance criteria',
					'## Use case\n\nAgain, differently.\n\n## Acceptance criteria',
				);
			},
			'use case has 2 ## Use case sections, expected one',
		],
		[
			'sections in the wrong order',
			(files) => {
				const text = useCase();
				const criteria = '## Acceptance criteria\n\n- It happens.\n\n';
				const lives = '## Where it lives\n\nLives in `src/thing.ts`, covered by `test/thing.test.ts`.';
				files['docs/requirements/Doing the thing.md'] = text.replace(criteria + lives, lives + '\n\n' + criteria);
			},
			'use case has ## Where it lives before ## Acceptance criteria',
		],
		[
			'a use-case table missing one of its four fields',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase().replace(
					'| **Guarantee** | Nothing is written that cannot be taken back |\n',
					'',
				);
			},
			'use-case table has no | **Guarantee** | row',
		],
		[
			'a field marker that sits in the right place without being a row',
			(files) => {
				// Ordering constrains where a marker sits and not what it is. This one
				// satisfies every position rule and is a row of nothing.
				files['docs/requirements/Doing the thing.md'] = useCase().replace(
					'| **Guarantee** | Nothing is written that cannot be taken back |',
					'| **Guarantee** |',
				);
			},
			'use-case table has no | **Guarantee** | row',
		],
		[
			'an opening that never says what the actor wants',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ opening: '**As** a user, this should work.' });
			},
			'use case has no `**As** … **I want** … **so that** …` opening',
		],
		[
			'an extension bullet with no label',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ extensions: '- it just does not happen.' });
			},
			'extension is not labelled',
		],
		[
			'an extension departing from a step the main flow does not have',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ extensions: '- **9a — from nowhere** — because.' });
			},
			'extension 9a departs from step 9, which the main flow does not have',
		],
		[
			'an **Extensions** block that cannot be read at all',
			(files) => {
				// A parser that gives up quietly is the same failure as a filter standing in
				// for a check: every rule below the block would be skipped on a note that
				// still has the heading three lines up. So it is loud instead.
				files['docs/requirements/Doing the thing.md'] = useCase().replace(
					'**Extensions**\n',
					'**Extensions** — none worth stating.\n',
				);
			},
			'**Extensions** block could not be parsed',
		],
		[
			'an **Extensions** block that parses but holds no bullets',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ extensions: 'None worth stating.' });
			},
			'**Extensions** has no bullets',
		],
		[
			'a main flow with no numbered steps for extensions to depart from',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					mainFlow: '- They ask for it.\n- It happens.',
				});
			},
			'main flow has no numbered steps',
		],
	]);
});

/**
 * The sweep in `RELEASING.md` finds its checklist by querying `docs/tests/cases/`, so these
 * three are the only shape rules an `Issue` OR a `Test case` has — the guard widened to
 * both types with the test catalog migration, and stays type-scoped rather than
 * folder-scoped. The gate deliberately does not enforce the section shapes `docs/README.md`
 * documents — see the comment on `CADENCES` in `docs-check.mjs` — so there are no cases here
 * for those, and their absence is the rule.
 */
describe('a verification and its cadence', () => {
	const verification = (body: string, cadence?: string) => {
		const text = note('Issue', 20, 'Thing', body);
		return cadence === undefined ? text : text.replace('status: Open', `status: Open\ncadence: ${cadence}`);
	};

	runRejections([
		[
			'a note the sweep would find, leaving its cadence to be guessed',
			(files) => {
				files['docs/issues/Look at the thing.md'] = verification('# Look at the thing\n\n## How to check\n\nOpen it.\n');
			},
			'carries `## How to check` but no `cadence:`',
		],
		[
			'a note declaring a cadence the query will never reach — the drift that started this',
			(files) => {
				// Exactly the three notes that were headed `## What to look at`: marked as a
				// verification, and invisible to the sweep that is supposed to run it.
				files['docs/issues/Look at the thing.md'] = verification(
					'# Look at the thing\n\n## What to look at\n\nOpen it.\n',
					'release',
				);
			},
			"has no `## How to check` heading — the sweep's query will never find it",
		],
		[
			'a cadence outside the two the release sweep reads',
			(files) => {
				files['docs/issues/Look at the thing.md'] = verification(
					'# Look at the thing\n\n## How to check\n\nOpen it.\n',
					'sometimes',
				);
			},
			'cadence "sometimes" is not one of',
		],
		[
			'a Test case the sweep would find, leaving its cadence to be guessed',
			(files) => {
				// order: 20, not 10 — a Test suite is a root exactly like an Epic (both are in
				// `ROOT_TYPES`), and sibling order is scoped by parent, which is `null` for every
				// root regardless of type. `baseRegister()` already has a root at order 10
				// (`Thing`), so 10 here would collide on that unrelated rule and mask the one this
				// case exists to exercise.
				files['docs/tests/suites/Smoke test the tree.md'] =
					'---\ntype: Test suite\norder: 20\nstatus: Open\n---\n\n# Smoke test the tree\n\nA suite.\n';
				files['docs/tests/cases/Look at the thing.md'] =
					'---\ntype: Test case\nparent: "[[Smoke test the tree]]"\norder: 10\nstatus: Open\n---\n\n# Look at the thing\n\n## How to check\n\nOpen it.\n';
			},
			'carries `## How to check` but no `cadence:`',
		],
	]);
});

/**
 * **Skipped on Windows, and the reason is the rule.** Each case plants a filename Windows
 * cannot represent, so on Windows the *planting* fails rather than the gate — the harness
 * would be blocked by exactly the constraint being checked. The rule is platform-neutral
 * (it reads a string), so Linux and macOS runs cover it and the count test below pins the
 * sites on every platform.
 *
 * This gate exists because CI already caught one of these the expensive way: a note titled
 * with double quotes failed `git checkout` on the Windows job, before any build step, so
 * the tree could not be cloned and nothing in `docs-check.mjs` ever ran.
 */
describe.skipIf(process.platform === 'win32')('a filename Windows cannot check out', () => {
	runRejections([
		[
			'a note whose prose title contains a double quote',
			(files) => {
				files['docs/issues/A note about "a quoted phrase".md'] = note(
					'Issue',
					20,
					'Thing',
					'# A note about a quoted phrase\n\n## The decision\n\nWe did it.\n',
				);
			},
			'which Windows forbids',
		],
		[
			// The one in the forbidden set that is an ordinary character everywhere else: a
			// name holding a backslash commits cleanly from Linux and is unrepresentable on
			// Windows. The rule reads `entry.name`, so the separator on a Windows run is not
			// in what it tests — checking the joined path would flag every entry in the tree.
			'a note whose name holds a backslash, which only Windows reads as a separator',
			(files) => {
				files['docs/issues/A\\B.md'] = note('Issue', 20, 'Thing', '# A B\n\n## The decision\n\nWe did it.\n');
			},
			'which Windows forbids',
		],
		[
			// A tab is a byte like any other in a POSIX name, so this commits and pushes
			// from Linux without anything objecting, and Windows cannot represent any of
			// 0-31. The literal below really does hold one.
			'a note whose name holds a control character',
			(files) => {
				files['docs/issues/A\tB.md'] = note('Issue', 20, 'Thing', '# A B\n\n## The decision\n\nWe did it.\n');
			},
			'holds a control character',
		],
		[
			'a note named after a reserved device',
			(files) => {
				files['docs/issues/NUL.md'] = note('Issue', 20, 'Thing', '# NUL\n\n## The decision\n\nWe did it.\n');
			},
			'reserved device name on Windows',
		],
		[
			// The name Windows actually refuses, which is NOT a `.md` file — so a check
			// running over the walk's results could never have seen it. The first version of
			// this case planted `A trailing thought..md` instead, which is a perfectly legal
			// Windows name ending in `d`, and passed against a rule that was reading a
			// stripped stem. It asserted a false positive and read like a check.
			'a directory entry whose name ends in a dot',
			(files) => {
				files['docs/issues/A trailing thought.md.'] = 'Not a note, and not a name Windows can hold.\n';
			},
			'ends in a space or a dot',
		],
	]);
});

describe('the corpus covers every rule', () => {
	it('is built against every place the gate can report a problem', async () => {
		// The rejection files were written by enumerating the gate's report sites and
		// planting one violation per site. That mapping is hand-made and would rot the
		// moment a rule was added — the exact drift this register removed hand-maintained
		// counts to avoid — so it is pinned rather than described. A new `fail(` moves this
		// number and the run goes red until someone plants a case for it, or raises it
		// knowingly.
		//
		// A count over source is a crude instrument and deliberately so: its failure mode
		// is a false ALARM that makes somebody look, never a false pass. It is the one
		// direction in which regex-over-source is safe, which is why this is not the thing
		// `docs/README.md` warns about.
		const source = await readFile('scripts/docs-check.mjs', 'utf8');
		const sites = source.match(/\bfail\(/g) ?? [];

		expect(sites.length).toBe(65);
	});
});
