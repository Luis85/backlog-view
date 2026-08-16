import { describe, expect, it } from 'vitest';
import { buildModel, iterationResults } from '../../src/domain/model';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * Who is ON an iteration board. Candidates are not population, and that distinction is
 * the whole subject: a carrier hanging from an excluded ancestor needs that ancestor
 * drawn to be placed at all, while the carriers ALONE are what is counted, what may be
 * written to, and what supplies anything derived.
 */
const settings = resolveSettings(
	new FakeViewConfig({
		stateProperty: 'note.status',
		stateValues: 'New, Doing, Done',
		iterationProperty: 'note.iteration',
	}) as never,
);

const SPRINT = 'Sprint 12.md';

/** A vault holding two iterations, with whatever work the case needs hung off it. */
function vaultWithSprints(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
	return vault;
}

/** The board's population for `Sprint 12`, by title — excluded rows included. */
function population(vault: FakeVault, excluded: string[] = []): string[] {
	const model = buildModel(
		vault.app,
		vault.entries().filter((e) => !excluded.includes(e.file.path)),
		settings,
	);
	return iterationResults(model, SPRINT).map((item) => item.title);
}

describe('iterationResults', () => {
	it('cards the carriers and nobody else', () => {
		const vault = vaultWithSprints();
		vault.addFile('In sprint.md', { frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' } });
		// A child of a carrier, with no link of its own: nothing is inherited down the
		// tree, so committing a parent to a fortnight does not commit its subtree.
		vault.addFile('Child.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'In sprint' });
		vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI', order: 20 } });
		expect(population(vault)).toEqual(['In sprint']);
	});

	it('includes a Deliverable that names the iteration', () => {
		// No type filter at all — not the product board's `!isDeliverableType` and not its
		// mirror. A sprint is a commitment to finish some work, and a concept or a design
		// is part of what it commits to.
		const vault = vaultWithSprints();
		vault.addFile('A design.md', { frontmatter: { type: 'Deliverable', order: 10, iteration: '[[Sprint 12]]' } });
		expect(population(vault)).toEqual(['A design']);
	});

	it('excludes a catalog member that names it', () => {
		// `inProjection` answers first and unconditionally: no needle makes a Test case a
		// row of the plan, and a link is a needle like any other.
		const vault = vaultWithSprints();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10, iteration: '[[Sprint 12]]' } });
		vault.addFile('Case.md', {
			frontmatter: { type: 'Test case', order: 10, iteration: '[[Sprint 12]]' },
			parentLink: 'Suite',
		});
		expect(population(vault)).toEqual([]);
	});

	it('refuses any MARKER that names an iteration', () => {
		// Both names, hand-written keys — and asked of `isMarkerType`, so the Milestone
		// case is not a second rule and a third marker inherits it rather than reopening
		// the hole. A marker is not work; a board scoped to a sprint draws work.
		const vault = vaultWithSprints();
		vault.addFile('A milestone.md', { frontmatter: { type: 'Milestone', order: 30, iteration: '[[Sprint 12]]' } });
		vault.addFile('Sprint 14.md', { frontmatter: { type: 'Iteration', order: 40, iteration: '[[Sprint 12]]' } });
		expect(population(vault)).toEqual([]);
	});

	it('draws an excluded ancestor as placement, and does not count it', () => {
		const vault = vaultWithSprints();
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' },
			parentLink: 'Feature',
		});
		const drawn = population(vault, ['Feature.md']);
		expect(drawn).toEqual(['Feature', 'Carrier']);
		// Placement, never population: the ancestor is `outsideFilter`, which is what every
		// count, every rollup and every write gate already asks.
		const model = buildModel(
			vault.app,
			vault.entries().filter((e) => e.file.path !== 'Feature.md'),
			settings,
		);
		const excludedAncestor = iterationResults(model, SPRINT).find((i) => i.title === 'Feature');
		expect(excludedAncestor?.outsideFilter).toBe(true);
	});

	it('draws no ancestor for a match in a DIFFERENT iteration', () => {
		// The membership question is asked INSIDE the recursion. Scoping the walk's output
		// instead would let a Sprint 13 match keep an ancestor on Sprint 12's board and
		// swallow its "nothing matches" advisory.
		const vault = vaultWithSprints();
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Other sprint.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 13]]' },
			parentLink: 'Feature',
		});
		expect(population(vault, ['Feature.md'])).toEqual([]);
	});

	it('refuses a CONTEXT ROW that names the iteration, and still draws it as an ancestor', () => {
		// One fixture, both halves. `iterationEntry` is read on EVERY item, context rows
		// included — unlike `declaredEdges`, which skips them — so an excluded note holding
		// the link is a candidate on the strength of its own frontmatter. It renders, it
		// parents, and that is all: never counted, never a card of its own.
		//
		// Splitting the halves into two tests would let a walk that drops every excluded
		// note pass the first while breaking the second.
		const vault = vaultWithSprints();
		vault.addFile('Excluded.md', { frontmatter: { type: 'Feature', order: 10, iteration: '[[Sprint 12]]' } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12]]' },
			parentLink: 'Excluded',
		});
		expect(population(vault, ['Excluded.md'])).toEqual(['Excluded', 'Carrier']);

		// And with nothing below it, the excluded note carrying the link is not on the
		// board at all — it was never a carrier, only ever placement for one.
		const alone = new FakeVault();
		alone.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		alone.addFile('Excluded.md', { frontmatter: { type: 'Feature', order: 10, iteration: '[[Sprint 12]]' } });
		expect(population(alone, ['Excluded.md'])).toEqual([]);
	});

	it('matches by PATH, so a link spelled another way is the same iteration', () => {
		const vault = vaultWithSprints();
		vault.addFile('Aliased.md', {
			frontmatter: { type: 'PBI', order: 10, iteration: '[[Sprint 12|this sprint]]' },
		});
		expect(population(vault)).toEqual(['Aliased']);
	});

	it('is empty for an iteration nothing names', () => {
		const vault = vaultWithSprints();
		vault.addFile('Loose.md', { frontmatter: { type: 'PBI', order: 10 } });
		expect(population(vault)).toEqual([]);
	});
});
