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
/**
 * Standard fixture: two root Epics, the second with two Features. The Features sit
 * BETWEEN the two Epics' orders (13, 16, against Epic A's 10 and Epic B's 20) so the
 * root-level tests below can reason about "the next/previous root" without a Feature's
 * order colliding with a root's — a rank is now global, so a fixture's numbers have to
 * stay collision-free across levels on purpose rather than by accident.
 */
function fixture() {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 13 }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 16 }, parentLink: 'Epic B' });
	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (title: string): BacklogItem => {
		const item = model.items.find((i) => i.title === title);
		if (!item) throw new Error(`missing fixture item ${title}`);
		return item;
	};
	return { vault, model, get };
}

function peersWithout(list: BacklogItem[], dragged: BacklogItem): BacklogItem[] {
	return list.filter((i) => i !== dragged);
}

describe('computeDropWrites', () => {
	it('halves the gap when dropping between two ordered siblings', () => {
		const { model, get } = fixture();
		const dragged = get('Epic A');
		const target: DropTarget = {
			parent: null,
			peers: peersWithout(model.roots, dragged),
			insertIndex: 1,
		};
		// No root ranks higher than Epic B globally, so "after Epic B" has no next:
		// floor(20) + 1000.
		const writes = computeDropWrites(dragged, target, model.ranked);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(1020);
		expect(writes[0].parent).toBeUndefined();
		expect(writes[0].typeName).toBeUndefined();
	});

	it('places an item before the first sibling with room to spare', () => {
		const { model, get } = fixture();
		const dragged = get('Epic B');
		const target: DropTarget = {
			parent: null,
			peers: peersWithout(model.roots, dragged),
			insertIndex: 0,
		};
		// Nothing globally ranks below Epic A (10), so "before Epic A" has no
		// previous either: floor(10) - 1000, a real number a note reader accepts.
		const writes = computeDropWrites(dragged, target, model.ranked);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(-990);
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
			{ parent: null, peers: peersWithout(model.roots, dragged), insertIndex: 1 },
			model.ranked,
		);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(15);
	});

	it('plans no writes when the gap is spent', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { order: ORDER_SPACING } });
		// One step on the six-decimal grid `roundOrder` keeps, so the midpoint rounds onto
		// a neighbour and there is no rank between the two.
		vault.addFile('Two.md', { frontmatter: { order: ORDER_SPACING + 0.000001 } });
		vault.addFile('Mover.md', { frontmatter: { order: 50 } });
		const model = buildModel(vault.app, vault.entries(), unscoped);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		// Insert Mover between One and Two — exactly the gap the fixture spent.
		const writes = computeDropWrites(
			dragged,
			{ parent: null, peers: peersWithout(model.roots, dragged), insertIndex: 1 },
			model.ranked,
		);

		// No group renumber any more: a spent gap refuses rather than rewriting
		// every sibling, so the only writable note comes back untouched.
		expect(writes).toEqual([]);
	});

	it('plans no writes when a neighbor has no rank', () => {
		const vault = new FakeVault();
		vault.addFile('Ordered.md', { frontmatter: { order: 10 } });
		vault.addFile('Unordered.md');
		vault.addFile('Mover.md', { frontmatter: { order: 99 } });
		const model = buildModel(vault.app, vault.entries(), unscoped);
		const dragged = model.roots.find((r) => r.title === 'Mover') as BacklogItem;

		// Insert between Ordered and Unordered — the backfill can rank Unordered,
		// so the refusal is a prompt rather than a dead end, not a renumber.
		const writes = computeDropWrites(
			dragged,
			{ parent: null, peers: peersWithout(model.roots, dragged), insertIndex: 1 },
			model.ranked,
		);

		expect(writes).toEqual([]);
	});

	it('never plans a type: a drop writes the parent and the rank and nothing else', () => {
		// The rule that outlived the re-typing option: a move is a move, not a
		// re-classification. Asked of a real reparent and of a reorder among
		// siblings — the two shapes `computeDropWrites` returns from now that no
		// group is ever renumbered — because a type slipped back into either would
		// be a note leaving the projection it was dragged on, silently.
		const { model, get } = fixture();
		const reparent = computeDropWrites(
			get('Epic B'),
			{ parent: get('Epic A'), peers: [], insertIndex: 0 },
			model.ranked,
		);
		const parent = get('Epic B');
		const reorder = computeDropWrites(
			get('Feature B2'),
			{ parent, peers: peersWithout(parent.children, get('Feature B2')), insertIndex: 0 },
			model.ranked,
		);

		for (const batch of [reparent, reorder]) {
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
			{ parent: null, peers: peersWithout(model.roots, dragged), insertIndex: 0 },
			model.ranked,
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
		const peers = peersWithout(model.roots, dragged);

		// Outdenting a root appends at the end of the root group — positionally a no-op.
		const writes = computeDropWrites(dragged, { parent: null, peers, insertIndex: peers.length }, model.ranked);

		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeNull();
	});

	it('omits the parent write when reordering within the same parent', () => {
		const { model, get } = fixture();
		const dragged = get('Feature B2');
		const parent = get('Epic B');
		const writes = computeDropWrites(
			dragged,
			{ parent, peers: peersWithout(parent.children, dragged), insertIndex: 0 },
			model.ranked,
		);
		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeUndefined();
		// Globally, Epic A (10) sits below Feature B1 (13): the midpoint of the two.
		expect(writes[0].order).toBe(11.5);
	});

	it('anchors on the destination when the peer group is empty', () => {
		const { model, get } = fixture();
		const dragged = get('Epic A');
		const parent = get('Feature B2');
		// First child of an otherwise-empty parent: the anchor is the destination
		// itself, and the number comes from ITS global neighbours (Feature B1 below,
		// Epic B above) rather than a flat default.
		const writes = computeDropWrites(dragged, { parent, peers: [], insertIndex: 0 }, model.ranked);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(18);
	});

	it('reads the whole loaded population, not a projection slice', () => {
		// A catalog `Test suite` ranked 15 sits between the two real Epics (10, 20).
		// It is loaded and not hidden by the Base, so ranking against just the two
		// real roots (what `peers` holds here) must not skip over it — this is the
		// case `model.results` gets wrong, per `src/domain/CLAUDE.md`.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Test suite.md', { frontmatter: { type: 'Test suite', order: 15 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Mover.md', { frontmatter: { type: 'Epic', order: 99 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		const dragged = get('Mover');
		const epicA = get('Epic A');
		const epicB = get('Epic B');
		// Drop Mover after Epic A: the peer list here is only the two real Epics
		// (as `realRoots` presents them), but the NUMBER must still respect the
		// Test suite's 15 sitting between them.
		const writes = computeDropWrites(
			dragged,
			{ parent: null, peers: [epicA, epicB], insertIndex: 1 },
			model.ranked,
		);
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(12.5);
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
		const noType = writes.find((w) => w.file.path === 'NoType.md');
		expect(noType?.typeName).toBe('Epic');
		expect(noType?.order).toBeUndefined();
		// One sequence over the whole walk, seeded past the highest rank in the vault
		// (11) and spent in DFS order: Complete's child first, then the last root.
		const child = writes.find((w) => w.file.path === 'Child.md');
		expect(child?.typeName).toBe('Feature');
		expect(child?.order).toBe(Math.floor(11) + ORDER_SPACING);
		const noOrder = writes.find((w) => w.file.path === 'NoOrder.md');
		expect(noOrder?.order).toBe(Math.floor(11) + 2 * ORDER_SPACING);
		expect(noOrder?.typeName).toBeUndefined();
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

		// One sequence for the whole tree, seeded past Epic.md's 10 and spent in DFS
		// order — Feat, then its child, then the hidden branch. The hidden branch is
		// backfilled too, which is what this test is about.
		expect(byPath.get('Feat.md')?.order).toBe(1010);
		expect(byPath.get('Story.md')?.typeName).toBe('PBI');
		expect(byPath.get('Story.md')?.order).toBe(2010);
		expect(byPath.get('Bare Epic.md')?.order).toBe(3010);
	});

	it('backfills orders with one running counter across the whole tree', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F3.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);

		const writes = computeInitWrites(model, settings);

		// One sequence for the whole DFS. A counter per sibling group handed the first
		// child of every group the same 1000, which under a global rank is a duplicate.
		expect(writes.map((w) => w.order)).toEqual([1000, 2000, 3000, 4000, 5000]);
	});

	it('never repeats a rank when the counter cannot advance', () => {
		const vault = new FakeVault();
		// At 1e20 the IEEE-754 unit is wider than ORDER_SPACING, so `floor(n) + 1000` IS n.
		// Reachable frontmatter, not a hypothetical — the same arithmetic `midpoint` and
		// `edgeRank` refuse against, in the one place that used to fail OPEN instead.
		vault.addFile('Huge.md', { frontmatter: { type: 'Epic', order: 1e20 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const orders = computeInitWrites(model, settings)
			.map((w) => w.order)
			.filter((order): order is number => order !== undefined);

		// Whatever it writes, it must not write the same number twice — and must not write
		// `Huge`'s own number onto anything.
		expect(new Set(orders).size).toBe(orders.length);
		expect(orders).not.toContain(1e20);
		// The control: the same two notes at an ordinary magnitude are ranked, so the
		// assertion above is not passing on an empty list by accident.
		const ordinary = new FakeVault();
		ordinary.addFile('Small.md', { frontmatter: { type: 'Epic', order: 10 } });
		ordinary.addFile('C.md', { frontmatter: { type: 'Epic' } });
		ordinary.addFile('D.md', { frontmatter: { type: 'Epic' } });
		const ordinaryModel = buildModel(ordinary.app, ordinary.entries(), settings);
		expect(computeInitWrites(ordinaryModel, settings).map((w) => w.order)).toEqual([1010, 2010]);
	});

	it('ranks every missing order distinctly without reordering the tree', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('A2.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic B' });
		vault.addFile('B2.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic B' });
		const drawn = (m: ReturnType<typeof buildModel>): string[] => m.items.map((i) => i.title);
		const model = buildModel(vault.app, vault.entries(), settings);
		const before = drawn(model);

		for (const write of computeInitWrites(model, settings)) {
			vault.setFrontmatter(write.file.path, { ...vault.fm(write.file.path), order: write.order });
		}
		const after = buildModel(vault.app, vault.entries(), settings);
		const orders = after.items.map((i) => i.order);

		// Two unranked items under two different parents, and the ✨ that makes a vault
		// work must not manufacture the ties that force the read side back to tree order.
		expect(orders).not.toContain(null);
		expect(new Set(orders).size).toBe(orders.length);
		// Nor may it move a row the user can already see.
		expect(drawn(after)).toEqual(before);
	});
});

