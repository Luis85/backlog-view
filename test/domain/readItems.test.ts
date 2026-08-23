import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { FakeVault } from '../helpers/vault';

/**
 * `BacklogItem.releaseEntry` — read the way `iterationEntry` is (`iteration.test.ts`):
 * a plain `readLinkList` read, gated on the key being configured. Its own file for the
 * reason `iteration.test.ts` is its own file: split by subject before a shared suite
 * becomes where tests hide.
 */
describe('reading the release link', () => {
	it('reads the release a work item names, as a resolved link', () => {
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ releaseKey: 'release' }));
		expect(model.byPath.get('F.md')?.releaseEntry?.file?.path).toBe('2.4.md');
	});

	it('reads no release entry when the key is unbound', () => {
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ releaseKey: '' }));
		expect(model.byPath.get('F.md')?.releaseEntry).toBeNull();
	});
});
