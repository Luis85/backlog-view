import { describe, expect, it } from 'vitest';
import { dropTargetFor, isInvalidParent, rootDropTarget, zoneForRatio } from '../src/dropTargets';
import { BacklogItem, buildModel } from '../src/model';
import { defaultSettings } from '../src/settings';
import { FakeVault } from './helpers';

const settings = defaultSettings();

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
		const before = dropTargetFor(model, get('Feature B2'), 'before', dragged);
		expect(before?.parent?.title).toBe('Epic B');
		expect(before?.insertIndex).toBe(1);
		const after = dropTargetFor(model, get('Feature B2'), 'after', dragged);
		expect(after?.insertIndex).toBe(2);
	});

	it('appends at the end for inside drops', () => {
		const { model, get } = fixture();
		const target = dropTargetFor(model, get('Epic B'), 'inside', get('Epic A'));
		expect(target?.parent?.title).toBe('Epic B');
		expect(target?.insertIndex).toBe(2);
		expect(target?.siblings.map((s) => s.title)).toEqual(['Feature B1', 'Feature B2']);
	});

	it('rejects drops into the dragged item’s own subtree', () => {
		const { model, get } = fixture();
		const epicB = get('Epic B');
		expect(dropTargetFor(model, get('Feature B1'), 'inside', epicB)).toBeNull();
		expect(dropTargetFor(model, get('Feature B1'), 'before', epicB)).toBeNull();
		expect(isInvalidParent(get('Feature B1'), epicB)).toBe(true);
	});

	it('treats the currently occupied slot as a no-op', () => {
		const { model, get } = fixture();
		const b1 = get('Feature B1');
		// Before its own next sibling and after nothing = same slot
		expect(dropTargetFor(model, get('Feature B2'), 'before', b1)).toBeNull();
		expect(dropTargetFor(model, get('Epic B'), 'inside', get('Feature B2'))).toBeNull();
	});

	it('allows the same slot when it clears a stale parent link', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const orphan = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;

		const target = dropTargetFor(model, model.roots[0], 'after', orphan);
		expect(target).not.toBeNull();
		expect(target?.parent).toBeNull();
	});

	it('disallows sibling drops relative to focus roots', () => {
		const { vault } = fixture();
		const focusSettings = { ...settings, focusLevel: 'Feature' };
		const model = buildModel(vault.app, vault.entries(), focusSettings);
		const [b1, b2] = model.roots;

		expect(dropTargetFor(model, b1, 'before', b2)).toBeNull();
		expect(dropTargetFor(model, b1, 'after', b2)).toBeNull();
		// Nesting under a focus root stays a legitimate reparent
		const inside = dropTargetFor(model, b1, 'inside', b2);
		expect(inside?.parent).toBe(b1);
	});
});

describe('rootDropTarget', () => {
	it('appends after the other roots', () => {
		const { model, get } = fixture();
		const target = rootDropTarget(model, get('Feature B1'));
		expect(target?.parent).toBeNull();
		expect(target?.insertIndex).toBe(2);
	});

	it('is a no-op for the item already sitting as the last root', () => {
		const { model, get } = fixture();
		expect(rootDropTarget(model, get('Epic B'))).toBeNull();
	});

	it('still fires for a last root whose parent link is stale', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { order: 20 }, parentLink: 'Missing' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const orphan = model.roots.find((r) => r.title === 'Orphan') as BacklogItem;

		expect(rootDropTarget(model, orphan)).not.toBeNull();
	});

	it('is unavailable in focus mode', () => {
		const { vault } = fixture();
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });
		expect(rootDropTarget(model, model.roots[0])).toBeNull();
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

		expect(dropTargetFor(model, epic, 'before', children[0])).toBeNull();
		expect(dropTargetFor(model, epic, 'after', children[0])).toBeNull();
	});

	it('still accepts drops into it, so a match can be re-parented home', () => {
		const { model, epic, children } = outsideFixture();
		const target = dropTargetFor(model, epic, 'inside', children[1]);
		// Already its last child — the no-op rule applies, as for any other parent
		expect(target).toBeNull();

		const moved = dropTargetFor(model, epic, 'inside', children[0]);
		expect(moved?.parent).toBe(epic);
	});
});
