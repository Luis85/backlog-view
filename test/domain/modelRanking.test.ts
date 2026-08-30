import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

describe('buildModel ranking', () => {
	it('ranks every loaded item globally, context rows included, unranked last', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('PBI C.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('PBI D.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.ranked.map((i) => i.file.basename)).toEqual(['Epic B', 'PBI C', 'Epic A', 'PBI D']);
	});

	it('orders focus rows by global rank, not by tree position', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		// A's child ranks AFTER B's child globally — DFS preorder would list it first.
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 9000 }, parentLink: 'Epic A' });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 3000 }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI B1', 'PBI A1']);
	});
});
