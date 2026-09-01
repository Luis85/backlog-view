import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { assignedRows, assignedTo, nextAssigned, pickedResource } from '../../src/domain/assignedWork';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

function model(vault: FakeVault) {
	return buildModel(
		vault.app,
		vault.entries(),
		settingsWith({ typeKey: 'type', parentKey: 'parent', orderKey: 'order', stateKey: 'state', assigneeKey: 'assignee' }),
	);
}

/** Stand-in for a Base filtered to one level or state — same shape `modelContextRows.test.ts` uses. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

function peopleVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('People/Bo.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
	vault.addFile('Mine.md', { frontmatter: { type: 'PBI', order: 10, state: 'Doing', assignee: 'Ada' }, parentLink: 'Feature' });
	vault.addFile('Theirs.md', { frontmatter: { type: 'PBI', order: 20, assignee: 'Bo' }, parentLink: 'Feature' });
	return vault;
}

describe('pickedResource', () => {
	it('finds the person on the roster by path', () => {
		const found = pickedResource(model(peopleVault()), 'People/Ada.md');
		expect(found?.file.path).toBe('People/Ada.md');
	});

	it('is null for a path that names no Resource note', () => {
		expect(pickedResource(model(peopleVault()), 'Feature.md')).toBeNull();
	});
});

describe('assignedTo', () => {
	it('is true only when the assignee link resolves to this exact note', () => {
		const m = model(peopleVault());
		const mine = m.byPath.get('Mine.md')!;
		const theirs = m.byPath.get('Theirs.md')!;
		expect(assignedTo(mine, 'People/Ada.md')).toBe(true);
		expect(assignedTo(theirs, 'People/Ada.md')).toBe(false);
	});
});

describe('assignedRows', () => {
	it('keeps the items whose assignee link resolves to this person', () => {
		const rows = assignedRows(model(peopleVault()), 'People/Ada.md');
		expect(rows.map((r) => r.item.file.path)).toEqual(['Feature.md', 'Mine.md']);
		expect(rows[0].context).toBe(true);
		expect(rows[1].context).toBe(false);
	});

	it('matches the NOTE, never the spelling', () => {
		// Two items naming Ada through different link text — a bare name and a path — land
		// in one tree, because the roster is notes rather than strings.
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('ByName.md', { frontmatter: { type: 'PBI', order: 10, assignee: 'Ada' }, parentLink: 'Feature' });
		vault.addFile('ByPath.md', { frontmatter: { type: 'PBI', order: 20, assignee: 'People/Ada' }, parentLink: 'Feature' });

		const rows = assignedRows(model(vault), 'People/Ada.md');
		expect(rows.map((r) => r.item.file.path)).toEqual(['Feature.md', 'ByName.md', 'ByPath.md']);
	});

	it('never makes an excluded item a member, even when it names this person', () => {
		// An outsideFilter item with the right assignee is not a member. It may still be
		// drawn as context for a member below it, and it is never a write target.
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Excluded.md', { frontmatter: { type: 'PBI', order: 10, assignee: 'Ada' }, parentLink: 'Feature' });
		vault.addFile('Child.md', { frontmatter: { type: 'Task', order: 10, assignee: 'Ada' }, parentLink: 'Excluded' });

		// The Base's filter excludes `Excluded.md` from the results.
		const m = buildModel(
			vault.app,
			only(vault, 'Feature.md', 'Child.md'),
			settingsWith({ typeKey: 'type', parentKey: 'parent', orderKey: 'order', stateKey: 'state', assigneeKey: 'assignee' }),
		);
		expect(m.byPath.get('Excluded.md')?.outsideFilter).toBe(true);

		const rows = assignedRows(m, 'People/Ada.md');
		expect(rows.map((r) => r.item.file.path)).toEqual(['Feature.md', 'Child.md']);
	});

	it('refuses an item that is not a row of the plan', () => {
		// An Iteration or a Release carrying an assignee is not work — `inPlan` says so.
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Sprint 1.md', { frontmatter: { type: 'Iteration', order: 10, assignee: 'Ada' } });
		vault.addFile('Release 1.md', { frontmatter: { type: 'Release', order: 20, assignee: 'Ada' } });

		const rows = assignedRows(model(vault), 'People/Ada.md');
		expect(rows).toEqual([]);
	});

	describe('admits the test catalog', () => {
		function catalogVault(): FakeVault {
			const vault = new FakeVault();
			vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
			vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
			vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10, assignee: 'Ada' }, parentLink: 'Suite' });
			vault.addFile('CaseTask.md', { frontmatter: { type: 'Task', order: 20, assignee: 'Ada' }, parentLink: 'Suite' });
			vault.addFile('Rel.md', { frontmatter: { type: 'Release', order: 30, assignee: 'Ada' } });
			vault.addFile('Iter.md', { frontmatter: { type: 'Iteration', order: 40, assignee: 'Ada' } });
			vault.addFile('Mile.md', { frontmatter: { type: 'Milestone', order: 50, assignee: 'Ada' } });
			return vault;
		}

		it('keeps an assigned Test case and an assigned Task chained onto a Test suite', () => {
			const rows = assignedRows(model(catalogVault()), 'People/Ada.md');
			expect(rows.map((r) => r.item.file.path)).toEqual(['Suite.md', 'Case.md', 'CaseTask.md']);
			expect(rows[0].context).toBe(true);
		});

		it('never admits an assigned Release, Iteration or Milestone', () => {
			const rows = assignedRows(model(catalogVault()), 'People/Ada.md');
			const paths = rows.map((r) => r.item.file.path);
			expect(paths).not.toContain('Rel.md');
			expect(paths).not.toContain('Iter.md');
			expect(paths).not.toContain('Mile.md');
		});
	});
});

describe('nextAssigned', () => {
	it('is the first unfinished MEMBER in plan order', () => {
		const rows = assignedRows(model(peopleVault()), 'People/Ada.md');
		expect(nextAssigned(rows)?.item.file.path).toBe('Mine.md');
	});

	it('never names a context row', () => {
		// An unfinished context ancestor sits ABOVE the first member in the walk, and is not
		// what to do next: the same list refuses to write to it.
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, state: 'Done', assignee: 'Ada' }, parentLink: 'Feature' });

		const rows = assignedRows(model(vault), 'People/Ada.md');
		expect(rows[0].context).toBe(true);
		expect(nextAssigned(rows)).toBeNull();
	});

	it('is null when everything of theirs is done', () => {
		// Nothing to mark, rather than a marker on a finished row.
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, state: 'Done', assignee: 'Ada' } });

		const rows = assignedRows(model(vault), 'People/Ada.md');
		expect(nextAssigned(rows)).toBeNull();
	});
});
