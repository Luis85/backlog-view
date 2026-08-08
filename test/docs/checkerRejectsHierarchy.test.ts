import { describe } from 'vitest';
import { hierarchyTable, runRejections, withoutHierarchyRow } from '../helpers/register';

/**
 * **Does the documented hierarchy disagreeing with the gate fail?**
 *
 * One rule, seven report sites, and its own file — split out of `checkerRejects.test.ts`
 * when that file reached its lint budget, the same way the ADR and citation groups were.
 * The direction it guards is the one that actually rotted: `LEGAL_CHILDREN` learned
 * `Deliverable` and `docs/README.md`'s table did not, for a whole increment, because
 * nothing compared them.
 *
 * `LEGAL_CHILDREN` lives in the gate's own source and no fixture can edit it, so every
 * case below plants the drift on the TABLE's side. That is a real asymmetry rather than a
 * convenience: the gate half of the comparison is covered by the accept direction, which
 * fails if the shipped table stops matching the shipped map.
 *
 * NOT skipped on Windows, unlike the filename suite these were first written beside.
 * These cases plant ordinary Markdown — nothing about them is unrepresentable on any
 * filesystem — and CI runs Windows precisely to catch `docs-check.mjs` behaving
 * differently there. They inherited that `skipIf` by proximity, and the Windows leg
 * exercised none of this rule while the run stayed green. Found in review.
 */
describe('the documented hierarchy and the gate agree', () => {
	runRejections([
		[
			'a register that documents no hierarchy at all',
			(files) => {
				files['docs/README.md'] = '# docs\n\nThe register.\n';
			},
			'the hierarchy is documented nowhere',
		],
		[
			'a hierarchy table missing a type the gate allows',
			(files) => {
				files['docs/README.md'] = withoutHierarchyRow('Milestone');
			},
			'the hierarchy table omits Milestone, which LEGAL_CHILDREN allows',
		],
		[
			'a hierarchy table naming a type the gate does not know',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}| \`Spike\` | \`PBI\` | *(nothing)* |\n`;
			},
			'the hierarchy table names Spike, which LEGAL_CHILDREN does not allow at all',
		],
		[
			'a children list the gate disagrees with',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('`PBI`, `Issue`, `Bug`, `Deliverable` |', '`PBI`, `Issue` |');
			},
			'and the hierarchy table says Issue, PBI',
		],
		[
			'a parent column that is not the inverse of the children',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('| `Task` | `PBI`, `Issue`, `Bug`, `Deliverable` |', '| `Task` | `PBI` |');
			},
			'Task may hang from Bug, Deliverable, Issue, PBI, and the hierarchy table says PBI',
		],
		[
			// Flattening with `set` would keep the LAST row and call a contradictory table
			// consistent — a false pass inside the rule written to remove false passes.
			'a type given two rows, which is a contradiction rather than a merge',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}| \`Deliverable\` | \`Epic\` | *(nothing)* |\n`;
			},
			'the hierarchy table gives Deliverable more than one row',
		],
		[
			// A type name is user data, and `LEGAL_CHILDREN` is read by it. A plain object
			// literal answers `["toString"]` with an inherited FUNCTION — truthy, so the
			// unknown-type branch is skipped and the comparison then tries to spread a
			// function. Null-prototype at the map closes it for the table AND for the note
			// check that has read it by `type:` since long before this rule existed.
			'a hierarchy table naming an Object.prototype member',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}| \`toString\` | \`Epic\` | *(nothing)* |\n`;
			},
			'the hierarchy table names toString, which LEGAL_CHILDREN does not allow at all',
		],
		[
			// One level up from the duplicate ROW: with two tables under the same headings,
			// checking the first validates one document while a reader sees two.
			'a hierarchy documented twice, in two tables',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}\n${hierarchyTable()}`;
			},
			'the hierarchy is documented twice',
		],
	]);
});
