import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { assigneeName, resourceLabelsOf } from '../../src/domain/readItems';
import { buildRoadmap } from '../../src/domain/roadmap';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * `hierarchyOnly` OFF on purpose — that is the vault where every note a folder-scoped
 * base returns becomes an item, so the divert is what refuses a resource rather than the
 * scope prune. With it on, a check written without this case passes with the gate deleted.
 */
const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });

/** What the Base returned, when it did not return everything. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

describe('the roster the model keeps', () => {
	it('keeps every Resource note the base returned, alphabetically, and makes no item of one', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.resources.map((r) => r.title)).toEqual(['Alex', 'Sam']);
		expect(model.items.map((i) => i.title)).toEqual(['Epic A']);
	});

	it('keeps no resource the base did not return', () => {
		// A result naming a resource as its parent pulls that note in through
		// `loadOutsideParents` with no entry. It is not this base's vocabulary, so it is
		// not a row, not a menu entry and not a drop target.
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 }, parentLink: 'Alex' });
		const model = buildModel(vault.app, only(vault, 'Epic A.md'), settings);

		expect(model.resources).toEqual([]);
	});

	it('breaks a title tie by path, so two resources of one name sort the same way regardless of Base order', () => {
		// `localeCompare` returns 0 for two resources sharing a basename, so without a
		// tie-breaker `Array.sort`'s stability would hand them back in the incoming Bases
		// order — the one case where the alphabetical sort (chosen over Base order BECAUSE
		// it is stable across a Base's own sort changing) stops being stable itself.
		const forward = new FakeVault();
		forward.addFile('Support/Alex.md', { frontmatter: { type: 'Resource' } });
		forward.addFile('Team/Alex.md', { frontmatter: { type: 'Resource' } });
		const forwardModel = buildModel(forward.app, forward.entries(), settings);

		const reversed = new FakeVault();
		reversed.addFile('Team/Alex.md', { frontmatter: { type: 'Resource' } });
		reversed.addFile('Support/Alex.md', { frontmatter: { type: 'Resource' } });
		const reversedModel = buildModel(reversed.app, reversed.entries(), settings);

		expect(forwardModel.resources.map((r) => r.file.path)).toEqual(reversedModel.resources.map((r) => r.file.path));
	});

	it('builds the label index once, disambiguating a colliding pair and leaving a lone name plain', () => {
		// `assigneeBroken` and the assignee chip's label used to scan `resources` per row
		// (`.some`/`.find`) — an O(items × resources) cost with an allocation per row,
		// which this codebase's row-cost rule refuses a second superlinear pass over. The
		// map is built ONCE, here, so both call sites are an O(1) lookup instead (review,
		// PR #207 fix round 1).
		const vault = new FakeVault();
		vault.addFile('Team/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Support/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.resourceLabels.get('Team/Alex.md')).toBe('Team/Alex');
		expect(model.resourceLabels.get('Support/Alex.md')).toBe('Support/Alex');
		expect(model.resourceLabels.get('Sam.md')).toBe('Sam');
	});
});

describe('what an item says its assignee is', () => {
	it('shows the resolved resource note title, not the raw link text', () => {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: '[[Alex]]' } });
		const epic = buildModel(vault.app, vault.entries(), settings).items[0];

		expect(assigneeName(epic)).toBe('Alex');
		expect(epic.assigneeEntry?.file?.path).toBe('Alex.md');
	});

	it('resolves a BARE name to the note of that name, the way `parent` already does', () => {
		// `linkpathFromRawValue` strips brackets where there are any and passes a bare name
		// through, so this resolves. Decided 2026-08-28: a bare name that resolves to a
		// resource IS that resource, which is what keeps an upgrading vault's assignments.
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alex' } });
		const epic = buildModel(vault.app, vault.entries(), settings).items[0];

		expect(epic.assigneeEntry?.file?.path).toBe('Alex.md');
	});

	it('shows a value that resolves to nothing as its own text, and resolves to no note', () => {
		// Every plain string left over from before this shipped lands here. It is not an
		// error and is not repaired.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Sarah' } });
		const epic = buildModel(vault.app, vault.entries(), settings).items[0];

		expect(assigneeName(epic)).toBe('Sarah');
		expect(epic.assigneeEntry?.file).toBe(null);
	});
});

describe('resourceLabelsOf', () => {
	it('reads no labels before the first model exists, and the index once one does', () => {
		expect(resourceLabelsOf(null)).toEqual(new Map());
		const labels = new Map([['Alex.md', 'Alex']]);
		expect(resourceLabelsOf({ resourceLabels: labels })).toBe(labels);
	});
});

describe('the rows the resources axis draws', () => {
	const dated = settingsWith({
		assigneeKey: 'assignee',
		startKey: 'start',
		targetKey: 'due',
		hierarchyOnly: false,
	});

	/** A team of two, one of them with nothing assigned, plus whatever the caller adds. */
	function team(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		return vault;
	}

	function lanesOf(vault: FakeVault) {
		const model = buildModel(vault.app, vault.entries(), dated);
		return buildRoadmap(model, dated, () => true, 'resources');
	}

	it('draws one row per resource note, alphabetically, including one nobody names', () => {
		const vault = team();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: '[[Sam]]', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		// Alex has nothing assigned and still gets a row. That is what the removed
		// `resourceNames` option existed for, and it must not be lost with it.
		expect(roadmap.lanes.map((l) => l.name)).toEqual(['Alex', 'Sam']);
		expect(roadmap.lanes[1].bars).toHaveLength(1);
	});

	it('places a bare name that resolves to a resource note in that resource row', () => {
		// The upgrade case, and the reason it is a row rather than a shelf entry: the
		// value the note already carries resolves, so nothing was migrated and nothing
		// was lost.
		const vault = team();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Sam', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes[1].bars).toHaveLength(1);
		expect(roadmap.shelf).toEqual([]);
	});

	it('mints no row from a name nothing resolves — that item shelves', () => {
		const vault = team();
		vault.addFile('Stray.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Sarah', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.map((l) => l.name)).toEqual(['Alex', 'Sam']);
		expect(roadmap.shelf.map((s) => s.item.title)).toEqual(['Stray']);
	});

	it('shelves an item whose link resolves to a note that is not a Resource', () => {
		// A link is not a declaration, and the type is.
		const vault = team();
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: '[[Epic B]]', start: '2026-08-01', due: '2026-08-10' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.every((l) => l.bars.length === 0)).toBe(true);
		expect(roadmap.shelf.map((s) => s.item.title)).toContain('Work');
	});

	it('puts an absence in its resource row, and draws it nowhere when it resolves to no row', () => {
		const vault = team();
		vault.addFile('Alex away.md', {
			frontmatter: { type: 'Absence', assignee: '[[Alex]]', start: '2026-08-03', due: '2026-08-05' },
		});
		vault.addFile('Nobody away.md', {
			frontmatter: { type: 'Absence', assignee: 'Sarah', start: '2026-08-03', due: '2026-08-05' },
		});
		const roadmap = lanesOf(vault);

		expect(roadmap.lanes.map((l) => l.absences.length)).toEqual([1, 0]);
	});
});
