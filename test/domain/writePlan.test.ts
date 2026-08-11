import { describe, expect, it } from 'vitest';
import { BacklogItem } from '../../src/domain/model';
import { buildModel } from '../../src/domain/model';
import {
	computeDropWrites,
	computeInitWrites,
	DropTarget,
	ORDER_SPACING,
} from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();
/** Fixtures made of plain notes: opt out of the hierarchy scope so they survive the build. */
const unscoped = { ...settings, hierarchyOnly: false };
/** Standard fixture: two epics, the second with two features. */
function fixture() {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (title: string): BacklogItem => {
		const item = model.items.find((i) => i.title === title);
		if (!item) throw new Error(`missing fixture item ${title}`);
		return item;
	};
	return { vault, model, get };
}

function siblingsWithout(list: BacklogItem[], dragged: BacklogItem): BacklogItem[] {
	return list.filter((i) => i !== dragged);
}

describe('computeDropWrites', () => {
	it('halves the gap when dropping between two ordered siblings', () => {
		const { model, get } = fixture();
		const dragged = get('Epic A');
		const target: DropTarget = {
			parent: null,
			siblings: siblingsWithout(model.roots, dragged),
			insertIndex: 1,
		};
		// no third root, so insertIndex 1 means "after Epic B" -> floor(20)+10
		const writes = computeDropWrites(dragged, target);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(30);
		expect(writes[0].parent).toBeUndefined();
		expect(writes[0].typeName).toBeUndefined();
	});

	it('places an item before the first sibling with room to spare', () => {
		const { model, get } = fixture();
		const dragged = get('Epic B');
		const target: DropTarget = {
			parent: null,
			siblings: siblingsWithout(model.roots, dragged),
			insertIndex: 0,
		};
		const writes = computeDropWrites(dragged, target);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(0);
	});

	it('computes the midpoint between two ordered neighbors', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { order: 10 } });
		vault.addFile('Two.md', { frontmatter: { order: 20 } });
		vault.addFile('Three.md', { frontmatter: { order: 30 } });
		const model = buildModel(vault.app, vault.entries(), unscoped);
		const dragged = model.roots[2]; // Three
		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 });
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(15);
	});

	it('renumbers the sibling group when the gap is exhausted', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { order: 10 } });
		vault.addFile('Two.md', { frontmatter: { order: 10.001 } });
		vault.addFile('Mover.md', { frontmatter: { order: 50 } });
		const model = buildModel(vault.app, vault.entries(), unscoped);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 });

		// Sequence becomes One, Mover, Two -> 10, 20, 30; One already has 10.
		expect(writes).toHaveLength(2);
		const mover = writes.find((w) => w.file.path === 'Mover.md');
		const two = writes.find((w) => w.file.path === 'Two.md');
		expect(mover?.order).toBe(2 * ORDER_SPACING);
		expect(two?.order).toBe(3 * ORDER_SPACING);
	});

	it('renumbers when a neighbor is missing its order property', () => {
		const vault = new FakeVault();
		vault.addFile('Ordered.md', { frontmatter: { order: 10 } });
		vault.addFile('Unordered.md');
		vault.addFile('Mover.md', { frontmatter: { order: 99 } });
		const model = buildModel(vault.app, vault.entries(), unscoped);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		// Insert between Ordered and Unordered
		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 });

		expect(writes.length).toBeGreaterThanOrEqual(2);
		const unordered = writes.find((w) => w.file.path === 'Unordered.md');
		expect(unordered?.order).toBe(3 * ORDER_SPACING);
	});

	it('never plans a type: a drop writes the parent and the rank and nothing else', () => {
		// The rule that outlived the re-typing option: a move is a move, not a
		// re-classification. Asked of a real reparent, of a reorder among siblings, and of
		// a renumbering drop — the three shapes `computeDropWrites` returns from — because
		// a type slipped back into any one of them is a note leaving the projection it was
		// dragged on, silently.
		const { model, get } = fixture();
		const reparent = computeDropWrites(get('Epic B'), { parent: get('Epic A'), siblings: [], insertIndex: 0 });
		const parent = get('Epic B');
		const reorder = computeDropWrites(get('Feature B2'), {
			parent,
			siblings: siblingsWithout(parent.children, get('Feature B2')),
			insertIndex: 0,
		});
		const unordered = new FakeVault();
		unordered.addFile('A.md', { frontmatter: { type: 'Epic' } });
		unordered.addFile('B.md', { frontmatter: { type: 'Epic' } });
		const flat = buildModel(unordered.app, unordered.entries(), settings);
		const renumber = computeDropWrites(flat.roots[1], { parent: null, siblings: [flat.roots[0]], insertIndex: 0 });

		for (const batch of [reparent, reorder, renumber]) {
			expect(batch.length).toBeGreaterThan(0);
			expect(batch.every((w) => w.typeName === undefined)).toBe(true);
		}
		// And a reparent is still one write, so nothing cascades into the subtree either.
		expect(model.items.length).toBeGreaterThan(2);
		expect(reparent).toHaveLength(1);
	});

	it('clears a stale parent link when moving an orphan to the top level', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Not In View' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;
		expect(dragged.orphan).toBe(true);

		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 0 });

		expect(writes).toHaveLength(1);
		// null means "delete the parent property"
		expect(writes[0].parent).toBeNull();
	});

	it('clears the stale link even when the orphan keeps its last-root position', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Not In View' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;
		const siblings = siblingsWithout(model.roots, dragged);

		// A drop on the tree background appends at the end — positionally a no-op.
		const writes = computeDropWrites(dragged, { parent: null, siblings, insertIndex: siblings.length });

		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeNull();
	});

	it('omits the parent write when reordering within the same parent', () => {
		const { get } = fixture();
		const dragged = get('Feature B2');
		const parent = get('Epic B');
		const writes = computeDropWrites(
			dragged,
			{ parent, siblings: siblingsWithout(parent.children, dragged), insertIndex: 0 });
		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeUndefined();
		expect(writes[0].order).toBe(0);
	});

	it('assigns the default spacing for the first child of an empty parent', () => {
		const { get } = fixture();
		const dragged = get('Epic A');
		const parent = get('Feature B2');
		const writes = computeDropWrites(dragged, { parent, siblings: [], insertIndex: 0 });
		expect(writes[0].order).toBe(ORDER_SPACING);
	});
});

