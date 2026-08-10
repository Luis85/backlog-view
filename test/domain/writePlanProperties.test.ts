import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { BacklogItem } from '../../src/domain/model';
import { buildModel } from '../../src/domain/model';
import {
	computeDeliverableStateWrites,
	computeInitWrites,
	computeAssigneeWrites,
	computeRiskWrites,
	computeTestStateWrites,
} from '../../src/domain/writePlan';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();




/**
 * The write plans for the OPTIONAL properties — the Deliverable workflow's state, the
 * risk level, and the stubs a backfill creates for them.
 *
 * Split from `writePlan.test.ts` when merging `Idea`'s risk property and the Deliverable
 * workflow put that file past the 450-line test budget. They share a subject: each is a
 * property that may not be configured at all, so every case here is about the difference
 * between "no value" and "no key".
 */
describe('computeDeliverableStateWrites', () => {
	function deliverable(state: string | null) {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, ...(state !== null ? { deliverableStatus: state } : {}) },
		});
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const model = buildModel(vault.app, vault.entries(), settings);
		return model.results[0];
	}

	it('writes the canonical value, untransformed', () => {
		const item = deliverable('Draft');
		expect(computeDeliverableStateWrites(item, 'Review')).toEqual([{ file: item.file, deliverableState: 'Review' }]);
	});

	it('plans nothing for a re-pick of the same state, case-insensitively', () => {
		expect(computeDeliverableStateWrites(deliverable('draft'), 'Draft')).toEqual([]);
	});

	it('removes the key for a drop on the no-state column', () => {
		const item = deliverable('Draft');
		const writes = computeDeliverableStateWrites(item, null);
		expect(writes).toEqual([{ file: item.file, removeDeliverableStateKey: true }]);
	});

	it('plans nothing for a stateless card dropped on the no-state column', () => {
		expect(computeDeliverableStateWrites(deliverable(null), null)).toEqual([]);
	});
});

/** `computeDeliverableStateWrites`'s four cases, over the test workflow's own key. */
describe('computeTestStateWrites', () => {
	// A `Test case` is a catalog member (`inCatalog`), so it is never in `model.results` —
	// that is the PLAN's own population — and comes from `model.catalog.results` instead.
	function testCase(state: string | null) {
		const vault = new FakeVault();
		vault.addFile('C.md', {
			frontmatter: { type: 'Test case', order: 10, ...(state !== null ? { testStatus: state } : {}) },
		});
		const settings = settingsWith({ testStateKey: 'testStatus' });
		const model = buildModel(vault.app, vault.entries(), settings);
		return model.catalog.results[0];
	}

	it('writes the canonical value, untransformed', () => {
		const item = testCase('Draft');
		expect(computeTestStateWrites(item, 'Ready')).toEqual([{ file: item.file, testState: 'Ready' }]);
	});

	it('plans nothing for a re-pick of the same state, case-insensitively', () => {
		expect(computeTestStateWrites(testCase('draft'), 'Draft')).toEqual([]);
	});

	it('removes the key for a drop on the no-state column', () => {
		const item = testCase('Draft');
		const writes = computeTestStateWrites(item, null);
		expect(writes).toEqual([{ file: item.file, removeTestStateKey: true }]);
	});

	it('plans nothing for a stateless case dropped on the no-state column', () => {
		expect(computeTestStateWrites(testCase(null), null)).toEqual([]);
	});
});

describe('computeInitWrites — the Deliverable state stub', () => {
	it('backfills the Deliverable state key only on Deliverable-typed items', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10 } });
		const configured = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const model = buildModel(vault.app, vault.entries(), configured);

		const writes = computeInitWrites(model, configured);

		const forD = writes.find((w) => w.file.path === 'D.md');
		const forP = writes.find((w) => w.file.path === 'P.md');
		expect(forD?.stubs).toContain('deliverableState');
		expect(forP?.stubs ?? []).not.toContain('deliverableState');

	});
});

