import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { scopeRows } from '../../src/domain/scopeRows';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

function model(vault: FakeVault) {
	return buildModel(
		vault.app,
		vault.entries(),
		settingsWith({ typeKey: 'type', parentKey: 'parent', orderKey: 'order', stateKey: 'state' }),
	);
}

describe('scopeRows', () => {
	it('keeps a member, its ancestors as context, and counts only members below', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Mine.md', { frontmatter: { type: 'PBI', state: 'Doing' }, parentLink: 'Feature' });
		vault.addFile('Theirs.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });

		const rows = scopeRows(model(vault), (item) => item.file.path === 'Mine.md');

		expect(rows.map((r) => [r.item.file.path, r.depth, r.context])).toEqual([
			['Epic.md', 0, true],
			['Feature.md', 1, true],
			['Mine.md', 2, false],
		]);
		expect(rows[0].memberTotal).toBe(1);
		expect(rows[2].memberTotal).toBe(0);
	});

	it('walks THROUGH a marker and re-roots the member at the level it occupied', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 1.md', { frontmatter: { type: 'Iteration' } });
		vault.addFile('Mine.md', { frontmatter: { type: 'PBI' }, parentLink: 'Sprint 1' });

		const rows = scopeRows(model(vault), (item) => item.file.path === 'Mine.md');

		expect(rows.map((r) => r.item.file.path)).toEqual(['Mine.md']);
		expect(rows[0].depth).toBe(0);
	});

	it('subtreeDone is true only when every member at or below the row is done', () => {
		const vault = new FakeVault();
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', state: 'Done' }, parentLink: 'Feature' });
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', state: 'Doing' }, parentLink: 'Feature' });

		const both = scopeRows(model(vault), (item) => item.typeName === 'PBI');
		expect(both.find((r) => r.item.file.path === 'Feature.md')!.subtreeDone).toBe(false);

		const doneOnly = scopeRows(model(vault), (item) => item.file.path === 'Done.md');
		expect(doneOnly.find((r) => r.item.file.path === 'Feature.md')!.subtreeDone).toBe(true);
	});
});