describe('computeInitWrites', () => {
	it('fills only missing order and type values', () => {
		const vault = new FakeVault();
		vault.addFile('Complete.md', { frontmatter: { type: 'Epic', order: 11 } });
		vault.addFile('NoOrder.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('NoType.md', { frontmatter: { order: 5 } });
		vault.addFile('Child.md', { parentLink: 'Complete' });
		// NoType has neither a type nor a parent — only the opt-out puts it in scope.
		const model = buildModel(vault.app, vault.entries(), unscoped);

		const writes = computeInitWrites(model, settings);

		expect(writes.map((w) => w.file.path).sort()).toEqual(['Child.md', 'NoOrder.md', 'NoType.md']);
		const noOrder = writes.find((w) => w.file.path === 'NoOrder.md');
		expect(noOrder?.order).toBe(Math.floor(11) + ORDER_SPACING);
		expect(noOrder?.typeName).toBeUndefined();
		const noType = writes.find((w) => w.file.path === 'NoType.md');
		expect(noType?.typeName).toBe('Epic');
		expect(noType?.order).toBeUndefined();
		const child = writes.find((w) => w.file.path === 'Child.md');
		expect(child?.typeName).toBe('Feature');
		expect(child?.order).toBe(ORDER_SPACING);
		// Parent property is never touched by the backfill
		expect(writes.every((w) => w.parent === undefined)).toBe(true);
	});

	it('never touches notes outside the hierarchy', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Sprint notes.md');
		const model = buildModel(vault.app, vault.entries(), settings);

		// Backfilling a plain note would stamp "type: Epic" onto it — the scope prevents that.
		expect(computeInitWrites(model, settings)).toEqual([]);
	});

	it('returns nothing when every item is complete', () => {
		const vault = new FakeVault();
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 10 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(computeInitWrites(model, settings)).toHaveLength(0);
	});

	it('does not write a type for items whose parent is outside the view', () => {
		const vault = new FakeVault();
		vault.addFile('Orphan.md', { parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), settings);

		const writes = computeInitWrites(model, settings);

		// The orphan's real level is unknowable: it gets an order, never a type.
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(ORDER_SPACING);
		expect(writes[0].typeName).toBeUndefined();
	});

	it('backfills the whole hierarchy even in focus mode', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feat.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Story.md', { parentLink: 'Feat' });
		// This branch has no Feature-level item, so it is invisible while focused
		vault.addFile('Bare Epic.md', { frontmatter: { type: 'Epic' } });
		const focusSettings = { ...settings, focusLevel: 'Feature' };
		const model = buildModel(vault.app, vault.entries(), focusSettings);
		expect(model.focused).toBe(true);

		const writes = computeInitWrites(model, focusSettings);
		const byPath = new Map(writes.map((w) => [w.file.path, w]));

		// Feat gets an order within its REAL sibling group (children of Epic)
		expect(byPath.get('Feat.md')?.order).toBe(ORDER_SPACING);
		// The hidden branch is backfilled too, ranked after the existing root
		expect(byPath.get('Bare Epic.md')?.order).toBe(20);
		expect(byPath.get('Story.md')?.typeName).toBe('PBI');
		expect(byPath.get('Story.md')?.order).toBe(ORDER_SPACING);
	});
});
