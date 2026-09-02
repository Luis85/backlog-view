import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { BacklogItem } from '../../src/domain/model';
import { buildModel } from '../../src/domain/model';
import { computeInitWrites } from '../../src/domain/rankBackfill';
import {
	computeDeliverableStateWrites,
	computeAssigneeWrites,
	computePriorityWrites,
	computeResourceMoveWrites,
	computeRiskWrites,
	computeTestStateWrites,
} from '../../src/domain/writePlan';
import { stubKeys } from '../../src/storage/writeKeys';
import { applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
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

		const writes = computeInitWrites(model, configured).writes;

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
			computeInitWrites(model, configured).writes.find((w) => w.file.path === path)?.stubs ?? [];
		expect(stubsFor('Case.md')).toContain('testState');
		expect(stubsFor('Test task.md')).toContain('testState');
		expect(stubsFor('Epic.md')).not.toContain('testState');
	});

	it('stubs the requirements state only on items whose workflow reads it', () => {
		// Both secondary workflows on keys of their own, so neither a test nor a Deliverable
		// reads `status` — and a stub for it would be an empty property the row never uses.
		// The Deliverable half is not new: `state` has never had a membership gate.
		//
		// A typeless child of `Case.md` sits beside it: a wrong `isTestType(item.typeName)`
		// gate would pass on `Case.md` alone (it IS typed `Test case`) while missing this
		// row, which is a catalog member only by its LADDER — the same distinction the
		// membership rule states everywhere else in this codebase.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
		vault.addFile('Typeless.md', { frontmatter: { order: 10 }, parentLink: 'Case' });
		vault.addFile('Runbook.md', { frontmatter: { type: 'Deliverable', order: 30 } });
		const settings = settingsWith({
			stateKey: 'status',
			testStateKey: 'testStatus',
			deliverableStateKey: 'docStatus',
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		const stubsFor = (path: string) =>
			computeInitWrites(model, settings).writes.find((w) => w.file.path === path)?.stubs ?? [];
		expect(stubsFor('Epic.md')).toContain('state');
		expect(stubsFor('Case.md')).not.toContain('state');
		expect(stubsFor('Typeless.md')).not.toContain('state');
		expect(stubsFor('Runbook.md')).not.toContain('state');
		// And each still gets its OWN workflow's key, so this narrows nothing it should not.
		expect(stubsFor('Case.md')).toContain('testState');
		expect(stubsFor('Typeless.md')).toContain('testState');
		expect(stubsFor('Runbook.md')).toContain('deliverableState');
	});

	it('stubs the requirements state on every item when the secondary keys fall back to it', () => {
		// The narrowing above only fires while a secondary key is its OWN, distinct
		// property. Left unset (the shipped default), both secondaries fall back to
		// `stateKey` — so `state` belongs on a catalog member and a Deliverable too, same
		// as on a plan item. A CATEGORY-shaped gate (skip `state` outright for a
		// Deliverable or a catalog member, the form the two pre-existing gates used) gets
		// this backwards: it would stop ✨ from ever creating the very key these rows read
		// on a fresh vault.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
		vault.addFile('Runbook.md', { frontmatter: { type: 'Deliverable', order: 30 } });
		const settings = settingsWith({ stateKey: 'status' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const stubsFor = (path: string) =>
			computeInitWrites(model, settings).writes.find((w) => w.file.path === path)?.stubs ?? [];
		expect(stubsFor('Epic.md')).toContain('state');
		expect(stubsFor('Case.md')).toContain('state');
		expect(stubsFor('Runbook.md')).toContain('state');
	});

	it('stubs every workflow-state field whose resolved key coincides, and names that key once', async () => {
		// `configProblems` exempts exactly these three labels from the collision report, so
		// a vault CAN point `state`, `deliverableState` and `testState` at one explicit key
		// on purpose. The gate asks each field's own resolved key against `stateKeyFor`, not
		// the item's category, so more than one field passes on the same item here.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 20 } });
		vault.addFile('Runbook.md', { frontmatter: { type: 'Deliverable', order: 30 } });
		const settings = settingsWith({ stateKey: 'status', deliverableStateKey: 'status', testStateKey: 'status' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const writeFor = (path: string) => computeInitWrites(model, settings).writes.find((w) => w.file.path === path);
		for (const path of ['Epic.md', 'Case.md', 'Runbook.md']) {
			expect(writeFor(path)?.stubs).toEqual(expect.arrayContaining(['state', 'deliverableState', 'testState']));
		}
		// `stubKeys` itself does NOT dedupe — it names the same raw key once per field, so
		// three fields sharing a key still produce three entries here.
		const epicWrite = writeFor('Epic.md');
		expect(stubKeys(settings, epicWrite?.stubs)).toEqual(['status', 'status', 'status']);
		// Two separate mechanisms turn those three into one property, and only the FIRST is
		// reachable from here: `touchedKeys` (`src/storage/writeKeys.ts`) dedupes the key
		// list, so the captured inverse names `status` once and the undo cannot read the
		// second copy as a restore conflict. Asserting on the note alone cannot see it —
		// writing `''` twice to a key looks exactly like writing it once, which is why
		// deleting that `[...new Set(keys)]` left this test green until the inverse was
		// asserted. The second mechanism is `applyInto`'s own presence guard, which skips a
		// key the live note already carries; its check is `never blanks a value written
		// since the plan was made` in `test/view/toolbar.test.ts`, since a stub landing on
		// an ABSENT key writes the same `''` with or without it.
		const inverses: RestoreWrite[] = [];
		await applyWrites(vault.app, settings, [epicWrite!], undefined, (inv) => inverses.push(inv));
		expect(inverses[0].keys).toHaveLength(1);
		expect(vault.fm('Epic.md').status).toBe('');
	});
});

describe('computeInitWrites — the iteration goal stub', () => {
	it('never stubs the iteration goal onto any note, including an Iteration itself', () => {
		// A goal belongs to one type; ✨ must not create it as an empty property on every
		// other note in the vault. Driven over one of each level plus the Iteration itself,
		// so the exclusion is checked against the type it is FOR and not only against types
		// it obviously should not touch.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Job.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Item' });
		vault.addFile('Sprint.md', { frontmatter: { type: 'Iteration', order: 10 } });
		const settings = settingsWith({ iterationGoalKey: 'goal', stateKey: 'status' });
		const model = buildModel(vault.app, vault.entries(), settings);

		const writes = computeInitWrites(model, settings).writes;
		for (const write of writes) {
			expect(stubKeys(settings, write.stubs)).not.toContain('goal');
		}
	});
});

describe('computeInitWrites — the release membership stub', () => {
	it('never stubs the release key onto any note', () => {
		// An empty release is not an empty slot: `membershipTarget` (`domain/releases.ts`)
		// reads a present-but-blank value as an UNRESOLVED membership rather than as "names
		// none", so a stub here would have ✨ report every work item in the vault as a broken
		// membership on the release index — the screen the property exists to populate.
		// Driven over one of each level plus a Release itself, like the goal's exclusion above.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Job.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Item' });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 } });
		const settings = settingsWith({ releaseKey: 'release', stateKey: 'status' });
		const model = buildModel(vault.app, vault.entries(), settings);

		const writes = computeInitWrites(model, settings).writes;
		for (const write of writes) {
			expect(write.stubs ?? []).not.toContain('release');
			expect(stubKeys(settings, write.stubs)).not.toContain('release');
		}
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

describe('computePriorityWrites', () => {
	// `computeRiskWrites`' own two rules, over the priority ladder — see `writePlan.ts`'s
	// header on why the two are separate functions rather than one shared by field name.
	const prioritized = { ...settings, priorityKey: 'priority' };

	/** One note with whatever priority frontmatter the case needs. */
	function item(frontmatter: Record<string, unknown>): BacklogItem {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, ...frontmatter } });
		const model = buildModel(vault.app, vault.entries(), prioritized);
		const found = model.items[0];
		if (!found) throw new Error('fixture item missing');
		return found;
	}

	it('writes the rung picked', () => {
		expect(computePriorityWrites(item({}), '2 - Normal')).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), priority: '2 - Normal' },
		]);
	});

	it('plans nothing for a re-pick of the rung the item holds, whatever its case', () => {
		expect(computePriorityWrites(item({ priority: '1 - high' }), '1 - High')).toEqual([]);
	});

	it('removes the key only where there is one to remove', () => {
		// Presence, not value: the empty key the backfill leaves is a real thing to clear.
		expect(computePriorityWrites(item({ priority: '' }), null)).toEqual([
			{ file: expect.objectContaining({ path: 'Item.md' }), priority: null },
		]);
		expect(computePriorityWrites(item({}), null)).toEqual([]);
	});

	it('plans nothing at all when no priority property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, priority: '1 - High' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const unconfigured = model.items[0];
		if (!unconfigured) throw new Error('fixture item missing');

		// The note's value is invisible without a property naming it, so a clear has
		// nothing to take away and a pick is not a re-pick of anything.
		expect(computePriorityWrites(unconfigured, null)).toEqual([]);
		expect(computePriorityWrites(unconfigured, '1 - High')).toHaveLength(1);
	});
});