/**
 * The peer fallback in `dropPlacement`. Two tests, and the second matters as much as the
 * first: without it a fallback that fired ALWAYS would pass the legacy case and quietly
 * make every seeded drop sibling-scoped again.
 */
describe('a drop in an unmigrated vault', () => {
	/** Legacy, sibling-scoped ranks: Epic A and its first child both hold 10. */
	function legacy() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('A2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const get = (title: string): BacklogItem => {
			const item = model.items.find((i) => i.title === title);
			if (!item) throw new Error(`missing fixture item ${title}`);
			return item;
		};
		return { model, get };
	}

	it('still reorders, ranking among the peers when the global neighbours give no gap', () => {
		const { model, get } = legacy();
		const dragged = get('A2');
		// A2's global neighbours around A1 are Epic A (10) and A1 (10) — a gap of zero,
		// so the global placement refuses and every legacy vault would lose ordinary
		// tree reordering. Among the peers alone, A1 is the first and A2 goes before it.
		const writes = computeDropWrites(dragged, { parent: get('Epic A'), peers: [get('A1')], insertIndex: 0 }, model.ranked);
		expect(writes).toEqual([{ file: dragged.file, parent: undefined, order: 10 - ORDER_SPACING }]);
	});

	it('does not fire on a seeded vault: the number is still the GLOBAL midpoint', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 4000 }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const find = (title: string): BacklogItem => model.items.find((i) => i.title === title) as BacklogItem;
		const dragged = find('B1');

		const writes = computeDropWrites(dragged, { parent: find('Epic A'), peers: [find('A1')], insertIndex: 1 }, model.ranked);

		// 2500 — the midpoint of A1 (2000) and the next GLOBAL row, Epic B (3000). The
		// peer-only answer would be 3000 (one spacing past the only peer), so this number
		// is the proof the fallback did not run.
		expect(writes).toHaveLength(1);
		expect(writes[0].order).toBe(2500);
	});
});
