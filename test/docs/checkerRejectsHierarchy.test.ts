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
			// The row that DISAPPEARS rather than disagreeing — the table visibly says something
			// the gate refuses while the gate calls it consistent. Found by review; measured in
			// the real register before it was closed, where the planted row passed.
			//
			// Now reported by the code-free branch rather than the prose one, since a cell with
			// no span at all is what this is. The case is unchanged; which rule catches it moved
			// as the rules were tightened, which is the point of asserting the message and not
			// the site.
			'a hierarchy row naming its type in prose rather than code',
			(files) => {
				files['docs/README.md'] = `${hierarchyTable()}| Spike | Epic | *(nothing)* |\n`;
			},
			'"Spike" is not one of the documented "nothing" annotations',
		],
		[
			// ONE CASE PER COLUMN, because the first fix went in at the type column only and
			// review immediately found the same hole in the other two: a prose name beside the
			// code-formatted ones leaves the collected set equal to `LEGAL_CHILDREN`, so the
			// row does not even vanish — it reads as agreeing. The next time this rule is
			// widened, these three are what say the rule is about a TABLE and not a column.
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
			// The THIRD instance, and the one that turned the rule from "no capitals" into a
			// whitelist. Struck through, GitHub and Obsidian both render the relation as
			// removed — while the code span is still collected, so the documented set stayed
			// equal to `LEGAL_CHILDREN` and the check passed. There is no `delete` node to skip
			// either: this parser loads the table extension only, so the tildes are literal
			// text that no capitalisation rule would look at.
			'a hierarchy entry struck through, which renders as removed',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('`PBI`, `Issue`, `Bug`, `Deliverable` |', '`PBI`, `Issue`, `Bug`, ~~`Deliverable`~~ |');
			},
			'has ~ outside a code span',
		],
		[
			// The FOURTH, and the one that moved the rule from "what may the prose look like"
			// to "a cell means its code spans". Every type here is correctly formatted and the
			// collected set matches the gate exactly — it is the lowercase words between them
			// that reverse the reading, which no rule about formatting could ever have caught.
			'a relation cell whose prose negates the types beside it',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('`PBI`, `Issue`, `Bug`, `Deliverable` |', '`PBI`, `Issue`, `Bug`, but not `Deliverable` |');
			},
			'has but, not outside a code span',
		],
		[
			// The parenthetical is legal where it says the cell names NOTHING, and nowhere
			// else — beside a code span it is free-form text that can say anything at all.
			'a parenthetical aside beside the types it would qualify',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('`PBI`, `Issue`, `Bug`, `Deliverable` |', '`PBI`, `Issue`, `Bug` (and never `Deliverable`) |');
			},
			'outside a code span',
		],
		[
			// The FIFTH, and it was in the exemption written for the fourth: "a parenthetical is
			// free-form where the cell names nothing" reopened the bypass one position over.
			// The extracted set stays empty and matches the gate while the table says an Epic
			// hangs from a Feature. The cell that reports no types is the one place a sentence
			// can sit, so it is the one place a relation can hide.
			'a nothing-annotation carrying a relation in its prose',
			(files) => {
				files['docs/README.md'] = hierarchyTable().replace('(nothing — it is a root)', '(nothing — except Feature)');
			},
			'is not one of the documented "nothing" annotations',
		],
		[
			// The claim the prose rule does NOT subsume: a cell holding no name at all. Nothing
			// disallowed to report, and the row still disappears.
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
