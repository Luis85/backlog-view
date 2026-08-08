import { describe } from 'vitest';
import { hierarchyTable, runRejections, withoutHierarchyRow } from '../helpers/register';

/**
 * **Does the documented hierarchy disagreeing with the gate fail?**
 *
 * One rule and its own file — split out of `checkerRejects.test.ts`
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
			// The row that DISAPPEARS rather than disagreeing — the table visibly says something
			// the gate refuses while the gate calls it consistent. Found by review; measured in
			// the real register before it was closed, where the planted row passed.
			'a hierarchy row naming its type in prose rather than code',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}| Spike | Epic | *(nothing)* |\n`;
			},
			'has Spike outside a code span',
		],
		[
			// ONE CASE PER COLUMN, because the first fix went in at the type column only and
			// review immediately found the same hole in the other two: a prose name beside the
			// code-formatted ones leaves the collected set equal to `LEGAL_CHILDREN`, so the
			// row does not even vanish — it reads as agreeing.
			'a children cell naming a type in prose beside the code-formatted ones',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('`PBI`, `Issue`, `Bug`, `Deliverable` |', '`PBI`, `Issue`, `Bug`, `Deliverable`, Spike |');
			},
			'has Spike outside a code span',
		],
		[
			'a parent cell naming a type in prose beside the code-formatted ones',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('| `Task` | `PBI`, `Issue`, `Bug`, `Deliverable` |', '| `Task` | `PBI`, `Issue`, `Bug`, `Deliverable`, Spike |');
			},
			'has Spike outside a code span',
		],
		[
			// A FOURTH COLUMN, which the prefix header match selected and the three-way
			// destructuring then ignored: `Children may not be`, correctly formatted, invisible
			// to every rule. `tablesWith` matches the headings exactly now, so the table stops
			// being the hierarchy table at all — which is the loud failure, not a quiet one.
			'a hierarchy table that grew a column nothing reads',
			(files) => {
				files['docs/README.md'] = hierarchyTable()
					.replace('| Type | Parent may be | Children may be |', '| Type | Parent may be | Children may be | Children may not be |')
					.replace('| --- | --- | --- |', '| --- | --- | --- | --- |');
			},
			'the hierarchy is documented nowhere',
		],
		[
			// A table inside a blockquote renders as a quotation and is not the document's own
			// statement — the rule `headings` in the same file already applies, extended to
			// tables. Kept when the rest of this round's markup hardening was cut, because it
			// is one line and matches a decision that file had already taken.
			'a hierarchy table quoted inside a blockquote',
			(files) => {
				files['docs/README.md'] = hierarchyTable()
					.split('\n')
					.map((line) => (line.startsWith('|') ? `> ${line}` : line))
					.join('\n');
			},
			'the hierarchy is documented nowhere',
		],
		[
			// A short row is NOT padded, so the destructuring bound `undefined` and the gate
			// threw a TypeError — crashing rather than reporting, which is the failure mode
			// `A gate that did not run looks like one that passed` names.
			'a hierarchy row with fewer cells than the table has columns',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('| `Task` | `PBI`, `Issue`, `Bug`, `Deliverable` | *(nothing)* |', '| `Task` | `PBI`, `Issue`, `Bug`, `Deliverable` |');
			},
			'has 2 cells, not 3',
		],
		[
			// The claim the capitalisation rule does NOT subsume: a cell holding no name at all.
			// No capital to report, and the row still disappears.
			'a hierarchy row whose type cell is empty',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}|  | \`Epic\` | *(nothing)* |\n`;
			},
			'names no type in code',
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
