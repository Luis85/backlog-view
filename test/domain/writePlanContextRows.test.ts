import { describe, expect, it } from 'vitest';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { computeInitWrites } from '../../src/domain/rankBackfill';
import { computeDropWrites } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();
describe('computeInitWrites with parents outside the filter', () => {
	it('backfills the matches but never the context ancestors', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, filtered, settings);

		// The Epic is present only as context; only the match is missing an order
		expect(model.roots[0].outsideFilter).toBe(true);
		expect(computeInitWrites(model, settings).writes.map((w) => w.file.path)).toEqual(['PBI.md']);
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
		// Feature A has no order, which is what makes it an unranked anchor to skip
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
		const { model, epic, mover } = mixedGroup();
		// The group really is mixed: result Feature B, then context Feature A (unranked, so last)
		expect(epic.children.map((c) => c.title)).toEqual(['Feature B', 'Feature A']);
		expect(epic.children[1].outsideFilter).toBe(true);
		expect(epic.children[1].order).toBeNull();

		const peers = epic.children;
		const writes = computeDropWrites(mover, { parent: epic, peers, insertIndex: peers.length }, model.ranked);

		expect(writes.map((w) => w.file.path)).toEqual(['Mover.md']);
		// The unranked context row (Feature A) is skipped as an anchor, not refused
		// on — `anchoredOrder` falls back to the highest-ranked row it CAN see
		// globally, which is Feature B at 20: floor(20) + 1000.
		expect(writes[0].order).toBe(1020);
		expect(writes.some((w) => w.file.path === 'Feature A.md')).toBe(false);
	});

	it('ranks around a context row that sits between two visible neighbors, never writing to it', () => {
		// Epic's children, visually: Result1 (10), Context (20, excluded but ranked
		// — loaded as Deep's ancestor), Result2 (30). Dropping Mover right after
		// Context still takes a real midpoint from Context's own order — it is read
		// as data, just never written to — and produces exactly one write, to Mover.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Result1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Context.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 1 }, parentLink: 'Context' });
		vault.addFile('Result2.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic' });
		vault.addFile('Mover.md', { frontmatter: { type: 'Feature', order: 99 } });
		const filtered = vault.entries().filter((e) =>
			['Epic.md', 'Result1.md', 'Deep.md', 'Result2.md', 'Mover.md'].includes(e.file.path),
		);
		const model = buildModel(vault.app, filtered, settings);
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		const mover = model.byPath.get('Mover.md') as BacklogItem;
		const context = model.byPath.get('Context.md') as BacklogItem;
		expect(context.outsideFilter).toBe(true);
		expect(epic.children.map((c) => c.title)).toEqual(['Result1', 'Context', 'Result2']);

		const peers = epic.children;
		// Insert after Context (index 1), before Result2.
		const writes = computeDropWrites(mover, { parent: epic, peers, insertIndex: 2 }, model.ranked);

		expect(writes).toEqual([{ file: mover.file, parent: epic.file, order: 25 }]);
	});
});

describe('a context row below a result', () => {
	/** The Base returns the Epic and the PBI, but not the Feature between them. */
	function splitChain() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Other.md', { frontmatter: { type: 'Epic', order: 20 } });
		const filtered = vault.entries().filter((e) => e.file.path !== 'Feature.md');
		const model = buildModel(vault.app, filtered, settings);
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

	it('drops the whole subtree by moving one note, writing to nothing below it', () => {
		// A reparent is one write however deep the subtree hangs, and the context row
		// between the two results is not a target of it — which is what makes a filter
		// that splits a chain safe to drag inside.
		const { model, epic, other } = splitChain();

		const writes = computeDropWrites(epic, { parent: other, peers: [], insertIndex: 0 }, model.ranked);

		expect(writes.map((w) => w.file.path)).toEqual(['Epic.md']);
		expect(writes[0].typeName).toBeUndefined();
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
		return buildModel(vault.app, filtered, settings);
	}

	it('keeps a backfilled item where it already renders, below the context row', () => {
		const model = mixedRanks();
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		// Unranked has no order, so it sorts last — after the context row on screen
		expect(epic.children.map((c) => c.title)).toEqual(['Ranked', 'Context', 'Unranked']);
		expect(model.byPath.get('Context.md')?.outsideFilter).toBe(true);

		const writes = computeInitWrites(model, settings).writes;

		// One spacing past everything visible: filling in a blank must not reorder
		// the tree. Ignoring the context row's 1000 would rank it 1000 and move it up.
		expect(writes.find((w) => w.file.path === 'Unranked.md')?.order).toBe(2000);
		// ...while still never writing to the context note itself
		expect(writes.some((w) => w.file.path === 'Context.md')).toBe(false);
	});
});
