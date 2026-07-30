import { describe, expect, it } from 'vitest';
import { BacklogItem } from '../src/model';
import { buildModel } from '../src/model';
import {
	applyWrites,
	computeDropWrites,
	computeInitWrites,
	createBacklogItem,
	DropTarget,
	ORDER_SPACING,
} from '../src/ops';
import { defaultSettings } from '../src/settings';
import { FakeVault } from './helpers';

const settings = defaultSettings();

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
		const writes = computeDropWrites(dragged, target, settings);
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
		const writes = computeDropWrites(dragged, target, settings);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(0);
	});

	it('computes the midpoint between two ordered neighbors', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { order: 10 } });
		vault.addFile('Two.md', { frontmatter: { order: 20 } });
		vault.addFile('Three.md', { frontmatter: { order: 30 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots[2]; // Three
		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 },
			settings,
		);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(15);
	});

	it('renumbers the sibling group when the gap is exhausted', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { order: 10 } });
		vault.addFile('Two.md', { frontmatter: { order: 10.001 } });
		vault.addFile('Mover.md', { frontmatter: { order: 50 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 },
			settings,
		);

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
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		// Insert between Ordered and Unordered
		const writes = computeDropWrites(
			dragged,
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 1 },
			settings,
		);

		expect(writes.length).toBeGreaterThanOrEqual(2);
		const unordered = writes.find((w) => w.file.path === 'Unordered.md');
		expect(unordered?.order).toBe(3 * ORDER_SPACING);
	});

	it('writes parent and re-types the item when reparenting with autoType', () => {
		const { get } = fixture();
		const dragged = get('Epic A');
		const newParent = get('Feature B1');
		const writes = computeDropWrites(
			dragged,
			{ parent: newParent, siblings: [], insertIndex: 0 },
			settings,
		);

		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBe(newParent.file);
		// Feature B1 is at depth 1, so its children are PBIs
		expect(writes[0].typeName).toBe('PBI');
		expect(writes[0].order).toBe(ORDER_SPACING);
	});

	it('does not rewrite the type when autoType is off or already correct', () => {
		const { get } = fixture();
		const noAuto = { ...settings, autoType: false };
		const dragged = get('Feature B1');
		const epicA = get('Epic A');

		const writesOff = computeDropWrites(dragged, { parent: epicA, siblings: [], insertIndex: 0 }, noAuto);
		expect(writesOff[0].typeName).toBeUndefined();

		// autoType on, but the item is already a Feature moving under another Epic
		const writesOn = computeDropWrites(dragged, { parent: epicA, siblings: [], insertIndex: 0 }, settings);
		expect(writesOn[0].typeName).toBeUndefined();
		expect(writesOn[0].parent).toBe(epicA.file);
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
			{ parent: null, siblings: siblingsWithout(model.roots, dragged), insertIndex: 0 },
			settings,
		);

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

		// Dropping onto "Move to top level" appends at the end — positionally a no-op.
		const writes = computeDropWrites(dragged, { parent: null, siblings, insertIndex: siblings.length }, settings);

		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeNull();
	});

	it('omits the parent write when reordering within the same parent', () => {
		const { get } = fixture();
		const dragged = get('Feature B2');
		const parent = get('Epic B');
		const writes = computeDropWrites(
			dragged,
			{ parent, siblings: siblingsWithout(parent.children, dragged), insertIndex: 0 },
			settings,
		);
		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeUndefined();
		expect(writes[0].order).toBe(0);
	});

	it('assigns the default spacing for the first child of an empty parent', () => {
		const { get } = fixture();
		const dragged = get('Epic A');
		const parent = get('Feature B2');
		const writes = computeDropWrites(dragged, { parent, siblings: [], insertIndex: 0 }, settings);
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
		const model = buildModel(vault.app, vault.entries(), settings);

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

	it('returns nothing when every item is complete', () => {
		const vault = new FakeVault();
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 10 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(computeInitWrites(model, settings)).toHaveLength(0);
	});
});

describe('applyWrites', () => {
	it('writes wikilink parents, deletes cleared parents, and sets order/type', async () => {
		const vault = new FakeVault();
		const epic = vault.addFile('Epic.md');
		const child = vault.addFile('Child.md', { frontmatter: { parent: '[[Old]]', order: 1 } });

		await applyWrites(vault.app, settings, [
			{ file: child, parent: epic, order: 15, typeName: 'Feature' },
		]);
		expect(vault.fm('Child.md')).toEqual({ parent: '[[Epic]]', order: 15, type: 'Feature' });

		await applyWrites(vault.app, settings, [{ file: child, parent: null }]);
		expect(vault.fm('Child.md')).toEqual({ order: 15, type: 'Feature' });
	});
});

describe('createBacklogItem', () => {
	it('creates folders, dedupes names, sanitizes titles, and writes properties', async () => {
		const vault = new FakeVault();
		const parent = vault.addFile('Backlog/Epic.md');

		const first = await createBacklogItem(vault.app, settings, {
			folder: 'Backlog/Items',
			title: 'My: Story?',
			typeName: 'PBI',
			parent,
			order: 10,
		});
		expect(first.path).toBe('Backlog/Items/My- Story.md');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.folders.has('Backlog/Items')).toBe(true);
		expect(vault.fm(first.path)).toEqual({ type: 'PBI', parent: '[[Epic]]', order: 10 });

		const second = await createBacklogItem(vault.app, settings, {
			folder: 'Backlog/Items',
			title: 'My: Story?',
			typeName: 'PBI',
			parent: null,
			order: 20,
		});
		expect(second.path).toBe('Backlog/Items/My- Story 1.md');
		expect(vault.fm(second.path)).toEqual({ type: 'PBI', order: 20 });
	});

	it('falls back to Untitled for empty titles and supports the vault root', async () => {
		const vault = new FakeVault();
		const file = await createBacklogItem(vault.app, settings, {
			folder: '',
			title: '???',
			typeName: 'Epic',
			parent: null,
			order: 10,
		});
		expect(file.path).toBe('Untitled.md');
	});
});
