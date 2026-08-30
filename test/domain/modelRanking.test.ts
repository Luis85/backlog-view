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
});
