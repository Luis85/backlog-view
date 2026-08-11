import { describe, expect, it } from 'vitest';
import { dropTargetFor, isInvalidParent, zoneForRatio } from '../../src/domain/dropTargets';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';
import { projectionMember } from '../../src/view/projection';

const settings = defaultSettings();
// Every fixture here builds from a plan vocabulary (no catalog members), so the tree's
// own predicate exercises the real one rather than a stand-in that answers nothing.
const plan = projectionMember('tree');

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

describe('zoneForRatio', () => {
	it('maps row positions to zones', () => {
		expect(zoneForRatio(0.1, false)).toBe('before');
		expect(zoneForRatio(0.5, false)).toBe('inside');
		expect(zoneForRatio(0.9, false)).toBe('after');
		expect(zoneForRatio(0.25, false)).toBe('inside');
		expect(zoneForRatio(0.75, false)).toBe('inside');
	});

	it('narrows the nest zone on leaf rows', () => {
		// Reordering is the common intent on leaves — nesting needs a deliberate aim
		expect(zoneForRatio(0.3, true)).toBe('before');
		expect(zoneForRatio(0.5, true)).toBe('inside');
		expect(zoneForRatio(0.7, true)).toBe('after');
		expect(zoneForRatio(0.3, false)).toBe('inside');
	});
});

describe('dropTargetFor', () => {
	it('computes sibling insertion indices for before and after', () => {
		const { model, get } = fixture();
		const dragged = get('Epic A');
		const before = dropTargetFor(model, get('Feature B2'), 'before', dragged, plan);
		expect(before?.parent?.title).toBe('Epic B');
		expect(before?.insertIndex).toBe(1);
		const after = dropTargetFor(model, get('Feature B2'), 'after', dragged, plan);
		expect(after?.insertIndex).toBe(2);
	});

	it('appends at the end for inside drops', () => {
		const { model, get } = fixture();
		const target = dropTargetFor(model, get('Epic B'), 'inside', get('Epic A'), plan);
		expect(target?.parent?.title).toBe('Epic B');
		expect(target?.insertIndex).toBe(2);
		expect(target?.siblings.map((s) => s.title)).toEqual(['Feature B1', 'Feature B2']);
	});

	it('rejects drops into the dragged item’s own subtree', () => {
		const { model, get } = fixture();
		const epicB = get('Epic B');
		expect(dropTargetFor(model, get('Feature B1'), 'inside', epicB, plan)).toBeNull();
		expect(dropTargetFor(model, get('Feature B1'), 'before', epicB, plan)).toBeNull();
		expect(isInvalidParent(get('Feature B1'), epicB)).toBe(true);
	});

	it('treats the currently occupied slot as a no-op', () => {
		const { model, get } = fixture();
		const b1 = get('Feature B1');
		// Before its own next sibling and after nothing = same slot
		expect(dropTargetFor(model, get('Feature B2'), 'before', b1, plan)).toBeNull();
		expect(dropTargetFor(model, get('Epic B'), 'inside', get('Feature B2'), plan)).toBeNull();
	});

	it('allows the same slot when it clears a stale parent link', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const orphan = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;

		const target = dropTargetFor(model, model.roots[0], 'after', orphan, plan);
		expect(target).not.toBeNull();
		expect(target?.parent).toBeNull();
	});

	it('disallows sibling drops relative to focus roots', () => {
		const { vault } = fixture();
		const focusSettings = { ...settings, focusLevel: 'Feature' };
		const model = buildModel(vault.app, vault.entries(), focusSettings);
		const [b1, b2] = model.roots;

		expect(dropTargetFor(model, b1, 'before', b2, plan)).toBeNull();
		expect(dropTargetFor(model, b1, 'after', b2, plan)).toBeNull();
		// Nesting under a focus root stays a legitimate reparent
		const inside = dropTargetFor(model, b1, 'inside', b2, plan);
		expect(inside?.parent).toBe(b1);
	});

	it('treats a drop between visually adjacent roots as the no-op it looks like', () => {
		// Real roots interleave: Epic A, Suite, Epic B. The plan draws A then B with nothing
		// between them, so dropping A before B moves nothing on either screen — and must not
		// rewrite an order or spend the undo slot to say so. The rank is still asked of
		// `realRoots` (the suite included); only the no-op question moves to `plan`.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 30 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		expect(dropTargetFor(model, get('Epic B'), 'before', get('Epic A'), plan)).toBeNull();
		// The mirror direction of the same rule: a drop that DOES move the row is still
		// offered, so the no-op check is not simply refusing every adjacent-root drop.
		expect(dropTargetFor(model, get('Epic A'), 'before', get('Epic B'), plan)).not.toBeNull();
	});

	it('refuses a sibling drop that would move the row to the other projection', () => {
		// Dropping before or after a real ROOT takes the root group as the new parent, which
		// for a `Task` or a typeless note changes ladder — `ladderFor` re-answers with the
		// plan's and the row leaves the catalog it was dragged on. Since the drop on the
		// tree background was deleted this is the only DRAG that reaches a null parent, and
		// it asks the one predicate rather than a second guard that could disagree with it.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
		// The other input `ladderFor` chains from the parent, and the row that tells this
		// implementation apart from `typeName === 'Task'`.
		vault.addFile('Untyped.md', { frontmatter: { order: 20 }, parentLink: 'Case' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const catalogMember = projectionMember('catalog');
		const get = (path: string) => model.byPath.get(path) as BacklogItem;
		const suite = get('Suite.md');

		expect(dropTargetFor(model, suite, 'before', get('Test task.md'), catalogMember)).toBeNull();
		expect(dropTargetFor(model, suite, 'after', get('Untyped.md'), catalogMember)).toBeNull();
		// The mirror: a row whose own name decides its ladder still lands beside the suite.
		expect(dropTargetFor(model, suite, 'before', get('Case.md'), catalogMember)?.parent).toBeNull();
		// And nesting INSIDE a row of the same projection was never in question: the new
		// parent is drawn on the same screen, so it carries the same ladder.
		expect(dropTargetFor(model, suite, 'inside', get('Test task.md'), catalogMember)?.parent).toBe(suite);
	});
});

describe('dropTargetFor with parents outside the filter', () => {
	function outsideFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI 1.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI 2.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path !== 'Epic.md');
		const model = buildModel(vault.app, filtered, settings);
		return { model, epic: model.roots[0], children: model.roots[0].children };
	}

	it('refuses to rank against an ancestor whose siblings were never loaded', () => {
		const { model, epic, children } = outsideFixture();
		expect(epic.outsideFilter).toBe(true);

		expect(dropTargetFor(model, epic, 'before', children[0], plan)).toBeNull();
		expect(dropTargetFor(model, epic, 'after', children[0], plan)).toBeNull();
	});

	it('still accepts drops into it, so a match can be re-parented home', () => {
		const { model, epic, children } = outsideFixture();
		const target = dropTargetFor(model, epic, 'inside', children[1], plan);
		// Already its last child — the no-op rule applies, as for any other parent
		expect(target).toBeNull();

		const moved = dropTargetFor(model, epic, 'inside', children[0], plan);
		expect(moved?.parent).toBe(epic);
	});
});

