import { describe, expect, it } from 'vitest';
import { BacklogItem } from '../../src/domain/model';
import { buildModel } from '../../src/domain/model';
import { computeDropWrites, computeInitWrites, DropTarget, ORDER_SPACING } from '../../src/domain/writePlan';
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
		const model = buildModel(vault.app, vault.entries(), unscoped);
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
		const model = buildModel(vault.app, vault.entries(), unscoped);
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
		const model = buildModel(vault.app, vault.entries(), unscoped);
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

	it('cascades position-consistent types through the moved subtree', () => {
		const { get } = fixture();
		const dragged = get('Epic B'); // has children Feature B1, Feature B2
		const newParent = get('Epic A');

		const writes = computeDropWrites(dragged, { parent: newParent, siblings: [], insertIndex: 0 }, settings);

		expect(writes).toHaveLength(3);
		expect(writes[0].file.path).toBe('Epic B.md');
		expect(writes[0].typeName).toBe('Feature');
		const childWrites = writes.slice(1);
		expect(childWrites.map((w) => w.file.path).sort()).toEqual(['Feature B1.md', 'Feature B2.md']);
		for (const w of childWrites) {
			expect(w.typeName).toBe('PBI');
			// Cascade writes touch only the type
			expect(w.parent).toBeUndefined();
			expect(w.order).toBeUndefined();
		}
	});

	it('cascade preserves custom types outside the configured ladder', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Bugfix Child.md', { frontmatter: { type: 'Bugfix' }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Epic B') as BacklogItem;
		const epicA = model.roots.find((r) => r.title === 'Epic A') as BacklogItem;

		const writes = computeDropWrites(dragged, { parent: epicA, siblings: [], insertIndex: 0 }, settings);

		// Only the dragged epic is retyped; the deliberate Bugfix type stays.
		expect(writes).toHaveLength(1);
		expect(writes[0].file.path).toBe('Epic B.md');
		expect(writes[0].typeName).toBe('Feature');
	});

	it('clamps the cascade at the deepest level for a subtree deeper than the ladder', () => {
		const vault = new FakeVault();
		// Five levels of nesting against a four-level ladder, moved one rung down.
		vault.addFile('Host.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('L1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic B' });
		vault.addFile('L2.md', { frontmatter: { type: 'PBI' }, parentLink: 'L1' });
		vault.addFile('L3.md', { frontmatter: { type: 'Task' }, parentLink: 'L2' });
		vault.addFile('L4.md', { frontmatter: { type: 'Task' }, parentLink: 'L3' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Epic B') as BacklogItem;
		const host = model.roots.find((r) => r.title === 'Host') as BacklogItem;

		const writes = computeDropWrites(dragged, { parent: host, siblings: [], insertIndex: 0 }, settings);

		// Each rung shifts down one and the ladder's floor absorbs the rest: the two
		// deepest notes are already Task and stay, so they are not written at all.
		const byPath = new Map(writes.map((w) => [w.file.path, w.typeName]));
		expect(byPath.get('Epic B.md')).toBe('Feature');
		expect(byPath.get('L1.md')).toBe('PBI');
		expect(byPath.get('L2.md')).toBe('Task');
		expect(byPath.has('L3.md')).toBe(false);
		expect(byPath.has('L4.md')).toBe(false);
	});

	it('retypes a level-skipping descendant by its position, not by its declared level', () => {
		const vault = new FakeVault();
		// A Task nested directly under an Epic: tree distance 1, declared distance 3.
		// Chaining down the parent levels answers 1 — the rung it actually occupies.
		vault.addFile('Host.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Straggler.md', { frontmatter: { type: 'Task' }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Epic B') as BacklogItem;
		const host = model.roots.find((r) => r.title === 'Host') as BacklogItem;

		const writes = computeDropWrites(dragged, { parent: host, siblings: [], insertIndex: 0 }, settings);

		const byPath = new Map(writes.map((w) => [w.file.path, w.typeName]));
		expect(byPath.get('Epic B.md')).toBe('Feature');
		expect(byPath.get('Straggler.md')).toBe('PBI');
	});

	it('carries a custom-typed ancestor through the ladder without retyping it', () => {
		const vault = new FakeVault();
		// The Bugfix keeps its type but still occupies a rung, so its child
		// continues from there rather than restarting at the dragged item's level.
		vault.addFile('Host.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Bugfix.md', { frontmatter: { type: 'Bugfix' }, parentLink: 'Epic B' });
		vault.addFile('Under.md', { frontmatter: { type: 'Epic' }, parentLink: 'Bugfix' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Epic B') as BacklogItem;
		const host = model.roots.find((r) => r.title === 'Host') as BacklogItem;

		const writes = computeDropWrites(dragged, { parent: host, siblings: [], insertIndex: 0 }, settings);

		const byPath = new Map(writes.map((w) => [w.file.path, w.typeName]));
		expect(byPath.has('Bugfix.md')).toBe(false);
		expect(byPath.get('Under.md')).toBe('Task');
	});

	it('never re-types a dragged extra type, and keeps its subtree at the deepest level', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 } });
		vault.addFile('Bug.md', { frontmatter: { type: 'Bug', order: 10 }, parentLink: 'Feature B' });
		vault.addFile('Bug Task.md', { frontmatter: { type: 'Task' }, parentLink: 'Bug' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.byPath.get('Bug.md') as BacklogItem;
		const epicA = model.roots.find((r) => r.title === 'Epic A') as BacklogItem;

		// Dropped a rung higher, where the ladder would have said "Feature".
		const writes = computeDropWrites(dragged, { parent: epicA, siblings: [], insertIndex: 0 }, settings);

		const bug = writes.find((w) => w.file.path === 'Bug.md');
		expect(bug?.parent?.path).toBe('Epic A.md');
		// A Bug stays a Bug wherever it lands: it is a type, not a rung.
		expect(bug?.typeName).toBeUndefined();
		// And its Tasks stay Tasks — the subtree descends from the Bug's own pinned rung,
		// not from the rung it was dropped on, which would have made them PBIs.
		expect(writes.some((w) => w.file.path === 'Bug Task.md')).toBe(false);
	});

	it('cascade skips untyped descendants and does not fire without autoType', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Untyped Child.md', { parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const dragged = model.roots.find((r) => r.title === 'Epic B') as BacklogItem;
		const epicA = model.roots.find((r) => r.title === 'Epic A') as BacklogItem;

		// Untyped child self-heals through implication — no cascade write for it
		const writes = computeDropWrites(dragged, { parent: epicA, siblings: [], insertIndex: 0 }, settings);
		expect(writes).toHaveLength(1);

		const writesOff = computeDropWrites(
			dragged,
			{ parent: epicA, siblings: [], insertIndex: 0 },
			{ ...settings, autoType: false },
		);
		expect(writesOff).toHaveLength(1);
		expect(writesOff[0].typeName).toBeUndefined();
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