/**
 * The write plans for the assignee — a LINK to a `Resource` note, and the one field this
 * feature owns two planners for: a plain pick (`computeAssigneeWrites`) and a resources-axis
 * move that may carry a date gesture beside it (`computeResourceMoveWrites`).
 */
describe('what an assignee pick writes', () => {
	/** An item, the resource it names, and a second resource to move it to. */
	function assigned(value: string | null) {
		const vault = new FakeVault();
		const alex = vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const sam = vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Item.md', {
			frontmatter: { type: 'PBI', order: 10, ...(value !== null ? { assignee: value } : {}) },
		});
		const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });
		const item = buildModel(vault.app, vault.entries(), settings).results[0];
		return { item, alex, sam };
	}

	it('plans the file, never a name', () => {
		const { item, alex } = assigned(null);
		expect(computeAssigneeWrites(item, alex)).toEqual([{ file: item.file, assignee: alex }]);
	});

	it('plans nothing when the item already names that note, compared by path', () => {
		// Two spellings of one note are one resource. This is also the menu's checkmark: an
		// entry is checked exactly when picking it would write nothing.
		const { item, alex } = assigned('[[Alex]]');
		expect(computeAssigneeWrites(item, alex)).toEqual([]);
	});

	it('plans a move to another resource', () => {
		const { item, sam } = assigned('[[Alex]]');
		expect(computeAssigneeWrites(item, sam)).toEqual([{ file: item.file, assignee: sam }]);
	});

	it('never treats an unresolved value as already there', () => {
		// A link that resolved to nothing has no path, so it matches no target — the leftover
		// string case, which must stay pickable rather than reading as current.
		const { item, alex } = assigned('Sarah');
		expect(computeAssigneeWrites(item, alex)).toEqual([{ file: item.file, assignee: alex }]);
	});

	it('plans a removal only where the key is present', () => {
		expect(computeAssigneeWrites(assigned('[[Alex]]').item, null)).toEqual([
			{ file: assigned('[[Alex]]').item.file, assignee: null },
		]);
		expect(computeAssigneeWrites(assigned(null).item, null)).toEqual([]);
	});
});

