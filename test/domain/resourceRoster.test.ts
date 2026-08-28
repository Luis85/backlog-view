import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { assigneeName, resourceLabelsOf } from '../../src/domain/readItems';
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
