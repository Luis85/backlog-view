import { describe, expect, it } from 'vitest';
import { adr, baseRegister, checkRegister, note, useCase } from '../helpers/register';
import type { Register } from '../helpers/register';

/**
 * **Does an invalid document fail?**
 *
 * This is the direction `docs-check.mjs` was built in — every rule in it was verified by
 * planting the violation and watching the check reject it, and that method found two
 * dozen holes. What it never had was a corpus that re-runs: the planting was done by hand
 * and recorded in prose, so each tightening re-derived the evidence or did without it.
 *
 * These are those plantings, executable. Each case is **one edit** to the valid corpus in
 * `checkerAccepts.test.ts`, so a failure names a rule rather than a document, and a rule
 * quietly removed from the gate fails here instead of going unnoticed until the register
 * drifts. The accept direction lives in the sibling file, and neither is worth much
 * alone.
 */

type Case = [name: string, plant: (files: Register) => void, expected: string];

async function problemsFor(files: Register): Promise<string> {
	const result = await checkRegister(files);
	// A planted violation that produced a green run is the failure this file exists to
	// catch, and it should say so before the message assertion reports "" instead.
	expect(result.ok, `expected the gate to reject this document, but it passed`).toBe(false);
	return result.problems.join('\n');
}

function run(cases: Case[]): void {
	it.each(cases)('reports %s', async (_name, plant, expected) => {
		const files = baseRegister();
		plant(files);
		expect(await problemsFor(files)).toContain(expected);
	});
}

describe('the backlog tree', () => {
	run([
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
			'Feature with no parent — only an Epic is a root',
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
	]);
});

describe('cross-references', () => {
	run([
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
	run([
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
			'extensions out of step order',
			(files) => {
				files['docs/requirements/Doing the thing.md'] = useCase({
					extensions: '- **2b — the second** — because.\n- **2a — the first** — because.',
				});
			},
			'extensions are not in step order',
		],
	]);
});

describe('ADRs', () => {
	run([
		[
			'an ADR missing one of its frontmatter fields',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = files['docs/adrs/0001-the-first-decision.md'].replace(
					'area: tooling\n',
					'',
				);
			},
			'ADR has no area',
		],
		[
			'a date that is not YYYY-MM-DD',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { date: 'August 2026' });
			},
			'date is not YYYY-MM-DD',
		],
		[
			'a heading that merely starts with the required one',
			(files) => {
				// `## Contextual` satisfied `## Context` under a line-start anchor alone —
				// the same prefix hole as `showCounts` vouching for `showCount`.
				files['docs/adrs/0001-the-first-decision.md'] = files['docs/adrs/0001-the-first-decision.md'].replace(
					'## Context',
					'## Contextual',
				);
			},
			'ADR has no ## Context',
		],
		[
			'ADR sections in the wrong order',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = files['docs/adrs/0001-the-first-decision.md']
					.replace('## Context\n\nSomething.\n\n## Decision\n\nSomething.\n', '## Decision\n\nSomething.\n\n## Context\n\nSomething.\n');
			},
			'ADR has ## Decision before ## Context',
		],
		[
			'a gap in the ADR numbering',
			(files) => {
				files['docs/adrs/0003-the-third-decision.md'] = adr(3, 'the-third-decision');
				files['docs/adrs/README.md'] += '- [0003](0003-the-third-decision.md)\n';
			},
			'no ADR 0002 — numbering has a gap',
		],
		[
			'a record the index does not list',
			(files) => {
				files['docs/adrs/README.md'] = '# ADRs\n\nNothing here yet.\n';
			},
			'does not list 0001-the-first-decision.md',
		],
		[
			'a filename that does not look like an ADR, which must be reported not skipped',
			(files) => {
				// Filtering on `NNNN-` would let a malformed name opt out of every check
				// below by failing to look like one.
				files['docs/adrs/thoughts.md'] = adr(2, 'thoughts');
				files['docs/adrs/README.md'] += '- [thoughts](thoughts.md)\n';
			},
			'ADR filename is not `NNNN-slug.md`',
		],
		[
			'a supersession chain declared from one end only',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', {
					status: 'Superseded',
					'superseded-by': '2',
				});
				files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision');
				files['docs/adrs/README.md'] += '- [0002](0002-the-second-decision.md)\n';
			},
			'but ADR 2 does not say supersedes: 1',
		],
		[
			'a chain whose arrow points the wrong way through time',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { supersedes: '2' });
				files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision', {
					status: 'Superseded',
					'superseded-by': '1',
				});
				files['docs/adrs/README.md'] += '- [0002](0002-the-second-decision.md)\n';
			},
			'a record is replaced by a later ADR',
		],
		[
			'a record that names a successor while still reading as current',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { 'superseded-by': '2' });
				files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision', { supersedes: '1' });
				files['docs/adrs/README.md'] += '- [0002](0002-the-second-decision.md)\n';
			},
			'names superseded-by but its status is "Accepted", not Superseded',
		],
	]);

	it('reports a bare `parent:` on an ADR, which has a value to no parser but a key to every one', async () => {
		// The divergence class in `The checker reads frontmatter its own way`, pinned as a
		// test rather than as a paragraph. `resolveParent` reads a bare `parent:` as an
		// explicit root — enrolling the ADR in the plugin's own backlog exactly as a filled
		// one would — while a reader that wants a *value* reports it as absent. The
		// prohibition is on the key being there at all, so the key is what is tested, and
		// this is the form that needs no typo: a template, or an abandoned edit.
		const files = baseRegister();
		files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { parent: '' });

		const result = await checkRegister(files);

		// Exactly one problem: the mutation is one line, and nothing else may notice it.
		expect(result.problems).toEqual([
			'docs/adrs/0001-the-first-decision.md: ADR carries a `parent` — an ADR is not a work item',
		]);
	});
});
