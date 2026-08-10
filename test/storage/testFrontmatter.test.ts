import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * The test workflow's own write path — `deliverableFrontmatter.test.ts`'s shape
 * ("removes the Deliverable state key, and undo puts it back"), over
 * `testState`/`removeTestStateKey`. Pins two things at once: that `touchedKeys` lists the
 * resolved test-state key (without it, the write lands but captures no inverse, so undo
 * silently restores nothing), and that `removeTestStateKey`'s `&& testStateKey` guard in
 * `applyInto` is exercised — the menu never offers a "no state" entry for a catalog row
 * today, so this branch was previously reachable only from here.
 */
const settings = defaultSettings();

describe('applyWrites — the test workflow', () => {
	it('removes the test state key, and undo puts it back', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('C.md', { frontmatter: { type: 'Test case', testStatus: 'Draft' } });
		const configured = { ...settings, testStateKey: 'testStatus' };
		const inverses: RestoreWrite[] = [];

		await applyWrites(
			vault.app,
			configured,
			[{ file: item, removeTestStateKey: true }],
			undefined,
			(inv) => inverses.push(inv),
		);
		expect('testStatus' in vault.fm('C.md')).toBe(false);

		await applyRestores(vault.app, inverses);
		expect(vault.fm('C.md')['testStatus']).toBe('Draft');
	});
});
