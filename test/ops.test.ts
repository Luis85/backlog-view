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

	it('reports progress after each file, knowing the total from the start', async () => {
		const vault = new FakeVault();
		const files = ['A.md', 'B.md', 'C.md'].map((p) => vault.addFile(p));
		const ticks: string[] = [];

		await applyWrites(
			vault.app,
			settings,
			files.map((file, i) => ({ file, order: (i + 1) * 10 })),
			(done, total) => ticks.push(`${done}/${total}`),
		);

		// One tick per file, after that file is on disk — so a caller can report
		// real progress rather than an estimate.
		expect(ticks).toEqual(['1/3', '2/3', '3/3']);
		expect(vault.writeLog).toHaveLength(3);
	});

	it('writes the state to the configured key, and never to an empty key', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { status: 'Open' } });

		await applyWrites(vault.app, { ...settings, stateKey: 'status' }, [{ file: item, state: 'Done' }]);
		expect(vault.fm('Item.md')).toEqual({ status: 'Done' });

		// Without a configured state property the write is dropped, not misfiled.
		await applyWrites(vault.app, settings, [{ file: item, state: 'Open' }]);
		expect(vault.fm('Item.md')).toEqual({ status: 'Done' });
	});

	it('removeParentKey deletes the property even in folder mode', async () => {
		const vault = new FakeVault();
		const child = vault.addFile('Epic/Child.md', { frontmatter: { parent: '[[Elsewhere]]' } });

		await applyWrites(vault.app, { ...settings, folderHierarchy: true }, [
			{ file: child, removeParentKey: true },
		]);

		// Unlike parent: null, this reverts the item to folder-note inference
		expect('parent' in vault.fm('Epic/Child.md')).toBe(false);
	});

	it('pins folder-mode top-level moves with an empty parent value', async () => {
		const vault = new FakeVault();
		const child = vault.addFile('Epic/Child.md', { frontmatter: { parent: '[[Epic]]' } });

		await applyWrites(vault.app, { ...settings, folderHierarchy: true }, [{ file: child, parent: null }]);

		// Deleting the key would just re-infer the folder parent on the next build
		expect(vault.fm('Epic/Child.md')).toEqual({ parent: '' });
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

	it('pins parentless creations in folder mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });

		const file = await createBacklogItem(vault.app, { ...settings, folderHierarchy: true }, {
			folder: 'Epics/Alpha',
			title: 'Standalone',
			typeName: 'Epic',
			parent: null,
			order: 10,
		});

		// Without the empty-parent pin, folder inference would nest this under Alpha
		expect(vault.fm(file.path)['parent']).toBe('');
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

	it('stops the cascade at the context row instead of retyping past it', () => {
		const { epic, other } = splitChain();

		const writes = computeDropWrites(epic, { parent: other, siblings: [], insertIndex: 0 }, settings);

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
		const model = buildModel(vault.app, vault.entries(), settings);
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		const other = model.byPath.get('Other.md') as BacklogItem;

		const writes = computeDropWrites(epic, { parent: other, siblings: [], insertIndex: 0 }, settings);
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
		return buildModel(vault.app, filtered, settings);
	}

	it('keeps a backfilled item where it already renders, below the context row', () => {
		const model = mixedRanks();
		const epic = model.byPath.get('Epic.md') as BacklogItem;
		// Unranked has no order, so it sorts last — after the context row on screen
		expect(epic.children.map((c) => c.title)).toEqual(['Ranked', 'Context', 'Unranked']);
		expect(model.byPath.get('Context.md')?.outsideFilter).toBe(true);

		const writes = computeInitWrites(model, settings);

		// One spacing past everything visible: filling in a blank must not reorder
		// the tree. Ignoring the context row's 1000 would rank it 20 and move it up.
		expect(writes.find((w) => w.file.path === 'Unranked.md')?.order).toBe(1010);
		// ...while still never writing to the context note itself
		expect(writes.some((w) => w.file.path === 'Context.md')).toBe(false);
	});
});
