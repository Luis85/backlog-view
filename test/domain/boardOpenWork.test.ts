import { describe, expect, it } from 'vitest';
import { boardColumns, deliverablesWorkflow, requirementsWorkflow } from '../../src/domain/board';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { BacklogSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * `BoardColumn.openWork` — the one question the done column's fold default is decided on,
 * and the two ways it has been got wrong: measuring it over the drawn cards rather than
 * the population, and reading finished off the requirements workflow on a board that is
 * not the requirements board.
 *
 * Its own file rather than a third block in `board.test.ts`, which is at its line budget:
 * "is this column still holding work" is a subject, and the fold that reads it lives two
 * layers up in `test/view/columnFolds.test.ts`.
 */

const settings = resolveSettings(
	new FakeViewConfig({ stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' }) as never,
);

const everything = () => true;

/** Stand-in for a Base filtered to a subset of the vault. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

describe('a column reports whether it still holds open work', () => {
	/**
	 * Two done items in Done, one of which still carries an unfinished Task — so the
	 * column is finished-looking and is not finished, which is the whole distinction
	 * `openWork` exists to draw for the fold default in `render/board.ts`.
	 */
	function doneVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('Retained.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('Loose end.md', {
			frontmatter: { type: 'Task', order: 10, status: 'Active' },
			parentLink: 'Retained',
		});
		return vault;
	}

	it('is false where every card in the column is a finished subtree', () => {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(false);
		// And it is a question about THIS column, never about the board: the item in a
		// not-done column is open work and says nothing about Done.
		expect(board.columns.find((c) => c.label === 'Active')?.openWork).toBe(false);
	});

	it('is true where a done card still carries unfinished work below it', () => {
		const vault = doneVault();
		const model = buildModel(vault.app, vault.entries(), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(true);
	});

	it('reads the POPULATION, so a filter that hid the open card cannot say the column is finished', () => {
		// The failure this pins: measured over `cards`, a search matching only the tidy
		// item would report Done as finished, and the board would fold a column holding a
		// retained card — the user searching their board into a different shape. The
		// second predicate is the filter; the third is the population it is measured
		// against, which is exactly what `fullCount` already borrows.
		const vault = doneVault();
		const model = buildModel(vault.app, vault.entries(), settings);
		const matched = (item: BacklogItem) => item.title === 'Shipped';
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, matched, everything);

		const done = board.columns.find((c) => c.label === 'Done');
		expect(done?.cards.map((c) => c.title)).toEqual(['Shipped']);
		expect(done?.openWork).toBe(true);
	});

	it('ignores a context card, which is placement rather than work', () => {
		// The context-row rule, asked of one more derived quantity: an excluded note's own
		// state must not decide whether this board folds a column.
		const vault = doneVault();
		const model = buildModel(vault.app, only(vault, 'Shipped.md', 'Loose end.md'), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		// "Retained" is on screen as context in Done, and its unfinished Task is a result
		// in Active — so Done itself holds nothing unfinished of its own.
		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(false);
	});
});

describe('a context card speaks for the results below it and for nothing else', () => {
	/** An excluded Done epic placing one result — the shape a focused board draws. */
	function contextVault(childState: string): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, status: childState }, parentLink: 'Epic' });
		return vault;
	}

	it('reports open work when a result below it is unfinished', () => {
		// Found by review (Codex, PR #140). Under a focus this card can be the ONLY thing
		// standing for those rows, so a Done column folded on its silence took the results
		// off the board with it — and left no advisory, since the board did hold a card.
		const vault = contextVault('New');
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);
		// `model.roots` rather than `model.results`, which is what a FOCUSED board hands
		// this function (`requirementsFocusRoots`): a context card is only ever a card
		// there, and results-only candidates could never produce one.
		const board = boardColumns(requirementsWorkflow(model, settings), model.roots, everything);

		const done = board.columns.find((c) => c.label === 'Done');
		expect(done?.cards.map((c) => c.title)).toEqual(['Epic']);
		expect(done?.openWork).toBe(true);
	});

	it('reports none when everything below it is finished', () => {
		const vault = contextVault('Done');
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.roots, everything);

		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(false);
	});

	it('still counts for nothing, in either direction', () => {
		// The half of the context-row rule that has not moved: it is placement, never
		// population, so admitting its ROLLUP to this one question must not admit the card.
		const vault = contextVault('New');
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.roots, everything);

		const done = board.columns.find((c) => c.label === 'Done');
		expect(done?.count).toBe(0);
		expect(done?.fullCount).toBe(0);
	});
});

describe('openWork under the Deliverables workflow', () => {
	function deliverablesSettings(extra: Partial<BacklogSettings> = {}): BacklogSettings {
		return {
			...settings,
			deliverableStateKey: 'deliverableStatus',
			deliverableStates: ['Draft', 'Shipped'],
			deliverableDoneValues: ['Shipped'],
			...extra,
		};
	}

	it('reports open work from ITS OWN done values, never the requirements reading', () => {
		// Found by review (Codex, PR #140). `item.subtreeDone` is built on `item.done`, the
		// REQUIREMENTS reading, so a Deliverable finished in its own workflow reported open
		// work unless its `status` happened to agree — and the fold default never fired on
		// this board at all. The fixture is the disagreement: `Shipped` in the Deliverable
		// workflow's own done value, with no requirements status whatsoever.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Shipped' } });
		const s = deliverablesSettings();
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, () => true);

		const col = board.columns.find((c) => c.label === 'Shipped');
		expect(col?.done).toBe(true);
		expect(col?.openWork).toBe(false);
	});

	it('still reports open work where a finished Deliverable holds an unfinished Task', () => {
		// The other direction of the same reading: the column's verdict says the card is
		// finished, and the rollup below it says the work is not.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Shipped' } });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'D' });
		const s = deliverablesSettings();
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, (item) => item.title === 'D');

		expect(board.columns.find((c) => c.label === 'Shipped')?.openWork).toBe(true);
	});
});
