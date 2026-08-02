import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { note, runRejections, useCase } from '../helpers/register';

/**
 * **Does an invalid document fail?**
 *
 * This is the direction `docs-check.mjs` was built in — every rule in it was verified by
 * planting the violation and watching the check reject it, and that method found two
 * dozen holes. What it never had was a corpus that re-runs: the planting was done by hand
 * and recorded in prose, so each tightening re-derived the evidence or did without it.
 *
 * These are those plantings, executable. Each case is **one edit** to the valid corpus in
 * `checkerAccepts.test.ts`, so a failure names a rule rather than a document. The ADR
 * rules are the sibling file; the accept direction is `checkerAccepts.test.ts`, and none
 * of the three is worth much alone.
 *
 * **The guarantee, stated exactly.** Every place the gate can report a problem has at
 * least one planted case across the two rejection files, so a rule deleted from
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
			'a parent/child pair the hierarchy does not allow',
			(files) => {
				files['docs/tasks/Straight to the epic.md'] = note('Task', 20, 'Thing', '# Straight to the epic\n\nWork.\n');
			},
			'Task under Epic is not a legal pair',
		],
		[
			'a root that is not an Epic',
			(files) => {
				files['docs/requirements/A slice.md'] = note('Feature', 10, null, '# A slice\n\n**Outcome** — it works.\n');
			},
			'Feature with no parent — only Epic or Milestone can be a root',
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
			'a PBI with no parent — only an Epic or a Milestone can be a root',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({ parent: null });
			},
			'PBI with no parent — only Epic or Milestone can be a root',
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
			'a module no note names',
			(files) => {
				files['src/orphan.ts'] = 'export const orphan = 1;\n';
			},
			'no note names src/orphan.ts',
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

describe('the corpus covers every rule', () => {
	it('is built against every place the gate can report a problem', async () => {
		// The two rejection files were written by enumerating the gate's report sites and
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
		const source = await readFile('docs-check.mjs', 'utf8');
		const sites = source.match(/\bfail\(/g) ?? [];

		expect(sites.length).toBe(43);
	});
});
