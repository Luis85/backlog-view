import { describe, expect, it } from 'vitest';
import { dropTargetFor, isInvalidParent, zoneForRatio } from '../../src/domain/dropTargets';
import { computeDropWrites } from '../../src/domain/writePlan';
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
		expect(target?.peers.map((s) => s.title)).toEqual(['Feature B1', 'Feature B2']);
	});

	it('rejects drops into the dragged item’s own subtree', () => {
		const { model, get } = fixture();
		const epicB = get('Epic B');
		expect(dropTargetFor(model, get('Feature B1'), 'inside', epicB, plan)).toBeNull();
		expect(dropTargetFor(model, get('Feature B1'), 'before', epicB, plan)).toBeNull();
		expect(isInvalidParent(get('Feature B1'), epicB)).toBe(true);
	});

	it('refuses a positional drop of an item onto itself', () => {
		// `siblingPosition` filters the dragged item OUT of the sibling list before looking
		// the hovered item up in it — when the two are the same item, that lookup can only
		// fail. A real pointer can hover the row it is dragging before the release moves
		// elsewhere, so this is not purely defensive.
		const { model, get } = fixture();
		const b1 = get('Feature B1');
		expect(dropTargetFor(model, b1, 'before', b1, plan)).toBeNull();
		expect(dropTargetFor(model, b1, 'after', b1, plan)).toBeNull();
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

	it('leaves an unresolved parent link UNTOUCHED on a focused rank, writing only order', () => {
		// Fix round 2 (Codex, rated P2 — the coordinator called that wrong): the focus
		// branch sets `target.parent = dragged.parent`, which for an unresolved link is
		// `null`. `computeParentField` used to read that as `parent === null,
		// dragged.parent === null, hasParentValue === true` — indistinguishable from an
		// EXPLICIT top-level drop — and deleted the property. `DropTarget.parentUnchanged`
		// is what tells them apart now: the focus branch sets it, so `computeParentField`
		// never runs the stale-link heuristic against a restated value at all.
		const vault = new FakeVault();
		vault.addFile('PBI Other.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('PBI Orphan.md', { frontmatter: { type: 'PBI', order: 30 }, parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		const orphan = get('PBI Orphan');
		const other = get('PBI Other');
		expect(orphan.parent).toBeNull();
		expect(orphan.hasParentValue).toBe(true);

		const target = dropTargetFor(model, other, 'before', orphan, plan);
		expect(target).not.toBeNull();
		const writes = computeDropWrites(orphan, target!, model.ranked);

		expect(writes).toHaveLength(1);
		// The write's parent field, not the note's eventual value — `undefined` here means
		// `storage/frontmatter.ts` never touches the key at all, which a note's own read-back
		// value cannot distinguish from "written back to what it already was".
		expect(writes[0].parent).toBeUndefined();
		expect(typeof writes[0].order).toBe('number');
	});

	it('still clears a stale parent link on an ordinary root drop — the write, not just the target shape', () => {
		// The behaviour the fix above must not break: dragging a stale-link root among
		// the other roots is an EXPLICIT top-level placement, and `parentUnchanged` is
		// unset here (this is the plain tree path), so the stale-link heuristic still
		// runs and still clears the key.
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const root = model.roots[0];
		const orphan = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;

		const target = dropTargetFor(model, root, 'after', orphan, plan);
		expect(target).not.toBeNull();
		const writes = computeDropWrites(orphan, target!, model.ranked);

		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBeNull();
	});

	it('ranks a sibling drop between focus roots — a legal move now, not a refusal', () => {
		// Task 5: a focus row is a ranking destination, so `siblingPosition` no longer
		// refuses on `item.focusRoot`. b1 and b2 share a real parent here (both are
		// `Epic B`'s features), so the parent this plans is the one they already have.
		const { vault } = fixture();
		const focusSettings = { ...settings, focusLevel: 'Feature' };
		const model = buildModel(vault.app, vault.entries(), focusSettings);
		const [b1, b2] = model.roots;

		const before = dropTargetFor(model, b1, 'before', b2, plan);
		expect(before?.parent).toBe(b2.parent);
		expect(before?.insertIndex).toBe(0);
		// After b1 is the slot b2 already occupies (`model.roots` is `[b1, b2]`) — a
		// no-op, asked against the focus list rather than refused for a different reason.
		expect(dropTargetFor(model, b1, 'after', b2, plan)).toBeNull();
		// Nesting under a focus root stays a legitimate reparent
		const inside = dropTargetFor(model, b1, 'inside', b2, plan);
		expect(inside?.parent).toBe(b1);
	});

	it('refuses a descendant dropped beside its own focus-root parent — it is not itself a focus row', () => {
		// Focus at PBI. PBI B1 is a focus root; its own child Task is drawn and fully
		// draggable (only ancestors above the focus level are hidden). Dropping Task
		// after its own parent must still refuse: `item` (PBI B1) is a `model.roots`
		// member but `dragged` (Task) is not, and checking `item` alone would let the
		// branch fire, keeping Task's real parent while ranking it among the two
		// unrelated top-level PBIs — a descendant silently promoted to a rank it does
		// not belong to.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 30 } });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 40 }, parentLink: 'Epic B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI B1' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;

		expect(dropTargetFor(model, get('PBI B1'), 'after', get('Task'), plan)).toBeNull();
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

	it('positions a drop even when the sibling group holds a context row', () => {
		// `DropTarget.peers` is intent, never arithmetic (see its own doc comment):
		// `dropTargetFor` states WHERE among the rendered siblings the drop lands, and
		// says nothing about whether ranking it would write anything. That question —
		// and the guarantee that it can never write to the context row itself — is
		// `computeDropWrites`'s, asked separately (see `test/domain/writePlan.test.ts`
		// and `writePlanContextRows.test.ts`).
		const { model, epic, featureB, mover } = mixedGroup();
		// Feature B is an ordinary result, but its sibling group holds a context row
		expect(featureB.outsideFilter).toBe(false);
		expect(epic.children.some((c) => c.outsideFilter)).toBe(true);

		const before = dropTargetFor(model, featureB, 'before', mover, plan);
		expect(before?.parent).toBe(epic);
		expect(before?.peers.some((p) => p.outsideFilter)).toBe(true);
		expect(dropTargetFor(model, featureB, 'after', mover, plan)).not.toBeNull();
	});

	it('still allows appending into the parent', () => {
		const { model, epic, mover } = mixedGroup();
		expect(dropTargetFor(model, epic, 'inside', mover, plan)?.parent).toBe(epic);
	});
});

describe('the tree branch of siblingPosition drops an unranked context row from its population', () => {
	/**
	 * Two context siblings in the SAME group, one ranked (an `order` frontmatter value)
	 * and one not — so a single fixture answers both halves of the rule: the unranked one
	 * is never a peer to rank among, and the ranked one still is, because its order is a
	 * real placement constraint. `rankablePeers` is asked of `model.realRoots` here, the
	 * ROOT population — `nestedFixture` below asks the same question of `parent.children`.
	 */
	function rootFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		vault.addFile('Epic Ranked.md', { frontmatter: { type: 'Epic', order: 1500 } });
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 1600 }, parentLink: 'Epic Ranked' });
		vault.addFile('Epic Unranked.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature U1.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic Unranked' });
		const filtered = vault
			.entries()
			.filter((e) => !['Epic Ranked.md', 'Epic Unranked.md'].includes(e.file.path));
		const model = buildModel(vault.app, filtered, settings);
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		return { model, get };
	}

	/** Same shape, one level down: an Epic parent holding the four Feature-level siblings. */
	function nestedFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 1000 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'Epic' });
		vault.addFile('Feature Ranked.md', { frontmatter: { type: 'Feature', order: 1500 }, parentLink: 'Epic' });
		vault.addFile('Task R1.md', { frontmatter: { type: 'Task', order: 1600 }, parentLink: 'Feature Ranked' });
		vault.addFile('Feature Unranked.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Task U1.md', { frontmatter: { type: 'Task', order: 3000 }, parentLink: 'Feature Unranked' });
		const filtered = vault
			.entries()
			.filter((e) => !['Feature Ranked.md', 'Feature Unranked.md'].includes(e.file.path));
		const model = buildModel(vault.app, filtered, settings);
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		return { model, get };
	}

	it('drops the unranked context row and keeps the ranked one, at model.realRoots', () => {
		const { model, get } = rootFixture();
		const ranked = get('Epic Ranked');
		const unranked = get('Epic Unranked');
		expect(ranked.outsideFilter).toBe(true);
		expect(ranked.order).toBe(1500);
		expect(unranked.outsideFilter).toBe(true);
		expect(unranked.order).toBeNull();

		// A plain reorder among the two writable roots — the population it ranks among is
		// the assertion, not the write itself.
		const target = dropTargetFor(model, get('Epic A'), 'after', get('Epic B'), plan);
		expect(target).not.toBeNull();
		expect(target?.peers).toContain(ranked);
		expect(target?.peers).not.toContain(unranked);
	});

	it('drops the unranked context row and keeps the ranked one, at parent.children', () => {
		const { model, get } = nestedFixture();
		const ranked = get('Feature Ranked');
		const unranked = get('Feature Unranked');
		expect(ranked.outsideFilter).toBe(true);
		expect(ranked.order).toBe(1500);
		expect(unranked.outsideFilter).toBe(true);
		expect(unranked.order).toBeNull();

		const target = dropTargetFor(model, get('Feature A'), 'after', get('Feature B'), plan);
		expect(target).not.toBeNull();
		expect(target?.peers).toContain(ranked);
		expect(target?.peers).not.toContain(unranked);
	});
});