describe('computeInitWrites — the test workflow state stub', () => {
	it('stubs the test state on a catalog member and on nothing else', () => {
		// The Deliverable gate's mirror, and the ladder rather than a type name for the reason
		// every other membership test here uses it: a `Task` under a `Test case` is a catalog
		// member and a type-name gate would miss it.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
		vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
		const configured = settingsWith({ testStateKey: 'testStatus' });
		const model = buildModel(vault.app, vault.entries(), configured);
		const stubsFor = (path: string) =>
			computeInitWrites(model, configured).find((w) => w.file.path === path)?.stubs ?? [];
		expect(stubsFor('Case.md')).toContain('testState');
		expect(stubsFor('Test task.md')).toContain('testState');
		expect(stubsFor('Epic.md')).not.toContain('testState');
	});
});

describe('computeRiskWrites', () => {
	const risky = { ...settings, riskKey: 'risk' };

	/** One note with whatever risk frontmatter the case needs. */
	function item(frontmatter: Record<string, unknown>): BacklogItem {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, ...frontmatter } });
		const model = buildModel(vault.app, vault.entries(), risky);
		const found = model.items[0];
		if (!found) throw new Error('fixture item missing');
		return found;
	}

	it('writes the level picked', () => {
		expect(computeRiskWrites(item({}), '2 - Normal')).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), risk: '2 - Normal' },
		]);
	});

	it('plans nothing for a re-pick of the level the item holds, whatever its case', () => {
		// The one undo slot is not spent on a change nobody made — and the menu's
		// checkmark is this same answer, so the two cannot disagree.
		expect(computeRiskWrites(item({ risk: '1 - high' }), '1 - High')).toEqual([]);
	});

	it('removes the key only where there is one to remove', () => {
		// Presence, not value: the empty key the backfill leaves is a real thing to clear.
		expect(computeRiskWrites(item({ risk: '' }), null)).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), risk: null },
		]);
		expect(computeRiskWrites(item({}), null)).toEqual([]);
	});

	it('plans nothing at all when no risk property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, risk: '1 - High' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const unconfigured = model.items[0];
		if (!unconfigured) throw new Error('fixture item missing');

		// The note's value is invisible without a property naming it, so a clear has
		// nothing to take away and a pick is not a re-pick of anything.
		expect(computeRiskWrites(unconfigured, null)).toEqual([]);
		expect(computeRiskWrites(unconfigured, '1 - High')).toHaveLength(1);
	});
});

describe('computeAssigneeWrites', () => {
	const assigned = { ...settings, assigneeKey: 'assignee' };

	/** One note with whatever assignee frontmatter the case needs. */
	function item(frontmatter: Record<string, unknown>): BacklogItem {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, ...frontmatter } });
		const model = buildModel(vault.app, vault.entries(), assigned);
		const found = model.items[0];
		if (!found) throw new Error('fixture item missing');
		return found;
	}

	it('writes the name picked, byte for byte', () => {
		expect(computeAssigneeWrites(item({}), 'Dana')).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), assignee: 'Dana' },
		]);
	});

	it('plans nothing for a re-pick of the name the item holds, whatever its case', () => {
		// The risk plan's rule over the observed vocabulary: a note spelling a name its
		// own way is not a different person, and the menu's checkmark asks this same
		// function rather than a comparison written beside it.
		expect(computeAssigneeWrites(item({ assignee: 'dana' }), 'Dana')).toEqual([]);
	});

	it('removes the key only where there is one to remove', () => {
		// Presence, not value: the empty key the backfill leaves is a real thing to clear.
		expect(computeAssigneeWrites(item({ assignee: '' }), null)).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), assignee: null },
		]);
		expect(computeAssigneeWrites(item({}), null)).toEqual([]);
	});

	it('plans nothing at all when no assignee property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, assignee: 'Dana' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const unconfigured = model.items[0];
		if (!unconfigured) throw new Error('fixture item missing');

		expect(computeAssigneeWrites(unconfigured, null)).toEqual([]);
		expect(computeAssigneeWrites(unconfigured, 'Dana')).toHaveLength(1);
	});
});
