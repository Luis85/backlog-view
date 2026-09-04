import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { rowsForPaths, scopeRows } from '../../src/domain/scopeRows';
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

describe('rowsForPaths', () => {
	function rowsFixture() {
		const vault = new FakeVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature' }, parentLink: 'E' });
		vault.addFile('P1.md', { frontmatter: { type: 'PBI' }, parentLink: 'F' });
		vault.addFile('P2.md', { frontmatter: { type: 'PBI' }, parentLink: 'F' });
		return scopeRows(model(vault), (item) => item.typeName === 'PBI');
	}

	it('keeps a named row and the ancestors above it', () => {
		const rows = rowsFixture();
		const kept = rowsForPaths(rows, new Set(['P1.md']));
		expect(kept.map((r) => r.item.file.path)).toEqual(['E.md', 'F.md', 'P1.md']);
	});

	it('drops a subtree naming nothing', () => {
		const rows = rowsFixture();
		const kept = rowsForPaths(rows, new Set(['P1.md']));
		expect(kept.some((r) => r.item.file.path === 'P2.md')).toBe(false);
	});

	it('answers empty for a path the rows do not hold', () => {
		const rows = rowsFixture();
		expect(rowsForPaths(rows, new Set(['gone.md']))).toEqual([]);
	});

	it('keeps depth exactly as it was — the tree closes up around nothing', () => {
		const rows = rowsFixture();
		const kept = rowsForPaths(rows, new Set(['P1.md']));
		expect(kept.map((r) => r.depth)).toEqual([0, 1, 2]);
	});

	// Every caller in Task 11 hands this a set of many paths at once — the readiness
	// criteria's own `outstandingPaths` — while every test above drove it with one. Both
	// gaps left by Task 10, pinned here since they now hold behaviour a caller depends on.
	it('keeps every named row when several are named at once, sharing their ancestors', () => {
		const rows = rowsFixture();
		const kept = rowsForPaths(rows, new Set(['P1.md', 'P2.md']));
		expect(kept.map((r) => r.item.file.path)).toEqual(['E.md', 'F.md', 'P1.md', 'P2.md']);
	});

	it('does not duplicate an ancestor that is itself named', () => {
		const rows = rowsFixture();
		const kept = rowsForPaths(rows, new Set(['F.md', 'P1.md']));
		expect(kept.map((r) => r.item.file.path)).toEqual(['E.md', 'F.md', 'P1.md']);
	});
});
