import { describe, expect, it } from 'vitest';
import { adr, baseRegister, checkRegister, runRejections } from '../helpers/register';

/**
 * **Planted violations: the ADR rules.**
 *
 * Split from `checkerRejects.test.ts` by subject, because the ADR rules alone outnumber
 * every other group in the gate — frontmatter completeness and vocabulary, the filename
 * and numbering contract, the index, and the supersession chain with its four separate
 * ways of rotting.
 *
 * The chain is why this is worth covering exhaustively rather than representatively. A
 * half-declared supersession leaves the *predecessor* reading as current, which is the
 * failure mode that costs a reader years later — and every one of `exists`, `reciprocity`,
 * `direction`, `self-reference` and `status agreement` is a separate predicate that can be
 * removed on its own.
 */

describe('ADR frontmatter', () => {
	runRejections([
		[
			'an ADR with no frontmatter at all',
			(files) => {
				files['docs/adrs/0002-a-bare-file.md'] = '# A bare file\n\nNo frontmatter.\n';
				files['docs/adrs/README.md'] += '- [0002](0002-a-bare-file.md)\n';
			},
			'ADR has no frontmatter',
		],
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
			'a status outside the ADR vocabulary',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { status: 'Draft' });
			},
			'status "Draft" is not one of',
		],
		[
			'an area outside the ADR vocabulary',
			(files) => {
				// The rule that had no planted case: every fixture used `area: tooling`, and so
				// does every record in the real register, so removing the check left both this
				// suite and `npm run docs` green.
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { area: 'vibes' });
			},
			'area "vibes" is not one of',
		],
		[
			'a date that is not YYYY-MM-DD',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { date: 'August 2026' });
			},
			'date is not YYYY-MM-DD',
		],
	]);
});

describe('ADR sections', () => {
	runRejections([
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
				files['docs/adrs/0001-the-first-decision.md'] = files['docs/adrs/0001-the-first-decision.md'].replace(
					'## Context\n\nSomething.\n\n## Decision\n\nSomething.\n',
					'## Decision\n\nSomething.\n\n## Context\n\nSomething.\n',
				);
			},
			'ADR has ## Decision before ## Context',
		],
	]);
});

describe('ADR numbering and the index', () => {
	runRejections([
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
			'a number that is not a number',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { adr: 'one' });
			},
			'adr: "one" is not a number',
		],
		[
			'a number already used by another record',
			(files) => {
				files['docs/adrs/0002-the-second-decision.md'] = adr(1, 'the-second-decision');
				files['docs/adrs/README.md'] += '- [0002](0002-the-second-decision.md)\n';
			},
			'ADR number 1 is already used by',
		],
		[
			'a filename disagreeing with the number inside it',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(2, 'the-first-decision');
			},
			'filename does not match adr: 2',
		],
		[
			'a record the index does not list',
			(files) => {
				files['docs/adrs/README.md'] = '# ADRs\n\nNothing here yet.\n';
			},
			'does not list 0001-the-first-decision.md',
		],
	]);
});

describe('the supersession chain', () => {
	/** Add a second record, listed in the index, so a chain has something to point at. */
	const withSecond = (files: ReturnType<typeof baseRegister>, extra: Record<string, string> = {}) => {
		files['docs/adrs/0002-the-second-decision.md'] = adr(2, 'the-second-decision', extra);
		files['docs/adrs/README.md'] += '- [0002](0002-the-second-decision.md)\n';
	};

	runRejections([
		[
			'Superseded without naming a successor',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { status: 'Superseded' });
			},
			'Superseded without naming superseded-by',
		],
		[
			'a chain naming something that is not a number',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { supersedes: 'the old one' });
			},
			'supersedes: "the old one" is not an ADR number',
		],
		[
			'a chain naming a record that does not exist',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { supersedes: '9' });
			},
			'supersedes: 9 — no such ADR',
		],
		[
			'a chain pointing at itself',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { supersedes: '1' });
			},
			'supersedes points at itself',
		],
		[
			'a chain declared from one end only',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', {
					status: 'Superseded',
					'superseded-by': '2',
				});
				withSecond(files);
			},
			'but ADR 2 does not say supersedes: 1',
		],
		[
			'a chain whose arrow points the wrong way through time',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { supersedes: '2' });
				withSecond(files, { status: 'Superseded', 'superseded-by': '1' });
			},
			'a record is replaced by a later ADR',
		],
		[
			'a record that names a successor while still reading as current',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { 'superseded-by': '2' });
				withSecond(files, { supersedes: '1' });
			},
			'names superseded-by but its status is "Accepted", not Superseded',
		],
		[
			'a successor that is only Proposed, so nothing is in force',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', {
					status: 'Superseded',
					'superseded-by': '2',
				});
				withSecond(files, { status: 'Proposed', supersedes: '1' });
			},
			'supersedes 1 while still Proposed — nothing would be in force',
		],
	]);
});

describe('an ADR is not a work item', () => {
	it('reports a bare `parent:`, which has a value to no parser but a key to every one', async () => {
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

	runRejections([
		[
			'a `type`, which would enrol the record in the backlog it documents',
			(files) => {
				files['docs/adrs/0001-the-first-decision.md'] = adr(1, 'the-first-decision', { type: 'Epic' });
			},
			'ADR carries a `type` — an ADR is not a work item',
		],
	]);
});