describe('computeResourceMoveWrites with a date gesture beside it', () => {
	/** An item already assigned to Ali, plus a second resource (Dana) to move it to. */
	function assigned() {
		const vault = new FakeVault();
		const ali = vault.addFile('Ali.md', { frontmatter: { type: 'Resource' } });
		const dana = vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, assignee: '[[Ali]]' } });
		const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });
		const item = buildModel(vault.app, vault.entries(), settings).results[0];
		return { item, ali, dana };
	}

	const schedule = { plan: { start: '2026-08-08', target: '2026-08-17' }, ends: ['start', 'target'] as const };

	it('puts both halves on ONE write, so the pair is one thing to take back', () => {
		const { item, dana } = assigned();
		const writes = computeResourceMoveWrites(item, dana, { ...schedule, ends: [...schedule.ends] });

		// Two records naming this file would capture two inverses, and an undo could then
		// return the row and keep the dates — a state the one gesture cannot describe.
		expect(writes).toHaveLength(1);
		expect(writes[0].assignee).toBe(dana);
		expect(writes[0].axis).toMatchObject({ start: '2026-08-08', target: '2026-08-17' });
	});

	it('carries whichever half actually changed, and nothing when neither did', () => {
		const { item, ali, dana } = assigned();

		// A slide inside one row: the target is a re-pick, so no assignee is named at all.
		expect(computeResourceMoveWrites(item, ali, { ...schedule, ends: [...schedule.ends] })[0]?.assignee).toBeUndefined();
		// A vertical drag: no gesture, so no axis write.
		expect(computeResourceMoveWrites(item, dana, null)[0]?.axis).toBeUndefined();
		// Neither: an empty batch, which is what keeps the undo slot for the move before.
		expect(computeResourceMoveWrites(item, ali, null)).toEqual([]);
	});
});