describe('insidePosition drops an unranked trailing context row from its population', () => {
	/**
	 * Task 4: `insidePosition` built `peers` from `item.children` unfiltered, so an
	 * `inside` drop whose hovered parent's last child is an unranked context row anchored
	 * on that row — `anchoredOrder` skips it as a candidate anchor and recurses to
	 * "append after the END of the whole ranked population" instead of after the parent's
	 * own last real child. `Far` is ranked far above everything under `Epic`, so the two
	 * readings land on visibly different numbers rather than agreeing by coincidence.
	 *
	 * `Ctx Ranked` is the control the same fixture buys for free: a RANKED context row
	 * (its own `order`) stays a peer and is the anchor the fix actually lands on, so this
	 * one fixture proves both halves of the rule at once.
	 */
	function fixtureWithTrailingContext() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 100 }, parentLink: 'Epic' });
		vault.addFile('Ctx Ranked.md', { frontmatter: { type: 'Feature', order: 150 }, parentLink: 'Epic' });
		vault.addFile('Ctx Ranked Task.md', { frontmatter: { type: 'Task', order: 1 }, parentLink: 'Ctx Ranked' });
		vault.addFile('Ctx Unranked.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Ctx Unranked Task.md', { frontmatter: { type: 'Task', order: 2 }, parentLink: 'Ctx Unranked' });
		vault.addFile('Other.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Far.md', { frontmatter: { type: 'Feature', order: 90000 }, parentLink: 'Other' });
		vault.addFile('Mover.md', { frontmatter: { type: 'Epic', order: 20 } });
		const filtered = vault
			.entries()
			.filter((e) => !['Ctx Ranked.md', 'Ctx Unranked.md'].includes(e.file.path));
		const model = buildModel(vault.app, filtered, settings);
		const get = (title: string) => model.items.find((i) => i.title === title) as BacklogItem;
		return { model, get };
	}

	it('anchors on the last RANKED peer and drops the trailing unranked one, in both the target and the write', () => {
		const { model, get } = fixtureWithTrailingContext();
		const epic = get('Epic');
		const ctxRanked = get('Ctx Ranked');
		const ctxUnranked = get('Ctx Unranked');
		const mover = get('Mover');
		expect(ctxRanked.outsideFilter).toBe(true);
		expect(ctxRanked.order).toBe(150);
		expect(ctxUnranked.outsideFilter).toBe(true);
		expect(ctxUnranked.order).toBeNull();

		const target = dropTargetFor(model, epic, 'inside', mover, plan);
		expect(target).not.toBeNull();
		// Over-application check: a RANKED context row is still a real peer.
		expect(target?.peers).toContain(ctxRanked);
		// The unranked one is not — it constrains nothing and is dropped.
		expect(target?.peers).not.toContain(ctxUnranked);

		// The written NUMBER, not just the parent: anchored on `Ctx Ranked` (150), a
		// midpoint against its own next neighbour in the GLOBAL population (`Far`, 90000) —
		// 45075. The unfiltered anchor (`Ctx Unranked`, no rank) reads as "append past the
		// end of the whole population" instead and writes one spacing past `Far` itself,
		// 91000 — a different number entirely, and nowhere near either of `Epic`'s own
		// children.
		const writes = computeDropWrites(mover, target!, model.ranked);
		expect(writes).toHaveLength(1);
		expect(writes[0].parent).toBe(epic.file);
		expect(writes[0].order).toBe(45075);
	});
});