describe('reordering a group that holds an outside-filter row', () => {
	/** Epic E over Feature A (context, its PBI matched) and Feature B (a result). */
	function mixedGroup() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		vault.addFile('Mover.md', { frontmatter: { type: 'Feature', order: 99 } });
		const filtered = vault.entries().filter((e) =>
			['Feature B.md', 'PBI.md', 'Mover.md'].includes(e.file.path),
		);
		const model = buildModel(vault.app, filtered, settings);
		return {
			model,
			epic: model.byPath.get('Epic.md') as BacklogItem,
			featureB: model.byPath.get('Feature B.md') as BacklogItem,
			mover: model.byPath.get('Mover.md') as BacklogItem,
		};
	}

	it('refuses positional drops even when the hovered row is a result', () => {
		const { model, epic, featureB, mover } = mixedGroup();
		// Feature B is an ordinary result, but its sibling group holds a context row
		expect(featureB.outsideFilter).toBe(false);
		expect(epic.children.some((c) => c.outsideFilter)).toBe(true);

		expect(dropTargetFor(model, featureB, 'before', mover, plan)).toBeNull();
		expect(dropTargetFor(model, featureB, 'after', mover, plan)).toBeNull();
	});

	it('still allows appending into the parent', () => {
		const { model, epic, mover } = mixedGroup();
		expect(dropTargetFor(model, epic, 'inside', mover, plan)?.parent).toBe(epic);
	});
});
