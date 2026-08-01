import { describe, expect, it } from 'vitest';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { computeDropWrites, computeInitWrites } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();
/** Re-typing on move is opt-in; the cascade tests below are about what it does. */
const autoTyped = { ...settings, autoType: true };

describe('computeInitWrites with parents outside the filter', () => {
	it('backfills the matches but never the context ancestors', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, filtered, settings);

		// The Epic is present only as context; only the match is missing an order
		expect(model.roots[0].outsideFilter).toBe(true);
		expect(computeInitWrites(model, settings).map((w) => w.file.path)).toEqual(['PBI.md']);
	});
});

describe('computeDropWrites in a group holding an outside-filter row', () => {
	/**
	 * Epic E has Feature A and Feature B. The filter returns B and a PBI under A,
	 * so A is loaded as context and E's children mix results with context rows.
	 */
	function mixedGroup() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// Feature A has no order, which is what forces the renumbering path
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		vault.addFile('Mover.md', { frontmatter: { type: 'Feature', order: 99 } });
		const filtered = vault.entries().filter((e) =>
			['Feature B.md', 'PBI.md', 'Mover.md'].includes(e.file.path),
		);
		const model = buildModel(vault.app, filtered, settings);
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		return { vault, model, epic, mover: model.byPath.get('Mover.md') as BacklogItem };
	}

	it('never writes an order into a note the Base excluded', () => {
		const { epic, mover } = mixedGroup();
		// The group really is mixed: result Feature B, then context Feature A (unranked, so last)
		expect(epic.children.map((c) => c.title)).toEqual(['Feature B', 'Feature A']);
		expect(epic.children[1].outsideFilter).toBe(true);
		expect(epic.children[1].order).toBeNull();

		const siblings = epic.children;
		const writes = computeDropWrites(mover, { parent: epic, siblings, insertIndex: siblings.length }, settings);

		expect(writes.map((w) => w.file.path)).toEqual(['Mover.md']);
		// Past the highest order it can see, rather than renumbering the group
		expect(writes[0].order).toBe(30);
		expect(writes.some((w) => w.file.path === 'Feature A.md')).toBe(false);
	});

	it('still renumbers a group made only of results', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('Mover.md', { frontmatter: { type: 'Feature', order: 99 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		const mover = model.byPath.get('Mover.md') as BacklogItem;

		// Appending after the unranked A forces the renumbering path
		const writes = computeDropWrites(
			mover,
			{ parent: epic, siblings: epic.children, insertIndex: epic.children.length },
			settings,
		);
		expect(writes.map((w) => w.file.path).sort()).toEqual(['A.md', 'B.md', 'Mover.md']);
	});
});

describe('auto-type cascade across a context row', () => {
	/** The Base returns the Epic and the PBI, but not the Feature between them. */
	function splitChain() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Other.md', { frontmatter: { type: 'Epic', order: 20 } });
		const filtered = vault.entries().filter((e) => e.file.path !== 'Feature.md');
		const model = buildModel(vault.app, filtered, autoTyped);
		return {
			model,
			epic: model.byPath.get('Epic.md') as BacklogItem,
			feature: model.byPath.get('Feature.md') as BacklogItem,
			other: model.byPath.get('Other.md') as BacklogItem,
		};
	}

	it('a context row can sit under a result, not only above one', () => {
		const { epic, feature } = splitChain();
		expect(feature.outsideFilter).toBe(true);
		expect(feature.parent).toBe(epic);
	});

	it('stops the cascade at the context row instead of retyping past it', () => {
		const { epic, other } = splitChain();

		const writes = computeDropWrites(epic, { parent: other, siblings: [], insertIndex: 0 }, autoTyped);

		// Only the dragged Epic is retyped: writing Feature.md is forbidden, and
		// retyping PBI.md below it would half-update the ladder.
		expect(writes.map((w) => w.file.path)).toEqual(['Epic.md']);
		expect(writes[0].typeName).toBe('Feature');
	});

	it('still cascades through a branch made only of results', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Other.md', { frontmatter: { type: 'Epic', order: 20 } });
		const model = buildModel(vault.app, vault.entries(), autoTyped);
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		const other = model.byPath.get('Other.md') as BacklogItem;

		const writes = computeDropWrites(epic, { parent: other, siblings: [], insertIndex: 0 }, autoTyped);
		expect(writes.map((w) => w.file.path).sort()).toEqual(['Epic.md', 'Feature.md', 'PBI.md']);
	});
});

describe('backfill ranking beside a context sibling', () => {
	/** Ranked(10), Context(1000) and an unranked result, all under one Epic. */
	function mixedRanks() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Ranked.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Context.md', { frontmatter: { type: 'PBI', order: 1000 }, parentLink: 'Epic' });
		// Keeps Context.md loaded as an ancestor of a result
		vault.addFile('Deep.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Context' });
		vault.addFile('Unranked.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path !== 'Context.md');
		return buildModel(vault.app, filtered, autoTyped);
	}

	it('keeps a backfilled item where it already renders, below the context row', () => {
		const model = mixedRanks();
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		// Unranked has no order, so it sorts last — after the context row on screen
		expect(epic.children.map((c) => c.title)).toEqual(['Ranked', 'Context', 'Unranked']);
		expect(model.byPath.get('Context.md')?.outsideFilter).toBe(true);

		const writes = computeInitWrites(model, autoTyped);

		// One spacing past everything visible: filling in a blank must not reorder
		// the tree. Ignoring the context row's 1000 would rank it 20 and move it up.
		expect(writes.find((w) => w.file.path === 'Unranked.md')?.order).toBe(1010);
		// ...while still never writing to the context note itself
		expect(writes.some((w) => w.file.path === 'Context.md')).toBe(false);
	});
});
